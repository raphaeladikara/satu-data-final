import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

const STUDENT_NAV = [
  { to: '/beranda', label: 'Beranda' },
  { to: '/belajar', label: 'Belajar' },
  { to: '/latihan', label: 'Latihan' },
  { to: '/tugas', label: 'Tugas' },
  { to: '/kasus', label: 'Bank kasus' },
  { to: '/riwayat', label: 'Riwayat' },
];
const DOSEN_NAV = [
  { to: '/dosen', label: 'Ringkasan', end: true },
  { to: '/dosen/mahasiswa', label: 'Mahasiswa' },
  { to: '/dosen/kelas', label: 'Kelas' },
  { to: '/dosen/tugas', label: 'Tugas' },
  { to: '/dosen/kasus', label: 'Verifikasi kasus' },
  { to: '/dosen/audit', label: 'Audit tutor' },
];

export function TopBar({ children }: { children?: ReactNode }) {
  const { user } = useAuth();
  const nav = user?.role === 'dosen' ? DOSEN_NAV : user ? STUDENT_NAV : [];
  return (
    <header className="topbar">
      <Link to={user ? (user.role === 'dosen' ? '/dosen' : '/beranda') : '/'} className="brand" aria-label="SINAPS, ke beranda">
        <Logo /> SINAPS
      </Link>
      {children}
      <nav className="topnav" aria-label="Navigasi utama" data-tour="nav">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={'end' in n ? Boolean(n.end) : false} className={({ isActive }) => (isActive ? 'on' : '')}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      {user ? <UserMenu /> : <Link to="/masuk" className="btn small">Masuk</Link>}
    </header>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const navTo = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  if (!user) return null;
  const initials = user.nama
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <div className="usermenu" ref={ref}>
      <button className="avatar" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" title={user.nama}>
        {initials || '?'}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <b>{user.nama}</b>
            <span className="muted small">
              {user.role === 'dosen' ? `Dosen · ${user.username}` : `Pseudonim ${user.id}`}
            </span>
          </div>
          <Link to="/profil" role="menuitem" onClick={() => setOpen(false)}>
            Profil &amp; kata sandi
          </Link>
          <button
            role="menuitem"
            onClick={() => {
              signOut();
              navTo('/');
            }}
          >
            Keluar
          </button>
        </div>
      )}
    </div>
  );
}

export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.6" opacity=".55" />
      <path d="M5 13.5h3l2-5 3 9 2.2-6H19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Page({ title, sub, actions, children, wide }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="page">
      <TopBar />
      <main className={`page-body ${wide ? 'wide' : ''}`}>
        {(title || actions) && (
          <div className="page-head">
            <div>
              {title && <h1>{title}</h1>}
              {sub && <p className="muted">{sub}</p>}
            </div>
            {actions && <div className="page-actions">{actions}</div>}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

export function Loading({ text = 'Memuat…' }: { text?: string }) {
  return <p className="muted loading-line">{text}</p>;
}
