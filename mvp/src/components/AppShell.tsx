import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, ClipboardCheck, ClipboardList, Database, FileSearch, HelpCircle, History, Home, LayoutDashboard, LogOut, Menu, ScanLine, School, ShieldCheck, UserRound, Users, X } from 'lucide-react';
import { useAuth } from '../auth';
import { BrandMark } from './BrandMark';
import { cn } from '@/lib/utils';

type NavItem = { to: string; label: string; icon: typeof Home; end?: boolean };
const STUDENT_NAV: NavItem[] = [
  { to: '/beranda', label: 'Beranda', icon: Home },
  { to: '/belajar', label: 'Belajar', icon: BookOpen },
  { to: '/latihan', label: 'Latihan', icon: ScanLine },
  { to: '/tugas', label: 'Tugas', icon: ClipboardList },
  { to: '/kasus', label: 'Bank kasus', icon: Database },
  { to: '/riwayat', label: 'Riwayat', icon: History },
];
const DOSEN_NAV: NavItem[] = [
  { to: '/dosen', label: 'Ringkasan', icon: LayoutDashboard, end: true },
  { to: '/dosen/mahasiswa', label: 'Mahasiswa', icon: Users },
  { to: '/dosen/kelas', label: 'Kelas', icon: School },
  { to: '/dosen/tugas', label: 'Tugas', icon: ClipboardCheck },
  { to: '/dosen/kasus', label: 'Verifikasi', icon: FileSearch },
  { to: '/dosen/audit', label: 'Audit tutor', icon: ShieldCheck },
];

/**
 * Bilah atas aplikasi (gambar referensi 3): nav pil di tengah, sapaan dan avatar di kanan.
 * `compact` dipakai ruang latihan: menempel penuh di atas tanpa jarak, dengan slot info kasus.
 */
export function AppHeader({ onHelp, slot, compact }: { onHelp?: () => void; slot?: ReactNode; compact?: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = user?.role === 'dosen' ? DOSEN_NAV : user ? STUDENT_NAV : [];
  const home = user?.role === 'dosen' ? '/dosen' : user ? '/beranda' : '/';
  return (
    <header className={cn('tw app-theme z-40', compact ? 'relative border-b border-line' : 'sticky top-0 border-b border-line/80 !bg-white/90 backdrop-blur-xl')}>
      <div className={cn('mx-auto flex items-center gap-3 px-3 sm:px-5', compact ? 'h-14' : 'h-16 max-w-[1400px]')}>
        <Link to={home} className="flex shrink-0 items-center gap-2.5" aria-label="SINAPS, ke beranda">
          <BrandMark className={compact ? 'size-8' : 'size-9'} />
          <span className={cn('text-[16px] font-bold uppercase tracking-[0.14em] text-ink', compact ? 'hidden xl:inline' : 'hidden sm:inline')}>Sinaps</span>
        </Link>
        {slot && (
          <>
            <span aria-hidden="true" className="hidden h-6 w-px shrink-0 bg-line md:block" />
            <div className="flex min-w-0 flex-1 items-center">{slot}</div>
          </>
        )}
        <nav className={cn('hidden shrink-0 items-center gap-0.5 lg:flex', slot ? '' : 'mx-auto')} aria-label="Navigasi utama" data-tour="nav">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors',
                  compact ? 'h-9 px-2.5 text-[13px]' : 'h-9 px-3 text-[14px]',
                  isActive ? 'bg-teal text-white' : 'text-ink/60 hover:bg-ink/5 hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="size-4 shrink-0" />
                  {/* ruang latihan: hanya menu aktif yang berlabel supaya info kasus tidak terdesak */}
                  <span className={cn(compact && !isActive && 'sr-only')}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className={cn('flex shrink-0 items-center gap-1', slot ? '' : 'ml-auto lg:ml-0')}>
          {onHelp && (
            <button onClick={onHelp} title="Panduan" className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[13.5px] font-medium text-ink/65 transition-colors hover:bg-ink/5 hover:text-ink" data-tour="help">
              <HelpCircle className="size-4" />
              <span className={cn(compact ? 'sr-only' : 'hidden sm:inline')}>Panduan</span>
            </button>
          )}
          <UserMenu compact={compact} />
          <button className="grid size-10 place-items-center rounded-lg lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="absolute inset-x-3 top-full mt-2 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-white p-2 shadow-xl sm:inset-x-6 lg:hidden">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => cn('flex items-center gap-2 rounded-xl px-4 py-3 text-[14px]', isActive ? 'bg-teal text-white' : 'text-ink/75 hover:bg-ink/5')}>
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

/** Kerangka halaman bertema terang. */
export function AppShell({ children, onHelp, wide }: { children: ReactNode; onHelp?: () => void; wide?: boolean }) {
  return (
    <div className="tw app-theme relative min-h-screen overflow-x-clip">
      <AppHeader onHelp={onHelp} />
      <main className={cn('relative mx-auto px-4 pb-20 pt-8 sm:px-6', wide ? 'max-w-[1400px]' : 'max-w-[1240px]')}>{children}</main>
    </div>
  );
}

/** Judul halaman standar: judul serif, keterangan, aksi di kanan. Prop `eyebrow` lama diabaikan. */
export function PageHead({ title, sub, actions }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-balance font-serif text-[clamp(1.75rem,3vw,2.4rem)] leading-[1.1] tracking-[-0.01em]">{title}</h1>
        {sub && <div className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink/60">{sub}</div>}
      </div>
      {actions && <div className="legacy flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

function UserMenu({ compact }: { compact?: boolean }) {
  const { user, signOut } = useAuth();
  const navTo = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  if (!user) return null;
  const words = user.nama.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
  const initials = words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-1 transition-colors hover:bg-ink/5 md:pl-3">
        <span className={cn('hidden whitespace-nowrap text-right leading-tight', compact ? 'min-[1700px]:block' : 'md:block')}>
          <span className="block text-[13px] font-semibold">Halo, {words[0] ?? 'kamu'}</span>
          <span className="block text-[11px] text-ink/50">{user.role === 'dosen' ? 'Dosen' : 'Mahasiswa'}</span>
        </span>
        <span className="grid size-9 place-items-center rounded-full bg-teal text-[13px] font-semibold text-white">{initials || '?'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.16 }} role="menu" className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 origin-top-right rounded-2xl border border-line bg-white p-1.5 shadow-[0_20px_50px_-20px_rgba(15,23,42,.3)]">
            <div className="px-3 py-2.5">
              <b className="block text-[14px] font-semibold">{user.nama}</b>
              <span className="text-[12px] text-ink/50">{user.role === 'dosen' ? `Dosen · ${user.username}` : `Pseudonim ${user.id}`}</span>
            </div>
            <Link to="/profil" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] hover:bg-ink/5">
              <UserRound className="size-4" /> Profil &amp; kata sandi
            </Link>
            <button
              role="menuitem"
              onClick={() => {
                signOut();
                navTo('/');
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13.5px] text-bad-ink hover:bg-bad-soft"
            >
              <LogOut className="size-4" /> Keluar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
