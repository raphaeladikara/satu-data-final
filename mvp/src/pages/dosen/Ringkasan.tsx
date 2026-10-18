import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  Gauge,
  GraduationCap,
  History,
  KeyRound,
  MessagesSquare,
  PieChart,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  Target,
  TrendingUp,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { AttemptTimeline } from '@/components/AttemptTimeline';
import { TaskChecklist } from '@/components/TaskChecklist';
import { Tour, useTour, type TourStep } from '@/components/Tour';
import { buttonClass } from '@/components/ui/button';
import { CirculariumRing } from '@/components/ui/circularium-ring';
import { dailyCounts, HARI, todayWib, weekHourGrid, type Session } from '@/lib/activity';
import { BADGE, FILL, TEXT, diceTone, type Tone } from '@/lib/status';
import { cn } from '@/lib/utils';
import { api, fmt, JENJANG, type Overview, type StudentDetail, type StudentRow } from '../../api';
import { heat, Trajectory } from '../../components/Charts';
import { Empty, Loading, Page } from '../../components/Shell';
import { LESSONS } from '../../content/lessons';
import { Avatar, CardTitle, downloadCsv, KelasSelect, PillButton, PillSelect, SearchBox, Seg, SortTh, Stat, StatusPill, studentStatus, TutorThread } from './ui';

export { KelasSelect } from './ui';

const ContributionSkyline = lazy(() => import('@/components/ui/contribution-skyline'));

export const ACTIVE = ['K1', 'K2', 'K3', 'K6'];

/** Kelas yang sedang disaring, diingat per peramban. */
export function useKelasFilter() {
  const [kelas, setKelasState] = useState<number | null>(() => {
    try {
      const v = localStorage.getItem('sinaps-dosen-kelas');
      return v ? Number(v) : null;
    } catch {
      return null;
    }
  });
  const setKelas = (k: number | null) => {
    setKelasState(k);
    try {
      if (k) localStorage.setItem('sinaps-dosen-kelas', String(k));
      else localStorage.removeItem('sinaps-dosen-kelas');
    } catch {
      /* diblokir */
    }
  };
  return [kelas, setKelas] as const;
}

function useOverview() {
  const [kelas, setKelas] = useKelasFilter();
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState('');
  const load = () =>
    api
      .overview(kelas)
      .then((d) => {
        // kelas tersimpan sudah dihapus
        if (kelas && !d.kelas.some((k) => k.id === kelas)) setKelas(null);
        setData(d);
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kelas]);
  return { data, err, kelas, setKelas, load };
}

/** Tone penguasaan KC rata-rata kelas: hijau dikuasai, merah terlemah, biru berkembang. */
const kcTone = (v: number, weakest: boolean): Tone => (v >= 0.95 ? 'ok' : weakest ? 'bad' : 'info');

// --- ringkasan -----------------------------------------------------------------

