'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SectionTitleProps {
  id?: string;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
}

export function SectionTitle({
  id,
  title,
  subtitle,
  align = 'center',
  className,
  titleClassName,
  subtitleClassName,
}: SectionTitleProps) {
  const lines = title.split('\n');

  return (
    <div
      id={id}
      className={cn('space-y-4', align === 'center' && 'text-center', align === 'left' && 'lg:max-w-2xl', className)}
      role="heading"
      aria-level={2}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className={cn('relative inline-block', align === 'left' && '!inline-block')}
      >
        {lines.map((line, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn('font-bold tracking-tight text-foreground', titleClassName)}
          >
            {line}
          </motion.div>
        ))}
        <div className="absolute bottom-[-8px] left-0 w-16 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded" />
      </motion.div>

      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          className={cn('text-secondary leading-relaxed', subtitleClassName)}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}