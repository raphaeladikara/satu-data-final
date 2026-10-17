import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { ArrowRight, ClipboardCheck, Database, Download, EyeOff, FileSearch, GraduationCap, Menu, ShieldCheck, Stethoscope, Users, X } from 'lucide-react';
import { api } from '../api';
import { homeFor, useAuth } from '../auth';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Hero from './landing/Hero';
import CycleShowcase from './landing/CycleShowcase';
import Features from './landing/Features';
import { CountUp, Eyebrow, Highlight, Reveal, Strike } from './landing/bits';

const ContributionSkyline = lazy(() => import('@/components/ui/contribution-skyline'));

const NAV = [
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
      <Backdrop />
      <Nav />
      <main>
        <Hero cases={stats?.cases ?? 36} />
        <Marquee />
        <Problem />

        <section id="cara-kerja" className="mx-auto max-w-[1320px] scroll-mt-24 px-4 py-24 sm:px-6 lg:py-32">
          <SectionHead eyebrow="Cara kerja" title={<>Satu siklus latihan terarah, <em className="text-teal">berulang sampai kompeten.</em></>} lead="Lima langkah ini terjadi setiap kali kamu mengerjakan satu kasus. Pilih langkahnya untuk melihat tampilannya di aplikasi." />
          <Reveal className="mt-14">
            <CycleShowcase />
          </Reveal>
        </section>

        <section id="fitur" className="mx-auto max-w-[1320px] scroll-mt-24 px-4 pb-24 sm:px-6 lg:pb-32">
          <SectionHead eyebrow="Untuk mahasiswa" title={<>Semua yang kamu butuhkan untuk <Highlight color="var(--color-sky)">berlatih mandiri</Highlight></>} />
          <div className="mt-14">
            <Features />
          </div>
          <Reveal className="mt-4">
            <div className="flex flex-col gap-5 rounded-[1.75rem] border border-ink/8 bg-paper p-6 lg:flex-row lg:items-center">
              <div className="lg:w-64">
                <h3 className="text-[19px] font-medium tracking-tight">Enam knowledge component</h3>
                <p className="mt-1 text-[13.5px] text-ink/55">Kompetensi yang dilacak di peta penguasaanmu.</p>
              </div>
              <ul className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {KCS.map(([k, n, on]) => (
                  <li key={k} className={cn('flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-[13.5px]', on ? 'border-teal/15 bg-mint/60' : 'border-dashed border-ink/15 text-ink/50')}>
                    <span className={cn('rounded-lg px-2 py-1 font-mono text-[11px] font-semibold', on ? 'bg-teal text-mint' : 'bg-ink/8 text-ink/50')}>{k}</span>
                    <span className="flex-1">{n}</span>
                    {!on && <em className="text-[11px] not-italic">tahap pilot</em>}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
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

/** Latar kertas dengan cahaya lembut di sudut, mengikuti palet gambar 1 dan 2. */
function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[1100px] overflow-hidden [mask-image:linear-gradient(black_70%,transparent)]">
      <div className="absolute -left-40 -top-40 size-[640px] rounded-full bg-leaf/35 blur-[120px]" />
      <div className="absolute -right-20 top-10 size-[560px] rounded-full bg-sky/35 blur-[120px]" />
      <div className="absolute left-1/3 top-[520px] size-[420px] rounded-full bg-terra-soft/40 blur-[120px]" />
      <div className="grain absolute inset-0 opacity-70" />
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
      <div className={cn('mx-auto flex h-14 max-w-[1320px] items-center justify-between rounded-full pl-4 pr-2 transition-all duration-500', solid || open ? 'border border-ink/8 bg-paper/80 shadow-[0_10px_30px_-18px_rgba(16,49,58,.35)] backdrop-blur-xl' : 'border border-transparent')}>
        <a href="#top" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-ink">
          <BrandMark />
          SINAPS
        </a>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi halaman">
          {NAV.map(([h, l]) => (
            <a key={h} href={h} className="rounded-full px-3.5 py-2 text-[14px] text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink">
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
          <button className="grid size-9 place-items-center rounded-full text-ink md:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <motion.nav initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-2 flex max-w-[1320px] flex-col rounded-3xl border border-ink/8 bg-paper/95 p-2 shadow-xl backdrop-blur-xl md:hidden">
          {NAV.map(([h, l]) => (
            <a key={h} href={h} onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 text-[15px] text-ink/80 hover:bg-ink/5">
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

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden="true">
      <defs>
        <linearGradient id="bm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#195764" />
          <stop offset="1" stopColor="#80a874" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill="url(#bm)" />
      <path d="M9 19c2.5-6 4.5-6 6-1.5S19 23 23 13" fill="none" stroke="#eaf3de" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="23" cy="13" r="2.4" fill="#ad7556" stroke="#eaf3de" strokeWidth="1.4" />
    </svg>
  );
}

function SectionHead({ eyebrow, title, lead, tone = 'teal', className }: { eyebrow: string; title: React.ReactNode; lead?: string; tone?: 'teal' | 'light'; className?: string }) {
  return (
    <Reveal className={cn('max-w-3xl', className)}>
      <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
      <h2 className={cn('mt-4 font-serif text-[clamp(2.3rem,4.6vw,3.9rem)] leading-[1.02] tracking-[-0.015em]', tone === 'light' ? 'text-mint' : 'text-ink')}>{title}</h2>
      {lead && <p className={cn('mt-5 max-w-2xl text-[16.5px] leading-relaxed', tone === 'light' ? 'text-mint/70' : 'text-ink/60')}>{lead}</p>}
    </Reveal>
  );
}

function Marquee() {
  const items = ['Cornerstone3D', 'SOOP · OpenNeuro ds004889', 'U-Net 2.5D', 'Bayesian Knowledge Tracing', 'Pemeriksa fakta tutor', 'UU PDP No. 27/2022', 'Mask buatan ahli', 'Dice · HD95 · recall per lesi'];
  return (
    <div className="relative border-y border-ink/8 bg-paper/60 py-5 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
      <div className="flex w-max animate-marquee gap-12 whitespace-nowrap">
        {[...items, ...items].map((t, i) => (
          <span key={i} className="flex items-center gap-12 font-serif text-2xl italic text-ink/55">
            {t}
            <span className="size-1.5 rounded-full bg-sage" />
          </span>
        ))}
      </div>
    </div>
  );
}

function Problem() {
  const S = [
    { n: 0.8, dec: 1, suf: '', t: 'radiolog per 100.000 penduduk Indonesia, sekaligus menjadi pengajar radiologi.', bg: 'bg-leaf', fg: 'text-teal-900' },
    { n: 26.9, dec: 1, suf: '%', t: 'mahasiswa klinik dan dokter internsip yang yakin mampu membaca CT atau MRI kepala (survei 431 responden, 2026).', bg: 'bg-sky', fg: 'text-teal-900' },
    { n: 74.4, dec: 1, suf: '%', t: 'tingkat halusinasi model visi-bahasa umum saat membaca gambar klinis. Chatbot biasa belum layak menjadi pengajar.', bg: 'bg-terra', fg: 'text-white' },
  ];
  return (
    <section className="mx-auto max-w-[1320px] px-4 pt-24 sm:px-6 lg:pt-32">
      <Reveal>
        <h2 className="mx-auto max-w-5xl text-center font-serif text-[clamp(2.3rem,5vw,4.4rem)] leading-[1.05] tracking-[-0.015em]">
          Mahasiswa tidak butuh <Strike>chatbot</Strike> lagi. Mereka butuh <Highlight delay={0.5}>tutor yang bisa diperiksa.</Highlight>
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-center text-[16.5px] leading-relaxed text-ink/60">
          Kemampuan membaca MRI stroke dilatih dengan banyak kasus dan umpan balik yang cepat. Dua hal itu yang paling langka di pendidikan kedokteran kita.
        </p>
      </Reveal>
      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {S.map((s, i) => (
          <Reveal key={i} delay={i * 0.08}>
            <div className={cn('group flex h-full min-h-[15rem] flex-col justify-between rounded-[1.75rem] p-7 transition-transform duration-500 hover:-translate-y-1', s.bg, s.fg)}>
              <CountUp to={s.n} decimals={s.dec} suffix={s.suf} className="font-serif text-[4.6rem] leading-none tracking-tight" />
              <p className="mt-6 text-[14.5px] leading-relaxed opacity-85">{s.t}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const SKYLINE_PALETTE = { light: ['#d6e9cd', '#aad39c', '#80a874', '#195764'], dark: ['#1e4d3b', '#3f7d57', '#80a874', '#aad39c'] };

function Dosen() {
  const checks = [
    [Users, 'Peta penguasaan KC per mahasiswa dan rerata kelas'],
    [FileSearch, 'Jenis kesalahan delineasi tersering di kelas'],
    [Stethoscope, 'Penanda mahasiswa yang perlu perhatian'],
    [ClipboardCheck, 'Tugas berisi kasus dan modul, dengan tenggat dan progres'],
    [GraduationCap, 'Tinjau ulang anotasi mahasiswa di atas citra'],
    [ShieldCheck, 'Verifikasi kasus dan audit log tutor beserta hasil pemeriksa fakta'],
    [Download, 'Ekspor CSV untuk penilaian dan penelitian'],
  ] as const;
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
            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {checks.map(([Icon, t], i) => (
                <Reveal key={t} delay={i * 0.04}>
                  <li className="flex items-center gap-3 text-[14px] leading-snug text-mint/85">
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/8 text-leaf">
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
        <Reveal delay={0.1} className="mt-14">
          <div className="relative rounded-[2rem] bg-white/6 p-2 ring-1 ring-white/10 backdrop-blur">
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
                      <b className="font-semibold">Aktivitas latihan kelas</b> <span className="text-ink/50">· pratinjau dasbor, data contoh</span>
                    </span>
                  }
                />
              </Suspense>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Proof() {
  const P = [
    { n: 94.6, dec: 1, suf: '%', t: 'akurasi aturan jenis kesalahan (672 anotasi sintetis, 36 subjek), dibanding 47,3% bila hanya memakai Dice.' },
    { n: 0.74, dec: 2, suf: '', t: 'rerata Dice U-Net 2.5D sebagai pembaca kedua pada 36 kasus bank yang tidak pernah dipakai melatih model.' },
    { n: 1451, dec: 0, suf: '', t: 'lesion mask akut yang dipakai untuk menyusun indeks kesulitan kasus.' },
  ];
  return (
    <section className="mx-auto max-w-[1320px] px-4 py-24 sm:px-6 lg:py-32">
      <div className="overflow-hidden rounded-[2.25rem] bg-[linear-gradient(115deg,#195764_0%,#2d746f_40%,#80a874_78%,#aad39c_100%)] p-8 text-mint sm:p-12 lg:p-16">
        <Eyebrow tone="light">Uji kelayakan pada data nyata</Eyebrow>
        <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-6">
          {P.map((p, i) => (
            <Reveal key={i} delay={i * 0.08} className="md:border-l md:border-white/20 md:pl-6 md:first:border-0 md:first:pl-0">
              <CountUp to={p.n} decimals={p.dec} suffix={p.suf} className="font-serif text-[clamp(3.6rem,6vw,5.4rem)] leading-none" />
              <p className="mt-4 max-w-xs text-[14.5px] leading-relaxed text-mint/80">{p.t}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Privacy() {
  const P = [
    [Database, 'Data citra terbuka', 'Kasus berasal dari Stroke Outcome Optimization Project (SOOP), OpenNeuro ds004889, berlisensi CC0, dan sudah dianonimkan.'],
    [EyeOff, 'Log berpseudonim', 'NIM tidak pernah disimpan, hanya pseudonim hasil hash. Log belajar dipakai untuk personalisasi dan evaluasi, sesuai UU PDP No. 27/2022.'],
    [ShieldCheck, 'Alat bantu belajar', 'SINAPS tidak ditujukan untuk mendiagnosis pasien. Kunci jawaban selalu mask buatan ahli, bukan prediksi model.'],
  ] as const;
  return (
    <section id="privasi" className="mx-auto max-w-[1320px] scroll-mt-24 px-4 pb-24 sm:px-6 lg:pb-32">
      <SectionHead eyebrow="Data & privasi" title={<>Dibangun hati-hati, <em className="text-teal">sejak dari datanya.</em></>} />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {P.map(([Icon, t, d], i) => (
          <Reveal key={t} delay={i * 0.06}>
            <div className="h-full rounded-[1.75rem] border border-ink/8 bg-paper p-7">
              <span className="grid size-11 place-items-center rounded-2xl bg-mint text-teal">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 text-[19px] font-medium tracking-tight">{t}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink/60">{d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-[1320px] px-4 pb-16 sm:px-6">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2.5rem] bg-teal-950 px-6 py-20 text-center text-mint sm:px-12 lg:py-28">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="absolute left-1/2 top-1/2 rounded-full border border-sky/15" style={{ width: 280 + i * 180, height: 280 + i * 180, transform: 'translate(-50%,-50%)' }} />
            ))}
            <div className="absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal/60 blur-[100px]" />
            <div className="grain absolute inset-0 opacity-50 mix-blend-overlay" />
          </div>
          <div className="relative">
            <h2 className="mx-auto max-w-3xl font-serif text-[clamp(2.4rem,5vw,4.4rem)] leading-[1.02]">
              Siap membaca <em className="text-leaf">kasus pertamamu?</em>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[16.5px] text-mint/70">Daftar dengan NIM, masukkan kode kelas dari dosenmu, lalu mulai dari modul orientasi.</p>
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
      <span className="flex items-center gap-2.5">
        <BrandMark className="size-6" />
        SINAPS · Tim Rizzz, Sains Data Universitas Airlangga · ICC Campus Data Week 2026
      </span>
      <span>Citra: SOOP (OpenNeuro ds004889, CC0)</span>
    </footer>
  );
}
