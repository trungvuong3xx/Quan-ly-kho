/* Thành phẩm: local sessions, exact decimal weights, revision-aware exports. */
(function (root) {
  'use strict';
  const HISTORY = 'tp_lich_su';
  const DRAFT = 'tp_phien_dodang';
  const clone = value => JSON.parse(JSON.stringify(value));
  function units(value) {
    const text = String(value).trim().replace(',', '.');
    if (!/^\d+(?:\.\d{1,4})?$/.test(text)) throw new Error('Khối lượng phải là số dương, tối đa 4 số lẻ.');
    const [whole, fraction = ''] = text.split('.');
    const n = BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
    if (n <= 0n || n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Khối lượng ngoài giới hạn an toàn.');
    const kg = Number(n) / 10000;
    // Persisted numeric kg must round-trip without losing a unit.
    if (!Number.isFinite(kg) || Math.round(kg * 10000) !== Number(n)) throw new Error('Khối lượng quá lớn để lưu chính xác.');
    return Number(n);
  }
  function parseKgTP(value) { return units(value) / 10000; }
  function formatKgTP(value) {
    if (!Number.isFinite(value)) throw new Error('Khối lượng không hợp lệ.');
    return value.toFixed(4).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1').replace(/^(\d+)$/, '$1.0');
  }
  function localTime(date = new Date()) {
    return new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
  }
  function xuLyDuLieuQRTP(raw) {
    if (typeof raw !== 'string') throw new Error('Mã QR phải là văn bản.');
    const lines = raw.replace(/\r/g, '').split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length !== 5 || !/^\d+$/.test(lines[2])) throw new Error('Mã không đúng định dạng tem Thành Phẩm (5 dòng)!');
    const pcs = Number(lines[2]);
    const match = lines[4].match(/^(.+?)\s+(\d+(?:[.,]\d{1,4})?)\s*$/);
    if (!Number.isSafeInteger(pcs) || !match || !/x/i.test(match[1])) throw new Error('Mã không đúng định dạng tem Thành Phẩm (5 dòng)!');
    return { id: lines[0], maKien: lines[1], pcs, tenHang: lines[3], qcDu: match[1], kg: parseKgTP(match[2]), raw };
  }
  const groupKey = item => item.qcDu.replace(/\s+/g, ' ').trim().toLowerCase();
  function tinhThongKePhienTP(items) {
    if (!Array.isArray(items)) throw new Error('Danh sách TP không hợp lệ.');
    let total = 0;
    const groups = new Map();
    for (const item of items) {
      const weight = units(item.kg);
      if (!Number.isSafeInteger(total + weight)) throw new Error('Tổng khối lượng vượt giới hạn an toàn.');
      total += weight;
      const key = groupKey(item);
      if (!groups.has(key)) groups.set(key, { key, qcDu: item.qcDu, soBao: 0, sum: 0, items: [] });
      const group = groups.get(key);
      group.soBao++; group.sum += weight; group.items.push(item);
    }
    return { tongBao: items.length, tongKg: total / 10000, gomNhom: Array.from(groups.values(), g => ({
      key: g.key, qcDu: g.qcDu, soBao: g.soBao, tongKg: g.sum / 10000, items: g.items
    })) };
  }
  function validateSession(value) {
    if (!value || typeof value.idPhien !== 'string' || !value.idPhien || !Number.isSafeInteger(value.revision) || value.revision < 0 ||
        typeof value.daXuatExcel !== 'boolean' || !Number.isFinite(Date.parse(value.ngay)) || !Number.isFinite(Date.parse(value.capNhatLuc))) {
      throw new Error('Thông tin phiên TP không hợp lệ.');
    }
    const list = value.items || value.danhSach;
    if (!Array.isArray(list)) throw new Error('Phiên TP thiếu danh sách mã.');
    const seen = new Set();
    const items = list.map(item => {
      if (!item || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(item.thoiGian)) throw new Error('Thời gian mã TP không hợp lệ.');
      const parsed = xuLyDuLieuQRTP(item.raw);
      if (seen.has(parsed.id) || ['id', 'maKien', 'pcs', 'tenHang', 'qcDu', 'kg'].some(k => parsed[k] !== item[k])) throw new Error('Dữ liệu mã TP không khớp QR gốc hoặc bị trùng.');
      seen.add(parsed.id);
      return { ...parsed, thoiGian: item.thoiGian };
    });
    tinhThongKePhienTP(items);
    return { idPhien: value.idPhien, ngay: value.ngay, capNhatLuc: value.capNhatLuc,
      revision: value.revision, daXuatExcel: value.daXuatExcel, items };
  }
  function newer(a, b) {
    if (!b) return true;
    if (a.revision !== b.revision) return a.revision > b.revision;
    return Date.parse(a.capNhatLuc) > Date.parse(b.capNhatLuc);
  }
  function expired(record, activeId, now = Date.now()) {
    const time = Date.parse(record.capNhatLuc || record.ngay);
    return record.idPhien !== activeId && record.daXuatExcel === true && Number.isFinite(time) && now - time > 30 * 86400000;
  }
  const api = { units, parseKgTP, formatKgTP, xuLyDuLieuQRTP, tinhThongKePhienTP, validateSession, newer, expired };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (!root.document) return;
  Object.assign(root, { parseKgTP, formatKgTP, xuLyDuLieuQRTP, tinhThongKePhienTP });
  const doc = root.document;
  const el = id => doc.getElementById(id);
  let session = null, reader = null, restoring = false, booting = true, draftInvalid = false;
  let scanToken = 0, exportBusy = false, transitionBusy = false;
  let draftTimer = null, historyTimer = null, draftMax = null, historyMax = null;
  let writeChain = Promise.resolve(true), lastWriteOk = true;
  const ids = new Set(), bounce = new Map(), liveNodes = new Map();
  let detailLimit = 50, historyInitTask = null, historyInitialized = false;
  root.dangQuetTP = false;
  const sc = () => root.ScannerCore;
  const notify = (message, type = 'error') => {
    const status = el('tp-message');
    if (status) { status.textContent = message; status.dataset.type = type; }
    if (root.showCanhBao) root.showCanhBao(message, type);
  };
  const confirm = message => new Promise(resolve => root.moXacNhanApp(message, () => resolve(true), 'Đồng ý', () => resolve(false), 'Hủy', 'Thành phẩm'));
  function history() { return sc().docLichSu(HISTORY); }
  function record(state) {
    const { items, ...meta } = clone(state);
    return { ...meta, thoiGian: localTime(new Date(meta.ngay)), danhSach: items };
  }
  function queueWrite(list, clear = false) {
    const snapshot = clone(list);
    const previous = clone(history());
    writeChain = writeChain.then(async () => {
      const ok = clear ? await sc().xoaLichSu(HISTORY) : await sc().luuLichSu(HISTORY, snapshot, () => notify('Bộ nhớ đầy. Giữ ứng dụng mở và xuất Excel, hoặc giải phóng dung lượng rồi thử lưu lại.'));
      lastWriteOk = ok !== false;
      if (!lastWriteOk) {
        sc().luuLichSu(HISTORY, previous);
        notify('Không lưu được lịch sử TP. Dữ liệu cũ được giữ để thử lại hoặc xuất Excel.');
      }
      return lastWriteOk;
    }).catch(error => { lastWriteOk = false; notify('Lỗi lưu TP: ' + error.message); return false; });
    return writeChain;
  }
  function cancelTimers() {
    [draftTimer, historyTimer, draftMax, historyMax].forEach(clearTimeout);
    draftTimer = historyTimer = draftMax = historyMax = null;
  }
  function saveDraft() {
    clearTimeout(draftTimer); clearTimeout(draftMax); draftTimer = draftMax = null;
    if (restoring || draftInvalid) return !draftInvalid;
    try {
      if (session) localStorage.setItem(DRAFT, JSON.stringify(session));
      else localStorage.removeItem(DRAFT);
      return true;
    } catch (error) { notify('Không lưu được phiên TP: ' + error.message + '. Hãy xuất Excel và thử lưu lại.'); return false; }
  }
  function saveHistory() {
    clearTimeout(historyTimer); clearTimeout(historyMax); historyTimer = historyMax = null;
    if (!session || restoring || booting || !historyInitialized) return;
    // Serialize read-modify-write too: a delayed write must not lose another session.
    const snapshot = clone(session);
    writeChain = writeChain.then(async () => {
      if (!sc().isLoaded()) return true; // draft remains durable until DB is available
      const list = history().filter(s => s.idPhien !== snapshot.idPhien);
      if (snapshot.items.length) list.push(record(snapshot));
      lastWriteOk = (await sc().luuLichSu(HISTORY, list, () => notify('Bộ nhớ đầy khi lưu lịch sử TP. Hãy xuất Excel.'))) !== false;
      if (!lastWriteOk) notify('Không lưu được lịch sử TP; phiên dở dang vẫn được giữ để thử lại.');
      return lastWriteOk;
    }).catch(error => { lastWriteOk = false; notify('Lỗi lịch sử TP: ' + error.message); return false; });
  }
  function flushTP() {
    if (restoring || booting) return true;
    cancelTimers();
    const ok = saveDraft();
    if (ok) saveHistory();
    return ok;
  }
  async function flushWait() {
    if (!flushTP()) return false;
    await writeChain;
    await sc().whenIdle();
    return lastWriteOk;
  }
  function scheduleSave() {
    clearTimeout(draftTimer); clearTimeout(historyTimer);
    draftTimer = setTimeout(saveDraft, 300); historyTimer = setTimeout(saveHistory, 1000);
    if (!draftMax) draftMax = setTimeout(saveDraft, 1000);
    if (!historyMax) historyMax = setTimeout(saveHistory, 3000);
  }
  function changed() {
    session.revision++; session.daXuatExcel = false; session.capNhatLuc = new Date().toISOString();
  }
  function rebuildIds() { ids.clear(); bounce.clear(); if (session) session.items.forEach(i => ids.add(i.id)); }
  function scanAllowed() { return root.dangQuetTP && el('tpPage')?.classList.contains('active') && !restoring && !transitionBusy; }
  function khiQuetDuocMaTP(result) {
    if (!scanAllowed() || !session) return;
    const raw = result && typeof result.getText === 'function' ? result.getText() : String(result || '');
    if (!raw.trim() || sc().kiemTraKhoaMa(bounce, raw, false)) return;
    try {
      const item = { ...xuLyDuLieuQRTP(raw), thoiGian: localTime() };
      if (ids.has(item.id)) throw new Error('Đã quét mã ' + item.id + ' trong phiên này.');
      tinhThongKePhienTP([...session.items, item]);
      session.items.push(item); ids.add(item.id); changed(); scheduleSave(); capNhatLogTP();
      if (root.phatTiengBip) root.phatTiengBip();
      if (root.phatVibrateSuccess) root.phatVibrateSuccess();
      sc().hienVienFeedback('tp-cam-flash-overlay', 'tp-video-box', 'success');
    } catch (error) {
      sc().khoaCanhBaoTrung(bounce, raw);
      if (root.phatVibrateError) root.phatVibrateError();
      if (root.phatTiengBip) root.phatTiengBip();
      sc().hienVienFeedback('tp-cam-flash-overlay', 'tp-video-box', 'error');
      notify(error.message);
    }
  }
  function dungTP() {
    root.dangQuetTP = false; scanToken++;
    root.dungCameraFast('tp-reader', reader); reader = null;
    if (!booting) flushTP();
    const button = el('tp-toggle'); if (button) button.textContent = 'Quét tiếp';
    if (el('tp-status')) el('tp-status').textContent = 'Đã dừng quét';
  }
  function stopFully() { root.tatDenPinHoanToan('tp-reader'); dungTP(); root.khoaCuonTrangQuet(false); }
  async function startCamera() {
    if (!session || restoring || !await readyHistory()) return;
    const token = ++scanToken;
    root.dangQuetTP = true;
    root.chuyenTrangKhongNav('tpPage');
    el('tp-cam').style.display = 'flex'; el('tp-ketqua').hidden = true;
    root.khoaCuonTrangQuet(true);
    el('tp-status').textContent = 'Đang mở camera…'; el('tp-toggle').textContent = 'Dừng quét';
    try {
      const next = await root.khoiTaoCameraFast('tp-reader', khiQuetDuocMaTP);
      if (token !== scanToken || !scanAllowed()) return;
      if (!next) throw new Error('Camera chưa sẵn sàng');
      reader = next; el('tp-status').textContent = 'Đang quét';
    } catch (error) {
      if (token !== scanToken) return;
      dungTP(); notify(error.name === 'NotAllowedError' ? 'Chưa được cấp quyền camera. Cấp quyền trong cài đặt rồi bấm Quét tiếp.' : 'Lỗi camera: ' + error.message + '. Bấm Quét tiếp để thử lại.');
    }
  }
  async function readyHistory() {
    await sc().whenReady();
    if (!sc().isLoaded()) { notify('Lịch sử chưa nạp được. Vui lòng thử lại; phiên quét vẫn được lưu trên máy.'); return false; }
    await initializeHistory();
    await writeChain;
    return true;
  }
  async function batDauPhienMoiTP() {
    if (booting || transitionBusy || restoring) return;
    if (draftInvalid) { notify('Phiên đã lưu bị lỗi. Hãy sao lưu dữ liệu trước khi xử lý, không tạo phiên đè lên dữ liệu này.'); return; }
    transitionBusy = true;
    try {
      if (session?.items.length && !session.daXuatExcel && !await confirm('Phiên hiện tại có ' + session.items.length + ' mã chưa xuất Excel. Bạn có muốn lưu và tạo phiên mới?')) return;
      stopFully();
      if (session?.items.length && (!await readyHistory() || !await flushWait())) return;
      const now = new Date().toISOString();
      session = { idPhien: 'TP_' + Date.now() + '_' + (root.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)),
        ngay: now, capNhatLuc: now, revision: 0, daXuatExcel: false, items: [] };
      rebuildIds(); detailLimit = 50; capNhatLogTP(); saveDraft();
    } finally { transitionBusy = false; }
    if (el('tpPage')?.classList.contains('active')) await startCamera();
  }
  async function xoaMaTP(id) {
    if (!session || transitionBusy || !await readyHistory()) return;
    const index = session.items.findIndex(i => i.id === id);
    if (index < 0) return;
    session.items.splice(index, 1); ids.delete(id); bounce.clear(); changed();
    flushTP(); capNhatLogTP(); renderResults();
  }
  function node(tag, text, className) {
    const n = doc.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n;
  }
  function action(text, fn) {
    const n = node('button', text, 'btn'); n.type = 'button'; n.addEventListener('click', e => { e.stopPropagation(); Promise.resolve(fn()).catch(error => notify(error.message)); }); return n;
  }
  function itemRow(item) {
    const row = node('div', undefined, 'tp-sub-item');
    row.append(node('span', item.id), node('span', formatKgTP(item.kg)), node('time', item.thoiGian.slice(11, 16)), action('×', () => xoaMaTP(item.id)));
    return row;
  }
  function capNhatLogTP() {
    const items = session?.items || [];
    const stats = tinhThongKePhienTP(items);
    el('tp-count').textContent = stats.tongBao + ' mã · ' + formatKgTP(stats.tongKg);
    el('tp-export-state').textContent = session?.daXuatExcel ? 'Đã xuất Excel' : 'Chưa xuất Excel';
    el('tp-session').textContent = session ? 'Phiên ' + localTime(new Date(session.ngay)) : 'Chưa có phiên';
    const list = el('tp-log-list'); if (!list) return;
    const latest = items.slice(-30).reverse();
    const visibleKeys = Array.from(new Set(latest.map(groupKey)));
    const totals = new Map(stats.gomNhom.map(g => [g.key, g]));
    for (const [key, entry] of liveNodes) if (!visibleKeys.includes(key)) { entry.node.remove(); liveNodes.delete(key); }
    visibleKeys.forEach((key, index) => {
      const group = totals.get(key), visible = latest.filter(i => groupKey(i) === key);
      const signature = JSON.stringify([group.soBao, group.tongKg, visible.map(i => i.id)]);
      let entry = liveNodes.get(key);
      if (!entry) {
        const details = node('details', undefined, 'tp-group-row'); const summary = node('summary'); const rows = node('div');
        details.append(summary, rows); entry = { node: details, summary, rows }; liveNodes.set(key, entry);
      }
      if (entry.signature !== signature || entry.index !== index) {
        entry.summary.replaceChildren(node('span', String(index + 1)), node('span', group.qcDu), node('span', '×' + group.soBao, 'tp-badge-bao'), node('span', formatKgTP(group.tongKg)), node('span', '▾', 'tp-chevron'));
        entry.rows.replaceChildren(...visible.map(itemRow)); entry.signature = signature; entry.index = index;
      }
      if (list.children[index] !== entry.node) list.insertBefore(entry.node, list.children[index] || null);
    });
    el('tp-log-note').textContent = items.length > 30 ? '30 mã mới nhất. Tổng nhóm tính toàn phiên; xem mã cũ trong Kết quả.' : (items.length ? 'Chạm quy cách để xem từng mã.' : 'Chưa có mã. Bấm Bắt đầu phiên mới để quét.');
  }
  function renderResults() {
    const items = session?.items || [], stats = tinhThongKePhienTP(items);
    const tbody = el('tp-summary'); tbody.replaceChildren();
    for (const group of stats.gomNhom) {
      const row = node('tr'); row.append(node('td', group.qcDu), node('td', String(group.soBao)), node('td', formatKgTP(group.tongKg))); tbody.append(row);
    }
    const total = node('tr'); total.append(node('th', 'TỔNG'), node('th', String(stats.tongBao)), node('th', formatKgTP(stats.tongKg))); tbody.append(total);
    el('tp-detail-list').replaceChildren(...items.slice().reverse().slice(0, detailLimit).map(itemRow));
    el('tp-more').hidden = items.length <= detailLimit;
  }
  function xemKetQuaTP() { stopFully(); el('tp-cam').style.display = 'none'; el('tp-ketqua').hidden = false; renderResults(); }
  async function tiepTucTuLichSuTP(id) {
    if (transitionBusy || restoring || !await readyHistory()) return;
    transitionBusy = true;
    let proceed = false;
    try {
      if (session?.idPhien !== id) {
        if (session?.items.length && !await confirm('Phiên hiện tại có ' + session.items.length + ' mã. Lưu phiên hiện tại và chuyển sang phiên lịch sử này?')) return;
        stopFully(); if (!await flushWait()) return;
        const found = history().find(s => s.idPhien === id); if (!found) throw new Error('Phiên này không còn trong lịch sử.');
        session = validateSession(found); rebuildIds(); detailLimit = 50;
        if (!saveDraft()) return;
      }
      capNhatLogTP(); proceed = true;
    } finally { transitionBusy = false; }
    if (proceed) { await startCamera(); notify('Đã nạp phiên: ' + localTime(new Date(session.ngay)) + ' (' + session.items.length + ' mã)', 'success'); }
  }
  async function xoaLichSuTP(id) {
    if (transitionBusy || restoring || !await readyHistory()) return;
    transitionBusy = true;
    try {
      const previousSession = session ? clone(session) : null;
      const removesActive = session && (!id || session.idPhien === id);
      if (!await confirm((id ? 'Xóa phiên này?' : 'Xóa toàn bộ lịch sử TP?') + (removesActive ? ' Phiên đang mở và dữ liệu dở dang cũng sẽ bị xóa.' : '') + ' Không thể hoàn tác.')) return;
      if (removesActive) {
        stopFully(); await writeChain; cancelTimers();
        session = null; rebuildIds();
        if (!saveDraft()) { session = previousSession; rebuildIds(); return; }
      } else if (!await flushWait()) return;
      const deleted = await queueWrite(id ? history().filter(s => s.idPhien !== id) : [], !id);
      if (!deleted && removesActive) { session = previousSession; rebuildIds(); saveDraft(); }
      capNhatLogTP(); renderResults(); renderLichSuTP();
    } finally { transitionBusy = false; }
  }
  function renderLichSuTP() {
    const list = el('lichsu-tp-list'); if (!list || !sc()) return;
    list.replaceChildren();
    if (!sc().isLoaded()) { list.append(node('p', 'Đang nạp lịch sử… Nếu chờ lâu, hãy mở lại ứng dụng.')); return; }
    const query = el('lichsu-tp-tim').value.trim().toLowerCase();
    const records = history().sort((a, b) => Date.parse(b.capNhatLuc) - Date.parse(a.capNhatLuc));
    for (const saved of records) {
      try {
        const state = validateSession(saved), stats = tinhThongKePhienTP(state.items);
        const date = new Date(state.ngay).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' });
        if (query && ![date, localTime(new Date(state.ngay)), ...stats.gomNhom.map(g => g.qcDu)].join(' ').toLowerCase().includes(query)) continue;
        const card = node('article', undefined, 'tp-history-card');
        card.append(node('h3', date), node('p', stats.tongBao + ' mã · ' + formatKgTP(stats.tongKg)), node('p', state.daXuatExcel ? 'Đã xuất Excel' : 'Chưa xuất Excel'));
        card.append(action('Nạp lại / Quét tiếp', () => tiepTucTuLichSuTP(state.idPhien)), action('Xuất Excel', () => exportSessions([state.idPhien])), action('Xóa', () => xoaLichSuTP(state.idPhien)));
        list.append(card);
      } catch (error) { list.append(node('p', 'Có phiên TP không hợp lệ; dữ liệu được giữ nguyên. ' + error.message)); }
    }
    if (!list.children.length) list.append(node('p', 'Không có phiên phù hợp.'));
  }
  async function exportSessions(selected) {
    if (exportBusy || restoring || transitionBusy) return;
    exportBusy = true;
    try {
      await flushWait(); // RAM export remains available when persistence fails.
      if (selected !== 'current' && !await readyHistory()) return;
      const snapshots = selected === 'current' ? (session?.items.length ? [clone(session)] : []) : history()
        .filter(r => selected === 'all' || selected.includes(r.idPhien)).map(validateSession);
      if (!snapshots.length) { notify('Không có dữ liệu TP để xuất.'); return; }
      if (selected === 'all' && !await confirm('Xuất toàn bộ ' + snapshots.length + ' phiên, kể cả phiên ngoài bộ lọc hiện tại?')) return;
      const sheets = snapshots.map((s, index) => ({ name: 'TP_' + (index + 1) + '_' + localTime(new Date(s.ngay)).slice(0, 10), data: s.items.map(i => ({ 'Thời gian': i.thoiGian, 'Mã QR Gốc': i.raw })) }));
      const filename = 'Quet_TP_' + localTime().replace(/[-:]/g, '').replace(' ', '_');
      const result = await root.exportToExcel(filename, sheets[0].name, sheets[0].data, { sheets });
      if (!result?.ok) return;
      await writeChain;
      const list = history(); let modified = false;
      for (const snapshot of snapshots) {
        const current = session?.idPhien === snapshot.idPhien ? session : null;
        if (current && current.revision !== snapshot.revision) continue;
        const existing = list.find(s => s.idPhien === snapshot.idPhien);
        if (!existing && !current) continue;
        if (existing && existing.revision !== snapshot.revision) continue;
        const time = new Date().toISOString();
        if (current) { current.daXuatExcel = true; current.capNhatLuc = time; }
        if (existing) { existing.daXuatExcel = true; existing.capNhatLuc = time; modified = true; }
      }
      if (modified) await queueWrite(list);
      saveDraft(); capNhatLogTP(); renderLichSuTP();
    } finally { exportBusy = false; }
  }
  function kiemTraBackupTP(data) {
    for (const key of [HISTORY, DRAFT]) {
      if (!(key in data)) continue;
      const value = typeof data[key] === 'string' ? JSON.parse(data[key]) : data[key];
      if (key === HISTORY) { if (!Array.isArray(value)) throw new Error('Lịch sử TP trong backup không hợp lệ'); value.forEach(validateSession); }
      else validateSession(value);
    }
  }
  function nhapPhienBackupTP(raw) {
    const incoming = validateSession(typeof raw === 'string' ? JSON.parse(raw) : raw);
    const existingRaw = localStorage.getItem(DRAFT);
    const current = existingRaw ? validateSession(JSON.parse(existingRaw)) : null;
    if (current && current.idPhien !== incoming.idPhien && current.items.length) {
      const list = history();
      if (!list.some(r => r.idPhien === current.idPhien && !newer(current, r))) {
        sc().luuLichSu(HISTORY, [...list.filter(r => r.idPhien !== current.idPhien), record(current)]);
      }
    }
    const saved = history().find(r => r.idPhien === incoming.idPhien);
    let winner = saved && newer(saved, incoming) ? validateSession(saved) : incoming;
    if (current?.idPhien === winner.idPhien && newer(current, winner)) winner = current;
    localStorage.setItem(DRAFT, JSON.stringify(winner));
  }
  function initializeHistory() {
    if (!sc().isLoaded() || restoring || historyInitialized) return Promise.resolve();
    if (historyInitTask) return historyInitTask;
    historyInitTask = reconcileHistory().finally(() => { historyInitTask = null; });
    return historyInitTask;
  }
  async function reconcileHistory() {
    await writeChain;
    if (restoring) return;
    if (session) {
      const stored = history().find(s => s.idPhien === session.idPhien);
      if (stored && newer(stored, session)) { session = validateSession(stored); rebuildIds(); saveDraft(); capNhatLogTP(); }
      historyInitialized = true;
      saveHistory(); await writeChain;
    }
    const list = history(), kept = list.filter(r => !expired(r, session?.idPhien));
    if (kept.length !== list.length) await queueWrite(kept, !kept.length);
    historyInitialized = true;
    renderLichSuTP(); renderResults();
  }
  Object.assign(root, {
    flushTP, luuTPTruocRoiApp: flushWait, dungTP, khiQuetDuocMaTP, capNhatLogTP, renderLichSuTP,
    tiepTucTuLichSuTP, kiemTraBackupTP, nhapPhienBackupTP,
    nhanReaderTP: r => { reader = r; },
    chuanBiPhucHoiTP: async () => {
      if (!await readyHistory()) return false;
      stopFully();
      if (!await flushWait()) return false;
      restoring = true; cancelTimers(); return true;
    },
    huyPhucHoiTP: () => {
      restoring = false; historyInitialized = false; historyInitTask = null;
      try { const raw = localStorage.getItem(DRAFT); session = raw ? validateSession(JSON.parse(raw)) : null; rebuildIds(); capNhatLogTP(); renderResults(); }
      catch (error) { draftInvalid = true; notify('Dữ liệu phục hồi chưa hoàn chỉnh: ' + error.message); }
    }
  });
  function bind(id, fn) { el(id).addEventListener('click', () => Promise.resolve(fn()).catch(error => notify(error.message))); }
  async function init() {
    try {
      const raw = localStorage.getItem(DRAFT); if (raw) session = validateSession(JSON.parse(raw));
    } catch (error) { draftInvalid = true; notify('Không đọc được phiên TP: ' + error.message + '. Dữ liệu gốc được giữ nguyên.'); }
    rebuildIds(); booting = false; capNhatLogTP(); renderResults();
    bind('tp-new', batDauPhienMoiTP);
    bind('tp-toggle', () => root.dangQuetTP ? dungTP() : (session ? startCamera() : batDauPhienMoiTP()));
    bind('tp-results', xemKetQuaTP); bind('tp-continue', startCamera);
    bind('tp-export', () => exportSessions('current'));
    bind('tp-save', async () => { if (await flushWait()) notify('Đã lưu phiên TP.', 'success'); });
    bind('tp-more', () => { detailLimit += 50; renderResults(); });
    bind('tp-export-all', () => exportSessions('all')); bind('tp-delete-all', () => xoaLichSuTP(null));
    el('lichsu-tp-tim').addEventListener('input', renderLichSuTP);
    root.addEventListener('scannercore:history-ready', () => initializeHistory().catch(e => notify(e.message)));
    await sc().whenReady(); await initializeHistory();
  }
  doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'hidden') flushTP(); });
  root.addEventListener('pagehide', flushTP);
  init().catch(error => notify('Lỗi khởi tạo TP: ' + error.message));
})(typeof window !== 'undefined' ? window : globalThis);
