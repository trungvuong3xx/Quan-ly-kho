// ── Web App Core v20260809-ultra ──────────────────────────
const API = "https://script.google.com/macros/s/AKfycbzXjzccld3X04iJgIpEvKm01in0QT0i7tkjar_oJ6K5-sBGdm9xibe7Mu4UB3mWtha5-w/exec";

async function callAPI(body) {
  try {
    const res = await fetch(API, { method: "POST", body: JSON.stringify(body), redirect: "follow" });
    return await res.json();
  } catch (err) {
    return { error: "Mất kết nối mạng, vui lòng thử lại." };
  }
}

let infoMSP = null;
let zxingReader = null;
let dangXuLy = false;
let ngayChon = null;
let loaiChon = null;
let qrDangQuet = null;
let quetNhanh = false; // toggle quét nhanh

function formatKg(value) {
  const num = Number(value || 0);
  if (!Number.isInteger(num)) return String(Number(num.toFixed(3)));
  return String(num);
}

// ── Hàm tiện ích Xuất File Excel dùng chung ─────────
function exportToExcel(filename, sheetName, dataArray) {
  if (typeof XLSX === "undefined") {
    alert("Thư viện xuất Excel chưa tải xong. Vui lòng thử lại sau vài giây!");
    return;
  }
  if (!dataArray || dataArray.length === 0) {
    alert("Không có dữ liệu để xuất file Excel!");
    return;
  }
  try {
    const ws = XLSX.utils.json_to_sheet(dataArray);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || "Báo Cáo");
    XLSX.writeFile(wb, (filename || "BaoCaoKho") + ".xlsx");
  } catch (e) {
    alert("Lỗi khi xuất file Excel: " + e.message);
  }
}
window.exportToExcel = exportToExcel;

// ── Bộ Máy Âm Thanh Fast.mp3 Quét Mã QR Trung Tâm ─────────────────
const FAST_MP3_BASE64 = "data:audio/mp3;base64,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";

let fastAudioCtx = null;
let fastAudioBuffer = null;
let fastBeepAudio = null;

function unlockFastAudioEngine() {
  try {
    if (!fastAudioCtx) {
      fastAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (fastAudioCtx.state === "suspended") {
      fastAudioCtx.resume();
    }
    if (!fastAudioBuffer && FAST_MP3_BASE64) {
      const base64Str = FAST_MP3_BASE64.split(",")[1];
      const binaryStr = window.atob(base64Str);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      fastAudioCtx.decodeAudioData(bytes.buffer, (buffer) => {
        fastAudioBuffer = buffer;
      }, (err) => { });
    }
    if (!fastBeepAudio) {
      fastBeepAudio = new Audio(FAST_MP3_BASE64);
      fastBeepAudio.load();
    }
  } catch (e) { }
}

window.addEventListener("touchstart", unlockFastAudioEngine, { passive: true, capture: true });
window.addEventListener("click", unlockFastAudioEngine, { passive: true, capture: true });
window.addEventListener("pointerdown", unlockFastAudioEngine, { passive: true, capture: true });
window.addEventListener("keydown", unlockFastAudioEngine, { passive: true, capture: true });

function phatTiengBip() {
  if (navigator.vibrate) {
    try { navigator.vibrate(70); } catch (e) { }
  }

  // 1. Phát qua Web Audio API Buffer (Siêu nhanh 0ms, không bị chặn trên di động)
  try {
    if (!fastAudioCtx) {
      fastAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (fastAudioCtx.state === "suspended") {
      fastAudioCtx.resume();
    }
    if (fastAudioBuffer) {
      const source = fastAudioCtx.createBufferSource();
      source.buffer = fastAudioBuffer;
      source.connect(fastAudioCtx.destination);
      source.start(0);
      return;
    }
  } catch (e) { }

  // 2. Thử phát qua HTML5 Audio Element (dự phòng)
  try {
    if (!fastBeepAudio) {
      fastBeepAudio = new Audio(FAST_MP3_BASE64);
    }
    fastBeepAudio.currentTime = 0;
    const playPromise = fastBeepAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => {
        try {
          if (fastAudioCtx) phatAmThanhSung(fastAudioCtx);
        } catch (e2) { }
      });
    }
  } catch (e) {
    try {
      if (fastAudioCtx) phatAmThanhSung(fastAudioCtx);
    } catch (e2) { }
  }
}
window.phatTiengBip = phatTiengBip;

