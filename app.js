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
const FAST_MP3_BASE64 = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU3LjgzLjEwMAAAAAAAAAAAAAAA//NwwAAAAAAAAAAAAEluZm8AAAAPAAAADgAABm0ALCwsLCwsLDw8PDw8PDxNTU1NTU1NXV1dXV1dXW1tbW1tbW19fX19fX19jo6Ojo6Ojp6enp6enp6erq6urq6urr6+vr6+vr7Pz8/Pz8/P39/f39/f3+/v7+/v7+//////////AAAAAExhdmM1Ny4xMAAAAAAAAAAAAAAAACQCQAAAAAAAAAZtq7ZihwAAAAAAAAAAAAAAAAD/80DEAA7QMezsCMYEigESyKrKyjixDpSkHE1mzKS7Hb+TTtJgALZMHG0o7+fKV4DY9vbz5fpSomXW/XdLz9bw/rHvl1n9qeTVi3TCjE21EmP6gxdPIAwgYuocaHxdyKcJgcqBwAA40v/zQsQfFPKSQAFJKAArCb6mDgo9XJVBQPh8PuxyEEBczHc7kVv///5xRv2zn53pPO5Op0Z//dyN84cFHf//DCYOJRNHtniO610xRyFjO3/nYcewWf6ySCM4JGyrAMoEnDEjVqOOIaILAP/zQMQnHhrygMuZmAByG2RukHgFiDbA6S99+VyCEFG2MwylXVatVByKEUNB2E2fNv//olw0SJxiHkTLh//q9S3c+tOu+5BDFIkygVEHUXE///W+3/0CfUgf///d/pJq+tgmhEDwq2aA//NCxAkWeNrMC5h4AAJUo81O9fpUKxRRJkoFC0ktAzMXpsIAl6FmKKoOVqRqKWSbLpvPLb5FqZrYVJGS7663eLCqrW6HY8JRV0wEtlZcMFNDGe4uXfJmTzS5r+p30xoIFFsSKYJGrYra//NAxAsWqW7YF89IAgdzgcLinJ1lmbBH1M+jnYorXbJ5bOoVNSXt7lPJhK8bjmN5Uot302shJOc8VfrBQhlNAM/YFF2NgnlYkaFA4W/9kIrj4V/////wQLg/rB96G3HzATKHLp8sAmH/80LECxa6dtgGeJMcbmTofTYonRhl6f4mS+613Ge5Z87oIoxCsVVQxxaFYQXIj6sW/bbm9+/RP20Tr/L7dq///122BEQm100RJFJtAwCwfDZLBUkyGv8OqFRZQ9WCBBgS6rWmVabvKMz/80DEDBaiitFkwsS0J2uPpJy+7e41HgauVrHgucRJoklzR8tsEqpYYXyqyY1OHldVvOv5tTUYaWZmm3V9X6pn2M5LvyvZkVEXr0+isTMmlo0QdKkcolTAxOQCZYYDEDUQzJVAI9EQR//zQsQMFvFW3vZ7BqiyE203iwC4x24cKj3zOf3+ouHsSxwBUusUN+7gZeCy6NJr1wjepvx3ptIhkpLkTlpZ1xEWeVeblKt/fJvsFonqDVypsIKJvW1WTFgA4ZEuRewABKm2ArjWyYAI8//zQMQME9jC1ixrBhhqBYYoPFYrC5AuOw6nWpTE4fvDBLdMn8Jw66mjAp55RDV0MCaREssmxaVgWKnUD87CtJ1BF3r0MWfU9R40qxxVy2jNCqAAAZGCKCPSE+nrPupzoyho+HJoQSwp//NCxBcSML7GLnsMFOTkkaAW2Dw37zMb6Pzmke58jQ0dUSWdaSKyRZq4zHuaLCWZ13Mz0tb/03zv///0U9hapQB5x2XbAOkcWBcjQo/H7q4okXVjTik2eKtzZmaqvPCkq6kbLtmCtBY6//NAxCoUQM69nkmGEAJwx49kRntuYqY8RPEOnWCpFZUVO0CIGREWLRL4aFcSnQ1AsVb+HXcUqzKphKEIRr0XgJHmfFlJERAkSyvOka3UoxhhQYCZvjMpUKAgrw6MAwNFYilTtYKhqHb/80LENBQoynxUYkZMVBUFToNfkg589rBUNVx7sNcRdv/+WBoDPEoKnVVADB8kPkpEVMAkoJkKy7D2URZslWeSkS7NK5v8OfeZ65CIWuefxE//0dQES31ueSHt0/v/VLf1kW3vOiJrMtn/80DEPxC5afQISEUQ152sBExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqv/zQsRXAAADSAAAAACqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqg==";

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
  phatVibrateSuccess();

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
  if (window.AndroidBridge && typeof window.AndroidBridge.vibrate === "function") {
    try { window.AndroidBridge.vibrate(100); return; } catch (e) { }
  }
  if (navigator.vibrate) {
    try { navigator.vibrate(100); } catch (e) { }
  }
}
window.phatVibrateSuccess = phatVibrateSuccess;

