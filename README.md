# 📸 Photobooth MAP PASTI Raudah Az-Zahrah 2026

App photobooth untuk **Majlis Anugerah Prestasi PASTI Raudah Az-Zahrah 2026**.

- Tetamu hanya buka pautan, tiada log masuk.
- Boleh digunakan di iPhone, Android dan komputer Windows.
- Boleh dipasang seperti app biasa dan dibuka tanpa internet selepas kali pertama.
- Setiap foto dihantar secara automatik ke folder Google Drive majlis.

Panduan ini ditulis untuk orang yang **bukan pengaturcara**. Ikut langkah satu demi satu.
Anda perlu buat 3 bahagian, mengikut urutan ini:

1. **Bahagian A** – Sediakan Google Apps Script (penerima foto ke Google Drive)
2. **Bahagian B** – Letak app di GitHub Pages (supaya ada pautan app)
3. **Bahagian C** – Buka dan pasang app di telefon / komputer

---

## Isi kandungan folder

| Fail / folder | Kegunaan |
|---|---|
| `index.html` | Halaman app |
| `style.css` | Rupa dan warna app |
| `app.js` | Fungsi kamera, bingkai, simpan foto |
| `queue.js` | Simpanan sementara foto & muat naik semula |
| `config.js` | **Tempat anda tampal URL Google Apps Script** |
| `manifest.json` | Maklumat untuk pasang app |
| `service-worker.js` | Supaya app boleh dibuka tanpa internet |
| `frames/` | 4 bingkai (Ungu/Biru × Potret/Landskap) |
| `icons/` | Ikon app |

Kod Google Apps Script berada **di luar** folder ini, dalam fail `Google-Apps-Script/Code.gs`.
Fail itu **tidak perlu** dimuat naik ke GitHub.

---

## BAHAGIAN A – Google Apps Script (simpan foto ke Google Drive)

> Gunakan akaun Google yang **memiliki** (atau boleh menulis ke) folder Drive majlis:
> https://drive.google.com/drive/folders/1XYt2xKMVedopSoYyDZuU2qFFQJEmruPk

### A1. Buka Google Apps Script
1. Di komputer, buka pelayar (Chrome atau Edge).
2. Pergi ke **https://script.google.com**
3. Log masuk dengan akaun Google anda (akaun yang ada folder Drive majlis).

### A2. Buat projek baharu
1. Tekan butang **“+ New project”** (Projek baharu) di sebelah kiri atas.
2. Di bahagian atas, tekan tulisan **“Untitled project”**.
3. Tukar nama kepada `Penerima Foto MAP PASTI 2026`, kemudian tekan **Rename**.

### A3. Salin dan tampal kod
1. Buka fail `Google-Apps-Script/Code.gs` (guna Notepad).
2. Tekan **Ctrl + A** (pilih semua), kemudian **Ctrl + C** (salin).
3. Kembali ke Apps Script. Anda akan nampak fail `Code.gs` dengan sedikit kod `function myFunction() {...}`.
4. Klik di dalam ruang kod, tekan **Ctrl + A**, kemudian **Delete** untuk padam semuanya.
5. Tekan **Ctrl + V** untuk tampal kod baharu.
6. Tekan ikon **💾 Save** (atau **Ctrl + S**).

### A4. Semak ID folder Google Drive
Di bahagian atas kod, pastikan baris ini betul (sudah ditetapkan untuk anda):

```
var FOLDER_ID = '1XYt2xKMVedopSoYyDZuU2qFFQJEmruPk';
```

ID folder ialah bahagian hujung pautan folder Drive, selepas `/folders/`.

### A5. Beri kebenaran (sekali sahaja)
1. Di bar atas, pada kotak pilihan fungsi, pilih **`ujianSimpan`**.
2. Tekan **▶ Run**.
3. Akan keluar tetingkap **“Authorization required”**. Tekan **Review permissions**.
4. Pilih akaun Google anda.
5. Jika keluar amaran **“Google hasn’t verified this app”**:
   tekan **Advanced** → **Go to Penerima Foto MAP PASTI 2026 (unsafe)**.
   *(Ini normal kerana skrip ini anda buat sendiri.)*
