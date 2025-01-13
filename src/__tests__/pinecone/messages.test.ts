import { querySimilarMessages, vectorizeMessage } from '@/utils/pinecone/messages';
import { PineconeClient } from '@pinecone-database/pinecone';

// Create a proper mock for PineconeClient
const mockIndex = {
  query: jest.fn(),
  upsert: jest.fn()
};

const mockPineconeClient = {
  init: jest.fn(),
  Index: jest.fn().mockReturnValue(mockIndex)
};

// Mock the entire module
jest.mock('@pinecone-database/pinecone', () => ({
  PineconeClient: jest.fn().mockImplementation(() => mockPineconeClient)
}));

// Mock the OpenAI embeddings
jest.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedQuery: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]) // Mock vector
  }))
}));

// Mock message data
const mockMessage = {
  id: '123',
  content: 'Test message',
  username: 'testuser',
  created_at: '2024-02-28T12:00:00Z'
};

// Mock Pinecone response
const mockPineconeMatch = {
  id: '123',
  score: 0.9,
  metadata: {
    id: '123',
    content: 'Test message',
    username: 'testuser',
    created_at: '2024-02-28T12:00:00Z'
  }
};

describe('Pinecone Message Functions', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Set up default successful responses
    mockIndex.query.mockResolvedValue({ matches: [mockPineconeMatch] });
    mockIndex.upsert.mockResolvedValue({ upsertedCount: 1 });
  });

  describe('querySimilarMessages', () => {
    it('should query messages with default parameters', async () => {
      const result = await querySimilarMessages('testuser');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockMessage);
      expect(mockIndex.query).toHaveBeenCalledWith({
        queryRequest: {
          namespace: '',
          topK: 10,
          includeMetadata: true,
          vector: [0.1, 0.2, 0.3]
        }
      });
    });

    it('should use small model when specified', async () => {
      await querySimilarMessages('testuser', 5, true);
      
      expect(mockIndex.query).toHaveBeenCalledWith({
        queryRequest: {
          namespace: '',
          topK: 5,
          includeMetadata: true,
          vector: [0.1, 0.2, 0.3]
        }
      });
      // Verify correct index was used
      expect(mockPineconeClient.Index).toHaveBeenCalledWith('dev-small-index');
    });

    it('should handle empty matches', async () => {
      mockIndex.query.mockResolvedValueOnce({ matches: [] });
      const result = await querySimilarMessages('testuser');
      
      expect(result).toHaveLength(0);
    });

    it('should handle errors gracefully', async () => {
      mockIndex.query.mockRejectedValueOnce(new Error('Query failed'));
      const result = await querySimilarMessages('testuser');
      
      expect(result).toHaveLength(0);
    });
  });

  describe('vectorizeMessage', () => {
    it('should vectorize and store message with default parameters', async () => {
      const result = await vectorizeMessage(mockMessage);
      
      expect(result).toBe(true);
      expect(mockIndex.upsert).toHaveBeenCalledWith({
        upsertRequest: {
          namespace: '',
          vectors: [{
            id: mockMessage.id,
            values: [0.1, 0.2, 0.3],
            metadata: mockMessage
          }]
        }
      });
      // Verify correct index was used
      expect(mockPineconeClient.Index).toHaveBeenCalledWith('dev-large-index');
    });

    it('should use production index when specified', async () => {
      await vectorizeMessage(mockMessage, false, 'production');
      
      expect(mockPineconeClient.Index).toHaveBeenCalledWith('prod-large-index');
      expect(mockIndex.upsert).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockIndex.upsert.mockRejectedValueOnce(new Error('Upsert failed'));
      const result = await vectorizeMessage(mockMessage);
      
      expect(result).toBe(false);
    });
  });
}); 