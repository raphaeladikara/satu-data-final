/**
 * Warna status bersama halaman app. Hijau = beres/mudah, amber = perlu perhatian,
 * merah = mendesak/gagal, biru = sedang berjalan. Satu sumber supaya artinya konsisten.
 */
export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'none';

/** badge lembut: latar muda, teks tua */
export const BADGE: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok-ink',
  warn: 'bg-warn-soft text-warn-ink',
  bad: 'bg-bad-soft text-bad-ink',
  info: 'bg-info-soft text-info-ink',
  none: 'bg-muted text-ink/55',
};
/** isi bilah / titik solid */
export const FILL: Record<Tone, string> = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', info: 'bg-info', none: 'bg-ink/20' };
export const TEXT: Record<Tone, string> = { ok: 'text-ok-ink', warn: 'text-warn-ink', bad: 'text-bad-ink', info: 'text-info-ink', none: 'text-ink/45' };

export const TIER: Record<string, Tone> = { mudah: 'ok', sedang: 'warn', sulit: 'bad' };
export const TIER_TONE: Record<string, string> = Object.fromEntries(Object.entries(TIER).map(([k, t]) => [k, BADGE[t]]));

/** Dice: ≥ 0,7 baik, ≥ 0,4 cukup, di bawahnya perlu diulang */
export const diceTone = (d: number | null): Tone => (d === null ? 'none' : d >= 0.7 ? 'ok' : d >= 0.4 ? 'warn' : 'bad');

/** NIHSS: 0–4 ringan, 5–15 sedang, ≥ 16 berat */
export const nihssTone = (n: number | null): Tone => (n === null ? 'none' : n <= 4 ? 'ok' : n <= 15 ? 'warn' : 'bad');

/** tenggat: lewat = merah, ≤ 2 hari = amber, lainnya biru; selesai = hijau */
export function dueStatus(due: number | null, done: boolean, now = Date.now() / 1000): { tone: Tone; label: string } {
  if (done) return { tone: 'ok', label: 'Tuntas' };
  if (!due) return { tone: 'info', label: 'Tanpa tenggat' };
  const days = (due - now) / 86400;
  if (days < 0) return { tone: 'bad', label: 'Lewat tenggat' };
  if (days < 1) return { tone: 'warn', label: `${Math.max(1, Math.round(days * 24))} jam lagi` };
  if (days <= 2) return { tone: 'warn', label: `${Math.ceil(days)} hari lagi` };
  return { tone: 'info', label: `${Math.ceil(days)} hari lagi` };
}
