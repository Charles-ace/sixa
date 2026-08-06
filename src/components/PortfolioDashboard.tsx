'use client';

import { motion } from 'framer-motion';
import {
  Wallet,
  TrendingUp,
  Target,
  Layers,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { cn, formatCurrency } from '@/lib/utils';

const portfolioCards = [
  { label: 'Wallet Balance', value: 124567.89, prefix: '$', change: '+2.4%', changeType: 'positive', icon: Wallet },
  { label: 'Yield Earned (30d)', value: 1247.50, prefix: '$', change: '+18.2%', changeType: 'positive', icon: TrendingUp },
  { label: 'Best Opportunity', value: 8.7, prefix: '', suffix: '% APY', change: 'Morpho USDC', changeType: 'neutral', icon: Target },
  { label: 'Active Positions', value: 7, prefix: '', change: '3 optimized', changeType: 'positive', icon: Layers },
];

const recentTransactions = [
  { type: 'Optimize', protocol: 'Morpho', asset: 'USDC', amount: 15000, from: '4.2%', to: '6.8%', status: 'confirmed', time: '2h ago', icon: ArrowUpRight },
  { type: 'Rebalance', protocol: 'Aave', asset: 'USDC', amount: 8000, from: '3.8%', to: '5.1%', status: 'confirmed', time: '1d ago', icon: ArrowUpRight },
  { type: 'Deposit', protocol: 'Spark', asset: 'USDC', amount: 25000, from: '', to: '5.4%', status: 'confirmed', time: '3d ago', icon: ArrowDownRight },
  { type: 'Claim', protocol: 'Lido', asset: 'stETH', amount: 2.4, from: '', to: '3.2%', status: 'pending', time: '5d ago', icon: Activity },
];

const protocols = [
  { name: 'Morpho', apy: 6.8, tvl: 2.4, risk: 2, allocation: 35, color: 'from-blue-500 to-blue-600' },
  { name: 'Aave v3', apy: 5.1, tvl: 12.8, risk: 1, allocation: 25, color: 'from-indigo-500 to-purple-600' },
  { name: 'Spark', apy: 5.4, tvl: 8.1, risk: 2, allocation: 20, color: 'from-purple-500 to-pink-500' },
  { name: 'Lido', apy: 3.2, tvl: 28.5, risk: 1, allocation: 12, color: 'from-green-500 to-emerald-500' },
  { name: 'Pendle', apy: 8.7, tvl: 1.2, risk: 4, allocation: 8, color: 'from-amber-500 to-orange-500' },
];

export function PortfolioDashboard() {
  return (
    <section
      id="dashboard"
      className="relative py-24 md:py-32 lg:py-40 overflow-hidden"
      aria-labelledby="dashboard-title"
    >
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-t from-indigo-500/10 to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <SectionTitle
          id="dashboard-title"
          title="Portfolio Dashboard"
          subtitle="Real-time view of your optimized positions across all protocols."
          className="mb-12 lg:mb-16"
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {portfolioCards.map((card, index) => (
            <motion.article
              key={card.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <GlassPanel variant="default" padding="lg" hover className="h-full">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-secondary uppercase tracking-wider mb-2">{card.label}</p>
                    <div className="flex items-baseline gap-1">
                      <AnimatedCounter
                        value={card.value}
                        decimals={card.suffix ? 1 : 2}
                        prefix={card.prefix}
                        suffix={card.suffix}
                        duration={1500}
                        className="text-2xl lg:text-3xl font-bold font-mono tabular-nums"
                      />
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                    <card.icon className="w-6 h-6 text-indigo-400" />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                  <span className={cn(
                    'text-sm font-medium flex items-center gap-1',
                    card.changeType === 'positive' && 'text-success',
                    card.changeType === 'negative' && 'text-error',
                    card.changeType === 'neutral' && 'text-secondary'
                  )}>
                    {card.changeType === 'positive' && <ArrowUpRight className="w-3.5 h-3.5" />}
                    {card.changeType === 'negative' && <ArrowDownRight className="w-3.5 h-3.5" />}
                    {card.change}
                  </span>
                  <span className="text-xs text-secondary">vs 30d ago</span>
                </div>
              </GlassPanel>
            </motion.article>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <GlassPanel variant="default" padding="lg" className="h-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Protocol Allocation</h3>
                <span className="text-xs text-secondary">Live</span>
              </div>
              
              <div className="space-y-4">
                {protocols.map((protocol, index) => (
                  <motion.div
                    key={protocol.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.08 }}
                    className="group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', `bg-gradient-to-br ${protocol.color}`)}>
                          <span className="text-white text-xs font-bold">{protocol.name.slice(0, 2).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{protocol.name}</p>
                          <p className="text-xs text-secondary">{protocol.apy}% APY • ${protocol.tvl}B TVL</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">{protocol.allocation}%</p>
                        <p className="text-xs text-secondary">Allocation</p>
                      </div>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${protocol.allocation}%` }}
                        transition={{ duration: 1, delay: 0.5 + index * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className={cn('h-full rounded-full bg-gradient-to-r', `bg-gradient-to-r ${protocol.color}`)}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-secondary">Risk: {'●'.repeat(protocol.risk)}{'○'.repeat(5 - protocol.risk)}</span>
                      <span className="text-xs font-medium text-indigo-400">Optimized</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </GlassPanel>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
          >
            <GlassPanel variant="default" padding="lg" className="h-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Recent Transactions</h3>
                <span className="text-xs text-secondary">Last 7 days</span>
              </div>
              
              <div className="space-y-4">
                {recentTransactions.map((tx, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + index * 0.08 }}
                    className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10 hover:border-indigo-500/30 hover:bg-white/10 transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                      <tx.icon className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{tx.type}</span>
                        <span className="text-secondary text-sm">{tx.protocol}</span>
                      </div>
                      <p className="text-sm text-secondary truncate">
                        {tx.asset} {tx.amount ? `${tx.amount.toLocaleString()} ${tx.from ? `(${tx.from} → ${tx.to})` : `→ ${tx.to}`}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <span className={cn(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        tx.status === 'confirmed' && 'bg-success/20 text-success',
                        tx.status === 'pending' && 'bg-warning/20 text-warning'
                      )}>
                        {tx.status}
                      </span>
                      <span className="text-xs text-secondary font-mono">{tx.time}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </GlassPanel>
          </motion.div>
        </div>
      </div>
    </section>
  );
}