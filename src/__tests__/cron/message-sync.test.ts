import { MessageSyncJob } from '@/utils/cron/message-sync';
import { PineconeClient } from '@pinecone-database/pinecone';
import { vectorizeMessage } from '@/utils/pinecone/messages';
import { createSupabaseClient } from '@/utils/supabase/createSupabaseClient';

// Mock dependencies
jest.mock('@/utils/pinecone/messages');
jest.mock('@pinecone-database/pinecone');
jest.mock('@/utils/supabase/createSupabaseClient');

describe('MessageSyncJob', () => {
  // Create mock index
  const mockIndex = {
    query: jest.fn(),
    upsert: jest.fn()
  };

  // Create a properly typed mock PineconeClient
  const mockPineconeClient = {
    apiKey: 'test-key',
    projectName: 'test-project',
    environment: 'test-env',
    init: jest.fn().mockResolvedValue(undefined),
    Index: jest.fn().mockReturnValue(mockIndex),
    withMiddleware: jest.fn(),
    configureIndex: jest.fn(),
    configureIndexRaw: jest.fn(),
    createCollection: jest.fn(),
    createCollectionRaw: jest.fn(),
    createIndex: jest.fn(),
    createIndexRaw: jest.fn(),
    deleteCollection: jest.fn(),
    deleteCollectionRaw: jest.fn(),
    deleteIndex: jest.fn(),
    deleteIndexRaw: jest.fn(),
    describeCollection: jest.fn(),
    describeCollectionRaw: jest.fn(),
    describeIndex: jest.fn(),
    describeIndexRaw: jest.fn(),
    describeIndexStats: jest.fn(),
    describeIndexStatsRaw: jest.fn(),
    listCollections: jest.fn(),
    listCollectionsRaw: jest.fn(),
    listIndexes: jest.fn(),
    listIndexesRaw: jest.fn(),
    withApiKey: jest.fn(),
    withEnvironment: jest.fn(),
    withPostMiddleware: jest.fn(),
    withPreMiddleware: jest.fn(),
    withProjectName: jest.fn()
  } as unknown as jest.Mocked<PineconeClient>;

  // Mock Supabase client
  const mockSupabaseClient = {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn()
    })
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (PineconeClient as jest.MockedClass<typeof PineconeClient>).mockImplementation(() => mockPineconeClient);
    (createSupabaseClient as jest.Mock).mockReturnValue(mockSupabaseClient);
    
    // Mock successful vectorization by default
    (vectorizeMessage as jest.Mock).mockResolvedValue(true);
  });

  it('should sync messages successfully', async () => {
    // Mock messages from database
    const mockMessages = [{
      id: 'msg1',
      content: 'Hello world',
      user_id: 'user1',
      created_at: new Date().toISOString()
    }];

    // Mock successful database queries
    mockSupabaseClient.from().select().gt().order.mockResolvedValue({
      data: mockMessages,
      error: null
    });

    mockSupabaseClient.from().select().eq().single.mockResolvedValue({
      data: { name: 'testuser' },
      error: null
    });

    const syncJob = new MessageSyncJob(mockPineconeClient, 'development');
    await syncJob.syncMessages();

    // Should attempt to vectorize with both models
    expect(vectorizeMessage).toHaveBeenCalledTimes(2);
    expect(vectorizeMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'msg1' }),
      false,
      'development'
    );
    expect(vectorizeMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'msg1' }),
      true,
      'development'
    );
  });

  it('should handle errors gracefully', async () => {
    // Mock database error
    mockSupabaseClient.from().select().gt().order.mockResolvedValue({
      data: null,
      error: new Error('Database error')
    });

    const syncJob = new MessageSyncJob(mockPineconeClient, 'development');
    await expect(syncJob.syncMessages()).rejects.toThrow('Database error');

    // Should not attempt to vectorize anything
    expect(vectorizeMessage).not.toHaveBeenCalled();
  });
}); 