const API_CX5 = "https://script.google.com/macros/s/AKfycbzJeVkfapKOzkiZpeZvUWhmn3KEiS4wlYGJv1BSR2TUFnwYYuCkI28oGo6OB0Bjui-P/exec";

const CX5_LICHSU_KEY = "cx5_lich_su";
const CX5_LICHSU_SO_NGAY_GIU = 30;
const CX5_KG_MAX = 2000;

let phienCX5 = [];
let ngayCX5 = null;
let idPhienHienTaiC5 = null;
let seqCX5 = 0;
let dangKetThucCX5 = false;
let luotDemCX5 = 0;
let luotHienTaiCX5 = null;

let mspDataCX5 = [];
let mspCacheX5 = {};
let filteredCX5 = [];
let activeIndexCX5 = -1;
let dangHienGoiYCX5 = false;

let doiChieuCX5 = {};

let tongKgDataCX5 = {};
let tongKetPhienCX5 = [];

async function callApiCX5(body) {
  const res = await fetch(API_CX5, { method: "POST", body: JSON.stringify(body) });
  return await res.json();
}

function boDauCX5(str) {
  return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

// Escape dữ liệu trước khi chèn vào innerHTML (tên quy cách đến từ Sheet — không
// nên tin tưởng tuyệt đối là an toàn để chèn thẳng vào HTML).
function escHtmlCX5(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function keyQCX5(msp, ten) {
  return msp + "|" + ten;
}

function luuPhienDoDangCX5() {
  try {
    localStorage.setItem("cx5_phien_dodang", JSON.stringify({
      phienCX5, ngayCX5, capNhat: new Date().toISOString(),
      idPhienHienTaiC5, seqCX5, doiChieuCX5, dangKetThucCX5,
      luotDemCX5, luotHienTaiCX5
    }));
  } catch (e) { }
  luuPhienVaoLichSuCX5();
}

function xoaPhienDoDangCX5() {
  try { localStorage.removeItem("cx5_phien_dodang"); } catch (e) { }
}

// Cache danh sách quy cách xuống localStorage — sống qua cả lần tải lại trang/mở
// lại app (khác mspCacheX5 chỉ sống trong bộ nhớ, mất khi refresh). Hết hạn sau
// 4 tiếng để khớp với cache phía Apps Script (CacheService, cũng 4 tiếng).
const CX5_MSP_CACHE_TTL_MS = 4 * 60 * 60 * 1000;

function docMspCacheLocalCX5(monthKey, boQuaHanSuDung) {
  try {
    const raw = localStorage.getItem("cx5_msp_cache_" + monthKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data)) return null;
    if (!boQuaHanSuDung && Date.now() - parsed.savedAt > CX5_MSP_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch (e) { return null; }
}

function luuMspCacheLocalCX5(monthKey, data) {
  try { localStorage.setItem("cx5_msp_cache_" + monthKey, JSON.stringify({ data, savedAt: Date.now() })); } catch (e) { }
}

let taiDanhSachTokenCX5 = 0;

async function taiDanhSachQCX5(dateStr, forceRefresh) {
  const myToken = ++taiDanhSachTokenCX5;
  const monthKey = new Date(dateStr).getMonth() + 1;
  if (!forceRefresh && mspCacheX5[monthKey]) {
    mspDataCX5 = mspCacheX5[monthKey];
    return;
  }

  if (!forceRefresh) {
    const local = docMspCacheLocalCX5(monthKey, false);
    if (local) {
      mspDataCX5 = local;
      mspCacheX5[monthKey] = local;
      return;
    }
  }

  document.getElementById("cx5-ten").placeholder = "Đang tải danh sách...";
  document.getElementById("cx5-ten").disabled = true;
  try {
    const res = await callApiCX5({ action: "khoiTaoForm", dateStr, forceRefresh: !!forceRefresh });
    if (myToken !== taiDanhSachTokenCX5) return; // đã có lượt gọi mới hơn chen ngang, bỏ kết quả cũ
    if (res.error) { showCanhBaoCX5(res.error); mspDataCX5 = []; }
    else if (!res.exists) { showCanhBaoCX5('Chưa có sheet tháng "' + res.sheetName + '"'); mspDataCX5 = []; }
    else {
      mspDataCX5 = (res.mspList || []).filter(i => i.vung !== "FOR");
      mspCacheX5[monthKey] = mspDataCX5;
      luuMspCacheLocalCX5(monthKey, mspDataCX5);
    }
  } catch (e) {
    if (myToken !== taiDanhSachTokenCX5) return;
    const duPhong = docMspCacheLocalCX5(monthKey, true);
    if (duPhong) {
      mspDataCX5 = duPhong;
      mspCacheX5[monthKey] = duPhong;
      showCanhBaoCX5("Mất mạng — đang dùng danh sách quy cách đã lưu trước đó");
    } else {
      showCanhBaoCX5("Không tải được danh sách quy cách");
      mspDataCX5 = [];
    }
  }
  if (myToken !== taiDanhSachTokenCX5) return;
  document.getElementById("cx5-ten").disabled = false;
  document.getElementById("cx5-ten").placeholder = "Gõ để tìm...";
}

function showCanhBaoCX5(text) {
  const el = document.getElementById("canh-bao");
  el.textContent = text;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 2200);
}

async function batDauCX5() {
  ngayCX5 = document.getElementById("cx5-ngay").value;
  if (!ngayCX5) { alert("Vui lòng chọn ngày!"); return; }

  let phienCu = null;
  try { phienCu = JSON.parse(localStorage.getItem("cx5_phien_dodang")); } catch (e) { }
  if (phienCu && Array.isArray(phienCu.phienCX5) && phienCu.phienCX5.length > 0) {
    moXacNhanCX5(
      "Bạn đang có phiên Chỉ X5 dở dang (" + phienCu.phienCX5.length + " dòng, ngày " + phienCu.ngayCX5 + "). Tiếp tục phiên đó hay bắt đầu phiên mới?",
      () => { xoaPhienDoDangCX5(); batDauPhienMoiCX5(); },
      "Bắt đầu mới",
      () => { khoiPhucCX5(phienCu); },
      "Tiếp tục"
    );
    return;
  }

  await batDauPhienMoiCX5();
}

async function batDauPhienMoiCX5() {
  phienCX5 = [];
  seqCX5 = 0;
  idPhienHienTaiC5 = Date.now() + "-" + Math.random().toString(36).slice(2);
  dangKetThucCX5 = false;
  doiChieuCX5 = {};
  luotDemCX5 = 0;
  luotHienTaiCX5 = null;

  document.getElementById("cx5-form").style.display = "none";
  document.getElementById("cx5-doichieu").style.display = "none";
  document.getElementById("cx5-tongkg").style.display = "none";
  document.getElementById("cx5-nhap").style.display = "block";
  document.getElementById("cx5-ngay-hienthi").textContent = ngayCX5;
  resetKhoaQCCX5();

  showLoading(true);
  try {
    await taiDanhSachQCX5(ngayCX5, false);
  } finally {
    showLoading(false);
  }
  renderBangChiTietCX5();
  renderBangTongHopCX5();
}

async function khoiPhucCX5(state) {
  phienCX5 = state.phienCX5.map(r => ({ ...r, thoiGian: new Date(r.thoiGian) }));
  ngayCX5 = state.ngayCX5;
  idPhienHienTaiC5 = state.idPhienHienTaiC5 || (Date.now() + "-" + Math.random().toString(36).slice(2));
  seqCX5 = state.seqCX5 || phienCX5.reduce((m, r) => Math.max(m, r.seq), 0);
  doiChieuCX5 = state.doiChieuCX5 || {};
  dangKetThucCX5 = !!state.dangKetThucCX5;
  luotDemCX5 = state.luotDemCX5 || phienCX5.reduce((m, r) => Math.max(m, r.luot || 0), 0);
  luotHienTaiCX5 = state.luotHienTaiCX5 || null;

  document.getElementById("cx5-form").style.display = "none";
  document.getElementById("cx5-doichieu").style.display = "none";
  document.getElementById("cx5-tongkg").style.display = "none";
  document.getElementById("cx5-nhap").style.display = "block";
  document.getElementById("cx5-ngay-hienthi").textContent = ngayCX5;
  resetKhoaQCCX5();

  showLoading(true);
  try {
    await taiDanhSachQCX5(ngayCX5, false);
  } finally {
    showLoading(false);
  }
  renderBangChiTietCX5();
  renderBangTongHopCX5();
}

// ── Khoá/mở ô Quy cách: 1 lượt giữ nguyên quy cách, chỉ đổi số kg ──
function khoaQCCX5(msp, ten) {
  document.getElementById("cx5-qc-tim-wrap").style.display = "none";
  const khoa = document.getElementById("cx5-qc-khoa");
  khoa.style.display = "flex";
  document.getElementById("cx5-qc-khoa-ten").textContent = ten;
}

function moKhoaQCCX5() {
  document.getElementById("cx5-qc-khoa").style.display = "none";
  document.getElementById("cx5-qc-tim-wrap").style.display = "block";
  const ten = document.getElementById("cx5-ten");
  ten.value = "";
  document.getElementById("cx5-msp").value = "";
  closeDropdownCX5();
  setTimeout(function () { ten.focus(); }, 0);
}

function resetKhoaQCCX5() {
  document.getElementById("cx5-qc-khoa").style.display = "none";
  document.getElementById("cx5-qc-tim-wrap").style.display = "block";
  document.getElementById("cx5-ten").value = "";
  document.getElementById("cx5-msp").value = "";
}

function onInputCX5() {
  document.getElementById("cx5-msp").value = "";
  const query = document.getElementById("cx5-ten").value.trim();
  if (!query) { hienGoiYQCCX5(); return; }
  dangHienGoiYCX5 = false;
  if (typeof tkLocDanhSach === "function") {
    filteredCX5 = tkLocDanhSach(mspDataCX5, query, 50);
  } else {
    const q = boDauCX5(query).toUpperCase();
    filteredCX5 = mspDataCX5
      .filter(item => boDauCX5(item.ten).toUpperCase().includes(q))
      .sort(sapXepQCCX5)
      .slice(0, 50);
  }
  activeIndexCX5 = -1;
  renderDropdownCX5();
}

function sapXepQCCX5(a, b) {
  return (Number(b.count) || 0) - (Number(a.count) || 0) || String(a.ten).localeCompare(String(b.ten), "vi");
}

function hienGoiYQCCX5() {
  if (!mspDataCX5.length) return;
  dangHienGoiYCX5 = true;
  filteredCX5 = mspDataCX5.slice().sort(sapXepQCCX5).slice(0, 8);
  activeIndexCX5 = -1;
  renderDropdownCX5();
}

function renderDropdownCX5() {
  const el = document.getElementById("cx5-dropdown");
  const kgKhu = document.getElementById("cx5-kg-khu");
  if (filteredCX5.length === 0) {
    el.classList.remove("open"); el.innerHTML = "";
    if (kgKhu) kgKhu.style.display = "";
    return;
  }
  if (kgKhu) kgKhu.style.display = "none";
  const tieuDe = dangHienGoiYCX5
    ? '<div class="cx5-dropdown-title">Gợi ý quy cách thường dùng</div>'
    : "";
  el.innerHTML = tieuDe + filteredCX5.map((item, idx) =>
    '<div class="cx5-dropdown-item' + (idx === activeIndexCX5 ? " active" : "") + '" data-idx="' + idx + '">' + escHtmlCX5(item.ten) + "</div>"
  ).join("");
  el.classList.add("open");
  Array.from(el.children).forEach(child => {
    child.addEventListener("mousedown", e => {
      e.preventDefault();
      chonQCX5(filteredCX5[parseInt(child.getAttribute("data-idx"), 10)]);
    });
  });
}

function closeDropdownCX5() {
  filteredCX5 = [];
  activeIndexCX5 = -1;
  dangHienGoiYCX5 = false;
  document.getElementById("cx5-dropdown").classList.remove("open");
  document.getElementById("cx5-dropdown").innerHTML = "";
  const kgKhu = document.getElementById("cx5-kg-khu");
  if (kgKhu) kgKhu.style.display = "";
}

function chonQCX5(item) {
  document.getElementById("cx5-ten").value = item.ten;
  document.getElementById("cx5-msp").value = item.msp;
  if (typeof tkGhiNhanTanSuat === "function") {
    tkGhiNhanTanSuat(item.ten);
  }
  item.count = (Number(item.count) || 0) + 1;
  closeDropdownCX5();
  khoaQCCX5(item.msp, item.ten);

  // Mỗi lần chọn quy cách (kể cả chọn lại đúng QC cũ sau khi bấm "Đổi") là 1 lượt mới
  luotDemCX5 += 1;
  luotHienTaiCX5 = { msp: item.msp, ten: item.ten, id: luotDemCX5 };

  document.getElementById("cx5-kg").focus();
}

function onKeydownCX5(e) {
  if (e.key === "ArrowDown") {
    if (!filteredCX5.length) return;
    e.preventDefault();
    activeIndexCX5 = Math.min(activeIndexCX5 + 1, filteredCX5.length - 1);
    renderDropdownCX5();
  } else if (e.key === "ArrowUp") {
    if (!filteredCX5.length) return;
    e.preventDefault();
    activeIndexCX5 = Math.max(activeIndexCX5 - 1, 0);
    renderDropdownCX5();
  } else if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
    if (filteredCX5.length) {
      e.preventDefault();
      chonQCX5(filteredCX5[activeIndexCX5 >= 0 ? activeIndexCX5 : 0]);
    }
  } else if (e.key === "Escape") {
    closeDropdownCX5();
  }
}

function themDongCX5() {
  const msp = document.getElementById("cx5-msp").value;
  const ten = document.getElementById("cx5-ten").value.trim();
  const kg = parseFloat(document.getElementById("cx5-kg").value);
  if (!msp || !ten) { showCanhBaoCX5("Chưa chọn quy cách hợp lệ"); return; }
  if (!kg || kg <= 0) { showCanhBaoCX5("Nhập số kg hợp lệ"); return; }
  if (kg > CX5_KG_MAX) { showCanhBaoCX5("Số kg quá lớn (trên " + CX5_KG_MAX + "kg), kiểm tra lại"); return; }

  hoanTatThemDongCX5(msp, ten, kg);
}

function hoanTatThemDongCX5(msp, ten, kg) {
  // Bình thường lượt đã được tạo khi chọn quy cách (chonQCX5). Đây chỉ là lưới an toàn
  // cho trường hợp hiếm khi chưa có lượt hiện tại (vd lỗi khôi phục phiên).
  if (!luotHienTaiCX5 || luotHienTaiCX5.msp !== msp || luotHienTaiCX5.ten !== ten) {
    luotDemCX5 += 1;
    luotHienTaiCX5 = { msp, ten, id: luotDemCX5 };
  }

  seqCX5 += 1;
  phienCX5.push({ seq: seqCX5, msp, ten, kg, luot: luotHienTaiCX5.id, thoiGian: new Date(), daDongBo: false });
  luuPhienDoDangCX5();
  renderBangChiTietCX5();
  renderBangTongHopCX5();

  document.getElementById("cx5-kg").value = "";
  document.getElementById("cx5-kg").focus();
}

function xoaDongCX5(seq) {
  const dong = phienCX5.find(r => r.seq === seq);
  if (!dong) return;
  if (dong.daDongBo) { showCanhBaoCX5("Đã đồng bộ, không thể xoá"); return; }
  phienCX5 = phienCX5.filter(r => r.seq !== seq);
  luuPhienDoDangCX5();
  renderBangChiTietCX5();
  renderBangTongHopCX5();
}

function renderBangChiTietCX5() {
  document.getElementById("cx5-dem").textContent = "Đã nhập: " + phienCX5.length + " dòng";
  const tbody = document.getElementById("cx5-tbody-chitiet");
  if (phienCX5.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--cream-soft);font-style:italic">Chưa có dòng nào</td></tr>';
    return;
  }

  const luotMap = new Map();
  const thuTuLuot = [];
  phienCX5.forEach(r => {
    if (!luotMap.has(r.luot)) { luotMap.set(r.luot, []); thuTuLuot.push(r.luot); }
    luotMap.get(r.luot).push(r);
  });

  tbody.innerHTML = thuTuLuot.slice().reverse().map((lid, idx) => {
    const flashClass = idx === 0 ? ' class="scan-flash-new"' : '';
    const rows = luotMap.get(lid);
    const first = rows[0];
    const bao = rows.length;
    const kg = Math.round(rows.reduce((s, r) => s + r.kg, 0) * 100) / 100;
    return "<tr" + flashClass + ">" +
      "<td>" + lid + "</td>" +
      "<td>" + escHtmlCX5(first.ten) + "</td>" +
      "<td>" + bao + "</td>" +
      "<td>" + kg + "</td>" +
      '<td class="cx5-sua-luot" onclick="moSuaLuotCX5(' + lid + ')"><i class="ti ti-pencil"></i></td>' +
      "</tr>";
  }).join("");
}

