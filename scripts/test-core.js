#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  ✅ ' + name);
    passed++;
  } catch (err) {
    console.error('  ❌ ' + name + ' -> ' + (err && err.message ? err.message : err));
    failed++;
  }
}

console.log('=== KIỂM THỬ TỰ ĐỘNG DỰ ÁN QUẢN LÝ KHO ===');

// 1. Syntax check all frontend & build JS files
const jsFiles = [
  'config.js', 'app.js', 'scanner-core.js', 'quetqr.js', 'cx1.js',
  'cx5.js', 'btp.js', 'tp.js', 'kiemke.js', 'tonkho.js', 'sw.js', 'build-web.js'
];
test('Cú pháp 12 file JS lõi hợp lệ', () => {
  for (const f of jsFiles) {
    const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
    new vm.Script(code, { filename: f });
  }
});

// 2. Syntax check all inline <script> blocks in index.html
test('Cú pháp tất cả inline <script> trong index.html hợp lệ', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(m => m[1])
    .filter(s => s.trim());
  assert.ok(scripts.length > 0, 'Phải có ít nhất 1 inline script');
  scripts.forEach((s, i) => new vm.Script(s, { filename: 'index.html#script-' + i }));
});

// 3. Unit test config.js
test('APP_CONFIG chứa đủ 4 endpoint GAS hợp lệ và helper xác thực', () => {
  const store = { tenNhanVien: 'Kho Ca 1', app_api_token: 'tok123' };
  const sandbox = {
    window: {},
    localStorage: { getItem: k => store[k] || null }
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8'), sandbox);
  const cfg = sandbox.window.APP_CONFIG;
  assert.ok(cfg && cfg.ENDPOINTS, 'Thiếu APP_CONFIG.ENDPOINTS');
  for (const key of ['APP_QR', 'CX1_CX5_QR', 'TON_KHO_CX5', 'BTP']) {
    assert.match(cfg.ENDPOINTS[key], /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/, 'Endpoint không hợp lệ: ' + key);
  }
  assert.strictEqual(cfg.getNguoiThaoTac(), 'Kho Ca 1');
  assert.strictEqual(cfg.getAppToken(), 'tok123');
});

// 4. Unit test ScannerCore utilities
test('ScannerCore: anToanCongThucExcel, taoRequestId, kiemTraBatThuongKhiQuet, chongBamDup, kiemTraKhoaMa', () => {
  const sandbox = {
    window: {},
    document: { addEventListener: () => {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    setTimeout, clearTimeout, Date, Map, Set, Math, Object, Array, String, Number, JSON, RegExp
  };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'scanner-core.js'), 'utf8'), sandbox);
  const sc = sandbox.ScannerCore;
  assert.ok(sc, 'Thiếu window.ScannerCore');

  // Formula injection protection
  assert.strictEqual(sc.anToanCongThucExcel('=SUM(A1:A5)'), "'=SUM(A1:A5)");
  assert.strictEqual(sc.anToanCongThucExcel('+123'), "'+123");
  assert.strictEqual(sc.anToanCongThucExcel('-50'), "'-50");
  assert.strictEqual(sc.anToanCongThucExcel('@cmd'), "'@cmd");
  assert.strictEqual(sc.anToanCongThucExcel(25.5), 25.5);
  assert.strictEqual(sc.anToanCongThucExcel('QC-12/34'), 'QC-12/34');

  // Idempotency requestId
  const r1 = sc.taoRequestId('cx1');
  const r2 = sc.taoRequestId('cx1');
  assert.ok(r1.startsWith('cx1_'));
  assert.notStrictEqual(r1, r2);

  // Anomaly detection
  assert.strictEqual(sc.kiemTraBatThuongKhiQuet({ kg: 25 }), null);
  assert.ok(typeof sc.kiemTraBatThuongKhiQuet({ kg: 180 }) === 'string');

  // Double-tap guard
  const allow = sc.taoBoKhoaChongBamDup(300);
  assert.strictEqual(allow(), true);
  assert.strictEqual(allow(), false);

  // Scan deduplicator
  const map = new Map();
  assert.strictEqual(sc.kiemTraKhoaMa(map, 'qr001', false), false);
  assert.strictEqual(sc.kiemTraKhoaMa(map, 'qr001', false), true);
  assert.strictEqual(sc.kiemTraKhoaMa(map, 'qr002', false), false);
});

// 5. Theme & UI regression guards
test('themes.css sạch: không còn .bnav-btn, .card, hoặc body.cam-active *', () => {
  const css = fs.readFileSync(path.join(ROOT, 'themes.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!css.includes('.bnav-btn'), 'Phát hiện selector lỗi .bnav-btn');
  assert.ok(!/\.card\b/.test(css), 'Phát hiện selector .card gây viền thừa');
  assert.ok(!/body\.cam-active\s*\*/.test(css), 'Phát hiện body.cam-active * làm đóng băng popup xóa');
});

// 6. Backend GAS security & idempotency guards
test('Backend GAS có Idempotency (CacheService), Token tùy chọn và LockService', () => {
  const cx5Main = fs.readFileSync(path.join(ROOT, 'appscript_cx5', '00_Main.js'), 'utf8');
  const qrGas = fs.readFileSync(path.join(ROOT, 'appscript_quetqr cx1.txt'), 'utf8');
  const btpGas = fs.readFileSync(path.join(ROOT, 'appscript_btp.txt'), 'utf8');
  assert.ok(cx5Main.includes('CacheService.getScriptCache()'), 'CX5 GAS thiếu CacheService Idempotency');
  assert.ok(cx5Main.includes('APP_API_TOKEN'), 'CX5 GAS thiếu kiểm tra APP_API_TOKEN');
  assert.ok(qrGas.includes('CacheService.getScriptCache()'), 'QR/CX1 GAS thiếu CacheService Idempotency');
  assert.ok(qrGas.includes('APP_API_TOKEN'), 'QR/CX1 GAS thiếu kiểm tra APP_API_TOKEN');
  assert.ok(btpGas.includes('LockService.getDocumentLock()'), 'BTP GAS thiếu LockService');
});

// 7. Duplicate global function check
test('Không có hàm global trùng tên giữa btp.js và tp.js', () => {
  const btp = fs.readFileSync(path.join(ROOT, 'btp.js'), 'utf8');
  const tp = fs.readFileSync(path.join(ROOT, 'tp.js'), 'utf8');
  assert.ok(!/^function anToanCongThucExcel\b/m.test(btp), 'btp.js vẫn còn hàm trùng anToanCongThucExcel');
  assert.ok(!/^function anToanCongThucExcel\b/m.test(tp), 'tp.js vẫn còn hàm trùng anToanCongThucExcel');
});

console.log(`\nKết quả kiểm thử: ${passed} đạt / ${failed} lỗi.`);
if (failed > 0) process.exit(1);
