// 日曆長在房子上（DESIGN 7-2「往哪邊長」「門」）：用手指在「蓋」裡改方向，預告框跟著動、「會拆 N 塊」對；選長不了的方向，旁邊寫這次會往哪；
// 日曆往上不受地皮高度限制（60 歲的高日曆、讀檔補 60 年、鏡頭停在這個月那塊、方塊放不到地皮高度以上）；把時間撥到下個月，日曆長一塊、擋到的方塊不見、跳一次「拆了 N 塊」；搬門、轉門、門前放不上去；換人看得到、重新整理還在；「我的達秒屋」那頁有日曆幾塊、往哪長。
// node v9/tests/t_calendar.js <test9.html> [截圖資料夾]
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J3 = '00000000003';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg, shots = process.argv[3];
  var cal = function () { return H.ev("JSON.stringify(CORE.houseOf(APP.roleOf('" + J1 + "')).cal)").then(JSON.parse); };
  var preview = function () { return H.ev("JSON.stringify(HOUSE.data().cal.preview)").then(JSON.parse); };
  var door = function () { return H.ev("JSON.stringify(CORE.doorOf(CORE.houseOf(APP.roleOf('" + J1 + "'))))").then(JSON.parse); };
  var count = function () { return H.ev("CORE.viewHouse(APP.state(),'" + J1 + "','" + J1 + "').look.n"); };
  var becomeMe = H.becomeMe;
  await H.fresh();
  // 1. 「我的達秒屋」：日曆幾塊、下一塊往哪長
  await H.nav('house'); var main = await H.main();
  assert(main.indexOf('日曆') >= 0 && /1\s*塊，下一塊往上長/.test(main.replace(/\s+/g, ' ')), '我的達秒屋：日曆 1 塊，下一塊往上長');
  await H.clickText('去我的達秒屋蓋', '#tmain'); await pg.waitForTimeout(500);
  var c0 = await cal(); assert(c0.dir === 'up' && JSON.stringify(c0.blocks) === '[[-2,0]]', '新角色：第一塊在起點 [-2,0]，預設往上');
  var pv = await preview(); assert(pv && JSON.stringify(pv.pos) === '[-2,2]' && pv.removes === 6 && (await pg.textContent('#hDirNote')).indexOf('會拆 6 塊') >= 0, '預告框：下一塊在 [-2,2]，會拆 6 塊（牆和屋頂）');
  assert((await H.ev("JSON.stringify(WORLD.screenOf({preview:true}))")) !== 'null' && (await H.ev("WORLD.info().meshes")) > 0, '預告框畫在畫面上');
  assert((await H.ev("WORLD.info().previewThrough")) === true, '預告框在房子裡面、被方塊擋住時也看得到（不吃深度）');
  if (shots) await pg.screenshot({ path: shots + '/v9_cal_1_preview.png' });
  // 2. 改方向：往右長不了（門和門前擋著），旁邊寫這次會往上；往左會拆 3 塊；預告框跟著動
  await H.hclick('#hDirs [data-dir="right"]'); await pg.waitForTimeout(200);
  pv = await preview(); var note = await pg.textContent('#hDirNote');
  assert((await cal()).dir === 'right' && JSON.stringify(pv.pos) === '[-2,2]' && pv.dir === 'up' && note.indexOf('這個方向長不了，這次會往上') >= 0, '選「右」：門擋著長不了，旁邊寫「這次會往上」（' + note + '）');
  await H.hclick('#hDirs [data-dir="left"]'); await pg.waitForTimeout(200);
  pv = await preview(); note = await pg.textContent('#hDirNote');
  assert((await cal()).dir === 'left' && JSON.stringify(pv.pos) === '[-4,0]' && pv.dir === 'left' && pv.removes === 3 && note.indexOf('會拆 3 塊') >= 0, '選「左」：預告框移到 [-4,0]，會拆 3 塊（牆兩塊、前面的花）');
  var sp = await H.ev("JSON.stringify(WORLD.screenOf({preview:true}))"); assert(sp !== 'null', '預告框跟著動');
  await H.hclick('#hUndo'); assert((await cal()).dir === 'right', '改方向也算一步：復原回「右」');
  await H.hclick('#hDirs [data-dir="up"]'); pv = await preview(); assert((await cal()).dir === 'up' && JSON.stringify(pv.pos) === '[-2,2]' && pv.removes === 6, '選回「上」');
  // 3. 時間撥到下個月：日曆長一塊、擋到的方塊不見、跳一次「拆了 6 塊」
  var n0 = await count();
  // 時間撥到下個月：等於角色早一個月創（生日改成上個月最後一天），換日那一格補長
  await H.ev("(function(){var r=APP.me();r.born=CORE.monthFirstDay(CORE.bornOf(r),0)-1;CORE.growCalendars(APP.state(),APP.now());APP.changed();})()"); await pg.waitForTimeout(400);
  var c1 = await cal(); assert(JSON.stringify(c1.blocks) === '[[-2,0],[-2,2]]' && (await H.ev("WORLD.info().cal")) === 2, '到了下個月：日曆長了一塊到 [-2,2]');
  assert((await count()) === n0 - 6 && (await H.ev("CORE.houseOf(APP.me()).blocks.some(function(b){return b[0]===-2&&b[1]===2&&b[2]===0;})")) === false, '擋到的 6 塊不見了');
  assert((await H.popOpen()) && (await H.popTitle()) === '日曆長到這裡，拆了 6 塊', '跳一次「日曆長到這裡，拆了 6 塊」'); await H.popOk();
  await H.ev("HOUSE.render()"); await pg.waitForTimeout(200); assert(!(await H.popOpen()), '只跳一次');
  if (shots) await pg.screenshot({ path: shots + '/v9_cal_2_grown.png' });
  // 4. 門：選門點一個地方搬過去；點門轉 90 度；門前放不上去；復原
  var d0 = await door(); assert(JSON.stringify(d0) === '[0,0,0,"door",0]', '新角色的門在 (0,0,0) 朝前');
  await H.hclick('#hblk [data-blk="door"]'); assert((await pg.textContent('#hhint')).indexOf('門就搬過去') >= 0, '選了門：提示點一個地方門就搬過去');
  await H.tap3d({ ground: [3, 3] }, '地上 (3,3)');
  assert(JSON.stringify(await door()) === '[3,0,3,"door",0]' && (await H.ev("CORE.houseOf(APP.me()).blocks.filter(function(b){return b[3]==='door';}).length")) === 1, '門搬到 (3,0,3)，還是只有一扇');
  await H.tap3d('door', '門'); assert(JSON.stringify(await door()) === '[3,0,3,"door",90]', '點門：轉 90 度（朝右）');
  await H.hclick('#hblk [data-blk="sky"]'); await H.tap3d({ ground: [4, 3] }, '門前那一格');
  assert((await H.popTitle()) === '放不上去' && (await H.popBody()).indexOf('門前面要空著') >= 0, '門前那一格放不上去'); await H.popOk();
  await H.hclick('#hblk [data-blk="door"]'); await H.tap3d({ ground: [-2, 4] }, '日曆正面前面');
  assert((await H.popTitle()) === '放不上去' && (await H.popBody()).indexOf('日曆正面前面') >= 0, '門不能放在日曆正面前面'); await H.popOk();
  await H.hclick('#hModeDel'); await H.tap3d('door', '門');
  assert((await H.popTitle()) === '拆不掉' && (await H.popBody()).indexOf('門拆不掉') >= 0 && JSON.stringify(await door()) === '[3,0,3,"door",90]', '在「拆」點門：門拆不掉'); await H.popOk(); await H.hclick('#hModeAdd');
  await H.hclick('#hUndo'); assert(JSON.stringify(await door()) === '[3,0,3,"door",0]', '復原：轉回來');
  await H.hclick('#hUndo'); assert(JSON.stringify(await door()) === '[0,0,0,"door",0]', '再復原：門搬回原處');
  await H.hclick('#hblk [data-blk="door"]'); await H.tap3d({ ground: [3, -5] }, '地上 (3,-5)'); assert(JSON.stringify(await door()) === '[3,0,-5,"door",0]', '門搬到後面');
  if (shots) await pg.screenshot({ path: shots + '/v9_cal_3_door.png' });
  await H.hclick('#hBuild');
  // 5. 換人看得到；重新整理還在
  await becomeMe(J3); await H.ev("APP.goHouse('" + J1 + "')"); await pg.waitForTimeout(500);
  var seen = await H.ev("JSON.stringify({cal:HOUSE.data().cal.blocks,door:HOUSE.data().look.door,n:WORLD.info().cal,pv:!!HOUSE.data().cal.preview,removes:HOUSE.data().cal.preview&&HOUSE.data().cal.preview.removes})").then(JSON.parse);
  assert(JSON.stringify(seen.cal) === '[[-2,0],[-2,2]]' && JSON.stringify(seen.door) === '[3,0,-5,"door",0]' && seen.n === 2 && seen.pv && seen.removes === 0, '換人（小樂）看 J1：兩塊日曆、門在新位置、預告框有、看不到會拆幾塊');
  await H.ev("APP.saveNow()"); await pg.reload(); await pg.waitForTimeout(600);
  var c2 = await cal(); assert(JSON.stringify(c2.blocks) === '[[-2,0],[-2,2]]' && c2.dir === 'up' && JSON.stringify(await door()) === '[3,0,-5,"door",0]', '重新整理：日曆、方向、門都還在 ' + JSON.stringify(c2) + ' ' + JSON.stringify(await door()));
  // 6. 日曆往上長（補十七）：J1 變成 60 歲、存檔裡日曆只剩第一塊（很久沒開）→ 重新整理，讀進來補 60 年不卡
  await H.ev("(function(){var S=APP.state(),r=APP.roleOf('" + J1 + "');r.born-=365*60+15;r.versions.forEach(function(v){v.fromDay-=365*60+15;});CORE.houseOf(r).cal.blocks=[[-2,0]];APP.saveNow();})()");
  var tl = Date.now(); await pg.reload(); await pg.waitForTimeout(300); var loadMs = Date.now() - tl;
  var tall = await H.ev("(function(){var r=APP.roleOf('" + J1 + "'),h=CORE.houseOf(r),p=CORE.plotAt(r,APP.now()),want=CORE.monthIndex(CORE.bornOf(r),CORE.dayNum(APP.now()))+1,seen={},dup=false;h.cal.blocks.forEach(function(q){if(!q)return;CORE.calCells(q).forEach(function(c){var k=c.join();if(seen[k])dup=true;seen[k]=true;});});return {n:h.cal.blocks.length,want:want,all:h.cal.blocks.every(Boolean),dup:dup,top:Math.max.apply(null,h.cal.blocks.map(function(q){return q[1]+2;})),height:p.height,size:p.size};})()");
  assert(tall.n === tall.want && tall.all && !tall.dup && tall.top > tall.height * 10 && loadMs < 4000, '60 歲：讀進來補到 ' + tall.n + ' 塊（每個月一塊、沒有空位、不重疊），往上長到高 ' + tall.top + '（地皮高 ' + tall.height + '），重新整理 ' + loadMs + ' ms');
  await becomeMe(J1); await H.nav('house'); await H.clickText('去我的達秒屋', '#tmain'); await pg.waitForTimeout(700);
  if (await H.popOpen()) await H.popOk();   // 日曆長到這裡拆了幾塊
  await H.ev("WORLD.renderNow()");
  var ti = await H.ev("(function(){var i=WORLD.info(),list=CORE.houseOf(APP.me()).cal.blocks,last=list[list.length-1],s=WORLD.screenOf({cal:last}),c=document.querySelector('#hstage canvas').getBoundingClientRect();return {cal:i.cal,bricks:i.bricks,calls:i.calls,dist:i.dist,dx:s?Math.abs(s.x-c.width/2)/c.width:9,seen:!!s&&document.elementFromPoint(s.x,s.y).tagName==='CANVAS'};})()");
  assert(ti.cal === tall.n && ti.calls <= 50 && ti.dx < 0.2 && ti.seen && ti.dist < 20, '看屋：' + ti.cal + ' 塊日曆、' + ti.bricks + ' 塊磚，繪製 ' + ti.calls + ' 次；鏡頭停在這個月那塊附近（距離 ' + ti.dist.toFixed(1) + '），不是整面縮很小');
  if (shots) await pg.screenshot({ path: shots + '/v9_cal_4_tall.png' });
  // 日曆貼圖大小（第 8 輪）：任何歲數都不超過 2048×2048；這間 60 歲的實際貼圖也是
  var sizes = await H.ev("[129,300,512,720,1200].map(function(n){var z=WORLD.atlasSize(n);return [n,z.w,z.h,z.tile];})");
  assert(sizes.every(function (z) { return z[1] <= 2048 && z[2] <= 2048 && z[3] >= 32; }), '日曆貼圖：' + sizes.map(function (z) { return z[0] + ' 塊 ' + z[1] + '×' + z[2] + '（每格 ' + z[3] + '）'; }).join('、') + '，都不超過 2048');
  var real = await H.ev("(function(){var m=null;WORLD.scene&&0;return WORLD.texSize?WORLD.texSize():null;})()");
  assert(real && real.w <= 2048 && real.h <= 2048, '60 歲這間實際的貼圖 ' + (real ? real.w + '×' + real.h : '?'));
  await pg.mouse.move(390, 200); await pg.mouse.wheel(0, 900); await pg.waitForTimeout(200); await H.hclick('#hLook'); await pg.waitForTimeout(900);
  var back = await H.ev("(function(){var list=CORE.houseOf(APP.me()).cal.blocks,s=WORLD.screenOf({cal:list[list.length-1]}),c=document.querySelector('#hstage canvas').getBoundingClientRect();return s&&Math.abs(s.x-c.width/2)/c.width<0.2&&WORLD.info().dist<20;})()");
  assert(back, '拉遠以後按「看日曆」：回到這個月那塊');
  // 自己蓋的方塊放不到地皮高度以上：在最上面那層放一塊，再點它的頂面加一塊 → 擋下
  await H.hclick('#hBuild'); await pg.waitForTimeout(400);
  var top = await H.ev("(function(){var p=CORE.plotAt(APP.me(),APP.now());CORE.addBlock(APP.state(),APP.me().serial,[8,p.height-1,8,'stone'],APP.now());APP.changed();HOUSE.render();WORLD.setCamera({target:[8.5,p.height-1,8.5],theta:0.5,phi:0.6,dist:8});WORLD.renderNow();return p.height;})()");
  var nBefore = await count(); await H.hclick('#hblk [data-blk="brick"]'); await H.tap3d({ block: [8, top - 1, 8], n: [0, 1, 0] }, '最上面那塊的頂面');
  assert((await H.popOpen()) && (await count()) === nBefore && (await H.popBody()).indexOf('高') >= 0, '地皮高度以上放不上去：' + (await H.popBody())); await H.popOk();
  await H.hclick('#hBuild');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
