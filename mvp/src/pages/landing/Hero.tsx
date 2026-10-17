import { lazy, Suspense, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { ArrowRight, Layers, MessageCircleQuestion, Move3d, ScanLine, Sparkles } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Spotlight } from '@/components/ui/spotlight';
import { cn } from '@/lib/utils';
import { EASE, Highlight } from './bits';

const MriHologram = lazy(() => import('@/components/three/MriHologram'));

export default function Hero({ cases }: { cases: number }) {
  const reduce = useReducedMotion();
  const fade = (d: number) => (reduce ? {} : { initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.9, delay: d, ease: EASE } });
  return (
    <section id="top" className="relative mx-auto grid max-w-[1320px] items-center gap-10 px-4 pb-16 pt-28 sm:px-6 md:pt-32 lg:grid-cols-[1.02fr_1fr] lg:gap-8 lg:pb-24 lg:pt-36">
      <div className="relative z-10">
        <motion.a {...fade(0)} href="#cara-kerja" className="group inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper/80 py-1 pl-1 pr-3 text-[13px] text-ink/80 backdrop-blur transition-colors hover:border-ink/25">
          <span className="rounded-full bg-teal px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-mint">Final ICC 2026</span>
          Tutor neuroradiologi adaptif
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </motion.a>

        <motion.h1 {...fade(0.08)} className="mt-6 font-serif text-[clamp(2.9rem,6.4vw,5.6rem)] leading-[0.98] tracking-[-0.02em] text-ink">
          Latih mata membaca <Highlight delay={0.6}>MRI stroke</Highlight>, dengan umpan balik <em className="text-teal">setingkat voxel.</em>
        </motion.h1>

        <motion.p {...fade(0.16)} className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-ink/70">
          SINAPS adalah tutor berbasis web untuk mahasiswa kedokteran. Kamu membaca kasus MRI nyata, menandai lesinya, lalu langsung tahu di bagian mana kamu keliru, tanpa harus menunggu radiolog.
        </motion.p>

        <motion.div {...fade(0.24)} className="mt-8 flex flex-wrap items-center gap-3">
          <ButtonLink to="/daftar" size="lg">
            Mulai belajar gratis
            <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" />
          </ButtonLink>
          <ButtonLink to="/daftar?peran=dosen" size="lg" variant="outline">
            Saya dosen
          </ButtonLink>
        </motion.div>

        <motion.dl {...fade(0.32)} className="mt-10 grid max-w-md grid-cols-3 divide-x divide-ink/10 border-y border-ink/10">
          {[
            [String(cases), 'kasus MRI SOOP'],
            ['6', 'modul belajar'],
            ['4', 'metrik penilaian'],
          ].map(([n, l]) => (
            <div key={l} className="px-4 py-4 first:pl-0">
              <dt className="font-serif text-4xl leading-none text-teal">{n}</dt>
              <dd className="mt-1.5 text-[13px] text-ink/60">{l}</dd>
            </div>
          ))}
        </motion.dl>
      </div>

      <HeroStage />
    </section>
  );
}

