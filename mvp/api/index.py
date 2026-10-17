"""SINAPS - orkestrator API (FastAPI). Di Vercel berjalan sebagai Python Function; lokal: uvicorn api.index:app."""
import hashlib
import os
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI, Header, HTTPException  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from sinaps import bkt, cases, db, grading, tutor  # noqa: E402

app = FastAPI(title="SINAPS API", version="0.1.0")
PEPPER = os.environ.get("SINAPS_PEPPER", "sinaps-icc-2026")
LABELS = ["A", "B", "C"]


def pseudonym(nim):
    return "S-" + hashlib.sha256(f"{PEPPER}:{nim.strip().lower()}".encode()).hexdigest()[:8].upper()


def profile(m):
    active = {k: v for k, v in m.items() if bkt.KC[k]["aktif"]}
    weakest = min(active, key=active.get)
    return {"kc_terlemah": f"{weakest} {bkt.KC[weakest]['nama']}", "penguasaan": {k: round(v, 2) for k, v in m.items()}}


class Login(BaseModel):
    nim: str
    kelas: str = "umum"


class Submit(BaseModel):
    sid: str
    attempt_id: int
    k1: dict[str, str] | None = None          # {"A": "DWI", "B": "ADC", "C": "FLAIR"}
    k2_point: list[float] | None = None       # [x, y, z] voxel, berbasis 0
    k2_hemisfer: str | None = None            # kiri | kanan | bilateral
    k3_adc_bin: str | None = None
    k3_restriksi: bool | None = None
    mask_rle: list[int] | None = None


class TutorReq(BaseModel):
    sid: str
    attempt_id: int
    mode: str = "sokratik"
    message: str
    image: str | None = None
    history: list[dict] | None = None


@app.get("/api/health")
def health():
    return {"ok": True, "db": db.backend(), "llm": bool(os.environ.get("OPENAI_API_KEY")), "model": tutor.MODEL,
            "cases": len(cases.all_cases())}


@app.get("/api/kc")
def kc():
    return {"kc": bkt.KC, "params": bkt.PARAMS, "mastered": bkt.MASTERED, "adc_bins": [b[0] for b in grading.ADC_BINS],
            "error_types": grading.ERROR_TYPES, "thresholds": grading.THRESHOLDS}


@app.post("/api/login")
def login(body: Login):
    if not body.nim.strip():
        raise HTTPException(400, "NIM/ID kosong")
    sid = pseudonym(body.nim)
    db.ensure_student(sid, body.kelas.strip() or "umum")
    return {"sid": sid}


@app.get("/api/me")
def me(sid: str):
    m, n = db.get_mastery(sid, bkt.initial())
    hist = [{"id": a["id"], "case_id": a["case_id"], "target_kc": a["target_kc"], "tier": a["tier"],
             "submitted": a["submitted_at"] is not None,
             "dice": ((a["result"] or {}).get("delineasi") or {}).get("dice"),
             "jenis_kesalahan": ((a["result"] or {}).get("delineasi") or {}).get("jenis_kesalahan_label")}
            for a in db.list_attempts(sid, 100)]
    return {"sid": sid, "mastery": m, "n_obs": n, "kc": bkt.KC, "attempts": hist}


def _open(sid, case_id, target_kc, tier, reason, m, blocked):
    secret = cases.secrets()[case_id]
    order = list(secret["sequences"].items())
    random.shuffle(order)
    seq_order = {LABELS[i]: name for i, (name, _) in enumerate(order)}
    aid = db.start_attempt(sid, case_id, target_kc, tier, m, seq_order)
    pub = cases.public_case(case_id)
    return {
        "attempt_id": aid, "case": pub, "target_kc": target_kc, "tier": tier, "reason": reason, "blocked": blocked,
        "series": [{"label": LABELS[i], "file": f"/cases/{case_id}/{fid}.bin"} for i, (_, fid) in enumerate(order)],
        "mastery": m,
    }


