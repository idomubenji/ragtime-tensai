import { OpenAI } from 'openai';
import { generateLargeEmbedding, generateSmallEmbedding, generateMessageEmbeddings, generateBatchMessageEmbeddings, __setOpenAIClient } from '../utils/embeddings';

describe('Embedding Generation', () => {
  const mockCreate = jest.fn();
  const mockClient = {
    embeddings: {
      create: mockCreate
    }
  } as unknown as OpenAI;

  beforeEach(() => {
    jest.clearAllMocks();
    __setOpenAIClient(mockClient);
  });

  describe('generateLargeEmbedding', () => {
    it('should generate large embeddings correctly', async () => {
      const mockEmbedding = Array(3072).fill(0.1);
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: mockEmbedding }],
        model: 'text-embedding-3-large',
        usage: { prompt_tokens: 10, total_tokens: 10 }
      });

      const result = await generateLargeEmbedding('test text');
      expect(result).toEqual(mockEmbedding);
      expect(result).toHaveLength(3072);
    });

    it('should retry on failure', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          data: [{ embedding: Array(3072).fill(0.1) }],
          model: 'text-embedding-3-large',
          usage: { prompt_tokens: 10, total_tokens: 10 }
        });

      const result = await generateLargeEmbedding('test text');
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(3072);
    });
  });

  describe('generateSmallEmbedding', () => {
    it('should generate small embeddings correctly', async () => {
      const mockEmbedding = Array(1056).fill(0.1);
      mockCreate.mockResolvedValueOnce({
        data: [{ embedding: mockEmbedding }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 10, total_tokens: 10 }
      });

      const result = await generateSmallEmbedding('test text');
      expect(result).toEqual(mockEmbedding);
      expect(result).toHaveLength(1056);
    });
  });

  describe('generateMessageEmbeddings', () => {
    it('should generate both embeddings for a message', async () => {
      const largeMock = Array(3072).fill(0.1);
      const smallMock = Array(1056).fill(0.1);
      
      mockCreate
        .mockResolvedValueOnce({
          data: [{ embedding: largeMock }],
          model: 'text-embedding-3-large',
          usage: { prompt_tokens: 10, total_tokens: 10 }
        })
        .mockResolvedValueOnce({
          data: [{ embedding: smallMock }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 10, total_tokens: 10 }
        });

      const result = await generateMessageEmbeddings('msg1', 'user1', 'test content');
      expect(result.message_id).toBe('msg1');
      expect(result.user_id).toBe('user1');
      expect(result.content_embedding).toHaveLength(3072);
      expect(result.content_embedding_small).toHaveLength(1056);
    });
  });

  describe('generateBatchMessageEmbeddings', () => {
    it('should process messages in batches', async () => {
      const messages = [
        { id: 'msg1', user_id: 'user1', content: 'test1' },
        { id: 'msg2', user_id: 'user1', content: 'test2' }
      ];

      const mockEmbedding = (size: number) => Array(size).fill(0.1);
      mockCreate
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding(3072) }],
          model: 'text-embedding-3-large',
          usage: { prompt_tokens: 10, total_tokens: 10 }
        })
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding(1056) }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 10, total_tokens: 10 }
        })
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding(3072) }],
          model: 'text-embedding-3-large',
          usage: { prompt_tokens: 10, total_tokens: 10 }
        })
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding(1056) }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 10, total_tokens: 10 }
        });

      const results = await generateBatchMessageEmbeddings(messages, { batch_size: 1 });
      expect(results).toHaveLength(2);
      expect(results[0].message_id).toBe('msg1');
      expect(results[1].message_id).toBe('msg2');
    });
  });
}); 