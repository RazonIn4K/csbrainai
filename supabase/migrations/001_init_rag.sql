-- CSBrainAI RAG Database Schema
-- Supabase + pgvector for vector similarity search

-- Enable pgvector extension
create extension if not exists vector;

-- Main table for document chunks with embeddings
create table if not exists rag_docs (
  id bigserial primary key,
  source_url text not null,
  chunk_hash text unique not null,
  content text not null,
  embedding vector(1536),  -- OpenAI text-embedding-3-small dimension
  embedding_model text not null default 'text-embedding-3-small',
  embedding_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast lookup by source
create index if not exists rag_docs_source_url_idx on rag_docs(source_url);

-- Index for temporal queries
create index if not exists rag_docs_embedding_date_idx on rag_docs(embedding_date);

-- IVFFlat index for approximate nearest neighbor search
-- Using cosine distance (1 - cosine_similarity)
-- Lists = 100 is good for ~100k documents (adjust for scale)
create index if not exists rag_docs_embedding_idx
  on rag_docs
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Update timestamp trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_rag_docs_updated_at
  before update on rag_docs
  for each row
  execute function update_updated_at_column();

-- RPC function for vector similarity search
create or replace function match_documents(
  query_embedding vector(1536),
  match_count int default 5,
  min_similarity float default 0.5
)
returns table (
  id bigint,
  source_url text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    rag_docs.id,
    rag_docs.source_url,
    rag_docs.content,
    1 - (rag_docs.embedding <=> query_embedding) as similarity
  from rag_docs
  where 1 - (rag_docs.embedding <=> query_embedding) > min_similarity
  order by rag_docs.embedding <=> query_embedding
  limit match_count;
$$;

-- Grant permissions (adjust for your Supabase roles)
-- For authenticated users
grant select on rag_docs to anon, authenticated;
grant execute on function match_documents to anon, authenticated;

-- For service role (ingest script)
grant all on rag_docs to service_role;
grant usage, select on sequence rag_docs_id_seq to service_role;

-- Comments for documentation
comment on table rag_docs is 'Document chunks with vector embeddings for RAG system';
comment on column rag_docs.chunk_hash is 'SHA-256 hash of source_url + content for deduplication';
comment on column rag_docs.embedding is 'OpenAI text-embedding-3-small 1536-dimensional vector';
comment on column rag_docs.embedding_model is 'Model used for embedding generation';
comment on column rag_docs.embedding_date is 'Date when embedding was generated (ISO date, not timestamp)';
comment on function match_documents is 'Vector similarity search using cosine distance';
