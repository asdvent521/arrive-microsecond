// v6 平台核心規則：node v6/tests/core.test.js
var assert = require('assert');
var C = require('../src/core.js');
function throws(fn, part) { var ok = false; try { fn(); } catch (e) { ok = e.message.indexOf(part) >= 0; if (!ok) throw new Error('錯誤訊息不對：' + e.message + '（要含「' + part + '」）'); } assert.ok(ok, '應該擋下：' + part); }
var DAY = C.DAY_US;
var now = C.nowUs();
var st = C.fresh();
var A = st.roles[0], B = st.roles[1], Cc = st.roles[2];

// ---- 1. 每天的點：隔天歸零、不能預支 ----
assert.strictEqual(C.remainingToday(st, A, now), 1800);
var slot = C.addSlot(st, A.serial, now + 60e6, 1, 100, now);
C.book(st, B.serial, slot.id, now);
C.dock(st, slot.id, B.serial, 1800, 500, now + 60e6);
assert.strictEqual(C.remainingToday(st, A, now + 60e6), 0, '今天給完了');
assert.strictEqual(C.remainingToday(st, A, now + 60e6 + DAY), 1800, '隔天歸零重算，昨天沒給的不會累積');
var slot2 = C.addSlot(st, A.serial, now + 120e6, 1, 10, now);
C.book(st, B.serial, slot2.id, now);
throws(function () { C.dock(st, slot2.id, B.serial, 1, 0, now + 120e6); }, '不能預支');
assert.strictEqual(C.balance(st, B.serial, A.serial, now), 1800); assert.strictEqual(C.balance(st, A.serial, B.serial, now), 500);

// ---- 2. 生命週期：規則不能改、到期作廢、提早結束要清點數 ----
assert.strictEqual(C.status(A, now), 'active');
assert.strictEqual(C.status(A, A.life.endUs + 1), 'ended');
assert.strictEqual(C.balance(st, B.serial, A.serial, A.life.endUs + 1), 0, '週期結束 A 點作廢');
A.rules.village = '偷改';
throws(function () { C.assertUnchanged(A); }, '被改了');
A.rules.village = ''; C.assertUnchanged(A);
throws(function () { C.endEarly(st, A.serial, now + 1e6, []); }, '沒兌現');
C.endEarly(st, A.serial, now + 1e6, [B.serial]);
assert.strictEqual(C.status(A, now + 2e6), 'ended');
assert.strictEqual(C.balance(st, B.serial, A.serial, now + 2e6), 0, '提早結束後 A 點作廢');
var A2 = C.recreate(st, A.serial, { name: '我二代', dailyPoints: 1500, rules: { conditions: [] } }, now + 2e6);
assert.strictEqual(A2.prev, A.serial); assert.strictEqual(A2.serial, '00000000004'); assert.ok(A2.rulesHash);
throws(function () { C.recreate(st, B.serial, { name: 'x', dailyPoints: 1 }, now); }, '先結束');
throws(function () { C.createRole(st, { name: 'x', dailyPoints: 0 }); }, '正整數');

