import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden="true">
      <defs>
        <linearGradient id="bm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#195764" />
          <stop offset="1" stopColor="#80a874" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill="url(#bm)" />
      <path d="M9 19c2.5-6 4.5-6 6-1.5S19 23 23 13" fill="none" stroke="#eaf3de" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="23" cy="13" r="2.4" fill="#ad7556" stroke="#eaf3de" strokeWidth="1.4" />
    </svg>
  );
}
