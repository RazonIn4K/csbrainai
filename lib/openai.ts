import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;
export const CHAT_MODEL = 'gpt-4o-mini';

/**
 * Generate embedding for a text using OpenAI's text-embedding-3-small model
 * @param text - Text to embed
 * @returns Embedding vector (1536 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      encoding_format: 'float',
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts - Array of texts to embed
 * @returns Array of embedding vectors
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      encoding_format: 'float',
    });

    return response.data.map((item) => item.embedding);
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw new Error('Failed to generate embeddings');
  }
}

/**
 * Generate answer using GPT-4o-mini with RAG context
 */
export async function generateAnswer(
  query: string,
  context: string[]
): Promise<{ answer: string; tokensUsed: number }> {
  try {
    const systemPrompt = `You are a helpful AI assistant. Answer questions based on the provided context.
If the answer cannot be found in the context, say "I don't have enough information to answer that question."
Be concise and accurate.`;

    const contextText = context.map((chunk, i) => `[${i + 1}] ${chunk}`).join('\n\n');

    const userPrompt = `Context:
${contextText}

Question: ${query}

Answer:`;

    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const answer = response.choices[0]?.message?.content || 'No answer generated';
    const tokensUsed = response.usage?.total_tokens || 0;

    return { answer, tokensUsed };
  } catch (error) {
    console.error('Error generating answer:', error);
    throw new Error('Failed to generate answer');
  }
}
