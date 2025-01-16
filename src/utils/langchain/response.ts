import { Message } from '../supabase/types';
import { createChatModel } from './config';
import { HumanMessage } from 'langchain/schema';

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
    
    const model = createChatModel(temperature);
    
    const prompt = `You are impersonating a user named ${username}. 
Below are some of their previous messages to understand their communication style:

${userMessages.map(msg => msg.content).join('\n\n')}

Based on their style, respond to this message:
${message}

Remember to:
1. Match their vocabulary, tone, and typical message length
2. Use similar punctuation and capitalization patterns
3. Maintain their level of formality/informality
4. Include any common phrases or expressions they use

Response:`;

    const response = await model.invoke([new HumanMessage(prompt)]);
    console.log('Got LLM response:', response);
    
    return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
  } catch (error) {
    console.error('Error generating response:', error);
    throw new Error('Failed to generate response');
  }
} 