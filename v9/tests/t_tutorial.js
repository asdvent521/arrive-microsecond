// 新手教學（DESIGN 7-4，八步）：創角色（建好到自己的達秒屋外面）→ 在達秒屋外面按隨機、點門進他的表格世界 → 公告欄找引路人的序號、序號框跳過去
// → 看他的家規 → 預約選他的「空的」（預約時就確認到達）→ 那一微秒 → 背包兌現 → 去我的達秒屋（你 0 歲，第一塊日曆上今天那塊磚亮了，鏡頭靠近）。
// 教學的對接不算數、標「教學」；可以跳過（只做創角色，空物件的提醒照樣出現）；全部還原又從創角色開始。
// node v9/tests/t_tutorial.js <test9.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J4 = '00000000004';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  var step = function () { return H.ev("APP.tut().step"); };
  var waitStep = function (k) { return pg.waitForFunction("APP.tut().step === " + JSON.stringify(k), null, { timeout: 15000 }); };
  // ① 創角色
  await H.fresh({ raw: true });
  assert((await H.ev("APP.state().me")) === -1 && (await H.ev("APP.state().roles.map(function(r){return r.name;}).join(',')")) === '阿澄,小樂,引路人', '示範版沒有預先放好「我」：第一次打開從創角色開始');
  assert((await H.sheetName()) === 'role' && (await pg.textContent('#tutbar')).indexOf('創角色') >= 0, '一打開就在「我的／角色」，上面一行寫教學 ① 創角色');
  assert((await H.ev("[document.getElementById('cDaily').value,document.getElementById('cItem').value,document.getElementById('cPrice').value,document.getElementById('cQty').value].join('/')")) === '2000/空的/0/1', '每天的點預設 2000，第一樣東西「空的」0 點 1 份');
  await H.setIn('cName', '小明'); await H.clickText('建立', '#tmain');
  await waitStep(2); await pg.waitForTimeout(400);
  assert((await H.ev("APP.me().serial")) === J1 && (await H.ev("APP.view().name + ' ' + APP.view().serial")) === 'house ' + J1 && (await pg.isVisible('#view-house')) && (await pg.isHidden('#view-table')), '建立：J1 當下生效，跳到自己的達秒屋外面');
  assert((await pg.textContent('#htut')).indexOf('② 找陌生人一：隨機') >= 0 && (await pg.isVisible('#htut [data-hact="tutSkip"]')), '達秒屋外面也有教學提示和「跳過教學」，教學到 ②');
  assert((await H.ev("WORLD.info().bricks")) === 1 && (await pg.textContent('#hwho')).indexOf('0 歲') >= 0, '剛出生：日曆上一塊磚、0 歲');
  assert((await H.ev("WORLD.info().blocks")) === (await H.ev("CORE.template('house').length")) - 1 && (await H.ev("WORLD.info().blocks")) > 50 && (await H.ev("WORLD.info().cal")) === 1, '建好角色就有一間預設小屋（' + (await H.ev("WORLD.info().blocks")) + ' 塊）、一扇門和第一塊日曆');
  assert((await pg.textContent('#htut')).indexOf('看看他的日曆') >= 0, '第 2 步提示：看看他的日曆');
  // ② 在達秒屋外面按隨機 → 陌生人的達秒屋外面，點門進他的表格世界
  await H.hclick('#hRandom'); await pg.waitForTimeout(500);
  var other = await H.ev("APP.view().serial");
  assert((await H.ev("APP.view().name")) === 'house' && other !== J1 && (await step()) === 2, '按「隨機」跳到陌生人的達秒屋外面（點門才算走完 ②）');
  await H.ev("(function(){var d=HOUSE.data().look.door;WORLD.setCamera({target:[d[0]+0.5,1,d[2]+0.5],theta:0,phi:1.3,dist:6});WORLD.renderNow();})()"); await pg.waitForTimeout(200);   // 鏡頭轉到他的門前
  await H.tap3d('door', '他的門'); await waitStep(3);
  assert((await H.ev("TABLE.ui.other")) === other && (await pg.isVisible('#view-table')) && (await pg.textContent('#tutbar')).indexOf('③') >= 0, '點門進他的表格世界，教學到 ③');
  await H.nav('today');
  assert((await H.main()).indexOf('① 創角色') >= 0 && (await H.main()).indexOf('⑧ 看自己的達秒屋') >= 0 && (await H.rows('today')) === 8, '今天列出教學八步');
  // ③ 在公告欄找引路人的公告，記下序號，在序號框輸入跳過去
  await H.nav('notices');
  var code = await H.ev("(function(){var tr=[...document.querySelectorAll('#tmain tr[data-row]')].find(function(t){return t.textContent.indexOf('教學')>=0;});return tr.querySelector('button.lk').textContent;})()");
  assert(code === 'J4', '公告欄找到引路人的公告，序號 ' + code);
  await H.serial(code); await waitStep(4);
  assert((await pg.textContent('#tother')).indexOf('J4 引路人') >= 0, '在序號框輸入 J4 跳過去，教學到 ④');
  // ④ 看他的家規：沒有家規網站，表示不收留言
  await H.otab('rules'); await waitStep(5);
  assert((await H.main()).indexOf('沒有家規網站：不收留言') >= 0, '他的規則表：沒有家規網站，不收留言；教學到 ⑤');
  // ⑤ 預約、選他的「空的」：預約時就確認到達
  await pg.waitForFunction("APP.tut().slot !== null", null, { timeout: 5000 });
  var sid = await H.ev("APP.tut().slot");
  await H.otab('slots');
  assert((await H.ev("document.getElementById('arr_" + sid + "').checked")), '走到預約這一步，引路人才開時段；到達預設勾著');
  await H.click('#tmain [data-act="book"][data-id="' + sid + '"]');
  assert((await H.ev("CORE.isPresent(APP.state(),'" + J1 + "','" + sid + "')")) === true && (await H.sheetName()) === 'booked', '預約時就確認到達，跳到我預約的');
  await H.click('#tmain tr[data-id="' + sid + '"] [data-act="wantAdd"][data-res="r4e"]'); await waitStep(6);
  var e = await H.ev("CORE.version(APP.me(),APP.now()).resources[0].id");
  assert((await H.ev("CORE.wantsValid(APP.state(),CORE.slotOf(APP.state(),'" + sid + "').slot,'" + J4 + "','" + J1 + "').join()")) === e, '引路人一定選你的「空的」；教學到 ⑥');
  // ⑥ 那一微秒：白光、跳出成交結果
  await H.ev("window.__flashed=false;new MutationObserver(function(){if(document.getElementById('flash').classList.contains('go'))window.__flashed=true;}).observe(document.getElementById('flash'),{attributes:true})");
  await H.soon(sid, 3);
  await pg.waitForFunction("!document.getElementById('pop').hidden", null, { timeout: 15000 });
  assert((await H.popBody()).indexOf('我拿出：空的（0 點）；拿到：引路人的空的（0 點）') >= 0 && (await H.ev("window.__flashed")), '那一微秒白光一閃，跳出「我拿出：空的；拿到：引路人的空的」');
  await waitStep(7); await H.popOk();
  // ⑦ 在背包兌現
  await H.nav('bag'); await H.clickText('兌現', '#tmain'); await waitStep(8);
  assert((await pg.textContent('#tutbar')).indexOf('⑧ 看自己的達秒屋') >= 0, '兌現了，教學到 ⑧');
  // ⑧ 去我的達秒屋：你 0 歲，第一塊磚亮了
  await H.clickText('去我的達秒屋', '#tutbar'); await waitStep('done'); await pg.waitForTimeout(400);
  assert((await H.ev("APP.view().name + ' ' + APP.view().serial")) === 'house ' + J1 && (await H.popTitle()).indexOf('你 0 歲，第一塊磚亮了') >= 0, '到了自己的達秒屋：跳出「你 0 歲，第一塊磚亮了」，教學結束');
  assert((await H.ev("WORLD.info().lit")) === 1 && (await pg.isHidden('#htut')), '今天那塊磚亮了；教學提示收起來');
  var fc = await H.ev("(function(){var i=WORLD.info(),s=WORLD.screenOf({day:HOUSE.data().born}),c=document.querySelector('#hstage canvas').getBoundingClientRect();var el=document.elementFromPoint(s.x,s.y);return {focus:i.focus,born:HOUSE.data().born,dist:i.dist,dx:Math.abs(s.x-c.width/2)/c.width,dy:Math.abs(s.y-c.height/2)/c.height,seen:!!el&&el.tagName==='CANVAS'};})()");
  assert(fc.focus === fc.born && fc.dist < 4 && fc.dx < 0.15 && fc.dy < 0.35 && fc.seen, '鏡頭靠近第一塊日曆上今天那塊磚、框起來，說明框沒有蓋住它（距離 ' + fc.dist.toFixed(1) + '，離正中 ' + (fc.dx * 100).toFixed(0) + '%／' + (fc.dy * 100).toFixed(0) + '%）');
  if (process.argv[3]) await pg.screenshot({ path: process.argv[3] + '/v9_tut_firstbrick.png' });
  await H.popOk();
  var st = JSON.parse(await H.ev("JSON.stringify({d:APP.state().dockings.filter(function(d){return d.a==='" + J1 + "'||d.b==='" + J1 + "';}).map(function(d){return [d.traded,d.tutorial];}),n:CORE.dockCount(APP.state(),'" + J1 + "'),ratio:CORE.ratio(APP.state(),'" + J1 + "').text,h:APP.state().holds.filter(function(h){return h.issuer==='" + J1 + "'||h.holder==='" + J1 + "';}).map(function(h){return h.status;})})"));
  assert(st.d.length === 1 && st.d[0][0] && st.d[0][1] && st.n === 0 && st.ratio === '還沒對接過' && st.h.join() === 'redeemed,redeemed', '教學的對接不算數：對接過 0 次、換點比例還沒對接過；引路人也兌現了我的「空的」');
  await H.hclick('#hBack'); await pg.waitForTimeout(300);
  await H.nav('calendar'); var today = await H.ev("CORE.dayNum(APP.now())");
  await H.click('#tmain .cal [data-day="' + today + '"]');
  assert((await H.popBody()).indexOf('教學') >= 0 && (await H.ev("APP.state().entries.filter(function(e){return e.tutorial;}).map(function(e){return e.vis['" + J4 + "'];}).join()")) === 'hidden', '日曆點今天：那一筆標「教學」；引路人那一邊固定全藏'); await H.popOk();
  await H.nav('today'); assert((await H.rows('today')) === 5 && (await H.main()).indexOf('① 每天的點') >= 0, '教學結束後「今天」回到平常的下一步和提醒');
  assert((await H.ev("APP.state().notices.filter(function(n){return n.owner==='" + J4 + "';}).length")) === 1, '引路人的公告成交後還在');
  // 跳過：只做創角色（補 0 份），空物件的提醒照樣出現
  await H.fresh({ raw: true });
  await H.setIn('cName', '小跳'); await H.setIn('cQty', 0); await H.clickText('建立，跳過教學', '#tmain'); await pg.waitForTimeout(300);
  assert((await H.ev("JSON.stringify([APP.tut().step,APP.tut().skipped,APP.me().name])")) === '["done",true,"小跳"]' && (await pg.isHidden('#tutbar')), '跳過：角色建好、教學結束');
  assert((await H.rows('today')) === 5 && (await H.main()).indexOf('可換 0 份，先補貨') >= 0, '跳過教學，今天照樣提醒 0 點的空物件要補貨');
  // 教學中按「跳過教學」
  await H.fresh({ raw: true }); await H.clickText('建立', '#tmain'); await waitStep(2); await pg.waitForTimeout(300);
  await H.hclick('#htut [data-hact="tutSkip"]'); assert((await step()) === 'done' && (await pg.textContent('#hmsg')).indexOf('跳過了教學') >= 0 && (await pg.isHidden('#htut')), '在達秒屋外面也可以按「跳過教學」');
  await H.hclick('#hBack'); await pg.waitForTimeout(300);
  // 全部還原成預設 → 又從創角色開始
  await H.nav('help'); await H.clickText('全部還原成預設', '#tmain'); await H.popOk('還原');
  assert((await H.ev("APP.isBlank()")) && (await step()) === 1 && (await H.sheetName()) === 'role' && (await H.ev("!!document.getElementById('cName')")), '全部還原成預設後又是創角色');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
