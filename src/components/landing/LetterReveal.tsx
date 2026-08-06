'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LetterRevealProps {
  className?: string;
  phraseTop?: string;
  phraseBottom?: string;
  words?: string[];
  /** ms each rotating word stays on screen before the next one reveals. */
  wordInterval?: number;
  /** delay (s) before the bottom phrase reveals. */
  bottomDelay?: number;
}

const lineContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const lineLetter: Variants = {
  hidden: { opacity: 0, y: '0.6em', filter: 'blur(6px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 320, damping: 24 },
  },
};

const wordContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045 } },
  exit: { transition: { staggerChildren: 0.025, staggerDirection: -1 } },
};

const wordLetter: Variants = {
  hidden: { opacity: 0, y: '0.6em', filter: 'blur(6px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 320, damping: 22 },
  },
  exit: { opacity: 0, y: '-0.4em', transition: { duration: 0.18, ease: 'easeIn' } },
};

export function LetterReveal({
  className,
  phraseTop = 'Ask anything.',
  phraseBottom = 'It executes.',
  words = ['buy', 'sell', 'audit', 'check mev', 'gas usage'],
  wordInterval = 2600,
  bottomDelay = 1.2,
}: LetterRevealProps) {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setWordIndex((i) => (i + 1) % words.length),
      wordInterval
    );
    return () => clearInterval(id);
  }, [words.length, wordInterval]);

  return (
    <h1
      className={cn(
        'text-5xl md:text-7xl font-bold tracking-tight leading-[0.98] text-balance',
        className
      )}
    >
      <motion.span
        variants={lineContainer}
        initial="hidden"
        animate="show"
        className="block"
        aria-label={phraseTop}
      >
        {phraseTop.split('').map((ch, i) => (
          <motion.span key={i} variants={lineLetter} className="inline-block whitespace-pre">
            {ch}
          </motion.span>
        ))}
      </motion.span>

      <span className="block h-[1.05em] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.span
            key={wordIndex}
            variants={wordContainer}
            initial="hidden"
            animate="show"
            exit="exit"
            className="inline-block align-bottom"
            aria-label={`currently: ${words[wordIndex]}`}
          >
            {words[wordIndex].split('').map((ch, i) => (
              <motion.span key={i} variants={wordLetter} className="inline-block whitespace-pre">
                {ch === ' ' ? '\u00A0' : ch}
              </motion.span>
            ))}
            <motion.span
              aria-hidden="true"
              className="ml-1.5 inline-block h-[0.85em] w-[0.07em] bg-success align-baseline"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.span>
        </AnimatePresence>
      </span>

      <motion.span
        variants={lineContainer}
        initial="hidden"
        animate="show"
        transition={{ delay: bottomDelay }}
        className="block"
        aria-label={phraseBottom}
      >
        {phraseBottom.split('').map((ch, i) => (
          <motion.span key={i} variants={lineLetter} className="inline-block whitespace-pre">
            {ch}
          </motion.span>
        ))}
      </motion.span>
    </h1>
  );
}
