// ── Quản lý BTP (Bán Thành Phẩm) v20260809-ultra ──────────────────────────
let zxingReaderBTP = null;
let dangQuetBTP = false;
let phienBTP = [];
let demSoDotBTP = 0;
let denPinBatBTP = false;
let ngayBTP = null;
let phienSoBTP = 1;
let btpToastTimeout = null;

let idPhienHienTaiBTP = null;
let soLuongDaGuiHienTaiBTP = 0;

const BTP_LICHSU_KEY = "btp_lich_su";
const BTP_LICHSU_SO_NGAY_GIU = 30;
const BTP_DODANG_KEY = "btp_phien_dodang";
const BTP_PENDING_KEY = "btp_pending_saves";

function xuLyDuLieuQRBTP(text) {
  if (!text) return null;
  const rawQR = text.trim();

  // Trích xuất mã BTP (VD: EM260405 từ 1AEM2604051-150 hoặc 10BEM2603691-320)
  const matchEM = rawQR.match(/EM\d{6}/i) || rawQR.match(/EM\d+/i);
  // Trích xuất số lượng sau dấu - ở cuối (VD: 150 từ -150)
  const matchSL = rawQR.match(/-(\d+(?:\.\d+)?)/);

  let msp = matchEM ? matchEM[0].toUpperCase() : "";
  let kg = matchSL ? parseFloat(matchSL[1]) : 0;
  let qc = "";

  // Nếu không khớp pattern BTP trực tiếp, thử qua parseQRText toàn cục
  if (!msp && typeof window.parseQRText === "function") {
    const parsed = window.parseQRText(rawQR);
    if (parsed) {
      msp = parsed.msp || "";
      kg = parsed.kg || 0;
      qc = parsed.qc || "";
    }
  }

  // Trường hợp chuỗi đơn giản nếu không có EM
  if (!msp && rawQR) {
    msp = rawQR;
  }

  return { rawQR, msp, qc, kg };
}

const mapKhoaBTP = new Map();

// Lưu trữ global để tránh bị Garbage Collection dọn rác giữa chừng (Bug Chrome Android)
window.__speechUtterances = window.__speechUtterances || [];

function docGiongNoiBTP(msp, kg) {
  if (!('speechSynthesis' in window)) return;
  
  let docMsp = String(msp || '').trim();
  if (docMsp.length >= 3) {
    docMsp = docMsp.slice(-3);
  }
  let arrMsp = docMsp.split('').join(' ');
  
  let strKg = String(kg || 0).trim();
  let arrKg = strKg.split('').map(char => char === '.' ? 'phẩy' : char).join(' ');

  const text = arrMsp + " " + arrKg;
  
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = 'vi-VN';
  msg.rate = 1.5;
  msg.volume = 1.0;
  
  window.__speechUtterances.push(msg);
  msg.onend = function() {
    const idx = window.__speechUtterances.indexOf(msg);
    if (idx > -1) window.__speechUtterances.splice(idx, 1);
  };

  // Ngắt giọng đọc cũ nếu có và phát ngay lập tức (không delay nữa do đã bỏ tiếng bíp)
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(msg);
}

function hienVienFeedbackBTP(loai) {
  const videoBox = document.getElementById("btp-video-box");
  if (!videoBox) return;
  if (loai === "success") {
    videoBox.style.borderColor = "#22c55e";
    videoBox.style.boxShadow = "0 0 16px rgba(34, 197, 94, 0.75)";
  } else {
    videoBox.style.borderColor = "#ef4444";
    videoBox.style.boxShadow = "0 0 16px rgba(239, 68, 68, 0.75)";
  }
  setTimeout(() => {
    videoBox.style.borderColor = "transparent";
    videoBox.style.boxShadow = "none";
  }, 800);
}
window.hienVienFeedbackBTP = hienVienFeedbackBTP;

function nhapThuCongBTP(src) {
  const inputId = src === 'cam' ? 'btp-manual-input-cam' : 'btp-manual-input';
  const el = document.getElementById(inputId);
  if (!el) return;
  const rawText = el.value.trim();
  if (!rawText) {
    showCanhBaoBTP("Vui lòng nhập chuỗi mã QR hoặc mã BTP!");
    return;
  }

  const data = xuLyDuLieuQRBTP(rawText);
  if (!data || !data.rawQR) {
    showCanhBaoBTP("Mã không hợp lệ!");
    return;
  }

  const elCheck = document.getElementById("btp-cho-phep-trung-cam");
  const choPhepTrung = elCheck ? elCheck.checked : false;

  if (!choPhepTrung && phienBTP.some(item => item.rawQR.toLowerCase() === data.rawQR.toLowerCase())) {
    showCanhBaoBTP("⚠️ Mã QR đã tồn tại trong phiên quét!");
    hienVienFeedbackBTP("duplicate");
    if (typeof window.phatVibrateError === "function") window.phatVibrateError();
    showCanhBaoBTP("Trùng mã! Mã này đã được quét.");
    return;
  }

  hienVienFeedbackBTP("success");

  // Vibrate thay vì gọi phatVibrateSuccess (vì phatVibrateSuccess bị dính tiếng Bíp)
  if (navigator.vibrate) {
    try { navigator.vibrate(70); } catch (e) {}
  }

  // Đọc TTS luôn, không phát tiếng bíp cũ nữa
  docGiongNoiBTP(data.msp, data.kg);

  phienBTP.push({
    rawQR: data.rawQR,
    id: data.rawQR,
    msp: data.msp,
    qc: data.qc,
    kg: data.kg,
    thoiGian: new Date(),
    dotQuet: demSoDotBTP || 1
  });

  el.value = "";
  const demEl = document.getElementById("btp-dem");
  if (demEl) demEl.textContent = "Đã quét: " + phienBTP.length + " mã";
  luuPhienDoDangBTP();
  capNhatLogBTP();
  showCanhBaoBTP("Đã thêm: " + (data.msp || data.rawQR));
}
window.nhapThuCongBTP = nhapThuCongBTP;