function phatAmThanhSung(ctx) {
  try {
    const now = ctx.currentTime;
    const thoiLuong = 0.35;

    const soMau = Math.floor(ctx.sampleRate * thoiLuong);
    const bufferOn = ctx.createBuffer(1, soMau, ctx.sampleRate);
    const data = bufferOn.getChannelData(0);
    for (let i = 0; i < soMau; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = bufferOn;

    const locNoise = ctx.createBiquadFilter();
    locNoise.type = "lowpass";
    locNoise.frequency.setValueAtTime(6500, now);
    locNoise.frequency.exponentialRampToValueAtTime(180, now + thoiLuong);

    const gainNoise = ctx.createGain();
    gainNoise.gain.setValueAtTime(1.4, now);
    gainNoise.gain.exponentialRampToValueAtTime(0.001, now + thoiLuong);

    const thump = ctx.createOscillator();
    thump.type = "triangle";
    thump.frequency.setValueAtTime(120, now);
    thump.frequency.exponentialRampToValueAtTime(40, now + 0.15);

    const gainThump = ctx.createGain();
    gainThump.gain.setValueAtTime(1.2, now);
    gainThump.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    const compressor = ctx.createDynamicsCompressor();

    noise.connect(locNoise);
    locNoise.connect(gainNoise);
    gainNoise.connect(compressor);

    thump.connect(gainThump);
    gainThump.connect(compressor);

    compressor.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + thoiLuong);
    thump.start(now);
    thump.stop(now + 0.2);
  } catch (e) { }
}

function phatVibrateSuccess() {
  phatTiengBip();
}
window.phatVibrateSuccess = phatVibrateSuccess;

function phatVibrateError() {
  if (navigator.vibrate) {
    try { navigator.vibrate([100, 50, 100]); } catch (e) { }
  }
}
window.phatVibrateError = phatVibrateError;

function parseQRText(text) {
  if (!text) return null;
  if (text.includes("{|T")) {
    const tags = {};
    const parts = text.split("{|");
    for (const part of parts) {
      if (!part) continue;
      const match = part.match(/^([A-Z]\d)(.*)$/);
      if (match) tags[match[1]] = match[2].trim();
    }
    const id = tags["T9"] || tags["T2"] || tags["T3"] || "";
    const msp = tags["T3"] || "";
    const qc = tags["T6"] || "";
    const kg = parseFloat(tags["T4"] || "0") || 0;
    if (id && msp) return { id, msp, qc, kg };
  }
  const parts = text.split("|");
  if (parts.length >= 2) {
    const id = (parts[0] || "").trim();
    const msp = (parts[1] || "").trim();
    if (id && msp) return { id, msp, qc: "", kg: 0 };
  }
  const lines = text.split("\n").map(l => l.trim()).filter(l => l !== "");
  if (lines.length >= 2) {
    const id = lines[0] || "";
    const msp = lines[1] || "";
    const dongQCKG = lines.find(l => l.includes("-") && /\d+/.test(l)) || "";
    let kg = 0, qc = "";
    if (dongQCKG) {
      const matchKG = dongQCKG.match(/[\d.]+$/);
      kg = matchKG ? parseFloat(matchKG[0]) : 0;
      qc = dongQCKG;
      if (matchKG) qc = dongQCKG.substring(0, dongQCKG.lastIndexOf(matchKG[0])).trim();
      if (qc.endsWith("-")) qc = qc.slice(0, -1).trim();
    }
    if (id && msp) return { id, msp, qc, kg };
  }
  return null;
}
window.parseQRText = parseQRText;


function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function isNhap(loai) {
  return String(loai || "").startsWith("Nhập");
}

function chuyenTrang(id, el) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".bnav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  if (el) el.classList.add("active");
  if (id !== "quetQR") dungQuet();
  if (id !== "chiFor" && typeof dungCX1 === "function") dungCX1();
  if (id !== "btpPage") {
    document.body.classList.remove("cam-active");
    if (typeof dungBTP === "function") dungBTP();
  }
  if (id === "trangChu" && typeof capNhatTrangChu === "function") capNhatTrangChu();
}

// Điều hướng tới 1 tab từ nơi khác ngoài bottom-nav (nút tắt ở Trang chủ, banner tiếp tục...)
function diToiTab(id) {
  const btn = document.querySelector('.bnav-btn[data-page="' + id + '"]');
  if (btn) chuyenTrang(id, btn);
  else chuyenTrangKhongNav(id);
}
window.diToiTab = diToiTab;

// Điều hướng tới 1 trang KHÔNG có nút riêng trên bottom-nav (vd: Lịch sử, chi tiết lịch sử)
function chuyenTrangKhongNav(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  if (id !== "chiFor" && typeof dungCX1 === "function") dungCX1();
  if (id !== "btpPage") {
    document.body.classList.remove("cam-active");
    if (typeof dungBTP === "function") dungBTP();
  }
  const page = document.getElementById(id);
  if (page) page.classList.add("active");
}
window.chuyenTrangKhongNav = chuyenTrangKhongNav;

// ── Chặn nút Back, hỏi xác nhận trước khi thoát app ─────────
let isExitingApp = false;

function pushChanThoatState() {
  try {
    history.pushState({ chanThoat: true }, "", location.href);
  } catch (e) { }
}

// Khởi tạo trap state ban đầu
pushChanThoatState();

// Tự động đẩy lại trap state khi người dùng chạm vào màn hình (đáp ứng chính sách trình duyệt di động)
window.addEventListener("touchstart", pushChanThoatState, { once: true });
window.addEventListener("click", pushChanThoatState, { once: true });

