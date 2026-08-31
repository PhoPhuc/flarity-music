import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Đọc metadata từ tauri.conf.json và package.json
const tauriConfigPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
const version = tauriConfig.version || '1.1.2';
const productName = tauriConfig.productName || 'Flarity Music';

console.log(`\n======================================================`);
console.log(`📦 BẮT ĐẦU ĐÓNG GÓI BẢN PHÂN PHỐI: ${productName} v${version}`);
console.log(`======================================================\n`);

// 2. Định vị thư mục release và các file thực thi
const targetCandidates = [
  path.join(rootDir, 'src-tauri', 'target', 'x86_64-pc-windows-gnu', 'release'),
  path.join(rootDir, 'src-tauri', 'target', 'release'),
];

let releaseDir = null;
for (const dir of targetCandidates) {
  if (fs.existsSync(path.join(dir, 'flarity-music.exe'))) {
    releaseDir = dir;
    break;
  }
}

if (!releaseDir) {
  console.error(`❌ Không tìm thấy flarity-music.exe trong thư mục target release.`);
  console.error(`Vui lòng chạy 'npm run tauri:build' trước khi đóng gói.`);
  process.exit(1);
}

const exeSource = path.join(releaseDir, 'flarity-music.exe');
let dllSource = path.join(releaseDir, 'WebView2Loader.dll');

// Nếu WebView2Loader.dll chưa có trong release, lấy từ resources backup
if (!fs.existsSync(dllSource)) {
  const backupDll = path.join(rootDir, 'src-tauri', 'resources', 'WebView2Loader.dll');
  if (fs.existsSync(backupDll)) {
    console.log(`ℹ️ Đang sao chép WebView2Loader.dll từ src-tauri/resources sang release dir...`);
    fs.copyFileSync(backupDll, dllSource);
  } else {
    console.warn(`⚠️ Cảnh báo: Không tìm thấy WebView2Loader.dll!`);
  }
}

// 3. Chuẩn bị thư mục release trong project
const distReleaseDir = path.join(rootDir, 'release');
if (!fs.existsSync(distReleaseDir)) {
  fs.mkdirSync(distReleaseDir, { recursive: true });
}

const portableFolderName = `Flarity-Music-${version}-portable-x64`;
const portableFolder = path.join(distReleaseDir, portableFolderName);

if (fs.existsSync(portableFolder)) {
  fs.rmSync(portableFolder, { recursive: true, force: true });
}
fs.mkdirSync(portableFolder, { recursive: true });

// 4. Sao chép flarity-music.exe và WebView2Loader.dll vào portable folder
console.log(`📋 Đang sao chép file thực thi và thư viện nạp WebView2Loader.dll...`);
fs.copyFileSync(exeSource, path.join(portableFolder, 'flarity-music.exe'));

if (fs.existsSync(dllSource)) {
  fs.copyFileSync(dllSource, path.join(portableFolder, 'WebView2Loader.dll'));
  console.log(`✅ Đã đính kèm WebView2Loader.dll (~${(fs.statSync(dllSource).size / 1024).toFixed(1)} KB)`);
}

// 5. Tạo file README.txt hướng dẫn sử dụng
const readmeContent = `================================================================================
FLARITY MUSIC - BẢN PORTABLE CHẠY NGAY (KHÔNG CẦN CÀI ĐẶT)
Phiên bản: v${version} (64-bit Windows)
================================================================================

1. HƯỚNG DẪN SỬ DỤNG:
   - Giải nén toàn bộ thư mục này ra bất kỳ đâu (Desktop, ổ D:, USB, v.v.).
   - Nhấp đúp chuột vào file "flarity-music.exe" để mở và thưởng thức âm nhạc.

2. LƯU Ý KỸ THUẬT QUAN TRỌNG:
   - Tệp "WebView2Loader.dll" là thư viện nạp giao diện cần thiết cho ứng dụng.
     BẮT BUỘC để tệp "WebView2Loader.dll" nằm cùng thư mục với "flarity-music.exe".
   - Ứng dụng tương thích tối ưu trên Windows 10 và Windows 11 (64-bit).

3. TÍNH NĂNG NỔI BẬT TRONG BẢN NÀY:
   - Dịch Lời Bài Hát (Song ngữ) đa nền tảng: Google Dịch, Gemini, OpenAI, OpenRouter, Claude, Custom API.
   - Giao diện Obsidian Dark Glassmorphism phong cách Apple Music cao cấp.
   - Sóng nhạc GPU 60/120 FPS không tốn CPU.
   - Giao diện Khám Phá & Gợi Ý dạng thẻ dọc 1:1 siêu nét.
   - Nhận diện gameshow Việt Nam (ATSH, ATVNCG, Rap Việt, Chị Đẹp...).
   - Tự động gộp cụm Album tương đồng >= 95%.
   - Lịch sử tải xuống lưu trữ vĩnh viễn kèm thời gian và dung lượng.

================================================================================
`;
fs.writeFileSync(path.join(portableFolder, 'README.txt'), readmeContent, 'utf8');

