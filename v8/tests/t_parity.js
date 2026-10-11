// 對照測試：DESIGN.md 7-3（v8）每一列，在裡世界做一次、在表世界做一次，兩邊的結果（state）要一樣。
// node v8/tests/t_parity.js <test8.html>
var lib = require('./lib'), assert = lib.assert, T = require('./tut');
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003';
// 先對接一次：J1 保留了 J2 的改履歷（100 阿澄點）
var DOCK_SETUP = "(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+2e6,1,null,t);CORE.book(S,'" + J1 + "',s.id,t);CORE.setWants(S,s.id,'" + J1 + "','" + J2 + "',['r2a']);CORE.setWants(S,s.id,'" + J2 + "','" + J1 + "',['r1b']);CORE.setPresent(S,'" + J1 + "',s.id,true);CORE.judge(S,t+2e6,{});APP.changed();})()";
var ROWS = [
  { name: '下一步：任務提示 ↔ 待辦',
    game: async function (H) { var hint = await H.pg.textContent('#task'); assert(hint.indexOf('下一步：') === 0, '裡世界任務提示：' + hint); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('todo'); var m = await H.main(); assert(m.indexOf('下一步') >= 0 && (await H.rows()) === 6, '表世界待辦六列，標出下一步'); },
    pick: "APP.steps().next.id + '|' + APP.steps().hint" },

  { name: '改每天的點（明天起）：角色碑 ↔ 角色',
    game: async function (H) { await H.goNear('role'); await H.pick('改每天的點（明天起）'); await H.setIn('wDaily', 2500); await H.pick('存'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('roles'); await H.edit('input[data-ed="daily"][data-id="' + J1 + '"]', 2500); },
    pick: "JSON.stringify({today: CORE.dailyPoints(APP.me(), APP.now()), tmr: CORE.pending(APP.me(), APP.now()).dailyPoints, from: CORE.pending(APP.me(), APP.now()).fromDay - CORE.dayNum(APP.now())})" },

  { name: '不玩了：角色碑 ↔ 角色', setup: DOCK_SETUP,
    game: async function (H) { await H.goNear('role'); await H.pick('不玩了'); assert((await H.dlgBody()).indexOf('還有 1 筆你的點沒換') >= 0 && (await H.dlgBody()).indexOf('會作廢') >= 0, '確認框寫清楚會作廢幾筆'); await H.pick('確定不玩了'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('roles'); await H.click('[data-act="quit"][data-id="' + J1 + '"]'); },
    pick: "JSON.stringify({n: APP.state().roles.length, me: APP.me().serial, holds: APP.state().holds.map(function (h) { return h.status; }), rec: APP.state().records.filter(function (r) { return r.kind === 'quit'; }).length})" },

  { name: '換人（測試用）：角色碑 ↔ 角色',
    game: async function (H) { await H.goNear('role'); await H.pick('換人（測試用）'); await H.pick('J2 阿澄'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('roles'); await H.edit('input[data-ed="me"][data-id="' + J2 + '"]', null, true); },
    pick: "String(APP.state().me)" },

  { name: '改規則（明天起）：規則屋 ↔ 規則用途、對接條件',
    game: async function (H) { await H.goNear('rule'); await H.pick('改規則（明天起）'); await H.setIn('wUse', '5 我點 = 一杯茶'); await H.click('#wAddUse'); await H.setIn('wField', 'dockCount'); await H.setIn('wOp', '>='); await H.setIn('wVal', 2); await H.click('#wAddCond'); await H.pick('存'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('uses'); await H.setIn('addUse', '5 我點 = 一杯茶'); await H.click('[data-act="addUse"]'); await H.sheet('conds'); await H.setIn('addCondField', 'dockCount'); await H.setIn('addCondOp', '>='); await H.setIn('addCondValue', 2); await H.click('[data-act="addCond"]'); assert((await H.main()).indexOf('明天起') >= 0, '表裡標「明天起」'); },
    pick: "JSON.stringify({today: CORE.version(APP.me(), APP.now()).rules, tmr: CORE.pending(APP.me(), APP.now()).rules})" },

  { name: '看別人的規則：J2 規則屋翻頁 ↔ 規則用途、對接條件（看誰＝J2）',
    game: async function (H) { await H.ev("GAME.teleportTo(CORE.roleOf(APP.state(),'" + J2 + "'))"); await H.goNear('rule'); await H.pick('閱讀規則'); var b1 = await H.dlgBody(); await H.pick('下一頁'); var b2 = await H.dlgBody(); assert(b1.indexOf('聽你講 1 分鐘') >= 0 && b2.indexOf('對方可換的貨（全部加起來） 至少 5份') >= 0 && b2.indexOf('可以對接') >= 0, '裡世界翻頁看到用途、條件白話、可以對接'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('uses', J2 + ':'); var m1 = await H.main(); await H.sheet('conds'); var m2 = await H.main(); assert(m1.indexOf('聽你講 1 分鐘') >= 0 && m2.indexOf('對方可換的貨') >= 0 && m2.indexOf('至少 5') >= 0, '表世界看誰＝J2 看到用途、條件'); },
    pick: "'read'" },

  { name: '接受村規：J3 規則屋 ↔ 開關與村規',
    game: async function (H) { await H.ev("GAME.teleportTo(CORE.roleOf(APP.state(),'" + J3 + "'))"); await H.goNear('rule'); await H.pick('接受村規'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('switches', J3 + ':'); await H.click('[data-act="accept"][data-id="' + J3 + '"]'); },
    pick: "JSON.stringify(APP.state().acceptances.map(function(a){return [a.who,a.of];}))" },

  { name: '定義資源（明天起）：自己的市集 ↔ 資源',
    game: async function (H) { await H.goNear('resource'); await H.pick('上架、改價格（明天起）'); await H.setIn('wResName', '一杯茶'); await H.setIn('wResPrice', 30); await H.setIn('wResKeep', 3); await H.click('#wAddRes'); await H.pick('存'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('resources'); await H.setIn('addResName', '一杯茶'); await H.setIn('addResPrice', 30); await H.setIn('addResKeep', 3); await H.click('[data-act="addRes"]'); },
    pick: "JSON.stringify({today: CORE.version(APP.me(), APP.now()).resources.length, tmr: CORE.pending(APP.me(), APP.now()).resources.map(function (x) { return [x.name, x.price, x.keepDays]; })})" },

  { name: '改價錢和保留天數（明天起）：自己的市集 ↔ 資源',
    game: async function (H) { await H.goNear('resource'); await H.pick('上架、改價格（明天起）'); await H.edit('[data-rp="0"]', 70); await H.edit('[data-rk="0"]', 10); await H.pick('存'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('resources'); await H.edit('[data-ed="resPrice"][data-id="r1a"]', 70); await H.edit('[data-ed="resKeep"][data-id="r1a"]', 10); },
    pick: "JSON.stringify({today: CORE.resourceOf(CORE.version(APP.me(), APP.now()), 'r1a').price, tmr: CORE.resourceOf(CORE.pending(APP.me(), APP.now()), 'r1a')})" },

  { name: '補貨和減貨（馬上）：自己的市集 ↔ 資源',
    game: async function (H) { await H.goNear('resource'); await H.pick('補貨、減貨'); await H.click('[data-stock-add="r1a"]'); await H.edit('[data-stock-n="r1b"]', 3); await H.click('[data-stock-sub="r1b"]'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('resources'); await H.click('[data-act="stock"][data-id="r1a"][data-n="1"]'); await H.setIn('stockN_r1b', 3); await H.click('[data-act="stock"][data-id="r1b"][data-n="-1"]'); },
    pick: "JSON.stringify(APP.me().stock)" },

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

  { name: '查詢、查資源：地圖 ↔ 我可以去找、可能來找我、查資源',
    game: async function (H) { await H.pg.click('#btnMap'); H.found = await H.ev("JSON.stringify({bright:[...document.querySelectorAll('#map .node[data-go]:not(.dim)')].map(b=>b.dataset.go)})"); await H.setIn('mapKw', '書'); await H.click('#mapSearch'); var t = await H.pg.textContent('#mapRes'); H.found = H.found + '|' + (t.indexOf('借一本書') >= 0 ? '書' : '沒有'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('visit'); var ids = await H.ev("[...document.querySelectorAll('#smain tr[data-row]')].map(tr=>tr.dataset.id)"); await H.sheet('come'); ids = ids.concat(await H.ev("[...document.querySelectorAll('#smain tr[data-row]')].map(tr=>tr.dataset.id)"));
      H.found = await H.ev("JSON.stringify({bright:" + JSON.stringify(ids) + ".filter(function(id,i,a){return a.indexOf(id)===i && CORE.eligible(APP.state(),CORE.roleOf(APP.state(),id),APP.me(),APP.now()).ok;}).map(CORE.abbrev)})"); await H.sheet('search'); await H.setIn('kwIn', '書'); await H.click('[data-act="search"]'); H.found = H.found + '|' + ((await H.main()).indexOf('借一本書') >= 0 ? '書' : '沒有'); },
    pick: "window.__H_found", useFound: true },

  { name: '去對方那裡：走代號 J2、傳送門 ↔ 點代號',
    game: async function (H) {
      await H.tapAndWatch('rule_' + J1); await H.pick('繞一圈（J）'); await H.pg.waitForFunction("GAME.dec().letter === 'J'", null, { timeout: 20000 }); await H.walkDone();
      await H.tapAndWatch('role_' + J1); await H.tapAndWatch('res_' + J1); await H.pg.waitForFunction("GAME.dec().done === 'J2'", null, { timeout: 15000 });
      assert((await H.pg.textContent('#toast')).indexOf('傳送門') >= 0, '走出 J2，傳送門打開');
      await H.click('#hintEnter'); await H.pg.waitForTimeout(300);
      assert((await H.pg.textContent('#plateName')).indexOf('阿澄') >= 0, '名牌顯示在阿澄的世界');
      H.found = await H.ev("GAME.cur().role.serial");
    },
    sheet: async function (H) { await H.toSheet(); await H.sheet('visit'); await H.sheet('come'); await H.clickText('J2 阿澄'); assert((await H.sheetName()) === 'roles', '點代號跳到角色表'); H.found = await H.ev("document.querySelector('#smain tr.flash').dataset.id"); },
    pick: "window.__H_found", useFound: true },

  { name: '開時段：自己的終點台 ↔ 我開的時段',
    game: async function (H) { await H.goNear('goal'); await H.pick('開時段'); await H.setIn('gSlotMin', 4); await H.setIn('gSlotCap', 2); await H.setIn('gSlotMax', 70); await H.pick('開'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('myslots'); await H.setIn('addSlotMin', 4); await H.setIn('addSlotCap', 2); await H.setIn('addSlotMax', 70); await H.click('[data-act="addSlot"]'); },
    pick: "JSON.stringify(APP.me().slots.map(function(s){return {cap:s.capacity,max:s.maxGive,min:Math.round((s.atUs-APP.now())/60e6)};}))" },

  { name: '預約：對方的終點台 ↔ 可預約時段',
    game: async function (H) { await H.ev("GAME.teleportTo(CORE.roleOf(APP.state(),'" + J2 + "'))"); await H.goNear('goal'); await H.pick('時刻表'); var o = await H.opts(); await H.pick(o[0].slice(0, 8)); assert((await H.dlgTitle()).indexOf('我要 阿澄 的什麼') === 0, '預約後接著選要換他的什麼'); await H.pick('存好'); assert((await H.opts())[0].indexOf('已預約') > 0, '時刻表上標已預約'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('open'); await H.click('[data-act="book"]'); assert((await H.sheetName()) === 'booked', '預約後跳到我預約的'); },
    pick: "JSON.stringify(APP.state().roles[1].slots.map(function(s){return s.bookings;}))" },

  { name: '選東西、每人最多給多少、對接：終點台＋交換對話框 ↔ 「到場」、我要的、最多給',
    setup: "(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+22e6,1,null,t);CORE.book(S,'" + J1 + "',s.id,t);CORE.setWants(S,s.id,'" + J2 + "','" + J1 + "',['r1a']);APP.changed();})()",
    game: async function (H) {
      await H.ev("GAME.teleportTo(CORE.roleOf(APP.state(),'" + J2 + "'))"); await H.goNear('goal'); await H.click('#dlgClose');   // 關掉終點台的對話框，交換對話框才升起
      await H.pg.waitForFunction("document.getElementById('dlgTitle').textContent.indexOf('交換') === 0", null, { timeout: 12000 });
      await H.click('[data-pick="' + J2 + '"]'); await H.click('[data-want-add="r2a"]'); await H.pick('存好');
      await H.pg.waitForFunction("document.getElementById('dlgTitle').textContent.indexOf('交換') === 0", null, { timeout: 5000 });
      await H.edit('#maxGive', 500); await H.pick('確定');
      var before = await H.ev("parseFloat(document.getElementById('energyBar').style.width)");
      await H.pg.waitForFunction("APP.state().dockings.length === 1", null, { timeout: 30000 }); await H.pg.waitForTimeout(300);
      assert((await H.ev("parseFloat(document.getElementById('energyBar').style.width)")) < before, '能量條往下降');
      assert((await H.dlgTitle()) === '到達那微秒' && (await H.dlgBody()).indexOf('我拿出：陪跑一小時（60 點）；拿到：阿澄的改履歷（100 點）') >= 0, '互換成立的對話框以東西為主');
    },
    sheet: async function (H) {
      await H.toSheet(); await H.sheet('booked'); await H.click('[data-act="wantAdd"][data-res="r2a"]'); await H.edit('input[data-ed="maxGive"]', 500); await H.edit('input[data-ed="present"]', null, true);
      await H.pg.waitForFunction("APP.state().dockings.length === 1", null, { timeout: 30000 }); await H.pg.waitForTimeout(300);
      assert((await H.main()).indexOf('已對接') >= 0, '我預約的標已對接');
    },
    pick: "JSON.stringify({d:APP.state().dockings.map(function(x){return {a:x.a,b:x.b,ga:x.gaveA,gb:x.gaveB,ia:x.itemsA.map(function(i){return i.name;}),ib:x.itemsB.map(function(i){return i.name;}),fa:x.failA,fb:x.failB};}),left:CORE.remainingToday(APP.state(),APP.me(),APP.now()),holds:APP.state().holds.map(function(h){return [h.issuer,h.holder,h.name,h.price,h.status];})})" },

  { name: '點數：帳房 ↔ 點數', setup: DOCK_SETUP,
    game: async function (H) { await H.goNear('points'); var b = await H.dlgBody(); assert(b.indexOf('阿澄點 100') >= 0 && b.indexOf('改履歷') >= 0 && b.indexOf('保留到') >= 0, '帳房顯示保留的那一筆：誰的點、什麼東西、保留到哪天'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('points'); var m = await H.main(); assert(m.indexOf('阿澄') >= 0 && m.indexOf('改履歷') >= 0 && m.indexOf('100') >= 0 && (await H.rows()) === 1, '點數表一列保留'); },
    pick: "JSON.stringify(CORE.holdings(APP.state(),APP.me().serial,APP.now()).map(function(g){return [g.issuer.serial,g.hold.name,g.hold.price,g.until];}))" },   // J2 拿到的早餐在 J2 的帳上，不在這裡

  { name: '兌現：對方的市集 ↔ 兌現', setup: DOCK_SETUP,
    game: async function (H) { await H.ev("GAME.teleportTo(CORE.roleOf(APP.state(),'" + J2 + "'))"); await H.goNear('resource'); await H.pick('看商店'); await H.pick('兌現「改履歷」'); assert((await H.dlgBody()).indexOf('你保留著 0 筆') >= 0, '換完沒有保留了'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('redeem', J2 + ':'); await H.click('[data-act="redeem"]'); },
    pick: "JSON.stringify({h:APP.state().holds.map(function(h){return h.status;}),stock:APP.state().roles[1].stock,n:APP.state().redeems.length})" },

  { name: '紀錄、換點比例：角色碑的歷史 ↔ 對接紀錄、紀錄', setup: DOCK_SETUP,
    game: async function (H) { await H.goNear('role'); var b = await H.dlgBody(); assert(b.indexOf('換點比例') >= 0 && b.indexOf('100：100') >= 0, '角色碑顯示換點比例'); await H.pick('歷史紀錄'); assert((await H.dlgBody()).indexOf('對接 1 次') >= 0, '歷史：對接 1 次'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('dockings'); assert((await H.rows()) === 1 && (await H.main()).indexOf('改履歷') >= 0, '對接紀錄一列，寫了選了什麼'); await H.sheet('roles'); assert((await H.main()).indexOf('100：100') >= 0, '角色表的換點比例'); await H.sheet('records'); assert((await H.rows()) === (await H.ev("APP.state().records.length + APP.state().redeems.length")), '紀錄列數＝紀錄＋兌現'); },
    pick: "JSON.stringify({d:APP.state().dockings.length,r:APP.state().records.length,ratio:CORE.ratio(APP.state(),APP.me().serial).text})" },

  { name: '確認到場：對方終點台的時刻表 ↔ 我預約的「到場」', setup: "(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+120e6,1,null,t);CORE.book(S,'" + J1 + "',s.id,t);APP.changed();})()",
    game: async function (H) { await H.ev("GAME.teleportTo(CORE.roleOf(APP.state(),'" + J2 + "'))"); await H.goNear('goal'); await H.pick('時刻表'); await H.pick('確認到場'); assert((await H.opts()).some(function (o) { return o.indexOf('取消到場') === 0; }) && (await H.opts()).some(function (o) { return o.indexOf('已確認到場') > 0; }), '時刻表標已確認、可以取消'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('booked'); assert((await H.main()).indexOf('勾了就算，不用守著') >= 0, '表世界寫勾了就算'); await H.edit('input[data-ed="present"]', null, true); },
    pick: "JSON.stringify(APP.state().roles[1].slots.map(function(s){return [s.bookings,s.confirmed];}))" },

  { name: '一起成交：終點台開時段勾「一起成交」、刪沒人預約的時段 ↔ 我開的時段',
    game: async function (H) { await H.goNear('goal'); await H.pick('開時段'); await H.setIn('gSlotMin', 4); await H.setIn('gSlotCap', 3); await H.edit('#gSlotTogether', null, true); await H.pick('開'); await H.goNear('goal'); await H.pick('看預約、選我要的'); assert((await H.dlgBody()).indexOf('【一起成交】') >= 0, '裡世界標【一起成交】'); await H.finger("function(){ return [...document.querySelectorAll('#dlgOpts button')].find(function (b) { return b.textContent.indexOf('刪 ') === 0; }); }", '刪時段'); },
    sheet: async function (H) { await H.toSheet(); await H.sheet('myslots'); await H.setIn('addSlotMin', 4); await H.setIn('addSlotCap', 3); await H.edit('#addSlotTogether', null, true); await H.click('[data-act="addSlot"]'); assert((await H.main()).indexOf('一起成交') >= 0, '表世界標「一起成交」'); await H.click('tbody tr[data-row]:first-child [data-act="delSlot"]'); },
    pick: "JSON.stringify(APP.me().slots.map(function(s){return [s.capacity,s.together,Math.round((s.atUs-APP.now())/60e6)];}))" },

  { name: '新手教學：創角色 → 找引路人 → 預約選空的 → 那一微秒 → 帳房／點數 → 兌現 → 不要 → 對照', raw: true,
    game: async function (H) { await T.G.full(H, '小明'); await T.G.ask(H, false); await T.Sh.compare(H); },
    sheet: async function (H) { await T.Sh.full(H, '小明'); await T.Sh.ask(H, false); await T.G.compare(H); },
    pick: "JSON.stringify({me:APP.me().serial,name:APP.me().name,tut:[APP.tut().step,APP.tut().round,APP.tut().choice,APP.tut().skipped],d:APP.state().dockings.map(function(d){return [d.a,d.b,d.traded,d.tutorial,d.gaveA,d.gaveB,d.itemsA.map(function(i){return i.name;}),d.itemsB.map(function(i){return i.name;})];}),h:APP.state().holds.map(function(h){return [h.issuer,h.holder,h.status,h.price];}),n:CORE.dockCount(APP.state(),APP.me().serial),ratio:CORE.ratio(APP.state(),APP.me().serial).text,rec:APP.state().records.map(function(r){return r.text.slice(0,4);}),rd:APP.state().redeems.length,empty:CORE.version(APP.me(),APP.now()).resources.map(function(x){return [x.name,x.price,CORE.stockOf(APP.me(),x.id).avail];})})" }
];

(async function () {
  var H = await lib.open(process.argv[2]);
  for (var i = 0; i < ROWS.length; i++) {
    var row = ROWS[i], got = {};
    for (var side of ['game', 'sheet']) {
      await H.fresh({ raw: !!row.raw }); H.found = null;
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
