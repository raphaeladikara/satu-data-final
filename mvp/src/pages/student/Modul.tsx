import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, useScroll, useSpring } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpenText, Box, Check, CheckCircle2, ChevronRight, Clock, FlaskConical, Lightbulb, ListChecks, MonitorPlay, RotateCcw, Target, XCircle } from 'lucide-react';
import { api, fmt, type TeachingCase } from '../../api';
import { AppShell } from '@/components/AppShell';
import { Tour, useTour, type TourStep } from '@/components/Tour';
import { buttonClass } from '@/components/ui/button';
import { BRAIN3D_CASES } from '@/lib/brain3d';
import { cn } from '@/lib/utils';
import { LESSONS, PASS, lessonById, type Quiz } from '../../content/lessons';
import { useProgress } from './useProgress';
import type { Series3D } from '@/components/three/MriHologram';

const Lab3D = lazy(() => import('@/components/three/Lab3D'));
const ReadViewer = lazy(() => import('../../components/ReadViewer'));

const slug = (i: number) => `bagian-${i + 1}`;

export function Modul() {
  const { id = '' } = useParams();
  const lesson = lessonById(id);
  const { p, reload } = useProgress();
  const idx = LESSONS.findIndex((l) => l.id === id);
  const prev = LESSONS[idx - 1];
  const next = LESSONS[idx + 1];
  const hasLab = !!lesson?.contoh;

  const steps = useMemo<TourStep[]>(
    () => [
      { title: 'Cara memakai modul', body: 'Baca materinya, coba kasus di lab 3D, lalu kerjakan kuis. Ikuti panduan singkat ini sekali saja.' },
      { target: 'toc', title: 'Daftar isi', body: 'Lompat ke bagian mana pun. Bagian yang sedang kamu baca ditandai, dan bilah di atas menunjukkan seberapa jauh kamu membaca.' },
      { target: 'goals', title: 'Tujuan modul', body: 'Tiga hal yang harus bisa kamu lakukan setelah modul ini. Kuis di akhir menguji tujuan ini.' },
      ...(hasLab
        ? [
            { target: 'lab', title: 'Lab 3D dari MRI asli', body: 'Tumpukan slice MRI pasien sungguhan. Kiri adalah hologram 3D, kanan slice 2D yang sedang disorot.', padding: 6 },
            { target: 'lab-series', title: 'Ganti sekuens', body: 'Bandingkan DWI, ADC, dan FLAIR pada lokasi yang sama. Arahkan kursor ke tombol untuk melihat artinya.' },
            { target: 'lab-explode', title: 'Pisahkan slice', body: 'Geser untuk merenggangkan tumpukan, supaya bentuk lesi di tiap slice terlihat.' },
            { target: 'lab-key', title: 'Cari dulu, baru intip kunci', body: 'Coba temukan lesinya sendiri. Kalau sudah yakin, klik tombol ini untuk menyalakan kunci lesi dari mask ahli.', waitForClick: true },
            { target: 'lab-slice', title: 'Sebaran lesi per slice', body: 'Batang terracotta menunjukkan slice mana yang berisi lesi. Klik satu batang untuk melompat ke slice itu di 3D dan 2D.' },
          ]
        : []),
      { target: 'quiz', title: 'Kuis cepat', body: `Jawab semua soal lalu periksa. Lulus bila minimal ${Math.ceil(PASS * (lesson?.kuis.length ?? 3))} benar, dan modul ditandai selesai.` },
      { target: 'help', title: 'Selesai!', body: 'Tekan Panduan kapan saja untuk memutar ulang panduan ini.' },
    ],
    [hasLab, lesson],
  );
  const tour = useTour('modul', { when: !!lesson });

  useEffect(() => {
    window.scrollTo(0, 0);
    if (lesson) api.saveLesson(lesson.id, {}).catch(() => undefined);
  }, [lesson]);

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });
  const active = useScrollSpy(lesson ? [...lesson.bagian.map((_, i) => slug(i)), ...(hasLab ? ['lab'] : []), 'kuis'] : []);

  if (!lesson)
    return (
      <AppShell>
        <h1 className="font-serif text-4xl">Modul tidak ditemukan</h1>
        <Link to="/belajar" className="mt-4 inline-block text-teal underline">
          Kembali ke daftar modul
        </Link>
      </AppShell>
    );
  const st = p?.[lesson.id];
  const kc = lesson.kc ?? (lesson.id === 'orientasi' ? 'Dasar' : 'Pengantar');
  const toc = [...lesson.bagian.map((b, i) => [slug(i), b.judul] as const), ...(hasLab ? [['lab', 'Lab 3D: contoh kasus'] as const] : []), ['kuis', 'Kuis cepat'] as const];

  return (
    <AppShell onHelp={tour.start} wide>
      <motion.div className="fixed inset-x-0 top-0 z-50 h-1 origin-left bg-gradient-to-r from-teal via-sage to-leaf" style={{ scaleX: progress }} aria-hidden="true" />

      <nav className="flex items-center gap-1.5 text-[13px] text-ink/55">
        <Link to="/belajar" className="hover:text-ink">
          Modul belajar
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-ink/80">{kc}</span>
      </nav>

      <header className="mt-5 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-teal px-3 py-1 font-mono text-[11px] font-semibold text-mint">{kc}</span>
            <span className="flex items-center gap-1 rounded-full border border-ink/10 px-3 py-1 text-[12px] text-ink/60">
              <Clock className="size-3.5" /> {lesson.menit} menit
            </span>
            {st?.completed && (
              <span className="flex items-center gap-1 rounded-full bg-leaf/50 px-3 py-1 text-[12px] font-medium text-teal-900">
                <Check className="size-3.5" /> Selesai · kuis {fmt.pct(st.best_score)}
              </span>
            )}
            {!lesson.dinilai && lesson.kc && <span className="rounded-full bg-sand-2 px-3 py-1 text-[12px] text-ink/60">belum dinilai di MVP</span>}
          </div>
          <h1 className="mt-4 max-w-4xl font-serif text-[clamp(2.3rem,4.4vw,3.9rem)] leading-[1.03] tracking-[-0.015em]">{lesson.judul}</h1>
          <p className="mt-3 max-w-2xl text-[16px] text-ink/60">{lesson.ringkas}</p>
        </div>
        <div className="flex gap-2">
          {(
            [
              [BookOpenText, 'Materi', true],
              [FlaskConical, 'Lab 3D', hasLab],
              [ListChecks, 'Kuis', true],
            ] as const
          ).map(([Icon, l, on]) =>
            on ? (
              <span key={l} className="flex items-center gap-2 rounded-2xl border border-ink/8 bg-paper px-3.5 py-2.5 text-[13px] text-ink/70">
                <Icon className="size-4 text-teal" /> {l}
              </span>
            ) : null,
          )}
        </div>
      </header>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav data-tour="toc" className="sticky top-28 rounded-[1.4rem] border border-ink/8 bg-paper p-3" aria-label="Daftar isi">
            <p className="px-2 pb-2 pt-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/45">Daftar isi</p>
            <ol className="space-y-0.5">
              {toc.map(([h, t], i) => (
                <li key={h}>
                  <a href={`#${h}`} className={cn('flex gap-2.5 rounded-xl px-2 py-2 text-[13px] leading-snug transition-colors', active === h ? 'bg-mint font-medium text-teal-900' : 'text-ink/60 hover:bg-ink/4 hover:text-ink')}>
                    <span className={cn('mt-px font-mono text-[10.5px]', active === h ? 'text-teal' : 'text-ink/35')}>{String(i + 1).padStart(2, '0')}</span>
                    {t}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="min-w-0 max-w-[860px]">
          <section data-tour="goals" className="rounded-[1.6rem] bg-mint p-6">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-teal-900">
              <Target className="size-4" /> Setelah modul ini kamu bisa
            </h2>
            <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
              {lesson.tujuan.map((t, i) => (
                <li key={t} className="rounded-2xl bg-paper/80 p-4 text-[14px] leading-snug text-ink/80">
                  <span className="mb-2 grid size-7 place-items-center rounded-full bg-teal font-mono text-[11px] text-mint">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ul>
          </section>

          {lesson.bagian.map((b, i) => (
            <section key={b.judul} id={slug(i)} className="scroll-mt-28 pt-12">
              <p className="font-mono text-[11px] text-teal">BAGIAN {String(i + 1).padStart(2, '0')}</p>
              <h2 className="mt-1.5 font-serif text-[2rem] leading-tight tracking-[-0.01em]">{b.judul}</h2>
              <div className="mt-4 space-y-4 text-[16.5px] leading-[1.75] text-ink/80">
                {b.isi.map((x, k) => (
                  <p key={k}>{x}</p>
                ))}
              </div>
              {b.poin && (
                <ul className="mt-5 space-y-2.5">
                  {b.poin.map((x) => (
                    <li key={x} className="flex gap-3 rounded-2xl border border-ink/6 bg-paper px-4 py-3 text-[15px] leading-relaxed text-ink/80">
                      <span className="mt-2 size-2 shrink-0 rounded-full bg-sage" />
                      {x}
                    </li>
                  ))}
                </ul>
              )}
              {b.tips && (
                <p className="mt-5 flex gap-3 rounded-2xl border-l-4 border-terra bg-terra-soft/50 px-5 py-4 text-[15px] leading-relaxed text-ink/85">
                  <Lightbulb className="mt-0.5 size-5 shrink-0 text-terra" />
                  {b.tips}
                </p>
              )}
            </section>
          ))}

          {lesson.contoh && <LabSection caseId={lesson.contoh.case_id} note={lesson.contoh.catatan} seri={lesson.contoh.seri} />}

          <QuizBlock lessonId={lesson.id} items={lesson.kuis} onSaved={reload} />

          <section className="mt-12 flex flex-col gap-5 overflow-hidden rounded-[1.8rem] bg-[linear-gradient(120deg,#195764,#2d746f_55%,#80a874)] p-7 text-mint sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="font-mono text-[11px] uppercase tracking-wider text-leaf">Langkah berikutnya</p>
              <b className="mt-2 block font-serif text-[1.8rem] font-normal leading-tight">{lesson.kc && lesson.dinilai ? `Latih ${lesson.kc} dengan kasus nyata` : 'Siap mencoba latihan adaptif?'}</b>
              <p className="mt-1.5 text-[14px] text-mint/75">{lesson.kc && lesson.dinilai ? 'Sistem memilih kasus dengan tingkat kesulitan sesuai penguasaanmu saat ini.' : 'Latihan adaptif memilih kompetensi terlemahmu secara otomatis.'}</p>
            </div>
            <Link to={lesson.kc && lesson.dinilai ? `/latihan?kc=${lesson.kc}` : '/latihan'} className={buttonClass('light', 'lg')}>
              {lesson.kc && lesson.dinilai ? `Latihan terarah ${lesson.kc}` : 'Mulai latihan adaptif'} <ArrowRight className="size-4" />
            </Link>
          </section>

          <nav className="mt-6 grid gap-3 sm:grid-cols-2">
            {prev ? (
              <Link to={`/belajar/${prev.id}`} className="group rounded-[1.4rem] border border-ink/8 bg-paper p-5 transition-colors hover:border-ink/20">
                <span className="flex items-center gap-1.5 text-[12px] text-ink/50">
                  <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" /> Sebelumnya
                </span>
                <b className="mt-1 block text-[15px] font-medium">{prev.judul}</b>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link to={`/belajar/${next.id}`} className="group rounded-[1.4rem] border border-ink/8 bg-paper p-5 text-right transition-colors hover:border-ink/20">
                <span className="flex items-center justify-end gap-1.5 text-[12px] text-ink/50">
                  Berikutnya <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
                <b className="mt-1 block text-[15px] font-medium">{next.judul}</b>
              </Link>
            )}
          </nav>
        </article>
      </div>

      <Tour steps={steps} open={tour.open} onClose={tour.close} />
    </AppShell>
  );
}

function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? '');
  const key = ids.join('|');
  useEffect(() => {
    const els = ids.map((i) => document.getElementById(i)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver(
      (en) => {
        const vis = en.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: '-20% 0px -65% 0px' },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return active;
}

function LabSection({ caseId, note, seri }: { caseId: string; note: string; seri?: string }) {
  const [tab, setTab] = useState<'3d' | 'klinis'>(BRAIN3D_CASES.includes(caseId as (typeof BRAIN3D_CASES)[number]) ? '3d' : 'klinis');
  const [tc, setTc] = useState<TeachingCase | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api.teaching(caseId).then(setTc).catch((e) => setErr(e.message));
  }, [caseId]);
  const jump = useMemo(() => {
    const c = tc?.findings.fokus[0]?.pusat_voxel;
    return c ? (c.map(Math.round) as [number, number, number]) : null;
  }, [tc]);
  const s3 = (['DWI', 'ADC', 'FLAIR'].includes(seri ?? '') ? seri : 'DWI') as Series3D;

  return (
    <section id="lab" data-tour="lab" className="mt-14 scroll-mt-28 rounded-[2rem] border border-ink/8 bg-paper p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-3 px-2 pb-4 pt-2">
        <span className="grid size-10 place-items-center rounded-2xl bg-teal text-mint">
          <FlaskConical className="size-5" />
        </span>
        <div className="mr-auto">
          <h2 className="text-[18px] font-semibold tracking-tight">Lab 3D: contoh kasus interaktif</h2>
          <p className="text-[12.5px] text-ink/55">SOOP {caseId}{tc ? ` · ${tc.judul}` : ''} · tidak dipakai di latihan bernilai</p>
        </div>
        <div className="flex gap-1 rounded-full bg-ink/5 p-1" role="tablist">
          {(
            [
              ['3d', 'Hologram 3D', Box],
              ['klinis', 'Viewer klinis', MonitorPlay],
            ] as const
          ).map(([k, l, Icon]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors', tab === k ? 'bg-teal text-mint' : 'text-ink/60 hover:text-ink')}>
              <Icon className="size-3.5" /> {l}
            </button>
          ))}
        </div>
      </div>
      <p className="mx-2 mb-4 flex gap-2.5 rounded-2xl bg-mint px-4 py-3 text-[14px] leading-relaxed text-ink/80">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-teal" /> {note}
      </p>
      <Suspense fallback={<div className="h-[500px] animate-pulse rounded-[1.6rem] bg-ink/5" />}>
        {tab === '3d' ? (
          <Lab3D caseId={caseId} initialSeries={s3} />
        ) : err ? (
          <p className="p-6 text-terra">{err}</p>
        ) : !tc ? (
          <div className="h-[420px] animate-pulse rounded-[1.6rem] bg-ink/5" />
        ) : (
          <div className="legacy overflow-hidden rounded-[1.6rem] bg-[#0b1220] p-3 text-[#e6ecf5]">
            <ReadViewer geom={tc.case} series={tc.series} masks={{ kunci: tc.gt_rle }} initialVisible={{ kunci: false }} initialSeries={Math.max(0, tc.series.findIndex((s) => s.label === seri))} jumpTo={jump} height={420} />
          </div>
        )}
      </Suspense>
      {tc && (
        <div className="mt-3 grid grid-cols-2 gap-2 px-1 pb-1 sm:grid-cols-4">
          {[
            ['Fokus lesi', String(tc.findings.jumlah_fokus)],
            ['Volume', `${fmt.num(tc.findings.volume_ml, 1)} ml`],
            ['Hemisfer', String(tc.findings.hemisfer)],
            ['ADC relatif', `${fmt.num(tc.findings.adc_relatif_lesi)} · ${tc.findings.restriksi_sejati ? 'restriksi sejati' : 'bukan restriksi'}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-muslin px-4 py-3">
              <p className="text-[11px] text-ink/50">{k}</p>
              <p className="mt-0.5 text-[14px] font-medium">{v}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function QuizBlock({ lessonId, items, onSaved }: { lessonId: string; items: Quiz[]; onSaved: () => void }) {
  const [ans, setAns] = useState<(number | null)[]>(() => items.map(() => null));
  const [checked, setChecked] = useState(false);
  const score = ans.filter((a, i) => a === items[i].benar).length / items.length;
  const need = Math.ceil(PASS * items.length);

  useEffect(() => {
    setAns(items.map(() => null));
    setChecked(false);
  }, [lessonId, items]);

  const check = async () => {
    setChecked(true);
    try {
      await api.saveLesson(lessonId, { quiz_score: score, completed: score >= PASS });
      onSaved();
    } catch {
      /* progres gagal disimpan; kuis tetap bisa dibaca */
    }
  };
  const answered = ans.filter((a) => a !== null).length;
  const pass = score >= PASS;

  return (
    <section id="kuis" data-tour="quiz" className="mt-14 scroll-mt-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] text-teal">KUIS CEPAT</p>
          <h2 className="mt-1.5 font-serif text-[2rem] leading-tight">Uji pemahamanmu</h2>
        </div>
        <span className="rounded-full border border-ink/10 px-3 py-1 text-[12.5px] text-ink/60">
          {items.length} soal · lulus bila ≥ {need} benar
        </span>
      </div>
      <ol className="mt-6 space-y-4">
        {items.map((q, i) => (
          <li key={i} className="rounded-[1.6rem] border border-ink/8 bg-paper p-5 sm:p-6">
            <p className="flex gap-3 text-[16px] font-medium leading-snug">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink/6 font-mono text-[12px]">{i + 1}</span>
              {q.tanya}
            </p>
            <div className="mt-4 grid gap-2" role="radiogroup">
              {q.opsi.map((o, j) => {
                const sel = ans[i] === j;
                const right = checked && j === q.benar;
                const wrong = checked && sel && j !== q.benar;
                return (
                  <button
                    key={j}
                    role="radio"
                    aria-checked={sel}
                    disabled={checked}
                    onClick={() => setAns(ans.map((a, k) => (k === i ? j : a)))}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[14.5px] transition-all',
                      right ? 'border-sage bg-leaf/35 text-teal-900' : wrong ? 'border-terra bg-terra-soft/60' : sel ? 'border-teal bg-mint shadow-[0_0_0_3px_rgba(25,87,100,.12)]' : 'border-ink/10 hover:border-ink/25 hover:bg-muslin',
                      checked && !right && !wrong && 'opacity-55',
                    )}
                  >
                    <span className={cn('grid size-7 shrink-0 place-items-center rounded-full border font-mono text-[12px]', right ? 'border-sage bg-sage text-white' : wrong ? 'border-terra bg-terra text-white' : sel ? 'border-teal bg-teal text-mint' : 'border-ink/15 text-ink/55')}>
                      {right ? <Check className="size-3.5" /> : wrong ? <XCircle className="size-3.5" /> : String.fromCharCode(65 + j)}
                    </span>
                    {o}
                  </button>
                );
              })}
            </div>
            {checked && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={cn('mt-3 flex gap-2 rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed', ans[i] === q.benar ? 'bg-leaf/25 text-teal-900' : 'bg-terra-soft/50 text-ink/80')}>
                {ans[i] === q.benar ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sage" /> : <Lightbulb className="mt-0.5 size-4 shrink-0 text-terra" />}
                {q.alasan}
              </motion.p>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-wrap items-center gap-4 rounded-[1.6rem] border border-ink/8 bg-paper p-5">
        {!checked ? (
          <>
            <div className="mr-auto">
              <p className="text-[14px] font-medium">
                {answered} dari {items.length} soal dijawab
              </p>
              <span className="mt-2 block h-1.5 w-48 overflow-hidden rounded-full bg-ink/8">
                <motion.span className="block h-full rounded-full bg-teal" animate={{ width: `${(answered / items.length) * 100}%` }} />
              </span>
            </div>
            <button className={buttonClass('primary', 'md')} disabled={answered < items.length} onClick={check}>
              Periksa jawaban
            </button>
          </>
        ) : (
          <>
            <span className={cn('grid size-14 place-items-center rounded-full font-serif text-2xl', pass ? 'bg-sage text-white' : 'bg-terra text-white')}>
              {Math.round(score * items.length)}/{items.length}
            </span>
            <div className="mr-auto">
              <p className="text-[16px] font-semibold">{pass ? 'Lulus, modul selesai!' : 'Belum lulus, coba lagi'}</p>
              <p className="text-[13px] text-ink/55">{pass ? 'Progres tersimpan. Lanjutkan ke latihan atau modul berikutnya.' : `Butuh minimal ${need} jawaban benar. Baca penjelasannya, lalu ulangi.`}</p>
            </div>
            <button
              className={buttonClass('outline', 'md')}
              onClick={() => {
                setAns(items.map(() => null));
                setChecked(false);
              }}
            >
              <RotateCcw className="size-4" /> Ulangi kuis
            </button>
          </>
        )}
      </div>
    </section>
  );
}
