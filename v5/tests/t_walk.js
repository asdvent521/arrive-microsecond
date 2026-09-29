// 裡世界流程測試：node v5/tests/t_walk.js <test.html 路徑> [截圖資料夾]
// test.html 是 build.sh 用本機 Three.js 組出來的版本（見 v5/tests/README）。
var { chromium } = require('/opt/node22/lib/node_modules/playwright');
var path = require('path');
var page_path = process.argv[2];
var OUT = process.argv[3] || path.join(__dirname, 'shots');
require('fs').mkdirSync(OUT, { recursive: true });

function assert(c, m) { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1; } else console.log('ok: ' + m); }

(async function () {
  var browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  var pg = await browser.newPage({ viewport: { width: 400, height: 780 }, deviceScaleFactor: 2 });
  var errs = [];
  pg.on('pageerror', function (e) { errs.push(String(e)); });
  pg.on('console', function (m) { if (m.type() === 'error' && m.text().indexOf('ERR_CERT') < 0) errs.push(m.text()); });  // 字型在容器裡載不到，不算
  await pg.goto('file://' + path.resolve(page_path));
  await pg.waitForTimeout(800);
  assert(errs.length === 0, '沒有錯誤 ' + errs.join(' | '));
  assert(await pg.evaluate('typeof THREE') === 'object', 'Three.js 載入');
  await pg.screenshot({ path: OUT + '/1_home.png' });

  // 靠近規則屋 → 顯示「這裡是規則」和「繞一圈」按鈕
  await pg.evaluate("WORLD.walkTo({x:-6, z:1})");
  await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 8000 });
  await pg.waitForTimeout(200);
  var near = await pg.textContent('#hudNearTitle');
  assert(near.indexOf('這裡是規則') === 0, '靠近顯示功能：' + near);
  assert(!(await pg.isHidden('#btnCircle')), '有繞一圈按鈕');
  await pg.screenshot({ path: OUT + '/2_near_rule.png' });

  // 繞一圈 → J
  await pg.click('#btnCircle');
  await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 15000 });
  await pg.evaluate("WORLD.walkTo({x:-2, z:6})");             // 離開圈才結算
  await pg.waitForFunction("APP.dec().letter === 'J'", null, { timeout: 8000 });
  assert((await pg.textContent('#hudCode')).indexOf('J') === 0, '走出 J');

  // 難題碑 → 融合殿 = 2 → J2 → 傳送門
  await pg.evaluate("WORLD.walkTo({x:0, z:-4.2})");
  await pg.waitForFunction("APP.dec().lastAt === 'problem'", null, { timeout: 8000 });
  await pg.evaluate("WORLD.walkTo({x:6, z:3.2})");
  await pg.waitForFunction("APP.dec().done === 'J2'", null, { timeout: 8000 });
  await pg.waitForTimeout(300);
  var m = await pg.textContent('#hudMsg');
  assert(m.indexOf('傳送門') >= 0, '傳送門打開：' + m);
  await pg.screenshot({ path: OUT + '/3_portal.png' });

  // 表世界：設阿澄的出發點，並用輸入代號的方式再開一次傳送門
  await pg.click('.tabs a[data-tab=sheet]');
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: OUT + '/4_sheet.png', fullPage: false });
  await pg.click('[data-dep="1"][data-s="30"]');                 // 阿澄的出發點：30 秒後
  await pg.fill('#codeIn', 'J2');
  await pg.click('#codeGo');
  await pg.waitForTimeout(300);
  assert(await pg.isHidden('#view-sheet'), '回到裡世界');
  await pg.evaluate("APP.enterPortal()");
  await pg.waitForTimeout(300);
  var where = await pg.textContent('#hudWhere');
  assert(where.indexOf('阿澄') >= 0, '到了阿澄的世界：' + where);
  await pg.screenshot({ path: OUT + '/5_visit.png' });

  // 沿路經過規則樹看規則，走到終點台，等那一微秒
  await pg.evaluate("WORLD.walkTo({x:-5, z:6.5})");
  await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 8000 });
  await pg.waitForTimeout(200);
  var rule = await pg.textContent('#hudNearBody');
  assert(rule.indexOf('九點') >= 0, '看得到對方的規則：' + rule);
  await pg.evaluate("(function(){APP.state().roles[1].departUs = DATA.nowUs() + 4e6; APP.save();})()");
  await pg.evaluate("WORLD.walkTo({x:7, z:-1})");
  await pg.waitForFunction("WORLD.distanceTo('goal') < 1", null, { timeout: 8000 });
  await pg.waitForTimeout(300);
  var g = await pg.textContent('#hudGoal');
  assert(g.indexOf('你在終點上') >= 0, '站在終點上等：' + g);
  await pg.screenshot({ path: OUT + '/6_wait.png' });
  await pg.waitForSelector('#meet:not([hidden])', { timeout: 8000 });
  var mt = await pg.textContent('#meetText');
  assert(mt.indexOf('相遇') >= 0, '相遇：' + mt);
  await pg.screenshot({ path: OUT + '/7_meet.png' });
  await pg.click('#meetClose');
  await pg.waitForTimeout(200);
  assert((await pg.textContent('#hudWhere')).indexOf('自己的世界') >= 0, '回到自己的世界');
  await pg.click('.tabs a[data-tab=sheet]');
  await pg.waitForTimeout(200);
  assert((await pg.textContent('#records')).indexOf('相遇') >= 0, '紀錄有相遇');

  // 改外觀不影響走法：把規則屋改成樹，再走一次 J
  await pg.selectOption('[data-o="0"][data-k="look"]', '樹');
  await pg.waitForTimeout(200);
  await pg.click('.tabs a[data-tab=world]');
  await pg.evaluate("WORLD.walkTo({x:-6, z:1})");
  await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 8000 });
  await pg.waitForTimeout(200);
  await pg.click('#btnCircle');
  await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 15000 });
  await pg.evaluate("WORLD.walkTo({x:-2, z:6})");
  await pg.waitForFunction("APP.dec().letter === 'J'", null, { timeout: 8000 });
  assert(true, '外觀改成樹之後代號照樣有效');
  await pg.screenshot({ path: OUT + '/8_tree.png' });

  assert(errs.length === 0, '整段沒有錯誤 ' + errs.join(' | '));
  await browser.close();
})().catch(function (e) { console.error(e); process.exit(1); });
