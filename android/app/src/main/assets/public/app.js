// ── Web App Core v20260809-ultra ──────────────────────────
const API = "https://script.google.com/macros/s/AKfycbzXjzccld3X04iJgIpEvKm01in0QT0i7tkjar_oJ6K5-sBGdm9xibe7Mu4UB3mWtha5-w/exec";

async function callAPI(body) {
  try {
    const res = await fetch(API, { method: "POST", body: JSON.stringify(body), redirect: "follow" });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (parseErr) {
      return { error: "Máy chủ phản hồi chậm hoặc gián đoạn (Timeout), vui lòng thử lại." };
    }
  } catch (err) {
    return { error: "Mất kết nối mạng, vui lòng thử lại." };
  }
}

let zxingReader = null;
let dangXuLy = false;

function formatKg(value) {
  const num = Number(value || 0);
  if (!Number.isInteger(num)) return String(Number(num.toFixed(3)));
  return String(num);
}

// ── Hàm nạp lười thư viện xuất Excel (chỉ tải khi bấm Xuất, giúp mở app tức thì) ──
function napThuVienXLSX(callback) {
  if (typeof XLSX !== "undefined") {
    if (callback) callback();
    return;
  }
  const script = document.createElement("script");
  script.src = "lib/xlsx.full.min.js";
  script.onload = () => {
    if (callback) callback();
  };
  script.onerror = () => {
    if (typeof showCanhBao === "function") showCanhBao("Không thể nạp thư viện xuất Excel. Vui lòng thử lại!", "error");
  };
  document.head.appendChild(script);
}
window.napThuVienXLSX = napThuVienXLSX;