// ---- 3、4. 條件判定 ----
var s2 = C.fresh(); var a = s2.roles[0], b = s2.roles[1], c = s2.roles[2];
assert.deepStrictEqual(C.passes(s2, a, b, now), { ok: true, failed: [] }, 'J2 每天 2000 ≥ 1000，通 J1');
assert.ok(!C.passes(s2, a, c, now).ok && C.passes(s2, a, c, now).failed[0].indexOf('對方每天的點數 至少 1000') >= 0, 'J3 800 不通 J1：' + C.passes(s2, a, c, now).failed[0]);
assert.ok(!C.passes(s2, b, a, now).ok, 'J1 對接 0 次，不通 J2');
assert.strictEqual(C.eligible(s2, a, b, now).ok, true, 'J1–J2 一方通就可以');
var e23 = C.eligible(s2, b, c, now); assert.ok(!e23.ok && e23.reason.indexOf('村規') >= 0, 'J2–J3：J3 要求接受村規');
C.accept(s2, b.serial, c.serial);
e23 = C.eligible(s2, b, c, now); assert.ok(!e23.ok && e23.reason.indexOf('兩方都通') >= 0, '接受村規後：J3 要求兩方都通但 J3 不通 J2（對接 0 次）：' + e23.reason);
// 空窗角色：條件和開關都視為關閉
C.enterVacancy(s2, c.serial, now);
assert.strictEqual(C.status(c, now), 'vacancy');
assert.ok(C.passes(s2, c, a, now).ok, '空窗的 J3 條件視為關閉');
assert.ok(C.eligible(s2, a, c, now).ok, 'J1 和空窗的 J3：J3 不能挑人，只能以做不到 J1 的要求拒絕');
assert.ok(C.eligible(s2, b, c, now).ok, '空窗的 J3：條件和開關都關了，J2 通（J3 沒條件），一方通就可以');
C.leaveVacancy(s2, c.serial, now);
assert.strictEqual(C.status(c, now), 'active');
assert.strictEqual(C.condText({ field: 'status', op: '!=', value: 'vacancy' }), '對方狀態 不是 空窗');
assert.strictEqual(C.condText({ field: 'daysLeft', op: '>=', value: 30 }), '對方週期還剩多久（天） 至少 30');

// ---- 5. 查詢 ----
assert.deepStrictEqual(C.canVisit(s2, a, now).map(function (r) { return r.name; }), ['小樂'], '我通小樂的條件（剩 59 天 ≥ 30）');
assert.deepStrictEqual(C.canCome(s2, a, now).map(function (r) { return r.name; }), ['阿澄']);
assert.strictEqual(C.searchResources(s2, '履歷', now)[0].resource.name, '改履歷');
assert.strictEqual(C.searchResources(s2, '', now).length, 5);
// 排序只照事實：最近的對接時段優先
var vis = C.canVisit(s2, b, now); assert.ok(vis.length >= 1);

// ---- 6. 預約：條件通才能約、名額滿不行、空窗照樣有名額 ----
var sb = b.slots[0];
C.book(s2, a.serial, sb.id, now);
throws(function () { C.book(s2, a.serial, sb.id, now); }, '已經預約');
throws(function () { C.book(s2, c.serial, sb.id, now); }, '條件不通');
var s3 = C.addSlot(s2, b.serial, now + 50e6, 1, 10, now);
C.book(s2, a.serial, s3.id, now);
C.enterVacancy(s2, c.serial, now);
var sc = C.addSlot(s2, c.serial, now + 70e6, 1, 0, now);
C.book(s2, a.serial, sc.id, now);
throws(function () { C.book(s2, b.serial, sc.id, now); }, '名額滿');
C.leaveVacancy(s2, c.serial, now);
throws(function () { C.addSlot(s2, b.serial, now - 1, 1, 0, now); }, '未來');
assert.ok(C.contactVisible(s2, b, a.serial, now), '預約成功看得到聯絡方式');
assert.ok(!C.contactVisible(s2, b, c.serial, now), '沒預約看不到');

// ---- 7. 對接：那一微秒、各給不超過當天剩下的、寫帳 ----
throws(function () { C.dock(s2, sb.id, a.serial, 100, 50, sb.atUs - 1); }, '還沒到');
throws(function () { C.dock(s2, sb.id, c.serial, 0, 0, sb.atUs); }, '沒有預約');
var d = C.dock(s2, sb.id, a.serial, 100, 50, sb.atUs);
assert.deepStrictEqual([d.a, d.b, d.gaveA, d.gaveB], [b.serial, a.serial, 100, 50]);
assert.strictEqual(s2.points.length, 2); assert.strictEqual(s2.points[0].issuer, b.serial); assert.strictEqual(s2.points[0].holder, a.serial); assert.strictEqual(s2.points[0].sig, null);
assert.strictEqual(C.dockCount(s2, a.serial), 1);
assert.ok(!C.contactVisible(s2, b, a.serial, sb.atUs + 1) || b.slots.some(function (s) { return s.bookings.indexOf(a.serial) >= 0 && s.docked.indexOf(a.serial) < 0; }), '對接完那個時段的聯絡方式就隱藏（還有別的預約才看得到）');
throws(function () { C.dock(s2, sb.id, a.serial, 0, 0, sb.atUs + 1); }, '已經對接過');
assert.ok(C.passes(s2, b, a, sb.atUs + 1).ok, '對接過一次，J1 現在通 J2 的條件');

