// 一起成交的時段（DESIGN 補四）：表世界三個人湊一圈全部成交、有人不選整個時段不成交；裡世界開時段看得到標示、兩人成交一次、不成交一次；兩邊都能刪沒人預約的時段。
// node v8/tests/t_together.js <test8.html>
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003';
var shorten = function (H, id) { return H.ev("(function(){var S=APP.state(),x=CORE.slotOf(S,'" + id + "');x.slot.atUs=APP.now()+3e6;APP.changed();})()"); };
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  /* ===== 表世界 ===== */
  await H.fresh(); await H.toSheet();
  var becomeMe = async function (serial) { await H.sheet('roles'); await H.edit('input[data-ed="me"][data-id="' + serial + '"]', null, true); assert((await H.ev("APP.me().serial")) === serial, '換人成 ' + serial); };
  var openTogether = async function () { await H.sheet('myslots'); await H.setIn('addSlotMin', 1); await H.setIn('addSlotCap', 2); await H.edit('#addSlotTogether', null, true); await H.click('[data-act="addSlot"]'); return H.ev("APP.me().slots.filter(function(s){return s.together;}).slice(-1)[0].id"); };
  // 1. 開一個勾了一起成交的時段；J1、J2 接受 J3 的村規
  var slotId = await openTogether();
  assert((await H.ev("document.querySelector('tr[data-id=\"" + slotId + "\"]').textContent")).indexOf('一起成交') >= 0 && (await H.ev("CORE.slotOf(APP.state(),'" + slotId + "').slot.together")) === true, '表世界開時段勾「一起成交」，我開的時段標出來');
  assert((await H.ev("document.querySelector('tr[data-id=\"" + slotId + "\"]').textContent")).indexOf('還沒有人選東西') >= 0, '還沒有人選東西時不寫「都選好了」');
  // 手機寬度、有一起成交的時段時：第一欄不變寬，開時段、一起成交的勾選框、＋ 整顆都按得到
  var fz = await H.ev("(function(){var td=document.querySelector('#smain td.fz');return {w:td.getBoundingClientRect().width,win:innerWidth};})()");
  assert(fz.w < fz.win * 0.72, '第一欄沒有因為一起成交變寬：' + Math.round(fz.w) + ' / ' + fz.win);
  var whole = async function (sel, what) { var r = await H.ev("(function(){var el=document.querySelector(" + JSON.stringify(sel) + ");el.scrollIntoView({block:'center',inline:'center'});var b=el.getBoundingClientRect();var main=el.closest('#smain'),fz=main.querySelector('td.fz, th.fz');var fw=fz?fz.getBoundingClientRect().right:main.getBoundingClientRect().left;if(b.left<fw+4){main.scrollLeft+=b.left-fw-12;b=el.getBoundingClientRect();}var pts=[[b.left+2,b.top+2],[b.right-2,b.top+2],[b.left+2,b.bottom-2],[b.right-2,b.bottom-2],[(b.left+b.right)/2,(b.top+b.bottom)/2]];return pts.every(function(p){var h=document.elementFromPoint(p[0],p[1]);return h&&(h===el||el.contains(h));});})()"); assert(r, what + ' 整顆都按得到'); };
  await whole('[data-act="addSlot"]', '「開時段」'); await whole('#addSlotTogether', '一起成交的勾選框'); await whole('#smain tr.addrow td.rn', '「＋」');
  await H.sheet('switches', J3 + ':'); await H.click('[data-act="accept"][data-id="' + J3 + '"]');
  // J2：接受村規、預約（預約前看得到標示）、選 J1 的早餐、勾到場
  await becomeMe(J2); await H.sheet('switches', J3 + ':'); await H.click('[data-act="accept"][data-id="' + J3 + '"]');
  await H.sheet('open'); assert((await H.ev("document.querySelector('tr[data-id=\"" + slotId + "\"]').textContent")).indexOf('一起成交') >= 0, '可預約時段標「一起成交」');
  await H.click('[data-act="book"][data-id="' + slotId + '"]'); await H.click('[data-act="wantAdd"][data-res="r1b"]'); await H.edit('input[data-ed="present"]', null, true);
  var m = await H.main(); assert(m.indexOf('一起成交：還差 我 選 阿澄 的東西') >= 0, '我預約的：那一微秒之前列出還差誰選誰的東西');
  // J3：預約、選 J1 的陪跑和 J2 的諮詢、勾到場
  await becomeMe(J3); await H.sheet('open'); await H.click('[data-act="book"][data-id="' + slotId + '"]');
  await H.click('[data-act="wantAdd"][data-res="r1a"]'); await H.click('[data-act="wantAdd"][data-res="r2b"]'); await H.edit('input[data-ed="present"]', null, true);
  // J2 回來選 J3 的借書；J1 在我開的時段選兩個人的
  await becomeMe(J2); await H.sheet('booked'); await H.click('[data-act="wantAdd"][data-res="r3a"]');
  await becomeMe(J1); await H.sheet('myslots');
  m = await H.main(); assert(m.indexOf('還差 我 選 阿澄 的東西') >= 0 && m.indexOf('還差 我 選 小樂 的東西') >= 0, '我開的時段也列出還差誰');
  await H.click('tr[data-id="' + slotId + '"] [data-act="wantAdd"][data-res="r2a"]'); await H.click('tr[data-id="' + slotId + '"] [data-act="wantAdd"][data-res="r3a"]');
  assert((await H.main()).indexOf('都選好了') >= 0, '三對都兩邊選了：寫「都選好了」');
  await shorten(H, slotId); await pg.waitForFunction("CORE.slotOf(APP.state(),'" + slotId + "').slot.judged", null, { timeout: 20000 }); await pg.waitForTimeout(400);
  assert((await H.ev("APP.state().dockings.length")) === 3 && (await H.ev("APP.state().dockings.every(function(d){return d.traded&&d.together;})")) && (await H.ev("APP.state().holds.length")) === 6, '三個人湊一圈，那一微秒全部成交：三對、六筆保留');
  await H.sheet('points'); assert((await H.rows()) === 2, '點數表兩筆');
  // 2. 再開一個：J2 故意不選 J3 的 → 整個時段不成交
  var slot2 = await openTogether();
  await becomeMe(J2); await H.sheet('open'); await H.click('[data-act="book"][data-id="' + slot2 + '"]'); await H.click('[data-act="wantAdd"][data-res="r1b"]'); await H.edit('input[data-ed="present"][data-id="' + slot2 + '"]', null, true);
  await becomeMe(J3); await H.sheet('open'); await H.click('[data-act="book"][data-id="' + slot2 + '"]'); await H.click('[data-act="wantAdd"][data-res="r1b"]'); await H.click('[data-act="wantAdd"][data-res="r2b"]'); await H.edit('input[data-ed="present"][data-id="' + slot2 + '"]', null, true);
  await becomeMe(J1); await H.sheet('myslots'); await H.click('tr[data-id="' + slot2 + '"] [data-act="wantAdd"][data-res="r2a"]'); await H.click('tr[data-id="' + slot2 + '"] [data-act="wantAdd"][data-res="r3a"]');
  m = await H.main(); assert(m.indexOf('還差 阿澄 選 小樂 的東西') >= 0 && m.indexOf('還差 我 選') < 0, '只差阿澄選小樂的');
  var before = await H.ev("JSON.stringify([APP.state().holds.length, APP.state().roles.map(function(r){return r.stock;}), APP.state().roles.map(function(r){return CORE.remainingToday(APP.state(),r,APP.now());})])");
  await shorten(H, slot2); await pg.waitForFunction("CORE.slotOf(APP.state(),'" + slot2 + "').slot.judged", null, { timeout: 20000 }); await pg.waitForTimeout(400);
  var ds = await H.ev("JSON.stringify(APP.state().dockings.filter(function(d){return d.slot==='" + slot2 + "';}).map(function(d){return [d.traded,d.reason];}))"); ds = JSON.parse(ds);
  assert(ds.length === 3 && ds.every(function (d) { return !d[0] && d[1] === '一起成交：阿澄 和 小樂 不成（阿澄 沒選 小樂 的東西），整個時段不成交'; }), '有一對沒選：整個時段不成交，三對都記是哪一對、為什麼：' + JSON.stringify(ds));
  assert((await H.ev("JSON.stringify([APP.state().holds.length, APP.state().roles.map(function(r){return r.stock;}), APP.state().roles.map(function(r){return CORE.remainingToday(APP.state(),r,APP.now());})])")) === before, '誰的點都沒給、貨都不動');
  assert((await pg.textContent('#smsg')).indexOf('整個時段不成交') >= 0, '表世界的訊息也寫這一句：' + (await pg.textContent('#smsg')));
  await H.sheet('points'); assert((await H.rows()) === 2, '「點數」沒多東西');
  // 3. 表世界刪沒人預約的時段
  await H.sheet('myslots'); await H.setIn('addSlotMin', 5); await H.click('[data-act="addSlot"]'); var n = await H.ev("APP.me().slots.length");
  await H.click('tr.mine [data-act="delSlot"], [data-act="delSlot"]'); assert((await H.ev("APP.me().slots.length")) === n - 1, '表世界刪掉沒人預約的時段');

  /* ===== 裡世界 ===== */
  await H.fresh();
  // 4. 在終點台開一個勾了一起成交的時段、我開的時段看得到標示、刪得掉
  await H.goNear('goal'); await H.pick('開時段'); await H.setIn('gSlotMin', 5); await H.edit('#gSlotTogether', null, true); await H.pick('開');
  assert((await H.ev("APP.me().slots.filter(function(s){return s.together;}).length")) === 2 - 1, '裡世界開時段勾「一起成交」');
  await H.goNear('goal'); await H.pick('看預約、選我要的'); assert((await H.dlgBody()).indexOf('【一起成交】') >= 0 && (await H.dlgBody()).indexOf('還沒有人選東西') >= 0, '我開的時段標【一起成交】、還沒有人選東西');
  var ns = await H.ev("APP.me().slots.length");
  await H.finger("function(){ return [...document.querySelectorAll('#dlgOpts button')].filter(function (b) { return b.textContent.indexOf('刪 ') === 0; }).slice(-1)[0]; }", '刪時段');
  assert((await H.ev("APP.me().slots.length")) === ns - 1 && (await H.ev("APP.me().slots.filter(function(s){return s.together;}).length")) === 0, '裡世界刪掉沒人預約的時段');
  await H.ev("GAME.dialog(null)");
  // 5. 阿澄開一起成交的時段：時刻表標示；兩個人的一起成交成交一次
  await H.ev("(function(){var S=APP.state(),t=APP.now();CORE.addSlot(S,'" + J2 + "',t+24e6,1,null,t,true);APP.changed();})()");
  await H.ev("GAME.teleportTo(CORE.roleOf(APP.state(),'" + J2 + "'))"); await H.goNear('goal');
  assert((await H.dlgBody()).indexOf('【一起成交】') >= 0, '終點台看得到時段標【一起成交】');
  await H.pick('時刻表'); var o = await H.opts(); assert(o[0].indexOf('一起成交') > 0, '時刻表標「一起成交」：' + o[0]); await H.pick(o[0].slice(0, 8));
  await H.click('[data-want-add="r2a"]'); await H.ev("(function(){var S=APP.state(),s=S.roles[1].slots.find(function(x){return x.together&&!x.judged;});CORE.setWants(S,s.id,'" + J2 + "','" + J1 + "',['r1b']);APP.changed();})()"); await H.pick('存好');
  await pg.waitForFunction("document.getElementById('dlgTitle').textContent.indexOf('交換') === 0", null, { timeout: 12000 });
  assert((await H.dlgTitle()).indexOf('【一起成交】') > 0 && (await H.dlgBody()).indexOf('都選好了') >= 0, '交換對話框標一起成交、都選好了');
  await H.pick('確定');
  await pg.waitForFunction("document.getElementById('dlgTitle').textContent === '到達那微秒'", null, { timeout: 30000 });
  assert((await H.dlgBody()).indexOf('我拿出：早餐一頓（100 點）；拿到：阿澄的改履歷（100 點）') >= 0 && (await H.ev("APP.state().holds.length")) === 2, '兩個人的一起成交時段成交'); await H.pick('好');
  // 6. 再一個：阿澄不選 → 交換對話框寫還差誰，結果不成交，帳房沒多東西
  await H.ev("(function(){var S=APP.state(),t=APP.now();CORE.addSlot(S,'" + J2 + "',t+24e6,1,null,t,true);APP.changed();})()");
  await H.goNear('goal'); await H.pick('時刻表'); o = await H.opts(); await H.pick(o[0].slice(0, 8)); await H.click('[data-want-add="r2a"]'); await H.pick('存好');
  await pg.waitForFunction("document.getElementById('dlgTitle').textContent.indexOf('交換') === 0", null, { timeout: 12000 });
  assert((await H.dlgBody()).indexOf('一起成交：還差 阿澄 選 我 的東西') >= 0, '交換對話框寫還差誰'); await H.pick('確定');
  await pg.waitForFunction("document.getElementById('dlgTitle').textContent === '到達那微秒'", null, { timeout: 30000 });
  assert((await H.dlgBody()).indexOf('不成交：一起成交：阿澄 和 我 不成（阿澄 沒選 我 的東西），整個時段不成交') >= 0, '結果對話框寫是哪一對、為什麼：' + (await H.dlgBody())); await H.pick('好');
  assert((await H.ev("APP.state().holds.length")) === 2, '沒有新的保留');
  await pg.click('#btnHome'); await pg.waitForTimeout(300); await H.goNear('points');
  var b = await H.dlgBody(); assert(b.split('・').length === 2 && b.indexOf('改履歷') >= 0 && b.indexOf('保留到 ') >= 0, '帳房沒多東西：' + b);
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
