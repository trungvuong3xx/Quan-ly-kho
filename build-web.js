const fs = require('fs');
const path = require('path');

const filesToCopy = [
  'index.html',
  'style.css',
  'app.js',
  'quetqr.js',
  'kiemke.js',
  'cx1.js',
  'cx5.js',
  'btp.js',
  'tonkho.js',
  'Fast.mp3',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'favicon.png',
  'sw.js'
];

const wwwDir = path.join(__dirname, 'www');
const androidAssetsDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'assets');
const androidPublicDir = path.join(androidAssetsDir, 'public');

[wwwDir, androidAssetsDir, androidPublicDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

for (const file of filesToCopy) {
  const src = path.join(__dirname, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(wwwDir, file));
    fs.copyFileSync(src, path.join(androidPublicDir, file));
    console.log(`Copied ${file} -> www/ & android/assets/public/`);
  }
}

// Copy local libraries (lib/) recursively to www/lib and android assets
function copyDirRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
copyDirRecursive(path.join(__dirname, 'lib'), path.join(wwwDir, 'lib'));
copyDirRecursive(path.join(__dirname, 'lib'), path.join(androidPublicDir, 'lib'));
console.log('Copied lib/ -> www/lib & android/assets/public/lib');

// Copy config files for Android Capacitor
const capConfigSrc = path.join(__dirname, 'capacitor.config.json');
if (fs.existsSync(capConfigSrc)) {
  fs.copyFileSync(capConfigSrc, path.join(androidAssetsDir, 'capacitor.config.json'));
}

const pluginsJsonContent = JSON.stringify([
  {
    pkg: "@capacitor/app",
    classpath: "com.capacitorjs.plugins.app.AppPlugin"
  }
], null, 2);
fs.writeFileSync(path.join(androidAssetsDir, 'capacitor.plugins.json'), pluginsJsonContent, 'utf8');

// ── BẢO VỆ DỰ ÁN TỰ ĐỘNG (BỘ QUY TẮC CỐ ĐỊNH BẤT DI BẤT DỊCH) ──────────────
function kiemTraQuyTacBuild() {
  console.log('--- Đang kiểm tra bộ quy tắc cố định build APK ---');
  
  // 1. Kiểm tra CI workflow
  const workflowPath = path.join(__dirname, '.github', 'workflows', 'build-apk.yml');
  if (fs.existsSync(workflowPath)) {
    const wfContent = fs.readFileSync(workflowPath, 'utf8');
    if (wfContent.includes('java-version: 21') || wfContent.includes("java-version: '21'")) {
      console.error('\n❌ LỖI NGHIÊM TRỌNG: .github/workflows/build-apk.yml đang dùng Java 21!');
      console.error('👉 BẮT BUỘC: java-version: 17 để tránh lỗi treo cài đặt dex2oat trên Android 14!\n');
      process.exit(1);
    }
  }

  // 2. Kiểm tra android/app/build.gradle
  const appGradlePath = path.join(__dirname, 'android', 'app', 'build.gradle');
  if (fs.existsSync(appGradlePath)) {
    const appGradle = fs.readFileSync(appGradlePath, 'utf8');
    if (appGradle.includes('JavaVersion.VERSION_21')) {
      console.error('\n❌ LỖI NGHIÊM TRỌNG: android/app/build.gradle đang dùng JavaVersion.VERSION_21!');
      console.error('👉 BẮT BUỘC: JavaVersion.VERSION_17!\n');
      process.exit(1);
    }
    if (!appGradle.includes('debug.keystore')) {
      console.error('\n❌ LỖI NGHIÊM TRỌNG: Thiếu debug.keystore cố định trong android/app/build.gradle!\n');
      process.exit(1);
    }
  }

  // 3. Kiểm tra android/build.gradle
  const rootGradlePath = path.join(__dirname, 'android', 'build.gradle');
  if (fs.existsSync(rootGradlePath)) {
    const rootGradle = fs.readFileSync(rootGradlePath, 'utf8');
    if (!rootGradle.includes('subprojects') || !rootGradle.includes('JavaVersion.VERSION_17')) {
      console.error('\n❌ LỖI NGHIÊM TRỌNG: android/build.gradle thiếu khối subprojects ép Java 17 cho plugin Capacitor!\n');
      process.exit(1);
    }
  }

  console.log('✅ Bộ quy tắc cố định Android & Build APK: ĐẠT CHUẨN 100% (Java 17, debug.keystore, subprojects locked).');
}
kiemTraQuyTacBuild();

console.log('Build web completed successfully.');
