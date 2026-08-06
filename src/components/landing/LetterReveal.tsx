'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface LetterRevealProps {
  className?: string;
  phraseTop?: string;
  phraseBottom?: string;
  words?: string[];
  /** ms per character while typing. */
  typeSpeed?: number;
  /** ms per character while erasing. */
  eraseSpeed?: number;
  /** ms a fully-typed word stays on screen. */
  wordHold?: number;
  /** ms before the bottom phrase starts typing. */
  bottomDelay?: number;
}

function Caret({ blinking = true }: { blinking?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'ml-0.5 inline-block h-[0.85em] w-[0.07em] translate-y-[0.08em] bg-success',
        blinking && 'animate-pulse'
      )}
    />
  );
}

function TypeText({
  text,
  visibleCount,
  showCaret,
  ariaLabel,
}: {
  text: string;
  visibleCount: number;
  showCaret?: boolean;
  ariaLabel?: string;
}) {
  const visible = text.slice(0, visibleCount);
  const hidden = text.slice(visibleCount);
  return (
    <span aria-label={ariaLabel}>
      {visible.split('').map((ch, i) => (
        <span key={i} className="whitespace-pre">
          {ch === ' ' ? '\u00A0' : ch}
        </span>
      ))}
      {showCaret && <Caret />}
      {hidden.split('').map((ch, i) => (
        <span key={i} className="whitespace-pre opacity-0">
          {ch === ' ' ? '\u00A0' : ch}
        </span>
      ))}
    </span>
  );
}

export function LetterReveal({
  className,
  phraseTop = 'Ask anything.',
  phraseBottom = 'It executes.',
  words = ['buy', 'sell', 'audit', 'check mev', 'gas usage'],
  typeSpeed = 55,
  eraseSpeed = 28,
  wordHold = 1800,
  bottomDelay = 1200,
}: LetterRevealProps) {
  const [topCount, setTopCount] = useState(0);
  const [bottomCount, setBottomCount] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'holding' | 'erasing'>('typing');

  useEffect(() => {
    if (topCount >= phraseTop.length) return;
    const id = setTimeout(() => setTopCount((c) => c + 1), typeSpeed + Math.random() * 30);
    return () => clearTimeout(id);
  }, [topCount, phraseTop.length, typeSpeed]);

  useEffect(() => {
    if (bottomCount >= phraseBottom.length) return;
    const id = setTimeout(
      () => setBottomCount((c) => c + 1),
      bottomDelay + bottomCount * (typeSpeed + Math.random() * 30)
    );
    return () => clearTimeout(id);
  }, [bottomCount, phraseBottom.length, typeSpeed, bottomDelay]);

  useEffect(() => {
    const word = words[wordIndex];
    let id: ReturnType<typeof setTimeout>;

    if (phase === 'typing') {
      if (charCount < word.length) {
        id = setTimeout(() => setCharCount((c) => c + 1), typeSpeed + Math.random() * 40);
      } else {
        id = setTimeout(() => setPhase('holding'), 300);
      }
    } else if (phase === 'holding') {
      id = setTimeout(() => setPhase('erasing'), wordHold);
    } else {
      if (charCount > 0) {
        id = setTimeout(() => setCharCount((c) => c - 1), eraseSpeed + Math.random() * 20);
      } else {
        id = setTimeout(() => {
          setWordIndex((i) => (i + 1) % words.length);
          setPhase('typing');
        }, 60);
      }
    }

    return () => clearTimeout(id);
  }, [phase, charCount, wordIndex, words, typeSpeed, eraseSpeed, wordHold]);

  const topTyping = topCount < phraseTop.length;
  const bottomTyping = bottomCount < phraseBottom.length;

  return (
    <h1
      className={cn(
        'text-5xl md:text-7xl font-bold tracking-tight leading-[0.98] text-balance',
        className
      )}
    >
      <span className="block">
        <TypeText
          text={phraseTop}
          visibleCount={topCount}
          showCaret={topTyping}
          ariaLabel={phraseTop}
        />
      </span>

      <span className="block h-[1.05em] overflow-hidden">
        <TypeText
          text={words[wordIndex]}
          visibleCount={charCount}
          showCaret
          ariaLabel={`currently: ${words[wordIndex]}`}
        />
      </span>

      <span className="block">
        <TypeText
          text={phraseBottom}
          visibleCount={bottomCount}
          showCaret={bottomTyping}
          ariaLabel={phraseBottom}
        />
      </span>
    </h1>
  );
}
