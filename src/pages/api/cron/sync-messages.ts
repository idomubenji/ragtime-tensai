import { NextApiRequest, NextApiResponse } from 'next';
import { PineconeClient } from '@pinecone-database/pinecone';
import { MessageSyncJob } from '@/utils/cron/message-sync';

// Initialize Pinecone client
const pineconeClient = new PineconeClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Verify cron secret
    const cronSecret = req.headers['x-cron-secret'];
    if (cronSecret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Initialize Pinecone
    await pineconeClient.init({
      apiKey: process.env.PINECONE_API_KEY!,
      environment: process.env.PINECONE_ENVIRONMENT!
    });

    // Get current environment
    const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';

    // Create and run sync job
    const syncJob = new MessageSyncJob(pineconeClient, environment);
    await syncJob.syncMessages();

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in message sync:', error);
    res.status(500).json({ error: 'Failed to sync messages' });
  }
} 