// ── Sửa các số kg lẻ trong 1 lượt (mở overlay) ──
let luotDangSuaCX5 = null;

function moSuaLuotCX5(luotId) {
  luotDangSuaCX5 = luotId;
  renderSuaLuotCX5();
  document.getElementById("cx5-sl-them-kg").value = "";
  document.getElementById("cx5-overlay-luot").classList.add("show");
}

function dongSuaLuotCX5() {
  document.getElementById("cx5-overlay-luot").classList.remove("show");
  luotDangSuaCX5 = null;
}

function renderSuaLuotCX5() {
  const rows = phienCX5.filter(r => r.luot === luotDangSuaCX5);
  if (rows.length === 0) { dongSuaLuotCX5(); return; }
  document.getElementById("cx5-sl-ten").textContent = rows[0].ten;
  const box = document.getElementById("cx5-sl-chitiet");
  box.innerHTML = rows.map(r => {
    const xoa = r.daDongBo ? "" : ' <i class="ti ti-x" onclick="xoaDongTrongLuotCX5(' + r.seq + ')"></i>';
    return '<span class="cx5-so-sx' + (r.daDongBo ? " cx5-so-sx-dadongbo" : "") + '">' + r.kg + xoa + '</span>';
  }).join("");
}

function xoaDongTrongLuotCX5(seq) {
  xoaDongCX5(seq);
  renderSuaLuotCX5();
}

function themKgVaoLuotCX5() {
  if (luotDangSuaCX5 == null) return;
  const rows = phienCX5.filter(r => r.luot === luotDangSuaCX5);
  if (rows.length === 0) { dongSuaLuotCX5(); return; }
  const input = document.getElementById("cx5-sl-them-kg");
  const kg = parseFloat(input.value);
  if (!kg || kg <= 0) { showCanhBaoCX5("Nhập số kg hợp lệ"); return; }
  if (kg > CX5_KG_MAX) { showCanhBaoCX5("Số kg quá lớn (trên " + CX5_KG_MAX + "kg), kiểm tra lại"); return; }

  const first = rows[0];
  seqCX5 += 1;
  phienCX5.push({ seq: seqCX5, msp: first.msp, ten: first.ten, kg, luot: luotDangSuaCX5, thoiGian: new Date(), daDongBo: false });
  luuPhienDoDangCX5();
  renderBangChiTietCX5();
  renderBangTongHopCX5();
  renderSuaLuotCX5();

  input.value = "";
  input.focus();
}

function tomTatCX5() {
  const gom = {};
  phienCX5.forEach(r => {
    const key = keyQCX5(r.msp, r.ten);
    if (!gom[key]) gom[key] = { msp: r.msp, ten: r.ten, bao: 0, kg: 0, baoDaDongBo: 0, kgDaDongBo: 0 };
    gom[key].bao += 1;
    gom[key].kg += r.kg;
    if (r.daDongBo) { gom[key].baoDaDongBo += 1; gom[key].kgDaDongBo += r.kg; }
  });
  return gom;
}

function renderBangTongHopCX5() {
  const gom = tomTatCX5();
  const tbody = document.getElementById("cx5-tbody-tonghop");
  const keys = Object.keys(gom);
  if (keys.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--cream-soft);font-style:italic">Chưa có dữ liệu</td></tr>';
    return;
  }
  tbody.innerHTML = keys.map(key => {
    const item = gom[key];
    let trangThai;
    if (item.baoDaDongBo === 0) trangThai = '<i class="ti ti-x cx5-trangthai-mot-phan"></i>';
    else if (item.baoDaDongBo === item.bao) trangThai = '<i class="ti ti-check cx5-trangthai-ok"></i>';
    else trangThai = '<i class="ti ti-x cx5-trangthai-mot-phan"></i>';
    return "<tr>" +
      "<td>" + escHtmlCX5(item.ten) + "</td>" +
      "<td>" + item.bao + "</td>" +
      "<td>" + item.kg.toFixed(1) + "</td>" +
      "<td>" + trangThai + "</td>" +
      "</tr>";
  }).join("");
}

// ── Xem rộng (xoay ngang): chuyển hẳn bảng vào overlay toàn màn hình,
// chỉ 1 bảng được xoay tại 1 thời điểm nên không thể đè lên nhau, và nút
// đóng luôn nổi cố định trên cùng nên không bao giờ bị che ──
let cx5XoayMocGoc = null;

function xoayBangCX5(id) {
  const wrap = document.getElementById(id + "-wrap");
  const overlay = document.getElementById("cx5-overlay-xoay");
  const content = document.getElementById("cx5-overlay-xoay-content");
  if (!wrap || !overlay || !content) return;

  const tieude = document.getElementById("cx5-xoay-tieude");
  if (tieude) tieude.textContent = id === "cx5-bang-chitiet" ? "Chi tiết" : "Tổng hợp";

  cx5XoayMocGoc = document.createComment("cx5-xoay-moc:" + id);
  wrap.parentNode.insertBefore(cx5XoayMocGoc, wrap);
  content.appendChild(wrap);
  overlay.classList.add("show");
}

