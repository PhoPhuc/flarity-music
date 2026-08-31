use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub file_path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub genre: Option<String>,
    pub year: Option<i32>,
    pub duration: f64,
    pub bpm: Option<i32>,
    pub picture: Option<String>,
    pub has_lyric: bool,
    pub lrc_path: Option<String>,
    pub has_mv: bool,
    pub mv_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub cover_art: Option<String>,
    pub created_at: i64,
    pub track_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlayRecordInput {
    pub song_id: String,
    pub song_title: String,
    pub artist_name: String,
    pub album_art: Option<String>,
    pub duration_listened: f64,
    pub is_valid_play: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryPayload {
    pub track_id: String,
    pub delta_seconds: f64,
    pub playback_speed: f64,
    pub timestamp: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsOverview {
    pub total_duration_seconds: f64,
    pub total_valid_plays: i64,
    pub total_unique_songs: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopSongStats {
    pub song_id: String,
    pub title: String,
    pub artist: String,
    pub picture: Option<String>,
    pub play_count: i64,
    pub total_duration: f64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopArtistStats {
    pub artist: String,
    pub play_count: i64,
    pub total_duration: f64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsStats {
    pub overview: AnalyticsOverview,
    pub top_songs: Vec<TopSongStats>,
    pub top_artists: Vec<TopArtistStats>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TopListenedTrack {
    pub song_id: String,
    pub total_duration: f64,
    pub play_count: i64,
}

pub fn get_db_path(app: &AppHandle) -> PathBuf {
    if let Ok(dir) = app.path().app_data_dir() {
        if !dir.exists() {
            let _ = fs::create_dir_all(&dir);
        }
        return dir.join("music_analytics.db");
    }
    if let Ok(dir) = app.path().app_local_data_dir() {
        if !dir.exists() {
            let _ = fs::create_dir_all(&dir);
        }
        return dir.join("music_analytics.db");
    }
    std::env::temp_dir().join("music_analytics.db")
}

pub fn init_db(app: &AppHandle) -> Result<Connection> {
    let db_path = get_db_path(app);
    let conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[DB WARN] Failed to open DB at {:?}: {}. Fallback to in-memory DB.", db_path, e);
            Connection::open_in_memory()?
        }
    };

    // Thực thi PRAGMAs siêu tiết kiệm RAM (< 8MB RAM, tốc độ < 0.2ms)
    let _ = conn.execute_batch("
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA temp_store = MEMORY;
        PRAGMA cache_size = -2048;           -- 2MB Page Cache (đủ chứa toàn bộ B-Tree Index)
        PRAGMA mmap_size = 0;                -- 0 Byte Virtual Memory Map thừa
        PRAGMA wal_autocheckpoint = 100;     -- Checkpoint liên tục khi WAL đạt 100 pages (~400KB)
        PRAGMA busy_timeout = 5000;          -- Chờ 5s chống Database Locked
        PRAGMA foreign_keys = ON;            -- Kích hoạt ràng buộc khóa ngoại Cascade
    ");

    let user_version: i32 = conn
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .unwrap_or(0);

    // Nếu schema đã được khởi tạo (user_version >= 2), bỏ qua chạy lại 30 lệnh CREATE TABLE/INDEX để khởi động trong 0.5ms
    if user_version < 2 {
        conn.execute_batch(
            "
            -- 1. BẢNG RAW LOGS: Nhật ký phát bài hát (1 Session = 1 Dòng)
            CREATE TABLE IF NOT EXISTS play_history (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              song_id TEXT NOT NULL,
              song_title TEXT NOT NULL,
              artist_name TEXT NOT NULL,
              album_art TEXT,
              played_at INTEGER NOT NULL,        -- Unix Timestamp (seconds)
              duration_listened REAL NOT NULL,   -- Mức nghe thực tế (Kiểu REAL/Float)
              is_valid_play INTEGER NOT NULL     -- 1 nếu valid, 0 nếu skip
            );

            -- 2. BẢNG DAILY BUCKETS: Tổng hợp theo ngày (YYYYMMDD)
            CREATE TABLE IF NOT EXISTS daily_song_analytics (
              date_key INTEGER NOT NULL,         -- YYYYMMDD dạng INT (ví dụ: 20260809)
              song_id TEXT NOT NULL,
              song_title TEXT NOT NULL,
              artist_name TEXT NOT NULL,
              album_art TEXT,
              total_duration REAL DEFAULT 0,
              valid_play_count INTEGER DEFAULT 0,
              PRIMARY KEY (date_key, song_id)
            );

            -- 3. BẢNG ALL-TIME: Tổng hợp lũy kế toàn bộ thời gian
            CREATE TABLE IF NOT EXISTS song_analytics_all (
              song_id TEXT PRIMARY KEY,
              song_title TEXT NOT NULL,
              artist_name TEXT NOT NULL,
              album_art TEXT,
              total_duration REAL DEFAULT 0,
              valid_play_count INTEGER DEFAULT 0,
              last_played_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS saved_tracks (
              id TEXT PRIMARY KEY,
              file_path TEXT UNIQUE NOT NULL,
              title TEXT NOT NULL,
              artist TEXT NOT NULL,
              album TEXT NOT NULL,
              genre TEXT DEFAULT '',
              year INTEGER,
              duration REAL NOT NULL,
              bpm INTEGER DEFAULT 0,
              picture TEXT,
              has_lyric INTEGER NOT NULL,
              lrc_path TEXT,
              has_mv INTEGER NOT NULL,
              mv_path TEXT
            );

            -- 4. BẢNG TRACK TRANSITIONS (Markov Chain Habit Tracking)
            CREATE TABLE IF NOT EXISTS track_transitions (
              from_song_id TEXT NOT NULL,
              to_song_id TEXT NOT NULL,
              transition_count INTEGER DEFAULT 1,
              last_transition_at INTEGER,
              PRIMARY KEY (from_song_id, to_song_id)
            );

            CREATE TABLE IF NOT EXISTS playlists (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT,
              cover_art TEXT,
              created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS playlist_songs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              playlist_id TEXT NOT NULL,
              track_id TEXT NOT NULL,
              position INTEGER NOT NULL,
              FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS top_charts_cache (
              range TEXT PRIMARY KEY,
              stats_json TEXT NOT NULL,
              updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS telemetry_play_session (
              singleton INTEGER PRIMARY KEY,
              track_id TEXT NOT NULL,
              last_timestamp INTEGER NOT NULL,
              accumulated_seconds REAL NOT NULL,
              counted_valid_play INTEGER NOT NULL
            );

            -- INDEXES TỐI ƯU TRUY VẤN
            CREATE INDEX IF NOT EXISTS idx_play_history_covering 
            ON play_history (played_at, song_id, is_valid_play, duration_listened);

            CREATE INDEX IF NOT EXISTS idx_play_history_song_id 
            ON play_history (song_id);

            CREATE INDEX IF NOT EXISTS idx_song_analytics_duration 
            ON song_analytics_all (total_duration DESC, valid_play_count DESC, song_id);

            CREATE INDEX IF NOT EXISTS idx_song_analytics_rank 
            ON song_analytics_all (valid_play_count DESC, total_duration DESC, song_id);

            CREATE INDEX IF NOT EXISTS idx_song_analytics_last_played 
            ON song_analytics_all (last_played_at DESC);

            CREATE INDEX IF NOT EXISTS idx_song_analytics_artist 
            ON song_analytics_all (artist_name, valid_play_count, total_duration);

            CREATE INDEX IF NOT EXISTS idx_daily_song_rank 
            ON daily_song_analytics (date_key DESC, valid_play_count DESC, total_duration DESC);

            CREATE INDEX IF NOT EXISTS idx_daily_artist_agg 
            ON daily_song_analytics (date_key, artist_name, valid_play_count, total_duration);

            CREATE INDEX IF NOT EXISTS idx_playlist_songs_pid ON playlist_songs(playlist_id);
            CREATE INDEX IF NOT EXISTS idx_playlist_songs_tid ON playlist_songs(track_id);
            CREATE INDEX IF NOT EXISTS idx_saved_tracks_artist ON saved_tracks(artist);
            CREATE INDEX IF NOT EXISTS idx_saved_tracks_album ON saved_tracks(album);
            CREATE INDEX IF NOT EXISTS idx_saved_tracks_album_artist ON saved_tracks(album, artist);
            CREATE INDEX IF NOT EXISTS idx_track_transitions_from ON track_transitions(from_song_id);

            PRAGMA user_version = 2;
            ",
        )?;

        // Migration an toàn cho các DB đã tồn tại từ trước
        let _ = conn.execute("ALTER TABLE saved_tracks ADD COLUMN genre TEXT DEFAULT '';", []);
        let _ = conn.execute("ALTER TABLE saved_tracks ADD COLUMN bpm INTEGER DEFAULT 0;", []);
        let _ = conn.execute("ALTER TABLE saved_tracks ADD COLUMN has_mv INTEGER DEFAULT 0;", []);
        let _ = conn.execute("ALTER TABLE saved_tracks ADD COLUMN mv_path TEXT;", []);
        let _ = conn.execute("ALTER TABLE saved_tracks ADD COLUMN has_lyric INTEGER DEFAULT 0;", []);
        let _ = conn.execute("ALTER TABLE saved_tracks ADD COLUMN lrc_path TEXT;", []);
    }

    Ok(conn)
}

pub fn run_background_backfill(conn: &Connection) {
    let _ = conn.execute(
        "INSERT OR IGNORE INTO song_analytics_all (song_id, song_title, artist_name, album_art, total_duration, valid_play_count, last_played_at)
        SELECT 
          song_id,
          song_title,
          artist_name,
          album_art,
          COALESCE(SUM(duration_listened), 0),
          COALESCE(SUM(CASE WHEN is_valid_play = 1 THEN 1 ELSE 0 END), 0),
          COALESCE(MAX(CASE WHEN typeof(played_at) = 'integer' THEN played_at ELSE CAST(strftime('%s', played_at) AS INTEGER) END), 0)
        FROM play_history
        WHERE song_id NOT IN (SELECT song_id FROM song_analytics_all)
        GROUP BY song_id",
        [],
    );
}

pub fn get_all_tracks(conn: &Connection, limit: Option<usize>, offset: Option<usize>) -> Result<Vec<Track>> {
    let sql = match (limit, offset) {
        (Some(l), Some(o)) => format!(
            "SELECT id, file_path, title, artist, album, genre, year, duration, bpm, picture, has_lyric, lrc_path, has_mv, mv_path FROM saved_tracks ORDER BY rowid LIMIT {} OFFSET {}",
            l, o
        ),
        (Some(l), None) => format!(
            "SELECT id, file_path, title, artist, album, genre, year, duration, bpm, picture, has_lyric, lrc_path, has_mv, mv_path FROM saved_tracks ORDER BY rowid LIMIT {}",
            l
        ),
        _ => "SELECT id, file_path, title, artist, album, genre, year, duration, bpm, picture, has_lyric, lrc_path, has_mv, mv_path FROM saved_tracks".to_string(),
    };

    let mut stmt = conn.prepare(&sql)?;

    let track_iter = stmt.query_map([], |row| {
        let has_lyric_num: i32 = row.get(10)?;
        let has_mv_num: i32 = row.get(12)?;
        Ok(Track {
            id: row.get(0)?,
            file_path: row.get(1)?,
            title: row.get(2)?,
            artist: row.get(3)?,
            album: row.get(4)?,
            genre: row.get(5)?,
            year: row.get(6)?,
            duration: row.get(7)?,
            bpm: row.get(8)?,
            picture: row.get(9)?,
            has_lyric: has_lyric_num != 0,
            lrc_path: row.get(11)?,
            has_mv: has_mv_num != 0,
            mv_path: row.get(13)?,
        })
    })?;

    let mut tracks = Vec::new();
    for track in track_iter {
        tracks.push(track?);
    }
    Ok(tracks)
}

pub fn get_track_by_id(conn: &Connection, id: &str) -> Result<Option<Track>> {
    let mut stmt = conn.prepare(
        "SELECT id, file_path, title, artist, album, genre, year, duration, bpm, picture, has_lyric, lrc_path, has_mv, mv_path 
         FROM saved_tracks WHERE id = ?1 LIMIT 1"
    )?;

    let mut rows = stmt.query_map([id], |row| {
        let has_lyric_num: i32 = row.get(10)?;
        let has_mv_num: i32 = row.get(12)?;
        Ok(Track {
            id: row.get(0)?,
            file_path: row.get(1)?,
            title: row.get(2)?,
            artist: row.get(3)?,
            album: row.get(4)?,
            genre: row.get(5)?,
            year: row.get(6)?,
            duration: row.get(7)?,
            bpm: row.get(8)?,
            picture: row.get(9)?,
            has_lyric: has_lyric_num != 0,
            lrc_path: row.get(11)?,
            has_mv: has_mv_num != 0,
            mv_path: row.get(13)?,
        })
    })?;

    if let Some(track) = rows.next() {
        Ok(Some(track?))
    } else {
        Ok(None)
    }
}

pub fn get_random_artists(conn: &Connection, limit: usize) -> Result<Vec<String>> {
    let lim = limit.clamp(1, 10) as i64;
    let sql = "
        WITH artist_stats AS (
            SELECT 
                st.artist AS artist_name,
                COUNT(st.id) AS track_count,
                COALESCE(SUM(sa.valid_play_count), 0) AS total_valid_plays,
                COALESCE(SUM(sa.total_duration), 0.0) AS total_duration
            FROM saved_tracks st
            LEFT JOIN song_analytics_all sa ON sa.song_id = st.id
            WHERE st.artist != '' 
              AND st.artist NOT IN ('Nghệ sĩ chưa biết', 'Unknown Artist', 'Various Artists')
            GROUP BY st.artist
        ),
        weighted_artists AS (
            SELECT 
                artist_name,
                (
                    0.45 * (1.0 + total_valid_plays) 
                    + 0.35 * (1.0 + (total_duration / 60.0))
                    + 0.20 * CAST(track_count AS REAL)
                    + 0.25
                ) AS weight,
                ((ABS(RANDOM()) % 1000000) + 1.0) / 1000001.0 AS u
            FROM artist_stats
        )
        SELECT artist_name
        FROM weighted_artists
        ORDER BY (-((u + 0.0001)) / weight) ASC
        LIMIT ?1;
    ";

    let mut stmt = conn.prepare(sql)?;
    let artist_iter = stmt.query_map(params![lim], |row| {
        row.get::<_, String>(0)
    })?;

    let mut result = Vec::new();
    for a in artist_iter.flatten() {
        if !a.trim().is_empty() {
            result.push(a);
        }
    }

    if result.is_empty() {
        let fallback_sql = "
            SELECT DISTINCT artist 
            FROM saved_tracks 
            WHERE artist != '' AND artist != 'Unknown Artist'
            ORDER BY RANDOM() 
            LIMIT ?1;
        ";
        let mut fb_stmt = conn.prepare(fallback_sql)?;
        let fb_iter = fb_stmt.query_map(params![lim], |row| row.get::<_, String>(0))?;
        for a in fb_iter.flatten() {
            if !a.trim().is_empty() {
                result.push(a);
            }
        }
    }

    Ok(result)
}

pub fn save_tracks(conn: &mut Connection, tracks: &[Track]) -> Result<()> {
    let tx = conn.transaction()?;
    {
        let mut stmt = tx.prepare(
            "INSERT INTO saved_tracks (id, file_path, title, artist, album, genre, year, duration, bpm, picture, has_lyric, lrc_path, has_mv, mv_path)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
             ON CONFLICT(file_path) DO UPDATE SET
               title=excluded.title,
               artist=excluded.artist,
               album=excluded.album,
               genre=excluded.genre,
               year=excluded.year,
               duration=excluded.duration,
               bpm=excluded.bpm,
               picture=excluded.picture,
               has_lyric=excluded.has_lyric,
               lrc_path=excluded.lrc_path,
               has_mv=excluded.has_mv,
               mv_path=excluded.mv_path"
        )?;

        for t in tracks {
            stmt.execute(params![
                t.id,
                t.file_path,
                t.title,
                t.artist,
                t.album,
                t.genre.as_deref().unwrap_or(""),
                t.year,
                t.duration,
                t.bpm.unwrap_or(0),
                t.picture,
                if t.has_lyric { 1 } else { 0 },
                t.lrc_path,
                if t.has_mv { 1 } else { 0 },
                t.mv_path,
            ])?;
        }
    }
    tx.commit()?;
    Ok(())
}

pub fn log_play_record(conn: &Connection, input: &PlayRecordInput) -> Result<()> {
    let now_ts = chrono::Utc::now().timestamp();
    let date_key: i32 = chrono::Utc::now().format("%Y%m%d").to_string().parse().unwrap_or(0);
    let is_valid_num = if input.is_valid_play { 1 } else { 0 };

    conn.execute_batch("BEGIN TRANSACTION;")?;

    // 1. Ghi Raw Log
    let insert_raw_res = conn.execute(
        "INSERT INTO play_history (song_id, song_title, artist_name, album_art, played_at, duration_listened, is_valid_play)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            input.song_id,
            input.song_title,
            input.artist_name,
            input.album_art,
            now_ts,
            input.duration_listened,
            is_valid_num,
        ],
    );
    if let Err(e) = insert_raw_res {
        let _ = conn.execute_batch("ROLLBACK;");
        return Err(e);
    }

    // 2. Tự động cộng dồn Daily Bucket Cache (Increment & Upsert)
    let upsert_daily_res = conn.execute(
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
            input.song_id,
            input.song_title,
            input.artist_name,
            input.album_art,
            input.duration_listened,
            is_valid_num,
        ],
    );
    if let Err(e) = upsert_daily_res {
        let _ = conn.execute_batch("ROLLBACK;");
        return Err(e);
    }

    // 3. Tự động cộng dồn All-Time Aggregate Cache (Increment & Upsert)
    let upsert_all_res = conn.execute(
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
            input.song_id,
            input.song_title,
            input.artist_name,
            input.album_art,
            input.duration_listened,
            is_valid_num,
            now_ts,
        ],
    );
    if let Err(e) = upsert_all_res {
        let _ = conn.execute_batch("ROLLBACK;");
        return Err(e);
    }

    let _ = conn.execute("DELETE FROM top_charts_cache", []);
    conn.execute_batch("COMMIT;")?;
    Ok(())
}

pub fn record_telemetry_heartbeat(conn: &Connection, payload: &TelemetryPayload) -> Result<()> {
    if payload.track_id.trim().is_empty()
        || !payload.delta_seconds.is_finite()
        || payload.delta_seconds <= 0.0
        || !payload.playback_speed.is_finite()
        || payload.playback_speed <= 0.0
        || payload.timestamp <= 0
    {
        return Ok(());
    }

    // A heartbeat is normally <= 5 seconds. Cap pathological client input while
    // still allowing a delayed flush after a briefly suspended renderer.
    let delta_seconds = payload.delta_seconds.min(60.0);
    let timestamp_seconds = payload.timestamp / 1_000;
    let played_at = timestamp_seconds;

    let mut stmt = conn.prepare(
        "SELECT title, artist, picture, duration FROM saved_tracks WHERE id = ?1 LIMIT 1",
    )?;
    let track = stmt.query_row([&payload.track_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, f64>(3)?,
        ))
    });

    if let Ok((title, artist, picture, duration)) = track {
        // Heartbeats are sent every five seconds. A longer gap means the prior
        // listening session ended (pause, app suspension, or a track switch).
        let previous_session = conn.query_row(
            "SELECT track_id, last_timestamp, accumulated_seconds, counted_valid_play
             FROM telemetry_play_session WHERE singleton = 1",
            [],
            |row| Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, i64>(3)?,
            )),
        );

        let (previous_total, already_counted) = match previous_session {
            Ok((previous_track_id, last_timestamp, total, counted))
                if previous_track_id == payload.track_id
                    && payload.timestamp >= last_timestamp
                    && payload.timestamp - last_timestamp <= 15_000 => (total, counted != 0),
            _ => (0.0, false),
        };

        let session_total = previous_total + delta_seconds;
        // A listen is valid after 30 seconds, or after half of a shorter track.
        let valid_threshold = if duration > 0.0 {
            30.0_f64.min(duration * 0.5)
        } else {
            30.0
        };
        let is_valid_play = !already_counted && session_total >= valid_threshold;

        conn.execute(
            "INSERT INTO play_history (song_id, song_title, artist_name, album_art, played_at, duration_listened, is_valid_play)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                payload.track_id,
                title,
                artist,
                picture,
                played_at,
                delta_seconds,
                if is_valid_play { 1 } else { 0 },
            ],
        )?;

        conn.execute(
            "INSERT INTO telemetry_play_session (singleton, track_id, last_timestamp, accumulated_seconds, counted_valid_play)
             VALUES (1, ?1, ?2, ?3, ?4)
             ON CONFLICT(singleton) DO UPDATE SET
               track_id = excluded.track_id,
               last_timestamp = excluded.last_timestamp,
               accumulated_seconds = excluded.accumulated_seconds,
               counted_valid_play = excluded.counted_valid_play",
            params![
                payload.track_id,
                payload.timestamp,
                session_total,
                if already_counted || is_valid_play { 1 } else { 0 },
            ],
        )?;
        let _ = conn.execute("DELETE FROM top_charts_cache", []);
    }
    Ok(())
}

