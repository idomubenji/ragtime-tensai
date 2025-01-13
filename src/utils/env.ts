const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PINECONE_API_KEY',
  'PINECONE_ENVIRONMENT',
  'PINECONE_LARGE_INDEX_NAME',
  'PINECONE_SMALL_INDEX_NAME',
  'OPENAI_API_KEY',
  'CRON_SECRET'
] as const;

type EnvVar = typeof requiredEnvVars[number];

/**
 * Validate that all required environment variables are set
 * @throws Error if any required variables are missing
 */
export function validateEnv(): void {
  const missing: EnvVar[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map(v => `  - ${v}`).join('\n')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    );
  }

  // Validate Supabase URL format
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!/^https?:\/\/.+/.test(supabaseUrl!)) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid URL');
  }

  // Validate environment
  const env = process.env.NODE_ENV;
  if (env !== 'development' && env !== 'production') {
    throw new Error('NODE_ENV must be either "development" or "production"');
  }
}

/**
 * Get an environment variable
 * @param name The name of the environment variable
 * @throws Error if the variable is not set
 */
export function getEnvVar(name: EnvVar): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
} 