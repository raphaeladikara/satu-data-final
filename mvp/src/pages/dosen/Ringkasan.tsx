import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, CheckCircle2, Gauge, ScanLine, ShieldAlert, Users } from 'lucide-react';
import { AppShell, PageHead } from '@/components/AppShell';
import { Tour, useTour, type TourStep } from '@/components/Tour';
import { buttonClass } from '@/components/ui/button';
import { CirculariumRing } from '@/components/ui/circularium-ring';
import { dailyCounts, HARI, todayWib, weekHourGrid, type Session } from '@/lib/activity';
import { cn } from '@/lib/utils';
import { StatTile } from '@/components/ui/bento';

const ContributionSkyline = lazy(() => import('@/components/ui/contribution-skyline'));
import { Link, useParams } from 'react-router-dom';
import { api, fmt, JENJANG, type Overview, type StudentDetail } from '../../api';
import { ActivityBars, HBars, KC_COLORS, Trajectory, heat } from '../../components/Charts';
import MasteryBars from '../../components/MasteryBars';
import { Empty, Loading, Page } from '../../components/Shell';
import { LESSONS, lessonById } from '../../content/lessons';
import { AttemptTable } from '../student/Beranda';

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

export function KelasSelect({ kelas, setKelas, options }: { kelas: number | null; setKelas: (k: number | null) => void; options: { id: number; nama: string }[] }) {
  return (
    <select value={kelas ?? ''} onChange={(e) => setKelas(e.target.value ? Number(e.target.value) : null)} aria-label="Saring kelas">
      <option value="">Semua kelas</option>
      {options.map((k) => (
        <option key={k.id} value={k.id}>
          {k.nama}
        </option>
      ))}
    </select>
  );
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

export default function Ringkasan() {
  const { data, err, kelas, setKelas, load } = useOverview();
  const [exporting, setExporting] = useState('');
  const tour = useTour('dosen', { when: !!data && data.kelas.length > 0 });
  const sessions = useMemo<Session[]>(() => (data ? data.sessions ?? data.recent.map((r) => [r.started_at || r.submitted_at, r.submitted_at] as Session) : []), [data]);
  const ring = useMemo(() => weekHourGrid(sessions), [sessions]);
  const days = useMemo(() => dailyCounts(sessions), [sessions]);

  if (err) return <Page title="Ringkasan kelas"><p className="error">{err}</p></Page>;
  if (!data) return <Page title="Ringkasan kelas"><Loading /></Page>;
  if (data.kelas.length === 0)
    return (
      <AppShell>
        <PageHead eyebrow="Dasbor dosen" title={<>Selamat datang. <em className="text-teal">Buat kelas pertamamu.</em></>} sub="Mahasiswa memasukkan kode kelas saat mendaftar atau di halaman Profil. Setelah itu progres mereka muncul di sini." />
        <Link to="/dosen/kelas" className={buttonClass('primary', 'lg')}>
          Buat kelas <ArrowRight className="size-4" />
        </Link>
      </AppShell>
    );

  const attention = data.students.filter((s) => s.flags.length);
  const errs = Object.entries(data.error_counts).sort((a, b) => b[1] - a[1]);
  const kelasName = kelas ? data.kelas.find((k) => k.id === kelas)?.nama : `${data.kelas.length} kelas`;
  const doExport = async (j: 'penguasaan' | 'percobaan') => {
    setExporting(j);
    try {
      await api.exportCsv(j, kelas);
    } finally {
      setExporting('');
    }
  };

  return (
    <AppShell wide onHelp={tour.start}>
      <Tour steps={DOSEN_TOUR} open={tour.open} onClose={tour.close} />
      <PageHead
        eyebrow="Dasbor dosen"
        title={
          <>
            Ringkasan kelas <em className="text-teal">{kelasName}</em>
          </>
        }
        sub={`${data.students.length} mahasiswa · ${data.n_attempts} kasus dikirim · diperbarui saat halaman dimuat`}
        actions={
          <>
            <KelasSelect kelas={kelas} setKelas={setKelas} options={data.kelas} />
            <button className="btn small" onClick={() => doExport('penguasaan')} disabled={!!exporting}>
              {exporting === 'penguasaan' ? 'Mengekspor…' : 'CSV penguasaan'}
            </button>
            <button className="btn small" onClick={() => doExport('percobaan')} disabled={!!exporting}>
              {exporting === 'percobaan' ? 'Mengekspor…' : 'CSV percobaan'}
            </button>
            <button className="btn small" onClick={load}>
              Muat ulang
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div data-tour="kpi" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-12 lg:grid-cols-4">
          <StatTile layout="row" icon={Users} accent="leaf" value={String(data.active_7d)} of={`/${data.students.length}`} label="mahasiswa aktif 7 hari terakhir" />
          <StatTile layout="row" icon={ScanLine} accent="sky" value={String(data.n_attempts)} label="kasus dikerjakan" />
          <StatTile layout="row" icon={Gauge} accent="sand" value={data.mean_dice === null ? '—' : fmt.num(data.mean_dice)} label="rerata Dice delineasi" />
          <StatTile layout="row" icon={ShieldAlert} accent="terra" value={String(data.flagged_tutor)} of={`/${data.n_tutor}`} label="respons tutor ditandai pemeriksa fakta" />
        </div>

        <section data-tour="skyline" className="overflow-hidden rounded-[2rem] card-surface p-2 lg:col-span-12">
          <Suspense fallback={<div className="h-[420px]" />}>
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

        <section data-tour="ring" className="lg:col-span-5">
          <CirculariumRing
            className="h-full !rounded-[2rem] !border-ink/8 !p-5 !shadow-none"
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

        <section data-tour="kc" className="rounded-[2rem] card-surface p-6 lg:col-span-4">
          <h2 className="text-[17px] font-semibold tracking-tight">Penguasaan rata-rata kelas</h2>
          <p className="text-[12px] text-ink/50">Peluang menguasai KC menurut BKT; garis = 95%</p>
          <ul className="mt-5 space-y-4">
            {ACTIVE.map((k, i) => {
              const a = data.kc_avg[k];
              const v = a?.mean ?? 0;
              return (
                <li key={k}>
                  <div className="flex items-center gap-2.5 text-[13px]">
                    <span className="w-8 rounded-md py-0.5 text-center font-mono text-[10.5px] font-semibold text-white" style={{ background: KC_COLORS[k] }}>
                      {k}
                    </span>
                    <span className="flex-1 truncate text-ink/80">{data.kc[k]}</span>
                    <b className="font-medium tabular-nums">{a?.mean == null ? '—' : fmt.pct(v)}</b>
                  </div>
                  <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink/6">
                    <span className="absolute inset-y-0 left-[95%] z-10 w-px bg-ink/30" />
                    <motion.span initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ duration: 1, delay: i * 0.08, ease: EASE }} className="block h-full rounded-full" style={{ background: KC_COLORS[k] }} />
                  </div>
                  <p className="mt-1 text-[11.5px] text-ink/45">
                    {a?.dikuasai ?? 0} dari {data.students.length} mahasiswa sudah menguasai
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        <section data-tour="attention" className="flex flex-col rounded-[2rem] bg-teal-900 p-6 text-mint lg:col-span-3">
          <div className="flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
              <AlertTriangle className="size-4 text-terra-soft" /> Perlu perhatian
            </h2>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[12px]">{attention.length}</span>
          </div>
          {attention.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
              <CheckCircle2 className="size-9 text-leaf" />
              <p className="text-[14px] text-mint/75">Tidak ada mahasiswa yang ditandai.</p>
            </div>
          ) : (
            <ul className="mt-4 max-h-[340px] space-y-1.5 overflow-y-auto pr-1">
              {attention.slice(0, 12).map((s) => (
                <li key={s.sid}>
                  <Link to={`/dosen/mahasiswa/${s.sid}`} className="flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-white/8">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-600 to-sage text-[12px] font-semibold">
                      {s.nama
                        .split(/\s+/)
                        .filter((w) => /^[A-Za-z]/.test(w))
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join('')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13.5px] font-medium">{s.nama}</b>
                      <span className="block truncate text-[11.5px] text-mint/55">aktif {fmt.ago(s.last_active)}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {s.flags.map((f) => (
                          <span key={f} className="whitespace-nowrap rounded-full bg-terra/85 px-2 py-0.5 text-[10.5px]">
                            {f}
                          </span>
                        ))}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link to="/dosen/mahasiswa" className="mt-auto flex items-center gap-1 pt-4 text-[12.5px] text-leaf hover:underline">
            Semua mahasiswa <ArrowRight className="size-3.5" />
          </Link>
        </section>

        <section data-tour="errors" className="rounded-[2rem] card-surface p-6 lg:col-span-4 lg:row-span-1">
          <h2 className="text-[17px] font-semibold tracking-tight">Jenis kesalahan delineasi</h2>
          <p className="text-[12px] text-ink/50">Dari semua kasus yang dikirim</p>
          <ErrorDonut data={errs} />
        </section>

        <section data-tour="heat" className="min-w-0 rounded-[2rem] card-surface p-6 lg:col-span-8">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-semibold tracking-tight">Peta penguasaan KC per mahasiswa</h2>
            <span className="flex items-center gap-2 text-[11.5px] text-ink/50">
              rendah
              {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                <i key={p} className="size-3 rounded-sm" style={{ background: heat(p) }} />
              ))}
              tinggi
            </span>
          </div>
          <div className="legacy">
            <HeatTable data={data} />
          </div>
        </section>

        <section className="rounded-[2rem] card-surface p-6 lg:col-span-12">
          <h2 className="mb-4 text-[17px] font-semibold tracking-tight">Percobaan terbaru</h2>
          {data.recent.length === 0 ? (
            <Empty title="Belum ada percobaan">Hasil penilaian otomatis mahasiswa akan muncul di sini.</Empty>
          ) : (
            <div className="legacy">
              <RecentTable rows={data.recent} />
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
  { target: 'ring', title: 'Kapan kelas berlatih', body: 'Setiap cincin satu hari, setiap sektor satu jam. Makin tinggi balok, makin banyak kasus dikerjakan di jam itu. Seret untuk memutar.' },
  { target: 'skyline', title: 'Aktivitas setahun', body: 'Kasus dikirim per hari. Ganti ke tampilan datar dengan tombol di kanan atas.' },
  { target: 'kc', title: 'Penguasaan kelas', body: 'Rata-rata peluang penguasaan tiap KC dan berapa mahasiswa yang sudah melewati 95%.' },
  { target: 'attention', title: 'Mahasiswa yang perlu perhatian', body: 'Ditandai bila belum berlatih, tidak aktif lebih dari 7 hari, atau banyak jawaban salah. Klik nama untuk detailnya.' },
  { target: 'heat', title: 'Peta penguasaan', body: 'Satu baris per mahasiswa. Klik judul kolom untuk mengurutkan.' },
  { target: 'help', title: 'Selesai', body: 'Tekan Panduan kapan saja untuk memutar ulang.' },
];

const RING_PALETTE = { light: ['#d6e9cd', '#aad39c', '#5f9e86', '#195764'], dark: ['#1e4d3b', '#3f7d57', '#80a874', '#aad39c'] };
const SKY = { light: ['#d6e9cd', '#aad39c', '#80a874', '#195764'], dark: ['#1e4d3b', '#3f7d57', '#80a874', '#aad39c'] };
const EASE = [0.22, 1, 0.36, 1] as const;
const fmtKasus = (v: number) => `${v} kasus dimulai`;
const DONUT = ['#195764', '#80a874', '#ad7556', '#7a9cb3', '#dccfb8', '#53443d'];


/** Donat jenis kesalahan dengan legenda; arahkan kursor untuk menyorot satu jenis. */
function ErrorDonut({ data }: { data: [string, number][] }) {
  const [hi, setHi] = useState<number | null>(null);
  const total = data.reduce((a, [, n]) => a + n, 0);
  if (!total) return <Empty title="Belum ada data">Muncul setelah mahasiswa mengirim delineasi.</Empty>;
  const R = 54;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const top = hi ?? 0;
  return (
    <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row lg:flex-col">
      <div className="relative size-44 shrink-0">
        <svg viewBox="0 0 140 140" className="size-full -rotate-90">
          <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(16,49,58,.06)" strokeWidth="18" />
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
            <b className="block font-serif text-[1.56rem] leading-none">{Math.round((data[top][1] / total) * 100)}%</b>
            <span className="mx-auto mt-1 block max-w-[6.5rem] text-[10.5px] leading-tight text-ink/55">{data[top][0]}</span>
          </div>
        </div>
      </div>
      <ul className="w-full space-y-1.5">
        {data.map(([k, n], i) => (
          <li key={k} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} className={cn('flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-[12.5px] transition-colors', hi === i && 'bg-muslin')}>
            <i className="size-2.5 shrink-0 rounded-full" style={{ background: DONUT[i % DONUT.length] }} />
            <span className="flex-1 leading-snug text-ink/75">{k}</span>
            <b className="font-medium tabular-nums">{n}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecentTable({ rows }: { rows: Overview['recent'] }) {
  return (
    <div className="table-wrap">
      <table className="list">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Mahasiswa</th>
            <th>Kasus</th>
            <th>Sasaran</th>
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
              <td>
                <Link to={`/dosen/mahasiswa/${r.sid}`}>{r.nama}</Link>
              </td>
              <td className="mono">{r.case_id}</td>
              <td>{r.target_kc}</td>
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
                <Link to={`/dosen/percobaan/${r.id}`} className="small">
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

function HeatTable({ data, filter = '' }: { data: Overview; filter?: string }) {
  const [sort, setSort] = useState<string>('nama');
  const rows = useMemo(() => {
    const f = filter.toLowerCase();
    const r = data.students.filter((s) => !f || s.nama.toLowerCase().includes(f) || s.sid.toLowerCase().includes(f));
    const val = (s: Overview['students'][number]) =>
      sort === 'nama' ? s.nama.toLowerCase() : sort === 'kasus' ? -s.n_kasus : sort === 'aktif' ? -s.last_active : s.mastery[sort]?.p ?? 0.2;
    return [...r].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0));
  }, [data, filter, sort]);
  const th = (k: string, label: string, title?: string) => (
    <th key={k} title={title}>
      <button className={`sort ${sort === k ? 'on' : ''}`} onClick={() => setSort(k)}>
        {label}
      </button>
    </th>
  );
  if (!data.students.length) return <Empty title="Belum ada mahasiswa">Bagikan kode kelas dari menu Kelas.</Empty>;
  return (
    <div className="table-wrap">
      <table className="heat">
        <thead>
          <tr>
            {th('nama', 'Mahasiswa')}
            <th>Kelas</th>
            {th('kasus', 'Kasus')}
            <th>Dice</th>
            <th>Modul</th>
            {ACTIVE.map((k) => th(k, k, data.kc[k]))}
            {th('aktif', 'Terakhir aktif')}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.sid}>
              <td>
                <Link to={`/dosen/mahasiswa/${s.sid}`}>{s.nama}</Link>
                <span className="mono muted small"> {s.sid}</span>
              </td>
              <td className="small">{s.kelas}</td>
              <td>{s.n_kasus}</td>
              <td>{s.mean_dice === null ? '—' : fmt.num(s.mean_dice)}</td>
              <td>
                {s.modul_selesai}/{LESSONS.length}
              </td>
              {ACTIVE.map((k) => (
                <td key={k} className="hc" style={{ background: heat(s.mastery[k]?.p) }} title={`${data.kc[k]}: ${s.mastery[k]?.n ?? 0} observasi`}>
                  {s.mastery[k] ? Math.round(s.mastery[k].p * 100) : '·'}
                </td>
              ))}
              <td className="small nowrap">{fmt.ago(s.last_active)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Mahasiswa() {
  const { data, err, kelas, setKelas } = useOverview();
  const [q, setQ] = useState('');
  return (
    <Page
      wide
      title="Mahasiswa"
      sub="Klik nama untuk melihat lintasan penguasaan, riwayat kasus, dan percakapan tutor setiap mahasiswa."
      actions={
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau pseudonim" aria-label="Cari mahasiswa" />
          {data && <KelasSelect kelas={kelas} setKelas={setKelas} options={data.kelas} />}
        </>
      }
    >
      {err && <p className="error">{err}</p>}
      {!data ? (
        <Loading />
      ) : (
        <section className="card">
          <HeatTable data={data} filter={q} />
          <p className="small muted">Klik judul kolom untuk mengurutkan. Warna: merah = penguasaan rendah, hijau = tinggi. Angka = peluang menguasai KC (%).</p>
        </section>
      )}
    </Page>
  );
}

export function DetailMahasiswa() {
  const { sid = '' } = useParams();
  const [d, setD] = useState<StudentDetail | null>(null);
  const [err, setErr] = useState('');
  const [pw, setPw] = useState('');
  const [tab, setTab] = useState<'kasus' | 'tutor' | 'modul' | 'tugas'>('kasus');
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
  return (
    <Page
      wide
      title={s.nama}
      sub={
        <>
          <span className="mono">{s.id}</span> · {JENJANG[s.jenjang ?? ''] ?? '—'} · {s.kelas?.nama ?? 'tanpa kelas'} · bergabung {fmt.date(s.created_at)} · terakhir aktif {fmt.ago(s.last_seen)}
        </>
      }
      actions={
        <>
          <Link to="/dosen/mahasiswa" className="btn small">
            ← Daftar mahasiswa
          </Link>
          <button className="btn small" onClick={reset}>
            Atur ulang kata sandi
          </button>
          <button className="btn small danger" onClick={remove}>
            Keluarkan dari kelas
          </button>
        </>
      }
    >
      {pw && (
        <section className="card notice">
          <div>
            <b>Kata sandi sementara: <span className="mono big">{pw}</span></b>
            <p className="muted small">Sampaikan langsung kepada mahasiswa dan minta ia menggantinya di halaman Profil. Kata sandi ini tidak ditampilkan lagi.</p>
          </div>
        </section>
      )}
      <div className="kpis">
        <div className="kpi">
          <b>{d.attempts.length}</b>
          <span>kasus dikerjakan</span>
        </div>
        <div className="kpi">
          <b>{dices.length ? fmt.num(dices.reduce((a, b) => a + b, 0) / dices.length) : '—'}</b>
          <span>rerata Dice</span>
        </div>
        <div className="kpi">
          <b>
            {Object.values(d.lessons).filter((l) => l.completed).length}
            <small>/{LESSONS.length}</small>
          </b>
          <span>modul selesai</span>
        </div>
        <div className="kpi">
          <b>{d.tutor_logs.length}</b>
          <span>pertanyaan ke tutor</span>
        </div>
      </div>
      <div className="grid2">
        <section className="card">
          <h2>Penguasaan saat ini</h2>
          <MasteryBars kc={d.kc} before={d.mastery} />
        </section>
        <section className="card">
          <h2>Lintasan penguasaan</h2>
          {d.trajectory.length === 0 ? <p className="muted small">Belum ada kasus yang dikirim.</p> : <Trajectory points={d.trajectory} kcs={ACTIVE} names={Object.fromEntries(Object.entries(d.kc).map(([k, v]) => [k, v.nama]))} />}
        </section>
      </div>
      <div className="grid2">
        <section className="card">
          <h2>Jenis kesalahan delineasi</h2>
          <div className="tw !bg-transparent">
            <ErrorDonut data={errs} />
          </div>
        </section>
        <div className="tw !bg-transparent">
          <StudentRing attempts={d.attempts} />
        </div>
      </div>

      <div className="tabs" role="tablist">
        {(
          [
            ['kasus', `Riwayat kasus (${d.attempts.length})`],
            ['tutor', `Log tutor (${d.tutor_logs.length})`],
            ['modul', 'Modul belajar'],
            ['tugas', `Tugas (${d.assignments.length})`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      <section className="card">
        {tab === 'kasus' && (d.attempts.length ? <AttemptTable rows={d.attempts} base="/dosen/percobaan" /> : <Empty title="Belum ada kasus" />)}
        {tab === 'tutor' &&
          (d.tutor_logs.length ? (
            <ul className="logs">
              {d.tutor_logs.map((t) => (
                <li key={t.id} className={t.issues.length ? 'flag' : ''}>
                  <div className="log-meta">
                    {fmt.dateTime(t.created_at)} · <Link to={`/dosen/percobaan/${t.attempt_id}`}>{t.case_id}</Link> · {t.mode} · {t.phase === 'sebelum_submit' ? 'sebelum kirim' : 'sesudah kirim'} · {t.source === 'llm' ? t.model : t.source}
                  </div>
                  <p>
                    <b>Mahasiswa:</b> {t.message}
                  </p>
                  <p>
                    <b>Tutor:</b> {t.response}
                  </p>
                  {t.issues.length > 0 && <p className="warn">Pemeriksa fakta: {t.issues.join('; ')}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Belum ada percakapan tutor" />
          ))}
        {tab === 'modul' && (
          <table className="list">
            <thead>
              <tr>
                <th>Modul</th>
                <th>Status</th>
                <th>Kuis terbaik</th>
                <th>Percobaan kuis</th>
              </tr>
            </thead>
            <tbody>
              {LESSONS.map((l) => {
                const st = d.lessons[l.id];
                return (
                  <tr key={l.id}>
                    <td>{l.judul}</td>
                    <td>{st?.completed ? <span className="pill ok">selesai</span> : st ? 'dibuka' : <span className="muted">belum</span>}</td>
                    <td>{st?.n_tries ? fmt.pct(st.best_score) : '—'}</td>
                    <td>{st?.n_tries ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {tab === 'tugas' &&
          (d.assignments.length ? (
            <ul className="task-list">
              {d.assignments.map((t) => (
                <li key={t.id}>
                  <div>
                    <b>{t.judul}</b>
                    <span className="muted small">
                      {' '}
                      {t.selesai}/{t.total} selesai{t.due_at ? ` · tenggat ${fmt.dateTime(t.due_at)}` : ''}
                    </span>
                    <span className="progress">
                      <i style={{ width: `${(t.selesai / Math.max(1, t.total)) * 100}%` }} />
                    </span>
                    <span className="small muted">
                      Belum: {[...t.lesson_ids.filter((l) => !t.lessons_done.includes(l)).map((l) => lessonById(l)?.kc ?? l), ...t.case_ids.filter((c) => !t.cases_done.includes(c))].join(', ') || '—'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Tidak ada tugas untuk kelas ini" />
          ))}
      </section>
    </Page>
  );
}

function StudentRing({ attempts }: { attempts: StudentDetail['attempts'] }) {
  const ring = useMemo(() => weekHourGrid(attempts.map((a) => [a.started_at || a.submitted_at, a.submitted_at] as Session)), [attempts]);
  return (
    <CirculariumRing
      className="h-full !rounded-[22px] !border-[#e2dccd] !shadow-none"
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