function phatVibrateError() {
  if (window.AndroidBridge && typeof window.AndroidBridge.vibrate === "function") {
    try {
      window.AndroidBridge.vibrate(150);
      setTimeout(() => { try { window.AndroidBridge.vibrate(150); } catch (e2) {} }, 250);
      return;
    } catch (e) { }
  }
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

function layNgayHomNayLocal() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}
window.layNgayHomNayLocal = layNgayHomNayLocal;

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

  // Tự động khởi tạo ngày hôm nay nếu ô chọn ngày đang trống
  const today = layNgayHomNayLocal();
  ["cx5-ngay", "cx1-ngay", "btp-ngay", "kk-ngay"].forEach(inputId => {
    const inputEl = document.getElementById(inputId);
    if (inputEl && !inputEl.value) inputEl.value = today;
  });
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

// ── Bộ Engine Quét QR Siêu Tốc & Quản Lý Camera Thông Minh ─────────────────
let animFrameMap = {};
let nativeBarcodeDetectorGlobal = null;
const lastCameraCallbackMap = {};

let danhSachCameraSau = [];
let idCameraUuTien = localStorage.getItem('camera_uu_tien') || null;

// Hàm nhận diện chính xác Camera 0 (Sony IMX586 48MP AF chính)
function timCamera0(devices) {
  if (!devices || devices.length === 0) return null;
  const videoInputs = devices.filter(d => d.kind === 'videoinput');
  if (videoInputs.length === 0) return null;

  // 1. Tìm camera có nhãn rõ ràng là Camera 0 (loại trừ camera2 10 và camera trước)
  let cam0 = videoInputs.find(d => {
    const lbl = (d.label || '').toLowerCase();
    if (!lbl) return false;
    if (lbl.includes('front') || lbl.includes('truoc') || lbl.includes('selfie') || lbl.includes('user') || lbl.includes('camera2 1,')) return false;
    if (lbl.includes('camera2 10') || lbl.includes('camera 10') || lbl.includes('aux') || lbl.includes('wide') || lbl.includes('tele')) return false;
    return /camera2?\s*0\b/i.test(lbl) || (lbl.includes('back') && /(^|[^\d])0($|[^\d])/.test(lbl));
  });
  if (cam0 && cam0.deviceId) return cam0;

  // 2. Tìm camera sau nhưng loại trừ tuyệt đối camera 10, tele, wide và camera trước
  let backCam = videoInputs.find(d => {
    const lbl = (d.label || '').toLowerCase();
    if (!lbl) return false;
    if (lbl.includes('front') || lbl.includes('truoc') || lbl.includes('selfie') || lbl.includes('user') || lbl.includes('camera2 1,')) return false;
    if (lbl.includes('camera2 10') || lbl.includes('camera 10') || lbl.includes('aux') || lbl.includes('wide') || lbl.includes('tele')) return false;
    return lbl.includes('back') || lbl.includes('sau') || lbl.includes('environment');
  });
  if (backCam && backCam.deviceId) return backCam;

  // 3. Nếu chưa có nhãn (lần đầu khi trình duyệt chưa cấp quyền truy cập thiết bị),
  // Camera 0 trong kiến trúc Android Camera2 luôn là thiết bị đầu tiên (index 0)
  if (videoInputs[0] && videoInputs[0].deviceId) {
    return videoInputs[0];
  }

  return null;
}

