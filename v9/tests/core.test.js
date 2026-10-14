// v9 規則層測試：node v9/tests/core.test.js
// 一人一角色、每天一版（明天起）、資源可換／已保留、收點就選好東西、那一微秒兩兩成交、保留到期、不玩了、條件欄位、換點比例、預設 2000。
var assert = require('assert');
var C = require('../src/core.js');
var DAY = C.DAY_US, J1 = '00000000001', J2 = '00000000002', J3 = '00000000003';
var n = 0; function ok(name, fn) { fn(); n++; console.log('ok: ' + name); }
function throws(fn, re) { assert.throws(fn, function (e) { return re.test(e.message); }, '應該要擋下：' + re); }
// 固定一個時間：今天中午
var T0 = (function () { var d = new Date(); d.setHours(12, 0, 0, 0); return d.getTime() * 1000; })();
function fresh() { var s = C.fresh({ history: false }); C.demoMe(s, T0); return s; }   // 示範資料＋測試用的「我」（J1）
function base() {   // 乾淨的三個角色，不帶示範時段
  var s = { v: 8, me: 0, roles: [], holds: [], dockings: [], redeems: [], acceptances: [], records: [], presence: {} };
  // 每個人都有一個 0 點的空物件（e1、e2、e3），一換一時「只收不給」就拿它
  C.createRole(s, { serial: J1, name: '甲', dailyPoints: 1000, rules: { uses: ['a'], conditions: [] }, resources: [{ id: 'x', name: '畫一張圖', price: 300, keepDays: 2, avail: 1 }, { id: 'y', name: '一杯茶', price: 50, keepDays: null, avail: 10 }, { id: 'e1', name: '空的', price: 0, keepDays: null, avail: 10 }] }, T0);
  C.createRole(s, { serial: J2, name: '乙', dailyPoints: 500, rules: { uses: ['b'], conditions: [] }, resources: [{ id: 'p', name: '一首歌', price: 200, keepDays: 1, avail: 2 }, { id: 'e2', name: '空的', price: 0, keepDays: null, avail: 10 }] }, T0);
  C.createRole(s, { serial: J3, name: '丙', dailyPoints: 300, rules: { uses: ['c'], conditions: [] }, resources: [{ id: 'q', name: '借書', price: 10, keepDays: null, avail: 5 }, { id: 'e3', name: '空的', price: 0, keepDays: null, avail: 10 }] }, T0);
  return s;
}
var EMPTY = {}; EMPTY[J1] = 'e1'; EMPTY[J2] = 'e2'; EMPTY[J3] = 'e3';
// 開一個 1 分鐘後的時段，約好的人都預約並到場；一換一：每個人預設先選對方的空物件（之後 setWants 會蓋掉）
function meet(s, ownerSerial, visitors, at) {
  var slot = C.addSlot(s, ownerSerial, at || T0 + 60e6, 5, null, T0);
  visitors.forEach(function (v) { C.book(s, v, slot.id, T0); C.setPresent(s, v, slot.id, true); });
  var ps = [ownerSerial].concat(visitors);
  ps.forEach(function (a) { ps.forEach(function (b) { if (a !== b) C.setWants(s, slot.id, a, b, [EMPTY[b]]); }); });
  return slot;
}

