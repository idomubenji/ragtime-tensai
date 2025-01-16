import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import type { Environment } from './environment';

/**
 * Create a Supabase client for the specified environment
 * @param environment - Target environment ('development' or 'production')
 * @param type - The type of client to create ('default' or 'vector')
 * @returns Supabase client instance
 */
export function createSupabaseClient(environment: Environment, type: 'default' | 'vector' = 'default') {
  if (type === 'vector') {
    // For vector operations, use the vector database credentials
    if (!process.env.VECTOR_SUPABASE_URL || !process.env.VECTOR_SUPABASE_SERVICE_KEY) {
      throw new Error('Missing required Vector Supabase environment variables');
    }

    return createClient<Database>(
      process.env.VECTOR_SUPABASE_URL,
      process.env.VECTOR_SUPABASE_SERVICE_KEY,
      {
        auth: {
          persistSession: false
        }
      }
    );
  } else {
    // For regular operations, use environment-specific credentials
    const url = environment === 'development' 
      ? process.env.SUPABASE_URL_DEV 
      : process.env.SUPABASE_URL_PROD;
    
    const key = environment === 'development'
      ? process.env.SUPABASE_KEY_DEV
      : process.env.SUPABASE_KEY_PROD;

    if (!url || !key) {
      throw new Error(`Missing required Supabase environment variables for ${environment} environment`);
    }

    return createClient<Database>(
      url,
      key,
      {
        auth: {
          persistSession: false
        }
      }
    );
  }
} 