// ── Module Quét QR (Nhập/Xuất Kho) v20260905-v57 ───────────────────────
// Kiến trúc độc lập: Quét gom theo phiên, 2 bảng kết quả chuẩn CX1 (Đợt, QC, Bao, KG)
// Quy ước: 1 mã QR = 1 Bao

const URL_API_QUETQR = "https://script.google.com/macros/s/AKfycbzXjzccld3X04iJgIpEvKm01in0QT0i7tkjar_oJ6K5-sBGdm9xibe7Mu4UB3mWtha5-w/exec";
const QUETQR_DODANG_KEY = "quetqr_phien_dodang";
const QUETQR_PENDING_KEY = "quetqr_pending_saves";
const QUETQR_LICHSU_KEY = "quetqr_lichsu";
const QUETQR_LICHSU_SO_NGAY_GIU = 30;

let phienQuetQR = [];
let demSoDotQR = 1;
let ngayQuetQR = "";
let loaiQuetQR = "";
let dangQuetQR = false;
let zxingReaderQR = null;
let mapKhoaQR = new Map();
let idPhienHienTaiQR = null;
let soLuongDaGuiHienTaiQR = 0;

var SVG_SHUTTER_PAUSE = window.SVG_SHUTTER_PAUSE = window.SVG_SHUTTER_PAUSE || '<svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff"><rect x="6" y="4" width="4" height="16" rx="2" /><rect x="14" y="4" width="4" height="16" rx="2" /></svg>';
var SVG_SHUTTER_PLAY = window.SVG_SHUTTER_PLAY = window.SVG_SHUTTER_PLAY || '<svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff" style="margin-left:2px;"><path d="M8 5v14l11-7z" /></svg>';

function hienVienFeedbackQR(loai) {
  if (window.ScannerCore && typeof window.ScannerCore.hienVienFeedback === "function") {
    window.ScannerCore.hienVienFeedback("qr-cam-flash-overlay", "qr-video-box", loai);
    return;
  }
}
window.hienVienFeedbackQR = hienVienFeedbackQR;

let dangNhapQR = false;
let qcKhoaQR = null;
let mspKhoaQR = null;
let mspDataQR = [];
let filteredQR = [];
let activeIndexQR = -1;
let dangHienGoiYQR = false;

function napDuLieuQCQRLocal() {
  if (mspDataQR && mspDataQR.length > 0) return;
  const mapQC = {};

  try {
    const cached = JSON.parse(localStorage.getItem("cx1_danh_sach_qc") || localStorage.getItem("qr_danh_sach_qc") || "[]");
    if (Array.isArray(cached)) {
      cached.forEach(i => {
        if (i && i.ten != null) {
          const ten = String(i.ten).trim();
          if (ten) mapQC[ten] = { msp: String(i.msp || ten).trim(), count: Number(i.count) || 1 };
        }
      });
    }
  } catch (e) {}

  if (Array.isArray(phienQuetQR)) {
    phienQuetQR.forEach(i => {
      const ten = (i.qc || i.msp || "").trim();
      if (ten) {
        if (!mapQC[ten]) mapQC[ten] = { msp: i.msp || ten, count: 0 };
        mapQC[ten].count += 10;
      }
    });
  }

  try {
    const hist = typeof docLichSuQR === "function" ? docLichSuQR() : [];
    if (Array.isArray(hist)) {
      hist.forEach(h => {
        (h.phienQuetQR || []).forEach(i => {
          const ten = (i.qc || i.msp || "").trim();
          if (ten) {
            if (!mapQC[ten]) mapQC[ten] = { msp: i.msp || ten, count: 0 };
            mapQC[ten].count += 1;
          }
        });
      });
    }
  } catch (e) {}

  const list = Object.keys(mapQC).map(k => ({ ten: k, msp: mapQC[k].msp, count: mapQC[k].count }));
  if (list.length > 0) {
    mspDataQR = list;
  }
}

async function taiDanhSachQCQR(forceRefresh = false) {
  napDuLieuQCQRLocal();
  if (!forceRefresh && mspDataQR && mspDataQR.length > 0) return;
  try {
    const URL_API = "https://script.google.com/macros/s/AKfycbzk7afcuHDOTnL6QSIQ0ZgT-CSiIDNZ8h5S8_IkGXahc7PQRvqZKpLpjkBphioXAyzDKQ/exec";
    const res = await fetch(URL_API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "layDanhSachQC" })
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (e) {}
    if (json && json.list && Array.isArray(json.list) && json.list.length > 0) {
      mspDataQR = json.list;
      localStorage.setItem("qr_danh_sach_qc", JSON.stringify(mspDataQR));
      const input = document.getElementById("qr-ten");
      if (input && input.value.trim()) onInputQR();
      else hienGoiYQCQR();
    }
  } catch (e) {}
}
window.taiDanhSachQCQR = taiDanhSachQCQR;

function hienGoiYQCQR() {
  napDuLieuQCQRLocal();
  if (!mspDataQR || !mspDataQR.length) {
    taiDanhSachQCQR();
  }
  dangHienGoiYQR = true;
  filteredQR = (mspDataQR || []).slice().sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 8);
  activeIndexQR = -1;
  renderDropdownQR();
}
window.hienGoiYQCQR = hienGoiYQCQR;

function renderDropdownQR() {
  const el = document.getElementById("qr-dropdown");
  if (!el) return;
  if (!filteredQR || filteredQR.length === 0) {
    el.classList.remove("open");
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }
  const tieuDe = dangHienGoiYQR
    ? '<div class="cx5-dropdown-title" style="padding:6px 10px; font-size:11px; font-weight:700; color:#64748b; border-bottom:1px solid #e2e8f0; text-transform:uppercase;">Gợi ý quy cách thường dùng</div>'
    : "";
  el.innerHTML = tieuDe + filteredQR.map((item, idx) => {
    const tenEsc = (typeof escapeHtml === "function") ? escapeHtml(item.ten) : item.ten;
    return '<div class="cx5-dropdown-item' + (idx === activeIndexQR ? " active" : "") + '" data-idx="' + idx + '" style="padding:10px 12px; cursor:pointer; border-bottom:1px solid #f1f5f9; font-size:14px; font-weight:600; color:#0f172a;">' + tenEsc + '</div>';
  }).join("");
  el.style.display = "block";
  el.classList.add("open");

  Array.from(el.querySelectorAll(".cx5-dropdown-item")).forEach(child => {
    child.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(child.getAttribute("data-idx"), 10);
      if (!isNaN(idx) && filteredQR[idx]) {
        chonQCQR(filteredQR[idx]);
      }
    });
  });
}

function closeDropdownQR() {
  filteredQR = [];
  activeIndexQR = -1;
  dangHienGoiYQR = false;
  const el = document.getElementById("qr-dropdown");
  if (el) {
    el.classList.remove("open");
    el.style.display = "none";
    el.innerHTML = "";
  }
}
window.closeDropdownQR = closeDropdownQR;

document.addEventListener("click", e => {
  const trongOTimKiem = e.target.closest("#qr-qc-tim-wrap, #qr-dropdown, .cx5-bp-panel");
  if (!trongOTimKiem) {
    closeDropdownQR();
  }
});

function chonQCQR(item) {
  if (!item) return;
  const tenVal = (typeof item === "object") ? item.ten : item;
  const mspVal = (typeof item === "object") ? (item.msp || item.ten) : item;
  const tenEl = document.getElementById("qr-ten");
  const mspEl = document.getElementById("qr-msp");
  if (tenEl) tenEl.value = tenVal;
  if (mspEl) mspEl.value = mspVal;
  closeDropdownQR();
  khoaQCQR(mspVal, tenVal);
  const kgInput = document.getElementById("qr-kg");
  if (kgInput) {
    kgInput.focus();
    if (typeof moBanPhimCX5 === "function") moBanPhimCX5(kgInput, "kg");
  }
}
window.chonQCQR = chonQCQR;

function khoaQCQR(msp, ten) {
  qcKhoaQR = ten;
  mspKhoaQR = msp;
  const timWrap = document.getElementById("qr-qc-tim-wrap");
  if (timWrap) timWrap.style.display = "none";
  const khoa = document.getElementById("qr-qc-khoa");
  if (khoa) khoa.style.display = "flex";
  const tenEl = document.getElementById("qr-qc-khoa-ten");
  if (tenEl) tenEl.textContent = ten;
}
window.khoaQCQR = khoaQCQR;

function moKhoaQCQR() {
  qcKhoaQR = null;
  mspKhoaQR = null;
  const khoa = document.getElementById("qr-qc-khoa");
  if (khoa) khoa.style.display = "none";
  const timWrap = document.getElementById("qr-qc-tim-wrap");
  if (timWrap) timWrap.style.display = "block";
  const ten = document.getElementById("qr-ten");
  if (ten) {
    ten.value = "";
    ten.focus();
    hienGoiYQCQR();
  }
}
window.moKhoaQCQR = moKhoaQCQR;

function onInputQR() {
  const mspInput = document.getElementById("qr-msp");
  if (mspInput) mspInput.value = "";
  const input = document.getElementById("qr-ten");
  const query = input ? input.value.trim() : "";
  if (!query) { hienGoiYQCQR(); return; }
  dangHienGoiYQR = false;

  napDuLieuQCQRLocal();
  const q = query.toUpperCase();
  filteredQR = (mspDataQR || []).filter(item => {
    const t = String(item.ten || "").toUpperCase();
    const m = String(item.msp || "").toUpperCase();
    return t.includes(q) || m.includes(q);
  }).slice(0, 15);
  activeIndexQR = -1;
  renderDropdownQR();
}
window.onInputQR = onInputQR;

function chuyenSangNhapTayQR() {
  dungQuetQR();
  const pauseOverlay = document.getElementById("qr-cam-pause-overlay");
  if (pauseOverlay) pauseOverlay.style.display = "none";
  dangNhapQR = true;

  const formChon = document.getElementById("form-chon");
  if (formChon) formChon.style.display = "none";
  const qrCam = document.getElementById("qr-cam");
  if (qrCam) qrCam.style.display = "none";
  const qrKetQua = document.getElementById("qr-ketqua");
  if (qrKetQua) qrKetQua.style.display = "none";
  const qrNhap = document.getElementById("qr-nhap");
  if (qrNhap) qrNhap.style.display = "block";

  const statusEl = document.getElementById("qr-nhap-status");
  if (statusEl) statusEl.innerHTML = '<div class="cam-status-dot"></div><span>Đợt ' + (demSoDotQR || 1) + '</span>';
  const btn = document.getElementById("btn-dung-tieptuc-nhap-qr");
  if (btn) {
    btn.innerHTML = '<i class="ti ti-player-pause"></i> Dừng nhập';
    btn.className = "btn-sub-action";
  }

  taiDanhSachQCQR();
  capNhatLogQR();

  const kgInput = document.getElementById("qr-kg");
  const tenInput = document.getElementById("qr-ten");
  if (qcKhoaQR && kgInput) {
    kgInput.focus();
    if (typeof moBanPhimCX5 === "function") moBanPhimCX5(kgInput, "kg");
  } else if (tenInput) {
    tenInput.focus();
    if (typeof moBanPhimCX5 === "function") moBanPhimCX5(tenInput, "qc");
    hienGoiYQCQR();
  }
}
window.chuyenSangNhapTayQR = chuyenSangNhapTayQR;