function xoaMaBTP(index, ev) {
  if (ev) ev.stopPropagation();
  if (index < 0 || index >= phienBTP.length) return;

  const item = phienBTP[index];
  const tenMa = item ? (item.msp || item.rawQR) : "mã này";

  const doXoa = () => {
    phienBTP.splice(index, 1);
    luuPhienDoDangBTP();
    capNhatLogBTP();
    const demEl = document.getElementById("btp-dem");
    if (demEl) demEl.textContent = "Đã quét: " + phienBTP.length + " mã";
    if (document.getElementById("btp-ketqua") && document.getElementById("btp-ketqua").style.display !== "none") {
      hienKetQuaBTP();
    }
    showCanhBaoBTP("Đã xóa " + tenMa);
  };

  if (typeof moXacNhanApp === "function") {
    moXacNhanApp("Xóa mã " + tenMa + " khỏi phiên quét?", doXoa, "Xóa", null, "Hủy", "Xóa mã BTP");
  } else if (confirm("Xóa mã " + tenMa + " khỏi phiên quét?")) {
    doXoa();
  }
}
window.xoaMaBTP = xoaMaBTP;

function capNhatLogBTP() {
  const container = document.getElementById("btp-log-list");
  const countEl = document.getElementById("btp-log-count");

  if (countEl) countEl.textContent = phienBTP.length + " mã";
  if (!container) return;
  if (phienBTP.length === 0) {
    container.innerHTML = '<div style="color:var(--cream-soft); font-size:12px; text-align:center; padding:8px 0;">Chưa có mã nào được quét</div>';
    return;
  }

  const newestFirst = phienBTP.slice().reverse();
  container.innerHTML = newestFirst.map((item, idx) => {
    const dot = item.dotQuet || 1;
    const originalIndex = phienBTP.length - 1 - idx;
    const gio = item.thoiGian ? new Date(item.thoiGian).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
    const flashClass = idx === 0 ? ' scan-flash-new' : '';

    return `<div class="${flashClass}" style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid var(--line-soft); font-size:12px; border-radius:6px;">
      <span style="color:var(--steel); font-weight:700; width:26px;">${dot}</span>
      <span style="color:var(--brass); font-weight:800; flex:1; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.msp || '—'}</span>
      <span style="color:var(--success); font-weight:700; width:45px; text-align:center;">${item.kg || 0}</span>
      <span style="color:var(--cream-soft); font-size:11px; width:50px; text-align:right;">${gio}</span>
      <button class="cx5-del-btn" onclick="xoaMaBTP(${originalIndex}, event)" title="Xóa mã này" style="margin-left:4px; background:none; border:none; color:var(--red); cursor:pointer; padding:2px 4px;">
        <i class="ti ti-trash"></i>
      </button>
    </div>`;
  }).join("");
}

function khiQuetDuocMaBTP(result) {
  if (!result || !dangQuetBTP) return;
  const rawText = typeof result.getText === "function" ? result.getText() : String(result);
  const data = xuLyDuLieuQRBTP(rawText);
  if (!data || !data.rawQR) return;

  const elCheck = document.getElementById("btp-cho-phep-trung-cam");
  const choPhepTrung = elCheck ? elCheck.checked : false;
  const lockMs = choPhepTrung ? 1500 : 500;
  const now = Date.now();

  // Khóa Per-QR
  if (mapKhoaBTP.has(data.rawQR) && (now - mapKhoaBTP.get(data.rawQR)) < lockMs) {
    return;
  }
  mapKhoaBTP.set(data.rawQR, now);

  if (!choPhepTrung && phienBTP.some(item => item.rawQR.toLowerCase() === data.rawQR.toLowerCase())) {
    hienVienFeedbackBTP("duplicate");
    if (typeof window.phatVibrateError === "function") window.phatVibrateError();
    showCanhBaoBTP("Trùng mã! Mã này đã được quét.");
    
    // Nếu quét trùng, phạt khóa mã này lâu hơn (2 giây) để tránh chớp đỏ liên tục nếu lỡ để quên camera
    mapKhoaBTP.set(data.rawQR, Date.now() + 1500); 
    
    return;
  }

  hienVienFeedbackBTP("success");
  
  if (navigator.vibrate) {
    try { navigator.vibrate(70); } catch (e) {}
  }

  // Chỉ dùng TTS, bỏ qua tiếng bíp cũ
  docGiongNoiBTP(data.msp, data.kg);

  phienBTP.push({
    rawQR: data.rawQR,
    id: data.rawQR,
    msp: data.msp,
    qc: data.qc,
    kg: data.kg,
    thoiGian: new Date(),
    dotQuet: demSoDotBTP || 1
  });

  const demEl = document.getElementById("btp-dem");
  if (demEl) demEl.textContent = "Đã quét: " + phienBTP.length + " mã";
  luuPhienDoDangBTP();
  capNhatLogBTP();

  const lockStatusEl = document.getElementById("btp-lock-status");
  if (lockStatusEl) lockStatusEl.innerHTML = '<i class="ti ti-check-double" style="color:var(--success)"></i> ' + data.msp;
}

