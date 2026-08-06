'use client';

import { motion } from 'framer-motion';
import {
  Brain,
  MessageSquare,
  GitBranch,
  RefreshCw,
  Fuel,
  BarChart3,
  Bell,
  Shield,
} from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: Brain,
    title: 'AI Risk Analysis',
    description: 'Institutional-grade risk scoring across 50+ DeFi protocols. Real-time TVL, audit, and liquidity analysis.',
    highlight: 'Multi-factor scoring',
  },
  {
    icon: MessageSquare,
    title: 'Natural Language',
    description: 'Talk to Sixa like a human. "Move my USDC somewhere safer" — the AI understands intent and executes.',
    highlight: 'Intent-based execution',
  },
  {
    icon: GitBranch,
    title: 'Cross-chain Ready',
    description: 'Seamless yield optimization across Ethereum, Arbitrum, Optimism, Base, Polygon, and more via LayerZero.',
    highlight: '7+ networks supported',
  },
  {
    icon: RefreshCw,
    title: 'Auto Rebalancing',
    description: 'Set preferences once. Sixa continuously monitors and rebalances when better opportunities exceed your threshold.',
    highlight: 'Threshold-based triggers',
  },
  {
    icon: Fuel,
    title: 'Gas Optimization',
    description: 'Smart routing, batching, and timing to minimize gas costs. Average 40% gas savings vs manual execution.',
    highlight: 'MEV protection included',
  },
  {
    icon: BarChart3,
    title: 'Portfolio Monitoring',
    description: 'Real-time dashboard with P&L tracking, position health, and predictive alerts before opportunities expire.',
    highlight: 'Live analytics',
  },
  {
    icon: Bell,
    title: 'Smart Notifications',
    description: 'Get alerted only when it matters — new high-yield vaults, risk threshold breaches, or rebalancing opportunities.',
    highlight: 'Zero noise policy',
  },
  {
    icon: Shield,
    title: 'Secure by Design',
    description: 'Non-custodial, audited smart contracts, simulation before execution, and emergency pause controls.',
    highlight: 'SOC 2 Type II ready',
  },
];

export function Features() {
  return (
    <section
      id="features"
      className="relative py-24 md:py-32 lg:py-40 overflow-hidden"
      aria-labelledby="features-title"
    >
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-purple-500/10 to-pink-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <SectionTitle
          id="features-title"
          title="Built for Intelligence"
          subtitle="Every feature designed to give you an unfair advantage in DeFi yield."
          className="mb-16 lg:mb-20"
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <GlassPanel
                variant="default"
                padding="lg"
                hover
                className="h-full group relative overflow-hidden"
                whileHover={{ y: -8, boxShadow: '0 25px 50px -12px rgba(99, 102, 241, 0.15)' }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative z-10 space-y-5">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center group-hover:border-indigo-500/50 group-hover:bg-indigo-500/30 transition-all">
                    <feature.icon className="w-6 h-6 text-indigo-400" />
                  </div>

                  <h3 className="text-lg font-semibold text-foreground group-hover:text-white transition-colors">
                    {feature.title}
                  </h3>

                  <p className="text-secondary text-sm leading-relaxed">
                    {feature.description}
                  </p>

                  <div className="pt-4 border-t border-white/10">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
                      {feature.highlight}
                    </span>
                  </div>
                </div>
              </GlassPanel>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}