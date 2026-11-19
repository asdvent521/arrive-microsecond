// 還沒創角色時的首頁（2026-11-19）：按「返回首頁」是一塊空地（3D 有地皮和「空地」木牌、沒有房子／門／日曆），
// 上面一句話和「去建立角色」；蓋、看日曆、進門不顯示；按「去建立角色」到資源表那張紙創角色；建好以後首頁是自己的能量之家。
// 3D 用不了時也一樣有那句話和大鈕。
// node v9/tests/t_empty.js <test9.html> [截圖資料夾]
var lib = require('./lib'), assert = lib.assert, path = require('path'), fs = require('fs');
var OUT = process.argv[3] || path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
var HIDDEN = "['hBuild','hDoor','hLook'].every(function(id){var el=document.getElementById(id);return el.hidden||!el.offsetParent;})";
(async function () {
  for (var o of [{ name: '轉橫', width: 780, height: 360 }, { name: '直放', width: 390, height: 844 }]) {
    var H = await lib.open(process.argv[2], { touch: true, width: o.width, height: o.height }), pg = H.pg;
    await H.fresh({ raw: true });
    assert(await H.ev("APP.isBlank()"), o.name + '：真的第一次打開，還沒創角色');
    await H.click('#homeBtn'); await pg.waitForTimeout(800);
    assert(!(await H.ev("document.getElementById('view-house').hidden")), o.name + '：按「返回首頁」到能量之家');
    var w = await H.ev("WORLD.info()");
    assert(w.empty && w.cal === 0 && w.bricks === 0 && w.blocks === 0, o.name + '：3D 畫的是空地（沒有日曆、磚、方塊）');
    assert((await pg.textContent('#hwho')).indexOf('你的空地') >= 0, o.name + '：最上面寫「你的空地」');
    assert((await pg.textContent('#hEmpty')).indexOf('建立角色以後，房子和日曆就會蓋在這裡') >= 0, o.name + '：上面一句話說明');
    assert(await H.ev(HIDDEN), o.name + '：蓋、看日曆、進門不顯示');
    var p = await H.ev("(function(){var r=document.querySelector('#hstage canvas').getBoundingClientRect();var x=r.left+r.width*0.5,y=r.top+r.height*0.75;return {x:x,y:y,t:document.elementFromPoint(x,y).tagName};})()");
    assert(p.t === 'CANVAS', o.name + '：空地那裡是畫布');
    await pg.mouse.move(p.x, p.y); await pg.mouse.down(); await pg.mouse.move(p.x + 120, p.y + 10, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(200);
    assert(Math.abs((await H.ev("WORLD.info().theta")) - w.theta) > 0.2, o.name + '：空地可以拖著轉');
    await pg.mouse.click(p.x, p.y); await pg.waitForTimeout(200);
    await pg.screenshot({ path: OUT + '/v9_empty_' + (o.width > o.height ? 'landscape' : 'portrait') + '.png' });
    await H.hclick('#hCreate'); await pg.waitForTimeout(500);
    assert((await H.ev("document.getElementById('view-house').hidden")) && (await H.ev("!!document.getElementById('cName')")), o.name + '：按「去建立角色」到資源表那張紙，可以創角色');
    await H.ev("APP.createPlayer({name:'阿恆',bg:'木工',nature:false,dailyPoints:10,rules:{problem:'再約一次'},firstItem:{name:'空的',def:'',price:0,qty:1}}, true)"); await pg.waitForTimeout(300);
    await H.click('#homeBtn'); await pg.waitForTimeout(800);
    w = await H.ev("WORLD.info()");
    assert(!w.empty && w.cal >= 1 && (await pg.textContent('#hwho')).indexOf('阿恆 的能量之家') >= 0 && !(await H.ev("!!document.getElementById('hCreate')")), o.name + '：建好角色，首頁是自己的能量之家（日曆 ' + w.cal + ' 塊），沒有「去建立角色」');
    assert(!H.errs.length, o.name + '：沒有錯誤 ' + H.errs.join(' | '));
    await H.close();
  }
  // 3D 用不了
  var H2 = await lib.open(process.argv[2], { touch: true, noWebGL: true }), pg2 = H2.pg;
  await H2.fresh({ raw: true });
  await H2.click('#homeBtn'); await pg2.waitForTimeout(500);
  assert((await pg2.textContent('#hEmpty')).indexOf('這是你的空地') >= 0 && (await H2.ev("!!document.getElementById('hCreate')")) && (await H2.ev(HIDDEN)), '3D 用不了：一樣有那句話和「去建立角色」，蓋、看日曆、進門不顯示');
  await H2.hclick('#hCreate'); await pg2.waitForTimeout(400);
  assert(await H2.ev("!!document.getElementById('cName')"), '3D 用不了：按「去建立角色」到資源表那張紙');
  assert(!H2.errs.length, '3D 用不了：沒有錯誤 ' + H2.errs.join(' | '));
  await H2.close();
})().catch(function (e) { console.error(e); process.exit(1); });
