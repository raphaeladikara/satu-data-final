import { lazy, Suspense, useState } from 'react';
import { motion } from 'framer-motion';
import { Box, Eye, EyeOff, Layers, Move3d, ScanSearch } from 'lucide-react';
import type { Brain3D } from '@/lib/brain3d';
import { cn } from '@/lib/utils';
import SliceCanvas from './SliceCanvas';
import type { Series3D } from './MriHologram';

const MriHologram = lazy(() => import('./MriHologram'));

const SERIES: { k: Series3D; d: string }[] = [
  { k: 'DWI', d: 'terang = difusi terbatas' },
  { k: 'ADC', d: 'gelap = restriksi sejati' },
  { k: 'FLAIR', d: 'anatomi & lesi lama' },
];

/**
 * Lab 3D di modul belajar: hologram tumpukan slice + slice 2D yang tersinkron.
 * Kunci lesi tersembunyi dulu supaya mahasiswa mencari sendiri.
 */
export default function Lab3D({ caseId, initialSeries = 'DWI' }: { caseId: string; initialSeries?: Series3D }) {
  const [series, setSeries] = useState<Series3D>(initialSeries);
  const [explode, setExplode] = useState(0.35);
  const [showKey, setShowKey] = useState(false);
  const [brain, setBrain] = useState<Brain3D | null>(null);
  const [slice, setSlice] = useState<number | null>(null);
  const Z = brain?.dims[2] ?? 25;
  const z = slice ?? Math.floor(Z / 2);
  const maxLes = brain ? Math.max(1, ...brain.lesionPerSlice) : 1;

  return (
    <div className="grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
      <div className="relative h-[440px] overflow-hidden rounded-[1.6rem] bg-[radial-gradient(110%_80%_at_50%_0%,#1f6b7a_0%,#0f3a43_50%,#061a1f_100%)] sm:h-[500px]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(147,199,207,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(147,199,207,.06)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(70%_60%_at_50%_45%,black,transparent)]" />
        <Suspense fallback={null}>
          <MriHologram caseId={caseId} series={series} explode={explode} lesion={showKey} focusSlice={z} scan={false} autoRotate={false} onReady={(b) => setBrain(b)} />
        </Suspense>
        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 font-mono text-[11px] text-sky/80">
          <Box className="size-3.5" /> SOOP {caseId} · {series} · slice {z + 1}/{Z}
        </div>
        <p className="pointer-events-none absolute right-4 top-4 hidden items-center gap-1.5 text-[11px] text-sky/60 sm:flex">
          <Move3d className="size-3.5" /> seret untuk memutar
        </p>

        <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-end gap-2">
          <div data-tour="lab-series" className="flex gap-1 rounded-2xl border border-white/10 bg-teal-950/70 p-1 backdrop-blur-md">
            {SERIES.map((s) => (
              <button key={s.k} onClick={() => setSeries(s.k)} aria-pressed={series === s.k} title={s.d} className={cn('rounded-xl px-3 py-1.5 font-mono text-[11px] transition-colors', series === s.k ? 'bg-mint text-teal-900' : 'text-sky/80 hover:text-mint')}>
                {s.k}
              </button>
            ))}
          </div>
          <label data-tour="lab-explode" className="flex min-w-[170px] flex-1 items-center gap-2.5 rounded-2xl border border-white/10 bg-teal-950/70 px-3 py-2 text-[11px] text-sky/80 backdrop-blur-md">
            <Layers className="size-3.5 shrink-0" />
            <span className="shrink-0">Pisahkan slice</span>
            <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(+e.target.value)} className="w-full accent-[#aad39c]" aria-label="Jarak antar-slice" />
          </label>
          <button
            data-tour="lab-key"
            onClick={() => setShowKey(!showKey)}
            aria-pressed={showKey}
            className={cn('flex items-center gap-1.5 rounded-2xl px-3.5 py-2.5 text-[12px] font-medium transition-colors', showKey ? 'bg-terra text-white' : 'border border-white/10 bg-teal-950/70 text-mint backdrop-blur-md hover:bg-teal-900')}
          >
            {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {showKey ? 'Sembunyikan kunci' : 'Tampilkan kunci lesi'}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative overflow-hidden rounded-[1.6rem] bg-black">
          <SliceCanvas caseId={caseId} series={series} slice={z} windowHi={series === 'ADC' ? 240 : series === 'FLAIR' ? 230 : 200} showKey={showKey} className="aspect-square w-full" />
          <span className="pointer-events-none absolute left-3 top-3 font-mono text-[10px] text-sky/80">2D · slice {z + 1}</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-white/50">R</span>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-white/50">L</span>
        </div>
        <div data-tour="lab-slice" className="rounded-[1.4rem] card-surface p-4">
          <div className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-1.5 font-medium">
              <ScanSearch className="size-4 text-teal" /> Pilih slice
            </span>
            <span className="text-ink/50">{showKey ? 'batang = luas lesi per slice' : 'tampilkan kunci untuk melihat sebaran lesi'}</span>
          </div>
          {/* sebaran lesi per slice: petunjuk visual di mana harus mencari */}
          <div className="mt-3 flex h-14 items-end gap-[2px]" role="group" aria-label="Slice">
            {Array.from({ length: Z }, (_, k) => {
              const v = brain ? brain.lesionPerSlice[k] / maxLes : 0;
              return (
                <button key={k} onClick={() => setSlice(k)} aria-label={`Slice ${k + 1}`} className="group relative h-full flex-1">
                  <motion.span
                    className={cn('absolute inset-x-0 bottom-0 rounded-t-[3px] transition-colors', k === z ? 'bg-teal' : showKey && v > 0 ? 'bg-terra/70 group-hover:bg-terra' : 'bg-ink/10 group-hover:bg-ink/25')}
                    animate={{ height: showKey && v > 0 ? `${18 + v * 82}%` : k === z ? '100%' : '22%' }}
                    transition={{ duration: 0.4 }}
                  />
                </button>
              );
            })}
          </div>
          <input type="range" min={0} max={Z - 1} value={z} onChange={(e) => setSlice(+e.target.value)} className="mt-3 w-full accent-[#195764]" aria-label="Geser slice" />
        </div>
      </div>
    </div>
  );
}
