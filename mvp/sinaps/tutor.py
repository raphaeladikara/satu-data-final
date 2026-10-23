"""Tutor LLM yang berpijak pada fakta citra (Subbab III.G).

Tutor hanya menerima keluaran modul deterministik (temuan terstruktur + hasil penilaian), gambar
Capture, kutipan rujukan, dan profil mahasiswa. Sebelum jawaban dikirim, kunci jawaban terkunci.
Tanpa OPENAI_API_KEY, tutor memakai templat deterministik yang diberi label jelas.
"""
import json
import os
import re
import time

from . import rag

MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.6-luna")

SYSTEM = """Kamu adalah tutor neuroradiologi SINAPS untuk mahasiswa kedokteran Indonesia yang berlatih membaca MRI stroke.
SINAPS adalah alat bantu belajar, bukan alat diagnosis pasien.

ATURAN FAKTA (wajib):
1. Hanya boleh menyebut temuan citra yang tertulis di FAKTA (JSON). Jangan menambah temuan dari pengetahuan umum
   atau dari gambar Capture. Gambar Capture hanya menunjukkan apa yang sedang dilihat mahasiswa.
2. Bila ditanya hal yang tidak ada di FAKTA (misalnya teritori arteri atau usia lesi), katakan bahwa data kasus ini
   belum memuatnya dan sarankan bertanya kepada dosen. Jangan menebak.
3. Bila mahasiswa mengusulkan klaim yang bertentangan dengan FAKTA, jangan mengiyakan. Koreksi dengan sopan dan
   tunjukkan data yang mendasarinya.
4. Konvensi radiologis: sisi kiri pasien tampil di sisi kanan layar (penanda R di kiri gambar).
5. Bila FAKTA.fase = "sebelum_submit", kunci jawaban masih terkunci: jangan sebut lokasi, hemisfer, jumlah fokus,
   volume, atau nomor slice lesi. Bimbing cara membacanya (gulir semua slice, bandingkan DWI dengan ADC, atur
   window/level, periksa kedua hemisfer).
6. FAKTA adalah catatan internal sistem. Tulis isinya dalam kalimat biasa: jangan menyebut kata "FAKTA", "JSON",
   "kunci penilaian", nama field (mis. multifokal, radc_median, vol_err), atau nilai true/false. Tulis "satu fokus,
   tidak multifokal", bukan "multifokal: false"; sebut sumbernya sebagai "data kasus ini" atau "mask ahli".

MODE:
- sokratik: jawab dengan satu atau dua pertanyaan penuntun, paling banyak 4 kalimat, tanpa membocorkan jawaban.
- penjelasan: pembahasan lengkap dan terstruktur (temuan, kesalahan mahasiswa, cara memperbaiki), paling banyak 180 kata.
- rujukan: seperti penjelasan, lalu kutip potongan RUJUKAN yang relevan dengan menyebut sumbernya. Bila RUJUKAN kosong,
  katakan belum ada rujukan yang cocok.

Gunakan bahasa Indonesia yang jelas dan sesuaikan dengan tingkat mahasiswa."""


def build_facts(case_pub, secret, phase, result=None, profile=None):
    v = case_pub["vignette"]
    facts = {
        "fase": phase,
        "kasus": {"usia": v.get("usia"), "jenis_kelamin": v.get("jenis_kelamin"), "nihss": v.get("nihss"),
                  "tingkat_kesulitan": case_pub["tier"], "sekuens": ["DWI (TRACE b1000)", "peta ADC", "FLAIR"]},
        "profil_mahasiswa": profile or {},
    }
    if phase == "sebelum_submit":
        facts["status_kunci"] = "terkunci sampai jawaban dikirim"
        return facts
    f = dict(secret["findings"])
    f["fokus"] = [{k: x[k] for k in ("ml", "hemisfer", "slice_terbesar", "rentang_slice", "radc_median")}
                  for x in f["fokus"][:8]]
    facts["temuan_terstruktur"] = f
    if secret.get("model"):
        facts["pembaca_kedua_model"] = secret["model"]
    if result:
        d = result.get("delineasi") or {}  # tidak ada bila mahasiswa tidak mengirim delineasi
        facts["hasil_penilaian"] = {
            "delineasi": {k: d.get(k) for k in ("dice", "lesion_recall", "vol_err", "hd95", "jenis_kesalahan_label",
                                                "volume_mahasiswa_ml", "volume_kunci_ml")} if d else None,
            "fokus_terlewat": [{"ml": x["ml"], "slice_terbesar": x["slice_terbesar"]}
                               for x in d.get("fokus", []) if not x["tersentuh"]][:8],
            "jawaban_kc": {k: {kk: vv for kk, vv in r.items() if kk != "kc"} for k, r in result.get("kc", {}).items()},
        }
    return facts


