// 藏和自訂：換人看公開、只給鄰居看、全藏、整間屋只給鄰居看，各自看到什麼；「還有 N 筆蓋著」；全藏旁邊的小字；
// 自訂屋型、顏色、樣式、門牌；放擺設、轉、拿掉、第 21 個放不上去、換人看得到；日曆一格一天、換月、點一格、在明細裡改藏。
// node v9/tests/t_hide.js <test9.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003';
var FIND = "(function(){var v=HOUSE.data(),t=v.today;var s=WORLD.screenOf({day:t});if(!s)return null;var h=WORLD.hitAt(s.x,s.y);return h&&h.kind==='brick'&&h.day===t&&document.elementFromPoint(s.x,s.y).tagName==='CANVAS'?t:null;})()";
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  var becomeMe = async function (serial) { await H.ev("APP.goTable(null,'role')"); await H.nav('role'); var i = await H.ev("APP.state().roles.findIndex(function(r){return r.serial==='" + serial + "';})"); await H.edit('#tmain select[data-ed="me"]', i); assert((await H.ev("APP.me().serial")) === serial, '換人成 ' + serial); };
  var lookToday = async function (owner) { await H.ev("APP.goHouse('" + owner + "');HOUSE.render({resetCamera:true})"); await pg.waitForTimeout(400); var d = await H.ev(FIND); if (d == null) throw new Error('看不到今天那塊磚'); await H.tap3d({ day: d }, '今天那塊磚'); };
  // 今天 J1 跟阿澄成交三次
  var ids = await H.ev("(function(){var S=APP.state(),t=APP.now(),out=[];for(var k=0;k<3;k++){var s=CORE.addSlot(S,'" + J1 + "',t+(1.5+k*0.2)*1e6,1,null,t);CORE.book(S,'" + J2 + "',s.id,t);CORE.setWants(S,s.id,'" + J2 + "','" + J1 + "',['r1b']);CORE.setWants(S,s.id,'" + J1 + "','" + J2 + "',['r2b']);out.push(s.id);}APP.changed();return out;})()");
  await pg.waitForFunction("APP.state().entries.filter(function(e){return e.status==='traded';}).length===3", null, { timeout: 15000 }); await pg.waitForTimeout(300); if (await H.popOpen()) await H.popOk();
  // 1. 日曆：一格一天；點今天；在明細裡改藏（第二筆只給鄰居看、第三筆全藏）
  await H.nav('calendar');
  var cal = await H.ev("JSON.stringify({cells:document.querySelectorAll('#tmain .cal .cd[data-day]').length,month:document.querySelector('#tmain .calhead b').textContent})"); cal = JSON.parse(cal);
  assert(cal.cells >= 28 && cal.cells <= 31, '日曆一個月一張、一格一天：' + cal.month + ' ' + cal.cells + ' 格');
  await H.click('#tmain [data-cal="-1"]'); var prev = await pg.textContent('#tmain .calhead b'); await H.click('#tmain [data-cal="1"]');
  assert(prev !== cal.month && (await pg.textContent('#tmain .calhead b')) === cal.month, '換月：上個月 ' + prev + '，再回來');
  var today = await H.ev("CORE.dayNum(APP.now())");
  assert((await H.ev("document.querySelector('#tmain .cal [data-day=\"" + today + "\"]').className")).indexOf('lit3') >= 0, '今天那一格三筆成交：最亮');
  await H.click('#tmain .cal [data-day="' + today + '"]');
  var ents = await H.ev("Array.from(document.querySelectorAll('#popBody select[data-vis]')).map(function(s){return s.dataset.vis;})");
  assert(ents.length === 3 && (await H.popBody()).indexOf('我給了') >= 0, '那天的明細三筆，每一筆都能改給誰看');
  await H.edit('#popBody select[data-vis="' + ents[1] + '"]', 'neighbors'); await H.edit('#popBody select[data-vis="' + ents[2] + '"]', 'hidden');
  assert((await H.popBody()).indexOf('對方的達秒屋可能還看得到') >= 0 && (await H.ev("document.querySelectorAll('#popBody .vis .warn').length")) === 1, '選全藏時旁邊一行小字「對方的達秒屋可能還看得到」');
  assert((await H.ev("JSON.stringify(APP.state().entries.filter(function(e){return e.status==='traded';}).map(function(e){return e.vis['" + J1 + "'];}))")) === '["public","neighbors","hidden"]', '改了馬上生效：公開、只給鄰居看、全藏');
  await H.popOk();
  // 2. 換人成小樂（陌生人）看：只看得到公開那一筆，「還有 2 筆蓋著」
  await becomeMe(J3); await lookToday(J1);
  assert((await H.ev("document.querySelectorAll('#popBody .ent-h').length")) === 1 && (await H.popBody()).indexOf('還有 2 筆蓋著') >= 0, '陌生人：公開的一筆看得到，只給鄰居看和全藏的「還有 2 筆蓋著」（這一輪沒有鄰居）');
  assert((await H.ev("document.querySelectorAll('#popBody select').length")) === 0, '別人的屋不能改藏'); await H.popOk();
  // 3. 換人成阿澄（對接的人）看：三筆都看得到
  await becomeMe(J2); await lookToday(J1);
  assert((await H.ev("document.querySelectorAll('#popBody .ent-h').length")) === 3 && (await H.popBody()).indexOf('蓋著') < 0, '對接的人永遠看得到那一筆：三筆都在');
  assert((await H.popBody()).indexOf('保留中') >= 0, '選好的東西現在怎樣，對接的人看得到'); await H.popOk();
  // 4. J1 全部藏起來：陌生人看到蓋布
  await becomeMe(J1); await H.nav('calendar'); await H.click('#tmain .cal [data-day="' + today + '"]'); await H.edit('#popBody select[data-vis="' + ents[0] + '"]', 'hidden'); await H.edit('#popBody select[data-vis="' + ents[1] + '"]', 'hidden'); await H.popOk();
  await becomeMe(J3); await lookToday(J1);
  assert((await H.ev("document.querySelectorAll('#popBody .ent-h').length")) === 0 && (await H.popBody()).indexOf('還有 3 筆蓋著') >= 0 && (await H.ev("WORLD.info().cover")) === 1, '全藏：陌生人只看到蓋布，「還有 3 筆蓋著」'); await H.popOk();
  assert((await H.ev("CORE.dockCount(APP.state(),'" + J1 + "')")) === 3, '藏了，對接過幾次照算（3 次）');
  // 5. 整間屋只給鄰居看：陌生人只看得到外觀和牌子，磚點不開，門照樣打得開
  await becomeMe(J1); await H.nav('calendar'); await H.click('#tmain .cal [data-day="' + today + '"]'); await H.edit('#popBody select[data-vis="' + ents[0] + '"]', 'public'); await H.popOk();
  await H.nav('house'); await H.edit('#tmain select[data-id="visibility"]', 'neighbors');
  assert((await H.ev("CORE.houseOf(APP.me()).visibility")) === 'neighbors', '我的達秒屋：整間屋只給鄰居看');
  await becomeMe(J3); await H.ev("APP.goHouse('" + J1 + "');HOUSE.render({resetCamera:true})"); await pg.waitForTimeout(400);
  assert((await pg.textContent('#hwho')).indexOf('只給鄰居看') >= 0 && (await H.ev("HOUSE.data().closed")) && (await H.ev("WORLD.info().lit + WORLD.info().cover + WORLD.info().marks")) === 0, '陌生人：掛「只給鄰居看」的牌子，磚沒有亮暗');
  var s0 = await H.ev("(function(){var s=WORLD.screenOf({day:HOUSE.data().today});return s;})()"); await pg.mouse.click(s0.x, s0.y); await pg.waitForTimeout(200);
  assert(!(await H.popOpen()) && (await pg.textContent('#hmsg')).indexOf('點不開') >= 0, '點磚點不開');
  await H.tap3d('door', '門'); assert((await H.sheetName()) === 'other:role', '門照樣打得開：到他的表格世界');
  // 6. 自訂：屋型、顏色、樣式、門牌（我的達秒屋），換人看得到
  await becomeMe(J1); await H.nav('house'); await H.edit('#tmain select[data-id="visibility"]', 'public');
  var setv = { shape: 'round', wall: 'cream', roof: 'pine', trim: 'ink', door: 'arch', window: 'round', roofStyle: 'dome' };
  for (var k in setv) await H.edit('#tmain select[data-id="' + k + '"]', setv[k]);
