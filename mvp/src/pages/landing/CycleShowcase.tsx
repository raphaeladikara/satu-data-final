import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Bot, BrainCircuit, Check, Crosshair, Gauge, ShieldCheck, Target } from 'lucide-react';
import { BorderBeam } from '@/components/ui/border-beam';
import SliceCanvas from '@/components/three/SliceCanvas';
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

export default function CycleShowcase() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-120px' });
  const reduce = useReducedMotion();
  const running = inView && !paused && !reduce;

  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setI((x) => (x + 1) % STEPS.length), DURATION);
    return () => clearTimeout(id);
  }, [i, running]);

  return (
    <div ref={ref} className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:gap-10" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <ol className="flex flex-col gap-2" role="tablist" aria-label="Langkah siklus latihan">
        {STEPS.map((s, k) => {
          const on = k === i;
          const Icon = s.icon;
          return (
            <li key={s.t}>
              <button
                role="tab"
                aria-selected={on}
                onClick={() => setI(k)}
                className={cn(
                  'relative w-full overflow-hidden rounded-3xl border p-5 text-left transition-colors duration-300',
                  on ? 'border-ink/10 bg-paper shadow-[0_14px_40px_-24px_rgba(16,49,58,.5)]' : 'border-transparent hover:bg-paper/50',
                )}
              >
                <div className="flex items-start gap-4">
                  <span className={cn('grid size-10 shrink-0 place-items-center rounded-2xl transition-colors', on ? 'bg-teal text-mint' : 'bg-ink/5 text-ink/50')}>
                    <Icon className="size-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <span className="font-mono text-[11px] text-ink/40">0{k + 1}</span>
                    <b className={cn('block text-[17px] font-medium tracking-tight', on ? 'text-ink' : 'text-ink/65')}>{s.t}</b>
                    <AnimatePresence initial={false}>
                      {on && (
                        <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }} className="overflow-hidden text-[14.5px] leading-relaxed text-ink/65">
                          <span className="block pt-1.5">{s.d}</span>
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                {on && (
                  <span className="absolute inset-x-5 bottom-0 h-[3px] overflow-hidden rounded-full bg-ink/5">
                    <motion.span
                      key={`${i}-${running}`}
                      className="block h-full origin-left rounded-full bg-gradient-to-r from-teal to-leaf"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: running ? 1 : 0.0001 }}
                      transition={{ duration: running ? DURATION / 1000 : 0, ease: 'linear' }}
                    />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="relative min-h-[440px] overflow-hidden rounded-[2rem] border border-ink/10 bg-[linear-gradient(160deg,#eaf3de_0%,#dfeee6_45%,#cfe4e6_100%)] p-4 sm:p-6">
        <BorderBeam size={260} duration={9} colorFrom="#aad39c" colorTo="#195764" borderWidth={2} />
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -12, filter: 'blur(6px)' }} transition={{ duration: 0.5, ease: EASE }} className="h-full">
            {[<StepPick key="0" />, <StepRead key="1" />, <StepGrade key="2" />, <StepTutor key="3" />, <StepMastery key="4" />][i]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-3xl border border-white/70 bg-paper/95 p-5 shadow-[0_20px_50px_-30px_rgba(16,49,58,.55)]', className)}>{children}</div>;
}

const KC = [
  ['K1', 'Mengenali sekuens', 0.96],
  ['K2', 'Hiperintensitas DWI', 0.71],
  ['K3', 'Restriksi sejati vs T2 shine-through', 0.34],
  ['K6', 'Mendelineasi seluruh lesi', 0.52],
] as const;

function StepPick() {
  return (
    <div className="grid h-full gap-4 sm:grid-cols-[1fr_0.9fr]">
      <Panel>
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink/45">Penguasaan saat ini</p>
        <ul className="mt-4 space-y-3.5">
          {KC.map(([k, n, v], idx) => (
            <li key={k}>
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2">
                  <span className={cn('rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold', k === 'K3' ? 'bg-terra text-white' : 'bg-teal/10 text-teal')}>{k}</span>
                  <span className="text-ink/75">{n}</span>
                </span>
                <b className="font-medium tabular-nums">{Math.round(v * 100)}%</b>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/6">
                <motion.div initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ duration: 1, delay: idx * 0.08, ease: EASE }} className={cn('h-full rounded-full', v >= 0.95 ? 'bg-sage' : k === 'K3' ? 'bg-terra' : 'bg-teal')} />
              </div>
            </li>
          ))}
        </ul>
      </Panel>
      <div className="flex flex-col gap-4">
        <Panel className="bg-teal text-mint">
          <p className="font-mono text-[11px] uppercase tracking-wider text-leaf">Kasus berikutnya</p>
          <b className="mt-3 block font-serif text-3xl leading-tight">Latihan terarah K3</b>
          <p className="mt-2 text-[13px] text-mint/75">KC terlemahmu. Prasyarat K1 dan K2 sudah terpenuhi.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full bg-white/10 px-2.5 py-1">Tingkat: sedang</span>
            <span className="rounded-full bg-white/10 px-2.5 py-1">Indeks D 0,13</span>
          </div>
        </Panel>
        <Panel className="flex items-center gap-3 py-4">
          <span className="grid size-9 place-items-center rounded-full bg-leaf/40 text-teal">
            <Check className="size-4" />
          </span>
          <span className="text-[13px] text-ink/70">Kasus contoh di modul tidak pernah dipakai untuk latihan bernilai.</span>
        </Panel>
      </div>
    </div>
  );
}

function StepRead() {
  const [series, setSeries] = useState<'DWI' | 'FLAIR'>('DWI');
  const [hi, setHi] = useState(220);
  return (
    <div className="grid h-full gap-4 sm:grid-cols-[1.25fr_0.75fr]">
      <div className="relative overflow-hidden rounded-3xl bg-black shadow-[0_24px_50px_-28px_rgba(0,0,0,.7)]">
        <SliceCanvas className="aspect-square w-full" series={series} windowHi={hi} showAnswer />
        <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-between font-mono text-[10px] text-sky/80">
          <span>{series} · slice 12</span>
          <span>W/L {hi}</span>
        </div>
        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-white/50">R</span>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-white/50">L</span>
      </div>
      <div className="flex flex-col gap-3">
        <Panel className="p-4">
          <p className="text-[12px] text-ink/55">Seri</p>
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-full bg-ink/5 p-1">
            {(['DWI', 'FLAIR'] as const).map((s) => (
              <button key={s} onClick={() => setSeries(s)} className={cn('rounded-full py-1.5 font-mono text-[11px]', series === s ? 'bg-teal text-mint' : 'text-ink/60')}>
                {s}
              </button>
            ))}
          </div>
          <label className="mt-4 block text-[12px] text-ink/55">
            Window
            <input type="range" min={80} max={255} value={hi} onChange={(e) => setHi(+e.target.value)} className="mt-2 w-full accent-teal" />
          </label>
        </Panel>
        <Panel className="p-4 text-[12.5px] text-ink/70">
          <span className="flex items-center gap-2 font-medium text-ink">
            <span className="size-2.5 rounded-sm bg-terra" /> Tandaanmu
          </span>
          <p className="mt-1.5 leading-relaxed">Coba geser window. Lesi akut tampak terang di DWI.</p>
        </Panel>
      </div>
    </div>
  );
}

function StepGrade() {
  const M = [
    ['Dice', '0,81', 'kemiripan bentuk'],
    ['Recall lesi', '1 / 2', 'fokus ditemukan'],
    ['Galat volume', '−18%', 'di bawah kunci'],
    ['HD95', '7,2 mm', 'jarak tepi terjauh'],
  ];
  return (
    <div className="grid h-full gap-4 sm:grid-cols-[0.95fr_1.05fr]">
      <div className="overflow-hidden rounded-3xl bg-black">
        <SliceCanvas className="aspect-square w-full" showKey showAnswer />
        <div className="flex gap-4 bg-teal-950 px-4 py-2.5 text-[11px] text-sky/85">
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-sm bg-terra" /> jawabanmu
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-sm border border-leaf" /> kunci ahli
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          {M.map(([k, v, d], idx) => (
            <motion.div key={k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.07, ease: EASE }}>
              <Panel className="p-4">
                <p className="text-[11px] text-ink/50">{k}</p>
                <b className="mt-1 block font-serif text-[1.9rem] leading-none text-teal">{v}</b>
                <p className="mt-1 text-[11px] text-ink/45">{d}</p>
              </Panel>
            </motion.div>
          ))}
        </div>
        <Panel className="border-terra/20 bg-terra-soft/60 p-4">
          <p className="text-[11px] uppercase tracking-wider text-terra">Jenis kesalahan</p>
          <b className="mt-1 block text-[15px] font-medium">Lesi kecil terlewat</b>
          <p className="mt-1 text-[12px] text-ink/60">Satu dari lima jenis kesalahan pemula yang dikenali aturan penilaian.</p>
        </Panel>
      </div>
    </div>
  );
}

