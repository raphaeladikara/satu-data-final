import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Clock, GraduationCap, Sparkles, Target } from 'lucide-react';
import { api, fmt, type LessonProgress } from '../../api';
import { AppShell } from '@/components/AppShell';
import { Tour, useTour, type TourStep } from '@/components/Tour';
import { OrbitSpotlightGallery, type OrbitSpotlightItem } from '@/components/ui/orbit-spotlight-gallery';
import { buttonClass } from '@/components/ui/button';
import { sliceDataURL, type SliceOpts } from '@/components/three/SliceCanvas';
import { loadBrain3D } from '@/lib/brain3d';
import { cn } from '@/lib/utils';
import { LESSONS, type Lesson } from '../../content/lessons';

export { Modul } from './Modul';
import { useProgress } from './useProgress';

// thumbnail tiap modul diambil dari slice MRI kasus contoh yang memang dipakai di modul itu
const THUMB: Record<string, [string, SliceOpts]> = {
  orientasi: ['sub-754', { series: 'FLAIR', windowHi: 230 }],
  k1: ['sub-754', { series: 'ADC', windowHi: 240 }],
  k2: ['sub-754', { series: 'DWI', windowHi: 200, fillKey: true }],
  k3: ['sub-1320', { series: 'DWI', windowHi: 200, showKey: true }],
  k6: ['sub-652', { series: 'DWI', windowHi: 200, fillKey: true }],
  k4k5: ['sub-652', { series: 'FLAIR', windowHi: 230 }],
};

function useThumbs() {
  const [thumbs, setThumbs] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    let off = false;
    Promise.all(
      LESSONS.map(async (l) => {
        const [id, o] = THUMB[l.id] ?? ['sub-754', {}];
        try {
          return [l.id, sliceDataURL(await loadBrain3D(id), o)] as const;
        } catch {
          return [l.id, ''] as const;
        }
      }),
    ).then((r) => !off && setThumbs(Object.fromEntries(r)));
    return () => {
      off = true;
    };
  }, []);
  return thumbs;
}

const kcLabel = (l: Lesson) => l.kc ?? (l.id === 'orientasi' ? 'Dasar' : 'Pengantar');

const TOUR: TourStep[] = [
  { title: 'Selamat datang di modul belajar', body: 'Enam modul singkat menyiapkanmu sebelum latihan bernilai. Panduan ini cuma butuh setengah menit.' },
  { target: 'orbit', title: 'Modul mengorbit di sini', body: 'Setiap kartu adalah satu modul, dengan gambar dari kasus MRI yang dipakai di dalamnya. Klik salah satu untuk mendekatkannya.', waitForClick: true, padding: 4 },
  { target: 'preview', title: 'Pratinjau modul', body: 'Di sini terlihat tujuan, durasi, dan status kuis modul yang dipilih. Tombol hijau tua membuka modulnya.' },
  { target: 'path', title: 'Jalur belajarmu', body: 'Urutan yang disarankan, dari orientasi sampai pengantar K4/K5. Modul yang lulus kuis ditandai centang.' },
  { target: 'help', title: 'Bisa diputar ulang', body: 'Lupa caranya? Tekan Panduan kapan saja untuk menonton panduan ini lagi.' },
];

