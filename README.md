# SINAPS

**Sistem Interaktif Neuroradiologi Adaptif untuk Pembelajaran Stroke.** Aplikasi web tempat
mahasiswa kedokteran berlatih membaca MRI stroke iskemik akut. Siklus latihannya:

1. Sistem memilih kasus untuk kompetensi (KC) yang paling lemah.
2. Mahasiswa membaca MRI (DWI, ADC, FLAIR) di viewer dan menandai lesi dengan kuas.
3. Jawaban dinilai otomatis terhadap lesion mask ahli.
4. Tutor menjelaskan berdasarkan fakta terstruktur dari kasus tersebut.
5. Penguasaan KC diperbarui dengan Bayesian Knowledge Tracing (BKT).

SINAPS adalah alat bantu belajar dan tidak ditujukan untuk mendiagnosis pasien.

## Teknologi

- **Frontend:** React + Vite + TypeScript, viewer Cornerstone3D 5.11.
- **Backend:** FastAPI sebagai Vercel Python Function (`api/index.py`).
- **Basis data:** Postgres (Supabase) lewat `DATABASE_URL`, atau SQLite lokal bila tidak di-set.
- **Tutor:** model OpenAI dengan retrieval BM25 atas korpus rujukan berbahasa Indonesia.
- **Model visi:** U-Net 2.5D, dilatih di Kaggle GPU; prediksinya disimpan bersama bank kasus.

## Struktur

| Bagian | Lokasi | Isi |
|---|---|---|
| Viewer | `src/viewer/cs.ts`, `src/pages/Practice.tsx` | volume lokal, scroll slice, window/level, zoom/geser, kuas & penghapus labelmap, urungkan, probe ADC relatif, capture |
| API | `api/index.py` | semua endpoint `/api/*` |
| Bank kasus | `pipeline/build_bank.py` → `public/cases/` + `server_data/` | citra untuk viewer; kunci jawaban disimpan di server dan tidak pernah dikirim sebelum submit |
| Model visi | `pipeline/kaggle/train_unet.py` | pelatihan U-Net 2.5D dan temuan terstruktur JSON per kasus |
| Penilaian | `sinaps/grading.py` | Dice, recall per lesi, galat volume, HD95, Dice fokus tersentuh → 5 jenis kesalahan; K6 benar bila Dice ≥ 0,6, semua fokus tersentuh, galat volume ≤ +25% |
| Adaptasi | `sinaps/bkt.py` | BKT, prasyarat antar-KC, pemilihan tingkat kesulitan |
| Tutor | `sinaps/tutor.py`, `sinaps/rag.py` | mode Sokratik / penjelasan / rujukan, fakta dikunci sebelum submit, jawaban bertahap (`/api/tutor/stream`, NDJSON), pemeriksa fakta berbasis aturan, pembatas laju (20/menit, 300/hari), log audit |
| Dasbor dosen | `src/pages/dosen/` | ringkasan kelas, peta penguasaan, lintasan BKT, kesalahan tersering, tugas, verifikasi kasus, audit tutor, ekspor CSV |
| Penyimpanan | `sinaps/db.py` | log belajar berpseudonim; NIM hanya disimpan sebagai hash |
| Akun & kelas | `sinaps/auth.py` | NIM/username + kata sandi (PBKDF2), token HMAC; dosen membuat kelas, mahasiswa bergabung dengan kode kelas |
| Modul belajar | `src/content/lessons.ts`, `src/pages/student/Belajar.tsx` | 6 modul per KC dengan contoh kasus interaktif dan kuis |

## Kompetensi (KC)

| KC | Yang dilatih | Dinilai otomatis |
|---|---|---|
| K1 | Mengenali sekuens | ya |
| K2 | Mendeteksi hiperintensitas DWI | ya |
| K3 | Restriksi sejati vs T2 shine-through (nilai ADC) | ya |
| K4 | Mengenali teritori arteri | belum (butuh registrasi atlas) |
| K5 | Memperkirakan usia lesi | belum (butuh label radiolog) |
| K6 | Mendelineasi seluruh lesi | ya |

K4 dan K5 tetap tampil di peta penguasaan dengan tanda "belum di MVP".

## Fitur

**Mahasiswa** (daftar dengan nama, NIM, kata sandi, jenjang, dan kode kelas dari dosen)
- Beranda: langkah berikutnya yang disarankan (modul atau latihan untuk KC terlemah), penguasaan BKT, tugas aktif, percobaan terakhir.
- Belajar: 6 modul (orientasi, K1, K2, K3, K6, pengantar K4/K5) berisi materi, contoh kasus interaktif dengan kunci jawaban, dan kuis.
  Kasus contoh (`sub-754`, `sub-1320`, `sub-652`) tidak dipakai di latihan bernilai.
- Latihan: siklus adaptif, latihan terarah per KC (`/latihan?kc=K3`), lanjut otomatis setelah memuat ulang, dan lewati kasus.
- Tugas, bank kasus (dengan tanda sudah dikerjakan), riwayat dan tinjau ulang (anotasi sendiri di atas kunci + prediksi model, percakapan tutor), profil dan ganti kata sandi.

