// v6 瀏覽器流程：node v6/tests/t_v6.js <test6.html> [截圖資料夾]
// 走代號傳送、看規則建築、預約、那一微秒對接、兌現與兌現失敗、活頁簿各頁與跳轉。
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
  await pg.waitForTimeout(600);
  await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.waitForTimeout(700);
  var jsClick = async function (sel) { var ok = await pg.evaluate(function (q) { var el = document.querySelector(q); if (!el) return false; el.click(); return true; }, sel); if (!ok) throw new Error('找不到 ' + sel); await pg.waitForTimeout(150); };
  var walkTo = async function (x, z) { await pg.evaluate("WORLD.walkTo({x:" + x + ", z:" + z + "})"); await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 12000 }); await pg.waitForTimeout(200); };
  var near = function () { return pg.textContent('#hudNearBody'); };
  var sheet = function () { return pg.evaluate("SHEET.ui.sheet"); };
  var main = function () { return pg.textContent('#main'); };
  var tab = async function (k) { await pg.click('#tabs a[data-s="' + k + '"]'); await pg.waitForTimeout(150); };
  assert(errs.length === 0 && (await pg.evaluate('typeof THREE')) === 'object', '載入，沒有錯誤');

  // ---- 裡世界：自己的世界五個功能點；走代號 J2 ----
  var labels = await pg.evaluate("[...document.querySelectorAll('.label')].map(l=>l.textContent)");
  assert(labels.length === 5 && labels.indexOf('帳房') >= 0 && labels.indexOf('角色碑') >= 0, '自己的世界：規則屋、市集、終點台、角色碑、帳房：' + labels.join('/'));
  assert((await pg.textContent('#hudRouteText')).indexOf('要去 J2：繞規則屋一圈（J），走到角色碑，再走到市集（2）') === 0, 'HUD 路線教學');
  await walkTo(-6, 1);
  assert((await pg.textContent('#hudNearTitle')).indexOf('這裡是規則') === 0, '靠近自己的規則屋');
  var mine = await near();
  assert(mine.indexOf('【我的點能做什麼】') >= 0 && mine.indexOf('陪跑 1 分鐘') >= 0 && mine.indexOf('對方每天的點數 至少 1000') >= 0 && mine.indexOf('要求兩方都通：關') >= 0, '規則建築顯示用途、條件白話、開關');
  await pg.screenshot({ path: OUT + '/v6_1_rules.png' });
  await pg.click('#btnCircle'); await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 15000 });
  await walkTo(0, 7);
  try { await pg.waitForFunction("APP.dec().letter === 'J'", null, { timeout: 8000 }); }
  catch (e) { console.log('DEBUG letter', await pg.evaluate("JSON.stringify({l:APP.dec().letter, msg:document.getElementById('hudMsg').textContent, pos:WORLD.playerPos(), circles:APP.me().world.walk.circles})")); throw e; }
  await walkTo(0, -4.3);                           // 角色碑
  await pg.waitForFunction("APP.dec().lastAt === 'role_00000000001'", null, { timeout: 8000 });
  await walkTo(6, 3.2);                            // 市集 → 2
  await pg.waitForFunction("APP.dec().done === 'J2'", null, { timeout: 8000 });
  assert((await pg.textContent('#hudMsg')).indexOf('傳送門') >= 0, '走出 J2，傳送門打開');
  await pg.evaluate("APP.enterPortal()"); await pg.waitForTimeout(300);
  assert((await pg.textContent('#hudWhere')).indexOf('阿澄') >= 0, '到了阿澄的世界');

  // ---- 看對方的規則建築、終點時段、預約 ----
  await walkTo(-6, 1);
  var rt = await near();
  assert(rt.indexOf('聽你講 1 分鐘') >= 0 && rt.indexOf('對方對接過幾次 至少 1') >= 0 && rt.indexOf('我不通') >= 0 && rt.indexOf('可以對接（J1 通') < 0 && rt.indexOf('可以對接') >= 0, '阿澄的規則建築：我不通他的條件，但他通我的 → 一方通可以對接：' + rt.replace(/\n/g, ' '));
  assert(rt.indexOf('東恆村規') >= 0 && !(await pg.isHidden('#btnAccept')), '看得到村規，有接受按鈕');
  await pg.click('#btnAccept'); await pg.waitForTimeout(150);
  assert((await near()).indexOf('你已接受') >= 0, '接受了村規');
  await pg.screenshot({ path: OUT + '/v6_2_their_rules.png' });
  await walkTo(6, 0.4);                            // 終點台
  var gt = await near();
  assert((await pg.textContent('#hudNearTitle')).indexOf('終點') >= 0 && gt.indexOf('名額 0／2') >= 0 && gt.indexOf('條件通') >= 0 && !(await pg.isHidden('#btnBook')), '終點顯示時段、名額，可以預約：' + gt.replace(/\n/g, ' '));
  await pg.click('#btnBook'); await pg.waitForTimeout(200);
  var slot0 = await pg.evaluate("APP.state().roles[1].slots[0]");
  assert(slot0.bookings.indexOf('00000000001') >= 0, '預約成功');
  assert((await pg.textContent('#hudGoalText')).indexOf('離對接還有') >= 0 && !(await pg.isHidden('#giveBox')), 'HUD 倒數並可填要給多少');
  // 把時段改到 5 秒後，站在終點上等那一微秒
  await pg.evaluate("(function(){ var s=APP.state().roles[1].slots[0]; s.atUs = DATA.nowUs() + 5e6; APP.save(); })()");
  await pg.fill('#giveIn', '300');
  await pg.waitForSelector('#meet:not([hidden])', { timeout: 12000 });
  var mt = await pg.textContent('#meetText');
  assert(mt.indexOf('對接成立') >= 0 && mt.indexOf('J2 通 J1 的條件') >= 0, '那一微秒對接成立：' + mt);
  var pts = await pg.evaluate("APP.state().points");
  assert(pts.length === 2 && pts[0].issuer === '00000000002' && pts[0].amount === 100 && pts[1].issuer === '00000000001' && pts[1].amount === 300, '互給點數：阿澄給 100、我給 300');
  await pg.screenshot({ path: OUT + '/v6_3_dock.png' });
  await pg.click('#meetOpen'); await pg.waitForTimeout(300);
  assert((await sheet()) === 'dockings' && (await main()).indexOf('J2 通 J1 的條件') >= 0, '對接紀錄頁');

  // ---- 活頁簿：分頁順序、下一步、點數、兌現 ----
  var tabs = await pg.evaluate("[...document.querySelectorAll('#tabs a')].map(function(a){return a.textContent.replace(/^[裡ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/,'')})");
  assert(tabs.join('｜') === '裡世界｜下一步｜查詢｜角色｜規則｜資源｜世界｜走法｜對接時段｜對接紀錄｜點數｜兌現', '分頁順序：' + tabs.join('｜'));
  await tab('points');
  var pt = await main();
  assert(pt.indexOf('J2 阿澄') >= 0 && pt.indexOf('100') >= 0 && pt.indexOf('我今天還能給 1500 點') >= 0, '點數頁：手上 100 阿澄點，今天還能給 1500');
  await jsClick('#main [data-table="hold"] [data-act="jump"][data-s="redeem"]');
  assert((await sheet()) === 'redeem' && (await pg.evaluate("SHEET.ui.redeemIssuer")) === '00000000002', '跳到兌現頁，向阿澄兌現');
  await jsClick('[data-act="redeem"][data-id="r2a"]');     // 改履歷 100
  var rd = await pg.evaluate("APP.state().redeems");
  assert(rd.length === 1 && rd[0].ok && (await pg.evaluate("CORE.balance(APP.state(),'00000000001','00000000002',DATA.nowUs())")) === 0, '兌現成功，點用掉');
  await jsClick('[data-act="redeem"][data-id="r2b"]');
  assert((await pg.textContent('#sheetMsg')).indexOf('只有 0') >= 0, '點不夠擋下');
  await pg.screenshot({ path: OUT + '/v6_4_redeem.png' });

  // 兌現失敗 → 自動空窗：換成阿澄，拿 300 我點去換「陪跑一小時」（數量 1）兩次
  await pg.evaluate("APP.becomeMe(1)"); await pg.evaluate("APP.showTab('sheet'); SHEET.navigate('redeem', '00000000001:')"); await pg.waitForTimeout(200);
  await jsClick('[data-act="redeem"][data-id="r1a"]');
  assert((await pg.evaluate("APP.state().roles[0].resources[0].qty")) === 0, '阿澄換走了唯一一份');
  assert((await main()).indexOf('數量 0：換了會兌現失敗') >= 0, '畫面警告數量 0');
  await jsClick('[data-act="redeem"][data-id="r1a"]');
  assert((await pg.textContent('#sheetMsg')).indexOf('自動進入空窗') >= 0 && (await pg.evaluate("APP.state().roles[0].state")) === 'vacancy', '兌現失敗，我自動進入空窗');
  assert((await main()).indexOf('兌現失敗，主人進入空窗') >= 0, '兌現紀錄公開失敗');
  await jsClick('[data-act="redeem"][data-id="r1b"]');
  assert((await pg.textContent('#sheetMsg')).indexOf('暫停兌現') >= 0, '空窗中暫停兌現');
  // 回到我：補貨、離開空窗（自動兌現欠的那一筆）
  await pg.evaluate("APP.becomeMe(0)"); await pg.evaluate("APP.showTab('sheet'); SHEET.navigate('roles')"); await pg.waitForTimeout(200);
  assert((await main()).indexOf('空窗') >= 0 && (await main()).indexOf('欠 J2 阿澄 一筆兌現') >= 0, '角色頁顯示空窗與欠的一筆');
  await jsClick('[data-act="vacOut"]');
  assert((await pg.textContent('#sheetMsg')).indexOf('先補足') >= 0, '沒補貨不能離開空窗');
  await tab('resources');
  await jsClick('[data-act="restock"][data-id="r1a"]');
  await tab('roles');
  await jsClick('[data-act="vacOut"]');
  assert((await pg.evaluate("APP.state().roles[0].state")) === 'active' && (await pg.evaluate("APP.state().roles[0].vacancyDebt")) === null && (await pg.evaluate("APP.state().redeems.length")) === 4, '補足後離開空窗，欠的那一筆自動兌現');

  // ---- 查詢頁、對接時段頁 ----
  await tab('query');
  var q = await main();
  assert(q.indexOf('我可以去找的人') >= 0 && q.indexOf('J3 小樂') >= 0 && q.indexOf('可能來找我的人') >= 0, '查詢頁兩張表');
  await pg.fill('#kwIn', '書'); await jsClick('[data-act="search"]');
  assert((await main()).indexOf('借一本書') >= 0, '資源關鍵字查詢');
  await tab('slots');
  await pg.fill('#addSlotMin', '5'); await pg.fill('#addSlotCap', '2'); await pg.fill('#addSlotGive', '50'); await jsClick('[data-act="addSlot"]');
  assert((await pg.evaluate("APP.me().slots.length")) === 2, '開了時段');
  assert((await main()).indexOf('可以預約的時段') >= 0, '列出可以預約的時段');

  // ---- 空窗角色的拒絕：只有做不到對方的要求才能拒絕 ----
  // 阿澄進空窗、開時段；我預約（空窗角色條件關閉，一方通）；阿澄每天 2000 做得到我的要求 → 沒有拒絕按鈕
  await pg.evaluate("APP.becomeMe(1)"); await pg.evaluate("APP.showTab('sheet'); SHEET.navigate('roles')"); await pg.waitForTimeout(150);
  await jsClick('[data-act="vacIn"]');
  await tab('slots'); await pg.fill('#addSlotMin', '9'); await jsClick('[data-act="addSlot"]');
  var vs = await pg.evaluate("APP.me().slots[APP.me().slots.length-1].id");
  await pg.evaluate("APP.becomeMe(0)"); await pg.evaluate("APP.showTab('sheet'); SHEET.navigate('slots')"); await pg.waitForTimeout(150);
  await jsClick('[data-act="book"][data-id="' + vs + '"]');
  assert((await pg.evaluate("CORE.slotOf(APP.state(),'" + vs + "').slot.bookings")).indexOf('00000000001') >= 0, '空窗的阿澄照樣有名額，我預約成功');
  await pg.evaluate("APP.becomeMe(1)"); await pg.evaluate("APP.showTab('sheet'); SHEET.navigate('slots')"); await pg.waitForTimeout(150);
  assert((await pg.$('[data-act="refuse"]')) === null, '阿澄做得到我的要求（2000 ≥ 1000）：沒有拒絕按鈕');
  await tab('roles'); await jsClick('[data-act="vacOut"]');
  // 小樂進空窗、開時段；我預約；小樂每天 800 做不到我的要求（≥ 1000）→ 有拒絕按鈕
  await pg.evaluate("APP.becomeMe(2)"); await pg.evaluate("APP.showTab('sheet'); SHEET.navigate('roles')"); await pg.waitForTimeout(150);
  await jsClick('[data-act="vacIn"]');
  await tab('slots'); await pg.fill('#addSlotMin', '9'); await jsClick('[data-act="addSlot"]');
  var ss = await pg.evaluate("APP.me().slots[0].id");
  await pg.evaluate("APP.becomeMe(0)"); await pg.evaluate("APP.showTab('sheet'); SHEET.navigate('slots')"); await pg.waitForTimeout(150);
  await jsClick('[data-act="book"][data-id="' + ss + '"]');
  await pg.evaluate("APP.becomeMe(2)"); await pg.evaluate("APP.showTab('sheet'); SHEET.navigate('slots')"); await pg.waitForTimeout(150);
  assert((await pg.$('[data-act="refuse"][data-who="00000000001"]')) !== null && (await main()).indexOf('拒絕（做不到對方的要求）') >= 0, '小樂做不到我的要求：出現拒絕按鈕');
  await jsClick('[data-act="refuse"][data-who="00000000001"]');
  var sl = await pg.evaluate("APP.me().slots[0]");
  assert(sl.bookings.length === 0 && sl.refused.indexOf('00000000001') >= 0 && (await main()).indexOf('已拒絕') >= 0, '拒絕後預約拿掉、標已拒絕');
  assert((await pg.evaluate("APP.state().records.slice(-1)[0].kind")) === 'refuse', '留下拒絕紀錄');
  await tab('roles'); await jsClick('[data-act="vacOut"]');
  await pg.evaluate("SHEET.navigate('slots')"); await pg.waitForTimeout(150);
  assert((await pg.$('[data-act="refuse"]')) === null, '離開空窗後不能拒絕');

  // ---- 那一微秒：不在終點上就錯過，之後不能再對接 ----
  await pg.evaluate("APP.becomeMe(0)");
  await pg.evaluate("(function(){ var s=APP.state(); var b=s.roles[1]; var sl=b.slots.find(function(x){return x.id==='" + vs + "'}); sl.atUs = DATA.nowUs() + 2e6; APP.save(); })()");
  await pg.evaluate("APP.showTab('world'); APP.teleportTo(APP.state().roles[1])"); await pg.waitForTimeout(300);
  await pg.waitForFunction("CORE.missed(CORE.slotOf(APP.state(),'" + vs + "').slot, '00000000001')", null, { timeout: 8000 });
  assert(true, '規則層標為錯過');
  assert((await pg.textContent('#hudGoalText')).indexOf('錯過了 1 個時段') >= 0, 'HUD 顯示錯過');
  var tryDock = await pg.evaluate("(function(){ try { CORE.dock(APP.state(),'" + vs + "','00000000001',0,0,DATA.nowUs()); return 'ok'; } catch (e) { return e.message; } })()");
  assert(tryDock.indexOf('錯過') >= 0, '錯過之後 dock() 擋下：' + tryDock);
  await pg.evaluate("APP.showTab('sheet'); SHEET.navigate('slots')"); await pg.waitForTimeout(150);
  assert((await main()).indexOf('錯過，不能再對接') >= 0, '我預約的表標錯過');
  await pg.evaluate("APP.goHome()"); await pg.waitForTimeout(100);

  // ---- 角色：建草稿 → 規則（條件下拉）→ 資源 → 創角色；規則鎖住；結束並重創 ----
  await tab('roles');
  await pg.fill('#addRoleName', '新人'); await pg.fill('#addRoleDaily', '500'); await jsClick('[data-act="newDraft"]');
  assert((await sheet()) === 'rules' && (await pg.evaluate("SHEET.ui.rulesRole")) === 'draft', '建草稿後到規則頁');
  await pg.fill('#addUse', '1 新人點 = 借筆記'); await jsClick('[data-act="addUse"]');
  await pg.selectOption('#addCondField', 'status'); await jsClick('[data-act="addCond"]');
  await pg.selectOption('select[data-ed="condValue"][data-id="0"]', 'vacancy'); await pg.waitForTimeout(100);
  await pg.selectOption('select[data-ed="condOp"][data-id="0"]', '!='); await pg.waitForTimeout(100);
  assert((await main()).indexOf('對方狀態 不是 空窗') >= 0, '條件下拉：對方狀態 不是 空窗');
  await pg.evaluate("(function(){ var el=document.querySelector('input[data-ed=switch][data-id=bothMustPass]'); el.checked=true; el.dispatchEvent(new Event('change',{bubbles:true})); })()"); await pg.waitForTimeout(100);
  await pg.fill('textarea[data-ed="village"]', '新人村規'); await pg.dispatchEvent('textarea[data-ed="village"]', 'change'); await pg.waitForTimeout(100);
  await jsClick('[data-act="jump"][data-s="resources"]').catch(function () {}); await pg.evaluate("SHEET.ui.resRole='draft'; SHEET.navigate('resources')"); await pg.waitForTimeout(150);
  await pg.fill('#addResName', '筆記一本'); await pg.fill('#addResPrice', '5'); await pg.fill('#addResQty', '3'); await jsClick('[data-act="addRes"]');
  await pg.evaluate("SHEET.navigate('rules', 'draft:')"); await pg.waitForTimeout(150);
  await jsClick('[data-act="createRole"]');
  var r4 = await pg.evaluate("APP.state().roles[3]");
  assert(r4 && r4.serial === '00000000004' && r4.dailyPoints === 500 && r4.rules.uses.length === 1 && r4.rules.conditions[0].op === '!=' && r4.rules.bothMustPass && r4.rules.village === '新人村規' && r4.resources[0].name === '筆記一本' && r4.rulesHash, '創了角色 J4，規則、資源、開關、村規都進去');
  assert((await pg.evaluate("APP.me().serial")) === '00000000004' && (await pg.evaluate("APP.state().draft")) === null, '我變成 J4，草稿清掉');
  await pg.evaluate("SHEET.navigate('rules', '00000000004:')"); await pg.waitForTimeout(150);
  assert((await pg.$('[data-act="addUse"]')) === null && (await pg.$('[data-act="endEarly"]')) !== null, '創完規則鎖住，只有結束並重創');
  await jsClick('[data-act="endEarly"]');
  assert((await pg.evaluate("APP.state().roles[3].state")) === 'ended' && (await pg.evaluate("APP.state().draft.prev")) === '00000000004' && (await pg.evaluate("APP.state().draft.rules.village")) === '新人村規', '結束後草稿帶原規則、前身 J4');
  await pg.fill('input[data-ed="draftName"]', '新人二代'); await pg.dispatchEvent('input[data-ed="draftName"]', 'change'); await pg.waitForTimeout(100);
  await jsClick('[data-act="createRole"]');
  assert((await pg.evaluate("APP.state().roles[4].prev")) === '00000000004' && (await pg.evaluate("APP.state().roles[4].name")) === '新人二代', '重創成 J5，前身 J4');
  await pg.screenshot({ path: OUT + '/v6_5_roles.png' });

  // ---- 下一步頁、世界頁、重新整理 ----
  await pg.evaluate("APP.becomeMe(0)"); await pg.evaluate("APP.showTab('sheet'); SHEET.navigate('next')"); await pg.waitForTimeout(200);
  var rows = await pg.evaluate("[...document.querySelectorAll('#main tr[data-row]')].map(function(t){return t.querySelector('td[data-c=\"0\"]').textContent})");
  assert(rows.join('') === '① 建角色② 寫規則與條件③ 資源④ 世界與走法⑤ 開對接時段⑥ 去查詢、預約別人', '下一步六步：' + rows.join('/'));
  await jsClick('.nextbar [data-act="nextSheet"]');
  assert((await sheet()) === 'query', '下一步 → 去查詢（前五步都完成）');
  await tab('world');
  await pg.selectOption('select[data-ed="objDoor"][data-id="rule_00000000001"]', 'all'); await pg.waitForTimeout(150);
  assert((await pg.evaluate("CORE.findObject(APP.me().world,'rule_00000000001').door.visible")) === 'all', '世界頁開門');
  await pg.click('#tabs a[data-act="world"]'); await pg.waitForTimeout(200);
  await walkTo(-6, 1);
  assert(!(await pg.isHidden('#btnEnter')), '裡世界看得到進門');
  await pg.reload(); await pg.waitForTimeout(700);
  assert((await pg.evaluate("APP.state().roles.length")) === 5 && (await pg.evaluate("APP.state().dockings.length")) === 1, '存檔還在');
  assert(errs.length === 0, '整段沒有錯誤 ' + errs.join(' | '));
  await browser.close();
})().catch(function (e) { console.error(e); process.exit(1); });
