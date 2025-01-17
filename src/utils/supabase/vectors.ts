import { SupabaseClient } from '@supabase/supabase-js';
import { Environment } from './environment';
import { createSupabaseClient } from './createSupabaseClient';

/**
 * Vector embedding types matching our database schema
 */
export interface MessageEmbedding {
  message_id: string;
  user_id: string;
  content_embedding: number[];       // 3072-dimensional vector
  content_embedding_small: number[]; // 1536-dimensional vector
  id?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Result from similarity search
 */
export interface SimilaritySearchResult {
  id: string;
  message_id: string;
  similarity: number;
  user_id: string;
}

/**
 * Configuration for vector operations
 */
export interface VectorConfig {
  tableName: string;         // Name of the vector table
  matchThreshold: number;    // Minimum similarity score (0-1)
  matchCount: number;        // Maximum number of results to return
  userId?: string;          // Optional user ID to filter results
}

/**
 * Store message embeddings in the vector store
 */
export async function storeMessageEmbeddings(
  client: SupabaseClient,
  embeddings: Pick<MessageEmbedding, 'message_id' | 'user_id' | 'content_embedding' | 'content_embedding_small'>[],
  environment: Environment
): Promise<void> {
  const { error } = await client
    .from(getVectorTableName(environment))
    .insert(embeddings);

  if (error) {
    throw new Error(`Failed to store embeddings: ${error.message}`);
  }
}

/**
 * Find similar messages using the large embedding (3072d)
 */
export async function findSimilarMessages(
  client: SupabaseClient,
  embedding: number[],
  config: VectorConfig
): Promise<SimilaritySearchResult[]> {
  if (embedding.length !== 3072) {
    throw new Error('Large embedding must be 3072 dimensions');
  }

  const { data, error } = await client
    .rpc('match_messages', {
      query_embedding: embedding,
      match_threshold: config.matchThreshold,
      match_count: config.matchCount,
      table_name: config.tableName
    });

  if (error) {
    throw new Error(`Failed to find similar messages: ${error.message}`);
  }

  return data;
}

/**
 * Find similar messages using the small embedding (1536d)
 * This is faster due to IVF index but potentially less accurate
 */
export async function findSimilarMessagesSmall(
  client: SupabaseClient,
  embedding: number[],
  config: VectorConfig
): Promise<SimilaritySearchResult[]> {
  // 1. Input Validation
  console.log('Vector Search Step 1 - Input Validation:', {
    embeddingSize: embedding.length,
    configProvided: {
      tableName: config.tableName,
      matchThreshold: config.matchThreshold,
      matchCount: config.matchCount,
      userId: config.userId
    }
  });

  if (embedding.length !== 1536) {
    throw new Error('Small embedding must be 1536 dimensions');
  }

  // 2. Database Connection Check
  console.log('Vector Search Step 2 - Database Connection:', {
    url: process.env.VECTOR_SUPABASE_URL?.substring(0, 10) + '...',
    hasServiceKey: !!process.env.VECTOR_SUPABASE_SERVICE_KEY,
    clientConfig: {
      hasAuth: !!client.auth
    }
  });

  // 3. RPC Function Call
  console.log('Vector Search Step 3 - Preparing RPC Call:', {
    functionName: 'match_messages_small',
    parameters: {
      query_embedding: `${embedding.length} dimensions`,
      match_threshold: config.matchThreshold,
      match_count: config.matchCount,
      table_name: config.tableName,
      filter_user_id: config.userId
    }
  });

  const { data, error } = await client.rpc('match_messages_small', {
    query_embedding: embedding,
    match_threshold: config.matchThreshold,
    match_count: config.matchCount,
    table_name: config.tableName,
    filter_user_id: config.userId
  });

  if (error) {
    console.error('Vector search error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      table: config.tableName,
      query: {
        embedding_size: embedding.length,
        threshold: config.matchThreshold,
        count: config.matchCount,
        user_id: config.userId
      }
    });
    throw error;
  }

  // Log successful search details
  console.log('Vector search details:', {
    success: !error,
    resultCount: data?.length ?? 0,
    table: config.tableName,
    firstResult: data?.[0] ? {
      id: data[0].id,
      similarity: data[0].similarity,
      message_id: data[0].message_id
    } : null,
    query: {
      embedding_size: embedding.length,
      threshold: config.matchThreshold,
      count: config.matchCount,
      user_id: config.userId
    }
  });

  return data || [];
}

/**
 * Get the appropriate table name based on environment
 */
export function getVectorTableName(environment: Environment): string {
  // Check environment variables first
  const envTableName = process.env.VECTOR_TABLE_NAME;
  
  // Default names based on environment
  const defaultName = environment === 'production' 
    ? 'message_embeddings_prod' 
    : 'message_embeddings_dev';
  
  // Use environment variable if set, otherwise use default
  const tableName = envTableName || defaultName;
  
  // Remove any schema prefix if present
  const cleanTableName = tableName.replace(/^vector_store\./, '');
  
  console.log('Getting vector table name:', {
    environment,
    envTableName,
    defaultName,
    finalTableName: cleanTableName,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      VECTOR_TABLE_NAME: process.env.VECTOR_TABLE_NAME
    }
  });
  
  return cleanTableName;
}

/**
 * Create a Supabase client for vector operations
 */
export function createVectorClient(environment: Environment): SupabaseClient {
  return createSupabaseClient(environment);
}

/**
 * Test function to directly verify vector search functionality
 */
export async function testVectorSearch(environment: Environment) {
  console.log('Starting vector search test...');
  
  try {
    // Create separate clients for each database
    const appClient = createSupabaseClient(environment, 'default');
    const vectorClient = createSupabaseClient(environment, 'vector');
    
    // Step 1: Start with a username
    const mentionedUsername = 'Kurakami';
    console.log('Starting with mentioned username:', mentionedUsername);

    // Step 2: Find the user's ID from the users table
    console.log('Looking up user ID for username:', mentionedUsername);
    const { data: userData, error: userError } = await appClient
      .from('users')
      .select('id')
      .eq('name', mentionedUsername)
      .single();

    if (userError) {
      console.error('Failed to find user:', userError);
      throw userError;
    }

    const userId = userData.id;
    console.log('Found user ID:', userId);

    // Step 3: Find all embeddings for this user in the vector store
    const tableName = getVectorTableName(environment);
    console.log('Checking vector database for embeddings from user:', userId);
    const { data: vectorData, error: vectorError } = await vectorClient
      .rpc('match_messages_small', {
        query_embedding: Array(1536).fill(0),
        match_threshold: 0.0,
        match_count: 100,
        table_name: tableName,
        filter_user_id: userId
      });

    console.log('Vector database embeddings:', {
      success: !vectorError,
      resultCount: vectorData?.length ?? 0,
      error: vectorError ? {
        code: vectorError.code,
        message: vectorError.message,
        details: vectorError.details
      } : null,
      sampleEmbeddings: vectorData?.slice(0, 5).map((m: any) => ({
        id: m.id,
        message_id: m.message_id,
        user_id: m.user_id,
        similarity: m.similarity
      })),
      tableName: `vector_store.${tableName}`
    });

    return {
      success: !vectorError && !userError,
      userLookup: {
        success: !userError,
        username: mentionedUsername,
        userId: userId
      },
      vectorDatabase: {
        success: !vectorError,
        embeddingCount: vectorData?.length ?? 0,
        tableName: `vector_store.${tableName}`
      }
    };
  } catch (err) {
    console.error('Test failed with error:', err);
    throw err;
  }
} 