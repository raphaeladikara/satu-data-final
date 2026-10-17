import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BookOpen, Check, ChevronDown, ScanLine } from 'lucide-react';
import { fmt, type Assignment } from '../api';
import { lessonById } from '../content/lessons';
import { cn } from '@/lib/utils';
import { BADGE, FILL, TEXT, dueStatus, type Tone } from '@/lib/status';

const RING: Record<Tone, string> = { ok: '#16a34a', warn: '#d97706', bad: '#dc2626', info: '#2563eb', none: '#94a3b8' };

type Item = { key: string; kind: 'modul' | 'kasus'; label: string; done: boolean; to: string | null };

function items(t: Assignment): Item[] {
  return [
    ...t.lesson_ids.map((l) => ({ key: `m-${l}`, kind: 'modul' as const, label: lessonById(l)?.judul ?? l, done: t.lessons_done.includes(l), to: `/belajar/${l}` })),
    ...t.case_ids.map((c) => ({ key: `k-${c}`, kind: 'kasus' as const, label: c, done: t.cases_done.includes(c), to: t.cases_done.includes(c) ? null : `/latihan?kasus=${c}` })),
  ];
}

/** Cincin kemajuan kecil di kepala kartu tugas. */
function Ring({ value, tone }: { value: number; tone: Tone }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid size-12 shrink-0 place-items-center">
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <motion.circle cx="22" cy="22" r={r} fill="none" stroke={RING[tone]} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value) }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <span className="text-[11px] font-semibold tabular-nums text-ink">{Math.round(value * 100)}%</span>
    </span>
  );
}

/** Satu tugas sebagai daftar periksa: cincin kemajuan, bilah bersegmen, dan langkah yang bisa diklik. */
export function TaskChecklist({ task, defaultOpen }: { task: Assignment; defaultOpen?: boolean }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(defaultOpen ?? !task.tuntas);
  const list = items(task);
  const due = dueStatus(task.due_at, task.tuntas);
  const nextIdx = list.findIndex((x) => !x.done);
  const pct = task.selesai / Math.max(1, task.total);
  const bodyId = `tugas-${task.id}`;

  return (
    <section className={cn('overflow-hidden rounded-2xl card-surface transition-shadow', open && 'shadow-md')}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={bodyId} className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-surface/60 sm:px-6">
        <Ring value={pct} tone={due.tone} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <b className="text-[16px] font-semibold leading-snug">{task.judul}</b>
            <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold', BADGE[due.tone])}>{due.label}</span>
          </span>
          <span className="mt-1 block text-[12.5px] text-ink/50">
            {task.selesai}/{task.total} langkah · diberikan {fmt.date(task.created_at)}
            {task.due_at ? ` · tenggat ${fmt.dateTime(task.due_at)}` : ''}
          </span>
        </span>
        <ChevronDown className={cn('size-5 shrink-0 text-ink/35 transition-transform duration-300', open && 'rotate-180')} />
      </button>

      {/* bilah bersegmen: satu ruas per langkah */}
      <div className="flex gap-1 px-5 pb-4 sm:px-6" aria-hidden="true">
        {list.map((x, i) => (
          <span key={x.key} className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            {x.done && <motion.span initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.4, delay: i * 0.05 }} className="absolute inset-0 origin-left rounded-full bg-ok" />}
            {i === nextIdx && <span className="absolute inset-0 animate-pulse rounded-full bg-info/45" />}
          </span>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={bodyId} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduce ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <div className="border-t border-line px-5 pb-5 pt-4 sm:px-6">
              {task.catatan && <p className="mb-4 rounded-xl bg-surface px-4 py-3 text-[14px] leading-relaxed text-ink/75">{task.catatan}</p>}
              <ol>
                {list.map((x, i) => (
                  <Step key={x.key} item={x} state={x.done ? 'done' : i === nextIdx ? 'next' : 'todo'} first={i === 0} last={i === list.length - 1} prevDone={i > 0 && list[i - 1].done} />
                ))}
              </ol>
              <p className="mt-4 text-[12px] leading-relaxed text-ink/45">Kasus dihitung selesai bila jawabannya dikirim setelah tugas diberikan; modul dihitung selesai bila kuisnya lulus.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Step({ item, state, first, last, prevDone }: { item: Item; state: 'done' | 'next' | 'todo'; first: boolean; last: boolean; prevDone: boolean }) {
  const Icon = item.kind === 'modul' ? BookOpen : ScanLine;
  const action = state === 'done' ? (item.kind === 'modul' ? 'Ulas lagi' : null) : item.kind === 'modul' ? 'Buka modul' : 'Kerjakan kasus';
  const body = (
    <>
      <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', state === 'done' ? 'bg-muted text-ink/40' : 'bg-mint text-teal')}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink/40">{item.kind}</span>
        <span className={cn('block truncate text-[14.5px] leading-snug', item.kind === 'kasus' && 'font-mono text-[14px]', state === 'done' ? 'text-ink/45 line-through decoration-ink/25' : 'font-medium text-ink')}>{item.label}</span>
      </span>
      {state === 'done' && <span className={cn('hidden shrink-0 text-[12px] font-semibold sm:inline', TEXT.ok)}>Selesai</span>}
      {action && (
        <span
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
            state === 'next' ? 'bg-teal text-white group-hover:bg-teal-800' : state === 'todo' ? 'border border-line text-ink/70 group-hover:border-teal group-hover:text-teal' : 'text-ink/45 group-hover:text-teal',
          )}
        >
          {action}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      )}
    </>
  );
  return (
    <li className="relative flex gap-3">
      {/* simpul + garis penghubung */}
      <span className="relative flex w-6 shrink-0 justify-center">
        {!first && <span aria-hidden="true" className={cn('absolute top-0 h-1/2 w-0.5', prevDone ? 'bg-ok' : 'bg-line')} />}
        {!last && <span aria-hidden="true" className={cn('absolute bottom-0 top-1/2 w-0.5', state === 'done' ? 'bg-ok' : 'bg-line')} />}
        <span
          className={cn(
            'relative z-10 my-auto grid size-6 place-items-center rounded-full',
            state === 'done' ? 'bg-ok text-white' : state === 'next' ? 'bg-white ring-2 ring-info' : 'bg-white ring-2 ring-line',
          )}
        >
          {state === 'done' && <Check className="size-3.5" strokeWidth={3} />}
          {state === 'next' && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-info/30" />
              <span className="size-2 rounded-full bg-info" />
            </>
          )}
        </span>
      </span>
      {item.to ? (
        <motion.div className="my-1 min-w-0 flex-1" whileTap={{ scale: 0.985 }}>
          <Link
            to={item.to}
            className={cn(
              'group flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-[0_6px_16px_-10px_rgba(15,23,42,.35)]',
              state === 'next' ? 'border-info/40 bg-info-soft/40 hover:border-info' : state === 'done' ? 'border-transparent bg-surface hover:border-line' : 'border-line bg-white hover:border-ink/25',
            )}
          >
            {body}
          </Link>
        </motion.div>
      ) : (
        <div className="my-1 flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-surface px-3.5 py-2.5">{body}</div>
      )}
    </li>
  );
}

