// 表格世界：十二張表都打得開；780×360 每張表不用左右滑，360×780 有「轉橫看整張表」；序號框、隨機、他的表格世界、回我自己；
// 用手指走一遍：找人 → 他的時段 → 預約（到達預設勾著）→ 選東西 → 那一微秒白光 → 背包兌現。
// node v9/tests/t_table.js <test9.html> [截圖資料夾]
var lib = require('./lib'), assert = lib.assert, path = require('path');
var OUT = process.argv[3] || path.join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003';
var SHEETS = ['today', 'notices', 'find', 'booked', 'myslots', 'role', 'rules', 'resources', 'bag', 'calendar', 'house', 'help'];
var fits = "(function(){var m=document.getElementById('tmain');var ts=[...m.querySelectorAll('table')];return {ok:m.scrollWidth<=m.clientWidth+1&&ts.every(function(t){return t.getBoundingClientRect().right<=innerWidth+1;}),w:ts.map(function(t){return Math.round(t.scrollWidth);}).join(','),main:m.scrollWidth+'/'+m.clientWidth,win:innerWidth};})()";
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  assert((await H.ev("typeof GAME")) === 'undefined' && (await H.ev("document.getElementById('swapToSheet')")) === null && (await H.ev("document.getElementById('view-house').hidden")) === true, '做事都在表格世界：沒有裡世界、切換鈕；3D 只畫達秒屋（沒打開）');
  // 讓表有內容：一個一起成交的預約、別人預約我的時段、一張公告、一筆保留
  await H.ev("(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+600e6,2,null,t,true);CORE.book(S,'" + J1 + "',s.id,t);var m=S.roles[0].slots[0];CORE.book(S,'" + J2 + "',m.id,t);CORE.postNotice(S,'" + J1 + "',{need:'想找人一起跑步，早上在河堤',kind:'運動',give:['r1a','r1b'],cap:3,untilDay:CORE.dayNum(t)+3},t);APP.changed();})()");
  assert((await H.ev("Array.from(document.querySelectorAll('#tgroups button')).map(b=>b.textContent).join(',')")) === '今天,公告欄,預約,我的', '下方分頁是四組：今天、公告欄、預約、我的');
  // 1. 十二張表都打得開；780×360 每張都不用左右滑
  for (var k of SHEETS) {
    await H.nav(k);
    var f = await H.ev(fits);
    assert((await H.sheetName()) === k && f.ok, '「' + H.NAME[k] + '」打得開，780 寬不用左右滑（表 ' + f.w + '，畫面 ' + f.win + '）');
  }
  assert((await H.ev("Array.from(document.querySelectorAll('#ttabs button')).map(b=>b.textContent).join(',')")) === '角色,規則表,資源表,背包,日曆,我的達秒屋,說明', '「我的」這一組有七張表');
  await pg.screenshot({ path: OUT + '/v9_table_1_mine.png' });
  // 2. 序號框：簡寫、11 位數、找不到
  await H.serial('J2');
  assert((await H.sheetName()) === 'other:role' && (await pg.textContent('#tother')).indexOf('J2 阿澄 的表格世界') >= 0, '序號框輸入 J2 → 阿澄的表格世界，最上面寫是誰');
  assert((await H.ev("Array.from(document.querySelectorAll('#ttabs button')).map(b=>b.textContent).join(',')")) === '角色,規則表,資源表,時段', '他的表格世界上方切：角色、規則表、資源表、時段');
  assert((await H.main()).indexOf('換點比例') >= 0 && (await H.main()).indexOf('對接過幾次') >= 0 && (await H.ev("document.querySelectorAll('#tmain input, #tmain textarea').length")) === 0, '他的角色：每天的點、換點比例、對接過幾次；不能改');
  for (var o of ['rules', 'resources', 'slots']) { await H.otab(o); var f2 = await H.ev(fits); assert((await H.sheetName()) === 'other:' + o && f2.ok, '他的「' + H.NAME[o] + '」打得開、不用左右滑（表 ' + f2.w + '）'); }
  await H.otab('rules'); assert((await H.main()).indexOf('東恆家規') >= 0 && (await H.main()).indexOf('沒有家規網站：不收留言') >= 0 && (await H.main()).indexOf('村規') < 0, '他的規則表：家規（不叫村規）、沒有家規網站就寫不收留言');
  await H.otab('resources'); await H.clickText('看定義');
  assert((await H.sheetName()) === 'other:defs' && (await H.main()).indexOf('一份，三天內回') >= 0, '資源表的「看定義」連到定義表（完整定義）');
  await H.clickText('← 回資源表'); assert((await H.sheetName()) === 'other:resources', '定義表可以回資源表');
  await H.clickText('回我自己', '#tother'); assert((await H.ev("TABLE.ui.other")) === null && (await pg.textContent('#tother')).indexOf('我是 J1 我') >= 0, '「回我自己」');
  await H.serial('00000000003'); assert((await pg.textContent('#tother')).indexOf('J3 小樂') >= 0, '序號框輸入 11 位數也找得到');
  await H.serial('J9'); assert((await H.msg()).indexOf('找不到序號 J9') >= 0 && (await pg.textContent('#tother')).indexOf('J3 小樂') >= 0, '找不到就提示，留在原地');
  await H.serial('j1'); assert((await H.ev("TABLE.ui.other")) === null, '輸入自己的序號就回自己');
  // 3. 隨機：跳到一個還在玩、不是自己的人
  var seen = {}, allOk = true;
  for (var i = 0; i < 12; i++) { await H.click('#randomBtn'); var who = await H.ev("TABLE.ui.other"); if (!(who && who !== J1 && (await H.ev("!!CORE.roleOf(APP.state(),'" + who + "')")))) allOk = false; seen[who] = 1; }
  assert(allOk, '按「隨機」12 次都跳到一個還在玩、不是自己的人');
  assert(Object.keys(seen).length >= 2, '隨機跳過好幾個人：' + Object.keys(seen).join(','));
  await H.clickText('回我自己', '#tother');
  // 4. 直放 360×780：有「轉橫看整張表」；轉橫就不顯示
  assert((await H.ev("document.getElementById('rotHint').offsetHeight")) === 0, '轉橫時沒有「轉橫看整張表」');
  await pg.setViewportSize({ width: 360, height: 780 }); await pg.waitForTimeout(200); await H.nav('booked');
  assert((await H.ev("document.getElementById('rotHint').offsetHeight")) > 0 && (await pg.textContent('#rotHint')) === '轉橫看整張表', '直放時最上面一行小字「轉橫看整張表」');
  assert((await H.ev("(function(){var w=document.querySelector('#tmain .tw');return w.scrollWidth>w.clientWidth;})()")), '直放時表可以左右滑');
  await pg.screenshot({ path: OUT + '/v9_table_2_portrait.png' });
  await pg.setViewportSize({ width: 780, height: 360 }); await pg.waitForTimeout(200);

  // 5. 用手指走一遍：找人 → 他的時段 → 預約（到達預設勾著）→ 選東西 → 那一微秒白光 → 背包兌現
  await H.fresh();
  await H.ev("(function(){var S=APP.state(),t=APP.now();CORE.addSlot(S,'" + J2 + "',t+40e6,1,null,t);APP.changed();})()");
  await H.nav('find');
  assert((await H.main()).indexOf('J2') >= 0 && (await H.main()).indexOf('通：') >= 0, '找人：我可以去找的人，標我通不通');
  await H.finger("function(){ return [...document.querySelectorAll('#tmain tr[data-id=\"" + J2 + "\"] button')].find(function(b){return b.textContent==='看他的時段';}); }", '阿澄的「看他的時段」');
  assert((await H.sheetName()) === 'other:slots', '到他的表格世界的時段');
  var sid = await H.ev("CORE.roleOf(APP.state(),'" + J2 + "').slots.filter(function(s){return !s.judged;}).sort(function(a,b){return a.atUs-b.atUs;})[0].id");
  assert((await H.ev("document.getElementById('arr_" + sid + "').checked")) === true, '「約他」旁邊到達的勾預設勾著');
  await H.finger("function(){ return document.querySelector('#tmain [data-act=\"book\"][data-id=\"" + sid + "\"]'); }", '約他');
  assert((await H.sheetName()) === 'booked' && (await H.ev("CORE.isPresent(APP.state(),'" + J1 + "','" + sid + "')")) === true, '約好了：跳到我預約的，到達也確認了');
  assert((await H.msg()).indexOf('到達也確認了') >= 0, '提示寫約好了、到達也確認了');
  await H.click('#tmain [data-act="wantAdd"][data-res="r2a"]');
  assert((await H.ev("CORE.wantsOf(CORE.slotOf(APP.state(),'" + sid + "').slot,'" + J1 + "','" + J2 + "').join()")) === 'r2a', '選了阿澄的改履歷');
  await H.ev("(function(){var S=APP.state();CORE.setWants(S,'" + sid + "','" + J2 + "','" + J1 + "',['r1b']);APP.changed();})()");   // 單機版主人不在：替阿澄選我的早餐
  var before = await H.ev("CORE.remainingToday(APP.state(),APP.me(),APP.now())");
  await H.ev("window.__flashed=false;new MutationObserver(function(){if(document.getElementById('flash').classList.contains('go'))window.__flashed=true;}).observe(document.getElementById('flash'),{attributes:true})");
  await H.soon(sid, 3);
  await pg.waitForFunction("!document.getElementById('pop').hidden", null, { timeout: 15000 });
  assert((await H.popTitle()) === '到達那微秒' && (await H.popBody()).indexOf('我拿出：早餐一頓（100 點）；拿到：阿澄的改履歷（100 點）') >= 0, '那一微秒跳出成交結果：' + (await H.popBody()));
  assert(await H.ev("window.__flashed"), '成交那一刻整個畫面白光一閃');
  assert((await H.ev("CORE.remainingToday(APP.state(),APP.me(),APP.now())")) === before - 100, '能量往下降 100');
  await pg.screenshot({ path: OUT + '/v9_table_3_docked.png' });
  await H.popOk();
  await H.nav('bag');
  assert((await H.main()).indexOf('今天還能給') >= 0 && (await H.rows('bag')) === 1 && (await H.main()).indexOf('改履歷') >= 0, '背包：上面寫今天還能給多少點，有一筆阿澄的改履歷');
  await H.clickText('兌現', '#tmain');
  assert((await H.rows('bag')) === 0 && (await H.ev("APP.state().holds.find(function(h){return h.holder==='" + J1 + "';}).status")) === 'redeemed' && (await H.msg()) === '換到了', '在背包直接兌現，換到了');
  await H.nav('calendar');
  var today = await H.ev("CORE.dayNum(APP.now())");
  assert((await H.ev("document.querySelector('#tmain .cal [data-day=\"" + today + "\"]').className")).indexOf('lit1') >= 0, '日曆一格一天：今天那一格亮了');
  await H.click('#tmain .cal [data-day="' + today + '"]');
  assert((await H.popOpen()) && (await H.popBody()).indexOf('成交') >= 0 && (await H.popBody()).indexOf('換了 ') >= 0, '點今天那一格：那天的明細，改履歷寫「換了」'); await H.popOk();
  // 版面 1：780×300 在我預約的往下滑以後，序號框和分頁捲出畫面、表頭還在，表頭下面看得到的高度至少 200
  await H.ev("(function(){var S=APP.state(),t=APP.now();for(var k=0;k<3;k++){var s=CORE.addSlot(S,'" + J2 + "',t+(900+k*60)*1e6,2,null,t);CORE.book(S,'" + J1 + "',s.id,t);CORE.setWants(S,s.id,'" + J1 + "','" + J2 + "',['r2b']);}APP.changed();})()");
  await pg.setViewportSize({ width: 780, height: 300 }); await H.nav('booked'); await pg.mouse.move(390, 200); await pg.mouse.wheel(0, 260); await pg.waitForTimeout(300);
  var lay = await H.ev("(function(){var th=document.querySelector('#tmain thead th').getBoundingClientRect(),bar=document.querySelector('.tbar').getBoundingClientRect(),tabs=document.getElementById('ttabs').getBoundingClientRect(),g=document.getElementById('tgroups').getBoundingClientRect();return {sy:scrollY,thTop:th.top,thBottom:th.bottom,bar:bar.bottom,tabs:tabs.bottom,groupsTop:g.top,win:innerHeight};})()");
  assert(lay.sy > 0 && lay.bar <= 0 && lay.tabs <= 0, '往下滑：序號框和上方分頁跟著捲出畫面（' + JSON.stringify(lay) + '）');
  assert(lay.thTop >= -1 && lay.thTop <= 2 && lay.groupsTop < lay.win && lay.groupsTop - lay.thBottom >= 200, '表頭貼在最上面、下方四組留著，表頭下面看得到 ' + Math.round(lay.groupsTop - lay.thBottom) + ' 高');
  // 版面 2：360×780 每張表跟 780 寬時一樣寬；版面 3：每張表的輸入格提示字和內容沒被切掉
  var widths = {}, cut = [];
  var checkInputs = "(function(){var c=document.createElement('canvas').getContext('2d'),bad=[];document.querySelectorAll('#tmain input[type=text],#tmain input[type=number],#tmain input[type=search],#tmain input[type=url]').forEach(function(el){var cs=getComputedStyle(el);if(el.offsetParent===null)return;c.font=cs.fontStyle+' '+cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;var need=Math.max(c.measureText(el.value||'').width,c.measureText(el.placeholder||'').width);var room=el.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)-(el.type==='number'?16:0);if(need>room+1)bad.push((el.id||el.dataset.ed)+':'+Math.round(need)+'>'+Math.round(room));});return bad;})()";
  await pg.setViewportSize({ width: 780, height: 360 });
  for (var k2 of SHEETS) { await H.nav(k2); widths[k2] = await H.ev("Array.from(document.querySelectorAll('#tmain .ws')).map(function(t){return Math.round(t.getBoundingClientRect().width);}).join(',')"); cut = cut.concat((await H.ev(checkInputs)).map(function (x) { return k2 + '/' + x; })); }
  await pg.setViewportSize({ width: 360, height: 780 }); var same = true, diff = [];
  for (var k3 of SHEETS) { await H.nav(k3); var w3 = await H.ev("Array.from(document.querySelectorAll('#tmain .ws')).map(function(t){return Math.round(t.getBoundingClientRect().width);}).join(',')"); if (w3 !== widths[k3]) { same = false; diff.push(k3 + ' ' + w3 + '≠' + widths[k3]); } cut = cut.concat((await H.ev(checkInputs)).map(function (x) { return '直放 ' + k3 + '/' + x; })); }
  assert(same, '360×780 每張表跟 780 寬時一樣寬' + (diff.length ? '：' + diff.join('；') : ''));
  await pg.setViewportSize({ width: 780, height: 360 });
  assert(!cut.length, '每張表的輸入格提示字和內容都沒被切掉' + (cut.length ? '：' + cut.join('；') : ''));

  // 6. 存檔用新的名字；第一次打開讀得到 v8 的存檔就搬過來，讀不了就從頭開始
  await H.ev("(function(){var st=CORE.fresh();CORE.demoMe(st,APP.now());st.v=8;delete st.notices;st.tutorial={step:'done'};st.roles[0].name='舊的我';localStorage.clear();localStorage.setItem('arrive-v8',JSON.stringify(st));})()");
  await pg.reload(); await pg.waitForTimeout(500);
  assert((await H.ev("APP.me().name")) === '舊的我' && (await H.ev("!!localStorage.getItem('arrive-v9')")) && (await H.ev("APP.state().notices.length")) === 1, '讀得到 v8 的存檔就搬過來，存成新名字，補上引路人的公告');
  await H.ev("localStorage.clear();localStorage.setItem('arrive-v8','{壞掉的')"); await pg.reload(); await pg.waitForTimeout(500);
  assert((await H.ev("APP.isBlank()")) && (await H.sheetName()) === 'role', 'v8 存檔讀不了就從頭開始（創角色），不會壞掉');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
