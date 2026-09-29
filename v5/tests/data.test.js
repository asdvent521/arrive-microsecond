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
