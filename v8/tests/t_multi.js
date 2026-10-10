// 多人：J1 開時段，J2、J3 都預約並到場（用換人在表世界勾），那一微秒 J1↔J2、J1↔J3、J2↔J3 照選好的成交。
// node v8/tests/t_multi.js <test8.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh(); await pg.click('#swapToSheet'); await pg.waitForTimeout(300);
  var becomeMe = async function (serial) { await H.sheet('roles'); await H.edit('input[data-ed="me"][data-id="' + serial + '"]', null, true); assert((await H.ev("APP.me().serial")) === serial, '換人成 ' + serial); };
  // J1：開一個 1 分鐘後的時段，名額 2；接受 J3 的村規
  await H.sheet('myslots'); await H.setIn('addSlotMin', 1); await H.setIn('addSlotCap', 2); await H.click('[data-act="addSlot"]');
  var slotId = await H.ev("APP.me().slots.find(function(s){return s.capacity===2;}).id");
  await H.sheet('switches', J3 + ':'); await H.click('[data-act="accept"][data-id="' + J3 + '"]');
  // J2：接受 J3 的村規、預約 J1 的時段、選要 J1 的早餐、勾到場
  await becomeMe(J2);
  await H.sheet('switches', J3 + ':'); await H.click('[data-act="accept"][data-id="' + J3 + '"]');
  await H.sheet('open'); await H.click('[data-act="book"][data-id="' + slotId + '"]');
  assert((await H.sheetName()) === 'booked', 'J2 預約後跳到我預約的');
  await H.click('[data-act="wantAdd"][data-res="r1b"]'); await H.edit('input[data-ed="present"]', null, true);
  // J3：預約 J1 的時段；選要 J1 的陪跑、要 J2 的諮詢；勾到場
  await becomeMe(J3);
  await H.sheet('open'); await H.click('[data-act="book"][data-id="' + slotId + '"]');
  assert((await H.main()).indexOf('J2 阿澄') >= 0 && (await H.main()).indexOf('J1 我') >= 0, '同一個時段有別人時，對每個人都選得到');
  await H.click('[data-act="wantAdd"][data-res="r1a"]'); await H.click('[data-act="wantAdd"][data-res="r2b"]'); await H.edit('input[data-ed="present"]', null, true);
  // J2 再回來：選要 J3 的借書
  await becomeMe(J2); await H.sheet('booked'); await H.click('[data-act="wantAdd"][data-res="r3a"]');
  assert((await H.main()).indexOf('陪跑一小時 60點') >= 0 && (await H.main()).indexOf('他要我的') >= 0, '我預約的看得到他要我的');
  // J1：在「我開的時段」替每個預約的人選我要他的：J2 的改履歷、J3 的借書
  await becomeMe(J1); await H.sheet('myslots');
  await H.click('tr[data-id="' + slotId + '"] [data-act="wantAdd"][data-res="r2a"]'); await H.click('tr[data-id="' + slotId + '"] [data-act="wantAdd"][data-res="r3a"]');
  assert((await H.main()).indexOf('早餐一頓（100 點）') >= 0, '我開的時段看得到他要我的');
  // 等那一微秒
  await pg.waitForFunction("CORE.slotOf(APP.state(),'" + slotId + "').slot.judged", null, { timeout: 90000 }); await pg.waitForTimeout(400);
  var ds = await H.ev("JSON.stringify(APP.state().dockings.map(function(d){return {a:d.a,b:d.b,ga:d.gaveA,gb:d.gaveB,ok:d.ok,fa:d.failA,fb:d.failB};}))");
  var D = JSON.parse(ds), pair = function (x, y) { return D.find(function (d) { return (d.a === x && d.b === y) || (d.a === y && d.b === x); }); };
  var gave = function (d, who) { return d.a === who ? d.ga : d.gb; };
  assert(D.length === 3 && D.every(function (d) { return d.ok; }), '三對都成立：' + ds);
  assert(gave(pair(J1, J2), J1) === 100 && gave(pair(J1, J2), J2) === 100, 'J1↔J2：J1 給 100（早餐）、J2 給 100（改履歷）');
  assert(gave(pair(J1, J3), J1) === 60 && gave(pair(J1, J3), J3) === 10, 'J1↔J3：J1 給 60（陪跑）、J3 給 10（借書）');
  assert(gave(pair(J2, J3), J2) === 90 && gave(pair(J2, J3), J3) === 10, 'J2↔J3：J2 給 90（諮詢）、J3 給 10（借書）');
  assert((await H.ev("APP.state().holds.length")) === 6 && (await H.ev("JSON.stringify([CORE.remainingToday(APP.state(),APP.state().roles[0],APP.now()),CORE.remainingToday(APP.state(),APP.state().roles[1],APP.now()),CORE.remainingToday(APP.state(),APP.state().roles[2],APP.now())])")) === '[1640,1810,780]', '六筆保留；三個人當天剩的點對');
  await H.sheet('dockings'); assert((await H.rows()) === 3, '對接紀錄三列');
  await H.sheet('points'); assert((await H.rows()) === 2 && (await H.main()).indexOf('改履歷') >= 0 && (await H.main()).indexOf('借一本書') >= 0, 'J1 保留了改履歷和借一本書');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
