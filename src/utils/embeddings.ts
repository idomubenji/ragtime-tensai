import { OpenAI } from 'openai';
import { MessageEmbedding } from './supabase/vectors';

// Create OpenAI client lazily to allow for mocking in tests
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

export interface EmbeddingOptions {
  retry_attempts?: number;
  batch_size?: number;
}

const DEFAULT_OPTIONS: Required<EmbeddingOptions> = {
  retry_attempts: 3,
  batch_size: 100
};

/**
 * Generate embeddings using OpenAI's text-embedding-3-large model (3072d)
 */
export async function generateLargeEmbedding(
  text: string,
  options: EmbeddingOptions = {}
): Promise<number[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    const response = await getOpenAIClient().embeddings.create({
      model: 'text-embedding-3-large',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    if (opts.retry_attempts > 0) {
      return generateLargeEmbedding(text, {
        ...opts,
        retry_attempts: opts.retry_attempts - 1
      });
    }
    throw new Error(`Failed to generate large embedding: ${(error as Error).message}`);
  }
}

/**
 * Generate embeddings using OpenAI's text-embedding-3-small model (1056d)
 */
export async function generateSmallEmbedding(
  text: string,
  options: EmbeddingOptions = {}
): Promise<number[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    const response = await getOpenAIClient().embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    if (opts.retry_attempts > 0) {
      return generateSmallEmbedding(text, {
        ...opts,
        retry_attempts: opts.retry_attempts - 1
      });
    }
    throw new Error(`Failed to generate small embedding: ${(error as Error).message}`);
  }
}

/**
 * Generate both large and small embeddings for a message
 */
export async function generateMessageEmbeddings(
  messageId: string,
  userId: string,
  content: string,
  options: EmbeddingOptions = {}
): Promise<Pick<MessageEmbedding, 'message_id' | 'user_id' | 'content_embedding' | 'content_embedding_small'>> {
  const [contentEmbedding, contentEmbeddingSmall] = await Promise.all([
    generateLargeEmbedding(content, options),
    generateSmallEmbedding(content, options)
  ]);

  return {
    message_id: messageId,
    user_id: userId,
    content_embedding: contentEmbedding,
    content_embedding_small: contentEmbeddingSmall
  };
}

/**
 * Generate embeddings for multiple messages in batches
 */
export async function generateBatchMessageEmbeddings(
  messages: Array<{ id: string; user_id: string; content: string }>,
  options: EmbeddingOptions = {}
): Promise<Pick<MessageEmbedding, 'message_id' | 'user_id' | 'content_embedding' | 'content_embedding_small'>[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const results: Pick<MessageEmbedding, 'message_id' | 'user_id' | 'content_embedding' | 'content_embedding_small'>[] = [];
  
  for (let i = 0; i < messages.length; i += opts.batch_size) {
    const batch = messages.slice(i, i + opts.batch_size);
    const batchResults = await Promise.all(
      batch.map(msg => generateMessageEmbeddings(msg.id, msg.user_id, msg.content, opts))
    );
    results.push(...batchResults);
  }
  
  return results;
}

// For testing purposes
export function __setOpenAIClient(client: OpenAI) {
  openaiClient = client;
} 