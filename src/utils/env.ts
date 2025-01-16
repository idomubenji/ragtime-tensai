export const REQUIRED_ENV_VARS = [
  'OPENAI_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL_DEV',
  'SUPABASE_KEY_DEV',
  'NEXT_PUBLIC_SUPABASE_URL_PROD',
  'SUPABASE_KEY_PROD',
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