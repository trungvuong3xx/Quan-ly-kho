// ── Quản lý Thành Phẩm (TP) v20261120 ─────────────────────────────────────────
// Tuân thủ kiến trúc mô-đun chuẩn btp.js, tem 5 dòng, xuất Excel 2 cột,
// bảng tổng hợp bỏ chữ "bao" và "kg", lưu phiên dở dang và lịch sử 30 ngày.

let zxingReaderTP = null;
let dangQuetTP = false;
let phienTP = [];
let tapMaDaQuetTP = new Set(); // Bộ nhớ chống trùng trong phiên theo ID Dòng 1
let demSoDotTP = 1;
let denPinBatTP = false;
let ngayTP = null;
let phienSoTP = 1;
let idPhienHienTaiTP = null;
let maQRVuaQuetTP = "";
let daXuatExcelTP = false;
let revisionTP = 0;
let capNhatLucTP = null;
let dangKhoiTaoCamTP = false;

const TP_LICHSU_KEY = "tp_lich_su";
const TP_LICHSU_SO_NGAY_GIU = 30;
const TP_DODANG_KEY = "tp_phien_dodang";

var SVG_SHUTTER_PAUSE = window.SVG_SHUTTER_PAUSE || '<svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff"><rect x="6" y="4" width="4" height="16" rx="2" /><rect x="14" y="4" width="4" height="16" rx="2" /></svg>';
var SVG_SHUTTER_PLAY = window.SVG_SHUTTER_PLAY || '<svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff" style="margin-left:2px;"><path d="M8 5v14l11-7z" /></svg>';

// ── Hàm tiện ích ngày giờ địa phương (chuẩn GMT+7 Việt Nam) ──
function layNgayHomNayTP() {
  if (typeof window.layNgayHomNayLocal === "function") {
    return window.layNgayHomNayLocal();
  }
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const localDate = new Date(now.getTime() - offset);
  return localDate.toISOString().split("T")[0];
}

function layThoiGianHienTaiTP() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

// ── Escape HTML chống mã độc XSS & vỡ giao diện ──
function anToanHtmlTP(str) {
  if (typeof window.escapeHtml === "function") {
    return window.escapeHtml(str);
  }
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function anToanCongThucExcel(str) {
  if (str === null || str === undefined) return "";
  const s = String(str);
  if (/^[=+\-@\t\r]/.test(s)) {
    return "'" + s;
  }
  return s;
}

// ── Xử lý số khối lượng chính xác (parseKgTP & formatKgTP) ──
function parseKgTP(str) {
  if (!str || typeof str !== 'string') return null;
  const clean = str.trim().replace(',', '.');
  if (!/^[\d]+(?:\.\d{1,4})?$/.test(clean)) return null;
  const num = parseFloat(clean);
  if (isNaN(num) || !Number.isFinite(num) || num <= 0) return null;
  return num;
}

function formatKgTP(num) {
  if (num === null || num === undefined || isNaN(num)) return "0.0";
  let s = Number(num).toFixed(4);
  s = s.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0000$/, ".0");
  if (!s.includes('.')) s += ".0";
  return s;
}

// ── Bóc tách & Thẩm định tem Thành Phẩm 5 dòng ──
function xuLyDuLieuQRTP(text) {
  if (!text) return null;
  const rawQR = String(text).trim();
  if (!rawQR) return null;

  const lines = rawQR.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length !== 5) return null;

  const id = lines[0];
  const maKien = lines[1];
  const pcsStr = lines[2];
  const tenHang = lines[3];
  const dong5 = lines[4];

  if (!id || !maKien || !/^\d+$/.test(pcsStr) || !tenHang) return null;
  const pcs = parseInt(pcsStr, 10);

  // Dòng 5: Quy cách đủ (phải chứa chữ x/X) & Khối lượng (>0)
  const matchD5 = dong5.match(/^(.+?)\s+([\d]+(?:[.,]\d{1,4})?)\s*$/);
  if (!matchD5) return null;

  const qcDu = matchD5[1].trim();
  if (!/[xX]/.test(qcDu)) return null;

  const kg = parseKgTP(matchD5[2]);
  if (kg === null) return null;

  return {
    id: id,
    maKien: maKien,
    pcs: pcs,
    tenHang: tenHang,
    qcDu: qcDu,
    kg: kg,
    rawQR: rawQR
  };
}
window.xuLyDuLieuQRTP = xuLyDuLieuQRTP;

// ── Hiệu ứng viền phản hồi camera ──
function hienVienFeedbackTP(loai) {
  const overlay = document.getElementById("tp-cam-flash-overlay");
  if (overlay) {
    overlay.className = "cam-flash-overlay flash-" + loai;
    setTimeout(() => {
      overlay.className = "cam-flash-overlay";
    }, 280);
  }
  if (typeof hienVienFeedbackCamera === "function") {
    try { hienVienFeedbackCamera("tp-video-box", loai); } catch (e) { }
  }
}
window.hienVienFeedbackTP = hienVienFeedbackTP;

// ── Tiếp nhận mã quét từ Camera hoặc Trình phát hiện ──
const mapKhoaTP = new Map();
function donDepMapKhoaTP() {
  if (mapKhoaTP.size > 200) {
    const now = Date.now();
    for (const [key, timestamp] of mapKhoaTP.entries()) {
      if (now - timestamp > 5000) mapKhoaTP.delete(key);
    }
  }
}

function khiQuetDuocMaTP(res) {
  const rawText = (typeof res === 'object' && res && typeof res.getText === 'function')
    ? res.getText()
    : String(res || '');
  if (!rawText.trim() || !dangQuetTP) return;

  // Chống nháy mã quá nhanh
  const khoaTime = mapKhoaTP.get(rawText);
  if (khoaTime && Date.now() < khoaTime) return;

  const data = xuLyDuLieuQRTP(rawText);
  if (!data) {
    mapKhoaTP.set(rawText, Date.now() + 1500);
    hienVienFeedbackTP("error");
    if (typeof window.phatVibrateError === "function") window.phatVibrateError();
    showCanhBaoTP("Mã không đúng định dạng tem Thành Phẩm (5 dòng)!", "error");
    return;
  }

  themMaVaoPhienTP(data, rawText, 'cam_auto');
}
window.khiQuetDuocMaTP = khiQuetDuocMaTP;

// ── Thêm mã vào phiên quét ──
function themMaVaoPhienTP(data, rawText, src) {
  if (!data || !data.rawQR) return false;

  const elCheck = document.getElementById("tp-cho-phep-trung-cam");
  const choPhepTrung = elCheck ? elCheck.checked : false;

  const keyID = data.id;
  const isDuplicate = tapMaDaQuetTP.has(keyID);

  if (!choPhepTrung && isDuplicate) {
    hienVienFeedbackTP("duplicate");
    if (typeof window.phatVibrateError === "function") window.phatVibrateError();

    const oldItem = phienTP.find(it => it.id === keyID);
    const gioQuet = oldItem && oldItem.thoiGian ? (" (" + oldItem.thoiGian.split(" ")[1] + ")") : "";
    showCanhBaoTP("Mã " + keyID + " đã quét" + gioQuet, "error");

    if (src === 'cam_auto') {
      mapKhoaTP.set(data.rawQR, Date.now() + 1500);
    }
    return false;
  }

  // Quét hợp lệ
  hienVienFeedbackTP("success");
  if (typeof window.phatTiengBip === "function") {
    window.phatTiengBip();
  } else if (navigator.vibrate) {
    try { navigator.vibrate(70); } catch (e) { }
  }

  tapMaDaQuetTP.add(keyID);
  daXuatExcelTP = false;
  revisionTP++;
  capNhatLucTP = new Date().toISOString();

  const uid = "tp_item_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
  const newItem = {
    uid: uid,
    id: data.id,
    maKien: data.maKien,
    pcs: data.pcs,
    tenHang: data.tenHang,
    qcDu: data.qcDu,
    kg: data.kg,
    thoiGian: layThoiGianHienTaiTP(),
    rawQR: data.rawQR,
    dotQuet: demSoDotTP || 1
  };

  phienTP.push(newItem);

  const demEl = document.getElementById("tp-dem");
  if (demEl) demEl.textContent = "Đã quét: " + phienTP.length + " mã";

  luuPhienDoDangTP();
  luuVaoLichSuTPDebounced();
  capNhatLogTPThemMoi(newItem);

  maQRVuaQuetTP = data.id || data.rawQR || "";
  const lockStatusEl = document.getElementById("tp-lock-status");
  if (lockStatusEl) {
    lockStatusEl.textContent = maQRVuaQuetTP;
    lockStatusEl.title = maQRVuaQuetTP;
  }

  donDepMapKhoaTP();
  return true;
}

