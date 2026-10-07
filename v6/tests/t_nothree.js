// 引擎沒載入時：node v6/tests/t_nothree.js <test6_nothree.html>（用 NO_THREE=1 組出來的頁面）
var { chromium } = require('/opt/node22/lib/node_modules/playwright');
var path = require('path');
function assert(c, m) { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1; } else console.log('ok: ' + m); }
(async function () {
  var browser = await chromium.launch();
  var pg = await browser.newPage({ viewport: { width: 400, height: 780 } });
  var errs = [];
  pg.on('pageerror', function (e) { errs.push(String(e)); });
  pg.on('console', function (m) { if (m.type() === 'error' && m.text().indexOf('ERR_CERT') < 0 && m.text().indexOf('ERR_FAILED') < 0) errs.push(m.text()); });   // 擋掉的字型請求不算
  // 連外部的腳本也一律擋掉，模擬手機載不到 CDN
  await pg.route(/^https?:\/\//, function (r) { r.abort(); });
  await pg.goto('file://' + path.resolve(process.argv[2]));
  await pg.waitForTimeout(600);
  assert((await pg.evaluate('typeof THREE')) === 'undefined', '這頁沒有 Three.js');
  assert(errs.length === 0, '沒有錯誤 ' + errs.join(' | '));
  assert((await pg.evaluate('WORLD.available')) === false, 'WORLD 是替身');
  assert((await pg.textContent('#hudMsg')).indexOf('3D 引擎沒載入') >= 0 && (await pg.textContent('#stage')).indexOf('3D 引擎沒載入') >= 0, '顯示引擎沒載入的提示');
  var tabs = await pg.evaluate("[...document.querySelectorAll('#tabs a')].map(function(a){return a.textContent.replace(/^[裡ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/,'')})");
  assert(tabs.join('｜') === '裡世界｜下一步｜查詢｜角色｜規則｜資源｜世界｜走法｜對接時段｜對接紀錄｜點數｜兌現', '分頁列正常：' + tabs.join('｜'));
  var keys = ['next', 'query', 'roles', 'rules', 'resources', 'world', 'walk', 'slots', 'dockings', 'points', 'redeem'];
  for (var i = 0; i < keys.length; i++) {
    await pg.click('#tabs a[data-s="' + keys[i] + '"]'); await pg.waitForTimeout(120);
    var n = await pg.evaluate("document.querySelectorAll('#main table.ws').length");
    assert(n >= 1 && (await pg.evaluate("SHEET.ui.sheet")) === keys[i], '表世界 ' + keys[i] + ' 頁正常（' + n + ' 張表）');
  }
  // 表世界的操作照常：開時段、預約、換角色、世界頁改資料
  await pg.click('#tabs a[data-s="slots"]'); await pg.waitForTimeout(120);
  await pg.fill('#addSlotMin', '5'); await pg.evaluate("document.querySelector('[data-act=addSlot]').click()"); await pg.waitForTimeout(150);
  assert((await pg.evaluate("APP.me().slots.length")) === 2, '開時段照常');
  await pg.evaluate("document.querySelector('[data-act=book]').click()"); await pg.waitForTimeout(150);
  assert((await pg.evaluate("APP.state().roles[1].slots[0].bookings.length")) === 1, '預約照常');
  await pg.click('#tabs a[data-s="roles"]'); await pg.waitForTimeout(120);
  await pg.check('input[name=meIs][data-id="00000000002"]'); await pg.waitForTimeout(200);
  assert((await pg.evaluate("APP.me().serial")) === '00000000002', '換角色照常（不會因為沒有 3D 而出錯）');
  await pg.click('#tabs a[data-s="world"]'); await pg.waitForTimeout(120);
  await pg.selectOption('select[data-ed="objLook"][data-id="rule_00000000002"]', '樹'); await pg.waitForTimeout(150);
  assert((await pg.evaluate("APP.me().world.objects[0].look")) === '樹', '世界頁改外觀照常');
  await pg.click('#tabs a[data-act="world"]'); await pg.waitForTimeout(150);
  assert(!(await pg.isHidden('#hudMsg')) && (await pg.textContent('#hudMsg')).indexOf('3D 引擎沒載入') >= 0, '回裡世界仍是提示，不是空白');
  assert(errs.length === 0, '整段沒有錯誤 ' + errs.join(' | '));
  await browser.close();
})().catch(function (e) { console.error(e); process.exit(1); });
