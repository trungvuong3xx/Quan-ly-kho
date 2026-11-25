// ============================================================================
// MODULE 02: TOÀN BỘ NGHIỆP VỤ SHEET LSC5 (GHÉP PALLET + TỒN CHƯA XUẤT + TÔ VÀNG)
// Khép kín 100% - Không phụ thuộc module nghiệp vụ khác
// ============================================================================

function chuanHoaNgayLSC5_(v) {
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }
  return String(v == null ? "" : v).trim();
}

function docCacKhoiLSC5_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("LSC5");
  const blocks = [];
  if (!sh) return blocks;

  const lastRow = sh.getLastRow();
  if (lastRow < 3) return blocks;

  const numRows = lastRow - 3 + 1;
  // Đọc 26 cột: Từ Cột 2 (B: Ngày) đến Cột 27 (AA: Tồn còn lại)
  const data = sh.getRange(3, 2, numRows, 26).getValues();

  let cur = null;
  let curNgay = "";

  function dongLai() {
    if (cur) {
      cur.baoHieuLuc = cur.baoGhep != null ? cur.baoGhep : cur.bao;
      cur.kgHieuLuc = cur.kgGhep != null ? cur.kgGhep : cur.kg;
      blocks.push(cur);
    }
    cur = null;
  }

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const rowNum = 3 + i;
    let ngayRaw = r[0];
    const msp = r[1];
    const qc = r[2];

    if (ngayRaw !== "" && ngayRaw !== null) {
      curNgay = ngayRaw;
    } else if ((msp !== "" && msp !== null) || (qc !== "" && qc !== null)) {
      ngayRaw = curNgay;
    }

    const kgCells = r.slice(3, 15);
    const soBaoDong = kgCells.filter(function (v) { return v !== "" && v !== null; }).length;
    const tongCell = r[16];
    const baoGhepCell = r[18];
    const kgGhepCell = r[19];
    const anCell = r[20];
    const wCell = r[21];
    const xCell = r[22];

    if ((msp !== "" && msp !== null) || (qc !== "" && qc !== null)) {
      dongLai();
      cur = {
        msp: String(msp == null ? "" : msp).trim(),
        ten: String(qc == null ? "" : qc).trim(),
        ngay: chuanHoaNgayLSC5_(ngayRaw),
        bao: soBaoDong,
        kg: 0,
        baoGhep: null,
        kgGhep: null,
        daAn: false,
        daXuatHet: false,
        w: "",
        rowDauTien: rowNum,
        rowCuoiCung: rowNum,
        daGhep: false
      };
    } else if (cur) {
      cur.bao += soBaoDong;
    }

    if (cur) {
      if (tongCell !== "" && tongCell !== null) {
        cur.kg = Number(tongCell) || 0;
        cur.rowCuoiCung = rowNum;
      }
      if ((baoGhepCell !== "" && baoGhepCell !== null) || (kgGhepCell !== "" && kgGhepCell !== null)) {
        cur.daGhep = true;
      }
      if (baoGhepCell !== "" && baoGhepCell !== null) cur.baoGhep = Number(baoGhepCell) || 0;
      if (kgGhepCell !== "" && kgGhepCell !== null) cur.kgGhep = Number(kgGhepCell) || 0;
      if (String(anCell == null ? "" : anCell).trim().toUpperCase() === "X") cur.daAn = true;
      const xUpper = String(xCell == null ? "" : xCell).trim().toUpperCase();
      if (xUpper === "ĐÃ XUẤT" || xUpper === "DA XUAT") cur.daXuatHet = true;
      if (wCell !== "" && wCell !== null) cur.w = String(wCell).trim();
    }
  }
  dongLai();

  return blocks;
}

