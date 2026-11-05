# Flarity Music: GitHub presentation and launch copy

Everything here matches claims made in the README. Keep it that way: if a feature changes, update the README first, then this file.

---

## 1. Repository settings (paste into GitHub)

Set these under **Settings → General** and **About** on the repo page.

**Description** (under 350 characters):

> Flarity Music: a local-first desktop music player built with Tauri v2 and React 19. Plays your own library with synced lyrics and AI lyric translation. No ads, no accounts, no analytics.

**Website:** `https://github.com/PhoPhuc/flarity-music/releases/latest`

**Topics:**

```
music-player, desktop-app, tauri, tauri-v2, rust, react, typescript, lyrics, lyrics-translation, local-first, offline-music, sqlite, windows, macos, vietnamese
```

**Social preview:** upload `docs/assets/social-preview.png` (1280 × 640) under **Settings → General → Social preview**.

---

## 2. Taglines

Pick one for the release title, post headline, or Product Hunt-style card:

- Your music library, native and lightweight, with lyrics in any language.
- A local-first music player. No ads, no accounts, no analytics.
- Play your own music. Read the lyrics in your language.
- Your library. Your lyrics. Your machine.

---

## 3. Vietnamese launch post

For Facebook groups, Zalo, Threads, or a Vietnamese dev community. Check each group's self-promotion rules first.

> **Giới thiệu Flarity Music: trình phát nhạc desktop cho thư viện của bạn**
>
> Flarity Music là ứng dụng nghe nhạc trên máy tính, phát các file nhạc bạn đã có: MP3, FLAC, WAV, M4A, AAC và OGG.
>
> Điểm nổi bật:
> - Lời bài hát đồng bộ (.lrc) và dịch lời ngay trong app. Dùng Google Translate miễn phí, hoặc tự nhập API key của Gemini, Claude, OpenAI, OpenRouter, hay một endpoint tương thích OpenAI như Ollama.
> - Không quảng cáo, không cần tài khoản, không có analytics. Lịch sử nghe được lưu trên máy bạn.
> - Viết bằng Rust (Tauri v2) và React 19, không dùng Electron, nên nhẹ hơn.
> - Nguồn mở, phát hành theo giấy phép MIT.
>
> Tải bản Windows tại: https://github.com/PhoPhuc/flarity-music/releases/latest
> Mã nguồn và hướng dẫn build: https://github.com/PhoPhuc/flarity-music
>
> Góp ý, báo lỗi và pull request đều được hoan nghênh. Nếu thấy hữu ích, một lượt star sẽ giúp mình nhiều.

Short version for Zalo or X:

> Flarity Music: trình phát nhạc desktop cho thư viện nhạc của bạn. Lời đồng bộ + dịch lời bằng AI, không quảng cáo, không tài khoản, không analytics. Nguồn mở (MIT). https://github.com/PhoPhuc/flarity-music

---

## 4. English launch posts

### Show HN / r/opensource / r/tauri

**Title:** Show HN: Flarity Music, a local-first desktop music player in Tauri v2 and React 19

> I built Flarity Music because I wanted a player for my own files that doesn't have ads, accounts, or analytics.
>
> It plays MP3, FLAC, WAV, M4A, AAC and OGG from a folder you choose. Synced `.lrc` lyrics show up automatically, and you can translate them with free Google Translate or with your own key for Gemini, Claude, OpenAI, OpenRouter, or any OpenAI-compatible endpoint. Listening stats are stored in a local SQLite database.
>
> The shell is Rust with Tauri v2, and the UI is React 19 with TypeScript. It uses the system WebView rather than bundling Chromium.
>
> MIT licensed. Windows installers are on the releases page. macOS currently means building from source.
>
> Repo: https://github.com/PhoPhuc/flarity-music
> Happy to answer questions about the Tauri setup, the lyrics pipeline, or the local-first design.

### r/rust (focus on the backend)

**Title:** Flarity Music: a Tauri v2 desktop music player with a rusqlite backend

> Sharing a desktop music player written with Tauri v2. The Rust side handles library scanning, cover art, SQLite storage through `rusqlite` (bundled), listening telemetry, and `yt-dlp` integration. The React 19 frontend handles playback UI, lyrics, and translation providers.
>
> Source: https://github.com/PhoPhuc/flarity-music. Feedback on the command layer and the DB design is especially welcome.

### Short English pitch (X, Bluesky, Mastodon)

> Flarity Music: a local-first desktop music player. Plays your own files, shows synced lyrics, translates them with AI (or free Google Translate). No ads, no accounts, no analytics. Built with Tauri v2 and React 19. MIT.
> https://github.com/PhoPhuc/flarity-music

---

## 5. Release announcement template

Use this for each GitHub Release, so every release page follows the same layout as the README.

```markdown
## Flarity Music vX.Y.Z

One sentence on the most important change.

### Highlights
- ...

### Fixes
- ...

### Downloads (Windows)
- Setup installer: `Flarity-Music-X.Y.Z-x64-setup.exe`
- MSI installer: `Flarity-Music-X.Y.Z-x64.msi`
- Portable ZIP: `Flarity-Music-X.Y.Z-portable-x64.zip`
```

---

## 6. Launch checklist

- [ ] Set the About description, website, and topics (section 1).
- [ ] Upload the social preview image.
- [ ] Add at least one real screenshot or short screen recording to the README. These produce the most clicks, and no screenshot is committed yet.
- [ ] Publish a release for the current version (package.json is 1.1.8; the latest published release is v1.1.7).
- [ ] Post in one community at a time, and read each community's rules first.
- [ ] Reply to every issue and comment in the first 48 hours after posting.
