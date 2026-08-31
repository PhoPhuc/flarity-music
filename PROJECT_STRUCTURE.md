# Cấu Trúc Thư Mục Dự Án (Project Directory Structure)

**Dự án**: Flarity Desktop Music Player App (`musicccc`)  
**Stack chính**: Tauri 2 (Rust) + React 19 + TypeScript + Vite + Tailwind CSS + TanStack Query + TanStack Virtual + SQLite (`rusqlite`)

---

## 🌳 Cây Thư Mục Tổng Quan (Tree View)

```
musicccc/
├── public/                          # Tài nguyên tĩnh công khai cho Vite
│   ├── favicon.svg                  # Icon trang web
│   ├── icons.svg                    # Tập hợp SVG icon
│   └── logo.png                     # Logo mặc định fallback cho ứng dụng
│
├── src/                             # Mã nguồn Frontend (React + TypeScript)
│   ├── assets/                      # Hình ảnh & SVG dùng trong React
│   │   ├── hero.png                 # Banner hiển thị
│   │   ├── logo.png                 # Logo thu nhỏ
│   │   ├── react.svg
│   │   └── vite.svg
│   │
│   ├── components/                  # Giao diện UI & Các React Components
│   │   ├── MainView/                # Các màn hình xem danh mục chính
│   │   │   ├── AlbumDetail.tsx      # Màn hình chi tiết Album bài hát
│   │   │   ├── AlbumGrid.tsx        # Lưới danh sách Album (Cover Art & Quick Play)
│   │   │   └── TrackList.tsx        # Danh sách bài hát (Virtual List 60fps + convertFileSrc)
│   │   │
│   │   ├── AnalyticsView.tsx        # Màn hình Thống Kê / Leaderboard (TanStack Query)
│   │   ├── AnimatedGradientBg.tsx   # Background hiệu ứng Gradient chuyển động
│   │   ├── ContextMenu.tsx          # Menu chuột phải tùy chỉnh (Context Menu)
│   │   ├── EditMetadataModal.tsx    # Modal chỉnh sửa thông tin ID3 metadata bài hát
│   │   ├── HomeView.tsx             # Màn hình trang chủ tổng quan
│   │   ├── LyricView.tsx            # Màn hình hiển thị Lời bài hát Karaoke cuộn tự động
│   │   ├── LyricsPanel.tsx          # Panel xem lời nhạc nhanh bên lề
│   │   ├── MoveAlbumModal.tsx       # Modal di chuyển / gộp Album
│   │   ├── MvPlayerView.tsx         # Trình phát Music Video (MV) màn hình lớn
│   │   ├── PlayerBar.tsx            # Thanh điều khiển trình phát nhạc cố định bên dưới
│   │   ├── QueueView.tsx            # Danh sách hàng đợi phát nhạc (Queue)
│   │   └── Sidebar.tsx              # Thanh điều hướng Sidebar bên trái
│   │
│   ├── context/                     # Quản lý State toàn cục ứng dụng
│   │   └── PlayerContext.tsx        # React Context quản lý Audio Player state, Queue & Library
│   │
│   ├── hooks/                       # Custom React Hooks
│   │   ├── useAudioTelemetry.ts     # Hook đo đạc thời gian nghe thực tế (Telemetry Heartbeat)
│   │   └── useMusicQueries.ts       # TanStack Query Hooks (Cache RAM Stale-While-Revalidate)
│   │
│   ├── utils/                       # Utility Functions & IPC Bridge
│   │   ├── lrcParser.ts             # Parser đọc & đồng bộ file lời nhạc (.lrc)
│   │   └── tauriBridge.ts           # Cầu nối IPC React <-> Tauri Commands & convertFileSrc
│   │
│   ├── App.css                      # CSS tùy chỉnh giao diện ứng dụng
│   ├── App.tsx                      # Root Component chính định tuyến màn hình
│   ├── index.css                    # Design System & Tailwind CSS Directives
│   ├── main.tsx                     # Entry Point React (Bọc QueryClientProvider)
│   ├── types.ts                     # Khai báo TypeScript Interfaces (Track, Album, Playlist, v.v.)
│   └── vite-env.d.ts                # TypeScript definition cho Vite
│
├── src-tauri/                       # Mã nguồn Backend Native (Rust + SQLite)
│   ├── src/
│   │   ├── commands.rs              # Các Tauri IPC Commands giao tiếp với Frontend
│   │   ├── db.rs                    # SQLite Database Engine (WAL mode, Indexes & Caching Table)
│   │   ├── lib.rs                   # Đăng ký handler & khởi tạo ứng dụng Tauri
│   │   └── main.rs                  # Entry point cho ứng dụng Rust
│   │
│   ├── icons/                       # Biểu tượng ứng dụng Desktop nhiều kích thước (ico, png)
│   ├── Cargo.toml                   # Cấu hình phụ thuộc Crate Rust (rusqlite, lofty, tokio, tauri)
│   ├── Cargo.lock                   # Lockfile phiên bản Crate Rust
│   ├── build.rs                     # Script build Rust Tauri
│   ├── make_icons.js                # Script tự động tạo các kích thước icon
│   └── tauri.conf.json              # Cấu hình Tauri (Cửa sổ app, quyền Security, Asset Protocol)
│
├── dist/                            # Sản phẩm sau khi đóng gói Frontend (`npm run build`)
├── .oxlintrc.json                   # Cấu hình Linter Oxlint
├── index.html                       # HTML chính của ứng dụng Web/WebView
├── package.json                     # Quản lý thư viện Node.js (Dependencies & Scripts)
├── postcss.config.js                # Cấu hình PostCSS
├── tailwind.config.js               # Cấu hình Tailwind CSS Theme & Utilities
├── tsconfig.json                    # Cấu hình TypeScript Compiler
└── vite.config.ts                   # Cấu hình Vite Bundler
```

