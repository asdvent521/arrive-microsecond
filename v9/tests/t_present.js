// 會到與補判：約的時候會到預設勾著，拿掉再約就是沒確認（事件簿最上面提醒）；事件簿那一行可以取消會到、再勾、取消；勾了重新整理還在；
// 關掉頁面或頁面停住，那一微秒過了再打開，跳出「你不在的時候」、那一行變成交、兌現；沒確認的記沒來。
// node v9/tests/t_present.js <test9.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002';
var SLOT = function (sec) { return "(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+" + sec + "e6,1,null,t);APP.changed();return s.id;})()"; };
var WANTS = function (id) { return "(function(){var S=APP.state();CORE.setWants(S,'" + id + "','" + J1 + "','" + J2 + "',['r2b']);CORE.setWants(S,'" + id + "','" + J2 + "','" + J1 + "',['r1b']);APP.changed();})()"; };
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  var present = function (id) { return H.ev("CORE.isPresent(APP.state(),'" + J1 + "','" + id + "')"); };
  var bookIt = async function (id, arrive) { await H.serial('J2'); await H.check('#arr_' + id, arrive); await H.click('#tmain [data-act="book"][data-id="' + id + '"]'); };
  var box = function (id) { return '#tmain input[data-ed="present"][data-id="' + id + '"]'; };
  // 1. 拿掉會到的勾再約：沒確認，事件簿最上面提醒
  var s1 = await H.ev(SLOT(300));
  await bookIt(s1, false);
  assert((await present(s1)) === false && (await H.msg()).indexOf('還沒勾會到') >= 0 && (await H.sheetName()) === 'log', '把會到的勾拿掉再約：約好了、沒確認，跳到事件簿');
  assert((await H.ev("document.querySelector('#tmain .remind').textContent")).indexOf('還沒確認會到') >= 0 && (await H.ev("document.querySelector('#tmain .remind').textContent")).indexOf('沒確認就算沒來') >= 0, '事件簿最上面提醒：還沒確認會到，沒確認就算沒來');
  // 2. 那一行勾會到就確認；重新整理還勾著；取消、再勾；取消預約
  await H.check(box(s1), true);
  assert((await present(s1)) === true && (await H.msg()) === '會到' && !(await H.ev("!!document.querySelector('#tmain .remind')")), '那一行勾會到：確認了，提醒不見');
  await pg.reload(); await pg.waitForTimeout(500); await H.nav('log');
  assert((await H.ev("document.querySelector('" + box(s1) + "').checked")) === true, '重新整理後還勾著（存進存檔）');
  await H.check(box(s1), false); assert((await present(s1)) === false && (await H.msg()).indexOf('不去了，時間到記成沒來') >= 0, '取消會到');
  await H.check(box(s1), true); assert((await present(s1)) === true, '再勾');
  await H.finger("function(){ var tr=" + H.entryRow(s1, J2) + "; return tr && tr.querySelector('[data-act=\"cancelBook\"]'); }", '取消');
  assert((await H.ev("CORE.slotOf(APP.state(),'" + s1 + "').slot.bookings.length")) === 0 && (await H.ev("CORE.slotOf(APP.state(),'" + s1 + "').slot.confirmed.length")) === 0 && (await H.msg()) === '取消預約了', '取消：預約和會到一起拿掉');
  // 3. 約好（會到預設勾著）後關掉頁面，那一微秒過了再打開：補判照那一微秒成交，跳出「你不在的時候」
  var s2 = await H.ev(SLOT(5)); await bookIt(s2, true); await H.ev(WANTS(s2));
  assert((await present(s2)) === true, '約的時候會到預設確認');
  await pg.goto('about:blank'); await pg.waitForTimeout(7000);
  await pg.goto(H.file); await pg.waitForTimeout(900);
  assert((await H.popOpen()) && (await H.popTitle()) === '你不在的時候' && (await H.popBody()).indexOf('我給他：早餐一頓（100 點）；我收到：阿澄的一小時諮詢') >= 0, '再打開跳出「你不在的時候」，寫成交：' + (await H.popBody()));
  var dk = await H.ev("(function(){var d=APP.state().dockings.find(function(x){return x.slot==='" + s2 + "';});return d&&d.traded&&d.atUs===CORE.slotOf(APP.state(),'" + s2 + "').slot.atUs;})()");
  assert(dk, '補判照那個時段的那一微秒成交');
  await H.popOk(); await H.nav('log');
  var row2 = await H.ev("(function(){var tr=" + H.entryRow(s2, J2) + ";return tr?tr.textContent:'';})()");
  assert(row2.indexOf('成交') >= 0 && row2.indexOf('一小時諮詢') >= 0 && row2.indexOf('兌現') >= 0 && (await H.ev(H.entryRow(s2, J2) + ".querySelector('.sig').textContent")) === '阿澄', '事件簿那一行變成交、收到一小時諮詢、紅字簽名、可以兌現');
  // 4. 頁面停住（螢幕關掉）再打開：一樣補判，訊息不被「沒來」蓋掉
  var s3 = await H.ev(SLOT(4)); await bookIt(s3, true); await H.ev(WANTS(s3));
  var cdp = await pg.context().newCDPSession(pg); await cdp.send('Debugger.enable'); await cdp.send('Debugger.pause');
  await new Promise(function (r) { setTimeout(r, 6000); });
  await cdp.send('Debugger.resume'); await cdp.detach(); await pg.waitForTimeout(900);
  assert((await H.popTitle()) === '你不在的時候' && (await H.popBody()).indexOf('一小時諮詢') >= 0 && (await H.msg()).indexOf('沒來') < 0, '頁面停住再打開：跳出「你不在的時候」，寫成交');
  await H.popOk();
  // 5. 沒確認：時間到記沒來
  var s4 = await H.ev(SLOT(4)); await bookIt(s4, false); await H.ev(WANTS(s4));
  await pg.waitForFunction("CORE.slotOf(APP.state(),'" + s4 + "').slot.judged", null, { timeout: 15000 }); await pg.waitForTimeout(300);
  assert((await H.ev("CORE.missed(CORE.slotOf(APP.state(),'" + s4 + "').slot,'" + J1 + "')")) === true && (await H.msg()).indexOf('沒確認會到的記為沒來') >= 0, '沒確認：時間到記沒來，有提示');
  assert((await H.ev("(function(){var tr=" + H.entryRow(s4, J2) + ";return tr?tr.textContent:'';})()")).indexOf('沒來') >= 0, '事件簿那一行寫沒來');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
