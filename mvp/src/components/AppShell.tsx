import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, ClipboardList, Database, HelpCircle, History, Home, LogOut, Menu, ScanLine, UserRound, X } from 'lucide-react';
import { useAuth } from '../auth';
import { BrandMark } from './BrandMark';
import { cn } from '@/lib/utils';

const STUDENT_NAV = [
  { to: '/beranda', label: 'Beranda', icon: Home },
  { to: '/belajar', label: 'Belajar', icon: BookOpen },
  { to: '/latihan', label: 'Latihan', icon: ScanLine },
  { to: '/tugas', label: 'Tugas', icon: ClipboardList },
  { to: '/kasus', label: 'Bank kasus', icon: Database },
  { to: '/riwayat', label: 'Riwayat', icon: History },
];

/**
 * Kerangka halaman bertema terang (gambar referensi 3): nav pil di tengah, sapaan dan avatar di kanan.
 * Halaman yang sudah dimigrasi memakai ini; halaman lain masih memakai Page dari Shell.
 */
export function AppShell({ children, onHelp, wide }: { children: ReactNode; onHelp?: () => void; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="tw relative min-h-screen overflow-x-clip">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden [mask-image:linear-gradient(black_50%,transparent)]">
        <div className="absolute -left-32 -top-48 size-[520px] rounded-full bg-leaf/30 blur-[120px]" />
        <div className="absolute -right-24 -top-32 size-[480px] rounded-full bg-sky/30 blur-[120px]" />
        <div className="grain absolute inset-0 opacity-60" />
      </div>
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 rounded-[1.4rem] border border-ink/8 bg-paper/80 pl-3 pr-2 shadow-[0_10px_30px_-20px_rgba(16,49,58,.35)] backdrop-blur-xl">
          <Link to="/beranda" className="flex items-center gap-2.5 text-[16px] font-semibold tracking-tight" aria-label="SINAPS, ke beranda">
            <BrandMark className="size-9" />
            <span className="hidden sm:inline">SINAPS</span>
          </Link>
          <nav className="mx-auto hidden items-center gap-1 lg:flex" aria-label="Navigasi utama">
            {STUDENT_NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn('flex items-center gap-2 rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors', isActive ? 'bg-sky/60 text-teal-900' : 'text-ink/60 hover:bg-ink/5 hover:text-ink')
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
            {onHelp && (
              <button onClick={onHelp} className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink" data-tour="help">
                <HelpCircle className="size-4" />
                <span className="hidden sm:inline">Panduan</span>
              </button>
            )}
            <UserMenu />
            <button className="grid size-10 place-items-center rounded-full lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {open && (
            <motion.nav initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mx-auto mt-2 grid max-w-[1400px] grid-cols-2 gap-1 rounded-3xl border border-ink/8 bg-paper/95 p-2 shadow-xl backdrop-blur-xl lg:hidden">
              {STUDENT_NAV.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => cn('flex items-center gap-2 rounded-2xl px-4 py-3 text-[14px]', isActive ? 'bg-sky/50 text-teal-900' : 'text-ink/75')}>
                  <Icon className="size-4" />
                  {label}
                </NavLink>
              ))}
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
      <main className={cn('relative mx-auto px-4 pb-20 pt-8 sm:px-6', wide ? 'max-w-[1400px]' : 'max-w-[1240px]')}>{children}</main>
    </div>
  );
}

function UserMenu() {
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
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2.5 rounded-full py-1 pl-3 pr-1 transition-colors hover:bg-ink/5">
        <span className="hidden text-right leading-tight md:block">
          <span className="block text-[13px] font-semibold">Halo, {words[0] ?? 'kamu'}</span>
          <span className="block text-[11px] text-ink/50">{user.role === 'dosen' ? 'Dosen' : 'Mahasiswa'}</span>
        </span>
        <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-teal to-sage text-[13px] font-semibold text-mint">{initials || '?'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.16 }} role="menu" className="absolute right-0 top-[calc(100%+8px)] w-60 origin-top-right rounded-2xl border border-ink/8 bg-paper p-1.5 shadow-[0_20px_50px_-20px_rgba(16,49,58,.45)]">
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
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13.5px] text-terra hover:bg-terra/10"
            >
              <LogOut className="size-4" /> Keluar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
