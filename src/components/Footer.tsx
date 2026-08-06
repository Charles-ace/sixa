'use client';

import Link from 'next/link';
import { Github, MessageSquare, Mail } from 'lucide-react';

const footerLinks: Record<string, { label: string; href: string; external?: boolean }[]> = {
  product: [
    { label: 'Open App', href: '/app' },
    { label: 'Commands', href: '/#commands' },
    { label: 'How It Works', href: '/#how-it-works' },
    { label: 'Execution', href: '/#execution' },
  ],
  platform: [
    { label: 'Security', href: '/#mechanism' },
    { label: 'Status', href: '/#status' },
    { label: 'Stack', href: '/#stack' },
    { label: 'FAQ', href: '/#faq' },
  ],
  connect: [
    { label: 'GitHub', href: 'https://github.com/Charles-ace/sixa', external: true },
    { label: 'Discord', href: 'https://discord.gg/sixa', external: true },
    { label: 'Twitter', href: 'https://twitter.com/sixa', external: true },
    { label: 'Email', href: 'mailto:hello@sixa.xyz', external: true },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-black/10 bg-background" aria-labelledby="footer-title">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid lg:grid-cols-6 gap-10 mb-14">
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5" aria-label="Sixa Home">
              <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center">
                <span className="text-sm font-bold leading-none">S</span>
              </div>
              <span className="font-semibold text-[15px] tracking-tight">sixa</span>
            </Link>
            <p className="text-sm text-secondary leading-relaxed max-w-xs">
              AI on-chain execution assistant. Non-custodial by design —
              intent, simulation, KeeperHub relay, audit.
            </p>
            <div className="flex items-center gap-2.5 pt-1">
              <a
                href="https://github.com/Charles-ace/sixa"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center text-secondary hover:text-foreground hover:border-black/30 transition-all"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="https://discord.gg/sixa"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Discord"
                className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center text-secondary hover:text-foreground hover:border-black/30 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
              </a>
              <a
                href="mailto:hello@sixa.xyz"
                aria-label="Email"
                className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center text-secondary hover:text-foreground hover:border-black/30 transition-all"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <nav
              key={category}
              aria-label={category.charAt(0).toUpperCase() + category.slice(1)}
            >
              <h3 className="text-[11px] font-mono uppercase tracking-[0.18em] text-secondary mb-4">
                {category}
              </h3>
              <ul className="space-y-2.5" role="list">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="text-sm text-secondary hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="pt-8 border-t border-black/10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <p className="text-sm text-secondary">
              © {new Date().getFullYear()} Sixa. AI on-chain execution. Settled on-chain, audited always.
            </p>
            <div className="flex items-center gap-5 text-xs font-mono text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                keeperhub · live
              </span>
              <span className="hidden sm:inline">non-custodial · simulated first · audit trail</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
