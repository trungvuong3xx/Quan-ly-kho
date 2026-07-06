const API = "https://script.google.com/macros/s/AKfycbzXjzccld3X04iJgIpEvKm01in0QT0i7tkjar_oJ6K5-sBGdm9xibe7Mu4UB3mWtha5-w/exec";

async function callAPI(body) {
  try {
    const res = await fetch(API, { method: "POST", body: JSON.stringify(body), redirect: "follow" });
    return await res.json();
  } catch (err) {
    return { error: "Mất kết nối mạng, vui lòng thử lại." };
  }
}

let infoMSP = null;
let zxingReader = null;
let dangXuLy = false;
let ngayChon = null;
let loaiChon = null;
let qrDangQuet = null;
let quetNhanh = false; // toggle quét nhanh

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
  if (id === "trangChu" && typeof capNhatTrangChu === "function") capNhatTrangChu();
}

// Điều hướng tới 1 tab từ nơi khác ngoài bottom-nav (nút tắt ở Trang chủ, banner tiếp tục...)
function diToiTab(id) {
  const btn = document.querySelector('.bnav-btn[data-page="' + id + '"]');
  if (btn) chuyenTrang(id, btn);
}
window.diToiTab = diToiTab;

// ── Chặn nút Back, hỏi xác nhận trước khi thoát app ─────────
history.pushState({ chanThoat: true }, "", location.href);

window.addEventListener("popstate", function() {
  const el = document.getElementById("overlay-thoat");
  if (el) el.classList.add("show");
});

function khongThoatApp() {
  document.getElementById("overlay-thoat").classList.remove("show");
  history.pushState({ chanThoat: true }, "", location.href);
}

function xacNhanThoatApp() {
  document.getElementById("overlay-thoat").classList.remove("show");
  history.back();
}

window.khongThoatApp = khongThoatApp;
window.xacNhanThoatApp = xacNhanThoatApp;

function showLoading(show) {
  document.getElementById("overlay-loading").style.display = show ? "flex" : "none";
}

function capNhatNutQuetNhanh() {
  const btn = document.getElementById("toggle-quet-nhanh");
  if (quetNhanh) {
    btn.style.background = "var(--success)";
    btn.style.color = "var(--bg)";
    btn.textContent = "Quét nhanh: BẬT";
  } else {
    btn.style.background = "var(--neutral)";
    btn.style.color = "var(--cream)";
    btn.textContent = "Quét nhanh: TẮT";
  }
}

function toggleQuetNhanh() {
  quetNhanh = !quetNhanh;
  capNhatNutQuetNhanh();
}

async function timMSP() {
  const input = document.getElementById("msp-tao");
  const msp = input.value.trim();
  const infoBox = document.getElementById("info-tao");
  infoMSP = null;
  infoBox.classList.remove("show");
  document.getElementById("card-qr").style.display = "none";
  document.getElementById("qr-grid").innerHTML = "";
  if (!msp) { alert("Vui lòng nhập mã MSP!"); input.focus(); return; }
  showLoading(true);
  const info = await callAPI({ action: "getInfo", msp });
  showLoading(false);
  if (!info.success) { alert(info.error || info.message || "Không tìm thấy MSP!"); input.focus(); return; }
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
  if (ids.error) { alert(ids.error); return; }
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
    new QRCode(document.getElementById("qr-" + id), { text: qrData, width: 56, height: 56, correctLevel: QRCode.CorrectLevel.M });
  });
  document.getElementById("card-qr").style.display = "block";
}

function batDauQuet() {
  ngayChon = document.getElementById("chon-ngay").value;
  loaiChon = document.getElementById("chon-loai").value;
  if (!ngayChon) { alert("⚠️ Vui lòng chọn ngày!"); return; }
  if (!loaiChon) { alert("⚠️ Vui lòng chọn loại!"); return; }

  // Mặc định quét nhanh nếu là Xuất
  quetNhanh = !isNhap(loaiChon);
  capNhatNutQuetNhanh();

  document.getElementById("form-chon").style.display = "none";
  document.getElementById("cam-box").style.display = "block";
  document.getElementById("btn-stop").style.display = "block";
  document.getElementById("scanner-status").textContent = "" + loaiChon + " | " + ngayChon;
  dangXuLy = false;

  try {
    zxingReader = new ZXing.BrowserMultiFormatReader();
    zxingReader.decodeFromVideoDevice(undefined, "reader", async (result, err) => {
      if (!result || dangXuLy) return;
      dangXuLy = true;
      try {
        const text = result.getText();
        const parts = text.split("|");
        const id = (parts[0] || "").trim();
        const msp = (parts[1] || "").trim();
        if (!id || !msp) { showCanhBao("QR không hợp lệ"); setTimeout(() => { dangXuLy = false; }, 1500); return; }

        if (quetNhanh) {
          // Quét nhanh: lưu luôn không popup
          await luuNhanh({ id, msp });
        } else {
          await hienOverlay({ id, msp });
        }
      } catch(e) {
        showCanhBao("Lỗi đọc QR");
        setTimeout(() => { dangXuLy = false; }, 1500);
      }
    });
  } catch(e) {
    alert("Lỗi camera: " + e);
    dungQuet();
  }
}

