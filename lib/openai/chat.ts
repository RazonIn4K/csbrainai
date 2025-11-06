import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Chat completion request
 */
export interface ChatRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

/**
 * Generate chat completion using OpenAI
 * Default model: gpt-4o-mini (cost-effective for RAG)
 *
 * @param request - Chat completion request
 * @returns Generated response text
 */
export async function generateChatCompletion(
  request: ChatRequest
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  try {
    const response = await openai.chat.completions.create({
      model: request.model || 'gpt-4o-mini',
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 500,
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('OpenAI chat error:', error);
    throw new Error(`Failed to generate chat completion: ${error}`);
  }
}

/**
 * Build RAG prompt with context
 * Context-only approach: Model can ONLY use provided documents
 *
 * @param query - User question
 * @param contexts - Retrieved document chunks
 * @returns Chat messages array
 */
export function buildRAGPrompt(
  query: string,
  contexts: Array<{ source_url: string; content: string }>
): ChatRequest['messages'] {
  const contextText = contexts
    .map((ctx, idx) => `[Document ${idx + 1} - ${ctx.source_url}]\n${ctx.content}`)
    .join('\n\n---\n\n');

  return [
    {
      role: 'system',
      content:
        'You are a helpful AI assistant. Answer the user\'s question using ONLY the information provided in the context below. If the context does not contain enough information to answer the question, say "I don\'t have enough information in the provided context to answer that question."',
    },
    {
      role: 'user',
      content: `Context:\n\n${contextText}\n\n---\n\nQuestion: ${query}\n\nPlease provide a clear and concise answer based solely on the context above.`,
    },
  ];
}

/**
 * Default model for RAG
 */
export const DEFAULT_CHAT_MODEL = 'gpt-4o-mini';
