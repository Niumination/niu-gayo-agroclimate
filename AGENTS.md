# Niu-Gayo-Agroclimate — Project AGENTS.md

**Lokasi:** `apps/niu-gayo-agroclimate/`  
**Stack:** React 19, Vite 6, Tailwind CSS, Open-Meteo & WeatherNext 3 Pipeline, Node Native Test  
**Remote:** `github.com/Niumination/niu-gayo-agroclimate`  
**Kategori:** Apps — Pertanian Kopi Arabika Gayo & Mitigasi Bencana Hidrometeorologi  

## Overview

Niu Gayo Agro-Climate adalah dashboard web presisi tinggi untuk memantau mikroklimat perkebunan kopi Arabika Gayo dan sistem peringatan dini bencana hidrometeorologi (longsor lereng terjal, banjir luapan Danau Lut Tawar & DAS Peusangan) di 15 wilayah sentra agro-ekologi Kabupaten Aceh Tengah.

## Fitur Utama

1. **Pemantauan Mikroklimat Kopi Arabika:**
   - Evaluasi suhu optimal (15°C – 24°C).
   - Deteksi risiko jamur karat daun (*Hemileia vastatrix*) berbasis kelembapan relatif tinggi (>85%) dan temperatur hangat.
   - Analisis jendela penjemuran (*post-harvest drying window*) berbasis radiasi surya normal langsung (*direct normal irradiance*) dan curah hujan.
2. **Sistem Peringatan Dini Bencana Alam:**
   - Deteksi potensi tanah longsor lereng perkebunan berbasis akumulasi presipitasi harian (>25mm waspada, >50mm bahaya).
   - Status muka air & luapan Daerah Tangkapan Air Danau Lut Tawar dan DAS Peusangan.
   - Peringatan kecepatan angin kencang (>35 km/jam) untuk keselamatan pohon pelindung kopi.
3. **Cakupan Wilayah:**
   - 15 Sentra di Kabupaten Aceh Tengah (Bebesan, Takengon, Pegasing, Kute Panang, Atu Lintang, Jagong Jeget, Lut Tawar, Bintang, Kebayakan, Bies, Silih Nara, Ketol, Celala, Rusip Antara, Linge).

## Verification Commands

- Test: `npm test` (menjalankan unit test berbasis node test runner)
- Build: `npm run build` (menghasilkan bundle production Vite di `dist/`)
- Dev Server: `npm run dev` (berjalan di port 5188)
