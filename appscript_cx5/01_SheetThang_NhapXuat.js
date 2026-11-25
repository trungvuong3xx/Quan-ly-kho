// ============================================================================
// MODULE 01: DANH MỤC (LIST) & NHẬP / XUẤT SHEET THÁNG
// Phụ thuộc ngoài: Gọi ghiGhepCX5() và danhDauXuatLSC5NoLock_() từ 02_LSC5.js
// ============================================================================

function khoiTaoForm(dateStr, forceRefresh) {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return { exists: false, sheetName: '', error: 'Ngày không hợp lệ', mspList: [] };
    }

    const sheetName = String(date.getMonth() + 1);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    const exists = !!sheet;

    if (forceRefresh) {
      try { CacheService.getScriptCache().remove('mspListFull_' + sheetName); } catch (e) {}
    }

    const mspList = exists ? getMspList(dateStr) : [];

    return { exists: exists, sheetName: sheetName, mspList: mspList };
  } catch (err) {
    return { exists: false, sheetName: '', error: err.message, mspList: [] };
  }
}

function getMspList(dateStr) {
  const date0 = new Date(dateStr);
  const sheetName0 = String(date0.getMonth() + 1);
  const fullCacheKey = 'mspListFull_' + sheetName0;
  const fullCache = CacheService.getScriptCache();
  const cachedFull = fullCache.get(fullCacheKey);
  if (cachedFull) {
    try { return JSON.parse(cachedFull); } catch (e) {}
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const listSheet = ss.getSheetByName(CONFIG.LIST_SHEET_NAME);
  if (!listSheet) throw new Error('Không tìm thấy sheet "' + CONFIG.LIST_SHEET_NAME + '"');

  const lastRow = listSheet.getLastRow();
  if (lastRow < CONFIG.LIST_START_ROW) return [];

  const numRows = lastRow - CONFIG.LIST_START_ROW + 1;
  const data = listSheet.getRange(CONFIG.LIST_START_ROW, 1, numRows, 4).getValues();

  const baseList = data
    .filter(r => r[CONFIG.LIST_COL_TEN - 1] && r[CONFIG.LIST_COL_MSP - 1])
    .map(r => ({
      ten: String(r[CONFIG.LIST_COL_TEN - 1]).trim(),
      msp: String(r[CONFIG.LIST_COL_MSP - 1]).trim(),
      countThuong: Number(r[CONFIG.LIST_COL_SOLAN_THUONG - 1]) || 0,
      countFor: Number(r[CONFIG.LIST_COL_SOLAN_FOR - 1]) || 0
    }));

  const vungSets = getVungSets_(dateStr);
  const mspInThuong = vungSets.thuong;
  const mspInFor = vungSets.for;

  const result = [];
  baseList.forEach(item => {
    const coThuong = mspInThuong.has(item.msp);
    const coFor = mspInFor.has(item.msp);

    if (coThuong && coFor) {
      result.push({ ten: item.ten, msp: item.msp, vung: 'NORMAL', count: item.countThuong });
      result.push({ ten: item.ten + ' X1', msp: item.msp, vung: 'FOR', count: item.countFor });
    } else if (coFor) {
      result.push({ ten: item.ten, msp: item.msp, vung: 'FOR', count: item.countFor });
    } else {
      result.push({ ten: item.ten, msp: item.msp, vung: 'NORMAL', count: item.countThuong });
    }
  });

  try { fullCache.put(fullCacheKey, JSON.stringify(result), 14400); } catch (e) {}

  return result;
}

function getVungSets_(dateStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const date = new Date(dateStr);
  const sheetName = String(date.getMonth() + 1);
  const cache = CacheService.getScriptCache();
  const cacheKey = 'vungSets_' + sheetName;

  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      return { thuong: new Set(parsed.thuong), for: new Set(parsed.for) };
    } catch (e) {}
  }

  const thuongSet = new Set();
  const forSet = new Set();
  const sheet = ss.getSheetByName(sheetName);

  if (sheet) {
    const startRow = 6;
    const endRow = 644;
    const numRows = endRow - startRow + 1;
    const values = sheet.getRange(startRow, CONFIG.MSP_COL_IN_MONTH_SHEET, numRows, 1).getValues();

    for (let i = 0; i < values.length; i++) {
      const v = String(values[i][0]).trim();
      if (!v) continue;
      const rowNum = startRow + i;

      if (rowNum >= 544 && rowNum <= 630) {
        forSet.add(v);
      } else if ((rowNum >= 6 && rowNum <= 543) || (rowNum >= 637 && rowNum <= 644)) {
        thuongSet.add(v);
      }
    }

    try {
      cache.put(cacheKey, JSON.stringify({
        thuong: Array.from(thuongSet),
        for: Array.from(forSet)
      }), 600);
    } catch (e) {}
  }

  return { thuong: thuongSet, for: forSet };
}