function dongXoayCX5() {
  const overlay = document.getElementById("cx5-overlay-xoay");
  const content = document.getElementById("cx5-overlay-xoay-content");
  if (!overlay || !content) return;
  const wrap = content.firstElementChild;
  if (wrap && cx5XoayMocGoc && cx5XoayMocGoc.parentNode) {
    cx5XoayMocGoc.parentNode.insertBefore(wrap, cx5XoayMocGoc);
    cx5XoayMocGoc.parentNode.removeChild(cx5XoayMocGoc);
  }
  cx5XoayMocGoc = null;
  overlay.classList.remove("show");
}
window.dongXoayCX5 = dongXoayCX5;

function ketThucPhienCX5() {
  if (phienCX5.length === 0) { showCanhBaoCX5("Chưa có dữ liệu để kết thúc phiên"); return; }
  dangKetThucCX5 = true;
  luuPhienDoDangCX5();
  moDoiChieuCX5();
}

function dongDoiChieuCX5() {
  document.getElementById("cx5-doichieu").style.display = "none";
  document.getElementById("cx5-nhap").style.display = "block";
}

function moDoiChieuCX5() {
  document.getElementById("cx5-nhap").style.display = "none";
  document.getElementById("cx5-doichieu").style.display = "block";
  document.getElementById("cx5-sx-ten").value = "";
  document.getElementById("cx5-sx-msp").value = "";
  document.getElementById("cx5-sx-kg").value = "";
  renderDoiChieuCX5();
}

let filteredSXCX5 = [];
let activeIndexSXCX5 = -1;

function onInputSXCX5() {
  document.getElementById("cx5-sx-msp").value = "";
  const query = document.getElementById("cx5-sx-ten").value.trim();
  if (!query) { closeDropdownSXCX5(); return; }
  if (typeof tkLocDanhSach === "function") {
    filteredSXCX5 = tkLocDanhSach(mspDataCX5, query, 30);
  } else {
    const q = boDauCX5(query).toUpperCase();
    filteredSXCX5 = mspDataCX5.filter(item => boDauCX5(item.ten).toUpperCase().includes(q)).slice(0, 30);
  }
  activeIndexSXCX5 = -1;
  renderDropdownSXCX5();
}

function renderDropdownSXCX5() {
  const el = document.getElementById("cx5-sx-dropdown");
  if (!el) return;
  if (filteredSXCX5.length === 0) {
    el.classList.remove("open"); el.innerHTML = "";
    return;
  }
  el.innerHTML = filteredSXCX5.map((item, idx) =>
    '<div class="cx5-dropdown-item' + (idx === activeIndexSXCX5 ? " active" : "") + '" data-idx="' + idx + '">' + escHtmlCX5(item.ten) + '</div>'
  ).join("");
  el.classList.add("open");
  Array.from(el.children).forEach(child => {
    child.addEventListener("mousedown", e => {
      e.preventDefault();
      chonQCSXCX5(filteredSXCX5[parseInt(child.getAttribute("data-idx"), 10)]);
    });
  });
}

function closeDropdownSXCX5() {
  filteredSXCX5 = [];
  activeIndexSXCX5 = -1;
  const el = document.getElementById("cx5-sx-dropdown");
  if (el) { el.classList.remove("open"); el.innerHTML = ""; }
}

function chonQCSXCX5(item) {
  document.getElementById("cx5-sx-ten").value = item.ten;
  document.getElementById("cx5-sx-msp").value = item.msp;
  closeDropdownSXCX5();
  document.getElementById("cx5-sx-kg").focus();
}

function themDongSXCX5() {
  const msp = document.getElementById("cx5-sx-msp").value;
  const ten = document.getElementById("cx5-sx-ten").value.trim();
  const kg = parseFloat(document.getElementById("cx5-sx-kg").value);
  if (!ten) { showCanhBaoCX5("Chưa chọn quy cách SX hợp lệ"); return; }
  if (!kg || kg <= 0) { showCanhBaoCX5("Nhập số kg SX hợp lệ"); return; }

  const key = keyQCX5(msp || "NO_MSP", ten);
  if (!doiChieuCX5[key]) {
    doiChieuCX5[key] = { msp: msp || "NO_MSP", ten: ten, sxEntries: [] };
  }
  doiChieuCX5[key].sxEntries.push(kg);
  luuPhienDoDangCX5();
  renderDoiChieuCX5();

  document.getElementById("cx5-sx-kg").value = "";
  document.getElementById("cx5-sx-ten").value = "";
  document.getElementById("cx5-sx-msp").value = "";
  document.getElementById("cx5-sx-ten").focus();
}

function themSoSXCX5(key, inputEl) {
  const val = parseFloat(inputEl.value);
  if (!val || val <= 0) return;
  if (!doiChieuCX5[key]) doiChieuCX5[key] = { sxEntries: [] };
  doiChieuCX5[key].sxEntries.push(val);
  inputEl.value = "";
  luuPhienDoDangCX5();
  renderDoiChieuCX5();
}

function xoaSoSXCX5(key, idx) {
  if (!doiChieuCX5[key]) return;
  doiChieuCX5[key].sxEntries.splice(idx, 1);
  luuPhienDoDangCX5();
  renderDoiChieuCX5();
}

function xoaHangDoiChieuCX5(key) {
  moXacNhanCX5("Xóa dữ liệu SX của quy cách này?", () => {
    delete doiChieuCX5[key];
    luuPhienDoDangCX5();
    renderDoiChieuCX5();
  });
}
window.xoaHangDoiChieuCX5 = xoaHangDoiChieuCX5;

let cx5DoiChieuFilter = "ALL";

function datFilterDoiChieuCX5(filterKey) {
  if (cx5DoiChieuFilter === filterKey) {
    cx5DoiChieuFilter = "ALL";
  } else {
    cx5DoiChieuFilter = filterKey;
  }
  const tabs = ["KHOP", "LECH", "KHO_ONLY", "SX_ONLY"];
  tabs.forEach(t => {
    const el = document.getElementById("cx5-tab-" + t);
    if (el) el.classList.toggle("active", t === cx5DoiChieuFilter);
  });
  renderDoiChieuCX5();
}
window.datFilterDoiChieuCX5 = datFilterDoiChieuCX5;

function themKgKhoDoiChieuCX5(key, inputEl) {
  const kg = parseFloat(inputEl.value);
  if (!kg || kg <= 0) { showCanhBaoCX5("Nhập số kg Kho hợp lệ"); return; }
  const parts = key.split("|");
  const msp = parts[0] || "";
  const ten = parts[1] || key;

  luotDemCX5 += 1;
  const luotId = luotDemCX5;
  seqCX5 += 1;
  phienCX5.push({ seq: seqCX5, msp, ten, kg, luot: luotId, thoiGian: new Date(), daDongBo: false });
  luuPhienDoDangCX5();
  renderBangChiTietCX5();
  renderBangTongHopCX5();
  renderDoiChieuCX5();
  inputEl.value = "";
}
window.themKgKhoDoiChieuCX5 = themKgKhoDoiChieuCX5;

function moSuaLuotKhoDoiChieuCX5(key) {
  const parts = key.split("|");
  const msp = parts[0];
  const ten = parts[1] || key;
  const rows = phienCX5.filter(r => (r.msp === msp || r.ten === ten));
  if (rows.length === 0) { showCanhBaoCX5("Chưa có lượt Kho nào cho quy cách này"); return; }
  const luotId = rows[rows.length - 1].luot;
  moSuaLuotCX5(luotId);
}
window.moSuaLuotKhoDoiChieuCX5 = moSuaLuotKhoDoiChieuCX5;

function renderDoiChieuCX5() {
  const gom = tomTatCX5();
  const allKeys = Array.from(new Set([...Object.keys(gom), ...Object.keys(doiChieuCX5)]));

  allKeys.forEach(key => {
    if (!doiChieuCX5[key]) {
      const g = gom[key];
      doiChieuCX5[key] = { msp: g ? g.msp : "", ten: g ? g.ten : key.split("|")[1] || key, sxEntries: [] };
    }
  });

  const container = document.getElementById("cx5-doichieu-list");
  let coTheDongBo = false;
  let coDaDongBoGi = false;

  let countKhop = 0, countLech = 0, countKhoOnly = 0, countSxOnly = 0;

  const items = allKeys.map(key => {
    const kho = gom[key] || { bao: 0, kg: 0, baoDaDongBo: 0 };
    const dc = doiChieuCX5[key] || { ten: key, sxEntries: [] };
    const sxTong = Math.round(dc.sxEntries.reduce((s, v) => s + v, 0) * 10) / 10;
    const khoKgNorm = Math.round(kho.kg * 10) / 10;
    const khop = Math.round(sxTong * 10) === Math.round(khoKgNorm * 10) && khoKgNorm > 0;
    const conDeDongBo = (kho.bao - (kho.baoDaDongBo || 0)) > 0;

    if (khop && conDeDongBo) coTheDongBo = true;
    if ((kho.baoDaDongBo || 0) > 0) coDaDongBoGi = true;

    let loaiTrangThai = "OTHER";
    if (kho.bao === 0 && sxTong > 0) { loaiTrangThai = "SX_ONLY"; countSxOnly++; }
    else if (kho.bao > 0 && sxTong === 0) { loaiTrangThai = "KHO_ONLY"; countKhoOnly++; }
    else if (khop) { loaiTrangThai = "KHOP"; countKhop++; }
    else { loaiTrangThai = "LECH"; countLech++; }

    return { key, kho, dc, sxTong, khoKgNorm, khop, conDeDongBo, loaiTrangThai };
  });

  // Cập nhật số đếm trên các Tab Filter
  const elKhop = document.getElementById("cx5-cnt-KHOP"); if (elKhop) elKhop.textContent = countKhop;
  const elLech = document.getElementById("cx5-cnt-LECH"); if (elLech) elLech.textContent = countLech;
  const elKho = document.getElementById("cx5-cnt-KHO_ONLY"); if (elKho) elKho.textContent = countKhoOnly;
  const elSx = document.getElementById("cx5-cnt-SX_ONLY"); if (elSx) elSx.textContent = countSxOnly;

  const filteredItems = items.filter(it => {
    if (cx5DoiChieuFilter === "ALL") return true;
    return it.loaiTrangThai === cx5DoiChieuFilter;
  });

  let html = "";
  if (filteredItems.length === 0) {
    html += '<div style="text-align:center;color:var(--cream-soft);padding:16px 0">Không có quy cách nào trong mục này</div>';
  } else {
    html += '<div class="cx5-scroll"><table class="cx5-table cx5-dc-table">' +
      '<thead><tr><th>QC</th><th>Kho</th><th>SX</th><th>Loại</th></tr></thead><tbody>';
    html += filteredItems.map(it => {
      const { key, kho, dc, sxTong, khoKgNorm, khop, conDeDongBo, loaiTrangThai } = it;
      const ten = escHtmlCX5(dc.ten || kho.ten);

      let iconHtml;
      if (loaiTrangThai === "KHOP") {
        if (!conDeDongBo) {
          iconHtml = '<i class="ti ti-checks" style="color:var(--success);font-size:17px;" title="Đã đồng bộ"></i>';
        } else {
          iconHtml = '<i class="ti ti-check" style="color:var(--success);font-size:17px;" title="Khớp"></i>';
        }
      } else if (loaiTrangThai === "LECH") {
        iconHtml = '<i class="ti ti-alert-triangle" style="color:var(--danger);font-size:17px;" title="Lệch"></i>';
      } else if (loaiTrangThai === "KHO_ONLY") {
        iconHtml = '<i class="ti ti-box" style="color:#3b82f6;font-size:17px;" title="Kho chưa có SX"></i>';
      } else if (loaiTrangThai === "SX_ONLY") {
        iconHtml = '<i class="ti ti-building-factory-2" style="color:#a855f7;font-size:17px;" title="SX chưa có Kho"></i>';
      } else {
        iconHtml = '—';
      }

      return '<tr class="cx5-dc-row" onclick="moDcChiTietCX5(\'' + escHtmlCX5(key) + '\')">' +
        '<td>' + ten + '</td>' +
        '<td>' + khoKgNorm.toFixed(1) + '</td>' +
        '<td>' + sxTong.toFixed(1) + '</td>' +
        '<td style="text-align:center">' + iconHtml + '</td>' +
        '</tr>';
    }).join("");
    html += '</tbody></table></div>';
  }

  html += '<button class="btn btn-full" style="background:var(--neutral-solid);color:var(--cream);margin-top:12px" ' + (coDaDongBoGi ? "" : "disabled") +
    ' onclick="xemTongKgGhepPalletCX5()"><i class="ti ti-layers-intersect"></i> Tổng kg pallet</button>';

  html += '<button id="cx5-btn-dongbo-tatca" class="btn btn-blue btn-full" style="margin-top:8px" ' + (coTheDongBo ? "" : "disabled") + ' onclick="dongBoTatCaCX5()"><i class="ti ti-refresh"></i> Đồng bộ</button>';

  container.innerHTML = html;
}

