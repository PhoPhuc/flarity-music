mod commands;
mod db;
mod telemetry;
mod covers;
mod security;

use commands::*;
use db::init_db;
use std::sync::{Arc, Mutex};
use tauri::Manager;
use telemetry::TelemetryEngine;

pub fn run() {
    println!(">>> [STEP 1] Tauri Builder Starting");

    // Đặt cấu hình WebView2 Chromium flags để giới hạn tối đa VRAM GPU và RAM thừa
    #[cfg(windows)]
    {
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--force-gpu-mem-available-mb=128 --disable-gpu-memory-buffer-video-frames --disable-background-networking --disable-component-update --disable-domain-reliability --process-per-site"
        );
    }

    let telemetry_engine = Arc::new(Mutex::new(TelemetryEngine::new()));

    let app = match tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup({
            let telemetry_engine = telemetry_engine.clone();
            move |app| {
                println!(">>> [STEP 2] Initializing DB");
                let (conn, db_persistent) = match init_db(app.handle()) {
                    Ok(c) => (c, true),
                    Err(e) => {
                        // Báo rõ lỗi; dùng DB tạm để app vẫn mở, nhưng KHÔNG dọn dẹp file ảnh
                        // (tập "đang dùng" trong DB tạm rỗng, dọn sẽ xóa nhầm toàn bộ ảnh).
                        eprintln!(">>> [DB ERROR] Không mở được DB: {:?}. Chạy bằng DB tạm, dữ liệu sẽ không được lưu.", e);
                        (rusqlite::Connection::open_in_memory()?, false)
                    }
                };
                println!(">>> [STEP 3] DB Initialized (persistent: {})", db_persistent);
                app.manage(DbStatus { persistent: db_persistent });

                let db_arc = Arc::new(Mutex::new(conn));
                app.manage(DbState(db_arc.clone()));
                app.manage(TelemetryState(telemetry_engine));

                let app_handle_for_migration = app.handle().clone();
                // BẮT BUỘC: Mở Connection riêng biệt cho background task và trì hoãn 4 giây để UI load tức thì 100%
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_secs(4)).await;
                    println!(">>> [ASYNC INIT] Starting DB backfill and covers migration in background thread");
                    if !db_persistent {
                        println!(">>> [ASYNC INIT] DB tạm: bỏ qua migration/dọn dẹp để không mất dữ liệu");
                        return;
                    }
                    if let Ok(bg_conn) = db::init_db(&app_handle_for_migration) {
                        covers::migrate_base64_covers_in_db(&app_handle_for_migration, &bg_conn);
                        let _ = covers::cleanup_orphan_covers(&app_handle_for_migration, &bg_conn);
                        db::run_background_backfill(&bg_conn);
                    }
                    println!(">>> [ASYNC INIT] DB Backfill and Migration Finished");
                });

                // Auto Memory Reclamation Engine: Định kỳ mỗi 60s dọn cache và trả RAM dư thừa về cho OS
                let app_handle_for_trim = app.handle().clone();
                let db_arc_for_trim = db_arc.clone();
                tauri::async_runtime::spawn(async move {
                    loop {
                        tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                        if let Ok(conn) = db_arc_for_trim.lock() {
                            let _ = conn.execute_batch("PRAGMA shrink_memory; PRAGMA wal_checkpoint(PASSIVE);");
                            if db_persistent {
                                let _ = covers::cleanup_orphan_covers(&app_handle_for_trim, &conn);
                            }
                        }
                        #[cfg(windows)]
                        unsafe {
                            extern "system" {
                                fn GetCurrentProcess() -> isize;
                                fn SetProcessWorkingSetSize(h_process: isize, min: usize, max: usize) -> i32;
                            }
                            let _ = SetProcessWorkingSetSize(GetCurrentProcess(), usize::MAX, usize::MAX);
                        }
                    }
                });

                Ok(())
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_saved_tracks,
            select_music_folder,
            select_mv_file,
            select_lrc_file,
            read_lrc_file,
            log_play_record,
            record_telemetry_heartbeat,
            telemetry_on_play,
            telemetry_on_pause,
            telemetry_on_track_change,
            telemetry_on_rate_change,
            telemetry_on_app_exit,
            telemetry_flush,
            get_analytics_stats,
            get_top_listened_tracks,
            get_recently_played,
            get_playlists,
            create_playlist,
            add_to_playlist,
            remove_from_playlist,
            delete_playlist,
            rename_playlist,
            attach_lrc_file,
            save_and_attach_lrc,
            attach_mv_file,
            merge_album,
            show_in_explorer,
            delete_track_file,
            update_track_metadata,
            scan_folder,
            record_track_transition,
            get_smart_recommendation,
            get_smart_recommendations_batch,
            check_downloader_tools,
            search_youtube_music,
            search_youtube_music_query,
            get_artist_discovery_recommendations,
            download_youtube_track,
            download_youtube_audio_track,
            get_random_library_artists,
            get_youtube_preview_stream_url,
            open_external_url,
            shrink_memory,
            get_db_status,
        ])
        .build(tauri::generate_context!()) {
            Ok(a) => a,
            Err(e) => {
                eprintln!(">>> [TAURI ERROR] Build failed: {:?}", e);
                return;
            }
        };

    println!(">>> [STEP 4] Tauri App Running");

    app.run(move |app_handle, event| {
        match event {
            tauri::RunEvent::ExitRequested { api, .. } => {
                // TRÊN ANDROID: ngăn Lifecycle tự đóng app khi chỉ là chuyển nền.
                // TRÊN DESKTOP: để app thoát thật sự khi đóng cửa sổ (không chạy ngầm).
                #[cfg(mobile)]
                api.prevent_exit();
                let _ = &api;

                if let (Some(db_state), Some(telemetry_state)) = (
                    app_handle.try_state::<DbState>(),
                    app_handle.try_state::<TelemetryState>(),
                ) {
                    let flush_payload = {
                        if let Ok(mut engine) = telemetry_state.0.lock() {
                            engine.extract_flush_payload()
                        } else {
                            None
                        }
                    };

                    if let Some(payload) = flush_payload {
                        if let Ok(mut conn) = db_state.0.lock() {
                            let _ = telemetry::write_telemetry_flush_to_db(&mut conn, payload);
                        }
                    }
                }
            }
            _ => {}
        }
    });
}
