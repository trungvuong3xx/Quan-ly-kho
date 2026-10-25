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
  dsChiTietQuetKK = [];
  batch = [];
  dangQuetKK = true;

  document.getElementById("kk-form").style.display = "none";
  document.getElementById("kk-cam").style.display = "block";
  document.getElementById("kk-dem").textContent = "Đã quét: 0 mã";
  document.getElementById("kk-status").textContent = "Đang quét...";
  const lockElInit = document.getElementById("kk-lock-status");
  if (lockElInit) lockElInit.textContent = "Chờ quét...";
  capNhatLogKK();

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
        if (window.ScannerCore && typeof window.ScannerCore.hienVienFeedback === "function") {
          window.ScannerCore.hienVienFeedback("kk-cam-flash-overlay", "kk-video-box", "error", 500);
        } else {
          const v = document.getElementById("kk-reader");
          if (v) {
            v.classList.add("canh-bao-trung");
            setTimeout(() => v.classList.remove("canh-bao-trung"), 500);
          }
        }
        return;
      }

      if (typeof window.phatTiengBip === "function") window.phatTiengBip();
      if (typeof phatVibrateSuccess === "function") phatVibrateSuccess();
      dsQuetKiemKe.push(id);

      if (window.ScannerCore && typeof window.ScannerCore.hienVienFeedback === "function") {
        window.ScannerCore.hienVienFeedback("kk-cam-flash-overlay", "kk-video-box", "ok", 400);
      } else {
        const vEl = document.getElementById("kk-reader");
        if (vEl) {
          vEl.classList.add("flash-thanh-cong");
          setTimeout(() => vEl.classList.remove("flash-thanh-cong"), 400);
        }
      }

      const itemRec = { id, msp, ten: "—", mau: "—", ngay: ngayKiemKe, thoiGian: new Date() };
      batch.push(itemRec);
      dsChiTietQuetKK.push(itemRec);

      // Cập nhật đếm và subcam bar ngay lập tức
      document.getElementById("kk-dem").textContent = "Đã quét: " + dsQuetKiemKe.length + " mã";
      const lockEl = document.getElementById("kk-lock-status");
      if (lockEl) lockEl.textContent = (msp ? msp + " • " : "") + id;
      capNhatLogKK();

      // Lấy thông tin từ DanhMuc
      const info = await callAPI({ action: "getInfo", msp });
      if (info && info.success) {
        itemRec.ten = info.ten || "—";
        itemRec.mau = info.mau || "—";
        capNhatLogKK();
      }

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

function capNhatLogKK() {
  const countEl = document.getElementById("kk-log-count");
  const listEl = document.getElementById("kk-log-list");
  if (countEl) countEl.textContent = dsChiTietQuetKK.length + " mã";
  if (!listEl) return;

  if (dsChiTietQuetKK.length === 0) {
    listEl.innerHTML = '<div class="btp-empty-log">Chưa có mã nào được quét</div>';
    return;
  }

  // Chỉ render tối đa 30 mã mới nhất theo quy tắc dự án chống giật lag DOM
  const latest = dsChiTietQuetKK.slice(-30).reverse();
  const safeEsc = typeof escapeHtml === "function" ? escapeHtml : (s => String(s == null ? "" : s).replace(/[&<>"']/g, ""));

  listEl.innerHTML = latest.map((item, idx) => {
    const stt = dsChiTietQuetKK.length - idx;
    const gio = item.thoiGian ? new Date(item.thoiGian).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
    const tenHienThi = (item.ten && item.ten !== "—") ? item.ten : (item.msp || item.id);
    const mauHienThi = (item.mau && item.mau !== "—") ? (' • ' + item.mau) : '';
    return '<div class="btp-log-item" style="padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-card);">'
      + '<div style="min-width: 0; flex: 1;">'
      + '<div style="font-weight: 700; font-size: 13px; color: var(--row-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">#' + stt + ' • ' + safeEsc(tenHienThi) + safeEsc(mauHienThi) + '</div>'
      + '<div style="font-size: 11.5px; color: var(--row-muted); font-family: \'IBM Plex Mono\', monospace;">ID: ' + safeEsc(item.id) + (item.msp ? ' | MSP: ' + safeEsc(item.msp) : '') + '</div>'
      + '</div>'
      + '<div style="font-size: 11px; font-weight: 600; color: var(--row-muted); margin-left: 8px; flex-shrink: 0;">' + safeEsc(gio) + '</div>'
      + '</div>';
  }).join("");
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

let dangDongBoKK = false;
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
  if (dangDongBoKK) return;
  const pending = docPendingKK();
  if (pending.length === 0) return;
  dangDongBoKK = true;
  try {
    const r = await callAPI({ action: "luuKiemKe", data: pending });
    if (r && !r.error) luuPendingKK([]);
  } finally {
    dangDongBoKK = false;
    if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
  }
}

let dsChiTietQuetKK = []; // Lưu chi tiết để xuất Excel

function layNgayLocalKK_() {
  if (typeof layNgayHomNayLocal === "function") return layNgayHomNayLocal();
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function xuatExcelKiemKe() {
  if (!dsChiTietQuetKK || dsChiTietQuetKK.length === 0) {
    showCanhBaoKK("Chưa có dữ liệu kiểm kê để xuất Excel!", "warning");
    return;
  }
  const dateStr = ngayKiemKe || layNgayLocalKK_();
  const exportData = dsChiTietQuetKK.map((item, idx) => ({
    "STT": idx + 1,
    "Ngày kiểm kê": item.ngay,
    "Mã ID": item.id,
    "Mã MSP": item.msp,
    "Tên sản phẩm": item.ten,
    "Màu sắc": item.mau,
    "Thời gian": item.thoiGian ? new Date(item.thoiGian).toLocaleTimeString("vi-VN") : ""
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
    kkNgay.value = layNgayLocalKK_();
  }
});

window.addEventListener("load", thuLaiPendingKK);
window.addEventListener("online", thuLaiPendingKK);
