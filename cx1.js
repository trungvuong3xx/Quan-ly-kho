// ── Chỉ FOR ─────────────────────────────────────────────
let zxingReaderCX1 = null;
let dangQuetCX1 = false;
let phienCX1 = [];
let demSoDot = 0;
let denPinBat = false;
let ngayCX1 = null;

// Quản lý chế độ Nhập thủ công & Danh mục QC
let cheDoCX1 = "quet"; // "quet" | "nhap"
let dangNhapCX1 = false;
let mspDataCX1 = [];
let filteredCX1 = [];
let activeIndexCX1 = -1;
let dangHienGoiYCX1 = false;
let qcKhoaCX1 = null;
let mspKhoaCX1 = null;

// Theo dõi phiên hiện tại để nối vào Lịch sử + tránh gửi trùng khi "tiếp tục" 1 phiên cũ
let idPhienHienTai = null;
let soLuongDaGuiHienTai = 0;

const CX1_LICHSU_KEY = "cx1_lich_su";
const CX1_LICHSU_SO_NGAY_GIU = 30;

// Bộ máy âm thanh phát tiếng bíp quét QR dùng trung tâm từ app.js
if (typeof phatTiengBip !== "function") {
  var phatTiengBip = function () {
    if (typeof window.phatTiengBip === "function") window.phatTiengBip();
  };
}

async function toggleFlashCX1() {
  if (!zxingReaderCX1 || !dangQuetCX1) return;
  if (typeof batTatDenPinCamera === "function") {
    denPinBat = await batTatDenPinCamera("cx1-reader", "btn-flash-cx1", denPinBat);
  }
}

function hienVienFeedbackCX1(loai) {
  if (typeof hienVienFeedbackCamera === "function") hienVienFeedbackCamera("#cx1-cam .video-container", loai);
}

function xuLyDuLieuQR(text) {
  if (typeof window.parseQRText === "function") {
    return window.parseQRText(text);
  }
  if (!text) return null;
  if (text.includes("{|T")) {
    const tags = {};
    const parts = text.split("{|");
    for (const part of parts) {
      if (!part) continue;
      const match = part.match(/^([A-Z]\d)(.*)$/);
      if (match) tags[match[1]] = match[2].trim();
    }
    const id = tags["T9"] || tags["T2"] || tags["T3"] || "";
    const msp = tags["T3"] || "";
    const qc = tags["T6"] || "";
    const kg = parseFloat(tags["T4"] || "0") || 0;
    if (id && msp) return { id, msp, qc, kg };
  }
  const lines = text.split("\n").map(l => l.trim()).filter(l => l !== "");
  if (lines.length >= 2) {
    const id = lines[0] || "";
    const msp = lines[1] || "";
    let kg = 0, qc = "";

    const dongQCKG = lines.slice(2).find(l => {
      return /[\d.]+\s*$/.test(l) && (l.includes('/') || l.includes('Kg') || l.includes('kg') || l.includes('-'));
    }) || lines.find(l => l.includes("-") && /\d+/.test(l)) || "";

    if (dongQCKG) {
      const matchKG = dongQCKG.match(/([\d.]+)\s*$/);
      kg = matchKG ? parseFloat(matchKG[1]) : 0;
      const matchSlash = dongQCKG.match(/\b([A-Za-z0-9]+[/][A-Za-z0-9]+)\b/);
      if (matchSlash) {
        qc = matchSlash[1].trim();
      } else if (matchKG && dongQCKG.includes("-")) {
        qc = dongQCKG.substring(0, dongQCKG.lastIndexOf(matchKG[0])).trim();
        if (qc.endsWith("-")) qc = qc.slice(0, -1).trim();
      } else {
        const matchFirst = dongQCKG.match(/^([^\s(]+)/);
        if (matchFirst) qc = matchFirst[1].replace(/[-]+$/, '').trim();
      }
    }
    if (id && msp) return { id, msp, qc, kg };
  }
  return null;
}

let lanCanhBaoCuoi = 0;
let mapKhoaCX1 = new Map();

function capNhatTrangThaiTrungCX1() {
  const elCheck = document.getElementById("cx1-cho-phep-trung-cam");
  const elStatus = document.getElementById("cx1-lock-status");
  if (!elStatus) return;
  if (elCheck && elCheck.checked) {
    elStatus.textContent = "Cho phép";
    elStatus.style.color = "var(--success)";
  } else {
    elStatus.textContent = "Chờ quét...";
    elStatus.style.color = "var(--cream-soft)";
  }
}
window.capNhatTrangThaiTrungCX1 = capNhatTrangThaiTrungCX1;

function khiQuetDuocMa(result) {
  if (!result || !dangQuetCX1) return;
  const rawText = typeof result.getText === "function" ? result.getText() : String(result);
  const data = xuLyDuLieuQR(rawText);
  if (!data) return;

  const keyQR = (data.id || "").toLowerCase();
  const elCheck = document.getElementById("cx1-cho-phep-trung-cam");
  const choPhepTrung = elCheck ? elCheck.checked : false;
  const lockMs = choPhepTrung ? 1500 : 500;
  const now = Date.now();

  // Khóa Per-QR chống quét dính liên tục cùng 1 mã
  if (mapKhoaCX1.has(keyQR) && (now - mapKhoaCX1.get(keyQR)) < lockMs) {
    return;
  }
  mapKhoaCX1.set(keyQR, now);

  const trung = phienCX1.find(r => r.id === data.id);
  if (!choPhepTrung && trung) {
    mapKhoaCX1.set(keyQR, Date.now() + 1500); // Khóa 1.5s để không nháy cảnh báo liên tục
    if (typeof phatVibrateError === "function") phatVibrateError();
    else if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    // Hiện popup thông báo màu đỏ nổi bật khi quét trùng: Đã quét + thời gian trong 2s
    const gioQuet = typeof dinhDangGioQuetTrung === "function" ? dinhDangGioQuetTrung(trung.thoiGian) : "";
    showCanhBaoCX1("Đã quét " + gioQuet, "error");

    hienVienFeedbackCX1("duplicate");
    return;
  }

  // Quét thành công: KHÔNG HIỆN POPUP, chỉ phát âm thanh/rung và hiển thị dưới nhật ký (log)
  phatTiengBip();
  if (typeof phatVibrateSuccess === "function") phatVibrateSuccess();
  hienVienFeedbackCX1("success");

  const lockStatusEl = document.getElementById("cx1-lock-status");
  if (lockStatusEl) lockStatusEl.innerHTML = '<i class="ti ti-check-double" style="color:var(--success)"></i> ' + data.id;

  phienCX1.push({
    id: data.id, msp: data.msp, qc: data.qc,
    kg: data.kg, thoiGian: new Date(), dotQuet: demSoDot
  });
  document.getElementById("cx1-dem").textContent = "Đã quét: " + phienCX1.length + " mã";
  luuPhienDoDangCX1();
  capNhatLogCX1();
}

function luuPhienDoDangCX1() {
  try {
    localStorage.setItem("cx1_phien_dodang", JSON.stringify({
      phienCX1, demSoDot, ngayCX1, capNhat: new Date().toISOString(),
      idPhienHienTai, soLuongDaGuiHienTai, cheDoCX1
    }));
    if (typeof kichHoatKiemTraAutoBackup === "function") kichHoatKiemTraAutoBackup(4000);
  } catch (e) { }
  luuVaoLichSuCX1();
  if (typeof capNhatTrangChu === "function") capNhatTrangChu();
}

function xoaPhienDoDangCX1() {
  try { localStorage.removeItem("cx1_phien_dodang"); } catch (e) { }
}

async function batDauCX1(cheDo = "quet") {
  const inputEl = document.getElementById("cx1-ngay");
  if (inputEl && !inputEl.value) {
    inputEl.value = (typeof layNgayHomNayLocal === "function") ? layNgayHomNayLocal() : new Date().toISOString().split("T")[0];
  }
  ngayCX1 = inputEl ? inputEl.value : ((typeof layNgayHomNayLocal === "function") ? layNgayHomNayLocal() : new Date().toISOString().split("T")[0]);

  let phienCu = null;
  try { phienCu = JSON.parse(localStorage.getItem("cx1_phien_dodang")); } catch (e) { }
  if (phienCu && Array.isArray(phienCu.phienCX1) && phienCu.phienCX1.length > 0) {
    if (typeof moXacNhanApp === "function") {
      moXacNhanApp(
        "Bạn đang có phiên Chỉ X1 dở dang (" + phienCu.phienCX1.length + " mã, ngày " + phienCu.ngayCX1 + ").<br>Bạn muốn tiếp tục phiên đó hay bắt đầu phiên mới?",
        () => { 
          khoiPhucCX1(phienCu); 
          if (cheDo === "nhap") chuyenSangNhapTayCX1();
        },
        "Tiếp tục",
        () => { xoaPhienDoDangCX1(); tiepTucKhoiTaoCX1(cheDo); },
        "Bắt đầu mới",
        "Phiên dở dang"
      );
      return;
    }
  }

  tiepTucKhoiTaoCX1(cheDo);
}

async function tiepTucKhoiTaoCX1(cheDo = "quet") {
  phienCX1 = [];
  demSoDot = 1;
  idPhienHienTai = Date.now() + "-" + Math.random().toString(36).slice(2);
  soLuongDaGuiHienTai = 0;
  qcKhoaCX1 = null;
  mspKhoaCX1 = null;
  moKhoaQCCX1();

  if (cheDo === "nhap") {
    chuyenSangNhapTayCX1();
    return;
  }

  cheDoCX1 = "quet";
  dangQuetCX1 = true;
  dangNhapCX1 = false;
  denPinBat = false;

  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(true); else document.body.classList.add("cam-active");
  document.getElementById("cx1-form").style.display = "none";
  if (document.getElementById("cx1-nhap")) document.getElementById("cx1-nhap").style.display = "none";
  document.getElementById("cx1-cam").style.display = "block";
  document.getElementById("cx1-ketqua").style.display = "none";
  document.getElementById("cx1-dem").textContent = "Đã quét: 0 mã";
  document.getElementById("cx1-status").textContent = "Đang quét Đợt 1...";
  document.getElementById("btn-flash-cx1").style.background = "var(--neutral)";
  document.getElementById("btn-flash-cx1").style.color = "var(--cream)";
  document.getElementById("btn-flash-cx1").textContent = "Bật đèn pin";
  capNhatLogCX1();

  const btnToggle = document.getElementById("btn-dung-tieptuc-cx1");
  btnToggle.textContent = "Dừng quét";
  btnToggle.className = "btn btn-red btn-full";

  try {
    const cx1Vid = document.getElementById("cx1-reader");
    const cx1Track = cx1Vid && cx1Vid.srcObject ? cx1Vid.srcObject.getVideoTracks()[0] : null;
    const isCamRunningCX1 = cx1Track && cx1Track.readyState === 'live';
    if (!zxingReaderCX1 || !isCamRunningCX1) {
      if (zxingReaderCX1) {
        if (typeof dungCameraFast === "function") dungCameraFast("cx1-reader", zxingReaderCX1);
        zxingReaderCX1 = null;
      }
      zxingReaderCX1 = await khoiTaoCameraFast("cx1-reader", (txt) => {
        if (txt && dangQuetCX1) {
          khiQuetDuocMa({ getText: () => txt });
        }
      });
    } else if (cx1Vid && cx1Vid.paused) {
      cx1Vid.play().catch(() => { });
    }
  } catch (e) {
    showCanhBaoCX1("Lỗi camera: " + e);
    dungCX1();
  }
}

function dungCX1() {
  dangQuetCX1 = false;
  // Giữ nguyên phần cứng camera chạy ngầm để bật lại tức thì
  // dungCameraFast("cx1-reader", zxingReaderCX1);
  // zxingReaderCX1 = null;
  document.getElementById("cx1-status").textContent = "Đã dừng Đợt " + demSoDot;
}

async function tiepTucCX1() {
  const maxDot = phienCX1.length > 0 ? Math.max(0, ...phienCX1.map(r => r.dotQuet || 1)) : 0;
  demSoDot = maxDot > 0 ? maxDot + 1 : 1;
  dangQuetCX1 = true;
  denPinBat = false;
  document.getElementById("cx1-status").textContent = "Đang quét Đợt " + demSoDot + "...";
  document.getElementById("btn-flash-cx1").style.background = "var(--neutral)";
  document.getElementById("btn-flash-cx1").style.color = "var(--cream)";
  document.getElementById("btn-flash-cx1").textContent = "Bật đèn pin";
  try {
    const cx1Vid = document.getElementById("cx1-reader");
    const cx1Track = cx1Vid && cx1Vid.srcObject ? cx1Vid.srcObject.getVideoTracks()[0] : null;
    const isCamRunningCX1 = cx1Track && cx1Track.readyState === 'live';
    if (!zxingReaderCX1 || !isCamRunningCX1) {
      if (zxingReaderCX1) {
        if (typeof dungCameraFast === "function") dungCameraFast("cx1-reader", zxingReaderCX1);
        zxingReaderCX1 = null;
      }
      zxingReaderCX1 = await khoiTaoCameraFast("cx1-reader", (txt) => {
        if (txt && dangQuetCX1) {
          khiQuetDuocMa({ getText: () => txt });
        }
      });
    } else if (cx1Vid && cx1Vid.paused) {
      cx1Vid.play().catch(() => { });
    }
  } catch (e) {
    showCanhBaoCX1("Lỗi camera: " + e);
    dungCX1();
  }
}

function toggleDungTiepTuc() {
  const btn = document.getElementById("btn-dung-tieptuc-cx1");
  if (dangQuetCX1) {
    dungCX1();
    btn.textContent = "Quét tiếp (Đợt mới)";
    btn.className = "btn btn-blue btn-full";
  } else {
    tiepTucCX1();
    btn.textContent = "Dừng quét";
    btn.className = "btn btn-red btn-full";
  }
}

function docPendingCX1() {
  try {
    const raw = localStorage.getItem("cx1_pending_saves");
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function luuPendingCX1(list) {
  try { localStorage.setItem("cx1_pending_saves", JSON.stringify(list)); } catch (e) { }
}

async function guiLenSheetCX1(rows) {
  const URL_API = "https://script.google.com/macros/s/AKfycbzk7afcuHDOTnL6QSIQ0ZgT-CSiIDNZ8h5S8_IkGXahc7PQRvqZKpLpjkBphioXAyzDKQ/exec";
  const res = await fetch(URL_API, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "luuCX1", data: rows })
  });
  if (!res.ok) throw new Error("Lỗi kết nối server HTTP " + res.status);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error("Máy chủ phản hồi chậm hoặc gián đoạn (Timeout)");
  }
  if (json && json.error) throw new Error(json.error);
}

