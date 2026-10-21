const API_TONKHO = "https://script.google.com/macros/s/AKfycbyOhUM1KCg0eUsj-tBPDFnyJXS_PDlxcsRWRqzR7ZdoX9ZCMRlvPApouk9Jn6yghVS1xg/exec";
const TK_FREQ_KEY = "tk_search_freq";

let tkListCache = null;
let tkListPromise = null;
let tkFilteredList = [];
let tkActiveIndex = -1;

function tkChuanHoaTimKiem(str) {
  const norm = String(str || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
  const clean = norm.replace(/[^a-z0-9]/g, " ");
  return { norm, clean };
}

// Lấy lịch sử tần suất tìm kiếm từ localStorage
function tkLayLichSuTanSuat() {
  try {
    return JSON.parse(localStorage.getItem(TK_FREQ_KEY) || "{}");
  } catch (e) {
    return {};
  }
}

// Ghi nhận tần suất tìm kiếm khi người dùng chọn/tìm sản phẩm
function tkGhiNhanTanSuat(ten) {
  if (!ten) return;
  try {
    const freq = tkLayLichSuTanSuat();
    freq[ten] = (freq[ten] || 0) + 1;
    localStorage.setItem(TK_FREQ_KEY, JSON.stringify(freq));
  } catch (e) {}
}

// Lọc gợi ý tìm kiếm thông minh theo cơ chế chấm điểm ưu tiên (Tier Scoring Engine):
// 1. Ưu tiên TUYỆT ĐỐI cho TÊN Quy Cách (khớp phân đoạn / bắt đầu từ / chứa từ).
// 2. Chặn tìm kiếm chuỗi ngắn (< 4 số) ở giữa mã MSP để không bị dính tiền tố trùng lặp (ví dụ 11130...).
// 3. Cho phép tìm theo MSP khi gõ đủ 4 số cuối hoặc khớp trọn vẹn mã MSP.
// 4. Tần suất (lịch sử thiết bị freqMap & số lượt sheet count) dùng làm điểm cộng phụ, không đè độ khớp tên.
// 5. Lọc vùng NORMAL/FOR chuẩn theo quy tắc dự án.
function tkLocDanhSach(list, query, gioiHan = 30, isLoaiXuat = false) {
  if (!query || !query.trim()) return [];
  const { norm: qNorm, clean: qClean } = tkChuanHoaTimKiem(query);
  const qWords = qClean.split(/\s+/).filter(Boolean);
  if (qWords.length === 0) return [];

  const freqMap = tkLayLichSuTanSuat();
  const scoredItems = [];

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const { norm: tenNorm, clean: tenClean } = tkChuanHoaTimKiem(item.ten);
    const { norm: mspNorm, clean: mspClean } = tkChuanHoaTimKiem(item.msp);

    let score = 0;

    if (qWords.length === 1) {
      // Query đơn từ (ví dụ: "30", "380", "pe")
      const singleQ = qWords[0];
      const tokens = tenNorm.split(/[\s/_\-]+/).filter(Boolean);
      const tokenExact = tokens.some(t => t === singleQ);
      const tokenStarts = tokens.some(t => t.startsWith(singleQ));

      if (tenNorm === singleQ || tenClean === singleQ) {
        score += 10000; // Khớp chính xác cả tên
      } else if (tokenExact) {
        score += 8500;  // Khớp chính xác phân đoạn/từ riêng (ví dụ: /30 trong 365d/30)
      } else if (tenNorm.startsWith(singleQ) || tenClean.startsWith(singleQ)) {
        score += 8000;  // Tên bắt đầu bằng từ khóa (ví dụ: 300D/...)
      } else if (tokenStarts) {
        score += 7500;  // Phân đoạn bắt đầu bằng từ khóa (ví dụ: 30EX, 30B)
      } else if (tenClean.includes(singleQ)) {
        score += 3000;  // Chứa ở giữa từ (ví dụ: 330Đen)
      }
    } else {
      // Query đa từ (ví dụ: "380 30", "380/30", "pe trang")
      const allInTen = qWords.every(w => tenClean.includes(w));
      if (allInTen) {
        score += 7000;
        if (tenClean.includes(qClean)) {
          score += 2000; // Khớp đúng thứ tự liền nhau
        }
        if (tenClean.startsWith(qClean)) {
          score += 1000;
        }
      }
    }

    // Khớp theo mã MSP (chỉ xét khi TÊN chưa khớp để không làm nhiễu kết quả quy cách)
    if (score === 0) {
      if (mspNorm === qNorm || mspClean === qClean) {
        score += 5000; // Khớp chính xác toàn bộ mã MSP
      } else if (mspNorm.startsWith(qNorm)) {
        score += 2000; // Khớp tiền tố mã MSP
      } else if (qNorm.length >= 4 && mspNorm.endsWith(qNorm)) {
        score += 1500; // Khớp đuôi mã MSP (4 số cuối)
      } else if (qNorm.length >= 4 && mspNorm.includes(qNorm)) {
        score += 800;  // Chứa chuỗi nếu query đủ dài (>= 4 ký tự)
      }
    }

    if (score > 0) {
      // Điểm cộng ưu tiên tần suất sử dụng thực tế trên thiết bị (localCount)
      // Mã nào người dùng chọn nhiều trên máy sẽ được cộng điểm mạnh để vượt lên đầu
      const localCount = Number(freqMap[item.ten] || 0);
      const sheetCount = Number(item.count || item.countThuong || item.countFor || 0);
      const localBonus = localCount > 0 ? (score >= 3000 ? 1200 + localCount * 300 : localCount * 50) : 0;
      const sheetBonus = Math.min(sheetCount * 2, 300);
      score += localBonus + sheetBonus;

      scoredItems.push({ item, score });
    }
  }

  scoredItems.sort((a, b) => b.score - a.score || String(a.item.ten).localeCompare(String(b.item.ten), 'vi'));

  const matched = scoredItems.map(s => s.item);

  // Quy tắc lọc vùng theo sidebar.txt:
  let filteredResult;
  if (!isLoaiXuat) {
    const normalMspSet = new Set(matched.filter(i => i.vung === "NORMAL").map(i => i.msp));
    filteredResult = matched.filter(item => item.vung !== "FOR" || !normalMspSet.has(item.msp));
  } else {
    filteredResult = matched;
  }

  return filteredResult.slice(0, gioiHan);
}

