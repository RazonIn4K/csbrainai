# API Reference

Complete reference for the CSBrainAI REST API.

## Base URL

- **Development:** `http://localhost:3000`
- **Production:** `https://csbrainai.com` (configure your domain)

## Authentication

Currently, the API is open (rate-limited). For production deployments, consider adding:
- API key authentication
- JWT tokens
- OAuth 2.0

## Endpoints

### POST /api/answer

Generate an answer to a user question using RAG (Retrieval Augmented Generation).

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "query": "string (required, 1-1000 characters)"
}
```

**Response (200 OK):**
```json
{
  "answer": "string - AI-generated answer",
  "citations": [
    {
      "source_url": "string - source document",
      "snippet": "string - relevant excerpt"
    }
  ],
  "q_hash": "string - HMAC-SHA256 hash of query",
  "q_len": "number - query length",
  "model": "string - LLM model used"
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "error": "Invalid request",
  "message": "Query is required and must be 1-1000 characters"
}
```

**429 Too Many Requests:**
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later.",
  "retry_after": 60
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error",
  "message": "An error occurred processing your request"
}
```

## Rate Limiting

- **Limit:** 10 requests per minute per IP
- **Window:** 60 seconds (sliding)
- **Headers:** `Retry-After` header included in 429 responses

## Query Privacy

CSBrainAI never stores raw query text. We only store:
- `q_hash`: HMAC-SHA256 hash using secret salt
- `q_len`: Query length (integer)

This allows us to track usage patterns and debug issues without compromising user privacy.

## Example Usage

### cURL

```bash
curl -X POST http://localhost:3000/api/answer \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I use the API?"}'
```

### JavaScript (Fetch)

```javascript
const response = await fetch('/api/answer', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: 'How do I use the API?'
  })
});

const data = await response.json();
console.log(data.answer);
```

### Python (requests)

```python
import requests

response = requests.post(
    'http://localhost:3000/api/answer',
    json={'query': 'How do I use the API?'}
)

data = response.json()
print(data['answer'])
```

## Best Practices

1. **Keep queries concise**: 1-200 words optimal
2. **Check rate limits**: Implement exponential backoff
3. **Handle errors gracefully**: Parse error messages for user feedback
4. **Cache responses**: Reduce API calls for repeated queries
5. **Validate input**: Sanitize queries before sending

## Monitoring

All API requests are monitored via Sentry with:
- Response time tracking
- Error rate monitoring
- Query metadata (hash/length only)

Personal information is NEVER logged.

## Support

For issues or questions:
- Check the [FAQ](data/faq.txt)
- Review [SECURITY.md](policies/SECURITY.md)
- Submit an issue on GitHub
