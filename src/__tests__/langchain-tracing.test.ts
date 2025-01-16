import { initializeLangchainTracing } from '@/utils/langchain/tracing';
import { createChatModel, createResponseChain } from '@/utils/langchain/config';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { LLMChain } from 'langchain/chains';

// Mock dependencies
jest.mock('langchain/chat_models/openai');
jest.mock('@langchain/openai');
jest.mock('langchain/chains');

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

    // Setup mocks with proper typing
    const MockChatOpenAI = ChatOpenAI as jest.MockedClass<typeof ChatOpenAI>;
    MockChatOpenAI.mockImplementation(() => ({
      invoke: jest.fn().mockResolvedValue({ content: 'Mocked response' })
    } as any));

    const MockOpenAIEmbeddings = OpenAIEmbeddings as jest.MockedClass<typeof OpenAIEmbeddings>;
    MockOpenAIEmbeddings.mockImplementation(() => ({
      embedQuery: jest.fn().mockResolvedValue(new Array(1536).fill(0.1))
    } as any));

    const MockLLMChain = LLMChain as jest.MockedClass<typeof LLMChain>;
    MockLLMChain.mockImplementation(() => ({
      call: jest.fn().mockResolvedValue({ text: 'Mocked chain response' })
    } as any));
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Tracing Configuration', () => {
    it('should properly configure tracing when enabled', () => {
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
      expect(ChatOpenAI).toHaveBeenCalledWith({
        modelName: 'gpt-4-turbo-preview',
        temperature: 0.7
      });
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
      expect(LLMChain).toHaveBeenCalledWith(expect.objectContaining({
        verbose: true,
        tags: ['user-style-response'],
        metadata: {
          username: 'testuser',
          project: 'test-project'
        }
      }));
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
      expect(OpenAIEmbeddings).toHaveBeenCalledWith({
        openAIApiKey: 'test-key',
        modelName: 'text-embedding-3-large',
        verbose: true
      });
      expect(process.env.LANGCHAIN_TRACING).toBe('true');
    });
  });
}); 