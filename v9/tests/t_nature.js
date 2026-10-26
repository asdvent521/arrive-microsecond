// 能量之家當首頁、前情提要（補二十二）：打開是自己的能量之家；最上面寫今天的前情提要，寫了磚亮起來、首頁像讀小說那樣顯示；事件簿沒有多一行、「已還自然 N 點」對；改和撤掉；3D 沒載好前看得到、點得到；日曆紙的底色和合計；畫面沒有「達秒屋」三個字；直放和轉橫各截一張
// node v9/tests/t_nature.js <test9.html> [截圖資料夾]
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg, OUT = process.argv[3];
  await H.fresh(); var rows0 = await H.ev("document.querySelectorAll('#tmain table:nth-of-type(1) tr[data-row]').length");
  // 1. 重新打開：一打開是自己的能量之家，最上面一排：寫今天的前情提要、今天還剩、事件簿／公告欄
  await pg.reload(); await pg.waitForTimeout(600);
  assert((await H.ev("APP.view().name")) === 'house' && (await pg.isVisible('#view-house')) && (await pg.isHidden('#view-table')), '一打開是自己的能量之家，不是事件簿');
  assert((await pg.isVisible('#hhome')) && (await pg.textContent('#hhome')).indexOf('寫今天的前情提要') >= 0 && (await pg.textContent('#hhome')).indexOf('今天還剩') >= 0 && (await pg.isVisible('#hhome [data-hact="toLog"]')) && (await pg.isVisible('#hhome [data-hact="toFind"]')), '最上面一排：一格「寫今天的前情提要」、今天還剩 N 點、事件簿、公告欄兩個大鈕');
  var left0 = await H.ev("CORE.remainingToday(APP.state(),APP.me(),APP.now())");
  assert((await pg.textContent('#hLeft')) === String(left0) && (await H.ev("document.body.innerText.indexOf('達秒屋')")) < 0 && (await pg.textContent('#hwho')).indexOf('的能量之家') >= 0, '今天還剩 ' + left0 + ' 點；畫面沒有「達秒屋」三個字，叫能量之家');
  var daily = await H.ev("CORE.dailyPoints(APP.me(),APP.now())"); assert(left0 === daily, '還沒給出去：還剩＝每天的點');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_nature_1_home_landscape.png' });
  // 2. 寫前情提要：點那一格 → 打字、給自然 5 點、寫好了 → 首頁顯示那段字和給了自然 5 點、磚亮起來、今天還剩少 5
  await H.finger("function(){ return document.querySelector('#hhome [data-hact=\"natEdit\"]'); }", '寫今天的前情提要');
  assert((await pg.isVisible('#natText')) && (await pg.isVisible('#natPts')) && (await pg.textContent('#hhome')).indexOf('寫好了') >= 0, '變成可以打字的格子：字、給自然幾點、寫好了');
  await H.finger("function(){ return document.querySelector('#hhome [data-hact=\"natSave\"]'); }", '寫好了（空的）');
  assert((await pg.textContent('#hmsg')).indexOf('寫一點今天跟自然的交流') >= 0 && (await H.ev("!CORE.natureOf(APP.state(),'" + J1 + "',CORE.dayNum(APP.now()))")), '什麼都沒寫按寫好了：擋下來，說原因');
  await H.ev("document.getElementById('natText').value='今天一早去河堤走一圈，撿了一袋垃圾'; document.getElementById('natPts').value='5';");
  await H.finger("function(){ return document.querySelector('#hhome [data-hact=\"natSave\"]'); }", '寫好了');
  var nat = await H.ev("JSON.stringify((function(){var x=CORE.natureOf(APP.state(),'" + J1 + "',CORE.dayNum(APP.now()));return x?[x.text,x.points,x.vis]:null;})())");
  assert(nat === JSON.stringify(['今天一早去河堤走一圈，撿了一袋垃圾', 5, 'hidden']) && (await pg.textContent('#hhome')).indexOf('今天一早去河堤走一圈') >= 0 && (await pg.textContent('#hhome')).indexOf('給了自然 5 點') >= 0, '寫好了：記下字和 5 點（預設全藏），首頁像讀小說那樣顯示那段字和「給了自然 5 點」');
  assert((await pg.textContent('#hLeft')) === String(left0 - 5) && (await pg.textContent('#hhome')).indexOf('已還自然 5 點') >= 0, '今天還剩少 5 點，寫已還自然 5 點');
  var today = await H.ev("CORE.dayNum(APP.now())");
  assert((await H.ev("JSON.stringify((function(){var b=HOUSE.data().bricks.find(function(x){return x.day===" + today + ";});return [b.lit,b.level];})())")) === '[true,0]' && (await H.ev("WORLD.info().lit")) === 1 && (await H.ev("WORLD.info().colored")) === 0, '今天那塊磚亮起來（亮的灰白：有前情提要、沒跟人換）');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_nature_2_written_landscape.png' });
  // 3. 事件簿：沒有多一行；上面「現在還能給」扣掉給自然的、旁邊「已還自然 5 點」，點了回首頁的前情提要
  await H.finger("function(){ return document.querySelector('#hhome [data-hact=\"toLog\"]'); }", '事件簿');
  assert((await H.sheetName()) === 'log' && (await pg.isVisible('#view-table')), '事件簿大鈕：到今天的事件簿');
  var rows = await H.ev("document.querySelectorAll('#tmain table:nth-of-type(1) tr[data-row]').length");
  assert(rows === rows0 && (await pg.textContent('#energyText')) === String(left0 - 5) && (await H.main()).indexOf('已還自然 5 點') >= 0, '事件簿沒有多一行（只記跟人換的，還是 ' + rows0 + ' 行）；現在還能給 ' + (left0 - 5) + '，旁邊已還自然 5 點');
  await H.finger("function(){ return document.querySelector('#tmain [data-act=\"natureGo\"]'); }", '前情提要');
  assert((await H.ev("APP.view().name")) === 'house' && (await pg.textContent('#hhome')).indexOf('今天一早去河堤') >= 0, '點了回首頁的前情提要');
  // 4. 改：點那段字 → 改點數 3 → 寫好了；撤掉：點全退、磚暗回去
  await H.finger("function(){ return document.querySelector('#hhome [data-hact=\"natEdit\"]'); }", '那段字（點了能改）');
  assert((await H.ev("document.getElementById('natText').value")) === '今天一早去河堤走一圈，撿了一袋垃圾' && (await H.ev("document.getElementById('natPts').value")) === '5', '打開就是原本的字和點數');
  await H.ev("document.getElementById('natPts').value='3'"); await H.finger("function(){ return document.querySelector('#hhome [data-hact=\"natSave\"]'); }", '寫好了');
  assert((await pg.textContent('#hhome')).indexOf('給了自然 3 點') >= 0 && (await pg.textContent('#hLeft')) === String(left0 - 3), '改成 3 點：退回 2 點');
  await H.finger("function(){ return document.querySelector('#hhome [data-hact=\"natEdit\"]'); }", '那段字'); await H.finger("function(){ return document.querySelector('#hhome [data-hact=\"natDrop\"]'); }", '整段撤掉'); await H.popOk('撤掉');
  assert((await H.ev("!CORE.natureOf(APP.state(),'" + J1 + "',CORE.dayNum(APP.now()))")) && (await pg.textContent('#hhome')).indexOf('寫今天的前情提要') >= 0 && (await pg.textContent('#hLeft')) === String(left0) && (await H.ev("WORLD.info().lit")) === 0, '撤掉：整段拿掉、點全退、磚暗回去');
  await H.ev("document.getElementById('natText')"); await H.finger("function(){ return document.querySelector('#hhome [data-hact=\"natEdit\"]'); }", '再寫'); await H.ev("document.getElementById('natText').value='晚上關了燈看星星'; document.getElementById('natPts').value='2';"); await H.finger("function(){ return document.querySelector('#hhome [data-hact=\"natSave\"]'); }", '寫好了');
  // 5. 日曆紙：今天那格亮的、合計多寫「寫了前情提要 1 天」；那天的明細最上面是前情提要，可以改給誰看
  await H.finger("function(){ return document.querySelector('#hhome [data-hact=\"toLog\"]'); }", '事件簿'); await H.nav('cal');
  var cls = await H.ev("document.querySelector('#tmain table.calp td[data-day=\"" + today + "\"]').className");
  assert(cls.indexOf('lit') >= 0 && cls.indexOf('lv') < 0 && (await H.main()).indexOf('寫了前情提要 1 天') >= 0, '日曆紙：今天那格亮的灰白（lit、沒有 lv）；合計寫了前情提要 1 天');
  await H.ev("KIT.dayPop('" + J1 + "'," + today + ")");
  assert((await H.popOpen()) && (await H.popBody()).indexOf('前情提要') >= 0 && (await H.popBody()).indexOf('晚上關了燈看星星') >= 0 && (await H.popBody()).indexOf('給了自然 2 點') >= 0 && (await H.ev("!!document.querySelector('#popBody [data-natvis]')")), '那天的明細最上面是前情提要，自己的可以改給誰看');
  await H.edit('#popBody [data-natvis]', 'public'); assert((await H.ev("CORE.natureOf(APP.state(),'" + J1 + "'," + today + ").vis")) === 'public', '改成公開'); await H.popOk();
  await H.becomeMe(J2); await H.serial('J1'); await H.clickText('看他的日曆', '#tmain');
  assert((await H.ev("document.querySelector('#tmain table.calp td[data-day=\"" + today + "\"]').className")).indexOf('lit') >= 0, '阿澄看 J1 的日曆：公開了的前情提要那格亮的'); await H.clickText('回我自己', '#tother'); await H.becomeMe(J1);
  // 6. 3D 用不了：顯示日曆紙，上面一樣有這一排，點得到
  var N = await lib.open(process.argv[2], { noWebGL: true }); await N.fresh(); await N.pg.reload(); await N.pg.waitForTimeout(600);
  assert((await N.pg.isVisible('#hcal')) && (await N.pg.isVisible('#hhome')) && (await N.pg.textContent('#hhome')).indexOf('寫今天的前情提要') >= 0, '3D 用不了：顯示日曆紙，上面一樣有前情提要那一排');
  await N.finger("function(){ return document.querySelector('#hhome [data-hact=\"toFind\"]'); }", '公告欄'); assert((await N.sheetName()) === 'find', '公告欄大鈕點得到：到公告欄');
  assert(N.errs.length === 0, '3D 用不了也沒有頁面錯誤'); await N.close();
  // 7. 直放：這一排排得下、不擠出畫面；截一張
  await pg.setViewportSize({ width: 360, height: 780 }); await pg.waitForTimeout(300); await H.ev("APP.goHouse(APP.me().serial)"); await pg.waitForTimeout(600);
  var fit = await H.ev("(function(){var b=document.getElementById('hhome').getBoundingClientRect();return {w:b.width,r:b.right,bottom:b.bottom,vw:window.innerWidth,vh:window.innerHeight,over:Array.from(document.querySelectorAll('#hhome .hnat, #hhome .hleft')).filter(function(e){return e.scrollWidth>e.clientWidth+1;}).length};})()");
  assert(fit.r <= fit.vw + 1 && fit.bottom < fit.vh * 0.75 && fit.over === 0, '直放：那一排在畫面裡、不擠：' + JSON.stringify(fit));
  if (OUT) await pg.screenshot({ path: OUT + '/v9_nature_3_portrait.png' });
  await pg.setViewportSize({ width: 780, height: 360 }); await pg.waitForTimeout(200);
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
