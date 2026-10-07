// 擋掉 Three.js：表世界完整可用，裡世界顯示「3D 引擎沒載入」。
// node v7/tests/t_nothree.js <test7_nothree.html>（用 NO_THREE=1 v7/build.sh fragment 組的頁面）
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  assert((await H.ev("typeof THREE")) === 'undefined' && (await H.ev("WORLD.available")) === false, 'Three.js 沒載入');
  assert((await pg.textContent('#stage')).indexOf('3D 引擎沒載入') >= 0, '裡世界顯示「3D 引擎沒載入」');
  await pg.click('#swapToSheet'); await pg.waitForTimeout(300);
  var order = await H.ev("SHEET.ORDER");
  for (var k of order) { await H.sheet(k); assert((await H.ev("document.querySelectorAll('#smain table').length")) === (k === 'help' ? 0 : 1), '工作表 ' + k + ' 正常'); }
  await H.sheet('open'); await H.click('[data-act="book"]'); assert((await H.sheetName()) === 'booked' && (await H.rows()) === 1, '沒有 3D 也能預約');
  await H.ev("(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+4e6,1,100,t);CORE.book(S,'" + J1 + "',s.id,t);APP.changed();})()");
  await H.sheet('booked'); await H.edit('input[data-ed="present"]:last-of-type', null, true);
  await pg.waitForFunction("APP.state().dockings.length === 1", null, { timeout: 15000 });
  assert((await H.ev("APP.state().dockings.length")) === 1, '沒有 3D 也能用「到場」對接');
  await pg.click('#swapToGame'); await pg.waitForTimeout(200);
  assert((await pg.textContent('#stage')).indexOf('3D 引擎沒載入') >= 0 && (await pg.textContent('#task')).length > 0, '切回裡世界還是那句話，沒有錯誤');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
