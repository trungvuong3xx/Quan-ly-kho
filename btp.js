// ── Quản lý BTP (Bán Thành Phẩm) ──────────────────────────
let zxingReaderBTP = null;
let dangQuetBTP = false;
let phienBTP = []; 
let demSoDotBTP = 0;   
let denPinBatBTP = false;
let ngayBTP = null;

let idPhienHienTaiBTP = null;
let soLuongDaGuiHienTaiBTP = 0;

const BTP_LICHSU_KEY = "btp_lich_su";
const BTP_LICHSU_SO_NGAY_GIU = 3;
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

let dangKhoaQuetBTP = false;

function khiQuetDuocMaBTP(result) {
  if (!result || !dangQuetBTP || dangKhoaQuetBTP) return;
  const rawText = typeof result.getText === "function" ? result.getText() : String(result);
  const data = xuLyDuLieuQRBTP(rawText);
  if (!data || !data.rawQR) return;

  // Khóa quét trong 2 giây
  dangKhoaQuetBTP = true;

  if (typeof window.phatTiengBip === "function") window.phatTiengBip();
  else if (typeof phatTiengBip === "function") phatTiengBip();

  if (typeof window.phatVibrateSuccess === "function") window.phatVibrateSuccess();

  phienBTP.push({ 
    rawQR: data.rawQR,
    id: data.rawQR,
    msp: data.msp,
    qc: data.qc, 
    kg: data.kg,
    thoiGian: new Date(),
    dotQuet: demSoDotBTP 
  });

  const demEl = document.getElementById("btp-dem");
  if (demEl) demEl.textContent = "Đã quét: " + phienBTP.length + " mã";
  luuPhienDoDangBTP();

  const statusEl = document.getElementById("btp-status");
  if (statusEl) statusEl.textContent = "⏳ Chờ 2s...";

  setTimeout(() => {
    dangKhoaQuetBTP = false;
    if (dangQuetBTP) {
      const sEl = document.getElementById("btp-status");
      if (sEl) sEl.textContent = "🟢 Đang quét...";
    }
  }, 2000);
}

function luuPhienDoDangBTP() {
  try {
    localStorage.setItem(BTP_DODANG_KEY, JSON.stringify({
      phienBTP, ngayBTP, capNhat: new Date().toISOString(),
      idPhienHienTaiBTP, soLuongDaGuiHienTaiBTP
    }));
  } catch (e) {}
}

function xoaPhienDoDangBTP() {
  try { localStorage.removeItem(BTP_DODANG_KEY); } catch (e) {}
}

async function batDauBTP() {
  const ngayEl = document.getElementById("btp-ngay");
  ngayBTP = ngayEl ? ngayEl.value : new Date().toISOString().split("T")[0];
  if (!ngayBTP) { alert("Vui lòng chọn ngày!"); return; }

  let phienCu = null;
  try { phienCu = JSON.parse(localStorage.getItem(BTP_DODANG_KEY)); } catch (e) {}
  if (phienCu && Array.isArray(phienCu.phienBTP) && phienCu.phienBTP.length > 0) {
    const tiepTuc = confirm(
      "Bạn đang có phiên BTP dở dang (" + phienCu.phienBTP.length + " mã, ngày " + phienCu.ngayBTP + ").\n" +
      "Bấm OK để tiếp tục phiên đó, hoặc Cancel để xoá và bắt đầu phiên mới."
    );
    if (tiepTuc) { khoiPhucBTP(phienCu); return; }
    xoaPhienDoDangBTP();
  }

  phienBTP = [];
  dangQuetBTP = true;
  denPinBatBTP = false;
  idPhienHienTaiBTP = Date.now() + "-" + Math.random().toString(36).slice(2);
  soLuongDaGuiHienTaiBTP = 0;

  document.getElementById("btp-form").style.display = "none";
  document.getElementById("btp-cam").style.display = "block";
  document.getElementById("btp-ketqua").style.display = "none";
  document.getElementById("btp-dem").textContent = "Đã quét: 0 mã";
  document.getElementById("btp-status").textContent = "🟢 Đang quét...";
  
  const btnFlash = document.getElementById("btn-flash-btp");
  if (btnFlash) {
    btnFlash.style.background = "var(--neutral)";
    btnFlash.style.color = "var(--cream)";
    btnFlash.textContent = "Bật đèn pin";
  }

  const btnToggle = document.getElementById("btn-dung-tieptuc-btp");
  if (btnToggle) {
    btnToggle.textContent = "Dừng quét";
    btnToggle.className = "btn btn-red btn-full";
  }

  try {
    zxingReaderBTP = await khoiTaoCameraFast("btp-reader", (txt) => {
      if (txt && dangQuetBTP) {
        khiQuetDuocMaBTP({ getText: () => txt });
      }
    });
  } catch(e) {
    alert("Lỗi camera: " + e);
    dungBTP();
  }
}

