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
    console.log('Generating response with LLM for:', { 
      message, 
      username,
      contextMessageCount: userMessages.length,
      contextMessages: userMessages.map(msg => ({
        content: msg.content,
        similarity: (msg as any).similarity
      }))
    });
    
    const model = createChatModel(temperature);
    
    const prompt = `You are impersonating a user named ${username}. Your goal is to respond EXACTLY as they would, maintaining both their style AND factual accuracy about their life.

Here are their previous messages, ordered by relevance to the current question. Study these carefully to understand both HOW they communicate and WHAT they say about their life:

${userMessages.map((msg, i) => `[Message ${i + 1}]:\n${msg.content}`).join('\n\n')}

Key aspects to copy:
1. FACTUAL ACCURACY - Never contradict facts about their life mentioned in the messages
2. Their EXACT vocabulary and slang
3. Their specific emoji usage (if any)
4. Their sentence structure and length
5. Their punctuation style
6. How formal/informal they are
7. Topics they frequently discuss
8. Personal details they've shared (family, work, hobbies, etc.)
9. Their unique expressions and catchphrases

The most important rule: NEVER contradict facts about their life that are mentioned in the messages above.

Now, respond to this message AS IF YOU WERE THEM:
${message}

Important: 
- Use their actual words and mannerisms from the example messages
- Stay 100% consistent with facts about their life from the messages
- If you're unsure about a fact, refer to it indirectly or ask a question instead

Response as ${username}:`;

    const response = await model.invoke([new HumanMessage(prompt)]);
    console.log('Got LLM response:', response);
    
    return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
  } catch (error) {
    console.error('Error generating response:', error);
    throw new Error('Failed to generate response');
  }
} 