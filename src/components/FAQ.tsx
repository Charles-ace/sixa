'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { cn } from '@/lib/utils';

const faqs = [
  {
    question: "How does Sixa find the best yield opportunities?",
    answer: "Sixa's AI continuously monitors 50+ DeFi protocols across 7+ chains, analyzing TVL, audit scores, historical reliability, liquidity depth, smart contract risk, and APY sustainability. It scores every opportunity in real-time and recommends only those that meet your risk threshold.",
  },
  {
    question: "Is Sixa custodial? Do you hold my funds?",
    answer: "No. Sixa is completely non-custodial. Your assets remain in your wallet at all times. Sixa only constructs and simulates transactions — you approve and sign every execution. We never have access to your private keys or funds.",
  },
  {
    question: "What chains and protocols are supported?",
    answer: "Currently: Ethereum, Arbitrum, Optimism, Base, Polygon, Avalanche, and BSC. Protocols include Aave v3, Morpho, Spark, Compound v3, Lido, Pendle, and more. We're adding new chains and protocols monthly.",
  },
  {
    question: "How does gas optimization work?",
    answer: "Sixa uses smart routing, transaction batching, optimal timing, and MEV protection to minimize gas costs. For cross-chain moves, it routes through LayerZero with automatic path finding. Average gas savings: 40% vs manual execution.",
  },
  {
    question: "Can I set custom risk preferences?",
    answer: "Yes. Define your risk tolerance (1-10), max protocol TVL minimum, required audit status, preferred chains, and rebalance thresholds. Sixa will only recommend opportunities matching your criteria.",
  },
  {
    question: "What happens during a protocol emergency?",
    answer: "Sixa monitors for depegs, exploits, and governance attacks in real-time. If a position exceeds your risk threshold, you'll get an instant notification with a one-click exit transaction pre-built and gas-optimized.",
  },
  {
    question: "How much does Sixa cost?",
    answer: "Free tier: Portfolio analysis, risk scoring, and 3 optimizations/month. Pro: $29/month for unlimited optimizations, auto-rebalancing, priority support, and advanced analytics. Enterprise: Custom pricing for funds and institutions.",
  },
  {
    question: "Is the smart contract audited?",
    answer: "Yes. Sixa's core contracts are audited by Trail of Bits and OpenZeppelin. Audit reports are public. We also run a $100k bug bounty program on Immunefi. All execution contracts are upgradeable with timelock and multisig governance.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section
      id="faq"
      className="relative py-24 md:py-32 lg:py-40 overflow-hidden"
      aria-labelledby="faq-title"
    >
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-6">
        <SectionTitle
          id="faq-title"
          title="Frequently Asked Questions"
          subtitle="Everything you need to know about Sixa."
          className="mb-12 lg:mb-16"
        />

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
            >
              <GlassPanel variant="default" padding="none" className="overflow-hidden">
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-expanded={openIndex === index}
                  aria-controls={`faq-answer-${index}`}
                >
                  <span className="text-foreground font-medium pr-10">{faq.question}</span>
                  <motion.div
                    animate={{ rotate: openIndex === index ? 180 : 0 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-secondary"
                  >
                    {openIndex === index ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </motion.div>
                </button>

                <AnimatePresence>
                  {openIndex === index && (
                    <motion.div
                      id={`faq-answer-${index}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 pt-0 border-t border-white/10">
                        <p className="text-secondary leading-relaxed">{faq.answer}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassPanel>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
          className="mt-12 text-center"
        >
          <p className="text-secondary mb-4">Still have questions?</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="mailto:hello@sixa.xyz" className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:shadow-lg hover:shadow-indigo-500/20 transition-all">
              Email Us
            </a>
            <a href="https://discord.gg/sixa" target="_blank" rel="noopener noreferrer" className="px-6 py-3 rounded-xl bg-white/5 border border-border text-secondary hover:text-foreground hover:border-border hover:bg-white/10 font-medium transition-all">
              Join Discord
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}