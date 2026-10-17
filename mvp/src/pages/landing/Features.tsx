import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import SliceCanvas from '@/components/three/SliceCanvas';
import { BentoCard, DotGrid } from '@/components/ui/bento';
import { cn } from '@/lib/utils';
import { EASE, Reveal } from './bits';

/** Bento fitur (adaptasi 21st.dev FUI Bento Grid): visual hidup di atas, panel teks ber-blur di bawah. */
export default function Features() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
      <Cell className="lg:col-span-3" delay={0}>
        <BentoCard className="lg:rounded-tl-[2.5rem]" eyebrow="Viewer" title="Baca MRI seperti di workstation" description="Dibangun di atas Cornerstone3D, pustaka inti OHIF Viewer. Gulir slice, atur window/level, zoom, geser, dan probe ADC relatif." graphic={<ViewerGraphic />} graphicClassName="h-[22rem]" />
      </Cell>
      <Cell className="lg:col-span-3" delay={0.06}>
        <BentoCard className="lg:rounded-tr-[2.5rem]" eyebrow="Penilaian" title="Nilai objektif, bukan tebakan" description="Empat metrik dan lima jenis kesalahan pemula, dihitung terhadap lesion mask buatan ahli." graphic={<MetricsGraphic />} graphicClassName="h-[22rem]" />
      </Cell>
      <Cell className="lg:col-span-2" delay={0}>
        <BentoCard className="lg:rounded-bl-[2.5rem]" tone="deep" eyebrow="Anotasi" title="Kuas lesi di atas citra" description="Tandai lesi langsung di slice, lengkap dengan penghapus dan urungkan." graphic={<BrushGraphic />} />
      </Cell>
      <Cell className="lg:col-span-2" delay={0.06}>
        <BentoCard tone="deep" eyebrow="Tutor" title="Tutor yang berpijak fakta" description="Mode Sokratik, penjelasan, dan rujukan. Kunci tetap terkunci sampai jawaban dikirim." graphic={<TutorGraphic />} />
      </Cell>
      <Cell className="lg:col-span-2" delay={0.12}>
        <BentoCard className="lg:rounded-br-[2.5rem]" tone="deep" eyebrow="Adaptif" title="Kasus berikutnya dipilih untukmu" description="BKT memilih kompetensi dan tingkat kesulitan berikutnya, dengan prasyarat yang dihormati." graphic={<SparkGraphic />} />
      </Cell>
    </div>
  );
}

function Cell({ children, className, delay }: { children: React.ReactNode; className?: string; delay: number }) {
  return (
    <Reveal delay={delay} y={36} className={cn('h-full', className)}>
      {children}
    </Reveal>
  );
}