pub fn get_analytics_stats(conn: &Connection, range: &str) -> Result<AnalyticsStats> {
    let now_ts = chrono::Utc::now().timestamp();
    // Check top_charts_cache for cached stats (valid for 60 seconds)
    if let Ok((stats_json, updated_at)) = conn.query_row(
        "SELECT stats_json, updated_at FROM top_charts_cache WHERE range = ?1",
        params![range],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)),
    ) {
        if now_ts - updated_at < 60 {
            if let Ok(cached_stats) = serde_json::from_str::<AnalyticsStats>(&stats_json) {
                return Ok(cached_stats);
            }
        }
    }

    let overview_query;
    let top_songs_query;
    let top_artists_query;

    match range {
        "all" => {
            overview_query = "SELECT 
               COALESCE(SUM(total_duration), 0) AS totalDurationSeconds,
               COALESCE(SUM(valid_play_count), 0) AS totalValidPlays,
               COUNT(DISTINCT song_id) AS totalUniqueSongs
             FROM song_analytics_all".to_string();

            top_songs_query = "SELECT 
               song_id AS songId,
               song_title AS title,
               artist_name AS artist,
               album_art AS picture,
               valid_play_count AS playCount,
               total_duration AS totalDuration
             FROM song_analytics_all
             WHERE valid_play_count > 0 OR total_duration > 0
             ORDER BY valid_play_count DESC, total_duration DESC
             LIMIT 20".to_string();

            top_artists_query = "SELECT 
               artist_name AS artist,
               SUM(valid_play_count) AS playCount,
               SUM(total_duration) AS totalDuration
             FROM song_analytics_all
             GROUP BY artist_name
             HAVING playCount > 0 OR totalDuration > 0
             ORDER BY playCount DESC, totalDuration DESC
             LIMIT 20".to_string();
        }
        "today" | "week" | "month" => {
            let days_offset = match range {
                "today" => 0,
                "week" => -7,
                "month" => -30,
                _ => 0,
            };

            overview_query = format!(
                "SELECT 
                   COALESCE(SUM(total_duration), 0) AS totalDurationSeconds,
                   COALESCE(SUM(valid_play_count), 0) AS totalValidPlays,
                   COUNT(DISTINCT song_id) AS totalUniqueSongs
                 FROM daily_song_analytics
                 WHERE date_key >= CAST(strftime('%Y%m%d', 'now', '{} days', 'localtime') AS INTEGER)",
                days_offset
            );

            top_songs_query = format!(
                "SELECT 
                   song_id AS songId,
                   song_title AS title,
                   artist_name AS artist,
                   album_art AS picture,
                   SUM(valid_play_count) AS playCount,
                   SUM(total_duration) AS totalDuration
                 FROM daily_song_analytics
                 WHERE date_key >= CAST(strftime('%Y%m%d', 'now', '{} days', 'localtime') AS INTEGER)
                 GROUP BY song_id
                 HAVING playCount > 0 OR totalDuration > 0
                 ORDER BY playCount DESC, totalDuration DESC
                 LIMIT 20",
                days_offset
            );

            top_artists_query = format!(
                "SELECT 
                   artist_name AS artist,
                   SUM(valid_play_count) AS playCount,
                   SUM(total_duration) AS totalDuration
                 FROM daily_song_analytics
                 WHERE date_key >= CAST(strftime('%Y%m%d', 'now', '{} days', 'localtime') AS INTEGER)
                 GROUP BY artist_name
                 HAVING playCount > 0 OR totalDuration > 0
                 ORDER BY playCount DESC, totalDuration DESC
                 LIMIT 20",
                days_offset
            );
        }
        "1h" => {
            overview_query = "SELECT 
               COALESCE(SUM(duration_listened), 0) AS totalDurationSeconds,
               COALESCE(SUM(CASE WHEN is_valid_play = 1 THEN 1 ELSE 0 END), 0) AS totalValidPlays,
               COUNT(DISTINCT song_id) AS totalUniqueSongs
             FROM play_history
             WHERE played_at >= unixepoch('now', '-1 hour')".to_string();

            top_songs_query = "SELECT 
               song_id AS songId,
               song_title AS title,
               artist_name AS artist,
               album_art AS picture,
               SUM(CASE WHEN is_valid_play = 1 THEN 1 ELSE 0 END) AS playCount,
               SUM(duration_listened) AS totalDuration
             FROM play_history
             WHERE played_at >= unixepoch('now', '-1 hour')
             GROUP BY song_id
             HAVING playCount > 0 OR totalDuration > 0
             ORDER BY playCount DESC, totalDuration DESC
             LIMIT 20".to_string();

            top_artists_query = "SELECT 
               artist_name AS artist,
               SUM(CASE WHEN is_valid_play = 1 THEN 1 ELSE 0 END) AS playCount,
               SUM(duration_listened) AS totalDuration
             FROM play_history
             WHERE played_at >= unixepoch('now', '-1 hour')
             GROUP BY artist_name
             HAVING playCount > 0 OR totalDuration > 0
             ORDER BY playCount DESC, totalDuration DESC
             LIMIT 20".to_string();
        }
        _ => {
            overview_query = "SELECT 
               COALESCE(SUM(total_duration), 0) AS totalDurationSeconds,
               COALESCE(SUM(valid_play_count), 0) AS totalValidPlays,
               COUNT(DISTINCT song_id) AS totalUniqueSongs
             FROM song_analytics_all".to_string();

            top_songs_query = "SELECT 
               song_id AS songId,
               song_title AS title,
               artist_name AS artist,
               album_art AS picture,
               valid_play_count AS playCount,
               total_duration AS totalDuration
             FROM song_analytics_all
             WHERE valid_play_count > 0 OR total_duration > 0
             ORDER BY valid_play_count DESC, total_duration DESC
             LIMIT 20".to_string();

            top_artists_query = "SELECT 
               artist_name AS artist,
               SUM(valid_play_count) AS playCount,
               SUM(total_duration) AS totalDuration
             FROM song_analytics_all
             GROUP BY artist_name
             HAVING playCount > 0 OR totalDuration > 0
             ORDER BY playCount DESC, totalDuration DESC
             LIMIT 20".to_string();
        }
    }

    let overview = conn.query_row(&overview_query, [], |row| {
        Ok(AnalyticsOverview {
            total_duration_seconds: row.get(0)?,
            total_valid_plays: row.get(1)?,
            total_unique_songs: row.get(2)?,
        })
    })?;

    let mut stmt = conn.prepare(&top_songs_query)?;
    let top_songs_iter = stmt.query_map([], |row| {
        Ok(TopSongStats {
            song_id: row.get(0)?,
            title: row.get(1)?,
            artist: row.get(2)?,
            picture: row.get(3)?,
            play_count: row.get(4)?,
            total_duration: row.get(5)?,
        })
    })?;
    let top_songs = top_songs_iter.filter_map(Result::ok).collect();

    let mut stmt = conn.prepare(&top_artists_query)?;
    let top_artists_iter = stmt.query_map([], |row| {
        Ok(TopArtistStats {
            artist: row.get(0)?,
            play_count: row.get(1)?,
            total_duration: row.get(2)?,
        })
    })?;
    let top_artists = top_artists_iter.filter_map(Result::ok).collect();

    let stats = AnalyticsStats {
        overview,
        top_songs,
        top_artists,
    };

    if let Ok(json_str) = serde_json::to_string(&stats) {
        let _ = conn.execute(
            "INSERT INTO top_charts_cache (range, stats_json, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(range) DO UPDATE SET
               stats_json = excluded.stats_json,
               updated_at = excluded.updated_at",
            params![range, json_str, now_ts],
        );
    }

    Ok(stats)
}

