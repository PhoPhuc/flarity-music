use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};
use base64::Engine;
use rusqlite::Connection;
use tauri::{AppHandle, Manager};

/**
 * Lấy hoặc tạo thư mục lưu trữ ảnh bìa cache trên đĩa cứng
 */
pub fn get_covers_dir(app: &AppHandle) -> PathBuf {
    let base_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let covers_dir = base_dir.join("covers");
    if !covers_dir.exists() {
        let _ = fs::create_dir_all(&covers_dir);
    }
    covers_dir
}

/**
 * Tính toán mã băm duy nhất FNV-1a 64-bit từ dữ liệu nhị phân của ảnh bìa (Deduplication bền vững)
 */
pub fn compute_cover_hash(bytes: &[u8]) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for &byte in bytes {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}_{}", hash, bytes.len())
}

/**
 * Ghi dữ liệu nhị phân của ảnh bìa ID3 ra file cache trên đĩa cứng và trả về đường dẫn file.
 * Nếu ảnh đã tồn tại (cùng một album), việc ghi file được bỏ qua (Zero Disk I/O thừa).
 */
pub fn save_cover_art_to_disk(
    app: &AppHandle,
    raw_bytes: &[u8],
    mime: Option<&str>,
) -> Result<String, String> {
    if raw_bytes.is_empty() {
        return Err("Dữ liệu ảnh rỗng".to_string());
    }

    let covers_dir = get_covers_dir(app);
    let ext = match mime {
        Some(m) if m.contains("png") => "png",
        Some(m) if m.contains("webp") => "webp",
        _ => "jpg",
    };

    let file_name = format!("{}.{}", compute_cover_hash(raw_bytes), ext);
    let file_path = covers_dir.join(file_name);

    // Nếu file ảnh cache đã tồn tại trên đĩa, tái sử dụng ngay lập tức
    if !file_path.exists() {
        fs::write(&file_path, raw_bytes)
            .map_err(|e| format!("Không thể ghi file ảnh cache: {}", e))?;
    }

    Ok(file_path.to_string_lossy().to_string())
}

/**
 * Migration ngầm: Tự động quét DB và chuyển đổi toàn bộ chuỗi Base64 cũ thành file cache trên đĩa
 * Giải phóng hàng trăm MB / GB trong database và RAM ngay khi khởi động.
 */
pub fn migrate_base64_covers_in_db(app: &AppHandle, conn: &Connection) {
    let covers_dir = get_covers_dir(app);
    println!(">>> [MEMORY OPTIMIZER] Checking Base64 covers migration in {}", covers_dir.display());

    // 1. Quét bảng saved_tracks
    let mut stmt = match conn.prepare("SELECT id, picture FROM saved_tracks WHERE picture LIKE 'data:image/%'") {
        Ok(s) => s,
        Err(_) => return,
    };

    let rows: Vec<(String, String)> = match stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?))
    }) {
        Ok(mapped) => mapped.filter_map(|r| r.ok()).collect(),
        Err(_) => Vec::new(),
    };

    if !rows.is_empty() {
        println!(">>> [MEMORY OPTIMIZER] Migrating {} legacy Base64 covers in saved_tracks...", rows.len());
        for (track_id, b64_str) in rows {
            if let Some(pos) = b64_str.find(";base64,") {
                let mime = &b64_str[5..pos];
                let data_part = &b64_str[pos + 8..];
                if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(data_part) {
                    if let Ok(file_path) = save_cover_art_to_disk(app, &bytes, Some(mime)) {
                        let _ = conn.execute(
                            "UPDATE saved_tracks SET picture = ?1 WHERE id = ?2",
                            rusqlite::params![file_path, track_id],
                        );
                    }
                }
            }
        }
        println!(">>> [MEMORY OPTIMIZER] Migration of saved_tracks completed!");
    }

    // 2. Quét dọn các bảng thống kê play_history và song_analytics
    let analytics_tables = ["play_history", "daily_song_analytics", "song_analytics_all"];
    for table in analytics_tables {
        let query = format!("SELECT rowid, album_art FROM {} WHERE album_art LIKE 'data:image/%'", table);
        if let Ok(mut stmt) = conn.prepare(&query) {
            let rows: Vec<(i64, String)> = stmt
                .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
                .map(|mapped| mapped.filter_map(|r| r.ok()).collect())
                .unwrap_or_default();

            for (row_id, b64_str) in rows {
                if let Some(pos) = b64_str.find(";base64,") {
                    let mime = &b64_str[5..pos];
                    let data_part = &b64_str[pos + 8..];
                    if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(data_part) {
                        if let Ok(file_path) = save_cover_art_to_disk(app, &bytes, Some(mime)) {
                            let update_query = format!("UPDATE {} SET album_art = ?1 WHERE rowid = ?2", table);
                            let _ = conn.execute(&update_query, rusqlite::params![file_path, row_id]);
                        }
                    }
                }
            }
        }
    }
}

