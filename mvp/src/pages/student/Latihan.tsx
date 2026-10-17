import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Enums as CoreEnums, eventTarget } from '@cornerstonejs/core';
import { Enums as ToolEnums } from '@cornerstonejs/tools';
import { api, type Attempt, type KCInfo, type SubmitResult, type TutorReply } from '../../api';
import { SinapsViewer, initCornerstone, rleDecode, rleEncode, type Mode } from '../../viewer/cs';
import MasteryBars from '../../components/MasteryBars';
import { TopBar } from '../../components/Shell';
import { Tour, useTour, type TourStep } from '../../components/Tour';

const id = (x: number, d: number) => x.toFixed(d).replace('.', ',');
const SEQ_NAMES = ['DWI', 'ADC', 'FLAIR'];
const HEMIS = ['kiri', 'kanan', 'bilateral'];
const LATIHAN_TOUR: TourStep[] = [
  { title: 'Ruang baca kasus', body: 'Di sini kamu membaca satu kasus MRI, menjawab soal per kompetensi, lalu menandai lesinya. Ikuti panduan singkat ini.' },
  { target: 'case', title: 'Kasus dan sasaranmu', body: 'Vignette pasien, tingkat kesulitan, dan KC yang sedang disasar. Arahkan kursor ke sasaran untuk melihat alasan sistem memilih kasus ini.' },
  { target: 'tools', title: 'Alat viewer', body: 'W/L (N) untuk kecerahan dan kontras, Kuas (B), Hapus (E), dan Titik (T). Tombol paling bawah memindah seri 1, 2, 3.', padding: 4 },
  { target: 'viewer', title: 'Citra MRI', body: 'Gulir roda tetikus untuk berpindah slice. Huruf R di kiri layar adalah sisi kanan pasien.', padding: 0 },
  { target: 'steps', title: 'Kerjakan berurutan', body: 'Soal disusun per KC. Jawab sekuens dulu, lalu tunjuk lesi, nilai ADC-nya, dan delineasi seluruh lesi.' },
  { target: 'submit', title: 'Kirim untuk dinilai', body: 'Jawabanmu dibandingkan dengan mask ahli. Setelah itu tutor siap menjelaskan kesalahanmu.' },
  { target: 'help', title: 'Selesai', body: 'Tekan Panduan di bilah atas kapan saja untuk memutar ulang.' },
];

type Msg = { role: 'user' | 'assistant'; content: string; meta?: TutorReply; image?: boolean };