function submitEntry(payload) {
  try {
    const rule = LOAI_RULES[payload.loai];
    if (!rule) return { success: false, message: 'Loại không hợp lệ' };

    if (!payload.msp) return { success: false, message: 'Thiếu MSP' };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const date = new Date(payload.dateStr);
    if (isNaN(date.getTime())) {
      return { success: false, message: 'Ngày không hợp lệ: "' + payload.dateStr + '"' };
    }
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const sheetName = String(month);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return { success: false, message: 'Chưa có sheet tháng "' + sheetName + '". Vui lòng tạo sheet trước.' };
    }

    const baoCol = CONFIG.AF_COL_INDEX + (day - 1) * 8 + rule.offset;

    const ranges = rule.dynamicVung
      ? (payload.vung === 'FOR' ? VUNG_FOR_RANGES : VUNG_THUONG_RANGES)
      : rule.ranges;

    const foundRow = findRowByMsp_(sheet, payload.msp, ranges);
    if (foundRow === -1) {
      return { success: false, message: 'Không tìm thấy MSP "' + payload.msp + '" trong kho đã chọn' };
    }

    const baoInput = payload.bao ? Number(payload.bao) : 0;
    const kgInput = payload.kg ? Number(payload.kg) : 0;

    if (!isFinite(baoInput) || !isFinite(kgInput)) {
      return { success: false, message: 'Bao/Kg không phải là số hợp lệ' };
    }
    if (baoInput < 0 || kgInput < 0) {
      return { success: false, message: 'Bao/Kg không thể là số âm' };
    }

    const range = sheet.getRange(foundRow, baoCol, 1, 2);
    const existing = range.getValues()[0];

    const baoResult = combineValue_(existing[0], baoInput, rule.suffix);
    if (!baoResult.ok) {
      return {
        success: false,
        message: 'Ô BAO đang có loại khác (hậu tố .x' + baoResult.existingSuffix + '), không thể cộng dồn với loại đang chọn'
      };
    }

    const kgResult = combineValue_(existing[1], kgInput, rule.suffix);
    if (!kgResult.ok) {
      return {
        success: false,
        message: 'Ô KG đang có loại khác (hậu tố .x' + kgResult.existingSuffix + '), không thể cộng dồn với loại đang chọn'
      };
    }

    range.setValues([[
      Math.round(baoResult.val * 100) / 100,
      Math.round(kgResult.val * 100) / 100
    ]]);

    if (payload.ghiChu) {
      sheet.getRange(foundRow, baoCol + 1).setNote(payload.ghiChu);
    }

    const vungThucTe = (ranges === VUNG_FOR_RANGES) ? 'FOR' : 'NORMAL';

    return {
      success: true,
      message: 'Đã ghi vào sheet ' + sheetName + ', dòng ' + foundRow,
      newBao: baoResult.val,
      newKg: kgResult.val,
      vung: vungThucTe
    };
  } catch (err) {
    return { success: false, message: 'Lỗi: ' + err.message };
  }
}

function findRowByMsp_(sheet, msp, ranges) {
  const target = String(msp).trim();
  for (const [start, end] of ranges) {
    const numRows = end - start + 1;
    const values = sheet.getRange(start, CONFIG.MSP_COL_IN_MONTH_SHEET, numRows, 1).getValues();
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0]).trim() === target) {
        return start + i;
      }
    }
  }
  return -1;
}