function layUngVienGhepCX5(payload) {
  try {
    const dsQC = payload.dsQC || [];
    const dateStr = payload.dateStr;

    const result = {};
    dsQC.forEach(function (q) { result[q.msp + "|" + q.ten] = { homNay: [], cu: [] }; });

    const blocks = docCacKhoiLSC5_();

    const parseDateToNum = function(dStr) {
      if (!dStr) return 0;
      const s = String(dStr).trim();
      let p = s.split('-');
      if (p.length === 3) {
        if (p[0].length === 4) return parseInt(p[0] + p[1].padStart(2, '0') + p[2].padStart(2, '0'), 10);
        return parseInt(p[2] + p[1].padStart(2, '0') + p[0].padStart(2, '0'), 10);
      }
      p = s.split('/');
      if (p.length === 3) {
        if (p[0].length === 4) return parseInt(p[0] + p[1].padStart(2, '0') + p[2].padStart(2, '0'), 10);
        return parseInt(p[2] + p[1].padStart(2, '0') + p[0].padStart(2, '0'), 10);
      }
      return 0;
    };

    const dateNum = parseDateToNum(dateStr);

    blocks.forEach(function (b) {
      const key = b.msp + "|" + b.ten;
      if (!(key in result)) return;
      const item = {
        row: b.rowCuoiCung,
        ngay: b.ngay,
        bao: b.bao,
        kg: Math.round(b.kg * 100) / 100,
        effBao: b.baoHieuLuc,
        effKg: Math.round(b.kgHieuLuc * 100) / 100,
        v: b.daAn ? "X" : ""
      };
      
      const bDateNum = parseDateToNum(b.ngay);
      
      if ((bDateNum > 0 && bDateNum === dateNum) || b.ngay === dateStr) {
        result[key].homNay.push(item);
      } else if (!b.daAn && !b.daXuatHet && b.baoHieuLuc > 0 && b.baoHieuLuc < 10) {
        if (bDateNum > 0 && dateNum > 0 && bDateNum < dateNum) {
          result[key].cu.push(item);
        }
      }
    });

    return result;
  } catch (err) {
    return { error: err.message };
  }
}

function chuoiThanhDsSo_(v) {
  const s = String(v == null ? "" : v).trim();
  if (!s) return [];
  return s.split(",")
    .map(function (x) { return Number(String(x).trim()); })
    .filter(function (n) { return Number.isInteger(n) && n > 0; });
}

