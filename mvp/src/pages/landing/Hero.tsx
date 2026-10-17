import { lazy, Suspense, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Move3d } from 'lucide-react';
import { EASE } from './bits';

const MriHologram = lazy(() => import('@/components/three/MriHologram'));

/**
 * Hero (adaptasi 21st.dev "lunar-gravity-card"): kartu hitam, judul di kiri, dan di kanan
 * volume MRI asli pasien SOOP yang dikelilingi cincin partikel. Satu-satunya 3D otak di halaman.
 */
export default function Hero({ cases }: { cases: number }) {
  const reduce = useReducedMotion();
  const [ringKey, setRingKey] = useState(0);
  const down = useRef<[number, number] | null>(null);
  const enter = (d: number) => (reduce ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.9, delay: d, ease: EASE } });

  return (
    <section id="top" className="px-3 pt-[5.5rem] sm:px-5 sm:pt-24">
      <div className="relative mx-auto flex max-w-[1360px] flex-col overflow-hidden rounded-[2rem] bg-[#020708] ring-1 ring-white/[0.07] shadow-[0_40px_100px_-40px_rgba(2,7,8,.55)] md:h-[min(86svh,780px)] md:min-h-[620px] md:flex-row md:rounded-[2.5rem]">
        {/* gelap dari kiri supaya teks selalu terbaca di atas cincin */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[58%] bg-gradient-to-b from-[#020708] via-[#020708]/90 to-transparent md:inset-y-0 md:left-0 md:h-full md:w-[58%] md:bg-gradient-to-r" />

        <div className="relative z-20 flex flex-col justify-center px-7 pb-4 pt-12 sm:px-12 md:w-[48%] md:py-0 md:pl-16 lg:pl-20">
          <motion.h1 {...enter(0.1)} className="text-[clamp(2.7rem,5.4vw,5.1rem)] font-bold leading-[0.96] tracking-[-0.035em]">
            <span className="text-white">Latih matamu</span>
            <br />
            <span className="text-zinc-500">membaca MRI stroke.</span>
          </motion.h1>
          <motion.p {...enter(0.22)} className="mt-6 max-w-[25rem] text-[16.5px] leading-relaxed text-zinc-400">
            Baca kasus MRI pasien sungguhan, tandai lesinya, lalu langsung tahu di bagian mana kamu keliru. Umpan balik setingkat voxel, tanpa menunggu radiolog.
          </motion.p>
          <motion.div {...enter(0.32)} className="mt-8 flex flex-wrap gap-2.5">
            <Link to="/daftar" className="group inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-[#020708] transition-[background-color,transform] duration-150 hover:bg-zinc-200 active:scale-[0.97]">
              Mulai belajar gratis <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link to="/daftar?peran=dosen" className="inline-flex h-12 items-center rounded-full px-6 text-[15px] font-medium text-zinc-200 ring-1 ring-white/15 transition-[background-color,transform] duration-150 hover:bg-white/[0.06] active:scale-[0.97]">
              Saya dosen
            </Link>
          </motion.div>
          <motion.dl {...enter(0.42)} className="mt-10 flex gap-8 border-t border-white/10 pt-5">
            {[
              [String(cases), 'kasus MRI asli'],
              ['6', 'modul belajar'],
              ['4', 'metrik penilaian'],
            ].map(([n, l]) => (
              <div key={l}>
                <dt className="text-[22px] font-semibold leading-none tabular-nums text-white">{n}</dt>
                <dd className="mt-1.5 text-[12.5px] text-zinc-500">{l}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        <div
          className="relative z-0 h-[440px] w-full md:absolute md:inset-y-0 md:right-0 md:h-full md:w-[66%]"
          onPointerDown={(e) => (down.current = [e.clientX, e.clientY])}
          onPointerUp={(e) => {
            const d = down.current;
            // klik tanpa seret: cincin dibentuk ulang
            if (d && Math.hypot(e.clientX - d[0], e.clientY - d[1]) < 6) setRingKey((k) => k + 1);
            down.current = null;
          }}
        >
          <Suspense fallback={null}>
            <MriHologram className="absolute inset-0" ring ringKey={ringKey} series="DWI" lesion scan={false} zoom={1.32} />
          </Suspense>
          <p className="pointer-events-none absolute right-6 top-6 z-20 hidden font-mono text-[11px] text-zinc-500 md:block">SOOP sub-754 · DWI · 25 slice</p>
          <p className="pointer-events-none absolute bottom-6 right-6 z-20 flex items-center gap-1.5 text-[12px] text-zinc-500">
            <Move3d className="size-3.5" /> Seret untuk memutar, klik untuk mengulang
          </p>
        </div>
      </div>
    </section>
  );
}
