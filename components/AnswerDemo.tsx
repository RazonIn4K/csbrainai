'use client';

import { useEffect, useState, type FormEvent } from 'react';

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

const ERROR_TITLES: Record<string, string> = {
  validation_error: 'Check the question',
  rate_limited: 'Rate limited',
  service_unavailable: 'Service unavailable',
  internal_error: 'Request failed',
};

export default function AnswerDemo() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AnswerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setError('Please enter a question.');
      setErrorType('validation_error');
      return;
    }

    if (trimmedQuery.length < 3) {
      setError('Query must be at least 3 characters.');
      setErrorType('validation_error');
      return;
    }

    if (trimmedQuery.length > 1000) {
      setError('Query is too long. Keep it under 1000 characters.');
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
        const errorData = data as ErrorResponse;

        if (res.status === 429) {
          setErrorType('rate_limited');
          setRetryAfter(errorData.retryAfterSeconds || 60);
          setError(errorData.error?.message || 'Too many requests. Please try again later.');
        } else if (res.status === 503) {
          setErrorType('service_unavailable');
          setError(errorData.error?.message || 'Service temporarily unavailable.');
        } else if (res.status === 400) {
          setErrorType('validation_error');
          setError(errorData.error?.message || 'Invalid request.');
        } else {
          setErrorType('internal_error');
          setError(errorData.error?.message || 'Something went wrong. Please try again.');
        }

        return;
      }

      setResponse(data);
    } catch (err: unknown) {
      console.error('Request failed:', err);
      setErrorType('internal_error');
      setError('Failed to connect to the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || !query.trim() || (retryAfter !== null && retryAfter > 0);
  const statusLabel = loading
    ? 'Searching knowledge base...'
    : retryAfter
      ? `Retry in ${retryAfter}s`
      : 'Ask CSBrainAI';
  const errorTitle = errorType ? ERROR_TITLES[errorType] || 'Request failed' : 'Request failed';

  return (
    <div className="answer-demo">
      <div className="demo-intro">
        <div>
          <p className="panel-label">Question input</p>
          <h3>Start with a focused technical question.</h3>
        </div>
        <p>
          The demo accepts short or detailed prompts and returns a cited answer when the backing
          services are available.
        </p>
      </div>

      <div className="example-row" aria-label="Example questions">
        {EXAMPLE_QUESTIONS.map((example) => (
          <button
            className="example-button"
            disabled={loading}
            key={example}
            onClick={() => handleExampleClick(example)}
            type="button"
          >
            {example}
          </button>
        ))}
      </div>

      <form className="question-form" onSubmit={handleSubmit}>
        <label htmlFor="query">Question</label>
        <textarea
          disabled={loading || (retryAfter !== null && retryAfter > 0)}
          id="query"
          maxLength={1000}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Example: What is retrieval augmented generation?"
          rows={4}
          value={query}
        />
        <div className="form-footer">
          <span>{query.length} / 1000</span>
          <button className="submit-button" disabled={disabled} type="submit">
            {statusLabel}
          </button>
        </div>
      </form>

      {error && (
        <div className={`error-panel error-panel-${errorType || 'default'}`} role="alert">
          <div>
            <strong>{errorTitle}</strong>
            <p>{error}</p>
          </div>
          {retryAfter && retryAfter > 0 && <span>You can ask again in {retryAfter} seconds.</span>}
          {errorType === 'internal_error' && (
            <button
              className="dismiss-button"
              onClick={() => {
                setError(null);
                setErrorType(null);
              }}
              type="button"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {response && (
        <section className="response-panel" aria-label="Answer result">
          <div className="answer-block">
            <p className="panel-label">Answer</p>
            <p>{response.answer}</p>
          </div>

          {response.citations.length > 0 && (
            <div className="citation-list">
              <div className="response-heading">
                <p className="panel-label">Citations</p>
                <span>{response.citations.length} sources</span>
              </div>
              {response.citations.map((citation, index) => (
                <article className="citation-item" key={`${citation.source_url}-${index}`}>
                  <div className="citation-meta">
                    <strong>Source {index + 1}</strong>
                    <span>{(citation.similarity * 100).toFixed(1)}% match</span>
                  </div>
                  <p>{citation.content}</p>
                  <span className="citation-source">{citation.source_url}</span>
                </article>
              ))}
            </div>
          )}

          <dl className="metadata-grid">
            <div>
              <dt>Query Hash</dt>
              <dd>
                <code>{response.q_hash.substring(0, 16)}...</code>
              </dd>
            </div>
            <div>
              <dt>Query Length</dt>
              <dd>{response.q_len} chars</dd>
            </div>
            {response.tokensUsed && (
              <div>
                <dt>Tokens Used</dt>
                <dd>{response.tokensUsed}</dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </div>
  );
}