function chuyenSangQuetCamQR() {
  if (typeof dongBanPhimCX5 === "function") dongBanPhimCX5();
  dangNhapQR = false;
  const qrNhap = document.getElementById("qr-nhap");
  if (qrNhap) qrNhap.style.display = "none";
  const qrKetQua = document.getElementById("qr-ketqua");
  if (qrKetQua) qrKetQua.style.display = "none";
  const qrCam = document.getElementById("qr-cam");
  if (qrCam) qrCam.style.display = "block";

  tiepTucQuetQR();
  capNhatLogQR();
}
window.chuyenSangQuetCamQR = chuyenSangQuetCamQR;

function toggleDungTiepTucNhapQR() {
  const btn = document.getElementById("btn-dung-tieptuc-nhap-qr");
  const statusEl = document.getElementById("qr-nhap-status");
  if (dangNhapQR) {
    dangNhapQR = false;
    if (btn) {
      btn.innerHTML = '<i class="ti ti-player-play"></i> Nhập tiếp';
      btn.className = "btn-sub-action active-pause";
    }
    if (statusEl) statusEl.innerHTML = '<div class="cam-status-dot paused"></div><span>Đã dừng Đợt ' + (demSoDotQR || 1) + '</span>';
  } else {
    const maxDot = phienQuetQR.length > 0 ? Math.max(0, ...phienQuetQR.map(r => r.dotQuet || 1)) : 0;
    demSoDotQR = maxDot > 0 ? maxDot + 1 : 1;
    dangNhapQR = true;
    if (btn) {
      btn.innerHTML = '<i class="ti ti-player-pause"></i> Dừng nhập';
      btn.className = "btn-sub-action";
    }
    if (statusEl) statusEl.innerHTML = '<div class="cam-status-dot"></div><span>Đợt ' + demSoDotQR + '</span>';
    const kgInput = document.getElementById("qr-kg");
    if (kgInput) kgInput.focus();
  }
}
window.toggleDungTiepTucNhapQR = toggleDungTiepTucNhapQR;

function themMaNhapTayQR() {
  const qcInput = document.getElementById("qr-ten");
  const mspInput = document.getElementById("qr-msp");
  const baoInput = document.getElementById("qr-bao");
  const kgInput = document.getElementById("qr-kg");

  const qc = (qcKhoaQR || (qcInput ? qcInput.value.trim() : "")).trim();
  if (!qc) {
    if (typeof showCanhBaoQR === "function") showCanhBaoQR("Vui lòng chọn hoặc nhập QC!", "warning");
    if (qcInput) qcInput.focus();
    return;
  }

  let msp = (mspKhoaQR || (mspInput ? mspInput.value.trim() : "")).trim();
  if (!msp && mspDataQR && mspDataQR.length > 0) {
    const match = mspDataQR.find(i => i.ten && i.ten.toLowerCase() === qc.toLowerCase());
    if (match) msp = match.msp;
  }
  if (!msp) msp = qc;

  const soBao = Math.max(1, parseInt(baoInput ? baoInput.value : "1") || 1);
  const kg = parseFloat(kgInput ? kgInput.value : "0") || 0;

  if (kg <= 0) {
    if (typeof showCanhBaoQR === "function") showCanhBaoQR("Vui lòng nhập số KG hợp lệ!", "warning");
    if (kgInput) kgInput.focus();
    return;
  }

  if (!qcKhoaQR) {
    khoaQCQR(msp, qc);
  }

  const dot = demSoDotQR || 1;
  const now = Date.now();
  for (let b = 0; b < soBao; b++) {
    const id = "MANUAL_QR_" + (now + b) + "_" + Math.random().toString(36).slice(2, 6);
    phienQuetQR.push({
      id: id,
      rawQR: qc,
      msp: msp,
      qc: qc,
      bao: 1,
      kg: Math.round(kg * 10) / 10,
      thoiGian: new Date(now + b * 10),
      dotQuet: dot,
      isManual: true
    });
  }

  if (typeof phatTiengBip === "function") phatTiengBip();
  luuPhienDoDangQR();
  capNhatLogQR();

  if (kgInput) {
    kgInput.value = "";
    kgInput.focus();
  }
}
window.themMaNhapTayQR = themMaNhapTayQR;

function toggleNhapTayQR() {
  chuyenSangNhapTayQR();
}
window.toggleNhapTayQR = toggleNhapTayQR;

function dongNhapTayQR() {
  const chipMode = document.getElementById("qr-chip-mode");
  const inputMode = document.getElementById("qr-input-mode");
  const btnKeyboard = document.getElementById("btn-toggle-banphim-qr");
  const inputField = document.getElementById("qr-manual-input-cam");
  if (inputMode) inputMode.style.display = "none";
  if (chipMode) chipMode.style.display = "flex";
  if (btnKeyboard) btnKeyboard.classList.remove("active-mode");
  if (inputField) inputField.value = "";
}
window.dongNhapTayQR = dongNhapTayQR;

// ── Cập nhật trạng thái công tắc quét trùng ────────────────────────
function capNhatTrangThaiTrungQR() {
  const elCheck = document.getElementById("qr-cho-phep-trung-cam");
  const btnTrung = document.getElementById("btn-quet-trung-qr");
  if (btnTrung && elCheck) {
    btnTrung.classList.toggle("active-repeat", elCheck.checked);
  }
}
window.capNhatTrangThaiTrungQR = capNhatTrangThaiTrungQR;

// ── Dropdown Chọn Loại Giao Dịch ───────────────────────────────────
function toggleDropdownLoaiQR(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById("chon-loai-list");
  if (menu) menu.classList.toggle("show");
}
window.toggleDropdownLoaiQR = toggleDropdownLoaiQR;

function chonLoaiQR(loai, event) {
  if (event) event.stopPropagation();
  loaiQuetQR = loai;
  const btn = document.getElementById("chon-loai-btn");
  const inputHidden = document.getElementById("chon-loai");
  if (btn) btn.innerHTML = loai + '<span style="font-size:12px;color:var(--cream-soft);margin-left:auto">▼</span>';
  if (inputHidden) inputHidden.value = loai;

  document.querySelectorAll("#chon-loai-list .custom-option").forEach(opt => {
    if (opt.getAttribute("data-value") === loai) opt.classList.add("active");
    else opt.classList.remove("active");
  });

  const menu = document.getElementById("chon-loai-list");
  if (menu) menu.classList.remove("show");
}
window.chonLoaiQR = chonLoaiQR;

document.addEventListener("click", (e) => {
  const menu = document.getElementById("chon-loai-list");
  const btn = document.getElementById("chon-loai-btn");
  if (menu && menu.classList.contains("show")) {
    if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
      menu.classList.remove("show");
    }
  }
});

// ── Bắt đầu Quét Camera ────────────────────────────────────────────
async function batDauQuetQR() {
  const oNgay = document.getElementById("chon-ngay");
  const oLoai = document.getElementById("chon-loai");

  if (oNgay && oNgay.value) {
    ngayQuetQR = oNgay.value;
  } else if (ngayQuetQR && oNgay) {
    oNgay.value = ngayQuetQR;
  } else if (!ngayQuetQR) {
    ngayQuetQR = (typeof layNgayHomNayLocal === "function") ? layNgayHomNayLocal() : new Date().toISOString().split("T")[0];
    if (oNgay) oNgay.value = ngayQuetQR;
  }

  if (oLoai && oLoai.value) {
    loaiQuetQR = oLoai.value;
  } else if (loaiQuetQR && oLoai) {
    if (typeof chonLoaiQR === "function") chonLoaiQR(loaiQuetQR);
    else oLoai.value = loaiQuetQR;
  }

  if (!ngayQuetQR) {
    showCanhBaoQR("⚠️ Vui lòng chọn ngày!", "warning");
    return;
  }
  if (!loaiQuetQR) {
    showCanhBaoQR("⚠️ Vui lòng chọn loại giao dịch (Nhập SX, Xuất SX...)!", "warning");
    return;
  }

  // Khởi tạo phiên mới nếu chưa có id phiên
  if (!idPhienHienTaiQR) {
    idPhienHienTaiQR = "QR_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
    demSoDotQR = 1;
    phienQuetQR = [];
    soLuongDaGuiHienTaiQR = 0;
  }

  dangQuetQR = true;
  window.dangQuetQR = true;

  document.getElementById("form-chon").style.display = "none";
  const qrNhap = document.getElementById("qr-nhap");
  if (qrNhap) qrNhap.style.display = "none";
  document.getElementById("qr-cam").style.display = "block";
  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(true); else document.body.classList.add("cam-active");
  document.getElementById("qr-ketqua").style.display = "none";
  document.body.classList.add("cam-active");

  const statusEl = document.getElementById("qr-status");
  if (statusEl) statusEl.innerHTML = '<div class="cam-status-dot"></div><span>Đợt ' + demSoDotQR + '</span>';

  const demEl = document.getElementById("qr-dem");
  if (demEl) demEl.textContent = "Đã quét: " + phienQuetQR.length + " bao";

  const btnToggle = document.getElementById("btn-dung-tieptuc-qr");
  if (btnToggle) {
    btnToggle.innerHTML = SVG_SHUTTER_PAUSE;
    btnToggle.classList.remove("paused");
    btnToggle.title = "Dừng quét";
  }

  const pauseOverlay = document.getElementById("qr-cam-pause-overlay");
  if (pauseOverlay) pauseOverlay.style.display = "none";

  capNhatLogQR();

  try {
    const videoEl = document.getElementById("reader");
    const track = videoEl && videoEl.srcObject ? videoEl.srcObject.getVideoTracks()[0] : null;
    const isCamRunning = track && track.readyState === "live";

    if (!zxingReaderQR || !isCamRunning) {
      zxingReaderQR = await khoiTaoCameraFast("reader", (txt) => {
        if (txt && dangQuetQR) {
          khiQuetDuocMaQR({ getText: () => txt });
        }
      });
    } else if (videoEl && videoEl.paused) {
      videoEl.play().catch(() => {});
    }
  } catch (e) {
    showCanhBaoQR("Lỗi camera: " + e, "error");
    dungQuetQR();
  }
}
window.batDauQuetQR = batDauQuetQR;

