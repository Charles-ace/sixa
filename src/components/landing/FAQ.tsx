'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqs = [
  {
    q: 'Can Sixa take my money?',
    a: 'No. Sixa prepares and simulates transactions — your wallet signs every broadcast. The execution relay never holds keys and has no path to move funds without your signature. If the relay disappears, your assets stay in your wallet, untouched.',
  },
  {
    q: 'What happens if you disappear?',
    a: 'Nothing to your funds. The assistant is a browser app and the relay is stateless. If both vanish, your balances remain on-chain exactly as they are. The audit trail is stored locally and can be exported.',
  },
  {
    q: 'What does it cost?',
    a: 'The assistant is free. You pay the standard gas fee for each transaction, estimated up-front in the preview panel — typically under a dollar for swaps. When KeeperHub live routing is enabled, pricing follows their relay fee schedule.',
  },
  {
    q: 'What is a keeper?',
    a: 'In Sixa\u2019s architecture, a keeper is the execution layer — KeeperHub — that takes your signed, simulated transaction and broadcasts it with smart gas selection and private routing. It can execute. It cannot alter the transaction or redirect where assets settle.',
  },
  {
    q: 'Do I need a wallet to try it?',
    a: 'The chat works without one — the AI still parses intent and simulates transactions. To execute, you connect an EVM wallet. MetaMask is supported today, with more wallets coming.',
  },
  {
    q: 'How does the AI decide what to do?',
    a: 'Your sentence is parsed by a deterministic intent parser (swap, bridge, stake, portfolio, balance, history), then explained by an LLM. The parsed intent is always shown to you before any simulation or execution — you approve every step.',
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-20 md:py-28 border-t border-black/10">
      <div className="mx-auto max-w-3xl px-6">
        <p className="text-xs font-mono uppercase tracking-wider text-secondary mb-3">
          sixa · faq
        </p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-6xl font-bold tracking-tight mb-12"
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
