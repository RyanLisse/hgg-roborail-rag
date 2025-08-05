'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedLogoProps {
  isAnimating?: boolean;
  size?: number;
  className?: string;
  variant?: 'sparkles' | 'dots' | 'pulse';
}

/**
 * Animated loading indicator inspired by ContentPort's logo animation
 * Features smooth SVG path animations with multiple variants
 */
export function AnimatedLogo({
  isAnimating = true,
  size = 24,
  className = '',
  variant = 'sparkles',
}: AnimatedLogoProps) {
  if (variant === 'sparkles') {
    return <SparklesAnimation isAnimating={isAnimating} size={size} className={className} />;
  }

  if (variant === 'dots') {
    return <DotsAnimation isAnimating={isAnimating} size={size} className={className} />;
  }

  return <PulseAnimation isAnimating={isAnimating} size={size} className={className} />;
}

function SparklesAnimation({ isAnimating, size = 24, className }: Omit<AnimatedLogoProps, 'variant'>) {
  const pathVariants = {
    initial: { opacity: 0, scale: 0.8, rotate: -10 },
    animate: { 
      opacity: [0.4, 1, 0.4],
      scale: [0.8, 1.1, 0.8],
      rotate: [-10, 10, -10],
      transition: {
        duration: 2,
        repeat: isAnimating ? Infinity : 0,
        ease: 'easeInOut' as const,
        times: [0, 0.5, 1]
      }
    }
  };

  const sparkleVariants = {
    initial: { opacity: 0, scale: 0 },
    animate: (i: number) => ({
      opacity: [0, 1, 0],
      scale: [0, 1, 0],
      transition: {
        duration: 1.5,
        repeat: isAnimating ? Infinity : 0,
        delay: i * 0.2,
        ease: 'easeInOut' as const
      }
    })
  };

  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <motion.path
          d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z"
          fill="currentColor"
          variants={pathVariants}
          initial="initial"
          animate="animate"
          className="text-blue-500"
        />
      </svg>
      
      {/* Orbiting sparkles */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          custom={i}
          variants={sparkleVariants}
          initial="initial"
          animate="animate"
          className="absolute w-1 h-1 bg-blue-400 rounded-full"
          style={{
            left: `${50 + 30 * Math.cos((i * 2 * Math.PI) / 3)}%`,
            top: `${50 + 30 * Math.sin((i * 2 * Math.PI) / 3)}%`,
          }}
        />
      ))}
    </div>
  );
}

function DotsAnimation({ isAnimating, size = 24, className }: Omit<AnimatedLogoProps, 'variant'>) {
  const dotVariants = {
    initial: { scale: 1, opacity: 0.3 },
    animate: (i: number) => ({
      scale: [1, 1.5, 1],
      opacity: [0.3, 1, 0.3],
      transition: {
        duration: 1.2,
        repeat: isAnimating ? Infinity : 0,
        delay: i * 0.2,
        ease: 'easeInOut' as const
      }
    })
  };

  return (
    <div className={cn('flex items-center justify-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          custom={i}
          variants={dotVariants}
          initial="initial"
          animate="animate"
          className="w-2 h-2 bg-current rounded-full"
          style={{ width: (size || 24) / 6, height: (size || 24) / 6 }}
        />
      ))}
    </div>
  );
}

function PulseAnimation({ isAnimating, size = 24, className }: Omit<AnimatedLogoProps, 'variant'>) {
  const pulseVariants = {
    initial: { scale: 0.8, opacity: 0.6 },
    animate: {
      scale: [0.8, 1.2, 0.8],
      opacity: [0.6, 1, 0.6],
      transition: {
        duration: 2,
        repeat: isAnimating ? Infinity : 0,
        ease: 'easeInOut' as const
      }
    }
  };

  const ringVariants = {
    initial: { scale: 1, opacity: 0 },
    animate: {
      scale: [1, 2, 3],
      opacity: [0, 0.5, 0],
      transition: {
        duration: 2,
        repeat: isAnimating ? Infinity : 0,
        ease: 'easeOut' as const
      }
    }
  };

  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      {/* Expanding rings */}
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          variants={ringVariants}
          initial="initial"
          animate="animate"
          className="absolute border-2 border-current rounded-full"
          style={{
            width: size || 24,
            height: size || 24,
            borderColor: 'currentColor',
            opacity: 0.2,
          }}
          transition={{ delay: i * 0.5 }}
        />
      ))}
      
      {/* Central pulsing dot */}
      <motion.div
        variants={pulseVariants}
        initial="initial"
        animate="animate"
        className="w-3 h-3 bg-current rounded-full"
        style={{ width: (size || 24) / 3, height: (size || 24) / 3 }}
      />
    </div>
  );
}

/**
 * Simple loading spinner with smooth rotation
 */
export function LoadingSpinner({ 
  size = 16, 
  className = '' 
}: { 
  size?: number; 
  className?: string; 
}) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className={cn('border-2 border-current border-t-transparent rounded-full', className)}
      style={{ width: size, height: size }}
    />
  );
}