function StepTutor() {
  const msgs: [string, string][] = [
    ['tutor', 'Kamu menandai lesi besar di hemisfer kanan dengan baik. Tapi ada satu fokus lagi. Menurutmu, di slice berapa ia mulai terlihat?'],
    ['me', 'Di slice 15 ada titik terang kecil, tapi kukira itu artefak.'],
    ['tutor', 'Cek di ADC. Kalau area itu juga gelap di ADC, berarti difusinya benar-benar terbatas, bukan T2 shine-through.'],
  ];
  return (
    <div className="flex h-full flex-col gap-3">
      <Panel className="flex-1">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[13px] font-medium">
            <span className="grid size-7 place-items-center rounded-full bg-teal text-mint">
              <Bot className="size-4" />
            </span>
            Tutor SINAPS
          </span>
          <span className="rounded-full bg-ink/5 px-2.5 py-1 text-[11px] text-ink/60">Mode Sokratik</span>
        </div>
        <div className="mt-4 space-y-3">
          {msgs.map(([who, m], k) => (
            <motion.div key={k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + k * 0.5, ease: EASE }} className={cn('flex', who === 'me' && 'justify-end')}>
              <p className={cn('max-w-[85%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed', who === 'me' ? 'rounded-br-md bg-teal text-mint' : 'rounded-bl-md bg-mint text-ink/85')}>{m}</p>
            </motion.div>
          ))}
        </div>
      </Panel>
      <Panel className="flex items-center gap-3 py-3.5">
        <ShieldCheck className="size-5 shrink-0 text-sage" />
        <span className="text-[13px] text-ink/70">
          <b className="font-medium text-ink">Pemeriksa fakta:</b> 3 dari 3 klaim cocok dengan temuan terukur. Kunci jawaban tetap terkunci sebelum jawaban dikirim.
        </span>
      </Panel>
    </div>
  );
}