function luuPhienDoDangBTP() {
  try {
    localStorage.setItem(BTP_DODANG_KEY, JSON.stringify({
      phienBTP, ngayBTP, phienSoBTP, capNhat: new Date().toISOString(),
      idPhienHienTaiBTP, soLuongDaGuiHienTaiBTP, demSoDotBTP
    }));
  } catch (e) { }
  if (typeof capNhatTrangChu === "function") capNhatTrangChu();
}

function xoaPhienDoDangBTP() {
  try { localStorage.removeItem(BTP_DODANG_KEY); } catch (e) { }
  if (typeof capNhatTrangChu === "function") capNhatTrangChu();
}

async function batDauBTP() {
  const ngayEl = document.getElementById("btp-ngay");
  if (ngayEl && !ngayEl.value) {
    ngayEl.value = (typeof layNgayHomNayLocal === "function") ? layNgayHomNayLocal() : new Date().toISOString().split("T")[0];
  }
  ngayBTP = (ngayEl && ngayEl.value) ? ngayEl.value : ((typeof layNgayHomNayLocal === "function") ? layNgayHomNayLocal() : new Date().toISOString().split("T")[0]);

  const phienEl = document.getElementById("btp-phien");
  phienSoBTP = phienEl ? (parseInt(phienEl.value, 10) || 1) : 1;

  let phienCu = null;
  try { phienCu = JSON.parse(localStorage.getItem(BTP_DODANG_KEY)); } catch (e) { }
  if (phienCu && Array.isArray(phienCu.phienBTP) && phienCu.phienBTP.length > 0) {
    if (typeof moXacNhanApp === "function") {
      moXacNhanApp(
        "Bạn đang có phiên BTP dở dang (" + phienCu.phienBTP.length + " mã, ngày " + phienCu.ngayBTP + "). Bạn muốn tiếp tục hay xóa đi bắt đầu mới?",
        () => { khoiPhucBTP(phienCu); },
        "Tiếp tục",
        () => { xoaPhienDoDangBTP(); batDauPhienMoiBTP(); },
        "Bắt đầu mới",
        "Phiên BTP dở dang"
      );
      return;
    }
  }

  batDauPhienMoiBTP();
}

async function batDauPhienMoiBTP() {
  document.body.classList.add("cam-active");
  phienBTP = [];
  demSoDotBTP = 1;
  dangQuetBTP = true;
  denPinBatBTP = false;
  idPhienHienTaiBTP = Date.now() + "-" + Math.random().toString(36).slice(2);
  soLuongDaGuiHienTaiBTP = 0;

  luuPhienDoDangBTP();

  document.getElementById("btp-form").style.display = "none";
  document.getElementById("btp-cam").style.display = "block";
  document.getElementById("btp-ketqua").style.display = "none";
  document.getElementById("btp-dem").textContent = "Đã quét: 0 mã";
  document.getElementById("btp-status").innerHTML = '<i class="ti ti-radar" style="color:var(--success)"></i> Đang quét Đợt 1...';

  capNhatLogBTP();

  const btnToggle = document.getElementById("btn-dung-tieptuc-btp");
  if (btnToggle) {
    btnToggle.textContent = "Dừng quét";
    btnToggle.className = "btn btn-red btn-full";
  }

  try {
    if (!zxingReaderBTP) {
      zxingReaderBTP = await khoiTaoCameraFast("btp-reader", (txt) => {
        if (txt && dangQuetBTP) {
          khiQuetDuocMaBTP({ getText: () => txt });
        }
      });
    }
  } catch (e) {
    showCanhBaoBTP("Lỗi camera: " + e);
    dungBTP();
  }
}

function dungBTP() {
  // document.body.classList.remove("cam-active");
  dangQuetBTP = false;
  // Giữ nguyên phần cứng camera chạy ngầm để bật lại tức thì
  // if (typeof dungCameraFast === "function" && zxingReaderBTP) {
  //   dungCameraFast("btp-reader", zxingReaderBTP);
  // }
  // zxingReaderBTP = null;
  const statusEl = document.getElementById("btp-status");
  if (statusEl) statusEl.innerHTML = '<i class="ti ti-player-pause" style="color:var(--red)"></i> Đã dừng quét (Đợt ' + (demSoDotBTP || 1) + ')';
}

async function tiepTucBTP() {
  document.body.classList.add("cam-active");
  const daQuetTrongDotNay = phienBTP.some(function(item) { return item.dotQuet === demSoDotBTP; }); if (daQuetTrongDotNay || (demSoDotBTP || 0) === 0) { demSoDotBTP = (demSoDotBTP || 0) + 1; }
  dangQuetBTP = true;
  document.getElementById("btp-status").innerHTML = '<i class="ti ti-radar" style="color:var(--success)"></i> Đang quét Đợt ' + demSoDotBTP + '...';
  try {
    if (!zxingReaderBTP) {
      zxingReaderBTP = await khoiTaoCameraFast("btp-reader", (txt) => {
        if (txt && dangQuetBTP) {
          khiQuetDuocMaBTP({ getText: () => txt });
        }
      });
    }
  } catch (e) {
    alert("Lỗi camera: " + e);
    dungBTP();
  }
}

