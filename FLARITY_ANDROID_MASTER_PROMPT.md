# FLARITY MUSIC ANDROID - MASTER IMPLEMENTATION PROMPT & 7-SUBAGENT WORKFLOW

> **Mục tiêu**: Xây dựng ứng dụng nghe nhạc Hi-Res Lossless, dịch lời bài hát AI thời gian thực và khám phá/tải nhạc ngoại tuyến cho nền tảng Android sử dụng **Kotlin**, **Jetpack Compose**, **Media3 ExoPlayer**, **Room Database** và **NewPipeExtractor**.
> **Bộ quy tắc thiết kế bắt buộc**:
> 1. **Strict No-Emoji Policy**: Tuyệt đối không dùng Unicode emoji trong UI, nút bấm, badge, toast, dialog. Luôn dùng Vector SVG / Material Icons.
> 2. **Clean Architecture**: Tách biệt rõ ràng Data -> Domain -> UI/Presentation.
> 3. **Performance First**: UI chạy 60/120 FPS, tối ưu RAM, phát nhạc ngầm tiết kiệm pin.

---

## 🎯 DANH SÁCH 7 SUBAGENTS THỰC THI DỰ ÁN

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AGENT 1: ARCHITECT & SCAFFOLD                   │
│         (Project Setup, Gradle KTS, Clean Architecture, DI Hilt/Koin)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       │                            │                            │
┌──────▼─────────────────────┐ ┌────▼─────────────────────┐ ┌────▼─────────────────────┐
│  AGENT 2: DOMAIN & ALGO    │ │  AGENT 3: AUDIO ENGINE   │ │ AGENT 4: STREAM & DOWNLOAD│
│  (Metadata, Lrc, AI Prompts│ │  (Media3 ExoPlayer,      │ │ (NewPipeExtractor,        │
│   ScoreArtistVsTitle)      │ │   Background Service)    │ │  WorkManager, ID3 Tagger) │
└──────┬─────────────────────┘ └────┬─────────────────────┘ └────┬─────────────────────┘
       │                            │                            │
       └────────────────────────────┼────────────────────────────┘
                                    │
       ┌────────────────────────────┴────────────────────────────┐
       │                                                         │
┌──────▼─────────────────────┐                            ┌──────▼─────────────────────┐
│ AGENT 5: ROOM DB & DATA    │                            │ AGENT 6: JETPACK COMPOSE UI│
│ (Entities, DAOs, DataStore,│                            │ (Glassmorphism, Karaoke,   │
│  Reactive Flows)           │                            │  BottomPlayer, Visualizer) │
└──────┬─────────────────────┘                            └──────┬─────────────────────┘
       │                                                         │
       └────────────────────────────┬────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    AGENT 7: QA, VERIFICATION & BENCHMARK               │
│         (Unit Tests, ExoPlayer Lifecycle, Compose Tests, LeakCanary)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

### AGENT 1: Android Architect & Project Scaffold Engineer
- **Vai trò**: Khởi tạo cấu trúc dự án, Gradle KTS, phân chia module Clean Architecture, cấu hình Dependency Injection (Hilt hoặc Koin) và Navigation Compose.
- **Nhiệm vụ cụ thể**:
  1. Cấu hình `build.gradle.kts` (Project & App) với Kotlin 2.0+, Jetpack Compose BOM, Media3, Room, Ktor Client, Coroutines Flow.
  2. Thiết lập cấu trúc package:
     - `core`: designsystem, network, common, utils
     - `data`: local (Room, DataStore), remote (NewPipe, iTunes, AI APIs), repository
     - `domain`: model, usecase, metadata, lyrics
     - `service`: audio (MediaSessionService), download (WorkManager)
     - `ui`: navigation, screens (home, discovery, player, lyrics, settings), components
  3. Cấu hình Navigation Compose đa màn hình với Typed Navigation (Kotlin Serialization).

---