await H.edit('#tmain input[data-id="sign"]', '歡迎來坐');
  var h = JSON.parse(await H.ev("JSON.stringify(CORE.houseOf(APP.me()))"));
  assert(Object.keys(setv).every(function (k) { return h[k] === setv[k]; }) && h.sign === '歡迎來坐', '換屋型、三種顏色、三種樣式、門牌一句話都存起來了');
  await H.edit('#tmain input[data-id="sign"]', '一二三四五六七八九十一二三四五六七八九十一二'); assert((await H.ev("CORE.houseOf(APP.me()).sign")) === '歡迎來坐' || (await H.ev("CORE.houseOf(APP.me()).sign.length")) <= 20, '門牌超過 20 字存不進去');
  // 7. 擺設：放、轉、拿掉；第 21 個放不上去
  await H.clickText('去我的達秒屋', '#tmain'); await pg.waitForTimeout(400);
  await H.hclick('#hPlace'); await pg.waitForTimeout(300);
  assert((await pg.textContent('#hhint')).indexOf('點地上的圓格') >= 0, '擺設模式：點地上的圓格放擺設');
  await H.tap3d({ cell: [0, 1] }, '地上一格'); assert((await H.popTitle()) === '放一樣擺設', '點地上一格：選一樣（' + (await H.popOpen()) + ' ' + (await H.popTitle()) + ' ' + (await pg.textContent('#hmsg')) + ' ' + JSON.stringify(await H.ev("HOUSE.st")) + '）'); await H.popOk('樹');
  assert((await H.ev("JSON.stringify(CORE.houseOf(APP.me()).props)")) === '[{"kind":"tree","a":0,"r":1,"rot":0}]' && (await H.ev("WORLD.info().props")) === 1, '放了一棵樹');
  await H.tap3d({ prop: [0, 1] }, '樹'); await H.popOk('轉 90 度'); assert((await H.ev("CORE.houseOf(APP.me()).props[0].rot")) === 90, '轉了 90 度');
  await H.tap3d({ prop: [0, 1] }, '樹'); await H.popOk('拿掉'); assert((await H.ev("CORE.houseOf(APP.me()).props.length")) === 0, '拿掉了');
  await H.ev("(function(){for(var i=1;i<=20;i++)CORE.placeProp(APP.state(),APP.me().serial,{kind:['tree','flower','lamp','flag','bench','rock'][i%6],a:i%24,r:2,rot:0});APP.changed();})()");
  await H.tap3d({ cell: [0, 0] }, '空的一格'); await H.popOk('花');
  assert((await H.popTitle()) === '放不上去' && (await H.popBody()).indexOf('最多 20') >= 0 && (await H.ev("CORE.houseOf(APP.me()).props.length")) === 20, '第 21 個放不上去'); await H.popOk();
  // 換人看得到
  await becomeMe(J3); await H.ev("APP.goHouse('" + J1 + "')"); await pg.waitForTimeout(300);
  var lk = JSON.parse(await H.ev("JSON.stringify({shape:HOUSE.data().look.shape,sign:HOUSE.data().sign,props:WORLD.info().props})"));
  assert(lk.shape === 'round' && lk.sign === '歡迎來坐' && lk.props === 20 && (await pg.textContent('#hwho')).indexOf('歡迎來坐') >= 0, '換人看得到：圓屋、門牌「歡迎來坐」、20 個擺設');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
