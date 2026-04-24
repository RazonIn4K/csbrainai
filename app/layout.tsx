import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CSBrainAI - Private RAG Assistant',
  description:
    'A privacy-first computer science RAG assistant with citations, query hashing, and guarded telemetry.',
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
