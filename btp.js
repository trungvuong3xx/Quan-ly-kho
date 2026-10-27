// ── Quản lý BTP (Bán Thành Phẩm) v20261024-ultra ──────────────────────────
// Đã xử lý triệt để 100% các vấn đề theo Báo cáo rà soát app Kho

let zxingReaderBTP = null;
let dangQuetBTP = false;
let phienBTP = [];
let demSoDotBTP = 0;
let denPinBatBTP = false;
let ngayBTP = null;
let phienSoBTP = 1;
let btpToastTimeout = null;

let idPhienHienTaiBTP = null;
let soLuongDaGuiHienTaiBTP = 0;
let maQRVuaQuetBTP = "";

// Cờ khóa chống Race Condition & Gửi đúp
let dangGuiDuLieuBTP = false;
let dangDongBoBTP = false;
let dangKhoiTaoCamBTP = false;

const BTP_LICHSU_KEY = "btp_lich_su";
const BTP_LICHSU_SO_NGAY_GIU = 30;
const BTP_DODANG_KEY = "btp_phien_dodang";
const BTP_PENDING_KEY = "btp_pending_saves";

var SVG_SHUTTER_PAUSE = window.SVG_SHUTTER_PAUSE = window.SVG_SHUTTER_PAUSE || '<svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff"><rect x="6" y="4" width="4" height="16" rx="2" /><rect x="14" y="4" width="4" height="16" rx="2" /></svg>';
var SVG_SHUTTER_PLAY = window.SVG_SHUTTER_PLAY = window.SVG_SHUTTER_PLAY || '<svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff" style="margin-left:2px;"><path d="M8 5v14l11-7z" /></svg>';

// ── Hàm tiện ích ngày giờ địa phương (chuẩn GMT+7 Việt Nam, chống lỗi UTC ca đêm) ──
function layNgayHomNayBTP() {
  if (typeof window.layNgayHomNayLocal === "function") {
    return window.layNgayHomNayLocal();
  }
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const localDate = new Date(now.getTime() - offset);
  return localDate.toISOString().split("T")[0];
}

