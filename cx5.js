const API_CX5 = "https://script.google.com/macros/s/AKfycbzJeVkfapKOzkiZpeZvUWhmn3KEiS4wlYGJv1BSR2TUFnwYYuCkI28oGo6OB0Bjui-P/exec";

const CX5_LICHSU_KEY = "cx5_lich_su";
const CX5_LICHSU_SO_NGAY_GIU = 30;

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

let doiChieuCX5 = {};
let dangThemQCDoiChieuCX5 = false;
let filteredThemCX5 = [];
let activeIndexThemCX5 = -1;

let tongKgDataCX5 = {};

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
  } catch (e) {}
  luuPhienVaoLichSuCX5();
}

function xoaPhienDoDangCX5() {
  try { localStorage.removeItem("cx5_phien_dodang"); } catch (e) {}
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
  try { localStorage.setItem("cx5_msp_cache_" + monthKey, JSON.stringify({ data, savedAt: Date.now() })); } catch (e) {}
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
  try { phienCu = JSON.parse(localStorage.getItem("cx5_phien_dodang")); } catch (e) {}
  if (phienCu && Array.isArray(phienCu.phienCX5) && phienCu.phienCX5.length > 0) {
    const tiepTuc = confirm(
      "Bạn đang có phiên Chỉ X5 dở dang (" + phienCu.phienCX5.length + " dòng, ngày " + phienCu.ngayCX5 + ").\n" +
      "Bấm OK để tiếp tục phiên đó, hoặc Cancel để xoá và bắt đầu phiên mới."
    );
    if (tiepTuc) { await khoiPhucCX5(phienCu); return; }
    xoaPhienDoDangCX5();
  }

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
  document.getElementById("cx5-qc-khoa-ten").textContent = ten + " (" + msp + ")";
}

function moKhoaQCCX5() {
  document.getElementById("cx5-qc-khoa").style.display = "none";
  document.getElementById("cx5-qc-tim-wrap").style.display = "block";
  const ten = document.getElementById("cx5-ten");
  ten.value = "";
  document.getElementById("cx5-msp").value = "";
  closeDropdownCX5();
  ten.focus();
}

function resetKhoaQCCX5() {
  document.getElementById("cx5-qc-khoa").style.display = "none";
  document.getElementById("cx5-qc-tim-wrap").style.display = "block";
  document.getElementById("cx5-ten").value = "";
  document.getElementById("cx5-msp").value = "";
}

function onInputCX5() {
  document.getElementById("cx5-msp").value = "";
  const q = boDauCX5(document.getElementById("cx5-ten").value.trim()).toUpperCase();
  if (!q) { filteredCX5 = []; renderDropdownCX5(); return; }
  filteredCX5 = mspDataCX5
    .filter(item => boDauCX5(item.ten).toUpperCase().includes(q))
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, 50);
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
  el.innerHTML = filteredCX5.map((item, idx) =>
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
  document.getElementById("cx5-dropdown").classList.remove("open");
  document.getElementById("cx5-dropdown").innerHTML = "";
  const kgKhu = document.getElementById("cx5-kg-khu");
  if (kgKhu) kgKhu.style.display = "";
}

function chonQCX5(item) {
  document.getElementById("cx5-ten").value = item.ten;
  document.getElementById("cx5-msp").value = item.msp;
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
  if (dong.daDongBo) { showCanhBaoCX5("Dòng đã đồng bộ, không thể xoá"); return; }
  phienCX5 = phienCX5.filter(r => r.seq !== seq);
  luuPhienDoDangCX5();
  renderBangChiTietCX5();
  renderBangTongHopCX5();
}

