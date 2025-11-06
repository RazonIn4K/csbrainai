import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CSBrainAI - Privacy-First RAG System',
  description: 'Production-grade Retrieval Augmented Generation with Supabase pgvector and OpenAI',
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
