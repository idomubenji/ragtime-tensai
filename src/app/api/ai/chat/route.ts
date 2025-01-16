import { NextResponse, NextRequest } from 'next/server';
import { lookupUserByUsername } from '@/utils/supabase/users';
import { getUserMessages } from '@/utils/supabase/users';
import { generateResponse } from '@/utils/langchain/response';
import { validateApiKey, getAuthErrorResponse } from '@/utils/auth/api-auth';
import { validateEnvironment, EnvironmentError } from '@/utils/supabase/environment';
import { createSupabaseClient } from '@/utils/supabase/createSupabaseClient';
import { initializeLangchainTracing } from '@/utils/langchain/tracing';
import { findSimilarMessagesSmall, getVectorTableName, type SimilaritySearchResult } from '@/utils/supabase/vectors';
import { OpenAIEmbeddings } from '@langchain/openai';
import type { Message } from '@/utils/supabase/types';
import { supabase } from '@/utils/supabase/client';

// Initialize tracing for this route
console.log('Initializing tracing in API route...');
initializeLangchainTracing();

// Initialize embeddings model once for reuse
const embeddings = new OpenAIEmbeddings();

// Cache for user lookups (5 minute TTL)
const userCache = new Map<string, { user: any; timestamp: number }>();
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache for message embeddings (1 minute TTL)
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();
const EMBEDDING_CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Clean expired entries from caches
 */
function cleanCaches() {
  const now = Date.now();
  Array.from(userCache.entries()).forEach(([key, value]) => {
    if (now - value.timestamp > USER_CACHE_TTL) {
      userCache.delete(key);
    }
  });
  Array.from(embeddingCache.entries()).forEach(([key, value]) => {
    if (now - value.timestamp > EMBEDDING_CACHE_TTL) {
      embeddingCache.delete(key);
    }
  });
}

/**
 * Get cached user or fetch from database
 */
async function getCachedUser(username: string) {
  const cached = userCache.get(username);
  if (cached && Date.now() - cached.timestamp < USER_CACHE_TTL) {
    return cached.user;
  }

  const user = await lookupUserByUsername(username);
  if (user) {
    userCache.set(username, { user, timestamp: Date.now() });
  }
  return user;
}

/**
 * Get cached embedding or generate new one
 */
