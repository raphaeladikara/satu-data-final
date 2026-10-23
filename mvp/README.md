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
| 4. Penilaian | `sinaps/grading.py`: Dice, recall per lesi, galat volume, HD95, Dice fokus tersentuh → 5 jenis kesalahan; K6 benar bila Dice ≥ 0,6, semua fokus tersentuh, galat volume ≤ +25% |
| 5. Adaptasi (BKT) | `sinaps/bkt.py`: persamaan (3)–(4), prasyarat KC, pemilihan tingkat kesulitan dari tersil indeks D |
| 6. Tutor LLM | `sinaps/tutor.py` + `sinaps/rag.py`: mode Sokratik / penjelasan / rujukan, fakta terkunci sebelum submit, jawaban bertahap (`/api/tutor/stream`, NDJSON), penalaran rendah (`OPENAI_REASONING`), pemeriksa fakta berbasis aturan (hanya klaim hemisfer dan multifokal, mengenali kalimat koreksi), penyaring token sampah, pembatas laju (20/menit, 300/hari), log audit |
| Dasbor dosen | `src/pages/dosen/`: ringkasan kelas, peta penguasaan KC per mahasiswa, lintasan BKT, jenis kesalahan tersering, tugas, verifikasi kasus, audit log tutor, ekspor CSV |
| Penyimpanan berpseudonim | `sinaps/db.py`: Postgres (`DATABASE_URL`) atau SQLite lokal; NIM hanya disimpan sebagai hash |
| Akun & kelas | `sinaps/auth.py`: NIM/username + kata sandi (PBKDF2), token HMAC; dosen membuat kelas, mahasiswa bergabung dengan kode kelas |
| Modul belajar | `src/content/lessons.ts`, `src/pages/student/Belajar.tsx`: 6 modul per KC dengan contoh kasus interaktif dan kuis |

KC yang dinilai di MVP: K1, K2, K3, K6 (sesuai Tabel 4). K4 (butuh registrasi atlas) dan K5 (butuh label
radiolog) tampil di peta penguasaan sebagai "belum di MVP".

## Fitur aplikasi

**Mahasiswa** (daftar dengan nama, NIM, kata sandi, jenjang, dan kode kelas dari dosen)
- Beranda: langkah berikutnya yang disarankan (modul atau latihan untuk KC terlemah), penguasaan BKT, tugas aktif, percobaan terakhir.
- Belajar: 6 modul (orientasi, K1, K2, K3, K6, pengantar K4/K5) berisi materi, contoh kasus interaktif dengan kunci jawaban, dan kuis.
  Kasus contoh (`sub-754`, `sub-1320`, `sub-652`) dikeluarkan dari latihan bernilai.
- Latihan: siklus adaptif seperti di Bab III, plus latihan terarah per KC (`/latihan?kc=K3`), lanjut otomatis setelah memuat ulang, dan lewati kasus.
- Tugas, bank kasus (tanda sudah dikerjakan), riwayat dan tinjau ulang (anotasi sendiri di atas kunci + model, percakapan tutor), profil dan ganti kata sandi.

**Dosen** (daftar dengan kode pendaftaran dosen `DOSEN_KEY`)
- Kelas: buat kelas, salin kode/tautan daftar, ganti kode, hapus.
- Ringkasan: mahasiswa aktif, rerata Dice, penguasaan rata-rata per KC, kesalahan tersering, aktivitas 14 hari, mahasiswa yang perlu perhatian, peta penguasaan.
- Detail mahasiswa: lintasan penguasaan, riwayat kasus (bisa ditinjau di atas citra), log tutor, modul, tugas, atur ulang kata sandi.
- Tugas berisi modul + kasus dengan tenggat dan matriks progres; verifikasi kasus (setujui/tandai/tolak, kasus ditolak keluar dari latihan); audit tutor; ekspor CSV.

Setiap dosen hanya melihat mahasiswa di kelasnya sendiri. Log belajar memakai pseudonim hash NIM; nama tampilan hanya ada di tabel akun.

## Data

SOOP, OpenNeuro ds004889 (CC0), diunduh dari S3 publik OpenNeuro oleh `pipeline/download_soop.py`.
Bank kasus: 36 subjek (30 subjek tersebar merata Rankin 0–6 dengan seed 42, ditambah subjek supaya
setiap tingkat kesulitan punya minimal 10 kasus). Subjek bank tidak pernah dipakai melatih U-Net.

## Hasil uji yang dihasilkan pipeline

| Uji | Skrip | Hasil |
|---|---|---|
| Morfologi 1.451 mask akut | `pipeline/mask_stats.py` | median 8,4 ml (IQR 1,7–34,5), 17% < 1 ml, 60% multifokal; tersil D: −0,169 dan 0,774 |
| Aturan jenis kesalahan (672 anotasi sintetis, 36 subjek, 5-fold tingkat subjek) | `pipeline/eval_error_rules.py` | akurasi 97,8% (IK 95% 96,0–99,1); aturan lama tanpa Dice fokus tersentuh 94,6% (91,8–97,0); 47,3% (40,6–53,7) bila hanya Dice; hasil di `pipeline/results/` |
| Segmentasi U-Net 2.5D (1.170 pasien latih, 30 epoch, T4 50 menit) pada 36 subjek bank | `pipeline/kaggle/train_unet.py` | Dice rerata 0,738 (IK 95% 0,645–0,813), median 0,816; recall per lesi 0,80; Dice 0,805 untuk lesi ≥ 5 ml (n=28) dan 0,503 untuk < 5 ml (n=8); hasil di `pipeline/results/unet25d/` |

