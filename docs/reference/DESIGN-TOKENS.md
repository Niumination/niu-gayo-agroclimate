# Token Desain & Aturan Kontras (referensi)

**Status:** **diterapkan pada paket P1 (2026-10-16)** — token sudah ada di `src/index.css`, 417 utilitas teks beropasitas diganti, dan CI menjalankan `check:contrast -- --strict` (34/34 pasangan lulus). Angka kontras dihitung dengan rumus WCAG 2.2 memakai `scripts/check-contrast.mjs` yang sama dengan yang berjalan di CI, jadi tabel di sini tidak bisa "menyimpang" dari gerbang.

Sisa dari paket P1: ikon level baru dipasang di `HazardPanel` (glyph bentuk per tingkat); pemakaian **tint** latar kartu level + garis aksen 3 px dan ikon di kartu lain menyusul di **P2** (bersamaan dengan target sentuh & semantik tab).
**Dokumen pendamping:** rencana penerapan & audit di [`docs/dev/11-RENCANA-DESIGN-UX.md`](../dev/11-RENCANA-DESIGN-UX.md).

## 1. Aturan keras (checklist singkat kode review)

| # | Aturan | Alasan | Cara diperiksa |
|---|---|---|---|
| R1 | **Jangan pakai opasitas untuk teks** (`text-ink/45`, `dark:text-mist/40`). Pakai token peran (`text-ink-muted`, `text-mist-muted`). | 262 pemakaian opasitas saat ini ada di bawah 4,5:1 — opasitas mencampur warna di dalam ruang sRGB sehingga hasilnya tak pernah divalidasi. | `npm run check:contrast` |
| R2 | **Teks isi ≥ 16 px** (1 rem). 12–14 px hanya untuk label/metadata non-kritis dengan kontras ≥ 4,5:1. | 16 px = ambang praktis teks isi di ponsel; mencegah zoom otomatis iOS pada elemen ber-`font-size` < 16 px. | `npm run check:contrast` (bagian informasi) |
| R3 | **Komponen tidak menulis heks mentah**; semua warna lewat token `@theme` di `src/index.css`. | Satu sumber kebenaran; tema gelap cukup mengganti nilai token. | tinjauan kode + `grep -n "#[0-9a-fA-F]\{6\}" src/components` |
| R4 | **Ambang kontras:** teks 4,5:1 · teks besar/ikon/garis 3:1 · cincin fokus 3:1 terhadap latar bersebelahan. | WCAG 2.2 AA (1.4.3, 1.4.11, 2.4.11/2.4.13). | `npm run check:contrast -- --all` |
| R5 | **Makna tidak boleh hanya lewat warna.** Level bahaya wajib = warna + label teks + ikon/bentuk berbeda. | ~8 % pria mengalami buta warna merah-hijau; lampu lalu lintas merah/kuning/hijau gagal untuk mereka. | tinjauan komponen level |
| R6 | **Target sentuh ≥ 44×44 px** untuk aksi utama; minimum mutlak 24×24 px + jarak 24 px antar-target (WCAG 2.5.8). | Jari di layar ponsel saat hujan, sarung tangan, tangan basah. | tinjauan + uji manual |

## 2. Palet dasar (sudah ada di `@theme`)

| Keluarga | Inti | Terang (teks) | Gelap (teks) | Peran |
|---|---|---|---|---|
| soil | `#1A1512` | — | — | permukaan gelap |
| mist | `#E8E3DA` | — | — | teks tema gelap |
| leaf | `#4E7A52` | `#2F5A35` (leaf-deep) | `#8FBE93` (leaf-soft) | aman/primer |
| husk | `#C9A227` | `#7A6110` (husk-deep) | `#E6C868` (husk-soft) | waspada |
| cherry | `#A8392B` | `#8A2A1F` (cherry-deep) | `#E08B7E` (cherry-soft) | bahaya |
| rain | `#3E6B8A` | `#2C5069` (rain-deep) | `#8FB6CE` (rain-soft) | informasi |
| surface | `#FAF7F2` | — | — | permukaan terang |
| ink | `#221C18` | — | — | teks tema terang |

Keluarga `coffee-50…950` dipertahankan hanya untuk kompatibilitas komponen lama; **jangan dipakai di komponen baru**.