// 6. Nén thành file ZIP (.zip) bằng PowerShell
const zipFileName = `${portableFolderName}.zip`;
const zipFilePath = path.join(distReleaseDir, zipFileName);

if (fs.existsSync(zipFilePath)) {
  fs.unlinkSync(zipFilePath);
}

console.log(`🗜️ Đang nén thư mục portable thành file: ${zipFileName}...`);
try {
  const psScript = `Compress-Archive -Path '${portableFolder}\\*' -DestinationPath '${zipFilePath}' -Force`;
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
  console.log(`✅ Nén ZIP thành công! Kích thước: ${(fs.statSync(zipFilePath).size / (1024 * 1024)).toFixed(2)} MB`);
} catch (err) {
  console.error(`❌ Lỗi khi nén file zip:`, err.message);
}

// 7. Đồng bộ bản cài đặt NSIS (.exe) và MSI (.msi) vào thư mục release của project
const nsisSource = path.join(releaseDir, 'bundle', 'nsis', `Flarity Music_${version}_x64-setup.exe`);
const msiSource = path.join(releaseDir, 'bundle', 'msi', `Flarity Music_${version}_x64_en-US.msi`);

let nsisDest = null;
let msiDest = null;

if (fs.existsSync(nsisSource)) {
  nsisDest = path.join(distReleaseDir, `Flarity-Music-${version}-x64-setup.exe`);
  fs.copyFileSync(nsisSource, nsisDest);
  console.log(`✅ Đã đồng bộ bộ cài đặt NSIS Setup: ${path.basename(nsisDest)}`);
}

if (fs.existsSync(msiSource)) {
  msiDest = path.join(distReleaseDir, `Flarity-Music-${version}-x64.msi`);
  fs.copyFileSync(msiSource, msiDest);
  console.log(`✅ Đã đồng bộ bộ cài đặt Windows MSI: ${path.basename(msiDest)}`);
}

// 8. TẠO THƯ MỤC CHỨA CÁC FILE EXE VÀ ZIP TẠI THƯ MỤC DOWNLOADS CỦA NGƯỜI DÙNG
const userHome = os.homedir();
const downloadsDir = path.join(userHome, 'Downloads');
const userReleaseDir = path.join(downloadsDir, `Flarity-Music-v${version}-Release`);

try {
  if (!fs.existsSync(userReleaseDir)) {
    fs.mkdirSync(userReleaseDir, { recursive: true });
  }

  console.log(`\n📂 Đang xuất bản tất cả các file thực thi sang thư mục Downloads...`);
  console.log(`👉 Đường dẫn: ${userReleaseDir}`);

  // Sao chép NSIS Setup Exe
  if (nsisDest && fs.existsSync(nsisDest)) {
    const targetSetup = path.join(userReleaseDir, `Flarity-Music-${version}-x64-setup.exe`);
    fs.copyFileSync(nsisDest, targetSetup);
    console.log(`  ➕ [Exe Setup] ${path.basename(targetSetup)}`);
  }

  // Sao chép Portable ZIP
  if (fs.existsSync(zipFilePath)) {
    const targetZip = path.join(userReleaseDir, zipFileName);
    fs.copyFileSync(zipFilePath, targetZip);
    console.log(`  ➕ [Portable Zip] ${zipFileName}`);
  }

  // Sao chép MSI installer
  if (msiDest && fs.existsSync(msiDest)) {
    const targetMsi = path.join(userReleaseDir, `Flarity-Music-${version}-x64.msi`);
    fs.copyFileSync(msiDest, targetMsi);
    console.log(`  ➕ [MSI Setup] ${path.basename(targetMsi)}`);
  }

  // Sao chép thư mục Portable trực tiếp để người dùng có thể chạy luôn không cần giải nén
  const userPortableFolder = path.join(userReleaseDir, `Flarity-Music-${version}-portable`);
  if (fs.existsSync(userPortableFolder)) {
    fs.rmSync(userPortableFolder, { recursive: true, force: true });
  }
  fs.cpSync(portableFolder, userPortableFolder, { recursive: true });
  console.log(`  ➕ [Portable Folder] Flarity-Music-${version}-portable (chạy ngay trực tiếp)`);

  console.log(`✅ Đã tạo thư mục chứa đầy đủ các file EXE và ZIP trong thư mục Downloads của bạn!`);
} catch (err) {
  console.warn(`⚠️ Cảnh báo khi xuất bản sang thư mục Downloads:`, err.message);
}

console.log(`\n======================================================`);
console.log(`🎉 HOÀN TẤT ĐÓNG GÓI TẤT CẢ CÁC BẢN PHÂN PHỐI!`);
console.log(`📁 Thư mục trong Project: ${distReleaseDir}`);
console.log(`📁 Thư mục trong Downloads: ${userReleaseDir}`);
console.log(`======================================================\n`);

