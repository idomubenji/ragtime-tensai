import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ai/chat/route';
import { lookupUserByUsername, getUserMessages } from '@/utils/supabase/users';
import { generateResponse } from '@/utils/langchain/response';
import { createSupabaseClient } from '@/utils/supabase/createSupabaseClient';
import { findSimilarMessagesSmall } from '@/utils/supabase/vectors';
import { OpenAIEmbeddings } from '@langchain/openai';
import { validateApiKey } from '@/utils/auth/api-auth';
import { validateEnvironment, EnvironmentError } from '@/utils/supabase/environment';
import { NextResponse } from 'next/server';

// Mock dependencies
jest.mock('langchain/chat_models/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    call: jest.fn().mockResolvedValue({ text: 'AI response' })
  }))
}));

jest.mock('langchain/prompts', () => ({
  PromptTemplate: jest.fn().mockImplementation(() => ({
    format: jest.fn().mockResolvedValue('Formatted prompt')
  }))
}));

jest.mock('langchain/chains', () => ({
  LLMChain: jest.fn().mockImplementation(() => ({
    call: jest.fn().mockResolvedValue({ text: 'AI response' })
  }))
}));

jest.mock('@/utils/supabase/users');
jest.mock('@/utils/langchain/response');
jest.mock('@/utils/supabase/createSupabaseClient', () => ({
  createSupabaseClient: jest.fn().mockReturnValue({})
}));
jest.mock('@/utils/supabase/vectors');
jest.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedQuery: jest.fn().mockResolvedValue(new Array(1536).fill(0.1)),
    client: {
      embeddings: {
        create: jest.fn().mockResolvedValue({ data: [{ embedding: new Array(1536).fill(0.1) }] })
      }
    }
  }))
}));
jest.mock('@/utils/auth/api-auth', () => ({
  validateApiKey: jest.fn((req) => req.headers.get('x-api-key') === process.env.TENSAI_KEY),
  getAuthErrorResponse: jest.fn(() => NextResponse.json(
    { error: 'Unauthorized - Invalid or missing API key' },
    { status: 401 }
  ))
}));
jest.mock('@/utils/supabase/environment', () => ({
  validateEnvironment: jest.fn(),
  EnvironmentError: class EnvironmentError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'EnvironmentError';
    }
  },
  getEnvironmentVariable: jest.fn((name, defaultValue) => defaultValue || '')
}));

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

  const mockSimilarMessages = [
    {
      message_id: 'msg1',
      content: 'Hello world!',
      user_id: 'user123',
    },
  ];

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock environment variables
    process.env = {
      ...process.env,
      TENSAI_KEY: 'test-key'
    };

    // Mock API key validation
    (validateApiKey as jest.Mock).mockImplementation((req) => {
      return req.headers.get('x-api-key') === process.env.TENSAI_KEY;
    });

    // Mock environment validation
    (validateEnvironment as jest.Mock).mockImplementation((env) => {
      if (env !== 'development' && env !== 'production') {
        const error = new EnvironmentError(`Invalid environment: ${env}`);
        error.name = 'EnvironmentError';
        throw error;
      }
    });

    // Mock user lookup
    (lookupUserByUsername as jest.Mock).mockResolvedValue(mockUser);
    (getUserMessages as jest.Mock).mockResolvedValue(mockMessages);
    (generateResponse as jest.Mock).mockResolvedValue('AI response');
    (findSimilarMessagesSmall as jest.Mock).mockResolvedValue(mockSimilarMessages);
    (OpenAIEmbeddings as jest.Mock).mockImplementation(() => ({
      embedQuery: jest.fn().mockResolvedValue(new Array(1536).fill(0.1))
    }));
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.TENSAI_KEY;
  });

  it('should generate chat response', async () => {
    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-key'
      },
      body: JSON.stringify({
        message: 'Hello',
        mentionedUsername: 'Test User',
        environment: 'development'
      })
    });

    const response = await POST(request);
    const data = await response.json();
    console.log('Test Response:', { 
      status: response.status, 
      data,
      userMock: mockUser,
      messagesMock: mockMessages,
      similarMessagesMock: mockSimilarMessages,
      mockCalls: {
        lookupUser: (lookupUserByUsername as jest.Mock).mock.calls,
        getMessages: (getUserMessages as jest.Mock).mock.calls,
        generateResponse: (generateResponse as jest.Mock).mock.calls,
        findSimilar: (findSimilarMessagesSmall as jest.Mock).mock.calls
      }
    });

    expect(response.status).toBe(200);
    expect(data).toEqual({
      content: 'AI response',
      username: 'FAKE Test User',
      avatarUrl: 'https://example.com/avatar.jpg'
    });

    // Verify user lookup
    expect(lookupUserByUsername).toHaveBeenCalledWith('Test User');

    // Verify message retrieval
    expect(getUserMessages).toHaveBeenCalledWith('user123');

    // Verify response generation
    expect(generateResponse).toHaveBeenCalledWith({
      message: 'Hello',
      username: 'Test User',
      userMessages: expect.arrayContaining([
        expect.objectContaining({
          content: 'Hello world!'
        })
      ]),
      temperature: 0.7
    });
  });

  it('should handle missing user', async () => {
    (lookupUserByUsername as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-key'
      },
      body: JSON.stringify({
        message: 'Hello',
        mentionedUsername: 'NonexistentUser',
        environment: 'development'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({
      error: 'User NonexistentUser not found'
    });
  });

  it('should handle missing messages', async () => {
    (getUserMessages as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-key'
      },
      body: JSON.stringify({
        message: 'Hello',
        mentionedUsername: 'Test User',
        environment: 'development'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({
      error: 'No messages found for user Test User'
    });
  });

  it('should handle invalid environment', async () => {
    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-key'
      },
      body: JSON.stringify({
        message: 'Hello',
        mentionedUsername: 'Test User',
        environment: 'invalid'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      error: 'Invalid environment: invalid'
    });
  });

  it('should handle invalid API key', async () => {
    const request = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'invalid-key'
      },
      body: JSON.stringify({
        message: 'Hello',
        mentionedUsername: 'Test User',
        environment: 'development'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({
      error: expect.stringContaining('Unauthorized')
    });
  });
}); 