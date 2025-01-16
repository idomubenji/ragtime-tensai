// Type for our supported environments
export type Environment = 'development' | 'production';

// Error class for environment-related issues
export class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentError';
  }
}

// Function to validate environment or throw an error
export function validateEnvironment(env: string): asserts env is Environment {
  if (env !== 'development' && env !== 'production') {
    throw new EnvironmentError(`Invalid environment: ${env}`);
  }
}

/**
 * Get an environment variable with type safety and optional default value
 */
export function getEnvironmentVariable(name: string, defaultValue?: string | boolean): string {
  const value = process.env[name];
  
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return String(defaultValue);
    }
    throw new EnvironmentError(`Missing environment variable: ${name}`);
  }
  
  return value;
} 