// 擋掉 Three.js：表世界完整可用，裡世界顯示「3D 引擎沒載入」。
// node v7/tests/t_nothree.js <test7_nothree.html>（用 NO_THREE=1 v7/build.sh fragment 組的頁面）
var lib = require('./lib'), assert = lib.assert, T = require('./tut');
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
  await H.ev("(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+6e6,1,null,t);CORE.book(S,'" + J1 + "',s.id,t);CORE.setWants(S,s.id,'" + J2 + "','" + J1 + "',['r1b']);APP.changed();})()");
  await H.sheet('booked'); await H.click('tbody tr[data-row]:first-child [data-act="wantAdd"][data-res="r2b"]'); await H.edit('tbody tr[data-row]:first-child input[data-ed="present"]', null, true);   // 最快到的那個時段排第一列
  await pg.waitForFunction("APP.state().dockings.length === 1", null, { timeout: 15000 });
  assert((await H.ev("APP.state().dockings[0].gaveA")) === 90 && (await H.ev("APP.state().holds.length")) === 2, '沒有 3D 也能選東西、勾到場互換：拿到阿澄的一小時諮詢（90 點）');
  await pg.click('#swapToGame'); await pg.waitForTimeout(200);
  assert((await pg.textContent('#stage')).indexOf('3D 引擎沒載入') >= 0 && (await pg.textContent('#task')).length > 0, '切回裡世界還是那句話，沒有錯誤');
  // 新手教學：沒有 3D 也能在表世界從創角色走完；選「不要」切到裡世界帶看對照（只有對話框，沒有 3D）再切回來
  await H.fresh({ raw: true });
  assert((await pg.textContent('#stage')).indexOf('3D 引擎沒載入') >= 0 && !(await H.dlgOpen()), '沒有 3D：裡世界不升創角色的對話框，用表世界創');
  await T.Sh.full(H, '小無'); await T.Sh.ask(H, false); await T.G.compare(H);
  assert((await H.ev("CORE.dockCount(APP.state(),'" + J1 + "')")) === 0 && (await H.ev("APP.state().dockings[0].tutorial")) === true, '沒有 3D 也走得完教學，教學的對接不算數');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
