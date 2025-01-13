import { Message } from '../supabase/types';
import { createResponseChain, ChatInput } from './config';

export interface GenerateResponseOptions {
  message: string;
  username: string;
  userMessages: Message[];
  temperature?: number;
}

export async function generateResponse({
  message,
  username,
  userMessages,
  temperature = 0.7,
}: GenerateResponseOptions): Promise<string> {
  try {
    const input: ChatInput = {
      currentMessage: message,
      username,
      userMessages,
      temperature,
    };

    const response = await createResponseChain(input);
    return response.text;
  } catch (error) {
    console.error('Error generating response:', error);
    throw new Error('Failed to generate response');
  }
} 