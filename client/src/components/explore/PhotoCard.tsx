import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useTilt } from '../../hooks/useTilt';
import { cn } from '../../lib/utils';

export interface PhotoCardProps {
  id: string;
  thumbnailUrl: string;
  date: string;
  size?: string;
  badge?: {
    label: string;
    variant: 'danger' | 'amber' | 'success';
  };
  selected: boolean;
  onToggle: (id: string) => void;
  onClick?: () => void;
}

const badgeStyles = {
  danger: 'bg-red-500/80 text-white',
  amber: 'bg-amber-500/80 text-white',
  success: 'bg-[#22c982]/80 text-white',
};

export function PhotoCard({
  id,
  thumbnailUrl,
  date,
  size,
  badge,
  selected,
  onToggle,
  onClick,
}: PhotoCardProps) {
  const tiltRef = useTilt(true);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 14, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1 },
      }}
      className="group relative cursor-pointer"
      onClick={onClick}
    >
      <div
        ref={tiltRef}
        className={cn(
          "relative aspect-square w-full overflow-hidden rounded-[12px] bg-black/20 border-2 transition-colors duration-200",
          selected ? "border-[#22c982]" : "border-transparent group-hover:border-white/10"
        )}
      >
        <img
          src={thumbnailUrl}
          alt="Thumbnail"
          className="h-full w-full object-cover"
          loading="lazy"
        />

        {/* Selected Overlay Tint */}
        {selected && (
          <div className="absolute inset-0 bg-[#22c982]/10 mix-blend-overlay pointer-events-none" />
        )}

        {/* Hover Gradient Overlay */}
        <div className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8 transition-opacity duration-200",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          <div className="flex flex-col gap-0.5 text-xs text-white/90 font-medium translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
            <span>{date}</span>
            {size && <span className="text-white/60">{size}</span>}
          </div>
        </div>

        {/* Badge */}
        {badge && (
          <div className={cn(
            "absolute top-2 right-2 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm",
            badgeStyles[badge.variant]
          )}>
            {badge.label}
          </div>
        )}

        {/* Checkbox */}
        <div 
          className={cn(
            "absolute top-2 left-2 flex h-[22px] w-[22px] items-center justify-center rounded-[7px] border transition-all duration-200",
            selected
              ? "border-[#22c982] bg-[#22c982] text-white opacity-100"
              : "border-white/40 bg-black/20 text-transparent opacity-0 group-hover:opacity-100 hover:border-white/80 hover:bg-black/40"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(id);
          }}
        >
          <Check size={14} strokeWidth={3} />
        </div>
      </div>
    </motion.div>
  );
}
