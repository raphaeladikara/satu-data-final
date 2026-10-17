import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, session } from '../api';

export default function Login() {
  const nav = useNavigate();
  const [nim, setNim] = useState('');
  const [kelas, setKelas] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<{ db: string; llm: boolean; model: string; cases: number } | null>(null);
  const sid = session.get();

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await api.login(nim, kelas || 'umum');
      session.set(r.sid);
      nav('/latihan');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="landing">
      <div className="landing-card">
        <h1>SINAPS</h1>
        <p className="lead">Sistem Interaktif Neuroradiologi Adaptif untuk Pembelajaran Stroke</p>
        <ol className="cycle">
          <li>Sistem memilih kasus MRI untuk kompetensi terlemahmu.</li>
          <li>Kamu menggulir slice, mengatur window/level, menandai lesi, dan menjawab soal.</li>
          <li>Jawaban dinilai otomatis terhadap lesion mask ahli (kunci tingkat voxel).</li>
          <li>Tutor AI menjelaskan kesalahanmu, hanya dari fakta yang terukur.</li>
          <li>Penguasaan kompetensi diperbarui (BKT) untuk memilih kasus berikutnya.</li>
        </ol>
        {sid ? (
          <div className="resume">
            <p>
              Masuk sebagai <b className="mono">{sid}</b>
            </p>
            <div className="row-btns">
              <button className="btn primary" onClick={() => nav('/latihan')}>
                Lanjutkan latihan
              </button>
              <button
                className="btn"
                onClick={() => {
                  session.clear();
                  window.location.reload();
                }}
              >
                Ganti akun
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={go} className="login">
            <label>
              NIM atau ID latihan
              <input value={nim} onChange={(e) => setNim(e.target.value)} required autoComplete="off" />
            </label>
            <label>
              Kelas (opsional)
              <input value={kelas} onChange={(e) => setKelas(e.target.value)} placeholder="mis. FK Unair 2026" />
            </label>
            <p className="small muted">NIM tidak disimpan. Sistem hanya menyimpan pseudonim hasil hash (UU PDP No. 27/2022).</p>
            {err && <p className="error">{err}</p>}
            <button className="btn primary" disabled={busy}>
              {busy ? 'Masuk…' : 'Mulai latihan'}
            </button>
          </form>
        )}
        <p className="links">
          <Link to="/kasus">Bank kasus</Link> · <Link to="/dosen">Dasbor dosen</Link>
        </p>
        <p className="status small muted">
          {health
            ? `${health.cases} kasus · basis data ${health.db} · tutor ${health.llm ? health.model : 'mode offline (tanpa kunci API)'}`
            : 'API belum tersambung'}
        </p>
        <p className="disclaimer">Alat bantu belajar, bukan untuk mendiagnosis pasien. Citra: SOOP, OpenNeuro ds004889 (CC0).</p>
      </div>
    </div>
  );
}
