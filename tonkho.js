// ── Tồn kho (đăng nhập Google, gọi thẳng Google Sheets API) ─────────

const TK_CLIENT_ID = "779029500304-c4cuj67lgq23b9oj0fp40pfhuche7km6.apps.googleusercontent.com";
const TK_SPREADSHEET_ID = "1K8kx_GiqKxppxc3AheQyvHr3d_LX6S11rKARf8c3rTI";
const TK_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

const TK_LIST_SHEET = "LIST";
const TK_MSP_COL_INDEX = 6; // cột G trong sheet tháng (0-based: A=0...G=6)
const TK_VUNG_THUONG_RANGES = [[6, 543], [637, 644]];
const TK_VUNG_FOR_RANGES = [[544, 630]];

const TK_STORAGE_KEY = "tk_google_auth";

let tkTokenClient = null;
let tkAccessToken = null;
let tkTokenExpiryMs = 0;
let tkEmail = null;
let tkListCache = null;
let tkFilteredList = [];
let tkActiveIndex = -1;

function tkSheetName() {
  const val = document.getElementById("tk-ngay").value;
  const d = val ? new Date(val) : new Date();
  return String(d.getMonth() + 1);
}

function tkSo(val) {
  if (val === "" || val === "-" || val === null || val === undefined) return 0;
  if (typeof val === "string") val = val.replace(/,/g, ""); // bỏ dấu phẩy ngăn cách hàng nghìn, vd "1,234.5" -> "1234.5"
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function tkBoDau(str) {
  return String(str).normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function tkKhoiTaoTokenClient() {
  if (tkTokenClient || typeof google === "undefined" || !google.accounts) return;
  tkTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: TK_CLIENT_ID,
    scope: TK_SCOPE,
    callback: "" // gán lại mỗi lần gọi requestAccessToken, xem tkYeuCauToken()
  });
}

function tkYeuCauToken(prompt) {
  return new Promise((resolve, reject) => {
    tkKhoiTaoTokenClient();
    if (!tkTokenClient) { reject(new Error("Chưa tải xong thư viện đăng nhập Google, thử lại sau vài giây.")); return; }
    tkTokenClient.callback = (resp) => {
      if (resp.error) { reject(new Error(resp.error)); return; }
      tkAccessToken = resp.access_token;
      tkTokenExpiryMs = Date.now() + (Number(resp.expires_in || 3600) * 1000) - 60000;
      tkLuuPhien();
      resolve(tkAccessToken);
    };
    tkTokenClient.requestAccessToken({ prompt: prompt });
  });
}

async function tkLayToken() {
  if (tkAccessToken && Date.now() < tkTokenExpiryMs) return tkAccessToken;
  return tkYeuCauToken(tkAccessToken ? "" : "consent");
}

async function tkDangNhap() {
  try {
    document.getElementById("tk-login-loading").style.display = "flex";
    await tkYeuCauToken("consent");
    await tkLayThongTinTaiKhoan();
    tkCapNhatUIDangNhap();
    tkClearKetQua();
    tkTaiDanhSachLIST();
  } catch (err) {
    tkBaoLoi("Đăng nhập thất bại: " + err.message);
  } finally {
    document.getElementById("tk-login-loading").style.display = "none";
  }
}

async function tkLayThongTinTaiKhoan() {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: "Bearer " + tkAccessToken }
    });
    const data = await res.json();
    tkEmail = data.email || null;
    tkLuuPhien();
  } catch (e) {
    tkEmail = null;
  }
}

function tkLuuPhien() {
  try {
    localStorage.setItem(TK_STORAGE_KEY, JSON.stringify({
      token: tkAccessToken,
      expiry: tkTokenExpiryMs,
      email: tkEmail
    }));
  } catch (e) {}
}

function tkXoaPhienLuu() {
  try { localStorage.removeItem(TK_STORAGE_KEY); } catch (e) {}
}

function tkChoGoogleSanSang(timeoutMs) {
  return new Promise(resolve => {
    const batDau = Date.now();
    (function kiemTra() {
      if (typeof google !== "undefined" && google.accounts && google.accounts.oauth2) { resolve(true); return; }
      if (Date.now() - batDau > timeoutMs) { resolve(false); return; }
      setTimeout(kiemTra, 200);
    })();
  });
}

