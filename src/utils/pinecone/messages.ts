import { PineconeClient } from '@pinecone-database/pinecone';
import type { Environment } from '../supabase/environment';
import { OpenAIEmbeddings } from '@langchain/openai';

/**
 * Initialize OpenAI embeddings for different models:
 * - Large model: text-embedding-3-large (3072 dimensions)
 * - Small model: text-embedding-3-small (1056 dimensions)
 */
const largeEmbeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: 'text-embedding-3-large',
});

const smallEmbeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: 'text-embedding-3-small',
});

/**
 * Represents a message from the database
 */
interface Message {
  id: string;
  content: string;
  username: string;
  created_at: string;
}

/**
 * Represents a match returned from Pinecone query
 */
interface PineconeMatch {
  metadata?: MessageMetadata;
  score?: number;
  id: string;
}

/**
 * Metadata structure for storing messages in Pinecone
 */
type MessageMetadata = {
  [key in keyof Message]: string;
};

// Singleton instance of PineconeClient
let pineconeClient: PineconeClient | null = null;

/**
 * Get or initialize the Pinecone client
 * @returns Initialized PineconeClient instance
 */
async function getPineconeClient(): Promise<PineconeClient> {
  if (!pineconeClient) {
    pineconeClient = new PineconeClient();
    await pineconeClient.init({
      apiKey: process.env.PINECONE_API_KEY!,
      environment: process.env.PINECONE_ENVIRONMENT!
    });
  }
  return pineconeClient;
}

/**
 * Query similar messages for a given user from the appropriate Pinecone index
 * @param username - Username to query messages for
 * @param limit - Maximum number of messages to return (default: 10)
 * @param useSmallModel - Whether to use the small embedding model (default: false)
 * @param environment - Environment to query from (default: 'development')
 * @returns Array of messages similar to the user's style
 */
export async function querySimilarMessages(
  username: string,
  limit: number = 10,
  useSmallModel = false,
  environment: Environment = 'development'
) {
  try {
    const userNamespace = username.toLowerCase();
    const indexName = getPineconeIndex(useSmallModel, environment);
    const embeddings = useSmallModel ? smallEmbeddings : largeEmbeddings;
    
    const client = await getPineconeClient();
    const index = client.Index(indexName);
    
    // Query the index
    const queryResponse = await index.query({
      queryRequest: {
        namespace: '',
        topK: limit,
        includeMetadata: true,
        vector: await embeddings.embedQuery(username)
      }
    });

    if (!queryResponse.matches) {
      return [];
    }

    return queryResponse.matches
      .filter((match): match is (typeof match & { metadata: MessageMetadata }) => {
        return !!match.metadata;
      })
      .map(match => {
        return {
          id: match.metadata.id,
          content: match.metadata.content,
          username: match.metadata.username,
          created_at: match.metadata.created_at,
        };
      });
  } catch (error) {
    console.error('Error querying similar messages:', error);
    return [];
  }
}

/**
 * Get the appropriate Pinecone index name based on model size and environment
 * @param useSmallModel - Whether to use the small embedding model
 * @param environment - Target environment ('development' or 'production')
 * @returns The environment-specific index name
 * @throws Error if index name is not configured
 */
function getPineconeIndex(useSmallModel: boolean, environment: Environment): string {
  const prefix = useSmallModel ? 'PINECONE_SMALL_INDEX' : 'PINECONE_LARGE_INDEX';
  const envPrefix = environment === 'development' ? 'DEVELOPMENT_' : 'PRODUCTION_';
  const indexName = process.env[`${envPrefix}${prefix}`];
  
  if (!indexName) {
    throw new Error(`Missing Pinecone index name for ${environment} environment`);
  }
  
  return indexName;
}

/**
 * Vectorize and store a message in the appropriate Pinecone index
 * @param message - Message to vectorize and store
 * @param useSmallModel - Whether to use the small embedding model (default: false)
 * @param environment - Target environment (default: 'development')
 * @returns true if successful, false if an error occurred
 */
export async function vectorizeMessage(
  message: Message,
  useSmallModel = false,
  environment: Environment = 'development'
): Promise<boolean> {
  try {
    const indexName = getPineconeIndex(useSmallModel, environment);
    const embeddings = useSmallModel ? smallEmbeddings : largeEmbeddings;
    
    // Create document embedding
    const vector = await embeddings.embedQuery(message.content);
    
    // Get Pinecone client and index
    const client = await getPineconeClient();
    const index = client.Index(indexName);
    
    // Convert message to metadata format
    const metadata: MessageMetadata = {
      id: message.id,
      content: message.content,
      username: message.username,
      created_at: message.created_at,
    };
    
    // Upsert to Pinecone
    await index.upsert({
      upsertRequest: {
        namespace: '',
        vectors: [{
          id: message.id,
          values: vector,
          metadata
        }]
      }
    });

    return true;
  } catch (error) {
    console.error('Error vectorizing message:', error);
    return false;
  }
} 