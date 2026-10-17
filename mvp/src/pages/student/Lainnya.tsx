import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fmt, JENJANG, type Assignment, type AttemptDetail, type CaseRow, type KCInfo, type Me } from '../../api';
import { useAuth } from '../../auth';
import JoinClass from '../../components/JoinClass';
import ReadViewer from '../../components/ReadViewer';
import { Empty, Loading, Page } from '../../components/Shell';
import { lessonById } from '../../content/lessons';
import { AttemptTable } from './Beranda';

// --- tugas -------------------------------------------------------------------

export function Tugas() {
  const { user } = useAuth();
  const [list, setList] = useState<Assignment[] | null>(null);
  useEffect(() => {
    api.assignments().then(setList).catch(() => setList([]));
  }, []);
  const now = Date.now() / 1000;
  return (
    <Page title="Tugas" sub={user?.kelas ? `Dari ${user.kelas.dosen ?? 'dosen'} untuk ${user.kelas.nama}` : 'Tugas dari dosen pengampu kelasmu.'}>
      {!user?.kelas ? (
        <section className="card notice">
          <div>
            <b>Kamu belum bergabung ke kelas</b>
            <p className="muted small">Minta kode kelas kepada dosenmu.</p>
          </div>
          <JoinClass onJoined={() => api.assignments().then(setList)} />
        </section>
      ) : !list ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty title="Belum ada tugas">Dosen belum memberi tugas untuk kelas ini. Sementara itu, lanjutkan latihan adaptif.</Empty>
      ) : (
        <div className="tasks">
          {list.map((t) => {
            const late = t.due_at && t.due_at < now && !t.tuntas;
            return (
              <section key={t.id} className={`card task ${t.tuntas ? 'done' : ''}`}>
                <div className="card-head">
                  <h2>{t.judul}</h2>
                  <span className={`pill ${t.tuntas ? 'ok' : late ? 'bad' : ''}`}>{t.tuntas ? 'Tuntas' : late ? 'Lewat tenggat' : `${t.selesai}/${t.total} selesai`}</span>
                </div>
                <p className="muted small">
                  Diberikan {fmt.date(t.created_at)}
                  {t.due_at ? ` · tenggat ${fmt.dateTime(t.due_at)}` : ''}
                </p>
                {t.catatan && <p>{t.catatan}</p>}
                <span className="progress">
                  <i style={{ width: `${(t.selesai / Math.max(1, t.total)) * 100}%` }} />
                </span>
                <ul className="task-items">
                  {t.lesson_ids.map((l) => (
                    <li key={l} className={t.lessons_done.includes(l) ? 'ok' : ''}>
                      <span className="tag">modul</span>
                      <Link to={`/belajar/${l}`}>{lessonById(l)?.judul ?? l}</Link>
                    </li>
                  ))}
                  {t.case_ids.map((c) => (
                    <li key={c} className={t.cases_done.includes(c) ? 'ok' : ''}>
                      <span className="tag">kasus</span>
                      {t.cases_done.includes(c) ? <span className="mono">{c}</span> : <Link to={`/latihan?kasus=${c}`} className="mono">{c}</Link>}
                    </li>
                  ))}
                </ul>
                <p className="small muted">Kasus dihitung selesai bila jawabannya dikirim setelah tugas diberikan; modul dihitung selesai bila kuisnya lulus.</p>
              </section>
            );
          })}
        </div>
      )}
    </Page>
  );
}

// --- riwayat -----------------------------------------------------------------

