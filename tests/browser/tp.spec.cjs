const { test, expect } = require('@playwright/test');
const raw = (id = '000ABC', kg = '56.4') => `${id}\n21B3021A017\n1\nLuoi cao\n021/78 x 35mm x 300MD x 14M (Bac ) ${kg}`;
async function setup(page) {
  await page.route('https://**', route => route.abort());
  await page.goto('/');
  await page.waitForFunction(() => window.ScannerCore?.isLoaded() && window.flushTP);
  await page.evaluate(() => {
    window.moXacNhanApp = (_msg, ok) => ok();
    window.khoiTaoCameraFast = async () => ({ reset() {} });
    window.phatTiengBip = () => {};
    window.chuyenTrangKhongNav('tpPage');
  });
  await page.locator('#tp-new').click();
  await expect(page.locator('#tp-status')).toHaveText('Đang quét');
}
async function scan(page, value) { await page.evaluate(value => window.khiQuetDuocMaTP(value), value); }
async function draft(page) { return page.evaluate(() => { window.flushTP(); return JSON.parse(localStorage.getItem('tp_phien_dodang')); }); }
test('scan, duplicate, deletion, restore and bounded live log', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await setup(page); await scan(page, raw()); await scan(page, raw());
  expect((await draft(page)).items).toHaveLength(1);
  await page.locator('#tp-log-list summary').click();
  await page.locator('#tp-log-list .tp-sub-item button').click();
  expect((await draft(page)).items).toHaveLength(0);
  await scan(page, raw());
  await page.evaluate(values => { values.forEach(window.khiQuetDuocMaTP); window.flushTP(); }, Array.from({ length: 45 }, (_, i) => raw('ID_' + i, '0.1')));
  await expect(page.locator('#tp-log-list .tp-sub-item')).toHaveCount(30);
  expect((await draft(page)).items).toHaveLength(46);
  await page.evaluate(() => window.luuTPTruocRoiApp());
  await page.reload(); await page.waitForFunction(() => window.flushTP && window.ScannerCore.isLoaded());
  expect((await draft(page)).items).toHaveLength(46);
  expect(errors).toEqual([]);
});
test('export is revision-aware; failed exports do not mark exported', async ({ page }) => {
  await setup(page); await scan(page, raw());
  await page.evaluate(() => { window.exportToExcel = () => new Promise(resolve => { window.resolveExport = resolve; }); });
  await page.locator('#tp-results').click(); await page.locator('#tp-export').click();
  await page.waitForFunction(() => window.resolveExport);
  await page.locator('#tp-continue').click(); await scan(page, raw('NEXT'));
  await page.evaluate(() => window.resolveExport({ ok: true }));
  await expect(page.locator('#tp-export-state')).toHaveText('Chưa xuất Excel');
  expect((await draft(page)).daXuatExcel).toBe(false);
  await page.evaluate(() => { window.exportToExcel = async () => ({ ok: false }); });
  await page.locator('#tp-results').click(); await page.locator('#tp-export').click();
  expect((await draft(page)).daXuatExcel).toBe(false);
  await page.evaluate(() => { window.exportToExcel = async () => ({ ok: true }); });
  await page.locator('#tp-export').click();
  await expect(page.locator('#tp-export-state')).toHaveText('Đã xuất Excel');
});
test('history resume preserves ID and deletion does not resurrect from timers', async ({ page }) => {
  await setup(page); await scan(page, raw()); const first = await draft(page);
  await page.locator('#tp-new').click();
  await page.waitForFunction(id => { const s = JSON.parse(localStorage.getItem('tp_phien_dodang')); return s && s.idPhien !== id && window.dangQuetTP && document.getElementById('tp-status').textContent === 'Đang quét'; }, first.idPhien);
  await scan(page, raw('OTHER'));
  await page.evaluate(() => window.moLichSuChon('tp'));
  await page.evaluate(id => window.tiepTucTuLichSuTP(id), first.idPhien);
  expect((await draft(page)).idPhien).toBe(first.idPhien);
  await scan(page, raw()); expect((await draft(page)).items).toHaveLength(1);
  await page.evaluate(() => window.moLichSuChon('tp'));
  await page.locator('#tp-delete-all').click();
  await expect(page.locator('#lichsu-tp-list')).toContainText('Không có phiên');
  await page.evaluate(() => window.luuTPTruocRoiApp());
  expect(await page.evaluate(() => localStorage.getItem('tp_phien_dodang'))).toBeNull();
  await page.reload(); await page.waitForFunction(() => window.ScannerCore?.isLoaded());
  expect(await page.evaluate(() => ScannerCore.docLichSu('tp_lich_su'))).toEqual([]);
});
test('actual SheetJS export contains two columns and original multiline QR', async ({ page }) => {
  await setup(page); await scan(page, raw()); await page.locator('#tp-results').click();
  const downloadPromise = page.waitForEvent('download'); await page.locator('#tp-export').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^Quet_TP_\d{8}_\d{6}\.xlsx$/);
  const XLSX = require('../../lib/xlsx.full.min.js');
  const workbook = XLSX.read(require('node:fs').readFileSync(await download.path()), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  expect(Object.keys(rows[0])).toEqual(['Thời gian', 'Mã QR Gốc']); expect(rows[0]['Mã QR Gốc']).toBe(raw());
});