function handlePopStateThoat(e) {
  if (isExitingApp) return;

  // 1. Nếu đang mở bàn phím ảo custom -> đóng bàn phím trước
  const openBp = document.querySelector(".cx5-bp-panel.show");
  if (openBp) {
    if (typeof dongBanPhimCX5 === "function") dongBanPhimCX5();
    setTimeout(pushChanThoatState, 10);
    return;
  }

  // 2. Nếu đang mở overlay / modal -> đóng overlay trước
  const openOverlay = document.querySelector(".overlay.show, .cx5-xoay-overlay.show");
  if (openOverlay) {
    openOverlay.classList.remove("show");
    if (typeof dongSuaLuotCX5 === "function") dongSuaLuotCX5();
    if (typeof dongDcChiTietCX5 === "function") dongDcChiTietCX5();
    if (typeof dongXoayCX5 === "function") dongXoayCX5();
    setTimeout(pushChanThoatState, 10);
    return;
  }

  const activePage = document.querySelector(".page.active");
  const activeId = activePage ? activePage.id : "trangChu";

  if (activeId !== "trangChu") {
    if (typeof diToiTab === "function") {
      diToiTab("trangChu");
    } else if (typeof chuyenTrangKhongNav === "function") {
      chuyenTrangKhongNav("trangChu");
    }
    setTimeout(pushChanThoatState, 10);
    return;
  }

  const el = document.getElementById("overlay-thoat");
  if (el) el.classList.add("show");
  setTimeout(pushChanThoatState, 10);
}

window.addEventListener("popstate", handlePopStateThoat);

function khongThoatApp() {
  const el = document.getElementById("overlay-thoat");
  if (el) el.classList.remove("show");
  pushChanThoatState();
}

function xacNhanThoatApp() {
  isExitingApp = true;
  window.removeEventListener("popstate", handlePopStateThoat);
  const el = document.getElementById("overlay-thoat");
  if (el) el.classList.remove("show");
  try {
    window.close();
  } catch (e) { }
  setTimeout(() => {
    history.back();
  }, 50);
}

window.khongThoatApp = khongThoatApp;
window.xacNhanThoatApp = xacNhanThoatApp;

function showLoading(show) {
  document.getElementById("overlay-loading").style.display = show ? "flex" : "none";
}

function capNhatNutQuetNhanh() {
  const btn = document.getElementById("toggle-quet-nhanh");
  if (quetNhanh) {
    btn.style.background = "var(--success)";
    btn.style.color = "var(--bg)";
    btn.textContent = "Quét nhanh: BẬT";
  } else {
    btn.style.background = "var(--neutral)";
    btn.style.color = "var(--cream)";
    btn.textContent = "Quét nhanh: TẮT";
  }
}

function toggleQuetNhanh() {
  quetNhanh = !quetNhanh;
  capNhatNutQuetNhanh();
}

async function timMSP() {
  const input = document.getElementById("msp-tao");
  const msp = input.value.trim();
  const infoBox = document.getElementById("info-tao");
  infoMSP = null;
  infoBox.classList.remove("show");
  document.getElementById("card-qr").style.display = "none";
  document.getElementById("qr-grid").innerHTML = "";
  if (!msp) { alert("Vui lòng nhập mã MSP!"); input.focus(); return; }
  showLoading(true);
  const info = await callAPI({ action: "getInfo", msp });
  showLoading(false);
  if (!info.success) { alert(info.error || info.message || "Không tìm thấy MSP!"); input.focus(); return; }
  infoMSP = { msp, ten: info.ten || msp, mau: info.mau || "" };
  document.getElementById("t-ten").textContent = infoMSP.ten;
  document.getElementById("t-mau").textContent = infoMSP.mau || "-";
  infoBox.classList.add("show");
}

async function taoQR() {
  if (!infoMSP) return;
  const sl = parseInt(document.getElementById("sl-qr").value, 10) || 20;
  showLoading(true);
  const ids = await callAPI({ action: "taoNhieuID", soLuong: sl });
  showLoading(false);
  if (ids.error) { alert(ids.error); return; }
  const grid = document.getElementById("qr-grid");
  grid.innerHTML = "";
  ids.forEach(id => {
    const qrData = id + "|" + infoMSP.msp;
    const nd = document.createElement("div");
    nd.className = "qr-item";
    nd.innerHTML = `
      <div class="qr-label">
        <div class="qr-info">
          <div class="qr-ten">${escapeHtml(infoMSP.ten)}</div>
          <div class="qr-mau">${escapeHtml(infoMSP.mau || "—")}</div>
          <div class="qr-id">${escapeHtml(id)}</div>
        </div>
        <div class="qr-code-cell">
          <div class="qr-code-box" id="qr-${id}"></div>
        </div>
      </div>
    `;
    grid.appendChild(nd);
    new QRCode(document.getElementById("qr-" + id), { text: qrData, width: 56, height: 56, correctLevel: QRCode.CorrectLevel.M });
  });
  document.getElementById("card-qr").style.display = "block";
}