## 3. Token semantik (target — paket P1)

### 3.1 Permukaan & garis

| Token | Nilai tema terang | Nilai tema gelap | Catatan |
|---|---|---|---|
| `surface` | `#FAF7F2` | — | permukaan dasar terang (sudah ada) |
| `surface-raised` | `#FFFFFF` | — | kartu di atas permukaan (tema terang) |
| `surface-sunken` | `#F1ECE4` | — | area terbenam / catatan kaki |
| `soil` | — | `#1A1512` | permukaan dasar gelap (sudah ada) |
| `soil-raised` | — | `#241E19` | kartu tema gelap |
| `soil-sunken` | — | `#120E0B` | area terbenam tema gelap |
| `line-strong` | `#8A8078` | — | batas kontrol (3,61:1 → lolos non-teks) |
| `line-subtle` | `#DCD4C8` | — | pemisah dekoratif (bukan pembawa makna) |
| `line-strong-dark` | — | `#6B635C` | batas kontrol tema gelap (3,07:1) |
| `line-subtle-dark` | — | `#3A322B` | pemisah dekoratif gelap |

> Tema gelap memakai `#1A1512`/`#241E19`, bukan hitam murni `#000000`: hitam pekat + teks terang memicu *halation* (teks tampak bergetar/blur), terutama pada pengguna astigmatisma.

### 3.2 Teks — nilai & kontras terukur

**Tema terang** (latar permukaan di bawah):

| Token | Heks | di `surface` | di `surface-raised` | di `surface-sunken` |
|---|---|---|---|---|
| `ink` (teks utama) | `#221C18` | 15,75:1 | 16,84:1 | 14,32:1 |
| `ink-soft` (sekunder kuat) | `#3D352E` | 11,25:1 | 12,02:1 | 10,22:1 |
| `ink-body` (teks isi) | `#524941` | 8,23:1 | 8,79:1 | 7,48:1 |
| `ink-muted` (metadata/label) | `#6A6058` | 5,73:1 | 6,13:1 | 5,21:1 |
| `ink-subtle` (teks bantuan) | `#70665C` | 5,25:1 | 5,61:1 | 4,77:1 |

**Tema gelap:**

| Token | Heks | di `soil` | di `soil-raised` | di `soil-sunken` |
|---|---|---|---|---|
| `mist` (teks utama) | `#E8E3DA` | 14,17:1 | 12,89:1 | 15,03:1 |
| `mist-soft` (sekunder kuat) | `#D3CCC2` | 11,37:1 | 10,34:1 | 12,06:1 |
| `mist-body` (teks isi) | `#B8B1A7` | 8,52:1 | 7,75:1 | 9,04:1 |
| `mist-muted` (metadata) | `#A79F95` | 6,93:1 | 6,30:1 | 7,35:1 |
| `mist-subtle` (teks bantuan) | `#8F877E` | 5,12:1 | 4,66:1 | 5,43:1 |

Semua ≥ 4,5:1 pada **ketiga** permukaan → aman dipakai di kartu mana pun tanpa perlu menghitung ulang per konteks.

*Padanan opasitas lama → token baru* (aturan yang dipakai skrip penggantian pada paket P1 — 417 utilitas di 66 berkas):

| Pita opasitas | Contoh efektif & kontras sekarang | Token terang | Token gelap |
|---|---|---|---|
| `/25 – /42` | `ink/35` `#AEAAA6` 2,16:1 · `mist/40` `#6C6762` 3,24:1 | `text-ink-subtle` (5,25:1) | `text-mist-subtle` (5,12:1) |
| `/43 – /62` | `ink/45` `#999490` 2,81:1 · `ink/60` `#78746F` 4,34:1 · `mist/45` `#77726C` 3,80:1 | `text-ink-muted` (5,73:1) | `text-mist-muted` (6,93:1) |
| `/63 – /82` | `ink/70` 6,00:1 · `ink/75` 7,11:1 · `mist/70` 7,40:1 | `text-ink-body` (8,23:1) | `text-mist-body` (8,52:1) |
| `/83 – /100` | `ink/85` ≈ 7,10:1 (belum AA-aman di semua latar) | `text-ink-soft` (11,25:1) | `text-mist-soft` (11,37:1) |

