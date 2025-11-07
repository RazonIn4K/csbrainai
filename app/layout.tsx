import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CSBrainAI - RAG-Powered Q&A',
  description: 'Privacy-first RAG system with Supabase, pgvector, and Sentry',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
