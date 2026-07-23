// ── Chỉ FOR ─────────────────────────────────────────────
let zxingReaderCX1 = null;
let dangQuetCX1 = false;
let phienCX1 = []; 
let demSoDot = 0;   
let denPinBat = false;
let ngayCX1 = null;

// Theo dõi phiên hiện tại để nối vào Lịch sử + tránh gửi trùng khi "tiếp tục" 1 phiên cũ
let idPhienHienTai = null;
let soLuongDaGuiHienTai = 0;

const CX1_LICHSU_KEY = "cx1_lich_su";
const CX1_LICHSU_SO_NGAY_GIU = 30;

let sharedAudioCtx = null;

function phatTiengBip() {
  if (navigator.vibrate) navigator.vibrate(80);
  try {
    if (!sharedAudioCtx) {
      sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = sharedAudioCtx;
    if (ctx.state === "suspended") {
      // Nhiều trình duyệt (đặc biệt Safari/iOS) tạm khoá AudioContext cho tới khi
      // được "mở khoá" — phải resume() xong rồi mới phát, nếu không sẽ im lặng
      ctx.resume().then(() => phatAmThanhSung(ctx)).catch(err => console.error("Không resume được AudioContext:", err));
    } else {
      phatAmThanhSung(ctx);
    }
  } catch (e) {
    console.error("Lỗi khởi tạo âm thanh:", e);
  }
}

function phatAmThanhSung(ctx) {
  try {
    const now = ctx.currentTime;
    const thoiLuong = 0.35;

    // Tiếng "crack" chính: white noise, lọc quét từ sáng (crack) xuống đục (đuôi tiếng nổ)
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

    // Lớp "thùm" trầm cho có lực, tắt nhanh hơn tiếng crack
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
  } catch (e) {
    console.error("Lỗi tạo âm thanh súng:", e);
  }
}

async function toggleFlashCX1() {
  if (!zxingReaderCX1 || !dangQuetCX1) return;
  try {
    const stream = document.getElementById("cx1-reader").srcObject;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    if (!capabilities.torch) { alert("Thiết bị không hỗ trợ đèn pin."); return; }
    denPinBat = !denPinBat;
    await track.applyConstraints({ advanced: [{ torch: denPinBat }] });
    const btnFlash = document.getElementById("btn-flash-cx1");
    btnFlash.style.background = denPinBat ? "var(--brass)" : "var(--neutral)";
    btnFlash.style.color = denPinBat ? "var(--bg)" : "var(--cream)";
    btnFlash.textContent = denPinBat ? "Tắt đèn" : "Bật đèn";
  } catch (err) {}
}

function xuLyDuLieuQR(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l !== "");
  if (lines.length < 2) return null;
  const id = lines[0] || "";
  const msp = lines[1] || ""; 
  const dongQCKG = lines.find(l => l.includes("-") && /\d+/.test(l)) || "";
  if (!dongQCKG) return null;
  const matchKG = dongQCKG.match(/[\d.]+$/); 
  const kg = matchKG ? parseFloat(matchKG[0]) : 0; 
  let qc = dongQCKG;
  if (matchKG) qc = dongQCKG.substring(0, dongQCKG.lastIndexOf(matchKG[0])).trim();
  if (qc.endsWith("-")) qc = qc.slice(0, -1).trim(); 
  if (!id || !msp) return null;
  return { id, msp, qc, kg };
}

let lanCanhBaoCuoi = 0;

function khiQuetDuocMa(result) {
  if (!result || !dangQuetCX1) return;
  const data = xuLyDuLieuQR(result.getText());
  if (!data) return;
  const trung = phienCX1.find(r => r.id === data.id && r.kg === data.kg);
  if (trung) {
    const now = Date.now();
    if (now - lanCanhBaoCuoi > 1500) {
      showCanhBaoCX1("Mã " + data.id + " + KG " + data.kg + " đã quét rồi");
      lanCanhBaoCuoi = now;
    }
    if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
    const vc = document.querySelector("#cx1-cam .video-container");
    if (vc) {
      vc.classList.add("canh-bao-trung");
      setTimeout(() => vc.classList.remove("canh-bao-trung"), 500);
    }
    return;
  }
  phatTiengBip();
  phienCX1.push({ 
    id: data.id, msp: data.msp, qc: data.qc, 
    kg: data.kg, thoiGian: new Date(), dotQuet: demSoDot 
  });
  document.getElementById("cx1-dem").textContent = "Đã quét: " + phienCX1.length + " mã";
  luuPhienDoDangCX1();
}