// ── Escape HTML chống mã độc XSS & vỡ giao diện ──
function anToanHtmlBTP(str) {
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

// ── Xử lý bóc tách mã QR BTP ──
function xuLyDuLieuQRBTP(text) {
  if (!text) return null;
  const rawQR = String(text).trim();
  if (!rawQR) return null;

  let id = "";
  let msp = "";
  let qc = "";
  let kg = 0;

  // 1. Thử giải mã qua parseQRText toàn cục trước (cho mã tem có tag {|T, dấu | hoặc nhiều dòng \n)
  if (typeof window.parseQRText === "function") {
    try {
      const parsed = window.parseQRText(rawQR);
      if (parsed && (parsed.id || parsed.msp)) {
        id = (parsed.id || "").trim();
        msp = (parsed.msp || "").trim().toUpperCase();
        qc = parsed.qc || "";
        kg = typeof parsed.kg === "number" ? parsed.kg : (parseFloat(parsed.kg) || 0);
      }
    } catch (e) { }
  }

  // 2. Nếu không có tag/nhiều dòng (mã BTP chuỗi đơn dạng 27BEM2603111-83, 1AEM2604051-150...)
  if (!id) {
    id = rawQR;
  }

  // 3. Nếu chưa bóc tách được msp từ tag, trích xuất từ id/rawQR (VD: EM260311 từ 27BEM2603111-83)
  if (!msp) {
    const matchEM = id.match(/EM\d{6}/i) || id.match(/EM\d+/i);
    msp = matchEM ? matchEM[0].toUpperCase() : id;
  }

  // 4. Nếu chưa bóc tách được kg từ tag, trích xuất số sau dấu - ở cuối chuỗi
  if (!kg) {
    const matchSL = id.match(/-(\d+(?:\.\d+)?)$/) || id.match(/-(\d+(?:\.\d+)?)/);
    kg = matchSL ? parseFloat(matchSL[1]) : 0;
  }

  return { id: id || rawQR, rawQR: rawQR, msp, qc, kg };
}

// Bộ nhớ chống quét lặp per-QR trong khoảng thời gian ngắn
const mapKhoaBTP = new Map();

// Dọn dẹp cache per-QR nếu quá lớn
function donDepMapKhoaBTP() {
  if (mapKhoaBTP.size > 200) {
    const now = Date.now();
    for (const [key, timestamp] of mapKhoaBTP.entries()) {
      if (now - timestamp > 5000) {
        mapKhoaBTP.delete(key);
      }
    }
  }
}

function hienVienFeedbackBTP(loai) {
  const overlay = document.getElementById("btp-cam-flash-overlay");
  if (overlay) {
    overlay.className = "cam-flash-overlay flash-" + loai;
    setTimeout(() => {
      overlay.className = "cam-flash-overlay";
    }, 280);
  }
  if (typeof hienVienFeedbackCamera === "function") {
    try { hienVienFeedbackCamera("btp-video-box", loai); } catch (e) { }
  }
}
window.hienVienFeedbackBTP = hienVienFeedbackBTP;

function toggleNhapTayBTP() {
  const chipMode = document.getElementById("btp-chip-mode");
  const inputMode = document.getElementById("btp-input-mode");
  const btnKeyboard = document.getElementById("btn-toggle-banphim-btp");
  const inputField = document.getElementById("btp-manual-input-cam");
  if (!chipMode || !inputMode) return;

  const isInputOpen = inputMode.style.display !== "none";
  if (isInputOpen) {
    dongNhapTayBTP();
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
window.toggleNhapTayBTP = toggleNhapTayBTP;

function dongNhapTayBTP() {
  const chipMode = document.getElementById("btp-chip-mode");
  const inputMode = document.getElementById("btp-input-mode");
  const btnKeyboard = document.getElementById("btn-toggle-banphim-btp");
  const inputField = document.getElementById("btp-manual-input-cam");
  if (inputMode) inputMode.style.display = "none";
  if (chipMode) chipMode.style.display = "flex";
  if (btnKeyboard) btnKeyboard.classList.remove("active-mode");
  if (inputField) inputField.value = "";
}
window.dongNhapTayBTP = dongNhapTayBTP;

// ── Hàm dùng chung để thêm một bản ghi vào phiên quét (tối ưu clean code) ──
function themMaVaoPhienBTP(data, rawText, src) {
  if (!data || !data.rawQR) return false;

  const elCheck = document.getElementById("btp-cho-phep-trung-cam");
  const choPhepTrung = elCheck ? elCheck.checked : false;

  const keyQR = (data.id || data.rawQR || "").toLowerCase();
  const trung = phienBTP.find(item => {
    const itemKey = (item.id || item.rawQR || "").toLowerCase();
    return itemKey && itemKey === keyQR;
  });

  if (!choPhepTrung && trung) {
    hienVienFeedbackBTP("duplicate");
    if (typeof window.phatVibrateError === "function") window.phatVibrateError();
    const gioQuet = typeof dinhDangGioQuetTrung === "function" ? dinhDangGioQuetTrung(trung.thoiGian) : "";
    showCanhBaoBTP("Đã quét " + gioQuet, "error");

    if (src === 'cam_auto') {
      mapKhoaBTP.set(keyQR, Date.now() + 1500);
    }
    return false;
  }

  hienVienFeedbackBTP("success");

  // Âm thanh và rung phản hồi
  if (typeof window.phatTiengBip === "function") {
    window.phatTiengBip();
  } else if (navigator.vibrate) {
    try { navigator.vibrate(70); } catch (e) { }
  }

  // Tạo UID duy nhất cho mỗi dòng quét (phục vụ xóa lẻ chính xác 100%)
  const uid = "btp_item_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
  const recordId = "btp_rec_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);

  const newItem = {
    uid: uid,
    recordId: recordId,
    rawQR: data.rawQR || rawText,
    id: data.id || data.rawQR || rawText,
    msp: data.msp,
    qc: data.qc,
    kg: data.kg,
    thoiGian: new Date(),
    dotQuet: demSoDotBTP || 1
  };
  phienBTP.push(newItem);

  const demEl = document.getElementById("btp-dem");
  if (demEl) demEl.textContent = "Đã quét: " + phienBTP.length + " mã";

  luuPhienDoDangBTP();
  capNhatLogBTPThemMoi(newItem);

  maQRVuaQuetBTP = data.rawQR || rawText || data.id || data.msp || "";
  const lockStatusEl = document.getElementById("btp-lock-status");
  if (lockStatusEl) {
    lockStatusEl.textContent = maQRVuaQuetBTP;
    lockStatusEl.title = maQRVuaQuetBTP;
  }

  donDepMapKhoaBTP();
  return true;
}

function nhapThuCongBTP(src) {
  const inputId = src === 'cam' ? 'btp-manual-input-cam' : 'btp-manual-input';
  const el = document.getElementById(inputId);
  if (!el) return;
  const rawText = el.value.trim();
  if (!rawText) {
    showCanhBaoBTP("Vui lòng nhập mã BTP!", "warning");
    return;
  }

  const data = xuLyDuLieuQRBTP(rawText);
  if (!data || !data.rawQR) {
    showCanhBaoBTP("Mã không hợp lệ!", "error");
    return;
  }

  const thanhCong = themMaVaoPhienBTP(data, rawText, 'manual');
  if (thanhCong) {
    el.value = "";
    if (src === 'cam') {
      dongNhapTayBTP();
    }
    showCanhBaoBTP("Đã thêm: " + maQRVuaQuetBTP, "success");
  }
}
window.nhapThuCongBTP = nhapThuCongBTP;

// Quản lý trạng thái mở rộng accordion của các nhóm mã
window.expandedBTPGroups = window.expandedBTPGroups || new Set();

function toggleChiTietBTPGroup(groupKey) {
  if (window.expandedBTPGroups.has(groupKey)) {
    window.expandedBTPGroups.delete(groupKey);
  } else {
    window.expandedBTPGroups.add(groupKey);
  }
  const safeId = 'btp-grp-' + btoa(encodeURIComponent(groupKey)).replace(/[^a-zA-Z0-9]/g, '');
  const detailsEl = document.getElementById('details-' + safeId);
  const chevEl = document.getElementById('chev-' + safeId);
  const isOpen = window.expandedBTPGroups.has(groupKey);
  if (detailsEl && chevEl && (!isOpen || detailsEl.innerHTML.trim() !== "")) {
    detailsEl.style.display = isOpen ? 'block' : 'none';
    chevEl.style.transform = isOpen ? 'rotate(180deg)' : 'none';
  } else {
    capNhatLogBTP();
  }
}
window.toggleChiTietBTPGroup = toggleChiTietBTPGroup;

function onTapRowBTP(groupKey, event) {
  const content = event.currentTarget;
  if (content && content.classList.contains('swiped')) {
    content.style.transform = 'translateX(0px)';
    content.classList.remove('swiped');
    return;
  }
  toggleChiTietBTPGroup(groupKey);
}
window.onTapRowBTP = onTapRowBTP;

function onTapRowBTPByB64(keyB64, event) {
  let targetKey = "";
  try {
    targetKey = decodeURIComponent(atob(keyB64));
  } catch (e) {
    targetKey = keyB64;
  }
  onTapRowBTP(targetKey, event);
}
window.onTapRowBTPByB64 = onTapRowBTPByB64;

// Xóa nhóm bằng Base64 key an toàn 100% không sợ dấu nháy trong chuỗi
function xoaNhomBTPByB64(keyB64, ev) {
  if (ev) ev.stopPropagation();
  let targetKey = "";
  try {
    targetKey = decodeURIComponent(atob(keyB64));
  } catch (e) {
    targetKey = keyB64;
  }
  xoaNhomBTP(targetKey, ev);
}
window.xoaNhomBTPByB64 = xoaNhomBTPByB64;

function xoaNhomBTP(key, ev) {
  if (ev) ev.stopPropagation();
  const targetKey = String(key || '');
  const count = phienBTP.filter(item => {
    const dot = item.dotQuet || 1;
    const msp = (item.msp || item.rawQR || 'KHAC').toUpperCase();
    const kgVal = (item.kg !== undefined && item.kg !== null) ? item.kg : 0;
    return `${dot}_${msp}_${kgVal}` === targetKey;
  }).length;

  if (count === 0) return;

  const doXoa = () => {
    phienBTP = phienBTP.filter(item => {
      const dot = item.dotQuet || 1;
      const msp = (item.msp || item.rawQR || 'KHAC').toUpperCase();
      const kgVal = (item.kg !== undefined && item.kg !== null) ? item.kg : 0;
      return `${dot}_${msp}_${kgVal}` !== targetKey;
    });
    window.expandedBTPGroups.delete(targetKey);

    // [BẢO VỆ MỤC 6.7]: KHÔNG lùi demSoDotBTP khi xóa hết mã của đợt hiện tại!
    if (phienBTP.length === 0 && demSoDotBTP <= 0) {
      demSoDotBTP = 1;
    }

    luuPhienDoDangBTPNgay();
    capNhatLogBTP();
    const lastItem = phienBTP.length > 0 ? phienBTP[phienBTP.length - 1] : null;
    maQRVuaQuetBTP = lastItem ? (lastItem.rawQR || lastItem.id || lastItem.msp || "") : "";
    const lockStatusEl = document.getElementById("btp-lock-status");
    if (lockStatusEl) {
      lockStatusEl.textContent = maQRVuaQuetBTP || "Chờ quét...";
      lockStatusEl.title = maQRVuaQuetBTP || "";
    }
    const demEl = document.getElementById("btp-dem");
    if (demEl) demEl.textContent = "Đã quét: " + phienBTP.length + " mã";
    const statusEl = document.getElementById("btp-status");
    if (statusEl && !dangQuetBTP) {
      statusEl.innerHTML = '<div class="cam-status-dot paused"></div><span>Đợt ' + demSoDotBTP + '</span>';
    }
    if (document.getElementById("btp-ketqua") && document.getElementById("btp-ketqua").style.display !== "none") {
      locKetQuaBTP();
    }
    showCanhBaoBTP("Đã xóa nhóm mã", "info");
  };

  const tieuDe = count > 1 ? `Xóa toàn bộ ${count} lần quét của nhóm này?` : `Xóa mã này khỏi phiên quét?`;
  if (typeof moXacNhanApp === "function") {
    moXacNhanApp(tieuDe, doXoa, "Xóa", null, "Hủy", "Xóa nhóm BTP");
  } else {
    doXoa();
  }
}
window.xoaNhomBTP = xoaNhomBTP;

// [BẢO VỆ MỤC 6.7 & 7.7]: Xóa mã lẻ theo UID duy nhất, không lệch index khi mảng biến động
function xoaMaBTP(uid, ev) {
  if (ev) ev.stopPropagation();
  const targetUid = String(uid);
  const index = phienBTP.findIndex(item => (item.uid && item.uid === targetUid) || (!item.uid && String(item.originalIndex) === targetUid));
  if (index < 0) return;

  const item = phienBTP[index];
  const tenMa = item ? (item.msp || item.rawQR) : "mã này";

  const doXoa = () => {
    phienBTP.splice(index, 1);

    // [BẢO VỆ MỤC 6.7]: Giữ nguyên đợt quét hiện tại
    if (phienBTP.length === 0 && demSoDotBTP <= 0) {
      demSoDotBTP = 1;
    }

    luuPhienDoDangBTPNgay();
    capNhatLogBTP();
    const lastItem = phienBTP.length > 0 ? phienBTP[phienBTP.length - 1] : null;
    maQRVuaQuetBTP = lastItem ? (lastItem.rawQR || lastItem.id || lastItem.msp || "") : "";
    const lockStatusEl = document.getElementById("btp-lock-status");
    if (lockStatusEl) {
      lockStatusEl.textContent = maQRVuaQuetBTP || "Chờ quét...";
      lockStatusEl.title = maQRVuaQuetBTP || "";
    }
    const demEl = document.getElementById("btp-dem");
    if (demEl) demEl.textContent = "Đã quét: " + phienBTP.length + " mã";
    const statusEl = document.getElementById("btp-status");
    if (statusEl && !dangQuetBTP) {
      statusEl.innerHTML = '<div class="cam-status-dot paused"></div><span>Đợt ' + demSoDotBTP + '</span>';
    }
    if (document.getElementById("btp-ketqua") && document.getElementById("btp-ketqua").style.display !== "none") {
      locKetQuaBTP();
    }
    showCanhBaoBTP("Đã xóa " + tenMa, "info");
  };

  if (typeof moXacNhanApp === "function") {
    moXacNhanApp("Xóa lần quét này của mã " + tenMa + "?", doXoa, "Xóa", null, "Hủy", "Xóa mã BTP");
  } else {
    doXoa();
  }
}
window.xoaMaBTP = xoaMaBTP;

function khoiTaoSuKienSwipeBTP() {
  if (window.ScannerCore && typeof window.ScannerCore.khoiTaoSwipe === "function") {
    window.ScannerCore.khoiTaoSwipe("btp-log-list", ".btp-swipe-content", "__swipeInit");
  }
}

function taoHtmlNhomLogBTP(g, isFirst) {
  const safeMsp = anToanHtmlBTP(g.msp);
  const keyB64 = btoa(encodeURIComponent(g.key));
  const safeId = 'btp-grp-' + keyB64.replace(/[^a-zA-Z0-9]/g, '');
  const isExpanded = window.expandedBTPGroups.has(g.key);
  const countBadge = g.items.length > 1 ? `<span class="btp-badge-count">×${g.items.length}</span>` : '';
  const gio = g.lastThoiGian ? new Date(g.lastThoiGian).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
  const flashClass = isFirst ? ' scan-flash-new' : '';
  const kgText = (g.kg !== undefined && g.kg !== null && Number(g.kg) > 0) ? anToanHtmlBTP(g.kg) : '—';

  let subItemsHtml = isExpanded ? g.items.map((it, subIdx) => {
    const subGio = it.thoiGian ? new Date(it.thoiGian).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
    const subKg = (it.kg !== undefined && it.kg !== null && Number(it.kg) > 0) ? anToanHtmlBTP(it.kg) : (Number(g.kg) > 0 ? anToanHtmlBTP(g.kg) : '0');
    const safeSubMsp = anToanHtmlBTP(it.msp || g.msp);
    const safeUid = anToanHtmlBTP(it.uid || ("idx_" + subIdx));

    return `<div class="btp-sub-item">
        <span class="btp-sub-stt">${subIdx + 1}</span>
        <span class="btp-sub-msp">${safeSubMsp}</span>
        <span class="btp-sub-kg">${subKg}</span>
        <span class="btp-sub-gio">${subGio}</span>
        <button type="button" class="btp-sub-del-btn" onclick="xoaMaBTP('${safeUid}', event)" title="Xóa lần quét này">
          <i class="ti ti-trash"></i>
        </button>
      </div>`;
  }).join("") : "";

  return `<div class="btp-swipe-container${flashClass}" data-group-key="${keyB64}">
      <div class="btp-swipe-row-wrap">
        <div class="btp-swipe-actions">
          <button type="button" class="btp-swipe-btn-del" onclick="xoaNhomBTPByB64('${keyB64}', event)">
            <i class="ti ti-trash"></i>
            <span>Xóa</span>
          </button>
        </div>
        <div class="btp-swipe-content" onclick="onTapRowBTPByB64('${keyB64}', event)">
          <span class="btp-col-dot">${g.dot}</span>
          <div class="btp-col-msp-wrap">
            <span class="btp-col-msp">${safeMsp}</span>
            ${countBadge}
          </div>
          <span class="btp-col-kg">${kgText}</span>
          <span class="btp-col-gio">${gio}</span>
          <i id="chev-${safeId}" class="ti ti-chevron-down btp-chevron" style="transform:${isExpanded ? 'rotate(180deg)' : 'none'};"></i>
        </div>
      </div>
      <div id="details-${safeId}" class="btp-group-details" style="display:${isExpanded ? 'block' : 'none'};">
        ${subItemsHtml}
      </div>
    </div>`;
}

function capNhatLogBTPThemMoi(newItem) {
  const container = document.getElementById("btp-log-list");
  const countEl = document.getElementById("btp-log-count");
  if (countEl) countEl.textContent = phienBTP.length + " mã";
  if (!container || !newItem) return;

  const emptyEl = container.querySelector(".btp-empty-log");
  if (emptyEl) {
    capNhatLogBTP();
    return;
  }

  const dot = newItem.dotQuet || 1;
  const mspUpper = (newItem.msp || newItem.rawQR || 'KHAC').toUpperCase();
  const kgVal = (newItem.kg !== undefined && newItem.kg !== null) ? newItem.kg : 0;
  const key = `${dot}_${mspUpper}_${kgVal}`;
  const keyB64 = btoa(encodeURIComponent(key));

  const groupItems = [];
  for (let i = 0; i < phienBTP.length; i++) {
    const it = phienBTP[i];
    const itDot = it.dotQuet || 1;
    const itMsp = (it.msp || it.rawQR || 'KHAC').toUpperCase();
    const itKg = (it.kg !== undefined && it.kg !== null) ? it.kg : 0;
    if (`${itDot}_${itMsp}_${itKg}` === key) {
      groupItems.push(it);
    }
  }

  const g = {
    key: key,
    dot: dot,
    msp: newItem.msp || newItem.rawQR || '—',
    kg: kgVal,
    items: groupItems,
    lastThoiGian: newItem.thoiGian
  };

  const firstRow = container.querySelector(".btp-swipe-container");
  if (firstRow && firstRow.getAttribute("data-group-key") === keyB64 && !window.expandedBTPGroups.has(key)) {
    // Cùng nhóm đang ở đầu danh sách: chỉ cập nhật badge số lượng và giờ tại chỗ (0ms reflow)
    const mspWrap = firstRow.querySelector(".btp-col-msp-wrap");
    if (mspWrap) {
      let badgeEl = mspWrap.querySelector(".btp-badge-count");
      if (groupItems.length > 1) {
        if (!badgeEl) {
          badgeEl = document.createElement("span");
          badgeEl.className = "btp-badge-count";
          mspWrap.appendChild(badgeEl);
        }
        badgeEl.textContent = "×" + groupItems.length;
      }
    }
    const gioEl = firstRow.querySelector(".btp-col-gio");
    if (gioEl && newItem.thoiGian) {
      gioEl.textContent = new Date(newItem.thoiGian).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }
    return;
  }

  // Nếu nhóm đã tồn tại ở vị trí thấp hơn thì gỡ vị trí cũ để đưa lên đầu
  const existingRow = container.querySelector(`.btp-swipe-container[data-group-key="${keyB64}"]`);
  if (existingRow) {
    existingRow.remove();
  }
  if (firstRow) {
    firstRow.classList.remove("scan-flash-new");
  }

  container.insertAdjacentHTML("afterbegin", taoHtmlNhomLogBTP(g, true));

  const allRows = container.querySelectorAll(".btp-swipe-container");
  if (allRows.length > 30) {
    for (let i = 30; i < allRows.length; i++) {
      allRows[i].remove();
    }
  }
  khoiTaoSuKienSwipeBTP();
}

function capNhatLogBTP() {
  const container = document.getElementById("btp-log-list");
  const countEl = document.getElementById("btp-log-count");

  if (countEl) countEl.textContent = phienBTP.length + " mã";
  if (!container) return;
  if (phienBTP.length === 0) {
    container.innerHTML = '<div class="btp-empty-log">Chưa có mã nào được quét</div>';
    return;
  }

  // Nhóm các mã quét theo ĐỢT (dotQuet) và mã đơn loại (msp, kg)
  const groupMap = new Map();
  phienBTP.forEach((item) => {
    const dot = item.dotQuet || 1;
    const msp = (item.msp || item.rawQR || 'KHAC').toUpperCase();
    const kgVal = (item.kg !== undefined && item.kg !== null) ? item.kg : 0;
    const key = `${dot}_${msp}_${kgVal}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key: key,
        dot: dot,
        msp: item.msp || item.rawQR || '—',
        kg: kgVal,
        items: [],
        lastThoiGian: item.thoiGian
      });
    }
    const g = groupMap.get(key);
    g.items.push(item);
    g.lastThoiGian = item.thoiGian;
  });

  const MAX_LIVE_LOG = 30;
  // Nhóm có lượt quét mới nhất hiển thị trên cùng
  const groups = Array.from(groupMap.values()).reverse();
  const displayedGroups = groups.slice(0, MAX_LIVE_LOG);

  let html = displayedGroups.map((g, idx) => taoHtmlNhomLogBTP(g, idx === 0)).join("");

  if (groups.length > MAX_LIVE_LOG) {
    const conLai = groups.length - MAX_LIVE_LOG;
    html += `<div style="text-align:center; padding:6px 0; font-size:11px; color:#64748b; font-style:italic;">... và ${conLai} loại mã trước đó (xem đầy đủ ở bảng kết quả)</div>`;
  }

  container.innerHTML = html;
  khoiTaoSuKienSwipeBTP();
}

function khiQuetDuocMaBTP(result) {
  if (!result || !dangQuetBTP) return;
  const rawText = typeof result.getText === "function" ? result.getText() : String(result);
  const data = xuLyDuLieuQRBTP(rawText);
  if (!data || !data.rawQR) return;

  const elCheck = document.getElementById("btp-cho-phep-trung-cam");
  const choPhepTrung = elCheck ? elCheck.checked : false;
  const keyQR = (data.id || data.rawQR || "").toLowerCase();

  if (window.ScannerCore && typeof window.ScannerCore.kiemTraKhoaMa === "function") {
    if (window.ScannerCore.kiemTraKhoaMa(mapKhoaBTP, keyQR, choPhepTrung)) return;
  } else {
    const lockMs = choPhepTrung ? 1500 : 500;
    const now = Date.now();
    if (mapKhoaBTP.has(keyQR) && (now - mapKhoaBTP.get(keyQR)) < lockMs) return;
    mapKhoaBTP.set(keyQR, now);
  }

  themMaVaoPhienBTP(data, rawText, 'cam_auto');
}

// ── [TỐI ƯU MỤC 6.6]: Debounce lưu phiên dở dang & tách biệt khỏi lịch sử 30 ngày ──
let debounceTimerLuuPhienBTP = null;
function luuPhienDoDangBTP() {
  if (debounceTimerLuuPhienBTP) clearTimeout(debounceTimerLuuPhienBTP);
  debounceTimerLuuPhienBTP = setTimeout(() => {
    debounceTimerLuuPhienBTP = null;
    luuPhienDoDangBTPNgay();
  }, 800);
}

function luuPhienDoDangBTPNgay() {
  if (debounceTimerLuuPhienBTP) {
    clearTimeout(debounceTimerLuuPhienBTP);
    debounceTimerLuuPhienBTP = null;
  }
  if (phienBTP.some(r => r.daGui !== undefined)) {
    soLuongDaGuiHienTaiBTP = phienBTP.filter(r => r.daGui).length;
  }
  try {
    localStorage.setItem(BTP_DODANG_KEY, JSON.stringify({
      phienBTP,
      ngayBTP: ngayBTP || layNgayHomNayBTP(),
      phienSoBTP: phienSoBTP || 1,
      capNhat: new Date().toISOString(),
      idPhienHienTaiBTP,
      soLuongDaGuiHienTaiBTP,
      demSoDotBTP
    }));
  } catch (e) {
    if (e && (e.name === "QuotaExceededError" || e.code === 22)) {
      showCanhBaoBTP("Bộ nhớ trình duyệt bị đầy! Vui lòng xóa bớt lịch sử cũ", "error");
    }
  }
  const trangChuEl = document.getElementById("trangChu");
  if (trangChuEl && trangChuEl.classList.contains("active") && typeof capNhatTrangChu === "function") {
    capNhatTrangChu();
  }
}

function xoaPhienDoDangBTP() {
  if (debounceTimerLuuPhienBTP) {
    clearTimeout(debounceTimerLuuPhienBTP);
    debounceTimerLuuPhienBTP = null;
  }
  try { localStorage.removeItem(BTP_DODANG_KEY); } catch (e) { }
  const trangChuEl = document.getElementById("trangChu");
  if (trangChuEl && trangChuEl.classList.contains("active") && typeof capNhatTrangChu === "function") {
    capNhatTrangChu();
  }
}

// ── [TỐI ƯU MỤC 7.7]: Hàm duy nhất khởi động Camera có cờ khóa Mutex ──
async function khoiDongCameraBTP() {
  if (dangKhoiTaoCamBTP) return;
  dangKhoiTaoCamBTP = true;

  try {
    const btpVid = document.getElementById("btp-reader");
    const btpTrack = btpVid && btpVid.srcObject ? btpVid.srcObject.getVideoTracks()[0] : null;
    const isCamRunningBTP = btpTrack && btpTrack.readyState === 'live';

    if (!zxingReaderBTP || !isCamRunningBTP) {
      if (typeof khoiTaoCameraFast === "function") {
        zxingReaderBTP = await khoiTaoCameraFast("btp-reader", (txt) => {
          if (txt && dangQuetBTP) {
            khiQuetDuocMaBTP({ getText: () => txt });
          }
        });
      }
    } else if (btpVid && btpVid.paused) {
      btpVid.play().catch(() => { });
    }
  } catch (e) {
    const msg = e && e.name === "NotAllowedError" ? "Quyền Camera bị từ chối! Vui lòng cấp quyền." : ("Lỗi Camera: " + (e.message || e));
    showCanhBaoBTP(msg, "error");
    dungBTP();
  } finally {
    dangKhoiTaoCamBTP = false;
  }
}

async function batDauBTP() {
  const ngayEl = document.getElementById("btp-ngay");
  if (ngayEl && !ngayEl.value) {
    ngayEl.value = layNgayHomNayBTP();
  }
  ngayBTP = (ngayEl && ngayEl.value) ? ngayEl.value : layNgayHomNayBTP();

  const phienEl = document.getElementById("btp-phien");
  phienSoBTP = phienEl ? (parseInt(phienEl.value, 10) || 1) : 1;

  let phienCu = null;
  try { phienCu = JSON.parse(localStorage.getItem(BTP_DODANG_KEY)); } catch (e) { }
  if (phienCu && Array.isArray(phienCu.phienBTP) && phienCu.phienBTP.length > 0) {
    if (typeof moXacNhanApp === "function") {
      moXacNhanApp(
        "Bạn đang có phiên BTP dở dang (" + phienCu.phienBTP.length + " mã, ngày " + (phienCu.ngayBTP || "hôm nay") + "). Bạn muốn tiếp tục hay bắt đầu mới?",
        () => { khoiPhucBTP(phienCu); },
        "Tiếp tục",
        () => { xoaPhienDoDangBTP(); batDauPhienMoiBTP(); },
        "Bắt đầu mới",
        "Phiên BTP dở dang"
      );
      return;
    }
  }

  batDauPhienMoiBTP();
}

async function batDauPhienMoiBTP() {
  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(true); else document.body.classList.add("cam-active");
  phienBTP = [];
  demSoDotBTP = 1;
  dangQuetBTP = true;
  window.dangQuetBTP = true;
  denPinBatBTP = false;
  idPhienHienTaiBTP = Date.now() + "-" + Math.random().toString(36).slice(2);
  soLuongDaGuiHienTaiBTP = 0;

  luuPhienDoDangBTPNgay();

  document.getElementById("btp-form").style.display = "none";
  document.getElementById("btp-cam").style.display = "block";
  document.getElementById("btp-ketqua").style.display = "none";
  document.getElementById("btp-dem").textContent = "Đã quét: 0 mã";
  const statusEl = document.getElementById("btp-status");
  if (statusEl) statusEl.innerHTML = '<div class="cam-status-dot"></div><span>Đợt 1</span>';
  maQRVuaQuetBTP = "";
  const lockStatusEl = document.getElementById("btp-lock-status");
  if (lockStatusEl) lockStatusEl.textContent = "Chờ quét...";

  capNhatLogBTP();
  capNhatBadgePendingBTP();

  const btnToggle = document.getElementById("btn-dung-tieptuc-btp");
  if (btnToggle) {
    btnToggle.innerHTML = SVG_SHUTTER_PAUSE;
    btnToggle.classList.remove("paused");
    btnToggle.title = "Dừng quét";
  }

  const pauseOverlay = document.getElementById("btp-cam-pause-overlay");
  if (pauseOverlay) pauseOverlay.style.display = "none";

  const cbTrung = document.getElementById("btp-cho-phep-trung-cam");
  if (cbTrung) cbTrung.checked = false;
  const btnTrung = document.getElementById("btn-quet-trung-btp");
  if (btnTrung) btnTrung.classList.remove("active-repeat");

  await khoiDongCameraBTP();
}

// ── [TỐI ƯU MỤC 7.1]: Dừng quét & quản lý Camera tiết kiệm pin K20 Pro ──
function dungBTP() {
  dangQuetBTP = false;
  window.dangQuetBTP = false;
  if (debounceTimerLuuPhienBTP) {
    luuPhienDoDangBTPNgay();
  }
  if (typeof dungCameraFast === "function") {
    dungCameraFast("btp-reader", zxingReaderBTP || window.zxingReaderBTP);
  }
  const statusEl = document.getElementById("btp-status");
  if (statusEl) statusEl.innerHTML = '<div class="cam-status-dot paused"></div><span>Đợt ' + (demSoDotBTP || 1) + '</span>';
  const btn = document.getElementById("btn-dung-tieptuc-btp");
  if (btn) {
    btn.innerHTML = SVG_SHUTTER_PLAY;
    btn.classList.add("paused");
    btn.title = "Quét tiếp";
  }
  const pauseOverlay = document.getElementById("btp-cam-pause-overlay");
  if (pauseOverlay) pauseOverlay.style.display = "flex";
}

async function tiepTucBTP() {
  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(true); else document.body.classList.add("cam-active");
  const maxDot = phienBTP.length > 0 ? Math.max(0, ...phienBTP.map(r => r.dotQuet || 1)) : 0;
  demSoDotBTP = maxDot > 0 ? maxDot + 1 : 1;
  dangQuetBTP = true;
  window.dangQuetBTP = true;

  luuPhienDoDangBTPNgay();
  const statusEl = document.getElementById("btp-status");
  if (statusEl) statusEl.innerHTML = '<div class="cam-status-dot"></div><span>Đợt ' + demSoDotBTP + '</span>';
  const btn = document.getElementById("btn-dung-tieptuc-btp");
  if (btn) {
    btn.innerHTML = SVG_SHUTTER_PAUSE;
    btn.classList.remove("paused");
    btn.title = "Dừng quét";
  }
  const pauseOverlay = document.getElementById("btp-cam-pause-overlay");
  if (pauseOverlay) pauseOverlay.style.display = "none";

  await khoiDongCameraBTP();
}

function toggleDungTiepTucBTP() {
  if (dangQuetBTP) {
    dungBTP();
  } else {
    tiepTucBTP();
  }
}

// ── Hàng chờ ngoại tuyến & Đồng bộ an toàn (Mục 6.2 & 6.5) ──
function docPendingBTP() {
  if (window.ScannerCore && typeof window.ScannerCore.docPending === "function") {
    return window.ScannerCore.docPending(BTP_PENDING_KEY);
  }
  try {
    const raw = localStorage.getItem(BTP_PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function luuPendingBTP(list) {
  if (window.ScannerCore && typeof window.ScannerCore.luuPending === "function") {
    window.ScannerCore.luuPending(BTP_PENDING_KEY, list);
  } else {
    try { localStorage.setItem(BTP_PENDING_KEY, JSON.stringify(list)); } catch (e) { }
  }
  capNhatBadgePendingBTP();
}

function capNhatBadgePendingBTP() {
  const pending = docPendingBTP();
  const count = pending.length;

  const btnCam = document.getElementById("btn-dongbo-btp");
  const countCam = document.getElementById("btp-pending-count");
  const btnForm = document.getElementById("btn-dongbo-btp-form");
  const countForm = document.getElementById("btp-pending-count-form");

  if (countCam) countCam.textContent = count;
  if (countForm) countForm.textContent = count;

  if (btnCam) btnCam.style.display = count > 0 ? "inline-flex" : "none";
  if (btnForm) btnForm.style.display = count > 0 ? "block" : "none";
}
window.capNhatBadgePendingBTP = capNhatBadgePendingBTP;

// [BẢO VỆ MỤC 6.2]: Đồng bộ ngoại tuyến với khóa Mutex chung và trừ theo recordId
async function dongBoThietBiBTP(isSilent = false) {
  if (dangDongBoBTP) return;
  const pending = docPendingBTP();
  if (pending.length === 0) {
    if (!isSilent) showCanhBaoBTP("Không có dữ liệu chờ gửi!", "info");
    return;
  }

  dangDongBoBTP = true;
  capNhatBadgePendingBTP();
  if (!isSilent) showCanhBaoBTP("Đang gửi " + pending.length + " bản ghi lên Sheet...", "info");

  try {
    await guiLenSheetBTP(pending);

    // CHỈ XÓA ĐÚNG CÁC BẢN GHI ĐÃ GỬI THÀNH CÔNG DỰA VÀO recordId HOẶC KHÓA DUY NHẤT
    const successKeys = new Set(pending.map(p => p.recordId || ((p.rawQR || p.id) + "_" + p.thoiGian)));
    const currentPending = docPendingBTP();
    const remainingPending = currentPending.filter(p => !successKeys.has(p.recordId || ((p.rawQR || p.id) + "_" + p.thoiGian)));
    luuPendingBTP(remainingPending);

    if (!isSilent) showCanhBaoBTP("✅ Đã đồng bộ thành công " + pending.length + " bản ghi!", "success");
  } catch (err) {
    if (!isSilent) showCanhBaoBTP("❌ Lỗi đồng bộ: " + (err.message || err), "error");
  } finally {
    dangDongBoBTP = false;
    capNhatBadgePendingBTP();
    if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
  }
}
window.dongBoThietBiBTP = dongBoThietBiBTP;

// ── [TỐI ƯU MỤC 7.3]: Gửi lên Sheet với AbortController timeout 15s và phân loại lỗi ──
async function guiLenSheetBTP(rows) {
  const URL_API = "https://script.google.com/macros/s/AKfycbxjnWLrJXZk1MJN4bSXdf72Wly7Of1Rc7iRtUNpcKk3iZDkxk-N1W7mE965tNMyhA9z1Q/exec";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let res;
  try {
    res = await fetch(URL_API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "luuBTP", data: rows }),
      signal: controller.signal
    });
  } catch (fetchErr) {
    clearTimeout(timeoutId);
    const errObj = new Error(fetchErr.name === 'AbortError' ? "Quá thời gian kết nối máy chủ (Timeout 15s)" : "Mất kết nối mạng hoặc máy chủ không phản hồi");
    errObj.isNetwork = true;
    throw errObj;
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    const httpErr = new Error("Lỗi máy chủ HTTP " + res.status);
    httpErr.isNetwork = false;
    throw httpErr;
  }

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    const parseErr = new Error("Phản hồi máy chủ không hợp lệ");
    parseErr.isNetwork = false;
    throw parseErr;
  }

  if (json && json.error) {
    const bizErr = new Error(json.error);
    bizErr.isNetwork = false;
    throw bizErr;
  }
}

// Khi xem kết quả: Tắt hẳn camera hardware để bảo vệ nhiệt độ máy K20 Pro
function xemKetQuaBTP() {
  dungBTP();
  if (typeof dungCameraFast === "function" && zxingReaderBTP) {
    try { dungCameraFast("btp-reader", zxingReaderBTP); } catch (e) { }
    zxingReaderBTP = null;
  }
  hienKetQuaBTP();
  luuPhienDoDangBTPNgay();
  luuVaoLichSuBTP();
  if (typeof kichHoatKiemTraAutoBackup === "function") kichHoatKiemTraAutoBackup(2000);
}
window.xemKetQuaBTP = xemKetQuaBTP;

// ── [BẢO VỆ MỤC 6.1]: Gửi dữ liệu an toàn, chống mất mã khi đang await ──
async function guiDuLieuBTP() {
  if (dangGuiDuLieuBTP) return;

  if (soLuongDaGuiHienTaiBTP > 0 && !phienBTP.some(r => r.daGui !== undefined)) {
    for (let i = 0; i < Math.min(soLuongDaGuiHienTaiBTP, phienBTP.length); i++) {
      phienBTP[i].daGui = true;
    }
  }

  const moiBoSung = phienBTP.filter(r => !r.daGui);
  if (moiBoSung.length === 0) {
    showCanhBaoBTP("Không có dữ liệu mới để gửi!", "info");
    return;
  }

  dangGuiDuLieuBTP = true;

  const btnGui = document.getElementById("btn-gui-dulieu-btp");
  if (btnGui) {
    btnGui.disabled = true;
    btnGui.innerHTML = '<i class="ti ti-loader spin"></i> Đang gửi ' + moiBoSung.length + ' mã...';
  }

  const rows = moiBoSung.map(r => ({
    recordId: r.recordId || ("btp_rec_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9)),
    rawQR: r.rawQR,
    id: r.id || r.rawQR,
    msp: r.msp,
    qc: r.qc || "",
    kg: r.kg,
    ngay: ngayBTP || layNgayHomNayBTP(),
    phien: phienSoBTP || 1,
    idPhien: idPhienHienTaiBTP,
    thoiGian: r.thoiGian ? (typeof r.thoiGian.toISOString === "function" ? r.thoiGian.toISOString() : r.thoiGian) : new Date().toISOString()
  }));

  try {
    await guiLenSheetBTP(rows);

    moiBoSung.forEach(r => { r.daGui = true; });
    soLuongDaGuiHienTaiBTP = phienBTP.filter(r => r.daGui).length;

    luuPhienDoDangBTPNgay();
    luuVaoLichSuBTP();

    showCanhBaoBTP("Đã gửi thành công " + rows.length + " mã lên Sheet!", "success");
    if (btnGui) {
      btnGui.disabled = false;
      const daGuiHet = soLuongDaGuiHienTaiBTP >= phienBTP.length && phienBTP.length > 0;
      btnGui.classList.toggle("is-done", daGuiHet);
      btnGui.classList.toggle("is-pending", !daGuiHet && phienBTP.length > 0);
      btnGui.innerHTML = '<i class="ti ti-circle-check"></i> Đã gửi đủ dữ liệu (' + soLuongDaGuiHienTaiBTP + '/' + phienBTP.length + ')';
    }
  } catch (err) {
    // [BẢO VỆ MỤC 6.1]: Khi lỗi, giữ nguyên trạng thái chưa đánh dấu daGui = true và đồng bộ lại bộ đếm
    soLuongDaGuiHienTaiBTP = phienBTP.filter(r => r.daGui).length;

    // Lưu vào pending chờ gửi bù
    const pending = docPendingBTP();
    rows.forEach(r => {
      if (!pending.some(p => p.recordId === r.recordId || ((p.rawQR || p.id) === (r.rawQR || r.id) && p.thoiGian === r.thoiGian))) {
        pending.push(r);
      }
    });
    luuPendingBTP(pending);

    if (err.isNetwork) {
      showCanhBaoBTP("Mất mạng — đã lưu " + rows.length + " mã vào hàng chờ trên máy", "warning");
    } else {
      showCanhBaoBTP("Lỗi gửi: " + (err.message || err) + " — đã lưu vào hàng chờ", "error");
    }

    if (btnGui) {
      btnGui.disabled = false;
      btnGui.classList.remove("is-done");
      btnGui.classList.toggle("is-pending", phienBTP.length > 0);
      btnGui.innerHTML = '<i class="ti ti-cloud-upload"></i> Thử gửi lại lên Sheet';
    }
  } finally {
    dangGuiDuLieuBTP = false;
    if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
  }
}
window.guiDuLieuBTP = guiDuLieuBTP;

async function ketThucBTP() {
  xemKetQuaBTP();
}

// ── Xây dựng bảng kết quả (Chi tiết & Tổng hợp gom loại) ──
// ── Quản lý trạng thái Accordion Bảng Kết Quả BTP ──────────────────
window.expandedKQBTP = window.expandedKQBTP || new Set();

function toggleChiTietKQBTP(groupKey) {
  if (window.expandedKQBTP.has(groupKey)) {
    window.expandedKQBTP.delete(groupKey);
  } else {
    window.expandedKQBTP.add(groupKey);
  }
  const keyB64 = btoa(encodeURIComponent(groupKey));
  const safeId = 'btp-kq-grp-' + keyB64.replace(/[^a-zA-Z0-9]/g, '');
  const detailsEl = document.getElementById('details-' + safeId);
  const chevEl = document.getElementById('chev-' + safeId);
  if (detailsEl && chevEl) {
    const isOpen = window.expandedKQBTP.has(groupKey);
    detailsEl.style.display = isOpen ? 'block' : 'none';
    if (isOpen) chevEl.classList.add('open'); else chevEl.classList.remove('open');
  } else {
    thucHienLocKetQuaBTP();
  }
}
window.toggleChiTietKQBTP = toggleChiTietKQBTP;

function toggleChiTietKQBTPByB64(keyB64) {
  let targetKey = "";
  try {
    targetKey = decodeURIComponent(atob(keyB64));
  } catch (e) {
    targetKey = keyB64;
  }
  toggleChiTietKQBTP(targetKey);
}
window.toggleChiTietKQBTPByB64 = toggleChiTietKQBTPByB64;

function khoiTaoSwipeKQBTP() {
  if (window.ScannerCore && typeof window.ScannerCore.khoiTaoSwipe === "function") {
    window.ScannerCore.khoiTaoSwipe("btp-tbody-dot", ".kq-swipe-content", "__swipeKqInit");
  }
}

// ── Xây dựng bảng kết quả BTP (Accordion Đợt & Tổng hợp gom loại) ──
function taoHangKetQuaBTP(danhSach, tuKhoa = "") {
  let hangDot = "";
  let tongQRAll = danhSach.length;
  let tongGomLoaiMa = {};
  tuKhoa = String(tuKhoa || "").trim().toLowerCase();

  // Nhóm theo Đợt + MSP + KG
  const groupMap = new Map();
  danhSach.forEach(item => {
    const dot = item.dotQuet || 1;
    const msp = (item.msp || item.rawQR || 'KHAC').toUpperCase();
    const kgVal = (item.kg !== undefined && item.kg !== null) ? item.kg : 0;
    const key = `${dot}_${msp}_${kgVal}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key: key,
        dot: dot,
        msp: item.msp || item.rawQR || '—',
        kg: kgVal,
        items: []
      });
    }
    groupMap.get(key).items.push(item);

    // Gom cho bảng Tổng Hợp (theo Đơn + Loại)
    const keyGom = msp + "_" + kgVal;
    if (!tongGomLoaiMa[keyGom]) {
      tongGomLoaiMa[keyGom] = {
        msp: item.msp || item.rawQR || "—",
        soMat: kgVal || "—",
        soLuong: 0
      };
    }
    tongGomLoaiMa[keyGom].soLuong++;
  });

  const allGroups = Array.from(groupMap.values());
  const filteredGroups = allGroups.filter(g => {
    if (!tuKhoa) return true;
    const mspStr = String(g.msp || "").toLowerCase();
    const kgStr = String(g.kg || "").toLowerCase();
    const dotStr = String(g.dot);
    return mspStr.includes(tuKhoa) || kgStr.includes(tuKhoa) || dotStr.includes(tuKhoa) ||
      g.items.some(it => String(it.rawQR || "").toLowerCase().includes(tuKhoa));
  });

  if (filteredGroups.length === 0) {
    hangDot = '<div style="text-align:center; padding:24px; color:var(--text-lighter); font-size:13px;">Không tìm thấy dữ liệu phù hợp</div>';
  } else {
    hangDot = filteredGroups.map(g => {
      const safeMsp = anToanHtmlBTP(g.msp);
      const keyB64 = btoa(encodeURIComponent(g.key));
      const safeId = 'btp-kq-grp-' + keyB64.replace(/[^a-zA-Z0-9]/g, '');
      const isOpen = window.expandedKQBTP.has(g.key);
      const countBadge = g.items.length > 1 ? `<span class="kq-badge-count">×${g.items.length}</span>` : '';
      const kgText = (g.kg !== undefined && g.kg !== null && Number(g.kg) > 0) ? anToanHtmlBTP(g.kg) : '—';

      let subItemsHtml = g.items.map((it, subIdx) => {
        const subGio = it.thoiGian ? new Date(it.thoiGian).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
        const subKg = (it.kg !== undefined && it.kg !== null && Number(it.kg) > 0) ? anToanHtmlBTP(it.kg) : (Number(g.kg) > 0 ? anToanHtmlBTP(g.kg) : '0');
        const safeSubMsp = anToanHtmlBTP(it.rawQR || it.msp || g.msp);
        const safeUid = anToanHtmlBTP(it.uid || ("idx_" + subIdx));

        return `<div class="kq-sub-item">
          <span class="kq-sub-stt">${subIdx + 1}</span>
          <span class="kq-sub-name" title="${safeSubMsp}">${safeSubMsp}</span>
          <span class="kq-sub-val">${subKg}</span>
          <span class="kq-sub-time">${subGio}</span>
          <button type="button" class="kq-sub-del-btn" onclick="xoaMaBTP('${safeUid}', event)" title="Xóa mã này">
            <i class="ti ti-trash"></i>
          </button>
        </div>`;
      }).join("");

      return `
      <div class="kq-swipe-container">
        <div class="kq-swipe-row-wrap">
          <div class="kq-swipe-actions">
            <button type="button" class="kq-swipe-btn-del" onclick="xoaNhomBTPByB64('${keyB64}', event)">
              <i class="ti ti-trash"></i>
              <span>Xóa</span>
            </button>
          </div>
          <div class="kq-swipe-content" onclick="toggleChiTietKQBTPByB64('${keyB64}')">
            <span class="kq-col-dot">Đợt ${g.dot}</span>
            <div class="kq-col-name">
              <span>${safeMsp}</span>
              ${countBadge}
            </div>
            <span class="kq-col-count" style="color:var(--success); font-weight:700;">${kgText}</span>
            <span class="kq-col-kg" style="color:var(--row-text); font-weight:700;">${g.items.length} mã</span>
            <span class="kq-col-chevron"><i id="chev-${safeId}" class="ti ti-chevron-down ${isOpen ? 'open' : ''}"></i></span>
          </div>
        </div>
        <div id="details-${safeId}" class="kq-group-details" style="display:${isOpen ? 'block' : 'none'};">
          ${subItemsHtml}
        </div>
      </div>`;
    }).join("");
  }

  const tongSoDot = new Set(danhSach.map(r => r.dotQuet || 1)).size;
  let footDot = `
    <div style="flex:0.8; font-weight:700; color:var(--row-text);">TỔNG</div>
    <div style="flex:1.8; color:var(--row-muted);">${tongSoDot} đợt</div>
    <div style="flex:0.7;">&nbsp;</div>
    <div style="flex:1; text-align:right; font-weight:800; font-family:'IBM Plex Mono', monospace; color:var(--success);">${tongQRAll} mã</div>
    <div style="width:22px;"></div>`;

  // Render HTML Bảng Tổng Hợp BTP (theo Đơn + Loại)
  let hangGom = "";
  const danhSachGom = Object.values(tongGomLoaiMa).sort((a, b) => {
    const cmpMsp = String(a.msp || "").localeCompare(String(b.msp || ""), undefined, { numeric: true, sensitivity: 'base' });
    if (cmpMsp !== 0) return cmpMsp;
    return (parseFloat(b.soMat) || 0) - (parseFloat(a.soMat) || 0);
  });

  const filteredGom = danhSachGom.filter(item => {
    if (!tuKhoa) return true;
    const mspStr = String(item.msp || "").toLowerCase();
    const soMatStr = String(item.soMat || "").toLowerCase();
    return mspStr.includes(tuKhoa) || soMatStr.includes(tuKhoa);
  });

  if (filteredGom.length === 0) {
    hangGom = '<div style="text-align:center; padding:24px; color:var(--text-lighter); font-size:13px;">Chưa có dữ liệu</div>';
  } else {
    hangGom = filteredGom.map(item => `
      <div class="kq-gom-row">
        <div style="flex:1.8; font-weight:700; font-family:'IBM Plex Mono', monospace; color:var(--row-text);">${anToanHtmlBTP(item.msp)}</div>
        <div style="flex:1; text-align:center; font-weight:700; color:var(--row-muted);">${anToanHtmlBTP(item.soMat)}</div>
        <div style="flex:1; text-align:right; font-weight:800; font-family:'IBM Plex Mono', monospace; color:var(--success);">${item.soLuong}</div>
      </div>`).join("");
  }

  let footGom = `
    <div style="flex:1.8; font-weight:700; color:var(--row-text);">TỔNG</div>
    <div style="flex:1;">&nbsp;</div>
    <div style="flex:1; text-align:right; font-weight:800; font-family:'IBM Plex Mono', monospace; color:var(--success);">${tongQRAll}</div>`;

  return { hangDot, footDot, hangGom, footGom };
}

