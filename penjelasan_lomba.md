# Penjelasan Lomba — Babak Final ICC 2026

Ringkasan dari `Ketentuan Final ICC 2026.pdf` (folder ini) dan pengumuman panitia di grup
peserta. Kalau ada yang ragu, PDF asli dan pengumuman panitia yang berlaku. Ketentuan
semifinal dan tema lomba ada di [`guide_lomba_semifinal.md`](guide_lomba_semifinal.md).

Tim **Rizzz** lolos Top 6 (dari 20 semifinalis). Karya: **SINAPS** (Sistem Interaktif
Neuroradiologi Adaptif untuk Pembelajaran Stroke). **Nilai semifinal tidak dibawa**: semua
finalis dinilai ulang dari nol.

---

## Jadwal

| Tanggal | Kegiatan | Catatan |
|---|---|---|
| 10 Okt 2026 | Pengumuman Top 6 | selesai |
| 10–23 Okt | Masa persiapan | Bab 4, Bab 5, MVP, presentasi |
| **Jum, 23 Okt 2026, 23.59 WIB** | **Batas pengumpulan karya ilmiah + link MVP** | terlambat = pengurangan poin |
| Sel, 27 Okt 2026 | Opening + Technical Meeting Final | **wajib hadir luring** di Unair; undian urutan tampil |
| Rab, 28 Okt 2026 | Presentasi final, awarding, closing | **wajib hadir luring** di Unair |

Tidak hadir tanpa alasan jelas = **gugur**. Minimal **2 anggota** hadir di Surabaya; absen
anggota hanya diterima karena force majeure. Rundown hari final diumumkan saat TM 27 Okt.

---

## Deliverable (paling lambat 23 Okt, 23.59 WIB)

### 1. Karya ilmiah lengkap Bab 1–5 — WAJIB

| Bab | Status | Isi |
|---|---|---|
| I Pendahuluan | revisi minor | latar belakang + rumusan masalah |
| II Tinjauan Pustaka | revisi minor | solusi yang ada + posisi solusi tim |
| III Metodologi | revisi minor | rancangan solusi AI + arsitektur teknis |
| **IV Hasil dan Pembahasan** | **BARU** | 1) Hasil Implementasi (tangkapan layar/output) · 2) Pengujian (pakai metrik Bab 3) · 3) Pembahasan (apakah menjawab rumusan masalah Bab 1) · 4) Keterbatasan (yang belum jalan/belum diuji) |
| **V Penutup** | **BARU** | 1) Kesimpulan (jawaban singkat RQ) · 2) Rencana Pengembangan · 3) Dampak bagi target pengguna |

- **Topik dan rumusan masalah wajib sama persis** dengan draf semifinal (RQ1–RQ3). Ganti topik = pelanggaran.
- Kekurangan di semifinal boleh dipakai untuk memperbaiki Bab 1–3.
- Format, nama dan urutan subbab mengikuti **template resmi panitia**.
- **Similarity Turnitin < 15%** (tidak termasuk kutipan & daftar pustaka), **laporan Turnitin dilampirkan**.
- **Pernyataan penggunaan AI** di lampiran (seperti di semifinal).
- File PDF: **`Rizzz_ICC2026_Final.pdf`**.

### 2. MVP + link source code — WAJIB

- Prototipe yang **benar-benar bisa dijalankan** (aplikasi/web/sistem/hardware), **sesuai Bab 3 dan Bab 4**.
- Kumpulkan **link GitHub** source code MVP.
- **Tidak boleh**: hanya desain/mockup, demo yang direkayasa seolah berjalan, demo yang berbeda dari isi karya ilmiah.
  Demo palsu = pelanggaran berat / diskualifikasi.
- Produk sederhana tidak masalah; juri menilai apakah MVP **membuktikan isi karya ilmiah**.

### 3. PPT / pitch deck — OPSIONAL

Tidak ada template panitia, tidak memengaruhi nilai. Pilihan: slide dulu lalu demo, langsung
demo, atau gabungan.

---

## Pengumpulan

Portal `campusdataweek.satudata.unair.ac.id` → Team Login (akun ketua) → unggah PDF karya
ilmiah → isi link GitHub MVP → Submit.

---

