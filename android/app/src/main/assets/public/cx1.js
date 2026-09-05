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
  try {
    const stream = document.getElementById("cx1-reader").srcObject;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    if (!capabilities.torch) { showCanhBaoCX1("Thiết bị không hỗ trợ đèn pin."); return; }
    denPinBat = !denPinBat;
    await track.applyConstraints({ advanced: [{ torch: denPinBat }] });
    const btnFlash = document.getElementById("btn-flash-cx1");
    btnFlash.style.background = denPinBat ? "var(--brass)" : "var(--neutral)";
    btnFlash.style.color = denPinBat ? "var(--bg)" : "var(--cream)";
    btnFlash.textContent = denPinBat ? "Tắt đèn" : "Bật đèn";
  } catch (err) {}
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

function khiQuetDuocMa(result) {
  if (!result || !dangQuetCX1) return;
  const data = xuLyDuLieuQR(result.getText());
  if (!data) return;
  const trung = phienCX1.find(r => r.id === data.id && r.kg === data.kg);
  if (trung) {
    const now = Date.now();
    if (now - lanCanhBaoCuoi > 1500) {
      showCanhBaoCX1("Mã " + data.id + " + KG " + data.kg + " đã quét rồi");
      lanCanhBaoCuoi = now;
    }
    if (typeof phatVibrateError === "function") phatVibrateError();
    else if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    const vc = document.querySelector("#cx1-cam .video-container");
    if (vc) {
      vc.classList.add("canh-bao-trung");
      setTimeout(() => vc.classList.remove("canh-bao-trung"), 500);
    }
    return;
  }
  phatTiengBip();
  if (typeof phatVibrateSuccess === "function") phatVibrateSuccess();
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
        "Bạn đang có phiên Chỉ For dở dang (" + phienCu.phienCX1.length + " mã, ngày " + phienCu.ngayCX1 + ").<br>Bạn muốn tiếp tục phiên đó hay bắt đầu phiên mới?",
        () => { khoiPhucCX1(phienCu); },
        "Tiếp tục",
        () => { xoaPhienDoDangCX1(); tiepTucKhoiTaoCX1(); },
        "Bắt đầu mới",
        "Phiên dở dang"
      );
      return;
    } else {
      const tiepTuc = confirm(
        "Bạn đang có phiên Chỉ For dở dang (" + phienCu.phienCX1.length + " mã, ngày " + phienCu.ngayCX1 + ").\n" +
        "Bấm OK để tiếp tục phiên đó, hoặc Cancel để xoá và bắt đầu phiên mới."
      );
      if (tiepTuc) { khoiPhucCX1(phienCu); return; }
      xoaPhienDoDangCX1();
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

  document.body.classList.add("cam-active");
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

async function ketThucCX1() {
  dungCX1();
  
  // Lưu lịch sử NGAY LẬP TỨC để tránh mất dữ liệu nếu user thoát web hoặc chuyển trang giữa chừng
  luuVaoLichSuCX1();
  // Xóa khỏi danh sách dở dang sau khi đã đưa vào lịch sử an toàn
  xoaPhienDoDangCX1();

  // Hiện kết quả NGAY, lưu sheet chạy ngầm
  hienKetQuaCX1();

  // Chỉ gửi phần mã MỚI thêm kể từ lần gửi trước (tránh gửi trùng khi "tiếp tục" 1 phiên cũ)
  const moiBoSung = phienCX1.slice(soLuongDaGuiHienTai);
  if (moiBoSung.length > 0) {
    const rows = moiBoSung.map(r => ({
      id: r.id, msp: r.msp, qc: r.qc, kg: r.kg,
      ngay: ngayCX1,
      thoiGian: r.thoiGian.toISOString()
    }));
    try {
      await guiLenSheetCX1(rows);
      soLuongDaGuiHienTai = phienCX1.length;
      
      // Cập nhật lại lịch sử với số lượng đã gửi mới lên Google Sheet
      luuVaoLichSuCX1();
    } catch (err) {
      const pending = docPendingCX1();
      pending.push(...rows);
      luuPendingCX1(pending);
      showCanhBaoCX1("Mất mạng — đã lưu tạm trên máy, sẽ tự gửi lại sau");
      // Coi như đã "xử lý" phần này để không gửi trùng lần sau — phần chưa gửi
      // thật sự vẫn nằm an toàn trong hàng đợi pending, sẽ tự gửi khi có mạng
      soLuongDaGuiHienTai = phienCX1.length;
      
      // Cập nhật lại lịch sử
      luuVaoLichSuCX1();
    }
    if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
  }
}

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
  } else {
    if (confirm("Xóa tất cả mã của quy cách này trong đợt " + cx1DangSuaDot + "?")) {
      phienCX1 = phienCX1.filter(r => !(r.dotQuet === cx1DangSuaDot && r.msp === cx1DangSuaMsp));
      luuPhienDoDangCX1();
      hienKetQuaCX1();
      renderSuaChiTietCX1();
      capNhatLogCX1();
      const demEl = document.getElementById("cx1-dem");
      if (demEl) demEl.textContent = "Đã quét: " + phienCX1.length + " mã";
    }
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
    if (confirm("Xóa mã " + tenMa + " khỏi phiên quét?")) {
      doXoa();
    }
  }
}
window.xoaMaCX1 = xoaMaCX1;

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

  const newestFirst = phienCX1.slice().reverse();
  container.innerHTML = newestFirst.map((item, idx) => {
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

    <td style="padding:10px;border-bottom:1px solid var(--line-soft)">
      ${item.qc}
    </td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);text-align:center">${item.soLuong}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);text-align:right;font-weight:700;color:var(--success)">
      ${item.tongKG.toFixed(1)}
      <button onclick="nhapTayCX1(${item.dot}, '${item.msp}', '${item.qc}')" style="background:none;border:none;color:var(--blue);cursor:pointer;padding:0 0 0 8px;margin:0;" title="Nhập tay KG">
        <i class="ti ti-pencil"></i>
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
  document.body.classList.remove("cam-active");
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
  document.body.classList.add("cam-active");
  document.getElementById("cx1-status").textContent = "Đang quét Đợt " + demSoDot + "...";

  const btnToggle = document.getElementById("btn-dung-tieptuc-cx1");
  btnToggle.textContent = "Dừng quét";
  btnToggle.className = "btn btn-red btn-full";

  try {
    const cx1Vid = document.getElementById("cx1-reader");
    const cx1Track = cx1Vid && cx1Vid.srcObject ? cx1Vid.srcObject.getVideoTracks()[0] : null;
    const isCamRunningCX1 = cx1Track && cx1Track.readyState === 'live';
    if (!zxingReaderCX1 || !isCamRunningCX1) {
      zxingReaderCX1 = await khoiTaoCameraFast("cx1-reader", (txt) => {
        if (txt && dangQuetCX1) {
          khiQuetDuocMa({ getText: () => txt });
        }
      });
    } else if (cx1Vid && cx1Vid.paused) {
      cx1Vid.play().catch(() => {});
    }
  } catch(e) {
    alert("Lỗi camera: " + e);
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

function showCanhBaoCX1(text) {
  const el = document.getElementById("canh-bao");
  el.textContent = text;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 2000);
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

  document.body.classList.add("cam-active");
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
      zxingReaderCX1 = await khoiTaoCameraFast("cx1-reader", (txt) => {
        if (txt && dangQuetCX1) {
          khiQuetDuocMa({ getText: () => txt });
        }
      });
    } else if (cx1Vid && cx1Vid.paused) {
      cx1Vid.play().catch(() => {});
    }
  } catch (e) {
    alert("Lỗi camera: " + e);
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
  const list = docLichSuCX1().slice().sort((a, b) => new Date(b.capNhatLuc) - new Date(a.capNhatLuc));

  if (list.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--cream-soft);padding:20px 0;">Chưa có phiên nào trong ' + CX1_LICHSU_SO_NGAY_GIU + ' ngày qua</div>';
    return;
  }

  container.innerHTML = list.map(function (s) {
    const tongKg = s.phienCX1.reduce(function (t, r) { return t + r.kg; }, 0).toFixed(1);
    const gio = new Date(s.capNhatLuc).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return '<div class="irow" style="cursor:pointer" onclick="xemChiTietLichSuCX1(\'' + s.idPhien + '\')">'
      + '<span class="ilabel">' + s.ngay + ' · ' + gio + '</span>'
      + '<span class="ivalue">' + s.phienCX1.length + ' mã · ' + tongKg + ' kg</span>'
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

function xuatExcelLichSuCX1(idPhien) {
  const targetId = idPhien || dangXemLichSuId;
  const list = docLichSuCX1();
  const entry = list.find(s => s.idPhien === targetId);
  if (!entry || !entry.phienCX1 || entry.phienCX1.length === 0) {
    showCanhBaoCX1("Chưa có dữ liệu phiên này để xuất Excel!");
    return;
  }
  const dateStr = entry.ngay || new Date().toISOString().split("T")[0];
  const exportData = entry.phienCX1.map((item, idx) => ({
    "STT": idx + 1,
    "Ngày": entry.ngay,
    "Đợt quét": item.dotQuet || 1,
    "Mã ID": item.id,
    "Mã MSP": item.msp,
    "Quy cách": item.qc,
    "Khối lượng (Kg)": item.kg,
    "Thời gian": item.thoiGian ? new Date(item.thoiGian).toLocaleTimeString("vi-VN") : ""
  }));
  if (typeof exportToExcel === "function") {
    exportToExcel("LichSu_ChiFor_" + dateStr, "Chi For " + dateStr, exportData);
  }
}
window.xuatExcelLichSuCX1 = xuatExcelLichSuCX1;
