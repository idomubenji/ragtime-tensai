import { createClient } from '@supabase/supabase-js';
import { Database } from './types';

// Use production URLs and keys by default for the global client
if (!process.env.NEXT_PUBLIC_SUPABASE_URL_PROD) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL_PROD');
}

// Use service role key for tests and development
const supabaseKey = process.env.NODE_ENV === 'production'
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD
  : process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  throw new Error('Missing Supabase key');
}

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL_PROD,
  supabaseKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

// Helper function to check if user is authenticated
export const isAuthenticated = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error checking authentication:', error.message);
    return false;
  }
  return !!session;
};

// Helper function to get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting current user:', error.message);
    return null;
  }
  return user;
}; 