function toggleDungTiepTucBTP() {
  const btn = document.getElementById("btn-dung-tieptuc-btp");
  if (!btn) return;
  if (dangQuetBTP) {
    dungBTP();
    btn.textContent = "Quét tiếp (Đợt mới)";
    btn.className = "btn btn-blue btn-full";
  } else {
    tiepTucBTP();
    btn.textContent = "Dừng quét";
    btn.className = "btn btn-red btn-full";
  }
}



function docPendingBTP() {
  try {
    const raw = localStorage.getItem(BTP_PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function luuPendingBTP(list) {
  try { localStorage.setItem(BTP_PENDING_KEY, JSON.stringify(list)); } catch (e) { }
  capNhatBadgePendingBTP();
}

function capNhatBadgePendingBTP() {
  const pending = docPendingBTP();
  const count = pending.length;

  const btnCam = document.getElementById("btn-dongbo-btp");
  const countCam = document.getElementById("btp-pending-count");
  const btnForm = document.getElementById("btn-dongbo-btp-form");
  const countForm = document.getElementById("btp-pending-count-form");

  if (countCam) countCam.textContent = count;
  if (countForm) countForm.textContent = count;

  if (btnCam) btnCam.style.display = count > 0 ? "block" : "none";
  if (btnForm) btnForm.style.display = count > 0 ? "block" : "none";
}
window.capNhatBadgePendingBTP = capNhatBadgePendingBTP;

async function dongBoThietBiBTP() {
  const pending = docPendingBTP();
  if (pending.length === 0) {
    showCanhBaoBTP("Không có dữ liệu chưa gửi!");
    return;
  }

  showCanhBaoBTP("Đang gửi " + pending.length + " bản ghi lên Sheet...");
  try {
    await guiLenSheetBTP(pending);
    luuPendingBTP([]);
    showCanhBaoBTP("✅ Đã đồng bộ thành công " + pending.length + " bản ghi!");
  } catch (err) {
    showCanhBaoBTP("❌ Lỗi đồng bộ: " + (err.message || err));
  }
}
window.dongBoThietBiBTP = dongBoThietBiBTP;

async function guiLenSheetBTP(rows) {
  const URL_API = "https://script.google.com/macros/s/AKfycbxjnWLrJXZk1MJN4bSXdf72Wly7Of1Rc7iRtUNpcKk3iZDkxk-N1W7mE965tNMyhA9z1Q/exec";
  const res = await fetch(URL_API, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "luuBTP", data: rows })
  });
  if (!res.ok) throw new Error("Lỗi kết nối server HTTP " + res.status);
  const json = await res.json();
  if (json && json.error) throw new Error(json.error);
}

// Chỉ dừng camera và hiện bảng kết quả — KHÔNG gửi lên Sheet
function xemKetQuaBTP() {
  dungBTP();
  hienKetQuaBTP();
  luuPhienDoDangBTP();
}
window.xemKetQuaBTP = xemKetQuaBTP;

// Gửi phần dữ liệu CHƯA GỬI lên Google Sheet (tránh trùng lặp)
async function guiDuLieuBTP() {
  const moiBoSung = phienBTP.slice(soLuongDaGuiHienTaiBTP);
  if (moiBoSung.length === 0) {
    showCanhBaoBTP("Không có dữ liệu mới để gửi!");
    return;
  }

  const btnGui = document.getElementById("btn-gui-dulieu-btp");
  if (btnGui) {
    btnGui.disabled = true;
    btnGui.innerHTML = '<i class="ti ti-loader spin"></i> Đang gửi ' + moiBoSung.length + ' mã...';
  }

  const rows = moiBoSung.map(r => ({
    rawQR: r.rawQR,
    id: r.rawQR,
    msp: r.msp,
    qc: r.qc,
    kg: r.kg,
    ngay: ngayBTP,
    phien: phienSoBTP,
    thoiGian: r.thoiGian ? (typeof r.thoiGian.toISOString === "function" ? r.thoiGian.toISOString() : r.thoiGian) : new Date().toISOString()
  }));

  try {
    await guiLenSheetBTP(rows);
    soLuongDaGuiHienTaiBTP = phienBTP.length;
    xoaPhienDoDangBTP();
    luuVaoLichSuBTP();
    showCanhBaoBTP("Đã gửi thành công " + rows.length + " mã lên Sheet!");
    if (btnGui) {
      btnGui.innerHTML = '<i class="ti ti-circle-check"></i> Đã gửi thành công';
      btnGui.style.background = "linear-gradient(135deg, #10b981, #059669)";
      btnGui.style.color = "#fff";
    }
  } catch (err) {
    const pending = docPendingBTP();
    rows.forEach(r => {
      if (!pending.some(p => (p.rawQR || p.id) === (r.rawQR || r.id) && p.thoiGian === r.thoiGian)) {
        pending.push(r);
      }
    });
    luuPendingBTP(pending);
    showCanhBaoBTP("Mất mạng — đã lưu tạm trên máy, sẽ tự gửi lại sau");
    soLuongDaGuiHienTaiBTP = phienBTP.length;
    if (btnGui) {
      btnGui.disabled = false;
      btnGui.innerHTML = '<i class="ti ti-cloud-upload"></i> Gửi dữ liệu lên Sheet';
      btnGui.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
      btnGui.style.color = "#1a1a2e";
    }
  }
  if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
}
window.guiDuLieuBTP = guiDuLieuBTP;

