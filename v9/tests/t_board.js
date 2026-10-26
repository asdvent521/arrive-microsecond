// 公告欄：引路人的教學公告；掛公告（需要、種類、可以給、上限、期限）、沒寫需要掛不上去；通不通跟約的判斷一樣；找（公告和別人的資源表一起找、幾張幾人）；點序號到他的那張紙；撤掉；過了期限自動拿掉。
// node v9/tests/t_board.js <test9.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003', J4 = '00000000004';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  var nrows = function () { return H.ev("document.querySelectorAll('#tmain table tr[data-row]:not([data-id=\"post\"])').length - document.querySelectorAll('#tmain table:nth-of-type(2) tr[data-row]').length"); };
  var prow = function () { return H.ev("document.querySelectorAll('#tmain table:nth-of-type(2) tr[data-row]').length"); };
  await H.nav('find');
  var g = await H.ev("(function(){var tr=document.querySelector('#tmain tr[data-row]:not([data-id=\"post\"])');return tr?tr.textContent:'';})()");
  assert(g.indexOf('J4') >= 0 && g.indexOf('空的') >= 0 && g.indexOf('沒有期限') >= 0 && g.indexOf('通') >= 0 && g.indexOf('約他') >= 0, '引路人一直掛著教學用的公告（需要：空的；可以給：空的；沒有期限），標我通他的條件、有「約他」');
  assert((await H.ev("document.querySelector('#tmain tr[data-id=\"post\"]').textContent")).indexOf('J1') >= 0 && (await H.ev("!!document.querySelector('#tmain tr[data-id=\"post\"] [data-act=\"post\"]')")), '第一行是自己的：寫好按「掛上去」');
  // 1. 掛公告：需要、種類、可以給（從自己的資源表勾，可以多樣）、上限、期限
  await H.setIn('ntNeed', '修腳踏車'); assert((await H.ev("document.getElementById('ntCat').options[0].textContent")) === '自動：修理／腳踏車機車', '打需要的時候，類別下拉的「自動」跟著顯示會選到哪一個小類（修理／腳踏車機車）');
  await H.setIn('ntTags', '修理 週末');
  await H.check('#tmain [data-give="r1a"]', true); await H.check('#tmain [data-give="r1b"]', true);
  await H.setIn('ntCap', 4);
  var until = await H.ev("CORE.dayLabel(CORE.dayNum(APP.now())+5)"); await H.setIn('ntUntil', until);
  await H.clickText('掛上去', '#tmain');
  var n = await H.ev("JSON.stringify(APP.state().notices.filter(function(n){return n.owner==='" + J1 + "';}).map(function(n){return [n.need,n.tags,n.cat,n.give,n.cap,CORE.dayLabel(n.untilDay)];}))");
  assert(n === JSON.stringify([['修腳踏車', ['修理', '週末'], 'bike', ['r1a', 'r1b'], 4, until]]) && (await H.msg()) === '公告掛上去了', '掛上去了：需要、兩個標籤、類別自動選（修理／腳踏車機車）、可以給兩樣、上限 4 人、掛到 ' + until);
  var mineRow = await H.ev("document.querySelector('#tmain tr.mine').textContent"), md = await H.ev("(function(){var l='" + until + "';return (+l.slice(5,7))+'/'+(+l.slice(8,10));})()");
  assert(mineRow.indexOf('J1') >= 0 && mineRow.indexOf('修腳踏車') >= 0 && (await H.ev("document.querySelector('#tmain tr.mine [data-ed=noticeCat]').value")) === 'bike' && (await H.ev("document.querySelector('#tmain tr.mine [data-ed=noticeTags]').value")) === '修理 週末' && mineRow.indexOf('陪跑一小時、早餐一頓') >= 0 && mineRow.indexOf('最多 4 人') >= 0 && mineRow.indexOf(md) >= 0 && mineRow.indexOf('撤掉') >= 0, '公告一行寫序號、需要、種類、可以給、上限、期限，自己的有「撤掉」');
  await H.setIn('ntNeed', ''); await H.clickText('掛上去', '#tmain'); assert((await H.msg()).indexOf('寫一句你需要什麼') >= 0, '沒寫需要就掛不上去');
  // 別人也掛（阿澄、小樂），看通不通：跟約的判斷用同一個
  await H.ev("(function(){var S=APP.state();CORE.postNotice(S,'" + J2 + "',{need:'想學跑步',kind:'運動',give:['r2b'],cap:2},APP.now());CORE.postNotice(S,'" + J3 + "',{need:'有人幫我搬書嗎',kind:'',give:['r3a'],cap:3},APP.now());APP.changed();})()");
  assert((await nrows()) === 7, '全部的公告：七張（引路人、我、阿澄、小樂，加示範那條鏈的三張）');
  var row3 = await H.ev("Array.from(document.querySelectorAll('#tmain tr[data-row]')).find(function(t){return t.textContent.indexOf('搬書')>=0;}).textContent");
  var e3 = await H.ev("CORE.eligible(APP.state(),CORE.roleOf(APP.state(),'" + J3 + "'),APP.me(),APP.now())");
  assert(!e3.ok && row3.indexOf('不通：' + e3.reason) >= 0 && row3.indexOf('家規') >= 0, '小樂的公告標「不通」，原因跟約的判斷一樣：' + e3.reason);
  var row2 = await H.ev("Array.from(document.querySelectorAll('#tmain tr[data-row]')).find(function(t){return t.textContent.indexOf('學跑步')>=0;}).textContent");
  assert(row2.indexOf('通') >= 0 && row2.indexOf('不通') < 0 && row2.indexOf('約他') >= 0 && row2.indexOf('接上去') >= 0, '阿澄的公告標「通」、有「約他」和「接上去」（第 6 輪）');
  // 2. 找：公告和別人的資源表一起找；「我在找」比別人可以給的，「我能給」比別人的需要
  await H.setIn('kwIn', '跑'); await H.clickText('找', '#tmain');
  assert((await nrows()) === 1 && (await H.main()).indexOf('公告 1 張') >= 0 && (await H.main()).indexOf('完全對上「跑」') >= 0, '「我在找」找「跑」：只有我的公告（可以給陪跑一小時），寫怎麼對上的');
  await H.clickText('我能給', '#tmain'); assert((await nrows()) === 2 && (await H.main()).indexOf('想學跑步') >= 0 && (await H.main()).indexOf('誰的資源表裡有') < 0, '切到「我能給」：多了阿澄的公告（需要：想學跑步）；不列資源表');
  await H.clickText('我在找', '#tmain');
  await H.setIn('kwIn', '修理'); await H.clickText('找', '#tmain'); assert((await nrows()) === 1 && (await H.main()).indexOf('修腳踏車') >= 0, '找標籤「修理」');
  await H.setIn('kwIn', '借'); await H.clickText('找', '#tmain');
  assert((await nrows()) === 1 && (await prow()) === 1 && (await H.main()).indexOf('誰的資源表裡有「借」') >= 0 && (await H.main()).indexOf('借一本書') >= 0 && (await H.main()).indexOf('公告 1 張・資源表 1 人') >= 0, '找「借」：小樂的公告（可以給借一本書）、下半張小樂的資源表裡有借一本書；寫公告 1 張・資源表 1 人');
  await H.clickText('清掉', '#tmain'); assert((await H.ev("document.getElementById('kwIn').value")) === '' && (await prow()) === 3 && (await H.main()).indexOf('還有') < 0 && (await H.main()).indexOf('誰的資源表裡有東西') >= 0, '清掉：下半張列全部的人（公告多的時候列三個、寫還有 1 人）');
  var people = await H.ev("Array.from(document.querySelectorAll('#tmain table:nth-of-type(2) tr[data-row]')).map(function(t){return t.textContent;})");
  assert(people.some(function (t) { return t.indexOf('阿澄') >= 0 && t.indexOf('改履歷・100') >= 0 && t.indexOf('通') >= 0; }) && people.some(function (t) { return t.indexOf('小樂') >= 0 && t.indexOf('不通') >= 0; }), '每個人：他有什麼（東西・價錢）、下一個時段、約他、通不通');
  // 3. 點序號到他的那張紙（引路人）
  await H.setIn('kwIn', '空的'); await H.clickText('找', '#tmain');
  await H.finger("function(){ return document.querySelector('#tmain tr[data-row] button.lk[data-id=\"" + J4 + "\"]'); }", '引路人的序號');
  assert((await H.sheetName()) === 'other:res' && (await pg.textContent('#tother')).indexOf('J4 引路人') >= 0, '點公告上的序號就到他的資源表那張紙');
  await H.clickText('回我自己', '#tother');
  // 4. 撤掉
  await H.nav('find'); await H.clickText('清掉', '#tmain'); await H.clickText('撤掉', '#tmain');
  assert((await H.ev("APP.state().notices.filter(function(n){return n.owner==='" + J1 + "';}).length")) === 0 && (await H.msg()) === '撤掉了', '撤掉自己的公告');
  assert((await H.ev("document.querySelectorAll('#tmain tr[data-row] [data-act=\"unpost\"]').length")) === 0, '別人的公告沒有撤掉鈕');
  // 5. 過了期限自動拿掉
  await H.ev("(function(){var S=APP.state();var n=S.notices.find(function(x){return x.owner==='" + J2 + "'&&x.need==='想學跑步';});n.untilDay=CORE.dayNum(APP.now())-1;APP.changed();})()");
  await pg.waitForTimeout(200); assert((await H.ev("APP.state().notices.some(function(x){return x.owner==='" + J2 + "'&&x.need==='想學跑步';})")) === false, '過了期限自動拿掉');
  // 6. 期限（補二十）：預設今天起 30 天、不能超過；續掛；每人最多 5 張；到期前 3 天事件簿提醒
  await H.nav('find');
  var d30 = await H.ev("CORE.dayLabel(CORE.dayNum(APP.now())+30)");
  assert((await H.ev("document.getElementById('ntUntil').value")) === d30 && (await H.ev("document.getElementById('ntUntil').max")) === d30, '掛公告的期限預設今天起 30 天，最多也是 30 天');
  await H.setIn('ntNeed', '想借梯子'); await H.setIn('ntUntil', await H.ev("CORE.dayLabel(CORE.dayNum(APP.now())+40)")); await H.check('#tmain [data-give="r1a"]', true); await H.clickText('掛上去', '#tmain');
  assert((await H.msg()).indexOf('最多掛到今天起 30 天') >= 0, '超過 30 天擋下');
  await H.setIn('ntNeed', '想借梯子'); await H.setIn('ntUntil', ''); await H.check('#tmain [data-give="r1a"]', true); await H.clickText('掛上去', '#tmain'); assert((await H.msg()).indexOf('要寫掛到哪一天') >= 0, '期限空的擋下');
  await H.setIn('ntNeed', '想借梯子'); await H.setIn('ntUntil', await H.ev("CORE.dayLabel(CORE.dayNum(APP.now())+2)")); await H.check('#tmain [data-give="r1a"]', true); await H.clickText('掛上去', '#tmain'); assert((await H.msg()) === '公告掛上去了', '2 天後到期的掛上去了');
  var nid = await H.ev("APP.state().notices.filter(function(n){return n.owner==='" + J1 + "';})[0].id");
  await H.finger("function(){ return document.querySelector('#tmain tr.mine [data-act=\"renew\"]'); }", '續掛');
  assert((await H.ev("APP.state().notices.find(function(n){return n.id==='" + nid + "';}).untilDay")) === (await H.ev("CORE.dayNum(APP.now())+30")) && (await H.msg()).indexOf('續掛了，掛到 ' + d30) >= 0, '自己的公告旁邊「續掛」：期限變成今天起 30 天');
  await H.ev("(function(){var S=APP.state(),t=APP.now();for(var i=2;i<=5;i++)CORE.postNotice(S,'" + J1 + "',{need:'第 '+i+' 張',give:['r1a'],cap:2},t);APP.changed();})()"); await H.nav('find');
  assert((await H.ev("document.querySelector('#tmain tr[data-id=\"post\"]').textContent")).indexOf('已經掛了 5 張') >= 0, '第一行寫已經掛了 5 張');
  await H.setIn('ntNeed', '第 6 張'); await H.check('#tmain [data-give="r1a"]', true); await H.clickText('掛上去', '#tmain');
  assert((await H.msg()) === '你已經掛了 5 張，先撤掉一張或等它到期', '掛滿 5 張：說「你已經掛了 5 張，先撤掉一張或等它到期」');
  await H.ev("(function(){var S=APP.state();var n=S.notices.find(function(x){return x.id==='" + nid + "';});n.untilDay=CORE.dayNum(APP.now())+3;APP.changed();})()"); await H.nav('log');
  assert((await H.main()).indexOf('你的公告「想借梯子」3 天後到期，要續掛嗎') >= 0 && (await H.ev("!!document.querySelector('#tmain [data-act=\"renew\"]')")), '到期前 3 天事件簿最上面提醒，旁邊「續掛」');
  await H.finger("function(){ return document.querySelector('#tmain [data-act=\"renew\"]'); }", '提醒旁邊的續掛');
  assert((await H.ev("APP.state().notices.find(function(n){return n.id==='" + nid + "';}).untilDay")) === (await H.ev("CORE.dayNum(APP.now())+30")) && (await H.main()).indexOf('要續掛嗎') < 0, '續掛了，提醒不見');
  // 7. 食物的供需（補二十一）：找的框上面一行；點「需要」切到我能給並篩食物、點「可以給」切到我在找並篩食物；缺的時候紅字；名字後面有括弧
  await H.nav('find');
  var fl = await H.ev("document.getElementById('foodLine').textContent");
  assert(fl.indexOf('食物：') === 0 && fl.indexOf('需要 0 張') >= 0 && fl.indexOf('可以給 1 人') >= 0 && !(await H.ev("document.getElementById('foodLine').classList.contains('warn')")), '找的框上面一行「食物：需要 0 張・可以給 1 人」（我的早餐一頓算食物），不缺不紅：' + fl);
  await H.ev("(function(){var S=APP.state(),t=APP.now();CORE.postNotice(S,'" + J2 + "',{need:'想吃便當',give:['r2b'],cap:2},t);CORE.postNotice(S,'" + J3 + "',{need:'想要一袋水果',give:['r3a'],cap:2},t);APP.changed();})()"); await H.nav('find');
  fl = await H.ev("document.getElementById('foodLine').textContent"); assert(fl.indexOf('需要 2 張') >= 0 && fl.indexOf('可以給 1 人') >= 0 && (await H.ev("document.getElementById('foodLine').classList.contains('warn')")), '兩張食物的公告：需要 2 張・可以給 1 人，需要比可以給多 → 紅字');
  await H.finger("function(){ return document.querySelector('#foodLine [data-act=\"foodNeed\"]'); }", '需要');
  var rows7 = await H.ev("Array.from(document.querySelectorAll('#tmain table:nth-of-type(1) tr[data-row]:not([data-id=\"post\"])')).map(function(t){return t.textContent;})");
  assert((await H.ev("document.querySelector('#tmain .modes [data-m=\"give\"]').getAttribute('aria-pressed')")) === 'true' && (await H.ev("document.querySelector('#catBar [data-id=\"food\"]').classList.contains('o')")) === false && rows7.length === 2 && rows7.every(function (r) { return r.indexOf('便當') >= 0 || r.indexOf('水果') >= 0; }), '點「需要」：切到「我能給」、篩食物，只剩兩張食物的需要');
  assert(rows7.some(function (r) { return r.indexOf('阿澄（聊天傾聽）') >= 0; }), '公告上的名字後面有括弧（補二十一）');
  await H.finger("function(){ return document.querySelector('#foodLine [data-act=\"foodGive\"]'); }", '可以給');
  assert((await H.ev("document.querySelector('#tmain .modes [data-m=\"want\"]').getAttribute('aria-pressed')")) === 'true' && (await H.ev("document.querySelector('#catBar [data-id=\"food\"]').classList.contains('o')")) === false && (await H.main()).indexOf('誰的資源表裡有「食物」') >= 0, '點「可以給」：切到「我在找」並篩食物');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
