// Memuat volume kecil kasus contoh untuk viewer 3D (lihat pipeline/build_brain3d.py).
export type Brain3D = {
  id: string;
  dims: [number, number, number];
  spacing: [number, number, number];
  dwi: Uint8Array;
  flair: Uint8Array;
  mask: Uint8Array;
  /** slice dengan lesi terbanyak, untuk fokus awal */
  peakSlice: number;
  /** jumlah voxel lesi per slice */
  lesionPerSlice: number[];
};

export const BRAIN3D_CASES = ['sub-754', 'sub-1320', 'sub-652'] as const;

let indexP: Promise<Record<string, { dimensions: [number, number, number]; spacing: [number, number, number] }>> | null = null;
const cache = new Map<string, Promise<Brain3D>>();

async function gunzipIfNeeded(buf: Uint8Array) {
  // sebagian server sudah membuka gzip lewat Content-Encoding
  if (buf[0] !== 0x1f || buf[1] !== 0x8b) return buf;
  const stream = new Blob([buf as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function loadBrain3D(id: string): Promise<Brain3D> {
  const hit = cache.get(id);
  if (hit) return hit;
  const p = (async () => {
    indexP ??= fetch('/brain3d/index.json').then((r) => {
      if (!r.ok) throw new Error('Indeks volume 3D tidak ditemukan');
      return r.json();
    });
    const meta = (await indexP)[id];
    if (!meta) throw new Error(`Volume 3D ${id} tidak tersedia`);
    const res = await fetch(`/brain3d/${id}.bin`);
    if (!res.ok) throw new Error(`Gagal memuat volume 3D ${id}`);
    const raw = await gunzipIfNeeded(new Uint8Array(await res.arrayBuffer()));
    const [X, Y, Z] = meta.dimensions;
    const n = X * Y * Z;
    const mask = raw.subarray(2 * n, 3 * n);
    const lesionPerSlice = Array.from({ length: Z }, (_, z) => {
      let c = 0;
      for (let i = z * X * Y, e = i + X * Y; i < e; i++) if (mask[i]) c++;
      return c;
    });
    const peakSlice = lesionPerSlice.indexOf(Math.max(...lesionPerSlice));
    return { id, dims: meta.dimensions, spacing: meta.spacing, dwi: raw.subarray(0, n), flair: raw.subarray(n, 2 * n), mask, peakSlice, lesionPerSlice };
  })();
  cache.set(id, p);
  p.catch(() => cache.delete(id));
  return p;
}