function luuPhienDoDangCX1() {
  try {
    localStorage.setItem("cx1_phien_dodang", JSON.stringify({
      phienCX1, demSoDot, ngayCX1, capNhat: new Date().toISOString(),
      idPhienHienTai, soLuongDaGuiHienTai
    }));
  } catch (e) {}
}

function xoaPhienDoDangCX1() {
  try { localStorage.removeItem("cx1_phien_dodang"); } catch (e) {}
}

function batDauCX1() {
  ngayCX1 = document.getElementById("cx1-ngay").value;
  if (!ngayCX1) { alert("Vui lòng chọn ngày!"); return; }

  let phienCu = null;
  try { phienCu = JSON.parse(localStorage.getItem("cx1_phien_dodang")); } catch (e) {}
  if (phienCu && Array.isArray(phienCu.phienCX1) && phienCu.phienCX1.length > 0) {
    const tiepTuc = confirm(
      "Bạn đang có phiên Chỉ For dở dang (" + phienCu.phienCX1.length + " mã, ngày " + phienCu.ngayCX1 + ").\n" +
      "Bấm OK để tiếp tục phiên đó, hoặc Cancel để xoá và bắt đầu phiên mới."
    );
    if (tiepTuc) { khoiPhucCX1(phienCu); return; }
    xoaPhienDoDangCX1();
  }

  phienCX1 = [];
  demSoDot = 1; 
  dangQuetCX1 = true;
  denPinBat = false;
  idPhienHienTai = Date.now() + "-" + Math.random().toString(36).slice(2);
  soLuongDaGuiHienTai = 0;

  document.getElementById("cx1-form").style.display = "none";
  document.getElementById("cx1-cam").style.display = "block";
  document.getElementById("cx1-ketqua").style.display = "none";
  document.getElementById("cx1-dem").textContent = "Đã quét: 0 mã";
  document.getElementById("cx1-status").textContent = "Đang quét Đợt 1...";
  document.getElementById("btn-flash-cx1").style.background = "var(--neutral)";
  document.getElementById("btn-flash-cx1").style.color = "var(--cream)";
  document.getElementById("btn-flash-cx1").textContent = "Bật đèn pin";

  const btnToggle = document.getElementById("btn-dung-tieptuc-cx1");
  btnToggle.textContent = "Dừng quét";
  btnToggle.className = "btn btn-red btn-full";

  try {
    const hints = new Map();
hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.QR_CODE]);
hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
zxingReaderCX1 = new ZXing.BrowserMultiFormatReader(hints);
zxingReaderCX1.decodeFromConstraints(
  { video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } },
  "cx1-reader",
  (result, err) => { khiQuetDuocMa(result); }
);
  } catch(e) {
    alert("Lỗi camera: " + e);
    dungCX1();
  }
}

function dungCX1() {
  dangQuetCX1 = false;
  if (zxingReaderCX1) { zxingReaderCX1.reset(); zxingReaderCX1 = null; }
  document.getElementById("cx1-status").textContent = "Đã dừng Đợt " + demSoDot;
}

function tiepTucCX1() {
  demSoDot += 1; 
  dangQuetCX1 = true;
  denPinBat = false;
  document.getElementById("cx1-status").textContent = "Đang quét Đợt " + demSoDot + "...";
  document.getElementById("btn-flash-cx1").style.background = "var(--neutral)";
  document.getElementById("btn-flash-cx1").style.color = "var(--cream)";
  document.getElementById("btn-flash-cx1").textContent = "Bật đèn pin";
  try {
    const hints = new Map();
hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.QR_CODE]);
hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
zxingReaderCX1 = new ZXing.BrowserMultiFormatReader(hints);
zxingReaderCX1.decodeFromConstraints(
  { video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } },
  "cx1-reader",
  (result, err) => { khiQuetDuocMa(result); }
);
  } catch(e) {
    alert("Lỗi camera: " + e);
    dungCX1();
  }
}

