'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Menu, X, Sparkles, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#dashboard', label: 'Dashboard' },
  { href: '#faq', label: 'FAQ' },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isWalletMenuOpen, setIsWalletMenuOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleConnectWallet = async () => {
    // Simulate wallet connection
    setIsConnected(true);
    setWalletAddress('0x742d...35C6');
    setIsWalletMenuOpen(false);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setWalletAddress('');
    setIsWalletMenuOpen(false);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          isScrolled
            ? 'bg-background/80 backdrop-blur-xl border-b border-border'
            : 'bg-transparent'
        )}
        style={{ willChange: 'transform, background-color' }}
      >
        <nav className="mx-auto max-w-7xl px-6 py-4" aria-label="Main navigation">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity"
              aria-label="Sixa Home"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-lg tracking-tight">Sixa</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-secondary hover:text-foreground transition-colors relative"
                >
                  {link.label}
                  <span className="absolute bottom-[-4px] left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 scale-x-0 origin-center transition-transform hover:scale-x-100" />
                </Link>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}>
                Try Demo
              </Button>
              {isConnected ? (
                <div className="relative">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsWalletMenuOpen(!isWalletMenuOpen)}
                    className="gap-2"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>{formatAddress(walletAddress)}</span>
                    <ChevronDown className={cn('w-4 h-4 transition-transform', isWalletMenuOpen && 'rotate-180')} />
                  </Button>

                  <AnimatePresence>
                    {isWalletMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute right-0 top-full mt-2 w-56 glass-strong rounded-xl p-2 shadow-2xl border-border"
                        role="menu"
                      >
                        <div className="px-3 py-2 text-sm text-secondary border-b border-border">
                          Connected Wallet
                        </div>
                        <div className="px-3 py-2 text-sm text-foreground font-mono text-xs">
                          {walletAddress}
                        </div>
                        <button
                          onClick={handleDisconnect}
                          className="w-full px-3 py-2 text-left text-sm text-error hover:bg-error/10 rounded-lg transition-colors"
                          role="menuitem"
                        >
                          Disconnect
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Button size="sm" onClick={handleConnectWallet} className="gap-2">
                  <Wallet className="w-4 h-4" />
                  Connect Wallet
                </Button>
              )}
            </div>

            <button
              className="md:hidden p-2 rounded-lg text-secondary hover:text-foreground hover:bg-white/5 transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="md:hidden mt-6 overflow-hidden"
              >
                <div className="glass rounded-xl p-4 space-y-2">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block px-3 py-2 text-sm font-medium text-secondary hover:text-foreground hover:bg-white/5 rounded-lg transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <div className="border-t border-border my-2" />
                  <Button
                    variant={isConnected ? 'secondary' : 'default'}
                    className="w-full justify-start gap-2"
                    onClick={isConnected ? handleDisconnect : handleConnectWallet}
                  >
                    <Wallet className="w-4 h-4" />
                    {isConnected ? `Disconnect (${formatAddress(walletAddress)})` : 'Connect Wallet'}
                  </Button>
                  <Button variant="secondary" className="w-full justify-start gap-2" onClick={() => { document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' }); setIsMobileMenuOpen(false); }}>
                      Try Demo
                    </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>
      </motion.header>

      <div className="h-20 md:h-24" aria-hidden="true" />
    </>
  );
}