function combineValue_(existingRaw, inputVal, suffixCode) {
  const existingNum = parseCellNumber_(existingRaw);

  if (existingNum === 0) {
    const roundedInput = Math.round(inputVal * 10) / 10;
    return { ok: true, val: roundedInput + (suffixCode > 0 ? suffixCode / 100 : 0) };
  }

  const existingCents = Math.round(existingNum * 100);
  const existingTypeDigit = ((existingCents % 10) + 10) % 10;
  const existingRealAmount = (existingCents - existingTypeDigit) / 100;

  if (existingTypeDigit !== suffixCode) {
    return { ok: false, existingSuffix: existingTypeDigit };
  }

  const newRealAmount = Math.round((existingRealAmount + inputVal) * 10) / 10;
  return { ok: true, val: newRealAmount + (suffixCode > 0 ? suffixCode / 100 : 0) };
}

function parseCellNumber_(val) {
  if (val === '' || val === '-' || val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function submitEntryX5(payload) {
  try {
    if (!payload || !payload.msp) return { success: false, message: "Thiếu MSP" };

    // Tách biệt hoàn toàn: Bảng đối chiếu CHỈ ghi dữ liệu vào Sheet Tháng
    const entryResult = submitEntry({
      dateStr: payload.dateStr,
      loai: payload.loai || "NHAP_SX",
      vung: payload.vung || "NORMAL",
      msp: payload.msp,
      bao: payload.bao,
      kg: payload.kg,
      ghiChu: payload.ghiChu || ""
    });
    return entryResult;
  } catch (err) {
    return { success: false, message: "Lỗi: " + err.message };
  }
}

function batchSubmitEntryX5(payload) {
  const lock = LockService.getDocumentLock();
  try {
    lock.waitLock(30000);
    const items = (payload && payload.items) ? payload.items : [];
    const lsc5SessionEntries = (payload && payload.lsc5SessionEntries) ? payload.lsc5SessionEntries : [];
    const lsc5Marks = (payload && payload.lsc5Marks) ? payload.lsc5Marks : [];

    if (!Array.isArray(items) || items.length === 0) {
      if (lsc5SessionEntries.length > 0) {
        ghiGhepCX5({ dateStr: payload.dateStr, sessionEntries: lsc5SessionEntries, groups: [] });
      }
      if (lsc5Marks.length > 0) {
        danhDauXuatLSC5NoLock_({ marks: lsc5Marks, dateStr: payload.dateStr, loaiText: payload.loaiText });
      }
      return { success: true, count: 0, results: [] };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const results = [];
    const byDate = {};

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.dateStr) continue;
      if (!byDate[it.dateStr]) byDate[it.dateStr] = [];
      byDate[it.dateStr].push(it);
    }

    for (const dateStr in byDate) {
      const dateItems = byDate[dateStr];
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        dateItems.forEach(it => results.push({ key: it.key, msp: it.msp, success: false, message: 'Ngày không hợp lệ' }));
        continue;
      }
      
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const sheetName = String(month);
      const sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        dateItems.forEach(it => results.push({ key: it.key, msp: it.msp, success: false, message: 'Chưa có sheet tháng' }));
        continue;
      }

      const baseCol = CONFIG.AF_COL_INDEX + (day - 1) * 8;

      const mspData = sheet.getRange(6, CONFIG.MSP_COL_IN_MONTH_SHEET, 639, 1).getValues();
      const dayValues = sheet.getRange(6, baseCol, 639, 8).getValues();

      const mspMapNormal = {};
      const mspMapFor = {};
      for (let i = 0; i < mspData.length; i++) {
        const rowNum = 6 + i;
        const m = String(mspData[i][0]).trim();
        if (!m) continue;
        if ((rowNum >= 6 && rowNum <= 543) || (rowNum >= 637 && rowNum <= 644)) {
          if (mspMapNormal[m] === undefined) mspMapNormal[m] = i;
        } else if (rowNum >= 544 && rowNum <= 630) {
          if (mspMapFor[m] === undefined) mspMapFor[m] = i;
        }
      }

      // Theo dõi các ô (dòng + cột) thực sự bị thay đổi
      const changedCellsMap = {};

      for (let i = 0; i < dateItems.length; i++) {
        const item = dateItems[i];
        if (!item.msp) {
          results.push({ key: item.key, msp: "", success: false, message: "Thiếu MSP" });
          continue;
        }

        const loaiKey = item.loai || "NHAP_SX";
        const rule = LOAI_RULES[loaiKey];
        if (!rule) {
          results.push({ key: item.key, msp: item.msp, success: false, message: "Loại không hợp lệ: " + loaiKey });
          continue;
        }

        const isFor = rule.dynamicVung ? (item.vung === "FOR") : (rule.ranges === VUNG_FOR_RANGES);
        const mspClean = String(item.msp).trim();
        const idx = isFor ? mspMapFor[mspClean] : mspMapNormal[mspClean];
        if (idx === undefined) {
          results.push({ key: item.key, msp: item.msp, success: false, message: 'Không tìm thấy MSP trong kho đã chọn' });
          continue;
        }

        const baoInput = item.bao ? Number(item.bao) : 0;
        const kgInput = item.kg ? Number(item.kg) : 0;
        const offset = rule.offset || 0;
        const suffix = rule.suffix || 0;

        const existingBao = dayValues[idx][offset];
        const existingKg = dayValues[idx][offset + 1];
        const baoResult = combineValue_(existingBao, baoInput, suffix);
        const kgResult = combineValue_(existingKg, kgInput, suffix);

        if (!baoResult.ok) {
          results.push({ key: item.key, msp: item.msp, success: false, message: 'Ô BAO đang có loại khác (hậu tố .x' + baoResult.existingSuffix + ')' });
          continue;
        }
        if (!kgResult.ok) {
          results.push({ key: item.key, msp: item.msp, success: false, message: 'Ô KG đang có loại khác (hậu tố .x' + kgResult.existingSuffix + ')' });
          continue;
        }

        const newBao = Math.round(baoResult.val * 100) / 100;
        const newKg = Math.round(kgResult.val * 100) / 100;
        dayValues[idx][offset] = newBao;
        dayValues[idx][offset + 1] = newKg;

        const actualRowNum = 6 + idx;
        const targetCol = baseCol + offset;
        const cellKey = actualRowNum + "_" + targetCol;
        const prevNote = changedCellsMap[cellKey] ? changedCellsMap[cellKey].ghiChu : "";
        const itemNote = String(item.ghiChu || "").trim();
        const mergedNote = (prevNote && itemNote && prevNote !== itemNote) ? (prevNote + "\n" + itemNote) : (itemNote || prevNote);

        changedCellsMap[cellKey] = {
          row: actualRowNum,
          col: targetCol,
          bao: newBao,
          kg: newKg,
          ghiChu: mergedNote
        };

        results.push({ key: item.key, msp: item.msp, ten: item.ten, vung: isFor ? "FOR" : "NORMAL", success: true, message: 'Đã ghi vào sheet ' + sheetName + ', dòng ' + actualRowNum });
      }

      // Ghi CHÍNH XÁC từng dòng thay đổi - TUYỆT ĐỐI KHÔNG ghi đè toàn bộ cột làm mất công thức các dòng tổng (như dòng 537, 541...)
      const changedKeys = Object.keys(changedCellsMap);
      for (let k = 0; k < changedKeys.length; k++) {
        const rData = changedCellsMap[changedKeys[k]];
        sheet.getRange(rData.row, rData.col, 1, 2).setValues([[rData.bao, rData.kg]]);
        if (rData.ghiChu) {
          sheet.getRange(rData.row, rData.col + 1).setNote(rData.ghiChu);
        }
      }
    }

    // Nếu có kèm lô Nhập Trả vùng X5 cần ghi vào LSC5
    if (lsc5SessionEntries.length > 0) {
      ghiGhepCX5({
        dateStr: payload.dateStr || (items[0] && items[0].dateStr),
        sessionEntries: lsc5SessionEntries,
        groups: []
      });
    }

    // Nếu có kèm danh sách đánh dấu Xuất trên LSC5
    if (lsc5Marks.length > 0) {
      danhDauXuatLSC5NoLock_({
        marks: lsc5Marks,
        dateStr: payload.dateStr || (items[0] && items[0].dateStr),
        loaiText: payload.loaiText || ""
      });
    }

    return { success: true, results: results };
  } catch (err) {
    return { success: false, message: "Lỗi batch: " + err.message };
  } finally {
    try { lock.releaseLock(); } catch (eLock) {}
  }
}