// ── Overlay chi tiết đối chiếu (khi click hàng trong bảng) ──
function moDcChiTietCX5(key) {
  const gom = tomTatCX5();
  const kho = gom[key] || { bao: 0, kg: 0, baoDaDongBo: 0 };
  const dc = doiChieuCX5[key] || { ten: key, sxEntries: [] };
  const sxTong = Math.round(dc.sxEntries.reduce((s, v) => s + v, 0) * 10) / 10;
  const khoKgNorm = Math.round(kho.kg * 10) / 10;
  const khop = Math.round(sxTong * 10) === Math.round(khoKgNorm * 10) && khoKgNorm > 0;
  const conDeDongBo = (kho.bao - (kho.baoDaDongBo || 0)) > 0;

  document.getElementById("cx5-dcc-tieude").textContent = dc.ten || kho.ten || key;

  const dsSo = dc.sxEntries.map((v, idx) =>
    '<span class="cx5-so-sx">' + v + ' <i class="ti ti-x" onclick="xoaSoSXCX5(\'' + escHtmlCX5(key) + '\',' + idx + ');moDcChiTietCX5(\'' + escHtmlCX5(key) + '\')"></i></span>'
  ).join("");

  let ketQuaHtml;
  if (kho.bao === 0) {
    ketQuaHtml = sxTong > 0
      ? '<div class="cx5-dc-ketqua cx5-dc-lech"><i class="ti ti-info-circle"></i> Kho chưa nhập — SX báo: ' + sxTong.toFixed(1) + 'kg</div>'
      : '<div class="cx5-dc-ketqua" style="color:var(--cream-soft)"><i class="ti ti-info-circle"></i> Kho chưa nhập gì cho quy cách này</div>';
  } else if (sxTong === 0) {
    ketQuaHtml = '<div class="cx5-dc-ketqua cx5-dc-lech"><i class="ti ti-info-circle"></i> Kho đã nhập (' + khoKgNorm.toFixed(1) + 'kg) — SX chưa báo</div>';
  } else if (!conDeDongBo) {
    ketQuaHtml = '<div class="cx5-dc-ketqua cx5-dc-khop"><i class="ti ti-checks"></i> Đã đồng bộ</div>';
  } else if (khop) {
    ketQuaHtml = '<div class="cx5-dc-ketqua cx5-dc-khop"><i class="ti ti-check"></i> Khớp hoàn toàn — sẵn sàng đồng bộ</div>';
  } else {
    const lech = Math.round((sxTong - khoKgNorm) * 10) / 10;
    ketQuaHtml = '<div class="cx5-dc-ketqua cx5-dc-lech"><i class="ti ti-alert-triangle"></i> Lệch: ' + (lech > 0 ? "+" : "") + lech.toFixed(1) + 'kg (Kho: ' + khoKgNorm.toFixed(1) + 'kg vs SX: ' + sxTong.toFixed(1) + 'kg)</div>';
  }

  const nd = document.getElementById("cx5-dcc-noidung");
  nd.innerHTML =
    // Thông tin bên KHO
    '<div style="background:var(--card-raised);border:1px solid var(--line);padding:10px 12px;border-radius:10px;margin-bottom:8px">' +
    '<div style="font-size:13px;font-weight:600;color:var(--cream);display:flex;align-items:center;gap:6px"><i class="ti ti-box" style="color:#3b82f6;font-size:16px"></i> <b>KHO</b> — Bao: <b>' + kho.bao + '</b> · Kg: <b>' + khoKgNorm.toFixed(1) + '</b></div>' +
    '</div>' +

    // Thông tin bên SX
    '<div style="background:var(--card-raised);border:1px solid var(--line);padding:10px 12px;border-radius:10px;margin-bottom:8px">' +
    '<div style="font-size:13px;font-weight:600;color:var(--cream);display:flex;align-items:center;gap:6px"><i class="ti ti-building-factory-2" style="color:#a855f7;font-size:16px"></i> <b>SẢN XUẤT (SX)</b></div>' +
    '<div style="margin-top:6px">' + (dsSo || '<span style="color:var(--cream-soft);font-style:italic">Chưa có số SX</span>') + '</div>' +
    '<div style="margin-top:10px;padding:8px 12px;background:rgba(168,85,247,0.12);border:1px solid rgba(168,85,247,0.3);border-radius:8px;display:flex;justify-content:space-between;align-items:center;">' +
    '<span style="font-size:13px;color:var(--cream);font-weight:600;">Tổng SX:</span>' +
    '<span style="font-size:16px;font-weight:700;color:#c084fc;font-family:\'IBM Plex Mono\',monospace;">' + sxTong.toFixed(1) + ' kg</span>' +
    '</div>' +
    '</div>' +

    ketQuaHtml +

    // Nút hành động
    '<div style="display:flex;gap:8px;margin-top:14px">' +
    '<button class="btn btn-red btn-sm" style="flex:1" onclick="xoaHangDoiChieuCX5(\'' + escHtmlCX5(key) + '\');dongDcChiTietCX5()"><i class="ti ti-trash"></i> Xóa dữ liệu SX</button>' +
    '<button class="btn btn-sm" style="flex:1;background:var(--neutral-solid);color:var(--cream)" onclick="dongDcChiTietCX5()">Đóng</button>' +
    '</div>';

  document.getElementById("cx5-overlay-dc-chitiet").classList.add("show");
}
window.moDcChiTietCX5 = moDcChiTietCX5;

function dongDcChiTietCX5() {
  document.getElementById("cx5-overlay-dc-chitiet").classList.remove("show");
}
window.dongDcChiTietCX5 = dongDcChiTietCX5;

window.onInputSXCX5 = onInputSXCX5;
window.themDongSXCX5 = themDongSXCX5;

function xemTongKgGhepPalletCX5() {
  const gom = tomTatCX5();
  const dsQC = Object.keys(gom)
    .filter(key => gom[key] && (gom[key].bao > 0 || (gom[key].baoDaDongBo || 0) > 0))
    .map(key => ({ msp: gom[key].msp, ten: gom[key].ten }));
  if (dsQC.length === 0) { showCanhBaoCX5("Chưa có quy cách nào trong phiên này"); return; }
  moTongKgCX5(dsQC);
}
window.xemTongKgGhepPalletCX5 = xemTongKgGhepPalletCX5;

function docPendingCX5() {
  try { return JSON.parse(localStorage.getItem("cx5_pending_saves")) || []; } catch (e) { return []; }
}

function luuPendingCX5(list) {
  try { localStorage.setItem("cx5_pending_saves", JSON.stringify(list)); } catch (e) { }
  capNhatDongPendingCX5();
}

function capNhatDongPendingCX5() {
  const soLuong = docPendingCX5().length;
  const noiDung = "Còn " + soLuong + " mục chưa đồng bộ — sẽ tự gửi lại khi có mạng";
  [document.getElementById("cx5-pending-line"), document.getElementById("cx5-pending-line-dc")].forEach(el => {
    if (!el) return;
    if (soLuong > 0) { el.textContent = noiDung; el.style.display = "block"; }
    else { el.style.display = "none"; }
  });
}

async function dongBoMotQC_(key) {
  const dc = doiChieuCX5[key];
  if (!dc) return true;
  const chuaDongBo = phienCX5.filter(r => keyQCX5(r.msp, r.ten) === key && !r.daDongBo);
  if (chuaDongBo.length === 0) return true;

  const bao = chuaDongBo.length;
  const kg = chuaDongBo.reduce((s, r) => s + r.kg, 0);
  const kgList = chuaDongBo.map(r => r.kg);

  const lotMap = new Map();
  const lotOrder = [];
  chuaDongBo.forEach(r => {
    if (!lotMap.has(r.luot)) { lotMap.set(r.luot, []); lotOrder.push(r.luot); }
    lotMap.get(r.luot).push(r.kg);
  });
  const lots = lotOrder.map(lid => ({ kgList: lotMap.get(lid) }));

  const payload = {
    dateStr: ngayCX5, msp: dc.msp, ten: dc.ten,
    bao: Math.round(bao * 100) / 100, kg: Math.round(kg * 100) / 100, kgList, lots
  };

  try {
    const r = await callApiCX5({ action: "submitEntryX5", payload });
    if (!r.success) { showCanhBaoCX5(dc.ten + ": " + r.message); return false; }
    chuaDongBo.forEach(row => { row.daDongBo = true; });
    return true;
  } catch (e) {
    const pending = docPendingCX5();
    pending.push(payload);
    luuPendingCX5(pending);
    chuaDongBo.forEach(row => { row.daDongBo = true; });
    return true;
  }
}

