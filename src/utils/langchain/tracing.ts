import { getEnvironmentVariable } from '../supabase/environment';

/**
 * Initialize Langchain tracing based on environment variables
 */
export function initializeLangchainTracing() {
  try {
    console.log('Initializing Langchain tracing...');
    const tracingEnabled = getEnvironmentVariable('LANGSMITH_TRACING', 'false') === 'true';
    console.log('Tracing enabled:', tracingEnabled);
    
    if (!tracingEnabled) {
      console.log('Tracing disabled, removing LANGCHAIN_TRACING');
      delete process.env.LANGCHAIN_TRACING;
      return;
    }

    // Required variables when tracing is enabled
    const endpoint = getEnvironmentVariable('LANGSMITH_ENDPOINT');
    const apiKey = getEnvironmentVariable('LANGSMITH_API_KEY');
    const project = getEnvironmentVariable('LANGSMITH_PROJECT');

    console.log('Setting up tracing with endpoint:', endpoint);
    console.log('Using project:', project);

    // Set required environment variables for tracing
    process.env.LANGCHAIN_TRACING = 'true';
    process.env.LANGCHAIN_ENDPOINT = endpoint;
    process.env.LANGCHAIN_API_KEY = apiKey;
    process.env.LANGCHAIN_PROJECT = project;
    
    console.log('Langchain tracing initialized successfully');
  } catch (error) {
    console.error('Error initializing Langchain tracing:', error);
    // If any required variable is missing, disable tracing and throw error
    delete process.env.LANGCHAIN_TRACING;
    throw error;
  }
}

/**
 * Get the current Langchain project name based on environment
 */
export function getLangchainProject(): string {
  return getEnvironmentVariable('LANGSMITH_PROJECT', 'default');
} 