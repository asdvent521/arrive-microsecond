// 新手教學的走法（t_tutorial.js、t_parity.js 共用）：裡世界一套、表世界一套，每一步都用手指點。
var assert = require('./lib').assert;
var J1 = '00000000001', J4 = '00000000004';
var STEP = function (H) { return H.ev("APP.tut().step"); };
var waitStep = async function (H, k) { await H.pg.waitForFunction("APP.tut().step === " + JSON.stringify(k), null, { timeout: 15000 }); };
// 引路人的時段大約一分鐘後：測試把它縮到 3 秒後（資料層直接改）
var shorten = function (H) { return H.ev("(function(){var S=APP.state(),x=CORE.slotOf(S,APP.tut().slot);x.slot.atUs=APP.now()+3e6;APP.changed();})()"); };
var emptyId = function (H) { return H.ev("CORE.version(APP.me(),APP.now()).resources.find(function(x){return x.price===0;}).id"); };

var G = {
  create: async function (H, name) {
    assert((await H.dlgTitle()) === '創角色' && (await H.ev("document.getElementById('cDaily').value")) === '2000' && (await H.ev("document.getElementById('cItem').value + '/' + document.getElementById('cPrice').value + '/' + document.getElementById('cQty').value")) === '空的/0/1', '裡世界一開就是創角色：每天的點預設 2000，第一樣東西「空的」0 點 1 份');
    await H.setIn('cName', name); await H.pick('建立'); await waitStep(H, 2);
    assert((await H.ev("APP.me().serial")) === J1 && (await H.ev("APP.me().name")) === name && (await emptyId(H)) && (await H.pg.textContent('#task')).indexOf('教學 ② 找引路人') === 0, '按「建立」當下生效：J1、有 0 點的「空的」，提示到第 ② 步');
  },
  restock: async function (H) {   // 第二輪第 1 步：補 1 份空的
    assert((await H.pg.textContent('#task')).indexOf('教學 ① 補 1 份空的') === 0, '第二輪從「補 1 份空的」開始');
    await H.goNear('resource'); await H.pick('補貨、減貨'); await H.click('[data-stock-add="' + (await emptyId(H)) + '"]'); await waitStep(H, 2); await H.ev("GAME.dialog(null)");
  },
  find: async function (H) {
    var pg = H.pg;
    await pg.click('#btnMap'); await H.click('#map .node[data-go="J4"]');
    assert((await H.ev("WORLD.guideCount()")) > 1, '地圖點引路人 J4，地上亮出光點');
    await H.tapAndWatch('rule_' + J1); await H.click('#hintCircle'); await pg.waitForFunction("GAME.dec().letter === 'J'", null, { timeout: 20000 }); await H.walkDone();
    await H.tapAndWatch('pts_' + J1);
    assert((await H.ev("GAME.dec().done")) === 'J4', '繞規則屋一圈、走到帳房＝J4，傳送門打開');
    await H.click('#hintEnter'); await waitStep(H, 3);
    assert((await pg.textContent('#plateName')).indexOf('在 引路人 的世界') >= 0 && (await pg.textContent('#task')).indexOf('教學 ③') === 0, '進傳送門到了引路人的世界，提示到第 ③ 步');
  },
  book: async function (H) {
    var pg = H.pg;
    await pg.waitForFunction("APP.tut().slot !== null", null, { timeout: 5000 });
    await H.goNear('goal'); await H.pick('時刻表');
    assert((await H.opts()).some(function (o) { return o.indexOf('預約') > 0; }), '引路人開了一個時段');
    await H.finger("function(){ return [...document.querySelectorAll('#dlgOpts button')].find(function (b) { return b.textContent.indexOf('預約') > 0; }); }", '時段');
    assert((await H.dlgTitle()) === '我要 引路人 的什麼？', '預約後選要他的什麼');
    await H.click('[data-want-add="r4e"]'); await H.pick('存好'); await waitStep(H, 4);
    assert((await H.ev("JSON.stringify(CORE.wantsValid(APP.state(),CORE.slotOf(APP.state(),APP.tut().slot).slot,'" + J4 + "','" + J1 + "'))")) === JSON.stringify([await emptyId(H)]), '引路人自動選了我的「空的」');
  },
  dock: async function (H) {
    var pg = H.pg;
    await shorten(H);
    await pg.waitForFunction("document.getElementById('dlgTitle').textContent === '到達那微秒'", null, { timeout: 20000 });
    var b = await H.dlgBody();
    assert(b.indexOf('我拿出：空的（0 點）；拿到：引路人的空的（0 點）') >= 0, '站在終點台上，那一微秒：我拿出空的，拿到引路人的空的');
    await H.pick('好'); await waitStep(H, 5);
  },
  see: async function (H) {
    await H.pg.click('#btnHome'); await H.pg.waitForTimeout(300);
    await H.goNear('points'); assert((await H.dlgTitle()).indexOf('背包') === 0 && (await H.dlgBody()).indexOf('引路人點 0　「空的」') >= 0, '帳房：拿到引路人的「空的」');
    await waitStep(H, 6);
    await H.pick('去 引路人 的市集兌現'); await H.pick('兌現「空的」');
  },
  ask: async function (H, yes) {
    await H.pg.waitForFunction("document.getElementById('dlgTitle').textContent === '教學走完了'", null, { timeout: 5000 });
    assert((await H.dlgBody()).indexOf('要不要用另一種介面再走一次') >= 0, '走完問：要不要用另一種介面再走一次？');
    await H.pick(yes ? '要' : '不要'); await H.pg.waitForTimeout(400);
  },
  compare: async function (H) {   // 在裡世界帶看對照（表世界走完選「不要」）
    var pg = H.pg;
    await pg.waitForFunction("document.getElementById('dlgTitle').textContent.indexOf('對照 ①') === 0", null, { timeout: 5000 });
    var seen = [];
    for (var i = 0; i < 4; i++) { seen.push(await H.dlgBody()); var o = await H.opts(); await H.pick(o[0].indexOf('看完') === 0 ? '看完' : '下一個'); await pg.waitForTimeout(300); }
    assert(seen[1].indexOf('「點數」') >= 0 && seen[1].indexOf('帳房') >= 0 && seen[2].indexOf('市集') >= 0, '裡世界的對照：點數＝帳房、兌現＝引路人的市集');
    assert((await H.ev("APP.view()")) === 'sheet' && (await STEP(H)) === 'done', '看完切回表世界，教學結束');
  },
  full: async function (H, name) { await G.create(H, name); await G.find(H); await G.book(H); await G.dock(H); await G.see(H); }
};
var Sh = {
  create: async function (H, name) {
    await H.toSheet(); await H.sheet('roles');
    assert((await H.ev("document.getElementById('sDaily').value")) === '2000' && (await H.ev("document.getElementById('sItem').value + '/' + document.getElementById('sPrice').value + '/' + document.getElementById('sQty').value")) === '空的/0/1', '表世界角色表最下面一列是創角色：每天 2000、「空的」0 點 1 份');
    await H.setIn('sName', name); await H.click('[data-act="createMe"]'); await waitStep(H, 2);
    assert((await H.ev("APP.me().serial")) === J1 && (await H.sheetName()) === 'todo' && (await H.main()).indexOf('② 找引路人') >= 0 && (await H.main()).indexOf('我可以去找') >= 0, '建立後跳到待辦，第 ② 步講表世界的做法');
  },
  restock: async function (H) {
    await H.sheet('todo'); assert((await H.main()).indexOf('① 補 1 份空的') >= 0, '第二輪從「補 1 份空的」開始');
    await H.sheet('resources'); await H.click('[data-act="stock"][data-n="1"][data-id="' + (await emptyId(H)) + '"]'); await waitStep(H, 2);
  },
  find: async function (H) {
    await H.sheet('visit'); assert((await H.main()).indexOf('引路人') >= 0, '「我可以去找」有引路人');
    await H.click('[data-act="jump"][data-s="roles"][data-id="' + J4 + '"]'); await waitStep(H, 3);
  },
  book: async function (H) {
    await H.pg.waitForFunction("APP.tut().slot !== null", null, { timeout: 5000 });
    var slot = await H.ev("APP.tut().slot");
    await H.sheet('open'); await H.click('[data-act="book"][data-id="' + slot + '"]');
    assert((await H.sheetName()) === 'booked', '預約引路人後跳到「我預約的」');
    await H.click('[data-act="wantAdd"][data-res="r4e"][data-slot="' + slot + '"]'); await waitStep(H, 4);
  },
  dock: async function (H) {
    var slot = await H.ev("APP.tut().slot");
    await shorten(H); await H.sheet('booked'); await H.edit('input[data-ed="present"][data-id="' + slot + '"]', null, true);
    await waitStep(H, 5);
    assert((await H.main()).indexOf('我拿出 空的（0 點）；拿到 引路人的 空的（0 點）') >= 0, '勾到場，那一微秒：我拿出空的，拿到引路人的空的');
  },
  see: async function (H) {
    await H.sheet('points'); await waitStep(H, 6); assert((await H.main()).indexOf('空的') >= 0, '點數表有引路人的「空的」');
    await H.sheet('redeem', J4 + ':'); await H.click('[data-act="redeem"]');
  },
  ask: async function (H, yes) {
    await H.pg.waitForFunction("APP.tut().step === 7", null, { timeout: 5000 }); await H.pg.waitForTimeout(300);
    assert((await H.sheetName()) === 'todo' && (await H.main()).indexOf('要不要用另一種介面再走一次') >= 0, '走完跳到待辦問：要不要用另一種介面再走一次？');
    await H.click('[data-act="' + (yes ? 'tutYes' : 'tutNo') + '"]'); await H.pg.waitForTimeout(500);
  },
  compare: async function (H) {   // 在表世界帶看對照（裡世界走完選「不要」）
    assert((await H.ev("APP.view()")) === 'sheet' && (await H.sheetName()) === 'todo' && (await H.rows()) === 4, '切到表世界，待辦是四條對照');
    var m = await H.main(); assert(m.indexOf('帳房') >= 0 && m.indexOf('「點數」') >= 0, '表世界的對照：帳房＝「點數」');
    for (var i = 0; i < 4; i++) { await H.click('[data-act="tutNext"]'); await H.pg.waitForTimeout(300); }
    assert((await H.ev("APP.view()")) === 'game' && (await STEP(H)) === 'done', '看完切回裡世界，教學結束');
  },
  full: async function (H, name) { await Sh.create(H, name); await Sh.find(H); await Sh.book(H); await Sh.dock(H); await Sh.see(H); }
};
module.exports = { G: G, Sh: Sh, waitStep: waitStep, J1: J1, J4: J4 };
