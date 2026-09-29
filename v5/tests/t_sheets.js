// 表世界活頁簿：node v5/tests/t_sheets.js <test.html> [截圖資料夾]
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
  pg.on('console', function (m) { if (m.type() === 'error' && m.text().indexOf('ERR_CERT') < 0) errs.push(m.text()); });
  await pg.goto('file://' + path.resolve(page_path));
  await pg.waitForTimeout(600);
  await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.waitForTimeout(600);
  var jsClick = async function (sel) { var ok = await pg.evaluate(function (q) { var el = document.querySelector(q); if (!el) return false; el.click(); return true; }, sel); if (!ok) throw new Error('找不到 ' + sel); await pg.waitForTimeout(150); };
  var sheet = function () { return pg.evaluate("SHEET.ui.sheet"); };
  var main = function () { return pg.textContent('#main'); };
  var tab = async function (k) { await pg.click('#tabs a[data-s="' + k + '"]'); await pg.waitForTimeout(150); };

  // 分頁順序
  var tabs = await pg.evaluate("[...document.querySelectorAll('#tabs a')].map(function(a){return a.textContent.replace(/^[裡ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/,'')})");
  assert(tabs.join('｜') === '裡世界｜下一步｜角色｜難題｜規則｜世界｜走法｜出發點｜融合｜點數｜兌換｜紀錄', '分頁順序：' + tabs.join('｜'));
  await tab('next');
  assert((await sheet()) === 'next' && !(await pg.isHidden('#fxbar')), '表世界打開，名稱方塊列出現');
  var rows = await pg.evaluate("[...document.querySelectorAll('#main tr[data-row]')].map(function(t){return t.querySelector('td[data-c=\"0\"]').textContent})");
  assert(rows.join('') === '① 角色② 難題③ 規則④ 世界⑤ 走法⑥ 出發點', '下一步列出六步：' + rows.join('/'));
  assert((await pg.textContent('#main tr.next')).indexOf('⑥ 出發點') >= 0, '預設世界下一步是出發點');
  await pg.screenshot({ path: OUT + '/s1_next.png' });
  // 每頁最下面的「下一步 →」
  await jsClick('.nextbar [data-act="nextSheet"]');
  assert((await sheet()) === 'depart', '「下一步 →」跳到出發點頁');
  await jsClick('.nextbar [data-act="nextSheet"]');
  assert((await sheet()) === 'fusion', '出發點頁的下一步是融合頁');

  // 名稱方塊：點格子
  await tab('roles');
  await pg.click('#main tr[data-row][data-id="00000000002"] td[data-c="2"]');
  assert((await pg.textContent('#nameBox')) === 'Ⅰ!C2' && (await pg.textContent('#fxVal')) === 'J2', '名稱方塊 Ⅰ!C2，編輯列顯示 J2');
  // 連結跳轉 + 返回
  await jsClick('#main tr[data-row][data-id="00000000002"] [data-act="jump"][data-s="problems"]');
  assert((await sheet()) === 'problems' && (await pg.evaluate("document.querySelector('#main tr.flash')?.dataset.id")) === 'p2', '角色頁的難題連結跳到難題頁 p2 那一列並閃一下');
  await pg.click('#backBtn'); await pg.waitForTimeout(150);
  assert((await sheet()) === 'roles', '返回回到角色頁');

  // 角色：改名、新增角色
  await pg.fill('input[data-ed="roleName"][data-id="00000000001"]', '阿明'); await pg.dispatchEvent('input[data-ed="roleName"][data-id="00000000001"]', 'change'); await pg.waitForTimeout(150);
  assert((await pg.evaluate("APP.me().name")) === '阿明', '改名字');
  await pg.fill('#addRoleName', '新人'); await jsClick('[data-act="addRole"]');
  assert((await pg.evaluate("APP.state().roles.length")) === 4 && (await pg.evaluate("APP.state().roles[3].serial")) === '00000000004', '新增角色 J4');

  // 難題：擱置 → 重創（註明前身）
  await tab('problems');
  await jsClick('[data-act="shelveProblem"][data-id="p1"]');
  assert((await pg.evaluate("APP.me().problems[0].status")) === 'shelved', '擱置了 p1');
  assert((await pg.$('#addProblemText')) !== null, '擱置後可以立新難題');
  await jsClick('[data-act="recreate"][data-id="p1"]');
  assert((await pg.evaluate("document.getElementById('addProblemPrev').value")) === 'p1', '重創按鈕帶入前身');
  await pg.fill('#addProblemText', '還是早起不了'); await jsClick('[data-act="addProblem"]');
  var np = await pg.evaluate("DATA.activeProblem(APP.me())");
  assert(np && np.text === '還是早起不了' && np.prev === 'p1', '立了新難題，前身 p1');
  assert((await main()).indexOf('目前的難題還在進行') >= 0, '進行中不能再立');
  await pg.screenshot({ path: OUT + '/s2_problems.png' });

  // 規則：條目增刪、公開／只有自己、比例、資源，儲存成新版本
  await tab('rules');
  await pg.fill('#addRuleText', '晚上不看手機'); await pg.selectOption('#addRuleVis', 'self'); await jsClick('[data-act="addRule"]');
  await pg.fill('input[data-ed="ratio"][data-id="idea"]', '150'); await pg.dispatchEvent('input[data-ed="ratio"][data-id="idea"]', 'change'); await pg.waitForTimeout(100);
  await pg.fill('#addResName', '借車一天'); await pg.fill('#addResKcal', '500'); await jsClick('[data-act="addRes"]');
  assert((await main()).indexOf('有沒儲存的修改') >= 0, '有草稿標示');
  assert((await pg.evaluate("DATA.currentRules(APP.me()).no")) === 1, '沒儲存前還是第 1 版');
  await jsClick('[data-act="saveRules"]');
  var cur = await pg.evaluate("DATA.currentRules(APP.me())");
  assert(cur.no === 2 && cur.items.length === 2 && cur.items[1].visible === 'self' && cur.ratios.idea === 150 && cur.resources.length === 2, '儲存成第 2 版：' + JSON.stringify(cur.ratios));
  var vtxt = await main();
  assert(vtxt.indexOf('第 2 版') >= 0 && vtxt.indexOf('第 1 版') >= 0, '歷史版本列出兩版');
  await jsClick('[data-act="delRule"][data-id="0"]');
  assert((await main()).indexOf('有沒儲存的修改') >= 0, '刪條目變草稿');
  await jsClick('[data-act="discardDraft"]');
  assert((await pg.evaluate("document.querySelectorAll('input[data-ed=ruleText]').length")) === 2, '放棄修改回到第 2 版');
  // 看別人的規則：只有自己的條目看不到
  await pg.selectOption('select[data-ed="rulesRole"]', '00000000002'); await pg.waitForTimeout(150);
  var rtxt = await main();
  assert(rtxt.indexOf('晚上九點以後') >= 0 && rtxt.indexOf('欠的人情') < 0 && (await pg.$('[data-act="saveRules"]')) === null, '看 J2 的規則：只有自己的那條看不到，也不能儲存');
  await pg.screenshot({ path: OUT + '/s3_rules.png' });

  // 世界：新增地標、刪物件會連走法一起刪
  await tab('world');
  await pg.selectOption('select[data-ed="worldRole"]', '00000000001'); await pg.waitForTimeout(150);
  await pg.fill('#addObjName', '大石頭'); await jsClick('[data-act="addObj"]');
  assert((await pg.evaluate("APP.me().objects.length")) === 7 && (await pg.evaluate("APP.me().objects[6].name")) === '大石頭', '新增地標');
  await jsClick('[data-act="delObj"][data-id="rule"]');
  assert((await pg.evaluate("APP.me().objects.length")) === 6 && (await pg.evaluate("APP.me().walk.circles.length")) === 0, '刪規則屋，繞圈走法一起刪');
  // 世界頁的走法連結
  await jsClick('#main tr[data-row][data-id="00000000001:problem"] [data-act="jump"][data-s="walk"]');
  assert((await sheet()) === 'walk', '世界頁「走法用到」連到走法頁');

  // 走法：加一條繞圈，下一步頁的走法狀態跟著變
  await tab('next');
  assert((await pg.textContent('#main tr.next')).indexOf('⑤ 走法') >= 0 || (await pg.textContent('#main tr.next')).indexOf('④ 世界') >= 0, '刪了規則屋，下一步變成世界或走法');
  await tab('walk');
  await pg.selectOption('#addCircleObj', 'goal'); await jsClick('[data-act="addCircle"]');
  assert((await pg.evaluate("APP.me().walk.circles.length")) === 1, '加了一條繞圈');
  await tab('next');
  var stTxt = await pg.textContent('#main tr[data-row][data-id="walk"]');
  assert(stTxt.indexOf('繞終點台一圈') >= 0, '下一步頁的走法說明更新：' + stTxt.slice(0, 40));

  // 出發點頁：沒立難題的角色不能設
  await tab('depart');
  await jsClick('[data-act="setDepart"][data-id="00000000004"][data-s="30"]');
  assert((await pg.textContent('#sheetMsg')).indexOf('還沒立難題') >= 0, '沒難題不能寫出發點');
  await jsClick('[data-act="setDepart"][data-id="00000000001"][data-s="90"]');
  assert((await pg.evaluate("APP.me().departUs")) > 0, '設了自己的出發點');
  await tab('next');
  assert((await pg.textContent('#main tr[data-row][data-id="depart"]')).indexOf('完成') >= 0, '下一步頁出發點完成');

  // 重新整理：草稿之外都還在
  await pg.reload(); await pg.waitForTimeout(600);
  assert((await pg.evaluate("APP.state().roles.length")) === 4 && (await pg.evaluate("DATA.currentRules(APP.me()).no")) === 2, '存檔還在');

  assert(errs.length === 0, '沒有錯誤 ' + errs.join(' | '));
  await browser.close();
})().catch(function (e) { console.error(e); process.exit(1); });
