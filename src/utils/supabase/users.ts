import { supabase } from './client';
import type { Database } from './types';
import { createSupabaseClient } from './createSupabaseClient';
import type { Environment } from './environment';

type User = Database['public']['Tables']['users']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];

export async function lookupUserByUsername(username: string, environment: Environment = 'development'): Promise<User | null> {
  const client = createSupabaseClient(environment, 'default');
  const { data, error } = await client
    .from('users')
    .select('*')
    .eq('name', username)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error looking up user:', error.message);
    return null;
  }

  return data;
}

export async function getUserMessages(userId: string, environment: Environment = 'development', limit = 100): Promise<Message[]> {
  const client = createSupabaseClient(environment, 'default');
  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching user messages:', error.message);
    return [];
  }

  return data;
}

export async function getUserChannelMessages(
  userId: string, 
  channelId: string,
  environment: Environment = 'development',
  limit = 50
): Promise<Message[]> {
  const client = createSupabaseClient(environment, 'default');
  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('user_id', userId)
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching user channel messages:', error.message);
    return [];
  }

  return data;
} 