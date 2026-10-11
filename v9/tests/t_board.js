// 公告欄：掛公告（需要、種類、可以給、上限、期限）、全部／我的、篩種類、搜尋（公告和資源表一起查）、通不通、撤掉、點序號跳過去。
// node v9/tests/t_board.js <test9.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003', J4 = '00000000004';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  await H.nav('notices');
  var g = await H.ev("(function(){var tr=document.querySelector('#tmain tr[data-row]');return tr?tr.textContent:'';})()");
  assert(g.indexOf('J4') >= 0 && g.indexOf('空的') >= 0 && g.indexOf('沒有期限') >= 0 && g.indexOf('通：') >= 0, '引路人一直掛著教學用的公告（需要：空的；可以給：空的；沒有期限），標我通他的條件');
  // 1. 掛公告：需要、種類、可以給（從自己的資源表選，可以多樣）、上限、期限
  await H.setIn('ntNeed', '修腳踏車'); await H.setIn('ntKind', '修理');
  await H.check('#tmain [data-give="r1a"]', true); await H.check('#tmain [data-give="r1b"]', true);
  await H.setIn('ntCap', 4);
  var until = await H.ev("CORE.dayLabel(CORE.dayNum(APP.now())+5)"); await H.setIn('ntUntil', until);
  await H.clickText('掛上去', '#tmain');
  var n = await H.ev("JSON.stringify(APP.state().notices.filter(function(n){return n.owner==='" + J1 + "';}).map(function(n){return [n.need,n.kind,n.give,n.cap,CORE.dayLabel(n.untilDay)];}))");
  assert(n === JSON.stringify([['修腳踏車', '修理', ['r1a', 'r1b'], 4, until]]) && (await H.msg()) === '公告掛上去了', '掛上去了：需要、種類、可以給兩樣、上限 4 人、掛到 ' + until);
  var mineRow = await H.ev("document.querySelector('#tmain tr.mine').textContent");
  assert(mineRow.indexOf('J1') >= 0 && mineRow.indexOf('陪跑一小時、早餐一頓') >= 0 && mineRow.indexOf('最多 4 人') >= 0 && mineRow.indexOf('掛到 ' + until) >= 0 && mineRow.indexOf('自己') >= 0, '公告一列寫序號、需要、可以給、上限、期限');
  await H.setIn('ntNeed', ''); await H.clickText('掛上去', '#tmain'); assert((await H.msg()).indexOf('寫一句你需要什麼') >= 0, '沒寫需要就掛不上去');
  // 別人也掛一張（阿澄），看通不通
  await H.ev("(function(){var S=APP.state();CORE.postNotice(S,'" + J2 + "',{need:'想學跑步',kind:'運動',give:['r2b'],cap:2},APP.now());CORE.postNotice(S,'" + J3 + "',{need:'有人幫我搬書嗎',kind:'',give:['r3a'],cap:3},APP.now());APP.changed();})()");
  assert((await H.rows('notices')) === 4, '全部的公告：四張');
  await H.clickText('我的公告', '#tmain'); assert((await H.rows('notices')) === 1, '我的公告：只有自己的一張');
  await H.clickText('全部的公告', '#tmain'); await H.edit('#tmain select[data-ed="kind"]', '運動'); assert((await H.rows('notices')) === 1 && (await H.main()).indexOf('想學跑步') >= 0, '篩種類「運動」');
  await H.edit('#tmain select[data-ed="kind"]', '');
  // 通不通跟預約用同一個判斷：小樂要兩方都通、要接受家規 → 我不通
  var row3 = await H.ev("Array.from(document.querySelectorAll('#tmain tr[data-row]')).find(function(t){return t.textContent.indexOf('搬書')>=0;}).textContent");
  var e3 = await H.ev("CORE.eligible(APP.state(),CORE.roleOf(APP.state(),'" + J3 + "'),APP.me(),APP.now())");
  assert(!e3.ok && row3.indexOf('不通：' + e3.reason) >= 0 && row3.indexOf('家規') >= 0, '小樂的公告標「不通」，原因跟預約用的判斷一樣：' + e3.reason);
  var row2 = await H.ev("Array.from(document.querySelectorAll('#tmain tr[data-row]')).find(function(t){return t.textContent.indexOf('學跑步')>=0;}).textContent");
  assert(row2.indexOf('通：') >= 0, '阿澄的公告標「通」');
  // 2. 搜尋：公告和資源表一起查
  await H.setIn('kwIn', '跑'); await H.clickText('查', '#tmain');
  assert((await H.rows('notices')) === 2, '搜「跑」：我的公告（可以給陪跑一小時）、阿澄的公告（需要：想學跑步）');
  await H.setIn('kwIn', '修理'); await H.clickText('查', '#tmain'); assert((await H.rows('notices')) === 1 && (await H.main()).indexOf('修腳踏車') >= 0, '搜種類「修理」');
  await H.setIn('kwIn', '借'); await H.clickText('查', '#tmain');
  assert((await H.rows('notices')) === 1 && (await H.main()).indexOf('別人資源表裡有「借」的有 1 筆') >= 0, '搜「借」：小樂的公告（可以給借一本書），別人資源表裡也有一筆');
  await H.clickText('到找人看', '#tmain');
  assert((await H.sheetName()) === 'find' && (await H.ev("document.getElementById('kwIn').value")) === '借', '到找人：搜尋框共用');
  var f = await H.main();
  assert(f.indexOf('公告') >= 0 && f.indexOf('資源') >= 0 && f.indexOf('借一本書') >= 0 && (await H.rows('find')) === 2, '找人一起列出公告和資源（就是查資源）');
  await H.clickText('清掉', '#tmain'); assert((await H.ev("document.getElementById('kwIn').value")) === '' && (await H.main()).indexOf('每天的點') >= 0, '清掉搜尋就回到找人');
  await H.clickText('全部', '#tmain'); assert((await H.rows('find')) === 3, '找人：全部（不含自己）三個人');
  await H.clickText('可能來找我', '#tmain'); var come = await H.rows('find'); await H.clickText('我可以去找', '#tmain'); var visit = await H.rows('find');
  assert(come === (await H.ev("CORE.canCome(APP.state(),APP.me(),APP.now()).length")) && visit === (await H.ev("CORE.canVisit(APP.state(),APP.me(),APP.now()).length")), '我可以去找 ' + visit + ' 人、可能來找我 ' + come + ' 人');
  // 3. 點序號跳過去（引路人）
  await H.nav('notices'); await H.setIn('kwIn', '空的'); await H.clickText('查', '#tmain');
  await H.finger("function(){ return document.querySelector('#tmain tr[data-row] button.lk[data-id=\"" + J4 + "\"]'); }", '引路人的序號');
  assert((await H.sheetName()) === 'other:role' && (await pg.textContent('#tother')).indexOf('J4 引路人') >= 0, '點公告上的序號就到他的表格世界');
  await H.clickText('回我自己', '#tother');
  // 4. 撤掉
  await H.nav('notices'); await H.clickText('清掉', '#tmain'); await H.clickText('撤掉', '#tmain');
  assert((await H.ev("APP.state().notices.filter(function(n){return n.owner==='" + J1 + "';}).length")) === 0 && (await H.msg()) === '撤掉了', '撤掉自己的公告');
  assert((await H.ev("document.querySelectorAll('#tmain tr[data-row] [data-act=\"unpost\"]').length")) === 0, '別人的公告沒有撤掉鈕');
  // 5. 過了期限自動拿掉
  await H.ev("(function(){var S=APP.state();var n=S.notices.find(function(x){return x.owner==='" + J2 + "';});n.untilDay=CORE.dayNum(APP.now())-1;APP.changed();})()");
  await pg.waitForTimeout(200); assert((await H.ev("APP.state().notices.some(function(x){return x.owner==='" + J2 + "';})")) === false, '過了期限自動拿掉');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
