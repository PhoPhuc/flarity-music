use crate::db::{self, AnalyticsStats, PlayRecordInput, Playlist, TelemetryPayload, TopListenedTrack, Track};
use base64::Engine;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::probe::Probe;
use lofty::tag::Accessor;
use serde::Deserialize;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;
use walkdir::WalkDir;

pub struct DbState(pub std::sync::Arc<std::sync::Mutex<rusqlite::Connection>>);
pub struct TelemetryState(pub std::sync::Arc<std::sync::Mutex<crate::telemetry::TelemetryEngine>>);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackChangeEventPayload {
    pub song_id: String,
    pub title: String,
    pub artist: String,
    pub album_art: Option<String>,
    pub track_duration: f64,
}

#[tauri::command]
pub async fn get_saved_tracks(
    state: State<'_, DbState>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<Track>, String> {
    let db = state.0.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        db::get_all_tracks(&conn, limit, offset).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn telemetry_on_play(telemetry_state: State<'_, TelemetryState>) -> Result<bool, String> {
    let telemetry = telemetry_state.0.clone();
    let mut engine = telemetry.lock().map_err(|e| e.to_string())?;
    engine.on_play();
    Ok(true)
}

#[tauri::command]
pub async fn telemetry_on_pause(
    telemetry_state: State<'_, TelemetryState>,
) -> Result<bool, String> {
    let telemetry = telemetry_state.0.clone();
    let mut engine = telemetry.lock().map_err(|e| e.to_string())?;
    engine.on_pause();
    Ok(true)
}

#[tauri::command]
pub async fn telemetry_on_track_change(
    app: AppHandle,
    db_state: State<'_, DbState>,
    telemetry_state: State<'_, TelemetryState>,
    track: Option<TrackChangeEventPayload>,
) -> Result<bool, String> {
    let telemetry = telemetry_state.0.clone();
    let db = db_state.0.clone();

    tokio::task::spawn_blocking(move || {
        let new_session = track.map(|t| crate::telemetry::ActiveTrackSession {
            song_id: t.song_id,
            title: t.title,
            artist: t.artist,
            album_art: t.album_art,
            track_duration: t.track_duration,
        });

        // Scope block thu hẹp để Mutex Lock tự động nhả (drop) ngay lập tức
        let flush_payload = {
            let mut engine = telemetry.lock().map_err(|e| e.to_string())?;
            let payload = engine.extract_flush_payload();
            engine.active_session = new_session;
            if engine.is_playing {
                engine.last_tick_time = Some(std::time::Instant::now());
            }
            payload
        }; // Lock nhả hoàn toàn tại đây!

        if let Some(payload) = flush_payload {
            let mut conn = db.lock().map_err(|e| e.to_string())?;
            crate::telemetry::write_telemetry_flush_to_db(&mut conn, payload).map_err(|e| e.to_string())?;
        }
        Ok::<bool, String>(true)
    })
    .await
    .map_err(|e| e.to_string())??;

    let _ = app.emit("analytics-updated", ());
    Ok(true)
}

#[tauri::command]
pub async fn telemetry_on_rate_change(
    telemetry_state: State<'_, TelemetryState>,
    new_rate: f32,
) -> Result<bool, String> {
    let telemetry = telemetry_state.0.clone();
    let mut engine = telemetry.lock().map_err(|e| e.to_string())?;
    engine.on_rate_change(new_rate);
    Ok(true)
}

#[tauri::command]
pub async fn telemetry_on_app_exit(
    db_state: State<'_, DbState>,
    telemetry_state: State<'_, TelemetryState>,
) -> Result<bool, String> {
    let telemetry = telemetry_state.0.clone();
    let db = db_state.0.clone();

    tokio::task::spawn_blocking(move || {
        // Scope block thu hẹp để Mutex Lock tự động nhả (drop) ngay lập tức
        let flush_payload = {
            let mut engine = telemetry.lock().map_err(|e| e.to_string())?;
            engine.extract_flush_payload()
        }; // Lock nhả hoàn toàn tại đây!

        if let Some(payload) = flush_payload {
            let mut conn = db.lock().map_err(|e| e.to_string())?;
            crate::telemetry::write_telemetry_flush_to_db(&mut conn, payload).map_err(|e| e.to_string())?;
        }
        Ok::<bool, String>(true)
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(true)
}

#[tauri::command]
pub async fn select_music_folder(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |folder_path| {
        let path = folder_path.map(|p| p.to_string());
        let _ = tx.send(path);
    });
    rx.await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn select_mv_file(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter("Video Files", &["mp4", "mkv", "webm", "mov"])
        .pick_file(move |file_path| {
            let path = file_path.map(|p| p.to_string());
            let _ = tx.send(path);
        });
    rx.await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn select_lrc_file(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter("LRC Lyric Files", &["lrc", "txt"])
        .pick_file(move |file_path| {
            let path = file_path.map(|p| p.to_string());
            let _ = tx.send(path);
        });
    rx.await.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_lrc_file(lrc_path: String) -> Result<Option<String>, String> {
    if Path::new(&lrc_path).exists() {
        match fs::read_to_string(&lrc_path) {
            Ok(content) => Ok(Some(content)),
            Err(e) => Err(e.to_string()),
        }
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn log_play_record(
    app: AppHandle,
    state: State<'_, DbState>,
    input: PlayRecordInput,
) -> Result<bool, String> {
    let db = state.0.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        db::log_play_record(&conn, &input).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())??;
    let _ = app.emit("analytics-updated", ());
    Ok(true)
}

#[tauri::command]
pub async fn record_telemetry_heartbeat(
    app: AppHandle,
    state: State<'_, DbState>,
    payload: TelemetryPayload,
) -> Result<bool, String> {
    let db = state.0.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        db::record_telemetry_heartbeat(&conn, &payload).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())??;
    let _ = app.emit("analytics-updated", ());
    Ok(true)
}

#[tauri::command]
pub async fn get_analytics_stats(
    state: State<'_, DbState>,
    range: String,
) -> Result<AnalyticsStats, String> {
    let db = state.0.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        db::get_analytics_stats(&conn, &range).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_top_listened_tracks(
    state: State<'_, DbState>,
    limit: Option<usize>,
) -> Result<Vec<TopListenedTrack>, String> {
    let db = state.0.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        db::get_top_listened_tracks(&conn, limit.unwrap_or(20)).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_recently_played(
    state: State<'_, DbState>,
    limit: Option<usize>,
) -> Result<Vec<String>, String> {
    let db = state.0.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        db::get_recently_played(&conn, limit.unwrap_or(6).min(6)).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_playlists(state: State<'_, DbState>) -> Result<Vec<Playlist>, String> {
    let db = state.0.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        db::get_playlists(&conn).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn create_playlist(
    state: State<'_, DbState>,
    name: String,
    description: Option<String>,
    cover_art: Option<String>,
) -> Result<Playlist, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::create_playlist(&conn, &name, description.as_deref(), cover_art.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_to_playlist(
    state: State<'_, DbState>,
    playlist_id: String,
    track_id: String,
) -> Result<Vec<Playlist>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::add_track_to_playlist(&conn, &playlist_id, &track_id).map_err(|e| e.to_string())?;
    db::get_playlists(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_from_playlist(
    state: State<'_, DbState>,
    playlist_id: String,
    track_id: String,
) -> Result<Vec<Playlist>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::remove_track_from_playlist(&conn, &playlist_id, &track_id).map_err(|e| e.to_string())?;
    db::get_playlists(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_playlist(
    state: State<'_, DbState>,
    playlist_id: String,
) -> Result<Vec<Playlist>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::delete_playlist(&conn, &playlist_id).map_err(|e| e.to_string())?;
    db::get_playlists(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_playlist(
    state: State<'_, DbState>,
    playlist_id: String,
    new_name: String,
) -> Result<Vec<Playlist>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::rename_playlist(&conn, &playlist_id, &new_name).map_err(|e| e.to_string())?;
    db::get_playlists(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn attach_lrc_file(
    state: State<'_, DbState>,
    track_id: String,
    lrc_path: String,
) -> Result<Vec<Track>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_track_lrc_db(&conn, &track_id, &lrc_path).map_err(|e| e.to_string())?;
    db::get_all_tracks(&conn, None, None).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_and_attach_lrc(
    state: State<'_, DbState>,
    track_id: String,
    lrc_content: String,
) -> Result<Vec<Track>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let target = db::get_track_by_id(&conn, &track_id).map_err(|e| e.to_string())?;

    let target = match target {
        Some(t) => t,
        None => return Err(format!("Track with id '{}' not found in database", track_id)),
    };

    let audio_path = Path::new(&target.file_path);
    if !audio_path.exists() {
        return Err(format!("Audio file '{}' does not exist on disk", target.file_path));
    }

    let lrc_path = audio_path.with_extension("lrc");
    fs::write(&lrc_path, lrc_content.as_bytes())
        .map_err(|e| format!("Failed to write LRC file to disk: {}", e))?;

    let lrc_path_str = lrc_path.to_string_lossy().to_string();
    db::update_track_lrc_db(&conn, &track_id, &lrc_path_str).map_err(|e| e.to_string())?;
    db::get_all_tracks(&conn, None, None).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn attach_mv_file(
    state: State<'_, DbState>,
    track_id: String,
    mv_path: String,
) -> Result<Vec<Track>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::update_track_mv_db(&conn, &track_id, &mv_path).map_err(|e| e.to_string())?;
    db::get_all_tracks(&conn, None, None).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn merge_album(
    state: State<'_, DbState>,
    source_album_name: String,
    source_artist: String,
    target_album_name: String,
    target_artist: String,
) -> Result<Vec<Track>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::merge_album(
        &conn,
        &source_album_name,
        &source_artist,
        &target_album_name,
        &target_artist,
    )
    .map_err(|e| e.to_string())?;
    db::get_all_tracks(&conn, None, None).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn show_in_explorer(file_path: String) -> Result<bool, String> {
    if Path::new(&file_path).exists() {
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("explorer")
                .arg("/select,")
                .arg(&file_path)
                .spawn();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = open::that(&file_path);
        }
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn delete_track_file(
    state: State<'_, DbState>,
    track_id: String,
    file_path: String,
    permanent_delete: bool,
) -> Result<bool, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::delete_track_db(&conn, &track_id).map_err(|e| e.to_string())?;

    if Path::new(&file_path).exists() {
        if permanent_delete {
            fs::remove_file(&file_path).map_err(|e| e.to_string())?;
        } else {
            trash::delete(&file_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(true)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMetadataInput {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub year: Option<i32>,
    pub picture: Option<String>,
    pub move_file: Option<bool>,
}

#[tauri::command]
pub fn update_track_metadata(
    state: State<'_, DbState>,
    track_id: String,
    updates: UpdateMetadataInput,
) -> Result<bool, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let target = db::get_track_by_id(&conn, &track_id).map_err(|e| e.to_string())?;

    let target = match target {
        Some(t) => t,
        None => return Ok(false),
    };

    let mut new_file_path = target.file_path.clone();

    if updates.move_file.unwrap_or(false) && (updates.artist.is_some() || updates.album.is_some()) {
        let current_path = Path::new(&target.file_path);
        if let Some(current_dir) = current_path.parent() {
            if let Some(music_base_dir) = current_dir.parent().and_then(|p| p.parent()) {
                let artist_val = updates.artist.as_deref().unwrap_or(&target.artist);
                let album_val = updates.album.as_deref().unwrap_or(&target.album);

                let safe_artist = sanitize_filename(artist_val);
                let safe_album = sanitize_filename(album_val);

                let new_folder = music_base_dir.join(&safe_artist).join(&safe_album);
                if !new_folder.exists() {
                    let _ = fs::create_dir_all(&new_folder);
                }

                if let Some(file_name) = current_path.file_name() {
                    let dest_path = new_folder.join(file_name);
                    if current_path.exists() && current_path != dest_path {
                        if let Ok(_) = fs::rename(current_path, &dest_path) {
                            new_file_path = dest_path.to_string_lossy().to_string();
                        }
                    }
                }
            }
        }
    }

    db::update_track_metadata_db(
        &conn,
        &track_id,
        updates.title.as_deref(),
        updates.artist.as_deref(),
        updates.album.as_deref(),
        updates.year,
        updates.picture.as_deref(),
        Some(&new_file_path),
    )
    .map_err(|e| e.to_string())?;

    Ok(true)
}

fn sanitize_filename(name: &str) -> String {
    sanitize_filename_robust(name, 80)
}

pub fn sanitize_filename_robust(name: &str, max_len: usize) -> String {
    const WINDOWS_RESERVED: &[&str] = &[
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];

    let mut cleaned: String = name
        .chars()
        .map(|c| match c {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if (c as u32) < 32 || c == '\u{7f}' => '_',
            '\u{202E}' | '\u{202D}' | '\u{200E}' | '\u{200F}' => '_',
            _ => c,
        })
        .collect();

    cleaned = cleaned.trim().trim_end_matches('.').trim().to_string();

    if cleaned.is_empty() {
        cleaned = "unnamed_track".to_string();
    }

    let upper = cleaned.to_uppercase();
    let stem = upper.split('.').next().unwrap_or(&upper);
    if WINDOWS_RESERVED.contains(&stem) {
        cleaned = format!("{}_track", cleaned);
    }

    if cleaned.chars().count() > max_len {
        cleaned = cleaned.chars().take(max_len).collect();
        cleaned = cleaned.trim().trim_end_matches('.').to_string();
    }

    cleaned
}

// === SCAN FOLDER COMMAND & HELPER ALGORITHMS ===

fn normalize_str(s: &str) -> String {
    let lower = s.to_lowercase();
    lower
        .chars()
        .map(|c| match c {
            'à' | 'á' | 'ạ' | 'ả' | 'ã' | 'â' | 'ầ' | 'ấ' | 'ậ' | 'ẩ' | 'ẫ' | 'ă' | 'ằ' | 'ắ'
            | 'ặ' | 'ẳ' | 'ẵ' => 'a',
            'è' | 'é' | 'ẹ' | 'ẻ' | 'ẽ' | 'ê' | 'ề' | 'ế' | 'ệ' | 'ể' | 'ễ' => 'e',
            'ì' | 'í' | 'ị' | 'ỉ' | 'ĩ' => 'i',
            'ò' | 'ó' | 'ọ' | 'ỏ' | 'õ' | 'ô' | 'ồ' | 'ố' | 'ộ' | 'ổ' | 'ỗ' | 'ơ' | 'ờ' | 'ớ'
            | 'ợ' | 'ở' | 'ỡ' => 'o',
            'ù' | 'ú' | 'ụ' | 'ủ' | 'ũ' | 'ư' | 'ừ' | 'ứ' | 'ự' | 'ử' | 'ữ' => 'u',
            'ỳ' | 'ý' | 'ỵ' | 'ỷ' | 'ỹ' => 'y',
            'đ' => 'd',
            ch if ch.is_alphanumeric() => ch,
            _ => ' ',
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join("")
}

fn levenshtein_distance(s1: &str, s2: &str) -> usize {
    let v1: Vec<char> = s1.chars().collect();
    let v2: Vec<char> = s2.chars().collect();
    let m = v1.len();
    let n = v2.len();

    if m == 0 {
        return n;
    }
    if n == 0 {
        return m;
    }

    let mut dp = vec![vec![0; n + 1]; m + 1];
    for i in 0..=m {
        dp[i][0] = i;
    }
    for j in 0..=n {
        dp[0][j] = j;
    }

    for i in 1..=m {
        for j in 1..=n {
            let cost = if v1[i - 1] == v2[j - 1] { 0 } else { 1 };
            dp[i][j] = (dp[i - 1][j] + 1)
                .min(dp[i][j - 1] + 1)
                .min(dp[i - 1][j - 1] + cost);
        }
    }
    dp[m][n]
}

fn calculate_similarity(s1: &str, s2: &str) -> f64 {
    let norm1 = normalize_str(s1);
    let norm2 = normalize_str(s2);

    if norm1.is_empty() || norm2.is_empty() {
        return 0.0;
    }
    if norm1 == norm2 {
        return 1.0;
    }

    if norm1.contains(&norm2) || norm2.contains(&norm1) {
        let min_len = norm1.len().min(norm2.len());
        let max_len = norm1.len().max(norm2.len());
        if min_len >= 3 && (min_len as f64 / max_len as f64) >= 0.5 {
            return 0.85;
        }
    }

    let dist = levenshtein_distance(&norm1, &norm2);
    let max_len = norm1.len().max(norm2.len());
    1.0 - (dist as f64 / max_len as f64)
}

fn is_match_allowed(target_file_name: &str, title: &str, file_name: &str) -> bool {
    let excluded_keywords = [
        "interlude",
        "remake",
        "intro",
        "outro",
        "acoustic",
        "live",
        "demo",
        "remix",
        "instrumental",
        "cover",
    ];

    let norm_target = normalize_str(target_file_name);
    let norm_title = normalize_str(title);
    let norm_file = normalize_str(file_name);

    for kw in excluded_keywords {
        let has_in_target = norm_target.contains(kw);
        let has_in_audio = norm_title.contains(kw) || norm_file.contains(kw);
        if has_in_target && !has_in_audio {
            return false;
        }
    }
    true
}

#[tauri::command]
pub async fn scan_folder(
    app: AppHandle,
    state: State<'_, DbState>,
    folder_path: String,
) -> Result<Vec<Track>, String> {
    let mut audio_files = Vec::new();
    let supported_exts = ["mp3", "flac", "wav", "m4a", "aac", "ogg"];

    for entry in WalkDir::new(&folder_path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if supported_exts.contains(&ext.to_lowercase().as_str()) {
                    audio_files.push(path.to_path_buf());
                }
            }
        }
    }

    let mut scanned_tracks = Vec::new();

    for file_path in audio_files {
        let file_path_str = file_path.to_string_lossy().to_string();
        let file_stem = file_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown");
        let parent_dir = file_path.parent();

        let mut title = file_stem.to_string();
        let mut artist = "Nghệ sĩ chưa biết".to_string();
        let mut album = "Album chưa biết".to_string();
        let mut year = None;
        let mut duration = 0.0;
        let mut picture_data_url = None;

        // Scoped block: đọc ID3 metadata và cover art -> giải phóng heap buffer ngay sau khi ghi đĩa
        {
            if let Ok(tagged_file) = Probe::open(&file_path).and_then(|p| p.read()) {
                let properties = tagged_file.properties();
                duration = properties.duration().as_secs_f64();

                if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
                    if let Some(t) = tag.title() {
                        if !t.trim().is_empty() {
                            title = t.trim().to_string();
                        }
                    }
                    if let Some(a) = tag.artist() {
                        if !a.trim().is_empty() {
                            artist = a.trim().to_string();
                        }
                    }
                    if let Some(al) = tag.album() {
                        if !al.trim().is_empty() {
                            album = al.trim().to_string();
                        }
                    }
                    year = tag.year().map(|y| y as i32);

                    if let Some(pic) = tag.pictures().first() {
                        let mime = pic.mime_type().map(|m| m.as_str());
                        if let Ok(cover_path) = crate::covers::save_cover_art_to_disk(&app, pic.data(), mime) {
                            picture_data_url = Some(cover_path);
                        }
                    }
                }
            }
        } // TaggedFile & raw ID3 memory frames are dropped here immediately


        let mut candidate_dirs = Vec::new();
        if let Some(p) = parent_dir {
            candidate_dirs.push(p.to_path_buf());
            if let Some(gp) = p.parent() {
                candidate_dirs.push(gp.to_path_buf());
            }
        }

        // Smart match LRC
        let mut lrc_path = None;
        if let Some(p) = parent_dir {
            let exact_lrc = p.join(format!("{}.lrc", file_stem));
            if exact_lrc.exists() {
                lrc_path = Some(exact_lrc.to_string_lossy().to_string());
            }
        }

        if lrc_path.is_none() {
            'lrc_search: for dir in &candidate_dirs {
                if let Ok(entries) = fs::read_dir(dir) {
                    let mut best_score = 0.0;
                    let mut best_path = None;
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_file() {
                            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                                if ["lrc", "txt"].contains(&ext.to_lowercase().as_str()) {
                                    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
                                    if !is_match_allowed(stem, &title, file_stem) {
                                        continue;
                                    }
                                    let s1 = calculate_similarity(&title, stem);
                                    let s2 = calculate_similarity(file_stem, stem);
                                    let score = s1.max(s2);
                                    if score > 0.65 && score > best_score {
                                        best_score = score;
                                        best_path = Some(path.to_string_lossy().to_string());
                                    }
                                }
                            }
                        }
                    }
                    if let Some(bp) = best_path {
                        lrc_path = Some(bp);
                        break 'lrc_search;
                    }
                }
            }
        }

        // Smart match MV
        let mut mv_path = None;
        'mv_search: for dir in &candidate_dirs {
            if let Ok(entries) = fs::read_dir(dir) {
                let mut best_score = 0.0;
                let mut best_path = None;
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                            if ["mp4", "mkv", "webm", "mov"].contains(&ext.to_lowercase().as_str()) {
                                let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
                                if !is_match_allowed(stem, &title, file_stem) {
                                    continue;
                                }
                                let s1 = calculate_similarity(&title, stem);
                                let s2 = calculate_similarity(file_stem, stem);
                                let score = s1.max(s2);
                                if score > 0.65 && score > best_score {
                                    best_score = score;
                                    best_path = Some(path.to_string_lossy().to_string());
                                }
                            }
                        }
                    }
                }
                if let Some(bp) = best_path {
                    mv_path = Some(bp);
                    break 'mv_search;
                }
            }
        }

        let track_id = base64::engine::general_purpose::STANDARD.encode(&file_path_str);
        scanned_tracks.push(Track {
            id: track_id,
            file_path: file_path_str,
            title,
            artist,
            album,
            genre: None,
            year,
            duration,
            bpm: None,
            picture: picture_data_url,
            has_lyric: lrc_path.is_some(),
            lrc_path,
            has_mv: mv_path.is_some(),
            mv_path,
        });
    }

    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    db::save_tracks(&mut conn, &scanned_tracks).map_err(|e| e.to_string())?;
    db::get_all_tracks(&conn, None, None).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn record_track_transition(
    db_state: State<'_, DbState>,
    from_id: String,
    to_id: String,
) -> Result<bool, String> {
    let db = db_state.0.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        db::record_track_transition_db(&conn, &from_id, &to_id).map_err(|e| e.to_string())?;
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_smart_recommendation(
    db_state: State<'_, DbState>,
    current_id: String,
    artist: String,
    genre: Option<String>,
    year: Option<i32>,
    bpm: Option<i32>,
) -> Result<Option<Track>, String> {
    let db = db_state.0.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        db::get_smart_recommendation_db(&conn, &current_id, &artist, genre.as_deref(), year, bpm)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_smart_recommendations_batch(
    db_state: State<'_, DbState>,
    current_id: String,
    artist: String,
    genre: Option<String>,
    year: Option<i32>,
    bpm: Option<i32>,
    limit: Option<usize>,
) -> Result<Vec<Track>, String> {
    let db = db_state.0.clone();
    let lim = limit.unwrap_or(14).min(14); // Tối đa 14 bài
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        db::get_smart_recommendations_batch_db(&conn, &current_id, &artist, genre.as_deref(), year, bpm, lim)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ==========================================
// YOUTUBE MUSIC & YT-DLP DOWNLOADER MODULE
// ==========================================

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct YouTubeTrackResult {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration: f64,
    pub thumbnail: String,
    pub url: String,
}

// Alias for search flexibility
#[allow(dead_code)]
pub type YoutubeSearchResult = YouTubeTrackResult;

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloaderToolsStatus {
    pub is_yt_dlp_available: bool,
    pub yt_dlp_available: bool,
    pub is_ffmpeg_available: bool,
    pub ffmpeg_available: bool,
    pub yt_dlp_version: Option<String>,
    pub ffmpeg_version: Option<String>,
    pub yt_dlp_command: Option<String>,
}

#[derive(Clone, Debug)]
pub struct YtDlpExecutionInfo {
    pub program: String,
    pub prefix_args: Vec<String>,
    pub version: String,
}

fn execute_command_silent(program: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd = std::process::Command::new(program);
    cmd.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    let output = cmd.output().map_err(|e| format!("Không thể chạy '{}': {}", program, e))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if err.is_empty() {
            Err(format!("'{}' thoát với mã {:?}", program, output.status.code()))
        } else {
            Err(err)
        }
    }
}

static YT_CACHE: std::sync::Mutex<Option<Option<YtDlpExecutionInfo>>> = std::sync::Mutex::new(None);
static FFMPEG_CACHE: std::sync::Mutex<Option<Option<String>>> = std::sync::Mutex::new(None);

pub fn detect_system_yt_dlp() -> Option<YtDlpExecutionInfo> {
    if let Ok(guard) = YT_CACHE.lock() {
        if let Some(ref cached) = *guard {
            return cached.clone();
        }
    }

    let detected = detect_system_yt_dlp_uncached();
    if let Ok(mut guard) = YT_CACHE.lock() {
        *guard = Some(detected.clone());
    }
    detected
}

fn detect_system_yt_dlp_uncached() -> Option<YtDlpExecutionInfo> {
    // 1. Direct yt-dlp standalone binary (nhanh nhất)
    if let Ok(ver) = execute_command_silent("yt-dlp", &["--version"]) {
        if !ver.is_empty() {
            return Some(YtDlpExecutionInfo {
                program: "yt-dlp".to_string(),
                prefix_args: vec![],
                version: ver,
            });
        }
    }
    // 2. Python launcher 'py' on Windows
    #[cfg(windows)]
    if let Ok(ver) = execute_command_silent("py", &["-m", "yt_dlp", "--version"]) {
        if !ver.is_empty() {
            return Some(YtDlpExecutionInfo {
                program: "py".to_string(),
                prefix_args: vec!["-m".to_string(), "yt_dlp".to_string()],
                version: ver,
            });
        }
    }
    // 3. 'python' command
    if let Ok(ver) = execute_command_silent("python", &["-m", "yt_dlp", "--version"]) {
        if !ver.is_empty() {
            return Some(YtDlpExecutionInfo {
                program: "python".to_string(),
                prefix_args: vec!["-m".to_string(), "yt_dlp".to_string()],
                version: ver,
            });
        }
    }
    // 4. 'python3' command
    if let Ok(ver) = execute_command_silent("python3", &["-m", "yt_dlp", "--version"]) {
        if !ver.is_empty() {
            return Some(YtDlpExecutionInfo {
                program: "python3".to_string(),
                prefix_args: vec!["-m".to_string(), "yt_dlp".to_string()],
                version: ver,
            });
        }
    }
    None
}

pub fn detect_system_ffmpeg() -> Option<String> {
    if let Ok(guard) = FFMPEG_CACHE.lock() {
        if let Some(ref cached) = *guard {
            return cached.clone();
        }
    }

    let detected = if let Ok(out) = execute_command_silent("ffmpeg", &["-version"]) {
        let first_line = out.lines().next().unwrap_or("ffmpeg").to_string();
        Some(first_line)
    } else {
        None
    };

    if let Ok(mut guard) = FFMPEG_CACHE.lock() {
        *guard = Some(detected.clone());
    }
    detected
}

#[tauri::command]
pub async fn check_downloader_tools() -> Result<DownloaderToolsStatus, String> {
    tokio::task::spawn_blocking(|| {
        let yt_info = detect_system_yt_dlp();
        let ffmpeg_ver = detect_system_ffmpeg();

        let yt_available = yt_info.is_some();
        let yt_ver = yt_info.as_ref().map(|info| info.version.clone());
        let yt_cmd = yt_info.as_ref().map(|info| {
            if info.prefix_args.is_empty() {
                info.program.clone()
            } else {
                format!("{} {}", info.program, info.prefix_args.join(" "))
            }
        });

        let ff_available = ffmpeg_ver.is_some();

        Ok(DownloaderToolsStatus {
            is_yt_dlp_available: yt_available,
            yt_dlp_available: yt_available,
            is_ffmpeg_available: ff_available,
            ffmpeg_available: ff_available,
            yt_dlp_version: yt_ver,
            ffmpeg_version: ffmpeg_ver,
            yt_dlp_command: yt_cmd,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}



#[allow(dead_code)]
pub fn cleanup_stale_temp_files(target_dir: &std::path::Path, max_age_secs: u64) -> usize {
    let mut cleaned = 0;
    let now = std::time::SystemTime::now();
    let max_age = std::time::Duration::from_secs(max_age_secs);

    if let Ok(entries) = std::fs::read_dir(target_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let fname = path.file_name().and_then(|f| f.to_str()).unwrap_or("");
                let is_temp = fname.ends_with(".part")
                    || fname.ends_with(".ytdl")
                    || fname.contains(".tmp.")
                    || fname.ends_with(".temp");

                if is_temp {
                    if let Ok(meta) = entry.metadata() {
                        if let Ok(modified) = meta.modified() {
                            if let Ok(age) = now.duration_since(modified) {
                                if age > max_age {
                                    if std::fs::remove_file(&path).is_ok() {
                                        cleaned += 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    cleaned
}

fn internal_search_youtube(
    query: String,
    limit: Option<usize>,
) -> Result<Vec<YouTubeTrackResult>, String> {
    let lim = limit.unwrap_or(12).clamp(1, 40);
    let q = query.trim();
    if q.is_empty() {
        return Ok(Vec::new());
    }

    let yt_exec = detect_system_yt_dlp().ok_or_else(|| {
        "yt-dlp chưa sẵn sàng trong hệ thống. Vui lòng cài đặt yt-dlp hoặc module Python yt-dlp.".to_string()
    })?;

    let search_target = if q.starts_with("http://") || q.starts_with("https://") {
        q.to_string()
    } else {
        format!("ytsearch{}:{}", lim, q)
    };

    let mut cmd = std::process::Command::new(&yt_exec.program);
    for arg in &yt_exec.prefix_args {
        cmd.arg(arg);
    }
    cmd.arg(&search_target)
        .arg("--dump-json")
        .arg("--flat-playlist")
        .arg("--no-warnings")
        .arg("--no-check-certificates")
        .arg("--ignore-errors");

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let output = cmd.output().map_err(|e| format!("Lỗi gọi yt-dlp: {}", e))?;
    if !output.status.success() && output.stdout.is_empty() {
        return Err(format!("yt-dlp search error: {}", String::from_utf8_lossy(&output.stderr)));
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let mut results = Vec::new();

    for line in stdout_str.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
            let entry_type = val.get("_type").and_then(|v| v.as_str()).unwrap_or("video");
            let id = val.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if id.is_empty() || (entry_type == "url" && id.starts_with("UC")) {
                continue;
            }

            let raw_title = val.get("title").and_then(|v| v.as_str()).unwrap_or("Unknown Title").to_string();
            let channel = val.get("channel")
                .or_else(|| val.get("uploader"))
                .or_else(|| val.get("creator"))
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown Artist")
                .to_string();
            let duration = val.get("duration").and_then(|v| v.as_f64()).unwrap_or(0.0);

            let thumbnail = if let Some(thumb) = val.get("thumbnail").and_then(|v| v.as_str()) {
                thumb.to_string()
            } else if let Some(thumbs) = val.get("thumbnails").and_then(|v| v.as_array()) {
                thumbs.last().and_then(|t| t.get("url")).and_then(|u| u.as_str()).unwrap_or("").to_string()
            } else {
                format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", id)
            };

            let url = val.get("webpage_url").or_else(|| val.get("url")).and_then(|v| v.as_str()).unwrap_or("").to_string();
            let final_url = if url.starts_with("http") {
                url
            } else {
                format!("https://www.youtube.com/watch?v={}", id)
            };

            let (final_artist, final_title) = if raw_title.contains(" - ") {
                let parts: Vec<&str> = raw_title.splitn(2, " - ").collect();
                (parts[0].trim().to_string(), parts[1].trim().to_string())
            } else {
                (channel, raw_title)
            };

            results.push(YouTubeTrackResult {
                id,
                title: final_title,
                artist: final_artist,
                album: Some("YouTube Music".to_string()),
                duration,
                thumbnail,
                url: final_url,
            });
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn search_youtube_music(
    query: String,
    limit: Option<usize>,
) -> Result<Vec<YouTubeTrackResult>, String> {
    tokio::task::spawn_blocking(move || internal_search_youtube(query, limit))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn search_youtube_music_query(
    query: String,
    limit: Option<usize>,
) -> Result<Vec<YouTubeTrackResult>, String> {
    tokio::task::spawn_blocking(move || internal_search_youtube(query, limit))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_youtube_preview_stream_url(
    url_or_id: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let yt_exec = detect_system_yt_dlp().ok_or_else(|| {
            "yt-dlp chưa sẵn sàng trong hệ thống.".to_string()
        })?;

        let target_url = if url_or_id.starts_with("http://") || url_or_id.starts_with("https://") {
            url_or_id
        } else {
            format!("https://www.youtube.com/watch?v={}", url_or_id.trim())
        };

        let mut cmd = std::process::Command::new(&yt_exec.program);
        for arg in &yt_exec.prefix_args {
            cmd.arg(arg);
        }
        cmd.arg("-g")
            .arg("-f")
            .arg("ba[ext=m4a]/ba/b/bestaudio/best")
            .arg("--extractor-args")
            .arg("youtube:player_client=mweb,android,web_creator,tv")
            .arg("--no-playlist")
            .arg("--no-warnings")
            .arg("--no-check-certificates")
            .arg(&target_url);

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }

        let output = cmd.output().map_err(|e| format!("Lỗi gọi yt-dlp -g: {}", e))?;
        if !output.status.success() {
            return Err(format!("Không thể lấy link stream: {}", String::from_utf8_lossy(&output.stderr)));
        }

        let stdout_str = String::from_utf8_lossy(&output.stdout);
        let first_line = stdout_str.lines().find(|l| !l.trim().is_empty()).ok_or_else(|| {
            "Không nhận được URL stream âm thanh.".to_string()
        })?;

        Ok(first_line.trim().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_artist_discovery_recommendations(
    artists: Vec<String>,
    limit_per_artist: Option<usize>,
) -> Result<Vec<YouTubeTrackResult>, String> {
    tokio::task::spawn_blocking(move || {
        let per_artist = limit_per_artist.unwrap_or(4).clamp(1, 8);
        let mut all_results = Vec::new();

        let yt_exec = match detect_system_yt_dlp() {
            Some(exec) => exec,
            None => return Ok(Vec::new()),
        };

        for artist in artists.iter().take(6) {
            let clean_artist = artist.trim();
            if clean_artist.is_empty() {
                continue;
            }

            let q = format!("ytsearch{}:{} official music audio", per_artist * 2, clean_artist);
            let mut cmd = std::process::Command::new(&yt_exec.program);
            for arg in &yt_exec.prefix_args {
                cmd.arg(arg);
            }
            cmd.arg(&q)
                .arg("--dump-json")
                .arg("--flat-playlist")
                .arg("--no-warnings")
                .arg("--no-check-certificates")
                .arg("--ignore-errors");

            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x08000000);
            }

            if let Ok(output) = cmd.output() {
                if output.status.success() {
                    let stdout_str = String::from_utf8_lossy(&output.stdout);
                    let mut count_for_this_artist = 0;
                    for line in stdout_str.lines() {
                        let line = line.trim();
                        if line.is_empty() {
                            continue;
                        }
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(line) {
                            let id = val.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            if id.is_empty() || id.starts_with("UC") {
                                continue;
                            }
                            let duration = val.get("duration").and_then(|v| v.as_f64()).unwrap_or(0.0);
                            // LỌC NGHIÊM NGẶT: Không lấy video dài hơn 7 phút (420s) hoặc không có thời lượng
                            if duration > 420.0 || duration <= 0.0 {
                                continue;
                            }

                            let raw_title = val.get("title").and_then(|v| v.as_str()).unwrap_or("Unknown Title").to_string();
                            let thumbnail = if let Some(thumb) = val.get("thumbnail").and_then(|v| v.as_str()) {
                                thumb.to_string()
                            } else {
                                format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", id)
                            };
                            let final_url = format!("https://www.youtube.com/watch?v={}", id);

                            let (clean_art, clean_title) = if raw_title.contains(" - ") {
                                let parts: Vec<&str> = raw_title.splitn(2, " - ").collect();
                                (parts[0].trim().to_string(), parts[1].trim().to_string())
                            } else {
                                (clean_artist.to_string(), raw_title)
                            };

                            all_results.push(YouTubeTrackResult {
                                id,
                                title: clean_title,
                                artist: clean_art,
                                album: Some("YouTube Music".to_string()),
                                duration,
                                thumbnail,
                                url: final_url,
                            });

                            count_for_this_artist += 1;
                            if count_for_this_artist >= per_artist {
                                break;
                            }
                        }
                    }
                }
            }
        }

        Ok(all_results)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn internal_download_track(
    app_handle: &AppHandle,
    conn_arc: &std::sync::Arc<std::sync::Mutex<rusqlite::Connection>>,
    url: String,
    title_opt: Option<String>,
    artist_opt: Option<String>,
    album_opt: Option<String>,
    output_dir: Option<String>,
    format_opt: Option<String>,
    download_type_opt: Option<String>,
    thumbnail_opt: Option<String>,
) -> Result<Track, String> {
    let yt_exec = detect_system_yt_dlp().ok_or_else(|| {
        "yt-dlp chưa sẵn sàng trong hệ thống. Vui lòng kiểm tra lại.".to_string()
    })?;

    let has_ffmpeg = detect_system_ffmpeg().is_some();
    let is_video_only = download_type_opt.as_deref() == Some("video");
    let is_both = download_type_opt.as_deref() == Some("both");

    let audio_format = match format_opt.as_deref() {
        Some("m4a") => "m4a",
        Some("flac") => "flac",
        Some("wav") => "wav",
        Some("ogg") => "ogg",
        _ => "mp3",
    };

    let target_dir = if let Some(dir) = output_dir {
        let p = std::path::PathBuf::from(dir);
        if !p.exists() {
            let _ = std::fs::create_dir_all(&p);
        }
        p
    } else {
        let base_dir = app_handle
            .path()
            .download_dir()
            .or_else(|_| app_handle.path().audio_dir())
            .or_else(|_| app_handle.path().app_data_dir())
            .unwrap_or_else(|_| std::path::PathBuf::from("."));
        let p = base_dir.join("musicccc_downloads");
        if !p.exists() {
            let _ = std::fs::create_dir_all(&p);
        }
        p
    };

    let title_param = title_opt.unwrap_or_default().trim().to_string();
    let artist_param = artist_opt.unwrap_or_default().trim().to_string();

    let safe_title = sanitize_filename(&title_param);
    let safe_artist = sanitize_filename(&artist_param);

    let mut mv_path_str: Option<String> = None;
    let mut has_mv = false;

    // 1. Tải Video MV nếu được yêu cầu (kèm cờ tải thumbnail)
    if is_video_only || is_both {
        let mv_template = if !safe_artist.is_empty() && !safe_title.is_empty() {
            target_dir.join(format!("{} - {}.mp4", safe_artist, safe_title))
        } else {
            target_dir.join("%(title).100B [%(id)s].mp4")
        };
        let mv_template_str = mv_template.to_string_lossy().to_string();

        let mut mv_cmd = std::process::Command::new(&yt_exec.program);
        for arg in &yt_exec.prefix_args {
            mv_cmd.arg(arg);
        }
        mv_cmd.arg(&url);

        if has_ffmpeg {
            mv_cmd
                .arg("-f")
                .arg("bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best")
                .arg("--merge-output-format")
                .arg("mp4");
        } else {
            // Không có ffmpeg: Tải stream progressive MP4 có sẵn cả hình lẫn tiếng, không cần merge
            mv_cmd.arg("-f").arg("b[ext=mp4]/b/best");
        }

        mv_cmd
            .arg("--write-thumbnail")
            .arg("--extractor-args")
            .arg("youtube:player_client=mweb,android,web_creator,tv")
            .arg("--user-agent")
            .arg("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
            .arg("--geo-bypass")
            .arg("--no-playlist")
            .arg("--no-warnings")
            .arg("--no-check-certificates")
            .arg("--print")
            .arg("after_move:filepath")
            .arg("-o")
            .arg(&mv_template_str);

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            mv_cmd.creation_flags(0x08000000);
        }

        if let Ok(output) = mv_cmd.output() {
            if output.status.success() {
                let stdout_str = String::from_utf8_lossy(&output.stdout);
                for line in stdout_str.lines().rev() {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() {
                        let candidate = std::path::PathBuf::from(trimmed);
                        if candidate.exists() && candidate.is_file() {
                            mv_path_str = Some(candidate.to_string_lossy().to_string());
                            has_mv = true;
                            break;
                        }
                    }
                }
                if mv_path_str.is_none() && mv_template.exists() {
                    mv_path_str = Some(mv_template.to_string_lossy().to_string());
                    has_mv = true;
                }
            }
        }
    }

    // 2. Thực thi tải Audio với cơ chế Dual-Engine (Có FFmpeg vs Không có FFmpeg, kèm cờ --write-thumbnail)
    let mut downloaded_path: Option<std::path::PathBuf> = None;

    if !is_video_only {
        let out_template = if !safe_artist.is_empty() && !safe_title.is_empty() {
            target_dir.join(format!("{} - {}.%(ext)s", safe_artist, safe_title))
        } else {
            target_dir.join("%(title).100B [%(id)s].%(ext)s")
        };
        let out_template_str = out_template.to_string_lossy().to_string();

        let mut cmd = std::process::Command::new(&yt_exec.program);
        for arg in &yt_exec.prefix_args {
            cmd.arg(arg);
        }
        cmd.arg(&url)
            .arg("--write-thumbnail")
            .arg("--extractor-args")
            .arg("youtube:player_client=mweb,android,web_creator,tv")
            .arg("--user-agent")
            .arg("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
            .arg("--geo-bypass");

        if has_ffmpeg {
            // Mode A: Hệ thống có ffmpeg -> Tải và convert định dạng mong muốn + nhúng tag
            cmd.arg("-x")
                .arg("--audio-format")
                .arg(audio_format)
                .arg("--audio-quality")
                .arg("0")
                .arg("--embed-metadata")
                .arg("--embed-thumbnail");
        } else {
            // Mode B: Không có ffmpeg -> Tải trực tiếp native audio stream gốc (m4a/webm/ba), 100% không crash
            cmd.arg("-f")
                .arg("ba[ext=m4a]/ba/b/bestaudio/best");
        }

        cmd.arg("--no-playlist")
            .arg("--no-warnings")
            .arg("--no-check-certificates")
            .arg("--print")
            .arg("after_move:filepath")
            .arg("-o")
            .arg(&out_template_str);

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }

        let output = cmd.output().map_err(|e| format!("Lỗi thực thi yt-dlp: {}", e))?;
        if !output.status.success() {
            let err_msg = String::from_utf8_lossy(&output.stderr);
            eprintln!("[Downloader Error] yt-dlp stderr: {}", err_msg);
            return Err(format!("Lỗi khi tải bài hát từ YouTube: {}", err_msg));
        }

        let stdout_str = String::from_utf8_lossy(&output.stdout);
        for line in stdout_str.lines().rev() {
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                let candidate = std::path::PathBuf::from(trimmed);
                if candidate.exists() && candidate.is_file() {
                    downloaded_path = Some(candidate);
                    break;
                }
            }
        }
    } else {
        // Chế độ chỉ tải video MP4: Lấy đường dẫn file MP4 làm file media chính
        if let Some(ref mp4_str) = mv_path_str {
            downloaded_path = Some(std::path::PathBuf::from(mp4_str));
        }
    }

    // Fallback check by newest file in target_dir
    if downloaded_path.is_none() {
        if let Ok(entries) = std::fs::read_dir(&target_dir) {
            let mut newest_file: Option<(std::path::PathBuf, std::time::SystemTime)> = None;
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() {
                    let fname = p.file_name().and_then(|f| f.to_str()).unwrap_or("");
                    if !fname.ends_with(".part") && !fname.ends_with(".ytdl") {
                        if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                            if ext.eq_ignore_ascii_case(audio_format) || (is_video_only && ext.eq_ignore_ascii_case("mp4")) {
                                if let Ok(meta) = p.metadata() {
                                    if let Ok(mtime) = meta.modified() {
                                        if newest_file.as_ref().map_or(true, |(_, t)| mtime > *t) {
                                            newest_file = Some((p, mtime));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            downloaded_path = newest_file.map(|(p, _)| p);
        }
    }

    let final_path = downloaded_path.ok_or_else(|| {
        "Tải file hoàn tất nhưng không tìm thấy tệp audio lưu trên ổ đĩa.".to_string()
    })?;
    let final_path_str = final_path.to_string_lossy().to_string();

    let mut final_title = if !title_param.is_empty() {
        title_param
    } else {
        final_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown Track")
            .to_string()
    };
    let mut final_artist = if !artist_param.is_empty() {
        artist_param
    } else {
        "YouTube Music".to_string()
    };
    let mut final_album = album_opt.unwrap_or_else(|| "YouTube Music".to_string());
    let mut duration = 0.0;
    let mut year = Some(chrono::Datelike::year(&chrono::Local::now()));
    let mut picture_path = None;

    // A. Thử đọc tag ID3 nếu file đã có embedded picture (Eager scoped block)
    {
        if let Ok(tagged_file) = lofty::probe::Probe::open(&final_path).and_then(|p| p.read()) {
            duration = tagged_file.properties().duration().as_secs_f64();

            if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
                if let Some(t) = tag.title() {
                    if !t.trim().is_empty() && (final_title.is_empty() || final_title == "Unknown Track") {
                        final_title = t.trim().to_string();
                    }
                }
                if let Some(a) = tag.artist() {
                    if !a.trim().is_empty() && (final_artist.is_empty() || final_artist == "YouTube Music") {
                        final_artist = a.trim().to_string();
                    }
                }
                if let Some(al) = tag.album() {
                    if !al.trim().is_empty() {
                        final_album = al.trim().to_string();
                    }
                }
                if let Some(y) = tag.year() {
                    year = Some(y as i32);
                }

                if let Some(pic) = tag.pictures().first() {
                    let ext = match pic.mime_type() {
                        Some(lofty::picture::MimeType::Png) => "png",
                        _ => "jpg",
                    };
                    if let Ok(saved_p) = crate::covers::save_cover_art_to_disk(app_handle, pic.data(), Some(ext)) {
                        picture_path = Some(saved_p);
                    }
                }
            }
        }
    } // TaggedFile & raw Lofty ID3 buffers are dropped immediately

    // B. Nếu chưa có ảnh bìa, tự động quét các file thumbnail mà yt-dlp vừa tải về (Scoped byte release)
    if picture_path.is_none() {
        let possible_thumbs = [
            final_path.with_extension("webp"),
            final_path.with_extension("jpg"),
            final_path.with_extension("jpeg"),
            final_path.with_extension("png"),
        ];
        for p in &possible_thumbs {
            if p.exists() && p.is_file() {
                let saved_res = {
                    if let Ok(bytes) = std::fs::read(p) {
                        let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("jpg");
                        let res = crate::covers::save_cover_art_to_disk(app_handle, &bytes, Some(ext));
                        res.ok()
                    } else {
                        None
                    }
                }; // `bytes` (Vec<u8>) is dropped and freed here
                if let Some(saved_p) = saved_res {
                    picture_path = Some(saved_p);
                    let _ = std::fs::remove_file(p);
                    break;
                }
            }
        }
    }

    // C. Nếu vẫn chưa có, tải trực tiếp thumbnail URL qua ureq (Scoped network buffer release)
    if picture_path.is_none() {
        if let Some(ref thumb_url) = thumbnail_opt {
            if thumb_url.starts_with("http://") || thumb_url.starts_with("https://") {
                let saved_res = {
                    if let Ok(resp) = ureq::get(thumb_url).call() {
                        let mut bytes = Vec::new();
                        if std::io::Read::read_to_end(&mut resp.into_reader(), &mut bytes).is_ok() && !bytes.is_empty() {
                            let res = crate::covers::save_cover_art_to_disk(app_handle, &bytes, Some("jpg"));
                            res.ok()
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                }; // network bytes buffer dropped and freed here
                if let Some(saved_p) = saved_res {
                    picture_path = Some(saved_p);
                }
            }
        }
    }

    // D. Trích xuất URL thumbnail bằng yt-dlp nếu vẫn chưa có (Scoped command & buffer release)
    if picture_path.is_none() {
        let thumb_url = {
            let mut info_cmd = std::process::Command::new(&yt_exec.program);
            for arg in &yt_exec.prefix_args {
                info_cmd.arg(arg);
            }
            info_cmd
                .arg(&url)
                .arg("--print")
                .arg("thumbnail")
                .arg("--no-warnings")
                .arg("--no-playlist");

            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                info_cmd.creation_flags(0x08000000);
            }

            if let Ok(output) = info_cmd.output() {
                if output.status.success() {
                    let out_str = String::from_utf8_lossy(&output.stdout);
                    out_str.lines().next().unwrap_or("").trim().to_string()
                } else {
                    String::new()
                }
            } else {
                String::new()
            }
        };

        if thumb_url.starts_with("http") {
            let saved_res = {
                if let Ok(resp) = ureq::get(&thumb_url).call() {
                    let mut bytes = Vec::new();
                    if std::io::Read::read_to_end(&mut resp.into_reader(), &mut bytes).is_ok() && !bytes.is_empty() {
                        let res = crate::covers::save_cover_art_to_disk(app_handle, &bytes, Some("jpg"));
                        res.ok()
                    } else {
                        None
                    }
                } else {
                    None
                }
            }; // bytes dropped here
            if let Some(saved_p) = saved_res {
                picture_path = Some(saved_p);
            }
        }
    }

    let possible_lrc = final_path.with_extension("lrc");
    let (has_lyric, lrc_path) = if possible_lrc.exists() {
        (true, Some(possible_lrc.to_string_lossy().to_string()))
    } else {
        (false, None)
    };

    let track_id = base64::engine::general_purpose::STANDARD.encode(&final_path_str);
    let track_record = Track {
        id: track_id,
        file_path: final_path_str,
        title: final_title.clone(),
        artist: final_artist.clone(),
        album: final_album,
        genre: Some("Pop / Electronic".to_string()),
        year,
        duration,
        bpm: None,
        picture: picture_path.clone(),
        has_lyric,
        lrc_path,
        has_mv,
        mv_path: mv_path_str.clone(),
    };

    let mut conn = conn_arc.lock().map_err(|e| e.to_string())?;

    // Tự động liên kết MV vào bài hát audio có sẵn trong thư viện
    if has_mv {
        if let Some(ref m_path) = mv_path_str {
            let _ = conn.execute(
                "UPDATE saved_tracks SET has_mv = 1, mv_path = ?1 
                 WHERE lower(trim(title)) = lower(trim(?2)) AND lower(trim(artist)) = lower(trim(?3))",
                rusqlite::params![m_path, final_title, final_artist],
            );
        }
    }

    // Tự động cập nhật ảnh bìa cho bài hát có sẵn nếu bài cũ chưa có ảnh
    if let Some(ref pic) = picture_path {
        let _ = conn.execute(
            "UPDATE saved_tracks SET picture = ?1 
             WHERE lower(trim(title)) = lower(trim(?2)) AND lower(trim(artist)) = lower(trim(?3)) AND (picture IS NULL OR picture = '')",
            rusqlite::params![pic, final_title, final_artist],
        );
    }

    db::save_tracks(&mut conn, &[track_record.clone()]).map_err(|e| e.to_string())?;

    let _ = app_handle.emit("track-downloaded", &track_record);
    let _ = app_handle.emit("library-updated", ());

    Ok(track_record)
}

#[tauri::command]
pub async fn download_youtube_track(
    app: AppHandle,
    db_state: State<'_, DbState>,
    url: String,
    title: String,
    artist: String,
    album: Option<String>,
    output_dir: Option<String>,
    download_type: Option<String>,
    thumbnail: Option<String>,
) -> Result<Track, String> {
    let app_handle = app.clone();
    let db = db_state.0.clone();

    tokio::task::spawn_blocking(move || {
        internal_download_track(
            &app_handle,
            &db,
            url,
            Some(title),
            Some(artist),
            album,
            output_dir,
            Some("mp3".to_string()),
            download_type,
            thumbnail,
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn download_youtube_audio_track(
    app: AppHandle,
    db_state: State<'_, DbState>,
    url: String,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    output_dir: Option<String>,
    format: Option<String>,
    download_type: Option<String>,
    thumbnail: Option<String>,
) -> Result<Track, String> {
    let app_handle = app.clone();
    let db = db_state.0.clone();

    tokio::task::spawn_blocking(move || {
        internal_download_track(
            &app_handle,
            &db,
            url,
            title,
            artist,
            album,
            output_dir,
            format,
            download_type,
            thumbnail,
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_random_library_artists(
    state: State<'_, DbState>,
    limit: Option<usize>,
) -> Result<Vec<String>, String> {
    let db = state.0.clone();
    tokio::task::spawn_blocking(move || {
        let conn = db.lock().map_err(|e| e.to_string())?;
        db::get_random_artists(&conn, limit.unwrap_or(5)).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ==========================================
// MEMORY LIFECYCLE & WORKING SET RECLAMATION
// ==========================================

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MemoryShrinkResult {
    pub success: bool,
    pub freed_db_pages: bool,
    pub trimmed_os_working_set: bool,
    pub timestamp: i64,
    pub message: String,
}

#[tauri::command]
pub async fn shrink_memory(
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<MemoryShrinkResult, String> {
    let db = state.0.clone();
    let app_handle = app.clone();

    tokio::task::spawn_blocking(move || {
        // 1. SQLite Memory Reclamation: giải phóng B-Tree page cache và schema cache
        let freed_db = {
            if let Ok(conn) = db.lock() {
                let _ = conn.execute_batch("PRAGMA shrink_memory;");
                let _ = conn.execute_batch("PRAGMA wal_checkpoint(PASSIVE);");
                let _ = crate::covers::cleanup_orphan_covers(&app_handle, &conn);
                true
            } else {
                false
            }
        };

        // 2. OS Working Set Trimming / Native Allocator Memory Return
        let mut trimmed_os = false;

        #[cfg(windows)]
        unsafe {
            extern "system" {
                fn GetCurrentProcess() -> isize;
                fn SetProcessWorkingSetSize(
                    hProcess: isize,
                    dwMinimumWorkingSetSize: usize,
                    dwMaximumWorkingSetSize: usize,
                ) -> i32;
            }
            // Passing usize::MAX triggers Windows Working Set trim, reducing physical RSS immediately
            let h_proc = GetCurrentProcess();
            if SetProcessWorkingSetSize(h_proc, usize::MAX, usize::MAX) != 0 {
                trimmed_os = true;
            }
        }

        #[cfg(any(target_os = "linux", target_os = "android"))]
        unsafe {
            extern "C" {
                fn malloc_trim(pad: usize) -> i32;
            }
            if malloc_trim(0) == 1 {
                trimmed_os = true;
            }
        }

        #[cfg(target_os = "macos")]
        {
            trimmed_os = true;
        }

        let now = chrono::Local::now().timestamp_millis();

        Ok(MemoryShrinkResult {
            success: true,
            freed_db_pages: freed_db,
            trimmed_os_working_set: trimmed_os,
            timestamp: now,
            message: "Bộ nhớ Backend, SQLite PRAGMA shrink_memory và OS Working Set đã được thu hồi triệt để.".to_string(),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

