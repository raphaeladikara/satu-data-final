import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bot,
  Brain,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Flame,
  Gauge,
  GraduationCap,
  HeartPulse,
  LayoutGrid,
  Link2,
  Lock,
  Microscope,
  Pencil,
  Plus,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Timer,
  Trash2,
  UserPlus,
  Users,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { BADGE, FILL, TEXT, TIER, diceTone, dueStatus, nihssTone, type Tone } from '@/lib/status';
import { cn } from '@/lib/utils';
import { api, fmt, type DosenAssignment, type DosenCase, type Kelas, type Overview, type TutorLog } from '../../api';
import ReadViewer from '../../components/ReadViewer';
import { Empty, LoadError, Loading } from '../../components/Shell';
import { LESSONS, lessonById } from '../../content/lessons';
import { dailyCounts, type Session } from '@/lib/activity';
import { useKelasFilter } from './Ringkasan';
import { Avatar, AvatarStack, CardTitle, KelasSelect, PillButton, PillSelect, SearchBox, Seg, Stat, StatusPill, TutorThread } from './ui';

const EASE = [0.22, 1, 0.36, 1] as const;
const field = 'h-10 w-full rounded-xl border border-line bg-white px-3 text-[14px] outline-none transition-colors hover:border-ink/25 focus:border-teal';

