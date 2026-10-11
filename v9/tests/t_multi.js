// 多人：J1 開時段，J2、J3 在 J1 的表格世界的時段裡約（到達預設勾著），各自選要換誰的什麼；那一微秒 J1↔J2、J1↔J3、J2↔J3 照選好的成交。換人用「我的／角色」最下面的選單。
// node v9/tests/t_multi.js <test9.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  var becomeMe = async function (serial) { await H.nav('role'); var i = await H.ev("APP.state().roles.findIndex(function(r){return r.serial==='" + serial + "';})"); await H.edit('#tmain select[data-ed="me"]', i); assert((await H.ev("APP.me().serial")) === serial, '換人成 ' + serial); };
  var acceptJ3 = async function () { await H.serial('J3'); await H.otab('rules'); await H.clickText('接受他的家規', '#tmain'); assert((await H.main()).indexOf('你已接受') >= 0, (await H.ev("APP.me().name")) + ' 接受了小樂的家規'); await H.clickText('回我自己', '#tother'); };
  var bookJ1 = async function (slotId) { await H.serial('J1'); await H.otab('slots'); assert((await H.ev("document.getElementById('arr_" + slotId + "').checked")), '到達的勾預設勾著'); await H.click('#tmain [data-act="book"][data-id="' + slotId + '"]'); assert((await H.sheetName()) === 'booked', '約好了，跳到我預約的'); };
  // J1：開一個 1 分鐘後的時段，名額 2；接受小樂的家規
  await H.nav('myslots'); await H.setIn('addSlotMin', 1); await H.setIn('addSlotCap', 2); await H.clickText('開時段', '#tmain');
  var slotId = await H.ev("APP.me().slots.find(function(s){return s.capacity===2;}).id");
  await acceptJ3();
  // J2：接受小樂的家規、在 J1 的時段約、選 J1 的早餐
  await becomeMe(J2); await acceptJ3(); await bookJ1(slotId);
  await H.click('#tmain tr[data-id="' + slotId + '"] [data-act="wantAdd"][data-res="r1b"]');
  // J3：約、選 J1 的陪跑、J2 的諮詢
  await becomeMe(J3); await bookJ1(slotId);
  var m = await H.main(); assert(m.indexOf('阿澄') >= 0 && m.indexOf('我') >= 0 && (await H.ev("document.querySelectorAll('#tmain tr[data-id=\"" + slotId + "\"] .pick').length")) === 5, '同一個時段有別人時，對每個人都選得到（J1 兩樣、J2 三樣）');
  await H.click('#tmain tr[data-id="' + slotId + '"] [data-act="wantAdd"][data-res="r1a"]'); await H.click('#tmain tr[data-id="' + slotId + '"] [data-act="wantAdd"][data-res="r2b"]');
  // J2 再回來：選 J3 的借書
  await becomeMe(J2); await H.nav('booked'); await H.click('#tmain tr[data-id="' + slotId + '"] [data-act="wantAdd"][data-res="r3a"]');
  assert((await H.main()).indexOf('陪跑一小時') >= 0 && (await H.main()).indexOf('他要我的') >= 0, '我預約的看得到他要我的');
  // J1：在「我開的時段」替每個預約的人選我要他的
  await becomeMe(J1); await H.nav('myslots');
  await H.click('#tmain tr[data-id="' + slotId + '"] [data-act="wantAdd"][data-res="r2a"]'); await H.click('#tmain tr[data-id="' + slotId + '"] [data-act="wantAdd"][data-res="r3a"]');
  assert((await H.main()).indexOf('早餐一頓（100 點）') >= 0, '我開的時段看得到他要我的');
  await H.soon(slotId, 3);
  await pg.waitForFunction("CORE.slotOf(APP.state(),'" + slotId + "').slot.judged", null, { timeout: 15000 }); await pg.waitForTimeout(400);
  var D = JSON.parse(await H.ev("JSON.stringify(APP.state().dockings.map(function(d){return {a:d.a,b:d.b,ga:d.gaveA,gb:d.gaveB,t:d.traded};}))"));
  var pair = function (x, y) { return D.find(function (d) { return (d.a === x && d.b === y) || (d.a === y && d.b === x); }); }, gave = function (d, w) { return d.a === w ? d.ga : d.gb; };
  assert(D.length === 3 && D.every(function (d) { return d.t; }), '三對都成交');
  assert(gave(pair(J1, J2), J1) === 100 && gave(pair(J1, J2), J2) === 100, 'J1↔J2：J1 給 100（早餐）、J2 給 100（改履歷）');
  assert(gave(pair(J1, J3), J1) === 60 && gave(pair(J1, J3), J3) === 10, 'J1↔J3：J1 給 60（陪跑）、J3 給 10（借書）');
  assert(gave(pair(J2, J3), J2) === 90 && gave(pair(J2, J3), J3) === 10, 'J2↔J3：J2 給 90（諮詢）、J3 給 10（借書）');
  assert((await H.ev("APP.state().holds.length")) === 6 && (await H.ev("JSON.stringify(APP.state().roles.slice(0,3).map(function(r){return CORE.remainingToday(APP.state(),r,APP.now());}))")) === '[1640,1810,780]', '六筆保留；三個人當天剩的點對');
  assert((await H.popOpen()) && (await H.popTitle()) === '到達那微秒' && (await H.popBody()).indexOf('和 阿澄') >= 0 && (await H.popBody()).indexOf('和 小樂') >= 0, '成交結果列出跟兩個人各換了什麼'); await H.popOk();
  await H.nav('bag'); assert((await H.rows('bag')) === 2 && (await H.main()).indexOf('改履歷') >= 0 && (await H.main()).indexOf('借一本書') >= 0, 'J1 背包：改履歷和借一本書');
  await H.nav('calendar'); assert((await H.ev("document.querySelectorAll('#tmain tr[data-row]:not(.day)').length")) === 2, 'J1 的日曆：兩筆對接');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
