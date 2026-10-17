import { useEffect, useRef, useState } from 'react';
import { loadBrain3D, type Brain3D } from '@/lib/brain3d';
import { cn } from '@/lib/utils';

export type Series2D = 'DWI' | 'FLAIR' | 'ADC';
export type SliceOpts = {
  slice?: number;
  series?: Series2D;
  /** jendela intensitas 0-255 */
  windowLo?: number;
  windowHi?: number;
  /** garis tepi kunci ahli (sage) */
  showKey?: boolean;
  /** isian kunci ahli transparan (terracotta), untuk thumbnail */
  fillKey?: boolean;
  /** jawaban tiruan: mask digeser dan sebagian fokus terlewat */
  showAnswer?: boolean;
};

/** Menggambar satu slice aksial ke ImageData. Kanan pasien di kiri layar, anterior di atas. */
export function paintSlice(brain: Brain3D, o: SliceOpts = {}): ImageData {
  const [X, Y, Z] = brain.dims;
  const z = Math.max(0, Math.min(Z - 1, o.slice ?? brain.peakSlice));
  const img = new ImageData(X, Y);
  const series = o.series ?? 'DWI';
  const src = series === 'FLAIR' ? brain.flair : series === 'ADC' ? brain.adc : brain.dwi;
  const lo = o.windowLo ?? 0;
  const span = Math.max(1, (o.windowHi ?? 255) - lo);
  const m = brain.mask;
  const off = z * X * Y;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= X || y >= Y ? 0 : m[off + y * X + x]);
  let minX = X;
  let maxX = 0;
  if (o.showAnswer) for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++) if (m[off + y * X + x]) (minX = Math.min(minX, x)), (maxX = Math.max(maxX, x));
  const cut = minX + (maxX - minX) * 0.72;
  for (let y = 0; y < Y; y++) {
    for (let x = 0; x < X; x++) {
      const i = y * X + x;
      const p = ((Y - 1 - y) * X + x) * 4;
      let v = ((src[off + i] - lo) / span) * 255;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      let r = v;
      let g = v;
      let b = v;
      const inKey = m[off + i] > 127;
      if (o.fillKey && inKey) {
        r = r * 0.4 + 255 * 0.6;
        g = g * 0.4 + 150 * 0.6;
        b = b * 0.4 + 98 * 0.6;
      }
      if (o.showAnswer && x < cut && at(x - 2, y - 1) > 127) {
        r = r * 0.45 + 173 * 0.55 + 30;
        g = g * 0.45 + 117 * 0.55;
        b = b * 0.45 + 86 * 0.55;
      }
      if (o.showKey && inKey && (at(x - 1, y) < 128 || at(x + 1, y) < 128 || at(x, y - 1) < 128 || at(x, y + 1) < 128)) {
        r = 170;
        g = 211;
        b = 156;
      }
      img.data[p] = r;
      img.data[p + 1] = g;
      img.data[p + 2] = b;
      img.data[p + 3] = 255;
    }
  }
  return img;
}

/** Thumbnail data URL dari satu slice (dipakai galeri modul). */
export function sliceDataURL(brain: Brain3D, o: SliceOpts = {}) {
  const c = document.createElement('canvas');
  c.width = brain.dims[0];
  c.height = brain.dims[1];
  c.getContext('2d')!.putImageData(paintSlice(brain, o), 0, 0);
  return c.toDataURL('image/png');
}

export type SliceCanvasProps = SliceOpts & {
  caseId?: string;
  className?: string;
  onReady?: (b: Brain3D) => void;
};

export default function SliceCanvas({ caseId = 'sub-754', className, onReady, ...opts }: SliceCanvasProps) {
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

  const { slice, series, windowLo, windowHi, showKey, fillKey, showAnswer } = opts;
  useEffect(() => {
    const c = ref.current;
    if (!c || !brain) return;
    c.width = brain.dims[0];
    c.height = brain.dims[1];
    c.getContext('2d')!.putImageData(paintSlice(brain, { slice, series, windowLo, windowHi, showKey, fillKey, showAnswer }), 0, 0);
  }, [brain, slice, series, windowLo, windowHi, showKey, fillKey, showAnswer]);

  return (
    <div className={cn('relative overflow-hidden bg-black', className)}>
      <canvas ref={ref} className="h-full w-full object-contain" aria-label={`Slice MRI ${series ?? 'DWI'} kasus ${caseId}`} role="img" />
      {!brain && <span className="absolute inset-0 m-auto size-7 animate-spin rounded-full border-2 border-sky/25 border-t-sky" />}
    </div>
  );
}
