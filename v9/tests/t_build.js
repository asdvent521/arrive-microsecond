// 自己蓋（DESIGN 7-2「自己蓋」）：用手指加一塊（地上、方塊的面上）、拆一塊、轉擺設、復原；蓋到地皮外、日曆、日曆正面那一條、門前擋下；日曆拆不掉；
// 換範本先問、可以復原；換人看得到；重新整理還在。「我的達秒屋」那頁：地皮大小、蓋了幾塊、去我的達秒屋蓋。
// node v9/tests/t_build.js <test9.html> [截圖資料夾]
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J3 = '00000000003';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg, shots = process.argv[3];
  var blocks = function () { return H.ev("JSON.stringify(CORE.houseOf(APP.roleOf('" + J1 + "')).blocks)").then(JSON.parse); };
  var has = function (list, b) { return list.some(function (x) { return x.join() === b.join(); }); };
  var count = function () { return H.ev("CORE.houseOf(APP.roleOf('" + J1 + "')).blocks.filter(function(b){return b[3]!=='door';}).length"); };
  var becomeMe = async function (serial) { await H.ev("APP.goTable(null,'role')"); await H.nav('role'); var i = await H.ev("APP.state().roles.findIndex(function(r){return r.serial==='" + serial + "';})"); await H.edit('#tmain select[data-ed="me"]', i); assert((await H.ev("APP.me().serial")) === serial, '換人成 ' + serial); };
  await H.fresh();
  // 1. 「我的達秒屋」那頁：門牌、整間屋給誰看、新的一筆預設、地皮、蓋了幾塊；沒有屋型、顏色、樣式、擺設
  await H.nav('house');
  var main = await H.main(), n0 = await count();
  assert(main.indexOf('12×12、高 12') >= 0 && main.indexOf(n0 + ' 塊') >= 0 && main.indexOf('門牌一句話') >= 0 && main.indexOf('整間屋給誰看') >= 0 && main.indexOf('新的一筆預設') >= 0, '我的達秒屋：地皮 12×12、高 12，已經蓋了 ' + n0 + ' 塊，門牌、給誰看、新的一筆預設都在');
  assert(['屋型', '牆的顏色', '屋頂的樣式', '擺設'].every(function (w) { return main.indexOf(w) < 0; }) && n0 > 50, '拿掉了屋型、顏色、樣式、擺設那幾列；新角色先有一間預設小屋');
  await H.clickText('去我的達秒屋蓋', '#tmain'); await pg.waitForTimeout(500);
  assert((await H.ev("WORLD.info().building")) && (await pg.isVisible('#hbuild')) && (await H.ev("WORLD.info().phi")) < 1, '按「去我的達秒屋蓋」：到自己的達秒屋，開始蓋，鏡頭從高一點往下看');
  if (shots) await pg.screenshot({ path: shots + '/v9_build_1.png' });
  // 2. 選天藍，點地上一格：加一塊；點它的頂面：上面再加一塊
  await H.hclick('#hblk [data-blk="sky"]');
  await H.tap3d({ ground: [3, 3] }, '地上 (3,3)');
  var b = await blocks();
  assert(has(b, [3, 0, 3, 'sky']) && b.length === n0 + 2 && (await H.ev("WORLD.info().blocks")) === n0 + 1, '點地上一格：加了一塊天藍');
  await H.tap3d({ block: [3, 0, 3], n: [0, 1, 0] }, '天藍那塊的頂面');
  b = await blocks(); assert(has(b, [3, 1, 3, 'sky']) && b.length === n0 + 3, '點方塊的頂面：上面再加一塊');
  await H.hclick('#hblk [data-blk="glass"]');
  await H.tap3d({ block: [3, 1, 3], n: [1, 0, 0] }, '上面那塊的右面');
  b = await blocks(); assert(has(b, [4, 1, 3, 'glass']), '點方塊的側面：旁邊加一塊玻璃（浮著也可以）');
  // 3. 復原上一步
  await H.hclick('#hUndo'); b = await blocks();
  assert(!has(b, [4, 1, 3, 'glass']) && b.length === n0 + 3, '復原上一步：玻璃拿掉了');
  // 4. 拆：點一塊就拿掉；復原又回來
  await H.hclick('#hModeDel');
  await H.tap3d({ block: [3, 1, 3], n: [0, 1, 0] }, '要拆的那塊');
  b = await blocks(); assert(!has(b, [3, 1, 3, 'sky']) && b.length === n0 + 2, '拆：點一塊就拿掉');
  await H.hclick('#hUndo'); b = await blocks(); assert(has(b, [3, 1, 3, 'sky']), '復原：拆掉的那塊回來了');
  // 5. 擺設：放一棵樹、點一下轉 90 度、復原
  await H.hclick('#hblk [data-blk="tree"]');
  assert((await H.ev("HOUSE.st.mode")) === 'add', '選方塊就回到「蓋」');
  await H.tap3d({ ground: [-4, 3] }, '地上 (-4,3)');
  b = await blocks(); assert(has(b, [-4, 0, 3, 'tree', 0]) && (await H.ev("WORLD.info().props")) >= 2, '放了一棵樹（擺設也是方塊）');
  await H.tap3d({ block: [-4, 0, 3], prop: true }, '那棵樹');
  b = await blocks(); assert(has(b, [-4, 0, 3, 'tree', 90]), '點擺設：轉 90 度');
  await H.hclick('#hUndo'); b = await blocks(); assert(has(b, [-4, 0, 3, 'tree', 0]), '復原：轉回來');
  // 6. 擋下：地皮外面、大門
  var before = await count();
  await H.tap3d({ ground: [7, 0] }, '地皮外面');
  assert((await H.popTitle()) === '放不上去' && (await H.popBody()).indexOf('地皮外面不能蓋') >= 0 && (await count()) === before, '蓋到地皮外面：擋下、跳提示');
  await H.popOk();
  await H.tap3d({ cal: [-2, 0] }, '第一塊日曆（正面）');
  assert((await H.popTitle()) === '放不上去' && /留給日曆|正面前面要空著/.test(await H.popBody()) && (await count()) === before, '點日曆的正面想加一塊：正面那一條要空著、擋下');
  await H.popOk();
  await H.tap3d({ cal: [-2, 0], n: [1, 0, 0] }, '第一塊日曆的右側面'); await pg.waitForTimeout(100);
  if ((await H.popOpen()) && (await H.popTitle()) === '放不上去') { assert((await H.popBody()).indexOf('這一格是門') >= 0 || (await H.popBody()).indexOf('門前面') >= 0 || (await H.popBody()).indexOf('日曆') >= 0, '點日曆旁邊（門那一格）：擋下'); await H.popOk(); }
  await H.tap3d({ ground: [0, 1] }, '門前那一格');
  assert((await H.popTitle()) === '放不上去' && (await H.popBody()).indexOf('門前面要空著') >= 0 && (await count()) === before, '蓋到門前面：擋下、跳提示');
  await H.popOk();
  await H.tap3d({ ground: [-2, 4] }, '日曆正面前面的地上');
  assert((await H.popTitle()) === '放不上去' && (await H.popBody()).indexOf('日曆正面前面要空著') >= 0 && (await count()) === before, '蓋到日曆正面那一條：擋下、跳提示');
  await H.popOk();
  await H.hclick('#hModeDel'); await H.tap3d({ cal: [-2, 0] }, '第一塊日曆');
  assert((await H.popTitle()) === '拆不掉' && (await H.popBody()).indexOf('日曆拆不掉') >= 0 && (await count()) === before, '在「拆」點日曆：日曆拆不掉');
  await H.popOk(); await H.hclick('#hModeAdd');
  // 7. 範本：先問一次；換掉；復原換回來
  var mine = await blocks();
  await H.hclick('#hTpl'); assert((await H.popTitle()) === '範本', '按「範本」：塔、長屋、平房、圓屋');
  await H.popOk('塔');
  assert((await H.popTitle()).indexOf('換成「塔」') === 0 && (await H.popBody()).indexOf((mine.length - 1) + ' 塊會被換掉') >= 0, '換範本先問一次：現在蓋的會被換掉');
  await H.popOk('不要'); assert(JSON.stringify(await blocks()) === JSON.stringify(mine), '選「不要」：什麼都沒變');
  await H.hclick('#hTpl'); await H.popOk('塔'); await H.popOk('換掉'); await pg.waitForTimeout(300);
  var tw = await H.ev("JSON.stringify({n:CORE.houseOf(APP.me()).blocks.length,t:CORE.template('tower').length,d:CORE.houseOf(APP.me()).blocks.filter(function(b){return b[3]==='door';}).length,stone:CORE.houseOf(APP.me()).blocks.filter(function(b){return b[3]==='stone';}).length})").then(JSON.parse);
  assert(tw.n >= tw.t - 10 && tw.n <= tw.t && tw.d === 1 && tw.stone > 50, '換掉：蓋出塔（帶門；碰到日曆的幾塊空著）');
  if (shots) await pg.screenshot({ path: shots + '/v9_build_2_tower.png' });
  var same = function (a, b) { return JSON.stringify(a.map(String).sort()) === JSON.stringify(b.map(String).sort()); };
  await H.hclick('#hUndo'); assert(same(await blocks(), mine), '復原上一步：換回原本蓋的');
  // 8. 蓋好了；換人看得到
  await H.hclick('#hBuild'); await pg.waitForTimeout(300);
  assert(!(await H.ev("WORLD.info().building")) && (await pg.isHidden('#hbuild')), '按「蓋好了」：回到平常的看法');
  await becomeMe(J3); await H.ev("APP.goHouse('" + J1 + "')"); await pg.waitForTimeout(500);
  assert((await H.ev("WORLD.info().blocks")) === mine.length - 1 && (await H.ev("CORE.viewHouse(APP.state(),'" + J1 + "','" + J3 + "').look.blocks.some(function(b){return b.join()==='3,1,3,sky';})")) && (await pg.isHidden('#hBuild')), '換人（小樂）看 J1：看得到蓋的方塊；別人的屋沒有「蓋」');
  // 9. 直放：方塊清單自己一排（露出至少 5 格）、按鈕字不換行
  await becomeMe(J1); await H.ev("APP.goHouse(APP.me().serial, true)"); await pg.setViewportSize({ width: 360, height: 780 }); await pg.waitForTimeout(400); await H.ev("HOUSE.render()"); await pg.waitForTimeout(200);
  var lay = await H.ev("(function(){var blk=document.getElementById('hblk').getBoundingClientRect(),ops=document.querySelector('#hbuild .hops').getBoundingClientRect();var seen=[...document.querySelectorAll('#hblk button')].filter(function(b){var r=b.getBoundingClientRect();return r.left>=blk.left-1&&r.right<=blk.right+1;}).length;var wrap=[...document.querySelectorAll('#hbuild .btn, .hrow .btn')].filter(function(b){return b.offsetParent&&b.getBoundingClientRect().height>44;}).length;return {seen:seen,ownRow:blk.bottom<=ops.top+1||ops.bottom<=blk.top+1,wrap:wrap,blkW:blk.width};})()");
  assert(lay.seen >= 5 && lay.ownRow && lay.wrap === 0, '直放：方塊清單自己一排、露出 ' + lay.seen + ' 格，按鈕字不換行');
  if (shots) await pg.screenshot({ path: shots + '/v9_build_3_portrait.png' });
  await pg.setViewportSize({ width: 780, height: 360 }); await pg.waitForTimeout(200); await H.hclick('#hBuild'); await becomeMe(J3);
  // 10. 重新整理還在
  await H.ev("APP.saveNow()"); await pg.reload(); await pg.waitForTimeout(600);
  assert(same(await blocks(), mine), '重新整理：蓋的都還在');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