// ── [TỐI ƯU MỤC 6.3]: Tách riêng hàm lọc kết quả có Debounce, không đụng nút Gửi ──
let debounceTimerLocKetQuaBTP = null;
function locKetQuaBTP() {
  if (debounceTimerLocKetQuaBTP) clearTimeout(debounceTimerLocKetQuaBTP);
  debounceTimerLocKetQuaBTP = setTimeout(() => {
    thucHienLocKetQuaBTP();
  }, 200);
}
window.locKetQuaBTP = locKetQuaBTP;

function thucHienLocKetQuaBTP() {
  const oTim = document.getElementById("btp-ketqua-search");
  const tuKhoa = oTim ? oTim.value.trim() : "";
  const { hangDot, footDot, hangGom, footGom } = taoHangKetQuaBTP(phienBTP, tuKhoa);

  const elDot = document.getElementById("btp-tbody-dot");
  const elFootDot = document.getElementById("btp-tfoot-dot");
  const elGom = document.getElementById("btp-tbody-gom");
  const elFootGom = document.getElementById("btp-tfoot-gom");

  if (elDot) elDot.innerHTML = hangDot;
  if (elFootDot) elFootDot.innerHTML = footDot;
  if (elGom) elGom.innerHTML = hangGom;
  if (elFootGom) elFootGom.innerHTML = footGom;

  khoiTaoSwipeKQBTP();

  // Cập nhật Khung Tóm Tắt (Đợt / Tổng)
  const elTongDot = document.getElementById("btp-tong-cuon");
  const elTongSL = document.getElementById("btp-tong-kg");
  if (elTongDot) elTongDot.textContent = phienBTP.length > 0 ? new Set(phienBTP.map(r => r.dotQuet || 1)).size : 0;
  if (elTongSL) elTongSL.textContent = phienBTP.length;
}

