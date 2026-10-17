import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, BookOpen, CalendarClock, CheckCircle2, ClipboardList, Flame, Gauge, GraduationCap, ScanLine, Sparkles, Target } from 'lucide-react';
import { api, fmt, JENJANG, type Me } from '../../api';
import { useAuth } from '../../auth';
import { AppShell } from '@/components/AppShell';
import { Empty, Loading, Page } from '../../components/Shell';
import { buttonClass } from '@/components/ui/button';
import { currentStreak, dailyCounts, todayWib, totalMinutes, type Session } from '@/lib/activity';
import { cn } from '@/lib/utils';
import { StatTile } from '@/components/ui/bento';
import { LESSONS, lessonById } from '../../content/lessons';
import JoinClass from '../../components/JoinClass';
import { Tour, useTour, type TourStep } from '../../components/Tour';

const ContributionSkyline = lazy(() => import('@/components/ui/contribution-skyline'));
const SKY = { light: ['#d6e9cd', '#aad39c', '#80a874', '#195764'], dark: ['#1e4d3b', '#3f7d57', '#80a874', '#aad39c'] };
const EASE = [0.22, 1, 0.36, 1] as const;

const BERANDA_TOUR: TourStep[] = [
  { title: 'Selamat datang di SINAPS', body: 'Beranda merangkum apa yang perlu kamu kerjakan berikutnya. Panduan ini hanya enam langkah.' },
  { target: 'next', title: 'Langkah berikutnya', body: 'Sistem menyarankan modul atau latihan untuk kompetensi terlemahmu. Mulai dari sini setiap kali membuka SINAPS.' },
  { target: 'mastery', title: 'Peta penguasaan', body: 'Peluang kamu sudah menguasai tiap KC, diperbarui setiap kasus yang kamu kirim. 95% berarti dikuasai.' },
  { target: 'calendar', title: 'Kalender latihan', body: 'Satu kotak per hari. Makin tinggi dan gelap, makin banyak kasus yang kamu kerjakan. Seret untuk memutar tampilan 3D.' },
  { target: 'tasks', title: 'Tugas dari dosen', body: 'Tugas berisi modul dan kasus dengan tenggat. Yang mendekati tenggat muncul paling atas.' },
  { target: 'nav', title: 'Menu utama', body: 'Belajar untuk modul, Latihan untuk kasus adaptif, Bank kasus untuk memilih sendiri, Riwayat untuk meninjau ulang.', padding: 6 },
  { target: 'help', title: 'Selesai', body: 'Tombol Panduan ada di setiap halaman utama. Selamat belajar!' },
];