function tkMoTonKho() {
  if (typeof chuyenTrangKhongNav === "function") {
    chuyenTrangKhongNav("tonKho");
  }
  tkTaiDanhSachLIST();
}

async function tkTaiDanhSachLIST(forceRefresh = false) {
  if (!forceRefresh && tkListCache) return tkListCache;
  if (!forceRefresh && tkListPromise) return tkListPromise;

  tkListPromise = (async () => {
    try {
      const res = await fetch(API_TONKHO, {
        method: "POST",
        body: JSON.stringify({ action: "layDanhSachSanPhamTonKhoCX5" }),
        redirect: "follow"
      }).then(async r => {
        const text = await r.text();
        try { return JSON.parse(text); } catch (e) { return { list: [] }; }
      });

      if (res && res.list && Array.isArray(res.list)) {
        tkListCache = res.list;
      } else {
        tkListCache = [];
      }
    } catch (e) {
      tkListCache = null;
    }
    tkListPromise = null;
    return tkListCache;
  })();

  return tkListPromise;
}

function tkClearKetQua() {
  const el = document.getElementById("tk-ket-qua");
  if (el) el.innerHTML = "";
}

function tkBaoLoi(text) {
  const el = document.getElementById("tk-ket-qua");
  const msg = typeof rutGonThongBaoLoi === "function" ? rutGonThongBaoLoi(text) : text;
  if (el) el.innerHTML = '<div class="tk-loi">' + String(msg).replace(/</g, "&lt;") + "</div>";
}

