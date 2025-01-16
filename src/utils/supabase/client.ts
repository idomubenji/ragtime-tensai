import { createClient } from '@supabase/supabase-js';
import { Database } from './types';

// Always use production URL and service role key
if (!process.env.NEXT_PUBLIC_SUPABASE_URL_PROD) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL_PROD');
}

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  throw new Error('Missing Supabase key');
}

console.log('Creating default Supabase client:', {
  hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL_PROD,
  hasKey: !!supabaseKey,
  url: process.env.NEXT_PUBLIC_SUPABASE_URL_PROD?.substring(0, 10) + '...'
});

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