export default function Beranda() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState('');
  const load = () => api.me().then(setMe).catch((e) => setErr(e.message));
  const tour = useTour('beranda', { when: !!me });
  useEffect(() => {
    load();
  }, []);
  const sessions = useMemo<Session[]>(() => (me?.attempts ?? []).map((a) => [a.started_at || a.submitted_at, a.submitted_at]), [me]);
  const days = useMemo(() => dailyCounts(sessions), [sessions]);

  if (err) return <Page title="Beranda"><p className="error">{err}</p></Page>;
  if (!me) return <Page title="Beranda"><Loading /></Page>;

  const first = user?.nama.split(' ')[0] ?? '';
  const isNew = params.get('baru') === '1' || me.ringkas.n_kasus === 0;
  const orientDone = me.lessons.orientasi?.completed;
  const rec = me.rekomendasi;
  const recLesson = rec.lesson ? lessonById(rec.lesson) : null;
  const recLessonDone = rec.lesson ? me.lessons[rec.lesson]?.completed : true;
  const open = me.assignments.filter((t) => !t.tuntas).sort((a, b) => (a.due_at ?? 9e12) - (b.due_at ?? 9e12));
  const doneLessons = LESSONS.filter((l) => me.lessons[l.id]?.completed).length;
  const streak = currentStreak(sessions);
  const minutes = Math.round(totalMinutes(sessions));
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  const next =
    isNew && !orientDone
      ? { kicker: 'Mulai di sini', title: 'Modul orientasi', body: 'Enam menit untuk mengenal tiga sekuens MRI, konvensi orientasi radiologis, dan cara memakai viewer.', a: ['/belajar/orientasi', 'Buka modul orientasi'], b: ['/latihan', 'Langsung latihan'] }
      : recLesson && !recLessonDone
        ? { kicker: `KC terlemah · ${fmt.pct(rec.p)}`, title: `Pelajari ${rec.kc} · ${rec.nama}`, body: 'Baca modulnya dulu, lalu latih dengan kasus yang dipilih sesuai penguasaanmu.', a: [`/belajar/${recLesson.id}`, `Buka modul ${rec.kc}`], b: ['/latihan', 'Latihan adaptif'] }
        : { kicker: `Sasaran · ${rec.kc} ${fmt.pct(rec.p)}`, title: 'Lanjutkan latihan adaptif', body: `Sistem akan memilih kasus untuk ${rec.kc} ${rec.nama} dengan tingkat kesulitan yang pas.`, a: ['/latihan', 'Kerjakan kasus berikutnya'], b: [`/latihan?kc=${rec.kc}`, `Latih ${rec.kc} saja`] };

  return (
    <AppShell onHelp={tour.start} wide>
      <Tour steps={BERANDA_TOUR} open={tour.open} onClose={tour.close} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[clamp(1.87rem,3.43vw,2.96rem)] leading-[1.12] tracking-[-0.01em]">
            Halo, <em className="text-teal">{first}.</em>
          </h1>
          <p className="mt-2 text-[14.5px] text-ink/60">
            {today} · {JENJANG[me.user.jenjang ?? ''] ?? 'Mahasiswa'} · {me.user.kelas ? `${me.user.kelas.nama} (dosen: ${me.user.kelas.dosen ?? '—'})` : 'belum bergabung ke kelas'} · <span className="font-mono text-[12.5px]">{me.user.id}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Chip icon={Flame} tone={streak ? 'terra' : 'muted'}>
            {streak ? `${streak} hari berturut-turut` : 'Mulai rentetan hari ini'}
          </Chip>
          <Chip icon={CalendarClock}>{minutes} menit latihan</Chip>
        </div>
      </div>

      {!me.user.kelas && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[1.6rem] border border-leaf bg-mint p-5">
          <div>
            <b className="text-[15px] font-semibold">Gabung ke kelas dosenmu</b>
            <p className="text-[13.5px] text-ink/60">Masukkan kode kelas supaya dosen bisa memantau progres dan memberi tugas.</p>
          </div>
          <div className="legacy">
            <JoinClass onJoined={load} />
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} data-tour="next" className="relative overflow-hidden rounded-[2rem] bg-teal-900 p-7 text-mint lg:col-span-5">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-teal-600/60 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 right-10 size-56 rounded-full border border-sky/15" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 right-0 size-80 rounded-full border border-sky/10" />
          <div className="relative flex h-full flex-col">
            <span className="flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px]">
              <Sparkles className="size-3.5 text-leaf" /> Langkah berikutnya · {next.kicker}
            </span>
            <h2 className="mt-5 font-serif text-[1.87rem] leading-[1.12]">{next.title}</h2>
            <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-mint/75">{next.body}</p>
            <div className="mt-auto flex flex-wrap gap-2 pt-7">
              <Link to={next.a[0]} className={buttonClass('light', 'lg')}>
                {next.a[1]} <ArrowRight className="size-4" />
              </Link>
              <Link to={next.b[0]} className={buttonClass('primary', 'lg', 'border border-white/15 bg-white/5 shadow-none hover:bg-white/10')}>
                {next.b[1]}
              </Link>
            </div>
          </div>
        </motion.section>

        <div className="grid grid-cols-2 gap-4 lg:col-span-3">
          <StatTile layout="stack" icon={ScanLine} accent="leaf" label="kasus dikerjakan" value={String(me.ringkas.n_kasus)} />
          <StatTile layout="stack" icon={Gauge} accent="sky" label="rerata Dice" value={me.ringkas.mean_dice === null ? '—' : fmt.num(me.ringkas.mean_dice)} />
          <StatTile layout="stack" icon={Target} accent="terra" label="KC dikuasai" value={String(me.ringkas.kc_dikuasai)} of="/4" />
          <StatTile layout="stack" icon={GraduationCap} accent="sand" label="modul selesai" value={String(doneLessons)} of={`/${LESSONS.length}`} />
        </div>

        <section data-tour="mastery" className="rounded-[2rem] card-surface p-6 lg:col-span-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-semibold tracking-tight">Penguasaan kompetensi</h2>
            <span className="text-[11.5px] text-ink/45">BKT · dikuasai ≥ 95%</span>
          </div>
          <ul className="mt-5 space-y-4">
            {Object.entries(me.kc).map(([k, info], i) => {
              const v = me.mastery[k] ?? 0;
              return (
                <li key={k} title={`Bukti: ${info.bukti}`}>
                  <div className="flex items-center gap-2.5 text-[13px]">
                    <span className={cn('w-8 rounded-md py-0.5 text-center font-mono text-[10.5px] font-semibold', !info.aktif ? 'bg-ink/6 text-ink/40' : v >= 0.95 ? 'bg-sage text-white' : k === rec.kc ? 'bg-terra text-white' : 'bg-teal/10 text-teal')}>{k}</span>
                    <span className={cn('flex-1 truncate', info.aktif ? 'text-ink/80' : 'text-ink/40')}>{info.nama}</span>
                    <b className="font-medium tabular-nums">{info.aktif ? fmt.pct(v) : <span className="text-[11px] font-normal text-ink/40">belum di MVP</span>}</b>
                  </div>
                  {info.aktif && (
                    <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-ink/6">
                      <span className="absolute inset-y-0 left-[95%] w-px bg-sage" />
                      <motion.span initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ duration: 1, delay: 0.1 + i * 0.07, ease: EASE }} className={cn('block h-full rounded-full', v >= 0.95 ? 'bg-sage' : k === rec.kc ? 'bg-terra' : 'bg-gradient-to-r from-teal to-teal-600')} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-5 text-[12px] leading-relaxed text-ink/50">Prasyarat: K1 → K2 → K3/K6. KC yang prasyaratnya belum dikuasai belum dipilih otomatis.</p>
        </section>

        <section data-tour="calendar" className="overflow-hidden rounded-[2rem] card-surface p-2 lg:col-span-8">
          <Suspense fallback={<div className="h-[360px]" />}>
            <ContributionSkyline
              className="!border-0 !bg-transparent"
              data={days}
              defaultView={sessions.length >= 40 ? '3d' : '2d'}
              endDate={todayWib()}
              palette={SKY}
              locale="id-ID"
              unit="kasus"
              unitPlural="kasus"
              weekStart={1}
              title={
                <span>
                  <b className="font-semibold">Kalender latihanmu</b> <span className="text-ink/50">· setahun terakhir</span>
                </span>
              }
            />
          </Suspense>
        </section>

        <section data-tour="tasks" className="flex flex-col rounded-[2rem] card-surface p-6 lg:col-span-4">
          <div className="flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
              <ClipboardList className="size-4 text-teal" /> Tugas aktif
            </h2>
            <Link to="/tugas" className="text-[12.5px] text-teal hover:underline">
              Semua tugas
            </Link>
          </div>
          <div className="mt-4 flex-1">
            {!me.user.kelas ? (
              <Empty title="Belum ada kelas">Tugas muncul setelah kamu bergabung ke kelas.</Empty>
            ) : open.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
                <CheckCircle2 className="size-9 text-sage" />
                <b className="text-[15px] font-medium">Semua tugas tuntas</b>
                <p className="text-[13px] text-ink/55">Tidak ada yang tertunda. Lanjutkan latihan adaptif.</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {open.slice(0, 4).map((t) => {
                  const late = t.due_at && t.due_at < Date.now() / 1000;
                  const pct = t.selesai / Math.max(1, t.total);
                  return (
                    <li key={t.id}>
                      <Link to="/tugas" className="block rounded-2xl border border-ink/8 bg-muslin/60 p-4 transition-colors hover:border-ink/20">
                        <div className="flex items-start justify-between gap-2">
                          <b className="text-[14px] font-medium leading-snug">{t.judul}</b>
                          <ArrowUpRight className="size-4 shrink-0 text-ink/35" />
                        </div>
                        <p className={cn('mt-1 text-[12px]', late ? 'font-medium text-terra' : 'text-ink/55')}>
                          {t.selesai}/{t.total} selesai{t.due_at ? ` · tenggat ${fmt.dateTime(t.due_at)}` : ''}
                          {late ? ' · lewat tenggat' : ''}
                        </p>
                        <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-ink/8">
                          <span className={cn('block h-full rounded-full', late ? 'bg-terra' : 'bg-teal')} style={{ width: `${pct * 100}%` }} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-[2rem] card-surface p-6 lg:col-span-12">
          <div className="flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
              <BookOpen className="size-4 text-teal" /> Percobaan terakhir
            </h2>
            <Link to="/riwayat" className="text-[12.5px] text-teal hover:underline">
              Riwayat lengkap
            </Link>
          </div>
          <div className="mt-4">
            {me.attempts.length === 0 ? (
              <Empty title="Belum ada kasus yang dikirim">Hasil penilaian otomatis akan muncul di sini.</Empty>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {me.attempts.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <Link to={`/riwayat/${r.id}`} className="group flex h-full flex-col rounded-2xl border border-ink/8 bg-muslin/50 p-4 transition-all hover:-translate-y-0.5 hover:border-ink/20 hover:bg-paper">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[12px] text-ink/60">{r.case_id}</span>
                        <span className={cn('rounded-full px-2 py-0.5 text-[10.5px] font-medium', r.tier === 'mudah' ? 'bg-leaf/40 text-teal-900' : r.tier === 'sedang' ? 'bg-[#f6ead0] text-[#8a5d10]' : 'bg-terra-soft text-[#8f4a2c]')}>{r.tier}</span>
                      </div>
                      <div className="mt-3 flex items-end gap-2">
                        <b className="font-serif text-[1.72rem] leading-none text-teal">{r.dice === null ? '—' : fmt.num(r.dice)}</b>
                        <span className="pb-1 text-[11px] text-ink/45">Dice</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {Object.entries(r.kc).map(([k, ok]) => (
                          <span key={k} className={cn('rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold', ok ? 'bg-leaf/45 text-teal-900' : 'bg-terra-soft text-[#8f4a2c]')}>
                            {k}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 line-clamp-2 text-[12px] text-ink/55">{r.jenis ?? 'Tanpa delineasi'}</p>
                      <p className="mt-auto pt-3 text-[11px] text-ink/40">{fmt.dateTime(r.submitted_at)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Chip({ icon: Icon, children, tone = 'muted' }: { icon: typeof Flame; children: React.ReactNode; tone?: 'terra' | 'muted' }) {
  return (
    <span className={cn('flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium', tone === 'terra' ? 'border-terra/30 bg-terra-soft/60 text-[#8f4a2c]' : 'border-ink/10 bg-paper text-ink/65')}>
      <Icon className="size-4" />
      {children}
    </span>
  );
}


export function AttemptTable({ rows, base = '/riwayat' }: { rows: Me['attempts']; base?: string }) {
  return (
    <div className="table-wrap">
      <table className="list">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Kasus</th>
            <th>Sasaran</th>
            <th>Tingkat</th>
            <th>KC</th>
            <th>Dice</th>
            <th>Jenis kesalahan</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="nowrap">{fmt.dateTime(r.submitted_at)}</td>
              <td className="mono">{r.case_id}</td>
              <td>{r.target_kc === 'bebas' ? 'pilihan sendiri' : r.target_kc}</td>
              <td>
                <span className={`tier tier-${r.tier}`}>{r.tier}</span>
              </td>
              <td className="nowrap">
                {Object.entries(r.kc).map(([k, ok]) => (
                  <span key={k} className={`pill ${ok ? 'ok' : 'bad'}`}>
                    {k}
                  </span>
                ))}
              </td>
              <td>{r.dice === null ? '—' : fmt.num(r.dice)}</td>
              <td>{r.jenis ?? '—'}</td>
              <td>
                <Link to={`${base}/${r.id}`} className="small">
                  Tinjau
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
