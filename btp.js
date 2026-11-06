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
    const safeSubMsp = anToanHtmlBTP(it.rawQR || it.msp || g.msp);
    const safeUid = anToanHtmlBTP(it.uid || ("idx_" + subIdx));

    return `<div class="btp-sub-item btp-sub-item-btp">
        <span class="btp-sub-stt">${subIdx + 1}</span>
        <span class="btp-sub-msp" title="${safeSubMsp}">${safeSubMsp}</span>
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

function toggleChiTietKQBTP(groupKey, event) {
  if (window.expandedKQBTP.has(groupKey)) {
    window.expandedKQBTP.delete(groupKey);
  } else {
    window.expandedKQBTP.add(groupKey);
  }
  const isOpen = window.expandedKQBTP.has(groupKey);
  const keyB64 = btoa(encodeURIComponent(groupKey));
  const rawId = keyB64.replace(/[^a-zA-Z0-9]/g, '');

  const container = (event && event.currentTarget) ? event.currentTarget.closest('.kq-swipe-container') : null;
  const detailsEl = container ? container.querySelector('.kq-group-details') : (document.getElementById('details-btp-kq-grp-' + rawId) || document.getElementById('details-btp-ls-grp-' + rawId));
  const chevEl = container ? container.querySelector('.kq-col-chevron i') : (document.getElementById('chev-btp-kq-grp-' + rawId) || document.getElementById('chev-btp-ls-grp-' + rawId));
  if (detailsEl && chevEl) {
    detailsEl.style.display = isOpen ? 'block' : 'none';
    if (isOpen) chevEl.classList.add('open'); else chevEl.classList.remove('open');
    chevEl.style.transform = isOpen ? 'rotate(180deg)' : 'none';
  } else {
    thucHienLocKetQuaBTP();
  }
}
window.toggleChiTietKQBTP = toggleChiTietKQBTP;

function toggleChiTietKQBTPByB64(keyB64, event) {
  if (event) {
    const content = event.currentTarget;
    if (content && content.classList.contains('swiped')) {
      content.style.transform = 'translateX(0px)';
      content.classList.remove('swiped');
      return;
    }
  }
  let targetKey = "";
  try {
    targetKey = decodeURIComponent(atob(keyB64));
  } catch (e) {
    targetKey = keyB64;
  }
  toggleChiTietKQBTP(targetKey, event);
}
window.toggleChiTietKQBTPByB64 = toggleChiTietKQBTPByB64;

function khoiTaoSwipeKQBTP() {
  if (window.ScannerCore && typeof window.ScannerCore.khoiTaoSwipe === "function") {
    window.ScannerCore.khoiTaoSwipe("btp-tbody-dot", ".kq-swipe-content", "__swipeKqInit");
  }
}

// ── Hệ thống tra cứu Quy Cách QC & Tính KG chuẩn cho Bảng Tổng Hợp BTP ──
const BTP_QC_CACHE_KEY = "btp_danh_sach_qc";
let mapQCBTP = {};
let daNapLocalQCBTP = false;
let dangTaiQCBTP = false;
const BTP_QC_DEFAULT_SEED = {"EM240703":[[22.5,0,0]],"EM240763":[[177,1201,23],[88,1201,11.5]],"EM240791":[[0,0,5]],"EM240792":[[314.5,3040,240]],"EM240793":[[0,0,1.6]],"EM240794":[[149,750,95]],"EM240795":[[318.5,1080,168]],"EM240796":[[318.5,1080,196]],"EM240797":[[318.5,1080,224]],"EM240798":[[0,0,0.8]],"EM240799":[[0,0,4.6]],"EM240800":[[204,200,2.3]],"EM240801":[[8,58,0.17]],"EM240802":[[10,95,0.8]],"EM240996":[[100,1211,54.3]],"EM240942":[[61.5,2405,4.2],[435.5,2405,29.4]],"EM240946":[[1720,505,35.8],[430,505,9]],"EM240887":[[300.5,5005,560],[150.5,5005,320.9]],"EM250001":[[262,1201,18.3],[131,1201,9.2]],"EM250002":[[167.5,3,22.3]],"EM250003":[[0,0,0]],"EM250004":[[67.5,1810,38.8]],"EM250005":[[360.5,2770,168.9]],"EM250006":[[400.5,5210,57.8]],"EM250007":[[199.5,2005,9]],"EM250008":[[349.5,5005,38.4]],"EM250009":[[199.5,2005,10.2]],"EM250010":[[399.5,4005,40.8]],"EM250011":[[99.5,2005,3.1]],"EM250012":[[124.5,4005,7.6]],"EM250013":[[149.5,2005,4.9]],"EM250014":[[199.5,2005,7.2]],"EM250015":[[167.5,3,21.5]],"EM250016":[[167.5,3,21.5]],"EM250017":[[167.5,3,21.5]],"EM250018":[[167.5,3,21.5]],"EM250019":[[167.5,3,21.5]],"EM250020":[[167.5,3,21.5]],"EM250021":[[167.5,3,21.5]],"EM250022":[[167.5,3,21.5]],"EM250023":[[167.5,3,21.5]],"EM250024":[[307.5,5290,36.9]],"EM250025":[[439.5,5290,52.7]],"EM250026":[[439.5,5290,52.7]],"EM250027":[[100,501,51.1]],"EM250028":[[95.5,1294041,1120]],"EM250029":[[450,1201,21.4]],"EM250030":[[284,1201,18.7]],"EM250031":[[250,1201,19.4],[125,1201,9.7]],"EM250032":[[196,1201,17.3]],"EM250033":[[66,1201,52.6]],"EM250034":[[100,1651,54.7]],"EM250035":[[439.5,5290,52.7]],"EM250036":[[439.5,5290,52.7]],"EM250037":[[24,28462.62,4.8]],"EM250038":[[307.5,5290,36.9]],"EM250039":[[66,1201,52.6]],"EM250040":[[0.5,1403013421,30.5]],"EM250041":[[29,1001018723,4.5]],"EM250042":[[10,1001018723,1.7]],"EM250043":[[24,28462.62,4.8]],"EM250044":[[100,3001,52.5]],"EM250045":[[502,1201,37.2],[402,1201,29.6],[100,1201,7.6]],"EM250046":[[49,1201,48.7]],"EM250047":[[80,1201,52.2]],"EM250048":[[100,401,54.3]],"EM250049":[[600,14500,1012],[400.5,14500,675],[200.5,14500,337]],"EM250050":[[100,641,75]],"EM250051":[[106,1201,15.1]],"EM250052":[[100,1201,16.5]],"EM250053":[[326,1201,20.2],[110,1201,6.8],[216,1201,13.4]],"EM250054":[[29,1001018723,4.5]],"EM250055":[[10,1001018723,1.7]],"EM250056":[[600,14500,1012],[300.5,14500,506]],"EM250057":[[0,0,4.5]],"EM250058":[[0,0,2.6]],"EM250059":[[0,0,2]],"EM250060":[[0,0,1.5]],"EM250061":[[0,0,1.1]],"EM250062":[[960,445,57],[320,445,19]],"EM250063":[[600.5,5005,170.3],[250,5005,71]],"EM250064":[[0.5,1203011601,14.5]],"EM250065":[[0.5,1403011721,25.7]],"EM250066":[[630,2432,18.3],[315,2432,9.2]],"EM250067":[[250,1201,19.4],[125,1201,9.7]],"EM250068":[[860,1201,29.2],[430,1201,14.6]],"EM250069":[[80,161,53.6]],"EM250070":[[0.5,1403011721,25.7]],"EM250071":[[200,1201,24.6]],"EM250072":[[400,1201,28.7]],"EM250073":[[90,4,111.5]],"EM250074":[[180,36929,455]],"EM250075":[[180,2,667.2]],"EM250076":[[72,5,74.4]],"EM250077":[[144,3,163.2]],"EM250078":[[144,3,326.4]],"EM250079":[[49,12012,50.5]],"EM250080":[[284,1201,18.7]],"EM250081":[[1020,1201,17.5],[510,1201,8.8]],"EM250082":[[750,1001,56.6],[375,1001,28.3]],"EM250083":[[112.5,5,27.7]],"EM250084":[[112.5,5,27.7]],"EM250085":[[112.5,5,22.7]],"EM250086":[[112.5,5,22.7]],"EM250087":[[112.5,4,22.7]],"EM250089":[[167.5,3,22.3]],"EM250090":[[167.5,3,22.3]],"EM250091":[[167.5,3,22.3]],"EM250092":[[167.5,3,22.3]],"EM250093":[[167.5,3,22.3]],"EM250094":[[167.5,3,22.3]],"EM250095":[[167.5,3,22.3]],"EM250096":[[167.5,3,22.3]],"EM250097":[[80,1201,52.2]],"EM250098":[[66,1201,52.6]],"EM250099":[[100,831,57]],"EM250100":[[49,1201,48.7]],"EM250101":[[100,621,54.6]],"EM250102":[[100,1201,55]],"EM250103":[[100,1101,53]],"EM250104":[[299.5,2,40.8]],"EM250105":[[299.5,2,40.8]],"EM250106":[[299.5,2,40.8]],"EM250107":[[299.5,2,40.8]],"EM250108":[[299.5,2,40.8]],"EM250109":[[299.5,2,40.8]],"EM250110":[[299.5,2,40.8]],"EM250111":[[112.5,4,26.8]],"EM250112":[[112.5,4,26.8]],"EM250113":[[112.5,4,26.8]],"EM250114":[[112.5,4,26.8]],"EM250115":[[112.5,4,26.8]],"EM250116":[[112.5,4,26.8]],"EM250117":[[112.5,4,26.8]],"EM250118":[[112.5,4,26.8]],"EM250119":[[133,1201,27.6]],"EM250120":[[53,2050,22]],"EM250121":[[59,2050,28.3]],"EM250122":[[4,2201,1.8]],"EM250123":[[6,2201,2.6]],"EM250124":[[167.5,3,21.5]],"EM250125":[[167.5,3,21.5]],"EM250126":[[167.5,3,21.5]],"EM250127":[[167.5,3,21.5]],"EM250128":[[167.5,3,21.5]],"EM250129":[[167.5,3,21.5]],"EM250130":[[167.5,3,21.5]],"EM250131":[[307.5,2,36.9]],"EM250132":[[307.5,2,36.9]],"EM250133":[[439.5,5290,52.7]],"EM250134":[[439.5,5290,52.7]],"EM250135":[[167.5,3,21.5]],"EM250136":[[167.5,3,21.5]],"EM250137":[[167.5,3,21.5]],"EM250138":[[167.5,3,21.5]],"EM250139":[[167.5,3,21.5]],"EM250140":[[167.5,3,21.5]],"EM250141":[[167.5,3,21.5]],"EM250142":[[167.5,3,21.5]],"EM250143":[[167.5,3,21.5]],"EM250144":[[167.5,3,21.5]],"EM250145":[[307.5,2,36.9]],"EM250146":[[307.5,2,36.9]],"EM250147":[[307.5,2,36.9]],"EM250148":[[307.5,2,36.9]],"EM250149":[[307.5,2,36.9]],"EM250150":[[439.5,5290,52.7]],"EM250151":[[439.5,5290,52.7]],"EM250152":[[439.5,5290,52.7]],"EM250153":[[439.5,5290,52.7]],"EM250154":[[439.5,5290,52.7]],"EM250155":[[49,12012,50.5]],"EM250156":[[146.5,4050,145]],"EM250157":[[71,2561,32.3]],"EM250158":[[59,2050,28.3]],"EM250159":[[53,2050,22]],"EM250160":[[1720,505,35.8],[430,505,9]],"EM250161":[[363,1201,20.9]],"EM250162":[[300,1201,17.8],[150,1201,8.9]],"EM250163":[[100,1201,26.5]],"EM240944":[[1290,605,33.7],[430,605,11.3]],"EM240971":[[100,621,54.6]],"EM240958":[[200,1201,24.6]],"EM240884":[[202,12012,27.8]],"EM250164":[[860,1201,26.8],[430,1201,13.4]],"EM240693":[[6,2201,2.6]],"EM250165":[[0,0,0]],"EM250166":[[800,1001,64],[400,1001,32]],"EM250167":[[800,1201,76.8],[400,1201,38.4]],"EM250168":[[1000,1201,44],[400,1201,17.6],[200,1201,8.8]],"EM250169":[[150,1201,16.7]],"EM250170":[[49,12012,50.5]],"EM250171":[[200.5,3005,520],[100,3005,260]],"EM250172":[[140.5,2405,461],[70,2405,230.5]],"EM250173":[[120.5,3005,294],[60,3005,147]],"EM250174":[[300.5,10004,1120],[150,10004,520]],"EM250175":[[600.5,12004,890],[300.5,12004,445]],"EM250176":[[120.5,3005,294],[60,3005,147]],"EM250177":[[120,3605,323],[60,3605,161.5]],"EM250178":[[200.5,3605,51.8]],"EM250179":[[600.5,5005,170.3],[250,5005,71]],"EM250180":[[600.5,5405,317.3],[400,5405,211.5],[200,5405,105.8]],"EM250181":[[300.5,2825,100.8],[150.5,2825,50.4]],"EM250182":[[99.5,2005,430],[50,2005,215]],"EM250183":[[99.5,3345,441]],"EM250184":[[960,4452,53],[320,4452,17.7]],"EM250185":[[5,1263,2.3]],"EM250186":[[650,303,19.8],[325,303,9.9]],"EM250187":[[10,963,4.9]],"EM250188":[[5,963,2.5]],"EM250189":[[1290,605,33.7],[430,605,11.3]],"EM250190":[[1290,6052,32],[430,6052,10.7]],"EM250191":[[5,963,2.1]],"EM250192":[[10,963,4.2]],"EM240970":[[66,1201,52.6]],"EM240943":[[1290,605,30.7],[430,605,10.3]],"EM250193":[[400,1001,26.4]],"EM250194":[[599,1201,14.5],[400,1201,9.7],[199,1201,4.8]],"EM250195":[[450,1201,13.1]],"EM250196":[[426,1201,14.5]],"EM250197":[[400,1201,15.6]],"EM250198":[[326,1201,14.3],[216.5,1201,9.5],[110.5,1201,4.8]],"EM250199":[[320,1201,15.6],[210,1201,10.3],[110,1201,5.3]],"EM250200":[[266,1201,15.6],[133,1201,7.8]],"EM250201":[[1720,505,35.8],[430,505,9]],"EM250202":[[100.5,3605,267],[50,3605,133.5]],"EM250203":[[22.5,0,0]],"EM250204":[[860,1201,26.8],[430,1201,13.4]],"EM250205":[[100,1101,53]],"EM250206":[[0.5,1403011721,25.7]],"EM250207":[[960,445,57],[320,445,19]],"EM250208":[[650,303,19.9],[325,303,10]],"EM250209":[[204,601,58.6]],"EM250210":[[200,1201,20.3]],"EM250211":[[80,1201,25.9]],"EM250212":[[100,1201,37.1]],"EM250213":[[400,1001,26.4]],"EM250214":[[400,1201,36]],"EM250215":[[133,1201,27.6]],"EM250216":[[250,1201,19.4],[125,1201,9.7]],"EM250217":[[0,0,2.3]],"EM250218":[[0,0,168]],"EM250219":[[0,0,224]],"EM250220":[[100,1651,54.7]],"EM250221":[[100,1201,37.1]],"EM250222":[[66,1201,35.2]],"EM250223":[[100,831,57]],"EM250224":[[599,1201,27],[400,1201,18],[199,1201,9]],"EM250225":[[300.5,8660,331]],"EM250226":[[960,445,57],[320,445,19]],"EM250227":[[450,1201,21.4]],"EM250228":[[450,1201,21]],"EM250229":[[375,1201,20]],"EM250230":[[400,1201,23.4]],"EM250231":[[188,1201,17.8]],"EM250232":[[750,1201,24.4],[375,1201,12.2]],"EM250233":[[22.5,0,0]],"EM250234":[[5,963,2.5]],"EM250235":[[1290,1005,54.2],[430,1005,18.1]],"EM250236":[[1290,1005,54.2],[430,1005,18.1]],"EM250237":[[200.5,3635,106.8]],"EM250238":[[200.5,7100,245]],"EM250239":[[200.5,7050,245]],"EM250240":[[400.5,5005,346.9],[100,5005,86.7]],"EM250241":[[200.5,2825,98]],"EM250242":[[300.5,3605,164.9]],"EM250243":[[300.5,565,28]],"EM250244":[[300.5,285,14.7]],"EM250245":[[300.5,2365,145]],"EM250246":[[300.5,2825,147]],"EM250247":[[300.5,8005,261.6]],"EM250248":[[300.5,7005,320]],"EM250249":[[300.5,8660,360]],"EM250250":[[200.5,8465,193.2]],"EM250251":[[200.5,2825,67.2]],"EM250252":[[300.5,2825,100.8],[150.5,2825,50.4]],"EM250253":[[300.5,5645,201.6],[150.5,5645,100.8]],"EM250254":[[300.5,2365,105],[150,2365,52.5]],"EM250255":[[200.5,2405,71.4]],"EM250256":[[660.5,26204,1183.7],[440.5,26204,789.2],[220.5,26204,394.6]],"EM250257":[[200.5,3605,51.8]],"EM250258":[[200.5,2825,49]],"EM250259":[[150.5,40870,569.5],[150.5,7325,106],[150.5,4275,61.8]],"EM250260":[[300.5,48200,1391.2],[300.5,4825,139.3]],"EM250261":[[150.5,482,6.8],[150.5,4825,69.7]],"EM250262":[[120.5,242,2.7],[120.5,6055,70.1]],"EM250263":[[120.5,472,5.4],[120.5,5670,65.6]],"EM250264":[[75.5,9605,73]],"EM250265":[[650,303,19.9],[325,303,10]],"EM250266":[[5,1303,2.5]],"EM250267":[[0.5,1403011721,24.7]],"EM250268":[[10,963,4.9]],"EM250269":[[0,0,0]],"EM250270":[[82,1201,19.7]],"EM250271":[[80,1201,20.6]],"EM250272":[[133,1201,21.9]],"EM250273":[[320,1201,29],[210,1201,19],[110,1201,10]],"EM250274":[[501,1201,32.3],[401,1201,25.8],[100,1201,6.5]],"EM250275":[[750,1201,35.4],[375,1201,17.7]],"EM250276":[[200,1201,55.6]],"EM250277":[[200,1201,29]],"EM250278":[[5,1303,2]],"EM250279":[[600,1201,25],[400,1201,16.7],[200,1201,8.3]],"EM250280":[[101.5,2040,267.4]],"EM250281":[[960,445,57],[320,445,19]],"EM250282":[[100.5,2005,279],[50,2005,139.5]],"EM250283":[[200.5,5430,1494.6]],"EM250284":[[200.5,5430,1494.6]],"EM250285":[[200.5,5430,1494.6]],"EM250286":[[200.5,5430,1494.6]],"EM250287":[[8,0,9]],"EM250288":[[960,445,57],[320,445,19]],"EM250289":[[484,1201,22.4],[404,1201,18.7],[80,1201,3.7]],"EM250290":[[61.5,2405,4.2],[435.5,2405,29.4]],"EM250291":[[960,4452,53],[320,4452,17.7]],"EM250292":[[960,4452,53],[320,4452,17.7]],"EM250293":[[202,1201,61.2]],"EM250294":[[100,1201,37.1]],"EM250295":[[66,1201,35.2]],"EM250296":[[80,1201,35.7]],"EM250297":[[80,1001,178.4]],"EM250298":[[1290,8052,43.2],[430,8052,14.4]],"EM250299":[[1290,7452,40],[430,7452,13.4]],"EM250300":[[184.5,2010,44.3]],"EM250301":[[184.5,2066,45.6]],"EM250302":[[184.5,2094,46.2]],"EM250303":[[184.5,2150,47.4]],"EM250304":[[184.5,2236,49.3]],"EM250305":[[184.5,2264,49.9]],"EM250306":[[184.5,2490,54.9]],"EM250307":[[184.5,2518,55.5]],"EM250308":[[184.5,2604,57.4]],"EM250309":[[184.5,2914,64.3]],"EM250310":[[184.5,2942,64.9]],"EM250311":[[184.5,3000,66.1]],"EM250312":[[184.5,3028,66.8]],"EM250313":[[184.5,3168,69.9]],"EM250314":[[184.5,3198,70.5]],"EM250315":[[184.5,3254,71.8]],"EM250316":[[184.5,3338,73.6]],"EM250317":[[184.5,3396,74.9]],"EM250318":[[184.5,3536,78]],"EM250319":[[184.5,3594,79.3]],"EM250320":[[184.5,3734,82.4]],"EM250321":[[184.5,4158,91.7]],"EM250322":[[184.5,4188,92.4]],"EM250323":[[184.5,4300,94.9]],"EM250324":[[184.5,4386,96.7]],"EM250325":[[184.5,4526,99.8]],"EM250326":[[184.5,4612,101.7]],"EM250327":[[184.5,4950,109.2]],"EM250328":[[184.5,4980,109.8]],"EM250329":[[184.5,5148,113.6]],"EM250330":[[184.5,5376,118.6]],"EM250331":[[184.5,5460,120.4]],"EM250332":[[184.5,5488,121.1]],"EM250333":[[184.5,5714,126.1]],"EM250334":[[184.5,6026,132.9]],"EM250335":[[184.5,6054,133.5]],"EM250336":[[184.5,6252,137.9]],"EM250337":[[184.5,6336,139.8]],"EM250338":[[184.5,6620,146]],"EM250339":[[184.5,6648,146.6]],"EM250340":[[184.5,6704,147.9]],"EM250341":[[184.5,7326,161.6]],"EM250342":[[184.5,7694,169.7]],"EM250343":[[184.5,1246,27.5]],"EM250344":[[184.5,1584,34.9]],"EM250345":[[184.5,1812,39.9]],"EM250346":[[184.5,1952,43.1]],"EM250347":[[198.5,2518,59.8]],"EM250348":[[198.5,3338,79.3]],"EM250349":[[198.5,7326,174.1]],"EM250350":[[198.5,1840,43.7]],"EM250351":[[213.5,1840,46.8]],"EM250352":[[241.5,2886,83.2]],"EM250353":[[255.5,3254,99.4]],"EM250354":[[283.5,1642,55.7]],"EM250355":[[354.5,1416,60]],"EM250356":[[354.5,1528,64.8]],"EM250357":[[354.5,1840,78]],"EM250358":[[382.5,2066,94.6]],"EM250359":[[382.5,2094,95.9]],"EM250360":[[382.5,2150,98.5]],"EM250361":[[382.5,2178,99.8]],"EM250362":[[382.5,2546,116.6]],"EM250363":[[382.5,2772,127]],"EM250364":[[382.5,2886,132.2]],"EM250365":[[382.5,2914,133.5]],"EM250366":[[382.5,2970,136.1]],"EM250367":[[382.5,3198,146.5]],"EM250368":[[382.5,3254,149]],"EM250369":[[382.5,3338,152.9]],"EM250370":[[382.5,3366,154.2]],"EM250371":[[382.5,3452,158.1]],"EM250372":[[382.5,3536,162]],"EM250373":[[382.5,3678,168.5]],"EM250374":[[382.5,3734,171.1]],"EM250375":[[382.5,3820,175]],"EM250376":[[382.5,4130,189.2]],"EM250377":[[382.5,4244,194.4]],"EM250378":[[382.5,4526,207.4]],"EM250379":[[382.5,4584,210]],"EM250380":[[382.5,4950,226.8]],"EM250381":[[382.5,5092,233.3]],"EM250382":[[382.5,5148,235.9]],"EM250383":[[382.5,5136,246.2]],"EM250384":[[382.5,5432,248.8]],"EM250385":[[382.5,5602,256.6]],"EM250386":[[382.5,6026,276.1]],"EM250387":[[382.5,6082,278.6]],"EM250388":[[382.5,6224,285.1]],"EM250389":[[382.5,6252,286.4]],"EM250390":[[382.5,6506,298.1]],"EM250391":[[382.5,6534,299.4]],"EM250392":[[382.5,6620,303.3]],"EM250393":[[382.5,6648,304.6]],"EM250394":[[382.5,6704,307.2]],"EM250395":[[382.5,7496,343.4]],"EM250396":[[382.5,8034,368.1]],"EM250397":[[382.5,1584,72.6]],"EM250398":[[382.5,1896,86.8]],"EM250399":[[425.5,1246,63.4]],"EM250400":[[453.5,5120,278]],"EM250401":[[778.5,5658,528],[389.5,5658,265],[388.5,5658,263]],"EM250402":[[1290,601,34.5],[430,601,11.5]],"EM250403":[[430,1201,23.9]],"EM250404":[[375,1201,20]],"EM250406":[[166,1201,16.7],[83,1201,8.4]],"EM250407":[[1720,505,35.8],[430,505,9]],"EM250408":[[1290,605,33.7],[430,605,11.3]],"EM250409":[[133,1201,18.5]],"EM240920":[[100.5,4,24.8]],"EM240921":[[100.5,4,24.8]],"EM240922":[[100.5,4,24.8]],"EM240923":[[100.5,4,24.8]],"EM240924":[[100.5,4,24.8]],"EM240917":[[0,0,27.7]],"EM240918":[[0,0,27.7]],"EM240919":[[0,0,22.7]],"EM240925":[[0,0,22.3]],"EM240926":[[0,0,22.3]],"EM240927":[[167.5,3,22.3]],"EM240928":[[0,0,22.3]],"EM240929":[[0,0,22.3]],"EM240930":[[167.5,3,22.3]],"EM240931":[[167.5,3,22.3]],"EM240932":[[167.5,3,22.3]],"EM240933":[[167.5,3,22.3]],"EM240934":[[167.5,3,22.3]],"EM240935":[[167.5,3,22.3]],"EM240936":[[167.5,3,22.3]],"EM240938":[[167.5,3,22.3]],"EM240939":[[0,0,22.3]],"EM240940":[[167.5,3,22.3]],"EM240941":[[167.5,3,22.3]],"EM250410":[[39,1201,61.2]],"EM250411":[[100,831,57]],"EM250405":[[300,1201,21],[200,1201,14],[100,1201,7]],"EM250413":[[307.5,2,38.7]],"EM250414":[[307.5,2,38.7]],"EM250415":[[307.5,2,38.7]],"EM250416":[[439.5,5550,55.3]],"EM250417":[[439.5,5550,55.3]],"EM250418":[[439.5,5550,55.3]],"EM250419":[[439.5,5550,55.3]],"EM250420":[[439.5,5550,55.3]],"EM250421":[[439.5,5550,55.3]],"EM250422":[[439.5,5550,55.3]],"EM250423":[[5,963,2]],"EM250424":[[480,683,34.7],[320,683,23.1],[160,683,11.6]],"EM250425":[[100.5,2005,141.6]],"EM250426":[[250,1201,19.4]],"EM250427":[[284,1201,18.7]],"EM250428":[[196,1201,17.3]],"EM250429":[[0.5,1403018603011661,22.3]],"EM250430":[[155,1403,20]],"EM250431":[[100.5,2005,279],[50,2005,139.5]],"EM250432":[[140.5,2405,461],[70,2405,230.5]],"EM250433":[[140.5,2405,461],[70,2405,230.5]],"EM240770":[[167.5,3,22.3]],"EM240739":[[112.5,5,27.7]],"EM240552":[[167.5,2620,21.5]],"EM240551":[[167.5,2620,21.4]],"EM250434":[[100,401,54.3]],"EM250435":[[200,1201,24.6]],"EM250436":[[200,1201,27.8]],"EM250437":[[150,1201,22.7]],"EM250438":[[133,1201,27.6]],"EM250439":[[100,1201,26.5]],"EM250440":[[400,1201,32]],"EM250441":[[5,1303,2]],"EM250412":[[152,12012,22.7],[150,1201,22.7]],"EM250442":[[100,1651,54.7]],"EM250443":[[40.5,6130,10.8]],"EM250444":[[4750,0,563.8]],"EM250445":[[200.5,13481,951.2]],"EM250446":[[4750,0,563.8]],"EM250447":[[112.5,5,22.7]],"EM250448":[[112.5,5,22.7]],"EM250449":[[112.5,5,22.7]],"EM250450":[[112.5,5,22.7]],"EM250451":[[112.5,5,22.7]],"EM250452":[[112.5,5,22.7]],"EM250453":[[112.5,5,22.7]],"EM250454":[[112.5,5,27.7]],"EM250455":[[112.5,5,27.7]],"EM250456":[[112.5,4,22.7]],"EM250457":[[167.5,3,22.3]],"EM250458":[[167.5,3,22.3]],"EM250459":[[167.5,3,22.3]],"EM250460":[[167.5,3,22.3]],"EM250461":[[167.5,3,22.3]],"EM250462":[[167.5,3,22.3]],"EM250463":[[167.5,3,22.3]],"EM250464":[[167.5,3,22.3]],"EM250465":[[167.5,3,22.2]],"EM250466":[[167.5,3,22.3]],"EM250467":[[167.5,3,22.3]],"EM250468":[[167.5,3,22.3]],"EM250469":[[150.5,4,20.1]],"EM250470":[[5,963,2]],"EM250471":[[60,501,52.5]],"EM250472":[[800,1001,64],[400,1001,32]],"EM250473":[[363,1201,20.9]],"EM250474":[[750,1001,56.6],[375,1001,28.3]],"EM250475":[[100,401,54.3]],"EM250476":[[1290,605,33.7],[430,605,11.3]],"EM250477":[[1290,601,34.5],[430,601,11.5]],"EM250478":[[1720,505,35.8],[430,505,9]],"EM250479":[[1290,1005,54.2],[430,1005,18.1]],"EM250480":[[214,1201,16.5]],"EM250481":[[100,1201,37.1]],"EM250482":[[80,1201,35.7]],"EM250483":[[66,1201,35.2]],"EM250484":[[100,1651,54.7]],"EM250485":[[1290,601,34.5],[430,601,11.5]],"EM250486":[[0.5,1203011721,19.7]],"EM240945":[[1290,601,34.5],[430,601,11.5]],"EM240755":[[1290,601,34.5],[430,601,11.5]],"EM250487":[[100,1201,26.5]],"EM250488":[[501,1201,32.3],[401,1201,25.8],[100,1201,6.5]],"EM250489":[[320,1201,29],[210,1201,19],[110,1201,10]],"EM250490":[[266,1201,25.6],[133,1201,12.8]],"EM250491":[[214,1201,22.5]],"EM250493":[[160,1201,22.1],[80,1201,11.1]],"EM250495":[[60,401,62]],"EM250496":[[60,201,54.9]],"EM250497":[[650,503,38.9],[325,503,19.5]],"EM250498":[[100,3001,52.5]],"EM250499":[[200.5,4675,588.2]],"EM250500":[[205.5,3780,672.7]],"EM250501":[[150,10004,530]],"EM250502":[[0.5,1403011721,24.3]],"EM250503":[[1280,3452,56],[320,3452,14]],"EM250504":[[960,4452,62.1],[320,4452,20.7]],"EM250505":[[100,1201,23.4]],"EM250494":[[250,12012,19.4],[125,12012,9.7]],"EM250506":[[240,201,60.6],[120,201,30.3]],"EM250507":[[60,301,58.8]],"EM250508":[[114,1201,20.4]],"EM250509":[[133,1201,20.4]],"EM250510":[[100,1201,20.6]],"EM250511":[[133,1201,27.6]],"EM250512":[[400,1201,23.4]],"EM250514":[[250,1201,19.4]],"EM250515":[[450,1201,21.4]],"EM250516":[[80,91,70]],"EM250513":[[300,1201,17.8]],"EM250517":[[203.5,13215,636.8]],"EM250518":[[205.5,4955,606.6]],"EM250519":[[100.5,3605,220],[50,3605,107.4]],"EM250520":[[300.5,8004,1037.3],[150,8004,518.7]],"EM250521":[[300.5,8004,1037.3],[150,8004,518.7]],"EM250522":[[120.5,3005,300],[60,3005,150]],"EM250523":[[0,0,55.3]],"EM250524":[[0,0,55.3]],"EM250525":[[0,0,4]],"EM250526":[[66,1201,52.6]],"EM250527":[[49,1201,48.7]],"EM250528":[[100,1201,37.1]],"EM250529":[[66,1201,35.2]],"EM250530":[[400,1001,26.4]],"EM250531":[[800,1001,53.6],[400,1001,26.8]],"EM250532":[[160,1201,19.5],[80,1201,9.8]],"EM250533":[[527.5,5280,63.2]],"EM250534":[[790.5,5280,85.4],[527.5,5280,63.2],[263.5,5280,31.6]],"EM250535":[[417.5,2930,105]],"EM250536":[[3,678,0.4]],"EM250537":[[5,678,0.5]],"EM250538":[[5,508,0.5]],"EM250539":[[3,508,0.5]],"EM250540":[[3,508,0.5]],"EM250541":[[4,508,0.6]],"EM250542":[[170,1800,115.3],[0,0,0]],"EM250543":[[2,339,0.4],[2,339,0.5]],"EM250544":[[4,565,1.3]],"EM250545":[[3,508,1.1]],"EM250546":[[6,508,1.8]],"EM250547":[[3,405,1]],"EM250548":[[4,405,1.3]],"EM250549":[[8,339,2.3]],"EM250550":[[3,339,1.1]],"EM250551":[[2,339,0.8]],"EM250552":[[3,508,1.1]],"EM250553":[[4,508,1.3]],"EM250554":[[9,670,2.7]],"EM250555":[[350.5,2120,289.8],[6,670,2]],"EM250556":[[4,678,0.4]],"EM250557":[[5,508,0.5]],"EM250558":[[4,508,0.4]],"EM250559":[[3,508,0.3]],"EM250560":[[2,339,0.3]],"EM250561":[[9,565,2.7]],"EM250562":[[10,565,2.9]],"EM250563":[[11,565,3.1]],"EM250564":[[6,508,1.8]],"EM250565":[[2,500,0.8]],"EM250566":[[6,508,1.9]],"EM250567":[[10,500,2.9]],"EM250568":[[4,405,1.3]],"EM250569":[[5,405,1.6]],"EM250570":[[11,405,0.8]],"EM250571":[[321.5,2582,263.9],[5,847,1.7]],"EM250572":[[350.5,1735,193.4],[6,847,1.9]],"EM250573":[[8,848,2.5]],"EM250574":[[3,678,0.4]],"EM250575":[[5,678,0.5]],"EM250576":[[4,678,0.4]],"EM250577":[[3,508,0.5]],"EM250578":[[2,565,0.8]],"EM250579":[[7,405,2.1]],"EM250580":[[3,508,1.1]],"EM250581":[[4,678,0.4]],"EM250582":[[3,508,0.5]],"EM250583":[[4,508,1.1]],"EM250584":[[5,508,1.3]],"EM250585":[[6,508,1.4]],"EM250586":[[7,508,1.6]],"EM250587":[[3,508,1.1]],"EM250588":[[6,508,1.8]],"EM250589":[[9,339,2.6]],"EM250590":[[10,339,2.9]],"EM250591":[[11,339,3.1]],"EM250592":[[349.5,3100,292.5],[8,1017,2.5]],"EM250593":[[3,405,1]],"EM250594":[[5,339,1.6]],"EM250595":[[4,678,0.4]],"EM250596":[[3,508,0.3]],"EM250597":[[4,565,1.3]],"EM250598":[[3,565,1.1]],"EM250599":[[6,508,1.8]],"EM250600":[[9,508,2.7]],"EM250601":[[4,405,1.3]],"EM250602":[[3,339,1.1]],"EM250603":[[2,339,0.8]],"EM250604":[[1350,801,55.1],[450,801,18.4]],"EM250605":[[349.5,3015,335],[3,1000,1.2]],"EM250606":[[6,1017,2]],"EM250607":[[10,1017,3.1]],"EM250608":[[8,1017,2.5]],"EM250609":[[349.5,2520,280],[6,848,1.9]],"EM250610":[[349.5,2520,280],[6,848,1.9]],"EM250611":[[5,848,1.7]],"EM250612":[[7,848,2.2]],"EM250613":[[9,848,2.7]],"EM250614":[[11,834,3.4]],"EM250615":[[100,12012,26]],"EM250616":[[133,12012,27.6]],"EM250617":[[4,508,1.3]],"EM250618":[[5,508,1.6]],"EM250619":[[6,508,1.9]],"EM250620":[[8,508,2.4]],"EM250621":[[9,508,2.7]],"EM250622":[[10,508,2.9]],"EM250623":[[4,1017,1.5]],"EM250624":[[5,1017,1.6]],"EM250625":[[340.5,3098,282.2],[6,1017,2]],"EM250626":[[7,1017,2.2]],"EM250627":[[10,1017,3.1]],"EM250628":[[7,848,2.3]],"EM250629":[[10,848,2.9]],"EM250630":[[4,848,1.4]],"EM250631":[[350.5,2120,289.8],[6,670,2]],"EM250632":[[7,670,2.2]],"EM250633":[[10,678,2.9]],"EM250634":[[804.5,802,16.6]],"EM250635":[[1606.5,8050,293.7],[535.5,8050,97.9]],"EM250636":[[1606.5,8050,293.7],[535.5,8050,97.9]],"EM250637":[[4,678,1.4],[0,0,0]],"EM250638":[[4,678,1.4],[0,0,0]],"EM250639":[[4,678,1.4],[0,0,0]],"EM250640":[[350.5,2140,282.8],[8,678,2.4]],"EM250641":[[11,667,3.5]],"EM250642":[[3,678,1.2]],"EM250643":[[6,678,2]],"EM250644":[[7,678,2.2]],"EM250645":[[2,678,0.8]],"EM250646":[[10,678,2.9]],"EM250647":[[9,667,2.7]],"EM250648":[[1720,505,35.8],[430,505,9]],"EM250649":[[250,1201,18.8],[125,1201,9.4]],"EM250650":[[188,1201,17.8]],"EM250651":[[4,508,1.3]],"EM250652":[[266,1201,22.5],[133,1201,11.3]],"EM250653":[[60.5,10910,21.4]],"EM250654":[[33,10910,19.2]],"EM250655":[[0.5,1403013421,28.5]],"EM250656":[[0.5,1403013421,26]],"EM250657":[[1250,1201416,43.7],[416,1201,14.6]],"EM250658":[[49,1201,72]],"EM250659":[[100,401,54.3]],"EM250661":[[5,1003,2.2]],"EM250662":[[1060,1201,18.3],[530,1201,9.2]],"EM250663":[[100,4012,54]],"EM250664":[[1720,505,35.8],[430,505,9]],"EM250665":[[1290,1005,54.2],[430,1005,18.1]],"EM250666":[[1280,3452,56],[320,3452,14]],"EM250667":[[210.5,3200,193.4]],"EM250668":[[204,601,58.6]],"EM250669":[[300.5,8004,1037.3],[150,8004,518.7]],"EM250670":[[400.5,8004,1134.8],[200,8004,567.4]],"EM250671":[[205.5,1892,326.6]],"EM250672":[[205.5,2185,440]],"EM250673":[[205.5,2235,450]],"EM250674":[[300.5,5005,560],[150.5,5005,320.9]],"EM250675":[[300.5,6004,479.6],[150,6004,239.8]],"EM250676":[[140.5,2405,461]],"EM250677":[[100.5,2005,314]],"EM240276":[[526,1062,3.6]],"EM250678":[[200,1201,24.6]],"EM250680":[[214,1201,20]],"EM250681":[[200,1201,20.3]],"EM250683":[[196,1201,17.3]],"EM250684":[[400,1201,22.1]],"EM250685":[[382.5,5376,246.2]],"EM250686":[[0.5,1403011721,25.7]],"EM250687":[[600.5,16004,518.2],[300.5,8004,259.1],[300.5,8604,278.5]],"EM250688":[[450.5,7245,324]],"EM250689":[[450.5,5645,294.4]],"EM250690":[[200.5,2825,67.2]],"EM250691":[[300.5,5645,201.6]],"EM250692":[[400.5,5645,268.8]],"EM250693":[[200.5,7205,207.4]],"EM250694":[[300.5,4645,190]],"EM250695":[[600.5,12004,890],[300.5,6005,222.6],[300.5,6605,244.9]],"EM250696":[[205.5,3726,663.1]],"EM250697":[[210.5,3845,674.5]],"EM250698":[[205.5,3780,672.7]],"EM250699":[[100.5,3005,271],[50,3005,135.5]],"EM250700":[[300.5,10004,560],[150,10004,530]],"EM250701":[[140.5,2405,461],[70,2405,230.5]],"EM250702":[[210.5,1800,213.9]],"EM250703":[[500.5,4245,247],[400.5,4245,197.6],[100.5,4245,49.4]],"EM250704":[[300,1201,17.8]],"EM250705":[[960,5052,54.9],[320,5052,18.3]],"EM250706":[[960,4452,53],[320,4452,17.7]],"EM250708":[[5,5,0]],"EM250709":[[5,10,0]],"EM250710":[[10,15,0]],"EM250711":[[1290,8052,47],[430,805,15.7]],"EM250712":[[300.5,3605,76.5]],"EM250713":[[100.5,7205,50.4]],"EM250714":[[300.5,10865,234.9]],"EM250715":[[140.5,5005,113]],"EM250716":[[66,1201,52.6]],"EM250717":[[49,1201,48.7]],"EM250718":[[100,1101,53]],"EM250719":[[100,831,57]],"EM250721":[[1,1303013421,27.2]],"EM250722":[[174,1303,24.5]],"EM250492":[[166,1201,21.3],[83,1201,10.7]],"EM250707":[[1280,3452,56],[320,3452,14]],"EM250720":[[650,303,23.2],[325,303,11.6]],"EM250723":[[200,1201,18.4]],"EM250724":[[226,1201,18.7]],"EM250725":[[266,1201,21.2]],"EM250726":[[320,1201,20.4]],"EM250727":[[400,1201,23.4]],"EM250728":[[533,1201,23.4],[400,1201,17.7],[133,1201,5.7]],"EM250729":[[100,4001,51.8]],"EM250679":[[300,1201,21],[150,1201,10.5]],"EM250730":[[9,500,1.2]],"EM250731":[[0,0,0]],"EM250732":[[0,0,0]],"EM250734":[[960,4452,62.1],[320,4452,20.7]],"EM250735":[[39,12012,50.2]],"EM250682":[[326,1201,20.2],[110,1201,6.8],[216,1201,13.4]],"EM250736":[[49,12012,50.5]],"EM250737":[[100,30012,53.2]],"EM250738":[[100,16512,54.5]],"EM250739":[[100,11012,53]],"EM250740":[[100,8312,53.9]],"EM250741":[[100,6212,59.5]],"EM250742":[[100,4012,54]],"EM250743":[[196,12012,17.3]],"EM240758":[[166,1201,16.7]],"EM250744":[[1720,5052,35.8],[430,5052,8.9]],"EM250745":[[326,12012,20.2]],"EM250746":[[284,12012,18.7]],"EM250747":[[250,12012,19.4],[125,12012,9.7]],"EM250660":[[1332,2401,46.1],[446,2401,15.5],[440,2401,15.2]],"EM250733":[[1248,2401,43.3],[416,2401,14.4]],"EM250748":[[0,0,5]],"EM250749":[[0,0,3]],"EM250750":[[204,200,2.3]],"EM250751":[[0,0,1.6]],"EM250752":[[149,750,95]],"EM250753":[[0,0,0.6]],"EM250754":[[0,0,0.7]],"EM250755":[[10,95,0.8]],"EM250756":[[149,125024,135]],"EM250757":[[205.5,13338,964.6]],"EM250758":[[205.5,6690,483.8]],"EM250759":[[4634,0,597.6]],"EM250760":[[205.5,3666,652.4]],"EM250761":[[205.5,2014,358.4]],"EM250762":[[176,3600,116.4]],"EM250763":[[100.5,2005,141.6]],"EM250764":[[1290,6052,32],[430,6052,10.7]],"EM250765":[[80,321,65]],"EM250766":[[80,221,56]],"EM250767":[[80,181,60.3]],"EM250768":[[100,1201,26.5]],"EM250769":[[160,1201,22.1],[80,1201,11.1]],"EM250770":[[320,1201,20.4],[210,1201,13.4],[110,1201,7]],"EM250771":[[266,1201,21.2],[133,1201,10.6]],"EM250772":[[200,1201,18.4]],"EM250773":[[100,1201,20.6]],"EM250775":[[450,1201,21.4]],"EM250776":[[300,1201,17.8]],"EM250777":[[250,1201,19.4],[125,1201,9.7]],"EM250778":[[166,1201,16.7],[83,1201,8.4]],"EM250779":[[200.5,3889,666]],"EM250780":[[150.5,4505,41.5]],"EM250781":[[150.5,3005,35.9]],"EM250782":[[150.5,2205,36]],"EM250783":[[150.5,2885,65.7]],"EM250784":[[300.5,2885,132.1],[150,2885,66.1]],"EM250785":[[401.5,2610,79.9]],"EM250786":[[401.5,1710,78.8]],"EM250787":[[403.5,1610,15.4]],"EM250788":[[403.5,1310,74.1]],"EM250789":[[401.5,2130,147.4]],"EM250790":[[199.5,4005,25.6]],"EM250791":[[360.5,2770,168.9],[280.5,2770,131.4],[80.5,2770,37.5]],"EM250792":[[180.5,2590,79.1],[90.5,2590,39.6]],"EM250793":[[90.5,1300,35.6],[272.5,1300,107]],"EM250794":[[180.5,1390,75.8],[90.5,1390,38]],"EM250774":[[484,1201,22.4],[404,1201,18.7],[80,1201,3.7]],"EM250795":[[430,1201,23.9]],"EM250796":[[960,4452,62.1],[320,4452,20.7]],"EM250797":[[1290,6052,32],[430,6052,10.7]],"EM250798":[[1720,5052,35.8],[430,5052,8.9]],"EM250799":[[100,501,51.1]],"EM250800":[[400,1201,36]],"EM250801":[[133,1201,27.6]],"EM250802":[[100,1201,26.5]],"EM250803":[[100,621,54.6]],"EM250804":[[100,1201,55]],"EM250805":[[100,1651,54.7]],"EM250806":[[100,1201,37.1]],"EM250807":[[66,1201,35.2]],"EM250808":[[80,1201,35.7]],"EM240757":[[484,1201,22.4],[404,1201,18.7],[80,1201,3.7]],"EM250809":[[400,1201,32]],"EM250810":[[7,1001018723,1.3]],"EM250811":[[650,303,30.5],[325,303,15.3]],"EM250812":[[501.5,6260,73.8]],"EM250813":[[400.5,5210,57.8]],"EM250814":[[199.5,2005,8.9]],"EM250815":[[199.5,2005,10.2]],"EM250816":[[139.5,2005,7]],"EM250817":[[199.5,2005,9]],"EM250818":[[99.5,4005,12]],"EM250819":[[199.5,2005,11.4]],"EM250820":[[199.5,1505,3.3]],"EM250821":[[199.5,4005,9]],"EM250822":[[199.5,2005,4.9]],"EM250823":[[199.5,2005,5.9]],"EM250824":[[199.5,2005,6.8]],"EM250825":[[124.5,4005,7.6]],"EM250826":[[199.5,2005,7.2]],"EM250827":[[500,2003,35.7]],"EM250828":[[80,91,70]],"EM250829":[[300.5,5005,560],[150.5,5005,320.9]],"EM250830":[[900.5,7205,888],[450,7205,444]],"EM250831":[[300.5,2365,105]],"EM250832":[[300.5,4645,190]],"EM250833":[[450.5,4645,314.4]],"EM250834":[[200.5,5005,60],[100,5005,30]],"EM250835":[[8,0,9]],"EM250836":[[5.5,1403,2.3]],"EM250837":[[5,1303,2.6]],"EM250838":[[300.5,10004,560],[150,10004,500]],"EM250839":[[300.5,10004,1120],[150,10004,480]],"EM250840":[[346.5,11392,502.1]],"EM250842":[[450.5,11412,212]],"EM250843":[[600.5,5005,128],[400,5005,85.3]],"EM250844":[[600.5,5005,144],[300,5005,72]],"EM250845":[[200.5,14485,208]],"EM250846":[[120.5,242,2.7],[120.5,3388,37.8]],"EM250847":[[120.5,472,5.4],[120.5,7552,86.4]],"EM250848":[[150.5,40870,569.5],[150.5,3660,51]],"EM250849":[[450.5,7245,324]],"EM250850":[[500.5,4245,247],[400.5,4245,197.6],[100.5,4245,49.4]],"EM250851":[[600.5,4205,302.4],[300.5,4205,151.2]],"EM250852":[[200.5,2825,67.2]],"EM250853":[[300.5,2825,100.8]],"EM250854":[[300.5,5645,201.6]],"EM250855":[[900.5,8465,886],[450.5,8465,443]],"EM250856":[[210.5,1350,213.9]],"EM250857":[[196,1201,17.3]],"EM250858":[[0.5,1403013421,24.7]],"EM250859":[[0.5,1403013421,22.4]],"EM250860":[[6,1001017723,1.5]],"EM250861":[[28,1001017723,4.5]],"EM250862":[[6,1001017723,1.5]],"EM250863":[[28,1001017723,4.5]],"EM250864":[[375,1201,33.6]],"EM250865":[[240,201,77],[120,201,38.5]],"EM250866":[[599,1201,27],[400,1201,18],[199,1201,9]],"EM250867":[[960,4452,53],[320,4452,17.7]],"EM250868":[[1290,605,33.7],[430,605,11.3]],"EM250841":[[600.5,12004,890],[300.5,6005,222.6],[300.5,6605,244.9]],"EM250876":[[66,1201,52.6]],"EM250877":[[60,161,57.5]],"EM250878":[[240,201,60.6],[120,201,30.3]],"EM250879":[[60,401,62]],"EM250880":[[60,301,58.8]],"EM250881":[[60,201,54.9]],"EM250882":[[284,1201,18.7]],"EM250883":[[160,1201,17.8]],"EM250884":[[200,1302,0]],"EM250885":[[450.5,9190,56.4]],"EM250886":[[560.5,9190,73]],"EM250887":[[600.5,9190,73.9]],"EM250888":[[675.5,9190,84.5]],"EM250889":[[1290,605,30.7],[430,605,10.3]],"EM250890":[[430,1201,23.9]],"EM250891":[[100,12012,26]],"EM250892":[[80,12012,26.2]],"EM250893":[[133,12012,27.6]],"EM250869":[[803.5,5236,95.7],[402.5,5236,47.9]],"EM250870":[[1605.5,5236,191.6],[402.5,5236,47.9]],"EM250871":[[1605.5,5236,191.6],[402.5,5236,47.9]],"EM250872":[[0,0,47.9]],"EM250873":[[0,0,47.9]],"EM250874":[[0,0,95.7]],"EM250875":[[0,0,95.7]],"EM250894":[[250,1201,19.4]],"EM250895":[[76,2561,34.6]],"EM250896":[[300.5,5005,560],[150.5,5005,320.9]],"EM250897":[[200.5,3005,520],[100,3005,260]],"EM250898":[[300.5,10865,234.8]],"EM250899":[[280.5,5005,123.9],[140,5005,62]],"EM250900":[[150.5,4148,60]],"EM250901":[[150.5,3390,47.6]],"EM250902":[[150.5,4825,69.7]],"EM250903":[[300.5,4825,139.3]],"EM250904":[[200.5,6809,447]],"EM250905":[[200.5,6869,482.7]],"EM250906":[[203.5,4631,569.1]],"EM250907":[[203.5,4679,585.5]],"EM250908":[[200.5,3889,666]],"EM250909":[[200.5,2043,328.7]],"EM250910":[[200.5,2043,341.4]],"EM250911":[[300.5,10004,560],[150,10004,530]],"EM250912":[[120.5,6004,300],[60,6004,300]],"EM250913":[[300.5,8004,507],[150,8004,507]],"EM250914":[[600.5,16004,518.2],[300.5,8004,259.1],[300.5,8604,278.5]],"EM250915":[[200.5,3635,106.8]],"EM250916":[[200.5,4230,147]],"EM250917":[[200.5,6820,235.2]],"EM250918":[[300.5,4230,220.5]],"EM250919":[[300.5,2365,145]],"EM250920":[[300.5,2825,100.8]],"EM250921":[[900.5,8465,886],[450.5,8465,443]],"EM250922":[[147.5,6005,225]],"EM250923":[[150.5,4005,282],[75,4005,141]],"EM250924":[[8,0,9]],"EM250925":[[8,0,9]],"EM250926":[[450.5,5645,294.4]],"EM250927":[[600.5,4000,118.6],[150.5,4000,29.7]],"EM250928":[[22.5,0,0]],"EM250929":[[22.5,0,0]],"EM250930":[[22.5,0,0]],"EM250931":[[22.5,0,0]],"EM250932":[[600.5,4000,118.6],[150.5,4000,29.7]],"EM250933":[[600.5,4000,118.6],[150.5,4000,29.7]],"EM250934":[[600.5,4000,118.6],[150.5,4000,29.7]],"EM250935":[[0,0,29.7]],"EM250936":[[150.5,4000,29.7]],"EM250937":[[150.5,4000,29.7]],"EM250938":[[320,1201,33],[210,1201,21.6],[110,1201,11.4]],"EM250939":[[76,2561,34.6]],"EM250940":[[71,2561,32.3]],"EM250941":[[450,12012,21]],"EM250942":[[250,1201,19.4],[125,1201,9.7]],"EM250943":[[160,1201,17.8]],"EM250944":[[1290,605,33.7],[430,605,11.3]],"EM250945":[[363,1201,20.9]],"EM250946":[[266,1201,22.5],[133,1201,11.25]],"EM250947":[[533,1201,23.4],[400,1201,17.7],[133,1201,5.7]],"EM250948":[[400,1201,23.4]],"EM250949":[[320,1201,20.4]],"EM250950":[[266,1201,21.2]],"EM250951":[[200,1201,18.4]],"EM250952":[[960,505,68.6],[320,505,22.8]],"EM250953":[[0.5,1403011721,22.9]],"EM250954":[[468.5,8101,400.5],[407.5,8101,348.3],[61.5,8101,51.7]],"EM250955":[[407.5,11141,478.2]],"EM250956":[[407.5,10823,464.5]],"EM250957":[[407.5,10399,446.3]],"EM250958":[[407.5,9727,417.4]],"EM250959":[[407.5,8915,382.5]],"EM250960":[[398.5,4495,188.6]],"EM250961":[[407.5,4425,189.8]],"EM250962":[[407.5,4459,191.3]],"EM250963":[[256.5,4177,112.9]],"EM250964":[[521.5,4071,223.9],[260.5,4071,112]],"EM250965":[[201.5,5020,342.5]],"EM250966":[[166,1201,21.3],[83,1201,10.7]],"EM250967":[[80,1201,20.6]],"EM250968":[[501,1201,32.3],[401,1201,25.8],[100,1201,6.5]],"EM250969":[[400,1201,30.2]],"EM250970":[[320,1201,29],[210,1201,19],[110,1201,10]],"EM250971":[[214,1201,22.5]],"EM250972":[[133,1201,21.9]],"EM250973":[[106,1201,20.1]],"EM250974":[[100,1201,18.1]],"EM250975":[[160,1201,19.5],[80,1201,9.8]],"EM250976":[[80,1201,14]],"EM250977":[[750,1201,24.4],[375,1201,12.2]],"EM250978":[[599,1201,27],[400,1201,18],[199,1201,9]],"EM250979":[[860,1201,26.8],[430,1201,13.4]],"EM250980":[[106,1201,15.1]],"EM250981":[[100,1201,16.5]],"EM250982":[[83,1201,14.1]],"EM250983":[[860,1201,29.2],[430,1201,14.6]],"EM250984":[[200,1201,24.6]],"EM250985":[[300,1201,27.2],[200,1201,27.2],[100,1201,27.2]],"EM250986":[[200,1201,27.8]],"EM250987":[[800,1001,53.6],[400,1001,26.8]],"EM250988":[[100,1201,23.4]],"EM250989":[[450,1201,21.4]],"EM250990":[[400,1001,26.4]],"EM250991":[[100,2401,53.8]],"EM250992":[[100,1651,54.7]],"EM250993":[[100,831,57]],"EM250994":[[100,501,51.1]],"EM250995":[[100,401,54.3]],"EM250996":[[60,401,62]],"EM250997":[[250,1201,19.4]],"EM250998":[[196,1201,17.3]],"EM250999":[[100,3001,52.5]],"EM260001":[[0.5,1403013421,24.7]],"EM260002":[[0.5,1403013421,25.6]],"EM260003":[[49,12012,50.5]],"EM260004":[[250,1201,19.4],[125,1201,9.7]],"EM260005":[[1290,601,34.5],[430,601,11.5]],"EM260006":[[83,1201,14.1]],"EM260007":[[100,1201,16.5]],"EM260008":[[300,1201,17.8]],"EM260009":[[484,1201,22.4],[404,1201,18.7],[80,1201,3.7]],"EM260010":[[363,1201,20.9]],"EM260011":[[500,801,8.2]],"EM260012":[[200.5,4004,432.1]],"EM260013":[[262,1201,18.3],[131,1201,9.2]],"EM260014":[[61.5,2405,4.2],[435.5,2405,29.4]],"EM260015":[[68.5,10910,25]],"EM260016":[[600.5,405,32],[300,405,16]],"EM260017":[[500.5,405,31],[250.5,405,15.5]],"EM260018":[[4,0,12]],"EM240764":[[160,1201,22.1]],"EM260019":[[80,421,63.5]],"EM260020":[[80,221,53.4]],"EM260021":[[929,1201,15.9],[464.5,1201,8]],"EM260022":[[530,1201,13.5]],"EM260023":[[400,1201,17.5]],"EM260024":[[320,1201,16.1],[160,1201,8]],"EM260025":[[880,1201,44],[440,1201,22]],"EM260026":[[1000,1201,41.1],[400,1201,16.5],[200,1201,8.1]],"EM260027":[[750,1201,34.2],[375,1201,17.1]],"EM260028":[[300.5,2825,100.8]],"EM260029":[[600.5,5005,128],[400,5005,85.3]],"EM260030":[[300.5,3605,76.5]],"EM260031":[[100.5,7205,50.4]],"EM260032":[[120.5,6055,70.1]],"EM260033":[[400.5,5005,256],[100,5005,128]],"EM260034":[[200.5,3635,106.8],[100,3635,53.4]],"EM260035":[[300.5,7085,204.5]],"EM260036":[[200.5,9605,196],[100,9605,98]],"EM260037":[[203.5,1424,269.5]],"EM260038":[[203.5,2814,661.4]],"EM260039":[[203.5,2974,699]],"EM260040":[[203.5,2334,548.6]],"EM260041":[[100,621,54.6]],"EM260042":[[50,3805,213.5]],"EM260043":[[50,3805,158]],"EM260044":[[107,2250,428.4]],"EM260046":[[22.5,0,0]],"EM260047":[[22.5,0,0]],"EM260048":[[22.5,0,0]],"EM260049":[[860,1201,26.8],[430,1201,13.4]],"EM260050":[[400,1001,26.4]],"EM260051":[[455.5,11370,53.9]],"EM260052":[[401.5,2610,79.9]],"EM260053":[[403.5,1310,74.1]],"EM260054":[[401.5,2130,147.4]],"EM260055":[[199.5,1505,3.3]],"EM260056":[[149.5,2005,4.9]],"EM260057":[[189.5,4005,13.1]],"EM260058":[[62.5,2005,327],[31.5,2005,186]],"EM260059":[[74.5,2005,382]],"EM260060":[[99.5,2005,517],[49.5,2005,258.5]],"EM260061":[[124.5,2005,654],[62.5,2005,327]],"EM260062":[[334.5,8340,166.8]],"EM260063":[[0,0,0]],"EM260064":[[0,0,0]],"EM260065":[[22.5,0,0]],"EM260066":[[250,1201,19.4],[125,1201,9.7]],"EM260067":[[200,1201,24.6]],"EM260068":[[59,2050,28.3]],"EM260069":[[650,303,21],[325,303,10.5]],"EM260070":[[99.5,2005,430],[50,2005,215]],"EM260071":[[200.5,4005,674.5],[100,4005,337.3]],"EM260072":[[450,1201,21.4]],"EM260073":[[196,1201,17.3]],"EM260074":[[284,1201,18.7]],"EM260075":[[300,1201,17.8]],"EM260076":[[6,2201,2.6]],"EM260077":[[80,91,70]],"EM260078":[[0,0,9]],"EM260079":[[8,0,9]],"EM260080":[[300.5,6004,479.6],[150,6004,239.8]],"EM260081":[[140.5,6004,378],[70,3144,200]],"EM260082":[[140.5,7204,390]],"EM260083":[[300.5,8004,1037.3],[150,8004,518.6]],"EM260084":[[300.5,8004,1037.3],[150,8004,518.7]],"EM260085":[[300.5,5645,201.6]],"EM260086":[[400.5,5645,268.8]],"EM260087":[[200.5,8465,193.2]],"EM260088":[[200.5,3605,74]],"EM260089":[[300.5,3605,108]],"EM260090":[[7245,0,290]],"EM260091":[[450.5,7245,324]],"EM260092":[[200.5,2825,67.2]],"EM260093":[[300.5,2825,100.8]],"EM260094":[[400.5,5645,268.8]],"EM260095":[[200.5,3605,74]],"EM260096":[[300.5,3605,108]],"EM260097":[[7245,0,290]],"EM260098":[[200.5,8465,193.2]],"EM260099":[[200.5,2825,67.2]],"EM260100":[[300.5,2825,100.8]],"EM260101":[[400.5,5645,268.8]],"EM260102":[[300.5,8005,261.6]],"EM260103":[[300.5,2825,147]],"EM260104":[[600.5,16004,518.2],[300.5,8004,259.1],[300.5,8604,278.5]],"EM260105":[[400.5,5005,256],[100,5005,128]],"EM260106":[[302.5,23260,275.7]],"EM260107":[[600.5,5005,144],[300,5005,72]],"EM260108":[[300.5,12305,229.5]],"EM260109":[[300.5,3605,76.5]],"EM260110":[[600.5,7205,310.6],[300,7205,155.3]],"EM260111":[[100.5,4805,46.8]],"EM260112":[[75.5,9605,73]],"EM260113":[[300.5,2365,73]],"EM260115":[[120.5,4005,111]],"EM260116":[[120.5,3605,323],[60,3605,161.5]],"EM260117":[[280.5,5844,539.4],[140,5844,269.7]],"EM260118":[[200.5,6868,486]],"EM260119":[[200.5,3772,672.7]],"EM260120":[[100.5,3005,271],[50,3005,135.5]],"EM260121":[[200.5,1920,327]],"EM260122":[[100.5,3005,271],[50,3005,135.5]],"EM260123":[[140.5,10004,910],[70,10004,910]],"EM260124":[[650,303,21],[325,303,10.5]],"EM260125":[[960,505,68.6],[320,505,22.8]],"EM260126":[[60,301,58.8]],"EM260127":[[167.5,3,22.3]],"EM260128":[[167.5,3,22.3]],"EM260129":[[167.5,3,22.3]],"EM260130":[[167.5,3,22.3]],"EM260131":[[167.5,3,22.3]],"EM260132":[[167.5,3,22.3]],"EM260133":[[167.5,3,22.3]],"EM260134":[[167.5,3,22.3]],"EM260135":[[150.5,4,20.1]],"EM260136":[[150.5,4,20.1]],"EM260137":[[150.5,4,20.1]],"EM260138":[[150.5,4,20.1]],"EM260139":[[150.5,4,20.1]],"EM260140":[[405.5,5300,48.7]],"EM260141":[[405.5,5300,48.7]],"EM260142":[[167.5,3,21.5]],"EM260143":[[99.5,5,12.8]],"EM260144":[[167.5,3,21.5]],"EM260145":[[167.5,3,21.5]],"EM260146":[[167.5,3,21.5]],"EM260147":[[167.5,3,21.5]],"EM260148":[[167.5,3,21.5]],"EM260149":[[167.5,3,6.3]],"EM260150":[[167.5,3,21.5]],"EM260151":[[405.5,5300,48.7]],"EM260152":[[112.5,5,22.7]],"EM260153":[[112.5,5,22.7]],"EM260154":[[112.5,5,22.7]],"EM260155":[[112.5,5,27.7]],"EM260156":[[112.5,5,27.7]],"EM260157":[[112.5,5,22.7]],"EM260158":[[0,0,22.2]],"EM260159":[[0,0,2.1]],"EM260160":[[0,0,22.2]],"EM260161":[[299.5,2,40.8]],"EM260162":[[299.52,4500,40.8]],"EM260163":[[299.5,2,40.8]],"EM260164":[[299.52,4500,40.8]],"EM260165":[[299.52,4500,40.8]],"EM260166":[[299.52,4500,40.8]],"EM260167":[[299.52,4500,40.8]],"EM260168":[[112.5,5,21.4]],"EM260169":[[112.5,5,21.4]],"EM260170":[[112.5,5,21.4]],"EM260114":[[140.5,5005,106.4],[70,5005,53.2]],"EM260171":[[0,0,1058]],"EM260172":[[0,0,2.3]],"EM260173":[[0,0,1.6]],"EM260174":[[149,750,95]],"EM260175":[[0,0,168]],"EM260176":[[0,0,0.7]],"EM260177":[[0,0,224]],"EM260178":[[0,0,0.8]],"EM260179":[[0,0,0.8]],"EM260180":[[22.5,0,0]],"EM260181":[[22.5,0,0]],"EM260182":[[22.5,0,0]],"EM260183":[[22.5,0,0]],"EM260184":[[133,1201,27.6]],"EM260185":[[250,12012,18.6],[125,12012,9.3]],"EM260186":[[226,12012,18.7]],"EM260187":[[100,831,57]],"EM260188":[[202.5,1556,386.1]],"EM260189":[[202.5,1572,386.2]],"EM260190":[[100.5,3005,370],[50,3005,185]],"EM260191":[[140.5,6004,378],[70,6004,189]],"EM260192":[[140.5,2405,461],[70,2405,320.5]],"EM260193":[[200.5,3005,520],[100,3005,260]],"EM260194":[[140.5,2405,461],[70,2405,230.5]],"EM260195":[[300.5,8004,1037.3],[150,8004,518.6]],"EM260196":[[140.5,7204,750.4],[70,7204,750.4]],"EM260197":[[120.5,3005,307],[60,3005,153.5]],"EM260198":[[300.5,8004,507],[150,8004,507]],"EM260200":[[120.5,3005,294],[60,3005,147]],"EM260201":[[120.5,3005,316.5],[60,3005,158]],"EM260202":[[147.5,6005,225]],"EM260203":[[150.5,2605,238]],"EM260204":[[120.5,4005,111]],"EM260205":[[300,1201,17.8]],"EM260206":[[266,1201,46.7]],"EM260207":[[4,0,25.4]],"EM260208":[[25,5305,152]],"EM260209":[[25,5305,110]],"EM260210":[[300,12012,18.3]],"EM260211":[[60,301,58.8]],"EM260212":[[240,201,60.6],[120,201,30.3]],"EM260213":[[300,1201,17.8]],"EM260214":[[450,1201,21.4]],"EM260215":[[4,0,12]],"EM260216":[[22.5,0,0]],"EM260217":[[375,1201,33.7]],"EM260219":[[1200,601,26],[400,601,8.7]],"EM260220":[[284,1201,18.7]],"EM260221":[[196,1201,17.3]],"EM260222":[[250,1201,19.4]],"EM260223":[[300,1201,17.8]],"EM260224":[[100,1201,26.5]],"EM260225":[[250,1201,19.4],[125,1201,9.7]],"EM260226":[[120,803,76.8],[60,803,38.4]],"EM260227":[[196,1201,17.3]],"EM260228":[[450,1201,21.4]],"EM260229":[[599,1201,26],[400,1201,17.4],[199,1201,8.6]],"EM260230":[[1200,601,26],[400,601,8.7]],"EM260231":[[599,1201,26],[400,1201,17.4],[199,1201,8.6]],"EM260232":[[790.5,22384,1319],[395,22384,656]],"EM260233":[[407.5,6580,199.6]],"EM260234":[[379.5,10120,285.6]],"EM260235":[[379.5,15120,427]],"EM260236":[[100,1201,26.5]],"EM260238":[[610,2401,59.6]],"EM260239":[[800,2401,45.8],[600,2401,34.3],[200,2401,11.5]],"EM260240":[[680,2401,31],[450,2401,20.5],[230,2401,10.5]],"EM260241":[[200,1201,24.6]],"EM260242":[[200.5,2405,48.4],[100,2405,24.2]],"EM260243":[[146.5,2005508,61]],"EM260244":[[300.5,8802,336.4]],"EM260245":[[300.5,13192,504.1]],"EM260246":[[95.5,1294041,1120]],"EM260247":[[600.5,16004,518.2],[300.5,8004,259.1],[300.5,8604,278.5]],"EM260248":[[600.5,12004,890],[300.5,6005,222.6],[300.5,6605,244.9]],"EM260249":[[22.5,0,0]],"EM260250":[[22.5,0,0]],"EM260251":[[22.5,0,0]],"EM260218":[[300,1201,31.8],[150,1201,15.9]],"EM260252":[[1000,1201,41.1],[400,1201,16.5],[200,1201,8.1]],"EM260253":[[880,1201,44],[440,1201,22]],"EM260254":[[0.5,1303013451,27.6]],"EM260255":[[5,1303,2.5]],"EM260256":[[400,1201,23.4]],"EM260257":[[300,1201,17.8]],"EM260258":[[284,1201,18.7]],"EM260259":[[250,1201,18.8],[125,1201,9.4]],"EM260260":[[200,1201,18.4]],"EM260261":[[1290,601,34.5],[430,601,11.5]],"EM260262":[[1290,605,38],[430,605,12.7]],"EM260263":[[140.5,2405,504],[70,2405,252]],"EM240751":[[100,1201,26.5]],"EM260264":[[8,0,9]],"EM260265":[[8,0,9]],"EM260266":[[194.5,4885,86.7]],"EM260267":[[225.5,3873,79.7]],"EM260268":[[225.5,4125,84.9]],"EM260269":[[225.5,4415,90.9]],"EM260270":[[225.5,4993,102.8]],"EM260271":[[225.5,7595,164]],"EM260272":[[225.5,8319,171.2]],"EM260273":[[442.5,4035,163]],"EM260274":[[442.5,4319,190]],"EM260275":[[442.5,4531,199.4]],"EM260276":[[442.5,4885,197.3]],"EM260277":[[442.5,8137,328.6]],"EM260278":[[442.5,8385,338.6]],"EM260279":[[600.5,5005,128],[400,5005,85.3]],"EM260280":[[99.5,2005,430],[50,2005,215]],"EM260281":[[140.5,2405,461],[70,2405,320.5]],"EM260282":[[1200,601,26],[400,601,8.7]],"EM260283":[[200,1201,23.5]],"EM260284":[[166,1201,21.3],[83,1201,10.7]],"EM260285":[[160,1201,22.1],[80,1201,11.1]],"EM260286":[[484,1201,22.4],[404,1201,18.7],[80,1201,3.7]],"EM260287":[[100,1201,23.4]],"EM260289":[[320,1201,32]],"EM260290":[[375,1201,33.6]],"EM260291":[[430,1201,40]],"EM260292":[[0.5,1403013421,24.7]],"EM260293":[[0.5,1403013421,22.4]],"EM260294":[[0.5,1413013451,28.5]],"EM260295":[[300,1201,31.8]],"EM260296":[[400,1201,32]],"EM260297":[[133,1201,27.6]],"EM260298":[[100,1201,26.5]],"EM260299":[[100,561,57]],"EM260300":[[39,1201,61.2]],"EM260301":[[860,1201,26.8],[430,1201,13.4]],"EM260302":[[860,1201,29.2],[430,1201,14.6]],"EM260303":[[750,1201,24.4],[375,1201,12.2]],"EM260304":[[599,1201,27],[400,1201,18],[199,1201,9]],"EM260305":[[226,1201,18.7]],"EM260306":[[133,1201,17.3]],"EM260307":[[106,1201,15.1]],"EM260308":[[599,1201,26],[400,1201,17.4],[199,1201,8.6]],"EM260288":[[640,601,32],[320,601,16]],"EM260309":[[160,1201,17.8]],"EM260310":[[100,1201,55]],"EM260312":[[1200,1201,64],[400,1201,21.4]],"EM260313":[[650,303,25],[325,303,12.5]],"EM260314":[[800,1001,53.6],[400,1001,26.8]],"EM260315":[[450,1201,16.9]],"EM260316":[[400,1201,17.5]],"EM260317":[[320,1201,16.1]],"EM260318":[[200,1201,13.9]],"EM260319":[[400,1201,15.6]],"EM260321":[[266,1201,15.6],[133,1201,7.8]],"EM260322":[[219.5,2709,65.1]],"EM260323":[[219.5,2567,61.7]],"EM260324":[[219.5,4971,119.4]],"EM260325":[[219.5,5199,124.9]],"EM260326":[[219.5,4595,110.4]],"EM260327":[[219.5,3835,92.1]],"EM260328":[[219.5,3063,73.6]],"EM260329":[[219.5,2189,52.6]],"EM260330":[[219.5,3475,83.5]],"EM260331":[[126.5,1009,13.9]],"EM260332":[[126.5,2709,41]],"EM260333":[[126.5,791,10.9]],"EM260334":[[126.5,1139,15.7]],"EM260335":[[126.5,747,10.3]],"EM260336":[[126.5,1357,18.8]],"EM260337":[[126.5,443,6.1]],"EM260338":[[126.5,1441,19.9]],"EM260339":[[126.5,2933,40.5]],"EM260340":[[126.5,5113,75]],"EM260341":[[126.5,4511,66]],"EM260342":[[126.5,3749,51.8]],"EM260343":[[126.5,2977,41.1]],"EM260344":[[126.5,2103,29.1]],"EM260345":[[126.5,1195,16.5]],"EM260346":[[126.5,2657,35.5]],"EM260347":[[126.5,1915,26.5]],"EM260348":[[317.5,229036521,73.1]],"EM260349":[[78,496,4.2]],"EM260350":[[78,742,6.3]],"EM260351":[[78,464,4]],"EM260352":[[26,1812,5.2]],"EM260353":[[78,956,8.2]],"EM260354":[[78,250,2.1]],"EM260355":[[78,2010,17.2]],"EM260356":[[26,1342,3.8]],"EM260320":[[320,1201,15.6],[210,1201,10.3],[110,1201,5.3]],"EM260311":[[166,1201,16.7],[83,1201,8.4]],"EM260357":[[61.5,2405,4.2],[435.5,2405,29.4]],"EM260358":[[320,1201,32]],"EM260359":[[80,251,62]],"EM260360":[[4,0,12]],"EM260361":[[80,251,62]],"EM260362":[[334,905,25]],"EM260363":[[400,1201,23.4]],"EM260364":[[320,1201,20.4],[210,1201,13.4],[110,1201,7]],"EM260365":[[266,1201,21.2],[133,1201,10.6]],"EM260366":[[226,1201,18.7]],"EM260367":[[200,1201,18.4]],"EM260368":[[66,1201,52.6]],"EM260369":[[960,505,68.6],[320,505,22.8]],"EM260370":[[80,1201,52.2]],"EM260371":[[430,1201,23.9]],"EM260372":[[200,1201,20.3]],"EM260373":[[166,1201,16.7],[83,1201,8.4]],"EM260374":[[160,1201,19.5],[80,1201,9.8]],"EM260375":[[803.5,5236,95.7],[402.5,5236,47.9]],"EM260376":[[150.5,4000,29.7]],"EM260377":[[0,0,29.7]],"EM260378":[[0,0,29.7]],"EM260379":[[0,0,118.6]],"EM260380":[[0,0,118.6]],"EM260381":[[0,0,118.6]],"EM260382":[[0,0,118.6]],"EM260045":[[193,1538330,312.1],[193.5,3500330,624.2],[193.5,12001000330,552.8]],"EM260383":[[101.5,2040,267.4]],"EM260384":[[101.5,2040,41]],"EM260385":[[99.5,2005,430],[50,2005,215]],"EM260386":[[100,3005,252],[50,3005,126]],"EM260387":[[200.5,6809,447]],"EM260388":[[200.5,6869,482.7]],"EM260389":[[200.5,2568,175]],"EM260390":[[200.5,3216,364.6]],"EM260391":[[200.5,2454,297.1]],"EM260392":[[200.5,4836,585.5]],"EM260393":[[200.5,2448,296.4]],"EM260394":[[200.5,2316,328]],"EM260395":[[200.5,2043,341.4]],"EM260396":[[200.5,1992,332.8]],"EM260397":[[200.5,1974,329.8]],"EM260398":[[599,1201,26],[400,1201,17.4],[199,1201,8.6]],"EM260399":[[960,505,68.6],[320,505,22.8]],"EM260400":[[960,445,60],[320,445,20]],"EM260401":[[960,5052,68.6],[320,5052,22.8]],"EM260402":[[960,4452,62.1],[320,4452,20.7]],"EM260403":[[650,303,21],[325,303,10.5]],"EM260404":[[200,1201,24.6]],"EM260405":[[150,1201,26.9]],"EM260406":[[133,1201,27.6]],"EM260407":[[100,1201,23.4]],"EM260408":[[284,1201,18.7]],"EM260409":[[5,1303,2.5]],"EM260410":[[200,1201,55.6]],"EM260411":[[66,1201,52.6]],"EM260412":[[100,831,57]],"EM260413":[[49,1201,48.7]],"EM260414":[[100,1201,29]],"EM260415":[[100,1201,37.1]],"EM260416":[[66,1201,35.2]],"EM260417":[[200.5,3605,74]],"EM260418":[[300.5,3605,108]],"EM260419":[[200.5,10895,216.1]],"EM260420":[[7245,0,290]],"EM260421":[[450.5,7245,324]],"EM260422":[[500.5,4245,247],[400.5,4245,197.6],[100.5,4245,49.4]],"EM260423":[[200.5,2825,67.2]],"EM260424":[[900.5,8465,886],[450.5,8465,443]],"EM260425":[[300.5,4645,190]],"EM260426":[[450.5,4645,314.4]],"EM260427":[[300.5,2365,105]],"EM260428":[[900.5,7205,888],[450,7205,444]],"EM260429":[[400,1201,30.2]],"EM260431":[[266,1201,25.6],[133,1201,12.8]],"EM260432":[[214,1201,22.5]],"EM260433":[[200,1201,23.5]],"EM260237":[[1248,2401,43.3],[416,2401,14.4]],"EM260434":[[1220,2401,42.3],[610,2401,21.7]],"EM260435":[[502,1201,37.2],[402,1201,29.6],[100,1201,7.6]],"EM260436":[[49,12012,50.5]],"EM260437":[[95.5,1220,48]],"EM260453":[[8,0,9]],"EM260438":[[200.5,2244,330]],"EM260439":[[200.5,2000,316]],"EM260440":[[200.5,3865,316]],"EM260441":[[200.5,2043,328.7]],"EM260442":[[200.5,1948,338.2]],"EM260443":[[200.5,1975,319.7]],"EM260444":[[120.5,3605,323],[60,3605,161.5]],"EM260445":[[100.5,3005,271],[50,3005,135.5]],"EM260446":[[0.5,1303013421,23.7]],"EM260447":[[0.5,1303013421,22.5]],"EM260448":[[0.5,1403013421,24.7]],"EM260449":[[0.5,1403013421,24.7]],"EM260199":[[400.5,8004,1134.8],[200,8004,567.4]],"EM260451":[[200,8408,596]],"EM260452":[[450,72016760,125]],"EM260454":[[334,905,25]],"EM260455":[[284,1201,18.7],[142,1201,9.4]],"EM260456":[[100,1201,37.1]],"EM260457":[[250,1201,18.8],[125,1201,9.4]],"EM260458":[[100,1651,54.7]],"EM260459":[[266,1201,25.6],[133,1201,12.8]],"EM260460":[[214,1201,22.5]],"EM260461":[[160,1201,22.1],[80,1201,11.1]],"EM260462":[[82,1201,19.7]],"EM260463":[[80,1201,20.6]],"EM260464":[[300,1201,27.2]],"EM260465":[[300,1201,31.8]],"EM260466":[[200,1201,24.6]],"EM260467":[[150,1201,26.9]],"EM260468":[[133,1201,27.6]],"EM260469":[[960,445,60],[320,445,20]],"EM260470":[[960,505,68.6],[320,505,22.8]],"EM260471":[[200,1201,24.6]],"EM260472":[[49,1201,59.5]],"EM260473":[[363,1201,20.9]],"EM260474":[[1250,1201416,43.7],[416,1201,14.6]],"EM260475":[[150.5,4505,41.5]],"EM260476":[[50.5,1930,14.5]],"EM260477":[[100.5,1930,31.5]],"EM260478":[[150.5,2885,65.7]],"EM260479":[[358.5,4654,66]],"EM260480":[[360.5,4480,33.2]],"EM260481":[[401.5,5010,134.8]],"EM260482":[[403.5,4110,130]],"EM260483":[[401.5,2210,69.6]],"EM260484":[[403.5,1610,15.4]],"EM260485":[[403.5,1310,74.1]],"EM260486":[[200,1201,18.4]],"EM260487":[[66,1201,52.6]],"EM260488":[[100,831,57]],"EM260489":[[49,1201,48.7]],"EM260490":[[200.5,5005,60],[100,5005,30]],"EM260491":[[300.5,4105,81]],"EM260492":[[300.5,12305,229.5]],"EM260493":[[600.5,6155,229.5],[300,6155,229.5]],"EM260494":[[400.5,5005,145.9],[200,5005,73]],"EM260495":[[150.5,7205,76.5]],"EM260496":[[300.5,3605,76.5]],"EM260497":[[450.5,7265,235.2]],"EM260498":[[300.5,8465,220.5]],"EM260499":[[280.5,5005,123.9],[140,5005,62]],"EM260500":[[300.5,2825,73.5]],"EM260501":[[240.5,5005,114.5],[120,5005,57.3]],"EM260502":[[100.5,4805,46.8]],"EM260503":[[140.5,5005,113]],"EM260504":[[1200,601,26],[400,601,8.7]],"EM260505":[[599,1201,26],[400,1201,17.4],[199,1201,8.6]],"EM260506":[[200.5,1885,40.1]],"EM260507":[[200.5,3635,106.8]],"EM260508":[[200.5,2825,98]],"EM260509":[[300.5,2825,147]],"EM260510":[[200.5,6890,486]],"EM260511":[[200.5,6868,486]],"EM260512":[[200.5,6770,500]],"EM260513":[[90,3,117]],"EM260514":[[180,18470,229.5]],"EM260515":[[200.5,2825,98]],"EM260516":[[300.5,565,28]],"EM260430":[[320,1201,29],[210,1201,19],[110,1201,10]],"EM260517":[[284,1201,18.7],[142,1201,9.4]],"EM260519":[[300,12012,18.3]],"EM260520":[[250,12012,18.6],[125,12012,9.3]],"EM260521":[[484,12012,22],[404,12012,18.4],[80,12012,3.6]],"EM260522":[[200,12012,18.2]],"EM260523":[[76,2561,34.6]],"EM260524":[[71,2561,32.3]],"EM260525":[[53,2050,22]],"EM260526":[[59,2050,28.3]],"EM260518":[[160,1201,17.8],[80,1201,8.9]],"EM260450":[[0.5,1403013421,28.5],[90,1403,14.3]],"EM260527":[[650,303,25],[325,303,12.5]],"EM260528":[[166,1201,21.3],[83,1201,10.7]],"EM260529":[[66,1201,35.2]],"EM260530":[[5,1003,1.5]],"EM260531":[[10,1003,2.9]],"EM260532":[[363,12012,20.9]],"EM260533":[[200,1201,18.4]],"EM260534":[[160,1201,17.8],[80,1201,8.9]],"EM260535":[[0,0,1058]],"EM260536":[[0,0,196]],"EM260537":[[0,0,0.8]],"EM260538":[[0,0,0.8]],"EM260540":[[4,508,0.6],[400,1080,110]],"EM260541":[[2,339,0.4],[400,1386,210]],"EM260542":[[3,508,1.1],[400,10802,220.3]],"EM260543":[[2,339,0.8],[400,13862,416]],"EM260544":[[166,1201,21.3],[83,1201,10.7]],"EM260545":[[300.5,10004,560],[150,10004,530]],"EM260546":[[22.5,0,0]],"EM260547":[[22.5,0,0]],"EM260548":[[8,0,9]],"EM260549":[[0,0,9]],"EM260550":[[8,0,9]],"EM260551":[[66,1201,35.2]],"EM260552":[[150,1201,26.9]],"EM260553":[[133,1201,27.6]],"EM260554":[[100,1201,23.4]],"EM260555":[[29,1001018723,4.3]],"EM260556":[[7,1001018723,1.3]],"EM260557":[[200.5,1720,40.1]],"EM260558":[[300.5,8005,261.6]],"EM260559":[[600.5,16004,518.2],[300.5,8004,259.1],[300.5,8604,278.5]],"EM260560":[[400.5,5005,256],[100,5005,128]],"EM260561":[[300.5,2825,147]],"EM260562":[[200.5,4690,162]],"EM260563":[[300.5,10004,1120],[150,10004,520]],"EM260564":[[200.5,6890,486]],"EM260565":[[200.5,1944,295]],"EM260566":[[200.5,1944,295]],"EM260567":[[140.5,5005,455],[70,5005,455]],"EM260568":[[200.5,10895,216.1]],"EM260569":[[600.5,5405,317.3],[400,5405,211.5],[200,5405,105.8]],"EM260570":[[450.5,5645,294.4]],"EM260571":[[300.5,4645,190]],"EM260572":[[0.5,14031013461,27.8]],"EM260573":[[599,1201,26],[400,1201,17.4],[199,1201,8.6]],"EM260574":[[334,905,25]],"EM260575":[[200.5,3605,74]],"EM260576":[[300.5,3605,108]],"EM260577":[[7245,0,290]],"EM260578":[[450.5,7245,324]],"EM260579":[[200.5,2825,67.2]],"EM260580":[[300.5,2825,100.8]],"EM260581":[[300.5,5645,201.6]],"EM260582":[[450.5,4645,314.4]],"EM260583":[[300.5,2365,105]],"EM260584":[[900.5,7205,888],[450,7205,444]],"EM260539":[[3,508,0.5],[400,2600,265],[400,2320,236.4],[400,1420,144],[200,1080,55]],"EM260585":[[296.5,11616,189]],"EM260586":[[200.5,5005,60]],"EM260587":[[150.5,7205,76.5]],"EM260588":[[600.5,7205,310.6],[300,7205,155.3]],"EM260589":[[200.5,2825,49]],"EM260590":[[100.5,4805,46.8]],"EM260591":[[150.5,4148,60]],"EM260592":[[140.5,5005,113]],"EM260593":[[600.5,5005,170.3],[200,5005,56.8]],"EM260594":[[400.5,5005,145.9],[200,5005,73]],"EM260595":[[280.5,5005,123.9],[140,5005,62]],"EM260596":[[240.5,5005,114.5],[120,5005,57.3]],"EM260597":[[300.5,17105,259.3]],"EM260598":[[600.5,6155,229.5],[300,6155,229.5]],"EM260599":[[200.5,3605,51.8]],"EM260600":[[300.5,8465,220.5]],"EM260601":[[300.5,2825,73.5]],"EM260602":[[120.5,3388,37.8]],"EM260603":[[120.5,472,5.4]],"EM260604":[[150.5,4845,68]],"EM260605":[[150.5,482,6.8]],"EM260606":[[300.5,2365,73]],"EM260607":[[150.5,13925,207.1]],"EM260608":[[200.5,9605,196]],"EM260609":[[0,0,0.5]],"EM260610":[[0,0,0.4]],"EM260611":[[0,0,0.5]],"EM260612":[[0,0,0.7]],"EM260613":[[0,0,0.3]],"EM260614":[[0,0,0.2]],"EM260615":[[0,0,0.2]],"EM260616":[[0,0,0.1]],"EM260617":[[0,0,0.2]],"EM260618":[[0,0,0.2]],"EM260619":[[284,1201,18.7]],"EM260620":[[100.5,2005,279],[50,2005,139.5]],"EM260621":[[50,30,2]],"EM260622":[[140.5,7204,390],[70,7204,195]],"EM260623":[[140.5,2405,461],[70,2405,320.5]],"EM260624":[[70,34,3.4]],"EM260625":[[140.5,2405,461],[70,2405,230.5]],"EM260626":[[200.5,3005,520],[100,3005,260]],"EM260627":[[100,68,4]],"EM260628":[[140.5,6004,378],[70,6004,189]],"EM260629":[[70,16,1]],"EM260630":[[140.5,6004,378],[70,6004,189]],"EM260631":[[300.5,6004,479.6],[150,6004,239.8]],"EM260632":[[150,54,2.6]],"EM260633":[[100,3001,52.5]],"EM260634":[[100,1101,53]],"EM260635":[[400,1001,26.4]],"EM260636":[[100,401,54.3]],"EM260637":[[750,1201,21.7],[600,1201,17.3],[150,1201,4.4]],"EM260638":[[599,1201,18.4]],"EM260676":[[250,1201,19.4]],"EM260677":[[250,1201,19.4],[125,1201,9.7]],"EM260678":[[196,1201,17.3]],"EM260679":[[250,1201,18.8],[125,1201,9.4]],"EM260680":[[300.5,8004,507],[150,8004,507]],"EM260681":[[150,54,3.5]],"EM260682":[[320,1201,20.4],[210,1201,13.4],[110,1201,7]],"EM260683":[[266,1201,21.2],[133,1201,10.6]],"EM260684":[[63,2789,74]],"EM260685":[[64,3048,76]],"EM260798":[[100.5,7205,50.4]],"EM260799":[[300.5,3605,76.5]],"EM260800":[[200.5,2825,49]],"EM260801":[[280.5,5005,123.9],[140,5005,62]],"EM260802":[[200.5,2405,48.4]],"EM260803":[[300.5,2365,73]],"EM260804":[[140.5,6004,378],[70,6004,189]],"EM260805":[[300.5,2305,366],[150,2305,183]],"EM260806":[[70,16,1]],"EM260807":[[300.5,8004,1037.3],[150,8004,518.6]],"EM260808":[[150,54,3.5]],"EM260809":[[205.5,900,130.5]],"EM260810":[[0,0,972]],"EM260811":[[0,0,341.4]],"EM260812":[[200.5,1992,404]],"EM260813":[[200.5,1592,323]],"EM260814":[[200.5,1338,271.3]],"EM260823":[[200.5,1974,400.3]],"EM260815":[[120.5,3005,316.5],[60,3005,158]],"EM260816":[[140.5,7204,390],[70,7204,195]],"EM260817":[[300.5,8004,1037.3],[150,8004,518.6]],"EM260818":[[120.5,3005,300],[60,3005,150]],"EM260819":[[200.5,1568,386.2]],"EM260820":[[300.5,6004,460],[150,6004,230]],"EM260821":[[300.5,8004,511],[150,8004,511]],"EM260822":[[100,641,75]],"EM260824":[[370.5,4156,80.2]],"EM260825":[[75.5,9605,73]],"EM260826":[[100.5,7205,50.4]],"EM260827":[[200.5,2405,48.4]],"EM260828":[[300.5,2365,73]],"EM260829":[[100,36,3]],"EM260830":[[196,1201,17.3]],"EM260831":[[0,0,4.6]],"EM260832":[[0,0,1058]],"EM260833":[[0,0,1.6]],"EM260834":[[0,0,95]],"EM260835":[[0,0,168]],"EM260836":[[0,0,196]],"EM260837":[[0,0,224]],"EM260838":[[0,0,0.8]],"EM260839":[[0,0,0.8]],"EM260840":[[320,1201,20.4],[210,1201,13.4],[110,1201,7]],"EM260841":[[266,1201,21.2],[133,1201,10.6]],"EM260842":[[200,1201,18.4]],"EM260843":[[400,1201,23.4]],"EM260844":[[100,1201,37.1]],"EM260845":[[150,1201,22.7]],"EM260846":[[66,1201,52.6]],"EM260847":[[100,1201,37.1]],"EM260848":[[250,1201,19.4]],"EM260849":[[326,1201,20.2]],"EM260850":[[250,1201,18.8],[125,1201,9.4]],"EM260661":[[4,678,0.4],[400,1390,75.4]],"EM260662":[[5,678,0.5],[400,1390,75.4]],"EM260663":[[3,508,0.3],[400,1560,111.2]],"EM260664":[[2,339,0.3],[400,710,75]],"EM260665":[[3,508,0.5]],"EM260666":[[2,339,0.4]],"EM260667":[[4,1017,1.5]],"EM260668":[[7,678,2.2]],"EM260669":[[10,678,2.9]],"EM260670":[[6,508,1.9]],"EM260671":[[8,508,2.4]],"EM260672":[[9,508,2.7]],"EM260673":[[2,405,0.9]],"EM260674":[[8,405,2.4]],"EM260675":[[2,678,0.8]],"EM260686":[[3,678,0.4],[400,1390,75.4]],"EM260687":[[4,678,0.4],[400,1390,75.4]],"EM260688":[[3,508,0.3],[400,1560,111.2]],"EM260689":[[4,508,0.4],[400,1560,111.2]],"EM260690":[[5,508,0.5],[400,1560,111.2]],"EM260691":[[5,1017,1.6]],"EM260692":[[9,848,2.7]],"EM260693":[[4,678,1.4]],"EM260694":[[6,678,2]],"EM260695":[[3,508,1.1]],"EM260696":[[4,508,1.3]],"EM260697":[[7,508,2.1]],"EM260698":[[6,339,1.9],[400,1050,315]],"EM260699":[[9,848,2.7]],"EM260700":[[5,678,1.6]],"EM260701":[[8,508,2.4]],"EM260702":[[3,678,0.4],[400,1390,75.4]],"EM260703":[[4,678,0.4],[400,1390,75.4]],"EM260704":[[3,508,0.3],[400,1560,111.2]],"EM260705":[[4,508,0.4],[400,1560,111.2]],"EM260706":[[2,339,0.4]],"EM260707":[[5,1017,1.6]],"EM260708":[[6,848,1.9]],"EM260709":[[4,678,1.4]],"EM260710":[[8,678,2.4]],"EM260711":[[3,508,1.1]],"EM260712":[[4,508,1.3]],"EM260713":[[5,339,1.6]],"EM260714":[[5,678,1.6]],"EM260715":[[3,678,0.4],[400,1390,75.4]],"EM260716":[[4,678,0.4],[400,1390,75.4]],"EM260717":[[5,678,0.5],[400,1390,75.4]],"EM260718":[[3,508,0.3],[400,1560,111.2]],"EM260719":[[5,508,0.5],[400,1560,111.2]],"EM260720":[[2,339,0.3],[400,710,75]],"EM260721":[[3,508,0.5]],"EM260722":[[7,1017,2.2]],"EM260723":[[5,848,1.7]],"EM260724":[[2,678,0.8]],"EM260725":[[3,678,1.2]],"EM260726":[[3,508,1.1]],"EM260727":[[7,405,2.1]],"EM260728":[[1,339,0.5]],"EM260729":[[4,339,1.3]],"EM260730":[[9,339,2.6]],"EM260731":[[7,848,2.32]],"EM260732":[[3,508,1.1]],"EM260733":[[4,508,1.1]],"EM260734":[[5,508,1.3]],"EM260735":[[6,508,1.4]],"EM260736":[[7,508,1.6]],"EM260737":[[3,508,0.5]],"EM260738":[[4,508,0.7]],"EM260739":[[6,508,0.9]],"EM260740":[[4,678,0.4],[400,1390,75.4]],"EM260741":[[5,1017,1.6]],"EM260742":[[7,848,2.2]],"EM260743":[[8,848,2.5]],"EM260744":[[4,678,1.4]],"EM260745":[[5,678,1.6]],"EM260746":[[6,678,2]],"EM260747":[[3,508,1.1]],"EM260748":[[4,508,1.3]],"EM260749":[[3,405,1]],"EM260750":[[5,405,1.6]],"EM260751":[[5,339,1.6]],"EM260752":[[10,339,2.9]],"EM260753":[[6,1017,2]],"EM260754":[[6,678,0.6],[400,1390,75.4]],"EM260755":[[4,508,0.4],[400,1560,111.2]],"EM260756":[[6,1017,2]],"EM260757":[[4,848,1.4]],"EM260758":[[5,848,1.7]],"EM260759":[[2,678,0.8]],"EM260760":[[3,678,1.2]],"EM260761":[[4,508,1.3]],"EM260762":[[5,1017,1.6]],"EM260763":[[8,1017,2.5]],"EM260764":[[9,1017,2.8]],"EM260765":[[10,1017,3.1]],"EM260766":[[3,848,1.1]],"EM260767":[[4,848,1.4]],"EM260768":[[8,848,2.5]],"EM260769":[[10,848,2.9]],"EM260770":[[4,678,1.4]],"EM260771":[[5,678,1.6]],"EM260772":[[8,678,2.4]],"EM260773":[[10,678,2.9]],"EM260774":[[5,508,1.6]],"EM260775":[[6,508,1.9]],"EM260776":[[9,508,2.7]],"EM260777":[[10,508,2.9]],"EM260778":[[5,678,0.5],[400,1390,75.4]],"EM260779":[[6,1017,2]],"EM260780":[[7,1017,2.2]],"EM260781":[[10,1017,3.1]],"EM260782":[[5,848,1.7]],"EM260783":[[8,848,2.5]],"EM260784":[[9,848,2.7]],"EM260785":[[3,678,1.2]],"EM260786":[[6,678,2]],"EM260787":[[2,565,0.8]],"EM260788":[[3,565,1.1]],"EM260789":[[4,565,1.3]],"EM260790":[[5,565,1.6]],"EM260791":[[6,565,1.9]],"EM260792":[[10,565,2.9]],"EM260793":[[11,565,3.1]],"EM260794":[[3,508,1.1]],"EM260795":[[4,405,1.3]],"EM260796":[[6,405,1.9]],"EM260797":[[3,339,1.1]],"EM260851":[[200.5,8465,193.2]],"EM260852":[[300.5,5645,201.6]],"EM260853":[[450.5,4645,314.4]],"EM260854":[[450,12,0.02]],"EM260855":[[533,1201,23.4],[400,1201,17.7],[133,1201,5.7]],"EM260856":[[400,1201,23.4]],"EM260857":[[250,1201,19.4],[125,1201,9.7]],"EM260858":[[150.5,4005,282],[75,4005,141]],"EM260859":[[147.5,6005,225]],"EM260860":[[190.5,2780,315.5]],"EM260861":[[190.5,12,6]],"EM260862":[[80,481,54]],"EM260863":[[80,421,63.5]],"EM260864":[[60,501,52.5]],"EM260865":[[100,1201,20.6]],"EM260866":[[100,1201,23.4]],"EM260867":[[100,1201,26.5]],"EM260639":[[55.5,1675,222]],"EM260640":[[38.5,2421,221]],"EM260641":[[61.5,1845,278]],"EM260642":[[42.5,2707,278]],"EM260643":[[64.5,1957,300]],"EM260644":[[44.5,2807,304]],"EM260645":[[67.5,2011,331]],"EM260646":[[46.5,2901,325]],"EM260647":[[70.5,2137,358]],"EM260648":[[48.5,3091,364]],"EM260649":[[74.5,1855,330]],"EM260650":[[49.5,2679,324]],"EM260651":[[78.5,1985,370]],"EM260652":[[54.5,2899,366]],"EM260653":[[85.5,2123,421],[43,2123,211.7],[42,2123,209.3]],"EM260654":[[58.5,3075,413]],"EM260655":[[90.5,1811,397],[45,1811,198.5]],"EM260656":[[63.5,2595,393]],"EM260657":[[97.5,1953,452],[49,1953,227],[48,1953,225]],"EM260658":[[66.5,2821,452]],"EM260659":[[109.5,1631,425],[55,1631,213],[54,1631,212]],"EM260660":[[74.5,2385,430]],"EM260868":[[300.5,2305,366],[150,2305,183]],"EM260869":[[140.5,6004,378],[70,6004,189]],"EM260870":[[0,0,9]],"EM260871":[[300.5,4645,190]],"EM260872":[[450.5,4645,314.4]],"EM260873":[[600.5,5005,128],[400,5005,85.3],[200,5005,42.7]],"EM260874":[[600.5,5005,170.3],[400,5005,113.5],[200,5005,56.8]],"EM260875":[[600.5,6155,229.5],[300,6155,229.5]],"EM260876":[[150.5,7205,76.5]],"EM260877":[[200.5,2405,48.4]],"EM260878":[[300.5,482,13.5]],"EM260879":[[190.5,2800,317.7]],"EM260880":[[150.5,4005,282],[75,4005,141]],"EM260881":[[100.5,3605,220],[50,3605,107.4]],"EM260882":[[400,1001,26.4]],"EM260883":[[133,1201,27.6]],"EM260884":[[100,641,75]],"EM260885":[[300.5,8004,1037.3],[150,8004,518.7]],"EM260886":[[300.5,2825,147]],"EM260887":[[1290,605,30.7],[430,605,10.3]],"EM260888":[[200.5,2928,198.8]],"EM260889":[[200.5,2448,296.4]],"EM260890":[[200.5,2316,328]],"EM260891":[[200.5,1948,332.8]],"EM260892":[[200.5,1920,327]],"EM260893":[[1968,0,328.8]],"EM260894":[[200.5,40,3]],"EM260895":[[450,72016760,125]],"EM260896":[[100,641,75]],"EM260897":[[100,801,75]],"EM260898":[[150,1201,22.7]],"EM230265":[[320,1201,19]],"EM260899":[[22.5,0,0]],"EM260900":[[22.5,0,0]],"EM260901":[[204,601,58.6]],"EM260902":[[600.5,5005,170.3],[200,5005,56.8]],"EM260903":[[300.5,4105,81]],"EM260904":[[100.5,7205,50.4]],"EM260905":[[400.5,5005,145.9],[200,5005,73]],"EM260906":[[100.5,4805,46.8]],"EM260907":[[150,1201,26.9]],"EM260908":[[284,1201,18.7]],"EM260909":[[300.5,5645,201.6]],"EM260910":[[200.5,7205,207.4]],"EM260911":[[183.5,750,0]],"EM260912":[[200.5,2244,330]],"EM260913":[[200.5,3214,404]],"EM260914":[[200.5,1948,338.2]],"EM260915":[[200.5,6,1]],"EM260916":[[200.5,2005,300],[100,2005,150]],"EM260917":[[201.5,2005,338],[100,2005,169],[101,2005,169]],"EM260918":[[100.5,2005,279],[50,2005,139.5]],"EM260919":[[140.5,6004,378],[70,6004,189]],"EM260920":[[200.5,3605,74]],"EM260921":[[160,1201,22.1],[80,1201,11.1]],"EM260922":[[400,1201,30.2]],"EM260923":[[320,1201,29],[210,1201,19],[110,1201,10]],"EM260924":[[266,1201,25.6],[133,1201,12.8]],"EM260925":[[214,1201,22.5]],"EM260926":[[200,1201,23.5]],"EM260927":[[133,1201,21.9]],"EM260928":[[133,1201,17.3]]};

function tachSoMatVaChieuDaiQCBTP(qcV) {
  let matVal = 0;
  let daiVal = 0;
  if (!qcV) return { mat: 0, dai: 0 };

  let partsQC = String(qcV).trim().split(/\s+[xX]\s+/);
  if (partsQC.length < 3) {
    partsQC = String(qcV).trim().split(/\s*[xX]\s*/);
  }

  if (partsQC.length >= 3) {
    const valStr = partsQC[2].replace(/[^0-9.]/g, "");
    matVal = parseFloat(valStr) || 0;
  } else {
    const nums = String(qcV).match(/\d+/g);
    if (nums && nums.length >= 2) {
      matVal = parseFloat(nums[nums.length - 2]) || 0;
    }
  }

  if (partsQC.length >= 4) {
    const daiStr = partsQC[3].replace(/[^0-9.]/g, "");
    daiVal = parseFloat(daiStr) || 0;
  }

  return { mat: matVal, dai: daiVal };
}

function themDongVaoMapQCBTP(targetMap, maEM, matVal, daiVal, kgAA, qcV = "") {
  maEM = String(maEM || "").trim().toUpperCase();
  if (!maEM) return;
  matVal = parseFloat(matVal) || 0;
  daiVal = parseFloat(daiVal) || 0;
  kgAA = parseFloat(kgAA) || 0;

  if (!targetMap[maEM]) {
    targetMap[maEM] = {
      maEM: maEM,
      qcV: qcV,
      kgAA: kgAA,
      matMax: matVal,
      rows: [],
      nguyenTamByDai: {},
      rowByMat: {}
    };
  }

  const rowItem = {
    maEM: maEM,
    qcV: qcV,
    kgAA: kgAA,
    mat: matVal,
    dai: daiVal
  };
  targetMap[maEM].rows.push(rowItem);

  if (matVal > 0 && !targetMap[maEM].rowByMat[matVal]) {
    targetMap[maEM].rowByMat[matVal] = rowItem;
  }

  const keyDai = String(daiVal);
  if (!targetMap[maEM].nguyenTamByDai[keyDai]) {
    targetMap[maEM].nguyenTamByDai[keyDai] = rowItem;
  } else {
    const currentMax = targetMap[maEM].nguyenTamByDai[keyDai];
    if (matVal > currentMax.mat) {
      targetMap[maEM].nguyenTamByDai[keyDai] = rowItem;
    } else if (matVal === currentMax.mat && kgAA > 0 && currentMax.kgAA === 0) {
      targetMap[maEM].nguyenTamByDai[keyDai] = rowItem;
    }
  }

  if (matVal > targetMap[maEM].matMax) {
    targetMap[maEM].matMax = matVal;
    if (qcV) targetMap[maEM].qcV = qcV;
    if (kgAA > 0) targetMap[maEM].kgAA = kgAA;
  } else if (matVal === targetMap[maEM].matMax && kgAA > 0 && targetMap[maEM].kgAA === 0) {
    targetMap[maEM].kgAA = kgAA;
  }
}

function napDuLieuQCBTPLocal(forceRebuild = false) {
  if (daNapLocalQCBTP && !forceRebuild && Object.keys(mapQCBTP).length > 0) return;
  const newMap = {};

  // 1. Nạp từ bộ dữ liệu gốc tích hợp sẵn (0ms)
  if (BTP_QC_DEFAULT_SEED && typeof BTP_QC_DEFAULT_SEED === "object") {
    for (const em in BTP_QC_DEFAULT_SEED) {
      const rows = BTP_QC_DEFAULT_SEED[em];
      if (Array.isArray(rows)) {
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          if (Array.isArray(r)) {
            themDongVaoMapQCBTP(newMap, em, r[0], r[1], r[2], "");
          }
        }
      }
    }
  }

  // 2. Nạp đè/bổ sung từ localStorage nếu có bản cập nhật mới từ Sheet QC
  try {
    const rawCache = localStorage.getItem(BTP_QC_CACHE_KEY);
    if (rawCache) {
      const cachedList = JSON.parse(rawCache);
      if (Array.isArray(cachedList) && cachedList.length > 0) {
        // Xóa các mã EM có trong bản cập nhật mới để nạp lại chuẩn nhất
        const updatedEMs = new Set();
        cachedList.forEach(item => {
          const em = String(item.maEM || item[0] || "").trim().toUpperCase();
          if (em) updatedEMs.add(em);
        });
        updatedEMs.forEach(em => { delete newMap[em]; });

        cachedList.forEach(item => {
          if (Array.isArray(item)) {
            themDongVaoMapQCBTP(newMap, item[0], item[1], item[2], item[3], "");
          } else if (item && item.maEM) {
            let mat = item.mat;
            let dai = item.dai;
            if ((mat === undefined || dai === undefined) && item.qcV) {
              const tach = tachSoMatVaChieuDaiQCBTP(item.qcV);
              mat = tach.mat;
              dai = tach.dai;
            }
            themDongVaoMapQCBTP(newMap, item.maEM, mat, dai, item.kgAA, item.qcV || "");
          }
        });
      }
    }
  } catch (e) { }

  mapQCBTP = newMap;
  daNapLocalQCBTP = true;
}

async function taiDanhSachQCBTP(forceRefresh = false) {
  napDuLieuQCBTPLocal();
  if (dangTaiQCBTP) return;
  dangTaiQCBTP = true;
  try {
    const URL_API = "https://script.google.com/macros/s/AKfycbxjnWLrJXZk1MJN4bSXdf72Wly7Of1Rc7iRtUNpcKk3iZDkxk-N1W7mE965tNMyhA9z1Q/exec";
    const res = await fetch(URL_API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "layDanhSachQCBTP" })
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (e) { }
    if (json && json.success && Array.isArray(json.list) && json.list.length > 0) {
      const compactList = json.list.map(it => {
        let mat = it.mat;
        let dai = it.dai;
        if ((mat === undefined || dai === undefined) && it.qcV) {
          const tach = tachSoMatVaChieuDaiQCBTP(it.qcV);
          mat = tach.mat;
          dai = tach.dai;
        }
        return [
          String(it.maEM || "").trim().toUpperCase(),
          parseFloat(mat) || 0,
          parseFloat(dai) || 0,
          parseFloat(it.kgAA) || 0
        ];
      }).filter(r => r[0]);

      if (compactList.length > 0) {
        try {
          localStorage.setItem(BTP_QC_CACHE_KEY, JSON.stringify(compactList));
        } catch (eStorage) { }
        napDuLieuQCBTPLocal(true);

        // Nếu đang mở màn hình kết quả BTP thì cập nhật lại số KG ngay
        const kqEl = document.getElementById("btp-ketqua");
        if (kqEl && kqEl.style.display !== "none") {
          thucHienLocKetQuaBTP();
        }
      }
    }
  } catch (e) { } finally {
    dangTaiQCBTP = false;
  }
}
window.taiDanhSachQCBTP = taiDanhSachQCBTP;

function timInfoQCBTP(maEM, soKeo) {
  if (!daNapLocalQCBTP || Object.keys(mapQCBTP).length === 0) {
    napDuLieuQCBTPLocal();
  }
  const key = String(maEM || "").trim().toUpperCase();
  const qcEntry = mapQCBTP[key];
  if (!qcEntry) return null;

  const targetSoKeo = parseFloat(soKeo) || 0;

  // 1. Kiểm tra xem soKeo tương ứng với dòng nào trong QC để tìm ra CHIỀU DÀI (sau chữ "x" thứ 3)
  let matchedRow = null;
  if (targetSoKeo > 0 && qcEntry.rowByMat && qcEntry.rowByMat[targetSoKeo]) {
    matchedRow = qcEntry.rowByMat[targetSoKeo];
  } else if (targetSoKeo > 0 && qcEntry.rows) {
    for (let r = 0; r < qcEntry.rows.length; r++) {
      if (qcEntry.rows[r].mat === targetSoKeo) {
        matchedRow = qcEntry.rows[r];
        break;
      }
    }
  }

  // 2. Nếu tìm được dòng tương ứng với soKeo: lấy TẤM NGUYÊN có CÙNG CHIỀU DÀI
  if (matchedRow) {
    const keyDai = String(matchedRow.dai);
    if (qcEntry.nguyenTamByDai && qcEntry.nguyenTamByDai[keyDai]) {
      return qcEntry.nguyenTamByDai[keyDai];
    }
  }

  // 3. Nếu soKeo là kiện lẻ không có trong QC: tìm tấm nguyên có mat >= soKeo nhỏ nhất
  if (targetSoKeo > 0 && qcEntry.rows && qcEntry.rows.length > 0) {
    let bestMatch = null;
    for (let r = 0; r < qcEntry.rows.length; r++) {
      const item = qcEntry.rows[r];
      if (item.mat >= targetSoKeo) {
        if (!bestMatch || item.mat < bestMatch.mat) {
          bestMatch = item;
        }
      }
    }
    if (bestMatch) {
      const keyDaiBest = String(bestMatch.dai);
      if (qcEntry.nguyenTamByDai && qcEntry.nguyenTamByDai[keyDaiBest]) {
        return qcEntry.nguyenTamByDai[keyDaiBest];
      }
      return bestMatch;
    }
  }

  // 4. Fallback: trả về dòng mặc định / lớn nhất của mã EM
  return {
    maEM: qcEntry.maEM,
    qcV: qcEntry.qcV,
    kgAA: qcEntry.kgAA,
    mat: qcEntry.matMax
  };
}

function tinhKgHangGomBTP(maEM, soMat, soLuong) {
  const sl = parseFloat(soLuong) || 0;
  const soKeo = parseFloat(soMat) || 0;
  if (!maEM || sl <= 0 || soKeo <= 0) return 0;

  let cleanEM = String(maEM).trim().toUpperCase();
  if (!daNapLocalQCBTP || Object.keys(mapQCBTP).length === 0) {
    napDuLieuQCBTPLocal();
  }
  if (!mapQCBTP[cleanEM]) {
    const matchEM = cleanEM.match(/EM\d{6}/i) || cleanEM.match(/EM\d+/i);
    if (matchEM) cleanEM = matchEM[0].toUpperCase();
  }

  const infoQC = timInfoQCBTP(cleanEM, soKeo);
  if (!infoQC || !infoQC.kgAA || infoQC.kgAA <= 0) return 0;

  const kgAA = parseFloat(infoQC.kgAA) || 0;
  const matTam = parseFloat(infoQC.mat) || 960;
  const isNguyenTam = (soKeo >= matTam && matTam > 0) || (soKeo === 960);

  if (isNguyenTam) {
    return Math.round((sl * kgAA) * 10) / 10;
  } else {
    const ratioTam = matTam > 0 ? ((sl * soKeo) / matTam) : 0;
    return Math.round((ratioTam * kgAA) * 10) / 10;
  }
}
window.tinhKgHangGomBTP = tinhKgHangGomBTP;

// ── Xây dựng bảng kết quả BTP (Accordion Đợt & Tổng hợp gom loại) ──
function taoHangKetQuaBTP(danhSach, tuKhoa = "", isReadonly = false) {
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
      const prefix = isReadonly ? 'btp-ls-grp-' : 'btp-kq-grp-';
      const safeId = prefix + keyB64.replace(/[^a-zA-Z0-9]/g, '');
      const isOpen = window.expandedKQBTP.has(g.key);

      const kgText = (g.kg !== undefined && g.kg !== null && Number(g.kg) > 0) ? anToanHtmlBTP(g.kg) : '—';

      let subItemsHtml = g.items.map((it, subIdx) => {
        const subGio = it.thoiGian ? new Date(it.thoiGian).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
        const subKg = (it.kg !== undefined && it.kg !== null && Number(it.kg) > 0) ? anToanHtmlBTP(it.kg) : (Number(g.kg) > 0 ? anToanHtmlBTP(g.kg) : '0');
        const safeSubMsp = anToanHtmlBTP(it.rawQR || it.msp || g.msp);
        const safeUid = anToanHtmlBTP(it.uid || ("idx_" + subIdx));

        return `<div class="kq-sub-item">
          <span class="kq-sub-stt">${subIdx + 1}</span>
          <span class="kq-sub-name" title="${safeSubMsp}">${safeSubMsp}</span>
          <span class="kq-sub-time">${subGio}</span>
          ${isReadonly ? '' : `<button type="button" class="kq-sub-del-btn" onclick="xoaMaBTP('${safeUid}', event)" title="Xóa mã này">
            <i class="ti ti-trash"></i>
          </button>`}
        </div>`;
      }).join("");

      return `
      <div class="kq-swipe-container">
        <div class="kq-swipe-row-wrap">
          ${isReadonly ? '' : `<div class="kq-swipe-actions">
            <button type="button" class="kq-swipe-btn-del" onclick="xoaNhomBTPByB64('${keyB64}', event)">
              <i class="ti ti-trash"></i>
              <span>Xóa</span>
            </button>
          </div>`}
          <div class="kq-swipe-content" onclick="toggleChiTietKQBTPByB64('${keyB64}', event)">
            <span class="kq-col-dot">Đợt ${g.dot}</span>
            <div class="kq-col-name">
              <span>${safeMsp}</span>

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

  // Render HTML Bảng Tổng Hợp BTP (theo Đơn + Loại + SL + KG)
  let hangGom = "";
  let tongKgGom = 0;
  const danhSachGom = Object.values(tongGomLoaiMa).map(item => {
    const soKg = tinhKgHangGomBTP(item.msp, item.soMat, item.soLuong);
    return {
      ...item,
      soKg: soKg
    };
  }).sort((a, b) => {
    const cmpMsp = String(a.msp || "").localeCompare(String(b.msp || ""), undefined, { numeric: true, sensitivity: 'base' });
    if (cmpMsp !== 0) return cmpMsp;
    return (parseFloat(b.soMat) || 0) - (parseFloat(a.soMat) || 0);
  });

  const filteredGom = danhSachGom.filter(item => {
    if (!tuKhoa) return true;
    const mspStr = String(item.msp || "").toLowerCase();
    const soMatStr = String(item.soMat || "").toLowerCase();
    const soKgStr = item.soKg > 0 ? item.soKg.toFixed(1) : "0";
    return mspStr.includes(tuKhoa) || soMatStr.includes(tuKhoa) || soKgStr.includes(tuKhoa);
  });

  filteredGom.forEach(item => {
    tongKgGom += (Number(item.soKg) || 0);
  });
  tongKgGom = Math.round(tongKgGom * 10) / 10;

  if (filteredGom.length === 0) {
    hangGom = '<div style="text-align:center; padding:24px; color:var(--text-lighter); font-size:13px;">Chưa có dữ liệu</div>';
  } else {
    hangGom = filteredGom.map(item => {
      const kgHienThi = item.soKg > 0 ? item.soKg.toFixed(1) : "0";
      return `
      <div class="kq-gom-row">
        <div style="flex:1.4; font-weight:700; font-family:'IBM Plex Mono', monospace; color:var(--row-text);">${anToanHtmlBTP(item.msp)}</div>
        <div style="flex:0.8; text-align:center; font-weight:700; color:var(--row-muted);">${anToanHtmlBTP(item.soMat)}</div>
        <div style="flex:0.8; text-align:right; font-weight:700; font-family:'IBM Plex Mono', monospace; color:var(--row-text);">${item.soLuong}</div>
        <div style="flex:1; text-align:right; font-weight:800; font-family:'IBM Plex Mono', monospace; color:var(--success);">${kgHienThi}</div>
      </div>`;
    }).join("");
  }

  const tongSlGom = filteredGom.reduce((sum, it) => sum + (Number(it.soLuong) || 0), 0);
  const tongKgFootText = tongKgGom > 0 ? tongKgGom.toFixed(1) : "0";
  let footGom = `
    <div style="flex:1.4; font-weight:700; color:var(--row-text);">TỔNG</div>
    <div style="flex:0.8;">&nbsp;</div>
    <div style="flex:0.8; text-align:right; font-weight:800; font-family:'IBM Plex Mono', monospace; color:var(--row-text);">${tuKhoa ? tongSlGom : tongQRAll}</div>
    <div style="flex:1; text-align:right; font-weight:800; font-family:'IBM Plex Mono', monospace; color:var(--success);">${tongKgFootText}</div>`;

  return { hangDot, footDot, hangGom, footGom, tongSoDot, tongQRAll, tongKgGom };
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

  napDuLieuQCBTPLocal();
  taiDanhSachQCBTP();
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

  const { hangDot, footDot, hangGom, footGom, tongSoDot, tongQRAll } = taoHangKetQuaBTP(session.phienBTP || [], "", true);
  const elDot = document.getElementById("lichsu-btp-tbody-dot");
  const elFootDot = document.getElementById("lichsu-btp-tfoot-dot");
  const elGom = document.getElementById("lichsu-btp-tbody-gom");
  const elFootGom = document.getElementById("lichsu-btp-tfoot-gom");

  if (elDot) elDot.innerHTML = hangDot;
  if (elFootDot) elFootDot.innerHTML = footDot;
  if (elGom) elGom.innerHTML = hangGom;
  if (elFootGom) elFootGom.innerHTML = footGom;

  const elTongDot = document.getElementById("ls-btp-tong-dot");
  const elTongMa = document.getElementById("ls-btp-tong-ma");
  if (elTongDot) elTongDot.textContent = (tongSoDot || 0).toLocaleString("vi-VN");
  if (elTongMa) elTongMa.textContent = (tongQRAll || 0).toLocaleString("vi-VN");

  if (typeof toggleLichSuBTPView === "function") toggleLichSuBTPView("chitiet");

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
  napDuLieuQCBTPLocal();
  taiDanhSachQCBTP();
});

// ── Tự động đồng bộ hàng chờ khi có mạng lại ──
async function tuDongDongBoPendingBTP() {
  taiDanhSachQCBTP();
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
