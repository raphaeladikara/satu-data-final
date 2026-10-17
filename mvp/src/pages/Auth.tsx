import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, JENJANG } from '../api';
import { homeFor, useAuth } from '../auth';
import { Logo } from '../components/Shell';

function AuthFrame({ title, sub, children, foot }: { title: string; sub: string; children: ReactNode; foot: ReactNode }) {
  return (
    <div className="auth">
      <Link to="/" className="brand auth-brand">
        <Logo /> SINAPS
      </Link>
      <div className="auth-card">
        <h1>{title}</h1>
        <p className="muted">{sub}</p>
        {children}
      </div>
      <p className="auth-foot">{foot}</p>
      <p className="disclaimer">Alat bantu belajar, bukan untuk mendiagnosis pasien.</p>
    </div>
  );
}

function RoleTabs({ role, setRole }: { role: string; setRole: (r: 'mahasiswa' | 'dosen') => void }) {
  return (
    <div className="seg role-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={role === 'mahasiswa'} className={role === 'mahasiswa' ? 'on' : ''} onClick={() => setRole('mahasiswa')}>
        Mahasiswa
      </button>
      <button type="button" role="tab" aria-selected={role === 'dosen'} className={role === 'dosen' ? 'on' : ''} onClick={() => setRole('dosen')}>
        Dosen
      </button>
    </div>
  );
}

function PasswordField({ value, onChange, label = 'Kata sandi', auto = 'current-password' }: { value: string; onChange: (v: string) => void; label?: string; auto?: string }) {
  const [show, setShow] = useState(false);
  return (
    <label>
      {label}
      <span className="pw">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} required minLength={6} autoComplete={auto} />
        <button type="button" className="pw-toggle" onClick={() => setShow(!show)} aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>
          {show ? 'Sembunyikan' : 'Tampilkan'}
        </button>
      </span>
    </label>
  );
}

export function Masuk() {
  const { user, ready, signIn } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState<'mahasiswa' | 'dosen'>(params.get('peran') === 'dosen' ? 'dosen' : 'mahasiswa');
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (ready && user) return <Navigate to={params.get('lanjut') || homeFor(user)} replace />;

  const go = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await api.login(role, id.trim(), pw);
      signIn(r.token, r.user);
      const next = params.get('lanjut');
      nav(next && next.startsWith(r.user.role === 'dosen' ? '/dosen' : '/') ? next : homeFor(r.user), { replace: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      title="Masuk"
      sub="Lanjutkan latihan atau pantau kelasmu."
      foot={
        <>
          Belum punya akun? <Link to={`/daftar${role === 'dosen' ? '?peran=dosen' : ''}`}>Daftar</Link>
        </>
      }
    >
      <RoleTabs role={role} setRole={setRole} />
      <form onSubmit={go} className="form">
        <label>
          {role === 'dosen' ? 'Username' : 'NIM'}
          <input value={id} onChange={(e) => setId(e.target.value)} required autoComplete="username" inputMode={role === 'dosen' ? 'text' : 'numeric'} autoFocus />
        </label>
        <PasswordField value={pw} onChange={setPw} />
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Memeriksa…' : 'Masuk'}
        </button>
        <p className="small muted">Lupa kata sandi? {role === 'dosen' ? 'Hubungi admin tim SINAPS.' : 'Minta dosenmu mengatur ulang kata sandi dari dasbor dosen.'}</p>
      </form>
    </AuthFrame>
  );
}

export function Daftar() {
  const { user, ready, signIn } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState<'mahasiswa' | 'dosen'>(params.get('peran') === 'dosen' ? 'dosen' : 'mahasiswa');
  const [f, setF] = useState({ nama: '', nim: '', username: '', password: '', password2: '', jenjang: 'klinik', kode_kelas: params.get('kelas') ?? '', kode_dosen: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (ready && user) return <Navigate to={homeFor(user)} replace />;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const go = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (f.password !== f.password2) {
      setErr('Konfirmasi kata sandi tidak sama');
      return;
    }
    setBusy(true);
    try {
      const r =
        role === 'dosen'
          ? await api.registerDosen({ nama: f.nama, username: f.username, password: f.password, kode_dosen: f.kode_dosen })
          : await api.register({ nama: f.nama, nim: f.nim, password: f.password, jenjang: f.jenjang, kode_kelas: f.kode_kelas || undefined });
      signIn(r.token, r.user);
      nav(r.user.role === 'dosen' ? '/dosen/kelas?baru=1' : '/beranda?baru=1', { replace: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      title="Buat akun"
      sub={role === 'dosen' ? 'Akun dosen untuk membuat kelas dan memantau mahasiswa.' : 'Untuk mahasiswa kedokteran, dari praklinik sampai internsip.'}
      foot={
        <>
          Sudah punya akun? <Link to={`/masuk${role === 'dosen' ? '?peran=dosen' : ''}`}>Masuk</Link>
        </>
      }
    >
      <RoleTabs role={role} setRole={setRole} />
      <form onSubmit={go} className="form">
        <label>
          Nama lengkap
          <input value={f.nama} onChange={set('nama')} required minLength={2} autoComplete="name" autoFocus />
        </label>
        {role === 'mahasiswa' ? (
          <>
            <label>
              NIM
              <input value={f.nim} onChange={set('nim')} required pattern="[A-Za-z0-9.\-]{4,24}" title="Huruf/angka, 4-24 karakter" autoComplete="username" inputMode="numeric" />
              <span className="hint">Dipakai untuk masuk. NIM tidak disimpan; sistem hanya menyimpan pseudonim hasil hash.</span>
            </label>
            <label>
              Jenjang
              <select value={f.jenjang} onChange={set('jenjang')}>
                {Object.entries(JENJANG).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <span className="hint">Tutor menyesuaikan ragam bahasanya dengan jenjangmu.</span>
            </label>
            <label>
              Kode kelas <span className="muted">(opsional)</span>
              <input value={f.kode_kelas} onChange={set('kode_kelas')} placeholder="mis. K7Q2MD" maxLength={8} style={{ textTransform: 'uppercase' }} />
              <span className="hint">Dari dosen pengampu. Bisa diisi nanti di halaman Profil.</span>
            </label>
          </>
        ) : (
          <>
            <label>
              Username
              <input value={f.username} onChange={set('username')} required pattern="[a-zA-Z0-9._\-]{3,32}" title="3-32 karakter: huruf, angka, titik, garis bawah" autoComplete="username" />
            </label>
            <label>
              Kode pendaftaran dosen
              <input value={f.kode_dosen} onChange={set('kode_dosen')} required autoComplete="off" />
              <span className="hint">Diberikan oleh tim SINAPS kepada dosen mitra.</span>
            </label>
          </>
        )}
        <PasswordField value={f.password} onChange={(v) => setF({ ...f, password: v })} auto="new-password" />
        <PasswordField value={f.password2} onChange={(v) => setF({ ...f, password2: v })} label="Ulangi kata sandi" auto="new-password" />
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Membuat akun…' : 'Daftar'}
        </button>
        <p className="small muted">Dengan mendaftar, kamu setuju log belajarmu (berpseudonim) dipakai untuk personalisasi dan evaluasi pembelajaran.</p>
      </form>
    </AuthFrame>
  );
}