pub fn get_top_listened_tracks(conn: &Connection, limit: usize) -> Result<Vec<TopListenedTrack>> {
    let mut stmt = conn.prepare(
        "SELECT song_id, total_duration, valid_play_count
         FROM song_analytics_all
         WHERE valid_play_count > 0 OR total_duration > 0
         ORDER BY total_duration DESC, valid_play_count DESC
         LIMIT ?1",
    )?;

    let iter = stmt.query_map([limit.min(100) as i64], |row| {
        Ok(TopListenedTrack {
            song_id: row.get(0)?,
            total_duration: row.get(1)?,
            play_count: row.get(2)?,
        })
    })?;

    let mut list = Vec::new();
    for item in iter {
        list.push(item?);
    }
    Ok(list)
}

pub fn get_recently_played(conn: &Connection, limit: usize) -> Result<Vec<String>> {
    // Tối ưu: Lấy trực tiếp từ song_analytics_all qua index last_played_at DESC mà không cần quét toàn bộ play_history
    let mut stmt = conn.prepare(
        "SELECT song_id
         FROM song_analytics_all
         WHERE last_played_at > 0
         ORDER BY last_played_at DESC
         LIMIT ?1",
    )?;
    let ids = stmt
        .query_map([limit.min(50) as i64], |row| row.get::<_, String>(0))?
        .filter_map(Result::ok)
        .collect();
    Ok(ids)
}

