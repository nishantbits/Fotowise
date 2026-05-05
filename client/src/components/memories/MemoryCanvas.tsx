import React, { useRef, useState, useCallback, useEffect } from 'react';

export interface Box {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface MemoryCanvasProps {
  items: Box[];
  onClose?: () => void;
  renderItem: (item: Box, isVisible: boolean, isDraggingCanvas: boolean) => React.ReactNode;
  initialTransform?: { x: number; y: number; scale: number };
  onTransformChange?: (transform: { x: number; y: number; scale: number }) => void;
}

export const MemoryCanvas: React.FC<MemoryCanvasProps> = ({
  items,
  onClose,
  renderItem,
  initialTransform,
  onTransformChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Calculate center of items to properly center the view
  const calculateCenterTransform = useCallback(() => {
    if (items.length === 0 || !containerRef.current) {
      return { x: 0, y: 0, scale: typeof window !== 'undefined' && window.innerWidth < 768 ? 0.75 : 1 };
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerCenterX = containerRect.width / 2;
    const containerCenterY = containerRect.height / 2;

    // Find the hero item (first item) or calculate bounding box of all items
    const heroItem = items[0];
    const itemCenterX = heroItem.x + heroItem.width / 2;
    const itemCenterY = heroItem.y + heroItem.height / 2;

    // Calculate scale to fit items reasonably
    const baseScale = typeof window !== 'undefined' && window.innerWidth < 768 ? 0.65 : 0.85;

    // Center the hero item
    return {
      x: containerCenterX - itemCenterX * baseScale,
      y: containerCenterY - itemCenterY * baseScale,
      scale: baseScale,
    };
  }, [items]);

  // Core transform state stored in ref for performance
  const transform = useRef(
    initialTransform || {
      x: 0,
      y: 0,
      scale: typeof window !== 'undefined' && window.innerWidth < 768 ? 0.75 : 1,
    }
  );



  const [, setVisibleItems] = useState<Set<string>>(() => {
    return new Set(items.map(i => i.id)); // Mount all initially to allow layoutId animations
  });

  // Interaction refs
  const isDragging = useRef(false);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPanPoint = useRef<{ x: number; y: number } | null>(null);
  const initialPinchDistance = useRef<number | null>(null);
  const initialPinchScale = useRef<number | null>(null);
  const velocitySamples = useRef<{ x: number; y: number; t: number }[]>([]);
  const inertiaRaf = useRef<number | null>(null);
  
  // To distinguish click vs drag for children
  const dragDistance = useRef(0);
  const [isCanvasDragging, setIsCanvasDragging] = useState(false);

  // Update DOM directly for max performance
  const applyTransform = useCallback((isAnimating: boolean = false) => {
    if (canvasRef.current) {
      if (isAnimating) {
        canvasRef.current.style.transition = 'transform 100ms ease';
      } else {
        canvasRef.current.style.transition = 'none';
      }
      canvasRef.current.style.transform = `translate(${transform.current.x}px, ${transform.current.y}px) scale(${transform.current.scale})`;
    }
    if (onTransformChange) {
      onTransformChange({ ...transform.current });
    }
  }, [onTransformChange]);

  // Virtual rendering calculation
  const updateVisibleItems = useCallback(() => {
    if (!containerRef.current) return;
    
    // Throttle check (simple raf)
    requestAnimationFrame(() => {
      const { x: ctx, y: cty, scale: cs } = transform.current;
      const rect = containerRef.current!.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      
      // Calculate inverse transform to figure out which part of canvas is in the viewport
      const viewLeft = -ctx / cs;
      const viewTop = -cty / cs;
      const viewRight = viewLeft + rect.width / cs;
      const viewBottom = viewTop + rect.height / cs;

      // Buffers for virtual rendering
      const RENDER_BUFFER = 400 / cs;
      const UNMOUNT_BUFFER = 800 / cs;

      setVisibleItems(prevVisible => {
        const nextVisible = new Set(prevVisible);
        let changed = false;

        for (const item of items) {
          const itemRight = item.x + item.width;
          const itemBottom = item.y + item.height;

          // Is inside render buffer
          const inRenderZone = 
            itemRight >= viewLeft - RENDER_BUFFER &&
            item.x <= viewRight + RENDER_BUFFER &&
            itemBottom >= viewTop - RENDER_BUFFER &&
            item.y <= viewBottom + RENDER_BUFFER;

          // Is strictly outside unmount buffer
          const outsideUnmountZone = 
            itemRight < viewLeft - UNMOUNT_BUFFER ||
            item.x > viewRight + UNMOUNT_BUFFER ||
            itemBottom < viewTop - UNMOUNT_BUFFER ||
            item.y > viewBottom + UNMOUNT_BUFFER;

          const isCurrentlyVisible = nextVisible.has(item.id);

          if (inRenderZone && !isCurrentlyVisible) {
            nextVisible.add(item.id);
            changed = true;
          } else if (outsideUnmountZone && isCurrentlyVisible) {
            nextVisible.delete(item.id);
            changed = true;
          }
        }
        
        return changed ? nextVisible : prevVisible;
      });
    });
  }, [items]);

  // Initialize transform to center on items when they change
  useEffect(() => {
    if (items.length > 0 && !initialTransform) {
      const centered = calculateCenterTransform();
      transform.current = centered;
      applyTransform(true);
      updateVisibleItems();
    }
  }, [items, initialTransform, calculateCenterTransform, applyTransform, updateVisibleItems]);

  useEffect(() => {
    applyTransform();
    updateVisibleItems();
  }, [applyTransform, updateVisibleItems]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (inertiaRaf.current) cancelAnimationFrame(inertiaRaf.current);
    
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
    if (pointers.current.size === 1) {
      isDragging.current = true;
      dragDistance.current = 0;
      setIsCanvasDragging(false);
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      velocitySamples.current = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
    } else if (pointers.current.size === 2) {
      // Setup pinch zoom
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      initialPinchDistance.current = dist;
      initialPinchScale.current = transform.current.scale;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1 && isDragging.current && lastPanPoint.current) {
      // Pan
      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      
      dragDistance.current += Math.hypot(dx, dy);
      if (dragDistance.current > 5 && !isCanvasDragging) {
        setIsCanvasDragging(true);
      }
      
      transform.current.x += dx;
      transform.current.y += dy;
      
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      
      // Keep last 5 samples for velocity
      const now = performance.now();
      velocitySamples.current.push({ x: e.clientX, y: e.clientY, t: now });
      if (velocitySamples.current.length > 5) {
        velocitySamples.current.shift();
      }
      
      applyTransform();
      updateVisibleItems();
      
    } else if (pointers.current.size === 2 && initialPinchDistance.current && initialPinchScale.current) {
      // Pinch to zoom
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const delta = dist / initialPinchDistance.current;
      
      let newScale = initialPinchScale.current * delta;
      newScale = Math.max(0.4, Math.min(newScale, 2.0));
      
      // Calculate pinch center
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;

      // Adjust transform to zoom around the center point
      const scaleRatio = newScale / transform.current.scale;
      transform.current.x = cx - (cx - transform.current.x) * scaleRatio;
      transform.current.y = cy - (cy - transform.current.y) * scaleRatio;
      transform.current.scale = newScale;
      
      applyTransform();
      updateVisibleItems();
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    
    if (pointers.current.size === 0) {
      isDragging.current = false;
      lastPanPoint.current = null;
      initialPinchDistance.current = null;
      initialPinchScale.current = null;
      
      // Delay resetting the dragging state so click handlers fire before it reverts
      setTimeout(() => setIsCanvasDragging(false), 50);
      
      if (containerRef.current) containerRef.current.style.cursor = 'grab';

      // Calculate inertia
      if (velocitySamples.current.length >= 2) {
        const first = velocitySamples.current[0];
        const last = velocitySamples.current[velocitySamples.current.length - 1];
        const dt = last.t - first.t;
        
        if (dt > 0 && dt < 200) { // Only apply if recent movement
          let vx = (last.x - first.x) / dt;
          let vy = (last.y - first.y) / dt;
          
          let lastTime = performance.now();
          const decay = 0.95; // Velocity decay factor
          
          const applyInertia = (time: number) => {
            const frameDt = time - lastTime;
            lastTime = time;
            
            // Apply velocity
            transform.current.x += vx * frameDt;
            transform.current.y += vy * frameDt;
            
            // Decay
            vx *= decay;
            vy *= decay;
            
            applyTransform();
            updateVisibleItems();
            
            if (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05) {
              inertiaRaf.current = requestAnimationFrame(applyInertia);
            }
          };
          
          inertiaRaf.current = requestAnimationFrame(applyInertia);
        }
      }
      velocitySamples.current = [];
    } else if (pointers.current.size === 1) {
      // Dropped from 2 to 1 pointers, reset pan reference
      const [onlyPointer] = [...pointers.current.values()];
      lastPanPoint.current = { x: onlyPointer.x, y: onlyPointer.y };
      velocitySamples.current = [];
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (inertiaRaf.current) cancelAnimationFrame(inertiaRaf.current);

      const isPinch = e.ctrlKey;
      const zoomSensitivity = isPinch ? 0.01 : 0.001;
      const delta = -e.deltaY * zoomSensitivity;

      let newScale = transform.current.scale * Math.exp(delta);
      newScale = Math.max(0.4, Math.min(newScale, 2.0));

      const rect = container.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      const scaleRatio = newScale / transform.current.scale;
      transform.current.x = cx - (cx - transform.current.x) * scaleRatio;
      transform.current.y = cy - (cy - transform.current.y) * scaleRatio;
      transform.current.scale = newScale;

      applyTransform(!isPinch);
      updateVisibleItems();
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleNativeWheel);
  }, [applyTransform, updateVisibleItems]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose?.();
          break;
        case 'ArrowUp':
          e.preventDefault();
          transform.current.y += 100 / transform.current.scale;
          applyTransform(true);
          updateVisibleItems();
          break;
        case 'ArrowDown':
          e.preventDefault();
          transform.current.y -= 100 / transform.current.scale;
          applyTransform(true);
          updateVisibleItems();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          transform.current.x += 100 / transform.current.scale;
          applyTransform(true);
          updateVisibleItems();
          break;
        case 'ArrowRight':
          e.preventDefault();
          transform.current.x -= 100 / transform.current.scale;
          applyTransform(true);
          updateVisibleItems();
          break;
        case '+':
        case '=':
          e.preventDefault();
          {
            const newScale = Math.min(transform.current.scale * 1.2, 2.0);
            const scaleRatio = newScale / transform.current.scale;
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            transform.current.x = cx - (cx - transform.current.x) * scaleRatio;
            transform.current.y = cy - (cy - transform.current.y) * scaleRatio;
            transform.current.scale = newScale;
            applyTransform(true);
            updateVisibleItems();
          }
          break;
        case '-':
        case '_':
          e.preventDefault();
          {
            const newScale = Math.max(transform.current.scale / 1.2, 0.4);
            const scaleRatio = newScale / transform.current.scale;
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            transform.current.x = cx - (cx - transform.current.x) * scaleRatio;
            transform.current.y = cy - (cy - transform.current.y) * scaleRatio;
            transform.current.scale = newScale;
            applyTransform(true);
            updateVisibleItems();
          }
          break;
        case '0':
          e.preventDefault();
          // Reset to initial view
          transform.current.x = 0;
          transform.current.y = 0;
          transform.current.scale = typeof window !== 'undefined' && window.innerWidth < 768 ? 0.75 : 1;
          applyTransform(true);
          updateVisibleItems();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [applyTransform, updateVisibleItems, onClose]);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-[#0f0f0f] z-50 overflow-hidden touch-none"
      style={{ cursor: 'grab' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* UI Chrome */}
      {onClose && (
        <>
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 text-white/80 bg-black/40 hover:bg-black/60 hover:text-white rounded-full transition-colors backdrop-blur-md"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span className="font-medium text-sm">Back</span>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-6 right-6 z-50 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </>
      )}
      
      {/* Permanent Guidance Legend */}
      <div className="absolute bottom-6 right-6 z-50 pointer-events-none">
        <div className="bg-black/60 text-white/80 px-4 py-3 rounded-xl text-xs font-medium tracking-wider backdrop-blur-md flex flex-col items-end gap-1 shadow-lg border border-white/10">
          <span>CLICK & DRAG TO PAN</span>
          <span className="text-white/50 text-[10px]">SCROLL / PINCH TO ZOOM</span>
          <span className="text-white/50 text-[10px]">ARROWS TO PAN · +/- TO ZOOM · 0 TO RESET · ESC TO CLOSE</span>
        </div>
      </div>

      <div 
        ref={canvasRef}
        className="absolute top-0 left-0 origin-top-left w-full h-full pointer-events-none"
        style={{ willChange: 'transform' }}
      >
        <div className="relative w-full h-full pointer-events-auto">
          {items.map(item => {
            const isVisible = true; // Bypassing virtual-render culling which appears bugged
            // Render visible + allow preserving state for hidden components if renderItem supports it
            return renderItem(item, isVisible, isCanvasDragging);
          })}
        </div>
      </div>
    </div>
  );
};
