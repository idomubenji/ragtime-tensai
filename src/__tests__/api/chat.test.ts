import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/app/api/ai/chat/route';
import { lookupUserByUsername, getUserMessages } from '@/utils/supabase/users';
import { generateResponse } from '@/utils/langchain/response';
import { createSupabaseClient } from '@/utils/supabase/createSupabaseClient';

// Mock dependencies
jest.mock('@/utils/supabase/users');
jest.mock('@/utils/langchain/response');
jest.mock('@/utils/supabase/createSupabaseClient');

describe('Chat API', () => {
  const mockUser = {
    id: 'user123',
    name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
  };

  const mockMessages = [
    {
      id: 'msg1',
      content: 'Hello world!',
      user_id: 'user123',
      channel_id: 'channel1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return default TENSAI BOT response when no username is mentioned', async () => {
    const request = new NextRequest('http://localhost:3000/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-tensai-key'
      },
      body: JSON.stringify({
        message: 'Hello!',
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      content: 'Hello!',
      username: 'TENSAI BOT',
      avatarUrl: null,
    });
  });

  it('should return 404 when user is not found', async () => {
    // Mock Supabase client for user not found
    (createSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
      })
    });

    const request = new NextRequest('http://localhost:3000/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-tensai-key'
      },
      body: JSON.stringify({
        message: 'Hello!',
        mentionedUsername: 'nonexistent'
      })
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('User not found');
  });

  it('should generate response for valid user', async () => {
    // Mock Supabase client for successful user lookup
    (createSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockUser, error: null })
      })
    });

    // Mock message retrieval
    (getUserMessages as jest.Mock).mockResolvedValue(mockMessages);
    (generateResponse as jest.Mock).mockResolvedValue('AI generated response');

    const request = new NextRequest('http://localhost:3000/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-tensai-key'
      },
      body: JSON.stringify({
        message: 'Hello!',
        mentionedUsername: 'testuser'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      content: 'AI generated response',
      username: `FAKE ${mockUser.name}`,
      avatarUrl: mockUser.avatar_url,
    });
  });

  it('should handle errors gracefully', async () => {
    // Mock Supabase client to throw error
    (createSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'Database error' }
        })
      })
    });

    const request = new NextRequest('http://localhost:3000/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-tensai-key'
      },
      body: JSON.stringify({
        message: 'Hello!',
        mentionedUsername: 'testuser'
      })
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Database error');
  });
}); 