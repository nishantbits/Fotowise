import { motion, AnimatePresence } from 'framer-motion';
import { AlertOctagon, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger'
}: ConfirmDialogProps) {
  
  const colors = {
    danger: { bg: 'bg-red-500/10', text: 'text-red-500', button: 'bg-red-500 hover:bg-red-600' },
    warning: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', button: 'bg-yellow-500 hover:bg-yellow-600' },
    info: { bg: 'bg-blue-500/10', text: 'text-blue-500', button: 'bg-blue-500 hover:bg-blue-600' }
  };

  const theme = colors[variant];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />
          
          {/* Dialog */}
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              layoutId="confirm-dialog"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md overflow-hidden rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] shadow-2xl shadow-black/50 pointer-events-auto"
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-dialog-title"
              aria-describedby="confirm-dialog-desc"
              data-testid="confirm-dialog"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${theme.bg}`}>
                    <AlertOctagon className={`h-6 w-6 ${theme.text}`} />
                  </div>
                  <button onClick={onCancel} data-testid="confirm-dialog-close" className="text-[var(--text-muted)] hover:text-white transition-colors" aria-label="Close dialog">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <h2 id="confirm-dialog-title" className="text-xl font-bold text-white mb-2">{title}</h2>
                <p id="confirm-dialog-desc" className="text-[var(--text-secondary)] leading-relaxed">
                  {description}
                </p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 bg-[var(--bg-primary)]/50 p-6 border-t border-[var(--border)]">
                <button
                  onClick={onCancel}
                  data-testid="confirm-dialog-cancel"
                  className="rounded-full px-6 py-2.5 text-sm font-semibold text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  data-testid="confirm-dialog-confirm"
                  className={`rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-colors shadow-lg ${theme.button}`}
                >
                  {confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