// Khôi phục đăng nhập đã lưu từ lần trước (nếu có), chạy khi mở app
async function tkKhoiPhucPhien() {
  let luu = null;
  try { luu = JSON.parse(localStorage.getItem(TK_STORAGE_KEY) || "null"); } catch (e) {}

  if (!luu || !luu.token) { tkCapNhatUIDangNhap(); return; }

  tkAccessToken = luu.token;
  tkTokenExpiryMs = luu.expiry || 0;
  tkEmail = luu.email || null;

  if (Date.now() < tkTokenExpiryMs) {
    // Token còn hạn, dùng luôn, không cần hỏi gì
    tkCapNhatUIDangNhap();
    return;
  }

  // Token hết hạn: thử âm thầm xin token mới, không hiện popup đăng nhập
  const sanSang = await tkChoGoogleSanSang(5000);
  if (sanSang) {
    try {
      await tkYeuCauToken("");
      await tkLayThongTinTaiKhoan();
    } catch (e) {
      tkAccessToken = null;
      tkTokenExpiryMs = 0;
      tkEmail = null;
      tkXoaPhienLuu();
    }
  } else {
    // Không tải kịp thư viện đăng nhập Google, coi như phải đăng nhập lại thủ công
    tkAccessToken = null;
    tkTokenExpiryMs = 0;
    tkEmail = null;
  }
  tkCapNhatUIDangNhap();
}

function tkDangXuat() {
  if (tkAccessToken) {
    try { google.accounts.oauth2.revoke(tkAccessToken, () => {}); } catch (e) {}
  }
  tkAccessToken = null;
  tkTokenExpiryMs = 0;
  tkEmail = null;
  tkListCache = null;
  tkXoaPhienLuu();
  tkDongDropdown();
  tkCapNhatUIDangNhap();
  tkClearKetQua();
}

function tkCapNhatUIDangNhap() {
  const dangNhap = !!tkAccessToken;

  const btnTonKho = document.getElementById("btn-ton-kho");
  const btnDangNhap = document.getElementById("btn-dang-nhap-gg");
  const taiKhoanBox = document.getElementById("tk-taikhoan-trangchu");
  const emailEl = document.getElementById("tk-email");

  if (btnTonKho) btnTonKho.style.display = dangNhap ? "block" : "none";
  if (btnDangNhap) btnDangNhap.style.display = dangNhap ? "none" : "block";
  if (taiKhoanBox) taiKhoanBox.style.display = dangNhap ? "flex" : "none";
  if (emailEl) emailEl.textContent = tkEmail || "Đã đăng nhập";

  // Mất đăng nhập trong lúc đang ở trang Tồn kho -> đưa về Trang chủ
  if (!dangNhap) {
    const trangTonKho = document.getElementById("tonKho");
    if (trangTonKho && trangTonKho.classList.contains("active") && typeof diToiTab === "function") {
      diToiTab("trangChu");
    }
  }
}

function tkClearKetQua() {
  document.getElementById("tk-ket-qua").innerHTML = "";
}

function tkBaoLoi(text) {
  const el = document.getElementById("tk-ket-qua");
  el.innerHTML = '<div class="tk-loi">' + text.replace(/</g, "&lt;") + "</div>";
}

async function tkGoiSheets(range) {
  const token = await tkLayToken();
  const url = "https://sheets.googleapis.com/v4/spreadsheets/" + TK_SPREADSHEET_ID +
    "/values/" + encodeURIComponent(range) + "?valueRenderOption=UNFORMATTED_VALUE";
  let res = await fetch(url, { headers: { Authorization: "Bearer " + token } });

  if (res.status === 401) {
    // Token hết hạn giữa chừng, xin lại 1 lần rồi thử lại đúng 1 lần
    const newToken = await tkYeuCauToken("");
    res = await fetch(url, { headers: { Authorization: "Bearer " + newToken } });
  }

  if (res.status === 403) throw new Error("Tài khoản này chưa được cấp quyền xem file. Liên hệ để được chia sẻ quyền Xem trên Google Sheet.");
  if (!res.ok) throw new Error("Lỗi gọi Google Sheets API (" + res.status + ")");

  const data = await res.json();
  return data.values || [];
}