// Lưu nhanh không cần nhập kg
async function luuNhanh(data) {
  // Hiện cảnh báo nhỏ đang lưu
  showCanhBao("💾 Đang lưu " + data.id + "...");

  // Lấy thông tin MSP ngầm
  const info = await callAPI({ action: "kiemTraQR", id: data.id, msp: data.msp, loai: loaiChon });

  if (info.error) {
    showCanhBao(info.error);
    setTimeout(() => { dangXuLy = false; }, 1800);
    return;
  }

  const r = await callAPI({
    action: "luuGiaoDich",
    id: data.id, msp: data.msp,
    ten: info.ten || "—", mau: info.mau || "—",
    ngay: ngayChon, loai: loaiChon,
    kg: 0 // kg = 0 khi quét nhanh
  });

  if (r.error) {
    showCanhBao(r.error);
  } else {
    showCanhBao("Đã lưu " + data.id);
  }
  setTimeout(() => { dangXuLy = false; }, 1000);
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

async function hienOverlay(data) {
  // Hiện overlay NGAY với thông tin từ QR
  document.getElementById("q-id").textContent = data.id;
  document.getElementById("q-msp").textContent = data.msp;
  document.getElementById("q-ten").textContent = "...";
  document.getElementById("q-mau").textContent = "...";
  document.getElementById("q-loai").textContent = loaiChon;
  document.getElementById("q-ton").textContent = "...";
  document.getElementById("q-kg").value = "";
  document.getElementById("q-kg").placeholder = "Nhập số kg...";
  document.getElementById("btn-luu").textContent = "Lưu & quét tiếp";
  document.getElementById("msg-quet").classList.remove("show");
  document.getElementById("overlay-spinner").style.display = "flex";
  document.getElementById("overlay-content").style.display = "block";
  document.getElementById("overlay").classList.add("show");
  document.getElementById("q-kg").focus();

  // Gọi API ngầm lấy thêm thông tin
  const info = await callAPI({ action: "kiemTraQR", id: data.id, msp: data.msp, loai: loaiChon });

  document.getElementById("overlay-spinner").style.display = "none";

  if (info.error) {
    document.getElementById("overlay").classList.remove("show");
    showCanhBao(info.error);
    setTimeout(() => { dangXuLy = false; }, 1800);
    return;
  }

  qrDangQuet = { id: data.id, msp: data.msp, ten: info.ten || "—", mau: info.mau || "—", cheDo: info.cheDo || "luuMoi" };

  document.getElementById("q-ten").textContent = qrDangQuet.ten;
  document.getElementById("q-mau").textContent = qrDangQuet.mau;
  document.getElementById("q-ton").textContent = formatKg(info.ton) + " kg";

  if (info.cheDo === "capNhatNhap") {
    document.getElementById("q-kg").value = formatKg(info.kgNhap);
    document.getElementById("btn-luu").textContent = "Cập nhật kg";
  } else if (!isNhap(loaiChon)) {
    document.getElementById("q-kg").placeholder = "Tồn: " + formatKg(info.ton) + " kg";
  }
}

function dongOverlay() {
  document.getElementById("overlay").classList.remove("show");
  qrDangQuet = null;
  dangXuLy = false;
}

function showCanhBao(text) {
  const el = document.getElementById("canh-bao");
  el.textContent = text;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 2000);
}