---

## 📋 Ghi Chú Chi Tiết Các Thư Mục & File Quan Trọng

### 1. Thư mục `src-tauri/src/` (Rust Backend)
- **`db.rs`**: 
  - Khởi tạo kết nối SQLite với cấu hình WAL Mode (`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`).
  - Quản lý các bảng database: `saved_tracks`, `playlists`, `playlist_songs`, `play_history`, `telemetry_play_session`, và bảng cache `top_charts_cache`.
  - Đánh sẵn các Index tối ưu truy vấn: `idx_play_history_valid`, `idx_saved_tracks_artist`, `idx_saved_tracks_album`.
- **`commands.rs`**:
  - Chứa các hàm `#[tauri::command]` gọi xuống từ React qua IPC: `get_saved_tracks`, `get_playlists`, `get_analytics_stats`, `attach_lrc_file`, `attach_mv_file`, `log_play_record`, v.v.

### 2. Thư mục `src/hooks/` (React Custom Hooks & Caching)
- **`useMusicQueries.ts`**:
  - Chứa các Query Hooks của TanStack Query: `useTracksQuery`, `usePlaylistsQuery`, `useAnalyticsQuery`, `useRecentlyPlayedQuery`.
  - Đảm bảo dữ liệu được cache lại trong RAM (0ms độ trễ khi chuyển tab).
- **`useAudioTelemetry.ts`**:
  - Gửi heartbeat 5s/lần xuống Rust để ghi nhận thời gian nghe thực tế chuẩn xác từng giây.

### 3. Thư mục `src/utils/` (Tauri Bridge & Protocol Helper)
- **`tauriBridge.ts`**:
  - Bọc hàm `convertFileSrc` chuyển đĩa cứng local path thành Tauri Asset URL (`asset://...`), loại bỏ hoàn toàn việc truyền Base64 nặng qua IPC.
- **`lrcParser.ts`**:
  - Parse lời bài hát từ định dạng file `.lrc` thành mảng có mốc thời gian (timestamp).

### 4. Thư mục `src/components/MainView/` (Giao diện hiển thị chính)
- **`TrackList.tsx`**:
  - Render danh sách bài hát tích hợp Virtual Scrolling (`@tanstack/react-virtual`) giúp cuộn mượt 60fps cho hàng nghìn bài hát.
- **`AlbumGrid.tsx`**:
  - Lưới hiển thị các Album nhạc với tính năng kéo thả ghép Album (Drag & Drop Merge) và nút phát nhanh.