Pita dipilih supaya **urutan visual tetap terjaga** (semakin "tebal" teks, semakin tinggi kontras) sambil seluruhnya melewati ambang AA; dua token jembatan (`ink-body`/`mist-body` ≈ 8:1) ditambahkan agar teks isi tidak menyatu dengan judul. Utilitas **non-teks** (`border-ink/10`, `bg-ink/5`, `divide-mist/10`) tetap boleh memakai opasitas karena dekoratif dan tidak membawa makna.

### 3.3 Lencana level bahaya (warna + ikon + label)

`level-*` = warna teks/lencana; `level-*-tint` = latar lencana (12 % dari warna level di atas permukaan tema).

| Level | Teks (terang) | Tint (terang) | Kontras teks/tint | Teks (gelap) | Kontras vs `soil` |
|---|---|---|---|---|---|
| rendah | `#3F6B4A` | `#E4E6DE` | 4,88:1 | `#8FC49A` | 9,08:1 |
| waspada | `#7A5A0B` | `#EBE4D6` | 5,04:1 | `#E6C868` | 11,06:1 |
| bahaya | `#9C4221` | `#EFE1D9` | 5,11:1 | `#F0A184` | 8,74:1 |
| ekstrem | `#7A2118` | `#EBDDD8` | 7,71:1 | `#F29BA0` | 8,60:1 |

Aturan tambahan untuk lencana/kartu level:

1. **Label teks wajib** (`Rendah`, `Waspada`, `Bahaya`, `Ekstrem`) — jangan pernah hanya titik warna.
2. **Ikon berbeda per level** (bukan warna berbeda saja): `rendah` = centang di lingkaran · `waspada` = segitiga tanda seru · `bahaya` = bel · `ekstrem` = segi-delapan/sirene. Bentuk tetap terbedakan saat buta warna atau cetak hitam-putih.
3. **Garis aksen kiri 3 px** pada kartu level memakai warna `level-*` (kontras 5,76–9,55:1 vs permukaan) karena tint latar saja hanya 1,18–1,24:1 — terlalu lemah untuk berdiri sendiri.
4. `ekstrem` masuk akal tanpa animasi berdenyut (`animate-pulse`): pulsasi harus dimatikan pada `prefers-reduced-motion` dan tidak menjadi satu-satunya penanda kegawatan.

### 3.4 Seri grafik & peta

| Peran | Terang (kontras vs surface) | Gelap (kontras vs soil) |
|---|---|---|
| seri-1 (curah hujan) | `#2C5069` (7,99:1) | `#8FB6CE` (8,41:1) |
| seri-2 (ambang waspada) | `#7A5A0B` (5,96:1) | `#E6C868` (11,06:1) |
| seri-3 (risiko tinggi) | `#9C4221` (6,11:1) | `#E08B7E` (7,04:1) |
| seri-4 (aman/normal) | `#2F5A35` (7,46:1) | `#8FBE93` (8,58:1) |
| seri-5 (proyeksi/cadangan) | `#6B4E8E` (6,33:1) | `#C0AEE0` (8,94:1) |

> Perhatian: pada simulasi buta warna, pasangan `seri-1`↔`seri-5` dan `seri-3`↔`seri-4` berdekatan (ΔE < 15) — **wajib** dibedakan lewat pola garis (putus-putus), bentuk penanda, atau label langsung di ujung garis, bukan hanya warna.

## 4. Skala tipografi

| Peran | Ukuran | Line-height | Pemakaian | Batasan |
|---|---|---|---|---|
| `text-headline` | 1,25 rem / 20 px (ponsel), 1,5 rem / 24 px (≥768 px) | 1,25 | judul nilai bahaya/headline | boleh tebal 600 |
| `text-body` | **1 rem / 16 px** | 1,6 | **default seluruh teks isi** | — |
| `text-body-sm` | 0,875 rem / 14 px | 1,55 | baris tabel, daftar anjuran | kontras ≥ 7:1 dianjurkan |
| `text-label` | 0,875 rem / 14 px, uppercase + tracking 0,04 em | 1,4 | label kolom/lencana | jangan untuk kalimat |
| `text-caption` | 0,75 rem / 12 px | 1,45 | stempel waktu, catatan kaki | minimum mutlak; kontras ≥ 4,5:1 |
| `text-data` | 0,875–1 rem, `font-data` (JetBrains Mono) | 1,4 | angka, satuan, koordinat | pakai `tabular-nums` |