function PageTitle({ title, sub, actions }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-[clamp(2rem,3.4vw,2.8rem)] leading-[1.08] tracking-[-0.01em]">{title}</h1>
        {sub && <p className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-ink/55">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// --- kelas -------------------------------------------------------------------

// kartu kelas pastel (referensi 2); warna dan ikon dipilih dari id kelas supaya tetap sama
const PASTEL = ['#f7d4d4', '#f9e3c4', '#dcd8fb', '#cdeedf', '#d3e8f6', '#f2ecbe'];
const PASTEL_DEEP = ['#efb8b8', '#f2cd9b', '#c4bdf6', '#a9e0c8', '#b1d6ef', '#e6dc95'];
const ICONS: LucideIcon[] = [Brain, Stethoscope, Microscope, HeartPulse, Activity, GraduationCap];
const look = (id: number) => ({ bg: PASTEL[id % PASTEL.length], deep: PASTEL_DEEP[id % PASTEL.length], Icon: ICONS[id % ICONS.length] });

type KelasStat = { names: string[]; kasus: number; dice: number | null; aktif: number; perhatian: number };
type KelasCat = '' | 'aktif' | 'perhatian' | 'kosong';

export function KelasPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [list, setList] = useState<Kelas[] | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const [selId, setSelId] = useState<number | null>(null);
  const [cat, setCat] = useState<KelasCat>('');
  const [nama, setNama] = useState('');
  const [err, setErr] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const load = () => {
    setLoadErr('');
    api
      .classes()
      .then((l) => {
        setList(l);
        setSelId((s) => (s && l.some((k) => k.id === s) ? s : l[0]?.id ?? null));
      })
      .catch((e) => setLoadErr((e as Error).message));
    api.overview(null).then(setOv).catch(() => setOv(null));
  };
  useEffect(load, []);

  const stats = useMemo(() => {
    const o: Record<number, KelasStat> = {};
    const now = Date.now() / 1000;
    for (const s of ov?.students ?? []) {
      const k = (o[s.kelas_id] ??= { names: [], kasus: 0, dice: null, aktif: 0, perhatian: 0 });
      k.names.push(s.nama);
      k.kasus += s.n_kasus;
      if (now - s.last_active < 7 * 86400 && s.n_kasus) k.aktif++;
      if (s.flags.length) k.perhatian++;
    }
    for (const [id, k] of Object.entries(o)) {
      const d = (ov?.students ?? []).filter((s) => s.kelas_id === Number(id) && s.mean_dice !== null).map((s) => s.mean_dice!);
      k.dice = d.length ? d.reduce((a, b) => a + b, 0) / d.length : null;
    }
    return o;
  }, [ov]);

  const topId = useMemo(() => {
    const e = Object.entries(stats).sort((a, b) => b[1].kasus - a[1].kasus)[0];
    return e && e[1].kasus > 0 ? Number(e[0]) : null;
  }, [stats]);

  const all = list ?? [];
  const inCat = (k: Kelas) => {
    const s = stats[k.id];
    return cat === '' || (cat === 'aktif' ? !!s?.aktif : cat === 'perhatian' ? !!s?.perhatian : k.n_mahasiswa === 0);
  };
  const shown = all.filter(inCat);
  const cats: { v: KelasCat; label: string; icon: LucideIcon }[] = [
    { v: '', label: 'Semua kelas', icon: LayoutGrid },
    { v: 'aktif', label: 'Aktif minggu ini', icon: Flame },
    { v: 'perhatian', label: 'Perlu perhatian', icon: AlertTriangle },
    { v: 'kosong', label: 'Belum ada mahasiswa', icon: UserPlus },
  ];
  const sel = all.find((k) => k.id === selId) ?? null;

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErr('');
    setBusy(true);
    try {
      const k = await api.createClass(nama);
      setNama('');
      setCreating(false);
      setSelId(k.id);
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell wide>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <h1 className="font-serif text-[clamp(2.2rem,4.2vw,3.4rem)] leading-[1.04] tracking-[-0.015em]">
            Kelola kelasmu,
            <br />
            <em className="text-teal">bagikan kodenya.</em>
          </h1>
          <p className="mt-3 max-w-2xl text-[14.5px] text-ink/55">Mahasiswa bergabung dengan kode kelas atau tautan pendaftaran. Anda hanya melihat mahasiswa di kelas Anda sendiri.</p>

          {params.get('baru') && list?.length === 0 && (
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-teal/20 bg-mint/60 p-4 text-[14px]">
              <CheckCircle2 className="size-5 shrink-0 text-teal" />
              <span>
                <b className="font-semibold">Akun dosen siap.</b> Buat kelas pertama Anda, misalnya “Blok Neurologi 2026 – Kelompok A”.
              </span>
            </div>
          )}

          <div className="relative mt-6">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {cats.map(({ v, label, icon: Icon }) => {
                const on = cat === v;
                const n = v === '' ? all.length : all.filter((k) => (v === 'aktif' ? stats[k.id]?.aktif : v === 'perhatian' ? stats[k.id]?.perhatian : k.n_mahasiswa === 0)).length;
                return (
                  <button
                    key={v || 'all'}
                    onClick={() => setCat(v)}
                    aria-pressed={on}
                    className={cn('flex shrink-0 items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 text-[13px] font-medium transition-colors', on ? 'bg-ink text-white' : 'bg-muted text-ink/70 hover:bg-ink/10')}
                  >
                    <span className={cn('grid size-8 place-items-center rounded-full', on ? 'bg-white text-ink' : 'bg-white text-ink/70')}>
                      <Icon className="size-4" />
                    </span>
                    {label}
                    <span className={cn('text-[11px] tabular-nums', on ? 'text-white/60' : 'text-ink/40')}>{n}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mb-3 mt-6 text-[13px] font-medium text-ink/50">{cat ? cats.find((c) => c.v === cat)?.label : 'Kelas kamu'}</p>
          {!list ? (
            loadErr ? <LoadError message={loadErr} onRetry={load} /> : <Loading />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {shown.map((k, i) => {
                const s = stats[k.id];
                const { bg, Icon } = look(k.id);
                const on = k.id === selId;
                return (
                  <motion.button
                    key={k.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.04, ease: EASE }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => setSelId(k.id)}
                    aria-pressed={on}
                    className={cn('group relative flex min-h-[11.5rem] flex-col rounded-[1.4rem] p-5 text-left transition-[box-shadow,transform] hover:-translate-y-0.5', on ? 'shadow-[0_0_0_2px_#0f172a]' : 'hover:shadow-[0_14px_30px_-18px_rgba(15,23,42,.45)]')}
                    style={{ background: bg }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex items-center gap-2.5 text-[12.5px] font-medium text-ink/70">
                        <span className="grid size-9 place-items-center rounded-full bg-white text-ink">
                          <Icon className="size-[18px]" />
                        </span>
                        {k.n_mahasiswa} mahasiswa
                      </span>
                      <span className="flex gap-1.5">
                        {s?.dice != null && (
                          <span className="flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11.5px] font-semibold tabular-nums">
                            <Gauge className={cn('size-3.5', TEXT[diceTone(s.dice)])} /> {fmt.num(s.dice)}
                          </span>
                        )}
                        {topId === k.id && (
                          <span className="flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 text-[11.5px] font-semibold text-warn-ink">
                            <Flame className="size-3.5" /> Teraktif
                          </span>
                        )}
                      </span>
                    </div>
                    <b className="mt-4 line-clamp-2 text-[20px] font-medium leading-snug tracking-[-0.01em] text-ink">{k.nama}</b>
                    <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                      <span className="text-[12px] text-ink/60">
                        {s?.kasus ?? 0} kasus · kode <b className="font-mono font-semibold text-ink/80">{k.kode}</b>
                        {!!s?.perhatian && <span className="ml-1.5 font-semibold text-bad-ink">· {s.perhatian} perlu perhatian</span>}
                      </span>
                      {s?.names.length ? <AvatarStack names={s.names} max={3} /> : null}
                    </div>
                  </motion.button>
                );
              })}

              {cat === '' && (
                <div className="flex min-h-[11.5rem] flex-col rounded-[1.4rem] border-2 border-dashed border-ink/15 p-5">
                  {creating || all.length === 0 ? (
                    <form onSubmit={create} className="flex h-full flex-col">
                      <span className="flex items-center gap-2.5 text-[13px] font-medium text-ink/70">
                        <span className="grid size-9 place-items-center rounded-full bg-mint text-teal">
                          <Plus className="size-[18px]" />
                        </span>
                        Kelas baru
                      </span>
                      <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. Blok Neurologi – Kelompok A" aria-label="Nama kelas" required minLength={2} autoFocus={creating} className={cn(field, 'mt-4')} />
                      {err && <p className="mt-1.5 text-[12.5px] text-bad-ink">{err}</p>}
                      <div className="mt-auto flex gap-2 pt-3">
                        <PillButton variant="primary" type="submit" icon={Check} disabled={busy}>
                          {busy ? 'Membuat…' : 'Buat kelas'}
                        </PillButton>
                        {all.length > 0 && (
                          <PillButton variant="ghost" type="button" onClick={() => setCreating(false)}>
                            Batal
                          </PillButton>
                        )}
                      </div>
                    </form>
                  ) : (
                    <button onClick={() => setCreating(true)} className="group flex h-full flex-col items-center justify-center gap-2 text-ink/50 transition-colors hover:text-teal">
                      <span className="grid size-11 place-items-center rounded-full bg-muted transition-colors group-hover:bg-mint">
                        <Plus className="size-5" />
                      </span>
                      <b className="text-[14px] font-medium">Buat kelas baru</b>
                    </button>
                  )}
                </div>
              )}
              {shown.length === 0 && cat !== '' && (
                <div className="sm:col-span-2">
                  <Empty title="Tidak ada kelas di kategori ini" />
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          {sel ? (
            <KelasPanel
              k={sel}
              stat={stats[sel.id]}
              onChanged={load}
              onDeleted={() => {
                setSelId(null);
                load();
              }}
              onOpenStudents={() => {
                try {
                  localStorage.setItem('sinaps-dosen-kelas', String(sel.id));
                } catch {
                  /* diblokir */
                }
                nav('/dosen/mahasiswa');
              }}
            />
          ) : (
            <div className="rounded-[1.75rem] bg-surface p-6 ring-1 ring-line">
              <Empty title="Pilih kelas">Detail kelas, kode, dan aktivitasnya muncul di sini.</Empty>
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

/** Panel kanan kelas terpilih (referensi 2): identitas, mahasiswa, grafik aktivitas, kode, dan aksi. */
function KelasPanel({ k, stat, onChanged, onDeleted, onOpenStudents }: { k: Kelas; stat?: KelasStat; onChanged: () => void; onDeleted: () => void; onOpenStudents: () => void }) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [copied, setCopied] = useState('');
  const { bg, deep, Icon } = look(k.id);
  useEffect(() => {
    setOv(null);
    api.overview(k.id).then(setOv).catch(() => setOv(null));
  }, [k.id]);

  // kasus per minggu, 8 minggu terakhir
  const weeks = useMemo(() => {
    const sessions: Session[] = ov ? ov.sessions ?? ov.recent.map((r) => [r.started_at || r.submitted_at, r.submitted_at] as Session) : [];
    const days = dailyCounts(sessions);
    const counts: Record<string, number> = {};
    for (const d of days) counts[d.date] = d.count;
    const out: { label: string; n: number }[] = [];
    const now = new Date();
    for (let w = 7; w >= 0; w--) {
      let n = 0;
      let first: Date | null = null;
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - w * 7 - i);
        first ??= d;
        n += counts[d.toLocaleDateString('sv-SE')] ?? 0;
      }
      out.push({ label: first!.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), n });
    }
    return out;
  }, [ov]);
  const max = Math.max(1, ...weeks.map((w) => w.n));
  const total = weeks.reduce((a, w) => a + w.n, 0);
  const prev = weeks.slice(0, 4).reduce((a, w) => a + w.n, 0);
  const last4 = weeks.slice(4).reduce((a, w) => a + w.n, 0);
  const link = `${location.origin}/daftar?kelas=${k.kode}`;
  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      /* clipboard diblokir */
    }
  };
  const attention = (ov?.students ?? []).filter((s) => s.flags.length).slice(0, 3);

  return (
    <motion.div key={k.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="space-y-3 rounded-[1.75rem] bg-surface p-4 ring-1 ring-line sm:p-5">
      <div className="flex flex-col items-center pb-1 pt-2 text-center">
        <span className="relative grid size-20 place-items-center rounded-full" style={{ background: `conic-gradient(${deep} 0 ${Math.round(((stat?.aktif ?? 0) / Math.max(1, k.n_mahasiswa)) * 100)}%, ${bg} 0)` }} title="Lingkar = porsi mahasiswa aktif 7 hari">
          <span className="grid size-16 place-items-center rounded-full bg-white">
            <Icon className="size-7 text-ink/80" />
          </span>
        </span>
        <b className="mt-3 text-[18px] font-semibold leading-snug">{k.nama}</b>
        <span className="text-[12px] text-ink/50">
          {k.created_at ? `Dibuat ${fmt.date(k.created_at)} · ` : ''}
          {stat?.aktif ?? 0} aktif 7 hari
        </span>
      </div>

      <button onClick={onOpenStudents} className="group flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left ring-1 ring-line transition-shadow hover:shadow-sm">
        <Users className="size-5 shrink-0 text-ink/60" />
        <span className="flex-1 text-[13.5px]">
          <b className="font-semibold tabular-nums">{k.n_mahasiswa}</b> mahasiswa
        </span>
        {stat?.names.length ? <AvatarStack names={stat.names} max={3} /> : null}
        <ChevronRight className="size-4 text-ink/30 transition-transform group-hover:translate-x-0.5 group-hover:text-teal" />
      </button>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] font-medium text-ink/55">Aktivitas · 8 minggu</span>
          {stat?.dice != null && (
            <span className={cn('rounded-full px-2 py-0.5 text-[11.5px] font-semibold', BADGE[diceTone(stat.dice)])}>Dice {fmt.num(stat.dice)}</span>
          )}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <b className="text-[1.6rem] font-semibold leading-none tabular-nums">{total}</b>
          <span className="text-[13px] text-ink/50">kasus</span>
          {ov && (prev || last4) ? (
            <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[11.5px] font-semibold', last4 >= prev ? BADGE.ok : BADGE.warn)}>
              {last4 >= prev ? '+' : '−'}
              {Math.abs(last4 - prev)} dari 4 minggu sebelumnya
            </span>
          ) : null}
        </div>
        <div className="mt-4 flex h-28 items-end gap-1.5 border-b border-dashed border-ink/15 pb-1" role="img" aria-label="Kasus per minggu, 8 minggu terakhir">
          {weeks.map((w, i) => {
            const last = i === weeks.length - 1;
            return (
              <div key={w.label} className="flex h-full flex-1 flex-col justify-end" title={`Minggu ${w.label}: ${w.n} kasus`}>
                <motion.span
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(w.n ? 8 : 4, (w.n / max) * 100)}%` }}
                  transition={{ duration: 0.6, delay: i * 0.04, ease: EASE }}
                  className={cn('block w-full rounded-lg', last && 'ring-2 ring-ink ring-offset-1')}
                  style={{ background: w.n ? (last ? deep : bg) : '#f1f5f9' }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-1.5 text-[10px] text-ink/40">
          {weeks.map((w, i) => (
            <span key={w.label} className={cn('flex-1 truncate text-center', i === weeks.length - 1 && 'font-semibold text-ink/70')}>
              {i % 2 === 1 || i === weeks.length - 1 ? w.label : ''}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <span className="text-[12.5px] font-medium text-ink/55">Kode kelas</span>
        <div className="mt-1 flex items-center justify-between gap-2">
          <b className="font-mono text-[1.5rem] font-semibold tracking-[0.12em]">{k.kode}</b>
          <PillButton icon={copied === 'k' ? Check : Copy} onClick={() => copy(k.kode, 'k')}>
            {copied === 'k' ? 'Tersalin' : 'Salin'}
          </PillButton>
        </div>
        <button onClick={() => copy(link, 'l')} className="mt-3 flex w-full items-center gap-2 rounded-xl bg-surface px-3 py-2 text-left text-[12.5px] text-ink/60 transition-colors hover:text-teal">
          <Link2 className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{link.replace(/^https?:\/\//, '')}</span>
          <b className="shrink-0 font-medium">{copied === 'l' ? 'Tersalin' : 'Salin tautan'}</b>
        </button>
      </div>

      {attention.length > 0 && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-bad-ink">
            <AlertTriangle className="size-3.5" /> Perlu perhatian
          </span>
          <ul className="mt-2 space-y-1">
            {attention.map((s) => (
              <li key={s.sid}>
                <Link to={`/dosen/mahasiswa/${s.sid}`} className="flex items-center gap-2.5 rounded-lg p-1.5 text-[13px] transition-colors hover:bg-surface">
                  <Avatar nama={s.nama} className="size-7 text-[10px]" />
                  <span className="min-w-0 flex-1 truncate font-medium">{s.nama}</span>
                  <span className="shrink-0 text-[11px] text-ink/45">{s.flags[0]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <PillButton
          icon={Pencil}
          onClick={async () => {
            const n = prompt('Nama kelas baru', k.nama);
            if (n && n.trim()) {
              await api.renameClass(k.id, n);
              onChanged();
            }
          }}
        >
          Ganti nama
        </PillButton>
        <PillButton
          icon={RefreshCw}
          onClick={async () => {
            if (confirm('Buat kode baru? Kode lama tidak bisa dipakai lagi; mahasiswa yang sudah bergabung tetap di kelas.')) {
              await api.newClassCode(k.id);
              onChanged();
            }
          }}
        >
          Kode baru
        </PillButton>
        <PillButton
          icon={Trash2}
          variant="danger"
          onClick={async () => {
            if (confirm(`Hapus kelas ${k.nama}? Mahasiswa dikeluarkan dari kelas dan tugasnya dihapus. Riwayat latihan mahasiswa tetap tersimpan.`)) {
              await api.deleteClass(k.id);
              onDeleted();
            }
          }}
        >
          Hapus
        </PillButton>
      </div>
    </motion.div>
  );
}

// --- tugas -------------------------------------------------------------------

const RING: Record<Tone, string> = { ok: '#16a34a', warn: '#d97706', bad: '#dc2626', info: '#2563eb', none: '#94a3b8' };

function ProgressRing({ value, tone, size = 52 }: { value: number; tone: Tone; size?: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#eef2f6" strokeWidth="5" />
        <motion.circle cx="24" cy="24" r={r} fill="none" stroke={RING[tone]} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value) }} transition={{ duration: 0.9, ease: EASE }} />
      </svg>
      <span className="text-[11.5px] font-semibold tabular-nums">{Math.round(value * 100)}%</span>
    </span>
  );
}

type TaskFilter = '' | 'jalan' | 'lewat' | 'tuntas';

function taskState(t: DosenAssignment) {
  const n = t.progress.length;
  const allDone = n > 0 && t.n_tuntas === n;
  const due = dueStatus(t.due_at, allDone);
  const started = t.progress.filter((p) => !p.tuntas && p.selesai > 0).length;
  return { n, allDone, due, started, idle: n - t.n_tuntas - started };
}

export function TugasDosen() {
  const [list, setList] = useState<DosenAssignment[] | null>(null);
  const [kelas, setKelas] = useState<Kelas[]>([]);
  const [cases, setCases] = useState<DosenCase[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<TaskFilter>('');
  const [kf, setKf] = useState<number | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const load = () => {
    setLoadErr('');
    return api
      .dosenAssignments()
      .then(setList)
      .catch((e) => setLoadErr((e as Error).message));
  };
  useEffect(() => {
    load();
    api.classes().then(setKelas).catch(() => setKelas([]));
    api.dosenCases().then(setCases).catch(() => setCases([]));
  }, []);

  const all = list ?? [];
  const st = all.map(taskState);
  const shown = all
    .map((t, i) => [t, st[i]] as const)
    .filter(([t, s]) => (!kf || t.kelas_id === kf) && (!filter || (filter === 'tuntas' ? s.allDone : filter === 'lewat' ? s.due.tone === 'bad' : !s.allDone && s.due.tone !== 'bad')))
    .sort(([a, sa], [b, sb]) => Number(sa.allDone) - Number(sb.allDone) || (a.due_at ?? 9e12) - (b.due_at ?? 9e12));
  const totalStudents = st.reduce((a, s) => a + s.n, 0);
  const totalDone = all.reduce((a, t) => a + t.n_tuntas, 0);
  const cells: [string, number, Tone][] = [
    ['Lewat tenggat', st.filter((s) => s.due.tone === 'bad').length, 'bad'],
    ['Segera (≤ 2 hari)', st.filter((s) => s.due.tone === 'warn').length, 'warn'],
    ['Berjalan', st.filter((s) => s.due.tone === 'info').length, 'info'],
    ['Semua tuntas', st.filter((s) => s.allDone).length, 'ok'],
  ];

  return (
    <AppShell wide>
      <PageTitle
        title="Tugas"
        sub="Paket modul dan kasus dengan tenggat. Progres dihitung otomatis: kasus selesai bila dikirim setelah tugas dibuat, modul selesai bila kuisnya lulus."
        actions={
          <PillButton variant={showForm ? 'outline' : 'primary'} icon={showForm ? X : Plus} onClick={() => setShowForm(!showForm)} disabled={!kelas.length}>
            {showForm ? 'Tutup formulir' : 'Tugas baru'}
          </PillButton>
        }
      />

      {!kelas.length && list && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-info/25 bg-info-soft/60 p-5">
          <div>
            <b className="text-[15px] font-semibold">Buat kelas dulu</b>
            <p className="text-[13.5px] text-ink/60">Tugas diberikan per kelas.</p>
          </div>
          <Link to="/dosen/kelas" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-teal px-4 text-[13px] font-medium text-white">
            Ke halaman kelas <ArrowRight className="size-4" />
          </Link>
        </div>
      )}

      <AnimatePresence initial={false}>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
            <AssignmentForm
              kelas={kelas}
              cases={cases}
              onDone={() => {
                setShowForm(false);
                load();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!list ? (
        loadErr ? <LoadError message={loadErr} onRetry={load} /> : <Loading />
      ) : list.length === 0 ? (
        <div className="mt-6">
          <Empty title="Belum ada tugas">Klik “Tugas baru” untuk membuat paket latihan.</Empty>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
            <div className="rounded-2xl card-surface p-5">
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="font-medium text-ink/60">Mahasiswa tuntas, semua tugas</span>
                <b className="text-[18px] font-semibold tabular-nums">
                  {totalDone}
                  <span className="text-[13px] font-normal text-ink/40">/{totalStudents}</span>
                </b>
              </div>
              <span className="mt-3 block h-2.5 overflow-hidden rounded-full bg-muted">
                <motion.span initial={{ width: 0 }} animate={{ width: `${(totalDone / Math.max(1, totalStudents)) * 100}%` }} transition={{ duration: 0.9, ease: EASE }} className="block h-full rounded-full bg-teal" />
              </span>
              <p className="mt-2 text-[12px] text-ink/45">{all.length} tugas aktif di {new Set(all.map((t) => t.kelas_id)).size} kelas</p>
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

          <div className="mb-4 mt-6 flex flex-wrap items-center justify-between gap-3">
            <Seg<TaskFilter>
              label="Saring tugas"
              value={filter}
              onChange={setFilter}
              items={[
                { v: '', label: 'Semua', n: all.length },
                { v: 'jalan', label: 'Berjalan', dot: 'bg-info', n: st.filter((s) => !s.allDone && s.due.tone !== 'bad').length },
                { v: 'lewat', label: 'Lewat tenggat', dot: 'bg-bad', n: st.filter((s) => s.due.tone === 'bad').length },
                { v: 'tuntas', label: 'Tuntas', dot: 'bg-ok', n: st.filter((s) => s.allDone).length },
              ]}
            />
            <KelasSelect kelas={kf} setKelas={setKf} options={kelas} />
          </div>
          <div className="space-y-3">
            {shown.map(([t, s]) => (
              <TaskCard key={t.id} t={t} s={s} onDeleted={load} />
            ))}
            {shown.length === 0 && <Empty title="Tidak ada tugas yang cocok">Ubah saringan.</Empty>}
          </div>
        </>
      )}
    </AppShell>
  );
}

function TaskCard({ t, s, onDeleted }: { t: DosenAssignment; s: ReturnType<typeof taskState>; onDeleted: () => void }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const items = [
    ...t.lesson_ids.map((l) => ({ key: l, kind: 'modul' as const, label: lessonById(l)?.kc ? `Modul ${lessonById(l)!.kc}` : lessonById(l)?.judul.split(':')[0] ?? l, title: lessonById(l)?.judul ?? l, done: (p: DosenAssignment['progress'][number]) => p.lessons_done.includes(l) })),
    ...t.case_ids.map((c) => ({ key: c, kind: 'kasus' as const, label: c, title: c, done: (p: DosenAssignment['progress'][number]) => p.cases_done.includes(c) })),
  ];
  const pct = t.n_tuntas / Math.max(1, s.n);
  const bodyId = `tugas-${t.id}`;
  const sorted = [...t.progress].sort((a, b) => a.selesai / Math.max(1, a.total) - b.selesai / Math.max(1, b.total));
  return (
    <section className={cn('overflow-hidden rounded-2xl card-surface transition-shadow', open && 'shadow-md')}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={bodyId} className="flex w-full flex-wrap items-center gap-4 p-5 text-left transition-colors hover:bg-surface/60 sm:flex-nowrap sm:px-6">
        <ProgressRing value={pct} tone={s.due.tone} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <b className="text-[16px] font-semibold leading-snug">{t.judul}</b>
            <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold', BADGE[s.due.tone])}>{s.due.label}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink/50">
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-ink/65">{t.kelas}</span>
            dibuat {fmt.date(t.created_at)}
            {t.due_at && (
              <span className="flex items-center gap-1">
                · <CalendarClock className="size-3.5" /> {fmt.dateTime(t.due_at)}
              </span>
            )}
          </span>
          <span className="mt-2.5 flex flex-wrap gap-1.5">
            {items.map((x) => (
              <span key={x.key} title={x.title} className={cn('inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-0.5 text-[11.5px] font-medium text-ink/65', x.kind === 'kasus' && 'font-mono')}>
                {x.kind === 'modul' ? <BookOpen className="size-3 text-teal" /> : <ScanLine className="size-3 text-info" />}
                {x.label}
              </span>
            ))}
          </span>
        </span>
        <span className="w-full shrink-0 sm:w-56">
          <span className="flex items-baseline justify-between text-[12px] text-ink/55">
            <span>
              <b className="text-[15px] font-semibold text-ink tabular-nums">{t.n_tuntas}</b>/{s.n} tuntas
            </span>
          </span>
          <span className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <span className="bg-ok" style={{ width: `${(t.n_tuntas / Math.max(1, s.n)) * 100}%` }} />
            <span className="bg-info/60" style={{ width: `${(s.started / Math.max(1, s.n)) * 100}%` }} />
          </span>
          <span className="mt-1.5 flex gap-3 text-[11px] text-ink/50">
            <span className="flex items-center gap-1">
              <i className="size-1.5 rounded-full bg-ok" /> tuntas
            </span>
            <span className="flex items-center gap-1">
              <i className="size-1.5 rounded-full bg-info/60" /> {s.started} berjalan
            </span>
            <span className="flex items-center gap-1">
              <i className="size-1.5 rounded-full bg-ink/20" /> {s.idle} belum
            </span>
          </span>
        </span>
        <ChevronDown className={cn('size-5 shrink-0 text-ink/35 transition-transform duration-300', open && 'rotate-180')} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={bodyId} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduce ? 0 : 0.3, ease: EASE }} className="overflow-hidden">
            <div className="grid gap-5 border-t border-line px-5 pb-5 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0">
                {t.catatan && <p className="mb-4 rounded-xl bg-surface px-4 py-3 text-[14px] leading-relaxed text-ink/75">{t.catatan}</p>}
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink/40">Progres per mahasiswa</p>
                {sorted.length === 0 ? (
                  <Empty title="Belum ada mahasiswa di kelas ini" />
                ) : (
                  <ul className="divide-y divide-line">
                    {sorted.map((p) => {
                      const tone: Tone = p.tuntas ? 'ok' : p.selesai ? 'info' : 'none';
                      return (
                        <li key={p.sid} className="flex flex-wrap items-center gap-3 py-2.5">
                          <Link to={`/dosen/mahasiswa/${p.sid}`} className="flex w-52 min-w-0 items-center gap-2.5 hover:text-teal">
                            <Avatar nama={p.nama} className="size-8 text-[11px]" />
                            <b className="truncate text-[13.5px] font-medium">{p.nama}</b>
                          </Link>
                          <span className="flex min-w-[8rem] flex-1 gap-1" aria-label={`${p.selesai} dari ${p.total} langkah`}>
                            {items.map((x) => (
                              <span key={x.key} title={`${x.title}: ${x.done(p) ? 'selesai' : 'belum'}`} className={cn('h-2 flex-1 rounded-full', x.done(p) ? 'bg-ok' : 'bg-muted')} />
                            ))}
                          </span>
                          <span className="w-10 text-right text-[12px] tabular-nums text-ink/55">
                            {p.selesai}/{p.total}
                          </span>
                          <StatusPill tone={tone} className="w-[6.5rem] justify-center">
                            {p.tuntas ? 'Tuntas' : p.selesai ? 'Berjalan' : 'Belum mulai'}
                          </StatusPill>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink/40">Penyelesaian per langkah</p>
                <ul className="space-y-3 rounded-2xl bg-surface p-4">
                  {items.map((x) => {
                    const n = t.progress.filter((p) => x.done(p)).length;
                    const v = n / Math.max(1, s.n);
                    const tone: Tone = v >= 0.8 ? 'ok' : v >= 0.4 ? 'info' : v > 0 ? 'warn' : 'none';
                    return (
                      <li key={x.key} title={x.title}>
                        <div className="flex items-center gap-2 text-[12.5px]">
                          {x.kind === 'modul' ? <BookOpen className="size-3.5 shrink-0 text-teal" /> : <ScanLine className="size-3.5 shrink-0 text-info" />}
                          <span className={cn('flex-1 truncate text-ink/75', x.kind === 'kasus' && 'font-mono')}>{x.label}</span>
                          <b className={cn('font-semibold tabular-nums', TEXT[tone])}>
                            {n}/{s.n}
                          </b>
                        </div>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white">
                          <motion.span initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ duration: 0.6, ease: EASE }} className={cn('block h-full rounded-full', FILL[tone])} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <PillButton
                  variant="danger"
                  icon={Trash2}
                  className="mt-3 w-full"
                  onClick={async () => {
                    if (confirm(`Hapus tugas “${t.judul}”?`)) {
                      await api.deleteAssignment(t.id);
                      onDeleted();
                    }
                  }}
                >
                  Hapus tugas
                </PillButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function AssignmentForm({ kelas, cases, onDone }: { kelas: Kelas[]; cases: DosenCase[]; onDone: () => void }) {
  const [f, setF] = useState({ kelas_id: kelas[0]?.id ?? 0, judul: '', catatan: '', due: '' });
  const [ls, setLs] = useState<string[]>([]);
  const [cs, setCs] = useState<string[]>([]);
  const [tier, setTier] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const pool = cases.filter((c) => !c.contoh_ajar && c.review?.status !== 'ditolak' && (!tier || c.tier === tier));
  const toggle = (arr: string[], set: (a: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <section className="mt-6 rounded-2xl card-surface p-5 sm:p-6">
      <CardTitle icon={ClipboardCheck} title="Tugas baru" sub="Pilih kelas, modul, dan kasus. Mahasiswa melihatnya di halaman Tugas mereka." />
      <form
        className="mt-5 space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr('');
          if (!ls.length && !cs.length) return setErr('Pilih minimal satu modul atau kasus.');
          setSaving(true);
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
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
          <label className="block text-[12.5px] font-medium text-ink/60">
            Kelas
            <select value={f.kelas_id} onChange={(e) => setF({ ...f, kelas_id: Number(e.target.value) })} className={cn(field, 'mt-1 cursor-pointer')}>
              {kelas.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12.5px] font-medium text-ink/60">
            Judul
            <input value={f.judul} onChange={(e) => setF({ ...f, judul: e.target.value })} placeholder="mis. Minggu 3: restriksi difusi" required className={cn(field, 'mt-1')} />
          </label>
          <label className="block text-[12.5px] font-medium text-ink/60">
            Tenggat (opsional)
            <input type="datetime-local" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} className={cn(field, 'mt-1')} />
          </label>
        </div>
        <label className="block text-[12.5px] font-medium text-ink/60">
          Catatan untuk mahasiswa
          <textarea value={f.catatan} onChange={(e) => setF({ ...f, catatan: e.target.value })} rows={2} className={cn(field, 'mt-1 h-auto py-2.5')} />
        </label>

        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold">
            Modul belajar <span className="font-normal text-ink/45">· {ls.length} dipilih</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {LESSONS.map((l, i) => {
              const on = ls.includes(l.id);
              return (
                <button
                  type="button"
                  key={l.id}
                  onClick={() => toggle(ls, setLs, l.id)}
                  aria-pressed={on}
                  className={cn('flex items-center gap-3 rounded-xl border p-3 text-left transition-colors', on ? 'border-teal bg-mint/60' : 'border-line bg-white hover:border-ink/25')}
                >
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', on ? 'bg-teal text-white' : 'bg-muted text-ink/50')}>{on ? <Check className="size-4" strokeWidth={3} /> : <BookOpen className="size-4" />}</span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink/40">
                      Modul {i + 1} · {l.kc ?? 'dasar'} · {l.menit} mnt
                    </span>
                    <span className="block truncate text-[13.5px] font-medium">{l.judul}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 flex w-full flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-semibold">
              Kasus <span className="font-normal text-ink/45">· {cs.length} dipilih</span>
            </span>
          </legend>
          <div className="mb-2">
            <Seg label="Saring tingkat" value={tier} onChange={setTier} items={['', 'mudah', 'sedang', 'sulit'].map((t) => ({ v: t, label: t || 'Semua tingkat', dot: t ? FILL[TIER[t]] : undefined, n: t ? cases.filter((c) => !c.contoh_ajar && c.review?.status !== 'ditolak' && c.tier === t).length : undefined }))} />
          </div>
          <div className="grid max-h-[300px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {pool.map((c) => {
              const on = cs.includes(c.id);
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => toggle(cs, setCs, c.id)}
                  aria-pressed={on}
                  className={cn('flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors', on ? 'border-teal bg-mint/60' : 'border-line bg-white hover:border-ink/25')}
                >
                  <span className={cn('grid size-5 shrink-0 place-items-center rounded-md border', on ? 'border-teal bg-teal text-white' : 'border-ink/25 bg-white')}>{on && <Check className="size-3" strokeWidth={3} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <b className="font-mono text-[13px] font-semibold">{c.id}</b>
                      <span className={cn('rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide', BADGE[TIER[c.tier] ?? 'none'])}>{c.tier}</span>
                    </span>
                    <span className="block truncate text-[11.5px] text-ink/50">
                      {c.temuan.jumlah_fokus} fokus · {fmt.num(c.temuan.volume_ml, 1)} ml · {c.temuan.restriksi_sejati ? 'restriksi' : 'shine-through'}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {err && <p className="text-[13px] text-bad-ink">{err}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-[13px] text-ink/55">
            {ls.length} modul · {cs.length} kasus · {ls.length + cs.length} langkah
          </span>
          <PillButton variant="primary" type="submit" icon={Check} disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan tugas'}
          </PillButton>
        </div>
      </form>
    </section>
  );
}

// --- verifikasi kasus -------------------------------------------------------------

const STATUS: Record<string, string> = { disetujui: 'Disetujui', perlu_tinjau: 'Perlu ditinjau', ditolak: 'Ditolak' };
const STATUS_TONE: Record<string, Tone> = { belum: 'none', disetujui: 'ok', perlu_tinjau: 'warn', ditolak: 'bad' };
const STATUS_ICON: Record<string, LucideIcon> = { belum: ShieldCheck, disetujui: CheckCircle2, perlu_tinjau: AlertTriangle, ditolak: XCircle };
type VSort = 'model-asc' | 'D-asc' | 'D-desc' | 'id';
const VSORTS: Record<VSort, [string, (a: DosenCase, b: DosenCase) => number]> = {
  'model-asc': ['Dice model terendah', (a, b) => (a.model?.dice_terhadap_kunci ?? 2) - (b.model?.dice_terhadap_kunci ?? 2)],
  'D-asc': ['Indeks D, termudah dulu', (a, b) => a.D - b.D],
  'D-desc': ['Indeks D, tersulit dulu', (a, b) => b.D - a.D],
  id: ['ID kasus', (a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })],
};

export function VerifikasiKasus() {
  const [list, setList] = useState<DosenCase[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [tier, setTier] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<VSort>('model-asc');
  const [loadErr, setLoadErr] = useState('');
  const load = () => {
    setLoadErr('');
    return api
      .dosenCases()
      .then(setList)
      .catch((e) => setLoadErr((e as Error).message));
  };
  useEffect(() => {
    load();
  }, []);
  const all = list ?? [];
  const rows = useMemo(
    () =>
      all
        .filter((c) => (!status || (c.review?.status ?? 'belum') === status) && (!tier || c.tier === tier) && (!q || c.id.toLowerCase().includes(q.trim().toLowerCase())))
        .sort(VSORTS[sort][1]),
    [all, status, tier, q, sort],
  );
  const counts = useMemo(() => {
    const o: Record<string, number> = { belum: 0, disetujui: 0, perlu_tinjau: 0, ditolak: 0 };
    for (const c of all) o[c.review?.status ?? 'belum']++;
    return o;
  }, [all]);

  return (
    <AppShell wide>
      <PageTitle title="Verifikasi kasus" sub="Periksa kunci jawaban (mask ahli) dan temuan terstruktur setiap kasus sebelum dipakai. Kasus yang ditolak dikeluarkan dari latihan adaptif dan bank kasus semua mahasiswa." />
      {sel && <CasePreview id={sel} row={all.find((c) => c.id === sel)} onClose={() => setSel(null)} onSaved={load} />}
      {!list ? (
        loadErr ? <LoadError message={loadErr} onRetry={load} /> : <Loading />
      ) : (
        <>
          <div className="mb-5 mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(['belum', 'disetujui', 'perlu_tinjau', 'ditolak'] as const).map((k) => {
              const tone = STATUS_TONE[k];
              const Icon = STATUS_ICON[k];
              const on = status === k;
              return (
                <button
                  key={k}
                  onClick={() => setStatus(on ? '' : k)}
                  aria-pressed={on}
                  className={cn('group rounded-2xl card-surface p-5 text-left transition-[box-shadow,transform] hover:-translate-y-0.5', on && '!shadow-[0_0_0_2px_#0f172a]')}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn('flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-semibold', BADGE[tone])}>
                      <Icon className="size-3.5" /> {k === 'belum' ? 'Belum ditinjau' : STATUS[k]}
                    </span>
                    <span className="text-[12px] text-ink/45 transition-colors group-hover:text-ink/70">{on ? 'hapus saring' : 'saring'}</span>
                  </div>
                  <div className="mt-4 flex items-baseline gap-1.5">
                    <b className="text-[1.6rem] font-semibold leading-none tabular-nums">{counts[k]}</b>
                    <span className="text-[13px] text-ink/50">/ {all.length} kasus</span>
                  </div>
                  <span className="mt-3 block h-2 overflow-hidden rounded-full bg-muted">
                    <span className={cn('block h-full rounded-full', FILL[tone === 'none' ? 'info' : tone])} style={{ width: `${(counts[k] / Math.max(1, all.length)) * 100}%` }} />
                  </span>
                </button>
              );
            })}
          </div>

          <section className="overflow-hidden rounded-2xl card-surface">
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 sm:px-4">
              <Seg label="Tingkat" value={tier} onChange={setTier} items={['', 'mudah', 'sedang', 'sulit'].map((t) => ({ v: t, label: <span className="capitalize">{t || 'Semua'}</span>, dot: t ? FILL[TIER[t]] : undefined, n: t ? all.filter((c) => c.tier === t).length : all.length }))} />
              <SearchBox value={q} onChange={setQ} placeholder="Cari sub-…" className="ml-auto sm:max-w-[16rem]" />
              <PillSelect value={status} onChange={setStatus} label="Saring status">
                <option value="">Semua status</option>
                <option value="belum">Belum ditinjau ({counts.belum})</option>
                <option value="disetujui">Disetujui ({counts.disetujui})</option>
                <option value="perlu_tinjau">Perlu ditinjau ({counts.perlu_tinjau})</option>
                <option value="ditolak">Ditolak ({counts.ditolak})</option>
              </PillSelect>
              <PillSelect value={sort} onChange={(v) => setSort(v as VSort)} label="Urutkan">
                {Object.entries(VSORTS).map(([k, [l]]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </PillSelect>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-[13.5px]">
                <thead className="bg-surface text-[11.5px] font-semibold uppercase tracking-wide text-ink/45">
                  <tr className="[&>th]:px-4 [&>th]:py-2.5 [&>th]:font-semibold">
                    <th>Kasus</th>
                    <th>Pasien</th>
                    <th>NIHSS</th>
                    <th>Tingkat</th>
                    <th>Temuan (kunci)</th>
                    <th>rADC</th>
                    <th>Dice model</th>
                    <th>Kelas Anda</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const st = c.review?.status ?? 'belum';
                    const md = c.model?.dice_terhadap_kunci ?? null;
                    const mt = diceTone(md);
                    return (
                      <tr key={c.id} onClick={() => setSel(c.id)} className={cn('group cursor-pointer border-t border-line transition-colors hover:bg-surface', sel === c.id && 'bg-mint/50')}>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5">
                            <b className="font-mono text-[13px] font-semibold group-hover:text-teal">{c.id}</b>
                            {c.contoh_ajar && <span className="rounded bg-info-soft px-1.5 py-px text-[10px] font-semibold text-info-ink">contoh ajar</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink/70">
                          {c.vignette.jenis_kelamin}, {c.vignette.usia ?? '?'} th
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex min-w-[2.25rem] justify-center rounded-md px-1.5 py-0.5 text-[12px] font-semibold tabular-nums', BADGE[nihssTone(c.vignette.nihss)])}>{c.vignette.nihss ?? '?'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide', BADGE[TIER[c.tier] ?? 'none'])}>{c.tier}</span>
                        </td>
                        <td className="px-4 py-3 text-[12.5px] text-ink/65">
                          {c.temuan.jumlah_fokus} fokus · {fmt.num(c.temuan.volume_ml, 1)} ml · {c.temuan.hemisfer}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 font-mono text-[12.5px] tabular-nums text-ink/70">
                            {fmt.num(c.temuan.adc_relatif_lesi)}
                            {!c.temuan.restriksi_sejati && <span className="rounded bg-warn-soft px-1.5 py-px font-sans text-[10px] font-semibold text-warn-ink">shine-through</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <b className={cn('w-9 font-semibold tabular-nums', TEXT[mt])}>{md === null ? '—' : fmt.num(md)}</b>
                            <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                              <span className={cn('block h-full rounded-full', FILL[mt])} style={{ width: `${(md ?? 0) * 100}%` }} />
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12.5px] text-ink/60">{c.n_percobaan ? `${c.n_percobaan}× · Dice ${c.mean_dice === null ? '—' : fmt.num(c.mean_dice)}` : '—'}</td>
                        <td className="px-4 py-3">
                          <StatusPill tone={STATUS_TONE[st]}>{st === 'belum' ? 'Belum' : STATUS[st]}</StatusPill>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12.5px] font-medium text-ink/40 transition-colors group-hover:bg-teal group-hover:text-white">
                            Periksa <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length === 0 && (
                <div className="p-6">
                  <Empty title="Tidak ada kasus yang cocok">Ubah saringan atau kata kunci pencarian.</Empty>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[12.5px] text-ink/50">
              <span>
                Menampilkan {rows.length} dari {all.length} kasus · Dice model rendah menandakan kasus sulit atau mask yang perlu diperiksa ulang radiolog
              </span>
              <span className="flex flex-wrap items-center gap-3">
                Dice:
                {(
                  [
                    ['ok', '≥ 0,7'],
                    ['warn', '0,4–0,7'],
                    ['bad', '< 0,4'],
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

function CasePreview({ id, row, onClose, onSaved }: { id: string; row?: DosenCase; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState<Awaited<ReturnType<typeof api.dosenCaseView>> | null>(null);
  const [status, setStatus] = useState(row?.review?.status ?? 'disetujui');
  const [note, setNote] = useState(row?.review?.catatan ?? '');
  const [saved, setSaved] = useState(false);
  const [viewErr, setViewErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setV(null);
    setViewErr('');
    setStatus(row?.review?.status ?? 'disetujui');
    setNote(row?.review?.catatan ?? '');
    api
      .dosenCaseView(id)
      .then((x) => alive && setV(x))
      .catch((e) => alive && setViewErr((e as Error).message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tick]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  const facts: [string, React.ReactNode][] = v
    ? [
        ['Volume', `${fmt.num(v.findings.volume_ml, 1)} ml (${v.findings.kategori_volume})`],
        ['Fokus', `${v.findings.jumlah_fokus} (${v.findings.multifokal ? 'multifokal' : 'tunggal'}), hemisfer ${v.findings.hemisfer}`],
        ['ADC relatif', `${fmt.num(v.findings.adc_relatif_lesi)} → ${v.findings.restriksi_sejati ? 'restriksi sejati' : 'bukan restriksi'}`],
        ['Slice terbesar', String(v.findings.slice_lesi_terbesar)],
        ['Indeks D', String(v.findings.indeks_kesulitan_D)],
        ...(v.model ? ([['Model U-Net', `Dice ${fmt.num(v.model.dice_terhadap_kunci)}, ${fmt.num(v.model.volume_ml, 1)} ml${v.model.keyakinan_rendah ? ', keyakinan rendah' : ''}`]] as [string, string][]) : []),
        ['Luaran', `Rankin pulang ${v.luaran?.rankin_pulang ?? '—'}, etiologi ${v.luaran?.etiologi ?? '—'}`],
      ]
    : [];
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/45 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label={`Periksa kasus ${id}`}>
      <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.22, ease: EASE }} className="tw mx-auto max-w-[1200px] overflow-hidden rounded-[1.75rem] bg-white shadow-2xl">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
          <span className="grid size-10 place-items-center rounded-xl bg-mint text-teal">
            <ScanLine className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <b className="flex flex-wrap items-center gap-2 text-[17px] font-semibold">
              Periksa SOOP <span className="font-mono">{id}</span>
              {row && <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide', BADGE[TIER[row.tier] ?? 'none'])}>{row.tier}</span>}
            </b>
            {row && (
              <span className="text-[12.5px] text-ink/50">
                {row.vignette.jenis_kelamin}, {row.vignette.usia ?? '?'} th · NIHSS {row.vignette.nihss ?? '?'}
              </span>
            )}
          </div>
          <PillButton icon={X} onClick={onClose} aria-label="Tutup" title="Tutup (Esc)" />
        </div>
        {!v ? (
          <div className="p-6">
            {viewErr ? <LoadError message={viewErr} onRetry={() => setTick((t) => t + 1)} /> : <Loading text="Memuat citra dan kunci…" />}
          </div>
        ) : (
          <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="legacy min-w-0">
              <ReadViewer
                geom={v.case}
                series={v.series}
                masks={{ kunci: v.gt_rle, model: v.pred_rle }}
                initialVisible={{ kunci: true, model: false }}
                jumpTo={v.findings.fokus[0] ? (v.findings.fokus[0].pusat_voxel.map(Math.round) as [number, number, number]) : null}
                height={480}
              />
            </div>
            <aside className="space-y-4">
              <div className="rounded-2xl bg-surface p-4">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink/45">Temuan terstruktur</p>
                <dl className="divide-y divide-line text-[13px]">
                  {facts.map(([k, val]) => (
                    <div key={k} className="flex gap-3 py-2">
                      <dt className="w-28 shrink-0 text-ink/50">{k}</dt>
                      <dd className="min-w-0 flex-1 font-medium text-ink/85">{val}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink/45">Keputusan</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(STATUS).map(([k, l]) => {
                    const Icon = STATUS_ICON[k];
                    const tone = STATUS_TONE[k];
                    const on = status === k;
                    return (
                      <button key={k} onClick={() => setStatus(k)} aria-pressed={on} className={cn('flex flex-col items-center gap-1.5 rounded-xl border p-3 text-[12.5px] font-medium transition-colors', on ? cn(BADGE[tone], 'border-current') : 'border-line text-ink/60 hover:border-ink/25')}>
                        <Icon className="size-5" />
                        {l}
                      </button>
                    );
                  })}
                </div>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Catatan (mis. tepi lesi di slice 14 perlu dikoreksi)" className={cn(field, 'mt-3 h-auto py-2.5')} />
                <button
                  className={cn('mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white transition-colors disabled:opacity-60', saved ? 'bg-ok' : 'bg-teal hover:bg-teal-800')}
                  disabled={saving}
                  onClick={async () => {
                    setSaveErr('');
                    setSaving(true);
                    try {
                      await api.reviewCase(id, status, note);
                      setSaved(true);
                      setTimeout(() => setSaved(false), 1500);
                      onSaved();
                    } catch (e) {
                      setSaveErr((e as Error).message);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saved ? (
                    <>
                      <Check className="size-4" strokeWidth={3} /> Tersimpan
                    </>
                  ) : (
                    'Simpan keputusan'
                  )}
                </button>
                {saveErr && <p className="mt-2 text-[12.5px] text-bad-ink">{saveErr}</p>}
                {row?.review && <p className="mt-2 text-[12px] text-ink/45">Terakhir diputuskan {fmt.dateTime(row.review.updated_at)}</p>}
              </div>
            </aside>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// --- audit tutor ---------------------------------------------------------------

const MODE_TONE: Record<string, Tone> = { sokratik: 'info', penjelasan: 'ok', rujukan: 'warn' };

export function AuditTutor() {
  const [kelas, setKelas] = useKelasFilter();
  const [opts, setOpts] = useState<Kelas[]>([]);
  const [flagged, setFlagged] = useState(false);
  const [mode, setMode] = useState('');
  const [phase, setPhase] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<number | string | null>(null);
  const [logs, setLogs] = useState<TutorLog[] | null>(null);
  const [logErr, setLogErr] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    api.classes().then(setOpts).catch(() => setOpts([]));
  }, []);
  useEffect(() => {
    let alive = true;
    setLogs(null);
    setLogErr('');
    api
      .tutorLogs(kelas, flagged)
      .then((l) => alive && setLogs(l))
      .catch((e) => alive && setLogErr((e as Error).message));
    return () => {
      alive = false;
    };
  }, [kelas, flagged, tick]);
  const all = logs ?? [];
  const f = q.trim().toLowerCase();
  const rows = all.filter(
    (l) =>
      (!mode || l.mode === mode) &&
      (!phase || l.phase === phase) &&
      (!f || (l.nama ?? '').toLowerCase().includes(f) || (l.case_id ?? '').toLowerCase().includes(f) || l.message.toLowerCase().includes(f) || l.response.toLowerCase().includes(f)),
  ).sort((a, b) => b.created_at - a.created_at);
  const llm = all.filter((l) => l.source === 'llm');
  const avgLat = llm.length ? llm.reduce((a, b) => a + (b.latency_ms ?? 0), 0) / llm.length / 1000 : null;
  const maxLat = Math.max(1, ...all.map((l) => l.latency_ms ?? 0));
  const nFlag = all.filter((l) => l.issues.length).length;

  return (
    <AppShell wide>
      <PageTitle title="Audit tutor" sub="Setiap respons tutor tercatat bersama fase (sebelum/sesudah kunci terbuka), sumber (LLM atau templat offline), latensi, dan hasil pemeriksa fakta." />
      <div className="mb-5 mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Bot} tone="info" label="respons tercatat" value={logs ? String(all.length) : '…'} />
        <Stat icon={ShieldAlert} tone={nFlag ? 'bad' : 'ok'} label="ditandai pemeriksa fakta" value={logs ? String(nFlag) : '…'} hint={logs && all.length ? fmt.pct(nFlag / all.length) : undefined} />
        <Stat icon={Lock} tone="warn" label="sebelum kunci terbuka" value={logs ? String(all.filter((l) => l.phase === 'sebelum_submit').length) : '…'} />
        <Stat icon={Timer} tone="teal" label="rerata latensi LLM" value={avgLat === null ? '—' : `${fmt.num(avgLat, 1)} dtk`} />
      </div>

      <section className="overflow-hidden rounded-2xl card-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 sm:px-4">
          <Seg
            label="Mode tutor"
            value={mode}
            onChange={setMode}
            items={['', 'sokratik', 'penjelasan', 'rujukan'].map((m) => ({ v: m, label: <span className="capitalize">{m || 'Semua mode'}</span>, dot: m ? FILL[MODE_TONE[m]] : undefined, n: m ? all.filter((l) => l.mode === m).length : all.length }))}
          />
          <PillSelect value={phase} onChange={setPhase} label="Saring fase">
            <option value="">Semua fase</option>
            <option value="sebelum_submit">Sebelum kunci terbuka</option>
            <option value="sesudah_submit">Sesudah kunci terbuka</option>
          </PillSelect>
          <KelasSelect kelas={kelas} setKelas={setKelas} options={opts} />
          <button
            onClick={() => setFlagged(!flagged)}
            aria-pressed={flagged}
            className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors', flagged ? 'border-bad/40 bg-bad-soft text-bad-ink' : 'border-line bg-white text-ink/70 hover:border-ink/25')}
          >
            <ShieldAlert className="size-4" /> Hanya yang ditandai
          </button>
          <SearchBox value={q} onChange={setQ} placeholder="Cari nama, kasus, atau isi" className="ml-auto sm:max-w-[18rem]" />
        </div>
        {!logs ? (
          <div className="p-6">
            {logErr ? <LoadError message={logErr} onRetry={() => setTick((t) => t + 1)} /> : <Loading />}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-left text-[13.5px]">
              <thead className="bg-surface text-[11.5px] font-semibold uppercase tracking-wide text-ink/45">
                <tr className="[&>th]:px-4 [&>th]:py-2.5 [&>th]:font-semibold">
                  <th>Waktu</th>
                  <th>Mahasiswa</th>
                  <th>Kasus</th>
                  <th>Mode</th>
                  <th>Fase</th>
                  <th>Sumber</th>
                  <th>Latensi</th>
                  <th>Pemeriksa fakta</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((t, i) => {
                  const key = t.id ?? i;
                  const on = open === key;
                  const flag = t.issues.length > 0;
                  return (
                    <Fragment key={key}>
                      <tr onClick={() => setOpen(on ? null : key)} aria-expanded={on} className={cn('group cursor-pointer border-t border-line transition-colors hover:bg-surface', on && 'bg-surface', flag && 'shadow-[inset_3px_0_0_var(--color-bad)]')}>
                        <td className="whitespace-nowrap px-4 py-3 text-[12.5px] tabular-nums text-ink/55">{fmt.dateTime(t.created_at)}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2.5">
                            <Avatar nama={t.nama ?? t.sid ?? '?'} className="size-8 text-[11px]" />
                            <Link to={`/dosen/mahasiswa/${t.sid}`} onClick={(e) => e.stopPropagation()} className="max-w-[11rem] truncate font-medium hover:text-teal">
                              {t.nama ?? t.sid}
                            </Link>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/dosen/percobaan/${t.attempt_id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[12.5px] font-semibold hover:text-teal">
                            {t.case_id}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold capitalize', BADGE[MODE_TONE[t.mode] ?? 'none'])}>{t.mode}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-ink/60">
                          <span className="flex items-center gap-1.5">
                            {t.phase === 'sebelum_submit' ? <Lock className="size-3.5 text-warn" /> : <CheckCircle2 className="size-3.5 text-ok" />}
                            {t.phase === 'sebelum_submit' ? 'sebelum kirim' : 'sesudah kirim'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11.5px] text-ink/60">{t.source === 'llm' ? t.model : t.source ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          {t.latency_ms ? (
                            <span className="flex items-center gap-2">
                              <span className="w-12 text-[12.5px] tabular-nums text-ink/65">{fmt.num(t.latency_ms / 1000, 1)} dtk</span>
                              <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                                <span className="block h-full rounded-full bg-teal/70" style={{ width: `${(t.latency_ms / maxLat) * 100}%` }} />
                              </span>
                            </span>
                          ) : (
                            <span className="text-[12.5px] text-ink/35" title="Templat offline, tanpa panggilan LLM">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{flag ? <StatusPill tone="bad">{t.issues.length} catatan</StatusPill> : <StatusPill tone="ok">Lolos</StatusPill>}</td>
                        <td className="px-3 py-3">
                          <ChevronDown className={cn('size-4 text-ink/30 transition-transform group-hover:text-teal', on && 'rotate-180 text-teal')} />
                        </td>
                      </tr>
                      {on && (
                        <tr className="bg-surface">
                          <td colSpan={9} className="px-4 pb-5 pt-1 sm:px-6">
                            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="rounded-2xl bg-white p-4 ring-1 ring-line">
                              <TutorThread t={t} who={t.nama ?? undefined} />
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && (
              <div className="p-6">
                <Empty title={all.length ? 'Tidak ada log yang cocok' : 'Belum ada log'}>{all.length ? 'Ubah saringan atau kata kunci.' : 'Log muncul setelah mahasiswa bertanya ke tutor.'}</Empty>
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-[12.5px] text-ink/50">
          <span>
            Menampilkan {rows.length} dari {all.length} respons · klik baris untuk membaca percakapannya
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 rounded bg-bad" /> garis merah = ditandai pemeriksa fakta
          </span>
        </div>
      </section>
    </AppShell>
  );
}
