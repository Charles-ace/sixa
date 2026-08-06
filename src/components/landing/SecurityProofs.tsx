'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

const properties = [
  {
    title: 'The AI never holds your keys',
    description: 'Sixa prepares and simulates transactions. Your wallet signs. The keeper only broadcasts what you approved — there is no code path that moves assets without your signature.',
    code: 'signed = wallet.sign(tx)',
    ref: '// sixa/signing.ts:42',
  },
  {
    title: 'Simulation before execution',
    description: 'Every transaction is reverted-checked on-chain before broadcast. If it fails in simulation, it never leaves your wallet. No surprises, no partial states.',
    code: 'assert(sim.status === "ok")',
    ref: '// keeperhub/simulate.ts:18',
  },
  {
    title: 'Every execution is audited',
    description: 'Each execution is timestamped, hashed, and stored in your audit trail — searchable by action, wallet, or transaction hash. Transparent by default.',
    code: 'audit.push({ txHash, gas })',
    ref: '// keeperhub/audit.ts:9',
  },
];

export function SecurityProofs() {
  return (
    <section id="mechanism" className="relative py-20 md:py-28 border-t border-black/10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-mono uppercase tracking-wider text-secondary mb-3">
          sixa · the boundary
        </p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-6xl font-bold tracking-tight max-w-4xl mb-12"
        >
          The AI never holds your assets.
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-5">
          {properties.map((prop, index) => (
            <motion.article
              key={prop.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="rounded-2xl border border-black/10 bg-white p-7 flex flex-col hover:border-black/30 transition-colors"
            >
              <h3 className="text-base font-semibold mb-3">{prop.title}</h3>
              <p className="text-sm text-secondary leading-relaxed mb-6 flex-1">{prop.description}</p>
              <div className="code-block">
                <code className="block text-foreground">{prop.code}</code>
                <span className="text-[10px] font-mono text-muted mt-1.5 block">{prop.ref}</span>
              </div>
            </motion.article>
          ))}
        </div>

        <motion.a
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          href="https://github.com/Charles-ace/sixa"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex items-center gap-1.5 text-sm text-secondary hover:text-foreground transition-colors font-mono"
        >
          Read the source on GitHub <ArrowUpRight className="w-4 h-4" />
        </motion.a>
      </div>
    </section>
  );
}