async function tkTimTonKho() {
  const input = document.getElementById("tk-ten");
  if (!input) return;
  const query = input.value.trim();
  if (!query) { tkBaoLoi("Vui lòng nhập tên sản phẩm cần tra."); input.focus(); return; }

  tkClearKetQua();
  const loadingEl = document.getElementById("tk-loading");
  if (loadingEl) loadingEl.style.display = "flex";

  try {
    const listData = await tkTaiDanhSachLIST();
    if (!listData || listData.length === 0) {
      tkBaoLoi("Không thể tải dữ liệu danh sách sản phẩm. Vui lòng kiểm tra kết nối mạng.");
      return;
    }

    const ungVien = tkLocDanhSach(listData, query, 30);
    if (ungVien.length === 0) {
      tkBaoLoi('Không tìm thấy sản phẩm nào khớp với "' + query + '".');
      return;
    }
    tkGhiNhanTanSuat(ungVien[0].ten);

    const dateVal = document.getElementById("tk-ngay") ? document.getElementById("tk-ngay").value : "";
    const dateStr = dateVal || new Date().toISOString().split("T")[0];

    const tenTheoMsp = {};
    const msps = [];
    ungVien.forEach(v => {
      if (!(v.msp in tenTheoMsp)) { tenTheoMsp[v.msp] = v.ten; msps.push(v.msp); }
    });

    const res = await fetch(API_TONKHO, {
      method: "POST",
      body: JSON.stringify({ action: "layTonKhoCX5", payload: { dateStr, msps } }),
      redirect: "follow"
    }).then(async r => {
      const text = await r.text();
      try { return JSON.parse(text); } catch (e) { return { error: "Máy chủ phản hồi chậm hoặc gián đoạn (Timeout)" }; }
    });

    if (!res || res.error) {
      tkBaoLoi((res && res.error) || "Không tra được tồn kho.");
      return;
    }
    if (!res.list || res.list.length === 0) {
      tkBaoLoi('Không tìm thấy tồn kho cho "' + query + '" trong sheet tháng này.');
      return;
    }

    const ketQua = res.list.map(k => ({ ...k, ten: tenTheoMsp[k.msp] || k.msp }));
    tkHienKetQua(ketQua);
  } catch (err) {
    tkBaoLoi(err.message || "Lỗi không xác định.");
  } finally {
    if (loadingEl) loadingEl.style.display = "none";
  }
}

let tkKetQuaTimKiemHienTai = [];

function xuatExcelTonKho() {
  if (!tkKetQuaTimKiemHienTai || tkKetQuaTimKiemHienTai.length === 0) {
    if (typeof showCanhBao === "function") showCanhBao("Chưa có kết quả tra cứu tồn kho để xuất Excel!", "warning");
    return;
  }
  const dateVal = document.getElementById("tk-ngay") ? document.getElementById("tk-ngay").value : "";
  const dateStr = dateVal || new Date().toISOString().split("T")[0];
  const exportData = tkKetQuaTimKiemHienTai.map((item, idx) => ({
    "STT": idx + 1,
    "Ngày tra cứu": dateStr,
    "Tên sản phẩm": item.ten,
    "Mã MSP": item.msp,
    "Khu vực kho": item.kho === "FOR" ? "Kho FOR" : "Kho Thường",
    "Bao đầu": item.baoDau,
    "Kg đầu": item.kgDau,
    "Bao cuối": item.baoCuoi,
    "Kg cuối": item.kgCuoi
  }));
  if (typeof exportToExcel === "function") {
    exportToExcel("TonKho_" + dateStr, "Tồn Kho " + dateStr, exportData);
  }
}
window.xuatExcelTonKho = xuatExcelTonKho;