6. Tekan **Allow**.
7. Buka folder Drive majlis. Anda patut nampak fail **`MAPPASTI2026_ujian.jpg`**. Ini tanda skrip boleh menulis ke folder. (Fail ujian ini boleh dipadam.)

### A6. Deploy sebagai Web App
1. Di kanan atas, tekan butang biru **Deploy** → **New deployment**.
2. Tekan ikon gear ⚙️ di sebelah “Select type”, pilih **Web app**.
3. Isi:
   - **Description**: `Photobooth MAP 2026`
   - **Execute as**: **Me** (alamat e-mel anda) ← *penting*
   - **Who has access**: **Anyone** ← *penting* (bukan “Anyone with Google account”)
4. Tekan **Deploy**.

### A7. Dapatkan URL `/exec`
1. Selepas deploy, akan keluar **Web app URL** yang bermula dengan
   `https://script.google.com/macros/s/...` dan berakhir dengan **`/exec`**.
2. Tekan **Copy**. Simpan URL ini (tampal dalam Notepad dahulu).

### A8. Masukkan URL ke dalam `config.js`
1. Buka fail `config.js` dalam folder app (guna Notepad).
2. Gantikan `PASTE_YOUR_WEB_APP_EXEC_URL_HERE` dengan URL anda. Hasilnya lebih kurang begini:

```
const CONFIG = {
  GOOGLE_SCRIPT_URL: "https://script.google.com/macros/s/AKfycb.................../exec"
};
```

3. Pastikan tanda petikan `"` di kedua-dua hujung masih ada. Simpan fail.

### A9. Uji penerima foto
1. Tampal URL `/exec` di pelayar dan tekan Enter.
2. Anda patut nampak tulisan seperti:
   `{"ok":true,"message":"Pelayan foto MAP PASTI 2026 aktif","folder":"..."}`
3. Selepas app siap di GitHub (Bahagian B), ambil satu foto dalam app.
   Status di bawah foto akan bertukar **“Menyimpan...”** → **“✅ Berjaya disimpan”**.
4. Buka folder Google Drive majlis. Foto baharu bernama seperti
   `MAPPASTI2026_ungu_portrait_20261127_143025.jpg` patut ada di situ.

> **Jika anda ubah kod Apps Script kemudian:** Deploy → **Manage deployments** → ikon ✏️ →
> Version: **New version** → **Deploy**. URL `/exec` kekal sama.

---

## BAHAGIAN B – GitHub Pages (pautan app percuma)

### B1. Buat akaun GitHub (jika belum ada)
1. Pergi ke **https://github.com/signup**
2. Masukkan e-mel, kata laluan dan nama pengguna (contoh: `pastiraudah`).
3. Ikut arahan pengesahan e-mel.

### B2. Buat repository baharu
1. Log masuk ke GitHub. Tekan **+** di kanan atas → **New repository**.
2. **Repository name**: `MAP-PASTI-RAUDAH-2026`
3. Pilih **Public** (wajib untuk GitHub Pages percuma).
4. Tekan **Create repository**.

### B3. Muat naik semua fail app
1. Dalam repository baharu, tekan pautan **“uploading an existing file”**
   (atau **Add file** → **Upload files**).
2. Buka folder `MAP-PASTI-RAUDAH-2026` di komputer anda.
3. Pilih **semua isi** dalam folder itu (Ctrl + A) — termasuk folder `frames` dan `icons` —
   kemudian **seret (drag)** ke kawasan muat naik di GitHub.
   - Pastikan `index.html` berada di **tingkat paling atas** repository,
     bukan di dalam folder lain.
4. Tunggu semua fail selesai dimuat naik.
5. Di bawah, tekan **Commit changes**.
6. Semak: repository anda patut ada `index.html`, `config.js`, `app.js`, folder `frames`, folder `icons`, dan lain-lain.

### B4. Hidupkan GitHub Pages
1. Dalam repository, tekan **Settings** (ikon gear di atas).
2. Di menu kiri, tekan **Pages**.
3. Di bawah **Build and deployment** → **Source**, pilih **Deploy from a branch**.
4. Di bawah **Branch**, pilih **main** dan folder **/ (root)**, kemudian tekan **Save**.
5. Tunggu 1–3 minit, kemudian muat semula halaman.

