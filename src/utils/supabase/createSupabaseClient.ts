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

    console.log('Creating vector client:', {
      hasUrl: !!process.env.VECTOR_SUPABASE_URL,
      hasKey: !!process.env.VECTOR_SUPABASE_SERVICE_KEY,
      url: process.env.VECTOR_SUPABASE_URL?.substring(0, 10) + '...'
    });

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
    // Always use production URL since we're on Vercel
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL_PROD;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.error('Missing Supabase credentials:', {
        hasUrl: !!url,
        hasKey: !!key,
        type
      });
      throw new Error('Missing required Supabase environment variables');
    }

    console.log('Creating Supabase client:', {
      environment,
      type,
      hasUrl: !!url,
      hasKey: !!key,
      url: url.substring(0, 10) + '...'
    });

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