Aturan: (a) jangan ada teks di bawah 12 px — saat ini ada 100 pemakaian 11 px dan 7 pemakaian 10 px; (b) `text-[10px]/[11px]` dinaikkan ke `text-caption` (12 px) atau dihilangkan; (c) satu preload font saja (`JetBrains Mono` subset latin + latin-ext, WOFF2, `font-display: swap`) — saat ini font di-*declare* tetapi **tidak di-self-host** sehingga semua angka jatuh ke monospace sistem.

## 5. Gerak (motion)

| Interaksi | Durasi | Easing |
|---|---|---|
| umpan balik tekan tombol | 90 ms | ease-out, `scale(0,97)` |
| hover/fokus | 120 ms | ease-out |
| masuk tab/ganti halaman | 200 ms (sudah dipakai `anim-enter`) | ease-out |
| dialog/sheet | 240 ms | ease-out masuk, ease-in keluar |
| transisi warna/tema | 150 ms | linear (satu-satunya pemakaian linear) |

Aturan: tidak ada animasi fungsional > 500 ms; `prefers-reduced-motion: reduce` **mematikan gerak, bukan fungsi** (konten akhir tetap muncul); jangan pakai `animate-pulse` untuk membawa makna.

## 6. Target sentuh, fokus, dan area aman

| Butir | Ketentuan |
|---|---|
| Tombol utama | ≥ 44×44 px (saat ini 24 tombol: 10 `min-h-[44px]`, 2 `h-11 w-11`) |
| Target sekunder | ≥ 24×24 px + jarak ≥ 24 px antar-target |
| Baris bawah (BottomNav) | tinggi ≥ 56 px + `padding-bottom: env(safe-area-inset-bottom)` |
| `viewport-fit=cover` | wajib di `index.html`, jika tidak `env(safe-area-inset-*)` selalu bernilai 0 |
| Cincin fokus | 2 px `outline` + `outline-offset: 2px`; warna `leaf-deep` (7,46:1 di terang) / `leaf-soft` (8,58:1 di gelap) |
| Larangan | `focus-visible:outline-none` tanpa pengganti (ada di `AppBar`), serta reset `blur` pada tombol |

## 7. Cara memverifikasi

```bash
npm run check:contrast             # ringkas: pasangan token + temuan opasitas + hitungan teks kecil
npm run check:contrast -- --all    # cetak seluruh pasangan yang diuji
npm run check:contrast -- --json   # keluaran mesin (untuk dasbor/CI)
npm run check:contrast -- --strict # keluar 1 bila ada temuan → DIPAKAI CI sejak P1 (2026-10-16)
```

Angka di dokumen ini boleh diperbarui asalkan tabel tetap dihasilkan dari sumber yang sama (jalankan skrip dengan `--css src/index.css`); bila token berubah dan kontras turun, gerbang `--strict` akan menolaknya.

## 8. Rujukan

- WCAG 2.2 (W3C): 1.4.3 Kontras Minimum · 1.4.11 Kontras Non-Teks · 2.4.11/2.4.13 Fokus Tidak Terhalang & Tampak · 2.5.7 Gerakan Menggeser · 2.5.8 Ukuran Target (Minimum) · 3.2.6 Bantuan Konsisten · 3.3.7 Entri Berulang · 3.3.8 Autentikasi Aksesibel.
- Palet aman buta warna: Wong (2011) dan IBM Design Library — dua rujukan yang jadi dasar pemisahan hijau/merah lewat perbedaan terang + bentuk di §3.3.
- Panduan teks & ukuran: penelitian ukuran teks isi ponsel (16 px sebagai ambang praktis), rekomendasi `font-size ≥ 16px` untuk input guna mencegah zoom otomatis iOS.
- Ikhtisar lengkap sumber + implikasi: §4 dokumen rencana [`docs/dev/11-RENCANA-DESIGN-UX.md`](../dev/11-RENCANA-DESIGN-UX.md).
