import { NextRequest, NextResponse } from 'next/server';
import type { Environment } from '../supabase/environment';

const API_KEY_HEADER = 'x-tensai-key';

export function validateApiKey(request: NextRequest, environment: Environment = 'development'): boolean {
  const apiKey = request.headers.get(API_KEY_HEADER);
  const validKey = process.env.TENSAI_KEY;

  if (!validKey) {
    console.error('Missing required Tensai API key environment variable');
    return false;
  }

  const isValid = apiKey === validKey;

  console.log('API key validation result:', {
    headerUsed: API_KEY_HEADER,
    keyProvided: !!apiKey,
    isValid
  });

  return isValid;
}

export function getAuthErrorResponse() {
  return NextResponse.json(
    { error: 'Unauthorized - Invalid or missing API key' },
    { status: 401 }
  );
} 