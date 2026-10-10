// v7 瀏覽器測試共用：開頁、重置、走路、對話框選項、工作表操作、斷言
var { chromium } = require('/opt/node22/lib/node_modules/playwright');
var path = require('path');
var fails = 0;
function assert(c, m) { if (!c) { console.error('FAIL: ' + m); fails++; process.exitCode = 1; } else console.log('ok: ' + m); }
async function open(pagePath, opts) {
  opts = opts || {};
  var browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  var pg = await browser.newPage({ viewport: { width: opts.width || 360, height: opts.height || 740 }, deviceScaleFactor: 2 });
  var errs = [];
  pg.on('pageerror', function (e) { errs.push(String(e)); });
  pg.on('dialog', function (d) { d.accept(); });   // confirm()：按確定
  pg.on('console', function (m) { if (m.type() === 'error' && m.text().indexOf('ERR_CERT') < 0 && m.text().indexOf('ERR_FAILED') < 0) errs.push(m.text()); });
  await pg.goto('file://' + path.resolve(pagePath));
  await pg.waitForTimeout(600);
  var H = {
    pg: pg, browser: browser, errs: errs,
    // 重置：預設放一個示範的「我」（J1）並跳過教學；raw＝真的第一次打開（從創角色開始）
    fresh: async function (opts) { await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.waitForTimeout(800); if (!(opts && opts.raw)) { await pg.evaluate("APP.demo()"); await pg.waitForTimeout(500); } },
    close: function () { return browser.close(); },
    ev: function (js) { return pg.evaluate(js); },
    // 裡世界
    walkTo: async function (x, z) { await pg.evaluate("WORLD.walkTo({x:" + x + ", z:" + z + "})"); await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 15000 }); await pg.waitForTimeout(250); },
    goNear: async function (func, role) {               // 走到某個功能點旁邊：用手指點那棟建築；不在畫面上才退回程式走路
      var o = await pg.evaluate("(function(){var r=" + (role ? "CORE.roleOf(APP.state(),'" + role + "')" : "GAME.cur().role") + ";var o=APP.allObjs(r).find(function(x){return x.func==='" + func + "'});var p=WORLD.objectAt(o.id);return {id:o.id,x:p.x,z:p.z+p.radius+0.6};})()");
      var sc = null; try { sc = await H.onScreen(o.id); } catch (e) { sc = null; }
      if (sc) { await pg.mouse.click(sc.x, sc.y); await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 15000 }); }
      else await H.walkTo(o.x, o.z);
      await pg.waitForTimeout(300);
      // 走代號中到了建築只有提示：想看就按「看看」
      if (!(await H.dlgOpen()) && (await pg.evaluate("document.getElementById('hintLook') !== null"))) { await H.click('#hintLook'); }
    },
    walkDone: async function () { await pg.waitForFunction("!WORLD.isMoving()", null, { timeout: 20000 }); await pg.waitForTimeout(300); },
    // 點畫面走路，途中每 100ms 看一次對話框有沒有升起
    // 目標不在畫面上就單指拖曳轉鏡頭，直到看得到
    onScreen: async function (target) {
      for (var k = 0; k < 10; k++) {
        await pg.waitForTimeout(k ? 500 : 900);
        // 建築：先試中心點，被 HUD 蓋住就試底部；地面點只有一個。點的位置一定要真的是 3D 畫布
        var s = await pg.evaluate(function (t) {
          var cands = typeof t === 'string' ? [WORLD.screenOf(t), (function () { var o = WORLD.objectAt(t); return o ? WORLD.screenOf({ x: o.x, z: o.z }) : null; })()] : [WORLD.screenOf(t)];
          for (var i = 0; i < cands.length; i++) { var s = cands[i]; if (!s || s.x < 10 || s.x > innerWidth - 10 || s.y < 60 || s.y > innerHeight * 0.6) continue; var el = document.elementFromPoint(s.x, s.y); if (el && el.tagName === 'CANVAS') return s; }
          return null;
        }, target);
        if (s) return s;
        await pg.mouse.move(180, 400); await pg.mouse.down(); await pg.mouse.move(120, 400, { steps: 6 }); await pg.mouse.move(60, 400, { steps: 6 }); await pg.mouse.up();
      }
      throw new Error('轉了鏡頭還是看不到 ' + JSON.stringify(target));
    },
    tapAndWatch: async function (target) {
      var s;
      try { s = await H.onScreen(target); }
      catch (e) {   // 建築被上方的提示、按鈕擋住：先點地面走近一點（像手指會做的），再試一次
        if (typeof target !== 'string') throw e;
        var mid = await pg.evaluate(function (id) { var o = WORLD.objectAt(id), p = WORLD.playerPos(); if (!o) return null; var dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz); return { x: o.x - dx / d * Math.min(d - 0.5, 4.5), z: o.z - dz / d * Math.min(d - 0.5, 4.5) }; }, target);
        var sm = await H.onScreen(mid); await pg.mouse.click(sm.x, sm.y); await H.walkDone();
        s = await H.onScreen(target);
      }
      await pg.mouse.click(s.x, s.y);
      var opened = false, t0 = Date.now();
      while (Date.now() - t0 < 20000) {
        await pg.waitForTimeout(100);
        var r = await pg.evaluate("JSON.stringify({mv:WORLD.isMoving(), dlg:document.getElementById('dlg').classList.contains('open')})"); r = JSON.parse(r);
        if (!r.mv) break;                       // 停下來之後開的不算「途中」
        if (r.dlg) opened = true;
      }
      await pg.waitForTimeout(300);
      return opened;
    },
    dlgTitle: function () { return pg.textContent('#dlgTitle'); },
    dlgBody: function () { return pg.textContent('#dlgBody'); },
    dlgOpen: function () { return pg.evaluate("document.getElementById('dlg').classList.contains('open')"); },
    opts: function () { return pg.evaluate("[...document.querySelectorAll('#dlgOpts button')].map(b=>b.textContent)"); },
    // 用手指按一個元素：捲到看得見、算出中心、確認 elementFromPoint 打到的就是它，再點那個座標
    finger: async function (finder, what) {
      var r = await pg.evaluate(function (f) {
        var el = (new Function('return (' + f + ')()'))(); if (!el) return { err: '找不到' };
        el.scrollIntoView({ block: 'center', inline: 'center' });
        var b = el.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
        var hit = document.elementFromPoint(x, y);
        // 表世界：被凍結的第一欄蓋住就把表往左捲，讓它露在凍結欄右邊
        var main = el.closest('#smain');
        if (main && !(hit === el || el.contains(hit))) {
          var fz = main.querySelector('td.fz, th.fz'); var fw = fz ? fz.getBoundingClientRect().right : main.getBoundingClientRect().left;
          main.scrollLeft += b.left - fw - 12;
          b = el.getBoundingClientRect(); x = b.left + b.width / 2; y = b.top + b.height / 2; hit = document.elementFromPoint(x, y);
        }
        // 太寬的按鈕：中心超出畫面就按它露在畫面裡的那一段
        if (x > innerWidth - 8) { x = Math.max(b.left + 8, Math.min(innerWidth - 8, b.right - 8)); hit = document.elementFromPoint(x, y); }
        if (!hit || !(hit === el || el.contains(hit))) return { err: '被蓋住：那個位置是 ' + (hit ? hit.tagName + (hit.id ? '#' + hit.id : '') + (hit.className ? '.' + String(hit.className).split(' ')[0] : '') : '空的') };
        return { x: x, y: y };
      }, finder);
      if (r.err) throw new Error('手指按不到 ' + what + '：' + r.err);
      await pg.mouse.click(r.x, r.y); await pg.waitForTimeout(200);
    },
    pick: async function (label) {                       // 按對話框裡以 label 開頭的選項
      var has = await pg.evaluate(function (l) { return [...document.querySelectorAll('#dlgOpts button')].some(function (x) { return x.textContent.indexOf(l) === 0; }); }, label);
      if (!has) throw new Error('對話框沒有選項「' + label + '」，現有：' + (await H.opts()).join('/'));
      await H.finger("function(){ return [...document.querySelectorAll('#dlgOpts button')].find(function (x) { return x.textContent.indexOf(" + JSON.stringify(label) + ") === 0; }); }", '選項「' + label + '」');
    },
    setIn: async function (id, value) { await pg.evaluate(function (a) { var el = document.getElementById(a[0]); el.value = a[1]; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [id, String(value)]); },
    tapScreen: async function (target) {                 // 真的點畫面：target 是物件 id 或 {x,z}（會避開 HUD、轉鏡頭）
      var s = await H.onScreen(target);
      await pg.mouse.click(s.x, s.y); await pg.waitForTimeout(250);
    },
    // 表世界
    toSheet: async function () { if ((await pg.evaluate("APP.view()")) !== 'sheet') { await pg.click('#swapToSheet'); await pg.waitForTimeout(250); } },
    toGame: async function () { if ((await pg.evaluate("APP.view()")) !== 'game') { await pg.click('#swapToGame'); await pg.waitForTimeout(400); } },
    sheet: async function (k, id) { await pg.evaluate("SHEET.navigate('" + k + "'," + (id ? "'" + id + "'" : 'null') + ")"); await pg.waitForTimeout(150); },
    sheetName: function () { return pg.evaluate("SHEET.ui.sheet"); },
    main: function () { return pg.textContent('#smain'); },
    rows: function () { return pg.evaluate("document.querySelectorAll('#smain tr[data-row]').length"); },
    click: async function (sel) { await H.finger("function(){ return document.querySelector(" + JSON.stringify(sel) + "); }", sel); },
    clickText: async function (text) { await H.finger("function(){ return [...document.querySelectorAll('#view-sheet button, #view-sheet a')].find(function (b) { return b.textContent.trim().indexOf(" + JSON.stringify(text) + ") === 0; }); }", '「' + text + '」'); },
    edit: async function (sel, value, checked) {         // 改格子（input/select/checkbox）並觸發 change
      var ok = await pg.evaluate(function (a) { var el = document.querySelector(a[0]); if (!el) return false; if (a[2] != null) el.checked = !!a[2]; else el.value = a[1]; el.dispatchEvent(new Event('change', { bubbles: true })); return true; }, [sel, value == null ? '' : String(value), checked == null ? null : checked]);
      if (!ok) throw new Error('找不到格子 ' + sel); await pg.waitForTimeout(200);
    },
    who: async function (serial) { await H.edit('#view-sheet select[data-ed="who"]', serial); }
  };
  return H;
}
module.exports = { open: open, assert: assert, fails: function () { return fails; } };
