import * as cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { MessageSyncJob } from './message-sync';
import type { Environment } from '../supabase/environment';

interface SyncStats {
  lastRunTime: Date | null;
  lastSuccessTime: Date | null;
  consecutiveFailures: number;
  totalRuns: number;
  totalSuccesses: number;
  totalFailures: number;
  averageRunDuration: number;
  lastRunDuration: number;
  maxRunDuration: number;
  totalMessagesProcessed: number;
  totalBatchesProcessed: number;
  lastBatchSize: number;
}

export class MessageSyncScheduler {
  private task: ScheduledTask | null = null;
  private syncJob: MessageSyncJob;
  private stats: SyncStats = {
    lastRunTime: null,
    lastSuccessTime: null,
    consecutiveFailures: 0,
    totalRuns: 0,
    totalSuccesses: 0,
    totalFailures: 0,
    averageRunDuration: 0,
    lastRunDuration: 0,
    maxRunDuration: 0,
    totalMessagesProcessed: 0,
    totalBatchesProcessed: 0,
    lastBatchSize: 0
  };

  constructor(environment: Environment) {
    this.syncJob = new MessageSyncJob(environment);
  }

  public start(schedule = '*/5 * * * *'): void {
    if (this.task) {
      console.warn('Scheduler already running');
      return;
    }

    if (!cron.validate(schedule)) {
      throw new Error(`Invalid cron schedule: ${schedule}`);
    }

    this.task = cron.schedule(schedule, async () => {
      try {
        await this.syncNow();
      } catch (error) {
        console.error('Scheduled sync failed:', error);
      }
    });

    console.info(`Message sync scheduler started with schedule: ${schedule}`);
  }

  public stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.info('Message sync scheduler stopped');
    }
  }

  public async syncNow(maxRetries = 3): Promise<void> {
    const startTime = new Date();
    this.stats.lastRunTime = startTime;
    this.stats.totalRuns++;

    console.info('Starting message sync...');

    let lastError: Error | null = null;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        const result = await this.syncJob.sync();
        
        // Update stats with sync results
        const duration = new Date().getTime() - startTime.getTime();
        this.updateStats({
          duration,
          messagesProcessed: result.messagesProcessed,
          batchSize: result.batchSize
        });
        
        const durationStr = duration < 1000 ? `${duration}ms` : `${(duration/1000).toFixed(2)}s`;
        console.info(`Message sync completed successfully in ${durationStr}:`, {
          messagesProcessed: result.messagesProcessed,
          batchSize: result.batchSize,
          averageRunDuration: this.stats.averageRunDuration,
          totalMessagesProcessed: this.stats.totalMessagesProcessed
        });
        return;
      } catch (error) {
        lastError = error as Error;
        this.stats.totalFailures++;
        this.stats.consecutiveFailures++;
        
        if (retryCount < maxRetries) {
          const backoff = Math.pow(2, retryCount) * 1000; // Exponential backoff
          console.warn(`Sync attempt ${retryCount + 1} failed, retrying in ${backoff}ms:`, error);
          await new Promise(resolve => setTimeout(resolve, backoff));
          retryCount++;
        } else {
          break;
        }
      }
    }

    // If we get here, all retries failed
    const duration = new Date().getTime() - startTime.getTime();
    this.stats.lastRunDuration = duration;
    console.error(`Message sync failed after ${retryCount} retries in ${duration}ms`);
    throw lastError;
  }

  private updateStats(result: { duration: number; messagesProcessed: number; batchSize: number }): void {
    // Update success stats
    this.stats.lastSuccessTime = new Date();
    this.stats.totalSuccesses++;
    this.stats.consecutiveFailures = 0;
    
    // Update duration stats
    this.stats.lastRunDuration = result.duration;
    this.stats.maxRunDuration = Math.max(this.stats.maxRunDuration, result.duration);
    
    // Update average duration
    const totalDuration = this.stats.averageRunDuration * (this.stats.totalSuccesses - 1) + result.duration;
    this.stats.averageRunDuration = totalDuration / this.stats.totalSuccesses;
    
    // Update batch stats
    this.stats.totalMessagesProcessed += result.messagesProcessed;
    this.stats.totalBatchesProcessed++;
    this.stats.lastBatchSize = result.batchSize;
  }

  public getStats(): SyncStats {
    return { ...this.stats };
  }
} 