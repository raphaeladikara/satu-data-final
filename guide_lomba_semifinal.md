# Guide Lomba — Innovation Case Competition (ICC) CDW 2026

Ringkasan dari `GUIDEBOOK CDW 2026 - INNOVATION CASE COMPETITION.pdf`. Kalau ada yang
ragu, guidebook asli dan pengumuman panitia yang berlaku.

Penyelenggara: PUSAKA (Pusat Satu Data dan Kecerdasan Digital) Universitas Airlangga
Web: campusdataweek.satudata.unair.ac.id · Email: pusaka@mail.unair.ac.id · IG: @satudata.unair

---

## Tema

> **"Improving Student's Learning Experience in Indonesia Through AI Innovation"**
> Meningkatkan pengalaman belajar mahasiswa di Indonesia melalui inovasi kecerdasan buatan.

Sub-fokus bebas selama relevan, contoh dari guidebook: personalisasi pembelajaran, asisten
belajar cerdas, aksesibilitas materi, asesmen otomatis, deteksi mahasiswa berisiko (early
warning), optimalisasi pengalaman belajar lainnya.

---

## Jadwal sisa

| Kegiatan | Tanggal | Kanal |
|---|---|---|
| **Pengumpulan draf karya ilmiah Bab 1–3 (Semifinal)** | **30 September 2026** | Team Dashboard |
| Pengumuman finalis (Top 6) | 10 Oktober 2026 | Kanal resmi |
| Pengumpulan karya ilmiah lengkap + demo (Final) | 23 Oktober 2026 | Team Dashboard |
| Opening & Technical Meeting Final | 27 Oktober 2026 | Luring, Unair |
| Babak Final (presentasi) | 28 Oktober 2026 | Luring, Unair |
| Awarding & Closing | 28 Oktober 2026, 14.00 | Luring, Unair |

Draf yang lewat batas akhir **tidak dinilai**, tanpa toleransi atau perpanjangan.

---

## Babak Semifinal — draf karya ilmiah (daring, tanpa presentasi)

Isi draf:

- **Bab 1 — Pendahuluan:** latar belakang dan rumusan masalah sesuai tema ICC.
- **Bab 2 — Tinjauan Pustaka:** kajian solusi/penelitian yang sudah ada + posisi solusi
  tim terhadap solusi tersebut.
- **Bab 3 — Metodologi:** rancangan solusi berbasis AI, arsitektur teknis, rencana implementasi.

Ketentuan:

- Format (halaman maks, font, margin, gaya sitasi) mengikuti **templat resmi panitia**, dibagikan
  saat Technical Meeting Semifinal (13 Sept). **Templat belum ada di folder ini — cek grup / dashboard.**
- File **PDF**, nama: `[NamaTim]_ICC2026_Semifinal` (mis. `Rizzz_ICC2026_Semifinal.pdf`).
- Dikumpulkan lewat platform pendaftaran resmi ICC.
- Top 6 lolos final. Skor semifinal **tidak** dibawa ke final.

### Bobot penilaian semifinal

| Komponen | Bobot |
|---|---:|
| Urgensi dan Rumusan Masalah | 20% |
| Tinjauan Pustaka dan Positioning | 25% |
| **Metodologi dan Kelayakan Teknis** | **35%** |
| Sistematika Penulisan dan Orisinalitas | 20% |

---

## Babak Final — karya lengkap + demo (luring di Unair, Surabaya)

- Tambah **Bab 4 — Hasil dan Pembahasan** (hasil implementasi/prototipe) dan
  **Bab 5 — Penutup** (kesimpulan + rencana pengembangan).
- **Demo wajib working prototype (MVP)**, bukan mockup/rancangan visual, dan harus sesuai
  metodologi + hasil di karya ilmiah. Boleh produk digital atau hardware.
- Presentasi **15 menit (demo termasuk di dalamnya)** + **15 menit tanya jawab**. Urutan diundi saat TM Final.
- Wajib hadir luring di Opening, TM Final, dan sesi presentasi. Absen tanpa alasan = gugur.
- **Topik & rumusan masalah wajib konsisten dengan draf semifinal.** Revisi minor boleh,
  ganti topik = pelanggaran.

### Bobot penilaian final

| Komponen | Bobot |
|---|---:|
| Kelengkapan dan Konsistensi Karya Ilmiah | 20% |
| **Hasil dan Demo/Prototipe** | **30%** |
| Presentasi | 20% |
| Tanya Jawab | 20% |
| Inovasi dan Dampak | 10% |

---

## Hadiah

| Penghargaan | Hadiah |
|---|---|
| Juara 1 | Rp 7.500.000 + e-sertifikat + merchandise |
| Juara 2 | Rp 5.000.000 + e-sertifikat + merchandise |
| Juara 3 | Rp 3.000.000 + e-sertifikat + merchandise |
| Harapan 1 | Rp 1.500.000 + e-sertifikat + merchandise |
| Harapan 2 | Rp 1.200.000 + e-sertifikat + merchandise |
| Harapan 3 | Rp 800.000 + e-sertifikat + merchandise |
| Finalis (Top 6) | e-sertifikat finalis + merchandise |
| Semifinalis | e-sertifikat semifinalis |

Catatan hak cipta: karya tetap milik peserta, tapi panitia dapat lisensi non-eksklusif,
royalty-free, tanpa batas waktu untuk memakai/mempublikasikan karya.

---

## Data yang tersedia di `data/` (tidak di-commit)

OpenNeuro **ds004889 — Stroke Outcome Optimization Project (SOOP)**, lisensi CC0.
Sumber: https://openneuro.org/datasets/ds004889 · Total asli ±72 GB, 1.505 subjek.

| Isi | Keterangan |
|---|---|
| `participants.tsv` | 1.505 baris: sex, age, race, acuteischaemicstroke, priorstroke, bmi, nihss, gs_rankin_6isdeath, etiology |
| `derivatives/lesion_masks/` | semua lesion mask (1.456 subjek, 14 MB) |
| `sub-*/` | sampel 30 subjek (T1w, FLAIR, ADC, TRACE), ±1,8 GB |
| `sample_subjects.txt` | daftar 30 subjek sampel (punya mask + NIHSS + Rankin, sebar merata Rankin 0–6, seed 42) |

Kelengkapan kolom klinis (dari 1.505 subjek): data demografi/NIHSS ada di 1.106 subjek,
Rankin saat pulang ada di 738 subjek, etiologi ada di 1.080 subjek.
