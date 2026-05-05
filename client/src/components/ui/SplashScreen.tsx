import { useState, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [isVisible, setIsVisible] = useState(true);
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSlowHint(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Keep splash screen visible for at least 2.5 seconds before allowing it to hide
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const title = "Fotowise";

  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.5,
      }
    },
    exit: {
      opacity: 0,
      scale: 1.05,
      filter: 'blur(10px)',
      transition: { duration: 0.8, ease: "easeInOut" }
    }
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 20, filter: 'blur(10px)' },
    show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.8, ease: "easeOut" } }
  };

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {isVisible && (
        <motion.div
          key="splash"
          variants={container}
          initial="hidden"
          animate="show"
          exit="exit"
          role="status"
          aria-label="Loading Fotowise"
          data-testid="splash-screen"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black"
        >
          {/* Subtle animated background gradient */}
          <motion.div 
            className="absolute inset-0 opacity-30"
            animate={{
              background: [
                'radial-gradient(circle at 50% 50%, rgba(34, 197, 94, 0.1) 0%, rgba(0,0,0,1) 50%)',
                'radial-gradient(circle at 50% 50%, rgba(34, 197, 94, 0.15) 0%, rgba(0,0,0,1) 60%)',
                'radial-gradient(circle at 50% 50%, rgba(34, 197, 94, 0.1) 0%, rgba(0,0,0,1) 50%)',
              ]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative flex overflow-hidden">
            {title.split('').map((char, index) => (
              <motion.span
                key={index}
                variants={item}
                className="font-syne text-5xl font-bold tracking-widest text-white md:text-7xl drop-shadow-lg"
              >
                {char}
              </motion.span>
            ))}
          </div>
          
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "120px" }}
            transition={{ delay: 1.8, duration: 0.8, ease: "circOut" }}
            className="mt-8 h-[2px] bg-gradient-to-r from-transparent via-[var(--accent-green)] to-transparent"
          />

          {showSlowHint && (
            <p className="text-xs mt-6" style={{ opacity: 0.35, color: 'var(--text-primary)' }}>
              First startup takes 2–3 minutes while AI models load
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
