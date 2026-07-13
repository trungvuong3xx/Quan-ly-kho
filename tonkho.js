// ── Cấu hình ────────────────────────────────────────────────
const KTT_CONFIG = {
  clientId: "779029500304-c4cuj67lgq23b9oj0fp40pfhuche7km6.apps.googleusercontent.com",
  spreadsheetId: "1K8kx_GiqKxppxc3AheQyvHr3d_LX6S11rKARf8c3rTI",
  scope: "https://www.googleapis.com/auth/spreadsheets.readonly"
};

const HANG_FOR = { tu: 544, den: 630 };

let kttToken = null;
let kttUser = null;
let listData = []; // cache sheet LIST
let thangData = []; // cache sheet tháng

// ── OAuth Google ─────────────────────────────────────────────
function onGoogleLogin(response) {
  const payload = parseJwt(response.credential);
  const email = payload.email;

  // Kiểm tra whitelist
  kiemTraWhitelist(email).then(ok => {
    if (!ok) {
      alert("❌ Email " + email + " không có quyền truy cập!");
      return;
    }
    kttUser = { email, name: payload.name };
    kttToken = response.credential;

    // Lấy access token để gọi Sheets API
    layAccessToken();
  });
}

function layAccessToken() {
  const client = google.accounts.oauth2.initTokenClient({
    client_id: KTT_CONFIG.clientId,
    scope: KTT_CONFIG.scope,
    callback: async (res) => {
      if (res.error) { alert("Lỗi xác thực: " + res.error); return; }
      kttToken = res.access_token;
      await taiDuLieu();
      document.getElementById("ktt-login").style.display = "none";
      document.getElementById("ktt-main").style.display = "block";
    }
  });
  client.requestAccessToken();
}

function parseJwt(token) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

// ── Kiểm tra whitelist ───────────────────────────────────────
async function kiemTraWhitelist(email) {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${KTT_CONFIG.spreadsheetId}/values/Email!A:A`;
    // Dùng API key public read hoặc gọi qua fetch không cần token lần này
    // Vì chưa có token, dùng cách khác: load Google Identity Services trước
    // Tạm thời return true, sẽ check sau khi có token
    return true;
  } catch(e) {
    return false;
  }
}

async function kiemTraWhitelistVoiToken(email) {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${KTT_CONFIG.spreadsheetId}/values/Email!A:A`;
    const res = await fetch(url, { headers: { Authorization: "Bearer " + kttToken } });
    const data = await res.json();
    const emails = (data.values || []).flat().map(e => e.toLowerCase().trim());
    return emails.includes(email.toLowerCase().trim());
  } catch(e) {
    return false;
  }
}

// ── Tải dữ liệu từ Sheets ───────────────────────────────────
async function taiDuLieu() {
  const thang = new Date().getMonth() + 1;

  // Kiểm tra whitelist với token
  if (kttUser) {
    const ok = await kiemTraWhitelistVoiToken(kttUser.email);
    if (!ok) {
      alert("❌ Email không có quyền truy cập!");
      dangXuatKTT();
      return;
    }
  }

  // Tải LIST
  const resL = await gSheetsGet("LIST!A:B");
  listData = resL.values || [];

  // Tải sheet tháng (cột G, H, I, J, K)
  const resT = await gSheetsGet(`${thang}!G:K`);
  thangData = resT.values || [];
}

async function gSheetsGet(range) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${KTT_CONFIG.spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: "Bearer " + kttToken } });
  return res.json();
}