// ── Bộ Engine Quét QR Siêu Tốc (Native BarcodeDetector + 1080p + Focus) ─────
let animFrameMap = {};
let nativeBarcodeDetectorGlobal = null;

async function khoiTaoCameraFast(videoId, onDecodedCallback) {
  const videoEl = document.getElementById(videoId);
  if (!videoEl) return null;

  if (animFrameMap[videoId]) {
    cancelAnimationFrame(animFrameMap[videoId]);
    animFrameMap[videoId] = null;
  }

  // 1. Cấu hình độ phân giải 1080p Full HD + Tự động lấy nét liên tục (Continuous Focus)
  const constraints = {
    video: {
      facingMode: "environment",
      width: { ideal: 1920, min: 1280 },
      height: { ideal: 1080, min: 720 },
      frameRate: { ideal: 60 }
    }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = stream;
    await videoEl.play();

    // Bật chế độ tự động lấy nét liên tục nếu camera hỗ trợ
    try {
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
      }
    } catch (e) { }
  } catch (e) {
    console.warn("getUserMedia camera stream notice:", e);
  }

  // 2. Tận dụng phần cứng Native BarcodeDetector (Chạy 60fps trên GPU Android Chrome/Edge)
  if ('BarcodeDetector' in window) {
    try {
      if (!nativeBarcodeDetectorGlobal) {
        nativeBarcodeDetectorGlobal = new BarcodeDetector({ formats: ['qr_code'] });
      }
      let isProcessing = false;

      const loopNative = async () => {
        if (!videoEl.srcObject || videoEl.paused || videoEl.ended) return;
        if (!isProcessing && videoEl.readyState >= 2) {
          isProcessing = true;
          try {
            const codes = await nativeBarcodeDetectorGlobal.detect(videoEl);
            if (codes && codes.length > 0) {
              onDecodedCallback(codes[0].rawValue);
            }
          } catch (e) { }
          isProcessing = false;
        }
        if (videoEl.srcObject) {
          animFrameMap[videoId] = requestAnimationFrame(loopNative);
        }
      };

      animFrameMap[videoId] = requestAnimationFrame(loopNative);
    } catch (e) {
      console.warn("BarcodeDetector native error, fallback to ZXing:", e);
    }
  }

  // 3. ZXing Fallback chỉ quét QR_CODE với TRY_HARDER = true (không quét mã 1D thừa)
  try {
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.QR_CODE]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

    const reader = new ZXing.BrowserMultiFormatReader(hints);
    reader.decodeFromVideoElement(videoEl, (result, err) => {
      if (result) {
        onDecodedCallback(result.getText());
      }
    });
    return reader;
  } catch (e) {
    console.warn("ZXing fallback init error:", e);
  }
  return null;
}

function dungCameraFast(videoId, zxingReaderObj) {
  if (animFrameMap[videoId]) {
    cancelAnimationFrame(animFrameMap[videoId]);
    animFrameMap[videoId] = null;
  }
  if (zxingReaderObj && typeof zxingReaderObj.reset === 'function') {
    zxingReaderObj.reset();
  }
  const videoEl = document.getElementById(videoId);
  if (videoEl && videoEl.srcObject) {
    videoEl.srcObject.getTracks().forEach(t => t.stop());
    videoEl.srcObject = null;
  }
}

async function batDauQuet() {
  ngayChon = document.getElementById("chon-ngay").value;
  loaiChon = document.getElementById("chon-loai").value;
  if (!ngayChon) { alert("⚠️ Vui lòng chọn ngày!"); return; }
  if (!loaiChon) { alert("⚠️ Vui lòng chọn loại!"); return; }

  // Mặc định quét nhanh nếu là Xuất
  quetNhanh = !isNhap(loaiChon);
  capNhatNutQuetNhanh();

  document.getElementById("form-chon").style.display = "none";
  document.getElementById("cam-box").style.display = "block";
  document.getElementById("btn-stop").style.display = "block";
  document.getElementById("scanner-status").textContent = "" + loaiChon + " | " + ngayChon;
  dangXuLy = false;

  try {
    zxingReader = await khoiTaoCameraFast("reader", async (text) => {
      if (!text || dangXuLy) return;
      dangXuLy = true;
      try {
        const qrData = parseQRText(text);
        if (!qrData || !qrData.id || !qrData.msp) {
          showCanhBao("QR không hợp lệ");
          setTimeout(() => { dangXuLy = false; }, 1500);
          return;
        }
        const { id, msp } = qrData;
        if (quetNhanh) {
          await luuNhanh({ id, msp });
        } else {
          await hienOverlay({ id, msp });
        }
      } catch (e) {
        showCanhBao("Lỗi đọc QR");
        setTimeout(() => { dangXuLy = false; }, 1500);
      }
    });
  } catch (e) {
    alert("Lỗi camera: " + e);
    dungQuet();
  }
}

