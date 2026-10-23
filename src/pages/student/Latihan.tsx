import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Enums as CoreEnums, eventTarget } from '@cornerstonejs/core';
import { Enums as ToolEnums } from '@cornerstonejs/tools';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ApiError, api, type Attempt, type KCInfo, type SubmitResult, type TutorReply } from '../../api';
import { SinapsViewer, ViewerAborted, initCornerstone, rleDecode, rleEncode, type Mode } from '../../viewer/cs';
import MasteryBars from '../../components/MasteryBars';
import Markdown from '../../components/Markdown';
import { TopBar } from '../../components/Shell';
import { Tour, useTour, type TourStep } from '../../components/Tour';
import { Brush, Check, ChevronDown, Crosshair, Eraser, Eye, Lock, RotateCcw, Send, Square, Target, Undo2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIER_TONE } from '@/lib/status';
import './latihan.css';

const id = (x: number, d: number) => x.toFixed(d).replace('.', ',');
const SEQ_NAMES = ['DWI', 'ADC', 'FLAIR'];
const HEMIS = [
  { v: 'kiri', hint: 'sisi L di layar' },
  { v: 'kanan', hint: 'sisi R di layar' },
  { v: 'bilateral', hint: 'kedua sisi' },
];
// cadangan bila /api/kc gagal dimuat; sama dengan ADC_BINS di sinaps/grading.py
const ADC_BINS_FALLBACK = ['<0,6', '0,6-0,8', '0,8-1,0', '>1,0'];
const ACTIVE_KC = ['K1', 'K2', 'K3', 'K6'];
const PANEL_KEY = 'sinaps-panel-w';
const LATIHAN_TOUR: TourStep[] = [
  {
    title: 'Ruang baca kasus',
    body: 'Di sini kamu membaca satu kasus MRI, menjawab soal per kompetensi, lalu menandai lesinya. Ikuti panduan singkat ini.',
  },
  {
    target: 'case',
    title: 'Kasus dan sasaranmu',
    body: 'Vignette pasien, tingkat kesulitan, dan KC yang sedang disasar. Arahkan kursor ke sasaran untuk melihat alasan sistem memilih kasus ini.',
  },
  {
    target: 'tools',
    title: 'Alat viewer',
    body: 'W/L (N) untuk kecerahan dan kontras, Kuas (B), Hapus (E), dan Titik (T). Tombol paling bawah memindah seri 1, 2, 3.',
    padding: 4,
  },
  {
    target: 'viewer',
    title: 'Citra MRI',
    body: 'Gulir roda tetikus untuk berpindah slice. Huruf R di kiri layar adalah sisi kanan pasien.',
    padding: 0,
  },
  {
    target: 'splitter',
    title: 'Atur lebar',
    body: 'Seret garis ini untuk memperlebar citra atau panel soal. Klik dua kali untuk kembali ke ukuran awal.',
    padding: 6,
  },
  {
    target: 'steps',
    title: 'Kerjakan berurutan',
    body: 'Soal disusun per KC. Klik judul langkah untuk membuka atau menutupnya. Langkah berikutnya terbuka otomatis setelah satu langkah selesai.',
  },
  {
    target: 'submit',
    title: 'Kirim untuk dinilai',
    body: 'Jawabanmu dibandingkan dengan mask ahli. Langkah yang belum dijawab dihitung salah. Setelah itu tutor siap menjelaskan kesalahanmu.',
  },
  {
    target: 'help',
    title: 'Selesai',
    body: 'Tekan Panduan di bilah atas kapan saja untuk memutar ulang.',
  },
];
const TUTOR_HINTS_BEFORE = ['Bagaimana membedakan DWI dan ADC?', 'Apa itu T2 shine-through?', 'Bagaimana cara mencari fokus kecil?'];
// saran setelah submit mengikuti hasil: jangan menawarkan "kenapa keliru" untuk jawaban yang benar
const tutorHintsAfter = (r: SubmitResult) => [
  r.delineasi?.fokus.some((f) => !f.tersentuh) ? 'Bagian mana yang terlewat?' : 'Bagaimana memperbaiki delineasiku?',
  r.kc.K3?.benar ? 'Apa arti nilai ADC lesi ini?' : 'Kenapa jawaban K3-ku keliru?',
  'Jelaskan lesi di kasus ini',
];

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  meta?: TutorReply;
  image?: boolean;
  failed?: boolean;
};
type KcResult = SubmitResult['kc'][string];

const readPanelW = () => {
  try {
    const v = Number(localStorage.getItem(PANEL_KEY));
    if (v >= 300) return v;
  } catch {
    /* penyimpanan diblokir */
  }
  return null;
};
const defaultPanelW = () => Math.round(Math.min(500, Math.max(400, window.innerWidth * 0.32)));

