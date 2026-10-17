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
export type Series = { label: string; file: string };
export type Attempt = {
  attempt_id: number;
  case: CasePub;
  target_kc: string;
  tier: string;
  reason: string;
  blocked: string[];
  series: Series[];
  mastery: Record<string, number>;
  k1: Record<string, string> | null;
  seq_order: Record<string, string> | null;
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
export type ModelInfo = { volume_ml: number; jumlah_fokus: number; dice_terhadap_kunci: number; keyakinan_rendah: boolean };
export type SubmitResult = {
  kc: Record<string, { benar: boolean; [k: string]: unknown }>;
  delineasi?: Delineasi;
  mastery_before: Record<string, number>;
  mastery_after: Record<string, number>;
  findings: Findings;
  model: ModelInfo | null;
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
export type TutorLog = {
  id?: number;
  attempt_id?: number;
  case_id?: string;
  mode: string;
  phase: string;
  message: string;
  response: string;
  model: string;
  latency_ms?: number;
  issues: string[];
  source: string | null;
  created_at: number;
  sid?: string;
  nama?: string | null;
};
export type User = {
  id: string;
  role: 'mahasiswa' | 'dosen';
  nama: string;
  jenjang: string | null;
  username: string | null;
  kelas?: { id: number; nama: string; kode: string; dosen: string | null } | null;
};
export type AttemptRow = {
  id: number;
  case_id: string;
  target_kc: string;
  tier: string;
  started_at: number;
  submitted_at: number;
  kc: Record<string, boolean>;
  dice: number | null;
  lesion_recall: number | null;
  jenis: string | null;
};
export type Assignment = {
  id: number;
  judul: string;
  catatan: string | null;
  due_at: number | null;
  created_at: number;
  case_ids: string[];
  lesson_ids: string[];
  cases_done: string[];
  lessons_done: string[];
  selesai: number;
  total: number;
  tuntas: boolean;
};
export type LessonProgress = Record<string, { best_score: number; completed: boolean; n_tries: number; updated_at?: number }>;
export type Me = {
  user: User;
  mastery: Record<string, number>;
  n_obs: Record<string, number>;
  kc: Record<string, KCInfo>;
  attempts: AttemptRow[];
  lessons: LessonProgress;
  rekomendasi: { kc: string; nama: string; p: number; lesson: string | null };
  ringkas: { n_kasus: number; mean_dice: number | null; kc_dikuasai: number };
  assignments: Assignment[];
};
export type CaseRow = { id: string; tier: string; D: number; vignette: Vignette; dikerjakan: boolean; dice: number | null };
export type Review = AttemptDetail;
export type AttemptDetail = Attempt &
  SubmitResult & {
    answers: Record<string, unknown>;
    mask_rle: number[] | null;
    submitted_at: number;
    started_at: number;
    student_id: string;
    tutor: TutorLog[];
  };
export type TeachingCase = { case: CasePub; judul: string; series: Series[]; findings: Findings; gt_rle: number[] };

// --- dosen
export type Kelas = { id: number; nama: string; kode: string; n_mahasiswa: number; created_at?: number };
export type StudentRow = {
  sid: string;
  nama: string;
  jenjang: string | null;
  kelas_id: number;
  kelas: string | null;
  mastery: Record<string, { p: number; n: number }>;
  n_kasus: number;
  mean_dice: number | null;
  last_active: number;
  kc_terlemah: string;
  flags: string[];
  modul_selesai: number;
};
export type Overview = {
  kelas: Kelas[];
  students: StudentRow[];
  kc: Record<string, string>;
  kc_avg: Record<string, { mean: number | null; dikuasai: number }>;
  error_counts: Record<string, number>;
  n_attempts: number;
  mean_dice: number | null;
  activity: { t: number; n: number }[];
  active_7d: number;
  flagged_tutor: number;
  n_tutor: number;
  recent: (AttemptRow & { sid: string; nama: string })[];
  db: string;
};
export type StudentDetail = {
  student: User & { last_seen: number; created_at: number };
  mastery: Record<string, number>;
  n_obs: Record<string, number>;
  kc: Record<string, KCInfo>;
  trajectory: { t: number; case_id: string; mastery: Record<string, number> }[];
  error_counts: Record<string, number>;
  attempts: AttemptRow[];
  lessons: LessonProgress;
  assignments: Assignment[];
  tutor_logs: TutorLog[];
};
export type DosenAssignment = {
  id: number;
  kelas_id: number;
  kelas: string;
  judul: string;
  catatan: string | null;
  case_ids: string[];
  lesson_ids: string[];
  due_at: number | null;
  created_at: number;
  n_tuntas: number;
  progress: { sid: string; nama: string; selesai: number; total: number; tuntas: boolean; cases_done: string[]; lessons_done: string[] }[];
};
export type DosenCase = {
  id: string;
  tier: string;
  D: number;
  vignette: Vignette;
  contoh_ajar: boolean;
  temuan: {
    volume_ml: number;
    kategori_volume: string;
    jumlah_fokus: number;
    hemisfer: string;
    adc_relatif_lesi: number;
    restriksi_sejati: boolean;
    slice_lesi_terbesar: number;
  };
  model: ModelInfo | null;
  n_percobaan: number;
  mean_dice: number | null;
  review: { status: string; catatan: string; updated_at: number } | null;
};

// --- sesi
const TOKEN_KEY = 'sinaps-token';
export const token = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* penyimpanan diblokir */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('sinaps-sid');
    } catch {
      /* penyimpanan diblokir */
    }
  },
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, msg: string) {
    super(msg);
    this.status = status;
  }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