function renderBangChiTietCX5() {
  document.getElementById("cx5-dem").textContent = "Đã nhập: " + phienCX5.length + " dòng";
  const tbody = document.getElementById("cx5-tbody-chitiet");
  if (phienCX5.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--cream-soft);font-style:italic">Chưa có dòng nào</td></tr>';
    return;
  }

  const luotMap = new Map();
  const thuTuLuot = [];
  phienCX5.forEach(r => {
    if (!luotMap.has(r.luot)) { luotMap.set(r.luot, []); thuTuLuot.push(r.luot); }
    luotMap.get(r.luot).push(r);
  });

  tbody.innerHTML = thuTuLuot.slice().reverse().map(lid => {
    const rows = luotMap.get(lid);
    const first = rows[0];
    const bao = rows.length;
    const kg = Math.round(rows.reduce((s, r) => s + r.kg, 0) * 100) / 100;
    return "<tr>" +
      "<td>" + lid + "</td>" +
      "<td>" + escHtmlCX5(first.msp) + "</td>" +
      "<td>" + escHtmlCX5(first.ten) + "</td>" +
      "<td>" + bao + "</td>" +
      "<td>" + kg + "</td>" +
      '<td class="cx5-sua-luot" onclick="moSuaLuotCX5(' + lid + ')">✏️</td>' +
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
  document.getElementById("cx5-sl-ten").textContent = rows[0].msp + " · " + rows[0].ten;
  const box = document.getElementById("cx5-sl-chitiet");
  box.innerHTML = rows.map(r => {
    const xoa = r.daDongBo ? "" : ' <span onclick="xoaDongTrongLuotCX5(' + r.seq + ')">✕</span>';
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
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--cream-soft);font-style:italic">Chưa có dữ liệu</td></tr>';
    return;
  }
  tbody.innerHTML = keys.map(key => {
    const item = gom[key];
    let trangThai;
    if (item.baoDaDongBo === 0) trangThai = "Chưa đồng bộ";
    else if (item.baoDaDongBo === item.bao) trangThai = '<span class="cx5-trangthai-ok">Đã đồng bộ</span>';
    else trangThai = '<span class="cx5-trangthai-mot-phan">Đồng bộ 1 phần</span>';
    return "<tr>" +
      "<td>" + escHtmlCX5(item.msp) + "</td>" +
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
  renderDoiChieuCX5();
}

function moThemQCDoiChieuCX5() {
  dangThemQCDoiChieuCX5 = true;
  renderDoiChieuCX5();
  setTimeout(() => {
    const el = document.getElementById("cx5-dc-them-ten");
    if (el) el.focus();
  }, 0);
}

function huyThemQCDoiChieuCX5() {
  dangThemQCDoiChieuCX5 = false;
  filteredThemCX5 = [];
  activeIndexThemCX5 = -1;
  renderDoiChieuCX5();
}

function onInputThemQCCX5() {
  document.getElementById("cx5-dc-them-msp").value = "";
  const q = boDauCX5(document.getElementById("cx5-dc-them-ten").value.trim()).toUpperCase();
  if (!q) { filteredThemCX5 = []; renderDropdownThemQCCX5(); return; }
  const daCo = new Set(Object.keys(doiChieuCX5));
  filteredThemCX5 = mspDataCX5
    .filter(item => boDauCX5(item.ten).toUpperCase().includes(q) && !daCo.has(keyQCX5(item.msp, item.ten)))
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, 50);
  activeIndexThemCX5 = -1;
  renderDropdownThemQCCX5();
}

function renderDropdownThemQCCX5() {
  const el = document.getElementById("cx5-dc-them-dropdown");
  const actions = document.getElementById("cx5-dc-them-actions");
  if (!el) return;
  if (filteredThemCX5.length === 0) {
    el.classList.remove("open"); el.innerHTML = "";
    if (actions) actions.style.display = "flex";
    return;
  }
  if (actions) actions.style.display = "none";
  el.innerHTML = filteredThemCX5.map((item, idx) =>
    '<div class="cx5-dropdown-item' + (idx === activeIndexThemCX5 ? " active" : "") + '" data-idx="' + idx + '">' + escHtmlCX5(item.ten) + "</div>"
  ).join("");
  el.classList.add("open");
  Array.from(el.children).forEach(child => {
    child.addEventListener("mousedown", e => {
      e.preventDefault();
      chonQCThemDoiChieuCX5(filteredThemCX5[parseInt(child.getAttribute("data-idx"), 10)]);
    });
  });
}

function closeDropdownThemQCCX5() {
  filteredThemCX5 = [];
  activeIndexThemCX5 = -1;
  const el = document.getElementById("cx5-dc-them-dropdown");
  if (el) { el.classList.remove("open"); el.innerHTML = ""; }
  const actions = document.getElementById("cx5-dc-them-actions");
  if (actions) actions.style.display = "flex";
}

function chonQCThemDoiChieuCX5(item) {
  document.getElementById("cx5-dc-them-ten").value = item.ten;
  document.getElementById("cx5-dc-them-msp").value = item.msp;
  closeDropdownThemQCCX5();
}

function onKeydownThemQCCX5(e) {
  if (e.key === "ArrowDown") {
    if (!filteredThemCX5.length) return;
    e.preventDefault();
    activeIndexThemCX5 = Math.min(activeIndexThemCX5 + 1, filteredThemCX5.length - 1);
    renderDropdownThemQCCX5();
  } else if (e.key === "ArrowUp") {
    if (!filteredThemCX5.length) return;
    e.preventDefault();
    activeIndexThemCX5 = Math.max(activeIndexThemCX5 - 1, 0);
    renderDropdownThemQCCX5();
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (filteredThemCX5.length) chonQCThemDoiChieuCX5(filteredThemCX5[activeIndexThemCX5 >= 0 ? activeIndexThemCX5 : 0]);
  } else if (e.key === "Escape") {
    closeDropdownThemQCCX5();
  }
}

function xacNhanThemQCDoiChieuCX5() {
  const msp = document.getElementById("cx5-dc-them-msp").value;
  const ten = document.getElementById("cx5-dc-them-ten").value.trim();
  if (!msp || !ten) { showCanhBaoCX5("Chưa chọn quy cách hợp lệ"); return; }
  const key = keyQCX5(msp, ten);
  if (!doiChieuCX5[key]) doiChieuCX5[key] = { msp, ten, sxEntries: [] };
  dangThemQCDoiChieuCX5 = false;
  luuPhienDoDangCX5();
  renderDoiChieuCX5();
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
  if (!confirm("Xóa hàng đối chiếu này? Số SX đã nhập cho quy cách này sẽ mất.")) return;
  delete doiChieuCX5[key];
  luuPhienDoDangCX5();
  renderDoiChieuCX5();
}
window.xoaHangDoiChieuCX5 = xoaHangDoiChieuCX5;

function renderDoiChieuCX5() {
  const gom = tomTatCX5();
  Object.keys(gom).forEach(key => {
    if (!doiChieuCX5[key]) doiChieuCX5[key] = { msp: gom[key].msp, ten: gom[key].ten, sxEntries: [] };
  });

  const container = document.getElementById("cx5-doichieu-list");
  const keys = Object.keys(doiChieuCX5);
  let coTheDongBo = false;
  let html = "";

  if (keys.length === 0) {
    html += '<div style="text-align:center;color:var(--cream-soft);padding:16px 0">Chưa có quy cách nào</div>';
  } else {
    html += keys.map(key => {
      const kho = gom[key] || { bao: 0, kg: 0, baoDaDongBo: 0 };
      const dc = doiChieuCX5[key];
      const sxTong = dc.sxEntries.reduce((s, v) => s + v, 0);
      const khop = Math.round(sxTong * 100) === Math.round(kho.kg * 100) && kho.kg > 0;
      const conDeDongBo = (kho.bao - (kho.baoDaDongBo || 0)) > 0;
      if (khop && conDeDongBo) coTheDongBo = true;

      const dsSo = dc.sxEntries.map((v, idx) =>
        '<span class="cx5-so-sx">' + v + ' <span onclick="xoaSoSXCX5(\'' + key + '\',' + idx + ')">✕</span></span>'
      ).join("");

      let ketQuaHtml;
      if (kho.bao === 0) {
        ketQuaHtml = sxTong > 0
          ? '<div class="cx5-dc-ketqua cx5-dc-lech">Kho chưa nhập — SX báo thừa: ' + sxTong.toFixed(1) + '</div>'
          : '<div class="cx5-dc-ketqua">Kho chưa nhập gì cho quy cách này</div>';
      } else if (!conDeDongBo) {
        ketQuaHtml = '<div class="cx5-dc-ketqua cx5-dc-khop">Đã đồng bộ đủ</div>';
      } else if (khop) {
        ketQuaHtml = '<div class="cx5-dc-ketqua cx5-dc-khop">Khớp hoàn toàn — sẵn sàng đồng bộ</div>';
      } else {
        ketQuaHtml = '<div class="cx5-dc-ketqua cx5-dc-lech">Lệch: ' + (sxTong - kho.kg).toFixed(1) + '</div>';
      }

      return '<div class="cx5-dc-card">' +
        '<div class="cx5-dc-ten">' + escHtmlCX5(dc.ten) + ' <span class="cx5-dc-msp">(' + escHtmlCX5(dc.msp) + ')</span>' +
        '<span style="float:right;color:#d9534f;font-weight:700;font-size:12px;cursor:pointer" onclick="xoaHangDoiChieuCX5(\'' + key + '\')">Xóa</span></div>' +
        '<div class="cx5-dc-kho">Kho — Bao: <b>' + kho.bao + '</b> · Kg: <b>' + kho.kg.toFixed(1) + '</b></div>' +
        '<div style="margin-top:10px">' +
        '<label>SX</label>' +
        '<div class="cx5-dc-sx-row">' +
        '<input type="text" inputmode="none" readonly class="cx5-sx-input" data-key="' + escHtmlCX5(key) + '" placeholder="Nhập số..." onkeydown="if(event.key===\'Enter\'){event.preventDefault();themSoSXCX5(\'' + key + '\', this)}">' +
        '<button class="btn btn-blue" onclick="themSoSXCX5(\'' + key + '\', this.previousElementSibling)">+</button>' +
        '</div>' +
        '<div style="margin-top:8px">' + dsSo + '</div>' +
        '<div class="cx5-dc-tong">Tổng SX: <b>' + sxTong.toFixed(1) + '</b></div>' +
        '</div>' +
        ketQuaHtml +
        '</div>';
    }).join("");
  }

  if (dangThemQCDoiChieuCX5) {
    html += '<div class="cx5-dc-them-row">' +
      '<label>Thêm quy cách</label>' +
      '<div class="cx5-ten-wrap">' +
      '<input type="text" id="cx5-dc-them-ten" placeholder="Gõ để tìm quy cách..." autocomplete="off" readonly inputmode="none" oninput="onInputThemQCCX5()" onkeydown="onKeydownThemQCCX5(event)">' +
      '<div id="cx5-dc-them-dropdown" class="cx5-dropdown"></div>' +
      '</div>' +
      '<input type="hidden" id="cx5-dc-them-msp">' +
      '<div id="cx5-dc-them-actions" style="display:flex;gap:8px;margin-top:10px">' +
      '<button class="btn btn-green" style="flex:1" onclick="xacNhanThemQCDoiChieuCX5()">Thêm</button>' +
      '<button class="btn" style="flex:1;background:var(--neutral);color:var(--cream)" onclick="huyThemQCDoiChieuCX5()">Huỷ</button>' +
      '</div>' +
      '</div>';
  } else {
    html += '<button class="btn btn-full" style="background:var(--neutral);color:var(--cream)" onclick="moThemQCDoiChieuCX5()">+ Thêm quy cách</button>';
  }

  html += '<button id="cx5-btn-dongbo-tatca" class="btn btn-blue btn-full" ' + (coTheDongBo ? "" : "disabled") + ' onclick="dongBoTatCaCX5()">Đồng bộ</button>';

  container.innerHTML = html;
}

function docPendingCX5() {
  try { return JSON.parse(localStorage.getItem("cx5_pending_saves")) || []; } catch (e) { return []; }
}

function luuPendingCX5(list) {
  try { localStorage.setItem("cx5_pending_saves", JSON.stringify(list)); } catch (e) {}
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
  if (btn) { btn.disabled = true; btn.textContent = "Đang đồng bộ..."; }
  showLoading(true);

  let thanhCong = 0, thatBai = 0;
  const dsThanhCongCX5 = [];
  for (const key of dsCanDongBo) {
    const ok = await dongBoMotQC_(key);
    if (ok) { thanhCong += 1; dsThanhCongCX5.push(key); } else thatBai += 1;
  }

  showLoading(false);
  if (btn) { btn.disabled = false; btn.textContent = "Đồng bộ"; }

  luuPhienDoDangCX5();
  renderBangChiTietCX5();
  renderBangTongHopCX5();
  renderDoiChieuCX5();
  if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();

  if (thatBai === 0) showCanhBaoCX5("Đã đồng bộ " + thanhCong + " quy cách");
  else showCanhBaoCX5("Đồng bộ " + thanhCong + " thành công, " + thatBai + " lỗi");

  if (dsThanhCongCX5.length > 0) {
    const dsQC = dsThanhCongCX5.map(key => ({ msp: doiChieuCX5[key].msp, ten: doiChieuCX5[key].ten }));
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
  dsQC.forEach(function (q) {
    const key = q.msp + "|" + q.ten;
    const candidates = res[key] || [];
    const homNay = candidates.find(function (c) { return c.homNay; });
    if (!homNay) return;
    const cu = candidates
      .filter(function (c) { return !c.homNay; })
      .map(function (c) { return Object.assign({ checked: false }, c); });
    tongKgDataCX5[key] = { msp: q.msp, ten: q.ten, homNay: homNay, cu: cu };
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
    return;
  }

  const html = keys.map(function (key) {
    const d = tongKgDataCX5[key];
    let tongBao = d.homNay.bao, tongKg = d.homNay.kg;
    d.cu.forEach(function (c) { if (c.checked) { tongBao += c.bao; tongKg += c.kg; } });

    const dsCu = d.cu.map(function (c, idx) {
      return '<label class="cx5-tk-row" style="display:flex;align-items:center;gap:8px;padding:6px 0">' +
        '<input type="checkbox" ' + (c.checked ? "checked" : "") + ' onchange="toggleGhepCX5(\'' + key + '\',' + idx + ')">' +
        '<span>Ngày ' + c.ngay + ': ' + c.kg.toFixed(1) + 'kg (' + c.bao + ' bao)</span>' +
        '</label>';
    }).join("");

    return '<div class="cx5-dc-card">' +
      '<div class="cx5-dc-ten">' + escHtmlCX5(d.ten) + ' <span class="cx5-dc-msp">(' + escHtmlCX5(d.msp) + ')</span></div>' +
      '<div class="cx5-dc-kho">Hôm nay: <b>' + d.homNay.kg.toFixed(1) + 'kg (' + d.homNay.bao + ' bao)</b></div>' +
      (dsCu
        ? '<div style="margin-top:8px">' + dsCu + '</div>'
        : '<div style="margin-top:8px;color:var(--cream-soft);font-size:12px">Không có ngày cũ nào còn dư</div>') +
      '<div class="cx5-dc-tong" style="margin-top:8px">Tổng cộng dồn: <b>' + tongKg.toFixed(1) + 'kg (' + tongBao + ' bao)</b></div>' +
      '</div>';
  }).join("");

  container.innerHTML = html + '<button id="cx5-btn-ghep" class="btn btn-blue btn-full" style="margin-top:10px" onclick="dongBoGhepCX5()">Đồng bộ</button>';
}
window.renderTongKgCX5 = renderTongKgCX5;

function toggleGhepCX5(key, idx) {
  const d = tongKgDataCX5[key];
  if (!d || !d.cu[idx]) return;
  d.cu[idx].checked = !d.cu[idx].checked;
  renderTongKgCX5();
}
window.toggleGhepCX5 = toggleGhepCX5;

async function dongBoGhepCX5() {
  const groups = [];
  Object.keys(tongKgDataCX5).forEach(function (key) {
    const d = tongKgDataCX5[key];
    const chosen = d.cu.filter(function (c) { return c.checked; });
    if (chosen.length === 0) return;

    let tongBao = d.homNay.bao, tongKg = d.homNay.kg;
    chosen.forEach(function (c) { tongBao += c.bao; tongKg += c.kg; });

    groups.push({
      rowNeo: d.homNay.row,
      tongBao: tongBao,
      tongKg: Math.round(tongKg * 100) / 100,
      cuList: chosen.map(function (c) { return { row: c.row, bao: c.bao, kg: c.kg }; })
    });
  });

  if (groups.length === 0) { showCanhBaoCX5("Chưa chọn ngày nào để ghép — bấm Bỏ qua nếu không cần ghép"); return; }

  const btn = document.getElementById("cx5-btn-ghep");
  if (btn) { btn.disabled = true; btn.textContent = "Đang ghi..."; }
  showLoading(true);

  try {
    const r = await callApiCX5({ action: "ghiGhepCX5", payload: { groups: groups } });
    showLoading(false);
    if (btn) { btn.disabled = false; btn.textContent = "Đồng bộ"; }
    if (!r.success) { showCanhBaoCX5("Lỗi: " + (r.message || "không rõ nguyên nhân")); return; }
    showCanhBaoCX5("Đã ghi ghép pallet cho " + groups.length + " quy cách");
    if (typeof diToiTab === "function") diToiTab("trangChu");
  } catch (e) {
    showLoading(false);
    if (btn) { btn.disabled = false; btn.textContent = "Đồng bộ"; }
    showCanhBaoCX5("Mất mạng — thử lại: " + e.message);
  }
}
window.dongBoGhepCX5 = dongBoGhepCX5;

function boQuaTongKgCX5() {
  document.getElementById("cx5-tongkg").style.display = "none";
  if (typeof diToiTab === "function") diToiTab("trangChu");
}
window.boQuaTongKgCX5 = boQuaTongKgCX5;

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
  try { localStorage.setItem(CX5_LICHSU_KEY, JSON.stringify(list)); } catch (e) {}
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
  const list = docLichSuCX5().slice().sort((a, b) => new Date(b.capNhatLuc) - new Date(a.capNhatLuc));
  if (list.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--cream-soft);padding:20px 0;">Chưa có phiên nào trong ' + CX5_LICHSU_SO_NGAY_GIU + ' ngày qua</div>';
    return;
  }
  container.innerHTML = list.map(s => {
    const tongKg = s.phienCX5.reduce((t, r) => t + r.kg, 0);
    const soLuot = new Set(s.phienCX5.map(r => r.luot)).size;
    const daXongHet = s.phienCX5.every(r => r.daDongBo);
    const trangThai = daXongHet
      ? '<span class="cx5-trangthai-ok">Đã đồng bộ</span>'
      : '<span class="cx5-trangthai-mot-phan">Chưa xong</span>';
    const gio = new Date(s.capNhatLuc).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return '<div class="irow" style="cursor:pointer" onclick="tiepTucLichSuCX5(\'' + s.idPhien + '\')">'
      + '<span class="ilabel">' + s.ngay + " · " + gio + '</span>'
      + '<span class="ivalue">' + soLuot + ' lượt · ' + tongKg.toFixed(1) + ' kg · ' + trangThai + '</span>'
      + '</div>';
  }).join("");
}
window.renderLichSuCX5 = renderLichSuCX5;

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
  try { state = JSON.parse(localStorage.getItem("cx5_phien_dodang")); } catch (e) {}
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
window.moThemQCDoiChieuCX5 = moThemQCDoiChieuCX5;
window.huyThemQCDoiChieuCX5 = huyThemQCDoiChieuCX5;
window.onInputThemQCCX5 = onInputThemQCCX5;
window.onKeydownThemQCCX5 = onKeydownThemQCCX5;
window.xacNhanThemQCDoiChieuCX5 = xacNhanThemQCDoiChieuCX5;
window.themSoSXCX5 = themSoSXCX5;
window.xoaSoSXCX5 = xoaSoSXCX5;
window.dongBoTatCaCX5 = dongBoTatCaCX5;

window.addEventListener("load", function () {
  const today = new Date().toISOString().split("T")[0];
  const ngayInput = document.getElementById("cx5-ngay");
  if (ngayInput) ngayInput.value = today;
  donDepLichSuCX5();

  const tenInput = document.getElementById("cx5-ten");
  if (tenInput) {
    tenInput.addEventListener("input", onInputCX5);
    tenInput.addEventListener("keydown", onKeydownCX5);
  }
  document.addEventListener("click", e => {
    const trongOTimKiem = e.target.closest(".cx5-ten-wrap");
    const trongBanPhim = e.target.closest(".cx5-bp-panel");
    if (!trongOTimKiem && !trongBanPhim) { closeDropdownCX5(); closeDropdownThemQCCX5(); }
    if (banPhimActiveElCX5 && !trongOTimKiem && !trongBanPhim && e.target !== banPhimActiveElCX5) {
      dongBanPhimCX5();
    }
  });
});

const CX5_BP_QC_MAP = { "7": "A", "8": "B", "9": "D", "4": "E", "5": "R", "6": "X", "1": "/", "2": "-" };
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
  const key = d => (CX5_BP_QC_MAP[d] ? '<span class="cx5-bp-key-sub">' + CX5_BP_QC_MAP[d] + "</span>" : "");
  qcPanel.innerHTML =
    '<span class="cx5-bp-close" onclick="dongBanPhimCX5()">Đóng bàn phím ▾</span>' +
    '<div class="cx5-bp-grid">' +
    '<div class="cx5-bp-key" onclick="bpQcSoCX5(\'7\')">7' + key("7") + '</div>' +
    '<div class="cx5-bp-key" onclick="bpQcSoCX5(\'8\')">8' + key("8") + '</div>' +
    '<div class="cx5-bp-key" onclick="bpQcSoCX5(\'9\')">9' + key("9") + '</div>' +
    '<div class="cx5-bp-key cx5-bp-key-fn" onclick="bpQcXoaLuiCX5()">⌫</div>' +
    '<div class="cx5-bp-key" onclick="bpQcSoCX5(\'4\')">4' + key("4") + '</div>' +
    '<div class="cx5-bp-key" onclick="bpQcSoCX5(\'5\')">5' + key("5") + '</div>' +
    '<div class="cx5-bp-key" onclick="bpQcSoCX5(\'6\')">6' + key("6") + '</div>' +
    '<div class="cx5-bp-key cx5-bp-key-fn" onclick="bpQcXoaHetCX5()">C</div>' +
    '<div class="cx5-bp-key" onclick="bpQcSoCX5(\'1\')">1' + key("1") + '</div>' +
    '<div class="cx5-bp-key" onclick="bpQcSoCX5(\'2\')">2' + key("2") + '</div>' +
    '<div class="cx5-bp-key" onclick="bpQcSoCX5(\'3\')">3</div>' +
    '<div class="cx5-bp-key cx5-bp-key-enter" onclick="bpQcEnterCX5()">Enter</div>' +
    '<div class="cx5-bp-key cx5-bp-key-zero" onclick="bpQcSoCX5(\'0\')">0</div>' +
    "</div>";
  document.body.appendChild(qcPanel);

  document.addEventListener("focus", function (e) {
    const el = e.target;
    if (!el || el.tagName !== "INPUT") return;
    if (el.id === "cx5-kg" || el.id === "cx5-sl-them-kg" || el.classList.contains("cx5-sx-input")) {
      moBanPhimCX5(el, "kg");
    } else if (el.id === "cx5-ten" || el.id === "cx5-dc-them-ten") {
      moBanPhimCX5(el, "qc");
    }
  }, true);
})();