function ViewerGraphic() {
  const [z, setZ] = useState<number | undefined>(undefined);
  const [zmax, setZmax] = useState(24);
  const [cur, setCur] = useState(12);
  const [series, setSeries] = useState<'DWI' | 'FLAIR'>('DWI');
  return (
    <div className="absolute inset-0 flex items-start justify-center gap-4 px-6 pt-7">
      <DotGrid />
      <div className="relative aspect-square h-[16.5rem] overflow-hidden rounded-2xl bg-black shadow-[0_30px_60px_-30px_rgba(0,0,0,.9)] ring-1 ring-white/10">
        <SliceCanvas
          className="h-full w-full"
          series={series}
          slice={z}
          windowHi={series === 'DWI' ? 200 : 230}
          onReady={(b) => {
            setZmax(b.dims[2] - 1);
            setCur(b.peakSlice);
          }}
        />
        <span className="pointer-events-none absolute left-3 top-2.5 font-display text-[10.5px] uppercase tracking-[0.14em] text-sky/80">
          {series} · slice {cur + 1}/{zmax + 1}
        </span>
      </div>
      <div className="relative hidden w-36 flex-col gap-2.5 sm:flex">
        <div className="grid grid-cols-2 gap-1 rounded-full bg-white/8 p-1">
          {(['DWI', 'FLAIR'] as const).map((s) => (
            <button key={s} onClick={() => setSeries(s)} className={cn('rounded-full py-1.5 font-display text-[11px] tracking-[0.12em] transition-colors', series === s ? 'bg-leaf text-teal-900' : 'text-mint/70 hover:text-mint')}>
              {s}
            </button>
          ))}
        </div>
        <label className="rounded-2xl bg-white/8 p-3 font-display text-[11px] uppercase tracking-[0.14em] text-mint/70">
          Gulir slice
          <input
            type="range"
            min={0}
            max={zmax}
            value={cur}
            onChange={(e) => {
              setCur(+e.target.value);
              setZ(+e.target.value);
            }}
            className="mt-2 w-full accent-[#aad39c]"
          />
        </label>
        <Link to="/daftar" className="inline-flex items-center gap-1 text-[12.5px] font-bold text-leaf hover:underline">
          Coba kasus lain <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

function MetricsGraphic() {
  const M = [
    ['Dice', 0.81, '0,81'],
    ['Recall', 0.5, '1/2'],
    ['Volume', 0.82, '−18%'],
    ['HD95', 0.64, '7,2'],
  ] as const;
  const R = 62;
  const C = 2 * Math.PI * R;
  return (
    <div className="absolute inset-0 flex items-start justify-center gap-8 px-8 pt-9">
      <DotGrid />
      <div className="relative grid size-40 shrink-0 place-items-center">
        <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="12" />
          <motion.circle cx="80" cy="80" r={R} fill="none" stroke="url(#dice-g)" strokeWidth="12" strokeLinecap="round" strokeDasharray={C} initial={{ strokeDashoffset: C }} whileInView={{ strokeDashoffset: C * (1 - 0.81) }} viewport={{ once: true }} transition={{ duration: 1.6, ease: EASE }} />
          <defs>
            <linearGradient id="dice-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#aad39c" />
              <stop offset="1" stopColor="#93c7cf" />
            </linearGradient>
          </defs>
        </svg>
        <div className="text-center">
          <b className="block text-[34px] leading-none">0,81</b>
          <span className="font-display text-[11px] uppercase tracking-[0.18em] text-mint/60">Dice</span>
        </div>
      </div>
      <div className="relative hidden flex-1 grid-cols-4 items-end gap-2.5 sm:grid">
        {M.map(([k, v, t], i) => (
          <div key={k} className="flex flex-col items-center gap-2">
            <span className="text-[12px] font-bold text-mint/85">{t}</span>
            <div className="flex h-36 w-full items-end overflow-hidden rounded-xl bg-white/6">
              <motion.div initial={{ height: 0 }} whileInView={{ height: `${v * 100}%` }} viewport={{ once: true }} transition={{ duration: 1.1, delay: 0.2 + i * 0.1, ease: EASE }} className={cn('w-full rounded-xl', i === 1 ? 'bg-terra' : 'bg-gradient-to-t from-teal-600 to-leaf')} />
            </div>
            <span className="font-display text-[10.5px] uppercase tracking-[0.14em] text-mint/55">{k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BrushGraphic() {
  return (
    <div className="absolute inset-0 grid place-items-start justify-center pt-6">
      <DotGrid />
      <div className="relative aspect-square h-[14rem] overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
        <SliceCanvas className="h-full w-full" windowHi={210} />
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <motion.path
            d="M34 62 C 30 52, 36 44, 44 46 S 52 58, 46 66 S 34 70, 34 62"
            fill="none"
            stroke="#e08a5f"
            strokeWidth="6"
            strokeLinecap="round"
            strokeOpacity="0.75"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.8, delay: 0.3, ease: EASE }}
          />
          <motion.circle r="4" fill="none" stroke="#eaf3de" strokeWidth="1.2" initial={{ cx: 34, cy: 62 }} whileInView={{ cx: [34, 30, 44, 52, 46, 34], cy: [62, 52, 46, 58, 66, 62] }} viewport={{ once: true }} transition={{ duration: 1.8, delay: 0.3, ease: 'easeInOut' }} />
        </svg>
      </div>
    </div>
  );
}

function TutorGraphic() {
  const msgs: [string, string][] = [
    ['me', 'Apa bedanya terang di DWI dengan restriksi sejati?'],
    ['tutor', 'Lihat ADC-nya dulu. Kalau ikut gelap, difusinya memang terbatas.'],
    ['me', 'Berarti yang di slice 15 itu lesi?'],
  ];
  return (
    <div className="absolute inset-0 flex flex-col justify-start gap-2.5 px-6 pt-7">
      <DotGrid />
      {msgs.map(([who, m], k) => (
        <motion.p
          key={k}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 + k * 0.35, duration: 0.5, ease: EASE }}
          className={cn('relative w-fit max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug', who === 'me' ? 'ml-auto rounded-br-md bg-leaf text-teal-900' : 'rounded-bl-md bg-white/10 text-mint/90 ring-1 ring-white/10')}
        >
          {m}
        </motion.p>
      ))}
    </div>
  );
}

function SparkGraphic() {
  const pts = [0.18, 0.24, 0.22, 0.36, 0.44, 0.41, 0.57, 0.64, 0.7, 0.82, 0.88, 0.96];
  const d = pts.map((v, i) => `${(i / (pts.length - 1)) * 260},${150 - v * 120}`).join(' ');
  const yLine = 150 - 0.95 * 120;
  return (
    <div className="absolute inset-0 px-6 pt-10">
      <DotGrid />
      <svg viewBox="0 0 260 160" className="relative h-44 w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#aad39c" stopOpacity=".35" />
            <stop offset="1" stopColor="#aad39c" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" x2="260" y1={yLine} y2={yLine} stroke="#aad39c" strokeOpacity=".6" strokeDasharray="3 5" />
        <text x="260" y={yLine - 7} textAnchor="end" className="fill-leaf font-display text-[9px] uppercase tracking-[0.14em]">
          dikuasai 95%
        </text>
        <motion.polygon points={`0,160 ${d} 260,160`} fill="url(#spark-fill)" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.9 }} />
        <motion.polyline points={d} fill="none" stroke="#eaf3de" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.6, ease: EASE }} />
        <motion.circle cx="260" cy={150 - 0.96 * 120} r="5" fill="#aad39c" initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: 1.5 }} />
      </svg>
    </div>
  );
}
