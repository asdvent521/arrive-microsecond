// v9 瀏覽器測試共用：開頁、重置、手指按、換到五張紙或更多裡的一張、序號或密鑰框、骰子、斷言
var { chromium } = require('/opt/node22/lib/node_modules/playwright');
var path = require('path');
var fails = 0;
function assert(c, m) { if (!c) { console.error('FAIL: ' + m); fails++; process.exitCode = 1; } else console.log('ok: ' + m); }
var TABS = { log: '事件簿', cal: '日曆', res: '資源表', find: '公告欄', more: '更多' };
var NAME = { log: '事件簿', cal: '日曆', res: '資源表', find: '公告欄', more: '更多', rules: '規則表', together: '一起成交', greet: '打招呼密鑰', slots: '我開的時段', house: '我的能量之家', village: '鄰居和村子', map: '交換關係', role: '角色設定', help: '說明', orules: '他的規則' };
async function open(pagePath, opts) {
  opts = opts || {};
  var browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  var ctx = await browser.newContext({ viewport: { width: opts.width || 780, height: opts.height || 360 }, deviceScaleFactor: 2, hasTouch: !!opts.touch });
  var pg = await ctx.newPage();
  if (opts.noWebGL) await pg.addInitScript(function () { var g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t) { return /webgl/.test(t) ? null : g.apply(this, arguments); }; });   // 3D 用不了
  var errs = [];
  pg.on('pageerror', function (e) { errs.push(String(e)); });
  pg.on('console', function (m) { if (m.type() === 'error' && m.text().indexOf('ERR_') < 0) errs.push(m.text()); });
  var file = 'file://' + path.resolve(pagePath);
  await pg.goto(file); await pg.waitForTimeout(400);
  var H = {
    pg: pg, browser: browser, errs: errs, file: file, NAME: NAME,
    // 重置：預設放一個示範的「我」（J1）並跳過教學；raw＝真的第一次打開（從創角色開始）
    // 重置：預設是不帶過去紀錄的示範資料，放一個示範的「我」（J1）並跳過教學；raw＝真的第一次打開（從創角色開始，示範角色帶過去的紀錄）；history＝帶過去紀錄
    fresh: async function (o) { o = o || {}; await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.waitForTimeout(400); if (!o.raw) { if (!o.history) await pg.evaluate("APP.resetAll({ history: false })"); await pg.evaluate("APP.demo()"); await pg.evaluate("APP.goTable(null, 'log')"); await pg.waitForTimeout(200); } },
    close: function () { return browser.close(); },
    ev: function (js) { return pg.evaluate(js); },
    // 用手指按一個元素：捲到看得見、算出中心、確認 elementFromPoint 打到的就是它，再點那個座標
    finger: async function (finder, what) {
      var r = await pg.evaluate(function (f) {
        var el = (new Function('return (' + f + ')()'))(); if (!el) return { err: '找不到' };
        el.scrollIntoView({ block: 'center', inline: 'center' });
        var b = el.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2, hit = document.elementFromPoint(x, y);
        if (!hit || !(hit === el || el.contains(hit))) return { err: '被蓋住：那個位置是 ' + (hit ? hit.tagName + (hit.id ? '#' + hit.id : '') + (hit.className ? '.' + String(hit.className).split(' ')[0] : '') : '空的') };
        return { x: x, y: y };
      }, finder);
      if (r.err) throw new Error('手指按不到 ' + what + '：' + r.err);
      await pg.mouse.click(r.x, r.y); await pg.waitForTimeout(150);
    },
    click: async function (sel) { await H.finger("function(){ return document.querySelector(" + JSON.stringify(sel) + "); }", sel); },
    // 按畫面上字以 text 開頭的按鈕（限定在 scope 裡）
    clickText: async function (text, scope) { await H.finger("function(){ return [...document.querySelectorAll(" + JSON.stringify((scope || '#view-table') + ' button, ' + (scope || '#view-table') + ' a') + ")].find(function (b) { return b.offsetParent !== null && b.textContent.trim().indexOf(" + JSON.stringify(text) + ") === 0; }); }", '「' + text + '」'); },
    setIn: async function (id, value) { await pg.evaluate(function (a) { var el = document.getElementById(a[0]); el.value = a[1]; el.dispatchEvent(new Event('input', { bubbles: true })); }, [id, String(value)]); },
    // 改格子（input/select/checkbox）並觸發 change；勾選框用手指按
    edit: async function (sel, value) { var ok = await pg.evaluate(function (a) { var el = document.querySelector(a[0]); if (!el) return false; el.value = a[1]; el.dispatchEvent(new Event('change', { bubbles: true })); return true; }, [sel, String(value)]); if (!ok) throw new Error('找不到格子 ' + sel); await pg.waitForTimeout(150); },
    check: async function (sel, on) { var cur = await pg.evaluate(function (s) { var el = document.querySelector(s); return el ? el.checked : null; }, sel); if (cur === null) throw new Error('找不到勾選框 ' + sel); if (cur !== on) await H.click(sel); },
    // 換到某一張紙：五張紙按最上面的分頁；更多裡的一張，先按「更多」再按那一列的「打開」（都用手指）
    nav: async function (sheet) {
      // 一打開是自己的能量之家（補二十二）：在能量之家裡就先按首頁的「事件簿」（看別人的家就按「回我的表格世界」）回表格世界
      if (await pg.isVisible('#view-house')) { if (await pg.isVisible('#hhome [data-hact="toLog"]')) await H.finger("function(){ return document.querySelector('#hhome [data-hact=\"toLog\"]'); }", '首頁的「事件簿」'); else await H.clickText('回我的表格世界', '.hbar'); await pg.waitForTimeout(250); }
      if (TABS[sheet]) await H.clickText(TABS[sheet], '#ttabs');
      else { await H.clickText('更多', '#ttabs'); await H.finger("function(){ return document.querySelector('#tmain tr[data-id=" + JSON.stringify(sheet) + "] [data-act=\"open\"]'); }", '更多裡的「' + NAME[sheet] + '」'); }
      if ((await H.sheetName()) !== sheet) throw new Error('換不到 ' + sheet + '（現在是 ' + (await H.sheetName()) + '）');
    },
    serial: async function (code) { await H.setIn('serialIn', code); await H.click('#serialGo'); },
    dice: async function () { await H.click('#diceBtn'); return pg.evaluate("document.getElementById('serialIn').value"); },
    main: function () { return pg.textContent('#tmain'); },
    msg: function () { return pg.evaluate("(function(){var m=document.getElementById('tmsg');return m&&!m.hidden?m.textContent:'';})()"); },
    // 這張紙上有幾行（主表＋下面那張小表的 data-row）
    rows: function (key) { return pg.evaluate("document.querySelectorAll('#tmain section.page" + (key ? '[data-sheet=\"' + key + '\"]' : '') + " tr[data-row]').length"); },
    // 換人（測試用）：更多 → 角色設定 → 最下面的選單
    becomeMe: async function (serial) { if (await pg.evaluate("!document.getElementById('view-house').hidden")) await pg.evaluate("APP.goTable(null,'more')"); await H.nav('role'); var i = await pg.evaluate("APP.state().roles.findIndex(function(r){return r.serial==='" + serial + "';})"); await H.edit('#tmain select[data-ed="me"]', i); if ((await pg.evaluate("APP.me().serial")) !== serial) throw new Error('換不成 ' + serial); },
    popOpen: function () { return pg.evaluate("!document.getElementById('pop').hidden"); },
    popTitle: function () { return pg.textContent('#popTitle'); },
    popBody: function () { return pg.textContent('#popBody'); },
    popOk: async function (label) { await H.clickText(label || '好', '#popBtns'); },
    sheetName: function () { return pg.evaluate("SHEETS.ui.other ? 'other:' + SHEETS.ui.osheet : SHEETS.ui.sheet"); },
    // 在事件簿空白那一行寫時間開一個時段（sec 秒後；跨日就先翻到後一天）；名額、一起成交；回時段 id
    openSlot: async function (sec, cap, together) {
      await H.nav('log'); var at = await pg.evaluate("APP.now()+" + (sec || 120) + "e6"), dn = await pg.evaluate("CORE.dayNum(" + at + ")"), today = await pg.evaluate("CORE.dayNum(APP.now())");
      for (var d = today; d < dn; d++) await H.clickText('後一天 ›', '#tmain');
      if (cap) await H.edit('#addSlotCap', cap);
      if (together != null) await H.check('#addSlotTogether', !!together);
      var hhmm = await pg.evaluate("CORE.fmtUs(" + at + ").slice(11,16)"); await H.edit('#addSlotTime', hhmm);
      var id = await pg.evaluate("(function(){var s=APP.me().slots.filter(function(x){return Math.floor(x.atUs/60e6)===Math.floor(" + at + "/60e6);});return s.length?s[s.length-1].id:null;})()");
      if (!id) throw new Error('時段沒開成：' + (await H.msg())); return id;
    },
    // 事件簿上跟某人那一行
    entryRow: function (slotId, other) { return "(function(){var m=APP.me().serial,e=CORE.entriesOf(APP.state()).find(function(e){return e.slot==='" + slotId + "'&&((e.a===m&&e.b==='" + other + "')||(e.b===m&&e.a==='" + other + "'));});return e?document.querySelector('#tmain tr[data-id=\"'+e.id+'\"]'):null;})()"; },
    // 在事件簿那一行選他的東西（可以多樣）
    pick: async function (slotId, other, resIds) { await H.finger("function(){ var tr=" + H.entryRow(slotId, other) + "; return tr && tr.querySelector('[data-act=\"pick\"]'); }", '選他的東西'); for (var r of resIds) await H.click('#popBody [data-add="' + r + '"]'); await H.popOk('選好了'); },
    // 把時段的那一微秒拉到幾秒後（資料層直接改，省得等）
    // 能量之家：點 3D 裡的東西（'door'、{day}、{block:[x,y,z], n:[0,1,0]}、{block, prop:true}、{ground:[x,z]}、{house: 序號}（村裡別間屋）、{spot:[gx,gz]}（挑地）），，先確認那一點是畫布、打到的就是它，再點座標
    tap3d: async function (target, what) {
      await pg.waitForTimeout(200);
      var p = await pg.evaluate(function (t) { var s = WORLD.screenOf(t); if (!s) return { err: '不在畫面上' }; var el = document.elementFromPoint(Math.round(s.x), Math.round(s.y)); if (!el || el.tagName !== 'CANVAS') return { err: '那一點不是畫布：' + (el ? el.tagName + '#' + el.id : '空的') }; s.x = Math.round(s.x); s.y = Math.round(s.y); var h = WORLD.hitAt(s.x, s.y); s.hit = h; if (!h) return { err: '那一點什麼都沒打到' }; if (t === 'door' ? h.kind !== 'door' : t === 'gate' ? h.kind !== 'gate' : t.day != null ? h.day !== t.day : t.block ? !(h.kind === 'block' && h.x === t.block[0] && h.y === t.block[1] && h.z === t.block[2] && (t.prop || !t.n || h.n.join() === t.n.join())) : t.ground ? !(h.kind === 'ground' && h.x === t.ground[0] && h.z === t.ground[1]) : t.house ? !(h.kind === 'house' && h.serial === t.house) : t.spot ? !(h.kind === 'spot' && h.pos.join() === t.spot.join()) : false) return { err: '那一點打到的是 ' + JSON.stringify(h) }; return s; }, target);
      if (p.err) throw new Error('點不到 ' + (what || JSON.stringify(target)) + '：' + p.err);
      await pg.mouse.click(p.x, p.y); await pg.waitForTimeout(250);
    },
    hclick: async function (sel) { await H.finger("function(){ return document.querySelector(" + JSON.stringify(sel) + "); }", sel); },
    houseSerial: async function (code) { await pg.evaluate(function (c) { var el = document.getElementById('hSerialIn'); el.value = c; }, code); await H.hclick('#hSerialGo'); await pg.waitForTimeout(400); },
    soon: function (slotId, sec) { return pg.evaluate("(function(){var x=CORE.slotOf(APP.state(),'" + slotId + "');x.slot.atUs=APP.now()+" + (sec || 3) + "e6;APP.changed();})()"); }
  };
  return H;
}
module.exports = { open: open, assert: assert, fails: function () { return fails; } };
