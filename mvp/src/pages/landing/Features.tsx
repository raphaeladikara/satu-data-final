import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, BookOpenCheck, Brush, Gauge, MessagesSquare, ScanEye, Shuffle } from 'lucide-react';
import { Link } from 'react-router-dom';
import SliceCanvas from '@/components/three/SliceCanvas';
import { cn } from '@/lib/utils';
import { EASE, Reveal } from './bits';

/** Bento fitur (adaptasi library: bento-grid), tiap kartu punya visual kecil yang hidup. */
export default function Features() {
  return (
    <div className="grid auto-rows-[minmax(17rem,auto)] grid-cols-1 gap-4 md:grid-cols-6">
      <Card className="md:col-span-4 md:row-span-2" icon={ScanEye} title="Viewer MRI interaktif" desc="Dibangun di atas Cornerstone3D, pustaka inti OHIF Viewer. Gulir slice, atur window/level, zoom, geser, dan probe ADC relatif." tone="dark" delay={0}>
        <ViewerDemo />
      </Card>
      <Card className="md:col-span-2" icon={Brush} title="Kuas anotasi lesi" desc="Tandai lesi langsung di citra, lengkap dengan penghapus dan urungkan." delay={0.05}>
        <BrushDemo />
      </Card>
      <Card className="md:col-span-2" icon={Gauge} title="Penilaian objektif" desc="Empat metrik dan lima jenis kesalahan pemula, dinilai terhadap mask buatan ahli." delay={0.1}>
        <MetricsDemo />
      </Card>
      <Card className="md:col-span-2" icon={MessagesSquare} title="Tutor berpijak fakta" desc="Mode Sokratik, penjelasan, dan rujukan. Kunci tetap terkunci sampai jawaban dikirim." tone="mint" delay={0}>
        <div className="mt-auto flex flex-col gap-2 pt-5">
          <p className="w-fit max-w-[90%] rounded-2xl rounded-bl-md bg-paper px-3.5 py-2 text-[12.5px] text-ink/80 shadow-sm">Apa bedanya terang di DWI dengan restriksi sejati?</p>
          <p className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md bg-teal px-3.5 py-2 text-[12.5px] text-mint">Lihat ADC-nya dulu, ya.</p>
        </div>
      </Card>
      <Card className="md:col-span-2" icon={Shuffle} title="Kasus adaptif" desc="BKT memilih kompetensi dan tingkat kesulitan berikutnya, dengan prasyarat yang dihormati." delay={0.05}>
        <Sparkline />
      </Card>
      <Card className="md:col-span-2" icon={BookOpenCheck} title="Modul belajar & kuis" desc="Materi singkat per kompetensi dengan contoh kasus 3D interaktif dan kuis cepat." tone="sand" delay={0.1}>
        <div className="mt-auto flex gap-1.5 pt-5">
          {['Dasar', 'K1', 'K2', 'K3', 'K6', 'K4·5'].map((m, i) => (
            <span key={m} className={cn('flex-1 rounded-xl py-2 text-center font-mono text-[10px]', i < 3 ? 'bg-teal text-mint' : 'bg-paper/80 text-ink/60')}>
              {m}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

type Tone = 'light' | 'dark' | 'mint' | 'sand';
const TONES: Record<Tone, string> = {
  light: 'bg-paper text-ink border-ink/8',
  dark: 'bg-teal-900 text-mint border-white/5',
  mint: 'bg-mint text-ink border-ink/5',
  sand: 'bg-sand-2 text-ink border-ink/5',
};

function Card({ className, icon: Icon, title, desc, tone = 'light', delay, children }: { className?: string; icon: typeof ScanEye; title: string; desc: string; tone?: Tone; delay: number; children?: React.ReactNode }) {
  const dark = tone === 'dark';
  return (
    <Reveal delay={delay} className={cn('h-full', className)}>
      <article className={cn('group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border p-6 transition-shadow duration-300 hover:shadow-[0_24px_60px_-30px_rgba(16,49,58,.45)]', TONES[tone])}>
        <span className={cn('grid size-10 place-items-center rounded-2xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105', dark ? 'bg-leaf/15 text-leaf' : 'bg-teal/10 text-teal')}>
          <Icon className="size-[18px]" />
        </span>
        <h3 className="mt-4 text-[19px] font-medium tracking-tight">{title}</h3>
        <p className={cn('mt-1.5 max-w-md text-[14px] leading-relaxed', dark ? 'text-mint/65' : 'text-ink/60')}>{desc}</p>
        {children}
      </article>
    </Reveal>
  );
}

function ViewerDemo() {
  const [slice, setSlice] = useState<number | undefined>(undefined);
  const [z, setZ] = useState(12);
  const [series, setSeries] = useState<'DWI' | 'FLAIR'>('DWI');
  const [zmax, setZmax] = useState(24);
  return (
    <div className="mt-6 grid flex-1 gap-4 sm:grid-cols-[1fr_12rem]">
      <div className="relative overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
        <SliceCanvas
          className="aspect-[4/3] h-full w-full"
          series={series}
          slice={slice}
          windowHi={series === 'DWI' ? 200 : 230}
          onReady={(b) => {
            setZmax(b.dims[2] - 1);
            setZ(b.peakSlice);
          }}
        />
        <span className="pointer-events-none absolute left-3 top-3 font-mono text-[10px] text-sky/80">
          {series} · slice {z + 1}/{zmax + 1}
        </span>
      </div>
      <div className="flex flex-col gap-3 text-[12px]">
        <div className="grid grid-cols-2 gap-1 rounded-full bg-white/5 p-1">
          {(['DWI', 'FLAIR'] as const).map((s) => (
            <button key={s} onClick={() => setSeries(s)} className={cn('rounded-full py-1.5 font-mono text-[11px] transition-colors', series === s ? 'bg-leaf text-teal-900' : 'text-mint/70 hover:text-mint')}>
              {s}
            </button>
          ))}
        </div>
        <label className="rounded-2xl bg-white/5 p-3 text-mint/70">
          Gulir slice
          <input
            type="range"
            min={0}
            max={zmax}
            value={z}
            onChange={(e) => {
              setZ(+e.target.value);
              setSlice(+e.target.value);
            }}
            className="mt-2 w-full accent-[#aad39c]"
          />
        </label>
        <Link to="/daftar" className="mt-auto inline-flex items-center gap-1 text-leaf hover:underline">
          Coba di kasus lain <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

function BrushDemo() {
  return (
    <svg viewBox="0 0 220 90" className="mt-auto h-24 w-full pt-4" aria-hidden="true">
      <motion.path
        d="M18 60 C 40 20, 70 24, 86 46 S 120 78, 140 50 S 180 20, 204 38"
        fill="none"
        stroke="#ad7556"
        strokeWidth="14"
        strokeLinecap="round"
        strokeOpacity="0.55"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.6, ease: EASE }}
      />
      <motion.circle r="9" fill="#faf8f2" stroke="#195764" strokeWidth="2" initial={{ cx: 18, cy: 60 }} whileInView={{ cx: 204, cy: 38 }} viewport={{ once: true }} transition={{ duration: 1.6, ease: EASE }} />
    </svg>
  );
}

function MetricsDemo() {
  return (
    <div className="mt-auto grid grid-cols-4 gap-1.5 pt-5">
      {[
        ['Dice', 0.81],
        ['Recall', 0.5],
        ['Vol', 0.82],
        ['HD95', 0.64],
      ].map(([k, v], i) => (
        <div key={k as string} className="flex flex-col items-center gap-1.5">
          <div className="flex h-16 w-full items-end overflow-hidden rounded-xl bg-ink/5">
            <motion.div initial={{ height: 0 }} whileInView={{ height: `${(v as number) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: i * 0.1, ease: EASE }} className={cn('w-full rounded-xl', i === 1 ? 'bg-terra' : 'bg-teal')} />
          </div>
          <span className="font-mono text-[10px] text-ink/50">{k}</span>
        </div>
      ))}
    </div>
  );
}

function Sparkline() {
  const pts = [0.2, 0.26, 0.24, 0.38, 0.45, 0.43, 0.58, 0.66, 0.71, 0.83, 0.88, 0.96];
  const d = pts.map((v, i) => `${(i / (pts.length - 1)) * 200},${70 - v * 62}`).join(' ');
  return (
    <svg viewBox="0 0 200 74" className="mt-auto h-24 w-full overflow-visible pt-4" aria-hidden="true">
      <line x1="0" x2="200" y1={70 - 0.95 * 62} y2={70 - 0.95 * 62} stroke="#80a874" strokeDasharray="3 4" strokeWidth="1.2" />
      <text x="200" y={70 - 0.95 * 62 - 5} textAnchor="end" className="fill-sage font-mono text-[8px]">
        dikuasai 95%
      </text>
      <motion.polyline points={d} fill="none" stroke="#195764" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.6, ease: EASE }} />
    </svg>
  );
}
