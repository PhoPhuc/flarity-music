// Fails the build when package.json and src-tauri/Cargo.toml disagree on the app version.
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')).version;
const cargo = readFileSync('src-tauri/Cargo.toml', 'utf8').match(/^version\s*=\s*"([^"]+)"/m)?.[1];

if (!cargo || pkg !== cargo) {
  console.error(`Version mismatch: package.json=${pkg}, src-tauri/Cargo.toml=${cargo}`);
  process.exit(1);
}
console.log(`Version ${pkg} OK`);
