const API_CX5 = "URL_WEB_APP_CHUA_DIEN";

const CX5_LICHSU_KEY = "cx5_lich_su";
const CX5_LICHSU_SO_NGAY_GIU = 3;

let phienCX5 = [];
let ngayCX5 = null;
let idPhienHienTaiC5 = null;
let seqCX5 = 0;
let dangKetThucCX5 = false;

let mspDataCX5 = [];
let mspCacheX5 = {};
let filteredCX5 = [];
let activeIndexCX5 = -1;

let doiChieuCX5 = {};

async function callApiCX5(body) {
  const res = await fetch(API_CX5, { method: "POST", body: JSON.stringify(body) });
  return await res.json();
}

function boDauCX5(str) {
  return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

function keyQCX5(msp, ten) {
  return msp + "|" + ten;
}

function luuPhienDoDangCX5() {
  try {
    localStorage.setItem("cx5_phien_dodang", JSON.stringify({
      phienCX5, ngayCX5, capNhat: new Date().toISOString(),
      idPhienHienTaiC5, seqCX5, doiChieuCX5, dangKetThucCX5
    }));
  } catch (e) {}
}

function xoaPhienDoDangCX5() {
  try { localStorage.removeItem("cx5_phien_dodang"); } catch (e) {}
}

async function taiDanhSachQCX5(dateStr, forceRefresh) {
  const monthKey = new Date(dateStr).getMonth() + 1;
  if (!forceRefresh && mspCacheX5[monthKey]) {
    mspDataCX5 = mspCacheX5[monthKey];
    return;
  }
  document.getElementById("cx5-ten").placeholder = "Đang tải danh sách...";
  document.getElementById("cx5-ten").disabled = true;
  try {
    const res = await callApiCX5({ action: "khoiTaoForm", dateStr, forceRefresh: !!forceRefresh });
    if (res.error) { showCanhBaoCX5(res.error); mspDataCX5 = []; }
    else if (!res.exists) { showCanhBaoCX5('Chưa có sheet tháng "' + res.sheetName + '"'); mspDataCX5 = []; }
    else {
      mspDataCX5 = (res.mspList || []).filter(i => i.vung !== "FOR");
      mspCacheX5[monthKey] = mspDataCX5;
    }
  } catch (e) {
    showCanhBaoCX5("Không tải được danh sách quy cách");
    mspDataCX5 = [];
  }
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

  document.getElementById("cx5-form").style.display = "none";
  document.getElementById("cx5-doichieu").style.display = "none";
  document.getElementById("cx5-nhap").style.display = "block";
  document.getElementById("cx5-ngay-hienthi").textContent = ngayCX5;

  await taiDanhSachQCX5(ngayCX5, false);
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

  document.getElementById("cx5-form").style.display = "none";
  document.getElementById("cx5-doichieu").style.display = "none";
  document.getElementById("cx5-nhap").style.display = "block";
  document.getElementById("cx5-ngay-hienthi").textContent = ngayCX5;

  await taiDanhSachQCX5(ngayCX5, false);
  renderBangChiTietCX5();
  renderBangTongHopCX5();
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
  if (filteredCX5.length === 0) { el.classList.remove("open"); el.innerHTML = ""; return; }
  el.innerHTML = filteredCX5.map((item, idx) =>
    '<div class="cx5-dropdown-item' + (idx === activeIndexCX5 ? " active" : "") + '" data-idx="' + idx + '">' + item.ten + "</div>"
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
}

function chonQCX5(item) {
  document.getElementById("cx5-ten").value = item.ten;
  document.getElementById("cx5-msp").value = item.msp;
  closeDropdownCX5();
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

  seqCX5 += 1;
  phienCX5.push({ seq: seqCX5, msp, ten, kg, thoiGian: new Date(), daDongBo: false });
  luuPhienDoDangCX5();
  renderBangChiTietCX5();
  renderBangTongHopCX5();

  document.getElementById("cx5-kg").value = "";
  document.getElementById("cx5-ten").value = "";
  document.getElementById("cx5-msp").value = "";
  document.getElementById("cx5-ten").focus();
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

function suaDongCX5(seq, inputEl) {
  const dong = phienCX5.find(r => r.seq === seq);
  if (!dong) return;
  if (dong.daDongBo) { inputEl.value = dong.kg; showCanhBaoCX5("Dòng đã đồng bộ, không thể sửa"); return; }
  const kg = parseFloat(inputEl.value);
  if (!kg || kg <= 0) { inputEl.value = dong.kg; showCanhBaoCX5("Số kg không hợp lệ"); return; }
  dong.kg = kg;
  luuPhienDoDangCX5();
  renderBangTongHopCX5();
}

function renderBangChiTietCX5() {
  document.getElementById("cx5-dem").textContent = "Đã nhập: " + phienCX5.length + " dòng";
  const tbody = document.getElementById("cx5-tbody-chitiet");
  if (phienCX5.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--cream-soft);font-style:italic">Chưa có dòng nào</td></tr>';
    return;
  }
  tbody.innerHTML = phienCX5.slice().reverse().map(r => {
    const kgCell = r.daDongBo
      ? r.kg
      : '<input type="number" min="0" step="0.1" value="' + r.kg + '" style="width:70px" onchange="suaDongCX5(' + r.seq + ', this)">';
    const xoaCell = r.daDongBo
      ? '<span style="color:var(--success)">✓</span>'
      : '<button class="cx5-del-btn" onclick="xoaDongCX5(' + r.seq + ')" title="Xoá">✕</button>';
    return "<tr>" +
      "<td>" + r.msp + "</td>" +
      "<td>" + r.ten + "</td>" +
      "<td>" + kgCell + "</td>" +
      "<td>" + xoaCell + "</td>" +
      "</tr>";
  }).join("");
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
      "<td>" + item.msp + "</td>" +
      "<td>" + item.ten + "</td>" +
      "<td>" + item.bao + "</td>" +
      "<td>" + item.kg.toFixed(1) + "</td>" +
      "<td>" + trangThai + "</td>" +
      "</tr>";
  }).join("");
}

