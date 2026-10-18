import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronRight, X } from 'lucide-react';
import { fmt, type Me } from '../api';
import { cn } from '@/lib/utils';
import { Avatar } from '@/pages/dosen/ui';
import { BADGE, FILL, TEXT, TIER, diceTone, type Tone } from '@/lib/status';

type Row = Me['attempts'][number] & { sid?: string; nama?: string };

const dayKey = (t: number) => new Date(t * 1000).toLocaleDateString('sv-SE');
function dayLabel(t: number) {
  const k = dayKey(t);
  const now = Date.now() / 1000;
  if (k === dayKey(now)) return 'Hari ini';
  if (k === dayKey(now - 86400)) return 'Kemarin';
  return new Date(t * 1000).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
}
const time = (t: number) => new Date(t * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

/** hasil keseluruhan satu percobaan: Dice bila ada, kalau tidak dari proporsi KC benar */
function overall(r: Row): Tone {
  if (r.dice !== null) return diceTone(r.dice);
  const v = Object.values(r.kc);
  if (!v.length) return 'none';
  const ok = v.filter(Boolean).length / v.length;
  return ok === 1 ? 'ok' : ok >= 0.5 ? 'warn' : 'bad';
}

/** Riwayat percobaan sebagai garis waktu per hari: titik berwarna hasil, Dice, KC, dan jenis kesalahan. */
/** `showStudent` (dasbor dosen): nama dan avatar mahasiswa tampil di depan setiap baris. */
export function AttemptTimeline({ rows, base = '/riwayat', compact, showStudent }: { rows: Row[]; base?: string; compact?: boolean; showStudent?: boolean }) {
  const reduce = useReducedMotion();
  const groups: { label: string; items: Row[] }[] = [];
  for (const r of rows) {
    const label = dayLabel(r.submitted_at);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(r);
    else groups.push({ label, items: [r] });
  }
  let n = 0;
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.label}>
          <h3 className="mb-1.5 flex items-center gap-2 pl-[6rem] text-[12px] font-semibold uppercase tracking-wide text-ink/45">
            {g.label}
            <span className="rounded-full bg-muted px-1.5 py-px text-[10.5px] font-medium normal-case tracking-normal text-ink/50">{g.items.length}</span>
          </h3>
          <ol className="relative">
            {g.items.map((r, i) => {
              const tone = overall(r);
              const last = i === g.items.length - 1;
              const delay = Math.min(n++, 10) * 0.04;
              return (
                <motion.li key={r.id} initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay }} className="relative grid grid-cols-[3.25rem_1rem_minmax(0,1fr)] items-stretch gap-x-2">
                  <time className="pt-3.5 text-right font-mono text-[12px] tabular-nums text-ink/45">{time(r.submitted_at)}</time>
                  <span className="relative flex justify-center">
                    {!last && <span aria-hidden="true" className="absolute bottom-0 top-6 w-px bg-line" />}
                    {i > 0 && <span aria-hidden="true" className="absolute top-0 h-4 w-px bg-line" />}
                    <span className={cn('relative mt-4 size-2.5 rounded-full ring-4 ring-white', FILL[tone])} />
                  </span>
                  <Link
                    to={`${base}/${r.id}`}
                    className="group my-0.5 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface focus-visible:bg-surface"
                  >
                    {showStudent && r.nama && (
                      <span className="flex w-[12rem] shrink-0 items-center gap-2.5">
                        <Avatar nama={r.nama} className="size-8 text-[11px]" />
                        <span className="min-w-0">
                          <b className="block truncate text-[13.5px] font-medium text-ink">{r.nama}</b>
                          <span className="block truncate font-mono text-[10.5px] text-ink/40">{r.sid}</span>
                        </span>
                      </span>
                    )}
                    <span className="flex w-[9.5rem] shrink-0 items-center gap-2">
                      <b className="font-mono text-[13px] font-semibold text-ink">{r.case_id}</b>
                      <span className={cn('rounded px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide', BADGE[TIER[r.tier] ?? 'none'])}>{r.tier}</span>
                    </span>
                    <span className="flex w-[8.5rem] shrink-0 items-center gap-2">
                      <b className={cn('w-9 text-[15px] font-semibold tabular-nums', TEXT[diceTone(r.dice)])}>{r.dice === null ? '—' : fmt.num(r.dice)}</b>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" title="Dice">
                        <span className={cn('block h-full rounded-full', FILL[diceTone(r.dice)])} style={{ width: `${(r.dice ?? 0) * 100}%` }} />
                      </span>
                    </span>
                    <span className="flex shrink-0 gap-1">
                      {Object.entries(r.kc).map(([k, ok]) => (
                        <span key={k} title={`${k} ${ok ? 'benar' : 'belum tepat'}`} className={cn('flex items-center gap-0.5 rounded-md py-0.5 pl-1 pr-1.5 font-mono text-[10.5px] font-semibold', ok ? BADGE.ok : BADGE.bad)}>
                          {ok ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
                          {k}
                        </span>
                      ))}
                    </span>
                    <span className={cn('min-w-0 flex-1 truncate text-[13px]', r.jenis ? 'text-ink/70' : 'text-ink/40')}>
                      {!compact && r.target_kc !== 'bebas' && <span className="mr-1.5 text-ink/40">sasaran {r.target_kc} ·</span>}
                      {r.jenis ?? 'Tanpa delineasi'}
                    </span>
                    <ChevronRight className="ml-auto size-4 shrink-0 text-ink/25 transition-transform group-hover:translate-x-0.5 group-hover:text-teal" />
                  </Link>
                </motion.li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
