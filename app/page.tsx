import AnswerDemo from '@/components/AnswerDemo';

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '3rem', color: 'white', marginBottom: '1rem' }}>
            CSBrainAI
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.9)' }}>
            Privacy-First RAG System
          </p>
          <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', marginTop: '0.5rem' }}>
            Powered by Supabase + pgvector | OpenAI | Sentry
          </p>
        </header>

        <AnswerDemo />

        <footer style={{ textAlign: 'center', marginTop: '4rem', color: 'rgba(255,255,255,0.7)' }}>
          <p style={{ fontSize: '0.9rem' }}>
            🔒 Privacy-First: Queries are hashed (HMAC-SHA256) before logging
          </p>
          <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Rate Limited: 10 requests/min | L5 Tool: Sentry
          </p>
        </footer>
      </div>
    </main>
  );
}
