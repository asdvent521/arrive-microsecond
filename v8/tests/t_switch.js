// 切換測試：在裡世界站在 J2 規則屋 → 切到表世界是 J2 的規則用途；表世界看 J3 的資源 → 切到裡世界顯示怎麼走去 J3。
// node v7/tests/t_switch.js <test7.html>
var lib = require('./lib'), assert = lib.assert;
var J2 = '00000000002', J3 = '00000000003';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  assert((await pg.textContent('#swapToSheet')) === '表 ⇄ 裡' && (await pg.textContent('#swapToGame')) === '表 ⇄ 裡', '右上角一個切換鈕「表 ⇄ 裡」');
  // 裡世界站在 J2 的規則屋旁 → 表世界：規則用途，看誰＝J2
  await H.ev("GAME.teleportTo(CORE.roleOf(APP.state(),'" + J2 + "'))"); await H.goNear('rule');
  assert((await H.dlgTitle()).indexOf('這裡是規則') === 0, '站在 J2 的規則屋旁');
  await pg.click('#swapToSheet'); await pg.waitForTimeout(300);
  assert((await H.sheetName()) === 'uses' && (await H.ev("document.querySelector('#view-sheet select[data-ed=\"who\"]').value")) === J2 && (await H.main()).indexOf('聽你講') >= 0, '切過去是 J2 的規則用途');
  // 表世界看 J3 的資源 → 裡世界：指引怎麼走去 J3
  await H.sheet('resources', J3 + ':');
  assert((await H.main()).indexOf('借一本書') >= 0, '表世界看 J3 的資源');
  await pg.click('#swapToGame'); await pg.waitForTimeout(600);
  assert((await H.ev("APP.view()")) === 'game' && (await H.ev("GAME.cur().role.serial")) === J3, '切回裡世界，看的是 J3 的世界（市集旁）');
  await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 15000 }); await pg.waitForTimeout(300);
  assert((await H.dlgTitle()).indexOf('這裡是資源') === 0 && (await H.dlgBody()).indexOf('借一本書') >= 0, '走到 J3 的市集旁，對話框是他的資源');
  // 從地圖查 J3（在自己的世界）→ 指引光點
  await H.ev("GAME.goHome()"); await pg.waitForTimeout(300); await pg.click('#btnMap'); await H.click('#map .node[data-go="J3"]');
  assert((await H.ev("WORLD.guideCount()")) > 1 && (await pg.textContent('#toast')).indexOf('J3') >= 0, '回家後地圖點 J3 → 地上亮出怎麼走去 J3');
  // 表世界「我可以去找」 → 切到裡世界也顯示指引
  await pg.click('#swapToSheet'); await pg.waitForTimeout(300); await H.sheet('visit');
  await pg.click('#swapToGame'); await pg.waitForTimeout(400);
  assert((await H.ev("APP.view()")) === 'game', '切回裡世界');
  // 切換不會丟狀態：表世界開的時段，裡世界看得到
  await pg.click('#swapToSheet'); await pg.waitForTimeout(300); await H.sheet('myslots'); await H.setIn('addSlotMin', 3); await H.click('[data-act="addSlot"]');
  await pg.click('#swapToGame'); await pg.waitForTimeout(400); await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 15000 }); await pg.waitForTimeout(300);
  assert((await H.dlgTitle()).indexOf('這裡是終點') === 0 && (await H.dlgBody()).split('・').length - 1 === 2, '切回裡世界站在自己的終點台旁，看得到兩個時段');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
