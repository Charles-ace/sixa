'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface RadialBurstItem {
  label: string;
  color?: string;
}

export interface RadialBurstProps {
  /** Child nodes placed radially around the center. */
  items?: RadialBurstItem[];
  /** Label shown under the center node. */
  centerLabel?: string;
  /** Custom center content (overrides the default logo mark + label). */
  centerContent?: ReactNode;
  className?: string;
  /** Stroke color for connector lines. Per-item `color` overrides this. */
  lineColor?: string;
  /** Seconds between each child's entrance (~0.05–0.08 feels natural). */
  stagger?: number;
  /** Seconds before the center node appears. */
  startDelay?: number;
  /** Trigger on scroll-into-view instead of on mount. */
  animateOnView?: boolean;
}

const DEFAULT_ITEMS: RadialBurstItem[] = [
  { label: 'Swap' },
  { label: 'Bridge' },
  { label: 'Stake' },
  { label: 'Portfolio' },
  { label: 'DCA' },
  { label: 'Audit' },
];

const centerVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  show: { opacity: 1, scale: 1 },
};

const nodeVariants: Variants = {
  hidden: { opacity: 0, scale: 0.4, y: 10 },
  show: { opacity: 1, scale: 1, y: 0 },
};

const lineVariants: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  show: { pathLength: 1, opacity: 1 },
};

export function RadialBurst({
  items = DEFAULT_ITEMS,
  centerLabel = 'sixa',
  centerContent,
  className,
  lineColor = 'rgba(10, 10, 10, 0.14)',
  stagger = 0.06,
  startDelay = 0.1,
  animateOnView = false,
}: RadialBurstProps) {
  const count = items.length;
  const radius = count <= 6 ? 41 : 37;

  const positions = items.map((_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return {
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
    };
  });

  return (
    <motion.div
      className={cn('relative aspect-square w-full', className)}
      initial="hidden"
      {...(animateOnView
        ? { whileInView: 'show', viewport: { once: true, amount: 0.5 } }
        : { animate: 'show' })}
      role="img"
      aria-label={`${centerLabel} radial burst with ${count} capabilities`}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden="true"
      >
        {positions.map((pos, i) => (
          <motion.line
            key={`line-${items[i].label}`}
            variants={lineVariants}
            x1="50"
            y1="50"
            x2={pos.x}
            y2={pos.y}
            stroke={items[i].color ?? lineColor}
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <motion.div
        variants={centerVariants}
        transition={{ delay: startDelay, type: 'spring', stiffness: 100, damping: 15 }}
        className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
      >
        {centerContent ?? (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground shadow-[0_12px_32px_-12px_rgba(0,0,0,0.35)]">
              <Image
                src="/sixa-logo.svg"
                alt=""
                aria-hidden="true"
                width={64}
                height={64}
                priority
                className="h-14 w-14"
              />
            </div>
            <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-secondary">
              {centerLabel}
            </span>
          </>
        )}
      </motion.div>

      {items.map((item, i) => (
        <motion.div
          key={item.label}
          className="absolute inset-0"
          variants={{
            hidden: {},
            show: { transition: { delayChildren: startDelay + i * stagger } },
          }}
        >
          <motion.div
            variants={nodeVariants}
            transition={{ type: 'spring', stiffness: 100, damping: 15 }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${positions[i].x}%`, top: `${positions[i].y}%` }}
          >
            <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.08)] whitespace-nowrap">
              <span
                className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color ?? '#0A0A0A' }}
              />
              <span className="text-xs font-mono text-foreground">{item.label}</span>
            </div>
          </motion.div>
        </motion.div>
      ))}
    </motion.div>
  );
}
