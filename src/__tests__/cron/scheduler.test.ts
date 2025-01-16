import { MessageSyncScheduler } from '../../utils/cron/scheduler';
import { MessageSyncJob } from '../../utils/cron/message-sync';
import * as cron from 'node-cron';

jest.mock('node-cron', () => ({
  schedule: jest.fn().mockReturnValue({ stop: jest.fn() }),
  validate: jest.fn().mockReturnValue(true)
}));

jest.mock('../../utils/cron/message-sync');

describe('MessageSyncScheduler', () => {
  let scheduler: MessageSyncScheduler;
  let mockSync: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new MessageSyncScheduler('development');
    mockSync = jest.spyOn(MessageSyncJob.prototype, 'sync');
  });

  describe('start/stop', () => {
    it('should start and stop the scheduler', () => {
      scheduler.start();
      expect(cron.schedule).toHaveBeenCalled();

      scheduler.stop();
      expect(scheduler['task']).toBeNull();
    });

    it('should warn if scheduler is already running', () => {
      const consoleSpy = jest.spyOn(console, 'warn');
      scheduler.start();
      scheduler.start();
      expect(consoleSpy).toHaveBeenCalledWith('Scheduler already running');
    });

    it('should throw error for invalid cron schedule', () => {
      (cron.validate as jest.Mock).mockReturnValueOnce(false);
      expect(() => scheduler.start('invalid')).toThrow('Invalid cron schedule');
    });
  });

  describe('sync operations', () => {
    it('should track successful syncs', async () => {
      mockSync.mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return { messagesProcessed: 10, batchSize: 10 };
      });
      await scheduler.syncNow();

      const stats = scheduler.getStats();
      expect(stats.totalSuccesses).toBe(1);
      expect(stats.consecutiveFailures).toBe(0);
      expect(stats.totalMessagesProcessed).toBe(10);
      expect(stats.totalBatchesProcessed).toBe(1);
      expect(stats.lastBatchSize).toBe(10);
      expect(stats.lastRunDuration).toBeGreaterThan(0);
      expect(stats.averageRunDuration).toBeGreaterThan(0);
    });

    it('should track failed syncs', async () => {
      mockSync.mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        throw new Error('Sync failed');
      });
      await expect(scheduler.syncNow(0)).rejects.toThrow('Sync failed');

      const stats = scheduler.getStats();
      expect(stats.totalFailures).toBe(1);
      expect(stats.consecutiveFailures).toBe(1);
      expect(stats.lastRunDuration).toBeGreaterThan(0);
    });

    it('should track empty syncs', async () => {
      mockSync.mockResolvedValueOnce({ messagesProcessed: 0, batchSize: 0 });
      await scheduler.syncNow();

      const stats = scheduler.getStats();
      expect(stats.totalSuccesses).toBe(1);
      expect(stats.totalMessagesProcessed).toBe(0);
      expect(stats.lastBatchSize).toBe(0);
    });

    it('should update max run duration', async () => {
      // First sync - sets initial max
      mockSync.mockResolvedValueOnce({ messagesProcessed: 5, batchSize: 5 });
      await scheduler.syncNow();
      const firstMax = scheduler.getStats().maxRunDuration;

      // Second sync - should be longer due to delay
      mockSync.mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { messagesProcessed: 5, batchSize: 5 };
      });
      await scheduler.syncNow();
      
      const stats = scheduler.getStats();
      expect(stats.maxRunDuration).toBeGreaterThan(firstMax);
    });

    it('should calculate average run duration correctly', async () => {
      // First sync
      mockSync.mockResolvedValueOnce({ messagesProcessed: 5, batchSize: 5 });
      await scheduler.syncNow();
      const firstAvg = scheduler.getStats().averageRunDuration;

      // Second sync with delay
      mockSync.mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { messagesProcessed: 5, batchSize: 5 };
      });
      await scheduler.syncNow();
      
      const stats = scheduler.getStats();
      expect(stats.averageRunDuration).toBeGreaterThan(firstAvg);
      expect(stats.totalSuccesses).toBe(2);
    });
  });
}); 