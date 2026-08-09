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

const FAST_MP3_BASE64 = "data:audio/mp3;base64,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";

let fastBeepAudio = null;

function phatTiengBip() {
  if (navigator.vibrate) navigator.vibrate(70);
  try {
    if (!fastBeepAudio) {
      fastBeepAudio = new Audio(FAST_MP3_BASE64);
    }
    fastBeepAudio.currentTime = 0;
    fastBeepAudio.play().catch(e => {
      console.warn("Audio play blocked or deferred:", e);
    });
  } catch (e) {
    console.error("Lỗi phatTiengBip:", e);
  }
}
window.phatTiengBip = phatTiengBip;

function phatAmThanhSung(ctx) {
  try {
    const now = ctx.currentTime;
    const thoiLuong = 0.35;

    // Tiếng "crack" chính: white noise, lọc quét từ sáng (crack) xuống đục (đuôi tiếng nổ)
    const soMau = Math.floor(ctx.sampleRate * thoiLuong);
    const bufferOn = ctx.createBuffer(1, soMau, ctx.sampleRate);
    const data = bufferOn.getChannelData(0);
    for (let i = 0; i < soMau; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = bufferOn;

    const locNoise = ctx.createBiquadFilter();
    locNoise.type = "lowpass";
    locNoise.frequency.setValueAtTime(6500, now);
    locNoise.frequency.exponentialRampToValueAtTime(180, now + thoiLuong);

    const gainNoise = ctx.createGain();
    gainNoise.gain.setValueAtTime(1.4, now);
    gainNoise.gain.exponentialRampToValueAtTime(0.001, now + thoiLuong);

    // Lớp "thùm" trầm cho có lực, tắt nhanh hơn tiếng crack
    const thump = ctx.createOscillator();
    thump.type = "triangle";
    thump.frequency.setValueAtTime(120, now);
    thump.frequency.exponentialRampToValueAtTime(40, now + 0.15);

    const gainThump = ctx.createGain();
    gainThump.gain.setValueAtTime(1.2, now);
    gainThump.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    const compressor = ctx.createDynamicsCompressor();

    noise.connect(locNoise);
    locNoise.connect(gainNoise);
    gainNoise.connect(compressor);

    thump.connect(gainThump);
    gainThump.connect(compressor);

    compressor.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + thoiLuong);
    thump.start(now);
    thump.stop(now + 0.2);
  } catch (e) {
    console.error("Lỗi tạo âm thanh súng:", e);
  }
}

