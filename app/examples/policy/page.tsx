import type { Metadata } from 'next';
import LaneDetail from '@/components/LaneDetail';
import { getLane } from '../lanes';

export const metadata: Metadata = {
  title: 'Policy & Compliance Assistant - CSBrainAI',
  description:
    'Config-driven RAG over policy PDFs: cited, audit-ready answers to access-control, retention, and escalation questions.',
};

export default function PolicyLanePage() {
  return <LaneDetail lane={getLane('policy')} />;
}
