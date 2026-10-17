import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmt, type LessonProgress, type TeachingCase } from '../../api';
import ReadViewer from '../../components/ReadViewer';
import { Loading, Page } from '../../components/Shell';
import { LESSONS, PASS, lessonById, type Quiz } from '../../content/lessons';

function useProgress() {
  const [p, setP] = useState<LessonProgress | null>(null);
  const [mastery, setMastery] = useState<Record<string, number>>({});
  const load = () =>
    api
      .me()
      .then((m) => {
        setP(m.lessons);
        setMastery(m.mastery);
      })
      .catch(() => setP({}));
  useEffect(() => {
    load();
  }, []);
  return { p, mastery, reload: load };
}

export default function Belajar() {
  const { p, mastery } = useProgress();
  return (
    <Page title="Modul belajar" sub="Materi singkat per kompetensi, contoh kasus interaktif, dan kuis cepat. Selesaikan kuis (≥ 2/3 benar) untuk menandai modul selesai.">
      {!p ? (
        <Loading />
      ) : (
        <ol className="lesson-grid">
          {LESSONS.map((l, i) => {
            const st = p[l.id];
            return (
              <li key={l.id} className={`lesson-card ${st?.completed ? 'done' : ''}`}>
                <Link to={`/belajar/${l.id}`}>
                  <div className="lc-top">
                    <span className="lc-num">{st?.completed ? '✓' : i + 1}</span>
                    {l.kc ? <span className="kc">{l.kc}</span> : <span className="kc muted-kc">{l.id === 'orientasi' ? 'dasar' : 'pengantar'}</span>}
                    <span className="muted small">{l.menit} menit</span>
                  </div>
                  <b>{l.judul}</b>
                  <p className="muted small">{l.ringkas}</p>
                  <div className="lc-foot small">
                    {st?.completed ? <span className="ok-text">Selesai · kuis {fmt.pct(st.best_score)}</span> : st?.n_tries ? <span>Kuis {fmt.pct(st.best_score)} · belum lulus</span> : st ? <span>Sudah dibuka</span> : <span className="muted">Belum dibuka</span>}
                    {l.kc && mastery[l.kc] !== undefined && <span className="muted">penguasaan {fmt.pct(mastery[l.kc])}</span>}
                    {!l.dinilai && <span className="muted">belum dinilai di MVP</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      <p className="small muted">Materi adalah draf tim berdasarkan rujukan di korpus SINAPS dan masih menunggu tinjauan dosen mitra.</p>
    </Page>
  );
}

export function Modul() {
  const { id = '' } = useParams();
  const lesson = lessonById(id);
  const { p, reload } = useProgress();
  const idx = LESSONS.findIndex((l) => l.id === id);
  const prev = LESSONS[idx - 1];
  const next = LESSONS[idx + 1];

  useEffect(() => {
    window.scrollTo(0, 0);
    if (lesson) api.saveLesson(lesson.id, {}).catch(() => undefined);
  }, [lesson]);

  if (!lesson) return <Page title="Modul tidak ditemukan"><Link to="/belajar">Kembali ke daftar modul</Link></Page>;
  const st = p?.[lesson.id];

  return (
    <Page>
      <article className="lesson">
        <nav className="crumbs small">
          <Link to="/belajar">Modul belajar</Link> / {lesson.kc ?? (lesson.id === 'orientasi' ? 'Orientasi' : 'Pengantar')}
        </nav>
        <header className="lesson-head">
          <h1>{lesson.judul}</h1>
          <p className="muted">
            {lesson.menit} menit · {lesson.ringkas}
          </p>
          {st?.completed && <span className="pill ok">Selesai · kuis terbaik {fmt.pct(st.best_score)}</span>}
        </header>

        <section className="card goals">
          <h2>Setelah modul ini kamu bisa</h2>
          <ul>
            {lesson.tujuan.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>

        {lesson.bagian.map((b) => (
          <section key={b.judul} className="lesson-sec">
            <h2>{b.judul}</h2>
            {b.isi.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {b.poin && (
              <ul>
                {b.poin.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
            {b.tips && <p className="tip">{b.tips}</p>}
          </section>
        ))}

        {lesson.contoh && <Example caseId={lesson.contoh.case_id} note={lesson.contoh.catatan} seri={lesson.contoh.seri} />}

        <QuizBlock lessonId={lesson.id} items={lesson.kuis} onSaved={reload} />

        <section className="lesson-next card">
          {lesson.kc && lesson.dinilai ? (
            <>
              <div>
                <b>Latih {lesson.kc} dengan kasus nyata</b>
                <p className="muted small">Sistem memilih kasus dengan tingkat kesulitan sesuai penguasaanmu saat ini.</p>
              </div>
              <Link to={`/latihan?kc=${lesson.kc}`} className="btn primary">
                Latihan terarah {lesson.kc}
              </Link>
            </>
          ) : (
            <>
              <div>
                <b>Siap mencoba?</b>
                <p className="muted small">Latihan adaptif memilih kompetensi terlemahmu secara otomatis.</p>
              </div>
              <Link to="/latihan" className="btn primary">
                Mulai latihan adaptif
              </Link>
            </>
          )}
        </section>

        <nav className="pager">
          {prev ? <Link to={`/belajar/${prev.id}`}>← {prev.judul}</Link> : <span />}
          {next ? <Link to={`/belajar/${next.id}`}>{next.judul} →</Link> : <span />}
        </nav>
      </article>
    </Page>
  );
}

function Example({ caseId, note, seri }: { caseId: string; note: string; seri?: string }) {
  const [tc, setTc] = useState<TeachingCase | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api.teaching(caseId).then(setTc).catch((e) => setErr(e.message));
  }, [caseId]);
  const jump = useMemo(() => {
    const c = tc?.findings.fokus[0]?.pusat_voxel;
    return c ? (c.map(Math.round) as [number, number, number]) : null;
  }, [tc]);
  return (
    <section className="card example">
      <div className="card-head">
        <h2>Contoh kasus interaktif</h2>
        {tc && (
          <span className="muted small">
            SOOP {tc.case.id} · {tc.judul}
          </span>
        )}
      </div>
      <p className="small">{note}</p>
      {err && <p className="error">{err}</p>}
      {!tc && !err && <Loading text="Memuat kasus contoh…" />}
      {tc && (
        <>
          <ReadViewer
            geom={tc.case}
            series={tc.series}
            masks={{ kunci: tc.gt_rle }}
            initialVisible={{ kunci: false }}
            initialSeries={Math.max(0, tc.series.findIndex((s) => s.label === seri))}
            jumpTo={jump}
            height={380}
          />
          <p className="small muted">
            Temuan: {tc.findings.jumlah_fokus} fokus, {fmt.num(tc.findings.volume_ml, 1)} ml, hemisfer {tc.findings.hemisfer}, ADC relatif lesi{' '}
            {fmt.num(tc.findings.adc_relatif_lesi)} ({tc.findings.restriksi_sejati ? 'restriksi sejati' : 'bukan restriksi'}). Kasus contoh tidak dipakai di latihan bernilai.
          </p>
        </>
      )}
    </section>
  );
}

function QuizBlock({ lessonId, items, onSaved }: { lessonId: string; items: Quiz[]; onSaved: () => void }) {
  const [ans, setAns] = useState<(number | null)[]>(() => items.map(() => null));
  const [checked, setChecked] = useState(false);
  const score = ans.filter((a, i) => a === items[i].benar).length / items.length;

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

  return (
    <section className="card quiz">
      <div className="card-head">
        <h2>Kuis cepat</h2>
        <span className="muted small">{items.length} soal · lulus bila ≥ {Math.ceil(PASS * items.length)} benar</span>
      </div>
      <ol>
        {items.map((q, i) => (
          <li key={i} className="q">
            <p>
              <b>{q.tanya}</b>
            </p>
            <div className="opts" role="radiogroup">
              {q.opsi.map((o, j) => {
                const state = !checked ? (ans[i] === j ? 'sel' : '') : j === q.benar ? 'right' : ans[i] === j ? 'wrong' : '';
                return (
                  <button key={j} role="radio" aria-checked={ans[i] === j} className={`opt ${state}`} disabled={checked} onClick={() => setAns(ans.map((a, k) => (k === i ? j : a)))}>
                    {o}
                  </button>
                );
              })}
            </div>
            {checked && <p className={`small ${ans[i] === q.benar ? 'ok-text' : 'bad-text'}`}>{q.alasan}</p>}
          </li>
        ))}
      </ol>
      {!checked ? (
        <button className="btn primary" disabled={ans.some((a) => a === null)} onClick={check}>
          Periksa jawaban
        </button>
      ) : (
        <div className="quiz-result">
          <b className={score >= PASS ? 'ok-text' : 'bad-text'}>
            {Math.round(score * items.length)}/{items.length} benar · {score >= PASS ? 'modul selesai' : 'belum lulus, coba lagi'}
          </b>
          <button
            className="btn"
            onClick={() => {
              setAns(items.map(() => null));
              setChecked(false);
            }}
          >
            Ulangi kuis
          </button>
        </div>
      )}
    </section>
  );
}
