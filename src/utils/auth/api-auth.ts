import { NextRequest, NextResponse } from 'next/server';

const API_KEY_HEADER = 'x-tensai-key';

export function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get(API_KEY_HEADER);
  const validApiKey = process.env.TENSAI_KEY;

  if (!validApiKey) {
    console.error('TENSAI_KEY environment variable not set');
    return false;
  }

  const isValid = apiKey === validApiKey;
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