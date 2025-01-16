import { SupabaseClient } from '@supabase/supabase-js';
import { getUserMessages, lookupUserByUsername } from '@/utils/supabase/users';

jest.mock('@/utils/supabase/client', () => ({
  supabase: {
    from: jest.fn()
  }
}));

describe('User Operations', () => {
  let mockClient: { from: jest.Mock };
  const testUser = {
    id: 'test-user-id',
    name: 'testuser',
    created_at: new Date().toISOString()
  };

  const mockMessages = [
    {
      id: 'msg1',
      content: 'Test message 1',
      created_at: new Date().toISOString()
    }
  ];

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock Supabase client with proper method chaining
    const mockUserQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: testUser,
        error: null
      })
    };

    const mockMessagesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: mockMessages,
        error: null
      })
    };

    // Get the mock supabase client from the mock module
    mockClient = require('@/utils/supabase/client').supabase;
    mockClient.from.mockImplementation((table) => {
      if (table === 'users') return mockUserQuery;
      if (table === 'messages') return mockMessagesQuery;
      return mockUserQuery; // default
    });
  });

  it('should look up user by username', async () => {
    const user = await lookupUserByUsername('testuser');
    expect(user).toEqual(testUser);
    expect(mockClient.from).toHaveBeenCalledWith('users');

    const mockQuery = mockClient.from('users');
    expect(mockQuery.select).toHaveBeenCalled();
    expect(mockQuery.eq).toHaveBeenCalledWith('name', 'testuser');
    expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(mockQuery.limit).toHaveBeenCalledWith(1);
  });

  it('should return null for non-existent username', async () => {
    const mockNullQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: null,
        error: null
      })
    };

    mockClient.from.mockReturnValue(mockNullQuery);

    const user = await lookupUserByUsername('nonexistent');
    expect(user).toBeNull();
  });

  it('should retrieve user messages', async () => {
    const messages = await getUserMessages('test-user-id');
    expect(messages).toEqual(mockMessages);
    expect(mockClient.from).toHaveBeenCalledWith('messages');

    const mockQuery = mockClient.from('messages');
    expect(mockQuery.select).toHaveBeenCalled();
    expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
    expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(mockQuery.limit).toHaveBeenCalledWith(100);
  });
}); 