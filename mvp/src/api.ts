export type KCInfo = { nama: string; prasyarat: string[]; aktif: boolean; bukti: string };
export type Vignette = { usia: string | null; jenis_kelamin: string; nihss: number | null };
export type CasePub = {
  id: string;
  dimensions: [number, number, number];
  spacing: [number, number, number];
  origin: [number, number, number];
  direction: number[];
  tier: string;
  D: number;
  vignette: Vignette;
};
export type Attempt = {
  attempt_id: number;
  case: CasePub;
  target_kc: string;
  tier: string;
  reason: string;
  blocked: string[];
  series: { label: string; file: string }[];
  mastery: Record<string, number>;
};
export type Focus = { ml: number; tersentuh: boolean; slice_terbesar: number; pusat_voxel: number[] };
export type Delineasi = {
  dice: number;
  lesion_recall: number;
  vol_err: number;
  hd95: number | null;
  precision: number;
  volume_mahasiswa_ml: number;
  volume_kunci_ml: number;
  fokus: Focus[];
  jenis_kesalahan: string;
  jenis_kesalahan_label: string;
  benar: boolean;
};
export type Findings = {
  volume_ml: number;
  kategori_volume: string;
  jumlah_fokus: number;
  multifokal: boolean;
  hemisfer: string;
  slice_lesi_terbesar: number;
  adc_relatif_lesi: number;
  restriksi_sejati: boolean;
  teritori_arteri: string;
  indeks_kesulitan_D: number;
  fokus: { ml: number; hemisfer: string; slice_terbesar: number; pusat_voxel: number[]; radc_median: number }[];
};
export type SubmitResult = {
  kc: Record<string, { benar: boolean; [k: string]: unknown }>;
  delineasi?: Delineasi;
  mastery_before: Record<string, number>;
  mastery_after: Record<string, number>;
  findings: Findings;
  model: { volume_ml: number; jumlah_fokus: number; dice_terhadap_kunci: number; keyakinan_rendah: boolean } | null;
  luaran: { rankin_pulang: number | null; etiologi: string | null };
  seq_order: Record<string, string>;
  gt_rle: number[];
  pred_rle: number[] | null;
};
export type TutorReply = {
  reply: string;
  model: string;
  source: string;
  latency_ms: number;
  issues: string[];
  phase: string;
  rujukan?: { sumber: string; judul: string; isi: string }[] | null;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      msg = (await res.json()).detail ?? msg;
    } catch {
      /* bukan JSON */
    }
    throw new Error(msg);
  }
  return res.json();
}

const post = <T,>(path: string, body: unknown, headers?: Record<string, string>) =>
  req<T>(path, { method: 'POST', body: JSON.stringify(body), headers });

export const api = {
  health: () => req<{ ok: boolean; db: string; llm: boolean; model: string; cases: number }>('/api/health'),
  kc: () =>
    req<{
      kc: Record<string, KCInfo>;
      params: Record<string, number>;
      mastered: number;
      adc_bins: string[];
      error_types: Record<string, string>;
    }>('/api/kc'),
  login: (nim: string, kelas: string) => post<{ sid: string }>('/api/login', { nim, kelas }),
  me: (sid: string) =>
    req<{
      mastery: Record<string, number>;
      n_obs: Record<string, number>;
      kc: Record<string, KCInfo>;
      attempts: { id: number; case_id: string; target_kc: string; tier: string; submitted: boolean; dice: number | null; jenis_kesalahan: string | null }[];
    }>(`/api/me?sid=${encodeURIComponent(sid)}`),
  next: (sid: string) => req<Attempt>(`/api/next?sid=${encodeURIComponent(sid)}`),
  open: (sid: string, caseId: string) => req<Attempt>(`/api/open/${caseId}?sid=${encodeURIComponent(sid)}`),
  cases: () => req<{ id: string; tier: string; D: number; vignette: Vignette }[]>('/api/cases'),
  reveal: (sid: string, attempt_id: number, k1: Record<string, string>) =>
    post<{ seq_order: Record<string, string>; benar: boolean }>('/api/reveal', { sid, attempt_id, k1 }),
  submit: (body: Record<string, unknown>) => post<SubmitResult>('/api/submit', body),
  tutor: (body: Record<string, unknown>) => post<TutorReply>('/api/tutor', body),
  dashboard: (key?: string) => req<Dashboard>('/api/dashboard', { headers: key ? { 'x-dosen-key': key } : {} }),
};

export type Dashboard = {
  students: { sid: string; kelas: string; mastery: Record<string, { p: number; n: number }>; n_kasus: number }[];
  kc: Record<string, string>;
  error_counts: Record<string, number>;
  n_attempts: number;
  mean_dice: number | null;
  recent: { id: number; sid: string; case_id: string; target_kc: string; tier: string; submitted_at: number; kc: Record<string, boolean>; dice: number | null; jenis: string | null }[];
  tutor_logs: { id: number; sid: string; case_id: string; mode: string; phase: string; message: string; response: string; model: string; latency_ms: number; issues: string[]; source: string; created_at: number }[];
  db: string;
};

export const session = {
  get: () => {
    try {
      return localStorage.getItem('sinaps-sid');
    } catch {
      return null;
    }
  },
  set: (sid: string) => {
    try {
      localStorage.setItem('sinaps-sid', sid);
    } catch {
      /* penyimpanan diblokir */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem('sinaps-sid');
    } catch {
      /* penyimpanan diblokir */
    }
  },
};
