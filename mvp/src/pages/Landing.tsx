import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, BookOpenCheck, ClipboardCheck, Database, Download, EyeOff, FileSearch, GraduationCap, Menu, ShieldCheck, Stethoscope, Users, X } from 'lucide-react';
import { api } from '../api';
import { homeFor, useAuth } from '../auth';
import { ButtonLink } from '@/components/ui/button';
import { BentoCard, DotGrid } from '@/components/ui/bento';
import { cn } from '@/lib/utils';
import { Wordmark } from '@/components/BrandMark';
import Hero, { LabStage } from './landing/Hero';
import CycleShowcase from './landing/CycleShowcase';
import Features from './landing/Features';
import { CountUp, EASE, Eyebrow, Parallax, Reveal, ScrollWords } from './landing/bits';

const ContributionSkyline = lazy(() => import('@/components/ui/contribution-skyline'));

const NAV = [
  ['#coba', 'Coba 3D'],
  ['#cara-kerja', 'Cara kerja'],
  ['#fitur', 'Fitur'],
  ['#dosen', 'Untuk dosen'],
  ['#privasi', 'Data & privasi'],
];

const KCS = [
  ['K1', 'Mengenali sekuens', true],
  ['K2', 'Mendeteksi hiperintensitas DWI', true],
  ['K3', 'Restriksi sejati vs T2 shine-through', true],
  ['K4', 'Mengenali teritori arteri', false],
  ['K5', 'Memperkirakan usia lesi', false],
  ['K6', 'Mendelineasi seluruh lesi', true],
] as const;

export default function Landing() {
  const { user, ready } = useAuth();
  const [stats, setStats] = useState<{ cases: number; practice_cases: number } | null>(null);
  useEffect(() => {
    api.stats().then(setStats).catch(() => setStats(null));
  }, []);
  if (ready && user) return <Navigate to={homeFor(user)} replace />;

  return (
    <div className="tw relative min-h-screen overflow-x-clip">
      <Nav />
      <main>
        <Hero cases={stats?.cases ?? 36} />
        <Marquee />
        <Problem />
        <Lab />

        <section id="cara-kerja" className="mx-auto max-w-[1320px] scroll-mt-10 px-4 pt-24 sm:px-6 lg:pt-32">
          <SectionHead eyebrow="Cara kerja" title={<>Satu siklus latihan terarah, <em className="text-teal">berulang sampai kompeten.</em></>} lead="Lima langkah ini terjadi setiap kali kamu mengerjakan satu kasus. Gulir untuk melihat tampilannya di aplikasi." />
          <div className="mt-6 lg:mt-0">
            <CycleShowcase />
          </div>
        </section>

        <section id="fitur" className="mx-auto max-w-[1320px] scroll-mt-24 px-4 py-24 sm:px-6 lg:py-32">
          <SectionHead eyebrow="Untuk mahasiswa" title={<>Semua yang kamu butuhkan untuk <em className="text-teal">berlatih mandiri.</em></>} />
          <div className="mt-14">
            <Features />
          </div>
          <KcStrip />
        </section>

        <Dosen />
        <Proof />
        <Privacy />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

function Nav() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, 'change', (y) => setSolid(y > 24));
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className={cn('mx-auto flex h-16 max-w-[1320px] items-center justify-between rounded-[1.4rem] pl-4 pr-2 transition-all duration-500', solid || open ? 'border border-ink/8 bg-paper/80 shadow-[0_10px_30px_-18px_rgba(16,49,58,.35)] backdrop-blur-xl' : 'border border-transparent')}>
        <a href="#top" aria-label="SINAPS, ke atas">
          <Wordmark />
        </a>
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Navigasi halaman">
          {NAV.map(([h, l]) => (
            <a key={h} href={h} className="rounded-full px-3.5 py-2 font-display text-[13px] uppercase tracking-[0.14em] text-ink/65 transition-colors hover:bg-ink/5 hover:text-ink">
              {l}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <ButtonLink to="/masuk" variant="ghost" size="sm" className="hidden sm:inline-flex">
            Masuk
          </ButtonLink>
          <ButtonLink to="/daftar" size="sm">
            Daftar
          </ButtonLink>
          <button className="grid size-9 place-items-center rounded-full text-ink lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <motion.nav initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-2 flex max-w-[1320px] flex-col rounded-3xl border border-ink/8 bg-paper/95 p-2 shadow-xl backdrop-blur-xl lg:hidden">
          {NAV.map(([h, l]) => (
            <a key={h} href={h} onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 font-display text-[14px] uppercase tracking-[0.14em] text-ink/80 hover:bg-ink/5">
              {l}
            </a>
          ))}
          <ButtonLink to="/masuk" variant="outline" className="m-2">
            Masuk
          </ButtonLink>
        </motion.nav>
      )}
    </header>
  );
}

