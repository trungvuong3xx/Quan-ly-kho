// ── Kiểm kê ─────────────────────────────────────────────
let dsQuetKiemKe = [];
let batch = [];
let dangQuetKK = false;
let zxingReaderKK = null;
let ngayKiemKe = null;

async function batDauKiemKe() {
  ngayKiemKe = document.getElementById("kk-ngay").value;
  if (!ngayKiemKe) { showCanhBaoKK("⚠️ Vui lòng chọn ngày!", "warning"); return; }

  dsQuetKiemKe = [];
  batch = [];
  dangQuetKK = true;

  document.getElementById("kk-form").style.display = "none";
  document.getElementById("kk-cam").style.display = "block";
  document.getElementById("kk-dem").textContent = "Đã quét: 0 mã";
  document.getElementById("kk-status").textContent = "Đang quét...";

  try {
    zxingReaderKK = await khoiTaoCameraFast("kk-reader", async (text) => {
      if (!text || !dangQuetKK) return;

      const qrData = (typeof window.parseQRText === "function") ? window.parseQRText(text) : null;
      let id = qrData ? qrData.id : "";
      let msp = qrData ? qrData.msp : "";

      if (!id || !msp) {
        if (text.includes("{|T")) {
          const tags = {};
          const parts = text.split("{|");
          for (const part of parts) {
            if (!part) continue;
            const match = part.match(/^([A-Z]\d)(.*)$/);
            if (match) tags[match[1]] = match[2].trim();
          }
          id = tags["T9"] || tags["T2"] || tags["T3"] || "";
          msp = tags["T3"] || "";
        } else {
          const parts = text.split("|");
          id = parts[0] ? parts[0].trim() : "";
          msp = parts[1] ? parts[1].trim() : "";
        }
      }
      if (!id) return;

      // Kiểm tra trùng: Đã quét + thời gian trong 2s
      const trungKK = dsChiTietQuetKK.find(r => r.id === id);
      if (dsQuetKiemKe.includes(id) || trungKK) {
        const gioQuet = typeof dinhDangGioQuetTrung === "function" ? dinhDangGioQuetTrung(trungKK ? trungKK.thoiGian : null) : "";
        showCanhBaoKK("Đã quét " + gioQuet, "error");
        if (typeof phatVibrateError === "function") phatVibrateError();
        else if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        const v = document.getElementById("kk-reader");
        if (v) {
          v.classList.add("canh-bao-trung");
          setTimeout(() => v.classList.remove("canh-bao-trung"), 500);
        }
        return;
      }

      if (typeof window.phatTiengBip === "function") window.phatTiengBip();
      if (typeof phatVibrateSuccess === "function") phatVibrateSuccess();
      dsQuetKiemKe.push(id);

      const vEl = document.getElementById("kk-reader");
      if (vEl) {
        vEl.classList.add("flash-thanh-cong");
        setTimeout(() => vEl.classList.remove("flash-thanh-cong"), 400);
      }

      // Lấy thông tin từ DanhMuc
      const info = await callAPI({ action: "getInfo", msp });
      const ten = info.success ? info.ten : "—";
      const mau = info.success ? (info.mau || "—") : "—";

      const itemRec = { id, msp, ten, mau, ngay: ngayKiemKe, thoiGian: new Date() };
      batch.push(itemRec);
      dsChiTietQuetKK.push(itemRec);

      // Cập nhật đếm
      document.getElementById("kk-dem").textContent = "Đã quét: " + dsQuetKiemKe.length + " mã";

      // Ghi sheet mỗi 10 dòng
      if (batch.length >= 10) {
        await ghiBatch();
      }
    });
  } catch(e) {
    showCanhBaoKK("Lỗi camera: " + e, "error");
    dungKiemKe();
  }
}

async function dungKiemKe() {
  dangQuetKK = false;
  dungCameraFast("kk-reader", zxingReaderKK);
  zxingReaderKK = null;

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

let dsChiTietQuetKK = []; // Lưu chi tiết để xuất Excel

function xuatExcelKiemKe() {
  if (!dsChiTietQuetKK || dsChiTietQuetKK.length === 0) {
    showCanhBaoKK("Chưa có dữ liệu kiểm kê để xuất Excel!", "warning");
    return;
  }
  const dateStr = ngayKiemKe || new Date().toISOString().split("T")[0];
  const exportData = dsChiTietQuetKK.map((item, idx) => ({
    "STT": idx + 1,
    "Ngày kiểm kê": item.ngay,
    "Mã ID": item.id,
    "Mã MSP": item.msp,
    "Tên sản phẩm": item.ten,
    "Màu sắc": item.mau
  }));
  if (typeof exportToExcel === "function") {
    exportToExcel("KiemKe_" + dateStr, "Kiểm Kê " + dateStr, exportData);
  }
}
window.xuatExcelKiemKe = xuatExcelKiemKe;

let timerCanhBaoKK = null;
function showCanhBaoKK(text, type = "error") {
  if (typeof showCanhBao === "function") {
    showCanhBao(text, type);
    return;
  }
  const el = document.getElementById("canh-bao");
  if (!el) return;
  text = typeof rutGonThongBaoLoi === "function" ? rutGonThongBaoLoi(text) : text;
  el.textContent = text;
  
  if (type === "success") {
    el.style.background = "linear-gradient(135deg, #10b981, #059669)";
    el.style.boxShadow = "0 8px 24px rgba(16, 185, 129, .4)";
    el.style.border = "1px solid #34d399";
  } else {
    // Popup cảnh báo màu đỏ rực rỡ nổi bật
    el.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
    el.style.boxShadow = "0 8px 24px rgba(220, 38, 38, .5)";
    el.style.border = "1px solid #f87171";
  }
  
  el.style.color = "#ffffff";
  el.style.fontSize = "14px";
  el.style.fontWeight = "700";
  el.style.padding = "12px 22px";
  el.style.borderRadius = "14px";
  el.style.position = "fixed";
  el.style.top = "75px";
  el.style.left = "50%";
  el.style.transform = "translateX(-50%)";
  el.style.zIndex = "999999";
  el.style.whiteSpace = "nowrap";
  el.style.maxWidth = "90vw";
  el.style.textAlign = "center";
  el.style.display = "block";
  
  if (timerCanhBaoKK) clearTimeout(timerCanhBaoKK);
  timerCanhBaoKK = setTimeout(() => { 
    if (el) el.style.display = "none"; 
  }, 2000);
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