export default function Latihan() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const elRef = useRef<HTMLDivElement>(null);
  const viewer = useRef<SinapsViewer | null>(null);

  const [att, setAtt] = useState<Attempt | null>(null);
  const [kcInfo, setKcInfo] = useState<Record<string, KCInfo>>({});
  const [adcBins, setAdcBins] = useState<string[]>([]);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const tour = useTour('latihan', { when: !!att && !loading, delay: 1400 });
  const [series, setSeries] = useState(0);
  const [mode, setModeState] = useState<Mode>('navigasi');
  const [brush, setBrush] = useState(4);
  const [slice, setSlice] = useState(0);
  const [probe, setProbe] = useState<{ ijk: number[]; value: number | null } | null>(null);
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(null);

  // jawaban
  const [k1, setK1] = useState<Record<string, string>>({});
  const [seqOrder, setSeqOrder] = useState<Record<string, string> | null>(null);
  const [k1Ok, setK1Ok] = useState<boolean | null>(null);
  const [point, setPoint] = useState<[number, number, number] | null>(null);
  const [hemi, setHemi] = useState('');
  const [adcBin, setAdcBin] = useState('');
  const [restr, setRestr] = useState<boolean | null>(null);
  const [markedMl, setMarkedMl] = useState(0);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [overlay, setOverlay] = useState({ jawaban: true, kunci: true, model: false });
  const [submitting, setSubmitting] = useState(false);

  // tutor
  const [tMode, setTMode] = useState<'sokratik' | 'penjelasan' | 'rujukan'>('sokratik');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [attach, setAttach] = useState(true);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    api.kc().then((r) => {
      setKcInfo(r.kc);
      setAdcBins(r.adc_bins);
    });
  }, []);

  const resetAnswers = () => {
    setK1({});
    setSeqOrder(null);
    setK1Ok(null);
    setPoint(null);
    setHemi('');
    setAdcBin('');
    setRestr(null);
    setMarkedMl(0);
    setResult(null);
    setOverlay({ jawaban: true, kunci: true, model: false });
    setMsgs([]);
    setSeries(0);
    setModeState('navigasi');
  };

  const targetKc = params.get('kc');
  const loadAttempt = useCallback(async (opts: { caseId?: string | null; kc?: string | null; baru?: boolean }) => {
    setError('');
    setLoading('Memilih kasus…');
    try {
      const a = opts.caseId ? await api.open(opts.caseId) : await api.next({ kc: opts.kc ?? undefined, baru: opts.baru });
      resetAnswers();
      // K1 yang sudah dikunci sebelum halaman dimuat ulang
      if (a.k1 && a.seq_order) {
        setK1(a.k1);
        setSeqOrder(a.seq_order);
        setK1Ok(Object.entries(a.seq_order).every(([l, n]) => a.k1![l] === n));
      }
      setAtt(a);
    } catch (e) {
      setError(String((e as Error).message));
      setLoading('');
    }
  }, []);

  useEffect(() => {
    loadAttempt({ caseId: params.get('kasus'), kc: params.get('kc') });
  }, [loadAttempt, params]);

  const nextCase = () => {
    if (params.get('kasus')) nav(targetKc ? `/latihan?kc=${targetKc}` : '/latihan');
    else loadAttempt({ kc: targetKc, baru: true });
  };

  // muat volume ke Cornerstone setiap kasus berganti
  useEffect(() => {
    if (!att || !elRef.current) return;
    let cancelled = false;
    const el = elRef.current;
    (async () => {
      await initCornerstone();
      viewer.current?.destroy();
      const v = new SinapsViewer(el, att.case);
      viewer.current = v;
      setLoading('Memuat citra MRI 0/3…');
      try {
        await v.load(
          att.series.map((s) => s.file),
          (n) => setLoading(`Memuat citra MRI ${n}/3…`),
        );
        if (!cancelled) {
          setLoading('');
          setSlice(v.currentSlice());
        }
      } catch (e) {
        setError(String((e as Error).message));
        setLoading('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [att]);

  useEffect(() => () => viewer.current?.destroy(), []);

  // nomor slice + posisi penanda titik setiap render
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const onRender = () => {
      const v = viewer.current;
      if (!v || !v.volumeIds.length) return;
      const k = v.currentSlice();
      setSlice(k);
      if (point && Math.round(point[2]) === k) {
        const c = v.worldOfVoxel(point);
        setMarkerPos([c[0], c[1]]);
      } else setMarkerPos(null);
    };
    el.addEventListener(CoreEnums.Events.IMAGE_RENDERED, onRender);
    return () => el.removeEventListener(CoreEnums.Events.IMAGE_RENDERED, onRender);
  }, [point]);

  // volume tandaan mahasiswa (diperbarui setelah sapuan kuas)
  useEffect(() => {
    let timer: number | undefined;
    const onMod = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        const v = viewer.current;
        if (!v || !att) return;
        const m = v.getMask('jawaban');
        let n = 0;
        for (let i = 0; i < m.length; i++) n += m[i];
        const [sx, sy, sz] = att.case.spacing;
        setMarkedMl((n * sx * sy * sz) / 1000);
      }, 250);
    };
    eventTarget.addEventListener(ToolEnums.Events.SEGMENTATION_DATA_MODIFIED, onMod);
    return () => eventTarget.removeEventListener(ToolEnums.Events.SEGMENTATION_DATA_MODIFIED, onMod);
  }, [att]);

  const setMode = (m: Mode) => {
    if (result && (m === 'kuas' || m === 'hapus' || m === 'titik')) return;
    setModeState(m);
    viewer.current?.setMode(m);
  };

  const showSeries = async (i: number) => {
    setSeries(i);
    await viewer.current?.showSeries(i);
  };

  // pintasan papan ketik
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        viewer.current?.undo();
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        viewer.current?.redo();
        return;
      }
      const map: Record<string, () => void> = {
        '1': () => showSeries(0),
        '2': () => showSeries(1),
        '3': () => showSeries(2),
        n: () => setMode('navigasi'),
        b: () => setMode('kuas'),
        e: () => setMode('hapus'),
        t: () => setMode('titik'),
        r: () => viewer.current?.resetView(),
      };
      map[e.key.toLowerCase()]?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = viewer.current;
    if (!v || !v.volumeIds.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    setProbe(v.probe(e.clientX - r.left, e.clientY - r.top));
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'titik' || result) return;
    const v = viewer.current;
    if (!v) return;
    const r = e.currentTarget.getBoundingClientRect();
    const p = v.probe(e.clientX - r.left, e.clientY - r.top);
    if (p && p.value !== null) {
      setPoint(p.ijk as [number, number, number]);
      const c = v.worldOfVoxel(p.ijk as [number, number, number]);
      setMarkerPos([c[0], c[1]]);
    }
  };

  const labelOf = (i: number) => {
    const lbl = att?.series[i]?.label ?? '';
    return seqOrder ? `${seqOrder[lbl]}` : `Seri ${lbl}`;
  };
  const activeName = seqOrder && att ? seqOrder[att.series[series].label] : null;

  const doReveal = async () => {
    if (!att) return;
    const r = await api.reveal(att.attempt_id, k1);
    setSeqOrder(r.seq_order);
    setK1Ok(r.benar);
  };

  const doSubmit = async () => {
    const v = viewer.current;
    if (!att || !v) return;
    setSubmitting(true);
    setError('');
    try {
      const mask = v.getMask('jawaban');
      const res = await api.submit({
        attempt_id: att.attempt_id,
        k1: Object.keys(k1).length ? k1 : null,
        k2_point: point,
        k2_hemisfer: hemi || null,
        k3_adc_bin: adcBin || null,
        k3_restriksi: restr,
        mask_rle: rleEncode(mask),
      });
      const total = mask.length;
      v.setMask('kunci', rleDecode(res.gt_rle, total));
      if (res.pred_rle) v.setMask('model', rleDecode(res.pred_rle, total));
      v.lockAnswer();
      v.setVisible('kunci', true);
      setModeState('navigasi');
      setSeqOrder(res.seq_order);
      setResult(res);
      setMsgs([
        {
          role: 'assistant',
          content:
            'Jawabanmu sudah dinilai. Kunci jawaban kini terbuka untuk tutor. Mau mulai dari mana? Coba tanyakan, misalnya, "Bagian mana yang terlewat?"',
        },
      ]);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleOverlay = (k: 'jawaban' | 'kunci' | 'model') => {
    const on = !overlay[k];
    setOverlay({ ...overlay, [k]: on });
    viewer.current?.setVisible(k, on);
  };

  const sendTutor = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || !att) return;
    const image = attach && viewer.current ? viewer.current.capture() : null;
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: 'user', content: message, image: !!image }]);
    setInput('');
    setAsking(true);
    try {
      const r = await api.tutor({ attempt_id: att.attempt_id, mode: tMode, message, image, history });
      setMsgs((m) => [...m, { role: 'assistant', content: r.reply, meta: r }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', content: `Tutor gagal dihubungi: ${(e as Error).message}` }]);
    } finally {
      setAsking(false);
    }
  };

  const valueText = () => {
    if (!probe || probe.value === null) return '—';
    if (activeName === 'ADC') return `ADC relatif ${(probe.value / 100).toFixed(2).replace('.', ',')}`;
    return `nilai ${probe.value}`;
  };

  const d = result?.delineasi;
  const nFocus = d?.fokus.length ?? 0;
  const hit = d?.fokus.filter((f) => f.tersentuh).length ?? 0;
  const v = att?.case.vignette;
  const k1Done = seqOrder !== null;
  const canSubmit = !result && !submitting && !loading;

  return (
    <div className="app">
      <TopBar onHelp={tour.start}>
        {att && (
          <div className="case-info" data-tour="case">
            <span className="case-id">SOOP {att.case.id}</span>
            <span>
              {v?.jenis_kelamin}, {v?.usia ?? '?'} th · NIHSS {v?.nihss ?? '?'}
            </span>
            <span className={`tier tier-${att.tier}`}>{att.tier}</span>
            <span className="target" title={att.reason}>
              Sasaran: {att.target_kc === 'bebas' ? 'pilihan sendiri' : `${att.target_kc} ${kcInfo[att.target_kc]?.nama ?? ''}`}
            </span>
          </div>
        )}
      </TopBar>

      <main className="workspace">
        <Tour steps={LATIHAN_TOUR} open={tour.open} onClose={tour.close} />
        <aside className="toolbar legacy-dark" aria-label="Alat viewer" data-tour="tools">
          <ToolBtn on={mode === 'navigasi'} onClick={() => setMode('navigasi')} k="N" label="W/L" title="Navigasi: seret kiri = window/level, kanan = zoom, tengah = geser, roda = slice" />
          <ToolBtn on={mode === 'kuas'} onClick={() => setMode('kuas')} k="B" label="Kuas" disabled={!!result} title="Kuas anotasi lesi" />
          <ToolBtn on={mode === 'hapus'} onClick={() => setMode('hapus')} k="E" label="Hapus" disabled={!!result} title="Penghapus" />
          <ToolBtn on={mode === 'titik'} onClick={() => setMode('titik')} k="T" label="Titik" disabled={!!result} title="Klik satu titik di dalam lesi (soal K2)" />
          <label className="brush" title="Ukuran kuas (mm)">
            <span>{brush} mm</span>
            <input
              type="range"
              min={1}
              max={15}
              value={brush}
              onChange={(e) => {
                setBrush(+e.target.value);
                viewer.current?.setBrushSize(+e.target.value);
              }}
              aria-label="Ukuran kuas"
            />
          </label>
          <button className="tool" onClick={() => viewer.current?.undo()} title="Urungkan (Ctrl+Z)" disabled={!!result}>
            Urung
          </button>
          <button className="tool" onClick={() => viewer.current?.resetView()} title="Atur ulang tampilan (R)">
            Reset
          </button>
          <div className="sep" />
          {att?.series.map((s, i) => (
            <ToolBtn key={s.label} on={series === i} onClick={() => showSeries(i)} k={String(i + 1)} label={seqOrder ? seqOrder[s.label] : s.label} title={labelOf(i)} />
          ))}
        </aside>

        <section className="viewer-wrap legacy-dark" data-tour="viewer">
          <div
            className={`viewport mode-${mode}`}
            ref={elRef}
            onMouseMove={onMouseMove}
            onMouseLeave={() => setProbe(null)}
            onClick={onClick}
            onContextMenu={(e) => e.preventDefault()}
          />
          <div className="vp-overlay tl">
            {labelOf(series)} · slice {slice + 1}/{att?.case.dimensions[2] ?? '?'}
          </div>
          <div className="vp-overlay bl">{valueText()}</div>
          <div className="vp-overlay tr">
            {mode === 'kuas' ? `Kuas ${brush} mm · ditandai ${markedMl.toFixed(1).replace('.', ',')} ml` : mode === 'titik' ? 'Klik di dalam lesi' : ''}
          </div>
          <div className="vp-overlay side-l">R</div>
          <div className="vp-overlay side-r">L</div>
          {markerPos && <div className="marker" style={{ left: markerPos[0], top: markerPos[1] }} />}
          {loading && <div className="vp-loading">{loading}</div>}
          {error && <div className="vp-error">{error}</div>}
          <p className="disclaimer">Alat bantu belajar. Bukan untuk mendiagnosis pasien. Data: SOOP (OpenNeuro ds004889, CC0).</p>
        </section>

        <aside className="panel">
          {!result && att && (
            <div className="card steps" data-tour="steps">
              <h2>Kerjakan kasus</h2>
              <p className="muted small">{att.reason}</p>

              <Step n={1} kc="K1" title="Kenali sekuens" done={k1Done}>
                <p className="small">Buka tiap seri (tombol 1, 2, 3), lalu tentukan sekuensnya.</p>
                {att.series.map((s) => (
                  <div className="row" key={s.label}>
                    <span className="lbl">Seri {s.label}</span>
                    <select value={k1[s.label] ?? ''} disabled={k1Done} onChange={(e) => setK1({ ...k1, [s.label]: e.target.value })} aria-label={`Sekuens seri ${s.label}`}>
                      <option value="">pilih…</option>
                      {SEQ_NAMES.map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                ))}
                {!k1Done ? (
                  <button className="btn small" disabled={Object.keys(k1).length < 3} onClick={doReveal}>
                    Kunci jawaban K1 &amp; buka label
                  </button>
                ) : (
                  <p className={`verdict ${k1Ok ? 'ok' : 'bad'}`}>{k1Ok ? 'Benar.' : 'Belum tepat.'} Label seri sudah dibuka.</p>
                )}
              </Step>

              <Step n={2} kc="K2" title="Temukan lesi" done={!!point && !!hemi}>
                <p className="small">Pilih alat Titik (T), klik satu titik di dalam lesi akut, lalu tentukan hemisfernya.</p>
                <div className="row">
                  <span className="lbl">Titik</span>
                  <span className="mono">{point ? `slice ${point[2] + 1}` : 'belum'}</span>
                </div>
                <div className="seg">
                  {HEMIS.map((h) => (
                    <button key={h} className={hemi === h ? 'on' : ''} onClick={() => setHemi(h)}>
                      {h}
                    </button>
                  ))}
                </div>
              </Step>

              <Step n={3} kc="K3" title="Restriksi sejati?" done={!!adcBin && restr !== null}>
                <p className="small">Arahkan kursor ke lesi pada seri ADC. Nilainya tampil di kiri bawah sebagai ADC relatif (dibanding median otak).</p>
                <div className="seg">
                  {adcBins.map((b) => (
                    <button key={b} className={adcBin === b ? 'on' : ''} onClick={() => setAdcBin(b)}>
                      {b}
                    </button>
                  ))}
                </div>
                <div className="seg">
                  <button className={restr === true ? 'on' : ''} onClick={() => setRestr(true)}>
                    restriksi sejati
                  </button>
                  <button className={restr === false ? 'on' : ''} onClick={() => setRestr(false)}>
                    T2 shine-through
                  </button>
                </div>
              </Step>

              <Step n={4} kc="K6" title="Delineasi seluruh lesi" done={markedMl > 0}>
                <p className="small">Pilih Kuas (B), tandai semua fokus lesi di setiap slice. Penghapus (E), urungkan (Ctrl+Z).</p>
                <div className="row">
                  <span className="lbl">Ditandai</span>
                  <span className="mono">{markedMl.toFixed(2).replace('.', ',')} ml</span>
                </div>
              </Step>

              <button className="btn primary block" disabled={!canSubmit} onClick={doSubmit} data-tour="submit">
                {submitting ? 'Menilai…' : 'Kirim jawaban'}
              </button>
              <button className="btn small block ghost" disabled={!!loading || submitting} onClick={nextCase} title="Tinggalkan kasus ini tanpa dinilai">
                Lewati kasus ini
              </button>
            </div>
          )}

          {result && d && (
            <div className="card">
              <h2>Hasil penilaian otomatis</h2>
              <div className="metrics">
                <Metric label="Dice" value={id(d.dice, 2)} good={d.dice >= 0.6} />
                <Metric label="Lesi ditemukan" value={`${hit} dari ${nFocus}`} good={hit === nFocus} />
                <Metric label="Galat volume" value={`${d.vol_err > 0 ? '+' : ''}${Math.round(d.vol_err * 100)}%`} good={Math.abs(d.vol_err) <= 0.15} />
                <Metric label="HD95" value={d.hd95 === null ? '—' : `${id(d.hd95, 1)} mm`} good={(d.hd95 ?? 99) <= 5} />
              </div>
              <p className="etype">
                Jenis kesalahan: <b>{d.jenis_kesalahan_label}</b>
              </p>
              <ul className="kc-results">
                {Object.entries(result.kc).map(([k, r]) => (
                  <li key={k} className={r.benar ? 'ok' : 'bad'}>
                    <b>{k}</b> {kcInfo[k]?.nama}: {r.benar ? 'benar' : 'belum tepat'}
                    {k === 'K2' && !r.benar && <span className="muted"> (kunci: {String(r.kunci_hemisfer)}{r.titik_di_lesi ? '' : ', titik di luar lesi'})</span>}
                    {k === 'K3' && <span className="muted"> (ADC relatif lesi {String(r.adc_relatif_lesi).replace('.', ',')})</span>}
                  </li>
                ))}
              </ul>
              {d.fokus.some((f) => !f.tersentuh) && (
                <div className="missed">
                  <h3>Fokus yang terlewat</h3>
                  {d.fokus
                    .filter((f) => !f.tersentuh)
                    .slice(0, 6)
                    .map((f, i) => (
                      <button key={i} className="chip" onClick={() => viewer.current?.jumpToVoxel(f.pusat_voxel.map(Math.round) as [number, number, number])}>
                        {f.ml.toFixed(2).replace('.', ',')} ml · slice {f.slice_terbesar}
                      </button>
                    ))}
                </div>
              )}
              <div className="overlays">
                <label>
                  <input type="checkbox" checked={overlay.jawaban} onChange={() => toggleOverlay('jawaban')} />
                  <i className="sw orange" /> Jawaban saya
                </label>
                <label>
                  <input type="checkbox" checked={overlay.kunci} onChange={() => toggleOverlay('kunci')} />
                  <i className="sw green" /> Kunci jawaban (mask ahli)
                </label>
                <label className={result.model ? '' : 'muted'}>
                  <input type="checkbox" checked={overlay.model} disabled={!result.model} onChange={() => toggleOverlay('model')} />
                  <i className="sw blue" /> Pembaca kedua (U-Net)
                </label>
              </div>
              {result.model && (
                <p className="small muted">
                  Model: Dice {id(result.model.dice_terhadap_kunci, 2)} terhadap kunci, {id(result.model.volume_ml, 1)} ml.
                  {result.model.keyakinan_rendah && ' Keyakinan rendah (lesi < 5 ml).'} Penilaianmu selalu memakai mask ahli, bukan model.
                </p>
              )}
              <details className="small">
                <summary>Temuan terstruktur &amp; luaran klinis</summary>
                <p>
                  {result.findings.jumlah_fokus} fokus, {id(result.findings.volume_ml, 2)} ml ({result.findings.kategori_volume}), hemisfer {result.findings.hemisfer}, slice terbesar {result.findings.slice_lesi_terbesar}. Indeks
                  kesulitan D = {result.findings.indeks_kesulitan_D}.
                </p>
                <p>
                  Rankin saat pulang: {result.luaran.rankin_pulang ?? 'tidak tercatat'}. Etiologi: {result.luaran.etiologi ?? 'tidak tercatat'}.
                </p>
              </details>
              <button className="btn primary block" onClick={nextCase}>
                {targetKc ? `Kasus ${targetKc} berikutnya` : 'Kasus berikutnya (adaptif)'}
              </button>
              <div className="row-btns">
                <Link to={`/riwayat/${att!.attempt_id}`} className="btn small">
                  Tinjau di riwayat
                </Link>
                <Link to="/beranda" className="btn small">
                  Ke beranda
                </Link>
              </div>
            </div>
          )}

          <div className="card">
            <h2>Penguasaan kompetensi (BKT)</h2>
            <MasteryBars kc={kcInfo} before={result?.mastery_before ?? att?.mastery} after={result?.mastery_after} />
          </div>

          <div className="card tutor">
            <div className="tutor-head">
              <h2>Tutor</h2>
              <div className="seg small">
                {(['sokratik', 'penjelasan', 'rujukan'] as const).map((m) => (
                  <button key={m} className={tMode === m ? 'on' : ''} onClick={() => setTMode(m)}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <p className="small muted">{result ? 'Tutor menerima temuan terstruktur dan hasil penilaianmu.' : 'Kunci jawaban terkunci sampai jawaban dikirim; tutor hanya membimbing cara membaca.'}</p>
            <div className="msgs" aria-live="polite">
              {msgs.map((m, i) => (
                <div key={i} className={`msg ${m.role}`}>
                  {m.image && <span className="att">slice terlampir</span>}
                  <p>{m.content}</p>
                  {m.meta && (
                    <span className="meta">
                      {m.meta.source === 'llm' ? m.meta.model : m.meta.source} · {id(m.meta.latency_ms / 1000, 1)} dtk
                      {m.meta.issues.length > 0 && <b className="warn"> · pemeriksa fakta: {m.meta.issues.join('; ')}</b>}
                    </span>
                  )}
                  {m.meta?.rujukan && m.meta.rujukan.length > 0 && (
                    <details className="refs">
                      <summary>Rujukan ({m.meta.rujukan.length})</summary>
                      {m.meta.rujukan.map((r, j) => (
                        <p key={j}>
                          <b>{r.judul}</b> <i>{r.sumber}</i>
                        </p>
                      ))}
                    </details>
                  )}
                </div>
              ))}
              {asking && <div className="msg assistant typing">menulis…</div>}
            </div>
            <form
              className="ask"
              onSubmit={(e) => {
                e.preventDefault();
                sendTutor();
              }}
            >
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Tanya tentang slice ini…" aria-label="Pesan untuk tutor" />
              <button className="btn" disabled={asking || !input.trim()}>
                Kirim
              </button>
            </form>
            <label className="small attach">
              <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} /> Capture: lampirkan slice yang sedang tampil
            </label>
          </div>
        </aside>
      </main>
    </div>
  );
}

function ToolBtn(p: { on: boolean; onClick: () => void; k: string; label: string; title: string; disabled?: boolean }) {
  return (
    <button className={`tool ${p.on ? 'on' : ''}`} onClick={p.onClick} title={`${p.title} (${p.k})`} disabled={p.disabled} aria-pressed={p.on}>
      {p.label}
      <kbd>{p.k}</kbd>
    </button>
  );
}

function Step(p: { n: number; kc: string; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className={`step ${p.done ? 'done' : ''}`}>
      <h3>
        <span className="num">{p.done ? '✓' : p.n}</span> {p.title} <span className="kc">{p.kc}</span>
      </h3>
      {p.children}
    </section>
  );
}

function Metric(p: { label: string; value: string; good: boolean }) {
  return (
    <div className={`metric ${p.good ? 'good' : 'bad'}`}>
      <span>{p.label}</span>
      <b>{p.value}</b>
    </div>
  );
}
