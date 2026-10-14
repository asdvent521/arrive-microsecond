// 骰子：按下去骰子轉一圈、框裡出現一個還在玩的人的序號、沒跳過去；按「去」才到他的那張紙；骰 12 次不會骰到自己、會換人；達秒屋最上面那一列也是骰子。
// node v9/tests/t_dice.js <test9.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  assert((await H.ev("document.getElementById('diceBtn').getAttribute('aria-label')")) === '隨機骰一個序號' && (await H.ev("document.getElementById('diceBtn').textContent.trim()")) === '' && (await H.ev("!!document.querySelector('#diceBtn svg')")), '骰子是一顆圖，按鈕說明「隨機骰一個序號」');
  await H.ev("window.__rolled=false;new MutationObserver(function(){if(document.getElementById('diceBtn').classList.contains('roll'))window.__rolled=true;}).observe(document.getElementById('diceBtn'),{attributes:true})");
  var code = await H.dice();
  assert(code && /^J\d+$/.test(code) && code !== 'J1' && (await H.ev("!!CORE.findRole(APP.state(),'" + code + "')")) && (await H.ev("window.__rolled")), '按骰子：骰子轉一圈，框裡出現 ' + code + '（還在玩的人）');
  assert((await H.ev("SHEETS.ui.other")) === null && (await H.sheetName()) === 'log' && (await H.msg()).indexOf('按「去」過去看') >= 0, '沒有直接跳過去，提示按「去」');
  var seen = {}, allOk = true;
  for (var i = 0; i < 12; i++) { var c = await H.dice(); var r = await H.ev("(function(){var r=CORE.findRole(APP.state(),'" + c + "');return r?r.serial:null;})()"); if (!r || r === J1) allOk = false; seen[r] = 1; if ((await H.ev("SHEETS.ui.other")) !== null) allOk = false; }
  assert(allOk, '骰 12 次都是還在玩、不是自己的人，都沒有跳過去');
  assert(Object.keys(seen).length >= 2, '骰到好幾個人：' + Object.keys(seen).join(','));
  var last = await H.ev("document.getElementById('serialIn').value");
  await H.click('#serialGo');
  assert((await H.ev("CORE.abbrev(SHEETS.ui.other)")) === last && (await H.sheetName()) === 'other:res', '按「去」才到 ' + last + ' 的那張紙');
  await H.clickText('回我自己', '#tother');
  // 達秒屋最上面那一列：也是骰子，骰進框裡、按「去」才到他的達秒屋外面
  await H.ev("APP.goHouse('" + J1 + "')"); await pg.waitForTimeout(500);
  assert((await H.ev("document.getElementById('hDice').title")) === '隨機骰一個序號' && (await H.ev("!!document.querySelector('#hDice svg')")) && (await H.ev("document.getElementById('hRandom')")) === null, '達秒屋那一列也是骰子，沒有「隨機」兩個字');
  var ok2 = true, seen2 = {};
  for (var k = 0; k < 10; k++) { await H.hclick('#hDice'); await pg.waitForTimeout(100); var v = await H.ev("document.getElementById('hSerialIn').value"); var rr = await H.ev("(function(){var r=CORE.findRole(APP.state(),'" + v + "');return r?r.serial:null;})()"); if (!rr || rr === J1 || (await H.ev("WORLD.info().serial")) !== J1) ok2 = false; seen2[rr] = 1; }
  assert(ok2 && Object.keys(seen2).length >= 2, '達秒屋骰 10 次：序號進框裡、還在自己的達秒屋外面（骰到 ' + Object.keys(seen2).join(',') + '）');
  var v2 = await H.ev("document.getElementById('hSerialIn').value"); await H.hclick('#hSerialGo'); await pg.waitForTimeout(400);
  assert((await H.ev("CORE.abbrev(WORLD.info().serial)")) === v2, '按「去」才到 ' + v2 + ' 的達秒屋外面');
  await H.hclick('#hBack');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