function tkHienKetQua(ketQua) {
  tkKetQuaTimKiemHienTai = ketQua;
  const el = document.getElementById("tk-ket-qua");
  if (!el) return;

  const btnHtml = `
    <div style="margin-top:14px; margin-bottom:10px;">
      <button class="btn btn-excel btn-full" onclick="xuatExcelTonKho()">
        <i class="ti ti-file-spreadsheet"></i> Xuất File Excel Kết Quả
      </button>
    </div>
  `;

  const cardsHtml = ketQua.map(k => {
    const isFor = k.kho === "FOR";
    return `
      <div class="tk-card">
        <div class="tk-card-header">
          <div>
            <div class="tk-card-ten">${String(k.ten).replace(/</g, "&lt;")}</div>
            <div class="tk-card-msp">MSP: <span>${k.msp}</span></div>
          </div>
          <div class="tk-badge ${isFor ? "tk-badge-for" : "tk-badge-thuong"}">${isFor ? "FOR" : "Thường"}</div>
        </div>

        <div class="tk-stat-grid" style="grid-template-columns: 1fr 1fr;">
          <div class="tk-stat-box">
            <div class="tk-stat-label">TỒN ĐẦU</div>
            <div class="tk-stat-val">${k.baoDau} <small>bao</small></div>
            <div class="tk-stat-val" style="font-size:14px">${k.kgDau} <small>kg</small></div>
          </div>
          <div class="tk-stat-box highlight">
            <div class="tk-stat-label">TỒN CUỐI</div>
            <div class="tk-stat-val main-ton">${k.baoCuoi} <small>bao</small></div>
            <div class="tk-stat-val" style="font-size:14px">${k.kgCuoi} <small>kg</small></div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  el.innerHTML = btnHtml + cardsHtml;
}

function tkDongDropdown() {
  tkFilteredList = [];
  tkActiveIndex = -1;
  const el = document.getElementById("tk-dropdown");
  if (!el) return;
  el.classList.remove("show");
  el.innerHTML = "";
}

function tkRenderDropdown() {
  const el = document.getElementById("tk-dropdown");
  if (!el) return;
  if (tkFilteredList.length === 0) {
    el.classList.remove("show");
    el.innerHTML = "";
    return;
  }

  el.innerHTML = tkFilteredList.map((item, idx) =>
    '<div class="tk-dropdown-item' + (idx === tkActiveIndex ? ' active' : '') + '" data-idx="' + idx + '">' +
    String(item.ten).replace(/</g, "&lt;") + '</div>'
  ).join("");
  el.classList.add("show");

  Array.from(el.children).forEach(child => {
    child.addEventListener("mousedown", e => {
      e.preventDefault();
      const idx = parseInt(child.getAttribute("data-idx"), 10);
      if (tkFilteredList[idx]) {
        tkChonGoiY(tkFilteredList[idx]);
      }
    });
  });
}

async function tkOnInputTen() {
  const input = document.getElementById("tk-ten");
  if (!input) return;
  const query = input.value.trim();
  tkCapNhatNutXoa();
  if (!query) { tkDongDropdown(); return; }

  if (!tkListCache) {
    const el = document.getElementById("tk-dropdown");
    if (el) {
      el.innerHTML = '<div class="tk-dropdown-loading">Đang tải danh sách sản phẩm...</div>';
      el.classList.add("show");
    }
  }

  const list = await tkTaiDanhSachLIST();
  if (!list) { tkDongDropdown(); return; }

  if (document.getElementById("tk-ten").value.trim() !== query) return;

  tkFilteredList = tkLocDanhSach(list, query, 30);
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

function tkCapNhatNutXoa() {
  const input = document.getElementById("tk-ten");
  const btn = document.getElementById("tk-clear-btn");
  if (!input || !btn) return;
  btn.classList.toggle("show", input.value.length > 0);
}

function tkXoaOTen() {
  const input = document.getElementById("tk-ten");
  if (!input) return;
  input.value = "";
  tkCapNhatNutXoa();
  tkDongDropdown();
  input.focus();
}

function tkChonGoiY(item) {
  const input = document.getElementById("tk-ten");
  if (!input) return;
  input.value = item.ten;
  tkGhiNhanTanSuat(item.ten);
  tkCapNhatNutXoa();
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
  tkTaiDanhSachLIST(true);
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

window.tkXoaOTen = tkXoaOTen;
window.tkOnInputTen = tkOnInputTen;
window.tkOnKeydownTen = tkOnKeydownTen;
window.tkDoiNgay = tkDoiNgay;
window.tkMoTonKho = tkMoTonKho;
window.tkTimTonKho = tkTimTonKho;
