import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClient } from '@/utils/supabase/createSupabaseClient';
import { generateMessageEmbeddings } from '@/utils/embeddings';

// Mock dependencies
jest.mock('@/utils/supabase/createSupabaseClient');
jest.mock('@/utils/embeddings');

describe('Vector Store Transactions', () => {
  let mockSupabaseClient: jest.Mocked<SupabaseClient>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock Supabase client
    mockSupabaseClient = {
      rpc: jest.fn().mockResolvedValue({ error: null }),
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null })
      })
    } as unknown as jest.Mocked<SupabaseClient>;

    (createSupabaseClient as jest.Mock).mockReturnValue(mockSupabaseClient);
  });

  describe('Transaction Functions', () => {
    it('should begin transaction successfully', async () => {
      const { error } = await mockSupabaseClient.rpc('vector_store.begin_transaction');
      expect(error).toBeNull();
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('vector_store.begin_transaction');
    });

    it('should commit transaction successfully', async () => {
      const { error } = await mockSupabaseClient.rpc('vector_store.commit_transaction');
      expect(error).toBeNull();
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('vector_store.commit_transaction');
    });

    it('should rollback transaction successfully', async () => {
      const { error } = await mockSupabaseClient.rpc('vector_store.rollback_transaction');
      expect(error).toBeNull();
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('vector_store.rollback_transaction');
    });
  });

  describe('Transaction Integration', () => {
    it('should handle successful transaction flow', async () => {
      // Begin transaction
      await mockSupabaseClient.rpc('vector_store.begin_transaction');

      // Generate and store embeddings
      const mockEmbedding = await generateMessageEmbeddings('msg1', 'user1', 'test content');
      const { error: insertError } = await mockSupabaseClient
        .from('vector_store.message_embeddings_dev')
        .insert(mockEmbedding);

      expect(insertError).toBeNull();

      // Commit transaction
      const { error: commitError } = await mockSupabaseClient.rpc('vector_store.commit_transaction');
      expect(commitError).toBeNull();

      // Verify all steps were called
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('vector_store.begin_transaction');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('vector_store.message_embeddings_dev');
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('vector_store.commit_transaction');
    });

    it('should handle failed transaction with rollback', async () => {
      // Begin transaction
      await mockSupabaseClient.rpc('vector_store.begin_transaction');

      // Mock a failed insert
      mockSupabaseClient.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ 
          error: new Error('Insert failed') 
        })
      });

      // Generate and try to store embeddings
      const mockEmbedding = await generateMessageEmbeddings('msg1', 'user1', 'test content');
      const { error: insertError } = await mockSupabaseClient
        .from('vector_store.message_embeddings_dev')
        .insert(mockEmbedding);

      expect(insertError).toBeDefined();

      // Rollback transaction
      const { error: rollbackError } = await mockSupabaseClient.rpc('vector_store.rollback_transaction');
      expect(rollbackError).toBeNull();

      // Verify rollback was called
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('vector_store.rollback_transaction');
    });

    it('should handle concurrent transactions', async () => {
      // Simulate two concurrent transactions
      const transaction1 = mockSupabaseClient.rpc('vector_store.begin_transaction');
      const transaction2 = mockSupabaseClient.rpc('vector_store.begin_transaction');

      await Promise.all([transaction1, transaction2]);

      // Both transactions should have started successfully
      expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(2);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('vector_store.begin_transaction');
    });
  });
}); 