// ── Module Quét QR (Nhập/Xuất Kho) v20260905-v57 ───────────────────────
// Kiến trúc độc lập: Quét gom theo phiên, 2 bảng kết quả chuẩn CX1 (Đợt, QC, Bao, KG)
// Quy ước: 1 mã QR = 1 Bao

const URL_API_QUETQR = "https://script.google.com/macros/s/AKfycbzXjzccld3X04iJgIpEvKm01in0QT0i7tkjar_oJ6K5-sBGdm9xibe7Mu4UB3mWtha5-w/exec";
const QUETQR_DODANG_KEY = "quetqr_phien_dodang";
const QUETQR_PENDING_KEY = "quetqr_pending_saves";
const QUETQR_LICHSU_KEY = "quetqr_lichsu";

let phienQuetQR = [];
let demSoDotQR = 1;
let ngayQuetQR = "";
let loaiQuetQR = "";
let dangQuetQR = false;
let zxingReaderQR = null;
let mapKhoaQR = new Map();
let idPhienHienTaiQR = null;
let soLuongDaGuiHienTaiQR = 0;

// ── Cập nhật trạng thái công tắc quét trùng ────────────────────────
function capNhatTrangThaiTrungQR() {
  const elCheck = document.getElementById("qr-cho-phep-trung-cam");
  const elStatus = document.getElementById("qr-lock-status");
  if (!elStatus) return;
  if (elCheck && elCheck.checked) {
    elStatus.textContent = "Cho phép";
    elStatus.style.color = "var(--success)";
  } else {
    elStatus.textContent = "Chờ quét...";
    elStatus.style.color = "var(--cream-soft)";
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
  ngayQuetQR = document.getElementById("chon-ngay") ? document.getElementById("chon-ngay").value : "";
  loaiQuetQR = document.getElementById("chon-loai") ? document.getElementById("chon-loai").value : "";

  if (!ngayQuetQR) {
    alert("⚠️ Vui lòng chọn ngày!");
    return;
  }
  if (!loaiQuetQR) {
    alert("⚠️ Vui lòng chọn loại giao dịch (Nhập SX, Xuất SX...)!");
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

  document.getElementById("form-chon").style.display = "none";
  document.getElementById("cam-box").style.display = "block";
  document.getElementById("qr-ketqua").style.display = "none";
  document.body.classList.add("cam-active");

  const statusEl = document.getElementById("qr-status");
  if (statusEl) statusEl.textContent = "🟢 " + loaiQuetQR + " | Đợt " + demSoDotQR;

  const demEl = document.getElementById("qr-dem");
  if (demEl) demEl.textContent = "Đã quét: " + phienQuetQR.length + " bao";

  const btnToggle = document.getElementById("btn-dung-tieptuc-qr");
  if (btnToggle) {
    btnToggle.textContent = "Dừng quét";
    btnToggle.className = "btn btn-red btn-full";
  }

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
    alert("Lỗi camera: " + e);
    dungQuetQR();
  }
}
window.batDauQuetQR = batDauQuetQR;

// Giữ tương thích ngược với nút Quét cũ nếu HTML gọi batDauQuet
window.batDauQuet = batDauQuetQR;

// ── Xử lý dữ liệu khi quét được mã QR ──────────────────────────────
function khiQuetDuocMaQR(result) {
  if (!result || !dangQuetQR) return;
  const rawText = typeof result.getText === "function" ? result.getText() : String(result);
  const data = typeof parseQRText === "function" ? parseQRText(rawText) : null;
  if (!data || !data.id || !data.msp) return;

  const keyQR = (data.id || "").toLowerCase();
  const elCheck = document.getElementById("qr-cho-phep-trung-cam");
  const choPhepTrung = elCheck ? elCheck.checked : false;
  const lockMs = choPhepTrung ? 1500 : 500;
  const now = Date.now();

  // Khóa Per-QR chống quét dính liên tục cùng 1 mã
  if (mapKhoaQR.has(keyQR) && (now - mapKhoaQR.get(keyQR)) < lockMs) {
    return;
  }
  mapKhoaQR.set(keyQR, now);

  const trung = phienQuetQR.find(r => r.id === data.id);
  if (!choPhepTrung && trung) {
    mapKhoaQR.set(keyQR, Date.now() + 1500); // Khóa 1.5s để không nháy cảnh báo liên tục
    if (typeof phatVibrateError === "function") phatVibrateError();
    else if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    // Hiện popup thông báo màu đỏ nổi bật khi quét trùng
    showCanhBaoQR("⚠️ Trùng mã! Mã " + data.id + " đã quét rồi.", "error");

    const vc = document.querySelector("#cam-box .video-container");
    if (vc) {
      vc.classList.add("canh-bao-trung");
      setTimeout(() => vc.classList.remove("canh-bao-trung"), 500);
    }
    return;
  }

  // Quét thành công: KHÔNG HIỆN POPUP, chỉ phát âm thanh/rung và hiển thị dưới nhật ký (log)
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

  const lockStatusEl = document.getElementById("qr-lock-status");
  if (lockStatusEl) lockStatusEl.innerHTML = '<i class="ti ti-check-double" style="color:var(--success)"></i> ' + data.id;
}

// ── Nhập tay mã thủ công ───────────────────────────────────────────
function nhapThuCongQR() {
  const inputEl = document.getElementById("qr-manual-input-cam");
  if (!inputEl) return;
  const raw = inputEl.value.trim();
  if (!raw) return;

  const data = typeof parseQRText === "function" ? parseQRText(raw) : null;
  const id = data && data.id ? data.id : raw;
  const msp = data && data.msp ? data.msp : raw;
  const qc = data && data.qc ? data.qc : msp;
  const kg = data && data.kg ? data.kg : 0;

  const elCheck = document.getElementById("qr-cho-phep-trung-cam");
  const choPhepTrung = elCheck ? elCheck.checked : false;

  if (!choPhepTrung && phienQuetQR.some(r => r.id === id)) {
    showCanhBaoQR("⚠️ Trùng mã! Mã " + id + " đã quét rồi.", "error");
    if (typeof phatVibrateError === "function") phatVibrateError();
    return;
  }

  phienQuetQR.push({
    id,
    msp,
    qc,
    kg,
    thoiGian: new Date(),
    dotQuet: demSoDotQR
  });

  inputEl.value = "";
  const demEl = document.getElementById("qr-dem");
  if (demEl) demEl.textContent = "Đã quét: " + phienQuetQR.length + " bao";

  if (typeof phatVibrateSuccess === "function") phatVibrateSuccess();
  luuPhienDoDangQR();
  capNhatLogQR();
}
window.nhapThuCongQR = nhapThuCongQR;

// ── Dừng / Tiếp tục Camera ─────────────────────────────────────────
function dungQuetQR() {
  dangQuetQR = false;
  if (zxingReaderQR) {
    dungCameraFast("reader", zxingReaderQR);
    zxingReaderQR = null;
  }
  document.body.classList.remove("cam-active");
  const btnToggle = document.getElementById("btn-dung-tieptuc-qr");
  if (btnToggle) {
    btnToggle.textContent = "Tiếp tục quét";
    btnToggle.className = "btn btn-green btn-full";
  }
}
window.dungQuetQR = dungQuetQR;
window.dungQuet = dungQuetQR;

function tiepTucQuetQR() {
  batDauQuetQR();
}
window.tiepTucQuetQR = tiepTucQuetQR;

function toggleDungTiepTucQR() {
  if (dangQuetQR) dungQuetQR();
  else tiepTucQuetQR();
}
window.toggleDungTiepTucQR = toggleDungTiepTucQR;

// ── Cập nhật Bảng Nhật Ký Trực Tiếp (Live Log) ─────────────────────
function capNhatLogQR() {
  const container = document.getElementById("qr-log-list");
  const countEl = document.getElementById("qr-log-count");
  if (countEl) countEl.textContent = phienQuetQR.length + " bao";
  if (!container) return;

  if (phienQuetQR.length === 0) {
    container.innerHTML = '<div style="color:var(--cream-soft); font-size:12px; text-align:center; padding:6px 0;">Chưa có mã nào được quét</div>';
    return;
  }

  // Tính số thứ tự trong đợt (seqTrongDot) cho từng mã giống CX1
  const dotSeq = {};
  phienQuetQR.forEach(item => {
    const dot = item.dotQuet || 1;
    dotSeq[dot] = (dotSeq[dot] || 0) + 1;
    item.seqTrongDot = dotSeq[dot];
  });

  // Hiển thị danh sách từ mới nhất lên trên: Đợt | ID | QC | KG | SL trong đợt | Thời gian | Xóa
  const newestFirst = phienQuetQR.slice().reverse();
  container.innerHTML = newestFirst.map((item, revIdx) => {
    const origIdx = phienQuetQR.length - 1 - revIdx;
    const dot = item.dotQuet || 1;
    const gio = item.thoiGian ? new Date(item.thoiGian).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
    const flashClass = revIdx === 0 ? ' scan-flash-new' : '';
    const kgStr = item.kg ? Number(item.kg).toFixed(1) : "0";

    return `
      <div class="${flashClass}" style="display:flex; justify-content:space-between; align-items:center; padding:4px 2px; border-bottom:1px solid var(--line-soft); font-size:12px; border-radius:6px;">
        <span style="color:var(--steel); font-weight:700; width:24px; text-align:center;">${dot}</span>
        <span style="color:var(--cream); font-weight:700; width:75px; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${item.id || ''}">${item.id || '—'}</span>
        <span style="color:var(--brass); font-weight:700; flex:1; min-width:60px; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${item.qc || item.msp || ''}">${item.qc || item.msp || '—'}</span>
        <span style="color:var(--success); font-weight:700; width:42px; text-align:right;">${kgStr}</span>
        <span style="color:var(--blue); font-weight:700; width:26px; text-align:center;">${item.seqTrongDot}</span>
        <span style="color:var(--cream-soft); font-size:11px; width:52px; text-align:right;">${gio}</span>
        <button onclick="xoaMaTrongLiveLogQR(${origIdx})" style="background:none; border:none; color:var(--red); cursor:pointer; width:26px; padding:2px 0; display:inline-flex; align-items:center; justify-content:center;" title="Xóa mã này">
          <i class="ti ti-trash"></i>
        </button>
      </div>
    `;
  }).join("");
}

function xoaMaTrongLiveLogQR(index) {
  if (index >= 0 && index < phienQuetQR.length) {
    phienQuetQR.splice(index, 1);
    const demEl = document.getElementById("qr-dem");
    if (demEl) demEl.textContent = "Đã quét: " + phienQuetQR.length + " bao";
    luuPhienDoDangQR();
    capNhatLogQR();
  }
}
window.xoaMaTrongLiveLogQR = xoaMaTrongLiveLogQR;

// ── Tính toán 2 Bảng Kết Quả Chuẩn CX1 (Đợt, QC, Bao, KG) ───────────
function taoHangKetQuaQuetQR(danhSach) {
  let tongDotCuaPhien = {};
  let tongGomLoaiMa = {};
  let tongBaoAll = 0;
  let tongKGAll = 0;

  danhSach.forEach(r => {
    tongBaoAll += 1;
    tongKGAll += (r.kg || 0);

    // Bảng 1: Gom theo Đợt + Quy Cách
    const keyDot = r.dotQuet + "|" + r.qc;
    if (!tongDotCuaPhien[keyDot]) {
      tongDotCuaPhien[keyDot] = { dot: r.dotQuet, msp: r.msp, qc: r.qc, soLuong: 0, tongKG: 0 };
    }
    tongDotCuaPhien[keyDot].soLuong += 1;
    tongDotCuaPhien[keyDot].tongKG += (r.kg || 0);

    // Bảng 2: Gom theo Quy Cách toàn phiên
    const keyGom = r.qc;
    if (!tongGomLoaiMa[keyGom]) {
      tongGomLoaiMa[keyGom] = { msp: r.msp, qc: r.qc, soLuong: 0, tongKG: 0 };
    }
    tongGomLoaiMa[keyGom].soLuong += 1;
    tongGomLoaiMa[keyGom].tongKG += (r.kg || 0);
  });

  // Render HTML Bảng Chi Tiết (theo Đợt)
  let hangDot = "";
  Object.values(tongDotCuaPhien).forEach(item => {
    hangDot += `
      <tr>
        <td style="padding:10px; border-bottom:1px solid var(--line-soft); color:var(--brass); font-weight:700">Đợt ${item.dot}</td>
        <td style="padding:10px; border-bottom:1px solid var(--line-soft); font-weight:600">${item.qc}</td>
        <td style="padding:10px; border-bottom:1px solid var(--line-soft); text-align:center; font-weight:700">${item.soLuong}</td>
        <td style="padding:10px; border-bottom:1px solid var(--line-soft); text-align:right; font-weight:700; color:var(--success)">
          ${item.tongKG.toFixed(1)}
          <button onclick="nhapTayKGQR(${item.dot}, '${item.qc}')" style="background:none; border:none; color:var(--blue); cursor:pointer; padding:0 0 0 8px; margin:0;" title="Nhập tay KG">
            <i class="ti ti-pencil"></i>
          </button>
        </td>
      </tr>
    `;
  });
  hangDot += `
    <tr style="background:var(--card-raised); border-top:2px solid var(--line);">
      <td style="padding:10px; font-weight:700; color:var(--brass);">TỔNG</td>
      <td style="padding:10px;"></td>
      <td style="padding:10px; text-align:center; font-weight:700; color:var(--brass);">${tongBaoAll}</td>
      <td style="padding:10px; text-align:right; font-weight:700; color:var(--brass);">${tongKGAll.toFixed(1)}</td>
    </tr>
  `;

  // Render HTML Bảng Tổng Hợp (theo QC)
  let hangGom = "";
  Object.values(tongGomLoaiMa).forEach(item => {
    hangGom += `
      <tr>
        <td style="padding:10px; border-bottom:1px solid var(--line-soft); font-weight:600">${item.qc}</td>
        <td style="padding:10px; border-bottom:1px solid var(--line-soft); text-align:center; font-weight:700">${item.soLuong}</td>
        <td style="padding:10px; border-bottom:1px solid var(--line-soft); text-align:right; font-weight:700; color:var(--success)">${item.tongKG.toFixed(1)}</td>
      </tr>
    `;
  });
  hangGom += `
    <tr style="background:var(--card-raised); border-top:2px solid var(--line);">
      <td style="padding:10px; font-weight:700; color:var(--steel);">TỔNG</td>
      <td style="padding:10px; text-align:center; font-weight:700; color:var(--steel);">${tongBaoAll}</td>
      <td style="padding:10px; text-align:right; font-weight:700; color:var(--steel);">${tongKGAll.toFixed(1)}</td>
    </tr>
  `;

  return { hangDot, hangGom, tongBaoAll, tongKGAll };
}

// ── Hiển thị Màn hình Kết Quả ──────────────────────────────────────
function xemKetQuaQuetQR() {
  dungQuetQR();
  hienKetQuaQuetQR();
  luuPhienDoDangQR();
}
window.xemKetQuaQuetQR = xemKetQuaQuetQR;

function hienKetQuaQuetQR() {
  const { hangDot, hangGom } = taoHangKetQuaQuetQR(phienQuetQR);
  const tbodyDot = document.getElementById("qr-tbody-dot");
  const tbodyGom = document.getElementById("qr-tbody-gom");

  if (tbodyDot) tbodyDot.innerHTML = hangDot;
  if (tbodyGom) tbodyGom.innerHTML = hangGom;

  const tieuDeKetQua = document.getElementById("qr-ketqua-tieude");
  if (tieuDeKetQua) tieuDeKetQua.textContent = "Hoàn tất: " + (loaiQuetQR || "Giao dịch") + " (" + (ngayQuetQR || "") + ")";

  document.getElementById("cam-box").style.display = "none";
  document.getElementById("qr-ketqua").style.display = "block";

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

// ── Sửa KG theo đợt & QC ───────────────────────────────────────────
function nhapTayKGQR(dot, qc) {
  const cacMa = phienQuetQR.filter(r => r.dotQuet === dot && r.qc === qc);
  if (cacMa.length === 0) return;

  const kgHienTai = cacMa.reduce((s, r) => s + (r.kg || 0), 0);
  const moiStr = prompt(`Nhập tổng số KG cho Đợt ${dot} - QC ${qc} (${cacMa.length} bao):`, kgHienTai.toFixed(1));
  if (moiStr === null) return;

  const tongKGMoi = parseFloat(moiStr);
  if (isNaN(tongKGMoi) || tongKGMoi < 0) {
    alert("⚠️ Số KG không hợp lệ!");
    return;
  }

  // Chia đều số KG mới cho từng bao trong nhóm
  const kgMoiTungBao = Number((tongKGMoi / cacMa.length).toFixed(3));
  cacMa.forEach((r, idx) => {
    if (idx === cacMa.length - 1) {
      // Bao cuối bù phần dư làm tròn
      r.kg = Number((tongKGMoi - kgMoiTungBao * (cacMa.length - 1)).toFixed(2));
    } else {
      r.kg = kgMoiTungBao;
    }
  });

  luuPhienDoDangQR();
  hienKetQuaQuetQR();
}
window.nhapTayKGQR = nhapTayKGQR;

// ── Quét Tiếp / Quét Mới ───────────────────────────────────────────
async function quetTiepQuetQR() {
  const coDuLieu = phienQuetQR.some(r => r.dotQuet === demSoDotQR);
  if (coDuLieu) {
    demSoDotQR += 1;
  }
  document.getElementById("qr-ketqua").style.display = "none";
  batDauQuetQR();
}
window.quetTiepQuetQR = quetTiepQuetQR;

function quetMoiQuetQR() {
  phienQuetQR = [];
  demSoDotQR = 1;
  idPhienHienTaiQR = null;
  soLuongDaGuiHienTaiQR = 0;
  xoaPhienDoDangQR();
  document.getElementById("qr-ketqua").style.display = "none";
  document.getElementById("cam-box").style.display = "none";
  document.getElementById("form-chon").style.display = "block";
}
window.quetMoiQuetQR = quetMoiQuetQR;

// ── Gửi Dữ Liệu Lên Sheet ──────────────────────────────────────────
async function guiDuLieuQuetQR() {
  const moiBoSung = phienQuetQR.slice(soLuongDaGuiHienTaiQR);
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
    soLuongDaGuiHienTaiQR = phienQuetQR.length;
    xoaPhienDoDangQR();
    luuVaoLichSuQR();
    showCanhBaoQR("✅ Đã gửi thành công " + rows.length + " bao lên Sheet!", "success");

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
    showCanhBaoQR("Mất mạng — đã lưu tạm " + rows.length + " bao trên máy, sẽ tự gửi lại sau", "error");
    soLuongDaGuiHienTaiQR = phienQuetQR.length;
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
          mau: r.qc || "—",
          ngay: r.ngay,
          loai: r.loai,
          kg: r.kg
        })
      }).then(res => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      });
    });
    await Promise.all(promises);
  }
}

