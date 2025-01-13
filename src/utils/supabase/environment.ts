// Type for our supported environments
export type Environment = 'development' | 'production';

// Function to check if a string is a valid environment
export function isValidEnvironment(env: string): env is Environment {
  return env === 'development' || env === 'production';
}

// Error class for environment-related issues
export class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentError';
  }
}

// Function to validate environment or throw an error
export function validateEnvironment(env: string): Environment {
  if (!isValidEnvironment(env)) {
    throw new EnvironmentError(
      `Invalid environment: ${env}. Must be either 'development' or 'production'`
    );
  }
  return env;
} 