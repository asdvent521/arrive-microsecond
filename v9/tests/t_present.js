// 到達與補判：約的時候到達預設勾著，拿掉再約就是沒確認（今天提醒）；我預約的可以取消到達、再確認、取消預約；勾了重新整理還在；
// 關掉頁面或頁面停住，那一微秒過了再打開，跳出「你不在的時候」、今天也列出來、背包多一筆；沒確認的記錯過。
// node v9/tests/t_present.js <test9.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002';
var SLOT = function (sec) { return "(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+" + sec + "e6,1,null,t);APP.changed();return s.id;})()"; };
var WANTS = function (id) { return "(function(){var S=APP.state();CORE.setWants(S,'" + id + "','" + J1 + "','" + J2 + "',['r2b']);CORE.setWants(S,'" + id + "','" + J2 + "','" + J1 + "',['r1b']);APP.changed();})()"; };
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  var present = function (id) { return H.ev("CORE.isPresent(APP.state(),'" + J1 + "','" + id + "')"); };
  var bookIt = async function (id, arrive) { await H.serial('J2'); await H.otab('slots'); await H.check('#arr_' + id, arrive); await H.click('#tmain [data-act="book"][data-id="' + id + '"]'); };
  // 1. 拿掉到達的勾再約：沒確認，今天提醒
  var s1 = await H.ev(SLOT(300));
  await bookIt(s1, false);
  assert((await present(s1)) === false && (await H.msg()).indexOf('還沒確認到達') >= 0, '把到達的勾拿掉再約：約好了、沒確認');
  await H.nav('today');
  assert((await H.main()).indexOf('還沒確認到達：沒確認就算錯過') >= 0 && (await H.main()).indexOf('還沒確認') >= 0, '今天提醒：還沒確認到達，沒確認就算錯過');
  // 2. 我預約的：勾到達就確認；重新整理還勾著；取消、再確認
  await H.nav('booked'); await H.check('#tmain input[data-ed="present"][data-id="' + s1 + '"]', true);
  assert((await present(s1)) === true && (await H.msg()) === '確認到達了', '我預約的那一列勾到達：確認了');
  await pg.reload(); await pg.waitForTimeout(500); await H.nav('booked');
  assert((await H.ev("document.querySelector('#tmain input[data-ed=\"present\"][data-id=\"" + s1 + "\"]').checked")) === true, '重新整理後還勾著（存進存檔）');
  await H.check('#tmain input[data-ed="present"][data-id="' + s1 + '"]', false); assert((await present(s1)) === false && (await H.msg()) === '取消到達了', '取消到達');
  await H.check('#tmain input[data-ed="present"][data-id="' + s1 + '"]', true); assert((await present(s1)) === true, '再確認');
  await H.clickText('取消預約', '#tmain'); assert((await H.ev("CORE.slotOf(APP.state(),'" + s1 + "').slot.bookings.length")) === 0 && (await H.ev("CORE.slotOf(APP.state(),'" + s1 + "').slot.confirmed.length")) === 0, '取消預約：預約和到達一起拿掉');
  // 3. 約好（到達預設勾著）後關掉頁面，那一微秒過了再打開：補判照那一微秒成交，跳出「你不在的時候」
  var s2 = await H.ev(SLOT(5)); await bookIt(s2, true); await H.ev(WANTS(s2));
  assert((await present(s2)) === true, '預約時到達預設確認');
  await pg.goto('about:blank'); await pg.waitForTimeout(7000);
  await pg.goto(H.file); await pg.waitForTimeout(900);
  assert((await H.popOpen()) && (await H.popTitle()) === '你不在的時候' && (await H.popBody()).indexOf('我拿出：早餐一頓（100 點）；拿到：阿澄的一小時諮詢（90 點）') >= 0, '再打開跳出「你不在的時候」，寫成交：' + (await H.popBody()));
  var dk = await H.ev("(function(){var d=APP.state().dockings.find(function(x){return x.slot==='" + s2 + "';});return d&&d.traded&&d.atUs===CORE.slotOf(APP.state(),'" + s2 + "').slot.atUs;})()");
  assert(dk, '補判照那個時段的那一微秒成交');
  await H.popOk(); await H.nav('today');
  assert((await H.main()).indexOf('你不在的時候') >= 0 && (await H.main()).indexOf('一小時諮詢') >= 0, '今天那一頁也列出「你不在的時候」的結果');
  await H.nav('bag'); assert((await H.rows('bag')) === 1, '背包多了那一筆');
  // 4. 頁面停住（螢幕關掉）再打開：一樣補判，訊息不被「錯過」蓋掉
  var s3 = await H.ev(SLOT(4)); await bookIt(s3, true); await H.ev(WANTS(s3));
  var cdp = await pg.context().newCDPSession(pg); await cdp.send('Debugger.enable'); await cdp.send('Debugger.pause');
  await new Promise(function (r) { setTimeout(r, 6000); });
  await cdp.send('Debugger.resume'); await cdp.detach(); await pg.waitForTimeout(900);
  assert((await H.popTitle()) === '你不在的時候' && (await H.popBody()).indexOf('一小時諮詢') >= 0 && (await H.msg()).indexOf('錯過') < 0, '頁面停住再打開：跳出「你不在的時候」，寫成交');
  await H.popOk();
  // 5. 沒確認：時間到記錯過
  var s4 = await H.ev(SLOT(4)); await bookIt(s4, false); await H.ev(WANTS(s4));
  await pg.waitForFunction("CORE.slotOf(APP.state(),'" + s4 + "').slot.judged", null, { timeout: 15000 }); await pg.waitForTimeout(300);
  assert((await H.ev("CORE.missed(CORE.slotOf(APP.state(),'" + s4 + "').slot,'" + J1 + "')")) === true && (await H.msg()).indexOf('沒確認到達的記為錯過') >= 0, '沒確認：時間到記錯過，有提示');
  await H.nav('calendar'); assert((await H.main()).indexOf('錯過') >= 0, '日曆記著錯過');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