// ── Quản lý Hàng Đợi Offline ───────────────────────────────────────
function docPendingQuetQR() {
  try {
    const raw = localStorage.getItem(QUETQR_PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
window.docPendingQuetQR = docPendingQuetQR;

function luuPendingQuetQR(list) {
  try {
    localStorage.setItem(QUETQR_PENDING_KEY, JSON.stringify(list));
  } catch (e) {}
}
window.luuPendingQuetQR = luuPendingQuetQR;

// ── Quản lý Phiên Dở Dang ──────────────────────────────────────────
function luuPhienDoDangQR() {
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
  } catch (e) {}
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
  if (confirm("Bạn có chắc muốn hủy phiên quét dở dang này không?")) {
    xoaPhienDoDangQR();
    phienQuetQR = [];
    demSoDotQR = 1;
    idPhienHienTaiQR = null;
    soLuongDaGuiHienTaiQR = 0;
  }
}
window.huyPhienQuetQR = huyPhienQuetQR;

// ── Quản lý Lịch Sử Phiên Quét ─────────────────────────────────────
function luuVaoLichSuQR() {
  try {
    const raw = localStorage.getItem(QUETQR_LICHSU_KEY);
    const list = raw ? JSON.parse(raw) : [];
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

    if (list.length > 50) list.pop();
    localStorage.setItem(QUETQR_LICHSU_KEY, JSON.stringify(list));
  } catch (e) {}
}

function renderLichSuQR() {
  const container = document.getElementById("lichsu-qr-list");
  if (!container) return;

  const raw = localStorage.getItem(QUETQR_LICHSU_KEY);
  const list = raw ? JSON.parse(raw) : [];

  const filterText = (document.getElementById("lichsu-qr-tim") ? document.getElementById("lichsu-qr-tim").value : "").toLowerCase().trim();

  const filtered = list.filter(item => {
    if (!filterText) return true;
    return (item.ngay && item.ngay.toLowerCase().includes(filterText)) ||
           (item.loai && item.loai.toLowerCase().includes(filterText)) ||
           (item.phienQuetQR && item.phienQuetQR.some(r => (r.id && r.id.toLowerCase().includes(filterText)) || (r.qc && r.qc.toLowerCase().includes(filterText))));
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="color:var(--cream-soft); text-align:center; padding:30px 0;">Không có lịch sử quét nào</div>';
    return;
  }

  container.innerHTML = filtered.map((entry, idx) => {
    const timeStr = entry.thoiGian ? new Date(entry.thoiGian).toLocaleString("vi-VN") : "—";
    return `
      <div class="card" style="margin-bottom:12px; padding:12px; background:var(--card-raised);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div>
            <div style="font-weight:700; color:var(--brass); font-size:15px;">${entry.loai || 'Giao dịch'}</div>
            <div style="font-size:12px; color:var(--cream-soft);">${timeStr} · Ngày: ${entry.ngay || '—'}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:800; color:var(--success); font-size:15px;">${(entry.tongKG || 0).toFixed(1)} kg</div>
            <div style="font-size:12px; color:var(--cream); font-weight:600;">${entry.tongBao || 0} bao</div>
          </div>
        </div>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button class="btn btn-blue" style="flex:1; height:34px; font-size:12px; margin:0;" onclick="xemChiTietLichSuQR('${entry.idPhien}')">
            <i class="ti ti-eye"></i> Xem 2 Bảng
          </button>
          <button class="btn btn-excel" style="flex:1; height:34px; font-size:12px; margin:0;" onclick="xuatExcelPhienLichSuQR('${entry.idPhien}')">
            <i class="ti ti-file-spreadsheet"></i> Xuất Excel
          </button>
        </div>
      </div>
    `;
  }).join("");
}
window.renderLichSuQR = renderLichSuQR;

function xemChiTietLichSuQR(idPhien) {
  const raw = localStorage.getItem(QUETQR_LICHSU_KEY);
  const list = raw ? JSON.parse(raw) : [];
  const entry = list.find(e => e.idPhien === idPhien);
  if (!entry) return;

  phienQuetQR = entry.phienQuetQR || [];
  ngayQuetQR = entry.ngay;
  loaiQuetQR = entry.loai;
  soLuongDaGuiHienTaiQR = phienQuetQR.length;

  chuyenTrangKhongNav("quetQR");
  xemKetQuaQuetQR();
}
window.xemChiTietLichSuQR = xemChiTietLichSuQR;

function xoaTatCaLichSuQR() {
  if (confirm("Bạn có chắc muốn xóa toàn bộ lịch sử Quét QR không?")) {
    localStorage.removeItem(QUETQR_LICHSU_KEY);
    renderLichSuQR();
  }
}
window.xoaTatCaLichSuQR = xoaTatCaLichSuQR;

// ── Xuất File Excel ────────────────────────────────────────────────
function xuatExcelQuetQR() {
  if (phienQuetQR.length === 0) {
    alert("Chưa có dữ liệu để xuất Excel!");
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
  } else {
    alert("Hàm exportToExcel chưa sẵn sàng!");
  }
}
window.xuatExcelQuetQR = xuatExcelQuetQR;

function xuatExcelPhienLichSuQR(idPhien) {
  const raw = localStorage.getItem(QUETQR_LICHSU_KEY);
  const list = raw ? JSON.parse(raw) : [];
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

// ── Hiển thị Cảnh Báo Popup (Đỏ / Xanh) ─────────────────────────────
function showCanhBaoQR(text, type = "error") {
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
  el.style.zIndex = "99999";
  el.style.display = "block";

  setTimeout(() => {
    el.style.display = "none";
  }, 2200);
}

// ── Khởi chạy khi tải trang ────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  const today = new Date().toISOString().split("T")[0];
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
