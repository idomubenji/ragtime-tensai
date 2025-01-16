export const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL_DEV',
  'NEXT_PUBLIC_SUPABASE_URL_PROD',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TENSAI_KEY',
  'NEXT_PUBLIC_TENSAI_KEY',
  'VECTOR_SUPABASE_URL',
  'VECTOR_SUPABASE_SERVICE_KEY',
  'VECTOR_TABLE_NAME',
  'OPENAI_API_KEY'
] as const;

export type RequiredEnvVar = typeof REQUIRED_ENV_VARS[number];

export function getEnvironmentVariable(name: RequiredEnvVar, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || defaultValue!;
} 