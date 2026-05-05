import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GripVertical, Star } from 'lucide-react';
import { mediaApi } from '../../lib/api';

interface PhotoReorderProps {
  photoIds: string[];
  onReorder: (newOrder: string[]) => void;
}

export const PhotoReorder: React.FC<PhotoReorderProps> = ({ photoIds, onReorder }) => {
  const [items, setItems] = useState(photoIds);

  useEffect(() => {
    setItems(photoIds);
  }, [photoIds]);

  const handleReorder = (newOrder: string[]) => {
    setItems(newOrder);
    onReorder(newOrder);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-t3">
        Photo Order (First 3 are cover)
      </p>
      <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-2">
        {items.map((id, index) => (
          <motion.div
            key={id}
            layoutId={id}
            className={`flex items-center gap-3 p-2 rounded-xl border transition-colors ${
              index < 3
                ? 'bg-accent/10 border-accent/30'
                : 'bg-bg-primary/60 border-white/5'
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                className="p-1.5 rounded-lg hover:bg-white/10 text-t3 cursor-grab active:cursor-grabbing"
                title="Drag to reorder"
              >
                <GripVertical size={14} />
              </button>
              <span className={`text-xs font-medium w-5 text-center ${
                index < 3 ? 'text-accent' : 'text-t3'
              }`}>
                {index + 1}
              </span>
            </div>

            <img
              src={mediaApi.getThumbnailUrl(id, '200')}
              alt={`Photo ${index + 1}`}
              className="w-10 h-10 rounded-lg object-cover"
            />

            <div className="flex-1 min-w-0">
              <p className="text-xs text-t2 truncate">
                {index < 3 ? (
                  <span className="flex items-center gap-1">
                    <Star size={10} className="text-accent" />
                    Cover photo
                  </span>
                ) : (
                  'In memory'
                )}
              </p>
            </div>

            <div className="flex gap-1">
              {index > 0 && (
                <button
                  onClick={() => {
                    const newItems = [...items];
                    [newItems[index], newItems[index - 1]] = [newItems[index - 1], newItems[index]];
                    handleReorder(newItems);
                  }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-t3 hover:text-t1"
                  title="Move up"
                >
                  ↑
                </button>
              )}
              {index < items.length - 1 && (
                <button
                  onClick={() => {
                    const newItems = [...items];
                    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
                    handleReorder(newItems);
                  }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-t3 hover:text-t1"
                  title="Move down"
                >
                  ↓
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
      <p className="text-[11px] text-t3">
        The first 3 photos will be displayed on the memory card cover.
      </p>
    </div>
  );
};