### B5. Dapatkan pautan app
1. Di halaman **Settings → Pages**, akan keluar:
   **“Your site is live at https://NAMA-PENGGUNA.github.io/MAP-PASTI-RAUDAH-2026/”**
2. Itulah **pautan app**. Kongsikan kepada ibu bapa dan tetamu
   (WhatsApp, kod QR di pintu masuk, dan sebagainya).

### Cara kemas kini app selepas ini
- Untuk ubah `config.js`: buka fail itu di GitHub → ikon ✏️ (Edit) → ubah → **Commit changes**.
- Setiap kali anda ubah fail app, buka juga `service-worker.js` dan naikkan nombor
  `const VERSION = "v1";` kepada `"v2"`, `"v3"` dan seterusnya.
  Ini memastikan telefon tetamu mendapat versi terbaru.

---

## BAHAGIAN C – Buka & pasang app

### C1. Buka app di Android
1. Buka pautan app dalam **Google Chrome**.
2. Pilih warna (**Ungu** atau **Biru**) dan tekan bingkai (**Potret** atau **Landskap**).
3. Apabila diminta, tekan **Allow / Benarkan** untuk akses kamera.

### C2. Pasang app di Android
1. Di halaman utama app, tekan butang **⬇️ Pasang Aplikasi**, kemudian **Install / Pasang**.
2. Jika butang itu tiada tindak balas: tekan menu **⋮** Chrome → **Install app** atau **Add to Home screen**.
3. Ikon **MAP PASTI 2026** akan muncul di skrin utama telefon.

### C3. Buka app di iPhone
1. Buka pautan app dalam **Safari** (bukan dari dalam WhatsApp/Facebook —
   jika dibuka dari situ, tekan ikon kompas/“Open in Safari” dahulu).
2. Apabila diminta, tekan **Allow** untuk akses kamera.

### C4. Add to Home Screen di iPhone
1. Dalam Safari, tekan butang **Kongsi** (petak dengan anak panah ke atas ⬆️) di bawah skrin.
2. Skrol ke bawah dan pilih **Add to Home Screen** (Tambah ke Skrin Utama).
3. Tekan **Add**. Ikon app akan muncul di skrin utama.

**Simpan foto di iPhone:** selepas ambil gambar, tekan **📥 Simpan ke Foto**, kemudian pilih
**Save Image**. Gambar akan masuk ke app Photos/Galeri.

### C5. Pasang di komputer Windows
1. Buka pautan app dalam **Google Chrome** atau **Microsoft Edge**.
2. Tekan butang **⬇️ Pasang Aplikasi** di halaman utama, kemudian **Install**.
   - Atau: tekan ikon pasang (🖥️⬇) di hujung kanan bar alamat.
3. App akan terbuka dalam tetingkap sendiri dan ada ikon di menu Start.

---

## Cara app berfungsi (ringkas)

1. **Laman Utama** – pilih warna (diingati untuk lain kali) dan bingkai.
2. **Kamera** – pratonton langsung dengan bingkai.
   - Butang bulat emas: kira detik **3-2-1**, kilat putih, gambar diambil.
   - **Galeri**: pilih foto sedia ada dari telefon, kemudian tekan **✓ Guna foto ini**.
   - **Tukar kamera**: kamera depan ↔ belakang.
   - **Slider zum**: ke kiri = nampak seluruh foto (tepi diisi foto kabur);
     tengah = penuhkan tingkap (lalai); ke kanan = besarkan.
   - **Seret** foto dengan jari/tetikus untuk ubah kedudukan.
3. **Hasil** – foto akhir. **Muat Turun** (Android/Windows) atau **Simpan ke Foto** (iPhone).
   **Ambil Semula** untuk gambar baharu.

**Muat naik automatik:**
- Ada internet → status **“Menyimpan...”** kemudian **“✅ Berjaya disimpan”**.
- Tiada internet → status **“📶 Menunggu sambungan internet”**. Foto disimpan dalam telefon
  dan dihantar sendiri apabila internet kembali (semasa app dibuka). Jika ada foto tertunggak,
  laman utama akan menunjukkan **“📤 X foto menunggu dimuat naik”** dengan butang **Cuba sekarang**.

