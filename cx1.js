// ── Chỉ FOR ─────────────────────────────────────────────
let zxingReaderCX1 = null;
let dangQuetCX1 = false;
let phienCX1 = []; 
let demSoDot = 0;   
let denPinBat = false;
let ngayCX1 = null;

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
    const compressor = ctx.createDynamicsCompressor();
    compressor.connect(ctx.destination);

    // Tiếng beep 2 tông kiểu máy quét kho: tông 1 rồi tông 2 cao hơn, liền nhau
    const taoBeep = (tanSo, batDau, thoiLuong, bienDo) => {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(tanSo, batDau);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, batDau);
      gain.gain.linearRampToValueAtTime(bienDo, batDau + 0.005);
      gain.gain.setValueAtTime(bienDo, batDau + thoiLuong - 0.02);
      gain.gain.linearRampToValueAtTime(0, batDau + thoiLuong);

      osc.connect(gain);
      gain.connect(compressor);

      osc.start(batDau);
      osc.stop(batDau + thoiLuong);
    };

    taoBeep(1800, now, 0.07, 0.5);
    taoBeep(2600, now + 0.08, 0.09, 0.5);
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
      phienCX1, demSoDot, ngayCX1, trangThai: "quet", capNhat: new Date().toISOString()
    }));
  } catch (e) {}
}

// Lưu lại dạng "đã kết thúc, chờ xử lý" — giữ nguyên dữ liệu để xem lại kết quả
// sau khi thoát ra Trang chủ hoặc tắt hẳn app rồi mở lại
function luuKetQuaCX1() {
  try {
    localStorage.setItem("cx1_phien_dodang", JSON.stringify({
      phienCX1, demSoDot, ngayCX1, trangThai: "ketqua", capNhat: new Date().toISOString()
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
  luuKetQuaCX1();

  // Hiện kết quả NGAY, lưu sheet chạy ngầm
  hienKetQuaCX1();

  // Lưu sheet ngầm — nếu mất mạng thì giữ tạm trên máy để gửi lại sau
  if (phienCX1.length > 0) {
    const rows = phienCX1.map(r => ({
      id: r.id, msp: r.msp, qc: r.qc, kg: r.kg,
      ngay: ngayCX1,
      thoiGian: r.thoiGian.toISOString()
    }));
    try {
      await guiLenSheetCX1(rows);
    } catch (err) {
      const pending = docPendingCX1();
      pending.push(...rows);
      luuPendingCX1(pending);
      showCanhBaoCX1("Mất mạng — đã lưu tạm trên máy, sẽ tự gửi lại sau");
    }
    if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
  }
}

function hienKetQuaCX1() {
  let tongDotCuaPhien = {}; 
  let tongGomLoaiMa = {};   
  let tongQRAll = 0;
  let tongKGAll = 0;

  phienCX1.forEach(r => {
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

  const tbodyDot = document.getElementById("cx1-tbody-dot");
  tbodyDot.innerHTML = "";
  Object.values(tongDotCuaPhien).forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
  <td style="padding:10px;border-bottom:1px solid rgba(237,230,214,.1);color:var(--brass);font-weight:700"> ${item.dot}</td>
  <td style="padding:10px;border-bottom:1px solid rgba(237,230,214,.1)">${item.msp}</td>
  <td style="padding:10px;border-bottom:1px solid rgba(237,230,214,.1)">${item.qc}</td>
  <td style="padding:10px;border-bottom:1px solid rgba(237,230,214,.1);text-align:center">${item.soLuong}</td>
  <td style="padding:10px;border-bottom:1px solid rgba(237,230,214,.1);text-align:right;font-weight:700;color:var(--success)">${item.tongKG.toFixed(1)}</td>
`;
    tbodyDot.appendChild(tr);
  });
  
  const trTongDot = document.createElement("tr");
  trTongDot.innerHTML = `
  <td style="padding:10px;font-weight:700;color:var(--brass);background:rgba(237,230,214,.03)">TỔNG</td>
  <td style="padding:10px;background:rgba(237,230,214,.03)"></td>
  <td style="padding:10px;background:rgba(237,230,214,.03)"></td>
  <td style="padding:10px;text-align:center;font-weight:700;color:var(--brass);background:rgba(237,230,214,.03)">${tongQRAll}</td>
  <td style="padding:10px;text-align:right;font-weight:700;color:var(--brass);background:rgba(237,230,214,.03)">${tongKGAll.toFixed(1)}</td>
`;
  tbodyDot.appendChild(trTongDot);

  const tbodyGom = document.getElementById("cx1-tbody-gom");
  tbodyGom.innerHTML = "";
  Object.values(tongGomLoaiMa).forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding:10px;border-bottom:1px solid rgba(237,230,214,.1)">${item.msp}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(237,230,214,.1)">${item.qc}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(237,230,214,.1);text-align:center;font-weight:700">${item.soLuong}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(237,230,214,.1);text-align:right;font-weight:700;color:var(--success)">${item.tongKG.toFixed(1)}</td>
    `;
    tbodyGom.appendChild(tr);
  });
  
  const trTongGom = document.createElement("tr");
  trTongGom.innerHTML = `
    <td colspan="2" style="padding:10px;font-weight:700;color:var(--steel);background:rgba(237,230,214,.03)">TỔNG</td>
    <td style="padding:10px;text-align:center;font-weight:700;color:var(--steel);background:rgba(237,230,214,.03)">${tongQRAll}</td>
    <td style="padding:10px;text-align:right;font-weight:700;color:var(--steel);background:rgba(237,230,214,.03)">${tongKGAll.toFixed(1)}</td>
  `;
  tbodyGom.appendChild(trTongGom);

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
  if (state.trangThai === "ketqua") {
    khoiPhucKetQuaCX1(state);
  } else {
    khoiPhucCX1(state);
  }
}

// Khôi phục lại màn hình KẾT QUẢ (không mở camera) — dùng khi phiên đã
// bấm "Kết Thúc" rồi mới thoát ra Trang chủ, hoặc tắt hẳn app rồi mở lại
function khoiPhucKetQuaCX1(state) {
  phienCX1 = state.phienCX1.map(r => ({ ...r, thoiGian: new Date(r.thoiGian) }));
  demSoDot = state.demSoDot || 1;
  ngayCX1 = state.ngayCX1;
  dangQuetCX1 = false;

  document.getElementById("cx1-form").style.display = "none";
  document.getElementById("cx1-cam").style.display = "none";
  hienKetQuaCX1();
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