// Giữ tương thích ngược với nút Quét cũ nếu HTML gọi batDauQuet
window.batDauQuet = batDauQuetQR;

// ── Xử lý dữ liệu khi quét được mã QR ──────────────────────────────
function khiQuetDuocMaQR(result) {
  if (!result || !dangQuetQR) return;
  const rawText = (typeof result.getText === "function" ? result.getText() : String(result || "")).trim();
  if (!rawText) return;
  const parsed = typeof parseQRText === "function" ? parseQRText(rawText) : null;
  const data = (parsed && parsed.id) ? parsed : {
    id: rawText,
    msp: rawText,
    qc: rawText,
    kg: 0
  };
  if (!data || !data.id) return;

  const keyQR = (data.id || "").toLowerCase();
  const elCheck = document.getElementById("qr-cho-phep-trung-cam");
  const choPhepTrung = elCheck ? elCheck.checked : false;

  if (window.ScannerCore && typeof window.ScannerCore.kiemTraKhoaMa === "function") {
    if (window.ScannerCore.kiemTraKhoaMa(mapKhoaQR, keyQR, choPhepTrung)) return;
  } else {
    const lockMs = choPhepTrung ? 1500 : 500;
    const now = Date.now();
    if (mapKhoaQR.has(keyQR) && (now - mapKhoaQR.get(keyQR)) < lockMs) return;
    mapKhoaQR.set(keyQR, now);
  }

  const trung = phienQuetQR.find(r => r.id === data.id);
  if (!choPhepTrung && trung) {
    if (window.ScannerCore && typeof window.ScannerCore.khoaCanhBaoTrung === "function") {
      window.ScannerCore.khoaCanhBaoTrung(mapKhoaQR, keyQR, 1500);
    } else {
      mapKhoaQR.set(keyQR, Date.now() + 1500);
    }
    if (typeof hienVienFeedbackQR === "function") hienVienFeedbackQR("duplicate");
    if (typeof phatVibrateError === "function") phatVibrateError();
    else if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    // Hiện popup thông báo màu đỏ nổi bật khi quét trùng: Đã quét + thời gian trong 2s
    const gioQuet = typeof dinhDangGioQuetTrung === "function" ? dinhDangGioQuetTrung(trung.thoiGian) : "";
    showCanhBaoQR("Đã quét " + gioQuet, "error");
    return;
  }

  // Quét thành công: KHÔNG HIỆN POPUP, chỉ phát âm thanh/rung và hiển thị dưới nhật ký (log)
  if (typeof hienVienFeedbackQR === "function") hienVienFeedbackQR("success");
  if (typeof phatTiengBip === "function") phatTiengBip();
  if (typeof phatVibrateSuccess === "function") phatVibrateSuccess();

  const qcChuan = data.qc || data.msp;
  const kgChuan = parseFloat(data.kg || 0) || 0;

  phienQuetQR.push({
    id: data.id,
    msp: data.msp,
    qc: qcChuan,
    kg: kgChuan,
    thoiGian: new Date(),
    dotQuet: demSoDotQR
  });

  const demEl = document.getElementById("qr-dem");
  if (demEl) demEl.textContent = "Đã quét: " + phienQuetQR.length + " bao";

  luuPhienDoDangQR();
  capNhatLogQR();

  maQRVuaQuetQR = rawText || data.id || "";
  const lockStatusEl = document.getElementById("qr-lock-status");
  if (lockStatusEl) {
    lockStatusEl.textContent = maQRVuaQuetQR;
    lockStatusEl.title = maQRVuaQuetQR;
  }
}
window.khiQuetDuocMaQR = khiQuetDuocMaQR;

let maQRVuaQuetQR = "";
function saoChepMaQR(ev) {
  if (ev) ev.stopPropagation();
  if (window.ScannerCore && typeof window.ScannerCore.saoChepMaQR === "function") {
    window.ScannerCore.saoChepMaQR(maQRVuaQuetQR, "icon-copy-qr", null, showCanhBaoQR);
  }
}
window.saoChepMaQR = saoChepMaQR;

function themMaThuCongQR() {
  const el = document.getElementById("qr-manual-input-cam");
  if (!el) return;
  const val = (el.value || "").trim();
  if (!val) {
    if (typeof showCanhBaoQR === "function") showCanhBaoQR("Vui lòng nhập mã!", "warning");
    return;
  }
  el.value = "";
  if (typeof dongNhapTayQR === "function") dongNhapTayQR();
  khiQuetDuocMaQR({ getText: () => val });
}
window.themMaThuCongQR = themMaThuCongQR;

// ── Nhập tay mã thủ công ───────────────────────────────────────────
let denPinBatQR = false;
async function toggleFlashQR() {
  if (!zxingReaderQR || !dangQuetQR) return;
  if (typeof batTatDenPinCamera === "function") {
    denPinBatQR = await batTatDenPinCamera("reader", "btn-flash-qr", denPinBatQR);
  }
}
window.toggleFlashQR = toggleFlashQR;

// ── Dừng / Tiếp tục Camera (Tối ưu giống hệt BTP & CX1 - Giữ luồng để có lại tức thì 0s) ──
function dungQuetQR() {
  dangQuetQR = false;
  window.dangQuetQR = false;
  if (typeof dungCameraFast === "function") {
    dungCameraFast("reader", zxingReaderQR || window.zxingReaderQR);
  }
  const statusEl = document.getElementById("qr-status");
  if (statusEl) statusEl.innerHTML = '<div class="cam-status-dot paused"></div><span>Đợt ' + (demSoDotQR || 1) + '</span>';
  const btnToggle = document.getElementById("btn-dung-tieptuc-qr");
  if (btnToggle) {
    btnToggle.innerHTML = SVG_SHUTTER_PLAY;
    btnToggle.classList.add("paused");
    btnToggle.title = "Quét tiếp";
  }
  const pauseOverlay = document.getElementById("qr-cam-pause-overlay");
  if (pauseOverlay) pauseOverlay.style.display = "flex";
}
window.dungQuetQR = dungQuetQR;

async function tiepTucQuetQR() {
  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(true); else document.body.classList.add("cam-active");
  const maxDot = phienQuetQR.length > 0 ? Math.max(0, ...phienQuetQR.map(r => r.dotQuet || 1)) : 0;
  demSoDotQR = maxDot > 0 ? maxDot + 1 : 1;
  dangQuetQR = true;
  window.dangQuetQR = true;
  luuPhienDoDangQR();
  const statusEl = document.getElementById("qr-status");
  if (statusEl) statusEl.innerHTML = '<div class="cam-status-dot"></div><span>Đợt ' + demSoDotQR + '</span>';
  const btnToggle = document.getElementById("btn-dung-tieptuc-qr");
  if (btnToggle) {
    btnToggle.innerHTML = SVG_SHUTTER_PAUSE;
    btnToggle.classList.remove("paused");
    btnToggle.title = "Dừng quét";
  }
  const pauseOverlay = document.getElementById("qr-cam-pause-overlay");
  if (pauseOverlay) pauseOverlay.style.display = "none";

  try {
    const videoEl = document.getElementById("reader");
    const track = videoEl && videoEl.srcObject ? videoEl.srcObject.getVideoTracks()[0] : null;
    const isCamRunning = track && track.readyState === "live";

    if (!zxingReaderQR || !isCamRunning) {
      zxingReaderQR = await khoiTaoCameraFast("reader", (txt) => {
        if (txt && dangQuetQR) {
          khiQuetDuocMaQR({ getText: () => txt });
        }
      });
    } else if (videoEl && videoEl.paused) {
      videoEl.play().catch(() => {});
    }
  } catch (e) {
    showCanhBaoQR("Lỗi camera: " + e, "error");
    dungQuetQR();
  }
}
window.tiepTucQuetQR = tiepTucQuetQR;

function toggleDungTiepTucQR() {
  if (dangQuetQR) dungQuetQR();
  else tiepTucQuetQR();
}
window.toggleDungTiepTucQR = toggleDungTiepTucQR;

// Tắt hẳn phần cứng camera khi kết thúc phiên hoặc chuyển sang tab khác để tiết kiệm pin
function tatCameraQR() {
  dangQuetQR = false;
  window.dangQuetQR = false;
  if (zxingReaderQR) {
    dungCameraFast("reader", zxingReaderQR);
    zxingReaderQR = null;
  }
  const pauseOverlay = document.getElementById("qr-cam-pause-overlay");
  if (pauseOverlay) pauseOverlay.style.display = "none";
  document.body.classList.remove("cam-active");
}
window.tatCameraQR = tatCameraQR;
window.dungQuet = tatCameraQR;

// ── Cập nhật Bảng Nhật Ký Trực Tiếp (Live Log) Nhóm Đợt + Accordion + Swipe to Delete ──
window.expandedQRGroups = window.expandedQRGroups || new Set();

function toggleChiTietQRGroup(groupKey) {
  if (window.expandedQRGroups.has(groupKey)) {
    window.expandedQRGroups.delete(groupKey);
  } else {
    window.expandedQRGroups.add(groupKey);
  }
  const safeId = 'qr-grp-' + btoa(encodeURIComponent(groupKey)).replace(/[^a-zA-Z0-9]/g, '');
  const detailsList = document.querySelectorAll('[id="details-' + safeId + '"]');
  const chevList = document.querySelectorAll('[id="chev-' + safeId + '"]');
  const isOpen = window.expandedQRGroups.has(groupKey);
  if (detailsList.length > 0) {
    detailsList.forEach(el => el.style.display = isOpen ? 'block' : 'none');
    chevList.forEach(el => el.style.transform = isOpen ? 'rotate(180deg)' : 'none');
  } else {
    capNhatLogQR();
  }
}
window.toggleChiTietQRGroup = toggleChiTietQRGroup;

function onTapRowQR(groupKey, event) {
  const content = event.currentTarget;
  if (content && content.classList.contains('swiped')) {
    content.style.transform = 'translateX(0px)';
    content.classList.remove('swiped');
    return;
  }
  toggleChiTietQRGroup(groupKey);
}
window.onTapRowQR = onTapRowQR;