function toggleDungTiepTuc() {
  const btn = document.getElementById("btn-dung-tieptuc-cx1");
  if (dangQuetCX1) {
    dungCX1();
    btn.textContent = "Tiếp tục Đợt " + (demSoDot + 1);
    btn.className = "btn btn-blue btn-full";
  } else {
    tiepTucCX1();
    btn.textContent = "Dừng quét";
    btn.className = "btn btn-red btn-full";
  }
}

function docPendingCX1() {
  try {
    const raw = localStorage.getItem("cx1_pending_saves");
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function luuPendingCX1(list) {
  try { localStorage.setItem("cx1_pending_saves", JSON.stringify(list)); } catch (e) {}
}

async function guiLenSheetCX1(rows) {
  const URL_API = "https://script.google.com/macros/s/AKfycbzk7afcuHDOTnL6QSIQ0ZgT-CSiIDNZ8h5S8_IkGXahc7PQRvqZKpLpjkBphioXAyzDKQ/exec";
  await fetch(URL_API, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "luuCX1", data: rows })
  });
}

async function ketThucCX1() {
  dungCX1();
  xoaPhienDoDangCX1();

  // Hiện kết quả NGAY, lưu sheet chạy ngầm
  hienKetQuaCX1();

  // Chỉ gửi phần mã MỚI thêm kể từ lần gửi trước (tránh gửi trùng khi "tiếp tục" 1 phiên cũ)
  const moiBoSung = phienCX1.slice(soLuongDaGuiHienTai);
  if (moiBoSung.length > 0) {
    const rows = moiBoSung.map(r => ({
      id: r.id, msp: r.msp, qc: r.qc, kg: r.kg,
      ngay: ngayCX1,
      thoiGian: r.thoiGian.toISOString()
    }));
    try {
      await guiLenSheetCX1(rows);
      soLuongDaGuiHienTai = phienCX1.length;
    } catch (err) {
      const pending = docPendingCX1();
      pending.push(...rows);
      luuPendingCX1(pending);
      showCanhBaoCX1("Mất mạng — đã lưu tạm trên máy, sẽ tự gửi lại sau");
      // Coi như đã "xử lý" phần này để không gửi trùng lần sau — phần chưa gửi
      // thật sự vẫn nằm an toàn trong hàng đợi pending, sẽ tự gửi khi có mạng
      soLuongDaGuiHienTai = phienCX1.length;
    }
    if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
  }

  luuVaoLichSuCX1();
}

