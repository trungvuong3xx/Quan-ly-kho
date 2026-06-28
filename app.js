const API = "https://script.google.com/macros/s/AKfycbzXjzccld3X04iJgIpEvKm01in0QT0i7tkjar_oJ6K5-sBGdm9xibe7Mu4UB3mWtha5-w/exec";

async function callAPI(body) {
  const res = await fetch(API, { method: "POST", body: JSON.stringify(body), redirect: "follow" });
  return res.json();
}

let infoMSP = null;
let zxingReader = null;
let dangXuLy = false;
let ngayChon = null;
let loaiChon = null;
let qrDangQuet = null;

function formatKg(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0";
  return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(3)));
}

function isNhap(loai) {
  return String(loai || "").startsWith("Nhập");
}

function chuyenTrang(id, el) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".bnav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  el.classList.add("active");
  if (id !== "quetQR") dungQuet();
  if (id !== "kiemKe" && typeof dungKiemKe === "function" && typeof dangQuetKK !== "undefined" && dangQuetKK) {
    dungKiemKe();
  }
  if (id !== "chiFor" && typeof dungCX1 === "function" && typeof dangQuetCX1 !== "undefined" && dangQuetCX1) {
    dungCX1();
  }
}

function showLoading(show) {
  const el = document.getElementById("overlay-loading");
  if (el) el.style.display = show ? "flex" : "none";
}

async function timMSP() {
  const input = document.getElementById("msp-tao");
  const msp = input.value.trim();
  const infoBox = document.getElementById("info-tao");

  infoMSP = null;
  infoBox.classList.remove("show");
  document.getElementById("card-qr").style.display = "none";
  document.getElementById("qr-grid").innerHTML = "";

  if (!msp) {
    alert("Vui lòng nhập mã MSP!");
    input.focus();
    return;
  }

  showLoading(true);
  const info = await callAPI({ action: "getInfo", msp });
  showLoading(false);

  if (!info.success) {
    alert(info.error || info.message || "Không tìm thấy MSP!");
    input.focus();
    return;
  }

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

  if (ids.error) { alert("❌ " + ids.error); return; }

  const grid = document.getElementById("qr-grid");
  grid.innerHTML = "";

  ids.forEach(id => {
    const qrData = id + "|" + infoMSP.msp;
    const nd = document.createElement("div");
    nd.className = "qr-item";
    nd.innerHTML = `
      <div class="qr-label">
        <div class="qr-info">
          <div class="qr-ten">${infoMSP.ten}</div>
          <div class="qr-mau">${infoMSP.mau || "—"}</div>
          <div class="qr-id">${id}</div>
        </div>
        <div class="qr-code-cell">
          <div class="qr-code-box" id="qr-${id}"></div>
        </div>
      </div>
    `;
    grid.appendChild(nd);

    new QRCode(document.getElementById("qr-" + id), {
      text: qrData,
      width: 56,
      height: 56,
      correctLevel: QRCode.CorrectLevel.M
    });
  });

  document.getElementById("card-qr").style.display = "block";
}

function batDauQuet() {
  ngayChon = document.getElementById("chon-ngay").value;
  loaiChon = document.getElementById("chon-loai").value;

  if (!ngayChon) { alert("⚠️ Vui lòng chọn ngày!"); return; }
  if (!loaiChon) { alert("⚠️ Vui lòng chọn loại!"); return; }

  document.getElementById("form-chon").style.display = "none";
  document.getElementById("cam-box").style.display = "block";
  document.getElementById("btn-stop").style.display = "block";
  document.getElementById("scanner-status").textContent = "🟢 Đang quét — " + loaiChon + " | " + ngayChon;
  dangXuLy = false;

  try {
    zxingReader = new ZXing.BrowserMultiFormatReader();
    zxingReader.decodeFromVideoDevice(undefined, "reader", async (result, err) => {
      if (!result || dangXuLy) return;
      dangXuLy = true;

      const text = result.getText();
      const parts = text.split("|");
      const id = (parts[0] || "").trim();
      const msp = (parts[1] || "").trim();

      if (!id || !msp) {
        showCanhBao("QR không hợp lệ");
        setTimeout(() => { dangXuLy = false; }, 1200);
        return;
      }

      // KÍNH DÂNG BỆ HẠ: BẬT NGAY OVERLAY LẬP TỨC KHÔNG ĐỢI MẠNG LÀM TRỄ
      hienOverlayLapTuc(id, msp);
    });
  } catch(e) {
    alert("Lỗi camera: " + e);
    dungQuet();
  }
}

function dungQuet() {
  if (zxingReader) { zxingReader.reset(); zxingReader = null; }
  qrDangQuet = null;
  document.getElementById("form-chon").style.display = "block";
  document.getElementById("cam-box").style.display = "none";
  document.getElementById("btn-stop").style.display = "none";
  document.getElementById("scanner-status").textContent = "";
  document.getElementById("canh-bao").style.display = "none";
}

