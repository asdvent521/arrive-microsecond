// 走代號的手感：「走到」停下來才算、路過不算；走代號中到建築不自動升對話框。
// node v7/tests/t_arrive.js <test7.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  // 1. 從角色碑直線走到市集、擦過終點台範圍：不算到達終點台，正確走出 J2。連跑 5 次。
  for (var i = 1; i <= 5; i++) {
    await H.fresh();
    await H.ev("window.__arrived = []; WORLD.on('arrive', function (o) { window.__arrived.push(o.func); })");
    await H.ev("WORLD.circleAround('rule_" + J1 + "')"); await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 15000 });
    await H.walkTo(0, 7); await pg.waitForFunction("GAME.dec().letter === 'J'", null, { timeout: 15000 });
    await H.walkTo(0, -4.3); await pg.waitForFunction("GAME.dec().lastAt === 'role_" + J1 + "'", null, { timeout: 15000 });
    await H.walkTo(6, 3.2); await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 15000 }); await pg.waitForTimeout(300);
    var got = await H.ev("JSON.stringify({done: GAME.dec().done, arrived: window.__arrived, code: GAME.dec().code()})");
    var g = JSON.parse(got);
    assert(g.done === 'J2' && g.arrived.indexOf('goal') < 0 && g.arrived.join(',') === 'role,resource', '第 ' + i + ' 次：直線擦過終點台不算到達，走出 J2（到達：' + g.arrived.join(',') + '）');
  }
  // 2. 點地面、停在建築範圍內 → 算到達
  await H.fresh();
  await H.ev("window.__arrived = []; WORLD.on('arrive', function (o, info) { window.__arrived.push(o.func + (info && info.tapped ? '(點建築)' : '(點地面)')); })");
  var gp = await H.ev("(function(){var p=WORLD.objectAt('goal_" + J1 + "');return {x:p.x, z:p.z+p.radius+0.5};})()");
  await H.tapScreen({ x: gp.x, z: gp.z }); await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 15000 }); await pg.waitForTimeout(300);
  assert((await H.ev("window.__arrived.join(',')")) === 'goal(點地面)', '點地面停在終點台範圍內 → 到達終點台');
  // 3. 沒在走代號：點建築走過去，照舊自動開對話框
  await H.ev("GAME.dialog(null); window.__arrived = []");
  await H.tapScreen('role_' + J1); await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 15000 }); await pg.waitForTimeout(300);
  assert((await H.ev("window.__arrived.join(',')")) === 'role(點建築)' && (await H.dlgTitle()).indexOf('這裡是角色') === 0, '沒在走代號：點角色碑走過去 → 到達、對話框自動打開');
  // 4. 走代號途中到達建築：對話框不升起、上方有提示；再點那棟建築才打開
  await H.ev("GAME.dialog(null)");
  await H.walkTo(0, 7);
  await H.ev("WORLD.circleAround('rule_" + J1 + "')"); await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 15000 });
  await H.walkTo(0, 7); await pg.waitForFunction("GAME.dec().letter === 'J'", null, { timeout: 15000 });
  await H.ev("GAME.dialog(null)");
  await H.tapScreen('role_' + J1); await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 15000 }); await pg.waitForTimeout(300);
  var st4 = await H.ev("JSON.stringify({dlg:document.getElementById('dlg').classList.contains('open'), title:document.getElementById('dlgTitle').textContent, hintHidden:document.getElementById('hint').hidden, hint:document.getElementById('hint').textContent, code:GAME.dec().code(), guide:WORLD.guideCount()})");
  assert(!(await H.dlgOpen()) && !(await pg.isHidden('#hint')) && (await pg.textContent('#hint')) === '到了角色碑', '走代號中到角色碑：不升對話框，上方提示「到了角色碑」' + st4);
  var hb = await H.ev("(function(){var h=document.getElementById('hint').getBoundingClientRect();return {top:h.top, win:innerHeight};})()");
  assert(hb.top < hb.win / 3, '提示在畫面上方');
  assert((await H.ev("GAME.dec().lastAt")) === 'role_' + J1, '到達仍算進走代號');
  await H.tapScreen('role_' + J1); await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 15000 }); await pg.waitForTimeout(300);
  assert((await H.dlgOpen()) && (await H.dlgTitle()).indexOf('這裡是角色') === 0, '再點一次那棟建築 → 對話框打開');
  // 走到下一棟（市集）：對話框也不自動升起，但數字照算
  await H.ev("GAME.dialog(null)");
  await H.tapScreen('res_' + J1); await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 15000 }); await pg.waitForTimeout(300);
  assert(!(await H.dlgOpen()) && (await H.ev("GAME.dec().done")) === 'J2' && (await pg.textContent('#toast')).indexOf('傳送門') >= 0, '走到市集：不升對話框，走出 J2、傳送門打開');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
