// 融合流程（表世界操作）：node v5/tests/t_fusion.js <test.html> [截圖資料夾]
var { chromium } = require('/opt/node22/lib/node_modules/playwright');
var path = require('path');
var page_path = process.argv[2];
var OUT = process.argv[3] || path.join(__dirname, 'shots');
require('fs').mkdirSync(OUT, { recursive: true });
function assert(c, m) { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1; } else console.log('ok: ' + m); }

(async function () {
  var browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  var pg = await browser.newPage({ viewport: { width: 400, height: 780 }, deviceScaleFactor: 2 });
  var errs = [];
  pg.on('pageerror', function (e) { errs.push(String(e)); });
  pg.on('console', function (m) { if (m.type() === 'error' && m.text().indexOf('ERR_CERT') < 0) errs.push(m.text()); });
  await pg.goto('file://' + path.resolve(page_path));
  await pg.waitForTimeout(800);
  var fus = function () { return pg.evaluate("APP.state().fusions[0]"); };
  var be = async function (i) { await pg.evaluate("APP.becomeMe(" + i + ")"); await pg.click('.tabs a[data-tab=sheet]'); await pg.waitForTimeout(150); };
  var act = async function (act, extra) { await pg.click('#fusions [data-act="' + act + '"]' + (extra || '')); await pg.waitForTimeout(150); };

  // 1. J1 到 J2 的終點相遇 → 融合
  await pg.evaluate("(function(){ APP.state().roles[1].departUs = DATA.nowUs() + 6e6; APP.save(); })()");
  await pg.evaluate("APP.teleportTo(APP.state().roles[1])");
  await pg.evaluate("WORLD.walkTo({x:7, z:-1})");
  await pg.waitForSelector('#meet:not([hidden])', { timeout: 10000 });
  var f = await fus();
  assert(f && f.members.length === 2 && f.status === 'open', '相遇建立融合');
  assert((await pg.textContent('#meetProblems')).indexOf('融合難題') === 0, '相遇畫面顯示融合難題');
  await pg.click('#meetOpen'); await pg.waitForTimeout(300);
  assert(!(await pg.isHidden('#fusionBox')), '打開融合區');
  await pg.screenshot({ path: OUT + '/f1_open.png' });

  // 2. 約下一個出發點：J1 提、J2 同意 → 兩人的出發點一樣
  await act('proposeNext', '[data-s="180"]');
  f = await fus(); assert(f.nextUs === null && f.nextProposal, 'J1 提議，還沒約好');
  await be(1);
  await act('agreeNext');
  f = await fus(); assert(f.nextUs > 0, 'J2 同意，約好了');
  var deps = await pg.evaluate("APP.state().roles.slice(0,2).map(function(r){return r.departUs})");
  assert(deps[0] === f.nextUs && deps[1] === f.nextUs, '兩人的出發點都是期限');
  var blocked = await pg.evaluate("(function(){ document.querySelector('[data-dep=\"0\"][data-s=\"30\"]').click(); return document.getElementById('sheetMsg').textContent; })()");
  assert(blocked.indexOf('融合') >= 0, '融合中不能在角色表亂改出發點');

  // 3. 階段：J2 提，J1 同意 → 題點
  await pg.fill('[data-stage-in]', '一起訂白天的開工時間');
  await act('proposeStage');
  f = await fus(); assert(f.stages.length === 1 && f.stages[0].status === 'proposed', 'J2 提出階段');
  await be(0);
  await act('agreeStage');
  f = await fus(); assert(f.stages[0].status === 'agreed', 'J1 同意 → 沒人負責');
  var pts = await pg.evaluate("APP.state().points");
  assert(pts.length === 1 && pts[0].kind === 'idea' && pts[0].from === '00000000001' && pts[0].to === '00000000002' && pts[0].ruleVersion === '1', '題點：J1 發給 J2，有規則版本');
  assert((await pg.textContent('#tblPoints')).indexOf('題點') >= 0, '點數紀錄表有');

  // 4. 執行、交判、判定 → 爭議 → 退回 → 再判完成 → 戰點
  await act('claimStage');
  await act('submitStage');
  f = await fus(); assert(f.stages[0].status === 'judging' && f.stages[0].owner === '00000000001', 'J1 執行後交判');
  await act('judgeOk');
  f = await fus(); assert(f.stages[0].status === 'judging', '一個人判不算');
  await be(1);
  await act('judgeNo');
  f = await fus(); assert(f.stages[0].status === 'dispute', 'J2 判未完成 → 爭議');
  assert((await pg.textContent('#fusions')).indexOf('爭議') >= 0, '畫面顯示爭議');
  await act('disputeBack');
  await be(0);
  await act('disputeBack');
  f = await fus(); assert(f.stages[0].status === 'doing', '全員同意退回執行中');
  await act('submitStage'); await act('judgeOk');
  await be(1); await act('judgeOk');
  f = await fus(); assert(f.stages[0].status === 'done', '兩人都判完成');
  pts = await pg.evaluate("APP.state().points");
  assert(pts.length === 2 && pts[1].kind === 'battle' && pts[1].to === '00000000001', '戰點發給執行者');

  // 5. 熱量：所有階段完成後才能填；全部填完 → 可處理
  await pg.fill('#fusions [data-act="kcal"]', '250'); await pg.dispatchEvent('#fusions [data-act="kcal"]', 'change'); await pg.waitForTimeout(150);
  f = await fus(); assert(f.calories['00000000002'] === 250 && f.status === 'open', 'J2 填了，還沒可處理');
  await be(0);
  await pg.fill('#fusions [data-act="kcal"]', '300'); await pg.dispatchEvent('#fusions [data-act="kcal"]', 'change'); await pg.waitForTimeout(150);
  f = await fus(); assert(f.status === 'done', '兩人都填了 → 可處理');
  assert((await pg.textContent('#fusions')).indexOf('可處理') >= 0, '畫面顯示可處理');
  await pg.screenshot({ path: OUT + '/f2_done.png' });

  // 6. 第三個人在期限到任一參與者的終點 → 加入
  await pg.evaluate("(function(){ var s=APP.state(); s.fusions=[]; s.points=[]; s.roles.forEach(function(r){ r.departUs=null; r.departDone=false; r.problems[0].status='open'; }); APP.save(); })()");
  await pg.evaluate("(function(){ var s=APP.state(); var f=FUSION.create(s, [s.roles[0], s.roles[1]], DATA.nowUs()); FUSION.proposeNext(s, f, s.roles[0].serial, DATA.nowUs()+3e6); FUSION.agreeNext(s, f, s.roles[1].serial); APP.save(); })()");
  await pg.evaluate("APP.becomeMe(2)");                       // 我是 J3
  await pg.evaluate("APP.teleportTo(APP.state().roles[0])");  // 去 J1 的終點
  await pg.evaluate("WORLD.walkTo({x:6, z:0.2})");
  await pg.waitForFunction("APP.state().fusions[0].members.length === 3", null, { timeout: 10000 });
  f = await fus();
  assert(f.members.indexOf('00000000003') >= 0 && f.nextUs === null, 'J3 加入，要再約出發點');
  assert((await pg.textContent('#hudMsg')).indexOf('加入') >= 0, '畫面說加入了');

  // 7. 退出：三人約好、J3 認領後退出
  await be(2);
  await act('proposeNext', '[data-s="60"]');
  await be(0); await act('agreeNext');
  await be(1); await act('agreeNext');
  f = await fus(); assert(f.nextUs > 0, '三人約好');
  await pg.fill('[data-stage-in]', '三個人的階段'); await act('proposeStage');
  await be(0); await act('agreeStage');
  f = await fus(); assert(f.stages[0].status === 'proposed', '三人要全同意');
  await be(2); await act('agreeStage');
  f = await fus(); assert(f.stages[0].status === 'agreed', '第三人同意才成立');
  await act('claimStage');
  await act('exit');
  f = await fus();
  assert(f.exits.indexOf('00000000003') >= 0 && f.stages[0].status === 'agreed' && f.stages[0].owner === null, 'J3 退出，階段變回沒人負責');
  assert((await pg.textContent('#records')).indexOf('退出') >= 0, '紀錄有退出');
  assert((await pg.evaluate("APP.state().points.length")) === 2, '退出者已發的題點照舊');

  // 8. 期限到了沒人來 → 擱置
  await pg.evaluate("(function(){ var s=APP.state(); s.fusions[0].nextUs = DATA.nowUs() + 1e6; APP.save(); })()");
  await pg.waitForFunction("APP.state().fusions[0].status === 'shelved'", null, { timeout: 6000 });
  var ps = await pg.evaluate("APP.state().roles.map(function(r){return r.problems[0].status})");
  assert(ps[0] === 'shelved' && ps[1] === 'shelved' && ps[2] === 'exited', '原難題一起擱置，退出的另外標：' + ps.join(','));
  await pg.click('.tabs a[data-tab=sheet]'); await pg.waitForTimeout(200);
  await pg.screenshot({ path: OUT + '/f3_shelved.png' });

  // 9. 重新整理，存檔還在
  await pg.reload(); await pg.waitForTimeout(800);
  f = await fus(); assert(f && f.status === 'shelved' && f.members.length === 3, '重新整理後融合還在');

  assert(errs.length === 0, '沒有錯誤 ' + errs.join(' | '));
  await browser.close();
})().catch(function (e) { console.error(e); process.exit(1); });
