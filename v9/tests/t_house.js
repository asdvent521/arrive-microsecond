// 達秒屋：780×360、360×780 都打得開；磚數對；拖著轉、兩指縮放、滾輪縮放真的有變；點磚跳出那天；點門到他的表格世界；序號框和隨機（不會跳到自己）；
// 3D 用不了時顯示日曆；三年份一個畫面的繪製次數不超過 50；成交那一刻開著達秒屋：白光，今天那塊磚亮起來。
// node v9/tests/t_house.js <test9.html> [截圖資料夾]
var lib = require('./lib'), assert = lib.assert, path = require('path'), fs = require('fs');
var OUT = process.argv[3] || path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003';
var BULK = fs.readFileSync(path.join(__dirname, 'bulk.js'), 'utf8'); BULK = BULK.slice(BULK.indexOf('function bulk'), BULK.indexOf('if (typeof module'));
// 找一塊看得到、點得到的磚：畫面上那一點打到的就是那一天
var FIND = "(function(kind){var v=HOUSE.data(),list=v.bricks.filter(function(b){return !b.future&&(kind==='lit'?b.lit:kind==='cover'?b.cover:true);});for(var i=list.length-1;i>=0;i--){var s=WORLD.screenOf({day:list[i].day});if(!s||s.y<60||s.y>innerHeight-60||s.x<10||s.x>innerWidth-10)continue;var h=WORLD.hitAt(s.x,s.y);if(h&&h.kind==='brick'&&h.day===list[i].day&&document.elementFromPoint(s.x,s.y).tagName==='CANVAS')return list[i].day;}return null;})";
(async function () {
  var H = await lib.open(process.argv[2], { touch: true }), pg = H.pg;
  await H.fresh({ history: true });
  // 1. 從「我的／我的達秒屋」進去
  await H.nav('house'); await H.clickText('去我的達秒屋', '#tmain'); await pg.waitForTimeout(700);
  assert(!(await H.ev("document.getElementById('view-house').hidden")) && (await H.ev("!!document.querySelector('#hstage canvas')")), '從「我的達秒屋」進到自己的達秒屋外面，整個畫面就是達秒屋');
  assert((await pg.textContent('#hwho')).indexOf('J1 我 的達秒屋') >= 0 && (await pg.textContent('#hwho')).indexOf('0 歲 0 天') >= 0, '最上面寫誰的達秒屋、幾歲幾天');
  assert((await H.ev("WORLD.info().bricks")) === (await H.ev("HOUSE.data().bricks.length")), '磚數對：' + (await H.ev("WORLD.info().bricks")));
  // 2. 序號框：到阿澄的達秒屋外面
  await H.houseSerial('J2');
  var v2 = await H.ev("JSON.stringify({b:WORLD.info().bricks,n:CORE.viewHouse(APP.state(),'" + J2 + "','" + J1 + "').bricks.length,s:WORLD.info().serial,calls:WORLD.info().calls})"); v2 = JSON.parse(v2);
  assert(v2.s === J2 && v2.b === v2.n && v2.n > 400, '序號框輸入 J2：到阿澄的達秒屋外面，磚數對（' + v2.b + ' 塊）');
  assert((await H.ev("WORLD.info().lit")) > 10 && (await H.ev("WORLD.info().cover")) > 0 && (await H.ev("WORLD.info().marks")) > 0, '亮的磚、蓋布、小記號都有');
  await pg.screenshot({ path: OUT + '/v9_house_1_j2.png' });
  // 3. 一指拖著轉；滾輪縮放；兩指縮放
  var c0 = await H.ev("WORLD.info()");
  var p = await H.ev("(function(){var r=document.querySelector('#hstage canvas').getBoundingClientRect();var x=r.left+r.width*0.15,y=r.top+r.height*0.55;return {x:x,y:y,canvas:document.elementFromPoint(x,y).tagName};})()");
  assert(p.canvas === 'CANVAS', '拖的地方是畫布');
  await pg.mouse.move(p.x, p.y); await pg.mouse.down(); await pg.mouse.move(p.x + 60, p.y + 10, { steps: 6 }); await pg.mouse.move(p.x + 140, p.y + 20, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(200);
  var c1 = await H.ev("WORLD.info()"); assert(Math.abs(c1.theta - c0.theta) > 0.3, '一指（滑鼠）拖著轉：角度 ' + c0.theta.toFixed(2) + ' → ' + c1.theta.toFixed(2));
  await pg.mouse.move(p.x, p.y); await pg.mouse.wheel(0, 400); await pg.waitForTimeout(200);
  var c2 = await H.ev("WORLD.info()"); assert(c2.dist > c1.dist * 1.2, '滾輪縮放：距離 ' + c1.dist.toFixed(1) + ' → ' + c2.dist.toFixed(1));
  var cdp = await pg.context().newCDPSession(pg);
  var tp = function (pts) { return pts.map(function (q, i) { return { x: q[0], y: q[1], id: i + 1 }; }); };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp([[p.x + 100, 200], [p.x + 140, 200]]) });
  for (var k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp([[p.x + 100 - k * 15, 200], [p.x + 140 + k * 15, 200]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await pg.waitForTimeout(200);
  var c3 = await H.ev("WORLD.info()"); assert(c3.dist < c2.dist * 0.7, '兩指張開放大：距離 ' + c2.dist.toFixed(1) + ' → ' + c3.dist.toFixed(1));
  // 4. 點一塊亮的磚：跳出那天的明細
  await H.ev("HOUSE.render({resetCamera:true})"); await pg.waitForTimeout(300);
  var day = await H.ev(FIND + "('lit')"); assert(day != null, '畫面上找得到一塊亮的磚');
  await H.tap3d({ day: day }, '亮的磚');
  assert((await H.popOpen()) && (await H.popTitle()).indexOf(await H.ev("CORE.dayLabel(" + day + ")")) >= 0 && (await H.popBody()).indexOf('成交') >= 0, '點一塊磚：跳出那天的明細（' + (await H.popTitle()) + '）');
  assert((await H.popBody()).indexOf('那天生效的規則表和資源表') >= 0, '明細有那天生效的規則表和資源表'); await H.popOk();
  var cday = await H.ev(FIND + "('cover')");
  if (cday != null) { await H.tap3d({ day: cday }, '蓋布的磚'); assert((await H.popBody()).indexOf('筆蓋著') >= 0, '點蓋布的磚：寫還有幾筆蓋著'); await H.popOk(); }
  // 5. 點門：到他的表格世界
  await H.tap3d('door', '門'); await pg.waitForTimeout(300);
  assert((await H.ev("document.getElementById('view-house').hidden")) && (await H.sheetName()) === 'other:role' && (await pg.textContent('#tother')).indexOf('J2 阿澄') >= 0, '點門：到阿澄的表格世界');
  // 他的表格世界最上面有「看他的達秒屋」
  await H.clickText('看他的達秒屋', '#tother'); await pg.waitForTimeout(400);
  assert(!(await H.ev("document.getElementById('view-house').hidden")) && (await H.ev("WORLD.info().serial")) === J2, '他的表格世界最上面「看他的達秒屋」');
  // 6. 隨機：跳到一間還在玩、不是自己的達秒屋；回我的表格世界
  var ok6 = true; for (var i = 0; i < 10; i++) { await H.hclick('#hRandom'); await pg.waitForTimeout(150); var w = await H.ev("WORLD.info().serial"); if (!w || w === J1) ok6 = false; }
  assert(ok6, '按「隨機」10 次，都跳到不是自己的達秒屋');
  await H.hclick('#hBack'); assert((await H.ev("document.getElementById('view-house').hidden")) && (await H.ev("TABLE.ui.other")) === null, '「回我的表格世界」');
  // 7. 成交那一刻開著自己的達秒屋：白光一閃，今天那塊磚亮起來
  await H.nav('house'); await H.clickText('去我的達秒屋', '#tmain'); await pg.waitForTimeout(400);
  var litBefore = await H.ev("WORLD.info().lit");
  var sid = await H.ev("(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+3e6,1,null,t);CORE.book(S,'" + J1 + "',s.id,t);CORE.setWants(S,s.id,'" + J1 + "','" + J2 + "',['r2b']);CORE.setWants(S,s.id,'" + J2 + "','" + J1 + "',['r1b']);APP.changed();return s.id;})()");
  assert((await H.ev("WORLD.info().future + WORLD.info().bricks")) >= 1, '約好了：今天有一筆預約');
  await H.ev("window.__flashed=false;new MutationObserver(function(){if(document.getElementById('flash').classList.contains('go'))window.__flashed=true;}).observe(document.getElementById('flash'),{attributes:true})");
  await pg.waitForFunction("CORE.slotOf(APP.state(),'" + sid + "').slot.judged", null, { timeout: 15000 }); await pg.waitForTimeout(500);
  assert((await H.ev("window.__flashed")) && (await H.ev("WORLD.info().lit")) === litBefore + 1 && (await H.ev("HOUSE.data().bricks.slice(-1)[0].lit")) === 1, '成交那一刻：白光一閃，今天那塊磚亮起來');
  await pg.screenshot({ path: OUT + '/v9_house_2_lit.png' }); if (await H.popOpen()) await H.popOk();
  // 8. 360×780 直放也打得開
  await pg.setViewportSize({ width: 360, height: 780 }); await pg.waitForTimeout(300); await H.houseSerial('J3');
  assert((await H.ev("WORLD.info().serial")) === J3 && (await H.ev("WORLD.info().bricks")) === (await H.ev("HOUSE.data().bricks.length")), '360×780 打得開小樂的達秒屋，磚數對');
  var door = await H.ev("(function(){var s=WORLD.screenOf('door');return s&&s.x>0&&s.x<innerWidth&&s.y>40&&s.y<innerHeight;})()"); assert(door, '一打開整間屋都在畫面裡，門看得到');
  await pg.screenshot({ path: OUT + '/v9_house_3_portrait.png' });
  await pg.setViewportSize({ width: 780, height: 360 }); await pg.waitForTimeout(200);
  // 9. 三年份（1100 個時段、3300 筆對接）：打得開，一個畫面的繪製次數不超過 50
  await H.ev("(function(){var bulk=" + BULK + ";window.__B=bulk(CORE,APP.state());})()");
  var shapes = ['tower', 'long', 'flat', 'round'], callsOk = true, msgs = [];
  for (var sh of shapes) { await H.ev("CORE.setHouse(APP.state(),window.__B.X,{shape:'" + sh + "'});APP.goHouse(window.__B.X);HOUSE.render({resetCamera:true})"); await pg.waitForTimeout(500); await H.ev("WORLD.renderNow()"); var inf = await H.ev("WORLD.info()"); msgs.push(sh + ' ' + inf.calls + ' 次／' + inf.bricks + ' 塊'); if (!(inf.calls <= 50 && inf.bricks === 1102)) callsOk = false; }
  assert(callsOk, '三年份四種屋型都打得開，繪製次數不超過 50：' + msgs.join('、'));
  await pg.screenshot({ path: OUT + '/v9_house_4_3years.png' });
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close();
  // 10. 3D 用不了：達秒屋改顯示成日曆，點一格跟點一塊磚一樣
  var N = await lib.open(process.argv[2], { noWebGL: true }), np = N.pg;
  await N.fresh({ history: true });
  assert((await N.ev("WORLD.available")) === false, '擋掉 WebGL：3D 用不了');
  await N.ev("APP.goHouse('" + J2 + "')"); await np.waitForTimeout(300);
  assert(!(await N.ev("document.getElementById('hcal').hidden")) && (await N.ev("document.querySelectorAll('#hcal .cal .cd[data-day]').length")) >= 28, '達秒屋顯示成日曆（一格一天）');
  var cell = await N.ev("(function(){var b=[...document.querySelectorAll('#hcal .cd[data-day]')].find(function(x){return !x.disabled&&/lit/.test(x.className);});return b?b.dataset.day:null;})()");
  if (cell == null) { await N.hclick('#hcal [data-cal="-1"]'); cell = await N.ev("(function(){var b=[...document.querySelectorAll('#hcal .cd[data-day]')].find(function(x){return !x.disabled&&/lit/.test(x.className);});return b?b.dataset.day:null;})()"); }
  await N.hclick('#hcal .cd[data-day="' + cell + '"]');
  assert((await N.popOpen()) && (await N.popBody()).indexOf('成交') >= 0, '點日曆的一格跟點一塊磚一樣：跳出那天的明細');
  assert(N.errs.length === 0, '3D 用不了也沒有頁面錯誤' + (N.errs.length ? '：' + N.errs.join(' | ') : ''));
  await N.close();
  console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
