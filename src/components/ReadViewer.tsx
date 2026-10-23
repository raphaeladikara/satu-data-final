import { useEffect, useRef, useState } from 'react';
import { Enums as CoreEnums } from '@cornerstonejs/core';
import type { CasePub, Series } from '../api';
import { SinapsViewer, ViewerAborted, initCornerstone, rleDecode, type SegKey } from '../viewer/cs';

type Masks = Partial<Record<SegKey, number[] | null>>;
const LABEL: Record<SegKey, string> = { jawaban: 'Jawaban', kunci: 'Kunci ahli', model: 'Model U-Net' };
const SW: Record<SegKey, string> = { jawaban: 'orange', kunci: 'green', model: 'blue' };

/** Viewer baca-saja: gulir, W/L, ganti seri, overlay mask. Dipakai di modul belajar dan tinjau ulang. */
export default function ReadViewer(p: {
  geom: CasePub;
  series: Series[];
  names?: Record<string, string>; // label seri -> nama sekuens
  masks: Masks;
  initialVisible?: Partial<Record<SegKey, boolean>>;
  initialSeries?: number;
  jumpTo?: [number, number, number] | null;
  onReady?: (v: SinapsViewer) => void;
  height?: number;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const viewer = useRef<SinapsViewer | null>(null);
  const [loading, setLoading] = useState('Memuat citra…');
  const [error, setError] = useState('');
  const [series, setSeries] = useState(0);
  const [slice, setSlice] = useState(0);
  const [visible, setVisible] = useState<Record<SegKey, boolean>>({ jawaban: true, kunci: false, model: false, ...p.initialVisible });
  const available = (Object.keys(p.masks) as SegKey[]).filter((k) => p.masks[k]);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    let cancelled = false;
    (async () => {
      await initCornerstone();
      if (cancelled) return;
      viewer.current?.destroy();
      const v = new SinapsViewer(el, p.geom);
      viewer.current = v;
      try {
        await v.load(
          p.series.map((s) => s.file),
          (n) => setLoading(`Memuat citra ${n}/${p.series.length}…`),
        );
        if (cancelled) return;
        const total = p.geom.dimensions.reduce((a, b) => a * b, 1);
        for (const k of available) {
          v.setMask(k, rleDecode(p.masks[k]!, total));
          v.setVisible(k, visible[k]);
        }
        v.lockAnswer();
        if (p.initialSeries) {
          await v.showSeries(p.initialSeries);
          if (cancelled) return;
          setSeries(p.initialSeries);
        }
        if (p.jumpTo) v.jumpToVoxel(p.jumpTo);
        setSlice(v.currentSlice());
        setLoading('');
        p.onReady?.(v);
      } catch (e) {
        if (cancelled || e instanceof ViewerAborted) return;
        setError((e as Error).message);
        setLoading('');
      }
    })();
    const onRender = () => {
      const v = viewer.current;
      if (v?.ready) setSlice(v.currentSlice());
    };
    el.addEventListener(CoreEnums.Events.IMAGE_RENDERED, onRender);
    el.addEventListener(CoreEnums.Events.CAMERA_MODIFIED, onRender);
    return () => {
      cancelled = true;
      el.removeEventListener(CoreEnums.Events.IMAGE_RENDERED, onRender);
      el.removeEventListener(CoreEnums.Events.CAMERA_MODIFIED, onRender);
      viewer.current?.destroy();
      viewer.current = null;
    };
    // viewer dibuat ulang hanya bila kasus berganti
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.geom.id, p.series.map((s) => s.file).join()]);

  useEffect(() => {
    if (p.jumpTo && viewer.current?.ready) viewer.current.jumpToVoxel(p.jumpTo);
  }, [p.jumpTo]);

  const show = async (i: number) => {
    setSeries(i);
    await viewer.current?.showSeries(i);
  };
  const toggle = (k: SegKey) => {
    const on = !visible[k];
    setVisible({ ...visible, [k]: on });
    viewer.current?.setVisible(k, on);
  };
  const name = (i: number) => p.names?.[p.series[i].label] ?? p.series[i].label;

  return (
    <div className="readviewer">
      <div className="rv-tools">
        <div className="seg small">
          {p.series.map((s, i) => (
            <button key={s.label} className={series === i ? 'on' : ''} onClick={() => show(i)}>
              {name(i)}
            </button>
          ))}
        </div>
        <div className="rv-overlays">
          {available.map((k) => (
            <label key={k}>
              <input type="checkbox" checked={visible[k]} onChange={() => toggle(k)} />
              <i className={`sw ${SW[k]}`} /> {LABEL[k]}
            </label>
          ))}
          <button className="btn small" onClick={() => viewer.current?.resetView()}>
            Reset
          </button>
        </div>
      </div>
      <div className="viewer-wrap rv-wrap" style={{ height: p.height ?? 420 }}>
        <div className="viewport mode-navigasi" ref={elRef} onContextMenu={(e) => e.preventDefault()} />
        <div className="vp-overlay tl">
          {name(series)} · slice {slice + 1}/{p.geom.dimensions[2]}
        </div>
        <div className="vp-overlay bl">roda: slice · seret kiri: W/L · seret kanan: zoom</div>
        <div className="vp-overlay side-l">R</div>
        <div className="vp-overlay side-r">L</div>
        {loading && <div className="vp-loading">{loading}</div>}
        {error && <div className="vp-error">{error}</div>}
      </div>
    </div>
  );
}
