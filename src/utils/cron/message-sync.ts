import { getUserMessages, lookupUserByUsername } from '../supabase/users';
import { PineconeClient } from '@pinecone-database/pinecone';
import { vectorizeMessage } from '../pinecone/messages';
import { supabase } from '../supabase/client';
import type { Database } from '../supabase/types';

type SupabaseMessage = Database['public']['Tables']['messages']['Row'];
type PineconeMessage = {
  id: string;
  content: string;
  username: string;
  created_at: string;
};

interface SyncState {
  lastSyncTimestamp: string;
}

export class MessageSyncJob {
  private lastSyncTimestamp: string;
  private pineconeClient: PineconeClient;

  constructor(pineconeClient: PineconeClient) {
    this.pineconeClient = pineconeClient;
    // Default to current timestamp if no previous sync
    this.lastSyncTimestamp = new Date().toISOString();
  }

  async syncMessages(): Promise<void> {
    try {
      // Get messages since last sync
      const newMessages = await this.getNewMessages();
      
      if (newMessages.length === 0) {
        console.log('No new messages to sync');
        return;
      }

      // Vectorize and upload messages
      await this.processMessages(newMessages);

      // Update last sync timestamp
      this.lastSyncTimestamp = new Date().toISOString();
    } catch (error) {
      console.error('Error syncing messages:', error);
      throw error;
    }
  }

  private async getNewMessages(): Promise<SupabaseMessage[]> {
    try {
      // Get all messages created after the last sync
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .gt('created_at', this.lastSyncTimestamp)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching new messages:', error);
        throw error;
      }

      return messages || [];
    } catch (error) {
      console.error('Error in getNewMessages:', error);
      throw error;
    }
  }

  private async processMessages(messages: SupabaseMessage[]): Promise<void> {
    const failures: string[] = [];

    // Process messages in parallel with both models
    await Promise.all(messages.map(async (message) => {
      try {
        // Get user info for the message
        const user = await lookupUserByUsername(message.user_id);
        if (!user) {
          console.error(`User not found for message ${message.id}`);
          failures.push(message.id);
          return;
        }

        // Convert to Pinecone message format
        const pineconeMessage: PineconeMessage = {
          id: message.id,
          content: message.content,
          username: user.name,
          created_at: message.created_at,
        };

        // Vectorize with both large and small models
        const [largeSuccess, smallSuccess] = await Promise.all([
          vectorizeMessage(pineconeMessage, false), // Large model
          vectorizeMessage(pineconeMessage, true)   // Small model
        ]);

        if (!largeSuccess || !smallSuccess) {
          failures.push(message.id);
        }
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        failures.push(message.id);
      }
    }));

    if (failures.length > 0) {
      console.error(`Failed to process ${failures.length} messages:`, failures);
    }
  }

  // Get current sync state
  getSyncState(): SyncState {
    return {
      lastSyncTimestamp: this.lastSyncTimestamp
    };
  }

  // Set sync state (e.g., from persistent storage)
  setSyncState(state: SyncState): void {
    this.lastSyncTimestamp = state.lastSyncTimestamp;
  }
} 