pub fn get_playlists(conn: &Connection) -> Result<Vec<Playlist>> {
    let mut stmt_p = conn.prepare("SELECT id, name, description, cover_art, created_at FROM playlists ORDER BY created_at DESC")?;
    let playlist_rows = stmt_p.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, i64>(4)?,
        ))
    })?;

    let mut stmt_s = conn.prepare("SELECT playlist_id, track_id FROM playlist_songs ORDER BY position ASC")?;
    let song_rows = stmt_s.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;

    use std::collections::HashMap;
    let mut song_map: HashMap<String, Vec<String>> = HashMap::new();
    for item in song_rows {
        if let Ok((pid, tid)) = item {
            song_map.entry(pid).or_default().push(tid);
        }
    }

    let mut playlists = Vec::new();
    for p in playlist_rows {
        if let Ok((id, name, description, cover_art, created_at)) = p {
            let track_ids = song_map.get(&id).cloned().unwrap_or_default();
            playlists.push(Playlist {
                id,
                name,
                description,
                cover_art,
                created_at,
                track_ids,
            });
        }
    }
    Ok(playlists)
}

pub fn create_playlist(
    conn: &Connection,
    name: &str,
    description: Option<&str>,
    cover_art: Option<&str>,
) -> Result<Playlist> {
    let id = format!("pl_{}_{}", chrono::Utc::now().timestamp_millis(), rand_suffix());
    let created_at = chrono::Utc::now().timestamp_millis();

    conn.execute(
        "INSERT INTO playlists (id, name, description, cover_art, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, name, description.unwrap_or(""), cover_art, created_at],
    )?;

    Ok(Playlist {
        id,
        name: name.to_string(),
        description: description.map(|s| s.to_string()),
        cover_art: cover_art.map(|s| s.to_string()),
        created_at,
        track_ids: vec![],
    })
}