ok('10. 預設每天 2000 點', function () {
  var s = { v: 8, me: 0, roles: [], holds: [], dockings: [], redeems: [], acceptances: [], records: [], presence: {} };
  var r = C.createRole(s, { name: '丁' }, T0);
  assert.strictEqual(C.dailyPoints(r, T0), 2000); assert.strictEqual(C.DEFAULT_DAILY, 2000);
});
ok('1. 一人一個角色：示範資料四個角色，沒有新角色、週期、空窗這些東西', function () {
  var s = fresh();
  assert.strictEqual(s.roles.length, 5);
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
ok('5a. 一換一：任一邊貨不夠，整對不成交，兩邊都不給點、貨都不動、原因寫清楚', function () {
  var s = base(), slot = meet(s, J1, [J2]);
  C.setWants(s, slot.id, J2, J1, ['x', 'x']);   // 乙要兩張圖，甲只有 1
  C.setWants(s, slot.id, J1, J2, ['p']);        // 甲要乙的一首歌 200
  var d = C.judge(s, T0 + 60e6, {})[0].docking;
  assert.strictEqual(d.ok, true, '條件通'); assert.strictEqual(d.traded, false, '但整對不成交');
  assert.ok(/甲 的東西不夠.*整對不成交/.test(d.reason), d.reason); assert.ok(/東西不夠/.test(d.failA));
  assert.strictEqual(d.gaveA, 0); assert.strictEqual(d.gaveB, 0); assert.strictEqual(s.holds.length, 0);
  assert.deepStrictEqual(C.stockOf(s.roles[0], 'x'), { avail: 1, reserved: 0 }); assert.deepStrictEqual(C.stockOf(s.roles[1], 'p'), { avail: 2, reserved: 0 }, '兩邊的貨都沒動');
  assert.strictEqual(C.remainingToday(s, s.roles[1], T0 + 60e6), 500, '乙的點沒扣');
  assert.ok(s.records.some(function (r) { return r.kind === 'nodock' && /整對不成交/.test(r.text); }), '紀錄寫原因');
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
ok('5c. 超過每人上限或當天剩的點，整對不成交', function () {
  var s = base(), slot = meet(s, J1, [J2]);
  C.setMaxGive(s, slot, J1, 100); C.setWants(s, slot.id, J2, J1, ['x']);   // 300 > 100
  var d = C.judge(s, T0 + 60e6, {})[0].docking;
  assert.strictEqual(d.traded, false); assert.strictEqual(d.gaveA, 0); assert.strictEqual(d.gaveB, 0); assert.ok(/最多給 100.*整對不成交/.test(d.reason), d.reason);
  var s2 = base(), slot2 = meet(s2, J1, [J2]);
  C.setWants(s2, slot2.id, J2, J1, ['x', 'x', 'x', 'x']); C.restock(s2, J1, 'x', 3);   // 1200 > 1000
  var d2 = C.judge(s2, T0 + 60e6, {})[0].docking;
  assert.strictEqual(d2.traded, false); assert.ok(/不能預支.*整對不成交/.test(d2.reason), d2.reason); assert.strictEqual(s2.holds.length, 0);
  assert.strictEqual(C.maxGiveOf(s2, slot2, J1, T0), 1000, '沒設上限＝當天剩下的');
});
ok('5d. 一換一：只有一邊選，整對不成交；只給不收（試用品 ↔ 對方的空物件）成交', function () {
  var s = base(), slot = C.addSlot(s, J1, T0 + 60e6, 5, null, T0); C.book(s, J2, slot.id, T0); C.setPresent(s, J2, slot.id, true);
  C.setWants(s, slot.id, J2, J1, ['y']);   // 只有乙選了甲的
  var d = C.judge(s, T0 + 60e6, {})[0].docking;
  assert.strictEqual(d.ok, true); assert.strictEqual(d.traded, false); assert.strictEqual(d.reason, '一換一：甲 沒選 乙 的東西');
  assert.strictEqual(d.gaveA, 0); assert.strictEqual(s.holds.length, 0); assert.deepStrictEqual(C.stockOf(s.roles[0], 'y'), { avail: 10, reserved: 0 });
  // 兩邊都沒選
  var s1 = base(), slot1 = C.addSlot(s1, J1, T0 + 60e6, 5, null, T0); C.book(s1, J2, slot1.id, T0); C.setPresent(s1, J2, slot1.id, true);
  assert.strictEqual(C.judge(s1, T0 + 60e6, {})[0].docking.reason, '一換一：兩邊都沒選對方的東西');
  // 只給不收：甲拿出 0 點的試用品，選乙的空物件；乙選甲的試用品
  var s2 = base(), tr = C.addResource(s2, J1, { name: '試喝一口', price: 0, keepDays: 3 }, T0 - DAY); C.restock(s2, J1, tr.id, 5);
  var slot2 = meet(s2, J1, [J2]); C.setWants(s2, slot2.id, J2, J1, [tr.id]); C.setWants(s2, slot2.id, J1, J2, ['e2']);
  var d2 = C.judge(s2, T0 + 60e6, {})[0].docking;
  assert.strictEqual(d2.traded, true); assert.strictEqual(d2.gaveA, 0); assert.strictEqual(d2.gaveB, 0);
  assert.deepStrictEqual(d2.itemsA.map(function (i) { return i.name; }), ['試喝一口']); assert.deepStrictEqual(d2.itemsB.map(function (i) { return i.name; }), ['空的']);
  assert.strictEqual(s2.holds.length, 2); assert.strictEqual(C.remainingToday(s2, s2.roles[0], T0 + 60e6), 1000, '0 點不扣每天的點');
  assert.deepStrictEqual(C.stockOf(s2.roles[0], tr.id), { avail: 4, reserved: 1 }, '0 點的一樣要有貨、一樣保留');
  var h = s2.holds.find(function (x) { return x.resource === tr.id; }); assert.strictEqual(h.untilDay, C.dayNum(T0 + 60e6) + 3, '0 點的一樣有保留天數');
  assert.strictEqual(C.redeem(s2, J2, h.id, T0 + 120e6).ok, true, '0 點的一樣可以兌現');
  assert.strictEqual(C.expire(s2, T0 + 5 * DAY), 0, '換掉了就不會到期');
});
ok('5e. 三個人同一個時段，到場的兩兩成交；沒到場的錯過', function () {
  var s = base();
  var slot = C.addSlot(s, J1, T0 + 60e6, 5, null, T0);
  [J2, J3].forEach(function (v) { C.book(s, v, slot.id, T0); });
  C.setPresent(s, J2, slot.id, true); C.setPresent(s, J3, slot.id, true);
  C.setWants(s, slot.id, J2, J1, ['y']); C.setWants(s, slot.id, J3, J1, ['y']); C.setWants(s, slot.id, J2, J3, ['q']); C.setWants(s, slot.id, J3, J2, ['p']);
  C.setWants(s, slot.id, J1, J2, ['e2']); C.setWants(s, slot.id, J1, J3, ['e3']);   // 甲只收不給：選兩人的空物件
  var out = C.judge(s, T0 + 60e6, {});
  assert.strictEqual(out.length, 3, '三對');
  var pair = function (a, b) { return s.dockings.find(function (d) { return (d.a === a && d.b === b) || (d.a === b && d.b === a); }); };
  assert.strictEqual(pair(J1, J2).gaveA, 50); assert.strictEqual(pair(J1, J3).gaveA, 50);
  var d23 = pair(J2, J3); assert.strictEqual(d23.a === J2 ? d23.gaveA : d23.gaveB, 200, '丙選了乙的一首歌：乙給丙 200 乙點'); assert.strictEqual(d23.a === J2 ? d23.gaveB : d23.gaveA, 10, '乙選了丙的借書：丙給乙 10 丙點');
  assert.strictEqual(C.remainingToday(s, s.roles[0], T0 + 60e6), 900, '甲給了乙、丙各 50');
  assert.strictEqual(C.remainingToday(s, s.roles[1], T0 + 60e6), 300, '乙 500 給了 200');
  assert.strictEqual(C.remainingToday(s, s.roles[2], T0 + 60e6), 290, '丙 300 給了 10');
  // 沒到達（預約時把到達的勾拿掉）
  var s2 = base(), slot2 = C.addSlot(s2, J1, T0 + 60e6, 5, null, T0); C.book(s2, J2, slot2.id, T0, false);
  C.judge(s2, T0 + 60e6, {});
  assert.ok(C.missed(slot2, J2)); assert.strictEqual(s2.dockings.length, 0);
  // 預約時就確認到達（預設），那一微秒就算到達
  var s3 = base(), slot3 = C.addSlot(s3, J1, T0 + 60e6, 5, null, T0); C.book(s3, J2, slot3.id, T0); C.setWants(s3, slot3.id, J2, J1, ['y']); C.setWants(s3, slot3.id, J1, J2, ['e2']);
  assert.strictEqual(C.judge(s3, T0 + 60e6)[0].docking.gaveA, 50);
  // 判定窗過了沒判：下次 judge 補判，確認了的照那一微秒成交，沒確認的錯過；expire 只管保留到期
  var s4 = base(), slot4 = C.addSlot(s4, J1, T0 + 60e6, 5, null, T0); C.book(s4, J2, slot4.id, T0); C.setPresent(s4, J2, slot4.id, true); C.setWants(s4, slot4.id, J2, J1, ['y']); C.setWants(s4, slot4.id, J1, J2, ['e2']);
  C.expire(s4, T0 + 62e6); assert.ok(!slot4.judged && !C.missed(slot4, J2), 'expire 不再把人算錯過');
  var late = C.judge(s4, T0 + 3600e6, {}); assert.ok(late.length === 1 && late[0].late && late[0].docking.traded && late[0].docking.atUs === T0 + 60e6, '補判：照那個時段的那一微秒成交'); assert.strictEqual(C.judge(s4, T0 + 3601e6, {}).length, 0, '判過就不再判');
});
ok('5f. 判定照原本規則：一方通、兩個開關；不通的一對記下原因', function () {
  var s = base();
  C.setRules(s, J3, { conditions: [{ field: 'dockCount', op: '>=', value: 5 }], bothMustPass: true }, T0 - DAY);   // 丙昨天就設：要兩方都通，條件沒人通
  var slot = C.addSlot(s, J1, T0 + 60e6, 5, null, T0);
  throws(function () { C.book(s, J3, slot.id, T0); }, /條件不通/);
  C.book(s, J2, slot.id, T0); C.setPresent(s, J2, slot.id, true);
  // 乙要求接受村規
  C.setRules(s, J2, { mustAcceptVillage: true, village: '乙的家規' }, T0 - DAY);
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
ok('5g. 時段在明天以後，來的人選了主人的東西，主人把它明天起下架：下架的不算、剩下的照成交、留紀錄；全部下架就一換一不成交；下架後還能改選', function () {
  var s = base(), at = T0 + DAY + 60e6, slot = C.addSlot(s, J1, at, 5, null, T0);
  C.book(s, J2, slot.id, T0); C.setPresent(s, J2, slot.id, true);
  C.setWants(s, slot.id, J2, J1, ['y', 'x']);        // 乙要甲的茶和圖
  C.setWants(s, slot.id, J1, J2, ['p']);             // 甲要乙的歌
  C.removeResource(s, J1, 'y', T0);                  // 甲把茶明天起下架
  var out = C.judge(s, at, {});
  assert.strictEqual(out.length, 1, '不丟錯誤，照樣判');
  var d = out[0].docking;
  assert.strictEqual(d.ok, true); assert.strictEqual(d.gaveA, 300, '下架的茶不算，圖照成交：乙拿到圖 300'); assert.strictEqual(d.failA, null);
  assert.strictEqual(d.noteA, '選的「一杯茶」那天已經下架，沒換到'); assert.deepStrictEqual(d.itemsA.map(function (i) { return i.name; }), ['畫一張圖']);
  assert.ok(s.records.some(function (r) { return /選的「一杯茶」那天已經下架，沒換到/.test(r.text); }), '紀錄寫茶沒換到');
  assert.strictEqual(d.gaveB, 200, '另一個方向照成交');
  assert.strictEqual(s.dockings.length, 1); assert.ok(slot.judged && slot.docked.indexOf(J2) >= 0);
  assert.deepStrictEqual(C.stockOf(s.roles[0], 'x'), { avail: 0, reserved: 1 }, '圖留起來了');
  assert.deepStrictEqual(C.wantsGone(s, slot, J2, J1), ['一杯茶']); assert.strictEqual(C.goneText(s, slot, J2, J1), '選的「一杯茶」那天已經下架，不算');
  // 全部都下架：這個方向 0 點，一樣寫原因
  var s0 = base(), slot0 = C.addSlot(s0, J1, at, 5, null, T0); C.book(s0, J2, slot0.id, T0); C.setPresent(s0, J2, slot0.id, true);
  C.setWants(s0, slot0.id, J2, J1, ['y']); C.setWants(s0, slot0.id, J1, J2, ['e2']); C.removeResource(s0, J1, 'y', T0);
  var d0 = C.judge(s0, at, {})[0].docking;
  assert.strictEqual(d0.traded, false, '全部下架就一換一不成交'); assert.strictEqual(d0.gaveA, 0); assert.strictEqual(d0.failA, '選的「一杯茶」那天已經下架，沒換到'); assert.ok(/整對不成交/.test(d0.reason)); assert.strictEqual(s0.holds.length, 0);
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
  assert.strictEqual(C.availTotal(r, T0), 21);
  var z = C.addResource(s, J1, { name: '新東西', price: 5 }, T0); C.restock(s, J1, z.id, 50);
  assert.strictEqual(C.availTotal(r, T0), 21, '明天起才上架的不算'); assert.strictEqual(C.availTotal(r, T0 + DAY), 71, '明天就算');
  C.removeResource(s, J1, 'y', T0);
  assert.strictEqual(C.availTotal(r, T0), 21, '今天還在'); assert.strictEqual(C.availTotal(r, T0 + DAY), 61, '下架後從生效那天起不算');
  assert.strictEqual(C.COND_FIELDS.avail.get(s, r, T0 + DAY), 61, '條件判定用同一個數');
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
  var s2 = base();
  assert.strictEqual(C.quit(s2, J1, T0 + 61e6), 0, '沒人拿著他的點，直接刪');
});
ok('8. 條件欄位：對方可換的貨 ≥ N 份、對方收著多少我的東西、對方對接過幾次、對方要給的東西種類；舊欄位沒了', function () {
  assert.deepStrictEqual(Object.keys(C.COND_FIELDS), ['avail', 'myPoints', 'dockCount', 'giveKind']);
  var s = base();
  C.setRules(s, J1, { conditions: [{ field: 'avail', op: '>=', value: 15 }] }, T0 - DAY);
  assert.strictEqual(C.passes(s, s.roles[0], s.roles[1], T0).ok, false, '乙只有 12 份');
  assert.strictEqual(C.passes(s, s.roles[0], s.roles[2], T0).ok, true, '丙有 15 份');
  assert.strictEqual(C.canCome(s, s.roles[0], T0).map(function (r) { return r.serial; }).join(), J3);
  throws(function () { C.setRules(s, J1, { conditions: [{ field: 'dailyPoints', op: '>=', value: 1 }] }, T0); }, /不認得/);
  assert.strictEqual(C.condText({ field: 'avail', op: '>=', value: 5 }), '對方可換的東西（全部加起來） 至少 5份');
});
ok('9. 換點比例：最近 10 次的給出：收到', function () {
  var s = base();
  for (var i = 0; i < 12; i++) { var slot = meet(s, J1, [J3], T0 + (i + 1) * 60e6); C.restock(s, J1, 'y', 1); C.setWants(s, slot.id, J3, J1, ['y']); C.restock(s, J3, 'q', 1); C.setWants(s, slot.id, J1, J3, ['q']); C.judge(s, T0 + (i + 1) * 60e6, {}); }
  var r = C.ratio(s, J1);
  assert.strictEqual(r.n, 10); assert.strictEqual(r.gave, 500); assert.strictEqual(r.got, 100); assert.strictEqual(r.text, '500：100（最近 10 次）');
  assert.strictEqual(C.ratio(s, J3).text, '100：500（最近 10 次）');
  assert.strictEqual(C.ratio(s, J2).text, '還沒對接過');
});
ok('改規則不溯及既往 (a)：預約後主人才打開兩方都通、加條件，那一微秒照預約時的規則；改版後的新預約照新規則', function () {
  var s = base(), at = T0 + 2 * DAY, slot = C.addSlot(s, J1, at, 5, null, T0);
  C.book(s, J2, slot.id, T0); C.setPresent(s, J2, slot.id, true);
  assert.strictEqual(slot.bookedAt[J2], T0, '預約時記下那一刻');
  C.setRules(s, J1, { bothMustPass: true, conditions: [{ field: 'dockCount', op: '>=', value: 5 }] }, T0);   // 明天起
  C.setWants(s, slot.id, J2, J1, ['y']); C.setWants(s, slot.id, J1, J2, ['e2']);
  var d = C.judge(s, at, {})[0].docking;
  assert.strictEqual(d.ok, true, '照預約時的規則：成立'); assert.strictEqual(d.gaveA, 50);
  assert.strictEqual(d.ruleUs, T0); assert.strictEqual(d.verA, s.roles[0].versions[0].id, 'verA 記判定用的那一版（預約時的）');
  throws(function () { var s2 = C.addSlot(s, J1, at + 60e6, 5, null, T0 + DAY); C.book(s, J3, s2.id, T0 + DAY); }, /條件不通/);   // 改版後的新預約照新規則
});
ok('改規則不溯及既往 (b)：預約後主人才打開「要接受我的村規」：那一微秒照樣成立', function () {
  var s = base(), at = T0 + 2 * DAY, slot = C.addSlot(s, J1, at, 5, null, T0);
  C.book(s, J2, slot.id, T0); C.setPresent(s, J2, slot.id, true); C.setWants(s, slot.id, J2, J1, ['y']); C.setWants(s, slot.id, J1, J2, ['e2']);
  C.setRules(s, J1, { mustAcceptVillage: true, village: '甲的家規' }, T0);
  var d = C.judge(s, at, {})[0].docking;
  assert.strictEqual(d.ok, true); assert.strictEqual(d.gaveA, 50);
  assert.strictEqual(C.eligible(s, s.roles[0], s.roles[1], T0 + DAY).ok, false, '明天起新的對接要先接受');
});
ok('改規則不溯及既往 (c)：接受村規記版本。村規 v1→v2，換日後舊的接受不算、要重新接受；用 v1 預約的照樣成立', function () {
  var s = base(), A = s.roles[0], B = s.roles[1];
  C.setRules(s, J1, { mustAcceptVillage: true, village: 'v1' }, T0 - DAY);
  throws(function () { var sx = C.addSlot(s, J1, T0 + 2 * DAY, 5, null, T0); C.book(s, J2, sx.id, T0); }, /還沒接受/);
  C.accept(s, J2, J1, T0);
  assert.strictEqual(s.acceptances[0].village, 'v1', '記下接受的是 v1'); assert.strictEqual(C.acceptState(s, J2, A, T0), 'current');
  var slot = C.addSlot(s, J1, T0 + 2 * DAY, 5, null, T0); C.book(s, J2, slot.id, T0); C.setPresent(s, J2, slot.id, true); C.setWants(s, slot.id, J2, J1, ['y']); C.setWants(s, slot.id, J1, J2, ['e2']);
  C.setRules(s, J1, { mustAcceptVillage: true, village: 'v2' }, T0);   // 明天起改成 v2
  assert.strictEqual(C.villageChanges(A, T0), true); assert.strictEqual(C.acceptState(s, J2, A, T0), 'current', '今天還是 v1');
  assert.strictEqual(C.acceptState(s, J2, A, T0 + DAY), 'old', '換日後接受的是舊版');
  assert.strictEqual(C.accepted(s, J2, J1, 'v2'), false);
  var slot2 = C.addSlot(s, J1, T0 + 3 * DAY, 5, null, T0 + DAY);
  throws(function () { C.book(s, J2, slot2.id, T0 + DAY); }, /接受的是舊版/);
  C.accept(s, J2, J1, T0 + DAY); assert.strictEqual(C.acceptState(s, J2, A, T0 + DAY), 'current');
  C.book(s, J2, slot2.id, T0 + DAY);
  var d = C.judge(s, T0 + 2 * DAY, {})[0].docking;
  assert.strictEqual(d.ok, true, '用 v1 預約的照樣成立'); assert.strictEqual(d.gaveA, 50);
});
ok('改規則不溯及既往 (d)：事實照那一微秒。預約時可換 16 份，那一微秒前減到 13；要求兩方都通、條件 ≥ 15：不成立', function () {
  var s = base();
  C.setRules(s, J1, { bothMustPass: true, conditions: [{ field: 'avail', op: '>=', value: 15 }] }, T0 - DAY);
  C.restock(s, J2, 'p', 4);   // 乙可換 16 份（歌 6＋空的 10）
  var slot = C.addSlot(s, J1, T0 + 60e6, 5, null, T0); C.book(s, J2, slot.id, T0); C.setPresent(s, J2, slot.id, true); C.setWants(s, slot.id, J2, J1, ['y']);
  C.restock(s, J2, 'p', -3);  // 剩 3
  var d = C.judge(s, T0 + 60e6, {})[0].docking;
  assert.strictEqual(d.ok, false); assert.ok(/至少 15/.test(d.reason), d.reason); assert.strictEqual(s.holds.length, 0);
});
ok('改規則不溯及既往 (e)：兩個預約的人之間，照比較晚預約的那一刻', function () {
  var s = base(), at = T0 + 3 * DAY, slot = C.addSlot(s, J1, at, 5, null, T0);
  C.book(s, J2, slot.id, T0);                                                 // 乙在今天預約
  C.setRules(s, J3, { bothMustPass: true, conditions: [{ field: 'avail', op: '>=', value: 15 }] }, T0);   // 丙明天起要兩方都通、可換的貨 ≥ 15（甲 21 份通，乙 12 份不通）
  C.book(s, J3, slot.id, T0 + DAY);                                           // 丙在明天預約
  [J2, J3].forEach(function (v) { C.setPresent(s, v, slot.id, true); C.setWants(s, slot.id, v, J1, ['y']); C.setWants(s, slot.id, J1, v, [EMPTY[v]]); });
  C.setWants(s, slot.id, J2, J3, ['e3']); C.setWants(s, slot.id, J3, J2, ['e2']);
  C.judge(s, at, {});
  var pair = function (a, b) { return s.dockings.find(function (d) { return (d.a === a && d.b === b) || (d.a === b && d.b === a); }); };
  assert.strictEqual(pair(J1, J2).ok, true); assert.strictEqual(pair(J1, J2).ruleUs, T0);
  assert.strictEqual(pair(J1, J3).ok, true); assert.strictEqual(pair(J1, J3).ruleUs, T0 + DAY);
  var d23 = pair(J2, J3);
  assert.strictEqual(d23.ruleUs, T0 + DAY, '乙丙之間照丙預約的那一刻'); assert.strictEqual(d23.ok, false, '丙那時已經要求兩方都通，乙只有 12 份不通'); assert.ok(/兩方都通/.test(d23.reason));
  assert.strictEqual(d23.a === J3 ? d23.verA : d23.verB, s.roles[2].versions[1].id, '記判定用的那一版');
});
ok('一換一 (多人)：三人時段只成交兩邊都選了的那幾對；補貨一次加很多份', function () {
  var s = base(), slot = C.addSlot(s, J1, T0 + 60e6, 5, null, T0);
  [J2, J3].forEach(function (v) { C.book(s, v, slot.id, T0); C.setPresent(s, v, slot.id, true); });
  C.setWants(s, slot.id, J2, J1, ['y']); C.setWants(s, slot.id, J1, J2, ['e2']);   // 甲乙兩邊都選了
  C.setWants(s, slot.id, J3, J1, ['y']);                                            // 甲丙：只有丙選
  C.setWants(s, slot.id, J2, J3, ['q']);                                            // 乙丙：只有乙選
  C.judge(s, T0 + 60e6, {});
  var traded = s.dockings.filter(function (d) { return d.traded; });
  assert.strictEqual(s.dockings.length, 3); assert.strictEqual(traded.length, 1); assert.ok(traded[0].a === J1 && traded[0].b === J2);
  assert.ok(s.dockings.every(function (d) { return d.traded || /^一換一：/.test(d.reason); }), '沒成交的都寫一換一的原因');
  assert.strictEqual(C.remainingToday(s, s.roles[0], T0 + 60e6), 950); assert.strictEqual(s.holds.length, 2);
  assert.strictEqual(C.dockCount(s, J1), 1, '對接過幾次只算成交的'); assert.strictEqual(C.dockCount(s, J3), 0);
  C.restock(s, J1, 'e1', 99999); assert.strictEqual(C.stockOf(s.roles[0], 'e1').avail, 100009, '補貨一次加很多份');
  C.restock(s, J1, 'e1', -100000); assert.strictEqual(C.stockOf(s.roles[0], 'e1').avail, 9); throws(function () { C.restock(s, J1, 'e1', -10); }, /不能小於 0/);
});
ok('新手教學：示範版沒有「我」（me = -1）、引路人 J4 有一堆 0 點的「空的」；創角色放最前面當下生效；教學的對接不算進對接過幾次和換點比例，紀錄標「教學」', function () {
  var s = C.fresh({ history: false }), J4 = C.GUIDE;
  assert.strictEqual(s.me, -1); assert.strictEqual(s.roles.length, 4); assert.strictEqual(s.tutorial.step, 1);
  assert.ok(C.isGuide(J4) && C.roleOf(s, J4).name === '引路人'); assert.strictEqual(C.stockOf(C.roleOf(s, J4), 'r4e').avail, 99999); assert.strictEqual(C.version(C.roleOf(s, J4), T0).rules.conditions.length, 0);
  var b = C.blankRole(); assert.ok(b.blank && s.roles.indexOf(b) < 0);
  var me = C.createPlayer(s, { name: '小明', dailyPoints: '', firstItem: { name: '空的', price: 0, qty: 1 } }, T0);
  assert.strictEqual(s.me, 0); assert.strictEqual(s.roles[0], me); assert.strictEqual(me.serial, J1); assert.strictEqual(C.dailyPoints(me, T0), 2000);
  var e = C.version(me, T0).resources[0]; assert.strictEqual(e.price, 0); assert.strictEqual(C.stockOf(me, e.id).avail, 1);
  assert.strictEqual(C.route(me.world.walk, C.allObjects(me.world).map(function (x) { return x.o; }), 'J4').steps.join('，'), '繞規則屋一圈（J），再走到帳房（4）', '預設走法走得出 J4');
  // 跟引路人空的換空的
  var slot = C.addSlot(s, J4, T0 + 60e6, 1, null, T0); C.book(s, J1, slot.id, T0); C.setPresent(s, J1, slot.id, true);
  C.setWants(s, slot.id, J1, J4, ['r4e']); C.setWants(s, slot.id, J4, J1, [e.id]);
  C.judge(s, T0 + 60e6, {});
  var d = s.dockings[0]; assert.ok(d.traded && d.tutorial, '教學的對接成交、標教學'); assert.strictEqual(d.gaveA + d.gaveB, 0);
  assert.strictEqual(C.dockCount(s, J1), 0, '不算進對接過幾次'); assert.strictEqual(C.ratio(s, J1).text, '還沒對接過', '不算進換點比例');
  var rec = s.records.find(function (r) { return r.kind === 'dock'; }); assert.ok(/^（教學）/.test(rec.text) && rec.tutorial, '紀錄標「教學」');
  assert.strictEqual(s.holds.length, 2); C.redeem(s, J1, s.holds.find(function (h) { return h.holder === J1; }).id, T0 + 61e6); C.redeem(s, J4, s.holds.find(function (h) { return h.holder === J4; }).id, T0 + 61e6);
  assert.strictEqual(C.stockOf(me, e.id).avail, 0, '空的換掉了，要再補');
  // 真的對接才算數
  var s2 = fresh(); assert.strictEqual(s2.me, 0); assert.strictEqual(s2.roles[0].serial, J1); assert.strictEqual(s2.roles.length, 5);
  var slot2 = meet(s2, J2, [J1]); C.setWants(s2, slot2.id, J1, J2, ['r2a']); C.setWants(s2, slot2.id, J2, J1, ['r1b']); C.judge(s2, T0 + 60e6, {});
  assert.strictEqual(C.dockCount(s2, J1), 1); assert.ok(!/^（教學）/.test(s2.records[0].text));
});
// 一起成交：三個人湊一圈
function circle(s, together) {
  var slot = C.addSlot(s, J1, T0 + 60e6, 5, null, T0, together);
  [J2, J3].forEach(function (v) { C.book(s, v, slot.id, T0); C.setPresent(s, v, slot.id, true); });
  C.setWants(s, slot.id, J2, J1, ['y']); C.setWants(s, slot.id, J1, J2, ['e2']);   // 甲乙
  C.setWants(s, slot.id, J3, J1, ['y']); C.setWants(s, slot.id, J1, J3, ['e3']);   // 甲丙
  C.setWants(s, slot.id, J2, J3, ['q']); C.setWants(s, slot.id, J3, J2, ['p']);    // 乙丙
  return slot;
}
function snapshot(s) { return JSON.stringify({ holds: s.holds.length, stock: s.roles.map(function (r) { return r.stock; }), pts: s.roles.map(function (r) { return C.remainingToday(s, r, T0 + 61e6); }) }); }
ok('一起成交：三個人湊一圈（三對都兩邊都選了），全部成交；對接過幾次照舊只算成交的', function () {
  var s = base(), slot = circle(s, true); C.judge(s, T0 + 60e6, {});
  assert.strictEqual(s.dockings.length, 3); assert.ok(s.dockings.every(function (d) { return d.traded && d.together; }));
  assert.strictEqual(s.holds.length, 6); assert.strictEqual(C.dockCount(s, J1), 2); assert.strictEqual(C.dockCount(s, J3), 2);
  assert.strictEqual(C.remainingToday(s, s.roles[0], T0 + 61e6), 900, '甲給了兩杯茶 100 點');
});
ok('一起成交：判定照那一微秒還沒寫帳時的事實，寫帳不再重判（條件用到可換的貨、對接過幾次時，前一對寫完帳不會害後一對不通）', function () {
  // 例 1：丙要求兩方都通、對方可換的貨 ≥ 5；乙的貨剛好 5 份（一首歌 2、空的 3）。甲↔乙先寫帳乙的空的少 1 份，不能害乙↔丙不通
  var s = base(), v3 = C.tomorrow(s, J3, T0 - DAY); v3.rules.conditions.push({ field: 'avail', op: '>=', value: 5 }); v3.rules.bothMustPass = true;
  s.roles[1].stock.e2.avail = 3;
  var slot = circle(s, true); C.judge(s, T0 + 60e6, {});
  assert.ok(s.dockings.length === 3 && s.dockings.every(function (d) { return d.traded; }), s.dockings.map(function (d) { return d.reason; }).join(' | '));
  assert.strictEqual(s.holds.length, 6); [J1, J2, J3].forEach(function (x) { assert.strictEqual(C.dockCount(s, x), 2); });
  var d23 = s.dockings.find(function (d) { return d.a === J2 && d.b === J3; });
  assert.ok(d23.how && d23.gaveA === 200 && d23.gaveB === 10 && d23.itemsA[0].name === '一首歌' && d23.itemsB[0].name === '借書' && d23.verA === s.roles[1].versions[0].id && d23.verB === v3.id, '對接紀錄跟原本一樣：怎麼通的、各給多少、各拿出什麼、判定用的版本');
  // 例 2：條件換成「對方對接過幾次 ≤ 0」
  var s2 = base(), w3 = C.tomorrow(s2, J3, T0 - DAY); w3.rules.conditions.push({ field: 'dockCount', op: '<=', value: 0 }); w3.rules.bothMustPass = true;
  circle(s2, true); C.judge(s2, T0 + 60e6, {});
  assert.ok(s2.dockings.length === 3 && s2.dockings.every(function (d) { return d.traded; }), s2.dockings.map(function (d) { return d.reason; }).join(' | '));
  assert.strictEqual(s2.holds.length, 6); [J1, J2, J3].forEach(function (x) { assert.strictEqual(C.dockCount(s2, x), 2); });
  // 還沒有人選東西／都選好了
  var s3 = base(), sl = C.addSlot(s3, J1, T0 + 60e6, 5, null, T0, true); C.book(s3, J2, sl.id, T0);
  assert.strictEqual(C.togetherStatus(s3, sl), '還沒有人選東西'); C.setWants(s3, sl.id, J2, J1, ['y']); assert.strictEqual(C.togetherStatus(s3, sl), '一起成交：還差 甲 選 乙 的東西'); C.setWants(s3, sl.id, J1, J2, ['e2']); assert.strictEqual(C.togetherStatus(s3, sl), '都選好了');
});
ok('一起成交：有一對只有一邊選，整個時段不成交，點、貨、保留都沒動，紀錄寫是哪一對', function () {
  var s = base(), slot = circle(s, true); C.setWants(s, slot.id, J3, J2, []); var before = snapshot(s);
  C.judge(s, T0 + 60e6, {});
  assert.strictEqual(s.dockings.length, 3); assert.ok(s.dockings.every(function (d) { return !d.traded && d.together; }));
  assert.strictEqual(snapshot(s), before, '誰的點都沒給、貨都不動、沒有保留');
  assert.strictEqual(s.dockings[0].reason, '一起成交：乙 和 丙 不成（丙 沒選 乙 的東西），整個時段不成交');
  assert.ok(s.records.filter(function (r) { return r.kind === 'nodock'; }).length === 3 && /乙 和 丙 不成/.test(s.records.find(function (r) { return r.kind === 'nodock'; }).text));
  assert.strictEqual(C.dockCount(s, J1), 0); assert.strictEqual(C.ratio(s, J1).text, '還沒對接過');
  assert.ok(slot.judged && slot.docked.length === 2 && slot.missed.length === 0);
});
ok('一起成交：有選東西的人沒到場，整個時段不成交；他照舊記錯過', function () {
  var s = base(), slot = circle(s, true); C.setPresent(s, J3, slot.id, false); var before = snapshot(s);
  C.judge(s, T0 + 60e6, {});
  assert.strictEqual(snapshot(s), before); assert.ok(s.dockings.length === 3 && s.dockings.every(function (d) { return !d.traded; }));
  assert.ok(/甲 和 丙 不成（丙 沒到達）/.test(s.dockings[0].reason) && /乙 和 丙 不成（丙 沒到達）/.test(s.dockings[0].reason), s.dockings[0].reason);
  assert.deepStrictEqual(slot.missed, [J3]); assert.ok(s.records.some(function (r) { return r.kind === 'miss'; }));
});
ok('一起成交：有選東西的一對條件不通，整個時段不成交', function () {
  var s = base(), v3 = C.tomorrow(s, J3, T0 - DAY); v3.rules.conditions.push({ field: 'avail', op: '>=', value: 20 }); v3.rules.bothMustPass = true;   // 丙要求兩方都通、對方可換 ≥ 20：甲預約時 21 份通
  var slot = circle(s, true); C.restock(s, J1, 'e1', -5); var before = snapshot(s); C.judge(s, T0 + 60e6, {});   // 那一微秒甲只剩 16 份，不通
  assert.strictEqual(snapshot(s), before); assert.ok(s.dockings.every(function (d) { return !d.traded; }));
  assert.ok(/甲 和 丙 不成（/.test(s.dockings[0].reason) && /整個時段不成交$/.test(s.dockings[0].reason), s.dockings[0].reason);
});
ok('一起成交：每一對單獨看都給得出、合起來超過當天剩的點或可換的貨，整個時段不成交', function () {
  var s = base(); s.roles[0].versions[0].dailyPoints = 80;   // 甲一天 80 點：一杯茶 50 給得出，兩杯 100 不行
  var slot = circle(s, true), before = snapshot(s); C.judge(s, T0 + 60e6, {});
  assert.strictEqual(snapshot(s), before); assert.ok(/甲 合起來要給 100 點，今天只剩 80 點/.test(s.dockings[0].reason), s.dockings[0].reason);
  var s2 = base(); s2.roles[0].stock.y.avail = 1;   // 一杯茶只剩 1 份，兩個人都選
  var slot2 = circle(s2, true), b2 = snapshot(s2); C.judge(s2, T0 + 60e6, {});
  assert.strictEqual(snapshot(s2), b2); assert.ok(/甲 的「一杯茶」合起來要 2 份，可換 1 份/.test(s2.dockings[0].reason), s2.dockings[0].reason);
});
ok('一起成交：有一對兩邊都沒選對方的東西，不影響其他對成交', function () {
  var s = base(), slot = circle(s, true); C.setWants(s, slot.id, J2, J3, []); C.setWants(s, slot.id, J3, J2, []);
  C.judge(s, T0 + 60e6, {});
  var t = s.dockings.filter(function (d) { return d.traded; }), n = s.dockings.filter(function (d) { return !d.traded; });
  assert.strictEqual(t.length, 2); assert.strictEqual(n.length, 1); assert.strictEqual(n[0].reason, '一換一：兩邊都沒選對方的東西'); assert.strictEqual(s.holds.length, 4);
  assert.deepStrictEqual(C.togetherMissing(s, slot), []);
});
ok('一起成交：那一微秒之前列得出還差誰；同樣的情況沒勾，照舊只成交兩邊都選了的那幾對', function () {
  var s = base(), slot = circle(s, true); C.setWants(s, slot.id, J3, J2, []);
  assert.deepStrictEqual(C.togetherMissing(s, slot), ['還差 丙 選 乙 的東西']);
  var s2 = base(), slot2 = circle(s2, false); C.setWants(s2, slot2.id, J3, J2, []); C.judge(s2, T0 + 60e6, {});
  assert.strictEqual(s2.dockings.filter(function (d) { return d.traded; }).length, 2); assert.strictEqual(s2.holds.length, 4); assert.ok(!slot2.together);
});
ok('刪時段在規則層：只有自己的、沒人預約的未來時段', function () {
  var s = base(), a = C.addSlot(s, J1, T0 + 60e6, 1, null, T0), b = C.addSlot(s, J1, T0 + 120e6, 1, null, T0); C.book(s, J2, b.id, T0);
  throws(function () { C.deleteSlot(s, J2, a.id, T0); }, /不是你的/); throws(function () { C.deleteSlot(s, J1, b.id, T0); }, /已經有人預約/); throws(function () { C.deleteSlot(s, J1, a.id, T0 + 61e6); }, /已經過了/);
  C.deleteSlot(s, J1, a.id, T0); assert.strictEqual(s.roles[0].slots.length, 1);
});
ok('存檔：舊存檔的時段都是沒勾；勾了的讀回來還是勾著；一直保留的寫「一直保留」', function () {
  var s = base(), a = C.addSlot(s, J1, T0 + 60e6, 1, null, T0, true), b = C.addSlot(s, J1, T0 + 120e6, 1, null, T0); delete b.together;
  var r = C.cleanRole(JSON.parse(JSON.stringify(s.roles[0])));
  assert.strictEqual(r.slots[0].together, true); assert.strictEqual(r.slots[1].together, false);
  assert.strictEqual(C.untilText({ untilDay: null }), '一直保留'); assert.ok(/^保留到 \d{4}-/.test(C.untilText({ untilDay: 20000 })));
});
ok('序號永遠不重複用：J1 不玩了再創一個拿到的不是 J1；新角色沒有舊紀錄；連續發到 10 號以上；存檔讀回來照樣不重複', function () {
  var s = C.fresh({ history: false }); var me = C.createPlayer(s, { name: '小明' }, T0); assert.strictEqual(me.serial, J1);
  var slot = C.addSlot(s, J2, T0 + 60e6, 1, null, T0); C.book(s, J1, slot.id, T0); C.setPresent(s, J1, slot.id, true); C.setWants(s, J1 === J1 ? slot.id : '', J1, J2, ['r2c']); C.setWants(s, slot.id, J2, J1, []);
  C.accept(s, J1, J3, T0); C.judge(s, T0 + 60e6, {});
  C.quit(s, J1, T0 + 61e6, true); assert.strictEqual(s.records.filter(function (r) { return r.kind === 'quit'; })[0].serial, J1);
  var r2 = C.createPlayer(s, { name: '小華' }, T0 + 62e6);
  assert.notStrictEqual(r2.serial, J1); assert.strictEqual(C.abbrev(r2.serial), 'J6');
  assert.strictEqual(C.dockCount(s, r2.serial), 0); assert.strictEqual(C.ratio(s, r2.serial).text, '還沒對接過'); assert.ok(!s.acceptances.some(function (x) { return x.who === r2.serial; }));
  assert.ok(s.dockings[0].a === J1 || s.dockings[0].b === J1, 'J1 的舊紀錄照舊寫 J1'); assert.ok(/^J1 /.test(s.records.find(function (r) { return r.kind === 'quit'; }).text));
  assert.ok(s.roles.indexOf(C.blankRole()) < 0 && C.blankRole().serial !== r2.serial && !/^0/.test(C.BLANK), '空殼的序號不會撞號');
  for (var i = 0; i < 8; i++) C.createRole(s, { name: 'x' + i }, T0);
  assert.strictEqual(C.abbrev(s.roles[s.roles.length - 1].serial), 'I14'); assert.strictEqual(new Set(s.issued).size, s.issued.length);
  // 存檔讀回來：issued 留著；舊存檔沒 issued 也從出現過的序號補回來
  var saved = JSON.parse(JSON.stringify(s)); global.localStorage = { getItem: function () { return JSON.stringify(saved); }, setItem: function () {} };
  var back = C.load(); assert.deepStrictEqual(back.issued.slice().sort(), s.issued.slice().sort());
  delete saved.issued; var back2 = C.load(); assert.ok(back2.issued.indexOf(J1) >= 0 && back2.issued.indexOf(r2.serial) >= 0, '舊存檔：不玩了的 J1 從紀錄補回來');
  var r3 = C.createPlayer(back2, { name: '再來' }, T0); assert.ok(r3.serial !== J1 && back2.roles.filter(function (r) { return r.serial === r3.serial; }).length === 1);
  delete global.localStorage;
});
ok('到達是事先確認：預約時預設確認、可以選不要；之後取消、再確認；存在時段上、洗過存檔還在；取消預約一併拿掉；主人開時段就算到達；沒預約不能確認', function () {
  var s = base(), slot = C.addSlot(s, J1, T0 + 60e6, 5, null, T0); C.book(s, J2, slot.id, T0);
  assert.ok(C.isPresent(s, J2, slot.id), '預約時預設就確認到達');
  var slotB = C.addSlot(s, J1, T0 + 90e6, 5, null, T0); C.book(s, J2, slotB.id, T0, false); assert.ok(!C.isPresent(s, J2, slotB.id), '預約時選不要：沒確認');
  C.setPresent(s, J2, slot.id, false);
  assert.ok(!C.isPresent(s, J2, slot.id) && C.isPresent(s, J1, slot.id), '取消了；主人自動算到達');
  C.setPresent(s, J2, slot.id, true); assert.ok(C.isPresent(s, J2, slot.id));
  var r = C.cleanRole(JSON.parse(JSON.stringify(s.roles[0]))); assert.deepStrictEqual(r.slots[0].confirmed, [J2], '讀存檔的檢查留著確認');
  C.setPresent(s, J2, slot.id, false); assert.ok(!C.isPresent(s, J2, slot.id), '可以取消');
  C.setPresent(s, J2, slot.id, true); C.cancelBooking(s, J2, slot.id); assert.deepStrictEqual(slot.confirmed, [], '取消預約一併拿掉');
  throws(function () { C.setPresent(s, J3, slot.id, true); }, /先預約/);
});
ok('補判：頁面沒開著過了好幾個時段，下次照時間順序一個一個補判，每個都照那個時段的那一微秒；確認了的成交、沒確認的錯過；一起成交的也能補判；保留到期照順序', function () {
  var s = base();
  var a = C.addSlot(s, J1, T0 + 60e6, 5, null, T0), b = C.addSlot(s, J2, T0 + 120e6, 5, null, T0), c = C.addSlot(s, J1, T0 + 180e6, 5, null, T0, true);
  C.book(s, J2, a.id, T0); C.setPresent(s, J2, a.id, true); C.setWants(s, a.id, J2, J1, ['x']); C.setWants(s, a.id, J1, J2, ['e2']);   // 甲畫一張圖（保留 2 天）
  C.book(s, J1, b.id, T0, false);   // 沒確認
  C.book(s, J3, c.id, T0); C.setPresent(s, J3, c.id, true); C.setWants(s, c.id, J3, J1, ['y']); C.setWants(s, c.id, J1, J3, ['e3']);   // 一起成交、確認了
  var out = C.judge(s, T0 + 5 * DAY, {});
  assert.ok(out.every(function (o) { return o.late; }), '都是補判');
  assert.deepStrictEqual(s.records.filter(function (r) { return r.kind !== 'expire'; }).map(function (r) { return r.at; }), [T0 + 60e6, T0 + 120e6, T0 + 180e6], '照時間順序，紀錄時間是各時段的那一微秒');
  var da = s.dockings.find(function (d) { return d.slot === a.id; }), dc = s.dockings.find(function (d) { return d.slot === c.id; });
  assert.ok(da.traded && da.atUs === T0 + 60e6 && dc.traded && dc.together && dc.atUs === T0 + 180e6, '確認了的照那一微秒成交，一起成交的也補判');
  assert.deepStrictEqual(b.missed, [J1]); assert.ok(/沒確認到達/.test(s.records.find(function (r) { return r.kind === 'miss'; }).text), '沒確認的記錯過');
  assert.ok(out.some(function (o) { return o.missed === J1 && o.slot === b; }), '補判的結果列得出錯過');
  var hx = s.holds.find(function (h) { return h.resource === 'x'; }); assert.strictEqual(hx.status, 'expired', '第一個時段保留的畫（2 天）到 5 天後已經到期作廢，照順序處理');
  assert.strictEqual(C.expire(s, T0 + 5 * DAY), 0);
  // 預約時確認了就算到達；取消了就錯過
  var s2 = base(), d2 = C.addSlot(s2, J1, T0 + 60e6, 5, null, T0); C.book(s2, J2, d2.id, T0);
  C.judge(s2, T0 + 60.2e6); assert.deepStrictEqual(d2.docked, [J2]);
  var s3 = base(), d3 = C.addSlot(s3, J1, T0 + 60e6, 5, null, T0); C.book(s3, J2, d3.id, T0); C.setPresent(s3, J2, d3.id, false); C.judge(s3, T0 + 60.2e6); assert.deepStrictEqual(d3.missed, [J2]);
});
ok('到達：舊存檔的 declined 照樣讀得進來（直接丟掉），確認照舊', function () {
  var s = base(), slot = C.addSlot(s, J1, T0 + 60e6, 5, null, T0); C.book(s, J2, slot.id, T0);
  var raw = JSON.parse(JSON.stringify(s.roles[0])); raw.slots[0].declined = [J3]; raw.slots[0].confirmed = [J2];
  var r = C.cleanRole(raw); assert.deepStrictEqual(r.slots[0].confirmed, [J2]); assert.strictEqual(r.slots[0].declined, undefined);
  assert.strictEqual(C.autoConfirm, undefined, '沒有站上終點台自動確認了');
});
ok('家規網站：選填，只收 https:// 開頭的網址，別的存不進去；跟家規一樣明天起生效', function () {
  var s = base();
  throws(function () { C.setSite(s, J1, 'http://example.com', T0); }, /https/); throws(function () { C.setSite(s, J1, 'javascript:alert(1)', T0); }, /https/); throws(function () { C.setSite(s, J1, 'example.com', T0); }, /https/);
  throws(function () { C.setRules(s, J1, { site: 'ftp://x' }, T0); }, /https/);
  assert.strictEqual(C.setSite(s, J1, ' https://example.com/rules ', T0), 'https://example.com/rules');
  assert.strictEqual(C.version(s.roles[0], T0).rules.site, '', '今天的不變'); assert.strictEqual(C.pending(s.roles[0], T0).rules.site, 'https://example.com/rules', '明天起生效');
  assert.strictEqual(C.setSite(s, J1, '', T0), '', '可以清掉');
  var r = C.cleanRole(JSON.parse(JSON.stringify(s.roles[0]))); assert.strictEqual(r.versions[r.versions.length - 1].rules.site, '');
  var raw = JSON.parse(JSON.stringify(s.roles[0])); raw.versions[0].rules.site = 'http://bad'; assert.strictEqual(C.cleanRole(raw).versions[0].rules.site, '', '存檔裡不是 https 的讀進來也不留');
});
ok('序號：簡寫、11 位數都找得到，找不到回 null；隨機不會挑到自己和不玩了的人', function () {
  var s = base();
  assert.strictEqual(C.findRole(s, 'J2').name, '乙'); assert.strictEqual(C.findRole(s, 'j3').name, '丙'); assert.strictEqual(C.findRole(s, ' 00000000002 ').name, '乙');
  assert.strictEqual(C.findRole(s, 'J9'), null); assert.strictEqual(C.findRole(s, '00000000009'), null); assert.strictEqual(C.findRole(s, 'abc'), null); assert.strictEqual(C.findRole(s, ''), null);
  C.quit(s, J3, T0, true);
  for (var k = 0; k < 50; k++) { var r = C.randomRole(s, J1, k / 50); assert.ok(r && r.serial !== J1 && r.serial !== J3, '不挑自己、不挑不玩了的'); }
  assert.strictEqual(C.randomRole(s, J1, 0.99).serial, J2);
  var only = { roles: [s.roles[0]] }; assert.strictEqual(C.randomRole(only, J1, 0.5), null, '沒有別人回 null');
});
ok('公告欄：掛（需要、種類、可以給、上限、期限都存得住）、撤（只有掛的人）、過期拿掉；可以給要從自己的資源表選', function () {
  var s = base(), today = C.dayNum(T0);
  throws(function () { C.postNotice(s, J1, { need: '', give: ['y'], cap: 3 }, T0); }, /需要/);
  throws(function () { C.postNotice(s, J1, { need: '修腳踏車', give: ['p'], cap: 3 }, T0); }, /自己的資源表/);
  throws(function () { C.postNotice(s, J1, { need: '修腳踏車', give: ['y'], cap: 1 }, T0); }, /至少 2/);
  throws(function () { C.postNotice(s, J1, { need: '修腳踏車', give: ['y'], cap: 3, untilDay: today - 1 }, T0); }, /過去/);
  var n = C.postNotice(s, J1, { need: '修腳踏車', kind: '修理', give: ['y', 'x', 'y'], cap: 3, untilDay: today + 2 }, T0);
  assert.deepStrictEqual([n.need, n.kind, n.give, n.cap, n.untilDay, n.owner], ['修腳踏車', '修理', ['y', 'x'], 3, today + 2, J1]);
  assert.deepStrictEqual([n.parent, n.noReport], [null, false], '沒接在誰下面、不用回報預設關');
  var back = JSON.parse(JSON.stringify(s)); assert.deepStrictEqual(back.notices[0].cap, 3);
  var n2 = C.postNotice(s, J2, { need: '一杯茶', give: ['e2'], cap: 2 }, T0);
  throws(function () { C.removeNotice(s, J1, n2.id); }, /只有掛的人/);
  C.removeNotice(s, J2, n2.id); assert.strictEqual(s.notices.length, 1, '撤掉');
  assert.strictEqual(C.expireNotices(s, T0 + 2 * DAY), 0, '期限那天還在');
  assert.strictEqual(C.expire(s, T0 + 3 * DAY), 1, '過了期限自動拿掉'); assert.strictEqual(s.notices.length, 0);
});
ok('公告欄搜尋：一個關鍵字同時查公告（需要、種類、可以給）和所有人的資源表（名稱、定義），分開回傳；每個結果的通不通跟預約用同一個判斷', function () {
  var s = base();
  var v2 = C.tomorrow(s, J2, T0 - DAY); v2.rules.conditions.push({ field: 'avail', op: '>=', value: 100 }); v2.rules.bothMustPass = true;   // 乙要求兩方都通、對方可換 ≥ 100：甲不通
  C.postNotice(s, J2, { need: '想喝茶', kind: '飲料', give: ['p'], cap: 2 }, T0);
  C.postNotice(s, J3, { need: '修理書架', kind: '修理', give: ['q'], cap: 2 }, T0);
  var r = C.search(s, J1, '茶', T0);
  assert.strictEqual(r.notices.length, 1); assert.strictEqual(r.notices[0].role.serial, J2);
  assert.strictEqual(r.resources.length, 0, '資源裡沒有茶（甲自己的一杯茶不算）');
  assert.strictEqual(C.search(s, J1, '修理', T0).notices.length, 1, '查種類'); assert.strictEqual(C.search(s, J1, '一首歌', T0).notices.length, 1, '查可以給的東西');
  var rb = C.search(s, J1, '借', T0); assert.strictEqual(rb.resources.length, 1); assert.strictEqual(rb.resources[0].resource.name, '借書');
  C.version(s.roles[2], T0).resources[0].def = '圖書館的書'; assert.strictEqual(C.search(s, J1, '圖書館', T0).resources.length, 1, '查定義');
  var all = C.search(s, J1, '', T0); assert.strictEqual(all.notices.length, 2);
  all.notices.concat(all.resources).forEach(function (x) { assert.deepStrictEqual(x.elig, C.eligible(s, x.role, s.roles[0], T0), '跟預約同一個判斷'); });
  assert.strictEqual(all.notices.find(function (x) { return x.role.serial === J2; }).elig.ok, false, '甲不通乙的條件');
  var slot = C.addSlot(s, J2, T0 + 60e6, 2, null, T0); throws(function () { C.book(s, J1, slot.id, T0); }, /條件不通/);
  assert.strictEqual(all.notices.find(function (x) { return x.role.serial === J3; }).elig.ok, true);
});
ok('引路人一直掛著教學用的公告（需要：空的；可以給：空的），沒有期限，跟他成交也不拿掉', function () {
  var s = C.fresh({ history: false }), J4 = C.GUIDE, gn = s.notices.filter(function (n) { return n.owner === J4; });
  assert.strictEqual(gn.length, 1); assert.strictEqual(gn[0].need, '空的'); assert.deepStrictEqual(C.giveNames(s, gn[0], T0), ['空的']); assert.strictEqual(gn[0].untilDay, null);
  var me = C.createPlayer(s, { name: '小明', firstItem: { name: '空的', price: 0, qty: 1 } }, T0), e = C.version(me, T0).resources[0];
  var slot = C.addSlot(s, J4, T0 + 60e6, 1, null, T0); C.book(s, J1, slot.id, T0); C.setWants(s, slot.id, J1, J4, ['r4e']); C.setWants(s, slot.id, J4, J1, [e.id]);
  C.judge(s, T0 + 60e6); assert.ok(s.dockings[0].traded);
  C.expire(s, T0 + 400 * DAY); assert.strictEqual(s.notices.filter(function (n) { return n.owner === J4; }).length, 1, '成交、過了很久都還在');
  assert.strictEqual(C.search(s, J1, '空的', T0).notices.length, 1);
});
ok('存檔：新的名字；第一次打開讀得到 v8 的存檔就搬過來（補上引路人的公告），讀不了就從頭開始', function () {
  var store = {}; global.localStorage = { getItem: function (k) { return store[k] == null ? null : store[k]; }, setItem: function (k, v) { store[k] = v; } };
  assert.strictEqual(C.KEY, 'arrive-v9');
  var v8 = C.fresh({ history: false }); v8.v = 8; v8.notices = undefined; C.demoMe(v8, T0); v8.tutorial = { step: 'done' };
  v8.roles[1].slots[0].declined = ['00000000001']; store['arrive-v8'] = JSON.stringify(v8);
  var st = C.load(); assert.strictEqual(st.v, 9); assert.strictEqual(st.roles[0].name, '我'); assert.strictEqual(st.tutorial.step, 'done');
  assert.strictEqual(st.notices.filter(function (n) { return n.owner === C.GUIDE; }).length, 1, '搬過來時補上引路人的公告'); assert.ok(store['arrive-v9'], '搬過來就存成新名字');
  st.notices.push(C.postNotice(st, '00000000001', { need: '借梯子', give: ['r1b'], cap: 4, untilDay: C.dayNum(T0) + 5 }, T0)); st.notices.pop();
  C.save(st); var st2 = C.load(); assert.strictEqual(st2.notices.length, 2); assert.strictEqual(st2.notices[1].cap, 4); assert.strictEqual(st2.notices[1].untilDay, C.dayNum(T0) + 5);
  store = {}; store['arrive-v8'] = '{壞掉'; var st3 = C.load(); assert.strictEqual(st3.me, -1, '讀不了就從頭開始'); assert.strictEqual(st3.roles.length, 4);
  delete global.localStorage;
});
/* ---------- 第 2 輪：每一筆、藏、看一間屋、外觀、存檔 ---------- */
function houseBase() { var s = base(); s.entries = []; return s; }
var allText = function (o) { return JSON.stringify(o); };
ok('每一筆：約的時候就有（未來的預約），取消預約就沒了；判完寫上成交、不成交、不成立、錯過和原因', function () {
  var s = houseBase();
  var a = C.addSlot(s, J1, T0 + 60e6, 5, null, T0); C.book(s, J2, a.id, T0); C.book(s, J3, a.id, T0);
  assert.strictEqual(s.entries.length, 3, '三個人：三筆（甲乙、甲丙、乙丙）'); assert.ok(s.entries.every(function (e) { return e.status === 'booked' && e.atUs === T0 + 60e6; }));
  C.cancelBooking(s, J3, a.id); assert.strictEqual(s.entries.length, 1, '取消預約就沒了'); assert.deepStrictEqual([s.entries[0].a, s.entries[0].b], [J1, J2]);
  C.setWants(s, a.id, J2, J1, ['y']); C.setWants(s, a.id, J1, J2, ['e2']); C.judge(s, T0 + 60e6);
  var e = s.entries[0]; assert.strictEqual(e.status, 'traded'); assert.ok(e.docking);
  var b = C.addSlot(s, J1, T0 + 120e6, 5, null, T0); C.book(s, J2, b.id, T0); C.setWants(s, b.id, J2, J1, ['y']); C.judge(s, T0 + 120e6);
  var eb = s.entries.find(function (x) { return x.slot === b.id; }); assert.strictEqual(eb.status, 'nodock'); assert.ok(/一換一/.test(eb.reason), '不成交寫原因');
  var c = C.addSlot(s, J1, T0 + 180e6, 5, null, T0); C.book(s, J2, c.id, T0, false); C.judge(s, T0 + 180e6);
  var ec = s.entries.find(function (x) { return x.slot === c.id; }); assert.strictEqual(ec.status, 'miss'); assert.strictEqual(ec.reason, '乙 沒確認到達', '錯過也是一筆，寫誰沒確認到達');
  var v2 = C.tomorrow(s, J2, T0 - DAY); v2.rules.conditions.push({ field: 'avail', op: '>=', value: 15 }); v2.rules.bothMustPass = true;   // 乙要求兩方都通、對方可換 ≥ 15
  var d2 = C.addSlot(s, J2, T0 + 300e6, 5, null, T0); C.book(s, J1, d2.id, T0); C.setWants(s, d2.id, J1, J2, ['p']); C.setWants(s, d2.id, J2, J1, ['y']);
  C.restock(s, J1, 'e1', -10);   // 約的時候通，那一微秒可換的貨不夠 → 不成立
  C.judge(s, T0 + 300e6); var ed = s.entries.find(function (x) { return x.slot === d2.id; }); assert.strictEqual(ed.status, 'invalid'); assert.ok(/不通/.test(ed.reason), '不成立寫原因：' + ed.reason);
  var det = C.dayDetail(s, J1, J1, C.dayNum(T0)); var results = det.entries.map(function (x) { return x.result; });
  ['成交', '不成交', '錯過', '不成立'].forEach(function (r) { assert.ok(results.indexOf(r) >= 0, '明細有「' + r + '」'); });
  var tr = det.entries.find(function (x) { return x.status === 'traded'; }); assert.deepStrictEqual(tr.gave, [{ name: '一杯茶', price: 50, state: '保留中' }]); assert.deepStrictEqual(tr.got[0].name, '空的');
  // 對方不玩了，那一筆照樣顯示得出來（名字留著）
  C.quit(s, J2, T0 + 400e6, true);
  var det2 = C.dayDetail(s, J1, J1, C.dayNum(T0)); var x2 = det2.entries.find(function (x) { return x.status === 'traded'; });
  assert.strictEqual(x2.other.name, '乙'); assert.strictEqual(x2.other.gone, true); assert.strictEqual(x2.gave[0].name, '一杯茶');
  assert.ok(!s.entries.some(function (e) { return e.status === 'booked' && (e.a === J2 || e.b === J2); }), '不玩了的人未來的預約拿掉');
});
ok('每一筆：兌現和到期作廢寫進原本那一筆的狀態，不另外算一筆', function () {
  var s = houseBase(), a = C.addSlot(s, J1, T0 + 60e6, 5, null, T0); C.book(s, J2, a.id, T0); C.setWants(s, a.id, J2, J1, ['x', 'y']); C.setWants(s, a.id, J1, J2, ['e2']); C.judge(s, T0 + 60e6);
  var n = s.entries.length, h = s.holds.find(function (x) { return x.resource === 'y'; }); C.redeem(s, J2, h.id, T0 + DAY);
  C.expire(s, T0 + 4 * DAY);
  assert.strictEqual(s.entries.length, n, '兌現、到期不另外算一筆');
  var det = C.dayDetail(s, J1, J1, C.dayNum(T0)), e = det.entries[0];
  var st = {}; e.gave.forEach(function (it) { st[it.name] = it.state; });
  assert.ok(/^換了 \d\d-\d\d$/.test(st['一杯茶']), '換了 月-日：' + st['一杯茶']); assert.ok(/^到期作廢/.test(st['畫一張圖']), '畫保留 2 天，到期作廢：' + st['畫一張圖']);
  assert.ok(e.got[0].state === '保留中', '我拿到的空的還保留著');
});
ok('藏：每一筆兩邊各有設定，約的人在約的那一刻、主人在被約的那一刻照自己的「新的一筆預設」；之後在那一筆上隨時改，各管各的達秒屋', function () {
  var s = houseBase();
  C.setHouse(s, J1, { defaultVis: 'hidden' }); C.setHouse(s, J2, { defaultVis: 'neighbors' });
  var a = C.addSlot(s, J1, T0 + 60e6, 5, null, T0); C.book(s, J2, a.id, T0); C.book(s, J3, a.id, T0);
  var e12 = s.entries.find(function (e) { return e.b === J2 && e.a === J1; }), e23 = s.entries.find(function (e) { return (e.a === J2 && e.b === J3) || (e.a === J3 && e.b === J2); });
  assert.deepStrictEqual([e12.vis[J1], e12.vis[J2]], ['hidden', 'neighbors'], '主人照被約那一刻的預設、約的人照約那一刻的預設');
  assert.deepStrictEqual([e23.vis[J2], e23.vis[J3]], ['neighbors', 'public'], '兩個來約的人之間照各自約的那一刻');
  C.setHouse(s, J1, { defaultVis: 'public' }); assert.strictEqual(e12.vis[J1], 'hidden', '之後改預設，已經有的那一筆不變');
  C.setVis(s, J1, e12.id, 'public'); assert.strictEqual(e12.vis[J1], 'public', '在那一筆上改，馬上生效'); assert.strictEqual(e12.vis[J2], 'neighbors', '只改自己那一邊');
  throws(function () { C.setVis(s, J3, e12.id, 'hidden'); }, /只能改自己/); throws(function () { C.setVis(s, J1, e12.id, 'secret'); }, /公開/);
  var raw = JSON.parse(JSON.stringify(s)); raw.entries[0].vis[J1] = 'weird'; global.localStorage = { getItem: function () { return JSON.stringify(Object.assign(raw, { v: 9, tutorial: { step: 'done' } })); }, setItem: function () {} };
  var back = C.load(); assert.strictEqual(back.entries[0].vis[J1], 'hidden', '讀檔讀到不認得的值就當全藏'); delete global.localStorage;
});
ok('看一間屋：對接的兩個人永遠看得到；陌生人只看到蓋布和幾筆；這一輪沒有鄰居，只給鄰居看的陌生人看不到；藏了數字照算', function () {
  var s = houseBase();
  var a = C.addSlot(s, J1, T0 + 60e6, 5, null, T0); C.book(s, J2, a.id, T0); C.setWants(s, a.id, J2, J1, ['y']); C.setWants(s, a.id, J1, J2, ['e2']); C.judge(s, T0 + 60e6);
  var b = C.addSlot(s, J1, T0 + 120e6, 5, null, T0); C.book(s, J3, b.id, T0); C.setWants(s, b.id, J3, J1, ['y']); C.setWants(s, b.id, J1, J3, ['e3']); C.judge(s, T0 + 120e6);
  var e1 = s.entries.find(function (e) { return e.slot === a.id; }), e2 = s.entries.find(function (e) { return e.slot === b.id; });
  var day = C.dayNum(T0), dc0 = C.dockCount(s, J1), ratio0 = C.ratio(s, J1).text;
  C.setVis(s, J1, e1.id, 'hidden'); C.setVis(s, J1, e2.id, 'neighbors');
  assert.strictEqual(C.isNeighbor(s, J1, J3), false, '這一輪沒有人是鄰居');
  var stranger = C.dayDetail(s, J1, null, day);
  assert.strictEqual(stranger.entries.length, 0); assert.strictEqual(stranger.covered, 2, '陌生人：兩筆都蓋著');
  var vb = C.viewHouse(s, J1, null, T0 + 200e6), brick = vb.bricks.find(function (x) { return x.day === day; });
  assert.ok(brick.cover && !brick.lit && !brick.mark, '那天全蓋著：磚只看得到布');
  var vJ2 = C.dayDetail(s, J1, J2, day); assert.strictEqual(vJ2.entries.length, 1); assert.strictEqual(vJ2.entries[0].other.serial, J2, '對接的人看得到自己那一筆'); assert.strictEqual(vJ2.covered, 1, '另一筆（只給鄰居看）蓋著');
  var vJ3 = C.dayDetail(s, J1, J3, day); assert.strictEqual(vJ3.entries[0].other.serial, J3, '只給鄰居看的，對接的人還是看得到');
  assert.ok(vJ2.entries[0].gave[0].state, '對接的人看得到選好的東西現在怎樣');
  C.setVis(s, J1, e1.id, 'public'); var pub = C.dayDetail(s, J1, null, day);
  assert.strictEqual(pub.entries.length, 1); assert.strictEqual(pub.entries[0].gave[0].state, undefined, '選好的東西的狀態只給對接的兩個人'); assert.strictEqual(pub.covered, 1);
  assert.strictEqual(C.viewHouse(s, J1, null, T0 + 200e6).bricks.find(function (x) { return x.day === day; }).lit, 1, '亮度只算看得到的成交');
  assert.strictEqual(C.dockCount(s, J1), dc0); assert.strictEqual(C.ratio(s, J1).text, ratio0, '藏了，對接過幾次和換點比例照算');
  // 藏只藏自己這一邊：乙沒藏，乙的達秒屋照樣看得到這一筆
  C.setVis(s, J1, e1.id, 'hidden'); assert.strictEqual(C.dayDetail(s, J2, null, day).entries.length, 1, '對方的達秒屋照樣看得到');
  // 整間屋只給鄰居看：陌生人只看到外觀和牌子
  C.setHouse(s, J1, { visibility: 'neighbors', sign: '甲的家' });
  var closed = C.viewHouse(s, J1, null, T0 + 200e6);
  assert.ok(closed.closed && closed.sign === '' && closed.age === null && closed.bricks.every(function (x) { return x.lit === undefined && x.cover === undefined; }), '只給鄰居看：沒有亮暗、門牌沒有字');
  assert.ok(closed.look.blocks.length > 0 && closed.bricks.every(function (x) { return x.g; }), '外觀（自己蓋的）和日曆上的磚位置還看得到'); assert.ok(C.dayDetail(s, J1, null, day).closed, '點不開');
  assert.ok(!C.viewHouse(s, J1, J1, T0 + 200e6).closed, '自己看得到');
  assert.strictEqual(C.viewHouse(s, J1, J2, T0 + 200e6).closed, true, '對接過的人也不是鄰居，整間屋看不到');
});
ok('不洩漏：給陌生人的回傳整份轉成文字，找不到藏起來那幾筆的對方序號、名字、東西名稱', function () {
  var s = houseBase();
  C.createRole(s, { serial: '00000000005', name: '秘密客', dailyPoints: 500, rules: {}, resources: [{ id: 'zz', name: '神秘禮物', price: 7, keepDays: null, avail: 5 }, { id: 'z0', name: '戊空', price: 0, keepDays: null, avail: 5 }] }, T0 - DAY);
  var a = C.addSlot(s, J1, T0 + 60e6, 5, null, T0); C.book(s, '00000000005', a.id, T0); C.setWants(s, a.id, '00000000005', J1, ['y']); C.setWants(s, a.id, J1, '00000000005', ['zz']); C.judge(s, T0 + 60e6);
  C.setVis(s, J1, s.entries[0].id, 'hidden');
  var day = C.dayNum(T0), txt = allText(C.viewHouse(s, J1, null, T0 + 100e6)) + allText(C.dayDetail(s, J1, null, day)) + allText(C.viewHouse(s, J1, J2, T0 + 100e6)) + allText(C.dayDetail(s, J1, J2, day));
  ['00000000005', 'I5', '秘密客', '神秘禮物', '戊空'].forEach(function (w) { assert.ok(txt.indexOf(w) < 0, '回傳裡找不到「' + w + '」'); });
  assert.ok(/"covered":1/.test(txt), '只知道那裡有一筆');
});
ok('引路人那一邊的教學紀錄固定全藏，不能改；玩家那一邊照自己的', function () {
  var s = C.fresh({ history: false }), J4 = C.GUIDE, me = C.createPlayer(s, { name: '小明', firstItem: { name: '空的', price: 0, qty: 1 } }, T0), e0 = C.version(me, T0).resources[0];
  var slot = C.addSlot(s, J4, T0 + 60e6, 1, null, T0); C.book(s, J1, slot.id, T0); C.setWants(s, slot.id, J1, J4, ['r4e']); C.setWants(s, slot.id, J4, J1, [e0.id]); C.judge(s, T0 + 60e6);
  var e = s.entries[0]; assert.ok(e.tutorial); assert.strictEqual(e.vis[J4], 'hidden'); assert.strictEqual(e.vis[J1], 'public');
  throws(function () { C.setVis(s, J4, e.id, 'public'); }, /教學紀錄固定全藏/);
  assert.strictEqual(C.dayDetail(s, J4, null, C.dayNum(T0)).covered, 1, '別人看引路人的屋：教學那一筆蓋著');
  var mine = C.dayDetail(s, J1, J1, C.dayNum(T0)); assert.ok(mine.entries[0].tutorial, '自己那一筆標「教學」');
  assert.ok(C.viewHouse(s, J1, null, T0 + 61e6).bricks.slice(-1)[0].lit === 1, '達秒屋那塊磚照樣亮');
});
ok('門牌和磚：幾歲幾天（滿 365 天 1 歲，創角色那天 0 歲 0 天）、一天一塊、換日照 dayNum、未來有預約的那幾天是虛線（中間空著）、那天生效的規則表和資源表', function () {
  var s = houseBase(), born = T0 - 400 * DAY;
  C.createRole(s, { serial: '00000000006', name: '老人家', dailyPoints: 700, rules: { uses: ['舊用途'] }, resources: [{ id: 'o1', name: '舊東西', price: 5, keepDays: null, avail: 3 }] }, born);
  var v = C.viewHouse(s, '00000000006', null, T0);
  assert.strictEqual(v.age.text, '1 歲 35 天'); assert.strictEqual(v.bricks.length, 401, '創角色那天到今天每天一塊');
  assert.strictEqual(C.viewHouse(s, J1, null, T0).age.text, '0 歲 0 天', '創角色那天 0 歲 0 天'); assert.strictEqual(C.viewHouse(s, J1, null, T0).bricks.length, 1);
  var midnight = (function () { var d = new Date(T0 / 1000); d.setHours(23, 59, 59, 0); return d.getTime() * 1000; })();
  assert.strictEqual(C.viewHouse(s, J1, null, midnight).bricks.length, 1, '同一天晚上還是一塊'); assert.strictEqual(C.viewHouse(s, J1, null, midnight + 2e6).bricks.length, 2, '過了午夜換日多一塊');
  var f1 = C.addSlot(s, '00000000006', T0 + 3 * DAY, 2, null, T0), f2 = C.addSlot(s, '00000000006', T0 + 6 * DAY, 2, null, T0);
  C.book(s, J1, f1.id, T0); C.book(s, J1, f2.id, T0);
  var fut = C.viewHouse(s, '00000000006', null, T0).bricks.filter(function (x) { return x.future; });
  assert.deepStrictEqual(fut.map(function (x) { return x.day - C.dayNum(T0); }), [3, 6], '未來只有有預約的那兩天，中間空著'); assert.ok(fut.every(function (x) { return x.booked; }));
  C.cancelBooking(s, J1, f2.id); assert.strictEqual(C.viewHouse(s, '00000000006', null, T0).bricks.filter(function (x) { return x.future; }).length, 1, '取消預約那塊虛線磚就沒了');
  C.setRules(s, '00000000006', { uses: ['新用途'] }, T0); C.addResource(s, '00000000006', { name: '新東西', price: 9 }, T0);
  var old = C.dayDetail(s, '00000000006', null, C.dayNum(T0)), nxt = C.dayDetail(s, '00000000006', null, C.dayNum(T0) + 1);
  assert.deepStrictEqual(old.rules.uses, ['舊用途']); assert.deepStrictEqual(old.resources.map(function (x) { return x.name; }), ['舊東西'], '今天生效的是舊的');
  assert.deepStrictEqual(nxt.rules.uses, ['新用途']); assert.deepStrictEqual(nxt.resources.map(function (x) { return x.name; }), ['舊東西', '新東西'], '明天那一塊是新的');
});
/* ---------- 第 3 輪：大門磚、地皮、自己蓋 ---------- */
// 某一天（年、月、日，本機日期）的 dayNum
function dn(y, m, d) { return Math.round(Date.UTC(y, m - 1, d) / 86400000); }
/* ---------- 第 4 輪：日曆長在房子上、門是一塊方塊 ---------- */
// 某一天（年、月、日）的 dayNum
function dn(y, m, d) { return Math.round(Date.UTC(y, m - 1, d) / 86400000); }
// 一個很久以前創的角色（bornDay 是 dayNum），回 state 和角色
function oldRole(bornDay, dir) { var s = houseBase(), b = bornDay * 86400000 * 1000 + 12 * 3600e6; C.createRole(s, { serial: '00000000006', name: '老人家', dailyPoints: 700, rules: {}, resources: [], house: { template: 'house', calDir: dir || 'up' } }, b); C.growCalendars(s, T0); return { s: s, r: C.roleOf(s, '00000000006'), h: C.houseOf(C.roleOf(s, '00000000006')) }; }
ok('日曆：創角色那個月就有第一塊在起點 [-2, 0]；每個月第一天換日長一塊，補長 230、420、800 天塊數對；上、下、左、右各長一次的位置', function () {
  var s = houseBase(), h = C.houseOf(s.roles[0]);
  assert.deepStrictEqual(h.cal, { dir: 'up', blocks: [[-2, 0]] }, '新角色：第一塊在起點、預設往上'); assert.strictEqual(C.monthIndex(C.bornOf(s.roles[0]), C.dayNum(T0)), 0);
  assert.deepStrictEqual(C.calSpot(dn(2025, 10, 15), dn(2025, 10, 15)), { m: 0, row: 2, col: 3 }, '2025-10-15 星期三：第 1 塊、第 3 排、星期三那一欄');
  assert.deepStrictEqual(C.calSpot(dn(2025, 10, 15), dn(2025, 11, 1)), { m: 1, row: 0, col: 6 }, '11 月 1 日星期六：第 2 塊第 1 排最右邊');
  assert.strictEqual(C.calSpot(dn(2025, 10, 15), dn(2025, 10, 1)), null, '創角色以前沒有磚');
  assert.deepStrictEqual(C.calMonth(dn(2025, 10, 15), 3), { y: 2026, m: 1 }); assert.strictEqual(C.monthFirstDay(dn(2025, 10, 15), 1), dn(2025, 11, 1));
  [230, 420, 800].forEach(function (days) { var o = oldRole(C.dayNum(T0) - days), want = C.monthIndex(C.bornOf(o.r), C.dayNum(T0)) + 1; assert.strictEqual(o.h.cal.blocks.length, want, days + ' 天：補長到這個月，' + want + ' 塊'); assert.ok(want >= Math.floor(days / 31) && want <= Math.ceil(days / 28) + 1); });
  // 每個月第一天換日長一塊：把「現在」撥到下個月 1 號
  var born = C.bornOf(s.roles[0]), next = C.monthFirstDay(born, 1) * 86400000 * 1000 + 3600e6;
  assert.strictEqual(C.growCalendars(s, T0), false, '還沒換月：不長'); assert.strictEqual(h.cal.blocks.length, 1);
  assert.strictEqual(C.growCalendars(s, next), true, '下個月 1 號換日：長一塊'); assert.strictEqual(h.cal.blocks.length, 2); assert.deepStrictEqual(h.cal.blocks[1], [-2, 2], '往上：y+2');
  assert.strictEqual(C.growCalendars(s, next), false, '同一個月再叫不會再長');
  // 上、下、左、右各一次：從 [-2,2] 往右 [0,2]（門在 (0,0,0)，門前是 (0,0..1,1)，[0,2] 的格子 y 2～3 碰不到）、再往上 [0,4]、往左 [-2,4]、往下 [-2,2] 被自己擋住 → 換上 [-2,6]
  var m = 2, grow = function (dir) { C.setCalDir(s, J1, dir); C.growCalendars(s, C.monthFirstDay(born, m++) * 86400000 * 1000 + 3600e6); return h.cal.blocks[h.cal.blocks.length - 1]; };
  assert.deepStrictEqual(grow('right'), [0, 2]); assert.deepStrictEqual(grow('up'), [0, 4]); assert.deepStrictEqual(grow('left'), [-2, 4]);
  assert.deepStrictEqual(grow('down'), [-2, 6], '往下碰到自己：照上、右、左、下的順序，第一個長得了的是上'); assert.strictEqual(h.cal.dir, 'down', 'dir 不會被改掉');
  assert.deepStrictEqual(grow('down'), [-2, 8], '下一塊還是先試 dir：下碰到自己 → 上'); C.setCalDir(s, J1, 'up');
  var p = C.nextCalPos(h, C.plotOf(0)); assert.deepStrictEqual([p.pos, p.dir, p.fallback], [[-2, 10], 'up', false], '預告：下一塊的位置和實際方向');
  throws(function () { C.setCalDir(s, J1, 'front'); }, /方向只有/); throws(function () { C.setCalDir(s, J1, 'back'); }, /方向只有/);
  assert.ok(C.viewHouse(s, J1, null, T0).cal.blocks.length === 7 && C.viewHouse(s, J1, null, T0).cal.months[0].first && C.viewHouse(s, J1, null, T0).cal.months[1].m === C.calMonth(born, 1).m, 'viewHouse 回每一塊的位置和月份');
});
ok('日曆：長不了照上、右、左、下換；不能到地底下、地皮外；往上不受地皮高度限制（補十七）；全都不行跳到同一面最近的空位；不會放滿；地皮照那個月第一天的年齡算', function () {
  var s = houseBase(), h = C.houseOf(s.roles[0]), born = C.bornOf(s.roles[0]), m = 1;
  var grow = function () { C.growCalendars(s, C.monthFirstDay(born, m++) * 86400000 * 1000 + 3600e6); return h.cal.blocks[h.cal.blocks.length - 1]; };
  C.setCalDir(s, J1, 'down'); assert.deepStrictEqual(grow(), [-2, 2], '往下會到地底下：換上');
  C.setCalDir(s, J1, 'left'); assert.deepStrictEqual(grow(), [-4, 2]); assert.deepStrictEqual(grow(), [-6, 2]); assert.deepStrictEqual(grow(), [-6, 4], '往左出地皮（x < -6）：換上');
  C.setCalDir(s, J1, 'up'); for (var k = 0; k < 3; k++) grow(); assert.deepStrictEqual(h.cal.blocks[h.cal.blocks.length - 1], [-6, 10], 'y 10～11 剛好到地皮高 12');
  var p = C.nextCalPos(h, C.plotOf(0)); assert.deepStrictEqual([p.pos, p.dir], [[-6, 12], 'up'], '再往上超過地皮高度：照樣往上長（不換方向）');
  assert.deepStrictEqual(grow(), [-6, 12]); assert.deepStrictEqual(grow(), [-6, 14], '一直往上');
  // 地皮照那個月第一天的年齡算
  var o = oldRole(C.dayNum(T0) - 360, 'up'), oh = o.h, ob = C.bornOf(o.r);
  var at13 = C.monthFirstDay(ob, 12), age = C.ageOf(ob, at13).years;
  assert.strictEqual(C.plotOf(age).height, 12 + 2 * age, '第 13 個月第一天的年齡 ' + age + ' 歲：地皮高 ' + (12 + 2 * age));
  // 以前會放滿的情形（門搬開、一直長 300 個月）：現在每個月都長一塊、不重疊、沒有空位
  var s2 = houseBase(), h2 = C.houseOf(s2.roles[0]), b2 = C.bornOf(s2.roles[0]);
  C.moveDoor(s2, J1, 5, 0, -5, 90, T0);
  for (var i = 1; i < 300; i++) C.growCalendars(s2, C.monthFirstDay(b2, i) * 86400000 * 1000 + 3600e6);
  assert.ok(h2.cal.blocks.length === 300 && h2.cal.blocks.every(Boolean), '300 個月：每個月都有一塊，不會放滿');
  var seen = {}; h2.cal.blocks.forEach(function (q) { C.calCells(q).forEach(function (c) { var key = c.join(); assert.ok(!seen[key], '不重疊'); seen[key] = true; }); });
  assert.ok(C.viewHouse(s2, J1, null, T0).cal.preview && !C.viewHouse(s2, J1, null, T0).cal.full, '預告框一定有');
  // 跳到最近的空位：上碰門 → 右
  var s3 = houseBase(), h3 = C.houseOf(s3.roles[0]), b3 = C.bornOf(s3.roles[0]);
  C.setBlocks(s3, J1, [[-1, 2, 0, 'door', 180]], T0, true);
  var p3 = C.nextCalPos(h3, C.plotOf(0)); assert.deepStrictEqual([p3.pos, p3.dir], [[0, 0], 'right'], '上碰到門：換右');
  C.setBlocks(s3, J1, [[3, 0, 3, 'door', 0]], T0, true); for (var k3 = 1; k3 <= 5; k3++) C.growCalendars(s3, C.monthFirstDay(b3, k3) * 86400000 * 1000 + 3600e6);   // 一路往上到 [-2,10]
  C.setBlocks(s3, J1, [[-2, 12, 0, 'door', 0], [0, 10, 0, 'door', 0]].slice(1), T0, true);   // 門放在右邊：右碰門；上（超過地皮高度）照樣長得了
  p3 = C.nextCalPos(h3, C.plotOf(0)); assert.deepStrictEqual([p3.pos, p3.dir], [[-2, 12], 'up'], '右邊有門也沒關係：先試上，往上長得了');
  // 舊存檔裡放滿記的空位（null）和 full 記號：讀進來從起點重新長，每個月都有一塊
  var raw = JSON.parse(JSON.stringify(s2.roles[0])); raw.house.cal.blocks[250] = null; raw.house.cal.full = 32;
  var cr = C.cleanRole(raw); assert.ok(cr.house.cal.blocks.every(Boolean) && cr.house.cal.full === undefined, '舊的空位和放滿記號：重新長，沒有空位');
});
ok('日曆往上長（補十七）：補 60 年，每個月都長一塊、沒有跳過、沒有重疊、都在同一面朝前；自己蓋的方塊放不到地皮高度以上；讀很久沒開的存檔不卡', function () {
  var o = oldRole(C.dayNum(T0) - 365 * 60 - 15, 'up'), h = o.h, b = C.bornOf(o.r), want = C.monthIndex(b, C.dayNum(T0)) + 1;
  assert.strictEqual(h.cal.blocks.length, want, '60 年：' + want + ' 塊');
  assert.ok(h.cal.blocks.every(function (q) { return Array.isArray(q) && q.length === 2 && q[1] >= 0; }), '沒有跳過（沒有空位）、都在地上');
  var seen = {}, ok2 = true; h.cal.blocks.forEach(function (q) { C.calCells(q).forEach(function (c) { if (c[2] !== C.CAL_Z) ok2 = false; var key = c.join(); if (seen[key]) ok2 = false; seen[key] = true; }); }); assert.ok(ok2, '沒有重疊、都在 z＝0 那一面（正面朝前）');
  var plot = C.plotAt(o.r, T0), top = Math.max.apply(null, h.cal.blocks.map(function (q) { return q[1] + 2; }));
  assert.ok(top > plot.height * 10 && h.cal.blocks.every(function (q) { return q[0] >= plot.min && q[0] + 1 <= plot.max; }), '往上長到高 ' + top + '（地皮高 ' + plot.height + '），寬照舊在地皮裡');
  assert.ok(C.viewHouse(o.s, o.r.serial, null, T0).cal.preview.pos[1] >= top - 2, '下個月的預告框也在最上面');
  throws(function () { C.addBlock(o.s, o.r.serial, [10, plot.height, 10, 'brick'], T0); }, /地皮|高/);
  C.addBlock(o.s, o.r.serial, [10, plot.height - 1, 10, 'brick'], T0);
  var raw = JSON.parse(JSON.stringify(o.r)); raw.house.blocks.push([9, plot.height + 3, 9, 'brick']); assert.ok(!C.cleanRole(raw).house.blocks.some(function (x) { return x[1] >= plot.height; }), '讀檔時地皮高度以上的方塊丟掉（日曆照樣在上面）');
  // 很久沒開：40 年份的存檔一塊日曆都沒有，讀進來補 40 年不超過 1 秒
  var o2 = oldRole(C.dayNum(T0) - 365 * 40, 'up'), raw2 = JSON.parse(JSON.stringify(o2.r)); raw2.house.cal.blocks = [[-2, 0]];
  var t0 = Date.now(), c2 = C.cleanRole(raw2), ms = Date.now() - t0;
  assert.ok(c2.house.cal.blocks.length === C.monthIndex(C.bornOf(c2), C.dayNum(Date.now() * 1000)) + 1 && ms < 1000, '補 40 年（' + c2.house.cal.blocks.length + ' 塊）花 ' + ms + ' ms');
});
ok('日曆優先：長到的格子和正面那一條裡的方塊拆掉、記下塊數；碰到門算長不了，門不會被拆；屋主看過就清掉', function () {
  var s = houseBase(), h = C.houseOf(s.roles[0]), born = C.bornOf(s.roles[0]);
  var n0 = h.blocks.length;
  assert.strictEqual(h.calRemoved, 0, '新角色：不算拆');
  var pv = C.viewHouse(s, J1, J1, T0).cal.preview; assert.strictEqual(pv.removes, 6, '預告：下一塊 [-2,2] 會拆掉牆和屋頂的 6 塊'); assert.strictEqual(C.viewHouse(s, J1, null, T0).cal.preview.removes, 0, '別人看不到會拆幾塊');
  C.growCalendars(s, C.monthFirstDay(born, 1) * 86400000 * 1000 + 3600e6);
  assert.strictEqual(h.blocks.length, n0 - 6, '長出來：拆了 6 塊'); assert.strictEqual(h.calRemoved, 6); assert.strictEqual(C.viewHouse(s, J1, J1, T0).calRemoved, 6);
  var res = C.reserved(h, C.plotOf(0)); assert.ok(h.blocks.every(function (b) { return b[3] === 'door' || !res.cal[b.join(',').split(',').slice(0, 3).join(',')]; }), '日曆的格子裡沒有方塊了');
  assert.strictEqual(C.ackCalRemoved(s, J1), 6); assert.strictEqual(h.calRemoved, 0, '看過就清掉');
  // 門擋路：門放在下一塊的位置，長不了就換方向，門還在
  C.moveDoor(s, J1, -1, 4, 1, 0, T0); var d = C.doorOf(h);   // 門站在下一塊 [-2,4] 正面那一條裡
  C.growCalendars(s, C.monthFirstDay(born, 2) * 86400000 * 1000 + 3600e6);
  assert.deepStrictEqual(C.doorOf(h), d, '門不會被拆'); assert.notDeepStrictEqual(h.cal.blocks[2], [-2, 4], '碰到門算長不了，長到別處');
});
ok('自己蓋：日曆格子、正面那一條、門、門前那一格放不上去；日曆拆不掉；門拆不掉、不能放第二扇、搬、轉；範本避開日曆和門前、帶門；全部拆掉不拆門', function () {
  var s = houseBase(), h = C.houseOf(s.roles[0]);
  throws(function () { C.addBlock(s, J1, [-2, 0, 0, 'sky'], T0); }, /留給日曆/); throws(function () { C.addBlock(s, J1, [-1, 1, 3, 'sky'], T0); }, /正面前面要空著/);
  throws(function () { C.addBlock(s, J1, [0, 1, 0, 'sky'], T0); }, /這一格是門/); throws(function () { C.addBlock(s, J1, [0, 0, 1, 'sky'], T0); }, /門前面要空著/);
  throws(function () { C.addBlock(s, J1, [3, 0, 3, 'door', 0], T0); }, /門只有一扇/);
  throws(function () { C.removeBlock(s, J1, -2, 0, 0, T0); }, /日曆拆不掉/); throws(function () { C.removeBlock(s, J1, 0, 0, 0, T0); }, /門拆不掉/); throws(function () { C.removeBlock(s, J1, 0, 1, 0, T0); }, /門拆不掉/);
  assert.strictEqual(h.blocks.filter(function (b) { return b[3] === 'door'; }).length, 1, '剛好一扇');
  var old = C.moveDoor(s, J1, 3, 0, 3, 90, T0); assert.deepStrictEqual(old, [0, 0, 0, 'door', 0]); assert.deepStrictEqual(C.doorOf(h), [3, 0, 3, 'door', 90], '搬門');
  throws(function () { C.moveDoor(s, J1, -2, 0, 0, 0, T0); }, /門不能放在日曆上/); throws(function () { C.moveDoor(s, J1, -1, 0, 4, 0, T0); }, /門不能放在日曆正面前面/);
  throws(function () { C.moveDoor(s, J1, -3, 0, -2, 0, T0); }, /放不下|要空著/);   // 牆上
  throws(function () { C.moveDoor(s, J1, -4, 0, 2, 0, T0); }, /放不下/);   // 花在那裡
  assert.deepStrictEqual(C.rotateBlock(s, J1, 3, 0, 3, T0), [3, 0, 3, 'door', 180], '轉門');
  C.addBlock(s, J1, [2, 0, 3, 'sky'], T0); throws(function () { C.rotateBlock(s, J1, 3, 0, 3, T0); }, /門前面要空著/);   // 轉過去會面對那塊
  assert.strictEqual(h.blocks.filter(function (b) { return b[3] === 'door'; }).length, 1);
  // 範本帶門、避開日曆和門前
  C.moveDoor(s, J1, 0, 0, 0, 0, T0); C.setCalDir(s, J1, 'right'); C.growCalendars(s, C.monthFirstDay(C.bornOf(s.roles[0]), 1) * 86400000 * 1000 + 3600e6);
  Object.keys(C.TEMPLATES).forEach(function (k) {
    var t = C.template(k); assert.strictEqual(t.filter(function (b) { return b[3] === 'door'; }).length, 1, '範本「' + C.TEMPLATES[k] + '」自己帶門');
    C.applyTemplate(s, J1, k, T0); var res = C.reserved(h, C.plotOf(0));
    assert.ok(h.blocks.every(function (b) { return b[3] === 'door' || !res.cal[b.slice(0, 3).join(',')] && !res.front[b.slice(0, 3).join(',')] && !res.dfront[b.slice(0, 3).join(',')]; }), '範本「' + C.TEMPLATES[k] + '」蓋好：日曆、正面那一條、門前都空著');
    assert.strictEqual(h.blocks.filter(function (b) { return b[3] === 'door'; }).length, 1);
  });
  var d = C.doorOf(h); C.setBlocks(s, J1, [], T0, true); assert.deepStrictEqual(h.blocks, [d], '全部拆掉不拆門');
  // 門放不下的範本（範本的門位置被日曆佔著）：門留在原處
  var s4 = houseBase(), h4 = C.houseOf(s4.roles[0]); C.moveDoor(s4, J1, 4, 0, 4, 0, T0); C.setCalDir(s4, J1, 'right'); C.growCalendars(s4, C.monthFirstDay(C.bornOf(s4.roles[0]), 1) * 86400000 * 1000 + 3600e6);
  assert.deepStrictEqual(h4.cal.blocks[1], [0, 0]); C.applyTemplate(s4, J1, 'house', T0); assert.deepStrictEqual(C.doorOf(h4).slice(0, 3), [4, 0, 4], '範本的門位置被日曆佔著：門留在原處');
});
ok('門：讀檔沒有門補一扇（預設位置放不下就找最近的地上）、多的丟掉；不合格的日曆重新長；讀檔時碰到日曆、門前的方塊丟掉', function () {
  var s = houseBase(), raw = JSON.parse(JSON.stringify(s.roles[0]));
  raw.house.blocks = raw.house.blocks.filter(function (b) { return b[3] !== 'door'; });
  var h = C.cleanRole(raw).house; assert.deepStrictEqual(C.doorOf(h), [0, 0, 0, 'door', 0], '沒有門：補在預設位置');
  raw.house.blocks.push([0, 0, 0, 'sky'], [3, 0, 3, 'door', 0], [4, 0, 4, 'door', 90]);
  h = C.cleanRole(raw).house; assert.strictEqual(h.blocks.filter(function (b) { return b[3] === 'door'; }).length, 1, '兩扇門：留第一扇'); assert.deepStrictEqual(C.doorOf(h), [3, 0, 3, 'door', 0]);
  raw.house.blocks = raw.house.blocks.filter(function (b) { return b[3] !== 'door'; });
  h = C.cleanRole(raw).house; var d = C.doorOf(h); assert.ok(d && !(d[0] === 0 && d[2] === 0) && d[1] === 0, '預設位置放不下：補在離它最近、放得下的地上 ' + JSON.stringify(d));
  // 不合格的日曆：重新長
  raw = JSON.parse(JSON.stringify(s.roles[0])); raw.house.cal = { dir: 'left', blocks: [[3, 3]] };
  h = C.cleanRole(raw).house; assert.deepStrictEqual(h.cal, { dir: 'left', blocks: [[-2, 0]] }, '第一塊不在起點：從起點重新長，dir 留著');
  raw.house.cal = { dir: 'up', blocks: [[-2, 0], [-2, 0]] }; h = C.cleanRole(raw).house; assert.deepStrictEqual(h.cal.blocks, [[-2, 0]], '重疊：重新長（長度照現在）');
  raw.house.cal = { dir: 'sideways', blocks: 'x' }; h = C.cleanRole(raw).house; assert.deepStrictEqual(h.cal, { dir: 'up', blocks: [[-2, 0]] }, '格式不對：預設往上重新長');
  raw.house.cal = { dir: 'up', blocks: [[-2, 0], [-2, 2], [-2, 4]] }; h = C.cleanRole(raw).house; assert.deepStrictEqual(h.cal.blocks, [[-2, 0]], '比現在多：重新長');
  // 碰到日曆、門前的方塊讀檔時丟掉
  raw = JSON.parse(JSON.stringify(s.roles[0])); raw.house.blocks.push([-2, 1, 0, 'sky'], [-1, 0, 4, 'sky'], [0, 0, 1, 'sky']);
  h = C.cleanRole(raw).house; assert.ok(!h.blocks.some(function (b) { return (b[0] === -2 && b[1] === 1 && b[2] === 0) || (b[0] === -1 && b[2] === 4) || (b[0] === 0 && b[1] === 0 && b[2] === 1); }), '丟掉三塊');
});
ok('viewHouse：每塊磚對到第幾塊日曆、第幾排第幾欄；預告框的位置和下個月的虛線磚；再後面的預約不在房子上；只給鄰居看的屋有日曆形狀、沒有亮暗', function () {
  var o = oldRole(C.dayNum(T0) - 100, 'up'), s = o.s, S6 = '00000000006', born = C.bornOf(o.r);
  var f1 = C.addSlot(s, S6, C.monthFirstDay(born, C.monthIndex(born, C.dayNum(T0)) + 1) * 86400000 * 1000 + 36e9, 2, null, T0), f2 = C.addSlot(s, S6, T0 + 200 * DAY, 2, null, T0);
  C.book(s, J1, f1.id, T0); C.book(s, J1, f2.id, T0);
  var v = C.viewHouse(s, S6, null, T0), today = v.bricks.find(function (b) { return b.day === v.today; });
  assert.ok(v.bricks.every(function (b) { return !b.future ? (b.g && b.onHouse && JSON.stringify(b.g) === JSON.stringify(C.calSpot(born, b.day))) : true; }), '過去每一塊磚都在房子上、位置對');
  assert.strictEqual(today.g.m, v.cal.blocks.length - 1, '今天在最後一塊');
  var fut = v.bricks.filter(function (b) { return b.future; }); assert.strictEqual(fut.length, 2);
  assert.ok(fut[0].onHouse && fut[0].g.m === v.cal.blocks.length && v.cal.preview && v.cal.preview.month.m === C.calMonth(born, v.cal.blocks.length).m, '下個月的預約在預告框上');
  assert.ok(!fut[1].onHouse, '再後面的預約不在房子上（表格世界的日曆照舊有）');
  C.setHouse(s, S6, { visibility: 'neighbors' }); var c = C.viewHouse(s, S6, null, T0);
  assert.ok(c.closed && c.cal.blocks.length === v.cal.blocks.length && c.cal.preview && c.bricks.every(function (b) { return b.lit === undefined && b.g; }), '只給鄰居看：日曆和預告框的形狀照畫，磚沒有亮暗');
  assert.strictEqual(c.look.door.length, 5, '門照樣看得到');
});
ok('存檔：第 3 輪的存檔讀得進來：門牆拿掉、門補在預設位置、日曆從起點照 up 補長到現在、擋到的照日曆優先拆掉並記下來', function () {
  var o = oldRole(C.dayNum(T0) - 420), raw = JSON.parse(JSON.stringify(o.r));
  delete raw.house.cal; raw.house.blocks = raw.house.blocks.filter(function (b) { return b[3] !== 'door'; }); raw.house.blocks.push([-2, 0, 0, 'brick'], [-1, 1, 0, 'brick'], [-2, 3, 0, 'brick'], [-1, 4, 2, 'brick']);
  var h = C.cleanRole(raw).house, want = C.monthIndex(C.bornOf(o.r), C.dayNum(C.nowUs())) + 1;
  assert.deepStrictEqual(C.doorOf(h), [0, 0, 0, 'door', 0], '門補在預設位置'); assert.strictEqual(h.cal.dir, 'up'); assert.strictEqual(h.cal.blocks.length, want, '日曆補長到現在：' + want + ' 塊'); assert.deepStrictEqual(h.cal.blocks[0], [-2, 0]);
  assert.ok(h.calRemoved >= 4, '擋到的拆掉、記下來：' + h.calRemoved);
  var res = C.reserved(h, C.plotOf(1)); assert.ok(h.blocks.every(function (b) { return b[3] === 'door' || !res.cal[b.slice(0, 3).join(',')] && !res.front[b.slice(0, 3).join(',')]; }));
});
ok('地皮：0 歲 12×12、高 12；每活一年四邊各外推一格、高度加 2；10 歲以上 32×32、高 32；位置以地皮中心為準', function () {
  assert.deepStrictEqual([C.plotOf(0).size, C.plotOf(0).height], [12, 12]); assert.deepStrictEqual([C.plotOf(1).size, C.plotOf(1).height], [14, 14]);
  assert.deepStrictEqual([C.plotOf(10).size, C.plotOf(10).height], [32, 32]); assert.deepStrictEqual([C.plotOf(25).size, C.plotOf(25).height], [32, 32]);
  var p0 = C.plotOf(0), p1 = C.plotOf(1); assert.deepStrictEqual([p0.min, p0.max, p1.min, p1.max], [-6, 5, -7, 6], '以地皮中心為準：長大時四邊各外推一格，原本的位置不變');
  var s = houseBase(); C.createRole(s, { serial: '00000000006', name: '老人家', dailyPoints: 700, rules: {}, resources: [] }, T0 - 800 * DAY);
  assert.strictEqual(C.viewHouse(s, '00000000006', null, T0).plot.size, 16, '2 歲：16×16'); assert.strictEqual(C.viewHouse(s, J1, null, T0).plot.size, 12);
});
ok('自己蓋：只收清單裡的種類、只能在地皮裡、同一格不能兩塊、擺設只能轉 90 度；不限幾塊（5000 塊照收）；讀檔時不合格的丟掉、其他留著', function () {
  var s = houseBase(), n0 = C.houseOf(s.roles[0]).blocks.length;
  assert.ok(n0 > 50, '新角色先有一間預設小屋（' + n0 + ' 塊）'); assert.strictEqual(JSON.stringify(C.houseOf(s.roles[0]).blocks), JSON.stringify(C.template('house')));
  var b = C.addBlock(s, J1, [4, 0, -5, 'sky'], T0); assert.deepStrictEqual(b, [4, 0, -5, 'sky']);
  throws(function () { C.addBlock(s, J1, [4, 0, -5, 'brick'], T0); }, /已經有/);
  throws(function () { C.addBlock(s, J1, [3, 0, 3, 'gold'], T0); }, /不在清單/); throws(function () { C.addBlock(s, J1, [3, 0, 3, '<img>'], T0); }, /不在清單/);
  throws(function () { C.addBlock(s, J1, [6, 0, 0, 'sky'], T0); }, /地皮外面/); throws(function () { C.addBlock(s, J1, [3, 12, 3, 'sky'], T0); }, /超過地皮的高度（12）不能蓋/); throws(function () { C.addBlock(s, J1, [3, -1, 3, 'sky'], T0); }, /地皮外面/);
  throws(function () { C.addBlock(s, J1, [0.5, 0, 3, 'sky'], T0); }, /整數/);
  throws(function () { C.addBlock(s, J1, [4, 0, -4, 'tree', 45], T0); }, /90 度/); throws(function () { C.addBlock(s, J1, [4, 0, -4, 'sky', 90], T0); }, /只有擺設和門能轉/);
  C.addBlock(s, J1, [4, 0, -4, 'tree', 270], T0); assert.deepStrictEqual(C.rotateBlock(s, J1, 4, 0, -4, T0), [4, 0, -4, 'tree', 0], '轉 90 度：270 → 0');
  throws(function () { C.rotateBlock(s, J1, 4, 0, -5, T0); }, /只有擺設和門/);
  assert.deepStrictEqual(C.removeBlock(s, J1, 4, 0, -5, T0), [4, 0, -5, 'sky']); throws(function () { C.removeBlock(s, J1, 4, 0, -5, T0); }, /沒有東西/);
  var OLD = '00000000006'; C.createRole(s, { serial: OLD, name: '老人家', dailyPoints: 700, rules: {}, resources: [] }, T0 - 3700 * DAY);
  var many = [], res = C.reserved(C.houseOf(C.roleOf(s, OLD)), C.plotOf(10));
  for (var x = -16; x <= 15; x++) for (var y = 0; y < 12; y++) for (var z = -16; z <= -2; z++) if (many.length < 5000 && !res.cal[[x, y, z].join(',')] && !res.front[[x, y, z].join(',')]) many.push([x, y, z, ['brick', 'glass', 'wood', 'lamp'][(x + y + z + 60) % 4]]);
  C.setBlocks(s, OLD, many, T0); assert.strictEqual(C.houseOf(C.roleOf(s, OLD)).blocks.length, 5001, '10 歲的地皮：5000 塊照收（加一扇門）');
  throws(function () { C.setBlocks(s, OLD, many.concat([[-2, 0, 0, 'sky']]), T0); }, /留給日曆/); assert.strictEqual(C.houseOf(C.roleOf(s, OLD)).blocks.length, 5001, '整份換掉時有一塊不合格：整份擋下，原本的不動');
  var raw = JSON.parse(JSON.stringify(s.roles[0])); raw.house.blocks = [[0, 0, 0, 'door', 0], [1, 0, 1, 'sky'], [1, 0, 1, 'brick'], [40, 0, 0, 'sky'], [2, 0, 2, 'dragon'], [3, 0, 3, 'tree', 33], 'x', [2, 1, 2, 'flag', 180]];
  raw.house.sign = 'x'.repeat(50);
  var cl = C.cleanRole(raw).house; assert.deepStrictEqual(cl.blocks.filter(function (q) { return q[3] !== 'door'; }), [[1, 0, 1, 'sky'], [2, 1, 2, 'flag', 180]], '讀檔：重複的、地皮外的、不認得的、轉錯的都丟掉，其他留著'); assert.strictEqual(cl.sign.length, 20);
  Object.keys(C.TEMPLATES).forEach(function (k) { var t = C.template(k); assert.ok(t.length > 50 && JSON.stringify(C.cleanBlocks(t, C.plotOf(0), true)) === JSON.stringify(t), '範本「' + C.TEMPLATES[k] + '」放得進 12×12、高 12（' + t.length + ' 塊）'); });
  throws(function () { C.setHouse(s, J1, { sign: '一二三四五六七八九十一二三四五六七八九十一' }); }, /20 字/); throws(function () { C.setHouse(s, J1, { shape: 'tower' }); }, /只能改/);
  var h = C.setHouse(s, J1, { sign: '一二三四五六七八九十一二三四五六七八九十', visibility: 'neighbors', defaultVis: 'hidden' }); assert.deepStrictEqual([h.sign.length, h.visibility, h.defaultVis], [20, 'neighbors', 'hidden']);
  var look = C.viewHouse(s, J1, null, T0).look; assert.strictEqual(look.n, look.blocks.length - 1, 'n 不算門'); look.blocks[0][3] = 'x'; assert.notStrictEqual(C.houseOf(s.roles[0]).blocks[0][3], 'x', '回傳的是複本，畫面改不到資料');
});
ok('存檔：第 2 輪的存檔讀得進來：原本的外觀換成預設小屋（照原本牆和屋頂的顏色），擺設放得進地皮的換成方塊、放不進的不要；再照第 3 輪的轉法補門和日曆', function () {
  var s = houseBase(), raw = JSON.parse(JSON.stringify(s));
  raw.roles[0].house = { shape: 'round', wall: 'cream', roof: 'pine', trim: 'ink', door: 'arch', window: 'round', roofStyle: 'dome', sign: '舊門牌', visibility: 'public', defaultVis: 'neighbors',
    props: [{ kind: 'tree', a: 0, r: 0, rot: 90 }, { kind: 'lamp', a: 6, r: 0, rot: 0 }, { kind: 'rock', a: 12, r: 0, rot: 0 }, { kind: 'bench', a: 6, r: 2, rot: 0 }, { kind: 'flag', a: 18, r: 0, rot: 0 }] };
  raw.roles[1].house = { shape: 'tower', wall: '???', roof: 'slate', props: [] };
  var h = C.cleanRole(raw.roles[0]).house, h2 = C.cleanRole(raw.roles[1]).house;
  assert.strictEqual(h.sign, '舊門牌'); assert.strictEqual(h.defaultVis, 'neighbors'); assert.strictEqual(h.shape, undefined, '屋型、樣式不要了');
  var walls = h.blocks.filter(function (b) { return b[3] === 'cream'; }).length, roofs = h.blocks.filter(function (b) { return b[3] === 'pine'; }).length;
  assert.ok(walls > 30 && roofs > 30, '預設小屋照原本牆（米白）和屋頂（松綠）的顏色');
  var kinds = h.blocks.filter(function (b) { return ['tree', 'stone', 'flag', 'bench'].indexOf(b[3]) >= 0; }).map(function (b) { return b[3] + (b[4] != null ? ':' + b[4] : ''); }).sort();
  assert.ok(kinds.indexOf('tree:90') >= 0 && kinds.indexOf('stone') >= 0 && kinds.indexOf('flag:0') >= 0, '放得進地皮的擺設換成方塊（樹照原本的方向、石頭換成石灰方塊）：' + kinds.join(','));
  assert.ok(kinds.indexOf('bench:0') < 0, '放不進的（最外圈正左邊，出了地皮）不要');
  assert.strictEqual(C.cleanBlocks(h.blocks, C.plotOf(0), true, h).length, h.blocks.length, '換出來的每一塊都合格（嚴格檢查不會擋下）');
  assert.deepStrictEqual(C.doorOf(h), [0, 0, 0, 'door', 0]); assert.deepStrictEqual(h.cal.blocks, [[-2, 0]], '門和日曆都補上了');
  assert.ok(h2.blocks.filter(function (b) { return b[3] === 'brick'; }).length > 30, '不認得的牆色：用預設');
  var store = {}; global.localStorage = { getItem: function (k) { return store[k] == null ? null : store[k]; }, setItem: function (k, v) { store[k] = v; } };
  store['arrive-v9'] = JSON.stringify(Object.assign(raw, { v: 9, tutorial: { step: 'done' } }));
  var back = C.load(); assert.ok(!C.io.loadIssue, '讀得進來、不會壞'); assert.ok(C.houseOf(back.roles[0]).blocks.length > 100);
  delete global.localStorage;
});
ok('存檔：壓縮的保險：壓完先解開對照，不一樣就不存、跳提示，舊存檔不動', function () {
  var store = {}; global.localStorage = { getItem: function (k) { return store[k] == null ? null : store[k]; }, setItem: function (k, v) { store[k] = v; } };
  var big = C.fresh({ history: false }); require('./bulk.js').bulk(C, big);
  assert.ok(C.save(big)); var good = store['arrive-v9']; assert.ok(good.slice(0, 4) === 'LZ1:', '大的存檔壓縮過');
  var real = C.codec.compress; C.codec.compress = function (t) { var z = real(t); return z.slice(0, z.length >> 1) + String.fromCharCode(z.charCodeAt(z.length >> 1) ^ 1) + z.slice((z.length >> 1) + 1); };   // 故意讓壓縮出錯
  big.records.push({ kind: 'x', at: 0, text: '新的一筆' });
  assert.strictEqual(C.save(big), false, '壓出來解不回原樣：不存'); assert.ok(/壓縮出錯/.test(C.io.saveError) && /原本的存檔沒動/.test(C.io.saveError), '跳提示：' + C.io.saveError);
  assert.strictEqual(store['arrive-v9'], good, '舊存檔不動');
  C.codec.compress = real; assert.ok(C.save(big) && store['arrive-v9'] !== good, '壓縮正常了就照常存');
  delete global.localStorage;
});
ok('示範資料：阿澄、小樂、引路人很久以前就創了，帶一段照規則跑出來的過去紀錄（成交、不成交、錯過、幾筆藏起來的）', function () {
  var s = C.fresh(), now = C.nowUs();
  var ages = ['00000000002', '00000000003', C.GUIDE].map(function (x) { return C.viewHouse(s, x, null, now).age.total; });
  assert.ok(ages[0] >= 400 && ages[1] >= 200 && ages[2] >= 700, '很久以前創的：' + ages.join(','));
  var st = {}; s.entries.forEach(function (e) { st[e.status] = (st[e.status] || 0) + 1; });
  assert.ok(st.traded > 20 && st.nodock > 3 && st.miss > 3, '有成交、不成交、錯過：' + JSON.stringify(st));
  assert.ok(s.entries.some(function (e) { return e.vis['00000000002'] !== 'public' || e.vis['00000000003'] !== 'public'; }), '有幾筆藏起來');
  assert.ok(s.entries.every(function (e) { return !e.docking || s.dockings.some(function (d) { return d.id === e.docking; }); }), '照正式的格式：每一筆都連到對接紀錄');
  var v = C.viewHouse(s, '00000000002', null, now); assert.ok(v.bricks.filter(function (b) { return b.lit; }).length > 10 && v.bricks.some(function (b) { return b.cover; }), '隨機跳過去看得到亮的磚和蓋布');
  var looks = ['00000000002', '00000000003', C.GUIDE].map(function (x) { return JSON.stringify(C.houseOf(C.roleOf(s, x)).blocks); });
  assert.ok(looks[0] !== looks[1] && looks[1] !== looks[2] && looks[0] !== looks[2] && looks.every(function (l) { return JSON.parse(l).length > 100; }), '阿澄、小樂、引路人各有一間不一樣的房子（塔、長屋、圓屋再改過）');
});
ok('存檔：第 1 輪的存檔讀得進來（補出每一筆，每一筆公開，預設外觀）；三年份（1100 個判過的時段、3300 筆對接）存得進去也讀得進來', function () {
  var store = {}; global.localStorage = { getItem: function (k) { return store[k] == null ? null : store[k]; }, setItem: function (k, v) { store[k] = v; } };
  var r1 = C.fresh({ history: false }); C.demoMe(r1, T0); var sl = C.addSlot(r1, J2, T0 + 60e6, 1, null, T0); C.book(r1, J1, sl.id, T0); C.setWants(r1, sl.id, J1, J2, ['r2b']); C.setWants(r1, sl.id, J2, J1, ['r1b']); C.judge(r1, T0 + 60e6);
  var f = C.addSlot(r1, J2, T0 + 5 * DAY, 1, null, T0); C.book(r1, J1, f.id, T0);
  var old = JSON.parse(JSON.stringify(r1)); delete old.entries; old.roles.forEach(function (r) { delete r.house; delete r.born; r.slots.forEach(function (x) { delete x.visAt; }); }); old.tutorial = { step: 'done' };
  store['arrive-v9'] = JSON.stringify(old);
  var st = C.load(); assert.ok(!C.io.loadIssue);
  assert.deepStrictEqual(st.entries.map(function (e) { return e.status; }).sort(), ['booked', 'traded']); assert.ok(st.entries.every(function (e) { return e.vis[J1] === 'public' && e.vis[J2] === 'public'; }), '每一筆公開');
  assert.strictEqual(JSON.stringify(C.houseOf(st.roles[0]).blocks), JSON.stringify(C.template('house')), '沒有外觀的：預設小屋'); assert.deepStrictEqual(C.houseOf(st.roles[0]).cal.blocks, [[-2, 0]], '日曆第一塊'); assert.strictEqual(C.viewHouse(st, J1, null, T0).age.text, '0 歲 0 天', '沒有生日就從第一個版本算');
  var big = C.fresh({ history: false }); var B = require('./bulk.js').bulk(C, big);
  assert.strictEqual(big.dockings.length, 3300); assert.strictEqual(big.roles.find(function (r) { return r.serial === B.X; }).slots.length, 1100);
  assert.ok(C.save(big), '三年份存得進去'); assert.ok(store['arrive-v9'].length < 1000000, '存檔壓縮過：' + store['arrive-v9'].length + ' 字');
  var back = C.load(); assert.ok(!C.io.loadIssue); assert.strictEqual(back.dockings.length, 3300); assert.strictEqual(back.entries.length, 3300); assert.strictEqual(C.viewHouse(back, B.X, null).bricks.length, 1102);
  delete global.localStorage;
});
ok('存檔：讀不進來時不蓋掉（另外留一份、跳提示）；存不進去（空間滿了）會回報', function () {
  var store = { 'arrive-v9': '{"v":9,"roles":[{"serial":"bad"}]}' }, full = false;
  global.localStorage = { getItem: function (k) { return store[k] == null ? null : store[k]; }, setItem: function (k, v) { if (full) { var e = new Error('滿了'); e.name = 'QuotaExceededError'; throw e; } store[k] = v; } };
  var st = C.load(); assert.ok(C.io.loadIssue && /另外留一份/.test(C.io.loadIssue.message), '跳提示：' + (C.io.loadIssue && C.io.loadIssue.message));
  var bk = Object.keys(store).find(function (k) { return /^arrive-v9-backup-/.test(k); }); assert.ok(bk && store[bk] === '{"v":9,"roles":[{"serial":"bad"}]}', '舊存檔另外留一份');
  assert.strictEqual(st.me, -1, '先從新的開始');
  full = true; assert.strictEqual(C.save(st), false); assert.ok(/空間滿了/.test(C.io.saveError), '存不進去要回報：' + C.io.saveError);
  // 讀不進來、也沒空間另外留一份：不存，免得蓋掉舊的
  store = { 'arrive-v9': '壞掉' }; var st2 = C.load(); assert.ok(/不會存/.test(C.io.loadIssue.message)); full = false; assert.strictEqual(C.save(st2), false); assert.strictEqual(store['arrive-v9'], '壞掉', '舊存檔沒被蓋掉');
  delete global.localStorage;
});
/* ---------- 第 5 輪：種類、條件限種類、每人最多給的預設、固定約、打招呼密鑰 ---------- */
ok('種類：每樣東西是訊息、行為、物質之一；舊資料沒選的是「還沒選」（空字串），照樣能換；不認得的種類擋下；改了明天起', function () {
  var s = base();
  assert.deepStrictEqual(Object.keys(C.KINDS), ['info', 'act', 'thing']);
  assert.strictEqual(C.version(s.roles[0], T0).resources[0].kind, '', '舊資料：還沒選');
  C.setResource(s, J1, 'x', { kind: 'act' }, T0); assert.strictEqual(C.version(s.roles[0], T0).resources[0].kind, '', '今天不變'); assert.strictEqual(C.version(s.roles[0], T0 + DAY).resources[0].kind, 'act', '明天起是行為');
  throws(function () { C.setResource(s, J1, 'x', { kind: 'money' }, T0); }, /種類只有/);
  var r = C.addResource(s, J1, { name: '一份食譜', kind: 'info', price: 20 }, T0); assert.strictEqual(r.kind, 'info');
  var raw = JSON.parse(JSON.stringify(s.roles[0])); raw.versions[0].resources[0].kind = 'gold'; assert.strictEqual(C.cleanRole(raw).versions[0].resources[0].kind, '', '讀檔：不認得的種類當還沒選');
  // 沒選種類照樣能換
  var a = C.addSlot(s, J1, T0 + 60e6, 5, null, T0); C.book(s, J2, a.id, T0); C.setWants(s, a.id, J2, J1, ['y']); C.setWants(s, a.id, J1, J2, ['e2']); C.judge(s, T0 + 60e6);
  assert.ok(s.dockings[0].traded && s.dockings[0].itemsA[0].kind === '', '還沒選種類的東西照樣成交，紀錄裡記著種類');
});
ok('條件限種類：「對方要給的東西種類」那一微秒才判，看對方這一筆選給我的（0 點的不算）；不符合整對不成交、原因寫只收什麼；「跟我同一種」看我自己給的；預約、找人不看這條', function () {
  var s = base();
  C.setResource(s, J2, 'p', { kind: 'info' }, T0 - DAY); C.setResource(s, J1, 'y', { kind: 'thing' }, T0 - DAY); C.setResource(s, J1, 'x', { kind: 'act' }, T0 - DAY);
  C.setRules(s, J1, { conditions: [{ field: 'giveKind', op: '=', value: 'thing' }] }, T0 - DAY);
  assert.strictEqual(C.condText({ field: 'giveKind', op: '=', value: 'thing' }), '只收物質'); assert.strictEqual(C.condText({ field: 'giveKind', op: '=', value: 'same' }), '對方要給的東西跟我同一種');
  throws(function () { C.setRules(s, J1, { conditions: [{ field: 'giveKind', op: '=', value: 'gold' }] }, T0); }, /種類只有/);
  assert.ok(C.passes(s, s.roles[0], s.roles[1], T0).ok && C.eligible(s, s.roles[0], s.roles[1], T0).ok, '預約、找人不看這條（那一微秒才判）');
  // 乙選了甲的 y（物質）、甲選了乙的 p（訊息）：甲只收物質 → 整對不成交
  var a = C.addSlot(s, J1, T0 + 60e6, 5, null, T0); C.book(s, J2, a.id, T0); C.setWants(s, a.id, J2, J1, ['y']); C.setWants(s, a.id, J1, J2, ['p']); C.judge(s, T0 + 60e6);
  var d = s.dockings[0]; assert.ok(!d.traded && /甲：只收物質/.test(d.reason) && /乙 給的是訊息/.test(d.reason) && /整對不成交/.test(d.reason), '不符合：整對不成交，原因寫只收物質：' + d.reason);
  assert.strictEqual(s.holds.length, 0, '誰的貨都不動');
  // 甲選乙的空物件（0 點）：不受限制
  var b = C.addSlot(s, J1, T0 + 120e6, 5, null, T0); C.book(s, J2, b.id, T0); C.setWants(s, b.id, J2, J1, ['y']); C.setWants(s, b.id, J1, J2, ['e2']); C.judge(s, T0 + 120e6);
  assert.ok(s.dockings[1].traded, '0 點的空物件不受這個條件限制');
  // 跟我同一種：甲給的是 y（物質），乙給 p（訊息）→ 不成；乙改給物質的就成
  C.setRules(s, J1, { conditions: [{ field: 'giveKind', op: '=', value: 'same' }] }, T0 - DAY);
  var c = C.addSlot(s, J1, T0 + 180e6, 5, null, T0); C.book(s, J2, c.id, T0); C.setWants(s, c.id, J2, J1, ['y']); C.setWants(s, c.id, J1, J2, ['p']); C.judge(s, T0 + 180e6);
  assert.ok(!s.dockings[2].traded && /跟我同一種/.test(s.dockings[2].reason), '跟我同一種：訊息換物質不成');
  C.addResource(s, J2, { id: 'pt', name: '一個便當', kind: 'thing', price: 50 }, T0 - DAY); C.restock(s, J2, 'pt', 2);
  var e = C.addSlot(s, J1, T0 + 240e6, 5, null, T0); C.book(s, J2, e.id, T0); C.setWants(s, e.id, J2, J1, ['y']); C.setWants(s, e.id, J1, J2, ['pt']); C.judge(s, T0 + 240e6);
  assert.ok(s.dockings[3].traded, '物質換物質：成交');
  // 一起成交的時段也看
  var t2 = C.addSlot(s, J1, T0 + 300e6, 5, null, T0, true); C.book(s, J2, t2.id, T0); C.setWants(s, t2.id, J2, J1, ['y']); C.setWants(s, t2.id, J1, J2, ['p']); C.judge(s, T0 + 300e6);
  assert.ok(!s.dockings[4].traded && /跟我同一種/.test(s.dockings[4].reason), '一起成交的時段也照這條判');
});
ok('每人最多給的預設：規則表設一個，開時段沒設就用它；時段上設的優先；都沒設就是今天剩下的', function () {
  var s = base();
  var a = C.addSlot(s, J1, T0 + 60e6, 5, null, T0);
  assert.strictEqual(C.maxGiveOf(s, a, J1, T0), 1000, '都沒設：今天剩下的');
  C.setRules(s, J1, { maxGiveDefault: 200 }, T0 - DAY); assert.strictEqual(C.version(s.roles[0], T0).rules.maxGiveDefault, 200);
  assert.strictEqual(C.maxGiveOf(s, a, J1, T0), 200, '規則表的預設'); assert.strictEqual(C.maxGiveSet(s, a, J1, T0), 200);
  C.setMaxGive(s, a, J1, 500); assert.strictEqual(C.maxGiveOf(s, a, J1, T0), 500, '時段上設的優先');
  throws(function () { C.setRules(s, J1, { maxGiveDefault: -1 }, T0); }, /0 以上/);
  var b = C.addSlot(s, J1, T0 + 120e6, 5, null, T0); C.book(s, J2, b.id, T0); C.setWants(s, b.id, J2, J1, ['x']); C.setWants(s, b.id, J1, J2, ['e2']); C.judge(s, T0 + 120e6);
  assert.ok(!s.dockings[0].traded && /每人最多給 200 點/.test(s.dockings[0].reason), '乙選的 300 點超過預設 200：不成交，原因寫每人最多給 200');
});
ok('固定約：兩邊都勾才成立；之後每天同一時間、同樣東西、兩人都算到達，每天一筆；照前一次換日時的規則表判；哪天條件不通那天不成交；停就結束；某一天不去只取消那一天', function () {
  var s = houseBase();
  var a = C.addSlot(s, J1, T0 + 60e6, 5, null, T0); C.book(s, J2, a.id, T0); C.setWants(s, a.id, J2, J1, ['y']); C.setWants(s, a.id, J1, J2, ['e2']); C.judge(s, T0 + 60e6);
  var d = s.dockings[0]; assert.ok(d.traded);
  assert.strictEqual(C.wantDaily(s, J1, d.id, true, T0 + 61e6), null, '只有一邊勾：什麼都不發生'); assert.deepStrictEqual(C.dailyState(s, J2, d.id), { mine: false, theirs: true, standing: null, can: true });
  assert.strictEqual(C.standingsOf(s).length, 0);
  throws(function () { C.wantDaily(s, J3, d.id, true, T0); }, /不是你的/);
  var st = C.wantDaily(s, J2, d.id, true, T0 + 62e6); assert.ok(st && st.active && st.a === J1 && st.b === J2 && d.standing === st.id, '兩邊都勾：成立');
  assert.deepStrictEqual([st.itemsA, st.itemsB], [['y'], ['e2']], '換同樣的東西'); assert.strictEqual(st.tod, (T0 + 60e6) - C.dayStartUs(C.dayNum(T0)), '同一個時間');
  assert.strictEqual(s.roles[0].slots.length, 1, '今天不再多一筆');
  // 換日：明天自動一筆（主人甲開時段、乙約好、兩邊都選好、都算到達）
  var day1 = C.dayNum(T0) + 1, tick1 = C.dayStartUs(day1) + 1e6;
  assert.strictEqual(C.runStandings(s, tick1), 1, '明天換日：多一筆'); assert.strictEqual(C.runStandings(s, tick1), 0, '同一天再叫不會再多');
  var s1 = s.roles[0].slots[1]; assert.strictEqual(s1.standing, st.id); assert.strictEqual(s1.atUs, C.dayStartUs(day1) + st.tod, '明天同一時間');
  assert.ok(s1.bookings.indexOf(J2) >= 0 && C.isPresent(s, J2, s1.id) && C.isPresent(s, J1, s1.id), '乙約好了、兩人都算到達');
  assert.deepStrictEqual([C.wantsOf(s1, J2, J1), C.wantsOf(s1, J1, J2)], [['y'], ['e2']], '照配好的東西選');
  var e1 = s.entries.find(function (e) { return e.slot === s1.id; }); assert.ok(e1 && e1.daily && e1.status === 'booked', '事件簿那一行標「每天」');
  C.judge(s, s1.atUs + 1); var d1 = s.dockings.find(function (x) { return x.slot === s1.id; }); assert.ok(d1.traded && d1.standing === st.id, '那一微秒照常判：成交');
  assert.strictEqual(C.givenToday(s, J1, s1.atUs), 50, '點只扣當天的');
  // 前一次換日時的規則表：今天改規則（明天起），後天那一筆才照新的；明天那一筆照今天的
  C.setRules(s, J1, { conditions: [{ field: 'avail', op: '>=', value: 999 }], bothMustPass: true }, tick1);   // 明天起（day2 起）乙不通（要兩方都通）
  var day2 = day1 + 1, tick2 = C.dayStartUs(day2) + 1e6; C.runStandings(s, tick2); var s2 = s.roles[0].slots[2];
  C.judge(s, s2.atUs + 1); var d2 = s.dockings.find(function (x) { return x.slot === s2.id; });
  assert.ok(!d2.traded && /不通/.test(d2.reason), '哪天條件不通那天不成交、照事實記錄：' + d2.reason);
  C.setRules(s, J1, { conditions: [] }, tick2);
  // 某一天不去：只取消那一天的到達
  var day3 = day2 + 1, tick3 = C.dayStartUs(day3) + 1e6; C.runStandings(s, tick3); var s3 = s.roles[0].slots[3];
  C.setPresent(s, J1, s3.id, false); assert.strictEqual(C.isPresent(s, J1, s3.id), false, '主人那一天不去');
  C.judge(s, s3.atUs + 1); var e3 = s.entries.find(function (e) { return e.slot === s3.id; }); assert.strictEqual(e3.status, 'miss', '那一天錯過');
  var day4 = day3 + 1, tick4 = C.dayStartUs(day4) + 1e6; C.runStandings(s, tick4); var s4 = s.roles[0].slots[4]; assert.ok(C.isPresent(s, J1, s4.id), '隔天照常');
  // 停：任一方按停就結束，還沒到的拿掉
  C.stopStanding(s, J2, st.id); assert.ok(!st.active && st.stoppedBy === J2, '乙按停：結束');
  assert.ok(!s.roles[0].slots.some(function (x) { return x.id === s4.id; }) && !s.entries.some(function (e) { return e.slot === s4.id; }), '還沒到的那一筆拿掉');
  assert.strictEqual(C.runStandings(s, C.dayStartUs(day4 + 1) + 1e6), 0, '停了不再長');
  throws(function () { C.wantDaily(s, J1, d.id, true, T0); }, /已經是固定約/);
  // 教學、一起成交的不能固定約；存檔讀回來還在
  var raw = JSON.parse(JSON.stringify(s)); global.localStorage = { getItem: function () { return JSON.stringify(Object.assign(raw, { v: 9, tutorial: { step: 'done' } })); }, setItem: function () {} };
  var back = C.load(); assert.strictEqual(back.standings.length, 1); assert.strictEqual(back.roles[0].slots[1].standing, st.id); assert.ok(back.entries.some(function (e) { return e.daily; })); delete global.localStorage;
});
ok('打招呼密鑰：要對方同意才成立；第三人找不到；不能像序號；兩人 1 分鐘內都輸入就當場換、後輸入的那一刻判；只有一人 1 分鐘內沒等到就取消不記；一天第二次不算對接次數；改要再同意；刪', function () {
  var s = houseBase();
  throws(function () { C.proposeGreet(s, J1, J2, { key: 'J2', give: ['e1'], get: ['e2'] }, T0); }, /不能長得像序號/);
  throws(function () { C.proposeGreet(s, J1, J2, { key: '00000000002', give: ['e1'], get: ['e2'] }, T0); }, /不能長得像序號/);
  throws(function () { C.proposeGreet(s, J1, J2, { key: '', give: ['e1'], get: ['e2'] }, T0); }, /先寫密鑰/);
  throws(function () { C.proposeGreet(s, J1, J2, { key: '早安', give: [], get: ['e2'] }, T0); }, /各選一樣/);
  var g = C.proposeGreet(s, J1, J2, { key: '早安', give: ['e1'], get: ['e2'] }, T0);
  assert.ok(g.status === 'pending' && g.pending.by === J1 && g.pending.key === '早安', '甲提議：待乙同意');
  assert.deepStrictEqual(C.enterKey(s, J2, '早安', T0), { found: false }, '還沒同意：輸入密鑰找不到');
  assert.ok(C.myGreets(s, J2, T0)[0].pending && !C.myGreets(s, J2, T0)[0].pending.mine, '乙那邊看到待同意');
  throws(function () { C.agreeGreet(s, J1, g.id); }, /要等對方/);
  C.agreeGreet(s, J2, g.id); assert.ok(g.status === 'active' && g.key === '早安' && !g.pending, '乙同意：成立');
  assert.deepStrictEqual([g.itemsA, g.itemsB], [['e1'], ['e2']]);
  assert.deepStrictEqual(C.enterKey(s, J3, '早安', T0), { found: false }, '第三個人輸入只說找不到');
  // 只有一人：等 1 分鐘，沒等到就取消、什麼都不記
  var w = C.enterKey(s, J1, '早安', T0); assert.ok(w.found && w.waiting && w.until === T0 + 60e6, '甲先輸入：等對方 1 分鐘');
  assert.ok(C.waitingOn(s, J1, T0 + 30e6), '還在等'); C.expireGreetWaits(s, T0 + 61e6);
  assert.strictEqual(C.waitingOn(s, J1, T0 + 61e6), null, '1 分鐘沒等到：取消'); assert.strictEqual(s.dockings.length, 0, '什麼都不記');
  // 兩人 1 分鐘內都輸入：後輸入的那一刻就是那一微秒
  C.enterKey(s, J2, '早安', T0 + 100e6); var r = C.enterKey(s, J1, '早安', T0 + 130e6);
  assert.ok(r.found && r.docked && r.docking && r.docking.traded && r.docking.atUs === T0 + 130e6 && r.docking.greet === g.id, '乙先、甲 30 秒後輸入：當場換一次，那一微秒是甲輸入的那一刻');
  assert.ok(r.slot.greet === g.id && C.isPresent(s, J1, r.slot.id) && C.isPresent(s, J2, r.slot.id), '兩人都算到達');
  assert.strictEqual(C.dockCount(s, J1), 1, '算一次對接'); assert.strictEqual(C.myGreets(s, J1, T0 + 131e6)[0].lastDay, C.dayNum(T0 + 130e6), '上次哪天');
  assert.ok(s.entries.some(function (e) { return e.slot === r.slot.id && e.greet && e.status === 'traded'; }), '事件簿多一行');
  assert.ok(C.viewHouse(s, J1, null, T0 + 131e6).bricks.find(function (b) { return b.day === C.dayNum(T0 + 130e6); }).lit === 1, '亮一塊磚');
  // 同一對人一天第二次：照樣記一筆、亮磚，但不算進對接過幾次和換點比例
  C.enterKey(s, J1, '早安', T0 + 200e6); var r2 = C.enterKey(s, J2, '早安', T0 + 210e6);
  assert.ok(r2.docked && r2.docking.traded && r2.docking.noCount, '第二次：成交、記一筆');
  assert.strictEqual(C.dockCount(s, J1), 1, '不算進對接過幾次'); assert.strictEqual(C.ratio(s, J1).n, 1, '不算進換點比例');
  assert.strictEqual(C.viewHouse(s, J1, null, T0 + 211e6).bricks.find(function (b) { return b.day === C.dayNum(T0 + 210e6); }).lit, 2, '磚照樣算');
  // 規則照常：貨不夠就不成交、照事實記錄
  C.restock(s, J2, 'e2', -C.stockOf(s.roles[1], 'e2').avail);
  C.enterKey(s, J1, '早安', T0 + 300e6); var r3 = C.enterKey(s, J2, '早安', T0 + 301e6);
  assert.ok(r3.docked && !r3.docking.traded && /東西不夠/.test(r3.docking.reason), '東西不夠：不成交、照事實記錄');
  // 改：兩個人都要同意；刪：任一方
  var g2 = C.proposeGreet(s, J2, J1, { key: '午安', give: ['e2'], get: ['e1'] }, T0 + 400e6);
  assert.ok(g2 === g && g.status === 'active' && g.key === '早安' && g.pending.key === '午安' && g.pending.by === J2, '改密鑰：原本的還在用，新的等對方同意');
  assert.ok(C.enterKey(s, J1, '午安', T0 + 401e6).found === false && C.enterKey(s, J1, '早安', T0 + 402e6).found, '同意前舊密鑰照用');
  C.rejectGreet(s, J1, g.id); assert.ok(!g.pending && g.key === '早安', '不同意：改的作廢');
  C.deleteGreet(s, J2, g.id); assert.strictEqual(C.greetsOf(s).length, 0, '任一方可以刪'); assert.deepStrictEqual(C.enterKey(s, J1, '早安', T0 + 500e6), { found: false });
  // 存檔讀回來
  var g3 = C.proposeGreet(s, J1, J3, { key: '你好', give: ['e1'], get: ['e3'] }, T0);
  var raw = JSON.parse(JSON.stringify(s)); global.localStorage = { getItem: function () { return JSON.stringify(Object.assign(raw, { v: 9, tutorial: { step: 'done' } })); }, setItem: function () {} };
  var back = C.load(); assert.strictEqual(back.greets.length, 1); assert.strictEqual(back.greets[0].pending.key, '你好'); assert.ok(back.dockings.some(function (d) { return d.greet === g.id && d.noCount; }), '對接紀錄的密鑰、不算次數都還在'); delete global.localStorage;
});
ok('純資料檢查與存檔格式：角色洗過還是同一份資料', function () {
  var s = fresh(); var slot = meet(s, J1, [J2]); C.setWants(s, slot.id, J2, J1, ['r1a']); C.judge(s, T0 + 60e6, {});
  s.roles.forEach(function (r) { var c = C.tryClean(r); assert.ok(c.role, c.error); assert.deepStrictEqual(c.role, JSON.parse(JSON.stringify(r))); });
});

ok('密鑰不能重複：同一個人跟第二個人設同一個密鑰擋下（待同意的也算）；對方同意時也擋；不分大小寫、頭尾空白不算', function () {
  var s = base();
  C.proposeGreet(s, J1, J2, { key: 'hello', give: ['y'], get: ['e2'] }, T0); C.agreeGreet(s, J2, C.greetPair(s, J1, J2).id);
  throws(function () { C.proposeGreet(s, J1, J3, { key: ' Hello ', give: ['y'], get: ['e3'] }, T0); }, /這個密鑰你已經跟 乙 用了/);
  C.proposeGreet(s, J1, J3, { key: 'bye', give: ['y'], get: ['e3'] }, T0);
  throws(function () { C.proposeGreet(s, J3, J2, { key: 'BYE', give: ['q'], get: ['e2'] }, T0); }, /已經跟 甲 用了/);   // 丙那邊：甲提議的 bye 還在待同意，也算
  throws(function () { C.proposeGreet(s, J2, J3, { key: 'hello', give: ['p'], get: ['e3'] }, T0); }, /已經跟 甲 用了/);   // 乙跟丙提議 hello：乙自己已經跟甲用 hello
});
ok('密鑰重複（續）：乙跟甲用著 hello，丙提議 hello 給乙，乙同意時擋下；輸入 HELLO 也配得到', function () {
  var s = base();
  C.proposeGreet(s, J1, J2, { key: 'hello', give: ['y'], get: ['e2'] }, T0); C.agreeGreet(s, J2, C.greetPair(s, J1, J2).id);
  C.proposeGreet(s, J3, J2, { key: 'Hello', give: ['q'], get: ['e2'] }, T0);
  throws(function () { C.agreeGreet(s, J2, C.greetPair(s, J2, J3).id); }, /已經跟 甲 用了/);
  assert.strictEqual(C.enterKey(s, J1, 'HELLO ', T0).waiting, true); assert.strictEqual(C.enterKey(s, J2, 'hello', T0 + 1e6).docked, true, '不分大小寫、頭尾空白不算');
});
ok('村子：邀他當鄰居 → 他同意挑地就開了村子（兩人）；一人一村；搬進要村裡每個人同意；挑地要靠著別間、最多隔一塊；換位置；搬走；請人搬走要其他人都同意；剩一人就散；不玩了等於搬走；紀錄不變', function () {
  var s = base(), J4 = '00000000004'; C.createRole(s, { serial: J4, name: '丁', dailyPoints: 100, rules: {}, resources: [{ id: 'e4', name: '空的', price: 0, avail: 1 }] }, T0);
  var slot = meet(s, J1, [J2]); C.setWants(s, slot.id, J2, J1, ['y']); C.judge(s, T0 + 60e6); var before = JSON.stringify([s.entries, s.dockings, s.holds]);
  assert.strictEqual(C.isNeighbor(s, J1, J2), false);
  var inv = C.inviteNeighbor(s, J1, J2, T0); var v = C.villageOf(s, J1);
  assert.ok(v && v.proposed && v.members.length === 1 && C.myInvites(s, J2)[0].ready, '我沒村子：提議一個新村子，等他同意');
  throws(function () { C.inviteNeighbor(s, J1, J2, T0); }, /已經邀過了/);
  throws(function () { C.joinVillage(s, J2, v.id, inv.id, [5, 5], 0, T0); }, /要靠著村裡某一間/);
  throws(function () { C.joinVillage(s, J2, v.id, inv.id, [0, 0], 0, T0); }, /已經有人/);
  throws(function () { C.joinVillage(s, J3, v.id, inv.id, [1, 0], 0, T0); }, /這不是你的/);
  C.joinVillage(s, J2, v.id, inv.id, [2, 0], 90, T0);
  assert.ok(!v.proposed && v.members.length === 2 && C.isNeighbor(s, J1, J2) && C.isNeighbor(s, J2, J1) && !C.isNeighbor(s, J1, J3), '他同意、挑了地（隔一塊）：村子開了，兩人是鄰居');
  assert.deepStrictEqual(C.neighborsOf(s, J1), [J2]);
  throws(function () { C.inviteNeighbor(s, J3, J2, T0); }, /已經住在村子裡了/);
  // 丙申請搬進來：要甲乙都同意
  var ap = C.applyVillage(s, J3, J1, T0); assert.deepStrictEqual(C.villageInfo(s, J1).pending[0].waiting, [J1, J2]);
  throws(function () { C.joinVillage(s, J3, v.id, ap.id, [1, 1], 0, T0); }, /還有人沒同意：甲、乙/);
  C.approveVillage(s, J1, v.id, ap.id); throws(function () { C.joinVillage(s, J3, v.id, ap.id, [1, 1], 0, T0); }, /還有人沒同意：乙/);
  C.approveVillage(s, J2, v.id, ap.id);
  var spots = C.freeSpots(s, v.id); assert.ok(spots.some(function (p) { return p[0] === 1 && p[1] === 1; }) && !spots.some(function (p) { return p[0] === 0 && p[1] === 0; }) && !spots.some(function (p) { return p[0] === 5; }), '能放的地：靠著某一間、沒人的');
  C.joinVillage(s, J3, v.id, ap.id, [1, 1], 180, T0); assert.strictEqual(v.members.length, 3);
  throws(function () { C.applyVillage(s, J3, J1, T0); }, /一個人只住一個村子/);
  // 丁被乙邀：要甲乙丙都同意（乙邀的算同意了）
  var i4 = C.inviteNeighbor(s, J2, J4, T0); assert.deepStrictEqual(C.villageInfo(s, J2).pending[0].waiting.sort(), [J1, J3]);
  C.approveVillage(s, J1, v.id, i4.id); C.approveVillage(s, J3, v.id, i4.id); C.joinVillage(s, J4, v.id, i4.id, [2, 2], 0, T0);
  // 換位置：要靠著別間、村子不能散
  throws(function () { C.moveHouse(s, J4, [6, 6], 0); }, /要靠著村裡某一間/);
  C.moveHouse(s, J4, [3, 1], 270); assert.deepStrictEqual(C.villageOf(s, J4).members.find(function (m) { return m.serial === J4; }).pos, [3, 1]);
  // 請人搬走：其他人都同意才算
  var r1 = C.askLeave(s, J1, J4, T0); assert.ok(!r1.done && r1.waiting.length === 2, '甲請丁走：還要乙丙同意');
  C.approveVillage(s, J2, v.id, C.villageInfo(s, J1).pending[0].id); assert.strictEqual(v.members.length, 4);
  C.approveVillage(s, J3, v.id, C.villageInfo(s, J1).pending[0].id); assert.strictEqual(v.members.length, 3); assert.strictEqual(C.villageOf(s, J4), null, '都同意了：丁走了');
  // 搬走不用誰同意；剩一人就散；不玩了等於搬走
  C.leaveVillage(s, J3); assert.strictEqual(v.members.length, 2);
  assert.strictEqual(JSON.stringify([s.entries, s.dockings, s.holds]), before, '搬進、搬走、換位置都不改任何紀錄');
  C.quit(s, J2, T0 + 1, true); assert.strictEqual(C.villageOf(s, J1), null, '乙不玩了＝搬走，剩甲一人，村子散了');
  assert.strictEqual(C.villagesOf(s).length, 0);
  // 不要：被邀的人拒絕，新村子的提議就沒了
  var i2 = C.inviteNeighbor(s, J1, J3, T0); C.rejectVillage(s, J3, C.villageOf(s, J1).id, i2.id); assert.strictEqual(C.villagesOf(s).length, 0);
});
ok('村子（續）：三間排一排，中間搬走或被請走，兩邊還是鄰居；存檔讀回來人數不變；之後可以靠著任何一間搬進來、換位置', function () {
  var s = base(), J4 = '00000000004'; C.createRole(s, { serial: J4, name: '丁', dailyPoints: 100, rules: {}, resources: [] }, T0);
  var inv = C.inviteNeighbor(s, J1, J2, T0); var v = C.villageOf(s, J1); C.joinVillage(s, J2, v.id, inv.id, [2, 0], 0, T0);
  var ap = C.applyVillage(s, J3, J1, T0); C.approveVillage(s, J1, v.id, ap.id); C.approveVillage(s, J2, v.id, ap.id); C.joinVillage(s, J3, v.id, ap.id, [4, 0], 0, T0);
  C.moveHouse(s, J2, [2, 2], 0); assert.deepStrictEqual(v.members.find(function (m) { return m.serial === J2; }).pos, [2, 2], '換位置只要靠著任何一間，不要求整村連在一起');
  C.moveHouse(s, J2, [2, 0], 0);
  C.leaveVillage(s, J2); assert.ok(C.villageOf(s, J1) === v && v.members.length === 2 && C.isNeighbor(s, J1, J3), '中間那間搬走：甲 [0,0]、丙 [4,0] 隔很遠，照樣是同一個村子、還是鄰居');
  var raw = JSON.parse(JSON.stringify(s)), out = { roles: raw.roles.map(C.cleanRole), notices: [] }; C.cleanVillages(out, raw.villages);
  assert.strictEqual(out.villages.length, 1); assert.strictEqual(out.villages[0].members.length, 2, '存檔讀回來人數不變（不因為離太遠丟人）');
  var a2 = C.applyVillage(s, J4, J3, T0); C.approveVillage(s, J1, v.id, a2.id); C.approveVillage(s, J3, v.id, a2.id);
  throws(function () { C.joinVillage(s, J4, v.id, a2.id, [9, 9], 0, T0); }, /要靠著村裡某一間/);
  C.joinVillage(s, J4, v.id, a2.id, [6, 0], 0, T0); assert.ok(C.isNeighbor(s, J4, J1), '丁靠著丙搬進來（離甲很遠也行）');
  C.moveHouse(s, J1, [5, 2], 90); assert.deepStrictEqual(C.villageOf(s, J1).members.find(function (m) { return m.serial === J1; }).pos, [5, 2]);
  // 中間被請走也一樣
  var s2 = base(); var i2 = C.inviteNeighbor(s2, J1, J2, T0); var v2 = C.villageOf(s2, J1); C.joinVillage(s2, J2, v2.id, i2.id, [2, 0], 0, T0);
  var p2 = C.applyVillage(s2, J3, J1, T0); C.approveVillage(s2, J1, v2.id, p2.id); C.approveVillage(s2, J2, v2.id, p2.id); C.joinVillage(s2, J3, v2.id, p2.id, [4, 0], 0, T0);
  C.askLeave(s2, J1, J2, T0); C.approveVillage(s2, J3, v2.id, C.villageInfo(s2, J1).pending[0].id);
  assert.ok(!C.villageOf(s2, J2) && C.isNeighbor(s2, J1, J3) && v2.members.length === 2, '中間被請走：兩邊還是鄰居');
  var r2 = JSON.parse(JSON.stringify(s2)), o2 = { roles: r2.roles.map(C.cleanRole), notices: [] }; C.cleanVillages(o2, r2.villages); assert.strictEqual(o2.villages[0].members.length, 2);
});
ok('空出來的地先選好（補十八）：三間排一排、中間搬走或被請走 → 下一個搬進來的預設選中間那塊；選別塊也可以；補進去以後就沒有預設；存檔讀回來還記得', function () {
  var J4 = '00000000004', J5 = '00000000005';
  var mk = function () { var s = base(); [J4, J5].forEach(function (x, i) { C.createRole(s, { serial: x, name: ['丁', '戊'][i], dailyPoints: 100, rules: {}, resources: [] }, T0); });
    var inv = C.inviteNeighbor(s, J1, J2, T0), v = C.villageOf(s, J1); C.joinVillage(s, J2, v.id, inv.id, [2, 0], 0, T0);
    var ap = C.applyVillage(s, J3, J1, T0); C.approveVillage(s, J1, v.id, ap.id); C.approveVillage(s, J2, v.id, ap.id); C.joinVillage(s, J3, v.id, ap.id, [4, 0], 0, T0); return { s: s, v: v }; };
  var a = mk(), s = a.s, v = a.v;
  assert.strictEqual(C.suggestedSpot(s, v.id), null, '沒有空出來的地：沒有預設');
  C.leaveVillage(s, J2); assert.deepStrictEqual(C.suggestedSpot(s, v.id), [2, 0], '中間搬走：預設選中間那塊');
  var raw = JSON.parse(JSON.stringify(s)), out = { roles: raw.roles.map(C.cleanRole), notices: [] }; C.cleanVillages(out, raw.villages);
  assert.deepStrictEqual(out.villages[0].vacated, [[2, 0]], '存檔讀回來還記得');
  var old = JSON.parse(JSON.stringify(raw.villages)); delete old[0].vacated; C.cleanVillages(out, old); assert.ok(out.villages.length === 1 && !out.villages[0].vacated, '舊存檔沒有這個也行');
  var p4 = C.applyVillage(s, J4, J1, T0); C.approveVillage(s, J1, v.id, p4.id); C.approveVillage(s, J3, v.id, p4.id);
  C.joinVillage(s, J4, v.id, p4.id, [0, 2], 0, T0); assert.deepStrictEqual(C.suggestedSpot(s, v.id), [2, 0], '丁選了別塊也可以，中間那塊還是空地');
  var p5 = C.applyVillage(s, J5, J1, T0); [J1, J3, J4].forEach(function (x) { C.approveVillage(s, x, v.id, p5.id); });
  C.joinVillage(s, J5, v.id, p5.id, [2, 0], 90, T0); assert.strictEqual(C.suggestedSpot(s, v.id), null, '戊補進中間：就沒有預設了');
  // 中間被請走也一樣；換位置過去也算補上
  var b = mk(); C.askLeave(b.s, J1, J2, T0); C.approveVillage(b.s, J3, b.v.id, C.villageInfo(b.s, J1).pending[0].id);
  assert.deepStrictEqual(C.suggestedSpot(b.s, b.v.id), [2, 0], '中間被請走：預設選中間那塊');
  C.moveHouse(b.s, J3, [2, 0], 0); assert.deepStrictEqual(C.suggestedSpot(b.s, b.v.id), [4, 0], '丙換位置到中間：中間不算空地，丙原本那塊空出來（靠著丙）');
});
ok('鄰居：看得到彼此「只給鄰居看」的屋和那幾筆；非鄰居看不到；從只給鄰居看的那間看不顯示村子；從公開的那間看得到全村', function () {
  var s = base(); var slot = meet(s, J1, [J2]); C.setWants(s, slot.id, J2, J1, ['y']); C.judge(s, T0 + 60e6);
  var e = s.entries.find(function (x) { return x.status === 'traded'; }); C.setVis(s, J1, e.id, 'neighbors'); C.setHouse(s, J1, { visibility: 'neighbors' });
  assert.ok(C.viewHouse(s, J1, J3, T0 + 61e6).closed && C.dayDetail(s, J1, J3, C.dayNum(T0), T0 + 61e6).closed, '丙不是鄰居：整間屋只給鄰居看，看不到');
  var inv = C.inviteNeighbor(s, J1, J3, T0); C.joinVillage(s, J3, C.villageOf(s, J1).id, inv.id, [1, 0], 0, T0);
  var vh = C.viewHouse(s, J1, J3, T0 + 61e6);
  assert.ok(!vh.closed && vh.bricks.find(function (b) { return b.day === C.dayNum(T0); }).lit === 1 && C.dayDetail(s, J1, J3, C.dayNum(T0), T0 + 61e6).entries.length === 1, '丙搬進來當鄰居：看得到整間屋和只給鄰居看的那一筆');
  assert.strictEqual(C.viewVillage(s, J1, J2, T0).houses.length, 1, '乙不是鄰居：從只給鄰居看的那一間看，只看得到那一間');
  var vv = C.viewVillage(s, J3, J2, T0); assert.strictEqual(vv.houses.length, 2); assert.ok(vv.houses.find(function (h) { return h.serial === J1; }).view.closed && !vv.houses.find(function (h) { return h.serial === J3; }).view.closed, '從公開的那一間看：看得到全村，只給鄰居看的那間只有外觀');
  assert.strictEqual(C.viewVillage(s, J1, J3, T0).houses.length, 2, '鄰居從哪一間看都看得到全村');
  C.leaveVillage(s, J3); assert.ok(C.viewHouse(s, J1, J3, T0 + 61e6).closed, '搬走就不是鄰居了');
});
ok('接上去：接到需要下面（我給他）、接到可以給下面（他給我）、岔路照順序；接成一圈的偵測；上限；圈主開時段、大家預約、平台先選好、那一微秒全部成交；需要拿掉、其他岔路提醒「已經有人做到了」', function () {
  var s = base(), J4 = '00000000004'; C.createRole(s, { serial: J4, name: '丁', dailyPoints: 100, rules: {}, resources: [{ id: 'd', name: '一束花', price: 20, avail: 5 }, { id: 'e4', name: '空的', price: 0, avail: 5 }] }, T0);
  var nA = C.postNotice(s, J1, { need: '一首歌', give: ['x'], cap: 4 }, T0);
  var lB = C.linkNotice(s, J2, nA.id, { side: 'need', give: ['p'], need: '借書' }, T0 + 1); assert.ok(lB.notice.parent.side === 'need' && lB.circle === null && lB.notice.cap === 4, '乙接到甲的需要下面：給一首歌，寫自己的需要借書；上限照上面那張');
  throws(function () { C.linkNotice(s, J2, nA.id, { side: 'need', give: ['p'], need: '借書' }, T0 + 1); }, /已經接在這張公告上了/);
  throws(function () { C.linkNotice(s, J2, lB.notice.id, { side: 'need', give: ['p'], need: 'x' }, T0 + 1); }, /不能接自己的公告/);
  var lC = C.linkNotice(s, J3, lB.notice.id, { side: 'need', give: ['q'], need: '一束花' }, T0 + 2); assert.strictEqual(lC.circle, null);
  var lD2 = C.linkNotice(s, J4, lB.notice.id, { side: 'need', give: ['d'], need: '畫一張圖' }, T0 + 3); assert.deepStrictEqual(C.linksUnder(s, lB.notice.id).map(function (n) { return n.owner; }), [J3, J4], '同一個需要兩個人接：岔路照接上去的順序');
  assert.deepStrictEqual(C.chainOf(s, lC.notice.id).map(function (n) { return n.owner; }), [J1, J2, J3], '整條鏈：甲 ← 乙 ← 丙');
  // 丁想要甲可以給的（畫一張圖）：接到甲的可以給下面 → 甲→丁；丁已經給乙（丁→乙），乙→甲：接成一圈 甲→丁→乙→甲（3 人）
  var r = C.linkNotice(s, J4, nA.id, { side: 'give', item: 'x', give: ['d'], need: '畫一張圖' }, T0 + 4);
  assert.ok(r.circle && r.circle.status === 'open' && r.circle.leader === J4 && r.circle.members.length === 3, '線接回起點：一圈（丁當圈主）' + JSON.stringify(r.circle && r.circle.members));
  var c = r.circle; assert.deepStrictEqual(c.edges.map(function (e) { return e.from + '>' + e.to + ':' + e.item; }), [J1 + '>' + J4 + ':x', J4 + '>' + J2 + ':d', J2 + '>' + J1 + ':p'], '這一圈每個人給誰什麼');
  assert.ok(C.myCircles(s, J2).length === 1 && C.myCircles(s, J3).length === 0, '圈裡的每個人都看得到提醒，丙不在圈裡');
  throws(function () { C.openCircleSlot(s, J1, c.id, T0 + 600e6, T0); }, /只有圈主/);
  var slot = C.openCircleSlot(s, J4, c.id, T0 + 600e6, T0); assert.ok(slot.together && slot.capacity === 2 && c.status === 'slotted');
  C.bookCircle(s, J1, c.id, T0 + 10); C.bookCircle(s, J2, c.id, T0 + 11);
  assert.ok(C.isPresent(s, J1, slot.id) && C.isPresent(s, J2, slot.id), '預約時就確認到達');
  assert.deepStrictEqual([C.wantsOf(slot, J4, J1), C.wantsOf(slot, J1, J4), C.wantsOf(slot, J2, J4), C.wantsOf(slot, J4, J2), C.wantsOf(slot, J1, J2), C.wantsOf(slot, J2, J1)], [['x'], ['e4'], ['d'], ['e2'], ['p'], ['e1']], '平台先選好：拿的人選那樣東西，給的人選對方的空的');
  C.setWants(s, slot.id, J4, J2, ['e2']);   // 各人還能改
  var before = JSON.stringify([s.holds.length, C.remainingToday(s, C.roleOf(s, J1), T0)]);
  assert.strictEqual(before, JSON.stringify([0, 1000]), '排隊不扣點、不留貨');
  C.judge(s, T0 + 600e6);
  assert.ok(c.status === 'done' && s.dockings.filter(function (d) { return d.slot === slot.id && d.traded; }).length === 3, '那一微秒照一起成交：全部成');
  assert.ok(!C.noticeOf(s, nA.id) && !C.noticeOf(s, lB.notice.id) && !C.noticeOf(s, r.notice.id), '成交以後圈裡的需要都拿掉');
  var left = C.noticeOf(s, lC.notice.id); assert.ok(left && left.parent === null && left.doneBy && left.doneBy.need === '借書', '丙那條岔路：公告留著、沒接在誰下面，提醒「已經有人做到了」');
  assert.strictEqual(C.doneByOf(s, J3).length, 1); C.ackDoneBy(s, J3, left.id); assert.strictEqual(C.doneByOf(s, J3).length, 0);
  assert.ok(!C.noticeOf(s, lD2.notice.id), '丁接在乙下面的那張在圈裡（丁給乙花），也拿掉了');
});
ok('一圈：人數超過圈裡任何一張公告的上限就不算接成；沒成交線留著、圈主可以再開；到期或撤掉線一起拿掉、圈散掉；不用回報的送禮鏈', function () {
  var s = base();
  var nA = C.postNotice(s, J1, { need: '一首歌', give: ['x'], cap: 2 }, T0);
  var lB = C.linkNotice(s, J2, nA.id, { side: 'need', give: ['p'], need: '借書', cap: 5 }, T0 + 1);
  var lC = C.linkNotice(s, J3, lB.notice.id, { side: 'need', give: ['q'], need: '畫一張圖', cap: 5 }, T0 + 2);
  var r = C.linkNotice(s, J1, lC.notice.id, { side: 'need', give: ['x'], need: '一首歌', cap: 5 }, T0 + 3);
  assert.ok(r.circle && r.circle.tooMany && r.circle.cap === 2 && C.circlesOf(s).length === 0, '三個人超過甲那張的上限 2：不算接成，線留著');
  C.removeNotice(s, J1, r.notice.id); nA.cap = 3; var r2 = C.linkNotice(s, J1, lC.notice.id, { side: 'need', give: ['x'], need: '一首歌', cap: 5 }, T0 + 4);
  assert.ok(r2.circle && !r2.circle.tooMany && r2.circle.members.length === 3, '上限夠就接成');
  var c = r2.circle, slot = C.openCircleSlot(s, J1, c.id, T0 + 300e6, T0); C.bookCircle(s, J2, c.id, T0); C.bookCircle(s, J3, c.id, T0);
  C.restock(s, J3, 'q', -C.stockOf(C.roleOf(s, J3), 'q').avail);   // 丙的書在那一微秒前被換光
  C.judge(s, T0 + 300e6);
  assert.ok(c.status === 'open' && c.slot === null && C.noticeOf(s, nA.id) && C.noticeOf(s, lB.notice.id), '中間貨被換走：那一圈不成交，線留著，圈主可以再開');
  C.restock(s, J3, 'q', 5); var slot2 = C.openCircleSlot(s, J1, c.id, T0 + 400e6, T0); assert.strictEqual(c.status, 'slotted');
  C.removeNotice(s, J2, lB.notice.id);
  assert.ok(C.noticeOf(s, lC.notice.id).parent === null && c.status === 'slotted', '撤掉乙那張：接在上面的線拿掉；已經開了時段的圈留到判完');
  C.judge(s, T0 + 400e6); assert.strictEqual(c.status, 'open');
  // 到期：線一起拿掉、還沒開時段的圈散掉
  var s2 = base(); var a2 = C.postNotice(s2, J1, { need: '一首歌', give: ['x'], cap: 3, untilDay: C.dayNum(T0) }, T0);
  var far = C.dayNum(T0) + 30, b2 = C.linkNotice(s2, J2, a2.id, { side: 'need', give: ['p'], need: '借書', untilDay: far }, T0 + 1); var c2 = C.linkNotice(s2, J3, b2.notice.id, { side: 'need', give: ['q'], need: '畫一張圖', untilDay: far }, T0 + 2);
  assert.strictEqual(b2.notice.untilDay, far); var g = C.linkNotice(s2, J1, c2.notice.id, { side: 'need', give: ['x'], need: '一首歌', untilDay: far }, T0 + 3); assert.ok(g.circle && g.circle.status === 'open');
  C.expire(s2, T0 + DAY); assert.ok(!C.noticeOf(s2, a2.id) && C.noticeOf(s2, b2.notice.id).parent === null && g.circle.status === 'void', '到期：公告拿掉、線拿掉、圈散掉');
  // 不用回報：鏈的起頭當送禮，由他開時段，照一起成交先換
  var s3 = base(); var a3 = C.postNotice(s3, J1, { need: '一首歌', give: ['x'], cap: 3 }, T0);
  var b3 = C.linkNotice(s3, J2, a3.id, { side: 'need', give: ['p'], need: '借書' }, T0 + 1); var c3 = C.linkNotice(s3, J3, b3.notice.id, { side: 'need', give: ['q'], need: '畫一張圖' }, T0 + 2);
  throws(function () { C.giftChain(s3, J2, b3.notice.id, T0); }, /不是鏈的起頭/);
  var gc = C.giftChain(s3, J3, c3.notice.id, T0); assert.ok(gc.gift && gc.leader === J3 && gc.members.length === 3 && c3.notice.noReport, '丙（只給不收的那一端）選不用回報：送禮鏈，丙當圈主');
  var gs = C.openCircleSlot(s3, J3, gc.id, T0 + 300e6, T0); C.bookCircle(s3, J2, gc.id, T0); C.bookCircle(s3, J1, gc.id, T0);
  assert.deepStrictEqual([C.wantsOf(gs, J2, J3), C.wantsOf(gs, J3, J2), C.wantsOf(gs, J1, J2), C.wantsOf(gs, J2, J1)], [['q'], ['e2'], ['p'], ['e1']]);
  C.judge(s3, T0 + 300e6); assert.ok(gc.status === 'done' && !C.noticeOf(s3, a3.id) && !C.noticeOf(s3, b3.notice.id), '送禮鏈成交：需要都拿掉');
});
ok('一圈：同一張公告好幾條岔路都接成一圈，掛公告的人選一條，其他排隊', function () {
  var s = base(), J4 = '00000000004'; C.createRole(s, { serial: J4, name: '丁', dailyPoints: 100, rules: {}, resources: [{ id: 'd', name: '一束花', price: 20, avail: 5 }, { id: 'e4', name: '空的', price: 0, avail: 5 }] }, T0);
  var nA = C.postNotice(s, J1, { need: '一首歌', give: ['x'], cap: 4 }, T0);
  var lB = C.linkNotice(s, J2, nA.id, { side: 'need', give: ['p'], need: '畫一張圖' }, T0 + 1);
  var c1 = C.linkNotice(s, J1, lB.notice.id, { side: 'need', give: ['x'], need: '一首歌' }, T0 + 2).circle; assert.ok(c1 && c1.status === 'open', '甲 ↔ 乙 接成一圈');
  var lC = C.linkNotice(s, J3, nA.id, { side: 'need', give: ['q'], need: '畫一張圖' }, T0 + 3);
  var c2 = C.linkNotice(s, J1, lC.notice.id, { side: 'need', give: ['x'], need: '一首歌' }, T0 + 4).circle;
  assert.ok(c2 && c2.status === 'queued' && C.myCircles(s, J1).some(function (x) { return x.id === c2.id && x.chooser; }), '同一張公告的另一條岔路也接成一圈：排隊，掛公告的人（甲）選');
  throws(function () { C.openCircleSlot(s, J1, c2.id, T0 + 300e6, T0); }, /還在排隊/);
  throws(function () { C.chooseCircle(s, J2, c2.id); }, /只有掛公告的人能選/);
  C.chooseCircle(s, J1, c2.id); assert.ok(c2.status === 'open' && c1.status === 'queued', '甲選了丙那一圈，乙那一圈排隊');
  C.openCircleSlot(s, J1, c2.id, T0 + 300e6, T0); throws(function () { C.chooseCircle(s, J1, c1.id); }, /已經開了時段/);
});
ok('村子、一圈存檔讀得進來；舊存檔沒有村子和線也行', function () {
  var s = base(); var inv = C.inviteNeighbor(s, J1, J2, T0); C.joinVillage(s, J2, C.villageOf(s, J1).id, inv.id, [1, 0], 90, T0);
  var nA = C.postNotice(s, J1, { need: '一首歌', give: ['x'], cap: 4 }, T0); var lB = C.linkNotice(s, J2, nA.id, { side: 'need', give: ['p'], need: '畫一張圖' }, T0 + 1); var c = C.linkNotice(s, J1, lB.notice.id, { side: 'need', give: ['x'], need: '一首歌' }, T0 + 2).circle;
  var raw = JSON.parse(JSON.stringify(s)); raw.v = 9;
  var out = { roles: raw.roles.map(C.cleanRole), notices: [] }; C.cleanVillages(out, raw.villages);
  assert.deepStrictEqual(out.villages, raw.villages, '村子洗過還是同一份');
  raw.villages[0].members.push({ serial: '00000000009', pos: [1, 1], rot: 0 }); raw.villages[0].members.push({ serial: J3, pos: [0, 0], rot: 45 });
  C.cleanVillages(out, raw.villages); assert.strictEqual(out.villages[0].members.length, 2, '不存在的人、重疊的丟掉');
  C.cleanVillages(out, [{ id: 'v', members: [{ serial: J1, pos: [0, 0], rot: 0 }], pending: [], atUs: T0 }]); assert.strictEqual(out.villages.length, 0, '只剩一人的村子不算');
  var raw2 = JSON.parse(JSON.stringify(s)); var o2 = { roles: raw2.roles.map(C.cleanRole), notices: raw2.notices };
  var cc = raw2.circles.map(function (x) { return (function (st) { return C.cleanVillages && st; })(o2) && x; });
  assert.strictEqual(JSON.stringify(cc), JSON.stringify(raw2.circles));
  var old = { v: 9, me: 0, roles: raw.roles, holds: [], dockings: [], notices: raw.notices, tutorial: { step: 'done' } };
  delete old.villages; delete old.circles; var store = {}; global.localStorage = { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = v; }, removeItem: function (k) { delete store[k]; } };
  store['arrive-v9'] = JSON.stringify(old); var st = C.load(); assert.ok(Array.isArray(st.villages) && st.villages.length === 0 && Array.isArray(st.circles), '舊存檔沒有村子和線：讀得進來');
  store['arrive-v9'] = JSON.stringify(raw); var st2 = C.load(); assert.strictEqual(st2.villages.length, 1); assert.strictEqual(st2.circles.length, 1); assert.strictEqual(st2.notices.filter(function (n) { return n.parent; }).length, 2);
  delete global.localStorage;
});
ok('示範資料：阿澄和小樂住同一個村子（照規則做出來）、引路人和阿明不在村子；公告欄有一條三個人的鏈還差一個人接成一圈', function () {
  var s = C.fresh({ history: false });
  assert.ok(C.isNeighbor(s, '00000000002', '00000000003') && !C.villageOf(s, '00000000004') && !C.villageOf(s, '00000000005'), '阿澄、小樂是鄰居；引路人、阿明不在村子');
  var chain = s.notices.filter(function (n) { return n.parent; }); assert.strictEqual(chain.length, 2); assert.strictEqual(C.circlesOf(s).length, 0);
  var root = s.notices.find(function (n) { return n.owner === '00000000002' && n.need === '想學手機拍照'; }); assert.deepStrictEqual(C.chainOf(s, chain[1].id).map(function (n) { return n.owner; }), ['00000000002', '00000000005', '00000000003']);
  C.demoMe(s, T0); var r1 = C.linkNotice(s, J1, chain[1].id, { side: 'need', give: ['r1b'], need: '一小時諮詢' }, T0); assert.strictEqual(r1.circle, null);
  var r2 = C.linkNotice(s, J1, root.id, { side: 'give', item: 'r2b', give: ['r1b'], need: '一小時諮詢' }, T0 + 1);
  assert.ok(r2.circle && r2.circle.members.length === 4 && r2.circle.leader === J1, '新手接上去就成一圈（4 人）');
});
console.log('core.test.js ok（' + n + ' 項）');
