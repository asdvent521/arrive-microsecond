// 公告欄的分類和找（補十九）：12 個大類的鈕、點了展開小類、「我在找」／「我能給」、打字找近似詞（看到「近似：…」）、打錯字、超過 5 張全部捲得到、「我能給」點接上去、掛公告看得到自動選的小類、改類別、資源表的類別欄；直放和轉橫各截一張
// node v9/tests/t_find.js <test9.html> [截圖資料夾]
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003', J4 = '00000000004', J5 = '00000000005';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg, OUT = process.argv[3];
  await H.fresh();
  var nrows = function () { return H.ev("document.querySelectorAll('#tmain table:nth-of-type(1) tr[data-row]:not([data-id=\"post\"])').length"); };
  var people = function () { return H.ev("Array.from(document.querySelectorAll('#tmain table:nth-of-type(2) tr[data-row]')).map(function(t){return t.textContent;})"); };
  var catBtns = function (bar) { return H.ev("Array.from(document.querySelectorAll('#" + bar + " button')).map(function(b){return b.textContent+(b.classList.contains('o')?'':'*');})"); };
  // 別人的資源表今天就有這些東西（直接放進今天的版本）；別人掛幾張公告
  await H.ev("(function(){var S=APP.state(),t=APP.now();function put(serial,id,name,def,price,avail,cat){var r=CORE.roleOf(S,serial),v=CORE.version(r,t);v.resources.push({id:id,name:name,def:def,kind:'thing',cat:cat||CORE.classify(name,def),tags:[],price:price,keepDays:3});r.stock[id]={avail:avail,reserved:0};}" +
    "put('" + J2 + "','f2a','便當一個','今天做的',30,2);put('" + J3 + "','f3a','炒麵一盤','',25,1);put('" + J5 + "','f5a','水電修理','換燈泡、修水龍頭',80,3);put('" + J5 + "','f5b','蛋糕','',20,1,'bento');" +
    "CORE.postNotice(S,'" + J2 + "',{need:'想吃便當',give:['r2b'],cap:2},t);CORE.postNotice(S,'" + J3 + "',{need:'修水管',give:['r3a'],cap:2},t);APP.changed();})()");
  await H.nav('find');
  // 1. 找的框下面一排 12 個大類的鈕（加「全部」）；點了展開小類；再點一次收起來
  var bigs = await catBtns('catBar');
  assert(bigs.length === 13 && bigs[0] === '全部*' && bigs.slice(1).join() === '食物,修理,搬運力氣,接送跑腿,教學,諮詢文書,陪伴,照顧,健康運動,用品借用,手作創作,娛樂' && (await H.ev("!document.getElementById('subBar')")), '找的框下面一排 12 個大類的鈕（「全部」亮著），還沒展開小類');
  var hs = await H.ev("Array.from(document.querySelectorAll('#catBar button')).map(function(b){return Math.round(b.getBoundingClientRect().height);})");
  assert(hs.length === 13 && hs.every(function (h) { return h >= 32; }), '大類的鈕至少 32px 高（第 10 輪）：' + hs.join());
  await H.clickText('食物', '#catBar');
  var subs = await catBtns('subBar');
  assert(subs.join() === '便當熟食,代煮一餐,生鮮食材,農產自種,烘焙點心,飲料,食譜做法' && (await catBtns('catBar'))[1] === '食物*', '點「食物」：展開 7 個小類，食物那顆亮著');
  var ppl = await people();
  assert(ppl.length === 3 && ppl.some(function (x) { return x.indexOf('阿澄') >= 0 && x.indexOf('便當一個') >= 0 && x.indexOf('類別：食物') >= 0; }) && ppl.some(function (x) { return x.indexOf('小樂') >= 0 && x.indexOf('炒麵一盤') >= 0; }) && ppl.some(function (x) { return x.indexOf('阿明') >= 0 && x.indexOf('蛋糕') >= 0 && x.indexOf('水電修理') < 0; }) && ppl.every(function (x) { return x.indexOf('改履歷') < 0; }), '照大類篩：資源表只剩食物類的東西（便當、炒麵、蛋糕），每筆寫「類別：食物」');
  assert((await H.main()).indexOf('誰的資源表裡有「食物」') >= 0 && (await nrows()) === 0, '標題寫「誰的資源表裡有「食物」」；「我在找」沒有可以給食物的公告');
  await H.clickText('便當熟食', '#subBar');
  ppl = await people(); assert(ppl.length === 3 && ppl.every(function (x) { return x.indexOf('食物／便當熟食') >= 0; }), '點小類「便當熟食」：便當、炒麵、蛋糕都掛在這一小類');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_find_1_cats_landscape.png', fullPage: true });
  await H.clickText('食物', '#catBar'); assert((await H.ev("!document.getElementById('subBar')")) && (await catBtns('catBar'))[0] === '全部*', '再點一次「食物」：收起來、回到全部');
  // 2. 打字找近似詞：找「飯」看到「近似：飯 → 便當」；簡繁、字顛倒；每筆寫怎麼對上的、照順序排
  await H.setIn('kwIn', '飯'); await H.clickText('找', '#tmain');
  ppl = await people(); assert(ppl.length === 3 && ppl[0].indexOf('便當一個') >= 0 && ppl[0].indexOf('近似：飯 → 便當') >= 0 && ppl[1].indexOf('近似：飯 → 炒麵') >= 0 && ppl[2].indexOf('蛋糕') >= 0 && ppl[2].indexOf('同類：食物／便當熟食') >= 0, '找「飯」：便當（近似：飯 → 便當）、炒麵（近似）、蛋糕（同類：食物／便當熟食）都找得到，近似的在前、同類的在後：' + ppl.join(' | '));
  await H.setIn('kwIn', '电水'); await H.clickText('找', '#tmain');
  ppl = await people(); assert(ppl.length === 1 && ppl[0].indexOf('水電修理') >= 0 && ppl[0].indexOf('打錯字：电水 → 水電') >= 0, '簡體加字顛倒「电水」：找得到阿明的水電修理，寫「打錯字：电水 → 水電」（寫自己打的字、對到的原字）');
  await H.setIn('kwIn', '便当'); await H.clickText('找', '#tmain');
  ppl = await people(); assert(ppl.length === 3 && ppl[0].indexOf('便當一個') >= 0 && ppl[0].indexOf('完全對上「便当」') >= 0 && ppl[2].indexOf('同類') >= 0, '簡體「便当」算完全對上（排最前面，寫自己打的字），近似、同類排後面');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_find_2_near_landscape.png', fullPage: true });
  // 3. 「我能給」：列別人的需要，旁邊「接上去」；點了跳出接上去的框，裡面有類別和標籤
  await H.clickText('我能給', '#tmain');
  var rows = await H.ev("Array.from(document.querySelectorAll('#tmain table:nth-of-type(1) tr[data-row]:not([data-id=\"post\"])')).map(function(t){return t.textContent;})");
  assert(rows.length === 1 && rows[0].indexOf('想吃便當') >= 0 && rows[0].indexOf('接上去') >= 0 && rows[0].indexOf('食物／便當熟食') >= 0 && (await H.main()).indexOf('誰的資源表裡有') < 0, '「我能給」找「便当」：阿澄的需要「想吃便當」（掛在食物／便當熟食），旁邊「接上去」；不列資源表');
  await H.finger("function(){ return document.querySelector('#tmain tr[data-row] [data-act=\"link\"]'); }", '接上去');
  assert((await H.popOpen()) && (await H.popTitle()).indexOf('接到 阿澄 的公告下面') >= 0 && (await H.ev("!!document.getElementById('lCat') && !!document.getElementById('lTags')")), '跳出接上去的框，裡面有類別下拉和標籤格');
  await H.ev("document.getElementById('lNeed').value='想找人練英文'; document.getElementById('lNeed').dispatchEvent(new Event('input',{bubbles:true}));");
  assert((await H.ev("document.getElementById('lCat').options[0].textContent")) === '自動：教學／語言', '框裡打需要，「自動」那一項跟著顯示教學／語言');
  await H.ev("document.getElementById('lTags').value='晚上'");
  await H.popOk('接上去');
  var ln = await H.ev("JSON.stringify((function(){var n=APP.state().notices.find(function(x){return x.owner==='" + J1 + "';});return n?[n.need,n.cat,n.tags,n.parent.side]:null;})())");
  assert(ln === JSON.stringify(['想找人練英文', 'lang', ['晚上'], 'need']), '接上去了：需要、類別自動（教學／語言）、標籤、接在需要下面');
  await H.clickText('我在找', '#tmain'); await H.clickText('清掉', '#tmain');
  // 4. 超過 5 張全部捲得到：阿明再掛 8 張，公告全部列出來（不限 5 張），紙往下長，最後一張的「約他」手指按得到
  await H.ev("(function(){var S=APP.state(),t=APP.now();for(var i=1;i<=4;i++)CORE.postNotice(S,'" + J5 + "',{need:'第 '+i+' 張：想借梯子',give:['r5a'],cap:2},t);for(i=1;i<=3;i++)CORE.postNotice(S,'" + J2 + "',{need:'阿澄第 '+i+' 張：想借梯子',give:['r2a'],cap:2},t);for(i=1;i<=3;i++)CORE.postNotice(S,'" + J3 + "',{need:'小樂第 '+i+' 張：想借梯子',give:['r3a'],cap:2},t);APP.changed();})()");
  var total = await H.ev("APP.state().notices.length");
  assert((await nrows()) === total && total >= 14 && (await H.main()).indexOf('公告 ' + total + ' 張') >= 0 && (await H.ev("document.querySelector('.page').classList.contains('grow')")), '沒打詞：' + total + ' 張公告全部列出來，紙往下長');
  await H.finger("function(){ var bs=document.querySelectorAll('#tmain table:nth-of-type(1) tr[data-row] [data-act=\"bookNext\"]'); return bs[bs.length-1]; }", '最後一張的「約他」');
  assert(H.errs.length === 0, '捲到最下面那張，「約他」手指按得到（捲過去、沒被蓋住）');
  await H.nav('find');
  // 5. 掛公告：打需要時看得到自動選的小類；可以改；加標籤；掛上去以後自己那一行可以改類別
  await H.setIn('ntNeed', '幫忙修水龍頭');
  assert((await H.ev("document.getElementById('ntCat').options[0].textContent")) === '自動：修理／水電', '打「幫忙修水龍頭」：自動選到修理／水電');
  await H.setIn('ntNeed', '一件很特別的事'); assert((await H.ev("document.getElementById('ntCat').options[0].textContent")) === '自動：判斷不出來，不掛', '判斷不出來就寫不掛');
  await H.setIn('ntNeed', '幫忙修水龍頭'); await H.setIn('ntTags', '#急 週末');
  await H.check('#tmain [data-give="r1a"]', true); await H.clickText('掛上去', '#tmain');
  var mine = await H.ev("JSON.stringify((function(){var n=APP.state().notices.filter(function(x){return x.owner==='" + J1 + "'&&!x.parent;})[0];return n?[n.need,n.cat,n.tags]:null;})())");
  assert(mine === JSON.stringify(['幫忙修水龍頭', 'plumb', ['急', '週末']]), '掛上去：類別修理／水電、兩個標籤（# 拿掉）');
  var mid = await H.ev("APP.state().notices.filter(function(x){return x.owner==='" + J1 + "'&&!x.parent;})[0].id");
  await H.edit('#tmain [data-ed="noticeCat"][data-id="' + mid + '"]', 'appliance');
  assert((await H.ev("APP.state().notices.find(function(x){return x.id==='" + mid + "';}).cat")) === 'appliance' && (await H.msg()) === '改了', '自己那一行改類別成修理／家電');
  await H.edit('#tmain [data-ed="noticeTags"][data-id="' + mid + '"]', 'a b c d');
  assert((await H.msg()).indexOf('標籤最多 3 個') >= 0 && (await H.ev("APP.state().notices.find(function(x){return x.id==='" + mid + "';}).tags.join()")) === '急,週末', '標籤打 4 個：擋下，原本的不動');
  // 6. 資源表那張紙多一欄類別：自己的是下拉和標籤格；在空白那一行寫「手工餅乾」就自動掛烘焙點心；改類別
  await H.nav('res');
  assert((await H.ev("document.querySelector('#tmain th:nth-child(4)').textContent")).indexOf('類別') >= 0 && (await H.ev("!!document.querySelector('#tmain [data-ed=\"resCat\"][data-id=\"r1a\"]')")), '資源表第 4 欄是類別，自己的每一行有下拉');
  await H.edit('#tmain [data-new="res"]', '手工餅乾');
  var newId = await H.ev("(function(){var v=CORE.pending(APP.me(),APP.now());var x=v.resources.find(function(y){return y.name==='手工餅乾';});return x?x.id+':'+x.cat:null;})()");
  assert(newId && newId.split(':')[1] === 'bake' && (await H.ev("document.querySelector('#tmain [data-ed=\"resCat\"][data-id=\"" + newId.split(':')[0] + "\"]').value")) === 'bake', '寫「手工餅乾」：自動掛食物／烘焙點心，下拉顯示出來');
  await H.edit('#tmain [data-ed="resCat"][data-id="' + newId.split(':')[0] + '"]', 'drink');
  assert((await H.ev("CORE.pending(APP.me(),APP.now()).resources.find(function(y){return y.id==='" + newId.split(':')[0] + "';}).cat")) === 'drink' && (await H.msg()) === '改了，明天起算', '改成飲料（明天起算）');
  await H.edit('#tmain [data-ed="resTags"][data-id="' + newId.split(':')[0] + '"]', '素食, 早上');
  assert((await H.ev("CORE.pending(APP.me(),APP.now()).resources.find(function(y){return y.id==='" + newId.split(':')[0] + "';}).tags.join()")) === '素食,早上', '標籤用逗點分也行');
  await H.serial('J2'); assert((await pg.textContent('#tother')).indexOf('J2 阿澄') >= 0 && (await H.main()).indexOf('諮詢文書／履歷求職') >= 0 && (await H.ev("!document.querySelector('#tmain [data-ed=\"resCat\"]')")), '看他的資源表：改履歷掛在諮詢文書／履歷求職（看得到、不能改）'); await H.clickText('回我自己', '#tother');
  // 7. 直放：大類的鈕、小類、列表都排得下（不會橫向爆出紙外）；截一張
  await pg.setViewportSize({ width: 360, height: 780 }); await pg.waitForTimeout(200); await H.nav('find');
  await H.clickText('修理', '#catBar'); await H.setIn('kwIn', '水'); await H.clickText('找', '#tmain');
  var fit = await H.ev("(function(){var p=document.querySelector('.page'),w=p.getBoundingClientRect().width,bad=[];p.querySelectorAll('#catBar,#subBar,.fields,table').forEach(function(el){var b=el.getBoundingClientRect();if(b.right-p.getBoundingClientRect().left>w+1)bad.push(el.id||el.tagName);});return {w:w,bad:bad,subs:document.querySelectorAll('#subBar button').length};})()");
  assert(fit.bad.length === 0 && fit.subs === 7, '直放：大類、小類、找的框、表都在紙裡（' + fit.w + 'px）' + (fit.bad.length ? '，爆出去的：' + fit.bad.join() : ''));
  var hs2 = await H.ev("Array.from(document.querySelectorAll('#catBar button, #subBar button')).map(function(b){return Math.round(b.getBoundingClientRect().height);})");
  assert(hs2.every(function (h) { return h >= 32; }), '直放時大類、小類的鈕也至少 32px 高：' + hs2.join());
  if (OUT) await pg.screenshot({ path: OUT + '/v9_find_3_portrait.png', fullPage: true });
  await pg.setViewportSize({ width: 780, height: 360 }); await pg.waitForTimeout(200);
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
