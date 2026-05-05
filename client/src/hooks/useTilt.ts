import { useEffect, useRef } from 'react';

export function useTilt(enabled = true) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;

    const el = ref.current;
    if (!el) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Max tilt angle is 9 degrees
      const tiltX = ((y - centerY) / centerY) * -9;
      const tiltY = ((x - centerX) / centerX) * 9;

      el.style.transform = `perspective(550px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.02)`;
      el.style.transition = 'transform 0.1s ease-out';
      el.style.zIndex = '10';
    };

    const handleMouseLeave = () => {
      el.style.transform = `perspective(550px) rotateX(0deg) rotateY(0deg) scale(1)`;
      el.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
      el.style.zIndex = '1';
    };

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [enabled]);

  return ref;
}
