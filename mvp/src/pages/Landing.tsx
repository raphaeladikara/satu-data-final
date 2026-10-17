import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { homeFor, useAuth } from '../auth';
import { Logo } from '../components/Shell';

const CYCLE = [
  { t: 'Kasus dipilih untukmu', d: 'Sistem memilih kasus MRI yang menyasar kompetensi terlemahmu, dengan tingkat kesulitan yang sesuai.' },
  { t: 'Baca seperti di klinik', d: 'Gulir slice, atur window/level, bandingkan DWI, ADC, dan FLAIR, lalu tandai lesi dengan kuas.' },
  { t: 'Dinilai otomatis', d: 'Jawabanmu dibandingkan dengan lesion mask ahli: Dice, recall per lesi, galat volume, HD95, dan jenis kesalahan.' },
  { t: 'Tutor menjelaskan', d: 'Tutor AI menjelaskan letak kesalahanmu hanya dari fakta yang terukur, dengan pemeriksa fakta dan log audit.' },
  { t: 'Penguasaan diperbarui', d: 'Bayesian Knowledge Tracing memperbarui peluang penguasaan tiap KC untuk memilih kasus berikutnya.' },
];

const KCS = [
  ['K1', 'Mengenali sekuens', true],
  ['K2', 'Mendeteksi hiperintensitas DWI', true],
  ['K3', 'Restriksi sejati vs T2 shine-through', true],
  ['K4', 'Mengenali teritori arteri', false],
  ['K5', 'Memperkirakan usia lesi', false],
  ['K6', 'Mendelineasi seluruh lesi', true],
] as const;

