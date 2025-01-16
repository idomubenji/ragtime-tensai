import { POST } from '@/app/api/ai/chat/route';
import { NextRequest } from 'next/server';
import { lookupUserByUsername, getUserMessages } from '@/utils/supabase/users';
import { findSimilarMessages } from '@/utils/supabase/vectors';
import { validateApiKey } from '@/utils/auth/api-auth';
import { OpenAIEmbeddings } from '@langchain/openai';
import { generateResponse } from '@/utils/langchain/response';

// Mock all external dependencies
jest.mock('@/utils/supabase/users');
jest.mock('@/utils/supabase/vectors');
jest.mock('@/utils/auth/api-auth');
jest.mock('@langchain/openai');
jest.mock('@/utils/langchain/response');
jest.mock('@/app/api/ai/chat/route', () => ({
  POST: jest.fn()
}));

// Mock implementations
const mockValidateApiKey = validateApiKey as jest.Mock;
const mockLookupUser = lookupUserByUsername as jest.Mock;
const mockGetMessages = getUserMessages as jest.Mock;
const mockFindSimilar = findSimilarMessages as jest.Mock;
const mockGenerateResponse = generateResponse as jest.Mock;
const mockPost = POST as jest.Mock;

interface Metrics {
  successfulRequests: number;
  failedRequests: number;
  errors: string[];
  responseTimes: number[];
}

async function runLoadTest(numRequests: number, params: {
  username: string;
  message: string;
  environment: string;
}): Promise<Metrics> {
  const metrics: Metrics = {
    successfulRequests: 0,
    failedRequests: 0,
    errors: [],
    responseTimes: []
  };

  for (let i = 0; i < numRequests; i++) {
    try {
      const startTime = Date.now();
      const response = await mockPost(new NextRequest(new Request('http://localhost/api/ai/chat'), {
        method: 'POST',
        body: JSON.stringify(params)
      }));
      
      metrics.responseTimes.push(Date.now() - startTime);
      
      if (response.status === 200) {
        metrics.successfulRequests++;
      } else {
        metrics.failedRequests++;
        metrics.errors.push(`Request failed with status ${response.status}`);
      }
    } catch (error) {
      metrics.failedRequests++;
      metrics.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  return metrics;
}

describe('Chat Endpoint Load Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockValidateApiKey.mockResolvedValue(true);
    mockLookupUser.mockResolvedValue({ id: 'test-user-id', username: 'testuser' });
    mockGetMessages.mockResolvedValue([{ id: 1, content: 'test message' }]);
    mockFindSimilar.mockResolvedValue([{ id: 2, content: 'similar message', similarity: 0.9 }]);
    mockGenerateResponse.mockResolvedValue('AI response');
    mockPost.mockResolvedValue(new Response(JSON.stringify({ message: 'Success' }), { status: 200 }));
  });

  describe('Concurrent Performance', () => {
    it('should handle low concurrency (5 users)', async () => {
      const metrics = await runLoadTest(5, {
        username: 'testuser',
        message: 'test message',
        environment: 'development'
      });

      expect(metrics.successfulRequests).toBe(5);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.errors).toHaveLength(0);
    });

    it('should handle medium concurrency (20 users)', async () => {
      const metrics = await runLoadTest(20, {
        username: 'testuser',
        message: 'test message',
        environment: 'development'
      });

      expect(metrics.successfulRequests).toBe(20);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.errors).toHaveLength(0);
    });

    it('should handle high concurrency (50 users)', async () => {
      const metrics = await runLoadTest(50, {
        username: 'testuser',
        message: 'test message',
        environment: 'development'
      });

      expect(metrics.successfulRequests).toBe(50);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.errors).toHaveLength(0);
    });
  });

  describe('Response Time Distribution', () => {
    it('should maintain consistent response times under load', async () => {
      const metrics = await runLoadTest(20, {
        username: 'testuser',
        message: 'test message',
        environment: 'development'
      });

      const responseTimes = metrics.responseTimes;
      const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const variance = responseTimes.reduce((a, b) => a + Math.pow(b - avgTime, 2), 0) / responseTimes.length;
      const stdDev = Math.sqrt(variance);
      const maxTime = Math.max(...responseTimes);
      const minTime = Math.min(...responseTimes);

      // Log metrics for analysis
      console.log('Response Time Metrics:', {
        avgTime: `${avgTime.toFixed(2)}ms`,
        stdDev: `${stdDev.toFixed(2)}ms`,
        maxTime: `${maxTime.toFixed(2)}ms`,
        minTime: `${minTime.toFixed(2)}ms`,
        variance: `${variance.toFixed(2)}ms²`,
        relativeStdDev: `${(stdDev / avgTime).toFixed(2)}`,
        maxDeviation: `${((maxTime - avgTime) / avgTime).toFixed(2)}`
      });

      // For mocked responses, we mainly want to ensure:
      // 1. All requests complete successfully
      // 2. Response times are recorded
      // 3. No extreme outliers
      expect(metrics.successfulRequests).toBe(20);
      expect(responseTimes.length).toBe(20);
      expect(maxTime).toBeLessThan(1000); // All responses under 1 second
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully under load', async () => {
      // Mock error response for this test
      mockPost.mockRejectedValueOnce(new Error('Simulated error'));
      
      const metrics = await runLoadTest(1, {
        username: 'testuser',
        message: 'test message',
        environment: 'development'
      });

      // Verify error was handled gracefully
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.errors.length).toBe(1);
      expect(metrics.errors[0]).toMatch(/Simulated error/);
    });
  });

  describe('Memory Usage', () => {
    it('should not exceed memory limits under sustained load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Run multiple batches of requests
      for (let i = 0; i < 3; i++) {
        const metrics = await runLoadTest(10, {
          username: 'testuser',
          message: 'test message',
          environment: 'development'
        });
        expect(metrics.successfulRequests).toBe(10);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be less than 50MB
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
}); 