// ── Nhập thủ công mã QR TP ──
function toggleNhapTayTP() {
  const chipMode = document.getElementById("tp-chip-mode");
  const inputMode = document.getElementById("tp-input-mode");
  const btnKeyboard = document.getElementById("btn-toggle-banphim-tp");
  const inputField = document.getElementById("tp-manual-input-cam");
  if (!chipMode || !inputMode) return;

  const isInputOpen = inputMode.style.display !== "none";
  if (isInputOpen) {
    dongNhapTayTP();
  } else {
    chipMode.style.display = "none";
    inputMode.style.display = "flex";
    if (btnKeyboard) btnKeyboard.classList.add("active-mode");
    if (inputField) {
      inputField.value = "";
      setTimeout(() => inputField.focus(), 80);
    }
  }
}
window.toggleNhapTayTP = toggleNhapTayTP;

function dongNhapTayTP() {
  const chipMode = document.getElementById("tp-chip-mode");
  const inputMode = document.getElementById("tp-input-mode");
  const btnKeyboard = document.getElementById("btn-toggle-banphim-tp");
  const inputField = document.getElementById("tp-manual-input-cam");
  if (inputMode) inputMode.style.display = "none";
  if (chipMode) chipMode.style.display = "flex";
  if (btnKeyboard) btnKeyboard.classList.remove("active-mode");
  if (inputField) inputField.value = "";
}
window.dongNhapTayTP = dongNhapTayTP;

function nhapThuCongTP() {
  const el = document.getElementById("tp-manual-input-cam");
  if (!el) return;
  const rawText = el.value.trim();
  if (!rawText) {
    showCanhBaoTP("Vui lòng nhập hoặc dán mã tem Thành Phẩm!", "warning");
    return;
  }

  const data = xuLyDuLieuQRTP(rawText);
  if (!data) {
    showCanhBaoTP("Mã không đúng định dạng tem Thành Phẩm (5 dòng)!", "error");
    return;
  }

  const thanhCong = themMaVaoPhienTP(data, rawText, 'manual');
  if (thanhCong) {
    el.value = "";
    dongNhapTayTP();
    showCanhBaoTP("Đã thêm: " + data.id, "success");
  }
}
window.nhapThuCongTP = nhapThuCongTP;

// ── Quản lý Accordion Live Log & Bảng Kết Quả ──
window.expandedTPGroupsLog = window.expandedTPGroupsLog || new Set();
window.expandedTPGroupsKq = window.expandedTPGroupsKq || new Set();
window.tempSearchCollapsedTP = window.tempSearchCollapsedTP || new Set();

function taoKhoaNhomTP(r) {
  if (!r || !r.qcDu) return "KHÁC";
  return String(r.qcDu).trim().replace(/\s+/g, " ") || "KHÁC";
}

function layDanhSachItemTheoNhomTP(groupKey, context) {
  let source = phienTP.slice();
  if (context === "kq") {
    const oTim = document.getElementById("tp-ketqua-search");
    const tuKhoa = oTim ? oTim.value.trim().toLowerCase() : "";
    if (tuKhoa) {
      source = source.filter(r =>
        (r.id && r.id.toLowerCase().includes(tuKhoa)) ||
        (r.qcDu && r.qcDu.toLowerCase().includes(tuKhoa)) ||
        (r.maKien && r.maKien.toLowerCase().includes(tuKhoa)) ||
        (r.tenHang && r.tenHang.toLowerCase().includes(tuKhoa))
      );
    }
  } else {
    source = source.slice(-30);
  }
  return source.filter(it => taoKhoaNhomTP(it) === groupKey);
}

function taoHtmlSubItemsTP(items) {
  return (items || []).map((it, subIdx) => {
    const timePart = it.thoiGian && it.thoiGian.includes(" ") ? it.thoiGian.split(" ")[1] : "";
    const subGio = timePart ? timePart.slice(0, 5) : "";
    const subKg = formatKgTP(it.kg);
    const safeIdCode = anToanHtmlTP(it.id);
    const safeUid = anToanHtmlTP(it.uid || ("idx_" + subIdx));

    return `<div class="tp-sub-item">
      <span class="tp-sub-stt">${subIdx + 1}</span>
      <span class="tp-sub-id">${safeIdCode}</span>
      <span class="tp-sub-gio">${subGio}</span>
      <span class="tp-sub-kg">${subKg}</span>
      <button type="button" class="tp-sub-del-btn" onclick="xoaMaTP('${safeUid}', event)" title="Xóa mã này">
        <i class="ti ti-x"></i>
      </button>
    </div>`;
  }).join("");
}

function toggleChiTietTPGroup(groupKey, context) {
  const ctx = context === "kq" ? "kq" : "log";
  const oTim = ctx === "kq" ? document.getElementById("tp-ketqua-search") : null;
  const coTuKhoa = !!(oTim && oTim.value.trim().length > 0);
  const safeId = 'tp-grp-' + btoa(encodeURIComponent(groupKey)).replace(/[^a-zA-Z0-9]/g, '');
  const detailsEl = document.getElementById(`details-${ctx}-${safeId}`);
  const chevEl = document.getElementById(`chev-${ctx}-${safeId}`);

  let isOpen = false;
  if (ctx === "kq" && coTuKhoa) {
    if (window.tempSearchCollapsedTP.has(groupKey)) {
      window.tempSearchCollapsedTP.delete(groupKey);
      isOpen = true;
    } else {
      window.tempSearchCollapsedTP.add(groupKey);
      isOpen = false;
    }
  } else {
    const targetSet = ctx === "kq" ? window.expandedTPGroupsKq : window.expandedTPGroupsLog;
    if (targetSet.has(groupKey)) {
      targetSet.delete(groupKey);
      isOpen = false;
    } else {
      targetSet.add(groupKey);
      isOpen = true;
    }
  }

  if (detailsEl && chevEl) {
    if (isOpen && detailsEl.innerHTML.trim() === "") {
      const items = layDanhSachItemTheoNhomTP(groupKey, ctx);
      detailsEl.innerHTML = taoHtmlSubItemsTP(items);
    }
    detailsEl.style.display = isOpen ? 'block' : 'none';
    chevEl.style.transform = isOpen ? 'rotate(180deg)' : 'none';
  } else if (ctx === "log") {
    capNhatLogTP();
  }
}
window.toggleChiTietTPGroup = toggleChiTietTPGroup;

function onTapRowTP(elOrKey, event) {
  const content = (event && event.currentTarget) ? event.currentTarget : (elOrKey && elOrKey.classList ? elOrKey : null);
  if (content && content.classList.contains('swiped')) {
    content.style.transform = 'translateX(0px)';
    content.classList.remove('swiped');
    return;
  }
  let groupKey = "";
  let context = "log";
  if (content && content.getAttribute) {
    const b64 = content.getAttribute("data-group-key");
    context = content.getAttribute("data-context") || "log";
    if (b64) {
      try { groupKey = decodeURIComponent(atob(b64)); } catch (e) { groupKey = b64; }
    }
  } else if (typeof elOrKey === "string") {
    groupKey = elOrKey;
  }
  if (groupKey) toggleChiTietTPGroup(groupKey, context);
}
window.onTapRowTP = onTapRowTP;

function xoaNhomTPByB64(keyB64, ev) {
  if (ev) ev.stopPropagation();
  let targetKey = "";
  try {
    targetKey = decodeURIComponent(atob(keyB64));
  } catch (e) {
    targetKey = keyB64;
  }
  xoaNhomTP(targetKey, ev);
}
window.xoaNhomTPByB64 = xoaNhomTPByB64;

