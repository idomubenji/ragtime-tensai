import cron from 'node-cron';
import { MessageSyncJob } from './message-sync';
import { PineconeClient } from '@pinecone-database/pinecone';
import type { Environment } from '../supabase/environment';

export class MessageSyncScheduler {
  private syncJob: MessageSyncJob;
  private cronJob: cron.ScheduledTask | null = null;

  constructor(pineconeClient: PineconeClient, environment: Environment = 'development') {
    this.syncJob = new MessageSyncJob(pineconeClient, environment);
  }

  /**
   * Start the message sync scheduler
   * @param schedule cron schedule expression (default: every 5 minutes)
   */
  start(schedule: string = '*/5 * * * *'): void {
    if (this.cronJob) {
      console.log('Scheduler is already running');
      return;
    }

    // Validate cron expression
    if (!cron.validate(schedule)) {
      throw new Error('Invalid cron schedule expression');
    }

    this.cronJob = cron.schedule(schedule, async () => {
      console.log('Starting scheduled message sync...');
      try {
        await this.syncJob.syncMessages();
        console.log('Scheduled message sync completed successfully');
      } catch (error) {
        console.error('Error in scheduled message sync:', error);
      }
    });

    console.log(`Message sync scheduler started with schedule: ${schedule}`);
  }

  /**
   * Stop the message sync scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('Message sync scheduler stopped');
    }
  }

  /**
   * Run a sync job immediately, regardless of schedule
   */
  async syncNow(): Promise<void> {
    console.log('Running immediate message sync...');
    try {
      await this.syncJob.syncMessages();
      console.log('Immediate message sync completed successfully');
    } catch (error) {
      console.error('Error in immediate message sync:', error);
      throw error;
    }
  }
} 