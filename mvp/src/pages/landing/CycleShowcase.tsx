import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { Bot, BrainCircuit, Brush, Check, Contrast, Crosshair, Eraser, Gauge, Hand, Home, BookOpen, ScanLine, ClipboardList, ShieldCheck, Target, Undo2, ZoomIn } from 'lucide-react';
import SliceCanvas from '@/components/three/SliceCanvas';
import { BrandMark } from '@/components/BrandMark';
import { cn } from '@/lib/utils';
import { EASE } from './bits';

const STEPS = [
  { icon: Target, t: 'Kasus dipilih untukmu', d: 'Sistem memilih kasus MRI yang menyasar kompetensi terlemahmu, dengan tingkat kesulitan yang pas.' },
  { icon: Crosshair, t: 'Baca seperti di klinik', d: 'Gulir slice, atur window/level, bandingkan DWI, ADC, dan FLAIR, lalu tandai lesi dengan kuas.' },
  { icon: Gauge, t: 'Dinilai otomatis', d: 'Jawabanmu dibandingkan dengan lesion mask buatan ahli: Dice, recall per lesi, galat volume, dan HD95.' },
  { icon: Bot, t: 'Tutor menjelaskan', d: 'Tutor AI menjelaskan letak kesalahanmu hanya dari fakta yang terukur, dicek pemeriksa fakta, dan tercatat di log audit.' },
  { icon: BrainCircuit, t: 'Penguasaan diperbarui', d: 'Bayesian Knowledge Tracing memperbarui peluang penguasaan tiap KC, lalu memilih kasus berikutnya.' },
];
const DURATION = 7000;

function useDesktop() {
  const [d, setD] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setD(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return d;
}

/**
 * Siklus latihan. Di desktop section ini menempel (sticky) dan langkahnya maju mengikuti gulir;
 * di layar kecil berupa tab yang berganti otomatis.
 */
export default function CycleShowcase() {
  const desktop = useDesktop();
  const reduce = useReducedMotion();
  return desktop && !reduce ? <ScrollCycle /> : <TabCycle />;
}

function ScrollCycle() {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [p, setP] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const x = Math.min(0.9999, Math.max(0, v)) * STEPS.length;
    setI(Math.floor(x));
    setP(x - Math.floor(x));
  });
  const jump = (k: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + (span * (k + 0.08)) / STEPS.length, behavior: 'smooth' });
  };
  return (
    <div ref={ref} style={{ height: `${STEPS.length * 70 + 30}vh` }} className="relative">
      <div className="sticky top-0 flex h-screen items-center py-24">
        <div className="grid w-full grid-cols-[0.68fr_1.32fr] items-center gap-12">
          <StepList i={i} progress={p} onPick={jump} />
          <AppFrame i={i} />
        </div>
      </div>
    </div>
  );
}

function TabCycle() {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-120px' });
  const reduce = useReducedMotion();
  const running = inView && !reduce;
  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setI((x) => (x + 1) % STEPS.length), DURATION);
    return () => clearTimeout(id);
  }, [i, running]);
  return (
    <div ref={ref} className="grid gap-6">
      <StepList i={i} progress={running ? 1 : 0} animated={running ? DURATION : 0} key={i} onPick={setI} />
      <AppFrame i={i} />
    </div>
  );
}