async function dongBoTatCaCX5() {
  const gom = tomTatCX5();
  const dsCanDongBo = Object.keys(doiChieuCX5).filter(key => {
    const kho = gom[key];
    if (!kho) return false;
    const dc = doiChieuCX5[key];
    const sxTong = dc.sxEntries.reduce((s, v) => s + v, 0);
    const khop = Math.round(sxTong * 100) === Math.round(kho.kg * 100) && kho.kg > 0;
    const conDeDongBo = (kho.bao - (kho.baoDaDongBo || 0)) > 0;
    return khop && conDeDongBo;
  });

  if (dsCanDongBo.length === 0) { showCanhBaoCX5("Không có quy cách nào đủ điều kiện đồng bộ"); return; }

  const btn = document.getElementById("cx5-btn-dongbo-tatca");
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-refresh"></i> Đang đồng bộ...'; }
  showLoading(true);

  let thanhCong = 0, thatBai = 0;
  const dsThanhCongCX5 = [];
  const results = await Promise.all(dsCanDongBo.map(async key => {
    const ok = await dongBoMotQC_(key);
    return { key, ok };
  }));

  for (const res of results) {
    if (res.ok) { thanhCong += 1; dsThanhCongCX5.push(res.key); }
    else { thatBai += 1; }
  }

  showLoading(false);
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-refresh"></i> Đồng bộ'; }

  luuPhienDoDangCX5();
  renderBangChiTietCX5();
  renderBangTongHopCX5();
  renderDoiChieuCX5();
  if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();

  if (thatBai === 0) showCanhBaoCX5("Đã đồng bộ " + thanhCong + " quy cách");
  else showCanhBaoCX5("Đồng bộ " + thanhCong + " thành công, " + thatBai + " lỗi");

  if (dsThanhCongCX5.length > 0) {
    const dsQC = Object.keys(gom)
      .filter(key => gom[key] && (gom[key].bao > 0 || (gom[key].baoDaDongBo || 0) > 0))
      .map(key => ({ msp: gom[key].msp, ten: gom[key].ten }));
    moTongKgCX5(dsQC);
  }
}

async function moTongKgCX5(dsQC) {
  showLoading(true);
  let res;
  try {
    res = await callApiCX5({ action: "layUngVienGhepCX5", payload: { dsQC: dsQC, dateStr: ngayCX5 } });
  } catch (e) {
    showLoading(false);
    showCanhBaoCX5("Lỗi tải dữ liệu ghép pallet: " + e.message);
    return;
  }
  showLoading(false);

  if (res.error) { showCanhBaoCX5("Lỗi: " + res.error); return; }

  tongKgDataCX5 = {};
  tongKetPhienCX5 = [];
  const daXuLyQC = new Set();
  dsQC.forEach(function (q) {
    const key = q.msp + "|" + q.ten;
    if (daXuLyQC.has(key)) return;
    daXuLyQC.add(key);
    const duLieuQC = res[key] || { homNay: [], cu: [] };
    const homNayList = (duLieuQC.homNay || []).filter(function (c) { return c.bao < 10; });
    const cu = (duLieuQC.cu || [])
      .map(function (c) { return Object.assign({ checked: false }, c); });
    (duLieuQC.homNay || []).forEach(function (c) {
      if (!tongKetPhienCX5.some(function (x) { return x.row === c.row; })) tongKetPhienCX5.push(Object.assign({ msp: q.msp, ten: q.ten }, c));
    });
    homNayList.forEach(function (homNay) {
      const keyKhoi = key + "|" + homNay.row;
      tongKgDataCX5[keyKhoi] = { msp: q.msp, ten: q.ten, homNay: homNay, cu: cu.map(function (c) { return Object.assign({}, c); }) };
    });
  });

  document.getElementById("cx5-doichieu").style.display = "none";
  document.getElementById("cx5-tongkg").style.display = "block";
  renderTongKgCX5();
}

function renderTongKgCX5() {
  const container = document.getElementById("cx5-tongkg-list");
  const keys = Object.keys(tongKgDataCX5);

  if (keys.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--cream-soft);padding:16px 0">Không có quy cách nào dưới 10 bao cần ghép</div>';
    renderTongKetPhienTongKgCX5();
    return;
  }

  const html = keys.map(function (key) {
    const d = tongKgDataCX5[key];
    let tongBao = d.homNay.bao, tongKg = d.homNay.kg;
    d.cu.forEach(function (c) { if (c.checked) { tongBao += c.bao; tongKg += c.kg; } });

    const dsCu = d.cu.map(function (c, idx) {
      const daChonOKhoiKhac = dangDuocChonODauKhacCX5(c.row, key);
      const disabled = daChonOKhoiKhac ? " disabled" : "";
      const lopMo = daChonOKhoiKhac ? " cx5-tk-row-disabled" : "";
      return '<div class="cx5-tk-row" style="display:flex;align-items:center;gap:8px;padding:6px 0">' +
        '<input type="checkbox" ' + (c.checked ? "checked" : "") + disabled + ' onchange="toggleGhepCX5(\'' + key + '\',' + idx + ')">' +
        '<span class="' + lopMo + '" style="flex:1;font-size:13px">Ngày ' + c.ngay + ': ' +
        '<span class="cx5-tk-kg-chip" onclick="xemNguonGocCX5(' + c.row + ')">' + c.kg.toFixed(1) + 'kg (' + c.bao + ' bao)</span>' +
        (daChonOKhoiKhac ? ' · Đã chọn ở khối khác' : '') + '</span>' +
        '<button type="button" class="cx5-tk-xoa"' + disabled + ' title="Ẩn ứng viên này" aria-label="Ẩn ứng viên này" onclick="xoaUngVienGhepCX5(\'' + key + '\',' + idx + ')"><i class="ti ti-x"></i></button>' +
        '</div>';
    }).join("");

    return '<div class="cx5-dc-card">' +
      '<div class="cx5-dc-ten">' + escHtmlCX5(d.ten) + '</div>' +
      '<div class="cx5-dc-kho">Hôm nay: <b>' + d.homNay.kg.toFixed(1) + 'kg (' + d.homNay.bao + ' bao)</b></div>' +
      (dsCu
        ? '<div style="margin-top:8px">' + dsCu + '</div>'
        : '<div style="margin-top:8px;color:var(--cream-soft);font-size:12px">Không có ngày cũ nào còn dư</div>') +
      '<div class="cx5-dc-tong cx5-tk-tong" style="margin-top:8px">Tổng: <b>' + tongKg.toFixed(1) + 'kg (' + tongBao + ' bao)</b></div>' +
      '</div>';
  }).join("");

  container.innerHTML = html;
  renderTongKetPhienTongKgCX5();
}
window.renderTongKgCX5 = renderTongKgCX5;

function dangDuocChonODauKhacCX5(row, keyHienTai) {
  return Object.keys(tongKgDataCX5).some(function (key) {
    return key !== keyHienTai && tongKgDataCX5[key].cu.some(function (c) { return c.row === row && c.checked; });
  });
}

function renderTongKetPhienTongKgCX5() {
  const tbody = document.getElementById("cx5-tbody-tongkg-phien");
  if (!tbody) return;

  const daXuLy = new Set();
  const danhSach = [];

  // 1) Gom theo từng quy cách trong tongKetPhienCX5
  tongKetPhienCX5.forEach(function (item) {
    const key = item.msp + "|" + item.ten;
    if (daXuLy.has(key)) return;
    daXuLy.add(key);

    const card = Object.keys(tongKgDataCX5).map(function (k) { return tongKgDataCX5[k]; }).find(function (d) { return d.homNay.row === item.row; });
    let bao = item.bao;
    let kg = item.kg;
    let trangThaiHtml = '<i class="ti ti-minus" style="color:var(--cream-soft);font-size:18px" title="Chưa ghép"></i>';

    if (card) {
      const chosen = card.cu.filter(function (c) { return c.checked; });
      if (chosen.length > 0) {
        bao += chosen.reduce(function (s, c) { return s + c.bao; }, 0);
        kg += chosen.reduce(function (s, c) { return s + c.kg; }, 0);
        trangThaiHtml = '<i class="ti ti-layers-intersect" style="color:var(--accent-2);font-size:18px" title="Đã chọn ghép"></i>';
      } else if (bao >= 10) {
        trangThaiHtml = '<i class="ti ti-check" style="color:var(--success);font-size:18px" title="OK (≥10 bao)"></i>';
      }
    } else if (bao >= 10) {
      trangThaiHtml = '<i class="ti ti-check" style="color:var(--success);font-size:18px" title="OK (≥10 bao)"></i>';
    }

    danhSach.push({
      ten: item.ten,
      bao: bao,
      kg: Math.round(kg * 10) / 10,
      trangThaiHtml: trangThaiHtml
    });
  });

  // 2) Các quy cách nhập trong phiên chưa có trên server
  const gom = tomTatCX5();
  Object.keys(gom).forEach(function (key) {
    if (daXuLy.has(key)) return;
    daXuLy.add(key);
    const g = gom[key];
    let trangThaiHtml = g.baoDaDongBo > 0
      ? '<i class="ti ti-check" style="color:var(--success);font-size:18px" title="OK"></i>'
      : '<i class="ti ti-cloud-upload" style="color:var(--danger);font-size:18px" title="Chưa đồng bộ"></i>';

    danhSach.push({
      ten: g.ten,
      bao: g.bao,
      kg: Math.round(g.kg * 10) / 10,
      trangThaiHtml: trangThaiHtml
    });
  });

  if (danhSach.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--cream-soft);font-style:italic">Chưa có dữ liệu</td></tr>';
    return;
  }

  tbody.innerHTML = danhSach.map(function (item) {
    return "<tr>" +
      "<td>" + escHtmlCX5(item.ten) + "</td>" +
      "<td>" + item.bao + "</td>" +
      "<td>" + item.kg.toFixed(1) + "</td>" +
      '<td style="text-align:center">' + item.trangThaiHtml + "</td>" +
      "</tr>";
  }).join("");
}

function toggleGhepCX5(key, idx) {
  const d = tongKgDataCX5[key];
  if (!d || !d.cu[idx]) return;
  d.cu[idx].checked = !d.cu[idx].checked;
  renderTongKgCX5();
}
window.toggleGhepCX5 = toggleGhepCX5;

