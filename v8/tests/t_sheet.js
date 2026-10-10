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
  assert((await H.main()).indexOf('你還沒選他的東西：一換一，兩邊都選了才成交') >= 0 && (await H.main()).indexOf('他還沒選你的東西：一換一，兩邊都選了才成交') >= 0, '兩邊都還沒選：看得到一換一的提醒');
  await H.click('[data-act="wantAdd"][data-res="r2a"]'); assert((await H.main()).indexOf('合計 100 阿澄點') >= 0 && (await H.main()).indexOf('你還沒選他的東西') < 0, '選了改履歷，合計 100，我這邊的提醒消失');
  // 主人（阿澄）選我的早餐：單機版用換人成主人去選
  await H.sheet('roles'); await H.edit('input[data-ed="me"][data-id="' + J2 + '"]', null, true);
  await H.sheet('myslots'); await H.click('[data-act="wantAdd"][data-res="r1b"]');
  await H.sheet('roles'); await H.edit('input[data-ed="me"][data-id="' + J1 + '"]', null, true); await H.sheet('booked');
  assert((await H.main()).indexOf('早餐一頓（100 點）') >= 0 && (await H.main()).indexOf('他還沒選你的東西') < 0, '換人成阿澄選了早餐，回來看得到他要我的');
  await H.edit('input[data-ed="maxGive"]', 500); await H.edit('input[data-ed="present"]', null, true);
  await pg.waitForFunction("APP.state().dockings.length === 1", null, { timeout: 20000 }); await pg.waitForTimeout(300);
  var dk = await H.ev("APP.state().dockings[0]");
  assert(dk.traded && dk.gaveA === 100 && dk.gaveB === 100 && dk.itemsA[0].name === '改履歷' && dk.itemsB[0].name === '早餐一頓' && (await H.main()).indexOf('已對接') >= 0 && (await pg.textContent('#smsg')).indexOf('我拿出 早餐一頓（100 點）；拿到 阿澄的 改履歷（100 點）') >= 0, '勾到場 → 那一微秒一換一成交，訊息以東西為主');
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

  // 選的東西有一部分那天已經下架：表世界「我要的」「他要我的」加一行小字；那一微秒剩下的照成交
  // 模擬「換日了」：先選改履歷＋諮詢，再讓阿澄今天生效的版本沒有改履歷
  await H.fresh(); await H.toSheet();
  await H.ev("(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+12e6,1,null,t);CORE.book(S,'" + J1 + "',s.id,t);CORE.setWants(S,s.id,'" + J1 + "','" + J2 + "',['r2a','r2b']);CORE.setWants(S,s.id,'" + J2 + "','" + J1 + "',['r1a','r1b']);var p=CORE.tomorrow(S,'" + J2 + "',t);p.resources=p.resources.filter(function(x){return x.id!=='r2a';});p.fromDay=CORE.dayNum(t);var q=CORE.tomorrow(S,'" + J1 + "',t);q.resources=q.resources.filter(function(x){return x.id!=='r1a';});q.fromDay=CORE.dayNum(t);APP.changed();})()");
  await H.sheet('booked'); var bm = await H.main();
  assert(bm.indexOf('選的「改履歷」那天已經下架，不算') >= 0 && bm.indexOf('合計 90 阿澄點') >= 0, '「我要的」：小字寫改履歷不算，合計只剩諮詢 90');
  assert(bm.indexOf('早餐一頓（100 點）') >= 0 && bm.indexOf('選的「陪跑一小時」那天已經下架，不算') >= 0, '「他要我的」：早餐照算、陪跑小字不算');
  await H.edit('input[data-ed="present"]', null, true);
  await pg.waitForFunction("APP.state().dockings.length === 1", null, { timeout: 20000 }); await pg.waitForTimeout(300);
  var dk2 = await H.ev("APP.state().dockings[0]");
  assert(dk2.traded && dk2.gaveA === 90 && dk2.gaveB === 100 && dk2.noteA === '選的「改履歷」那天已經下架，沒換到' && dk2.noteB === '選的「陪跑一小時」那天已經下架，沒換到', '那一微秒：剩下的照成交（阿澄給 90、我給 100），紀錄寫沒換到');
  await H.sheet('dockings'); assert((await H.main()).indexOf('那天已經下架，沒換到') >= 0, '對接紀錄表寫沒換到');

  // 村規改了：規則屋第 3 頁和表世界都看得到「要重新接受」，按了接受就好
  await H.fresh(); await H.toSheet();
  await H.sheet('switches', J2 + ':'); await H.click('[data-act="accept"][data-id="' + J2 + '"]');
  assert((await H.main()).indexOf('你已接受') >= 0, 'J1 先接受 J2 的村規（v1）');
  await H.sheet('roles'); await H.edit('input[data-ed="me"][data-id="' + J2 + '"]', null, true);
  await H.sheet('switches'); await H.edit('textarea[data-ed="village"]', '東恆村規第二版：先喝茶。');
  await H.sheet('roles'); await H.edit('input[data-ed="me"][data-id="' + J1 + '"]', null, true);
  await H.sheet('switches', J2 + ':'); var vm = await H.main();
  assert(vm.indexOf('你已接受') >= 0 && vm.indexOf('明天起村規改了，到時候要重新接受') >= 0, '今天還是 v1：已接受，但寫明天起村規改了');
  // 模擬換日：讓 J2 明天起的版本今天就生效
  await H.ev("(function(){var S=APP.state(),t=APP.now(),p=CORE.pending(CORE.roleOf(S,'" + J2 + "'),t);p.fromDay=CORE.dayNum(t);APP.changed();})()");
  await H.sheet('switches', J2 + ':'); vm = await H.main();
  assert(vm.indexOf('你接受的是舊版村規，要重新接受') >= 0 && (await H.ev("document.querySelector('[data-act=\"accept\"]') !== null")), '表世界：接受的是舊版，「接受村規」按鈕照樣出現');
  await pg.click('#swapToGame'); await pg.waitForTimeout(400);
  await H.ev("GAME.teleportTo(CORE.roleOf(APP.state(),'" + J2 + "'))"); await H.goNear('rule'); await H.pick('閱讀規則'); await H.pick('下一頁'); await H.pick('下一頁');
  assert((await H.dlgBody()).indexOf('你接受的是舊版村規，要重新接受') >= 0 && (await H.opts()).indexOf('接受村規') >= 0, '規則屋第 3 頁：接受的是舊版，有「接受村規」');
  await H.pick('接受村規');
  assert((await H.dlgBody()).indexOf('你已接受') >= 0 && (await H.ev("APP.state().acceptances.length")) === 2 && (await H.ev("APP.state().acceptances[1].village")) === '東恆村規第二版：先喝茶。', '按了接受：記下新版村規');
  await pg.click('#swapToSheet'); await pg.waitForTimeout(300); await H.sheet('switches', J2 + ':');
  assert((await H.main()).indexOf('你已接受') >= 0 && (await H.main()).indexOf('舊版') < 0, '表世界也變成你已接受');

  // 一換一、價格可以是 0、空物件的提醒
  await H.fresh(); await H.toSheet(); await H.sheet('todo');
  assert((await H.main()).indexOf('想只收不給，要先建一個 0 點的空物件') >= 0, '沒建空物件：待辦看得到提醒');
  await H.sheet('resources'); await H.setIn('addResName', '空的：什麼都不給'); await H.setIn('addResPrice', 0); await H.click('[data-act="addRes"]');
  var eid = await H.ev("CORE.pending(APP.me(), APP.now()).resources.find(function (x) { return x.price === 0; }).id");
  assert(eid && (await H.main()).indexOf('明天起新增') >= 0, '建了 0 點的空物件（明天起）');
  await H.ev("(function(){var S=APP.state(),t=APP.now(),p=CORE.pending(APP.me(),t);p.fromDay=CORE.dayNum(t);APP.changed();})()");   // 模擬換日
  await H.sheet('todo'); assert((await H.main()).indexOf('可換 0 份，先補貨') >= 0, '空物件可換 0 份：待辦提醒補貨');
  await H.sheet('resources'); await H.setIn('stockN_' + eid, 500); await H.click('[data-act="stock"][data-id="' + eid + '"][data-n="1"]');
  assert((await H.ev("CORE.stockOf(APP.me(),'" + eid + "').avail")) === 500, '一次補 500 份');
  await H.sheet('todo'); assert((await H.main()).indexOf('空物件') < 0, '有空物件、有貨：提醒消失');
  // 選阿澄的試聽（0 點），換人成阿澄去選我的空物件，那一微秒成交，帳房多一筆 0 點的試聽
  await H.ev("(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+14e6,1,null,t);CORE.book(S,'" + J1 + "',s.id,t);APP.changed();})()");
  await H.sheet('booked'); await H.click('[data-act="wantAdd"][data-res="r2c"]');
  assert((await H.main()).indexOf('合計 0 阿澄點') >= 0, '選了試聽 5 分鐘，合計 0');
  await H.sheet('roles'); await H.edit('input[data-ed="me"][data-id="' + J2 + '"]', null, true);
  await H.sheet('myslots'); await H.click('[data-act="wantAdd"][data-res="' + eid + '"]');
  await H.sheet('roles'); await H.edit('input[data-ed="me"][data-id="' + J1 + '"]', null, true); await H.sheet('booked'); await H.edit('input[data-ed="present"]', null, true);
  await pg.waitForFunction("APP.state().dockings.length === 1", null, { timeout: 25000 }); await pg.waitForTimeout(300);
  var dk3 = await H.ev("APP.state().dockings[0]"), left3 = await H.ev("CORE.remainingToday(APP.state(), APP.me(), APP.now())");
  assert(dk3.traded && dk3.gaveA === 0 && dk3.gaveB === 0 && dk3.itemsA[0].name === '試聽 5 分鐘' && dk3.itemsB[0].name === '空的：什麼都不給' && left3 === 1800, '空的換試聽：成交、兩邊都 0 點、每天的點沒扣');
  await H.sheet('points'); assert((await H.rows()) === 1 && (await H.main()).indexOf('試聽 5 分鐘') >= 0, '帳房多一筆 0 點的試聽');
  // 只有一邊選：看得到提醒，那一微秒不成交
  await H.ev("(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+5e6,1,null,t);CORE.book(S,'" + J1 + "',s.id,t);CORE.setWants(S,s.id,'" + J1 + "','" + J2 + "',['r2c']);APP.changed();})()");
  await H.sheet('booked'); assert((await H.main()).indexOf('他還沒選你的東西：一換一，兩邊都選了才成交') >= 0, '只有我選：看得到一換一的提醒');
  await H.edit('input[data-ed="present"]', null, true);   // 只有還沒判的那一列有到場勾
  await pg.waitForFunction("APP.state().dockings.length === 2", null, { timeout: 15000 }); await pg.waitForTimeout(300);
  assert((await H.ev("APP.state().dockings[1].traded")) === false && (await H.ev("APP.state().dockings[1].reason")) === '一換一：阿澄 沒選 我 的東西' && (await pg.textContent('#smsg')).indexOf('不成交：一換一') >= 0, '只有一邊選：那一微秒不成交，寫原因');

  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
