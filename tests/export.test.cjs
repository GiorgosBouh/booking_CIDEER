const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { filterBookings, buildWorkbook } = require('../src/export.js');

// Supply the SheetJS standalone build path to test actual XLSX serialization.
const XLSX = require(path.resolve(process.argv[2]));
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const context = vm.createContext({ Intl, Date, Set, TZ: 'Europe/Athens' });
vm.runInContext(html.slice(html.indexOf('    function partsInAthens'), html.indexOf('    function escapeHtml')), context);
const source = [
  { id: 'weekly', date: '2026-01-26', time: '09:00', beneficiaryName: 'Δοκιμή Α', beneficiaryPhone: '0012345678', clinician: 'Α', serviceType: 'Συμβουλευτική', repeatWeekly: 'TRUE', repeatEndDate: '2026-02-16', exceptions: '2026-02-09', overrides: '{"2026-02-02":{"clinician":"Β","serviceType":"Αξιολόγηση","time":"11:00"}}', notes: '=1+1' },
  { id: 'single', date: '2026-02-03', time: '10:00', beneficiaryName: 'Δοκιμή Β', clinician: 'Α', serviceType: 'Αξιολόγηση', notes: '<script>' }
];
const rows = context.expandOccurrences(context.normalizeRows(source));
assert.equal(rows.length, 4);
assert.equal(rows.some(r => r.date === '2026-02-09'), false);
assert.equal(rows.find(r => r.date === '2026-02-02').time, '11:00');
assert.equal(filterBookings(rows, { allMonths: true }).length, 4);
assert.equal(filterBookings(rows, { months: ['2026-02'] }).length, 3);
assert.equal(filterBookings(rows, { months: ['2026-01', '2026-02'] }).length, 4);
assert.equal(filterBookings(rows, { months: [] }).length, 0);
assert.equal(filterBookings(rows, { allMonths: true, clinician: 'Α' }).length, 3);
assert.equal(filterBookings(rows, { allMonths: true, serviceType: 'Αξιολόγηση' }).length, 2);
const filtered = filterBookings(rows, { months: ['2026-02'], clinician: 'Β', serviceType: 'Αξιολόγηση' });
assert.equal(filtered.length, 1);
assert.equal(filtered[0].isOverride, true);
const wb = buildWorkbook(XLSX, filterBookings(rows, { allMonths: true }));
const roundtrip = XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true }), { type: 'buffer' });
assert.deepEqual(roundtrip.SheetNames, ['Ραντεβού', 'Ανά μήνα']);
assert.equal(roundtrip.Sheets['Ραντεβού'].F2.v, '0012345678');
assert.equal(roundtrip.Sheets['Ραντεβού'].J2.v, '=1+1');
assert.equal(roundtrip.Sheets['Ραντεβού'].J2.t, 's');
assert.equal(roundtrip.Sheets['Ραντεβού'].J2.f, undefined);
const summary = XLSX.utils.sheet_to_json(roundtrip.Sheets['Ανά μήνα'], { header: 1 });
const total = summary.find(r => r[0] === 'ΣΥΝΟΛΟ');
assert.equal(total[3], 4);
assert.equal(total[4], 2);
assert.equal(roundtrip.Sheets['Ραντεβού']['!autofilter'].ref, 'A1:M5');
new vm.Script(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1]);
console.log('Passed: monthly and combined filters, weekly cancellations/overrides, XLSX roundtrip, unique series totals, text/phone preservation, JavaScript syntax.');
