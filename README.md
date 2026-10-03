# ☕ Niu Gayo Agro-Climate

> Sistem Presisi Cuaca Pertanian Kopi Arabika Gayo & Mitigasi Bencana Hidrometeorologi Aceh Tengah

## Latar Belakang
Dataran Tinggi Gayo (Kabupaten Aceh Tengah) merupakan produsen kopi Arabika organik terbesar di Indonesia. Variabilitas iklim mikro dan topografi pegunungan terjal membutuhkan sistem informasi cuaca beresolusi spasial tinggi untuk:
1. Menjaga produktivitas dan kualitas specialty coffee dari serangan penyakit karat daun (*Hemileia vastatrix*).
2. Memandu proses pascapanen penjemuran gabah/green bean dengan presisi radiasi matahari.
3. Melindungi warga dan petani dari bencana hidrometeorologi (tanah longsor di lereng perkebunan dan banjir luapan Danau Lut Tawar).

## Teknologi
- **Framework:** React 19 + Vite 6 (PWA)
- **Styling:** Tailwind CSS
- **Data Engine:** Integrasi stream meteorologi resolusi tinggi ECMWF / WeatherNext 2–3; nowcast resmi BMKG (RSS CAP); NASA IMERG Late (sumber primer antecedent rainfall index, fallback model)
- **Test:** Native Node.js Test Runner

## Fitur (PRD F1–F8)
- Konsensus multi-model (F1), antecedent rainfall index (F2), PWA offline + i18n id-ID/Gayo + mode terang-gelap (F3), riwayat bencana per sentra (F4), nowcast resmi BMKG (F5), diseminasi Telegram (F6), kalender risiko musiman (F7), lapor warga dengan relay Telegram (F8).
- Detail status & desain: repo `niu-gayo-agroclimate-docs` (DISASTER-DATA-RESEARCH.md, PLAN.md).

## Menjalankan Proyek
```bash
# Install dependencies
npm install

# Jalankan development server
npm run dev

# Jalankan pengujian
npm test

# Build production
npm run build
```
