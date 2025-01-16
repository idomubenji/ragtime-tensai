import { ChatOpenAI } from 'langchain/chat_models/openai';
import { PromptTemplate } from 'langchain/prompts';
import { LLMChain } from 'langchain/chains';
import { Message } from '../supabase/types';
import { initializeLangchainTracing, getLangchainProject } from './tracing';

// Initialize tracing
console.log('Initializing tracing in config...');
initializeLangchainTracing();

// Types for our chat system
export interface ChatInput {
  currentMessage: string;
  username: string;
  userMessages: Message[];
  temperature?: number;
}

// Initialize the OpenAI chat model
export function createChatModel(temperature = 0.7) {
  console.log('Creating chat model with tracing:', process.env.LANGCHAIN_TRACING);
  return new ChatOpenAI({
    modelName: 'gpt-4-turbo-preview',
    temperature,
  });
}

// Base prompt template for user style matching
export const USER_STYLE_TEMPLATE = `You are impersonating a user named {username}. 
Below are some of their previous messages to understand their communication style:

{messageHistory}

Based on their style, respond to this message:
{currentMessage}

Remember to:
1. Match their vocabulary, tone, and typical message length
2. Use similar punctuation and capitalization patterns
3. Maintain their level of formality/informality
4. Include any common phrases or expressions they use

Response:`;

export const userStylePrompt = new PromptTemplate({
  template: USER_STYLE_TEMPLATE,
  inputVariables: ['username', 'messageHistory', 'currentMessage'],
});

// Create a chain for generating responses
export async function createResponseChain(input: ChatInput) {
  console.log('Creating response chain...');
  const model = createChatModel(input.temperature);
  const chain = new LLMChain({
    llm: model,
    prompt: userStylePrompt,
    // Add tracing configuration
    verbose: process.env.LANGSMITH_TRACING === 'true',
    tags: ['user-style-response'],
    metadata: {
      username: input.username,
      project: getLangchainProject(),
    },
  });

  console.log('Chain created with tracing config:', {
    verbose: process.env.LANGSMITH_TRACING === 'true',
    project: getLangchainProject(),
  });

  const messageHistory = input.userMessages
    .map(msg => msg.content)
    .join('\n\n');

  return chain.call({
    username: input.username,
    messageHistory,
    currentMessage: input.currentMessage,
  });
} 