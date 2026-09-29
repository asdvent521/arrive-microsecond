// 兌換與每日額度：node v5/tests/exchange.test.js
var assert = require('assert');
var D = require('../src/data.js'); global.DATA = D;
var F = require('../src/fusion.js'); global.FUSION = F;
var X = require('../src/exchange.js');
function throws(fn, part) { var ok = false; try { fn(); } catch (e) { ok = e.message.indexOf(part) >= 0; if (!ok) throw new Error('錯誤訊息不對：' + e.message); } assert.ok(ok, '應該擋下：' + part); }
var now = D.nowUs();
var st = D.fresh();
var A = st.roles[0], B = st.roles[1];
// 讓 B 拿到 A 發的題點：A 的第 1 版題點 100 大卡
function give(from, to, kind, ver) { st.points.push({ id: 'pt' + st.points.length, kind: kind, from: from.serial, to: to.serial, amount: 1, atUs: now + st.points.length, fusion: 'f', stage: 's', ruleVersion: String(ver), sig: null, spent: null }); }
give(A, B, 'idea', 1); give(A, B, 'idea', 1); give(A, B, 'battle', 1);
assert.strictEqual(X.kcalOf(st, st.points[0]), 100);
var h = X.holdings(st, B.serial);
assert.strictEqual(h.length, 2); assert.strictEqual(h[0].points.length, 2); assert.strictEqual(h[0].kcal, 200);
assert.strictEqual(X.remainingToday(st, A.serial, now), 1800);

// 換能量：2 題點 → 200 大卡，點數標已用
var x1 = X.exchange(st, { holder: B.serial, issuer: A.serial, kind: 'idea', n: 2 }, now);
assert.strictEqual(x1.kcal, 200); assert.strictEqual(x1.want, 'energy');
assert.ok(st.points[0].spent === x1.id && st.points[1].spent === x1.id);
assert.strictEqual(X.holdings(st, B.serial).length, 1, '題點用完了');
assert.strictEqual(X.remainingToday(st, A.serial, now), 1600);
throws(function () { X.exchange(st, { holder: B.serial, issuer: A.serial, kind: 'idea', n: 1 }, now); }, '沒有');

// 照發出者「當時」的版本：A 改成第 2 版題點 50，舊點還是 100
D.saveRules(A, { items: [{ text: 'x' }], ratios: { idea: 50, battle: 100 }, resources: [{ name: '陪跑一小時', kcal: 300 }] });
give(A, B, 'idea', 1); give(A, B, 'idea', 2);
var h2 = X.holdings(st, B.serial).find(function (g) { return g.kind === 'idea'; });
assert.strictEqual(h2.kcal, 150, '第 1 版 100 + 第 2 版 50');
var off = X.offers(st, B.serial, A.serial).find(function (o) { return o.kind === 'idea'; });
assert.strictEqual(off.perPoint, 50); assert.strictEqual(off.resources[0].enough, false);

// 換資源：不夠就擋；夠了就用最舊的點補到夠
throws(function () { X.exchange(st, { holder: B.serial, issuer: A.serial, kind: 'idea', resource: '陪跑一小時' }, now); }, '點數不夠');
give(A, B, 'idea', 1); give(A, B, 'idea', 1);   // 100+50+100+100 = 350 ≥ 300
var x2 = X.exchange(st, { holder: B.serial, issuer: A.serial, kind: 'idea', resource: '陪跑一小時' }, now);
assert.strictEqual(x2.want, 'resource'); assert.strictEqual(x2.kcal, 300); assert.strictEqual(x2.n, 4, '四點都用掉（多的不找零）');
give(A, B, 'idea', 2);
throws(function () { X.exchange(st, { holder: B.serial, issuer: A.serial, kind: 'idea', resource: '不存在' }, now); }, '沒有「不存在」');

// 每日 1800 上限：A 今天已發 500；再要 1400 就擋，隔天可以
for (var i = 0; i < 14; i++) give(A, B, 'battle', 1);   // 戰點 100 大卡 × 15 = 1500
throws(function () { X.exchange(st, { holder: B.serial, issuer: A.serial, kind: 'battle', n: 14 }, now); }, '今天只剩 1300');   // 200 + 300 已發
var x3 = X.exchange(st, { holder: B.serial, issuer: A.serial, kind: 'battle', n: 13 }, now);
assert.strictEqual(X.remainingToday(st, A.serial, now), 0);
throws(function () { X.exchange(st, { holder: B.serial, issuer: A.serial, kind: 'battle', n: 1 }, now); }, '今天只剩 0');
var tomorrow = now + 24 * 3600e6;
assert.strictEqual(X.remainingToday(st, A.serial, tomorrow), 1800);
assert.strictEqual(X.exchange(st, { holder: B.serial, issuer: A.serial, kind: 'battle', n: 1 }, tomorrow).kcal, 100);
// 自己發給自己沒有價值
throws(function () { X.exchange(st, { holder: A.serial, issuer: A.serial, kind: 'idea', n: 1 }, now); }, '沒有價值');

// 可見條件：所有人／融合過的人／只有自己
var st2 = D.fresh(); var a = st2.roles[0], b = st2.roles[1], c = st2.roles[2];
assert.ok(D.canSee(st2, a.serial, b.serial, 'all'));
assert.ok(!D.canSee(st2, a.serial, b.serial, 'fused'), '沒融合過看不到');
assert.ok(!D.canSee(st2, a.serial, b.serial, 'self'));
assert.ok(D.canSee(st2, a.serial, a.serial, 'self'), '自己都看得到');
F.create(st2, [a, b], now);
assert.ok(D.canSee(st2, a.serial, b.serial, 'fused'), '融合過就看得到');
assert.ok(!D.canSee(st2, a.serial, c.serial, 'fused'));
assert.strictEqual(b.problems[0].visible, 'fused', '預設 J2 的難題只給融合過的人看');
assert.ok(D.cleanWorld({ serial: '00000000009', name: 'x', objects: [], problems: [{ id: 'p9', text: 't', visible: 'weird' }] }).problems[0].visible === 'all', '不認得的可見條件當所有人');

// 內部空間：門、巢狀最多 3 層、代號不能重複
var w = JSON.parse(JSON.stringify(D.defaultRoles()[0]));
var hall = w.objects.find(function (o) { return o.id === 'fusion'; });
assert.ok(hall.door && hall.door.objects.length === 1, '融合殿有門，裡面一個物件');
assert.strictEqual(D.findObject(w, 'pillar').name, '殿內石柱');
var cw = D.cleanWorld(w); assert.strictEqual(cw.objects.find(function (o) { return o.id === 'fusion'; }).door.visible, 'all');
hall.door.objects[0].door = { visible: 'self', start: [0, 3], objects: [{ id: 'd3', name: '三', func: 'none', pos: [0, 0], parts: [{ shape: 'box', size: [1, 1, 1], color: '#000000' }] }] };
assert.ok(D.tryClean(w).world, '三層可以');
D.findObject(w, 'd3').door = { visible: 'all', start: [0, 3], objects: [{ id: 'd4', name: '四', func: 'none', pos: [0, 0], parts: [{ shape: 'box', size: [1, 1, 1], color: '#000000' }] }] };
assert.ok(D.tryClean(w).error.indexOf('3 層') >= 0, '第四層擋下');
delete D.findObject(w, 'd3').door;
hall.door.objects[0].door.objects[0].id = 'rule';
assert.ok(D.tryClean(w).error.indexOf('重複') >= 0, '內部物件代號也不能重複');

console.log('exchange.test.js ok');
