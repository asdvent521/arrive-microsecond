// v9 瀏覽器測試共用：開頁、重置、手指按、換組換表、序號框、斷言
var { chromium } = require('/opt/node22/lib/node_modules/playwright');
var path = require('path');
var fails = 0;
function assert(c, m) { if (!c) { console.error('FAIL: ' + m); fails++; process.exitCode = 1; } else console.log('ok: ' + m); }
var GROUP_OF = { today: '今天', notices: '公告欄', find: '公告欄', booked: '預約', myslots: '預約', role: '我的', rules: '我的', resources: '我的', bag: '我的', calendar: '我的', house: '我的', help: '我的' };
var NAME = { today: '今天', notices: '公告', find: '找人', booked: '我預約的', myslots: '我開的時段', role: '角色', rules: '規則表', resources: '資源表', bag: '背包', calendar: '日曆', house: '我的達秒屋', help: '說明', slots: '時段' };
async function open(pagePath, opts) {
  opts = opts || {};
  var browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  var ctx = await browser.newContext({ viewport: { width: opts.width || 780, height: opts.height || 360 }, deviceScaleFactor: 2 });
  var pg = await ctx.newPage();
  var errs = [];
  pg.on('pageerror', function (e) { errs.push(String(e)); });
  pg.on('console', function (m) { if (m.type() === 'error' && m.text().indexOf('ERR_') < 0) errs.push(m.text()); });
  var file = 'file://' + path.resolve(pagePath);
  await pg.goto(file); await pg.waitForTimeout(400);
  var H = {
    pg: pg, browser: browser, errs: errs, file: file, NAME: NAME,
    // 重置：預設放一個示範的「我」（J1）並跳過教學；raw＝真的第一次打開（從創角色開始）
    fresh: async function (o) { await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.waitForTimeout(400); if (!(o && o.raw)) { await pg.evaluate("APP.demo()"); await pg.waitForTimeout(200); } },
    close: function () { return browser.close(); },
    ev: function (js) { return pg.evaluate(js); },
    // 用手指按一個元素：捲到看得見、算出中心、確認 elementFromPoint 打到的就是它，再點那個座標
    finger: async function (finder, what) {
      var r = await pg.evaluate(function (f) {
        var el = (new Function('return (' + f + ')()'))(); if (!el) return { err: '找不到' };
        el.scrollIntoView({ block: 'center', inline: 'center' });
        var b = el.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2, hit = document.elementFromPoint(x, y);
        var main = el.closest('#tmain');
        if (main && !(hit === el || el.contains(hit))) {   // 被凍結的第一欄蓋住：表往左捲
          var fz = main.querySelector('td.fz, th.fz'); var fw = fz ? fz.getBoundingClientRect().right : main.getBoundingClientRect().left;
          main.scrollLeft += b.left - fw - 12; b = el.getBoundingClientRect(); x = b.left + b.width / 2; y = b.top + b.height / 2; hit = document.elementFromPoint(x, y);
        }
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
    // 換到某一張表：先按下方的組，再按上方的表（都用手指）
    nav: async function (sheet) {
      await H.clickText(GROUP_OF[sheet], '#tgroups');
      if ((await pg.evaluate("TABLE.ui.sheet")) !== sheet) await H.clickText(NAME[sheet], '#ttabs');
      if ((await pg.evaluate("TABLE.ui.sheet")) !== sheet) throw new Error('換不到 ' + sheet);
    },
    otab: async function (sheet) { await H.clickText(NAME[sheet], '#ttabs'); },   // 他的表格世界裡換表
    serial: async function (code) { await H.setIn('serialIn', code); await H.click('#serialGo'); },
    main: function () { return pg.textContent('#tmain'); },
    msg: function () { return pg.evaluate("(function(){var m=document.getElementById('tmsg');return m&&!m.hidden?m.textContent:'';})()"); },
    rows: function (key) { return pg.evaluate("document.querySelectorAll('#tmain table" + (key ? '[data-sheet=\"' + key + '\"]' : '') + " tr[data-row]').length"); },
    popOpen: function () { return pg.evaluate("!document.getElementById('pop').hidden"); },
    popTitle: function () { return pg.textContent('#popTitle'); },
    popBody: function () { return pg.textContent('#popBody'); },
    popOk: async function (label) { await H.clickText(label || '好', '#popBtns'); },
    sheetName: function () { return pg.evaluate("TABLE.ui.other ? 'other:' + TABLE.ui.osheet : TABLE.ui.sheet"); },
    // 把時段的那一微秒拉到幾秒後（資料層直接改，省得等）
    soon: function (slotId, sec) { return pg.evaluate("(function(){var x=CORE.slotOf(APP.state(),'" + slotId + "');x.slot.atUs=APP.now()+" + (sec || 3) + "e6;APP.changed();})()"); }
  };
  return H;
}
module.exports = { open: open, assert: assert, fails: function () { return fails; } };
