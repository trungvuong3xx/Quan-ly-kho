// ── Chỉ FOR ─────────────────────────────────────────────
let zxingReaderCX1 = null;
let dangQuetCX1 = false;
let phienCX1 = []; 
let demSoDot = 0;   
let denPinBat = false;
let ngayCX1 = null;

function phatTiengBip() {
  if (navigator.vibrate) navigator.vibrate(50);
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const compressor = audioCtx.createDynamicsCompressor();
    oscillator.connect(gainNode);
    gainNode.connect(compressor);
    compressor.connect(audioCtx.destination);
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(1800, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.08);
    gainNode.gain.setValueAtTime(1.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.18);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.18);
  } catch (e) {}
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
    btnFlash.style.background = denPinBat ? "#eab308" : "#6b7280";
    btnFlash.textContent = denPinBat ? "🔦 Tắt" : "🔦 Bật";
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

function khiQuetDuocMa(result) {
  if (!result || !dangQuetCX1) return;
  const data = xuLyDuLieuQR(result.getText());
  if (!data) return;
  const trung = phienCX1.find(r => r.id === data.id && r.kg === data.kg);
  if (trung) {
    showCanhBaoCX1("⚠️ Mã " + data.id + " + KG " + data.kg + " đã quét rồi!");
    return;
  }
  phatTiengBip();
  phienCX1.push({ 
    id: data.id, msp: data.msp, qc: data.qc, 
    kg: data.kg, thoiGian: new Date(), dotQuet: demSoDot 
  });
  document.getElementById("cx1-dem").textContent = "Đã quét: " + phienCX1.length + " mã";
}

function batDauCX1() {
  ngayCX1 = document.getElementById("cx1-ngay").value;
  if (!ngayCX1) { alert("⚠️ Vui lòng chọn ngày!"); return; }

  phienCX1 = [];
  demSoDot = 1; 
  dangQuetCX1 = true;
  denPinBat = false;

  document.getElementById("cx1-form").style.display = "none";
  document.getElementById("cx1-cam").style.display = "block";
  document.getElementById("cx1-ketqua").style.display = "none";
  document.getElementById("cx1-dem").textContent = "Đã quét: 0 mã";
  document.getElementById("cx1-status").textContent = "🟢 Đang quét Đợt 1...";
  document.getElementById("btn-flash-cx1").style.background = "#6b7280";
  document.getElementById("btn-flash-cx1").textContent = "🔦 Bật Đèn Pin";

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
  document.getElementById("cx1-status").textContent = "🟢 Đang quét Đợt " + demSoDot + "...";
  document.getElementById("btn-flash-cx1").style.background = "#6b7280";
  document.getElementById("btn-flash-cx1").textContent = "🔦 Bật Đèn Pin";
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

async function ketThucCX1() {
  dungCX1();

  // Hiện kết quả NGAY, lưu sheet chạy ngầm
  hienKetQuaCX1();

  // Lưu sheet ngầm
  if (phienCX1.length > 0) {
    try {
      const URL_API = "https://script.google.com/macros/s/AKfycbzk7afcuHDOTnL6QSIQ0ZgT-CSiIDNZ8h5S8_IkGXahc7PQRvqZKpLpjkBphioXAyzDKQ/exec"; 
      fetch(URL_API, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "luuCX1",
          data: phienCX1.map(r => ({
            id: r.id, msp: r.msp, qc: r.qc, kg: r.kg,
            ngay: ngayCX1,
            thoiGian: r.thoiGian.toISOString()
          }))
        })
      });
    } catch (err) {}
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
  <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06);color:#eab308;font-weight:700"> ${item.dot}</td>
  <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${item.msp}</td>
  <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${item.qc}</td>
  <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:center">${item.soLuong}</td>
  <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:right;font-weight:700;color:#22c55e">${item.tongKG.toFixed(1)}</td>
`;
    tbodyDot.appendChild(tr);
  });
  
  const trTongDot = document.createElement("tr");
  trTongDot.innerHTML = `
  <td style="padding:10px;font-weight:700;color:#eab308;background:rgba(255,255,255,.02)">TỔNG</td>
  <td style="padding:10px;background:rgba(255,255,255,.02)"></td>
  <td style="padding:10px;background:rgba(255,255,255,.02)"></td>
  <td style="padding:10px;text-align:center;font-weight:700;color:#eab308;background:rgba(255,255,255,.02)">${tongQRAll}</td>
  <td style="padding:10px;text-align:right;font-weight:700;color:#eab308;background:rgba(255,255,255,.02)">${tongKGAll.toFixed(1)}</td>
`;
  tbodyDot.appendChild(trTongDot);

  const tbodyGom = document.getElementById("cx1-tbody-gom");
  tbodyGom.innerHTML = "";
  Object.values(tongGomLoaiMa).forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${item.msp}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${item.qc}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:center;font-weight:700">${item.soLuong}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:right;font-weight:700;color:#22c55e">${item.tongKG.toFixed(1)}</td>
    `;
    tbodyGom.appendChild(tr);
  });
  
  const trTongGom = document.createElement("tr");
  trTongGom.innerHTML = `
    <td colspan="2" style="padding:10px;font-weight:700;color:#3b82f6;background:rgba(255,255,255,.02)">TỔNG</td>
    <td style="padding:10px;text-align:center;font-weight:700;color:#3b82f6;background:rgba(255,255,255,.02)">${tongQRAll}</td>
    <td style="padding:10px;text-align:right;font-weight:700;color:#3b82f6;background:rgba(255,255,255,.02)">${tongKGAll.toFixed(1)}</td>
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
  document.getElementById("cx1-status").textContent = "🟢 Đang quét Đợt " + demSoDot + "...";

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
  document.getElementById("cx1-ketqua").style.display = "none";
  document.getElementById("cx1-form").style.display = "block";
}

function showCanhBaoCX1(text) {
  const el = document.getElementById("canh-bao");
  el.textContent = text;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 2000);
}

window.addEventListener("load", function() {
  const today = new Date().toISOString().split("T")[0];
  const ngayInput = document.getElementById("cx1-ngay");
  if (ngayInput) ngayInput.value = today;
});
