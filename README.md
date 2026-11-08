# Closing SPX Express JTT08

Aplikasi web untuk otomasi recap & validasi data closing harian seluruh hub di JTT08.
OCR screenshot FMS → Google Sheets database → Dashboard terpusat.

---

## Fitur Utama

- **Paste Teks / Screenshot** — `Ctrl+A` → `Ctrl+C` dari FMS lalu `Ctrl+V` (akurasi 100%), atau paste multi-screenshot untuk OCR otomatis
- **OCR Otomatis (Gratis)** — Tesseract.js membaca tabel FMS secara lokal tanpa biaya API
- **Validasi Silang Otomatis** — Peringatan real-time jika ada selisih breakdown atau lonjakan ekstrem dibanding data kemarin
- **Dashboard Real-time** — Semua hub dalam satu tampilan dengan color coding
- **Access Control** — Setiap user hanya bisa input hub miliknya
- **History 1 Tahun** — Filter data per tanggal dan per hub

---

## Setup Google Cloud

### 1. Buat Google Cloud Project
1. Buka [console.cloud.google.com](https://console.cloud.google.com)
2. Buat project baru: `closing-spx-jtt08`

### 2. Enable APIs
Di menu **APIs & Services → Library**, aktifkan:
- **Google Sheets API**

> OCR menggunakan **Tesseract.js** yang berjalan lokal di browser (perangkat pengguna) — gratis, tidak perlu billing, tidak perlu Vision API.

### 3. OAuth 2.0 (untuk Login Google)
1. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client IDs**
2. Application type: **Web application**
3. Authorized redirect URIs tambahkan:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://your-domain.vercel.app/api/auth/callback/google` (production)
4. Salin **Client ID** dan **Client Secret**

### 4. Service Account (untuk Google Sheets)
1. **APIs & Services → Credentials → Create Credentials → Service Account**
2. Beri nama, klik Create
3. Di tab **Keys → Add Key → JSON** — download file JSON
4. Stringify JSON tersebut:
   ```js
   // Di Node.js console:
   JSON.stringify(require('./service-account-key.json'))
   ```
5. Salin hasilnya untuk `GOOGLE_SERVICE_ACCOUNT_KEY`

### 5. ~~Vision API Key~~ (Tidak diperlukan)
OCR menggunakan Tesseract.js — gratis, berjalan di browser (perangkat pengguna), tidak perlu API key.

---

## Setup Google Sheets

### Buat Spreadsheet baru
Buka [sheets.google.com](https://sheets.google.com) dan buat spreadsheet baru.
Salin **Spreadsheet ID** dari URL: `https://docs.google.com/spreadsheets/d/**SPREADSHEET_ID**/edit`

### Share ke Service Account
Klik **Share** → masukkan email service account (format: `xxx@xxx.iam.gserviceaccount.com`) → beri akses **Editor**

### Buat Sheet USER_MAPPING
Buat sheet dengan nama persis `USER_MAPPING` dan isi header di baris pertama:

| email | nama_hub | nama_user | status |
|-------|----------|-----------|--------|
| admin@gmail.com | Flumpang Hub | Budi Santoso | active |
| staff@gmail.com | Flumpang Hub | Sari Dewi | active |
| admin2@gmail.com | Bolon Hub | Andi Pratama | active |

**Aturan:**
- `email` harus persis sama dengan akun Google yang dipakai login
- `nama_hub` harus konsisten (huruf kapital sama) dengan data di FMS
- `status` harus `active` agar user bisa login

### Buat Sheet DATA_CLOSING
Buat sheet dengan nama persis `DATA_CLOSING` dan isi header di baris pertama:

```
tanggal | nama_hub | jumlah_trip | transported | received | assigning | assigned |
delivering | delivered | onhold_vol | onhold_harris | onhold_total | pct_success |
total_vol_runnas | total_parcel_swt | parcel_swt_pct | expedite | remark |
submitted_at | submitted_by
```

---

## Setup Environment Variables

Salin `.env.local` dan isi semua nilai:

```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
SPREADSHEET_ID=1BxiM...
NEXTAUTH_SECRET=random_32_char_string
NEXTAUTH_URL=http://localhost:3000
```

Generate `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

---

## Jalankan Lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`

---

## Deploy ke Vercel

1. Push ke GitHub repository
2. Import di [vercel.com](https://vercel.com)
3. Tambahkan semua environment variables di **Settings → Environment Variables**
4. Update `NEXTAUTH_URL` ke URL production Vercel
5. Tambahkan URL production ke **Authorized redirect URIs** di Google Cloud Console

---

## Panduan Penggunaan

### Input Closing Harian
1. Login dengan akun Google yang terdaftar
2. Klik **Input Closing** di navbar
3. Buka FMS di browser lain, screenshot halaman data hub
4. Kembali ke aplikasi, tekan **Ctrl+V** untuk paste screenshot
5. Ulangi jika data terpotong (bisa multi-screenshot)
6. Klik **Proses OCR**
7. Periksa hasil di tabel — edit cell yang salah (ditandai merah)
8. Klik **Konfirmasi & Simpan**

### Lihat Dashboard
1. Klik **Dashboard** di navbar
2. Data hari ini otomatis tampil
3. Gunakan filter tanggal untuk lihat history
4. Gunakan filter hub untuk fokus ke hub tertentu
5. Klik header kolom untuk sorting

### Tambah User Baru
1. Buka Google Sheets → Sheet `USER_MAPPING`
2. Tambah baris baru dengan email, nama hub, nama user, dan status `active`
3. User bisa langsung login (tidak perlu restart aplikasi)

---

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4
- **Auth**: NextAuth.js v5 + Google OAuth
- **OCR**: Tesseract.js (gratis, client-side di browser, tidak perlu billing)
- **Database**: Google Sheets (via googleapis)
- **UI Components**: Radix UI + Lucide Icons
- **Hosting**: Vercel
