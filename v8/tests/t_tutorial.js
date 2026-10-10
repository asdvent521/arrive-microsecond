// 新手教學（DESIGN.md 7-4）：從創角色開始，裡世界走一遍、表世界走一遍、中途切換接著走、走完「要」在另一邊再走、「不要」帶看對照、跳過。
// node v8/tests/t_tutorial.js <test8.html>
var lib = require('./lib'), assert = lib.assert, T = require('./tut'), G = T.G, Sh = T.Sh, J1 = T.J1;
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  // 1. 裡世界整套：創角色 → 找引路人 → 預約選空的 → 那一微秒 → 帳房 → 兌現 → 問 → 不要 → 表世界帶看對照 → 切回
  await H.fresh({ raw: true });
  assert((await H.ev("APP.state().me")) === -1 && (await H.ev("APP.isBlank()")) && (await H.ev("APP.state().roles.map(function(r){return r.name;}).join(',')")) === '阿澄,小樂,引路人', '示範版沒有預先放好「我」：三個示範角色，第一次打開從創角色開始');
  await G.full(H, '小明'); await G.ask(H, false); await Sh.compare(H);
  var st = await H.ev("JSON.stringify({d:APP.state().dockings.map(function(d){return [d.traded,d.tutorial];}),n:CORE.dockCount(APP.state(),'" + J1 + "'),ratio:CORE.ratio(APP.state(),'" + J1 + "').text,h:APP.state().holds.map(function(h){return h.status;}),rec:APP.state().records.filter(function(r){return r.tutorial;}).map(function(r){return r.text.slice(0,4);}),rd:APP.state().redeems.length})");
  st = JSON.parse(st);
  assert(st.d.length === 1 && st.d[0][0] && st.d[0][1] && st.n === 0 && st.h.join() === 'redeemed,redeemed' && st.rd === 2 && st.rec.join() === '（教學）', '教學的對接成交但不算數：對接過 0 次、兩筆都兌現了（引路人也兌現了我的空的）、紀錄標「教學」；換點比例 ' + st.ratio);
  await H.toSheet(); await H.sheet('dockings'); assert((await H.main()).indexOf('教學') >= 0, '對接紀錄標「教學」');
  await H.sheet('todo'); assert((await H.rows()) === 6 && (await H.main()).indexOf('① 每天的點') >= 0, '教學結束後待辦回到平常的六步');

  // 2. 表世界整套 → 問 → 要 → 切到裡世界從「補 1 份空的」再走一次 → 第二輪走完就結束
  await H.fresh({ raw: true });
  await Sh.full(H, '小華'); await Sh.ask(H, true);
  assert((await H.ev("APP.view()")) === 'game' && (await H.ev("JSON.stringify([APP.tut().round, APP.tut().step])")) === '[2,1]', '選「要」：切到裡世界，第二輪第 1 步');
  await G.restock(H); await G.find(H); await G.book(H); await G.dock(H); await G.see(H);
  await pg.waitForFunction("APP.tut().step === 'done'", null, { timeout: 5000 });
  assert((await H.ev("APP.state().dockings.filter(function(d){return d.tutorial&&d.traded;}).length")) === 2 && (await H.ev("CORE.dockCount(APP.state(),'" + J1 + "')")) === 0 && (await pg.textContent('#toast')).indexOf('教學完成') >= 0, '第二輪也成交、照樣不算數；走完就結束');

  // 3. 中途切換從同一步接著走：裡世界做到找到引路人，切到表世界，待辦的下一步是 ③、講表世界的做法；在表世界走完
  await H.fresh({ raw: true });
  await G.create(H, '小中'); await G.find(H);
  await H.toSheet(); await H.sheet('todo');
  var m = await H.main();
  assert((await H.ev("document.querySelector('#smain tr.next') && document.querySelector('#smain tr.next').textContent")).indexOf('③ 預約') >= 0 && m.indexOf('可預約時段') >= 0 && m.indexOf('完成') >= 0, '切到表世界：下一步還是 ③，提示講「可預約時段」，前兩步標完成');
  await Sh.book(H); await Sh.dock(H); await Sh.see(H); await Sh.ask(H, false); await G.compare(H);

  // 4. 跳過：只做創角色（補 0 份），空物件的提醒照樣出現
  await H.fresh({ raw: true });
  await H.setIn('cName', '小跳'); await H.setIn('cQty', 0); await H.pick('建立，跳過教學'); await pg.waitForTimeout(400);
  assert((await H.ev("JSON.stringify([APP.tut().step, APP.tut().skipped, APP.me().name])")) === '["done",true,"小跳"]' && (await pg.textContent('#task')).indexOf('下一步：') === 0, '跳過：角色建好、教學結束、提示回到平常的下一步');
  await H.toSheet(); await H.sheet('todo');
  assert((await H.rows()) === 6 && (await H.main()).indexOf('可換 0 份，先補貨') >= 0, '跳過教學，待辦照樣提醒 0 點的空物件要補貨');
  assert((await H.ev("APP.state().roles.length")) === 4 && (await H.ev("APP.state().roles[3].name")) === '引路人', '引路人還在（J4）');

  // 5. 全部還原成預設 → 又從創角色開始
  await H.click('[data-act="go"][data-s="help"]'); await H.click('[data-act="resetAll"]'); await pg.waitForTimeout(400);
  assert((await H.ev("APP.isBlank()")) && (await H.ev("APP.tut().step")) === 1, '全部還原成預設後又是創角色');
  await H.toGame(); assert((await H.dlgTitle()) === '創角色', '切回裡世界是創角色的對話框');

  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
