import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ArrowDownUp, Bot, ChevronDown, Search, ShieldAlert, type LucideIcon } from 'lucide-react';
import { type StudentRow, type TutorLog } from '../../api';
import { cn } from '@/lib/utils';
import Markdown from '@/components/Markdown';
import { BADGE, FILL, TEXT, type Tone } from '@/lib/status';

/** Komponen kecil bersama halaman dosen: avatar, filter pil, tab segmen, tile angka, status mahasiswa. */

export function initials(nama: string) {
  return (
    nama
      .split(/\s+/)
      .filter((w) => /^[A-Za-z]/.test(w))
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || '?'
  );
}

// pastel lembut untuk avatar inisial; warna dipilih dari hash nama supaya tetap sama di semua halaman
const AV = [
  ['#fde2e1', '#9f1239'],
  ['#fde9cc', '#9a3412'],
  ['#e0dcfb', '#4c1d95'],
  ['#d3efe2', '#065f46'],
  ['#d5e9f6', '#075985'],
  ['#f4e3c1', '#713f12'],
  ['#f3dcef', '#86198f'],
];
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export function Avatar({ nama, className }: { nama: string; className?: string }) {
  const [bg, fg] = AV[hash(nama) % AV.length];
  return (
    <span className={cn('grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold ring-2 ring-white', className)} style={{ background: bg, color: fg }} title={nama}>
      {initials(nama)}
    </span>
  );
}

export function AvatarStack({ names, max = 4, className }: { names: string[]; max?: number; className?: string }) {
  const rest = names.length - max;
  return (
    <span className={cn('flex items-center -space-x-2', className)}>
      {names.slice(0, max).map((n, i) => (
        <Avatar key={`${n}-${i}`} nama={n} className="size-7 text-[10px]" />
      ))}
      {rest > 0 && <span className="grid size-7 place-items-center rounded-full bg-white text-[10px] font-semibold text-ink/60 ring-2 ring-white">+{rest}</span>}
    </span>
  );
}

/** Pemilih bergaya pil (referensi "Department ⌄"): select bawaan supaya tetap aksesibel. */
export function PillSelect({ value, onChange, label, children, className }: { value: string | number; onChange: (v: string) => void; label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('relative inline-flex shrink-0 items-center', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-9 w-full cursor-pointer appearance-none rounded-full border border-line bg-white pl-3.5 pr-8 text-[13px] font-medium text-ink/75 outline-none transition-colors hover:border-ink/25 focus-visible:border-teal"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 size-3.5 text-ink/45" />
    </label>
  );
}

export function KelasSelect({ kelas, setKelas, options, className }: { kelas: number | null; setKelas: (k: number | null) => void; options: { id: number; nama: string }[]; className?: string }) {
  return (
    <PillSelect value={kelas ?? ''} onChange={(v) => setKelas(v ? Number(v) : null)} label="Saring kelas" className={className}>
      <option value="">Semua kelas</option>
      {options.map((k) => (
        <option key={k.id} value={k.id}>
          {k.nama}
        </option>
      ))}
    </PillSelect>
  );
}

export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <label className={cn('relative flex min-w-[10rem] flex-1 items-center', className)}>
      <Search className="pointer-events-none absolute left-3.5 size-4 text-ink/40" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-full border border-line bg-white pl-10 pr-3.5 text-[13.5px] outline-none transition-colors hover:border-ink/25 focus:border-teal"
      />
    </label>
  );
}

/** Tab segmen abu-abu (sama dengan Riwayat dan Bank kasus mahasiswa). */
export function Seg<T extends string>({ items, value, onChange, label }: { items: { v: T; label: ReactNode; n?: number; dot?: string; icon?: LucideIcon }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
      {items.map(({ v, label: l, n, dot, icon: Icon }) => (
        <button
          key={v || 'all'}
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors', value === v ? 'bg-white text-ink shadow-sm' : 'text-ink/55 hover:text-ink')}
        >
          {dot && <span className={cn('size-2 rounded-full', dot)} />}
          {Icon && <Icon className="size-3.5" />}
          {l}
          {n !== undefined && <span className="text-[11px] tabular-nums text-ink/40">{n}</span>}
        </button>
      ))}
    </div>
  );
}

const PILL_VARIANT = {
  outline: 'border border-line bg-white text-ink/75 hover:border-ink/25 hover:text-ink',
  primary: 'bg-teal text-white hover:bg-teal-800',
  dark: 'bg-ink text-white hover:bg-ink/85',
  danger: 'border border-line bg-white text-bad-ink hover:border-bad/40 hover:bg-bad-soft',
  ghost: 'text-ink/60 hover:bg-ink/5 hover:text-ink',
};

export function PillButton({ icon: Icon, children, variant = 'outline', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: LucideIcon; variant?: keyof typeof PILL_VARIANT }) {
  return (
    <button
      {...p}
      className={cn(
        'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition-[background-color,border-color,color,transform] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
        !children && 'w-9 px-0',
        PILL_VARIANT[variant],
        className,
      )}
    >
      {Icon && <Icon className="size-4" />}
      {children}
    </button>
  );
}