function xoaNhomQR(groupKey, event) {
  if (event) event.stopPropagation();
  const parts = groupKey.split("___");
  const dotNum = parseInt(parts[0], 10) || 1;
  const qcVal = parts[1] || '—';

  const doXoa = () => {
    phienQuetQR = phienQuetQR.filter(item => !((item.dotQuet || 1) === dotNum && String(item.qc || item.msp || '—') === qcVal));
    const maxDot = phienQuetQR.length > 0 ? Math.max(0, ...phienQuetQR.map(r => r.dotQuet || 1)) : 0;
    demSoDotQR = maxDot > 0 ? maxDot : 1;
    luuPhienDoDangQR();
    capNhatLogQR();
    if (typeof showCanhBaoQR === "function") showCanhBaoQR("Đã xóa nhóm " + qcVal);
  };

  if (typeof moXacNhanApp === "function") {
    moXacNhanApp("Xóa toàn bộ mã " + qcVal + " trong Đợt " + dotNum + "?", doXoa, "Xóa", null, "Hủy", "Xác nhận xóa");
  } else {
    doXoa();
  }
}
window.xoaNhomQR = xoaNhomQR;

function xoaMaTrongLiveLogQR(originalIndex, event) {
  if (event) event.stopPropagation();
  if (originalIndex >= 0 && originalIndex < phienQuetQR.length) {
    const item = phienQuetQR[originalIndex];
    const tenMa = item ? (item.qc || item.msp || "mã này") : "mã này";
    const doXoa = () => {
      phienQuetQR.splice(originalIndex, 1);
      const maxDot = phienQuetQR.length > 0 ? Math.max(0, ...phienQuetQR.map(r => r.dotQuet || 1)) : 0;
      demSoDotQR = maxDot > 0 ? maxDot : 1;
      const demEl = document.getElementById("qr-dem");
      if (demEl) demEl.textContent = "Đã quét: " + phienQuetQR.length + " bao";
      const statusEl = document.getElementById("qr-status");
      if (statusEl && !dangQuetQR) {
        statusEl.innerHTML = '<div class="cam-status-dot paused"></div><span>Đợt ' + demSoDotQR + '</span>';
      }
      luuPhienDoDangQR();
      capNhatLogQR();
      if (typeof showCanhBaoQR === "function") showCanhBaoQR("Đã xóa " + tenMa);
    };
    if (typeof moXacNhanApp === "function") {
      moXacNhanApp("Xóa lần quét này của " + tenMa + "?", doXoa, "Xóa", null, "Hủy", "Xác nhận xóa");
    } else {
      doXoa();
    }
  }
}
window.xoaMaTrongLiveLogQR = xoaMaTrongLiveLogQR;

function khoiTaoSuKienSwipeQR(containerId) {
  if (window.ScannerCore && typeof window.ScannerCore.khoiTaoSwipe === "function") {
    window.ScannerCore.khoiTaoSwipe(containerId, ".btp-swipe-content", "__swipeInit");
  }
}

