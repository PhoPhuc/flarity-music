import React, { memo } from 'react';

interface SoundWaveProps {
  className?: string;
  barClassName?: string;
}

export const SoundWave: React.FC<SoundWaveProps> = memo(({ className = '', barClassName = 'bg-apple-pink' }) => {
  return (
    <div className={`flex items-end justify-center gap-0.5 h-4 w-4 ${className}`}>
      <span className={`w-1 h-full rounded-full origin-bottom will-change-transform animate-[soundWave1_0.6s_ease-in-out_infinite_alternate] ${barClassName}`} />
      <span className={`w-1 h-full rounded-full origin-bottom will-change-transform animate-[soundWave2_0.8s_ease-in-out_infinite_alternate] ${barClassName}`} />
      <span className={`w-1 h-full rounded-full origin-bottom will-change-transform animate-[soundWave3_0.5s_ease-in-out_infinite_alternate] ${barClassName}`} />
    </div>
  );
});

SoundWave.displayName = 'SoundWave';

