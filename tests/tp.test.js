const { test } = require('node:test');
const assert = require('node:assert/strict');
const tp = require('../tp');
const raw = (id = '000ABC', kg = '56.4000') => `${id}\r\n21B3021A017\r\n1\r\nLuoi cao\r\n021/78 x 35mm x 300MD x 14M (Bac ) ${kg}`;
test('TP preserves original CRLF and leading zero IDs, accepts decimal comma', () => {
  const input = raw('000ABC', '56,4'), item = tp.xuLyDuLieuQRTP(input);
  assert.equal(item.id, '000ABC'); assert.equal(item.kg, 56.4); assert.equal(item.raw, input);
});
test('TP rejects invalid line count, pcs, QC and unsafe weights', () => {
  for (const input of [raw() + '\nextra', raw().replace('\r\n1\r\n', '\r\n1.5\r\n'), raw().replaceAll(' x ', ' / '),
    ...['0', '-1', '0.00001', '1,234.56', '1e2', 'Infinity', '9'.repeat(310)].map(kg => raw('A', kg))]) {
    assert.throws(() => tp.xuLyDuLieuQRTP(input));
  }
});
test('sum uses integer precision; QC grouping retains complete dimensions', () => {
  const items = ['0.1', '0.2', '0.0001'].map((kg, index) => tp.xuLyDuLieuQRTP(raw(String(index), kg)));
  const stats = tp.tinhThongKePhienTP(items);
  assert.equal(stats.tongKg, 0.3001); assert.equal(stats.tongBao, 3); assert.equal(stats.gomNhom.length, 1);
  assert.equal(tp.formatKgTP(432), '432.0');
  assert.equal(tp.formatKgTP(56.45), '56.45');
});
test('backup validator rejects mismatched or duplicate records', () => {
  const item = { ...tp.xuLyDuLieuQRTP(raw()), thoiGian: '2026-11-20 12:00:00' };
  const session = { idPhien: 'TP_1', ngay: '2026-11-20T05:00:00Z', capNhatLuc: '2026-11-20T05:00:00Z', revision: 1, daXuatExcel: false, items: [item] };
  assert.equal(tp.validateSession(session).items[0].raw, raw());
  assert.throws(() => tp.validateSession({ ...session, items: [{ ...item, kg: 99 }] }));
  assert.throws(() => tp.validateSession({ ...session, items: [item, item] }));
});
test('retention protects active, unexported and malformed dates', () => {
  const record = { idPhien: 'A', daXuatExcel: true, capNhatLuc: '2020-01-01' };
  assert.equal(tp.expired(record, 'B'), true);
  assert.equal(tp.expired(record, 'A'), false);
  assert.equal(tp.expired({ ...record, daXuatExcel: false }, 'B'), false);
  assert.equal(tp.expired({ ...record, capNhatLuc: 'broken' }, 'B'), false);
  assert.equal(tp.newer({ revision: 2, capNhatLuc: '2020-01-01' }, { revision: 1, capNhatLuc: '2026-01-01' }), true);
});