test('quota failure still permits exporting RAM data', async ({ page }) => {
  await setup(page); await scan(page, raw()); await page.locator('#tp-results').click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.restoreStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (key, value) { if (key.startsWith('tp_')) throw new DOMException('Full', 'QuotaExceededError'); return original.call(this, key, value); };
  });
  const downloading = page.waitForEvent('download'); await page.locator('#tp-export').click();
  expect((await downloading).suggestedFilename()).toContain('Quet_TP_');
  await page.evaluate(() => window.restoreStorage());
});

test('backup preparation drains old writes before importing newer session', async ({ page }) => {
  await setup(page); await scan(page, raw());
  const result = await page.evaluate(async value => {
    window.khiQuetDuocMaTP(value);
    const state = JSON.parse(localStorage.getItem('tp_phien_dodang') || 'null');
    await window.chuanBiPhucHoiTP();
    const draft = JSON.parse(localStorage.getItem('tp_phien_dodang'));
    const imported = { ...draft, revision: 100, daXuatExcel: true, capNhatLuc: new Date().toISOString(), danhSach: draft.items };
    delete imported.items;
    ScannerCore.importHistoryFromBackup('tp_lich_su', [imported]);
    await ScannerCore.whenIdle();
    window.flushTP();
    const revision = ScannerCore.docLichSu('tp_lich_su').find(r => r.idPhien === draft.idPhien).revision;
    window.huyPhucHoiTP();
    return revision;
  }, raw('SECOND'));
  expect(result).toBe(100);
});

test('native save failure returns failure without web fallback', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => new Promise(resolve => napThuVienXLSX(resolve)));
  const result = await page.evaluate(async () => {
    window.AndroidNative = { saveFileToDownload: () => 'ERROR: full' };
    window.XLSX.writeFile = () => { throw new Error('Unexpected web fallback'); };
    return exportToExcel('failure', 'TP', [{ A: 'test' }]);
  });
  expect(result.ok).toBe(false); expect(result.error).toContain('ERROR: full');
});

test('real camera core discards a stream returned after leaving page', async ({ page }) => {
  await page.route('https://**', route => route.abort()); await page.goto('/');
  await page.waitForFunction(() => window.flushTP && ScannerCore.isLoaded());
  const stopped = await page.evaluate(async () => {
    chuyenTrangKhongNav('tpPage'); window.dangQuetTP = true;
    let resolveStream, stops = 0;
    moLuongCameraDungHuong = () => new Promise(resolve => { resolveStream = resolve; });
    const opening = khoiTaoCameraFast('tp-reader', () => {});
    chuyenTrangKhongNav('trangChu');
    resolveStream({ getTracks: () => [{ stop() { stops++; } }] });
    const reader = await opening;
    return { stops, reader };
  });
  expect(stopped.stops).toBe(1); expect(stopped.reader).toBeNull();
});

test('PWA precaches TP and starts offline after reload', async ({ page, context }) => {
  await page.route('https://**', route => route.abort());
  await page.goto('/'); await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await page.waitForFunction(() => window.flushTP && ScannerCore.isLoaded());
  await context.setOffline(true); await page.reload();
  await page.waitForFunction(() => window.flushTP && ScannerCore.isLoaded());
  await page.evaluate(() => chuyenTrangKhongNav('tpPage'));
  await expect(page.locator('#tp-new')).toBeVisible();
});

