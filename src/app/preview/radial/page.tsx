'use client';

import { useState } from 'react';
import { RadialBurst } from '@/components/RadialBurst';
import { Button } from '@/components/ui/Button';

const PREVIEW_ITEMS = [
  { label: 'Swap', color: '#0E9F6E' },
  { label: 'Bridge', color: '#0A0A0A' },
  { label: 'Stake', color: '#0E9F6E' },
  { label: 'Portfolio', color: '#0A0A0A' },
  { label: 'DCA', color: '#B45309' },
  { label: 'Audit', color: '#0E9F6E' },
];

export default function RadialPreviewPage() {
  const [replayKey, setReplayKey] = useState(0);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Radial burst preview</h1>
        <p className="mt-2 text-sm text-secondary">
          Mount animation · spring (stiffness 100, damping 15) · {PREVIEW_ITEMS.length} nodes · 60ms stagger
        </p>
      </div>

      <div className="w-full max-w-xl">
        <RadialBurst
          key={replayKey}
          items={PREVIEW_ITEMS}
          centerLabel="sixa"
          stagger={0.06}
          startDelay={0.1}
        />
      </div>

      <div className="flex gap-3">
        <Button onClick={() => setReplayKey((k) => k + 1)}>Replay</Button>
        <Button
          variant="secondary"
          onClick={() =>
            setReplayKey((k) => k + 1)
          }
        >
          Variant: 8 nodes
        </Button>
      </div>
    </main>
  );
}
