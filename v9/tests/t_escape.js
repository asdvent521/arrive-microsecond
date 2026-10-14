// 打進去的字一律當普通字：每個能打字的地方（名字、聯絡方式、用途、家規、家規網站、資源名稱和定義、公告的需要和種類、找、門牌、打招呼密鑰）都填 <i class=xx>Z</i>，
// 自己看、換人看，五張紙（每一張、更多裡的每一張、他的那張紙、他的日曆、找、那天的明細）和達秒屋（最上面一行、點磚的明細）都走一遍：畫面上不能出現 i.xx 這個標籤。
// node v9/tests/t_escape.js <test9.html>
var lib = require('./lib'), assert = lib.assert;
var X = '<i class=xx>Z</i>', J1 = '00000000001', J2 = '00000000002', J3 = '00000000003';
var SHEETS = ['log', 'cal', 'res', 'find', 'more', 'rules', 'together', 'greet', 'slots', 'house', 'village', 'role', 'help'];
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  var bad = [];
  var check = async function (where) { var n = await H.ev("document.querySelectorAll('i.xx, [class*=\"xx\"] i').length"); if (n) bad.push(where); return n === 0; };
  var shows = function () { return H.ev("document.body.innerText.indexOf(" + JSON.stringify(X) + ") >= 0"); };
  await H.fresh({ raw: true });
  // 1. 每個能打字的地方都填
  await H.setIn('cName', X); await H.clickText('建立，跳過教學', '#tmain'); await pg.waitForTimeout(300);
  assert((await H.ev("APP.me().name")) === X, '名字照原樣存起來');
  await check('創角色之後');
  await H.nav('role'); await H.edit('#tmain [data-ed="contact"]', X); await check('角色設定（聯絡方式）');
  await H.nav('rules'); await H.setIn('addUse', X); await H.click('#tmain [data-act="addUse"]'); await H.edit('#tmain [data-ed="village"]', X);
  await H.edit('#tmain [data-ed="site"]', 'https://example.com/' + X.replace(/ /g, '')); await check('規則表');
  await H.nav('res'); await H.edit('#tmain input[data-new="res"]', X);
  var rid = await H.ev("CORE.pending(APP.me(),APP.now()).resources.find(function(x){return x.name===" + JSON.stringify(X) + ";}).id");
  await H.edit('#tmain input[data-ed="resDef"][data-id="' + rid + '"]', X); await check('資源表');
  await H.nav('find'); await H.setIn('ntNeed', X); await H.setIn('ntKind', X); await H.click('#tmain [data-act="post"]'); await check('公告欄');
  await H.nav('house'); await H.edit('#tmain input[data-id="sign"]', X); await check('我的達秒屋');
  var me = JSON.parse(await H.ev("JSON.stringify({c:APP.me().contact,s:CORE.houseOf(APP.me()).sign,n:APP.state().notices.filter(function(n){return n.need===" + JSON.stringify(X) + ";}).length})"));
  assert(me.c === X && me.s === X && me.n === 1, '聯絡方式、門牌、公告都照原樣存起來');
  // 打招呼密鑰也填這些字（阿澄那邊的提醒和密鑰那張紙都會寫出來）
  await H.ev("(function(){var S=APP.state();CORE.proposeGreet(S,'" + J1 + "','" + J2 + "',{key:" + JSON.stringify(X) + ",give:[CORE.version(APP.me(),APP.now()).resources[0].id],get:['r2b']},APP.now());APP.changed();})()");
  await H.nav('greet'); await check('打招呼密鑰');
  // 明天起生效的改動提前到今天（當作過了一天），再跟阿澄成交一次：紀錄裡也有這些字
  await H.ev("(function(){var S=APP.state(),r=APP.me(),t=CORE.dayNum(APP.now());r.versions.forEach(function(v){if(v.fromDay>t)v.fromDay=t;});var res=CORE.version(r,APP.now()).resources.find(function(x){return x.name===" + JSON.stringify(X) + ";});CORE.restock(S,r.serial,res.id,3,APP.now());var s=CORE.addSlot(S,'" + J1 + "',APP.now()+1.5e6,1,null,APP.now());CORE.accept(S,'" + J2 + "','" + J1 + "',APP.now());CORE.book(S,'" + J2 + "',s.id,APP.now());CORE.setWants(S,s.id,'" + J2 + "','" + J1 + "',[res.id]);CORE.setWants(S,s.id,'" + J1 + "','" + J2 + "',['r2b']);APP.changed();})()");
  await pg.waitForFunction("APP.state().entries.some(function(e){return e.status==='traded'&&(e.a==='" + J1 + "'||e.b==='" + J1 + "');})", null, { timeout: 15000 }); await pg.waitForTimeout(300);
  await check('成交結果'); if (await H.popOpen()) await H.popOk();
  assert((await H.ev("CORE.version(APP.me(),APP.now()).rules.uses.indexOf(" + JSON.stringify(X) + ")")) >= 0 && (await H.ev("CORE.version(APP.me(),APP.now()).rules.village")) === X, '用途、家規照原樣存起來');
  // 2. 自己看：每一張紙、找、小日曆和那天的明細、達秒屋
  for (var sh of SHEETS) { await H.nav(sh); await check('自己的「' + sh + '」'); }
  await H.nav('find'); await H.setIn('kwIn', 'Z'); await H.click('#tmain [data-act="search"]'); await check('找'); var seen1 = await shows();
  var today = await H.ev("CORE.dayNum(APP.now())");
  await H.nav('log'); await check('事件簿（成交那一行）'); var seen2 = await shows();
  await H.click('#tmain [data-act="pickDay"]'); await check('日曆紙');
  await H.ev("KIT.dayPop(APP.me().serial," + today + ")"); await check('那天的明細'); var seen5 = await shows(); await H.popOk();
  await H.ev("APP.goHouse(APP.me().serial)"); await pg.waitForTimeout(400); await check('自己的達秒屋'); var seen3 = (await pg.textContent('#hwho')).indexOf(X) >= 0;
  await H.ev("KIT.dayPop(APP.me().serial," + today + ")"); await check('自己的達秒屋點磚'); await H.popOk();
  assert(seen1 && seen2 && seen3 && seen5, '這些字照原樣當普通字顯示（找、事件簿、明細、達秒屋最上面一行）');
  // 3. 換人（阿澄）看：他的那張紙、他的規則、公告、找、事件簿的提醒、達秒屋、點磚
  await H.becomeMe(J2);
  await H.nav('log'); await check('阿澄的事件簿（密鑰的提醒）'); var seen6 = await shows();
  await H.serial('J1'); await pg.waitForTimeout(200); await check('阿澄看 J1 的那張紙');
  await H.clickText('看他的規則', '#tmain'); await check('阿澄看 J1 的規則');
  await H.clickText('‹ 他的資源表', '#tmain'); await H.clickText('看他的日曆', '#tmain'); await check('阿澄看 J1 的日曆紙');
  await H.clickText('‹ 他的資源表', '#tmain'); await H.clickText('看他的達秒屋', '#tmain'); await pg.waitForTimeout(400); await check('阿澄看 J1 的達秒屋');
  await H.ev("KIT.dayPop('" + J1 + "'," + today + ")"); await check('阿澄看 J1 的達秒屋點磚'); var seen4 = await shows(); await H.popOk();
  await H.hclick('#hBack'); await H.nav('find'); await check('阿澄看公告欄'); await H.setIn('kwIn', 'Z'); await H.click('#tmain [data-act="search"]'); await check('阿澄找');
  for (var sh2 of SHEETS) { await H.nav(sh2); await check('阿澄的「' + sh2 + '」'); }
  // 小樂（陌生人）看
  await H.becomeMe(J3);
  await H.serial('J1'); await check('小樂看 J1 的那張紙'); await H.clickText('看他的規則', '#tmain'); await check('小樂看 J1 的規則');
  await H.ev("APP.goHouse('" + J1 + "')"); await pg.waitForTimeout(300); await check('小樂看 J1 的達秒屋');
  assert(seen4 && seen6, '換人看，明細和提醒裡也是普通字');
  assert(bad.length === 0, '每個地方都沒有出現 i.xx 標籤' + (bad.length ? '：出現在 ' + bad.join('、') : '（走了 ' + (SHEETS.length * 2 + 22) + ' 個畫面）'));
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