function ketThucCX1() {
  if (typeof dongBanPhimCX5 === "function") dongBanPhimCX5();
  dungCX1();
  dangNhapCX1 = false;
  if (document.getElementById("cx1-cam")) document.getElementById("cx1-cam").style.display = "none";
  if (document.getElementById("cx1-nhap")) document.getElementById("cx1-nhap").style.display = "none";

  // Lưu lịch sử và lưu dở dang để người dùng xem và kiểm tra
  luuVaoLichSuCX1();
  luuPhienDoDangCX1();

  // Hiện màn hình kết quả để user kiểm tra, sửa, xóa
  hienKetQuaCX1();

  const btnGui = document.getElementById("btn-gui-dulieu-cx1");
  if (btnGui) {
    btnGui.disabled = false;
    btnGui.innerHTML = '<i class="ti ti-cloud-upload"></i> Gửi dữ liệu lên Sheet';
    btnGui.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
    btnGui.style.color = "#1a1a2e";
  }
}

// ── Nhập thủ công Chỉ For (CX1) ── Bê nguyên bản cơ chế CX5 ──

function napDuLieuQCCX1Local() {
  const CACHE_KEY = "cx1_danh_sach_qc";
  const mapQC = {};

  // 1. Nạp từ cache Sheet đã lưu
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (Array.isArray(cached)) {
      cached.forEach(i => {
        if (i && i.ten) {
          const ten = i.ten.trim();
          mapQC[ten] = { msp: i.msp || ten, count: Number(i.count) || 1 };
        }
      });
    }
  } catch (e) { }

  // 2. Nạp từ phiên hiện tại (ưu tiên cao nhất)
  if (Array.isArray(phienCX1)) {
    phienCX1.forEach(i => {
      const ten = (i.qc || "").trim();
      if (ten) {
        if (!mapQC[ten]) mapQC[ten] = { msp: i.msp || ten, count: 0 };
        mapQC[ten].count += 10;
      }
    });
  }

  // 3. Nạp từ phiên dở dang lưu trong localStorage
  try {
    const doDang = JSON.parse(localStorage.getItem("cx1_phien_dodang"));
    if (doDang && Array.isArray(doDang.phienCX1)) {
      doDang.phienCX1.forEach(i => {
        const ten = (i.qc || "").trim();
        if (ten) {
          if (!mapQC[ten]) mapQC[ten] = { msp: i.msp || ten, count: 0 };
          mapQC[ten].count += 5;
        }
      });
    }
  } catch (e) { }

  // 4. Nạp từ lịch sử quét 30 ngày gần nhất
  try {
    const historyList = (typeof docLichSuCX1 === "function") ? docLichSuCX1() : [];
    historyList.forEach(h => {
      (h.phienCX1 || []).forEach(item => {
        const ten = (item.qc || "").trim();
        if (ten) {
          if (!mapQC[ten]) mapQC[ten] = { msp: item.msp || ten, count: 0 };
          mapQC[ten].count += 1;
        }
      });
    });
  } catch (e) { }

  // 5. Nạp từ mspDataCX5 nếu có
  if (typeof mspDataCX5 !== "undefined" && Array.isArray(mspDataCX5)) {
    mspDataCX5.forEach(i => {
      const ten = (i.ten || "").trim();
      if (ten && !mapQC[ten]) {
        mapQC[ten] = { msp: i.msp || ten, count: 1 };
      }
    });
  }

  const list = Object.keys(mapQC).map(k => ({ ten: k, msp: mapQC[k].msp, count: mapQC[k].count }));
  if (list.length > 0) {
    mspDataCX1 = list;
  }
}

