# Technical Implementation Details

## Vector Database Schema

The `rag_docs` table stores document chunks with embeddings:

### Columns
- `id`: UUID primary key
- `source_url`: Origin of the document chunk
- `chunk_hash`: HMAC-SHA256 hash for deduplication
- `content`: Original text content
- `embedding`: vector(1536) - pgvector type
- `embedding_model`: Model used (text-embedding-3-small)
- `embedding_date`: Timestamp of embedding generation
- `created_at` and `updated_at`: Audit timestamps

### Indexes
- Unique index on `chunk_hash` prevents duplicates
- IVFFlat index on `embedding` for fast similarity search
- Uses cosine distance operator (<=>)
- Configured with 100 lists for optimal performance

## Chunking Strategy

Documents are split into chunks using a paragraph-based approach:
- Split on double newlines (paragraph boundaries)
- Maximum chunk size: 2000 characters
- Minimum chunk size: 50 characters (filters noise)
- Overlapping chunks are not used (simpler deduplication)

## Embedding Model

OpenAI text-embedding-3-small:
- Dimensions: 1536
- Cost-effective for production use
- Good balance of quality and performance
- Normalized vectors work well with cosine similarity

## Answer Generation Model

gpt-4o-mini for response generation:
- Fast and cost-effective
- Maximum tokens: 500 per response
- Temperature: 0.7 for balanced creativity
- System prompt emphasizes accuracy and citations

## Deduplication

The chunk_hash prevents duplicate ingestion:
- Hash computed: HMAC-SHA256(content, HASH_SALT)
- Unique constraint enforces idempotency
- Upsert operations update existing chunks
- Allows re-running ingestion safely