function xoayBangCX5(id) {
  const wrap = document.getElementById(id + "-wrap");
  wrap.classList.toggle("cx5-xoay-view");
}

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

function themQCDoiChieuCX5() {
  const ten = prompt("Nhập tên quy cách cần thêm vào đối chiếu:");
  if (!ten) return;
  const found = mspDataCX5.find(i => i.ten.trim().toLowerCase() === ten.trim().toLowerCase());
  if (!found) { showCanhBaoCX5("Không tìm thấy quy cách này"); return; }
  const key = keyQCX5(found.msp, found.ten);
  if (!doiChieuCX5[key]) doiChieuCX5[key] = { msp: found.msp, ten: found.ten, sxEntries: [] };
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

function renderDoiChieuCX5() {
  const gom = tomTatCX5();
  Object.keys(gom).forEach(key => {
    if (!doiChieuCX5[key]) doiChieuCX5[key] = { msp: gom[key].msp, ten: gom[key].ten, sxEntries: [] };
  });

  const container = document.getElementById("cx5-doichieu-list");
  const keys = Object.keys(doiChieuCX5);
  if (keys.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--cream-soft);padding:16px 0">Chưa có quy cách nào</div>';
  } else {
    container.innerHTML = keys.map(key => {
      const kho = gom[key] || { bao: 0, kg: 0, baoDaDongBo: 0 };
      const dc = doiChieuCX5[key];
      const sxTong = dc.sxEntries.reduce((s, v) => s + v, 0);
      const khop = Math.abs(sxTong - kho.kg) < 1e-9 && kho.kg > 0;
      const conDeDongBo = (kho.bao - (kho.baoDaDongBo || 0)) > 0;

      const dsSo = dc.sxEntries.map((v, idx) =>
        '<span class="cx5-so-sx">' + v + ' <span onclick="xoaSoSXCX5(\'' + key + '\',' + idx + ')">✕</span></span>'
      ).join("");

      return '<div class="cx5-dc-card">' +
        '<div class="cx5-dc-ten">' + dc.ten + ' <span class="cx5-dc-msp">(' + dc.msp + ')</span></div>' +
        '<div class="cx5-dc-kho">Kho — Bao: <b>' + kho.bao + '</b> · Kg: <b>' + kho.kg.toFixed(1) + '</b></div>' +
        '<div style="margin-top:10px">' +
        '<label>SX</label>' +
        '<div class="cx5-dc-sx-row">' +
        '<input type="number" min="0" step="0.1" placeholder="Nhập số..." onkeydown="if(event.key===\'Enter\'){event.preventDefault();themSoSXCX5(\'' + key + '\', this)}">' +
        '<button class="btn btn-blue" onclick="themSoSXCX5(\'' + key + '\', this.previousElementSibling)">+</button>' +
        '</div>' +
        '<div style="margin-top:8px">' + dsSo + '</div>' +
        '<div class="cx5-dc-tong">Tổng SX: <b>' + sxTong.toFixed(1) + '</b></div>' +
        '</div>' +
        '<div class="cx5-dc-ketqua ' + (khop ? "cx5-dc-khop" : "cx5-dc-lech") + '">' +
        (khop ? "Khớp hoàn toàn" : "Lệch: " + (sxTong - kho.kg).toFixed(1)) +
        '</div>' +
        '<button class="btn btn-green btn-full" ' + (khop && conDeDongBo ? "" : "disabled") +
        ' onclick="dongBoCX5(\'' + key + '\')">' +
        (conDeDongBo ? "Đồng bộ" : "Đã đồng bộ đủ") + '</button>' +
        '</div>';
    }).join("");
  }

  container.innerHTML += '<button class="btn btn-full" style="background:var(--neutral);color:var(--cream);margin-top:6px" onclick="themQCDoiChieuCX5()">+ Thêm quy cách</button>';
}

