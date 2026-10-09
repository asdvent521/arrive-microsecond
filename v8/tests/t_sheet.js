// 表世界測試：每張工作表只有一張表；沒有 3D；「到場」對接成功與錯過；連結跳轉與返回。
// node v7/tests/t_sheet.js <test7.html> [截圖資料夾]
var lib = require('./lib'), assert = lib.assert, path = require('path');
var OUT = process.argv[3] || path.join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
var J1 = '00000000001', J2 = '00000000002';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh(); await H.toSheet();
  assert((await H.ev("APP.view()")) === 'sheet' && (await pg.isHidden('#view-game')), '切到表世界，裡世界藏起來');
  assert((await H.ev("document.querySelectorAll('#view-sheet canvas').length")) === 0, '表世界沒有 3D');
  var order = await H.ev("SHEET.ORDER");
  assert(order.length === 20 && order[0] === 'todo' && order[order.length - 1] === 'help', '20 張工作表，待辦在前、說明在後');
  for (var k of order) {
    await H.sheet(k);
    var n = await H.ev("document.querySelectorAll('#smain table').length");
    assert(n === (k === 'help' ? 0 : 1), '工作表「' + (await pg.textContent('#stitle')) + '」' + (k === 'help' ? '是說明，沒有表' : '只有一張表'));
    if (k !== 'help') assert((await H.ev("document.querySelectorAll('#smain th').length")) > 0 && (await H.ev("document.querySelectorAll('#smain .rn').length")) > 0 && (await H.ev("document.querySelectorAll('#smain .fx, #smain .colletter').length")) === 0, '有欄名、列號，沒有欄字母和 fx');
  }
  await H.sheet('roles'); await pg.screenshot({ path: OUT + '/v8_sheet_1_roles.png' });
  // 360px 寬：標題列的 ←、標題、「看誰」、「表 ⇄ 裡」互不重疊
  await H.sheet('uses');
  var ov = await H.ev("(function(){var els=['#sback','#stitle','#swho select','#swapToGame'].map(function(q){var r=document.querySelector(q).getBoundingClientRect();return {q:q,l:r.left,r:r.right,t:r.top,b:r.bottom};});var bad=[];for(var i=0;i<els.length;i++)for(var j=i+1;j<els.length;j++){var a=els[i],b=els[j];if(a.l<b.r-1&&b.l<a.r-1&&a.t<b.b-1&&b.t<a.b-1)bad.push(a.q+'×'+b.q);}return {bad:bad,w:innerWidth,whoRight:els[2].r};})()");
  assert(ov.w === 360 && ov.bad.length === 0 && ov.whoRight <= 360, '360px 寬標題列元素不重疊（看誰、切換鈕）' + (ov.bad.length ? '：' + ov.bad.join('、') : ''));
  await pg.screenshot({ path: OUT + '/v8_sheet_1b_uses.png' });
  assert((await H.ev("document.querySelectorAll('#stabs a').length")) === 20 && (await H.ev("getComputedStyle(document.querySelector('#stabs a.g-find')).borderTopColor")) !== (await H.ev("getComputedStyle(document.querySelector('#stabs a.g-mine')).borderTopColor")), '分頁列用顏色分組');

  // 連結跳轉與返回
  await H.sheet('open'); await H.clickText('J2 阿澄');
  assert((await H.sheetName()) === 'roles' && (await H.ev("document.querySelector('#smain tr.flash').dataset.id")) === J2 && (await H.ev("document.querySelector('#smain tr.flash') !== null")), '點代號 → 角色表那一列閃一下');
  await pg.click('#sback'); await pg.waitForTimeout(150);
  assert((await H.sheetName()) === 'open', '← 返回可預約時段');
  await H.sheet('come'); await H.clickText('看規則');
  assert((await H.sheetName()) === 'uses' && (await H.main()).indexOf('聽你講') >= 0 && (await H.ev("document.querySelector('#view-sheet select[data-ed=\"who\"]').value")) === J2, '「看規則」跳到規則用途，看誰＝J2');
  await pg.click('#sback'); await pg.waitForTimeout(150); assert((await H.sheetName()) === 'come', '再返回');
  await H.sheet('todo'); await H.clickText('去開對接時段'); assert((await H.sheetName()) === 'myslots', '待辦的按鈕跳到我開的時段');
  // 新增一筆：表格最下面一列直接填
  await H.setIn('addSlotMin', 2); await H.click('[data-act="addSlot"]');
  assert((await H.rows()) === 2 && (await H.ev("document.querySelector('#smain tr.flash') !== null")), '最下面一列填完 → 新時段出現並閃一下');

  // 「到場」對接成功
  await H.ev("(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+9e6,1,null,t);CORE.book(S,'" + J1 + "',s.id,t);APP.changed();})()");
  await H.sheet('booked'); await pg.screenshot({ path: OUT + '/v8_sheet_2_booked.png' });
  assert((await H.rows()) === 1 && (await H.ev("document.querySelector('input[data-ed=\"present\"]') !== null")) && (await H.ev("document.querySelector('input[data-ed=\"maxGive\"]') !== null")) && (await H.main()).indexOf('改履歷 100點') >= 0, '我預約的：到場勾、我要的（點東西選）、最多給');
  await H.click('[data-act="wantAdd"][data-res="r2a"]'); assert((await H.main()).indexOf('合計 100 阿澄點') >= 0, '選了改履歷，合計 100');
  await H.edit('input[data-ed="maxGive"]', 500); await H.edit('input[data-ed="present"]', null, true);
  await pg.waitForFunction("APP.state().dockings.length === 1", null, { timeout: 20000 }); await pg.waitForTimeout(300);
  var dk = await H.ev("APP.state().dockings[0]");
  assert(dk.gaveA === 100 && dk.gaveB === 0 && dk.itemsA[0].name === '改履歷' && (await H.main()).indexOf('已對接') >= 0 && (await pg.textContent('#smsg')).indexOf('對接') >= 0, '勾到場 → 那一微秒照選好的成交：阿澄給 100（改履歷）、我沒被選所以給 0');
  await H.sheet('points'); assert((await H.rows()) === 1 && (await H.main()).indexOf('改履歷') >= 0 && (await H.main()).indexOf('100') >= 0, '點數表多了一筆保留：改履歷 100 阿澄點');
  await H.sheet('dockings'); assert((await H.rows()) === 1, '對接紀錄一列');

  // 「到場」沒勾 → 錯過
  await H.ev("(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+4e6,1,null,t);CORE.book(S,'" + J1 + "',s.id,t);APP.changed();})()");
  await H.sheet('booked');
  await pg.waitForFunction("APP.state().roles[1].slots.some(s=>s.missed.length)", null, { timeout: 15000 }); await pg.waitForTimeout(300);
  assert((await H.main()).indexOf('錯過，不能再對接') >= 0 && (await pg.textContent('#smsg')).indexOf('錯過') >= 0, '沒勾到場 → 標為錯過');
  assert((await H.ev("APP.state().dockings.length")) === 1, '錯過的不算對接');
  await pg.screenshot({ path: OUT + '/v8_sheet_3_missed.png' });

  // 「明天起」看得出改了什麼：J1 把早餐 100 改 120，換人去看，表世界資源表和裡世界商店都標「明天起 120 點」
  await H.fresh(); await H.toSheet(); await H.sheet('resources');
  await H.edit('[data-ed="resPrice"][data-id="r1b"]', 120);
  assert((await H.main()).indexOf('明天起（今天的照舊）：早餐一頓：120 點') >= 0, '自己的表下面列出真的有改的地方');
  await H.sheet('roles'); await H.edit('input[data-ed="me"][data-id="' + J2 + '"]', null, true);
  await H.sheet('resources', J1 + ':');
  var rm = await H.main();
  assert(rm.indexOf('明天起 120 點') >= 0 && rm.indexOf('我 明天起會改（今天就公開）：早餐一頓：120 點') >= 0 && rm.indexOf('陪跑一小時：') < 0, '看別人的資源表：改的那一項標「明天起 120 點」，下面只列真的有改的');
  await pg.click('#swapToGame'); await pg.waitForTimeout(400);
  await H.ev("GAME.teleportTo(CORE.roleOf(APP.state(),'" + J1 + "'))"); await H.goNear('resource'); await H.pick('看商店');
  assert((await H.dlgBody()).indexOf('早餐一頓　100 點') >= 0 && (await H.dlgBody()).indexOf('【明天起 120 點】') >= 0, '裡世界商店：今天 100 點，標「明天起 120 點」');

  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
