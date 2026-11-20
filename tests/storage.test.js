const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { IDBFactory } = require('fake-indexeddb');
const source = fs.readFileSync(require.resolve('../scanner-core.js'), 'utf8');
function storage() {
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
}
async function boot(indexedDB, localStorage) {
  const context = { indexedDB, localStorage, console, Event, setTimeout: (fn, delay) => { const t = setTimeout(fn, delay); t.unref(); return t; }, clearTimeout,
    document: {}, dispatchEvent() {} };
  context.window = context; vm.createContext(context); vm.runInContext(source, context);
  await context.ScannerCore.whenReady(); return context.ScannerCore;
}
test('TP merge prefers revision over clock drift; existing modules retain date comparison', async () => {
  const idb = new IDBFactory(), ls = storage(), core = await boot(idb, ls);
  await core.luuLichSu('tp_lich_su', [{ idPhien: 'A', revision: 10, capNhatLuc: '2025-01-01', danhSach: ['new'] }]);
  core.importHistoryFromBackup('tp_lich_su', [{ idPhien: 'A', revision: 1, capNhatLuc: '2030-01-01', danhSach: ['old'] }]);
  await core.whenIdle();
  assert.equal(core.docLichSu('tp_lich_su')[0].revision, 10);
  const reboot = await boot(idb, ls); assert.equal(reboot.docLichSu('tp_lich_su')[0].revision, 10);
});
test('durable TP replacement prevents deleted sessions returning after DB failure', async () => {
  const idb = new IDBFactory(), ls = storage(), core = await boot(idb, ls);
  await core.luuLichSu('tp_lich_su', [{ idPhien: 'A' }, { idPhien: 'B' }]);
  ls.setItem('tp_lich_su', JSON.stringify({ replace: true, sessions: [{ idPhien: 'B' }] }));
  const reboot = await boot(idb, ls);
  assert.deepEqual(Array.from(reboot.docLichSu('tp_lich_su'), r => r.idPhien), ['B']);
  ls.setItem('tp_lich_su', JSON.stringify({ replace: true, sessions: [] }));
  const cleared = await boot(idb, ls); assert.equal(cleared.docLichSu('tp_lich_su').length, 0);
});
test('awaited backup import reports failure when IDB and fallback both fail', async () => {
  const idb = new IDBFactory(), ls = storage(), core = await boot(idb, ls);
  const { IDBDatabase } = require('fake-indexeddb');
  const original = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (...args) {
    if (args[1] === 'readwrite') throw new Error('IDB unavailable');
    return original.apply(this, args);
  };
  ls.setItem = () => { throw new Error('Quota exceeded'); };
  try {
    assert.equal(await core.importHistoryFromBackup('tp_lich_su', [{ idPhien: 'A', revision: 1 }], { awaitWrite: true }), false);
  } finally { IDBDatabase.prototype.transaction = original; }
});
test('empty TP backup is an array even when mirror contains a replacement envelope', async () => {
  const idb = new IDBFactory(), ls = storage(), core = await boot(idb, ls);
  ls.setItem('tp_lich_su', JSON.stringify({ replace: true, sessions: [] }));
  assert.deepEqual(JSON.parse(core.exportHistoryForBackup().tp_lich_su), []);
});