function xoaNhomTP(key, ev) {
  if (ev) ev.stopPropagation();
  const targetKey = String(key || '');
  const itemsInGroup = phienTP.filter(item => taoKhoaNhomTP(item) === targetKey);
  const count = itemsInGroup.length;
  if (count === 0) return;

  const doXoa = () => {
    // Xóa khỏi Set chống trùng
    itemsInGroup.forEach(it => tapMaDaQuetTP.delete(it.id));
    phienTP = phienTP.filter(item => taoKhoaNhomTP(item) !== targetKey);
    window.expandedTPGroupsLog.delete(targetKey);
    window.expandedTPGroupsKq.delete(targetKey);
    window.tempSearchCollapsedTP.delete(targetKey);

    daXuatExcelTP = false;
    revisionTP++;
    capNhatLucTP = new Date().toISOString();

    luuPhienDoDangTPNgay();
    luuVaoLichSuTP();
    capNhatLogTP();

    const lastItem = phienTP.length > 0 ? phienTP[phienTP.length - 1] : null;
    maQRVuaQuetTP = lastItem ? lastItem.id : "";
    const lockStatusEl = document.getElementById("tp-lock-status");
    if (lockStatusEl) {
      lockStatusEl.textContent = maQRVuaQuetTP || "Chờ quét...";
      lockStatusEl.title = maQRVuaQuetTP || "";
    }
    const demEl = document.getElementById("tp-dem");
    if (demEl) demEl.textContent = "Đã quét: " + phienTP.length + " mã";

    if (document.getElementById("tp-ketqua") && document.getElementById("tp-ketqua").style.display !== "none") {
      locKetQuaTP();
    }
    showCanhBaoTP("Đã xóa nhóm QC", "info");
  };

  const tieuDe = count > 1 ? `Xóa toàn bộ ${count} bao của nhóm này?` : `Xóa mã này khỏi phiên quét?`;
  if (typeof moXacNhanApp === "function") {
    moXacNhanApp(tieuDe, doXoa, "Xóa", null, "Hủy", "Xóa nhóm TP");
  } else {
    doXoa();
  }
}
window.xoaNhomTP = xoaNhomTP;

function xoaMaTP(uid, ev) {
  if (ev) ev.stopPropagation();
  const targetUid = String(uid);
  const index = phienTP.findIndex(item => item.uid === targetUid);
  if (index < 0) return;

  const item = phienTP[index];
  const tenMa = item ? item.id : "mã này";
  const nhomKey = taoKhoaNhomTP(item);

  const doXoa = () => {
    if (item && item.id) tapMaDaQuetTP.delete(item.id);
    phienTP.splice(index, 1);

    // Nếu xóa mã cuối của nhóm -> dọn sạch khóa khỏi cả hai Set mở nhóm
    const conMaCungNhom = phienTP.some(it => taoKhoaNhomTP(it) === nhomKey);
    if (!conMaCungNhom) {
      window.expandedTPGroupsLog.delete(nhomKey);
      window.expandedTPGroupsKq.delete(nhomKey);
      window.tempSearchCollapsedTP.delete(nhomKey);
    }

    daXuatExcelTP = false;
    revisionTP++;
    capNhatLucTP = new Date().toISOString();

    luuPhienDoDangTPNgay();
    luuVaoLichSuTP();
    capNhatLogTP();

    const lastItem = phienTP.length > 0 ? phienTP[phienTP.length - 1] : null;
    maQRVuaQuetTP = lastItem ? lastItem.id : "";
    const lockStatusEl = document.getElementById("tp-lock-status");
    if (lockStatusEl) {
      lockStatusEl.textContent = maQRVuaQuetTP || "Chờ quét...";
      lockStatusEl.title = maQRVuaQuetTP || "";
    }
    const demEl = document.getElementById("tp-dem");
    if (demEl) demEl.textContent = "Đã quét: " + phienTP.length + " mã";

    if (document.getElementById("tp-ketqua") && document.getElementById("tp-ketqua").style.display !== "none") {
      locKetQuaTP();
    }
    showCanhBaoTP("Đã xóa mã " + tenMa, "info");
  };

  if (typeof moXacNhanApp === "function") {
    moXacNhanApp("Xóa mã " + tenMa + " khỏi phiên?", doXoa, "Xóa", null, "Hủy", "Xóa mã TP");
  } else {
    doXoa();
  }
}
window.xoaMaTP = xoaMaTP;

// ── Render Nhóm Dùng Chung cho Live Log & Bảng Kết Quả ──
function taoHtmlNhomTP(g, isFirst, context, coTuKhoa) {
  const ctx = context === "kq" ? "kq" : "log";
  const safeQC = anToanHtmlTP(g.qcDu);
  const keyB64 = btoa(encodeURIComponent(g.key));
  const safeId = 'tp-grp-' + keyB64.replace(/[^a-zA-Z0-9]/g, '');

  let isExpanded = false;
  if (ctx === "kq") {
    isExpanded = coTuKhoa ? !window.tempSearchCollapsedTP.has(g.key) : window.expandedTPGroupsKq.has(g.key);
  } else {
    isExpanded = window.expandedTPGroupsLog.has(g.key);
  }

  const countBadge = `<span class="tp-badge-bao">×${g.items.length}</span>`;
  const flashClass = (ctx === "log" && isFirst) ? ' scan-flash-new' : '';
  const kgText = formatKgTP(g.tongKg);
  const subItemsHtml = isExpanded ? taoHtmlSubItemsTP(g.items) : "";

  const swipeActions = `
      <div class="tp-swipe-actions">
        <button type="button" class="tp-swipe-btn-del" onclick="xoaNhomTPByB64('${keyB64}', event)" title="Xóa nhóm QC">
          <i class="ti ti-trash"></i>
          <span>Xóa</span>
        </button>
      </div>`;

  return `<div class="tp-swipe-container${flashClass}" data-group-key="${keyB64}">
    <div class="tp-swipe-row-wrap">
      <div class="tp-swipe-content" data-group-key="${keyB64}" data-context="${ctx}" onclick="onTapRowTP(this, event)">
        <div class="tp-group-row">
          <span class="tp-col-stt">${g.stt}</span>
          <span class="tp-col-qc" title="${safeQC}">${safeQC}</span>
          ${countBadge}
          <span class="tp-col-kg">${kgText}</span>
          <i id="chev-${ctx}-${safeId}" class="ti ti-chevron-down tp-chevron" style="transform:${isExpanded ? 'rotate(180deg)' : 'none'};"></i>
        </div>
      </div>${swipeActions}
    </div>
    <div id="details-${ctx}-${safeId}" class="tp-group-details" style="display:${isExpanded ? 'block' : 'none'};">
      ${subItemsHtml}
    </div>
  </div>`;
}

function capNhatLogTPThemMoi(newItem) {
  capNhatLogTP();
}

function capNhatLogTP() {
  const container = document.getElementById("tp-log-list");
  if (!container) return;

  const countEl = document.getElementById("tp-log-count");
  if (countEl) countEl.textContent = phienTP.length + " mã";

  if (phienTP.length === 0) {
    container.innerHTML = '<div class="tp-empty-log">Chưa có mã nào được quét</div>';
    return;
  }

  // Live Log hiển thị tối đa 30 mã mới nhất (để máy mát và cuộn mượt trên K20 Pro)
  const MAX_LOG_ITEMS = 30;
  const recentItems = phienTP.slice(-MAX_LOG_ITEMS);

  // Gom nhóm theo taoKhoaNhomTP
  const groupMap = new Map();
  recentItems.forEach(it => {
    const k = taoKhoaNhomTP(it);
    if (!groupMap.has(k)) {
      groupMap.set(k, { key: k, qcDu: k, items: [], tongKg: 0 });
    }
    const g = groupMap.get(k);
    g.items.push(it);
    g.tongKg += Number(it.kg) || 0;
  });

  const groups = Array.from(groupMap.values()).reverse();
  groups.forEach((g, idx) => { g.stt = idx + 1; });

  const html = groups.map((g, idx) => taoHtmlNhomTP(g, idx === 0, "log", false)).join("");
  container.innerHTML = html;

  if (window.ScannerCore && typeof window.ScannerCore.khoiTaoSwipe === "function") {
    window.ScannerCore.khoiTaoSwipe("tp-log-list", ".tp-swipe-content", "__swipeInitTP");
  }
}