export const pillLink = (variant: keyof typeof PILL_VARIANT = 'outline', className?: string) =>
  cn('inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition-colors', PILL_VARIANT[variant], className);

const STAT_TONE: Record<string, string> = { ...BADGE, teal: 'bg-mint text-teal' };

/** Tile angka terang (sama dengan Beranda mahasiswa). */
export function Stat({ icon: Icon, tone, label, value, of, hint }: { icon: LucideIcon; tone: Tone | 'teal'; label: string; value: string; of?: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl card-surface p-4">
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', STAT_TONE[tone])}>
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0">
        <b className="block text-[1.4rem] font-semibold leading-none tabular-nums">
          {value}
          {of && <span className="text-[0.95rem] font-normal text-ink/35">{of}</span>}
        </b>
        <p className="mt-1 truncate text-[12px] text-ink/55">
          {label}
          {hint && <span className={cn('ml-1 font-medium', tone !== 'teal' && TEXT[tone])}>· {hint}</span>}
        </p>
      </div>
    </div>
  );
}

export function CardTitle({ icon: Icon, title, sub, action }: { icon?: LucideIcon; title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold tracking-tight">
          {Icon && <Icon className="size-4 text-teal" />}
          {title}
        </h2>
        {sub && <p className="mt-0.5 text-[12px] text-ink/50">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/** Judul kolom yang bisa diklik untuk mengurutkan. */
export function SortTh({ k, sort, setSort, children, className }: { k: string; sort: string; setSort: (k: string) => void; children: ReactNode; className?: string }) {
  const on = sort === k;
  return (
    <th className={cn('px-3 py-3 font-medium', className)} aria-sort={on ? 'ascending' : undefined}>
      <button onClick={() => setSort(k)} className={cn('inline-flex items-center gap-1.5 whitespace-nowrap transition-colors hover:text-ink', on ? 'text-ink' : '')}>
        <ArrowDownUp className={cn('size-3', on ? 'text-teal' : 'text-ink/30')} />
        {children}
      </button>
    </th>
  );
}

export function StatusPill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium', BADGE[tone], className)}>
      <span className={cn('size-1.5 rounded-full', FILL[tone])} />
      {children}
    </span>
  );
}

/** Status pantau seorang mahasiswa, diturunkan dari tanda yang dihitung server. */
export function studentStatus(s: Pick<StudentRow, 'n_kasus' | 'flags'>): { key: 'aktif' | 'bimbingan' | 'tidak_aktif' | 'belum'; tone: Tone; label: string } {
  if (!s.n_kasus) return { key: 'belum', tone: 'none', label: 'Belum mulai' };
  if (s.flags.includes('banyak jawaban salah')) return { key: 'bimbingan', tone: 'bad', label: 'Perlu bimbingan' };
  if (s.flags.some((f) => f.startsWith('tidak aktif'))) return { key: 'tidak_aktif', tone: 'warn', label: 'Tidak aktif' };
  return { key: 'aktif', tone: 'ok', label: 'Aktif' };
}

const MODE_TONE: Record<string, Tone> = { sokratik: 'info', penjelasan: 'ok', rujukan: 'warn' };

/** Satu tanya-jawab tutor sebagai gelembung percakapan, dengan hasil pemeriksa fakta. */
export function TutorThread({ t, who, meta }: { t: TutorLog; who?: string; meta?: ReactNode }) {
  const flagged = t.issues.length > 0;
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink/50">
        <span className={cn('rounded-md px-1.5 py-0.5 font-semibold capitalize', BADGE[MODE_TONE[t.mode] ?? 'none'])}>{t.mode}</span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-ink/60">{t.phase === 'sebelum_submit' ? 'sebelum kunci terbuka' : 'sesudah kunci terbuka'}</span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-ink/55">{t.source === 'llm' ? t.model : t.source ?? '—'}</span>
        {meta}
      </div>
      <div className="flex items-start gap-2.5">
        <Avatar nama={who || 'Mahasiswa'} className="size-7 text-[10px]" />
        <p className="max-w-[46rem] rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink/85">{t.message}</p>
      </div>
      <div className="flex items-start gap-2.5">
        <span className={cn('grid size-7 shrink-0 place-items-center rounded-full', flagged ? 'bg-bad-soft text-bad-ink' : 'bg-mint text-teal')}>
          <Bot className="size-3.5" />
        </span>
        <div className={cn('max-w-[46rem] rounded-2xl rounded-tl-md border px-3.5 py-2.5 text-[13.5px] leading-relaxed', flagged ? 'border-bad/25 bg-bad-soft/40' : 'border-teal/15 bg-mint/50')}>
          <Markdown text={t.response} className="text-ink/85" />
          {flagged && (
            <p className="mt-2 flex items-start gap-1.5 border-t border-bad/15 pt-2 text-[12.5px] font-medium text-bad-ink">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" /> Pemeriksa fakta: {t.issues.join('; ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Unduh tabel kecil sebagai CSV (dipakai aksi massal). */
export function downloadCsv(name: string, rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