---

## Uji sendiri dengan telefon (sebelum majlis)

Saya telah menguji app ini secara automatik dengan **kamera palsu** dalam Chrome di komputer.
**Kamera telefon sebenar belum diuji**, dan **Google Drive sebenar belum diuji** (kerana URL `/exec`
anda belum wujud). Sila buat semakan ini:

1. **Android** – buka pautan, pilih Ungu + Potret, benarkan kamera.
   - Muka anda tidak kelihatan terlalu dekat/terzum.
   - Tekan butang emas → nampak 3, 2, 1 dan kilat.
   - Foto akhir sama seperti pratonton. Tekan **Muat Turun** → semak nama fail dalam Downloads.
2. **iPhone** – buka dalam Safari, ulang langkah yang sama. Tekan **Simpan ke Foto** → **Save Image**
   → semak app Photos.
3. **Tukar kamera** – cuba kamera belakang.
4. **Galeri** – pilih satu foto lama, gerakkan slider ke kiri dan kanan, tekan **✓ Guna foto ini**.
5. **Google Drive** – selepas setiap foto, semak status **“✅ Berjaya disimpan”** dan semak folder Drive.
6. **Tanpa internet** – hidupkan **Airplane mode**, ambil satu foto → status
   **“📶 Menunggu sambungan internet”**. Matikan Airplane mode dan buka semula app →
   foto patut masuk ke Drive dalam beberapa saat.
7. **Buka tanpa internet** – selepas pernah dibuka sekali, hidupkan Airplane mode dan buka app
   dari ikon skrin utama. Laman utama dan bingkai patut masih keluar.

---

## Masalah biasa

| Masalah | Penyelesaian |
|---|---|
| Kamera tidak keluar / “Kebenaran kamera ditolak” | iPhone: **Settings → Safari → Camera → Allow**. Android: tekan ikon 🔒 di bar alamat → **Permissions → Camera → Allow**. Kemudian tekan **Cuba lagi**. |
| Kamera tidak keluar bila dibuka dari WhatsApp | Buka pautan dalam Safari/Chrome yang sebenar. |
| Status “⚠️ Google Drive belum ditetapkan” | URL belum dimasukkan dalam `config.js` (langkah A8), atau masih ada perkataan `PASTE_`. |
| Status “Menunggu sambungan internet” walaupun ada internet | Semak langkah A6: **Execute as: Me** dan **Who has access: Anyone**. Buka URL `/exec` di pelayar (langkah A9). |
| Telefon masih tunjuk versi lama selepas kemas kini | Naikkan `VERSION` dalam `service-worker.js`, kemudian tutup dan buka semula app 2 kali. |
| Foto tidak masuk Drive | Pastikan akaun yang deploy skrip boleh menulis ke folder Drive majlis. |

---

## Nota teknikal ringkas

- Tiada framework, tiada build. Hanya HTML, CSS dan JavaScript biasa.
- Pratonton dan foto akhir dilukis oleh **fungsi yang sama** pada kanvas, jadi kedudukan, zum,
  potongan dan bingkai adalah sama.
- Kamera diminta dalam nisbah asli **4:3** (tidak dipaksa menjadi potret).
- Tingkap foto dikesan secara automatik daripada kawasan lutsinar dalam fail bingkai PNG.
  Jika anda mahu tukar bingkai, gantikan fail dalam `frames/` dengan nama yang sama
  (PNG dengan bahagian tengah lutsinar), dan naikkan `VERSION` dalam `service-worker.js`.
- Kamera depan dipaparkan seperti cermin, dan foto yang disimpan juga seperti cermin
  (sama seperti pratonton).
- Saiz foto akhir: Potret 1184 × 2000 piksel, Landskap 1824 × 1496 piksel (JPEG kualiti 92%).
- Nama fail: `MAPPASTI2026_<warna>_<portrait|landscape>_<tarikh>_<masa>.jpg`
  (mengikut tarikh & masa telefon semasa gambar diambil).