fn rand_suffix() -> String {
    use std::time::SystemTime;
    let nanos = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .subsec_nanos();
    format!("{:x}", nanos % 0xfffff)
}

pub fn add_track_to_playlist(conn: &Connection, playlist_id: &str, track_id: &str) -> Result<()> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = ?1",
        params![playlist_id],
        |r| r.get(0),
    ).unwrap_or(0);

    conn.execute(
        "INSERT INTO playlist_songs (playlist_id, track_id, position) VALUES (?1, ?2, ?3)",
        params![playlist_id, track_id, count + 1],
    )?;
    Ok(())
}

pub fn remove_track_from_playlist(conn: &Connection, playlist_id: &str, track_id: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM playlist_songs WHERE playlist_id = ?1 AND track_id = ?2",
        params![playlist_id, track_id],
    )?;
    Ok(())
}

pub fn delete_playlist(conn: &Connection, playlist_id: &str) -> Result<()> {
    conn.execute("DELETE FROM playlist_songs WHERE playlist_id = ?1", params![playlist_id])?;
    conn.execute("DELETE FROM playlists WHERE id = ?1", params![playlist_id])?;
    Ok(())
}

pub fn rename_playlist(conn: &Connection, playlist_id: &str, new_name: &str) -> Result<()> {
    conn.execute(
        "UPDATE playlists SET name = ?1 WHERE id = ?2",
        params![new_name, playlist_id],
    )?;
    Ok(())
}

