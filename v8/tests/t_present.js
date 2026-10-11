// 到場是事先確認（DESIGN 補五）：表世界勾到場重新整理還在；關掉頁面那一微秒過了再打開看得到「你不在的時候」、點數多一筆；裡世界時刻表按確認到場不站終點台也成交；沒確認沒站著就錯過；待辦提醒。
// node v8/tests/t_present.js <test8.html>
var lib = require('./lib'), assert = lib.assert, path = require('path');
var J1 = '00000000001', J2 = '00000000002';
var SLOT = function (sec, wants, res) { return "(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+" + sec + "e6,1,null,t);CORE.book(S,'" + J1 + "',s.id,t);" + (wants ? "CORE.setWants(S,s.id,'" + J1 + "','" + J2 + "',['" + (res || 'r2a') + "']);CORE.setWants(S,s.id,'" + J2 + "','" + J1 + "',['r1b']);" : '') + "APP.changed();return s.id;})()"; };
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  // 1. 待辦提醒：預約了還沒確認到場
  var s1 = await H.ev(SLOT(120, true));
  assert((await pg.textContent('#task')).indexOf('還沒確認到場：沒確認就算錯過') >= 0, '任務提示：還沒確認到場');
  // 2. 表世界勾到場 → 重新整理 → 還勾著（存進存檔）
  await H.toSheet(); await H.sheet('todo'); assert((await H.main()).indexOf('還沒確認到場') >= 0, '待辦也提醒');
  await H.sheet('booked'); assert((await H.main()).indexOf('勾了就算，不用守著') >= 0, '「到場」旁寫勾了就算，不用守著');
  await H.edit('input[data-ed="present"][data-id="' + s1 + '"]', null, true);
  assert((await H.ev("CORE.isPresent(APP.state(),'" + J1 + "','" + s1 + "')")) === true && (await H.ev("APP.steps().hint")).indexOf('還沒確認到場') < 0, '勾了就是確認，提醒消失');
  await pg.reload(); await pg.waitForTimeout(900); await H.toSheet(); await H.sheet('booked');
  assert((await H.ev("document.querySelector('input[data-ed=\"present\"][data-id=\"" + s1 + "\"]').checked")) === true, '重新整理後還勾著');
  // 3. 勾到場後關掉頁面，那一微秒過了再打開：補判，看得到「你不在的時候」，點數多一筆
  var s2 = await H.ev(SLOT(4, true)); await H.edit('input[data-ed="present"][data-id="' + s2 + '"]', null, true);
  await pg.goto('about:blank'); await pg.waitForTimeout(6000);
  await pg.goto('file://' + path.resolve(process.argv[2])); await pg.waitForTimeout(1200);
  assert((await H.dlgTitle()) === '你不在的時候' && (await H.dlgBody()).indexOf('我拿出：早餐一頓（100 點）；拿到：阿澄的改履歷（100 點）') >= 0, '再打開：裡世界對話框列出你不在的時候的結果：' + (await H.dlgBody()));
  await H.pick('好');
  var dk = await H.ev("JSON.stringify(APP.state().dockings.filter(function(d){return d.slot==='" + s2 + "';}).map(function(d){return [d.traded, Math.round((d.atUs-CORE.slotOf(APP.state(),'" + s2 + "').slot.atUs)/1e6)];}))");
  assert(dk === '[[true,0]]', '補判照那個時段的那一微秒成交：' + dk);
  await H.toSheet(); await H.sheet('points'); assert((await H.rows()) === 1 && (await H.main()).indexOf('改履歷') >= 0, '「點數」多了那一筆');
  // 表世界也看得到你不在的時候：換個方式——在表世界關掉再開
  var s3 = await H.ev(SLOT(4, true)); await H.sheet('booked'); await H.edit('input[data-ed="present"][data-id="' + s3 + '"]', null, true);
  await pg.goto('about:blank'); await pg.waitForTimeout(6000);
  await pg.goto('file://' + path.resolve(process.argv[2])); await pg.waitForTimeout(1200); await H.pick('好'); await H.toSheet();
  await H.sheet('records'); assert((await H.main()).indexOf('互換') >= 0, '紀錄裡有補判的成交');
  // 4. 裡世界：時刻表按確認到場，回自己的世界不站在終點台上 → 照樣成交
  await H.toGame(); await H.ev("GAME.dialog(null)");
  await H.ev("(function(){var S=APP.state();CORE.cancelBooking(S,'" + J1 + "','" + s1 + "');APP.changed();})()");   // 自動確認只看最近的那一個：先把前面那個預約取消掉
  var s4 = await H.ev(SLOT(120, true));
  await H.ev("GAME.teleportTo(CORE.roleOf(APP.state(),'" + J2 + "'))"); await H.goNear('goal');
  assert((await pg.textContent('#toast')).indexOf('已自動確認到場') === 0 && (await H.ev("CORE.isPresent(APP.state(),'" + J1 + "','" + s4 + "')")) === true, '站上終點台就自動確認到場，提示一句：' + (await pg.textContent('#toast')));
  await H.pick('時刻表');
  assert((await H.opts()).some(function (o) { return o.indexOf('已確認到場') > 0; }) && (await H.opts()).some(function (o) { return o.indexOf('取消到場') === 0; }), '時刻表標已確認、可以取消');
  await H.pick('取消到場'); await pg.waitForTimeout(300);
  assert((await H.opts()).some(function (o) { return o.indexOf('還沒確認到場') > 0; }) && (await H.ev("CORE.isPresent(APP.state(),'" + J1 + "','" + s4 + "')")) === false, '站著按取消：取消了、一直站著也不會又被確認');
  await H.pick('確認到場');
  assert((await H.opts()).some(function (o) { return o.indexOf('已確認到場') > 0; }), '自己再按確認就恢復');
  await H.ev("GAME.dialog(null)"); await pg.click('#btnHome'); await pg.waitForTimeout(300);
  await H.ev("(function(){var S=APP.state(),x=CORE.slotOf(S,'" + s4 + "');x.slot.atUs=APP.now()+3e6;APP.changed();})()");
  await pg.waitForFunction("document.getElementById('dlgTitle').textContent === '到達那微秒'", null, { timeout: 20000 });
  assert((await H.ev("CORE.slotOf(APP.state(),'" + s4 + "').slot.docked.indexOf('" + J1 + "')")) >= 0 && (await H.dlgBody()).indexOf('拿到：阿澄的改履歷') >= 0, '不站在終點台上，確認了就照樣成交'); await H.pick('好');
  // 5. 沒確認、也沒站在終點台上 → 錯過
  var s5 = await H.ev(SLOT(3, true));
  await pg.waitForFunction("CORE.slotOf(APP.state(),'" + s5 + "').slot.judged", null, { timeout: 20000 }); await pg.waitForTimeout(300);
  assert((await H.ev("CORE.slotOf(APP.state(),'" + s5 + "').slot.missed.indexOf('" + J1 + "')")) >= 0, '沒確認、沒站著：錯過');
  // 6. 站上終點台、不按確認，倒數 25 秒時把頁面停住（CDP Debugger.pause），過了那一微秒再打開：照樣成交，「你不在的時候」寫成交
  var s6 = await H.ev(SLOT(30, true, 'r2b'));   // 改履歷只剩 0 份了，換一小時諮詢
  await H.ev("GAME.teleportTo(CORE.roleOf(APP.state(),'" + J2 + "'))"); await H.goNear('goal');
  await pg.waitForFunction("CORE.isPresent(APP.state(),'" + J1 + "','" + s6 + "')", null, { timeout: 5000 });
  assert((await pg.textContent('#countdown')).indexOf('已確認') > 0 && (await pg.textContent('#countdown')).indexOf('先站到') < 0, '倒數旁邊寫已確認：' + (await pg.textContent('#countdown')));
  var left = await H.ev("(CORE.slotOf(APP.state(),'" + s6 + "').slot.atUs-APP.now())/1e6"); await pg.waitForTimeout(Math.max(0, (left - 25) * 1000));
  var cdp = await pg.context().newCDPSession(pg); await cdp.send('Debugger.enable'); await cdp.send('Debugger.pause');
  await new Promise(function (r) { setTimeout(r, 28000); });
  await cdp.send('Debugger.resume'); await cdp.detach(); await pg.waitForTimeout(800);
  var t6 = await H.dlgTitle(), b6 = await H.dlgBody();
  assert(t6.indexOf('你不在的時候') === 0 && b6.indexOf('我拿出：早餐一頓（100 點）；拿到：阿澄的一小時諮詢（90 點）') >= 0 && (await H.ev("CORE.slotOf(APP.state(),'" + s6 + "').slot.docked.indexOf('" + J1 + "')")) >= 0, '頁面停住再打開：照樣成交，「你不在的時候」寫成交：' + t6 + ' ' + b6);
  await H.pick('好');
  // 7. 站著按「取消到場」，一直站著也不會又被確認，時間到記錯過
  var s7 = await H.ev(SLOT(20, true, 'r2b'));
  await pg.waitForFunction("document.getElementById('dlgTitle').textContent.indexOf('交換') === 0", null, { timeout: 12000 });
  assert((await H.dlgBody()).indexOf('到場：已確認') >= 0, '交換對話框寫已確認'); await H.pick('取消到場'); await pg.waitForTimeout(600);
  assert((await H.dlgBody()).indexOf('到場：還沒確認') >= 0 && (await H.ev("CORE.isPresent(APP.state(),'" + J1 + "','" + s7 + "')")) === false, '站著按取消到場：還是沒確認');
  await pg.waitForFunction("CORE.slotOf(APP.state(),'" + s7 + "').slot.judged", null, { timeout: 30000 }); await pg.waitForTimeout(300);
  assert((await H.ev("CORE.slotOf(APP.state(),'" + s7 + "').slot.missed.indexOf('" + J1 + "')")) >= 0, '一直站著也不會又被確認，時間到記錯過');
  await H.ev("GAME.dialog(null)");
  // 8. 時刻表 8 顆按鈕：阿澄 5 個時段、我預約了 2 個 → 用手指滑到最下面，最後一個「預約」和「返回」點得到
  await H.ev("(function(){var S=APP.state(),t=APP.now();for(var i=0;i<3;i++)CORE.addSlot(S,'" + J2 + "',t+(1200+i*600)*1e6,1,null,t);var ss=S.roles[1].slots.filter(function(s){return s.atUs>t;}).sort(function(a,b){return a.atUs-b.atUs;});CORE.book(S,'" + J1 + "',ss[0].id,t);CORE.book(S,'" + J1 + "',ss[1].id,t);APP.changed();})()");
  await H.goNear('goal'); await H.pick('時刻表');
  var nb = await H.ev("document.querySelectorAll('#dlgOpts button').length"); assert(nb >= 8, '時刻表有 ' + nb + ' 顆按鈕');
  var box = await H.ev("(function(){var b=document.getElementById('dlg').getBoundingClientRect();return {top:b.top,bottom:b.bottom,win:innerHeight,h:b.height};})()");
  assert(box.h <= box.win * 0.4 + 1, '對話框還是不超過 40%');
  await pg.mouse.move(180, box.top + 40); await pg.mouse.wheel(0, 2000); await pg.waitForTimeout(400);
  var lastBook = await H.ev("(function(){var bs=[...document.querySelectorAll('#dlgOpts button')].filter(function(b){return b.textContent.indexOf('　預約')>0;});var b=bs[bs.length-1].getBoundingClientRect();var h=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return {inWin:b.bottom<=innerHeight&&b.top>=0,hit:h===bs[bs.length-1]||bs[bs.length-1].contains(h)};})()");
  assert(lastBook.inWin && lastBook.hit, '滑到最下面，最後一個「預約」在畫面裡、手指打得到');
  await H.finger("function(){ return [...document.querySelectorAll('#dlgOpts button')].filter(function (b) { return b.textContent.indexOf('　預約') > 0; }).slice(-1)[0]; }", '最後一個預約');
  assert((await H.dlgTitle()).indexOf('我要 阿澄 的什麼') === 0, '點了最後一個「預約」'); await H.pick('存好');
  await pg.mouse.move(180, box.top + 40); await pg.mouse.wheel(0, 2000); await pg.waitForTimeout(300);
  await H.pick('返回'); assert((await H.dlgTitle()).indexOf('這裡是終點') === 0, '「返回」也點得到');
  await H.ev("GAME.dialog(null)");
  // 9. 表世界：確認了，停住頁面再打開，訊息是「你不在的時候：…」且不被「錯過」那句蓋掉
  await pg.click('#btnHome'); await pg.waitForTimeout(300); await H.toSheet();
  var s9 = await H.ev(SLOT(6, true, 'r2b')); await H.sheet('booked'); await H.edit('input[data-ed="present"][data-id="' + s9 + '"]', null, true);
  cdp = await pg.context().newCDPSession(pg); await cdp.send('Debugger.enable'); await cdp.send('Debugger.pause');
  await new Promise(function (r) { setTimeout(r, 9000); });
  await cdp.send('Debugger.resume'); await cdp.detach(); await pg.waitForTimeout(1200);
  var m9 = await pg.textContent('#smsg');
  assert(m9.indexOf('你不在的時候：') === 0 && m9.indexOf('互換') >= 0 && m9.indexOf('標為錯過') < 0, '表世界停住再打開：「你不在的時候：…」留著：' + m9);
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
