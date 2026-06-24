// ── Chỉ FOR ─────────────────────────────────────────────
let zxingReaderCX1 = null;
let dangQuetCX1 = false;
let phienCX1 = []; 
let demSoDot = 0;   
let denPinBat = false; // Trạng thái đèn pin hiện tại

// Hàm tự động phát tiếng bíp phiên bản TO VÀ RÕ HƠN (Âm lượng 0.8)
function phatTiengBip() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = "sine"; 
    oscillator.frequency.value = 1300; 
    gainNode.gain.setValueAtTime(1.0, audioCtx.currentTime); 

    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.15);
    oscillator.stop(audioCtx.currentTime + 0.15);
  } catch (e) {
    console.log("Trình duyệt chặn phát âm bíp: " + e);
  }
}

// Hàm Bật/Tắt đèn pin bằng luồng video của trình duyệt
async function toggleFlashCX1() {
  if (!zxingReaderCX1 || !dangQuetCX1) return;
  try {
    // Lấy luồng video đang chạy từ camera
    const stream = document.getElementById("cx1-reader").srcObject;
    if (!stream) return;
    
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    
    // Kiểm tra điện thoại có hỗ trợ đèn pin (torch) trên trình duyệt không
    if (!capabilities.torch) {
      alert("Thiết bị hoặc trình duyệt này không hỗ trợ bật đèn pin trực tiếp.");
      return;
    }
    
    denPinBat = !denPinBat;
    await track.applyConstraints({
      advanced: [{ torch: denPinBat }]
    });
    
    // Đổi màu nút bấm để bệ hạ nhận biết
    const btnFlash = document.getElementById("btn-flash-cx1");
    if (denPinBat) {
      btnFlash.style.background = "#eab308"; // Đèn bật thì nút có màu vàng óng
      btnFlash.textContent = "🔦 Tắt";
    } else {
      btnFlash.style.background = "#6b7280"; // Đèn tắt thì nút màu xám nhạt
      btnFlash.textContent = "🔦 Bật";
    }
  } catch (err) {
    console.log("Lỗi điều khiển đèn pin: ", err);
  }
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
  if (matchKG) {
    qc = dongQCKG.substring(0, dongQCKG.lastIndexOf(matchKG[0])).trim();
  }
  if (qc.endsWith("-")) {
    qc = qc.slice(0, -1).trim(); 
  }

  if (!id || !msp) return null;
  return { id, msp, qc, kg };
}

function khiQuetDuocMa(result) {
  if (!result || !dangQuetCX1) return;

  const data = xuLyDuLieuQR(result.getText());
  if (!data) return; 

  if (phienCX1.find(r => r.id === data.id)) {
    showCanhBaoCX1("⚠️ Mã " + data.id + " đã quét rồi!");
    return;
  }

  phatTiengBip();

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
  denPinBat = false; // Reset trạng thái đèn pin khi vào phiên mới

  document.getElementById("cx1-form").style.display = "none";
  document.getElementById("cx1-cam").style.display = "block";
  document.getElementById("cx1-ketqua").style.display = "none";
  document.getElementById("cx1-dem").textContent = "Đã quét: 0 mã";
  document.getElementById("cx1-status").textContent = "🟢 Đang quét Đợt 1...";

  document.getElementById("btn-dung-cx1").style.display = "block";
  document.getElementById("btn-tieptuc-cx1").style.display = "none";
  document.getElementById("btn-flash-cx1").style.background = "#6b7280";
  document.getElementById("btn-flash-cx1").textContent = "🔦 Bật Đèn Pin";

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
  document.getElementById("cx1-status").textContent = "Đã dừng";
}

}

