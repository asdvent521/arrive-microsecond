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

  // 表世界：出發點頁設阿澄的出發點，走法頁輸入代號再開一次傳送門
  await pg.click('#tabs a[data-s="depart"]');
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: OUT + '/4_sheet.png', fullPage: false });
  await pg.click('[data-act="setDepart"][data-id="00000000002"][data-s="30"]');   // 阿澄的出發點：30 秒後
  await pg.waitForTimeout(150);
  await pg.click('#tabs a[data-s="walk"]'); await pg.waitForTimeout(150);
  await pg.fill('#codeIn', 'J2');
  await pg.click('[data-act="portalIn"]');
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
  await pg.evaluate("(function(){APP.state().roles[1].departUs = DATA.nowUs() + 6e6; APP.save();})()");
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
  await pg.click('#tabs a[data-s="records"]');
  await pg.waitForTimeout(200);
  assert((await pg.textContent('#main')).indexOf('相遇') >= 0, '紀錄頁有相遇');

  // 改外觀不影響走法：世界頁把規則屋改成樹，再走一次 J
  await pg.click('#tabs a[data-s="world"]'); await pg.waitForTimeout(150);
  await pg.selectOption('select[data-ed="objLook"][data-id="rule"]', '樹');
  await pg.waitForTimeout(200);
  await pg.click('#tabs a[data-act="world"]');
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

  // ---- 第二批 ----
  await pg.click('#tabs a[data-act="world"]');
  await pg.evaluate("APP.dec().reset(); WORLD.hidePortal()");
  // 標籤：每個功能點頭上有名字
  var labels = await pg.evaluate("[...document.querySelectorAll('.label')].map(l=>l.textContent)");
  assert(labels.indexOf('難題碑') >= 0 && labels.length === 6, '名稱標籤：' + labels.join('/'));
  // 路線教學
  var route = await pg.textContent('#hudRouteText');
  assert(route.indexOf('要去 J2：繞') === 0 && route.indexOf('走到難題碑') > 0 && route.indexOf('融合殿') > 0, '路線教學：' + route);

  // 單指拖曳轉鏡頭
  var yaw0 = await pg.evaluate("WORLD.camera.yaw");
  await pg.evaluate(`(function(){
    var c=document.querySelector('#stage canvas');
    function ev(t,id,x,y){ c.dispatchEvent(new PointerEvent(t,{pointerId:id,clientX:x,clientY:y,bubbles:true,pointerType:'touch'})); }
    ev('pointerdown',1,200,500); ev('pointermove',1,240,500); ev('pointermove',1,300,500); ev('pointerup',1,300,500);
  })()`);
  await pg.waitForTimeout(100);
  var yaw1 = await pg.evaluate("WORLD.camera.yaw");
  assert(Math.abs(yaw1 - yaw0) > 0.3, '拖曳轉鏡頭 ' + yaw0.toFixed(2) + '→' + yaw1.toFixed(2));
  assert(!(await pg.evaluate("WORLD.isMoving()")), '拖曳不算點地面');
  // 兩指縮放（用 PointerEvent 模擬兩根手指）
  var d0 = await pg.evaluate("WORLD.camera.dist");
  await pg.evaluate(`(function(){
    var c=document.querySelector('#stage canvas');
    function ev(t,id,x,y){ c.dispatchEvent(new PointerEvent(t,{pointerId:id,clientX:x,clientY:y,bubbles:true,pointerType:'touch'})); }
    ev('pointerdown',1,150,400); ev('pointerdown',2,250,400);
    ev('pointermove',1,100,400); ev('pointermove',2,300,400);
    ev('pointerup',1,100,400); ev('pointerup',2,300,400);
  })()`);
  var d1 = await pg.evaluate("WORLD.camera.dist");
  assert(d1 < d0 - 3, '兩指張開拉近 ' + d0.toFixed(1) + '→' + d1.toFixed(1));
  await pg.evaluate("WORLD.zoomTo(36); WORLD.camera.yaw = 0");

  // 走路繞開物件：從難題碑的一邊走到另一邊，路上不能進到碑裡
  await pg.evaluate("WORLD.walkTo({x:0, z:-9.5})");
  await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 8000 });
  var hit = await pg.evaluate(`new Promise(function(res){ var n=0,bad=0; WORLD.walkTo({x:0, z:-2.5}); var h=setInterval(function(){ n++; if (WORLD.insideAny()) bad++; if(!WORLD.isMoving()||n>400){clearInterval(h);res({bad:bad,n:n,pos:WORLD.playerPos()});} },16); })`);
  assert(hit.bad === 0 && Math.abs(hit.pos.z + 2.5) < 0.5, '穿不過難題碑：進去 ' + hit.bad + ' 次，到 ' + JSON.stringify(hit.pos));
  await pg.screenshot({ path: OUT + '/9_labels.png' });

  // 髒資料不載入
  var dirty = await pg.evaluate(`(function(){ var r = JSON.parse(JSON.stringify(APP.state().roles[1])); r.objects[0].parts[0].color='url(x)'; APP.teleportTo(r); return document.getElementById('hudMsg').textContent + '|' + document.getElementById('hudWhere').textContent; })()`);
  assert(dirty.indexOf('不是純資料') >= 0 && dirty.indexOf('自己的世界') >= 0, '髒資料不載入：' + dirty);

  // 自己的出發點到了沒人來 → 擱置、紀錄
  await pg.evaluate("(function(){ var m=APP.me(); m.departUs = DATA.nowUs() + 1.5e6; m.departDone=false; APP.save(); })()");
  await pg.waitForFunction("APP.state().records.some(function(x){ return x.kind==='shelve' && x.text.indexOf('一個人都沒來')>=0; })", null, { timeout: 6000 });
  assert(true, '自己的出發點沒人來就擱置');
  await pg.click('#tabs a[data-s="depart"]');
  await pg.waitForTimeout(200);
  assert((await pg.textContent('#main')).indexOf('已過') >= 0, '出發點頁標了已過');
  await pg.click('#tabs a[data-s="problems"]');
  await pg.waitForTimeout(200);
  assert((await pg.textContent('#main')).indexOf('擱置') >= 0, '難題頁標了擱置');

  // 換角色：角色頁選「我是」J2
  await pg.click('#tabs a[data-s="roles"]'); await pg.waitForTimeout(150);
  await pg.check('input[name=meIs][data-id="00000000002"]');
  await pg.waitForTimeout(300);
  assert((await pg.evaluate("APP.me().serial")) === '00000000002', '我是 J2');
  await pg.click('#tabs a[data-s="walk"]'); await pg.waitForTimeout(150);
  assert((await pg.textContent('#main')).indexOf('小山') >= 0, '走法頁變成 J2 的');
  await pg.click('#tabs a[data-act="world"]');
  await pg.waitForTimeout(200);
  assert((await pg.textContent('#hudWhere')).indexOf('J2') >= 0, '裡世界變成 J2 的');
  var route2 = await pg.textContent('#hudRouteText');
  assert(route2.indexOf('要去 J1：繞小山一圈') === 0, 'J2 的路線教學：' + route2);
  await pg.screenshot({ path: OUT + '/10_as_j2.png' });
  // 重新整理還是 J2
  await pg.reload(); await pg.waitForTimeout(800);
  assert((await pg.textContent('#hudWhere')).indexOf('J2') >= 0, '重新整理後還記得我是 J2');

  // 走法表數字 0 可以設
  await pg.click('#tabs a[data-s="walk"]'); await pg.waitForTimeout(150);
  var zero = await pg.evaluate("document.querySelector('#addMoveDigit option[value=\"0\"]') !== null && [...document.querySelectorAll('select[data-ed=moveDigit] option[value=\"0\"]')].length > 0");
  assert(zero, '走法表有數字 0');

  assert(errs.length === 0, '第二批沒有錯誤 ' + errs.join(' | '));
  await browser.close();
})().catch(function (e) { console.error(e); process.exit(1); });
