// ── Chỉ FOR ─────────────────────────────────────────────
let zxingReaderCX1 = null;
let dangQuetCX1 = false;
let phienCX1 = []; // lưu chi tiết từng tem QR quét được
let demSoDot = 0;   // Đếm số đợt bấm quét trong phiên

// Hàm tự động phát tiếng bíp bằng Web Audio API (Không sợ lỗi đồng bộ)
function phatTiengBip() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = "sine"; 
    oscillator.frequency.value = 1200; 
    gainNode.gain.setValueAtTime(1.0, audioCtx.currentTime); 

    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.1);
    oscillator.stop(audioCtx.currentTime + 0.1);
  } catch (e) {
    console.log("Trình duyệt chặn phát âm bíp: " + e);
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
    dotQuet: demSoDot 
  });

  document.getElementById("cx1-dem").textContent = "Đã quét: " + phienCX1.length + " mã";
}

function batDauCX1() {
  phienCX1 = [];
  demSoDot = 1; 
  dangQuetCX1 = true;

  document.getElementById("cx1-form").style.display = "none";
  document.getElementById("cx1-cam").style.display = "block";
  document.getElementById("cx1-ketqua").style.display = "none";
  document.getElementById("cx1-dem").textContent = "Đã quét: 0 mã";
  document.getElementById("cx1-status").textContent = "🟢 Đang quét Đợt 1...";

  // Ẩn/Hiện nút cho đúng trạng thái to rộng
  document.getElementById("btn-dung-cx1").style.display = "block";
  document.getElementById("btn-tieptuc-cx1").style.display = "none";

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
  document.getElementById("cx1-status").textContent = " Đã dừng Đợt " + demSoDot;
  document.getElementById("btn-tieptuc-cx1").style.display = "block";
  document.getElementById("btn-dung-cx1").style.display = "none";
}

function tiepTucCX1() {
  demSoDot += 1; 
  dangQuetCX1 = true;
  document.getElementById("cx1-status").textContent = " Đang quét Đợt " + demSoDot + "...";
  document.getElementById("btn-tieptuc-cx1").style.display = "none";
  document.getElementById("btn-dung-cx1").style.display = "block";

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

async function ketThucCX1() {
  dungCX1();

  // BỌC THỬ NGHIỆM AN TOÀN: Đảm bảo dù gửi dữ liệu lỗi mạng hay lỗi hàm hệ thống vẫn hiện kết quả, không bị đứng máy
  if (phienCX1.length > 0) {
    document.getElementById("cx1-status").textContent = "⏳ Đang lưu...";
    try {
      if (typeof callAPI === "function") {
        await callAPI({ action: "luuCX1", data: phienCX1.map(r => ({
          id: r.id, msp: r.msp, qc: r.qc, kg: r.kg,
          thoiGian: r.thoiGian.toISOString()
        }))});
      }
    } catch (err) {
      console.log("Lỗi lưu API hệ thống, chuyển trực tiếp qua xuất bảng: ", err);
    }
  }

  // XỬ LÝ DỮ LIỆU ĐỔ VÀO VÀ HIỂN THỊ 2 BẢNG TÁCH BIỆT
  let tongDotCuaPhien = {}; 
  let tongGomLoaiMa = {};   
  let tongQRAll = 0;
  let tongKGAll = 0;

  phienCX1.forEach(r => {
    tongQRAll += 1;
    tongKGAll += r.kg;

    // Bảng 1: Gom theo Đợt + Cặp mã trùng
    const keyDot = "Dot_" + r.dotQuet + "|" + r.msp + "|" + r.qc;
    if (!tongDotCuaPhien[keyDot]) {
      tongDotCuaPhien[keyDot] = { dot: r.dotQuet, msp: r.msp, qc: r.qc, soLuong: 0, tongKG: 0 };
    }
    tongDotCuaPhien[keyDot].soLuong += 1;
    tongDotCuaPhien[keyDot].tongKG += r.kg;

    // Bảng 2: Gom toàn bộ phiên theo loại mã độc nhất
    const keyGom = r.msp + "|" + r.qc;
    if (!tongGomLoaiMa[keyGom]) {
      tongGomLoaiMa[keyGom] = { msp: r.msp, qc: r.qc, soLuong: 0, tongKG: 0 };
    }
    tongGomLoaiMa[keyGom].soLuong += 1;
    tongGomLoaiMa[keyGom].tongKG += r.kg;
  });

  // Đổ dữ liệu BẢNG 1 (Theo đợt quét)
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
  // Dòng tổng cộng bảng đợt
  const trTongDot = document.createElement("tr");
  trTongDot.innerHTML = `
    <td colspan="3" style="padding:10px;font-weight:700;color:#eab308;background:rgba(255,255,255,.02)">TỔNG TIẾN ĐỘ</td>
    <td style="padding:10px;text-align:center;font-weight:700;color:#eab308;background:rgba(255,255,255,.02)">${tongQRAll}</td>
    <td style="padding:10px;text-align:right;font-weight:700;color:#eab308;background:rgba(255,255,255,.02)">${tongKGAll.toFixed(2)}</td>
  `;
  tbodyDot.appendChild(trTongDot);

  // Đổ dữ liệu BẢNG 2 (Sum gom loại mã)
  const tbodyGom = document.getElementById("cx1-tbody-gom");
  tbodyGom.innerHTML = "";
  Object.values(tongGomLoaiMa).forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${item.msp}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${item.qc}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:center;font-weight:700">${item.soLuong}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:right;font-weight:700;color:#22c55e">${item.tongKG.toFixed(2)}</td>
    `;
    tbodyGom.appendChild(tr);
  });
  // Dòng tổng cộng bảng gom
  const trTongGom = document.createElement("tr");
  trTongGom.innerHTML = `
    <td colspan="2" style="padding:10px;font-weight:700;color:#3b82f6;background:rgba(255,255,255,.02)">TỔNG PHIÊN GOM</td>
    <td style="padding:10px;text-align:center;font-weight:700;color:#3b82f6;background:rgba(255,255,255,.02)">${tongQRAll}</td>
    <td style="padding:10px;text-align:right;font-weight:700;color:#3b82f6;background:rgba(255,255,255,.02)">${tongKGAll.toFixed(2)}</td>
  `;
  tbodyGom.appendChild(trTongGom);

  // Chuyển màn hình hiển thị kết quả
  document.getElementById("cx1-cam").style.display = "none";
  document.getElementById("cx1-ketqua").style.display = "block";
  document.getElementById("cx1-status").textContent = " Hoàn tất — " + phienCX1.length + " mã";
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