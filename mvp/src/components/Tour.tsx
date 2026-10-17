import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, MousePointerClick, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Panduan bergaya tutorial game: layar diredupkan, elemen yang harus diperhatikan dikotakkan
 * dengan sorotan berdenyut, dan kartu langkah menempel di dekatnya.
 * Target ditandai dengan atribut data-tour="nama" di elemen mana pun (halaman baru maupun lama).
 */
export type TourStep = {
  /** nilai data-tour pada elemen target; kosong = kartu di tengah layar */
  target?: string;
  title: string;
  body: ReactNode;
  /** langkah lanjut otomatis saat target diklik */
  waitForClick?: boolean;
  padding?: number;
};

const KEY = (id: string) => `sinaps-tour-${id}`;

export function tourSeen(id: string) {
  try {
    return localStorage.getItem(KEY(id)) === '1';
  } catch {
    return true;
  }
}

/** State panduan: mulai otomatis sekali per perangkat, bisa diputar ulang lewat start(). */
export function useTour(id: string, { autoStart = true, delay = 900, when = true }: { autoStart?: boolean; delay?: number; when?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!autoStart || !when || tourSeen(id)) return;
    const t = setTimeout(() => setOpen(true), delay);
    return () => clearTimeout(t);
  }, [id, autoStart, delay, when]);
  const close = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(KEY(id), '1');
    } catch {
      /* penyimpanan diblokir: panduan akan muncul lagi, tidak masalah */
    }
  }, [id]);
  return { open, start: () => setOpen(true), close };
}

type Rect = { x: number; y: number; w: number; h: number };

