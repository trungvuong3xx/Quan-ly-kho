// ── Chỉ FOR ─────────────────────────────────────────────
let zxingReaderCX1 = null;
let dangQuetCX1 = false;
let phienCX1 = []; 
let demSoDot = 0;   
let denPinBat = false;
let ngayCX1 = null;

// Theo dõi phiên hiện tại để nối vào Lịch sử + tránh gửi trùng khi "tiếp tục" 1 phiên cũ
let idPhienHienTai = null;
let soLuongDaGuiHienTai = 0;

const CX1_LICHSU_KEY = "cx1_lich_su";
const CX1_LICHSU_SO_NGAY_GIU = 3;

// Bộ máy âm thanh phát tiếng bíp quét QR dùng trung tâm từ app.js
if (typeof phatTiengBip !== "function") {
  var phatTiengBip = function() {
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
      idPhienHienTai, soLuongDaGuiHienTai
    }));
    if (typeof kichHoatKiemTraAutoBackup === "function") kichHoatKiemTraAutoBackup(4000);
  } catch (e) {}
}

function xoaPhienDoDangCX1() {
  try { localStorage.removeItem("cx1_phien_dodang"); } catch (e) {}
}

async function batDauCX1() {
  const inputEl = document.getElementById("cx1-ngay");
  if (inputEl && !inputEl.value) {
    inputEl.value = (typeof layNgayHomNayLocal === "function") ? layNgayHomNayLocal() : new Date().toISOString().split("T")[0];
  }
  ngayCX1 = inputEl ? inputEl.value : ((typeof layNgayHomNayLocal === "function") ? layNgayHomNayLocal() : new Date().toISOString().split("T")[0]);

  let phienCu = null;
  try { phienCu = JSON.parse(localStorage.getItem("cx1_phien_dodang")); } catch (e) {}
  if (phienCu && Array.isArray(phienCu.phienCX1) && phienCu.phienCX1.length > 0) {
    if (typeof moXacNhanApp === "function") {
      moXacNhanApp(
        "Bạn đang có phiên Chỉ X1 dở dang (" + phienCu.phienCX1.length + " mã, ngày " + phienCu.ngayCX1 + ").<br>Bạn muốn tiếp tục phiên đó hay bắt đầu phiên mới?",
        () => { khoiPhucCX1(phienCu); },
        "Tiếp tục",
        () => { xoaPhienDoDangCX1(); tiepTucKhoiTaoCX1(); },
        "Bắt đầu mới",
        "Phiên dở dang"
      );
      return;
    }
  }

  tiepTucKhoiTaoCX1();
}

async function tiepTucKhoiTaoCX1() {
  phienCX1 = [];
  demSoDot = 1; 
  dangQuetCX1 = true;
  denPinBat = false;
  idPhienHienTai = Date.now() + "-" + Math.random().toString(36).slice(2);
  soLuongDaGuiHienTai = 0;

  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(true); else document.body.classList.add("cam-active");
  document.getElementById("cx1-form").style.display = "none";
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
      cx1Vid.play().catch(() => {});
    }
  } catch(e) {
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
  const coDuLieu = phienCX1.some(r => r.dotQuet === demSoDot);
  if (coDuLieu) {
    demSoDot += 1; 
  }
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
      cx1Vid.play().catch(() => {});
    }
  } catch(e) {
    showCanhBaoCX1("Lỗi camera: " + e);
    dungCX1();
  }
}

function toggleDungTiepTuc() {
  const btn = document.getElementById("btn-dung-tieptuc-cx1");
  if (dangQuetCX1) {
    dungCX1();
    btn.textContent = "Tiếp tục Đợt " + (demSoDot + 1);
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
  try { localStorage.setItem("cx1_pending_saves", JSON.stringify(list)); } catch (e) {}
}

async function guiLenSheetCX1(rows) {
  const URL_API = "https://script.google.com/macros/s/AKfycbzk7afcuHDOTnL6QSIQ0ZgT-CSiIDNZ8h5S8_IkGXahc7PQRvqZKpLpjkBphioXAyzDKQ/exec";
  const res = await fetch(URL_API, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "luuCX1", data: rows })
  });
  if (!res.ok) throw new Error("Lỗi kết nối server HTTP " + res.status);
  const json = await res.json();
  if (json && json.error) throw new Error(json.error);
}