## Presentasi final (luring, Unair)

- **30 menit per tim**: 15 menit presentasi **termasuk demo** (tidak ada sesi demo terpisah) + 15 menit tanya jawab juri.
- Saran panitia: latih demo dari awal sampai akhir dan catat waktunya; bawa data contoh dan
  perangkat cadangan (internet/laptop bisa bermasalah); setiap anggota siap menjelaskan metode dan hasil.

---

## Bobot penilaian final

| Komponen | Bobot | Yang dilihat |
|---|---:|---|
| **Hasil dan Demo/Prototipe** | **30%** | MVP berjalan dan sesuai isi karya ilmiah |
| Kelengkapan & Konsistensi Karya Ilmiah | 20% | Bab 1–5 lengkap, sejalan dengan draf semifinal |
| Presentasi | 20% | kejelasan penyampaian 15 menit, termasuk demo |
| Tanya Jawab | 20% | kemampuan menjawab juri |
| Inovasi dan Dampak | 10% | kebaruan ide, manfaat untuk mahasiswa |

---

## Aturan yang tetap berlaku

Diskualifikasi untuk: plagiarisme, joki, kerja sama antartim, pemakaian AI di luar batas,
demo palsu.

## Checklist sebelum submit (dari panitia)

- [ ] Karya ilmiah lengkap Bab 1–5
- [ ] Topik masih sama dengan draf semifinal
- [ ] Format sesuai template panitia
- [ ] Similarity Turnitin < 15%, laporan terlampir
- [ ] Pernyataan penggunaan AI di lampiran
- [ ] MVP bisa dijalankan dan sesuai isi Bab 3 dan Bab 4
- [ ] Demo sudah dilatih, muat dalam 15 menit
- [ ] Semua file terunggah sebelum 23 Okt, 23.59 WIB

---

## Apa yang dijanjikan Bab 3 semifinal (jadi patokan MVP)

Dari `semi-final/paper/script/content.py` di repo lama (satudata2026rizzz). Juri akan mencocokkan demo dengan ini.

- **Rumusan masalah**: RQ1 umpan balik objektif atas segmentasi tanpa radiolog (modul
  penilaian), RQ2 tutor LLM dengan halusinasi terkendali (tutor berpijak fakta), RQ3 urutan
  kasus adaptif (BKT).
- **Arsitektur**: viewer web (Cornerstone3D) → orkestrator FastAPI → bank kasus, modul visi
  (segmentasi + temuan terstruktur JSON), modul penilaian, modul personalisasi (BKT) → tutor
  LLM (GPT-5.6 Luna) yang hanya menjelaskan fakta; plus dasbor dosen.
- **Siklus latihan**: sistem pilih kasus untuk KC terlemah → mahasiswa buka MRI, scroll,
  window/level, tandai lesi dengan kuas, jawab soal → dinilai otomatis terhadap lesion mask →
  tutor menjelaskan kesalahan → penguasaan KC diperbarui.
- **Fitur (Tabel fitur)**: viewer MRI interaktif, kuas anotasi, pertanyaan kasus, skor + jenis
  kesalahan, kasus adaptif, peta penguasaan KC, Capture, mode Sokratik/penjelasan/rujukan (RAG
  PNPK + SKDI).
- **Cakupan minimum yang sudah dikunci di tabel risiko**: siklus delineasi (K2, K6) + tutor;
  kunci jawaban dari mask dan ADC saja (K1, K2, K3, K6), tanpa label radiolog.
- **Tahap MVP (Okt 2026)** di paper: bank kasus SOOP, model segmentasi terlatih, modul
  penilaian, BKT, tutor LLM. nnU-Net disebut "rencana versi final"; baseline U-Net 2.5D sudah ada.

---

## Struktur repo

```
Satu Data Final/
├── README.md
├── Ketentuan Final ICC 2026.pdf   PPT ketentuan final dari panitia
├── penjelasan_lomba.md            file ini
├── guide_lomba_semifinal.md       ringkasan guidebook (tema, semifinal, hadiah, data SOOP)
├── paper/                         PDF draf semifinal Bab 1-3 (sumber lengkap di repo lama)
└── mvp/                           (belum ada) source code prototipe SINAPS
```
