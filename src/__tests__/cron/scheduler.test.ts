import { MessageSyncScheduler } from '../../utils/cron/scheduler';
import { PineconeClient } from '@pinecone-database/pinecone';
import cron from 'node-cron';
import { MessageSyncJob } from '../../utils/cron/message-sync';

// Mock OpenAI embeddings
jest.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedQuery: jest.fn().mockResolvedValue([0.1, 0.2, 0.3])
  }))
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({
    stop: jest.fn()
  })),
  validate: jest.fn().mockImplementation((schedule) => {
    // Basic validation for testing
    return /^[\d*/\s-,]+$/.test(schedule);
  })
}));

describe('MessageSyncScheduler', () => {
  let mockPineconeClient: jest.Mocked<PineconeClient>;
  let scheduler: MessageSyncScheduler;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock Pinecone client
    mockPineconeClient = {
      init: jest.fn().mockResolvedValue(undefined)
    } as any;

    scheduler = new MessageSyncScheduler(mockPineconeClient, 'development');
  });

  describe('start', () => {
    it('should start scheduler with default schedule', () => {
      scheduler.start();
      expect(cron.schedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function));
    });

    it('should start scheduler with custom schedule', () => {
      scheduler.start('0 * * * *');
      expect(cron.schedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function));
    });

    it('should throw error for invalid schedule', () => {
      expect(() => scheduler.start('invalid')).toThrow('Invalid cron schedule expression');
    });

    it('should not start multiple schedulers', () => {
      scheduler.start();
      scheduler.start();
      expect(cron.schedule).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('should stop running scheduler', () => {
      scheduler.start();
      const mockStop = (cron.schedule as jest.Mock).mock.results[0].value.stop;
      
      scheduler.stop();
      expect(mockStop).toHaveBeenCalled();
    });

    it('should handle stopping when not running', () => {
      scheduler.stop(); // Should not throw
    });
  });

  describe('syncNow', () => {
    it('should run sync job immediately', async () => {
      await expect(scheduler.syncNow()).resolves.not.toThrow();
    });
  });
}); 