function SectionHead({ eyebrow, title, lead, tone = 'teal', className, center }: { eyebrow: string; title: React.ReactNode; lead?: string; tone?: 'teal' | 'light'; className?: string; center?: boolean }) {
  return (
    <Reveal className={cn('max-w-3xl', center && 'mx-auto text-center', className)}>
      <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
      <h2 className={cn('mt-4 text-[clamp(1.9rem,3.6vw,3.1rem)] leading-[1.12] tracking-[-0.012em]', tone === 'light' ? 'text-mint' : 'text-ink')}>{title}</h2>
      {lead && <p className={cn('mt-5 max-w-2xl text-[16px] leading-relaxed', center && 'mx-auto', tone === 'light' ? 'text-mint/70' : 'text-ink/60')}>{lead}</p>}
    </Reveal>
  );
}

function Marquee() {
  const items = ['Cornerstone3D', 'SOOP · OpenNeuro ds004889', 'U-Net 2.5D', 'Bayesian Knowledge Tracing', 'Pemeriksa fakta tutor', 'UU PDP No. 27/2022', 'Mask buatan ahli', 'Dice · HD95 · recall per lesi'];
  return (
    <div className="relative border-y border-ink/8 bg-paper/60 py-5 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
      <div className="flex w-max animate-marquee gap-12 whitespace-nowrap">
        {[...items, ...items].map((t, i) => (
          <span key={i} className="flex items-center gap-12 font-display text-[19px] font-medium uppercase tracking-[0.14em] text-ink/45">
            {t}
            <span className="size-1.5 rounded-full bg-sage" />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── masalah: judul menyala per kata, tiga kartu bento berisi visual data ── */

function Problem() {
  return (
    <section className="mx-auto max-w-[1320px] px-4 pt-24 sm:px-6 lg:pt-36">
      <Reveal className="mx-auto max-w-5xl text-center">
        <Eyebrow>Masalahnya</Eyebrow>
      </Reveal>
      <ScrollWords
        text="Mahasiswa tidak butuh chatbot lagi. Mereka butuh tutor yang bisa diperiksa, dengan banyak kasus dan umpan balik yang cepat."
        className="mx-auto mt-6 max-w-5xl justify-center text-center text-[clamp(1.75rem,3.6vw,3.05rem)] leading-[1.22] tracking-[-0.012em] text-ink"
      />
      <div className="mt-16 grid gap-4 md:grid-cols-3">
        <Reveal y={40} className="h-full">
          <BentoCard
            className="md:rounded-tl-[2.5rem]"
            eyebrow="Radiolog"
            title={
              <span className="flex items-baseline gap-2">
                <CountUp to={0.8} decimals={1} className="text-[2.6rem] leading-none" /> <span className="text-[15px] font-normal text-mint/70">per 100.000 penduduk</span>
              </span>
            }
            description="Radiolog di Indonesia sekaligus menjadi pengajar radiologi. Waktu mereka untuk membimbing mahasiswa sangat terbatas."
            graphic={<PeopleGraphic />}
          />
        </Reveal>
        <Reveal y={40} delay={0.08} className="h-full">
          <BentoCard
            eyebrow="Kepercayaan diri"
            title={
              <span className="flex items-baseline gap-2">
                <CountUp to={26.9} decimals={1} suffix="%" className="text-[2.6rem] leading-none" /> <span className="text-[15px] font-normal text-mint/70">yakin mampu</span>
              </span>
            }
            description="Mahasiswa klinik dan dokter internsip yang yakin mampu membaca CT atau MRI kepala (survei 431 responden, 2026)."
            graphic={<WaffleGraphic value={27} />}
          />
        </Reveal>
        <Reveal y={40} delay={0.16} className="h-full">
          <BentoCard
            className="md:rounded-tr-[2.5rem]"
            eyebrow="Halusinasi AI"
            title={
              <span className="flex items-baseline gap-2">
                <CountUp to={74.4} decimals={1} suffix="%" className="text-[2.6rem] leading-none text-terra-soft" /> <span className="text-[15px] font-normal text-mint/70">jawaban keliru</span>
              </span>
            }
            description="Tingkat halusinasi model visi-bahasa umum saat membaca gambar klinis. Chatbot biasa belum layak menjadi pengajar."
            graphic={<GaugeGraphic value={0.744} />}
          />
        </Reveal>
      </div>
    </section>
  );
}

/** 1 radiolog di antara kerumunan titik (≈125.000 orang per radiolog). */
function PeopleGraphic() {
  const cols = 22;
  const rows = 11;
  const center = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
  return (
    <div className="absolute inset-0 grid place-items-start justify-center pt-9">
      <div className="grid gap-[7px]" style={{ gridTemplateColumns: `repeat(${cols}, 6px)` }}>
        {Array.from({ length: cols * rows }, (_, i) =>
          i === center ? (
            <span key={i} className="relative size-[6px]">
              <span className="absolute -inset-2 animate-ping rounded-full bg-leaf/50" />
              <span className="absolute -inset-[3px] rounded-full bg-leaf shadow-[0_0_14px_#aad39c]" />
            </span>
          ) : (
            <motion.span key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: (i % cols) * 0.02 + Math.floor(i / cols) * 0.015 }} className="size-[6px] rounded-full bg-sky/25" />
          ),
        )}
      </div>
    </div>
  );
}

function WaffleGraphic({ value }: { value: number }) {
  return (
    <div className="absolute inset-0 grid place-items-start justify-center pt-8">
      <DotGrid />
      <div className="relative grid grid-cols-10 gap-[6px]">
        {Array.from({ length: 100 }, (_, i) => (
          <motion.span
            key={i}
            initial={{ scale: 0.4, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.008, duration: 0.4, ease: EASE }}
            className={cn('size-[15px] rounded-[4px]', i < value ? 'bg-leaf shadow-[0_0_10px_rgba(170,211,156,.45)]' : 'bg-white/8')}
          />
        ))}
      </div>
    </div>
  );
}

function GaugeGraphic({ value }: { value: number }) {
  const R = 86;
  const half = Math.PI * R;
  return (
    <div className="absolute inset-0 grid place-items-start justify-center pt-12">
      <DotGrid />
      <svg viewBox="0 0 200 116" className="relative w-60" aria-hidden="true">
        <path d={`M14 104 A${R} ${R} 0 0 1 186 104`} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="16" strokeLinecap="round" />
        <motion.path d={`M14 104 A${R} ${R} 0 0 1 186 104`} fill="none" stroke="#e08a5f" strokeWidth="16" strokeLinecap="round" strokeDasharray={half} initial={{ strokeDashoffset: half }} whileInView={{ strokeDashoffset: half * (1 - value) }} viewport={{ once: true }} transition={{ duration: 1.6, ease: EASE }} />
        {Array.from({ length: 11 }, (_, i) => {
          const a = Math.PI * (1 - i / 10);
          return <line key={i} x1={100 + Math.cos(a) * 66} y1={104 - Math.sin(a) * 66} x2={100 + Math.cos(a) * 72} y2={104 - Math.sin(a) * 72} stroke="rgba(234,243,222,.35)" strokeWidth="1.4" />;
        })}
      </svg>
    </div>
  );
}

/* ── coba sendiri: hologram 3D yang dulu di hero ── */

function Lab() {
  return (
    <section id="coba" className="mx-auto max-w-[1320px] scroll-mt-24 px-4 pt-24 sm:px-6 lg:pt-32">
      <div className="grid items-center gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <SectionHead eyebrow="Coba sendiri" title={<>Otak pasien sungguhan, <em className="text-teal">bisa kamu putar.</em></>} lead="Ini volume MRI asli dari dataset SOOP, bukan ilustrasi. Putar hologramnya, pisahkan slice-nya, lalu nyalakan kunci lesi buatan ahli untuk melihat jawaban yang benar." />
          <Reveal delay={0.1} className="mt-8 grid max-w-md grid-cols-3 gap-3">
            {[
              ['DWI', 'difusi'],
              ['FLAIR', 'anatomi'],
              ['Mask', 'kunci ahli'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-paper p-3.5 ring-1 ring-ink/8">
                <b className="block font-display text-[17px] font-semibold uppercase tracking-[0.1em] text-teal">{k}</b>
                <span className="text-[12.5px] text-ink/55">{v}</span>
              </div>
            ))}
          </Reveal>
        </div>
        <LabStage />
      </div>
    </section>
  );
}

function KcStrip() {
  return (
    <Reveal className="mt-4">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-paper p-6 ring-1 ring-ink/8 shadow-[0_24px_60px_-40px_rgba(16,49,58,.5)] lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="lg:w-72">
            <span className="grid size-11 place-items-center rounded-2xl bg-teal text-mint">
              <BookOpenCheck className="size-5" />
            </span>
            <h3 className="mt-4 text-[20px] font-bold">Enam kompetensi, satu modul untuk tiap KC</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink/55">Materi singkat dengan contoh kasus 3D dan kuis cepat. Penguasaan tiap KC dilacak di peta belajarmu.</p>
          </div>
          <ul className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {KCS.map(([k, n, on], i) => (
              <motion.li
                key={k}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, ease: EASE }}
                className={cn('flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[13.5px]', on ? 'bg-mint/70 ring-1 ring-teal/12' : 'border border-dashed border-ink/15 text-ink/45')}
              >
                <span className={cn('rounded-lg px-2 py-1 font-display text-[12px] font-semibold tracking-wider', on ? 'bg-teal text-mint' : 'bg-ink/8 text-ink/50')}>{k}</span>
                <span className="flex-1">{n}</span>
                {!on && <em className="font-display text-[10.5px] uppercase not-italic tracking-[0.14em]">pilot</em>}
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </Reveal>
  );
}

const SKYLINE_PALETTE = { light: ['#d6e9cd', '#aad39c', '#80a874', '#195764'], dark: ['#1e4d3b', '#3f7d57', '#80a874', '#aad39c'] };

function Dosen() {
  const checks = [
    [Users, 'Peta penguasaan KC per mahasiswa dan rerata kelas'],
    [FileSearch, 'Jenis kesalahan delineasi tersering di kelas'],
    [Stethoscope, 'Penanda mahasiswa yang perlu perhatian'],
    [ClipboardCheck, 'Tugas berisi kasus dan modul, lengkap dengan tenggat'],
    [GraduationCap, 'Tinjau ulang anotasi mahasiswa di atas citra'],
    [ShieldCheck, 'Verifikasi kasus dan audit log tutor'],
    [Download, 'Ekspor CSV untuk penilaian dan penelitian'],
  ] as const;
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const rot = useTransform(scrollYProgress, [0, 1], [14, 0]);
  const sc = useTransform(scrollYProgress, [0, 1], [0.9, 1]);
  return (
    <section id="dosen" className="relative scroll-mt-20 overflow-hidden bg-teal-900 py-24 text-mint lg:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-40 -top-40 size-[620px] rounded-full bg-teal-600/50 blur-[140px]" />
        <div className="absolute -bottom-52 left-0 size-[520px] rounded-full bg-sage/25 blur-[140px]" />
        <div className="grain absolute inset-0 opacity-50 mix-blend-overlay" />
      </div>
      <div className="relative mx-auto max-w-[1320px] px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-end">
          <SectionHead tone="light" eyebrow="Untuk dosen" title={<>Pantau setiap mahasiswa <em className="text-leaf">tanpa mengoreksi satu per satu.</em></>} lead="Buat kelas, bagikan kodenya, lalu lihat perkembangan kelas secara langsung. Setiap umpan balik yang diterima mahasiswa bisa ditelusuri kembali ke datanya." />
          <div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {checks.map(([Icon, t], i) => (
                <Reveal key={t} delay={i * 0.04}>
                  <li className="flex h-full items-center gap-3 rounded-2xl bg-white/6 px-3.5 py-3 text-[13.5px] leading-snug text-mint/85 ring-1 ring-white/8">
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-leaf/15 text-leaf">
                      <Icon className="size-4" />
                    </span>
                    {t}
                  </li>
                </Reveal>
              ))}
            </ul>
            <ButtonLink to="/daftar?peran=dosen" variant="light" size="lg" className="mt-8">
              Daftar sebagai dosen <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
        </div>
        <div ref={ref} className="mt-14 [perspective:1600px]">
          <motion.div style={reduce ? undefined : { rotateX: rot, scale: sc }} className="origin-bottom rounded-[2rem] bg-white/6 p-2 ring-1 ring-white/10 backdrop-blur">
            <div className="rounded-[1.6rem] bg-paper p-1 text-ink">
              <Suspense fallback={<div className="h-[420px]" />}>
                <ContributionSkyline
                  className="!border-0 !bg-transparent"
                  palette={SKYLINE_PALETTE}
                  locale="id-ID"
                  unit="kasus"
                  unitPlural="kasus"
                  weekStart={1}
                  title={
                    <span>
                      <b className="font-bold">Aktivitas latihan kelas</b> <span className="text-ink/50">· pratinjau dasbor, data contoh</span>
                    </span>
                  }
                />
              </Suspense>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Proof() {
  const P = [
    { n: 94.6, dec: 1, suf: '%', k: 'Akurasi jenis kesalahan', t: 'pada 672 anotasi sintetis dari 36 subjek, dibanding 47,3% bila hanya memakai Dice.' },
    { n: 0.74, dec: 2, suf: '', k: 'Dice pembaca kedua', t: 'rerata U-Net 2.5D pada 36 kasus bank yang tidak pernah dipakai melatih model.' },
    { n: 1451, dec: 0, suf: '', k: 'Lesion mask akut', t: 'yang dipakai untuk menyusun indeks kesulitan kasus.' },
  ];
  return (
    <section className="mx-auto max-w-[1320px] px-4 py-24 sm:px-6 lg:py-32">
      <Parallax offset={30}>
        <div className="relative overflow-hidden rounded-[2.5rem] bg-[linear-gradient(115deg,#195764_0%,#2d746f_40%,#80a874_78%,#aad39c_100%)] p-8 text-mint sm:p-12 lg:p-16">
          <div className="grain pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay" />
          <Eyebrow tone="light">Uji kelayakan pada data nyata</Eyebrow>
          <div className="relative mt-10 grid gap-10 md:grid-cols-3 md:gap-6">
            {P.map((p, i) => (
              <Reveal key={i} delay={i * 0.08} className="md:border-l md:border-white/20 md:pl-6 md:first:border-0 md:first:pl-0">
                <p className="font-display text-[12px] uppercase tracking-[0.2em] text-mint/70">{p.k}</p>
                <CountUp to={p.n} decimals={p.dec} suffix={p.suf} className="mt-2 block text-[clamp(2.8rem,4.6vw,4.2rem)] font-bold leading-none" />
                <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-mint/80">{p.t}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </Parallax>
    </section>
  );
}

function Privacy() {
  const P = [
    [Database, 'Data terbuka', 'Data citra terbuka', 'Kasus berasal dari Stroke Outcome Optimization Project (SOOP), OpenNeuro ds004889, berlisensi CC0, dan sudah dianonimkan.', 'md:rounded-bl-[2.5rem]'],
    [EyeOff, 'Pseudonim', 'Log tanpa identitas', 'NIM tidak pernah disimpan, hanya pseudonim hasil hash. Log belajar dipakai untuk personalisasi dan evaluasi, sesuai UU PDP No. 27/2022.', ''],
    [ShieldCheck, 'Batas penggunaan', 'Alat bantu belajar', 'SINAPS tidak ditujukan untuk mendiagnosis pasien. Kunci jawaban selalu mask buatan ahli, bukan prediksi model.', 'md:rounded-br-[2.5rem]'],
  ] as const;
  return (
    <section id="privasi" className="mx-auto max-w-[1320px] scroll-mt-24 px-4 pb-24 sm:px-6 lg:pb-32">
      <SectionHead eyebrow="Data & privasi" title={<>Dibangun hati-hati, <em className="text-teal">sejak dari datanya.</em></>} />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {P.map(([Icon, e, t, d, cls], i) => (
          <Reveal key={t} delay={i * 0.06} y={36} className="h-full">
            <BentoCard className={cls} tone="deep" eyebrow={e} title={t} description={d} graphicClassName="h-[12rem]" graphic={<IconGraphic icon={Icon} />} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function IconGraphic({ icon: Icon }: { icon: typeof Database }) {
  return (
    <div className="absolute inset-0 grid place-items-center pb-8">
      <DotGrid />
      {[0, 1, 2].map((k) => (
        <span key={k} className="absolute rounded-full border border-sky/15" style={{ width: 90 + k * 64, height: 90 + k * 64, top: `calc(50% - 16px - ${(90 + k * 64) / 2}px)` }} />
      ))}
      <span className="relative grid size-16 place-items-center rounded-[1.25rem] bg-leaf/15 text-leaf ring-1 ring-leaf/30 shadow-[0_0_40px_-6px_rgba(170,211,156,.5)]">
        <Icon className="size-7" />
      </span>
    </div>
  );
}

function FinalCta() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] });
  const ring = useTransform(scrollYProgress, [0, 1], [0.6, 1.15]);
  return (
    <section className="mx-auto max-w-[1320px] px-4 pb-16 sm:px-6">
      <Reveal>
        <div ref={ref} className="relative overflow-hidden rounded-[2.5rem] bg-teal-950 px-6 py-20 text-center text-mint sm:px-12 lg:py-28">
          <motion.div aria-hidden="true" style={reduce ? undefined : { scale: ring }} className="pointer-events-none absolute inset-0">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="absolute left-1/2 top-1/2 rounded-full border border-sky/15" style={{ width: 280 + i * 180, height: 280 + i * 180, transform: 'translate(-50%,-50%)' }} />
            ))}
          </motion.div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal/60 blur-[100px]" />
            <div className="grain absolute inset-0 opacity-50 mix-blend-overlay" />
          </div>
          <div className="relative">
            <h2 className="mx-auto max-w-3xl text-[clamp(2rem,4vw,3.4rem)] leading-[1.12]">
              Siap membaca <em className="text-leaf">kasus pertamamu?</em>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[16px] text-mint/70">Daftar dengan NIM, masukkan kode kelas dari dosenmu, lalu mulai dari modul orientasi.</p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <ButtonLink to="/daftar" variant="light" size="lg">
                Daftar sebagai mahasiswa <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink to="/masuk" size="lg" className="border border-white/15 bg-white/5 text-mint shadow-none hover:bg-white/10">
                Sudah punya akun
              </ButtonLink>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto flex max-w-[1320px] flex-col gap-4 px-4 pb-10 pt-6 text-[13px] text-ink/55 sm:px-6 md:flex-row md:items-center md:justify-between">
      <span className="flex flex-wrap items-center gap-3">
        <Wordmark markClassName="size-7" />
        <span>Tim Rizzz, Sains Data Universitas Airlangga · ICC Campus Data Week 2026</span>
      </span>
      <span>Citra: SOOP (OpenNeuro ds004889, CC0)</span>
    </footer>
  );
}
