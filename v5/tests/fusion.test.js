// 融合流程測試：node v5/tests/fusion.test.js
var assert = require('assert');
var D = require('../src/data.js');
global.DATA = D;
var F = require('../src/fusion.js');

function fresh() {
  var st = D.fresh();
  st.fusions = []; st.points = [];
  return st;
}
function throws(fn, part) { var ok = false; try { fn(); } catch (e) { ok = e.message.indexOf(part) >= 0; if (!ok) throw new Error('錯誤訊息不對：' + e.message); } assert.ok(ok, '應該擋下：' + part); }
var now = D.nowUs();
var st = fresh();
var A = st.roles[0], B = st.roles[1], C = st.roles[2];
assert.ok(C, '預設要有第三個角色');

// 相遇建立融合
var f = F.create(st, [A, B], now);
assert.strictEqual(f.members.length, 2);
assert.strictEqual(A.problems[0].status, 'fused');
assert.strictEqual(st.points.length, 0);
assert.strictEqual(F.openFor(st, A.serial), f);
assert.strictEqual(F.openFor(st, C.serial), null);
// 還沒約出發點：不能提階段
throws(function () { F.proposeStage(st, f, A.serial, '太早'); }, '先約下一個出發點');

// 約下一個出發點：全員同意才算；約好後兩人的出發點一樣
F.proposeNext(st, f, A.serial, now + 60e6);
assert.strictEqual(f.nextUs, null);
F.agreeNext(st, f, B.serial);
assert.strictEqual(f.nextUs, now + 60e6);
assert.strictEqual(A.departUs, f.nextUs); assert.strictEqual(B.departUs, f.nextUs);
assert.strictEqual(F.byDepart(st, f.nextUs), f);
throws(function () { F.proposeNext(st, f, C.serial, now + 9e6); }, '參與者');

// 階段：提出 → 同意 → 題點（其他人各發一份給構思者）
var s1 = F.proposeStage(st, f, A.serial, '一起訂白天的開工時間');
assert.strictEqual(s1.status, 'proposed');
assert.strictEqual(st.points.length, 0);
F.agreeStage(st, f, s1.id, B.serial);
assert.strictEqual(s1.status, 'agreed');
assert.strictEqual(st.points.length, 1);
var p = st.points[0];
assert.deepStrictEqual([p.kind, p.from, p.to, p.amount, p.ruleVersion, p.stage, p.fusion, p.sig], ['idea', B.serial, A.serial, 1, '1', s1.id, f.id, null]);
// 發出者改了規則版本，之後的點數記新版本
D.saveRules(B, { items: [{ text: '新規則' }], ratios: { idea: 50, battle: 50 }, resources: [] });
assert.strictEqual(D.currentRules(B).no, 2);
assert.ok(typeof p.atUs === 'number' && p.id);

// 沒有階段判完不能填熱量
throws(function () { F.setCalories(st, f, A.serial, 300); }, '判定完成');

// 認領、交判、判定
F.claimStage(st, f, s1.id, B.serial);
assert.strictEqual(s1.status, 'doing');
throws(function () { F.submitStage(st, f, s1.id, A.serial); }, '執行者');
F.submitStage(st, f, s1.id, B.serial);
F.judge(st, f, s1.id, B.serial, true);
assert.strictEqual(s1.status, 'judging', '一個人判不算');
F.judge(st, f, s1.id, A.serial, false);
assert.strictEqual(s1.status, 'dispute', '有人判未完成就爭議');
// 爭議：全員同意才能改判
F.disputeVote(st, f, s1.id, A.serial, 'back');
assert.strictEqual(s1.status, 'dispute');
F.disputeVote(st, f, s1.id, B.serial, 'done');
assert.strictEqual(s1.status, 'dispute', '意見不一致還是爭議');
F.disputeVote(st, f, s1.id, B.serial, 'back');
assert.strictEqual(s1.status, 'doing', '全員同意退回執行中');
F.submitStage(st, f, s1.id, B.serial);
F.judge(st, f, s1.id, A.serial, true);
F.judge(st, f, s1.id, B.serial, true);
assert.strictEqual(s1.status, 'done');
var battle = st.points.filter(function (x) { return x.kind === 'battle'; });
assert.strictEqual(battle.length, 1);
assert.strictEqual(battle[0].to, B.serial); assert.strictEqual(battle[0].from, A.serial);
assert.strictEqual(battle[0].ruleVersion, '1', 'A 的規則版本還是 1');
assert.deepStrictEqual(F.pointsOf(st, A.serial), { got: { idea: 1, battle: 0 }, gave: { idea: 0, battle: 1 } });

// 熱量：所有階段完成後才能填，全部填完才可處理
var s2 = F.proposeStage(st, f, B.serial, '晚上十一點前關燈');
throws(function () { F.setCalories(st, f, A.serial, 300); }, '判定完成');
F.agreeStage(st, f, s2.id, A.serial);
F.claimStage(st, f, s2.id, A.serial); F.submitStage(st, f, s2.id, A.serial);
F.judge(st, f, s2.id, A.serial, true); F.judge(st, f, s2.id, B.serial, true);
assert.ok(F.allStagesDone(f));
F.setCalories(st, f, A.serial, 300);
assert.strictEqual(f.status, 'open');
F.setCalories(st, f, B.serial, 250);
assert.strictEqual(f.status, 'done', '每個人都填了才可處理');
assert.strictEqual(A.problems[0].status, 'done', '難題標為可處理');

