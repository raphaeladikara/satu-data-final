# SINAPS — MVP

Prototipe SINAPS untuk babak final ICC 2026. Isinya adalah siklus latihan terarah dari Bab III
(Gambar 5): sistem memilih kasus untuk KC terlemah, mahasiswa membaca MRI dan menandai lesi,
jawabannya dinilai otomatis terhadap lesion mask ahli, tutor menjelaskan dari fakta terstruktur,
lalu penguasaan KC diperbarui dengan BKT.

## Pemetaan ke arsitektur (Gambar 6)

| Modul di paper | Implementasi MVP |
|---|---|
| 1. Viewer web (Cornerstone3D) | `src/viewer/cs.ts`, `src/pages/Practice.tsx`: Cornerstone3D 5.11 (volume lokal, scroll slice, window/level, zoom/geser, kuas & penghapus labelmap, urungkan, probe ADC relatif, Capture) |
| API orkestrator (FastAPI) | `api/index.py` (Vercel Python Function) |
| 2. Bank kasus | `pipeline/build_bank.py` → `public/cases/` (citra) + `server_data/` (kunci jawaban, tidak pernah dikirim sebelum submit) |
| 3. Modul visi | `pipeline/kaggle/train_unet.py` (U-Net 2.5D, dilatih di Kaggle GPU), temuan terstruktur JSON di `build_bank.py` |
| 4. Penilaian | `sinaps/grading.py`: Dice, recall per lesi, galat volume, HD95 → 5 jenis kesalahan |
| 5. Adaptasi (BKT) | `sinaps/bkt.py`: persamaan (3)–(4), prasyarat KC, pemilihan tingkat kesulitan dari tersil indeks D |
| 6. Tutor LLM | `sinaps/tutor.py` + `sinaps/rag.py`: mode Sokratik / penjelasan / rujukan, fakta terkunci sebelum submit, pemeriksa fakta, log audit |
| Dasbor dosen | `src/pages/Dashboard.tsx`: peta penguasaan KC per pseudonim, jenis kesalahan tersering, audit log tutor |
| Penyimpanan berpseudonim | `sinaps/db.py`: Postgres (`DATABASE_URL`) atau SQLite lokal; NIM hanya disimpan sebagai hash |

KC yang dinilai di MVP: K1, K2, K3, K6 (sesuai Tabel 4). K4 (butuh registrasi atlas) dan K5 (butuh label
radiolog) tampil di peta penguasaan sebagai "belum di MVP".

## Data

SOOP, OpenNeuro ds004889 (CC0), diunduh dari S3 publik OpenNeuro oleh `pipeline/download_soop.py`.
Bank kasus: 36 subjek (30 subjek tersebar merata Rankin 0–6 dengan seed 42, ditambah subjek supaya
setiap tingkat kesulitan punya minimal 10 kasus). Subjek bank tidak pernah dipakai melatih U-Net.

## Hasil uji yang dihasilkan pipeline

| Uji | Skrip | Hasil |
|---|---|---|
| Morfologi 1.451 mask akut | `pipeline/mask_stats.py` | median 8,4 ml (IQR 1,7–34,5), 17% < 1 ml, 60% multifokal; tersil D: −0,169 dan 0,774 |
| Aturan jenis kesalahan (672 anotasi sintetis, 36 subjek, 5-fold tingkat subjek) | `pipeline/eval_error_rules.py` | akurasi 94,6% (IK 95% 91,8–97,0) vs 47,3% (IK 95% 40,6–53,7) bila hanya Dice; hasil di `pipeline/results/` |
| Segmentasi U-Net 2.5D pada 36 subjek bank | `pipeline/kaggle/train_unet.py` | `pipeline/kaggle_out/metrics.json` setelah kernel Kaggle selesai |

Angka aturan jenis kesalahan berasal dari kesalahan sintetis, jadi dibaca sebagai batas atas
(sama seperti catatan di Subbab III.E).

## Menjalankan lokal

```bash
cd mvp
npm install
uv venv .venv && uv pip install --python .venv -r requirements.txt uvicorn
.venv/Scripts/python -m uvicorn api.index:app --port 8000   # terminal 1
npm run dev                                                  # terminal 2 → http://localhost:5173
```

Tanpa `OPENAI_API_KEY`, tutor memakai templat deterministik yang diberi label "offline" di setiap
respons. Tanpa `DATABASE_URL`, log disimpan di SQLite `mvp/.local/sinaps.db`.

## Deploy ke Vercel

1. Import repo ke Vercel, set **Root Directory = `mvp`** (framework Vite terdeteksi dari `vercel.json`).
2. Environment variables:
   - `OPENAI_API_KEY` — kunci API OpenAI untuk tutor.
   - `OPENAI_MODEL` — opsional, bawaan `gpt-5.6-luna`.
   - `DATABASE_URL` — string koneksi Postgres. Untuk Supabase pakai *transaction pooler* (port 6543).
     Tanpa ini, Vercel memakai SQLite di `/tmp` yang terhapus saat fungsi dingin.
   - `DOSEN_KEY` — kode untuk membuka dasbor dosen (tanpa ini dasbor terbuka).
   - `SINAPS_PEPPER` — garam hash pseudonim NIM.
3. Deploy. Tabel dibuat otomatis saat permintaan pertama.

## Membangun ulang data dan model

```bash
cd mvp/pipeline
uv venv .venv && uv pip install --python .venv nibabel numpy scipy pandas requests scikit-image kaggle
.venv/Scripts/python download_soop.py masks
.venv/Scripts/python mask_stats.py
.venv/Scripts/python download_soop.py images --n-train 0
.venv/Scripts/kaggle kernels push -p kaggle --accelerator NvidiaTeslaT4   # latih U-Net di Kaggle GPU
.venv/Scripts/kaggle kernels output raphaeladikara/sinaps-unet25d -p kaggle_out
.venv/Scripts/python build_bank.py          # citra + kunci jawaban + prediksi model
.venv/Scripts/python eval_error_rules.py    # uji aturan jenis kesalahan
```

SINAPS adalah alat bantu belajar dan tidak ditujukan untuk mendiagnosis pasien.
