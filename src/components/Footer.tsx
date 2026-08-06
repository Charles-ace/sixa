'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Twitter,
  Github,
  MessageSquare,
  Mail,
  ArrowRight,
} from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { cn } from '@/lib/utils';

const footerLinks = {
  product: [
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Dashboard', href: '#dashboard' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'API Docs', href: '/docs' },
  ],
  resources: [
    { label: 'Blog', href: '/blog' },
    { label: 'Security', href: '/security' },
    { label: 'Audits', href: '/audits' },
    { label: 'Bug Bounty', href: '/bug-bounty' },
    { label: 'Status', href: '/status' },
  ],
  company: [
    { label: 'About', href: '/about' },
    { label: 'Careers', href: '/careers' },
    { label: 'Press', href: '/press' },
    { label: 'Contact', href: '/contact' },
    { label: 'Partners', href: '/partners' },
  ],
  legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'Cookie Policy', href: '/cookies' },
    { label: 'Disclaimer', href: '/disclaimer' },
  ],
};

const socialLinks = [
  { icon: Twitter, href: 'https://twitter.com/sixa', label: 'Twitter' },
  { icon: Github, href: 'https://github.com/sixa', label: 'GitHub' },
  { icon: MessageSquare, href: 'https://discord.gg/sixa', label: 'Discord' },
  { icon: Mail, href: 'mailto:hello@sixa.xyz', label: 'Email' },
];

export function Footer() {
  return (
    <footer className="relative border-t border-border bg-background" aria-labelledby="footer-title">
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-gradient-to-b from-indigo-500/5 to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 lg:py-24">
        <div className="grid lg:grid-cols-6 gap-8 lg:gap-12 mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-2 space-y-6"
          >
            <Link href="/" className="flex items-center gap-2" aria-label="Sixa Home">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight">Sixa</span>
            </Link>
            <p className="text-secondary text-sm leading-relaxed max-w-xs">
              Autonomous AI yield optimization agent. Maximize returns on your crypto assets using natural language.
            </p>
            <div className="flex items-center gap-4">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-border flex items-center justify-center text-secondary hover:text-foreground hover:border-border hover:bg-white/10 transition-all"
                >
                  <social.icon className="w-5 h-5" />
                </motion.a>
              ))}
            </div>
          </motion.div>

          {Object.entries(footerLinks).map(([category, links], categoryIndex) => (
            <motion.nav
              key={category}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + categoryIndex * 0.08 }}
              aria-label={category.charAt(0).toUpperCase() + category.slice(1)}
            >
              <h3 className="font-semibold text-foreground mb-4">{category.charAt(0).toUpperCase() + category.slice(1)}</h3>
              <ul className="space-y-3" role="list">
                {links.map((link, linkIndex) => (
                  <motion.li
                    key={link.href}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + linkIndex * 0.05 }}
                  >
                    <Link
                      href={link.href}
                      className="text-sm text-secondary hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </motion.nav>
          ))}
        </div>

        <div className="pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-sm text-secondary"
            >
              © {new Date().getFullYear()} Sixa. All rights reserved.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-6 text-sm text-secondary"
            >
              <span>Built with</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span>for DeFi</span>
              </span>
              <span className="flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                <span>v1.0.0</span>
              </span>
            </motion.div>
          </div>
        </div>
      </div>
    </footer>
  );
}