async function tkGoiSheetsBatch(ranges) {
  if (ranges.length === 0) return [];
  const token = await tkLayToken();
  const q = ranges.map(r => "ranges=" + encodeURIComponent(r)).join("&");
  const url = "https://sheets.googleapis.com/v4/spreadsheets/" + TK_SPREADSHEET_ID + "/values:batchGet?" + q;
  let res = await fetch(url, { headers: { Authorization: "Bearer " + token } });

  if (res.status === 401) {
    const newToken = await tkYeuCauToken("");
    res = await fetch(url, { headers: { Authorization: "Bearer " + newToken } });
  }

  if (res.status === 403) throw new Error("Tài khoản này chưa được cấp quyền xem file. Liên hệ để được chia sẻ quyền Xem trên Google Sheet.");
  if (!res.ok) throw new Error("Lỗi gọi Google Sheets API (" + res.status + ")");

  const data = await res.json();
  return data.valueRanges || [];
}

function tkTrongKhoang(row, ranges) {
  return ranges.some(([start, end]) => row >= start && row <= end);
}

async function tkTimTonKho() {
  const input = document.getElementById("tk-ten");
  const query = input.value.trim();
  if (!query) { tkBaoLoi("Vui lòng nhập tên sản phẩm cần tra."); input.focus(); return; }

  tkClearKetQua();
  document.getElementById("tk-loading").style.display = "flex";

  try {
    await tkLayToken();

    const sheetName = tkSheetName();
    const qBoDau = tkBoDau(query).toUpperCase();

    const listData = await tkTaiDanhSachLIST();
    if (!listData) { tkBaoLoi("Không tải được sheet LIST."); return; }

    const ungVien = listData
      .filter(item => tkBoDau(item.ten).toUpperCase().includes(qBoDau))
      .slice(0, 15);

    if (ungVien.length === 0) {
      tkBaoLoi("Không tìm thấy sản phẩm nào khớp với \"" + query + "\".");
      return;
    }

    let colG;
    try {
      colG = await tkGoiSheets("'" + sheetName + "'!G6:G644");
    } catch (e) {
      tkBaoLoi("Chưa có sheet tháng \"" + sheetName + "\", chưa thể tra tồn kho.");
      return;
    }

    const dongTheoMsp = {}; // msp -> { thuong: rowNum|null, for: rowNum|null }
    colG.forEach((r, idx) => {
      const msp = r[0] ? String(r[0]).trim() : "";
      if (!msp) return;
      const rowNum = 6 + idx;
      if (!dongTheoMsp[msp]) dongTheoMsp[msp] = { thuong: null, for: null };
      if (tkTrongKhoang(rowNum, TK_VUNG_FOR_RANGES)) dongTheoMsp[msp].for = rowNum;
      else if (tkTrongKhoang(rowNum, TK_VUNG_THUONG_RANGES)) dongTheoMsp[msp].thuong = rowNum;
    });

    const canDoc = []; // { ten, msp, kho, rowNum, range }
    ungVien.forEach(item => {
      const dong = dongTheoMsp[item.msp];
      if (!dong) return;
      if (dong.thuong) canDoc.push({ ten: item.ten, msp: item.msp, kho: "Thường", rowNum: dong.thuong });
      if (dong.for) canDoc.push({ ten: item.ten, msp: item.msp, kho: "FOR", rowNum: dong.for });
    });

    if (canDoc.length === 0) {
      tkBaoLoi("Không tìm thấy MSP khớp trong sheet tháng \"" + sheetName + "\".");
      return;
    }

    const ranges = canDoc.map(c => "'" + sheetName + "'!H" + c.rowNum + ":K" + c.rowNum);
    const valueRanges = await tkGoiSheetsBatch(ranges);

    const ketQua = canDoc.map((c, idx) => {
      const row = (valueRanges[idx] && valueRanges[idx].values && valueRanges[idx].values[0]) || [];
      return {
        ten: c.ten, msp: c.msp, kho: c.kho,
        baoDau: tkSo(row[0]), kgDau: tkSo(row[1]),
        baoCuoi: tkSo(row[2]), kgCuoi: tkSo(row[3])
      };
    });

    tkHienKetQua(ketQua);
  } catch (err) {
    tkBaoLoi(err.message || "Lỗi không xác định.");
  } finally {
    document.getElementById("tk-loading").style.display = "none";
  }
}

