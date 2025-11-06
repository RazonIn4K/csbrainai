import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client factory
 * Uses anon key by default, service role for admin operations
 */

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(useServiceRole = false): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = useServiceRole
    ? process.env.SUPABASE_SERVICE_ROLE
    : process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      `Missing Supabase credentials: ${!url ? 'SUPABASE_URL' : ''} ${!key ? useServiceRole ? 'SUPABASE_SERVICE_ROLE' : 'SUPABASE_ANON_KEY' : ''}`
    );
  }

  // Reuse client instance (singleton pattern)
  if (!supabaseClient) {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false, // Server-side, no session persistence
      },
    });
  }

  return supabaseClient;
}

/**
 * Database types for rag_docs table
 */
export interface RagDocument {
  id: number;
  source_url: string;
  chunk_hash: string;
  content: string;
  embedding: number[] | null;
  embedding_model: string;
  embedding_date: string; // ISO date string (YYYY-MM-DD)
  created_at: string;
  updated_at: string;
}

/**
 * Insert type (for upserts)
 */
export interface RagDocumentInsert {
  source_url: string;
  chunk_hash: string;
  content: string;
  embedding: number[];
  embedding_model: string;
  embedding_date: string;
}
