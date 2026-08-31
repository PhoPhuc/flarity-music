<div align="center">

# 🎵 Flarity Music

**Trình phát nhạc thế hệ mới: Chuẩn phòng thu Audiophile • Dịch lời bài hát bằng AI • Siêu nhẹ chỉ ~400MB RAM**

[![Release](https://img.shields.io/badge/Release-v1.1.2-FA243C?style=for-the-badge)](https://github.com/PhoPhuc/flarity-music/releases/tag/v1.1.2)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-06B6D4?style=for-the-badge)](https://github.com/PhoPhuc/flarity-music/releases)
[![Rust](https://img.shields.io/badge/Backend-Rust%20Tauri%20v2-orange?style=for-the-badge&logo=rust)](https://tauri.app)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite%208-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![TailwindCSS](https://img.shields.io/badge/Styling-Tailwind%20v4-38B2AC?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

[**📥 Tải Về Cho Windows & macOS**](https://github.com/PhoPhuc/flarity-music/releases/tag/v1.1.2) • [**✨ Tính Năng Nổi Bật**](#-tính-năng-nổi-bật) • [**📊 So Sánh Hiệu Năng**](#-so-sánh-với-spotify--apple-music) • [**🛠️ Hướng Dẫn Cài Đặt & Biên Dịch**](#️-hướng-dẫn-phát-triển--biên-dịch)

</div>

---

## 🌟 Giới Thiệu (Overview)

**Flarity Music** là ứng dụng nghe nhạc và trình chiếu đa phương tiện cao cấp được thiết kế với mục tiêu mang lại trải nghiệm âm thanh thuần khiết, tốc độ phản hồi tức thì và tính thẩm mỹ vượt trội.

Được xây dựng trên nền tảng **Rust (Tauri v2)** kết hợp với **React 19** và **Web Audio DSP**, Flarity Music giải phóng máy tính của bạn khỏi sự nặng nề của các ứng dụng nền Electron truyền thống: **chỉ tiêu thụ ~400MB RAM**, khởi động trong **0.35 giây**, hoàn toàn **không quảng cáo** và không thu thập dữ liệu gián điệp.

---

## ✨ Tính Năng Nổi Bật (Key Features)

### 🤖 1. Hệ Sinh Thái Dịch Lời Bài Hát Bằng AI Đa Mô Hình (AI Bilingual Lyrics)
- **Thấu hiểu văn hóa & thi ca**: Tự động phân tích ngữ cảnh, tâm trạng bài hát, phong cách nghệ sĩ và ẩn dụ để dịch thoát ý, êm tai và giàu nhạc tính.
- **Hỗ trợ đa dạng Engine AI hàng đầu**:
  - **Google Gemini**: Mặc định **`gemini-3.5-flash-lite`** (siêu nhanh & nhẹ), **`gemini-3.7-flash`**, `gemini-2.0-flash`, `gemini-2.0-pro-exp-02-05`, `gemini-1.5-pro` và hỗ trợ nhập bất kỳ Model ID tùy chỉnh nào.
  - **Anthropic Claude**: Mặc định **`claude-3-7-sonnet-20250219`** (Flagship 3.7 với tư duy Hybrid Reasoning), `claude-3-5-sonnet`, `claude-3-5-haiku`.
  - **OpenAI**: `gpt-4o`, `gpt-4o-mini`, `o3-mini`, `gpt-4.5-preview`.
  - **OpenRouter**: Kết nối tức thì tới Claude 3.7, Gemini 2.0, DeepSeek V3, Llama 3.3.
  - **Google Dịch Tự Động**: Miễn phí 100%, không cần tài khoản hay API Key.
  - **Custom OpenAI-Compatible API**: Tương thích hoàn hảo với Ollama, LM Studio (Private Local AI).
- **Bộ lọc làm sạch thông minh (`stripLineIndexPrefix`)**: Tự động loại bỏ hoàn toàn các tiền tố số thứ tự (`[10]`, `(1)`, `1.`), giữ lời dịch luôn mượt mà.
- **Tùy biến hiển thị Sub-text phong phú**:
  - 4 Phong cách mẫu: **Apple Music**, **Spotify**, **Cinema Subtitle**, **Song Ca Neon Glow**.
  - 3 Cỡ chữ linh hoạt: Nhỏ xinh (`tiny`), Vừa vặn (`small`), Rõ nét (`medium`).
  - Bảng màu sẵn có & Color Picker tự do chọn mọi mã màu Hex.

### 🎧 2. Trình Phát Âm Thanh Hi-Res Lossless & Bộ DSP Chuyên Nghiệp
- **Định dạng hỗ trợ**: FLAC 24-bit/192kHz, ALAC, WAV, DSD, MP3, AAC, OGG, OPUS, M4A.
- **Bộ cân bằng 10-Band Graphic Equalizer**: 32Hz đến 16kHz kèm các Preset chuyên nghiệp (*Vocal Boost, Bass Heavy, Acoustic, Electronic, Rock, R&B, Flat*).
- **Hiệu ứng âm thanh không gian**: Analog Bass Booster, Spatial Reverb phòng hòa nhạc, Stereo Widener.
- **Chuẩn hóa âm lượng (Volume Normalization)**: Chuẩn EBU R128 / LUFS giúp chuyển bài êm ái, cân bằng độ to nhỏ tự động.

### 🎨 3. Giao Diện Kính Mờ Glassmorphism & 4 Chế Độ Visualizer
- **4 Chế độ Shaders nền sống động**:
  - *Dynamic Canvas Fluid*: Dòng chảy màu sắc biến thiên theo ảnh bìa Album.
  - *Ambient Waveform*: Sóng âm 3D dao động theo nhịp điệu bài hát.
  - *Particle Cloud*: Mây hạt phát sáng nhảy theo tần số bass.
  - *Glass Blur*: Hiệu ứng kính mờ tối giản, sang trọng.
- **True Native Fullscreen**: Chế độ toàn màn hình không viền chuyên nghiệp, tự động ẩn trỏ chuột khi xem lời bài hát.

### 📥 4. Tải Nhạc Đa Luồng Siêu Tốc & Tìm Kiếm YouTube
- Tìm kiếm và stream hàng triệu bài hát trực tuyến từ YouTube Music chất lượng cao không cần đăng nhập.
- Tải nhạc đa luồng tốc độ cao, tự động nhúng Tag ID3/FLAC metadata và ảnh bìa chất lượng cao vào tệp tải về.
- Xem Music Video 1080p với chế độ cửa sổ nổi Picture-in-Picture (PiP).

---

## 📊 So Sánh Với Spotify & Apple Music

| Tiêu Chí / Tính Năng | 🚀 FLARITY MUSIC | 🟢 SPOTIFY DESKTOP | 🍎 APPLE MUSIC WINDOWS |
| :--- | :---: | :---: | :---: |
| **Kiến trúc Engine** | **Rust Tauri v2 + React 19** | Electron / CEF | UWP / WebView Container |
| **Mức tiêu thụ RAM trung bình** | **~400 MB** *(Siêu tiết kiệm)* | **~950 MB - 1.6 GB** | **~800 MB - 1.2 GB** |
| **Thời gian khởi động (Startup)**| **~0.35 giây** *(Gần như tức thì)* | ~2.80 giây | ~3.20 giây |
| **Dung lượng bộ cài đặt (Size)** | **~5.95 MB (ZIP Portable)** | ~280 MB | ~180 MB |
| **Dịch Lời Bài Hát Bằng AI** | ✅ **Đa mô hình (Gemini, Claude, GPT)**| ❌ Không có | ❌ Không có |
| **Tùy biến Style Lời Dịch** | ✅ **Apple / Spotify / Cinema / Neon**| ❌ Không có | ❌ Không có |
| **Chế độ Không Lời (Instrumental)**| ✅ **Có (Ambient 3D Waves)** | ❌ Màn hình trống | ❌ Không có |
| **Chất lượng âm thanh tối đa** | ✅ **Hi-Res FLAC 24-bit / 192kHz** | ⚠️ Ogg 320kbps (Lossy) | ✅ ALAC Lossless (Trả phí) |
| **Equalizer 10-Band & DSP Bass**| ✅ **Tích hợp sẵn & Tự do tùy chỉnh** | ⚠️ EQ 6-band cơ bản | ⚠️ EQ cơ bản hạn chế |
| **Tải nhạc Offline về máy** | ✅ **Tải FLAC/MP3 trực tiếp miễn phí** | ⚠️ Bị mã hóa DRM | ⚠️ Bị mã hóa DRM |
| **Quảng cáo xen ngang (Ads)** | 🚫 **100% Hoàn toàn không quảng cáo**| ⚠️ Quảng cáo dày đặc (Bản Free)| ⚠️ Bắt buộc trả phí theo tháng|
| **Quyền riêng tư & Telemetry** | 🔒 **100% Local / Không theo dõi** | ⚠️ Thu thập dữ liệu người dùng | ⚠️ Thu thập dữ liệu Apple ID |
| **Mô hình chi phí** | 🎁 **Miễn Phí & Mã Nguồn Mở** | 💵 59.000đ - 119.000đ / tháng | 💵 65.000đ / tháng |

---

## ⚡ Đo Lường Hiệu Năng & Tiêu Thụ RAM

```
Mức tiêu thụ RAM trung bình (Megabytes - Càng thấp càng tốt):
┌────────────────────────────────────────────────────────────────────────┐
│ Flarity Music :  ██████████ 400 MB                                     │
│ Apple Music   :  ████████████████████ 800 MB - 1.2 GB                  │
│ Spotify App   :  ██──────────────────────────────── 1.4 GB             │
└────────────────────────────────────────────────────────────────────────┘

Thời gian khởi động ứng dụng (Giây - Càng thấp càng tốt):
┌────────────────────────────────────────────────────────────────────────┐
│ Flarity Music :  █ 0.35s                                               │
│ Spotify App   :  ████████ 2.80s                                        │
│ Apple Music   :  █████████ 3.20s                                       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📥 Tải Về (Downloads)

Truy cập [**GitHub Releases**](https://github.com/PhoPhuc/flarity-music/releases/tag/v1.1.2) để tải bản phát hành mới nhất:

### 🪟 Windows (x64)
- **[`Flarity-Music-1.1.2-x64-setup.exe`](https://github.com/PhoPhuc/flarity-music/releases/download/v1.1.2/Flarity-Music-1.1.2-x64-setup.exe)**: Bộ cài đặt chuẩn Windows (NSIS).
- **[`Flarity-Music-1.1.2-portable-x64.zip`](https://github.com/PhoPhuc/flarity-music/releases/download/v1.1.2/Flarity-Music-1.1.2-portable-x64.zip)**: Bản Portable nén gọn kèm `WebView2Loader.dll` (giải nén chạy ngay).
- **[`Flarity-Music-1.1.2-x64.msi`](https://github.com/PhoPhuc/flarity-music/releases/download/v1.1.2/Flarity-Music-1.1.2-x64.msi)**: Bộ cài đặt MSI doanh nghiệp.

### 🍎 macOS (Apple Silicon M1/M2/M3/M4 & Intel)
- **`Flarity-Music-macOS-Universal.dmg`**: Tự động biên dịch qua [GitHub Actions](https://github.com/PhoPhuc/flarity-music/actions).

---

## 🛠️ Hướng Dẫn Phát Triển & Biên Dịch (Development)

### Yêu cầu môi trường:
- **Node.js** (v18 trở lên) & **npm**
- **Rust toolchain** (`cargo`, `rustc` 1.80 trở lên)

### 1. Cài đặt mã nguồn:
```bash
git clone https://github.com/PhoPhuc/flarity-music.git
cd flarity-music
npm install
```

### 2. Chạy môi trường phát triển (Dev Mode):
```bash
npm run dev
```

### 3. Đóng gói cho Windows:
```bash
npm run dist
```
*Tệp thực thi và bộ cài đặt sẽ được tạo trong thư mục `release/`.*

### 4. Đóng gói cho macOS (Universal DMG):
```bash
npm run build:macos
```

---

## 🏛️ Cấu Trúc Mã Nguồn (Project Structure)

```
flarity-music/
├── .github/workflows/          # Quy trình CI/CD tự động hóa build Windows & macOS
├── public/                     # Tài nguyên tĩnh
├── scripts/                    # Scripts đóng gói Portable và phát hành
├── src/                        # Mã nguồn Frontend (React 19 + TypeScript)
│   ├── components/             # Các thành phần UI Glassmorphism
│   │   ├── LyricView.tsx       # Trình hiển thị lời bài hát & Sub-text AI
│   │   ├── LyricsPanel.tsx     # Bảng điều khiển lời bài hát
│   │   ├── LyricsTranslationPopover.tsx # Hộp thoại dịch nhanh
│   │   ├── LyricsVisualizerBg.tsx       # Shaders hiệu ứng nền
│   │   ├── SettingsModal.tsx   # Cài đặt âm thanh, AI Key, giao diện
│   │   └── ...
│   ├── context/                # Trạng thái toàn cục (PlayerContext)
│   ├── services/               # Dịch vụ dịch thuật AI (lyricsTranslationService.ts)
│   ├── utils/                  # Xử lý âm thanh DSP, LRC parser, Tauri bridge
│   ├── types.ts                # Định nghĩa kiểu dữ liệu TypeScript
│   └── App.tsx                 # Khung ứng dụng chính
├── src-tauri/                  # Nhân Backend (Rust Tauri v2)
│   ├── src/                    # Lệnh Rust IPC, quét thư viện, xử lý I/O
│   ├── tauri.conf.json         # Cấu hình đa nền tảng Windows & macOS
│   └── Cargo.toml              # Dependencies Rust
├── package.json                # Cấu hình npm scripts & dependencies
└── README.md
```

---

## 📜 Giấy Phép (License)

Dự án được phân phối dưới giấy phép mã nguồn mở **MIT License**. Bạn có thể tự do sử dụng, tùy biến và đóng góp phát triển.

---

<div align="center">
  <b>Phát triển với niềm đam mê âm thanh đỉnh cao và công nghệ hiện đại.</b>
</div>

