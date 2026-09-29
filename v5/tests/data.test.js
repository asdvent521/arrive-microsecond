// 資料層測試：node v5/tests/data.test.js
var assert = require('assert');
var D = require('../src/data.js');

// 序號縮寫
assert.strictEqual(D.abbrev('00000000001'), 'J1');
assert.strictEqual(D.abbrev('00000000010'), 'I10');
assert.strictEqual(D.abbrev('00000000100'), 'H100');
assert.strictEqual(D.abbrev('01000000000'), 'A1000000000');
assert.strictEqual(D.abbrev('12345678901'), '12345678901');
assert.strictEqual(D.expand('J1'), '00000000001');
assert.strictEqual(D.expand('j2'), '00000000002');
assert.strictEqual(D.expand('I10'), '00000000010');
assert.strictEqual(D.expand('J10'), null);       // J 後面只能一位
assert.strictEqual(D.expand('12345678901'), '12345678901');
assert.strictEqual(D.digitsAfter('J'), 1);
assert.strictEqual(D.digitsAfter('I'), 2);

// 走法解碼：繞規則屋一圈 = J，難題碑走到終點台 = 1
var me = D.defaultRoles()[0];
var dec = new D.Decoder(me.walk);
assert.deepStrictEqual(dec.feed({ type: 'arrive', object: 'goal' }).type, 'ignored');  // 還沒有字母
assert.deepStrictEqual(dec.feed({ type: 'circle', object: 'rule', count: 1 }), { type: 'letter', letter: 'J', need: 1 });
assert.strictEqual(dec.feed({ type: 'arrive', object: 'problem' }).type, 'ignored');
assert.deepStrictEqual(dec.feed({ type: 'arrive', object: 'goal' }), { type: 'done', code: 'J1' });
assert.strictEqual(dec.code(), 'J1');

// 兩圈 = I，要兩位數
dec.reset();
assert.deepStrictEqual(dec.feed({ type: 'circle', object: 'rule', count: 2 }), { type: 'letter', letter: 'I', need: 2 });
dec.feed({ type: 'arrive', object: 'problem' });
assert.deepStrictEqual(dec.feed({ type: 'arrive', object: 'fusion' }), { type: 'digit', digit: '2', need: 1 });
dec.feed({ type: 'arrive', object: 'problem' });
assert.deepStrictEqual(dec.feed({ type: 'arrive', object: 'goal' }), { type: 'done', code: 'I21' });

// 沒有走法的物件不算
dec.reset();
assert.strictEqual(dec.feed({ type: 'circle', object: 'goal', count: 1 }).type, 'ignored');

// 半徑、外觀
assert.ok(D.radiusOf(me.objects[0]) >= 1.5);
assert.ok(D.look('樹', '#0f0').length === 2);
assert.strictEqual(D.findRole({ roles: D.defaultRoles() }, 'J2').name, '阿澄');
assert.strictEqual(D.findRole({ roles: D.defaultRoles() }, 'J9'), null);
assert.ok(/\.\d{6}$/.test(D.fmtUs(1700000000000123)));

console.log('data.test.js ok');

// ---- 第二批：無字母代號、路線說明、純資料檢查 ----
var roles = D.defaultRoles();
var dec2 = new D.Decoder({ circles: [], moves: [
  { from: 'a', to: 'b', digit: '1' }, { from: 'b', to: 'a', digit: '2' }, { from: 'a', to: 'c', digit: '0' }, { from: 'c', to: 'a', digit: '3' } ] });
// 11 位數：1 2 1 2 1 2 1 2 1 2 1 → 12121212121
dec2.feed({ type: 'arrive', object: 'a' });
var last;
for (var i = 0; i < 11; i++) last = dec2.feed({ type: 'arrive', object: i % 2 === 0 ? 'b' : 'a' });
assert.deepStrictEqual(last, { type: 'done', code: '12121212121' });
assert.strictEqual(D.expand('12121212121'), '12121212121');
// 0 不能開頭，但中間可以
dec2.reset(); dec2.feed({ type: 'arrive', object: 'a' });
assert.strictEqual(dec2.feed({ type: 'arrive', object: 'c' }).type, 'ignored');   // a→c 是 0，不能開頭
assert.strictEqual(dec2.feed({ type: 'arrive', object: 'a' }).digit, '3');        // c→a 是 3
assert.strictEqual(dec2.feed({ type: 'arrive', object: 'c' }).digit, '0');        // 中間可以 0
assert.strictEqual(dec2.code(), '30');

// 路線說明
var r1 = D.route(roles[0].walk, roles[0].objects, 'J2');
assert.deepStrictEqual(r1.steps, ['繞規則屋一圈（J）', '走到難題碑', '再走到融合殿（2）']);
assert.deepStrictEqual(D.route(roles[0].walk, roles[0].objects, 'I12').steps, ['繞規則屋 2 圈（I）', '走到難題碑', '再走到終點台（1）', '走到難題碑', '再走到融合殿（2）']);
assert.ok(D.route(roles[0].walk, roles[0].objects, 'J3').missing.indexOf('3') >= 0);
assert.ok(D.route(roles[0].walk, roles[0].objects, 'xx').missing);

// 純資料檢查
var ok = D.tryClean(roles[1]); assert.ok(ok.world && ok.world.objects.length === 6, '預設世界過得了檢查');
var w = JSON.parse(JSON.stringify(roles[1]));
w.objects[0].parts[0].color = 'javascript:alert(1)';
assert.ok(D.tryClean(w).error.indexOf('顏色') >= 0, '顏色格式要對');
w = JSON.parse(JSON.stringify(roles[1])); w.hack = function () {}; w.objects[0].onload = 'x';
var c = D.cleanWorld(w); assert.ok(!('hack' in c) && !('onload' in c.objects[0]), '未知欄位不會抄過來');
w = JSON.parse(JSON.stringify(roles[1])); w.walk.moves[0].to = 'nope';
assert.ok(D.tryClean(w).error.indexOf('不存在') >= 0, '走法不能指到不存在的物件');
w = JSON.parse(JSON.stringify(roles[1])); w.objects[0].parts[0].shape = 'script';
assert.ok(D.tryClean(w).error, '形體種類要認得');
w = JSON.parse(JSON.stringify(roles[1])); w.objects = new Array(100).fill(w.objects[0]);
assert.ok(D.tryClean(w).error.indexOf('太多') >= 0, '功能點有上限');
assert.ok(D.tryClean('not an object').error, '不是物件');
assert.ok(D.tryClean({ serial: '00000000001', name: 'x', objects: [] }).world, '最小世界');

console.log('data.test.js batch 2 ok');