// ── Tính thống kê phiên quét (dùng chung cho Bảng KQ & Lịch sử) ──
function tinhThongKePhienTP(danhSach) {
  const list = danhSach || [];
  const groupMap = new Map();
  let tongKg = 0;

  list.forEach(it => {
    const qc = taoKhoaNhomTP(it);
    if (!groupMap.has(qc)) {
      groupMap.set(qc, { key: qc, qcDu: qc, soBao: 0, tongKg: 0, items: [] });
    }
    const g = groupMap.get(qc);
    g.soBao++;
    g.tongKg += Number(it.kg) || 0;
    g.items.push(it);
    tongKg += Number(it.kg) || 0;
  });

  const gomNhom = Array.from(groupMap.values());
  gomNhom.forEach((g, idx) => { g.stt = idx + 1; });

  return {
    tongBao: list.length, // 1 mã = 1 bao
    tongKg: tongKg,
    gomNhom: gomNhom
  };
}
window.tinhThongKePhienTP = tinhThongKePhienTP;

// ── Bảng Kết Quả & Bảng Tổng Hợp ──
function xemKetQuaTP() {
  if (typeof window.tatDenPinHoanToan === "function") window.tatDenPinHoanToan("tp-reader");
  dungTP();
  if (typeof dungCameraFast === "function" && zxingReaderTP) {
    try { dungCameraFast("tp-reader", zxingReaderTP); } catch (e) { }
    zxingReaderTP = null;
  }
  hienKetQuaTP();
  luuPhienDoDangTPNgay();
  luuVaoLichSuTP();
  if (typeof kichHoatKiemTraAutoBackup === "function") kichHoatKiemTraAutoBackup(2000);
}
window.xemKetQuaTP = xemKetQuaTP;

function hienKetQuaTP() {
  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(false); else document.body.classList.remove("cam-active");

  if (typeof XLSX === "undefined" && typeof napThuVienXLSX === "function") {
    napThuVienXLSX(null, { imLang: true });
  }

  document.getElementById("tp-cam").style.display = "none";
  document.getElementById("tp-ketqua").style.display = "block";

  locKetQuaTP();
}

function khoiTaoSwipeKQTP() {
  if (window.ScannerCore && typeof window.ScannerCore.khoiTaoSwipe === "function") {
    window.ScannerCore.khoiTaoSwipe("tp-tbody-chitiet", ".tp-swipe-content", "__swipeKqInitTP");
  }
}

let timerSearchTP = null;
function onSearchTPInput() {
  const oTim = document.getElementById("tp-ketqua-search");
  const tuKhoa = oTim ? oTim.value.trim() : "";
  if (timerSearchTP) clearTimeout(timerSearchTP);
  window.tempSearchCollapsedTP.clear();
  if (!tuKhoa) {
    locKetQuaTP();
    return;
  }
  timerSearchTP = setTimeout(() => {
    timerSearchTP = null;
    locKetQuaTP();
  }, 200);
}
window.onSearchTPInput = onSearchTPInput;

function locKetQuaTP() {
  const oTim = document.getElementById("tp-ketqua-search");
  const tuKhoa = oTim ? oTim.value.trim().toLowerCase() : "";
  const coTuKhoa = tuKhoa.length > 0;
  if (!coTuKhoa) window.tempSearchCollapsedTP.clear();

  // Tính STT gốc từ toàn bộ phiên để giữ STT nhất quán khi lọc
  const statGoc = tinhThongKePhienTP(phienTP);
  const sttGocMap = new Map();
  statGoc.gomNhom.forEach(g => sttGocMap.set(g.key, g.stt));

  let list = phienTP.slice();
  if (coTuKhoa) {
    list = list.filter(r => (r.id && r.id.toLowerCase().includes(tuKhoa)) ||
      (r.qcDu && r.qcDu.toLowerCase().includes(tuKhoa)) ||
      (r.maKien && r.maKien.toLowerCase().includes(tuKhoa)) ||
      (r.tenHang && r.tenHang.toLowerCase().includes(tuKhoa)));
  }

  const stat = tinhThongKePhienTP(list);
  stat.gomNhom.forEach(g => {
    if (sttGocMap.has(g.key)) g.stt = sttGocMap.get(g.key);
  });

  // Cập nhật Khung Tóm Tắt trên đầu theo tổng toàn phiên (đồng bộ khi xóa, giữ nguyên khi lọc)
  const elTongBao = document.getElementById("tp-tong-cuon");
  const elTongKg = document.getElementById("tp-tong-kg");
  if (elTongBao) elTongBao.textContent = statGoc.tongBao;
  if (elTongKg) elTongKg.textContent = formatKgTP(statGoc.tongKg);

  // 1. Render Bảng Chi Tiết (Gom nhóm accordion theo QC)
  const tbodyChiTiet = document.getElementById("tp-tbody-chitiet");
  const tfootChiTiet = document.getElementById("tp-tfoot-chitiet");
  if (tbodyChiTiet) {
    if (stat.gomNhom.length === 0) {
      const emptyMsgChiTiet = coTuKhoa ? "Không tìm thấy mã phù hợp" : "Chưa có mã quét nào trong phiên";
      tbodyChiTiet.innerHTML = `<div style="padding:16px; text-align:center; color:var(--row-muted);">${emptyMsgChiTiet}</div>`;
    } else {
      tbodyChiTiet.innerHTML = stat.gomNhom.map((g) => taoHtmlNhomTP(g, false, "kq", coTuKhoa)).join("");
    }
  }

  if (tfootChiTiet) {
    tfootChiTiet.innerHTML = `
      <div class="tp-kq-grid" style="font-weight:800; font-size:14px;">
        <div style="grid-column: 1 / 3; color:var(--text-main);">TỔNG</div>
        <div style="text-align:center; font-family:'IBM Plex Mono', monospace;">${stat.tongBao}</div>
        <div style="text-align:right; font-family:'IBM Plex Mono', monospace; color:var(--success);">${formatKgTP(stat.tongKg)}</div>
        <div></div>
      </div>
    `;
  }

  // 2. Render Bảng Tổng Hợp (Gom theo QC)
  const tbodyGom = document.getElementById("tp-tbody-gom");
  const tfootGom = document.getElementById("tp-tfoot-gom");
  if (tbodyGom) {
    if (stat.gomNhom.length === 0) {
      const emptyMsgGom = coTuKhoa ? "Không tìm thấy mã phù hợp" : "Không có dữ liệu tổng hợp";
      tbodyGom.innerHTML = `<div style="padding:16px; text-align:center; color:var(--row-muted);">${emptyMsgGom}</div>`;
    } else {
      tbodyGom.innerHTML = stat.gomNhom.map((g) => `
        <div class="tp-gom-grid" style="border-bottom:1px solid var(--border-row); font-size:13px; line-height:1.3;">
          <div style="font-weight:600; color:var(--row-text); white-space:normal; word-break:break-word;">${anToanHtmlTP(g.qcDu)}</div>
          <div style="text-align:center; font-family:'IBM Plex Mono', monospace; font-size:14px; font-weight:700;">${g.soBao}</div>
          <div style="text-align:right; font-family:'IBM Plex Mono', monospace; font-size:14px; font-weight:700; color:var(--success);">${formatKgTP(g.tongKg)}</div>
        </div>
      `).join("");
    }
  }

  if (tfootGom) {
    tfootGom.innerHTML = `
      <div class="tp-gom-grid" style="font-weight:800; font-size:14px;">
        <div style="color:var(--text-main);">TỔNG</div>
        <div style="text-align:center; font-family:'IBM Plex Mono', monospace;">${stat.tongBao}</div>
        <div style="text-align:right; font-family:'IBM Plex Mono', monospace; color:var(--success);">${formatKgTP(stat.tongKg)}</div>
      </div>
    `;
  }

  khoiTaoSwipeKQTP();
}
window.locKetQuaTP = locKetQuaTP;

