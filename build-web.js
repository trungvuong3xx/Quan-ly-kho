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

console.log('Build web completed successfully.');
