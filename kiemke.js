// ── Kiểm kê ─────────────────────────────────────────────
let dsQuetKiemKe = [];
let batch = [];
let dangQuetKK = false;
let zxingReaderKK = null;
let ngayKiemKe = null;

function batDauKiemKe() {
  ngayKiemKe = document.getElementById("kk-ngay").value;
  if (!ngayKiemKe) { alert("⚠️ Vui lòng chọn ngày!"); return; }

  dsQuetKiemKe = [];
  batch = [];
  dangQuetKK = true;

  document.getElementById("kk-form").style.display = "none";
  document.getElementById("kk-cam").style.display = "block";
  document.getElementById("kk-dem").textContent = "Đã quét: 0 mã";
  document.getElementById("kk-status").textContent = "Đang quét...";

  try {
    zxingReaderKK = new ZXing.BrowserMultiFormatReader();
    zxingReaderKK.decodeFromVideoDevice(undefined, "kk-reader", async (result, err) => {
      if (!result || !dangQuetKK) return;

      const text = result.getText();
      const parts = text.split("|");
      const id = parts[0];
      const msp = parts[1];

      // Kiểm tra trùng
      if (dsQuetKiemKe.includes(id)) {
        showCanhBaoKK("Mã " + id + " đã quét rồi");
        if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
        const v = document.getElementById("kk-reader");
        if (v) {
          v.classList.add("canh-bao-trung");
          setTimeout(() => v.classList.remove("canh-bao-trung"), 500);
        }
        return;
      }

      dsQuetKiemKe.push(id);

      // Lấy thông tin từ DanhMuc
      const info = await callAPI({ action: "getInfo", msp });
      const ten = info.success ? info.ten : "—";
      const mau = info.success ? (info.mau || "—") : "—";

      // Thêm vào batch
      batch.push({ id, msp, ten, mau, ngay: ngayKiemKe });

      // Cập nhật đếm
      document.getElementById("kk-dem").textContent = "Đã quét: " + dsQuetKiemKe.length + " mã";

      // Ghi sheet mỗi 10 dòng
      if (batch.length >= 10) {
        await ghiBatch();
      }
    });
  } catch(e) {
    alert("Lỗi camera: " + e);
    dungKiemKe();
  }
}

async function dungKiemKe() {
  dangQuetKK = false;
  if (zxingReaderKK) { zxingReaderKK.reset(); zxingReaderKK = null; }

  // Ghi nốt batch còn lại
  if (batch.length > 0) {
    document.getElementById("kk-status").textContent = "Đang lưu...";
    await ghiBatch();
  }

  document.getElementById("kk-status").textContent = "Hoàn tất — " + dsQuetKiemKe.length + " mã";
  document.getElementById("kk-form").style.display = "block";
  document.getElementById("kk-cam").style.display = "none";
}

async function ghiBatch() {
  if (batch.length === 0) return;
  const data = [...batch];
  batch = [];
  const r = await callAPI({ action: "luuKiemKe", data });
  if (r && r.error) {
    const pending = docPendingKK();
    pending.push(...data);
    luuPendingKK(pending);
  }
  if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
}

function docPendingKK() {
  try { return JSON.parse(localStorage.getItem("kk_pending_saves") || "[]"); } catch (e) { return []; }
}

function luuPendingKK(list) {
  try { localStorage.setItem("kk_pending_saves", JSON.stringify(list)); } catch (e) {}
}

async function thuLaiPendingKK() {
  const pending = docPendingKK();
  if (pending.length === 0) return;
  const r = await callAPI({ action: "luuKiemKe", data: pending });
  if (r && !r.error) luuPendingKK([]);
  if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
}

function showCanhBaoKK(text) {
  const el = document.getElementById("canh-bao");
  el.textContent = text;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 2000);
}

window.addEventListener("load", function() {
  const kkNgay = document.getElementById("kk-ngay");
  if (kkNgay) {
    const today = new Date().toISOString().split('T')[0];
    kkNgay.value = today;
  }
});

window.addEventListener("load", thuLaiPendingKK);
window.addEventListener("online", thuLaiPendingKK);
