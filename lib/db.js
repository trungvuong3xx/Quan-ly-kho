// ── Module Cơ Sở Dữ Liệu Cục Bộ IndexedDB (QuanLyKhoDB) ───────────────
// Tầng lưu trữ mở rộng độc lập, không giới hạn 5MB, an toàn dữ liệu 100%

(function() {
  const DB_NAME = "QuanLyKhoDB";
  const DB_VERSION = 1;
  const STORE_SNAPSHOTS = "snapshots";
  const MAX_SNAPSHOTS = 5;

  let dbInstance = null;

  function moDatabase() {
    return new Promise((resolve, reject) => {
      if (dbInstance) return resolve(dbInstance);
      if (!window.indexedDB) {
        console.warn("[IndexedDB] Trình duyệt không hỗ trợ IndexedDB.");
        return resolve(null);
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function(e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          const store = db.createObjectStore(STORE_SNAPSHOTS, { keyPath: "id" });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };

      request.onsuccess = function(e) {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };

      request.onerror = function(e) {
        console.error("[IndexedDB] Lỗi mở Database:", e.target.error);
        resolve(null);
      };
    });
  }

  // ── Lưu một bản Snapshot tự động (Xoay vòng tối đa 5 bản) ───────────
  async function idbLuuSnapshot(snapshotData) {
    try {
      const db = await moDatabase();
      if (!db) return false;

      const now = Date.now();
      const d = new Date(now);
      const pad = n => String(n).padStart(2, '0');
      const thoiGianHienThi = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

      const id = "snapshot_" + now;
      const record = {
        id: id,
        timestamp: now,
        thoiGianHienThi: thoiGianHienThi,
        soLuongMuc: snapshotData.soLuongMuc || 0,
        moTa: snapshotData.moTa || "Tự động sao lưu",
        duLieu: snapshotData.duLieu || {}
      };

      await new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_SNAPSHOTS], "readwrite");
        const store = tx.objectStore(STORE_SNAPSHOTS);
        store.put(record);
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e.target.error);
      });

      await idbDonDepSnapshots();
      return true;
    } catch (err) {
      console.error("[IndexedDB] Lỗi lưu snapshot:", err);
      if (typeof hopDenGhiLog === "function") {
        hopDenGhiLog("IDB_SAVE_ERR", "Lỗi ghi snapshot IndexedDB: " + err.message);
      }
      return false;
    }
  }

  // ── Dọn dẹp chỉ giữ lại MAX_SNAPSHOTS bản mới nhất ───────────────────
  async function idbDonDepSnapshots() {
    try {
      const db = await moDatabase();
      if (!db) return;

      const tx = db.transaction([STORE_SNAPSHOTS], "readwrite");
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const index = store.index("timestamp");

      const records = [];
      const req = index.openCursor(null, "next"); // Cũ nhất trước

      req.onsuccess = function(e) {
        const cursor = e.target.result;
        if (cursor) {
          records.push({ id: cursor.value.id, timestamp: cursor.value.timestamp });
          cursor.continue();
        } else {
          if (records.length > MAX_SNAPSHOTS) {
            const soLuongXoa = records.length - MAX_SNAPSHOTS;
            for (let i = 0; i < soLuongXoa; i++) {
              store.delete(records[i].id);
            }
          }
        }
      };
    } catch (err) {
      console.warn("[IndexedDB] Lỗi dọn dẹp snapshots:", err);
    }
  }

  // ── Đọc danh sách metadata các bản Snapshot để hiển thị UI ──────────
  async function idbDocDanhSachSnapshots() {
    try {
      const db = await moDatabase();
      if (!db) return [];

      return await new Promise((resolve) => {
        const tx = db.transaction([STORE_SNAPSHOTS], "readonly");
        const store = tx.objectStore(STORE_SNAPSHOTS);
        const index = store.index("timestamp");
        const list = [];

        const req = index.openCursor(null, "prev"); // Mới nhất trước
        req.onsuccess = function(e) {
          const cursor = e.target.result;
          if (cursor) {
            list.push({
              id: cursor.value.id,
              timestamp: cursor.value.timestamp,
              thoiGianHienThi: cursor.value.thoiGianHienThi,
              soLuongMuc: cursor.value.soLuongMuc,
              moTa: cursor.value.moTa
            });
            cursor.continue();
          } else {
            resolve(list);
          }
        };
        req.onerror = () => resolve([]);
      });
    } catch (err) {
      console.error("[IndexedDB] Lỗi đọc danh sách snapshots:", err);
      return [];
    }
  }

  // ── Đọc đầy đủ dữ liệu của 1 bản Snapshot để khôi phục ──────────────
  async function idbDocSnapshot(id) {
    try {
      const db = await moDatabase();
      if (!db) return null;

      return await new Promise((resolve) => {
        const tx = db.transaction([STORE_SNAPSHOTS], "readonly");
        const store = tx.objectStore(STORE_SNAPSHOTS);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (err) {
      console.error("[IndexedDB] Lỗi đọc snapshot chi tiết:", err);
      return null;
    }
  }

  // ── Xóa 1 bản Snapshot theo ID ──────────────────────────────────────
  async function idbXoaSnapshot(id) {
    try {
      const db = await moDatabase();
      if (!db) return false;

      return await new Promise((resolve) => {
        const tx = db.transaction([STORE_SNAPSHOTS], "readwrite");
        const store = tx.objectStore(STORE_SNAPSHOTS);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch (err) {
      return false;
    }
  }

  // Xuất các hàm ra phạm vi toàn cục window
  window.idbLuuSnapshot = idbLuuSnapshot;
  window.idbDocDanhSachSnapshots = idbDocDanhSachSnapshots;
  window.idbDocSnapshot = idbDocSnapshot;
  window.idbXoaSnapshot = idbXoaSnapshot;
  window.idbDonDepSnapshots = idbDonDepSnapshots;
})();
