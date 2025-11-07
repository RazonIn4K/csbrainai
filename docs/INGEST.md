# Ingestion Process Documentation

## Overview

The ingestion script (`scripts/ingest.ts`) processes knowledge documents, creates embeddings, and stores them in Supabase with pgvector.

## Process Flow

```
┌─────────────────┐
│ Read MD/TXT     │
│ Files           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Chunk Content   │
│ (Paragraphs)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate Hash   │
│ (HMAC-SHA256)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Embedding│
│ (OpenAI)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Upsert to       │
│ Supabase        │
└─────────────────┘
```

## Chunking Strategy

### Paragraph-Based Chunking

The script uses a simple, effective paragraph-based chunking approach:

```typescript
function chunkText(text: string, maxLength: number = 2000): string[]
```

**Parameters**:
- `maxLength`: Maximum characters per chunk (default: 2000)

**Algorithm**:
1. Split text on double newlines (`\n\n`)
2. Group paragraphs until `maxLength` is reached
3. Create new chunk if threshold exceeded
4. Filter out chunks < 50 characters

**Rationale**:
- Preserves semantic boundaries (paragraphs)
- No overlapping chunks (simpler deduplication)
- ~2000 chars ≈ 500 tokens (safe for embeddings)

### Example

**Input**:
```markdown
# Title

This is paragraph one.
It has multiple lines.

This is paragraph two.

This is paragraph three.
```

**Output**:
```javascript
[
  "# Title\n\nThis is paragraph one.\nIt has multiple lines.",
  "This is paragraph two.\n\nThis is paragraph three."
]
```

## Deduplication

### Chunk Hash

Each chunk is hashed using HMAC-SHA256:

```typescript
const chunkHash = generateHMAC(chunk);
```

**Properties**:
- Deterministic: Same content = same hash
- Irreversible: Cannot reconstruct content from hash
- Uses `HASH_SALT` environment variable

### Upsert Behavior

```typescript
await upsertDocument({
  chunk_hash: chunkHash,
  // ...other fields
}, {
  onConflict: 'chunk_hash'
});
```

- If `chunk_hash` exists: UPDATE
- If new: INSERT
- Idempotent: Safe to re-run ingestion

## Embedding Generation

### Model

OpenAI `text-embedding-3-small`:
- **Dimensions**: 1536
- **Cost**: $0.02 per 1M tokens
- **Performance**: ~500ms per request

### Rate Limiting

Built-in delay between API calls:
```typescript
await new Promise(resolve => setTimeout(resolve, 100));
```

- 100ms delay = ~10 requests/second
- Prevents hitting OpenAI rate limits
- Adjust based on your tier

## Running Ingestion

### Prerequisites

1. Environment variables set (`.env`):
   ```bash
   OPENAI_API_KEY=sk-...
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_ROLE=eyJ...  # Important: Use service role, not anon key
   HASH_SALT=your-secret-salt
   ```

2. Knowledge files in `data/knowledge/`:
   ```
   data/knowledge/
   ├── doc1.md
   ├── doc2.md
   └── doc3.txt
   ```

### Command

```bash
npm run ingest
```

### Output

```
🚀 Starting RAG ingestion...

📚 Found 3 knowledge file(s)

📄 Processing: doc1.md
  ├─ Chunks: 15
  ├─ Progress: 15/15
  └─ Completed: doc1.md

...

✅ Ingestion complete!

📊 Summary:
  ├─ Total chunks: 42
  ├─ Processed: 38
  ├─ Skipped (duplicates): 4
  └─ Errors: 0
```

## Best Practices

### 1. File Organization

Organize knowledge by topic:
```
data/knowledge/
├── product/
│   ├── features.md
│   └── pricing.md
├── technical/
│   ├── api.md
│   └── architecture.md
└── support/
    └── faq.md
```

### 2. Metadata in Filenames

Use descriptive filenames for better `source_url`:
```
good: data/knowledge/api-authentication.md
bad:  data/knowledge/doc1.md
```

### 3. Content Guidelines

- **Clear headings**: Use markdown headers for structure
- **Paragraph breaks**: Separate concepts with blank lines
- **Avoid huge blocks**: Split long paragraphs
- **Remove noise**: Clean up formatting artifacts

### 4. Incremental Updates

The upsert logic allows incremental updates:
1. Add new files to `data/knowledge/`
2. Run `npm run ingest`
3. Only new content is embedded (via chunk_hash)

### 5. Full Refresh

To completely refresh a source:
```typescript
// In ingest script, before processing:
await deleteDocumentsBySource(`file://${filePath}`);
```

## Troubleshooting

### "SUPABASE_SERVICE_ROLE is required"

**Cause**: Using anon key instead of service role.

**Fix**: Set `SUPABASE_SERVICE_ROLE` in `.env` with service role key from Supabase dashboard.

### "OpenAI API rate limit exceeded"

**Cause**: Too many requests too quickly.

**Fix**: Increase delay in `ingest.ts`:
```typescript
await new Promise(resolve => setTimeout(resolve, 500)); // 500ms
```

### "duplicate key value violates unique constraint"

**Cause**: This is expected behavior (deduplication working).

**Fix**: No action needed. The script counts these as "Skipped (duplicates)".

## Performance

### Benchmark

For 100 documents (~500 chunks):
- **Chunking**: ~1 second
- **Embedding**: ~50 seconds (100ms delay)
- **Upsert**: ~5 seconds
- **Total**: ~1 minute

### Optimization

For large datasets (>10k documents):
1. **Batch embeddings**:
   ```typescript
   const embeddings = await generateEmbeddings(chunks); // Batch API
   ```
2. **Parallel processing**:
   - Use Promise.all for independent files
   - Respect OpenAI rate limits
3. **Database batching**:
   - Batch inserts in groups of 100
