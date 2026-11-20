// 能量之家當首頁、前情提要拿掉（2026-11-20）：打開是自己的能量之家；最上面一排只有今天還剩、事件簿／公告欄、交換關係，沒有前情提要；
// 事件簿沒有「已還自然」；日曆紙不分亮暗、合計沒有「寫了前情提要」；那天的明細沒有前情提要；跟自然換就是跟勾了自然的角色換（小樂（後山））；
// 3D 用不了時一樣有這一排；畫面沒有「達秒屋」三個字；直放和轉橫各截一張
// node v9/tests/t_nature.js <test9.html> [截圖資料夾]
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J3 = '00000000003';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg, OUT = process.argv[3];
  await H.fresh();
  // 1. 重新打開：一打開是自己的能量之家，最上面一排：今天還剩、事件簿／公告欄，沒有前情提要
  await pg.reload(); await pg.waitForTimeout(600);
  assert((await H.ev("APP.view().name")) === 'house' && (await pg.isVisible('#view-house')) && (await pg.isHidden('#view-table')), '一打開是自己的能量之家，不是事件簿');
  var home = await pg.textContent('#hhome');
  assert((await pg.isVisible('#hhome')) && home.indexOf('前情提要') < 0 && home.indexOf('自然') < 0 && !(await H.ev("!!document.querySelector('#hhome .hnat')")) && home.indexOf('今天還剩') >= 0 && (await pg.isVisible('#hhome [data-hact="toLog"]')) && (await pg.isVisible('#hhome [data-hact="toFind"]')), '最上面一排：沒有前情提要那一格；今天還剩 N 點、事件簿、公告欄兩個大鈕');
  var left0 = await H.ev("CORE.remainingToday(APP.state(),APP.me(),APP.now())"), daily = await H.ev("CORE.dailyPoints(APP.me(),APP.now())");
  var F = async function (n) { return H.ev('CORE.fmtPoints(' + n + ')'); };
  assert(left0 === daily && (await pg.textContent('#hLeft')) === (await F(left0)) && (await H.ev("document.body.innerText.indexOf('達秒屋')")) < 0 && (await pg.textContent('#hwho')).indexOf('的能量之家') >= 0, '今天還剩＝每天的點（' + (await F(left0)) + '）；畫面沒有「達秒屋」三個字，叫能量之家');
  var land = await H.ev("(function(){var h=document.getElementById('hhome').getBoundingClientRect();return {bottom:h.bottom,vh:window.innerHeight};})()");
  assert(land.bottom <= land.vh / 2, '轉橫：首頁那一排下緣 ' + Math.round(land.bottom) + ' 不超過畫面一半（' + land.vh / 2 + '）');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_nature_1_home_landscape.png' });
  // 2. 事件簿：沒有「已還自然」和「寫今天的前情提要」
  await H.finger("function(){ return document.querySelector('#hhome [data-hact=\"toLog\"]'); }", '事件簿');
  assert((await H.sheetName()) === 'log' && (await H.main()).indexOf('自然') < 0 && (await H.main()).indexOf('前情提要') < 0 && !(await H.ev("!!document.querySelector('#tmain [data-act=\"natureGo\"]')")) && (await pg.textContent('#energyText')) === (await F(left0)), '事件簿：現在還能給 ' + (await F(left0)) + '，沒有已還自然、沒有前情提要');
  // 3. 跟自然換：就是跟勾了自然的角色換（小樂（後山）），他的那張紙寫「自然」；換了以後今天的磚是彩色，沒有亮暗
  await H.serial('J3-2'); await pg.waitForTimeout(300);
  assert((await H.main()).indexOf('自然') >= 0 && (await H.main()).indexOf('後山') >= 0, '小樂（後山）那張紙：生產背景後山、寫「自然」');
  await H.clickText('回我自己', '#tother');
  var today = await H.ev("CORE.dayNum(APP.now())");
  await H.nav('cal');
  var cls = await H.ev("document.querySelector('#tmain table.calp td[data-day=\"" + today + "\"]').className");
  assert(cls.indexOf('lit') < 0 && (await H.main()).indexOf('前情提要') < 0 && (await H.main()).indexOf('這個月成交') >= 0, '日曆紙：不分亮暗（沒有 lit）；合計沒有「寫了前情提要」');
  assert((await H.ev("Array.from(document.querySelectorAll('#tmain table.calp td')).some(function(td){return /\\blit\\b/.test(td.className);})")) === false, '整張日曆紙沒有一格是亮的');
  await H.ev("KIT.dayPop('" + J1 + "'," + today + ")");
  assert((await H.popOpen()) && (await H.popBody()).indexOf('前情提要') < 0 && !(await H.ev("!!document.querySelector('#popBody [data-natvis]')")), '那天的明細沒有前情提要');
  await H.popOk();
  // 4. 3D 用不了：顯示日曆紙，上面一樣有這一排，點得到
  var N = await lib.open(process.argv[2], { noWebGL: true }); await N.fresh(); await N.pg.reload(); await N.pg.waitForTimeout(600);
  assert((await N.pg.isVisible('#hcal')) && (await N.pg.isVisible('#hhome')) && (await N.pg.textContent('#hhome')).indexOf('今天還剩') >= 0 && (await N.pg.textContent('#hhome')).indexOf('前情提要') < 0, '3D 用不了：顯示日曆紙，上面一樣有那一排（沒有前情提要）');
  await N.finger("function(){ return document.querySelector('#hhome [data-hact=\"toFind\"]'); }", '公告欄'); assert((await N.sheetName()) === 'find', '公告欄大鈕點得到：到公告欄');
  assert(N.errs.length === 0, '3D 用不了也沒有頁面錯誤'); await N.close();
  // 5. 直放：這一排排得下、不擠出畫面；截一張
  await pg.setViewportSize({ width: 360, height: 780 }); await pg.waitForTimeout(300); await H.ev("APP.goHouse(APP.me().serial)"); await pg.waitForTimeout(600);
  var fit = await H.ev("(function(){var b=document.getElementById('hhome').getBoundingClientRect();return {r:b.right,bottom:b.bottom,vw:window.innerWidth,vh:window.innerHeight,over:Array.from(document.querySelectorAll('#hhome .hleft')).filter(function(e){return e.scrollWidth>e.clientWidth+1;}).length};})()");
  assert(fit.r <= fit.vw + 1 && fit.bottom < fit.vh * 0.5 && fit.over === 0, '直放：那一排在畫面裡、不擠：' + JSON.stringify(fit));
  if (OUT) await pg.screenshot({ path: OUT + '/v9_nature_2_portrait.png' });
  await pg.setViewportSize({ width: 780, height: 360 }); await pg.waitForTimeout(200);
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
