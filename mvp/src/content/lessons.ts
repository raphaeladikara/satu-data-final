// Materi modul belajar SINAPS. Draf tim berdasarkan rujukan di corpus/, menunggu tinjauan dosen mitra.
export type Quiz = { tanya: string; opsi: string[]; benar: number; alasan: string };
export type Lesson = {
  id: string;
  kc: string | null; // KC yang dilatih setelah modul; null untuk orientasi
  judul: string;
  ringkas: string;
  menit: number;
  dinilai: boolean; // KC-nya sudah dinilai otomatis di MVP
  tujuan: string[];
  bagian: { judul: string; isi: string[]; poin?: string[]; tips?: string }[];
  contoh?: { case_id: string; catatan: string; seri?: string };
  kuis: Quiz[];
};

export const LESSONS: Lesson[] = [
  {
    id: 'orientasi',
    kc: null,
    judul: 'Orientasi: membaca MRI stroke di SINAPS',
    ringkas: 'Tiga sekuens yang dipakai, konvensi orientasi radiologis, dan cara memakai viewer.',
    menit: 6,
    dinilai: false,
    tujuan: [
      'Menyebut tiga sekuens MRI yang dipakai di bank kasus dan kegunaannya.',
      'Menerapkan konvensi orientasi radiologis saat menyebut hemisfer.',
      'Memakai viewer: menggulir slice, mengatur window/level, zoom, dan geser.',
    ],
    bagian: [
      {
        judul: 'Mengapa MRI difusi?',
        isi: [
          'Pada stroke iskemik akut, sel yang kekurangan energi membengkak (edema sitotoksik) sehingga gerak molekul air di jaringan itu terbatas. MRI difusi (DWI) peka terhadap perubahan ini dalam hitungan menit setelah onset, jauh lebih awal daripada CT.',
          'Setiap kasus di SINAPS berisi tiga sekuens dari dataset SOOP: DWI (TRACE, b = 1000), peta ADC, dan FLAIR. Ketiganya sudah diregistrasi ke ruang yang sama, jadi slice yang sama pada ketiga seri menunjukkan lokasi anatomi yang sama.',
        ],
        poin: [
          'DWI: mencari wilayah terang (hiperintens), kandidat infark akut.',
          'ADC: memastikan bahwa terangnya DWI memang karena restriksi difusi (wilayah itu gelap di ADC).',
          'FLAIR: anatomi lebih tajam, membantu menilai lesi lama dan usia lesi.',
        ],
      },
      {
        judul: 'Konvensi orientasi radiologis',
        isi: [
          'Citra aksial ditampilkan seolah-olah kita berdiri di kaki pasien dan melihat ke arah kepala. Akibatnya, sisi kanan pasien tampil di sisi kiri layar. Viewer SINAPS menandai sisi kanan pasien dengan huruf R di tepi kiri gambar.',
          'Kesalahan menyebut hemisfer adalah salah satu kesalahan paling sering pada pemula. Biasakan membaca penanda R/L sebelum menjawab.',
        ],
        tips: 'Lesi yang tampak di sisi kanan layar berada di hemisfer KIRI pasien.',
      },
      {
        judul: 'Memakai viewer',
        isi: ['Semua alat bisa dipakai dengan tetikus maupun papan ketik.'],
        poin: [
          'Roda tetikus: pindah slice. Seret kiri (mode W/L, tombol N): mengatur kecerahan dan kontras.',
          'Seret kanan: zoom. Seret tengah: geser. Tombol R: kembalikan tampilan.',
          'Tombol 1, 2, 3: pindah seri. B: kuas, E: penghapus, T: titik, Ctrl+Z: urungkan.',
          'Capture: melampirkan slice yang sedang tampil saat bertanya kepada tutor.',
        ],
      },
      {
        judul: 'Siklus latihan',
        isi: [
          'Di menu Latihan, sistem memilih kasus untuk kompetensi (KC) terlemahmu. Kamu mengenali sekuens (K1), menemukan lesi (K2), menilai restriksi (K3), lalu menandai seluruh lesi dengan kuas (K6). Setelah jawaban dikirim, sistem menilainya terhadap lesion mask buatan ahli, tutor menjelaskan kesalahanmu dari fakta yang terukur, dan peluang penguasaan setiap KC diperbarui.',
          'Kunci jawaban dan tutor penjelasan baru terbuka setelah jawaban dikirim. Sebelum itu, tutor hanya membimbing cara membaca (mode Sokratik).',
        ],
      },
    ],
    contoh: { case_id: 'sub-754', catatan: 'Coba gulir slice dan pindah seri. Perhatikan penanda R di kiri gambar.' },
    kuis: [
      {
        tanya: 'Lesi tampak di sisi kanan layar pada citra aksial. Hemisfer pasien yang terkena adalah…',
        opsi: ['Kanan', 'Kiri', 'Tidak bisa ditentukan tanpa CT'],
        benar: 1,
        alasan: 'Konvensi radiologis menampilkan sisi kiri pasien di sisi kanan layar.',
      },
      {
        tanya: 'Sekuens mana yang paling awal menunjukkan infark iskemik akut?',
        opsi: ['FLAIR', 'DWI', 'T1'],
        benar: 1,
        alasan: 'DWI peka terhadap restriksi difusi akibat edema sitotoksik dalam hitungan menit setelah onset.',
      },
      {
        tanya: 'Apa fungsi peta ADC dalam membaca stroke akut?',
        opsi: [
          'Memastikan bahwa terangnya DWI disebabkan restriksi difusi',
          'Menentukan teritori arteri',
          'Mengukur volume perdarahan',
        ],
        benar: 0,
        alasan: 'Infark akut terang di DWI dan gelap di ADC. Terang di DWI tanpa ADC rendah bisa berupa T2 shine-through.',
      },
    ],
  },
  {
    id: 'k1',
    kc: 'K1',
    judul: 'K1 · Mengenali sekuens',
    ringkas: 'Membedakan DWI, ADC, dan FLAIR dari tampilannya, tanpa melihat label.',
    menit: 7,
    dinilai: true,
    tujuan: [
      'Membedakan DWI, ADC, dan FLAIR dari sinyal cairan serebrospinal (CSS) dan jaringan.',
      'Menjelaskan mengapa ketiga sekuens dibaca bersama.',
    ],
    bagian: [
      {
        judul: 'Petunjuk tercepat: lihat ventrikel',
        isi: [
          'Air bebas di ventrikel dan sulkus bergerak leluasa. Karena itu CSS terang pada peta ADC dan gelap pada DWI b1000. FLAIR sengaja menekan sinyal cairan bebas, sehingga CSS juga gelap di FLAIR.',
        ],
        poin: [
          'CSS terang → peta ADC.',
          'CSS gelap, citra agak kabur dan berbintik, kontras substansia abu-abu/putih rendah → DWI.',
          'CSS gelap, anatomi tajam, batas substansia abu-abu/putih jelas → FLAIR.',
        ],
      },
      {
        judul: 'Membedakan DWI dan FLAIR',
        isi: [
          'Keduanya membuat CSS gelap, jadi petunjuk ventrikel saja tidak cukup. DWI direkam cepat dengan resolusi lebih rendah, sehingga tampak lebih kasar dan sering memuat artefak terang di dasar tengkorak, dekat sinus, dan lobus temporal bawah. FLAIR beresolusi lebih tinggi dan memperlihatkan girus serta hiperintensitas substansia putih lama dengan jelas.',
          'Pada kasus stroke akut, lesi tampak paling mencolok di DWI. Di FLAIR, lesi akut sering belum tampak atau masih samar.',
        ],
      },
      {
        judul: 'Di SINAPS',
        isi: [
          'Urutan seri A, B, C diacak untuk setiap percobaan. Buka ketiganya (tombol 1, 2, 3), tentukan sekuensnya, lalu kunci jawaban K1. Setelah dikunci, label seri berubah menjadi nama sekuens sehingga langkah K2 sampai K6 lebih mudah.',
        ],
        tips: 'Jawaban K1 dinilai benar hanya bila ketiga seri tepat.',
      },
    ],
    contoh: { case_id: 'sub-754', catatan: 'Bandingkan ventrikel di ketiga seri. Di seri mana CSS tampak terang?' },
    kuis: [
      {
        tanya: 'Pada sebuah seri, ventrikel tampak terang dan lesi infark tampak gelap. Seri itu adalah…',
        opsi: ['DWI', 'Peta ADC', 'FLAIR'],
        benar: 1,
        alasan: 'Peta ADC menggambarkan besarnya difusi: air bebas di ventrikel terang, infark akut yang terestriksi gelap.',
      },
      {
        tanya: 'Dua seri sama-sama memperlihatkan ventrikel gelap. Ciri yang paling membantu memilih FLAIR adalah…',
        opsi: ['Anatomi girus dan batas substansia abu-abu/putih tajam', 'Lesi akut paling terang', 'Artefak terang di dasar tengkorak'],
        benar: 0,
        alasan: 'FLAIR beresolusi lebih tinggi. Lesi akut paling terang dan artefak dasar tengkorak justru ciri DWI.',
      },
      {
        tanya: 'Mengapa FLAIR membuat CSS gelap?',
        opsi: ['Karena CSS tidak mengandung air', 'Karena sinyal cairan bebas sengaja ditekan', 'Karena CSS berdifusi lambat'],
        benar: 1,
        alasan: 'FLAIR (fluid-attenuated inversion recovery) memakai pulsa inversi untuk menekan sinyal cairan bebas.',
      },
    ],
  },
  {
    id: 'k2',
    kc: 'K2',
    judul: 'K2 · Mendeteksi hiperintensitas DWI',
    ringkas: 'Mencari lesi akut secara sistematis dan menentukan hemisfernya.',
    menit: 8,
    dinilai: true,
    tujuan: [
      'Menggulir seluruh slice secara sistematis untuk menemukan hiperintensitas DWI.',
      'Membedakan lesi dari artefak dan menentukan hemisfer dengan benar.',
    ],
    bagian: [
      {
        judul: 'Baca seluruh volume, bukan satu slice',
        isi: [
          'Dari 1.451 lesion mask akut di SOOP, median volumenya 8,4 ml, 17% lebih kecil dari 1 ml, dan 60% terdiri atas lebih dari satu fokus. Artinya, lesi sering kecil dan tersebar. Berhenti setelah menemukan lesi pertama adalah sumber kesalahan yang paling umum.',
        ],
        poin: [
          'Mulai dari slice paling bawah, gulir perlahan sampai paling atas.',
          'Bandingkan kiri dan kanan pada setiap slice: hiperintensitas yang asimetris patut dicurigai.',
          'Setelah menemukan lesi, gulir sekali lagi dan periksa hemisfer yang lain.',
        ],
      },
      {
        judul: 'Lesi atau artefak?',
        isi: [
          'DWI rentan terhadap artefak suseptibilitas di dekat udara dan tulang: dasar lobus frontal, lobus temporal bawah, dan fossa posterior. Artefak ini terang tetapi biasanya simetris, mengikuti batas tulang atau sinus, dan tidak gelap di ADC.',
          'Hiperintensitas yang sejati mengikuti bentuk jaringan otak (korteks, substansia putih, ganglia basal) dan terlihat pada beberapa slice berurutan.',
        ],
      },
      {
        judul: 'Menjawab K2 di SINAPS',
        isi: [
          'Pilih alat Titik (T) dan klik satu titik di dalam lesi akut, lalu pilih hemisfer: kiri, kanan, atau bilateral bila ada lesi di kedua sisi. K2 benar bila titik jatuh di dalam lesion mask dan hemisfernya tepat.',
        ],
        tips: 'Jawaban "bilateral" hanya tepat bila lesi akut memang ada di kedua hemisfer.',
      },
    ],
    contoh: { case_id: 'sub-754', catatan: 'Tampilkan kunci jawaban, lalu gulir slice 5 sampai 14. Lesi berada di hemisfer kanan pasien (sisi kiri layar).', seri: 'DWI' },
    kuis: [
      {
        tanya: 'Kamu menemukan satu lesi besar di slice 12. Langkah berikutnya yang paling tepat adalah…',
        opsi: ['Langsung mengirim jawaban', 'Menggulir seluruh slice lagi dan memeriksa hemisfer lain', 'Memperbesar kontras sampai lesi tampak lebih luas'],
        benar: 1,
        alasan: 'Sebagian besar lesi stroke multifokal. Fokus kecil mudah terlewat padahal penting untuk penalaran etiologi.',
      },
      {
        tanya: 'Hiperintensitas DWI simetris di lobus temporal bawah, dekat tulang, dan tidak gelap di ADC paling mungkin…',
        opsi: ['Infark bilateral', 'Artefak suseptibilitas', 'Perdarahan akut'],
        benar: 1,
        alasan: 'Artefak suseptibilitas muncul dekat udara/tulang, sering simetris, dan tidak disertai ADC rendah.',
      },
      {
        tanya: 'Lesi tampak di sisi kiri layar dengan penanda R di kiri. Jawaban hemisfernya…',
        opsi: ['Kiri', 'Kanan', 'Bilateral'],
        benar: 1,
        alasan: 'Penanda R menunjukkan sisi kanan pasien, jadi lesi di sisi kiri layar berada di hemisfer kanan.',
      },
    ],
  },
  {
    id: 'k3',
    kc: 'K3',
    judul: 'K3 · Restriksi sejati vs T2 shine-through',
    ringkas: 'Memakai ADC relatif untuk memastikan bahwa hiperintensitas DWI benar-benar restriksi difusi.',
    menit: 8,
    dinilai: true,
    tujuan: [
      'Menjelaskan perbedaan restriksi difusi sejati dan T2 shine-through.',
      'Membaca ADC relatif lesi dan memilih rentangnya.',
    ],
    bagian: [
      {
        judul: 'Terang di DWI belum tentu infark akut',
        isi: [
          'Citra DWI juga mengandung bobot T2. Jaringan dengan T2 panjang, misalnya lesi lama, gliosis, atau edema vasogenik, bisa tampak terang di DWI walaupun difusinya tidak terbatas. Fenomena ini disebut T2 shine-through.',
          'Pembedanya adalah peta ADC pada slice yang sama. Restriksi sejati: terang di DWI dan gelap di ADC. T2 shine-through: terang di DWI, tetapi ADC normal atau bahkan tinggi.',
        ],
      },
      {
        judul: 'ADC relatif',
        isi: [
          'Nilai ADC mentah berbeda antarpemindai dan antarprotokol. SINAPS memakai ADC relatif (rADC): median ADC di lesi dibagi median ADC jaringan otak pasien yang sama. Pada seri ADC, angka di kiri bawah viewer sudah menampilkan rADC di bawah kursor.',
        ],
        poin: [
          'rADC < 0,6: restriksi kuat.',
          '0,6–0,8: restriksi; batas yang dipakai modul penilaian SINAPS adalah 0,8.',
          '0,8–1,0: mendekati normal; pertimbangkan pseudonormalisasi atau shine-through.',
          '> 1,0: lebih tinggi dari jaringan normal; bukan restriksi.',
        ],
      },
      {
        judul: 'Pseudonormalisasi',
        isi: [
          'ADC infark turun pada fase akut, lalu naik kembali menuju normal dalam beberapa hari sampai minggu walaupun jaringan sudah rusak. Lesi subakut bisa tetap terang di DWI dengan rADC mendekati 1. Karena itu, rADC juga memberi petunjuk tentang usia lesi.',
        ],
        tips: 'K3 dinilai dari dua bagian: rentang rADC dan keputusan restriksi sejati atau shine-through. Keduanya harus tepat.',
      },
    ],
    contoh: { case_id: 'sub-1320', catatan: 'Kasus ini terang di DWI tetapi rADC lesinya 1,49. Bandingkan dengan sub-754 di modul K1 yang rADC-nya 0,56.', seri: 'ADC' },
    kuis: [
      {
        tanya: 'Lesi terang di DWI dengan rADC 0,52. Kesimpulannya…',
        opsi: ['Restriksi difusi sejati', 'T2 shine-through', 'Artefak'],
        benar: 0,
        alasan: 'rADC jauh di bawah 0,8 berarti difusi terbatas, sesuai infark akut.',
      },
      {
        tanya: 'Lesi terang di DWI dengan rADC 1,3. Kesimpulannya…',
        opsi: ['Restriksi difusi sejati', 'T2 shine-through', 'Infark hiperakut'],
        benar: 1,
        alasan: 'ADC lebih tinggi dari jaringan normal; terangnya DWI berasal dari bobot T2.',
      },
      {
        tanya: 'Mengapa SINAPS memakai ADC relatif, bukan ADC mentah?',
        opsi: ['Supaya angka lebih besar', 'Karena nilai ADC mentah berbeda antarpemindai', 'Karena ADC mentah tidak tersedia di SOOP'],
        benar: 1,
        alasan: 'Normalisasi terhadap jaringan otak pasien yang sama membuat ambang bisa dipakai lintas pemindai.',
      },
      {
        tanya: 'Infark berusia sekitar dua minggu terang di DWI dengan rADC 0,95. Fenomena ini disebut…',
        opsi: ['Pseudonormalisasi', 'Restriksi hiperakut', 'Efek volume parsial'],
        benar: 0,
        alasan: 'ADC infark naik kembali menuju normal pada fase subakut walaupun jaringan sudah rusak.',
      },
    ],
  },
  {
    id: 'k6',
    kc: 'K6',
    judul: 'K6 · Mendelineasi seluruh lesi',
    ringkas: 'Menandai semua fokus lesi dengan kuas dan memahami empat metrik penilaian.',
    menit: 9,
    dinilai: true,
    tujuan: [
      'Menandai seluruh fokus lesi akut pada setiap slice dengan batas yang tepat.',
      'Membaca Dice, recall per lesi, galat volume, dan HD95 beserta jenis kesalahannya.',
    ],
    bagian: [
      {
        judul: 'Apa yang ditandai',
        isi: [
          'Tandai wilayah yang terang di DWI dan gelap di ADC. Tepi yang hanya sedikit lebih terang di DWI dengan ADC normal biasanya bukan inti infark; ikut menandainya membuat delineasi terlalu luas. Sebaliknya, hanya menandai pusat lesi yang paling terang membuat delineasi terlalu sempit.',
        ],
        poin: [
          'Tandai pada setiap slice tempat lesi tampak, bukan hanya slice terbesar.',
          'Kecilkan kuas (1–3 mm) untuk fokus kecil dan tepi lesi.',
          'Pakai penghapus (E) atau Ctrl+Z untuk merapikan.',
        ],
      },
      {
        judul: 'Empat metrik, bukan hanya Dice',
        isi: [
          'Dice mengukur tumpang tindih tandaanmu dengan kunci (0 sampai 1). Pada lesi multifokal, Dice didominasi lesi terbesar: melewatkan fokus kecil hampir tidak menurunkan Dice. Karena itu SINAPS juga menghitung recall per lesi (proporsi fokus yang tersentuh), galat volume relatif, dan HD95 (jarak permukaan persentil ke-95, dalam mm).',
          'Keempat metrik dipetakan ke lima jenis kesalahan: hampir benar, terlalu luas, terlalu sempit, lesi kecil terlewat, dan salah lokasi. K6 dinilai benar bila Dice ≥ 0,6, semua fokus tersentuh, dan volume tandaan tidak lebih dari 25% di atas kunci.',
        ],
      },
      {
        judul: 'Setelah dinilai',
        isi: [
          'Overlay hijau menunjukkan kunci jawaban (mask ahli), oranye tandaanmu, dan biru prediksi model U-Net sebagai pembaca kedua. Tombol "Fokus yang terlewat" melompat langsung ke slice fokus yang belum kamu tandai. Penilaian selalu memakai mask ahli, tidak pernah prediksi model.',
        ],
      },
    ],
    contoh: { case_id: 'sub-652', catatan: 'Kasus dengan tiga fokus. Tampilkan kunci jawaban dan cari ketiga fokusnya.', seri: 'DWI' },
    kuis: [
      {
        tanya: 'Delineasimu Dice 0,82 tetapi satu dari tiga fokus terlewat. Penilaian K6-nya…',
        opsi: ['Benar, karena Dice tinggi', 'Belum tepat, karena tidak semua fokus tersentuh', 'Tidak dinilai'],
        benar: 1,
        alasan: 'K6 menuntut Dice ≥ 0,6, recall per lesi 100%, dan galat volume paling banyak +25%. Fokus kecil penting untuk penalaran etiologi.',
      },
      {
        tanya: 'Tandaanmu meliputi lesi dan tepi yang ADC-nya normal. Jenis kesalahan yang paling mungkin…',
        opsi: ['Terlalu sempit', 'Terlalu luas', 'Salah lokasi'],
        benar: 1,
        alasan: 'Ikut menandai tepi atau edema membuat volume tandaan melebihi kunci.',
      },
      {
        tanya: 'Mengapa Dice saja tidak cukup untuk lesi multifokal?',
        opsi: ['Dice tidak bisa dihitung untuk lebih dari satu lesi', 'Dice didominasi lesi terbesar', 'Dice selalu bernilai 1'],
        benar: 1,
        alasan: 'Fokus kecil menyumbang sedikit voxel, jadi melewatkannya hampir tidak mengubah Dice.',
      },
    ],
  },
  {
    id: 'k4k5',
    kc: null,
    judul: 'K4 & K5 · Teritori arteri dan usia lesi (pengantar)',
    ringkas: 'Konsep dasar teritori vaskular dan ketidaksesuaian DWI-FLAIR. Belum dinilai otomatis di MVP.',
    menit: 6,
    dinilai: false,
    tujuan: [
      'Menyebut teritori arteri serebri utama dan pola lesi yang khas.',
      'Menjelaskan arti ketidaksesuaian DWI-FLAIR untuk memperkirakan onset.',
    ],
    bagian: [
      {
        judul: 'Teritori arteri (K4)',
        isi: [
          'Arteri serebri media (MCA) memperdarahi sebagian besar permukaan lateral hemisfer dan, melalui cabang lentikulostriata, ganglia basal serta kapsula interna. Arteri serebri anterior (ACA) memperdarahi permukaan medial lobus frontal dan parietal. Arteri serebri posterior (PCA) memperdarahi lobus oksipital, temporal medial-inferior, dan talamus. Sirkulasi posterior juga mencakup batang otak dan serebelum.',
          'Lesi di beberapa teritori sekaligus atau di kedua hemisfer mengarah ke sumber emboli proksimal, misalnya kardioemboli. Infark kecil di substansia putih dalam atau ganglia basal (lakunar) mengarah ke penyakit pembuluh darah kecil.',
        ],
        tips: 'Di versi pilot, kunci K4 berasal dari registrasi citra ke atlas teritori arteri yang diperiksa radiolog. Tutor tidak akan menebak teritori tanpa data itu.',
      },
      {
        judul: 'Usia lesi (K5)',
        isi: [
          'Lesi yang tampak di DWI tetapi belum jelas di FLAIR (ketidaksesuaian DWI-FLAIR) mengisyaratkan onset kurang dari sekitar 4,5 jam (Thomalla dkk., Lancet Neurol 2011). Temuan ini dipakai, misalnya, pada pasien dengan waktu onset tidak diketahui.',
          'Seiring waktu lesi menjadi terang di FLAIR dan ADC-nya naik kembali (pseudonormalisasi, lihat modul K3).',
        ],
        tips: 'K5 butuh label radiolog dan akan dinilai pada tahap pilot.',
      },
    ],
    kuis: [
      {
        tanya: 'Lesi akut terang di DWI dan belum tampak di FLAIR mengisyaratkan…',
        opsi: ['Onset kurang dari sekitar 4,5 jam', 'Lesi lama lebih dari satu bulan', 'T2 shine-through'],
        benar: 0,
        alasan: 'Ketidaksesuaian DWI-FLAIR adalah penanda onset dini (Thomalla dkk., 2011).',
      },
      {
        tanya: 'Infark kecil di kedua hemisfer dan beberapa teritori sekaligus paling mengarah ke…',
        opsi: ['Penyakit pembuluh darah kecil', 'Sumber emboli proksimal (mis. kardioemboli)', 'Artefak'],
        benar: 1,
        alasan: 'Lesi multiteritori atau bilateral khas untuk emboli dari sumber proksimal.',
      },
      {
        tanya: 'Lobus oksipital diperdarahi terutama oleh…',
        opsi: ['Arteri serebri anterior', 'Arteri serebri media', 'Arteri serebri posterior'],
        benar: 2,
        alasan: 'PCA memperdarahi lobus oksipital, temporal medial-inferior, dan talamus.',
      },
    ],
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
export const PASS = 2 / 3;