async function taiDanhSachQCCX1(forceRefresh = false) {
  const CACHE_KEY = "cx1_danh_sach_qc";
  const refreshIcon = document.querySelector("#cx1-qc-tim-wrap .ti-refresh");

  // Luôn nạp dữ liệu cục bộ trước (0ms)
  napDuLieuQCCX1Local();

  if (!forceRefresh && mspDataCX1 && mspDataCX1.length > 0) {
    return;
  }

  if (refreshIcon) refreshIcon.classList.add("spin");
  if (forceRefresh && typeof showCanhBaoCX1 === "function") {
    showCanhBaoCX1("Đang tải danh mục QC từ Google Sheet...", "warning");
  }

  try {
    const URL_API = "https://script.google.com/macros/s/AKfycbzk7afcuHDOTnL6QSIQ0ZgT-CSiIDNZ8h5S8_IkGXahc7PQRvqZKpLpjkBphioXAyzDKQ/exec";
    const res = await fetch(URL_API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "layDanhSachQC" })
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (e) { }

    if (json && json.list && Array.isArray(json.list) && json.list.length > 0) {
      mspDataCX1 = json.list;
      localStorage.setItem(CACHE_KEY, JSON.stringify(mspDataCX1));
      if (typeof showCanhBaoCX1 === "function") {
        showCanhBaoCX1("✅ Đã nạp " + mspDataCX1.length + " quy cách từ Sheet LIST!", "success");
      }
      const input = document.getElementById("cx1-ten");
      if (input && input.value.trim()) onInputCX1();
      else hienGoiYQCCX1();
    } else if (json && json.error) {
      if (typeof showCanhBaoCX1 === "function") {
        showCanhBaoCX1("Apps Script chưa cập nhật action layDanhSachQC. Đang dùng tạm " + (mspDataCX1 ? mspDataCX1.length : 0) + " quy cách từ lịch sử!", "warning");
      }
    } else {
      if (forceRefresh && typeof showCanhBaoCX1 === "function") {
        showCanhBaoCX1("Không tìm thấy danh mục trong Sheet LIST", "warning");
      }
    }
  } catch (e) {
    if (forceRefresh && typeof showCanhBaoCX1 === "function") {
      showCanhBaoCX1("Mất kết nối server, đang dùng danh mục offline (" + (mspDataCX1 ? mspDataCX1.length : 0) + " QC)", "warning");
    }
  } finally {
    if (refreshIcon) refreshIcon.classList.remove("spin");
  }
}
window.taiDanhSachQCCX1 = taiDanhSachQCCX1;

// ── Khoá/mở ô Quy cách CX1 ──
function khoaQCCX1(msp, ten) {
  qcKhoaCX1 = ten;
  mspKhoaCX1 = msp;
  document.getElementById("cx1-qc-tim-wrap").style.display = "none";
  const khoa = document.getElementById("cx1-qc-khoa");
  khoa.style.display = "flex";
  document.getElementById("cx1-qc-khoa-ten").textContent = ten;
}
window.khoaQCCX1 = khoaQCCX1;

function moKhoaQCCX1() {
  qcKhoaCX1 = null;
  mspKhoaCX1 = null;
  document.getElementById("cx1-qc-khoa").style.display = "none";
  document.getElementById("cx1-qc-tim-wrap").style.display = "block";
  const ten = document.getElementById("cx1-ten");
  if (ten) ten.value = "";
  const mspInput = document.getElementById("cx1-msp");
  if (mspInput) mspInput.value = "";
  closeDropdownCX1();
  setTimeout(function () {
    if (ten) {
      ten.focus();
      if (typeof moBanPhimCX5 === "function") moBanPhimCX5(ten, "qc");
      hienGoiYQCCX1();
    }
  }, 0);
}
window.moKhoaQCCX1 = moKhoaQCCX1;

function resetKhoaQCCX1() {
  qcKhoaCX1 = null;
  mspKhoaCX1 = null;
  const khoa = document.getElementById("cx1-qc-khoa");
  if (khoa) khoa.style.display = "none";
  const timWrap = document.getElementById("cx1-qc-tim-wrap");
  if (timWrap) timWrap.style.display = "block";
  const ten = document.getElementById("cx1-ten");
  if (ten) ten.value = "";
  const msp = document.getElementById("cx1-msp");
  if (msp) msp.value = "";
}
window.resetKhoaQCCX1 = resetKhoaQCCX1;

function sapXepQCCX1(a, b) {
  return (Number(b.count) || 0) - (Number(a.count) || 0) || String(a.ten).localeCompare(String(b.ten), "vi");
}

function onInputCX1() {
  const mspInput = document.getElementById("cx1-msp");
  if (mspInput) mspInput.value = "";
  const input = document.getElementById("cx1-ten");
  const query = input ? input.value.trim() : "";
  if (!query) { hienGoiYQCCX1(); return; }
  dangHienGoiYCX1 = false;

  if (!mspDataCX1 || !mspDataCX1.length) {
    napDuLieuQCCX1Local();
  }

  if (typeof tkLocDanhSach === "function") {
    filteredCX1 = tkLocDanhSach(mspDataCX1, query, 50);
  } else {
    const q = (typeof boDauCX5 === "function" ? boDauCX5(query) : query).toUpperCase();
    filteredCX1 = (mspDataCX1 || [])
      .filter(item => {
        const t = (typeof boDauCX5 === "function" ? boDauCX5(item.ten) : item.ten).toUpperCase();
        const m = item.msp ? (typeof boDauCX5 === "function" ? boDauCX5(item.msp) : item.msp).toUpperCase() : "";
        return t.includes(q) || m.includes(q);
      })
      .sort(sapXepQCCX1)
      .slice(0, 50);
  }
  activeIndexCX1 = -1;
  renderDropdownCX1();
}
window.onInputCX1 = onInputCX1;

function hienGoiYQCCX1() {
  napDuLieuQCCX1Local();
  if (!mspDataCX1 || !mspDataCX1.length) {
    taiDanhSachQCCX1();
    return;
  }
  dangHienGoiYCX1 = true;
  filteredCX1 = mspDataCX1.slice().sort(sapXepQCCX1).slice(0, 8);
  activeIndexCX1 = -1;
  renderDropdownCX1();
}
window.hienGoiYQCCX1 = hienGoiYQCCX1;

function renderDropdownCX1() {
  const el = document.getElementById("cx1-dropdown");
  const kgKhu = document.getElementById("cx1-kg-khu");
  if (!el) return;
  if (!filteredCX1 || filteredCX1.length === 0) {
    el.classList.remove("open");
    el.style.display = "none";
    el.innerHTML = "";
    if (kgKhu) kgKhu.style.display = "";
    return;
  }
  if (kgKhu) kgKhu.style.display = "none";
  const tieuDe = dangHienGoiYCX1
    ? '<div class="cx5-dropdown-title" style="padding:6px 10px; font-size:11px; font-weight:700; color:var(--cream-soft); border-bottom:1px solid var(--line-soft); text-transform:uppercase;">Gợi ý quy cách thường dùng</div>'
    : "";
  el.innerHTML = tieuDe + filteredCX1.map((item, idx) => {
    const tenEsc = (typeof escHtmlCX5 === "function") ? escHtmlCX5(item.ten) : item.ten;
    return '<div class="cx5-dropdown-item' + (idx === activeIndexCX1 ? " active" : "") + '" data-idx="' + idx + '" style="padding:10px 12px; cursor:pointer; border-bottom:1px solid var(--line-soft); font-size:14px; font-weight:600; color:var(--cream);">' + tenEsc + '</div>';
  }).join("");
  el.style.display = "block";
  el.classList.add("open");

  Array.from(el.querySelectorAll(".cx5-dropdown-item")).forEach(child => {
    const handleChon = e => {
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(child.getAttribute("data-idx"), 10);
      if (!isNaN(idx) && filteredCX1[idx]) {
        chonQCX1(filteredCX1[idx]);
      }
    };
    child.addEventListener("pointerdown", handleChon);
    child.addEventListener("click", handleChon);
  });
}
window.renderDropdownCX1 = renderDropdownCX1;

function closeDropdownCX1() {
  filteredCX1 = [];
  activeIndexCX1 = -1;
  dangHienGoiYCX1 = false;
  const el = document.getElementById("cx1-dropdown");
  if (el) {
    el.classList.remove("open");
    el.style.display = "none";
    el.innerHTML = "";
  }
  const kgKhu = document.getElementById("cx1-kg-khu");
  if (kgKhu) kgKhu.style.display = "";
}
window.closeDropdownCX1 = closeDropdownCX1;
window.dongDropdownCX1 = closeDropdownCX1;

function chonQCX1(item, mspTruyen) {
  if (!item) return;
  const tenVal = (typeof item === "object") ? item.ten : item;
  const mspVal = (typeof item === "object") ? (item.msp || item.ten) : (mspTruyen || item);
  const tenEl = document.getElementById("cx1-ten");
  const mspEl = document.getElementById("cx1-msp");
  if (tenEl) tenEl.value = tenVal;
  if (mspEl) mspEl.value = mspVal;
  if (typeof tkGhiNhanTanSuat === "function") {
    tkGhiNhanTanSuat(tenVal);
  }
  if (typeof item === "object") {
    item.count = (Number(item.count) || 0) + 1;
  }
  closeDropdownCX1();
  khoaQCCX1(mspVal, tenVal);

  const kgInput = document.getElementById("cx1-kg");
  if (kgInput) {
    kgInput.focus();
    if (typeof moBanPhimCX5 === "function") moBanPhimCX5(kgInput, "kg");
  }
}
window.chonQCX1 = chonQCX1;

function onKeydownCX1(e) {
  if (e.key === "ArrowDown") {
    if (!filteredCX1.length) return;
    e.preventDefault();
    activeIndexCX1 = Math.min(activeIndexCX1 + 1, filteredCX1.length - 1);
    renderDropdownCX1();
  } else if (e.key === "ArrowUp") {
    if (!filteredCX1.length) return;
    e.preventDefault();
    activeIndexCX1 = Math.max(activeIndexCX1 - 1, 0);
    renderDropdownCX1();
  } else if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
    if (filteredCX1.length) {
      e.preventDefault();
      chonQCX1(filteredCX1[activeIndexCX1 >= 0 ? activeIndexCX1 : 0]);
    }
  } else if (e.key === "Escape") {
    closeDropdownCX1();
  }
}
window.onKeydownCX1 = onKeydownCX1;

function khoiTaoSuKienCX1Ten() {
  const tenInput = document.getElementById("cx1-ten");
  if (tenInput && !tenInput._cx1Init) {
    tenInput._cx1Init = true;
    tenInput.addEventListener("input", onInputCX1);
    tenInput.addEventListener("keydown", onKeydownCX1);
    tenInput.addEventListener("focus", hienGoiYQCCX1);
    tenInput.addEventListener("click", hienGoiYQCCX1);
  }
}
window.khoiTaoSuKienCX1Ten = khoiTaoSuKienCX1Ten;