function hienKetQuaBTP() {
  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(false); else document.body.classList.remove("cam-active");

  thucHienLocKetQuaBTP();

  // Cập nhật Khung Tóm Tắt (Đợt / Tổng)
  const elTongDot = document.getElementById("btp-tong-cuon");
  const elTongSL = document.getElementById("btp-tong-kg");
  if (elTongDot) elTongDot.textContent = phienBTP.length > 0 ? new Set(phienBTP.map(r => r.dotQuet || 1)).size : 0;
  if (elTongSL) elTongSL.textContent = phienBTP.length;

  document.getElementById("btp-cam").style.display = "none";
  document.getElementById("btp-ketqua").style.display = "block";

  // Mặc định hiển thị Bảng Chi tiết
  if (typeof toggleBTPView === 'function') toggleBTPView('chitiet');

  // [BẢO VỆ MỤC 6.3]: Chỉ reset nút gửi khi KHÔNG TRONG QUÁ TRÌNH GỬI
  if (!dangGuiDuLieuBTP) {
    const btnGui = document.getElementById("btn-gui-dulieu-btp");
    if (btnGui) {
      btnGui.disabled = false;
      const daGuiHet = soLuongDaGuiHienTaiBTP >= phienBTP.length && phienBTP.length > 0;
      btnGui.classList.toggle("is-done", daGuiHet);
      btnGui.classList.toggle("is-pending", !daGuiHet && phienBTP.length > 0);
      if (daGuiHet) {
        btnGui.innerHTML = '<i class="ti ti-circle-check"></i> Đã gửi đủ dữ liệu (' + soLuongDaGuiHienTaiBTP + '/' + phienBTP.length + ')';
      } else {
        btnGui.innerHTML = '<i class="ti ti-cloud-upload"></i> Gửi dữ liệu lên Sheet';
      }
    }
  }
}

