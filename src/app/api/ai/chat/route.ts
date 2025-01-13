import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, mentionedUsername } = body;

    // For now, return a simple response to test the endpoint
    return NextResponse.json({
      content: `Echo: ${message}`,
      username: mentionedUsername ? `FAKE ${mentionedUsername}` : 'TENSAI BOT',
      avatarUrl: '', // We'll implement this later
    });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 