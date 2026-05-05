import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { mediaApi } from '../../lib/api';
import { useMediaStore } from '../../stores/useMediaStore';
import { useUIStore } from '../../stores/useUIStore';
import { useToastStore } from '../../stores/useToastStore';

export function UploadZone() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const { prependMedia } = useMediaStore();
  const { setUploadModalOpen } = useUIStore();
  const addToast = useToastStore((s) => s.addToast);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0 || status === 'uploading') return;

    try {
      setStatus('uploading');
      setProgress(0);

      for (const file of acceptedFiles) {
        const newMedia = await mediaApi.uploadMedia(file, (p) => setProgress(p));
        prependMedia(newMedia); // Add to the top of the grid
      }
      setStatus('success');
      addToast('Upload complete', 'success');
      setTimeout(() => {
        setStatus('idle');
        setUploadModalOpen(false);
      }, 1500);
    } catch (err) {
      console.error('Upload failed', err);
      setStatus('error');
      addToast('Upload failed. Please try again.', 'error');
    } finally {
      setProgress(0);
    }
  }, [prependMedia, setUploadModalOpen, status, addToast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.raw'],
      'video/*': ['.mp4', '.mov', '.webm', '.mkv']
    }
  });

  return (
    <div 
      {...getRootProps()} 
      className={`
        relative overflow-hidden rounded-xl border-2 border-dashed p-6 transition-all cursor-pointer group
        ${isDragActive ? 'border-[var(--accent-green)] bg-[var(--accent-green)]/10' : 'border-[var(--border)] hover:border-[var(--text-secondary)] bg-[var(--bg-surface)]'}
      `}
    >
      <input {...getInputProps()} aria-label="Upload media files" />
      <div className="flex flex-col items-center justify-center space-y-3 text-center">
        {status === 'idle' || isDragActive ? (
          <>
            <div className="rounded-full bg-[var(--bg-elevated)] p-3 text-[var(--accent-green)] transition-transform group-hover:-translate-y-1">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {isDragActive ? 'Drop files here to import' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Images, Videos, RAW formats supported
              </p>
            </div>
          </>
        ) : status === 'uploading' ? (
          <div className="w-full flex-col items-center flex">
            <div className="h-10 w-10 flex items-center justify-center rounded-full border-4 border-[var(--bg-elevated)] border-t-[var(--accent-green)] animate-spin" />
            <p className="text-sm font-medium mt-3 text-[var(--accent-green)]">Uploading... {progress}%</p>
          </div>
        ) : status === 'success' ? (
          <>
            <div className="rounded-full bg-green-500/20 p-3 text-green-500">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-green-500">Upload Complete</p>
          </>
        ) : (
          <>
             <div className="rounded-full bg-red-500/20 p-3 text-red-500">
              <AlertCircle className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-red-500">Upload Failed. Try again.</p>
          </>
        )}
      </div>
    </div>
  );
}