// Hàm quét & sắp xếp danh sách camera sau phần cứng
async function quetDanhSachCameraSau() {
  try {
    if (window.AndroidBridge && typeof window.AndroidBridge.isCameraAvailable === 'function') {
      if (!window.AndroidBridge.isCameraAvailable()) return [];
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(d => d.kind === 'videoinput');
    if (videoInputs.length === 0) return [];

    // Ưu tiên cao nhất: Tìm thấy Camera 0 chính xác
    const cam0 = timCamera0(videoInputs);
    if (cam0) {
      danhSachCameraSau = [cam0];
      return [cam0];
    }

    // Lọc camera sau (loại bỏ triệt để camera trước pop-up và camera 10)
    let backCams = videoInputs.filter(d => {
      const lbl = (d.label || '').toLowerCase();
      if (!lbl) return true;
      if (lbl.includes('front') || lbl.includes('truoc') || lbl.includes('selfie') || lbl.includes('user') || lbl.includes('camera2 1')) return false;
      if (lbl.includes('camera2 10') || lbl.includes('camera 10')) return false;
      return true;
    });

    danhSachCameraSau = backCams;
    return backCams;
  } catch (e) {
    console.warn("Lỗi enumerateDevices:", e);
    return [];
  }
}

// Hàm mở luồng camera tối ưu chuẩn 4:3 chống lỗi crop ISP Snapdragon 855 (tuyệt đối không bao giờ mở camera trước)
async function layCameraStream(targetDeviceId) {
  if (targetDeviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: targetDeviceId },
          width: { ideal: 1280 },
          height: { ideal: 960 }
        }
      });
    } catch (e) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: targetDeviceId }
          }
        });
      } catch (e2) {}
    }
  }

  // Mở camera sau chuẩn: facingMode: { ideal: "environment" }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 960 }
      }
    });
  } catch (eFacing) {}

  return await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" }
  });
}

// Android Camera2 đã tự động bật Continuous Autofocus & Continuous Autoexposure ở cấp phần cứng
async function batContinuousAutofocus(stream) {
  // Tuyệt đối không gọi applyConstraints tại đây vì trên chip Snapdragon 855 / Sony IMX586,
  // applyConstraints làm sai lệch ma trận crop ISP (Invalid Crop window 8000x6000) dẫn đến crash Camera HAL.
}

// Tự động ẩn hoàn toàn nút đổi camera (Camera 0 Sony 48MP AF là tối ưu duy nhất để quét mã)
function capNhatNutDoiCamera(videoEl) {
  if (!videoEl || !videoEl.parentElement) return;
  const parent = videoEl.parentElement;
  const btn = parent.querySelector('.btn-doi-cam');
  if (btn) {
    btn.remove();
  }
}

// Khóa cố định camera chính, không cho đổi sang camera phụ để chống đen màn hình và mất nét
window.doiCameraNhanh = async function(videoId) {
  const msg = "Đã khóa cố định Camera chính Sony 48MP AF - Cảm biến duy nhất hỗ trợ lấy nét quét mã QR!";
  if (videoId === 'btp-reader' && typeof showCanhBaoBTP === "function") showCanhBaoBTP(msg);
  else if (videoId === 'cx1-reader' && typeof showCanhBaoCX1 === "function") showCanhBaoCX1(msg);
  else if (typeof showCanhBao === "function") showCanhBao(msg);
};
window.doiCamera = window.doiCameraNhanh;