function themDongNhapTayCX1() {
  const qcInput = document.getElementById("cx1-ten");
  const mspInput = document.getElementById("cx1-msp");
  const baoInput = document.getElementById("cx1-bao");
  const kgInput = document.getElementById("cx1-kg");

  const qc = (qcKhoaCX1 || (qcInput ? qcInput.value.trim() : "")).trim();
  if (!qc) {
    showCanhBaoCX1("Vui lòng chọn hoặc nhập QC!");
    if (qcInput) qcInput.focus();
    return;
  }

  let msp = (mspKhoaCX1 || (mspInput ? mspInput.value.trim() : "")).trim();
  if (!msp && mspDataCX1 && mspDataCX1.length > 0) {
    const match = mspDataCX1.find(i => i.ten && i.ten.toLowerCase() === qc.toLowerCase());
    if (match) msp = match.msp;
  }
  if (!msp) msp = qc;

  const bao = parseInt(baoInput ? baoInput.value : "1") || 1;
  const kg = parseFloat(kgInput ? kgInput.value : "0") || 0;

  if (kg <= 0) {
    showCanhBaoCX1("Vui lòng nhập số KG hợp lệ!");
    if (kgInput) kgInput.focus();
    return;
  }

  if (!qcKhoaCX1) {
    khoaQCCX1(msp, qc);
  }

  const id = "MANUAL_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  phienCX1.push({
    id: id,
    msp: msp,
    qc: qc,
    bao: bao,
    kg: Math.round(kg * 10) / 10,
    thoiGian: new Date(),
    dotQuet: demSoDot,
    isManual: true
  });

  phatTiengBip();
  luuPhienDoDangCX1();
  capNhatLogCX1();

  if (kgInput) {
    kgInput.value = "";
    kgInput.focus();
    if (typeof moBanPhimCX5 === "function") moBanPhimCX5(kgInput, "kg");
  }
  if (baoInput) baoInput.value = "1";
}
window.themDongNhapTayCX1 = themDongNhapTayCX1;

function chuyenSangNhapTayCX1() {
  dungCX1();
  cheDoCX1 = "nhap";
  dangNhapCX1 = true;

  document.getElementById("cx1-form").style.display = "none";
  document.getElementById("cx1-cam").style.display = "none";
  document.getElementById("cx1-ketqua").style.display = "none";
  document.getElementById("cx1-nhap").style.display = "block";

  const statusEl = document.getElementById("cx1-nhap-status");
  if (statusEl) statusEl.textContent = "🟢 Đang nhập Đợt " + demSoDot + "...";
  const btn = document.getElementById("btn-dung-tieptuc-nhap-cx1");
  if (btn) {
    btn.textContent = "Dừng nhập";
    btn.className = "btn btn-red";
  }

  khoiTaoSuKienCX1Ten();
  taiDanhSachQCCX1();
  capNhatLogCX1();

  const kgInput = document.getElementById("cx1-kg");
  const tenInput = document.getElementById("cx1-ten");
  if (qcKhoaCX1 && kgInput) {
    kgInput.focus();
    if (typeof moBanPhimCX5 === "function") moBanPhimCX5(kgInput, "kg");
  } else if (tenInput) {
    tenInput.focus();
    if (typeof moBanPhimCX5 === "function") moBanPhimCX5(tenInput, "qc");
  }
}
window.chuyenSangNhapTayCX1 = chuyenSangNhapTayCX1;

function chuyenSangQuetCamCX1() {
  if (typeof dongBanPhimCX5 === "function") dongBanPhimCX5();
  cheDoCX1 = "quet";
  dangNhapCX1 = false;

  document.getElementById("cx1-nhap").style.display = "none";
  document.getElementById("cx1-cam").style.display = "block";

  tiepTucCX1();
  capNhatLogCX1();
}
window.chuyenSangQuetCamCX1 = chuyenSangQuetCamCX1;

function toggleDungTiepTucNhapCX1() {
  const btn = document.getElementById("btn-dung-tieptuc-nhap-cx1");
  const statusEl = document.getElementById("cx1-nhap-status");
  if (dangNhapCX1) {
    dangNhapCX1 = false;
    if (btn) {
      btn.textContent = "Nhập tiếp (Đợt mới)";
      btn.className = "btn btn-blue";
    }
    if (statusEl) statusEl.textContent = "Đã dừng Đợt " + demSoDot;
  } else {
    const maxDot = phienCX1.length > 0 ? Math.max(0, ...phienCX1.map(r => r.dotQuet || 1)) : 0;
    demSoDot = maxDot > 0 ? maxDot + 1 : 1;
    dangNhapCX1 = true;
    if (btn) {
      btn.textContent = "Dừng nhập";
      btn.className = "btn btn-red";
    }
    if (statusEl) statusEl.textContent = "🟢 Đang nhập Đợt " + demSoDot + "...";
    const kgInput = document.getElementById("cx1-kg");
    if (kgInput) kgInput.focus();
  }
}
window.toggleDungTiepTucNhapCX1 = toggleDungTiepTucNhapCX1;

function layBangChiTietCX1(danhSach) {
  let tongDot = {};
  (danhSach || []).forEach(r => {
    const keyDot = (r.dotQuet || 1) + "|" + (r.msp || "");
    const baoItem = parseInt(r.bao) || 1;
    if (!tongDot[keyDot]) {
      tongDot[keyDot] = {
        dot: r.dotQuet || 1,
        msp: r.msp || "",
        qc: r.qc || "",
        bao: 0,
        kg: 0
      };
    } else {
      if (r.qc && (!tongDot[keyDot].qc || r.qc.length < tongDot[keyDot].qc.length)) {
        tongDot[keyDot].qc = r.qc;
      }
    }
    tongDot[keyDot].bao += baoItem;
    tongDot[keyDot].kg += (r.kg || 0);
  });
  return Object.values(tongDot).map(item => {
    const dNgay = ngayCX1 || (typeof layNgayHomNayLocal === "function" ? layNgayHomNayLocal() : new Date().toISOString().split("T")[0]);
    let ngayVN = dNgay;
    const parts = dNgay.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      ngayVN = parts[2] + "/" + parts[1] + "/" + parts[0];
    }
    return {
      id: "",
      ID: "",
      msp: item.msp,
      MSP: item.msp,
      qc: item.qc,
      QC: item.qc,
      bao: item.bao,
      Bao: item.bao,
      soLuong: item.bao,
      SoLuong: item.bao,
      soBao: item.bao,
      SoBao: item.bao,
      sl: item.bao,
      SL: item.bao,
      soluong: item.bao,
      kg: Math.round(item.kg * 10) / 10,
      KG: Math.round(item.kg * 10) / 10,
      ngay: ngayVN,
      Ngay: ngayVN,
      date: ngayVN,
      Date: ngayVN,
      thoiGian: ngayVN,
      dot: item.dot
    };
  });
}

async function guiDuLieuCX1() {
  const moiBoSung = phienCX1.slice(soLuongDaGuiHienTai);
  if (moiBoSung.length === 0) {
    showCanhBaoCX1("Không có dữ liệu mới để gửi!", "warning");
    return;
  }

  const rows = layBangChiTietCX1(moiBoSung);
  if (rows.length === 0) {
    showCanhBaoCX1("Không có dữ liệu mới để gửi!", "warning");
    return;
  }

  const btnGui = document.getElementById("btn-gui-dulieu-cx1");
  if (btnGui) {
    btnGui.disabled = true;
    btnGui.innerHTML = '<i class="ti ti-loader spin"></i> Đang gửi ' + rows.length + ' dòng...';
  }

  try {
    await guiLenSheetCX1(rows);
    soLuongDaGuiHienTai = phienCX1.length;
    xoaPhienDoDangCX1();
    luuVaoLichSuCX1();
    showCanhBaoCX1("✅ Đã gửi thành công " + rows.length + " dòng lên Sheet!", "success");
    if (btnGui) {
      btnGui.innerHTML = '<i class="ti ti-circle-check"></i> Đã gửi thành công';
      btnGui.style.background = "linear-gradient(135deg, #10b981, #059669)";
      btnGui.style.color = "#fff";
    }
  } catch (err) {
    const pending = docPendingCX1();
    rows.forEach(r => {
      pending.push(r);
    });
    luuPendingCX1(pending);
    showCanhBaoCX1("Mất mạng — đã lưu tạm trên máy, sẽ tự gửi lại sau", "warning");
    soLuongDaGuiHienTai = phienCX1.length;
    luuVaoLichSuCX1();
    if (btnGui) {
      btnGui.disabled = false;
      btnGui.innerHTML = '<i class="ti ti-cloud-upload"></i> Gửi dữ liệu lên Sheet';
      btnGui.style.background = "linear-gradient(135deg, #f59e0b, #d97706)";
      btnGui.style.color = "#1a1a2e";
    }
  }
  if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
}
window.guiDuLieuCX1 = guiDuLieuCX1;

let cx1DangSuaDot = null;
let cx1DangSuaMsp = null;
let cx1DangSuaQc = null;

