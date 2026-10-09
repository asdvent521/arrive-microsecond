// v8 規則層測試：node v8/tests/core.test.js
// 一人一角色、每天一版（明天起）、資源可換／已保留、收點就選好東西、那一微秒兩兩成交、保留到期、不玩了、條件欄位、換點比例、預設 2000。
var assert = require('assert');
var C = require('../src/core.js');
var DAY = C.DAY_US, J1 = '00000000001', J2 = '00000000002', J3 = '00000000003';
var n = 0; function ok(name, fn) { fn(); n++; console.log('ok: ' + name); }
function throws(fn, re) { assert.throws(fn, function (e) { return re.test(e.message); }, '應該要擋下：' + re); }
// 固定一個時間：今天中午
var T0 = (function () { var d = new Date(); d.setHours(12, 0, 0, 0); return d.getTime() * 1000; })();
function fresh() { var s = C.fresh(); return s; }
function base() {   // 乾淨的三個角色，不帶示範時段
  var s = { v: 8, me: 0, roles: [], holds: [], dockings: [], redeems: [], acceptances: [], records: [], presence: {} };
  C.createRole(s, { serial: J1, name: '甲', dailyPoints: 1000, rules: { uses: ['a'], conditions: [] }, resources: [{ id: 'x', name: '畫一張圖', price: 300, keepDays: 2, avail: 1 }, { id: 'y', name: '一杯茶', price: 50, keepDays: null, avail: 10 }] }, T0);
  C.createRole(s, { serial: J2, name: '乙', dailyPoints: 500, rules: { uses: ['b'], conditions: [] }, resources: [{ id: 'p', name: '一首歌', price: 200, keepDays: 1, avail: 2 }] }, T0);
  C.createRole(s, { serial: J3, name: '丙', dailyPoints: 300, rules: { uses: ['c'], conditions: [] }, resources: [{ id: 'q', name: '借書', price: 10, keepDays: null, avail: 5 }] }, T0);
  return s;
}
// 開一個 1 分鐘後的時段，約好的人都預約並到場，然後跑到那一微秒
function meet(s, ownerSerial, visitors, at) {
  var slot = C.addSlot(s, ownerSerial, at || T0 + 60e6, 5, null, T0);
  visitors.forEach(function (v) { C.book(s, v, slot.id, T0); C.setPresent(s, v, slot.id, true); });
  return slot;
}

