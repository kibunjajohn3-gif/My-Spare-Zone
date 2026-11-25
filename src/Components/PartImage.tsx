import { useState } from 'react';
import { Wrench } from 'lucide-react';

interface PartImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function PartImage({ src, alt, className = '' }: PartImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-100 text-slate-400 p-4 text-center select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <Wrench className="w-7 h-7 mb-2 text-slate-400" strokeWidth={1.6} />
        <span className="text-xs font-medium text-slate-500 line-clamp-2 max-w-[180px]">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
