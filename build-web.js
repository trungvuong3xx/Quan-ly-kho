const fs = require('fs');
const path = require('path');

const filesToCopy = [
  'index.html',
  'style.css',
  'themes.css',
  'config.js',
  'app.js',
  'scanner-core.js',
  'quetqr.js',
  'kiemke.js',
  'cx1.js',
  'cx5.js',
  'btp.js',
  'tp.js',
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
  
  // 0. Kiểm tra đường dẫn dự án độc tôn duy nhất trên máy cục bộ: C:\NTV\Code gốc
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  if (!isCI) {
    const normalizedCurrentDir = path.resolve(__dirname).toLowerCase().replace(/\\/g, '/');
    if (!normalizedCurrentDir.endsWith('/ntv/code gốc') && !normalizedCurrentDir.endsWith('/ntv/code goc')) {
      console.error('\n❌ LỖI ĐƯỜNG DẪN: Dự án chỉ được phép thực hiện duy nhất tại C:\\NTV\\Code gốc!');
      console.error(`👉 Thư mục hiện tại đang chạy: ${__dirname}\n`);
      process.exit(1);
    }
  }

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
    if (!rootGradle.includes('subprojects') || !rootGradle.includes('JavaVersion.VERSION_17') || !rootGradle.includes('jvmTarget = "17"')) {
      console.error('\n⚠️ LỖI NGHIÊM TRỌNG: android/build.gradle thiếu khối ép subprojects ép Java 17 và Kotlin jvmTarget 17!');
      process.exit(1);
    }
  }

  console.log('✅ Bộ quy tắc cố định Android & Build APK: ĐẠT CHUẨN 100% (Java 17, debug.keystore, subprojects locked).');
}
kiemTraQuyTacBuild();

// ── KIỂM TRA TỰ ĐỘNG TƯƠNG PHẢN WCAG 2.1 CHO HỆ THỐNG THEME (P3.1) ──────────
function kiemTraTuongPhanTheme() {
  const stylePath = path.join(__dirname, 'style.css');
  const themesPath = path.join(__dirname, 'themes.css');
  if (!fs.existsSync(stylePath) || !fs.existsSync(themesPath)) return;

  const styleCss = fs.readFileSync(stylePath, 'utf8');
  const themesCss = fs.readFileSync(themesPath, 'utf8');

  if (themesCss.includes('.bnav-btn')) {
    console.error('\n❌ LỖI THEME: Phát hiện selector cũ `.bnav-btn` trong themes.css (phải dùng `.nav-item`)!\n');
    process.exit(1);
  }

  function hexToRgb(hex) {
    if (!hex || !hex.startsWith('#')) return null;
    let h = hex.slice(1).trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (h.length !== 6) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function lum([r, g, b]) {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function contrast(h1, h2) {
    const c1 = hexToRgb(h1), c2 = hexToRgb(h2);
    if (!c1 || !c2) return null;
    const l1 = lum(c1), l2 = lum(c2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function parseVars(txt, base = {}) {
    const out = { ...base };
    for (const m of txt.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
      out[m[1]] = m[2].trim();
    }
    return out;
  }

  const lightMatch = styleCss.match(/:root,\s*\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/);
  const darkMatch = styleCss.match(/\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/);
  if (!lightMatch || !darkMatch) return;

  const lightBase = parseVars(lightMatch[1]);
  const allThemes = { dark: parseVars(darkMatch[1], lightBase) };
  for (const m of themesCss.matchAll(/html\[data-theme="light"\]\[data-skin="([^"]+)"\]\s*\{([\s\S]*?)\n\}/g)) {
    allThemes[m[1]] = parseVars(m[2], lightBase);
  }

  const errors = [];
  for (const [name, v] of Object.entries(allThemes)) {
    const bg = v['--bg-body'] && v['--bg-body'].startsWith('#') ? v['--bg-body'] : '#f8fafc';
    const surf = v['--surface'] && v['--surface'].startsWith('#') ? v['--surface'] : '#ffffff';

    const rMain = contrast(v['--text-main'], bg);
    if (rMain !== null && rMain < 4.5) {
      errors.push(`[${name}] text-main/bg-body = ${rMain.toFixed(2)}:1 (< 4.5:1)`);
    }
    const rMuted = contrast(v['--text-muted'], surf);
    if (rMuted !== null && rMuted < 4.5) {
      errors.push(`[${name}] text-muted/surface = ${rMuted.toFixed(2)}:1 (< 4.5:1)`);
    }
    const rBtn = contrast(v['--on-primary'], v['--primary-solid']);
    if (rBtn !== null && rBtn < 3.0) {
      errors.push(`[${name}] on-primary/primary-solid = ${rBtn.toFixed(2)}:1 (< 3.0:1)`);
    }
    const rSoft = contrast(v['--primary-text'], v['--primary-soft']);
    if (rSoft !== null && rSoft < 4.0) {
      errors.push(`[${name}] primary-text/primary-soft = ${rSoft.toFixed(2)}:1 (< 4.0:1)`);
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ LỖI TƯƠNG PHẢN WCAG THEME:');
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
  console.log(`✅ Kiểm tra tương phản WCAG 2.1 (${Object.keys(allThemes).length} theme): ĐẠT CHUẨN 100%.`);
}
kiemTraTuongPhanTheme();