async function quetTiepBTP() {
  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(true); else document.body.classList.add("cam-active");
  const maxDot = phienBTP.length > 0 ? Math.max(0, ...phienBTP.map(r => r.dotQuet || 1)) : 0;
  demSoDotBTP = maxDot > 0 ? maxDot + 1 : 1;
  dangQuetBTP = true;
  window.dangQuetBTP = true;
  denPinBatBTP = false;

  document.getElementById("btp-ketqua").style.display = "none";
  document.getElementById("btp-cam").style.display = "block";
  document.getElementById("btp-status").innerHTML = '<div class="cam-status-dot"></div><span>Đợt ' + demSoDotBTP + '</span>';

  const lastItemBTP = phienBTP.length > 0 ? phienBTP[phienBTP.length - 1] : null;
  maQRVuaQuetBTP = lastItemBTP ? (lastItemBTP.rawQR || lastItemBTP.id || lastItemBTP.msp || "") : "";
  const lockStatusEl = document.getElementById("btp-lock-status");
  if (lockStatusEl) {
    lockStatusEl.textContent = maQRVuaQuetBTP || "Chờ quét...";
    lockStatusEl.title = maQRVuaQuetBTP || "";
  }

  const btnToggle = document.getElementById("btn-dung-tieptuc-btp");
  if (btnToggle) {
    btnToggle.innerHTML = SVG_SHUTTER_PAUSE;
    btnToggle.classList.remove("paused");
    btnToggle.title = "Dừng quét";
  }

  const pauseOverlay = document.getElementById("btp-cam-pause-overlay");
  if (pauseOverlay) pauseOverlay.style.display = "none";

  luuPhienDoDangBTPNgay();
  await khoiDongCameraBTP();
}

