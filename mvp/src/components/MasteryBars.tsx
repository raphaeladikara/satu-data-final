import type { KCInfo } from '../api';

export default function MasteryBars(p: { kc: Record<string, KCInfo>; before?: Record<string, number>; after?: Record<string, number> }) {
  const keys = Object.keys(p.kc);
  if (!keys.length || !p.before) return <p className="muted small">Memuat…</p>;
  return (
    <ul className="mastery">
      {keys.map((k) => {
        const info = p.kc[k];
        const b = p.before![k] ?? 0;
        const a = p.after?.[k];
        const val = a ?? b;
        const delta = a !== undefined ? a - b : 0;
        return (
          <li key={k} className={info.aktif ? '' : 'inactive'} title={`Bukti: ${info.bukti}`}>
            <span className="kc">{k}</span>
            <span className="name">{info.nama}</span>
            {info.aktif ? (
              <>
                <span className="bar">
                  <i style={{ width: `${Math.round(val * 100)}%` }} className={val >= 0.95 ? 'mastered' : ''} />
                </span>
                <span className="pct">
                  {Math.round(val * 100)}%
                  {Math.abs(delta) >= 0.005 && <em className={delta > 0 ? 'up' : 'down'}>{delta > 0 ? `+${Math.round(delta * 100)}` : Math.round(delta * 100)}</em>}
                </span>
              </>
            ) : (
              <span className="na">belum di MVP</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