async function khoiTaoCameraFast(videoId, onDecodedCallback) {
  const videoEl = document.getElementById(videoId);
  if (!videoEl) return null;

  if (typeof onDecodedCallback === 'function') {
    lastCameraCallbackMap[videoId] = onDecodedCallback;
  }

  if (animFrameMap[videoId]) {
    clearTimeout(animFrameMap[videoId]);
    animFrameMap[videoId] = null;
  }

  // 1. Quét danh sách camera phần cứng & ưu tiên mở Camera 0 (Sony 48MP AF)
  let cams = await quetDanhSachCameraSau();
  let cam0 = timCamera0(cams);
  // Chỉ dùng idCameraUuTien nếu nó thực sự tồn tại trong danh sách camera sau phần cứng
  const validSavedId = (idCameraUuTien && cams.some(d => d.deviceId === idCameraUuTien)) ? idCameraUuTien : null;
  let targetId = (cam0 && cam0.deviceId) ? cam0.deviceId : validSavedId;

  let stream = null;
  try {
    if (targetId) {
      try {
        stream = await layCameraStream(targetId);
      } catch (eTarget) {
        stream = null;
      }
    }
    if (!stream) {
      stream = await layCameraStream(null);
    }

    try {
      const devList = await navigator.mediaDevices.enumerateDevices();
      const exactCam0 = timCamera0(devList);
      if (exactCam0 && exactCam0.deviceId) {
        idCameraUuTien = exactCam0.deviceId;
        try { localStorage.setItem('camera_uu_tien', exactCam0.deviceId); } catch (e) {}

        const activeTrack = stream ? stream.getVideoTracks()[0] : null;
        const activeLabel = (activeTrack?.label || '').toLowerCase();
        const isCam0Active = /camera2?\s*0\b/i.test(activeLabel) && !activeLabel.includes('10');

        // Nếu camera đang mở chưa phải là Camera 0 Sony 48MP AF chính chủ, chuyển ngay sang Camera 0
        if (!isCam0Active) {
          try {
            if (stream) stream.getTracks().forEach(t => t.stop());
            await new Promise(r => setTimeout(r, 120));
            const cam0Stream = await layCameraStream(exactCam0.deviceId);
            if (cam0Stream) {
              stream = cam0Stream;
              videoEl.srcObject = cam0Stream;
            }
          } catch (eSwitch) {
            console.warn("Lỗi chuyển sang Camera 0:", eSwitch);
          }
        }
      }
    } catch (eCheck) {}

    videoEl.srcObject = stream;
    videoEl.muted = true;
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('autoplay', '');
    try {
      await videoEl.play();
    } catch (ePlay) {
      console.warn("video.play() notice:", ePlay);
    }

    // Tự động khôi phục luồng nếu phần cứng Camera HAL bị ngắt đột ngột
    const activeVideoTrack = stream ? stream.getVideoTracks()[0] : null;
    if (activeVideoTrack) {
      activeVideoTrack.onended = () => {
        console.warn("Camera track ended. Đang kiểm tra Camera HAL để tự động khôi phục an toàn...");
        setTimeout(async () => {
          if (document.visibilityState === 'visible') {
            if (window.AndroidBridge && typeof window.AndroidBridge.isCameraAvailable === 'function') {
              let retries = 0;
              while (!window.AndroidBridge.isCameraAvailable() && retries < 10) {
                await new Promise(r => setTimeout(r, 400));
                retries++;
              }
            }
            khoiPhucCamera(videoId, lastCameraCallbackMap[videoId]);
          }
        }, 1200);
      };
    }

    // Kích hoạt Continuous Autofocus an toàn
    await batContinuousAutofocus(stream);

    // Cập nhật nút đổi camera trên viewfinder (ẩn triệt để)
    capNhatNutDoiCamera(videoEl);
  } catch (e) {
    console.warn("getUserMedia camera stream notice:", e);
  }

  // 2. Vòng lặp giải mã QR hiệu năng cao: Native BarcodeDetector + Fallback ZXing decode
  let nativeDetector = null;
  if ('BarcodeDetector' in window) {
    try {
      nativeDetector = new BarcodeDetector({ formats: ['qr_code'] });
    } catch (e) {
      nativeDetector = null;
    }
  }

  const zxingReader = new ZXing.BrowserQRCodeReader();
  let isScanning = true;
  let isDecoding = false;

  const quetKhungHinh = async () => {
    if (!isScanning) return;
    const currentTrack = videoEl.srcObject ? videoEl.srcObject.getVideoTracks()[0] : null;
    if (!videoEl.srcObject || !currentTrack || currentTrack.readyState === 'ended' || videoEl.ended) {
      isScanning = false;
      setTimeout(() => {
        if (document.visibilityState === 'visible') {
          khoiPhucCamera(videoId, onDecodedCallback);
        }
      }, 400);
      return;
    }
    if (videoEl.paused) return;

    if (!isDecoding && videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
      isDecoding = true;
      let qrText = null;

      // Ưu tiên 1: Native BarcodeDetector (Tốc độ phần cứng < 5ms)
      if (nativeDetector) {
        try {
          const codes = await nativeDetector.detect(videoEl);
          if (codes && codes.length > 0 && codes[0].rawValue) {
            qrText = codes[0].rawValue;
          }
        } catch (eNative) {
          nativeDetector = null;
        }
      }

      // Ưu tiên 2 (hoặc Fallback): ZXing Reader (100% JS thuần, không phụ thuộc Google Play Services)
      if (!qrText && videoEl.readyState >= 2) {
        try {
          const res = zxingReader.decode(videoEl);
          if (res && res.getText()) {
            qrText = res.getText();
          }
        } catch (eZxing) { }
      }

      if (qrText) {
        try {
          onDecodedCallback(qrText);
        } catch (eCb) {
          console.warn("Callback error:", eCb);
        }
      }

      isDecoding = false;
    }

    if (isScanning && videoEl.srcObject) {
      animFrameMap[videoId] = setTimeout(quetKhungHinh, 100); // 10 FPS tối ưu: Máy mát rượi, không tụt FPS, bắt mã tức thì
    }
  };

  animFrameMap[videoId] = setTimeout(quetKhungHinh, 100);

  return {
    reset: () => {
      isScanning = false;
      if (animFrameMap[videoId]) {
        clearTimeout(animFrameMap[videoId]);
        animFrameMap[videoId] = null;
      }
      try { zxingReader.reset(); } catch (e) {}
    }
  };
}

