'use client';

import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { cn } from '@/lib/utils';

const testimonials = [
  {
    content: "Sixa found me a 6.8% APY vault with lower risk than my 4.2% position. The AI explained exactly why — TVL, audit scores, liquidity depth. Executed in one click. Saved me hours of research.",
    author: "Marcus Chen",
    role: "DeFi Fund Manager",
    avatar: "MC",
    stars: 5,
  },
  {
    content: "\"Move my USDC somewhere safer\" — that's all I typed. Sixa analyzed 47 protocols, simulated the transaction, showed me gas estimates, and executed atomically. My yield jumped 140 basis points.",
    author: "Sarah Kim",
    role: "Software Engineer",
    avatar: "SK",
    stars: 5,
  },
  {
    content: "The auto-rebalancing is a game changer. Set my risk threshold once, and Sixa handles the rest. It caught a depeg risk on a minor protocol before it happened and moved my funds automatically.",
    author: "David Park",
    role: "Crypto Researcher",
    avatar: "DP",
    stars: 5,
  },
  {
    content: "Cross-chain optimization without the headache. Sixa routes through LayerZero, finds the best yield on Arbitrum, Optimism, Base — wherever it is. Gas optimization saves me ~40% vs manual bridging.",
    author: "Lisa Wang",
    role: "Yield Strategist",
    avatar: "LW",
    stars: 5,
  },
];

export function Testimonials() {
  return (
    <section
      id="testimonials"
      className="relative py-24 md:py-32 lg:py-40 overflow-hidden"
      aria-labelledby="testimonials-title"
    >
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-purple-500/10 to-pink-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <SectionTitle
          id="testimonials-title"
          title="Trusted by DeFi Leaders"
          subtitle="Real users. Real results. No marketing fluff."
          className="mb-16 lg:mb-20"
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.article
              key={testimonial.author}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: index * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <GlassPanel variant="default" padding="lg" hover className="h-full relative">
                <div className="absolute top-4 right-4 w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Quote className="w-6 h-6 text-indigo-400/50" />
                </div>

                <div className="relative z-10 space-y-5">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <motion.span
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, delay: 0.3 + i * 0.05 }}
                        className="text-warning"
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </motion.span>
                    ))}
                  </div>

                  <p className="text-secondary leading-relaxed text-sm">
                    {testimonial.content}
                  </p>

                  <div className="pt-4 border-t border-white/10 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-medium text-sm">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{testimonial.author}</p>
                      <p className="text-xs text-secondary">{testimonial.role}</p>
                    </div>
                  </div>
                </div>
              </GlassPanel>
            </motion.article>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
          className="mt-16 text-center"
        >
          <GlassPanel variant="subtle" padding="lg" className="max-w-2xl mx-auto border border-indigo-500/20">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <Star className="w-6 h-6 text-white fill-current" />
              </div>
              <span className="font-medium text-foreground">4.9/5 average rating</span>
            </div>
            <p className="text-secondary text-sm">
              Based on 200+ reviews from DeFi professionals, fund managers, and yield farmers
            </p>
          </GlassPanel>
        </motion.div>
      </div>
    </section>
  );
}