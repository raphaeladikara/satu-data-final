import { useEffect, useRef, useState } from 'react';
import { loadBrain3D, type Brain3D } from '@/lib/brain3d';
import { cn } from '@/lib/utils';

/**
 * Satu slice aksial dari volume kasus contoh, digambar di canvas.
 * Overlay: kunci ahli (garis sage) dan jawaban mahasiswa tiruan (isian terracotta).
 */
export type SliceCanvasProps = {
  caseId?: string;
  /** indeks slice; default slice dengan lesi terbanyak */
  slice?: number;
  series?: 'DWI' | 'FLAIR';
  /** jendela intensitas 0-255 */
  windowLo?: number;
  windowHi?: number;
  showKey?: boolean;
  /** jawaban tiruan: mask digeser dan sebagian fokus terlewat */
  showAnswer?: boolean;
  className?: string;
  onReady?: (b: Brain3D) => void;
};

export default function SliceCanvas({ caseId = 'sub-754', slice, series = 'DWI', windowLo = 0, windowHi = 255, showKey = false, showAnswer = false, className, onReady }: SliceCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [brain, setBrain] = useState<Brain3D | null>(null);
  const readyCb = useRef(onReady);
  readyCb.current = onReady;

  useEffect(() => {
    let off = false;
    loadBrain3D(caseId)
      .then((b) => {
        if (off) return;
        setBrain(b);
        readyCb.current?.(b);
      })
      .catch(() => undefined);
    return () => {
      off = true;
    };
  }, [caseId]);

  useEffect(() => {
    const c = ref.current;
    if (!c || !brain) return;
    const [X, Y, Z] = brain.dims;
    const z = Math.max(0, Math.min(Z - 1, slice ?? brain.peakSlice));
    c.width = X;
    c.height = Y;
    const g = c.getContext('2d')!;
    const img = g.createImageData(X, Y);
    const src = series === 'FLAIR' ? brain.flair : brain.dwi;
    const m = brain.mask;
    const off = z * X * Y;
    const span = Math.max(1, windowHi - windowLo);
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= X || y >= Y ? 0 : m[off + y * X + x]);
    // jawaban tiruan: mask digeser 2 px dan hanya bagian kiri yang ditandai (fokus kecil di kanan terlewat)
    let minX = X;
    let maxX = 0;
    for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++) if (m[off + y * X + x]) (minX = Math.min(minX, x)), (maxX = Math.max(maxX, x));
    const cut = minX + (maxX - minX) * 0.72;
    for (let y = 0; y < Y; y++) {
      for (let x = 0; x < X; x++) {
        const i = y * X + x;
        // gambar di layar mengikuti konvensi radiologi: kanan pasien di kiri layar
        const o = ((Y - 1 - y) * X + x) * 4;
        let v = ((src[off + i] - windowLo) / span) * 255;
        v = v < 0 ? 0 : v > 255 ? 255 : v;
        let r = v;
        let gg = v;
        let b = v;
        if (showAnswer && x < cut && at(x - 2, y - 1) > 127) {
          r = r * 0.45 + 173 * 0.55 + 30;
          gg = gg * 0.45 + 117 * 0.55;
          b = b * 0.45 + 86 * 0.55;
        }
        if (showKey && m[off + i] > 127 && (at(x - 1, y) < 128 || at(x + 1, y) < 128 || at(x, y - 1) < 128 || at(x, y + 1) < 128)) {
          r = 170;
          gg = 211;
          b = 156;
        }
        img.data[o] = r;
        img.data[o + 1] = gg;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }, [brain, slice, series, windowLo, windowHi, showKey, showAnswer]);

  return (
    <div className={cn('relative overflow-hidden bg-black', className)}>
      <canvas ref={ref} className="h-full w-full object-contain [image-rendering:auto]" aria-label={`Slice MRI ${series} kasus ${caseId}`} role="img" />
      {!brain && <span className="absolute inset-0 m-auto size-7 animate-spin rounded-full border-2 border-sky/25 border-t-sky" />}
    </div>
  );
}
