// 走代號的手感（全部用手指點畫面）：「走到」停下來才算、路過不算；對話框只在停下來時打開；
// 「繞一圈」按鈕；繞完一圈就進入走代號狀態；走代號中到建築不升對話框。
// node v7/tests/t_arrive.js <test7.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  var listen = "window.__arrived = []; WORLD.on('arrive', function (o, info) { window.__arrived.push(o.func + (info && info.tapped ? '(點建築)' : '(點地面)')); })";

  // 1. 只用點擊從頭走出 J2：點規則屋 → 對話框「繞一圈（J）」→ 點角色碑 → 點市集；途中不跳任何對話框，最後傳送門打開。
  await H.fresh(); await H.ev(listen);
  var opened = await H.tapAndWatch('rule_' + J1);
  assert(!opened && (await H.dlgOpen()) && (await H.dlgTitle()).indexOf('這裡是規則') === 0, '點規則屋走過去：途中不開，停下才開對話框');
  var opts = await H.opts();
  assert(opts.indexOf('繞一圈（J）') >= 0, '自己的走法表有用到規則屋 → 對話框有「繞一圈（J）」：' + opts.join('/'));
  await H.pick('繞一圈（J）');
  assert(!(await H.dlgOpen()), '按了繞一圈，對話框收起');
  await pg.waitForFunction("GAME.dec().letter === 'J'", null, { timeout: 20000 });
  assert((await pg.textContent('#codeLine')).indexOf('J') === 0, '繞完一圈當下就走出字母 J（還在規則屋範圍內）');
  await H.walkDone();
  assert(!(await H.dlgOpen()) && (await H.ev("window.__arrived.length")) === 1, '繞完停下不算到達、不開對話框');
  opened = await H.tapAndWatch('role_' + J1);
  assert(!opened && !(await H.dlgOpen()) && (await H.ev("GAME.dec().lastAt")) === 'role_' + J1, '走向角色碑：途中與停下都不開對話框，走到算進代號');
  assert(!(await pg.isHidden('#hint')) && (await pg.textContent('#hint')).indexOf('到了角色碑') === 0 && (await H.ev("document.getElementById('hintLook') !== null")), '上方提示「到了角色碑」，附「看看」');
  opened = await H.tapAndWatch('res_' + J1);
  assert(!opened && !(await H.dlgOpen()) && (await H.ev("GAME.dec().done")) === 'J2' && (await pg.textContent('#toast')).indexOf('傳送門') >= 0, '走到市集：不開對話框，走出 J2、傳送門打開');
  assert((await H.ev("window.__arrived.join(',')")) === 'rule(點建築),role(點建築),resource(點建築)', '到達只有三次：' + (await H.ev("window.__arrived.join(',')")));
  // 傳送門看得到：有顏色的外框、名牌寫要去誰；用手指點門進去
  var pl = await H.ev("(function(){var l=document.querySelector('.label.portal');return {hidden:l.hidden, text:l.textContent};})()");
  assert(!pl.hidden && pl.text === '傳送門 → 阿澄（J2）', '傳送門有名牌：' + pl.text);
  assert((await H.ev("document.getElementById('hintEnter') !== null")), '上方提示有「進去」');
  await pg.waitForTimeout(10000);
  assert(!(await pg.isHidden('#hintEnter')), '傳送門的提示 10 秒後還在、「進去」還按得到');
  await H.tapAndWatch('portal');
  assert((await pg.textContent('#plateName')).indexOf('在 阿澄 的世界') >= 0, '手指點傳送門 → 到了阿澄的世界');

  // 1b. 沒在走代號：從角色碑點市集，停下打開市集的對話框，解碼器沒記任何數字
  await H.fresh();
  await H.tapAndWatch('role_' + J1); assert((await H.dlgTitle()).indexOf('這裡是角色') === 0, '沒在走代號：點角色碑，停下開角色碑對話框');
  opened = await H.tapAndWatch('res_' + J1);
  assert(!opened && (await H.dlgTitle()).indexOf('這裡是資源') === 0 && (await H.ev("GAME.dec().code()")) === '' && (await H.ev("GAME.dec().lastAt")) === null, '沒有字母也沒有指引：角色碑走到市集不算數字，停下開市集對話框');
  // 1c. 上方提示留到走開為止；字那一塊讓手指點穿過去
  await H.fresh();
  await H.tapAndWatch('rule_' + J1); await H.pick('繞一圈（J）'); await pg.waitForFunction("GAME.dec().letter === 'J'", null, { timeout: 20000 }); await H.walkDone();
  await H.tapAndWatch('role_' + J1);
  assert(!(await pg.isHidden('#hint')) && (await pg.textContent('#hintText')) === '到了角色碑', '到了角色碑：提示出現');
  await pg.waitForTimeout(10000);
  assert(!(await pg.isHidden('#hint')), '提示 10 秒後還在');
  // 轉鏡頭，直到有一棟建築在提示的字後面；點那些字，人會走去那棟
  var behind = null;
  for (var k = 0; k < 14 && !behind; k++) {
    await pg.waitForTimeout(k ? 500 : 900);
    behind = await pg.evaluate(function () { var r = document.getElementById('hintText').getBoundingClientRect(); for (var i = 0; i < 5; i++) { var x = r.left + r.width * (i + 0.5) / 5, y = r.top + r.height / 2; var h = WORLD.hitTest(x, y); if (h && h !== 'ground' && h !== 'portal' && WORLD.distanceTo(h) > 2) return { id: h, x: x, y: y, el: document.elementFromPoint(x, y).id }; } return null; });
    if (!behind) { await pg.mouse.move(180, 400); await pg.mouse.down(); await pg.mouse.move(120, 400, { steps: 6 }); await pg.mouse.move(60, 400, { steps: 6 }); await pg.mouse.up(); }
  }
  assert(behind && behind.el !== 'hintText', '提示的字後面有一棟建築（' + (behind && behind.id) + '），點那裡碰到的不是提示');
  await pg.mouse.click(behind.x, behind.y); await pg.waitForTimeout(300);
  assert((await H.ev("(WORLD.walkingTo() || {}).id")) === behind.id, '點提示的字 → 走去後面那棟建築');
  await H.walkDone();

  // 2. 走路經過終點台：不跳對話框、不算到達
  await H.fresh(); await H.ev(listen);
  opened = await H.tapAndWatch({ x: 2, z: 2 }); assert(!opened && (await H.ev("window.__arrived.length")) === 0, '點地面走到 (2,2)，沒到達什麼');
  opened = await H.tapAndWatch({ x: 9, z: -5 });
  assert(!opened && !(await H.dlgOpen()) && (await H.ev("window.__arrived.length")) === 0, '朝終點台正中直走到 (9,-5)、繞過它：不跳對話框、不算到達（' + JSON.stringify(await H.ev("WORLD.playerPos()")) + '）');

  // 3. 點地面、停在建築範圍內 → 算到達、對話框打開（沒在走代號）
  await H.fresh(); await H.ev(listen);
  var gp = await H.ev("(function(){var p=WORLD.objectAt('goal_" + J1 + "');return {x:p.x, z:p.z+p.radius+0.5};})()");
  opened = await H.tapAndWatch(gp);
  assert(!opened && (await H.ev("window.__arrived.join(',')")) === 'goal(點地面)' && (await H.dlgTitle()).indexOf('這裡是終點') === 0, '點地面停在終點台範圍內 → 到達、停下才開對話框');

  // 4. 手動點地面繞一圈也繞得成；點到建築本身改走到背後的地面，不卡住
  await H.fresh(); await H.ev(listen);
  await H.tapAndWatch('rule_' + J1); await H.ev("GAME.dialog(null)");
  var c = await H.ev("WORLD.objectAt('rule_" + J1 + "')"), p0 = await H.ev("WORLD.playerPos()");
  await H.tapAndWatch('rule_' + J1);
  var p1 = await H.ev("WORLD.playerPos()");
  assert(Math.hypot(p1.x - p0.x, p1.z - p0.z) > c.radius && Math.hypot(p1.x - c.x, p1.z - c.z) > c.radius, '站在旁邊再點規則屋：走到它背後的地面，沒卡住');
  var a0 = Math.atan2(p1.z - c.z, p1.x - c.x);
  for (var i = 1; i <= 8; i++) { var a = a0 + i / 8 * Math.PI * 2; await H.tapAndWatch({ x: c.x + Math.cos(a) * (c.radius + 1.6), z: c.z + Math.sin(a) * (c.radius + 1.6) }); }
  assert((await H.ev("GAME.dec().letter")) === 'J', '手動點地面繞一圈 → 字母 J');
  assert(!(await H.dlgOpen()), '繞的過程沒開對話框');

  // 5. 繞完一圈的那棟就算人在那裡：走法表加「規則屋→市集＝2」，點規則屋 → 繞一圈 → 點市集，不開指引也走出 J2
  await H.fresh(); await H.ev(listen);
  await pg.click('#swapToSheet'); await pg.waitForTimeout(300); await H.sheet('moves');
  await H.setIn('addMoveFrom', 'rule_' + J1); await H.setIn('addMoveTo', 'res_' + J1); await H.setIn('addMoveDigit', '2'); await H.click('[data-act="addMove"]');
  assert((await H.rows()) === 4, '表世界加了一條走法：規則屋→市集＝2');
  await pg.click('#swapToGame'); await pg.waitForTimeout(500);
  assert(JSON.stringify(await H.ev("CORE.route(APP.me().world.walk, APP.allObjs(APP.me()), 'J2').steps")) === JSON.stringify(['繞規則屋一圈（J）', '再走到市集（2）']), '路線說明從繞的那棟算起，沒有多一步「走到規則屋」');
  await pg.click('#btnMap'); await H.click('#map .node[data-go="J2"]');
  assert((await H.ev("WORLD.guideCount()")) === 13, '指引光點：一圈 12 點＋市集 1 點＝13，沒有規則屋那一點');
  await H.click('#codeClear'); assert((await H.ev("WORLD.guideCount()")) === 0, '✕ 清掉指引');
  await H.tapAndWatch('rule_' + J1); await H.pick('繞一圈（J）'); await pg.waitForFunction("GAME.dec().letter === 'J'", null, { timeout: 20000 }); await H.walkDone();
  assert((await H.ev("GAME.dec().lastAt")) === 'rule_' + J1, '繞完一圈，人就算在規則屋');
  opened = await H.tapAndWatch('res_' + J1);
  assert(!opened && (await H.ev("GAME.dec().done")) === 'J2' && (await pg.textContent('#toast')).indexOf('傳送門') >= 0, '不開指引，規則屋 → 市集就走出 J2，傳送門打開');
  await H.click('#hintEnter'); await pg.waitForTimeout(300);
  assert((await pg.textContent('#plateName')).indexOf('在 阿澄 的世界') >= 0, '按「進去」也進得去');
  await H.ev("GAME.goHome()"); await pg.waitForTimeout(300);
  await H.tapAndWatch('rule_' + J1); await H.pick('繞一圈（J）'); await pg.waitForFunction("GAME.dec().letter === 'J'", null, { timeout: 20000 }); await H.walkDone(); await H.tapAndWatch('res_' + J1);

  // 6. 代號那行的小 ✕：清掉代號、繞圈、光點、傳送門；之後停在建築旁照常開對話框
  assert(!(await pg.isHidden('#codeClear')), '有代號時代號行有 ✕');
  var xb = await H.ev("(function(){var r=document.getElementById('codeClear').getBoundingClientRect(), b=document.getElementById('btnBuild').getBoundingClientRect();return {w:r.width,h:r.height,bh:b.height};})()");
  assert(xb.w >= 32 && xb.h >= 32 && xb.h >= xb.bh - 4, '✕ 至少 32 像素、跟「建造」差不多高（' + Math.round(xb.w) + '×' + Math.round(xb.h) + '，建造 ' + Math.round(xb.bh) + '）');
  await H.click('#codeClear');
  assert((await H.ev("JSON.stringify({code:GAME.dec().code(), last:GAME.dec().lastAt, guide:WORLD.guideCount(), x:document.getElementById('codeClear')!==null, h:document.getElementById('codeLine').getBoundingClientRect().height})")) === '{"code":"","last":null,"guide":0,"x":false,"h":0}', '按 ✕：代號、光點、傳送門全清，代號行不占位置');
  opened = await H.tapAndWatch('role_' + J1);
  assert(!opened && (await H.dlgTitle()).indexOf('這裡是角色') === 0, '清掉之後停在角色碑旁照常開對話框');
  await H.fresh(); assert((await H.ev("document.getElementById('codeClear')")) === null, '一開始沒有代號也沒有光點：不顯示 ✕');

  // 7. 切到表世界時 3D 暫停：待 3 秒畫的次數是 0；切回來照常會動
  await H.fresh();
  await pg.click('#swapToSheet'); await pg.waitForTimeout(400);
  var f0 = await H.ev("WORLD.frameCount()"); await pg.waitForTimeout(3000); var f1 = await H.ev("WORLD.frameCount()");
  assert(f1 === f0, '表世界待 3 秒，3D 畫了 ' + (f1 - f0) + ' 次');
  await pg.click('#swapToGame'); await pg.waitForTimeout(500);
  var p0 = await H.ev("WORLD.playerPos()"); await H.tapAndWatch({ x: 3, z: 3 }); var p1 = await H.ev("WORLD.playerPos()");
  assert((await H.ev("WORLD.frameCount()")) > f1 && Math.hypot(p1.x - p0.x, p1.z - p0.z) > 1, '切回裡世界：3D 繼續畫，點地面照常會走');

  // 8. 切去表世界沒換看別的東西就切回：一切照舊
  // (a) 點終點台走到一半切過去再切回，最後停在終點台；途中切過去時表世界開的是「要去的那棟」（我開的時段），不是路過的
  await H.fresh();
  var sg = await H.onScreen('goal_' + J1); await pg.mouse.click(sg.x, sg.y); await pg.waitForTimeout(700);
  assert((await H.ev("WORLD.isMoving()")), '往終點台走到一半');
  await pg.click('#swapToSheet'); await pg.waitForTimeout(300);
  assert((await H.sheetName()) === 'myslots', '走路途中切過去：表世界開「要去的那棟」對應的工作表（我開的時段）');
  await pg.click('#swapToGame'); await H.walkDone();
  assert((await H.dlgTitle()).indexOf('這裡是終點') === 0 && (await H.ev("WORLD.distanceTo('goal_" + J1 + "')")) < 1.2, '切回來繼續走，最後停在終點台');
  // (b) 開著 J2 指引站著不動，切過去再切回：光點還是 14 個、人沒動
  await H.fresh(); await pg.click('#btnMap'); await H.click('#map .node[data-go="J2"]');
  assert((await H.ev("WORLD.guideCount()")) === 14, 'J2 指引 14 個光點');
  var pb = await H.ev("WORLD.playerPos()");
  await pg.click('#swapToSheet'); await pg.waitForTimeout(400);
  var same = await H.sheetName(); await H.click('#stabs a[data-s="' + same + '"]');   // 再點一次同一張工作表
  await pg.click('#swapToGame'); await pg.waitForTimeout(800);
  var pb2 = await H.ev("WORLD.playerPos()");
  assert((await H.ev("WORLD.guideCount()")) === 14 && !(await H.ev("WORLD.isMoving()")) && Math.hypot(pb2.x - pb.x, pb2.z - pb.z) < 0.01, '切過去、再點一次同一張工作表就切回：光點還是 14 個、人沒動');
  // (c) 照指引繞完規則屋，切過去再切回：剩下的光點還在
  await H.tapAndWatch('rule_' + J1); await H.click('#hintCircle'); await pg.waitForFunction("GAME.dec().letter === 'J'", null, { timeout: 20000 }); await H.walkDone();
  var gc = await H.ev("WORLD.guideCount()"); assert(gc === 2, '繞完規則屋，剩 2 個光點');
  await pg.click('#swapToSheet'); await pg.waitForTimeout(400); await pg.click('#swapToGame'); await pg.waitForTimeout(800);
  assert((await H.ev("WORLD.guideCount()")) === 2 && (await H.ev("GAME.dec().code()")) === 'J', '切過去再切回：剩下的光點和字母 J 都還在');
  // (d) 在表世界換到點數再切回：走到帳房
  await pg.click('#swapToSheet'); await pg.waitForTimeout(300); await H.click('#stabs a[data-s="points"]'); await pg.click('#swapToGame'); await H.walkDone();
  assert((await H.ev("WORLD.distanceTo('pts_" + J1 + "')")) < 1.2, '表世界換看點數再切回：走到帳房');

  // (e) 停在規則屋旁、對話框開著，切過去再切回：對話框還在
  await H.fresh(); await H.tapAndWatch('rule_' + J1);
  assert((await H.dlgTitle()).indexOf('這裡是規則') === 0, '規則屋的對話框開著');
  await pg.click('#swapToSheet'); await pg.waitForTimeout(400); await pg.click('#swapToGame'); await pg.waitForTimeout(600);
  assert((await H.dlgOpen()) && (await H.dlgTitle()).indexOf('這裡是規則') === 0, '切過去再切回：對話框還在');

  // (f) 市集開著「補貨」，切到表世界補 1 份 → 切回寫「可換 2」→ 再補 1 份 → 切回寫「可換 3」
  await H.fresh(); await H.tapAndWatch('res_' + J1); await H.pick('補貨、減貨');
  assert((await H.dlgBody()).indexOf('陪跑一小時（可換 1，已保留 0）') >= 0, '補貨對話框：陪跑一小時可換 1');
  await pg.click('#swapToSheet'); await pg.waitForTimeout(300);
  assert((await H.sheetName()) === 'resources', '切過去是資源表');
  await H.click('[data-act="stock"][data-id="r1a"][data-n="1"]');
  await pg.click('#swapToGame'); await pg.waitForTimeout(500);
  assert((await H.dlgOpen()) && (await H.dlgTitle()) === '補貨、減貨' && (await H.dlgBody()).indexOf('陪跑一小時（可換 2，') >= 0, '切回來：留著的補貨對話框用最新資料重畫，寫「可換 2」');
  await pg.click('#swapToSheet'); await pg.waitForTimeout(300); await H.click('[data-act="stock"][data-id="r1a"][data-n="1"]');
  await pg.click('#swapToGame'); await pg.waitForTimeout(500);
  assert((await H.dlgOpen()) && (await H.dlgBody()).indexOf('陪跑一小時（可換 3，') >= 0, '第二次切回也重畫：寫「可換 3」');
  // 提示上的按鈕用手指按得到：看看、繞一圈、進去
  await H.fresh();
  await H.tapAndWatch('rule_' + J1); await H.pick('繞一圈（J）'); await pg.waitForFunction("GAME.dec().letter === 'J'", null, { timeout: 20000 }); await H.walkDone();
  await H.tapAndWatch('role_' + J1);
  await H.click('#hintLook'); assert((await H.dlgTitle()).indexOf('這裡是角色') === 0 && !(await H.ev("WORLD.isMoving()")), '手指按「看看」：對話框打開、人沒往後走');
  await H.ev("GAME.dialog(null)"); await H.click('#codeClear');
  await H.tapAndWatch('rule_' + J1); await H.pick('繞一圈（J）'); await pg.waitForTimeout(500); assert((await H.ev("WORLD.isMoving()")), '手指按對話框的「繞一圈（J）」：開始繞');
  await H.walkDone();

  // 9. 暫停時取消已排好的下一格：同一格內連切 4 次，不會疊出多個迴圈
  await H.fresh();
  var fa = await H.ev("WORLD.frameCount()"); await pg.waitForTimeout(1000); var fb = await H.ev("WORLD.frameCount()");
  await H.ev("for (var i = 0; i < 4; i++) { APP.switchTo('sheet'); APP.switchTo('game'); }");
  await pg.waitForTimeout(1000); var fc = await H.ev("WORLD.frameCount()"); await pg.waitForTimeout(1000); var fd = await H.ev("WORLD.frameCount()");
  assert((fd - fc) <= (fb - fa) * 1.5 + 5, '連切 4 次後每秒畫的次數沒變多（' + (fb - fa) + ' → ' + (fd - fc) + '）');

  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