pub fn merge_album(
    conn: &Connection,
    source_album_name: &str,
    source_artist: &str,
    target_album_name: &str,
    target_artist: &str,
) -> Result<()> {
    if source_artist.is_empty() || source_artist == "Nghệ sĩ chưa biết" || source_artist == target_artist {
        conn.execute(
            "UPDATE saved_tracks SET album = ?1, artist = ?2 WHERE album = ?3",
            params![target_album_name, target_artist, source_album_name],
        )?;
    } else {
        conn.execute(
            "UPDATE saved_tracks SET album = ?1, artist = ?2 WHERE album = ?3 AND artist = ?4",
            params![target_album_name, target_artist, source_album_name, source_artist],
        )?;
    }
    Ok(())
}

pub fn update_track_metadata_db(
    conn: &Connection,
    track_id: &str,
    title: Option<&str>,
    artist: Option<&str>,
    album: Option<&str>,
    year: Option<i32>,
    picture: Option<&str>,
    file_path: Option<&str>,
) -> Result<()> {
    let mut fields = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(t) = title {
        fields.push("title = ?");
        params_vec.push(Box::new(t.to_string()));
    }
    if let Some(a) = artist {
        fields.push("artist = ?");
        params_vec.push(Box::new(a.to_string()));
    }
    if let Some(al) = album {
        fields.push("album = ?");
        params_vec.push(Box::new(al.to_string()));
    }
    if let Some(y) = year {
        fields.push("year = ?");
        params_vec.push(Box::new(y));
    }
    if let Some(p) = picture {
        fields.push("picture = ?");
        params_vec.push(Box::new(p.to_string()));
    }
    if let Some(fp) = file_path {
        fields.push("file_path = ?");
        params_vec.push(Box::new(fp.to_string()));
    }

    if fields.is_empty() {
        return Ok(());
    }

    params_vec.push(Box::new(track_id.to_string()));
    let query = format!("UPDATE saved_tracks SET {} WHERE id = ?", fields.join(", "));
    
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();
    conn.execute(&query, params_refs.as_slice())?;
    Ok(())
}

