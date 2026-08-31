use std::fs;
use std::path::PathBuf;
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
 * Dọn dẹp các tệp ảnh bìa mồ côi trên đĩa không còn bài hát nào tham chiếu đến
 */
pub fn cleanup_orphan_covers(app: &AppHandle, conn: &Connection) -> rusqlite::Result<usize> {
    let covers_dir = get_covers_dir(app);
    let mut used_filenames = std::collections::HashSet::new();

    // 1. Thu thập tất cả các tên file cover đang được sử dụng trong DB (Chuẩn hóa cross-platform)
    if let Ok(mut stmt) = conn.prepare(
        "SELECT picture FROM saved_tracks WHERE picture IS NOT NULL
         UNION
         SELECT cover_art FROM playlists WHERE cover_art IS NOT NULL
         UNION
         SELECT album_art FROM song_analytics_all WHERE album_art IS NOT NULL"
    ) {
        if let Ok(rows) = stmt.query_map([], |row| row.get::<_, String>(0)) {
            for r in rows.flatten() {
                if let Some(fname) = std::path::Path::new(&r).file_name() {
                    used_filenames.insert(fname.to_string_lossy().to_string());
                }
            }
        }
    }

    // 2. Quét thư mục và xóa các file mồ côi (có grace period 15 phút)
    let mut deleted_count = 0;
    let now = std::time::SystemTime::now();
    let grace_period = std::time::Duration::from_secs(900); // 15 phút an toàn

    if let Ok(entries) = fs::read_dir(covers_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let fname = entry.file_name().to_string_lossy().to_string();
                if !used_filenames.contains(&fname) {
                    // Kiểm tra thời gian sửa đổi: Bỏ qua file vừa được ghi gần đây
                    if let Ok(metadata) = entry.metadata() {
                        if let Ok(modified) = metadata.modified() {
                            if let Ok(age) = now.duration_since(modified) {
                                if age < grace_period {
                                    continue; // File mới tạo khi scan, giữ lại an toàn
                                }
                            }
                        }
                    }

                    if fs::remove_file(&path).is_ok() {
                        deleted_count += 1;
                    }
                }
            }
        }
    }

    Ok(deleted_count)
}

