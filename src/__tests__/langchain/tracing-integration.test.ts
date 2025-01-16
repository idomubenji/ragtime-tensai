import { initializeLangchainTracing } from '@/utils/langchain/tracing';
import { createChatModel, createResponseChain } from '@/utils/langchain/config';
import { OpenAIEmbeddings } from '@langchain/openai';

describe('Langchain Tracing Integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.LANGCHAIN_TRACING;
    delete process.env.LANGCHAIN_ENDPOINT;
    delete process.env.LANGCHAIN_API_KEY;
    delete process.env.LANGCHAIN_PROJECT;
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Tracing Configuration', () => {
    it('should properly configure tracing when enabled', () => {
      // Set up tracing environment
      process.env.LANGSMITH_TRACING = 'true';
      process.env.LANGSMITH_ENDPOINT = 'https://api.smith.langchain.com';
      process.env.LANGSMITH_API_KEY = 'test-key';
      process.env.LANGSMITH_PROJECT = 'test-project';

      // Initialize tracing
      initializeLangchainTracing();

      // Verify tracing configuration
      expect(process.env.LANGCHAIN_TRACING).toBe('true');
      expect(process.env.LANGCHAIN_ENDPOINT).toBe('https://api.smith.langchain.com');
      expect(process.env.LANGCHAIN_API_KEY).toBe('test-key');
      expect(process.env.LANGCHAIN_PROJECT).toBe('test-project');
    });

    it('should disable tracing when LANGSMITH_TRACING is false', () => {
      process.env.LANGSMITH_TRACING = 'false';
      initializeLangchainTracing();
      expect(process.env.LANGCHAIN_TRACING).toBeUndefined();
    });
  });

  describe('Tracing in Chat Model', () => {
    beforeEach(() => {
      process.env.LANGSMITH_TRACING = 'true';
      process.env.LANGSMITH_PROJECT = 'test-project';
      process.env.OPENAI_API_KEY = 'test-key';
      initializeLangchainTracing();
    });

    it('should create chat model with tracing enabled', () => {
      const model = createChatModel();
      expect(model).toBeDefined();
      expect(process.env.LANGCHAIN_TRACING).toBe('true');
    });

    it('should create response chain with tracing metadata', async () => {
      const response = await createResponseChain({
        currentMessage: 'Test message',
        username: 'testuser',
        userMessages: []
      });

      expect(response).toBeDefined();
      expect(response.text).toBe('Mocked chain response');
    });
  });

  describe('Tracing in Embeddings', () => {
    beforeEach(() => {
      process.env.LANGSMITH_TRACING = 'true';
      process.env.OPENAI_API_KEY = 'test-key';
      initializeLangchainTracing();
    });

    it('should create embeddings with tracing enabled', () => {
      const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: 'text-embedding-3-large',
        verbose: process.env.LANGCHAIN_TRACING === 'true'
      });

      expect(embeddings).toBeDefined();
      expect(process.env.LANGCHAIN_TRACING).toBe('true');
    });
  });
}); 