function toggleTPView(mode) {
  const btnChitiet = document.getElementById('btn-tp-view-chitiet');
  const btnGom = document.getElementById('btn-tp-view-gom');
  const wrapChitiet = document.getElementById('tp-wrap-chitiet');
  const wrapGom = document.getElementById('tp-wrap-gom');

  if (mode === 'chitiet') {
    if (wrapChitiet) wrapChitiet.style.display = 'block';
    if (wrapGom) wrapGom.style.display = 'none';
    if (btnChitiet) {
      btnChitiet.style.background = 'var(--surface)';
      btnChitiet.style.color = 'var(--row-text)';
      btnChitiet.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
    }
    if (btnGom) {
      btnGom.style.background = 'transparent';
      btnGom.style.color = 'var(--row-muted)';
      btnGom.style.boxShadow = 'none';
    }
  } else {
    if (wrapChitiet) wrapChitiet.style.display = 'none';
    if (wrapGom) wrapGom.style.display = 'block';
    if (btnGom) {
      btnGom.style.background = 'var(--surface)';
      btnGom.style.color = 'var(--row-text)';
      btnGom.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
    }
    if (btnChitiet) {
      btnChitiet.style.background = 'transparent';
      btnChitiet.style.color = 'var(--row-muted)';
      btnChitiet.style.boxShadow = 'none';
    }
  }
}
window.toggleTPView = toggleTPView;

// ── Theo dõi người dùng chủ động đổi ngày ──
let nguoiDungDoiNgayTP = false;
if (typeof document !== "undefined") {
  const ganSuKienNgayTP = () => {
    const el = document.getElementById("tp-ngay");
    if (el && !el.__tpDateListenerAttached) {
      el.__tpDateListenerAttached = true;
      el.addEventListener("change", () => {
        nguoiDungDoiNgayTP = true;
      });
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ganSuKienNgayTP);
  } else {
    ganSuKienNgayTP();
  }
}

// ── Bắt đầu, Quét tiếp, Bắt đầu mới ──
async function batDauTP() {
  const today = layNgayHomNayTP();
  const ngayEl = document.getElementById("tp-ngay");
  if (ngayEl && !ngayEl.value) {
    ngayEl.value = today;
    window.ngayTuDongTP = today;
    nguoiDungDoiNgayTP = false;
  }
  ngayTP = (ngayEl && ngayEl.value) ? ngayEl.value : today;

  let phienCu = null;
  try { phienCu = JSON.parse(localStorage.getItem(TP_DODANG_KEY)); } catch (e) { }
  if (phienCu && Array.isArray(phienCu.phienTP) && phienCu.phienTP.length > 0) {
    if (typeof moXacNhanApp === "function") {
      moXacNhanApp(
        "Bạn đang có phiên TP dở dang (" + phienCu.phienTP.length + " mã). Bạn muốn tiếp tục hay bắt đầu mới?",
        () => { khoiPhucTP(phienCu); },
        "Tiếp tục",
        () => { xoaPhienDoDangTP(); batDauPhienMoiTP(ngayTP); },
        "Bắt đầu mới",
        "Phiên TP dở dang"
      );
      return;
    }
  }

  batDauPhienMoiTP(ngayTP);
}
window.batDauTP = batDauTP;

async function batDauPhienMoiTP(ngayMoi) {
  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(true); else document.body.classList.add("cam-active");
  const today = layNgayHomNayTP();
  const ngayEl = document.getElementById("tp-ngay");
  if (ngayMoi) {
    ngayTP = ngayMoi;
    if (ngayEl) ngayEl.value = ngayMoi;
  } else if (!ngayTP) {
    ngayTP = (ngayEl && ngayEl.value) ? ngayEl.value : today;
  }

  phienTP = [];
  tapMaDaQuetTP.clear();
  if (window.expandedTPGroupsLog) window.expandedTPGroupsLog.clear();
  if (window.expandedTPGroupsKq) window.expandedTPGroupsKq.clear();
  if (window.tempSearchCollapsedTP) window.tempSearchCollapsedTP.clear();
  if (timerSearchTP) { clearTimeout(timerSearchTP); timerSearchTP = null; }
  const oTimMoi = document.getElementById("tp-ketqua-search");
  if (oTimMoi) oTimMoi.value = "";
  demSoDotTP = 1;
  dangQuetTP = true;
  window.dangQuetTP = true;
  denPinBatTP = false;
  idPhienHienTaiTP = "TP_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  daXuatExcelTP = false;
  revisionTP = 1;
  capNhatLucTP = new Date().toISOString();

  luuPhienDoDangTPNgay();

  document.getElementById("tp-form").style.display = "none";
  document.getElementById("tp-cam").style.display = "block";
  document.getElementById("tp-ketqua").style.display = "none";
  document.getElementById("tp-dem").textContent = "Đã quét: 0 mã";
  const statusEl = document.getElementById("tp-status");
  if (statusEl) statusEl.innerHTML = '<div class="cam-status-dot"></div><span>Đợt 1</span>';
  maQRVuaQuetTP = "";
  const lockStatusEl = document.getElementById("tp-lock-status");
  if (lockStatusEl) lockStatusEl.textContent = "Chờ quét...";

  const btnToggle = document.getElementById("btn-dung-tieptuc-tp");
  if (btnToggle) {
    btnToggle.innerHTML = SVG_SHUTTER_PAUSE;
    btnToggle.className = "cam-shutter-center-btn";
    btnToggle.classList.remove("paused");
    btnToggle.title = "Dừng quét";
  }

  const pauseOverlay = document.getElementById("tp-cam-pause-overlay");
  if (pauseOverlay) pauseOverlay.style.display = "none";

  capNhatLogTP();
  await khoiDongCameraTP();
}
window.batDauPhienMoiTP = batDauPhienMoiTP;

async function khoiDongCameraTP() {
  if (dangKhoiTaoCamTP) return;
  dangKhoiTaoCamTP = true;
  try {
    const tpVid = document.getElementById("tp-reader");
    const tpTrack = tpVid && tpVid.srcObject ? tpVid.srcObject.getVideoTracks()[0] : null;
    const isCamRunningTP = tpTrack && tpTrack.readyState === 'live' && !(window.denPinGiuMap && window.denPinGiuMap["tp-reader"]);

    if (!zxingReaderTP || !isCamRunningTP) {
      if (zxingReaderTP) {
        if (typeof dungCameraFast === "function") dungCameraFast("tp-reader", zxingReaderTP);
        zxingReaderTP = null;
      }
      if (typeof khoiTaoCameraFast === "function") {
        zxingReaderTP = await khoiTaoCameraFast("tp-reader", khiQuetDuocMaTP);
        window.zxingReaderTP = zxingReaderTP;
      }
    }
  } catch (err) {
    console.error("Lỗi khởi động camera TP:", err);
  } finally {
    dangKhoiTaoCamTP = false;
  }
}

async function quetTiepTP() {
  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(true); else document.body.classList.add("cam-active");
  const maxDot = phienTP.length > 0 ? Math.max(0, ...phienTP.map(r => r.dotQuet || 1)) : 0;
  demSoDotTP = maxDot > 0 ? maxDot + 1 : 1;
  dangQuetTP = true;
  window.dangQuetTP = true;
  denPinBatTP = false;

  document.getElementById("tp-ketqua").style.display = "none";
  document.getElementById("tp-cam").style.display = "block";
  document.getElementById("tp-status").innerHTML = '<div class="cam-status-dot"></div><span>Đợt ' + demSoDotTP + '</span>';

  const lastItemTP = phienTP.length > 0 ? phienTP[phienTP.length - 1] : null;
  maQRVuaQuetTP = lastItemTP ? lastItemTP.id : "";
  const lockStatusEl = document.getElementById("tp-lock-status");
  if (lockStatusEl) {
    lockStatusEl.textContent = maQRVuaQuetTP || "Chờ quét...";
    lockStatusEl.title = maQRVuaQuetTP || "";
  }

  const btnToggle = document.getElementById("btn-dung-tieptuc-tp");
  if (btnToggle) {
    btnToggle.innerHTML = SVG_SHUTTER_PAUSE;
    btnToggle.classList.remove("paused");
    btnToggle.title = "Dừng quét";
  }

  const pauseOverlay = document.getElementById("tp-cam-pause-overlay");
  if (pauseOverlay) pauseOverlay.style.display = "none";

  luuPhienDoDangTPNgay();
  await khoiDongCameraTP();
}
window.quetTiepTP = quetTiepTP;

