// ── Chỉ FOR ─────────────────────────────────────────────
let zxingReaderCX1 = null;
let dangQuetCX1 = false;
let phienCX1 = []; // chi tiết từng QR
let tongHopCX1 = {}; // tổng hợp theo MSP+QC

// Hàm dùng chung để xử lý và bóc tách dữ liệu từ QR theo cấu trúc của Bệ hạ
function xuLyDuLieuQR(text) {
  // Lọc bỏ toàn bộ các dòng trống hoặc chỉ có dấu cách
  const lines = text.split("\n").map(l => l.trim()).filter(l => l !== "");
  
  if (lines.length < 2) return null;

  const id = lines[0] || "";
  const msp = lines[1] || "";
  
  // Tìm dòng có chứa dấu "/" và "-" để tách Quy cách và Khối lượng
  const dongQCKG = lines.find(l => l.includes("/") && l.includes("-")) || "";
  
  // Tách bằng dấu "/" để lấy Quy cách trước
  const partsQC = dongQCKG.split("/");
  const qc = partsQC[0] || ""; // Sẽ lấy được "190M"
  
  // Tách phần còn lại bằng dấu "-" để lấy Khối lượng
  const phanConLai = partsQC[1] || ""; // "KG-75.0000"
  const partsKG = phanConLai.split("-");
  const kg = parseFloat(partsKG[1]) || 0; // Sẽ lấy được 75

  if (!id || !msp) return null;

  return { id, msp, qc, kg };
}

// Hàm xử lý khi quét thành công mã QR
function khiQuetDuocMa(result) {
  if (!result || !dangQuetCX1) return;

  const data = xuLyDuLieuQR(result.getText());
  if (!data) return; // Dữ liệu lỗi hoặc thiếu thành phần cấu trúc

  // Kiểm tra trùng trong phiên
  if (phienCX1.find(r => r.id === data.id)) {
    showCanhBaoCX1("⚠️ Mã " + data.id + " đã quét rồi!");
    return;
  }

  // Lưu chi tiết
  const thoiGian = new Date();
  phienCX1.push({ id: data.id, msp: data.msp, qc: data.qc, kg: data.kg, thoiGian });

  // Cộng dồn tổng hợp
  const key = data.msp + "|" + data.qc;
  if (!tongHopCX1[key]) tongHopCX1[key] = { msp: data.msp, qc: data.qc, soLuong: 0, tongKG: 0 };
  tongHopCX1[key].soLuong += 1;
  tongHopCX1[key].tongKG += data.kg;

  // Cập nhật đếm
  document.getElementById("cx1-dem").textContent = "Đã quét: " + phienCX1.length + " mã";
}

function batDauCX1() {
  phienCX1 = [];
  tongHopCX1 = {};
  dangQuetCX1 = true;

  document.getElementById("cx1-form").style.display = "none";
  document.getElementById("cx1-cam").style.display = "block";
  document.getElementById("cx1-ketqua").style.display = "none";
  document.getElementById("cx1-dem").textContent = "Đã quét: 0 mã";
  document.getElementById("cx1-status").textContent = "🟢 Đang quét...";

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
  document.getElementById("cx1-status").textContent = "⏸️ Đã dừng";
  document.getElementById("btn-tieptuc-cx1").style.display = "block";
  document.getElementById("btn-dung-cx1").style.display = "none";
}

function tiepTucCX1() {
  dangQuetCX1 = true;
  document.getElementById("cx1-status").textContent = "🟢 Đang quét...";
  document.getElementById("btn-tieptuc-cx1").style.display = "none";
  document.getElementById("btn-dung-cx1").style.display = "block";

  zxingReaderCX1 = new ZXing.BrowserMultiFormatReader();
  zxingReaderCX1.decodeFromVideoDevice(undefined, "cx1-reader", async (result, err) => {
    khiQuetDuocMa(result);
  });
}

async function ketThucCX1() {
  dungCX1();

  // Lưu vào sheet CX1
  if (phienCX1.length > 0) {
    document.getElementById("cx1-status").textContent = "⏳ Đang lưu...";
    await callAPI({ action: "luuCX1", data: phienCX1.map(r => ({
      id: r.id, msp: r.msp, qc: r.qc, kg: r.kg,
      thoiGian: r.thoiGian.toISOString()
    }))});
  }

  // Hiện kết quả tổng hợp
  const tbody = document.getElementById("cx1-tbody");
  tbody.innerHTML = "";
  let tongQR = 0, tongKGAll = 0;

  Object.values(tongHopCX1).forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${item.msp}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${item.qc}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:center">${item.soLuong}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:right;font-weight:700;color:#22c55e">${item.tongKG.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
    tongQR += item.soLuong;
    tongKGAll += item.tongKG;
  });

  // Dòng tổng
  const trTong = document.createElement("tr");
  trTong.innerHTML = `
    <td colspan="2" style="padding:10px;font-weight:700;color:#3b82f6">TỔNG</td>
    <td style="padding:10px;text-align:center;font-weight:700;color:#3b82f6">${tongQR}</td>
    <td style="padding:10px;text-align:right;font-weight:700;color:#3b82f6">${tongKGAll.toFixed(2)}</td>
  `;
  tbody.appendChild(trTong);

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