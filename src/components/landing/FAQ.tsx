'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqs = [
  {
    q: 'What is an intent broker?',
    a: 'Sixa brokers your goals against the live KeeperHub marketplace: it searches for listings that match your intent, selects the best fit within your budget cap, settles the x402 payment in USDC, executes the job, and independently verifies the result against KeeperHub\u2019s own execution status. Every step lands in your audit trail.',
  },
  {
    q: 'Can Sixa take my money?',
    a: 'No. The broker works inside a budget cap you set per job, payments are quoted up-front in USDC, and the execution layer never holds keys. If a relay disappears, your assets stay in your wallet, untouched.',
  },
  {
    q: 'What happens if you disappear?',
    a: 'Nothing to your funds. The broker is a browser app and KeeperHub is a stateless relay. If both vanish, your balances remain on-chain exactly as they are, and your audit trail can be exported.',
  },
  {
    q: 'What does it cost?',
    a: 'Marketplace listings are quoted per call in USDC — you set a budget cap and the broker only selects listings inside it. The assistant itself is free. On-chain transactions carry the standard gas fee, estimated up-front.',
  },
  {
    q: 'What is a keeper?',
    a: 'A keeper is a service listing on the KeeperHub marketplace that fulfills a job — for a price, executed on-chain. Sixa verifies the outcome against KeeperHub\u2019s execution status before marking a job complete.',
  },
  {
    q: 'Do I need to sign up or connect a wallet to try it?',
    a: 'Neither. The broker runs as a guest with simulated x402 payments so you can watch the full lifecycle — discover, select, pay, execute, verify. Sign in (email or Google) or connect a wallet only when you want real payments and KeeperHub account-scoped execution.',
  },
  {
    q: 'How does the agent decide what to do?',
    a: 'A deterministic intent parser maps your goal (swap, bridge, stake, snapshot, workflow, and more), then an LLM explains the plan. The parsed intent and the matched listing are always shown before anything moves — you approve every step.',
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-20 md:py-28 border-t border-black/10">
      <div className="mx-auto max-w-3xl px-6">
        <p className="section-label">sixa · faq</p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-6xl font-bold tracking-tight text-balance mb-12"
        >
          FAQ
        </motion.h2>

        <div className="divide-y divide-black/10 border-y border-black/10">
          {faqs.map((faq, index) => {
            const isOpen = open === index;
            return (
              <motion.div
                key={faq.q}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.35, delay: index * 0.04 }}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : index)}
                  className="w-full py-5 flex items-center justify-between gap-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-medium text-[15px]">{faq.q}</span>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-secondary flex-shrink-0 transition-transform duration-300',
                      isOpen && 'rotate-180'
                    )}
                  />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="overflow-hidden"
                    >
                      <p className="pb-5 text-sm text-secondary leading-relaxed">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
