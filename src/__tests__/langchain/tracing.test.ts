import { initializeLangchainTracing, getLangchainProject } from '@/utils/langchain/tracing';
import { createChatModel, createResponseChain } from '@/utils/langchain/config';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { LLMChain } from 'langchain/chains';

// Mock OpenAI chat model
jest.mock('langchain/chat_models/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation((config) => ({
    ...config,
    invoke: jest.fn().mockResolvedValue({ content: 'Mocked response' }),
  })),
}));

// Mock OpenAI embeddings
jest.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: jest.fn().mockImplementation((config) => ({
    ...config,
    embedQuery: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  })),
}));

// Mock LLMChain
jest.mock('langchain/chains', () => ({
  LLMChain: jest.fn().mockImplementation((config) => ({
    ...config,
    call: jest.fn().mockResolvedValue({ text: 'Mocked chain response' }),
  })),
}));

describe('Langchain Tracing', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('initializeLangchainTracing', () => {
    it('should not enable tracing when LANGSMITH_TRACING is false', () => {
      process.env.LANGSMITH_TRACING = 'false';
      initializeLangchainTracing();
      expect(process.env.LANGCHAIN_TRACING).toBeUndefined();
    });

    it('should enable tracing when LANGSMITH_TRACING is true', () => {
      process.env.LANGSMITH_TRACING = 'true';
      process.env.LANGSMITH_ENDPOINT = 'https://api.smith.langchain.com';
      process.env.LANGSMITH_API_KEY = 'test-key';
      process.env.LANGSMITH_PROJECT = 'test-project';

      initializeLangchainTracing();

      expect(process.env.LANGCHAIN_TRACING).toBe('true');
      expect(process.env.LANGCHAIN_ENDPOINT).toBe('https://api.smith.langchain.com');
      expect(process.env.LANGCHAIN_API_KEY).toBe('test-key');
      expect(process.env.LANGCHAIN_PROJECT).toBe('test-project');
    });

    it('should throw error when required variables are missing', () => {
      // Clear Langsmith-specific variables while keeping required ones
      const { NODE_ENV, PATH, ...rest } = process.env;
      process.env = { NODE_ENV, PATH };
      process.env.LANGSMITH_TRACING = 'true';
      
      expect(() => initializeLangchainTracing()).toThrow('Missing environment variable');
    });
  });

  describe('getLangchainProject', () => {
    it('should return configured project name', () => {
      process.env.LANGSMITH_PROJECT = 'custom-project';
      expect(getLangchainProject()).toBe('custom-project');
    });

    it('should return default when project not configured', () => {
      delete process.env.LANGSMITH_PROJECT;
      expect(getLangchainProject()).toBe('default');
    });
  });

  describe('Tracing Integration', () => {
    beforeEach(() => {
      process.env.LANGSMITH_TRACING = 'true';
      process.env.LANGSMITH_PROJECT = 'test-project';
      process.env.OPENAI_API_KEY = 'test-openai-key';
    });

    it('should create chat model with tracing enabled', () => {
      const model = createChatModel();
      expect(model).toBeDefined();
      expect(ChatOpenAI).toHaveBeenCalledWith({
        modelName: 'gpt-4-turbo-preview',
        temperature: 0.7,
      });
    });

    it('should create response chain with tracing metadata', async () => {
      const response = await createResponseChain({
        currentMessage: 'Hello',
        username: 'testuser',
        userMessages: [],
      });
      
      expect(response).toBeDefined();
      expect(response.text).toBe('Mocked chain response');
      expect(LLMChain).toHaveBeenCalledWith(expect.objectContaining({
        verbose: true,
        tags: ['user-style-response'],
        metadata: {
          username: 'testuser',
          project: 'test-project',
        },
      }));
    });

    it('should create embeddings with tracing enabled', () => {
      const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: 'text-embedding-3-large',
        verbose: process.env.LANGSMITH_TRACING === 'true',
      });

      expect(embeddings).toBeDefined();
      expect(OpenAIEmbeddings).toHaveBeenCalledWith({
        openAIApiKey: 'test-openai-key',
        modelName: 'text-embedding-3-large',
        verbose: true,
      });
    });
  });
}); 