async function toggleFlashCX1() {
  if (!zxingReaderCX1 || !dangQuetCX1) return;
  try {
    const stream = document.getElementById("cx1-reader").srcObject;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    if (!capabilities.torch) { alert("Thiết bị không hỗ trợ đèn pin."); return; }
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
  ngayCX1 = document.getElementById("cx1-ngay").value;
  if (!ngayCX1) { alert("Vui lòng chọn ngày!"); return; }

  let phienCu = null;
  try { phienCu = JSON.parse(localStorage.getItem("cx1_phien_dodang")); } catch (e) {}
  if (phienCu && Array.isArray(phienCu.phienCX1) && phienCu.phienCX1.length > 0) {
    const tiepTuc = confirm(
      "Bạn đang có phiên Chỉ For dở dang (" + phienCu.phienCX1.length + " mã, ngày " + phienCu.ngayCX1 + ").\n" +
      "Bấm OK để tiếp tục phiên đó, hoặc Cancel để xoá và bắt đầu phiên mới."
    );
    if (tiepTuc) { khoiPhucCX1(phienCu); return; }
    xoaPhienDoDangCX1();
  }

  phienCX1 = [];
  demSoDot = 1; 
  dangQuetCX1 = true;
  denPinBat = false;
  idPhienHienTai = Date.now() + "-" + Math.random().toString(36).slice(2);
  soLuongDaGuiHienTai = 0;

  document.getElementById("cx1-form").style.display = "none";
  document.getElementById("cx1-cam").style.display = "block";
  document.getElementById("cx1-ketqua").style.display = "none";
  document.getElementById("cx1-dem").textContent = "Đã quét: 0 mã";
  document.getElementById("cx1-status").textContent = "Đang quét Đợt 1...";
  document.getElementById("btn-flash-cx1").style.background = "var(--neutral)";
  document.getElementById("btn-flash-cx1").style.color = "var(--cream)";
  document.getElementById("btn-flash-cx1").textContent = "Bật đèn pin";

  const btnToggle = document.getElementById("btn-dung-tieptuc-cx1");
  btnToggle.textContent = "Dừng quét";
  btnToggle.className = "btn btn-red btn-full";

  try {
    zxingReaderCX1 = await khoiTaoCameraFast("cx1-reader", (txt) => {
      if (txt && dangQuetCX1) {
        khiQuetDuocMa({ getText: () => txt });
      }
    });
  } catch(e) {
    alert("Lỗi camera: " + e);
    dungCX1();
  }
}

function dungCX1() {
  dangQuetCX1 = false;
  dungCameraFast("cx1-reader", zxingReaderCX1);
  zxingReaderCX1 = null;
  document.getElementById("cx1-status").textContent = "Đã dừng Đợt " + demSoDot;
}

async function tiepTucCX1() {
  demSoDot += 1; 
  dangQuetCX1 = true;
  denPinBat = false;
  document.getElementById("cx1-status").textContent = "Đang quét Đợt " + demSoDot + "...";
  document.getElementById("btn-flash-cx1").style.background = "var(--neutral)";
  document.getElementById("btn-flash-cx1").style.color = "var(--cream)";
  document.getElementById("btn-flash-cx1").textContent = "Bật đèn pin";
  try {
    zxingReaderCX1 = await khoiTaoCameraFast("cx1-reader", (txt) => {
      if (txt && dangQuetCX1) {
        khiQuetDuocMa({ getText: () => txt });
      }
    });
  } catch(e) {
    alert("Lỗi camera: " + e);
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
    } catch (err) {
      const pending = docPendingCX1();
      pending.push(...rows);
      luuPendingCX1(pending);
      showCanhBaoCX1("Mất mạng — đã lưu tạm trên máy, sẽ tự gửi lại sau");
      // Coi như đã "xử lý" phần này để không gửi trùng lần sau — phần chưa gửi
      // thật sự vẫn nằm an toàn trong hàng đợi pending, sẽ tự gửi khi có mạng
      soLuongDaGuiHienTai = phienCX1.length;
    }
    if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
  }

  luuVaoLichSuCX1();
}

