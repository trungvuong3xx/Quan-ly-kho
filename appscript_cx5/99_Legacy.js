// ============================================================================
// MODULE 99: CÁC HÀM LEGACY / SIDEBAR CŨ (KHÔNG GỌI TỪ doPost CỦA PWA)
// Giữ lại để tránh ảnh hưởng nếu kho còn thao tác trực tiếp trên Google Sheets
// ============================================================================

function showEntryForm() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Nhập / Xuất Kho')
    .setWidth(460);
  SpreadsheetApp.getUi().showSidebar(html);
}

function kiemTraThangSheet(dateStr) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return { exists: false, sheetName: '', error: 'Ngày không hợp lệ' };
    }
    const sheetName = String(date.getMonth() + 1);
    const sheet = ss.getSheetByName(sheetName);
    return { exists: !!sheet, sheetName: sheetName };
  } catch (err) {
    return { exists: false, sheetName: '', error: err.message };
  }
}

function layLS_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('LS');
  if (!sh) {
    sh = ss.insertSheet('LS');
    sh.getRange(1, 1, 1, 7).setValues([['LỊCH SỬ NHẬP XUẤT KHO', '', '', '', '', '', '']]);
    sh.getRange(2, 1, 1, 7).setValues([['MSP', 'Quy cách', 'Loại', 'Bao', 'KG', 'Ngày', 'Vùng']]);
    sh.getRange(2, 1, 1, 7).setFontWeight('bold');
  }
  return sh;
}

function ghiLichSu(payload) {
  try {
    const sh = layLS_();
    const lastRow = sh.getLastRow();
    const row = Math.max(lastRow + 1, 3);
    const parts = String(payload.dateStr).split('-').map(Number);
    const ngayObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const vungLabel = payload.vung === 'FOR' ? 'X1' : 'X5';

    sh.getRange(row, 1, 1, 7).setValues([[
      payload.msp || '',
      payload.ten || '',
      payload.loaiText || '',
      Number(payload.bao) || 0,
      Number(payload.kg) || 0,
      ngayObj,
      vungLabel
    ]]);
    sh.getRange(row, 6).setNumberFormat('dd/MM/yyyy');
  } catch (e) {}
}

function layLichSu(dateStr) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('LS');
    if (!sh) return [];

    const lastRow = sh.getLastRow();
    if (lastRow < 3) return [];

    const parts = String(dateStr).split('-').map(Number);
    const ty = parts[0], tm = parts[1], td = parts[2];

    const numRows = lastRow - 3 + 1;
    const data = sh.getRange(3, 1, numRows, 7).getValues();

    const result = [];
    for (let i = 0; i < data.length; i++) {
      const r = data[i];
      const ngayCell = r[5];
      if (!(ngayCell instanceof Date)) continue;
      if (ngayCell.getFullYear() === ty && ngayCell.getMonth() + 1 === tm && ngayCell.getDate() === td) {
        result.push({
          msp: r[0],
          ten: r[1],
          loai: r[2],
          bao: r[3],
          kg: r[4],
          vung: r[6]
        });
      }
    }
    return result;
  } catch (e) {
    return [];
  }
}

function capNhatSoLanDung(msp, vung, dateStr) {
  incrementUsageCount_(msp, vung);
}

function incrementUsageCount_(msp, vung) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const listSheet = ss.getSheetByName(CONFIG.LIST_SHEET_NAME);
    if (!listSheet) return;

    const lastRow = listSheet.getLastRow();
    if (lastRow < CONFIG.LIST_START_ROW) return;

    const target = String(msp).trim();
    const col = (vung === 'FOR') ? CONFIG.LIST_COL_SOLAN_FOR : CONFIG.LIST_COL_SOLAN_THUONG;
    const cache = CacheService.getScriptCache();
    const cacheKey = 'mspRowMap_v1';

    let rowMap = null;
    const cached = cache.get(cacheKey);
    if (cached) {
      try { rowMap = JSON.parse(cached); } catch (e) { rowMap = null; }
    }
    const cachedRow = rowMap && rowMap[target];

    if (cachedRow) {
      const rowData = listSheet.getRange(cachedRow, CONFIG.LIST_COL_MSP, 1, 3).getValues()[0];
      if (String(rowData[0]).trim() === target) {
        const current = Number(rowData[(vung === 'FOR') ? 2 : 1]) || 0;
        listSheet.getRange(cachedRow, col).setValue(current + 1);
        return;
      }
    }

    const numRows = lastRow - CONFIG.LIST_START_ROW + 1;
    const data = listSheet.getRange(CONFIG.LIST_START_ROW, CONFIG.LIST_COL_MSP, numRows, 3).getValues();

    const newRowMap = {};
    let foundRow = -1;
    let foundCurrent = 0;
    for (let i = 0; i < data.length; i++) {
      const rowMsp = String(data[i][0]).trim();
      if (!rowMsp) continue;
      const rowNum = CONFIG.LIST_START_ROW + i;
      newRowMap[rowMsp] = rowNum;
      if (rowMsp === target) {
        foundRow = rowNum;
        foundCurrent = Number(data[i][(vung === 'FOR') ? 2 : 1]) || 0;
      }
    }

    try { cache.put(cacheKey, JSON.stringify(newRowMap), 21600); } catch (e) {}

    if (foundRow === -1) return;

    listSheet.getRange(foundRow, col).setValue(foundCurrent + 1);
  } catch (e) {}
}

