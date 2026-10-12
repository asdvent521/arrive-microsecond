// 自己蓋（DESIGN 7-2「自己蓋」）：用手指加一塊（地上、方塊的面上）、拆一塊、轉擺設、復原；蓋到地皮外或大門上擋下；
// 換範本先問、可以復原；換人看得到；重新整理還在。「我的達秒屋」那頁：地皮大小、蓋了幾塊、去我的達秒屋蓋。
// node v9/tests/t_build.js <test9.html> [截圖資料夾]
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J3 = '00000000003';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg, shots = process.argv[3];
  var blocks = function () { return H.ev("JSON.stringify(CORE.houseOf(APP.roleOf('" + J1 + "')).blocks)").then(JSON.parse); };
  var has = function (list, b) { return list.some(function (x) { return x.join() === b.join(); }); };
  var count = function () { return H.ev("CORE.houseOf(APP.roleOf('" + J1 + "')).blocks.length"); };
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
  assert(has(b, [3, 0, 3, 'sky']) && b.length === n0 + 1 && (await H.ev("WORLD.info().blocks")) === n0 + 1, '點地上一格：加了一塊天藍');
  await H.tap3d({ block: [3, 0, 3], n: [0, 1, 0] }, '天藍那塊的頂面');
  b = await blocks(); assert(has(b, [3, 1, 3, 'sky']) && b.length === n0 + 2, '點方塊的頂面：上面再加一塊');
  await H.hclick('#hblk [data-blk="glass"]');
  await H.tap3d({ block: [3, 1, 3], n: [1, 0, 0] }, '上面那塊的右面');
  b = await blocks(); assert(has(b, [4, 1, 3, 'glass']), '點方塊的側面：旁邊加一塊玻璃（浮著也可以）');
  // 3. 復原上一步
  await H.hclick('#hUndo'); b = await blocks();
  assert(!has(b, [4, 1, 3, 'glass']) && b.length === n0 + 2, '復原上一步：玻璃拿掉了');
  // 4. 拆：點一塊就拿掉；復原又回來
  await H.hclick('#hModeDel');
  await H.tap3d({ block: [3, 1, 3], n: [0, 1, 0] }, '要拆的那塊');
  b = await blocks(); assert(!has(b, [3, 1, 3, 'sky']) && b.length === n0 + 1, '拆：點一塊就拿掉');
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
  await H.tap3d('gate', '大門');
  assert((await H.popTitle()) === '放不上去' && (await H.popBody()).indexOf('大門不能蓋') >= 0 && (await count()) === before, '蓋到大門上：擋下、跳提示');
  await H.popOk();
  // 7. 範本：先問一次；換掉；復原換回來
  var mine = await blocks();
  await H.hclick('#hTpl'); assert((await H.popTitle()) === '範本', '按「範本」：塔、長屋、平房、圓屋');
  await H.popOk('塔');
  assert((await H.popTitle()).indexOf('換成「塔」') === 0 && (await H.popBody()).indexOf(mine.length + ' 塊會被換掉') >= 0, '換範本先問一次：現在蓋的會被換掉');
  await H.popOk('不要'); assert(JSON.stringify(await blocks()) === JSON.stringify(mine), '選「不要」：什麼都沒變');
  await H.hclick('#hTpl'); await H.popOk('塔'); await H.popOk('換掉'); await pg.waitForTimeout(300);
  assert((await H.ev("JSON.stringify(CORE.houseOf(APP.me()).blocks)")) === (await H.ev("JSON.stringify(CORE.template('tower'))")), '換掉：蓋出塔');
  if (shots) await pg.screenshot({ path: shots + '/v9_build_2_tower.png' });
  await H.hclick('#hUndo'); assert(JSON.stringify(await blocks()) === JSON.stringify(mine), '復原上一步：換回原本蓋的');
  // 8. 蓋好了；換人看得到
  await H.hclick('#hBuild'); await pg.waitForTimeout(300);
  assert(!(await H.ev("WORLD.info().building")) && (await pg.isHidden('#hbuild')), '按「蓋好了」：回到平常的看法');
  await becomeMe(J3); await H.ev("APP.goHouse('" + J1 + "')"); await pg.waitForTimeout(500);
  assert((await H.ev("WORLD.info().blocks")) === mine.length && (await H.ev("CORE.viewHouse(APP.state(),'" + J1 + "','" + J3 + "').look.blocks.some(function(b){return b.join()==='3,1,3,sky';})")) && (await pg.isHidden('#hBuild')), '換人（小樂）看 J1：看得到蓋的方塊；別人的屋沒有「蓋」');
  // 9. 重新整理還在
  await H.ev("APP.saveNow()"); await pg.reload(); await pg.waitForTimeout(600);
  assert(JSON.stringify(await blocks()) === JSON.stringify(mine), '重新整理：蓋的都還在');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
