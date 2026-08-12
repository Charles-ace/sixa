'use client';

import { useEffect, useRef, useState } from 'react';
import { History } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuditEvent } from '@/lib/broker/types';

const EVENT_TONE: Record<string, 'ok' | 'warn' | 'err' | 'info'> = {
  job_created: 'info',
  intent_parsed: 'info',
  catalog_searched: 'info',
  candidate_found: 'info',
  selection_made: 'info',
  quote_received: 'warn',
  payment_made: 'ok',
  payment_simulated: 'warn',
  payment_verified: 'ok',
  payment_unverified: 'err',
  payment_reverted: 'err',
  execution_requested: 'info',
  execution_polled: 'info',
  execution_completed: 'ok',
  verification_passed: 'ok',
  verification_failed: 'err',
  fallback_started: 'warn',
  fallback_generation: 'warn',
  fallback_executed: 'err',
  candidate_failed: 'err',
  job_completed: 'ok',
  job_failed: 'err',
};

export function BrokerAuditLog({ jobId, initialEvents = [] }: { jobId: string; initialEvents?: AuditEvent[] }) {
  const [polled, setPolled] = useState<AuditEvent[]>([]);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastPolledSignature = useRef('');
  const hasParentTrail = useRef(false);

  useEffect(() => {
    hasParentTrail.current = (initialEvents?.length ?? 0) > 0;
  }, [initialEvents]);

  // The parent (BrokerJobView) polls the job every 3s and re-renders with a
  // fresh `initialEvents` on every audit push — that trail is authoritative
  // and live, with ZERO extra requests. The endpoint poll below is only a
  // fallback for job views that do not supply a trail.
  const events = (initialEvents?.length ?? 0) > 0 ? initialEvents : polled;

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (hasParentTrail.current) return;
      try {
        const res = await fetch(`/api/broker/jobs/${jobId}/audit`);
        if (!res.ok) return;
        const data = await res.json();
        const next: AuditEvent[] = Array.isArray(data.audit) ? data.audit : [];
        if (next.length === 0) return;
        const signature = next.map((e) => `${e.id}:${e.type}:${e.timestamp}`).join('|');
        if (!cancelled && signature !== lastPolledSignature.current) {
          lastPolledSignature.current = signature;
          setPolled(next);
        }
      } catch {
        // keep polling
      }
    };
    void poll();
    const id = setInterval(() => void poll(), 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [jobId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedToBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [events.length, pinnedToBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setPinnedToBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
  };

  if (events.length === 0) {
    return (
      <div className="rounded-2xl bg-surface/60 border border-border backdrop-blur-xl p-8 text-center">
        <History className="w-8 h-8 text-secondary mx-auto mb-3" />
        <p className="text-sm text-secondary">No audit events yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface/60 border border-border backdrop-blur-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <History className="w-4 h-4 text-foreground" />
        <h3 className="text-sm font-medium text-foreground">Audit trail</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-black/5 text-foreground border border-black/15">{events.length}</span>
      </div>
      <div ref={scrollRef} onScroll={handleScroll} className="h-[420px] overflow-y-auto divide-y divide-black/[0.06]">
        {events.map((event) => {
          const tone = EVENT_TONE[event.type] ?? 'info';
          return (
            <div key={event.id} className="px-5 py-3">
              <div className="flex items-center gap-2">
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', tone === 'ok' ? 'bg-success' : tone === 'err' ? 'bg-error' : tone === 'warn' ? 'bg-warning' : 'bg-secondary/50')} />
                <span className="text-xs font-medium text-foreground">{event.type.replace(/_/g, ' ')}</span>
                <span className="text-[10px] text-secondary/50 ml-auto shrink-0">{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              <p className="text-xs text-secondary mt-1">{event.message}</p>
              {event.data && Object.keys(event.data).length > 0 && (
                <p className="text-[10px] font-mono text-secondary/60 mt-1 break-all">{JSON.stringify(event.data).slice(0, 300)}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}