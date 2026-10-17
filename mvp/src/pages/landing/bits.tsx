import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';

export const EASE = [0.22, 1, 0.36, 1] as const;

/** Muncul pelan saat masuk layar. */
export function Reveal({ children, delay = 0, y = 24, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Angka yang menghitung naik sekali saat terlihat. Format Indonesia (koma desimal, titik ribuan). */
export function CountUp({ to, decimals = 0, suffix = '', prefix = '', duration = 1.6, className }: { to: number; decimals?: number; suffix?: string; prefix?: string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!inView || reduce) {
      if (reduce) setV(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / (duration * 1000));
      setV(to * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, to, duration]);
  const text = v.toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}

export function Eyebrow({ children, tone = 'teal', className }: { children: ReactNode; tone?: 'teal' | 'light'; className?: string }) {
  return (
    <p
      className={cn(
        'inline-flex items-center gap-2.5 font-display text-[12.5px] font-medium uppercase tracking-[0.22em]',
        tone === 'teal' ? 'text-teal' : 'text-leaf',
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', tone === 'teal' ? 'bg-sage' : 'bg-leaf')} />
      {children}
    </p>
  );
}

/** Coretan tangan di atas kata (gaya Kira). */
export function Strike({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative inline-block text-ink/45">
      {children}
      <svg viewBox="0 0 200 24" preserveAspectRatio="none" className="pointer-events-none absolute -left-[4%] top-[48%] h-[0.45em] w-[108%] overflow-visible" aria-hidden="true">
        <motion.path
          d="M3 15 C 40 6, 80 19, 120 10 S 180 8, 197 12"
          fill="none"
          stroke="#ad7556"
          strokeWidth="5"
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
        />
      </svg>
    </span>
  );
}

/** Blok stabilo yang menyapu masuk di belakang kata kunci. */
export function Highlight({ children, color = 'var(--color-leaf)', delay = 0.2 }: { children: ReactNode; color?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative inline-block whitespace-nowrap px-[0.1em]">
      <motion.span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-[0.06em] top-[0.14em] -z-0 origin-left rounded-[0.16em]"
        style={{ background: color }}
        initial={reduce ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay, ease: EASE }}
      />
      <span className="relative">{children}</span>
    </span>
  );
}

/** Judul yang kata-katanya menyala satu per satu mengikuti gulir (scroll-linked). */
export function ScrollWords({ text, className, dim = 'opacity-[0.16]' }: { text: string; className?: string; dim?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'start 0.3'] });
  const words = text.split(' ');
  if (reduce) return <p className={className}>{text}</p>;
  return (
    <p ref={ref} className={cn('flex flex-wrap', className)}>
      {words.map((w, i) => (
        <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} dim={dim}>
          {w}
        </Word>
      ))}
    </p>
  );
}

function Word({ children, progress, range, dim }: { children: string; progress: MotionValue<number>; range: [number, number]; dim: string }) {
  const opacity = useTransform(progress, range, [0, 1]);
  return (
    <span className="relative mr-[0.26em]">
      <span className={dim}>{children}</span>
      <motion.span style={{ opacity }} className="absolute inset-0">
        {children}
      </motion.span>
    </span>
  );
}

/** Geser vertikal halus mengikuti gulir (parallax). */
export function Parallax({ children, offset = 60, className }: { children: ReactNode; offset?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset]);
  return (
    <motion.div ref={ref} style={reduce ? undefined : { y }} className={className}>
      {children}
    </motion.div>
  );
}
