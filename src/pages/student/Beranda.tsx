import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarClock, CheckCircle2, ClipboardList, Flame, Gauge, GraduationCap, History, ScanLine, Sparkles, Target } from 'lucide-react';
import { api, fmt, JENJANG, type Me } from '../../api';
import { useAuth } from '../../auth';
import { AppShell } from '@/components/AppShell';
import { Empty, Loading, Page } from '../../components/Shell';
import { buttonClass } from '@/components/ui/button';
import { currentStreak, dailyCounts, todayWib, totalMinutes, type Session } from '@/lib/activity';
import { cn } from '@/lib/utils';
import { AttemptTimeline } from '@/components/AttemptTimeline';
import { BADGE, FILL, TEXT, diceTone, dueStatus, type Tone } from '@/lib/status';
import { LESSONS, lessonById } from '../../content/lessons';
import JoinClass from '../../components/JoinClass';
import { Tour, useTour, type TourStep } from '../../components/Tour';

const ContributionSkyline = lazy(() => import('@/components/ui/contribution-skyline'));
const SKY = { light: ['#ccfbf1', '#5eead4', '#14b8a6', '#0f766e'], dark: ['#134e4a', '#0f766e', '#14b8a6', '#5eead4'] };
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

  // tugas terdekat yang belum tuntas: pengingat di kartu langkah berikutnya
  const urgent = open[0];
  const urgentDue = urgent ? dueStatus(urgent.due_at, false) : null;
  const showGoal = !(isNew && !orientDone);
  const goal = me.mastery[rec.kc] ?? rec.p;
  const meanDice = me.ringkas.mean_dice;

  return (
    <AppShell onHelp={tour.start} wide>
      <Tour steps={BERANDA_TOUR} open={tour.open} onClose={tour.close} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-[clamp(1.8rem,3vw,2.5rem)] leading-[1.12] tracking-[-0.01em]">
            Halo, <em className="text-teal">{first}.</em>
          </h1>
          <p className="mt-1.5 text-[14px] text-ink/55">
            {today} · {JENJANG[me.user.jenjang ?? ''] ?? 'Mahasiswa'} · {me.user.kelas ? `${me.user.kelas.nama} (dosen: ${me.user.kelas.dosen ?? '—'})` : 'belum bergabung ke kelas'} · <span className="font-mono text-[12px]">{me.user.id}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip icon={Flame} tone={streak ? 'warn' : 'none'}>
            {streak ? `${streak} hari berturut-turut` : 'Mulai rentetan hari ini'}
          </Chip>
          <Chip icon={CalendarClock}>{minutes} menit latihan</Chip>
        </div>
      </div>

      {!me.user.kelas && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-info/25 bg-info-soft/60 p-5">
          <div>
            <b className="text-[15px] font-semibold">Gabung ke kelas dosenmu</b>
            <p className="text-[13.5px] text-ink/60">Masukkan kode kelas supaya dosen bisa memantau progres dan memberi tugas.</p>
          </div>
          <div className="legacy">
            <JoinClass onJoined={load} />
          </div>
        </div>
      )}

      <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-8">
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }} data-tour="next" className="relative overflow-hidden rounded-2xl card-surface">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-teal" />
            <div className="grid gap-6 p-6 sm:p-7 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:items-center">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-2.5 py-1 text-[12px] font-medium text-teal-900">
                  <Sparkles className="size-3.5" /> Langkah berikutnya · {next.kicker}
                </span>
                <h2 className="mt-3 font-serif text-[1.6rem] leading-[1.15]">{next.title}</h2>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink/60">{next.body}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link to={next.a[0]} className={buttonClass('primary', 'md', 'rounded-xl shadow-none')}>
                    {next.a[1]} <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" />
                  </Link>
                  <Link to={next.b[0]} className={buttonClass('outline', 'md', 'rounded-xl')}>
                    {next.b[1]}
                  </Link>
                </div>
              </div>
              {showGoal ? (
                <GoalProgress kc={rec.kc} nama={rec.nama} value={goal} due={urgent && urgentDue ? { judul: urgent.judul, tone: urgentDue.tone, label: urgentDue.label } : null} />
              ) : (
                <ul className="space-y-2 rounded-xl bg-surface p-4 text-[13.5px] text-ink/70">
                  {['Kenali DWI, ADC, dan FLAIR', 'Pahami orientasi radiologis (R di kiri layar)', 'Coba alat kuas dan titik di viewer'].map((x) => (
                    <li key={x} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal" /> {x}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.section>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon={ScanLine} tone="info" label="Kasus dikerjakan" value={String(me.ringkas.n_kasus)} />
            <Stat icon={Gauge} tone={diceTone(meanDice)} label="Rerata Dice" value={meanDice === null ? '—' : fmt.num(meanDice)} hint={meanDice === null ? undefined : meanDice >= 0.7 ? 'baik' : meanDice >= 0.4 ? 'cukup' : 'perlu dilatih'} />
            <Stat icon={Target} tone="ok" label="KC dikuasai" value={String(me.ringkas.kc_dikuasai)} of="/4" />
            <Stat icon={GraduationCap} tone="teal" label="Modul selesai" value={String(doneLessons)} of={`/${LESSONS.length}`} />
          </div>
        </div>

        <section data-tour="mastery" className="rounded-2xl card-surface p-6 lg:col-span-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[16px] font-semibold tracking-tight">Penguasaan kompetensi</h2>
            <span className="text-[11.5px] text-ink/45">dikuasai ≥ 95%</span>
          </div>
          <ul className="mt-5 space-y-4">
            {Object.entries(me.kc).map(([k, info], i) => {
              const v = me.mastery[k] ?? 0;
              const tone: Tone = !info.aktif ? 'none' : v >= 0.95 ? 'ok' : k === rec.kc ? 'bad' : 'info';
              return (
                <li key={k} title={`Bukti: ${info.bukti}`}>
                  <div className="flex items-center gap-2.5 text-[13px]">
                    <span className={cn('w-8 rounded-md py-0.5 text-center font-mono text-[10.5px] font-semibold', info.aktif ? BADGE[tone] : 'bg-muted text-ink/35')}>{k}</span>
                    <span className={cn('flex-1 truncate', info.aktif ? 'text-ink/80' : 'text-ink/35')}>{info.nama}</span>
                    {info.aktif ? <b className={cn('font-semibold tabular-nums', TEXT[tone])}>{fmt.pct(v)}</b> : <span className="text-[11px] text-ink/35">belum di MVP</span>}
                  </div>
                  {info.aktif && (
                    <div className="relative mt-1.5 h-2 rounded-full bg-muted">
                      <motion.span initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ duration: 0.9, delay: 0.1 + i * 0.06, ease: EASE }} className={cn('block h-full rounded-full', FILL[tone])} />
                      <span className="absolute -inset-y-0.5 left-[95%] w-0.5 rounded bg-ink/30" title="batas dikuasai 95%" />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-4 text-[11.5px] text-ink/55">
            {(
              [
                ['ok', 'dikuasai'],
                ['info', 'berkembang'],
                ['bad', 'terlemah, prioritas'],
              ] as const
            ).map(([t, l]) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className={cn('size-2 rounded-full', FILL[t])} /> {l}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-ink/50">Prasyarat: K1 → K2 → K3/K6. KC yang prasyaratnya belum dikuasai belum dipilih otomatis.</p>
        </section>

        <section data-tour="calendar" className="overflow-hidden rounded-2xl card-surface p-2 lg:col-span-8">
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

        <section data-tour="tasks" className="flex flex-col rounded-2xl card-surface p-6 lg:col-span-4">
          <div className="flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 text-[16px] font-semibold tracking-tight">
              <ClipboardList className="size-4 text-teal" /> Tugas aktif
              {open.length > 0 && <span className="rounded-full bg-muted px-2 py-px text-[11px] font-medium text-ink/55">{open.length}</span>}
            </h2>
            <Link to="/tugas" className="text-[12.5px] font-medium text-teal hover:underline">
              Semua tugas
            </Link>
          </div>
          <div className="mt-4 flex-1">
            {!me.user.kelas ? (
              <Empty title="Belum ada kelas">Tugas muncul setelah kamu bergabung ke kelas.</Empty>
            ) : open.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
                <CheckCircle2 className="size-9 text-ok" />
                <b className="text-[15px] font-medium">Semua tugas tuntas</b>
                <p className="text-[13px] text-ink/55">Tidak ada yang tertunda. Lanjutkan latihan adaptif.</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {open.slice(0, 4).map((t) => {
                  const d = dueStatus(t.due_at, false);
                  const pct = t.selesai / Math.max(1, t.total);
                  return (
                    <li key={t.id}>
                      <Link to="/tugas" className="group block rounded-xl border border-line p-4 transition-[border-color,box-shadow] hover:border-ink/20 hover:shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <b className="text-[14px] font-medium leading-snug">{t.judul}</b>
                          <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', BADGE[d.tone])}>{d.label}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-2.5">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <span className={cn('block h-full rounded-full', FILL[d.tone])} style={{ width: `${pct * 100}%` }} />
                          </span>
                          <span className="text-[12px] tabular-nums text-ink/55">
                            {t.selesai}/{t.total}
                          </span>
                        </div>
                        {t.due_at && <p className="mt-1.5 text-[11.5px] text-ink/45">tenggat {fmt.dateTime(t.due_at)}</p>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-2xl card-surface p-6 lg:col-span-12">
          <div className="flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 text-[16px] font-semibold tracking-tight">
              <History className="size-4 text-teal" /> Percobaan terakhir
            </h2>
            <Link to="/riwayat" className="text-[12.5px] font-medium text-teal hover:underline">
              Riwayat lengkap
            </Link>
          </div>
          <div className="mt-4">{me.attempts.length === 0 ? <Empty title="Belum ada kasus yang dikirim">Hasil penilaian otomatis akan muncul di sini.</Empty> : <AttemptTimeline rows={me.attempts.slice(0, 6)} compact />}</div>
        </section>
      </div>
    </AppShell>
  );
}

/** Kemajuan KC sasaran menuju batas dikuasai 95% (gaya "goal progress"), plus pengingat tenggat terdekat. */
function GoalProgress({ kc, nama, value, due }: { kc: string; nama: string; value: number; due: { judul: string; tone: Tone; label: string } | null }) {
  const tone: Tone = value >= 0.95 ? 'ok' : value >= 0.6 ? 'info' : value >= 0.3 ? 'warn' : 'bad';
  const gap = Math.max(0, Math.round((0.95 - value) * 100));
  return (
    <div className="rounded-xl bg-surface p-5">
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="truncate text-ink/60">
          <b className="font-semibold text-ink">{kc}</b> · {nama}
        </span>
        <span className="shrink-0 tabular-nums">
          <b className={cn('text-[18px] font-semibold', TEXT[tone])}>{fmt.pct(value)}</b>
          <span className="text-ink/40"> / 95%</span>
        </span>
      </div>
      <div className="relative mt-3 h-2.5 rounded-full bg-ink/8">
        <motion.span initial={{ width: 0 }} animate={{ width: `${value * 100}%` }} transition={{ duration: 1, ease: EASE }} className={cn('absolute inset-y-0 left-0 rounded-full', FILL[tone])} />
        {/* sisa jarak ke target diarsir */}
        <span className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,rgb(15_23_42/.14)_0_3px,transparent_3px_7px)]" style={{ left: `${value * 100}%`, width: `${Math.max(0, 95 - value * 100)}%` }} />
        <span className="absolute -inset-y-1 left-[95%] w-0.5 rounded bg-ink/40" title="batas dikuasai 95%" />
        <motion.span initial={{ left: '0%' }} animate={{ left: `${value * 100}%` }} transition={{ duration: 1, ease: EASE }} className={cn('absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow', FILL[tone])} />
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-ink/60">
        {gap === 0 ? (
          <>
            <b className={TEXT.ok}>Sudah dikuasai.</b> Pertahankan dengan kasus yang lebih sulit.
          </>
        ) : (
          <>
            Kurang <b className={TEXT[tone]}>{gap} poin</b> lagi menuju batas dikuasai.
          </>
        )}
      </p>
      {due && (
        <Link to="/tugas" className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] transition-colors hover:border-ink/20">
          <span className={cn('size-2 shrink-0 rounded-full', FILL[due.tone])} />
          <span className="min-w-0 flex-1 truncate text-ink/70">{due.judul}</span>
          <b className={cn('shrink-0 font-semibold', TEXT[due.tone])}>{due.label}</b>
        </Link>
      )}
    </div>
  );
}

const STAT_TONE: Record<string, string> = { ...BADGE, teal: 'bg-mint text-teal' };

function Stat({ icon: Icon, tone, label, value, of, hint }: { icon: typeof Flame; tone: Tone | 'teal'; label: string; value: string; of?: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl card-surface p-4">
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', STAT_TONE[tone])}>
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0">
        <b className="block text-[1.4rem] font-semibold leading-none tabular-nums">
          {value}
          {of && <span className="text-[0.95rem] font-normal text-ink/35">{of}</span>}
        </b>
        <p className="mt-1 truncate text-[12px] text-ink/55">
          {label}
          {hint && <span className={cn('ml-1 font-medium', tone !== 'teal' && TEXT[tone])}>· {hint}</span>}
        </p>
      </div>
    </div>
  );
}

function Chip({ icon: Icon, children, tone = 'none' }: { icon: typeof Flame; children: React.ReactNode; tone?: Tone }) {
  return (
    <span className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium', tone === 'none' ? 'border border-line bg-white text-ink/65' : BADGE[tone])}>
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