HEMI = re.compile(r"hemisfer\w*\s+(kiri|kanan)", re.I)


def fact_check(text, facts):
    """Pemeriksa sederhana: klaim hemisfer dan multifokalitas dibandingkan dengan temuan terstruktur.

    Kutipan rujukan dikeluarkan dulu supaya hanya klaim tutor sendiri yang diperiksa.
    """
    for r in facts.get("rujukan") or []:
        for sent in re.split(r"(?<=[.!?])\s+", r["isi"]):
            if len(sent) > 20:
                text = text.replace(sent, " ")
    f = facts.get("temuan_terstruktur")
    issues = []
    for clause in _klausa(text):
        if KLAIM.search(clause):
            continue
        if not f:
            if facts.get("fase") == "sebelum_submit" and not GENERIK.search(clause) and any(
                    not _disangkal(clause, m) for m in HEMI.finditer(clause)):
                issues.append("menyebut hemisfer sebelum jawaban dikirim")
            continue
        sides = {f["hemisfer"]} if f["hemisfer"] in ("kiri", "kanan") else {"kiri", "kanan"}
        for m in HEMI.finditer(clause):
            if m.group(1).lower() not in sides and not GENERIK.search(clause) and not _disangkal(clause, m):
                issues.append(f"menyebut hemisfer {m.group(1).lower()} padahal data: {f['hemisfer']}")
        if not f["multifokal"]:
            for m in MULTI.finditer(clause):
                if not _disangkal(clause, m):
                    issues.append("menyebut multifokal padahal data: satu fokus")
    return list(dict.fromkeys(issues))


# Kalimat koreksi tidak boleh terbaca sebagai klaim tutor (temuan uji Bab IV: 5 dari 36 koreksi skenario C ditandai).
# Teks dipecah per klausa. Sebuah sebutan dilewati bila didahului penyangkalan di klausanya ("bukan hemisfer kiri"),
# bila klausanya menyatakan ketidaksesuaian ("... tidak sesuai dengan data"), atau bila klausanya mengutip klaim
# mahasiswa ("klaim 'hemisfer kiri'", "menurutmu ..."). Sebutan biasa ("lesi di hemisfer kiri") tetap diperiksa.
GENERIK = re.compile(r"kiri\s+(dan|maupun|atau|ke)\s+kanan|kanan\s+(dan|maupun|atau|ke)\s+kiri", re.I)
MULTI = re.compile(r"\bmultifokal\b(?!\s*[:=]\s*(false|salah|tidak)\b)", re.I)
SANGKAL_DEPAN = re.compile(r"\b(bukan|tidak|tak|belum|alih-alih)\b", re.I)
TIDAK_SESUAI = re.compile(r"\b(tidak|kurang|belum)\s+(sesuai|tepat|benar|cocok|didukung)|\bbertentangan|\bkeliru\b|\bpadahal\b|"
                          r"\bsalah\b", re.I)
KLAIM = re.compile(r"\b(klaim\w*|kamu\s+(sebut|bilang|kira|tulis|menyebut)\w*|anda\s+(sebut|bilang|kira|tulis|menyebut)\w*|"
                   r"menurut(mu|\s+kamu|\s+anda|\s+beliau|\s+dosen)|(pendapat|dugaan|usulan)(mu)?)\b", re.I)
KUTIP = re.compile(r"[\"“”][^\"“”]{0,60}[\"“”]")


def _klausa(text):
    text = KUTIP.sub(" ", re.sub(r"[*_`#>]", "", text))
    parts = re.split(r"(?<=[.!?])\s+|[;\n]|,\s+(?=(?:bukan|tetapi|tapi|namun|melainkan|sedangkan)\b)|\s+[-–—]\s+",
                     text)
    return [c for c in parts if c and c.strip()]


def _disangkal(clause, m):
    return bool(SANGKAL_DEPAN.search(clause[:m.start()]) or TIDAK_SESUAI.search(clause))


def num(x, d=2):
    return f"{x:.{d}f}".replace(".", ",")


def correction(message, f):
    """Koreksi klaim mahasiswa yang bertentangan dengan temuan terstruktur (uji sikofansi, Subbab III.G)."""
    out = []
    m = HEMI.search(message)
    if m and f["hemisfer"] in ("kiri", "kanan") and m.group(1).lower() != f["hemisfer"]:
        out.append(f"Data kasus ini menunjukkan lesi di hemisfer {f['hemisfer']}, bukan {m.group(1).lower()}. "
                   "Ingat konvensi radiologis: sisi kiri pasien tampil di sisi kanan layar.")
    if re.search(r"\b(satu|tunggal)\s+(fokus|lesi)\b", message, re.I) and f["multifokal"]:
        out.append(f"Data menunjukkan {f['jumlah_fokus']} fokus, jadi lesinya multifokal.")
    if re.search(r"\bmultifokal\b", message, re.I) and not re.search(r"(bukan|tidak)\s+multifokal", message, re.I) \
            and not f["multifokal"]:
        out.append("Data menunjukkan hanya satu fokus, jadi lesinya tidak multifokal.")
    return " ".join(out)


