import type { Metadata } from 'next';
import LaneDetail from '@/components/LaneDetail';
import { getLane } from '../lanes';

export const metadata: Metadata = {
  title: 'PDF Finance Assistant - CSBrainAI',
  description:
    'PDF-to-Q&A workflow for earnings transcripts: cited answers on revenue guidance, risk factors, and capital allocation.',
};

export default function FinanceLanePage() {
  return <LaneDetail lane={getLane('finance')} />;
}
