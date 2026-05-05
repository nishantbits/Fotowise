import { motion } from 'framer-motion'
import { Share2 } from 'lucide-react'

export function SharePage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6"
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'var(--color-bg-surface)' }}
      >
        <Share2 size={28} style={{ color: 'var(--color-accent-green)', opacity: 0.6 }} />
      </div>

      <h1
        className="text-2xl mb-2"
        style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, color: 'var(--color-text-primary)' }}
      >
        Share
      </h1>

      <p className="text-sm mb-3" style={{ color: 'rgba(236, 238, 245, 0.4)' }}>
        Share photos over your local network
      </p>

      <span
        className="text-xs px-3 py-1 rounded-full"
        style={{
          background: 'var(--color-bg-surface)',
          color: 'rgba(236, 238, 245, 0.3)',
          border: '1px solid rgba(236, 238, 245, 0.06)',
        }}
      >
        Coming in v1.1
      </span>
    </motion.div>
  )
}

export default SharePage
