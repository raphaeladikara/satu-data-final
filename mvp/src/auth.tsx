import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, setUnauthorizedHandler, token, type User } from './api';

type AuthState = {
  user: User | null;
  ready: boolean;
  signIn: (t: string, u: User) => void;
  signOut: () => void;
  setUser: (u: User) => void;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const signOut = useCallback(() => {
    token.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    if (!token.get()) {
      setReady(true);
      return;
    }
    api
      .authMe()
      .then(setUser)
      .catch(() => token.clear())
      .finally(() => setReady(true));
  }, [signOut]);

  const signIn = useCallback((t: string, u: User) => {
    token.set(t);
    setUser(u);
  }, []);

  return <Ctx.Provider value={{ user, ready, signIn, signOut, setUser }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth di luar AuthProvider');
  return c;
}

export const homeFor = (u: User | null) => (!u ? '/' : u.role === 'dosen' ? '/dosen' : '/beranda');

export function RequireRole({ role, children }: { role?: 'mahasiswa' | 'dosen'; children: ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="splash">Memuat…</div>;
  if (!user) return <Navigate to={`/masuk?lanjut=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return <>{children}</>;
}