function xoaUngVienGhepCX5(key, idx) {
  const d = tongKgDataCX5[key];
  const candidate = d && d.cu[idx];
  if (!candidate) return;

  moXacNhanCX5("Ẩn ứng viên ghép pallet này khỏi danh sách? Muốn khôi phục phải sửa lại từ sheet gốc.", async () => {
    showLoading(true);
    try {
      const r = await callApiCX5({ action: "xoaUngVienGhepCX5", payload: { row: candidate.row } });
      if (!r.success) { showCanhBaoCX5("Lỗi: " + (r.message || "không rõ nguyên nhân")); return; }
      Object.keys(tongKgDataCX5).forEach(function (keyKhoi) {
        tongKgDataCX5[keyKhoi].cu = tongKgDataCX5[keyKhoi].cu.filter(function (c) { return c.row !== candidate.row; });
      });
      renderTongKgCX5();
    } catch (e) {
      showCanhBaoCX5("Mất mạng — thử lại: " + e.message);
    } finally {
      showLoading(false);
    }
  }, "Ẩn ứng viên");
}
window.xoaUngVienGhepCX5 = xoaUngVienGhepCX5;

async function dongBoGhepCX5() {
  const groups = [];
  Object.keys(tongKgDataCX5).forEach(function (key) {
    const d = tongKgDataCX5[key];
    const chosen = d.cu.filter(function (c) { return c.checked; });
    if (chosen.length === 0) return;

    let tongBao = d.homNay.bao, tongKg = d.homNay.kg;
    chosen.forEach(function (c) { tongBao += c.bao; tongKg += c.kg; });

    groups.push({
      key: key,
      rowNeo: d.homNay.row,
      tongBao: tongBao,
      tongKg: Math.round(tongKg * 100) / 100,
      cuList: chosen.map(function (c) { return { row: c.row, bao: c.bao, kg: c.kg }; })
    });
  });

  const btn = document.getElementById("cx5-btn-ghep");
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-refresh"></i> Đang đồng bộ...'; }
  showLoading(true);

  try {
    const payloadGroups = groups.map(function (g) {
      return { rowNeo: g.rowNeo, tongBao: g.tongBao, tongKg: g.tongKg, cuList: g.cuList };
    });
    const r = await callApiCX5({ action: "ghiGhepCX5", payload: { groups: payloadGroups } });
    showLoading(false);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-refresh"></i> Đồng bộ Bảng Tổng kết'; }
    if (!r.success) { showCanhBaoCX5("Lỗi: " + (r.message || "không rõ nguyên nhân")); return; }

    groups.forEach(function (g) {
      const d = tongKgDataCX5[g.key];
      if (!d) return;
      d.homNay.bao = g.tongBao;
      d.homNay.kg = g.tongKg;
      const rowsDaGhep = g.cuList.map(function (c) { return c.row; });
      d.cu = d.cu.filter(function (c) { return rowsDaGhep.indexOf(c.row) === -1; });

      const phien = tongKetPhienCX5.find(function (x) { return x.row === d.homNay.row; });
      if (phien) { phien.bao = g.tongBao; phien.kg = g.tongKg; }
    });

    if (groups.length > 0) {
      showCanhBaoCX5("Đã ghi ghép pallet cho " + groups.length + " quy cách");
    } else {
      showCanhBaoCX5("Đã đồng bộ Bảng Tổng kết thành công!");
    }
    renderTongKgCX5();
  } catch (e) {
    showLoading(false);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-refresh"></i> Đồng bộ Bảng Tổng kết'; }
    showCanhBaoCX5("Mất mạng — thử lại: " + e.message);
  }
}
window.dongBoGhepCX5 = dongBoGhepCX5;

function quayLaiDoiChieuCX5() {
  document.getElementById("cx5-tongkg").style.display = "none";
  document.getElementById("cx5-doichieu").style.display = "block";
}
window.quayLaiDoiChieuCX5 = quayLaiDoiChieuCX5;

function boQuaTongKgCX5() {
  document.getElementById("cx5-tongkg").style.display = "none";
  document.getElementById("cx5-form").style.display = "block";
  if (typeof diToiTab === "function") diToiTab("trangChu");
}
window.boQuaTongKgCX5 = boQuaTongKgCX5;

// Bấm vào số kg của 1 dòng "ngày cũ" -> xổ chi tiết theo từng dòng nguồn gốc
// (chính dòng đó + mọi dòng trong cột W, đã làm phẳng sẵn ở phía server).
async function xemNguonGocCX5(row) {
  showLoading(true);
  let res;
  try {
    res = await callApiCX5({ action: "layChiTietNguonGocCX5", payload: { row: row } });
  } catch (e) {
    showLoading(false);
    showCanhBaoCX5("Lỗi tải chi tiết nguồn gốc: " + e.message);
    return;
  }
  showLoading(false);
  if (res.error) { showCanhBaoCX5("Lỗi: " + res.error); return; }

  const nd = document.getElementById("cx5-ng-noidung");
  nd.innerHTML = (res.nguon || []).map(function (n) {
    const tongDong = n.kgList.reduce(function (s, v) { return s + v; }, 0);
    return '<div style="margin-bottom:10px">' +
      '<div style="font-size:12px;font-weight:600;color:var(--cream-soft)">Ngày ' + escHtmlCX5(n.ngay) + ' (dòng gốc) — ' + n.kgList.length + ' bao, ' + (Math.round(tongDong * 100) / 100) + 'kg</div>' +
      '<div style="margin-top:4px">' + (n.kgList.map(function (v) { return escHtmlCX5(v); }).join(" · ") || "—") + '</div>' +
      '</div>';
  }).join("") || '<div style="color:var(--cream-soft)">Không có dữ liệu</div>';

  document.getElementById("cx5-overlay-nguongoc").classList.add("show");
}
window.xemNguonGocCX5 = xemNguonGocCX5;

function dongNguonGocCX5() {
  document.getElementById("cx5-overlay-nguongoc").classList.remove("show");
}
window.dongNguonGocCX5 = dongNguonGocCX5;

async function guiLaiPendingCX5() {
  const pending = docPendingCX5();
  if (pending.length === 0) return;
  const conLai = [];
  for (const payload of pending) {
    try {
      const r = await callApiCX5({ action: "submitEntryX5", payload });
      if (!r.success) conLai.push(payload);
    } catch (e) {
      conLai.push(payload);
    }
  }
  luuPendingCX5(conLai);
  if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
}

window.addEventListener("load", guiLaiPendingCX5);
window.addEventListener("online", guiLaiPendingCX5);

function xuatExcelLichSuCX5(idPhien) {
  const list = docLichSuCX5();
  const entry = list.find(s => s.idPhien === idPhien || s.id === idPhien);
  const dataList = entry ? entry.phienCX5 : phienCX5;
  if (!dataList || dataList.length === 0) {
    alert("Chưa có dữ liệu Chỉ X5 để xuất Excel!");
    return;
  }
  const dateStr = (entry ? entry.ngay : ngayCX5) || new Date().toISOString().split("T")[0];
  const exportData = dataList.map((item, idx) => ({
    "STT": idx + 1,
    "Lượt": item.luot || item.seq,
    "Mã MSP": item.msp,
    "Quy cách": item.ten,
    "Khối lượng (Kg)": item.kg,
    "Thời gian": item.thoiGian ? new Date(item.thoiGian).toLocaleTimeString("vi-VN") : ""
  }));
  if (typeof exportToExcel === "function") {
    exportToExcel("LichSu_ChiX5_" + dateStr, "Chi X5 " + dateStr, exportData);
  }
}
window.xuatExcelLichSuCX5 = xuatExcelLichSuCX5;
window.xuatExcelCX5 = xuatExcelLichSuCX5;

function docLichSuCX5() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(CX5_LICHSU_KEY)) || []; } catch (e) { list = []; }
  const homNay = new Date();
  homNay.setHours(0, 0, 0, 0);
  return list.filter(s => {
    if (!s.ngay || !Array.isArray(s.phienCX5)) return false;
    const ngayPhien = new Date(s.ngay + "T00:00:00");
    const soNgayCach = Math.floor((homNay - ngayPhien) / 86400000);
    return soNgayCach >= 0 && soNgayCach < CX5_LICHSU_SO_NGAY_GIU;
  });
}

function luuLichSuCX5(list) {
  try { localStorage.setItem(CX5_LICHSU_KEY, JSON.stringify(list)); } catch (e) { }
}

let _cx5XacNhanCallback = null;
let _cx5XacNhanCallbackHuy = null;

function moXacNhanCX5(noiDung, callback, nhanNutOk, callbackHuy, nhanNutHuy) {
  document.getElementById("cx5-xacnhan-noidung").textContent = noiDung;
  document.getElementById("cx5-xacnhan-nut-ok").textContent = nhanNutOk || "Xóa";
  document.getElementById("cx5-xacnhan-nut-huy").textContent = nhanNutHuy || "Hủy";
  _cx5XacNhanCallback = callback;
  _cx5XacNhanCallbackHuy = callbackHuy || null;
  document.getElementById("cx5-overlay-xacnhan").classList.add("show");
}

function dongXacNhanCX5(dongY) {
  document.getElementById("cx5-overlay-xacnhan").classList.remove("show");
  const cb = _cx5XacNhanCallback;
  const cbHuy = _cx5XacNhanCallbackHuy;
  _cx5XacNhanCallback = null;
  _cx5XacNhanCallbackHuy = null;
  if (dongY && cb) cb();
  else if (!dongY && cbHuy) cbHuy();
}

function xoaMotPhienLichSuCX5(idPhien, ev) {
  if (ev) ev.stopPropagation();
  moXacNhanCX5("Xóa phiên lịch sử này? Không thể hoàn tác.", () => {
    luuLichSuCX5(docLichSuCX5().filter(s => s.idPhien !== idPhien));
    renderLichSuCX5();
  });
}

function xoaTatCaLichSuCX5() {
  const list = docLichSuCX5();
  if (list.length === 0) { showCanhBaoCX5("Không có lịch sử để xóa"); return; }
  moXacNhanCX5("Xóa toàn bộ " + list.length + " phiên lịch sử Chỉ X5? Không thể hoàn tác.", () => {
    luuLichSuCX5([]);
    renderLichSuCX5();
  });
}

function donDepLichSuCX5() {
  luuLichSuCX5(docLichSuCX5());
}

// Lưu/cập nhật (upsert) TOÀN BỘ phiên hiện tại vào Lịch sử, theo idPhien —
// giống cơ chế luuVaoLichSuCX1() bên Chỉ For, khác với bản cũ (lưu rời từng
// lần đồng bộ 1 quy cách, làm mất ranh giới giữa các lượt cùng quy cách).
function luuPhienVaoLichSuCX5() {
  if (phienCX5.length === 0 || !idPhienHienTaiC5) return;
  const list = docLichSuCX5();
  const idx = list.findIndex(s => s.idPhien === idPhienHienTaiC5);
  const banGhi = {
    idPhien: idPhienHienTaiC5,
    ngay: ngayCX5,
    capNhatLuc: new Date().toISOString(),
    phienCX5: phienCX5,
    seqCX5: seqCX5,
    doiChieuCX5: doiChieuCX5,
    dangKetThucCX5: dangKetThucCX5,
    luotDemCX5: luotDemCX5,
    luotHienTaiCX5: luotHienTaiCX5
  };
  if (idx >= 0) list[idx] = banGhi; else list.push(banGhi);
  luuLichSuCX5(list);
  if (typeof renderLichSuCX5 === "function") renderLichSuCX5();
}

