// 整條鏈：分支樹（補二十）。打開是一整頁不是彈出框；起頭在最上面、接上來的往下、岔路並排寫「第 1 條」「第 2 條」；線上的字對；一圈亮起來、彎回起點；「接在這裡」點了能接上去；自己的卡片寫「你」、打開時捲到自己；圈主有開時段、其他人有約；狀態；直放和轉橫各截一張
// node v9/tests/t_tree.js <test9.html> [截圖資料夾]
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003', J5 = '00000000005';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg, OUT = process.argv[3];
  await H.fresh();
  var cards = function () { return H.ev("Array.from(document.querySelectorAll('#tmain .tcard')).map(function(c){return c.textContent.replace(/\\s+/g,' ').trim();})"); };
  var edges = function () { return H.ev("Array.from(document.querySelectorAll('#tmain .te')).map(function(e){return e.textContent.replace(/\\s+/g,' ').trim();})"); };
  // 1. 示範那條鏈：從公告欄點「整條鏈」打開一整頁
  await H.nav('find');
  var root = await H.ev("APP.state().notices.find(function(n){return n.need==='想學手機拍照';}).id");
  await H.finger("function(){ return document.querySelector('#tmain tr[data-id=\"" + root + "\"] [data-act=\"chain\"]'); }", '整條鏈');
  assert((await H.sheetName()) === 'tree' && !(await H.popOpen()) && (await H.ev("document.querySelector('.page').classList.contains('grow')")), '整條鏈是一整頁（不是彈出框）');
  var cs = await cards(), es = await edges();
  assert(cs.length === 3 && cs[0].indexOf('阿澄') === 0 && cs[0].indexOf('可以給：一小時諮詢') >= 0 && cs[0].indexOf('需要：想學手機拍照') >= 0 && cs[1].indexOf('阿明') === 0 && cs[2].indexOf('小樂') === 0, '起頭阿澄在最上面，阿明、小樂往下長：' + cs.join(' / '));
  assert(es.length === 3 && es[0] === '阿明 給 阿澄：手機拍照教學' && es[1] === '小樂 給 阿明：幫忙搬東西一小時', '線上寫誰給誰什麼：' + es.join(' | '));
  assert(es[2] === '' && (await H.ev("document.querySelectorAll('#tmain .ttail').length")) === 1 && (await H.main()).indexOf('能幫小樂（想找人練習日文會話）的人，點一下就接上來') >= 0, '尾巴多一格「接在這裡」，寫能幫小樂的人點一下就接上來');
  assert((await H.ev("document.querySelectorAll('#tmain .tcard.lit').length")) === 0 && (await H.ev("document.querySelectorAll('#treeSvg path').length")) === 0 && (await H.main()).indexOf('第 1 條') < 0, '還沒成圈：沒有亮的、沒有彎回去的線、只有一條不寫第幾條');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_tree_1_landscape.png', fullPage: true });
  // 2. 點「接在這裡」就是接上去：接到小樂的需要下面；自己的卡片寫「你」
  await H.finger("function(){ return document.querySelector('#tmain .ttail'); }", '接在這裡');
  assert((await H.popOpen()) && (await H.popTitle()).indexOf('接到 小樂 的公告下面') >= 0, '跳出接上去的框');
  await H.edit('#lGive', 'r1b'); await H.setIn('lNeed', '一小時諮詢'); await H.popOk('接上去');
  assert((await H.msg()) === '接上去了' && (await H.sheetName()) === 'tree', '接上去了，還在分支樹這一頁');
  cs = await cards(); assert(cs.length === 4 && cs[3].indexOf('你') === 0 && cs[3].indexOf('我 給 小樂：早餐一頓') >= 0 && (await H.ev("document.querySelector('#tmain .tcard.mine').textContent")).indexOf('你') >= 0, '自己的卡片寫「你」，接在小樂下面');
  assert((await H.ev("(function(){var c=document.querySelector('#tmain .tcard.mine').getBoundingClientRect();return c.top>=0&&c.bottom<=window.innerHeight;})()")), '打開時捲到自己那張（在畫面裡）');
  // 3. 岔路：小樂也接到阿澄的需要下面 → 「第 1 條」「第 2 條」並排
  await H.ev("(function(){var S=APP.state(),t=APP.now();CORE.linkNotice(S,'" + J3 + "','" + root + "',{side:'need',give:['r3a'],need:'想找人練習日文會話'},t);APP.changed();})()");
  await H.nav('find'); await H.finger("function(){ return document.querySelector('#tmain tr[data-id=\"" + root + "\"] [data-act=\"chain\"]'); }", '整條鏈');
  var nos = await H.ev("Array.from(document.querySelectorAll('#tmain .tno')).map(function(e){return e.textContent;})");
  assert(nos.join() === '第 1 條,第 2 條' && (await H.ev("document.querySelectorAll('#tmain .tree > .tn > .tk > .tb').length")) === 2, '岔路並排，寫第 1 條、第 2 條');
  assert((await H.ev("(function(){var b=document.querySelectorAll('#tmain .tree > .tn > .tk > .tb');return b[1].getBoundingClientRect().left>b[0].getBoundingClientRect().left;})()")), '第 2 條在第 1 條右邊');
  // 4. 接回起點成一圈：我接到阿澄的可以給下面 → 圈裡的亮起來、線彎回起點、起點寫接成一圈・4 人、我是圈主有「開時段」
  await H.ev("(function(){var S=APP.state(),t=APP.now();CORE.linkNotice(S,'" + J1 + "','" + root + "',{side:'give',item:'r2b',give:['r1b'],need:'想要有人陪跑'},t);APP.changed();})()");
  await H.nav('find'); await H.finger("function(){ return document.querySelector('#tmain tr[data-id=\"" + root + "\"] [data-act=\"chain\"]'); }", '整條鏈');
  var lit = await H.ev("document.querySelectorAll('#tmain .tcard.lit').length"), litE = await H.ev("document.querySelectorAll('#tmain .te.lit').length");
  assert(lit === 5 && litE === 4 && (await H.ev("document.querySelectorAll('#treeSvg path').length")) === 1 && (await H.main()).indexOf('接成一圈・4 人') >= 0, '接成一圈：5 張卡片和 4 條線亮起來，一條線彎回起點，起點寫接成一圈・4 人（亮 ' + lit + '、線 ' + litE + '）');
  assert((await H.ev("Array.from(document.querySelectorAll('#tmain .tcard.lit .tst')).every(function(e){return e.textContent==='在一圈裡';})")) && (await H.ev("document.querySelector('#tmain .tcard:not(.lit) .tst')")) === null, '圈裡的卡片狀態「在一圈裡」，小樂那條岔路沒有');
  assert((await H.ev("!!document.querySelector('#tmain .tcard.mine [data-act=\"circleOpen\"]')")) && (await H.ev("document.querySelectorAll('#tmain .ttail').length")) === 1, '我是圈主：我的卡片有「開時段」；圈裡沒有「接在這裡」，小樂那條還有');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_tree_2_circle_landscape.png', fullPage: true });
  await H.finger("function(){ return document.querySelector('#tmain .tcard.mine [data-act=\"circleOpen\"]'); }", '開時段'); assert((await H.popOpen()) && (await H.popTitle()) === '開一起成交的時段', '開時段：跳出開時段的框'); await H.popOk('開時段');
  await H.nav('find'); await H.finger("function(){ return document.querySelector('#tmain tr[data-id=\"" + root + "\"] [data-act=\"chain\"]'); }", '整條鏈');
  assert((await H.ev("Array.from(document.querySelectorAll('#tmain .tcard.lit .tst')).every(function(e){return e.textContent==='已開時段';})")), '開了時段：狀態變「已開時段」');
  await H.becomeMe(J2); await H.nav('find'); await H.finger("function(){ return document.querySelector('#tmain tr[data-id=\"" + root + "\"] [data-act=\"chain\"]'); }", '整條鏈');
  assert((await H.ev("document.querySelector('#tmain .tcard.mine').textContent")).indexOf('你') >= 0 && (await H.ev("!!document.querySelector('#tmain .tcard.mine [data-act=\"circleBook\"]')")) && !(await H.ev("!!document.querySelector('#tmain [data-act=\"circleOpen\"]')")), '阿澄看：自己那張寫「你」、有「約」，沒有「開時段」');
  await H.finger("function(){ return document.querySelector('#tmain .tcard.mine [data-act=\"circleBook\"]'); }", '約'); assert((await H.sheetName()) === 'log' && (await H.msg()).indexOf('約好了') >= 0, '約：約好了，跳到事件簿');
  // 5. 點卡片到他的資源表
  await H.nav('find'); await H.finger("function(){ return document.querySelector('#tmain tr[data-id=\"" + root + "\"] [data-act=\"chain\"]'); }", '整條鏈');
  await H.finger("function(){ return document.querySelector('#tmain .tcard[data-id=\"" + J5 + "\"] .tl'); }", '阿明的卡片'); assert((await H.sheetName()) === 'other:res' && (await pg.textContent('#tother')).indexOf('J5 阿明') >= 0, '點卡片到他的資源表'); await H.clickText('回我自己', '#tother');
  // 6. 快到期：3 天內的卡片標「快到期」
  await H.becomeMe(J1); await H.ev("(function(){var S=APP.state();var n=S.notices.find(function(x){return x.owner==='" + J3 + "'&&x.need==='想找人練習日文會話'&&x.parent.notice==='" + root + "';});n.untilDay=CORE.dayNum(APP.now())+2;APP.changed();})()");
  await H.nav('find'); await H.finger("function(){ return document.querySelector('#tmain tr[data-id=\"" + root + "\"] [data-act=\"chain\"]'); }", '整條鏈');
  assert((await H.ev("Array.from(document.querySelectorAll('#tmain .tst')).some(function(e){return e.textContent==='快到期';})")), '3 天內到期的卡片標「快到期」');
  // 7. 直放：樹左右滑得到、字不擠出卡片；截一張
  await pg.setViewportSize({ width: 360, height: 780 }); await pg.waitForTimeout(300); await H.nav('find'); await H.finger("function(){ return document.querySelector('#tmain tr[data-id=\"" + root + "\"] [data-act=\"chain\"]'); }", '整條鏈');
  var fit = await H.ev("(function(){var t=document.getElementById('tree');var bad=Array.from(t.querySelectorAll('.tcard')).filter(function(c){return c.scrollWidth>c.clientWidth+1;}).length;return {scroll:t.scrollWidth>t.clientWidth,bad:bad,cards:t.querySelectorAll('.tcard').length};})()");
  assert(fit.bad === 0 && fit.cards === 6, '直放：6 張卡片字不擠出卡片' + (fit.scroll ? '，樹左右滑' : ''));
  if (OUT) await pg.screenshot({ path: OUT + '/v9_tree_3_portrait.png', fullPage: true });
  await pg.setViewportSize({ width: 780, height: 360 }); await pg.waitForTimeout(200);
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
