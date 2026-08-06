import * as React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassPanelProps extends HTMLMotionProps<'div'> {
  variant?: 'default' | 'strong' | 'subtle';
  blur?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  hover?: boolean;
}

const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  (
    {
      className,
      variant = 'default',
      blur = 'xl',
      padding = 'md',
      hover = false,
      children,
      whileHover,
      ...props
    },
    ref
  ) => {
    const variants = {
      default: 'bg-white/5 border border-white/10',
      strong: 'bg-white/10 border border-white/20',
      subtle: 'bg-white/3 border border-white/5',
    };

    const blurStyles = {
      sm: 'backdrop-blur-sm',
      md: 'backdrop-blur-md',
      lg: 'backdrop-blur-lg',
      xl: 'backdrop-blur-xl',
      '2xl': 'backdrop-blur-2xl',
    };

    const paddingStyles = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
      xl: 'p-10',
    };

    return (
      <motion.div
        ref={ref}
        className={cn(
          'rounded-2xl transition-all duration-300',
          variants[variant],
          blurStyles[blur],
          paddingStyles[padding],
          className
        )}
        whileHover={hover ? { y: -4, boxShadow: '0 20px 40px -10px rgba(99, 102, 241, 0.15)' } : undefined}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
GlassPanel.displayName = 'GlassPanel';

export { GlassPanel };