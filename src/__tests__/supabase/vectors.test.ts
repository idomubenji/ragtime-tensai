import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { 
  MessageEmbedding,
  storeMessageEmbeddings,
  findSimilarMessages,
  findSimilarMessagesSmall,
  createVectorClient,
  VectorConfig
} from '@/utils/supabase/vectors';
import { createSupabaseClient } from '@/utils/supabase/createSupabaseClient';

jest.mock('@/utils/supabase/createSupabaseClient');

describe('Vector Store Operations', () => {
  let mockClient: jest.Mocked<SupabaseClient>;
  let config: VectorConfig;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock client with proper typing
    mockClient = {
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null })
      }),
      rpc: jest.fn().mockResolvedValue({ data: [], error: null })
    } as unknown as jest.Mocked<SupabaseClient>;

    (createSupabaseClient as jest.Mock).mockReturnValue(mockClient);

    // Set up default config
    config = {
      tableName: 'message_embeddings_dev',
      matchThreshold: 0.8,
      matchCount: 10
    };
  });

  describe('storeMessageEmbeddings', () => {
    it('should store embeddings successfully', async () => {
      const embeddings: MessageEmbedding[] = [{
        message_id: '123',
        user_id: 'user1',
        content_embedding: new Array(3072).fill(0.1),
        content_embedding_small: new Array(1056).fill(0.1)
      }];

      await storeMessageEmbeddings(mockClient, embeddings);

      expect(mockClient.from).toHaveBeenCalledWith('vector_store.message_embeddings_dev');
      expect(mockClient.from('vector_store.message_embeddings_dev').insert).toHaveBeenCalledWith(embeddings);
    });

    it('should throw error if storage fails', async () => {
      const mockError: PostgrestError = {
        message: 'Storage failed',
        details: '',
        hint: '',
        code: 'TEST',
        name: 'PostgrestError'
      };

      // Mock the from() chain to return an error
      const mockInsert = jest.fn().mockResolvedValue({ error: mockError });
      const mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });
      mockClient.from = mockFrom;

      const embeddings: MessageEmbedding[] = [{
        message_id: '123',
        user_id: 'user1',
        content_embedding: new Array(3072).fill(0.1),
        content_embedding_small: new Array(1056).fill(0.1)
      }];

      await expect(storeMessageEmbeddings(mockClient, embeddings))
        .rejects.toThrow(mockError.message);
    });
  });

  describe('findSimilarMessages', () => {
    it('should find similar messages using large embeddings', async () => {
      const embedding = new Array(3072).fill(0.1);
      
      await findSimilarMessages(mockClient, embedding, config);

      expect(mockClient.rpc).toHaveBeenCalledWith(
        'vector_store.match_messages',
        expect.objectContaining({
          query_embedding: embedding,
          match_threshold: config.matchThreshold,
          match_count: config.matchCount,
          table_name: config.tableName
        })
      );
    });

    it('should find similar messages using small embeddings', async () => {
      const embedding = new Array(1056).fill(0.1);
      
      await findSimilarMessagesSmall(mockClient, embedding, config);

      expect(mockClient.rpc).toHaveBeenCalledWith(
        'vector_store.match_messages_small',
        expect.objectContaining({
          query_embedding: embedding,
          match_threshold: config.matchThreshold,
          match_count: config.matchCount,
          table_name: config.tableName
        })
      );
    });

    it('should throw error if search fails', async () => {
      const mockError: PostgrestError = {
        message: 'Search failed',
        details: '',
        hint: '',
        code: 'TEST',
        name: 'PostgrestError'
      };

      // Mock the rpc call to return an error
      mockClient.rpc.mockResolvedValueOnce({
        data: null,
        error: mockError,
        count: null,
        status: 400,
        statusText: 'Bad Request'
      });

      const embedding = new Array(3072).fill(0.1);

      await expect(findSimilarMessages(mockClient, embedding, config))
        .rejects.toThrow(mockError.message);
    });
  });

  describe('createVectorClient', () => {
    it('should create client for development environment', () => {
      createVectorClient('development');
      expect(createSupabaseClient).toHaveBeenCalledWith('development');
    });

    it('should create client for production environment', () => {
      createVectorClient('production');
      expect(createSupabaseClient).toHaveBeenCalledWith('production');
    });
  });
}); 