async function raw(path: string, init?: RequestInit): Promise<Response> {
  const t = token.get();
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `Galat ${res.status}`;
    try {
      const j = await res.json();
      msg = typeof j.detail === 'string' ? j.detail : msg;
    } catch {
      /* bukan JSON */
    }
    if (res.status === 401 && t) onUnauthorized?.();
    throw new ApiError(res.status, msg);
  }
  return res;
}

const req = async <T,>(path: string, init?: RequestInit): Promise<T> => (await raw(path, init)).json();
const send = <T,>(method: string, path: string, body?: unknown) =>
  req<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

type Auth = { token: string; user: User };

export const api = {
  health: () => req<{ ok: boolean; db: string; llm: boolean; model: string; cases: number; dosen_key_default: boolean }>('/api/health'),
  stats: () => req<{ cases: number; practice_cases: number; kc_aktif: number; kc_total: number }>('/api/stats'),
  kc: () =>
    req<{
      kc: Record<string, KCInfo>;
      params: Record<string, number>;
      mastered: number;
      adc_bins: string[];
      error_types: Record<string, string>;
      jenjang: Record<string, string>;
    }>('/api/kc'),

  // auth
  register: (b: { nama: string; nim: string; password: string; jenjang: string; kode_kelas?: string }) => send<Auth>('POST', '/api/auth/register', b),
  registerDosen: (b: { nama: string; username: string; password: string; kode_dosen: string }) => send<Auth>('POST', '/api/auth/register-dosen', b),
  login: (role: string, id: string, password: string) => send<Auth>('POST', '/api/auth/login', { role, id, password }),
  authMe: () => req<User>('/api/auth/me'),
  changePassword: (lama: string, baru: string) => send<{ token: string }>('POST', '/api/auth/password', { lama, baru }),
  updateProfile: (b: { nama?: string; jenjang?: string }) => send<User>('PATCH', '/api/auth/profile', b),
  joinClass: (kode: string) => send<User>('POST', '/api/kelas/join', { kode }),

  // mahasiswa
  me: () => req<Me>('/api/me'),
  next: (opts?: { kc?: string; baru?: boolean }) => {
    const q = new URLSearchParams();
    if (opts?.kc) q.set('kc', opts.kc);
    if (opts?.baru) q.set('baru', 'true');
    return req<Attempt>(`/api/next${q.toString() ? `?${q}` : ''}`);
  },
  open: (caseId: string) => req<Attempt>(`/api/open/${encodeURIComponent(caseId)}`),
  cases: () => req<CaseRow[]>('/api/cases'),
  reveal: (attempt_id: number, k1: Record<string, string>) => send<{ seq_order: Record<string, string>; benar: boolean }>('POST', '/api/reveal', { attempt_id, k1 }),
  submit: (body: Record<string, unknown>) => send<SubmitResult>('POST', '/api/submit', body),
  tutor: (body: Record<string, unknown>) => send<TutorReply>('POST', '/api/tutor', body),
  attempt: (id: number) => req<AttemptDetail>(`/api/attempts/${id}`),
  assignments: () => req<Assignment[]>('/api/assignments'),
  saveLesson: (id: string, b: { quiz_score?: number; completed?: boolean }) => send<{ ok: boolean }>('POST', `/api/lessons/${id}`, b),
  teaching: (caseId: string) => req<TeachingCase>(`/api/contoh/${caseId}`),

  // dosen
  overview: (kelasId?: number | null) => req<Overview>(`/api/dosen/overview${kelasId ? `?kelas_id=${kelasId}` : ''}`),
  student: (sid: string) => req<StudentDetail>(`/api/dosen/students/${encodeURIComponent(sid)}`),
  resetPassword: (sid: string) => send<{ password: string }>('POST', `/api/dosen/students/${encodeURIComponent(sid)}/reset-password`),
  moveStudent: (sid: string, kelas_id: number | null) => send<{ ok: boolean }>('POST', `/api/dosen/students/${encodeURIComponent(sid)}/kelas`, { kelas_id }),
  classes: () => req<Kelas[]>('/api/dosen/kelas'),
  createClass: (nama: string) => send<Kelas>('POST', '/api/dosen/kelas', { nama }),
  renameClass: (id: number, nama: string) => send<Kelas>('PATCH', `/api/dosen/kelas/${id}`, { nama }),
  newClassCode: (id: number) => send<Kelas>('POST', `/api/dosen/kelas/${id}/kode-baru`),
  deleteClass: (id: number) => send<{ ok: boolean }>('DELETE', `/api/dosen/kelas/${id}`),
  dosenAssignments: () => req<DosenAssignment[]>('/api/dosen/assignments'),
  createAssignment: (b: { kelas_id: number; judul: string; catatan?: string; case_ids: string[]; lesson_ids: string[]; due_at?: number | null }) =>
    send<unknown>('POST', '/api/dosen/assignments', b),
  deleteAssignment: (id: number) => send<{ ok: boolean }>('DELETE', `/api/dosen/assignments/${id}`),
  tutorLogs: (kelasId?: number | null, flagged?: boolean) => {
    const q = new URLSearchParams();
    if (kelasId) q.set('kelas_id', String(kelasId));
    if (flagged) q.set('hanya_ditandai', 'true');
    return req<TutorLog[]>(`/api/dosen/tutor-logs?${q}`);
  },
  dosenCases: () => req<DosenCase[]>('/api/dosen/cases'),
  dosenCaseView: (id: string) =>
    req<TeachingCase & { model: ModelInfo | null; pred_rle: number[] | null; luaran: SubmitResult['luaran'] }>(`/api/dosen/cases/${id}/view`),
  reviewCase: (id: string, status: string, catatan: string) => send<{ ok: boolean }>('POST', `/api/dosen/cases/${id}/review`, { status, catatan }),
  exportCsv: async (jenis: 'penguasaan' | 'percobaan', kelasId?: number | null) => {
    const q = new URLSearchParams({ jenis });
    if (kelasId) q.set('kelas_id', String(kelasId));
    const res = await raw(`/api/dosen/export?${q}`);
    const blob = await res.blob();
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `sinaps_${jenis}.csv`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

// --- format
export const fmt = {
  num: (x: number, d = 2) => x.toFixed(d).replace('.', ','),
  pct: (x: number) => `${Math.round(x * 100)}%`,
  date: (t: number) => new Date(t * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
  dateTime: (t: number) =>
    new Date(t * 1000).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
  ago: (t: number) => {
    if (!t) return 'belum pernah';
    const s = Date.now() / 1000 - t;
    if (s < 60) return 'baru saja';
    if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
    if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
    if (s < 86400 * 30) return `${Math.floor(s / 86400)} hari lalu`;
    return fmt.date(t);
  },
};

export const JENJANG: Record<string, string> = {
  praklinik: 'Mahasiswa praklinik',
  klinik: 'Mahasiswa klinik (koas)',
  internsip: 'Dokter internsip',
  residen: 'Residen',
};