// Giữ backward-compatible
async function ketThucBTP() {
  xemKetQuaBTP();
}


function taoHangKetQuaBTP(danhSach) {
  let tongGomLoaiMa = {};
  let tongQRAll = danhSach.length;
  let soDot = new Set(danhSach.map(r => r.dotQuet || 1)).size;
  const oTim = document.getElementById("btp-ketqua-search");
  const tuKhoa = oTim ? oTim.value.trim().toLowerCase() : "";

  let hangDot = "";
  danhSach.forEach((r, idx) => {
    const keyGom = (r.msp || '—') + "|" + (r.kg || 0);
    if (!tongGomLoaiMa[keyGom]) {
      tongGomLoaiMa[keyGom] = { msp: r.msp || '—', soMat: r.kg || 0, soLuong: 0 };
    }
    tongGomLoaiMa[keyGom].soLuong += 1;

    const dotStr = String(r.dotQuet || 1);
    const mspStr = (r.msp || "").toLowerCase();
    const kgStr = String(r.kg || "").toLowerCase();
    const rawStr = (r.rawQR || "").toLowerCase();

    if (!tuKhoa || dotStr.includes(tuKhoa) || mspStr.includes(tuKhoa) || kgStr.includes(tuKhoa) || rawStr.includes(tuKhoa)) {
      hangDot += `
  <tr>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);color:var(--steel);font-weight:700">${r.dotQuet || 1}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);font-weight:600">${r.msp || '—'}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);text-align:right;font-weight:700;color:var(--success)">${r.kg || 0}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);text-align:center;">
      <button class="cx5-del-btn" onclick="xoaMaBTP(${idx}, event)" title="Xóa mã này" style="background:none;border:none;color:var(--red);cursor:pointer;padding:2px 4px;">
        <i class="ti ti-trash"></i>
      </button>
    </td>
  </tr>`;
    }
  });

  let footDot = `
  <tr>
    <td style="padding:10px;font-weight:700;color:var(--brass);background:var(--card-raised)">TỔNG</td>
    <td style="padding:10px;background:var(--card-raised)"></td>
    <td style="padding:10px;text-align:right;font-weight:700;color:var(--brass);background:var(--card-raised)">${soDot}</td>
    <td style="padding:10px;background:var(--card-raised)"></td>
  </tr>`;

  let hangGom = "";
  Object.values(tongGomLoaiMa).forEach(item => {
    hangGom += `
  <tr>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);font-weight:600">${item.msp}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);text-align:center;font-weight:700">${item.soMat}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);text-align:right;font-weight:700;color:var(--success)">${item.soLuong}</td>
  </tr>`;
  });

  let footGom = `
  <tr>
    <td style="padding:10px;font-weight:700;color:var(--steel);background:var(--card-raised)">TỔNG</td>
    <td style="padding:10px;background:var(--card-raised)"></td>
    <td style="padding:10px;text-align:right;font-weight:700;color:var(--steel);background:var(--card-raised)">${tongQRAll}</td>
  </tr>`;

  return { hangDot, footDot, hangGom, footGom };
}

function hienKetQuaBTP() {
  document.body.classList.remove("cam-active");
  const { hangDot, footDot, hangGom, footGom } = taoHangKetQuaBTP(phienBTP);
  const elDot = document.getElementById("btp-tbody-dot");
  const elFootDot = document.getElementById("btp-tfoot-dot");
  const elGom = document.getElementById("btp-tbody-gom");
  const elFootGom = document.getElementById("btp-tfoot-gom");

  if (elDot) elDot.innerHTML = hangDot;
  if (elFootDot) elFootDot.innerHTML = footDot;
  if (elGom) elGom.innerHTML = hangGom;
  if (elFootGom) elFootGom.innerHTML = footGom;

  document.getElementById("btp-cam").style.display = "none";
  document.getElementById("btp-ketqua").style.display = "block";

  // Reset nút gửi về trạng thái ban đầu
  const btnGui = document.getElementById("btn-gui-dulieu-btp");
  if (btnGui) {
    btnGui.disabled = false;
    btnGui.innerHTML = '<i class="ti ti-cloud-upload"></i> Gửi dữ liệu lên Sheet';
    btnGui.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
    btnGui.style.color = "#1a1a2e";
  }
}

async function quetTiepBTP() {
  document.body.classList.add("cam-active");
  const daQuetTrongDotNay = phienBTP.some(function(item) { return item.dotQuet === demSoDotBTP; }); if (daQuetTrongDotNay || (demSoDotBTP || 0) === 0) { demSoDotBTP = (demSoDotBTP || 0) + 1; }
  dangQuetBTP = true;
  denPinBatBTP = false;

  document.getElementById("btp-ketqua").style.display = "none";
  document.getElementById("btp-cam").style.display = "block";
  document.getElementById("btp-status").innerHTML = '<i class="ti ti-radar" style="color:var(--success)"></i> Đang quét Đợt ' + demSoDotBTP + '...';

  const btnToggle = document.getElementById("btn-dung-tieptuc-btp");
  if (btnToggle) {
    btnToggle.textContent = "Dừng quét";
    btnToggle.className = "btn btn-red btn-full";
  }

  try {
    if (!zxingReaderBTP) {
      zxingReaderBTP = await khoiTaoCameraFast("btp-reader", (txt) => {
        if (txt && dangQuetBTP) {
          khiQuetDuocMaBTP({ getText: () => txt });
        }
      });
    }
  } catch (e) {
    alert("Lỗi camera: " + e);
    dungBTP();
  }
}