pub fn delete_track_db(conn: &Connection, track_id: &str) -> Result<()> {
    conn.execute("DELETE FROM playlist_songs WHERE track_id = ?1", params![track_id])?;
    conn.execute("DELETE FROM saved_tracks WHERE id = ?1", params![track_id])?;
    Ok(())
}

pub fn update_track_mv_db(conn: &Connection, track_id: &str, mv_path: &str) -> Result<()> {
    conn.execute(
        "UPDATE saved_tracks SET has_mv = 1, mv_path = ?1 WHERE id = ?2",
        params![mv_path, track_id],
    )?;
    Ok(())
}

pub fn update_track_lrc_db(conn: &Connection, track_id: &str, lrc_path: &str) -> Result<()> {
    conn.execute(
        "UPDATE saved_tracks SET has_lyric = 1, lrc_path = ?1 WHERE id = ?2",
        params![lrc_path, track_id],
    )?;
    Ok(())
}

pub fn record_track_transition_db(conn: &Connection, from_id: &str, to_id: &str) -> Result<()> {
    if from_id.trim().is_empty() || to_id.trim().is_empty() || from_id == to_id {
        return Ok(());
    }
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT INTO track_transitions (from_song_id, to_song_id, transition_count, last_transition_at)
         VALUES (?1, ?2, 1, ?3)
         ON CONFLICT(from_song_id, to_song_id) DO UPDATE SET
           transition_count = transition_count + 1,
           last_transition_at = excluded.last_transition_at",
        params![from_id, to_id, now],
    )?;
    Ok(())
}

pub fn get_smart_recommendation_db(
    conn: &Connection,
    current_id: &str,
    artist: &str,
    genre: Option<&str>,
    year: Option<i32>,
    bpm: Option<i32>,
) -> Result<Option<Track>> {
    let genre_str = genre.unwrap_or("");
    let bpm_val = bpm.unwrap_or(0);

    let query = "
        SELECT 
          t.id, t.file_path, t.title, t.artist, t.album, t.genre, t.year, t.duration, t.bpm, t.picture, 
          t.has_lyric, t.lrc_path, t.has_mv, t.mv_path,
          (
            (COALESCE(tt.transition_count, 0) * 10)
            + (CASE WHEN t.artist = ?2 AND ?2 != '' THEN 30 ELSE 0 END)
            + (CASE WHEN t.genre = ?3 AND ?3 != '' THEN 20 ELSE 0 END)
            + (CASE WHEN ?4 IS NOT NULL AND t.year IS NOT NULL AND ABS(t.year - ?4) <= 2 THEN 10 ELSE 0 END)
            + (CASE WHEN ?5 > 0 AND t.bpm > 0 AND ABS(t.bpm - ?5) <= 5 THEN 15 ELSE 0 END)
            + (CASE WHEN COALESCE(sa.valid_play_count, 0) = 0 THEN 25 WHEN sa.valid_play_count < 5 THEN 10 ELSE 0 END)
            + (ABS(RANDOM()) % 5)
          ) AS score
        FROM saved_tracks t
        LEFT JOIN track_transitions tt ON tt.from_song_id = ?1 AND tt.to_song_id = t.id
        LEFT JOIN song_analytics_all sa ON sa.song_id = t.id
        WHERE t.id != ?1
          AND t.id NOT IN (
            SELECT song_id FROM (
              SELECT song_id FROM play_history ORDER BY id DESC LIMIT 50
            )
          )
        ORDER BY score DESC
        LIMIT 1
    ";

    let map_row = |row: &rusqlite::Row| -> rusqlite::Result<Track> {
        let has_lyric_num: i32 = row.get(10)?;
        let has_mv_num: i32 = row.get(12)?;
        Ok(Track {
            id: row.get(0)?,
            file_path: row.get(1)?,
            title: row.get(2)?,
            artist: row.get(3)?,
            album: row.get(4)?,
            genre: row.get(5)?,
            year: row.get(6)?,
            duration: row.get(7)?,
            bpm: row.get(8)?,
            picture: row.get(9)?,
            has_lyric: has_lyric_num != 0,
            lrc_path: row.get(11)?,
            has_mv: has_mv_num != 0,
            mv_path: row.get(13)?,
        })
    };

    let mut stmt = conn.prepare(query)?;
    let res = stmt.query_row(params![current_id, artist, genre_str, year, bpm_val], map_row);

    match res {
        Ok(track) => Ok(Some(track)),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            let fallback_query = "
                SELECT 
                  t.id, t.file_path, t.title, t.artist, t.album, t.genre, t.year, t.duration, t.bpm, t.picture, 
                  t.has_lyric, t.lrc_path, t.has_mv, t.mv_path,
                  (
                    (COALESCE(tt.transition_count, 0) * 10)
                    + (CASE WHEN t.artist = ?2 AND ?2 != '' THEN 30 ELSE 0 END)
                    + (CASE WHEN t.genre = ?3 AND ?3 != '' THEN 20 ELSE 0 END)
                    + (CASE WHEN ?4 IS NOT NULL AND t.year IS NOT NULL AND ABS(t.year - ?4) <= 2 THEN 10 ELSE 0 END)
                    + (CASE WHEN ?5 > 0 AND t.bpm > 0 AND ABS(t.bpm - ?5) <= 5 THEN 15 ELSE 0 END)
                    + (CASE WHEN COALESCE(sa.valid_play_count, 0) = 0 THEN 25 WHEN sa.valid_play_count < 5 THEN 10 ELSE 0 END)
                    + (ABS(RANDOM()) % 5)
                  ) AS score
                FROM saved_tracks t
                LEFT JOIN track_transitions tt ON tt.from_song_id = ?1 AND tt.to_song_id = t.id
                LEFT JOIN song_analytics_all sa ON sa.song_id = t.id
                WHERE t.id != ?1
                ORDER BY score DESC
                LIMIT 1
            ";
            let mut stmt_fb = conn.prepare(fallback_query)?;
            let fb_res = stmt_fb.query_row(params![current_id, artist, genre_str, year, bpm_val], map_row);
            match fb_res {
                Ok(t) => Ok(Some(t)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e),
            }
        }
        Err(e) => Err(e),
    }
}

