import { NextResponse, NextRequest } from 'next/server';
import { lookupUserByUsername } from '@/utils/supabase/users';
import { getUserMessages } from '@/utils/supabase/users';
import { generateResponse } from '@/utils/langchain/response';
import { validateApiKey, getAuthErrorResponse } from '@/utils/auth/api-auth';
import { validateEnvironment, EnvironmentError, type Environment } from '@/utils/supabase/environment';
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
async function getCachedUser(username: string, environment: Environment) {
  const cached = userCache.get(username);
  if (cached && Date.now() - cached.timestamp < USER_CACHE_TTL) {
    return cached.user;
  }

  const user = await lookupUserByUsername(username, environment);
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
  let vectorMessages: SimilaritySearchResult[] = [];
  let body: any;

  try {
    // Clean caches periodically (but don't block the request)
    setTimeout(cleanCaches, 0);
    
    body = await request.json();
    const { 
      message, 
      mentionedUsername, 
      environment = 'development',
      matchThreshold = 0.5
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

    // Step 1: Look up user in App database
    console.log('Looking up user in App database:', {
      mentionedUsername,
      environment
    });
    
    const appClient = createSupabaseClient(environment, 'default');
    const { data: userData, error: userError } = await appClient
      .from('users')
      .select('id, name')
      .eq('name', mentionedUsername)
      .single();

    if (userError || !userData) {
      console.error('Failed to find user:', userError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userId = userData.id;
    const userName = userData.name;
    console.log('Found user:', { userId, userName });

    // Step 3: Get ALL messages for this user from Vector database
    console.log('Getting all messages from Vector database for user');
    const vectorClient = createSupabaseClient(environment, 'vector');
    const tableName = getVectorTableName(environment);
    
    try {
      // Get ALL messages for this user from vector store
      const { data: vectorMessages, error: vectorError } = await vectorClient
        .from('vector_store.' + tableName)
        .select('*')
        .eq('user_id', userId);

      if (vectorError) {
        console.error('Failed to get vector messages:', vectorError);
        throw new Error('Failed to get messages from vector store');
      }

      console.log('Vector store results:', {
        count: vectorMessages.length,
        tableName: `vector_store.${tableName}`,
        sampleResults: vectorMessages.slice(0, 5).map(msg => ({
          id: msg.id,
          messageId: msg.message_id
        }))
      });

      if (vectorMessages.length === 0) {
        return NextResponse.json(
          { error: 'No messages found for this user in vector store' },
          { status: 404 }
        );
      }

      // Get the full message content for ALL messages
      const messageIds = vectorMessages.map(msg => msg.message_id);
      const { data: fullMessages, error: messagesError } = await appClient
        .from('messages')
        .select('*')
        .in('id', messageIds);

      if (messagesError) {
        console.error('Failed to get message content:', messagesError);
        throw new Error('Failed to get message content');
      }

      // Combine vector results with full messages
      const combinedMessages = vectorMessages.map(vectorMsg => {
        const fullMessage = fullMessages.find(msg => msg.id === vectorMsg.message_id);
        if (!fullMessage) {
          console.warn('Could not find content for message:', vectorMsg.message_id);
          return null;
        }
        return {
          ...fullMessage,
          embedding: vectorMsg.embedding // Include the embedding for potential use in RAG
        };
      }).filter(Boolean) as Message[];

      // Step 4: Generate AI response using ALL messages as context
      const response = await generateResponse({
        message,
        username: userName,
        userMessages: combinedMessages,
        temperature: 0.7
      });

      return NextResponse.json({
        response,
        metadata: {
          userId,
          messageCount: combinedMessages.length,
          executionTime: Date.now() - startTime
        }
      });

    } catch (err) {
      console.error('Failed to search vector database:', err);
      throw new Error('Failed to search message history');
    }

  } catch (err) {
    console.error('Error in chat endpoint:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 