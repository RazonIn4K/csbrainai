import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CSBrainAI - Private RAG Workbench',
  description:
    'Privacy-first RAG workbench for technical teams: cited answers, hashed-query telemetry, an eval harness, and inspectable pgvector retrieval.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="site-footer">
          <span>
            Built by{' '}
            <a href="https://davidtiz.com" rel="author">
              David Ortiz
            </a>
            .
          </span>
        </footer>
      </body>
    </html>
  );
}
