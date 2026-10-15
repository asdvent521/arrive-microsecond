// 五張紙：事件簿、日曆、資源表、公告欄、更多都是 A4 橫式（297:210），一打開是今天的事件簿，780×360 看整張、360×780 可以左右滑、有「轉橫看整張紙」；
// 序號或密鑰框（簡寫、11 位數、找不到、自己）、回我自己；事件簿翻天、點日期到日曆紙（前後一個月、每格跟磚一樣、點一格翻到那天、他的日曆照藏）、空白那一行寫時間開時段；
// 用手指走一遍：公告欄約他 → 事件簿那一行選他的東西、會到、取消再約 → 那一微秒白光、那一行成交、紅字簽名、今天還剩 → 那一行兌現 → 下面那張（以前收到的）兌現；
// 資源表：空白行加一樣、勾種類、價錢明天起、補／減、下架；更多 → 規則表每人最多給的預設；他的那張紙不能改、約他；讀 v8 存檔。
// node v9/tests/t_sheets.js <test9.html> [截圖資料夾]
var lib = require('./lib'), assert = lib.assert, path = require('path');
var OUT = process.argv[3] || path.join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003';
var ASPECT = "(function(){var p=document.querySelector('#tmain section.page');if(!p)return null;var b=p.getBoundingClientRect(),s=document.querySelector('.scroll');return {r:b.width/b.height,w:Math.round(b.width),h:Math.round(b.height),fits:b.right<=innerWidth+1,scroll:s.scrollWidth>s.clientWidth+1};})()";
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  assert((await H.ev("typeof GAME")) === 'undefined' && (await H.ev("typeof TABLE !== 'undefined' && TABLE === SHEETS")) && (await H.ev("document.getElementById('view-house').hidden")) === true, '做事都在表格世界（五張紙）：沒有裡世界；3D 只畫達秒屋（沒打開）');
  assert((await H.ev("Array.from(document.querySelectorAll('#ttabs .tab')).map(b=>b.textContent).join(',')")) === '事件簿,日曆,資源表,公告欄,更多' && (await H.ev("document.getElementById('serialIn').placeholder")) === '序號或密鑰' && (await H.ev("document.getElementById('diceBtn').title")) === '隨機骰一個序號', '最上面一列：「序號或密鑰」框、去、骰子（隨機骰一個序號）、五張紙的分頁');
  await pg.reload(); await pg.waitForTimeout(500);
  assert((await H.sheetName()) === 'log' && (await H.ev("SHEETS.ui.day")) === null && (await H.main()).indexOf('事件簿') >= 0, '一打開是今天的事件簿');
  // 1. 五張紙都是 A4 橫式，780×360 整張放得下
  await H.nav('log'); assert((await H.ev("Array.from(document.querySelectorAll('#tmain thead th')).map(function(t){return t.firstChild.textContent;}).join(',')")) === '時間,跟誰,我給他,我收到,結果,今天還剩,對方簽名,兌現,哪天收到的,誰的,什麼東西,兌現・對方簽名', '事件簿的欄位跟紙本一樣（主表八欄、下面那張四欄）');
  var ratios = {};
  for (var k of ['log', 'cal', 'res', 'find', 'more']) {
    await H.nav(k); var a = await H.ev(ASPECT); ratios[k] = a;
    assert(a && a.fits && Math.abs(a.r - 297 / 210) < 0.06, '「' + H.NAME[k] + '」是一張 A4 橫式（' + a.w + '×' + a.h + '，比例 ' + a.r.toFixed(3) + '），780 寬整張放得下');
    await pg.screenshot({ path: OUT + '/v9_sheet_' + k + '.png', fullPage: true });
  }
  for (var m of ['rules', 'together', 'greet', 'slots', 'house', 'village', 'role', 'help']) { await H.nav(m); var a2 = await H.ev(ASPECT); assert(a2 && a2.fits && a2.r <= 297 / 210 + 0.06, '更多 →「' + H.NAME[m] + '」也是一張紙（' + a2.w + '×' + a2.h + '）'); }
  // 2. 360×780 直放：有「轉橫看整張紙」、紙可以左右滑、還是同一個比例
  await pg.setViewportSize({ width: 360, height: 780 }); await pg.waitForTimeout(200); await H.nav('log');
  var p = await H.ev(ASPECT);
  assert((await H.ev("document.getElementById('rotHint').offsetHeight")) > 0 && (await pg.textContent('#rotHint')) === '轉橫看整張紙', '直放時最上面一行小字「轉橫看整張紙」');
  assert(p.scroll && Math.abs(p.r - 297 / 210) < 0.06 && p.w >= 680, '直放時紙可以左右滑、比例不變（' + p.w + '×' + p.h + '）');
  for (var k2 of ['log', 'cal', 'res', 'find', 'more']) { await H.nav(k2); await pg.screenshot({ path: OUT + '/v9_sheet_' + k2 + '_portrait.png', fullPage: true }); }
  await pg.setViewportSize({ width: 780, height: 360 }); await pg.waitForTimeout(200); await H.nav('log');
  assert((await H.ev("document.getElementById('rotHint').offsetHeight")) === 0, '轉橫就沒有那行字');
  // 3. 序號或密鑰框：簡寫、11 位數、找不到、自己；他的那張紙不能改
  await H.serial('J2');
  assert((await H.sheetName()) === 'other:res' && (await pg.textContent('#tother')).indexOf('J2 阿澄 的那張紙') >= 0, '序號框輸入 J2 → 阿澄的資源表那張紙，最上面寫是誰');
  var om = await H.main();
  assert(om.indexOf('換點比例') >= 0 && om.indexOf('對接過') >= 0 && om.indexOf('他的時段') >= 0 && om.indexOf('不能改') >= 0 && (await H.ev("document.querySelectorAll('#tmain input:not([type=checkbox]), #tmain textarea, #tmain select').length")) === 0, '他的資源表：換點比例、對接過幾次、他的時段；格子不能改');
  assert(['看他的規則', '看他的達秒屋', '跟他設打招呼密鑰', '回我自己'].every(function (t) { return om.indexOf(t) >= 0; }), '下面有看他的規則、看他的達秒屋、跟他設打招呼密鑰、回我自己');
  await H.clickText('看他的規則', '#tmain'); assert((await H.sheetName()) === 'other:orules' && (await H.main()).indexOf('沒有家規網站：不收留言') >= 0, '看他的規則：沒有家規網站就寫不收留言');
  await H.clickText('‹ 他的資源表', '#tmain'); assert((await H.sheetName()) === 'other:res', '回他的資源表');
  await H.clickText('回我自己', '#tother'); assert((await H.ev("SHEETS.ui.other")) === null && (await pg.textContent('#tother')).indexOf('我是 J1 我') >= 0, '「回我自己」');
  await H.serial('00000000003'); assert((await pg.textContent('#tother')).indexOf('J3 小樂') >= 0, '序號框輸入 11 位數也找得到');
  await H.serial('J9'); assert((await H.msg()).indexOf('找不到序號或密鑰 J9') >= 0 && (await pg.textContent('#tother')).indexOf('J3 小樂') >= 0, '找不到就提示，留在原地');
  await H.serial('j1'); assert((await H.ev("SHEETS.ui.other")) === null && (await H.sheetName()) === 'res', '輸入自己的序號就回自己的資源表');
  // 4. 事件簿：一天一張、前一天／後一天／今天、點日期跳小日曆翻到那天
  await H.nav('log'); var today = await H.ev("CORE.dayNum(APP.now())"), dayOf = function () { return H.ev("SHEETS.ui.day == null ? CORE.dayNum(APP.now()) : SHEETS.ui.day"); };
  await H.clickText('‹ 前一天', '#tmain'); assert((await dayOf()) === today - 1 && (await H.main()).indexOf(await H.ev("CORE.dayLabel(" + (today - 1) + ").slice(8,10).replace(/^0/,'')+' 日'")) >= 0, '前一天：日期欄換成昨天');
  await H.clickText('後一天 ›', '#tmain'); await H.clickText('後一天 ›', '#tmain'); assert((await dayOf()) === today + 1, '後一天：明天');
  await H.clickText('今天', '#tmain'); assert((await dayOf()) === today, '「今天」回到今天');
  // 點日期：到日曆紙的那個月；前一個月／後一個月；點一格翻到那天的事件簿（還沒到的日子也能點）
  await H.clickText('‹ 前一天', '#tmain'); await H.click('#tmain [data-act="pickDay"]');
  var ymT = await H.ev("JSON.stringify(KIT.ymOf(" + (today - 1) + "))"), calYM = function () { return H.ev("(function(){var t=document.querySelector('#tmain table.calp');return JSON.stringify({y:+t.dataset.y,m:+t.dataset.m});})()"); };
  assert((await H.sheetName()) === 'cal' && (await calYM()) === ymT && (await H.ev("document.querySelectorAll('#tmain table.calp td.day').length")) >= 28, '事件簿點日期：到日曆紙，翻在那一天的那個月（一格一天）');
  await H.clickText('‹ 前一個月', '#tmain'); var prevYM = JSON.parse(await calYM()); var tY = JSON.parse(ymT);
  assert(prevYM.m === (tY.m + 11) % 12 && (await H.ev("document.querySelectorAll('#tmain table.calp td.day').length")) >= 28, '前一個月：' + (prevYM.m + 1) + ' 月');
  await H.clickText('後一個月 ›', '#tmain'); assert((await calYM()) === ymT, '後一個月回來');
  assert((await H.ev("document.querySelector('#tmain table.calp td.today').dataset.day")) === String(today) && (await H.ev("document.querySelectorAll('#tmain table.calp td.none').length")) >= 0, '今天那格紅框');
  await H.finger("function(){ return document.querySelector('#tmain table.calp td[data-act=\"calDay\"][data-day=\"" + (today + 1) + "\"]'); }", '明天那一格');
  assert((await H.sheetName()) === 'log' && (await dayOf()) === today + 1 && (await H.ev("!!document.getElementById('addSlotTime')")), '點還沒到的那一格：翻到那天的事件簿，可以開時段');
  await H.clickText('今天', '#tmain');
  // 5. 空白那一行寫時間就開一個時段（名額可以改）；刪
  await H.clickText('後一天 ›', '#tmain'); await H.edit('#addSlotCap', 2); await H.edit('#addSlotTime', '12:00');
  var opened = await H.ev("(function(){var s=APP.me().slots.filter(function(x){return CORE.dayNum(x.atUs)===" + (today + 1) + ";});return s.length?{id:s[0].id,cap:s[0].capacity,hh:CORE.fmtUs(s[0].atUs).slice(11,16)}:null;})()");
  assert(opened && opened.cap === 2 && opened.hh === '12:00' && (await H.msg()) === '開了時段，等人來約', '明天那張紙的空白行寫 12:00、名額 2：開了時段');
  var openRow = await H.ev("document.querySelector('#tmain tr[data-id=\"" + opened.id + "\"]').textContent"); assert(openRow.indexOf('我開的') >= 0 && openRow.indexOf('0／2') >= 0, '那一行：我開的、等人來約（0／2）');
  await H.finger("function(){ return document.querySelector('#tmain tr[data-id=\"" + opened.id + "\"] [data-act=\"delSlot\"]'); }", '刪'); assert((await H.ev("APP.me().slots.some(function(x){return x.id==='" + opened.id + "';})")) === false, '刪掉沒人約的時段');
  await H.clickText('今天', '#tmain');
  // 6. 用手指走一遍：公告欄約他 → 事件簿那一行（淡黃、倒數、選他的東西、會到、取消）
  await H.ev("(function(){var S=APP.state(),t=APP.now();CORE.addSlot(S,'" + J2 + "',t+40e6,1,null,t);APP.changed();})()");
  await H.nav('find');
  assert((await H.main()).indexOf('誰的資源表裡有東西') >= 0 && (await H.ev("document.querySelector('#tmain tr[data-id=\"" + J2 + "\"]').textContent")).indexOf('通') >= 0, '公告欄下半：誰的資源表裡有東西，標我通不通');
  await H.finger("function(){ return document.querySelector('#tmain tr[data-id=\"" + J2 + "\"] [data-act=\"bookNext\"]'); }", '阿澄的「約他」');
  var sid = await H.ev("CORE.roleOf(APP.state(),'" + J2 + "').slots.filter(function(s){return !s.judged&&s.bookings.indexOf('" + J1 + "')>=0;})[0].id");
  var eid = await H.ev("CORE.entriesOf(APP.state()).find(function(e){return e.slot==='" + sid + "';}).id");
  assert((await H.sheetName()) === 'log' && (await H.ev("CORE.isPresent(APP.state(),'" + J1 + "','" + sid + "')")) === true && (await H.msg()).indexOf('約好了，會到也勾了') >= 0, '約好了：跳到事件簿那天，會到也勾了');
  var row = "document.querySelector('#tmain tr[data-id=\"" + eid + "\"]')";
  assert((await H.ev(row + ".className")).indexOf('future') >= 0 && (await H.ev(row + ".querySelector('[data-left]').textContent")).indexOf('還有') >= 0 && (await H.ev(row + ".querySelector('input[data-ed=present]').checked")) === true && (await H.ev(row + ".textContent")).indexOf('到時候自動簽') >= 0, '那一行淡黃：倒數、會到勾著、「到時候自動簽」');
  await H.finger("function(){ return " + row + ".querySelector('[data-act=\"cancelBook\"]'); }", '取消'); assert((await H.ev("CORE.slotOf(APP.state(),'" + sid + "').slot.bookings.length")) === 0 && (await H.msg()) === '取消預約了', '取消：那一行不見');
  await H.serial('J2'); await H.finger("function(){ return document.querySelector('#tmain [data-act=\"book\"][data-id=\"" + sid + "\"]'); }", '他的時段旁邊的「約他」');
  eid = await H.ev("CORE.entriesOf(APP.state()).find(function(e){return e.slot==='" + sid + "'&&e.status==='booked';}).id"); row = "document.querySelector('#tmain tr[data-id=\"" + eid + "\"]')";
  assert((await H.sheetName()) === 'log' && (await H.ev(row + " !== null")), '從他的那張紙再約：事件簿多一行');
  await H.finger("function(){ return " + row + ".querySelector('[data-act=\"pick\"]'); }", '選他的東西');
  assert((await H.popOpen()) && (await H.popTitle()).indexOf('選 阿澄 的東西') >= 0, '跳出選阿澄的東西');
  await H.click('#popBody [data-add="r2a"]'); await H.popOk('選好了');
  assert((await H.ev("CORE.wantsOf(CORE.slotOf(APP.state(),'" + sid + "').slot,'" + J1 + "','" + J2 + "').join()")) === 'r2a' && (await H.ev(row + ".textContent")).indexOf('改履歷') >= 0, '選了阿澄的改履歷，寫在我收到那格');
  await H.ev("(function(){var S=APP.state();CORE.setWants(S,'" + sid + "','" + J2 + "','" + J1 + "',['r1b']);APP.changed();})()");
  assert((await H.ev(row + ".textContent")).indexOf('早餐一頓・100') >= 0, '他選了我的早餐，寫在我給他那格');
  // 7. 那一微秒：白光、那一行成交、紅字簽名、今天還剩往下
  var before = await H.ev("CORE.remainingToday(APP.state(),APP.me(),APP.now())");
  await H.ev("window.__flashed=false;new MutationObserver(function(){if(document.getElementById('flash').classList.contains('go'))window.__flashed=true;}).observe(document.getElementById('flash'),{attributes:true})");
  await H.soon(sid, 3);
  await pg.waitForFunction("!document.getElementById('pop').hidden", null, { timeout: 15000 });
  assert((await H.popTitle()) === '到達那微秒' && (await H.popBody()).indexOf('我給他：早餐一頓（100 點）') >= 0 && (await H.popBody()).indexOf('我收到：阿澄的改履歷') >= 0 && (await H.popBody()).indexOf('系統已經替兩邊簽名') >= 0, '那一微秒跳出成交結果（我給他、我收到、系統簽名）：' + (await H.popBody()));
  assert((await H.ev("window.__flashed")), '成交那一刻整個畫面白光一閃');
  assert((await H.ev("!!document.querySelector('#popBody [data-daily]')")), '成交結果裡可以勾「以後每天這個時間自動約」');
  await pg.screenshot({ path: OUT + '/v9_sheet_docked.png' }); await H.popOk();
  var cells = await H.ev("Array.from(" + row + ".querySelectorAll('td')).map(function(td){return td.textContent.trim();})");
  assert(cells[4] === '成交' && cells[5] === String(before - 100) && (await H.ev(row + ".querySelector('td:nth-child(7) .sig').textContent")) === '阿澄' && (await H.ev("getComputedStyle(" + row + ".querySelector('.sig')).color")) === 'rgb(162, 57, 43)', '那一行變成交、今天還剩 ' + (before - 100) + '、對方簽名紅字「阿澄」');
  assert((await H.ev("CORE.remainingToday(APP.state(),APP.me(),APP.now())")) === before - 100 && (await pg.textContent('#energyText')) === String(before - 100), '現在還能給往下降 100');
  // 8. 兌現：在那一行按；以前收到的在下面那張小表
  await H.finger("function(){ return " + row + ".querySelector('[data-act=\"redeem\"]'); }", '兌現'); await H.popOk('換到了');
  assert((await H.ev("APP.state().holds.find(function(h){return h.holder==='" + J1 + "';}).status")) === 'redeemed' && (await H.ev(row + ".querySelector('td:nth-child(8) .sig').textContent")) === '阿澄' && (await H.msg()) === '換到了', '在那一行兌現：換到了，兌現格有紅字簽名');
  await H.ev("(function(){var S=APP.state(),t=APP.now(),s=CORE.addSlot(S,'" + J2 + "',t+1.5e6,1,null,t);CORE.book(S,'" + J1 + "',s.id,t);CORE.setWants(S,s.id,'" + J1 + "','" + J2 + "',['r2b']);CORE.setWants(S,s.id,'" + J2 + "','" + J1 + "',['r1a']);APP.changed();})()");
  await pg.waitForFunction("APP.state().holds.filter(function(h){return h.holder==='" + J1 + "'&&h.status==='held';}).length===1", null, { timeout: 15000 }); await pg.waitForTimeout(300); await H.popOk();
  await H.ev("(function(){var h=APP.state().holds.find(function(h){return h.holder==='" + J1 + "'&&h.status==='held';});h.atUs-=86400e6;APP.changed();})()");   // 當作是昨天收到的
  var held = await H.ev("(function(){var t=[...document.querySelectorAll('#tmain table')][1];return t.querySelectorAll('tr[data-row]').length+':'+t.textContent;})()");
  assert(held.indexOf('1:') === 0 && held.indexOf('一小時諮詢') >= 0 && held.indexOf('阿澄') >= 0, '下面那張：以前收到、還沒兌現的一筆（阿澄的一小時諮詢）');
  await H.finger("function(){ return [...document.querySelectorAll('#tmain table')][1].querySelector('[data-act=\"redeem\"]'); }", '下面那張的兌現'); await H.popOk('換到了');
  assert((await H.ev("APP.state().holds.filter(function(h){return h.holder==='" + J1 + "'&&h.status==='redeemed';}).length")) === 2 && (await H.ev("[...document.querySelectorAll('#tmain table')][1].querySelector('.sig').textContent")) === '阿澄', '兌現了，簽名變紅字、還留在那張上');
  // 8b. 日曆紙每格跟達秒屋的磚一樣（同一份 viewHouse）；他的日曆照藏的規則
  await H.nav('cal');
  var same = await H.ev("(function(){var v=CORE.viewHouse(APP.state(),'" + J1 + "','" + J1 + "',APP.now()),bad=[];v.bricks.forEach(function(b){var td=document.querySelector('#tmain table.calp td[data-day=\"'+b.day+'\"]');if(!td)return;var cls=KIT.cellCls(b).split(' ');cls.forEach(function(c){if(!td.classList.contains(c))bad.push(b.day+':'+c);});});var t=document.querySelector('#tmain table.calp td.today');return {bad:bad,today:t&&t.classList.contains('lit2'),ev:t?t.textContent:'',n:v.bricks.length};})()");
  assert(same.bad.length === 0 && same.today && same.ev.indexOf('阿澄') >= 0 && same.ev.indexOf('約') < 0, '每格的亮度和小記號跟達秒屋的磚一樣（' + same.n + ' 塊）；今天兩筆成交亮兩級、寫幾點跟誰');
  assert((await H.main()).indexOf('這個月成交 2 次') >= 0, '這個月的合計：成交 2 次');
  await H.serial('J2'); await H.clickText('看他的日曆', '#tmain');
  assert((await H.sheetName()) === 'other:cal' && (await pg.textContent('#tother')).indexOf('J2 阿澄 的日曆') >= 0 && (await H.ev("document.querySelector('#tmain table.calp td.today').textContent")).indexOf('我') >= 0, '他的那張紙「看他的日曆」：阿澄的日曆，今天那格寫跟我的那幾筆');
  await H.ev("(function(){var S=APP.state();CORE.entriesOf(S).filter(function(e){return e.status==='traded'&&(e.a==='" + J2 + "'||e.b==='" + J2 + "');}).forEach(function(e){CORE.setVis(S,'" + J2 + "',e.id,'hidden');});APP.changed();})()");
  var otherView = await H.ev("(function(){var td=document.querySelector('#tmain table.calp td.today');return td.className+'|'+td.textContent;})()");
  assert(otherView.indexOf('蓋著') >= 0 || otherView.indexOf('lit') >= 0, '阿澄把那幾筆全藏：對接的人照樣看得到（' + otherView.replace(/\s+/g, ' ') + '）');
  await H.finger("function(){ return document.querySelector('#tmain table.calp td.today'); }", '他的日曆今天那一格'); assert((await H.popOpen()) && (await H.popTitle()).indexOf('阿澄') >= 0, '點他的一格：看那天的明細'); await H.popOk();
  await H.clickText('回我自己', '#tother');
  // 9. 資源表：空白行加一樣、勾種類、價錢明天起、補／減、下架
  await H.nav('res'); var n0 = await H.ev("CORE.version(APP.me(),APP.now()).resources.length");
  await H.edit('#tmain input[data-new="res"]', '修水管');
  var nr = await H.ev("(function(){var p=CORE.pending(APP.me(),APP.now());var x=p.resources.find(function(y){return y.name==='修水管';});return x?{id:x.id,kind:x.kind,price:x.price,n:p.resources.length}:null;})()");
  assert(nr && nr.n === n0 + 1 && nr.price === 0 && (await H.msg()).indexOf('加了一樣') >= 0 && (await H.main()).indexOf('明天起新增') >= 0, '空白行寫名字就是加一樣（明天起新增）');
  await H.finger("function(){ return document.querySelector('#tmain [data-act=\"kind\"][data-id=\"" + nr.id + "\"][data-k=\"act\"]'); }", '種類「行為」');
  assert((await H.ev("CORE.pending(APP.me(),APP.now()).resources.find(function(y){return y.id==='" + nr.id + "';}).kind")) === 'act' && (await H.ev("document.querySelector('#tmain [data-act=\"kind\"][data-id=\"" + nr.id + "\"][data-k=\"act\"]').className")).indexOf('on') >= 0, '勾了種類「行為」，格子打勾');
  await H.edit('#tmain input[data-ed="resPrice"][data-id="r1a"]', 80);
  assert((await H.ev("CORE.pending(APP.me(),APP.now()).resources.find(function(y){return y.id==='r1a';}).price")) === 80 && (await H.ev("CORE.version(APP.me(),APP.now()).resources.find(function(y){return y.id==='r1a';}).price")) === 60 && (await H.ev("document.querySelector('#tmain tr[data-id=\"" + J1 + ":r1a\"]').textContent")).indexOf('明天起 80 點（今天 60）') >= 0, '改價錢：明天起 80，今天還是 60，旁邊寫出來');
  var av = await H.ev("CORE.stockOf(APP.me(),'r1b').avail");
  await H.finger("function(){ return document.querySelector('#tmain [data-act=\"stock\"][data-id=\"r1b\"][data-n=\"1\"]'); }", '補'); assert((await H.ev("CORE.stockOf(APP.me(),'r1b').avail")) === av + 1, '補：多一格');
  await H.finger("function(){ return document.querySelector('#tmain [data-act=\"stock\"][data-id=\"r1b\"][data-n=\"-1\"]'); }", '減'); assert((await H.ev("CORE.stockOf(APP.me(),'r1b').avail")) === av && (await H.ev("document.querySelectorAll('#tmain tr[data-id=\"" + J1 + ":r1b\"] .box').length")) >= av, '減：少一格；格子數跟份數一樣');
  await H.finger("function(){ return document.querySelector('#tmain [data-act=\"resMore\"][data-id=\"r1a\"]'); }", '…'); await H.popOk('下架');
  assert((await H.ev("!CORE.pending(APP.me(),APP.now()).resources.some(function(y){return y.id==='r1a';})")) && (await H.ev("CORE.version(APP.me(),APP.now()).resources.some(function(y){return y.id==='r1a';})")), '下架：明天起沒有，今天還在');
  assert((await H.ev("Array.from(document.querySelectorAll('#tmain thead th')).map(function(t){return t.firstChild.textContent;}).join(',')")) === '#,東西,種類,類別,怎樣算給到了,價錢,保留幾天,有幾份', '資源表的欄位跟紙本一樣（補十九多了類別）');
  // 10. 更多 → 規則表：每人最多給的預設
  await H.nav('rules'); await H.edit('#tmain [data-ed="maxGiveDefault"]', 500);
  assert((await H.ev("CORE.pending(APP.me(),APP.now()).rules.maxGiveDefault")) === 500 && (await H.msg()) === '改了，明天起算', '規則表：每人最多給的預設 500，明天起');
  await H.nav('slots'); assert((await H.rows('slots')) >= 1, '更多 → 我開的時段列出時段');
  await H.nav('role'); assert((await H.main()).indexOf('換人（測試用）') >= 0 && (await H.main()).indexOf('不玩了') >= 0, '角色設定：聯絡方式、不玩了、最下面換人');
  // 11. 讀得到 v8 的存檔就搬過來，讀不了從創角色開始
  await H.ev("(function(){var st=CORE.fresh();CORE.demoMe(st,APP.now());st.v=8;delete st.notices;st.tutorial={step:'done'};st.roles[0].name='舊的我';localStorage.clear();localStorage.setItem('arrive-v8',JSON.stringify(st));})()");
  await pg.reload(); await pg.waitForTimeout(500);
  assert((await H.ev("APP.me().name")) === '舊的我' && (await H.ev("!!localStorage.getItem('arrive-v9')")) && (await H.ev("APP.state().notices.length")) === 1 && (await H.sheetName()) === 'log', '讀得到 v8 的存檔就搬過來，存成新名字，打開在事件簿');
  await H.ev("localStorage.clear();localStorage.setItem('arrive-v8','{壞掉的')"); await pg.reload(); await pg.waitForTimeout(500);
  assert((await H.ev("APP.isBlank()")) && (await H.sheetName()) === 'res' && (await H.ev("!!document.getElementById('cName')")), 'v8 存檔讀不了就從頭開始（資源表那張紙創角色），不會壞掉');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