function quetMoiBTP() {
  phienBTP = [];
  demSoDotBTP = 0;
  idPhienHienTaiBTP = null;
  soLuongDaGuiHienTaiBTP = 0;
  xoaPhienDoDangBTP();
  document.getElementById("btp-ketqua").style.display = "none";
  document.getElementById("btp-form").style.display = "block";
}

function showCanhBaoBTP(text) {
  const el = document.getElementById("canh-bao");
  if (!el) return;
  el.textContent = text;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 2000);
}

async function khoiPhucBTP(state) {
  document.body.classList.add("cam-active");
  phienBTP = state.phienBTP.map(r => ({ ...r, thoiGian: new Date(r.thoiGian) }));
  demSoDotBTP = state.demSoDotBTP || 1;
  ngayBTP = state.ngayBTP;
  phienSoBTP = state.phienSoBTP || 1;
  if (typeof chonPhienBTP === "function") chonPhienBTP(phienSoBTP);
  idPhienHienTaiBTP = state.idPhienHienTaiBTP || (Date.now() + "-" + Math.random().toString(36).slice(2));
  soLuongDaGuiHienTaiBTP = state.soLuongDaGuiHienTaiBTP !== undefined ? state.soLuongDaGuiHienTaiBTP : 0;
  dangQuetBTP = true;
  denPinBatBTP = false;

  document.getElementById("btp-form").style.display = "none";
  document.getElementById("btp-cam").style.display = "block";
  document.getElementById("btp-ketqua").style.display = "none";
  document.getElementById("btp-dem").textContent = "Đã quét: " + phienBTP.length + " mã";
  document.getElementById("btp-status").innerHTML = '<i class="ti ti-radar" style="color:var(--success)"></i> Đang quét Đợt ' + demSoDotBTP + '...';

  capNhatLogBTP();

  const btnToggle = document.getElementById("btn-dung-tieptuc-btp");
  if (btnToggle) {
    btnToggle.textContent = "Dừng quét";
    btnToggle.className = "btn btn-red btn-full";
  }

  try {
    if (!zxingReaderBTP) {
      zxingReaderBTP = await khoiTaoCameraFast("btp-reader", (txt) => {
        if (txt && dangQuetBTP) {
          khiQuetDuocMaBTP({ getText: () => txt });
        }
      });
    }
  } catch (e) {
    alert("Lỗi camera: " + e);
    dungBTP();
  }
}

function tiepTucPhienBTP() {
  let state = null;
  try { state = JSON.parse(localStorage.getItem(BTP_DODANG_KEY)); } catch (e) { }
  if (!state) return;
  if (typeof diToiTab === "function") diToiTab("btpPage");
  else if (typeof chuyenTrang === "function") chuyenTrang("btpPage");
  khoiPhucBTP(state);
}

function huyPhienBTP() {
  xoaPhienDoDangBTP();
  if (typeof capNhatTrangChu === "function") capNhatTrangChu();
}

function docLichSuBTP() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(BTP_LICHSU_KEY)) || []; } catch (e) { list = []; }
  const homNay = new Date();
  homNay.setHours(0, 0, 0, 0);
  return list.filter(s => {
    if (!s.ngay) return false;
    const ngayPhien = new Date(s.ngay + "T00:00:00");
    const soNgayCach = Math.floor((homNay - ngayPhien) / 86400000);
    return soNgayCach >= 0 && soNgayCach < BTP_LICHSU_SO_NGAY_GIU;
  });
}

function luuLichSuBTP(list) {
  try { localStorage.setItem(BTP_LICHSU_KEY, JSON.stringify(list)); } catch (e) { }
}

function xoaMotPhienLichSuBTP(idPhien, ev) {
  if (ev) ev.stopPropagation();
  if (typeof moXacNhanApp === "function") {
    moXacNhanApp(
      "Xóa phiên lịch sử BTP này? Không thể hoàn tác.",
      () => {
        luuLichSuBTP(docLichSuBTP().filter(s => s.idPhien !== idPhien));
        renderLichSuBTP();
      },
      "Xóa",
      null,
      "Hủy",
      "Xóa phiên lịch sử"
    );
  } else if (confirm("Xóa phiên lịch sử BTP này? Không thể hoàn tác.")) {
    luuLichSuBTP(docLichSuBTP().filter(s => s.idPhien !== idPhien));
    renderLichSuBTP();
  }
}
window.xoaMotPhienLichSuBTP = xoaMotPhienLichSuBTP;

function xoaTatCaLichSuBTP() {
  const list = docLichSuBTP();
  if (list.length === 0) { showCanhBaoBTP("Không có lịch sử BTP để xóa"); return; }
  if (typeof moXacNhanApp === "function") {
    moXacNhanApp(
      "Xóa toàn bộ " + list.length + " phiên lịch sử BTP? Không thể hoàn tác.",
      () => {
        luuLichSuBTP([]);
        renderLichSuBTP();
      },
      "Xóa tất cả",
      null,
      "Hủy",
      "Xóa tất cả lịch sử"
    );
  } else if (confirm("Xóa toàn bộ " + list.length + " phiên lịch sử BTP? Không thể hoàn tác.")) {
    luuLichSuBTP([]);
    renderLichSuBTP();
  }
}
window.xoaTatCaLichSuBTP = xoaTatCaLichSuBTP;

