import { lazy, Suspense, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Layers, MessageCircleQuestion, Move3d, ScanLine, Sparkles } from 'lucide-react';
import SculptureHero from '@/components/ui/liquid-sculpture-hero';
import { Spotlight } from '@/components/ui/spotlight';
import { cn } from '@/lib/utils';
import { EASE } from './bits';

const MriHologram = lazy(() => import('@/components/three/MriHologram'));

/**
 * Hero partikel cair (adaptasi 21st.dev liquid-sculpture-hero) dengan "patung" dari irisan FLAIR asli.
 * Saat digulir, hero sedikit mengecil dan sudutnya membulat seperti kartu yang terangkat.
 */
export default function Hero({ cases }: { cases: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);
  const radius = useTransform(scrollYProgress, [0, 0.6], [0, 40]);
  const fade = useTransform(scrollYProgress, [0.4, 1], [1, 0.35]);

  return (
    <div ref={ref} id="top" className="relative">
      <motion.div style={reduce ? undefined : { scale, borderRadius: radius, opacity: fade }} className="origin-top overflow-hidden will-change-transform">
        <SculptureHero
          src="/hero/mri-strip.webp"
          mobileSrc="/hero/mri-portrait.webp"
          imageAlt="Lima irisan aksial FLAIR otak pasien stroke dari dataset SOOP, lesi ditandai warna terakota"
          topInset={92}
          background="#f1efe6"
          textColor="#10313a"
          accentColor="#195764"
          backdropText="Sinaps"
          intro
          strength={1.05}
          radius={200}
          turbulence={1.1}
          headline={'Latih matamu membaca\nMRI stroke.'}
          headlineAccent="MRI stroke."
          body="Baca kasus MRI nyata, tandai lesinya, lalu langsung tahu di bagian mana kamu keliru. Umpan baliknya setingkat voxel, tanpa harus menunggu radiolog."
          primaryCta={{ label: 'Mulai belajar gratis', href: '/daftar' }}
          secondaryCta={{ label: 'Saya dosen', href: '/daftar?peran=dosen' }}
          footnote={
            <>
            <dl className="flex gap-7 border-t border-ink/10 pt-4">
              {[
                [String(cases), 'kasus MRI'],
                ['6', 'modul'],
                ['4', 'metrik nilai'],
              ].map(([n, l]) => (
                <div key={l}>
                  <dt className="text-[22px] font-bold leading-none text-teal">{n}</dt>
                  <dd className="mt-1 font-display text-[11px] uppercase tracking-[0.18em] text-ink/55">{l}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-[12.5px] text-ink/50">Tutor neuroradiologi adaptif · Final ICC Campus Data Week 2026</p>
            </>
          }
        />
      </motion.div>
    </div>
  );
}

/** Hologram 3D dari volume MRI asli: slice merenggang mengikuti gulir, bisa diputar dan diatur. */
export function LabStage() {
  const ref = useRef<HTMLDivElement>(null);
  const [series, setSeries] = useState<'DWI' | 'FLAIR'>('DWI');
  const [split, setSplit] = useState(false);
  const [lesion, setLesion] = useState(true);
  const [scrollEx, setScrollEx] = useState(0);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  useMotionValueEvent(scrollYProgress, 'change', (v) => setScrollEx(Math.min(1, Math.max(0, (v - 0.25) * 2.2))));
  const explode = split ? 1 : scrollEx * 0.9;

  return (
    <motion.div ref={ref} initial={reduce ? false : { opacity: 0, y: 40, scale: 0.97 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 1, ease: EASE }} className="relative">
      <div className="relative aspect-[4/4.2] overflow-hidden rounded-[2rem] bg-[radial-gradient(120%_90%_at_50%_0%,#1f6b7a_0%,#0f3a43_45%,#061a1f_100%)] shadow-[0_40px_80px_-30px_rgba(10,38,44,.65)] ring-1 ring-white/10 sm:aspect-[4/3.4]">
        <Spotlight size={420} className="-z-0" />
        <div className="grain pointer-events-none absolute inset-0 opacity-60 mix-blend-overlay" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(147,199,207,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(147,199,207,.07)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(70%_60%_at_50%_45%,black,transparent)]" />
        <Suspense fallback={null}>
          <MriHologram className="absolute inset-0" series={series} explode={explode} lesion={lesion} />
        </Suspense>
        <div className="pointer-events-none absolute inset-x-5 top-5 flex items-center justify-between font-display text-[11.5px] uppercase tracking-[0.16em] text-sky/80">
          <span className="flex items-center gap-2">
            <span className="size-1.5 animate-pulse rounded-full bg-leaf" /> SOOP sub-754 · {series}
          </span>
          <span className="rounded-full border border-sky/25 px-2.5 py-0.5">25 slice · 6 mm</span>
        </div>
        <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-teal-950/60 p-1 backdrop-blur-md">
            {(['DWI', 'FLAIR'] as const).map((s) => (
              <button key={s} onClick={() => setSeries(s)} aria-pressed={series === s} className={cn('rounded-full px-3.5 py-1.5 font-display text-[12px] tracking-[0.12em] transition-colors', series === s ? 'bg-mint text-teal-900' : 'text-sky/80 hover:text-mint')}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-teal-950/60 p-1 backdrop-blur-md">
            <StageToggle on={split} onClick={() => setSplit(!split)} icon={<Layers className="size-3.5" />} label="Pisahkan slice" />
            <StageToggle on={lesion} onClick={() => setLesion(!lesion)} icon={<ScanLine className="size-3.5" />} label="Kunci lesi" />
          </div>
        </div>
        <p className="pointer-events-none absolute bottom-[4.6rem] left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap text-[11.5px] text-sky/60">
          <Move3d className="size-3.5" /> Seret untuk memutar
        </p>
      </div>

      <FloatCard className="-left-3 top-[14%] sm:-left-8" delay={0.5}>
        <span className="font-display text-[11px] uppercase tracking-[0.16em] text-ink/55">Dice terhadap kunci</span>
        <span className="mt-1 flex items-baseline gap-1.5">
          <b className="text-[26px] leading-none text-teal">0,81</b>
          <span className="rounded-full bg-leaf/50 px-1.5 text-[10px] font-bold text-teal-900">+0,12</span>
        </span>
      </FloatCard>
      <FloatCard className="-right-2 top-[40%] sm:-right-6" delay={0.65} slow>
        <span className="font-display text-[11px] uppercase tracking-[0.16em] text-ink/55">Jenis kesalahan</span>
        <span className="mt-1 flex items-center gap-2 text-[13px] font-bold text-ink">
          <span className="size-2 rounded-full bg-terra" /> Lesi kecil terlewat
        </span>
      </FloatCard>
      <FloatCard className="-left-2 bottom-[16%] hidden max-w-[16rem] sm:-left-10 sm:block" delay={0.8}>
        <span className="flex items-center gap-1.5 font-display text-[11px] uppercase tracking-[0.16em] text-ink/55">
          <MessageCircleQuestion className="size-3.5 text-teal" /> Tutor · Sokratik
        </span>
        <span className="mt-1.5 text-[13px] leading-snug text-ink/85">Ada fokus yang belum kamu tandai. Adakah area terang di DWI yang gelap di ADC sekitar slice 15?</span>
      </FloatCard>
      <p className="mt-3 flex items-center justify-end gap-1.5 text-[11.5px] text-ink/45">
        <Sparkles className="size-3" /> Volume MRI asli dari SOOP (OpenNeuro ds004889, CC0). Angka di kartu hanya ilustrasi.
      </p>
    </motion.div>
  );
}

function StageToggle({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition-colors', on ? 'bg-leaf text-teal-900' : 'text-sky/80 hover:text-mint')}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function FloatCard({ children, className, delay, slow }: { children: React.ReactNode; className?: string; delay: number; slow?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 16, scale: 0.95 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay, ease: EASE }} className={cn('absolute z-20', className)}>
      <div className={cn('flex flex-col rounded-2xl border border-white/60 bg-paper/90 px-4 py-3 shadow-[0_18px_40px_-18px_rgba(16,49,58,.45)] backdrop-blur-xl', reduce ? '' : 'animate-float', slow && '[animation-delay:-3s] [animation-duration:9s]')}>{children}</div>
    </motion.div>
  );
}
