export const REQUIRED_ENV_VARS = [
  'OPENAI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TENSAI_KEY'
] as const;

export type RequiredEnvVar = typeof REQUIRED_ENV_VARS[number];

export function getEnvironmentVariable(name: RequiredEnvVar, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || defaultValue!;
} 