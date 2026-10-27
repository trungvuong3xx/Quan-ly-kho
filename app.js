// ── Web App Core v20260809-ultra ──────────────────────────
const API = "https://script.google.com/macros/s/AKfycbzXjzccld3X04iJgIpEvKm01in0QT0i7tkjar_oJ6K5-sBGdm9xibe7Mu4UB3mWtha5-w/exec";

async function callAPI(body, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(API, {
      method: "POST",
      body: JSON.stringify(body),
      redirect: "follow",
      signal: controller.signal
    });
    clearTimeout(timer);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (parseErr) {
      return { error: "Máy chủ phản hồi chậm hoặc gián đoạn (Timeout), vui lòng thử lại." };
    }
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return { error: "Quá thời gian chờ máy chủ (Timeout 30s), vui lòng thử lại." };
    }
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
let isXlsxLoading = false;
let xlsxLoadingCallbacks = [];

function napThuVienXLSX(callback) {
  if (typeof XLSX !== "undefined") {
    if (callback) callback();
    return;
  }
  if (callback) xlsxLoadingCallbacks.push(callback);
  if (isXlsxLoading) return;
  isXlsxLoading = true;

  const script = document.createElement("script");
  script.src = "lib/xlsx.full.min.js";
  script.onload = () => {
    isXlsxLoading = false;
    const cbs = xlsxLoadingCallbacks;
    xlsxLoadingCallbacks = [];
    cbs.forEach(cb => { try { cb(); } catch (e) {} });
  };
  script.onerror = () => {
    isXlsxLoading = false;
    xlsxLoadingCallbacks = [];
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

    // Tự động căn chỉnh độ rộng cột chuẩn đẹp
    if (dataArray.length > 0) {
      const keys = Object.keys(dataArray[0]);
      const colWidths = keys.map(key => {
        let maxLen = key.length;
        for (let i = 0; i < Math.min(dataArray.length, 100); i++) {
          const val = dataArray[i][key];
          const len = val != null ? String(val).length : 0;
          if (len > maxLen) maxLen = len;
        }
        return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
      });
      ws['!cols'] = colWidths;
    }

    const wb = XLSX.utils.book_new();
    let safeSheetName = (sheetName || "Báo Cáo").replace(/[\\/*?:\[\]]/g, "").slice(0, 31).trim() || "Báo Cáo";
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
    const safeBaseName = (filename || "BaoCaoKho").replace(/\.xlsx$/i, "");
    const fullFileName = safeBaseName + ".xlsx";

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
    if (typeof showCanhBao === "function") {
      showCanhBao("Đã tải xuống " + fullFileName, "success");
    }
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
let fastAudioUnlocked = false;

function goBoListenerAudioUnlock() {
  if (fastAudioUnlocked) return;
  fastAudioUnlocked = true;
  window.removeEventListener("touchstart", unlockFastAudioEngine, { capture: true });
  window.removeEventListener("click", unlockFastAudioEngine, { capture: true });
  window.removeEventListener("pointerdown", unlockFastAudioEngine, { capture: true });
  window.removeEventListener("keydown", unlockFastAudioEngine, { capture: true });
}

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
        if (fastAudioCtx && fastAudioCtx.state === "running") {
          goBoListenerAudioUnlock();
        }
      }, (err) => { });
    } else if (fastAudioBuffer && fastAudioCtx && fastAudioCtx.state === "running") {
      goBoListenerAudioUnlock();
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
    try { window.AndroidNative.vibrate(ms); return true; } catch (e) { }
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

    // Tìm dòng chứa Quy cách và Số kg (ưu tiên tìm từ dòng thứ 3 trở đi, tránh dòng 0 là ID và dòng 1 là MSP)
    const dongQCKG = lines.slice(2).find(l => {
      const hasNumberAtEnd = /[\d.]+\s*$/.test(l);
      const hasIndicator = l.includes('/') || l.includes('Kg') || l.includes('kg') || l.includes('-');
      return hasNumberAtEnd && hasIndicator;
    }) || lines.slice(2).find(l => l.includes("-") && /\d+/.test(l)) || "";

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
  const header = document.getElementById('header');
  if (header) {
    if (id === 'trangChu') header.style.display = 'flex';
    else header.style.display = 'none';
  }
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item, .bnav-btn").forEach(b => b.classList.remove("active"));
  const targetPage = document.getElementById(id);
  if (targetPage) targetPage.classList.add("active");
  const targetBtn = el || document.querySelector('.nav-item[data-page="' + id + '"], .bnav-btn[data-page="' + id + '"]');
  if (targetBtn) targetBtn.classList.add("active");
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
window.chuyenTrang = chuyenTrang;

// Điều hướng tới 1 tab từ nơi khác ngoài bottom-nav (nút tắt ở Trang chủ, banner tiếp tục...)
function diToiTab(id) {
  const btn = document.querySelector('.nav-item[data-page="' + id + '"], .bnav-btn[data-page="' + id + '"]');
  if (btn) chuyenTrang(id, btn);
  else chuyenTrangKhongNav(id);
}
window.diToiTab = diToiTab;

// Điều hướng tới 1 trang KHÔNG có nút riêng trên bottom-nav (vd: Lịch sử, chi tiết lịch sử)
function chuyenTrangKhongNav(id) {
  const header = document.getElementById('header');
  if (header) {
    if (id === 'trangChu') header.style.display = 'flex';
    else header.style.display = 'none';
  }
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const targetNav = document.querySelector('.nav-item[data-page="' + id + '"], .bnav-btn[data-page="' + id + '"]');
  if (targetNav) {
    document.querySelectorAll(".nav-item, .bnav-btn").forEach(b => b.classList.remove("active"));
    targetNav.classList.add("active");
  }
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
    } catch (e) { }
  }

  // 2. Thoát app thông qua Capacitor App Plugin
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App && typeof window.Capacitor.Plugins.App.exitApp === "function") {
    try {
      window.Capacitor.Plugins.App.exitApp();
      return;
    } catch (e) { }
  }

  // 3. Fallback cho Cordova / PhoneGap
  if (window.navigator && window.navigator.app && typeof window.navigator.app.exitApp === "function") {
    try {
      window.navigator.app.exitApp();
      return;
    } catch (e) { }
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
const CAMERA_IDLE_TIMEOUT_MS = 18000; // 18 giây không quét & không chạm -> tự ngủ để máy mát và tiết kiệm pin

// Lắng nghe tương tác người dùng 1 lần duy nhất ở cấp document (ngăn rò rỉ listener khi camera ngủ/thức nhiều lần)
function onGlobalCameraInteraction() {
  const pageMap = {
    'reader': 'quetQR',
    'kk-reader': 'kiemKe',
    'cx1-reader': 'chiFor',
    'btp-reader': 'btpPage'
  };

  // 1. Nếu có camera của trang đang hiển thị đang ở chế độ ngủ -> Đánh thức ngay lập tức!
  for (const vid of ['reader', 'kk-reader', 'cx1-reader', 'btp-reader']) {
    const pageEl = document.getElementById(pageMap[vid]);
    const isPageActive = pageEl && pageEl.classList.contains('active') && pageEl.style.display !== 'none';
    if (isPageActive && cameraSleepingMap[vid]) {
      danhThucCamera(vid);
      return;
    }
  }

  // 2. CHỈ reset timer cho camera của trang ĐANG THỰC SỰ HOẠT ĐỘNG
  // Nếu người dùng đã rời sang trang khác, không reset timer để camera cũ được giải phóng hoàn toàn
  for (const vid in cameraSleepTimerMap) {
    if (cameraSleepTimerMap[vid]) {
      const pageId = pageMap[vid];
      const pageEl = pageId ? document.getElementById(pageId) : null;
      const isPageActive = pageEl && pageEl.classList.contains('active') && pageEl.style.display !== 'none';
      if (isPageActive) {
        resetSleepTimerCamera(vid);
      } else {
        // Cho camera ở trang không active ngủ ngay lập tức
        choCameraNgu(vid);
      }
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
    videoEl.srcObject.getTracks().forEach(t => { try { t.stop(); } catch (e) { } });
    videoEl.srcObject = null;
  } catch (e) { }

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
try { idCameraUuTien = localStorage.getItem('camera_uu_tien') || null; } catch (e) { }

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
          width: { ideal: 800 },
          height: { ideal: 600 },
          frameRate: { ideal: 15, max: 20 }
        }
      });
      const track = fastStream.getVideoTracks()[0];
      if (!laCameraTruoc(track && track.label)) {
        return fastStream;
      }
      fastStream.getTracks().forEach(t => { try { t.stop(); } catch (e) { } });
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
          width: { ideal: 800 },
          height: { ideal: 600 },
          frameRate: { ideal: 15, max: 20 }
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
  if (cam0 && cam0.deviceId) {
    idCameraUuTien = cam0.deviceId;
    try { localStorage.setItem('camera_uu_tien', cam0.deviceId); } catch (e) { }
  }

  // Nếu luồng activeStream ở trên đã mở thành công và là camera sau -> DÙNG LUÔN, TUYỆT ĐỐI KHÔNG STOP!
  // Việc stop stream vừa mở sẽ khóa cảm biến trong HAL 300ms, dẫn đến mở nhầm sang camera trước gây lỗi calibrate motor
  if (activeStream) {
    const track = activeStream.getVideoTracks()[0];
    const trackLbl = (track && track.label) ? track.label.toLowerCase() : '';
    if (!laCameraTruoc(trackLbl)) {
      if (cam0 && cam0.deviceId) {
        idCameraUuTien = cam0.deviceId;
        try { localStorage.setItem('camera_uu_tien', cam0.deviceId); } catch (e) { }
      }
      return activeStream;
    }
    // Chỉ stop nếu lỡ là camera trước
    activeStream.getTracks().forEach(t => { try { t.stop(); } catch (e) { } });
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
          width: { ideal: 800 },
          height: { ideal: 600 },
          frameRate: { ideal: 15, max: 20 }
        }
      });
      const track = stream.getVideoTracks()[0];
      if (!laCameraTruoc(track && track.label)) {
        idCameraUuTien = id;
        try { localStorage.setItem('camera_uu_tien', id); } catch (e) { }
        return stream;
      }
      stream.getTracks().forEach(t => { try { t.stop(); } catch (e) { } });
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
        stream.getTracks().forEach(t => { try { t.stop(); } catch (e) { } });
      } catch (e2) { }
    }
  }

  // 5. Fallback cuối cùng: facingMode ideal environment (ưu tiên deviceId của Camera 0)
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: (cam0 && cam0.deviceId) ? { ideal: cam0.deviceId } : undefined,
        facingMode: { ideal: "environment" },
        width: { ideal: 800 },
        height: { ideal: 600 },
        frameRate: { ideal: 15, max: 20 }
      }
    });
    const track = stream.getVideoTracks()[0];
    if (!laCameraTruoc(track && track.label)) return stream;
    stream.getTracks().forEach(t => { try { t.stop(); } catch (e) { } });
  } catch (e) { }

  return null;
}
const layCameraStream = moLuongCameraDungHuong;

// Bật chế độ tự động lấy nét liên tục (Continuous Autofocus)
async function batContinuousAutofocus(stream) {
  if (!stream) return;
  try {
    const track = stream.getVideoTracks()[0];
    if (track && track.getCapabilities) {
      const caps = track.getCapabilities();
      const adv = [];
      if (caps.focusMode && caps.focusMode.includes('continuous')) {
        adv.push({ focusMode: 'continuous' });
      }
      if (caps.exposureMode && caps.exposureMode.includes('continuous')) {
        adv.push({ exposureMode: 'continuous' });
      }
      if (adv.length > 0 && track.applyConstraints) {
        await track.applyConstraints({ advanced: adv });
      }
    }
  } catch (e) {
    console.warn("Lấy nét tự động không được hỗ trợ bởi ống kính này:", e);
  }
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
window.doiCameraNhanh = async function (videoId) {
  const msg = "Đã khóa cố định Camera chính Sony 48MP AF - Cảm biến duy nhất hỗ trợ lấy nét quét mã QR!";
  if (videoId === 'btp-reader' && typeof showCanhBaoBTP === "function") showCanhBaoBTP(msg);
  else if (videoId === 'cx1-reader' && typeof showCanhBaoCX1 === "function") showCanhBaoCX1(msg);
  else if (typeof showCanhBao === "function") showCanhBao(msg);
};
window.doiCamera = window.doiCameraNhanh;

// Vẽ khung định vị tức thời Bounding Box màu xanh lá ôm trọn mã QR vừa quét
function veKhungBoundingBoxQR(videoId, codeObj, srcW, srcH) {
  if (!codeObj) return;
  const videoEl = document.getElementById(videoId);
  if (!videoEl || !videoEl.parentElement) return;
  let canvas = videoEl.parentElement.querySelector('.qr-bounding-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'qr-bounding-canvas';
    canvas.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:4;';
    videoEl.parentElement.appendChild(canvas);
  }
  const rect = videoEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  canvas.width = rect.width;
  canvas.height = rect.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const vw = srcW || videoEl.videoWidth || 800;
  const vh = srcH || videoEl.videoHeight || 600;
  const scaleX = rect.width / vw;
  const scaleY = rect.height / vh;

  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';

  if (codeObj.cornerPoints && codeObj.cornerPoints.length >= 4) {
    ctx.beginPath();
    ctx.moveTo(codeObj.cornerPoints[0].x * scaleX, codeObj.cornerPoints[0].y * scaleY);
    for (let i = 1; i < codeObj.cornerPoints.length; i++) {
      ctx.lineTo(codeObj.cornerPoints[i].x * scaleX, codeObj.cornerPoints[i].y * scaleY);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (codeObj.boundingBox) {
    const b = codeObj.boundingBox;
    const x = b.x * scaleX;
    const y = b.y * scaleY;
    const w = b.width * scaleX;
    const h = b.height * scaleY;
    ctx.strokeRect(x, y, w, h);
    ctx.fillRect(x, y, w, h);
  }

  setTimeout(() => {
    if (canvas) {
      const c = canvas.getContext('2d');
      c.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, 250);
}

// Bộ lọc cân bằng tương phản và nén vùng cháy sáng (Highlight Suppression & Contrast Boost)
function locChongChoaCanvas(ctx, w, h) {
  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    const len = d.length;
    for (let i = 0; i < len; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 215) {
        const n = 215 + (lum - 215) * 0.25;
        const factor = n / (lum || 1);
        d[i] = r * factor;
        d[i + 1] = g * factor;
        d[i + 2] = b * factor;
      } else if (lum < 160) {
        const factor = 0.85;
        d[i] = r * factor;
        d[i + 1] = g * factor;
        d[i + 2] = b * factor;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (e) {}
}

window.toggleFlashlightHUD = async function (videoId, btnEl) {
  if (typeof batTatDenPinCamera === "function") {
    const isCurrentlyActive = btnEl.classList.contains("active-flash");
    const newState = await batTatDenPinCamera(videoId, null, isCurrentlyActive);
    btnEl.classList.toggle("active-flash", !!newState);
  }
};

window.toggleQuetTrungHUD = function (checkboxId, btnEl) {
  const cb = document.getElementById(checkboxId);
  if (!cb) return;
  cb.checked = !cb.checked;
  cb.dispatchEvent(new Event("change"));
  btnEl.classList.toggle("active-repeat", cb.checked);
};

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
      throw new Error("Không lấy được luồng camera sau!");
    }

    // Ghi nhớ Camera 0 trong phiên hiện tại để lần sau mở nhanh
    navigator.mediaDevices.enumerateDevices().then(devList => {
      const exactCam0 = timCamera0(devList);
      if (exactCam0 && exactCam0.deviceId) {
        idCameraUuTien = exactCam0.deviceId;
        try { localStorage.setItem('camera_uu_tien', exactCam0.deviceId); } catch (e) { }
      }
    }).catch(() => { });

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
          videoEl.play().catch(() => { });
        }
      }, 100);
    }
    if (window.AndroidNative && typeof window.AndroidNative.setKeepScreenOn === "function") {
      try { window.AndroidNative.setKeepScreenOn(true); } catch (e) { }
    }

    // Cơ chế chống kẹt khung play & Reset Sleep Timer khi người dùng chạm vào màn hình
    const onUserInteraction = () => {
      if (cameraSleepingMap[videoId]) {
        danhThucCamera(videoId);
        return;
      }
      if (videoEl && videoEl.srcObject && videoEl.paused) {
        videoEl.play().catch(() => { });
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
    throw e;
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
  let motionCanvas = null;
  let motionCtx = null;
  let lastMotionSamples = null;

  let isScanning = true;
  let isDecoding = false;
  let lastScanSuccessTime = Date.now();
  let lastVideoTime = -1;
  let consecutiveMisses = 0;
  let staticSkipCount = 0;
  let videoFrameCbId = null;

  const kiemTraKhungHinhTinh = () => {
    try {
      if (!motionCanvas) {
        motionCanvas = document.createElement('canvas');
        motionCanvas.width = 16;
        motionCanvas.height = 12;
        motionCtx = motionCanvas.getContext('2d', { willReadFrequently: true });
      }
      motionCtx.drawImage(videoEl, 0, 0, 16, 12);
      const data = motionCtx.getImageData(0, 0, 16, 12).data;
      const samples = new Uint8Array(16);
      let diffSum = 0;
      for (let i = 0; i < 16; i++) {
        const idx = i * 12 * 4;
        const lum = (data[idx] + (data[idx + 1] << 1) + data[idx + 2]) >> 2;
        samples[i] = lum;
        if (lastMotionSamples) {
          diffSum += Math.abs(lum - lastMotionSamples[i]);
        }
      }
      const isStatic = lastMotionSamples !== null && (diffSum / 16) < 2.2;
      lastMotionSamples = samples;
      return isStatic;
    } catch (e) {
      return false;
    }
  };

  const lenLichQuetTiep = (delayMs) => {
    if (!isScanning || !videoEl.srcObject) return;
    animFrameMap[videoId] = setTimeout(() => {
      if (!isScanning || !videoEl.srcObject) return;
      if (typeof videoEl.requestVideoFrameCallback === 'function') {
        videoFrameCbId = videoEl.requestVideoFrameCallback(() => {
          videoFrameCbId = null;
          quetKhungHinh();
        });
      } else {
        quetKhungHinh();
      }
    }, delayMs);
  };

  const quetKhungHinh = async () => {
    if (!isScanning || !videoEl.srcObject || videoEl.ended || document.visibilityState === 'hidden') return;

    if (videoEl.paused) {
      try { videoEl.play().catch(() => { }); } catch (e) { }
      if (videoEl.paused) {
        lenLichQuetTiep(220);
        return;
      }
    }

    const curVidTime = videoEl.currentTime;
    const hasNewFrame = curVidTime !== lastVideoTime;

    if (!isDecoding && hasNewFrame && videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
      lastVideoTime = curVidTime;

      // Bỏ qua bớt nhịp giải mã khi hình ảnh gần như đứng yên nhưng vẫn giữ nhịp chậm (mỗi 3 frame) khi QR đặt tĩnh
      const isStaticFrame = kiemTraKhungHinhTinh();
      if (isStaticFrame) {
        staticSkipCount = (staticSkipCount + 1) % 3;
        if (staticSkipCount !== 0) {
          lenLichQuetTiep(160);
          return;
        }
      } else {
        staticSkipCount = 0;
      }

      isDecoding = true;
      let qrText = null;

      // ── ƯU TIÊN 1: Native BarcodeDetector (Tốc độ phần cứng GPU/NPU < 5ms, 0% tải CPU) ──
      if (nativeDetector) {
        try {
          const codes = await nativeDetector.detect(videoEl);
          if (codes && codes.length > 0 && codes[0].rawValue) {
            qrText = codes[0].rawValue;
            veKhungBoundingBoxQR(videoId, codes[0]);
          }
        } catch (eNative) {
          nativeDetector = null; // Nếu phần cứng gặp lỗi thì mới cho fallback sang ZXing
        }

        // Chống chóa theo nhu cầu: chỉ kích hoạt sau ít nhất 6 nhịp thất bại liên tiếp (và mỗi 8 nhịp 1 lần)
        if (!qrText && nativeDetector && consecutiveMisses >= 6 && (consecutiveMisses % 8 === 0)) {
          try {
            if (!zxCanvas) {
              zxCanvas = document.createElement('canvas');
              zxCanvas.width = 360;
              zxCanvas.height = 270;
              zxCtx = zxCanvas.getContext('2d');
            }
            if (typeof zxCtx.filter === 'string') {
              zxCtx.filter = 'contrast(1.25) brightness(0.92)';
              zxCtx.drawImage(videoEl, 0, 0, 360, 270);
              zxCtx.filter = 'none';
            } else {
              zxCtx.drawImage(videoEl, 0, 0, 360, 270);
              locChongChoaCanvas(zxCtx, 360, 270);
            }
            const codesCanvas = await nativeDetector.detect(zxCanvas);
            if (codesCanvas && codesCanvas.length > 0 && codesCanvas[0].rawValue) {
              qrText = codesCanvas[0].rawValue;
              veKhungBoundingBoxQR(videoId, codesCanvas[0], 360, 270);
            }
          } catch (eGlare) {}
        }
      }

      // ── ƯU TIÊN 2: CHỈ CHẠY ZXING KHI MÁY HOÀN TOÀN KHÔNG CÓ BarcodeDetector (APK WebView) ──
      if (!qrText && !nativeDetector && videoEl.readyState >= 2) {
        try {
          if (!zxingReader) {
            zxingReader = new ZXing.BrowserQRCodeReader();
          }
          if (!zxCanvas) {
            zxCanvas = document.createElement('canvas');
            zxCanvas.width = 360;
            zxCanvas.height = 270;
            zxCtx = zxCanvas.getContext('2d', { willReadFrequently: true });
          }
          const vw = videoEl.videoWidth;
          const vh = videoEl.videoHeight;
          // Xen kẽ cắt vùng trung tâm khung ngắm (ROI 75%) và toàn khung để giảm tải điểm ảnh & tăng tốc giải mã
          const useRoi = (consecutiveMisses % 3 !== 2) && vw > 0 && vh > 0;
          const sx = useRoi ? Math.floor(vw * 0.125) : 0;
          const sy = useRoi ? Math.floor(vh * 0.125) : 0;
          const sw = useRoi ? Math.floor(vw * 0.75) : vw;
          const sh = useRoi ? Math.floor(vh * 0.75) : vh;

          // Chỉ bật lọc chống chóa sau 4 lần đọc thất bại liên tiếp thay vì mọi nhịp
          const applyGlareFilter = consecutiveMisses >= 4 && (consecutiveMisses % 4 === 0);
          if (applyGlareFilter && typeof zxCtx.filter === 'string') {
            zxCtx.filter = 'contrast(1.25) brightness(0.92)';
            zxCtx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, 360, 270);
            zxCtx.filter = 'none';
          } else {
            zxCtx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, 360, 270);
            if (applyGlareFilter) {
              locChongChoaCanvas(zxCtx, 360, 270);
            }
          }
          const res = zxingReader.decodeFromCanvas(zxCanvas);
          if (res && res.getText()) {
            qrText = res.getText();
          }
        } catch (eZxing) { }
      }

      if (qrText) {
        consecutiveMisses = 0;
        try {
          lastScanSuccessTime = Date.now();
          resetSleepTimerCamera(videoId); // Reset timer 18s khi quét thành công
          onDecodedCallback(qrText);
        } catch (eCb) {
          console.warn("Callback error:", eCb);
        }
      } else {
        consecutiveMisses++;
      }

      isDecoding = false;
    }

    if (isScanning && videoEl.srcObject) {
      const idleElapsed = Date.now() - lastScanSuccessTime;
      const nextInterval = idleElapsed < 4000 ? 70 : (idleElapsed < 10000 ? 150 : 220);
      lenLichQuetTiep(nextInterval);
    }
  };

  lenLichQuetTiep(120);
  resetSleepTimerCamera(videoId); // Kích hoạt bộ đếm 18s khi bắt đầu phiên quét

  return {
    reset: () => {
      isScanning = false;
      if (animFrameMap[videoId]) {
        clearTimeout(animFrameMap[videoId]);
        animFrameMap[videoId] = null;
      }
      if (videoFrameCbId !== null && typeof videoEl.cancelVideoFrameCallback === 'function') {
        try { videoEl.cancelVideoFrameCallback(videoFrameCbId); } catch (e) { }
        videoFrameCbId = null;
      }
      if (cameraSleepTimerMap[videoId]) {
        clearTimeout(cameraSleepTimerMap[videoId]);
        cameraSleepTimerMap[videoId] = null;
      }
      anSleepOverlayCamera(videoId);
      if (zxingReader) {
        try { zxingReader.reset(); } catch (e) { }
      }
      zxCanvas = null;
      zxCtx = null;
      motionCanvas = null;
      motionCtx = null;
      lastMotionSamples = null;
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
  if (fastAudioCtx && fastAudioCtx.state === "running") {
    setTimeout(() => {
      if (!document.body.classList.contains("cam-active") && fastAudioCtx && fastAudioCtx.state === "running") {
        try { fastAudioCtx.suspend(); } catch (e) { }
      }
    }, 600);
  }
  if (window.AndroidNative && typeof window.AndroidNative.setKeepScreenOn === "function") {
    try { window.AndroidNative.setKeepScreenOn(false); } catch (e) { }
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
  const today = (typeof layNgayHomNayLocal === "function") ? layNgayHomNayLocal() : (function() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  })();
  const ngayInput = document.getElementById("chon-ngay");
  if (ngayInput) ngayInput.value = today;
  capNhatTrangChu();
  if (typeof donDepLichSuCX1 === "function") donDepLichSuCX1();
};

// ── Trang chủ: hiện phiên dở dang (hỗ trợ cả Chỉ For, Chỉ X5, BTP, Quét QR) ────
function capNhatTrangChu() {
  const safeEsc = typeof escapeHtml === "function" ? escapeHtml : (s => String(s == null ? "" : s).replace(/[&<>"']/g, ""));

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
        <div class="ps-compact-row">
          <div class="ps-compact-left">
            <div class="ps-compact-title"><span class="tk-badge tk-badge-thuong">Dở dang</span> <b>Chỉ For</b></div>
            <div class="ps-compact-meta">Ngày: <b>${safeEsc(state.ngayCX1 || "—")}</b> • Lúc ${safeEsc(gioCapNhat)}</div>
          </div>
          <div class="ps-compact-count">${Number(state.phienCX1.length) || 0} <small>mã</small></div>
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
        <div class="ps-compact-row">
          <div class="ps-compact-left">
            <div class="ps-compact-title"><span class="tk-badge tk-badge-for">Dở dang</span> <b>Chỉ X5</b></div>
            <div class="ps-compact-meta">Ngày: <b>${safeEsc(stateX5.ngayCX5 || "—")}</b> • Lúc ${safeEsc(gioCapNhatX5)}</div>
          </div>
          <div class="ps-compact-count">${Number(stateX5.phienCX5.length) || 0} <small>dòng</small></div>
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
        <div class="ps-compact-row">
          <div class="ps-compact-left">
            <div class="ps-compact-title"><span class="tk-badge tk-badge-thuong">Dở dang</span> <b>BTP (Bán Thành Phẩm)</b></div>
            <div class="ps-compact-meta">Ngày: <b>${safeEsc(stateBTP.ngayBTP || "—")}</b> • Lúc ${safeEsc(gioCapNhatBTP)}</div>
          </div>
          <div class="ps-compact-count">${Number(soMa) || 0} <small>mã</small></div>
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
      const tenLoaiQR = stateQR.loaiQuetQR ? safeEsc(stateQR.loaiQuetQR) : "Giao dịch";
      noidungQR.innerHTML = `
        <div class="ps-compact-row">
          <div class="ps-compact-left">
            <div class="ps-compact-title"><span class="tk-badge tk-badge-thuong">Dở dang</span> <b>Quét QR (${tenLoaiQR})</b></div>
            <div class="ps-compact-meta">Ngày: <b>${safeEsc(stateQR.ngayQuetQR || "—")}</b> • Lúc ${safeEsc(gioCapNhatQR)}</div>
          </div>
          <div class="ps-compact-count">${Number(stateQR.phienQuetQR.length) || 0} <small>bao</small></div>
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
  const keys = [APP_PENDING_KEY, "quetqr_pending_saves", "qr_pending_saves", "cx1_pending_saves", "kk_pending_saves", "cx5_pending_saves", "btp_pending_saves"];
  for (let i = 0; i < keys.length; i++) {
    try {
      const raw = localStorage.getItem(keys[i]);
      if (raw && raw.length > 2) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) tong += arr.length;
      }
    } catch (e) { }
  }
  return tong;
}

let dangDongBoTongApp = false;

async function dongBoTatCaOfflineApp() {
  if (dangDongBoTongApp) return;
  dangDongBoTongApp = true;

  try {
    // 1. Đồng bộ App QR (Xóa từng item theo ID sau khi gửi thành công)
    try {
      const appPending = [...docPendingApp(), ...(function () { try { return JSON.parse(localStorage.getItem("qr_pending_saves") || "[]"); } catch (e) { return []; } })()];
      if (appPending.length > 0) {
        for (const item of appPending) {
          try {
            const r = await callAPI({ action: "luuGiaoDich", ...item });
            if (r && !r.error) {
              const itemId = item.id || (item.msp + "_" + item.ngay + "_" + item.kg);
              const curPending = docPendingApp();
              luuPendingApp(curPending.filter(p => (p.id || (p.msp + "_" + p.ngay + "_" + p.kg)) !== itemId));
              try {
                const curQrPending = JSON.parse(localStorage.getItem("qr_pending_saves") || "[]");
                if (Array.isArray(curQrPending) && curQrPending.length > 0) {
                  const nextQrPending = curQrPending.filter(p => (p.id || (p.msp + "_" + p.ngay + "_" + p.kg)) !== itemId);
                  if (nextQrPending.length > 0) {
                    localStorage.setItem("qr_pending_saves", JSON.stringify(nextQrPending));
                  } else {
                    localStorage.removeItem("qr_pending_saves");
                  }
                }
              } catch (e) { }
            }
          } catch (e) { }
        }
      }
    } catch (e) { }

    // 2. Đồng bộ Chỉ FOR (CX1) qua hàm tập trung có Mutex chống gửi trùng
    if (typeof window.dongBoOfflineCX1 === "function") {
      try {
        await window.dongBoOfflineCX1();
      } catch (e) { }
    } else if (typeof docPendingCX1 === "function" && typeof guiLenSheetCX1 === "function") {
      const pendingCX1 = docPendingCX1();
      if (pendingCX1.length > 0) {
        try {
          await guiLenSheetCX1(pendingCX1);
          const sentIds = new Set(pendingCX1.map(p => p.id || (p.dot + "_" + p.msp + "_" + p.ngay)));
          const cur = docPendingCX1();
          if (typeof luuPendingCX1 === "function") {
            luuPendingCX1(cur.filter(p => !sentIds.has(p.id || (p.dot + "_" + p.msp + "_" + p.ngay))));
          }
        } catch (e) { }
      }
    }

    // 3. Đồng bộ BTP an toàn qua hàm tập trung (có khóa mutex và trừ theo recordId)
    if (typeof dongBoThietBiBTP === "function") {
      try {
        await dongBoThietBiBTP(true);
      } catch (e) { }
    }

    // 4. Đồng bộ Chỉ X5 (CX5) - trừ chính xác từng item thành công
    try {
      if (typeof window.guiLaiPendingCX5 === "function") {
        await window.guiLaiPendingCX5();
      } else {
        const pendingCX5 = JSON.parse(localStorage.getItem("cx5_pending_saves") || "[]");
        if (pendingCX5.length > 0 && typeof callApiCX5 === "function") {
          for (const item of pendingCX5) {
            try {
              const r = await callApiCX5({ action: "submitEntryX5", payload: item });
              if (r && r.success) {
                const itemId = item.id || (item.msp + "_" + item.ten + "_" + item.dateStr);
                const curCX5 = JSON.parse(localStorage.getItem("cx5_pending_saves") || "[]");
                localStorage.setItem("cx5_pending_saves", JSON.stringify(
                  curCX5.filter(p => (p.id || (p.msp + "_" + p.ten + "_" + p.dateStr)) !== itemId)
                ));
              }
            } catch (e) { }
          }
        }
      }
    } catch (e) { }

    // 5. Đồng bộ Kiểm kê - trừ chính xác danh sách đã gửi thành công
    try {
      const pendingKK = JSON.parse(localStorage.getItem("kk_pending_saves") || "[]");
      if (pendingKK.length > 0 && typeof callAPI === "function") {
        const r = await callAPI({ action: "luuKiemKe", data: pendingKK });
        if (r && !r.error) {
          const sentIds = new Set(pendingKK.map(p => p.id || (p.msp + "_" + p.ngay + "_" + p.viTri)));
          const curKK = JSON.parse(localStorage.getItem("kk_pending_saves") || "[]");
          localStorage.setItem("kk_pending_saves", JSON.stringify(
            curKK.filter(p => !sentIds.has(p.id || (p.msp + "_" + p.ngay + "_" + p.viTri)))
          ));
        }
      }
    } catch (e) { }

    // 6. Đồng bộ Quét QR (quetqr.js) - trừ từng item theo ID
    try {
      const pendingQQR = JSON.parse(localStorage.getItem("quetqr_pending_saves") || "[]");
      if (pendingQQR.length > 0 && typeof callAPI === "function") {
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
            if (r && !r.error) {
              const itemId = item.id || (item.msp + "_" + item.ngay + "_" + item.kg);
              const curQQR = JSON.parse(localStorage.getItem("quetqr_pending_saves") || "[]");
              localStorage.setItem("quetqr_pending_saves", JSON.stringify(
                curQQR.filter(p => (p.id || (p.msp + "_" + p.ngay + "_" + p.kg)) !== itemId)
              ));
            }
          } catch (e) { }
        }
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
  try { localStorage.removeItem("quetqr_pending_saves"); } catch (e) { }
  try { localStorage.removeItem("cx1_pending_saves"); } catch (e) { }
  try { localStorage.removeItem("btp_pending_saves"); } catch (e) { }
  try { localStorage.removeItem("cx5_pending_saves"); } catch (e) { }
  try { localStorage.removeItem("kk_pending_saves"); } catch (e) { }
  if (typeof luuPendingQuetQR === "function") luuPendingQuetQR([]);
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

let timerKiemTraMang = null;
function batDauTheoDoiMang() {
  if (timerKiemTraMang) clearInterval(timerKiemTraMang);
  timerKiemTraMang = setInterval(() => {
    if (document.visibilityState === "visible" && !document.body.classList.contains("cam-active")) {
      capNhatTrangThaiMang();
    }
  }, 45000);
}
function dungTheoDoiMang() {
  if (timerKiemTraMang) {
    clearInterval(timerKiemTraMang);
    timerKiemTraMang = null;
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
  batDauTheoDoiMang();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    capNhatTrangThaiMang();
    batDauTheoDoiMang();
  } else {
    dungTheoDoiMang();
  }
});
window.capNhatTrangThaiMang = capNhatTrangThaiMang;

let _appXacNhanCallbackOk = null;
let _appXacNhanCallbackHuy = null;

function moXacNhanApp(noiDung, callbackOk, nhanNutOk, callbackHuy, nhanNutHuy, tieuDe) {
  const elTieude = document.getElementById("app-xacnhan-tieude");
  const elNoidung = document.getElementById("app-xacnhan-noidung");
  const elNutOk = document.getElementById("app-xacnhan-nut-ok");
  const elNutHuy = document.getElementById("app-xacnhan-nut-huy");

  if (elTieude) elTieude.textContent = tieuDe || "Xác nhận";
  if (elNoidung) {
    if (typeof noiDung === "string" && /<[a-z][\s\S]*>/i.test(noiDung)) {
      elNoidung.innerHTML = noiDung;
    } else {
      elNoidung.textContent = noiDung || "";
      elNoidung.style.whiteSpace = "pre-line";
    }
  }
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
window.alert = function (msg) {
  if (typeof showCanhBao === "function") {
    showCanhBao(String(msg));
  } else {
    console.warn("ALERT INTERCEPTED:", msg);
  }
};

// ── Hàm khôi phục sạch luồng camera và khởi động lại vòng lặp quét ──
async function khoiPhucCamera(videoId, fallbackCb) {
  const videoEl = document.getElementById(videoId);
  if (!videoEl) throw new Error("Không tìm thấy thẻ video " + videoId);
  const cb = lastCameraCallbackMap[videoId] || fallbackCb;
  if (!cb) throw new Error("Chưa có hàm callback xử lý mã QR cho camera " + videoId);

  // 1. Chỉ dừng luồng cũ nếu nó còn đang chạy (nếu đã sleep thì srcObject đã là null)
  if (videoEl.srcObject) {
    dungCameraFast(videoId, null);
    await new Promise(r => setTimeout(r, 150));
  }

  // 2. Khởi tạo lại camera và kích hoạt lại vòng lặp quét mới
  const reader = await khoiTaoCameraFast(videoId, cb);
  if (!reader) {
    throw new Error("Không thể khởi tạo bộ giải mã camera!");
  }
  if (videoId === 'reader') {
    window.zxingReaderQR = reader;
    window.dangQuetQR = true;
  } else if (videoId === 'cx1-reader') {
    window.zxingReaderCX1 = reader;
    window.dangQuetCX1 = true;
    if (typeof zxingReaderCX1 !== 'undefined') zxingReaderCX1 = reader;
  } else if (videoId === 'btp-reader') {
    window.zxingReaderBTP = reader;
    window.dangQuetBTP = true;
    if (typeof zxingReaderBTP !== 'undefined') zxingReaderBTP = reader;
  } else if (videoId === 'kk-reader') {
    window.zxingReaderKK = reader;
  }
  return reader;
}

// ── Tự động quản lý vòng đời Camera khi ẩn/mở lại app (Triệt tiêu 100% hiện tượng đứng hình) ──
let resumeCameraTimer = null;
function triggerResumeCamera() {
  clearTimeout(resumeCameraTimer);
  resumeCameraTimer = setTimeout(async () => {
    const camBoxes = [
      { pageId: 'quetQR', vid: 'reader', box: 'qr-cam', fallback: (txt) => { if (txt && window.dangQuetQR && typeof window.khiQuetDuocMaQR === 'function') window.khiQuetDuocMaQR({ getText: () => txt }); } },
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
      // 3. Phần tử video tồn tại và phiên quét đang hoạt động (không bị tạm dừng hoặc đang ngủ)
      const isPageActive = pageEl && pageEl.classList.contains('active');
      const isBoxVisible = boxEl && boxEl.style.display !== 'none' && window.getComputedStyle(boxEl).display !== 'none';
      const isPausedByUser = (item.vid === 'btp-reader' && window.dangQuetBTP === false) ||
        (item.vid === 'reader' && window.dangQuetQR === false) ||
        (item.vid === 'cx1-reader' && window.dangQuetCX1 === false);

      if (isPageActive && isBoxVisible && videoEl && !isPausedByUser && !cameraSleepingMap[item.vid]) {
        // Luôn khôi phục lại luồng camera mới tinh để không bao giờ bị đứng hình sau khi ẩn app
        await khoiPhucCamera(item.vid, item.fallback);
      }
    }
  }, 250);
}

function ngatTatCaCamera() {
  const vids = ['reader', 'kk-reader', 'cx1-reader', 'btp-reader'];
  for (const id of vids) {
    if (animFrameMap[id]) {
      clearTimeout(animFrameMap[id]);
      animFrameMap[id] = null;
    }
    if (cameraSleepTimerMap[id]) {
      clearTimeout(cameraSleepTimerMap[id]);
      cameraSleepTimerMap[id] = null;
    }
    anSleepOverlayCamera(id);
    const videoEl = document.getElementById(id);
    if (videoEl && videoEl.srcObject) {
      try {
        videoEl.srcObject.getTracks().forEach(t => {
          try { t.stop(); } catch (e) { }
        });
        videoEl.srcObject = null;
      } catch (e) { }
    }
  }
  if (window.AndroidNative && typeof window.AndroidNative.setKeepScreenOn === "function") {
    try { window.AndroidNative.setKeepScreenOn(false); } catch (e) { }
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

// Hàm tính mã băm chuỗi đơn giản để làm Delta Check
function tinhMaBam(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}
window.tinhMaBam = tinhMaBam;

async function saoLuuDuLieuToanBo() {
  try {
    if (window.ScannerCore && typeof window.ScannerCore.isLoaded === "function" && !window.ScannerCore.isLoaded()) {
      if (typeof window.ScannerCore.whenReady === "function") await window.ScannerCore.whenReady();
      if (!window.ScannerCore.isLoaded()) {
        if (typeof showCanhBao === "function") showCanhBao("Lịch sử chưa nạp xong, vui lòng thử lại sau vài giây để tránh sao lưu thiếu dữ liệu.", "warning");
        return;
      }
    }
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

    if (window.ScannerCore && typeof window.ScannerCore.exportHistoryForBackup === "function") {
      const idbHist = window.ScannerCore.exportHistoryForBackup();
      for (const [hKey, hVal] of Object.entries(idbHist)) {
        if (!backupData.duLieu[hKey]) count++;
        backupData.duLieu[hKey] = hVal;
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
  reader.onload = async function (e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || !parsed.duLieu || typeof parsed.duLieu !== "object") {
        if (typeof showCanhBao === "function") showCanhBao("File sao lưu không đúng định dạng!", "error");
        return;
      }

      // Danh sách key được phép khôi phục (Whitelist an toàn tuyệt đối)
      const isAllowedKey = (key) => {
        if (!key || typeof key !== "string") return false;
        if (/^(cx1|cx5|btp|qr|quetqr|kk|app)_/.test(key)) return true;
        const validExactKeys = [
          "user_theme", "tenNhanVien", "ten_nguoi_dung", "camera_uu_tien",
          "kho_tong_hop", "last_auto_backup_hash", "last_auto_backup_time"
        ];
        return validExactKeys.includes(key);
      };

      const soLuongMuc = Object.keys(parsed.duLieu).filter(isAllowedKey).length;
      if (soLuongMuc === 0) {
        if (typeof showCanhBao === "function") showCanhBao("Không tìm thấy dữ liệu hợp lệ trong file sao lưu!", "warning");
        return;
      }

      const thoiGianFile = parsed.thoiGianHienThi || parsed.thoiGian || "Không rõ";
      const xacNhanMsg = `Bạn có chắc chắn muốn khôi phục dữ liệu từ file:<br><b>${escapeHtml(file.name)}</b>?<br><br>` +
        `• Số mục dữ liệu: <b>${soLuongMuc} mục</b><br>` +
        `• Thời gian sao lưu: <b>${escapeHtml(thoiGianFile)}</b><br><br>` +
        `<span style="color:var(--gold,#f59e0b);">Lưu ý: Ứng dụng sẽ nạp lại dữ liệu và tự động khởi động lại (Reload) để đồng bộ hoàn toàn.</span>`;

      moXacNhanApp(
        xacNhanMsg,
        () => {
          try {
            let restoredCount = 0;
            const pendingKeys = [
              "app_pending_saves", "cx1_pending_saves", "cx5_pending_saves",
              "btp_pending_saves", "qr_pending_saves", "quetqr_pending_saves", "kk_pending_saves"
            ];

            for (const [key, val] of Object.entries(parsed.duLieu)) {
              if (!isAllowedKey(key) || val === null || val === undefined) continue;

              // BẢO VỆ HÀNG CHỜ OFFLINE CHƯA GỬI: Không bao giờ đè mất dữ liệu pending hiện có
              if (pendingKeys.includes(key)) {
                let currentPending = [];
                try { currentPending = JSON.parse(localStorage.getItem(key)) || []; } catch (e) { currentPending = []; }
                let backupPending = [];
                try {
                  backupPending = typeof val === "string" ? JSON.parse(val) : val;
                  if (!Array.isArray(backupPending)) backupPending = [];
                } catch (e) { backupPending = []; }

                if (currentPending.length > 0 && backupPending.length > 0) {
                  // Hòa trộn theo ID duy nhất hoặc seq để không bị mất dữ liệu chưa kịp gửi
                  const existingIds = new Set(currentPending.map(item => item.id || item.idPhien || JSON.stringify(item)));
                  backupPending.forEach(bItem => {
                    const bId = bItem.id || bItem.idPhien || JSON.stringify(bItem);
                    if (!existingIds.has(bId)) {
                      currentPending.push(bItem);
                    }
                  });
                  localStorage.setItem(key, JSON.stringify(currentPending));
                  restoredCount++;
                  continue;
                } else if (currentPending.length > 0) {
                  // Giữ nguyên pending hiện tại nếu backup không có
                  restoredCount++;
                  continue;
                }
              }

              if (window.ScannerCore && Array.isArray(window.ScannerCore.HISTORY_KEYS) && window.ScannerCore.HISTORY_KEYS.includes(key)) {
                if (window.ScannerCore.importHistoryFromBackup(key, val)) {
                  restoredCount++;
                  continue;
                }
              }

              const valToStore = typeof val === "string" ? val : JSON.stringify(val);
              localStorage.setItem(key, valToStore);
              restoredCount++;
            }

            if (typeof showCanhBao === "function") {
              showCanhBao(`Khôi phục thành công ${restoredCount} mục! Đang làm mới ứng dụng...`, "success");
            }

            // Nạp lại toàn bộ RAM state bằng cách reload trang
            // Chờ mọi lần ghi IndexedDB hoàn tất rồi mới reload (tránh reload khi dữ liệu khôi phục chưa xuống đĩa)
            const choGhiXong = (window.ScannerCore && typeof window.ScannerCore.whenIdle === "function")
              ? window.ScannerCore.whenIdle().catch(() => { })
              : Promise.resolve();
            choGhiXong.then(() => {
              setTimeout(() => { window.location.reload(); }, 800);
            });
          } catch (errGhi) {
            console.error("Lỗi ghi dữ liệu khôi phục:", errGhi);
            if (typeof showCanhBao === "function") showCanhBao("Lỗi ghi dữ liệu: " + errGhi.message, "error");
          }
        },
        "Khôi phục ngay",
        () => {
          if (typeof showCanhBao === "function") showCanhBao("Đã hủy thao tác khôi phục", "info");
        },
        "Hủy",
        "Xác nhận Khôi phục Dữ liệu"
      );
    } catch (err) {
      console.error("Lỗi phục hồi:", err);
      if (typeof showCanhBao === "function") showCanhBao("Lỗi khi đọc file sao lưu: " + err.message, "error");
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
  } else if (type === "info" || type === "blue") {
    el.style.background = "linear-gradient(135deg, #3b82f6, #1d4ed8)";
    el.style.boxShadow = "0 8px 24px rgba(59, 130, 246, .4)";
    el.style.border = "1px solid #60a5fa";
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
// ── MODULE TỰ ĐỘNG SAO LƯU ĐÁM MÂY KHI CÓ MẠNG HOẶC WI-FI (AUTO-BACKUP) ──────
// =============================================================================
(function () {
  let dangSaoLuuAuto = false;
  let timerDebounceAutoBackup = null;
  let lastAutoBackupRunTs = 0;
let soLanBoQuaSaoLuuGiam = 0; // số lần liên tiếp bỏ qua sao lưu vì lịch sử giảm bất thường
  const AUTO_BACKUP_MIN_INTERVAL_MS = 180000; // Gộp tối đa 1 lần mỗi 3 phút

  // Dọn bỏ bản chụp web_auto_backup_snapshot cũ nếu có để giải phóng bộ nhớ localStorage trên Web
  try { localStorage.removeItem("web_auto_backup_snapshot"); } catch (e) { }

  // Cập nhật nhãn trạng thái hiển thị trên giao diện
  function capNhatChiBaoAutoBackup(text, loai = "normal") {
    const el = document.getElementById("auto-backup-status");
    if (!el) return;
    el.textContent = text;
    if (loai === "success") {
      el.style.color = "var(--success)";
    } else if (loai === "warning") {
      el.style.color = "var(--warning)";
    } else if (loai === "info") {
      el.style.color = "var(--accent-blue, #3b82f6)";
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
      if (!k || k === "web_auto_backup_snapshot") continue;
      if (typeof BACKUP_KEYS !== "undefined" && (BACKUP_KEYS.includes(k) || k.includes('pending') || k.includes('phien_dodang') || k.includes('lich_su') || k.includes('msp_cache') || k.includes('cx1') || k.includes('cx5') || k.includes('btp') || k.includes('kk'))) {
        duLieu[k] = localStorage.getItem(k);
        count++;
      }
    }
    if (window.ScannerCore && typeof window.ScannerCore.exportHistoryForBackup === "function") {
      const idbHist = window.ScannerCore.exportHistoryForBackup();
      for (const [hKey, hVal] of Object.entries(idbHist)) {
        if (!duLieu[hKey]) count++;
        duLieu[hKey] = hVal;
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

  // Hàm chính: Thực hiện Auto-Backup thông minh ghi đè máy (chỉ khi không quét camera)
  async function thucHienAutoBackup(lyDo = "auto") {
    if (dangSaoLuuAuto) return;
    const isForce = lyDo === "force" || lyDo === "app_exit";
    // Không sao lưu khi đang mở camera quét liên tục
    if (!isForce && lyDo !== "app_hidden" && document.body.classList.contains("cam-active")) {
      return;
    }
    // Giới hạn tần suất tối đa 1 lần / 3 phút cho các sự kiện tự động
    const nowTs = Date.now();
    if (!isForce && lastAutoBackupRunTs > 0 && (nowTs - lastAutoBackupRunTs) < AUTO_BACKUP_MIN_INTERVAL_MS) {
      return;
    }

    // [AN TOÀN] Lịch sử (IndexedDB) chưa nạp xong -> dữ liệu trên RAM có thể thiếu, KHÔNG được ghi đè bản sao lưu tốt
    const scAB = window.ScannerCore;
    if (scAB && typeof scAB.isLoaded === "function" && !scAB.isLoaded() && !isForce) {
      if (lyDo === "app_launch") kichHoatKiemTraAutoBackup(5000);
      return;
    }

    try {
      dangSaoLuuAuto = true;

      const { duLieu, count } = thuThapGoiDuLieuSaoLuu();
      if (count === 0) {
        dangSaoLuuAuto = false;
        return;
      }

      // [AN TOÀN] Không sao lưu khi không có gì đáng giữ (tránh ghi đè bản tốt bằng bản gần như rỗng)
      const soPhienLichSu = (scAB && typeof scAB.getHistoryCount === "function") ? scAB.getHistoryCount() : 0;
      const coDuLieuLamDo = Object.keys(duLieu).some((k) => {
        if (!(k.includes("pending") || k.includes("phien_dodang"))) return false;
        const v = duLieu[k];
        return v && v !== "[]" && v !== "{}" && v !== "null";
      });
      if (!isForce && soPhienLichSu === 0 && !coDuLieuLamDo) {
        return;
      }

      // [AN TOÀN] Lịch sử tụt > 50% so với lần sao lưu trước -> giữ nguyên bản cũ (tối đa 3 lần bỏ qua liên tiếp)
      const moc = parseInt(localStorage.getItem("last_auto_backup_hist_count") || "0", 10) || 0;
      if (!isForce && moc >= 5 && soPhienLichSu < moc * 0.5 && soLanBoQuaSaoLuuGiam < 3) {
        soLanBoQuaSaoLuuGiam++;
        capNhatChiBaoAutoBackup("⚠️ Lịch sử giảm bất thường, giữ nguyên bản sao lưu cũ", "warning");
        return;
      }

      const jsonStr = JSON.stringify(duLieu);
      const currentHash = tinhMaBam(jsonStr);
      const lastHash = localStorage.getItem("last_auto_backup_hash");

      // ── DELTA CHECK: Nếu không có dữ liệu mới so với lần trước thì bỏ qua
      if (currentHash === lastHash && lyDo !== "force") {
        const lastTime = localStorage.getItem("last_auto_backup_time") || "Gần đây";
        capNhatChiBaoAutoBackup(`💾 Tự động sao lưu: ${lastTime} (Toàn vẹn)`, "success");
        lastAutoBackupRunTs = nowTs;
        dangSaoLuuAuto = false;
        return;
      }

      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const thoiGianStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const ngayStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
      const thoiGianHienThi = `${thoiGianStr} ${ngayStr}`;

      // 1. Chỉ tạo chuỗi Base64 và ghi file khi chạy trên Android Native APK
      if (window.AndroidNative && typeof window.AndroidNative.saveFileToDownload === "function") {
        const backupData = {
          phienBan: "1.0",
          loai: "auto_backup",
          thoiGian: now.toISOString(),
          thoiGianHienThi: thoiGianHienThi,
          soLuongMuc: count,
          duLieu: duLieu
        };
        const base64Data = chuoiSangBase64Utf8(JSON.stringify(backupData, null, 2));
        const res = window.AndroidNative.saveFileToDownload("QuanLyKho_AutoBackup.json", base64Data, "application/json");
        if (res === false || res === "false") {
          throw new Error("Không thể ghi file sao lưu vào thư mục Download");
        }
        localStorage.setItem("last_auto_backup_hash", currentHash);
        localStorage.setItem("last_auto_backup_time", thoiGianHienThi);
        localStorage.setItem("last_auto_backup_hist_count", String(soPhienLichSu));
        soLanBoQuaSaoLuuGiam = 0;
        lastAutoBackupRunTs = nowTs;

        // Bản luân phiên theo ngày chẵn/lẻ (tối đa 1 lần/giờ): luôn còn lại 1 bản của ngày trước,
        // phòng khi bản mới nhất bị ghi hỏng.
        try {
          const tsLuanPhien = parseInt(localStorage.getItem("last_parity_backup_ts") || "0", 10) || 0;
          if (nowTs - tsLuanPhien > 3600000) {
            const ngayLocal = Math.floor((nowTs - now.getTimezoneOffset() * 60000) / 86400000);
            const slot = (ngayLocal % 2) + 1;
            const r2 = window.AndroidNative.saveFileToDownload(`QuanLyKho_AutoBackup_Ngay${slot}.json`, base64Data, "application/json");
            if (!(r2 === false || r2 === "false")) localStorage.setItem("last_parity_backup_ts", String(nowTs));
          }
        } catch (e2) { }

        capNhatChiBaoAutoBackup(`💾 Tự động sao lưu: ${thoiGianHienThi} (Máy)`, "success");
      } else {
        // 2. Trên Web Browser / PWA: Không lưu bản chụp đầy đủ vào localStorage để tránh nhân đôi dung lượng & tràn bộ nhớ
        localStorage.setItem("last_auto_backup_hash", currentHash);
        localStorage.setItem("last_auto_backup_time", thoiGianHienThi);
        lastAutoBackupRunTs = nowTs;
        capNhatChiBaoAutoBackup(`💾 Đã lưu cục bộ: ${thoiGianHienThi}`, "info");
      }
    } catch (err) {
      console.warn("[AutoBackup] Lỗi tự động sao lưu:", err);
      capNhatChiBaoAutoBackup("💾 Lỗi tự động sao lưu: " + err.message, "warning");
    } finally {
      dangSaoLuuAuto = false;
    }
  }
  window.thucHienAutoBackup = thucHienAutoBackup;

  // Hàm kích hoạt có trễ khi kết thúc phiên hoặc dừng quét (bỏ qua nếu đang mở camera quét)
  function kichHoatKiemTraAutoBackup(delayMs = 4000) {
    if (document.body.classList.contains("cam-active")) return;
    if (timerDebounceAutoBackup) clearTimeout(timerDebounceAutoBackup);
    timerDebounceAutoBackup = setTimeout(() => {
      if (!document.body.classList.contains("cam-active")) {
        thucHienAutoBackup("after_scan");
      }
    }, delayMs);
  }
  window.kichHoatKiemTraAutoBackup = kichHoatKiemTraAutoBackup;

  // Tự động sao lưu khi ứng dụng chuyển sang chạy nền
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      thucHienAutoBackup("app_hidden");
    }
  });

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

window.batTatDenPinCamera = async function (videoId, btnId, currentState) {
  const videoEl = document.getElementById(videoId);
  if (!videoEl || !videoEl.srcObject) {
    if (typeof showCanhBao === "function") showCanhBao("Camera chưa sẵn sàng.", "warning");
    return currentState;
  }
  const track = videoEl.srcObject.getVideoTracks()[0];
  if (!track) return currentState;

  const capabilities = (typeof track.getCapabilities === "function") ? track.getCapabilities() : {};
  if (!capabilities.torch) {
    if (typeof showCanhBao === "function") showCanhBao("Thiết bị không hỗ trợ đèn pin.", "warning");
    return currentState;
  }

  const btnFlash = btnId ? document.getElementById(btnId) : null;
  if (btnFlash) btnFlash.disabled = true;

  const newState = !currentState;
  try {
    await track.applyConstraints({ advanced: [{ torch: newState }] });
    if (btnFlash) {
      btnFlash.classList.toggle("active-flash", newState);
      btnFlash.title = newState ? "Tắt đèn pin" : "Bật đèn pin";
      btnFlash.disabled = false;
    }
    return newState;
  } catch (err) {
    console.warn("Lỗi bật/tắt đèn pin:", err);
    if (typeof showCanhBao === "function") showCanhBao("Không thể bật/tắt đèn pin.", "error");
    if (btnFlash) btnFlash.disabled = false;
    return currentState;
  }
};

window.hienVienFeedbackCamera = function (containerSelector, loai) {
  const element = document.querySelector(containerSelector) || document.getElementById(containerSelector);
  if (!element) return;
  element.style.borderColor = loai === "success" ? "#22c55e" : "#ef4444";
  setTimeout(() => {
    element.style.borderColor = "";
  }, 600);
};

window.khoaCuonTrangQuet = function (isLock) {
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



// -- Hi?u ?ng Swipe-to-Delete toan c?c -----------------
let swipeStartX = 0;
let swipeStartY = 0;
let swipeCurrentX = 0;
let swipingRow = null;
let isSwiping = false;
let swipeHapticTriggered = false;

document.addEventListener('touchstart', (e) => {
  const row = e.target.closest('.cx5-swipe-row');
  if (!row) {
    const openRow = document.querySelector('.cx5-swipe-row.open');
    if (openRow && !e.target.closest('.cx5-del-btn')) {
      openRow.classList.remove('open');
    }
    return;
  }
  document.querySelectorAll('.cx5-swipe-row.open').forEach(r => {
    if (r !== row) r.classList.remove('open');
  });
  swipeStartX = e.touches[0].clientX;
  swipeStartY = e.touches[0].clientY;
  swipeCurrentX = swipeStartX;
  swipingRow = row;
  isSwiping = true;
  swipeHapticTriggered = false;
}, {passive: true});

document.addEventListener('touchmove', (e) => {
  if (!isSwiping || !swipingRow) return;
  swipeCurrentX = e.touches[0].clientX;
  const deltaX = swipeCurrentX - swipeStartX;
  const deltaY = Math.abs(e.touches[0].clientY - swipeStartY);
  if (deltaY > Math.abs(deltaX) && Math.abs(deltaX) < 15) return;

  const contentEl = swipingRow.querySelector('.cx5-swipe-content');
  if (contentEl && deltaX < 0) {
    const clamped = Math.max(-68, deltaX);
    contentEl.style.transition = 'none';
    contentEl.style.transform = `translateX(${clamped}px)`;
    if (deltaX < -30 && !swipeHapticTriggered) {
      swipeHapticTriggered = true;
      if (navigator.vibrate) { try { navigator.vibrate(10); } catch (err) {} }
    }
  }
}, {passive: true});

document.addEventListener('touchend', (e) => {
  if (!isSwiping || !swipingRow) return;
  const contentEl = swipingRow.querySelector('.cx5-swipe-content');
  if (contentEl) {
    contentEl.style.transition = '';
    contentEl.style.transform = '';
  }
  const deltaX = swipeCurrentX - swipeStartX;
  if (Math.abs(deltaX) > 30) {
    if (deltaX < -30) swipingRow.classList.add('open');
    else if (deltaX > 30) swipingRow.classList.remove('open');
  }
  isSwiping = false;
  swipingRow = null;
});

// Hỗ trợ kéo chuột trên Desktop/PC
let isMouseDragging = false;
document.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  const row = e.target.closest('.cx5-swipe-row');
  if (!row) {
    const openRow = document.querySelector('.cx5-swipe-row.open');
    if (openRow && !e.target.closest('.cx5-del-btn')) {
      openRow.classList.remove('open');
    }
    return;
  }
  document.querySelectorAll('.cx5-swipe-row.open').forEach(r => {
    if (r !== row) r.classList.remove('open');
  });
  swipeStartX = e.clientX;
  swipeCurrentX = swipeStartX;
  swipingRow = row;
  isMouseDragging = true;
});

document.addEventListener('mousemove', (e) => {
  if (!isMouseDragging || !swipingRow) return;
  swipeCurrentX = e.clientX;
});

document.addEventListener('mouseup', (e) => {
  if (!isMouseDragging || !swipingRow) return;
  const deltaX = swipeCurrentX - swipeStartX;
  if (Math.abs(deltaX) > 30) {
    if (deltaX < -30) swipingRow.classList.add('open');
    else if (deltaX > 30) swipingRow.classList.remove('open');
  }
  isMouseDragging = false;
  swipingRow = null;
});
