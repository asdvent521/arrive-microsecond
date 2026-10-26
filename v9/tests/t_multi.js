// 多人：J1 在事件簿空白那一行開時段（名額 2），J2、J3 到 J1 的那張紙約（會到預設勾著），各自在事件簿那一行選要換誰的什麼；那一微秒 J1↔J2、J1↔J3、J2↔J3 照選好的成交。換人用「更多 → 角色設定」最下面的選單。
// node v9/tests/t_multi.js <test9.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  var acceptJ3 = async function () { await H.serial('J3'); await H.clickText('看他的規則', '#tmain'); await H.clickText('接受他的家規', '#tmain'); assert((await H.main()).indexOf('你已接受') >= 0, (await H.ev("APP.me().name")) + ' 接受了小樂的家規'); await H.clickText('回我自己', '#tother'); };
  var bookJ1 = async function (slotId) { await H.serial('J1'); assert((await H.ev("document.getElementById('arr_" + slotId + "').checked")), '會到的勾預設勾著'); await H.click('#tmain [data-act="book"][data-id="' + slotId + '"]'); assert((await H.sheetName()) === 'log' && (await H.ev(H.entryRow(slotId, J1) + " !== null")), '約好了，跳到事件簿那一行'); };
  var rowText = function (slotId, other) { return H.ev("(function(){var tr=" + H.entryRow(slotId, other) + ";return tr?tr.textContent:'';})()"); };
  // J1：開一個 2 分鐘後的時段，名額 2；接受小樂的家規
  var slotId = await H.openSlot(120, 2);
  assert((await H.ev("CORE.slotOf(APP.state(),'" + slotId + "').slot.capacity")) === 2, '在空白那一行寫時間、名額 2：開了時段');
  await acceptJ3();
  // J2：接受小樂的家規、在 J1 的時段約、選 J1 的早餐
  await H.becomeMe(J2); await acceptJ3(); await bookJ1(slotId);
  await H.pick(slotId, J1, ['r1b']);
  // J3：約、選 J1 的陪跑、J2 的諮詢（跟每個人各一行）
  await H.becomeMe(J3); await bookJ1(slotId);
  assert((await H.ev(H.entryRow(slotId, J1) + " !== null")) && (await H.ev(H.entryRow(slotId, J2) + " !== null")), '同一個時段有別人時，事件簿上跟每個人各一行，都選得到');
  await H.pick(slotId, J1, ['r1a']); await H.pick(slotId, J2, ['r2b']);
  // J2 再回來：選 J3 的借書；看得到他要我的
  await H.becomeMe(J2); await H.nav('log'); await H.pick(slotId, J3, ['r3a']);
  assert((await rowText(slotId, J3)).indexOf('一小時諮詢・90') >= 0 && (await rowText(slotId, J1)).indexOf('早餐一頓') >= 0, '我給他那格寫他選了我的什麼・價錢');
  // J1：在自己的事件簿替每個約的人選我要他的
  await H.becomeMe(J1); await H.nav('log'); await H.pick(slotId, J2, ['r2a']); await H.pick(slotId, J3, ['r3a']);
  assert((await rowText(slotId, J2)).indexOf('早餐一頓・100') >= 0 && (await rowText(slotId, J2)).indexOf('改履歷') >= 0, '我開的時段那一行也看得到他要我的、我選他的');
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
  var cells = await H.ev("Array.from(document.querySelectorAll('#tmain tr.traded')).map(function(t){return Array.from(t.querySelectorAll('td')).map(function(td){return td.textContent.trim();});})");
  assert(cells.length === 2 && (cells[0][5] === '1700' || cells[0][5] === '1740') && cells[1][5] === '1640' && cells.every(function (c) { return c[4] === '成交' && c[7] === '兌現'; }), '事件簿兩行成交：今天還剩一行一行往下扣（扣到 1640），兌現那格有「兌現」');
  assert((await H.main()).indexOf('改履歷') >= 0 && (await H.main()).indexOf('借一本書') >= 0, 'J1 收到：改履歷和借一本書');
  await H.nav('cal'); var today = await H.ev("CORE.dayNum(APP.now())");
  assert((await H.ev("document.querySelector('#tmain table.calp td[data-day=\"" + today + "\"]').className")).indexOf('lv2') >= 0 && (await H.main()).indexOf('這個月成交 2 次') >= 0, '日曆紙：今天那一格兩筆成交，亮兩級；這個月成交 2 次');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
