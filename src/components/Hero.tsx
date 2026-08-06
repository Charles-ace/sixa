'use client';

import { motion } from 'framer-motion';
import { Wallet, TrendingUp, Shield, Zap, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { LetterReveal } from '@/components/ui/LetterReveal';
import { cn } from '@/lib/utils';

const dashboardStats = [
  { label: 'Portfolio Value', value: 124567.89, prefix: '$', suffix: '', decimals: 2, icon: Wallet },
  { label: 'Idle Assets', value: 23400.00, prefix: '$', suffix: '', decimals: 2, icon: TrendingUp },
  { label: 'Current APY', value: 4.2, prefix: '', suffix: '%', decimals: 1, icon: Shield },
  { label: 'Recommended APY', value: 8.7, prefix: '', suffix: '%', decimals: 1, icon: Zap },
  { label: 'Est. Extra Earnings', value: 1054.20, prefix: '$', suffix: '/yr', decimals: 2, icon: ExternalLink },
];

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 via-transparent to-purple-500/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(99,102,241,0.15)_0%,transparent_50%),radial-gradient(ellipse_60%_50%_at_80%_100%,rgba(139,92,246,0.1)_0%,transparent_50%)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="flex items-center justify-center lg:justify-start gap-2 mb-6"
            >
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                AI Online
              </motion.span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-6"
            >
              <LetterReveal
                text="Your Idle Assets"
                as="h1"
                className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground leading-[1.1]"
                delay={0}
                stagger={0.035}
                duration={0.55}
              />
              <br />
              <LetterReveal
                text="Deserve Better."
                as="h1"
                className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight gradient-text leading-[1.1]"
                delay={0.15}
                stagger={0.035}
                duration={0.55}
              />
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="text-lg md:text-xl text-secondary max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed"
            >
              Sixa continuously analyzes DeFi markets, evaluates risk, and recommends or executes the highest-quality yield opportunities.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.0 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
            >
              <Button size="lg" className="w-full sm:w-auto gap-2" onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}>
                Connect Wallet
                <ExternalLink className="w-4 h-4" />
              </Button>
              <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}>
                Try Demo
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.2 }}
              className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-secondary"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-success" />
                <span>Non-custodial</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-warning" />
                <span>Gas optimized</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <span>Cross-chain ready</span>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4, type: 'spring', damping: 15 }}
            className="relative"
          >
            <GlassPanel variant="strong" blur="2xl" padding="none" className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10" />
              
              <div className="relative p-6 lg:p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-secondary uppercase tracking-wider">Live Dashboard</h3>
                  <div className="flex items-center gap-1.5 text-xs text-secondary">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Live
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                  {dashboardStats.map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.6 + index * 0.08 }}
                      className="relative bg-white/5 rounded-xl p-4 lg:p-5 border border-white/10 hover:border-indigo-500/30 hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center">
                          <stat.icon className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                          <p className="text-xs text-secondary uppercase tracking-wider">{stat.label}</p>
                        </div>
                      </div>
                      <div className="font-mono text-2xl lg:text-3xl font-bold text-foreground">
                        <AnimatedCounter
                          value={stat.value}
                          decimals={stat.decimals}
                          prefix={stat.prefix}
                          suffix={stat.suffix}
                          duration={1500}
                          delay={index * 100}
                          className="tabular-nums"
                        />
                      </div>
                      {stat.label === 'Recommended APY' && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 1.5, type: 'spring' }}
                          className="absolute -top-2 -right-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-medium px-2 py-1 rounded-full"
                        >
                          +107%
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>

                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-secondary">Portfolio Allocation</span>
                    <span className="text-sm font-medium text-foreground">+12.4% 30d</span>
                  </div>
                  <div className="h-20 lg:h-24 relative">
                    <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="chartStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="50%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,100 Q50,60 100,70 Q150,80 200,50 Q250,20 300,40 Q350,60 400,50"
                        stroke="url(#chartStroke)"
                        strokeWidth="2.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="path"
                      />
                      <path
                        d="M0,100 Q50,60 100,70 Q150,80 200,50 Q250,20 300,40 Q350,60 400,50 L400,120 L0,120 Z"
                        fill="url(#chartGradient)"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </GlassPanel>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.2, type: 'spring' }}
              className="absolute -bottom-6 -left-6 w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 opacity-30 blur-2xl animate-float"
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.4, type: 'spring' }}
              className="absolute -top-6 -right-6 w-32 h-32 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 opacity-20 blur-2xl animate-float"
              style={{ animationDelay: '2s' }}
              aria-hidden="true"
            />
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.0, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-secondary animate-bounce"
        aria-hidden="true"
      >
        <p className="text-xs uppercase tracking-wider">Scroll to explore</p>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </motion.div>
    </section>
  );
}