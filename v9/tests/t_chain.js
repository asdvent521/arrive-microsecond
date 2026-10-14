// 公告欄接成一圈：示範那條三人的鏈縮排列在公告下面、整條鏈；用手指接上去（接到需要下面、接到可以給下面）排成岔路、線接回起點成一圈（我是圈主）；
// 圈主開一起成交的時段、大家在事件簿最上面看到提醒去約、平台先選好、那一微秒全部成交、需要被拿掉、其他岔路收到「已經有人做到了」；不用回報的送禮鏈；人數超過上限不算接成。
// node v9/tests/t_chain.js <test9.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003', J5 = '00000000005';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  // 我也要有一樣 0 點的「空的」（給的人選對方的空的）；小樂要兩方都通、接受家規：我和阿明先接受
  await H.ev("(function(){var S=APP.state(),t=APP.now(),r=APP.me(),c=CORE.addResource(S,'" + J1 + "',{name:'空的',price:0,kind:''},t);CORE.restock(S,'" + J1 + "',c.id,5);r.versions.forEach(function(v){if(v.fromDay>CORE.dayNum(t))v.fromDay=CORE.dayNum(t);});CORE.accept(S,'" + J1 + "','" + J3 + "',t);CORE.accept(S,'" + J5 + "','" + J3 + "',t);APP.changed();})()");
  var rowOf = function (id) { return "document.querySelector('#tmain tr[data-id=\"" + id + "\"]')"; };
  var root = await H.ev("APP.state().notices.find(function(n){return n.owner==='" + J2 + "'&&n.need==='想學手機拍照';}).id"), lk5 = await H.ev("APP.state().notices.find(function(n){return n.owner==='" + J5 + "'&&n.parent;}).id"), lk3 = await H.ev("APP.state().notices.find(function(n){return n.owner==='" + J3 + "'&&n.parent;}).id");
  // 1. 示範的鏈：阿澄 ← 阿明 ← 小樂 縮排列在那張公告下面；整條鏈
  await H.nav('find');
  var tree = await H.ev("Array.from(document.querySelectorAll('#tmain tr[data-row]')).map(function(t){return (t.classList.contains('link')?'└':'')+t.textContent.replace(/\\s+/g,' ').slice(0,30);})");
  assert(tree.some(function (t) { return t.indexOf('└') === 0 && t.indexOf('阿明') >= 0 && t.indexOf('有人幫我搬家具') >= 0; }) && tree.some(function (t) { return t.indexOf('└') === 0 && t.indexOf('小樂') >= 0 && t.indexOf('練習日文') >= 0; }) && (await H.ev(rowOf(lk5) + ".textContent")).indexOf('給 阿澄：手機拍照教學') >= 0, '示範的鏈：阿明、小樂縮排在阿澄那張公告下面，寫給誰什麼');
  await H.finger("function(){ return " + rowOf(lk3) + ".querySelector('[data-act=\"chain\"]'); }", '整條鏈');
  var ch = await H.popBody(); assert((await H.popTitle()) === '整條鏈' && ch.indexOf('阿澄：需要「想學手機拍照」') >= 0 && ch.indexOf('└ 阿明') >= 0 && ch.indexOf('└ 小樂') >= 0, '整條鏈：阿澄 ← 阿明 ← 小樂'); await H.popOk();
  // 2. 小樂另外也接到阿澄的需要下面（第二條岔路）
  await H.becomeMe(J3); await H.nav('find'); await H.finger("function(){ return " + rowOf(root) + ".querySelector('[data-act=\"link\"]'); }", '接上去');
  await H.edit('#lGive', 'r3a'); await H.setIn('lNeed', '想找人練習日文會話'); await H.popOk('接上去');
  assert((await H.msg()) === '接上去了' && (await H.ev("CORE.linksUnder(APP.state(),'" + root + "').length")) === 2, '小樂也接到阿澄的需要下面：同一個需要兩條岔路');
  var br3 = await H.ev("CORE.linksUnder(APP.state(),'" + root + "')[1].id");
  assert((await H.ev("Array.from(document.querySelectorAll('#tmain tr.link')).map(function(t){return t.dataset.id;}).join()")).indexOf(lk5 + ',' + lk3 + ',' + br3) >= 0, '岔路照接上去的順序：阿明那條（含小樂）在前、小樂新接的在後');
  // 3. 我接到小樂的需要下面（給早餐、要諮詢）：還沒成圈；再接到阿澄的可以給下面（要諮詢）：線接回起點，成一圈（4 人），我是圈主
  await H.becomeMe(J1); await H.nav('find'); await H.finger("function(){ return " + rowOf(lk3) + ".querySelector('[data-act=\"link\"]'); }", '接到小樂下面');
  await H.edit('#lGive', 'r1b'); await H.setIn('lNeed', '一小時諮詢'); await H.popOk('接上去');
  assert((await H.msg()) === '接上去了' && (await H.ev("CORE.circlesOf(APP.state()).length")) === 0, '接到小樂的需要下面：還沒接成一圈');
  await H.finger("function(){ return " + rowOf(root) + ".querySelector('[data-act=\"link\"]'); }", '接到阿澄下面');
  await H.click('#popBody input[name="lside"][value="give"]'); await H.edit('#lGive', 'r1b'); await H.setIn('lNeed', '一小時諮詢'); await H.popOk('接上去');
  var c = await H.ev("(function(){var c=CORE.circlesOf(APP.state())[0];return c?{status:c.status,leader:c.leader,n:c.members.length}:null;})()");
  assert(c && c.status === 'open' && c.leader === J1 && c.n === 4 && (await H.msg()).indexOf('接成一圈（4 人），你是圈主') >= 0, '接到阿澄的可以給下面：線接回起點，一圈 4 人，我是圈主');
  var crow = await H.ev("document.querySelector('#tmain tr[data-id=\"' + CORE.circlesOf(APP.state())[0].id + '\"]').textContent");
  assert(crow.indexOf('圈主 我・4 人') >= 0 && crow.indexOf('阿明→阿澄（手機拍照教學）') >= 0 && crow.indexOf('等圈主開時段') >= 0, '公告欄多一小張「接成一圈的」：誰給誰什麼');
  await H.nav('log'); assert((await H.ev("document.querySelector('#tmain .remind').textContent")).indexOf('你把一圈接起來了（4 人）：開一個一起成交的時段') >= 0, '事件簿最上面提醒圈主開時段');
  // 4. 圈主開時段 → 大家約（平台先選好）→ 那一微秒全部成交
  await H.nav('find'); await H.clickText('開一起成交的時段', '#tmain'); await H.popOk('開時段');
  var sid = await H.ev("(function(){var s=APP.me().slots.find(function(x){return x.circle;});return s?s.id:null;})()");
  assert(sid && (await H.ev("CORE.slotOf(APP.state(),'" + sid + "').slot.together")) && (await H.ev("CORE.slotOf(APP.state(),'" + sid + "').slot.capacity")) === 3 && (await H.msg()).indexOf('開了時段') >= 0, '開了一個勾了一起成交的時段（名額 3）');
  for (var who of [J2, J3, J5]) {
    await H.becomeMe(who); await H.nav('log');
    assert((await H.ev("document.querySelector('#tmain .remind').textContent")).indexOf('圈主 我 開了') >= 0, CORE_NAME(who) + '：事件簿最上面提醒圈主開了時段');
    await H.finger("function(){ return document.querySelector('#tmain .remind [data-act=\"open\"][data-s=\"find\"]'); }", '去公告欄'); await H.click('#tmain [data-act="circleBook"]');
    assert((await H.sheetName()) === 'log' && (await H.ev("CORE.isPresent(APP.state(),'" + who + "','" + sid + "')")), CORE_NAME(who) + ' 約好了，會到也勾了');
  }
  var wants = await H.ev("(function(){var s=CORE.slotOf(APP.state(),'" + sid + "').slot,W=function(a,b){return CORE.wantsOf(s,a,b).map(function(id){return CORE.resourceName(APP.roleOf(b),id);}).join();};return [W('" + J2 + "','" + J5 + "'),W('" + J5 + "','" + J2 + "'),W('" + J5 + "','" + J3 + "'),W('" + J3 + "','" + J5 + "'),W('" + J3 + "','" + J1 + "'),W('" + J1 + "','" + J3 + "'),W('" + J1 + "','" + J2 + "'),W('" + J2 + "','" + J1 + "')].join('|');})()");
  assert(wants === '手機拍照教學|試聽 5 分鐘|幫忙搬東西一小時|空的|早餐一頓|空的|一小時諮詢|空的', '平台先選好：拿的人選那樣東西，給的人選對方 0 點的東西（阿澄的是試聽 5 分鐘）（' + wants + '）');
  await H.ev("window.__flashed=false;new MutationObserver(function(){if(document.getElementById('flash').classList.contains('go'))window.__flashed=true;}).observe(document.getElementById('flash'),{attributes:true})");
  await H.soon(sid, 3); await pg.waitForFunction("CORE.slotOf(APP.state(),'" + sid + "').slot.judged", null, { timeout: 15000 }); await pg.waitForTimeout(400);
  var done = await H.ev("(function(){var S=APP.state(),c=CORE.circlesOf(S)[0];return {status:c.status,traded:S.dockings.filter(function(d){return d.slot==='" + sid + "'&&d.traded;}).length,root:!!CORE.noticeOf(S,'" + root + "'),lk5:!!CORE.noticeOf(S,'" + lk5 + "'),br3:CORE.noticeOf(S,'" + br3 + "'),mine:S.notices.filter(function(n){return n.owner==='" + J1 + "';}).length};})()");
  assert(done.status === 'done' && done.traded === 4 && (await H.ev("window.__flashed")), '那一微秒照一起成交：四對全部成交、白光');
  assert(!done.root && !done.lk5 && done.mine === 0 && done.br3 && done.br3.parent === null && done.br3.doneBy, '成交以後圈裡的需要都拿掉；小樂另一條岔路留著、沒接在誰下面、提醒已經有人做到了');
  await H.popOk(); await H.becomeMe(J3); await H.nav('log');
  assert((await H.ev("document.querySelector('#tmain .remind').textContent")).indexOf('你接在「想學手機拍照」下面的那條：已經有人做到了') >= 0, '小樂的事件簿最上面：已經有人做到了');
  await H.finger("function(){ return document.querySelector('#tmain .remind [data-act=\"doneAck\"]'); }", '知道了'); assert(!(await H.ev("!!document.querySelector('#tmain .remind')")) || (await H.ev("document.querySelector('#tmain .remind').textContent")).indexOf('做到了') < 0, '知道了就不再提醒');
  // 5. 不用回報：我掛公告，阿明接到我的需要下面（鏈的起頭），選不用回報當送禮；阿明當圈主開時段、我約、成交
  await H.becomeMe(J1); await H.nav('find'); await H.setIn('ntNeed', '一首歌'); await H.check('#tmain [data-give="r1a"]', true); await H.clickText('掛上去', '#tmain');
  var my = await H.ev("APP.state().notices.find(function(n){return n.owner==='" + J1 + "'&&n.need==='一首歌';}).id");
  await H.becomeMe(J5); await H.nav('find'); await H.finger("function(){ return " + rowOf(my) + ".querySelector('[data-act=\"link\"]'); }", '接上去'); await H.edit('#lGive', 'r5a'); await H.setIn('lNeed', '一杯茶'); await H.popOk('接上去');
  var g5 = await H.ev("APP.state().notices.find(function(n){return n.owner==='" + J5 + "'&&n.parent&&n.parent.notice==='" + my + "';}).id");
  await H.finger("function(){ return " + rowOf(g5) + ".querySelector('[data-act=\"gift\"]'); }", '不用回報'); await H.popOk('就當送禮');
  var gc = await H.ev("(function(){var c=CORE.circlesOf(APP.state()).find(function(x){return x.gift;});return c?{leader:c.leader,n:c.members.length,status:c.status}:null;})()");
  assert(gc && gc.leader === J5 && gc.n === 2 && gc.status === 'open' && (await H.msg()).indexOf('當送禮了') >= 0, '鏈的起頭選不用回報：送禮鏈，阿明當圈主');
  await H.clickText('開一起成交的時段', '#tmain'); await H.popOk('開時段'); var gsid = await H.ev("APP.me().slots.filter(function(x){return x.circle;}).slice(-1)[0].id");
  await H.becomeMe(J1); await H.nav('find'); await H.click('#tmain [data-act="circleBook"]'); assert((await H.ev("CORE.wantsOf(CORE.slotOf(APP.state(),'" + gsid + "').slot,'" + J1 + "','" + J5 + "').join()")) === 'r5a', '我約了：先選好阿明的拍照教學');
  await H.soon(gsid, 3); await pg.waitForFunction("CORE.slotOf(APP.state(),'" + gsid + "').slot.judged", null, { timeout: 15000 }); await pg.waitForTimeout(400); await H.popOk();
  assert((await H.ev("CORE.circlesOf(APP.state()).find(function(x){return x.gift;}).status")) === 'done' && !(await H.ev("!!CORE.noticeOf(APP.state(),'" + my + "')")), '送禮鏈成交：需要拿掉');
  // 6. 人數超過上限不算接成
  await H.nav('find'); await H.setIn('ntNeed', '修腳踏車'); await H.setIn('ntCap', 2); await H.check('#tmain [data-give="r1a"]', true); await H.clickText('掛上去', '#tmain');
  var cap2 = await H.ev("APP.state().notices.find(function(n){return n.owner==='" + J1 + "'&&n.need==='修腳踏車';}).id");
  await H.ev("(function(){var S=APP.state(),t=APP.now();var a=CORE.linkNotice(S,'" + J2 + "','" + cap2 + "',{side:'need',give:['r2a'],need:'一杯茶'},t).notice;CORE.linkNotice(S,'" + J3 + "',a.id,{side:'need',give:['r3a'],need:'陪跑'},t);APP.changed();})()");
  var l3 = await H.ev("APP.state().notices.filter(function(n){return n.owner==='" + J3 + "'&&n.need==='陪跑';})[0].id");
  await H.nav('find'); await H.finger("function(){ return " + rowOf(l3) + ".querySelector('[data-act=\"link\"]'); }", '接上去'); await H.edit('#lGive', 'r1a'); await H.setIn('lNeed', '修腳踏車'); await H.popOk('接上去');
  assert((await H.msg()).indexOf('3 人超過公告的上限 2，不算接成一圈') >= 0 && (await H.ev("CORE.circlesOf(APP.state()).filter(function(c){return c.status==='open';}).length")) === 0, '三個人超過上限 2：不算接成一圈，線留著');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
function CORE_NAME(s) { return { '00000000002': '阿澄', '00000000003': '小樂', '00000000005': '阿明' }[s] || s; }
