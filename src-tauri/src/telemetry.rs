use chrono::Utc;
use rusqlite::{params, Connection, Result};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct ActiveTrackSession {
    pub song_id: String,
    pub title: String,
    pub artist: String,
    pub album_art: Option<String>,
    pub track_duration: f64,
}

#[derive(Debug, Clone)]
pub struct TelemetryFlushPayload {
    pub session: ActiveTrackSession,
    pub duration_listened: f64,
}

pub struct TelemetryEngine {
    pub active_session: Option<ActiveTrackSession>,
    pub is_playing: bool,
    pub last_tick_time: Option<Instant>,
    pub accumulated_seconds: f64,
    pub current_playback_rate: f32,
}

impl TelemetryEngine {
    pub fn new() -> Self {
        Self {
            active_session: None,
            is_playing: false,
            last_tick_time: None,
            accumulated_seconds: 0.0,
            current_playback_rate: 1.0,
        }
    }

    // Tích lũy thời gian từ tick cuối
    pub fn update_accumulator(&mut self) {
        if self.is_playing {
            if let Some(last) = self.last_tick_time {
                let delta = last.elapsed().as_secs_f64() * (self.current_playback_rate as f64);
                self.accumulated_seconds += delta;
            }
            self.last_tick_time = Some(Instant::now());
        }
    }

    pub fn on_play(&mut self) {
        self.update_accumulator();
        self.is_playing = true;
        self.last_tick_time = Some(Instant::now());
    }

    pub fn on_pause(&mut self) {
        self.update_accumulator();
        self.is_playing = false;
        self.last_tick_time = None;
    }

    pub fn on_rate_change(&mut self, new_rate: f32) {
        self.update_accumulator();
        self.current_playback_rate = if new_rate > 0.0 { new_rate } else { 1.0 };
    }

    /// Trích xuất payload cần flush và reset accumulated_seconds trong RAM.
    /// Giúp nhả Mutex Lock ngay lập tức trước khi ghi DB (Loại bỏ Deadlock).
    pub fn extract_flush_payload(&mut self) -> Option<TelemetryFlushPayload> {
        self.update_accumulator();

        let duration = self.accumulated_seconds;
        self.accumulated_seconds = 0.0;

        if !self.is_playing {
            self.last_tick_time = None;
        } else {
            self.last_tick_time = Some(Instant::now());
        }

        if duration > 0.5 {
            if let Some(ref session) = self.active_session {
                return Some(TelemetryFlushPayload {
                    session: session.clone(),
                    duration_listened: duration,
                });
            }
        }
        None
    }
}

/// Hàm ghi dữ liệu độc lập xuống SQLite DB không giữ Telemetry Mutex Lock.
pub fn write_telemetry_flush_to_db(conn: &mut Connection, payload: TelemetryFlushPayload) -> Result<()> {
    // Ngưỡng tính Valid Play: Min(30s, 50% độ dài bài)
    let valid_threshold = if payload.session.track_duration > 0.0 {
        30.0_f64.min(payload.session.track_duration * 0.5)
    } else {
        30.0
    };
    let is_valid = payload.duration_listened >= valid_threshold;
    let valid_num = if is_valid { 1 } else { 0 };

    let now_timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let date_key: i32 = Utc::now().format("%Y%m%d").to_string().parse().unwrap_or(0);

    // Mở Single Transaction ghi đồng bộ 3 bảng
    let tx = conn.transaction()?;

    // 1. Ghi Raw Log
    tx.execute(
        "INSERT INTO play_history (song_id, song_title, artist_name, album_art, played_at, duration_listened, is_valid_play)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            payload.session.song_id,
            payload.session.title,
            payload.session.artist,
            payload.session.album_art,
            now_timestamp,
            payload.duration_listened,
            valid_num
        ],
    )?;

    // 2. Upsert Daily Bucket
    tx.execute(
        "INSERT INTO daily_song_analytics (date_key, song_id, song_title, artist_name, album_art, total_duration, valid_play_count)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(date_key, song_id) DO UPDATE SET
           total_duration = total_duration + excluded.total_duration,
           valid_play_count = valid_play_count + excluded.valid_play_count,
           song_title = CASE WHEN excluded.song_title != '' THEN excluded.song_title ELSE daily_song_analytics.song_title END,
           artist_name = CASE WHEN excluded.artist_name != '' THEN excluded.artist_name ELSE daily_song_analytics.artist_name END,
           album_art = COALESCE(excluded.album_art, daily_song_analytics.album_art)",
        params![
            date_key,
            payload.session.song_id,
            payload.session.title,
            payload.session.artist,
            payload.session.album_art,
            payload.duration_listened,
            valid_num
        ],
    )?;

    // 3. Upsert All-Time Aggregate
    tx.execute(
        "INSERT INTO song_analytics_all (song_id, song_title, artist_name, album_art, total_duration, valid_play_count, last_played_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(song_id) DO UPDATE SET
           total_duration = total_duration + excluded.total_duration,
           valid_play_count = valid_play_count + excluded.valid_play_count,
           last_played_at = MAX(song_analytics_all.last_played_at, excluded.last_played_at),
           song_title = CASE WHEN excluded.song_title != '' THEN excluded.song_title ELSE song_analytics_all.song_title END,
           artist_name = CASE WHEN excluded.artist_name != '' THEN excluded.artist_name ELSE song_analytics_all.artist_name END,
           album_art = COALESCE(excluded.album_art, song_analytics_all.album_art)",
        params![
            payload.session.song_id,
            payload.session.title,
            payload.session.artist,
            payload.session.album_art,
            payload.duration_listened,
            valid_num,
            now_timestamp
        ],
    )?;

    let _ = tx.execute("DELETE FROM top_charts_cache", []);
    tx.commit()?;
    Ok(())
}