export default function Latihan() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const reduce = useReducedMotion();
  const wsRef = useRef<HTMLElement>(null);
  const elRef = useRef<HTMLDivElement>(null);
  const viewer = useRef<SinapsViewer | null>(null);
  const loadSeq = useRef(0);
  const tutorAbort = useRef<AbortController | null>(null);
  const msgsRef = useRef<HTMLDivElement>(null);
  const submitLock = useRef(false);

  const [att, setAtt] = useState<Attempt | null>(null);
  const [kcInfo, setKcInfo] = useState<Record<string, KCInfo>>({});
  const [adcBins, setAdcBins] = useState<string[]>(ADC_BINS_FALLBACK);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState('');
  const [ready, setReady] = useState(false);
  const tour = useTour('latihan', { when: !!att && !loading, delay: 1400 });
  const [series, setSeries] = useState(0);
  const [mode, setModeState] = useState<Mode>('navigasi');
  const [brush, setBrush] = useState(4);
  const [slice, setSlice] = useState(0);
  const [probe, setProbe] = useState<{
    ijk: number[];
    value: number | null;
  } | null>(null);
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(null);
  const [panelW, setPanelW] = useState(() => readPanelW() ?? defaultPanelW());
  const [dragging, setDragging] = useState(false);
  const brushRef = useRef(brush);
  brushRef.current = brush;

  // jawaban
  const [k1, setK1] = useState<Record<string, string>>({});
  const [seqOrder, setSeqOrder] = useState<Record<string, string> | null>(null);
  const [k1Ok, setK1Ok] = useState<boolean | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [point, setPoint] = useState<[number, number, number] | null>(null);
  const [hemi, setHemi] = useState('');
  const [adcBin, setAdcBin] = useState('');
  const [restr, setRestr] = useState<boolean | null>(null);
  const [markedMl, setMarkedMl] = useState(0);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [overlay, setOverlay] = useState({
    jawaban: true,
    kunci: true,
    model: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [openStep, setOpenStep] = useState<number | null>(1);

  // tutor
  const [tMode, setTMode] = useState<'sokratik' | 'penjelasan' | 'rujukan'>('sokratik');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [attach, setAttach] = useState(true);
  const [tutorBusy, setTutorBusy] = useState<'' | 'menunggu' | 'menulis'>('');

  // KC + rentang ADC; dicoba ulang beberapa kali karena fungsi API bisa sedang bangun
  useEffect(() => {
    let alive = true;
    (async () => {
      for (let i = 0; i < 3 && alive; i++) {
        try {
          const r = await api.kc();
          if (!alive) return;
          setKcInfo(r.kc);
          if (r.adc_bins?.length) setAdcBins(r.adc_bins);
          return;
        } catch {
          await new Promise((res) => setTimeout(res, 1000 * (i + 1)));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const stopTutor = () => {
    tutorAbort.current?.abort();
    tutorAbort.current = null;
    setTutorBusy('');
  };

  const resetAnswers = () => {
    stopTutor();
    setK1({});
    setSeqOrder(null);
    setK1Ok(null);
    setPoint(null);
    setMarkerPos(null);
    setHemi('');
    setAdcBin('');
    setRestr(null);
    setMarkedMl(0);
    setResult(null);
    setConfirmSubmit(false);
    setOverlay({ jawaban: true, kunci: true, model: false });
    setMsgs([]);
    setSeries(0);
    setModeState('navigasi');
    setOpenStep(1);
    submitLock.current = false;
  };

  const targetKc = params.get('kc');
  const loadAttempt = useCallback(async (opts: { caseId?: string | null; kc?: string | null; baru?: boolean }) => {
    // hanya permintaan terakhir yang dipakai: klik ganda atau ganti URL saat memuat tidak menimpa kasus baru
    const seq = ++loadSeq.current;
    setError('');
    setBlocked('');
    setReady(false);
    setLoading('Memilih kasus…');
    try {
      const a = opts.caseId ? await api.open(opts.caseId) : await api.next({ kc: opts.kc ?? undefined, baru: opts.baru });
      if (seq !== loadSeq.current) return;
      resetAnswers();
      // K1 yang sudah dikunci sebelum halaman dimuat ulang
      if (a.k1 && a.seq_order) {
        setK1(a.k1);
        setSeqOrder(a.seq_order);
        setK1Ok(Object.entries(a.seq_order).every(([l, n]) => a.k1![l] === n));
        setOpenStep(2);
      }
      setAtt(a);
    } catch (e) {
      if (seq !== loadSeq.current) return;
      viewer.current?.destroy();
      viewer.current = null;
      setAtt(null);
      setLoading('');
      if (e instanceof ApiError && e.status === 409) setBlocked(e.message);
      else setError((e as Error).message);
    }
  }, []);

  // bergantung pada nilai parameter, bukan objek params (identitasnya bisa berganti tanpa URL berubah)
  const kasusParam = params.get('kasus');
  useEffect(() => {
    loadAttempt({ caseId: kasusParam, kc: targetKc });
  }, [loadAttempt, kasusParam, targetKc]);

  const nextCase = () => {
    if (loading) return;
    if (params.get('kasus')) nav(targetKc ? `/latihan?kc=${targetKc}` : '/latihan');
    else loadAttempt({ kc: targetKc, baru: true });
  };

  const retry = () => loadAttempt({ caseId: params.get('kasus'), kc: params.get('kc') });

  // muat volume ke Cornerstone setiap kasus berganti
  useEffect(() => {
    if (!att || !elRef.current) return;
    let cancelled = false;
    const el = elRef.current;
    (async () => {
      setLoading('Memuat citra MRI 0/3…');
      try {
        await initCornerstone();
        if (cancelled) return;
        viewer.current?.destroy();
        const v = new SinapsViewer(el, att.case);
        viewer.current = v;
        await v.load(
          att.series.map((s) => s.file),
          (n) => !cancelled && setLoading(`Memuat citra MRI ${n}/3…`),
        );
        if (cancelled) return;
        v.setBrushSize(brushRef.current);
        setLoading('');
        setReady(true);
        setSlice(v.currentSlice());
      } catch (e) {
        if (cancelled || e instanceof ViewerAborted) return;
        setError(String((e as Error).message));
        setLoading('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [att]);

  useEffect(
    () => () => {
      loadSeq.current++;
      tutorAbort.current?.abort();
      viewer.current?.destroy();
      viewer.current = null;
    },
    [],
  );

  // nomor slice + posisi penanda titik setiap render
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const onRender = () => {
      const v = viewer.current;
      if (!v?.ready) return;
      const k = v.currentSlice();
      setSlice(k);
      if (point && Math.round(point[2]) === k) {
        const c = v.worldOfVoxel(point);
        setMarkerPos([c[0], c[1]]);
      } else setMarkerPos(null);
    };
    // CAMERA_MODIFIED juga: lompatan terprogram (fokus terlewat) tidak selalu memicu IMAGE_RENDERED
    el.addEventListener(CoreEnums.Events.IMAGE_RENDERED, onRender);
    el.addEventListener(CoreEnums.Events.CAMERA_MODIFIED, onRender);
    return () => {
      el.removeEventListener(CoreEnums.Events.IMAGE_RENDERED, onRender);
      el.removeEventListener(CoreEnums.Events.CAMERA_MODIFIED, onRender);
    };
  }, [point]);

  // volume tandaan mahasiswa (diperbarui setelah sapuan kuas)
  useEffect(() => {
    let timer: number | undefined;
    const onMod = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        const v = viewer.current;
        if (!v?.ready || !att) return;
        const m = v.getMask('jawaban');
        let n = 0;
        for (let i = 0; i < m.length; i++) n += m[i];
        const [sx, sy, sz] = att.case.spacing;
        setMarkedMl((n * sx * sy * sz) / 1000);
      }, 250);
    };
    eventTarget.addEventListener(ToolEnums.Events.SEGMENTATION_DATA_MODIFIED, onMod);
    return () => {
      clearTimeout(timer);
      eventTarget.removeEventListener(ToolEnums.Events.SEGMENTATION_DATA_MODIFIED, onMod);
    };
  }, [att]);

  // chat tutor selalu mengikuti pesan terbaru
  useEffect(() => {
    const el = msgsRef.current;
    if (el)
      el.scrollTo({
        top: el.scrollHeight,
        behavior: reduce ? 'auto' : 'smooth',
      });
  }, [msgs, tutorBusy, reduce]);

  const setMode = (m: Mode) => {
    if (result && (m === 'kuas' || m === 'hapus' || m === 'titik')) return;
    if (!viewer.current?.ready) return;
    setModeState(m);
    viewer.current.setMode(m);
  };

  const showSeries = async (i: number) => {
    const v = viewer.current;
    if (!v?.ready || !att?.series[i]) return;
    setSeries(i);
    await v.showSeries(i);
  };

  const undo = () => {
    if (!result) viewer.current?.undo();
  };

  // pintasan papan ketik
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
      if (!viewer.current?.ready) return;
      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (!result) viewer.current?.redo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
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

  // --- panel yang bisa digeser -------------------------------------------------
  const clampW = useCallback((w: number) => {
    const total = wsRef.current?.getBoundingClientRect().width ?? window.innerWidth;
    return Math.round(Math.min(Math.max(w, 320), Math.max(320, Math.min(820, total - 76 - 360))));
  }, []);
  const savePanelW = (w: number) => {
    try {
      localStorage.setItem(PANEL_KEY, String(w));
    } catch {
      /* penyimpanan diblokir */
    }
  };
  useEffect(() => {
    const onResize = () => setPanelW((w) => clampW(w));
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, [clampW]);

  const onSplitDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    setDragging(true);
    const right = wsRef.current!.getBoundingClientRect().right;
    let last = panelW;
    const move = (ev: PointerEvent) => {
      last = clampW(right - ev.clientX);
      setPanelW(last);
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      setDragging(false);
      savePanelW(last);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };
  const onSplitKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 80 : 24;
    let w = panelW;
    if (e.key === 'ArrowLeft') w = clampW(panelW + step);
    else if (e.key === 'ArrowRight') w = clampW(panelW - step);
    else if (e.key === 'Home') w = clampW(820);
    else if (e.key === 'End') w = clampW(320);
    else return;
    e.preventDefault();
    setPanelW(w);
    savePanelW(w);
  };
  const resetPanelW = () => {
    const w = clampW(defaultPanelW());
    setPanelW(w);
    savePanelW(w);
  };

  // --- interaksi viewer ----------------------------------------------------------
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = viewer.current;
    if (!v?.ready) return;
    const r = e.currentTarget.getBoundingClientRect();
    setProbe(v.probe(e.clientX - r.left, e.clientY - r.top));
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'titik' || result) return;
    const v = viewer.current;
    if (!v?.ready) return;
    const r = e.currentTarget.getBoundingClientRect();
    const p = v.probe(e.clientX - r.left, e.clientY - r.top);
    if (p && p.value !== null) {
      setPoint(p.ijk as [number, number, number]);
      const c = v.worldOfVoxel(p.ijk as [number, number, number]);
      setMarkerPos([c[0], c[1]]);
      if (hemi) setOpenStep(3);
    }
  };

  const labelOf = (i: number) => {
    const lbl = att?.series[i]?.label ?? '';
    return seqOrder ? `${seqOrder[lbl]}` : `Seri ${lbl}`;
  };
  const activeName = seqOrder && att ? seqOrder[att.series[series]?.label] : null;
  const adcIndex = seqOrder && att ? att.series.findIndex((s) => seqOrder[s.label] === 'ADC') : -1;

  const pickSeq = (label: string, name: string) => {
    if (seqOrder) return;
    // satu nama sekuens hanya untuk satu seri: pilihan yang bentrok ditukar
    const next = { ...k1 };
    const other = Object.keys(next).find((l) => l !== label && next[l] === name);
    if (other) {
      if (next[label]) next[other] = next[label];
      else delete next[other];
    }
    next[label] = name;
    setK1(next);
  };

  const doReveal = async () => {
    if (!att || revealing || seqOrder) return;
    setRevealing(true);
    setError('');
    try {
      const r = await api.reveal(att.attempt_id, k1);
      setSeqOrder(r.seq_order);
      setK1Ok(r.benar);
      setOpenStep(2);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRevealing(false);
    }
  };

  const k1Filled = att ? att.series.every((s) => k1[s.label]) : false;
  const k2Filled = !!point && !!hemi;
  const k3Filled = !!adcBin && restr !== null;
  const k6Filled = markedMl > 0;
  const done = [!!seqOrder, k2Filled, k3Filled, k6Filled];
  const nDone = done.filter(Boolean).length;
  const missing = ['K1 sekuens', 'K2 titik & hemisfer', 'K3 ADC', 'K6 delineasi'].filter((_, i) => !done[i]);

  const doSubmit = async () => {
    const v = viewer.current;
    if (!att || !v?.ready || submitLock.current) return;
    if (missing.length && !confirmSubmit) {
      setConfirmSubmit(true);
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setError('');
    setConfirmSubmit(false);
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
      if (viewer.current !== v || !v.ready) return;
      stopTutor();
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
          content: 'Jawabanmu sudah dinilai. Kunci jawaban kini terbuka untuk tutor. Mau mulai dari mana? Coba tanyakan, misalnya, "Bagian mana yang terlewat?"',
        },
      ]);
      setTMode('penjelasan');
    } catch (e) {
      // 409: jawaban sudah tercatat (mis. klik ganda); muat ulang supaya status sinkron
      if (e instanceof ApiError && e.status === 409) setError('Jawaban kasus ini sudah tercatat. Buka Riwayat untuk melihat hasilnya.');
      else setError((e as Error).message);
      submitLock.current = false;
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
    if (!message || !att || tutorBusy) return;
    const image = attach && viewer.current?.ready ? viewer.current.capture() : null;
    const history = msgs.filter((m) => !m.failed).map((m) => ({ role: m.role, content: m.content }));
    const ctrl = new AbortController();
    tutorAbort.current?.abort();
    tutorAbort.current = ctrl;
    setMsgs((m) => [...m, { role: 'user', content: message, image: !!image }]);
    setInput('');
    setTutorBusy('menunggu');
    // jawaban ditulis bertahap: gelembung asisten muncul sejak kalimat pertama, lalu diganti hasil akhir
    let shown = false;
    const show = (content: string, meta?: TutorReply, failed?: boolean) => {
      if (ctrl.signal.aborted) return;
      setMsgs((m) => {
        const msg: Msg = { role: 'assistant', content, meta, failed };
        if (!shown) {
          shown = true;
          return [...m, msg];
        }
        return [...m.slice(0, -1), msg];
      });
    };
    try {
      const r = await api.tutorStream(
        { attempt_id: att.attempt_id, mode: tMode, message, image, history },
        (t) => {
          if (t && !ctrl.signal.aborted) {
            setTutorBusy('menulis');
            show(t);
          }
        },
        ctrl.signal,
      );
      show(r.reply, r);
    } catch (e) {
      if (ctrl.signal.aborted || (e as Error).name === 'AbortError') return;
      show(`Tutor gagal dihubungi: ${(e as Error).message}`, undefined, true);
    } finally {
      if (tutorAbort.current === ctrl) {
        tutorAbort.current = null;
        setTutorBusy('');
      }
    }
  };

  const valueText = () => {
    if (!probe || probe.value === null) return '—';
    if (activeName === 'ADC') return `ADC relatif ${id(probe.value / 100, 2)}`;
    return `nilai ${probe.value}`;
  };

  const v = att?.case.vignette;
  const canSubmit = !result && !submitting && !loading && ready;
  const toggleStep = (n: number) => setOpenStep((o) => (o === n ? null : n));

  return (
    <div className="app app-theme">
      <TopBar onHelp={tour.start}>
        {att && (
          <div className="flex min-w-0 items-center gap-2.5 text-[13px]" data-tour="case">
            <span className="shrink-0 font-mono text-[13px] font-semibold text-ink">{att.case.id}</span>
            <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide', TIER_TONE[att.tier] ?? 'bg-muted text-ink/60')}>{att.tier}</span>
            <span className="hidden shrink-0 whitespace-nowrap text-ink/55 md:inline">
              {v?.jenis_kelamin}, {v?.usia ?? '?'} th · NIHSS {v?.nihss ?? '?'}
            </span>
            <span className="hidden min-w-0 items-center gap-1.5 truncate rounded-md bg-info-soft px-2 py-1 text-[12.5px] font-medium text-info-ink sm:flex" title={att.reason}>
              <Target className="size-3.5 shrink-0" />
              <span className="truncate">Sasaran: {att.target_kc === 'bebas' ? 'pilihan sendiri' : `${att.target_kc} ${kcInfo[att.target_kc]?.nama ?? ''}`}</span>
            </span>
          </div>
        )}
      </TopBar>

      <main ref={wsRef} className={cn('lt-workspace', dragging && 'is-dragging')} style={{ '--panel-w': `${panelW}px` } as React.CSSProperties}>
        <Tour steps={LATIHAN_TOUR} open={tour.open} onClose={tour.close} />
        <aside className="toolbar legacy-dark" aria-label="Alat viewer" data-tour="tools">
          <ToolBtn
            on={mode === 'navigasi'}
            onClick={() => setMode('navigasi')}
            k="N"
            label="W/L"
            title="Navigasi: seret kiri = window/level, kanan = zoom, tengah = geser, roda = slice"
            disabled={!ready}
          />
          <ToolBtn on={mode === 'kuas'} onClick={() => setMode('kuas')} k="B" label="Kuas" disabled={!!result || !ready} title="Kuas anotasi lesi" />
          <ToolBtn on={mode === 'hapus'} onClick={() => setMode('hapus')} k="E" label="Hapus" disabled={!!result || !ready} title="Penghapus" />
          <ToolBtn on={mode === 'titik'} onClick={() => setMode('titik')} k="T" label="Titik" disabled={!!result || !ready} title="Klik satu titik di dalam lesi (soal K2)" />
          <label className="brush" title="Ukuran kuas (mm)">
            <span>{brush} mm</span>
            <input
              type="range"
              min={1}
              max={15}
              value={brush}
              onChange={(e) => {
                setBrush(+e.target.value);
                if (viewer.current?.ready) viewer.current.setBrushSize(+e.target.value);
              }}
              aria-label="Ukuran kuas"
            />
          </label>
          <button className="tool" onClick={undo} title="Urungkan (Ctrl+Z)" disabled={!!result || !ready}>
            Urung
          </button>
          <button className="tool" onClick={() => viewer.current?.resetView()} title="Atur ulang tampilan (R)" disabled={!ready}>
            Reset
          </button>
          <div className="sep" />
          {att?.series.map((s, i) => (
            <ToolBtn key={s.label} on={series === i} onClick={() => showSeries(i)} k={String(i + 1)} label={seqOrder ? seqOrder[s.label] : s.label} title={labelOf(i)} disabled={!ready} />
          ))}
        </aside>

        <section className="viewer-wrap legacy-dark lt-viewer" data-tour="viewer">
          <div className={`viewport mode-${mode}`} ref={elRef} onMouseMove={onMouseMove} onMouseLeave={() => setProbe(null)} onClick={onClick} onContextMenu={(e) => e.preventDefault()} />
          {att && !blocked && (
            <>
              <div className="vp-overlay tl">
                {labelOf(series)} · slice {slice + 1}/{att.case.dimensions[2]}
              </div>
              <div className={cn('vp-overlay bl', activeName === 'ADC' && probe?.value != null && 'lt-probe-adc')}>{valueText()}</div>
              <div className="vp-overlay tr">
                {mode === 'kuas' ? `Kuas ${brush} mm · ditandai ${id(markedMl, 1)} ml` : mode === 'hapus' ? `Penghapus ${brush} mm` : mode === 'titik' ? 'Klik di dalam lesi' : ''}
              </div>
              <div className="vp-overlay side-l">R</div>
              <div className="vp-overlay side-r">L</div>
            </>
          )}
          {markerPos && <div className="marker" style={{ left: markerPos[0], top: markerPos[1] }} />}
          {loading && (
            <div className="lt-state">
              <span className="lt-spinner" />
              {loading}
            </div>
          )}
          {!loading && (error || blocked) && !att?.attempt_id && (
            <div className="lt-state lt-state-card">
              <b>{blocked ? (params.get('kasus') ? 'Kasus sudah dikerjakan' : 'Latihan selesai') : 'Kasus belum bisa dimuat'}</b>
              <p>{blocked || error}</p>
              <div className="lt-state-actions">
                {blocked ? (
                  <>
                    <Link to="/riwayat" className="lt-btn primary">
                      Buka Riwayat
                    </Link>
                    <Link to="/kasus" className="lt-btn">
                      Bank kasus
                    </Link>
                  </>
                ) : (
                  <button className="lt-btn primary" onClick={retry}>
                    <RotateCcw className="size-4" /> Coba lagi
                  </button>
                )}
              </div>
            </div>
          )}
          {!loading && error && att && !ready && (
            <div className="lt-state lt-state-card">
              <b>Citra gagal dimuat</b>
              <p>{error}</p>
              <div className="lt-state-actions">
                <button className="lt-btn primary" onClick={retry}>
                  <RotateCcw className="size-4" /> Muat ulang kasus
                </button>
              </div>
            </div>
          )}
          <p className="disclaimer">Alat bantu belajar. Bukan untuk mendiagnosis pasien. Data: SOOP (OpenNeuro ds004889, CC0).</p>
        </section>

        <div
          className="lt-splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="Geser untuk mengatur lebar citra dan panel soal"
          aria-valuenow={panelW}
          aria-valuemin={320}
          aria-valuemax={820}
          tabIndex={0}
          title="Seret untuk mengatur lebar · klik dua kali untuk ukuran awal"
          onPointerDown={onSplitDown}
          onKeyDown={onSplitKey}
          onDoubleClick={resetPanelW}
          data-tour="splitter"
        >
          <span className="lt-grip" />
        </div>

        <aside className="lt-panel">
          {!result && att && (
            <div className="lt-steps" data-tour="steps">
              <header className="lt-steps-head">
                <div className="min-w-0">
                  <h2>Kerjakan kasus</h2>
                  <p className="lt-reason" title={att.reason}>
                    {att.reason}
                  </p>
                </div>
                <span className="lt-count">
                  <b>{nDone}</b>/4
                </span>
              </header>
              <div className="lt-progress" role="list" aria-label="Kemajuan langkah">
                {ACTIVE_KC.map((k, i) => (
                  <button key={k} role="listitem" className={cn(done[i] && 'done', openStep === i + 1 && 'open')} onClick={() => setOpenStep(i + 1)} title={`Langkah ${i + 1} · ${k}`}>
                    <i />
                    <span>{k}</span>
                  </button>
                ))}
              </div>

              <StepCard
                n={1}
                kc="K1"
                title="Kenali sekuens"
                open={openStep === 1}
                onToggle={() => toggleStep(1)}
                status={seqOrder ? (k1Ok ? 'ok' : 'bad') : k1Filled ? 'filled' : 'todo'}
                summary={seqOrder ? `${k1Ok ? 'Benar' : 'Belum tepat'} · label dibuka` : k1Filled ? 'Siap dikunci' : `${Object.keys(k1).length}/3 dipilih`}
              >
                <p className="lt-help">Buka tiap seri, perhatikan kontrasnya, lalu pilih nama sekuensnya. Jawaban dikunci sebelum label dibuka.</p>
                <div className="lt-seq">
                  {att.series.map((s, i) => {
                    const truth = seqOrder?.[s.label];
                    return (
                      <div key={s.label} className={cn('lt-seq-row', series === i && 'viewing')}>
                        <button className="lt-seq-view" onClick={() => showSeries(i)} disabled={!ready} title={`Tampilkan seri ${s.label} (${i + 1})`}>
                          <Eye className="size-3.5" />
                          <span>Seri {s.label}</span>
                          <kbd>{i + 1}</kbd>
                        </button>
                        <div className="lt-chips" role="radiogroup" aria-label={`Sekuens seri ${s.label}`}>
                          {SEQ_NAMES.map((n) => {
                            const picked = k1[s.label] === n;
                            const state = truth ? (n === truth ? (picked ? 'right' : 'key') : picked ? 'wrong' : '') : picked ? 'on' : '';
                            return (
                              <button key={n} role="radio" aria-checked={picked} className={cn('lt-chip', state)} disabled={!!seqOrder} onClick={() => pickSeq(s.label, n)}>
                                {state === 'right' && <Check className="size-3" />}
                                {state === 'wrong' && <X className="size-3" />}
                                {n}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!seqOrder ? (
                  <button className="lt-btn primary block" disabled={!k1Filled || revealing} onClick={doReveal}>
                    <Lock className="size-4" />
                    {revealing ? 'Mengunci…' : 'Kunci jawaban K1 & buka label'}
                  </button>
                ) : (
                  <p className={cn('lt-verdict', k1Ok ? 'ok' : 'bad')}>
                    {k1Ok ? <Check className="size-4" /> : <X className="size-4" />}
                    {k1Ok ? 'Benar. Label seri sudah dibuka.' : 'Belum tepat. Garis hijau menunjukkan kuncinya; label seri sudah dibuka.'}
                  </p>
                )}
              </StepCard>

              <StepCard
                n={2}
                kc="K2"
                title="Temukan lesi"
                open={openStep === 2}
                onToggle={() => toggleStep(2)}
                status={k2Filled ? 'filled' : point || hemi ? 'partial' : 'todo'}
                summary={point || hemi ? `${point ? `titik slice ${point[2] + 1}` : 'titik belum'} · ${hemi || 'hemisfer belum'}` : 'Belum dijawab'}
              >
                <p className="lt-help">Klik satu titik di dalam lesi akut, lalu tentukan hemisfernya.</p>
                <div className="lt-point">
                  <button className={cn('lt-btn', mode === 'titik' && 'active')} onClick={() => setMode('titik')} disabled={!ready}>
                    <Crosshair className="size-4" /> {mode === 'titik' ? 'Klik di citra…' : 'Pilih titik'} <kbd>T</kbd>
                  </button>
                  <span className={cn('lt-pill', point ? 'set' : '')}>{point ? `slice ${point[2] + 1}` : 'belum ada titik'}</span>
                  {point && (
                    <button className="lt-link" onClick={() => viewer.current?.jumpToVoxel(point)}>
                      lihat
                    </button>
                  )}
                </div>
                <div className="lt-options three" role="radiogroup" aria-label="Hemisfer lesi">
                  {HEMIS.map((h) => (
                    <button
                      key={h.v}
                      role="radio"
                      aria-checked={hemi === h.v}
                      className={cn('lt-option', hemi === h.v && 'on')}
                      onClick={() => {
                        setHemi(h.v);
                        if (point) setOpenStep(3);
                      }}
                    >
                      <b>{h.v}</b>
                      <small>{h.hint}</small>
                    </button>
                  ))}
                </div>
              </StepCard>

              <StepCard
                n={3}
                kc="K3"
                title="Restriksi sejati?"
                open={openStep === 3}
                onToggle={() => toggleStep(3)}
                status={k3Filled ? 'filled' : adcBin || restr !== null ? 'partial' : 'todo'}
                summary={adcBin || restr !== null ? `ADC ${adcBin || '?'} · ${restr === null ? '?' : restr ? 'restriksi sejati' : 'T2 shine-through'}` : 'Belum dijawab'}
              >
                <p className="lt-help">Arahkan kursor ke lesi pada seri ADC. Nilai ADC relatif (dibanding median otak) tampil di bawah dan di kiri bawah citra. Yang dinilai adalah nilai khas seluruh lesi, jadi cek beberapa titik di dalam lesi.</p>
                <div className={cn('lt-readout', activeName === 'ADC' && probe?.value != null && 'live')}>
                  {activeName === 'ADC' ? (
                    <>
                      <span>ADC relatif di kursor</span>
                      <b>{probe?.value != null ? id(probe.value / 100, 2) : '—'}</b>
                    </>
                  ) : (
                    <>
                      <span>{seqOrder ? 'Seri yang tampil bukan ADC' : 'Kunci K1 dulu untuk tahu seri ADC'}</span>
                      {adcIndex >= 0 && (
                        <button className="lt-btn small" onClick={() => showSeries(adcIndex)}>
                          Buka ADC <kbd>{adcIndex + 1}</kbd>
                        </button>
                      )}
                    </>
                  )}
                </div>
                <div className="lt-scale" role="radiogroup" aria-label="Rentang ADC relatif lesi">
                  {adcBins.map((b) => (
                    <button key={b} role="radio" aria-checked={adcBin === b} className={cn(adcBin === b && 'on')} onClick={() => setAdcBin(b)}>
                      {b}
                    </button>
                  ))}
                </div>
                <div className="lt-options two" role="radiogroup" aria-label="Restriksi difusi">
                  {[
                    { v: true, label: 'restriksi sejati' },
                    { v: false, label: 'T2 shine-through' },
                  ].map((o) => (
                    <button
                      key={o.label}
                      role="radio"
                      aria-checked={restr === o.v}
                      className={cn('lt-option', restr === o.v && 'on')}
                      onClick={() => {
                        setRestr(o.v);
                        if (adcBin) setOpenStep(4);
                      }}
                    >
                      <b>{o.label}</b>
                    </button>
                  ))}
                </div>
              </StepCard>

              <StepCard
                n={4}
                kc="K6"
                title="Delineasi seluruh lesi"
                open={openStep === 4}
                onToggle={() => toggleStep(4)}
                status={k6Filled ? 'filled' : 'todo'}
                summary={k6Filled ? `${id(markedMl, 2)} ml ditandai` : 'Belum ada tanda'}
              >
                <p className="lt-help">Tandai semua fokus lesi di setiap slice. Gulir untuk berpindah slice; lesi bisa lebih dari satu fokus.</p>
                <div className="lt-volume">
                  <span>Ditandai</span>
                  <b>
                    {id(markedMl, 2)} <small>ml</small>
                  </b>
                </div>
                <div className="lt-tools">
                  <button className={cn('lt-btn', mode === 'kuas' && 'active')} onClick={() => setMode('kuas')} disabled={!ready}>
                    <Brush className="size-4" /> Kuas <kbd>B</kbd>
                  </button>
                  <button className={cn('lt-btn', mode === 'hapus' && 'active')} onClick={() => setMode('hapus')} disabled={!ready}>
                    <Eraser className="size-4" /> Hapus <kbd>E</kbd>
                  </button>
                  <button className="lt-btn" onClick={undo} disabled={!ready}>
                    <Undo2 className="size-4" /> Urung
                  </button>
                </div>
              </StepCard>

              <footer className="lt-submit" data-tour="submit">
                {confirmSubmit && missing.length > 0 && (
                  <div className="lt-confirm" role="alert">
                    <b>Belum dijawab: {missing.join(', ')}.</b> Langkah yang kosong dihitung salah.
                    <div>
                      <button className="lt-link" onClick={() => setConfirmSubmit(false)}>
                        Kembali mengerjakan
                      </button>
                    </div>
                  </div>
                )}
                {error && ready && <p className="lt-error">{error}</p>}
                <button className="lt-btn primary block lg" disabled={!canSubmit} onClick={doSubmit}>
                  {submitting ? 'Menilai…' : confirmSubmit && missing.length ? 'Kirim tetap' : 'Kirim jawaban'}
                </button>
                <button className="lt-link block" disabled={!!loading || submitting} onClick={nextCase} title="Tinggalkan kasus ini tanpa dinilai">
                  Lewati kasus ini
                </button>
              </footer>
            </div>
          )}

          {result && <ResultCard result={result} kcInfo={kcInfo} overlay={overlay} onToggle={toggleOverlay} onJump={(p) => viewer.current?.jumpToVoxel(p)} reduce={!!reduce} />}
          {result && att && (
            <div className="lt-next">
              <button className="lt-btn primary block lg" onClick={nextCase} disabled={!!loading}>
                {loading ? 'Memilih kasus…' : targetKc ? `Kasus ${targetKc} berikutnya` : 'Kasus berikutnya (adaptif)'}
              </button>
              <div className="lt-next-links">
                <Link to={`/riwayat/${att.attempt_id}`} className="lt-btn small">
                  Tinjau di riwayat
                </Link>
                <Link to="/beranda" className="lt-btn small">
                  Ke beranda
                </Link>
              </div>
            </div>
          )}

          {/* tanpa kasus aktif (semua sudah dikerjakan / galat muat) BKT dan tutor tidak punya konteks */}
          {att && (
            <>
              <div className="card">
                <h2>Penguasaan kompetensi (BKT)</h2>
                <MasteryBars kc={kcInfo} before={result?.mastery_before ?? att?.mastery} after={result?.mastery_after} />
              </div>

              <div className="card tutor lt-tutor">
                <div className="tutor-head">
                  <h2>Tutor</h2>
                  <div className="lt-seg" role="tablist" aria-label="Mode tutor">
                    {(['sokratik', 'penjelasan', 'rujukan'] as const).map((m) => (
                      <button key={m} role="tab" aria-selected={tMode === m} className={tMode === m ? 'on' : ''} onClick={() => setTMode(m)}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="small muted">
                  {result ? 'Tutor menerima temuan terstruktur dan hasil penilaianmu.' : 'Kunci jawaban terkunci sampai jawaban dikirim; tutor hanya membimbing cara membaca.'}
                </p>
                <div className="msgs lt-msgs" ref={msgsRef} aria-live="polite">
                  {msgs.length === 0 && !tutorBusy && <p className="lt-empty-chat">Belum ada percakapan. Pilih salah satu pertanyaan di bawah atau tulis sendiri.</p>}
                  {msgs.map((m, i) => (
                    <div key={i} className={cn('msg', m.role, m.failed && 'failed')}>
                      {m.image && <span className="att">slice terlampir</span>}
                      {m.role === 'assistant' ? <Markdown text={m.content} /> : <p>{m.content}</p>}
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
                  {tutorBusy === 'menunggu' && (
                    <div className="msg assistant typing">
                      <span className="lt-dots">
                        <i />
                        <i />
                        <i />
                      </span>
                      tutor sedang berpikir
                    </div>
                  )}
                </div>
                <div className="lt-hints">
                  {(result ? tutorHintsAfter(result) : TUTOR_HINTS_BEFORE).map((h) => (
                    <button key={h} className="lt-hint" disabled={!!tutorBusy || !att} onClick={() => sendTutor(h)}>
                      {h}
                    </button>
                  ))}
                </div>
                <form
                  className="ask"
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendTutor();
                  }}
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={tutorBusy ? 'Tunggu jawaban tutor selesai…' : 'Tanya tentang slice ini…'}
                    aria-label="Pesan untuk tutor"
                    maxLength={1500}
                  />
                  {tutorBusy ? (
                    <button type="button" className="lt-btn" onClick={stopTutor} title="Hentikan jawaban">
                      <Square className="size-3.5" /> Stop
                    </button>
                  ) : (
                    <button className="lt-btn primary" disabled={!input.trim() || !att}>
                      <Send className="size-3.5" /> Kirim
                    </button>
                  )}
                </form>
                <label className="small attach">
                  <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} /> Capture: lampirkan slice yang sedang tampil
                </label>
              </div>
            </>
          )}
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

type StepStatus = 'todo' | 'partial' | 'filled' | 'ok' | 'bad';

function StepCard(p: { n: number; kc: string; title: string; open: boolean; onToggle: () => void; status: StepStatus; summary: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  const icon = p.status === 'ok' || p.status === 'filled' ? <Check className="size-3.5" /> : p.status === 'bad' ? <X className="size-3.5" /> : p.n;
  return (
    <section className={cn('lt-step', `is-${p.status}`, p.open && 'is-open')}>
      <button className="lt-step-head" onClick={p.onToggle} aria-expanded={p.open}>
        <span className="lt-num">{icon}</span>
        <span className="lt-step-title">
          <b>{p.title}</b>
          {!p.open && <small>{p.summary}</small>}
        </span>
        <span className="lt-kc">{p.kc}</span>
        <ChevronDown className="lt-chev size-4" />
      </button>
      <AnimatePresence initial={false}>
        {p.open && (
          <motion.div
            className="lt-step-body"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="lt-step-inner">{p.children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ResultCard(p: {
  result: SubmitResult;
  kcInfo: Record<string, KCInfo>;
  overlay: { jawaban: boolean; kunci: boolean; model: boolean };
  onToggle: (k: 'jawaban' | 'kunci' | 'model') => void;
  onJump: (p: [number, number, number]) => void;
  reduce: boolean;
}) {
  const { result, kcInfo } = p;
  const d = result.delineasi;
  const nFocus = d?.fokus.length ?? 0;
  const hit = d?.fokus.filter((f) => f.tersentuh).length ?? 0;
  const nOk = ACTIVE_KC.filter((k) => result.kc[k]?.benar).length;
  const dice = d?.dice ?? 0;
  const R = 34;
  const C = 2 * Math.PI * R;
  const tone = dice >= 0.8 ? 'good' : dice >= 0.6 ? 'mid' : 'low';
  const item = (i: number) =>
    p.reduce
      ? {}
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: {
            delay: 0.05 * i,
            duration: 0.25,
            ease: [0.23, 1, 0.32, 1] as const,
          },
        };

  const detail = (k: string, r: KcResult): string => {
    if (r.kosong) return 'tidak dijawab';
    if (k === 'K1') return r.benar ? 'urutan seri tepat' : 'urutan seri keliru';
    if (k === 'K2') return r.benar ? 'titik & hemisfer tepat' : `kunci ${String(r.kunci_hemisfer ?? '?')}${r.titik_di_lesi === false ? ', titik di luar lesi' : ''}`;
    if (k === 'K3') return `ADC relatif lesi ${String(r.adc_relatif_lesi ?? '?').replace('.', ',')}`;
    if (k === 'K6') return d ? `Dice ${id(d.dice, 2)} · ${hit}/${nFocus} fokus` : 'tidak ada delineasi';
    return '';
  };

  return (
    <div className="lt-result">
      <div className="lt-result-head">
        {d ? (
          <svg className={cn('lt-ring', tone)} viewBox="0 0 84 84" aria-label={`Dice ${id(dice, 2)}`}>
            <circle cx="42" cy="42" r={R} className="track" />
            <motion.circle
              cx="42"
              cy="42"
              r={R}
              className="val"
              strokeDasharray={C}
              initial={{ strokeDashoffset: p.reduce ? C * (1 - dice) : C }}
              animate={{ strokeDashoffset: C * (1 - dice) }}
              transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
            />
            <text x="42" y="40" textAnchor="middle" className="num">
              {id(dice, 2)}
            </text>
            <text x="42" y="55" textAnchor="middle" className="cap">
              Dice
            </text>
          </svg>
        ) : (
          <span className="lt-ring-empty">—</span>
        )}
        <div className="min-w-0">
          <span className="lt-eyebrow">Hasil penilaian otomatis</span>
          <h2>{d ? d.jenis_kesalahan_label : 'Delineasi tidak dikirim'}</h2>
          <p>
            <b>{nOk}</b> dari 4 kompetensi benar
            {d && (
              <>
                {' · '}
                {hit} dari {nFocus} fokus ditemukan
              </>
            )}
          </p>
        </div>
      </div>

      <div className="lt-kc-grid">
        {ACTIVE_KC.map((k, i) => {
          const r = result.kc[k];
          if (!r) return null;
          return (
            <motion.div key={k} className={cn('lt-kc-tile', r.benar ? 'ok' : r.kosong ? 'empty' : 'bad')} {...item(i)}>
              <span className="lt-kc-code">
                {r.benar ? <Check className="size-3.5" /> : <X className="size-3.5" />} {k}
              </span>
              <b>{kcInfo[k]?.nama ?? k}</b>
              <small>{detail(k, r)}</small>
            </motion.div>
          );
        })}
      </div>

      {d && (
        <div className="lt-metrics">
          <Metric label="Lesi ditemukan" value={`${hit}/${nFocus}`} good={hit === nFocus} />
          <Metric label="Galat volume" value={`${d.vol_err > 0 ? '+' : ''}${Math.round(d.vol_err * 100)}%`} good={Math.abs(d.vol_err) <= 0.25} />
          <Metric label="HD95" value={d.hd95 === null ? '—' : `${id(d.hd95, 1)} mm`} good={(d.hd95 ?? 99) <= 5} />
        </div>
      )}

      {d && d.fokus.some((f) => !f.tersentuh) && (
        <div className="lt-missed">
          <h3>Fokus yang terlewat</h3>
          <p className="lt-help">Klik untuk melompat ke slice fokus tersebut.</p>
          <div className="lt-missed-list">
            {d.fokus
              .filter((f) => !f.tersentuh)
              .slice(0, 8)
              .map((f, i) => (
                <button key={i} className="lt-missed-chip" onClick={() => p.onJump([Math.round(f.pusat_voxel[0]), Math.round(f.pusat_voxel[1]), f.slice_terbesar - 1])}>
                  <Crosshair className="size-3.5" />
                  {id(f.ml, 2)} ml · slice {f.slice_terbesar}
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="lt-overlays">
        {(
          [
            ['jawaban', 'Jawaban saya', 'orange', true],
            ['kunci', 'Kunci jawaban (mask ahli)', 'green', true],
            ['model', 'Pembaca kedua (U-Net)', 'blue', !!result.model],
          ] as const
        ).map(([k, label, sw, enabled]) => (
          <button key={k} className={cn('lt-toggle', p.overlay[k] && 'on')} disabled={!enabled} onClick={() => p.onToggle(k)} role="switch" aria-checked={p.overlay[k]}>
            <i className={`sw ${sw}`} />
            <span>{label}</span>
            <span className="lt-switch" />
          </button>
        ))}
      </div>
      {result.model && (
        <p className="lt-help">
          Model: Dice {id(result.model.dice_terhadap_kunci, 2)} terhadap kunci, {id(result.model.volume_ml, 1)} ml.
          {result.model.keyakinan_rendah && ' Keyakinan rendah (lesi < 5 ml).'} Penilaianmu selalu memakai mask ahli, bukan model.
        </p>
      )}
      <details className="lt-details">
        <summary>Temuan terstruktur &amp; luaran klinis</summary>
        <p>
          {result.findings.jumlah_fokus} fokus, {id(result.findings.volume_ml, 2)} ml ({result.findings.kategori_volume}), hemisfer {result.findings.hemisfer}, slice terbesar{' '}
          {result.findings.slice_lesi_terbesar}. Indeks kesulitan D = {result.findings.indeks_kesulitan_D}.
        </p>
        <p>
          Rankin saat pulang: {result.luaran.rankin_pulang ?? 'tidak tercatat'}. Etiologi: {result.luaran.etiologi ?? 'tidak tercatat'}.
        </p>
      </details>
    </div>
  );
}

function Metric(p: { label: string; value: string; good: boolean }) {
  return (
    <div className={`lt-metric ${p.good ? 'good' : 'bad'}`}>
      <span>{p.label}</span>
      <b>{p.value}</b>
    </div>
  );
}