export function Tour({ steps, open, onClose, label = 'Panduan' }: { steps: TourStep[]; open: boolean; onClose: () => void; label?: string }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(220);
  const reduce = useReducedMotion();
  const step = steps[i];

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  const findEl = useCallback(() => (step?.target ? (document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null) : null), [step]);

  // gulir target ke tengah, lalu ikuti posisinya setiap frame (tata letak bisa bergeser karena animasi)
  useEffect(() => {
    if (!open || !step) return;
    let raf = 0;
    let tries = 0;
    const el0 = findEl();
    if (step.target && !el0) {
      // target belum ada (misal masih memuat): tunggu sebentar, lalu lewati bila tetap tidak ada
      const t = setInterval(() => {
        if (findEl() || ++tries > 12) {
          clearInterval(t);
          if (!findEl()) setI((x) => Math.min(steps.length - 1, x + 1));
          else setRect(null);
        }
      }, 150);
      return () => clearInterval(t);
    }
    el0?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    const pad = step.padding ?? 8;
    const loop = () => {
      const el = findEl();
      if (el) {
        const r = el.getBoundingClientRect();
        setRect((p) => {
          const n = { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
          return p && Math.abs(p.x - n.x) < 0.5 && Math.abs(p.y - n.y) < 0.5 && Math.abs(p.w - n.w) < 0.5 && Math.abs(p.h - n.h) < 0.5 ? p : n;
        });
      } else setRect(null);
      setVp((p) => (p.w === window.innerWidth && p.h === window.innerHeight ? p : { w: window.innerWidth, h: window.innerHeight }));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open, step, findEl, reduce, steps.length]);

  const next = useCallback(() => (i >= steps.length - 1 ? onClose() : setI(i + 1)), [i, steps.length, onClose]);
  const back = () => setI((x) => Math.max(0, x - 1));

  // langkah "klik target": lanjut saat target diklik
  useEffect(() => {
    if (!open || !step?.waitForClick) return;
    const el = findEl();
    if (!el) return;
    const h = () => setTimeout(next, 120);
    el.addEventListener('click', h, { once: true });
    return () => el.removeEventListener('click', h);
  }, [open, step, findEl, next, rect === null]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && !step?.waitForClick) next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, next, onClose, step]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [i, open, rect?.w]);

  if (!open || !step) return null;

  // posisi kartu: di bawah target bila muat, lalu di atas, lalu di samping; selalu di dalam layar
  const CW = Math.min(340, vp.w - 24);
  const gap = 16;
  let cx = vp.w / 2 - CW / 2;
  let cy = vp.h / 2 - cardH / 2;
  let side: 'top' | 'bottom' | 'center' = 'center';
  if (rect) {
    const below = vp.h - (rect.y + rect.h);
    if (below >= cardH + gap + 8) {
      cy = rect.y + rect.h + gap;
      side = 'bottom';
    } else if (rect.y >= cardH + gap + 8) {
      cy = rect.y - cardH - gap;
      side = 'top';
    } else if (vp.w - (rect.x + rect.w) >= CW + gap + 8) {
      cx = rect.x + rect.w + gap;
      cy = rect.y + rect.h / 2 - cardH / 2;
    } else if (rect.x >= CW + gap + 8) {
      cx = rect.x - CW - gap;
      cy = rect.y + rect.h / 2 - cardH / 2;
    } else {
      cy = vp.h - cardH - 16;
    }
    if (side !== 'center') cx = rect.x + rect.w / 2 - CW / 2;
    cx = Math.max(12, Math.min(vp.w - CW - 12, cx));
    cy = Math.max(12, Math.min(vp.h - cardH - 12, cy));
  }
  const arrowX = rect ? Math.max(20, Math.min(CW - 20, rect.x + rect.w / 2 - cx)) : 0;
  const R = rect ? Math.min(22, rect.h / 2, rect.w / 2) : 0;
  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 260, damping: 30 };

  return createPortal(
    <div className="tw pointer-events-none fixed inset-0 z-[1000] !bg-transparent" role="dialog" aria-modal="true" aria-label={label}>
      {/* lapisan redup dengan lubang di target */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" width={vp.w} height={vp.h}>
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="white" />
            {rect && <motion.rect initial={false} animate={{ x: rect.x, y: rect.y, width: rect.w, height: rect.h }} transition={spring} rx={R} fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(6,26,31,0.64)" mask="url(#tour-hole)" />
      </svg>
      {/* penghalang klik di luar lubang; target tetap bisa diklik */}
      {rect ? (
        <>
          <div className="pointer-events-auto absolute inset-x-0 top-0" style={{ height: Math.max(0, rect.y) }} onClick={(e) => e.stopPropagation()} />
          <div className="pointer-events-auto absolute inset-x-0 bottom-0" style={{ top: rect.y + rect.h }} />
          <div className="pointer-events-auto absolute left-0" style={{ top: rect.y, height: rect.h, width: Math.max(0, rect.x) }} />
          <div className="pointer-events-auto absolute right-0" style={{ top: rect.y, height: rect.h, left: rect.x + rect.w }} />
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0" />
      )}

      {/* bingkai sorotan berdenyut */}
      {rect && (
        <motion.div initial={false} animate={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} transition={spring} className="pointer-events-none absolute" style={{ borderRadius: R }}>
          <span className="absolute inset-0 animate-pulse-ring rounded-[inherit] ring-2 ring-leaf" />
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <span
              key={c}
              className={cn('absolute size-4 border-terra', c === 'tl' && '-left-1.5 -top-1.5 rounded-tl-lg border-l-[3px] border-t-[3px]', c === 'tr' && '-right-1.5 -top-1.5 rounded-tr-lg border-r-[3px] border-t-[3px]', c === 'bl' && '-bottom-1.5 -left-1.5 rounded-bl-lg border-b-[3px] border-l-[3px]', c === 'br' && '-bottom-1.5 -right-1.5 rounded-br-lg border-b-[3px] border-r-[3px]')}
            />
          ))}
          {step.waitForClick && (
            <motion.span className="absolute -bottom-7 right-2 text-mint drop-shadow" animate={reduce ? {} : { y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 1.1 }}>
              <MousePointerClick className="size-7" />
            </motion.span>
          )}
        </motion.div>
      )}

      {/* kartu langkah */}
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          ref={cardRef}
          initial={reduce ? false : { opacity: 0, y: side === 'top' ? -8 : 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.25 }}
          className="pointer-events-auto absolute rounded-3xl border border-white/70 bg-paper p-5 text-ink shadow-[0_30px_70px_-20px_rgba(6,26,31,.7)]"
          style={{ width: CW, left: cx, top: cy }}
          aria-live="polite"
        >
          {side !== 'center' && rect && <span className={cn('absolute size-3.5 rotate-45 bg-paper', side === 'bottom' ? '-top-1.5' : '-bottom-1.5')} style={{ left: arrowX - 7 }} />}
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-2.5 py-1 font-mono text-[10.5px] font-medium tracking-wide text-teal">
              <Sparkles className="size-3" /> {label.toUpperCase()} · {i + 1}/{steps.length}
            </span>
            <button onClick={onClose} className="grid size-8 place-items-center rounded-full text-ink/45 hover:bg-ink/5 hover:text-ink" aria-label="Tutup panduan">
              <X className="size-4" />
            </button>
          </div>
          <h3 className="mt-3 font-serif text-[1.21rem] leading-tight tracking-[-0.01em]">{step.title}</h3>
          <div className="mt-1.5 text-[14px] leading-relaxed text-ink/70">{step.body}</div>
          {step.waitForClick && (
            <p className="mt-3 flex items-center gap-2 rounded-2xl bg-terra/10 px-3 py-2 text-[12.5px] font-medium text-terra">
              <MousePointerClick className="size-4 shrink-0" /> Klik bagian yang disorot untuk lanjut
            </p>
          )}
          <div className="mt-4 flex items-center gap-2">
            <div className="mr-auto flex gap-1">
              {steps.map((_, k) => (
                <span key={k} className={cn('h-1.5 rounded-full transition-all duration-300', k === i ? 'w-5 bg-teal' : k < i ? 'w-1.5 bg-sage' : 'w-1.5 bg-ink/15')} />
              ))}
            </div>
            {i > 0 && (
              <button onClick={back} className="grid size-9 place-items-center rounded-full border border-ink/10 text-ink/70 hover:bg-ink/5" aria-label="Langkah sebelumnya">
                <ArrowLeft className="size-4" />
              </button>
            )}
            {step.waitForClick ? (
              <button onClick={next} className="h-9 rounded-full px-3 text-[12.5px] text-ink/55 hover:bg-ink/5 hover:text-ink">
                Lewati langkah
              </button>
            ) : (
              <button onClick={next} autoFocus className="flex h-9 items-center gap-1.5 rounded-full bg-teal px-4 text-[13px] font-medium text-mint hover:bg-teal-600">
                {i === steps.length - 1 ? 'Selesai' : 'Lanjut'}
                {i < steps.length - 1 && <ArrowRight className="size-3.5" />}
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}
