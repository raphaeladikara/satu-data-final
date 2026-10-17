import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, session, type Vignette } from '../api';

const TIERS = ['mudah', 'sedang', 'sulit'];

export default function Cases() {
  const nav = useNavigate();
  const [cases, setCases] = useState<{ id: string; tier: string; D: number; vignette: Vignette }[]>([]);
  useEffect(() => {
    api.cases().then(setCases);
  }, []);
  const open = (id: string) => (session.get() ? nav(`/latihan?kasus=${id}`) : nav('/'));
  return (
    <div className="page">
      <header className="topbar">
        <Link to="/" className="brand">
          SINAPS
        </Link>
        <nav className="topnav">
          <Link to="/latihan">Latihan</Link>
          <Link to="/dosen">Dasbor dosen</Link>
        </nav>
      </header>
      <div className="page-body">
        <h1>Bank kasus</h1>
        <p className="muted">
          {cases.length} kasus dari SOOP. Tingkat kesulitan memakai tersil indeks D = −log₁₀ V + log₂ F yang dihitung dari seluruh 1.451 lesion mask akut.
        </p>
        <div className="tiers">
          {TIERS.map((t) => (
            <section key={t} className="card">
              <h2>
                <span className={`tier tier-${t}`}>{t}</span> {cases.filter((c) => c.tier === t).length} kasus
              </h2>
              <ul className="case-list">
                {cases
                  .filter((c) => c.tier === t)
                  .sort((a, b) => a.D - b.D)
                  .map((c) => (
                    <li key={c.id}>
                      <button onClick={() => open(c.id)}>
                        <b className="mono">{c.id}</b>
                        <span>
                          {c.vignette.jenis_kelamin}, {c.vignette.usia ?? '?'} th · NIHSS {c.vignette.nihss ?? '?'}
                        </span>
                        <span className="mono muted">D {c.D.toFixed(2).replace('.', ',')}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
