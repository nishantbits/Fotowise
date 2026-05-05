import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

const pageVariants = {
  initial: {
    opacity: 0,
    y: 12,
    filter: 'blur(4px)',
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: 'blur(4px)',
  },
};

const pageTransition = {
  duration: 0.35,
  ease: [0.25, 0.1, 0.25, 1.0] as [number, number, number, number],
};

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Reusable page-level transition wrapper.
 * Wrap any route page component in <PageTransition> for a buttery fade+slide.
 */
export function PageTransition({ children, className = '' }: PageTransitionProps) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className={`flex flex-1 flex-col min-h-0 overflow-hidden ${className}`}
    >
      {children}
    </motion.div>
  );
}
