import { createSupabaseClient } from '../supabase/createSupabaseClient';
import { generateBatchMessageEmbeddings } from '../embeddings';
import type { Database } from '../supabase/types';
import type { Environment } from '../supabase/environment';
import type { SupabaseClient } from '@supabase/supabase-js';

type SupabaseMessage = Database['public']['Tables']['messages']['Row'];
type VectorEmbedding = Database['vector_store']['Tables']['message_embeddings_dev']['Insert'];

interface SyncState {
  lastSyncTimestamp: string;
}

interface SyncResult {
  messagesProcessed: number;
  totalBatches: number;
}

export class MessageSyncJob {
  private lastSyncTimestamp: string;
  private supabase: SupabaseClient<Database>;
  private vectorClient: SupabaseClient<Database>;
  private environment: Environment;
  private readonly BATCH_SIZE = 100;

  constructor(environment: Environment) {
    this.environment = environment;
    this.supabase = createSupabaseClient(environment, 'default');
    this.vectorClient = createSupabaseClient(environment, 'vector');
    this.lastSyncTimestamp = new Date(0).toISOString(); // Start from beginning

    // Log vector client configuration
    console.log('Vector client config:', {
      url: process.env.VECTOR_SUPABASE_URL,
      hasServiceKey: !!process.env.VECTOR_SUPABASE_SERVICE_KEY
    });
  }

  /**
   * Sync new messages to the vector store
   * @returns SyncResult with statistics about the sync operation
   */
  async sync(): Promise<SyncResult> {
    let totalProcessed = 0;
    let batchCount = 0;
    
    try {
      let hasMoreMessages = true;
      while (hasMoreMessages) {
        const messages = await this.getNewMessages();
        if (messages.length === 0) {
          hasMoreMessages = false;
          break;
        }
        
        await this.processMessages(messages);
        this.lastSyncTimestamp = messages[messages.length - 1].created_at;
        
        totalProcessed += messages.length;
        batchCount++;
        
        console.log(`Processed batch ${batchCount}, total messages so far: ${totalProcessed}`);
      }

      return {
        messagesProcessed: totalProcessed,
        totalBatches: batchCount
      };
    } catch (error) {
      console.error('Error in sync operation:', error);
      throw error;
    }
  }

  /**
   * Get messages that haven't been synced yet
   */
  private async getNewMessages(): Promise<SupabaseMessage[]> {
    console.log('Fetching messages after:', this.lastSyncTimestamp);
    const { data: messages, error } = await this.supabase
      .from('messages')
      .select('*')
      .gt('created_at', this.lastSyncTimestamp)
      .order('created_at', { ascending: true })
      .limit(this.BATCH_SIZE);

    if (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
    
    console.log('Found messages:', messages?.length || 0);
    return messages || [];
  }

  /**
   * Process messages and store their embeddings
   */
  private async processMessages(messages: SupabaseMessage[]): Promise<void> {
    console.log('Processing messages batch:', messages.length);

    try {
      const tableName = this.environment === 'production' 
        ? 'message_embeddings_prod'
        : 'message_embeddings_dev';

      // First check which messages already have embeddings using our RPC function
      const { data: existingIds, error: checkError } = await this.vectorClient
        .rpc('check_message_embeddings', {
          message_ids: messages.map(m => m.id),
          target_table: tableName
        });

      if (checkError) {
        console.error('Error checking existing messages:', checkError);
        throw checkError;
      }

      // Filter out messages that already have embeddings
      const existingMessageIds = new Set(existingIds || []);
      const newMessages = messages.filter(msg => !existingMessageIds.has(msg.id));

      if (newMessages.length === 0) {
        console.log(`All ${messages.length} messages already have embeddings`);
        return;
      }

      console.log(`Generating embeddings for ${newMessages.length} new messages...`);
      const embeddings = await generateBatchMessageEmbeddings(
        newMessages.map(msg => ({
          id: msg.id,
          user_id: msg.user_id,
          content: msg.content
        }))
      );

      // Store embeddings using our RPC function
      console.log('Inserting embeddings into table:', tableName);
      const { data: stats, error: insertError } = await this.vectorClient
        .rpc('insert_message_embeddings', {
          embeddings: embeddings,
          target_table: tableName
        });

      if (insertError) {
        console.error('Error inserting embeddings:', {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint
        });
        throw insertError;
      }

      console.log('Successfully processed messages batch:', {
        total: messages.length,
        new: newMessages.length,
        skipped: messages.length - newMessages.length,
        insertStats: stats
      });
    } catch (error: any) {
      console.error('Error processing messages:', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        name: error?.name,
        stack: error?.stack
      });
      throw error;
    }
  }

  /**
   * Get the current sync state
   */
  getSyncState(): SyncState {
    return {
      lastSyncTimestamp: this.lastSyncTimestamp
    };
  }

  /**
   * Set the sync state
   */
  setSyncState(state: SyncState): void {
    this.lastSyncTimestamp = state.lastSyncTimestamp;
  }
} 