// ---- 8、9. 兌現、兌現失敗自動空窗、補足才解除 ----
assert.strictEqual(C.balance(s2, a.serial, b.serial, now), 100);
var rd = C.redeem(s2, a.serial, b.serial, 'r2a', now);   // 改履歷 100 點
assert.ok(rd.ok && rd.cost === 100); assert.strictEqual(C.balance(s2, a.serial, b.serial, now), 0); assert.strictEqual(b.resources[0].qty, 2);
throws(function () { C.redeem(s2, a.serial, b.serial, 'r2b', now); }, '只有 0');
// J1 的「陪跑一小時」數量 1：B 手上 50 J1 點不夠 60 → 先補一次對接
var sA = C.addSlot(s2, a.serial, now + 90e6, 1, 100, now);
C.book(s2, b.serial, sA.id, now);
C.dock(s2, sA.id, b.serial, 100, 0, now + 90e6);
assert.strictEqual(C.balance(s2, b.serial, a.serial, now + 90e6), 150);
var ok1 = C.redeem(s2, b.serial, a.serial, 'r1a', now + 90e6); assert.ok(ok1.ok); assert.strictEqual(a.resources[0].qty, 0);
assert.strictEqual(C.balance(s2, b.serial, a.serial, now + 90e6), 90);
throws(function () { C.redeem(s2, b.serial, a.serial, 'r1a', now + 91e6); }, '自動進入空窗');
assert.strictEqual(C.status(a, now + 91e6), 'vacancy'); assert.deepStrictEqual(a.vacancyDebt, { holder: b.serial, resource: 'r1a' });
assert.strictEqual(s2.redeems.slice(-1)[0].ok, false, '兌現失敗留下紀錄');
assert.strictEqual(C.remainingToday(s2, a, now + 91e6), 0, '空窗每天的點停發');
throws(function () { C.redeem(s2, b.serial, a.serial, 'r1b', now + 91e6); }, '暫停兌現');
assert.strictEqual(C.balance(s2, b.serial, a.serial, now + 91e6), 90, '點暫停、不作廢');
throws(function () { C.leaveVacancy(s2, a.serial, now + 92e6); }, '先補足');
C.restock(s2, a.serial, 'r1a', 1);
C.leaveVacancy(s2, a.serial, now + 92e6);
assert.strictEqual(C.status(a, now + 92e6), 'active'); assert.strictEqual(a.vacancyDebt, null);
assert.strictEqual(C.balance(s2, b.serial, a.serial, now + 92e6), 30, '欠的那一筆自動兌現了');
assert.strictEqual(a.resources[0].qty, 0);
assert.strictEqual(s2.redeems.slice(-1)[0].ok, true);
// 空窗中不能提早結束逃掉
C.enterVacancy(s2, a.serial, now + 93e6);
throws(function () { C.endEarly(s2, a.serial, now + 93e6, []); }, '沒兌現');
C.leaveVacancy(s2, a.serial, now + 93e6);
// 自己的點對自己沒用
throws(function () { C.redeem(s2, a.serial, a.serial, 'r1b', now); }, '沒用');

// ---- 純資料：角色洗過、世界 ----
var cr = C.tryClean(JSON.parse(JSON.stringify(b))); assert.ok(cr.role && cr.role.slots.length === 3, cr.error);
var bad1 = JSON.parse(JSON.stringify(b)); bad1.rules.conditions[0].field = 'hack';
assert.ok(C.tryClean(bad1).error.indexOf('條件') >= 0);
var bad2 = JSON.parse(JSON.stringify(b)); bad2.world.objects[0].parts[0].color = 'url(x)';
assert.ok(C.tryClean(bad2).error.indexOf('顏色') >= 0);
assert.strictEqual(C.route(a.world.walk, a.world.objects, 'J2').steps.join('，'), '繞規則屋一圈（J），走到角色碑，再走到市集（2）');

console.log('core.test.js ok');
