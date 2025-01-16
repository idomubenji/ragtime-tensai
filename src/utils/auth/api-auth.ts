import { NextRequest, NextResponse } from 'next/server';
import type { Environment } from '../supabase/environment';

const API_KEY_HEADER = 'x-tensai-key';

export function validateApiKey(request: NextRequest, environment: Environment = 'development'): boolean {
  const apiKey = request.headers.get(API_KEY_HEADER);
  const validDevKey = process.env.NEXT_PUBLIC_TENSAI_KEY;
  const validProdKey = process.env.TENSAI_KEY;

  if (!validDevKey || !validProdKey) {
    console.error('Missing required Tensai API key environment variables');
    return false;
  }

  const expectedKey = environment === 'development' ? validDevKey : validProdKey;
  const isValid = apiKey === expectedKey;

  console.log('API key validation result:', {
    headerUsed: API_KEY_HEADER,
    keyProvided: !!apiKey,
    environment,
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