function StepMastery() {
  const rows = [
    ['K2', 0.71, 0.78],
    ['K3', 0.34, 0.58],
    ['K6', 0.52, 0.49],
  ] as const;
  return (
    <div className="grid h-full gap-4 sm:grid-cols-[1.1fr_0.9fr]">
      <Panel>
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink/45">Setelah kasus ini</p>
        <ul className="mt-5 space-y-5">
          {rows.map(([k, b, a], idx) => {
            const up = a >= b;
            return (
              <li key={k}>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="rounded-md bg-teal/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-teal">{k}</span>
                  <span className="tabular-nums">
                    {Math.round(b * 100)}% → <b className="font-medium">{Math.round(a * 100)}%</b>
                    <em className={cn('ml-2 rounded-full px-1.5 py-0.5 text-[10px] not-italic', up ? 'bg-leaf/50 text-teal-900' : 'bg-terra-soft text-terra')}>
                      {up ? '+' : ''}
                      {Math.round((a - b) * 100)}
                    </em>
                  </span>
                </div>
                <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-ink/6">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-ink/15" style={{ width: `${b * 100}%` }} />
                  <motion.div initial={{ width: `${b * 100}%` }} animate={{ width: `${a * 100}%` }} transition={{ duration: 1.2, delay: 0.3 + idx * 0.15, ease: EASE }} className={cn('absolute inset-y-0 left-0 rounded-full', up ? 'bg-gradient-to-r from-teal to-sage' : 'bg-terra')} />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-[12px] text-ink/50">Garis 95% menandai KC yang dianggap dikuasai.</p>
      </Panel>
      <Panel className="flex flex-col justify-between bg-[linear-gradient(150deg,#195764,#2f7a73_55%,#80a874)] text-mint">
        <p className="font-mono text-[11px] uppercase tracking-wider text-leaf">BKT</p>
        <p className="font-serif text-[1.65rem] leading-tight">P(kuasai) diperbarui dari setiap jawaban, lalu menentukan kasus berikutnya.</p>
        <p className="text-[12px] text-mint/70">Persamaan (3)–(4) di paper, dengan prasyarat antar-KC.</p>
      </Panel>
    </div>
  );
}
