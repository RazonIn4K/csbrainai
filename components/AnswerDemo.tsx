'use client';

import { useState } from 'react';

interface Citation {
  source_url: string;
  content: string;
  similarity: number;
}

interface AnswerResponse {
  answer: string;
  citations: Citation[];
  q_hash: string;
  q_len: number;
  tokensUsed?: number;
}

export default function AnswerDemo() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AnswerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to get answer');
      }

      const data = await res.json();
      setResponse(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.inputGroup}>
          <label htmlFor="query" style={styles.label}>
            Ask a question:
          </label>
          <textarea
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., What is RAG and how does it work?"
            style={styles.textarea}
            rows={3}
            maxLength={1000}
          />
          <div style={styles.charCount}>
            {query.length} / 1000
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !query.trim()}
          style={{
            ...styles.button,
            ...(loading || !query.trim() ? styles.buttonDisabled : {}),
          }}
        >
          {loading ? '🤔 Thinking...' : '🚀 Ask'}
        </button>
      </form>

      {error && (
        <div style={styles.error}>
          <strong>❌ Error:</strong> {error}
        </div>
      )}

      {response && (
        <div style={styles.response}>
          <div style={styles.answer}>
            <h3 style={styles.sectionTitle}>💡 Answer</h3>
            <p style={styles.answerText}>{response.answer}</p>
          </div>

          {response.citations.length > 0 && (
            <div style={styles.citations}>
              <h3 style={styles.sectionTitle}>📚 Citations ({response.citations.length})</h3>
              {response.citations.map((citation, idx) => (
                <div key={idx} style={styles.citation}>
                  <div style={styles.citationHeader}>
                    <span style={styles.citationNumber}>#{idx + 1}</span>
                    <span style={styles.similarity}>
                      {(citation.similarity * 100).toFixed(1)}% match
                    </span>
                  </div>
                  <div style={styles.citationContent}>{citation.content}</div>
                  <div style={styles.citationSource}>
                    Source: {citation.source_url}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={styles.metadata}>
            <div style={styles.metadataItem}>
              <strong>Query Hash:</strong> <code>{response.q_hash.substring(0, 16)}...</code>
            </div>
            <div style={styles.metadataItem}>
              <strong>Query Length:</strong> {response.q_len} chars
            </div>
            {response.tokensUsed && (
              <div style={styles.metadataItem}>
                <strong>Tokens Used:</strong> {response.tokensUsed}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'white',
    borderRadius: '12px',
    padding: '2rem',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  },
  form: {
    marginBottom: '2rem',
  },
  inputGroup: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: '600',
    color: '#333',
  },
  textarea: {
    width: '100%',
    padding: '1rem',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '1rem',
    fontFamily: 'inherit',
    resize: 'vertical',
    transition: 'border-color 0.2s',
  },
  charCount: {
    textAlign: 'right',
    fontSize: '0.85rem',
    color: '#666',
    marginTop: '0.25rem',
  },
  button: {
    width: '100%',
    padding: '1rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  error: {
    padding: '1rem',
    background: '#fee',
    border: '2px solid #fcc',
    borderRadius: '8px',
    color: '#c33',
  },
  response: {
    marginTop: '2rem',
  },
  answer: {
    marginBottom: '2rem',
  },
  sectionTitle: {
    fontSize: '1.3rem',
    marginBottom: '1rem',
    color: '#333',
  },
  answerText: {
    fontSize: '1.1rem',
    lineHeight: '1.6',
    color: '#444',
  },
  citations: {
    marginBottom: '2rem',
  },
  citation: {
    padding: '1rem',
    background: '#f8f8f8',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    marginBottom: '1rem',
  },
  citationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  citationNumber: {
    fontWeight: '600',
    color: '#667eea',
  },
  similarity: {
    fontSize: '0.85rem',
    color: '#666',
    background: '#e8eaf6',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
  },
  citationContent: {
    fontSize: '0.95rem',
    lineHeight: '1.5',
    color: '#555',
    marginBottom: '0.5rem',
  },
  citationSource: {
    fontSize: '0.8rem',
    color: '#888',
    fontStyle: 'italic',
  },
  metadata: {
    padding: '1rem',
    background: '#f0f0f0',
    borderRadius: '6px',
    fontSize: '0.9rem',
  },
  metadataItem: {
    marginBottom: '0.5rem',
    color: '#555',
  },
};