function luuVaoLichSuBTP() {
  if (phienBTP.length === 0 || !idPhienHienTaiBTP) return;
  const list = docLichSuBTP();
  const idx = list.findIndex(s => s.idPhien === idPhienHienTaiBTP);
  const banGhi = {
    idPhien: idPhienHienTaiBTP,
    ngay: ngayBTP,
    capNhatLuc: new Date().toISOString(),
    phienBTP: phienBTP,
    demSoDotBTP: demSoDotBTP,
    soLuongDaGui: soLuongDaGuiHienTaiBTP
  };
  if (idx >= 0) list[idx] = banGhi; else list.push(banGhi);
  luuLichSuBTP(list);
  if (typeof renderLichSuBTP === "function") renderLichSuBTP();
}

function moLichSuBTP() {
  renderLichSuBTP();
  if (typeof chuyenTrangKhongNav === "function") chuyenTrangKhongNav("lichSuBTP");
}
window.moLichSuBTP = moLichSuBTP;

function renderLichSuBTP() {
  const container = document.getElementById("lichsu-btp-list");
  if (!container) return;
  const oTim = document.getElementById("lichsu-btp-tim");
  const tuKhoa = oTim ? oTim.value.trim().toLowerCase() : "";

  let list = docLichSuBTP().slice().sort((a, b) => new Date(b.capNhatLuc) - new Date(a.capNhatLuc));
  if (tuKhoa) {
    list = list.filter(s =>
      (s.ngay || "").toLowerCase().includes(tuKhoa) ||
      (s.phienBTP || []).some(r => (r.msp || "").toLowerCase().includes(tuKhoa) || String(r.kg || "").toLowerCase().includes(tuKhoa))
    );
  }

  if (list.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--cream-soft);padding:20px 0;">'
      + (tuKhoa ? "Không tìm thấy phiên nào khớp" : "Chưa có phiên BTP nào trong " + BTP_LICHSU_SO_NGAY_GIU + " ngày qua")
      + '</div>';
    return;
  }

  container.innerHTML = list.map(function (s) {
    const gio = new Date(s.capNhatLuc).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const soDot = new Set(s.phienBTP.map(r => r.dotQuet || 1)).size;
    return '<div class="irow" style="cursor:pointer;align-items:center" onclick="xemChiTietLichSuBTP(\'' + s.idPhien + '\')">'
      + '<span class="ilabel" style="color:var(--cream)">' + s.ngay + ' · ' + gio + '</span>'
      + '<span class="ivalue" style="display:inline-flex;align-items:center;gap:10px">'
      + s.phienBTP.length + ' mã (' + soDot + ' đợt)'
      + '<button class="cx5-del-btn" aria-label="Xóa phiên này" onclick="xoaMotPhienLichSuBTP(\'' + s.idPhien + '\', event)" style="margin-left:6px;background:none;border:none;color:var(--red);cursor:pointer;"><i class="ti ti-trash"></i></button>'
      + '</span>'
      + '</div>';
  }).join("");
}
window.renderLichSuBTP = renderLichSuBTP;

let dangXemLichSuBTPId = null;

function xemChiTietLichSuBTP(idPhien) {
  const list = docLichSuBTP();
  const entry = list.find(s => s.idPhien === idPhien);
  if (!entry) return;

  dangXemLichSuBTPId = idPhien;
  const { hangDot, footDot, hangGom, footGom } = taoHangKetQuaBTP(entry.phienBTP);

  const elDot = document.getElementById("lichsu-btp-tbody-dot");
  const elFootDot = document.getElementById("lichsu-btp-tfoot-dot");
  const elGom = document.getElementById("lichsu-btp-tbody-gom");
  const elFootGom = document.getElementById("lichsu-btp-tfoot-gom");
  const elTieude = document.getElementById("lichsu-btp-chitiet-tieude");

  if (elDot) elDot.innerHTML = hangDot;
  if (elFootDot) elFootDot.innerHTML = footDot;
  if (elGom) elGom.innerHTML = hangGom;
  if (elFootGom) elFootGom.innerHTML = footGom;
  if (elTieude) elTieude.textContent = "BTP — " + entry.ngay;

  if (typeof chuyenTrangKhongNav === "function") chuyenTrangKhongNav("lichSuBTPChiTiet");
}
window.xemChiTietLichSuBTP = xemChiTietLichSuBTP;

function tiepTucLichSuBTP(idPhien) {
  const list = docLichSuBTP();
  const entry = list.find(s => s.idPhien === idPhien);
  if (!entry) return;

  if (typeof diToiTab === "function") diToiTab("btpPage");
  else if (typeof chuyenTrangKhongNav === "function") chuyenTrangKhongNav("btpPage");

  khoiPhucBTP({
    phienBTP: entry.phienBTP,
    ngayBTP: entry.ngay,
    idPhienHienTaiBTP: entry.idPhien,
    demSoDotBTP: entry.demSoDotBTP || 1,
    soLuongDaGuiHienTaiBTP: entry.soLuongDaGui || 0
  });
}
window.tiepTucLichSuBTP = tiepTucLichSuBTP;

function tiepTucTuChiTietLichSuBTP() {
  if (dangXemLichSuBTPId) tiepTucLichSuBTP(dangXemLichSuBTPId);
}
window.tiepTucTuChiTietLichSuBTP = tiepTucTuChiTietLichSuBTP;