function ghiGhepCX5(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName("LSC5");
    if (!sh) sh = ss.insertSheet("LSC5");

    const sessionEntries = (payload && payload.sessionEntries) ? payload.sessionEntries : [];
    const groups = (payload && payload.groups) ? payload.groups : [];

    if (sessionEntries.length === 0 && groups.length === 0) {
      return { success: true, message: "Không có dữ liệu cần đồng bộ" };
    }

    // BƯỚC 1: Đọc blocks hiện có từ LSC5 ĐÚNG 1 LẦN DUY NHẤT
    const blocks = docCacKhoiLSC5_();
    const existingCounts = {};
    blocks.forEach(function (b) {
      const key = b.ngay + "|" + b.msp + "|" + b.bao + "|" + Math.round(b.kg * 100) / 100;
      existingCounts[key] = (existingCounts[key] || 0) + 1;
    });

    // BƯỚC 2: Gom TẤT CẢ các lot mới của mọi sessionEntries vào 1 matrix duy nhất
    const lotIdToRowMap = {};
    const bigMatrix = [];
    let currentRow = Math.max(sh.getLastRow() + 1, 3);
    const startRowGhi = currentRow;

    sessionEntries.forEach(function (se) {
      if (!se.lots) return;
      se.lots.forEach(function (lot) {
        const kgList = lot.kgList || [];
        if (kgList.length === 0) return;
        const lotBao = kgList.length;
        let lotKg = 0;
        kgList.forEach(function (v) { lotKg += (Number(v) || 0); });
        lotKg = Math.round(lotKg * 100) / 100;

        const checkKey = se.dateStr + "|" + se.msp + "|" + lotBao + "|" + lotKg;
        if (existingCounts[checkKey] > 0) {
          existingCounts[checkKey]--;
          return; // Đã có trong LSC5, bỏ qua chống trùng
        }

        const dongDauLot = currentRow;
        let dongCuoiLot = currentRow;
        const numChunks = Math.ceil(kgList.length / 12);
        let idx = 0;
        let chunkIdx = 0;
        let isFirst = true;

        while (idx < kgList.length) {
          chunkIdx++;
          const isLastChunk = (chunkIdx === numChunks);
          const chunk = kgList.slice(idx, idx + 12);

          // Hàng 20 cột (Cột 2 đến 21 trong Sheet LSC5)
          const rowData = new Array(20).fill("");
          if (isFirst) {
            rowData[0] = se.dateStr;
            rowData[1] = se.msp;
            rowData[2] = se.ten;
            isFirst = false;
          }
          for (let i = 0; i < 12; i++) {
            rowData[3 + i] = (chunk[i] !== undefined && chunk[i] !== null && chunk[i] !== "") ? chunk[i] : "";
          }
          if (isLastChunk) {
            rowData[16] = lotKg;         // Cột 18: Tổng KG
            rowData[18] = lotBao;        // Cột 20: Số bao
            rowData[19] = lotKg;         // Cột 21: Tổng KG hiệu lực
          }
          bigMatrix.push(rowData);
          dongCuoiLot = currentRow;
          idx += 12;
          currentRow++;
        }

        if (lot.lotId) {
          lotIdToRowMap[lot.lotId] = dongCuoiLot;
        }

        // Tạo block trực tiếp trong RAM - KHÔNG CẦN ĐỌC LẠI SHEET LẦN 2
        blocks.push({
          msp: String(se.msp || "").trim(),
          ten: String(se.ten || "").trim(),
          ngay: String(se.dateStr || "").trim(),
          bao: lotBao,
          kg: lotKg,
          baoGhep: null,
          kgGhep: null,
          baoHieuLuc: lotBao,
          kgHieuLuc: lotKg,
          daAn: false,
          w: "",
          rowDauTien: dongDauLot,
          rowCuoiCung: dongCuoiLot,
          daGhep: false
        });
      });
    });

    // TỐI ƯU TUYỆT ĐỐI: Ghi toàn bộ dữ liệu phiên hôm nay trong ĐÚNG 1 LẦN GỌI DUY NHẤT
    if (bigMatrix.length > 0) {
      sh.getRange(startRowGhi, 2, bigMatrix.length, 20).setValues(bigMatrix);
    }

    // Nếu không có khối ghép nào thì kết thúc ngay
    if (groups.length === 0) {
      return { success: true, message: "Đã ghi dữ liệu phiên vào Sheet LSC5 thành công" };
    }

    // BƯỚC 3: Ghép pallet (hoàn toàn tra cứu trên RAM, 0 lần đọc sheet)
    const blockByRowCuoi = {};
    blocks.forEach(function (b) {
      blockByRowCuoi[b.rowCuoiCung] = b;
    });

    groups.forEach(function (g) {
      if (g.lotIdNeo && lotIdToRowMap[g.lotIdNeo]) {
        g.rowNeo = lotIdToRowMap[g.lotIdNeo];
      }
      if (!g.rowNeo && g.key) {
        const parts = g.key.split("|");
        const msp = parts[0], ten = parts[1];
        const match = blocks.slice().reverse().find(function (b) {
          return b.msp === msp && b.ten === ten && (payload.dateStr ? b.ngay === payload.dateStr : true) && b.baoHieuLuc > 0 && (!g.baoNeo || b.baoHieuLuc === g.baoNeo) && (!g.kgNeo || Math.abs(b.kgHieuLuc - g.kgNeo) < 0.2);
        });
        if (match) g.rowNeo = match.rowCuoiCung;
      }
    });

    const rowsCu = [];
    groups.forEach(function (g) {
      (g.cuList || []).forEach(function (item) { rowsCu.push(Number(item.row)); });
    });
    if (new Set(rowsCu).size !== rowsCu.length) {
      return { success: false, message: "Một số dư đang được chọn ở nhiều khối" };
    }

    // Kiểm tra số dư cũ đã ghép chưa - kiểm tra hoàn toàn trên RAM không gọi API sheet
    for (let i = 0; i < rowsCu.length; i++) {
      const blk = blockByRowCuoi[rowsCu[i]];
      if (blk && blk.daAn) {
        return { success: false, message: "Một số dư đã được ghép hoặc đã hủy" };
      }
    }

    const xRowsList = [];
    groups.forEach(function (g) {
      if (g.rowNeo) {
        const blkNeo = blockByRowCuoi[g.rowNeo];
        const wHienCo = chuoiThanhDsSo_(blkNeo ? blkNeo.w : "");
        const wMoi = new Set(wHienCo);

        (g.cuList || []).forEach(function (item) {
          wMoi.add(Number(item.row));
          const blkCu = blockByRowCuoi[item.row];
          if (blkCu && blkCu.w) {
            chuoiThanhDsSo_(blkCu.w).forEach(function (r) { wMoi.add(r); });
          }
        });

        const vCell = (blkNeo && blkNeo.daAn) ? "X" : "";
        const wCell = (wMoi.size > 0) ? Array.from(wMoi).join(",") : (blkNeo ? blkNeo.w : "");

        if (blkNeo) {
          blkNeo.baoHieuLuc = g.tongBao;
          blkNeo.kgHieuLuc = g.tongKg;
          blkNeo.w = wCell;
        }

        // Ghi cột 20..23 (T, U, V, W) cho dòng neo trong 1 lần gọi
        sh.getRange(g.rowNeo, 20, 1, 4).setValues([[
          g.tongBao,
          Math.round(g.tongKg * 100) / 100,
          vCell,
          wCell
        ]]);
      }

      (g.cuList || []).forEach(function (item) {
        xRowsList.push("V" + item.row);
        const blkCu = blockByRowCuoi[item.row];
        if (blkCu) blkCu.daAn = true;
      });
    });

    // Đánh dấu X hàng loạt trong 1 lần gọi API duy nhất
    const uniqueXRows = Array.from(new Set(xRowsList));
    if (uniqueXRows.length > 0) {
      sh.getRangeList(uniqueXRows).setValue("X");
    }

    return { success: true, message: "Đã đồng bộ LSC5 thành công" };
  } catch (err) {
    return { success: false, message: "Lỗi: " + err.message };
  }
}