function ketThucCX1() {
  dungCX1();
  
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

async function guiDuLieuCX1() {
  const moiBoSung = phienCX1.slice(soLuongDaGuiHienTai);
  if (moiBoSung.length === 0) {
    showCanhBaoCX1("Không có dữ liệu mới để gửi!", "warning");
    return;
  }

  const btnGui = document.getElementById("btn-gui-dulieu-cx1");
  if (btnGui) {
    btnGui.disabled = true;
    btnGui.innerHTML = '<i class="ti ti-loader spin"></i> Đang gửi ' + moiBoSung.length + ' mã...';
  }

  const rows = moiBoSung.map(r => ({
    id: r.id,
    msp: r.msp,
    qc: r.qc,
    kg: r.kg,
    ngay: ngayCX1,
    thoiGian: r.thoiGian ? (typeof r.thoiGian.toISOString === "function" ? r.thoiGian.toISOString() : r.thoiGian) : new Date().toISOString()
  }));

  try {
    await guiLenSheetCX1(rows);
    soLuongDaGuiHienTai = phienCX1.length;
    xoaPhienDoDangCX1();
    luuVaoLichSuCX1();
    showCanhBaoCX1("✅ Đã gửi thành công " + rows.length + " mã lên Sheet!", "success");
    if (btnGui) {
      btnGui.innerHTML = '<i class="ti ti-circle-check"></i> Đã gửi thành công';
      btnGui.style.background = "linear-gradient(135deg, #10b981, #059669)";
      btnGui.style.color = "#fff";
    }
  } catch (err) {
    const pending = docPendingCX1();
    rows.forEach(r => {
      if (!pending.some(p => p.id === r.id && p.thoiGian === r.thoiGian)) {
        pending.push(r);
      }
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
    kg: kg, thoiGian: new Date(), dotQuet: cx1DangSuaDot
  });
  
  inputEl.value = "";
  luuPhienDoDangCX1();
  hienKetQuaCX1();
  renderSuaChiTietCX1();
  capNhatLogCX1();
  
  const demEl = document.getElementById("cx1-dem");
  if(demEl) demEl.textContent = "Đã quét: " + phienCX1.length + " mã";
  inputEl.focus();
}

function xoaMaCX1TrongSua(index, ev) {
  if (ev) ev.stopPropagation();
  phienCX1.splice(index, 1);
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
      luuPhienDoDangCX1();
      hienKetQuaCX1();
      renderSuaChiTietCX1();
      capNhatLogCX1();
      const demEl = document.getElementById("cx1-dem");
      if (demEl) demEl.textContent = "Đã quét: " + phienCX1.length + " mã";
    }, "Xóa tất cả", null, "Hủy", "Xác nhận xóa");
  }
}

window.dongNhapTayCX1 = function() {
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
    phienCX1 = phienCX1.filter(r => !(r.dotQuet === dot && r.msp === msp));
    luuPhienDoDangCX1();
    capNhatLogCX1();
    const demEl = document.getElementById("cx1-dem");
    if (demEl) demEl.textContent = "Đã quét: " + phienCX1.length + " mã";
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
  const container = document.getElementById("cx1-log-list");
  const countEl = document.getElementById("cx1-log-count");

  if (countEl) countEl.textContent = phienCX1.length + " mã";
  if (!container) return;
  if (phienCX1.length === 0) {
    container.innerHTML = '<div style="color:var(--cream-soft); font-size:12px; text-align:center; padding:8px 0;">Chưa có mã nào được quét</div>';
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

    return `<div class="${flashClass}" style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid var(--line-soft); font-size:12px; border-radius:6px;">
      <span style="color:var(--steel); font-weight:700; width:26px;">${dot}</span>
      <span style="color:var(--brass); font-weight:800; flex:1; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.qc || item.msp || '—'}</span>
      <span style="color:var(--cream-soft); font-size:11px; width:20px; text-align:center;">${item.seqTrongDot}</span>
      <span style="color:var(--success); font-weight:700; width:45px; text-align:center;">${item.kg || 0}</span>
      <span style="color:var(--cream-soft); font-size:11px; width:50px; text-align:right;">${gio}</span>
      <button class="cx5-del-btn" onclick="xoaMaCX1(${originalIndex}, event)" title="Xóa mã này" style="margin-left:4px; background:none; border:none; color:var(--red); cursor:pointer; padding:2px 4px;">
        <i class="ti ti-trash"></i>
      </button>
    </div>`;
  }).join("");

  if (phienCX1.length > MAX_LIVE_LOG) {
    const conLai = phienCX1.length - MAX_LIVE_LOG;
    html += `<div style="text-align:center; padding:6px 0; font-size:11px; color:var(--cream-soft); font-style:italic;">... và ${conLai} mã trước đó (xem đầy đủ ở bảng kết quả)</div>`;
  }

  container.innerHTML = html;
}

