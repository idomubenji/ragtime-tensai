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
    console.log('Generating response with LLM for:', { message, username });
    
    const input: ChatInput = {
      currentMessage: message,
      username,
      userMessages,
      temperature,
    };

    console.log('Creating response chain with input:', input);
    const response = await createResponseChain(input);
    console.log('Got LLM response:', response);
    
    return response.text;
  } catch (error) {
    console.error('Error generating response:', error);
    throw new Error('Failed to generate response');
  }
} 