import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface DonutChartData {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutChartData[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSubLabel?: string;
}

export function DonutChart({
  data,
  size = 200,
  strokeWidth = 24,
  centerLabel,
  centerSubLabel
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const total = useMemo(() => data.reduce((acc, curr) => acc + curr.value, 0), [data]);

  let currentOffset = 0;
  const segments = useMemo(() => {
    return data.map((item) => {
      // If total is 0, render empty gray ring
      if (total === 0) return null;
      
      const percent = item.value / total;
      const arcLength = percent * circumference;
      const strokeDasharray = `${arcLength} ${circumference - arcLength}`;
      const strokeDashoffset = -currentOffset;
      
      currentOffset += arcLength;
      
      return {
        ...item,
        strokeDasharray,
        strokeDashoffset,
        percent
      };
    }).filter(Boolean);
  }, [data, total, circumference]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
        {/* Background empty ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-primary)"
          strokeWidth={strokeWidth}
        />
        
        {total > 0 && segments.map((segment, index) => (
          segment && (
            <motion.circle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={segment.strokeDasharray}
              strokeDashoffset={segment.strokeDashoffset}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: segment.strokeDasharray }}
              transition={{ duration: 1, delay: index * 0.1, ease: 'easeOut' }}
              strokeLinecap="butt"
            />
          )
        ))}
      </svg>
      
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {centerLabel && <span className="text-2xl font-bold text-[var(--text-primary)]">{centerLabel}</span>}
        {centerSubLabel && <span className="text-xs text-[var(--text-secondary)]">{centerSubLabel}</span>}
      </div>
    </div>
  );
}
