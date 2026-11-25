// 主動方和接受（第 12 輪）：他主動時那一行紅字「看規則・接受」，打開看得到出問題怎麼辦和家規，接受後變「已接受」；沒接受到時候不成交、原因對；
// 我主動時「等他接受」，用換人替他接受後成交；成交結果寫主動方；背包有主動那一欄；「出問題」寫一句兩邊都看得到；空的寫不用交、不進背包；第一次收到東西跳那一句；
// 價錢打 50.5、199.999999 顯示對，7 位擋下來；直放和轉橫各截一張。
// node v9/tests/t_lead.js <test9.html> [截圖資料夾]
var lib = require('./lib'), assert = lib.assert, path = require('path');
var OUT = process.argv[3] || path.join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
var J1 = '00000000001', J2 = '00000000002', J5 = '00000000005';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  var rowText = function (sid, other) { return H.ev("(function(){var tr=" + H.entryRow(sid, other) + ";return tr?tr.textContent:'';})()"); };
  var leadOn = function (sid, other) { return H.ev("(function(){var tr=" + H.entryRow(sid, other) + ";var b=tr&&tr.querySelector('.lead b.on');return b?b.textContent:null;})()"); };
  var waitTraded = function (sid) { return pg.waitForFunction("CORE.slotOf(APP.state(),'" + sid + "').slot.judged", null, { timeout: 15000 }); };
  // 示範的我跟示範角色本來互相接受過：這裡把「我接受別人的」和「阿澄接受我的」拿掉，才測得到接受
  await H.ev("(function(){var S=APP.state();S.acceptances=S.acceptances.filter(function(a){return a.who!=='" + J1 + "'&&!(a.who==='" + J2 + "'&&a.of.indexOf('" + J1 + "')===0);});APP.changed();})()");
  assert((await H.ev("CORE.acceptState(APP.state(),'" + J1 + "','" + J2 + "-1',APP.now())")) === 'none' && (await H.ev("CORE.acceptState(APP.state(),'" + J2 + "','" + J1 + "-1',APP.now())")) === 'none', '我還沒接受阿澄的規則，阿澄也還沒接受我的');
  // 1. 他主動：阿澄開時段、我約、我選他的改履歷（100）、他選我的陪跑（60）→ 阿澄給得多，是主動方
  var mk = async function (sec) { return H.ev("(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+" + sec + "e6,1,null,t);CORE.book(S,'" + J1 + "',s.id,t);CORE.setWants(S,s.id,'" + J1 + "','" + J2 + "',['r2a']);CORE.setWants(S,s.id,'" + J2 + "','" + J1 + "',['r1a']);APP.changed();return s.id;})()"); };
  var s1 = await mk(180); await H.nav('log');
  assert((await leadOn(s1, J2)) === '他' && (await rowText(s1, J2)).indexOf('看規則・接受') >= 0 && (await H.ev("(function(){var tr=" + H.entryRow(s1, J2) + ";return getComputedStyle(tr.querySelector('[data-act=seeRules]')).color;})()")) === 'rgb(162, 57, 43)', '他主動：主動那一格圈「他」，紅字「看規則・接受」');
  assert((await H.ev("document.querySelector('#tmain .remind').textContent")).indexOf('有一筆要你先接受 阿澄（聊天傾聽） 的規則') >= 0, '事件簿最上面提醒：有一筆要你先接受阿澄的規則');
  await H.finger("function(){ var tr=" + H.entryRow(s1, J2) + "; return tr.querySelector('[data-act=\"seeRules\"]'); }", '看規則・接受');
  assert((await H.popOpen()) && (await H.popTitle()) === '看規則・接受' && (await H.popBody()).indexOf('改好的那一份用 LINE 傳過去') >= 0 && (await H.popBody()).indexOf('東恆家規') >= 0 && (await H.popBody()).indexOf('J2-1') >= 0, '打開一張小紙：他那一版的出問題怎麼辦和家規');
  await H.popOk('先不要'); assert((await H.ev("CORE.acceptState(APP.state(),'" + J1 + "','" + J2 + "-1',APP.now())")) === 'none' && (await rowText(s1, J2)).indexOf('看規則・接受') >= 0, '先不要：還沒接受');
  await H.soon(s1, 3); await waitTraded(s1); await pg.waitForTimeout(400);
  assert((await H.popOpen()) && (await H.popBody()).indexOf('和 阿澄 不成立：你還沒接受 阿澄（聊天傾聽） 的規則') >= 0, '沒接受到那一微秒：不成交，原因「你還沒接受 阿澄（聊天傾聽） 的規則」：' + (await H.popBody())); await H.popOk();
  assert((await rowText(s1, J2)).indexOf('不成立') >= 0 && (await leadOn(s1, J2)) === '他' && (await rowText(s1, J2)).indexOf('你還沒接受') >= 0 && (await H.ev("APP.state().holds.length")) === 0, '那一行：不成立、主動圈「他」、寫你還沒接受；沒有保留');
  // 2. 接受以後：再約一次 → 照他的規則・已接受 → 成交，成交結果寫主動方；第一次收到東西跳那一句
  var s2 = await mk(180); await H.nav('log');
  await H.finger("function(){ var tr=" + H.entryRow(s2, J2) + "; return tr.querySelector('[data-act=\"seeRules\"]'); }", '看規則・接受'); await H.popOk('接受');
  assert((await H.msg()).indexOf('接受了 阿澄（聊天傾聽） 的規則') >= 0 && (await H.ev("CORE.acceptState(APP.state(),'" + J1 + "','" + J2 + "-1',APP.now())")) === 'current' && (await rowText(s2, J2)).indexOf('照他的規則・已接受') >= 0 && !(await H.ev("!!document.querySelector('#tmain .remind')")), '接受了：那一行寫「照他的規則・已接受」，提醒不見');
  var acc = await H.ev("JSON.stringify(APP.state().acceptances.filter(function(a){return a.who==='" + J1 + "';}).map(function(a){return [a.of,a.problem.slice(0,6),a.village.slice(0,4)];}))");
  assert(acc === JSON.stringify([[J2 + '-1', '改好的那一份', '東恆家規']]), '接受記了：誰、哪個角色、出問題怎麼辦和家規的內容');
  var before = await H.ev("CORE.remainingToday(APP.state(),APP.me(),APP.now())");
  await H.soon(s2, 3); await waitTraded(s2); await pg.waitForTimeout(400);
  var body = await H.popBody();
  assert((await H.popOpen()) && body.indexOf('我給他：陪跑一小時（約 500 大卡）（60 點）') >= 0 && body.indexOf('我收到：阿澄的改履歷（約 10 大卡）') >= 0 && body.indexOf('主動：阿澄（聊天傾聽）・照他的規則（') >= 0 && body.indexOf('的版本）') >= 0 && body.indexOf('東西交到你手上，再在那一行按『兌現』') >= 0, '成交結果：我給他、我收到（交什麼）、主動：阿澄（聊天傾聽）・照他的規則（哪一天的版本）：' + body);
  assert(body.indexOf('東西到手再按『兌現』') >= 0 && (await H.ev("APP.state().hints.phys")) === true, '第一次收到東西：跳一句「東西到手再按『兌現』」'); await H.popOk();
  var cells = await H.ev("Array.from(" + H.entryRow(s2, J2) + ".querySelectorAll('td')).map(function(td){return td.textContent.trim();})");
  assert(cells[5] === '成交' && (await leadOn(s2, J2)) === '他' && cells[4].indexOf('照他的規則') >= 0 && cells[6] === (await H.ev("CORE.fmtPoints(" + (before - 60000000) + ")")) && cells[2].indexOf('約 500 大卡') >= 0 && cells[3].indexOf('約 10 大卡') >= 0 && cells[8].indexOf('兌現') === 0 && cells[8].indexOf('出問題') >= 0, '那一行：成交、主動圈「他」照他的規則、我給他／我收到寫交什麼、兌現那格下面有「出問題」');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_lead_landscape.png', fullPage: true });
  // 3. 出問題：收的人寫一句（最多 40 字），給的人那邊也看得到；可以改、清掉；不改成交
  var hid = await H.ev("APP.state().holds.find(function(h){return h.holder==='" + J1 + "';}).id");
  await H.finger("function(){ return " + H.entryRow(s2, J2) + ".querySelector('[data-act=\"problem\"]'); }", '出問題');
  assert((await H.popOpen()) && (await H.popTitle()) === '出問題' && (await H.popBody()).indexOf('改好的那一份用 LINE 傳過去') >= 0, '打開一格寫一句話，下面寫他的出問題怎麼辦');
  await H.setIn('probText', '很'.repeat(41)); await H.popOk('寫好了'); assert((await H.msg()).indexOf('40 字以內') >= 0, '41 字擋下來');
  await H.finger("function(){ return " + H.entryRow(s2, J2) + ".querySelector('[data-act=\"problem\"]'); }", '出問題'); await H.setIn('probText', '列印稿缺了最後一頁'); await H.popOk('寫好了');
  assert((await H.msg()).indexOf('他那邊也看得到') >= 0 && (await H.ev("APP.state().holds.find(function(h){return h.id==='" + hid + "';}).problem")) === '列印稿缺了最後一頁' && (await rowText(s2, J2)).indexOf('出問題：列印稿缺了最後一頁') >= 0 && (await H.ev("APP.state().dockings.filter(function(d){return d.traded;}).length")) === 1, '寫好了：那一格顯示那一句；不改成交的結果');
  await H.becomeMe(J2); await H.nav('log');
  assert((await rowText(s2, J1)).indexOf('他寫：列印稿缺了最後一頁') >= 0 && (await leadOn(s2, J1)) === '我', '阿澄的事件簿那一行也看得到那一句；他那邊主動圈「我」');
  await H.becomeMe(J1); await H.nav('log');
  // 背包：收到那一筆當作昨天的 → 下面那張有主動那一欄、交什麼、出問題
  await H.ev("(function(){var h=APP.state().holds.find(function(h){return h.id==='" + hid + "';});h.atUs-=86400e6;APP.changed();})()");
  var bag = await H.ev("(function(){var t=[...document.querySelectorAll('#tmain table')][1];var tr=t.querySelector('tr[data-row]');return {th:Array.from(t.querySelectorAll('th')).map(function(x){return x.firstChild.textContent;}).join(','),row:tr?tr.textContent:'',lead:tr&&tr.querySelector('.lead b.on')?tr.querySelector('.lead b.on').textContent:null};})()");
  assert(bag.th === '哪天收到的,誰的,什麼東西,主動,兌現・對方簽名,出問題' && bag.row.indexOf('阿澄（聊天傾聽）') >= 0 && bag.row.indexOf('約 10 大卡') >= 0 && bag.lead === '他' && bag.row.indexOf('出問題：列印稿缺了最後一頁') >= 0, '背包：哪天收到的｜誰的（哪個角色）｜什麼東西・交什麼｜主動｜兌現・對方簽名｜出問題');
  await H.finger("function(){ return [...document.querySelectorAll('#tmain table')][1].querySelector('[data-act=\"problem\"]'); }", '背包的出問題'); await H.popOk('清掉');
  assert((await H.ev("APP.state().holds.find(function(h){return h.id==='" + hid + "';}).problem")) === '', '清掉了');
  // 4. 我主動：我開時段、阿澄約、他選我的早餐（100）、我選他的試聽（0）→ 我給得多；阿澄還沒接受我的 → 「照我的規則・等他接受」→ 不成交；換人替他接受 → 成交
  var mk2 = async function (sec) { return H.ev("(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J1 + "',t+" + sec + "e6,1,null,t);CORE.book(S,'" + J2 + "',s.id,t);CORE.setWants(S,s.id,'" + J2 + "','" + J1 + "',['r1b']);CORE.setWants(S,s.id,'" + J1 + "','" + J2 + "',['r2c']);APP.changed();return s.id;})()"); };
  var s3 = await mk2(180); await H.nav('log');
  assert((await leadOn(s3, J2)) === '我' && (await rowText(s3, J2)).indexOf('照我的規則・等他接受') >= 0 && !(await H.ev("!!document.querySelector('#tmain .remind')")), '我主動：圈「我」、照我的規則・等他接受；不用提醒我接受');
  await H.soon(s3, 3); await waitTraded(s3); await pg.waitForTimeout(400);
  assert((await H.popOpen()) && (await H.popBody()).indexOf('和 阿澄 不成立：他還沒接受你的規則') >= 0, '他沒接受：不成交，原因「他還沒接受你的規則」'); await H.popOk();
  await H.becomeMe(J2); await H.nav('log');
  assert((await rowText(s3, J1)).indexOf('你還沒接受') >= 0 && (await leadOn(s3, J1)) === '他', '阿澄那邊：你還沒接受 我（便當熟食） 的規則、主動圈「他」');
  var s4 = await H.ev("(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J1 + "',t+180e6,1,null,t);CORE.book(S,'" + J2 + "',s.id,t);CORE.setWants(S,s.id,'" + J2 + "','" + J1 + "',['r1b']);CORE.setWants(S,s.id,'" + J1 + "','" + J2 + "',['r2c']);APP.changed();return s.id;})()"); await H.nav('log');
  assert((await H.ev("document.querySelector('#tmain .remind').textContent")).indexOf('有一筆要你先接受 我（便當熟食） 的規則') >= 0, '阿澄的事件簿最上面：有一筆要你先接受我的規則');
  await H.finger("function(){ return document.querySelector('#tmain .remind [data-act=\"goLog\"]'); }", '去看'); assert((await H.ev("(function(){var tr=" + H.entryRow(s4, J1) + ";return tr&&tr.classList.contains('flash');})()")), '點了捲到那一行');
  await H.finger("function(){ var tr=" + H.entryRow(s4, J1) + "; return tr.querySelector('[data-act=\"seeRules\"]'); }", '看規則・接受'); assert((await H.popBody()).indexOf('東西當面交；送不到或壞了，改天補一次') >= 0, '看得到我的出問題怎麼辦'); await H.popOk('接受');
  assert((await rowText(s4, J1)).indexOf('照他的規則・已接受') >= 0, '阿澄接受了：照他的規則・已接受');
  await H.becomeMe(J1); await H.nav('log');
  assert((await rowText(s4, J2)).indexOf('照我的規則・他接受了') >= 0, '回到我：照我的規則・他接受了');
  await H.soon(s4, 3); await waitTraded(s4); await pg.waitForTimeout(400);
  assert((await H.popOpen()) && (await H.popBody()).indexOf('主動：我（便當熟食）・照我的規則') >= 0 && (await H.popBody()).indexOf('我收到：阿澄的試聽 5 分鐘（約 2 大卡）') >= 0, '成交：主動：我（便當熟食）・照我的規則'); await H.popOk();
  assert((await rowText(s4, J2)).indexOf('成交') >= 0 && (await leadOn(s4, J2)) === '我', '那一行成交、主動圈「我」');
  // 5. 空的不用交、不進背包：約阿明，我選他的空的、他選我的早餐（陪跑只有一份，第 1 段換走了）
  var h0 = await H.ev("APP.state().holds.filter(function(h){return h.holder==='" + J1 + "';}).length");
  var s5 = await H.ev("(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J5 + "',t+3e6,1,null,t);CORE.book(S,'" + J1 + "',s.id,t);CORE.setWants(S,s.id,'" + J1 + "','" + J5 + "',['r5b']);CORE.setWants(S,s.id,'" + J5 + "','" + J1 + "',['r1b']);APP.changed();return s.id;})()");
  await waitTraded(s5); await pg.waitForTimeout(400);
  assert((await H.popOpen()) && (await H.popBody()).indexOf('我收到：阿明的空的（不用交）') >= 0 && (await H.popBody()).indexOf('空的不用交、不用兌現') >= 0, '收到空的：寫不用交、不用兌現'); await H.popOk();
  var c5 = await H.ev("Array.from(" + H.entryRow(s5, J5) + ".querySelectorAll('td')).map(function(td){return td.textContent.trim();})");
  assert(c5[3].indexOf('不用交') >= 0 && c5[8] === '不用交' && (await H.ev("APP.state().holds.filter(function(h){return h.holder==='" + J1 + "';}).length")) === h0, '那一行我收到寫不用交、兌現那格寫不用交；背包沒多一筆');
  // 6. 價錢到小數點後 6 位：50.5、199.999999 顯示對，7 位擋下來；格子不擠出去
  await H.nav('res');
  await H.edit('#tmain input[data-ed="resPrice"][data-id="r1b"]', '50.5');
  assert((await H.ev("CORE.pending(CORE.firstChar(APP.me()),APP.now()).resources.find(function(x){return x.id==='r1b';}).price")) === 50500000 && (await H.ev("document.querySelector('#tmain input[data-ed=\"resPrice\"][data-id=\"r1b\"]').value")) === '50.5' && (await H.main()).indexOf('明天起 50.5 點（今天 100）') >= 0, '價錢打 50.5：存 50500000、顯示 50.5');
  await H.edit('#tmain input[data-ed="resPrice"][data-id="r1b"]', '199.999999');
  var fit = await H.ev("(function(){var el=document.querySelector('#tmain input[data-ed=\"resPrice\"][data-id=\"r1b\"]');var td=el.closest('td');return {v:el.value,over:el.scrollWidth>el.clientWidth+1,out:el.getBoundingClientRect().right>td.getBoundingClientRect().right+1};})()");
  assert(fit.v === '199.999999' && !fit.over && !fit.out, '199.999999 顯示對、沒擠出格子（轉橫）');
  await H.edit('#tmain input[data-ed="resPrice"][data-id="r1b"]', '1.2345678');
  assert((await H.msg()).indexOf('最多到小數點後 6 位') >= 0 && (await H.ev("CORE.pending(CORE.firstChar(APP.me()),APP.now()).resources.find(function(x){return x.id==='r1b';}).price")) === 199999999, '7 位小數擋下來：最多到小數點後 6 位，價錢沒改');
  await H.edit('#tmain [data-ed="daily"]', '0.000001'); assert((await H.ev("CORE.pending(APP.me(),APP.now()).dailyPoints")) === 1 && (await H.msg()) === '改了，明天起算', '每天的點打 0.000001');
  await H.edit('#tmain [data-ed="daily"]', '10000000000'); assert((await H.msg()).indexOf('最多 10 億點') >= 0, '每天的點超過 10 億擋下來');
  await H.edit('#tmain [data-ed="daily"]', '1800');
  await pg.setViewportSize({ width: 360, height: 780 }); await pg.waitForTimeout(300); await H.nav('res');
  var fitP = await H.ev("(function(){var el=document.querySelector('#tmain input[data-ed=\"resPrice\"][data-id=\"r1b\"]');var td=el.closest('td');return {over:el.scrollWidth>el.clientWidth+1,out:el.getBoundingClientRect().right>td.getBoundingClientRect().right+1};})()");
  assert(!fitP.over && !fitP.out, '直放：199.999999 也沒擠出格子');
  await H.nav('log'); if (OUT) await pg.screenshot({ path: OUT + '/v9_lead_portrait.png', fullPage: true });
  await pg.setViewportSize({ width: 780, height: 360 }); await pg.waitForTimeout(200);
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
