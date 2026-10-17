import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Columns2, Layers, Minus, Move3d, Plus, RotateCcw } from 'lucide-react';
import type { Brain3D } from '@/lib/brain3d';
import type { Series3D } from '@/components/three/MriHologram';
import { cn } from '@/lib/utils';
import { EASE } from './bits';

const MriHologram = lazy(() => import('@/components/three/MriHologram'));

const ZOOM0 = 1.05;

/**
 * Hero: hologram MRI asli pasien SOOP yang menyatu dengan latar putih, bergaya HUD.
 * Slice bisa dipisah, hemisfer bisa dibelah, dan kamera bisa masuk ke dalam tumpukan slice.
 * Satu-satunya 3D otak di halaman depan.
 */
export default function Hero({ cases }: { cases: number }) {
  const reduce = useReducedMotion();
  const [series, setSeries] = useState<Series3D>('DWI');
  const [explode, setExplode] = useState(false);
  const [split, setSplit] = useState(false);
  const [zoom, setZoom] = useState(ZOOM0);
  const [brain, setBrain] = useState<Brain3D | null>(null);
  const enter = (d: number) => (reduce ? {} : { initial: { y: 12 }, animate: { y: 0 }, transition: { duration: 0.8, delay: d, ease: EASE } });
  const lesionSlices = brain?.lesionPerSlice.filter((n) => n > 0).length ?? 0;
  const zoomPct = Math.round((ZOOM0 / zoom) * 100);
  const clampZoom = (z: number) => setZoom(Math.min(1.8, Math.max(0.3, z)));

  return (
    <section id="top" className="relative overflow-hidden">
      <div className="mx-auto grid min-h-[100svh] max-w-[1360px] items-center gap-6 px-5 pb-10 pt-24 sm:px-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-0 lg:pb-6">
        <div className="relative z-10 max-w-[34rem]">
          <motion.h1 {...enter(0.05)} className="text-[clamp(2.7rem,5.2vw,4.9rem)] font-bold leading-[0.98] tracking-[-0.035em] text-ink">
            Latih matamu
            <br />
            <span className="text-ink/35">membaca MRI stroke.</span>
          </motion.h1>
          <motion.p {...enter(0.15)} className="mt-6 max-w-[27rem] text-[17px] leading-relaxed text-ink/60">
            Baca kasus MRI pasien sungguhan, tandai lesinya, lalu langsung tahu di bagian mana kamu keliru. Umpan balik setingkat voxel, tanpa menunggu radiolog.
          </motion.p>
          <motion.div {...enter(0.25)} className="mt-8 flex flex-wrap gap-2.5">
            <Link to="/daftar" className="group inline-flex h-12 items-center gap-2 rounded-full bg-teal px-6 text-[15px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-teal-800 active:scale-[0.97]">
              Mulai belajar gratis <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link to="/daftar?peran=dosen" className="inline-flex h-12 items-center rounded-full px-6 text-[15px] font-medium text-ink ring-1 ring-ink/15 transition-[background-color,transform] duration-150 hover:bg-ink/[0.04] active:scale-[0.97]">
              Saya dosen
            </Link>
          </motion.div>
          <motion.dl {...enter(0.35)} className="mt-10 flex gap-8 border-t border-line pt-5">
            {[
              [String(cases), 'kasus MRI asli'],
              ['6', 'modul belajar'],
              ['4', 'metrik penilaian'],
            ].map(([n, l]) => (
              <div key={l}>
                <dt className="text-[22px] font-semibold leading-none tabular-nums text-ink">{n}</dt>
                <dd className="mt-1.5 text-[12.5px] text-ink/50">{l}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        <div className="relative">
          {/* panggung hologram: tanpa bingkai, tepinya memudar ke latar */}
          <div className="relative mx-auto aspect-square w-full max-w-[min(100%,680px)] lg:max-w-[min(100%,calc(100svh-200px))]">
            <Hud spin={!reduce} />
            <div className="absolute inset-0 [mask-image:radial-gradient(closest-side,black_72%,transparent)]">
              <Suspense fallback={null}>
                <MriHologram className="absolute inset-0" theme="light" series={series} explode={explode ? 1 : 0} split={split ? 1 : 0} lesion scan zoom={zoom} onZoomChange={setZoom} onReady={setBrain} />
              </Suspense>
            </div>
            <dl className="pointer-events-none absolute left-[6%] top-[9%] font-mono text-[11px] leading-relaxed">
              <dt className="text-ink/40">SOOP</dt>
              <dd className="text-ink/75">
                {brain?.id ?? 'sub-754'} · {series}
              </dd>
            </dl>
            <dl className="pointer-events-none absolute right-[6%] top-[9%] text-right font-mono text-[11px] leading-relaxed">
              <dt className="text-ink/40">ZOOM</dt>
              <dd className="tabular-nums text-ink/75">{zoomPct}%</dd>
            </dl>
            <dl className="pointer-events-none absolute bottom-[9%] left-[6%] font-mono text-[11px] leading-relaxed">
              <dt className="text-ink/40">SLICE</dt>
              <dd className="tabular-nums text-ink/75">{brain ? `${brain.dims[2]} aksial · ${brain.spacing[2]} mm` : '—'}</dd>
            </dl>
            <dl className="pointer-events-none absolute bottom-[9%] right-[6%] text-right font-mono text-[11px] leading-relaxed">
              <dt className="text-ink/40">LESI</dt>
              <dd className="tabular-nums text-[#c2410c]">{brain ? `${lesionSlices} slice berlesi` : '—'}</dd>
            </dl>
          </div>

          <div className="relative z-10 -mt-2 flex flex-col items-center gap-2.5">
            <div className="flex flex-wrap items-center justify-center gap-1 rounded-full bg-white p-1 shadow-[0_8px_28px_-14px_rgba(15,23,42,.35)] ring-1 ring-line">
              {(['DWI', 'ADC', 'FLAIR'] as const).map((s) => (
                <button key={s} onClick={() => setSeries(s)} aria-pressed={series === s} className={cn('h-9 rounded-full px-3.5 font-mono text-[12px] font-medium transition-colors', series === s ? 'bg-ink text-white' : 'text-ink/60 hover:bg-ink/5 hover:text-ink')}>
                  {s}
                </button>
              ))}
              <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />
              <Toggle on={explode} onClick={() => setExplode(!explode)} icon={<Layers className="size-4" />} label="Pisah slice" />
              <Toggle on={split} onClick={() => setSplit(!split)} icon={<Columns2 className="size-4" />} label="Belah hemisfer" />
              <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />
              <IconBtn label="Perkecil" onClick={() => clampZoom(zoom * 1.25)}>
                <Minus className="size-4" />
              </IconBtn>
              <IconBtn label="Zoom ke dalam" onClick={() => clampZoom(zoom / 1.25)}>
                <Plus className="size-4" />
              </IconBtn>
              <IconBtn
                label="Atur ulang"
                onClick={() => {
                  setZoom(ZOOM0);
                  setExplode(false);
                  setSplit(false);
                  setSeries('DWI');
                }}
              >
                <RotateCcw className="size-4" />
              </IconBtn>
            </div>
            <p className="flex items-center gap-1.5 text-center text-[12px] text-ink/45">
              <Move3d className="size-3.5 shrink-0" /> Seret untuk memutar. Klik otaknya lalu gulir (atau cubit) untuk masuk ke dalam.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Garis HUD tipis di belakang hologram: lingkar bertakik yang berputar pelan dan tanda sudut. */
function Hud({ spin }: { spin: boolean }) {
  const ticks = Array.from({ length: 72 }, (_, i) => i);
  return (
    <svg viewBox="0 0 400 400" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-teal">
      <g className={cn(spin && 'animate-[spin_90s_linear_infinite]')} style={{ transformOrigin: '200px 200px' }}>
        <circle cx="200" cy="200" r="168" fill="none" stroke="currentColor" strokeOpacity=".18" />
        {ticks.map((i) => {
          const a = (i / 72) * Math.PI * 2;
          const long = i % 6 === 0;
          const r1 = long ? 160 : 164;
          return <line key={i} x1={200 + Math.cos(a) * r1} y1={200 + Math.sin(a) * r1} x2={200 + Math.cos(a) * 168} y2={200 + Math.sin(a) * 168} stroke="currentColor" strokeOpacity={long ? 0.4 : 0.18} />;
        })}
      </g>
      <g className={cn(spin && 'animate-[spin_140s_linear_infinite_reverse]')} style={{ transformOrigin: '200px 200px' }}>
        <circle cx="200" cy="200" r="186" fill="none" stroke="currentColor" strokeOpacity=".14" strokeDasharray="2 10" />
        <path d="M200 14 A186 186 0 0 1 331 68" fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.5" />
        <path d="M200 386 A186 186 0 0 1 69 332" fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.5" />
      </g>
      {[
        [16, 16, 1, 1],
        [384, 16, -1, 1],
        [16, 384, 1, -1],
        [384, 384, -1, -1],
      ].map(([x, y, dx, dy], i) => (
        <path key={i} d={`M${x} ${y + dy * 18} V${y} H${x + dx * 18}`} fill="none" stroke="currentColor" strokeOpacity=".5" strokeWidth="1.5" />
      ))}
      <line x1="200" y1="190" x2="200" y2="210" stroke="currentColor" strokeOpacity=".25" />
      <line x1="190" y1="200" x2="210" y2="200" stroke="currentColor" strokeOpacity=".25" />
    </svg>
  );
}

function Toggle({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} aria-pressed={on} title={label} className={cn('flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors', on ? 'bg-teal text-white' : 'text-ink/65 hover:bg-ink/5 hover:text-ink')}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="grid size-9 place-items-center rounded-full text-ink/65 transition-[background-color,transform] hover:bg-ink/5 hover:text-ink active:scale-90">
      {children}
    </button>
  );
}
