export default function Home() {
  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">CSBrainAI</h1>
        <p className="text-xl text-gray-600 mb-8">
          Production-grade RAG system with privacy-first architecture
        </p>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Quick Start</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">1. Set up environment</h3>
              <code className="block bg-gray-100 p-3 rounded text-sm">
                cp .env.example .env.local
              </code>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">2. Install dependencies</h3>
              <code className="block bg-gray-100 p-3 rounded text-sm">
                npm install
              </code>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">3. Run database migration</h3>
              <code className="block bg-gray-100 p-3 rounded text-sm">
                npm run db:migrate
              </code>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">4. Ingest your data</h3>
              <code className="block bg-gray-100 p-3 rounded text-sm">
                npm run ingest
              </code>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">API Endpoint</h2>
          <p className="mb-4">POST /api/answer</p>
          <code className="block bg-gray-100 p-3 rounded text-sm overflow-x-auto">
            {`curl -X POST http://localhost:3000/api/answer \\
  -H "Content-Type: application/json" \\
  -d '{"query": "How do I get started?"}'`}
          </code>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2 text-blue-900">Privacy First</h2>
          <p className="text-blue-800">
            CSBrainAI never logs raw queries. We only store HMAC hashes and query lengths
            for analytics. All PII is scrubbed before reaching Sentry.
          </p>
        </div>

        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Built with Next.js, Supabase, pgvector, OpenAI, and Sentry</p>
          <p className="mt-2">
            <a href="/ARCHITECTURE.md" className="text-blue-600 hover:underline">
              Architecture Docs
            </a>
            {' • '}
            <a href="/data/getting-started.md" className="text-blue-600 hover:underline">
              Getting Started
            </a>
            {' • '}
            <a href="/data/api-reference.md" className="text-blue-600 hover:underline">
              API Reference
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