test('cold boot waits for newer DB revision before resuming an older draft', async ({ page }) => {
  await setup(page); await scan(page, raw('OLD'));
  await page.evaluate(async nextRaw => {
    await luuTPTruocRoiApp();
    const draft = JSON.parse(localStorage.getItem('tp_phien_dodang'));
    const newer = { ...draft, revision: 10, danhSach: [...draft.items, { ...xuLyDuLieuQRTP(nextRaw), thoiGian: '2026-11-20 10:00:00' }] };
    delete newer.items;
    await ScannerCore.luuLichSu('tp_lich_su', [newer]);
    await chuanBiPhucHoiTP();
    await ScannerCore.luuLichSu('tp_lich_su', [newer]);
    localStorage.setItem('tp_phien_dodang', JSON.stringify(draft));
  }, raw('NEWER'));
  await page.addInitScript(() => {
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      const tx = transaction.apply(this, args);
      const objectStore = tx.objectStore.bind(tx);
      tx.objectStore = name => {
        const store = objectStore(name);
        if (name === 'history_sessions') {
          const getAll = store.getAll.bind(store);
          store.getAll = (...args) => {
            const request = getAll(...args), proxy = {};
            request.onsuccess = () => setTimeout(() => { proxy.result = request.result; proxy.onsuccess?.(); }, 500);
            request.onerror = () => { proxy.error = request.error; proxy.onerror?.(); };
            return proxy;
          };
        }
        return store;
      };
      return tx;
    };
  });
  await page.reload();
  await page.waitForFunction(() => window.flushTP);
  await page.evaluate(() => { khoiTaoCameraFast = async () => ({ reset() {} }); chuyenTrangKhongNav('tpPage'); });
  await page.locator('#tp-continue').click();
  await expect(page.locator('#tp-status')).toHaveText('Đang quét');
  await scan(page, raw('AFTER'));
  const state = await draft(page);
  expect(state.revision).toBe(11); expect(state.items.map(i => i.id)).toEqual(['OLD', 'NEWER', 'AFTER']);
});

test('Stop during recovery delay does not reopen the camera', async ({ page }) => {
  await page.route('https://**', route => route.abort()); await page.goto('/');
  await page.waitForFunction(() => window.flushTP && ScannerCore.isLoaded());
  const result = await page.evaluate(async () => {
    chuyenTrangKhongNav('tpPage'); window.dangQuetTP = true;
    const canvas = document.createElement('canvas');
    document.getElementById('tp-reader').srcObject = canvas.captureStream();
    let starts = 0;
    moLuongCameraDungHuong = async () => { starts++; return null; };
    const recovery = khoiPhucCamera('tp-reader', () => {});
    dungTP();
    await recovery;
    return starts;
  });
  expect(result).toBe(0);
});

test('legacy CX1 start reads lexical running state after Home has paused window state', async ({ page }) => {
  await page.route('https://**', route => route.abort()); await page.goto('/');
  await page.waitForFunction(() => window.flushTP && ScannerCore.isLoaded());
  const starts = await page.evaluate(async () => {
    chuyenTrangKhongNav('trangChu');
    chuyenTrangKhongNav('chiFor');
    let starts = 0;
    moLuongCameraDungHuong = async () => { starts++; throw new Error('Test camera unavailable'); };
    await tiepTucKhoiTaoCX1();
    return starts;
  });
  expect(starts).toBe(1);
});

test('landscape TP leaves room for scan controls and live log', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await setup(page); await scan(page, raw());
  const sizes = await page.evaluate(() => {
    const rect = id => { const r = document.getElementById(id).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; };
    return { log: rect('tp-log-container'), toggle: rect('tp-toggle'), results: rect('tp-results'), width: document.body.scrollWidth };
  });
  expect(sizes.log.height).toBeGreaterThan(30); expect(sizes.toggle.bottom).toBeLessThan(390);
  expect(sizes.results.bottom).toBeLessThan(390); expect(sizes.width).toBeLessThanOrEqual(844);
});
