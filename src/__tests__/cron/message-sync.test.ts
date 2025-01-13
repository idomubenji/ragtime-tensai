import { MessageSyncJob } from '../../utils/cron/message-sync';
import { PineconeClient } from '@pinecone-database/pinecone';
import { supabase } from '../../utils/supabase/client';
import { vectorizeMessage } from '../../utils/pinecone/messages';
import { lookupUserByUsername } from '../../utils/supabase/users';

// Mock OpenAI embeddings
jest.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedQuery: jest.fn().mockResolvedValue([0.1, 0.2, 0.3])
  }))
}));

// Mock dependencies
jest.mock('../../utils/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        gt: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    }))
  }
}));

jest.mock('../../utils/pinecone/messages', () => ({
  vectorizeMessage: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../utils/supabase/users', () => ({
  lookupUserByUsername: jest.fn().mockResolvedValue({ name: 'testuser' })
}));

describe('MessageSyncJob', () => {
  let mockPineconeClient: jest.Mocked<PineconeClient>;
  let syncJob: MessageSyncJob;
  const mockMessage = {
    id: '123',
    content: 'test message',
    user_id: 'user123',
    channel_id: 'channel123',
    created_at: '2024-01-13T00:00:00Z',
    updated_at: '2024-01-13T00:00:00Z',
    parent_id: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPineconeClient = {
      init: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Default successful Supabase response
    const mockSupabaseChain = {
      select: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [mockMessage], error: null })
    };
    (supabase.from as jest.Mock).mockReturnValue(mockSupabaseChain);

    syncJob = new MessageSyncJob(mockPineconeClient);
  });

  describe('error handling', () => {
    it('should handle database query errors', async () => {
      // Setup database error
      const dbError = { message: 'Database error' };
      const errorMockChain = {
        select: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ 
          data: null, 
          error: dbError
        })
      };
      (supabase.from as jest.Mock).mockReturnValue(errorMockChain);

      await expect(syncJob.syncMessages()).rejects.toEqual(dbError);
      expect(vectorizeMessage).not.toHaveBeenCalled();
    });

    it('should continue processing remaining messages if one fails', async () => {
      // Setup multiple messages
      const mockMessages = [
        { ...mockMessage, id: '1' },
        { ...mockMessage, id: '2' },
        { ...mockMessage, id: '3' }
      ];

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockMessages, error: null })
      };
      (supabase.from as jest.Mock).mockReturnValue(mockChain);

      // Make the second message fail user lookup
      (lookupUserByUsername as jest.Mock)
        .mockResolvedValueOnce({ name: 'user1' })  // First succeeds
        .mockResolvedValueOnce(null)               // Second fails
        .mockResolvedValueOnce({ name: 'user3' }); // Third succeeds

      await syncJob.syncMessages();
      
      // Should still process first and third messages
      expect(vectorizeMessage).toHaveBeenCalledTimes(4); // 2 models × 2 successful messages
    });
  });

  describe('timestamp management', () => {
    it('should update timestamp after successful sync', async () => {
      const beforeSync = syncJob.getSyncState().lastSyncTimestamp;
      await syncJob.syncMessages();
      const afterSync = syncJob.getSyncState().lastSyncTimestamp;
      
      expect(new Date(afterSync).getTime())
        .toBeGreaterThanOrEqual(new Date(beforeSync).getTime());
    });

    it('should not update timestamp if sync fails', async () => {
      // Setup database error
      const criticalError = new Error('Critical error');
      const errorMockChain = {
        select: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        order: jest.fn().mockRejectedValue(criticalError)
      };
      (supabase.from as jest.Mock).mockReturnValue(errorMockChain);

      const beforeSync = syncJob.getSyncState().lastSyncTimestamp;
      await expect(syncJob.syncMessages()).rejects.toThrow(criticalError);
      const afterSync = syncJob.getSyncState().lastSyncTimestamp;
      
      expect(afterSync).toBe(beforeSync);
    });
  });
}); 