function taoHangKetQuaCX1(danhSach) {
  let tongDotCuaPhien = {};
  let tongGomLoaiMa = {};
  let tongQRAll = 0;
  let tongKGAll = 0;

  danhSach.forEach(r => {
    tongQRAll += 1;
    tongKGAll += r.kg;

    const keyDot = r.dotQuet + "|" + r.msp;
    if (!tongDotCuaPhien[keyDot]) {
      tongDotCuaPhien[keyDot] = { dot: r.dotQuet, msp: r.msp, qc: r.qc, soLuong: 0, tongKG: 0 };
    } else {
      if (r.qc && (!tongDotCuaPhien[keyDot].qc || r.qc.length < tongDotCuaPhien[keyDot].qc.length)) {
        tongDotCuaPhien[keyDot].qc = r.qc;
      }
    }
    tongDotCuaPhien[keyDot].soLuong += 1;
    tongDotCuaPhien[keyDot].tongKG += r.kg;

    const keyGom = r.msp;
    if (!tongGomLoaiMa[keyGom]) {
      tongGomLoaiMa[keyGom] = { msp: r.msp, qc: r.qc, soLuong: 0, tongKG: 0 };
    } else {
      if (r.qc && (!tongGomLoaiMa[keyGom].qc || r.qc.length < tongGomLoaiMa[keyGom].qc.length)) {
        tongGomLoaiMa[keyGom].qc = r.qc;
      }
    }
    tongGomLoaiMa[keyGom].soLuong += 1;
    tongGomLoaiMa[keyGom].tongKG += r.kg;
  });

  let hangDot = "";
  Object.values(tongDotCuaPhien).forEach(item => {
    hangDot += `
  <tr>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);color:var(--brass);font-weight:700"> ${item.dot}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft)">${item.qc}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);text-align:center">${item.soLuong}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);text-align:right;font-weight:700;color:var(--success)">${item.tongKG.toFixed(1)}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);text-align:center;white-space:nowrap;">
      <button onclick="nhapTayCX1(${item.dot}, '${item.msp}', '${item.qc}')" style="background:none;border:none;color:var(--blue);cursor:pointer;padding:2px 4px;margin:0;" title="Sửa KG">
        <i class="ti ti-pencil" style="font-size:16px;"></i>
      </button>
      <button onclick="xoaNhomDotCX1(${item.dot}, '${item.msp}', '${item.qc}')" style="background:none;border:none;color:var(--red);cursor:pointer;padding:2px 4px;margin:0;" title="Xóa đợt này">
        <i class="ti ti-trash" style="font-size:16px;"></i>
      </button>
    </td>
  </tr>`;
  });
  hangDot += `
  <tr>
    <td style="padding:10px;font-weight:700;color:var(--brass);background:var(--card-raised)">TỔNG</td>
    <td style="padding:10px;background:var(--card-raised)"></td>
    <td style="padding:10px;text-align:center;font-weight:700;color:var(--brass);background:var(--card-raised)">${tongQRAll}</td>
    <td style="padding:10px;text-align:right;font-weight:700;color:var(--brass);background:var(--card-raised)">${tongKGAll.toFixed(1)}</td>
    <td style="padding:10px;background:var(--card-raised)"></td>
  </tr>`;

  let hangGom = "";
  Object.values(tongGomLoaiMa).forEach(item => {
    hangGom += `
  <tr>

    <td style="padding:10px;border-bottom:1px solid var(--line-soft)">${item.qc}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);text-align:center;font-weight:700">${item.soLuong}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);text-align:right;font-weight:700;color:var(--success)">${item.tongKG.toFixed(1)}</td>
  </tr>`;
  });
  hangGom += `
  <tr>
    <td colspan="1" style="padding:10px;font-weight:700;color:var(--steel);background:var(--card-raised)">TỔNG</td>
    <td style="padding:10px;text-align:center;font-weight:700;color:var(--steel);background:var(--card-raised)">${tongQRAll}</td>
    <td style="padding:10px;text-align:right;font-weight:700;color:var(--steel);background:var(--card-raised)">${tongKGAll.toFixed(1)}</td>
  </tr>`;

  return { hangDot, hangGom };
}

function hienKetQuaCX1() {
  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(false); else document.body.classList.remove("cam-active");
  const { hangDot, hangGom } = taoHangKetQuaCX1(phienCX1);
  document.getElementById("cx1-tbody-dot").innerHTML = hangDot;
  document.getElementById("cx1-tbody-gom").innerHTML = hangGom;

  document.getElementById("cx1-cam").style.display = "none";
  document.getElementById("cx1-ketqua").style.display = "block";
}

