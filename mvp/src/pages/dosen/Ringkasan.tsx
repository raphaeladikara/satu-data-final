import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmt, JENJANG, type Overview, type StudentDetail } from '../../api';
import { ActivityBars, HBars, Trajectory, heat } from '../../components/Charts';
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

  if (err) return <Page title="Ringkasan kelas"><p className="error">{err}</p></Page>;
  if (!data) return <Page title="Ringkasan kelas"><Loading /></Page>;
  if (data.kelas.length === 0)
    return (
      <Page title="Selamat datang di dasbor dosen">
        <section className="card next-step">
          <p className="eyebrow">Langkah pertama</p>
          <h2>Buat kelas dan bagikan kodenya</h2>
          <p className="muted">Mahasiswa memasukkan kode kelas saat mendaftar atau di halaman Profil. Setelah itu progres mereka muncul di sini.</p>
          <Link to="/dosen/kelas" className="btn primary">
            Buat kelas
          </Link>
        </section>
      </Page>
    );

  const attention = data.students.filter((s) => s.flags.length);
  const errs = Object.entries(data.error_counts).sort((a, b) => b[1] - a[1]);
  const doExport = async (j: 'penguasaan' | 'percobaan') => {
    setExporting(j);
    try {
      await api.exportCsv(j, kelas);
    } finally {
      setExporting('');
    }
  };

  return (
    <Page
      wide
      title="Ringkasan kelas"
      sub={`${data.students.length} mahasiswa di ${kelas ? data.kelas.find((k) => k.id === kelas)?.nama : `${data.kelas.length} kelas`}`}
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
    >
      <div className="kpis">
        <div className="kpi">
          <b>
            {data.active_7d}
            <small>/{data.students.length}</small>
          </b>
          <span>mahasiswa aktif 7 hari terakhir</span>
        </div>
        <div className="kpi">
          <b>{data.n_attempts}</b>
          <span>kasus dikerjakan</span>
        </div>
        <div className="kpi">
          <b>{data.mean_dice === null ? '—' : fmt.num(data.mean_dice)}</b>
          <span>rerata Dice delineasi</span>
        </div>
        <div className="kpi">
          <b>
            {data.flagged_tutor}
            <small>/{data.n_tutor}</small>
          </b>
          <span>respons tutor ditandai pemeriksa fakta</span>
        </div>
      </div>

      <div className="grid3">
        <section className="card">
          <h2>Penguasaan rata-rata kelas</h2>
          <ul className="kc-avg">
            {ACTIVE.map((k) => {
              const a = data.kc_avg[k];
              return (
                <li key={k}>
                  <span className="kc">{k}</span>
                  <span className="name">{data.kc[k]}</span>
                  <span className="bar">
                    <i style={{ width: `${Math.round((a?.mean ?? 0) * 100)}%` }} />
                  </span>
                  <span className="pct">{a?.mean === null || !a ? '—' : fmt.pct(a.mean)}</span>
                  <span className="muted small">{a?.dikuasai ?? 0} dikuasai</span>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="card">
          <h2>Jenis kesalahan delineasi tersering</h2>
          <HBars data={errs} />
        </section>
        <section className="card">
          <h2>Aktivitas 14 hari terakhir</h2>
          <ActivityBars days={data.activity} />
          <p className="small muted">Jumlah kasus yang dikirim per hari.</p>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Perlu perhatian ({attention.length})</h2>
          <Link to="/dosen/mahasiswa" className="small">
            Semua mahasiswa
          </Link>
        </div>
        {attention.length === 0 ? (
          <p className="muted small">Tidak ada mahasiswa yang ditandai.</p>
        ) : (
          <ul className="attention">
            {attention.slice(0, 12).map((s) => (
              <li key={s.sid}>
                <Link to={`/dosen/mahasiswa/${s.sid}`}>
                  <b>{s.nama}</b>
                  <span className="muted small">
                    {s.kelas} · aktif {fmt.ago(s.last_active)}
                  </span>
                  <span>
                    {s.flags.map((f) => (
                      <span key={f} className="pill bad">
                        {f}
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Peta penguasaan KC</h2>
        <HeatTable data={data} />
      </section>

      <section className="card">
        <h2>Percobaan terbaru</h2>
        {data.recent.length === 0 ? (
          <Empty title="Belum ada percobaan">Hasil penilaian otomatis mahasiswa akan muncul di sini.</Empty>
        ) : (
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
                {data.recent.map((r) => (
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
        )}
      </section>
      <p className="small muted">Basis data: {data.db}. Nilai penguasaan = peluang menguasai KC menurut BKT; dikuasai bila ≥ 95%.</p>
    </Page>
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
      <section className="card">
        <h2>Jenis kesalahan delineasi</h2>
        <HBars data={errs} />
      </section>

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