function dungBTP() {
  dangQuetBTP = false;
  if (typeof dungCameraFast === "function" && zxingReaderBTP) {
    dungCameraFast("btp-reader", zxingReaderBTP);
  }
  zxingReaderBTP = null;
  const statusEl = document.getElementById("btp-status");
  if (statusEl) statusEl.textContent = "🔴 Đã dừng quét";
}

async function tiepTucBTP() {
  dangQuetBTP = true;
  denPinBatBTP = false;
  document.getElementById("btp-status").textContent = "🟢 Đang quét...";
  const btnFlash = document.getElementById("btn-flash-btp");
  if (btnFlash) {
    btnFlash.style.background = "var(--neutral)";
    btnFlash.style.color = "var(--cream)";
    btnFlash.textContent = "Bật đèn pin";
  }
  try {
    zxingReaderBTP = await khoiTaoCameraFast("btp-reader", (txt) => {
      if (txt && dangQuetBTP) {
        khiQuetDuocMaBTP({ getText: () => txt });
      }
    });
  } catch(e) {
    alert("Lỗi camera: " + e);
    dungBTP();
  }
}

function toggleDungTiepTucBTP() {
  const btn = document.getElementById("btn-dung-tieptuc-btp");
  if (!btn) return;
  if (dangQuetBTP) {
    dungBTP();
    btn.textContent = "Quét tiếp";
    btn.className = "btn btn-blue btn-full";
  } else {
    tiepTucBTP();
    btn.textContent = "Dừng quét";
    btn.className = "btn btn-red btn-full";
  }
}

async function toggleFlashBTP() {
  if (!zxingReaderBTP || !dangQuetBTP) return;
  try {
    const stream = document.getElementById("btp-reader").srcObject;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    if (!capabilities.torch) { alert("Thiết bị không hỗ trợ đèn pin."); return; }
    denPinBatBTP = !denPinBatBTP;
    await track.applyConstraints({ advanced: [{ torch: denPinBatBTP }] });
    const btnFlash = document.getElementById("btn-flash-btp");
    if (btnFlash) {
      btnFlash.style.background = denPinBatBTP ? "var(--brass)" : "var(--neutral)";
      btnFlash.style.color = denPinBatBTP ? "var(--bg)" : "var(--cream)";
      btnFlash.textContent = denPinBatBTP ? "Tắt đèn" : "Bật đèn";
    }
  } catch (err) {}
}

