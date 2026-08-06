'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ScrollProgress } from '@/components/ScrollProgress';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '#commands', label: 'Commands' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#execution', label: 'Execution' },
  { href: '#faq', label: 'FAQ' },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isApp = pathname === '/app';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <ScrollProgress />
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          isScrolled
            ? 'border-b border-black/10 bg-background/85 backdrop-blur-xl'
            : 'border-b border-transparent bg-background'
        )}
        style={{ willChange: 'transform, background-color' }}
      >
        <nav className="mx-auto max-w-6xl px-6 py-3" aria-label="Main navigation">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-foreground hover:opacity-70 transition-opacity"
              aria-label="Sixa Home"
            >
              <Image
                src="/sixa-logo.svg"
                alt=""
                aria-hidden="true"
                width={32}
                height={32}
                priority
                className="w-8 h-8"
              />
              <span className="font-semibold text-[15px] tracking-tight">sixa</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              {!isApp && NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[13px] text-secondary hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-2">
              {isApp ? (
                <Button variant="ghost" size="sm" onClick={() => window.history.length > 1 ? router.back() : router.push('/')}>
                  Back to home
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}>
                    Watch it work
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={() => router.push('/app')}>
                    Launch app
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>

            <button
              className="md:hidden p-2 rounded-md text-secondary hover:text-foreground hover:bg-black/5 transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="md:hidden overflow-hidden"
              >
                <div className="mt-4 pt-2 border-t border-black/10 space-y-1">
                  {!isApp && NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block px-2 py-2.5 text-sm text-secondary hover:text-foreground rounded-md transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <div className="pt-2 pb-1 flex flex-col gap-2">
                    {isApp ? (
                      <Button variant="secondary" className="w-full justify-center" onClick={() => { router.push('/'); setIsMobileMenuOpen(false); }}>
                        Back to home
                      </Button>
                    ) : (
                      <>
                        <Button className="w-full justify-center gap-1.5" onClick={() => { router.push('/app'); setIsMobileMenuOpen(false); }}>
                          Launch app <ArrowUpRight className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="secondary" className="w-full justify-center" onClick={() => { document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' }); setIsMobileMenuOpen(false); }}>
                          Watch it work
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>
      </motion.header>

      <div className="h-16" aria-hidden="true" />
    </>
  );
}