async function quetMoiBTP() {
  if (typeof moXacNhanApp === "function") {
    moXacNhanApp(
      "Bắt đầu phiên quét BTP hoàn toàn mới?",
      () => {
        luuVaoLichSuBTP();
        xoaPhienDoDangBTP();
        batDauPhienMoiBTP();
      },
      "Bắt đầu mới",
      null,
      "Hủy",
      "Phiên BTP mới"
    );
  } else {
    luuVaoLichSuBTP();
    xoaPhienDoDangBTP();
    batDauPhienMoiBTP();
  }
}

async function saoChepMaQRBTP(e) {
  if (e) e.stopPropagation();
  if (window.ScannerCore && typeof window.ScannerCore.saoChepMaQR === "function") {
    await window.ScannerCore.saoChepMaQR(maQRVuaQuetBTP, "icon-copy-btp", "btn-copy-btp", showCanhBaoBTP);
  }
}
window.saoChepMaQRBTP = saoChepMaQRBTP;

// ── [TỐI ƯU MỤC 7.5]: Thông báo chuẩn xác về màu sắc ──
let timerCanhBaoBTP = null;
function showCanhBaoBTP(text, type = "info") {
  if (typeof text === "string") {
    const textLower = text.toLowerCase();
    if (type === "info" && (textLower.includes("thành công") || textLower.includes("đã thêm") || textLower.includes("đã sao chép") || textLower.includes("✅"))) {
      type = "success";
    }
  }

  if (typeof showCanhBao === "function") {
    showCanhBao(text, type);
    return;
  }

  const el = document.getElementById("canh-bao");
  if (!el) return;
  text = typeof rutGonThongBaoLoi === "function" ? rutGonThongBaoLoi(text) : text;
  el.textContent = text;

  if (type === "success") {
    el.style.background = "linear-gradient(135deg, #10b981, #059669)";
    el.style.boxShadow = "0 8px 24px rgba(16, 185, 129, .4)";
    el.style.color = "#ffffff";
  } else if (type === "warning") {
    el.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
    el.style.boxShadow = "0 8px 24px rgba(245, 158, 11, .4)";
    el.style.color = "#1a1a2e";
  } else if (type === "info") {
    el.style.background = "linear-gradient(135deg, #3b82f6, #1d4ed8)";
    el.style.boxShadow = "0 8px 24px rgba(59, 130, 246, .4)";
    el.style.color = "#ffffff";
  } else {
    el.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
    el.style.boxShadow = "0 8px 24px rgba(239, 68, 68, .4)";
    el.style.color = "#ffffff";
  }

  el.style.display = "block";
  if (timerCanhBaoBTP) clearTimeout(timerCanhBaoBTP);
  timerCanhBaoBTP = setTimeout(() => {
    if (el) el.style.display = "none";
  }, 2200);
}
window.showCanhBaoBTP = showCanhBaoBTP;