function layLSC5_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("LSC5");
  if (!sh) {
    sh = ss.insertSheet("LSC5");
  }
  return sh;
}

function ghiLichSuC5(payload) {
  try {
    const lots = payload.lots || [];
    if (lots.length === 0) return {};

    const sh = layLSC5_();
    const startRow = Math.max(sh.getLastRow() + 1, 3);
    let currentRow = startRow;
    const lotMap = {};
    const matrix = [];

    lots.forEach(function (lot) {
      const kgList = lot.kgList || [];
      if (kgList.length === 0) return;

      const tongKg = Math.round(kgList.reduce(function (s, v) { return s + (Number(v) || 0); }, 0) * 100) / 100;
      let idx = 0;
      let isFirst = true;
      let dongCuoiLot = currentRow;
      const numChunks = Math.ceil(kgList.length / 12);
      let chunkIdx = 0;

      while (idx < kgList.length) {
        chunkIdx++;
        const isLastChunk = (chunkIdx === numChunks);
        const chunk = kgList.slice(idx, idx + 12);

        // Hàng 20 cột (Cột 2 đến 21 trong Sheet LSC5)
        const rowData = new Array(20).fill("");
        if (isFirst) {
          rowData[0] = payload.dateStr;
          rowData[1] = payload.msp;
          rowData[2] = payload.ten;
          isFirst = false;
        }
        for (let i = 0; i < 12; i++) {
          rowData[3 + i] = (chunk[i] !== undefined && chunk[i] !== null && chunk[i] !== "") ? chunk[i] : "";
        }
        if (isLastChunk) {
          rowData[16] = tongKg;        // Cột 18: Tổng KG
          rowData[18] = kgList.length; // Cột 20: Số bao
          rowData[19] = tongKg;        // Cột 21: Tổng KG hiệu lực
        }
        matrix.push(rowData);
        dongCuoiLot = currentRow;
        idx += 12;
        currentRow++;
      }

      if (lot.lotId) lotMap[lot.lotId] = dongCuoiLot;
    });

    // TỐI ƯU HÓA: Ghi toàn bộ dữ liệu các lot trong 1 lần gọi duy nhất
    if (matrix.length > 0) {
      sh.getRange(startRow, 2, matrix.length, 20).setValues(matrix);
    }
    return lotMap;
  } catch (e) { return {}; }
}

function docThongTinLuotLSC5_(sh, rowCuoi) {
  // Dự phòng khi gọi đơn lẻ
  const startRow = Math.max(3, rowCuoi - 25);
  const data = sh.getRange(startRow, 2, rowCuoi - startRow + 1, 15).getValues();
  let relIdx = rowCuoi - startRow;
  let startRelIdx = relIdx;
  while (startRelIdx > 0) {
    if (data[startRelIdx - 1][0] !== "" && data[startRelIdx - 1][0] !== null) break;
    startRelIdx--;
  }
  const ngay = chuanHoaNgayLSC5_(data[startRelIdx][0]);
  const kgList = [];
  for (let i = startRelIdx; i <= relIdx; i++) {
    data[i].slice(3, 15).forEach(function (v) {
      if (v !== "" && v !== null) kgList.push(Number(v) || 0);
    });
  }
  return { ngay: ngay, kgList: kgList };
}
