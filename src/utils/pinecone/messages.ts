import { largeIndex, smallIndex } from './client';
import { OpenAIEmbeddings } from '@langchain/openai';

// Initialize OpenAI embeddings for different models
const largeEmbeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: 'text-embedding-3-large', // 3072 dimensions
});

const smallEmbeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: 'text-embedding-3-small', // 1056 dimensions
});

interface Message {
  id: string;
  content: string;
  username: string;
  created_at: string;
}

type MessageMetadata = {
  [key in keyof Message]: string;
};

/**
 * Query similar messages for a given user
 */
export async function querySimilarMessages(username: string, limit: number = 10, useSmallModel = false) {
  try {
    const userNamespace = username.toLowerCase();
    const index = useSmallModel ? smallIndex : largeIndex;
    const embeddings = useSmallModel ? smallEmbeddings : largeEmbeddings;
    
    // Query the index
    const queryResponse = await index.query({
      vector: await embeddings.embedQuery(username),
      topK: limit,
      includeMetadata: true,
    });

    return queryResponse.matches
      .filter(match => match.metadata)
      .map(match => {
        const metadata = match.metadata as MessageMetadata;
        return {
          id: metadata.id,
          content: metadata.content,
          username: metadata.username,
          created_at: metadata.created_at,
        };
      });
  } catch (error) {
    console.error('Error querying similar messages:', error);
    return [];
  }
}

/**
 * Vectorize and upsert a message to Pinecone
 */
export async function vectorizeMessage(message: Message, useSmallModel = false) {
  try {
    const userNamespace = message.username.toLowerCase();
    const index = useSmallModel ? smallIndex : largeIndex;
    const embeddings = useSmallModel ? smallEmbeddings : largeEmbeddings;
    
    // Create document embedding
    const vector = await embeddings.embedQuery(message.content);
    
    // Convert message to metadata format
    const metadata: MessageMetadata = {
      id: message.id,
      content: message.content,
      username: message.username,
      created_at: message.created_at,
    };
    
    // Upsert to Pinecone
    await index.upsert([{
      id: message.id,
      values: vector,
      metadata,
    }]);

    return true;
  } catch (error) {
    console.error('Error vectorizing message:', error);
    return false;
  }
} 