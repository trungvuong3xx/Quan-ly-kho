const API = "https://script.google.com/macros/s/AKfycbyeVxFfSGI-ca8VJkDUUM9GuhqJ0CN91FBSMCaSu_NphsbE7TR-XlMcGVgz21wgzXBSdA/exec";

async function callAPI(body) {
  const res = await fetch(API, { method: "POST", body: JSON.stringify(body) });
  return res.json();
}

let infoMSP = null;

// ── Navigation ───────────────────────────────────────────
function chuyenTrang(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  el.classList.add('active');
  if (id !== 'quetQR') dungQuet();
}

// ── Tạo QR ──────────────────────────────────────────────
async function timMSP() {
  const input = document.getElementById("msp-tao");
  const msp = input.value.trim();
  const infoBox = document.getElementById("info-tao");

  infoMSP = null;
  infoBox.classList.remove("show");
  document.getElementById("card-qr").style.display = "none";
  document.getElementById("qr-grid").innerHTML = "";

  if (!msp) {
    alert("Vui long nhap ma MSP!");
    input.focus();
    return;
  }

  const info = await callAPI({ action: "getInfo", msp });

  if (!info.success) {
    alert(info.error || "Khong tim thay MSP!");
    input.focus();
    return;
  }

  infoMSP = {
    msp,
    ten: info.ten || msp,
    mau: info.mau || ""
  };

  document.getElementById("t-ten").textContent = infoMSP.ten;
  document.getElementById("t-mau").textContent = infoMSP.mau || "-";
  infoBox.classList.add("show");
}
async function taoQR() {
if (!infoMSP) return;

const sl = parseInt(document.getElementById("sl-qr").value) || 20;

const ids = await callAPI({
action: "taoNhieuID",
soLuong: sl
});

if (ids.error) {
alert("❌ " + ids.error);
return;
}

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


// ── Quét QR ─────────────────────────────────────────────
let zxingReader = null;
let dangXuLy = false;
let ngayChon = null;
let loaiChon = null;
let dsQuetTrongPhien = [];

function batDauQuet() {
  ngayChon = document.getElementById("chon-ngay").value;
  loaiChon = document.getElementById("chon-loai").value;

  if (!ngayChon) { alert("⚠️ Vui lòng chọn ngày!"); return; }
  if (!loaiChon) { alert("⚠️ Vui lòng chọn loại!"); return; }

  dsQuetTrongPhien = [];
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
      try {
        const text = result.getText();
        const parts = text.split("|");
        const id = parts[0];
        const msp = parts[1];

        // Kiểm tra trùng trong phiên
        if (dsQuetTrongPhien.includes(id)) {
          showCanhBao("⚠️ Mã " + id + " đã quét rồi!");
          setTimeout(() => { dangXuLy = false; }, 2000);
          return;
        }

        await hienOverlay({ id, msp });
      } catch(e) {
        dangXuLy = false;
      }
    });
  } catch(e) {
    alert("Lỗi camera: " + e);
    dungQuet();
  }
}

function dungQuet() {
  if (zxingReader) { zxingReader.reset(); zxingReader = null; }
  dsQuetTrongPhien = [];
  document.getElementById("form-chon").style.display = "block";
  document.getElementById("cam-box").style.display = "none";
  document.getElementById("btn-stop").style.display = "none";
  document.getElementById("scanner-status").textContent = "";
  document.getElementById("canh-bao").style.display = "none";
}

async function hienOverlay(data) {
  // Lấy thông tin từ DanhMuc theo MSP
  const info = await callAPI({ action: "getInfo", msp: data.msp });

  document.getElementById("q-id").textContent = data.id;
  document.getElementById("q-msp").textContent = data.msp;
  document.getElementById("q-ten").textContent = info.success ? info.ten : "—";
  document.getElementById("q-mau").textContent = info.success ? (info.mau || "—") : "—";
  document.getElementById("q-loai").textContent = loaiChon;
  document.getElementById("q-ngay").textContent = ngayChon;
  document.getElementById("q-kg").value = "";
  document.getElementById("msg-quet").classList.remove("show");
  document.getElementById("overlay").classList.add("show");
}

function dongOverlay() {
  document.getElementById("overlay").classList.remove("show");
  dangXuLy = false;
}

function showCanhBao(text) {
  const el = document.getElementById("canh-bao");
  el.textContent = text;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 2000);
}

async function luuGiaoDich() {
  const id = document.getElementById("q-id").textContent;
  const msp = document.getElementById("q-msp").textContent;
  const ten = document.getElementById("q-ten").textContent;
  const mau = document.getElementById("q-mau").textContent;
  const kg = document.getElementById("q-kg").value;
  if (!kg || parseFloat(kg) <= 0) { showMsg("⚠️ Nhập số kg hợp lệ!", false); return; }

  document.getElementById("btn-luu").disabled = true;
  const r = await callAPI({ action: "luuGiaoDich", id, msp, ten, mau, ngay: ngayChon, loai: loaiChon, kg });
  document.getElementById("btn-luu").disabled = false;

  if (r.error) { showMsg("❌ " + r.error, false); return; }

  // Thêm vào danh sách đã quét
  dsQuetTrongPhien.push(id);

  showMsg("✅ Đã lưu " + r.kgLuu + " kg!", true);
  setTimeout(() => dongOverlay(), 800);
}

function showMsg(text, ok) {
  const el = document.getElementById("msg-quet");
  el.textContent = text;
  el.className = "msg show " + (ok ? "ok" : "err");
}

window.onload = function() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById("chon-ngay").value = today;
};