function taoHangKetQuaCX1(danhSach) {
  let tongDotCuaPhien = {};
  let tongGomLoaiMa = {};
  let tongQRAll = 0;
  let tongKGAll = 0;

  danhSach.forEach(r => {
    tongQRAll += 1;
    tongKGAll += r.kg;

    const keyDot = r.dotQuet + "|" + r.msp + "|" + r.qc;
    if (!tongDotCuaPhien[keyDot]) {
      tongDotCuaPhien[keyDot] = { dot: r.dotQuet, msp: r.msp, qc: r.qc, soLuong: 0, tongKG: 0 };
    }
    tongDotCuaPhien[keyDot].soLuong += 1;
    tongDotCuaPhien[keyDot].tongKG += r.kg;

    const keyGom = r.msp + "|" + r.qc;
    if (!tongGomLoaiMa[keyGom]) {
      tongGomLoaiMa[keyGom] = { msp: r.msp, qc: r.qc, soLuong: 0, tongKG: 0 };
    }
    tongGomLoaiMa[keyGom].soLuong += 1;
    tongGomLoaiMa[keyGom].tongKG += r.kg;
  });

  let hangDot = "";
  Object.values(tongDotCuaPhien).forEach(item => {
    hangDot += `
  <tr>
    <td style="padding:10px;border-bottom:1px solid rgba(237,230,214,.1);color:var(--brass);font-weight:700"> ${item.dot}</td>
    <td style="padding:10px;border-bottom:1px solid rgba(237,230,214,.1)">${item.msp}</td>
    <td style="padding:10px;border-bottom:1px solid rgba(237,230,214,.1)">${item.qc}</td>
    <td style="padding:10px;border-bottom:1px solid rgba(237,230,214,.1);text-align:center">${item.soLuong}</td>
    <td style="padding:10px;border-bottom:1px solid rgba(237,230,214,.1);text-align:right;font-weight:700;color:var(--success)">${item.tongKG.toFixed(1)}</td>
  </tr>`;
  });
  hangDot += `
  <tr>
    <td style="padding:10px;font-weight:700;color:var(--brass);background:rgba(237,230,214,.03)">TỔNG</td>
    <td style="padding:10px;background:rgba(237,230,214,.03)"></td>
    <td style="padding:10px;background:rgba(237,230,214,.03)"></td>
    <td style="padding:10px;text-align:center;font-weight:700;color:var(--brass);background:rgba(237,230,214,.03)">${tongQRAll}</td>
    <td style="padding:10px;text-align:right;font-weight:700;color:var(--brass);background:rgba(237,230,214,.03)">${tongKGAll.toFixed(1)}</td>
  </tr>`;

  let hangGom = "";
  Object.values(tongGomLoaiMa).forEach(item => {
    hangGom += `
  <tr>
    <td style="padding:10px;border-bottom:1px solid rgba(237,230,214,.1)">${item.msp}</td>
    <td style="padding:10px;border-bottom:1px solid rgba(237,230,214,.1)">${item.qc}</td>
    <td style="padding:10px;border-bottom:1px solid rgba(237,230,214,.1);text-align:center;font-weight:700">${item.soLuong}</td>
    <td style="padding:10px;border-bottom:1px solid rgba(237,230,214,.1);text-align:right;font-weight:700;color:var(--success)">${item.tongKG.toFixed(1)}</td>
  </tr>`;
  });
  hangGom += `
  <tr>
    <td colspan="2" style="padding:10px;font-weight:700;color:var(--steel);background:rgba(237,230,214,.03)">TỔNG</td>
    <td style="padding:10px;text-align:center;font-weight:700;color:var(--steel);background:rgba(237,230,214,.03)">${tongQRAll}</td>
    <td style="padding:10px;text-align:right;font-weight:700;color:var(--steel);background:rgba(237,230,214,.03)">${tongKGAll.toFixed(1)}</td>
  </tr>`;

  return { hangDot, hangGom };
}

function hienKetQuaCX1() {
  const { hangDot, hangGom } = taoHangKetQuaCX1(phienCX1);
  document.getElementById("cx1-tbody-dot").innerHTML = hangDot;
  document.getElementById("cx1-tbody-gom").innerHTML = hangGom;

  document.getElementById("cx1-cam").style.display = "none";
  document.getElementById("cx1-ketqua").style.display = "block";
}

function quetTiepCX1() {
  // Giữ nguyên dữ liệu cũ, mở camera quét tiếp
  demSoDot += 1;
  dangQuetCX1 = true;
  denPinBat = false;

  document.getElementById("cx1-ketqua").style.display = "none";
  document.getElementById("cx1-cam").style.display = "block";
  document.getElementById("cx1-status").textContent = "Đang quét Đợt " + demSoDot + "...";

  const btnToggle = document.getElementById("btn-dung-tieptuc-cx1");
  btnToggle.textContent = "Dừng quét";
  btnToggle.className = "btn btn-red btn-full";

  try {
    const hints = new Map();
hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.QR_CODE]);
hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
zxingReaderCX1 = new ZXing.BrowserMultiFormatReader(hints);
zxingReaderCX1.decodeFromConstraints(
  { video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } },
  "cx1-reader",
  (result, err) => { khiQuetDuocMa(result); }
);
  } catch(e) {
    alert("Lỗi camera: " + e);
    dungCX1();
  }
}

function quetMoiCX1() {
  phienCX1 = [];
  demSoDot = 0;
  idPhienHienTai = null;
  soLuongDaGuiHienTai = 0;
  xoaPhienDoDangCX1();
  document.getElementById("cx1-ketqua").style.display = "none";
  document.getElementById("cx1-form").style.display = "block";
}

function showCanhBaoCX1(text) {
  const el = document.getElementById("canh-bao");
  el.textContent = text;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 2000);
}

