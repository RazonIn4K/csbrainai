import type { Metadata } from 'next';
import LaneDetail from '@/components/LaneDetail';
import { getLane } from '../lanes';

export const metadata: Metadata = {
  title: 'CS Knowledge Demo - CSBrainAI',
  description:
    'The live web lane: a curated computer-science corpus behind a rate-limited, prompt-guarded API with hashed-query telemetry.',
};

export default function CsLanePage() {
  return <LaneDetail lane={getLane('cs')} />;
}