function taoHangKetQuaCX1(danhSach) {
  let tongDotCuaPhien = {};
  let tongGomLoaiMa = {};
  let tongQRAll = 0;
  let tongKGAll = 0;

  danhSach.forEach(r => {
    tongQRAll += 1;
    tongKGAll += r.kg;

    const keyDot = r.dotQuet + "|" + r.msp + "|" + r.qc;
    if (!tongDotCuaPhien[keyDot]) {
      tongDotCuaPhien[keyDot] = { dot: r.dotQuet, msp: r.msp, qc: r.qc, soLuong: 0, tongKG: 0 };
    }
    tongDotCuaPhien[keyDot].soLuong += 1;
    tongDotCuaPhien[keyDot].tongKG += r.kg;

    const keyGom = r.msp + "|" + r.qc;
    if (!tongGomLoaiMa[keyGom]) {
      tongGomLoaiMa[keyGom] = { msp: r.msp, qc: r.qc, soLuong: 0, tongKG: 0 };
    }
    tongGomLoaiMa[keyGom].soLuong += 1;
    tongGomLoaiMa[keyGom].tongKG += r.kg;
  });

  let hangDot = "";
  Object.values(tongDotCuaPhien).forEach(item => {
    hangDot += `
  <tr>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);color:var(--brass);font-weight:700"> ${item.dot}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft)">${item.msp}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft)">${item.qc}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);text-align:center">${item.soLuong}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);text-align:right;font-weight:700;color:var(--success)">${item.tongKG.toFixed(1)}</td>
  </tr>`;
  });
  hangDot += `
  <tr>
    <td style="padding:10px;font-weight:700;color:var(--brass);background:var(--card-raised)">TỔNG</td>
    <td style="padding:10px;background:var(--card-raised)"></td>
    <td style="padding:10px;background:var(--card-raised)"></td>
    <td style="padding:10px;text-align:center;font-weight:700;color:var(--brass);background:var(--card-raised)">${tongQRAll}</td>
    <td style="padding:10px;text-align:right;font-weight:700;color:var(--brass);background:var(--card-raised)">${tongKGAll.toFixed(1)}</td>
  </tr>`;

  let hangGom = "";
  Object.values(tongGomLoaiMa).forEach(item => {
    hangGom += `
  <tr>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft)">${item.msp}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft)">${item.qc}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);text-align:center;font-weight:700">${item.soLuong}</td>
    <td style="padding:10px;border-bottom:1px solid var(--line-soft);text-align:right;font-weight:700;color:var(--success)">${item.tongKG.toFixed(1)}</td>
  </tr>`;
  });
  hangGom += `
  <tr>
    <td colspan="2" style="padding:10px;font-weight:700;color:var(--steel);background:var(--card-raised)">TỔNG</td>
    <td style="padding:10px;text-align:center;font-weight:700;color:var(--steel);background:var(--card-raised)">${tongQRAll}</td>
    <td style="padding:10px;text-align:right;font-weight:700;color:var(--steel);background:var(--card-raised)">${tongKGAll.toFixed(1)}</td>
  </tr>`;

  return { hangDot, hangGom };
}

function hienKetQuaCX1() {
  const { hangDot, hangGom } = taoHangKetQuaCX1(phienCX1);
  document.getElementById("cx1-tbody-dot").innerHTML = hangDot;
  document.getElementById("cx1-tbody-gom").innerHTML = hangGom;

  document.getElementById("cx1-cam").style.display = "none";
  document.getElementById("cx1-ketqua").style.display = "block";
}

async function quetTiepCX1() {
  // Giữ nguyên dữ liệu cũ, mở camera quét tiếp
  demSoDot += 1;
  dangQuetCX1 = true;
  denPinBat = false;

  document.getElementById("cx1-ketqua").style.display = "none";
  document.getElementById("cx1-cam").style.display = "block";
  document.getElementById("cx1-status").textContent = "Đang quét Đợt " + demSoDot + "...";

  const btnToggle = document.getElementById("btn-dung-tieptuc-cx1");
  btnToggle.textContent = "Dừng quét";
  btnToggle.className = "btn btn-red btn-full";

  try {
    zxingReaderCX1 = await khoiTaoCameraFast("cx1-reader", (txt) => {
      if (txt && dangQuetCX1) {
        khiQuetDuocMa({ getText: () => txt });
      }
    });
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

  document.getElementById("cx1-form").style.display = "none";
  document.getElementById("cx1-cam").style.display = "block";
  document.getElementById("cx1-ketqua").style.display = "none";
  document.getElementById("cx1-dem").textContent = "Đã quét: " + phienCX1.length + " mã";
  document.getElementById("cx1-status").textContent = "Đang quét Đợt " + demSoDot + "...";
  document.getElementById("btn-flash-cx1").style.background = "var(--neutral)";
  document.getElementById("btn-flash-cx1").style.color = "var(--cream)";
  document.getElementById("btn-flash-cx1").textContent = "Bật đèn pin";

  const btnToggle = document.getElementById("btn-dung-tieptuc-cx1");
  btnToggle.textContent = "Dừng quét";
  btnToggle.className = "btn btn-red btn-full";

  try {
    zxingReaderCX1 = await khoiTaoCameraFast("cx1-reader", (txt) => {
      if (txt && dangQuetCX1) {
        khiQuetDuocMa({ getText: () => txt });
      }
    });
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
  if (phienCX1.length === 0) { alert("Chưa có dữ liệu để xuất"); return; }
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
    alert("Chưa có dữ liệu phiên này để xuất Excel!");
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
