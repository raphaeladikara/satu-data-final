import { lazy, Suspense, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, JENJANG } from '../api';
import { homeFor, useAuth } from '../auth';
import { BrandMark } from '@/components/BrandMark';

const MriHologram = lazy(() => import('@/components/three/MriHologram'));

/** Bingkai halaman masuk/daftar: formulir di kiri, hologram MRI asli di kanan. */
function AuthFrame({ title, sub, children, foot }: { title: string; sub: string; children: ReactNode; foot: ReactNode }) {
  return (
    <div className="tw grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="relative flex flex-col px-5 py-6 sm:px-10">
        <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-40 size-[520px] rounded-full bg-leaf/30 blur-[120px]" />
        <Link to="/" className="relative flex w-fit items-center gap-2.5 text-[17px] font-semibold tracking-tight">
          <BrandMark /> SINAPS
        </Link>
        <div className="relative mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10">
          <h1 className="font-serif text-[clamp(2.6rem,4vw,3.4rem)] leading-[1.02] tracking-[-0.015em]">{title}</h1>
          <p className="mt-2 text-[15px] text-ink/60">{sub}</p>
          <div className="legacy auth-form mt-7">{children}</div>
          <p className="mt-6 text-[14px] text-ink/65 [&_a]:font-medium [&_a]:text-teal [&_a]:underline-offset-4 hover:[&_a]:underline">{foot}</p>
        </div>
        <p className="relative text-[12px] text-ink/45">Alat bantu belajar, bukan untuk mendiagnosis pasien.</p>
      </div>
      <aside className="relative m-3 hidden overflow-hidden rounded-[2.25rem] bg-[radial-gradient(120%_90%_at_50%_0%,#1f6b7a_0%,#0f3a43_45%,#061a1f_100%)] text-mint lg:block">
        <div className="grain pointer-events-none absolute inset-0 opacity-50 mix-blend-overlay" />
        <Suspense fallback={null}>
          <MriHologram className="absolute inset-0" explode={0.25} />
        </Suspense>
        <div className="pointer-events-none absolute inset-x-8 top-8 flex items-center justify-between font-mono text-[11px] text-sky/80">
          <span className="flex items-center gap-2">
            <span className="size-1.5 animate-pulse rounded-full bg-leaf" /> SOOP sub-754 · DWI
          </span>
          <span>kasus contoh</span>
        </div>
        <div className="pointer-events-none absolute inset-x-8 bottom-8">
          <p className="max-w-md font-serif text-[2rem] leading-[1.1]">
            Baca kasus nyata. Tandai lesinya. <em className="text-leaf">Tahu letak salahmu, saat itu juga.</em>
          </p>
          <div className="mt-6 flex gap-6 text-[12.5px] text-mint/70">
            <span>
              <b className="block font-serif text-3xl font-normal text-mint">36</b>kasus MRI SOOP
            </span>
            <span>
              <b className="block font-serif text-3xl font-normal text-mint">6</b>modul belajar
            </span>
            <span>
              <b className="block font-serif text-3xl font-normal text-mint">0,74</b>Dice pembaca kedua
            </span>
          </div>
        </div>
      </aside>
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
