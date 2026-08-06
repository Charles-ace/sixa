'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlowBackgroundProps {
  className?: string;
  colors?: string[];
  intensity?: number;
  animated?: boolean;
}

export function GlowBackground({
  className,
  colors = ['99, 102, 241', '139, 92, 246', '168, 85, 247'],
  intensity = 1,
  animated = true,
}: GlowBackgroundProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    if (!animated) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [animated]);

  const glowStyle = {
    background: `
      radial-gradient(ellipse ${80 * intensity}% ${60 * intensity}% at ${mousePosition.x * 100}% ${mousePosition.y * 100}%, 
        rgba(${colors[0]}, ${0.08 * intensity}) 0%, 
        transparent 50%),
      radial-gradient(ellipse ${100 * intensity}% ${80 * intensity}% at ${(1 - mousePosition.x) * 100}% ${(1 - mousePosition.y) * 100}%, 
        rgba(${colors[1]}, ${0.06 * intensity}) 0%, 
        transparent 50%),
      radial-gradient(ellipse ${120 * intensity}% ${100 * intensity}% at 50% 50%, 
        rgba(${colors[2]}, ${0.04 * intensity}) 0%, 
        transparent 60%)
    `,
    transition: animated ? 'all 0.3s ease-out' : 'none',
  };

  return (
    <div
      className={cn('fixed inset-0 z-0 pointer-events-none', className)}
      style={glowStyle}
      aria-hidden="true"
    />
  );
}

interface GradientMeshProps {
  className?: string;
  colors?: string[];
  animate?: boolean;
}

export function GradientMesh({
  className,
  colors = ['99, 102, 241', '139, 92, 246', '168, 85, 247', '236, 72, 153'],
  animate = true,
}: GradientMeshProps) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-0 pointer-events-none overflow-hidden',
        animate && 'animate-gradient-shift',
        className
      )}
      style={{
        background: `
          linear-gradient(135deg,
            rgba(${colors[0]}, 0.03) 0%,
            rgba(${colors[1]}, 0.02) 25%,
            rgba(${colors[2]}, 0.02) 50%,
            rgba(${colors[3]}, 0.01) 75%,
            transparent 100%
          )`,
        backgroundSize: '400% 400%',
      }}
      aria-hidden="true"
    />
  );
}

interface NoiseOverlayProps {
  className?: string;
  opacity?: number;
}

export function NoiseOverlay({ className, opacity = 0.03 }: NoiseOverlayProps) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-0 pointer-events-none',
        className
      )}
      style={{
        opacity,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }}
      aria-hidden="true"
    />
  );
}

interface GridPatternProps {
  className?: string;
  size?: number;
  opacity?: number;
  color?: string;
}

export function GridPattern({
  className,
  size = 60,
  opacity = 0.02,
  color = '255, 255, 255',
}: GridPatternProps) {
  return (
    <div
      className={cn('fixed inset-0 z-0 pointer-events-none', className)}
      style={{
        backgroundImage: `
          linear-gradient(rgba(${color}, ${opacity}) 1px, transparent 1px),
          linear-gradient(90deg, rgba(${color}, ${opacity}) 1px, transparent 1px)
        `,
        backgroundSize: `${size}px ${size}px`,
      }}
      aria-hidden="true"
    />
  );
}

interface FloatingOrbsProps {
  className?: string;
  count?: number;
  colors?: string[];
  sizeRange?: [number, number];
  speedRange?: [number, number];
}

export function FloatingOrbs({
  className,
  count = 15,
  colors = ['99, 102, 241', '139, 92, 246', '168, 85, 247', '236, 72, 153'],
  sizeRange = [80, 300],
  speedRange = [15, 30],
}: FloatingOrbsProps) {
  const orbs = Array.from({ length: count }, (_, i) => {
    const size = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
    const color = colors[Math.floor(Math.random() * colors.length)];
    const speed = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);
    const delay = Math.random() * 5;
    const x = Math.random() * 100;
    const y = Math.random() * 100;

    return (
      <motion.div
        key={i}
        className="absolute rounded-full pointer-events-none"
        style={{
          width: size,
          height: size,
          left: `${x}%`,
          top: `${y}%`,
          background: `radial-gradient(circle at 30% 30%, rgba(${color}, 0.15) 0%, rgba(${color}, 0.05) 40%, transparent 70%)`,
          filter: 'blur(60px)',
        }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.9, 1.1, 0.9] }}
        transition={{
          duration: speed,
          delay,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        aria-hidden="true"
      />
    );
  });

  return (
    <div className={cn('fixed inset-0 z-0 pointer-events-none overflow-hidden', className)} aria-hidden="true">
      {orbs}
    </div>
  );
}

interface ParticleFieldProps {
  className?: string;
  count?: number;
  color?: string;
  speed?: number;
}

export function ParticleField({
  className,
  count = 50,
  color = '99, 102, 241',
  speed = 20,
}: ParticleFieldProps) {
  const particles = Array.from({ length: count }, (_, i) => {
    const size = Math.random() * 3 + 1;
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const duration = speed + Math.random() * speed;
    const delay = Math.random() * duration;
    const opacity = Math.random() * 0.5 + 0.1;

    return (
      <motion.div
        key={i}
        className="absolute rounded-full pointer-events-none"
        style={{
          width: size,
          height: size,
          left: `${x}%`,
          background: `rgba(${color}, ${opacity})`,
        }}
        initial={{ opacity: 0, y: 0 }}
        animate={{ y: ['0vh', '-120vh'], opacity: [opacity, 0, opacity] }}
        transition={{
          duration,
          delay,
          repeat: Infinity,
          ease: 'linear',
        }}
        aria-hidden="true"
      />
    );
  });

  return (
    <div className={cn('fixed inset-0 z-0 pointer-events-none overflow-hidden', className)} aria-hidden="true">
      {particles}
    </div>
  );
}