// 期限：已可處理 → 完成
assert.strictEqual(F.deadline(st, f, f.nextUs, []), 'done');

// 第三個人到任一參與者的終點 → 加入
var st2 = fresh(); var a = st2.roles[0], b = st2.roles[1], c = st2.roles[2];
var g = F.create(st2, [a, b], now);
F.proposeNext(st2, g, a.serial, now + 30e6); F.agreeNext(st2, g, b.serial);
assert.strictEqual(F.deadline(st2, g, now + 30e6, [c.serial]), 'joined');
assert.ok(F.isMember(g, c.serial)); assert.strictEqual(c.problems[0].status, 'fused');
assert.strictEqual(g.nextUs, null, '加入後要再約');
// 加入後還沒再約：不能提階段、不能認領
throws(function () { F.proposeStage(st2, g, c.serial, '太早'); }, '先約下一個出發點');
F.proposeNext(st2, g, a.serial, now + 60e6); F.agreeNext(st2, g, b.serial); F.agreeNext(st2, g, c.serial);
// 三個人：階段要三個人同意，題點兩份
var s3 = F.proposeStage(st2, g, c.serial, '三個人一起');
F.agreeStage(st2, g, s3.id, a.serial);
assert.strictEqual(s3.status, 'proposed');
F.agreeStage(st2, g, s3.id, b.serial);
assert.strictEqual(s3.status, 'agreed');
assert.strictEqual(st2.points.filter(function (x) { return x.to === c.serial; }).length, 2);

// 退出：執行中的階段變回沒人負責、已發點數照舊、剩下的人繼續
F.claimStage(st2, g, s3.id, a.serial);
F.exit(st2, g, a.serial);
assert.strictEqual(s3.status, 'agreed'); assert.strictEqual(s3.owner, null);
assert.strictEqual(st2.points.length, 2, '點數不能取消');
assert.deepStrictEqual(F.active(g), [b.serial, c.serial]);
throws(function () { F.claimStage(st2, g, s3.id, a.serial); }, '參與者');
assert.strictEqual(st2.records.slice(-1)[0].kind, 'exit');

// 只有參與者自己站在終點 = 沒人來 → 擱置
var st3 = fresh(); var h = F.create(st3, [st3.roles[0], st3.roles[1]], now);
F.proposeNext(st3, h, st3.roles[0].serial, now + 30e6); F.agreeNext(st3, h, st3.roles[1].serial);
assert.strictEqual(F.deadline(st3, h, now + 30e6, [st3.roles[0].serial]), 'shelved', 'J1 站在自己的終點不算有人來');
assert.strictEqual(h.status, 'shelved');
assert.strictEqual(st3.roles[0].problems[0].status, 'shelved');

// 沒人來 → 融合和原難題一起擱置
F.proposeNext(st2, g, b.serial, now + 90e6); F.agreeNext(st2, g, c.serial);
assert.strictEqual(F.deadline(st2, g, now + 90e6, []), 'shelved');
assert.strictEqual(g.status, 'shelved');
assert.strictEqual(b.problems[0].status, 'shelved'); assert.strictEqual(c.problems[0].status, 'shelved');
assert.strictEqual(a.problems[0].status, 'exited', '退出的另外標');

// 難題：進行中不能再立；擱置後可重創並註明前身
var st4 = fresh(); var r4 = st4.roles[0];
throws(function () { D.addProblem(r4, '第二個'); }, '還在進行');
r4.problems[0].status = 'shelved';
var np = D.addProblem(r4, '重創', r4.problems[0].id);
assert.strictEqual(D.activeProblem(r4), np); assert.strictEqual(np.prev, 'p1');
throws(function () { D.addProblem(r4, ''); }, '內容');
// 規則版本
var v2 = D.saveRules(r4, { items: [{ text: 'a', visible: 'self' }, { text: '  ' }], ratios: { idea: 10, battle: 20 }, resources: [{ name: 'x', kcal: 5 }, { name: '', kcal: 1 }] });
assert.strictEqual(v2.no, 2); assert.strictEqual(v2.items.length, 1); assert.strictEqual(v2.resources.length, 1); assert.deepStrictEqual(r4.rules, v2.items);
throws(function () { D.saveRules(r4, { items: [], ratios: { idea: 0, battle: 1 }, resources: [] }); }, '比例');
var cw = D.cleanWorld(r4); assert.strictEqual(cw.ruleVersions.length, 2); assert.strictEqual(cw.problems[1].prev, 'p1');
var old = D.cleanWorld({ serial: '00000000009', name: '舊', objects: [], rules: [{ text: '舊規則' }] });
assert.strictEqual(old.ruleVersions[0].no, 1, '舊格式當第 1 版'); assert.strictEqual(old.rules[0].text, '舊規則');
assert.ok(b.departDone);

console.log('fusion.test.js ok');