// Khôi phục lại 1 phiên Chỉ For đã lưu (từ banner "Phiên dở dang" ở Trang chủ,
// hoặc khi bấm Quét mà đang có phiên cũ chưa xử lý)
function khoiPhucCX1(state) {
  phienCX1 = state.phienCX1.map(r => ({ ...r, thoiGian: new Date(r.thoiGian) }));
  demSoDot = state.demSoDot || 1;
  ngayCX1 = state.ngayCX1;
  idPhienHienTai = state.idPhienHienTai || (Date.now() + "-" + Math.random().toString(36).slice(2));
  soLuongDaGuiHienTai = state.soLuongDaGuiHienTai !== undefined ? state.soLuongDaGuiHienTai
    : (state.soLuongDaGui !== undefined ? state.soLuongDaGui : 0);
  dangQuetCX1 = true;
  denPinBat = false;

  document.getElementById("cx1-form").style.display = "none";
  document.getElementById("cx1-cam").style.display = "block";
  document.getElementById("cx1-ketqua").style.display = "none";
  document.getElementById("cx1-dem").textContent = "Đã quét: " + phienCX1.length + " mã";
  document.getElementById("cx1-status").textContent = "Đang quét Đợt " + demSoDot + "...";
  document.getElementById("btn-flash-cx1").style.background = "var(--neutral)";
  document.getElementById("btn-flash-cx1").style.color = "var(--cream)";
  document.getElementById("btn-flash-cx1").textContent = "Bật đèn pin";

  const btnToggle = document.getElementById("btn-dung-tieptuc-cx1");
  btnToggle.textContent = "Dừng quét";
  btnToggle.className = "btn btn-red btn-full";

  try {
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.QR_CODE]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    zxingReaderCX1 = new ZXing.BrowserMultiFormatReader(hints);
    zxingReaderCX1.decodeFromConstraints(
      { video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } },
      "cx1-reader",
      (result, err) => { khiQuetDuocMa(result); }
    );
  } catch (e) {
    alert("Lỗi camera: " + e);
    dungCX1();
  }
}

function tiepTucPhienChiFor() {
  let state = null;
  try { state = JSON.parse(localStorage.getItem("cx1_phien_dodang")); } catch (e) {}
  if (!state) return;
  if (typeof diToiTab === "function") diToiTab("chiFor");
  khoiPhucCX1(state);
}

function huyPhienChiFor() {
  xoaPhienDoDangCX1();
  if (typeof capNhatTrangChu === "function") capNhatTrangChu();
}

window.addEventListener("load", function() {
  const today = new Date().toISOString().split("T")[0];
  const ngayInput = document.getElementById("cx1-ngay");
  if (ngayInput) ngayInput.value = today;
});

window.addEventListener("load", async function() {
  const pending = docPendingCX1();
  if (pending.length === 0) return;
  try {
    await guiLenSheetCX1(pending);
    luuPendingCX1([]);
  } catch (e) {
    // vẫn còn offline, giữ nguyên để thử lại lần tới
  }
  if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
});

window.addEventListener("online", async function() {
  const pending = docPendingCX1();
  if (pending.length === 0) return;
  try {
    await guiLenSheetCX1(pending);
    luuPendingCX1([]);
  } catch (e) {}
  if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
});

function xuatCSVCX1() {
  if (phienCX1.length === 0) { alert("Chưa có dữ liệu để xuất"); return; }
  const header = ["Dot", "MSP", "QC", "KG", "ThoiGian"];
  const rows = phienCX1.map(r => [r.dotQuet, r.msp, r.qc, r.kg, r.thoiGian.toISOString()]);
  const escapeCSV = v => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map(row => row.map(escapeCSV).join(",")).join("\r\n");
  const bom = "\uFEFF"; // giúp Excel đọc đúng tiếng Việt có dấu
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ngay = ngayCX1 || new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = "chi-for-" + ngay + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Lịch sử Chỉ For (lưu 3 ngày gần nhất, xem lại + tiếp tục quét) ─────
let dangXemLichSuId = null;

function docLichSuCX1() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(CX1_LICHSU_KEY)) || []; } catch (e) { list = []; }
  const homNay = new Date();
  homNay.setHours(0, 0, 0, 0);
  return list.filter(s => {
    if (!s.ngay) return false;
    const ngayPhien = new Date(s.ngay + "T00:00:00");
    const soNgayCach = Math.floor((homNay - ngayPhien) / 86400000);
    return soNgayCach >= 0 && soNgayCach < CX1_LICHSU_SO_NGAY_GIU;
  });
}

