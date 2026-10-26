// 新手教學（DESIGN 7-4，六步）都在表格世界用手指走完：創角色（資源表那張紙已經寫好「空的」）→ 骰子骰出序號、按「去」→ 公告欄打「空的」找到引路人按「約他」、事件簿那一行選他的「空的」
// → 那一微秒白光、那一行成交、紅字「引路人」→ 那一行兌現 → 去我的能量之家（你 0 歲，第一塊磚亮了，鏡頭靠近）。
// 教學的對接不算數、標「教學」；可以跳過（只做創角色，空物件的提醒照樣出現）；教學中跳過；全部還原又從創角色開始；舊存檔的八步對到六步。
// node v9/tests/t_tutorial.js <test9.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J4 = '00000000004';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  var step = function () { return H.ev("APP.tut().step"); };
  var waitStep = function (k) { return pg.waitForFunction("APP.tut().step === " + JSON.stringify(k), null, { timeout: 15000 }); };
  // ① 創角色：資源表那張紙已經寫好「空的」
  await H.fresh({ raw: true });
  assert((await H.ev("APP.state().me")) === -1 && (await H.ev("APP.state().roles.map(function(r){return r.name;}).join(',')")) === '阿澄,小樂,阿明,引路人', '示範版沒有預先放好「我」：第一次打開從創角色開始');
  assert((await H.sheetName()) === 'res' && (await pg.textContent('#tutbar')).indexOf('① 創角色') >= 0 && (await H.ev("!!document.querySelector('#tmain section.page[data-sheet=res]')")), '一打開就在資源表那張紙，上面一行寫新手教學 ① 創角色');
  assert((await H.ev("[document.getElementById('cDaily').value,document.getElementById('cItem').value,document.getElementById('cPrice').value,document.getElementById('cQty').value].join('/')")) === '2000/空的/0/1', '每天的點預設 2000，第一行「空的」0 點 1 份已經寫好');
  await H.setIn('cName', '小明'); await H.clickText('建立', '#tmain');
  await waitStep(2); await pg.waitForTimeout(300);
  assert((await H.ev("APP.me().serial")) === J1 && (await pg.isVisible('#view-house')) && (await pg.isHidden('#view-table')) && (await pg.textContent('#htut')).indexOf('② 寫前情提要') >= 0, '建立：J1 當下生效，到自己的能量之家，教學到 ② 寫前情提要');
  assert((await pg.isVisible('#tutbar')) === false && (await pg.isVisible('#htut [data-hact="tutSkip"]')), '能量之家上面有教學提示和「跳過教學」');
  assert((await H.ev("CORE.houseOf(APP.me()).blocks.length")) > 50 && (await H.ev("CORE.houseOf(APP.me()).cal.blocks.length")) === 1, '建好角色就有一間預設小屋和第一塊日曆');
  // ② 寫前情提要：首頁最上面已經寫好一句可以改的、給了自然 1 點；按「寫好了」扣 1 點、今天那塊磚亮起來
  assert((await H.ev("document.getElementById('natText').value")) === '今天喝了一杯水，帶著好心情開始今天的旅程' && (await H.ev("document.getElementById('natPts').value")) === '1' && (await pg.textContent('#hhome')).indexOf('寫好了') >= 0, '首頁前情提要先寫好一句可以改的，給了自然預設 1 點');
  await H.ev("document.getElementById('natText').value='今天喝了一杯水，帶著好心情開始今天的旅程，還澆了花'");
  await H.finger("function(){ return document.querySelector('#hhome [data-hact=\"natSave\"]'); }", '寫好了'); await waitStep(3); await pg.waitForTimeout(400);
  assert((await H.popTitle()).indexOf('亮＝今天跟自然交流過') >= 0 && (await H.ev("CORE.remainingToday(APP.state(),APP.me(),APP.now())")) === 1999 && (await H.ev("WORLD.info().lit")) === 1 && (await H.ev("WORLD.info().colored")) === 0 && (await H.ev("CORE.natureOf(APP.state(),'" + J1 + "',CORE.dayNum(APP.now())).text")).indexOf('還澆了花') >= 0, '寫好了：扣 1 點（還剩 1999）、今天那塊磚亮起來（還沒彩色），寫「亮＝今天跟自然交流過」');
  await H.popOk(); assert((await pg.textContent('#htut')).indexOf('③ 找陌生人：骰子') >= 0 && (await H.ev("CORE.natureOf(APP.state(),'" + J1 + "',CORE.dayNum(APP.now())).vis")) === 'hidden', '教學到 ③；教學時寫的前情提要是一般的（預設全藏）');
  await H.finger("function(){ return document.querySelector('#hhome [data-hact=\"toLog\"]'); }", '事件簿'); await pg.waitForTimeout(300);
  assert((await H.sheetName()) === 'log' && (await pg.textContent('#tutbar')).indexOf('③ 找陌生人：骰子') >= 0 && (await pg.isVisible('#tutbar [data-act="tutSkip"]')), '按事件簿到表格世界，上面一行教學 ③、有「跳過教學」');
  // ③ 骰子：骰出序號、按「去」
  var code = await H.dice(); assert(code && code !== 'J1' && (await step()) === 3 && (await H.ev("SHEETS.ui.other")) === null, '骰出 ' + code + '，還沒過去（按「去」才算走完 ③）');
  await H.click('#serialGo'); await waitStep(4);
  assert((await H.ev("CORE.abbrev(SHEETS.ui.other)")) === code && (await pg.textContent('#tutbar')).indexOf('④ 約引路人') >= 0, '按「去」到他的資源表，教學到 ④');
  await H.clickText('回我自己', '#tother');
  // ③ 公告欄打「空的」找到引路人，按「約他」；事件簿那一行選他的「空的」
  await H.nav('find'); await H.setIn('kwIn', '空的'); await H.clickText('找', '#tmain');
  var row4 = await H.ev("(function(){var tr=document.querySelector('#tmain tr[data-row][data-id]:not([data-id=\"post\"])');return tr?tr.textContent:'';})()");
  assert(row4.indexOf('J4') >= 0 && row4.indexOf('引路人') >= 0 && row4.indexOf('空的') >= 0 && row4.indexOf('沒有期限') >= 0, '公告欄打「空的」找到引路人的公告（需要：空的；可以給：空的；沒有期限）');
  await pg.waitForFunction("APP.tut().slot !== null", null, { timeout: 5000 });
  var sid = await H.ev("APP.tut().slot");
  await H.finger("function(){ return document.querySelector('#tmain tr[data-row] [data-act=\"bookNext\"][data-id=\"" + J4 + "\"]'); }", '引路人公告旁邊的「約他」');
  var eid = await H.ev("CORE.entriesOf(APP.state()).find(function(e){return e.slot==='" + sid + "';}).id"), row = "document.querySelector('#tmain tr[data-id=\"" + eid + "\"]')";
  assert((await H.sheetName()) === 'log' && (await H.ev(row + " !== null")) && (await H.ev("CORE.isPresent(APP.state(),'" + J1 + "','" + sid + "')")) === true && (await H.ev(row + ".textContent")).indexOf('教學') >= 0, '約好了：事件簿多一行（標教學），會到已經勾了');
  await H.finger("function(){ return " + row + ".querySelector('[data-act=\"pick\"]'); }", '選他的東西'); await H.click('#popBody [data-add="r4e"]'); await H.popOk('選好了'); await waitStep(5);
  var e = await H.ev("CORE.version(APP.me(),APP.now()).resources[0].id");
  assert((await H.ev("CORE.wantsValid(APP.state(),CORE.slotOf(APP.state(),'" + sid + "').slot,'" + J4 + "','" + J1 + "').join()")) === e && (await H.ev(row + ".textContent")).indexOf('空的・0') >= 0, '引路人一定選你的「空的」；教學到 ⑤');
  // ④ 那一微秒：白光、那一行成交、紅字「引路人」
  await H.ev("window.__flashed=false;new MutationObserver(function(){if(document.getElementById('flash').classList.contains('go'))window.__flashed=true;}).observe(document.getElementById('flash'),{attributes:true})");
  await H.soon(sid, 3);
  await pg.waitForFunction("!document.getElementById('pop').hidden", null, { timeout: 15000 });
  assert((await H.popBody()).indexOf('我給他：空的（0 點）；我收到：引路人的空的') >= 0 && (await H.ev("window.__flashed")) && !(await H.ev("!!document.querySelector('#popBody [data-daily]')")), '那一微秒白光一閃，跳出「我給他：空的；我收到：引路人的空的」（教學的不問固定約）');
  await waitStep(6); await H.popOk();
  assert((await H.ev(row + ".textContent")).indexOf('成交') >= 0 && (await H.ev(row + ".querySelector('td:nth-child(7) .sig').textContent")) === '引路人', '那一行變成交，對方簽名出現紅字「引路人」；教學到 ⑤');
  // ⑤ 在那一行兌現
  await H.finger("function(){ return " + row + ".querySelector('[data-act=\"redeem\"]'); }", '兌現'); await H.popOk('換到了'); await waitStep(7);
  assert((await pg.textContent('#tutbar')).indexOf('⑦ 看自己的能量之家') >= 0 && (await pg.isVisible('#tutbar [data-act="myHouse"]')), '兌現了，教學到 ⑦，上面有「去我的能量之家」');
  // ⑦ 去我的能量之家：你 0 歲，第一塊磚變彩色了
  await H.clickText('去我的能量之家', '#tutbar'); await waitStep('done'); await pg.waitForTimeout(400);
  assert((await H.ev("APP.view().name + ' ' + APP.view().serial")) === 'house ' + J1 && (await H.popTitle()).indexOf('你 0 歲，第一塊磚變彩色了') >= 0 && (await H.popBody()).indexOf('彩色＝今天跟人換過') >= 0, '到了自己的能量之家：跳出「你 0 歲，第一塊磚變彩色了」「彩色＝今天跟人換過」，教學結束');
  assert((await H.ev("WORLD.info().colored")) === 1 && (await H.ev("WORLD.info().lit")) === 1 && (await H.ev("WORLD.info().litColored")) === 1 && (await pg.isHidden('#htut')), '今天那塊磚變彩色（而且亮的：兩個都有）；教學提示收起來');
  var fc = await H.ev("(function(){var i=WORLD.info(),s=WORLD.screenOf({day:HOUSE.data().born}),c=document.querySelector('#hstage canvas').getBoundingClientRect();var el=document.elementFromPoint(s.x,s.y);return {focus:i.focus,born:HOUSE.data().born,dist:i.dist,dx:Math.abs(s.x-c.width/2)/c.width,dy:Math.abs(s.y-c.height/2)/c.height,seen:!!el&&el.tagName==='CANVAS'};})()");
  assert(fc.focus === fc.born && fc.dist < 4 && fc.dx < 0.15 && fc.dy < 0.35 && fc.seen, '鏡頭靠近第一塊日曆上今天那塊磚、框起來，說明框沒有蓋住它（距離 ' + fc.dist.toFixed(1) + '，離正中 ' + (fc.dx * 100).toFixed(0) + '%／' + (fc.dy * 100).toFixed(0) + '%）');
  if (process.argv[3]) await pg.screenshot({ path: process.argv[3] + '/v9_tut_firstbrick.png' });
  await H.popOk();
  var st = JSON.parse(await H.ev("JSON.stringify({d:APP.state().dockings.filter(function(d){return d.a==='" + J1 + "'||d.b==='" + J1 + "';}).map(function(d){return [d.traded,d.tutorial];}),n:CORE.dockCount(APP.state(),'" + J1 + "'),ratio:CORE.ratio(APP.state(),'" + J1 + "').text,h:APP.state().holds.filter(function(h){return h.issuer==='" + J1 + "'||h.holder==='" + J1 + "';}).map(function(h){return h.status;})})"));
  assert(st.d.length === 1 && st.d[0][0] && st.d[0][1] && st.n === 0 && st.ratio === '還沒對接過' && st.h.join() === 'redeemed,redeemed', '教學的對接不算數：對接過 0 次、換點比例還沒對接過；引路人也兌現了我的「空的」');
  await H.hclick('#hBack'); await pg.waitForTimeout(300);
  assert((await H.sheetName()) === 'log' && (await pg.isHidden('#tutbar')) && (await H.msg()).indexOf('教學完成') >= 0, '回到事件簿：教學列收起來，寫教學完成');
  assert((await H.ev("APP.state().entries.filter(function(e){return e.tutorial;}).map(function(e){return e.vis['" + J4 + "'];}).join()")) === 'hidden' && (await H.ev("APP.state().notices.filter(function(n){return n.owner==='" + J4 + "';}).length")) === 1, '引路人那一邊固定全藏；引路人的公告成交後還在');
  // 跳過：只做創角色（補 0 份），空物件的提醒照樣出現
  await H.fresh({ raw: true });
  await H.setIn('cName', '小跳'); await H.setIn('cQty', 0); await H.clickText('建立，跳過教學', '#tmain'); await pg.waitForTimeout(300);
  assert((await H.ev("JSON.stringify([APP.tut().step,APP.tut().skipped,APP.me().name])")) === '["done",true,"小跳"]' && (await pg.isHidden('#tutbar')) && (await H.sheetName()) === 'res', '跳過：角色建好、教學結束，留在資源表');
  assert((await H.ev("document.querySelector('#tmain .remind').textContent")).indexOf('可換 0 份：按「補」才能只收不給') >= 0, '跳過教學，資源表照樣提醒 0 點的空物件要補');
  // 教學中按「跳過教學」
  await H.fresh({ raw: true }); await H.clickText('建立', '#tmain'); await waitStep(2); await pg.waitForTimeout(300);
  await H.finger("function(){ return document.querySelector('#htut [data-hact=\"tutSkip\"]'); }", '跳過教學'); assert((await step()) === 'done' && (await pg.textContent('#hmsg')).indexOf('跳過了教學') >= 0 && (await pg.isHidden('#htut')) && (await pg.isHidden('#tutbar')), '教學中按「跳過教學」（在能量之家上面）');
  await H.finger("function(){ return document.querySelector('#hhome [data-hact=\"toLog\"]'); }", '事件簿'); await pg.waitForTimeout(300);
  // 全部還原成預設 → 又從創角色開始
  await H.nav('role'); await H.clickText('全部還原成預設', '#tmain'); await H.popOk('還原');
  assert((await H.ev("APP.isBlank()")) && (await step()) === 1 && (await H.sheetName()) === 'res' && (await H.ev("!!document.getElementById('cName')")), '全部還原成預設後又是創角色');
  // 舊存檔（八步）的教學對到七步：第 5 步（預約）→ 第 4 步；第 8 步 → 第 7 步
  await H.ev("(function(){var st=CORE.fresh();CORE.demoMe(st,APP.now());st.tutorial={step:5,skipped:false,slot:null,random:true,door:true,found:true,sawRules:true,house:false};localStorage.setItem('arrive-v9',CORE.io.pack?CORE.io.pack(st):JSON.stringify(st));})()");
  var packed = await H.ev("(function(){var st=CORE.fresh();CORE.demoMe(st,APP.now());st.tutorial={step:8,skipped:false,slot:null,random:true,door:true,found:true,sawRules:true,house:false};CORE.save(st);return APP.state&&true;})()");
  await pg.reload(); await pg.waitForTimeout(500);
  assert(packed && (await H.ev("JSON.stringify((function(){var c=CORE.cleanTutorial({step:8,skipped:false,slot:null,random:true,door:true,found:true,sawRules:true,house:false});return [c.step,c.seven,c.dice,c.went];})())")) === '[7,true,true,true]' && (await step()) === 'done' && (await H.ev("APP.tut().house")) === true && (await H.popTitle()).indexOf('你 0 歲，第一塊磚變彩色了') >= 0, '舊存檔教學第 8 步讀進來變第 7 步（看自己的能量之家）；一打開就在能量之家，這一步直接走完、跳出第一塊磚的說明');
  await H.popOk();
  await H.ev("(function(){var st=CORE.fresh();CORE.demoMe(st,APP.now());st.tutorial={six:true,step:3,skipped:false,slot:null,dice:true,went:false,house:false};CORE.save(st);})()"); await pg.reload(); await pg.waitForTimeout(500);
  assert((await step()) === 4, '六步存檔的第 3 步（約引路人）讀進來變第 4 步');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
