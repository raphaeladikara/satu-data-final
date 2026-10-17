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
        d = result.get("delineasi", {})
        facts["hasil_penilaian"] = {
            "delineasi": {k: d.get(k) for k in ("dice", "lesion_recall", "vol_err", "hd95", "jenis_kesalahan_label",
                                                "volume_mahasiswa_ml", "volume_kunci_ml")},
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
    if not f:
        if facts.get("fase") == "sebelum_submit" and HEMI.search(text):
            issues.append("menyebut hemisfer sebelum jawaban dikirim")
        return issues
    sides = {f["hemisfer"]} if f["hemisfer"] in ("kiri", "kanan") else {"kiri", "kanan"}
    for m in HEMI.finditer(text):
        ctx = text[max(0, m.start() - 40):m.start()].lower()
        if m.group(1).lower() not in sides and not re.search(r"bukan|tidak|salah|keliru", ctx):
            issues.append(f"menyebut hemisfer {m.group(1).lower()} padahal data: {f['hemisfer']}")
    if not f["multifokal"] and re.search(r"\bmultifokal\b", text, re.I) and not re.search(
            r"(bukan|tidak)\s+multifokal", text, re.I):
        issues.append("menyebut multifokal padahal data: satu fokus")
    return issues


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
    h = facts.get("hasil_penilaian", {}).get("delineasi", {})
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


def ask(mode, facts, message, history=None, image_data_url=None):
    """Kembalikan dict: reply, model, latency_ms, issues, source."""
    if mode == "rujukan":
        facts["rujukan"] = rag.search(message + " " + json.dumps(facts.get("temuan_terstruktur", {}), ensure_ascii=False))
    key = os.environ.get("OPENAI_API_KEY")
    t0 = time.time()
    if not key:
        reply = offline_reply(mode, facts, message)
        return {"reply": reply, "model": "templat-offline", "source": "offline",
                "latency_ms": int((time.time() - t0) * 1000), "issues": fact_check(reply, facts)}
    from openai import OpenAI

    client = OpenAI(api_key=key, timeout=30)
    content = [{"type": "input_text",
                "text": f"MODE: {mode}\nFAKTA:\n{json.dumps(facts, ensure_ascii=False)}\n\nPESAN MAHASISWA:\n{message}"}]
    if image_data_url:
        content.append({"type": "input_image", "image_url": image_data_url})
    inputs = [{"role": h["role"], "content": h["content"]} for h in (history or [])[-6:]
              if h.get("role") in ("user", "assistant") and h.get("content")]
    inputs.append({"role": "user", "content": content})
    try:
        r = client.responses.create(model=MODEL, instructions=SYSTEM, input=inputs, max_output_tokens=700)
        reply = r.output_text.strip()
        source = "llm"
    except Exception as e:  # LLM gagal: jangan diam-diam pura-pura berhasil
        reply = offline_reply(mode, facts, message)
        source = f"offline (LLM gagal: {type(e).__name__})"
    return {"reply": reply, "model": MODEL if source == "llm" else "templat-offline", "source": source,
            "latency_ms": int((time.time() - t0) * 1000), "issues": fact_check(reply, facts)}
