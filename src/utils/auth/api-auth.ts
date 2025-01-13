import { NextRequest } from 'next/server';

const API_KEY_HEADER = 'X-API-Key';

export function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get(API_KEY_HEADER);
  const validApiKey = process.env.TENSAI_KEY;

  if (!validApiKey) {
    console.error('TENSAI_KEY environment variable not set');
    return false;
  }

  return apiKey === validApiKey;
}

export function getAuthErrorResponse() {
  return new Response(
    JSON.stringify({ error: 'Unauthorized - Invalid or missing API key' }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
} 