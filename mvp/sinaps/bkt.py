"""Bayesian Knowledge Tracing per knowledge component (persamaan 3-4) dan pemilih kasus adaptif."""

KC = {
    "K1": {"nama": "Mengenali sekuens", "prasyarat": [], "aktif": True,
           "bukti": "pilihan ganda (metadata sekuens)"},
    "K2": {"nama": "Mendeteksi hiperintensitas DWI", "prasyarat": ["K1"], "aktif": True,
           "bukti": "klik titik pada lesi + hemisfer (mask)"},
    "K3": {"nama": "Restriksi sejati vs T2 shine-through", "prasyarat": ["K2"], "aktif": True,
           "bukti": "ADC relatif lesi (peta ADC)"},
    "K4": {"nama": "Mengenali teritori arteri", "prasyarat": ["K2"], "aktif": False,
           "bukti": "registrasi atlas (belum tersedia di MVP)"},
    "K5": {"nama": "Memperkirakan usia lesi", "prasyarat": ["K3"], "aktif": False,
           "bukti": "label radiolog DWI-FLAIR (tahap pilot)"},
    "K6": {"nama": "Mendelineasi seluruh lesi", "prasyarat": ["K2"], "aktif": True,
           "bukti": "Dice, recall per lesi, HD95 (mask)"},
}

# Nilai awal dari literatur BKT; diestimasi ulang dengan pyBKT setelah pilot
PARAMS = {"L0": 0.2, "T": 0.15, "G": 0.2, "S": 0.1}
MASTERED = 0.95


def update(L, correct, p=PARAMS):
    """Posterior setelah satu observasi (pers. 3), lalu peluang belajar (pers. 4)."""
    G, S, T = p["G"], p["S"], p["T"]
    if correct:
        post = L * (1 - S) / (L * (1 - S) + (1 - L) * G)
    else:
        post = L * S / (L * S + (1 - L) * (1 - G))
    return post + (1 - post) * T


def initial():
    return {k: PARAMS["L0"] for k in KC}


def choose_target(mastery):
    """KC aktif dengan penguasaan terendah yang prasyaratnya sudah dikuasai.

    Prasyarat yang belum aktif di MVP (K4, K5) tidak menghalangi.
    """
    def ready(k):
        return all(mastery.get(p, 0) >= MASTERED or not KC[p]["aktif"] for p in KC[k]["prasyarat"])

    cands = [k for k in KC if KC[k]["aktif"] and ready(k) and mastery.get(k, 0) < MASTERED]
    if not cands:
        cands = [k for k in KC if KC[k]["aktif"]]
    k = min(cands, key=lambda c: mastery.get(c, 0))
    blocked = [c for c in KC if KC[c]["aktif"] and not ready(c)]
    return k, blocked


def tier_for(L):
    return "mudah" if L < 0.4 else ("sedang" if L < 0.7 else "sulit")


def choose_case(cases, mastery, seen, kc=None):
    """cases: list dict dengan 'id' dan 'tier'. seen: id kasus yang sudah dikerjakan.

    kc: KC yang dipilih sendiri oleh mahasiswa (latihan terarah dari modul belajar); tanpa itu sistem
    memilih KC terlemah yang prasyaratnya terpenuhi. Kasus yang sudah dikerjakan tidak pernah dipilih lagi
    (kuncinya sudah terbuka); bila semua sudah dikerjakan, kasus = None dan tingkat = None.
    """
    k, blocked = choose_target(mastery)
    if kc in KC and KC[kc]["aktif"]:
        k = kc
    want = tier_for(mastery.get(k, 0))
    order = {"mudah": ["mudah", "sedang", "sulit"], "sedang": ["sedang", "mudah", "sulit"],
             "sulit": ["sulit", "sedang", "mudah"]}[want]
    for t in order:
        pool = [c for c in cases if c["tier"] == t and c["id"] not in seen]
        if pool:
            # urutan tetap tapi berbeda per mahasiswa: kasus paling jarang dilihat dulu
            return k, want, t, pool[len(seen) % len(pool)], blocked
    pool = [c for c in cases if c["id"] not in seen]  # tingkat di luar ketiga tingkat baku
    if pool:
        c = pool[len(seen) % len(pool)]
        return k, want, c["tier"], c, blocked
    return k, want, None, None, blocked