// ── [TỐI ƯU MỤC 7.6]: Khôi phục phiên dở dang an toàn, kiểm tra dữ liệu chặt chẽ ──
async function khoiPhucBTP(state) {
  if (!state || typeof state !== "object") {
    showCanhBaoBTP("Dữ liệu phiên khôi phục không hợp lệ", "error");
    return;
  }

  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(true); else document.body.classList.add("cam-active");

  const rawList = Array.isArray(state.phienBTP) ? state.phienBTP : [];
  phienBTP = rawList.map((r, i) => ({
    ...r,
    uid: r.uid || ("btp_rec_" + Date.now() + "_" + i),
    thoiGian: r.thoiGian ? new Date(r.thoiGian) : new Date()
  }));

  demSoDotBTP = parseInt(state.demSoDotBTP, 10) || 1;
  ngayBTP = state.ngayBTP || state.ngay || layNgayHomNayBTP();
  const ngayEl = document.getElementById("btp-ngay");
  if (ngayEl && ngayBTP) ngayEl.value = ngayBTP;

  phienSoBTP = parseInt(state.phienSoBTP || state.phienSo || state.phien, 10) || 1;
  if (typeof chonPhienBTP === "function") chonPhienBTP(phienSoBTP);

  idPhienHienTaiBTP = state.idPhienHienTaiBTP || state.idPhien || (Date.now() + "-" + Math.random().toString(36).slice(2));
  soLuongDaGuiHienTaiBTP = typeof state.soLuongDaGuiHienTaiBTP === "number"
    ? state.soLuongDaGuiHienTaiBTP
    : (typeof state.soLuongDaGui === "number" ? state.soLuongDaGui : 0);
  dangQuetBTP = true;
  window.dangQuetBTP = true;
  denPinBatBTP = false;

  luuPhienDoDangBTPNgay();

  document.getElementById("btp-form").style.display = "none";
  document.getElementById("btp-cam").style.display = "block";
  document.getElementById("btp-ketqua").style.display = "none";
  document.getElementById("btp-dem").textContent = "Đã quét: " + phienBTP.length + " mã";
  const statusEl = document.getElementById("btp-status");
  if (statusEl) statusEl.innerHTML = '<div class="cam-status-dot"></div><span>Đợt ' + demSoDotBTP + '</span>';

  const lastItemBTP = phienBTP.length > 0 ? phienBTP[phienBTP.length - 1] : null;
  maQRVuaQuetBTP = lastItemBTP ? (lastItemBTP.rawQR || lastItemBTP.id || lastItemBTP.msp || "") : "";
  const lockStatusEl = document.getElementById("btp-lock-status");
  if (lockStatusEl) {
    lockStatusEl.textContent = maQRVuaQuetBTP || "Chờ quét...";
    lockStatusEl.title = maQRVuaQuetBTP || "";
  }

  capNhatLogBTP();
  capNhatBadgePendingBTP();

  const btnToggle = document.getElementById("btn-dung-tieptuc-btp");
  if (btnToggle) {
    btnToggle.innerHTML = SVG_SHUTTER_PAUSE;
    btnToggle.classList.remove("paused");
    btnToggle.title = "Dừng quét";
  }

  const pauseOverlay = document.getElementById("btp-cam-pause-overlay");
  if (pauseOverlay) pauseOverlay.style.display = "none";

  await khoiDongCameraBTP();
}

function tiepTucPhienBTP() {
  let state = null;
  try {
    state = JSON.parse(localStorage.getItem(BTP_DODANG_KEY));
  } catch (e) {
    showCanhBaoBTP("Lỗi đọc dữ liệu phiên dở dang", "error");
    return;
  }
  if (!state) {
    showCanhBaoBTP("Không tìm thấy dữ liệu phiên dở dang", "warning");
    return;
  }
  if (typeof diToiTab === "function") diToiTab("btpPage");
  else if (typeof chuyenTrang === "function") chuyenTrang("btpPage");

  try {
    khoiPhucBTP(state);
  } catch (err) {
    showCanhBaoBTP("Lỗi khôi phục: " + (err.message || err), "error");
  }
}

function huyPhienBTP() {
  xoaPhienDoDangBTP();
  const trangChuEl = document.getElementById("trangChu");
  if (trangChuEl && trangChuEl.classList.contains("active") && typeof capNhatTrangChu === "function") {
    capNhatTrangChu();
  }
}

// ── Lịch sử quét BTP (30 ngày) ──
function docLichSuBTP() {
  const homNay = new Date();
  homNay.setHours(0, 0, 0, 0);
  const filterFn = s => {
    if (!s) return false;
    if (!s.ngay) return true;
    const ngayPhien = new Date(s.ngay + "T00:00:00");
    const soNgayCach = Math.floor((homNay - ngayPhien) / 86400000);
    const chuaGuiXong = (s.soLuongDaGui || 0) < (s.phienBTP ? s.phienBTP.length : 0);
    return chuaGuiXong || (soNgayCach >= 0 && soNgayCach < BTP_LICHSU_SO_NGAY_GIU);
  };
  if (window.ScannerCore && typeof window.ScannerCore.docLichSu === "function") {
    return window.ScannerCore.docLichSu(BTP_LICHSU_KEY, filterFn);
  }
  let list = [];
  try { list = JSON.parse(localStorage.getItem(BTP_LICHSU_KEY)) || []; } catch (e) { list = []; }
  return list.filter(filterFn);
}

function luuLichSuBTP(list) {
  if (window.ScannerCore && typeof window.ScannerCore.luuLichSu === "function") {
    window.ScannerCore.luuLichSu(BTP_LICHSU_KEY, list);
    return;
  }
  try { localStorage.setItem(BTP_LICHSU_KEY, JSON.stringify(list)); } catch (e) { }
}

function xoaMotPhienLichSuBTP(idPhien, ev) {
  if (ev) ev.stopPropagation();
  if (typeof moXacNhanApp === "function") {
    moXacNhanApp(
      "Xóa phiên lịch sử BTP này? Không thể hoàn tác.",
      () => {
        luuLichSuBTP(docLichSuBTP().filter(s => s.idPhien !== idPhien));
        renderLichSuBTP();
      },
      "Xóa",
      null,
      "Hủy",
      "Xóa phiên lịch sử"
    );
  }
}
window.xoaMotPhienLichSuBTP = xoaMotPhienLichSuBTP;

function xoaTatCaLichSuBTP() {
  const list = docLichSuBTP();
  if (list.length === 0) { showCanhBaoBTP("Không có lịch sử BTP để xóa", "info"); return; }
  if (typeof moXacNhanApp === "function") {
    moXacNhanApp(
      "Xóa toàn bộ " + list.length + " phiên lịch sử BTP? Không thể hoàn tác.",
      () => {
        luuLichSuBTP([]);
        renderLichSuBTP();
      },
      "Xóa tất cả",
      null,
      "Hủy",
      "Xóa tất cả lịch sử"
    );
  }
}
window.xoaTatCaLichSuBTP = xoaTatCaLichSuBTP;

function luuVaoLichSuBTP() {
  if (!idPhienHienTaiBTP) return;
  const list = docLichSuBTP();
  if (phienBTP.length === 0) {
    const filtered = list.filter(s => s.idPhien !== idPhienHienTaiBTP);
    luuLichSuBTP(filtered);
    return;
  }
  const idx = list.findIndex(s => s.idPhien === idPhienHienTaiBTP);
  const banGhi = {
    idPhien: idPhienHienTaiBTP,
    ngay: ngayBTP || layNgayHomNayBTP(),
    phienSo: phienSoBTP || 1,
    capNhatLuc: new Date().toISOString(),
    phienBTP: phienBTP,
    demSoDotBTP: demSoDotBTP,
    soLuongDaGui: soLuongDaGuiHienTaiBTP
  };
  if (idx >= 0) list[idx] = banGhi; else list.push(banGhi);
  luuLichSuBTP(list);
}

function moLichSuBTP() {
  renderLichSuBTP();
  if (typeof chuyenTrangKhongNav === "function") chuyenTrangKhongNav("lichSuBTP");
}
window.moLichSuBTP = moLichSuBTP;

function renderLichSuBTP() {
  const container = document.getElementById("lichsu-btp-list");
  if (!container) return;
  const oTim = document.getElementById("lichsu-btp-tim");
  const tuKhoa = oTim ? oTim.value.trim().toLowerCase() : "";

  let list = docLichSuBTP().slice().sort((a, b) => new Date(b.capNhatLuc) - new Date(a.capNhatLuc));
  if (tuKhoa) {
    list = list.filter(s =>
      (s.ngay || "").toLowerCase().includes(tuKhoa) ||
      (s.phienBTP && s.phienBTP.some(r =>
        (r.msp || "").toLowerCase().includes(tuKhoa) ||
        (r.rawQR || "").toLowerCase().includes(tuKhoa)
      ))
    );
  }

  if (list.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:32px 16px; color:var(--row-muted); font-size:14px;">Chưa có lịch sử phiên quét BTP nào</div>';
    return;
  }

  container.innerHTML = list.map(s => {
    const total = s.phienBTP ? s.phienBTP.length : 0;
    const dotCount = s.phienBTP ? new Set(s.phienBTP.map(r => r.dotQuet || 1)).size : (s.demSoDotBTP || 1);
    const timeStr = s.capNhatLuc ? new Date(s.capNhatLuc).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "";
    const parts = s.ngay ? s.ngay.split("-") : [];
    const ngayNgan = parts.length === 3 ? parts[2] + "/" + parts[1] : (s.ngay || "—");
    const daGui = (s.soLuongDaGui || 0) >= total && total > 0;
    const trangThai = daGui
      ? '<i class="ti ti-check cx5-trangthai-ok" title="Đã gửi Sheet"></i>'
      : '<i class="ti ti-x cx5-trangthai-mot-phan" title="Chưa gửi hết (' + (s.soLuongDaGui || 0) + '/' + total + ')"></i>';

    return '<div class="irow lichsu-row lichsu-card-row" onclick="xemChiTietLichSuBTP(\'' + s.idPhien + '\')">'
      + '<div class="ls-col-main">'
      + '<div class="ls-row-top"><span class="ls-date">' + ngayNgan + '</span><span class="ls-time">' + timeStr + '</span></div>'
      + '<div class="ls-row-metrics"><span class="ls-metric-pill"><b>' + dotCount + '</b> đợt</span><span class="ls-metric-pill ls-metric-kg"><b>' + total + '</b> mã BTP</span></div>'
      + '</div>'
      + '<div class="ls-col-actions">'
      + trangThai
      + '<button class="lichsu-del-btn" aria-label="Xóa phiên này" title="Xóa phiên này" onclick="xoaMotPhienLichSuBTP(\'' + s.idPhien + '\', event)"><i class="ti ti-trash"></i></button>'
      + '</div>'
      + '</div>';
  }).join("");
}

