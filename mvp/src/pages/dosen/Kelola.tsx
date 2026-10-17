import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, fmt, type DosenAssignment, type DosenCase, type Kelas, type TutorLog } from '../../api';
import ReadViewer from '../../components/ReadViewer';
import { Empty, Loading, Page } from '../../components/Shell';
import { LESSONS, lessonById } from '../../content/lessons';
import { KelasSelect, useKelasFilter } from './Ringkasan';

// --- kelas -------------------------------------------------------------------

export function KelasPage() {
  const [params] = useSearchParams();
  const [list, setList] = useState<Kelas[] | null>(null);
  const [nama, setNama] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');
  const load = () => api.classes().then(setList);
  useEffect(() => {
    load();
  }, []);
  const link = (k: Kelas) => `${location.origin}/daftar?kelas=${k.kode}`;
  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      /* clipboard diblokir */
    }
  };
  return (
    <Page title="Kelas" sub="Buat kelas, lalu bagikan kode atau tautan pendaftarannya kepada mahasiswa. Anda hanya melihat mahasiswa di kelas Anda sendiri.">
      {params.get('baru') && list?.length === 0 && (
        <section className="card notice">
          <div>
            <b>Akun dosen siap.</b>
            <p className="muted small">Buat kelas pertama Anda, misalnya “Blok Neurologi 2026 – Kelompok A”.</p>
          </div>
        </section>
      )}
      <section className="card">
        <h2>Kelas baru</h2>
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr('');
            try {
              await api.createClass(nama);
              setNama('');
              load();
            } catch (e) {
              setErr((e as Error).message);
            }
          }}
        >
          <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama kelas" aria-label="Nama kelas" required minLength={2} />
          <button className="btn primary">Buat kelas</button>
          {err && <span className="error small">{err}</span>}
        </form>
      </section>
      {!list ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty title="Belum ada kelas" />
      ) : (
        <div className="class-grid">
          {list.map((k) => (
            <section key={k.id} className="card class-card">
              <div className="card-head">
                <h2>{k.nama}</h2>
                <span className="muted small">{k.n_mahasiswa} mahasiswa</span>
              </div>
              <div className="code-box">
                <span className="muted small">Kode kelas</span>
                <b className="mono">{k.kode}</b>
                <button className="btn small" onClick={() => copy(k.kode, `k${k.id}`)}>
                  {copied === `k${k.id}` ? 'Tersalin' : 'Salin kode'}
                </button>
                <button className="btn small" onClick={() => copy(link(k), `l${k.id}`)}>
                  {copied === `l${k.id}` ? 'Tersalin' : 'Salin tautan daftar'}
                </button>
              </div>
              <div className="row-btns">
                <Link to="/dosen/mahasiswa" className="btn small" onClick={() => localStorage.setItem('sinaps-dosen-kelas', String(k.id))}>
                  Lihat mahasiswa
                </Link>
                <button
                  className="btn small"
                  onClick={async () => {
                    const n = prompt('Nama kelas baru', k.nama);
                    if (n && n.trim()) {
                      await api.renameClass(k.id, n);
                      load();
                    }
                  }}
                >
                  Ganti nama
                </button>
                <button
                  className="btn small"
                  onClick={async () => {
                    if (confirm('Buat kode baru? Kode lama tidak bisa dipakai lagi; mahasiswa yang sudah bergabung tetap di kelas.')) {
                      await api.newClassCode(k.id);
                      load();
                    }
                  }}
                >
                  Kode baru
                </button>
                <button
                  className="btn small danger"
                  onClick={async () => {
                    if (confirm(`Hapus kelas ${k.nama}? Mahasiswa dikeluarkan dari kelas dan tugasnya dihapus. Riwayat latihan mahasiswa tetap tersimpan.`)) {
                      await api.deleteClass(k.id);
                      load();
                    }
                  }}
                >
                  Hapus
                </button>
              </div>
              {k.created_at && <p className="small muted">Dibuat {fmt.date(k.created_at)}</p>}
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}

// --- tugas -------------------------------------------------------------------

export function TugasDosen() {
  const [list, setList] = useState<DosenAssignment[] | null>(null);
  const [kelas, setKelas] = useState<Kelas[]>([]);
  const [cases, setCases] = useState<DosenCase[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const load = () => api.dosenAssignments().then(setList);
  useEffect(() => {
    load();
    api.classes().then(setKelas);
    api.dosenCases().then(setCases);
  }, []);
  return (
    <Page
      wide
      title="Tugas"
      sub="Beri paket modul dan kasus dengan tenggat. Progres dihitung otomatis: kasus selesai bila dikirim setelah tugas dibuat, modul selesai bila kuisnya lulus."
      actions={
        <button className="btn primary small" onClick={() => setShowForm(!showForm)} disabled={!kelas.length}>
          {showForm ? 'Tutup formulir' : 'Tugas baru'}
        </button>
      }
    >
      {!kelas.length && (
        <section className="card notice">
          <div>
            <b>Buat kelas dulu</b>
            <p className="muted small">Tugas diberikan per kelas.</p>
          </div>
          <Link to="/dosen/kelas" className="btn">
            Ke halaman kelas
          </Link>
        </section>
      )}
      {showForm && (
        <AssignmentForm
          kelas={kelas}
          cases={cases}
          onDone={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
      {!list ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty title="Belum ada tugas">Klik “Tugas baru” untuk membuat paket latihan.</Empty>
      ) : (
        list.map((t) => {
          const overdue = t.due_at && t.due_at < Date.now() / 1000;
          return (
            <section key={t.id} className="card">
              <div className="card-head">
                <h2>{t.judul}</h2>
                <span className="muted small">
                  {t.kelas} · dibuat {fmt.date(t.created_at)}
                  {t.due_at ? ` · tenggat ${fmt.dateTime(t.due_at)}` : ''}
                  {overdue && <em className="late"> (lewat)</em>}
                </span>
              </div>
              {t.catatan && <p>{t.catatan}</p>}
              <p className="small">
                {t.lesson_ids.map((l) => (
                  <span key={l} className="tag">
                    modul {lessonById(l)?.kc ?? l}
                  </span>
                ))}
                {t.case_ids.map((c) => (
                  <span key={c} className="tag mono">
                    {c}
                  </span>
                ))}
              </p>
              <div className="row between">
                <span>
                  <b>{t.n_tuntas}</b>/{t.progress.length} mahasiswa tuntas
                </span>
                <span className="progress wide">
                  <i style={{ width: `${(t.n_tuntas / Math.max(1, t.progress.length)) * 100}%` }} />
                </span>
                <span className="row-btns">
                  <button className="btn small" onClick={() => setOpen(open === t.id ? null : t.id)}>
                    {open === t.id ? 'Sembunyikan progres' : 'Lihat progres'}
                  </button>
                  <button
                    className="btn small danger"
                    onClick={async () => {
                      if (confirm(`Hapus tugas “${t.judul}”?`)) {
                        await api.deleteAssignment(t.id);
                        load();
                      }
                    }}
                  >
                    Hapus
                  </button>
                </span>
              </div>
              {open === t.id && (
                <div className="table-wrap">
                  <table className="list matrix">
                    <thead>
                      <tr>
                        <th>Mahasiswa</th>
                        {t.lesson_ids.map((l) => (
                          <th key={l}>{lessonById(l)?.kc ?? l}</th>
                        ))}
                        {t.case_ids.map((c) => (
                          <th key={c} className="mono">
                            {c}
                          </th>
                        ))}
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.progress.map((p) => (
                        <tr key={p.sid}>
                          <td>
                            <Link to={`/dosen/mahasiswa/${p.sid}`}>{p.nama}</Link>
                          </td>
                          {t.lesson_ids.map((l) => (
                            <td key={l} className={p.lessons_done.includes(l) ? 'cell-ok' : 'cell-no'}>
                              {p.lessons_done.includes(l) ? '✓' : '·'}
                            </td>
                          ))}
                          {t.case_ids.map((c) => (
                            <td key={c} className={p.cases_done.includes(c) ? 'cell-ok' : 'cell-no'}>
                              {p.cases_done.includes(c) ? '✓' : '·'}
                            </td>
                          ))}
                          <td>
                            {p.selesai}/{p.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })
      )}
    </Page>
  );
}

function AssignmentForm({ kelas, cases, onDone }: { kelas: Kelas[]; cases: DosenCase[]; onDone: () => void }) {
  const [f, setF] = useState({ kelas_id: kelas[0]?.id ?? 0, judul: '', catatan: '', due: '' });
  const [ls, setLs] = useState<string[]>([]);
  const [cs, setCs] = useState<string[]>([]);
  const [tier, setTier] = useState('');
  const [err, setErr] = useState('');
  const pool = cases.filter((c) => !c.contoh_ajar && c.review?.status !== 'ditolak' && (!tier || c.tier === tier));
  const toggle = (arr: string[], set: (a: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <section className="card">
      <h2>Tugas baru</h2>
      <form
        className="form assign-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr('');
          try {
            await api.createAssignment({
              kelas_id: f.kelas_id,
              judul: f.judul,
              catatan: f.catatan,
              lesson_ids: ls,
              case_ids: cs,
              due_at: f.due ? new Date(f.due).getTime() / 1000 : null,
            });
            onDone();
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      >
        <div className="form-row">
          <label>
            Kelas
            <select value={f.kelas_id} onChange={(e) => setF({ ...f, kelas_id: Number(e.target.value) })}>
              {kelas.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </select>
          </label>
          <label className="grow">
            Judul
            <input value={f.judul} onChange={(e) => setF({ ...f, judul: e.target.value })} placeholder="mis. Minggu 3: restriksi difusi" required />
          </label>
          <label>
            Tenggat (opsional)
            <input type="datetime-local" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
          </label>
        </div>
        <label>
          Catatan untuk mahasiswa
          <textarea value={f.catatan} onChange={(e) => setF({ ...f, catatan: e.target.value })} rows={2} />
        </label>
        <fieldset>
          <legend>Modul belajar ({ls.length})</legend>
          <div className="checks">
            {LESSONS.map((l) => (
              <label key={l.id} className="check">
                <input type="checkbox" checked={ls.includes(l.id)} onChange={() => toggle(ls, setLs, l.id)} /> {l.judul}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>
            Kasus ({cs.length}){' '}
            <select value={tier} onChange={(e) => setTier(e.target.value)} aria-label="Saring tingkat">
              <option value="">semua tingkat</option>
              <option>mudah</option>
              <option>sedang</option>
              <option>sulit</option>
            </select>
          </legend>
          <div className="checks cases">
            {pool.map((c) => (
              <label key={c.id} className="check">
                <input type="checkbox" checked={cs.includes(c.id)} onChange={() => toggle(cs, setCs, c.id)} />
                <span className="mono">{c.id}</span> <span className={`tier tier-${c.tier}`}>{c.tier}</span>
                <span className="muted small">
                  {c.temuan.jumlah_fokus} fokus · {fmt.num(c.temuan.volume_ml, 1)} ml · {c.temuan.restriksi_sejati ? 'restriksi' : 'shine-through'}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {err && <p className="error">{err}</p>}
        <button className="btn primary">Simpan tugas</button>
      </form>
    </section>
  );
}

// --- verifikasi kasus -------------------------------------------------------------

const STATUS: Record<string, string> = { disetujui: 'Disetujui', perlu_tinjau: 'Perlu ditinjau', ditolak: 'Ditolak' };

export function VerifikasiKasus() {
  const [list, setList] = useState<DosenCase[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const load = () => api.dosenCases().then(setList);
  useEffect(() => {
    load();
  }, []);
  const rows = useMemo(() => (list ?? []).filter((c) => !filter || (filter === 'belum' ? !c.review : c.review?.status === filter)), [list, filter]);
  const counts = useMemo(() => {
    const o: Record<string, number> = { belum: 0, disetujui: 0, perlu_tinjau: 0, ditolak: 0 };
    for (const c of list ?? []) o[c.review?.status ?? 'belum']++;
    return o;
  }, [list]);
  return (
    <Page
      wide
      title="Verifikasi kasus"
      sub="Periksa kunci jawaban (mask ahli) dan temuan terstruktur setiap kasus sebelum dipakai. Kasus yang ditolak dikeluarkan dari latihan adaptif dan bank kasus semua mahasiswa."
      actions={
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Saring status">
          <option value="">Semua ({list?.length ?? 0})</option>
          <option value="belum">Belum ditinjau ({counts.belum})</option>
          <option value="disetujui">Disetujui ({counts.disetujui})</option>
          <option value="perlu_tinjau">Perlu ditinjau ({counts.perlu_tinjau})</option>
          <option value="ditolak">Ditolak ({counts.ditolak})</option>
        </select>
      }
    >
      {sel && <CasePreview id={sel} row={list?.find((c) => c.id === sel)} onClose={() => setSel(null)} onSaved={load} />}
      {!list ? (
        <Loading />
      ) : (
        <section className="card">
          <div className="table-wrap">
            <table className="list">
              <thead>
                <tr>
                  <th>Kasus</th>
                  <th>Tingkat</th>
                  <th>Pasien</th>
                  <th>Temuan (kunci)</th>
                  <th>rADC</th>
                  <th>Model Dice</th>
                  <th>Kelas Anda</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className={sel === c.id ? 'sel' : ''}>
                    <td className="mono">
                      {c.id}
                      {c.contoh_ajar && <span className="tag">contoh ajar</span>}
                    </td>
                    <td>
                      <span className={`tier tier-${c.tier}`}>{c.tier}</span>
                    </td>
                    <td className="small">
                      {c.vignette.jenis_kelamin}, {c.vignette.usia ?? '?'} th, NIHSS {c.vignette.nihss ?? '?'}
                    </td>
                    <td className="small">
                      {c.temuan.jumlah_fokus} fokus · {fmt.num(c.temuan.volume_ml, 1)} ml · {c.temuan.hemisfer}
                    </td>
                    <td>
                      {fmt.num(c.temuan.adc_relatif_lesi)} {!c.temuan.restriksi_sejati && <span className="tag">shine-through</span>}
                    </td>
                    <td className={c.model && c.model.dice_terhadap_kunci < 0.5 ? 'bad-text' : ''}>{c.model ? fmt.num(c.model.dice_terhadap_kunci) : '—'}</td>
                    <td className="small">{c.n_percobaan ? `${c.n_percobaan}× · Dice ${c.mean_dice === null ? '—' : fmt.num(c.mean_dice)}` : '—'}</td>
                    <td>{c.review ? <span className={`pill ${c.review.status === 'disetujui' ? 'ok' : c.review.status === 'ditolak' ? 'bad' : ''}`}>{STATUS[c.review.status]}</span> : <span className="muted small">belum</span>}</td>
                    <td>
                      <button className="btn small" onClick={() => setSel(c.id)}>
                        Periksa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">Dice model rendah menandakan kasus yang sulit atau mask yang perlu diperiksa ulang radiolog. Status verifikasi berlaku untuk seluruh SINAPS.</p>
        </section>
      )}
    </Page>
  );
}

function CasePreview({ id, row, onClose, onSaved }: { id: string; row?: DosenCase; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState<Awaited<ReturnType<typeof api.dosenCaseView>> | null>(null);
  const [status, setStatus] = useState(row?.review?.status ?? 'disetujui');
  const [note, setNote] = useState(row?.review?.catatan ?? '');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setV(null);
    setStatus(row?.review?.status ?? 'disetujui');
    setNote(row?.review?.catatan ?? '');
    api.dosenCaseView(id).then(setV);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return (
    <section className="card preview">
      <div className="card-head">
        <h2>Periksa SOOP {id}</h2>
        <button className="btn small" onClick={onClose}>
          Tutup
        </button>
      </div>
      {!v ? (
        <Loading text="Memuat citra dan kunci…" />
      ) : (
        <div className="review-grid">
          <ReadViewer
            geom={v.case}
            series={v.series}
            masks={{ kunci: v.gt_rle, model: v.pred_rle }}
            initialVisible={{ kunci: true, model: false }}
            jumpTo={v.findings.fokus[0] ? (v.findings.fokus[0].pusat_voxel.map(Math.round) as [number, number, number]) : null}
            height={460}
          />
          <aside className="review-side">
            <h3>Temuan terstruktur</h3>
            <ul className="facts">
              <li>Volume: {fmt.num(v.findings.volume_ml, 1)} ml ({v.findings.kategori_volume})</li>
              <li>
                Fokus: {v.findings.jumlah_fokus} ({v.findings.multifokal ? 'multifokal' : 'tunggal'}), hemisfer {v.findings.hemisfer}
              </li>
              <li>
                ADC relatif lesi: {fmt.num(v.findings.adc_relatif_lesi)} → {v.findings.restriksi_sejati ? 'restriksi sejati' : 'bukan restriksi'}
              </li>
              <li>Slice lesi terbesar: {v.findings.slice_lesi_terbesar}</li>
              <li>Indeks kesulitan D: {v.findings.indeks_kesulitan_D}</li>
              {v.model && (
                <li>
                  Model U-Net: Dice {fmt.num(v.model.dice_terhadap_kunci)} terhadap kunci, {fmt.num(v.model.volume_ml, 1)} ml{v.model.keyakinan_rendah ? ', keyakinan rendah' : ''}
                </li>
              )}
              <li>
                Luaran: Rankin pulang {v.luaran?.rankin_pulang ?? '—'}, etiologi {v.luaran?.etiologi ?? '—'}
              </li>
            </ul>
            <h3>Keputusan</h3>
            <div className="seg">
              {Object.entries(STATUS).map(([k, l]) => (
                <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>
                  {l}
                </button>
              ))}
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Catatan (mis. tepi lesi di slice 14 perlu dikoreksi)" />
            <button
              className="btn primary"
              onClick={async () => {
                await api.reviewCase(id, status, note);
                setSaved(true);
                setTimeout(() => setSaved(false), 1500);
                onSaved();
              }}
            >
              {saved ? 'Tersimpan' : 'Simpan keputusan'}
            </button>
          </aside>
        </div>
      )}
    </section>
  );
}

// --- audit tutor ---------------------------------------------------------------

export function AuditTutor() {
  const [kelas, setKelas] = useKelasFilter();
  const [opts, setOpts] = useState<Kelas[]>([]);
  const [flagged, setFlagged] = useState(false);
  const [mode, setMode] = useState('');
  const [logs, setLogs] = useState<TutorLog[] | null>(null);
  useEffect(() => {
    api.classes().then(setOpts);
  }, []);
  useEffect(() => {
    setLogs(null);
    api.tutorLogs(kelas, flagged).then(setLogs);
  }, [kelas, flagged]);
  const rows = (logs ?? []).filter((l) => !mode || l.mode === mode);
  const llm = (logs ?? []).filter((l) => l.source === 'llm');
  const avgLat = llm.length ? llm.reduce((a, b) => a + (b.latency_ms ?? 0), 0) / llm.length / 1000 : null;
  return (
    <Page
      wide
      title="Audit tutor"
      sub="Setiap respons tutor tercatat bersama fase (sebelum/sesudah kunci terbuka), sumber (LLM atau templat offline), latensi, dan hasil pemeriksa fakta."
      actions={
        <>
          <KelasSelect kelas={kelas} setKelas={setKelas} options={opts} />
          <select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Saring mode">
            <option value="">Semua mode</option>
            <option value="sokratik">Sokratik</option>
            <option value="penjelasan">Penjelasan</option>
            <option value="rujukan">Rujukan</option>
          </select>
          <label className="small check">
            <input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} /> Hanya yang ditandai
          </label>
        </>
      }
    >
      {logs && (
        <div className="kpis">
          <div className="kpi">
            <b>{logs.length}</b>
            <span>respons tercatat</span>
          </div>
          <div className="kpi">
            <b>{logs.filter((l) => l.issues.length).length}</b>
            <span>ditandai pemeriksa fakta</span>
          </div>
          <div className="kpi">
            <b>{logs.filter((l) => l.phase === 'sebelum_submit').length}</b>
            <span>sebelum kunci terbuka</span>
          </div>
          <div className="kpi">
            <b>{avgLat === null ? '—' : `${fmt.num(avgLat, 1)} dtk`}</b>
            <span>rerata latensi LLM</span>
          </div>
        </div>
      )}
      {!logs ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty title="Belum ada log" />
      ) : (
        <section className="card">
          <ul className="logs">
            {rows.map((t) => (
              <li key={t.id} className={t.issues.length ? 'flag' : ''}>
                <div className="log-meta">
                  {fmt.dateTime(t.created_at)} · <Link to={`/dosen/mahasiswa/${t.sid}`}>{t.nama ?? t.sid}</Link> · <Link to={`/dosen/percobaan/${t.attempt_id}`}>{t.case_id}</Link> · {t.mode} ·{' '}
                  {t.phase === 'sebelum_submit' ? 'sebelum kirim' : 'sesudah kirim'} · {t.source === 'llm' ? t.model : t.source} · {fmt.num((t.latency_ms ?? 0) / 1000, 1)} dtk
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
        </section>
      )}
    </Page>
  );
}
