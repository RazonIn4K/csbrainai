-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create rag_docs table for storing document chunks and embeddings
CREATE TABLE IF NOT EXISTS rag_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source information
  source_url TEXT NOT NULL,

  -- Deduplication: HMAC-SHA256 hash of content for idempotent ingestion
  chunk_hash TEXT NOT NULL UNIQUE,

  -- Document content
  content TEXT NOT NULL,

  -- Vector embedding (OpenAI text-embedding-3-small = 1536 dimensions)
  embedding vector(1536) NOT NULL,

  -- Metadata
  embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  embedding_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on chunk_hash for fast deduplication checks
CREATE INDEX IF NOT EXISTS idx_rag_docs_chunk_hash ON rag_docs(chunk_hash);

-- Create IVFFlat index for efficient vector similarity search
-- Using cosine distance (vector_cosine_ops) as it's normalized and works well with embeddings
-- lists = sqrt(total_rows) is a good starting point (will use 100 for ~10k docs)
CREATE INDEX IF NOT EXISTS idx_rag_docs_embedding
ON rag_docs
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index on source_url for filtering by source
CREATE INDEX IF NOT EXISTS idx_rag_docs_source_url ON rag_docs(source_url);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rag_docs_updated_at
    BEFORE UPDATE ON rag_docs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create a function for semantic search
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

-- Grant permissions (adjust based on your RLS policies)
-- For service role access (used by ingest scripts)
ALTER TABLE rag_docs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
CREATE POLICY "Service role has full access" ON rag_docs
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policy: Allow anon/authenticated users to read
CREATE POLICY "Public read access" ON rag_docs
  FOR SELECT
  USING (true);

-- Add comment for documentation
COMMENT ON TABLE rag_docs IS 'Stores document chunks with vector embeddings for RAG (Retrieval Augmented Generation)';
COMMENT ON COLUMN rag_docs.chunk_hash IS 'HMAC-SHA256 hash of content for deduplication';
COMMENT ON COLUMN rag_docs.embedding IS 'Vector embedding from OpenAI text-embedding-3-small (1536 dimensions)';
