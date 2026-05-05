import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Check, RotateCw, SlidersHorizontal, Image as ImageIcon, Crop } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/Button';
import type { MediaItem } from '../../lib/api';
import { processImage, defaultEditorState } from '../../lib/imageProcessing';
import type { EditorState } from '../../lib/imageProcessing';
import { mediaApi } from '../../lib/api';
import { useMediaStore } from '../../stores/useMediaStore';
import { useToastStore } from '../../stores/useToastStore';

interface PhotoEditorProps {
  item: MediaItem;
  onClose: () => void;
}

type Tab = 'adjust' | 'filter' | 'rotate' | 'crop';

export function PhotoEditor({ item, onClose }: PhotoEditorProps) {
  const [state, setState] = useState<EditorState>({ ...defaultEditorState });
  const [activeTab, setActiveTab] = useState<Tab>('adjust');
  const { updateMedia } = useMediaStore();
  const { addToast } = useToastStore();
  const queryClient = useQueryClient();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load original image on mount
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = mediaApi.getOriginalUrl(item.id);
    img.onload = () => {
      imgRef.current = img;
      renderCanvas();
    };
  }, [item.id]);

  // Re-render canvas whenever state changes
  useEffect(() => {
    renderCanvas();
  }, [state]);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imgRef.current;
    if (!canvas || !container || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // We scale the canvas to fit the visual container
    const cWidth = container.clientWidth;
    const cHeight = container.clientHeight;
    
    // Determine image aspect ratio vs container aspect ratio
    const imgAspect = img.width / img.height;
    const cAspect = cWidth / cHeight;
    
    let drawWidth, drawHeight;
    if (imgAspect > cAspect) {
      drawWidth = cWidth;
      drawHeight = cWidth / imgAspect;
    } else {
      drawHeight = cHeight;
      drawWidth = cHeight * imgAspect;
    }

    // Set high DP canvas for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    // Swap dimensions if rotated 90/270
    const isRotated = state.rotation === 90 || state.rotation === 270;
    
    canvas.width = (isRotated ? drawHeight : drawWidth) * dpr;
    canvas.height = (isRotated ? drawWidth : drawHeight) * dpr;
    canvas.style.width = `${isRotated ? drawHeight : drawWidth}px`;
    canvas.style.height = `${isRotated ? drawWidth : drawHeight}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Filter
    const { brightness, contrast, saturation, blur } = state.adjustments;
    let filterStr = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`;
    if (state.filter !== 'none') filterStr += ` ${state.filter}`;
    ctx.filter = filterStr;

    // Transform
    ctx.translate(canvas.width / 2 / dpr, canvas.height / 2 / dpr);
    ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
    ctx.rotate((state.rotation * Math.PI) / 180);

    // Draw
    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const originalUrl = mediaApi.getOriginalUrl(item.id);
      // Ensure we export at original quality
      const blob = await processImage(originalUrl, state, item.mime_type, 0.95);
      
      const file = new File([blob], item.file_name, { type: item.mime_type });
      return await mediaApi.replaceMedia(item.id, file);
    },
    onSuccess: (updatedMedia) => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      queryClient.invalidateQueries({ queryKey: ['media', item.id] });

      updateMedia(item.id, updatedMedia);
      addToast('Changes saved successfully', 'success');
      onClose();
    },
    onError: (error: Error) => {
      console.error('[PhotoEditor] Save failed:', error.message);
      addToast('Failed to save changes', 'error');
    },
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-xl"
    >
      {/* Top Bar */}
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
        <Button variant="ghost" onClick={onClose} disabled={saveMutation.isPending}>
          <X className="mr-2 h-4 w-4" /> Cancel
        </Button>
        <span className="font-medium text-white">Edit Photo</span>
        <Button variant="primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : <><Check className="mr-2 h-4 w-4" /> Save</>}
        </Button>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative overflow-hidden p-4 flex items-center justify-center bg-black/50" ref={containerRef}>
        <canvas ref={canvasRef} className="shadow-2xl transition-all duration-200" />
      </div>

      {/* Tools Panel */}
      <div className="h-64 border-t border-white/10 bg-[var(--bg-surface)] flex flex-col">
        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'adjust' && (
            <div className="space-y-6 max-w-md mx-auto">
              <Slider label="Brightness" value={state.adjustments.brightness} min={0} max={200} onChange={v => setState(s => ({ ...s, adjustments: { ...s.adjustments, brightness: v } }))} />
              <Slider label="Contrast" value={state.adjustments.contrast} min={0} max={200} onChange={v => setState(s => ({ ...s, adjustments: { ...s.adjustments, contrast: v } }))} />
              <Slider label="Saturation" value={state.adjustments.saturation} min={0} max={200} onChange={v => setState(s => ({ ...s, adjustments: { ...s.adjustments, saturation: v } }))} />
            </div>
          )}
          
          {activeTab === 'filter' && (
            <div className="flex gap-4 overflow-x-auto pb-4 max-w-3xl mx-auto">
              {(['none', 'grayscale(100%)', 'sepia(100%)', 'invert(100%)', 'hue-rotate(90deg)', 'hue-rotate(180deg)', 'contrast(150%)', 'saturate(200%)']).map(f => (
                <button
                  key={f}
                  onClick={() => setState(s => ({ ...s, filter: f }))}
                  className={`flex shrink-0 flex-col items-center gap-2 rounded-xl p-3 border-2 transition-all ${state.filter === f ? 'border-[var(--accent-green)] bg-white/5' : 'border-transparent hover:bg-white/5'}`}
                >
                  <div className="h-16 w-16 rounded-lg bg-white/10 overflow-hidden relative">
                    <img 
                      src={mediaApi.getThumbnailUrl(item.id, '200')} 
                      style={{ filter: f === 'none' ? 'none' : f }}
                      className="absolute inset-0 w-full h-full object-cover"
                      alt={f}
                    />
                  </div>
                  <span className="text-xs font-medium text-white capitalize">{f === 'none' ? 'Normal' : f.split('(')[0].replace('-', ' ')}</span>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'rotate' && (
            <div className="flex items-center justify-center gap-8 h-full">
              <Button variant="secondary" onClick={() => setState(s => ({ ...s, rotation: (s.rotation - 90 + 360) % 360 }))}>
                <RotateCw className="mr-2 h-4 w-4 -scale-x-100" /> Rotate Left
              </Button>
              <Button variant="secondary" onClick={() => setState(s => ({ ...s, rotation: (s.rotation + 90) % 360 }))}>
                <RotateCw className="mr-2 h-4 w-4" /> Rotate Right
              </Button>
              <div className="w-px h-8 bg-white/10 mx-4" />
              <Button variant={state.flipH ? "primary" : "secondary"} onClick={() => setState(s => ({ ...s, flipH: !s.flipH }))}>
                Flip H
              </Button>
              <Button variant={state.flipV ? "primary" : "secondary"} onClick={() => setState(s => ({ ...s, flipV: !s.flipV }))}>
                Flip V
              </Button>
            </div>
          )}

          {activeTab === 'crop' && (
            <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
              <Crop className="h-5 w-5 mr-3 mb-1" />
              <p>Free crop is coming soon in v2. Use rotate and flip for now.</p>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex h-16 shrink-0 border-t border-white/5 px-2 overflow-x-auto">
          <TabButton active={activeTab === 'adjust'} onClick={() => setActiveTab('adjust')} icon={SlidersHorizontal} label="Adjust" />
          <TabButton active={activeTab === 'filter'} onClick={() => setActiveTab('filter')} icon={ImageIcon} label="Filters" />
          <TabButton active={activeTab === 'rotate'} onClick={() => setActiveTab('rotate')} icon={RotateCw} label="Rotate" />
          <TabButton active={activeTab === 'crop'} onClick={() => setActiveTab('crop')} icon={Crop} label="Crop" />
        </div>
      </div>
    </motion.div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-1 min-w-20 transition-colors ${
        active ? 'text-[var(--accent-green)]' : 'text-[var(--text-secondary)] hover:text-white'
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs font-medium">{label}</span>
      {active && <motion.div layoutId="edit-tab-indicator" className="absolute bottom-0 h-1 w-8 rounded-t-full bg-[var(--accent-green)]" />}
    </button>
  );
}

function Slider({ label, value, min, max, onChange }: { label: string, value: number, min: number, max: number, onChange: (val: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-sm">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="font-mono text-[var(--text-primary)]">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-[var(--accent-green)]"
      />
    </div>
  );
}