def offline_reply(mode, facts, message):
    """Templat deterministik dari fakta (dipakai bila LLM tidak tersedia)."""
    if facts["fase"] == "sebelum_submit":
        return ("Kunci jawaban masih terkunci. Coba gulir semua slice dari bawah ke atas: di mana DWI tampak terang? "
                "Lalu buka peta ADC pada slice yang sama. Apakah wilayah itu gelap? Jangan lupa periksa kedua hemisfer.")
    f = facts["temuan_terstruktur"]
    fix = correction(message, f)
    body = _offline_body(mode, facts, f)
    return f"{fix} {body}" if fix else body


def _offline_body(mode, facts, f):
    h = facts.get("hasil_penilaian", {}).get("delineasi") or {}
    missed = facts.get("hasil_penilaian", {}).get("fokus_terlewat", [])
    if mode == "sokratik":
        if missed:
            s = missed[0]["slice_terbesar"]
            return (f"Ada fokus lesi yang belum kamu tandai. Coba kembali ke sekitar slice {s}: "
                    "apakah ada wilayah terang di DWI yang gelap di ADC? Mengapa fokus sekecil itu penting secara klinis?")
        if h.get("vol_err", 0) and h["vol_err"] < -0.2:
            return "Tandaanmu lebih kecil dari kunci. Lihat tepi lesi di DWI: apakah batasnya berhenti di tempat kamu berhenti?"
        if h.get("vol_err", 0) and h["vol_err"] > 0.25:
            return "Tandaanmu lebih luas dari kunci. Di tepi lesi, apakah ADC-nya masih rendah, atau sudah kembali normal?"
        return "Hasilmu sudah dekat dengan kunci. Apa yang membuatmu yakin ini infark akut, bukan T2 shine-through?"
    lines = [
        f"Lesi akut {f['hemisfer']}, {f['jumlah_fokus']} fokus, total {num(f['volume_ml'])} ml ({f['kategori_volume']}), "
        f"terbesar di slice {f['slice_lesi_terbesar']}.",
        f"ADC relatif lesi {num(f['adc_relatif_lesi'])}: "
        + ("rendah, sesuai restriksi difusi sejati." if f["restriksi_sejati"] else
           "tidak rendah (>= 0,8): pertimbangkan T2 shine-through atau lesi yang lebih lama."),
    ]
    if h:
        lines.append(f"Delineasimu: Dice {num(h['dice'])}, recall per lesi {round(h['lesion_recall'] * 100)}%, "
                     f"jenis kesalahan: {h['jenis_kesalahan_label']}.")
    if missed:
        lines.append("Fokus terlewat: " + ", ".join(f"{num(m['ml'])} ml (slice {m['slice_terbesar']})" for m in missed[:4]) + ".")
    lines.append("Teritori arteri belum ada di data kasus ini; tanyakan kepada dosen.")
    if mode == "rujukan":
        for r in facts.get("rujukan", []):
            lines.append(f"[{r['sumber']}] {r['judul']}: {r['isi']}")
    return " ".join(lines)


# Penalaran model dibuat rendah supaya jawaban lebih cepat (satu permintaan mode penjelasan, 18 Okt: 6,7 -> 5,1 dtk).
# Keandalannya diuji ulang dengan paper/script/analysis/a08_tutor_mvp.py.
REASONING = os.environ.get("OPENAI_REASONING", "low")


def _inputs(mode, facts, message, history, image_data_url):
    content = [{"type": "input_text",
                "text": f"MODE: {mode}\nFAKTA:\n{json.dumps(facts, ensure_ascii=False)}\n\nPESAN MAHASISWA:\n{message}"}]
    if image_data_url:
        content.append({"type": "input_image", "image_url": image_data_url})
    inputs = [{"role": h["role"], "content": h["content"]} for h in clean_history(history)]
    inputs.append({"role": "user", "content": content})
    return inputs


HISTORY_TURNS = 6
HISTORY_CHARS = 4000
IMAGE_MAX_CHARS = 2_800_000  # ~2 MB setelah base64 didekode
IMAGE_RE = re.compile(r"data:image/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}")


def clean_history(history):
    """Riwayat dari klien: hanya peran user/assistant berisi teks, dipotong, paling banyak HISTORY_TURNS terakhir."""
    out = [{"role": h["role"], "content": h["content"][:HISTORY_CHARS]} for h in (history or [])
           if isinstance(h, dict) and h.get("role") in ("user", "assistant") and isinstance(h.get("content"), str)
           and h["content"].strip()]
    return out[-HISTORY_TURNS:]


