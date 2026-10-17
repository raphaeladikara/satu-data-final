import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

export default function JoinClass({ onJoined }: { onJoined?: () => void }) {
  const { setUser } = useAuth();
  const [kode, setKode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="inline-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr('');
        try {
          setUser(await api.joinClass(kode));
          setKode('');
          onJoined?.();
        } catch (e) {
          setErr((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <input value={kode} onChange={(e) => setKode(e.target.value.toUpperCase())} placeholder="Kode kelas" aria-label="Kode kelas" maxLength={8} required />
      <button className="btn" disabled={busy}>
        {busy ? '…' : 'Gabung'}
      </button>
      {err && <span className="error small">{err}</span>}
    </form>
  );
}
