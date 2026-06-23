// ── Chỉ FOR ─────────────────────────────────────────────
let zxingReaderCX1 = null;
let dangQuetCX1 = false;
let phienCX1 = []; // lưu chi tiết từng tem QR quét được
let demSoDot = 0;   // Đếm số đợt bấm quét trong phiên

// Hàm tự động phát tiếng bíp bằng Web Audio API (Không cần file .mp3)
function phatTiengBip() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = "sine"; 
    oscillator.frequency.value = 1200; // Tần số 1200Hz nghe thanh và rõ
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); 

    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.1);
    oscillator.stop(audioCtx.currentTime + 0.1);
  } catch (e) {
    console.log("Trình duyệt chặn âm thanh: " + e);
  }
}

// Hàm xử lý bóc tách dữ liệu từ QR thông minh bằng Regex
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
  if (matchKG) {
    qc = dongQCKG.substring(0, dongQCKG.lastIndexOf(matchKG[0])).trim();
  }
  if (qc.endsWith("-")) {
    qc = qc.slice(0, -1).trim(); 
  }

  if (!id || !msp) return null;
  return { id, msp, qc, kg };
}

// Hàm xử lý khi camera bắt được mã QR
function khiQuetDuocMa(result) {
  if (!result || !dangQuetCX1) return;

  const data = xuLyDuLieuQR(result.getText());
  if (!data) return; 

  // Kiểm tra trùng ID trên toàn bộ phiên quét hiện tại
  if (phienCX1.find(r => r.id === data.id)) {
    showCanhBaoCX1("⚠️ Mã " + data.id + " đã quét rồi!");
    return;
  }

  // Hợp lệ -> Phát tiếng bíp lập tức
  phatTiengBip();

  // Ghi nhận dữ liệu kèm theo số thứ tự của Đợt quét hiện tại
  const thoiGian = new Date();
  phienCX1.push({ 
    id: data.id, 
    msp: data.msp, 
    qc: data.qc, 
    kg: data.kg, 
    thoiGian,
    dotQuet: demSoDot // Đóng dấu thuộc đợt quét nào
  });

  document.getElementById("cx1-dem").textContent = "Đã quét: " + phienCX1.length + " mã";
}

function batDauCX1() {
  phienCX1 = [];
  demSoDot = 1; // Khởi tạo đợt quét đầu tiên
  dangQuetCX1 = true;

  document.getElementById("cx1-form").style.display = "none";
  document.getElementById("cx1-cam").style.display = "block";
  document.getElementById("cx1-ketqua").style.display = "none";
  document.getElementById("cx1-dem").textContent = "Đã quét: 0 mã";
  document.getElementById("cx1-status").textContent = "🟢 Đang quét Đợt 1...";

  try {
    zxingReaderCX1 = new ZXing.BrowserMultiFormatReader();
    zxingReaderCX1.decodeFromVideoDevice(undefined, "cx1-reader", async (result, err) => {
      khiQuetDuocMa(result);
    });
  } catch(e) {
    alert("Lỗi camera: " + e);
    dungCX1();
  }
}

function dungCX1() {
  dangQuetCX1 = false;
  if (zxingReaderCX1) { zxingReaderCX1.reset(); zxingReaderCX1 = null; }
  document.getElementById("cx1-status").textContent = "⏸️ Đã dừng Đợt " + demSoDot;
  document.getElementById("btn-tieptuc-cx1").style.display = "block";
  document.getElementById("btn-dung-cx1").style.display = "none";
}

function tiepTucCX1() {
  demSoDot += 1; // Tự động tăng số đợt quét lên (Đợt 2, Đợt 3, Đợt 4...)
  dangQuetCX1 = true;
  document.getElementById("cx1-status").textContent = "🟢 Đang quét Đợt " + demSoDot + "...";
  document.getElementById("btn-tieptuc-cx1").style.display = "none";
  document.getElementById("btn-dung-cx1").style.display = "block";

  zxingReaderCX1 = new ZXing.BrowserMultiFormatReader();
  zxingReaderCX1.decodeFromVideoDevice(undefined, "cx1-reader", async (result, err) => {
    khiQuetDuocMa(result);
  });
}