function luuLichSuCX1(list) {
  try { localStorage.setItem(CX1_LICHSU_KEY, JSON.stringify(list)); } catch (e) {}
}

function donDepLichSuCX1() {
  luuLichSuCX1(docLichSuCX1());
}

function luuVaoLichSuCX1() {
  if (phienCX1.length === 0 || !idPhienHienTai) return;
  const list = docLichSuCX1();
  const idx = list.findIndex(s => s.idPhien === idPhienHienTai);
  const banGhi = {
    idPhien: idPhienHienTai,
    ngay: ngayCX1,
    capNhatLuc: new Date().toISOString(),
    phienCX1: phienCX1,
    demSoDot: demSoDot,
    soLuongDaGui: soLuongDaGuiHienTai
  };
  if (idx >= 0) list[idx] = banGhi; else list.push(banGhi);
  luuLichSuCX1(list);
  if (typeof renderLichSuCX1 === "function") renderLichSuCX1();
}

function moLichSuCX1() {
  renderLichSuCX1();
  if (typeof chuyenTrangKhongNav === "function") chuyenTrangKhongNav("lichSu");
}
window.moLichSuCX1 = moLichSuCX1;

function renderLichSuCX1() {
  const container = document.getElementById("lichsu-list");
  if (!container) return;
  const list = docLichSuCX1().slice().sort((a, b) => new Date(b.capNhatLuc) - new Date(a.capNhatLuc));

  if (list.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--cream-soft);padding:20px 0;">Chưa có phiên nào trong ' + CX1_LICHSU_SO_NGAY_GIU + ' ngày qua</div>';
    return;
  }

  container.innerHTML = list.map(function (s) {
    const tongKg = s.phienCX1.reduce(function (t, r) { return t + r.kg; }, 0).toFixed(1);
    const gio = new Date(s.capNhatLuc).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return '<div class="irow" style="cursor:pointer" onclick="xemChiTietLichSuCX1(\'' + s.idPhien + '\')">'
      + '<span class="ilabel">' + s.ngay + ' · ' + gio + '</span>'
      + '<span class="ivalue">' + s.phienCX1.length + ' mã · ' + tongKg + ' kg</span>'
      + '</div>';
  }).join("");
}
window.renderLichSuCX1 = renderLichSuCX1;

function xemChiTietLichSuCX1(idPhien) {
  const list = docLichSuCX1();
  const entry = list.find(s => s.idPhien === idPhien);
  if (!entry) return;

  dangXemLichSuId = idPhien;
  const { hangDot, hangGom } = taoHangKetQuaCX1(entry.phienCX1);
  document.getElementById("lichsu-tbody-dot").innerHTML = hangDot;
  document.getElementById("lichsu-tbody-gom").innerHTML = hangGom;
  document.getElementById("lichsu-chitiet-tieude").textContent = "Chỉ For — " + entry.ngay;

  if (typeof chuyenTrangKhongNav === "function") chuyenTrangKhongNav("lichsuChiTiet");
}
window.xemChiTietLichSuCX1 = xemChiTietLichSuCX1;

function tiepTucLichSuCX1(idPhien) {
  const list = docLichSuCX1();
  const entry = list.find(s => s.idPhien === idPhien);
  if (!entry) return;

  if (typeof diToiTab === "function") diToiTab("chiFor");
  khoiPhucCX1({
    phienCX1: entry.phienCX1,
    demSoDot: entry.demSoDot,
    ngayCX1: entry.ngay,
    idPhienHienTai: entry.idPhien,
    soLuongDaGuiHienTai: entry.soLuongDaGui
  });
}

function tiepTucTuChiTietLichSu() {
  if (dangXemLichSuId) tiepTucLichSuCX1(dangXemLichSuId);
}
window.tiepTucTuChiTietLichSu = tiepTucTuChiTietLichSu;