function layChiTietNguonGocCX5(payload) {
  try {
    const row = Number(payload && payload.row);
    if (!Number.isInteger(row) || row < 3) return { error: "Dòng không hợp lệ" };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetLSC5 = ss.getSheetByName("LSC5");
    if (!sheetLSC5) return { error: "Không tìm thấy sheet LSC5" };

    const dsDong = [row].concat(chuoiThanhDsSo_(sheetLSC5.getRange(row, 23).getValue()));

    // TỐI ƯU HÓA: Đọc toàn bộ vùng dữ liệu các dòng nguồn gốc trong 1 lần duy nhất
    let minRow = Math.min.apply(null, dsDong) - 20;
    if (minRow < 3) minRow = 3;
    const maxRow = Math.max.apply(null, dsDong);
    const numRows = maxRow - minRow + 1;
    const rangeData = sheetLSC5.getRange(minRow, 2, numRows, 15).getValues();

    const nguon = dsDong.map(function (r) {
      const idx = r - minRow;
      if (idx < 0 || idx >= rangeData.length) return { row: r, ngay: "", kgList: [] };

      let startIdx = idx;
      while (startIdx > 0) {
        const bVal = rangeData[startIdx - 1][0];
        if (bVal !== "" && bVal !== null) break;
        startIdx--;
      }

      const ngay = chuanHoaNgayLSC5_(rangeData[startIdx][0]);
      const kgList = [];
      for (let k = startIdx; k <= idx; k++) {
        const cells = rangeData[k].slice(3, 15);
        cells.forEach(function (v) {
          if (v !== "" && v !== null) kgList.push(Number(v) || 0);
        });
      }

      return { row: r, ngay: ngay, kgList: kgList };
    });

    return { nguon: nguon };
  } catch (err) {
    return { error: err.message };
  }
}

