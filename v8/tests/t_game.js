// 裡世界測試：沒有表格元素；對話框不超過 40%；能量條隨給點下降；指引光點；建造改外觀後走法照樣有效；那一微秒對接與錯過。
// node v7/tests/t_game.js <test7.html> [截圖資料夾]
var lib = require('./lib'), assert = lib.assert, path = require('path');
var OUT = process.argv[3] || path.join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
var J1 = '00000000001', J2 = '00000000002';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  assert((await H.ev("typeof THREE")) === 'object' && (await H.ev("APP.view()")) === 'game', '一開就是裡世界，Three.js 打包在裡面');
  assert((await H.ev("document.querySelectorAll('#view-game table, #view-game th, #view-game td').length")) === 0, '裡世界沒有任何表格元素');
  assert((await H.ev("document.querySelectorAll('.label:not(.portal)').length")) === 5, '五個功能點都有標籤');
  var plate = await pg.textContent('.plate');
  assert(plate.indexOf('J1') >= 0 && plate.indexOf('今天還能給 1800 / 1800 點') >= 0, '名牌：代號、名字、能量條');
  assert((await pg.textContent('#task')).indexOf('下一步：') === 0, '上方一行任務提示');
  await pg.screenshot({ path: OUT + '/v8_game_1_home.png' });

  // 對話框從底部升起，不超過畫面 40%
  await H.goNear('role');
  assert(await H.dlgOpen(), '走到角色碑旁，對話框升起');
  var box = await H.ev("(function(){var r=document.getElementById('dlg').getBoundingClientRect();return {h:r.height,bottom:r.bottom,win:innerHeight};})()");
  assert(box.h <= box.win * 0.4 + 1 && Math.abs(box.bottom - box.win) < 2, '對話框貼底、高度 ' + Math.round(box.h) + ' ≤ 40% 畫面（' + box.win + '）');
  // 對話框開著時，任務提示在畫面上方還看得到；名牌的代號行沒內容時不占位置
  var vis = await H.ev("(function(){var t=document.getElementById('task').getBoundingClientRect(),d=document.getElementById('dlg').getBoundingClientRect(),p=document.getElementById('plate').getBoundingClientRect(),s=document.getElementById('swapToSheet').getBoundingClientRect();return {taskTop:t.top,taskBottom:t.bottom,dlgTop:d.top,win:innerHeight,plateRight:p.right,swapLeft:s.left,codeH:document.getElementById('codeLine').getBoundingClientRect().height,w:t.width};})()");
  assert(vis.w > 0 && vis.taskBottom < vis.dlgTop && vis.taskBottom < vis.win / 2, '對話框開著，任務提示仍在上半部看得到（底 ' + Math.round(vis.taskBottom) + ' < 對話框頂 ' + Math.round(vis.dlgTop) + '）');
  assert(vis.plateRight <= vis.swapLeft, '名牌和切換鈕不重疊');
  assert(vis.codeH === 0, '代號行沒內容時不占位置');
  var opts = await H.opts();
  assert(opts.indexOf('改每天的點（明天起）') >= 0 && opts.indexOf('歷史紀錄') >= 0 && opts.indexOf('換人（測試用）') >= 0 && opts.indexOf('不玩了') >= 0 && opts.indexOf('新角色') < 0 && opts.indexOf('進入空窗') < 0, '角色碑的選項：' + opts.join('/'));
  await pg.screenshot({ path: OUT + '/v8_game_2_dialog.png' });
  await H.pick('歷史紀錄'); assert((await H.opts()).indexOf('返回') >= 0, '第二層對話框有返回');
  await H.pick('返回'); assert((await H.dlgTitle()).indexOf('這裡是角色') === 0, '返回回到上一層');
  await pg.click('#dlgClose'); assert(!(await H.dlgOpen()), '× 關掉');

  // 規則屋：翻頁；大段文字不在 HUD 上
  await H.goNear('rule'); await H.pick('閱讀規則');
  assert((await H.dlgTitle()).indexOf('1/3') > 0, '規則分頁 1/3');
  await H.pick('下一頁'); await H.pick('下一頁'); assert((await H.dlgTitle()).indexOf('3/3') > 0 && (await H.dlgBody()).indexOf('要求兩方都通') >= 0, '翻到 3/3 開關與村規');
  await H.ev("GAME.dialog(null)");

  // 地圖與指引光點
  await pg.click('#btnMap');
  assert(!(await pg.isHidden('#map')), '地圖打開');
  var nodes = await H.ev("[...document.querySelectorAll('#map .node[data-go]')].map(b=>b.dataset.go+(b.classList.contains('dim')?'-暗':'-亮'))");
  assert(nodes.join(',') === 'J2-亮,J3-暗,J4-亮', '一方通的亮、不通的暗：' + nodes.join(','));
  await H.click('#map .node[data-go="J2"]');
  assert((await pg.isHidden('#map')) && (await H.ev("WORLD.guideCount()")) > 1, '點 J2 → 地上亮出指引光點 ' + (await H.ev("WORLD.guideCount()")) + ' 個');
  await pg.screenshot({ path: OUT + '/v8_game_3_guide.png' });
  var n0 = await H.ev("WORLD.guideCount()");
  // 有指引光點＝走代號中：點規則屋走到旁邊，不開對話框，上方提示附「繞一圈（J）」，按了自動繞
  var opened = await H.tapAndWatch('rule_' + J1);
  assert(!opened && !(await H.dlgOpen()) && (await H.ev("document.getElementById('hintCircle') !== null")), '有指引時到規則屋：不開對話框，提示上有「繞一圈」');
  await H.click('#hintCircle'); await pg.waitForFunction("GAME.dec().letter === 'J'", null, { timeout: 20000 }); await H.walkDone();
  assert((await H.ev("WORLD.guideCount()")) < n0, '繞完一圈，那一段光點熄掉');
  assert((await pg.textContent('#codeLine')).indexOf('J') === 0, '代號一個字一個字浮在名牌下：' + (await pg.textContent('#codeLine')));
  assert((await H.ev("document.getElementById('codeLine').getBoundingClientRect().height")) > 0, '有代號時代號行才出現');

  // 建造模式：改外觀、搬移後，走法照樣走得出 J2
  await H.ev("GAME.dec().reset(); WORLD.resetRings(); WORLD.setGuide([])");
  await pg.click('#btnBuild'); await H.ev("GAME.dialog(null)");
  assert((await pg.textContent('#btnBuild')).indexOf('建造中') === 0, '建造模式開著');
  await H.tapScreen('role_' + J1); await H.pick('換外觀'); await H.pick('塔');
  await H.pick('搬移'); await H.tapScreen({ x: 2, z: -2 });
  assert(JSON.stringify(await H.ev("APP.allObjs(APP.me()).find(o=>o.func==='role').pos")) === '[2,-2]' && (await H.ev("APP.allObjs(APP.me()).find(o=>o.func==='role').look")) === '塔', '角色碑換成塔、搬到 (2,-2)');
  await pg.click('#btnBuild');
  assert(JSON.stringify(await H.ev("CORE.route(APP.me().world.walk, APP.allObjs(APP.me()), 'J2').steps")) === JSON.stringify(await H.ev("(function(){var r=CORE.route(CORE.fresh().roles[0].world.walk, CORE.allObjects(CORE.fresh().roles[0].world).map(x=>x.o),'J2');return r.steps;})()")), '走法表沒變，J2 的路線一樣');
  await H.tapAndWatch('rule_' + J1); await H.pick('繞一圈（J）'); await pg.waitForFunction("GAME.dec().letter === 'J'", null, { timeout: 20000 }); await H.walkDone();
  opened = await H.tapAndWatch('role_' + J1); assert(!opened && (await H.ev("GAME.dec().lastAt")) === 'role_' + J1, '點搬過的塔走過去，途中不開對話框，算進代號');
  opened = await H.tapAndWatch('res_' + J1); assert(!opened, '走到市集途中不開對話框');
  await pg.waitForFunction("GAME.dec().done === 'J2'", null, { timeout: 15000 });
  assert((await pg.textContent('#toast')).indexOf('傳送門') >= 0, '改外觀、搬移後照樣走得出 J2，傳送門打開');
  await H.tapAndWatch('portal');
  assert((await pg.textContent('#plateName')).indexOf('在 阿澄 的世界') >= 0 && !(await pg.isHidden('#btnHome')), '到了阿澄的世界，有回家鈕');

  // 那一微秒：預約、選我要主人的什麼、倒數、站上終點、交換對話框、白光、對接；能量條下降
  await H.ev("(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+24e6,1,null,t);APP.changed();})()");
  await H.goNear('goal'); await H.pick('時刻表'); var o = await H.opts(); await H.pick(o[0].slice(0, 8));
  assert((await H.ev("APP.state().roles[1].slots.some(s=>s.bookings.indexOf('" + J1 + "')>=0)")), '在對方終點台預約了');
  assert((await H.dlgTitle()).indexOf('我要 阿澄 的什麼') === 0, '預約後接著選要換主人的什麼');
  await H.click('[data-want-add="r2a"]'); assert((await pg.textContent('#wantTotal')) === '100', '選了改履歷，合計 100');
  // 主人（阿澄）要我的什麼：單機版主人不在場，用規則層替他選（換人成主人去選是表世界測試的事）
  await H.ev("(function(){var S=APP.state(),s=S.roles[1].slots.find(function(x){return x.bookings.indexOf('" + J1 + "')>=0 && !x.judged;});CORE.setWants(S,s.id,'" + J2 + "','" + J1 + "',['r1b']);APP.changed();})()");
  await H.pick('存好');   // 回到時刻表，開著不關
  // 站在終點上、距那一微秒不到 60 秒 → 交換對話框蓋過時刻表升起
  await pg.waitForFunction("document.getElementById('dlgTitle').textContent.indexOf('交換') === 0", null, { timeout: 12000 });
  var xb = await H.dlgBody();
  assert(!(await pg.isHidden('#countdown')) && xb.indexOf('我要他的：改履歷（100 點）') >= 0 && xb.indexOf('他要我的：早餐一頓（100 點）') >= 0 && (await H.ev("document.getElementById('maxGive') !== null")), '倒數出現、交換對話框列出我要他的、他要我的、每人最多給：' + JSON.stringify({ cd: await pg.isHidden('#countdown'), body: xb }));
  await H.edit('#maxGive', 500); await H.pick('確定');
  var before = await H.ev("parseFloat(document.getElementById('energyBar').style.width)");
  await pg.screenshot({ path: OUT + '/v8_game_4_countdown.png' });
  await pg.waitForFunction("APP.state().dockings.length === 1", null, { timeout: 30000 }); await pg.waitForTimeout(400);
  var dk = await H.ev("APP.state().dockings[0]");
  assert(dk.gaveA === 100 && dk.gaveB === 100 && dk.itemsA[0].name === '改履歷' && dk.itemsB[0].name === '早餐一頓', '對接照選好的成交：阿澄給 100（我選改履歷）、我給 100（他選早餐）');
  assert((await H.ev("APP.state().holds.length")) === 2 && (await H.ev("JSON.stringify(CORE.stockOf(APP.state().roles[1],'r2a'))")) === '{"avail":2,"reserved":1}', '貨當場留起來：阿澄的改履歷可換 2、已保留 1');
  assert((await H.ev("parseFloat(document.getElementById('energyBar').style.width)")) < before, '能量條往下降');
  assert((await H.dlgTitle()) === '到達那微秒' && (await H.ev("document.querySelector('#stage canvas') !== null")), '對接成立的對話框');
  await pg.screenshot({ path: OUT + '/v8_game_5_docked.png' });
  await H.pick('好');

  // 錯過：預約了但沒站在終點上（站著會自動確認，所以先走開再預約）
  await H.walkTo(-3, 6);
  await H.ev("(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+6e6,1,null,t);CORE.book(S,'" + J1 + "',s.id,t);APP.changed();})()");
  await pg.waitForFunction("APP.state().roles[1].slots.some(s=>s.missed.length)", null, { timeout: 15000 }); await pg.waitForTimeout(300);
  assert((await pg.textContent('#toast')).indexOf('錯過了那一微秒') >= 0, '沒站在終點上 → 顯示錯過');
  assert((await H.ev("APP.state().dockings.length")) === 1, '錯過的不算對接');

  // 選的東西有一部分那天已經下架：交換對話框加一行小字；結果對話框寫沒換到
  await H.fresh();
  await H.ev("(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+20e6,1,null,t);CORE.book(S,'" + J1 + "',s.id,t);CORE.setWants(S,s.id,'" + J1 + "','" + J2 + "',['r2a','r2b']);CORE.setWants(S,s.id,'" + J2 + "','" + J1 + "',['r1b']);var p=CORE.tomorrow(S,'" + J2 + "',t);p.resources=p.resources.filter(function(x){return x.id!=='r2a';});p.fromDay=CORE.dayNum(t);APP.changed();})()");
  await H.ev("GAME.teleportTo(CORE.roleOf(APP.state(),'" + J2 + "'))"); await H.goNear('goal');
  await pg.waitForFunction("document.getElementById('dlgTitle').textContent.indexOf('交換') === 0", null, { timeout: 12000 });
  var xb2 = await H.dlgBody();
  assert(xb2.indexOf('我要他的：一小時諮詢（90 點）') >= 0 && xb2.indexOf('選的「改履歷」那天已經下架，不算') >= 0, '交換對話框：只算諮詢 90，小字寫改履歷不算');
  await H.pick('確定');
  await pg.waitForFunction("APP.state().dockings.length === 1", null, { timeout: 30000 }); await pg.waitForTimeout(400);
  assert((await H.dlgTitle()) === '到達那微秒' && (await H.dlgBody()).indexOf('拿到：阿澄的一小時諮詢（90 點）') >= 0 && (await H.dlgBody()).indexOf('我拿出：早餐一頓（100 點）') >= 0 && (await H.dlgBody()).indexOf('選的「改履歷」那天已經下架，沒換到') >= 0, '結果對話框以東西為主：我拿出早餐、拿到諮詢（90 點）、寫改履歷沒換到');
  await H.pick('好');

  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
