import { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { HowItWorks } from '@/components/HowItWorks';
import { Features } from '@/components/Features';
import { AIChatSection } from '@/components/AIChatSection';
import { PortfolioDashboard } from '@/components/PortfolioDashboard';
import { Testimonials } from '@/components/Testimonials';
import { FAQ } from '@/components/FAQ';
import { Footer } from '@/components/Footer';
import { GlowBackground, GradientMesh, NoiseOverlay, GridPattern, FloatingOrbs } from '@/components/ui/GlowBackground';
import { CursorGlow } from '@/components/ui/CursorGlow';

export const metadata: Metadata = {
  title: 'Sixa — AI Yield Optimization Agent',
  description: 'Autonomous AI agent that maximizes returns on your crypto assets using natural language. Analyze, optimize, and execute DeFi strategies with institutional-grade risk management.',
  keywords: ['DeFi', 'yield optimization', 'AI', 'crypto', 'yield farming', 'portfolio management', 'Web3'],
  authors: [{ name: 'Sixa' }],
  creator: 'Sixa',
  publisher: 'Sixa',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://sixa.xyz',
    title: 'Sixa — AI Yield Optimization Agent',
    description: 'Autonomous AI agent that maximizes returns on your crypto assets using natural language.',
    siteName: 'Sixa',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sixa — AI Yield Optimization Agent',
    description: 'Autonomous AI agent that maximizes returns on your crypto assets using natural language.',
    creator: '@sixa',
  },
  icons: {
    icon: '/favicon-32x32.svg',
    shortcut: '/favicon-32x32.svg',
    apple: '/apple-touch-icon.svg',
  },
  manifest: '/site.webmanifest',
};

export default function Home() {
  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <CursorGlow size={500} opacity={0.12} />
      
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <GlowBackground intensity={1} animated />
        <GradientMesh animate />
        <NoiseOverlay opacity={0.02} />
        <GridPattern size={80} opacity={0.015} />
        <FloatingOrbs count={12} />
      </div>

      <Navbar />

      <main className="relative z-10">
        <Hero />
        <HowItWorks />
        <Features />
        <AIChatSection />
        <PortfolioDashboard />
        <Testimonials />
        <FAQ />
      </main>

      <Footer />
    </div>
  );
}