Angka aturan jenis kesalahan berasal dari kesalahan sintetis, jadi dibaca sebagai batas atas
(sama seperti catatan di Subbab III.E). Prediksi U-Net tidak dijalankan di Vercel: mask prediksi untuk
36 kasus dihitung sekali di Kaggle, lalu `build_bank.py` menyimpannya di `server_data/cases/<sub>.npz`.
Bobot `unet25d.pt` (30 MB) tidak masuk repo; simpan dari keluaran kernel Kaggle.

## Menjalankan lokal

```bash
cd mvp
npm install
uv venv .venv && uv pip install --python .venv -r requirements.txt uvicorn
.venv/Scripts/python -m uvicorn api.index:app --port 8000   # terminal 1
npm run dev                                                  # terminal 2 → http://localhost:5173
```

Data demo (2 dosen, 3 kelas, 20 mahasiswa fiktif dengan percobaan tersimulasi, tugas, dan verifikasi kasus):

```bash
.venv/Scripts/python scripts/seed_demo.py           # akun: dosen demo.dosen & demo.dosen2, mahasiswa DEMO0001-DEMO0020, sandi sinaps-demo
.venv/Scripts/python scripts/seed_demo.py --hapus   # hapus data demo
```

Skrip memakai `DATABASE_URL` bila di-set, jadi bisa juga mengisi basis data produksi. Anotasi demo dibuat dari mask ahli
yang sengaja diganggu; jangan dilaporkan sebagai hasil uji coba.

Tanpa `OPENAI_API_KEY`, tutor memakai templat deterministik yang diberi label "offline" di setiap
respons. Tanpa `DATABASE_URL`, log disimpan di SQLite `mvp/.local/sinaps.db`.

## Deploy ke Vercel

1. Import repo ke Vercel, set **Root Directory = `mvp`** (framework Vite terdeteksi dari `vercel.json`).
2. Environment variables:
   - `OPENAI_API_KEY` — kunci API OpenAI untuk tutor.
   - `OPENAI_MODEL` — opsional, bawaan `gpt-5.6-luna`.
   - `OPENAI_REASONING` — opsional, tingkat penalaran tutor (`none`, `low`, `medium`, ...), bawaan `low`.
   - `DATABASE_URL` — string koneksi Postgres. Untuk Supabase pakai *transaction pooler* (port 6543).
     Tanpa ini, Vercel memakai SQLite di `/tmp` yang terhapus saat fungsi dingin.
   - `DOSEN_KEY` — kode pendaftaran akun dosen. Tanpa ini kodenya `SINAPS2026` (hanya untuk lokal).
   - `SINAPS_PEPPER` — garam hash pseudonim NIM.
   - `SINAPS_SECRET` — kunci tanda tangan token sesi (string acak panjang).
3. Deploy. Tabel dibuat otomatis saat permintaan pertama.

## Membangun ulang data dan model

```bash
cd mvp/pipeline
uv venv .venv && uv pip install --python .venv nibabel numpy scipy pandas requests scikit-image kaggle
.venv/Scripts/python download_soop.py masks
.venv/Scripts/python mask_stats.py
.venv/Scripts/python download_soop.py images --n-train 0
.venv/Scripts/kaggle kernels push -p kaggle --accelerator NvidiaTeslaT4   # latih U-Net di Kaggle GPU
.venv/Scripts/kaggle kernels output raphaeladikara/sinaps-unet25d-run3 -p kaggle_out
.venv/Scripts/python build_bank.py          # citra + kunci jawaban + prediksi model
.venv/Scripts/python eval_error_rules.py    # uji aturan jenis kesalahan
```

## Memperbarui model setelah latih ulang

Web tidak perlu diubah. Setelah kernel Kaggle selesai, unduh `sinaps_out.zip`, lalu:

```bash
cd mvp/pipeline
.venv/Scripts/python update_model.py path/ke/sinaps_out.zip          # bangun ulang + tampilkan Dice lama -> baru
.venv/Scripts/python update_model.py path/ke/sinaps_out.zip --push   # bila hasilnya lebih baik: commit + push
```

Skrip ini mengganti prediksi di `server_data/`, menyalin metrik ke `pipeline/results/unet25d/`, dan
memperbarui tabel hasil di README. Citra kasus tidak ditulis ulang. Proyek Vercel yang terhubung ke
GitHub redeploy otomatis setelah push. Butuh data SOOP lokal di `data/soop/` (sudah ada di laptop ini).

SINAPS adalah alat bantu belajar dan tidak ditujukan untuk mendiagnosis pasien.
