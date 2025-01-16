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
      tableName: config.tableName
    });
    throw error;
  }

  console.log('Vector search results:', {
    success: !error,
    resultCount: data?.length ?? 0,
    tableName: config.tableName,
    firstResult: data?.[0]
  });

  return data || [];
}

/**
 * Get the appropriate table name based on environment
 */
export function getVectorTableName(environment: Environment): string {
  const baseName = process.env.VECTOR_TABLE_NAME || 
    (environment === 'production' ? 'message_embeddings_prod' : 'message_embeddings_dev');
  
  console.log('Getting vector table name:', {
    environment,
    envTableName: process.env.VECTOR_TABLE_NAME,
    baseName
  });
  
  return baseName;
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
    // 1. Create vector client
    const client = createSupabaseClient(environment, 'vector');
    console.log('Vector client created:', {
      url: process.env.VECTOR_SUPABASE_URL,
      hasServiceKey: !!process.env.VECTOR_SUPABASE_SERVICE_KEY
    });

    // 2. Test simple RPC call first
    console.log('Testing RPC connection...');
    const { data: rpcTest, error: rpcError } = await client.rpc('vector_begin_transaction');
    console.log('RPC test result:', {
      success: !rpcError,
      error: rpcError ? {
        code: rpcError.code,
        message: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint
      } : null
    });

    // 3. Get available functions
    console.log('Checking available functions...');
    const { data: functions, error: funcError } = await client
      .rpc('run_sql', {
        sql: "SELECT proname, pronamespace::regnamespace as schema FROM pg_proc WHERE pronamespace::regnamespace = 'vector_store'::regnamespace;"
      });
    
    console.log('Available functions:', {
      success: !funcError,
      functions: functions,
      error: funcError ? {
        code: funcError.code,
        message: funcError.message,
        details: funcError.details,
        hint: funcError.hint
      } : null
    });

    // 4. Test vector search with minimal parameters
    console.log('Testing vector search with minimal params...');
    const testEmbedding = new Array(1536).fill(0.1);
    const { data: searchResult, error: searchError } = await client
      .rpc('match_messages_small', {
        query_embedding: testEmbedding,
        match_threshold: 0.8,
        match_count: 1,
        table_name: getVectorTableName(environment)
      });

    console.log('Vector search test result:', {
      success: !searchError,
      resultCount: searchResult?.length ?? 0,
      error: searchError ? {
        code: searchError.code,
        message: searchError.message,
        details: searchError.details,
        hint: searchError.hint
      } : null,
      firstResult: searchResult?.[0]
    });

    return {
      success: !rpcError && !funcError && !searchError,
      rpcTest: !rpcError,
      functionsCheck: !funcError,
      searchTest: !searchError
    };
  } catch (err) {
    console.error('Test failed with error:', err);
    throw err;
  }
} 