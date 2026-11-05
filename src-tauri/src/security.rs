//! Pure validation helpers. Kept free of Tauri/IO so they can be unit-tested.

use std::path::{Path, PathBuf};

const YOUTUBE_HOSTS: &[&str] = &[
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
];

/// Accepts only https/http URLs whose host is a YouTube domain.
/// Anything else (including values starting with `-`) is rejected so it can
/// never be interpreted as a yt-dlp option.
pub fn validate_media_url(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    let parsed = url::Url::parse(trimmed).map_err(|_| "URL không hợp lệ".to_string())?;
    if parsed.scheme() != "https" && parsed.scheme() != "http" {
        return Err("Chỉ chấp nhận URL http/https".to_string());
    }
    let host = parsed.host_str().unwrap_or("").to_ascii_lowercase();
    if !YOUTUBE_HOSTS.contains(&host.as_str()) {
        return Err("Chỉ chấp nhận liên kết YouTube".to_string());
    }
    Ok(parsed.to_string())
}

/// Only web links may be handed to the OS opener.
pub fn is_allowed_external_url(raw: &str) -> bool {
    match url::Url::parse(raw.trim()) {
        Ok(u) => (u.scheme() == "https" || u.scheme() == "http") && u.host_str().is_some(),
        Err(_) => false,
    }
}

/// Decide where a track should move when artist/album change.
/// The move is only allowed when the current layout is confirmed to be
/// `<base>/<old artist>/<old album>/<file>`; otherwise returns `None` and the
/// file is left where it is. Returns `Some(target_dir)` otherwise.
pub fn plan_move_target(
    current_file: &Path,
    old_artist_dir: &str,
    old_album_dir: &str,
    new_artist_dir: &str,
    new_album_dir: &str,
) -> Option<PathBuf> {
    let album_dir = current_file.parent()?;
    let artist_dir = album_dir.parent()?;
    let base = artist_dir.parent()?;

    let album_name = album_dir.file_name()?.to_string_lossy().to_string();
    let artist_name = artist_dir.file_name()?.to_string_lossy().to_string();
    if album_name != old_album_dir || artist_name != old_artist_dir {
        return None;
    }
    if base.parent().is_none() {
        // Never move files into a filesystem root.
        return None;
    }
    Some(base.join(new_artist_dir).join(new_album_dir))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_option_like_input() {
        assert!(validate_media_url("--exec=id").is_err());
        assert!(validate_media_url("-o /tmp/x").is_err());
    }

    #[test]
    fn rejects_non_youtube_hosts_and_schemes() {
        assert!(validate_media_url("file:///etc/passwd").is_err());
        assert!(validate_media_url("https://evil.example.com/v").is_err());
        assert!(validate_media_url("https://youtube.com.evil.io/watch?v=x").is_err());
    }

    #[test]
    fn accepts_youtube_urls() {
        assert!(validate_media_url("https://www.youtube.com/watch?v=abc").is_ok());
        assert!(validate_media_url("https://youtu.be/abc").is_ok());
        assert!(validate_media_url("  https://music.youtube.com/watch?v=abc  ").is_ok());
    }

    #[test]
    fn external_url_only_web() {
        assert!(is_allowed_external_url("https://github.com/x"));
        assert!(!is_allowed_external_url("file:///C:/Windows/system.ini"));
        assert!(!is_allowed_external_url("ms-cxh:localappsdata"));
        assert!(!is_allowed_external_url("javascript:alert(1)"));
    }

    #[test]
    fn move_only_when_layout_confirmed() {
        let p = Path::new("/music/Artist A/Album B/song.mp3");
        assert_eq!(
            plan_move_target(p, "Artist A", "Album B", "New", "NewAlbum"),
            Some(PathBuf::from("/music/New/NewAlbum"))
        );
        // Flat file directly in a folder: no move.
        let flat = Path::new("/D/song.mp3");
        assert_eq!(plan_move_target(flat, "Artist A", "Album B", "N", "A"), None);
        // Layout does not match the recorded names: no move.
        assert_eq!(plan_move_target(p, "Other", "Album B", "N", "A"), None);
    }
}