function moLichSuCX5() {
  renderLichSuCX5();
  if (typeof chuyenTrangKhongNav === "function") chuyenTrangKhongNav("lichSuX5");
}
window.moLichSuCX5 = moLichSuCX5;

function renderLichSuCX5() {
  const container = document.getElementById("lichsu-x5-list");
  if (!container) return;
  const oTim = document.getElementById("lichsu-x5-tim");
  const tuKhoa = oTim ? oTim.value.trim().toLowerCase() : "";
  let list = docLichSuCX5().slice().sort((a, b) => new Date(b.capNhatLuc) - new Date(a.capNhatLuc));
  if (tuKhoa) {
    list = list.filter(s =>
      s.ngay.toLowerCase().includes(tuKhoa) ||
      s.phienCX5.some(r => (r.ten || "").toLowerCase().includes(tuKhoa) || (r.msp || "").toLowerCase().includes(tuKhoa))
    );
  }
  if (list.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--cream-soft);padding:20px 0;">'
      + (tuKhoa ? "Không tìm thấy phiên nào khớp" : "Chưa có phiên nào trong " + CX5_LICHSU_SO_NGAY_GIU + " ngày qua")
      + '</div>';
    return;
  }
  container.innerHTML = list.map(s => {
    const tongKg = s.phienCX5.reduce((t, r) => t + r.kg, 0);
    const soLuot = new Set(s.phienCX5.map(r => r.luot)).size;
    const daXongHet = s.phienCX5.every(r => r.daDongBo);
    const trangThai = daXongHet
      ? '<i class="ti ti-check cx5-trangthai-ok"></i>'
      : '<i class="ti ti-x cx5-trangthai-mot-phan"></i>';
    const gio = new Date(s.capNhatLuc).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return '<div class="irow lichsu-row" style="cursor:pointer;align-items:center" onclick="xemChiTietLichSuCX5(\'' + s.idPhien + '\')">'
      + '<span style="font-family:\'IBM Plex Sans\',sans-serif;color:var(--cream)">' + s.ngay + " · " + gio + '</span>'
      + '<span style="font-family:\'IBM Plex Sans\',sans-serif;color:var(--cream);display:inline-flex;align-items:center;gap:10px">'
      + soLuot + ' lượt · ' + tongKg.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kg'
      + '<span style="display:inline-flex;align-items:center;gap:8px;padding-left:8px;border-left:1px solid var(--line)">'
      + trangThai
      + '<button class="cx5-del-btn" aria-label="Xóa phiên này" onclick="xoaMotPhienLichSuCX5(\'' + s.idPhien + '\', event)"><i class="ti ti-trash"></i></button>'
      + '</span>'
      + '</span>'
      + '</div>';
  }).join("");
}
window.renderLichSuCX5 = renderLichSuCX5;

function xemChiTietLichSuCX5(idPhien) {
  const entry = docLichSuCX5().find(s => s.idPhien === idPhien);
  if (!entry) return;

  const gom = {};
  entry.phienCX5.forEach(r => {
    const key = r.msp + "|" + r.ten;
    if (!gom[key]) gom[key] = { ten: r.ten, bao: 0, kg: 0 };
    gom[key].bao += 1;
    gom[key].kg += r.kg;
  });
  const hang = Object.values(gom);

  const gio = new Date(entry.capNhatLuc).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  document.getElementById("cx5-ctls-tieude").textContent = entry.ngay + " · " + gio;
  document.getElementById("cx5-ctls-noidung").innerHTML = hang.map(h =>
    '<div class="irow"><span class="ilabel">' + h.ten + '</span><span class="ivalue">'
    + h.bao + ' bao · ' + h.kg.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kg</span></div>'
  ).join("");
  document.getElementById("cx5-ctls-tieptuc").setAttribute("onclick", "dongChiTietLichSuCX5();tiepTucLichSuCX5('" + idPhien + "')");
  document.getElementById("cx5-overlay-chitiet-lichsu").classList.add("show");
}
window.xemChiTietLichSuCX5 = xemChiTietLichSuCX5;

function dongChiTietLichSuCX5() {
  document.getElementById("cx5-overlay-chitiet-lichsu").classList.remove("show");
}
window.dongChiTietLichSuCX5 = dongChiTietLichSuCX5;

// Bấm vào 1 phiên trong Lịch sử → mở thẳng màn hình nhập liệu CX5 của phiên
// đó để sửa/thêm/xoá lượt, y như bấm "Tiếp tục" ở Chỉ For.
function tiepTucLichSuCX5(idPhien) {
  const list = docLichSuCX5();
  const entry = list.find(s => s.idPhien === idPhien);
  if (!entry) return;

  if (typeof diToiTab === "function") diToiTab("chiX5");
  khoiPhucCX5({
    phienCX5: entry.phienCX5,
    ngayCX5: entry.ngay,
    idPhienHienTaiC5: entry.idPhien,
    seqCX5: entry.seqCX5,
    doiChieuCX5: entry.doiChieuCX5,
    dangKetThucCX5: entry.dangKetThucCX5,
    luotDemCX5: entry.luotDemCX5,
    luotHienTaiCX5: entry.luotHienTaiCX5
  });
  // Coi phiên vừa mở từ lịch sử là phiên "đang dở dang" hiện tại, để nếu
  // thoát app giữa chừng thì lần sau vẫn thấy banner tiếp tục đúng phiên này.
  luuPhienDoDangCX5();
}
window.tiepTucLichSuCX5 = tiepTucLichSuCX5;

function tiepTucPhienChiX5() {
  let state = null;
  try { state = JSON.parse(localStorage.getItem("cx5_phien_dodang")); } catch (e) { }
  if (!state) return;
  if (typeof diToiTab === "function") diToiTab("chiX5");
  khoiPhucCX5(state);
}
window.tiepTucPhienChiX5 = tiepTucPhienChiX5;

function huyPhienChiX5() {
  xoaPhienDoDangCX5();
  if (typeof capNhatTrangChu === "function") capNhatTrangChu();
}
window.huyPhienChiX5 = huyPhienChiX5;

window.batDauCX5 = batDauCX5;
window.themDongCX5 = themDongCX5;
window.xoaDongCX5 = xoaDongCX5;
window.moKhoaQCCX5 = moKhoaQCCX5;
window.moSuaLuotCX5 = moSuaLuotCX5;
window.dongSuaLuotCX5 = dongSuaLuotCX5;
window.xoaDongTrongLuotCX5 = xoaDongTrongLuotCX5;
window.themKgVaoLuotCX5 = themKgVaoLuotCX5;
window.xoayBangCX5 = xoayBangCX5;
window.ketThucPhienCX5 = ketThucPhienCX5;
window.dongDoiChieuCX5 = dongDoiChieuCX5;
window.themSoSXCX5 = themSoSXCX5;
window.xoaSoSXCX5 = xoaSoSXCX5;
window.dongBoTatCaCX5 = dongBoTatCaCX5;

window.addEventListener("load", function () {
  const today = new Date().toISOString().split("T")[0];
  const ngayInput = document.getElementById("cx5-ngay");
  if (ngayInput) ngayInput.value = today;
  donDepLichSuCX5();

  const tenInput = document.getElementById("cx5-ten");
  const sxKgInput = document.getElementById("cx5-sx-kg");
  if (tenInput) {
    tenInput.addEventListener("input", onInputCX5);
    tenInput.addEventListener("keydown", onKeydownCX5);
    tenInput.addEventListener("focus", hienGoiYQCCX5);
  }
  document.addEventListener("click", e => {
    const trongOTimKiem = e.target.closest(".cx5-ten-wrap");
    const trongBanPhim = e.target.closest(".cx5-bp-panel");
    if (!trongOTimKiem && !trongBanPhim) { closeDropdownCX5(); }
    if (banPhimActiveElCX5 && !trongOTimKiem && !trongBanPhim && e.target !== banPhimActiveElCX5) {
      dongBanPhimCX5();
    }
  });
});

const CX5_BP_QC_MAP = { "7": "A", "8": "B", "9": "D", "4": "E", "5": "R", "6": "X", "1": "/", "2": "-", "3": "M" };
const CX5_BP_DOUBLE_TAP_MS = 300;

let banPhimActiveElCX5 = null;
let banPhimLoaiCX5 = null;
let banPhimQCPendingCX5 = null;

(function themBanPhimCX5() {
  const kgPanel = document.createElement("div");
  kgPanel.id = "cx5-bp-kg";
  kgPanel.className = "cx5-bp-panel";
  kgPanel.innerHTML =
    '<span class="cx5-bp-close" onclick="dongBanPhimCX5()">Đóng bàn phím ▾</span>' +
    '<div class="cx5-bp-grid">' +
    '<div class="cx5-bp-key" onclick="bpKgSoCX5(\'7\')">7</div>' +
    '<div class="cx5-bp-key" onclick="bpKgSoCX5(\'8\')">8</div>' +
    '<div class="cx5-bp-key" onclick="bpKgSoCX5(\'9\')">9</div>' +
    '<div class="cx5-bp-key cx5-bp-key-fn" onclick="bpKgXoaLuiCX5()">⌫</div>' +
    '<div class="cx5-bp-key" onclick="bpKgSoCX5(\'4\')">4</div>' +
    '<div class="cx5-bp-key" onclick="bpKgSoCX5(\'5\')">5</div>' +
    '<div class="cx5-bp-key" onclick="bpKgSoCX5(\'6\')">6</div>' +
    '<div class="cx5-bp-key cx5-bp-key-fn" onclick="bpKgXoaHetCX5()">C</div>' +
    '<div class="cx5-bp-key" onclick="bpKgSoCX5(\'1\')">1</div>' +
    '<div class="cx5-bp-key" onclick="bpKgSoCX5(\'2\')">2</div>' +
    '<div class="cx5-bp-key" onclick="bpKgSoCX5(\'3\')">3</div>' +
    '<div class="cx5-bp-key cx5-bp-key-enter" onclick="bpKgEnterCX5()">Enter</div>' +
    '<div class="cx5-bp-key cx5-bp-key-zero-kg" onclick="bpKgSoCX5(\'0\')">0</div>' +
    '<div class="cx5-bp-key" onclick="bpKgSoCX5(\'.\')">.</div>' +
    "</div>";
  document.body.appendChild(kgPanel);

  const qcPanel = document.createElement("div");
  qcPanel.id = "cx5-bp-qc";
  qcPanel.className = "cx5-bp-panel";
  const letters = ["A", "B", "D", "E", "R", "X", "/", "-", "m"];
  const letterBarHtml = '<div class="cx5-bp-letter-bar">' +
    letters.map(l => '<div class="cx5-bp-letter-key" onclick="bpQcSoCX5(\'' + l + '\')">' + l + '</div>').join("") +
    '</div>';
  qcPanel.innerHTML =
    '<span class="cx5-bp-close" onclick="dongBanPhimCX5()">Đóng bàn phím ▾</span>' +
    letterBarHtml +
    '<div class="cx5-bp-grid">' +
    '<div class="cx5-bp-key" onclick="bpQcSoCX5(\'7\')">7</div>' +
    '<div class="cx5-bp-key" onclick="bpQcSoCX5(\'8\')">8</div>' +
    '<div class="cx5-bp-key" onclick="bpQcSoCX5(\'9\')">9</div>' +
    '<div class="cx5-bp-key cx5-bp-key-fn" onclick="bpQcXoaLuiCX5()">⌫</div>' +
    '<div class="cx5-bp-key" onclick="bpQcSoCX5(\'4\')">4</div>' +
    '<div class="cx5-bp-key" onclick="bpQcSoCX5(\'5\')">5</div>' +
    '<div class="cx5-bp-key" onclick="bpQcSoCX5(\'6\')">6</div>' +
    '<div class="cx5-bp-key cx5-bp-key-fn" onclick="bpQcXoaHetCX5()">C</div>' +
    '<div class="cx5-bp-key" onclick="bpQcSoCX5(\'1\')">1</div>' +
    '<div class="cx5-bp-key" onclick="bpQcSoCX5(\'2\')">2</div>' +
    '<div class="cx5-bp-key" onclick="bpQcSoCX5(\'3\')">3</div>' +
    '<div class="cx5-bp-key cx5-bp-key-enter" onclick="bpQcEnterCX5()">Enter</div>' +
    '<div class="cx5-bp-key cx5-bp-key-zero" onclick="bpQcSoCX5(\'0\')">0</div>' +
    "</div>";
  document.body.appendChild(qcPanel);

  document.addEventListener("focus", function (e) {
    const el = e.target;
    if (!el || el.tagName !== "INPUT") return;
    if (el.id === "cx5-kg" || el.id === "cx5-sl-them-kg" || el.id === "cx5-sx-kg" || el.classList.contains("cx5-sx-input")) {
      moBanPhimCX5(el, "kg");
    } else if (el.id === "cx5-ten" || el.id === "cx5-sx-ten" || el.id === "cx5-sl-ten-tim") {
      moBanPhimCX5(el, "qc");
    }
  }, true);
})();