/** Ringkasan semua tugas: jumlah aktif, mendesak, tuntas. */
export function TaskSummary({ list }: { list: Assignment[] }) {
  const st = list.map((t) => dueStatus(t.due_at, t.tuntas));
  const steps = list.reduce((a, t) => a + t.total, 0);
  const done = list.reduce((a, t) => a + t.selesai, 0);
  const cells: [string, number, Tone][] = [
    ['Lewat tenggat', st.filter((s) => s.tone === 'bad').length, 'bad'],
    ['Segera (≤ 2 hari)', st.filter((s) => s.tone === 'warn').length, 'warn'],
    ['Berjalan', st.filter((s) => s.tone === 'info').length, 'info'],
    ['Tuntas', st.filter((s) => s.tone === 'ok').length, 'ok'],
  ];
  return (
    <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
      <div className="rounded-2xl card-surface p-5">
        <div className="flex items-baseline justify-between text-[13px]">
          <span className="font-medium text-ink/60">Kemajuan semua tugas</span>
          <b className="text-[18px] font-semibold tabular-nums">
            {done}
            <span className="text-[13px] font-normal text-ink/40">/{steps} langkah</span>
          </b>
        </div>
        <span className="mt-3 block h-2.5 overflow-hidden rounded-full bg-muted">
          <motion.span initial={{ width: 0 }} animate={{ width: `${(done / Math.max(1, steps)) * 100}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} className="block h-full rounded-full bg-teal" />
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cells.map(([l, n, t]) => (
          <div key={l} className={cn('rounded-2xl p-4', n ? BADGE[t] : 'bg-surface text-ink/40')}>
            <b className="block text-[1.5rem] font-semibold leading-none tabular-nums">{n}</b>
            <span className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium">
              <span className={cn('size-1.5 rounded-full', n ? FILL[t] : 'bg-ink/20')} /> {l}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
