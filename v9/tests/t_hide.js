// 藏：換人看公開、只給鄰居看、全藏、整間屋只給鄰居看，各自看到什麼（磚都在日曆方塊上）；「還有 N 筆蓋著」；全藏旁邊的小字；
// 看別人的屋，明細寫屋主的名字（不寫「我」）；門牌一句話、換人看得到；日曆紙一格一天、換月、今天最亮，他的日曆照藏（蓋布）；點自己屋上今天那塊磚，在明細裡改藏。
// node v9/tests/t_hide.js <test9.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003';
var FIND = "(function(){var v=HOUSE.data(),t=v.today;var s=WORLD.screenOf({day:t});if(!s)return null;var h=WORLD.hitAt(s.x,s.y);return h&&h.kind==='brick'&&h.day===t&&document.elementFromPoint(s.x,s.y).tagName==='CANVAS'?t:null;})()";
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  var becomeMe = H.becomeMe;
  var lookToday = async function (owner) { await H.ev("APP.goHouse('" + owner + "');HOUSE.render({resetCamera:true})"); await pg.waitForTimeout(400); var d = await H.ev(FIND); if (d == null) throw new Error('看不到今天那塊磚'); await H.tap3d({ day: d }, '今天那塊磚'); };
  // 今天 J1 跟阿澄成交三次
  var ids = await H.ev("(function(){var S=APP.state(),t=APP.now(),out=[];for(var k=0;k<3;k++){var s=CORE.addSlot(S,'" + J1 + "',t+(1.5+k*0.2)*1e6,1,null,t);CORE.book(S,'" + J2 + "',s.id,t);CORE.setWants(S,s.id,'" + J2 + "','" + J1 + "',['r1b']);CORE.setWants(S,s.id,'" + J1 + "','" + J2 + "',['r2b']);out.push(s.id);}APP.changed();return out;})()");
  await pg.waitForFunction("APP.state().entries.filter(function(e){return e.status==='traded';}).length===3", null, { timeout: 15000 }); await pg.waitForTimeout(300); if (await H.popOpen()) await H.popOk();
  // 1. 日曆紙：一格一天、換月、今天最亮；點自己屋上今天那塊磚，在明細裡改藏（第二筆只給鄰居看、第三筆全藏）
  await H.nav('cal');
  var cal = JSON.parse(await H.ev("JSON.stringify({cells:document.querySelectorAll('#tmain table.calp td.day').length,y:+document.querySelector('#tmain table.calp').dataset.y,m:+document.querySelector('#tmain table.calp').dataset.m})"));
  assert(cal.cells >= 28 && cal.cells <= 31, '日曆紙一個月一張、一格一天：' + cal.y + ' 年 ' + (cal.m + 1) + ' 月 ' + cal.cells + ' 格');
  await H.clickText('‹ 前一個月', '#tmain'); var prevM = +(await H.ev("document.querySelector('#tmain table.calp').dataset.m")); await H.clickText('後一個月 ›', '#tmain');
  assert(prevM === (cal.m + 11) % 12 && +(await H.ev("document.querySelector('#tmain table.calp').dataset.m")) === cal.m, '換月：上個月 ' + (prevM + 1) + ' 月，再回來');
  var today = await H.ev("CORE.dayNum(APP.now())");
  assert((await H.ev("document.querySelector('#tmain table.calp td[data-day=\"" + today + "\"]').className")).indexOf('lit3') >= 0, '今天那一格三筆成交：最亮');
  await lookToday(J1);
  var ents = await H.ev("Array.from(document.querySelectorAll('#popBody select[data-vis]')).map(function(s){return s.dataset.vis;})");
  assert(ents.length === 3 && (await H.popBody()).indexOf('我給了') >= 0, '點自己屋上今天那塊磚：那天的明細三筆，每一筆都能改給誰看');
  await H.edit('#popBody select[data-vis="' + ents[1] + '"]', 'neighbors'); await H.edit('#popBody select[data-vis="' + ents[2] + '"]', 'hidden');
  assert((await H.popBody()).indexOf('對方的達秒屋可能還看得到') >= 0 && (await H.ev("document.querySelectorAll('#popBody .vis .warn').length")) === 1, '選全藏時旁邊一行小字「對方的達秒屋可能還看得到」');
  assert((await H.ev("JSON.stringify(APP.state().entries.filter(function(e){return e.status==='traded';}).map(function(e){return e.vis['" + J1 + "'];}))")) === '["public","neighbors","hidden"]', '改了馬上生效：公開、只給鄰居看、全藏');
  await H.popOk();
  // 2. 換人成小樂（陌生人）看：只看得到公開那一筆，「還有 2 筆蓋著」
  await becomeMe(J3); await lookToday(J1);
  assert((await H.ev("document.querySelectorAll('#popBody .ent-h').length")) === 1 && (await H.popBody()).indexOf('還有 2 筆蓋著') >= 0, '陌生人：公開的一筆看得到，只給鄰居看和全藏的「還有 2 筆蓋著」（這一輪沒有鄰居）');
  assert((await H.ev("document.querySelectorAll('#popBody select').length")) === 0, '別人的屋不能改藏'); await H.popOk();
  await H.ev("APP.goTable(null,'log')"); await H.serial('J1'); await H.clickText('看他的日曆', '#tmain');
  var oc = await H.ev("(function(){var td=document.querySelector('#tmain table.calp td[data-day=\"" + today + "\"]');return {cls:td.className,txt:td.textContent};})()");
  assert((await H.sheetName()) === 'other:cal' && oc.cls.indexOf('lit1') >= 0 && oc.txt.indexOf('2 筆蓋著') >= 0 && (oc.txt.match(/阿澄/g) || []).length === 1, '小樂看 J1 的日曆紙：今天亮一級、寫一筆、「2 筆蓋著」');
  await H.clickText('回我自己', '#tother');
  await lookToday(J2);
  assert((await H.popBody()).indexOf('阿澄給了') >= 0 && (await H.popBody()).indexOf('阿澄拿到') >= 0 && (await H.popBody()).indexOf('我給了') < 0, '看別人的屋：明細寫屋主的名字「阿澄給了／阿澄拿到」，不寫「我」'); await H.popOk();
  // 3. 換人成阿澄（對接的人）看：三筆都看得到
  await becomeMe(J2); await lookToday(J1);
  assert((await H.ev("document.querySelectorAll('#popBody .ent-h').length")) === 3 && (await H.popBody()).indexOf('蓋著') < 0, '對接的人永遠看得到那一筆：三筆都在');
  assert((await H.popBody()).indexOf('保留中') >= 0, '選好的東西現在怎樣，對接的人看得到'); await H.popOk();
  // 4. J1 全部藏起來：陌生人看到蓋布
  await becomeMe(J1); await lookToday(J1); await H.edit('#popBody select[data-vis="' + ents[0] + '"]', 'hidden'); await H.edit('#popBody select[data-vis="' + ents[1] + '"]', 'hidden'); await H.popOk();
  await becomeMe(J3); await lookToday(J1);
  assert((await H.ev("document.querySelectorAll('#popBody .ent-h').length")) === 0 && (await H.popBody()).indexOf('還有 3 筆蓋著') >= 0 && (await H.ev("WORLD.info().cover")) === 1, '全藏：陌生人只看到蓋布，「還有 3 筆蓋著」'); await H.popOk();
  await H.ev("APP.goTable(null,'log')"); await H.serial('J1'); await H.clickText('看他的日曆', '#tmain');
  assert((await H.ev("document.querySelector('#tmain table.calp td[data-day=\"" + today + "\"]').className")).indexOf('cover') >= 0, '日曆紙上今天那格也是蓋布'); await H.clickText('回我自己', '#tother');
  assert((await H.ev("CORE.dockCount(APP.state(),'" + J1 + "')")) === 3, '藏了，對接過幾次照算（3 次）');
  // 5. 整間屋只給鄰居看：陌生人只看得到外觀和牌子，磚點不開，門照樣打得開
  await becomeMe(J1); await lookToday(J1); await H.edit('#popBody select[data-vis="' + ents[0] + '"]', 'public'); await H.popOk();
  await H.ev("APP.goTable(null,'more')"); await H.nav('house'); await H.edit('#tmain select[data-id="visibility"]', 'neighbors');
  assert((await H.ev("CORE.houseOf(APP.me()).visibility")) === 'neighbors', '我的達秒屋：整間屋只給鄰居看');
  await becomeMe(J3); await H.ev("APP.goHouse('" + J1 + "');HOUSE.render({resetCamera:true})"); await pg.waitForTimeout(400);
  assert((await pg.textContent('#hwho')).indexOf('只給鄰居看') >= 0 && (await H.ev("HOUSE.data().closed")) && (await H.ev("WORLD.info().lit + WORLD.info().cover + WORLD.info().marks")) === 0, '陌生人：掛「只給鄰居看」的牌子，門牆的磚沒有亮暗');
  assert((await H.ev("WORLD.info().blocks")) === (await H.ev("CORE.viewHouse(APP.state(),'" + J1 + "','" + J3 + "').look.n")) && (await H.ev("WORLD.info().cal")) === (await H.ev("CORE.houseOf(APP.roleOf('" + J1 + "')).cal.blocks.length")) && (await H.ev("HOUSE.data().sign")) === '', '只給鄰居看：外觀（自己蓋的部分、日曆方塊的形狀）照樣看得到，門牌上的字看不到');
  var s0 = await H.ev("(function(){var s=WORLD.screenOf({day:HOUSE.data().today});return s;})()"); await pg.mouse.click(s0.x, s0.y); await pg.waitForTimeout(200);
  assert(!(await H.popOpen()) && (await pg.textContent('#hmsg')).indexOf('點不開') >= 0, '點磚點不開');
  await H.tap3d('door', '門'); assert((await H.sheetName()) === 'other:res', '門照樣打得開：到他的資源表那張紙');
  // 6. 門牌一句話（我的達秒屋），換人看得到；超過 20 字存不進去
  await becomeMe(J1); await H.nav('house'); await H.edit('#tmain select[data-id="visibility"]', 'public');
  await H.edit('#tmain input[data-id="sign"]', '歡迎來坐');
  assert((await H.ev("CORE.houseOf(APP.me()).sign")) === '歡迎來坐', '門牌一句話存起來了');
  await H.edit('#tmain input[data-id="sign"]', '一二三四五六七八九十一二三四五六七八九十一二'); assert((await H.ev("CORE.houseOf(APP.me()).sign")) === '歡迎來坐', '門牌超過 20 字存不進去');
  await becomeMe(J3); await H.ev("APP.goHouse('" + J1 + "')"); await pg.waitForTimeout(300);
  assert((await H.ev("HOUSE.data().sign")) === '歡迎來坐' && (await pg.textContent('#hwho')).indexOf('歡迎來坐') >= 0 && (await H.ev("WORLD.info().lit")) === 1, '換人看得到門牌「歡迎來坐」，今天那塊磚亮');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
