// 新手教學（DESIGN 7-4，第 1 輪做 1～7 步）：創角色 → 隨機 → 公告欄找引路人的序號、序號框跳過去 → 看他的家規 → 預約選他的「空的」（預約時就確認到達）→ 那一微秒 → 背包兌現。
// 教學的對接不算數、標「教學」；可以跳過（只做創角色，空物件的提醒照樣出現）；全部還原又從創角色開始。
// node v9/tests/t_tutorial.js <test9.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J4 = '00000000004';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  var step = function () { return H.ev("APP.tut().step"); };
  var waitStep = function (k) { return pg.waitForFunction("APP.tut().step === " + JSON.stringify(k), null, { timeout: 15000 }); };
  // ① 創角色
  await H.fresh({ raw: true });
  assert((await H.ev("APP.state().me")) === -1 && (await H.ev("APP.state().roles.map(function(r){return r.name;}).join(',')")) === '阿澄,小樂,引路人', '示範版沒有預先放好「我」：第一次打開從創角色開始');
  assert((await H.sheetName()) === 'role' && (await pg.textContent('#tutbar')).indexOf('創角色') >= 0, '一打開就在「我的／角色」，上面一行寫教學 ① 創角色');
  assert((await H.ev("[document.getElementById('cDaily').value,document.getElementById('cItem').value,document.getElementById('cPrice').value,document.getElementById('cQty').value].join('/')")) === '2000/空的/0/1', '每天的點預設 2000，第一樣東西「空的」0 點 1 份');
  await H.setIn('cName', '小明'); await H.clickText('建立', '#tmain');
  await waitStep(2);
  assert((await H.ev("APP.me().serial")) === J1 && (await H.sheetName()) === 'today' && (await pg.textContent('#tutbar')).indexOf('② 找陌生人一：隨機') >= 0, '建立：J1 當下生效，到「今天」，教學到 ②');
  assert((await H.main()).indexOf('① 創角色') >= 0 && (await H.main()).indexOf('⑦ 兌現') >= 0 && (await H.rows('today')) === 7, '今天列出教學七步');
  // ② 隨機
  await H.click('#randomBtn'); await waitStep(3);
  assert((await H.ev("TABLE.ui.other")) !== null && (await pg.textContent('#tutbar')).indexOf('③') >= 0, '按「隨機」跳到一個陌生人的表格世界，教學到 ③');
  // ③ 在公告欄找引路人的公告，記下序號，在序號框輸入跳過去
  await H.nav('notices');
  var code = await H.ev("(function(){var tr=[...document.querySelectorAll('#tmain tr[data-row]')].find(function(t){return t.textContent.indexOf('教學')>=0;});return tr.querySelector('button.lk').textContent;})()");
  assert(code === 'J4', '公告欄找到引路人的公告，序號 ' + code);
  await H.serial(code); await waitStep(4);
  assert((await pg.textContent('#tother')).indexOf('J4 引路人') >= 0, '在序號框輸入 J4 跳過去，教學到 ④');
  // ④ 看他的家規：沒有家規網站，表示不收留言
  await H.otab('rules'); await waitStep(5);
  assert((await H.main()).indexOf('沒有家規網站：不收留言') >= 0, '他的規則表：沒有家規網站，不收留言；教學到 ⑤');
  // ⑤ 預約、選他的「空的」：預約時就確認到達
  await pg.waitForFunction("APP.tut().slot !== null", null, { timeout: 5000 });
  var sid = await H.ev("APP.tut().slot");
  await H.otab('slots');
  assert((await H.ev("document.getElementById('arr_" + sid + "').checked")), '走到預約這一步，引路人才開時段；到達預設勾著');
  await H.click('#tmain [data-act="book"][data-id="' + sid + '"]');
  assert((await H.ev("CORE.isPresent(APP.state(),'" + J1 + "','" + sid + "')")) === true && (await H.sheetName()) === 'booked', '預約時就確認到達，跳到我預約的');
  await H.click('#tmain tr[data-id="' + sid + '"] [data-act="wantAdd"][data-res="r4e"]'); await waitStep(6);
  var e = await H.ev("CORE.version(APP.me(),APP.now()).resources[0].id");
  assert((await H.ev("CORE.wantsValid(APP.state(),CORE.slotOf(APP.state(),'" + sid + "').slot,'" + J4 + "','" + J1 + "').join()")) === e, '引路人一定選你的「空的」；教學到 ⑥');
  // ⑥ 那一微秒：白光、跳出成交結果
  await H.ev("window.__flashed=false;new MutationObserver(function(){if(document.getElementById('flash').classList.contains('go'))window.__flashed=true;}).observe(document.getElementById('flash'),{attributes:true})");
  await H.soon(sid, 3);
  await pg.waitForFunction("!document.getElementById('pop').hidden", null, { timeout: 15000 });
  assert((await H.popBody()).indexOf('我拿出：空的（0 點）；拿到：引路人的空的（0 點）') >= 0 && (await H.ev("window.__flashed")), '那一微秒白光一閃，跳出「我拿出：空的；拿到：引路人的空的」');
  await waitStep(7); await H.popOk();
  // ⑦ 在背包兌現
  await H.nav('bag'); await H.clickText('兌現', '#tmain'); await waitStep('done');
  assert((await H.msg()).indexOf('教學完成') >= 0 && (await pg.isHidden('#tutbar')), '兌現了，教學完成（第 8 步看達秒屋第 2 輪做）');
  var st = JSON.parse(await H.ev("JSON.stringify({d:APP.state().dockings.map(function(d){return [d.traded,d.tutorial];}),n:CORE.dockCount(APP.state(),'" + J1 + "'),ratio:CORE.ratio(APP.state(),'" + J1 + "').text,h:APP.state().holds.map(function(h){return h.status;})})"));
  assert(st.d.length === 1 && st.d[0][0] && st.d[0][1] && st.n === 0 && st.ratio === '還沒對接過' && st.h.join() === 'redeemed,redeemed', '教學的對接不算數：對接過 0 次、換點比例還沒對接過；引路人也兌現了我的「空的」');
  await H.nav('calendar'); assert((await H.main()).indexOf('教學') >= 0, '日曆那一筆標「教學」');
  await H.nav('today'); assert((await H.rows('today')) === 5 && (await H.main()).indexOf('① 每天的點') >= 0, '教學結束後「今天」回到平常的下一步和提醒');
  assert((await H.ev("APP.state().notices.filter(function(n){return n.owner==='" + J4 + "';}).length")) === 1, '引路人的公告成交後還在');
  // 跳過：只做創角色（補 0 份），空物件的提醒照樣出現
  await H.fresh({ raw: true });
  await H.setIn('cName', '小跳'); await H.setIn('cQty', 0); await H.clickText('建立，跳過教學', '#tmain'); await pg.waitForTimeout(300);
  assert((await H.ev("JSON.stringify([APP.tut().step,APP.tut().skipped,APP.me().name])")) === '["done",true,"小跳"]' && (await pg.isHidden('#tutbar')), '跳過：角色建好、教學結束');
  assert((await H.rows('today')) === 5 && (await H.main()).indexOf('可換 0 份，先補貨') >= 0, '跳過教學，今天照樣提醒 0 點的空物件要補貨');
  // 教學中按「跳過教學」
  await H.fresh({ raw: true }); await H.clickText('建立', '#tmain'); await waitStep(2);
  await H.clickText('跳過教學', '#tutbar'); assert((await step()) === 'done' && (await H.msg()).indexOf('跳過了教學') >= 0, '教學中也可以按「跳過教學」');
  // 全部還原成預設 → 又從創角色開始
  await H.nav('help'); await H.clickText('全部還原成預設', '#tmain'); await H.popOk('還原');
  assert((await H.ev("APP.isBlank()")) && (await step()) === 1 && (await H.sheetName()) === 'role' && (await H.ev("!!document.getElementById('cName')")), '全部還原成預設後又是創角色');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