### AGENT 2: Core Domain & Music Algorithms Specialist
- **Vai trò**: Chuyển đổi và bảo toàn 100% các thuật toán thông minh từ Flarity Music sang Kotlin thuần (Zero-dependency Domain).
- **Nhiệm vụ cụ thể**:
  1. **VietnameseMetadataEngine.kt**:
     - Bóc tách Show truyền hình (*Anh Trai Say Hi, Vượt Ngàn Chông Gai, Rap Việt, Ca Sĩ Mặt Nạ, Chị Đẹp, Our Song, OST*).
     - Thuật toán chấm điểm `scoreArtistVsTitle` (nhận biết `(feat. ...)`, danh mục nghệ sĩ, độ dài câu từ) để chống đảo ngược Tên bài hát vs Nghệ sĩ.
     - Tách biệt `primaryArtists`, `featuredArtists`, `producers`.
     - Fuzzy Album Clustering $\ge 95\%$ (Token Sort Ratio + Levenshtein Distance).
  2. **LrcParser.kt**:
     - Phân tích cú pháp LRC chuẩn và Enhanced LRC `<mm:ss.xx>`.
     - Thuật toán Binary Search $O(\log N)$ tìm kiếm dòng hát hiện tại theo mili-giây.
     - Xử lý bù trừ độ trễ (`[offset:+/-ms]`) và tách song ngữ (`//` hoặc `|`).
  3. **LyricsTranslationEngine.kt**:
     - Thuật toán so sánh độ tương đồng Levenshtein $\ge 80\%$ để ẩn dòng phụ đề trùng lặp / ad-libs (*yeah yeah*).
     - Nhận diện tiếng Việt `isVietnameseText` để ẩn sub nếu gốc là tiếng Việt.
     - Prompt mẫu AI dịch âm nhạc theo ngữ cảnh, rap slang, tự nhiên, không hàn lâm.

---

### AGENT 3: Media3 ExoPlayer & Audio Engine Specialist
- **Vai trò**: Xây dựng toàn bộ tầng phát nhạc chạy ngầm, quản lý Audio Focus và bộ xử lý âm thanh Hi-Res Lossless.
- **Nhiệm vụ cụ thể**:
  1. Xây dựng `FlarityAudioService : MediaSessionService`:
     - Tích hợp `ExoPlayer` với cấu hình `AudioAttributes(USAGE_MEDIA, CONTENT_TYPE_MUSIC)`.
     - Tự động dừng khi rút tai nghe (`setHandleAudioBecomingNoisy(true)`).
     - Tự động kết nối `MediaNotificationProvider` hiển thị Cover Art, Title, Artist, nút Play/Pause/Next/Prev trên thanh thông báo và màn hình khóa.
  2. Hỗ trợ đầy đủ định dạng: FLAC (24-bit/192kHz), ALAC, WAV, MP3, AAC, OPUS, OGG.
  3. Tích hợp `AudioProcessor` và Android `Equalizer`:
     - 10-band Equalizer + Presets (Bass Heavy, Vocal Boost, Rock, Electronic...).
     - Bass Boost, Virtualizer (Spatial Audio) và Loudness Enhancer (EBU R128).
  4. Quản lý hàng đợi phát nhạc (*Playback Queue*), Shuffle ngẫu nhiên (Fisher-Yates) và Repeat modes (OFF, ALL, ONE).

---

### AGENT 4: Streaming & YouTube Downloader Engineer
- **Vai trò**: Xây dựng hệ sinh thái khám phá nhạc trực tuyến và tải nhạc ngoại tuyến ngầm.
- **Nhiệm vụ cụ thể**:
  1. Tích hợp **NewPipeExtractor** / **innertube** để lấy Direct Stream Audio URL (M4A/Opus) và tìm kiếm YouTube Music chất lượng cao.
  2. Tích hợp **iTunes Search API** (`itunes.apple.com/search`) để khám phá bài hát chất lượng cao kèm Cover Art 600x600 HD.
  3. Xây dựng `DownloadWorker : CoroutineWorker` (Android Jetpack WorkManager):
     - Tải file nhạc ngầm dưới nền có báo tiến trình (Foreground Notification Progress).
     - Tự động ghi thẻ ID3 Tag bằng **jaudiotagger**: Nhúng Title, Full Artists (kể cả Feat), Album, Year và Cover Art JPEG/PNG vào file đã tải.
     - Quét và lưu trữ vào bộ nhớ thiết bị (`/Music/FlarityMusic/`).

---

### AGENT 5: Local Database & State Persistence Engineer
- **Vai trò**: Quản lý cơ sở dữ liệu SQLite cục bộ qua Room DB và bộ nhớ cấu hình DataStore.
- **Nhiệm vụ cụ thể**:
  1. Thiết kế **Room Database**:
     - `TrackEntity`: id, filePath, title, artist, album, duration, year, picture, hasLyric, lrcPath, hasMv, isFavorite.
     - `PlaylistEntity` & `PlaylistTrackCrossRef`: Quản lý danh sách phát tùy chỉnh.
     - `PlayHistoryEntity`: Thống kê bài hát và nghệ sĩ nghe nhiều nhất.
  2. Xây dựng `TrackDao` với phản ứng dữ liệu thời gian thực qua `Flow<List<TrackEntity>>`.
  3. Xây dựng `SettingsDataStore`:
     - Lưu API Keys (Google Gemini, OpenAI, Claude, OpenRouter, Custom).
     - Cấu hình hiển thị lời dịch (Kiểu phụ đề: Apple Music, Spotify, Neon Glow).
     - Cấu hình độ trễ lời bài hát và Equalizer Presets.

