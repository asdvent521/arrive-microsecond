// 門與內部空間、可見條件、市集與兌換：node v5/tests/t_extra.js <test.html> [截圖資料夾]
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
  var walkTo = async function (x, z) { await pg.evaluate("WORLD.walkTo({x:" + x + ", z:" + z + "})"); await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 10000 }); await pg.waitForTimeout(200); };
  var near = function () { return pg.textContent('#hudNearBody'); };

  // ---- 內部空間：自己的融合殿有門（所有人）----
  await walkTo(6, 2.6);
  assert((await pg.textContent('#hudNearTitle')).indexOf('融合') >= 0, '靠近融合殿');
  assert((await near()).indexOf('有一扇門') >= 0 && !(await pg.isHidden('#btnEnter')), '看得到門，有進門按鈕');
  await pg.click('#btnEnter'); await pg.waitForTimeout(300);
  assert((await pg.evaluate("WORLD.depth()")) === 1 && (await pg.textContent('#hudWhere')).indexOf('內部第 1 層') >= 0, '進門：內部第 1 層');
  var labels = await pg.evaluate("[...document.querySelectorAll('.label')].map(l=>l.textContent)");
  assert(labels.length === 1 && labels[0] === '殿內石柱', '內部只畫裡面的物件：' + labels.join('/'));
  await pg.screenshot({ path: OUT + '/x1_inside.png' });
  await walkTo(0, -0.5);
  assert((await pg.textContent('#hudNearTitle')).indexOf('殿內石柱') >= 0, '內部的物件也會靠近顯示');
  assert(!(await pg.isHidden('#btnLeave')), '有出門按鈕');
  await pg.click('#btnLeave'); await pg.waitForTimeout(300);
  assert((await pg.evaluate("WORLD.depth()")) === 0 && (await pg.evaluate("[...document.querySelectorAll('.label')].length")) === 6, '出門回到外部');

  // 內部也能走代號：把繞圈走法設在殿內石柱，進去繞一圈 → J
  await pg.evaluate("(function(){ APP.me().walk.circles = [{ object: 'pillar', letter: 'J' }]; APP.walkChanged(); })()");
  await pg.click('#btnEnter'); await pg.waitForTimeout(300);
  await walkTo(0, -0.5);
  assert(!(await pg.isHidden('#btnCircle')), '內部的物件有繞一圈按鈕');
  await pg.click('#btnCircle');
  await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 15000 });
  await walkTo(0, 8);
  await pg.waitForFunction("APP.dec().letter === 'J'", null, { timeout: 8000 });
  assert(true, '代號藏在房子裡也走得出來');
  await pg.click('#btnLeave'); await pg.waitForTimeout(300);

  // ---- 可見條件：J2 的規則樹門是「融合過的人」、難題是「融合過的人」----
  await pg.evaluate("APP.teleportTo(APP.state().roles[1])"); await pg.waitForTimeout(300);
  await walkTo(-5, 6.5);
  var t1 = await near();
  assert(t1.indexOf('有一扇門，關著') >= 0 && (await pg.isHidden('#btnEnter')), '沒融合過：門關著，沒有進門按鈕');
  await walkTo(2, 7.6);
  assert((await near()).indexOf('沒有開放給你看') >= 0, '沒融合過：看不到 J2 的難題');
  // 規則頁看 J2：只有自己那條看不到；難題頁遮住
  await pg.evaluate("APP.showTab('sheet'); SHEET.navigate('rules', '00000000002:1')"); await pg.waitForTimeout(200);
  var rtxt = await pg.textContent('#main');
  assert(rtxt.indexOf('晚上九點以後') >= 0 && rtxt.indexOf('欠的人情') < 0, '規則頁：J2「只有自己」的條目看不到');
  await pg.evaluate("SHEET.navigate('problems', 'p2')"); await pg.waitForTimeout(200);
  assert((await pg.textContent('#main tr[data-id="p2"]')).indexOf('融合過的人才看得到') >= 0, '難題頁：J2 的難題被遮住');
  // 我把自己的難題設成只有自己，換成 J2 看
  await pg.selectOption('select[data-ed="problemVis"][data-id="p1"]', 'self'); await pg.waitForTimeout(150);
  await pg.evaluate("APP.becomeMe(1)"); await pg.evaluate("APP.showTab('sheet'); SHEET.navigate('problems')"); await pg.waitForTimeout(200);
  assert((await pg.textContent('#main tr[data-id="p1"]')).indexOf('只有自己才看得到') >= 0, 'J2 看不到我設成只有自己的難題');
  await pg.evaluate("APP.becomeMe(0)");
  // 融合過之後就看得到、門也開了
  await pg.evaluate("(function(){ var s=APP.state(); FUSION.create(s, [s.roles[0], s.roles[1]], DATA.nowUs()); APP.save(); })()");
  await pg.evaluate("APP.showTab('world')");
  await pg.evaluate("APP.teleportTo(APP.state().roles[1])"); await pg.waitForTimeout(300);
  await walkTo(2, 7.6);
  assert((await near()).indexOf('晚上總是拖到很晚') >= 0, '融合過：看得到 J2 的難題');
  await walkTo(-5, 6.5);
  assert(!(await pg.isHidden('#btnEnter')), '融合過：規則樹的門開了');
  await pg.click('#btnEnter'); await pg.waitForTimeout(300);
  assert((await pg.evaluate("[...document.querySelectorAll('.label')].map(l=>l.textContent).join()")) === '樹心', '進到 J2 的樹裡');
  await pg.screenshot({ path: OUT + '/x2_tree.png' });
  await pg.evaluate("APP.goHome()"); await pg.waitForTimeout(200);

  // ---- 市集與兌換 ----
  // 先讓 J2 拿到我發的 3 個題點（第 1 版：100 大卡／點）
  await pg.evaluate("(function(){ var s=APP.state(); for (var i=0;i<3;i++) s.points.push({ id:'tp'+i, kind:'idea', from:'00000000001', to:'00000000002', amount:1, atUs:DATA.nowUs()+i, fusion:s.fusions[0].id, stage:'', ruleVersion:'1', sig:null, spent:null }); APP.save(); })()");
  await pg.evaluate("APP.becomeMe(1)"); await pg.waitForTimeout(200);
  await pg.evaluate("APP.teleportTo(APP.state().roles[0])"); await pg.waitForTimeout(300);   // J2 去 J1 的市集
  await walkTo(12, 5.4);
  var mk = await near();
  assert((await pg.textContent('#hudNearTitle')).indexOf('兌換') >= 0 && mk.indexOf('題點 3 點，值 300 大卡') >= 0 && mk.indexOf('陪跑一小時') >= 0, '靠近 J1 的市集：看到能換的：' + mk.replace(/\n/g, ' '));
  assert((await pg.textContent('#btnOpen')) === '打開兌換' && !(await pg.isHidden('#btnOpen')), '有打開兌換按鈕');
  await pg.click('#btnOpen'); await pg.waitForTimeout(200);
  assert((await pg.evaluate("SHEET.ui.sheet")) === 'exchange', '打開兌換頁');
  await pg.screenshot({ path: OUT + '/x3_exchange.png' });
  // 換能量 1 點 → 100 大卡；J1 今天剩 1700
  await pg.fill('#exN_00000000001_idea', '1'); await jsClick('[data-act="exEnergy"][data-id="00000000001"][data-kind="idea"]');
  var ex = await pg.evaluate("APP.state().exchanges");
  assert(ex.length === 1 && ex[0].kcal === 100 && ex[0].want === 'energy', '換了 1 點能量');
  assert((await pg.textContent('#main')).indexOf('1700') >= 0, 'J1 今天剩 1700');
  // 換資源：陪跑一小時 300 大卡，只剩 2 點 200 → 不夠
  await jsClick('[data-act="exResource"][data-id="00000000001"][data-kind="idea"]');
  assert((await pg.textContent('#sheetMsg')).indexOf('點數不夠') >= 0, '資源不夠擋下');
  // 每日上限：把 J1 今天的額度用到剩 100，再換 2 點就擋
  await pg.evaluate("(function(){ var s=APP.state(); s.exchanges.push({ id:'exbig', atUs:DATA.nowUs(), holder:'00000000003', issuer:'00000000001', kind:'battle', pointIds:[], n:0, kcal:1600, want:'energy', resource:null, ruleVersions:['1'] }); APP.save(); SHEET.render(); })()");
  await pg.fill('#exN_00000000001_idea', '2'); await jsClick('[data-act="exEnergy"][data-id="00000000001"][data-kind="idea"]');
  assert((await pg.textContent('#sheetMsg')).indexOf('今天只剩 100') >= 0, '超過每日 1800 擋下');
  assert((await pg.evaluate("APP.state().exchanges.length")) === 2, '沒有多出兌換');
  // 自己的市集：看自己今天還能發出多少
  await pg.evaluate("APP.becomeMe(0)"); await pg.evaluate("APP.showTab('world')"); await pg.waitForTimeout(200);
  await walkTo(12, 5.4);
  assert((await near()).indexOf('我今天還能發出 100 大卡') >= 0, '自己的市集顯示今天剩餘額度');
  // 兌換紀錄連到規則版本
  await pg.evaluate("APP.showTab('sheet'); SHEET.navigate('exchange')"); await pg.waitForTimeout(200);
  await jsClick('#main [data-table="exchanges"] [data-act="jump"][data-s="rules"]');
  assert((await pg.evaluate("SHEET.ui.sheet")) === 'rules' && (await pg.evaluate("SHEET.ui.rulesRole")) === '00000000001', '兌換紀錄的版本連到規則頁');

  // ---- 世界頁：門與內部編輯，第 3 層不能再開門 ----
  await pg.evaluate("SHEET.navigate('world', '00000000001:fusion')"); await pg.waitForTimeout(200);
  await jsClick('[data-act="worldIn"][data-id="fusion"]');
  assert((await pg.evaluate("SHEET.ui.worldPath.join()")) === 'fusion' && (await pg.evaluate("document.querySelector('input[data-ed=objName][data-id=pillar]').value")) === '殿內石柱', '進去編輯融合殿內部');
  await pg.selectOption('select[data-ed="objDoor"][data-id="pillar"]', 'self'); await pg.waitForTimeout(150);
  assert((await pg.evaluate("DATA.findObject(APP.me(),'pillar').door.visible")) === 'self', '第 2 層物件開了門（只有自己）');
  await jsClick('[data-act="worldIn"][data-id="pillar"]');
  await pg.fill('#addObjName', '第三層'); await jsClick('[data-act="addObj"]');
  assert((await pg.evaluate("DATA.findObject(APP.me(),'pillar').door.objects.length")) === 1, '第 3 層可以放物件');
  assert((await pg.textContent('#main')).indexOf('第 3 層不能再開門') >= 0 && (await pg.$('select[data-ed="objDoor"]')) === null, '第 3 層不能再開門');
  await jsClick('[data-act="worldUp"][data-n="0"]');
  assert((await pg.evaluate("SHEET.ui.worldPath.length")) === 0, '麵包屑回外部');
  // 走法頁的物件下拉含內部物件
  await pg.evaluate("SHEET.navigate('walk')"); await pg.waitForTimeout(200);
  assert((await pg.evaluate("[...document.querySelectorAll('#addCircleObj option')].some(function(o){return o.value==='pillar'})")), '走法頁可以選內部物件');
  // 存檔洗過還在
  await pg.reload(); await pg.waitForTimeout(600);
  assert((await pg.evaluate("DATA.findObject(APP.me(),'pillar').door.objects[0].name")) === '第三層' && (await pg.evaluate("APP.state().exchanges.length")) === 2, '門、內部、兌換都存下來');

  assert(errs.length === 0, '沒有錯誤 ' + errs.join(' | '));
  await browser.close();
})().catch(function (e) { console.error(e); process.exit(1); });