function xoaUngVienGhepCX5(payload) {
  try {
    const row = Number(payload && payload.row);
    if (!Number.isInteger(row) || row < 3) return { success: false, message: "Dòng dữ liệu không hợp lệ" };
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("LSC5");
    if (!sh) return { success: false, message: "Không tìm thấy sheet LSC5" };
    sh.getRange(row, 22).setValue("X");
    return { success: true };
  } catch (err) {
    return { success: false, message: "Lỗi: " + err.message };
  }
}

function formatNgayNganLSC5_(dStr) {
  const s = String(dStr == null ? "" : dStr).trim();
  if (!s) return "";
  let p = s.split("-");
  if (p.length === 3) {
    if (p[0].length === 4) return p[2].padStart(2, "0") + "/" + p[1].padStart(2, "0");
    return p[0].padStart(2, "0") + "/" + p[1].padStart(2, "0");
  }
  p = s.split("/");
  if (p.length >= 2) {
    if (p[0].length === 4) return p[2].padStart(2, "0") + "/" + p[1].padStart(2, "0");
    return p[0].padStart(2, "0") + "/" + p[1].padStart(2, "0");
  }
  return s;
}

function formatNgayDayDuLSC5_(dVal) {
  if (!dVal) {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  if (dVal instanceof Date) {
    return Utilities.formatDate(dVal, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  const s = String(dVal).trim();
  const p = s.split("-");
  if (p.length === 3 && p[0].length === 4) {
    return p[2].padStart(2, "0") + "/" + p[1].padStart(2, "0") + "/" + p[0];
  }
  return s;
}

function isCellToMauXuatLSC5_(bg) {
  if (!bg) return false;
  const c = String(bg).trim().toLowerCase();
  if (!c || c === "#ffffff" || c === "#fff" || c === "white" || c === "transparent") return false;
  // Chỉ nhận diện dương tính các màu vàng/cam xuất kho (bỏ qua màu xen kẽ xám/xanh Zebra stripes)
  const exportColors = [
    "#fde68a", "#fef08a", "#ffff00", "#fff2cc", "#ffe599", "#ffd966",
    "#fce5cd", "#f9cb9c", "#ffeb3b", "#ffee58", "#fff176", "#fef9c3",
    "#fef3c7", "#f59e0b", "#fbbf24", "#d97706", "#ffc000", "#e69138"
  ];
  return exportColors.indexOf(c) !== -1;
}

function docChiTietKhoiLSC5ChoXuat_(sh) {
  const blocks = [];
  if (!sh) return { blocks: blocks, blockByRowCuoi: {} };

  const lastRow = sh.getLastRow();
  if (lastRow < 3) return { blocks: blocks, blockByRowCuoi: {} };

  const numRows = lastRow - 3 + 1;
  // Cột 2 (B) -> Cột 27 (AA): 26 cột
  const data = sh.getRange(3, 2, numRows, 26).getValues();
  // Đọc màu nền vùng bao lẻ Cột 5 (E) -> Cột 16 (P): 12 cột
  const bgs = sh.getRange(3, 5, numRows, 12).getBackgrounds();

  let cur = null;
  let curNgay = "";

  function dongLai() {
    if (cur) {
      cur.baoHieuLuc = cur.baoGhep != null ? cur.baoGhep : cur.bao;
      cur.kgHieuLuc = cur.kgGhep != null ? cur.kgGhep : cur.kg;
      blocks.push(cur);
    }
    cur = null;
  }

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const rowBg = bgs[i] || [];
    const rowNum = 3 + i;
    let ngayRaw = r[0];
    const msp = r[1];
    const qc = r[2];

    if (ngayRaw !== "" && ngayRaw !== null) {
      curNgay = ngayRaw;
    } else if ((msp !== "" && msp !== null) || (qc !== "" && qc !== null)) {
      ngayRaw = curNgay;
    }

    const ngayChuan = chuanHoaNgayLSC5_(ngayRaw || curNgay);
    const ngayNgan = formatNgayNganLSC5_(ngayChuan);

    const rowBagCells = [];
    for (let cIdx = 0; cIdx < 12; cIdx++) {
      const v = r[3 + cIdx];
      if (v !== "" && v !== null) {
        const kgVal = Math.round((Number(v) || 0) * 100) / 100;
        if (kgVal > 0) {
          rowBagCells.push({
            row: rowNum,
            col: 5 + cIdx,
            kg: kgVal,
            daXuat: isCellToMauXuatLSC5_(rowBg[cIdx]),
            ngay: ngayChuan,
            ngayNgan: ngayNgan
          });
        }
      }
    }

    const soBaoDong = rowBagCells.length;
    const tongCell = r[16];
    const baoGhepCell = r[18];
    const kgGhepCell = r[19];
    const anCell = r[20];
    const wCell = r[21];
    const xCell = r[22];
    const yCell = r[23];
    const zCell = r[24];
    const aaCell = r[25];

    if ((msp !== "" && msp !== null) || (qc !== "" && qc !== null)) {
      dongLai();
      cur = {
        msp: String(msp == null ? "" : msp).trim(),
        ten: String(qc == null ? "" : qc).trim(),
        ngay: ngayChuan,
        ngayNgan: ngayNgan,
        bao: soBaoDong,
        kg: 0,
        baoGhep: null,
        kgGhep: null,
        daAn: false,
        w: "",
        trangThaiX: "",
        ngayXuatY: "",
        loaiXuatZ: "",
        tonAA: "",
        rowDauTien: rowNum,
        rowCuoiCung: rowNum,
        ownBagCells: rowBagCells.slice()
      };
    } else if (cur) {
      cur.bao += soBaoDong;
      for (let bIdx = 0; bIdx < rowBagCells.length; bIdx++) {
        cur.ownBagCells.push(rowBagCells[bIdx]);
      }
    }

    if (cur) {
      if (tongCell !== "" && tongCell !== null) {
        cur.kg = Number(tongCell) || 0;
        cur.rowCuoiCung = rowNum;
      }
      if (baoGhepCell !== "" && baoGhepCell !== null) cur.baoGhep = Number(baoGhepCell) || 0;
      if (kgGhepCell !== "" && kgGhepCell !== null) cur.kgGhep = Number(kgGhepCell) || 0;
      if (String(anCell == null ? "" : anCell).trim().toUpperCase() === "X") cur.daAn = true;
      if (wCell !== "" && wCell !== null) cur.w = String(wCell).trim();
      if (xCell !== "" && xCell !== null) cur.trangThaiX = String(xCell).trim().toUpperCase();
      if (yCell !== "" && yCell !== null) cur.ngayXuatY = chuanHoaNgayLSC5_(yCell);
      if (zCell !== "" && zCell !== null) cur.loaiXuatZ = String(zCell).trim();
      if (aaCell !== "" && aaCell !== null) cur.tonAA = String(aaCell).trim();
    }
  }
  dongLai();

  const blockByRowCuoi = {};
  blocks.forEach(function (b) {
    blockByRowCuoi[b.rowCuoiCung] = b;
  });

  // Liên kết toàn bộ bao lẻ (bao gồm cả các dòng cũ đã ghép trong cột W)
  blocks.forEach(function (b) {
    const allCells = b.ownBagCells.slice();
    if (b.w) {
      const dsCu = chuoiThanhDsSo_(b.w);
      dsCu.forEach(function (rCu) {
        const blkCu = blockByRowCuoi[rCu];
        if (blkCu && blkCu.ownBagCells) {
          blkCu.ownBagCells.forEach(function (cell) {
            allCells.push(cell);
          });
        }
      });
    }
    b.allBagCells = allCells;
  });

  return { blocks: blocks, blockByRowCuoi: blockByRowCuoi };
}

function layTonChuaXuatLSC5(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("LSC5");
    if (!sh) return { success: true, itemsByMsp: {} };

    const targetMsp = (payload && payload.msp) ? String(payload.msp).trim() : "";
    const parsed = docChiTietKhoiLSC5ChoXuat_(sh);
    const blocks = parsed.blocks;
    const itemsByMsp = {};

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const itemKey = b.msp || b.ten;
      if (!itemKey) continue;
      if (targetMsp && b.msp !== targetMsp && b.ten !== targetMsp) continue;
      // Bỏ qua các dòng đã ghép/ẩn (cột V = X) hoặc đã xuất hết (cột X = ĐÃ XUẤT)
      if (b.daAn) continue;
      if (b.trangThaiX === "ĐÃ XUẤT" || b.trangThaiX === "DA XUAT") continue;

      const allCells = b.allBagCells || [];
      const unexportedBags = allCells.filter(function (c) { return !c.daXuat; });

      let conBao = 0;
      let conKg = 0;

      if (allCells.length > 0) {
        if (unexportedBags.length === 0) continue; // Tất cả các ô E-P đều đã tô màu xuất
        if (unexportedBags.length === allCells.length && b.trangThaiX !== "CÒN" && b.baoHieuLuc > 0 && b.kgHieuLuc > 0) {
          conBao = b.baoHieuLuc;
          conKg = Math.round(b.kgHieuLuc * 100) / 100;
        } else {
          conBao = unexportedBags.length;
          conKg = Math.round(unexportedBags.reduce(function (s, c) { return s + c.kg; }, 0) * 100) / 100;
        }
      } else {
        if (b.baoHieuLuc <= 0 || b.kgHieuLuc <= 0) continue;
        conBao = b.baoHieuLuc;
        conKg = Math.round(b.kgHieuLuc * 100) / 100;
      }

      if (conBao <= 0 || conKg <= 0) continue;

      if (!itemsByMsp[itemKey]) itemsByMsp[itemKey] = [];
      itemsByMsp[itemKey].push({
        row: b.rowCuoiCung,
        msp: b.msp || b.ten,
        ten: b.ten,
        ngay: b.ngay,
        ngayNgan: b.ngayNgan,
        bao: conBao,
        kg: conKg,
        trangThai: b.trangThaiX || "",
        bags: unexportedBags.map(function (c) {
          return {
            row: c.row,
            col: c.col,
            kg: c.kg,
            ngayNgan: c.ngayNgan || b.ngayNgan
          };
        })
      });
    }

    return { success: true, itemsByMsp: itemsByMsp };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function danhDauXuatLSC5NoLock_(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("LSC5");
  if (!sh) return { success: false, message: "Không tìm thấy sheet LSC5" };

  const marks = (payload && payload.marks) ? payload.marks : [];
  if (!Array.isArray(marks) || marks.length === 0) {
    return { success: true, count: 0 };
  }

  const defaultNgay = formatNgayDayDuLSC5_(payload && payload.dateStr);
  const defaultLoai = String((payload && payload.loaiText) || "Đã xuất").trim();

  const parsed = docChiTietKhoiLSC5ChoXuat_(sh);
  const blockByRowCuoi = parsed.blockByRowCuoi;

  const affectedLotRows = {};
  const cellsToColor = [];

  for (let i = 0; i < marks.length; i++) {
    const m = marks[i];
    if (!m) continue;
    const mNgay = m.ngayXuat ? formatNgayDayDuLSC5_(m.ngayXuat) : defaultNgay;
    const mLoai = String(m.loaiText || defaultLoai).trim();

    if (m.type === "BAG") {
      const lotRow = Number(m.lotRow || m.row);
      const bagRow = Number(m.bagRow || m.row);
      const bagCol = Number(m.bagCol || m.col);
      if (Number.isInteger(bagRow) && bagRow >= 3 && Number.isInteger(bagCol) && bagCol >= 5 && bagCol <= 16) {
        const colLetter = String.fromCharCode(64 + bagCol); // 5 -> E, 16 -> P
        cellsToColor.push(colLetter + bagRow);
      }
      if (Number.isInteger(lotRow) && lotRow >= 3) {
        const blk = blockByRowCuoi[lotRow];
        if (blk && blk.allBagCells) {
          const targetCell = blk.allBagCells.find(function (c) {
            return c.row === bagRow && c.col === bagCol && !c.daXuat;
          });
          if (targetCell) targetCell.daXuat = true;
        }
        affectedLotRows[lotRow] = { mode: "RECALC", ngay: mNgay, loai: mLoai };
      }
    } else {
      // Nguyên lô (LOT)
      const lotRow = Number(m.row || m.lotRow);
      if (Number.isInteger(lotRow) && lotRow >= 3) {
        affectedLotRows[lotRow] = { mode: "FULL", ngay: mNgay, loai: mLoai };
        const blk = blockByRowCuoi[lotRow];
        if (blk && blk.allBagCells) {
          blk.allBagCells.forEach(function (c) {
            if (!c.daXuat && c.col >= 5 && c.col <= 16) {
              const colLetter = String.fromCharCode(64 + c.col);
              cellsToColor.push(colLetter + c.row);
              c.daXuat = true;
            }
          });
        }
      }
    }
  }

  // Tô màu các ô bao lẻ đã xuất trong 1 lần gọi RangeList
  if (cellsToColor.length > 0) {
    const uniqueCells = Array.from(new Set(cellsToColor));
    sh.getRangeList(uniqueCells).setBackground("#fde68a");
  }

  // Cập nhật các cột X (24), Y (25), Z (26), AA (27) cho từng lô bị ảnh hưởng
  const lotRowKeys = Object.keys(affectedLotRows);
  for (let k = 0; k < lotRowKeys.length; k++) {
    const lRow = Number(lotRowKeys[k]);
    const info = affectedLotRows[lRow];
    const blk = blockByRowCuoi[lRow];

    if (info.mode === "FULL") {
      sh.getRange(lRow, 24, 1, 4).setValues([["ĐÃ XUẤT", info.ngay, info.loai, ""]]);
    } else if (blk) {
      const remaining = (blk.allBagCells || []).filter(function (c) { return !c.daXuat; });
      const conBao = remaining.length;
      const conKg = Math.round(remaining.reduce(function (s, c) { return s + c.kg; }, 0) * 100) / 100;
      if (conBao <= 0 || conKg <= 0) {
        sh.getRange(lRow, 24, 1, 4).setValues([["ĐÃ XUẤT", info.ngay, info.loai, ""]]);
      } else {
        sh.getRange(lRow, 24, 1, 4).setValues([["CÒN", info.ngay, info.loai, conKg + "(" + conBao + ")"]]);
      }
    }
  }

  return { success: true, count: marks.length };
}

function danhDauXuatLSC5(payload) {
  const lock = LockService.getDocumentLock();
  try {
    lock.waitLock(30000);
    return danhDauXuatLSC5NoLock_(payload);
  } catch (err) {
    return { success: false, message: "Lỗi đánh dấu LSC5: " + err.message };
  } finally {
    try { lock.releaseLock(); } catch (eLock) {}
  }
}