**Dosen** (daftar dengan kode pendaftaran dosen `DOSEN_KEY`)
- Kelas: buat kelas, salin kode/tautan daftar, ganti kode, hapus.
- Ringkasan: mahasiswa aktif, rerata Dice, penguasaan rata-rata per KC, kesalahan tersering, aktivitas 14 hari, mahasiswa yang perlu perhatian, peta penguasaan.
- Detail mahasiswa: lintasan penguasaan, riwayat kasus (bisa ditinjau di atas citra), log tutor, modul, tugas, atur ulang kata sandi.
- Tugas berisi modul + kasus dengan tenggat dan matriks progres; verifikasi kasus (setujui/tandai/tolak; kasus yang ditolak keluar dari latihan); audit tutor; ekspor CSV.

Setiap dosen hanya melihat mahasiswa di kelasnya sendiri. Log belajar memakai pseudonim hash NIM; nama tampilan hanya ada di tabel akun.

## Data

SOOP, OpenNeuro ds004889 (CC0), diunduh dari S3 publik OpenNeuro oleh `pipeline/download_soop.py`
ke `data/soop/` (tidak masuk repo). Bank kasus berisi 36 subjek: 30 subjek tersebar merata pada
skala Rankin 0–6 (seed 42), ditambah subjek supaya setiap tingkat kesulitan punya minimal 10 kasus.
Subjek bank tidak pernah dipakai melatih U-Net.

## Hasil uji

| Uji | Skrip | Hasil |
|---|---|---|
| Morfologi 1.451 mask akut | `pipeline/mask_stats.py` | median 8,4 ml (IQR 1,7–34,5), 17% < 1 ml, 60% multifokal; batas tersil indeks kesulitan: −0,169 dan 0,774 |
| Aturan jenis kesalahan (672 anotasi sintetis, 36 subjek, 5-fold tingkat subjek) | `pipeline/eval_error_rules.py` | akurasi 97,8% (IK 95% 96,0–99,1); tanpa Dice fokus tersentuh 94,6% (91,8–97,0); 47,3% (40,6–53,7) bila hanya Dice |
| Segmentasi U-Net 2.5D (1.170 pasien latih, 30 epoch, T4 50 menit) pada 36 subjek bank | `pipeline/kaggle/train_unet.py` | Dice rerata 0,738 (IK 95% 0,645–0,813), median 0,816; recall per lesi 0,80; Dice 0,805 untuk lesi ≥ 5 ml (n=28) dan 0,503 untuk < 5 ml (n=8); hasil di `pipeline/results/unet25d/` |

Angka aturan jenis kesalahan berasal dari kesalahan sintetis, jadi dibaca sebagai batas atas.
U-Net tidak dijalankan di Vercel: mask prediksi untuk 36 kasus dihitung sekali di Kaggle, lalu
`build_bank.py` menyimpannya di `server_data/cases/<sub>.npz`. Bobot `unet25d.pt` (30 MB) tidak masuk repo.

## Deploy ke Vercel

1. Import repo ke Vercel (Root Directory dibiarkan kosong; framework Vite terdeteksi dari `vercel.json`).
2. Environment variables:
   - `OPENAI_API_KEY` — kunci API OpenAI untuk tutor. Tanpa ini tutor memakai templat deterministik berlabel "offline".
   - `OPENAI_MODEL` — opsional, bawaan `gpt-5.6-luna`.
   - `OPENAI_REASONING` — opsional, tingkat penalaran tutor (`none`, `low`, `medium`, ...), bawaan `low`.
   - `DATABASE_URL` — string koneksi Postgres. Untuk Supabase pakai *transaction pooler* (port 6543).
     Tanpa ini, Vercel memakai SQLite di `/tmp` yang terhapus saat fungsi dingin.
   - `DOSEN_KEY` — kode pendaftaran akun dosen.
   - `SINAPS_PEPPER` — garam hash pseudonim NIM.
   - `SINAPS_SECRET` — kunci tanda tangan token sesi (string acak panjang).
3. Deploy. Tabel dibuat otomatis saat permintaan pertama.

Data demo (2 dosen, 3 kelas, 20 mahasiswa fiktif dengan percobaan tersimulasi) bisa diisi ke basis
data yang ditunjuk `DATABASE_URL`:

```bash
python scripts/seed_demo.py           # akun: dosen demo.dosen & demo.dosen2, mahasiswa DEMO0001-DEMO0020, sandi sinaps-demo
python scripts/seed_demo.py --hapus   # hapus data demo
```

Anotasi demo dibuat dari mask ahli yang sengaja diganggu, jadi bukan hasil uji coba.

## Membangun ulang data dan model

```bash
cd pipeline
uv venv .venv && uv pip install --python .venv nibabel numpy scipy pandas requests scikit-image kaggle
.venv/Scripts/python download_soop.py masks
.venv/Scripts/python mask_stats.py
.venv/Scripts/python download_soop.py images --n-train 0
.venv/Scripts/kaggle kernels push -p kaggle --accelerator NvidiaTeslaT4   # latih U-Net di Kaggle GPU
.venv/Scripts/kaggle kernels output raphaeladikara/sinaps-unet25d-run3 -p kaggle_out
.venv/Scripts/python build_bank.py          # citra + kunci jawaban + prediksi model
.venv/Scripts/python eval_error_rules.py    # uji aturan jenis kesalahan
```

Setelah latih ulang, `update_model.py path/ke/sinaps_out.zip` mengganti prediksi di `server_data/`,
menyalin metrik ke `pipeline/results/unet25d/`, dan memperbarui tabel hasil di README; tambahkan
`--push` untuk commit dan push sehingga Vercel redeploy otomatis. Citra kasus tidak ditulis ulang.

## Lisensi data

Citra dan mask berasal dari dataset SOOP (OpenNeuro ds004889) berlisensi CC0.