function moBanPhimCX5(el, loai) {
  banPhimActiveElCX5 = el;
  banPhimLoaiCX5 = loai;
  banPhimQCPendingCX5 = null;
  const kgPanel = document.getElementById("cx5-bp-kg");
  const qcPanel = document.getElementById("cx5-bp-qc");
  kgPanel.classList.toggle("show", loai === "kg");
  qcPanel.classList.toggle("show", loai === "qc");
  const panelHienTai = loai === "kg" ? kgPanel : qcPanel;
  
  const h = panelHienTai.offsetHeight || panelHienTai.getBoundingClientRect().height || 280;
  document.body.style.paddingBottom = h + "px";

  // Tự động đẩy tất cả Pop-up Overlay đang mở lên trên bàn phím
  document.querySelectorAll(".overlay.show").forEach(ol => {
    ol.style.paddingBottom = h + "px";
  });

  if (typeof pushChanThoatState === "function") pushChanThoatState();
  setTimeout(() => {
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 120);
}

function dongBanPhimCX5() {
  document.getElementById("cx5-bp-kg").classList.remove("show");
  document.getElementById("cx5-bp-qc").classList.remove("show");
  document.body.style.paddingBottom = "";
  document.querySelectorAll(".overlay").forEach(ol => {
    ol.style.paddingBottom = "";
  });
  if (banPhimActiveElCX5) banPhimActiveElCX5.blur();
  banPhimActiveElCX5 = null;
  banPhimLoaiCX5 = null;
  banPhimQCPendingCX5 = null;
  closeDropdownCX5();
  closeDropdownSXCX5();
  closeDropdownSLLuotCX5();
}
window.dongBanPhimCX5 = dongBanPhimCX5;

function moDoiQCLuotCX5() {
  const wrap = document.getElementById("cx5-sl-doi-qc-wrap");
  if (!wrap) return;
  const hien = wrap.style.display !== "none";
  wrap.style.display = hien ? "none" : "block";
  if (!hien) {
    const input = document.getElementById("cx5-sl-ten-tim");
    if (input) { input.value = ""; setTimeout(() => { input.focus(); }, 50); }
  }
}
window.moDoiQCLuotCX5 = moDoiQCLuotCX5;

let filteredSLLuotCX5 = [];
let activeIndexSLLuotCX5 = -1;

function onInputSLLuotCX5() {
  const input = document.getElementById("cx5-sl-ten-tim");
  if (!input) return;
  const query = input.value.trim();
  if (!query) { closeDropdownSLLuotCX5(); return; }
  if (typeof tkLocDanhSach === "function") {
    filteredSLLuotCX5 = tkLocDanhSach(mspDataCX5, query, 30);
  } else {
    const q = boDauCX5(query).toUpperCase();
    filteredSLLuotCX5 = mspDataCX5.filter(item => boDauCX5(item.ten).toUpperCase().includes(q)).slice(0, 30);
  }
  activeIndexSLLuotCX5 = -1;
  renderDropdownSLLuotCX5();
}

function renderDropdownSLLuotCX5() {
  const el = document.getElementById("cx5-sl-dropdown");
  if (!el) return;
  if (filteredSLLuotCX5.length === 0) {
    el.classList.remove("open"); el.innerHTML = "";
    return;
  }
  el.innerHTML = filteredSLLuotCX5.map((item, idx) =>
    '<div class="cx5-dropdown-item' + (idx === activeIndexSLLuotCX5 ? " active" : "") + '" data-idx="' + idx + '">' + escHtmlCX5(item.ten) + '</div>'
  ).join("");
  el.classList.add("open");
  Array.from(el.children).forEach(child => {
    child.addEventListener("mousedown", e => {
      e.preventDefault();
      chonQCSLLuotCX5(filteredSLLuotCX5[parseInt(child.getAttribute("data-idx"), 10)]);
    });
  });
}

function closeDropdownSLLuotCX5() {
  filteredSLLuotCX5 = [];
  activeIndexSLLuotCX5 = -1;
  const el = document.getElementById("cx5-sl-dropdown");
  if (el) { el.classList.remove("open"); el.innerHTML = ""; }
}

function chonQCSLLuotCX5(item) {
  if (luotDangSuaCX5 == null) return;
  phienCX5.forEach(r => {
    if (r.luot === luotDangSuaCX5) {
      r.msp = item.msp;
      r.ten = item.ten;
    }
  });
  if (luotHienTaiCX5 && luotHienTaiCX5.id === luotDangSuaCX5) {
    luotHienTaiCX5.msp = item.msp;
    luotHienTaiCX5.ten = item.ten;
  }
  luuPhienDoDangCX5();
  renderBangChiTietCX5();
  renderBangTongHopCX5();
  renderDoiChieuCX5();
  renderSuaLuotCX5();
  closeDropdownSLLuotCX5();
  const wrap = document.getElementById("cx5-sl-doi-qc-wrap");
  if (wrap) wrap.style.display = "none";
  showCanhBaoCX5("Đã đổi quy cách lượt sang: " + item.ten);
}

function bpGiaTriCX5() {
  return banPhimActiveElCX5 ? banPhimActiveElCX5.value : "";
}

function bpDatGiaTriCX5(v) {
  if (!banPhimActiveElCX5) return;
  banPhimActiveElCX5.value = v;
}

function bpKgSoCX5(ky) {
  if (!banPhimActiveElCX5) return;
  const cur = bpGiaTriCX5();
  if (ky === "." && cur.includes(".")) return;
  bpDatGiaTriCX5(cur + ky);
}
window.bpKgSoCX5 = bpKgSoCX5;

function bpKgXoaLuiCX5() {
  if (!banPhimActiveElCX5) return;
  bpDatGiaTriCX5(bpGiaTriCX5().slice(0, -1));
}
window.bpKgXoaLuiCX5 = bpKgXoaLuiCX5;

function bpKgXoaHetCX5() {
  bpDatGiaTriCX5("");
}
window.bpKgXoaHetCX5 = bpKgXoaHetCX5;

function bpKgEnterCX5() {
  if (!banPhimActiveElCX5) return;
  const id = banPhimActiveElCX5.id;
  if (id === "cx5-kg") {
    themDongCX5();
  } else if (id === "cx5-sl-them-kg") {
    themKgVaoLuotCX5();
  } else if (id === "cx5-sx-kg") {
    themDongSXCX5();
  } else if (banPhimActiveElCX5.classList.contains("cx5-sx-input")) {
    const key = banPhimActiveElCX5.getAttribute("data-key");
    themSoSXCX5(key, banPhimActiveElCX5);
  }
}
window.bpKgEnterCX5 = bpKgEnterCX5;

function bpQcSoCX5(ky) {
  if (!banPhimActiveElCX5) return;
  bpDatGiaTriCX5(bpGiaTriCX5() + ky);
  bpKichHoatLocCX5();
}
window.bpQcSoCX5 = bpQcSoCX5;

function bpQcXoaLuiCX5() {
  if (!banPhimActiveElCX5) return;
  bpDatGiaTriCX5(bpGiaTriCX5().slice(0, -1));
  banPhimQCPendingCX5 = null;
  bpKichHoatLocCX5();
}
window.bpQcXoaLuiCX5 = bpQcXoaLuiCX5;

function bpQcXoaHetCX5() {
  bpDatGiaTriCX5("");
  banPhimQCPendingCX5 = null;
  bpKichHoatLocCX5();
}
window.bpQcXoaHetCX5 = bpQcXoaHetCX5;

function bpKichHoatLocCX5() {
  if (!banPhimActiveElCX5) return;
  if (banPhimActiveElCX5.id === "cx5-ten") onInputCX5();
  if (banPhimActiveElCX5.id === "cx5-sx-ten") onInputSXCX5();
  if (banPhimActiveElCX5.id === "cx5-sl-ten-tim") onInputSLLuotCX5();
}

function bpQcEnterCX5() {
  if (!banPhimActiveElCX5) return;
  if (banPhimActiveElCX5.id === "cx5-ten") {
    if (filteredCX5.length) chonQCX5(filteredCX5[activeIndexCX5 >= 0 ? activeIndexCX5 : 0]);
  } else if (banPhimActiveElCX5.id === "cx5-sx-ten") {
    if (filteredSXCX5.length) chonQCSXCX5(filteredSXCX5[activeIndexSXCX5 >= 0 ? activeIndexSXCX5 : 0]);
  } else if (banPhimActiveElCX5.id === "cx5-sl-ten-tim") {
    if (filteredSLLuotCX5.length) chonQCSLLuotCX5(filteredSLLuotCX5[activeIndexSLLuotCX5 >= 0 ? activeIndexSLLuotCX5 : 0]);
  }
}
window.bpQcEnterCX5 = bpQcEnterCX5;
