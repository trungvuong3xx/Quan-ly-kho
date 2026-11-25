const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const MODULES_DIR = path.join(ROOT_DIR, 'appscript_cx5');
const OUTPUT_FILE = path.join(ROOT_DIR, 'appscritp_cx5.txt');

const MODULE_ORDER = [
  '00_Main.js',
  '01_SheetThang_NhapXuat.js',
  '02_LSC5.js',
  '03_TraCuuTonKho.js',
  '99_Legacy.js'
];

const EXPECTED_FUNCTIONS = [
  'doPost',
  'khoiTaoForm', 'getMspList', 'getVungSets_',
  'submitEntry', 'findRowByMsp_', 'combineValue_', 'parseCellNumber_',
  'submitEntryX5', 'batchSubmitEntryX5',
  'chuanHoaNgayLSC5_', 'docCacKhoiLSC5_', 'layUngVienGhepCX5', 'chuoiThanhDsSo_',
  'ghiGhepCX5', 'layChiTietNguonGocCX5', 'xoaUngVienGhepCX5',
  'formatNgayNganLSC5_', 'formatNgayDayDuLSC5_', 'isCellToMauXuatLSC5_',
  'docChiTietKhoiLSC5ChoXuat_', 'layTonChuaXuatLSC5', 'danhDauXuatLSC5NoLock_', 'danhDauXuatLSC5',
  'layDanhSachSanPhamTonKhoCX5', 'layTonKhoCX5',
  'showEntryForm', 'kiemTraThangSheet', 'layLS_', 'ghiLichSu', 'layLichSu',
  'capNhatSoLanDung', 'incrementUsageCount_', 'layLSC5_', 'ghiLichSuC5', 'docThongTinLuotLSC5_'
];

function bundleGasCx5() {
  if (!fs.existsSync(MODULES_DIR)) {
    console.error('❌ Không tìm thấy thư mục appscript_cx5/ tại:', MODULES_DIR);
    process.exit(1);
  }

  const seenFuncs = new Map();
  const seenConsts = new Map();
  const chunks = [
    '// ============================================================================',
    '// ⚠️ AUTO-GENERATED FROM appscript_cx5/ — KHÔNG SỬA TRỰC TIẾP FILE NÀY!',
    '// 👉 Mọi chỉnh sửa nghiệp vụ CX5 vui lòng sửa trong appscript_cx5/*.js',
    '// 👉 Sau đó chạy: npm run build:gas',
    '// ============================================================================'
  ];

  for (const fileName of MODULE_ORDER) {
    const filePath = path.join(MODULES_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      console.error('❌ Thiếu module bắt buộc:', fileName);
      process.exit(1);
    }

    const code = fs.readFileSync(filePath, 'utf8');

    // 1. Kiểm tra cú pháp từng module
    try {
      new Function(code);
    } catch (err) {
      console.error(`❌ Lỗi cú pháp trong ${fileName}:`, err.message);
      process.exit(1);
    }

    // 2. Quét trùng lặp function và top-level const
    const lines = code.split(/\r?\n/);
    for (const line of lines) {
      const fnMatch = line.match(/^function\s+([a-zA-Z0-9_]+)\s*\(/);
      if (fnMatch) {
        const fnName = fnMatch[1];
        if (seenFuncs.has(fnName)) {
          console.error(`❌ Trùng lặp hàm "${fnName}" giữa ${seenFuncs.get(fnName)} và ${fileName}`);
          process.exit(1);
        }
        seenFuncs.set(fnName, fileName);
      }

      const constMatch = line.match(/^const\s+([A-Z0-9_]+)\s*=/);
      if (constMatch) {
        const cName = constMatch[1];
        if (seenConsts.has(cName)) {
          console.error(`❌ Trùng lặp hằng số "${cName}" giữa ${seenConsts.get(cName)} và ${fileName}`);
          process.exit(1);
        }
        seenConsts.set(cName, fileName);
      }
    }

    chunks.push(code.trim());
  }

  // 3. Parity Check: đối chiếu đủ toàn bộ hàm cốt lõi
  const missing = EXPECTED_FUNCTIONS.filter(fn => !seenFuncs.has(fn));
  if (missing.length > 0) {
    console.error('❌ Parity Check thất bại! Thiếu các hàm:', missing.join(', '));
    process.exit(1);
  }

  const bundled = chunks.join('\n\n') + '\n';

  // 4. Kiểm tra cú pháp bản gộp cuối cùng
  try {
    new Function(bundled);
  } catch (err) {
    console.error('❌ Lỗi cú pháp ở file gộp appscritp_cx5.txt:', err.message);
    process.exit(1);
  }

  fs.writeFileSync(OUTPUT_FILE, bundled, 'utf8');
  console.log(`✅ Bundle & Parity Check PASS: ${MODULE_ORDER.length} modules, ${seenFuncs.size} functions -> appscritp_cx5.txt`);
}

bundleGasCx5();
