import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, fmt, JENJANG, type Me } from '../../api';
import { useAuth } from '../../auth';
import MasteryBars from '../../components/MasteryBars';
import { Empty, Loading, Page } from '../../components/Shell';
import { LESSONS, lessonById } from '../../content/lessons';
import JoinClass from '../../components/JoinClass';

export default function Beranda() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState('');
  const load = () => api.me().then(setMe).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  if (err) return <Page title="Beranda"><p className="error">{err}</p></Page>;
  if (!me) return <Page title="Beranda"><Loading /></Page>;

  const first = user?.nama.split(' ')[0] ?? '';
  const isNew = params.get('baru') === '1' || me.ringkas.n_kasus === 0;
  const orientDone = me.lessons.orientasi?.completed;
  const rec = me.rekomendasi;
  const recLesson = rec.lesson ? lessonById(rec.lesson) : null;
  const recLessonDone = rec.lesson ? me.lessons[rec.lesson]?.completed : true;
  const open = me.assignments.filter((t) => !t.tuntas);
  const doneLessons = LESSONS.filter((l) => me.lessons[l.id]?.completed).length;

  return (
    <Page
      title={`Halo, ${first}`}
      sub={
        <>
          {JENJANG[me.user.jenjang ?? ''] ?? 'Mahasiswa'} · {me.user.kelas ? `${me.user.kelas.nama} (dosen: ${me.user.kelas.dosen ?? '—'})` : 'belum bergabung ke kelas'} ·{' '}
          <span className="mono">{me.user.id}</span>
        </>
      }
    >
      {!me.user.kelas && (
        <section className="card notice">
          <div>
            <b>Gabung ke kelas dosenmu</b>
            <p className="muted small">Masukkan kode kelas supaya dosen bisa memantau progres dan memberi tugas.</p>
          </div>
          <JoinClass onJoined={load} />
        </section>
      )}

      <section className="next-step card">
        <p className="eyebrow">Langkah berikutnya</p>
        {isNew && !orientDone ? (
          <>
            <h2>Mulai dari modul orientasi</h2>
            <p className="muted">Enam menit untuk mengenal tiga sekuens MRI, konvensi orientasi radiologis, dan cara memakai viewer.</p>
            <div className="row-btns">
              <Link className="btn primary" to="/belajar/orientasi">
                Buka modul orientasi
              </Link>
              <Link className="btn" to="/latihan">
                Langsung latihan
              </Link>
            </div>
          </>
        ) : recLesson && !recLessonDone ? (
          <>
            <h2>
              Pelajari {rec.kc} · {rec.nama}
            </h2>
            <p className="muted">
              Ini kompetensi terlemahmu (peluang penguasaan {fmt.pct(rec.p)}). Baca modulnya dulu, lalu latih dengan kasus yang dipilih untukmu.
            </p>
            <div className="row-btns">
              <Link className="btn primary" to={`/belajar/${recLesson.id}`}>
                Buka modul {rec.kc}
              </Link>
              <Link className="btn" to="/latihan">
                Latihan adaptif
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2>Lanjutkan latihan adaptif</h2>
            <p className="muted">
              Sistem akan memilih kasus untuk {rec.kc} {rec.nama} (penguasaan {fmt.pct(rec.p)}).
            </p>
            <div className="row-btns">
              <Link className="btn primary" to="/latihan">
                Kerjakan kasus berikutnya
              </Link>
              <Link className="btn" to={`/latihan?kc=${rec.kc}`}>
                Latih {rec.kc} saja
              </Link>
            </div>
          </>
        )}
      </section>

      <div className="kpis">
        <div className="kpi">
          <b>{me.ringkas.n_kasus}</b>
          <span>kasus dikerjakan</span>
        </div>
        <div className="kpi">
          <b>{me.ringkas.mean_dice === null ? '—' : fmt.num(me.ringkas.mean_dice)}</b>
          <span>rerata Dice delineasi</span>
        </div>
        <div className="kpi">
          <b>
            {me.ringkas.kc_dikuasai}
            <small>/4</small>
          </b>
          <span>KC dikuasai (≥ 95%)</span>
        </div>
        <div className="kpi">
          <b>
            {doneLessons}
            <small>/{LESSONS.length}</small>
          </b>
          <span>modul selesai</span>
        </div>
      </div>

      <div className="grid2">
        <section className="card">
          <div className="card-head">
            <h2>Penguasaan kompetensi</h2>
            <span className="muted small">Bayesian Knowledge Tracing</span>
          </div>
          <MasteryBars kc={me.kc} before={me.mastery} />
          <p className="small muted">
            Batang menunjukkan peluang kamu sudah menguasai KC tersebut. Prasyarat: K1 → K2 → K3/K6. KC yang prasyaratnya belum dikuasai belum dipilih otomatis.
          </p>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Tugas aktif</h2>
            <Link to="/tugas" className="small">
              Semua tugas
            </Link>
          </div>
          {!me.user.kelas ? (
            <Empty title="Belum ada kelas">Tugas muncul setelah kamu bergabung ke kelas.</Empty>
          ) : open.length === 0 ? (
            <Empty title="Tidak ada tugas yang tertunda">Semua tugas sudah tuntas.</Empty>
          ) : (
            <ul className="task-list">
              {open.slice(0, 4).map((t) => (
                <li key={t.id}>
                  <Link to="/tugas">
                    <b>{t.judul}</b>
                    <span className="muted small">
                      {t.selesai}/{t.total} selesai{t.due_at ? ` · tenggat ${fmt.dateTime(t.due_at)}` : ''}
                      {t.due_at && t.due_at < Date.now() / 1000 && <em className="late"> · lewat tenggat</em>}
                    </span>
                    <span className="progress">
                      <i style={{ width: `${(t.selesai / Math.max(1, t.total)) * 100}%` }} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Percobaan terakhir</h2>
          <Link to="/riwayat" className="small">
            Riwayat lengkap
          </Link>
        </div>
        {me.attempts.length === 0 ? (
          <Empty title="Belum ada kasus yang dikirim">Hasil penilaian otomatis akan muncul di sini.</Empty>
        ) : (
          <AttemptTable rows={me.attempts.slice(0, 5)} />
        )}
      </section>
    </Page>
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
