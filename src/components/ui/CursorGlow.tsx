'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CursorGlowProps {
  className?: string;
  size?: number;
  color?: string;
  opacity?: number;
  intensity?: number;
}

export function CursorGlow({
  className,
  size = 400,
  color = '99, 102, 241',
  opacity = 0.15,
  intensity = 1,
}: CursorGlowProps) {
  const [position, setPosition] = useState({ x: -9999, y: -9999 });
  const [isVisible, setIsVisible] = useState(false);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      ref={glowRef}
      className={cn('pointer-events-none fixed top-0 left-0 z-0 transition-all duration-500 ease-out', className)}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        transform: `translate(${position.x - size / 2}px, ${position.y - size / 2}px)`,
        background: `radial-gradient(circle at center, rgba(${color}, ${opacity * intensity}) 0%, rgba(${color}, 0) 70%)`,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  );
}

interface CursorGlowTrailProps {
  className?: string;
  trailLength?: number;
  size?: number;
  color?: string;
}

export function CursorGlowTrail({
  className,
  trailLength = 10,
  size = 20,
  color = '99, 102, 241',
}: CursorGlowTrailProps) {
  const [positions, setPositions] = useState<Array<{ x: number; y: number }>>(
    Array(trailLength).fill({ x: -9999, y: -9999 })
  );
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setIsVisible(true);
      setPositions((prev) => [
        { x: e.clientX, y: e.clientY },
        ...prev.slice(0, trailLength - 1),
      ]);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [trailLength]);

  if (!isVisible) return null;

  return (
    <div className={cn('pointer-events-none fixed top-0 left-0 z-0', className)} aria-hidden="true">
      {positions.map((pos, index) => (
        <motion.div
          key={index}
          style={{
            width: size * (1 - index / trailLength * 0.8),
            height: size * (1 - index / trailLength * 0.8),
            borderRadius: '50%',
            transform: `translate(${pos.x - size / 2}px, ${pos.y - size / 2}px)`,
            background: `radial-gradient(circle at center, rgba(${color}, ${0.1 * (1 - index / trailLength)}) 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
          transition={{ duration: 0.1 * (index + 1) }}
        />
      ))}
    </div>
  );
}