function tkHienKetQua(ketQua) {
  const el = document.getElementById("tk-ket-qua");
  el.innerHTML = ketQua.map(k => `
    <div class="tk-card">
      <div class="tk-card-top">
        <div class="tk-card-ten">${String(k.ten).replace(/</g, "&lt;")}</div>
        <div class="tk-badge ${k.kho === "FOR" ? "tk-badge-for" : "tk-badge-thuong"}">${k.kho}</div>
      </div>
      <div class="irow"><span class="ilabel">MSP</span><span class="ivalue">${k.msp}</span></div>
      <div class="irow"><span class="ilabel">Tồn đầu</span><span class="ivalue">${k.baoDau} bao · ${k.kgDau} kg</span></div>
      <div class="irow stock-ton"><span class="ilabel">Tồn hiện tại</span><span class="ivalue">${k.baoCuoi} bao · ${k.kgCuoi} kg</span></div>
    </div>
  `).join("");
}

async function tkTaiDanhSachLIST() {
  if (tkListCache) return tkListCache;
  try {
    const rows = await tkGoiSheets("'" + TK_LIST_SHEET + "'!A2:B2000");
    tkListCache = rows
      .filter(r => r[0] && r[1])
      .map(r => ({ ten: String(r[0]).trim(), msp: String(r[1]).trim() }));
  } catch (e) {
    tkListCache = null;
  }
  return tkListCache;
}

function tkDongDropdown() {
  tkFilteredList = [];
  tkActiveIndex = -1;
  const el = document.getElementById("tk-dropdown");
  el.classList.remove("show");
  el.innerHTML = "";
}

function tkRenderDropdown() {
  const el = document.getElementById("tk-dropdown");
  if (tkFilteredList.length === 0) {
    el.classList.remove("show");
    el.innerHTML = "";
    return;
  }
  el.innerHTML = tkFilteredList.map((item, idx) =>
    '<div class="tk-dropdown-item' + (idx === tkActiveIndex ? ' active' : '') + '" data-idx="' + idx + '">' +
    item.ten.replace(/</g, "&lt;") + '</div>'
  ).join("");
  el.classList.add("show");

  Array.from(el.children).forEach(child => {
    child.addEventListener("mousedown", e => {
      e.preventDefault();
      const idx = parseInt(child.getAttribute("data-idx"), 10);
      tkChonGoiY(tkFilteredList[idx]);
    });
  });
}

async function tkOnInputTen() {
  const query = document.getElementById("tk-ten").value.trim();
  if (!query) { tkDongDropdown(); return; }

  const list = await tkTaiDanhSachLIST();
  if (!list) { tkDongDropdown(); return; }

  const qBoDau = tkBoDau(query).toUpperCase();
  tkFilteredList = list.filter(item => tkBoDau(item.ten).toUpperCase().includes(qBoDau)).slice(0, 30);
  tkActiveIndex = -1;
  tkRenderDropdown();
}

function tkOnKeydownTen(e) {
  if (e.key === "ArrowDown") {
    if (!tkFilteredList.length) return;
    e.preventDefault();
    tkActiveIndex = Math.min(tkActiveIndex + 1, tkFilteredList.length - 1);
    tkRenderDropdown();
  } else if (e.key === "ArrowUp") {
    if (!tkFilteredList.length) return;
    e.preventDefault();
    tkActiveIndex = Math.max(tkActiveIndex - 1, 0);
    tkRenderDropdown();
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (tkFilteredList.length) tkChonGoiY(tkFilteredList[tkActiveIndex >= 0 ? tkActiveIndex : 0]);
    else tkTimTonKho();
  } else if (e.key === "Escape") {
    tkDongDropdown();
  }
}

function tkChonGoiY(item) {
  document.getElementById("tk-ten").value = item.ten;
  tkDongDropdown();
  tkTimTonKho();
}

document.addEventListener("click", e => {
  const wrap = document.querySelector(".tk-ten-wrap");
  if (wrap && !wrap.contains(e.target)) tkDongDropdown();

  const ngayEl = document.getElementById("tk-ngay");
  if (ngayEl && e.target !== ngayEl) ngayEl.blur();
});

function tkDoiNgay() {
  const el = document.getElementById("tk-ngay");
  if (el) el.blur();
  tkClearKetQua();
}

(function tkKhoiTaoNgay() {
  const el = document.getElementById("tk-ngay");
  if (el && !el.value) {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    el.value = d.getFullYear() + "-" + m + "-" + day;
  }
})();

tkKhoiPhucPhien();

window.tkOnInputTen = tkOnInputTen;
window.tkOnKeydownTen = tkOnKeydownTen;
window.tkDoiNgay = tkDoiNgay;
window.tkDangNhap = tkDangNhap;
window.tkDangXuat = tkDangXuat;
window.tkTimTonKho = tkTimTonKho;