function dungCameraFast(videoId, zxingReaderObj) {
  if (animFrameMap[videoId]) {
    clearTimeout(animFrameMap[videoId]);
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

// (phatVibrateSuccess & phatVibrateError đã được khởi tạo và gắn vào window ở trên)

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
  await dongBoTatCaOfflineApp();
}

window.addEventListener("online", () => {
  dongBoTatCaOfflineApp();
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

// ── Trạng thái mạng & Bộ máy đồng bộ tập trung toàn bộ module ──────
function demPendingMang() {
  let tong = 0;
  try { tong += JSON.parse(localStorage.getItem(APP_PENDING_KEY) || "[]").length; } catch (e) { }
  try { tong += JSON.parse(localStorage.getItem("qr_pending_saves") || "[]").length; } catch (e) { }
  try { tong += JSON.parse(localStorage.getItem("cx1_pending_saves") || "[]").length; } catch (e) { }
  try { tong += JSON.parse(localStorage.getItem("kk_pending_saves") || "[]").length; } catch (e) { }
  try { tong += JSON.parse(localStorage.getItem("cx5_pending_saves") || "[]").length; } catch (e) { }
  try { tong += JSON.parse(localStorage.getItem("btp_pending_saves") || "[]").length; } catch (e) { }
  return tong;
}

let dangDongBoTongApp = false;

async function dongBoTatCaOfflineApp() {
  if (dangDongBoTongApp) return;
  dangDongBoTongApp = true;

  try {
    // 1. Đồng bộ App QR
    const appPending = [...docPendingApp(), ...(function () { try { return JSON.parse(localStorage.getItem("qr_pending_saves") || "[]"); } catch (e) { return []; } })()];
    if (appPending.length > 0) {
      const remainingApp = [];
      let okCount = 0;
      for (const item of appPending) {
        try {
          const r = await callAPI({ action: "luuGiaoDich", ...item });
          if (r && !r.error) okCount++;
          else remainingApp.push(item);
        } catch (e) { remainingApp.push(item); }
      }
      luuPendingApp(remainingApp);
      try { localStorage.removeItem("qr_pending_saves"); } catch (e) { }
    }

    // 2. Đồng bộ Chỉ FOR (CX1)
    if (typeof docPendingCX1 === "function" && typeof guiLenSheetCX1 === "function") {
      const pendingCX1 = docPendingCX1();
      if (pendingCX1.length > 0) {
        try {
          await guiLenSheetCX1(pendingCX1);
          if (typeof luuPendingCX1 === "function") luuPendingCX1([]);
        } catch (e) { }
      }
    }

    // 3. Đồng bộ BTP
    if (typeof docPendingBTP === "function" && typeof guiLenSheetBTP === "function") {
      const pendingBTP = docPendingBTP();
      if (pendingBTP.length > 0) {
        try {
          await guiLenSheetBTP(pendingBTP);
          if (typeof luuPendingBTP === "function") luuPendingBTP([]);
        } catch (e) { }
      }
    }

    // 4. Đồng bộ Chỉ X5 (CX5)
    try {
      const pendingCX5 = JSON.parse(localStorage.getItem("cx5_pending_saves") || "[]");
      if (pendingCX5.length > 0 && typeof callApiCX5 === "function") {
        const remainingCX5 = [];
        for (const item of pendingCX5) {
          try {
            const r = await callApiCX5({ action: "submitEntryX5", payload: item });
            if (!r || !r.success) remainingCX5.push(item);
          } catch (e) { remainingCX5.push(item); }
        }
        localStorage.setItem("cx5_pending_saves", JSON.stringify(remainingCX5));
      }
    } catch (e) { }

    // 5. Đồng bộ Kiểm kê
    try {
      const pendingKK = JSON.parse(localStorage.getItem("kk_pending_saves") || "[]");
      if (pendingKK.length > 0 && typeof callAPI === "function") {
        const r = await callAPI({ action: "luuKiemKe", data: pendingKK });
        if (r && !r.error) localStorage.setItem("kk_pending_saves", "[]");
      }
    } catch (e) { }

  } finally {
    dangDongBoTongApp = false;
    capNhatTrangThaiMang();
  }
}
window.dongBoTatCaOfflineApp = dongBoTatCaOfflineApp;

function xoaSachPendingApp() {
  try { localStorage.removeItem(APP_PENDING_KEY); } catch (e) { }
  try { localStorage.removeItem("qr_pending_saves"); } catch (e) { }
  try { localStorage.removeItem("cx1_pending_saves"); } catch (e) { }
  try { localStorage.removeItem("btp_pending_saves"); } catch (e) { }
  try { localStorage.removeItem("cx5_pending_saves"); } catch (e) { }
  try { localStorage.removeItem("kk_pending_saves"); } catch (e) { }
  if (typeof luuPendingBTP === "function") luuPendingBTP([]);
  if (typeof luuPendingCX1 === "function") luuPendingCX1([]);
  if (typeof luuPendingCX5 === "function") luuPendingCX5([]);
  capNhatTrangThaiMang();
  if (typeof showCanhBao === "function") showCanhBao("Đã xóa sạch hàng chờ đồng bộ!");
}
window.xoaSachPendingApp = xoaSachPendingApp;

function toggleHopThoaiDongBoMang() {
  const soCho = demPendingMang();
  if (soCho === 0) return;

  if (typeof moXacNhanApp === "function") {
    moXacNhanApp(
      "Đang có " + soCho + " bản ghi chưa đồng bộ. Bạn muốn làm gì?",
      function () { dongBoTatCaOfflineApp(); },
      "⚡ Thử đồng bộ ngay",
      function () { xoaSachPendingApp(); },
      "🗑️ Xóa hàng chờ này",
      "Hàng chờ đồng bộ"
    );
  }
}

function capNhatTrangThaiMang() {
  const el = document.getElementById("mang-status");
  if (!el) return;

  if (!el.getAttribute("data-has-click")) {
    el.setAttribute("data-has-click", "true");
    el.style.cursor = "pointer";
    el.title = "Bấm để tùy chọn đồng bộ hoặc xóa hàng chờ";
    el.onclick = toggleHopThoaiDongBoMang;
  }

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

window.addEventListener("online", () => {
  capNhatTrangThaiMang();
  dongBoTatCaOfflineApp();
});
window.addEventListener("offline", capNhatTrangThaiMang);
window.addEventListener("load", () => {
  capNhatTrangThaiMang();
  dongBoTatCaOfflineApp();
});
setInterval(capNhatTrangThaiMang, 3000);
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

// ── Hàm khôi phục sạch luồng camera và khởi động lại vòng lặp quét ──
let dangKhoiPhucCameraMap = {};
async function khoiPhucCamera(videoId, fallbackCb) {
  if (dangKhoiPhucCameraMap[videoId]) return;
  dangKhoiPhucCameraMap[videoId] = true;
  try {
    const videoEl = document.getElementById(videoId);
    if (!videoEl) return;
    const cb = lastCameraCallbackMap[videoId] || fallbackCb;
    if (!cb) return;

    // 1. Dừng sạch luồng cũ và giải phóng timer cũ
    dungCameraFast(videoId, null);

    // 2. Nghỉ 300ms cho Camera HAL của Android giải phóng hoàn toàn cảm biến
    await new Promise(r => setTimeout(r, 300));

    // 3. Khởi tạo lại camera và kích hoạt lại vòng lặp quét mới
    await khoiTaoCameraFast(videoId, cb);
  } finally {
    dangKhoiPhucCameraMap[videoId] = false;
  }
}

// ── Tự động quản lý vòng đời Camera khi ẩn/mở lại app (Triệt tiêu 100% hiện tượng đứng hình) ──
let resumeCameraTimer = null;
function triggerResumeCamera() {
  clearTimeout(resumeCameraTimer);
  resumeCameraTimer = setTimeout(async () => {
    const camBoxes = [
      { vid: 'reader', box: 'cam-box', fallback: (txt) => { if (typeof xuLyMaQuet === 'function') xuLyMaQuet(txt); } },
      { vid: 'kk-reader', box: 'kk-cam', fallback: (txt) => { if (typeof xuLyMaKiemKe === 'function') xuLyMaKiemKe(txt); } },
      { vid: 'cx1-reader', box: 'cx1-cam', fallback: (txt) => { if (txt && window.dangQuetCX1 && typeof window.khiQuetDuocMa === 'function') window.khiQuetDuocMa({ getText: () => txt }); } },
      { vid: 'btp-reader', box: 'btp-cam', fallback: (txt) => { if (txt && window.dangQuetBTP && typeof window.khiQuetDuocMaBTP === 'function') window.khiQuetDuocMaBTP({ getText: () => txt }); } }
    ];

    for (const item of camBoxes) {
      const boxEl = document.getElementById(item.box);
      const videoEl = document.getElementById(item.vid);
      if (boxEl && window.getComputedStyle(boxEl).display !== 'none' && videoEl) {
        // Luôn khôi phục lại luồng camera mới tinh để không bao giờ bị đứng hình sau khi ẩn app
        await khoiPhucCamera(item.vid, item.fallback);
      }
    }
  }, 250);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // 1. Khi ẩn app hoặc tắt màn hình: Chủ động ngắt sạch phần cứng camera để giải phóng cảm biến
    const camBoxes = [
      { vid: 'reader', box: 'cam-box' },
      { vid: 'kk-reader', box: 'kk-cam' },
      { vid: 'cx1-reader', box: 'cx1-cam' },
      { vid: 'btp-reader', box: 'btp-cam' }
    ];
    for (const item of camBoxes) {
      const boxEl = document.getElementById(item.box);
      const videoEl = document.getElementById(item.vid);
      if (boxEl && window.getComputedStyle(boxEl).display !== 'none' && videoEl && videoEl.srcObject) {
        try {
          videoEl.srcObject.getTracks().forEach(t => t.stop());
          videoEl.srcObject = null;
        } catch (e) {}
      }
    }
  } else if (document.visibilityState === 'visible') {
    // 2. Khi quay lại app: Tự động khởi động lại luồng camera mới ngay lập tức
    triggerResumeCamera();
  }
});

// ── Hệ Thống Sao Lưu & Phục Hồi Dữ Liệu An Toàn ───────────────────
const BACKUP_KEYS = [
  "app_pending_saves",
  "cx1_phien_dodang",
  "cx1_pending_saves",
  "cx1_lich_su",
  "cx5_phien_dodang",
  "cx5_pending_saves",
  "cx5_lich_su",
  "btp_phien_dodang",
  "btp_pending_saves",
  "btp_lich_su",
  "kk_pending_saves",
  "tk_freq",
  "camera_uu_tien",
  "user_theme"
];

function saoLuuDuLieuToanBo() {
  try {
    const backupData = {
      phienBan: "1.0",
      thoiGian: new Date().toISOString(),
      duLieu: {}
    };

    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (BACKUP_KEYS.includes(k) || k.includes('pending') || k.includes('phien_dodang') || k.includes('lich_su') || k.includes('msp_cache')) {
        backupData.duLieu[k] = localStorage.getItem(k);
        count++;
      }
    }

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const timeStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}h${pad(d.getMinutes())}`;
    const filename = `QuanLyKho_Backup_${timeStr}.json`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const msg = `Đã sao lưu thành công ${count} mục dữ liệu vào thư mục Download!`;
    if (typeof showCanhBao === "function") showCanhBao(msg);
    else alert(msg + `\nTên file: ${filename}`);
  } catch (err) {
    console.error("Lỗi sao lưu:", err);
    alert("Lỗi khi sao lưu dữ liệu: " + err.message);
  }
}
window.saoLuuDuLieuToanBo = saoLuuDuLieuToanBo;

function kichHoatPhucHoiDuLieu() {
  const fileInput = document.getElementById("input-phuc-hoi-du-lieu");
  if (fileInput) {
    fileInput.value = "";
    fileInput.click();
  }
}
window.kichHoatPhucHoiDuLieu = kichHoatPhucHoiDuLieu;

function xuLyFilePhucHoiDuLieu(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || !parsed.duLieu || typeof parsed.duLieu !== "object") {
        alert("File sao lưu không đúng định dạng!");
        return;
      }

      let restoredCount = 0;
      for (const [key, val] of Object.entries(parsed.duLieu)) {
        if (typeof val === "string") {
          localStorage.setItem(key, val);
          restoredCount++;
        }
      }

      const thongBao = `Đã phục hồi thành công ${restoredCount} mục dữ liệu!`;
      if (typeof showCanhBao === "function") showCanhBao(thongBao);
      alert(thongBao + "\nTrang sẽ tự động làm mới để đồng bộ dữ liệu.");
      window.location.reload();
    } catch (err) {
      alert("Lỗi đọc file phục hồi: " + err.message);
    }
  };
  reader.readAsText(file);
}
window.xuLyFilePhucHoiDuLieu = xuLyFilePhucHoiDuLieu;