function StepList({ i, progress, onPick, animated = 0 }: { i: number; progress: number; onPick: (k: number) => void; animated?: number }) {
  return (
    <ol className="flex flex-col gap-1.5" role="tablist" aria-label="Langkah siklus latihan">
      {STEPS.map((s, k) => {
        const on = k === i;
        const done = k < i;
        const Icon = s.icon;
        return (
          <li key={s.t}>
            <button
              role="tab"
              aria-selected={on}
              onClick={() => onPick(k)}
              className={cn('relative w-full overflow-hidden rounded-[1.4rem] p-4 text-left transition-[background-color,box-shadow] duration-300', on ? 'bg-paper shadow-[0_18px_44px_-26px_rgba(16,49,58,.5)] ring-1 ring-ink/8' : 'hover:bg-paper/50')}
            >
              <div className="flex items-start gap-4">
                <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl transition-colors duration-300', on ? 'bg-teal text-mint' : done ? 'bg-leaf/45 text-teal-900' : 'bg-ink/5 text-ink/45')}>
                  {done ? <Check className="size-[18px]" /> : <Icon className="size-[18px]" />}
                </span>
                <div className="min-w-0 pt-0.5">
                  <span className="font-display text-[11.5px] uppercase tracking-[0.2em] text-ink/40">Langkah 0{k + 1}</span>
                  <b className={cn('block text-[16.5px] font-bold transition-colors', on ? 'text-ink' : 'text-ink/55')}>{s.t}</b>
                  <AnimatePresence initial={false}>
                    {on && (
                      <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: EASE }} className="overflow-hidden text-[14px] leading-relaxed text-ink/65">
                        <span className="block pt-1.5">{s.d}</span>
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              {on && (
                <span className="absolute inset-x-4 bottom-0 h-[3px] overflow-hidden rounded-full bg-ink/5">
                  {animated ? (
                    <motion.span className="block h-full origin-left rounded-full bg-gradient-to-r from-teal to-leaf" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: animated / 1000, ease: 'linear' }} />
                  ) : (
                    <span className="block h-full origin-left rounded-full bg-gradient-to-r from-teal to-leaf" style={{ transform: `scaleX(${progress})` }} />
                  )}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ── bingkai aplikasi (meniru AppHeader + ruang latihan versi terbaru) ── */

function AppFrame({ i }: { i: number }) {
  const [series, setSeries] = useState<'DWI' | 'FLAIR'>('DWI');
  const [hi, setHi] = useState(215);
  const graded = i >= 2;
  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(160deg,#eaf3de_0%,#dfeee6_45%,#cfe4e6_100%)] p-3 ring-1 ring-ink/8 shadow-[0_40px_90px_-50px_rgba(16,49,58,.6)] sm:p-4">
      <div className="overflow-hidden rounded-[1.5rem] bg-muslin ring-1 ring-ink/8">
        {/* bilah atas aplikasi */}
        <div className="flex items-center gap-3 border-b border-ink/8 bg-paper/90 px-4 py-2.5">
          <BrandMark className="size-7" />
          <span className="hidden font-display text-[14px] font-semibold uppercase tracking-[0.16em] sm:inline">Sinaps</span>
          <nav className="mx-auto hidden items-center gap-0.5 md:flex" aria-hidden="true">
            {[
              [Home, 'Beranda'],
              [BookOpen, 'Belajar'],
              [ScanLine, 'Latihan'],
              [ClipboardList, 'Tugas'],
            ].map(([Icon, l]) => {
              const I = Icon as typeof Home;
              return (
                <span key={l as string} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold', l === 'Latihan' ? 'bg-sky/60 text-teal-900' : 'text-ink/50')}>
                  <I className="size-3.5" /> {l as string}
                </span>
              );
            })}
          </nav>
          <span className="ml-auto grid size-8 place-items-center rounded-full bg-gradient-to-br from-teal to-sage text-[11px] font-bold text-mint md:ml-0">AR</span>
        </div>

        <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] sm:p-4">
          {/* viewer gelap, tetap sama di semua langkah */}
          <div className="flex gap-2 self-start rounded-2xl bg-[#0b1220] p-2 ring-1 ring-black/40">
            <div className="flex flex-col gap-1.5 pt-1">
              {[Hand, ZoomIn, Contrast, Brush, Eraser, Undo2].map((I, k) => (
                <span key={k} className={cn('grid size-7 place-items-center rounded-lg', k === 3 && i === 1 ? 'bg-[#5fb3bf] text-[#0b1220]' : 'text-[#8b9ab2]')}>
                  <I className="size-3.5" />
                </span>
              ))}
            </div>
            <div className="relative flex-1 overflow-hidden rounded-xl bg-black">
              <SliceCanvas className="aspect-square w-full" series={series} windowHi={hi} showAnswer={i >= 1} showKey={graded} />
              <div className="pointer-events-none absolute inset-x-2.5 top-2 flex justify-between font-display text-[10.5px] uppercase tracking-[0.14em] text-sky/80">
                <span>{series} · slice 12</span>
                <span>{i === 0 ? 'memuat kasus' : `W ${hi}`}</span>
              </div>
              {graded && (
                <div className="absolute inset-x-0 bottom-0 flex gap-4 bg-black/60 px-3 py-1.5 text-[10.5px] text-sky/85 backdrop-blur">
                  <span className="flex items-center gap-1.5">
                    <i className="size-2 rounded-sm bg-terra" /> jawabanmu
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="size-2 rounded-sm border border-leaf" /> kunci ahli
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="min-h-[22rem]">
            <AnimatePresence mode="wait">
              <motion.div key={i} initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }} transition={{ duration: 0.4, ease: EASE }} className="flex h-full flex-col gap-3">
                {i === 0 && <StepPick />}
                {i === 1 && <StepRead series={series} setSeries={setSeries} hi={hi} setHi={setHi} />}
                {i === 2 && <StepGrade />}
                {i === 3 && <StepTutor />}
                {i === 4 && <StepMastery />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl bg-paper p-4 ring-1 ring-ink/8 shadow-[0_14px_34px_-26px_rgba(16,49,58,.55)]', className)}>{children}</div>;
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('font-display text-[11px] uppercase tracking-[0.18em] text-ink/45', className)}>{children}</p>;
}

const KC = [
  ['K1', 'Mengenali sekuens', 0.96],
  ['K2', 'Hiperintensitas DWI', 0.71],
  ['K3', 'Restriksi sejati', 0.34],
  ['K6', 'Delineasi seluruh lesi', 0.52],
] as const;

function StepPick() {
  return (
    <>
      <Panel className="bg-[radial-gradient(120%_90%_at_0%_0%,#1a5562,#0f3a43_60%,#0a262c)] text-mint ring-white/10">
        <Label className="text-leaf">Kasus berikutnya</Label>
        <b className="mt-2 block text-[19px] leading-snug">Latihan terarah K3</b>
        <p className="mt-1 text-[12.5px] text-mint/70">KC terlemahmu. Prasyarat K1 dan K2 sudah terpenuhi.</p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          <span className="rounded-full bg-white/10 px-2.5 py-1">Tingkat sedang</span>
          <span className="rounded-full bg-white/10 px-2.5 py-1">Indeks D 0,13</span>
        </div>
      </Panel>
      <Panel className="flex-1">
        <Label>Penguasaan saat ini</Label>
        <ul className="mt-3 space-y-3">
          {KC.map(([k, n, v], idx) => (
            <li key={k}>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="flex items-center gap-2">
                  <span className={cn('rounded-md px-1.5 py-0.5 font-display text-[10.5px] tracking-wider', k === 'K3' ? 'bg-terra text-white' : 'bg-teal/10 text-teal')}>{k}</span>
                  <span className="text-ink/75">{n}</span>
                </span>
                <b className="tabular-nums">{Math.round(v * 100)}%</b>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/6">
                <motion.div initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ duration: 0.9, delay: idx * 0.07, ease: EASE }} className={cn('h-full rounded-full', v >= 0.95 ? 'bg-sage' : k === 'K3' ? 'bg-terra' : 'bg-teal')} />
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function StepRead({ series, setSeries, hi, setHi }: { series: 'DWI' | 'FLAIR'; setSeries: (s: 'DWI' | 'FLAIR') => void; hi: number; setHi: (n: number) => void }) {
  const todo = [
    ['Pilih sekuens', true],
    ['Atur window', true],
    ['Tandai lesi dengan kuas', false],
    ['Kirim jawaban', false],
  ] as const;
  return (
    <>
      <Panel>
        <Label>Kerjakan kasus · sub-754</Label>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-ink/5 p-1">
          {(['DWI', 'FLAIR'] as const).map((s) => (
            <button key={s} onClick={() => setSeries(s)} className={cn('rounded-full py-1.5 font-display text-[11.5px] tracking-[0.12em] transition-colors', series === s ? 'bg-teal text-mint' : 'text-ink/60')}>
              {s}
            </button>
          ))}
        </div>
        <label className="mt-4 block text-[12px] text-ink/60">
          Window · coba geser, lesi akut tampak terang di DWI
          <input type="range" min={80} max={255} value={hi} onChange={(e) => setHi(+e.target.value)} className="mt-2 w-full accent-[#195764]" />
        </label>
      </Panel>
      <Panel className="flex-1">
        <ul className="space-y-2.5">
          {todo.map(([t, ok]) => (
            <li key={t} className="flex items-center gap-2.5 text-[13px]">
              <span className={cn('grid size-5 place-items-center rounded-full', ok ? 'bg-sage text-white' : 'border border-ink/20')}>{ok && <Check className="size-3" />}</span>
              <span className={ok ? 'text-ink/50 line-through' : 'text-ink/85'}>{t}</span>
            </li>
          ))}
        </ul>
        <span className="mt-4 flex h-10 items-center justify-center rounded-full bg-teal text-[13px] font-bold text-mint">Kirim jawaban</span>
      </Panel>
    </>
  );
}

function StepGrade() {
  const M = [
    ['Dice', '0,81', 'kemiripan bentuk'],
    ['Recall lesi', '1 / 2', 'fokus ditemukan'],
    ['Galat volume', '−18%', 'di bawah kunci'],
    ['HD95', '7,2 mm', 'tepi terjauh'],
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {M.map(([k, v, d], idx) => (
          <motion.div key={k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.07, ease: EASE }}>
            <Panel className="p-3.5">
              <Label>{k}</Label>
              <b className="mt-1.5 block text-[24px] leading-none text-teal">{v}</b>
              <p className="mt-1 text-[11px] text-ink/45">{d}</p>
            </Panel>
          </motion.div>
        ))}
      </div>
      <Panel className="flex-1 bg-terra-soft/70 ring-terra/20">
        <Label className="text-terra">Jenis kesalahan</Label>
        <b className="mt-1.5 block text-[15.5px]">Lesi kecil terlewat</b>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink/60">Satu dari lima jenis kesalahan pemula yang dikenali aturan penilaian. Fokus kedua di slice 15 belum ditandai.</p>
      </Panel>
    </>
  );
}

function StepTutor() {
  const msgs: [string, string][] = [
    ['tutor', 'Lesi besar di hemisfer kanan sudah kamu tandai dengan baik. Masih ada satu fokus lagi. Menurutmu ia mulai terlihat di slice berapa?'],
    ['me', 'Di slice 15 ada titik terang kecil, kukira artefak.'],
    ['tutor', 'Cek ADC-nya. Kalau area itu juga gelap di ADC, difusinya benar-benar terbatas, bukan T2 shine-through.'],
  ];
  return (
    <>
      <Panel className="flex-1">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[13px] font-bold">
            <span className="grid size-7 place-items-center rounded-full bg-teal text-mint">
              <Bot className="size-4" />
            </span>
            Tutor SINAPS
          </span>
          <span className="rounded-full bg-ink/5 px-2.5 py-1 font-display text-[10.5px] uppercase tracking-[0.14em] text-ink/60">Sokratik</span>
        </div>
        <div className="mt-3 space-y-2.5">
          {msgs.map(([who, m], k) => (
            <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + k * 0.45, ease: EASE }} className={cn('flex', who === 'me' && 'justify-end')}>
              <p className={cn('max-w-[88%] rounded-2xl px-3.5 py-2 text-[12.5px] leading-relaxed', who === 'me' ? 'rounded-br-md bg-teal text-mint' : 'rounded-bl-md bg-mint text-ink/85')}>{m}</p>
            </motion.div>
          ))}
        </div>
      </Panel>
      <Panel className="flex items-start gap-2.5 py-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sage" />
        <span className="text-[12px] leading-relaxed text-ink/70">
          <b className="text-ink">Pemeriksa fakta:</b> 3 dari 3 klaim cocok dengan temuan terukur.
        </span>
      </Panel>
    </>
  );
}

function StepMastery() {
  const rows = [
    ['K2', 0.71, 0.78],
    ['K3', 0.34, 0.58],
    ['K6', 0.52, 0.49],
  ] as const;
  return (
    <>
      <Panel className="flex-1">
        <Label>Setelah kasus ini</Label>
        <ul className="mt-4 space-y-4">
          {rows.map(([k, b, a], idx) => {
            const up = a >= b;
            return (
              <li key={k}>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="rounded-md bg-teal/10 px-1.5 py-0.5 font-display text-[10.5px] tracking-wider text-teal">{k}</span>
                  <span className="tabular-nums">
                    {Math.round(b * 100)}% → <b>{Math.round(a * 100)}%</b>
                    <em className={cn('ml-2 rounded-full px-1.5 py-0.5 text-[10px] not-italic', up ? 'bg-leaf/50 text-teal-900' : 'bg-terra-soft text-terra')}>
                      {up ? '+' : ''}
                      {Math.round((a - b) * 100)}
                    </em>
                  </span>
                </div>
                <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-ink/6">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-ink/15" style={{ width: `${b * 100}%` }} />
                  <motion.div initial={{ width: `${b * 100}%` }} animate={{ width: `${a * 100}%` }} transition={{ duration: 1.1, delay: 0.25 + idx * 0.14, ease: EASE }} className={cn('absolute inset-y-0 left-0 rounded-full', up ? 'bg-gradient-to-r from-teal to-sage' : 'bg-terra')} />
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
      <Panel className="bg-[linear-gradient(150deg,#195764,#2f7a73_55%,#80a874)] text-mint ring-white/10">
        <Label className="text-leaf">Bayesian Knowledge Tracing</Label>
        <p className="mt-1.5 text-[14px] leading-snug">P(kuasai) diperbarui dari setiap jawaban, lalu menentukan kasus berikutnya.</p>
      </Panel>
    </>
  );
}
