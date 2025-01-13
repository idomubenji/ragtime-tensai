import { Pinecone } from '@pinecone-database/pinecone';

if (!process.env.PINECONE_API_KEY) {
  throw new Error('Missing PINECONE_API_KEY environment variable');
}

if (!process.env.PINECONE_ENVIRONMENT) {
  throw new Error('Missing PINECONE_ENVIRONMENT environment variable');
}

if (!process.env.PINECONE_LARGE_INDEX_NAME) {
  throw new Error('Missing PINECONE_LARGE_INDEX_NAME environment variable');
}

if (!process.env.PINECONE_SMALL_INDEX_NAME) {
  throw new Error('Missing PINECONE_SMALL_INDEX_NAME environment variable');
}

// Initialize Pinecone client with environment
process.env.PINECONE_ENVIRONMENT = process.env.PINECONE_ENVIRONMENT;
const pinecone = new Pinecone();

// Get index instances
const largeIndex = pinecone.index(process.env.PINECONE_LARGE_INDEX_NAME); // 3072-dimensional vectors
const smallIndex = pinecone.index(process.env.PINECONE_SMALL_INDEX_NAME); // 1056-dimensional vectors

export { largeIndex, smallIndex }; 