@app.get("/api/next")
def next_case(sid: str):
    m, _ = db.get_mastery(sid, bkt.initial())
    seen = {a["case_id"] for a in db.list_attempts(sid, 500) if a["submitted_at"]}
    k, want, tier, case, blocked = bkt.choose_case(cases.all_cases(), m, seen)
    reason = (f"KC terlemah yang prasyaratnya terpenuhi: {k} {bkt.KC[k]['nama']} "
              f"(penguasaan {m[k]:.2f}) -> tingkat {want}" + ("" if tier == want else f" (habis, dipakai {tier})"))
    return _open(sid, case["id"], k, tier, reason, m, blocked)


@app.get("/api/open/{case_id}")
def open_case(case_id: str, sid: str):
    if case_id not in cases.secrets():
        raise HTTPException(404, "kasus tidak ditemukan")
    m, _ = db.get_mastery(sid, bkt.initial())
    pub = cases.public_case(case_id)
    return _open(sid, case_id, "bebas", pub["tier"], "Kasus dipilih sendiri dari bank kasus", m, [])


@app.get("/api/cases")
def list_cases():
    return [{"id": c["id"], "tier": c["tier"], "D": c["D"], "vignette": c["vignette"]} for c in cases.all_cases()]


def _attempt(sid, aid):
    a = db.get_attempt(aid)
    if not a or a["student_id"] != sid:
        raise HTTPException(404, "percobaan tidak ditemukan")
    return a


class Reveal(BaseModel):
    sid: str
    attempt_id: int
    k1: dict[str, str]


@app.post("/api/reveal")
def reveal(body: Reveal):
    """K1: kunci jawaban pengenalan sekuens, lalu buka label seri supaya langkah berikutnya memakai nama sekuens."""
    a = _attempt(body.sid, body.attempt_id)
    answers = dict(a["answers"] or {})
    if "k1" not in answers:
        answers["k1"] = body.k1
        db.set_answers(body.attempt_id, answers)
    truth = a["seq_order"]
    return {"seq_order": truth, "benar": all(answers["k1"].get(l) == n for l, n in truth.items())}


@app.post("/api/submit")
def submit(body: Submit):
    a = _attempt(body.sid, body.attempt_id)
    if a["submitted_at"]:
        raise HTTPException(409, "jawaban kasus ini sudah dikirim")
    body.k1 = (a["answers"] or {}).get("k1") or body.k1
    case_id = a["case_id"]
    pub = cases.public_case(case_id)
    secret = cases.secrets()[case_id]
    f = secret["findings"]
    mk = cases.masks(case_id)
    g = mk["gt"]
    shape = tuple(pub["dimensions"])
    res = {"kc": {}}

    if body.k1:
        truth = a["seq_order"]
        ok = all(body.k1.get(lbl) == name for lbl, name in truth.items())
        res["kc"]["K1"] = {"benar": ok, "jawaban": body.k1, "kunci": truth}
    if body.k2_point is not None or body.k2_hemisfer:
        in_lesion = grading.grade_point(body.k2_point, g)
        hemi_ok = body.k2_hemisfer == f["hemisfer"]
        res["kc"]["K2"] = {"benar": in_lesion and hemi_ok, "titik_di_lesi": in_lesion,
                           "hemisfer_benar": hemi_ok, "jawaban_hemisfer": body.k2_hemisfer, "kunci_hemisfer": f["hemisfer"]}
    if body.k3_adc_bin or body.k3_restriksi is not None:
        key_bin = grading.adc_bin(f["adc_relatif_lesi"])
        ok_bin = body.k3_adc_bin == key_bin
        ok_r = body.k3_restriksi == f["restriksi_sejati"]
        res["kc"]["K3"] = {"benar": ok_bin and ok_r, "rentang_benar": ok_bin, "restriksi_benar": ok_r,
                           "jawaban_rentang": body.k3_adc_bin, "kunci_rentang": key_bin,
                           "adc_relatif_lesi": f["adc_relatif_lesi"], "kunci_restriksi": f["restriksi_sejati"]}
    if body.mask_rle is not None:
        try:
            p = cases.rle_decode(body.mask_rle, shape)
        except ValueError as e:
            raise HTTPException(400, str(e))
        d = grading.grade_delineation(p, g, cases.spacing(case_id))
        res["delineasi"] = d
        res["kc"]["K6"] = {"benar": d["benar"], "dice": d["dice"], "lesion_recall": d["lesion_recall"],
                           "jenis_kesalahan": d["jenis_kesalahan_label"]}

    before, n = db.get_mastery(body.sid, bkt.initial())
    after = dict(before)
    for k, r in res["kc"].items():
        after[k] = bkt.update(after[k], r["benar"])
        n[k] += 1
    db.set_mastery(body.sid, after, n)
    res["mastery_before"], res["mastery_after"] = before, after
    db.finish_attempt(body.attempt_id, body.model_dump(exclude={"mask_rle"}), res, after)

    return {
        **res,
        "findings": f, "model": secret.get("model"), "luaran": secret.get("luaran"),
        "seq_order": a["seq_order"],
        "gt_rle": cases.rle_encode(g),
        "pred_rle": cases.rle_encode(mk["pred"]) if "pred" in mk else None,
    }


