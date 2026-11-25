// ============================================================================
// MODULE 03: TRA CỨU TỒN KHO TỨC THỜI (READ-ONLY)
// Khép kín 100% - Chỉ đọc Sheet LIST & Sheet Tháng
// ============================================================================

function layDanhSachSanPhamTonKhoCX5() {
  try {
    const cacheKey = "tonKhoDanhSach_v1";
    const cache = CacheService.getScriptCache();
    const cached = cache.get(cacheKey);
    if (cached) {
      try { return { list: JSON.parse(cached) }; } catch (e) {}
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const listSheet = ss.getSheetByName(CONFIG.LIST_SHEET_NAME);
    if (!listSheet) return { list: [] };

    const lastRow = listSheet.getLastRow();
    if (lastRow < CONFIG.LIST_START_ROW) return { list: [] };

    const numRows = lastRow - CONFIG.LIST_START_ROW + 1;
    const data = listSheet.getRange(CONFIG.LIST_START_ROW, 1, numRows, 2).getValues();

    const list = data
      .filter(function (r) { return r[CONFIG.LIST_COL_TEN - 1] && r[CONFIG.LIST_COL_MSP - 1]; })
      .map(function (r) {
        return { ten: String(r[CONFIG.LIST_COL_TEN - 1]).trim(), msp: String(r[CONFIG.LIST_COL_MSP - 1]).trim() };
      });

    try { cache.put(cacheKey, JSON.stringify(list), 1800); } catch (e) {}

    return { list: list };
  } catch (err) {
    return { error: err.message };
  }
}

function layTonKhoCX5(payload) {
  try {
    const dateStr = payload && payload.dateStr;
    const msps = (payload && payload.msps) || [];
    if (msps.length === 0) return { list: [] };

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return { error: "Ngày không hợp lệ" };

    const sheetName = String(date.getMonth() + 1);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { error: 'Chưa có sheet tháng "' + sheetName + '"' };

    // TỐI ƯU HÓA: Đọc 1 lần duy nhất toàn bộ bảng (dòng 6-644, 639 dòng) từ Cột 7 (G: MSP) đến Cột 11 (K: KG Cuối)
    // Thay thế vòng lặp gọi hàng trăm API thành đúng 1 lần đọc duy nhất
    const data = sheet.getRange(6, 7, 639, 5).getValues();

    const mspMapThuong = {};
    const mspMapFor = {};

    for (let i = 0; i < data.length; i++) {
      const rowNum = 6 + i;
      const m = String(data[i][0]).trim();
      if (!m) continue;
      const rowInfo = {
        baoDau: data[i][1] || 0,
        kgDau: data[i][2] || 0,
        baoCuoi: data[i][3] || 0,
        kgCuoi: data[i][4] || 0
      };
      if ((rowNum >= 6 && rowNum <= 543) || (rowNum >= 637 && rowNum <= 644)) {
        if (!mspMapThuong[m]) mspMapThuong[m] = rowInfo;
      } else if (rowNum >= 544 && rowNum <= 630) {
        if (!mspMapFor[m]) mspMapFor[m] = rowInfo;
      }
    }

    const ketQua = [];
    msps.forEach(function (msp) {
      const m = String(msp).trim();
      if (mspMapThuong[m]) {
        const v = mspMapThuong[m];
        ketQua.push({ msp: m, kho: "Thường", baoDau: v.baoDau, kgDau: v.kgDau, baoCuoi: v.baoCuoi, kgCuoi: v.kgCuoi });
      }
      if (mspMapFor[m]) {
        const v = mspMapFor[m];
        ketQua.push({ msp: m, kho: "FOR", baoDau: v.baoDau, kgDau: v.kgDau, baoCuoi: v.baoCuoi, kgCuoi: v.kgCuoi });
      }
    });

    return { list: ketQua };
  } catch (err) {
    return { error: err.message };
  }
}