async function ketThucCX1() {
  dungCX1();

  // 1. Gửi API lưu dữ liệu vào Sheet
  if (phienCX1.length > 0) {
    document.getElementById("cx1-status").textContent = "⏳ Đang lưu...";
    await callAPI({ action: "luuCX1", data: phienCX1.map(r => ({
      id: r.id, msp: r.msp, qc: r.qc, kg: r.kg,
      thoiGian: r.thoiGian.toISOString()
    }))});
  }

  // 2. Tính toán phân tích dữ liệu cho 2 bảng riêng biệt
  let tongDotCuaPhien = {}; // Gom theo từng đợt quét
  let tongGomLoaiMa = {};   // Gom theo loại mã toàn phiên
  let tongQRAll = 0;
  let tongKGAll = 0;

  phienCX1.forEach(r => {
    tongQRAll += 1;
    tongKGAll += r.kg;

    // A. Gom dữ liệu cho BẢNG 1 (Theo Đợt + MSP + QC)
    const keyDot = "Dot_" + r.dotQuet + "|" + r.msp + "|" + r.qc;
    if (!tongDotCuaPhien[keyDot]) {
      tongDotCuaPhien[keyDot] = { dot: r.dotQuet, msp: r.msp, qc: r.qc, soLuong: 0, tongKG: 0 };
    }
    tongDotCuaPhien[keyDot].soLuong += 1;
    tongDotCuaPhien[keyDot].tongKG += r.kg;

    // B. Gom dữ liệu cho BẢNG 2 (Tổng hợp gom theo loại mã toàn phiên)
    const keyGom = r.msp + "|" + r.qc;
    if (!tongGomLoaiMa[keyGom]) {
      tongGomLoaiMa[keyGom] = { msp: r.msp, qc: r.qc, soLuong: 0, tongKG: 0 };
    }
    tongGomLoaiMa[keyGom].soLuong += 1;
    tongGomLoaiMa[keyGom].tongKG += r.kg;
  });

  // 3. Đổ dữ liệu vào BẢNG 1: CHI TIẾT THEO TỪNG ĐỢT QUÉT
  const tbodyDot = document.getElementById("cx1-tbody-dot");
  tbodyDot.innerHTML = "";
  Object.values(tongDotCuaPhien).forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06);font-weight:700;color:#eab308">Đợt ${item.dot}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${item.msp}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${item.qc}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:center">${item.soLuong}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:right;font-weight:700;color:#22c55e">${item.tongKG.toFixed(2)}</td>
    `;
    tbodyDot.appendChild(tr);
  });
  // Dòng tổng của Bảng 1
  const trTongDot = document.createElement("tr");
  trTongDot.innerHTML = `
    <td colspan="3" style="padding:10px;font-weight:700;color:#eab308">TỔNG CỘNG TIẾN ĐỘ</td>
    <td style="padding:10px;text-align:center;font-weight:700;color:#eab308">${tongQRAll}</td>
    <td style="padding:10px;text-align:right;font-weight:700;color:#eab308">${tongKGAll.toFixed(2)}</td>
  `;
  tbodyDot.appendChild(trTong);


  // 4. Đổ dữ liệu vào BẢNG 2: TỔNG HỢP GOM THEO LOẠI MÃ
  const tbodyGom = document.getElementById("cx1-tbody-gom");
  tbodyGom.innerHTML = "";
  Object.values(tongGomLoaiMa).forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${item.msp}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${item.qc}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:center;font-weight:700;">${item.soLuong}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:right;font-weight:700;color:#22c55e">${item.tongKG.toFixed(2)}</td>
    `;
    tbodyGom.appendChild(tr);
  });
  // Dòng tổng của Bảng 2
  const trTongGom = document.createElement("tr");
  trTongGom.innerHTML = `
    <td colspan="2" style="padding:10px;font-weight:700;color:#3b82f6">TỔNG CỘNG TOÀN PHIÊN</td>
    <td style="padding:10px;text-align:center;font-weight:700;color:#3b82f6">${tongQRAll}</td>
    <td style="padding:10px;text-align:right;font-weight:700;color:#3b82f6">${tongKGAll.toFixed(2)}</td>
  `;
  tbodyGom.appendChild(trTongGom);

  // Điều hướng ẩn camera và hiện khối kết quả độc lập
  document.getElementById("cx1-cam").style.display = "none";
  document.getElementById("cx1-ketqua").style.display = "block";
  document.getElementById("cx1-status").textContent = "✅ Hoàn tất — " + phienCX1.length + " mã";
}

function quetLaiCX1() {
  document.getElementById("cx1-ketqua").style.display = "none";
  document.getElementById("cx1-form").style.display = "block";
}

function showCanhBaoCX1(text) {
  const el = document.getElementById("canh-bao");
  el.textContent = text;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 2000);
}