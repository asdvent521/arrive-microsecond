// 對照測試：DESIGN.md 7-3 每一列，在裡世界做一次、在表世界做一次，兩邊的結果（state）要一樣。
// node v7/tests/t_parity.js <test7.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003';
var DOCK_SETUP = "(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+2e6,1,100,t);CORE.book(S,'" + J1 + "',s.id,t);CORE.dock(S,s.id,'" + J1 + "',100,20,t+2e6);APP.changed();})()";
var DRAFT_SETUP = "(function(){APP.startDraft({name:'草'});})()";

var ROWS = [
  { name: '下一步：任務提示 ↔ 待辦',
    game: async function (H) { var hint = await H.pg.textContent('#task'); assert(hint.indexOf('下一步：') === 0, '裡世界任務提示：' + hint); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('todo'); var m = await H.main(); assert(m.indexOf('下一步') >= 0 && (await H.rows()) === 6, '表世界待辦六列，標出下一步'); },
    pick: "APP.steps().next.id + '|' + APP.steps().hint" },

  { name: '角色：進出空窗、換角色（角色碑 ↔ 角色）',
    game: async function (H) { await H.goNear('role'); await H.pick('進入空窗'); assert((await H.dlgBody()).indexOf('空窗') >= 0, '角色碑顯示空窗'); await H.pick('換角色'); await H.pick('J2 阿澄'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('roles'); await H.click('[data-act="vacIn"][data-id="' + J1 + '"]'); await H.edit('input[data-ed="me"][data-id="' + J2 + '"]', null, true); },
    pick: "JSON.stringify({me: APP.state().me, st: CORE.status(APP.state().roles[0], APP.now())})" },

  { name: '角色：新角色（一步一步問 ↔ 角色表最下面一列）',
    game: async function (H) {
      await H.goNear('role'); await H.pick('新角色');
      await H.setIn('wName', '小新'); await H.pick('下一步'); await H.setIn('wDaily', 500); await H.pick('下一步'); await H.setIn('wDays', 10); await H.pick('下一步');
      assert((await H.dlgTitle()).indexOf('新角色 4/5') === 0, '第四步是規則');
      await H.setIn('wUse', '1 小新點 = 唱一首歌'); await H.click('#wAddUse'); await H.pick('下一步'); await H.pick('下一步'); await H.pick('創角色');
    },
    sheet: async function (H) {
      await H.toSheet(); await H.sheet('roles'); await H.setIn('addRoleName', '小新'); await H.setIn('addRoleDaily', 500); await H.setIn('addRoleDays', 10); await H.click('[data-act="newDraft"]');
      assert((await H.sheetName()) === 'uses', '新草稿後跳到規則用途'); await H.setIn('addUse', '1 小新點 = 唱一首歌'); await H.click('[data-act="addUse"]');
      await H.sheet('roles'); await H.click('[data-act="createRole"]');
    },
    pick: "(function(){var S=APP.state(),r=S.roles[S.roles.length-1];return JSON.stringify({n:S.roles.length,me:S.me,name:r.name,daily:r.dailyPoints,days:Math.round((r.life.endUs-r.life.startUs)/CORE.DAY_US),uses:r.rules.uses,draft:S.draft});})()" },

  { name: '角色：結束並重創',
    game: async function (H) { await H.goNear('role'); await H.pick('結束並重創'); await H.pick('結束'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('roles'); await H.click('[data-act="endEarly"][data-id="' + J1 + '"]'); },
    pick: "(function(){var S=APP.state(),d=S.draft;return JSON.stringify({st:CORE.status(S.roles[0],APP.now()),prev:d&&d.prev,rules:d&&d.rules,res:d&&d.resources});})()" },

  { name: '寫規則（草稿）：規則屋 ↔ 對接條件', setup: DRAFT_SETUP,
    game: async function (H) { await H.goNear('rule'); await H.pick('寫規則（草稿）'); await H.setIn('wField', 'dockCount'); await H.setIn('wOp', '>='); await H.setIn('wVal', 2); await H.click('#wAddCond'); await H.setIn('wUse', '5 草點 = 一杯茶'); await H.click('#wAddUse'); await H.pick('存草稿'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('conds', 'draft:'); await H.setIn('addCondField', 'dockCount'); await H.setIn('addCondOp', '>='); await H.setIn('addCondValue', 2); await H.click('[data-act="addCond"]'); await H.sheet('uses', 'draft:'); await H.setIn('addUse', '5 草點 = 一杯茶'); await H.click('[data-act="addUse"]'); },
    pick: "JSON.stringify(APP.state().draft.rules)" },

  { name: '看別人的規則：J2 規則屋翻頁 ↔ 規則用途、對接條件（看誰＝J2）',
    game: async function (H) { await H.ev("GAME.teleportTo(CORE.roleOf(APP.state(),'" + J2 + "'))"); await H.goNear('rule'); await H.pick('閱讀規則'); var b1 = await H.dlgBody(); await H.pick('下一頁'); var b2 = await H.dlgBody(); assert(b1.indexOf('聽你講 1 分鐘') >= 0 && b2.indexOf('對方對接過幾次 至少 1') >= 0 && b2.indexOf('可以對接') >= 0, '裡世界翻頁看到用途、條件白話、可以對接'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('uses', J2 + ':'); var m1 = await H.main(); await H.sheet('conds'); var m2 = await H.main(); assert(m1.indexOf('聽你講 1 分鐘') >= 0 && m2.indexOf('對方對接過幾次') >= 0 && m2.indexOf('至少 1') >= 0, '表世界看誰＝J2 看到用途、條件'); },
    pick: "'read'" },

  { name: '接受村規：J3 規則屋 ↔ 我可以去找',
    game: async function (H) { await H.ev("GAME.teleportTo(CORE.roleOf(APP.state(),'" + J3 + "'))"); await H.goNear('rule'); await H.pick('接受村規'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('switches', J3 + ':'); await H.click('[data-act="accept"][data-id="' + J3 + '"]'); },
    pick: "JSON.stringify(APP.state().acceptances.map(function(a){return [a.who,a.of];}))" },

  { name: '資源：補貨（自己的市集 ↔ 資源）',
    game: async function (H) { await H.goNear('resource'); await H.pick('補貨'); await H.pick('陪跑一小時'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('resources'); await H.click('[data-act="restock"][data-id="r1a"]'); },
    pick: "JSON.stringify(APP.me().resources)" },

  { name: '資源：定義（草稿上架）', setup: DRAFT_SETUP,
    game: async function (H) { await H.goNear('resource'); await H.pick('上架（草稿）'); await H.setIn('wResName', '一杯茶'); await H.setIn('wResPrice', 30); await H.setIn('wResQty', 2); await H.click('#wAddRes'); await H.pick('存草稿'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('resources', 'draft:'); await H.setIn('addResName', '一杯茶'); await H.setIn('addResPrice', 30); await H.setIn('addResQty', 2); await H.click('[data-act="addRes"]'); },
    pick: "JSON.stringify(APP.state().draft.resources)" },

  { name: '外觀、顏色、門、位置：建造模式 ↔ 世界',
    game: async function (H) {
      await H.pg.click('#btnBuild'); await H.ev("GAME.dialog(null)");
      await H.tapScreen('rule_' + J1); assert((await H.dlgTitle()).indexOf('建造：規則屋') === 0, '建造模式點規則屋開建造對話框');
      await H.pick('換外觀'); await H.pick('塔'); await H.pick('加門');
      await H.pick('搬移'); await H.tapScreen({ x: -3, z: 1 });
      assert(JSON.stringify(await H.ev("APP.allObjs(APP.me())[0].pos")) === '[-3,1]', '點地面放下，位置變成 (-3,1)');
    },
    sheet: async function (H) { await H.toSheet(); await H.sheet('world'); var q = '[data-ed="%"][data-id="rule_' + J1 + '"]'; await H.edit(q.replace('%', 'objLook'), '塔'); await H.edit(q.replace('%', 'objDoor'), 'all'); await H.edit(q.replace('%', 'objX'), -3); await H.edit(q.replace('%', 'objZ'), 1); },
    pick: "JSON.stringify(APP.allObjs(APP.me())[0])" },

  { name: '走法：建造模式「設定走法」 ↔ 走法（繞圈）、走法（走到）',
    game: async function (H) { await H.pg.click('#btnBuild'); await H.ev("GAME.dialog(null)"); await H.tapScreen('rule_' + J1); await H.pick('設定走法'); await H.setIn('bLetter', 'H'); await H.pick('存繞圈'); await H.setIn('bTo', 'res_' + J1); await H.setIn('bDigit', '5'); await H.pick('加走到'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('circles'); await H.edit('[data-ed="circleLetter"][data-id="0"]', 'H'); await H.sheet('moves'); await H.setIn('addMoveFrom', 'rule_' + J1); await H.setIn('addMoveTo', 'res_' + J1); await H.setIn('addMoveDigit', '5'); await H.click('[data-act="addMove"]'); },
    pick: "JSON.stringify(APP.me().world.walk)" },

  { name: '查詢、查資源：地圖 ↔ 我可以去找、查資源',
    game: async function (H) { await H.pg.click('#btnMap'); H.found = await H.ev("JSON.stringify({bright:[...document.querySelectorAll('#map .node[data-go]:not(.dim)')].map(b=>b.dataset.go)})"); await H.setIn('mapKw', '書'); await H.click('#mapSearch'); var t = await H.pg.textContent('#mapRes'); H.found = H.found + '|' + (t.indexOf('借一本書') >= 0 ? '書' : '沒有'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('visit'); var ids = await H.ev("[...document.querySelectorAll('#smain tr[data-row]')].map(tr=>tr.dataset.id)"); await H.sheet('come'); ids = ids.concat(await H.ev("[...document.querySelectorAll('#smain tr[data-row]')].map(tr=>tr.dataset.id)"));
      // 地圖的「亮」＝一方通；表世界是「我可以去找」＋「可能來找我」兩張表裡「能對接嗎」通的人
      H.found = await H.ev("JSON.stringify({bright:" + JSON.stringify(ids) + ".filter(function(id,i,a){return a.indexOf(id)===i && CORE.eligible(APP.state(),CORE.roleOf(APP.state(),id),APP.me(),APP.now()).ok;}).map(CORE.abbrev)})"); await H.sheet('search'); await H.setIn('kwIn', '書'); await H.click('[data-act="search"]'); H.found = H.found + '|' + ((await H.main()).indexOf('借一本書') >= 0 ? '書' : '沒有'); },
    pick: "window.__H_found" , useFound: true },

  { name: '去對方那裡：走代號 J2、傳送門 ↔ 點代號',
    game: async function (H) {
      await H.ev("WORLD.circleAround('rule_" + J1 + "')"); await H.pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 15000 });
      await H.walkTo(0, 7); await H.pg.waitForFunction("GAME.dec().letter === 'J'", null, { timeout: 8000 });
      await H.walkTo(0, -4.3); await H.pg.waitForFunction("GAME.dec().lastAt === 'role_" + J1 + "'", null, { timeout: 15000 });
      await H.walkTo(6, 3.2); await H.pg.waitForFunction("GAME.dec().done === 'J2'", null, { timeout: 8000 });
      assert((await H.pg.textContent('#toast')).indexOf('傳送門') >= 0, '走出 J2，傳送門打開');
      await H.ev("GAME.enterPortal()"); await H.pg.waitForTimeout(300);
      assert((await H.pg.textContent('#plateName')).indexOf('阿澄') >= 0, '名牌顯示在阿澄的世界');
      H.found = await H.ev("GAME.cur().role.serial");
    },
    sheet: async function (H) { await H.toSheet(); await H.sheet('visit'); await H.sheet('come'); await H.clickText('J2 阿澄'); assert((await H.sheetName()) === 'roles', '點代號跳到角色表'); H.found = await H.ev("document.querySelector('#smain tr.flash').dataset.id"); },
    pick: "window.__H_found", useFound: true },

  { name: '開時段：自己的終點台 ↔ 我開的時段',
    game: async function (H) { await H.goNear('goal'); await H.pick('開時段'); await H.setIn('gSlotMin', 4); await H.setIn('gSlotCap', 2); await H.setIn('gSlotGive', 70); await H.pick('開'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('myslots'); await H.setIn('addSlotMin', 4); await H.setIn('addSlotCap', 2); await H.setIn('addSlotGive', 70); await H.click('[data-act="addSlot"]'); },
    pick: "JSON.stringify(APP.me().slots.map(function(s){return {cap:s.capacity,give:s.give,min:Math.round((s.atUs-APP.now())/60e6)};}))" },

  { name: '拒絕（空窗、做不到對方的要求）：看預約 ↔ 我開的時段',
    setup: "(function(){var S=APP.state(),t=APP.now();CORE.book(S,'" + J2 + "',S.roles[0].slots[0].id,t);CORE.enterVacancy(S,'" + J1 + "',t);APP.changed();})()",
    game: async function (H) { await H.goNear('goal'); await H.pick('看預約'); await H.pick('拒絕 阿澄'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('myslots'); await H.click('[data-act="refuse"]'); },
    pick: "JSON.stringify({b:APP.me().slots[0].bookings,r:APP.me().slots[0].refused,rec:APP.state().records.length})" },

  { name: '預約：對方的終點台 ↔ 可預約時段',
    game: async function (H) { await H.ev("GAME.teleportTo(CORE.roleOf(APP.state(),'" + J2 + "'))"); await H.goNear('goal'); await H.pick('時刻表'); var o = await H.opts(); await H.pick(o[0].slice(0, 8)); assert((await H.opts())[0].indexOf('已預約') > 0, '時刻表上標已預約'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('open'); await H.click('[data-act="book"]'); assert((await H.sheetName()) === 'booked', '預約後跳到我預約的'); },
    pick: "JSON.stringify(APP.state().roles[1].slots.map(function(s){return s.bookings;}))" },

  { name: '對接、給點：站在終點＋交換滑桿 ↔ 「到場」＋給點欄',
    setup: "(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+16e6,1,100,t);CORE.book(S,'" + J1 + "',s.id,t);APP.changed();})()",
    game: async function (H) {
      await H.ev("GAME.teleportTo(CORE.roleOf(APP.state(),'" + J2 + "'))"); await H.goNear('goal');
      await H.pg.waitForFunction("document.getElementById('dlgTitle').textContent.indexOf('交換') === 0", null, { timeout: 10000 });
      await H.setIn('giveRange', 30); await H.pick('確定');
      var before = await H.ev("parseFloat(document.getElementById('energyBar').style.width)");
      await H.pg.waitForFunction("APP.state().dockings.length === 1", null, { timeout: 25000 });
      await H.pg.waitForTimeout(300);
      var after = await H.ev("parseFloat(document.getElementById('energyBar').style.width)");
      assert(after < before, '能量條往下降：' + before + ' → ' + after);
      assert((await H.dlgTitle()) === '到達那微秒', '對接成立的對話框');
    },
    sheet: async function (H) {
      await H.toSheet(); await H.sheet('booked'); await H.edit('input[data-ed="give"]', 30); await H.edit('input[data-ed="present"]', null, true);
      await H.pg.waitForFunction("APP.state().dockings.length === 1", null, { timeout: 25000 }); await H.pg.waitForTimeout(300);
      assert((await H.main()).indexOf('已對接') >= 0, '我預約的標已對接');
    },
    pick: "JSON.stringify({d:APP.state().dockings.map(function(x){return {a:x.a,b:x.b,ga:x.gaveA,gb:x.gaveB,how:x.how};}),left:CORE.remainingToday(APP.state(),APP.me(),APP.now())})" },

  { name: '點數：帳房 ↔ 點數', setup: DOCK_SETUP,
    game: async function (H) { await H.goNear('points'); var b = await H.dlgBody(); assert(b.indexOf('阿澄點 100') >= 0 && b.indexOf('可兌現') >= 0, '帳房顯示手上的阿澄點'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('points'); var m = await H.main(); assert(m.indexOf('阿澄') >= 0 && m.indexOf('100') >= 0 && (await H.rows()) === 1, '點數表一列阿澄點'); },
    pick: "JSON.stringify(CORE.holdings(APP.state(),APP.me().serial,APP.now()).map(function(h){return [h.issuer.serial,h.amount,h.status];}))" },

  { name: '兌現：對方的市集 ↔ 兌現', setup: DOCK_SETUP,
    game: async function (H) { await H.ev("GAME.teleportTo(CORE.roleOf(APP.state(),'" + J2 + "'))"); await H.goNear('resource'); await H.pick('看商店'); await H.pick('改履歷'); assert((await H.dlgBody()).indexOf('你有 0 阿澄點') >= 0, '換完剩 0 阿澄點'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('redeem', J2 + ':'); await H.click('[data-act="redeem"][data-id="r2a"]'); },
    pick: "JSON.stringify({q:APP.state().roles[1].resources.map(function(x){return x.qty;}),bal:CORE.balance(APP.state(),'" + J1 + "','" + J2 + "',APP.now()),n:APP.state().redeems.length})" },

  { name: '紀錄：角色碑的歷史 ↔ 對接紀錄、紀錄', setup: DOCK_SETUP,
    game: async function (H) { await H.goNear('role'); await H.pick('歷史紀錄'); assert((await H.dlgBody()).indexOf('對接 1 次') >= 0, '歷史：對接 1 次'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('dockings'); assert((await H.rows()) === 1, '對接紀錄一列'); await H.sheet('records'); assert((await H.rows()) === (await H.ev("APP.state().records.length + APP.state().redeems.length")), '紀錄列數＝紀錄＋兌現'); },
    pick: "JSON.stringify({d:APP.state().dockings.length,r:APP.state().records.length})" }
];

(async function () {
  var H = await lib.open(process.argv[2]);
  for (var i = 0; i < ROWS.length; i++) {
    var row = ROWS[i], got = {};
    for (var side of ['game', 'sheet']) {
      await H.fresh(); H.found = null;
      if (row.setup) await H.ev(row.setup);
      try { await row[side](H); } catch (e) { assert(false, row.name + '（' + side + '）出錯：' + e.message); got[side] = 'ERR'; continue; }
      await H.pg.waitForTimeout(150);
      got[side] = row.useFound ? H.found : await H.ev(row.pick);
    }
    assert(got.game != null && got.game === got.sheet, (i + 1) + '. ' + row.name + ' 兩邊結果一樣' + (got.game === got.sheet ? '' : '\n  裡：' + got.game + '\n  表：' + got.sheet));
  }
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close();
  console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