/**
 * Tập tên file ảnh bìa đang được tham chiếu trong DB (tất cả bảng có cột ảnh).
 * Trả về Err nếu bất kỳ truy vấn nào thất bại: KHÔNG được coi lỗi là "không dùng".
 */
pub fn collect_used_cover_filenames(conn: &Connection) -> rusqlite::Result<HashSet<String>> {
    let mut used = HashSet::new();
    let mut stmt = conn.prepare(
        "SELECT picture FROM saved_tracks WHERE picture IS NOT NULL
         UNION SELECT cover_art FROM playlists WHERE cover_art IS NOT NULL
         UNION SELECT album_art FROM song_analytics_all WHERE album_art IS NOT NULL
         UNION SELECT album_art FROM daily_song_analytics WHERE album_art IS NOT NULL
         UNION SELECT album_art FROM play_history WHERE album_art IS NOT NULL",
    )?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    for r in rows {
        let path = r?;
        if let Some(fname) = Path::new(&path).file_name() {
            used.insert(fname.to_string_lossy().to_string());
        }
    }
    Ok(used)
}

/**
 * Xóa các file trong `covers_dir` không nằm trong `used` và cũ hơn grace period (15 phút).
 * `now` được truyền vào để kiểm thử.
 */
pub fn remove_orphans_in_dir(covers_dir: &Path, used: &HashSet<String>, now: SystemTime) -> usize {
    let grace_period = Duration::from_secs(900);
    let mut deleted_count = 0;
    let entries = match fs::read_dir(covers_dir) {
        Ok(e) => e,
        Err(_) => return 0,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let fname = entry.file_name().to_string_lossy().to_string();
        if used.contains(&fname) {
            continue;
        }
        if let Ok(modified) = entry.metadata().and_then(|m| m.modified()) {
            if now.duration_since(modified).map(|age| age < grace_period).unwrap_or(true) {
                continue;
            }
        }
        if fs::remove_file(&path).is_ok() {
            deleted_count += 1;
        }
    }
    deleted_count
}

/**
 * Dọn ảnh bìa mồ côi. An toàn: nếu không đọc được DB hoặc DB không có ảnh nào
 * thì không xóa gì cả.
 */
pub fn cleanup_orphan_covers(app: &AppHandle, conn: &Connection) -> rusqlite::Result<usize> {
    let used = collect_used_cover_filenames(conn)?;
    if used.is_empty() {
        return Ok(0);
    }
    Ok(remove_orphans_in_dir(&get_covers_dir(app), &used, SystemTime::now()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("flarity_test_{}_{}", name, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn query_failure_is_error_not_empty_set() {
        let conn = Connection::open_in_memory().unwrap();
        assert!(collect_used_cover_filenames(&conn).is_err());
    }

    #[test]
    fn removes_only_unused_old_covers() {
        let dir = temp_dir("orphans");
        fs::write(dir.join("used.jpg"), b"a").unwrap();
        fs::write(dir.join("orphan.jpg"), b"b").unwrap();
        let mut used = HashSet::new();
        used.insert("used.jpg".to_string());
        // Pretend it is an hour later so the grace period has passed.
        let later = SystemTime::now() + Duration::from_secs(3600);
        assert_eq!(remove_orphans_in_dir(&dir, &used, later), 1);
        assert!(dir.join("used.jpg").exists());
        assert!(!dir.join("orphan.jpg").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn collects_filenames_from_all_tables() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE saved_tracks (picture TEXT);
             CREATE TABLE playlists (cover_art TEXT);
             CREATE TABLE song_analytics_all (album_art TEXT);
             CREATE TABLE daily_song_analytics (album_art TEXT);
             CREATE TABLE play_history (album_art TEXT);
             INSERT INTO saved_tracks VALUES ('/x/a.jpg');
             INSERT INTO daily_song_analytics VALUES ('/x/d.png');
             INSERT INTO play_history VALUES ('/x/p.webp');",
        )
        .unwrap();
        let used = collect_used_cover_filenames(&conn).unwrap();
        assert!(used.contains("a.jpg") && used.contains("d.png") && used.contains("p.webp"));
    }
}
