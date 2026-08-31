// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    println!(">>> [STEP 1] Tauri Builder Starting");
    flarity_music_lib::run();
}
