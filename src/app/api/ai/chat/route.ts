import { NextResponse, NextRequest } from 'next/server';
import { lookupUserByUsername } from '@/utils/supabase/users';
import { getUserMessages } from '@/utils/supabase/users';
import { generateResponse } from '@/utils/langchain/response';
import { validateApiKey, getAuthErrorResponse } from '@/utils/auth/api-auth';
import { validateEnvironment, EnvironmentError } from '@/utils/supabase/environment';
import { createSupabaseClient } from '@/utils/supabase/createSupabaseClient';

export async function POST(request: NextRequest) {
  // Validate API key
  if (!validateApiKey(request)) {
    return getAuthErrorResponse();
  }

  try {
    const body = await request.json();
    const { message, mentionedUsername, environment = 'development' } = body;

    // Validate environment
    try {
      validateEnvironment(environment);
    } catch (error) {
      if (error instanceof EnvironmentError) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      throw error;
    }

    // Create Supabase client for the specified environment
    const supabase = createSupabaseClient(environment);

    // Default to TENSAI BOT if no username mentioned
    if (!mentionedUsername) {
      return NextResponse.json({
        content: message,
        username: 'TENSAI BOT',
        avatarUrl: null,
      });
    }

    // Lookup the mentioned user using environment-specific client
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('name', mentionedUsername)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (userError) {
      console.error('Error looking up user:', userError.message);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user's message history using environment-specific client
    const { data: messagesData = [], error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError.message);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    const messages = messagesData || [];

    // Generate response using LangChain
    const content = await generateResponse({
      message,
      username: user.name,
      userMessages: messages,
      temperature: 0.7,
    });

    return NextResponse.json({
      content,
      username: `FAKE ${user.name}`,
      avatarUrl: user.avatar_url,
    });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 