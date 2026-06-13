-- Fix: production /api/answer (which calls match_documents via the ANON client)
-- failed with "permission denied for table rag_docs".
--
-- Cause: in 001_rag_schema.sql match_documents is SECURITY INVOKER (the default),
-- so its body runs with the caller's privileges. The anon role has no table-level
-- GRANT on rag_docs, and a permissive RLS SELECT policy does not help until the
-- role can access the table at all -> "permission denied for table".
--
-- Fix: run the controlled search RPC as SECURITY DEFINER so it reads rag_docs with
-- the function owner's privileges, keeping the table itself locked down to anon.
-- SET search_path pins the schema to prevent search_path hijacking of a definer fn.

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  source_url TEXT,
  content TEXT,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rag_docs.id,
    rag_docs.source_url,
    rag_docs.content,
    1 - (rag_docs.embedding <=> query_embedding) AS similarity
  FROM rag_docs
  WHERE 1 - (rag_docs.embedding <=> query_embedding) > match_threshold
  ORDER BY rag_docs.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Allow the anon and authenticated roles to call the RPC (the answer route uses anon)
GRANT EXECUTE ON FUNCTION match_documents(vector, float, int) TO anon, authenticated;