function capNhatLogQR() {
  const container = document.getElementById("qr-log-list");
  const containerNhap = document.getElementById("qr-nhap-log-list");
  const countEl = document.getElementById("qr-log-count");
  const countNhap = document.getElementById("qr-nhap-log-count");
  if (countEl) countEl.textContent = phienQuetQR.length + " bao";
  if (countNhap) countNhap.textContent = phienQuetQR.length + " bao";
  if (!container && !containerNhap) return;

  if (phienQuetQR.length === 0) {
    const emptyHtml = '<div class="btp-empty-log">Chưa có mã nào được quét</div>';
    if (container) container.innerHTML = emptyHtml;
    if (containerNhap) containerNhap.innerHTML = emptyHtml;
    return;
  }

  // Nhóm các mã quét theo ĐỢT (dotQuet) và QUY CÁCH (qc)
  const groupMap = new Map();
  phienQuetQR.forEach((item, originalIndex) => {
    const dot = item.dotQuet || 1;
    const qc = item.qc || item.msp || item.rawQR || '—';
    const key = `${dot}___${qc}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key: key,
        dot: dot,
        qc: qc,
        items: [],
        lastThoiGian: item.thoiGian
      });
    }
    const g = groupMap.get(key);
    g.items.push({ item, originalIndex });
    g.lastThoiGian = item.thoiGian;
  });

  const MAX_LIVE_LOG = 30;
  // Nhóm có lượt quét mới nhất hiển thị trên cùng
  const groups = Array.from(groupMap.values()).reverse();
  const displayedGroups = groups.slice(0, MAX_LIVE_LOG);

  let html = displayedGroups.map((g, idx) => {
    const safeQc = typeof escapeHtml === "function" ? escapeHtml(g.qc) : g.qc;
    const safeId = 'qr-grp-' + btoa(encodeURIComponent(g.key)).replace(/[^a-zA-Z0-9]/g, '');
    const isExpanded = window.expandedQRGroups.has(g.key);
    const countBadge = g.items.length > 1 ? `<span class="btp-badge-count">×${g.items.length}</span>` : '';
    const gio = g.lastThoiGian ? new Date(g.lastThoiGian).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
    const flashClass = idx === 0 ? ' scan-flash-new' : '';

    const tongKgNhom = g.items.reduce((sum, it) => sum + (Number(it.item.kg) || 0), 0);
    const kgText = tongKgNhom > 0 ? (Number.isInteger(tongKgNhom) ? tongKgNhom : tongKgNhom.toFixed(1)) : '—';
    const escapedKeyJs = String(g.key || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;");

    let subItemsHtml = g.items.map((it, subIdx) => {
      const subGio = it.item.thoiGian ? new Date(it.item.thoiGian).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
      const subKg = (it.item.kg !== undefined && it.item.kg !== null && Number(it.item.kg) > 0) ? it.item.kg : '0';
      const safeSubQc = typeof escapeHtml === "function" ? escapeHtml(it.item.qc || g.qc) : (it.item.qc || g.qc);
      return `<div class="btp-sub-item">
        <span class="btp-sub-stt">${subIdx + 1}</span>
        <span class="btp-sub-msp">${safeSubQc}</span>
        <span class="btp-sub-kg">${subKg}</span>
        <span class="btp-sub-gio">${subGio}</span>
        <button type="button" class="btp-sub-del-btn" onclick="xoaMaTrongLiveLogQR(${it.originalIndex}, event)" title="Xóa lần quét này">
          <i class="ti ti-trash"></i>
        </button>
      </div>`;
    }).join("");

    return `<div class="btp-swipe-container${flashClass}">
      <div class="btp-swipe-row-wrap">
        <div class="btp-swipe-actions">
          <button type="button" class="btp-swipe-btn-del" onclick="xoaNhomQR('${escapedKeyJs}', event)">
            <i class="ti ti-trash"></i>
            <span>Xóa</span>
          </button>
        </div>
        <div class="btp-swipe-content" onclick="onTapRowQR('${escapedKeyJs}', event)">
          <span class="btp-col-dot">${g.dot}</span>
          <div class="btp-col-msp-wrap">
            <span class="btp-col-msp">${safeQc}</span>
            ${countBadge}
          </div>
          <span class="btp-col-kg">${kgText}</span>
          <span class="btp-col-gio">${gio}</span>
          <i id="chev-${safeId}" class="ti ti-chevron-down btp-chevron" style="transform:${isExpanded ? 'rotate(180deg)' : 'none'};"></i>
        </div>
      </div>
      <div id="details-${safeId}" class="btp-group-details" style="display:${isExpanded ? 'block' : 'none'};">
        ${subItemsHtml}
      </div>
    </div>`;
  }).join("");

  if (groups.length > MAX_LIVE_LOG) {
    const conLai = groups.length - MAX_LIVE_LOG;
    html += `<div style="text-align:center; padding:6px 0; font-size:11px; color:#64748b; font-style:italic;">... và ${conLai} loại mã trước đó (xem đầy đủ ở bảng kết quả)</div>`;
  }

  if (container) container.innerHTML = html;
  if (containerNhap) containerNhap.innerHTML = html;

  khoiTaoSuKienSwipeQR("qr-log-list");
  khoiTaoSuKienSwipeQR("qr-nhap-log-list");
}

// ── Quản lý trạng thái Accordion Bảng Kết Quả Quét QR ──────────────────
window.expandedKQQR = window.expandedKQQR || new Set();

function toggleChiTietKQQR(groupKey) {
  if (window.expandedKQQR.has(groupKey)) {
    window.expandedKQQR.delete(groupKey);
  } else {
    window.expandedKQQR.add(groupKey);
  }
  const safeId = 'qr-kq-grp-' + btoa(encodeURIComponent(groupKey)).replace(/[^a-zA-Z0-9]/g, '');
  const detailsEl = document.getElementById('details-' + safeId);
  const chevEl = document.getElementById('chev-' + safeId);
  if (detailsEl && chevEl) {
    const isOpen = window.expandedKQQR.has(groupKey);
    detailsEl.style.display = isOpen ? 'block' : 'none';
    if (isOpen) chevEl.classList.add('open'); else chevEl.classList.remove('open');
  } else {
    hienKetQuaQuetQR();
  }
}
window.toggleChiTietKQQR = toggleChiTietKQQR;

function xoaItemKqQR(originalIndex, ev) {
  if (ev) ev.stopPropagation();
  if (originalIndex >= 0 && originalIndex < phienQuetQR.length) {
    const item = phienQuetQR[originalIndex];
    const tenMa = item ? (item.qc || item.msp || "bao này") : "bao này";
    const doXoa = () => {
      phienQuetQR.splice(originalIndex, 1);
      luuPhienDoDangQR();
      hienKetQuaQuetQR();
      capNhatLogQR();
      if (typeof showCanhBaoQR === "function") showCanhBaoQR("Đã xóa 1 bao " + tenMa, "success");
    };
    if (typeof moXacNhanApp === "function") {
      moXacNhanApp("Xóa lần quét này của " + tenMa + "?", doXoa, "Xóa", null, "Hủy", "Xác nhận xóa");
    } else {
      doXoa();
    }
  }
}
window.xoaItemKqQR = xoaItemKqQR;

function khoiTaoSwipeKQQR() {
  if (window.ScannerCore && typeof window.ScannerCore.khoiTaoSwipe === "function") {
    window.ScannerCore.khoiTaoSwipe("qr-tbody-dot", ".kq-swipe-content", "__swipeKqInit");
  }
}

// ── Tính toán 2 Bảng Kết Quả Chuẩn Accordion (Đợt, QC, Bao, KG) ───────────
function taoHangKetQuaQuetQR(danhSach) {
  let tongDotCuaPhien = {};
  let tongGomLoaiMa = {};
  let tongBaoAll = 0;
  let tongKGAll = 0;

  danhSach.forEach((r, originalIndex) => {
    tongBaoAll += 1;
    tongKGAll += (r.kg || 0);

    // Bảng 1: Gom theo Đợt + Quy Cách
    const keyDot = r.dotQuet + "___" + (r.qc || "KHAC");
    if (!tongDotCuaPhien[keyDot]) {
      tongDotCuaPhien[keyDot] = {
        key: keyDot,
        dot: r.dotQuet,
        msp: r.msp || "—",
        qc: r.qc || "—",
        items: []
      };
    }
    tongDotCuaPhien[keyDot].items.push({ item: r, originalIndex });

    // Bảng 2: Gom theo Quy Cách toàn phiên
    const keyGom = r.qc || "KHAC";
    if (!tongGomLoaiMa[keyGom]) {
      tongGomLoaiMa[keyGom] = { msp: r.msp || "—", qc: r.qc || "—", soLuong: 0, tongKG: 0 };
    }
    tongGomLoaiMa[keyGom].soLuong += 1;
    tongGomLoaiMa[keyGom].tongKG += (r.kg || 0);
  });

  // Render HTML Bảng Chi Tiết Accordion (theo Đợt)
  let hangDot = "";
  const dotGroups = Object.values(tongDotCuaPhien);

  if (dotGroups.length === 0) {
    hangDot = '<div style="text-align:center; padding:24px; color:var(--text-lighter); font-size:13px;">Chưa có dữ liệu quét</div>';
  } else {
    dotGroups.forEach(g => {
      const soBaoNhom = g.items.length;
      const tongKgNhom = g.items.reduce((sum, it) => sum + (it.item.kg || 0), 0);
      const safeKey = String(g.key);
      const safeId = 'qr-kq-grp-' + btoa(encodeURIComponent(safeKey)).replace(/[^a-zA-Z0-9]/g, '');
      const isOpen = window.expandedKQQR.has(safeKey);
      const safeQc = typeof escapeHtml === "function" ? escapeHtml(g.qc) : g.qc;
      const countBadge = soBaoNhom > 1 ? `<span class="kq-badge-count">×${soBaoNhom}</span>` : '';
      const escapedQcParam = String(g.qc || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;");

      let subItemsHtml = g.items.map((it, subIdx) => {
        const subGio = it.item.thoiGian ? new Date(it.item.thoiGian).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
        const subKg = it.item.kg ? Number(it.item.kg).toFixed(1) : "0.0";
        const safeSubName = typeof escapeHtml === "function" ? escapeHtml(it.item.qc || it.item.msp || "") : (it.item.qc || it.item.msp || "");

        return `<div class="kq-sub-item">
          <span class="kq-sub-stt">${subIdx + 1}</span>
          <span class="kq-sub-name">${safeSubName}</span>
          <span class="kq-sub-val">${subKg} kg</span>
          <span class="kq-sub-time">${subGio}</span>
          <button type="button" class="kq-sub-del-btn" onclick="xoaItemKqQR(${it.originalIndex}, event)" title="Xóa bao này">
            <i class="ti ti-trash"></i>
          </button>
        </div>`;
      }).join("");

      hangDot += `
      <div class="kq-swipe-container">
        <div class="kq-swipe-row-wrap">
          <div class="kq-swipe-actions">
            <button type="button" class="kq-swipe-btn-del" onclick="xoaNhomDotQR(${g.dot}, '${escapedQcParam}')">
              <i class="ti ti-trash"></i>
              <span>Xóa</span>
            </button>
          </div>
          <div class="kq-swipe-content" onclick="toggleChiTietKQQR('${safeKey}')">
            <span class="kq-col-dot">Đợt ${g.dot}</span>
            <div class="kq-col-name">
              <span>${safeQc}</span>
              ${countBadge}
            </div>
            <span class="kq-col-count">${soBaoNhom}</span>
            <span class="kq-col-kg">${tongKgNhom.toFixed(1)}</span>
            <span class="kq-col-chevron"><i id="chev-${safeId}" class="ti ti-chevron-down ${isOpen ? 'open' : ''}"></i></span>
          </div>
        </div>
        <div id="details-${safeId}" class="kq-group-details" style="display:${isOpen ? 'block' : 'none'};">
          ${subItemsHtml}
          <div style="display:flex; justify-content:flex-end; padding:4px 2px 2px 2px;">
            <button type="button" class="kq-sub-edit-btn" onclick="nhapTayKGQR(${g.dot}, '${escapedQcParam}')">
              <i class="ti ti-edit"></i> Sửa Kg đợt ${g.dot}
            </button>
          </div>
        </div>
      </div>`;
    });
  }

  let footDot = `
    <div style="flex:0.8; font-weight:700; color:var(--row-text);">TỔNG</div>
    <div style="flex:1.8;">&nbsp;</div>
    <div style="flex:0.7; text-align:center; font-weight:800; font-family:'IBM Plex Mono', monospace;">${tongBaoAll}</div>
    <div style="flex:1; text-align:right; font-weight:800; font-family:'IBM Plex Mono', monospace; color:var(--success);">${tongKGAll.toFixed(1)}</div>
    <div style="width:22px;"></div>`;

  // Render HTML Bảng Tổng Hợp (theo QC)
  let hangGom = "";
  const gomList = Object.values(tongGomLoaiMa);
  if (gomList.length === 0) {
    hangGom = '<div style="text-align:center; padding:24px; color:var(--text-lighter); font-size:13px;">Chưa có dữ liệu</div>';
  } else {
    gomList.forEach(item => {
      const safeQc = typeof escapeHtml === "function" ? escapeHtml(item.qc) : item.qc;
      hangGom += `
      <div class="kq-gom-row">
        <div style="flex:2.3; font-weight:600; color:var(--row-text);">${safeQc}</div>
        <div style="flex:0.7; text-align:center; font-weight:700; font-family:'IBM Plex Mono', monospace;">${item.soLuong}</div>
        <div style="flex:1; text-align:right; font-weight:700; font-family:'IBM Plex Mono', monospace; color:var(--success);">${item.tongKG.toFixed(1)}</div>
      </div>`;
    });
  }

  let footGom = `
    <div style="flex:2.3; font-weight:700; color:var(--row-text);">TỔNG</div>
    <div style="flex:0.7; text-align:center; font-weight:800; font-family:'IBM Plex Mono', monospace;">${tongBaoAll}</div>
    <div style="flex:1; text-align:right; font-weight:800; font-family:'IBM Plex Mono', monospace; color:var(--success);">${tongKGAll.toFixed(1)}</div>`;

  return { hangDot, footDot, hangGom, footGom, tongBaoAll, tongKGAll };
}

// ── Chuyển Đổi Tab Chi Tiết / Tổng Hợp ──────────────────────────────
function toggleQRView(mode) {
  const wrapChitiet = document.getElementById("qr-wrap-chitiet");
  const wrapGom = document.getElementById("qr-wrap-gom");
  const tabChitiet = document.getElementById("qr-tab-chitiet");
  const tabTonghop = document.getElementById("qr-tab-tonghop");

  if (mode === "chitiet") {
    if (wrapChitiet) wrapChitiet.style.display = "block";
    if (wrapGom) wrapGom.style.display = "none";
    if (tabChitiet) {
      tabChitiet.style.background = "var(--surface)";
      tabChitiet.style.color = "var(--row-text)";
      tabChitiet.style.boxShadow = "0 2px 6px rgba(0,0,0,0.06)";
    }
    if (tabTonghop) {
      tabTonghop.style.background = "transparent";
      tabTonghop.style.color = "var(--row-muted)";
      tabTonghop.style.boxShadow = "none";
    }
  } else {
    if (wrapChitiet) wrapChitiet.style.display = "none";
    if (wrapGom) wrapGom.style.display = "block";
    if (tabTonghop) {
      tabTonghop.style.background = "var(--surface)";
      tabTonghop.style.color = "var(--row-text)";
      tabTonghop.style.boxShadow = "0 2px 6px rgba(0,0,0,0.06)";
    }
    if (tabChitiet) {
      tabChitiet.style.background = "transparent";
      tabChitiet.style.color = "var(--row-muted)";
      tabChitiet.style.boxShadow = "none";
    }
  }
}
window.toggleQRView = toggleQRView;

// ── Hiển thị Màn hình Kết Quả ──────────────────────────────────────
function xemKetQuaQuetQR() {
  tatCameraQR();
  hienKetQuaQuetQR();
  luuPhienDoDangQR();
  luuVaoLichSuQR();
}
window.xemKetQuaQuetQR = xemKetQuaQuetQR;

function hienKetQuaQuetQR() {
  const { hangDot, footDot, hangGom, footGom, tongBaoAll, tongKGAll } = taoHangKetQuaQuetQR(phienQuetQR);
  const tbodyDot = document.getElementById("qr-tbody-dot");
  const tfootDot = document.getElementById("qr-tfoot-dot");
  const tbodyGom = document.getElementById("qr-tbody-gom");
  const tfootGom = document.getElementById("qr-tfoot-gom");

  if (tbodyDot) tbodyDot.innerHTML = hangDot;
  if (tfootDot) tfootDot.innerHTML = footDot;
  if (tbodyGom) tbodyGom.innerHTML = hangGom;
  if (tfootGom) tfootGom.innerHTML = footGom;
  khoiTaoSwipeKQQR();

  const tongBaoEl = document.getElementById("qr-tong-bao");
  if (tongBaoEl) tongBaoEl.textContent = tongBaoAll;
  
  const tongKgEl = document.getElementById("qr-tong-kg");
  if (tongKgEl) tongKgEl.textContent = tongKGAll.toFixed(1);

  const tieuDeKetQua = document.getElementById("qr-ketqua-tieude");
  if (tieuDeKetQua) tieuDeKetQua.textContent = "Hoàn tất: " + (loaiQuetQR || "Giao dịch") + " (" + (ngayQuetQR || "") + ")";

  const qrCam = document.getElementById("qr-cam");
  if (qrCam) qrCam.style.display = "none";
  const qrNhap = document.getElementById("qr-nhap");
  if (qrNhap) qrNhap.style.display = "none";
  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(false); else document.body.classList.remove("cam-active");
  document.getElementById("form-chon").style.display = "none";
  document.getElementById("qr-ketqua").style.display = "block";

  // Mặc định hiện Chi Tiết
  toggleQRView("chitiet");

  // Cập nhật trạng thái nút gửi
  const btnGui = document.getElementById("btn-gui-dulieu-qr");
  if (btnGui) {
    if (phienQuetQR.length > soLuongDaGuiHienTaiQR) {
      btnGui.disabled = false;
      btnGui.innerHTML = '<i class="ti ti-cloud-upload"></i> Gửi dữ liệu lên Sheet';
      btnGui.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
      btnGui.style.color = "#1a1a2e";
    } else if (phienQuetQR.length > 0 && phienQuetQR.length === soLuongDaGuiHienTaiQR) {
      btnGui.disabled = true;
      btnGui.innerHTML = '<i class="ti ti-circle-check"></i> Đã gửi thành công';
      btnGui.style.background = "linear-gradient(135deg, #10b981, #059669)";
      btnGui.style.color = "#fff";
    }
  }
}
window.hienKetQuaQuetQR = hienKetQuaQuetQR;

// ── Sửa KG theo đợt & QC (dùng moPromptApp thay thế prompt) ─────────
let qrDangSuaDot = null;
let qrDangSuaQc = null;

function nhapTayKGQR(dot, qc) {
  qrDangSuaDot = dot;
  qrDangSuaQc = qc;
  let modal = document.getElementById("qr-nhap-tay-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "qr-nhap-tay-modal";
    modal.className = "overlay";
    modal.innerHTML = `
      <div class="overlay-card">
        <div class="overlay-title" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span id="qr-sua-chitiet-title"></span>
          <button type="button" class="btn btn-sm btn-red" style="padding:4px 8px;font-size:12px;" onclick="xoaTongQR()">Xóa tổng</button>
        </div>
        <div class="cx5-chitiet-kg" id="qr-sua-chitiet-container" style="margin-top:10px">
        </div>
        <div style="display:flex;gap:8px;margin-top:14px">
          <input type="text" id="qr-them-kg" inputmode="none" placeholder="Nhập tổng số kg..." onkeydown="if(event.key==='Enter'){event.preventDefault();themKgVaoDotQR()}">
          <button class="btn btn-green" style="width:56px;flex-shrink:0" onclick="themKgVaoDotQR()"><i class="ti ti-check"></i></button>
        </div>
        <button class="btn btn-full" style="background:var(--neutral-solid);color:var(--cream);margin-top:12px" onclick="dongModalSuaKGQR()">Đóng</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const titleEl = document.getElementById("qr-sua-chitiet-title");
  if (titleEl) {
    titleEl.textContent = "Đợt " + qrDangSuaDot + " - QC " + qrDangSuaQc;
  }

  renderSuaChiTietQR();
  modal.classList.add("show");
}

function dongModalSuaKGQR() {
  const modal = document.getElementById("qr-nhap-tay-modal");
  if (modal) modal.classList.remove("show");
  if (typeof dongBanPhimCX5 === "function") dongBanPhimCX5();
}
window.dongModalSuaKGQR = dongModalSuaKGQR;

function renderSuaChiTietQR() {
  const container = document.getElementById("qr-sua-chitiet-container");
  if (!container) return;
  const rows = phienQuetQR.filter(r => r.dotQuet === qrDangSuaDot && r.qc === qrDangSuaQc);

  let listHtml = "";
  if (rows.length === 0) {
    listHtml = '<div style="color:var(--cream-soft);font-size:13px;text-align:center;padding:10px 0;">Chưa có dữ liệu.</div>';
  } else {
    listHtml = rows.map(r => {
      const idx = phienQuetQR.indexOf(r);
      const hienThi = r.kg !== undefined ? r.kg : "0";
      return '<span class="cx5-so-sx">' + hienThi + ' <i class="ti ti-x" onclick="xoaMaQRTrongSua(' + idx + ', event)"></i></span>';
    }).join("");
  }

  container.innerHTML = listHtml;
}

function themKgVaoDotQR() {
  const inputEl = document.getElementById("qr-them-kg");
  if (!inputEl) return;
  const kgStr = inputEl.value;
  if (!kgStr) return;
  const tongKGMoi = parseFloat(kgStr.replace(",", "."));
  if (isNaN(tongKGMoi) || tongKGMoi < 0) {
    showCanhBaoQR("Số KG không hợp lệ!", "error");
    return;
  }

  const cacMa = phienQuetQR.filter(r => r.dotQuet === qrDangSuaDot && r.qc === qrDangSuaQc);
  if (cacMa.length === 0) {
    showCanhBaoQR("Không có mã quét nào để thêm KG!", "error");
    return;
  }

  const kgMoiTungBao = Number((tongKGMoi / cacMa.length).toFixed(3));
  cacMa.forEach((r, idx) => {
    if (idx === cacMa.length - 1) {
      r.kg = Number((tongKGMoi - kgMoiTungBao * (cacMa.length - 1)).toFixed(2));
    } else {
      r.kg = kgMoiTungBao;
    }
  });

  inputEl.value = "";
  luuPhienDoDangQR();
  hienKetQuaQuetQR();
  renderSuaChiTietQR();
  capNhatLogQR();
  dongModalSuaKGQR();
}

function xoaMaQRTrongSua(index, ev) {
  if (ev) ev.stopPropagation();
  phienQuetQR.splice(index, 1);
  const maxDot = phienQuetQR.length > 0 ? Math.max(0, ...phienQuetQR.map(r => r.dotQuet || 1)) : 0;
  demSoDotQR = maxDot > 0 ? maxDot : 1;
  luuPhienDoDangQR();
  hienKetQuaQuetQR();
  renderSuaChiTietQR();
  capNhatLogQR();
  const cacMa = phienQuetQR.filter(r => r.dotQuet === qrDangSuaDot && r.qc === qrDangSuaQc);
  if (cacMa.length === 0) {
    dongNhapTayQR();
  }
}

function xoaTongQR() {
  xoaNhomDotQR(qrDangSuaDot, qrDangSuaQc);
  dongNhapTayQR();
}
window.nhapTayKGQR = nhapTayKGQR;

function xoaNhomDotQR(dot, qc) {
  if (typeof moXacNhanApp === "function") {
    moXacNhanApp(
      `Xóa tất cả bao của QC ${qc} trong Đợt ${dot}?`,
      () => {
        phienQuetQR = phienQuetQR.filter(r => !(r.dotQuet === dot && r.qc === qc));
        const maxDot = phienQuetQR.length > 0 ? Math.max(0, ...phienQuetQR.map(r => r.dotQuet || 1)) : 0;
        demSoDotQR = maxDot > 0 ? maxDot : 1;
        luuPhienDoDangQR();
        hienKetQuaQuetQR();
        capNhatLogQR();
        showCanhBaoQR("Đã xóa nhóm mã Đợt " + dot, "success");
      },
      "Xóa nhóm",
      null,
      "Hủy",
      "Xác nhận xóa"
    );
  }
}
window.xoaNhomDotQR = xoaNhomDotQR;

// ── Quét Tiếp / Quét Mới ───────────────────────────────────────────
async function quetTiepQuetQR() {
  const maxDot = phienQuetQR.length > 0 ? Math.max(0, ...phienQuetQR.map(r => r.dotQuet || 1)) : 0;
  demSoDotQR = maxDot > 0 ? maxDot + 1 : 1;
  dangQuetQR = true;
  window.dangQuetQR = true;
  luuPhienDoDangQR();

  const ngayInput = document.getElementById("chon-ngay");
  if (ngayInput && ngayQuetQR && !ngayInput.value) ngayInput.value = ngayQuetQR;
  if (loaiQuetQR && typeof chonLoaiQR === "function") chonLoaiQR(loaiQuetQR);

  document.getElementById("qr-ketqua").style.display = "none";
  const qrNhap = document.getElementById("qr-nhap");
  if (qrNhap) qrNhap.style.display = "none";
  document.getElementById("form-chon").style.display = "none";
  document.getElementById("qr-cam").style.display = "block";
  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(true); else document.body.classList.add("cam-active");

  const statusEl = document.getElementById("qr-status");
  if (statusEl) statusEl.textContent = "🟢 " + (loaiQuetQR || "Đang quét") + " | Đợt " + demSoDotQR;

  const demEl = document.getElementById("qr-dem");
  if (demEl) demEl.textContent = "Đã quét: " + phienQuetQR.length + " bao";

  const btnToggle = document.getElementById("btn-dung-tieptuc-qr");
  if (btnToggle) {
    btnToggle.innerHTML = SVG_SHUTTER_PAUSE;
    btnToggle.className = "cam-shutter-center-btn";
    btnToggle.classList.remove("paused");
    btnToggle.title = "Dừng quét";
  }

  capNhatLogQR();

  try {
    const videoEl = document.getElementById("reader");
    const track = videoEl && videoEl.srcObject ? videoEl.srcObject.getVideoTracks()[0] : null;
    const isCamRunning = track && track.readyState === "live";

    if (!zxingReaderQR || !isCamRunning) {
      if (zxingReaderQR && typeof dungCameraFast === "function") {
        dungCameraFast("reader", zxingReaderQR);
        zxingReaderQR = null;
      }
      zxingReaderQR = await khoiTaoCameraFast("reader", (txt) => {
        if (txt && dangQuetQR) {
          khiQuetDuocMaQR({ getText: () => txt });
        }
      });
    } else if (videoEl && videoEl.paused) {
      videoEl.play().catch(() => {});
    }
  } catch (e) {
    showCanhBaoQR("Lỗi camera: " + e, "error");
    dungQuetQR();
  }
}
window.quetTiepQuetQR = quetTiepQuetQR;

function quetMoiQuetQR() {
  tatCameraQR();
  phienQuetQR = [];
  demSoDotQR = 1;
  idPhienHienTaiQR = null;
  soLuongDaGuiHienTaiQR = 0;
  xoaPhienDoDangQR();
  document.getElementById("qr-ketqua").style.display = "none";
  document.getElementById("qr-cam").style.display = "none";
  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(false); else document.body.classList.remove("cam-active");
  document.getElementById("form-chon").style.display = "block";
}
window.quetMoiQuetQR = quetMoiQuetQR;

// ── Gửi Dữ Liệu Lên Sheet ──────────────────────────────────────────
async function guiDuLieuQuetQR() {
  if (soLuongDaGuiHienTaiQR > 0 && !phienQuetQR.some(r => r.daGui !== undefined)) {
    for (let i = 0; i < Math.min(soLuongDaGuiHienTaiQR, phienQuetQR.length); i++) {
      phienQuetQR[i].daGui = true;
    }
  }

  const moiBoSung = phienQuetQR.filter(r => !r.daGui);
  if (moiBoSung.length === 0) {
    showCanhBaoQR("Không có dữ liệu mới để gửi!", "error");
    return;
  }

  const btnGui = document.getElementById("btn-gui-dulieu-qr");
  if (btnGui) {
    btnGui.disabled = true;
    btnGui.innerHTML = '<i class="ti ti-loader spin"></i> Đang gửi ' + moiBoSung.length + ' bao...';
  }

  // Map chuẩn các trường dữ liệu: ID, msp, qc, kg, thoiGian, ngay, loai
  const rows = moiBoSung.map(r => ({
    id: r.id,
    msp: r.msp,
    qc: r.qc,
    kg: r.kg || 0,
    thoiGian: r.thoiGian ? (typeof r.thoiGian.toISOString === "function" ? r.thoiGian.toISOString() : r.thoiGian) : new Date().toISOString(),
    ngay: ngayQuetQR,
    loai: loaiQuetQR // Gửi loại (Nhập SX, Xuất SX...) ngầm cho Google Sheet phân loại
  }));

  try {
    await guiLenSheetQuetQR(rows);
    moiBoSung.forEach(r => { r.daGui = true; });
    soLuongDaGuiHienTaiQR = phienQuetQR.filter(r => r.daGui).length;
    xoaPhienDoDangQR();
    luuVaoLichSuQR();
    showCanhBaoQR("✅ Đã gửi thành công " + rows.length + " bao lên Sheet!", "success");
    if (typeof kichHoatKiemTraAutoBackup === "function") kichHoatKiemTraAutoBackup(1000);

    if (btnGui) {
      btnGui.innerHTML = '<i class="ti ti-circle-check"></i> Đã gửi thành công';
      btnGui.style.background = "linear-gradient(135deg, #10b981, #059669)";
      btnGui.style.color = "#fff";
    }
  } catch (err) {
    const pending = docPendingQuetQR();
    rows.forEach(r => {
      if (!pending.some(p => p.id === r.id && p.thoiGian === r.thoiGian)) {
        pending.push(r);
      }
    });
    luuPendingQuetQR(pending);
    if (typeof kichHoatKiemTraAutoBackup === "function") kichHoatKiemTraAutoBackup(2000);
    showCanhBaoQR("Mất mạng — đã lưu tạm " + rows.length + " bao trên máy, sẽ tự gửi lại sau", "error");
    moiBoSung.forEach(r => { r.daGui = true; });
    soLuongDaGuiHienTaiQR = phienQuetQR.filter(r => r.daGui).length;
    luuVaoLichSuQR();

    if (btnGui) {
      btnGui.disabled = false;
      btnGui.innerHTML = '<i class="ti ti-cloud-upload"></i> Gửi dữ liệu lên Sheet';
      btnGui.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
      btnGui.style.color = "#1a1a2e";
    }
  }

  if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
}
window.guiDuLieuQuetQR = guiDuLieuQuetQR;

async function guiLenSheetQuetQR(rows) {
  // Gửi song song theo pool 5 requests để tối ưu tốc độ nhanh nhất
  const POOL_SIZE = 5;
  for (let i = 0; i < rows.length; i += POOL_SIZE) {
    const chunk = rows.slice(i, i + POOL_SIZE);
    const promises = chunk.map(r => {
      return fetch(URL_API_QUETQR, {
        method: "POST",
        body: JSON.stringify({
          action: "luuGiaoDich",
          id: r.id,
          msp: r.msp,
          ten: r.qc || r.msp,
          mau: r.qc || "",
          ngay: r.ngay,
          loai: r.loai,
          kg: r.kg,
          thoiGian: r.thoiGian
        })
      }).then(async res => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch (err) {
          throw new Error("Máy chủ phản hồi chậm hoặc gián đoạn (Timeout)");
        }
      });
    });
    await Promise.all(promises);
  }
}

// ── Quản lý Hàng Đợi Offline ───────────────────────────────────────
function docPendingQuetQR() {
  if (window.ScannerCore && typeof window.ScannerCore.docPending === "function") {
    return window.ScannerCore.docPending(QUETQR_PENDING_KEY);
  }
  try {
    const raw = localStorage.getItem(QUETQR_PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
window.docPendingQuetQR = docPendingQuetQR;

function luuPendingQuetQR(list) {
  if (window.ScannerCore && typeof window.ScannerCore.luuPending === "function") {
    window.ScannerCore.luuPending(QUETQR_PENDING_KEY, list);
    return;
  }
  try {
    localStorage.setItem(QUETQR_PENDING_KEY, JSON.stringify(list));
  } catch (e) {}
}
window.luuPendingQuetQR = luuPendingQuetQR;

// ── Quản lý Phiên Dở Dang ──────────────────────────────────────────
function luuPhienDoDangQR() {
  if (phienQuetQR.some(r => r.daGui !== undefined)) {
    soLuongDaGuiHienTaiQR = phienQuetQR.filter(r => r.daGui).length;
  }
  try {
    localStorage.setItem(QUETQR_DODANG_KEY, JSON.stringify({
      phienQuetQR,
      demSoDotQR,
      ngayQuetQR,
      loaiQuetQR,
      idPhienHienTaiQR,
      soLuongDaGuiHienTaiQR,
      capNhat: new Date().toISOString()
    }));
    if (typeof kichHoatKiemTraAutoBackup === "function") kichHoatKiemTraAutoBackup(4000);
  } catch (e) {}
  luuVaoLichSuQR();
  if (typeof capNhatTrangChu === "function") capNhatTrangChu();
}

function xoaPhienDoDangQR() {
  try {
    localStorage.removeItem(QUETQR_DODANG_KEY);
  } catch (e) {}
  if (typeof capNhatTrangChu === "function") capNhatTrangChu();
}

function tiepTucPhienQuetQR() {
  try {
    const raw = localStorage.getItem(QUETQR_DODANG_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    phienQuetQR = data.phienQuetQR || [];
    demSoDotQR = data.demSoDotQR || 1;
    ngayQuetQR = data.ngayQuetQR || "";
    loaiQuetQR = data.loaiQuetQR || "";
    idPhienHienTaiQR = data.idPhienHienTaiQR || null;
    soLuongDaGuiHienTaiQR = data.soLuongDaGuiHienTaiQR || 0;

    const ngayInput = document.getElementById("chon-ngay");
    if (ngayInput && ngayQuetQR) ngayInput.value = ngayQuetQR;
    if (loaiQuetQR) chonLoaiQR(loaiQuetQR);

    chuyenTrang("quetQR", document.querySelector('.nav-item[data-page="quetQR"]'));
    batDauQuetQR();
  } catch (e) {}
}
window.tiepTucPhienQuetQR = tiepTucPhienQuetQR;

function huyPhienQuetQR() {
  if (typeof moXacNhanApp === "function") {
    moXacNhanApp(
      "Bạn có chắc muốn hủy phiên quét dở dang này không?",
      () => {
        xoaPhienDoDangQR();
        phienQuetQR = [];
        demSoDotQR = 1;
        idPhienHienTaiQR = null;
        soLuongDaGuiHienTaiQR = 0;
        showCanhBaoQR("Đã hủy phiên quét dở dang");
      },
      "Hủy phiên",
      null,
      "Không",
      "Xác nhận hủy"
    );
  }
}
window.huyPhienQuetQR = huyPhienQuetQR;

function docLichSuQR() {
  const homNay = new Date();
  homNay.setHours(0, 0, 0, 0);
  const filterFn = s => {
    if (!s || !s.ngay) return false;
    // BẢO VỆ PHIÊN CHƯA GỬI XONG: Không xóa phiên còn dữ liệu chưa đồng bộ
    const chuaGuiHet = s.phienQuetQR && s.phienQuetQR.some(r => !r.daDongBo && !r.daGui);
    if (chuaGuiHet) return true;
    const ngayPhien = new Date(s.ngay + "T00:00:00");
    const soNgayCach = Math.floor((homNay - ngayPhien) / 86400000);
    return soNgayCach >= 0 && soNgayCach < QUETQR_LICHSU_SO_NGAY_GIU;
  };
  if (window.ScannerCore && typeof window.ScannerCore.docLichSu === "function") {
    return window.ScannerCore.docLichSu(QUETQR_LICHSU_KEY, filterFn);
  }
  let list = [];
  try { list = JSON.parse(localStorage.getItem(QUETQR_LICHSU_KEY)) || []; } catch (e) { list = []; }
  return list.filter(filterFn);
}

function luuLichSuQR(list) {
  if (window.ScannerCore && typeof window.ScannerCore.luuLichSu === "function") {
    window.ScannerCore.luuLichSu(QUETQR_LICHSU_KEY, list, () => {
      if (typeof showCanhBaoQR === "function") {
        showCanhBaoQR("Bộ nhớ trình duyệt bị đầy! Hãy xóa bớt lịch sử cũ.", "error");
      }
    });
    return;
  }
  try { 
    localStorage.setItem(QUETQR_LICHSU_KEY, JSON.stringify(list)); 
  } catch (e) {}
}

function luuVaoLichSuQR() {
  if (!idPhienHienTaiQR) return;
  try {
    const list = docLichSuQR();
    if (phienQuetQR.length === 0) {
      const filtered = list.filter(e => e.idPhien !== idPhienHienTaiQR);
      luuLichSuQR(filtered);
      return;
    }
    const entryIndex = list.findIndex(e => e.idPhien === idPhienHienTaiQR);

    const newEntry = {
      idPhien: idPhienHienTaiQR,
      ngay: ngayQuetQR,
      loai: loaiQuetQR,
      thoiGian: new Date().toISOString(),
      tongBao: phienQuetQR.length,
      tongKG: phienQuetQR.reduce((s, r) => s + (r.kg || 0), 0),
      phienQuetQR: [...phienQuetQR]
    };

    if (entryIndex >= 0) {
      list[entryIndex] = newEntry;
    } else {
      list.unshift(newEntry);
    }

    luuLichSuQR(list);
  } catch (e) {}
}

function renderLichSuQR() {
  const container = document.getElementById("lichsu-qr-list");
  if (!container) return;

  const list = docLichSuQR();

  const filterText = (document.getElementById("lichsu-qr-tim") ? document.getElementById("lichsu-qr-tim").value : "").toLowerCase().trim();

  const filtered = list.filter(item => {
    if (!filterText) return true;
    return (item.ngay && item.ngay.toLowerCase().includes(filterText)) ||
           (item.loai && item.loai.toLowerCase().includes(filterText)) ||
           (item.phienQuetQR && item.phienQuetQR.some(r => (r.id && r.id.toLowerCase().includes(filterText)) || (r.qc && r.qc.toLowerCase().includes(filterText))));
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="color:var(--cream-soft); text-align:center; padding:30px 0;">'
      + (filterText ? "Không tìm thấy phiên nào khớp" : "Chưa có phiên nào trong " + QUETQR_LICHSU_SO_NGAY_GIU + " ngày qua")
      + '</div>';
    return;
  }

  container.innerHTML = filtered.map((entry) => {
    const timeObj = entry.thoiGian ? new Date(entry.thoiGian) : new Date();
    const gio = timeObj.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const ngayStr = entry.ngay || ((typeof layNgayHomNayLocal === "function") ? layNgayHomNayLocal() : (timeObj.getFullYear() + '-' + String(timeObj.getMonth()+1).padStart(2,'0') + '-' + String(timeObj.getDate()).padStart(2,'0')));
    const parts = ngayStr.split("-");
    const ngayNgan = parts.length === 3 ? parts[2] + "-" + parts[1] : ngayStr;
    const tongKg = (entry.tongKG || 0);
    const tongBao = (entry.tongBao || (entry.phienQuetQR ? entry.phienQuetQR.length : 0));
    const trangThai = '<i class="ti ti-check cx5-trangthai-ok"></i>';

    return '<div class="irow lichsu-row" style="cursor:pointer;align-items:center" onclick="xemChiTietLichSuQR(\'' + entry.idPhien + '\')">'
      + '<span style="font-family:\'IBM Plex Sans\',sans-serif;color:var(--cream); flex: 1;">'
      + ngayNgan + '&nbsp;&nbsp;&nbsp;' + gio + '&nbsp;&nbsp;&nbsp;' + tongBao + 'b&nbsp;&nbsp;&nbsp;' + Math.round(tongKg) + 'kg'
      + '</span>'
      + '<span style="display:inline-flex;align-items:center;gap:8px;padding-left:8px;border-left:1px solid var(--line)">'
      + trangThai
      + '<button class="lichsu-del-btn" aria-label="Xóa phiên này" title="Xóa phiên này" onclick="xoaMotPhienLichSuQR(\'' + entry.idPhien + '\', event)"><i class="ti ti-trash"></i></button>'
      + '</span>'
      + '</div>';
  }).join("");
}
window.renderLichSuQR = renderLichSuQR;

function xemChiTietLichSuQR(idPhien) {
  const list = docLichSuQR();
  const entry = list.find(e => e.idPhien === idPhien);
  if (!entry) return;

  phienQuetQR = entry.phienQuetQR || [];
  ngayQuetQR = entry.ngay;
  loaiQuetQR = entry.loai;
  soLuongDaGuiHienTaiQR = phienQuetQR.length;
  idPhienHienTaiQR = idPhien;
  const maxDot = Math.max(0, ...phienQuetQR.map(r => r.dotQuet || 1));
  demSoDotQR = maxDot > 0 ? maxDot : 1;

  const ngayInput = document.getElementById("chon-ngay");
  if (ngayInput && ngayQuetQR) ngayInput.value = ngayQuetQR;
  if (loaiQuetQR && typeof chonLoaiQR === "function") chonLoaiQR(loaiQuetQR);

  luuPhienDoDangQR();

  chuyenTrangKhongNav("quetQR");
  xemKetQuaQuetQR();
}
window.xemChiTietLichSuQR = xemChiTietLichSuQR;

function xoaMotPhienLichSuQR(idPhien, ev) {
  if (ev) ev.stopPropagation();
  if (typeof moXacNhanApp === "function") {
    moXacNhanApp(
      "Xóa phiên lịch sử Quét QR này? Không thể hoàn tác.",
      () => {
        const list = docLichSuQR();
        const filtered = list.filter(e => e.idPhien !== idPhien);
        luuLichSuQR(filtered);
        renderLichSuQR();
      },
      "Xóa",
      null,
      "Hủy",
      "Xóa phiên lịch sử"
    );
  }
}
window.xoaMotPhienLichSuQR = xoaMotPhienLichSuQR;

function xoaTatCaLichSuQR() {
  const list = docLichSuQR();
  if (list.length === 0) {
    showCanhBaoQR("Không có lịch sử để xóa");
    return;
  }
  if (typeof moXacNhanApp === "function") {
    moXacNhanApp(
      "Xóa toàn bộ " + list.length + " phiên lịch sử Quét QR? Không thể hoàn tác.",
      () => {
        if (window.ScannerCore && typeof window.ScannerCore.xoaLichSu === "function") {
          window.ScannerCore.xoaLichSu(QUETQR_LICHSU_KEY);
        } else {
          localStorage.removeItem(QUETQR_LICHSU_KEY);
        }
        renderLichSuQR();
      },
      "Xóa tất cả",
      null,
      "Hủy",
      "Xóa tất cả lịch sử"
    );
  }
}
window.xoaTatCaLichSuQR = xoaTatCaLichSuQR;

// ── Xuất File Excel ────────────────────────────────────────────────
function xuatExcelQuetQR() {
  if (phienQuetQR.length === 0) {
    showCanhBaoQR("Chưa có dữ liệu để xuất Excel!", "warning");
    return;
  }
  const dataExport = phienQuetQR.map((r, idx) => ({
    "STT": idx + 1,
    "Đợt": r.dotQuet,
    "Mã ID": r.id,
    "Mã SP": r.msp,
    "Quy Cách (QC)": r.qc,
    "Số KG": r.kg || 0,
    "Loại": loaiQuetQR,
    "Ngày": ngayQuetQR,
    "Thời Gian": r.thoiGian ? new Date(r.thoiGian).toLocaleString("vi-VN") : ""
  }));
  if (typeof exportToExcel === "function") {
    exportToExcel("QuetQR_" + (loaiQuetQR || "Kho") + "_" + (ngayQuetQR || ""), "Chi Tiết", dataExport);
  }
}
window.xuatExcelQuetQR = xuatExcelQuetQR;

function xuatExcelLichSuQR(idPhien) {
  const list = docLichSuQR();
  if (list.length === 0) {
    showCanhBaoQR("Chưa có dữ liệu lịch sử để xuất Excel!", "warning");
    return;
  }

  let dataExport = [];
  let fileTitle = "LichSu_QuetQR";

  if (idPhien) {
    const entry = list.find(e => e.idPhien === idPhien);
    if (!entry || !entry.phienQuetQR || entry.phienQuetQR.length === 0) {
      showCanhBaoQR("Chưa có dữ liệu phiên này để xuất Excel!", "warning");
      return;
    }
    fileTitle = "LichSu_QuetQR_" + (entry.ngay || "");
    dataExport = entry.phienQuetQR.map((r, idx) => ({
      "STT": idx + 1,
      "Đợt": r.dotQuet,
      "Mã ID": r.id,
      "Mã SP": r.msp,
      "Quy Cách (QC)": r.qc,
      "Số KG": r.kg || 0,
      "Loại": entry.loai || "",
      "Ngày": entry.ngay || "",
      "Thời Gian": r.thoiGian ? new Date(r.thoiGian).toLocaleString("vi-VN") : ""
    }));
  } else {
    // Xuất toàn bộ tất cả phiên lịch sử
    let stt = 1;
    list.forEach(entry => {
      (entry.phienQuetQR || []).forEach(r => {
        dataExport.push({
          "STT": stt++,
          "Đợt": r.dotQuet,
          "Mã ID": r.id,
          "Mã SP": r.msp,
          "Quy Cách (QC)": r.qc,
          "Số KG": r.kg || 0,
          "Loại": entry.loai || "",
          "Ngày": entry.ngay || "",
          "Thời Gian": r.thoiGian ? new Date(r.thoiGian).toLocaleString("vi-VN") : ""
        });
      });
    });
    fileTitle = "LichSu_QuetQR_ToanBo_" + ((typeof layNgayHomNayLocal === "function") ? layNgayHomNayLocal() : (new Date().getFullYear() + '-' + String(new Date().getMonth()+1).padStart(2,'0') + '-' + String(new Date().getDate()).padStart(2,'0')));
  }

  if (typeof exportToExcel === "function") {
    exportToExcel(fileTitle, "Quet QR", dataExport);
  }
}
window.xuatExcelLichSuQR = xuatExcelLichSuQR;

function xuatExcelPhienLichSuQR(idPhien) {
  const list = docLichSuQR();
  const entry = list.find(e => e.idPhien === idPhien);
  if (!entry || !entry.phienQuetQR) return;

  const dataExport = entry.phienQuetQR.map((r, idx) => ({
    "STT": idx + 1,
    "Đợt": r.dotQuet,
    "Mã ID": r.id,
    "Mã SP": r.msp,
    "Quy Cách (QC)": r.qc,
    "Số KG": r.kg || 0,
    "Loại": entry.loai,
    "Ngày": entry.ngay,
    "Thời Gian": r.thoiGian ? new Date(r.thoiGian).toLocaleString("vi-VN") : ""
  }));
  if (typeof exportToExcel === "function") {
    exportToExcel("QuetQR_" + (entry.loai || "Kho") + "_" + (entry.ngay || ""), "Chi Tiết", dataExport);
  }
}
window.xuatExcelPhienLichSuQR = xuatExcelPhienLichSuQR;

// ── Hiển thị Cảnh Báo Popup (Đỏ / Xanh) trong 2s ───────────────────
let timerCanhBaoQR = null;
function showCanhBaoQR(text, type = "error") {
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

  if (timerCanhBaoQR) clearTimeout(timerCanhBaoQR);
  timerCanhBaoQR = setTimeout(() => {
    el.style.display = "none";
  }, 2000);
}

// ── Khởi chạy khi tải trang ────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  const today = (typeof layNgayHomNayLocal === "function") ? layNgayHomNayLocal() : (new Date().getFullYear() + '-' + String(new Date().getMonth()+1).padStart(2,'0') + '-' + String(new Date().getDate()).padStart(2,'0'));
  const ngayInput = document.getElementById("chon-ngay");
  if (ngayInput && !ngayInput.value) ngayInput.value = today;

  // Lắng nghe chọn loại dropdown
  document.querySelectorAll("#chon-loai-list .custom-option").forEach(opt => {
    opt.addEventListener("click", (e) => {
      const val = opt.getAttribute("data-value");
      chonLoaiQR(val, e);
    });
  });
});
