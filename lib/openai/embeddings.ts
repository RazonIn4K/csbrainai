import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate embeddings using OpenAI text-embedding-3-small
 * Returns 1536-dimensional vectors
 *
 * @param text - Text to embed (single string or array)
 * @returns Array of embedding vectors
 */
export async function generateEmbedding(text: string): Promise<number[]>;
export async function generateEmbedding(texts: string[]): Promise<number[][]>;
export async function generateEmbedding(
  input: string | string[]
): Promise<number[] | number[][]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input,
      encoding_format: 'float',
    });

    if (Array.isArray(input)) {
      return response.data.map((item) => item.embedding);
    } else {
      return response.data[0].embedding;
    }
  } catch (error) {
    console.error('OpenAI embedding error:', error);
    throw new Error(`Failed to generate embeddings: ${error}`);
  }
}

/**
 * Generate embeddings in batches to avoid rate limits
 * OpenAI allows up to 2048 inputs per request, we use 100 for safety
 *
 * @param texts - Array of texts to embed
 * @param batchSize - Batch size (default 100)
 * @returns Array of embedding vectors
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  batchSize = 100
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    console.log(
      `Generating embeddings for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}...`
    );

    const batchEmbeddings = await generateEmbedding(batch);
    embeddings.push(...batchEmbeddings);

    // Rate limiting: wait 1 second between batches
    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return embeddings;
}

/**
 * Model metadata
 */
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSION = 1536;