async function luuGiaoDich() {
  if (!qrDangQuet) return;
  const kg = document.getElementById("q-kg").value;
  if (!kg || parseFloat(kg) <= 0) { showMsg("Nhập số kg hợp lệ", false); return; }

  const btn = document.getElementById("btn-luu");
  btn.disabled = true;
  btn.textContent = "Đang lưu...";

  const r = await callAPI({
    action: "luuGiaoDich",
    id: qrDangQuet.id, msp: qrDangQuet.msp, ten: qrDangQuet.ten, mau: qrDangQuet.mau,
    ngay: ngayChon, loai: loaiChon, kg
  });

  btn.disabled = false;
  btn.textContent = "Lưu & quét tiếp";

  if (r.error) { showMsg(r.error, false); return; }
  showMsg("Đã lưu " + formatKg(r.kgGoc) + " kg", true);
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
    btn.innerHTML = loaiDaChon + '<span style="font-size:12px;color:var(--cream-soft);margin-left:auto">▼</span>';
    document.querySelectorAll(".custom-option").forEach(opt => opt.classList.remove("active"));
    e.target.classList.add("active");
    list.classList.remove("show");
    return;
  }
  if (!list.contains(e.target)) list.classList.remove("show");
});

function showMsg(text, ok) {
  const el = document.getElementById("msg-quet");
  if (el) { el.textContent = text; el.className = "msg show " + (ok ? "ok" : "err"); }
}

window.onload = function() {
  const today = new Date().toISOString().split("T")[0];
  const ngayInput = document.getElementById("chon-ngay");
  if (ngayInput) ngayInput.value = today;
  capNhatTrangChu();
};

// ── Trang chủ: hiện phiên dở dang (hiện hỗ trợ Chỉ For) ────
function capNhatTrangChu() {
  const card = document.getElementById("phien-dodang-card");
  const noidung = document.getElementById("phien-dodang-noidung");
  if (!card || !noidung) return;

  let state = null;
  try { state = JSON.parse(localStorage.getItem("cx1_phien_dodang")); } catch (e) {}

  if (state && Array.isArray(state.phienCX1) && state.phienCX1.length > 0) {
    const gioCapNhat = state.capNhat
      ? new Date(state.capNhat).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      : "—";
    const laKetQua = state.trangThai === "ketqua";
    noidung.innerHTML = `
      <div class="irow"><span class="ilabel">Loại</span><span class="ivalue">Chỉ For</span></div>
      <div class="irow"><span class="ilabel">Trạng thái</span><span class="ivalue">${laKetQua ? "Đã hoàn tất — chờ xử lý" : "Đang quét dở dang"}</span></div>
      <div class="irow"><span class="ilabel">Ngày</span><span class="ivalue">${state.ngayCX1 || "—"}</span></div>
      <div class="irow"><span class="ilabel">Đã quét</span><span class="ivalue">${state.phienCX1.length} mã</span></div>
      <div class="irow"><span class="ilabel">Cập nhật lúc</span><span class="ivalue">${gioCapNhat}</span></div>
    `;
    const btnTiepTuc = card.querySelector(".btn-green");
    if (btnTiepTuc) btnTiepTuc.textContent = laKetQua ? "Xem kết quả" : "Tiếp tục";
    card.style.display = "block";
  } else {
    card.style.display = "none";
  }
}
window.capNhatTrangChu = capNhatTrangChu;

window.timMSP = timMSP;
window.taoQR = taoQR;
window.chuyenTrang = chuyenTrang;
window.batDauQuet = batDauQuet;
window.dungQuet = dungQuet;
window.dongOverlay = dongOverlay;
window.luuGiaoDich = luuGiaoDich;
window.toggleQuetNhanh = toggleQuetNhanh;

// ── Trạng thái mạng (dùng chung cho kiểm kê + Chỉ For) ──────
function demPendingMang() {
  let tong = 0;
  try { tong += JSON.parse(localStorage.getItem("cx1_pending_saves") || "[]").length; } catch (e) {}
  try { tong += JSON.parse(localStorage.getItem("kk_pending_saves") || "[]").length; } catch (e) {}
  return tong;
}

function capNhatTrangThaiMang() {
  const el = document.getElementById("mang-status");
  if (!el) return;
  const soCho = demPendingMang();
  if (!navigator.onLine) {
    el.textContent = soCho > 0 ? ("Mất mạng — " + soCho + " mục chờ gửi") : "Mất mạng";
    el.className = "mang-status show err";
  } else if (soCho > 0) {
    el.textContent = "Đang gửi lại " + soCho + " mục...";
    el.className = "mang-status show warn";
  } else {
    el.className = "mang-status";
  }
}

window.addEventListener("online", capNhatTrangThaiMang);
window.addEventListener("offline", capNhatTrangThaiMang);
window.addEventListener("load", capNhatTrangThaiMang);
setInterval(capNhatTrangThaiMang, 4000);
window.capNhatTrangThaiMang = capNhatTrangThaiMang;
