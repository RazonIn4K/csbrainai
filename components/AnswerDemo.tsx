'use client';

import { useState, useEffect } from 'react';

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

interface ErrorResponse {
  error: {
    type: 'validation_error' | 'rate_limited' | 'internal_error' | 'service_unavailable';
    message: string;
    field?: string;
  };
  retryAfterSeconds?: number;
}

const EXAMPLE_QUESTIONS = [
  'What is RAG and how does it work?',
  'Explain the difference between symmetric and asymmetric encryption',
  'What are common SQL injection prevention techniques?',
];

export default function AnswerDemo() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AnswerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  // Countdown timer for rate limiting
  useEffect(() => {
    if (retryAfter === null || retryAfter <= 0) return;

    const timer = setInterval(() => {
      setRetryAfter((prev) => {
        if (prev === null || prev <= 1) {
          setError(null);
          setErrorType(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [retryAfter]);

  const handleExampleClick = (example: string) => {
    setQuery(example);
    setError(null);
    setErrorType(null);
    setResponse(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedQuery = query.trim();

    // Client-side validation
    if (!trimmedQuery) {
      setError('Please enter a question');
      setErrorType('validation_error');
      return;
    }

    if (trimmedQuery.length < 3) {
      setError('Query must be at least 3 characters');
      setErrorType('validation_error');
      return;
    }

    if (trimmedQuery.length > 1000) {
      setError('Query is too long (maximum 1000 characters)');
      setErrorType('validation_error');
      return;
    }

    setLoading(true);
    setError(null);
    setErrorType(null);
    setResponse(null);

    try {
      const res = await fetch('/api/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: trimmedQuery }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Parse structured error response
        const errorData = data as ErrorResponse;

        if (res.status === 429) {
          // Rate limited
          setErrorType('rate_limited');
          setRetryAfter(errorData.retryAfterSeconds || 60);
          setError(errorData.error?.message || 'Too many requests. Please try again later.');
        } else if (res.status === 503) {
          // Service unavailable
          setErrorType('service_unavailable');
          setError(errorData.error?.message || 'Service temporarily unavailable. Please try again later.');
        } else if (res.status === 400) {
          // Validation error
          setErrorType('validation_error');
          setError(errorData.error?.message || 'Invalid request');
        } else {
          // Internal error
          setErrorType('internal_error');
          setError(errorData.error?.message || 'Something went wrong. Please try again.');
        }
        return;
      }

      // Success
      setResponse(data);
    } catch (err: any) {
      console.error('Request failed:', err);
      setErrorType('internal_error');
      setError('Failed to connect to the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const getErrorStyle = () => {
    switch (errorType) {
      case 'validation_error':
        return styles.errorWarning;
      case 'rate_limited':
        return styles.errorRateLimit;
      case 'service_unavailable':
        return styles.errorServiceUnavailable;
      default:
        return styles.error;
    }
  };

  const getErrorIcon = () => {
    switch (errorType) {
      case 'validation_error':
        return '⚠️';
      case 'rate_limited':
        return '⏱️';
      case 'service_unavailable':
        return '🔧';
      default:
        return '❌';
    }
  };

  return (
    <div style={styles.container}>
      {/* Intro Section */}
      <div style={styles.intro}>
        <h2 style={styles.introTitle}>🧠 CSBrainAI</h2>
        <p style={styles.introText}>
          An AI assistant specialized in computer science and cybersecurity topics, powered by a{' '}
          <strong>privacy-first RAG</strong> (Retrieval Augmented Generation) pipeline. Ask technical
          questions and get answers backed by our curated knowledge base.
        </p>
        <div style={styles.examplesContainer}>
          <span style={styles.examplesLabel}>Try these examples:</span>
          <div style={styles.examples}>
            {EXAMPLE_QUESTIONS.map((example, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleExampleClick(example)}
                style={styles.exampleButton}
                disabled={loading}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>

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
            disabled={loading || (retryAfter !== null && retryAfter > 0)}
          />
          <div style={styles.charCount}>{query.length} / 1000</div>
        </div>

        <button
          type="submit"
          disabled={loading || !query.trim() || (retryAfter !== null && retryAfter > 0)}
          style={{
            ...styles.button,
            ...(loading || !query.trim() || (retryAfter !== null && retryAfter > 0)
              ? styles.buttonDisabled
              : {}),
          }}
        >
          {loading ? '🤔 Thinking...' : retryAfter ? `⏱️ Retry in ${retryAfter}s` : '🚀 Ask'}
        </button>
      </form>

      {error && (
        <div style={{ ...styles.errorBase, ...getErrorStyle() }}>
          <div style={styles.errorHeader}>
            <strong>
              {getErrorIcon()} {errorType === 'rate_limited' ? 'Rate Limited' : 'Error'}:
            </strong>
          </div>
          <div style={styles.errorMessage}>{error}</div>
          {retryAfter && retryAfter > 0 && (
            <div style={styles.errorRetry}>You can ask again in {retryAfter} seconds...</div>
          )}
          {errorType === 'internal_error' && (
            <button
              onClick={() => {
                setError(null);
                setErrorType(null);
              }}
              style={styles.retryButton}
            >
              Dismiss
            </button>
          )}
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
                  <div style={styles.citationSource}>Source: {citation.source_url}</div>
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
  intro: {
    marginBottom: '2rem',
    paddingBottom: '1.5rem',
    borderBottom: '2px solid #f0f0f0',
  },
  introTitle: {
    fontSize: '1.8rem',
    fontWeight: '700',
    color: '#333',
    marginBottom: '0.5rem',
    marginTop: 0,
  },
  introText: {
    fontSize: '1rem',
    lineHeight: '1.6',
    color: '#555',
    marginBottom: '1rem',
  },
  examplesContainer: {
    marginTop: '1rem',
  },
  examplesLabel: {
    fontSize: '0.9rem',
    color: '#666',
    fontWeight: '600',
    display: 'block',
    marginBottom: '0.5rem',
  },
  examples: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  exampleButton: {
    padding: '0.75rem 1rem',
    background: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    fontSize: '0.9rem',
    color: '#495057',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left',
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
  errorBase: {
    padding: '1rem',
    borderRadius: '8px',
    marginBottom: '1rem',
  },
  error: {
    background: '#fee',
    border: '2px solid #fcc',
    color: '#c33',
  },
  errorWarning: {
    background: '#fff3cd',
    border: '2px solid #ffc107',
    color: '#856404',
  },
  errorRateLimit: {
    background: '#fff3e0',
    border: '2px solid #ff9800',
    color: '#e65100',
  },
  errorServiceUnavailable: {
    background: '#f5f5f5',
    border: '2px solid #9e9e9e',
    color: '#424242',
  },
  errorHeader: {
    marginBottom: '0.5rem',
  },
  errorMessage: {
    fontSize: '0.95rem',
  },
  errorRetry: {
    fontSize: '0.9rem',
    marginTop: '0.5rem',
    fontStyle: 'italic',
  },
  retryButton: {
    marginTop: '0.75rem',
    padding: '0.5rem 1rem',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '0.9rem',
    cursor: 'pointer',
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
