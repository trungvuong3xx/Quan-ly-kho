// ============================================================================
// MODULE 00: CẤU HÌNH CHUNG & ROUTER ĐIỀU PHỐI API (doPost)
// ============================================================================

const CONFIG = {
  LIST_SHEET_NAME: 'LIST',
  LIST_COL_TEN: 1,
  LIST_COL_MSP: 2,
  LIST_COL_SOLAN_THUONG: 3,
  LIST_COL_SOLAN_FOR: 4,
  LIST_START_ROW: 2,
  MSP_COL_IN_MONTH_SHEET: 7,
  AF_COL_INDEX: 32
};

const VUNG_THUONG_RANGES = [[6, 543], [637, 644]];
const VUNG_FOR_RANGES = [[544, 630]];

const LOAI_RULES = {
  NHAP_SX:      { offset: 0, suffix: 0, ranges: VUNG_THUONG_RANGES },
  NHAP_TRA:     { offset: 0, suffix: 1, ranges: VUNG_THUONG_RANGES, dynamicVung: true },
  NHAP_FOR:     { offset: 0, suffix: 0, ranges: VUNG_FOR_RANGES },
  XUAT_SX:      { offset: 2, suffix: 0, dynamicVung: true },
  XUAT_TRA:     { offset: 2, suffix: 1, dynamicVung: true },
  XUAT_GIACONG: { offset: 2, suffix: 2, dynamicVung: true },
  XUAT_PHE:     { offset: 2, suffix: 3, dynamicVung: true },
  XUAT_BAN:     { offset: 2, suffix: 4, dynamicVung: true },
  XUAT_BT:      { offset: 4, suffix: 0, dynamicVung: true },
  XUAT_FOR:     { offset: 6, suffix: 0, dynamicVung: true }
};

const MUTATING_ACTIONS_CX5_ = {
  submitEntryX5: true,
  batchSubmitEntryX5: true,
  ghiGhepCX5: true,
  xoaUngVienGhepCX5: true,
  danhDauXuatLSC5: true
};

function kiemTraTokenTuyChonCX5_(body) {
  try {
    const requiredToken = PropertiesService.getScriptProperties().getProperty('APP_API_TOKEN');
    if (!requiredToken) return true; // Tương thích ngược: chưa cấu hình token thì cho qua
    return body && body.appToken === requiredToken;
  } catch (e) {
    return true;
  }
}

function doPost(e) {
  let result;
  try {
    const body = JSON.parse(e.postData.contents);
    if (!kiemTraTokenTuyChonCX5_(body)) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "Thiếu hoặc sai mã xác thực truy cập (appToken)"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Chống ghi trùng (Idempotency) trong 10 phút khi client gửi lại do timeout 4G
    const isMutating = !!MUTATING_ACTIONS_CX5_[body.action];
    const reqId = (isMutating && body.requestId) ? ("idem_cx5_" + String(body.requestId).slice(0, 80)) : "";
    let cache = null;
    if (reqId) {
      try {
        cache = CacheService.getScriptCache();
        const cached = cache.get(reqId);
        if (cached) {
          return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
        }
      } catch (eCache) { cache = null; }
    }

    switch (body.action) {
      case "khoiTaoForm":
        result = khoiTaoForm(body.dateStr, body.forceRefresh);
        break;
      case "submitEntryX5":
        result = submitEntryX5(body.payload);
        break;
      case "batchSubmitEntryX5":
        result = batchSubmitEntryX5(body.payload);
        break;
      case "layUngVienGhepCX5":
        result = layUngVienGhepCX5(body.payload);
        break;
      case "ghiGhepCX5":
        result = ghiGhepCX5(body.payload);
        break;
      case "xoaUngVienGhepCX5":
        result = xoaUngVienGhepCX5(body.payload);
        break;
      case "layChiTietNguonGocCX5":
        result = layChiTietNguonGocCX5(body.payload);
        break;
      case "layDanhSachSanPhamTonKhoCX5":
        result = layDanhSachSanPhamTonKhoCX5();
        break;
      case "layTonKhoCX5":
        result = layTonKhoCX5(body.payload);
        break;
      case "layTonChuaXuatLSC5":
        result = layTonChuaXuatLSC5(body.payload);
        break;
      case "danhDauXuatLSC5":
        result = danhDauXuatLSC5(body.payload);
        break;
      default:
        result = { success: false, message: "Action không hợp lệ: " + body.action };
    }

    if (reqId && cache && result && result.success !== false && !result.error) {
      try { cache.put(reqId, JSON.stringify(result), 600); } catch (ePut) {}
    }
  } catch (err) {
    result = { success: false, message: "Lỗi server: " + err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