let hienThiPhienLichSuHienTaiBTP = null;
function xemChiTietLichSuBTP(idPhien) {
  const list = docLichSuBTP();
  const session = list.find(s => s.idPhien === idPhien);
  if (!session) {
    showCanhBaoBTP("Không tìm thấy phiên lịch sử", "error");
    return;
  }
  hienThiPhienLichSuHienTaiBTP = session;

  const tieuDe = document.getElementById("lichsu-btp-chitiet-tieude");
  if (tieuDe) {
    const ngayStr = session.ngay ? session.ngay.split("-").reverse().join("/") : "—";
    tieuDe.textContent = "Chi tiết BTP (" + ngayStr + ")";
  }

  const { hangDot, footDot, hangGom, footGom } = taoHangKetQuaBTP(session.phienBTP || []);
  const elDot = document.getElementById("lichsu-btp-tbody-dot");
  const elFootDot = document.getElementById("lichsu-btp-tfoot-dot");
  const elGom = document.getElementById("lichsu-btp-tbody-gom");
  const elFootGom = document.getElementById("lichsu-btp-tfoot-gom");

  if (elDot) elDot.innerHTML = hangDot;
  if (elFootDot) elFootDot.innerHTML = footDot;
  if (elGom) elGom.innerHTML = hangGom;
  if (elFootGom) elFootGom.innerHTML = footGom;

  if (typeof chuyenTrangKhongNav === "function") chuyenTrangKhongNav("lichSuBTPChiTiet");
}
window.xemChiTietLichSuBTP = xemChiTietLichSuBTP;

function tiepTucTuChiTietLichSuBTP() {
  if (!hienThiPhienLichSuHienTaiBTP) return;
  const entry = hienThiPhienLichSuHienTaiBTP;
  if (typeof diToiTab === "function") diToiTab("btpPage");
  else if (typeof chuyenTrang === "function") chuyenTrang("btpPage");
  khoiPhucBTP({
    phienBTP: entry.phienBTP,
    demSoDotBTP: entry.demSoDotBTP,
    ngayBTP: entry.ngay,
    phienSoBTP: entry.phienSoBTP || entry.phienSo || entry.phien || 1,
    idPhienHienTaiBTP: entry.idPhien,
    soLuongDaGuiHienTaiBTP: entry.soLuongDaGui
  });
}
window.tiepTucTuChiTietLichSuBTP = tiepTucTuChiTietLichSuBTP;

// ── [TỐI ƯU MỤC 7.4]: Xuất CSV / Excel an toàn chống CSV Injection ──
function anToanCongThucExcel(str) {
  if (str === null || str === undefined) return "";
  const s = String(str);
  if (/^[=+\-@\t\r]/.test(s)) {
    return "'" + s;
  }
  return s;
}

function xuatCSVBTP() {
  if (phienBTP.length === 0) { showCanhBaoBTP("Chưa có dữ liệu để xuất", "warning"); return; }
  const header = ["Dot", "Mã QR Gốc", "Mã BTP", "Loại", "Thời Gian"];
  const rows = phienBTP.map(r => [
    r.dotQuet || 1,
    anToanCongThucExcel(r.rawQR),
    anToanCongThucExcel(r.msp),
    anToanCongThucExcel(r.kg),
    r.thoiGian ? (typeof r.thoiGian.toISOString === "function" ? r.thoiGian.toISOString() : r.thoiGian) : ""
  ]);

  const escapeCSV = v => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map(row => row.map(escapeCSV).join(",")).join("\r\n");
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ngay = ngayBTP || layNgayHomNayBTP();
  a.href = url;
  a.download = "btp-" + ngay + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Trì hoãn thu hồi URL 1 giây để bảo đảm trình duyệt di động tải file hoàn tất
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function xuatExcelBTP() {
  if (!phienBTP || phienBTP.length === 0) {
    showCanhBaoBTP("Chưa có dữ liệu để xuất", "warning");
    return;
  }
  const ngay = ngayBTP || layNgayHomNayBTP();
  const data = phienBTP.map((r, i) => ({
    "STT": i + 1,
    "Đợt": r.dotQuet || 1,
    "Ngày": ngay,
    "Mã QR Gốc": anToanCongThucExcel(r.rawQR),
    "Mã BTP": anToanCongThucExcel(r.msp),
    "Loại": anToanCongThucExcel(r.kg),
    "Thời gian": r.thoiGian ? new Date(r.thoiGian).toLocaleTimeString("vi-VN") : ""
  }));

  if (typeof exportToExcel === "function") {
    exportToExcel("Quet_BTP_" + ngay, "BTP", data);
  }
}
window.xuatExcelBTP = xuatExcelBTP;

function xuatExcelLichSuBTP() {
  const target = hienThiPhienLichSuHienTaiBTP ? [hienThiPhienLichSuHienTaiBTP] : docLichSuBTP();
  if (target.length === 0) {
    showCanhBaoBTP("Không có dữ liệu lịch sử để xuất", "warning");
    return;
  }

  const data = [];
  let stt = 1;
  target.forEach(s => {
    const list = s.phienBTP || [];
    list.forEach(r => {
      data.push({
        "STT": stt++,
        "Ngày": s.ngay || "—",
        "Đợt": r.dotQuet || 1,
        "Mã QR Gốc": anToanCongThucExcel(r.rawQR),
        "Mã BTP": anToanCongThucExcel(r.msp),
        "Loại": anToanCongThucExcel(r.kg),
        "Thời gian": r.thoiGian ? new Date(r.thoiGian).toLocaleTimeString("vi-VN") : ""
      });
    });
  });

  if (typeof exportToExcel === "function") {
    const fileTitle = hienThiPhienLichSuHienTaiBTP ? ("LichSu_BTP_" + (hienThiPhienLichSuHienTaiBTP.ngay || layNgayHomNayBTP())) : "ToanBo_LichSu_BTP";
    exportToExcel(fileTitle, "BTP", data);
  }
}
window.xuatExcelLichSuBTP = xuatExcelLichSuBTP;

// ── Dropdown chọn phiên ──
function toggleDropdownPhienBTP(e) {
  if (e) e.stopPropagation();
  const trigger = document.getElementById("btp-phien-trigger");
  const menu = document.getElementById("btp-phien-menu");
  if (!menu) return;
  const isOpen = menu.classList.contains("open");
  if (isOpen) {
    menu.classList.remove("open");
    if (trigger) trigger.classList.remove("active");
  } else {
    menu.classList.add("open");
    if (trigger) trigger.classList.add("active");
  }
}
window.toggleDropdownPhienBTP = toggleDropdownPhienBTP;

function chonPhienBTP(val) {
  const numVal = parseInt(val, 10) || 1;
  const hiddenInput = document.getElementById("btp-phien");
  const labelEl = document.getElementById("btp-phien-label");
  const menu = document.getElementById("btp-phien-menu");
  const trigger = document.getElementById("btp-phien-trigger");

  if (hiddenInput) hiddenInput.value = numVal;
  if (labelEl) labelEl.textContent = "Phiên " + numVal;

  if (menu) {
    const items = menu.querySelectorAll(".custom-select-item");
    items.forEach(el => {
      if (parseInt(el.getAttribute("data-val"), 10) === numVal) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });
    menu.classList.remove("open");
  }
  if (trigger) trigger.classList.remove("active");
  phienSoBTP = numVal;
}
window.chonPhienBTP = chonPhienBTP;

// Đóng dropdown khi click ra ngoài
document.addEventListener("click", (e) => {
  const menu = document.getElementById("btp-phien-menu");
  const trigger = document.getElementById("btp-phien-trigger");
  if (menu && menu.classList.contains("open")) {
    if (!menu.contains(e.target) && !trigger.contains(e.target)) {
      menu.classList.remove("open");
      if (trigger) trigger.classList.remove("active");
    }
  }
});

// Khởi tạo ngày và phiên theo ca làm việc khi nạp trang
document.addEventListener("DOMContentLoaded", () => {
  const today = layNgayHomNayBTP();
  const ngayInput = document.getElementById("btp-ngay");
  if (ngayInput) ngayInput.value = today;

  const now = new Date();
  const hour = now.getHours();
  let defaultVal = 1;
  if (hour >= 6 && hour < 12) defaultVal = 1;
  else if (hour >= 12 && hour < 16) defaultVal = 2;
  else if (hour >= 16 && hour < 20) defaultVal = 3;
  else if (hour >= 20 || hour < 2) defaultVal = 4;
  else defaultVal = 5;

  chonPhienBTP(defaultVal);
  capNhatBadgePendingBTP();
});

// ── Tự động đồng bộ hàng chờ khi có mạng lại ──
async function tuDongDongBoPendingBTP() {
  await dongBoThietBiBTP(true);
}

window.addEventListener("load", tuDongDongBoPendingBTP);
window.addEventListener("online", tuDongDongBoPendingBTP);

// Exports ra toàn cục
window.batDauBTP = batDauBTP;
window.dungBTP = dungBTP;
window.tiepTucBTP = tiepTucBTP;
window.toggleDungTiepTucBTP = toggleDungTiepTucBTP;
window.quetTiepBTP = quetTiepBTP;
window.quetMoiBTP = quetMoiBTP;
window.ketThucBTP = ketThucBTP;
window.tiepTucPhienBTP = tiepTucPhienBTP;
window.huyPhienBTP = huyPhienBTP;
window.xuatCSVBTP = xuatCSVBTP;
window.xuatExcelBTP = xuatExcelBTP;

// Chuyển đổi giữa chế độ xem Chi Tiết và Tổng Hợp trong Lịch Sử BTP
function toggleLichSuBTPView(cheDo) {
  const tabChiTiet = document.getElementById("ls-btp-tab-chitiet");
  const tabTongHop = document.getElementById("ls-btp-tab-tonghop");
  const wrapChiTiet = document.getElementById("ls-btp-wrap-chitiet");
  const wrapGom = document.getElementById("ls-btp-wrap-gom");

  if (cheDo === "tonghop") {
    if (wrapChiTiet) wrapChiTiet.style.display = "none";
    if (wrapGom) wrapGom.style.display = "block";
    if (tabChiTiet) {
      tabChiTiet.style.background = "transparent";
      tabChiTiet.style.color = "var(--row-muted)";
      tabChiTiet.style.boxShadow = "none";
    }
    if (tabTongHop) {
      tabTongHop.style.background = "var(--surface)";
      tabTongHop.style.color = "var(--row-text)";
      tabTongHop.style.boxShadow = "0 2px 6px rgba(0,0,0,0.06)";
    }
  } else {
    if (wrapChiTiet) wrapChiTiet.style.display = "block";
    if (wrapGom) wrapGom.style.display = "none";
    if (tabChiTiet) {
      tabChiTiet.style.background = "var(--surface)";
      tabChiTiet.style.color = "var(--row-text)";
      tabChiTiet.style.boxShadow = "0 2px 6px rgba(0,0,0,0.06)";
    }
    if (tabTongHop) {
      tabTongHop.style.background = "transparent";
      tabTongHop.style.color = "var(--row-muted)";
      tabTongHop.style.boxShadow = "none";
    }
  }
}
window.toggleLichSuBTPView = toggleLichSuBTPView;