async function getCachedEmbedding(message: string) {
  const cached = embeddingCache.get(message);
  if (cached && Date.now() - cached.timestamp < EMBEDDING_CACHE_TTL) {
    return cached.embedding;
  }

  const embedding = await embeddings.embedQuery(message);
  embeddingCache.set(message, { embedding, timestamp: Date.now() });
  return embedding;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let error: Error | null = null;
  let user = null;
  let userMessages: Message[] = [];
  let body: any;

  try {
    // Clean caches periodically (but don't block the request)
    setTimeout(cleanCaches, 0);
    
    body = await request.json();
    const { 
      message, 
      mentionedUsername, 
      environment = 'development',
      matchThreshold = 0.5  // Default to 0.5 if not provided
    } = body;

    // Validate environment first
    try {
      validateEnvironment(environment);
    } catch (err) {
      if (err instanceof Error && err.name === 'EnvironmentError') {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    // Then validate API key with the validated environment
    if (!validateApiKey(request, environment)) {
      return getAuthErrorResponse();
    }

    // Look up the mentioned user (with caching)
    console.log('Looking up user:', {
      mentionedUsername,
      environment,
      cacheHit: userCache.has(mentionedUsername)
    });
    user = await getCachedUser(mentionedUsername);
    if (!user) {
      console.log('User not found, falling back to all users:', {
        mentionedUsername,
        environment
      });
    }

    console.log('User lookup result:', {
      found: !!user,
      userId: user?.id,
      userName: user?.name
    });
    
    // Get messages from specified user or all users
    console.log('Fetching messages:', {
      userId: user?.id,
      environment,
      mode: user ? 'single user' : 'all users'
    });

    if (user) {
      userMessages = await getUserMessages(user.id).catch(err => {
        console.error('Failed to get user messages:', err);
        return []; // Return empty array to allow fallback behavior
      });
    } else {
      // Fetch messages from all users when no specific user found
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Failed to get messages:', error);
        userMessages = [];
      } else {
        userMessages = data;
      }
    }

    if (userMessages.length === 0) {
      return NextResponse.json(
        { error: 'No messages found in the database' },
        { status: 404 }
      );
    }

    console.log('Messages result:', {
      count: userMessages.length,
      messageIds: userMessages.map(m => m.id)
    });

    // Get message embedding
    console.log('Generating message embedding:', {
      message,
      cacheHit: embeddingCache.has(message)
    });
    const messageEmbedding = await getCachedEmbedding(message).catch(err => {
      console.error('Failed to generate embedding:', err);
      throw new Error('Failed to process message embedding');
    });
    console.log('Embedding generated:', {
      dimensions: messageEmbedding.length
    });

    // Find similar messages with retry
    let similarMessages: SimilaritySearchResult[];
    try {
      const vectorClient = createSupabaseClient(environment, 'vector');
      const tableName = getVectorTableName(environment);
      console.log('Vector search attempt:', {
        environment,
        tableName,
        embeddingSize: messageEmbedding.length,
        userId: user?.id,
        matchThreshold,
        matchCount: 10
      });

      similarMessages = await findSimilarMessagesSmall(vectorClient, messageEmbedding, {
        tableName,
        matchThreshold,
        matchCount: 10,
        userId: user?.id
      });

      console.log('Vector search results:', {
        count: similarMessages.length,
        userId: user?.id,
        tableName,
        results: similarMessages.map(msg => ({
          id: msg.id,
          messageId: msg.message_id,
          similarity: msg.similarity,
          userId: msg.user_id
        }))
      });
    } catch (err) {
      console.error('Failed to find similar messages:', {
        error: err,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorStack: err instanceof Error ? err.stack : undefined,
        userId: user?.id,
        environment,
        tableName: getVectorTableName(environment)
      });
      // Fallback to empty array if vector search fails
      similarMessages = [];
    }

    // Format messages for the AI
    const formattedMessages = similarMessages.map((similarMsg: any) => {
      // Find the full message content from userMessages
      const fullMessage = userMessages.find(msg => msg.id === similarMsg.message_id);
      if (!fullMessage) {
        console.warn('Could not find message content for:', {
          messageId: similarMsg.message_id,
          similarity: similarMsg.similarity
        });
        return null;
      }
      
      return {
        ...fullMessage,
        similarity: similarMsg.similarity // Add similarity score for debugging
      };
    }).filter(Boolean) as Message[];

    console.log('Formatted messages for LLM:', {
      count: formattedMessages.length,
      messages: formattedMessages.map(msg => ({
        id: msg.id,
        content: msg.content?.substring(0, 50) + '...',
        similarity: (msg as any).similarity
      }))
    });

    // Generate AI response with timeout
    const aiResponse = await Promise.race([
      generateResponse({
        message,
        username: user?.name ?? 'unknown',
        userMessages: formattedMessages,
        temperature: 0.7
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Response generation timed out')), 10000)
      )
    ]);

    const duration = Date.now() - startTime;
    console.info('Chat request completed:', {
      duration: `${duration}ms`,
      similarMessagesFound: similarMessages.length,
      cacheHits: {
        user: userCache.has(mentionedUsername),
        embedding: embeddingCache.has(message)
      }
    });

    return NextResponse.json({
      content: aiResponse,
      username: user ? `FAKE ${user.name}` : 'AI Assistant',
      avatarUrl: user?.avatar_url ?? null
    });
  } catch (err) {
    console.error('Error in chat endpoint:', {
      error: err,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      body,
      user,
      userMessagesCount: userMessages.length,
    });
    
    // Generic error handling
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 