// ── Hàm tiện ích Xuất File Excel dùng chung ─────────
function exportToExcel(filename, sheetName, dataArray) {
  if (!dataArray || dataArray.length === 0) {
    if (typeof showCanhBao === "function") showCanhBao("Không có dữ liệu để xuất file Excel!", "warning");
    return;
  }
  if (typeof XLSX === "undefined") {
    napThuVienXLSX(() => exportToExcel(filename, sheetName, dataArray));
    return;
  }
  try {
    const ws = XLSX.utils.json_to_sheet(dataArray);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || "Báo Cáo");
    const fullFileName = (filename || "BaoCaoKho") + ".xlsx";

    if (window.AndroidNative && typeof window.AndroidNative.saveFileToDownload === "function") {
      const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      const res = window.AndroidNative.saveFileToDownload(fullFileName, base64Data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      if (res && res.startsWith("OK")) {
        if (typeof moXacNhanApp === "function") {
          moXacNhanApp(
            `Đã lưu file Excel:\n${fullFileName}\nvào thư mục Download của điện thoại!\n\nBạn có muốn gửi file này qua Zalo hoặc mở bằng Excel không?`,
            () => {
              if (typeof window.AndroidNative.shareFile === "function") {
                window.AndroidNative.shareFile(fullFileName, base64Data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
              }
            },
            "Chia sẻ / Mở file",
            null,
            "Đóng",
            "Xuất Excel thành công"
          );
        } else if (typeof showCanhBao === "function") {
          showCanhBao("Đã lưu " + fullFileName + " vào Download!", "success");
        }
        return;
      }
    }

    XLSX.writeFile(wb, fullFileName);
  } catch (e) {
    if (typeof showCanhBao === "function") showCanhBao("Lỗi khi xuất file Excel: " + e.message, "error");
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

function phatVibrateNative(ms) {
  if (window.AndroidNative && typeof window.AndroidNative.vibrate === "function") {
    try { window.AndroidNative.vibrate(ms); return true; } catch (e) {}
  }
  return false;
}
window.phatVibrateNative = phatVibrateNative;

function phatTiengBip() {
  if (!phatVibrateNative(70) && navigator.vibrate) {
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
  if (!phatVibrateNative(90) && navigator.vibrate) {
    try { navigator.vibrate(90); } catch (e) { }
  }
}
window.phatVibrateSuccess = phatVibrateSuccess;

function phatVibrateError() {
  if (!phatVibrateNative(180) && navigator.vibrate) {
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
    let kg = 0, qc = "";

    // Tìm dòng chứa Quy cách và Số kg (ưu tiên tìm từ dòng thứ 3 trở đi)
    const dongQCKG = lines.slice(2).find(l => {
      const hasNumberAtEnd = /[\d.]+\s*$/.test(l);
      const hasIndicator = l.includes('/') || l.includes('Kg') || l.includes('kg') || l.includes('-');
      return hasNumberAtEnd && hasIndicator;
    }) || lines.find(l => l.includes("-") && /\d+/.test(l)) || "";

    if (dongQCKG) {
      const matchKG = dongQCKG.match(/([\d.]+)\s*$/);
      kg = matchKG ? parseFloat(matchKG[1]) : 0;

      // Ưu tiên trích xuất quy cách dạng 380/36, 150D/3 hoặc từ đầu tiên trước khoảng trắng/dấu ngoặc
      const matchSlash = dongQCKG.match(/\b([A-Za-z0-9]+[/][A-Za-z0-9]+)\b/);
      if (matchSlash) {
        qc = matchSlash[1].trim();
      } else if (matchKG && dongQCKG.includes("-")) {
        qc = dongQCKG.substring(0, dongQCKG.lastIndexOf(matchKG[0])).trim();
        if (qc.endsWith("-")) qc = qc.slice(0, -1).trim();
      } else {
        const matchFirst = dongQCKG.match(/^([^\s(]+)/);
        if (matchFirst) qc = matchFirst[1].replace(/[-]+$/, '').trim();
      }
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
  if (id !== "quetQR" && typeof dungQuet === "function") dungQuet();
  if (id !== "chiFor" && typeof dungCX1 === "function") dungCX1();
  if (id !== "kiemKe" && typeof dungKiemKe === "function") dungKiemKe();
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
  if (id !== "quetQR" && typeof dungQuet === "function") dungQuet();
  if (id !== "chiFor" && typeof dungCX1 === "function") dungCX1();
  if (id !== "kiemKe" && typeof dungKiemKe === "function") dungKiemKe();
  if (id !== "btpPage") {
    document.body.classList.remove("cam-active");
    if (typeof dungBTP === "function") dungBTP();
  }
  const page = document.getElementById(id);
  if (page) page.classList.add("active");
  if (id === "lichSuQuetQR" && typeof renderLichSuQR === "function") renderLichSuQR();
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

  // 1. Thoát app Android Native thông qua Bridge Interface
  if (window.AndroidNative && typeof window.AndroidNative.exitApp === "function") {
    try {
      window.AndroidNative.exitApp();
      return;
    } catch (e) {}
  }

  // 2. Thoát app thông qua Capacitor App Plugin
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App && typeof window.Capacitor.Plugins.App.exitApp === "function") {
    try {
      window.Capacitor.Plugins.App.exitApp();
      return;
    } catch (e) {}
  }

  // 3. Fallback cho Cordova / PhoneGap
  if (window.navigator && window.navigator.app && typeof window.navigator.app.exitApp === "function") {
    try {
      window.navigator.app.exitApp();
      return;
    } catch (e) {}
  }

  // 4. Trình duyệt Web
  try {
    window.close();
  } catch (e) { }
  setTimeout(() => {
    history.back();
  }, 50);
}

window.khongThoatApp = khongThoatApp;
window.xacNhanThoatApp = xacNhanThoatApp;
window.handleNativeBackButton = handlePopStateThoat;

function showLoading(show) {
  document.getElementById("overlay-loading").style.display = show ? "flex" : "none";
}



// ── Bộ Engine Quét QR Siêu Tốc & Quản Lý Camera Thông Minh ─────────────────
let animFrameMap = {};
const lastCameraCallbackMap = {};
const cameraSleepTimerMap = {};
const cameraSleepingMap = {};
const cameraWakingUpMap = {};
const CAMERA_IDLE_TIMEOUT_MS = 60000; // 60 giây không quét & không chạm -> tự ngủ để máy mát và tiết kiệm pin

// Lắng nghe tương tác người dùng 1 lần duy nhất ở cấp document (ngăn rò rỉ listener khi camera ngủ/thức nhiều lần)
function onGlobalCameraInteraction() {
  // 1. Nếu có camera của trang đang hiển thị đang ở chế độ ngủ -> Đánh thức ngay lập tức!
  for (const vid of ['reader', 'kk-reader', 'cx1-reader', 'btp-reader']) {
    if (cameraSleepingMap[vid]) {
      const pageMap = {
        'reader': 'quetQR',
        'kk-reader': 'kiemKe',
        'cx1-reader': 'chiFor',
        'btp-reader': 'btpPage'
      };
      const pageEl = document.getElementById(pageMap[vid]);
      if (pageEl && pageEl.classList.contains('active')) {
        danhThucCamera(vid);
        return;
      }
    }
  }

  // 2. Nếu camera đang thức -> gia hạn thêm 60 giây
  for (const vid in cameraSleepTimerMap) {
    if (cameraSleepTimerMap[vid]) {
      resetSleepTimerCamera(vid);
    }
  }
}
document.addEventListener("touchstart", onGlobalCameraInteraction, { passive: true });
document.addEventListener("click", onGlobalCameraInteraction);

function hienSleepOverlayCamera(videoId) {
  const videoEl = document.getElementById(videoId);
  const container = videoEl ? videoEl.parentElement : null;
  if (!container) return;

  cameraSleepingMap[videoId] = true;

  let overlay = document.getElementById(videoId + "-sleep-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = videoId + "-sleep-overlay";
    overlay.className = "cam-sleep-overlay";
    container.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="cam-sleep-card">
      <i class="ti ti-moon-stars" style="font-size:36px; color:var(--brass); margin-bottom:8px;"></i>
      <div style="font-weight:800; font-size:15px; color:var(--cream); margin-bottom:4px;">Camera đang tạm nghỉ</div>
      <div style="font-size:12px; color:var(--cream-soft); margin-bottom:12px;">Tạm ngắt cảm biến để máy mát & tiết kiệm pin</div>
      <div class="btn btn-blue" style="padding:6px 18px; font-size:13px; font-weight:700; border-radius:20px; display:inline-flex; align-items:center; gap:6px;">
        <i class="ti ti-hand-finger"></i> Chạm để quét tiếp
      </div>
    </div>
  `;

  // Bắt cả touchstart, pointerdown và click với preventDefault/stopPropagation để không bị hủy event trên mobile
  const handleWakeup = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    danhThucCamera(videoId);
  };

  overlay.onpointerdown = handleWakeup;
  overlay.ontouchstart = handleWakeup;
  overlay.onclick = handleWakeup;

  overlay.style.display = "flex";
}

function anSleepOverlayCamera(videoId) {
  const overlay = document.getElementById(videoId + "-sleep-overlay");
  if (overlay) {
    overlay.style.display = "none";
  }
}

function choCameraNgu(videoId) {
  const videoEl = document.getElementById(videoId);
  if (!videoEl || !videoEl.srcObject) return;

  cameraSleepingMap[videoId] = true;

  if (cameraSleepTimerMap[videoId]) {
    clearTimeout(cameraSleepTimerMap[videoId]);
    cameraSleepTimerMap[videoId] = null;
  }

  if (animFrameMap[videoId]) {
    clearTimeout(animFrameMap[videoId]);
    animFrameMap[videoId] = null;
  }

  // Giải phóng phần cứng camera để máy mát và tiết kiệm pin
  try {
    videoEl.srcObject.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
    videoEl.srcObject = null;
  } catch (e) {}

  hienSleepOverlayCamera(videoId);
}

async function danhThucCamera(videoId) {
  if (cameraWakingUpMap[videoId]) return;
  cameraWakingUpMap[videoId] = true;

  // Hiển thị trạng thái đang kết nối trên overlay để người dùng có phản hồi trực quan
  const overlay = document.getElementById(videoId + "-sleep-overlay");
  if (overlay) {
    overlay.innerHTML = `
      <div class="cam-sleep-card">
        <i class="ti ti-loader spin" style="font-size:36px; color:var(--brass); margin-bottom:8px;"></i>
        <div style="font-weight:800; font-size:15px; color:var(--cream); margin-bottom:4px;">Đang bật lại camera...</div>
        <div style="font-size:12px; color:var(--cream-soft);">Vui lòng chờ trong giây lát</div>
      </div>
    `;
    overlay.style.display = "flex";
  }

  try {
    let cb = lastCameraCallbackMap[videoId];
    if (!cb) {
      if (videoId === 'reader') {
        cb = (txt) => { if (txt && window.dangQuetQR && typeof window.khiQuetDuocMaQR === 'function') window.khiQuetDuocMaQR({ getText: () => txt }); };
      } else if (videoId === 'cx1-reader') {
        cb = (txt) => { if (txt && window.dangQuetCX1 && typeof window.khiQuetDuocMa === 'function') window.khiQuetDuocMa({ getText: () => txt }); };
      } else if (videoId === 'btp-reader') {
        cb = (txt) => { if (txt && window.dangQuetBTP && typeof window.khiQuetDuocMaBTP === 'function') window.khiQuetDuocMaBTP({ getText: () => txt }); };
      }
    }

    await khoiPhucCamera(videoId, cb);
    cameraSleepingMap[videoId] = false;
    anSleepOverlayCamera(videoId);
    resetSleepTimerCamera(videoId);
  } catch (err) {
    console.error("Lỗi đánh thức camera:", err);
    if (overlay) {
      overlay.innerHTML = `
        <div class="cam-sleep-card">
          <i class="ti ti-alert-triangle" style="font-size:36px; color:var(--red); margin-bottom:8px;"></i>
          <div style="font-weight:800; font-size:15px; color:var(--cream); margin-bottom:4px;">Không thể bật camera</div>
          <div style="font-size:12px; color:var(--cream-soft); margin-bottom:12px;">Chạm vào đây để thử lại</div>
          <div class="btn btn-blue" style="padding:6px 18px; font-size:13px; font-weight:700; border-radius:20px;">
            <i class="ti ti-reload"></i> Thử lại
          </div>
        </div>
      `;
    }
  } finally {
    cameraWakingUpMap[videoId] = false;
  }
}
window.danhThucCamera = danhThucCamera;

function resetSleepTimerCamera(videoId) {
  if (cameraSleepTimerMap[videoId]) {
    clearTimeout(cameraSleepTimerMap[videoId]);
    cameraSleepTimerMap[videoId] = null;
  }
  cameraSleepingMap[videoId] = false;
  anSleepOverlayCamera(videoId);

  cameraSleepTimerMap[videoId] = setTimeout(() => {
    choCameraNgu(videoId);
  }, CAMERA_IDLE_TIMEOUT_MS);
}
window.resetSleepTimerCamera = resetSleepTimerCamera;

let danhSachCameraSau = [];
let idCameraUuTien = null;
try { idCameraUuTien = localStorage.getItem('camera_uu_tien') || null; } catch (e) {}

// Hàm nhận diện chính xác Camera 0 (Sony IMX586 48MP AF chính)
function timCamera0(devices) {
  if (!devices || devices.length === 0) return null;
  const videoInputs = devices.filter(d => d.kind === 'videoinput');
  
  // 1. Tìm camera có nhãn camera2 0 hoặc số 0 và facing back / sau
  let cam0 = videoInputs.find(d => {
    const lbl = (d.label || '').toLowerCase();
    if (!lbl) return false;
    if (lbl.includes('front') || lbl.includes('truoc') || lbl.includes('selfie') || lbl.includes('user')) return false;
    return /camera2?\s*0\b/i.test(lbl) || (lbl.includes('facing back') && /\b0\b/.test(lbl));
  });
  if (cam0 && cam0.deviceId) return cam0;

  // 2. Tìm camera có nhãn chứa '0' bất kỳ nhưng không phải camera trước
  cam0 = videoInputs.find(d => {
    const lbl = (d.label || '').toLowerCase();
    if (!lbl) return false;
    if (lbl.includes('front') || lbl.includes('truoc') || lbl.includes('selfie') || lbl.includes('user')) return false;
    return /\b0\b/.test(lbl);
  });
  if (cam0 && cam0.deviceId) return cam0;

  // 3. Tìm bất kỳ camera sau nào (facing back / sau)
  const backCam = videoInputs.find(d => {
    const lbl = (d.label || '').toLowerCase();
    if (!lbl) return false;
    if (lbl.includes('front') || lbl.includes('truoc') || lbl.includes('selfie') || lbl.includes('user')) return false;
    return lbl.includes('back') || lbl.includes('sau') || lbl.includes('environment');
  });
  if (backCam && backCam.deviceId) return backCam;

  return null;
}

// Hàm quét & sắp xếp danh sách camera sau phần cứng
async function quetDanhSachCameraSau() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(d => d.kind === 'videoinput');
    if (videoInputs.length === 0) return [];

    // Ưu tiên cao nhất: Tìm thấy Camera 0 chính xác
    const cam0 = timCamera0(videoInputs);
    if (cam0) {
      danhSachCameraSau = [cam0];
      return [cam0];
    }

    // Lọc camera sau (loại bỏ triệt để camera trước pop-up trên K20 Pro)
    let backCams = videoInputs.filter(d => {
      const lbl = (d.label || '').toLowerCase();
      if (!lbl) return true;
      if (lbl.includes('front') || lbl.includes('truoc') || lbl.includes('selfie') || lbl.includes('user') || lbl.includes('camera2 1') || lbl.includes('camera 1') || lbl.includes('facing front')) return false;
      return true;
    });

    danhSachCameraSau = backCams;
    return backCams;
  } catch (e) {
    console.warn("Lỗi enumerateDevices:", e);
    return [];
  }
}

// Hàm nhận diện + mở đúng camera sau Sony 48MP AF, không bao giờ để lọt camera trước
async function moLuongCameraDungHuong() {
  const laCameraTruoc = (lbl) => {
    lbl = (lbl || '').toLowerCase();
    return lbl.includes('front') || lbl.includes('truoc') || lbl.includes('selfie') || lbl.includes('user') || lbl.includes('camera2 1') || lbl.includes('camera 1') || lbl.includes('facing front');
  };

  // 0. MỞ SIÊU TỐC (~200ms): Nếu đã nhận diện và lưu Camera 0 từ trước, mở thẳng trực tiếp
  if (idCameraUuTien) {
    try {
      const fastStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: idCameraUuTien },
          width: { ideal: 1280 },
          height: { ideal: 960 },
          frameRate: { ideal: 24, max: 30 }
        }
      });
      const track = fastStream.getVideoTracks()[0];
      if (!laCameraTruoc(track && track.label)) {
        return fastStream;
      }
      fastStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
    } catch (eFast) {
      // Nếu deviceId không còn khớp, tiếp tục quy trình nhận diện bên dưới
    }
  }

  let devices = await navigator.mediaDevices.enumerateDevices();
  let videoInputs = devices.filter(d => d.kind === 'videoinput');

  // 1. Nếu chưa có quyền (nhãn rỗng hoặc danh sách rỗng) -> mở luồng camera sau để lấy nhãn thật
  // Tuyệt đối không dùng { video: true } để tránh kích hoạt motor camera trước thò thụt trên K20 Pro
  const chuaCoLabel = videoInputs.length === 0 || videoInputs.every(d => !d.label);
  let activeStream = null;

  if (chuaCoLabel) {
    try {
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 960 },
          frameRate: { ideal: 24, max: 30 }
        }
      };
      if (videoInputs.length > 0 && videoInputs[0] && videoInputs[0].deviceId) {
        constraints.video.deviceId = { ideal: videoInputs[0].deviceId };
      }
      activeStream = await navigator.mediaDevices.getUserMedia(constraints);
      devices = await navigator.mediaDevices.enumerateDevices();
      videoInputs = devices.filter(d => d.kind === 'videoinput');
    } catch (e) {
      activeStream = null;
    }
  }

  // 2. Tìm Camera 0 chính xác (Sony IMX586 48MP AF)
  const cam0 = timCamera0(videoInputs);

  // Nếu luồng activeStream ở trên đã mở thành công và là camera sau -> DÙNG LUÔN, TUYỆT ĐỐI KHÔNG STOP!
  // Việc stop stream vừa mở sẽ khóa cảm biến trong HAL 300ms, dẫn đến mở nhầm sang camera trước gây lỗi calibrate motor
  if (activeStream) {
    const track = activeStream.getVideoTracks()[0];
    const trackLbl = (track && track.label) ? track.label.toLowerCase() : '';
    if (!laCameraTruoc(trackLbl)) {
      return activeStream;
    }
    // Chỉ stop nếu lỡ là camera trước
    activeStream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
    activeStream = null;
  }

  // 3. Lập danh sách ứng viên (Camera 0 đứng đầu, tiếp theo là các camera sau khác)
  const backCams = videoInputs.filter(d => !laCameraTruoc(d.label));
  const ungVien = [];
  if (cam0 && cam0.deviceId) ungVien.push(cam0.deviceId);
  if (idCameraUuTien && !ungVien.includes(idCameraUuTien)) ungVien.push(idCameraUuTien);
  for (const d of backCams) {
    if (d.deviceId && !ungVien.includes(d.deviceId)) {
      ungVien.push(d.deviceId);
    }
  }

  // 4. Thử lần lượt từng camera sau bằng deviceId cụ thể
  for (const id of ungVien) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: id },
          width: { ideal: 1280 },
          height: { ideal: 960 },
          frameRate: { ideal: 24, max: 30 }
        }
      });
      const track = stream.getVideoTracks()[0];
      if (!laCameraTruoc(track && track.label)) return stream;
      stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
    } catch (e) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { ideal: id },
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 960 },
            frameRate: { ideal: 24, max: 30 }
          }
        });
        const track = stream.getVideoTracks()[0];
        if (!laCameraTruoc(track && track.label)) return stream;
        stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
      } catch (e2) {}
    }
  }

  // 5. Fallback cuối cùng: facingMode ideal environment (ưu tiên deviceId của Camera 0)
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: (cam0 && cam0.deviceId) ? { ideal: cam0.deviceId } : undefined,
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 960 },
        frameRate: { ideal: 24, max: 30 }
      }
    });
    const track = stream.getVideoTracks()[0];
    if (!laCameraTruoc(track && track.label)) return stream;
    stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
  } catch (e) {}

  return null;
}
const layCameraStream = moLuongCameraDungHuong;

// Bật chế độ tự động lấy nét liên tục (Continuous Autofocus)
async function batContinuousAutofocus(stream) {
  // Không gọi track.applyConstraints() vì gây xung đột và crash Camera HAL trên Snapdragon 855
  // Android Camera2 đã tự động kích hoạt Continuous Picture AF ở tầng phần cứng
  return;
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

  let stream = null;
  try {
    stream = await moLuongCameraDungHuong();

    if (!stream) {
      console.warn("Không lấy được luồng camera sau!");
      return null;
    }

    // Ghi nhớ Camera 0 trong phiên hiện tại để lần sau mở nhanh
    navigator.mediaDevices.enumerateDevices().then(devList => {
      const exactCam0 = timCamera0(devList);
      if (exactCam0 && exactCam0.deviceId) {
        idCameraUuTien = exactCam0.deviceId;
      }
    }).catch(() => {});

    videoEl.muted = true;
    videoEl.defaultMuted = true;
    videoEl.playsInline = true;
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');
    videoEl.setAttribute('autoplay', '');
    videoEl.srcObject = stream;

    try {
      const playPromise = videoEl.play();
      if (playPromise && typeof playPromise.then === 'function') {
        await playPromise;
      }
    } catch (ePlay) {
      console.warn("video.play() notice:", ePlay);
      setTimeout(() => {
        if (videoEl && videoEl.srcObject && videoEl.paused) {
          videoEl.play().catch(() => {});
        }
      }, 100);
    }
    if (window.AndroidNative && typeof window.AndroidNative.setKeepScreenOn === "function") {
      try { window.AndroidNative.setKeepScreenOn(true); } catch (e) {}
    }

    // Cơ chế chống kẹt khung play & Reset Sleep Timer khi người dùng chạm vào màn hình
    const onUserInteraction = () => {
      if (cameraSleepingMap[videoId]) {
        danhThucCamera(videoId);
        return;
      }
      if (videoEl && videoEl.srcObject && videoEl.paused) {
        videoEl.play().catch(() => {});
      }
      resetSleepTimerCamera(videoId);
    };
    videoEl.onclick = onUserInteraction;
    videoEl.ontouchstart = onUserInteraction;
    if (videoEl.parentElement) {
      videoEl.parentElement.onclick = onUserInteraction;
      videoEl.parentElement.ontouchstart = onUserInteraction;
    }

    // Kích hoạt Continuous Autofocus
    await batContinuousAutofocus(stream);

    // Cập nhật nút đổi camera trên viewfinder (ẩn triệt để)
    capNhatNutDoiCamera(videoEl);
  } catch (e) {
    console.warn("getUserMedia camera stream notice:", e);
  }

  // 2. Vòng lặp giải mã QR hiệu năng cao: Native BarcodeDetector (Ưu tiên số 1) + Fallback ZXing Canvas thu nhỏ
  let nativeDetector = null;
  if ('BarcodeDetector' in window) {
    try {
      nativeDetector = new BarcodeDetector({ formats: ['qr_code'] });
    } catch (e) {
      nativeDetector = null;
    }
  }

  // Khởi tạo lười (lazy) ZXing & Canvas thu nhỏ, chỉ tạo khi máy thực sự không hỗ trợ BarcodeDetector
  let zxingReader = null;
  let zxCanvas = null;
  let zxCtx = null;

  let isScanning = true;
  let isDecoding = false;

  const quetKhungHinh = async () => {
    if (!isScanning || !videoEl.srcObject || videoEl.ended) return;

    if (videoEl.paused) {
      try { videoEl.play().catch(() => {}); } catch (e) {}
      if (videoEl.paused) {
        if (isScanning && videoEl.srcObject) {
          animFrameMap[videoId] = setTimeout(quetKhungHinh, 200);
        }
        return;
      }
    }

    if (!isDecoding && videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
      isDecoding = true;
      let qrText = null;

      // ── ƯU TIÊN 1: Native BarcodeDetector (Tốc độ phần cứng GPU/NPU < 5ms, 0% tải CPU) ──
      if (nativeDetector) {
        try {
          const codes = await nativeDetector.detect(videoEl);
          if (codes && codes.length > 0 && codes[0].rawValue) {
            qrText = codes[0].rawValue;
          }
        } catch (eNative) {
          nativeDetector = null; // Nếu phần cứng gặp lỗi thì mới cho fallback sang ZXing
        }
      }

      // ── ƯU TIÊN 2: CHỈ CHẠY ZXING KHI MÁY HOÀN TOÀN KHÔNG CÓ BarcodeDetector ──
      // Triệt tiêu 100% bug chạy kép song song cả 2 bộ giải mã gây nóng máy và tụt pin
      if (!qrText && !nativeDetector && videoEl.readyState >= 2) {
        try {
          if (!zxingReader) {
            zxingReader = new ZXing.BrowserQRCodeReader();
          }
          if (!zxCanvas) {
            zxCanvas = document.createElement('canvas');
            zxCanvas.width = 480;
            zxCanvas.height = 360; // Tỉ lệ chuẩn 4:3, chỉ 172K pixel thay vì 1.23M pixel (giảm 86% tải CPU)
            zxCtx = zxCanvas.getContext('2d', { willReadFrequently: true });
          }
          zxCtx.drawImage(videoEl, 0, 0, 480, 360);
          const res = zxingReader.decodeFromCanvas(zxCanvas);
          if (res && res.getText()) {
            qrText = res.getText();
          }
        } catch (eZxing) { }
      }

      if (qrText) {
        try {
          resetSleepTimerCamera(videoId); // Reset timer 60s khi quét thành công
          onDecodedCallback(qrText);
        } catch (eCb) {
          console.warn("Callback error:", eCb);
        }
      }

      isDecoding = false;
    }

    if (isScanning && videoEl.srcObject) {
      // Nhịp quét 125ms (~8 khung hình/giây):
      // - Với BarcodeDetector: Xử lý chỉ mất 3-5ms, CPU nghỉ hơn 120ms (nhàn rỗi >95%).
      // - Với ZXing canvas 480x360: Xử lý chỉ mất ~15ms, CPU nghỉ hơn 110ms.
      // -> Đảm bảo máy mát rượi, pin dùng cả ngày, bắt mã tức thì không trễ 1 giây nào.
      animFrameMap[videoId] = setTimeout(quetKhungHinh, 125);
    }
  };

  animFrameMap[videoId] = setTimeout(quetKhungHinh, 125);
  resetSleepTimerCamera(videoId); // Kích hoạt bộ đếm 60s khi bắt đầu phiên quét

  return {
    reset: () => {
      isScanning = false;
      if (animFrameMap[videoId]) {
        clearTimeout(animFrameMap[videoId]);
        animFrameMap[videoId] = null;
      }
      if (cameraSleepTimerMap[videoId]) {
        clearTimeout(cameraSleepTimerMap[videoId]);
        cameraSleepTimerMap[videoId] = null;
      }
      anSleepOverlayCamera(videoId);
      if (zxingReader) {
        try { zxingReader.reset(); } catch (e) {}
      }
      zxCanvas = null;
      zxCtx = null;
    }
  };
}

function dungCameraFast(videoId, zxingReaderObj) {
  cameraSleepingMap[videoId] = false;
  cameraWakingUpMap[videoId] = false;
  if (cameraSleepTimerMap[videoId]) {
    clearTimeout(cameraSleepTimerMap[videoId]);
    cameraSleepTimerMap[videoId] = null;
  }
  anSleepOverlayCamera(videoId);

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
  if (window.AndroidNative && typeof window.AndroidNative.setKeepScreenOn === "function") {
    try { window.AndroidNative.setKeepScreenOn(false); } catch (e) {}
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

  const cardQR = document.getElementById("phien-dodang-card-quetqr");
  const noidungQR = document.getElementById("phien-dodang-noidung-quetqr");
  if (cardQR && noidungQR) {
    let stateQR = null;
    try { stateQR = JSON.parse(localStorage.getItem("quetqr_phien_dodang")); } catch (e) { }

    if (stateQR && Array.isArray(stateQR.phienQuetQR) && stateQR.phienQuetQR.length > 0) {
      const gioCapNhatQR = stateQR.capNhat
        ? new Date(stateQR.capNhat).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
        : "—";
      noidungQR.innerHTML = `
        <div class="tk-card-header" style="margin-bottom:10px">
          <div>
            <div class="tk-card-ten">Quét QR (${stateQR.loaiQuetQR || 'Giao dịch'})</div>
            <div class="tk-card-msp">Cập nhật: <span>${gioCapNhatQR}</span></div>
          </div>
          <div class="tk-badge tk-badge-thuong">Dở dang</div>
        </div>
        <div class="tk-stat-grid">
          <div class="tk-stat-box">
            <div class="tk-stat-label">NGÀY</div>
            <div class="tk-stat-val" style="font-size:14px;color:var(--cream)">${stateQR.ngayQuetQR || "—"}</div>
          </div>
          <div class="tk-stat-box highlight">
            <div class="tk-stat-label">ĐÃ QUÉT</div>
            <div class="tk-stat-val main-ton">${stateQR.phienQuetQR.length} <small>bao</small></div>
          </div>
        </div>
      `;
      cardQR.style.display = "block";
    } else {
      cardQR.style.display = "none";
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

  if (loai === "quetqr") {
    if (typeof window.renderLichSuQR === "function") window.renderLichSuQR();
    if (typeof window.chuyenTrangKhongNav === "function") window.chuyenTrangKhongNav("lichSuQuetQR");
  } else if (loai === "btp") {
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

window.chuyenTrang = chuyenTrang;
window.chuyenTrangKhongNav = chuyenTrangKhongNav;

// ── Trạng thái mạng & Bộ máy đồng bộ tập trung toàn bộ module ──────
function demPendingMang() {
  let tong = 0;
  try { tong += JSON.parse(localStorage.getItem(APP_PENDING_KEY) || "[]").length; } catch (e) { }
  try { tong += JSON.parse(localStorage.getItem("quetqr_pending_saves") || "[]").length; } catch (e) { }
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

    // 6. Đồng bộ Quét QR (quetqr.js)
    try {
      const pendingQQR = JSON.parse(localStorage.getItem("quetqr_pending_saves") || "[]");
      if (pendingQQR.length > 0 && typeof callAPI === "function") {
        const remainingQQR = [];
        for (const item of pendingQQR) {
          try {
            const r = await callAPI({
              action: "luuGiaoDich",
              id: item.id,
              msp: item.msp,
              ten: item.qc || item.msp,
              mau: item.qc || "—",
              ngay: item.ngay,
              loai: item.loai,
              kg: item.kg
            });
            if (r && r.error) remainingQQR.push(item);
          } catch (e) { remainingQQR.push(item); }
        }
        localStorage.setItem("quetqr_pending_saves", JSON.stringify(remainingQQR));
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
setInterval(capNhatTrangThaiMang, 12000);
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

// ── Modal Nhập Liệu App (thay thế window.prompt 100%) ───────────────
let _appPromptCallbackOk = null;
function moPromptApp(tieuDe, noiDung, giaTriMacDinh, callbackOk, placeholder) {
  const overlay = document.getElementById("app-overlay-prompt");
  if (!overlay) return;
  const elTieude = document.getElementById("app-prompt-tieude");
  const elNoidung = document.getElementById("app-prompt-noidung");
  const elInput = document.getElementById("app-prompt-input");

  if (elTieude) elTieude.textContent = tieuDe || "Nhập thông tin";
  if (elNoidung) elNoidung.textContent = noiDung || "";
  if (elInput) {
    elInput.value = (giaTriMacDinh !== undefined && giaTriMacDinh !== null) ? giaTriMacDinh : "";
    if (placeholder) elInput.placeholder = placeholder;
  }
  _appPromptCallbackOk = callbackOk || null;
  overlay.classList.add("show");
  setTimeout(() => { if (elInput) elInput.focus(); }, 120);
}
window.moPromptApp = moPromptApp;

function dongPromptApp(dongY) {
  const overlay = document.getElementById("app-overlay-prompt");
  if (overlay) overlay.classList.remove("show");
  const elInput = document.getElementById("app-prompt-input");
  const cb = _appPromptCallbackOk;
  _appPromptCallbackOk = null;
  if (dongY && cb && elInput) {
    cb(elInput.value);
  }
}
window.dongPromptApp = dongPromptApp;

// Chốt chặn an toàn: Tuyệt đối không để bật popup alert web mặc định
window.alert = function(msg) {
  if (typeof showCanhBao === "function") {
    showCanhBao(String(msg));
  } else {
    console.warn("ALERT INTERCEPTED:", msg);
  }
};

// ── Hàm khôi phục sạch luồng camera và khởi động lại vòng lặp quét ──
async function khoiPhucCamera(videoId, fallbackCb) {
  const videoEl = document.getElementById(videoId);
  if (!videoEl) return;
  const cb = lastCameraCallbackMap[videoId] || fallbackCb;
  if (!cb) return;

  // 1. Chỉ dừng luồng cũ nếu nó còn đang chạy (nếu đã sleep thì srcObject đã là null)
  if (videoEl.srcObject) {
    dungCameraFast(videoId, null);
    await new Promise(r => setTimeout(r, 200));
  }

  // 2. Khởi tạo lại camera và kích hoạt lại vòng lặp quét mới
  const reader = await khoiTaoCameraFast(videoId, cb);
  if (videoId === 'reader') window.zxingReaderQR = reader;
  else if (videoId === 'cx1-reader') window.zxingReaderCX1 = reader;
  else if (videoId === 'btp-reader') window.zxingReaderBTP = reader;
  else if (videoId === 'kk-reader') window.zxingReaderKK = reader;
  return reader;
}

// ── Tự động quản lý vòng đời Camera khi ẩn/mở lại app (Triệt tiêu 100% hiện tượng đứng hình) ──
let resumeCameraTimer = null;
function triggerResumeCamera() {
  clearTimeout(resumeCameraTimer);
  resumeCameraTimer = setTimeout(async () => {
    const camBoxes = [
      { pageId: 'quetQR', vid: 'reader', box: 'cam-box', fallback: (txt) => { if (txt && window.dangQuetQR && typeof window.khiQuetDuocMaQR === 'function') window.khiQuetDuocMaQR({ getText: () => txt }); } },
      { pageId: 'kiemKe', vid: 'kk-reader', box: 'kk-cam', fallback: (txt) => { if (typeof xuLyMaKiemKe === 'function') xuLyMaKiemKe(txt); } },
      { pageId: 'chiFor', vid: 'cx1-reader', box: 'cx1-cam', fallback: (txt) => { if (txt && window.dangQuetCX1 && typeof window.khiQuetDuocMa === 'function') window.khiQuetDuocMa({ getText: () => txt }); } },
      { pageId: 'btpPage', vid: 'btp-reader', box: 'btp-cam', fallback: (txt) => { if (txt && window.dangQuetBTP && typeof window.khiQuetDuocMaBTP === 'function') window.khiQuetDuocMaBTP({ getText: () => txt }); } }
    ];

    for (const item of camBoxes) {
      const pageEl = document.getElementById(item.pageId);
      const boxEl = document.getElementById(item.box);
      const videoEl = document.getElementById(item.vid);

      // CHỈ khôi phục camera KHI VÀ CHỈ KHI:
      // 1. Trang chứa camera đó đang thực sự hiển thị (.active)
      // 2. Khung ngắm camera đang mở (style.display !== 'none')
      // 3. Phần tử video tồn tại
      const isPageActive = pageEl && pageEl.classList.contains('active');
      const isBoxVisible = boxEl && boxEl.style.display !== 'none' && window.getComputedStyle(boxEl).display !== 'none';

      if (isPageActive && isBoxVisible && videoEl) {
        // Luôn khôi phục lại luồng camera mới tinh để không bao giờ bị đứng hình sau khi ẩn app
        await khoiPhucCamera(item.vid, item.fallback);
      }
    }
  }, 250);
}

function ngatTatCaCamera() {
  const vids = ['reader', 'kk-reader', 'cx1-reader', 'btp-reader'];
  for (const id of vids) {
    if (cameraSleepTimerMap[id]) {
      clearTimeout(cameraSleepTimerMap[id]);
      cameraSleepTimerMap[id] = null;
    }
    anSleepOverlayCamera(id);
    const videoEl = document.getElementById(id);
    if (videoEl && videoEl.srcObject) {
      try {
        videoEl.srcObject.getTracks().forEach(t => {
          try { t.stop(); } catch (e) {}
        });
        videoEl.srcObject = null;
      } catch (e) {}
    }
  }
}
window.ngatTatCaCamera = ngatTatCaCamera;

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // 1. Khi ẩn app hoặc tắt màn hình: Chủ động ngắt sạch phần cứng camera để giải phóng cảm biến cho hệ thống
    ngatTatCaCamera();
  } else if (document.visibilityState === 'visible') {
    // 2. Khi quay lại app: Tự động khởi động lại luồng camera mới ngay lập tức
    triggerResumeCamera();
  }
});
window.addEventListener('pagehide', ngatTatCaCamera);

// ── Hệ Thống Sao Lưu & Phục Hồi Dữ Liệu An Toàn ───────────────────
const BACKUP_KEYS = [
  "app_pending_saves",
  "quetqr_phien_dodang",
  "quetqr_pending_saves",
  "quetqr_lichsu",
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

function chuoiSangBase64Utf8(str) {
  try {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin);
  } catch (e) {
    return btoa(unescape(encodeURIComponent(str)));
  }
}

async function saoLuuDuLieuToanBo() {
  try {
    const backupData = {
      phienBan: "1.0",
      loai: "auto_backup",
      thoiGian: new Date().toISOString(),
      duLieu: {}
    };

    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (BACKUP_KEYS.includes(k) || k.includes('pending') || k.includes('phien_dodang') || k.includes('lich_su') || k.includes('msp_cache') || k.includes('cx1') || k.includes('cx5') || k.includes('btp') || k.includes('kk')) {
        backupData.duLieu[k] = localStorage.getItem(k);
        count++;
      }
    }

    if (count === 0) {
      if (typeof showCanhBao === "function") showCanhBao("Chưa có dữ liệu nào để sao lưu!", "warning");
      return;
    }

    const jsonStr = JSON.stringify(backupData, null, 2);
    const filename = "QuanLyKho_AutoBackup.json";
    const base64Data = chuoiSangBase64Utf8(jsonStr);

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const thoiGianHienThi = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

    // Lưu lại mốc sao lưu
    const currentHash = tinhMaBam(JSON.stringify(backupData.duLieu));
    localStorage.setItem("last_auto_backup_hash", currentHash);
    localStorage.setItem("last_auto_backup_time", thoiGianHienThi);
    if (typeof capNhatChiBaoAutoBackup === "function") {
      capNhatChiBaoAutoBackup(`💾 Tự động sao lưu: ${thoiGianHienThi}`, "success");
    }

    // 1. Nếu đang chạy trên Android APK (qua cầu nối AndroidNative)
    if (window.AndroidNative && typeof window.AndroidNative.saveFileToDownload === "function") {
      const res = window.AndroidNative.saveFileToDownload(filename, base64Data, "application/json");
      if (res && res.startsWith("OK")) {
        const msg = `Đã cập nhật và GHI ĐÈ bản sao lưu mới nhất (${count} mục) vào thư mục Download của điện thoại!\n\nTên file:\n${filename}\n\nBạn có muốn chia sẻ file này qua Zalo để lưu trữ thêm không?`;
        if (typeof moXacNhanApp === "function") {
          moXacNhanApp(
            msg,
            () => {
              if (typeof window.AndroidNative.shareFile === "function") {
                window.AndroidNative.shareFile(filename, base64Data, "application/json");
              }
            },
            "Chia sẻ qua Zalo",
            null,
            "Đóng",
            "Sao lưu thành công"
          );
        } else if (typeof showCanhBao === "function") {
          showCanhBao(`Đã ghi đè ${filename} vào thư mục Download!`, "success");
        }
        return;
      }
    }

    // 2. Fallback cho Web Desktop Browser
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const msg = `Đã sao lưu thành công ${count} mục dữ liệu (${filename})!`;
    if (typeof showCanhBao === "function") showCanhBao(msg, "success");
  } catch (err) {
    console.error("Lỗi sao lưu:", err);
    if (typeof showCanhBao === "function") showCanhBao("Lỗi khi sao lưu dữ liệu: " + err.message, "error");
  }
}
window.saoLuuDuLieuToanBo = saoLuuDuLieuToanBo;

function kichHoatPhucHoiDuLieu() {
  if (typeof chuyenTrangKhongNav === "function") {
    chuyenTrangKhongNav("trangPhucHoi");
  }
}
window.kichHoatPhucHoiDuLieu = kichHoatPhucHoiDuLieu;

function kichHoatChonFilePhucHoi() {
  const fileInput = document.getElementById("input-phuc-hoi-du-lieu");
  if (fileInput) {
    fileInput.value = "";
    fileInput.click();
  }
}
window.kichHoatChonFilePhucHoi = kichHoatChonFilePhucHoi;

function xuLyFilePhucHoiDuLieu(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || !parsed.duLieu || typeof parsed.duLieu !== "object") {
        if (typeof showCanhBao === "function") showCanhBao("File sao lưu không đúng định dạng!", "error");
        return;
      }

      let restoredCount = 0;
      for (const [key, val] of Object.entries(parsed.duLieu)) {
        if (val !== null && val !== undefined) {
          const valToStore = typeof val === "string" ? val : JSON.stringify(val);
          localStorage.setItem(key, valToStore);
          restoredCount++;
        }
      }

      const thongBao = `Đã phục hồi thành công ${restoredCount} mục dữ liệu từ file (${file.name})! Đang nạp lại dữ liệu...`;
      if (typeof showCanhBao === "function") showCanhBao(thongBao, "success");
      setTimeout(() => {
        if (typeof capNhatTrangChu === "function") capNhatTrangChu();
        if (typeof chuyenTrangKhongNav === "function") chuyenTrangKhongNav("trangChu");
      }, 1000);
    } catch (err) {
      console.error("Lỗi phục hồi:", err);
      if (typeof showCanhBao === "function") showCanhBao("Lỗi khi phục hồi dữ liệu: " + err.message, "error");
    }
  };
  reader.readAsText(file);
}
window.xuLyFilePhucHoiDuLieu = xuLyFilePhucHoiDuLieu;

// ── Hàm định dạng giờ quét trùng chuẩn HH:mm:ss ─────────────────────────────
function dinhDangGioQuetTrung(tg) {
  if (!tg) {
    const now = new Date();
    return String(now.getHours()).padStart(2, '0') + ':' +
           String(now.getMinutes()).padStart(2, '0') + ':' +
           String(now.getSeconds()).padStart(2, '0');
  }
  if (typeof tg === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(tg.trim())) {
    return tg.trim();
  }
  const d = (tg instanceof Date) ? tg : new Date(tg);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return String(now.getHours()).padStart(2, '0') + ':' +
           String(now.getMinutes()).padStart(2, '0') + ':' +
           String(now.getSeconds()).padStart(2, '0');
  }
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return hh + ':' + mm + ':' + ss;
}
window.dinhDangGioQuetTrung = dinhDangGioQuetTrung;

// ── Hàm chuẩn hóa và rút gọn thông báo lỗi (chống tràn màn hình điện thoại) ──
function rutGonThongBaoLoi(msg) {
  if (msg == null) return "";
  let str = String(msg).trim();

  // 1. Nhận diện các lỗi HTML/JSON do Timeout proxy Google Apps Script (504, 502, 500)
  if (
    str.includes("Unexpected token") ||
    str.includes("<!DOCTYPE") ||
    str.includes("<html") ||
    str.includes("is not valid JSON") ||
    str.includes("JSON.parse") ||
    str.includes("SyntaxError")
  ) {
    return "Máy chủ phản hồi chậm hoặc gián đoạn (Timeout), vui lòng thử lại!";
  }

  // 2. Nhận diện lỗi mất kết nối mạng
  if (
    str.includes("Failed to fetch") ||
    str.includes("NetworkError") ||
    str.includes("Network request failed") ||
    str.includes("network error")
  ) {
    return "Mất kết nối Internet, vui lòng kiểm tra lại mạng!";
  }

  // 3. Nhận diện lỗi Camera
  if (str.includes("OverconstrainedError") || str.includes("NotReadableError")) {
    return "Camera đang bận hoặc không tương thích!";
  }

  // 4. Nếu thông báo vẫn quá dài (trên 75 ký tự), cắt gọn đẹp mắt
  if (str.length > 75) {
    return str.slice(0, 72) + "...";
  }

  return str;
}
window.rutGonThongBaoLoi = rutGonThongBaoLoi;

// ── Hàm hiển thị Popup Cảnh Báo chung (Đỏ 2s khi quét trùng/lỗi) ────────────
let timerCanhBaoGlobal = null;
function showCanhBao(text, type = "error") {
  const el = document.getElementById("canh-bao");
  if (!el) return;
  text = typeof rutGonThongBaoLoi === "function" ? rutGonThongBaoLoi(text) : text;
  el.textContent = text;
  if (type === "success") {
    el.style.background = "linear-gradient(135deg, #10b981, #059669)";
    el.style.boxShadow = "0 8px 24px rgba(16, 185, 129, .4)";
    el.style.border = "1px solid #34d399";
  } else if (type === "warning") {
    el.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
    el.style.boxShadow = "0 8px 24px rgba(245, 158, 11, .4)";
    el.style.border = "1px solid #fbbf24";
  } else {
    // Đỏ rực rỡ nổi bật
    el.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
    el.style.boxShadow = "0 8px 24px rgba(220, 38, 38, .5)";
    el.style.border = "1px solid #f87171";
  }
  el.style.color = "#ffffff";
  el.style.fontSize = "13.5px";
  el.style.fontWeight = "700";
  el.style.padding = "10px 18px";
  el.style.borderRadius = "14px";
  el.style.position = "fixed";
  el.style.top = "75px";
  el.style.left = "50%";
  el.style.transform = "translateX(-50%)";
  el.style.zIndex = "999999";
  el.style.whiteSpace = "normal";
  el.style.wordBreak = "break-word";
  el.style.overflowWrap = "break-word";
  el.style.maxWidth = "calc(100vw - 32px)";
  el.style.width = "max-content";
  el.style.boxSizing = "border-box";
  el.style.lineHeight = "1.4";
  el.style.textAlign = "center";
  el.style.display = "block";

  if (timerCanhBaoGlobal) clearTimeout(timerCanhBaoGlobal);
  timerCanhBaoGlobal = setTimeout(() => {
    if (el) el.style.display = "none";
  }, 2200);
}
window.showCanhBao = showCanhBao;

// =============================================================================
// ── MODULE HỘP ĐEN TỰ CHẨN ĐOÁN & TỰ BẮT LỖI TỰ ĐỘNG (BLACK BOX LOGGER) ──────
// =============================================================================
(function() {
  const HOP_DEN_MAX = 50;
  let hopDenLogs = [];
  let lastFrameTime = performance.now();
  let uiLagCount = 0;

  // Lấy bối cảnh thiết bị nhẹ nhàng không tốn CPU
  function layBoiCanhHeThong() {
    let trangHienTai = "unknown";
    try {
      const activePage = document.querySelector(".page.active");
      if (activePage) trangHienTai = activePage.id || "unknown";
    } catch (e) {}

    let boNho = "N/A";
    if (performance && performance.memory) {
      boNho = (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1) + "MB";
    }

    return {
      trang: trangHienTai,
      mang: navigator.onLine ? "Online" : "Offline",
      ram: boNho,
      thoiGian: new Date().toLocaleTimeString("vi-VN")
    };
  }

  // Hàm ghi log chính của Hộp Đen
  function hopDenGhiLog(loai, chiTiet) {
    try {
      const boiCanh = layBoiCanhHeThong();
      const item = {
        id: Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        thoiGian: boiCanh.thoiGian,
        loai: loai || "INFO",
        chiTiet: String(chiTiet || ""),
        trang: boiCanh.trang,
        mang: boiCanh.mang,
        ram: boNhoAnToan()
      };

      hopDenLogs.unshift(item);
      if (hopDenLogs.length > HOP_DEN_MAX) {
        hopDenLogs.pop();
      }

      // Tự động render nếu modal đang mở
      const modal = document.getElementById("modal-hop-den");
      if (modal && modal.style.display === "flex") {
        renderDanhSachLogHopDen();
      }
    } catch (err) {
      console.warn("[Hộp Đen] Lỗi ghi nhận log:", err);
    }
  }
  window.hopDenGhiLog = hopDenGhiLog;

  function boNhoAnToan() {
    try {
      if (performance && performance.memory) {
        return (performance.memory.usedJSHeapSize / 1048576).toFixed(1) + "MB";
      }
    } catch (e) {}
    return "N/A";
  }

  // ── 1. BẪY SẬP CODE & NGOẠI LỆ JAVASCRIPT (100% Tự Động) ───────────────────
  window.addEventListener("error", function(e) {
    const file = e.filename ? e.filename.split("/").pop() : "unknown";
    const line = e.lineno || 0;
    const msg = e.message || "Lỗi JavaScript không xác định";
    hopDenGhiLog("JS_ERR", `[${file}:${line}] ${msg}`);
  });

  window.addEventListener("unhandledrejection", function(e) {
    const reason = e.reason ? (e.reason.message || String(e.reason)) : "Promise rejected";
    hopDenGhiLog("PROMISE_ERR", `Lỗi bất đồng bộ: ${reason}`);
  });

  // Hook nhẹ console.error để ghi nhận lỗi từ thư viện
  const consoleErrorCu = console.error;
  console.error = function(...args) {
    try {
      const text = args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      if (!text.includes("[Hộp Đen]")) {
        hopDenGhiLog("CONSOLE_ERR", text.slice(0, 160));
      }
    } catch (e) {}
    consoleErrorCu.apply(console, args);
  };

  // ── 2. BẪY CAMERA ĐỨNG HÌNH / ĐEN MÀN HÌNH (Nhịp Tim Watchdog 2.5s) ────────
  let cameraWatchState = {};
  setInterval(function() {
    try {
      const videoSelectors = ["#reader", "#reader-x5", "#reader-cx1", "#reader-btp", "#reader-kk"];
      videoSelectors.forEach(sel => {
        const vid = document.querySelector(sel);
        if (!vid) return;

        // Chỉ kiểm tra khi video hoặc cha của nó đang hiển thị
        const isVisible = vid.offsetParent !== null && vid.style.display !== "none";
        if (!isVisible) {
          delete cameraWatchState[sel];
          return;
        }

        const state = cameraWatchState[sel] || { lastTime: -1, freezeCount: 0 };

        // Kiểm tra xem luồng camera có bị đóng bất ngờ không
        if (vid.srcObject) {
          const tracks = vid.srcObject.getVideoTracks();
          if (tracks.length > 0 && tracks[0].readyState === "ended") {
            hopDenGhiLog("CAM_TERMINATED", `Cảm biến camera (${sel}) bị hệ điều hành đóng ngầm`);
          }
        }

        // Kiểm tra khung hình đen 0x0
        if (!vid.paused && vid.readyState >= 2 && (vid.videoWidth === 0 || vid.videoHeight === 0)) {
          hopDenGhiLog("CAM_BLACK", `Camera (${sel}) đang chạy nhưng khung hình kích thước 0x0`);
        }

        // Kiểm tra đứng hình (currentTime không nhúc nhích)
        if (!vid.paused && vid.readyState >= 2) {
          if (vid.currentTime === state.lastTime && vid.currentTime > 0) {
            state.freezeCount = (state.freezeCount || 0) + 1;
            if (state.freezeCount === 2) { // 5s đứng yên
              hopDenGhiLog("CAM_FROZEN", `Camera (${sel}) bị đóng băng khung hình ở giây ${vid.currentTime.toFixed(1)}`);
            }
          } else {
            state.freezeCount = 0;
            state.lastTime = vid.currentTime;
          }
        }

        cameraWatchState[sel] = state;
      });
    } catch (err) {}
  }, 2500);

  // ── 3. BẪY ĐƠ MÁY & CHẠM KHÔNG ĂN (UI Lag Monitor) ─────────────────────────
  function doDoTreUI(now) {
    const delta = now - lastFrameTime;
    if (delta > 1200) { // Main thread bị nghẽn hơn 1.2 giây
      uiLagCount++;
      hopDenGhiLog("UI_ANR", `Giao diện bị đơ ${Math.round(delta)}ms do tác vụ nền quá tải`);
    }
    lastFrameTime = now;
    requestAnimationFrame(doDoTreUI);
  }
  requestAnimationFrame(doDoTreUI);

  // Bẫy chạm cảm ứng không phản hồi
  let lastTapTime = 0;
  let tapSpamCount = 0;
  let lastTapTarget = null;

  document.addEventListener("touchstart", function(e) {
    try {
      const now = Date.now();
      const target = e.target;

      if (target === lastTapTarget && (now - lastTapTime) < 600) {
        tapSpamCount++;
        if (tapSpamCount >= 3) {
          const tenNut = target.innerText ? target.innerText.trim().slice(0, 20) : target.tagName;
          hopDenGhiLog("TAP_SPAM", `Bấm liên tục 3 lần vào [${tenNut}] trong thời gian ngắn`);
          tapSpamCount = 0;
        }
      } else {
        tapSpamCount = 0;
      }
      lastTapTime = now;
      lastTapTarget = target;
    } catch (err) {}
  }, { passive: true });

  // ── GIAO DIỆN HỘP ĐEN & SAO CHÉP BÁO CÁO LỖI 1 CHẠM ────────────────────────
  function renderDanhSachLogHopDen() {
    const listEl = document.getElementById("hopden-log-list");
    if (!listEl) return;

    if (hopDenLogs.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px;">Hộp đen đang hoạt động ngầm. Chưa phát hiện sự cố nào!</div>';
      return;
    }

    let html = "";
    hopDenLogs.forEach(log => {
      let badgeClass = "badge-info";
      let badgeColor = "#3b82f6";
      if (log.loai.includes("ERR") || log.loai.includes("FROZEN") || log.loai.includes("TERMINATED")) {
        badgeClass = "badge-danger";
        badgeColor = "#ef4444";
      } else if (log.loai.includes("ANR") || log.loai.includes("SPAM") || log.loai.includes("BLACK")) {
        badgeClass = "badge-warning";
        badgeColor = "#f59e0b";
      }

      html += `
        <div style="background:var(--card-raised);border:1px solid var(--line-soft);border-radius:10px;padding:8px 10px;margin-bottom:8px;font-size:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="background:${badgeColor};color:#fff;font-weight:700;font-size:10px;padding:2px 6px;border-radius:4px;">${log.loai}</span>
            <span style="color:var(--cream-soft);font-size:11px;">${log.thoiGian} | Trang: ${log.trang}</span>
          </div>
          <div style="color:var(--cream);font-weight:500;word-break:break-word;">${log.chiTiet}</div>
        </div>
      `;
    });
    listEl.innerHTML = html;
  }
  window.renderDanhSachLogHopDen = renderDanhSachLogHopDen;

  function moModalHopDen() {
    const modal = document.getElementById("modal-hop-den");
    if (!modal) return;
    modal.style.display = "flex";

    // Cập nhật thông số hệ thống
    const statEl = document.getElementById("hopden-system-stats");
    if (statEl) {
      statEl.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;">
          <div>📡 Mạng: <b>${navigator.onLine ? "🟢 Có mạng" : "🔴 Mất mạng"}</b></div>
          <div>💾 RAM: <b>${boNhoAnToan()}</b></div>
          <div>📱 Thiết bị: <b>${navigator.userAgent.includes("Android") ? "Android" : "Web"}</b></div>
          <div>⏱️ Log ghi nhận: <b>${hopDenLogs.length} mục</b></div>
        </div>
      `;
    }
    renderDanhSachLogHopDen();
  }
  window.moModalHopDen = moModalHopDen;

  function dongModalHopDen() {
    const modal = document.getElementById("modal-hop-den");
    if (modal) modal.style.display = "none";
  }
  window.dongModalHopDen = dongModalHopDen;

  function saoChepBaoCaoHopDen() {
    try {
      const bc = layBoiCanhHeThong();
      const data = {
        thoiGianBaoCao: new Date().toISOString(),
        trangThai: bc,
        tongSoLog: hopDenLogs.length,
        nhatKySuCo: hopDenLogs
      };

      const text = "=== BÁO CÁO SỰ CỐ QUẢN LÝ KHO ===\n" +
                   `Thời gian: ${data.thoiGianBaoCao}\n` +
                   `Trang: ${bc.trang} | Mạng: ${bc.mang} | RAM: ${bc.ram}\n\n` +
                   "--- NHẬT KÝ CHI TIẾT ---\n" +
                   hopDenLogs.map(l => `[${l.thoiGian}] [${l.loai}] (Trang: ${l.trang}) ${l.chiTiet}`).join("\n");

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          showCanhBao("Đã sao chép Báo Cáo Lỗi vào bộ nhớ tạm!", "success");
        }).catch(() => fallbackCopy(text));
      } else {
        fallbackCopy(text);
      }
    } catch (err) {
      if (typeof showCanhBao === "function") showCanhBao("Lỗi sao chép: " + err.message, "error");
    }
  }
  window.saoChepBaoCaoHopDen = saoChepBaoCaoHopDen;

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showCanhBao("Đã sao chép Báo Cáo Lỗi vào bộ nhớ tạm!", "success");
  }

  function xoaSachLogHopDen() {
    hopDenLogs = [];
    renderDanhSachLogHopDen();
    showCanhBao("Đã xóa sạch nhật ký lỗi Hộp Đen!", "success");
  }
  window.xoaSachLogHopDen = xoaSachLogHopDen;

  // Ghi log khởi động ban đầu
  hopDenGhiLog("SYSTEM_BOOT", "Ứng dụng khởi động thành công");
})();

