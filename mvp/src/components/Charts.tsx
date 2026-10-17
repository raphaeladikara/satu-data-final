import { fmt } from '../api';

const KC_COLORS: Record<string, string> = { K1: '#4696ff', K2: '#2bb3a3', K3: '#e0a84a', K6: '#d46ad8' };

/** Lintasan penguasaan BKT per KC: satu titik per kasus yang dikirim. */
export function Trajectory({ points, kcs, names }: { points: { t: number; mastery: Record<string, number> }[]; kcs: string[]; names: Record<string, string> }) {
  const W = 560;
  const H = 200;
  const P = { l: 34, r: 10, t: 10, b: 24 };
  const series = [{ t: 0, mastery: Object.fromEntries(kcs.map((k) => [k, 0.2])) }, ...points];
  const n = series.length;
  const x = (i: number) => P.l + (n === 1 ? 0 : (i / (n - 1)) * (W - P.l - P.r));
  const y = (v: number) => P.t + (1 - v) * (H - P.t - P.b);
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Lintasan penguasaan KC">
        {[0, 0.5, 0.95].map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className={v === 0.95 ? 'gl mastered' : 'gl'} />
            <text x={P.l - 6} y={y(v) + 4} className="axis" textAnchor="end">
              {Math.round(v * 100)}
            </text>
          </g>
        ))}
        {kcs.map((k) => (
          <polyline
            key={k}
            fill="none"
            stroke={KC_COLORS[k] ?? '#8b9ab2'}
            strokeWidth="2"
            strokeLinejoin="round"
            points={series.map((p, i) => `${x(i)},${y(p.mastery[k] ?? 0.2)}`).join(' ')}
          />
        ))}
        <text x={P.l} y={H - 6} className="axis">
          awal
        </text>
        <text x={W - P.r} y={H - 6} className="axis" textAnchor="end">
          kasus ke-{n - 1}
        </text>
      </svg>
      <figcaption className="legend">
        {kcs.map((k) => (
          <span key={k}>
            <i style={{ background: KC_COLORS[k] }} /> {k} {names[k]}
          </span>
        ))}
        <span className="muted">garis putus = batas dikuasai (95%)</span>
      </figcaption>
    </figure>
  );
}

/** Batang aktivitas harian. */
export function ActivityBars({ days }: { days: { t: number; n: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.n));
  return (
    <div className="actbars" role="img" aria-label="Kasus dikerjakan per hari, 14 hari terakhir">
      {days.map((d) => (
        <div key={d.t} className="actbar" title={`${fmt.date(d.t)}: ${d.n} kasus`}>
          <i style={{ height: `${(d.n / max) * 100}%` }} className={d.n ? '' : 'zero'} />
          <span>{new Date(d.t * 1000).getDate()}</span>
        </div>
      ))}
    </div>
  );
}

export function HBars({ data, empty = 'Belum ada data.' }: { data: [string, number][]; empty?: string }) {
  const max = Math.max(1, ...data.map((e) => e[1]));
  if (!data.length) return <p className="muted small">{empty}</p>;
  return (
    <ul className="hbars">
      {data.map(([k, n]) => (
        <li key={k}>
          <span>{k}</span>
          <i style={{ width: `${(n / max) * 100}%` }} />
          <b>{n}</b>
        </li>
      ))}
    </ul>
  );
}

export function heat(p: number | undefined) {
  if (p === undefined) return 'transparent';
  return `hsl(${Math.round(p * 120)} 55% 32%)`;
}

export function Ring({ value, label }: { value: number; label: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring">
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
        <circle cx="32" cy="32" r={r} className="ring-bg" />
        <circle cx="32" cy="32" r={r} className="ring-fg" strokeDasharray={`${c * value} ${c}`} transform="rotate(-90 32 32)" />
      </svg>
      <b>{Math.round(value * 100)}%</b>
      <span>{label}</span>
    </div>
  );
}
