import React from 'react';
import { motion } from 'framer-motion';
import { Trash2, Pencil } from 'lucide-react';

export interface MemoryData {
  id: string;
  title: string;
  subtitle: string;
  dateRange: string;
  photoCount: number;
  coverPhotos: string[]; // At least 3 photos for the fan effect
  allPhotos?: { id: string; url: string }[]; // All photos for reordering
}

interface MemoryEntryCardProps {
  memory: MemoryData;
  onExplore: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}

export const MemoryEntryCard: React.FC<MemoryEntryCardProps> = ({ memory, onExplore, onDelete, onEdit }) => {
  const [heroImg, leftImg, rightImg] = memory.coverPhotos;

  return (
    <div className="relative w-full max-w-4xl mx-auto flex flex-col md:flex-row items-center md:items-end justify-center py-12 px-4 group px-safe">
      {/* Mobile Text (Shows above card on small screens) */}
      <div className="md:hidden w-full mb-6 text-center">
        <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: '"Syne", sans-serif' }}>
          {memory.title}
        </h2>
        <p className="text-[#888888] text-sm" style={{ fontFamily: '"DM Sans", sans-serif' }}>
          {memory.dateRange} · {memory.photoCount} photos
        </p>
      </div>

      {/* The Stage */}
      <div 
        className="relative w-full aspect-[4/5] sm:aspect-[3/4] md:w-[480px] md:aspect-[4/5] flex items-center justify-center pointer-events-auto"
      >
        {/* Left Flank */}
        <div 
          className="absolute left-[-15%] md:left-[-25%] w-[65%] max-md:w-[55%] aspect-[3/4] rounded-lg overflow-hidden bg-zinc-800 transition-all duration-300 ease-in-out z-0 opacity-70 max-md:opacity-50 scale-[0.92] group-hover:scale-[0.96] origin-right"
          style={{
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
          }}
        >
          {leftImg && (
            <img src={leftImg} alt="Memory left flank" className="w-full h-full object-cover" />
          )}
        </div>

        {/* Right Flank */}
        <div 
          className="absolute right-[-15%] md:right-[-25%] w-[65%] max-md:w-[55%] aspect-[3/4] rounded-lg overflow-hidden bg-zinc-800 transition-all duration-300 ease-in-out z-0 opacity-70 max-md:opacity-50 scale-[0.92] group-hover:scale-[0.96] origin-left"
          style={{
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
          }}
        >
          {rightImg && (
            <img src={rightImg} alt="Memory right flank" className="w-full h-full object-cover" />
          )}
        </div>

        {/* Hero Card Container */}
        <div 
          className="relative w-[85%] md:w-full aspect-[4/5] z-10 cursor-pointer"
          onClick={onExplore}
        >
          <motion.div 
            layoutId={`memory-hero-${memory.id}`}
            className="w-full h-full bg-zinc-900 border-[3px] border-white shadow-[0_12px_48px_rgba(0,0,0,0.8)] overflow-hidden transition-transform duration-300 ease-in-out group-hover:scale-[1.03]"
          >
            <img src={heroImg} alt="Hero memory" className="w-full h-full object-cover" />
            
            {/* Explore Button */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <button 
                className="pointer-events-auto flex items-center gap-2 px-5 py-2.5 rounded-full bg-black/65 hover:bg-black/50 text-white text-sm font-semibold tracking-wide backdrop-blur-md transition-colors"
               >
                <span className="text-[10px] leading-none mb-[1px]">▪</span> EXPLORE
              </button>
            </div>
          </motion.div>

          {/* Action Buttons — placed strictly inside the visible bounds of the hero card! */}
          <div className="absolute top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {onEdit && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
                className="p-2.5 rounded-full bg-black/70 hover:bg-black/90 text-white shadow-xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center border border-white/20 backdrop-blur-md pointer-events-auto"
                title="Edit memory"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
                className="p-2.5 rounded-full bg-red-600/90 hover:bg-red-500 text-white shadow-xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center border border-white/20 backdrop-blur-md pointer-events-auto"
                title="Delete memory"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Desktop Text (Shows bottom-left outside the card container) */}
      <div className="hidden md:block absolute bottom-16 left-8 lg:left-0 z-20 pointer-events-none">
        <h2 className="text-4xl lg:text-5xl font-bold text-white mb-2 drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]" style={{ fontFamily: '"Syne", sans-serif' }}>
          {memory.title}
        </h2>
        <p className="text-zinc-300 font-medium text-base drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" style={{ fontFamily: '"DM Sans", sans-serif' }}>
          {memory.dateRange} · {memory.photoCount} photos
        </p>
      </div>
    </div>
  );
};