ok('10. 預設每天 2000 點', function () {
  var s = { v: 8, me: 0, roles: [], holds: [], dockings: [], redeems: [], acceptances: [], records: [], presence: {} };
  var r = C.createRole(s, { name: '丁' }, T0);
  assert.strictEqual(C.dailyPoints(r, T0), 2000); assert.strictEqual(C.DEFAULT_DAILY, 2000);
});
ok('1. 一人一個角色：示範資料三個角色，沒有新角色、週期、空窗這些東西', function () {
  var s = fresh();
  assert.strictEqual(s.roles.length, 3);
  assert.strictEqual(C.endEarly, undefined); assert.strictEqual(C.enterVacancy, undefined); assert.strictEqual(C.canRefuse, undefined); assert.strictEqual(C.recreate, undefined);
  assert.ok(!s.roles[0].life && !s.roles[0].state);
  assert.strictEqual(C.remainingToday(s, s.roles[0], C.nowUs()), 1800);
});
ok('2. 每天一版：改每天的點、規則、資源的價錢都是明天起；今天不變；明天起的今天就看得到', function () {
  var s = base(), r = s.roles[0];
  C.setDailyPoints(s, J1, 1500, T0);
  C.setRules(s, J1, { uses: ['a', 'a2'], conditions: [{ field: 'dockCount', op: '>=', value: 1 }] }, T0);
  C.setResource(s, J1, 'y', { price: 80 }, T0);
  assert.strictEqual(C.dailyPoints(r, T0), 1000, '今天還是 1000');
  assert.strictEqual(C.version(r, T0).rules.uses.length, 1);
  assert.strictEqual(C.resourceOf(C.version(r, T0), 'y').price, 50);
  var p = C.pending(r, T0); assert.ok(p && p.fromDay === C.dayNum(T0) + 1, '有一個明天起的版本');
  assert.strictEqual(p.dailyPoints, 1500); assert.strictEqual(p.rules.uses.length, 2); assert.strictEqual(C.resourceOf(p, 'y').price, 80);
  assert.strictEqual(C.dailyPoints(r, T0 + DAY), 1500, '明天生效'); assert.strictEqual(C.resourceOf(C.version(r, T0 + DAY), 'y').price, 80);
  assert.strictEqual(C.pending(r, T0 + DAY), null, '明天就沒有「明天起」了');
  assert.strictEqual(r.versions.length, 2, '每天的版本都留著');
  C.setDailyPoints(s, J1, 1600, T0); assert.strictEqual(r.versions.length, 2, '同一天再改，改的是同一個明天起的版本');
  // 剛創的角色當下生效
  var r4 = C.createRole(s, { serial: '00000000004', name: '丁', dailyPoints: 700 }, T0); assert.strictEqual(C.dailyPoints(r4, T0), 700);
});
ok('2b. 改價錢隔天才生效，已保留的照舊；對接紀錄記雙方當天的版本', function () {
  var s = base(), slot = meet(s, J1, [J2]);
  C.setWants(s, slot.id, J2, J1, ['y']);          // 乙要甲的一杯茶 50
  C.setResource(s, J1, 'y', { price: 80 }, T0);   // 甲把茶改成 80（明天起）
  var out = C.judge(s, T0 + 60e6, {});
  var d = out[0].docking;
  assert.strictEqual(d.gaveA, 50, '今天照今天的價錢 50');
  assert.strictEqual(d.verA, C.version(s.roles[0], T0).id); assert.strictEqual(d.verB, C.version(s.roles[1], T0).id);
  var h = s.holds[0]; assert.strictEqual(h.price, 50);
  assert.strictEqual(C.resourceOf(C.version(s.roles[0], T0 + DAY), 'y').price, 80);
  assert.strictEqual(h.price, 50, '已保留的不受改版影響'); assert.strictEqual(C.holdStatus(h, T0 + DAY), 'held');
});
ok('3. 資源：可換隨時加減、不能小於 0；已保留的不能手動減；別人只看可換', function () {
  var s = base(), r = s.roles[0];
  C.restock(s, J1, 'y', 3); assert.strictEqual(C.stockOf(r, 'y').avail, 13);
  C.restock(s, J1, 'y', -13); assert.strictEqual(C.stockOf(r, 'y').avail, 0);
  throws(function () { C.restock(s, J1, 'y', -1); }, /不能小於 0/);
  var slot = meet(s, J1, [J2]); C.setWants(s, slot.id, J2, J1, ['x']); C.judge(s, T0 + 60e6, {});
  assert.deepStrictEqual(C.stockOf(r, 'x'), { avail: 0, reserved: 1 });
  throws(function () { C.restock(s, J1, 'x', -1); }, /不能小於 0/);   // 已保留的那份不在可換裡，減不到
  assert.strictEqual(C.stockOf(r, 'x').reserved, 1, '已保留的還在');
  assert.strictEqual(C.searchResources(s, '畫', T0)[0].stock.avail, 0, '別人看到的可換是 0');
});
ok('5a. 沒貨給不出點：那個方向不成立、記下原因；另一個方向照成交', function () {
  var s = base(), slot = meet(s, J1, [J2]);
  C.setWants(s, slot.id, J2, J1, ['x', 'x']);   // 乙要兩張圖，甲只有 1
  C.setWants(s, slot.id, J1, J2, ['p']);        // 甲要乙的一首歌 200
  var d = C.judge(s, T0 + 60e6, {})[0].docking;
  assert.strictEqual(d.ok, true); assert.strictEqual(d.gaveA, 0); assert.ok(/貨不夠/.test(d.failA), d.failA);
  assert.strictEqual(d.gaveB, 200); assert.strictEqual(d.failB, null);
  assert.strictEqual(s.holds.length, 1); assert.strictEqual(s.holds[0].holder, J1); assert.strictEqual(s.holds[0].issuer, J2);
  assert.deepStrictEqual(C.stockOf(s.roles[0], 'x'), { avail: 1, reserved: 0 }, '不成立的方向貨沒動');
});
ok('5b. 收的點數等於選的價錢加起來；成交後不能改', function () {
  var s = base(), slot = meet(s, J1, [J2]);
  C.setWants(s, slot.id, J2, J1, ['x', 'y', 'y']);   // 300 + 50 + 50
  var d = C.judge(s, T0 + 60e6, {})[0].docking;
  assert.strictEqual(d.gaveA, 400); assert.strictEqual(C.heldPoints(s, J2, J1, T0 + 60e6), 400);
  assert.strictEqual(C.remainingToday(s, s.roles[0], T0 + 60e6), 600);
  throws(function () { C.setWants(s, slot.id, J2, J1, ['y']); }, /已經過了/);
  throws(function () { C.setMaxGive(s, slot, J1, 10); }, /已經過了/);
});
ok('5c. 超過每人上限或當天剩的點，那個方向就不成立', function () {
  var s = base(), slot = meet(s, J1, [J2]);
  C.setMaxGive(s, slot, J1, 100); C.setWants(s, slot.id, J2, J1, ['x']);   // 300 > 100
  var d = C.judge(s, T0 + 60e6, {})[0].docking;
  assert.strictEqual(d.gaveA, 0); assert.ok(/最多給 100/.test(d.failA), d.failA);
  var s2 = base(), slot2 = meet(s2, J1, [J2]);
  C.setWants(s2, slot2.id, J2, J1, ['x', 'x', 'x', 'x']); C.restock(s2, J1, 'x', 3);   // 1200 > 1000
  var d2 = C.judge(s2, T0 + 60e6, {})[0].docking;
  assert.strictEqual(d2.gaveA, 0); assert.ok(/不能預支/.test(d2.failA), d2.failA);
  assert.strictEqual(C.maxGiveOf(s2, slot2, J1, T0), 1000, '沒設上限＝當天剩下的');
});
ok('5d. 沒選就只給不收：對方沒選我的東西，我拿 0 點、他沒給', function () {
  var s = base(), slot = meet(s, J1, [J2]);
  C.setWants(s, slot.id, J2, J1, ['y']);
  var d = C.judge(s, T0 + 60e6, {})[0].docking;
  assert.strictEqual(d.gaveA, 50); assert.strictEqual(d.gaveB, 0); assert.strictEqual(d.failB, null);
});
ok('5e. 三個人同一個時段，到場的兩兩成交；沒到場的錯過', function () {
  var s = base();
  var slot = C.addSlot(s, J1, T0 + 60e6, 5, null, T0);
  [J2, J3].forEach(function (v) { C.book(s, v, slot.id, T0); });
  C.setPresent(s, J2, slot.id, true); C.setPresent(s, J3, slot.id, true);
  C.setWants(s, slot.id, J2, J1, ['y']); C.setWants(s, slot.id, J3, J1, ['y']); C.setWants(s, slot.id, J2, J3, ['q']); C.setWants(s, slot.id, J3, J2, ['p']);
  var out = C.judge(s, T0 + 60e6, {});
  assert.strictEqual(out.length, 3, '三對');
  var pair = function (a, b) { return s.dockings.find(function (d) { return (d.a === a && d.b === b) || (d.a === b && d.b === a); }); };
  assert.strictEqual(pair(J1, J2).gaveA, 50); assert.strictEqual(pair(J1, J3).gaveA, 50);
  var d23 = pair(J2, J3); assert.strictEqual(d23.a === J2 ? d23.gaveA : d23.gaveB, 200, '丙選了乙的一首歌：乙給丙 200 乙點'); assert.strictEqual(d23.a === J2 ? d23.gaveB : d23.gaveA, 10, '乙選了丙的借書：丙給乙 10 丙點');
  assert.strictEqual(C.remainingToday(s, s.roles[0], T0 + 60e6), 900, '甲給了乙、丙各 50');
  assert.strictEqual(C.remainingToday(s, s.roles[1], T0 + 60e6), 300, '乙 500 給了 200');
  assert.strictEqual(C.remainingToday(s, s.roles[2], T0 + 60e6), 290, '丙 300 給了 10');
  // 沒到場
  var s2 = base(), slot2 = C.addSlot(s2, J1, T0 + 60e6, 5, null, T0); C.book(s2, J2, slot2.id, T0);
  C.judge(s2, T0 + 60e6, {});
  assert.ok(C.missed(slot2, J2)); assert.strictEqual(s2.dockings.length, 0);
  // 站在終點上也算到場
  var s3 = base(), slot3 = C.addSlot(s3, J1, T0 + 60e6, 5, null, T0); C.book(s3, J2, slot3.id, T0); C.setWants(s3, slot3.id, J2, J1, ['y']);
  var st = {}; st[J2] = J1; assert.strictEqual(C.judge(s3, T0 + 60e6, st)[0].docking.gaveA, 50);
  // 判定窗過了沒判：expire 全部算錯過
  var s4 = base(), slot4 = C.addSlot(s4, J1, T0 + 60e6, 5, null, T0); C.book(s4, J2, slot4.id, T0); C.setPresent(s4, J2, slot4.id, true);
  C.expire(s4, T0 + 62e6); assert.ok(C.missed(slot4, J2)); assert.strictEqual(C.judge(s4, T0 + 60.5e6, {}).length, 0, '判過就不再判');
});
ok('5f. 判定照原本規則：一方通、兩個開關；不通的一對記下原因', function () {
  var s = base();
  C.setRules(s, J3, { conditions: [{ field: 'dockCount', op: '>=', value: 5 }], bothMustPass: true }, T0 - DAY);   // 丙昨天就設：要兩方都通，條件沒人通
  var slot = C.addSlot(s, J1, T0 + 60e6, 5, null, T0);
  throws(function () { C.book(s, J3, slot.id, T0); }, /條件不通/);
  C.book(s, J2, slot.id, T0); C.setPresent(s, J2, slot.id, true);
  // 乙要求接受村規
  C.setRules(s, J2, { mustAcceptVillage: true, village: '乙的村規' }, T0 - DAY);
  var d = C.judge(s, T0 + 60e6, {})[0].docking;
  assert.strictEqual(d.ok, false); assert.ok(/還沒接受/.test(d.reason));
  assert.strictEqual(s.dockings.length, 1); assert.strictEqual(s.holds.length, 0);
});
ok('6a. 保留：記發點的人、東西、價錢、哪次對接、保留到哪天；兌現就是換掉這筆；換過不能再換', function () {
  var s = base(), slot = meet(s, J1, [J2]); C.setWants(s, slot.id, J2, J1, ['x']);
  var d = C.judge(s, T0 + 60e6, {})[0].docking, h = s.holds[0];
  assert.deepStrictEqual([h.issuer, h.holder, h.resource, h.price, h.docking, h.untilDay], [J1, J2, 'x', 300, d.id, C.dayNum(T0) + 2]);
  assert.strictEqual(C.holdings(s, J2, T0)[0].until, C.dayLabel(C.dayNum(T0) + 2));
  var rec = C.redeem(s, J2, h.id, T0 + 120e6);
  assert.strictEqual(rec.ok, true); assert.strictEqual(h.status, 'redeemed');
  assert.deepStrictEqual(C.stockOf(s.roles[0], 'x'), { avail: 0, reserved: 0 });
  throws(function () { C.redeem(s, J2, h.id, T0 + 130e6); }, /已經換過了/);
  throws(function () { C.redeem(s, J3, h.id, T0 + 130e6); }, /不是你的/);
  assert.strictEqual(C.heldPoints(s, J2, J1, T0 + 130e6), 0);
});
ok('6b. 保留到期沒換：作廢、貨回到可換、留紀錄；沒寫保留天數就不會到期', function () {
  var s = base(), slot = meet(s, J1, [J2]); C.setWants(s, slot.id, J2, J1, ['x', 'y']);   // x 保留 2 天，y 一直
  C.judge(s, T0 + 60e6, {});
  var hx = s.holds.find(function (h) { return h.resource === 'x'; }), hy = s.holds.find(function (h) { return h.resource === 'y'; });
  assert.strictEqual(C.expire(s, T0 + 2 * DAY), 0, '第二天還在');
  assert.strictEqual(C.expire(s, T0 + 3 * DAY), 1, '第三天到期');
  assert.strictEqual(hx.status, 'expired'); assert.strictEqual(hy.status, 'held');
  assert.deepStrictEqual(C.stockOf(s.roles[0], 'x'), { avail: 1, reserved: 0 });
  assert.ok(s.records.some(function (r) { return r.kind === 'expire'; }));
  throws(function () { C.redeem(s, J2, hx.id, T0 + 3 * DAY); }, /到期作廢/);
  assert.strictEqual(C.expire(s, T0 + 400 * DAY), 0); assert.strictEqual(C.holdStatus(hy, T0 + 400 * DAY), 'held', '一直保留');
  assert.strictEqual(C.redeem(s, J2, hy.id, T0 + 400 * DAY).ok, true);
});
ok('6c. 改版、改價錢、下架都不影響已經保留的', function () {
  var s = base(), slot = meet(s, J1, [J2]); C.setWants(s, slot.id, J2, J1, ['y']); C.judge(s, T0 + 60e6, {});
  C.setResource(s, J1, 'y', { price: 999, name: '改名' }, T0); C.removeResource(s, J1, 'y', T0);
  var h = s.holds[0];
  assert.strictEqual(C.resourceOf(C.version(s.roles[0], T0 + DAY), 'y'), null, '明天下架');
  assert.strictEqual(C.holdStatus(h, T0 + DAY), 'held'); assert.strictEqual(h.name, '一杯茶'); assert.strictEqual(h.price, 50);
  assert.strictEqual(C.redeem(s, J2, h.id, T0 + DAY).ok, true, '下架了照樣換得到');
});
ok('5g. 時段在明天以後，來的人選了主人的東西，主人把它明天起下架：那一微秒這個方向不成立、不出錯、留紀錄；下架後還能改選', function () {
  var s = base(), at = T0 + DAY + 60e6, slot = C.addSlot(s, J1, at, 5, null, T0);
  C.book(s, J2, slot.id, T0); C.setPresent(s, J2, slot.id, true);
  C.setWants(s, slot.id, J2, J1, ['y', 'x']);        // 乙要甲的茶和圖
  C.setWants(s, slot.id, J1, J2, ['p']);             // 甲要乙的歌
  C.removeResource(s, J1, 'y', T0);                  // 甲把茶明天起下架
  var out = C.judge(s, at, {});
  assert.strictEqual(out.length, 1, '不丟錯誤，照樣判');
  var d = out[0].docking;
  assert.strictEqual(d.ok, true); assert.strictEqual(d.gaveA, 0); assert.ok(/選的「一杯茶」那天已經下架/.test(d.failA), d.failA);
  assert.strictEqual(d.gaveB, 200, '另一個方向照成交');
  assert.strictEqual(s.dockings.length, 1); assert.ok(slot.judged && slot.docked.indexOf(J2) >= 0);
  assert.deepStrictEqual(C.stockOf(s.roles[0], 'x'), { avail: 1, reserved: 0 }, '不成立的方向貨不動');
  // 下架後還能改選：已下架的自動拿掉，不丟錯誤
  var s2 = base(), slot2 = C.addSlot(s2, J1, T0 + DAY + 60e6, 5, null, T0); C.book(s2, J2, slot2.id, T0);
  C.setWants(s2, slot2.id, J2, J1, ['y']); C.removeResource(s2, J1, 'y', T0);
  assert.deepStrictEqual(C.wantsValid(s2, slot2, J2, J1), [], '畫面上看不到已下架的');
  assert.deepStrictEqual(C.setWants(s2, slot2.id, J2, J1, ['y', 'x']), ['x'], '再選：下架的自動拿掉、留下圖');
  // judge 一對出錯不影響其他對：把一個時段的 wants 弄壞
  var s3 = base(), slot3 = C.addSlot(s3, J1, T0 + 60e6, 5, null, T0); [J2, J3].forEach(function (v) { C.book(s3, v, slot3.id, T0); C.setPresent(s3, v, slot3.id, true); });
  C.setWants(s3, slot3.id, J3, J1, ['y']); slot3.wants[J2] = {}; Object.defineProperty(slot3.wants[J2], J1, { get: function () { throw new Error('壞資料'); } });   // 這一對一讀就爆
  var out3 = C.judge(s3, T0 + 60e6, {});
  assert.ok(out3.length >= 2 && s3.records.some(function (r) { return r.kind === 'error'; }), '壞的那一對留「判定出錯」紀錄，其他對照判');
});
ok('2c. 「對方可換的貨」只算當天版本裡有的：明天起才上架的補 50 份今天不算；下架後從生效那天起不算', function () {
  var s = base(), r = s.roles[0];
  assert.strictEqual(C.availTotal(r, T0), 11);
  var z = C.addResource(s, J1, { name: '新東西', price: 5 }, T0); C.restock(s, J1, z.id, 50);
  assert.strictEqual(C.availTotal(r, T0), 11, '明天起才上架的不算'); assert.strictEqual(C.availTotal(r, T0 + DAY), 61, '明天就算');
  C.removeResource(s, J1, 'y', T0);
  assert.strictEqual(C.availTotal(r, T0), 11, '今天還在'); assert.strictEqual(C.availTotal(r, T0 + DAY), 51, '下架後從生效那天起不算');
  assert.strictEqual(C.COND_FIELDS.avail.get(s, r, T0 + DAY), 51, '條件判定用同一個數');
});
ok('沒有轉手的路：點只在保留裡，保留只能由持有人向發點的人換；沒有 transfer', function () {
  var s = base(), slot = meet(s, J1, [J2]); C.setWants(s, slot.id, J2, J1, ['y']); C.judge(s, T0 + 60e6, {});
  assert.strictEqual(C.transfer, undefined); assert.strictEqual(C.spend, undefined); assert.strictEqual(s.points, undefined);
  var h = s.holds[0];
  throws(function () { C.redeem(s, J3, h.id, T0); }, /不是你的/);
  // 丙手上沒有甲的點，條件「對方手上有多少我的點」算 0
  assert.strictEqual(C.heldPoints(s, J3, J1, T0), 0); assert.strictEqual(C.heldPoints(s, J2, J1, T0), 50);
});
ok('7. 不玩了：手上有他點的人都換完才能刪；單機版同意就作廢、刪掉角色', function () {
  var s = base(), slot = meet(s, J1, [J2]); C.setWants(s, slot.id, J2, J1, ['x']); C.judge(s, T0 + 60e6, {});
  throws(function () { C.quit(s, J1, T0 + 61e6); }, /沒換/);
  assert.strictEqual(C.quitBlockers(s, J1, T0 + 61e6).length, 1);
  assert.strictEqual(C.quit(s, J1, T0 + 61e6, true), 1);
  assert.strictEqual(s.roles.length, 2); assert.strictEqual(s.holds[0].status, 'voided');
  var s2 = base(); meet(s2, J1, [J2]); C.judge(s2, T0 + 60e6, {});
  assert.strictEqual(C.quit(s2, J1, T0 + 61e6), 0, '沒人拿著他的點，直接刪');
});
ok('8. 條件欄位：對方可換的貨 ≥ N 份、對方手上有多少我的點、對方對接過幾次；舊欄位沒了', function () {
  assert.deepStrictEqual(Object.keys(C.COND_FIELDS), ['avail', 'myPoints', 'dockCount']);
  var s = base();
  C.setRules(s, J1, { conditions: [{ field: 'avail', op: '>=', value: 5 }] }, T0 - DAY);
  assert.strictEqual(C.passes(s, s.roles[0], s.roles[1], T0).ok, false, '乙只有 2 份');
  assert.strictEqual(C.passes(s, s.roles[0], s.roles[2], T0).ok, true, '丙有 5 份');
  assert.strictEqual(C.canCome(s, s.roles[0], T0).map(function (r) { return r.serial; }).join(), J3);
  throws(function () { C.setRules(s, J1, { conditions: [{ field: 'dailyPoints', op: '>=', value: 1 }] }, T0); }, /不認得/);
  assert.strictEqual(C.condText({ field: 'avail', op: '>=', value: 5 }), '對方可換的貨（全部加起來） 至少 5份');
});
ok('9. 換點比例：最近 10 次的給出：收到', function () {
  var s = base();
  for (var i = 0; i < 12; i++) { var slot = meet(s, J1, [J3], T0 + (i + 1) * 60e6); C.restock(s, J1, 'y', 1); C.setWants(s, slot.id, J3, J1, ['y']); C.restock(s, J3, 'q', 1); C.setWants(s, slot.id, J1, J3, ['q']); C.judge(s, T0 + (i + 1) * 60e6, {}); }
  var r = C.ratio(s, J1);
  assert.strictEqual(r.n, 10); assert.strictEqual(r.gave, 500); assert.strictEqual(r.got, 100); assert.strictEqual(r.text, '500：100（最近 10 次）');
  assert.strictEqual(C.ratio(s, J3).text, '100：500（最近 10 次）');
  assert.strictEqual(C.ratio(s, J2).text, '還沒對接過');
});
ok('純資料檢查與存檔格式：角色洗過還是同一份資料', function () {
  var s = fresh(); var slot = meet(s, J1, [J2]); C.setWants(s, slot.id, J2, J1, ['r1a']); C.judge(s, T0 + 60e6, {});
  s.roles.forEach(function (r) { var c = C.tryClean(r); assert.ok(c.role, c.error); assert.deepStrictEqual(c.role, JSON.parse(JSON.stringify(r))); });
});
console.log('core.test.js ok（' + n + ' 項）');
