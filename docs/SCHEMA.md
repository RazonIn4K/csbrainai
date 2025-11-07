# Database Schema Documentation

## Overview

The RAG system uses Supabase (PostgreSQL) with the pgvector extension for vector similarity search.

## Extensions

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

The `vector` extension enables storage and querying of high-dimensional vectors for semantic search.

## Tables

### `rag_docs`

Stores document chunks with their vector embeddings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Auto-generated unique identifier |
| `source_url` | TEXT | NOT NULL | Origin of the document (file path or URL) |
| `chunk_hash` | TEXT | NOT NULL, UNIQUE | HMAC-SHA256 hash of content for deduplication |
| `content` | TEXT | NOT NULL | Original text content of the chunk |
| `embedding` | vector(1536) | NOT NULL | Vector embedding from OpenAI |
| `embedding_model` | TEXT | NOT NULL | Model name (default: text-embedding-3-small) |
| `embedding_date` | TIMESTAMPTZ | NOT NULL | When the embedding was generated |
| `created_at` | TIMESTAMPTZ | NOT NULL | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

## Indexes

### Primary Indexes

1. **Primary Key Index** on `id`
   - Automatically created with PRIMARY KEY constraint

2. **Unique Index** on `chunk_hash`
   ```sql
   CREATE INDEX idx_rag_docs_chunk_hash ON rag_docs(chunk_hash);
   ```
   - Ensures deduplication
   - Enables fast lookup for upsert operations

### Vector Index

**IVFFlat Index** on `embedding`
```sql
CREATE INDEX idx_rag_docs_embedding
ON rag_docs
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

- **Type**: IVFFlat (Inverted File with Flat compression)
- **Operator Class**: `vector_cosine_ops` (cosine distance)
- **Lists**: 100 (optimized for ~10,000 documents)

**Performance Characteristics**:
- Fast approximate nearest neighbor search
- Trade-off between speed and accuracy
- Lists parameter: `sqrt(total_rows)` is a good starting point

### Supporting Indexes

3. **Index** on `source_url`
   ```sql
   CREATE INDEX idx_rag_docs_source_url ON rag_docs(source_url);
   ```
   - Enables filtering by source
   - Useful for deleting/updating specific documents

## Functions

### `match_documents`

Performs semantic search using vector similarity.

```sql
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
```

**Parameters**:
- `query_embedding`: Vector to search for
- `match_threshold`: Minimum similarity score (0-1)
- `match_count`: Maximum number of results

**Returns**:
- `id`: Document ID
- `source_url`: Source of the document
- `content`: Text content
- `similarity`: Similarity score (1 - cosine_distance)

**Usage Example**:
```sql
SELECT * FROM match_documents(
  '[0.1, 0.2, ...]'::vector(1536),
  0.5,
  5
);
```

## Row Level Security (RLS)

### Policies

1. **Service Role Full Access**
   ```sql
   CREATE POLICY "Service role has full access" ON rag_docs
     FOR ALL
     USING (auth.role() = 'service_role');
   ```
   - Ingestion scripts use service role
   - Full CRUD permissions

2. **Public Read Access**
   ```sql
   CREATE POLICY "Public read access" ON rag_docs
     FOR SELECT
     USING (true);
   ```
   - API endpoints use anon key
   - Read-only access for queries

## Migration

### Running Migration

```bash
# Connect to Supabase
supabase link --project-ref <your-project-ref>

# Run migration
supabase db push
```

Or execute `supabase/migrations/001_rag_schema.sql` directly in the Supabase SQL Editor.

## Maintenance

### Updating IVFFlat Lists

As your dataset grows, update the `lists` parameter:

```sql
-- Drop old index
DROP INDEX idx_rag_docs_embedding;

-- Recreate with new lists value
-- Rule of thumb: lists = sqrt(total_rows)
CREATE INDEX idx_rag_docs_embedding
ON rag_docs
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 200);  -- For ~40k documents
```

### Vacuum After Large Deletions

```sql
VACUUM ANALYZE rag_docs;
```

This rebuilds statistics and reclaims space after bulk deletions.