function docPendingCX5() {
  try { return JSON.parse(localStorage.getItem("cx5_pending_saves")) || []; } catch (e) { return []; }
}

function luuPendingCX5(list) {
  try { localStorage.setItem("cx5_pending_saves", JSON.stringify(list)); } catch (e) {}
}

async function dongBoCX5(key) {
  const dc = doiChieuCX5[key];
  if (!dc) return;
  const chuaDongBo = phienCX5.filter(r => keyQCX5(r.msp, r.ten) === key && !r.daDongBo);
  if (chuaDongBo.length === 0) { showCanhBaoCX5("Không có dòng nào cần đồng bộ"); return; }

  const bao = chuaDongBo.length;
  const kg = chuaDongBo.reduce((s, r) => s + r.kg, 0);
  const kgList = chuaDongBo.map(r => r.kg);
  const payload = {
    dateStr: ngayCX5, msp: dc.msp, ten: dc.ten,
    bao: Math.round(bao * 100) / 100, kg: Math.round(kg * 100) / 100, kgList
  };

  try {
    const r = await callApiCX5({ action: "submitEntryX5", payload });
    if (!r.success) { showCanhBaoCX5(dc.ten + ": " + r.message); return; }
    chuaDongBo.forEach(row => { row.daDongBo = true; });
    luuVaoLichSuCX5(dc, kgList, kg);
  } catch (e) {
    const pending = docPendingCX5();
    pending.push(payload);
    luuPendingCX5(pending);
    chuaDongBo.forEach(row => { row.daDongBo = true; });
    luuVaoLichSuCX5(dc, kgList, kg);
    showCanhBaoCX5("Mất mạng — đã lưu tạm, sẽ tự gửi lại sau");
  }

  luuPhienDoDangCX5();
  renderBangChiTietCX5();
  renderBangTongHopCX5();
  renderDoiChieuCX5();
  if (typeof capNhatTrangThaiMang === "function") capNhatTrangThaiMang();
}

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
    if (!s.ngay) return false;
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

function luuVaoLichSuCX5(dc, kgList, tongKg) {
  const list = docLichSuCX5();
  list.push({
    idPhien: idPhienHienTaiC5, ngay: ngayCX5, capNhatLuc: new Date().toISOString(),
    msp: dc.msp, ten: dc.ten, kgList, tongKg
  });
  luuLichSuCX5(list);
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
    container.innerHTML = '<div style="text-align:center;color:var(--cream-soft);padding:20px 0;">Chưa có lượt đồng bộ nào trong ' + CX5_LICHSU_SO_NGAY_GIU + ' ngày qua</div>';
    return;
  }
  container.innerHTML = list.map(s => {
    const gio = new Date(s.capNhatLuc).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return '<div class="irow"><span class="ilabel">' + s.ngay + " · " + gio + '</span><span class="ivalue">' +
      s.ten + " · " + s.tongKg.toFixed(1) + ' kg</span></div>';
  }).join("");
}
window.renderLichSuCX5 = renderLichSuCX5;

function tiepTucPhienChiX5() {
  let state = null;
  try { state = JSON.parse(localStorage.getItem("cx5_phien_dodang")); } catch (e) {}
  if (!state) return;
  if (typeof chuyenTrangKhongNav === "function") chuyenTrangKhongNav("chiX5");
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
window.suaDongCX5 = suaDongCX5;
window.xoayBangCX5 = xoayBangCX5;
window.ketThucPhienCX5 = ketThucPhienCX5;
window.dongDoiChieuCX5 = dongDoiChieuCX5;
window.themQCDoiChieuCX5 = themQCDoiChieuCX5;
window.themSoSXCX5 = themSoSXCX5;
window.xoaSoSXCX5 = xoaSoSXCX5;
window.dongBoCX5 = dongBoCX5;

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
    if (!e.target.closest(".cx5-ten-wrap")) closeDropdownCX5();
  });
});