def clean_image(data_url):
    """Gambar Capture hanya diterima sebagai data URL PNG/JPEG base64 < ~2 MB; selain itu diabaikan."""
    if not isinstance(data_url, str) or len(data_url) > IMAGE_MAX_CHARS or not IMAGE_RE.fullmatch(data_url):
        return None
    return data_url


# Penyaring token sampah. Uji 18 Okt (432 jawaban): 2 jawaban berakhir dengan token yang tidak ada hubungannya
# dengan isi ("Erotiske", "彩神争霸官方"). Aksara non-Latin dan potongan kata yatim sesudah kalimat terakhir dibuang
# dari jawaban akhir, lalu dicatat sebagai catatan pemeriksa supaya terlihat di audit dosen.
ASING = re.compile(r"[Ѐ-ӿ֐-ۿ฀-๿぀-ヿ㐀-鿿가-힯]+")
EKOR_YATIM = re.compile(r"(?<=[.!?)])\s+([^\s.!?]{2,30})\s*$")


def bersihkan(text):
    """Kembalikan (teks bersih, daftar potongan yang dibuang)."""
    buang = ASING.findall(text)
    text = ASING.sub("", text)
    m = EKOR_YATIM.search(text)
    if m and not re.search(r"[*_`:\d]", m.group(1)):
        buang.append(m.group(1))
        text = text[:m.start()]
    return re.sub(r"[ \t]+\n", "\n", text).strip(), buang


def _done(reply, facts, **kw):
    reply, buang = bersihkan(reply)
    issues = fact_check(reply, facts) + ([f"token asing dihapus: {' '.join(buang)}"] if buang else [])
    return {"reply": reply, **kw, "issues": issues}


# Batas waktu LLM: fungsi Vercel berhenti di maxDuration 60 dtk. Jawaban model dipotong setelah DEADLINE_S lalu diganti
# templat offline; jeda antarpotongan paling lama READ_S. Terburuk 33 + 15 = 48 dtk, sisanya untuk pemeriksa fakta dan log.
DEADLINE_S = 33
READ_S = 15


def ask_stream(mode, facts, message, history=None, image_data_url=None, deadline_s=DEADLINE_S):
    """Generator: ("delta", teks) selama model menulis, lalu ("done", dict) seperti ask().

    Respons bertahap membuat mahasiswa melihat kalimat pertama setelah first_token_ms, bukan setelah seluruh
    jawaban selesai. Pemeriksa fakta tetap dijalankan pada jawaban utuh.
    """
    if mode == "rujukan":
        facts["rujukan"] = rag.search(message + " " + json.dumps(facts.get("temuan_terstruktur", {}), ensure_ascii=False))
    key = os.environ.get("OPENAI_API_KEY")
    t0 = time.time()
    ms = lambda: int((time.time() - t0) * 1000)  # noqa: E731
    if not key:
        reply = offline_reply(mode, facts, message)
        yield "delta", reply
        yield "done", _done(reply, facts, model="templat-offline", source="offline", latency_ms=ms(),
                            first_token_ms=ms())
        return
    from openai import OpenAI

    import httpx

    client = OpenAI(api_key=key, timeout=httpx.Timeout(min(READ_S, deadline_s), connect=5), max_retries=0)
    parts, first = [], None
    try:
        stream = client.responses.create(model=MODEL, instructions=SYSTEM, max_output_tokens=700, stream=True,
                                         input=_inputs(mode, facts, message, history, image_data_url),
                                         reasoning={"effort": REASONING})
        for ev in stream:
            if time.time() - t0 > deadline_s:
                stream.close()
                raise TimeoutError("melewati batas waktu")
            if ev.type == "response.output_text.delta" and ev.delta:
                first = first if first is not None else ms()
                parts.append(ev.delta)
                yield "delta", ev.delta
            elif ev.type in ("response.failed", "error"):
                raise RuntimeError(getattr(ev, "message", None) or "respons gagal")
        reply, source = "".join(parts).strip(), "llm"
        if not reply:
            raise RuntimeError("jawaban kosong")
    except Exception as e:  # LLM gagal: jangan diam-diam pura-pura berhasil
        reply = offline_reply(mode, facts, message)
        source = f"offline (LLM gagal: {type(e).__name__})"
        yield "reset", reply
    yield "done", _done(reply, facts, model=MODEL if source == "llm" else "templat-offline", source=source,
                        latency_ms=ms(), first_token_ms=first if first is not None else ms())


def ask(mode, facts, message, history=None, image_data_url=None):
    """Kembalikan dict: reply, model, latency_ms, first_token_ms, issues, source."""
    out = None
    for kind, val in ask_stream(mode, facts, message, history, image_data_url):
        if kind == "done":
            out = val
    return out