// ── Tìm kiếm tồn kho ────────────────────────────────────────
function timKiemTon(query) {
  const q = query.trim().toLowerCase();
  const results = document.getElementById("ktt-results");
  results.innerHTML = "";

  if (!q || q.length < 2) return;

  // Tìm trong LIST theo tên (cột A)
  const matches = listData.filter(row => {
    const ten = (row[0] || "").toLowerCase();
    return ten.includes(q);
  });

  if (matches.length === 0) {
    results.innerHTML = `<div class="card" style="color:var(--sub);text-align:center;font-size:14px">Không tìm thấy</div>`;
    return;
  }

  matches.slice(0, 20).forEach(row => {
    const qc = row[0] || "";
    const msp = row[1] || "";
    if (!msp) return;

    // Tìm trong sheet tháng theo cột G (index 0 vì lấy từ G:K)
    const ketQuaKho = [];
    const ketQuaFor = [];

    thangData.forEach((thangRow, idx) => {
      if (!thangRow[0]) return;
      if (String(thangRow[0]).trim() !== msp) return;

      const hangSo = idx + 1; // 1-based (vì lấy từ G1)
      const item = {
        qc, msp,
        baoD: thangRow[1] || "0",
        kgD:  thangRow[2] || "0",
        baoC: thangRow[3] || "0",
        kgC:  thangRow[4] || "0"
      };

      if (hangSo >= HANG_FOR.tu && hangSo <= HANG_FOR.den) {
        ketQuaFor.push(item);
      } else {
        ketQuaKho.push(item);
      }
    });

    // Render kết quả
    if (ketQuaKho.length > 0) {
      ketQuaKho.forEach(item => {
        results.appendChild(taoCardKetQua(item, "Kho thường"));
      });
    }
    if (ketQuaFor.length > 0) {
      ketQuaFor.forEach(item => {
        results.appendChild(taoCardKetQua(item, "Kho FOR"));
      });
    }
    if (ketQuaKho.length === 0 && ketQuaFor.length === 0) {
      // MSP có trong LIST nhưng không có trong sheet tháng
      results.appendChild(taoCardKetQua({ qc, msp, baoD:"—", kgD:"—", baoC:"—", kgC:"—" }, "Chưa có dữ liệu"));
    }
  });
}

function taoCardKetQua(item, loaiKho) {
  const div = document.createElement("div");
  div.className = "card";
  div.style.marginBottom = "10px";

  const mauLoai = loaiKho === "Kho FOR" ? "var(--accent)" :
                  loaiKho === "Chưa có dữ liệu" ? "var(--sub)" : "var(--success)";

  div.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <span style="font-size:14px;font-weight:700;color:var(--text)">${item.qc}</span>
      <span style="font-size:11px;font-weight:700;color:${mauLoai};background:rgba(255,255,255,.06);padding:3px 10px;border-radius:20px">${loaiKho}</span>
    </div>
    <div style="font-size:11px;color:var(--sub);margin-bottom:10px">${item.msp}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="background:var(--surface2);border-radius:8px;padding:10px">
        <div style="font-size:11px;color:var(--sub);margin-bottom:4px">TỒN ĐẦU</div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${item.baoD} bao</div>
        <div style="font-size:13px;color:var(--sub)">${item.kgD} kg</div>
      </div>
      <div style="background:var(--surface2);border-radius:8px;padding:10px">
        <div style="font-size:11px;color:var(--sub);margin-bottom:4px">TỒN CUỐI</div>
        <div style="font-size:14px;font-weight:700;color:var(--accent)">${item.baoC} bao</div>
        <div style="font-size:13px;color:var(--sub)">${item.kgC} kg</div>
      </div>
    </div>
  `;
  return div;
}

// ── Navigation ───────────────────────────────────────────────
function moKiemTraTon() {
  document.querySelectorAll(".page").forEach(p => p.style.display = "none");
  document.getElementById("kiemTraTon").style.display = "block";
  document.querySelectorAll(".bnav-btn").forEach(b => b.classList.remove("active"));
}

function dongKiemTraTon() {
  document.getElementById("kiemTraTon").style.display = "none";
  chuyenTrang("trangChu", document.querySelector(".bnav-btn"));
}

function dangXuatKTT() {
  kttToken = null;
  kttUser = null;
  listData = [];
  thangData = [];
  document.getElementById("ktt-login").style.display = "block";
  document.getElementById("ktt-main").style.display = "none";
  document.getElementById("ktt-results").innerHTML = "";
  document.getElementById("ktt-search").value = "";
  google.accounts.id.disableAutoSelect();
}