// =============================================================================
// ── MODULE TỰ ĐỘNG SAO LƯU ĐÁM MÂY KHI CÓ MẠNG HOẶC WI-FI (AUTO-BACKUP) ──────
// =============================================================================
(function() {
  let dangSaoLuuAuto = false;
  let timerDebounceAutoBackup = null;

  // Cập nhật nhãn trạng thái hiển thị trên giao diện
  function capNhatChiBaoAutoBackup(text, loai = "normal") {
    const el = document.getElementById("auto-backup-status");
    if (!el) return;
    el.textContent = text;
    if (loai === "success") {
      el.style.color = "var(--success)";
    } else if (loai === "warning") {
      el.style.color = "var(--warning)";
    } else {
      el.style.color = "var(--text-muted)";
    }
  }
  window.capNhatChiBaoAutoBackup = capNhatChiBaoAutoBackup;

  // Thu thập gói dữ liệu đầy đủ
  function thuThapGoiDuLieuSaoLuu() {
    const duLieu = {};
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (typeof BACKUP_KEYS !== "undefined" && (BACKUP_KEYS.includes(k) || k.includes('pending') || k.includes('phien_dodang') || k.includes('lich_su') || k.includes('msp_cache') || k.includes('cx1') || k.includes('cx5') || k.includes('btp') || k.includes('kk'))) {
        duLieu[k] = localStorage.getItem(k);
        count++;
      }
    }
    return { duLieu, count };
  }

  // Hàm tính mã băm chuỗi đơn giản để làm Delta Check
  function tinhMaBam(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return String(hash);
  }

  // Hàm chính: Thực hiện Auto-Backup thông minh ghi đè máy
  async function thucHienAutoBackup(lyDo = "auto") {
    if (dangSaoLuuAuto) return;

    try {
      dangSaoLuuAuto = true;

      const { duLieu, count } = thuThapGoiDuLieuSaoLuu();
      if (count === 0) {
        dangSaoLuuAuto = false;
        return;
      }

      const jsonStr = JSON.stringify(duLieu);
      const currentHash = tinhMaBam(jsonStr);
      const lastHash = localStorage.getItem("last_auto_backup_hash");

      // ── DELTA CHECK: Nếu không có dữ liệu mới so với lần trước thì bỏ qua
      if (currentHash === lastHash && lyDo !== "force") {
        const lastTime = localStorage.getItem("last_auto_backup_time") || "Gần đây";
        capNhatChiBaoAutoBackup(`💾 Tự động sao lưu: ${lastTime} (Toàn vẹn)`, "success");
        dangSaoLuuAuto = false;
        return;
      }

      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const thoiGianStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const ngayStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
      const thoiGianHienThi = `${thoiGianStr} ${ngayStr}`;

      const backupData = {
        phienBan: "1.0",
        loai: "auto_backup",
        thoiGian: now.toISOString(),
        thoiGianHienThi: thoiGianHienThi,
        soLuongMuc: count,
        duLieu: duLieu
      };

      const base64Data = chuoiSangBase64Utf8(JSON.stringify(backupData, null, 2));

      // Ghi đè file cố định vào Download trên Android
      if (window.AndroidNative && typeof window.AndroidNative.saveFileToDownload === "function") {
        window.AndroidNative.saveFileToDownload("QuanLyKho_AutoBackup.json", base64Data, "application/json");
      }

      // Lưu lại mốc sao lưu thành công
      localStorage.setItem("last_auto_backup_hash", currentHash);
      localStorage.setItem("last_auto_backup_time", thoiGianHienThi);

      capNhatChiBaoAutoBackup(`💾 Tự động sao lưu: ${thoiGianHienThi}`, "success");
      if (typeof hopDenGhiLog === "function") {
        hopDenGhiLog("AUTO_BACKUP_OK", `Tự động ghi đè ${count} mục vào QuanLyKho_AutoBackup.json (${lyDo})`);
      }
    } catch (err) {
      console.warn("[AutoBackup] Lỗi tự động sao lưu:", err);
      capNhatChiBaoAutoBackup("💾 Lỗi tự động sao lưu: " + err.message, "warning");
    } finally {
      dangSaoLuuAuto = false;
    }
  }
  window.thucHienAutoBackup = thucHienAutoBackup;

  // Hàm kích hoạt có trễ (debounce) sau khi hoàn thành 1 đợt quét
  function kichHoatKiemTraAutoBackup(delayMs = 4000) {
    if (timerDebounceAutoBackup) clearTimeout(timerDebounceAutoBackup);
    timerDebounceAutoBackup = setTimeout(() => {
      thucHienAutoBackup("after_scan");
    }, delayMs);
  }
  window.kichHoatKiemTraAutoBackup = kichHoatKiemTraAutoBackup;

  // Tự động kiểm tra sao lưu sau khi app khởi động 3.5 giây
  setTimeout(() => {
    const lastTime = localStorage.getItem("last_auto_backup_time");
    if (lastTime) {
      capNhatChiBaoAutoBackup(`💾 Tự động sao lưu: ${lastTime} (Toàn vẹn)`, "success");
    } else {
      capNhatChiBaoAutoBackup("💾 Tự động sao lưu: Đang kích hoạt");
    }
    thucHienAutoBackup("app_launch");
  }, 3500);
})();