export default function Ringkasan() {
  const { data, err, kelas, setKelas, load } = useOverview();
  const [exporting, setExporting] = useState('');
  const [kc, setKc] = useState('');
  const [showAll, setShowAll] = useState(false);
  const tour = useTour('dosen', { when: !!data && data.kelas.length > 0 });
  const sessions = useMemo<Session[]>(() => (data ? data.sessions ?? data.recent.map((r) => [r.started_at || r.submitted_at, r.submitted_at] as Session) : []), [data]);
  const ring = useMemo(() => weekHourGrid(sessions), [sessions]);
  const days = useMemo(() => dailyCounts(sessions), [sessions]);

  if (err) return <Page title="Ringkasan kelas"><p className="error">{err}</p></Page>;
  if (!data) return <Page title="Ringkasan kelas"><Loading /></Page>;
  if (data.kelas.length === 0)
    return (
      <AppShell>
        <div className="mx-auto mt-10 max-w-xl rounded-[2rem] card-surface p-8 text-center sm:p-10">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-mint text-teal">
            <GraduationCap className="size-7" />
          </span>
          <h1 className="mt-5 font-serif text-[2rem] leading-tight">
            Selamat datang. <em className="text-teal">Buat kelas pertamamu.</em>
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink/60">Mahasiswa memasukkan kode kelas saat mendaftar atau di halaman Profil. Setelah itu progres mereka muncul di sini.</p>
          <Link to="/dosen/kelas" className={buttonClass('primary', 'lg', 'mt-6')}>
            Buat kelas <ArrowRight className="size-4" />
          </Link>
        </div>
      </AppShell>
    );

  const attention = data.students.filter((s) => s.flags.length);
  const errs = Object.entries(data.error_counts).sort((a, b) => b[1] - a[1]);
  const kelasName = kelas ? data.kelas.find((k) => k.id === kelas)?.nama : `${data.kelas.length} kelas`;
  const weakest = ACTIVE.reduce((a, k) => ((data.kc_avg[k]?.mean ?? 1) < (data.kc_avg[a]?.mean ?? 1) ? k : a), ACTIVE[0]);
  const recentAll = [...data.recent].sort((a, b) => b.submitted_at - a.submitted_at).filter((r) => !kc || r.kc[kc] !== undefined);
  const recent = showAll ? recentAll : recentAll.slice(0, 10);
  const doExport = async (j: 'penguasaan' | 'percobaan') => {
    setExporting(j);
    try {
      await api.exportCsv(j, kelas);
    } finally {
      setExporting('');
    }
  };
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <AppShell wide onHelp={tour.start}>
      <Tour steps={DOSEN_TOUR} open={tour.open} onClose={tour.close} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-[clamp(1.8rem,3vw,2.5rem)] leading-[1.12] tracking-[-0.01em]">
            Ringkasan <em className="text-teal">{kelasName}</em>
          </h1>
          <p className="mt-1.5 text-[14px] text-ink/55">
            {today} · {data.students.length} mahasiswa · {data.n_attempts} kasus dikirim
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <KelasSelect kelas={kelas} setKelas={setKelas} options={data.kelas} />
          <PillButton icon={Download} onClick={() => doExport('penguasaan')} disabled={!!exporting}>
            {exporting === 'penguasaan' ? 'Mengekspor…' : 'CSV penguasaan'}
          </PillButton>
          <PillButton icon={Download} onClick={() => doExport('percobaan')} disabled={!!exporting}>
            {exporting === 'percobaan' ? 'Mengekspor…' : 'CSV percobaan'}
          </PillButton>
          <PillButton icon={RefreshCw} onClick={load} title="Muat ulang" aria-label="Muat ulang" />
        </div>
      </div>

      <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div data-tour="kpi" className="grid grid-cols-2 gap-3 lg:col-span-12 lg:grid-cols-4">
          <Stat icon={Users} tone="teal" label="aktif 7 hari terakhir" value={String(data.active_7d)} of={`/${data.students.length}`} />
          <Stat icon={ScanLine} tone="info" label="kasus dikerjakan" value={String(data.n_attempts)} />
          <Stat icon={Gauge} tone={diceTone(data.mean_dice)} label="rerata Dice delineasi" value={data.mean_dice === null ? '—' : fmt.num(data.mean_dice)} />
          <Stat icon={ShieldAlert} tone={data.flagged_tutor ? 'bad' : 'ok'} label="respons tutor ditandai" value={String(data.flagged_tutor)} of={`/${data.n_tutor}`} />
        </div>

        <section data-tour="skyline" className="overflow-hidden rounded-2xl card-surface p-2 lg:col-span-8">
          <Suspense fallback={<div className="h-[380px]" />}>
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
                  <b className="font-semibold">Aktivitas latihan kelas</b> <span className="text-ink/50">· kasus dikirim per hari</span>
                </span>
              }
            />
          </Suspense>
        </section>

        <section data-tour="attention" className="relative flex flex-col overflow-hidden rounded-2xl card-surface p-6 lg:col-span-4">
          <span aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-1', attention.length ? 'bg-bad' : 'bg-ok')} />
          <CardTitle
            icon={AlertTriangle}
            title={
              <>
                Perlu perhatian <span className="rounded-full bg-muted px-2 py-px text-[11px] font-medium text-ink/55">{attention.length}</span>
              </>
            }
            action={
              <Link to="/dosen/mahasiswa" className="text-[12.5px] font-medium text-teal hover:underline">
                Monitoring
              </Link>
            }
          />
          {attention.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
              <CheckCircle2 className="size-9 text-ok" />
              <b className="text-[15px] font-medium">Semua aman</b>
              <p className="text-[13px] text-ink/55">Tidak ada mahasiswa yang ditandai.</p>
            </div>
          ) : (
            <ul className="-mx-2 mt-3 max-h-[330px] space-y-0.5 overflow-y-auto">
              {attention.slice(0, 12).map((s) => (
                <li key={s.sid}>
                  <Link to={`/dosen/mahasiswa/${s.sid}`} className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface">
                    <Avatar nama={s.nama} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13.5px] font-medium">{s.nama}</b>
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {s.flags.map((f) => (
                          <span key={f} className={cn('whitespace-nowrap rounded-md px-1.5 py-px text-[10.5px] font-semibold', f.startsWith('banyak') ? BADGE.bad : f.startsWith('tidak') ? BADGE.warn : BADGE.none)}>
                            {f}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-ink/40">{fmt.ago(s.last_active)}</span>
                    <ChevronRight className="size-4 shrink-0 text-ink/25 transition-transform group-hover:translate-x-0.5 group-hover:text-teal" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section data-tour="ring" className="lg:col-span-5">
          <CirculariumRing
            className="h-full !rounded-2xl !border-line !bg-white !p-5 !shadow-none"
            data={ring.grid}
            maxValue={ring.max}
            formatValue={fmtKasus}
            palette={RING_PALETTE}
            title="Kapan kelas berlatih"
            subtitle={sessions.length ? `Paling ramai ${HARI[ring.peakDay]} pukul ${String(ring.peakHour).padStart(2, '0')}.00 WIB` : 'Belum ada kasus yang dikirim'}
            hint="Cincin = hari (Senin paling dalam) · sektor = jam WIB"
            legendLabels={['Sepi', 'Ramai']}
          />
        </section>

        <section data-tour="kc" className="flex flex-col rounded-2xl card-surface p-6 lg:col-span-4">
          <CardTitle icon={Target} title="Penguasaan rata-rata kelas" sub="Peluang menguasai KC menurut BKT · dikuasai ≥ 95%" />
          <ul className="mt-5 space-y-4">
            {ACTIVE.map((k, i) => {
              const a = data.kc_avg[k];
              const v = a?.mean ?? 0;
              const tone = kcTone(v, k === weakest);
              return (
                <li key={k}>
                  <div className="flex items-center gap-2.5 text-[13px]">
                    <span className={cn('w-8 rounded-md py-0.5 text-center font-mono text-[10.5px] font-semibold', BADGE[tone])}>{k}</span>
                    <span className="flex-1 truncate text-ink/80">{data.kc[k]}</span>
                    <b className={cn('font-semibold tabular-nums', TEXT[tone])}>{a?.mean == null ? '—' : fmt.pct(v)}</b>
                  </div>
                  <div className="relative mt-1.5 h-2 rounded-full bg-muted">
                    <motion.span initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ duration: 0.9, delay: 0.1 + i * 0.06, ease: EASE }} className={cn('block h-full rounded-full', FILL[tone])} />
                    <span className="absolute -inset-y-0.5 left-[95%] w-0.5 rounded bg-ink/30" title="batas dikuasai 95%" />
                  </div>
                  <p className="mt-1 text-[11.5px] text-ink/45">
                    {a?.dikuasai ?? 0} dari {data.students.length} mahasiswa sudah menguasai
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-4 text-[11.5px] text-ink/55">
            {(
              [
                ['ok', 'dikuasai'],
                ['info', 'berkembang'],
                ['bad', 'terlemah'],
              ] as const
            ).map(([t, l]) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className={cn('size-2 rounded-full', FILL[t])} /> {l}
              </span>
            ))}
          </div>
        </section>

        <section data-tour="errors" className="rounded-2xl card-surface p-6 lg:col-span-3">
          <CardTitle icon={PieChart} title="Jenis kesalahan" sub="Dari semua delineasi yang dikirim" />
          <ErrorDonut data={errs} />
        </section>

        <section data-tour="history" className="rounded-2xl card-surface p-5 sm:p-6 lg:col-span-12">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <CardTitle icon={History} title="Riwayat percobaan terbaru" sub="Klik satu baris untuk meninjau anotasi mahasiswa di atas kunci jawaban" />
            <Seg label="Saring KC" value={kc} onChange={setKc} items={['', ...ACTIVE].map((k) => ({ v: k, label: k || 'Semua KC' }))} />
          </div>
          {recent.length === 0 ? <Empty title="Belum ada percobaan">Hasil penilaian otomatis mahasiswa akan muncul di sini.</Empty> : <AttemptTimeline rows={recent} base="/dosen/percobaan" showStudent compact />}
          {recentAll.length > 10 && (
            <div className="mt-4 flex justify-center border-t border-line pt-4">
              <PillButton icon={showAll ? undefined : History} onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Tampilkan lebih sedikit' : `Tampilkan semua ${recentAll.length} percobaan`}
              </PillButton>
            </div>
          )}
        </section>
      </div>
      <p className="mt-4 text-[12px] text-ink/45">Basis data: {data.db}. Nilai penguasaan = peluang menguasai KC menurut BKT; dikuasai bila ≥ 95%. Jam memakai WIB.</p>
    </AppShell>
  );
}

const DOSEN_TOUR: TourStep[] = [
  { title: 'Dasbor dosen', body: 'Halaman ini merangkum kelasmu. Panduan singkat ini menunjukkan cara membacanya.' },
  { target: 'kpi', title: 'Angka utama', body: 'Mahasiswa aktif, jumlah kasus, rerata Dice, dan respons tutor yang ditandai pemeriksa fakta.', padding: 6 },
  { target: 'skyline', title: 'Aktivitas setahun', body: 'Kasus dikirim per hari. Ganti ke tampilan datar dengan tombol di kanan atas.' },
  { target: 'attention', title: 'Mahasiswa yang perlu perhatian', body: 'Ditandai bila belum berlatih, tidak aktif lebih dari 7 hari, atau banyak jawaban salah. Klik nama untuk detailnya.' },
  { target: 'ring', title: 'Kapan kelas berlatih', body: 'Setiap cincin satu hari, setiap sektor satu jam. Makin tinggi balok, makin banyak kasus dikerjakan di jam itu. Seret untuk memutar.' },
  { target: 'kc', title: 'Penguasaan kelas', body: 'Rata-rata peluang penguasaan tiap KC dan berapa mahasiswa yang sudah melewati 95%.' },
  { target: 'history', title: 'Riwayat percobaan', body: 'Garis waktu kasus yang baru dikirim, per hari. Titik berwarna menunjukkan hasilnya; klik untuk meninjau.' },
  { target: 'nav', title: 'Monitoring mahasiswa', body: 'Menu Mahasiswa berisi tabel pantauan lengkap dengan saringan, status, dan aksi massal.', padding: 6 },
  { target: 'help', title: 'Selesai', body: 'Tekan Panduan kapan saja untuk memutar ulang.' },
];

const RING_PALETTE = { light: ['#ccfbf1', '#5eead4', '#14b8a6', '#0f766e'], dark: ['#134e4a', '#0f766e', '#14b8a6', '#5eead4'] };
const SKY = { light: ['#ccfbf1', '#5eead4', '#14b8a6', '#0f766e'], dark: ['#134e4a', '#0f766e', '#14b8a6', '#5eead4'] };
const EASE = [0.22, 1, 0.36, 1] as const;
const fmtKasus = (v: number) => `${v} kasus dimulai`;
const DONUT = ['#0f766e', '#f59e0b', '#ef4444', '#3b82f6', '#a78bfa', '#94a3b8'];

/** Donat jenis kesalahan dengan legenda; arahkan kursor untuk menyorot satu jenis. */
function ErrorDonut({ data }: { data: [string, number][] }) {
  const [hi, setHi] = useState<number | null>(null);
  const total = data.reduce((a, [, n]) => a + n, 0);
  if (!total) return <div className="mt-4"><Empty title="Belum ada data">Muncul setelah mahasiswa mengirim delineasi.</Empty></div>;
  const R = 54;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const top = hi ?? 0;
  return (
    <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row lg:flex-col">
      <div className="relative size-40 shrink-0">
        <svg viewBox="0 0 140 140" className="size-full -rotate-90">
          <circle cx="70" cy="70" r={R} fill="none" stroke="#f1f5f9" strokeWidth="18" />
          {data.map(([k, n], i) => {
            const len = (n / total) * C;
            const el = (
              <motion.circle
                key={k}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={DONUT[i % DONUT.length]}
                strokeWidth={hi === i ? 22 : 18}
                strokeDasharray={`${Math.max(0, len - 2)} ${C}`}
                strokeDashoffset={-acc}
                initial={{ opacity: 0 }}
                animate={{ opacity: hi === null || hi === i ? 1 : 0.3 }}
                transition={{ duration: 0.3 }}
                onMouseEnter={() => setHi(i)}
                onMouseLeave={() => setHi(null)}
                className="cursor-pointer transition-[stroke-width]"
              />
            );
            acc += len;
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <b className="block text-[1.5rem] font-semibold leading-none tabular-nums">{Math.round((data[top][1] / total) * 100)}%</b>
            <span className="mx-auto mt-1 block max-w-[6.5rem] text-[10.5px] leading-tight text-ink/55">{data[top][0]}</span>
          </div>
        </div>
      </div>
      <ul className="w-full space-y-1">
        {data.map(([k, n], i) => (
          <li key={k} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} className={cn('flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] transition-colors', hi === i && 'bg-surface')}>
            <i className="size-2.5 shrink-0 rounded-full" style={{ background: DONUT[i % DONUT.length] }} />
            <span className="flex-1 leading-snug text-ink/75">{k}</span>
            <b className="font-medium tabular-nums">{n}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- monitoring mahasiswa --------------------------------------------------------

type StatusKey = ReturnType<typeof studentStatus>['key'];
const STATUS_SEG: { key: StatusKey; label: string; cls: string; text: string }[] = [
  { key: 'aktif', label: 'Aktif', cls: 'bg-teal text-white', text: 'text-ink/55' },
  { key: 'bimbingan', label: 'Perlu bimbingan', cls: 'bg-bad-soft text-bad-ink', text: 'text-ink/55' },
  { key: 'tidak_aktif', label: 'Tidak aktif', cls: 'text-warn-ink bg-[repeating-linear-gradient(135deg,rgb(217_119_6/.16)_0_6px,rgb(254_243_199/.7)_6px_12px)]', text: 'text-ink/55' },
  { key: 'belum', label: 'Belum mulai', cls: 'border border-ink/25 bg-white text-ink/60', text: 'text-ink/55' },
];

/** Bilah proporsi status (gaya referensi "Interviews / Hired / Project time / Output"); klik ruas untuk menyaring. */
function StatusBar({ students, value, onChange }: { students: StudentRow[]; value: string; onChange: (v: string) => void }) {
  const n = Math.max(1, students.length);
  const counts = STATUS_SEG.map((s) => ({ ...s, c: students.filter((x) => studentStatus(x).key === s.key).length }));
  return (
    <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:flex sm:gap-1.5" role="group" aria-label="Sebaran status mahasiswa">
      {counts.map((s) => {
        const on = value === s.key;
        return (
          <button
            key={s.key}
            onClick={() => onChange(on ? '' : s.key)}
            aria-pressed={on}
            title={`${s.label}: ${s.c} mahasiswa`}
            className="group min-w-[4.5rem] text-left"
            style={{ flex: `${Math.max(s.c / n, 0.08)} 1 0` }}
          >
            <span className={cn('mb-1.5 block truncate text-[12.5px] transition-colors', on ? 'font-semibold text-ink' : s.text)}>{s.label}</span>
            <span className={cn('flex h-10 items-center whitespace-nowrap rounded-full px-3.5 text-[12.5px] font-semibold tabular-nums transition-[box-shadow,transform] group-hover:-translate-y-px', s.cls, on && 'ring-2 ring-ink ring-offset-2')}>
              {Math.round((s.c / n) * 100)}%<span className="ml-1 font-normal opacity-70">· {s.c}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Mahasiswa() {
  const { data, err, kelas, setKelas, load } = useOverview();
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [weak, setWeak] = useState('');
  const [jenjang, setJenjang] = useState('');
  const [sort, setSort] = useState('nama');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [moveTo, setMoveTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const allRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    if (!data) return [];
    const f = q.trim().toLowerCase();
    const r = data.students.filter(
      (s) =>
        (!f || s.nama.toLowerCase().includes(f) || s.sid.toLowerCase().includes(f)) &&
        (!status || studentStatus(s).key === status) &&
        (!weak || s.kc_terlemah === weak) &&
        (!jenjang || s.jenjang === jenjang),
    );
    const val = (s: StudentRow): string | number =>
      sort === 'nama'
        ? s.nama.toLowerCase()
        : sort === 'kelas'
          ? (s.kelas ?? '').toLowerCase()
          : sort === 'kasus'
            ? -s.n_kasus
            : sort === 'dice'
              ? -(s.mean_dice ?? -1)
              : sort === 'modul'
                ? -s.modul_selesai
                : sort === 'aktif'
                  ? -s.last_active
                  : sort === 'status'
                    ? STATUS_SEG.findIndex((x) => x.key === studentStatus(s).key)
                    : s.mastery[sort]?.p ?? 0.2;
    return [...r].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0));
  }, [data, q, status, weak, jenjang, sort]);

  const visibleSel = rows.filter((r) => sel.has(r.sid));
  const allOn = rows.length > 0 && visibleSel.length === rows.length;
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = visibleSel.length > 0 && !allOn;
  }, [visibleSel.length, allOn]);

  const toggle = (sid: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(sid)) n.delete(sid);
      else n.add(sid);
      return n;
    });
  const toggleAll = () => setSel(allOn ? new Set() : new Set(rows.map((r) => r.sid)));

  const exportRows = (list: StudentRow[], name: string) =>
    downloadCsv(name, [
      ['pseudonim', 'nama', 'kelas', 'jenjang', 'kasus', 'rerata_dice', 'modul_selesai', ...ACTIVE.map((k) => `p_${k}`), 'kc_terlemah', 'status', 'terakhir_aktif'],
      ...list.map((s) => [
        s.sid,
        s.nama,
        s.kelas,
        s.jenjang,
        s.n_kasus,
        s.mean_dice === null ? null : s.mean_dice.toFixed(3),
        s.modul_selesai,
        ...ACTIVE.map((k) => (s.mastery[k] ? s.mastery[k].p.toFixed(3) : null)),
        s.kc_terlemah,
        studentStatus(s).label,
        s.last_active ? new Date(s.last_active * 1000).toISOString() : null,
      ]),
    ]);

  const move = async () => {
    if (!data || !moveTo || !visibleSel.length) return;
    const target = data.kelas.find((k) => String(k.id) === moveTo);
    if (!confirm(`Pindahkan ${visibleSel.length} mahasiswa ke ${target?.nama}? Riwayat latihan mereka ikut pindah.`)) return;
    setBusy(true);
    try {
      await Promise.all(visibleSel.map((s) => api.moveStudent(s.sid, Number(moveTo))));
      setSel(new Set());
      setMoveTo('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell wide>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[clamp(2rem,3.4vw,2.8rem)] leading-[1.08] tracking-[-0.01em]">Mahasiswa</h1>
          <p className="mt-1.5 max-w-2xl text-[14px] text-ink/55">Pantau status, penguasaan KC, dan aktivitas setiap mahasiswa. Centang beberapa baris untuk ekspor atau pindah kelas sekaligus.</p>
        </div>
      </div>

      {err && <p className="mt-4 text-[14px] text-bad-ink">{err}</p>}
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <StatusBar students={data.students} value={status} onChange={setStatus} />
            <div className="flex flex-wrap items-center gap-2">
              <KelasSelect kelas={kelas} setKelas={setKelas} options={data.kelas} />
              <PillButton
                icon={Download}
                disabled={exporting}
                onClick={async () => {
                  setExporting(true);
                  try {
                    await api.exportCsv('penguasaan', kelas);
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                {exporting ? 'Mengekspor…' : 'Ekspor semua'}
              </PillButton>
            </div>
          </div>

          <section className="mt-6 rounded-[1.75rem] bg-surface p-2 ring-1 ring-line">
            <div className="flex flex-wrap items-center gap-2 p-2.5">
              <PillSelect value={status} onChange={setStatus} label="Saring status">
                <option value="">Semua status</option>
                {STATUS_SEG.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </PillSelect>
              <PillSelect value={weak} onChange={setWeak} label="Saring KC terlemah">
                <option value="">KC terlemah</option>
                {ACTIVE.map((k) => (
                  <option key={k} value={k}>
                    {k} · {data.kc[k]}
                  </option>
                ))}
              </PillSelect>
              <PillSelect value={jenjang} onChange={setJenjang} label="Saring jenjang">
                <option value="">Jenjang</option>
                {Object.entries(JENJANG).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </PillSelect>
              <SearchBox value={q} onChange={setQ} placeholder="Cari nama atau pseudonim" className="sm:max-w-[22rem]" />
              {(status || weak || jenjang || q) && (
                <PillButton
                  variant="ghost"
                  icon={X}
                  onClick={() => {
                    setStatus('');
                    setWeak('');
                    setJenjang('');
                    setQ('');
                  }}
                >
                  Hapus saringan
                </PillButton>
              )}
              <span className="ml-auto text-[12.5px] text-ink/50">
                {rows.length} dari {data.students.length} mahasiswa
              </span>
            </div>

            <div className="overflow-hidden rounded-[1.4rem] bg-white ring-1 ring-line">
              <div className="overflow-x-auto px-2 pb-2 sm:px-4">
                <table className="w-full min-w-[980px] border-separate border-spacing-y-1 text-left text-[13.5px]">
                  <thead className="text-[12.5px] text-ink/50">
                    <tr className="[&>th]:border-b [&>th]:border-dashed [&>th]:border-ink/15">
                      <th className="w-10 px-3 py-3">
                        <input ref={allRef} type="checkbox" checked={allOn} onChange={toggleAll} aria-label="Pilih semua" className="size-4 cursor-pointer accent-teal" />
                      </th>
                      <SortTh k="nama" sort={sort} setSort={setSort}>
                        Mahasiswa
                      </SortTh>
                      <SortTh k="kelas" sort={sort} setSort={setSort}>
                        Kelas
                      </SortTh>
                      <SortTh k="kasus" sort={sort} setSort={setSort}>
                        Kasus
                      </SortTh>
                      <SortTh k="dice" sort={sort} setSort={setSort}>
                        Rerata Dice
                      </SortTh>
                      <SortTh k="modul" sort={sort} setSort={setSort}>
                        Modul
                      </SortTh>
                      <th className="px-3 py-3 font-medium">
                        <span className="flex gap-1">
                          {ACTIVE.map((k) => (
                            <button key={k} onClick={() => setSort(k)} title={`Urutkan menurut ${data.kc[k]}`} className={cn('w-9 rounded-md py-0.5 text-center font-mono text-[11px] transition-colors hover:bg-muted', sort === k && 'bg-mint font-semibold text-teal')}>
                              {k}
                            </button>
                          ))}
                        </span>
                      </th>
                      <SortTh k="aktif" sort={sort} setSort={setSort}>
                        Terakhir aktif
                      </SortTh>
                      <SortTh k="status" sort={sort} setSort={setSort}>
                        Status
                      </SortTh>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s, i) => {
                      const on = sel.has(s.sid);
                      const st = studentStatus(s);
                      const dt = diceTone(s.mean_dice);
                      return (
                        <motion.tr
                          key={s.sid}
                          initial={reduce ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, delay: Math.min(i, 12) * 0.02 }}
                          onClick={() => nav(`/dosen/mahasiswa/${s.sid}`)}
                          className={cn(
                            'group cursor-pointer [&>td:first-child]:rounded-l-2xl [&>td:last-child]:rounded-r-2xl [&>td]:transition-colors',
                            on ? '[&>td]:bg-mint' : 'hover:[&>td]:bg-surface',
                          )}
                        >
                          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={on} onChange={() => toggle(s.sid)} aria-label={`Pilih ${s.nama}`} className="size-4 cursor-pointer accent-teal" />
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="flex items-center gap-3">
                              <Avatar nama={s.nama} />
                              <span className="min-w-0">
                                <b className="block truncate font-medium text-ink group-hover:text-teal">{s.nama}</b>
                                <span className="block font-mono text-[11px] text-ink/40">{s.sid}</span>
                              </span>
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-ink/70">{s.kelas ?? '—'}</td>
                          <td className="px-3 py-2.5 font-medium tabular-nums">{s.n_kasus}</td>
                          <td className="px-3 py-2.5">
                            <span className="flex items-center gap-2">
                              <b className={cn('w-9 font-semibold tabular-nums', TEXT[dt])}>{s.mean_dice === null ? '—' : fmt.num(s.mean_dice)}</b>
                              <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                                <span className={cn('block h-full rounded-full', FILL[dt])} style={{ width: `${(s.mean_dice ?? 0) * 100}%` }} />
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="flex items-center gap-2">
                              <span className="flex gap-0.5" aria-hidden="true">
                                {LESSONS.map((l, j) => (
                                  <span key={l.id} className={cn('h-3.5 w-1.5 rounded-full', j < s.modul_selesai ? 'bg-teal' : 'bg-muted')} />
                                ))}
                              </span>
                              <span className="text-[12px] tabular-nums text-ink/55">
                                {s.modul_selesai}/{LESSONS.length}
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="flex gap-1">
                              {ACTIVE.map((k) => {
                                const m = s.mastery[k];
                                return (
                                  <span
                                    key={k}
                                    title={`${data.kc[k]}: ${m ? fmt.pct(m.p) : 'belum ada observasi'}${k === s.kc_terlemah ? ' · terlemah' : ''}`}
                                    className={cn('grid h-7 w-9 place-items-center rounded-md text-[11px] font-semibold tabular-nums text-ink/75', !m && 'bg-muted text-ink/30', k === s.kc_terlemah && 'ring-1 ring-bad/50')}
                                    style={m ? { background: heat(m.p) } : undefined}
                                  >
                                    {m ? Math.round(m.p * 100) : '·'}
                                  </span>
                                );
                              })}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-ink/60">{fmt.ago(s.last_active)}</td>
                          <td className="px-3 py-2.5">
                            <StatusPill tone={st.tone}>{st.label}</StatusPill>
                          </td>
                          <td className="px-2 py-2.5">
                            <ChevronRight className="size-4 text-ink/25 transition-transform group-hover:translate-x-0.5 group-hover:text-teal" />
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
                {rows.length === 0 && (
                  <div className="p-4">
                    <Empty title={data.students.length ? 'Tidak ada yang cocok' : 'Belum ada mahasiswa'}>{data.students.length ? 'Ubah saringan atau kata kunci.' : 'Bagikan kode kelas dari menu Kelas.'}</Empty>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-1 pt-3 text-[12px] text-ink/50">
              <span className="flex flex-wrap items-center gap-2">
                Penguasaan KC:
                <span className="flex items-center gap-1">
                  rendah
                  {[0.1, 0.35, 0.6, 0.8, 1].map((p) => (
                    <i key={p} className="size-3 rounded-sm" style={{ background: heat(p) }} />
                  ))}
                  tinggi
                </span>
                · bingkai merah = KC terlemah
              </span>
              <span>Klik judul kolom untuk mengurutkan · klik baris untuk detail</span>
            </div>
          </section>

          <AnimatePresence>
            {visibleSel.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: 16, x: '-50%' }}
                transition={{ duration: 0.2, ease: EASE }}
                className="fixed bottom-5 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-max flex-wrap items-center gap-2 rounded-[1.4rem] bg-ink p-2 pl-4 text-white shadow-[0_20px_50px_-15px_rgba(15,23,42,.6)]"
                role="region"
                aria-label="Aksi untuk mahasiswa terpilih"
              >
                <span className="flex items-center gap-2 text-[13.5px] font-medium">
                  <span className="grid size-6 place-items-center rounded-full bg-white/15 text-[12px] tabular-nums">{visibleSel.length}</span>
                  dipilih
                </span>
                <span className="mx-1 h-5 w-px bg-white/15" />
                <button onClick={() => exportRows(visibleSel, `sinaps_mahasiswa_terpilih.csv`)} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors hover:bg-white/10">
                  <Download className="size-4" /> Ekspor CSV
                </button>
                <span className="flex items-center gap-1.5">
                  <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="Kelas tujuan" className="h-9 cursor-pointer rounded-full border border-white/15 bg-white/5 px-3 text-[13px] text-white outline-none [&>option]:text-ink">
                    <option value="">Pindah ke kelas…</option>
                    {data.kelas.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nama}
                      </option>
                    ))}
                  </select>
                  <button onClick={move} disabled={!moveTo || busy} className="h-9 rounded-full bg-white px-3.5 text-[13px] font-semibold text-ink transition-opacity disabled:opacity-40">
                    {busy ? 'Memindahkan…' : 'Pindahkan'}
                  </button>
                </span>
                <button onClick={() => setSel(new Set())} aria-label="Batalkan pilihan" className="grid size-9 place-items-center rounded-full transition-colors hover:bg-white/10">
                  <X className="size-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AppShell>
  );
}

// --- detail mahasiswa -------------------------------------------------------------

type Tab = 'kasus' | 'tutor' | 'modul' | 'tugas';

export function DetailMahasiswa() {
  const { sid = '' } = useParams();
  const [d, setD] = useState<StudentDetail | null>(null);
  const [err, setErr] = useState('');
  const [pw, setPw] = useState('');
  const [tab, setTab] = useState<Tab>('kasus');
  useEffect(() => {
    api.student(sid).then(setD).catch((e) => setErr(e.message));
  }, [sid]);
  if (err) return <Page title="Mahasiswa"><p className="error">{err}</p><Link to="/dosen/mahasiswa">Kembali</Link></Page>;
  if (!d) return <Page title="Mahasiswa"><Loading /></Page>;
  const s = d.student;
  const errs = Object.entries(d.error_counts).sort((a, b) => b[1] - a[1]);
  const reset = async () => {
    if (!confirm(`Atur ulang kata sandi ${s.nama}? Kata sandi lama langsung tidak berlaku.`)) return;
    setPw((await api.resetPassword(sid)).password);
  };
  const remove = async () => {
    if (!confirm(`Keluarkan ${s.nama} dari ${s.kelas?.nama}? Riwayat latihannya tidak dihapus.`)) return;
    await api.moveStudent(sid, null);
    history.back();
  };
  const dices = d.attempts.filter((a) => a.dice !== null).map((a) => a.dice!);
  const meanDice = dices.length ? dices.reduce((a, b) => a + b, 0) / dices.length : null;
  const doneLessons = Object.values(d.lessons).filter((l) => l.completed).length;
  const flagged = d.tutor_logs.filter((t) => t.issues.length).length;
  const activeKc = Object.entries(d.kc).filter(([, i]) => i.aktif);
  const weakest = activeKc.reduce((a, [k]) => ((d.mastery[k] ?? 0) < (d.mastery[a] ?? 1) ? k : a), activeKc[0]?.[0] ?? '');
  const recent5 = d.attempts.slice(0, 5);
  const status = studentStatus({
    n_kasus: d.attempts.length,
    flags: [
      ...(d.attempts.length && Date.now() / 1000 - s.last_seen > 7 * 86400 ? ['tidak aktif > 7 hari'] : []),
      ...(recent5.length >= 2 && recent5.flatMap((a) => Object.values(a.kc)).filter(Boolean).length / Math.max(1, recent5.flatMap((a) => Object.values(a.kc)).length) < 0.4 ? ['banyak jawaban salah'] : []),
    ],
  });

  return (
    <AppShell wide>
      <Link to="/dosen/mahasiswa" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink/55 transition-colors hover:text-teal">
        <ArrowLeft className="size-4" /> Monitoring mahasiswa
      </Link>

      <section className="mt-4 flex flex-wrap items-center gap-5 rounded-2xl card-surface p-5 sm:p-6">
        <Avatar nama={s.nama} className="size-16 text-[20px] ring-4" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-serif text-[clamp(1.6rem,2.6vw,2.1rem)] leading-tight">{s.nama}</h1>
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink/55">
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11.5px] text-ink/65">{s.id}</span>
            <span>{JENJANG[s.jenjang ?? ''] ?? '—'}</span>
            <span>· {s.kelas?.nama ?? 'tanpa kelas'}</span>
            <span>· bergabung {fmt.date(s.created_at)}</span>
            <span>· aktif {fmt.ago(s.last_seen)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PillButton icon={KeyRound} onClick={reset}>
            Atur ulang kata sandi
          </PillButton>
          {s.kelas && (
            <PillButton icon={UserMinus} variant="danger" onClick={remove}>
              Keluarkan dari kelas
            </PillButton>
          )}
        </div>
      </section>

      {pw && (
        <section className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-warn/30 bg-warn-soft/60 p-5">
          <KeyRound className="size-5 text-warn-ink" />
          <div className="min-w-0 flex-1">
            <b className="text-[15px] font-semibold">
              Kata sandi sementara: <span className="ml-1 rounded-md bg-white px-2 py-0.5 font-mono text-[16px] tracking-wider">{pw}</span>
            </b>
            <p className="mt-1 text-[13px] text-ink/60">Sampaikan langsung kepada mahasiswa dan minta ia menggantinya di halaman Profil. Kata sandi ini tidak ditampilkan lagi.</p>
          </div>
        </section>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={ScanLine} tone="info" label="kasus dikerjakan" value={String(d.attempts.length)} />
        <Stat icon={Gauge} tone={diceTone(meanDice)} label="rerata Dice" value={meanDice === null ? '—' : fmt.num(meanDice)} hint={meanDice === null ? undefined : meanDice >= 0.7 ? 'baik' : meanDice >= 0.4 ? 'cukup' : 'perlu dilatih'} />
        <Stat icon={GraduationCap} tone="teal" label="modul selesai" value={String(doneLessons)} of={`/${LESSONS.length}`} />
        <Stat icon={MessagesSquare} tone={flagged ? 'bad' : 'ok'} label="pertanyaan ke tutor" value={String(d.tutor_logs.length)} hint={flagged ? `${flagged} ditandai` : undefined} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="rounded-2xl card-surface p-6 lg:col-span-5">
          <CardTitle icon={Target} title="Penguasaan saat ini" sub="dikuasai ≥ 95%" />
          <ul className="mt-5 space-y-4">
            {Object.entries(d.kc).map(([k, info], i) => {
              const v = d.mastery[k] ?? 0;
              const tone: Tone = !info.aktif ? 'none' : kcTone(v, k === weakest);
              return (
                <li key={k} title={`Bukti: ${info.bukti} · ${d.n_obs[k] ?? 0} observasi`}>
                  <div className="flex items-center gap-2.5 text-[13px]">
                    <span className={cn('w-8 rounded-md py-0.5 text-center font-mono text-[10.5px] font-semibold', info.aktif ? BADGE[tone] : 'bg-muted text-ink/35')}>{k}</span>
                    <span className={cn('flex-1 truncate', info.aktif ? 'text-ink/80' : 'text-ink/35')}>{info.nama}</span>
                    {info.aktif ? <b className={cn('font-semibold tabular-nums', TEXT[tone])}>{fmt.pct(v)}</b> : <span className="text-[11px] text-ink/35">belum di MVP</span>}
                  </div>
                  {info.aktif && (
                    <div className="relative mt-1.5 h-2 rounded-full bg-muted">
                      <motion.span initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ duration: 0.9, delay: 0.1 + i * 0.06, ease: EASE }} className={cn('block h-full rounded-full', FILL[tone])} />
                      <span className="absolute -inset-y-0.5 left-[95%] w-0.5 rounded bg-ink/30" />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
        <section className="min-w-0 rounded-2xl card-surface p-6 lg:col-span-7">
          <CardTitle icon={TrendingUp} title="Lintasan penguasaan" sub="Satu titik per kasus yang dikirim" />
          <div className="legacy mt-3">
            {d.trajectory.length === 0 ? <p className="muted small">Belum ada kasus yang dikirim.</p> : <Trajectory points={d.trajectory} kcs={ACTIVE} names={Object.fromEntries(Object.entries(d.kc).map(([k, v]) => [k, v.nama]))} />}
          </div>
        </section>
        <section className="rounded-2xl card-surface p-6 lg:col-span-5">
          <CardTitle icon={PieChart} title="Jenis kesalahan delineasi" />
          <ErrorDonut data={errs} />
        </section>
        <div className="lg:col-span-7">
          <StudentRing attempts={d.attempts} />
        </div>
      </div>

      <section className="mt-4 rounded-2xl card-surface p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <Seg<Tab>
            label="Bagian detail"
            value={tab}
            onChange={setTab}
            items={[
              { v: 'kasus', label: 'Riwayat kasus', n: d.attempts.length, icon: History },
              { v: 'tutor', label: 'Log tutor', n: d.tutor_logs.length, icon: Bot },
              { v: 'modul', label: 'Modul', n: doneLessons, icon: BookOpen },
              { v: 'tugas', label: 'Tugas', n: d.assignments.length, icon: ClipboardList },
            ]}
          />
          {tab === 'kasus' && meanDice !== null && (
            <p className="text-[13px] text-ink/55">
              {d.attempts.length} percobaan · rerata Dice <b className={cn('font-semibold', TEXT[diceTone(meanDice)])}>{fmt.num(meanDice)}</b>
            </p>
          )}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
            {tab === 'kasus' && (d.attempts.length ? <AttemptTimeline rows={d.attempts} base="/dosen/percobaan" /> : <Empty title="Belum ada kasus" />)}
            {tab === 'tutor' &&
              (d.tutor_logs.length ? (
                <ul className="divide-y divide-line">
                  {d.tutor_logs.map((t) => (
                    <li key={t.id} className="py-4 first:pt-0 last:pb-0">
                      <TutorThread
                        t={t}
                        who={s.nama}
                        meta={
                          <>
                            <span>{fmt.dateTime(t.created_at)}</span>·
                            <Link to={`/dosen/percobaan/${t.attempt_id}`} className="font-mono font-medium text-teal hover:underline">
                              {t.case_id}
                            </Link>
                          </>
                        }
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty title="Belum ada percakapan tutor" />
              ))}
            {tab === 'modul' && (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {LESSONS.map((l, i) => {
                  const st = d.lessons[l.id];
                  const tone: Tone = st?.completed ? 'ok' : st ? 'info' : 'none';
                  return (
                    <li key={l.id} className={cn('rounded-2xl border p-4', st?.completed ? 'border-ok/25 bg-ok-soft/30' : 'border-line bg-white')}>
                      <div className="flex items-start gap-3">
                        <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', st?.completed ? 'bg-ok text-white' : 'bg-mint text-teal')}>{st?.completed ? <Check className="size-4" strokeWidth={3} /> : <BookOpen className="size-4" />}</span>
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink/40">
                            Modul {i + 1} · {l.kc ?? 'dasar'}
                          </span>
                          <b className="block text-[14px] font-medium leading-snug">{l.judul}</b>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2.5">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span className={cn('block h-full rounded-full', FILL[tone])} style={{ width: `${(st?.n_tries ? st.best_score : 0) * 100}%` }} />
                        </span>
                        <span className={cn('text-[12px] font-semibold tabular-nums', TEXT[tone])}>{st?.n_tries ? fmt.pct(st.best_score) : '—'}</span>
                      </div>
                      <p className="mt-1.5 text-[11.5px] text-ink/45">
                        {st?.completed ? 'Lulus kuis' : st ? 'Sudah dibuka' : 'Belum dibuka'} · {st?.n_tries ?? 0}× kuis
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
            {tab === 'tugas' && (d.assignments.length ? <div className="space-y-3">{d.assignments.map((t) => <TaskChecklist key={t.id} task={t} readOnly defaultOpen={false} />)}</div> : <Empty title="Tidak ada tugas untuk kelas ini" />)}
          </motion.div>
        </AnimatePresence>
      </section>
    </AppShell>
  );
}

function StudentRing({ attempts }: { attempts: StudentDetail['attempts'] }) {
  const ring = useMemo(() => weekHourGrid(attempts.map((a) => [a.started_at || a.submitted_at, a.submitted_at] as Session)), [attempts]);
  return (
    <CirculariumRing
      className="h-full !rounded-2xl !border-line !bg-white !shadow-none"
      data={ring.grid}
      maxValue={ring.max}
      formatValue={fmtKasus}
      palette={RING_PALETTE}
      title="Jam belajar mahasiswa"
      subtitle={attempts.length ? `Paling sering ${HARI[ring.peakDay]} pukul ${String(ring.peakHour).padStart(2, '0')}.00 WIB` : 'Belum ada kasus yang dikirim'}
      hint="Cincin = hari (Senin paling dalam) · sektor = jam WIB"
      legendLabels={['Sepi', 'Ramai']}
      showFilter={false}
    />
  );
}

