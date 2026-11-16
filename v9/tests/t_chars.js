// 多個角色的畫面（第 13 輪）：一個角色的人畫面照舊（首頁沒有角色那一列、資源表只有「＋開新角色」一顆鈕）；＋開新角色（生產背景沒寫擋下來、勾自然、資源表先放一行空的、出問題怎麼辦先寫好、開了就換過去）；
// 首頁那一列切換現在用的角色（資源表、最上面一列跟著變）；資源表的角色分頁；約人、開時段、掛公告、接上去、設密鑰都用現在用的角色，旁邊「用（…）・換」可以臨時換；事件簿「我用（…）」；
// 他的那張紙：他有好幾個角色時最上面列他的角色清單，點一個看那個角色（他的時段跟著換），輸入 J3-2、從公告欄點那一行都直接到那個角色；示範的小樂（後山）選柴他主動、要先接受；
// 更多 → 我的角色：現在用的、用這個、收掉（先確認；最後一個帶去不玩了）；最多 5 個；直放和轉橫各截一張。
// node v9/tests/t_chars.js <test9.html> [截圖資料夾]
var lib = require('./lib'), assert = lib.assert, path = require('path');
var OUT = process.argv[3] || path.join(__dirname, 'shots'); require('fs').mkdirSync(OUT, { recursive: true });
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg;
  await H.fresh();
  var cur = function () { return H.ev("CORE.curChar(APP.me()).id"); };
  var nChars = function () { return H.ev("CORE.charsOf(APP.me()).length"); };
  var toHome = async function () { await H.ev("APP.goHouse(APP.me().serial)"); await pg.waitForTimeout(500); };

  // 1. 一個角色：畫面照舊
  await toHome();
  assert(!(await H.ev("!!document.getElementById('hRoles')")), '一個角色：首頁沒有角色那一列');
  await H.nav('res');
  assert(!(await H.ev("!!document.getElementById('charTabs')")) && (await H.ev("!!document.querySelector('#tmain .sub [data-act=\"newChar\"]')")), '一個角色：資源表沒有分頁，上面只有一顆「＋開新角色」');
  assert((await H.ev("document.getElementById('tother').textContent")).indexOf('用（') < 0, '一個角色：最上面一列不寫用哪個角色');

  // 2. ＋開新角色：沒寫生產背景擋下來；寫「廚房」開好就換過去，資源表一行「空的」、出問題怎麼辦先寫好
  await H.clickText('＋開新角色', '#tmain');
  assert((await H.popOpen()) && (await H.popTitle()) === '開新角色' && (await H.popBody()).indexOf('J1-2') >= 0, '跳出開新角色：寫生產背景、勾自然，開好的編號是 J1-2');
  await H.popOk('開'); await pg.waitForTimeout(200);
  assert((await H.popOpen()) && (await H.popBody()).indexOf('寫一下你的生產背景') >= 0 && (await nChars()) === 1, '沒寫生產背景：擋下來，沒開');
  await H.popOk(); await H.clickText('＋開新角色', '#tmain'); await H.setIn('ncBg', '廚房'); await H.check('#ncNature', false); await H.popOk('開'); await pg.waitForTimeout(200);
  assert((await nChars()) === 2 && (await cur()) === J1 + '-2', '開好了 J1-2，現在用它');
  var tabs = await H.ev("Array.from(document.querySelectorAll('#charTabs .ctab')).map(function(b){return b.textContent+(b.classList.contains('on')?'*':'');})");
  assert(tabs.join() === 'J1-1 便當熟食,J1-2 廚房*' && (await H.ev("!!document.querySelector('#charTabs [data-act=\"newChar\"]')")), '資源表最上面一排角色分頁「J1-1 便當熟食」「J1-2 廚房」（亮著），和「＋開新角色」：' + tabs.join());
  var resNames = await H.ev("Array.from(document.querySelectorAll('#tmain input[data-ed=\"resName\"]')).map(function(i){return i.value;})");
  assert(resNames.join() === '空的' && (await H.ev("document.querySelector('#tmain textarea[data-ed=\"problem\"]').value")) === CORE_DEFAULT_PROBLEM(), 'J1-2 的資源表只有一行「空的」，出問題怎麼辦先寫好那一句');
  function CORE_DEFAULT_PROBLEM() { return '東西當面交；送不到或壞了，改天補一次'; }
  assert((await H.ev("document.getElementById('tother').textContent")).indexOf('用（廚房）') >= 0, '最上面一列：我是 J1 我・用（廚房）・換');
  // 在 J1-2 加一樣東西：加在廚房的資源表，便當熟食的不變
  await H.edit('#tmain input[data-new="res"]', '便當'); await pg.waitForTimeout(150);
  var kRes = await H.ev("(function(){var c=CORE.charOf(APP.state(),'" + J1 + "-2').char;var p=CORE.pending(c,APP.now())||CORE.version(c,APP.now());return p.resources.map(function(x){return x.name;}).join();})()");
  var oneRes = await H.ev("(function(){var c=CORE.charOf(APP.state(),'" + J1 + "-1').char;var p=CORE.pending(c,APP.now())||CORE.version(c,APP.now());return p.resources.map(function(x){return x.name;}).join();})()");
  assert(kRes === '空的,便當' && oneRes.indexOf('便當') < 0, '在廚房那一張空白那一行寫「便當」：加在 J1-2，J1-1 不變（' + kRes + '｜' + oneRes + '）');
  // 分頁切回 J1-1
  await H.finger("function(){ return document.querySelector('#charTabs [data-id=\"" + J1 + "-1\"]'); }", 'J1-1 的分頁');
  assert((await cur()) === J1 + '-1' && (await H.ev("Array.from(document.querySelectorAll('#tmain input[data-ed=\"resName\"]')).map(function(i){return i.value;}).join()")).indexOf('陪跑一小時') >= 0, '點 J1-1 的分頁：換成便當熟食，資源表是陪跑一小時那一張');

  // 3. 首頁那一列：兩個角色、亮著現在用的；點一個就換
  await toHome();
  var hr = await H.ev("Array.from(document.querySelectorAll('#hRoles button')).map(function(b){return b.textContent+(b.classList.contains('on')?'*':'');}).join()");
  assert(hr === 'J1-1 便當熟食*,J1-2 廚房', '首頁那一列：現在用 J1-1 便當熟食（亮著）、J1-2 廚房：' + hr);
  await H.hclick('#hRoles [data-id="' + J1 + '-2"]');
  assert((await cur()) === J1 + '-2' && (await H.ev("document.querySelector('#hRoles .on').textContent")) === 'J1-2 廚房', '首頁點「J1-2 廚房」：現在用廚房');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_chars_home_landscape.png' });
  assert((await H.ev("document.querySelector('.hbar .who')? document.querySelector('.hbar .who').textContent:''")).indexOf('（') < 0, '能量之家最上面只寫名字（代表整個人），不加括弧');

  // 4. 他的那張紙：輸入 J3 → 他的角色清單，下面是他的第一個角色；點「看這個」換到 J3-2（後山），他的時段跟著換
  await H.nav('log'); await H.serial('J3'); await pg.waitForTimeout(200);
  var tc = await H.ev("Array.from(document.querySelectorAll('#theirChars tr[data-row]')).map(function(t){return t.textContent;})");
  assert(tc.length === 2 && tc[0].indexOf('J3-1') >= 0 && tc[0].indexOf('書') >= 0 && tc[0].indexOf('在看這個') >= 0 && tc[1].indexOf('J3-2') >= 0 && tc[1].indexOf('後山') >= 0 && tc[1].indexOf('自然') >= 0 && tc[1].indexOf('一捆柴') >= 0, '輸入 J3：最上面列他的角色清單（J3-1 書、J3-2 後山・自然・一捆柴…），在看 J3-1：' + tc.join(' | '));
  assert((await H.ev("document.querySelector('#tmain .fields').textContent")).indexOf('小樂（書）') >= 0 && (await H.main()).indexOf('借一本書') >= 0 && (await H.main()).indexOf('一捆柴・') < 0, '下面是 J3-1（書）的資源表');
  assert((await H.main()).indexOf('沒有開放的時段') >= 0, 'J3-1 沒開時段');
  await H.finger("function(){ return document.querySelector('#theirChars [data-act=\"ochar\"][data-id=\"" + J3 + "-2\"]'); }", '看 J3-2');
  var main = await H.main();
  assert((await H.ev("document.querySelector('#tmain .fields').textContent")).indexOf('小樂（後山）') >= 0 && (await H.ev("document.querySelector('#tmain .fields').textContent")).indexOf('J3-2') >= 0 && main.indexOf('一捆柴') >= 0 && main.indexOf('一袋松果') >= 0, '點「看這個」：換到 J3-2（後山）的資源表：一捆柴、一袋松果');
  assert(main.indexOf('他的時段（1 個）') >= 0 && main.indexOf('用（廚房）去約') >= 0, '他的時段跟著換（後山開的那一個），旁邊寫「用（廚房）去約・換」');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_chars_other_landscape.png', fullPage: true });
  // 用「換」改成便當熟食去約
  await H.finger("function(){ return document.querySelector('#tmain .lab [data-act=\"pickChar\"]'); }", '換');
  assert((await H.popOpen()) && (await H.popTitle()) === '現在用哪個角色', '按「換」：跳出選角色');
  await H.click('#popBody [data-use="' + J1 + '-1"]');
  assert((await cur()) === J1 + '-1' && (await H.main()).indexOf('用（便當熟食）去約') >= 0 && !(await H.popOpen()), '選 J1-1：現在用便當熟食，那一行跟著變');
  await H.click('#tmain [data-act="pickChar"]'); await H.click('#popBody [data-use="' + J1 + '-2"]');
  // 約小樂（後山）：用廚房去
  var hillSlot = await H.ev("APP.state().roles.find(function(r){return r.serial==='" + J3 + "';}).slots.find(function(s){return s.role==='" + J3 + "-2';}).id");
  await H.click('#tmain [data-act="book"][data-id="' + hillSlot + '"]'); await pg.waitForTimeout(200);
  assert((await H.ev("CORE.slotOf(APP.state(),'" + hillSlot + "').slot.roles['" + J1 + "']")) === J1 + '-2' && (await H.msg()).indexOf('用（廚房）') >= 0, '按「約他」：用 J1-2（廚房）約了小樂（後山）');
  var rowT = await H.ev("(function(){var tr=" + H.entryRow(hillSlot, J3) + ";return tr?tr.textContent:'';})()");
  assert(rowT.indexOf('小樂（後山）') >= 0 && rowT.indexOf('我用（廚房）') >= 0, '事件簿那一行：跟誰寫「小樂（後山）」，下面小字「我用（廚房）」：' + rowT);
  // 示範：選柴、他選我的空的 → 他給得多，他主動，要先接受他（後山）的規則
  await H.ev("(function(){var S=APP.state();S.acceptances=S.acceptances.filter(function(a){return a.who!=='" + J1 + "';});CORE.setWants(S,'" + hillSlot + "','" + J3 + "','" + J1 + "',[CORE.emptyOf(CORE.charOf(S,'" + J1 + "-2').char,APP.now()).id]);APP.changed();})()");
  await H.pick(hillSlot, J3, ['r3k']); await pg.waitForTimeout(150);
  rowT = await H.ev("(function(){var tr=" + H.entryRow(hillSlot, J3) + ";return tr?tr.textContent:'';})()");
  var on = await H.ev("(function(){var tr=" + H.entryRow(hillSlot, J3) + ";var b=tr&&tr.querySelector('.lead b.on');return b?b.textContent:null;})()");
  assert(on === '他' && rowT.indexOf('看規則・接受') >= 0, '選小樂的一捆柴（40）、他選我的空的：他給得多，主動圈「他」，紅字「看規則・接受」');
  await H.finger("function(){ var tr=" + H.entryRow(hillSlot, J3) + "; return tr.querySelector('[data-act=\"seeRules\"]'); }", '看規則・接受');
  assert((await H.popBody()).indexOf('後山家規：撿柴要留一半給下一個人。') >= 0 && (await H.popBody()).indexOf('柴放在後山步道口') >= 0, '打開是小樂（後山）那一版的出問題怎麼辦和家規');
  await H.popOk('接受');
  // （我給得多、我主動那一邊在 core.test.js 用松果測過）

  // 5. 開時段、掛公告：用現在用的角色
  await H.nav('log');
  assert((await H.ev("document.querySelector('#tmain tr.addrow').textContent")).indexOf('用（廚房）開') >= 0, '事件簿空白那一行：用（廚房）開・換');
  var sid = await H.openSlot(300);
  assert((await H.ev("CORE.slotOf(APP.state(),'" + sid + "').slot.role")) === J1 + '-2' && (await H.ev("document.querySelector('#tmain tr[data-id=\"" + sid + "\"]').textContent")).indexOf('用（廚房）') >= 0, '開的時段是 J1-2（廚房）的，那一行寫用（廚房）');
  await H.nav('find');
  var postRow = await H.ev("document.querySelector('#tmain tr[data-id=\"post\"]').textContent");
  assert(postRow.indexOf('J1-2') >= 0 && postRow.indexOf('用（廚房）掛') >= 0 && postRow.indexOf('空的') >= 0 && postRow.indexOf('陪跑一小時') < 0, '掛公告那一行：序號寫 J1-2、用（廚房）掛、可以給的從廚房的資源表選');
  await H.setIn('ntNeed', '想要一把傘'); await H.click('#tmain [data-give]'); await H.clickText('掛上去', '#tmain'); await pg.waitForTimeout(150);
  assert((await H.ev("APP.state().notices.filter(function(n){return n.owner==='" + J1 + "';}).map(function(n){return n.role;}).join()")) === J1 + '-2', '公告掛在 J1-2 底下');
  // 公告欄下半張：一個角色一行；點小樂（後山）那一行的「看資源表」直接到 J3-2
  var ppl = await H.ev("Array.from(document.querySelectorAll('#tmain table:nth-of-type(2) tr[data-row]')).map(function(t){return t.dataset.char;})");
  assert(ppl.indexOf(J3 + '-1') >= 0 && ppl.indexOf(J3 + '-2') >= 0 && ppl.indexOf(J2 + '-2') >= 0 && (await H.main()).indexOf('資源表 3 人') >= 0, '公告欄下半張：一個角色一行（小樂兩行、阿澄兩行），「資源表 3 人」照人算');
  await H.finger("function(){ return document.querySelector('#tmain tr[data-char=\"" + J3 + "-2\"] [data-act=\"visit\"][data-role]'); }", '小樂（後山）那一行');
  assert((await H.ev("document.querySelector('#tmain .fields').textContent")).indexOf('小樂（後山）') >= 0, '從公告欄點小樂（後山）那一行：直接到 J3-2');
  // 輸入 J2-2：直接到阿澄（廚房）
  await H.serial('J2-2'); await pg.waitForTimeout(150);
  assert((await H.ev("document.querySelector('#tmain .fields').textContent")).indexOf('阿澄（廚房）') >= 0 && (await H.main()).indexOf('便當一個') >= 0, '輸入 J2-2：直接到阿澄（廚房）的資源表');
  // 設打招呼密鑰：我用廚房、他用他的廚房
  await H.clickText('跟他設打招呼密鑰', '#tmain');
  assert((await H.popTitle()).indexOf('阿澄（廚房）') >= 0 && (await H.popBody()).indexOf('用（廚房）設') >= 0, '設打招呼密鑰：跟阿澄（廚房），用（廚房）設');
  await H.setIn('gKey', '午安'); await H.popOk('送出'); await pg.waitForTimeout(150);
  var g = await H.ev("(function(){var g=APP.state().greets.find(function(x){return x.a==='" + J1 + "'||x.b==='" + J1 + "';});return g&&g.pending?[g.a===\"" + J1 + "\"?g.pending.ra:g.pending.rb,g.a===\"" + J1 + "\"?g.pending.rb:g.pending.ra]:null;})()");
  assert(g && g[0] === J1 + '-2' && g[1] === J2 + '-2', '密鑰記雙方用的角色：我 J1-2、阿澄 J2-2：' + JSON.stringify(g));
  await H.click('#tother [data-act="home"]');

  // 6. 規則表也是一個角色一份：上面同一排分頁
  await H.nav('rules');
  assert((await H.ev("document.querySelectorAll('#charTabs .ctab').length")) === 2 && (await H.ev("document.querySelector('#tmain .sub').textContent")).indexOf('J1-2 廚房 的規則表') >= 0, '規則表上面同一排角色分頁，寫 J1-2 廚房 的規則表');

  // 7. 直放截一張
  await pg.setViewportSize({ width: 360, height: 780 }); await pg.waitForTimeout(300); await H.nav('res');
  var fit = await H.ev("(function(){var t=document.getElementById('charTabs').getBoundingClientRect(),p=document.querySelector('#tmain .page').getBoundingClientRect();return t.left>=p.left-1&&t.right<=p.right+1;})()");
  assert(fit, '直放：角色分頁在紙裡');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_chars_res_portrait.png', fullPage: true });
  await toHome(); var hb = await H.ev("(function(){var b=document.getElementById('hRoles').getBoundingClientRect();return b.right<=innerWidth+1&&b.left>=-1;})()");
  assert(hb, '直放：首頁那一列沒擠出畫面');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_chars_home_portrait.png' });
  await pg.setViewportSize({ width: 780, height: 360 }); await pg.waitForTimeout(200);

  // 8. 更多 → 我的角色：收掉；有人收著它的東西就擋下來；最後一個帶去不玩了；最多 5 個
  await H.nav('chars');
  var cr = await H.ev("Array.from(document.querySelectorAll('#tmain tr[data-row]')).map(function(t){return t.textContent;})");
  assert(cr.length === 3 && cr[0].indexOf('J1-1') >= 0 && cr[0].indexOf('用這個') >= 0 && cr[1].indexOf('J1-2') >= 0 && cr[1].indexOf('現在用的') >= 0 && cr[1].indexOf('我（廚房）') >= 0 && cr[2].indexOf('＋開新角色') >= 0, '我的角色：J1-1（用這個）、J1-2 我（廚房）（現在用的）、開新角色：' + cr.join(' | '));
  await H.ev("(function(){var S=APP.state();S.holds.push({id:'hX',issuer:'" + J1 + "',issuerRole:'" + J1 + "-2',holder:'" + J2 + "',resource:'x',name:'便當',kind:'thing',price:0,docking:null,atUs:APP.now(),untilDay:null,status:'held',deliver:''});APP.changed();})()");
  await H.finger("function(){ return document.querySelector('#tmain [data-act=\"closeChar\"][data-id=\"" + J1 + "-2\"]'); }", '收掉 J1-2');
  assert((await H.popTitle()).indexOf('還不能收掉') >= 0 && (await H.popBody()).indexOf('阿澄「便當」') >= 0 && (await nChars()) === 2, '有人收著 J1-2 的東西還沒兌現：擋下來，列出阿澄「便當」');
  await H.popOk(); await H.ev("(function(){var S=APP.state();S.holds=S.holds.filter(function(h){return h.id!=='hX';});APP.changed();})()");
  await H.finger("function(){ return document.querySelector('#tmain [data-act=\"closeChar\"][data-id=\"" + J1 + "-2\"]'); }", '收掉 J1-2');
  assert((await H.popTitle()).indexOf('收掉 J1-2 廚房？') >= 0, '先確認');
  await H.popOk('收掉'); await pg.waitForTimeout(150);
  assert((await nChars()) === 1 && (await cur()) === J1 + '-1', '收掉了：剩 J1-1，現在用它');
  await toHome(); assert(!(await H.ev("!!document.getElementById('hRoles')")), '剩一個角色：首頁那一列不見了');
  await H.nav('chars'); await H.finger("function(){ return document.querySelector('#tmain [data-act=\"closeChar\"]'); }", '收掉最後一個');
  assert((await H.popTitle()) === '這是你最後一個角色', '最後一個角色：說收掉就是不玩了'); await H.popOk('去那一張'); assert((await H.sheetName()) === 'role', '帶去「聯絡方式和不玩了」');
  // 最多 5 個：開到 5 個，「＋開新角色」不見了；編號不重用（下一個是 J1-3）
  for (var i = 0; i < 4; i++) { await H.nav('chars'); await H.clickText('＋開新角色', '#tmain'); await H.setIn('ncBg', '第' + (i + 3) + '個'); await H.popOk('開'); await pg.waitForTimeout(120); }
  var ids = await H.ev("CORE.charsOf(APP.me()).map(function(c){return CORE.abbrevChar(c.id);}).join()");
  assert(ids === 'J1-1,J1-3,J1-4,J1-5,J1-6', '開到 5 個；收掉的 J1-2 不再用：' + ids);
  await H.nav('chars'); assert(!(await H.ev("!!document.querySelector('#tmain [data-act=\"newChar\"]')")), '5 個了：沒有「＋開新角色」');
  await H.nav('res'); assert((await H.ev("document.querySelectorAll('#charTabs .ctab').length")) === 5 && !(await H.ev("!!document.querySelector('#tmain [data-act=\"newChar\"]')")), '資源表 5 個分頁，沒有「＋開新角色」');
  await toHome(); var hb5 = await H.ev("(function(){var b=document.getElementById('hRoles').getBoundingClientRect();return {ok:b.right<=innerWidth+1,n:document.querySelectorAll('#hRoles button').length};})()");
  assert(hb5.ok && hb5.n === 5, '首頁那一列 5 個角色都在畫面裡');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_chars_home5_landscape.png' });

  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
