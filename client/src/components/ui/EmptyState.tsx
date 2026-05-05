import { Upload } from 'lucide-react';
import { motion } from 'framer-motion';

export function EmptyState() {
  return (
    <div className="flex min-h-[400px] w-full flex-col items-center justify-center p-8 text-center mt-8 space-y-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative flex items-center justify-center p-6 bg-[var(--bg-elevated)] rounded-full ring-1 ring-white/5 border border-[var(--border)]"
      >
        {/* Decorative SVG background elements */}
        <svg className="absolute -z-10 h-32 w-32 text-[var(--accent-green)] opacity-5" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" fill="currentColor" />
        </svg>
        <svg className="absolute left-1/2 top-1/2 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/2 text-white opacity-5" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 2" />
        </svg>

        <Upload className="h-14 w-14 text-[var(--accent-green)]" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
      >
        <h3 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] mb-2 font-syne">Your Library is Empty</h3>
        <p className="max-w-md text-[var(--text-secondary)]">
          Welcome to Fotowise! Your cinematic journey starts here. 
          Use the upload zone in the sidebar to drag and drop your first photos or videos.
        </p>
      </motion.div>
    </div>
  );
}
