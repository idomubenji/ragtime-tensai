import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './types';
import { Environment, EnvironmentError } from './environment';

// Configuration type for each environment
interface SupabaseConfig {
  url: string;
  key: string;
}

// Get environment-specific configuration
function getSupabaseConfig(env: Environment): SupabaseConfig {
  switch (env) {
    case 'development':
      if (!process.env.DEVELOPMENT_SUPABASE_URL || !process.env.DEVELOPMENT_SUPABASE_KEY) {
        throw new EnvironmentError('Missing development Supabase configuration');
      }
      return {
        url: process.env.DEVELOPMENT_SUPABASE_URL,
        key: process.env.DEVELOPMENT_SUPABASE_KEY,
      };

    case 'production':
      if (!process.env.PRODUCTION_SUPABASE_URL || !process.env.PRODUCTION_SUPABASE_KEY) {
        throw new EnvironmentError('Missing production Supabase configuration');
      }
      return {
        url: process.env.PRODUCTION_SUPABASE_URL,
        key: process.env.PRODUCTION_SUPABASE_KEY,
      };
  }
}

// Cache to store clients for each environment
const clientCache: Record<Environment, SupabaseClient<Database> | undefined> = {
  development: undefined,
  production: undefined,
};

// Create or return cached Supabase client for the specified environment
export function createSupabaseClient(env: Environment): SupabaseClient<Database> {
  // Return cached client if it exists
  if (clientCache[env]) {
    return clientCache[env]!;
  }

  // Get configuration for the environment
  const config = getSupabaseConfig(env);

  // Create new client
  const client = createClient<Database>(
    config.url,
    config.key,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );

  // Cache the client
  clientCache[env] = client;

  return client;
} 