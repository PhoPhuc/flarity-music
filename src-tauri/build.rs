fn main() {
    tauri_build::build();

    #[cfg(target_os = "windows")]
    {
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
        let resource_dll = std::path::Path::new(&manifest_dir).join("resources").join("WebView2Loader.dll");
        
        if resource_dll.exists() {
            if let Ok(out_dir) = std::env::var("OUT_DIR") {
                let out_path = std::path::PathBuf::from(&out_dir);
                let mut target_dir = out_path.clone();
                while target_dir.pop() {
                    if target_dir.file_name().map_or(false, |n| n == "release" || n == "debug") {
                        let dest = target_dir.join("WebView2Loader.dll");
                        let _ = std::fs::copy(&resource_dll, &dest);
                        break;
                    }
                }
            }
        }
    }
}
