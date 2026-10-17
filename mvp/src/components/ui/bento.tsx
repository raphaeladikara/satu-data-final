import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Kartu bento (adaptasi 21st.dev "FUI Bento Grid"): visual besar di atas, panel teks ber-blur
 * yang menumpuk naik di bawahnya. Versi SINAPS memakai teal tua dengan cahaya sage di dalam,
 * supaya kontras di atas halaman berlatar kertas.
 */
export function BentoCard({
  eyebrow,
  title,
  description,
  graphic,
  className,
  graphicClassName,
  tone = 'teal',
  fade = ['bottom'],
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  graphic?: ReactNode;
  className?: string;
  /** tinggi area visual, default h-[18rem] */
  graphicClassName?: string;
  tone?: 'teal' | 'deep';
  fade?: ('top' | 'bottom')[];
  children?: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.article
      initial="idle"
      whileHover={reduce ? undefined : 'active'}
      variants={{ idle: {}, active: {} }}
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] text-mint',
        'ring-1 ring-white/10 [box-shadow:0_-20px_80px_-20px_rgba(170,211,156,.16)_inset,0_30px_60px_-34px_rgba(6,26,31,.7)]',
        tone === 'teal' ? 'bg-[radial-gradient(120%_80%_at_50%_0%,#1a5562_0%,#0f3a43_48%,#0a262c_100%)]' : 'bg-[radial-gradient(120%_80%_at_50%_0%,#123f48_0%,#0a262c_55%,#061a1f_100%)]',
        className,
      )}
    >
      <div className={cn('relative shrink-0 overflow-hidden', graphicClassName ?? 'h-[18rem]')}>
        <motion.div className="absolute inset-0" variants={{ idle: { scale: 1 }, active: { scale: 1.035 } }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          {graphic}
        </motion.div>
        {fade.includes('top') && <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-teal-950/70 to-40%" />}
        {fade.includes('bottom') && <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-teal-950/80 to-45%" />}
      </div>
      <div className="relative isolate z-20 -mt-20 flex flex-1 flex-col bg-teal-950/30 p-7 backdrop-blur-xl [mask-image:linear-gradient(to_bottom,transparent,black_28px)] sm:p-8">
        {/* label di atas judul sengaja tidak dirender: judul sudah cukup */}
        <h3 className="pt-3 text-[21px] font-semibold leading-snug tracking-[-0.01em]">{title}</h3>
        {description && <p className="mt-2 max-w-[36rem] text-[14px] leading-relaxed text-mint/65">{description}</p>}
        {children}
      </div>
    </motion.article>
  );
}

/** Kisi titik halus, latar visual bento. */
export function DotGrid({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('absolute inset-0 bg-[radial-gradient(rgba(147,199,207,.16)_1px,transparent_1px)] bg-[size:18px_18px] [mask-image:radial-gradient(70%_70%_at_50%_40%,black,transparent)]', className)} />;
}

const ACCENT: Record<string, string> = { leaf: '#aad39c', sky: '#93c7cf', terra: '#e08a5f', sand: '#dccfb8' };

/** Tile angka bergaya bento gelap: ikon bercahaya di atas kisi titik, angka besar, label kecil. */
export function StatTile({ icon: Icon, accent = 'leaf', value, of, label, layout = 'stack', className }: { icon: (p: { className?: string }) => ReactNode; accent?: keyof typeof ACCENT | string; value: ReactNode; of?: ReactNode; label: ReactNode; layout?: 'stack' | 'row'; className?: string }) {
  const c = ACCENT[accent] ?? accent;
  return (
    <div className={cn('card-dark group relative isolate flex overflow-hidden rounded-[1.6rem] p-5', layout === 'stack' ? 'min-h-[10.5rem] flex-col justify-between' : 'items-center gap-4', className)}>
      <DotGrid className="opacity-70" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full opacity-30 blur-2xl transition-opacity duration-500 group-hover:opacity-50" style={{ background: c }} />
      <span className="relative grid size-10 shrink-0 place-items-center rounded-2xl ring-1" style={{ color: c, background: `${c}22`, boxShadow: `0 0 28px -6px ${c}88`, borderColor: `${c}55` }}>
        <Icon className="size-[18px]" />
      </span>
      <div className={cn('relative min-w-0', layout === 'stack' && 'mt-6')}>
        <b className="block text-[1.9rem] font-bold leading-none tabular-nums">
          {value}
          {of && <span className="text-[1.1rem] font-normal text-mint/45">{of}</span>}
        </b>
        <p className="mt-1.5 font-display text-[11.5px] uppercase leading-snug tracking-[0.14em] text-mint/60">{label}</p>
      </div>
    </div>
  );
}
