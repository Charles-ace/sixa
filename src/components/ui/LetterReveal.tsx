'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LetterRevealProps {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
  duration?: number;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';
}

export function LetterReveal({
  text,
  className,
  delay = 0,
  stagger = 0.04,
  duration = 0.6,
  as: Component = 'h1',
}: LetterRevealProps) {
  const letters = text.split('').map((char, index) => (
    <motion.span
      key={index}
      initial={{ opacity: 0, filter: 'blur(0.8rem)', y: '1.5rem' }}
      animate={{ opacity: 1, filter: 'blur(0)', y: 0 }}
      transition={{
        delay: delay + index * stagger,
        duration,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      style={{ display: 'inline-block' }}
    >
      {char === ' ' ? '\u00A0' : char}
    </motion.span>
  ));

  return (
    <Component className={cn('inline-block', className)} aria-label={text}>
      {letters}
    </Component>
  );
}

interface WordRevealProps {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
  duration?: number;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';
}

export function WordReveal({
  text,
  className,
  delay = 0,
  stagger = 0.1,
  duration = 0.6,
  as: Component = 'h1',
}: WordRevealProps) {
  const words = text.split(' ').map((word, index) => (
    <motion.span
      key={index}
      initial={{ opacity: 0, y: '1.5rem' }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: delay + index * stagger,
        duration,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      style={{ display: 'inline-block', marginRight: '0.25em' }}
    >
      {word}
    </motion.span>
  ));

  return (
    <Component className={cn('inline-block', className)} aria-label={text}>
      {words}
    </Component>
  );
}

interface LineRevealProps {
  lines: string[];
  className?: string;
  delay?: number;
  stagger?: number;
  duration?: number;
  as?: 'div' | 'p';
}

export function LineReveal({
  lines,
  className,
  delay = 0,
  stagger = 0.15,
  duration = 0.7,
  as: Component = 'div',
}: LineRevealProps) {
  return (
    <Component className={cn('flex flex-col', className)} aria-label={lines.join(' ')}>
      {lines.map((line, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: '2rem' }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: delay + index * stagger,
            duration,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          {line}
        </motion.div>
      ))}
    </Component>
  );
}