@app.post("/api/tutor")
def ask_tutor(body: TutorReq):
    a = _attempt(body.sid, body.attempt_id)
    if body.mode not in ("sokratik", "penjelasan", "rujukan"):
        raise HTTPException(400, "mode tidak dikenal")
    phase = "setelah_submit" if a["submitted_at"] else "sebelum_submit"
    m, _ = db.get_mastery(body.sid, bkt.initial())
    facts = tutor.build_facts(cases.public_case(a["case_id"]), cases.secrets()[a["case_id"]], phase,
                              a["result"], profile(m))
    out = tutor.ask(body.mode, facts, body.message[:2000], body.history, body.image)
    db.log_tutor(student_id=body.sid, attempt_id=body.attempt_id, case_id=a["case_id"], mode=body.mode, phase=phase,
                 message=body.message[:2000], response=out["reply"], model=out["model"], latency_ms=out["latency_ms"],
                 facts={"issues": out["issues"], "source": out["source"], "rujukan": facts.get("rujukan")})
    return {**out, "phase": phase, "rujukan": facts.get("rujukan")}


@app.get("/api/dashboard")
def dashboard(x_dosen_key: str | None = Header(default=None)):
    key = os.environ.get("DOSEN_KEY")
    if key and x_dosen_key != key:
        raise HTTPException(401, "kode dosen salah")
    rows, studs = db.all_mastery()
    by = {}
    for r in rows:
        by.setdefault(r["student_id"], {})[r["kc"]] = {"p": r["p"], "n": r["n_obs"]}
    atts = db.list_attempts(limit=1000)
    done = [x for x in atts if x["submitted_at"]]
    errs, dices = {}, []
    for x in done:
        d = (x["result"] or {}).get("delineasi")
        if d:
            errs[d["jenis_kesalahan_label"]] = errs.get(d["jenis_kesalahan_label"], 0) + 1
            dices.append(d["dice"])
    logs = db.list_tutor(100)
    return {
        "students": [{"sid": s["id"], "kelas": s["kelas"], "mastery": by.get(s["id"], {}),
                      "n_kasus": sum(1 for x in done if x["student_id"] == s["id"])} for s in studs],
        "kc": {k: v["nama"] for k, v in bkt.KC.items()},
        "error_counts": errs,
        "n_attempts": len(done),
        "mean_dice": sum(dices) / len(dices) if dices else None,
        "recent": [{"id": x["id"], "sid": x["student_id"], "case_id": x["case_id"], "target_kc": x["target_kc"],
                    "tier": x["tier"], "submitted_at": x["submitted_at"],
                    "kc": {k: v["benar"] for k, v in ((x["result"] or {}).get("kc") or {}).items()},
                    "dice": ((x["result"] or {}).get("delineasi") or {}).get("dice"),
                    "jenis": ((x["result"] or {}).get("delineasi") or {}).get("jenis_kesalahan_label")}
                   for x in done[:50]],
        "tutor_logs": [{"id": t["id"], "sid": t["student_id"], "case_id": t["case_id"], "mode": t["mode"],
                        "phase": t["phase"], "message": t["message"], "response": t["response"], "model": t["model"],
                        "latency_ms": t["latency_ms"], "issues": (t["facts"] or {}).get("issues", []),
                        "source": (t["facts"] or {}).get("source"), "created_at": t["created_at"]} for t in logs],
        "db": db.backend(),
    }
