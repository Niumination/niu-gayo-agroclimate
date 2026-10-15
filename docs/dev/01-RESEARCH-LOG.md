# Log Riset Pengembangan Multi-Hazard — 10 Iterasi

Dokumen hidup. Setiap iterasi = (a) pertanyaan riset, (b) temuan + sumber, (c) keputusan/dampak ke PRD, Roadmap, Data Sources, Arsitektur, Threshold.
Tanggal: 2026-10-14 (WIB). Semua tautan diperiksa pada tanggal tersebut; endpoint yang ditandai **[diuji langsung]** dipanggil dari sandbox dan mengembalikan data valid.

Legenda status keputusan: ✅ diadopsi · 🔶 kandidat (perlu validasi) · ❌ ditolak

---

## Iterasi 1 — Situasi kabut asap saat ini & sumber data asap/kualitas udara

### Pertanyaan
1. Apa yang sedang terjadi di Aceh Tengah (Okt 2026) dan dari mana asapnya?
2. Sumber data apa yang tersedia *gratis, publik, dapat diotomasi* untuk hotspot, sebaran asap, dan PM2.5?
3. Standar indeks apa yang harus dipakai (ISPU vs AQI US)?

### Temuan
**Situasi (14 Okt 2026):**
- BMKG (citra sebaran asap pukul 16.00 WIB) memperingatkan asap karhutla meluas ke **10 kabupaten/kota Aceh**, termasuk **Aceh Tengah dan Bener Meriah**, terutama Aceh bagian tengah, timur-tenggara, dan selatan; hanya **1 hotspot lokal** terdeteksi (Muara Satu, Lhokseumawe) → asap bersifat **transboundary/kiriman** dari selatan Sumatera & Kalimantan ([Waspada Aceh](https://waspadaaceh.com/sebaran-asap-karhutla-meluas-ke-aceh-10-kabupaten-kota-berpotensi-terdampak/)).
- Stamet Malikussaleh: asap terdeteksi satelit **Himawari**, pergerakan angin timur–tenggara; hotspot terbanyak di Kalteng, Kalsel, Sumsel; imbauan masker & kurangi aktivitas luar ruang ([Metro24](https://www.metro24.co/sebaran-asap-terdeteksi-menyelimuti-aceh/)).
- Medan: ISPU 116 (Tidak Sehat), polutan dominan PM2.5 ([Waspada Aceh](https://waspadaaceh.com/kabut-asap-selimuti-medan-kualitas-udara-masuk-kategori-tidak-sehat/)). Maluku Tengah meliburkan sekolah 3 hari ([Kompas](https://regional.kompas.com/read/2026/10/14/154947278/dampak-kabut-asap-kahurtla-sekolah-di-maluku-tengah-diliburkan-siswa)) → preseden kebijakan berbasis ambang.
- BMKG memprakirakan hujan sedang–lebat di sejumlah wilayah Aceh hingga **20 Okt 2026** → peluang *wash-out* asap; sekaligus risiko longsor (bahaya **majemuk**: asap + hujan lebat bersamaan).

**Sumber data (diuji):**
- **Open-Meteo Air Quality API** (CAMS global 0,4° ≈ 45 km, 3-jam-an, forecast 5 hari; gratis non-komersial 10.000 call/hari) — variabel `pm2_5, pm10, carbon_monoxide, aerosol_optical_depth, dust, us_aqi, european_aqi` ([dokumentasi](https://open-meteo.com/en/docs/air-quality-api); batas kuota via [ringkasan Fibric](https://www.fibric.io/integrations/c/sg-open-meteo-air-quality)). **[diuji langsung]** Takengon 2026-10-14 19:00 WIB: PM2.5 = 17,1 µg/m³, PM10 = 17,2, CO = 401 µg/m³, **AOD = 1,06** (tinggi → kolom asap tebal di atas), US AQI 63.
  - ⚠️ Insight: PM2.5 permukaan CAMS **moderat** tetapi AOD **tinggi** → di topografi pegunungan 1.200 mdpl, model 45 km bisa *under-estimate* permukaan; AOD + CO harus dipakai sebagai indikator pendamping, dan laporan warga (jarak pandang) sebagai validasi.
- **NASA FIRMS Area API** — hotspot VIIRS S-NPP/NOAA-20/NOAA-21 375 m & MODIS 1 km, NRT, CSV per bounding box/tanggal; butuh **MAP_KEY gratis** (5.000 transaksi/10 menit) ([FIRMS API](https://firms.modaps.eosdis.nasa.gov/api/), [ringkasan](https://wildapis.com/api/nasa-firms/)). **[diuji langsung]** tanpa kunci → `Invalid MAP_KEY` (konfirmasi perlu registrasi).
- **SiPongi KLHK** (sipongi.menlhk.go.id) — rujukan resmi nasional karhutla; hotspot 4 satelit + status lahan sampai level desa, disinkronkan tiap 30 menit; unduhan XLSX/TXT/KMZ via UI, **tidak ada API publik terdokumentasi** ([BPBD Nganjuk](https://bpbd.nganjukkab.go.id/berita/detail-berita/23), [Lintasbumi](https://lintasbumi.com/2022/06/14/cara-download-lokasi-titik-api-terbaru-hot-spot-kebakaran-lahan-dan-hutan/)) → pakai sebagai *rujukan atribusi*, bukan sumber mesin.
- **ISPU KLH** (ispu.kemenlh.go.id) — stasiun AQMS resmi; **tidak ada stasiun di Aceh Tengah** (terdekat kemungkinan Banda Aceh/Lhokseumawe/Medan) → nilai ISPU lokal harus **dihitung sendiri dari PM2.5 model/sensor** dengan rumus Permen LHK P.14/2020 dan diberi label "estimasi".
- **Standar ISPU (Permen LHK P.14/2020)** — 5 kategori: Baik 0–50 (hijau), Sedang 51–100 (biru), Tidak Sehat 101–200 (kuning), Sangat Tidak Sehat 201–300 (merah), Berbahaya >300 (hitam); batas PM2.5 24 jam: 0–15,4 / 15,5–55,4 / 55,5–150,4 / 150,5–250,4 / >250,5 µg/m³; rumus interpolasi linier `I = ((Ib−Ia)/(Xb−Xa))·(X−Xa)+Ia` ([ISPU Singkawang](https://ispu.singkawangkota.go.id/), [ISPU KLH](https://ispu.kemenlh.go.id/kawasan/)).
  - ⚠️ AQI US ≠ ISPU — jangan dicampur dalam UI ([LDII Sampit](https://www.ldiisampit.or.id/2026/10/asap-menebal-di-sampit-waspada-ispa-aqi.html)); tampilkan **ISPU** sebagai indeks utama, AQI US hanya di detail.

### Keputusan
- ✅ **Modul H-ASAP (Kabut Asap & Kualitas Udara)** menjadi prioritas #1 roadmap (Fase 1).
- ✅ Sumber primer PM2.5: Open-Meteo AQ (CAMS) per 15 lokasi; indikator pendamping AOD & CO; label "estimasi model, bukan pengukuran".
- ✅ Indeks tampilan: **ISPU** (Permen LHK P.14/2020) dihitung dari PM2.5 (konsentrasi 24 jam — pakai rata-rata bergerak 24 jam dari deret jam CAMS); sub-indeks PM10 & CO sebagai pembanding.
- ✅ Hotspot: FIRMS Area API (VIIRS 375 m) dengan bbox Aceh Tengah + buffer 50 km; perlu MAP_KEY di env server (`FIRMS_MAP_KEY`).
- ✅ Tambah tipe laporan warga: `asap` (dengan skala jarak pandang), `kebakaran`.
- 🔶 Jarak pandang (`visibility`) dari Open-Meteo forecast sebagai proksi tambahan — perlu diuji pada iterasi berikutnya.
- 🔶 Sensor PM2.5 murah (PurpleAir/Sensor.Community/IQAir) di Takengon — tidak ada data yang ditemukan; dicatat sebagai peluang kemitraan.

---

## Iterasi 2 — Peringkat bahaya kebakaran (FWI/SPBK), input model, & proksi jarak pandang

### Pertanyaan
1. Indeks apa yang dipakai BMKG untuk *fire danger* dan bagaimana kelasnya untuk Indonesia?
2. Bisakah FWI dihitung sendiri dari data Open-Meteo yang sudah dipakai repo (tanpa dependensi baru)?
3. Variabel apa lagi yang bisa jadi proksi asap/konvektif (visibility, CAPE, petir)?

### Temuan
- **SPBK BMKG = FDRS Indonesia**, adaptasi Canadian FWI System (de Groot, Field, Brady et al. 2007) yang dioperasikan nasional oleh BMKG; tiga komponen dikalibrasi: **FFMC** (potensi penyalaan), **DC** (potensi asap / *smoke potential* — indikator kabut asap), **ISI** (kesulitan kendali api di padang rumput). Kelas FFMC Indonesia: Rendah 0–72, Sedang 73–77, Tinggi 78–82, **Ekstrem ≥ 83** (>85 % hotspot terjadi saat FFMC ≥ 78); ISI ≥ 6 → intensitas sangat tinggi di rumput ([de Groot et al., Mitig Adapt Strat Glob Change 2007](https://link.springer.com/article/10.1007/s11027-006-9043-8); [PDF RFMRC-SEA](https://rfmrc-sea.org/wp-content/uploads/2015/01/Development-of-the-Indonesian-and-Malaysian-Fire-Danger-Rating-Systems.pdf)).
- Kelas operasional BMKG (Jurnal Meteorologi & Geofisika BMKG): **FFMC** Tinggi 69–83 (kuning), Ekstrem > 83 (merah); **FWI** Tinggi 6–13 (kuning), Ekstrem > 13 (merah); Staklim Sumsel melaporkan FFMC/DC/FWI harian dengan 4 kelas Rendah/Sedang/Tinggi/Ekstrem ([JMG BMKG](https://jmg.bmkg.go.id/jmg/index.php/jmg/article/download/181/167/344); [Staklim Sumsel Jul 2024](https://staklim-sumsel.bmkg.go.id/evaluasi-tingkat-bahaya-kebakaran-bulan-juli-2024/)). Catatan literatur: ambang FWI seragam nasional dikritik karena tidak membedakan ekoregion — dataran tinggi Gayo (bukan gambut) perlu kalibrasi lokal.
- **Input FWI** (suhu siang, RH, angin 10 m, hujan 24 jam) **semua tersedia** di endpoint Open-Meteo ECMWF yang sudah dipakai repo. **[diuji langsung]** ECMWF `ecmwf_ifs025` untuk Takengon menyediakan `vapour_pressure_deficit`, `cape` (2.090 J/kg pada 14 Okt sore → konvektif kuat), `et0_fao_evapotranspiration`, `dew_point_2m`; tetapi **`visibility` dan `lightning_potential` null** pada model ECMWF.
- **[diuji langsung]** Model `best_match` (ICON/GFS) **menyediakan `visibility`**: Takengon 14 Okt 2026 berkisar **4.140–8.460 m** (turun < 5 km pada beberapa jam → konsisten dengan kabut asap). `lightning_potential` tetap null (hanya ICON-D2 Eropa).
- **GEFF/CEMS (Copernicus)** menyediakan FWI global 0,25° harian (deterministik + probabilistik 15 hari) dengan lisensi terbuka, tetapi akses butuh registrasi CDS + unduhan NetCDF ([ECMWF Newsletter](https://www.ecmwf.int/en/newsletter/151/news/copernicus-fire-danger-forecast-goes-online); [Vitolo et al. 2020](https://www.nature.com/articles/s41597-020-0554-z)) → terlalu berat untuk server tanpa dependensi; dijadikan **sumber validasi offline**, bukan runtime.

### Keputusan
- ✅ Implementasi **FWI System in-house** (`src/domain/hazards/fireWeather.js`): persamaan Van Wagner 1987 (FFMC, DMC, DC, ISI, BUI, FWI) sebagai fungsi murni ter-test dengan fixture; input dari Open-Meteo ECMWF harian (suhu & RH jam 12–13 WIB, angin, hujan 24 jam). *Spin-up* kode kelembapan 30–60 hari dari Open-Meteo **Archive API (ERA5)** saat server start, lalu *carry-over* harian di cache persisten (`server/data/fwi-state.json`).
- ✅ Kelas tampilan mengikuti **FDRS Indonesia** (FFMC 72/77/82; FWI 1/6/13; DC untuk "potensi asap lokal") dengan label "kalibrasi nasional — belum spesifik Gayo".
- ✅ Ambil `visibility` dari model `best_match` sebagai **proksi kabut** (ambang: < 5 km waspada, < 2 km bahaya, < 1 km sangat berbahaya — selaras praktik BMKG untuk kabut asap) — satu panggilan tambahan per lokasi, cache 30 menit.
- ✅ CAPE (ECMWF) masuk modul **cuaca ekstrem konvektif** (petir/hujan es/angin kencang) — iterasi 6.
- ❌ Tidak mengunduh GEFF NetCDF di runtime.
- 🔶 Minta akses data SPBK harian BMKG Staklim Aceh (format tabel/peta) untuk kalibrasi ambang lokal — masuk daftar kemitraan.

---

## Iterasi 3 — Bahaya geologi: gempa (Sesar Sumatra) & vulkanik (Burni Telong)

### Pertanyaan
1. Seberapa relevan gempa untuk 15 sentra dan data apa yang tersedia real-time?
2. Bagaimana status Burni Telong saat ini, dan apakah ada sumber mesin untuk tingkat aktivitas/VONA?

### Temuan — Gempa
- **Gempa Gayo 2 Juli 2013, M6,1**, kedalaman dangkal, Sesar Sumatra **segmen Aceh–Tripa**: 43 tewas, 2.532 luka, > 3.000 rumah hancur, **MMI VII**, longsor memusnahkan Kampung Bah & Serempah (Ketol); Bener Meriah & Aceh Tengah paling parah; masjid runtuh di Aceh Tengah ([Wikipedia ID](https://id.wikipedia.org/wiki/Gempa_bumi_Aceh_2013); [Kompas.id 2026](https://www.kompas.id/artikel/en-lubang-raksasa-di-aceh-tengah-pergerakan-tanah-yang-terus-mengancam)). Kawasan ini dulu dianggap *seismic gap* sejak 1892 ([Ambisius Wiki](https://wiki.ambisius.com/bencana-alam/gempa-aceh-2013/gempa-aceh-2013)). Pergerakan tanah Pondok Balek (2026) hanya ~32 km dari jalur sesar dan dipicu pelemahan tanah pasca-gempa 2013 → **gempa × longsor** adalah interaksi majemuk nyata.
- **[diuji langsung]** BMKG `autogempa.json`, `gempadirasakan.json` (15 terasa terbaru, field `Dirasakan` MMI per kota), `gempaterkini.json` (15 M≥5) — JSON publik tanpa kunci, format stabil.
- **[diuji langsung]** USGS FDSN `format=geojson&latitude=4.63&longitude=96.85&maxradiuskm=300&minmagnitude=4` → **67 kejadian M≥4 dalam 12 bulan terakhir** (mayoritas lepas pantai barat/Simeulue, kedalaman 30–150 km). Berguna untuk konteks & riwayat; BMKG tetap otoritas resmi.
- Implikasi: tidak ada "prakiraan gempa"; nilai produk = **informasi cepat + panduan + pemicu pemeriksaan longsor susulan** (tanah jenuh + guncangan).

### Temuan — Vulkanik (**mengubah prioritas**)
- **Burni Telong (2.624 mdpl, Bener Meriah)**: Level I → unrest Okt 2025 (Waspada) → turun Normal 1 Nov 2025 → **naik hingga Level III (Siaga)** → diturunkan ke **Level II (Waspada) pada 3 Jan 2026**; per 1 Jun 2026 masih Level II, radius rekomendasi 3 km → 2 km; gempa vulkanik dalam turun dari ~6 ke ~3/hari ([Tempo, 3 Jun 2026](https://www.tempo.co/lingkungan/pvmbg-turunkan-radius-zona-rekomendasi-gunung-burni-telong-2217739); [Bidik Indonesia, Nov 2025](https://bidikindonesia.com/status-gunung-burni-telong-kembali-normal/)). Per **5–8 Sep 2026** tetap **Level II (Waspada)**, asap kawah tidak teramati; rekomendasi: jauhi kawah radius 3 km dan fumarola/solfatara saat mendung/hujan (gas) ([Serambinews, 8 Sep 2026](https://aceh.tribunnews.com/video/1042656/video-empat-gunung-erupsi-serentak-begini-status-terkini-burni-telong-di-bener-meriah); [InfoPublik](https://infopublik.id/kategori/nusantara/958403/index.html)).
- **[diuji langsung, 14 Okt 2026]** Halaman publik MAGMA Indonesia `magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas` (HTML) menempatkan **"Bur Ni Telong – Aceh" di bagian Level II (Waspada)** dengan tautan laporan bertanda tangan; API JSON (`/api/v1/vona`, `/v1/vona/list`) **401/403** (butuh kredensial). → Parsing HTML dengan fixture + degraded flag (pola `bmkg.js`) layak; VONA bisa diambil dari halaman publik/RSS bila tersedia.
- Jarak Burni Telong ke sentra (haversine dari puncak 4,769 N 96,821 E): **Ketol 8 km, Kute Panang 10,5 km, Kebayakan 13,6 km, Takengon 15,7 km, Bebesan 16 km, Lut Tawar 19 km, Bies 20 km, Silih Nara 21 km, Pegasing 21 km, Bintang 25 km**; sisanya 35–51 km. Hujan abu pada erupsi sedang dapat mencapai radius ini bergantung arah angin → dampak pada bunga/buah kopi, air baku, pernapasan.

### Keputusan
- ✅ **H-VULKANIK dinaikkan dari P3/Fase 3 → P1/Fase 2** (status Waspada aktif sejak Jan 2026). Modul: tingkat aktivitas (parser halaman MAGMA + cache 1 jam + fallback nilai terakhir), arah angin 10 m & 850 hPa dari Open-Meteo → daftar sentra "di bawah angin" (sektor ±30°), anjuran abu (masker, tutup bak air, panen/bunga kopi, bersihkan atap), tautan laporan PVMBG.
- ✅ **H-GEMPA** (P1/Fase 2): `server/bmkgQuake.js` — gabungkan `gempadirasakan` + `autogempa`; filter radius ≤ 300 km dari Takengon **atau** teks dirasakan memuat kabupaten Aceh; estimasi MMI lokal sederhana dari M & jarak (atenuasi) hanya sebagai indikasi; cache 2 menit; USGS sebagai pelengkap riwayat (M≥4,5).
- ✅ Aturan majemuk: gempa M≥5 ≤ 100 km **dan** ARI 72 jam ≥ 100 mm **atau** skor longsor ≥ 40 → "Periksa retakan lereng/tebing jalan — risiko longsor susulan meningkat" selama 72 jam.
- ✅ `disasterHistory.json`: tambah skema `hazard` dan kejadian **gempa 2013-07-02** (ketol, kutepanang, kebayakan, takengon, bebesan, silihnara, bies) & **Burni Telong Siaga 2025-12/2026-01**.
- 🔶 Minta akses API MAGMA (formulir Badan Geologi) — kemitraan.
- ❌ Tidak membuat prediksi erupsi/gempa; hanya menyampaikan status resmi + konteks jarak/angin.

---

## Iterasi 4 — Kekeringan, suhu ekstrem (dingin/panas) untuk kopi, konteks iklim ENSO/IOD

### Pertanyaan
1. Standar kekeringan meteorologis BMKG apa yang bisa dihitung dari data terbuka?
2. Ambang suhu/kelembapan apa yang bermakna agronomis untuk Arabika Gayo (embun beku vs stres dingin vs panas)?
3. Apa konteks iklim musiman 2026/2027 dan bagaimana menampilkannya?

### Temuan
- **HTH (Hari Tanpa Hujan berturut-turut, BMKG)** — hari dengan hujan < 1 mm dihitung mundur dari hari terakhir; kelas: Sangat Pendek 0–5 · Pendek 6–10 · Menengah 11–20 · Panjang 21–30 · Sangat Panjang 31–60 · **Ekstrem > 60 hari**; jika hari terakhir hujan ≥ 1 mm → "Hari Hujan" ([BMKG GAW Bariri](https://gaw-bariri.bmkg.go.id/publikasi/gawsarium/240-hari-tanpa-hujan-hth)). BMKG memakai HTH dasarian untuk peringatan dini kekeringan meteorologis ([Prokalteng 13 Okt 2026](https://prokalteng.jawapos.com/prohukrim/pro-kalteng/13/10/2026/kalteng-potensi-hujan-di-sejumlah-wilayah-ancaman-asap-karhutla-masih-belum-hilang)).
- **[diuji langsung] Open-Meteo Archive API (ERA5-Land/ERA5)** untuk Takengon 2026-08-01 → 2026-10-12: 73 hari lengkap, tersedia `precipitation_sum, temperature_2m_max/min, relative_humidity_2m_mean, wind_speed_10m_max, et0_fao_evapotranspiration`; **Agustus 2026 hanya 74,7 mm** (kering), September 245,6 mm; Tmin terendah 14,3 °C; ET0 rata-rata 3,5 mm/hari; HTH saat ini 0 (sedang hujan). → cukup untuk **spin-up FWI**, HTH, neraca air sederhana, dan SPI-1/3 (perlu baseline 1991–2020 dari arsip yang sama, satu kali unduh per lokasi).
- **Konteks iklim 2026/2027 (penting):** BMKG mengonfirmasi **El Niño sangat kuat** (anomali Niño3.4 dasarian **+3,44 °C**; indeks 3-bulanan JAS **+2,70**) **bersamaan IOD positif (+0,935)** → kemarau sangat panas, hujan berkurang signifikan, kekeringan diperpanjang; **musim hujan 2026/2027 datang terlambat & lebih singkat**, puncak **Des 2026–Feb 2027**; peringatan dini kekeringan meteorologis dasarian I Okt 2026; sekaligus peringatan **Waspada curah hujan tinggi** di beberapa kabupaten Aceh ([CNBC Indonesia 6 Okt 2026](https://www.cnbcindonesia.com/news/20261006101827-4-773666/el-nino-sangat-kuat-bmkg-keluarkan-peringatan-prediksi-terbaru); [Medcom 25 Sep 2026](https://www.medcom.id/pendidikan/riset-penelitian/gNQrgRab-el-nino-masih-sangat-kuat-ini-prediksi-musim-hujan-2026-2027-dan-langkah-antisipasinya); [NU Lampung](https://lampung.nu.or.id/warta/bmkg-sebut-el-nino-sangat-kuat-sedang-terjadi-musim-hujan-2026-2027-diprediksi-datang-lebih-lambat-x4iQm)). Ini menjelaskan episode karhutla/asap nasional 2026 dan berarti **kalender musiman F7 (puncak Nov–Feb) perlu penyesuaian tahunan** berbasis prediksi BMKG.
- **Fisiologi Arabika** (DaMatta & Ramalho 2006; Embrapa; studi Yunnan 2025): optimum suhu rata-rata tahunan 18–21 (hingga 23) °C; **> 30 °C** → gangguan perkembangan bunga & aborsi bunga (terutama bila disertai udara kering); > 35 °C hambat perkecambahan; daun & buah **tidak tahan < 5–6 °C**; di Yunnan **stres dingin (chill) adalah penyebab kehilangan hasil #1, disusul kekeringan**, dan **VPD > 0,82 kPa saat pembungaan** terkait penurunan hasil tajam ([Nature npj 2025](https://www.nature.com/articles/s44304-025-00092-5); [DaMatta & Ramalho](https://www.researchgate.net/publication/250024351_Impacts_of_drought_and_temperature_stress_on_coffee_physiology_and_production_a_review); [Embrapa](https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/973013/1/Artigo2013AJAR.pdf)).
- **Embun upas/frost**: terjadi pada malam cerah–tenang musim kemarau; nilai 0 °C/minus yang viral di Dieng adalah **suhu minimum permukaan rumput**, bukan suhu udara 2 m — jadi ambang "udara ≤ 4 °C + langit cerah + angin tenang + titik embun rendah" sudah menandakan risiko frost permukaan ([Detik/BMKG Jateng Jul 2026](https://www.detik.com/edu/detikpedia/d-8581724/kenapa-dieng-bisa-capai-suhu-6-c-ini-penjelasan-fenomena-embun-upas-yang-viral)). Untuk Gayo (900–1.500 mdpl; Tmin ERA5 ≈ 14 °C) frost jarang; **stres dingin ≤ 10 °C** lebih mungkin di Jagong Jeget/Atu Lintang/Kute Panang pada kemarau El Niño.

### Keputusan
- ✅ **H-KERING** (Fase 3, tetapi *HTH & banner ENSO* ditarik ke Fase 1 karena murah): HTH per lokasi dari Archive + forecast harian; kelas BMKG → level UI (Menengah = waspada, Panjang/Sangat Panjang = bahaya, Ekstrem = ekstrem); neraca air 30 hari `Σ(hujan − ET0)`; VPD siang rata-rata 7 hari (> 0,82 kPa waspada pembungaan; > 1,5 bahaya); SPI-1/3 opsional (Fase 3) dengan baseline arsip 30 tahun.
- ✅ **H-SUHU**: dua sisi — **dingin**: Tmin ≤ 10 °C waspada, ≤ 6 °C bahaya, ≤ 4 °C + cerah + angin ≤ 5 km/jam + Td ≤ 2 °C → "potensi embun upas" (ekstrem); **panas**: Tmax ≥ 28 °C waspada, ≥ 30 °C bahaya (fase bunga), ≥ 32 °C ekstrem; anjuran: naungan, mulsa, penyiraman, jangan pangkas saat panas.
- ✅ **Banner konteks iklim** (perluasan F7): teks statis terkurasi per musim dari rilis BMKG (El Niño/IOD, prediksi awal & puncak musim hujan) dengan tanggal rilis & tautan — diperbarui manual tiap dasarian/bulanan (tanpa API BMKG untuk ini).
- ✅ Satu panggilan Archive per lokasi/hari (15 call) → kuota aman; simpan deret 90 hari di cache persisten.
- 🔶 SPI butuh unduh 30 tahun × 15 lokasi sekali (≈ 15 call besar) — jadwalkan di Fase 3.

---

## Iterasi 5 — Banjir bandang & luapan: debit sungai (GloFAS), laporan urun-daya eksternal (PetaBencana), telemetri muka air

### Pertanyaan
1. Bisakah "indeks hujan DAS" (F-lama) ditingkatkan menjadi indikator **debit** dengan data terbuka?
2. Adakah umpan laporan masyarakat eksternal yang bisa melengkapi F8?
3. Adakah telemetri muka air Danau Lut Tawar / Krueng Peusangan yang publik?

### Temuan
- **[diuji langsung] Open-Meteo Flood API (GloFAS v4, grid 0,05°)** `flood-api.open-meteo.com/v1/flood?daily=river_discharge,river_discharge_mean,river_discharge_max,river_discharge_p75&past_days=7&forecast_days=7` mengembalikan deret debit harian (m³/s) untuk titik DAS Peusangan: sel Lut Tawar (4,625/96,875) 4,9–16,5 m³/s; sel Takengon (4,625/96,825) 6,4–25,1 m³/s (puncak 14 Okt = 25,1 setelah hujan); sel Bintang 2,2–6,5; sel Silih Nara/Angkup 1,2–4,3. Ensemble (`mean/max/p75`) tersedia → **debit probabilistik 7 hari**. API juga melayani data historis sejak 1984 → klimatologi persentil per hari-dalam-tahun bisa dihitung sekali per sel.
  - ⚠️ GloFAS 0,05° (~5,5 km) hanya representatif untuk sungai orde besar; **banjir bandang anak sungai (Pagar Merah, Angkup) tidak terwakili** → tetap gabungkan dengan hujan ensemble & ARI (model lama) dan laporan warga.
- **[diuji langsung] PetaBencana.id Open API** (`api.petabencana.id/reports?admin=ID-AC&timeperiod=604800&geoformat=geojson`, wajib header `User-Agent`): 7 hari terakhir **5 laporan banjir di Aceh** (Gayo Lues 3 laporan kedalaman 27–52 cm, Aceh Tamiang, Aceh Tenggara) dengan `tags.region_code` kode BPS kabupaten (**Aceh Tengah = 1104**, Bener Meriah = 1117, Gayo Lues = 1113); nasional 54 laporan **haze** (mayoritas Kalteng). Jenis bencana didukung: `flood, earthquake, fire, haze, wind, volcano`; lisensi **CC BY-NC 4.0**; endpoint `/floodgauges` untuk alat ukur muka air ([docs PetaBencana](https://docs.petabencana.id/routes); [laporan urun-daya](https://docs.petabencana.id/routes/laporan-urun-daya)). → Taksonomi hazard kita **selaras** dengan 6 jenis PetaBencana (tambah longsor sebagai lokal).
- **Telemetri muka air**: Kementerian PU memiliki portal SIHKA (`gis.pusair-pu.go.id`) yang mengintegrasikan pos duga air/AWLR telemetri B/BWS se-Indonesia secara jam-an ([SIHKA](https://gis.pusair-pu.go.id/)); keberadaan pos AWLR di outlet Lut Tawar/Krueng Peusangan (BWS Sumatera I) **belum terverifikasi** — perlu cek daftar pos & kemungkinan API/ekspor. Hingga ada, klaim "status muka air" tetap **dilarang** (sesuai rename M3).

### Keputusan
- ✅ **H-BANJIR+ (Fase 2)**: `server/flood.js` — 4 sel GloFAS (Lut Tawar/outlet, Takengon, Bintang hulu, Angkup) 1 call/sel/6 jam; indikator = **anomali debit** (debit prakiraan ÷ median klimatologi hari tersebut) + persentil ensemble p75/max; level: rasio ≥ 2 waspada, ≥ 3 bahaya, ≥ 5 ekstrem **atau** debit > persentil-95 klimatologi (kalibrasi awal; validasi dengan kejadian 26 Nov 2025 & 3 Des 2025 melalui data historis API). Dipadukan dengan indeks hujan DAS lama & ARI → "Indeks Luapan DAS Peusangan v2" dengan label "model hidrologi global, bukan muka air terukur".
- ✅ **Umpan PetaBencana** (Fase 2): `server/petabencana.js` — tarik `reports?admin=ID-AC` tiap 10 menit, filter `region_code ∈ {1104, 1117, 1113}` + radius 60 km, tampilkan sebagai "Laporan masyarakat (PetaBencana.id, CC BY-NC)" di samping laporan F8; jangan dicampur ke skor (hanya konteks). Pertimbangkan integrasi dua arah (kirim laporan F8 ke PetaBencana) setelah kajian lisensi/privasi.
- ✅ Kalibrasi retrospektif: unduh debit GloFAS historis untuk 2023–2026 di 4 sel dan bandingkan dengan 6 kejadian `disasterHistory.json` → dokumen validasi (Fase 4).
- 🔶 Verifikasi pos AWLR BWS Sumatera I (SIHKA) — jika ada & bisa diakses, tambah "muka air terukur" (sumber resmi) dan hapus label indeks.
- ❌ Tidak mengklaim prediksi banjir bandang anak sungai dari GloFAS.

---

## Iterasi 6 — Cuaca ekstrem konvektif: petir, hujan es, puting beliung, angin kencang (H-PETIR / H-ANGIN+)

### Pertanyaan
1. Indeks konvektif apa yang tersedia per model di Open-Meteo dan seberapa konsisten antar model?
2. Apa ambang resmi BMKG untuk "cuaca ekstrem" yang harus dipakai agar selaras dengan peringatan resmi?
3. Anjuran keselamatan apa yang relevan untuk pekerja kebun di lereng terbuka?

### Temuan
- **[diuji langsung] ECMWF `ecmwf_ifs025`** menyediakan `cape` (Takengon 14 Okt 12–13 WIB: **2.090 J/kg**), `weather_code` WMO (80–82 hujan deras/shower; 95–99 badai petir), `showers`, `wind_gusts_10m`; **tidak** menyediakan `lifted_index`, `convective_inhibition`, `freezing_level_height`, `lightning_potential`.
- **[diuji langsung] GFS (`gfs_seamless`)** menyediakan `cape` **dan `lifted_index`** (LI −2,3) tetapi CAPE jauh lebih rendah (**310 J/kg**) pada jam yang sama → **ketidaksepakatan antar model besar** untuk indeks konvektif di topografi pegunungan; `lightning_potential` tetap null (hanya ICON-D2 Eropa). Implikasi: jangan memakai satu model; pakai **konsensus** (ECMWF CAPE + GFS LI + `weather_code` ≥ 95 pada salah satu model) dan jadikan **nowcast BMKG (F5)** sebagai sinyal berbobot tertinggi.
- Skala instabilitas umum (NOAA/ literatur): CAPE 0–1.000 marginal; **1.000–2.500 sedang**; **2.500–3.500 sangat tidak stabil**; > 3.500 ekstrem; LI −3…−6 tidak stabil, −6…−9 sangat; CAPE saja tidak cukup — perlu pemicu angkat (orografi/konvergensi) yang di Gayo tersedia hampir setiap siang ([NWS Glossary](https://forecast.weather.gov/glossary.php?word=cape); [studi Sri Lanka 2021](https://www.researchgate.net/publication/354530954_Analyze_and_Comparison_of_the_Atmospheric_Instability_Using_K-Index_Lifted_Index_Total_Totals_Index_Convective_Availability_Potential_Energy_CAPE_and_Convective_Inhibition_CIN_in_Development_of_Thunde); [Windy community](https://community.windy.com/topic/9025/what-is-a-cape-index)).
- **Ambang resmi cuaca ekstrem BMKG (Perka KEP.009/2010)**: hujan **≥ 50 mm/24 jam**; angin **> 25 knot (≈ 45 km/jam)**; suhu menyimpang **± 3 °C dari normal** setempat; **jarak pandang < 1.000 m** ([BPBD HSS](https://bpbd.hulusungaiselatankab.go.id/?p=2823); [Buletin Stamet Karimun Agu 2025](https://stamet-karimun.bmkg.go.id/wp-content/uploads/2025/08/BULETIN-AGUSTUS-2025.pdf); [tinjauan pustaka ITPLN](https://repository.itpln.ac.id/id/eprint/5790/5/Bab%20II.pdf)). → Ambang angin lama repo (gusts ≥ 40 waspada / ≥ 60 bahaya) perlu **titik 45 km/jam** sebagai "ekstrem versi BMKG" agar pesan konsisten dengan peringatan resmi; jarak pandang < 1 km = ekstrem (dipakai di H-ASAP).

### Keputusan
- ✅ **H-PETIR (konvektif)** modul `convective.js`: skor = CAPE ECMWF (maks 6 jam ke depan) + LI GFS + `weather_code` ≥ 95 (salah satu model) + hujan jam-an ≥ 10 mm + gusts; level: **waspada** CAPE ≥ 1.000 atau LI ≤ −3; **bahaya** CAPE ≥ 2.000 atau kode 95–99 atau LI ≤ −6; **ekstrem** bahaya + (gusts ≥ 45 km/jam atau hujan ≥ 20 mm/jam atau BMKG nowcast aktif untuk kecamatan). Jendela waktu: tampilkan jam risiko tertinggi (biasanya 13–18 WIB).
- ✅ **H-ANGIN+**: pertahankan gusts 40/60, tambah penanda "≥ 45 km/jam = kriteria cuaca ekstrem BMKG"; puting beliung = kombinasi konvektif bahaya + gusts ≥ 45.
- ✅ Anjuran pekerja kebun: hentikan kerja di lereng/pohon pelindung saat petir terdengar (aturan 30-30), hindari berteduh di bawah pohon tinggi/tiang, jauhi pagar kawat, tunda penyemprotan/panen; hujan es: lindungi bibit & jemuran.
- ✅ Hujan es: indikator pendamping CAPE ≥ 2.000 + suhu puncak rendah di pegunungan — hanya "potensi", tanpa klaim kuantitatif (tidak ada freezing level di ECMWF via Open-Meteo).
- ❌ Tidak mengklaim deteksi petir real-time (tidak ada akses jaringan deteksi petir BMKG/LD); ditandai sebagai peluang kemitraan.
- 🔶 Uji verifikasi 1 musim: catat kejadian petir/puting beliung dari laporan warga vs skor untuk kalibrasi ambang (Fase 4).

---

## Iterasi 7 — Diseminasi & standar pesan: CAP, kanal (Telegram/WhatsApp/Web Push/SMS), peran "bukan otoritas"

### Pertanyaan
1. Standar apa yang harus diikuti struktur pesan peringatan agar bisa dipakai lintas kanal dan selaras BMKG/BNPB?
2. Kanal mana yang realistis untuk warga kampung (biaya, jangkauan, offline)?
3. Bagaimana posisi produk terhadap prinsip *single authoritative voice*?

### Temuan
- **CAP (Common Alerting Protocol) v1.2 / ITU X.1303** adalah format digital *all-hazards, all-media* yang diendors Kongres WMO ke-19 (2023) dan masuk WMO-No. 49; pesan CAP divalidasi melalui **WMO Register of Alerting Authorities** sehingga sumber otoritatif diketahui; WMO mendorong *impact-based* CAP untuk *Early Warnings for All* ([WMO MeteoWorld, Sep 2026](https://wmo.int/resources/meteoworld/meteoworld-march-2025/common-alerting-protocol-milestones-of-early-warnings-all); [CAP Resources WMO](https://wmo.int/site/wmo-common-alerting-protocol/cap-resources)). Repo **sudah mengonsumsi** CAP BMKG (F5). Implikasi: struktur peringatan internal sebaiknya **mencerminkan field CAP** (`event, urgency, severity, certainty, headline, description, instruction, area, sender, sent, expires`) agar satu struktur → banyak kanal (Telegram, WhatsApp teks, Web Push, ekspor BPBD) dan mudah dipetakan bila kelak BPBD ingin menerbitkan CAP resmi.
- **Posisi produk:** Niu Gayo **bukan** *alerting authority*. Semua pesan harus (a) menyebut sumber resmi (BMKG/PVMBG/BNPB/KLHK), (b) memakai kata "informasi pendukung/estimasi", (c) menautkan peringatan resmi bila ada, (d) tidak memakai istilah resmi status tanggap darurat.
- **Kanal:**
  - **Telegram** (sudah ada, gratis): cocok untuk BPBD/relawan; penetrasi warga kampung rendah.
  - **WhatsApp**: penetrasi tertinggi di Indonesia. WhatsApp Business API via BSP lokal ≈ **Rp500.000/bulan + Rp367/pesan utility** (centang biru tidak wajib) ([Zenziva WABA](https://zenziva.id/waba)); provider lain Rp300.000–2.500.000/bulan ([ChakraHQ 2026](https://chakrahq.com/article/solusi-whatsapp-api-terbaik-indonesia-2026/); [YCloud 2026](https://www.ycloud.com/blog/top-whatsapp-business-api-solution-providers-indonesia)). Alternatif **gratis**: tombol "Salin/Bagikan ke WhatsApp" (teks siap kirim) untuk kepala kampung/relawan Destana — sesuai FR-X-7.
  - **Web Push (PWA Android)**: gratis, bekerja saat aplikasi tertutup; butuh VAPID + enkripsi RFC 8291 di server (implementasi tanpa dependensi rumit → paket `web-push` sebagai **dependensi opsional** server).
  - **SMS/kentongan/HT**: jalur BPBD/kampung; aplikasi menyediakan teks pendek ≤ 160 karakter sebagai "versi SMS".
- **Preseden kebijakan berbasis ambang** untuk pesan sekolah (libur saat asap tebal — Maluku Tengah 13 Okt 2026) menegaskan bahwa pesan harus memuat **tindakan konkret per penerima** (impact-based), bukan hanya angka.

### Keputusan
- ✅ **Skema `Alert` internal bergaya CAP** (`src/domain/alert.js`): `{ id, hazard, sender:'niu-gayo (informasi pendukung)', sent, expires, status:'Actual', msgType:'Alert|Update|Cancel', urgency, severity, certainty, headline, description, instruction[], area:{locations[]}, references:{official:[...]} }` — dihasilkan oleh *hazard registry* saat level ≥ waspada; semua kanal merender dari sini (ADR-22).
- ✅ Kanal Fase 1: Telegram (ada) + **"Bagikan ke WhatsApp"** (teks) + "versi SMS" ≤ 160 karakter; Fase 2: **Web Push** opsional (opt-in per sentra, hanya level ≥ bahaya); WhatsApp API ditunda sampai ada pendanaan/kemitraan BPBD.
- ✅ Kebijakan anti-kebisingan: maksimum 1 pesan per hazard per sentra per 6 jam kecuali eskalasi level; `msgType:'Cancel'` saat turun ke rendah.
- ✅ Template pesan 3 tingkat: **BPBD** (lengkap + metrik + degradasi), **Kampung** (bahasa sederhana id/Gayo + 3 tindakan), **SMS** (≤ 160).
- ❌ Tidak menerbitkan feed CAP XML publik atas nama otoritas; feed JSON "alerts" hanya untuk konsumsi internal/mitra dengan disclaimer.

---

## Iterasi 8 — Kesehatan masyarakat saat asap (Kemenkes/WHO), kelompok rentan, sekolah, dan dampak asap pada kopi

### Pertanyaan
1. Pedoman resmi apa yang menjadi dasar anjuran per kategori ISPU (agar teks di aplikasi tidak mengarang)?
2. Siapa kelompok rentan menurut Kemenkes dan tindakan apa yang direkomendasikan?
3. Apa dampak asap pada tanaman & pascapanen kopi yang bisa dipertanggungjawabkan?

### Temuan — Kesehatan
- Kemenkes (Pusat Krisis Kesehatan, Agu–Sep 2026): asap karhutla mengandung **PM2,5, CO, NO₂, senyawa organik beracun**; memperburuk **ISPA, asma, PPOK**, gangguan pernapasan anak; kelompok yang perlu perlindungan khusus: **anak-anak, lansia, ibu hamil, penderita asma/PPOK, dan pekerja luar ruangan**; anjuran: pantau ISPU sebelum beraktivitas, kurangi aktivitas luar ruang saat memburuk, tutup pintu/jendela, AC mode resirkulasi/pembersih udara, **masker terutama N95** bila terpaksa keluar, segera ke faskes bila gejala memburuk; Kemenkes telah menerbitkan **Surat Edaran kewaspadaan karhutla/polusi udara (Mei 2026)**; pemerintah menerapkan **PJJ untuk sekolah terdampak** ([Tempo, 26 Agu 2026](https://www.tempo.co/politik/sekolah-pjj-kabut-asap-kebakaran-hutan-2283912)). Strategi tiga tingkat Kemenkes (primer: kurangi aktivitas luar, tutup sirkulasi luar, penyaring udara, respirator N95, PHBS) ([IDN Times, 28 Agu 2026](https://www.idntimes.com/health/medical/kasus-ispa-naik-akibat-karhutla-kemenkes-lakukan-sejumlah-tindakan-00-h7csw-rzmtb1)).
- Skala dampak 2026: **151 ribu kasus ISPA** terkait karhutla; Kemenkes mengerahkan 1.898 nakes, 1,9 juta masker, 280 konsentrator oksigen; Kota Jambi **ISPU > 200 → sekolah diliburkan** ([Media Indonesia, 21 Sep 2026](https://mediaindonesia.com/humaniora/935674/151-ribu-kasus-ispa-akibat-karhutla-kemenkes-siagakan-ribuan-nakes-dan-pasokan-oksigen)). Preseden ambang kebijakan: **ISPU > 200 (Sangat Tidak Sehat) → PJJ/libur**; Maluku Tengah meliburkan 3 hari (iterasi 1).
- Catatan WHO AQG 2021 (pengetahuan umum, untuk konteks UI): pedoman PM2,5 **15 µg/m³ (24 jam)** — jauh di bawah batas "Baik" ISPU (15,4) sehingga kategori "Sedang" ISPU (15,5–55,4) **sudah melampaui pedoman WHO** → UI menampilkan catatan untuk kelompok rentan mulai kategori Sedang.
- Celah lokal: **tidak ada stasiun AQMS di Aceh Tengah** → Puskesmas/sekolah berpotensi menjadi lokasi **sensor PM2,5 berbiaya rendah** (mis. sensor laser PM + ESP32, atau unit komersial) yang datanya bisa diumpankan ke server (endpoint `POST /api/sensors`) untuk mengoreksi estimasi CAMS — peluang kemitraan Dinkes/Dinas LH (menjawab Q2 PRD).

### Temuan — Kopi
- Bukti langsung "asap → mutu kopi" **terbatas**; yang terdokumentasi: cahaya matahari mengendalikan laju fotosintesis & biosintesis senyawa (kafein/asam klorogenat) pada kopi; penurunan penyinaran menurunkan laju fotosintesis ([CCTC 2024](https://www.cctcid.com/2024/03/11/dampak-perubahan-iklim-terhadap-mutu-biji-kopi/)). Asap tebal (AOD ≥ 1) menurunkan **DNI** — variabel yang sudah dipakai modul penjemuran — sehingga jendela jemur memendek; partikel/bau asap dapat menempel pada gabah/green bean yang dijemur terbuka (prinsip kehati-hatian; analogi *smoke taint* pada komoditas lain, belum ada studi kopi Gayo).
- Implikasi: anjuran kopi saat ISPU ≥ 101: **tutup jemuran/pakai rumah pengering (solar dryer) tertutup**, tunda pengeringan terbuka, simpan gabah di ruang tertutup; saat ≥ 201: tunda kerja kebun non-mendesak (kesehatan pekerja lebih prioritas daripada panen).

### Keputusan
- ✅ Tabel anjuran H-ASAP (THRESHOLDS §1.3) **difinalkan dengan rujukan Kemenkes 2026** per kategori dan per kelompok (umum/rentan/pekerja kebun/sekolah), ditambah catatan WHO mulai kategori Sedang.
- ✅ Ambang kebijakan yang ditampilkan ke sekolah/kampung: **≥ 101** tiadakan kegiatan luar ruang; **≥ 201** pertimbangkan PJJ (preseden Jambi/Maluku Tengah, keputusan tetap di pemda); **> 300** tetap di dalam ruangan/ruang bersih.
- ✅ `data/contacts.js` memuat Puskesmas per kecamatan & RSUD Datu Beru; kartu asap menautkan "ke faskes bila sesak/batuk memburuk".
- ✅ Tambah **"Ruang bersih" checklist** (tutup celah, kipas + filter HEPA sederhana/DIY box fan, hindari bakar sampah/dupa/rokok di dalam) sebagai konten statis.
- 🔶 Rancang `POST /api/sensors` (token per perangkat, skema `{deviceId, pm25, pm10, temp, rh, ts}`) untuk sensor murah Puskesmas/sekolah — Fase 4 bersama kemitraan Dinkes/DLH.
- ✅ Penjemuran: `dryingStatus` menerima `ispu` → "Tunda (asap)" bila ≥ 101 atau AOD ≥ 1 dengan DNI turun.

---

## Iterasi 9 — Arsitektur teknis: peta ringan, batas wilayah, pengujian, dan **prototipe fungsi murni (ISPU & FWI) tervalidasi**

### Pertanyaan
1. Peta: pustaka apa yang sesuai untuk PWA ringan di Android kelas menengah dengan sinyal buruk?
2. Dari mana batas kecamatan (GeoJSON) dan peta risiko resmi untuk konteks?
3. Apakah klaim "FWI & ISPU bisa dihitung in-house tanpa dependensi" benar-benar layak? (uji kode)

### Temuan — Peta & data spasial
- Perbandingan 2026: **Leaflet ≈ 40–42 kB gzip** (raster, DOM/Canvas, cache tile via service worker), **MapLibre GL ≈ 200–250 kB gzip** (vektor WebGL, MBTiles offline), OpenLayers ≈ 200–300 kB ([PiStack Jun 2026](https://www.pistack.xyz/posts/2026-06-15-self-hosted-web-mapping-libraries-leaflet-openlayers-maplibre/); [sumguy](https://sumguy.com/leaflet-vs-maplibre-vs-openlayers/); [jeremymax](https://jeremymax.com/blog/mapping-libraries-compared)). Bundle repo saat ini 85 kB gzip → MapLibre akan menggandakan ×3; WebGL juga berat di HP kelas bawah.
- Tile raster OSM publik memiliki kebijakan pemakaian ketat (bukan untuk aplikasi produksi tanpa izin); alternatif: penyedia tile gratis berbatas kuota atau **tanpa tile sama sekali**.
- Batas kecamatan: GADM 4.1 level 3 (kecamatan) tersedia bebas untuk non-komersial; perlu penyederhanaan (mapshaper) agar 14 kecamatan Aceh Tengah + Bener Meriah ≈ 20–50 kB GeoJSON. InaRISK BNPB menyediakan peta indeks risiko per bahaya (layanan ArcGIS REST) untuk konteks kerentanan — hanya rujukan/tautan, bukan runtime.

### Temuan — Prototipe (kode di `docs/dev/prototypes/`, dijalankan `node check.mjs`)
- **`ispu.mjs`**: interpolasi P.14/2020 lulus semua titik batas resmi (15,4→50; 55,4→100; 150,4→200; 250,4→300; 250,5→301). **Takengon 14 Okt 2026 (PM2,5 17,1 µg/m³) → ISPU 53 "Sedang"** — selaras observasi warga "kabut tipis, sesak ringan". Catatan: segmen > 300 memakai asumsi titik 500 (perlu konfirmasi lampiran Permen).
- **`fwi.mjs`** (Van Wagner 1987, 170 baris, tanpa dependensi): **hari-1 contoh referensi Van Wagner & Pickett 1985 tereproduksi persis** (FFMC 87,69 · DMC 8,55 · DC 19,01 · ISI 10,85 · BUI 8,49 · FWI 10,10); hari-2 dalam toleransi 0,15 (nilai referensi perlu dicek ulang terhadap dataset uji `cffdrs`). Opsi **ekuator** (panjang hari DMC 9 jam & faktor DC 1,4 konstan — Lawson & Armitage 2008) disertakan karena Gayo di 4–5° LU.
- **Simulasi Gayo** 10 hari kering (T 24 °C, RH 60 %, angin 8 km/jam, dari kondisi basah) → FFMC 86,6 (**kelas "ekstrem"** FDRS) dan FWI 7,6 ("tinggi"). Artinya ambang FFMC 83 **sangat cepat tercapai** di dataran tinggi lembap → memperkuat kebutuhan **kalibrasi lokal** dan kombinasi dengan hotspot sebelum menampilkan "ekstrem" (sudah diputuskan di iterasi 2 & THRESHOLDS §2.1).

### Keputusan
- ✅ **Peta dua tahap** (ADR-24): Fase 1–3 **peta skematik SVG** tanpa tile (proyeksi equirectangular sederhana lat/lon → viewBox; batas kecamatan GADM tersederhana ≤ 50 kB dikomit; marker sentra berwarna level; hotspot; panah angin; lingkaran radius Burni Telong) — nol dependensi, offline penuh. Fase 4: **Leaflet lazy-load** (≈ 40 kB) + tile dari penyedia berizin hanya saat online, untuk detail.
- ✅ Prototipe ISPU & FWI dipindahkan ke `src/domain/hazards/` pada Fase 1 dengan test dari `check.mjs` + fixture; tambah dataset uji `cffdrs` resmi untuk FWI.
- ✅ Strategi pengujian: (1) test kontrak registry; (2) test fungsi murni dengan fixture per sumber (CSV FIRMS, JSON CAMS/BMKG/GloFAS, HTML MAGMA); (3) test template pesan; (4) smoke test Playwright (buka app, ganti sentra, buka tab Risiko) di CI; (5) pengukuran ukuran bundle di CI (gagal bila > 400 kB gzip tanpa peta).
- ✅ Anggaran kinerja: tambahan Fase 1 ≤ 40 kB gzip (kartu + SVG map + domain); seluruh fetch tambahan di-*parallel* `allSettled` dengan batas waktu 6 detik di klien.
- ❌ MapLibre/vektor tile ditolak untuk target perangkat & jaringan saat ini.

---

## Iterasi 10 — Tata kelola, kemitraan lokal, kerangka hukum, KPI & validasi, konsolidasi

### Pertanyaan
1. Siapa aktor lokal penanganan karhutla/bencana di Aceh Tengah dan bagaimana alur laporan berjalan hari ini?
2. Kejadian lokal 2026 apa yang harus masuk riwayat agar modul baru punya *ground truth*?
3. Apa kerangka hukum/lisensi yang mengikat produk, dan bagaimana mengukur keberhasilan?

### Temuan
- **Karhutla lokal nyata 2026 (bukan hanya asap kiriman):** BNPB mencatat karhutla **Desa Simpang 4 Rajawali, Kec. Ketol (1 Jun 2026, 1 ha)** dan **Kampung Simpang Balek, Wih Pesam, Bener Meriah (1 Jun 2026, 1 ha)** — dipadamkan tim gabungan BPBD, Damkar, TNI, Polri ([BNPB 2 Jun 2026](https://www.bnpb.go.id/berita/perkembangan-situasi-dan-penanganan-bencana-di-tanah-air-tanggal-2-juni-2026)); **Kampung Kuyun Uken, Kec. Celala (19 Jul 2026, 01.15 WIB, ±1 ha)** — laporan masuk lewat **Posko Kecamatan Celala dari masyarakat**, BPBD Aceh Tengah mengoordinasikan asesmen ([BNPB 20 Jul 2026](https://www.bnpb.go.id/berita/perkembangan-situasi-dan-penanganan-bencana-di-tanah-air-20-juli-2026)). → Alur laporan eksisting: warga → posko kecamatan → BPBD; aplikasi harus **menyambung** ke alur ini (relay laporan F8 ke kontak posko kecamatan), bukan menggantikannya. Kejadian ini masuk `disasterHistory.json` (hazard `kebakaran`: ketol, celala) sebagai *ground truth* FWI/hotspot.
- **Status darurat banjir 2025/2026:** Aceh Tengah termasuk 11 kabupaten/kota yang memperpanjang **status tanggap darurat** pasca-banjir bandang Nov–Des 2025; status provinsi berakhir 8 Jan 2026 ([BNPB 30 Des 2025](https://www.bnpb.go.id/berita/enam-wilayah-administrasi-aceh-berstatus-transisi-darurat-ke-pemulihan)) → riwayat F4 perlu field `emergencyStatus` (tanggap darurat/transisi) untuk konteks.
- **Kerangka hukum/kelembagaan (pengetahuan umum, untuk dokumen tata kelola):** UU 24/2007 Penanggulangan Bencana (BNPB/BPBD sebagai komando; peringatan dini menjadi kewenangan lembaga berwenang — BMKG cuaca/iklim/gempa, PVMBG gunung api, KLHK karhutla); Perka BNPB tentang Desa/Kelurahan Tangguh Bencana (Destana) sebagai wadah relawan kampung; Permen LHK P.14/2020 ISPU; Perka BMKG KEP.009/2010 cuaca ekstrem; Perka BMKG tentang InaTEWS/gempa dirasakan. Implikasi: produk = **penyedia informasi pendukung** yang mengutip otoritas; laporan warga = *crowdsourcing* non-resmi.
- **Lisensi data** yang harus dicantumkan: Open-Meteo & CAMS (CC BY 4.0; non-komersial gratis), NASA FIRMS (bebas, atribusi dianjurkan "NASA FIRMS"), BMKG (atribusi wajib), PVMBG/MAGMA (atribusi), PetaBencana (CC BY-NC 4.0), GADM (non-komersial), GloFAS/Copernicus (lisensi Copernicus). Produk saat ini non-komersial → sesuai; bila kelak komersial, Open-Meteo butuh langganan & PetaBencana tidak boleh dipakai.
- **Privasi:** laporan warga tanpa PII (sudah); sensor mitra hanya mengirim data lingkungan; Web Push menyimpan endpoint langganan (bukan identitas) — tetap perlu kebijakan retensi (hapus langganan tak aktif 90 hari) dan halaman "Tentang data".

### Keputusan
- ✅ Dokumen baru: **`07-RISK-REGISTER.md`** (risiko produk/teknis/data/organisasi + mitigasi) dan **`08-STAKEHOLDERS-GOVERNANCE.md`** (peta pemangku kepentingan, alur laporan, kemitraan, kerangka hukum, lisensi, privasi, KPI & rencana validasi).
- ✅ **KPI v2** (diukur per musim): (1) *lead time* informasi asap ≤ 30 menit dari pembaruan CAMS/FIRMS; (2) ≥ 80 % kejadian karhutla lokal (BNPB/BPBD) memiliki FFMC ≥ 78 **atau** hotspot ≤ 10 km pada H-0/H-1 (*hit rate*), dengan *false alarm ratio* "ekstrem" < 30 %; (3) ISPU estimasi vs stasiun/sensor terdekat: MAE < 25 poin; (4) ≥ 20 laporan warga asap per episode; (5) 0 hari "dashboard kosong"; (6) ≥ 3 mitra institusi aktif (BPBD, Puskesmas/Dinkes, Staklim/Manggala Agni).
- ✅ **Kemitraan prioritas**: BPBD Aceh Tengah (Pusdalops; relay laporan ke posko kecamatan; validasi ambang), Manggala Agni Daops Aceh & KPH (hotspot ground-check), BMKG Staklim Aceh (SPBK/HTH, kalibrasi FWI), Pos PGA Burni Telong/PVMBG (status & VONA), Dinkes/Puskesmas & DLH (sensor PM2,5, pesan kesehatan), Dinas Pendidikan (ambang kegiatan sekolah), Koperasi/eksportir kopi (dampak pascapanen), BWS Sumatera I (AWLR).
- ✅ Riwayat F4 diperluas: skema `hazard`, `emergencyStatus`, tambah 3 karhutla 2026 + gempa 2013 + Burni Telong Siaga/Waspada 2025–2026.
- ✅ Halaman "Tentang data & batasan" di aplikasi (sumber, lisensi, label estimasi, privasi, kontak koreksi).
- 🔶 Ajukan surat pengantar/kerja sama ke BPBD Aceh Tengah sebelum Fase 2 agar validasi lapangan berjalan paralel dengan pengembangan.

---

## Ringkasan 10 Iterasi → Keputusan Kunci

| # | Tema | Keputusan utama |
|---|---|---|
| 1 | Asap & kualitas udara | ISPU estimasi dari CAMS (Open-Meteo AQ) + AOD/CO + jarak pandang + laporan warga; prioritas #1 |
| 2 | Bahaya kebakaran | FWI System in-house (kelas FDRS Indonesia), `visibility` dari `best_match`, CAPE untuk konvektif |
| 3 | Geologi | Gempa via BMKG JSON (+USGS riwayat), **vulkanik naik ke P1** (Burni Telong Level II), parser MAGMA HTML |
| 4 | Kekeringan & suhu | HTH BMKG dari Archive API, banner iklim El Niño/IOD, stres dingin/panas kopi |
| 5 | Banjir | Anomali debit GloFAS (Open-Meteo Flood) + indeks hujan lama; umpan PetaBencana; AWLR diverifikasi |
| 6 | Konvektif | Konsensus CAPE ECMWF + LI GFS + kode WMO + BMKG; kriteria ekstrem BMKG (45 km/jam, 50 mm, 1 km) |
| 7 | Diseminasi | Skema Alert bergaya CAP → Telegram/WhatsApp-teks/SMS/Web Push; bukan otoritas; anti-kebisingan |
| 8 | Kesehatan & kopi | Tabel anjuran final (Kemenkes 2026/WHO), ambang sekolah 101/201/300, penjemuran tunda saat asap, sensor mitra |
| 9 | Teknis | Peta SVG skematik → Leaflet lazy; prototipe ISPU & FWI **tervalidasi**; anggaran bundle & CI |
| 10 | Tata kelola | Risk register, stakeholder map, KPI, lisensi/privasi, riwayat diperluas, kemitraan BPBD |

---

## Pasca-iterasi — Penyiapan aset data (14 Okt 2026)
Permintaan lanjutan: menyiapkan sumber data untuk tahap pengembangan. Hasil (rinci di `09-DATA-PREP.md`): 13 fixture respons nyata + skrip pembaru; dataset uji FWI resmi (`cffdrs`, 48 hari) — prototipe menyamai hingga 0,005; GeoJSON 22 poligon GADM (21 kB) dirender & diverifikasi; `healthAdvice.json`, `climateOutlook.json`, `disasterHistory.additions.json`, `sentraKecamatan.json`, `contacts.hazards.js`, `.env.example`; 7 test aset baru (total 98 lulus). Temuan baru: 4 koordinat sentra di luar kecamatan nominal (T13); kabut pagi (visibility 120 m) menuntut jendela jam untuk proksi jarak pandang. Tugas manusia: FIRMS MAP_KEY, verifikasi koordinat & kontak, terjemahan Gayo, penggabungan riwayat, VAPID, surat BPBD.

## Sprint 1 — Implementasi Fase 1 "rilis cepat" (15 Okt 2026)
Item 1.5b, 1.1, 1.2, 1.3 + kartu "Kabut Asap & Kualitas Udara" (`AirQualityCard.jsx`) selesai; +46 test (total 144), build hijau. Temuan dari data langsung saat uji endpoint `GET /api/air-quality?location=takengon` (15 Okt 2026 14:00 WIB): CAMS PM2,5 24 jam 20,6 µg/m³ (ISPU 57 "Sedang"), PM2,5 sesaat 42,8, AOD 1,96, prospek puncak ISPU 70 (16 Okt siang, tren naik); `best_match` menunjukkan **kabut radiasi 220–1.200 m pukul 05–09 WIB dengan RH 85–99 %** yang baru hilang pukul 10 — jendela 09–17 WIB sempat salah membaca 940 m pukul 09:00 sebagai "kabut asap sangat tebal → bahaya". Koreksi ambang (`thresholds.HAZE`): jendela **10–17 WIB**, jam ber-RH ≥ 90 % dikecualikan, eskalasi "bahaya" menuntut ≥ 2 jam < 2 km; hasil akhir hari itu: kabut asap **ringan** (4,4 km pukul 16:00), level rendah — konsisten dengan ISPU. Koreksi dokumentasi: dataset uji `cffdrs` berisi **48 hari** (13 Apr–30 Mei 1985), bukan 49. Belum tersentuh: FIRMS (H-1), server FWI/arsip, kartu kebakaran, peringatan CAP/cron (Sprint 2–3).

## Sprint 2 — Kebakaran, hotspot, kekeringan (15 Okt 2026)
Item 1.5, 1.9b, 1.4 (kode), 1.6, 1.7, 1.9 selesai; +54 test (total 198), build hijau. Temuan dari data langsung:
- **Arsip Open-Meteo** (`archive-api`, ERA5) untuk Takengon tersedia sampai **D−1** (14 Okt) pada 15 Okt siang — lebih baik dari asumsi D−2…D−5 di 04-DATA-SOURCES; tetap dipasang pengisi celah dari prakiraan ECMWF `past_days=7` karena lag bisa memanjang. Harian + jam-an 92 hari × 1 sentra ≈ 150 kB; 15 sentra diambil lazim per permintaan (TTL 12 jam), bukan sekaligus.
- **Kelas Drought Code BMKG** dikonfirmasi dari halaman `bmkg.go.id/cuaca/karhutla/dc`: 0–140 basah · 141–260 lembap · 261–350 kering (pengawasan pembakaran) · > 350 sangat kering (larangan pembakaran) — identik dengan FDRS Indonesia–Malaysia (de Groot dkk. 2007). Dipakai sebagai `FWI.dc`. Halaman BMKG menolak `curl` (403, proteksi bot) — tautan di kartu diarahkan ke halaman DC & halaman iklim umum yang terverifikasi lewat pencarian, bukan sub-halaman HTH yang tidak dapat dipastikan.
- **Kondisi Takengon 15 Okt 2026: musim basah.** HTH 0 (hujan terakhir 14 Okt), hujan 30 hari ≈ 380 mm, neraca air positif, FWI 0 (FFMC ≈ 35, DMC < 1, DC ≈ 5), proyeksi D+1–2 tetap rendah. Artinya kabut asap yang dirasakan warga Aceh Tengah (AOD 1,9–2,0; PM2,5 sesaat 40-an) adalah **transport regional dari karhutla jauh**, bukan kebakaran lokal — kartu "Bahaya Kebakaran" sengaja menampilkan *rendah* sementara kartu udara menampilkan kabut asap; narasi anjuran membedakan "lindungi diri dari asap" vs "cegah api lokal". Catatan untuk validasi musim kering 2027: pengamatan ini menjadi baseline basah untuk membandingkan kenaikan DC.
- **Desain pengamatan FWI**: Open-Meteo tidak menyediakan "hujan sejak pengamatan kemarin", maka hujan harian dihitung dari jam-an (Σ 24 jam hingga 12.00 WIB). Sebelum 12.00 WIB kode "hari ini" belum ada; kartu menampilkan kode kemarin + proyeksi hari ini dari prakiraan — keputusan ini dicatat di `docs/THRESHOLDS.md` §10 agar tidak dibaca sebagai bug.
- **Hotspot tanpa kunci**: FIRMS mengembalikan HTTP 200 berisi teks `Invalid MAP_KEY.` / kuota terlampaui — parser menganggapnya error (bukan "nol hotspot") agar kartu tidak salah menampilkan "tidak ada titik api". Masih menunggu H-1 (pendaftaran MAP_KEY) untuk uji data nyata; test memakai CSV sintetis berlabel.
- **Semantik "titik api terdekat"** diperbaiki saat uji: daftar untuk sentra X = hotspot ≤ 50 km dari X terurut jarak (bukan hotspot yang "sentra terdekatnya" X) — contoh: titik 11 km utara Takengon paling dekat ke Kute Panang, tetapi tetap relevan bagi Takengon.
Belum tersentuh: peringatan CAP/cron Telegram (1.8/1.8b), peta SVG (1.6b), faskes per kecamatan, banner iklim (1.9c), riwayat/halaman batasan (1.9d) → Sprint 3.
