// 一起成交的時段：開時段勾「一起成交」、約之前看得到標示、那一微秒之前看得到還差誰；三個人湊一圈全部成交；有一對沒選整個時段不成交（點、貨、保留都不動，結果寫是哪一對）；刪沒人預約的時段。
// node v9/tests/t_together.js <test9.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  var becomeMe = async function (serial) { await H.nav('role'); var i = await H.ev("APP.state().roles.findIndex(function(r){return r.serial==='" + serial + "';})"); await H.edit('#tmain select[data-ed="me"]', i); };
  var openTogether = async function () { await H.nav('myslots'); await H.setIn('addSlotMin', 1); await H.setIn('addSlotCap', 2); await H.check('#addSlotTogether', true); await H.clickText('開時段', '#tmain'); return H.ev("APP.me().slots.filter(function(s){return s.together;}).slice(-1)[0].id"); };
  var rowText = function (id) { return H.ev("(function(){var tr=document.querySelector('#tmain tr[data-id=\"" + id + "\"]');return tr?tr.textContent:'';})()"); };
  var book = async function (slotId) { await H.serial('J1'); await H.otab('slots'); await H.click('#tmain [data-act="book"][data-id="' + slotId + '"]'); };
  var snapshot = "JSON.stringify([APP.state().holds.length,APP.state().roles.map(function(r){return r.stock;}),APP.state().roles.map(function(r){return CORE.remainingToday(APP.state(),r,APP.now());})])";
  // 1. 開一個勾了一起成交的時段
  var s1 = await openTogether();
  var r1 = await rowText(s1);
  assert(r1.indexOf('一起成交') >= 0 && r1.indexOf('還沒有人選東西') >= 0 && (await H.ev("CORE.slotOf(APP.state(),'" + s1 + "').slot.together")) === true, '我開的時段：勾了一起成交、標出來，還沒有人選東西');
  var full = await H.ev("(function(){var el=document.querySelector('#tmain [data-act=\"addSlot\"]');el.scrollIntoView({block:'center'});var b=el.getBoundingClientRect();return [[b.left+2,b.top+2],[b.right-2,b.bottom-2]].every(function(p){var h=document.elementFromPoint(p[0],p[1]);return h===el||el.contains(h);});})()");
  assert(full, '780 寬「開時段」整顆都按得到');
  await H.serial('J3'); await H.otab('rules'); await H.clickText('接受他的家規', '#tmain'); await H.clickText('回我自己', '#tother');
  // J2：約之前看得到一起成交；約、選 J1 的早餐
  await becomeMe(J2); await H.serial('J3'); await H.otab('rules'); await H.clickText('接受他的家規', '#tmain');
  await H.serial('J1'); await H.otab('slots'); assert((await rowText(s1)).indexOf('一起成交') >= 0, '在他的時段裡，約之前就看得到「一起成交」');
  await H.click('#tmain [data-act="book"][data-id="' + s1 + '"]'); await H.click('#tmain tr[data-id="' + s1 + '"] [data-act="wantAdd"][data-res="r1b"]');
  assert((await rowText(s1)).indexOf('還差 我 選 阿澄 的東西') >= 0, '我預約的：那一微秒之前列出還差誰選誰的東西');
  // J3：約、選 J1 的陪跑和 J2 的諮詢
  await becomeMe(J3); await book(s1);
  await H.click('#tmain tr[data-id="' + s1 + '"] [data-act="wantAdd"][data-res="r1a"]'); await H.click('#tmain tr[data-id="' + s1 + '"] [data-act="wantAdd"][data-res="r2b"]');
  await becomeMe(J2); await H.nav('booked'); await H.click('#tmain tr[data-id="' + s1 + '"] [data-act="wantAdd"][data-res="r3a"]');
  await becomeMe(J1); await H.nav('myslots');
  var r1b = await rowText(s1); assert(r1b.indexOf('還差 我 選 阿澄 的東西') >= 0 && r1b.indexOf('還差 我 選 小樂 的東西') >= 0, '我開的時段也列出還差誰');
  await H.click('#tmain tr[data-id="' + s1 + '"] [data-act="wantAdd"][data-res="r2a"]'); await H.click('#tmain tr[data-id="' + s1 + '"] [data-act="wantAdd"][data-res="r3a"]');
  assert((await rowText(s1)).indexOf('都選好了') >= 0, '三對都兩邊選了：寫「都選好了」');
  await H.soon(s1, 3); await pg.waitForFunction("CORE.slotOf(APP.state(),'" + s1 + "').slot.judged", null, { timeout: 15000 }); await pg.waitForTimeout(400);
  assert((await H.ev("APP.state().dockings.length")) === 3 && (await H.ev("APP.state().dockings.every(function(d){return d.traded&&d.together;})")) && (await H.ev("APP.state().holds.length")) === 6, '三個人湊一圈，那一微秒全部成交：三對、六筆保留');
  await H.popOk();
  // 2. 再開一個：阿澄故意不選小樂的 → 整個時段不成交
  var s2 = await openTogether();
  await becomeMe(J2); await book(s2); await H.click('#tmain tr[data-id="' + s2 + '"] [data-act="wantAdd"][data-res="r1b"]');
  await becomeMe(J3); await book(s2); await H.click('#tmain tr[data-id="' + s2 + '"] [data-act="wantAdd"][data-res="r1b"]'); await H.click('#tmain tr[data-id="' + s2 + '"] [data-act="wantAdd"][data-res="r2b"]');
  await becomeMe(J1); await H.nav('myslots'); await H.click('#tmain tr[data-id="' + s2 + '"] [data-act="wantAdd"][data-res="r2a"]'); await H.click('#tmain tr[data-id="' + s2 + '"] [data-act="wantAdd"][data-res="r3a"]');
  var r2 = await rowText(s2); assert(r2.indexOf('還差 阿澄 選 小樂 的東西') >= 0 && r2.indexOf('還差 我 選') < 0, '只差阿澄選小樂的');
  var before = await H.ev(snapshot);
  await H.soon(s2, 3); await pg.waitForFunction("CORE.slotOf(APP.state(),'" + s2 + "').slot.judged", null, { timeout: 15000 }); await pg.waitForTimeout(400);
  var ds = JSON.parse(await H.ev("JSON.stringify(APP.state().dockings.filter(function(d){return d.slot==='" + s2 + "';}).map(function(d){return [d.traded,d.reason];}))"));
  var why = '一起成交：阿澄 和 小樂 不成（阿澄 沒選 小樂 的東西），整個時段不成交';
  assert(ds.length === 3 && ds.every(function (d) { return !d[0] && d[1] === why; }), '有一對沒選：整個時段不成交，三對都記是哪一對、為什麼');
  assert((await H.ev(snapshot)) === before, '誰的點都沒給、貨都不動、沒有保留');
  assert((await H.popTitle()) === '到達那微秒' && (await H.popBody()).indexOf(why) >= 0, '結果寫是哪一對、為什麼：' + (await H.popBody()));
  await H.popOk(); await H.nav('bag'); assert((await H.rows('bag')) === 2, '背包沒多東西');
  // 3. 刪沒人預約的時段
  await H.nav('myslots'); await H.setIn('addSlotMin', 5); await H.check('#addSlotTogether', false); await H.clickText('開時段', '#tmain');
  var n = await H.ev("APP.me().slots.length"); await H.clickText('刪', '#tmain'); assert((await H.ev("APP.me().slots.length")) === n - 1 && (await H.msg()) === '刪了時段', '刪掉沒人預約的時段');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