function docPendingBTP() {
  try {
    const raw = localStorage.getItem(BTP_PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function luuPendingBTP(list) {
  try { localStorage.setItem(BTP_PENDING_KEY, JSON.stringify(list)); } catch (e) {}
}

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

async function ketThucBTP() {
  dungBTP();
  xoaPhienDoDangBTP();

  hienKetQuaBTP();

  const moiBoSung = phienBTP.slice(soLuongDaGuiHienTaiBTP);
  if (moiBoSung.length > 0) {
    const rows = moiBoSung.map(r => ({
      rawQR: r.rawQR,
      id: r.rawQR,
      msp: r.msp,
      qc: r.qc,
      kg: r.kg,
      ngay: ngayBTP,
      thoiGian: r.thoiGian.toISOString()
    }));
    try {
      await guiLenSheetBTP(rows);
      soLuongDaGuiHienTaiBTP = phienBTP.length;
    } catch (err) {
      const pending = docPendingBTP();
      pending.push(...rows);
      luuPendingBTP(pending);
      showCanhBaoBTP("Mất mạng — đã lưu tạm trên máy, sẽ tự gửi lại sau");
      soLuongDaGuiHienTaiBTP = phienBTP.length;
    }
    if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
  }

  luuVaoLichSuBTP();
}

function taoHangKetQuaBTP(danhSach) {
  let tongGomLoaiMa = {};
  let tongQRAll = danhSach.length;
  let tongKGAll = 0;

  let hangDot = "";
  danhSach.forEach((r, idx) => {
    tongKGAll += r.kg;

    hangDot += `
  <tr>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);color:var(--steel);font-weight:700">${idx + 1}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);font-weight:600">${r.msp}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);text-align:right;font-weight:700;color:var(--success)">${r.kg.toFixed(1)}</td>
  </tr>`;

    const keyGom = r.msp;
    if (!tongGomLoaiMa[keyGom]) {
      tongGomLoaiMa[keyGom] = { msp: r.msp, soLuong: 0, tongKG: 0 };
    }
    tongGomLoaiMa[keyGom].soLuong += 1;
    tongGomLoaiMa[keyGom].tongKG += r.kg;
  });

  hangDot += `
  <tr>
    <td style="padding:10px;font-weight:700;color:var(--brass);background:var(--card-raised)">TỔNG</td>
    <td style="padding:10px;background:var(--card-raised);font-weight:700;color:var(--brass)">${tongQRAll} mã</td>
    <td style="padding:10px;text-align:right;font-weight:700;color:var(--brass);background:var(--card-raised)">${tongKGAll.toFixed(1)}</td>
  </tr>`;

  let hangGom = "";
  Object.values(tongGomLoaiMa).forEach(item => {
    hangGom += `
  <tr>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);font-weight:600">${item.msp}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);text-align:center;font-weight:700">${item.soLuong}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);text-align:right;font-weight:700;color:var(--success)">${item.tongKG.toFixed(1)}</td>
  </tr>`;
  });
  hangGom += `
  <tr>
    <td style="padding:10px;font-weight:700;color:var(--steel);background:var(--card-raised)">TỔNG</td>
    <td style="padding:10px;text-align:center;font-weight:700;color:var(--steel);background:var(--card-raised)">${tongQRAll}</td>
    <td style="padding:10px;text-align:right;font-weight:700;color:var(--steel);background:var(--card-raised)">${tongKGAll.toFixed(1)}</td>
  </tr>`;

  return { hangDot, hangGom };
}

function hienKetQuaBTP() {
  const { hangDot, hangGom } = taoHangKetQuaBTP(phienBTP);
  document.getElementById("btp-tbody-dot").innerHTML = hangDot;
  document.getElementById("btp-tbody-gom").innerHTML = hangGom;

  document.getElementById("btp-cam").style.display = "none";
  document.getElementById("btp-ketqua").style.display = "block";
}

async function quetTiepBTP() {
  dangQuetBTP = true;
  denPinBatBTP = false;

  document.getElementById("btp-ketqua").style.display = "none";
  document.getElementById("btp-cam").style.display = "block";
  document.getElementById("btp-status").textContent = "🟢 Đang quét...";

  const btnToggle = document.getElementById("btn-dung-tieptuc-btp");
  if (btnToggle) {
    btnToggle.textContent = "Dừng quét";
    btnToggle.className = "btn btn-red btn-full";
  }

  try {
    zxingReaderBTP = await khoiTaoCameraFast("btp-reader", (txt) => {
      if (txt && dangQuetBTP) {
        khiQuetDuocMaBTP({ getText: () => txt });
      }
    });
  } catch(e) {
    alert("Lỗi camera: " + e);
    dungBTP();
  }
}

function quetMoiBTP() {
  phienBTP = [];
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
  phienBTP = state.phienBTP.map(r => ({ ...r, thoiGian: new Date(r.thoiGian) }));
  demSoDotBTP = state.demSoDotBTP || 1;
  ngayBTP = state.ngayBTP;
  idPhienHienTaiBTP = state.idPhienHienTaiBTP || (Date.now() + "-" + Math.random().toString(36).slice(2));
  soLuongDaGuiHienTaiBTP = state.soLuongDaGuiHienTaiBTP !== undefined ? state.soLuongDaGuiHienTaiBTP : 0;
  dangQuetBTP = true;
  denPinBatBTP = false;

  document.getElementById("btp-form").style.display = "none";
  document.getElementById("btp-cam").style.display = "block";
  document.getElementById("btp-ketqua").style.display = "none";
  document.getElementById("btp-dem").textContent = "Đã quét: " + phienBTP.length + " mã";
  document.getElementById("btp-status").textContent = "Đang quét Đợt " + demSoDotBTP + "...";

  const btnFlash = document.getElementById("btn-flash-btp");
  if (btnFlash) {
    btnFlash.style.background = "var(--neutral)";
    btnFlash.style.color = "var(--cream)";
    btnFlash.textContent = "Bật đèn pin";
  }

  const btnToggle = document.getElementById("btn-dung-tieptuc-btp");
  if (btnToggle) {
    btnToggle.textContent = "Dừng quét";
    btnToggle.className = "btn btn-red btn-full";
  }

  try {
    zxingReaderBTP = await khoiTaoCameraFast("btp-reader", (txt) => {
      if (txt && dangQuetBTP) {
        khiQuetDuocMaBTP({ getText: () => txt });
      }
    });
  } catch (e) {
    alert("Lỗi camera: " + e);
    dungBTP();
  }
}

function tiepTucPhienBTP() {
  let state = null;
  try { state = JSON.parse(localStorage.getItem(BTP_DODANG_KEY)); } catch (e) {}
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
  try { localStorage.setItem(BTP_LICHSU_KEY, JSON.stringify(list)); } catch (e) {}
}

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
  const list = docLichSuBTP().slice().sort((a, b) => new Date(b.capNhatLuc) - new Date(a.capNhatLuc));

  if (list.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--cream-soft);padding:20px 0;">Chưa có phiên BTP nào trong ' + BTP_LICHSU_SO_NGAY_GIU + ' ngày qua</div>';
    return;
  }

  container.innerHTML = list.map(function (s) {
    const tongKg = s.phienBTP.reduce(function (t, r) { return t + r.kg; }, 0).toFixed(1);
    const gio = new Date(s.capNhatLuc).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return '<div class="irow" style="cursor:pointer" onclick="xemChiTietLichSuBTP(\'' + s.idPhien + '\')">'
      + '<span class="ilabel">' + s.ngay + ' · ' + gio + '</span>'
      + '<span class="ivalue">' + s.phienBTP.length + ' mã · ' + tongKg + ' sl</span>'
      + '</div>';
  }).join("");
}
window.renderLichSuBTP = renderLichSuBTP;

function xuatCSVBTP() {
  if (phienBTP.length === 0) { alert("Chưa có dữ liệu để xuất"); return; }
  const header = ["Dot", "Mã QR Gốc", "Mã BTP", "Số Lượng", "Thời Gian"];
  const rows = phienBTP.map(r => [r.dotQuet, r.rawQR, r.msp, r.kg, r.thoiGian.toISOString()]);
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
    "Đợt": r.dotQuet,
    "Mã QR Gốc": r.rawQR,
    "Mã BTP": r.msp,
    "Số lượng": r.kg,
    "Thời gian": new Date(r.thoiGian).toLocaleTimeString("vi-VN")
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "BTP");
  XLSX.writeFile(wb, "Quet_BTP_" + ngay + ".xlsx");
}

window.addEventListener("load", function() {
  const today = new Date().toISOString().split("T")[0];
  const ngayInput = document.getElementById("btp-ngay");
  if (ngayInput) ngayInput.value = today;
});

window.addEventListener("load", async function() {
  const pending = docPendingBTP();
  if (pending.length === 0) return;
  try {
    await guiLenSheetBTP(pending);
    luuPendingBTP([]);
  } catch (e) {}
  if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
});

window.addEventListener("online", async function() {
  const pending = docPendingBTP();
  if (pending.length === 0) return;
  try {
    await guiLenSheetBTP(pending);
    luuPendingBTP([]);
  } catch (e) {}
  if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
});
