// 打招呼密鑰和固定約：到他的那張紙設密鑰、對方在事件簿最上面看到提醒、更多 → 打招呼密鑰同意才成立；
// 兩個人都在框裡輸入密鑰 → 後輸入的那一刻當場換一次（白光、事件簿那一行標「密鑰」）；只有一個人輸入，1 分鐘沒等到就取消、什麼都不記；第三個人輸入說找不到。
// 固定約：成交結果裡兩邊都勾 → 成立，換日多一行標「每天」、按「停」結束。
// node v9/tests/t_greet.js <test9.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  // 1. 設密鑰：到阿澄的那張紙，按「跟他設打招呼密鑰」
  await H.serial('J2'); await H.clickText('跟他設打招呼密鑰', '#tmain');
  assert((await H.popOpen()) && (await H.popTitle()).indexOf('跟 阿澄 設打招呼密鑰') >= 0, '跳出設密鑰：密鑰、平常我給他、平常我拿他的');
  await H.setIn('gKey', 'J5'); await H.popOk('送出'); assert((await H.popTitle()) === '設不了' && (await H.popBody()).indexOf('序號') >= 0, '密鑰不能長得像序號'); await H.popOk();
  await H.clickText('跟他設打招呼密鑰', '#tmain'); await H.setIn('gKey', '早安'); await H.edit('#gGive', 'r1b'); await H.edit('#gGet', 'r2b'); await H.popOk('送出');
  var g = await H.ev("(function(){var g=CORE.greetsOf(APP.state())[0];return g?{status:g.status,key:g.pending?g.pending.key:null,by:g.pending?g.pending.by:null}:null;})()");
  assert(g && g.status !== 'active' && g.key === '早安' && (await H.msg()).indexOf('等 阿澄 同意') >= 0, '送出了，等阿澄同意');
  // 2. 阿澄：事件簿最上面一行提醒 → 更多 → 打招呼密鑰 → 同意
  await H.becomeMe(J2); await H.nav('log');
  assert((await H.ev("(function(){var r=document.querySelector('#tmain .remind');return r?r.textContent:'';})()")).indexOf('我 要跟你配打招呼密鑰「早安」') >= 0, '阿澄的事件簿最上面：J1 要跟你配打招呼密鑰「早安」');
  await H.finger("function(){ return document.querySelector('#tmain .remind [data-act=\"open\"][data-s=\"greet\"]'); }", '去看');
  assert((await H.sheetName()) === 'greet' && (await H.main()).indexOf('提議「早安」') >= 0 && (await H.main()).indexOf('我給 一小時諮詢，我拿 早餐一頓') >= 0, '打招呼密鑰那張紙：提議的密鑰、我給、我拿');
  await H.clickText('同意', '#tmain');
  assert((await H.ev("CORE.greetsOf(APP.state())[0].status")) === 'active' && (await H.main()).indexOf('密鑰「早安」') >= 0 && (await H.main()).indexOf('用著') >= 0, '同意了：密鑰成立');
  // 3. 第三個人輸入：找不到
  await H.becomeMe(J3); await H.serial('早安'); assert((await H.msg()).indexOf('找不到序號或密鑰 早安') >= 0 && (await H.ev("Object.keys(APP.state().greetWaits).length")) === 0, '小樂輸入「早安」：找不到，什麼都沒記');
  // 4. 只有一個人輸入：等 1 分鐘，沒等到就取消、什麼都不記
  await H.becomeMe(J1); var n0 = await H.ev("CORE.entriesOf(APP.state()).length");
  await H.serial('早安');
  assert((await H.msg()).indexOf('等對方 1 分鐘內也輸入') >= 0 && (await H.ev("document.getElementById('serialIn').value")) === '' && (await H.ev("Object.keys(APP.state().greetWaits).length")) === 1, '我輸入了：等對方 1 分鐘內也輸入');
  await H.nav('log'); assert((await H.ev("document.querySelector('#tmain .remind').textContent")).indexOf('已經輸入密鑰，等對方 1 分鐘內也輸入') >= 0, '事件簿最上面提醒正在等');
  await H.ev("(function(){var w=APP.state().greetWaits;Object.keys(w).forEach(function(k){w[k].at-=61e6;});APP.changed();})()"); await pg.waitForTimeout(300);
  assert((await H.ev("Object.keys(APP.state().greetWaits).length")) === 0 && (await H.ev("CORE.entriesOf(APP.state()).length")) === n0 && (await H.ev("!document.querySelector('#tmain .remind')")), '1 分鐘沒等到：取消，什麼都不記，提醒不見');
  // 5. 兩個人都輸入：後輸入的那一刻當場換一次
  await H.serial('早安'); await H.becomeMe(J2);
  var before = await H.ev("JSON.stringify([CORE.remainingToday(APP.state(),APP.roleOf('" + J1 + "'),APP.now()),CORE.remainingToday(APP.state(),APP.me(),APP.now())])");
  await H.ev("window.__flashed=false;new MutationObserver(function(){if(document.getElementById('flash').classList.contains('go'))window.__flashed=true;}).observe(document.getElementById('flash'),{attributes:true})");
  await H.serial('早安'); await pg.waitForTimeout(300);
  var d = await H.ev("(function(){var d=APP.state().dockings.filter(function(x){return x.greet;})[0];return d?{t:d.traded,ga:d.gaveA,gb:d.gaveB,a:d.a,n:APP.state().holds.length}:null;})()");
  assert(d && d.t && (await H.popOpen()) && (await H.popTitle()) === '到達那微秒' && (await H.popBody()).indexOf('密鑰') >= 0 && (await H.ev("window.__flashed")), '阿澄也輸入：當場換一次，白光、跳出成交結果：' + (await H.popBody()));
  assert(d.n === 2 && (await H.ev("JSON.stringify([CORE.remainingToday(APP.state(),APP.roleOf('" + J1 + "'),APP.now()),CORE.remainingToday(APP.state(),APP.me(),APP.now())])")) === JSON.stringify(JSON.parse(before).map(function (x, i) { return x - (i === 0 ? 100 : 90); })), '照配好的換：J1 給早餐 100、阿澄給諮詢 90，兩筆保留');
  await H.popOk();
  assert((await H.sheetName()) === 'log' && (await H.ev("Array.from(document.querySelectorAll('#tmain tr[data-row]')).some(function(t){return t.textContent.indexOf('密鑰')>=0&&t.textContent.indexOf('成交')>=0&&t.querySelector('.sig')&&t.querySelector('.sig').textContent==='我';})")), '事件簿多一行：標「密鑰」、成交、紅字簽名');
  assert((await H.ev("CORE.dockCount(APP.state(),'" + J1 + "')")) === 1, '算進對接過幾次（1 次）');
  await H.becomeMe(J1); await H.serial('早安'); await H.becomeMe(J2); await H.serial('早安'); await pg.waitForTimeout(300); await H.popOk();
  assert((await H.ev("APP.state().dockings.filter(function(x){return x.greet&&x.traded;}).length")) === 2 && (await H.ev("CORE.dockCount(APP.state(),'" + J1 + "')")) === 1, '同一對人一天第二次：照樣記一筆、不算進對接過幾次');
  await H.nav('greet'); assert((await H.main()).indexOf('上次') >= 0 && (await H.main()).indexOf('刪掉') >= 0, '打招呼密鑰那張紙：上次換的日子、可以改、刪掉');
  // 6. 固定約：成交結果裡兩邊都勾
  await H.becomeMe(J1);
  var sid = await H.ev("(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+1.5e6,1,null,t);CORE.book(S,'" + J1 + "',s.id,t);CORE.setWants(S,s.id,'" + J1 + "','" + J2 + "',['r2b']);CORE.setWants(S,s.id,'" + J2 + "','" + J1 + "',['r1b']);APP.changed();return s.id;})()");
  await pg.waitForFunction("!document.getElementById('pop').hidden && document.querySelector('#popBody [data-daily]')", null, { timeout: 15000 });
  await H.click('#popBody [data-daily]');
  var did = await H.ev("document.querySelector('#popBody [data-daily]').dataset.daily");
  assert((await H.ev("CORE.dailyState(APP.state(),'" + J1 + "','" + did + "').mine")) === true && (await H.ev("!CORE.standingOf(APP.state(),'" + did + "')")), '我勾了「以後每天這個時間自動約」：還要對方勾');
  await H.popOk();
  await H.becomeMe(J2); await H.ev("(function(){var d=APP.state().dockings.find(function(x){return x.id==='" + did + "';});APP.emit('dock',[{docking:d,late:false,slot:CORE.slotOf(APP.state(),'" + sid + "').slot,owner:APP.me()}]);})()");
  assert((await H.popBody()).indexOf('對方勾了，你勾了就成立') >= 0, '阿澄那邊寫「對方勾了，你勾了就成立」');
  await H.click('#popBody [data-daily]'); await H.popOk();
  var st = await H.ev("(function(){var s=CORE.standingsOf(APP.state())[0];return s?{active:s.active,a:s.a,b:s.b,last:s.lastDay,today:CORE.dayNum(APP.now())}:null;})()");
  assert(st && st.active && st.last === st.today && (await H.msg()).indexOf('固定約成立了') >= 0, '兩邊都勾：固定約成立');
  // 換日（把上次做到的那天往前撥）：多一行標「每天」，兩邊都算會到、東西選好了
  await H.ev("(function(){CORE.standingsOf(APP.state())[0].lastDay-=1;APP.changed();})()"); await pg.waitForTimeout(400);
  if (await H.popOpen()) { assert(/到達那微秒|你不在的時候/.test(await H.popTitle()) && !(await H.ev("!!document.querySelector('#popBody [data-daily]')")), '補出來的那一筆時間已經過了：馬上判、成交，成交結果裡不再問固定約'); await H.popOk(); }
  await H.becomeMe(J1); await H.nav('log');
  var rowT = await H.ev("(function(){var s=APP.roleOf('" + J2 + "').slots.filter(function(x){return x.standing;});if(!s.length)return null;var e=CORE.entriesOf(APP.state()).find(function(e){return e.slot===s[s.length-1].id;});var tr=document.querySelector('#tmain tr[data-id=\"'+e.id+'\"]');return {n:s.length,txt:tr?tr.textContent:'',present:CORE.isPresent(APP.state(),'" + J1 + "',s[s.length-1].id)&&CORE.isPresent(APP.state(),'" + J2 + "',s[s.length-1].id),wants:CORE.wantsOf(s[s.length-1],'" + J1 + "','" + J2 + "').join()};})()");
  assert(rowT && rowT.n === 1 && rowT.txt.indexOf('每天') >= 0 && rowT.txt.indexOf('停') >= 0 && rowT.present && rowT.wants === 'r2b', '換日：事件簿多一行標「每天」、有「停」，兩邊都會到、換同樣的');
  await H.ev("(function(){var st=CORE.standingsOf(APP.state())[0];st.tod=(APP.now()-CORE.dayStartUs(CORE.dayNum(APP.now())))+3600e6;st.lastDay-=1;APP.changed();})()"); await pg.waitForTimeout(300);   // 再補一筆、時間改成一小時後：還沒到
  assert((await H.ev("APP.roleOf('" + J2 + "').slots.filter(function(x){return x.standing&&!x.judged;}).length")) === 1, '還沒到的那一筆在等');
  await H.finger("function(){ return document.querySelector('#tmain [data-act=\"stopDaily\"]'); }", '停'); await H.popOk('停');
  assert((await H.ev("CORE.standingsOf(APP.state())[0].active")) === false && (await H.ev("APP.roleOf('" + J2 + "').slots.filter(function(x){return x.standing&&!x.judged;}).length")) === 0 && (await H.msg()) === '固定約停了', '按「停」：固定約結束，還沒到的那一行拿掉');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
