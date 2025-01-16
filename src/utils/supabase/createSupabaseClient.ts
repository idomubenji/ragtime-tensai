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
    // Select URL based on environment
    console.log('URL Selection:', {
      environment,
      NODE_ENV: process.env.NODE_ENV,
      DEV_URL: process.env.NEXT_PUBLIC_SUPABASE_URL_DEV,
      PROD_URL: process.env.NEXT_PUBLIC_SUPABASE_URL_PROD,
      SERVICE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });

    const url = environment === 'development'
      ? process.env.NEXT_PUBLIC_SUPABASE_URL_DEV
      : process.env.NEXT_PUBLIC_SUPABASE_URL_PROD;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Check each required variable individually
    const missingVars = [];
    if (environment === 'development' && !process.env.NEXT_PUBLIC_SUPABASE_URL_DEV) {
      missingVars.push('NEXT_PUBLIC_SUPABASE_URL_DEV');
    }
    if (environment === 'production' && !process.env.NEXT_PUBLIC_SUPABASE_URL_PROD) {
      missingVars.push('NEXT_PUBLIC_SUPABASE_URL_PROD');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');

    if (missingVars.length > 0) {
      const errorMsg = `Missing required Supabase environment variables: ${missingVars.join(', ')}`;
      console.error(errorMsg);
      console.error('Current environment:', process.env.NODE_ENV);
      console.error('Available env vars:', Object.keys(process.env).filter(key => key.includes('SUPABASE')));
      throw new Error(errorMsg);
    }

    // At this point, we know url and key are defined
    console.log('Creating Supabase client:', {
      environment,
      type,
      hasUrl: true,
      hasKey: true,
      url: url!.substring(0, 10) + '...'
    });

    return createClient<Database>(
      url!,
      key!,
      {
        auth: {
          persistSession: false
        }
      }
    );
  }
} 