export default function Belajar() {
  const { p, mastery } = useProgress();
  const thumbs = useThumbs();
  const [sel, setSel] = useState<number | null>(null);
  const tour = useTour('belajar', { when: !!p && !!thumbs });

  const done = LESSONS.filter((l) => p?.[l.id]?.completed).length;
  const nextIdx = Math.max(0, LESSONS.findIndex((l) => !p?.[l.id]?.completed));
  const minutesLeft = LESSONS.filter((l) => !p?.[l.id]?.completed).reduce((a, l) => a + l.menit, 0);
  const focus = LESSONS[sel ?? nextIdx];

  const items: OrbitSpotlightItem[] = useMemo(
    () =>
      LESSONS.map((l, i) => {
        const st = p?.[l.id];
        return {
          src: thumbs?.[l.id] ?? '',
          alt: `Slice MRI untuk modul ${l.judul}`,
          title: `${i + 1}. ${l.judul.split(':')[0]}`,
          meta: `${kcLabel(l)} · ${l.menit} menit · ${st?.completed ? 'selesai' : st ? 'sudah dibuka' : 'belum dibuka'}`,
          description: l.ringkas,
        };
      }),
    [p, thumbs],
  );

  return (
    <AppShell onHelp={tour.start} wide>
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <h1 className="max-w-3xl font-serif text-[clamp(1.87rem,3.43vw,2.96rem)] leading-[1.12] tracking-[-0.01em]">
            Bangun dasarnya dulu, <em className="text-teal">baru baca kasusnya.</em>
          </h1>
          <p className="mt-3 max-w-2xl text-[15.5px] text-ink/60">Materi singkat per kompetensi, contoh kasus 3D interaktif, dan kuis cepat. Lulus kuis (≥ 2 dari 3 benar) untuk menandai modul selesai.</p>
        </div>
        <ProgressCard done={done} total={LESSONS.length} minutes={minutesLeft} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div data-tour="orbit" className="relative overflow-hidden rounded-[2rem] card-surface">
          {thumbs && p ? (
            <OrbitSpotlightGallery
              items={items}
              selected={sel}
              onSelectedChange={setSel}
              title="Enam modul"
              kicker="Jalur menuju latihan bernilai"
              countLabel="MODUL"
              autoplay
              orbitSeconds={48}
              wheel={false}
              className="!bg-transparent"
              style={{ height: 'min(560px, 72svh)' }}
            />
          ) : (
            <div className="grid h-[min(560px,72svh)] place-items-center">
              <span className="size-9 animate-[spin_0.7s_linear_infinite] rounded-full border-2 border-teal/20 border-t-teal" />
            </div>
          )}
        </div>

        <motion.aside key={focus.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} data-tour="preview" className="flex flex-col rounded-[2rem] bg-teal-900 p-6 text-mint">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-leaf px-2.5 py-1 font-mono text-[11px] font-semibold text-teal-900">{kcLabel(focus)}</span>
            <span className="flex items-center gap-1 text-[12px] text-mint/60">
              <Clock className="size-3.5" /> {focus.menit} menit
            </span>
            {sel === null && (
              <span className="ml-auto flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px]">
                <Sparkles className="size-3" /> disarankan
              </span>
            )}
          </div>
          <h2 className="mt-4 font-serif text-[1.48rem] leading-[1.08]">{focus.judul}</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-mint/70">{focus.ringkas}</p>
          <p className="mt-5 text-[11px] uppercase tracking-wider text-leaf">Setelah modul ini kamu bisa</p>
          <ul className="mt-2 space-y-2">
            {focus.tujuan.slice(0, 3).map((t) => (
              <li key={t} className="flex gap-2.5 text-[13.5px] leading-snug text-mint/85">
                <Check className="mt-0.5 size-4 shrink-0 text-leaf" />
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-6">
            <LessonStatus lesson={focus} p={p} mastery={mastery} />
            <Link to={`/belajar/${focus.id}`} className={buttonClass('light', 'lg', 'mt-4 w-full')}>
              {p?.[focus.id] ? 'Lanjutkan modul' : 'Buka modul'} <ArrowRight className="size-4" />
            </Link>
          </div>
        </motion.aside>
      </div>

      <section data-tour="path" className="mt-4 rounded-[2rem] card-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[18px] font-medium tracking-tight">Jalur belajar</h2>
          <span className="text-[12.5px] text-ink/50">Materi adalah draf tim berdasarkan korpus SINAPS, menunggu tinjauan dosen mitra.</span>
        </div>
        <ol className="mt-6 grid grid-cols-3 gap-2 lg:grid-cols-6 lg:gap-3">
          {LESSONS.map((l, i) => {
            const st = p?.[l.id];
            const isNext = i === nextIdx && !st?.completed;
            return (
              <li key={l.id} className="relative">
                {i < LESSONS.length - 1 && <span aria-hidden="true" className={cn('absolute left-[calc(50%+22px)] top-5 hidden h-0.5 w-[calc(100%-44px+12px)] lg:block', st?.completed ? 'bg-sage' : 'bg-ink/10')} />}
                <Link to={`/belajar/${l.id}`} onMouseEnter={() => setSel(i)} className="group flex flex-col items-center gap-2 rounded-2xl p-2 text-center transition-colors hover:bg-mint/60">
                  <span
                    className={cn(
                      'relative grid size-10 place-items-center rounded-full font-mono text-[13px] font-semibold transition-transform group-hover:scale-110',
                      st?.completed ? 'bg-sage text-white' : isNext ? 'bg-teal text-mint' : 'bg-ink/6 text-ink/50',
                    )}
                  >
                    {st?.completed ? <Check className="size-4" /> : i + 1}
                    {isNext && <span className="absolute inset-0 animate-ping rounded-full bg-teal/30" />}
                  </span>
                  <span className="text-[12px] font-medium text-ink/50">{kcLabel(l)}</span>
                  <span className="line-clamp-2 text-[13px] leading-snug text-ink/80">{l.judul.split(':')[0]}</span>
                  {st?.n_tries ? <span className={cn('text-[11px]', st.completed ? 'text-sage' : 'text-terra')}>kuis {fmt.pct(st.best_score)}</span> : null}
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <Tour steps={TOUR} open={tour.open} onClose={tour.close} />
    </AppShell>
  );
}

function ProgressCard({ done, total, minutes }: { done: number; total: number; minutes: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4 rounded-[1.6rem] card-surface px-5 py-4">
      <div className="relative size-[76px]">
        <svg viewBox="0 0 76 76" className="size-full -rotate-90">
          <circle cx="38" cy="38" r={r} fill="none" strokeWidth="8" className="stroke-ink/8" />
          <motion.circle cx="38" cy="38" r={r} fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-sage" initial={{ strokeDasharray: `0 ${c}` }} animate={{ strokeDasharray: `${(done / total) * c} ${c}` }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
        </svg>
        <span className="absolute inset-0 grid place-items-center font-serif text-[1.25rem] leading-none">
          {done}
          <span className="sr-only"> dari {total}</span>
        </span>
      </div>
      <div className="leading-tight">
        <p className="flex items-center gap-1.5 text-[14px] font-medium">
          <GraduationCap className="size-4 text-teal" /> {done} dari {total} modul selesai
        </p>
        <p className="mt-1 text-[12.5px] text-ink/55">{minutes ? `Sisa sekitar ${minutes} menit materi` : 'Semua modul sudah lulus kuis'}</p>
      </div>
    </div>
  );
}

function LessonStatus({ lesson, p, mastery }: { lesson: Lesson; p: LessonProgress | null; mastery: Record<string, number> }) {
  const st = p?.[lesson.id];
  const m = lesson.kc ? mastery[lesson.kc] : undefined;
  return (
    <div className="grid grid-cols-2 gap-2 text-[12px]">
      <div className="rounded-2xl bg-white/8 p-3">
        <p className="text-mint/55">Kuis</p>
        <p className="mt-1 text-[14px] font-medium">{st?.completed ? `Lulus · ${fmt.pct(st.best_score)}` : st?.n_tries ? `${fmt.pct(st.best_score)} · belum lulus` : 'Belum dicoba'}</p>
      </div>
      <div className="rounded-2xl bg-white/8 p-3">
        <p className="flex items-center gap-1 text-mint/55">
          <Target className="size-3" /> Penguasaan
        </p>
        {m !== undefined && lesson.dinilai ? (
          <>
            <p className="mt-1 text-[14px] font-medium">{fmt.pct(m)}</p>
            <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full bg-leaf" style={{ width: `${m * 100}%` }} />
            </span>
          </>
        ) : (
          <p className="mt-1 text-[14px] font-medium text-mint/70">{lesson.kc ? 'Belum dinilai di MVP' : 'Tidak dinilai'}</p>
        )}
      </div>
    </div>
  );
}
