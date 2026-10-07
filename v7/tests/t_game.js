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
  assert((await H.ev("document.querySelectorAll('.label').length")) === 5, '五個功能點都有標籤');
  var plate = await pg.textContent('.plate');
  assert(plate.indexOf('J1') >= 0 && plate.indexOf('今天還能給 1800 / 1800 點') >= 0, '名牌：代號、名字、能量條');
  assert((await pg.textContent('#task')).indexOf('下一步：') === 0, '上方一行任務提示');
  await pg.screenshot({ path: OUT + '/v7_game_1_home.png' });

  // 對話框從底部升起，不超過畫面 40%
  await H.goNear('role');
  assert(await H.dlgOpen(), '走到角色碑旁，對話框升起');
  var box = await H.ev("(function(){var r=document.getElementById('dlg').getBoundingClientRect();return {h:r.height,bottom:r.bottom,win:innerHeight};})()");
  assert(box.h <= box.win * 0.4 + 1 && Math.abs(box.bottom - box.win) < 2, '對話框貼底、高度 ' + Math.round(box.h) + ' ≤ 40% 畫面（' + box.win + '）');
  var opts = await H.opts();
  assert(opts.indexOf('換角色') >= 0 && opts.indexOf('新角色') >= 0 && opts.indexOf('進入空窗') >= 0 && opts.indexOf('結束並重創') >= 0 && opts.indexOf('歷史紀錄') >= 0, '角色碑的選項：' + opts.join('/'));
  await pg.screenshot({ path: OUT + '/v7_game_2_dialog.png' });
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
  assert(nodes.join(',') === 'J2-亮,J3-暗', '一方通的亮、不通的暗：' + nodes.join(','));
  await H.click('#map .node[data-go="J2"]');
  assert((await pg.isHidden('#map')) && (await H.ev("WORLD.guideCount()")) > 1, '點 J2 → 地上亮出指引光點 ' + (await H.ev("WORLD.guideCount()")) + ' 個');
  await pg.screenshot({ path: OUT + '/v7_game_3_guide.png' });
  var n0 = await H.ev("WORLD.guideCount()");
  await H.ev("WORLD.circleAround('rule_" + J1 + "')"); await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 15000 });
  await H.walkTo(0, 7); await pg.waitForFunction("GAME.dec().letter === 'J'", null, { timeout: 15000 });
  assert((await H.ev("WORLD.guideCount()")) < n0, '繞完一圈，那一段光點熄掉');
  assert((await pg.textContent('#codeLine')).indexOf('J') === 0, '代號一個字一個字浮在名牌下：' + (await pg.textContent('#codeLine')));

  // 建造模式：改外觀、搬移後，走法照樣走得出 J2
  await H.ev("GAME.dec().reset(); WORLD.setGuide([])");
  await pg.click('#btnBuild'); await H.ev("GAME.dialog(null)");
  assert((await pg.textContent('#btnBuild')).indexOf('建造中') === 0, '建造模式開著');
  await H.tapScreen('role_' + J1); await H.pick('換外觀'); await H.pick('塔');
  await H.pick('搬移'); await H.tapScreen({ x: 2, z: -2 });
  assert(JSON.stringify(await H.ev("APP.allObjs(APP.me()).find(o=>o.func==='role').pos")) === '[2,-2]' && (await H.ev("APP.allObjs(APP.me()).find(o=>o.func==='role').look")) === '塔', '角色碑換成塔、搬到 (2,-2)');
  await pg.click('#btnBuild');
  assert(JSON.stringify(await H.ev("CORE.route(APP.me().world.walk, APP.allObjs(APP.me()), 'J2').steps")) === JSON.stringify(await H.ev("(function(){var r=CORE.route(CORE.fresh().roles[0].world.walk, CORE.allObjects(CORE.fresh().roles[0].world).map(x=>x.o),'J2');return r.steps;})()")), '走法表沒變，J2 的路線一樣');
  await H.ev("WORLD.circleAround('rule_" + J1 + "')"); await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 15000 });
  await H.walkTo(0, 7); await pg.waitForFunction("GAME.dec().letter === 'J'", null, { timeout: 15000 });
  var rp = await H.ev("WORLD.objectAt('role_" + J1 + "')"); await H.walkTo(rp.x, rp.z + rp.radius + 0.6);
  await pg.waitForFunction("GAME.dec().lastAt === 'role_" + J1 + "'", null, { timeout: 15000 });
  await H.walkTo(6, 3.2); await pg.waitForFunction("GAME.dec().done === 'J2'", null, { timeout: 15000 });
  assert((await pg.textContent('#toast')).indexOf('傳送門') >= 0, '改外觀、搬移後照樣走得出 J2，傳送門打開');
  await H.ev("GAME.enterPortal()"); await pg.waitForTimeout(300);
  assert((await pg.textContent('#plateName')).indexOf('在 阿澄 的世界') >= 0 && !(await pg.isHidden('#btnHome')), '到了阿澄的世界，有回家鈕');

  // 那一微秒：預約、倒數、站上終點、交換滑桿、白光、對接；能量條下降
  await H.ev("(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+14e6,1,100,t);APP.changed();})()");
  await H.goNear('goal'); await H.pick('時刻表'); var o = await H.opts(); await H.pick(o[0].slice(0, 8));
  assert((await H.ev("APP.state().roles[1].slots.some(s=>s.bookings.indexOf('" + J1 + "')>=0)")), '在對方終點台預約了');
  // 已經站在終點上、距那一微秒不到 60 秒 → 交換對話框直接升起
  await pg.waitForFunction("document.getElementById('dlgTitle').textContent.indexOf('交換') === 0", null, { timeout: 12000 });
  assert(!(await pg.isHidden('#countdown')) && (await H.ev("document.getElementById('giveRange').type")) === 'range', '倒數出現、交換滑桿');
  await H.setIn('giveRange', 40); await H.pick('確定');
  var before = await H.ev("parseFloat(document.getElementById('energyBar').style.width)");
  await pg.screenshot({ path: OUT + '/v7_game_4_countdown.png' });
  await pg.waitForFunction("APP.state().dockings.length === 1", null, { timeout: 25000 }); await pg.waitForTimeout(400);
  var dk = await H.ev("APP.state().dockings[0]");
  assert(dk.gaveB === 40 && dk.gaveA === 100, '對接：我給 40、阿澄給 100');
  assert((await H.ev("parseFloat(document.getElementById('energyBar').style.width)")) < before, '能量條往下降');
  assert((await H.dlgTitle()) === '到達那微秒' && (await H.ev("document.querySelector('#stage canvas') !== null")), '對接成立的對話框');
  await pg.screenshot({ path: OUT + '/v7_game_5_docked.png' });
  await H.pick('好');

  // 錯過：預約了但沒站在終點上
  await H.ev("(function(){var S=APP.state(),t=APP.now();var s=CORE.addSlot(S,'" + J2 + "',t+6e6,1,100,t);CORE.book(S,'" + J1 + "',s.id,t);APP.changed();})()");
  await H.walkTo(-3, 6);
  await pg.waitForFunction("APP.state().roles[1].slots.some(s=>s.missed.length)", null, { timeout: 15000 }); await pg.waitForTimeout(300);
  assert((await pg.textContent('#toast')).indexOf('錯過了那一微秒') >= 0, '沒站在終點上 → 顯示錯過');
  assert((await H.ev("APP.state().dockings.length")) === 1, '錯過的不算對接');

  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
