import { createClient } from '@supabase/supabase-js';

// Types for our RAG documents
export interface RagDoc {
  id: string;
  source_url: string;
  chunk_hash: string;
  content: string;
  embedding: number[];
  embedding_model: string;
  embedding_date: string;
  created_at: string;
  updated_at: string;
}

export interface MatchedDocument {
  id: string;
  source_url: string;
  content: string;
  similarity: number;
}

/**
 * Create Supabase client for server-side operations (using service role)
 * IMPORTANT: Only use this in server-side code (API routes, server components)
 * Never expose service role key to the client
 */
export function createServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !supabaseServiceRole) {
    throw new Error('Missing Supabase environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE)');
  }

  return createClient(supabaseUrl, supabaseServiceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Create Supabase client for client-side operations (using anon key)
 * Safe to use in browser/client components
 */
export function createAnonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables (SUPABASE_URL or SUPABASE_ANON_KEY)');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Upsert a document chunk (insert or update if chunk_hash exists)
 */
export async function upsertDocument(
  doc: Omit<RagDoc, 'id' | 'created_at' | 'updated_at'>
): Promise<RagDoc> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('rag_docs')
    .upsert(
      {
        chunk_hash: doc.chunk_hash,
        source_url: doc.source_url,
        content: doc.content,
        embedding: doc.embedding,
        embedding_model: doc.embedding_model,
        embedding_date: doc.embedding_date,
      },
      {
        onConflict: 'chunk_hash',
        ignoreDuplicates: false, // Update if exists
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert document: ${error.message}`);
  }

  return data;
}

/**
 * Perform semantic search using vector similarity
 */
export async function searchDocuments(
  queryEmbedding: number[],
  options: {
    matchThreshold?: number;
    matchCount?: number;
  } = {}
): Promise<MatchedDocument[]> {
  const { matchThreshold = 0.5, matchCount = 5 } = options;
  const supabase = createAnonClient();

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) {
    throw new Error(`Failed to search documents: ${error.message}`);
  }

  return data || [];
}

/**
 * Get document by chunk hash
 */
export async function getDocumentByHash(chunkHash: string): Promise<RagDoc | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('rag_docs')
    .select('*')
    .eq('chunk_hash', chunkHash)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw new Error(`Failed to get document: ${error.message}`);
  }

  return data;
}

/**
 * Delete all documents from a specific source
 */
export async function deleteDocumentsBySource(sourceUrl: string): Promise<number> {
  const supabase = createServiceClient();

  const { error, count } = await supabase
    .from('rag_docs')
    .delete({ count: 'exact' })
    .eq('source_url', sourceUrl);

  if (error) {
    throw new Error(`Failed to delete documents: ${error.message}`);
  }

  return count || 0;
}
