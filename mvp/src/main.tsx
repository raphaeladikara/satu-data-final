import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireRole } from './auth';
import Landing from './pages/Landing';
import { Daftar, Masuk } from './pages/Auth';
import { Page } from './components/Shell';
import './index.css';
import './styles.css';

// halaman di balik login dimuat terpisah supaya halaman depan tidak ikut memuat Cornerstone3D
const named = <M extends Record<string, unknown>>(f: () => Promise<M>, k: keyof M) =>
  lazy(() => f().then((m) => ({ default: m[k] as React.ComponentType<Record<string, unknown>> })));
const Beranda = lazy(() => import('./pages/student/Beranda'));
const Belajar = lazy(() => import('./pages/student/Belajar'));
const Modul = named(() => import('./pages/student/Belajar'), 'Modul');
const Latihan = lazy(() => import('./pages/student/Latihan'));
const lain = () => import('./pages/student/Lainnya');
const Kasus = named(lain, 'Kasus');
const Profil = named(lain, 'Profil');
const Riwayat = named(lain, 'Riwayat');
const Tinjau = named(lain, 'Tinjau');
const Tugas = named(lain, 'Tugas');
const Ringkasan = lazy(() => import('./pages/dosen/Ringkasan'));
const DetailMahasiswa = named(() => import('./pages/dosen/Ringkasan'), 'DetailMahasiswa');
const Mahasiswa = named(() => import('./pages/dosen/Ringkasan'), 'Mahasiswa');
const kelola = () => import('./pages/dosen/Kelola');
const AuditTutor = named(kelola, 'AuditTutor');
const KelasPage = named(kelola, 'KelasPage');
const TugasDosen = named(kelola, 'TugasDosen');
const VerifikasiKasus = named(kelola, 'VerifikasiKasus');

const S = (el: React.ReactNode) => <RequireRole role="mahasiswa">{el}</RequireRole>;
const D = (el: React.ReactNode) => <RequireRole role="dosen">{el}</RequireRole>;

// tanpa StrictMode: Cornerstone3D memegang konteks WebGL yang tidak boleh dibuat dua kali
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <AuthProvider>
      <Suspense fallback={<div className="splash">Memuat…</div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/masuk" element={<Masuk />} />
        <Route path="/daftar" element={<Daftar />} />

        <Route path="/beranda" element={S(<Beranda />)} />
        <Route path="/belajar" element={S(<Belajar />)} />
        <Route path="/belajar/:id" element={S(<Modul />)} />
        <Route path="/latihan" element={S(<Latihan />)} />
        <Route path="/tugas" element={S(<Tugas />)} />
        <Route path="/kasus" element={S(<Kasus />)} />
        <Route path="/riwayat" element={S(<Riwayat />)} />
        <Route path="/riwayat/:id" element={S(<Tinjau />)} />
        <Route path="/profil" element={<RequireRole>{<Profil />}</RequireRole>} />

        <Route path="/dosen" element={D(<Ringkasan />)} />
        <Route path="/dosen/mahasiswa" element={D(<Mahasiswa />)} />
        <Route path="/dosen/mahasiswa/:sid" element={D(<DetailMahasiswa />)} />
        <Route path="/dosen/percobaan/:id" element={D(<Tinjau back="/dosen" />)} />
        <Route path="/dosen/kelas" element={D(<KelasPage />)} />
        <Route path="/dosen/tugas" element={D(<TugasDosen />)} />
        <Route path="/dosen/kasus" element={D(<VerifikasiKasus />)} />
        <Route path="/dosen/audit" element={D(<AuditTutor />)} />

        <Route path="/login" element={<Navigate to="/masuk" replace />} />
        <Route
          path="*"
          element={
            <Page title="Halaman tidak ditemukan">
              <Link to="/">Kembali ke halaman depan</Link>
            </Page>
          }
        />
      </Routes>
      </Suspense>
    </AuthProvider>
  </BrowserRouter>,
);