function nhapTayCX1(dot, msp, qc) {
  cx1DangSuaDot = dot;
  cx1DangSuaMsp = msp;
  cx1DangSuaQc = qc;
  let modal = document.getElementById("cx1-nhap-tay-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "cx1-nhap-tay-modal";
    modal.className = "overlay";
    modal.innerHTML = `
      <div class="overlay-card">
        <div class="overlay-title" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span id="cx1-sua-chitiet-title"></span>
          <button type="button" class="btn btn-sm btn-red" style="padding:4px 8px;font-size:12px;" onclick="xoaTongCX1()">Xóa tổng</button>
        </div>
        <div class="cx5-chitiet-kg" id="cx1-sua-chitiet-container" style="margin-top:10px">
        </div>
        <div style="display:flex;gap:8px;margin-top:14px">
          <input type="text" id="cx1-them-kg" inputmode="none" placeholder="Thêm số kg..." onkeydown="if(event.key==='Enter'){event.preventDefault();themKgVaoDotCX1()}">
          <button class="btn btn-green" style="width:56px;flex-shrink:0" onclick="themKgVaoDotCX1()"><i class="ti ti-plus"></i></button>
        </div>
        <button class="btn btn-full" style="background:var(--neutral-solid);color:var(--cream);margin-top:12px" onclick="dongNhapTayCX1()">Đóng</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const titleEl = document.getElementById("cx1-sua-chitiet-title");
  if (titleEl) {
    titleEl.textContent = "Đợt " + cx1DangSuaDot + " - " + (cx1DangSuaQc || cx1DangSuaMsp);
  }

  renderSuaChiTietCX1();
  modal.classList.add("show");
}

function renderSuaChiTietCX1() {
  const container = document.getElementById("cx1-sua-chitiet-container");
  if (!container) return;
  const rows = phienCX1.filter(r => r.dotQuet === cx1DangSuaDot && r.msp === cx1DangSuaMsp);

  let listHtml = "";
  if (rows.length === 0) {
    listHtml = '<div style="color:var(--cream-soft);font-size:13px;text-align:center;padding:10px 0;">Chưa có dữ liệu.</div>';
  } else {
    listHtml = rows.map(r => {
      const idx = phienCX1.indexOf(r);
      return '<span class="cx5-so-sx">' + r.kg + ' <i class="ti ti-x" onclick="xoaMaCX1TrongSua(' + idx + ', event)"></i></span>';
    }).join("");
  }

  container.innerHTML = listHtml;
}

function themKgVaoDotCX1() {
  const inputEl = document.getElementById("cx1-them-kg");
  if (!inputEl) return;
  const kgStr = inputEl.value;
  if (!kgStr) return;
  const kg = parseFloat(kgStr);
  if (isNaN(kg) || kg <= 0) {
    showCanhBaoCX1("Số KG không hợp lệ!");
    return;
  }

  const id = "MANUAL_" + Date.now();
  phienCX1.push({
    id: id, msp: cx1DangSuaMsp, qc: cx1DangSuaQc,
    bao: 1,
    kg: kg, thoiGian: new Date(), dotQuet: cx1DangSuaDot,
    isManual: true
  });

  inputEl.value = "";
  luuPhienDoDangCX1();
  hienKetQuaCX1();
  renderSuaChiTietCX1();
  capNhatLogCX1();

  const demEl = document.getElementById("cx1-dem");
  if (demEl) demEl.textContent = "Đã quét: " + phienCX1.length + " mã";
  inputEl.focus();
}

function xoaMaCX1TrongSua(index, ev) {
  if (ev) ev.stopPropagation();
  phienCX1.splice(index, 1);
  const maxDot = phienCX1.length > 0 ? Math.max(0, ...phienCX1.map(r => r.dotQuet || 1)) : 0;
  demSoDot = maxDot > 0 ? maxDot : 1;
  luuPhienDoDangCX1();
  hienKetQuaCX1();
  renderSuaChiTietCX1();
  capNhatLogCX1();
  const demEl = document.getElementById("cx1-dem");
  if (demEl) demEl.textContent = "Đã quét: " + phienCX1.length + " mã";
}

function xoaTongCX1() {
  if (typeof moXacNhanApp === "function") {
    moXacNhanApp("Xóa tất cả mã của quy cách này trong đợt " + cx1DangSuaDot + "?", () => {
      phienCX1 = phienCX1.filter(r => !(r.dotQuet === cx1DangSuaDot && r.msp === cx1DangSuaMsp));
      const maxDot = phienCX1.length > 0 ? Math.max(0, ...phienCX1.map(r => r.dotQuet || 1)) : 0;
      demSoDot = maxDot > 0 ? maxDot : 1;
      luuPhienDoDangCX1();
      hienKetQuaCX1();
      renderSuaChiTietCX1();
      capNhatLogCX1();
      const demEl = document.getElementById("cx1-dem");
      if (demEl) demEl.textContent = "Đã quét: " + phienCX1.length + " mã";
    }, "Xóa tất cả", null, "Hủy", "Xác nhận xóa");
  }
}

window.dongNhapTayCX1 = function () {
  const modal = document.getElementById("cx1-nhap-tay-modal");
  if (modal) modal.classList.remove("show");
  cx1DangSuaDot = null;
  cx1DangSuaMsp = null;
  cx1DangSuaQc = null;
  if (typeof dongBanPhimCX5 === "function") dongBanPhimCX5();
};
window.nhapTayCX1 = nhapTayCX1;
window.themKgVaoDotCX1 = themKgVaoDotCX1;
window.xoaMaCX1TrongSua = xoaMaCX1TrongSua;
window.xoaTongCX1 = xoaTongCX1;

function xoaMaCX1(index, ev) {
  if (ev) ev.stopPropagation();
  if (index < 0 || index >= phienCX1.length) return;
  const item = phienCX1[index];
  const tenMa = item ? (item.msp || item.id) : "mã này";
  const dot = item.dotQuet;
  const msp = item.msp;

  const doXoa = () => {
    phienCX1.splice(index, 1);
    const maxDot = phienCX1.length > 0 ? Math.max(0, ...phienCX1.map(r => r.dotQuet || 1)) : 0;
    demSoDot = maxDot > 0 ? maxDot : 1;
    luuPhienDoDangCX1();
    capNhatLogCX1();
    const demEl = document.getElementById("cx1-dem");
    if (demEl) demEl.textContent = "Đã quét: " + phienCX1.length + " mã";
    const statusEl = document.getElementById("cx1-status");
    if (statusEl && !dangQuetCX1) {
      statusEl.textContent = "Đã dừng Đợt " + demSoDot;
    }
    if (document.getElementById("cx1-ketqua") && document.getElementById("cx1-ketqua").style.display !== "none") {
      hienKetQuaCX1();
    }
    showCanhBaoCX1("Đã xóa " + tenMa);
  };

  if (typeof moXacNhanApp === "function") {
    moXacNhanApp("Xóa mã " + tenMa + " khỏi phiên quét?", doXoa, "Xóa", null, "Hủy", "Xác nhận xóa");
  } else {
    doXoa();
  }
}
window.xoaMaCX1 = xoaMaCX1;

function xoaNhomDotCX1(dot, msp, qc) {
  const tenQC = qc || msp || "quy cách này";
  if (typeof moXacNhanApp === "function") {
    moXacNhanApp(
      "Xóa tất cả mã của " + tenQC + " trong đợt " + dot + "?",
      () => {
        phienCX1 = phienCX1.filter(r => !(r.dotQuet === dot && r.msp === msp));
        const maxDot = phienCX1.length > 0 ? Math.max(0, ...phienCX1.map(r => r.dotQuet || 1)) : 0;
        demSoDot = maxDot > 0 ? maxDot : 1;
        luuPhienDoDangCX1();
        hienKetQuaCX1();
        capNhatLogCX1();
        const demEl = document.getElementById("cx1-dem");
        if (demEl) demEl.textContent = "Đã quét: " + phienCX1.length + " mã";
        showCanhBaoCX1("Đã xóa nhóm mã đợt " + dot, "success");
      },
      "Xóa nhóm",
      null,
      "Hủy",
      "Xác nhận xóa"
    );
  }
}
window.xoaNhomDotCX1 = xoaNhomDotCX1;

function capNhatLogCX1() {
  const containerQuet = document.getElementById("cx1-log-list");
  const containerNhap = document.getElementById("cx1-nhap-log-list");
  const countQuet = document.getElementById("cx1-log-count");
  const countNhap = document.getElementById("cx1-nhap-log-count");
  const demQuet = document.getElementById("cx1-dem");
  const demNhap = document.getElementById("cx1-nhap-dem");

  if (demQuet) demQuet.textContent = "Đã quét: " + phienCX1.length + " mã";
  if (demNhap) demNhap.textContent = "Đã nhập/quét: " + phienCX1.length + " mã";
  if (countQuet) countQuet.textContent = phienCX1.length + " mã";
  if (countNhap) countNhap.textContent = phienCX1.length + " mã";

  if (!containerQuet && !containerNhap) return;

  if (phienCX1.length === 0) {
    const emptyHtml = '<div style="color:var(--cream-soft); font-size:12px; text-align:center; padding:8px 0;">Chưa có mã nào</div>';
    if (containerQuet) containerQuet.innerHTML = emptyHtml;
    if (containerNhap) containerNhap.innerHTML = emptyHtml;
    return;
  }

  const dotSeq = {};
  phienCX1.forEach(item => {
    dotSeq[item.dotQuet] = (dotSeq[item.dotQuet] || 0) + 1;
    item.seqTrongDot = dotSeq[item.dotQuet];
  });

  const MAX_LIVE_LOG = 30;
  const newestFirst = phienCX1.slice().reverse();
  const displayedItems = newestFirst.slice(0, MAX_LIVE_LOG);

  let html = displayedItems.map((item, idx) => {
    const dot = item.dotQuet || 1;
    const originalIndex = phienCX1.length - 1 - idx;
    const gio = item.thoiGian ? new Date(item.thoiGian).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
    const flashClass = idx === 0 ? ' scan-flash-new' : '';

    return `<div class="${flashClass}" style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid var(--line-soft); font-size:12px; border-radius:6px; width:100%; box-sizing:border-box;">
      <span style="color:var(--steel); font-weight:700; width:26px; flex-shrink:0;">${dot}</span>
      <span style="color:var(--brass); font-weight:800; flex:1; min-width:0; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.qc || item.msp || '—'}</span>
      <span style="color:var(--cream-soft); font-size:11px; width:22px; text-align:center; flex-shrink:0;">${item.seqTrongDot}</span>
      <span style="color:var(--success); font-weight:700; width:40px; text-align:center; flex-shrink:0;">${item.kg || 0}</span>
      <span style="color:var(--cream-soft); font-size:11px; width:48px; text-align:right; flex-shrink:0;">${gio}</span>
      <button class="" onclick="xoaMaCX1(${originalIndex}, event)" title="Xóa mã này" style="margin-left:4px; background:none; border:none; color:var(--red); cursor:pointer; padding:2px 4px; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;">
        <i class="ti ti-trash"></i>
      </button>
    </div>`;
  }).join("");

  if (phienCX1.length > MAX_LIVE_LOG) {
    const conLai = phienCX1.length - MAX_LIVE_LOG;
    html += `<div style="text-align:center; padding:6px 0; font-size:11px; color:var(--cream-soft); font-style:italic;">... và ${conLai} mã trước đó (xem đầy đủ ở bảng kết quả)</div>`;
  }

  if (containerQuet) containerQuet.innerHTML = html;
  if (containerNhap) containerNhap.innerHTML = html;
}

function taoHangKetQuaCX1(danhSach, isReadonly = false) {
  let tongDotCuaPhien = {};
  let tongGomLoaiMa = {};
  let tongQRAll = 0;
  let tongKGAll = 0;

  danhSach.forEach(r => {
    const baoItem = parseInt(r.bao) || 1;
    tongQRAll += baoItem;
    tongKGAll += r.kg;

    const keyDot = r.dotQuet + "|" + r.msp;
    if (!tongDotCuaPhien[keyDot]) {
      tongDotCuaPhien[keyDot] = { dot: r.dotQuet, msp: r.msp, qc: r.qc, soLuong: 0, tongKG: 0 };
    } else {
      if (r.qc && (!tongDotCuaPhien[keyDot].qc || r.qc.length < tongDotCuaPhien[keyDot].qc.length)) {
        tongDotCuaPhien[keyDot].qc = r.qc;
      }
    }
    tongDotCuaPhien[keyDot].soLuong += baoItem;
    tongDotCuaPhien[keyDot].tongKG += r.kg;

    const keyGom = r.msp;
    if (!tongGomLoaiMa[keyGom]) {
      tongGomLoaiMa[keyGom] = { msp: r.msp, qc: r.qc, soLuong: 0, tongKG: 0 };
    } else {
      if (r.qc && (!tongGomLoaiMa[keyGom].qc || r.qc.length < tongGomLoaiMa[keyGom].qc.length)) {
        tongGomLoaiMa[keyGom].qc = r.qc;
      }
    }
    tongGomLoaiMa[keyGom].soLuong += baoItem;
    tongGomLoaiMa[keyGom].tongKG += r.kg;
  });

      let hangDot = "";
    Object.values(tongDotCuaPhien).forEach(item => {
      hangDot += `
    <div class="${!isReadonly ? 'cx5-swipe-row' : ''}">
      <div style="display:flex; width: 100%; box-sizing: border-box; padding:12px 10px; border-bottom:1px solid var(--line); align-items:center; flex:1; font-size:14px; ${!isReadonly ? 'cursor:pointer;' : ''}" ${!isReadonly ? `onclick="nhapTayCX1(${item.dot}, '${item.msp}', '${item.qc}')"` : ""}>
        <div style="flex:0.8; color:var(--brass); font-weight:700;">Đợt ${item.dot}</div>
        <div style="flex:1.5;">${item.qc}</div>
        <div style="flex:0.7; text-align:center;">${item.soLuong}</div>
        <div style="flex:1; text-align:right; font-weight:700; color:var(--success);">${item.tongKG.toFixed(1)}</div>
      </div>
      ${!isReadonly ? `<div class="cx5-del-btn" onclick="xoaNhomDotCX1(${item.dot}, '${item.msp}', '${item.qc}')"><i class="ti ti-trash"></i></div>` : ""}
    </div>`;
    });
    let footDot = `
    <div style="display:flex; width: 100%; box-sizing: border-box; padding:10px; background:var(--card-raised); align-items:center; font-size:14px;">
      <div style="flex:0.8; font-weight:700; color:var(--brass);">TỔNG</div>
      <div style="flex:1.5;">&nbsp;</div>
      <div style="flex:0.7; text-align:center; font-weight:700; color:var(--brass);">${tongQRAll}</div>
      <div style="flex:1; text-align:right; font-weight:700; color:var(--brass);">${tongKGAll.toFixed(1)}</div>
    </div>`;

  let hangGom = "";
  Object.values(tongGomLoaiMa).forEach(item => {
    hangGom += `
    <div style="display:flex; width: 100%; box-sizing: border-box; align-items:center; padding:10px; border-bottom:1px solid var(--line-soft); font-size:14px;">
      <div style="flex:2.3;">${item.qc}</div>
      <div style="flex:0.7; text-align:center; font-weight:700;">${item.soLuong}</div>
      <div style="flex:1; text-align:right; font-weight:700; color:var(--success);">${item.tongKG.toFixed(1)}</div>
    </div>`;
  });
  let footGom = `
    <div style="display:flex; width: 100%; box-sizing: border-box; align-items:center; padding:10px; background:var(--card-raised); font-size:14px;">
      <div style="flex:2.3; font-weight:700; color:var(--steel);">TỔNG</div>
      <div style="flex:0.7; text-align:center; font-weight:700; color:var(--steel);">${tongQRAll}</div>
      <div style="flex:1; text-align:right; font-weight:700; color:var(--steel);">${tongKGAll.toFixed(1)}</div>
    </div>`;
  
  return { hangDot, footDot, hangGom, footGom, tongQRAll, tongKGAll };
}

// ── Chuyển Đổi Tab Chi Tiết / Tổng Hợp CX1 ──────────────────────────────
function toggleCX1View(mode) {
  const wrapChitiet = document.getElementById("cx1-wrap-chitiet");
  const wrapGom = document.getElementById("cx1-wrap-gom");
  const tabChitiet = document.getElementById("cx1-tab-chitiet");
  const tabTonghop = document.getElementById("cx1-tab-tonghop");

  if (mode === "chitiet") {
    wrapChitiet.style.display = "block";
    wrapGom.style.display = "none";
    tabChitiet.className = "btn btn-blue";
    tabChitiet.style.background = "";
    tabChitiet.style.color = "";
    tabChitiet.style.border = "none";

    tabTonghop.className = "btn";
    tabTonghop.style.background = "transparent";
    tabTonghop.style.color = "var(--primary)";
    tabTonghop.style.border = "1px solid var(--primary)";
  } else {
    wrapChitiet.style.display = "none";
    wrapGom.style.display = "block";

    tabTonghop.className = "btn btn-blue";
    tabTonghop.style.background = "";
    tabTonghop.style.color = "";
    tabTonghop.style.border = "none";

    tabChitiet.className = "btn";
    tabChitiet.style.background = "transparent";
    tabChitiet.style.color = "var(--primary)";
    tabChitiet.style.border = "1px solid var(--primary)";
  }
}
window.toggleCX1View = toggleCX1View;

function hienKetQuaCX1() {
  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(false); else document.body.classList.remove("cam-active");
  const { hangDot, footDot, hangGom, footGom, tongQRAll, tongKGAll } = taoHangKetQuaCX1(phienCX1);
  const tbodyDot = document.getElementById("cx1-tbody-dot");
  const tfootDot = document.getElementById("cx1-tfoot-dot");
  const tbodyGom = document.getElementById("cx1-tbody-gom");
  const tfootGom = document.getElementById("cx1-tfoot-gom");
  if (tbodyDot) tbodyDot.innerHTML = hangDot;
  if (tfootDot) tfootDot.innerHTML = footDot;
  if (tbodyGom) tbodyGom.innerHTML = hangGom;
  if (tfootGom) tfootGom.innerHTML = footGom;
  
  const tongBaoEl = document.getElementById("cx1-tong-bao");
  if (tongBaoEl) tongBaoEl.textContent = tongQRAll;
  
  const tongKgEl = document.getElementById("cx1-tong-kg");
  if (tongKgEl) tongKgEl.textContent = tongKGAll.toFixed(1);

  if (document.getElementById("cx1-cam")) document.getElementById("cx1-cam").style.display = "none";
  if (document.getElementById("cx1-nhap")) document.getElementById("cx1-nhap").style.display = "none";
  document.getElementById("cx1-ketqua").style.display = "block";
  
  // Mặc định hiện Chi Tiết
  toggleCX1View("chitiet");
}

async function quetTiepCX1() {
  const maxDot = phienCX1.length > 0 ? Math.max(0, ...phienCX1.map(r => r.dotQuet || 1)) : 0;
  demSoDot = maxDot > 0 ? maxDot + 1 : 1;
  luuPhienDoDangCX1();

  document.getElementById("cx1-ketqua").style.display = "none";

  if (cheDoCX1 === "nhap") {
    chuyenSangNhapTayCX1();
    return;
  }

  // Quét camera
  dangQuetCX1 = true;
  denPinBat = false;
  document.getElementById("cx1-cam").style.display = "block";
  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(true); else document.body.classList.add("cam-active");
  document.getElementById("cx1-status").textContent = "Đang quét Đợt " + demSoDot + "...";

  const btnToggle = document.getElementById("btn-dung-tieptuc-cx1");
  if (btnToggle) {
    btnToggle.textContent = "Dừng quét";
    btnToggle.className = "btn btn-red btn-full";
  }

  try {
    const cx1Vid = document.getElementById("cx1-reader");
    const cx1Track = cx1Vid && cx1Vid.srcObject ? cx1Vid.srcObject.getVideoTracks()[0] : null;
    const isCamRunningCX1 = cx1Track && cx1Track.readyState === 'live';
    if (!zxingReaderCX1 || !isCamRunningCX1) {
      if (zxingReaderCX1) {
        if (typeof dungCameraFast === "function") dungCameraFast("cx1-reader", zxingReaderCX1);
        zxingReaderCX1 = null;
      }
      zxingReaderCX1 = await khoiTaoCameraFast("cx1-reader", (txt) => {
        if (txt && dangQuetCX1) {
          khiQuetDuocMa({ getText: () => txt });
        }
      });
    } else if (cx1Vid && cx1Vid.paused) {
      cx1Vid.play().catch(() => { });
    }
  } catch (e) {
    if (typeof showCanhBaoCX1 === "function") showCanhBaoCX1("Lỗi camera: " + e, "error");
    dungCX1();
  }
}

function quetMoiCX1() {
  if (typeof dongBanPhimCX5 === "function") dongBanPhimCX5();
  phienCX1 = [];
  demSoDot = 0;
  idPhienHienTai = null;
  soLuongDaGuiHienTai = 0;
  qcKhoaCX1 = null;
  mspKhoaCX1 = null;
  moKhoaQCCX1();
  xoaPhienDoDangCX1();
  document.getElementById("cx1-ketqua").style.display = "none";
  if (document.getElementById("cx1-nhap")) document.getElementById("cx1-nhap").style.display = "none";
  if (document.getElementById("cx1-cam")) document.getElementById("cx1-cam").style.display = "none";
  document.getElementById("cx1-form").style.display = "block";
  capNhatLogCX1();
}

let timerCanhBaoCX1 = null;
function showCanhBaoCX1(text, type = "error") {
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

  if (timerCanhBaoCX1) clearTimeout(timerCanhBaoCX1);
  timerCanhBaoCX1 = setTimeout(() => {
    if (el) el.style.display = "none";
  }, 2000);
}

// Khôi phục lại 1 phiên Chỉ For đã lưu (từ banner "Phiên dở dang" ở Trang chủ,
// hoặc khi bấm Quét mà đang có phiên cũ chưa xử lý)
async function khoiPhucCX1(state) {
  phienCX1 = state.phienCX1.map(r => ({ ...r, thoiGian: new Date(r.thoiGian) }));
  demSoDot = state.demSoDot || 1;
  ngayCX1 = state.ngayCX1;
  idPhienHienTai = state.idPhienHienTai || (Date.now() + "-" + Math.random().toString(36).slice(2));
  soLuongDaGuiHienTai = state.soLuongDaGuiHienTai !== undefined ? state.soLuongDaGuiHienTai
    : (state.soLuongDaGui !== undefined ? state.soLuongDaGui : 0);
  denPinBat = false;
  cheDoCX1 = state.cheDoCX1 || "quet";
  luuPhienDoDangCX1();

  if (cheDoCX1 === "nhap") {
    chuyenSangNhapTayCX1();
    return;
  }

  dangQuetCX1 = true;
  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(true); else document.body.classList.add("cam-active");
  document.getElementById("cx1-form").style.display = "none";
  if (document.getElementById("cx1-nhap")) document.getElementById("cx1-nhap").style.display = "none";
  document.getElementById("cx1-cam").style.display = "block";
  document.getElementById("cx1-ketqua").style.display = "none";
  document.getElementById("cx1-dem").textContent = "Đã quét: " + phienCX1.length + " mã";
  document.getElementById("cx1-status").textContent = "Đang quét Đợt " + demSoDot + "...";
  document.getElementById("btn-flash-cx1").style.background = "var(--neutral)";
  document.getElementById("btn-flash-cx1").style.color = "var(--cream)";
  document.getElementById("btn-flash-cx1").textContent = "Bật đèn pin";
  capNhatLogCX1();

  const btnToggle = document.getElementById("btn-dung-tieptuc-cx1");
  btnToggle.textContent = "Dừng quét";
  btnToggle.className = "btn btn-red btn-full";

  try {
    const cx1Vid = document.getElementById("cx1-reader");
    const cx1Track = cx1Vid && cx1Vid.srcObject ? cx1Vid.srcObject.getVideoTracks()[0] : null;
    const isCamRunningCX1 = cx1Track && cx1Track.readyState === 'live';
    if (!zxingReaderCX1 || !isCamRunningCX1) {
      if (zxingReaderCX1) {
        if (typeof dungCameraFast === "function") dungCameraFast("cx1-reader", zxingReaderCX1);
        zxingReaderCX1 = null;
      }
      zxingReaderCX1 = await khoiTaoCameraFast("cx1-reader", (txt) => {
        if (txt && dangQuetCX1) {
          khiQuetDuocMa({ getText: () => txt });
        }
      });
    } else if (cx1Vid && cx1Vid.paused) {
      cx1Vid.play().catch(() => { });
    }
  } catch (e) {
    if (typeof showCanhBaoCX1 === "function") showCanhBaoCX1("Lỗi camera: " + e, "error");
    dungCX1();
  }
}

function tiepTucPhienChiFor() {
  let state = null;
  try { state = JSON.parse(localStorage.getItem("cx1_phien_dodang")); } catch (e) { }
  if (!state) return;
  if (typeof diToiTab === "function") diToiTab("chiFor");
  khoiPhucCX1(state);
}

function huyPhienChiFor() {
  xoaPhienDoDangCX1();
  if (typeof capNhatTrangChu === "function") capNhatTrangChu();
}

window.addEventListener("load", function () {
  const today = new Date().toISOString().split("T")[0];
  const ngayInput = document.getElementById("cx1-ngay");
  if (ngayInput) ngayInput.value = today;
});

window.addEventListener("load", async function () {
  const pending = docPendingCX1();
  if (pending.length === 0) return;
  try {
    await guiLenSheetCX1(pending);
    luuPendingCX1([]);
  } catch (e) {
    // vẫn còn offline, giữ nguyên để thử lại lần tới
  }
  if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
});

window.addEventListener("online", async function () {
  const pending = docPendingCX1();
  if (pending.length === 0) return;
  try {
    await guiLenSheetCX1(pending);
    luuPendingCX1([]);
  } catch (e) { }
  if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
});

function xuatCSVCX1() {
  if (phienCX1.length === 0) { showCanhBaoCX1("Chưa có dữ liệu để xuất"); return; }
  const header = ["Dot", "MSP", "QC", "KG", "ThoiGian"];
  const rows = phienCX1.map(r => [r.dotQuet, r.msp, r.qc, r.kg, r.thoiGian.toISOString()]);
  const escapeCSV = v => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map(row => row.map(escapeCSV).join(",")).join("\r\n");
  const bom = "\uFEFF"; // giúp Excel đọc đúng tiếng Việt có dấu
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ngay = ngayCX1 || new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = "chi-for-" + ngay + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Lịch sử Chỉ For (lưu 30 ngày gần nhất, xem lại + tiếp tục quét) ─────
let dangXemLichSuId = null;

function docLichSuCX1() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(CX1_LICHSU_KEY)) || []; } catch (e) { list = []; }
  const homNay = new Date();
  homNay.setHours(0, 0, 0, 0);
  return list.filter(s => {
    if (!s.ngay) return false;
    const ngayPhien = new Date(s.ngay + "T00:00:00");
    const soNgayCach = Math.floor((homNay - ngayPhien) / 86400000);
    return soNgayCach >= 0 && soNgayCach < CX1_LICHSU_SO_NGAY_GIU;
  });
}

function luuLichSuCX1(list) {
  try { localStorage.setItem(CX1_LICHSU_KEY, JSON.stringify(list)); } catch (e) { }
}

function donDepLichSuCX1() {
  luuLichSuCX1(docLichSuCX1());
}

function luuVaoLichSuCX1() {
  if (!idPhienHienTai) return;
  const list = docLichSuCX1();
  if (phienCX1.length === 0) {
    const filtered = list.filter(s => s.idPhien !== idPhienHienTai);
    luuLichSuCX1(filtered);
    if (typeof renderLichSuCX1 === "function") renderLichSuCX1();
    return;
  }
  const idx = list.findIndex(s => s.idPhien === idPhienHienTai);
  const banGhi = {
    idPhien: idPhienHienTai,
    ngay: ngayCX1,
    capNhatLuc: new Date().toISOString(),
    phienCX1: phienCX1,
    demSoDot: demSoDot,
    soLuongDaGui: soLuongDaGuiHienTai
  };
  if (idx >= 0) list[idx] = banGhi; else list.push(banGhi);
  luuLichSuCX1(list);
  if (typeof renderLichSuCX1 === "function") renderLichSuCX1();
}

function moLichSuCX1() {
  renderLichSuCX1();
  if (typeof chuyenTrangKhongNav === "function") chuyenTrangKhongNav("lichSu");
}
window.moLichSuCX1 = moLichSuCX1;

function renderLichSuCX1() {
  const container = document.getElementById("lichsu-list");
  if (!container) return;
  const oTim = document.getElementById("lichsu-cx1-tim");
  const tuKhoa = oTim ? oTim.value.trim().toLowerCase() : "";

  let list = docLichSuCX1().slice().sort((a, b) => new Date(b.capNhatLuc) - new Date(a.capNhatLuc));
  if (tuKhoa) {
    list = list.filter(s =>
      (s.ngay && s.ngay.toLowerCase().includes(tuKhoa)) ||
      (s.phienCX1 && s.phienCX1.some(r => (r.qc || "").toLowerCase().includes(tuKhoa) || (r.msp || "").toLowerCase().includes(tuKhoa)))
    );
  }

  if (list.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--cream-soft);padding:20px 0;">'
      + (tuKhoa ? "Không tìm thấy phiên nào khớp" : "Chưa có phiên nào trong " + CX1_LICHSU_SO_NGAY_GIU + " ngày qua")
      + '</div>';
    return;
  }

  container.innerHTML = list.map(function (s) {
    const parts = s.ngay ? s.ngay.split("-") : [];
    const ngayNgan = parts.length === 3 ? parts[2] + "-" + parts[1] : s.ngay;
    const tongKg = s.phienCX1.reduce(function (t, r) { return t + (r.kg || 0); }, 0);
    const soBao = s.phienCX1.length;
    const daXongHet = (s.soLuongDaGui || 0) >= s.phienCX1.length && s.phienCX1.length > 0;
    const trangThai = daXongHet
      ? '<i class="ti ti-check cx5-trangthai-ok"></i>'
      : '<i class="ti ti-x cx5-trangthai-mot-phan"></i>';
    const gio = new Date(s.capNhatLuc).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

    return '<div class="irow lichsu-row" style="cursor:pointer;align-items:center" onclick="xemChiTietLichSuCX1(\'' + s.idPhien + '\')">'
      + '<span style="font-family:\'IBM Plex Sans\',sans-serif;color:var(--cream); flex: 1;">'
      + ngayNgan + '&nbsp;&nbsp;&nbsp;' + gio + '&nbsp;&nbsp;&nbsp;' + soBao + 'b&nbsp;&nbsp;&nbsp;' + Math.round(tongKg) + 'kg'
      + '</span>'
      + '<span style="display:inline-flex;align-items:center;gap:8px;padding-left:8px;border-left:1px solid var(--line)">'
      + trangThai
      + '<button class="lichsu-del-btn" aria-label="Xóa phiên này" title="Xóa phiên này" onclick="xoaMotPhienLichSuCX1(\'' + s.idPhien + '\', event)"><i class="ti ti-trash"></i></button>'
      + '</span>'
      + '</div>';
  }).join("");
}
window.renderLichSuCX1 = renderLichSuCX1;

function xemChiTietLichSuCX1(idPhien) {
  const list = docLichSuCX1();
  const entry = list.find(s => s.idPhien === idPhien);
  if (!entry) return;

  dangXemLichSuId = idPhien;
  const { hangDot, footDot, hangGom, footGom } = taoHangKetQuaCX1(entry.phienCX1, true);
  const tbodyDot = document.getElementById("lichsu-tbody-dot");
  const tfootDot = document.getElementById("lichsu-tfoot-dot");
  const tbodyGom = document.getElementById("lichsu-tbody-gom");
  const tfootGom = document.getElementById("lichsu-tfoot-gom");
  if (tbodyDot) tbodyDot.innerHTML = hangDot;
  if (tfootDot) tfootDot.innerHTML = footDot;
  if (tbodyGom) tbodyGom.innerHTML = hangGom;
  if (tfootGom) tfootGom.innerHTML = footGom;
  document.getElementById("lichsu-chitiet-tieude").textContent = "Chỉ For — " + entry.ngay;

  if (typeof chuyenTrangKhongNav === "function") chuyenTrangKhongNav("lichsuChiTiet");
}
window.xemChiTietLichSuCX1 = xemChiTietLichSuCX1;

function tiepTucLichSuCX1(idPhien) {
  const list = docLichSuCX1();
  const entry = list.find(s => s.idPhien === idPhien);
  if (!entry) return;

  if (typeof diToiTab === "function") diToiTab("chiFor");
  khoiPhucCX1({
    phienCX1: entry.phienCX1,
    demSoDot: entry.demSoDot,
    ngayCX1: entry.ngay,
    idPhienHienTai: entry.idPhien,
    soLuongDaGuiHienTai: entry.soLuongDaGui
  });
}

function tiepTucTuChiTietLichSu() {
  if (dangXemLichSuId) tiepTucLichSuCX1(dangXemLichSuId);
}
window.tiepTucTuChiTietLichSu = tiepTucTuChiTietLichSu;

function xoaMotPhienLichSuCX1(idPhien, ev) {
  if (ev) ev.stopPropagation();
  if (typeof moXacNhanApp === "function") {
    moXacNhanApp(
      "Xóa phiên lịch sử Chỉ X1 này? Không thể hoàn tác.",
      () => {
        luuLichSuCX1(docLichSuCX1().filter(s => s.idPhien !== idPhien));
        renderLichSuCX1();
      },
      "Xóa",
      null,
      "Hủy",
      "Xóa phiên lịch sử"
    );
  }
}
window.xoaMotPhienLichSuCX1 = xoaMotPhienLichSuCX1;

function xoaTatCaLichSuCX1() {
  const list = docLichSuCX1();
  if (list.length === 0) {
    showCanhBaoCX1("Không có lịch sử để xóa");
    return;
  }
  if (typeof moXacNhanApp === "function") {
    moXacNhanApp(
      "Xóa toàn bộ " + list.length + " phiên lịch sử Chỉ X1? Không thể hoàn tác.",
      () => {
        luuLichSuCX1([]);
        renderLichSuCX1();
      },
      "Xóa tất cả",
      null,
      "Hủy",
      "Xóa tất cả lịch sử"
    );
  }
}
window.xoaTatCaLichSuCX1 = xoaTatCaLichSuCX1;

function xuatExcelLichSuCX1(idPhien) {
  const targetId = idPhien || dangXemLichSuId;
  const list = docLichSuCX1();

  let exportData = [];
  let fileTitle = "LichSu_ChiX1";

  if (targetId) {
    const entry = list.find(s => s.idPhien === targetId);
    if (!entry || !entry.phienCX1 || entry.phienCX1.length === 0) {
      showCanhBaoCX1("Chưa có dữ liệu phiên này để xuất Excel!");
      return;
    }
    const dateStr = entry.ngay || new Date().toISOString().split("T")[0];
    fileTitle = "LichSu_ChiX1_" + dateStr;
    exportData = entry.phienCX1.map((item, idx) => ({
      "STT": idx + 1,
      "Ngày": entry.ngay,
      "Đợt quét": item.dotQuet || 1,
      "Mã ID": item.id,
      "Mã MSP": item.msp,
      "Quy cách": item.qc,
      "Khối lượng (Kg)": item.kg,
      "Thời gian": item.thoiGian ? new Date(item.thoiGian).toLocaleTimeString("vi-VN") : ""
    }));
  } else {
    // Xuất toàn bộ tất cả các phiên trong lịch sử
    if (list.length === 0) {
      showCanhBaoCX1("Chưa có dữ liệu lịch sử để xuất Excel!");
      return;
    }
    let stt = 1;
    list.forEach(entry => {
      (entry.phienCX1 || []).forEach(item => {
        exportData.push({
          "STT": stt++,
          "Ngày": entry.ngay,
          "Đợt quét": item.dotQuet || 1,
          "Mã ID": item.id,
          "Mã MSP": item.msp,
          "Quy cách": item.qc,
          "Khối lượng (Kg)": item.kg,
          "Thời gian": item.thoiGian ? new Date(item.thoiGian).toLocaleTimeString("vi-VN") : ""
        });
      });
    });
    fileTitle = "LichSu_ChiX1_ToanBo_" + new Date().toISOString().split("T")[0];
  }

  if (typeof exportToExcel === "function") {
    exportToExcel(fileTitle, "Chi X1", exportData);
  }
}
window.xuatExcelLichSuCX1 = xuatExcelLichSuCX1;

function xuatExcelCX1() {
  if (phienCX1.length === 0) {
    showCanhBaoCX1("Chưa có dữ liệu để xuất Excel!");
    return;
  }
  const dateStr = ngayCX1 || new Date().toISOString().split("T")[0];
  const exportData = phienCX1.map((item, idx) => ({
    "STT": idx + 1,
    "Ngày": ngayCX1,
    "Đợt quét": item.dotQuet || 1,
    "Mã ID": item.id,
    "Mã MSP": item.msp,
    "Quy cách": item.qc,
    "Khối lượng (Kg)": item.kg,
    "Thời gian": item.thoiGian ? new Date(item.thoiGian).toLocaleTimeString("vi-VN") : ""
  }));
  if (typeof exportToExcel === "function") {
    exportToExcel("KetQua_ChiX1_" + dateStr, "Chi X1", exportData);
  }
}
window.xuatExcelCX1 = xuatExcelCX1;


function toggleLichSuCX1View(mode) {
    const wrapChitiet = document.getElementById("ls-cx1-wrap-chitiet");
    const wrapGom = document.getElementById("ls-cx1-wrap-gom");
    const tabChitiet = document.getElementById("ls-cx1-tab-chitiet");
    const tabTonghop = document.getElementById("ls-cx1-tab-tonghop");
  
    if (!wrapChitiet || !wrapGom) return;
  
    if (mode === "chitiet") {
      wrapChitiet.style.display = "block";
      wrapGom.style.display = "none";
      if (tabChitiet) {
        tabChitiet.className = "btn btn-blue";
        tabChitiet.style.background = "";
        tabChitiet.style.color = "";
        tabChitiet.style.border = "none";
      }
      if (tabTonghop) {
        tabTonghop.className = "btn";
        tabTonghop.style.background = "transparent";
        tabTonghop.style.color = "var(--primary)";
        tabTonghop.style.border = "1px solid var(--primary)";
      }
    } else {
      wrapChitiet.style.display = "none";
      wrapGom.style.display = "block";
      if (tabTonghop) {
        tabTonghop.className = "btn btn-blue";
        tabTonghop.style.background = "";
        tabTonghop.style.color = "";
        tabTonghop.style.border = "none";
      }
      if (tabChitiet) {
        tabChitiet.className = "btn";
        tabChitiet.style.background = "transparent";
        tabChitiet.style.color = "var(--primary)";
        tabChitiet.style.border = "1px solid var(--primary)";
      }
    }
}
window.toggleLichSuCX1View = toggleLichSuCX1View;
