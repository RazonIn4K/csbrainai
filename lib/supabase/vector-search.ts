import { getSupabaseClient } from './client';

/**
 * Vector similarity search result
 */
export interface SearchResult {
  id: number;
  source_url: string;
  content: string;
  similarity: number;
}

/**
 * Perform vector similarity search using pgvector
 *
 * @param queryEmbedding - 1536-dim embedding vector from OpenAI
 * @param topK - Number of results to return (default 5)
 * @param minSimilarity - Minimum similarity threshold 0-1 (default 0.5)
 * @returns Array of matching documents sorted by similarity
 */
export async function searchSimilarDocuments(
  queryEmbedding: number[],
  topK = 5,
  minSimilarity = 0.5
): Promise<SearchResult[]> {
  const supabase = getSupabaseClient();

  // Validate embedding dimension
  if (queryEmbedding.length !== 1536) {
    throw new Error(
      `Invalid embedding dimension: expected 1536, got ${queryEmbedding.length}`
    );
  }

  try {
    // Call RPC function for vector search
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: topK,
      min_similarity: minSimilarity,
    });

    if (error) {
      throw new Error(`Vector search failed: ${error.message}`);
    }

    return (data || []) as SearchResult[];
  } catch (error) {
    console.error('Supabase vector search error:', error);
    throw error;
  }
}

/**
 * Alternative: Direct client-side vector search (without RPC)
 * Useful if you want to avoid RPC or need more control
 */
export async function searchSimilarDocumentsDirect(
  queryEmbedding: number[],
  topK = 5
): Promise<SearchResult[]> {
  const supabase = getSupabaseClient();

  try {
    // Direct SQL query using Supabase client
    // Note: This requires the embedding column to be selected
    const { data, error } = await supabase
      .from('rag_docs')
      .select('id, source_url, content, embedding')
      .limit(1000); // Pre-filter limit (adjust based on dataset size)

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Compute cosine similarity in JavaScript
    const results = data
      .map((doc) => {
        const embedding = doc.embedding as number[];
        if (!embedding || embedding.length !== 1536) {
          return null;
        }

        const similarity = cosineSimilarity(queryEmbedding, embedding);
        return {
          id: doc.id,
          source_url: doc.source_url,
          content: doc.content,
          similarity,
        };
      })
      .filter((r): r is SearchResult => r !== null)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    return results;
  } catch (error) {
    console.error('Direct vector search error:', error);
    throw error;
  }
}

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
