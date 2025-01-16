import { MessageSyncJob } from '@/utils/cron/message-sync';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '@/utils/supabase/createSupabaseClient';
import { generateBatchMessageEmbeddings } from '@/utils/embeddings';

// Mock dependencies
jest.mock('@/utils/supabase/createSupabaseClient');
jest.mock('@/utils/embeddings');

describe('MessageSyncJob', () => {
  let mockSupabaseClient: jest.Mocked<SupabaseClient>;
  let syncJob: MessageSyncJob;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock Supabase client
    mockSupabaseClient = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null
        }),
        insert: jest.fn().mockResolvedValue({ error: null })
      }),
      rpc: jest.fn().mockResolvedValue({ error: null })
    } as unknown as jest.Mocked<SupabaseClient>;

    (createSupabaseClient as jest.Mock).mockReturnValue(mockSupabaseClient);
    (generateBatchMessageEmbeddings as jest.Mock).mockResolvedValue([]);

    syncJob = new MessageSyncJob('development');
  });

  describe('sync', () => {
    it('should sync messages successfully', async () => {
      const mockMessages = [
        {
          id: '1',
          user_id: 'user1',
          content: 'Test message 1',
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          user_id: 'user2',
          content: 'Test message 2',
          created_at: '2024-01-01T00:00:01Z'
        }
      ];

      const mockEmbeddings = [
        {
          message_id: '1',
          user_id: 'user1',
          content_embedding: Array(3072).fill(0.1),
          content_embedding_small: Array(1056).fill(0.1)
        },
        {
          message_id: '2',
          user_id: 'user2',
          content_embedding: Array(3072).fill(0.1),
          content_embedding_small: Array(1056).fill(0.1)
        }
      ];

      mockSupabaseClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: mockMessages,
          error: null
        }),
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      (generateBatchMessageEmbeddings as jest.Mock).mockResolvedValue(mockEmbeddings);

      await syncJob.sync();

      // Verify messages were fetched
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('messages');

      // Verify transaction was started
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('vector_store.begin_transaction');

      // Verify embeddings were generated
      expect(generateBatchMessageEmbeddings).toHaveBeenCalledWith(
        mockMessages.map(msg => ({
          id: msg.id,
          user_id: msg.user_id,
          content: msg.content
        }))
      );

      // Verify embeddings were stored
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('vector_store.message_embeddings_dev');
      expect(mockSupabaseClient.from('vector_store.message_embeddings_dev').insert).toHaveBeenCalledWith(mockEmbeddings);
    });

    it('should handle empty message list', async () => {
      await syncJob.sync();

      // Verify no embeddings were generated or stored
      expect(generateBatchMessageEmbeddings).not.toHaveBeenCalled();
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('vector_store.message_embeddings_dev');
    });

    it('should handle database errors', async () => {
      const mockMessages = [{
        id: '1',
        user_id: 'user1',
        content: 'Test message',
        created_at: '2024-01-01T00:00:00Z'
      }];

      mockSupabaseClient.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          gt: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: mockMessages,
            error: null
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({
            error: new Error('Database error')
          })
        });

      await expect(syncJob.sync()).rejects.toThrow();
    });
  });

  describe('sync state', () => {
    it('should maintain sync state', () => {
      const state = { lastSyncTimestamp: '2024-01-01T00:00:00Z' };
      syncJob.setSyncState(state);
      expect(syncJob.getSyncState()).toEqual(state);
    });
  });
}); 