async function quetMoiTP() {
  const today = layNgayHomNayTP();
  const ngayEl = document.getElementById("tp-ngay");
  const ngayHienTai = ngayTP || (ngayEl && ngayEl.value) || today;
  const ngayApDung = (!nguoiDungDoiNgayTP && ngayHienTai < today) ? today : ngayHienTai;

  const coMaChuaXuat = phienTP.length > 0 && !daXuatExcelTP;
  const thongBao = coMaChuaXuat
    ? `Phiên hiện tại có ${phienTP.length} mã chưa xuất Excel! Bạn có chắc muốn tạo phiên mới (Ngày: ${ngayApDung})?`
    : `Bắt đầu phiên quét Thành Phẩm hoàn toàn mới (Ngày: ${ngayApDung})?`;

  const doBatDauMoi = () => {
    luuVaoLichSuTP();
    xoaPhienDoDangTP();
    if (ngayApDung === today && ngayHienTai !== today) {
      window.ngayTuDongTP = today;
    }
    batDauPhienMoiTP(ngayApDung);
  };

  if (typeof moXacNhanApp === "function") {
    moXacNhanApp(thongBao, doBatDauMoi, "Bắt đầu mới", null, "Hủy", "Phiên TP mới");
  } else {
    doBatDauMoi();
  }
}
window.quetMoiTP = quetMoiTP;

function toggleDungTiepTucTP() {
  if (dangQuetTP) {
    dungTP();
  } else {
    tiepTucTP();
  }
}
window.toggleDungTiepTucTP = toggleDungTiepTucTP;

function dungTP() {
  dangQuetTP = false;
  window.dangQuetTP = false;

  const btnToggle = document.getElementById("btn-dung-tieptuc-tp");
  if (btnToggle) {
    btnToggle.innerHTML = SVG_SHUTTER_PLAY;
    btnToggle.classList.add("paused");
    btnToggle.title = "Quét tiếp";
  }

  const statusEl = document.getElementById("tp-status");
  if (statusEl) {
    statusEl.innerHTML = '<div class="cam-status-dot paused"></div><span>Đã dừng</span>';
  }

  const pauseOverlay = document.getElementById("tp-cam-pause-overlay");
  if (pauseOverlay) pauseOverlay.style.display = "flex";

  if (typeof dungCameraFast === "function") {
    try { dungCameraFast("tp-reader", zxingReaderTP); } catch (e) { }
    zxingReaderTP = null;
  }
  luuPhienDoDangTPNgay();
  luuVaoLichSuTP();
}
window.dungTP = dungTP;

async function tiepTucTP() {
  dangQuetTP = true;
  window.dangQuetTP = true;

  const btnToggle = document.getElementById("btn-dung-tieptuc-tp");
  if (btnToggle) {
    btnToggle.innerHTML = SVG_SHUTTER_PAUSE;
    btnToggle.classList.remove("paused");
    btnToggle.title = "Dừng quét";
  }

  const statusEl = document.getElementById("tp-status");
  if (statusEl) {
    statusEl.innerHTML = '<div class="cam-status-dot"></div><span>Đợt ' + demSoDotTP + '</span>';
  }

  const pauseOverlay = document.getElementById("tp-cam-pause-overlay");
  if (pauseOverlay) pauseOverlay.style.display = "none";

  await khoiDongCameraTP();
}
window.tiepTucTP = tiepTucTP;

// ── Quản lý Phiên dở dang (localStorage) ──
let debounceTimerLuuPhienTP = null;
function luuPhienDoDangTP() {
  if (debounceTimerLuuPhienTP) clearTimeout(debounceTimerLuuPhienTP);
  debounceTimerLuuPhienTP = setTimeout(() => {
    debounceTimerLuuPhienTP = null;
    luuPhienDoDangTPNgay();
  }, 300);
}

function luuPhienDoDangTPNgay() {
  if (debounceTimerLuuPhienTP) {
    clearTimeout(debounceTimerLuuPhienTP);
    debounceTimerLuuPhienTP = null;
  }
  try {
    localStorage.setItem(TP_DODANG_KEY, JSON.stringify({
      idPhien: idPhienHienTaiTP,
      ngay: ngayTP || layNgayHomNayTP(),
      phienSo: phienSoTP || 1,
      capNhatLuc: capNhatLucTP || new Date().toISOString(),
      daXuatExcel: daXuatExcelTP,
      revision: revisionTP,
      phienTP: phienTP,
      demSoDotTP: demSoDotTP
    }));
  } catch (e) { }

  const trangChuEl = document.getElementById("trangChu");
  if (trangChuEl && trangChuEl.classList.contains("active") && typeof capNhatTrangChu === "function") {
    capNhatTrangChu();
  }
}

function xoaPhienDoDangTP() {
  if (debounceTimerLuuPhienTP) {
    clearTimeout(debounceTimerLuuPhienTP);
    debounceTimerLuuPhienTP = null;
  }
  try { localStorage.removeItem(TP_DODANG_KEY); } catch (e) { }
  const trangChuEl = document.getElementById("trangChu");
  if (trangChuEl && trangChuEl.classList.contains("active") && typeof capNhatTrangChu === "function") {
    capNhatTrangChu();
  }
}

