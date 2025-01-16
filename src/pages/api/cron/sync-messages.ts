import { NextApiRequest, NextApiResponse } from 'next';
import { validateEnvironment } from '@/utils/supabase/environment';
import { MessageSyncJob } from '@/utils/cron/message-sync';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get environment from query params
    const environment = (req.query.environment as string) || 'development';

    // Validate environment
    validateEnvironment(environment);

    // Initialize and run sync job
    const syncJob = new MessageSyncJob(environment);
    const result = await syncJob.sync();

    return res.status(200).json({ 
      success: true,
      state: syncJob.getSyncState(),
      result
    });
  } catch (error: any) {
    console.error('Error in sync job:', error);
    // Return more detailed error information in development
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `${error?.message || 'Unknown error'}\n${error?.stack || ''}`
      : 'Internal server error';
      
    return res.status(500).json({ error: errorMessage });
  }
} 