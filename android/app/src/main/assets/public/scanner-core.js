// ── Module Core Dùng Chung Cho Các Trình Quét (QR, CX1, BTP, CX5) ────────────
// Bao gồm:
// 1. HistoryDB (IndexedDB + RAM Cache 0ms + Tự động di trú từ localStorage 5MB)
// 2. SwipeController (Vuốt xóa Swipe-to-Delete dùng chung cho Live Log & Bảng KQ)
// 3. ScanDeduplicator (Thuật toán chống nháy mã 1.5s / 500ms & tự dọn rác bộ nhớ)
// 4. OfflineQueue (Quản lý hàng đợi Offline an toàn chống mất/trùng dữ liệu)
// 5. Shared UI / Clipboard Helpers (Sao chép mã QR, hiệu ứng viền flash camera)

(function (window) {
  "use strict";

  const DB_NAME = "QuanLyKho_HistoryDB";
  const DB_VERSION = 1;
  const STORE_NAME = "history_sessions";
  const HISTORY_KEYS = ["quetqr_lichsu", "cx1_lich_su", "btp_lich_su", "cx5_lich_su"];

  // Bộ nhớ đệm đồng bộ trên RAM giúp các hàm docLichSu*() đọc 0ms không cần đổi sang async
  const _memCache = new Map();
  let _dbInstance = null;
  let _dbInitPromise = null;

  // 1. Nạp trước dữ liệu hiện có từ localStorage vào RAM ngay khi nạp script (0ms)
  function _seedMemCacheFromLocalStorage() {
    for (const key of HISTORY_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            _memCache.set(key, parsed);
          }
        }
      } catch (e) { }
      if (!_memCache.has(key)) {
        _memCache.set(key, []);
      }
    }
  }
  _seedMemCacheFromLocalStorage();

  // Mở kết nối IndexedDB
  function _openDB() {
    if (_dbInstance) return Promise.resolve(_dbInstance);
    if (_dbInitPromise) return _dbInitPromise;

    _dbInitPromise = new Promise((resolve) => {
      if (typeof indexedDB === "undefined") {
        resolve(null);
        return;
      }
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function (ev) {
          const db = ev.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "storeKey" });
          }
        };
        req.onsuccess = function (ev) {
          _dbInstance = ev.target.result;
          resolve(_dbInstance);
        };
        req.onerror = function () {
          resolve(null);
        };
      } catch (e) {
        resolve(null);
      }
    });
    return _dbInitPromise;
  }

  // Hòa trộn danh sách lịch sử từ localStorage và IndexedDB theo idPhien (ưu tiên bản mới hơn)
  function _mergeHistoryLists(localList, idbList) {
    const a = Array.isArray(localList) ? localList : [];
    const b = Array.isArray(idbList) ? idbList : [];
    if (a.length === 0) return b;
    if (b.length === 0) return a;

    const map = new Map();
    for (const item of b) {
      if (!item) continue;
      const id = item.idPhien || item.id || JSON.stringify(item);
      map.set(id, item);
    }
    for (const item of a) {
      if (!item) continue;
      const id = item.idPhien || item.id || JSON.stringify(item);
      if (!map.has(id)) {
        map.set(id, item);
      } else {
        const existing = map.get(id);
        const tNew = new Date(item.capNhatLuc || item.thoiGian || 0).getTime() || 0;
        const tOld = new Date(existing.capNhatLuc || existing.thoiGian || 0).getTime() || 0;
        if (tNew >= tOld) {
          map.set(id, item);
        }
      }
    }
    return Array.from(map.values());
  }

  // Ghi danh sách lịch sử của 1 module xuống IndexedDB (bất đồng bộ ngầm)
  async function _persistToIDB(storeKey, list) {
    const db = await _openDB();
    if (!db) {
      // Fallback sang localStorage nếu trình duyệt không hỗ trợ IndexedDB
      try {
        localStorage.setItem(storeKey, JSON.stringify(list));
      } catch (e) { }
      return false;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_NAME], "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put({
          storeKey: storeKey,
          updatedAt: new Date().toISOString(),
          sessions: Array.isArray(list) ? list : []
        });
        tx.oncomplete = function () {
          // Sau khi đã lưu an toàn vào IndexedDB, giải phóng bản ghi nặng trên localStorage
          // để chống tràn bộ nhớ 5MB cho các phiên dở dang và hàng đợi pending
          try {
            if (localStorage.getItem(storeKey) !== null) {
              localStorage.removeItem(storeKey);
            }
          } catch (e) { }
          resolve(true);
        };
        tx.onerror = function () {
          resolve(false);
        };
      } catch (e) {
        resolve(false);
      }
    });
  }

  // Khởi tạo & tự động di trú dữ liệu lịch sử từ localStorage sang IndexedDB
  async function initHistoryDB() {
    const db = await _openDB();
    if (!db) return;

    try {
      const tx = db.transaction([STORE_NAME], "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = async function () {
        const rows = req.result || [];
        const idbMap = new Map();
        for (const r of rows) {
          if (r && r.storeKey && Array.isArray(r.sessions)) {
            idbMap.set(r.storeKey, r.sessions);
          }
        }

        let hasChanges = false;
        for (const key of HISTORY_KEYS) {
          const localArr = _memCache.get(key) || [];
          const idbArr = idbMap.get(key) || [];
          const merged = _mergeHistoryLists(localArr, idbArr);
          _memCache.set(key, merged);

          if (localArr.length > 0 || !idbMap.has(key)) {
            await _persistToIDB(key, merged);
            hasChanges = true;
          } else if (idbArr.length > 0) {
            hasChanges = true;
          }
        }

        if (hasChanges) {
          try { if (typeof window.renderLichSuQR === "function") window.renderLichSuQR(); } catch (e) { }
          try { if (typeof window.renderLichSuCX1 === "function") window.renderLichSuCX1(); } catch (e) { }
          try { if (typeof window.renderLichSuBTP === "function") window.renderLichSuBTP(); } catch (e) { }
          try { if (typeof window.renderLichSuCX5 === "function") window.renderLichSuCX5(); } catch (e) { }
          try { if (typeof window.capNhatTrangChu === "function") window.capNhatTrangChu(); } catch (e) { }
        }
      };
    } catch (e) { }
  }

  // Khởi chạy di trú ngay khi tải module
  initHistoryDB();

  // ── 1. API Lịch sử (Đọc 0ms từ RAM Cache + Ghi bất đồng bộ xuống IndexedDB) ──
  function docLichSu(storeKey, filterFn) {
    let list = _memCache.get(storeKey);
    if (!Array.isArray(list)) {
      try {
        list = JSON.parse(localStorage.getItem(storeKey) || "[]");
        if (!Array.isArray(list)) list = [];
      } catch (e) {
        list = [];
      }
      _memCache.set(storeKey, list);
    }
    if (typeof filterFn === "function") {
      return list.filter(filterFn);
    }
    return list.slice();
  }

  function luuLichSu(storeKey, list, onQuotaError) {
    const cleanList = Array.isArray(list) ? list : [];
    _memCache.set(storeKey, cleanList);
    _persistToIDB(storeKey, cleanList).then((ok) => {
      if (!ok) {
        try {
          localStorage.setItem(storeKey, JSON.stringify(cleanList));
        } catch (e) {
          const isQuota = e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22);
          if (isQuota && typeof onQuotaError === "function") {
            onQuotaError(e);
          }
        }
      }
    });
  }

  function xoaLichSu(storeKey) {
    _memCache.set(storeKey, []);
    try { localStorage.removeItem(storeKey); } catch (e) { }
    _persistToIDB(storeKey, []);
  }

  // Phục vụ tính năng Sao lưu & Phục hồi toàn bộ dữ liệu trong app.js
  function exportHistoryForBackup() {
    const out = {};
    for (const key of HISTORY_KEYS) {
      const list = _memCache.get(key);
      if (Array.isArray(list) && list.length > 0) {
        out[key] = JSON.stringify(list);
      }
    }
    return out;
  }

  function importHistoryFromBackup(storeKey, rawOrArray) {
    if (!HISTORY_KEYS.includes(storeKey)) return false;
    try {
      const incoming = typeof rawOrArray === "string" ? JSON.parse(rawOrArray) : rawOrArray;
      if (!Array.isArray(incoming)) return false;
      const existing = _memCache.get(storeKey) || [];
      const merged = _mergeHistoryLists(incoming, existing);
      luuLichSu(storeKey, merged);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ── 2. API Vuốt Xóa (Swipe-to-Delete) Dùng Chung ────────────────────────────
  function khoiTaoSwipe(containerOrId, contentSelector = ".btp-swipe-content", initFlag = "__swipeCoreInit") {
    const container = typeof containerOrId === "string" ? document.getElementById(containerOrId) : containerOrId;
    if (!container || container[initFlag]) return;
    container[initFlag] = true;

    let touchState = null;

    container.addEventListener("touchstart", (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      const content = e.target.closest(contentSelector);
      if (!content) return;

      const allSwiped = container.querySelectorAll(contentSelector + ".swiped");
      allSwiped.forEach(el => {
        if (el !== content) {
          el.style.transform = "translateX(0px)";
          el.classList.remove("swiped");
        }
      });

      const isAlreadySwiped = content.classList.contains("swiped");
      touchState = {
        content: content,
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        isSwiping: false,
        isAlreadySwiped: isAlreadySwiped
      };
    }, { passive: true });

    container.addEventListener("touchmove", (e) => {
      if (!touchState) return;
      const touch = e.touches[0];
      if (!touch) return;
      touchState.currentX = touch.clientX;
      const dx = touch.clientX - touchState.startX;
      const dy = touch.clientY - touchState.startY;

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        touchState.isSwiping = true;
        let offset = touchState.isAlreadySwiped ? (-76 + dx) : dx;
        if (offset > 0) offset = 0;
        if (offset < -85) offset = -85;
        touchState.content.style.transition = "none";
        touchState.content.style.transform = `translateX(${offset}px)`;
      }
    }, { passive: true });

    const finishSwipe = (e) => {
      if (!touchState) return;
      const content = touchState.content;
      const endX = (e && e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : touchState.currentX;
      const dx = endX - touchState.startX;

      content.style.transition = "transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1)";
      if (touchState.isSwiping) {
        if (dx < -35) {
          content.style.transform = "translateX(-76px)";
          content.classList.add("swiped");
        } else {
          content.style.transform = "translateX(0px)";
          content.classList.remove("swiped");
        }
      } else if (touchState.isAlreadySwiped) {
        content.style.transform = "translateX(0px)";
        content.classList.remove("swiped");
      }
      touchState = null;
    };

    container.addEventListener("touchend", finishSwipe);
    container.addEventListener("touchcancel", () => {
      if (touchState) {
        touchState.content.style.transform = touchState.isAlreadySwiped ? "translateX(-76px)" : "translateX(0px)";
        touchState = null;
      }
    });
  }

  // ── 3. API Chống Nháy Mã (Anti-Bounce 1.5s / 500ms Per-QR Deduplicator) ────
  function kiemTraKhoaMa(mapKhoa, rawKey, choPhepTrung = false) {
    if (!mapKhoa) return false;
    const key = String(rawKey || "").toLowerCase();
    const lockMs = choPhepTrung ? 1500 : 500;
    const now = Date.now();

    if (mapKhoa.has(key) && (now - mapKhoa.get(key)) < lockMs) {
      return true; // Đang bị khóa, bỏ qua frame này
    }
    mapKhoa.set(key, now);

    // Tự động dọn dẹp bộ nhớ khi vượt 200 mã
    if (mapKhoa.size > 200) {
      const expireBefore = now - 5000;
      for (const [k, t] of mapKhoa.entries()) {
        if (t < expireBefore) mapKhoa.delete(k);
      }
    }
    return false;
  }

  function khoaCanhBaoTrung(mapKhoa, rawKey, extraMs = 1500) {
    if (!mapKhoa) return;
    const key = String(rawKey || "").toLowerCase();
    mapKhoa.set(key, Date.now() + extraMs);
  }

  // ── 4. API Hàng Đợi Offline (Pending Queue Manager) ─────────────────────────
  function docPending(storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function luuPending(storageKey, list, onQuotaError) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.isArray(list) ? list : []));
      return true;
    } catch (e) {
      const isQuota = e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22);
      if (isQuota && typeof onQuotaError === "function") {
        onQuotaError(e);
      }
      return false;
    }
  }

  // ── 5. Tiện ích UI dùng chung (Viền Flash Camera & Sao chép mã QR) ──────────
  function hienVienFeedback(overlayId, videoBoxId, loai) {
    const overlay = document.getElementById(overlayId);
    if (overlay) {
      overlay.classList.remove("flash-success", "flash-duplicate");
      void overlay.offsetWidth;
      if (loai === "success") {
        overlay.classList.add("flash-success");
        setTimeout(() => overlay.classList.remove("flash-success"), 300);
      } else {
        overlay.classList.add("flash-duplicate");
        setTimeout(() => overlay.classList.remove("flash-duplicate"), 450);
      }
    }
    if (videoBoxId && typeof window.hienVienFeedbackCamera === "function") {
      try { window.hienVienFeedbackCamera(videoBoxId, loai); } catch (e) { }
    }
  }

  async function saoChepMaQR(textToCopy, iconId, btnId, notifyFn) {
    const cleanText = String(textToCopy || "").trim();
    if (!cleanText || cleanText === "Chờ quét...") {
      if (typeof notifyFn === "function") notifyFn("Chưa có mã QR nào để sao chép!", "warning");
      return false;
    }

    let copyOk = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(cleanText);
        copyOk = true;
      } catch (e) { }
    }
    if (!copyOk) {
      try {
        const ta = document.createElement("textarea");
        ta.value = cleanText;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        copyOk = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (e) { }
    }

    if (copyOk) {
      const btnEl = btnId ? document.getElementById(btnId) : null;
      const iconEl = iconId ? document.getElementById(iconId) : null;
      if (btnEl) btnEl.classList.add("copied");
      if (iconEl) {
        iconEl.classList.remove("ti-copy");
        iconEl.classList.add("ti-check");
        iconEl.style.color = "var(--success)";
      }
      if (typeof notifyFn === "function") notifyFn("Đã sao chép: " + cleanText, "success");
      setTimeout(() => {
        if (btnEl) btnEl.classList.remove("copied");
        if (iconEl) {
          iconEl.classList.remove("ti-check");
          iconEl.classList.add("ti-copy");
          iconEl.style.color = "";
        }
      }, 1500);
    } else if (typeof notifyFn === "function") {
      notifyFn("Lỗi sao chép mã QR", "error");
    }
    return copyOk;
  }

  window.ScannerCore = {
    HISTORY_KEYS,
    initHistoryDB,
    docLichSu,
    luuLichSu,
    xoaLichSu,
    exportHistoryForBackup,
    importHistoryFromBackup,
    khoiTaoSwipe,
    kiemTraKhoaMa,
    khoaCanhBaoTrung,
    docPending,
    luuPending,
    hienVienFeedback,
    saoChepMaQR
  };
})(window);
