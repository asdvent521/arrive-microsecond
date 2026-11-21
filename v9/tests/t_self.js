// 自己的角色之間也可以換（2026-11-21）：J1 開第二個角色（相機），在事件簿空白那一行開時段（用第一個角色），那一行有「用另一個角色約」；
// 約了以後事件簿同一筆寫兩行（各從一個角色看，寫「我自己的另一個角色」），兩行各選另一個角色的東西；主動那一格寫「自己的不用接受」；
// 那一微秒成交：兩個角色給的都從今天的點扣、背包兩樣東西、成交結果寫「自己的兩個角色」；交換關係圖多一個自己的另一個角色；可以取消；截圖
// node v9/tests/t_self.js <test9.html> [截圖資料夾]
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J12 = '00000000001-2';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg, OUT = process.argv[3];
  await H.fresh();
  // 準備：第二個角色（相機），昨天就開好、有一樣「一張照片」30 點
  await H.ev("(function(){var s=APP.state(),t=APP.now()-86400e6,c=CORE.openChar(s,'" + J1 + "',{bg:'相機'},t),r=CORE.addResource(s,c.id,{name:'一張照片',kind:'thing',price:CORE.pts(30)},t);CORE.restock(s,c.id,r.id,3);APP.changed();})()");
  assert((await H.ev("CORE.charsOf(APP.me()).length")) === 2, '有兩個角色');
  var left0 = await H.ev("CORE.remainingToday(APP.state(),APP.me(),APP.now())");
  // 開時段（用第一個角色），那一行有「用另一個角色約」
  var slotId = await H.openSlot(120);
  var openRow = "document.querySelector('#tmain tr[data-id=\"" + slotId + "\"]')";
  assert((await H.ev("!!" + openRow + ".querySelector('[data-act=\"selfBook\"]')")), '我開的、還沒人約的那一行有「用另一個角色約」');
  await H.finger("function(){ return " + openRow + ".querySelector('[data-act=\"selfBook\"]'); }", '用另一個角色約');
  var sl = JSON.parse(await H.ev("JSON.stringify(CORE.slotOf(APP.state(),'" + slotId + "').slot)"));
  assert(sl.bookings.length === 1 && sl.bookings[0] === J12 && sl.roles[J12] === J12, '用（相機）約了自己開的時段：這一方記成 J1-2');
  // 事件簿：同一筆兩行
  var rows = await H.ev("(function(){var e=CORE.entriesOf(APP.state()).find(function(e){return e.slot==='" + slotId + "';});return Array.from(document.querySelectorAll('#tmain tr[data-id=\"'+e.id+'\"]')).map(function(tr){return tr.textContent;});})()");
  assert(rows.length === 2 && rows.every(function (t) { return t.indexOf('我自己的另一個角色') >= 0; }) && rows.some(function (t) { return t.indexOf('相機') >= 0; }), '事件簿同一筆寫兩行，各寫「我自己的另一個角色」：' + JSON.stringify(rows.map(function (t) { return t.slice(0, 40); })));
  // 兩行各選另一個角色的東西：J1-1 那行選相機的照片，J1-2 那行選 J1-1 的早餐
  var pickIn = async function (mk, res) {
    await H.finger("function(){ return document.querySelector('#tmain [data-act=\"pick\"][data-id=\"" + slotId + "\"][data-me=\"" + mk + "\"]'); }", '選他的東西（' + mk + '）');
    assert((await H.popBody()).indexOf(mk === J1 ? '一張照片' : '早餐') >= 0, mk + ' 那一行選得到另一個角色的東西');
    if (mk === J1) assert((await H.popBody()).indexOf('一樣從你今天的點扣') >= 0, '選的時候寫：自己的另一個角色給的，一樣從你今天的點扣');
    await H.click('#popBody [data-add="' + res + '"]'); await H.popOk('選好了');
  };
  var photo;
  photo = await H.ev("(function(){var c=CORE.charOf(APP.state(),'" + J12 + "').char;return CORE.version(c,APP.now()).resources.find(function(r){return r.name==='一張照片';}).id;})()");
  await pickIn(J1, photo); await pickIn(J12, 'r1b');
  assert((await H.main()).indexOf('自己的不用接受') >= 0, '主動那一格：自己的不用接受');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_self_1_booked.png' });
  // 那一微秒
  await H.soon(slotId, 3);
  await pg.waitForFunction("CORE.slotOf(APP.state(),'" + slotId + "').slot.judged", null, { timeout: 15000 }); await pg.waitForTimeout(500);
  var d = JSON.parse(await H.ev("JSON.stringify(APP.state().dockings.find(function(d){return d.slot==='" + slotId + "';}))"));
  assert(d && d.traded && d.a === J1 && d.b === J12, '成交：J1-1 ↔ J1-2');
  var left1 = await H.ev("CORE.remainingToday(APP.state(),APP.me(),APP.now())");
  assert(left0 - left1 === d.gaveA + d.gaveB && d.gaveA > 0 && d.gaveB > 0, '兩個角色給的都從今天的點扣（' + (left0 - left1) / 1e6 + ' 點）');
  assert((await H.popOpen()) && (await H.popBody()).indexOf('自己的兩個角色') >= 0 && (await H.popBody()).indexOf('每天這個時間') < 0, '成交結果寫「自己的兩個角色」，沒有固定約的勾');
  await H.popOk();
  var holds = JSON.parse(await H.ev("JSON.stringify(APP.state().holds.filter(function(h){return h.docking==='" + d.id + "';}).map(function(h){return [h.holder,h.holderRole,h.issuerRole];}))"));
  assert(holds.length === 2 && holds.every(function (h) { return h[0] === J1; }) && holds.some(function (h) { return h[1] === J12; }), '背包兩樣都是我的，各記哪個角色收：' + JSON.stringify(holds));
  await H.nav('log');
  var rows2 = await H.ev("(function(){var e=CORE.entriesOf(APP.state()).find(function(e){return e.slot==='" + slotId + "';});return Array.from(document.querySelectorAll('#tmain tr[data-id=\"'+e.id+'\"]')).map(function(tr){return tr.textContent;});})()");
  assert(rows2.length === 2 && rows2.every(function (t) { return t.indexOf('成交') >= 0; }) && rows2.filter(function (t) { return t.indexOf('兌現') >= 0; }).length === 2, '成交後兩行都寫成交、各有自己的兌現');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_self_2_traded.png' });
  // 交換關係圖：自己的另一個角色也是一個點
  await H.ev("APP.goTable(null,'map')"); await pg.waitForTimeout(300);
  assert((await H.ev("!!document.querySelector('#tmain [data-act=\"mapPick\"][data-id=\"" + J12 + "\"]')")) && (await H.main()).indexOf('我自己的另一個角色') >= 0, '交換關係圖：自己的另一個角色也是一個點');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_self_3_map.png' });
  // 再開一個，約了再取消
  var slot2 = await H.openSlot(300);
  await H.finger("function(){ return document.querySelector('#tmain tr[data-id=\"" + slot2 + "\"] [data-act=\"selfBook\"]'); }", '用另一個角色約');
  await H.finger("function(){ return document.querySelector('#tmain [data-act=\"cancelBook\"][data-me=\"" + J12 + "\"]'); }", '取消');
  assert((await H.ev("CORE.slotOf(APP.state(),'" + slot2 + "').slot.bookings.length")) === 0 && (await H.ev("!!document.querySelector('#tmain tr[data-id=\"" + slot2 + "\"] [data-act=\"selfBook\"]')")), '取消了：又是還沒人約的那一行');
  // 存檔讀回來
  await pg.reload(); await pg.waitForTimeout(600);
  assert((await H.ev("APP.state().dockings.some(function(d){return d.b==='" + J12 + "'&&d.traded;})")), '重新打開，自己換自己的紀錄還在');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