function xuatExcelLichSuBTP(idPhien) {
  const targetId = idPhien || dangXemLichSuBTPId;
  const list = docLichSuBTP();
  const entry = list.find(s => s.idPhien === targetId);
  if (!entry || !entry.phienBTP || entry.phienBTP.length === 0) {
    alert("Chưa có dữ liệu phiên này để xuất Excel!");
    return;
  }
  const dateStr = entry.ngay || new Date().toISOString().split("T")[0];
  const data = entry.phienBTP.map((r, i) => ({
    "STT": i + 1,
    "Đợt": r.dotQuet || 1,
    "Ngày": entry.ngay,
    "Mã QR Gốc": r.rawQR,
    "Mã BTP": r.msp,
    "Loại": r.kg,
    "Thời gian": r.thoiGian ? new Date(r.thoiGian).toLocaleTimeString("vi-VN") : ""
  }));
  if (typeof XLSX !== "undefined") {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BTP");
    XLSX.writeFile(wb, "Quet_BTP_" + dateStr + ".xlsx");
  }
}
window.xuatExcelLichSuBTP = xuatExcelLichSuBTP;

function xuatCSVBTP() {
  if (phienBTP.length === 0) { alert("Chưa có dữ liệu để xuất"); return; }
  const header = ["Dot", "Mã QR Gốc", "Mã BTP", "Loại", "Thời Gian"];
  const rows = phienBTP.map(r => [r.dotQuet || 1, r.rawQR, r.msp, r.kg, r.thoiGian ? (typeof r.thoiGian.toISOString === "function" ? r.thoiGian.toISOString() : r.thoiGian) : ""]);
  const escapeCSV = v => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map(row => row.map(escapeCSV).join(",")).join("\r\n");
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ngay = ngayBTP || new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = "btp-" + ngay + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function xuatExcelBTP() {
  if (typeof XLSX === "undefined") {
    xuatCSVBTP();
    return;
  }
  if (phienBTP.length === 0) { alert("Chưa có dữ liệu để xuất"); return; }
  const ngay = ngayBTP || new Date().toISOString().split("T")[0];
  const data = phienBTP.map((r, i) => ({
    "STT": i + 1,
    "Đợt": r.dotQuet || 1,
    "Mã QR Gốc": r.rawQR,
    "Mã BTP": r.msp,
    "Loại": r.kg,
    "Thời gian": new Date(r.thoiGian).toLocaleTimeString("vi-VN")
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "BTP");
  XLSX.writeFile(wb, "Quet_BTP_" + ngay + ".xlsx");
}

function toggleDropdownPhienBTP(e) {
  if (e) e.stopPropagation();
  const trigger = document.getElementById("btp-phien-trigger");
  const menu = document.getElementById("btp-phien-menu");
  if (!menu) return;
  const isOpen = menu.classList.contains("open");
  if (isOpen) {
    menu.classList.remove("open");
    if (trigger) trigger.classList.remove("active");
  } else {
    menu.classList.add("open");
    if (trigger) trigger.classList.add("active");
  }
}
window.toggleDropdownPhienBTP = toggleDropdownPhienBTP;

function chonPhienBTP(val) {
  const numVal = parseInt(val, 10) || 1;
  const hiddenInput = document.getElementById("btp-phien");
  const labelEl = document.getElementById("btp-phien-label");
  const menu = document.getElementById("btp-phien-menu");
  const trigger = document.getElementById("btp-phien-trigger");

  if (hiddenInput) hiddenInput.value = numVal;
  if (labelEl) labelEl.textContent = "Phiên " + numVal;

  phienSoBTP = numVal;

  if (menu) {
    const items = menu.querySelectorAll(".custom-select-item");
    items.forEach(item => {
      const itemVal = parseInt(item.getAttribute("data-val"), 10);
      if (itemVal === numVal) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });
    menu.classList.remove("open");
  }
  if (trigger) trigger.classList.remove("active");
}
window.chonPhienBTP = chonPhienBTP;

document.addEventListener("click", function (e) {
  const wrap = document.querySelector(".custom-select-wrap");
  const menu = document.getElementById("btp-phien-menu");
  const trigger = document.getElementById("btp-phien-trigger");
  if (wrap && !wrap.contains(e.target) && menu && menu.classList.contains("open")) {
    menu.classList.remove("open");
    if (trigger) trigger.classList.remove("active");
  }
});

window.addEventListener("load", function () {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const ngayInput = document.getElementById("btp-ngay");
  if (ngayInput) ngayInput.value = today;

  const hour = now.getHours();
  let defaultVal = 1;
  if (hour >= 6 && hour < 12) defaultVal = 1;
  else if (hour >= 12 && hour < 16) defaultVal = 2;
  else if (hour >= 16 && hour < 20) defaultVal = 3;
  else if (hour >= 20 || hour < 2) defaultVal = 4;
  else defaultVal = 5;

  chonPhienBTP(defaultVal);
});

let dangDongBoPendingBTP = false;

async function tuDongDongBoPendingBTP() {
  if (dangDongBoPendingBTP) return;
  const pending = docPendingBTP();
  if (pending.length === 0) return;

  dangDongBoPendingBTP = true;
  try {
    await guiLenSheetBTP(pending);
    luuPendingBTP([]);
  } catch (e) { }
  finally {
    dangDongBoPendingBTP = false;
    if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
  }
}

window.addEventListener("load", tuDongDongBoPendingBTP);
window.addEventListener("online", tuDongDongBoPendingBTP);