function khoiPhucTP(data) {
  if (!data || !Array.isArray(data.phienTP)) return;
  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(true); else document.body.classList.add("cam-active");

  phienTP = data.phienTP.slice();
  idPhienHienTaiTP = data.idPhien || ("TP_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8));
  ngayTP = data.ngay || layNgayHomNayTP();
  const ngayEl = document.getElementById("tp-ngay");
  if (ngayEl) ngayEl.value = ngayTP;
  phienSoTP = data.phienSo || 1;
  demSoDotTP = data.demSoDotTP || 1;
  daXuatExcelTP = !!data.daXuatExcel;
  revisionTP = data.revision || 1;
  capNhatLucTP = data.capNhatLuc || new Date().toISOString();

  // Dựng lại Set chống trùng Dòng 1 & xóa sạch Set mở nhóm cũ
  tapMaDaQuetTP.clear();
  if (window.expandedTPGroupsLog) window.expandedTPGroupsLog.clear();
  if (window.expandedTPGroupsKq) window.expandedTPGroupsKq.clear();
  if (window.tempSearchCollapsedTP) window.tempSearchCollapsedTP.clear();
  if (timerSearchTP) { clearTimeout(timerSearchTP); timerSearchTP = null; }
  const oTimKp = document.getElementById("tp-ketqua-search");
  if (oTimKp) oTimKp.value = "";
  phienTP.forEach(it => {
    if (it.id) tapMaDaQuetTP.add(it.id);
  });

  dangQuetTP = true;
  window.dangQuetTP = true;

  document.getElementById("tp-form").style.display = "none";
  document.getElementById("tp-cam").style.display = "block";
  document.getElementById("tp-ketqua").style.display = "none";
  document.getElementById("tp-dem").textContent = "Đã quét: " + phienTP.length + " mã";

  const statusEl = document.getElementById("tp-status");
  if (statusEl) statusEl.innerHTML = '<div class="cam-status-dot"></div><span>Đợt ' + demSoDotTP + '</span>';

  const lastItem = phienTP.length > 0 ? phienTP[phienTP.length - 1] : null;
  maQRVuaQuetTP = lastItem ? lastItem.id : "";
  const lockStatusEl = document.getElementById("tp-lock-status");
  if (lockStatusEl) lockStatusEl.textContent = maQRVuaQuetTP || "Chờ quét...";

  capNhatLogTP();
  khoiDongCameraTP();
}

// ── Quản lý Lịch Sử TP (IndexedDB qua ScannerCore) ──
let debounceTimerLuuLichSuTP = null;
function luuVaoLichSuTPDebounced() {
  if (debounceTimerLuuLichSuTP) clearTimeout(debounceTimerLuuLichSuTP);
  debounceTimerLuuLichSuTP = setTimeout(() => {
    debounceTimerLuuLichSuTP = null;
    luuVaoLichSuTP();
  }, 1000);
}

function docLichSuTP(filterFn) {
  const macDinhFilter = (session) => {
    if (!session) return false;
    // Dọn lịch sử 30 ngày: CHỈ xóa phiên đã xuất Excel, quá 30 ngày và không đang mở
    if (session.daXuatExcel === true && session.idPhien !== idPhienHienTaiTP) {
      const thoiDiem = new Date(session.capNhatLuc || session.ngay);
      if (!isNaN(thoiDiem.getTime())) {
        const soNgay = (Date.now() - thoiDiem.getTime()) / (1000 * 60 * 60 * 24);
        if (soNgay > TP_LICHSU_SO_NGAY_GIU) return false;
      }
    }
    return typeof filterFn === "function" ? filterFn(session) : true;
  };

  if (window.ScannerCore && typeof window.ScannerCore.docLichSu === "function") {
    return window.ScannerCore.docLichSu(TP_LICHSU_KEY, macDinhFilter);
  }
  let list = [];
  try { list = JSON.parse(localStorage.getItem(TP_LICHSU_KEY)) || []; } catch (e) { list = []; }
  return list.filter(macDinhFilter);
}

function luuLichSuTP(list) {
  if (window.ScannerCore && typeof window.ScannerCore.luuLichSu === "function") {
    window.ScannerCore.luuLichSu(TP_LICHSU_KEY, list);
    return;
  }
  try { localStorage.setItem(TP_LICHSU_KEY, JSON.stringify(list)); } catch (e) { }
}

function luuVaoLichSuTP() {
  if (debounceTimerLuuLichSuTP) {
    clearTimeout(debounceTimerLuuLichSuTP);
    debounceTimerLuuLichSuTP = null;
  }
  if (!idPhienHienTaiTP) return;
  const list = docLichSuTP();
  if (phienTP.length === 0) {
    const filtered = list.filter(s => s.idPhien !== idPhienHienTaiTP);
    luuLichSuTP(filtered);
    return;
  }
  const idx = list.findIndex(s => s.idPhien === idPhienHienTaiTP);
  const banGhi = {
    idPhien: idPhienHienTaiTP,
    ngay: ngayTP || layNgayHomNayTP(),
    phienSo: phienSoTP || 1,
    capNhatLuc: capNhatLucTP || new Date().toISOString(),
    thoiGian: layThoiGianHienTaiTP(),
    daXuatExcel: daXuatExcelTP,
    revision: revisionTP,
    phienTP: phienTP,
    demSoDotTP: demSoDotTP
  };
  if (idx >= 0) list[idx] = banGhi; else list.push(banGhi);
  luuLichSuTP(list);
}

function moLichSuTP() {
  renderLichSuTP();
  if (typeof chuyenTrangKhongNav === "function") chuyenTrangKhongNav("lichSuTP");
}
window.moLichSuTP = moLichSuTP;

function renderLichSuTP() {
  if (typeof XLSX === "undefined" && typeof napThuVienXLSX === "function") {
    napThuVienXLSX(null, { imLang: true });
  }
  const container = document.getElementById("lichsu-tp-list");
  if (!container) return;
  const oTim = document.getElementById("lichsu-tp-tim");
  const tuKhoa = oTim ? oTim.value.trim().toLowerCase() : "";

  let list = docLichSuTP().slice().sort((a, b) => new Date(b.capNhatLuc || b.ngay) - new Date(a.capNhatLuc || a.ngay));
  if (tuKhoa) {
    list = list.filter(s => {
      const tg = (s.thoiGian || s.ngay || "").toLowerCase();
      const hasQC = (s.phienTP || []).some(it => (it.qcDu && it.qcDu.toLowerCase().includes(tuKhoa)) || (it.id && it.id.toLowerCase().includes(tuKhoa)));
      return tg.includes(tuKhoa) || hasQC;
    });
  }

  if (list.length === 0) {
    container.innerHTML = '<div style="padding:24px; text-align:center; color:var(--row-muted);">Chưa có phiên lịch sử nào</div>';
    return;
  }

  container.innerHTML = list.map(s => {
    const stat = tinhThongKePhienTP(s.phienTP);
    const tgHienThi = s.thoiGian || s.ngay || "Không rõ";
    const statusBadge = s.daXuatExcel
      ? '<span style="font-size:11px; padding:2px 8px; border-radius:12px; background:rgba(34,197,94,0.15); color:var(--success); font-weight:700;">Đã xuất Excel</span>'
      : '<span style="font-size:11px; padding:2px 8px; border-radius:12px; background:rgba(239,68,68,0.15); color:var(--red); font-weight:700;">Chưa xuất Excel</span>';

    return `
      <div class="card" style="margin-bottom:12px; padding:14px; border-radius:12px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <div>
            <div style="font-size:14px; font-weight:800; color:var(--text-main); margin-bottom:4px;">${anToanHtmlTP(tgHienThi)}</div>
            <div style="font-size:12px; color:var(--row-muted);">${statusBadge}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:'IBM Plex Mono', monospace; font-size:16px; font-weight:800; color:var(--primary);">${stat.tongBao} bao</div>
            <div style="font-family:'IBM Plex Mono', monospace; font-size:13px; font-weight:700; color:var(--success);">${formatKgTP(stat.tongKg)}</div>
          </div>
        </div>

        <div style="display:flex; gap:8px; margin-top:12px;">
          <button class="kq-btn kq-btn--primary" style="flex:1; padding:7px 10px; font-size:12px;" onclick="tiepTucTuChiTietLichSuTP('${s.idPhien}')">
            <i class="ti ti-scan"></i> Quét tiếp
          </button>
          <button class="kq-btn kq-btn--excel" style="flex:1; padding:7px 10px; font-size:12px;" onclick="xuatExcelPhienLichSuTP('${s.idPhien}')">
            <i class="ti ti-file-spreadsheet"></i> Xuất Excel
          </button>
          <button class="kq-btn kq-btn--danger" style="padding:7px 10px; font-size:12px;" onclick="xoaMotPhienLichSuTP('${s.idPhien}', event)">
            <i class="ti ti-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join("");
}
window.renderLichSuTP = renderLichSuTP;

function tiepTucTuChiTietLichSuTP(idPhien) {
  const list = docLichSuTP();
  const session = list.find(s => s.idPhien === idPhien);
  if (!session) {
    showCanhBaoTP("Không tìm thấy phiên lịch sử!", "error");
    return;
  }

  // 1. Nếu đang quét đúng phiên này -> quay lại camera luôn
  if (idPhienHienTaiTP === idPhien) {
    if (typeof chuyenTrangKhongNav === "function") chuyenTrangKhongNav("tpPage");
    else if (typeof chuyenTrang === "function") chuyenTrang("tpPage");
    document.getElementById("tp-form").style.display = "none";
    document.getElementById("tp-cam").style.display = "block";
    document.getElementById("tp-ketqua").style.display = "none";
    tiepTucTP();
    return;
  }

  // 2. Nếu phiên hiện tại đang có dữ liệu khác -> Hỏi xác nhận
  const doNapPhien = () => {
    luuVaoLichSuTP(); // Lưu phiên cũ
    khoiPhucTP(session);
    if (typeof chuyenTrangKhongNav === "function") chuyenTrangKhongNav("tpPage");
    else if (typeof chuyenTrang === "function") chuyenTrang("tpPage");
    showCanhBaoTP("Đã nạp phiên: " + (session.thoiGian || session.ngay) + " (" + phienTP.length + " mã)", "success");
  };

  if (phienTP.length > 0) {
    if (typeof moXacNhanApp === "function") {
      moXacNhanApp(
        `Phiên hiện tại đang có ${phienTP.length} mã! Bạn có muốn lưu phiên hiện tại và chuyển sang quét tiếp phiên lịch sử này không?`,
        doNapPhien,
        "Đồng ý",
        null,
        "Hủy",
        "Nạp phiên lịch sử"
      );
    } else {
      doNapPhien();
    }
  } else {
    doNapPhien();
  }
}
window.tiepTucTuChiTietLichSuTP = tiepTucTuChiTietLichSuTP;

function xoaMotPhienLichSuTP(idPhien, ev) {
  if (ev) ev.stopPropagation();
  if (typeof moXacNhanApp === "function") {
    moXacNhanApp(
      "Xóa phiên lịch sử Thành Phẩm này? Không thể hoàn tác.",
      () => {
        luuLichSuTP(docLichSuTP().filter(s => s.idPhien !== idPhien));
        if (idPhienHienTaiTP === idPhien) {
          xoaPhienDoDangTP();
          phienTP = [];
          tapMaDaQuetTP.clear();
        }
        renderLichSuTP();
        showCanhBaoTP("Đã xóa phiên lịch sử", "info");
      },
      "Xóa",
      null,
      "Hủy",
      "Xóa phiên lịch sử"
    );
  }
}
window.xoaMotPhienLichSuTP = xoaMotPhienLichSuTP;

function xoaTatCaLichSuTP() {
  const list = docLichSuTP();
  if (list.length === 0) { showCanhBaoTP("Không có lịch sử TP để xóa", "info"); return; }
  if (typeof moXacNhanApp === "function") {
    moXacNhanApp(
      "Xóa toàn bộ " + list.length + " phiên lịch sử Thành Phẩm? Không thể hoàn tác.",
      () => {
        luuLichSuTP([]);
        xoaPhienDoDangTP();
        phienTP = [];
        tapMaDaQuetTP.clear();
        renderLichSuTP();
        showCanhBaoTP("Đã xóa tất cả lịch sử TP", "info");
      },
      "Xóa tất cả",
      null,
      "Hủy",
      "Xóa tất cả lịch sử"
    );
  }
}
window.xoaTatCaLichSuTP = xoaTatCaLichSuTP;

// ── Xuất File Excel (2 cột chuẩn hóa cho APK & PWA) ──
let dangXuatTP = false;

async function xuatExcelTP() {
  if (dangXuatTP) return;
  if (!phienTP || phienTP.length === 0) {
    showCanhBaoTP("Chưa có dữ liệu để xuất file Excel!", "warning");
    return;
  }

  const data = phienTP.map(r => ({
    "Thời gian": r.thoiGian || "",
    "Mã QR Gốc": anToanCongThucExcel(r.rawQR)
  }));

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `Quet_TP_${stamp}`;

  if (typeof exportToExcel !== "function") {
    showCanhBaoTP("Không tìm thấy bộ xuất Excel!", "error");
    return;
  }

  dangXuatTP = true;
  const idPhienLucXuat = idPhienHienTaiTP;
  const revLucXuat = revisionTP;
  try {
    const res = await exportToExcel(filename, "Thành Phẩm", data, { chiaSe: true });
    if (res && res.success) {
      if (idPhienHienTaiTP === idPhienLucXuat && revisionTP === revLucXuat) {
        daXuatExcelTP = true;
        capNhatLucTP = new Date().toISOString();
        luuPhienDoDangTPNgay();
        luuVaoLichSuTP();
      }
    } else if (res && res.cancelled) {
      showCanhBaoTP("Đã hủy chia sẻ Excel", "info");
    } else if (res && res.error) {
      showCanhBaoTP(res.error, "error");
    }
  } finally {
    dangXuatTP = false;
  }
}
window.xuatExcelTP = xuatExcelTP;

async function xuatExcelPhienLichSuTP(idPhien) {
  if (dangXuatTP) return;
  const listBefore = docLichSuTP();
  const sessionBefore = listBefore.find(s => s.idPhien === idPhien);
  if (!sessionBefore || !sessionBefore.phienTP || sessionBefore.phienTP.length === 0) {
    showCanhBaoTP("Phiên không có dữ liệu để xuất!", "warning");
    return;
  }

  const data = sessionBefore.phienTP.map(r => ({
    "Thời gian": r.thoiGian || "",
    "Mã QR Gốc": anToanCongThucExcel(r.rawQR)
  }));

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `Quet_TP_${stamp}`;

  if (typeof exportToExcel !== "function") {
    showCanhBaoTP("Không tìm thấy bộ xuất Excel!", "error");
    return;
  }

  dangXuatTP = true;
  const revLucXuat = sessionBefore.revision || 0;
  try {
    const res = await exportToExcel(filename, "Thành Phẩm", data, { chiaSe: true });
    if (res && res.success) {
      const listNow = docLichSuTP();
      const sNow = listNow.find(s => s.idPhien === idPhien);
      if (sNow && (sNow.revision || 0) === revLucXuat) {
        sNow.daXuatExcel = true;
        sNow.capNhatLuc = new Date().toISOString();
        luuLichSuTP(listNow);
        if (idPhienHienTaiTP === sNow.idPhien && revisionTP === sNow.revision) {
          daXuatExcelTP = true;
          capNhatLucTP = sNow.capNhatLuc;
          luuPhienDoDangTPNgay();
        }
        renderLichSuTP();
      }
    } else if (res && res.cancelled) {
      showCanhBaoTP("Đã hủy chia sẻ Excel", "info");
    } else if (res && res.error) {
      showCanhBaoTP(res.error, "error");
    }
  } finally {
    dangXuatTP = false;
  }
}
window.xuatExcelPhienLichSuTP = xuatExcelPhienLichSuTP;

async function xuatExcelTatCaLichSuTP() {
  if (dangXuatTP) return;
  const listBefore = docLichSuTP();
  if (listBefore.length === 0) {
    showCanhBaoTP("Không có lịch sử để xuất Excel!", "warning");
    return;
  }

  const allItems = [];
  const revMap = new Map();
  listBefore.forEach(s => {
    revMap.set(s.idPhien, s.revision || 0);
    (s.phienTP || []).forEach(r => allItems.push(r));
  });

  if (allItems.length === 0) {
    showCanhBaoTP("Các phiên lịch sử đều rỗng!", "warning");
    return;
  }

  const data = allItems.map(r => ({
    "Thời gian": r.thoiGian || "",
    "Mã QR Gốc": anToanCongThucExcel(r.rawQR)
  }));

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `Quet_TP_TatCa_${stamp}`;

  if (typeof exportToExcel !== "function") {
    showCanhBaoTP("Không tìm thấy bộ xuất Excel!", "error");
    return;
  }

  dangXuatTP = true;
  try {
    const res = await exportToExcel(filename, "Thành Phẩm", data, { chiaSe: true });
    if (res && res.success) {
      const listNow = docLichSuTP();
      const nowIso = new Date().toISOString();
      listNow.forEach(s => {
        if (revMap.has(s.idPhien) && (s.revision || 0) === revMap.get(s.idPhien)) {
          s.daXuatExcel = true;
          s.capNhatLuc = nowIso;
          if (idPhienHienTaiTP === s.idPhien && revisionTP === s.revision) {
            daXuatExcelTP = true;
            capNhatLucTP = nowIso;
            luuPhienDoDangTPNgay();
          }
        }
      });
      luuLichSuTP(listNow);
      renderLichSuTP();
    } else if (res && res.cancelled) {
      showCanhBaoTP("Đã hủy chia sẻ Excel", "info");
    } else if (res && res.error) {
      showCanhBaoTP(res.error, "error");
    }
  } finally {
    dangXuatTP = false;
  }
}
window.xuatExcelTatCaLichSuTP = xuatExcelTatCaLichSuTP;

async function saoChepMaQRTP(e) {
  if (e) e.stopPropagation();
  if (window.ScannerCore && typeof window.ScannerCore.saoChepMaQR === "function") {
    await window.ScannerCore.saoChepMaQR(maQRVuaQuetTP, "icon-copy-tp", "btn-copy-tp", showCanhBaoTP);
  }
}
window.saoChepMaQRTP = saoChepMaQRTP;

// ── Toast thông báo cho TP ──
let timerCanhBaoTP = null;
function showCanhBaoTP(text, type = "info") {
  const el = document.getElementById("canhbao-tp") || document.getElementById("canhbao");
  if (!el) {
    if (typeof showCanhBao === "function") showCanhBao(text, type);
    return;
  }
  el.textContent = text;
  el.className = "canhbao-toast show " + type;
  if (timerCanhBaoTP) clearTimeout(timerCanhBaoTP);
  timerCanhBaoTP = setTimeout(() => {
    el.className = "canhbao-toast";
  }, 3000);
}
window.showCanhBaoTP = showCanhBaoTP;