function tiepTucCX1() {
  demSoDot += 1; 
  dangQuetCX1 = true;
  denPinBat = false;
  document.getElementById("cx1-status").textContent = "🟢 Đang quét Đợt " + demSoDot + "...";
  document.getElementById("btn-flash-cx1").style.background = "#6b7280";
  document.getElementById("btn-flash-cx1").textContent = "🔦 Bật Đèn Pin";

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

  if (phienCX1.length > 0) {
    document.getElementById("cx1-status").textContent = "⏳ Đang lưu...";
    try {
      document.getElementById("cx1-status").textContent = "⏳ Đang kết nối server...";
      
      // Bệ hạ hãy thay đường dẫn macro/exec Google Apps Script của bệ hạ vào đây:
      const URL_API = "https://script.google.com/macros/s/AKfycbzk7afcuHDOTnL6QSIQ0ZgT-CSiIDNZ8h5S8_IkGXahc7PQRvqZKpLpjkBphioXAyzDKQ/exec"; 
      
      const response = await fetch(URL_API, {
        method: "POST",
        mode: "no-cors", // Ép chế độ gửi nhận an toàn không chặn quyền chéo trang
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "luuCX1",
          data: phienCX1.map(r => ({
            id: r.id,
            msp: r.msp,
            qc: r.qc,
            kg: r.kg,
            thoiGian: r.thoiGian.toISOString()
          }))
        })
      });
      
      document.getElementById("cx1-status").textContent = "✅ Đã đồng bộ Sheet thành công!";
    } catch (err) {
      document.getElementById("cx1-status").textContent = "❌ Lỗi mạng: " + err.message;
      console.log("Lỗi lưu API hệ thống: ", err);
    }
  }

  let tongDotCuaPhien = {}; 
  let tongGomLoaiMa = {};   
  let tongQRAll = 0;
  let tongKGAll = 0;

  phienCX1.forEach(r => {
    tongQRAll += 1;
    tongKGAll += r.kg;

    const keyDot = "Dot_" + r.dotQuet + "|" + r.msp + "|" + r.qc;
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
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06);font-weight:700;color:#eab308">Đợt ${item.dot}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${item.msp}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${item.qc}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:center">${item.soLuong}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:right;font-weight:700;color:#22c55e">${item.tongKG.toFixed(2)}</td>
    `;
    tbodyDot.appendChild(tr);
  });
  
  const trTongDot = document.createElement("tr");
  trTongDot.innerHTML = `
    <td colspan="3" style="padding:10px;font-weight:700;color:#eab308;background:rgba(255,255,255,.02)">TỔNG</td>
    <td style="padding:10px;text-align:center;font-weight:700;color:#eab308;background:rgba(255,255,255,.02)">${tongQRAll}</td>
    <td style="padding:10px;text-align:right;font-weight:700;color:#eab308;background:rgba(255,255,255,.02)">${tongKGAll.toFixed(2)}</td>
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
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:right;font-weight:700;color:#22c55e">${item.tongKG.toFixed(2)}</td>
    `;
    tbodyGom.appendChild(tr);
  });
  
  const trTongGom = document.createElement("tr");
  trTongGom.innerHTML = `
    <td colspan="2" style="padding:10px;font-weight:700;color:#3b82f6;background:rgba(255,255,255,.02)">TỔNG</td>
    <td style="padding:10px;text-align:center;font-weight:700;color:#3b82f6;background:rgba(255,255,255,.02)">${tongQRAll}</td>
    <td style="padding:10px;text-align:right;font-weight:700;color:#3b82f6;background:rgba(255,255,255,.02)">${tongKGAll.toFixed(2)}</td>
  `;
  tbodyGom.appendChild(trTongGom);

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

function toggleDungTiepTuc() {
  const btn = document.getElementById("btn-dung-tieptuc-cx1");
  if (dangQuetCX1) {
    dungCX1();
    btn.textContent = "▶️ Tiếp tục";
    btn.className = "btn btn-blue btn-full";
  } else {
    tiepTucCX1();
    btn.textContent = "⏸️ Dừng quét";
    btn.className = "btn btn-red btn-full";
  }
}