// ── CÁC HÀM DÙNG CHUNG CHO TẤT CẢ CÁC MODULE QUÉT QR ─────────────────

window.batTatDenPinCamera = async function(videoId, btnId, currentState) {
  const videoEl = document.getElementById(videoId);
  if (!videoEl || !videoEl.srcObject) {
    if (typeof showCanhBao === "function") showCanhBao("Camera chưa sẵn sàng.", "warning");
    return currentState;
  }
  const track = videoEl.srcObject.getVideoTracks()[0];
  if (!track) return currentState;
  
  const capabilities = track.getCapabilities();
  if (!capabilities.torch) { 
    if (typeof showCanhBao === "function") showCanhBao("Thiết bị không hỗ trợ đèn pin.", "warning");
    return currentState;
  }

  const btnFlash = document.getElementById(btnId);
  if (btnFlash) btnFlash.disabled = true;

  const newState = !currentState;
  try {
    await track.applyConstraints({ advanced: [{ torch: newState }] });
    if (btnFlash) {
      btnFlash.style.background = newState ? "var(--brass)" : "var(--neutral)";
      btnFlash.style.color = newState ? "var(--bg)" : "var(--cream)";
      btnFlash.textContent = newState ? "Tắt đèn" : "Bật đèn pin";
    }
    if (btnFlash) btnFlash.disabled = false;
    return newState;
  } catch (err) {
    console.warn("Lỗi bật/tắt đèn pin:", err);
    if (typeof showCanhBao === "function") showCanhBao("Không thể bật/tắt đèn pin.", "error");
    if (btnFlash) btnFlash.disabled = false;
    return currentState;
  }
};

window.hienVienFeedbackCamera = function(containerSelector, loai) {
  const element = document.querySelector(containerSelector) || document.getElementById(containerSelector);
  if (!element) return;
  if (loai === "success") {
    element.style.borderColor = "#22c55e";
    element.style.boxShadow = "0 0 16px rgba(34, 197, 94, 0.75)";
  } else {
    element.style.borderColor = "#ef4444";
    element.style.boxShadow = "0 0 16px rgba(239, 68, 68, 0.75)";
  }
  setTimeout(() => {
    element.style.borderColor = "";
    element.style.boxShadow = "none";
  }, 800);
};

window.khoaCuonTrangQuet = function(isLock) {
  if (isLock) {
    document.body.classList.add("cam-active");
    window.scrollTo(0, 0);
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  } else {
    document.body.classList.remove("cam-active");
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  }
};