---

### AGENT 6: Jetpack Compose UI/UX & Visualizer Designer
- **Vai trò**: Thiết kế toàn bộ giao diện Dark Glassmorphism, thanh điều khiển Mini Player, Fullscreen Player và hiệu ứng Karaoke.
- **Quy tắc**: Tuân thủ nghiêm ngặt **Strict No-Emoji Policy**, sử dụng Material Icons / Lucide SVG.
- **Nhiệm vụ cụ thể**:
  1. **Theme & Design System**: Dark OLED (`#0D0D0E`), Accent Apple Pink (`#FA243C`), Surface Glass blur (`Modifier.blur()`).
  2. **Player Bottom Sheet**:
     - Mini Player thanh mảnh ở đáy màn hình.
     - Kéo trượt mượt mà mở Fullscreen Player với đĩa quay / ảnh bìa HD và Seekbar thời gian thực.
  3. **Karaoke Lyric Screen**:
     - `LazyColumn` cuộn tự động theo mốc thời gian bài hát (`animateScrollToItem`).
     - Câu đang hát phóng to và đổi màu sáng (`animateColorAsState`, `animateFloatAsState`).
     - Dòng phụ đề dịch thuật AI hiển thị bên dưới chữ gốc.
     - Nhấn vào câu hát để tua phát ngay lập tức (`onSeekTo(timeMillis)`).
  4. **Screens**:
     - `HomeScreen`: Hero banner, Album nổi bật, Gợi ý theo Vibe.
     - `DiscoveryScreen`: Tìm kiếm YouTube/iTunes, bảng xếp hạng, nút tải Audio/Video 1-click.
     - `ArtistDetailScreen` & `AlbumDetailScreen`: Danh sách bài hát theo nghệ sĩ / album.
     - `AnalyticsScreen`: Biểu đồ thời gian nghe nhạc, Top nghệ sĩ, Xuất poster ảnh chia sẻ.

---

### AGENT 7: QA, Verification & Benchmark Specialist
- **Vai trò**: Viết Unit Test, kiểm thử hồi quy thuật toán, kiểm tra rò rỉ bộ nhớ (LeakCanary) và tối ưu hóa hiệu năng khởi động.
- **Nhiệm vụ cụ thể**:
  1. Bộ Test tự động cho Metadata Parser (Đảm bảo 100% pass các case phức tạp: `"Nếu Như Ta Chẳng Còn (feat. tlinh) - MCK"`, ATSH, multi-artist).
  2. Test phân tích cú pháp LRC và thuật toán tìm nhị phân `findActiveLyricIndex`.
  3. Test vòng đời ExoPlayer (khi app bị kill, khi có cuộc gọi đến, khi chuyển đổi tai nghe Bluetooth).
  4. Tạo Baseline Profiles (`androidx.profileinstaller`) giúp app khởi động dưới 0.3s trên Android.

---

## 🚀 PROMPT TỔNG ĐỂ CHẠY TOÀN BỘ DỰ ÁN (DÀNH CHO AI AGENT)

```markdown
Bạn là Kỹ sư Trưởng Android cao cấp (Principal Android Engineer). Nhiệm vụ của bạn là dẫn dắt 7 Subagents thực hiện xây dựng trọn vẹn ứng dụng Flarity Music phiên bản Android bằng Kotlin và Jetpack Compose.

Hãy triển khai dự án theo thứ tự 4 giai đoạn:
- Giai đoạn 1 (Agent 1, Agent 2, Agent 5): Thiết lập kiến trúc Clean Architecture, chuyển giao 100% thuật toán Metadata/LRC/Translation sang Kotlin và khởi tạo Room Database.
- Giai đoạn 2 (Agent 3, Agent 4): Hoàn thiện Media3 ExoPlayer Background Service và hệ thống Streaming/Download NewPipe.
- Giai đoạn 3 (Agent 6): Xây dựng giao diện Jetpack Compose Glassmorphism, PlayerBottomSheet và Karaoke Lyric View.
- Giai đoạn 4 (Agent 7): Viết Unit Tests, kiểm thử toàn diện và biên dịch APK Release.

Tuân thủ nghiêm ngặt:
1. Strict No-Emoji Policy: Không dùng emoji trong giao diện, chỉ dùng Vector Icons.
2. Viết mã nguồn Kotlin sạch, không thừa boilerplate, xử lý ngoại lệ đầy đủ.
```
