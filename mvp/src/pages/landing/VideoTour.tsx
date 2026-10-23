import { useState } from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Eyebrow, Reveal } from './bits';

// video pitch SINAPS di YouTube; diputar lewat embed, bukan di-host sendiri
const VIDEO_ID = 'H7zd5U3Dl_E';
const TITLE = 'Mahasiswa Kedokteran Bingung Baca MRI Stroke? Kami Bikin Tutor AI yang Nggak Ngarang | SINAPS';

// bab diringkas dari deskripsi video
const CHAPTERS = [
  [0, '0:00', 'Ujian tanpa data'],
  [46, '0:46', 'Radiolog yang langka'],
  [107, '1:47', 'Chatbot yang mengarang'],
  [147, '2:27', 'Kenalan dengan SINAPS'],
  [180, '3:00', 'Arsitektur enam modul'],
  [228, '3:48', 'Demo aplikasi'],
  [286, '4:46', 'Hasil uji'],
] as const;

function embedSrc(start: number) {
  // mute=1: selalu mulai tanpa suara, pengguna menyalakan sendiri lewat kontrol YouTube
  const q = new URLSearchParams({ autoplay: '1', mute: '1', start: String(start), rel: '0', modestbranding: '1', playsinline: '1' });
  return `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?${q}`;
}

export default function VideoTour() {
  // null = masih poster; angka = detik mulai iframe
  const [start, setStart] = useState<number | null>(null);

  return (
    <section id="video" className="mx-auto max-w-[1320px] scroll-mt-24 px-4 pt-20 sm:px-6 lg:pt-28">
      <Reveal className="mx-auto max-w-3xl text-center">
        <Eyebrow className="justify-center">Tonton dulu · 5 menit</Eyebrow>
        <h2 className="mt-5 text-balance font-serif text-[clamp(1.9rem,3.4vw,3rem)] leading-[1.12] tracking-[-0.01em] text-ink">
          Dari ruang kuliah yang kekurangan kasus, <em className="text-teal">sampai tutor yang tidak mengarang.</em>
        </h2>
        <p className="mx-auto mt-5 max-w-[60ch] text-pretty text-[16px] leading-relaxed text-ink/65">
          Ikuti Dika, mahasiswa yang besok ujian membaca MRI stroke tanpa data pasien. Lihat bagaimana SINAPS menilai anotasinya, membimbing lewat pertanyaan, dan melapor ke dosen.
        </p>
      </Reveal>

      <Reveal y={40} delay={0.08} className="relative mx-auto mt-12 max-w-[1080px]">
        {/* sudut bidik, senada dengan viewer MRI di hero */}
        {[
          'left-0 top-0 border-l border-t',
          'right-0 top-0 border-r border-t',
          'bottom-0 left-0 border-b border-l',
          'bottom-0 right-0 border-b border-r',
        ].map((c) => (
          <span key={c} aria-hidden className={cn('pointer-events-none absolute size-6 border-teal/60 sm:size-8', c)} />
        ))}
        <div className="p-3 sm:p-5">
          <div className="relative aspect-video overflow-hidden rounded-[1.4rem] bg-ink shadow-[0_30px_60px_-30px_rgba(4,47,46,.45)]">
            {start === null ? (
              <button type="button" onClick={() => setStart(0)} aria-label="Putar video SINAPS (tanpa suara)" className="group absolute inset-0 block size-full">
                <img
                  src={`https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid size-16 place-items-center rounded-full bg-white/95 text-teal shadow-lg transition-transform duration-200 group-hover:scale-105 group-active:scale-[0.96] sm:size-20">
                    <Play className="ml-1 size-7 fill-current sm:size-8" />
                  </span>
                </span>
                <span className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-left font-mono text-[12px] text-white/85 sm:bottom-5 sm:left-6 sm:right-6">
                  <span>SINAPS · video pitch</span>
                  <span className="rounded-full bg-black/40 px-2.5 py-1">5:14</span>
                </span>
              </button>
            ) : (
              <iframe
                key={start}
                src={embedSrc(start)}
                title={TITLE}
                className="absolute inset-0 size-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            )}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.12} className="mx-auto mt-6 max-w-[1080px] px-3 sm:px-5">
        <ol className="flex flex-wrap justify-center gap-2" aria-label="Bab video">
          {CHAPTERS.map(([sec, ts, label]) => (
            <li key={sec}>
              <button
                type="button"
                onClick={() => setStart(sec)}
                className={cn(
                  'flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors active:scale-[0.97]',
                  start === sec ? 'border-teal bg-teal text-white' : 'border-line text-ink/70 hover:border-teal/40 hover:text-ink',
                )}
              >
                <span className={cn('font-mono text-[12px]', start === sec ? 'text-white/80' : 'text-teal')}>{ts}</span>
                {label}
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-center text-[13px] text-ink/50">Video diputar tanpa suara. Nyalakan suara lewat ikon speaker di pemutar.</p>
      </Reveal>
    </section>
  );
}
