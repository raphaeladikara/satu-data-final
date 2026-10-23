import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * Logo SINAPS: huruf S dari dua ujung neuron (presinaps terang, pascasinaps sage)
 * yang bertemu di celah sinaps, dengan tiga butir neurotransmiter di tengahnya.
 */
export function BrandMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 48 48" className={cn('size-8 shrink-0', className)} aria-hidden="true">
      <defs>
        <linearGradient id={`bm${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1f6b7a" />
          <stop offset=".55" stopColor="#0f3a43" />
          <stop offset="1" stopColor="#0a262c" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#bm${id})`} />
      <path d="M29.73 12.98A7 7 0 1 0 19.98 22.73" fill="none" stroke="#eaf3de" strokeWidth="4" strokeLinecap="round" />
      <path d="M28.02 25.27A7 7 0 1 1 18.27 35.02" fill="none" stroke="#aad39c" strokeWidth="4" strokeLinecap="round" />
      <circle cx="19.98" cy="22.73" r="3" fill="#eaf3de" />
      <circle cx="28.02" cy="25.27" r="3" fill="#aad39c" />
      <circle cx="24" cy="24" r="1.05" fill="#f09a6c" />
      <circle cx="24.85" cy="21.4" r=".75" fill="#f09a6c" />
      <circle cx="23.15" cy="26.6" r=".75" fill="#f09a6c" />
    </svg>
  );
}

/** Logo + tulisan SINAPS (Oswald kapital berjarak lebar). */
export function Wordmark({ className, markClassName, tone = 'ink' }: { className?: string; markClassName?: string; tone?: 'ink' | 'light' }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark className={markClassName} />
      <span className={cn('font-display text-[19px] font-semibold uppercase leading-none tracking-[0.16em]', tone === 'light' ? 'text-mint' : 'text-ink')}>Sinaps</span>
    </span>
  );
}