function moBanPhimCX5(el, loai) {
  banPhimActiveElCX5 = el;
  banPhimLoaiCX5 = loai;
  banPhimQCPendingCX5 = null;
  document.getElementById("cx5-bp-kg").classList.toggle("show", loai === "kg");
  document.getElementById("cx5-bp-qc").classList.toggle("show", loai === "qc");
  setTimeout(() => {
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 120);
}

function dongBanPhimCX5() {
  document.getElementById("cx5-bp-kg").classList.remove("show");
  document.getElementById("cx5-bp-qc").classList.remove("show");
  if (banPhimActiveElCX5) banPhimActiveElCX5.blur();
  banPhimActiveElCX5 = null;
  banPhimLoaiCX5 = null;
  banPhimQCPendingCX5 = null;
}
window.dongBanPhimCX5 = dongBanPhimCX5;

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
  } else if (banPhimActiveElCX5.classList.contains("cx5-sx-input")) {
    const key = banPhimActiveElCX5.getAttribute("data-key");
    themSoSXCX5(key, banPhimActiveElCX5);
  }
}
window.bpKgEnterCX5 = bpKgEnterCX5;

function bpQcSoCX5(ky) {
  if (!banPhimActiveElCX5) return;
  const now = Date.now();

  if (banPhimQCPendingCX5 && banPhimQCPendingCX5.ky === ky && (now - banPhimQCPendingCX5.time) < CX5_BP_DOUBLE_TAP_MS && CX5_BP_QC_MAP[ky]) {
    const cur = bpGiaTriCX5();
    bpDatGiaTriCX5(cur.slice(0, -1) + CX5_BP_QC_MAP[ky]);
    banPhimQCPendingCX5 = null;
  } else {
    bpDatGiaTriCX5(bpGiaTriCX5() + ky);
    banPhimQCPendingCX5 = { ky, time: now };
  }

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
  else if (banPhimActiveElCX5.id === "cx5-dc-them-ten") onInputThemQCCX5();
}

function bpQcEnterCX5() {
  if (!banPhimActiveElCX5) return;
  if (banPhimActiveElCX5.id === "cx5-ten") {
    if (filteredCX5.length) chonQCX5(filteredCX5[activeIndexCX5 >= 0 ? activeIndexCX5 : 0]);
  } else if (banPhimActiveElCX5.id === "cx5-dc-them-ten") {
    if (filteredThemCX5.length) chonQCThemDoiChieuCX5(filteredThemCX5[activeIndexThemCX5 >= 0 ? activeIndexThemCX5 : 0]);
  }
}
window.bpQcEnterCX5 = bpQcEnterCX5;