async function quetTiepCX1() {
  // Giữ nguyên dữ liệu cũ, mở camera quét tiếp
  const coDuLieu = phienCX1.some(r => r.dotQuet === demSoDot);
  if (coDuLieu) {
    demSoDot += 1;
  }
  dangQuetCX1 = true;
  denPinBat = false;

  document.getElementById("cx1-ketqua").style.display = "none";
  document.getElementById("cx1-cam").style.display = "block";
  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(true); else document.body.classList.add("cam-active");
  document.getElementById("cx1-status").textContent = "Đang quét Đợt " + demSoDot + "...";

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
      cx1Vid.play().catch(() => {});
    }
  } catch(e) {
    if (typeof showCanhBaoCX1 === "function") showCanhBaoCX1("Lỗi camera: " + e, "error");
    dungCX1();
  }
}

function quetMoiCX1() {
  phienCX1 = [];
  demSoDot = 0;
  idPhienHienTai = null;
  soLuongDaGuiHienTai = 0;
  xoaPhienDoDangCX1();
  document.getElementById("cx1-ketqua").style.display = "none";
  document.getElementById("cx1-form").style.display = "block";
  capNhatLogCX1();
}

let timerCanhBaoCX1 = null;
function showCanhBaoCX1(text, type = "error") {
  const el = document.getElementById("canh-bao");
  if (!el) return;
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
  dangQuetCX1 = true;
  denPinBat = false;

  if (typeof khoaCuonTrangQuet === "function") khoaCuonTrangQuet(true); else document.body.classList.add("cam-active");
  document.getElementById("cx1-form").style.display = "none";
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
      cx1Vid.play().catch(() => {});
    }
  } catch (e) {
    if (typeof showCanhBaoCX1 === "function") showCanhBaoCX1("Lỗi camera: " + e, "error");
    dungCX1();
  }
}

function tiepTucPhienChiFor() {
  let state = null;
  try { state = JSON.parse(localStorage.getItem("cx1_phien_dodang")); } catch (e) {}
  if (!state) return;
  if (typeof diToiTab === "function") diToiTab("chiFor");
  khoiPhucCX1(state);
}

function huyPhienChiFor() {
  xoaPhienDoDangCX1();
  if (typeof capNhatTrangChu === "function") capNhatTrangChu();
}

window.addEventListener("load", function() {
  const today = new Date().toISOString().split("T")[0];
  const ngayInput = document.getElementById("cx1-ngay");
  if (ngayInput) ngayInput.value = today;
});

window.addEventListener("load", async function() {
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

window.addEventListener("online", async function() {
  const pending = docPendingCX1();
  if (pending.length === 0) return;
  try {
    await guiLenSheetCX1(pending);
    luuPendingCX1([]);
  } catch (e) {}
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

// ── Lịch sử Chỉ For (lưu 3 ngày gần nhất, xem lại + tiếp tục quét) ─────
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
  try { localStorage.setItem(CX1_LICHSU_KEY, JSON.stringify(list)); } catch (e) {}
}

function donDepLichSuCX1() {
  luuLichSuCX1(docLichSuCX1());
}

function luuVaoLichSuCX1() {
  if (phienCX1.length === 0 || !idPhienHienTai) return;
  const list = docLichSuCX1();
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
    const tongKg = s.phienCX1.reduce(function (t, r) { return t + (r.kg || 0); }, 0);
    const soDot = new Set(s.phienCX1.map(r => r.dotQuet || 1)).size;
    const daXongHet = (s.soLuongDaGui || 0) >= s.phienCX1.length && s.phienCX1.length > 0;
    const trangThai = daXongHet
      ? '<i class="ti ti-check cx5-trangthai-ok"></i>'
      : '<i class="ti ti-x cx5-trangthai-mot-phan"></i>';
    const gio = new Date(s.capNhatLuc).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

    return '<div class="irow lichsu-row" style="cursor:pointer;align-items:center" onclick="xemChiTietLichSuCX1(\'' + s.idPhien + '\')">'
      + '<span style="font-family:\'IBM Plex Sans\',sans-serif;color:var(--cream)">' + s.ngay + ' · ' + gio + '</span>'
      + '<span style="font-family:\'IBM Plex Sans\',sans-serif;color:var(--cream);display:inline-flex;align-items:center;gap:10px">'
      + soDot + ' đợt · ' + s.phienCX1.length + ' mã · ' + tongKg.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kg'
      + '<span style="display:inline-flex;align-items:center;gap:8px;padding-left:8px;border-left:1px solid var(--line)">'
      + trangThai
      + '<button class="cx5-del-btn" aria-label="Xóa phiên này" onclick="xoaMotPhienLichSuCX1(\'' + s.idPhien + '\', event)"><i class="ti ti-trash"></i></button>'
      + '</span>'
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
  const { hangDot, hangGom } = taoHangKetQuaCX1(entry.phienCX1);
  document.getElementById("lichsu-tbody-dot").innerHTML = hangDot;
  document.getElementById("lichsu-tbody-gom").innerHTML = hangGom;
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
