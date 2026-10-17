import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Dashboard as D } from '../api';

const ACTIVE = ['K1', 'K2', 'K3', 'K6'];

function heat(p: number | undefined) {
  if (p === undefined) return 'transparent';
  const h = Math.round(p * 120); // merah -> hijau
  return `hsl(${h} 55% 35%)`;
}

export default function Dashboard() {
  const [data, setData] = useState<D | null>(null);
  const [key, setKey] = useState(() => {
    try {
      return sessionStorage.getItem('sinaps-dosen') ?? '';
    } catch {
      return '';
    }
  });
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api.dashboard(key || undefined));
      setErr('');
      try {
        sessionStorage.setItem('sinaps-dosen', key);
      } catch {
        /* diblokir */
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  const errs = data ? Object.entries(data.error_counts).sort((a, b) => b[1] - a[1]) : [];
  const maxErr = Math.max(1, ...errs.map((e) => e[1]));

  return (
    <div className="page">
      <header className="topbar">
        <Link to="/" className="brand">
          SINAPS
        </Link>
        <span className="case-info">Dasbor dosen</span>
        <nav className="topnav">
          <Link to="/latihan">Latihan</Link>
          <Link to="/kasus">Bank kasus</Link>
          <button className="btn small" onClick={load}>
            Muat ulang
          </button>
        </nav>
      </header>
      <div className="page-body">
        {err && (
          <form
            className="card keyform"
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
          >
            <p>{err === 'kode dosen salah' ? 'Masukkan kode dosen.' : err}</p>
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Kode dosen" aria-label="Kode dosen" />
            <button className="btn">Buka</button>
          </form>
        )}
        {data && (
          <>
            <div className="kpis">
              <div className="kpi">
                <b>{data.students.length}</b>
                <span>mahasiswa (pseudonim)</span>
              </div>
              <div className="kpi">
                <b>{data.n_attempts}</b>
                <span>kasus dikerjakan</span>
              </div>
              <div className="kpi">
                <b>{data.mean_dice === null ? '—' : data.mean_dice.toFixed(2).replace('.', ',')}</b>
                <span>rerata Dice delineasi</span>
              </div>
              <div className="kpi">
                <b>{data.tutor_logs.filter((t) => t.issues.length).length}</b>
                <span>respons tutor ditandai pemeriksa fakta</span>
              </div>
            </div>

            <div className="grid2">
              <section className="card">
                <h2>Peta penguasaan KC per mahasiswa</h2>
                <table className="heat">
                  <thead>
                    <tr>
                      <th>Pseudonim</th>
                      <th>Kelas</th>
                      <th>Kasus</th>
                      {ACTIVE.map((k) => (
                        <th key={k} title={data.kc[k]}>
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((s) => (
                      <tr key={s.sid}>
                        <td className="mono">{s.sid}</td>
                        <td>{s.kelas}</td>
                        <td>{s.n_kasus}</td>
                        {ACTIVE.map((k) => (
                          <td key={k} style={{ background: heat(s.mastery[k]?.p) }} title={`${data.kc[k]}: ${s.mastery[k]?.n ?? 0} observasi`}>
                            {s.mastery[k] ? Math.round(s.mastery[k].p * 100) : '·'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="small muted">Nilai = peluang menguasai KC menurut BKT (%). Dikuasai bila ≥ 95%.</p>
              </section>

              <section className="card">
                <h2>Jenis kesalahan delineasi tersering</h2>
                {errs.length === 0 && <p className="muted">Belum ada data.</p>}
                <ul className="hbars">
                  {errs.map(([k, n]) => (
                    <li key={k}>
                      <span>{k}</span>
                      <i style={{ width: `${(n / maxErr) * 100}%` }} />
                      <b>{n}</b>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="card">
              <h2>Percobaan terbaru</h2>
              <table className="list">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Pseudonim</th>
                    <th>Kasus</th>
                    <th>Sasaran</th>
                    <th>Tingkat</th>
                    <th>KC benar</th>
                    <th>Dice</th>
                    <th>Jenis kesalahan</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td className="mono">{r.sid}</td>
                      <td className="mono">{r.case_id}</td>
                      <td>{r.target_kc}</td>
                      <td>{r.tier}</td>
                      <td>
                        {Object.entries(r.kc).map(([k, ok]) => (
                          <span key={k} className={`pill ${ok ? 'ok' : 'bad'}`}>
                            {k}
                          </span>
                        ))}
                      </td>
                      <td>{r.dice === null ? '—' : r.dice.toFixed(2).replace('.', ',')}</td>
                      <td>{r.jenis ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="card">
              <h2>Audit log tutor</h2>
              <p className="small muted">Setiap respons tutor tercatat bersama fasenya, sumbernya (LLM atau templat offline), latensi, dan hasil pemeriksa fakta.</p>
              <ul className="logs">
                {data.tutor_logs.map((t) => (
                  <li key={t.id} className={t.issues.length ? 'flag' : ''}>
                    <div className="log-meta">
                      <span className="mono">{t.sid}</span> · {t.case_id} · {t.mode} · {t.phase} · {t.source === 'llm' ? t.model : t.source} · {(t.latency_ms / 1000).toFixed(1).replace('.', ',')} dtk
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
            <p className="small muted">Basis data: {data.db}</p>
          </>
        )}
      </div>
    </div>
  );
}
