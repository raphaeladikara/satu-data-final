// Ubah daftar sesi latihan [mulai, kirim] (detik epoch) menjadi data grafik dasbor.
// Semua tanggal dan jam memakai WIB (UTC+7), zona kampus.
import type { ContributionDay } from '@/components/ui/contribution-skyline';

const WIB = 7 * 3600;
const DAY = 86400;

export type Session = [number, number];

const wibDate = (t: number) => new Date((t + WIB) * 1000).toISOString().slice(0, 10);

/** Jumlah kasus yang dikirim per hari WIB, untuk Contribution Skyline. */
export function dailyCounts(sessions: Session[]): ContributionDay[] {
  const m = new Map<string, number>();
  for (const [, end] of sessions) {
    const k = wibDate(end);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m].map(([date, count]) => ({ date, count }));
}

/** Tanggal hari ini (WIB) sebagai akhir kalender. */
export const todayWib = () => wibDate(Date.now() / 1000);

/**
 * Matriks 7 x 24 (Senin dulu) berisi jumlah kasus yang dimulai pada hari dan jam itu,
 * untuk Circularium Ring. `max` dipakai sebagai skala penuh cincin.
 */
export function weekHourGrid(sessions: Session[]) {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const [start] of sessions) {
    const d = new Date((start + WIB) * 1000);
    const dow = (d.getUTCDay() + 6) % 7; // Senin = 0
    grid[dow][d.getUTCHours()] += 1;
  }
  const max = Math.max(1, ...grid.flat());
  let peak = [0, 0];
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) if (grid[d][h] > grid[peak[0]][peak[1]]) peak = [d, h];
  return { grid, max, peakDay: peak[0], peakHour: peak[1] };
}

/** Menit latihan (durasi dibatasi 1 sampai 60 menit per kasus). */
export function totalMinutes(sessions: Session[]) {
  return sessions.reduce((a, [s, e]) => a + Math.min(60, Math.max(1, (e - s) / 60)), 0);
}

/** Rentetan hari berturut-turut yang berakhir hari ini atau kemarin. */
export function currentStreak(sessions: Session[]) {
  const days = new Set(sessions.map(([, e]) => Math.floor((e + WIB) / DAY)));
  let d = Math.floor((Date.now() / 1000 + WIB) / DAY);
  if (!days.has(d)) d -= 1;
  let n = 0;
  while (days.has(d)) {
    n++;
    d--;
  }
  return n;
}

export const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
