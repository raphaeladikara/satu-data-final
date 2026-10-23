import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fmt, JENJANG, type Assignment, type AttemptDetail, type CaseRow, type KCInfo, type Me } from '../../api';
import { useAuth } from '../../auth';
import JoinClass from '../../components/JoinClass';
import ReadViewer from '../../components/ReadViewer';
import Markdown from '../../components/Markdown';
import { Empty, LoadError, Loading, Page } from '../../components/Shell';

import { ArrowRight, Check, Search } from 'lucide-react';
import { AppShell, PageHead } from '@/components/AppShell';
import { AttemptTimeline } from '@/components/AttemptTimeline';
import { TaskChecklist, TaskSummary } from '@/components/TaskChecklist';
import { cn } from '@/lib/utils';
import { BADGE, FILL, TEXT, TIER, diceTone, nihssTone } from '@/lib/status';

// --- tugas -------------------------------------------------------------------

export function Tugas() {
  const { user } = useAuth();
  const [list, setList] = useState<Assignment[] | null>(null);
  const [err, setErr] = useState('');
  const load = () => {
    setErr('');
    api.assignments().then(setList).catch((e) => setErr(e.message));
  };
  useEffect(load, []);
  // yang belum tuntas di atas, diurutkan dari tenggat terdekat
  const sorted = [...(list ?? [])].sort((a, b) => Number(a.tuntas) - Number(b.tuntas) || (a.due_at ?? 9e12) - (b.due_at ?? 9e12));
  return (
    <AppShell>
      <PageHead title="Tugas" sub={user?.kelas ? `Dari ${user.kelas.dosen ?? 'dosen'} untuk ${user.kelas.nama}` : 'Tugas dari dosen pengampu kelasmu.'} />
      {!user?.kelas ? (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-info/25 bg-info-soft/60 p-5">
          <div>
            <b className="text-[15px] font-semibold">Kamu belum bergabung ke kelas</b>
            <p className="text-[13.5px] text-ink/60">Minta kode kelas kepada dosenmu.</p>
          </div>
          <div className="legacy">
            <JoinClass onJoined={load} />
          </div>
        </section>
      ) : err ? (
        <LoadError message={err} onRetry={load} />
      ) : !list ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty title="Belum ada tugas">Dosen belum memberi tugas untuk kelas ini. Sementara itu, lanjutkan latihan adaptif.</Empty>
      ) : (
        <>
          <TaskSummary list={list} />
          <div className="space-y-4">
            {sorted.map((t) => (
              <TaskChecklist key={t.id} task={t} />
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}

// --- riwayat -----------------------------------------------------------------

export function Riwayat() {
  const [me, setMe] = useState<Me | null>(null);
  const [kc, setKc] = useState('');
  const [err, setErr] = useState('');
  const load = () => {
    setErr('');
    api.me().then(setMe).catch((e) => setErr(e.message));
  };
  useEffect(load, []);
  const all = me?.attempts ?? [];
  const rows = all.filter((a) => !kc || a.kc[kc] !== undefined);
  const withDice = rows.filter((r) => r.dice !== null);
  const mean = withDice.length ? withDice.reduce((a, r) => a + (r.dice ?? 0), 0) / withDice.length : null;
  const tone = diceTone(mean);
  return (
    <AppShell>
      <PageHead title="Riwayat latihan" sub="Semua kasus yang sudah kamu kirim. Buka satu percobaan untuk melihat anotasimu di atas kunci jawaban." />
      {err ? (
        <LoadError message={err} onRetry={load} />
      ) : !me ? (
        <Loading />
      ) : (
        <section className="rounded-2xl card-surface p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div role="tablist" aria-label="Saring KC" className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
              {['', 'K1', 'K2', 'K3', 'K6'].map((k) => (
                <button key={k || 'all'} role="tab" aria-selected={kc === k} onClick={() => setKc(k)} className={cn('rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors', kc === k ? 'bg-white text-ink shadow-sm' : 'text-ink/55 hover:text-ink')}>
                  {k || 'Semua KC'}
                </button>
              ))}
            </div>
            <p className="text-[13px] text-ink/55">
              {rows.length} percobaan
              {mean !== null && (
                <>
                  {' '}
                  · rerata Dice <b className={cn('font-semibold', TEXT[tone])}>{fmt.num(mean)}</b>
                </>
              )}
            </p>
          </div>
          {rows.length === 0 ? <Empty title="Belum ada percobaan">Kerjakan kasus di menu Latihan.</Empty> : <AttemptTimeline rows={rows} />}
        </section>
      )}
    </AppShell>
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
    api.kc().then((r) => setKc(r.kc)).catch(() => {});
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
                    <button key={i} className="chip" onClick={() => setJump([Math.round(f.pusat_voxel[0]), Math.round(f.pusat_voxel[1]), f.slice_terbesar - 1])}>
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
                    <div>
                      <b>Tutor:</b> <Markdown text={t.response} />
                    </div>
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
type Sort = 'D-asc' | 'D-desc' | 'nihss-desc' | 'usia-desc';
const SORTS: Record<Sort, [string, (a: CaseRow, b: CaseRow) => number]> = {
  'D-asc': ['Indeks D, termudah dulu', (a, b) => a.D - b.D],
  'D-desc': ['Indeks D, tersulit dulu', (a, b) => b.D - a.D],
  'nihss-desc': ['NIHSS tertinggi', (a, b) => (b.vignette.nihss ?? -1) - (a.vignette.nihss ?? -1)],
  'usia-desc': ['Usia tertua', (a, b) => parseInt(b.vignette.usia ?? '0') - parseInt(a.vignette.usia ?? '0')],
};

export function Kasus() {
  const nav = useNavigate();
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [tier, setTier] = useState('');
  const [status, setStatus] = useState<'' | 'belum' | 'sudah'>('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('D-asc');
  const [err, setErr] = useState('');
  const load = () => {
    setErr('');
    api.cases().then(setCases).catch((e) => setErr(e.message));
  };
  useEffect(load, []);
  const all = cases ?? [];
  const [dMin, dMax] = all.length ? [Math.min(...all.map((c) => c.D)), Math.max(...all.map((c) => c.D))] : [0, 1];
  const list = all
    .filter((c) => (!tier || c.tier === tier) && (!status || (status === 'sudah') === c.dikerjakan) && (!q || c.id.toLowerCase().includes(q.trim().toLowerCase())))
    .sort(SORTS[sort][1]);

  return (
    <AppShell wide>
      <PageHead
        title="Bank kasus"
        sub={`${cases?.length ?? '…'} kasus latihan dari SOOP. Tingkat kesulitan memakai tersil indeks D = −log₁₀ V + log₂ F dari seluruh 1.451 lesion mask akut. Kasus yang dipilih sendiri tetap memperbarui penguasaanmu.`}
      />
      {err ? (
        <LoadError message={err} onRetry={load} />
      ) : !cases ? (
        <Loading />
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {TIERS.map((t) => {
              const of = all.filter((c) => c.tier === t);
              const done = of.filter((c) => c.dikerjakan).length;
              const tone = TIER[t];
              const on = tier === t;
              return (
                <button key={t} onClick={() => setTier(on ? '' : t)} aria-pressed={on} className={cn('group rounded-2xl card-surface p-5 text-left transition-[box-shadow,transform] hover:-translate-y-0.5', on && '!shadow-[0_0_0_2px_var(--tw-ring-color)]', tone === 'ok' ? 'ring-ok' : tone === 'warn' ? 'ring-warn' : 'ring-bad')}>
                  <div className="flex items-center justify-between">
                    <span className={cn('rounded-md px-2 py-0.5 text-[11.5px] font-semibold uppercase tracking-wide', BADGE[tone])}>{t}</span>
                    <span className="text-[12px] text-ink/45 transition-colors group-hover:text-ink/70">{on ? 'hapus saring' : 'saring'}</span>
                  </div>
                  <div className="mt-4 flex items-baseline gap-1.5">
                    <b className="text-[1.6rem] font-semibold leading-none tabular-nums">{done}</b>
                    <span className="text-[13px] text-ink/50">/ {of.length} dikerjakan</span>
                  </div>
                  <span className="mt-3 block h-2 overflow-hidden rounded-full bg-muted">
                    <span className={cn('block h-full rounded-full', FILL[tone])} style={{ width: `${(done / Math.max(1, of.length)) * 100}%` }} />
                  </span>
                </button>
              );
            })}
          </div>

          <section className="overflow-hidden rounded-2xl card-surface">
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 sm:px-4">
              <div role="tablist" aria-label="Tingkat" className="flex gap-1 rounded-xl bg-muted p-1">
                {['', ...TIERS].map((t) => (
                  <button key={t || 'all'} role="tab" aria-selected={tier === t} onClick={() => setTier(t)} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium capitalize transition-colors', tier === t ? 'bg-white text-ink shadow-sm' : 'text-ink/55 hover:text-ink')}>
                    {t && <span className={cn('size-2 rounded-full', FILL[TIER[t]])} />}
                    {t || 'Semua'}
                    <span className="text-[11px] tabular-nums text-ink/40">{t ? all.filter((c) => c.tier === t).length : all.length}</span>
                  </button>
                ))}
              </div>
              <label className="relative ml-auto flex min-w-[10rem] flex-1 items-center sm:max-w-[16rem]">
                <Search className="pointer-events-none absolute left-3 size-4 text-ink/40" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari sub-…" aria-label="Cari kasus" className="h-9 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-[13.5px] outline-none transition-colors focus:border-teal" />
              </label>
              <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status" className="h-9 rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink/75 outline-none focus:border-teal">
                <option value="">Semua status</option>
                <option value="belum">Belum dikerjakan</option>
                <option value="sudah">Sudah dikerjakan</option>
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Urutkan" className="h-9 rounded-lg border border-line bg-white px-2.5 text-[13px] text-ink/75 outline-none focus:border-teal">
                {Object.entries(SORTS).map(([k, [l]]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[13.5px]">
                <thead className="bg-surface text-[11.5px] font-semibold uppercase tracking-wide text-ink/45">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Kasus</th>
                    <th className="px-4 py-2.5 font-semibold">Pasien</th>
                    <th className="px-4 py-2.5 font-semibold">NIHSS</th>
                    <th className="px-4 py-2.5 font-semibold">Tingkat</th>
                    <th className="px-4 py-2.5 font-semibold">Indeks D</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => {
                    const v = c.vignette;
                    const nt = nihssTone(v.nihss);
                    const tt = TIER[c.tier] ?? 'none';
                    // kasus yang sudah dikirim tidak bisa dikerjakan ulang (kuncinya sudah terbuka): arahkan ke tinjau ulang
                    const go = () => nav(c.dikerjakan && c.attempt_id ? `/riwayat/${c.attempt_id}` : `/latihan?kasus=${c.id}`);
                    return (
                      <tr key={c.id} onClick={go} className="group cursor-pointer border-t border-line transition-colors hover:bg-surface">
                        <td className="px-4 py-3">
                          <button onClick={go} className="font-mono text-[13px] font-semibold text-ink outline-none group-hover:text-teal">
                            {c.id}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-ink/70">
                          {v.jenis_kelamin}, {v.usia ?? '?'} th
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex min-w-[2.25rem] justify-center rounded-md px-1.5 py-0.5 text-[12px] font-semibold tabular-nums', BADGE[nt])} title="0–4 ringan · 5–15 sedang · ≥16 berat">
                            {v.nihss ?? '?'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide', BADGE[tt])}>{c.tier}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2.5">
                            <span className="relative h-1.5 w-20 rounded-full bg-muted">
                              <span className={cn('absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white', FILL[tt])} style={{ left: `${((c.D - dMin) / Math.max(1e-6, dMax - dMin)) * 100}%` }} />
                            </span>
                            <span className="font-mono text-[12px] tabular-nums text-ink/55">{fmt.num(c.D)}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {c.dikerjakan ? (
                            <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-semibold', BADGE[diceTone(c.dice)])}>
                              <Check className="size-3" strokeWidth={3} /> Dice {c.dice === null ? '—' : fmt.num(c.dice)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink/45">
                              <span className="size-1.5 rounded-full bg-ink/25" /> Belum
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12.5px] font-medium text-ink/40 transition-colors group-hover:bg-teal group-hover:text-white">
                            {c.dikerjakan ? 'Tinjau' : 'Kerjakan'} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {list.length === 0 && (
                <div className="p-6">
                  <Empty title="Tidak ada kasus yang cocok">Ubah saringan atau kata kunci pencarian.</Empty>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[12.5px] text-ink/50">
              <span>
                Menampilkan {list.length} dari {all.length} kasus
              </span>
              <span className="flex flex-wrap items-center gap-3">
                NIHSS:
                {(
                  [
                    ['ok', '0–4 ringan'],
                    ['warn', '5–15 sedang'],
                    ['bad', '≥16 berat'],
                  ] as const
                ).map(([t, l]) => (
                  <span key={t} className="flex items-center gap-1">
                    <span className={cn('size-2 rounded-full', FILL[t])} /> {l}
                  </span>
                ))}
              </span>
            </div>
          </section>
        </>
      )}
    </AppShell>
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
