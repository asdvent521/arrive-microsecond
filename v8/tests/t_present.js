// 到場是事先確認（DESIGN 補五）：表世界勾到場重新整理還在；關掉頁面那一微秒過了再打開看得到「你不在的時候」、點數多一筆；裡世界時刻表按確認到場不站終點台也成交；沒確認沒站著就錯過；待辦提醒。
// node v8/tests/t_present.js <test8.html>
var lib = require('./lib'), assert = lib.assert, path = require('path');
var J1 = '00000000001', J2 = '00000000002';
var SLOT = function (sec, wants) { return "(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+" + sec + "e6,1,null,t);CORE.book(S,'" + J1 + "',s.id,t);" + (wants ? "CORE.setWants(S,s.id,'" + J1 + "','" + J2 + "',['r2a']);CORE.setWants(S,s.id,'" + J2 + "','" + J1 + "',['r1b']);" : '') + "APP.changed();return s.id;})()"; };
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
  var s4 = await H.ev(SLOT(120, true));
  await H.ev("GAME.teleportTo(CORE.roleOf(APP.state(),'" + J2 + "'))"); await H.goNear('goal'); await H.pick('時刻表');
  assert((await H.opts()).some(function (o) { return o.indexOf('還沒確認到場') > 0; }), '時刻表標還沒確認到場');
  await H.pick('確認到場');
  assert((await H.opts()).some(function (o) { return o.indexOf('已確認到場') > 0; }) && (await H.opts()).some(function (o) { return o.indexOf('取消到場') === 0; }), '按了標已確認、可以取消');
  await H.ev("GAME.dialog(null)"); await pg.click('#btnHome'); await pg.waitForTimeout(300);
  await H.ev("(function(){var S=APP.state(),x=CORE.slotOf(S,'" + s4 + "');x.slot.atUs=APP.now()+3e6;APP.changed();})()");
  await pg.waitForFunction("document.getElementById('dlgTitle').textContent === '到達那微秒'", null, { timeout: 20000 });
  assert((await H.ev("CORE.slotOf(APP.state(),'" + s4 + "').slot.docked.indexOf('" + J1 + "')")) >= 0 && (await H.dlgBody()).indexOf('拿到：阿澄的改履歷') >= 0, '不站在終點台上，確認了就照樣成交'); await H.pick('好');
  // 5. 沒確認、也沒站在終點台上 → 錯過
  var s5 = await H.ev(SLOT(3, true));
  await pg.waitForFunction("CORE.slotOf(APP.state(),'" + s5 + "').slot.judged", null, { timeout: 20000 }); await pg.waitForTimeout(300);
  assert((await H.ev("CORE.slotOf(APP.state(),'" + s5 + "').slot.missed.indexOf('" + J1 + "')")) >= 0, '沒確認、沒站著：錯過');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