export default function Landing() {
  const { user, ready } = useAuth();
  const [stats, setStats] = useState<{ cases: number; practice_cases: number } | null>(null);
  useEffect(() => {
    api.stats().then(setStats).catch(() => setStats(null));
  }, []);
  if (ready && user) return <Navigate to={homeFor(user)} replace />;

  return (
    <div className="landing">
      <header className="l-nav">
        <a href="#top" className="brand">
          <Logo /> SINAPS
        </a>
        <nav>
          <a href="#cara-kerja">Cara kerja</a>
          <a href="#fitur">Fitur</a>
          <a href="#dosen">Untuk dosen</a>
          <a href="#privasi">Data &amp; privasi</a>
        </nav>
        <div className="l-nav-cta">
          <Link to="/masuk" className="btn small">
            Masuk
          </Link>
          <Link to="/daftar" className="btn small primary">
            Daftar
          </Link>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Sistem Interaktif Neuroradiologi Adaptif untuk Pembelajaran Stroke</p>
          <h1>
            Latih membaca MRI stroke dengan umpan balik <em>setingkat voxel</em>.
          </h1>
          <p className="hero-lead">
            SINAPS adalah tutor neuroradiologi berbasis web untuk mahasiswa kedokteran. Kamu membaca kasus MRI nyata, menandai lesinya, dan langsung tahu di mana kamu
            keliru, tanpa menunggu radiolog.
          </p>
          <div className="hero-cta">
            <Link to="/daftar" className="btn primary lg">
              Mulai belajar gratis
            </Link>
            <Link to="/daftar?peran=dosen" className="btn lg">
              Saya dosen
            </Link>
          </div>
          <ul className="hero-facts">
            <li>
              <b>{stats?.cases ?? 36}</b> kasus MRI SOOP
            </li>
            <li>
              <b>6</b> modul belajar
            </li>
            <li>
              <b>4</b> metrik penilaian
            </li>
          </ul>
        </div>
        <HeroVisual />
      </section>

      <section className="l-problem">
        <div className="stat">
          <b>0,8</b>
          <span>radiolog per 100.000 penduduk Indonesia, sekaligus pengajar radiologi.</span>
        </div>
        <div className="stat">
          <b>26,9%</b>
          <span>mahasiswa klinik dan dokter internsip yang yakin mampu membaca CT atau MRI kepala (survei 431 responden, 2026).</span>
        </div>
        <div className="stat">
          <b>74,4%</b>
          <span>tingkat halusinasi model visi-bahasa umum saat membaca gambar klinis. Chatbot biasa belum layak menjadi pengajar.</span>
        </div>
      </section>

      <section className="l-section" id="cara-kerja">
        <p className="eyebrow">Cara kerja</p>
        <h2>Satu siklus latihan terarah, berulang sampai kompeten</h2>
        <ol className="l-cycle">
          {CYCLE.map((c, i) => (
            <li key={c.t}>
              <span className="n">{i + 1}</span>
              <b>{c.t}</b>
              <p>{c.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="l-section" id="fitur">
        <p className="eyebrow">Untuk mahasiswa</p>
        <h2>Semua yang dibutuhkan untuk berlatih mandiri</h2>
        <div className="l-features">
          <Feature t="Viewer MRI interaktif" d="Dibangun di atas Cornerstone3D, pustaka inti OHIF Viewer. Gulir, window/level, zoom, probe ADC relatif." />
          <Feature t="Kuas anotasi lesi" d="Tandai lesi langsung pada citra 3D, lengkap dengan penghapus dan urungkan." />
          <Feature t="Penilaian objektif" d="Empat metrik dan lima jenis kesalahan pemula, dinilai terhadap kunci jawaban buatan ahli." />
          <Feature t="Tutor berpijak fakta" d="Mode Sokratik, penjelasan, dan rujukan. Kunci terkunci sampai jawaban dikirim." />
          <Feature t="Kasus adaptif" d="BKT memilih kompetensi dan tingkat kesulitan berikutnya. Prasyarat dihormati." />
          <Feature t="Modul belajar & kuis" d="Materi singkat per kompetensi dengan contoh kasus interaktif dan kuis cepat." />
        </div>
        <div className="l-kc">
          <h3>Enam knowledge component (KC)</h3>
          <ul>
            {KCS.map(([k, n, on]) => (
              <li key={k} className={on ? '' : 'off'}>
                <span className="kc">{k}</span> {n}
                {!on && <em>tahap pilot</em>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="l-section l-dosen" id="dosen">
        <div>
          <p className="eyebrow">Untuk dosen</p>
          <h2>Pantau setiap mahasiswa tanpa mengoreksi satu per satu</h2>
          <p className="muted">
            Buat kelas, bagikan kodenya, dan lihat perkembangan kelas secara langsung. Setiap umpan balik yang diterima mahasiswa bisa ditelusuri kembali ke datanya.
          </p>
          <Link to="/daftar?peran=dosen" className="btn primary">
            Daftar sebagai dosen
          </Link>
        </div>
        <ul className="l-checks">
          <li>Peta penguasaan KC per mahasiswa dan rerata kelas</li>
          <li>Jenis kesalahan delineasi tersering di kelas</li>
          <li>Penanda mahasiswa yang perlu perhatian</li>
          <li>Tugas berisi kasus dan modul, dengan tenggat dan progres</li>
          <li>Tinjau ulang anotasi mahasiswa di atas citra</li>
          <li>Verifikasi kasus sebelum dipakai di bank latihan</li>
          <li>Audit log tutor beserta hasil pemeriksa fakta</li>
          <li>Ekspor CSV untuk penilaian dan penelitian</li>
        </ul>
      </section>

      <section className="l-section l-proof">
        <p className="eyebrow">Uji kelayakan pada data nyata</p>
        <div className="l-proof-grid">
          <div>
            <b>94,6%</b>
            <span>akurasi aturan jenis kesalahan (672 anotasi sintetis, 36 subjek) dibanding 47,3% bila hanya memakai Dice</span>
          </div>
          <div>
            <b>0,74</b>
            <span>rerata Dice U-Net 2.5D sebagai pembaca kedua pada 36 kasus bank yang tidak pernah dipakai melatih</span>
          </div>
          <div>
            <b>1.451</b>
            <span>lesion mask akut dipakai untuk menyusun indeks kesulitan kasus</span>
          </div>
        </div>
      </section>

      <section className="l-section l-privacy" id="privasi">
        <div>
          <h3>Data citra terbuka</h3>
          <p className="muted">Kasus berasal dari Stroke Outcome Optimization Project (SOOP), OpenNeuro ds004889, lisensi CC0, sudah dianonimkan.</p>
        </div>
        <div>
          <h3>Log berpseudonim</h3>
          <p className="muted">NIM tidak pernah disimpan, hanya pseudonim hasil hash. Log belajar dipakai untuk personalisasi dan evaluasi, sesuai UU PDP No. 27/2022.</p>
        </div>
        <div>
          <h3>Alat bantu belajar</h3>
          <p className="muted">SINAPS tidak ditujukan untuk mendiagnosis pasien. Kunci jawaban selalu mask buatan ahli, bukan prediksi model.</p>
        </div>
      </section>

      <section className="l-cta">
        <h2>Siap membaca kasus pertamamu?</h2>
        <p className="muted">Daftar dengan NIM, masukkan kode kelas dari dosenmu, dan mulai dari modul orientasi.</p>
        <div className="hero-cta">
          <Link to="/daftar" className="btn primary lg">
            Daftar sebagai mahasiswa
          </Link>
          <Link to="/masuk" className="btn lg">
            Sudah punya akun
          </Link>
        </div>
      </section>

      <footer className="l-foot">
        <span>
          <Logo /> SINAPS · Tim Rizzz, Sains Data Universitas Airlangga · ICC Campus Data Week 2026
        </span>
        <span className="muted">Citra: SOOP (OpenNeuro ds004889, CC0)</span>
      </footer>
    </div>
  );
}

function Feature({ t, d }: { t: string; d: string }) {
  return (
    <div className="l-feature">
      <b>{t}</b>
      <p>{d}</p>
    </div>
  );
}

// ilustrasi: irisan aksial skematis dengan tandaan mahasiswa vs kunci, plus kartu hasil
function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="hv-frame">
        <div className="hv-bar">
          <span>DWI · slice 12/25</span>
          <span className="tier tier-sedang">sedang</span>
        </div>
        <svg viewBox="0 0 320 320" className="hv-svg">
          <defs>
            <radialGradient id="hvb" cx="50%" cy="48%" r="55%">
              <stop offset="0%" stopColor="#5d6878" />
              <stop offset="70%" stopColor="#3a4352" />
              <stop offset="100%" stopColor="#1b2230" />
            </radialGradient>
            <radialGradient id="hvl" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f4f6f8" />
              <stop offset="100%" stopColor="#c9cfd8" stopOpacity="0.2" />
            </radialGradient>
          </defs>
          <rect width="320" height="320" fill="#05080d" />
          <ellipse cx="160" cy="162" rx="112" ry="134" fill="#0d1118" stroke="#2a3140" strokeWidth="6" />
          <ellipse cx="160" cy="162" rx="102" ry="124" fill="url(#hvb)" />
          <path d="M160 40 C 158 100, 162 220, 160 286" stroke="#141a24" strokeWidth="5" fill="none" />
          <path d="M138 140 q -14 22 2 44 M182 140 q 14 22 -2 44" stroke="#10151d" strokeWidth="10" fill="none" strokeLinecap="round" />
          <ellipse cx="102" cy="150" rx="26" ry="34" fill="url(#hvl)" />
          <ellipse cx="96" cy="214" rx="8" ry="7" fill="url(#hvl)" />
          <path className="hv-gt" d="M80 124 q 22 -12 44 6 q 10 26 -4 52 q -24 12 -42 -6 q -8 -26 2 -52z" />
          <path className="hv-ans" d="M84 130 q 18 -8 36 6 q 8 20 -4 42 q -20 8 -34 -6 q -6 -22 2 -42z" />
          <circle className="hv-gt" cx="96" cy="214" r="10" />
          <text x="10" y="166" className="hv-lr">R</text>
          <text x="300" y="166" className="hv-lr">L</text>
        </svg>
        <div className="hv-legend">
          <span>
            <i className="sw orange" /> jawabanmu
          </span>
          <span>
            <i className="sw green" /> kunci ahli
          </span>
        </div>
      </div>
      <div className="hv-card hv-c1">
        <span>Dice</span>
        <b>0,81</b>
      </div>
      <div className="hv-card hv-c2">
        <span>Lesi ditemukan</span>
        <b className="bad">1 dari 2</b>
      </div>
      <div className="hv-card hv-c3">
        <span>Jenis kesalahan</span>
        <b>Lesi kecil terlewat</b>
      </div>
      <div className="hv-card hv-c4">
        <span>Tutor · Sokratik</span>
        <p>Ada fokus yang belum kamu tandai. Coba kembali ke sekitar slice 15: apakah ada wilayah terang di DWI yang gelap di ADC?</p>
      </div>
    </div>
  );
}