// ── Hàng đợi Offline & Phản hồi Cảm ứng (Haptic Vibration) ─────────
const APP_PENDING_KEY = "app_pending_saves";

function phatVibrateSuccess() {
  if (navigator.vibrate) navigator.vibrate(80);
}

function phatVibrateError() {
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
}

function docPendingApp() {
  try {
    const raw = localStorage.getItem(APP_PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function luuPendingApp(list) {
  try { localStorage.setItem(APP_PENDING_KEY, JSON.stringify(list)); } catch (e) { }
}

async function guiPendingApp() {
  const pending = docPendingApp();
  if (pending.length === 0) return;
  try {
    let successCount = 0;
    const remaining = [];
    for (const item of pending) {
      try {
        const r = await callAPI({ action: "luuGiaoDich", ...item });
        if (r && !r.error) {
          successCount++;
        } else {
          remaining.push(item);
        }
      } catch (e) {
        remaining.push(item);
      }
    }
    luuPendingApp(remaining);
    if (successCount > 0) {
      showCanhBao("🟢 Đã đồng bộ " + successCount + " mã offline thành công!");
    }
  } catch (e) { }
  capNhatTrangThaiMang();
}

function capNhatTrangThaiMang() {
  const el = document.getElementById("mang-status");
  if (!el) return;
  const isOnline = navigator.onLine;
  const pendingApp = docPendingApp();
  let pendingCX1 = [];
  try { if (typeof docPendingCX1 === "function") pendingCX1 = docPendingCX1(); } catch (e) { }
  const tongPending = pendingApp.length + pendingCX1.length;

  if (!isOnline) {
    el.textContent = "🔴 Ngoại tuyến" + (tongPending > 0 ? " (Đã lưu tạm " + tongPending + " mã)" : "");
    el.className = "mang-status show err";
  } else if (tongPending > 0) {
    el.textContent = "⚡ Có mạng — Đang đồng bộ " + tongPending + " mã...";
    el.className = "mang-status show warn";
  } else {
    el.className = "mang-status";
    el.textContent = "";
  }
}

window.addEventListener("online", () => {
  capNhatTrangThaiMang();
  guiPendingApp();
});
window.addEventListener("offline", () => {
  capNhatTrangThaiMang();
});
window.addEventListener("load", () => {
  capNhatTrangThaiMang();
  guiPendingApp();
});

// Lưu nhanh không cần nhập kg
async function luuNhanh(data) {
  showCanhBao("💾 Đang lưu " + data.id + "...");

  try {
    const info = await callAPI({ action: "kiemTraQR", id: data.id, msp: data.msp, loai: loaiChon });

    if (info.error) {
      phatVibrateError();
      showCanhBao(info.error);
      setTimeout(() => { dangXuLy = false; }, 1800);
      return;
    }

    const r = await callAPI({
      action: "luuGiaoDich",
      id: data.id, msp: data.msp,
      ten: info.ten || "—", mau: info.mau || "—",
      ngay: ngayChon, loai: loaiChon,
      kg: 0
    });

    if (r.error) {
      phatVibrateError();
      showCanhBao(r.error);
    } else {
      phatVibrateSuccess();
      showCanhBao("Đã lưu " + data.id);
    }
  } catch (err) {
    // Mất mạng -> Lưu hàng đợi Offline
    const pending = docPendingApp();
    pending.push({
      id: data.id, msp: data.msp,
      ten: "—", mau: "—",
      ngay: ngayChon, loai: loaiChon, kg: 0,
      thoiGian: new Date().toISOString()
    });
    luuPendingApp(pending);
    phatVibrateSuccess();
    showCanhBao("Mất mạng — Đã lưu tạm " + data.id);
    capNhatTrangThaiMang();
  }
  setTimeout(() => { dangXuLy = false; }, 1000);
}

function dungQuet() {
  dungCameraFast("reader", zxingReader);
  zxingReader = null;
  qrDangQuet = null;
  document.getElementById("form-chon").style.display = "block";
  document.getElementById("cam-box").style.display = "none";
  document.getElementById("btn-stop").style.display = "none";
  document.getElementById("scanner-status").textContent = "";
  document.getElementById("canh-bao").style.display = "none";
}

async function hienOverlay(data) {
  document.getElementById("q-id").textContent = data.id;
  document.getElementById("q-msp").textContent = data.msp;
  document.getElementById("q-ten").textContent = "...";
  document.getElementById("q-mau").textContent = "...";
  document.getElementById("q-loai").textContent = loaiChon;
  document.getElementById("q-ton").textContent = "...";
  document.getElementById("q-kg").value = "";
  document.getElementById("q-kg").placeholder = "Nhập số kg...";
  document.getElementById("btn-luu").textContent = "Lưu & quét tiếp";
  document.getElementById("msg-quet").classList.remove("show");
  document.getElementById("overlay-spinner").style.display = "flex";
  document.getElementById("overlay-content").style.display = "block";
  document.getElementById("overlay").classList.add("show");
  document.getElementById("q-kg").focus();

  try {
    const info = await callAPI({ action: "kiemTraQR", id: data.id, msp: data.msp, loai: loaiChon });
    document.getElementById("overlay-spinner").style.display = "none";

    if (info.error) {
      phatVibrateError();
      document.getElementById("overlay").classList.remove("show");
      showCanhBao(info.error);
      setTimeout(() => { dangXuLy = false; }, 1800);
      return;
    }

    qrDangQuet = { id: data.id, msp: data.msp, ten: info.ten || "—", mau: info.mau || "—", cheDo: info.cheDo || "luuMoi" };
    document.getElementById("q-ten").textContent = qrDangQuet.ten;
    document.getElementById("q-mau").textContent = qrDangQuet.mau;
    document.getElementById("q-ton").textContent = formatKg(info.ton) + " kg";

    if (info.cheDo === "capNhatNhap") {
      document.getElementById("q-kg").value = formatKg(info.kgNhap);
      document.getElementById("btn-luu").textContent = "Cập nhật kg";
    } else if (!isNhap(loaiChon)) {
      document.getElementById("q-kg").placeholder = "Tồn: " + formatKg(info.ton) + " kg";
    }
  } catch (err) {
    document.getElementById("overlay-spinner").style.display = "none";
    qrDangQuet = { id: data.id, msp: data.msp, ten: "—", mau: "—", cheDo: "luuMoi" };
    document.getElementById("q-ten").textContent = "Ngoại tuyến";
    document.getElementById("q-mau").textContent = "—";
    document.getElementById("q-ton").textContent = "—";
  }
}

function dongOverlay() {
  document.getElementById("overlay").classList.remove("show");
  qrDangQuet = null;
  dangXuLy = false;
}

function showCanhBao(text) {
  const el = document.getElementById("canh-bao");
  el.textContent = text;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 2000);
}

async function luuGiaoDich() {
  if (!qrDangQuet) return;
  const kg = document.getElementById("q-kg").value;
  if (!kg || parseFloat(kg) <= 0) {
    phatVibrateError();
    showMsg("Nhập số kg hợp lệ", false);
    return;
  }

  const btn = document.getElementById("btn-luu");
  btn.disabled = true;
  btn.textContent = "Đang lưu...";

  try {
    const r = await callAPI({
      action: "luuGiaoDich",
      id: qrDangQuet.id, msp: qrDangQuet.msp, ten: qrDangQuet.ten, mau: qrDangQuet.mau,
      ngay: ngayChon, loai: loaiChon, kg
    });

    btn.disabled = false;
    btn.textContent = "Lưu & quét tiếp";

    if (r.error) {
      phatVibrateError();
      showMsg(r.error, false);
      return;
    }
    phatVibrateSuccess();
    showMsg("Đã lưu " + formatKg(r.kgGoc || kg) + " kg", true);
  } catch (err) {
    // Mất mạng -> lưu tạm offline
    const pending = docPendingApp();
    pending.push({
      id: qrDangQuet.id, msp: qrDangQuet.msp, ten: qrDangQuet.ten, mau: qrDangQuet.mau,
      ngay: ngayChon, loai: loaiChon, kg
    });
    luuPendingApp(pending);
    btn.disabled = false;
    btn.textContent = "Lưu & quét tiếp";
    phatVibrateSuccess();
    showMsg("Mất mạng — Đã lưu tạm " + kg + " kg", true);
    capNhatTrangThaiMang();
  }
  setTimeout(() => dongOverlay(), 800);
}

let loaiDaChon = "";
document.addEventListener("click", e => {
  const btn = document.getElementById("chon-loai-btn");
  const list = document.getElementById("chon-loai-list");
  if (!btn || !list) return;
  if (btn.contains(e.target)) { list.classList.toggle("show"); return; }
  if (e.target.classList.contains("custom-option")) {
    loaiDaChon = e.target.dataset.value;
    document.getElementById("chon-loai").value = loaiDaChon;
    btn.innerHTML = loaiDaChon + '<span style="font-size:12px;color:var(--cream-soft);margin-left:auto">▼</span>';
    document.querySelectorAll(".custom-option").forEach(opt => opt.classList.remove("active"));
    e.target.classList.add("active");
    list.classList.remove("show");
    return;
  }
  if (!list.contains(e.target)) list.classList.remove("show");
});

function showMsg(text, ok) {
  const el = document.getElementById("msg-quet");
  if (el) { el.textContent = text; el.className = "msg show " + (ok ? "ok" : "err"); }
}

window.onload = function () {
  const today = new Date().toISOString().split("T")[0];
  const ngayInput = document.getElementById("chon-ngay");
  if (ngayInput) ngayInput.value = today;
  capNhatTrangChu();
  if (typeof donDepLichSuCX1 === "function") donDepLichSuCX1();
};

// ── Trang chủ: hiện phiên dở dang (hỗ trợ cả Chỉ For và Chỉ X5) ────
function capNhatTrangChu() {
  const card = document.getElementById("phien-dodang-card");
  const noidung = document.getElementById("phien-dodang-noidung");
  if (card && noidung) {
    let state = null;
    try { state = JSON.parse(localStorage.getItem("cx1_phien_dodang")); } catch (e) { }

    if (state && Array.isArray(state.phienCX1) && state.phienCX1.length > 0) {
      const gioCapNhat = state.capNhat
        ? new Date(state.capNhat).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
        : "—";
      noidung.innerHTML = `
        <div class="tk-card-header" style="margin-bottom:10px">
          <div>
            <div class="tk-card-ten">Chỉ For</div>
            <div class="tk-card-msp">Cập nhật: <span>${gioCapNhat}</span></div>
          </div>
          <div class="tk-badge tk-badge-thuong">Dở dang</div>
        </div>
        <div class="tk-stat-grid">
          <div class="tk-stat-box">
            <div class="tk-stat-label">NGÀY</div>
            <div class="tk-stat-val" style="font-size:14px;color:var(--cream)">${state.ngayCX1 || "—"}</div>
          </div>
          <div class="tk-stat-box highlight">
            <div class="tk-stat-label">ĐÃ QUÉT</div>
            <div class="tk-stat-val main-ton">${state.phienCX1.length} <small>mã</small></div>
          </div>
        </div>
      `;
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  }

  const cardX5 = document.getElementById("phien-dodang-card-x5");
  const noidungX5 = document.getElementById("phien-dodang-noidung-x5");
  if (cardX5 && noidungX5) {
    let stateX5 = null;
    try { stateX5 = JSON.parse(localStorage.getItem("cx5_phien_dodang")); } catch (e) { }

    if (stateX5 && Array.isArray(stateX5.phienCX5) && stateX5.phienCX5.length > 0) {
      const gioCapNhatX5 = stateX5.capNhat
        ? new Date(stateX5.capNhat).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
        : "—";
      noidungX5.innerHTML = `
        <div class="tk-card-header" style="margin-bottom:10px">
          <div>
            <div class="tk-card-ten">Chỉ X5</div>
            <div class="tk-card-msp">Cập nhật: <span>${gioCapNhatX5}</span></div>
          </div>
          <div class="tk-badge tk-badge-for">Dở dang</div>
        </div>
        <div class="tk-stat-grid">
          <div class="tk-stat-box">
            <div class="tk-stat-label">NGÀY</div>
            <div class="tk-stat-val" style="font-size:14px;color:var(--cream)">${stateX5.ngayCX5 || "—"}</div>
          </div>
          <div class="tk-stat-box highlight">
            <div class="tk-stat-label">ĐÃ NHẬP</div>
            <div class="tk-stat-val main-ton">${stateX5.phienCX5.length} <small>dòng</small></div>
          </div>
        </div>
      `;
      cardX5.style.display = "block";
    } else {
      cardX5.style.display = "none";
    }
  }

  const cardBTP = document.getElementById("phien-dodang-card-btp");
  const noidungBTP = document.getElementById("phien-dodang-noidung-btp");
  if (cardBTP && noidungBTP) {
    let stateBTP = null;
    try { stateBTP = JSON.parse(localStorage.getItem("btp_phien_dodang")); } catch (e) { }

    if (stateBTP && (Array.isArray(stateBTP.phienBTP) || stateBTP.idPhienHienTaiBTP)) {
      const soMa = Array.isArray(stateBTP.phienBTP) ? stateBTP.phienBTP.length : 0;
      const gioCapNhatBTP = stateBTP.capNhat
        ? new Date(stateBTP.capNhat).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
        : "—";
      noidungBTP.innerHTML = `
        <div class="tk-card-header" style="margin-bottom:10px">
          <div>
            <div class="tk-card-ten">BTP (Bán Thành Phẩm)</div>
            <div class="tk-card-msp">Cập nhật: <span>${gioCapNhatBTP}</span></div>
          </div>
          <div class="tk-badge tk-badge-thuong">Dở dang</div>
        </div>
        <div class="tk-stat-grid">
          <div class="tk-stat-box">
            <div class="tk-stat-label">NGÀY</div>
            <div class="tk-stat-val" style="font-size:14px;color:var(--cream)">${stateBTP.ngayBTP || "—"}</div>
          </div>
          <div class="tk-stat-box highlight">
            <div class="tk-stat-label">ĐÃ QUÉT</div>
            <div class="tk-stat-val main-ton">${soMa} <small>mã</small></div>
          </div>
        </div>
      `;
      cardBTP.style.display = "block";
    } else {
      cardBTP.style.display = "none";
    }
  }
}
window.capNhatTrangChu = capNhatTrangChu;

function toggleChonLichSuTrangChu() {
  const el = document.getElementById("lichsu-menu-trangchu");
  if (!el) return;
  const currentDisplay = window.getComputedStyle(el).display;
  if (currentDisplay === "none") {
    el.style.display = "flex";
  } else {
    el.style.display = "none";
  }
}
window.toggleChonLichSuTrangChu = toggleChonLichSuTrangChu;

function moLichSuChon(loai) {
  const el = document.getElementById("lichsu-menu-trangchu");
  if (el) el.style.display = "none";

  if (loai === "btp") {
    if (typeof window.moLichSuBTP === "function") window.moLichSuBTP();
    else if (typeof window.chuyenTrangKhongNav === "function") window.chuyenTrangKhongNav("lichSuBTP");
  } else if (loai === "for") {
    if (typeof window.moLichSuCX1 === "function") window.moLichSuCX1();
    else if (typeof window.chuyenTrangKhongNav === "function") window.chuyenTrangKhongNav("lichSu");
  } else if (loai === "x5") {
    if (typeof window.moLichSuCX5 === "function") window.moLichSuCX5();
    else if (typeof window.chuyenTrangKhongNav === "function") window.chuyenTrangKhongNav("lichSuCX5");
  }
}
window.moLichSuChon = moLichSuChon;

window.timMSP = timMSP;
window.taoQR = taoQR;
window.chuyenTrang = chuyenTrang;
window.batDauQuet = batDauQuet;
window.dungQuet = dungQuet;
window.dongOverlay = dongOverlay;
window.luuGiaoDich = luuGiaoDich;
window.toggleQuetNhanh = toggleQuetNhanh;

// ── Trạng thái mạng (dùng chung toàn ứng dụng) ──────
function demPendingMang() {
  let tong = 0;
  try { tong += JSON.parse(localStorage.getItem(APP_PENDING_KEY) || "[]").length; } catch (e) { }
  try { tong += JSON.parse(localStorage.getItem("cx1_pending_saves") || "[]").length; } catch (e) { }
  try { tong += JSON.parse(localStorage.getItem("kk_pending_saves") || "[]").length; } catch (e) { }
  try { tong += JSON.parse(localStorage.getItem("cx5_pending_saves") || "[]").length; } catch (e) { }
  try { tong += JSON.parse(localStorage.getItem("btp_pending_saves") || "[]").length; } catch (e) { }
  return tong;
}

function capNhatTrangThaiMang() {
  const el = document.getElementById("mang-status");
  if (!el) return;
  const soCho = demPendingMang();
  if (!navigator.onLine) {
    const text = soCho > 0 ? ("Ngoại tuyến (" + soCho + " mã chờ đồng bộ)") : "Ngoại tuyến";
    el.innerHTML = '<span class="live-pulse-dot" style="background:#ef4444;box-shadow:0 0 8px #ef4444;"></span>' + text;
    el.className = "mang-status show err";
  } else if (soCho > 0) {
    el.innerHTML = '<span class="live-pulse-dot" style="background:#f59e0b;box-shadow:0 0 8px #f59e0b;"></span>Đang đồng bộ ' + soCho + ' mã...';
    el.className = "mang-status show warn";
  } else {
    el.className = "mang-status";
    el.innerHTML = "";
  }
}

window.addEventListener("online", capNhatTrangThaiMang);
window.addEventListener("offline", capNhatTrangThaiMang);
window.addEventListener("load", capNhatTrangThaiMang);
setInterval(capNhatTrangThaiMang, 4000);
window.capNhatTrangThaiMang = capNhatTrangThaiMang;

let _appXacNhanCallbackOk = null;
let _appXacNhanCallbackHuy = null;

function moXacNhanApp(noiDung, callbackOk, nhanNutOk, callbackHuy, nhanNutHuy, tieuDe) {
  const elTieude = document.getElementById("app-xacnhan-tieude");
  const elNoidung = document.getElementById("app-xacnhan-noidung");
  const elNutOk = document.getElementById("app-xacnhan-nut-ok");
  const elNutHuy = document.getElementById("app-xacnhan-nut-huy");

  if (elTieude) elTieude.textContent = tieuDe || "Xác nhận";
  if (elNoidung) elNoidung.textContent = noiDung || "";
  if (elNutOk) elNutOk.textContent = nhanNutOk || "Đồng ý";
  if (elNutHuy) elNutHuy.textContent = nhanNutHuy || "Hủy";

  _appXacNhanCallbackOk = callbackOk || null;
  _appXacNhanCallbackHuy = callbackHuy || null;

  const overlay = document.getElementById("app-overlay-xacnhan");
  if (overlay) overlay.classList.add("show");
}
window.moXacNhanApp = moXacNhanApp;

function dongXacNhanApp(dongY) {
  const overlay = document.getElementById("app-overlay-xacnhan");
  if (overlay) overlay.classList.remove("show");
  const cbOk = _appXacNhanCallbackOk;
  const cbHuy = _appXacNhanCallbackHuy;
  _appXacNhanCallbackOk = null;
  _appXacNhanCallbackHuy = null;

  if (dongY && cbOk) cbOk();
  else if (!dongY && cbHuy) cbHuy();
}
window.dongXacNhanApp = dongXacNhanApp;