function HeroStage() {
  const ref = useRef<HTMLDivElement>(null);
  const [series, setSeries] = useState<'DWI' | 'FLAIR'>('DWI');
  const [split, setSplit] = useState(false);
  const [lesion, setLesion] = useState(true);
  const [scrollEx, setScrollEx] = useState(0);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  // slice ikut merenggang saat halaman digulir melewati hero
  useMotionValueEvent(scrollYProgress, 'change', (v) => setScrollEx(Math.min(1, Math.max(0, v * 1.6))));
  const explode = split ? 1 : scrollEx * 0.85;

  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, scale: 0.96, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 1.1, delay: 0.15, ease: EASE }}
      className="relative"
    >
      <div className="relative aspect-[4/4.3] overflow-hidden rounded-[2.25rem] bg-[radial-gradient(120%_90%_at_50%_0%,#1f6b7a_0%,#0f3a43_45%,#061a1f_100%)] shadow-[0_40px_80px_-30px_rgba(10,38,44,.65)] ring-1 ring-white/10 sm:aspect-[4/3.9] lg:aspect-[4/4.4]">
        <Spotlight size={420} className="-z-0" />
        <div className="grain pointer-events-none absolute inset-0 opacity-60 mix-blend-overlay" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(147,199,207,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(147,199,207,.07)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(70%_60%_at_50%_45%,black,transparent)]" />

        <Suspense fallback={null}>
          <MriHologram className="absolute inset-0" series={series} explode={explode} lesion={lesion} />
        </Suspense>

        {/* bilah atas seperti viewer */}
        <div className="pointer-events-none absolute inset-x-5 top-5 flex items-center justify-between font-mono text-[11px] text-sky/80">
          <span className="flex items-center gap-2">
            <span className="size-1.5 animate-pulse rounded-full bg-leaf" /> SOOP sub-754 · {series}
          </span>
          <span className="rounded-full border border-sky/25 px-2 py-0.5">25 slice · 6 mm</span>
        </div>

        {/* kontrol */}
        <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-teal-950/60 p-1 backdrop-blur-md">
            {(['DWI', 'FLAIR'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSeries(s)}
                aria-pressed={series === s}
                className={cn('rounded-full px-3 py-1.5 font-mono text-[11px] tracking-wide transition-colors', series === s ? 'bg-mint text-teal-900' : 'text-sky/80 hover:text-mint')}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-teal-950/60 p-1 backdrop-blur-md">
            <StageToggle on={split} onClick={() => setSplit(!split)} icon={<Layers className="size-3.5" />} label="Pisahkan slice" />
            <StageToggle on={lesion} onClick={() => setLesion(!lesion)} icon={<ScanLine className="size-3.5" />} label="Kunci lesi" />
          </div>
        </div>
        <p className="pointer-events-none absolute bottom-[4.4rem] left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap text-[11px] text-sky/60">
          <Move3d className="size-3.5" /> Seret untuk memutar
        </p>
      </div>

      {/* kartu melayang (angka ilustrasi) */}
      <FloatCard className="-left-3 top-[16%] sm:-left-8" delay={0.9}>
        <span className="text-[11px] text-ink/55">Dice terhadap kunci</span>
        <span className="mt-0.5 flex items-baseline gap-1.5">
          <b className="font-serif text-3xl leading-none text-teal">0,81</b>
          <span className="rounded-full bg-leaf/50 px-1.5 text-[10px] font-medium text-teal-900">+0,12</span>
        </span>
      </FloatCard>
      <FloatCard className="-right-2 top-[38%] sm:-right-6" delay={1.05} slow>
        <span className="text-[11px] text-ink/55">Jenis kesalahan</span>
        <span className="mt-1 flex items-center gap-2 text-[13px] font-medium text-ink">
          <span className="size-2 rounded-full bg-terra" /> Lesi kecil terlewat
        </span>
      </FloatCard>
      <FloatCard className="-left-2 bottom-[17%] hidden max-w-[15.5rem] sm:-left-10 sm:block" delay={1.2}>
        <span className="flex items-center gap-1.5 text-[11px] text-ink/55">
          <MessageCircleQuestion className="size-3.5 text-teal" /> Tutor · mode Sokratik
        </span>
        <span className="mt-1.5 text-[13px] leading-snug text-ink/85">Ada fokus yang belum kamu tandai. Coba lihat sekitar slice 15: adakah area terang di DWI yang gelap di ADC?</span>
      </FloatCard>
      <p className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-ink/45">
        <Sparkles className="size-3" /> Volume MRI asli dari SOOP (OpenNeuro ds004889, CC0). Angka pada kartu hanya ilustrasi.
      </p>
    </motion.div>
  );
}

function StageToggle({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors', on ? 'bg-leaf text-teal-900' : 'text-sky/80 hover:text-mint')}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function FloatCard({ children, className, delay, slow }: { children: React.ReactNode; className?: string; delay: number; slow?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay, ease: EASE }}
      className={cn('absolute z-20', className)}
    >
      <div className={cn('flex flex-col rounded-2xl border border-white/60 bg-paper/90 px-4 py-3 shadow-[0_18px_40px_-18px_rgba(16,49,58,.45)] backdrop-blur-xl', reduce ? '' : 'animate-float', slow && '[animation-delay:-3s] [animation-duration:9s]')}>{children}</div>
    </motion.div>
  );
}
