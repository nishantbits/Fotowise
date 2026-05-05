import React, { useState } from 'react';
import { motion } from 'framer-motion';

export interface PhotoCardProps {
  id: string;
  imgUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  isVideo?: boolean;
  onClick?: () => void;
  isVisible: boolean;
  layoutId?: string;
}

export const PhotoCard: React.FC<PhotoCardProps> = ({
  imgUrl,
  x,
  y,
  width,
  height,
  rotation,
  isVideo,
  onClick,
  isVisible,
  layoutId
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // If not visible, we can just render an empty placeholder to keep the layout accurate 
  // without loading the heavy image immediately (or render nothing if handled by parent).
  // The parent MemoryCanvas uses position relative on the wrapper.
  
  if (!isVisible) {
    return null; // The engine already manages visibility, so we don't need to mount off-screen
  }

  return (
    <motion.div
      layoutId={layoutId}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${width}px`,
        height: `${height}px`,
        // Parent translates via CSS so we use exact translate to position
        transform: `translate(${x}px, ${y}px) translateY(${isHovered ? -5 : 0}px) rotate(${isHovered ? 0 : rotation}deg)`,
        backgroundColor: '#eee',
        border: '3px solid #ffffff',
        borderRadius: '0px',
        boxShadow: isHovered 
          ? '0 16px 48px rgba(0,0,0,0.8)' 
          : '0 8px 32px rgba(0,0,0,0.6)',
        transition: layoutId ? 'none' : 'all 200ms ease', // Let framer-motion handle transition if layoutId is present
        cursor: 'pointer',
        overflow: 'hidden', // maintain sharp edges for the image
        zIndex: isHovered ? 10 : 1, // pop to front on hover
      }}
      className="group"
    >
      <img 
        src={imgUrl} 
        alt="Memory photo"
        loading="lazy"
        draggable={false}
        className="w-full h-full object-cover select-none pointer-events-none"
      />
      
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
          <div className="w-12 h-12 bg-white/70 rounded-full flex items-center justify-center backdrop-blur-sm">
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="black" 
              className="ml-1 opacity-80"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
      )}
    </motion.div>
  );
};