pub fn get_smart_recommendations_batch_db(
    conn: &Connection,
    current_id: &str,
    artist: &str,
    genre: Option<&str>,
    year: Option<i32>,
    bpm: Option<i32>,
    limit: usize,
) -> Result<Vec<Track>> {
    let actual_limit = limit.max(1).min(14); // Khống chế nghiêm ngặt tối đa 14 bài
    let genre_str = genre.unwrap_or("");
    let bpm_val = bpm.unwrap_or(0);

    let query = "
        SELECT 
          t.id, t.file_path, t.title, t.artist, t.album, t.genre, t.year, t.duration, t.bpm, t.picture, 
          t.has_lyric, t.lrc_path, t.has_mv, t.mv_path,
          (
            (COALESCE(tt.transition_count, 0) * 12)
            + (CASE WHEN t.artist = ?2 AND ?2 != '' THEN 35 ELSE 0 END)
            + (CASE WHEN t.genre = ?3 AND ?3 != '' THEN 25 ELSE 0 END)
            + (CASE WHEN ?4 IS NOT NULL AND t.year IS NOT NULL AND ABS(t.year - ?4) <= 3 THEN 15 ELSE 0 END)
            + (CASE WHEN ?5 > 0 AND t.bpm > 0 AND ABS(t.bpm - ?5) <= 8 THEN 20 ELSE 0 END)
            + (CASE WHEN COALESCE(sa.valid_play_count, 0) = 0 THEN 25 WHEN sa.valid_play_count < 5 THEN 12 ELSE 0 END)
            + (ABS(RANDOM()) % 8)
          ) AS score
        FROM saved_tracks t
        LEFT JOIN track_transitions tt ON tt.from_song_id = ?1 AND tt.to_song_id = t.id
        LEFT JOIN song_analytics_all sa ON sa.song_id = t.id
        WHERE t.id != ?1
        ORDER BY score DESC
        LIMIT ?6
    ";

    let mut stmt = conn.prepare(query)?;
    let rows = stmt.query_map(params![current_id, artist, genre_str, year, bpm_val, actual_limit as i64], |row| {
        let has_lyric_num: i32 = row.get(10)?;
        let has_mv_num: i32 = row.get(12)?;
        Ok(Track {
            id: row.get(0)?,
            file_path: row.get(1)?,
            title: row.get(2)?,
            artist: row.get(3)?,
            album: row.get(4)?,
            genre: row.get(5)?,
            year: row.get(6)?,
            duration: row.get(7)?,
            bpm: row.get(8)?,
            picture: row.get(9)?,
            has_lyric: has_lyric_num != 0,
            lrc_path: row.get(11)?,
            has_mv: has_mv_num != 0,
            mv_path: row.get(13)?,
        })
    })?;

    let mut tracks = Vec::new();
    for r in rows {
        if let Ok(t) = r {
            tracks.push(t);
        }
    }

    // Nếu số lượng bài chưa đủ, lấy thêm các bài ngẫu nhiên từ thư viện cho đủ tối đa 14 bài
    if tracks.len() < actual_limit {
        let mut existing_ids: std::collections::HashSet<String> = tracks.iter().map(|t| t.id.clone()).collect();
        existing_ids.insert(current_id.to_string());

        let remaining = actual_limit - tracks.len();
        let fallback_query = "
            SELECT 
              id, file_path, title, artist, album, genre, year, duration, bpm, picture, 
              has_lyric, lrc_path, has_mv, mv_path
            FROM saved_tracks
            WHERE id != ?1
            ORDER BY RANDOM()
            LIMIT ?2
        ";
        if let Ok(mut stmt_fb) = conn.prepare(fallback_query) {
            if let Ok(fb_rows) = stmt_fb.query_map(params![current_id, (remaining + 5) as i64], |row| {
                let has_lyric_num: i32 = row.get(10)?;
                let has_mv_num: i32 = row.get(12)?;
                Ok(Track {
                    id: row.get(0)?,
                    file_path: row.get(1)?,
                    title: row.get(2)?,
                    artist: row.get(3)?,
                    album: row.get(4)?,
                    genre: row.get(5)?,
                    year: row.get(6)?,
                    duration: row.get(7)?,
                    bpm: row.get(8)?,
                    picture: row.get(9)?,
                    has_lyric: has_lyric_num != 0,
                    lrc_path: row.get(11)?,
                    has_mv: has_mv_num != 0,
                    mv_path: row.get(13)?,
                })
            }) {
                for r in fb_rows {
                    if let Ok(t) = r {
                        if !existing_ids.contains(&t.id) && tracks.len() < actual_limit {
                            existing_ids.insert(t.id.clone());
                            tracks.push(t);
                        }
                    }
                }
            }
        }
    }

    Ok(tracks)
}