// HÀM MỚI TỐI ƯU TỐC ĐỘ: BẬT BẢNG TRONG CHỚP MẮT
function hienOverlayLapTuc(id, msp) {
  // 1. Khởi tạo đối tượng tạm thời để bệ hạ gõ số kg ngay được luôn
  qrDangQuet = {
    id: id,
    msp: msp,
    ten: "Đang tải tên...",
    mau: "Đang tải màu...",
    cheDo: "luuMoi"
  };

  // 2. Gán nhanh thông tin cơ bản lên màn hình
  document.getElementById("q-id").textContent = id;
  document.getElementById("q-msp").textContent = msp;
  document.getElementById("q-ten").textContent = "⏳ Đang tải...";
  document.getElementById("q-mau").textContent = "⏳ Đang tải...";
  document.getElementById("q-loai").textContent = loaiChon;
  document.getElementById("q-ngay").textContent = ngayChon;
  
  // Các thông số phụ đặt trạng thái chờ tải ngầm
  document.getElementById("q-da-nhap").textContent = "⏳";
  document.getElementById("q-da-xuat").textContent = "⏳";
  document.getElementById("q-ton").textContent = "⏳";

  const kgInput = document.getElementById("q-kg");
  const btnLuu = document.getElementById("btn-luu");
  kgInput.value = "";
  kgInput.placeholder = "Đang kiểm tra tồn kho...";
  btnLuu.textContent = "💾 Lưu & quét tiếp";

  // 3. Đập bảng hiển thị lên luôn lập tức (Tốn chưa tới 0.05 giây)
  document.getElementById("msg-quet").classList.remove("show");
  document.getElementById("overlay").classList.add("show");
  kgInput.focus();

  // 4. CHẠY NGẦM: Bắt đầu gọi mạng lên Google Sheet lấy dữ liệu chi tiết
  callAPI({
    action: "kiemTraQR",
    id: id,
    msp: msp,
    loai: loaiChon
  }).then(info => {
    // Nếu trong quá trình tải ngầm bệ hạ đã bấm đóng bảng thì hủy cập nhật
    if (!qrDangQuet || qrDangQuet.id !== id) return;

    if (info.error) {
      showCanhBao(info.error);
      dongOverlay();
      return;
    }

    // Cập nhật lại dữ liệu chuẩn từ Google Sheet trả về vào biến hệ thống
    qrDangQuet.ten = info.ten || "—";
    qrDangQuet.mau = info.mau || "—";
    qrDangQuet.cheDo = info.cheDo || "luuMoi";

    // Điền mượt mà dữ liệu vào giao diện mà không làm đứng màn hình
    document.getElementById("q-ten").textContent = qrDangQuet.ten;
    document.getElementById("q-mau").textContent = qrDangQuet.mau;
    document.getElementById("q-da-nhap").textContent = formatKg(info.tongNhap);
    document.getElementById("q-da-xuat").textContent = formatKg(info.tongXuat);
    document.getElementById("q-ton").textContent = formatKg(info.ton);

    if (info.cheDo === "capNhatNhap") {
      kgInput.value = formatKg(info.kgNhap);
      btnLuu.textContent = "💾 Cập nhật kg nhập";
    } else if (!isNhap(loaiChon)) {
      kgInput.placeholder = "Tồn: " + formatKg(info.ton) + " kg";
    }
  }).catch(err => {
    console.log("Lỗi tải thông tin ngầm:", err);
  });
}

function dongOverlay() {
  document.getElementById("overlay").classList.remove("show");
  qrDangQuet = null;
  dangXuLy = false;
}

function showCanhBao(text) {
  const el = document.getElementById("canh-bao");
  if (el) {
    el.textContent = text;
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 2200);
  }
}

async function luuGiaoDich() {
  if (!qrDangQuet) return;

  const kg = document.getElementById("q-kg").value;
  if (!kg || parseFloat(kg) <= 0) {
    showMsg("⚠️ Nhập số kg hợp lệ!", false);
    return;
  }

  const btn = document.getElementById("btn-luu");
  btn.disabled = true;

  const r = await callAPI({
    action: "luuGiaoDich",
    id: qrDangQuet.id,
    msp: qrDangQuet.msp,
    ten: qrDangQuet.ten,
    mau: qrDangQuet.mau,
    ngay: ngayChon,
    loai: loaiChon,
    kg
  });

  btn.disabled = false;

  if (r.error) {
    showMsg("❌ " + r.error, false);
    return;
  }

  showMsg("✅ Đã lưu " + formatKg(r.kgGoc) + " kg!", true);
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
    btn.innerHTML = loaiDaChon + '<span style="font-size:12px;color:#94a3b8;margin-left:auto">▼</span>';
    document.querySelectorAll(".custom-option").forEach(opt => opt.classList.remove("active"));
    e.target.classList.add("active");
    list.classList.remove("show");
    return;
  }
  if (!list.contains(e.target)) list.classList.remove("show");
});

function showMsg(text, ok) {
  const el = document.getElementById("msg-quet");
  if (el) { el.textContent = text; el.className = "msg show " + (ok ? "ok" : "err"); }\n}

window.onload = function() {
  const today = new Date().toISOString().split("T")[0];
  const ngayInput = document.getElementById("chon-ngay");
  if (ngayInput) ngayInput.value = today;
};

window.timMSP = timMSP;
window.taoQR = taoQR;
window.chuyenTrang = chuyenTrang;
window.batDauQuet = batDauQuet;
window.dungQuet = dungQuet;
window.dongOverlay = dongOverlay;
window.luuGiaoDich = luuGiaoDich;