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

  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