export function Riwayat() {
  const [me, setMe] = useState<Me | null>(null);
  const [kc, setKc] = useState('');
  useEffect(() => {
    api.me().then(setMe);
  }, []);
  const rows = me?.attempts.filter((a) => !kc || a.kc[kc] !== undefined) ?? [];
  return (
    <Page
      title="Riwayat latihan"
      sub="Semua kasus yang sudah kamu kirim. Buka satu percobaan untuk melihat anotasimu di atas kunci jawaban."
      actions={
        <select value={kc} onChange={(e) => setKc(e.target.value)} aria-label="Saring KC">
          <option value="">Semua KC</option>
          {['K1', 'K2', 'K3', 'K6'].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      }
    >
      {!me ? <Loading /> : rows.length === 0 ? <Empty title="Belum ada percobaan">Kerjakan kasus di menu Latihan.</Empty> : <section className="card"><AttemptTable rows={rows} /></section>}
    </Page>
  );
}

// --- tinjau ulang (mahasiswa & dosen) -------------------------------------------

export function Tinjau({ back = '/riwayat' }: { back?: string }) {
  const { id = '' } = useParams();
  const [d, setD] = useState<AttemptDetail | null>(null);
  const [kc, setKc] = useState<Record<string, KCInfo>>({});
  const [err, setErr] = useState('');
  const [jump, setJump] = useState<[number, number, number] | null>(null);
  useEffect(() => {
    api.attempt(Number(id)).then(setD).catch((e) => setErr(e.message));
    api.kc().then((r) => setKc(r.kc));
  }, [id]);

  if (err) return <Page title="Tinjau percobaan"><p className="error">{err}</p><Link to={back}>Kembali</Link></Page>;
  if (!d) return <Page title="Tinjau percobaan"><Loading /></Page>;
  const dl = d.delineasi;
  const missed = dl?.fokus.filter((f) => !f.tersentuh) ?? [];
  return (
    <Page
      wide
      title={`Percobaan #${d.attempt_id} · SOOP ${d.case.id}`}
      sub={
        <>
          {d.case.vignette.jenis_kelamin}, {d.case.vignette.usia ?? '?'} th · NIHSS {d.case.vignette.nihss ?? '?'} · <span className={`tier tier-${d.tier}`}>{d.tier}</span> · sasaran{' '}
          {d.target_kc === 'bebas' ? 'pilihan sendiri' : d.target_kc} · dikirim {fmt.dateTime(d.submitted_at)} · durasi {Math.max(1, Math.round((d.submitted_at - d.started_at) / 60))} menit
        </>
      }
      actions={
        <Link to={back} className="btn small">
          ← Kembali
        </Link>
      }
    >
      <div className="review-grid">
        <ReadViewer
          geom={d.case}
          series={d.series}
          names={d.seq_order}
          masks={{ jawaban: d.mask_rle, kunci: d.gt_rle, model: d.pred_rle }}
          initialVisible={{ jawaban: true, kunci: true, model: false }}
          initialSeries={Math.max(0, d.series.findIndex((s) => d.seq_order[s.label] === 'DWI'))}
          jumpTo={jump ?? (d.findings.fokus[0] ? (d.findings.fokus[0].pusat_voxel.map(Math.round) as [number, number, number]) : null)}
          height={520}
        />
        <aside className="review-side">
          {!d.mask_rle && <p className="small warn">Anotasi percobaan lama ini tidak tersimpan; hanya kunci dan model yang ditampilkan.</p>}
          {dl && (
            <section className="card">
              <h2>Delineasi (K6)</h2>
              <div className="metrics">
                <Metric label="Dice" value={fmt.num(dl.dice)} good={dl.dice >= 0.6} />
                <Metric label="Lesi ditemukan" value={`${dl.fokus.length - missed.length} dari ${dl.fokus.length}`} good={!missed.length} />
                <Metric label="Galat volume" value={`${dl.vol_err > 0 ? '+' : ''}${Math.round(dl.vol_err * 100)}%`} good={Math.abs(dl.vol_err) <= 0.15} />
                <Metric label="HD95" value={dl.hd95 === null ? '—' : `${fmt.num(dl.hd95, 1)} mm`} good={(dl.hd95 ?? 99) <= 5} />
              </div>
              <p className="etype">
                Jenis kesalahan: <b>{dl.jenis_kesalahan_label}</b>
              </p>
              {missed.length > 0 && (
                <div className="missed">
                  <h3>Fokus yang terlewat</h3>
                  {missed.slice(0, 8).map((f, i) => (
                    <button key={i} className="chip" onClick={() => setJump(f.pusat_voxel.map(Math.round) as [number, number, number])}>
                      {fmt.num(f.ml)} ml · slice {f.slice_terbesar}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
          <section className="card">
            <h2>Jawaban per KC</h2>
            <ul className="kc-results">
              {Object.entries(d.kc).map(([k, r]) => (
                <li key={k} className={r.benar ? 'ok' : 'bad'}>
                  <b>{k}</b> {kc[k]?.nama}: {r.benar ? 'benar' : 'belum tepat'}
                  {k === 'K1' && !r.benar && <span className="muted"> (kunci: {Object.entries(d.seq_order).map(([l, n]) => `${l}=${n}`).join(', ')})</span>}
                  {k === 'K2' && <span className="muted"> (jawaban {String(r.jawaban_hemisfer ?? '—')}, kunci {String(r.kunci_hemisfer)}{r.titik_di_lesi ? '' : ', titik di luar lesi'})</span>}
                  {k === 'K3' && <span className="muted"> (jawaban {String(r.jawaban_rentang ?? '—')}, rADC lesi {fmt.num(Number(r.adc_relatif_lesi))})</span>}
                </li>
              ))}
            </ul>
            <p className="small muted">
              Temuan: {d.findings.jumlah_fokus} fokus, {fmt.num(d.findings.volume_ml, 1)} ml ({d.findings.kategori_volume}), hemisfer {d.findings.hemisfer}. Luaran: Rankin pulang{' '}
              {d.luaran?.rankin_pulang ?? 'tidak tercatat'}, etiologi {d.luaran?.etiologi ?? 'tidak tercatat'}.
            </p>
          </section>
          <section className="card">
            <h2>Percakapan tutor ({d.tutor.length})</h2>
            {d.tutor.length === 0 ? (
              <p className="muted small">Tidak ada pertanyaan ke tutor pada percobaan ini.</p>
            ) : (
              <ul className="logs compact">
                {d.tutor.map((t, i) => (
                  <li key={i} className={t.issues.length ? 'flag' : ''}>
                    <div className="log-meta">
                      {t.mode} · {t.phase === 'sebelum_submit' ? 'sebelum kirim' : 'sesudah kirim'} · {t.source === 'llm' ? t.model : t.source}
                    </div>
                    <p>
                      <b>Mahasiswa:</b> {t.message}
                    </p>
                    <p>
                      <b>Tutor:</b> {t.response}
                    </p>
                    {t.issues.length > 0 && <p className="warn small">Pemeriksa fakta: {t.issues.join('; ')}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </Page>
  );
}

function Metric(p: { label: string; value: string; good: boolean }) {
  return (
    <div className={`metric ${p.good ? 'good' : 'bad'}`}>
      <span>{p.label}</span>
      <b>{p.value}</b>
    </div>
  );
}

// --- bank kasus --------------------------------------------------------------

const TIERS = ['mudah', 'sedang', 'sulit'];

export function Kasus() {
  const nav = useNavigate();
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [hide, setHide] = useState(false);
  useEffect(() => {
    api.cases().then(setCases);
  }, []);
  const list = (cases ?? []).filter((c) => !hide || !c.dikerjakan);
  return (
    <Page
      title="Bank kasus"
      sub={`${cases?.length ?? '…'} kasus latihan dari SOOP. Tingkat kesulitan memakai tersil indeks D = −log₁₀ V + log₂ F dari seluruh 1.451 lesion mask akut. Kasus yang dipilih sendiri tetap memperbarui penguasaanmu.`}
      actions={
        <label className="small check">
          <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} /> Sembunyikan yang sudah dikerjakan
        </label>
      }
    >
      {!cases ? (
        <Loading />
      ) : (
        <div className="tiers">
          {TIERS.map((t) => (
            <section key={t} className="card">
              <h2>
                <span className={`tier tier-${t}`}>{t}</span> {list.filter((c) => c.tier === t).length} kasus
              </h2>
              <ul className="case-list">
                {list
                  .filter((c) => c.tier === t)
                  .sort((a, b) => a.D - b.D)
                  .map((c) => (
                    <li key={c.id}>
                      <button onClick={() => nav(`/latihan?kasus=${c.id}`)} className={c.dikerjakan ? 'done' : ''}>
                        <b className="mono">{c.id}</b>
                        <span>
                          {c.vignette.jenis_kelamin}, {c.vignette.usia ?? '?'} th · NIHSS {c.vignette.nihss ?? '?'}
                        </span>
                        <span className="mono muted">{c.dikerjakan ? `✓ Dice ${c.dice === null ? '—' : fmt.num(c.dice)}` : `D ${fmt.num(c.D)}`}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}

// --- profil ------------------------------------------------------------------

export function Profil() {
  const { user, setUser, signIn } = useAuth();
  const [nama, setNama] = useState(user?.nama ?? '');
  const [jenjang, setJenjang] = useState(user?.jenjang ?? 'klinik');
  const [msg, setMsg] = useState('');
  const [pw, setPw] = useState({ lama: '', baru: '', ulang: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  if (!user) return null;
  return (
    <Page title="Profil & akun">
      <div className="grid2">
        <section className="card">
          <h2>Data diri</h2>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setUser(await api.updateProfile({ nama, jenjang: user.role === 'mahasiswa' ? jenjang : undefined }));
              setMsg('Tersimpan.');
            }}
          >
            <label>
              Nama
              <input value={nama} onChange={(e) => setNama(e.target.value)} minLength={2} required />
            </label>
            {user.role === 'mahasiswa' && (
              <label>
                Jenjang
                <select value={jenjang} onChange={(e) => setJenjang(e.target.value)}>
                  {Object.entries(JENJANG).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="row">
              <span className="lbl">{user.role === 'dosen' ? 'Username' : 'Pseudonim'}</span>
              <span className="mono">{user.role === 'dosen' ? user.username : user.id}</span>
            </div>
            {user.role === 'mahasiswa' && <p className="small muted">NIM tidak disimpan. Pseudonim di atas adalah hash NIM yang dipakai di seluruh log belajar.</p>}
            <button className="btn primary">Simpan</button>
            {msg && <span className="ok-text small">{msg}</span>}
          </form>
        </section>

        <section className="card">
          <h2>Ganti kata sandi</h2>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setPwErr('');
              setPwMsg('');
              if (pw.baru !== pw.ulang) return setPwErr('Konfirmasi kata sandi tidak sama');
              try {
                const r = await api.changePassword(pw.lama, pw.baru);
                signIn(r.token, user);
                setPw({ lama: '', baru: '', ulang: '' });
                setPwMsg('Kata sandi diganti. Sesi di perangkat lain otomatis keluar.');
              } catch (e) {
                setPwErr((e as Error).message);
              }
            }}
          >
            <label>
              Kata sandi lama
              <input type="password" value={pw.lama} onChange={(e) => setPw({ ...pw, lama: e.target.value })} required autoComplete="current-password" />
            </label>
            <label>
              Kata sandi baru
              <input type="password" value={pw.baru} onChange={(e) => setPw({ ...pw, baru: e.target.value })} required minLength={6} autoComplete="new-password" />
            </label>
            <label>
              Ulangi kata sandi baru
              <input type="password" value={pw.ulang} onChange={(e) => setPw({ ...pw, ulang: e.target.value })} required minLength={6} autoComplete="new-password" />
            </label>
            {pwErr && <p className="error">{pwErr}</p>}
            {pwMsg && <p className="ok-text small">{pwMsg}</p>}
            <button className="btn">Ganti kata sandi</button>
          </form>
        </section>

        {user.role === 'mahasiswa' && (
          <section className="card">
            <h2>Kelas</h2>
            {user.kelas ? (
              <>
                <p>
                  <b>{user.kelas.nama}</b> · dosen {user.kelas.dosen ?? '—'} · kode <span className="mono">{user.kelas.kode}</span>
                </p>
                <p className="small muted">Pindah kelas dengan memasukkan kode kelas lain. Riwayat latihanmu tetap ikut.</p>
              </>
            ) : (
              <p className="muted small">Belum bergabung ke kelas.</p>
            )}
            <JoinClass />
          </section>
        )}
      </div>
    </Page>
  );
}
