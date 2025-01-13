import { NextApiRequest, NextApiResponse } from 'next';
import { MessageSyncJob } from '../../../utils/cron/message-sync';
import { PineconeClient } from '@pinecone-database/pinecone';
import { validateEnv } from '../../../utils/env';

// Initialize Pinecone client
let pineconeClient: PineconeClient | null = null;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Verify request is from Vercel Cron
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate environment
    validateEnv();

    // Initialize Pinecone if not already initialized
    if (!pineconeClient) {
      pineconeClient = new PineconeClient();
      await pineconeClient.init({
        apiKey: process.env.PINECONE_API_KEY!,
        environment: process.env.PINECONE_ENVIRONMENT!
      });
    }

    // Create and run sync job
    const syncJob = new MessageSyncJob(pineconeClient);
    await syncJob.syncMessages();

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in sync-messages cron job:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 