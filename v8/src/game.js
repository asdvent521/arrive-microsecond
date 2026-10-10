/* ===== v8 裡世界：像遊戲 =====
 * 3D 全螢幕；HUD 只有名牌＋能量條、任務提示、切換鈕、倒數。到了建築從底部升起對話框給選項。
 * 只呼叫 APP 和 CORE，不碰 sheet.js。
 */
var GAME = (function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = APP.esc, opt = APP.opt, now = APP.now;
  var S = function () { return APP.state(); }, me = function () { return APP.me(); };
  var cur = { role: null, visiting: false };
  var dec = null, nearObj = null, portalRole = null, toastTimer = null, build = false, guideSteps = null, moving = null;
  var allObjs = APP.allObjs;

  /* ---------- 小工具 ---------- */
  // 吐司要放在對話框上面，不能蓋住對話框的按鈕
  function placeToast() { var dlg = $('dlg'); $('toast').style.bottom = dlg.classList.contains('open') ? (dlg.offsetHeight + 8) + 'px' : ''; }
  function toast(text, keep) {
    var el = $('toast'); el.textContent = text; el.hidden = !text; placeToast();
    clearTimeout(toastTimer); if (!keep && text) toastTimer = setTimeout(function () { el.hidden = true; }, 3200);
  }
  function fmtLife(r) { return CORE.fmtUs(r.life.startUs).slice(0, 10) + ' → ' + CORE.fmtUs(r.life.endUs).slice(0, 10); }
  function bar(ratio) { return '<span class="bar"><i style="width:' + Math.round(Math.max(0, Math.min(1, ratio)) * 100) + '%"></i></span>'; }

  /* ---------- 對話框：標題、內容、選項（像 RPG） ---------- */
  var dlgStack = [];
  function dialog(d) {
    if (!d) { $('dlg').classList.remove('open'); dlgStack = []; placeToast(); return; }
    dlgStack.push(d);
    $('dlgTitle').textContent = d.title || '';
    $('dlgBody').innerHTML = d.body || '';
    $('dlgOpts').innerHTML = (d.opts || []).map(function (o, i) { return '<button type="button" class="btn' + (o.pri ? ' pri' : '') + (o.warn ? ' warn' : '') + '" data-opt="' + i + '">' + esc(o.label) + '</button>'; }).join('') + (dlgStack.length > 1 ? '<button type="button" class="btn" data-opt="back">返回</button>' : '');
    $('dlg').classList.add('open'); placeToast();
    if (d.after) d.after();
  }
  $('dlgOpts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-opt]'); if (!b) return;
    if (b.dataset.opt === 'back') { dlgStack.pop(); var prev = dlgStack.pop(); if (prev) dialog(prev); else dialog(null); return; }
    var d = dlgStack[dlgStack.length - 1], o = d.opts[+b.dataset.opt];
    if (o && o.fn) o.fn();
  });
  $('dlgClose').addEventListener('click', function () { dialog(null); });
  function val(id) { var el = $(id); return el ? el.value : ''; }
  // 做一個動作：成功就吐司、重畫；失敗吐司錯誤
  function act(fn, ok, then) { var r = APP.run(fn, ok); toast(r.msg, !r.ok); if (then) then(r); return r; }

  /* ---------- HUD ---------- */
  function drawPlate() {
    var m = me(), t = now();
    $('plateCode').textContent = m.blank ? '—' : CORE.abbrev(m.serial); $('plateName').textContent = m.name + (cur.visiting ? '　在 ' + cur.role.name + ' 的世界' : '') + (WORLD.depth() ? '　內部第 ' + WORLD.depth() + ' 層' : '');
    var left = CORE.remainingToday(S(), m, t), daily = CORE.dailyPoints(m, t);
    $('energyBar').style.width = (daily ? left / daily * 100 : 0) + '%';
    $('energyText').textContent = '今天還能給 ' + left + ' / ' + daily + ' 點';
    $('btnHome').hidden = !cur.visiting; $('btnLeave').hidden = !WORLD.depth(); $('btnBuild').hidden = cur.visiting;
    $('btnBuild').textContent = build ? '建造中（按一下結束）' : '建造';
    $('task').textContent = APP.steps().hint;
    drawCode();
  }
  function drawCode() {
    if (!dec) return;
    var code = dec.code(), need = dec.need(), on = code || WORLD.guideCount() > 0 || portalRole;
    // 有代號或光點時才顯示，附一個小 ✕ 全部清掉
    $('codeLine').innerHTML = on ? esc(code ? code.split('').join(' ') + (need ? ' ' + '＿'.repeat(need) : '') : '（指引中）') + '<button type="button" class="x" id="codeClear" aria-label="清掉代號">✕</button>' : '';
    if (on) $('codeClear').onclick = clearCode;
  }
  // 把走到一半的代號、繞圈、地上光點、傳送門一起清掉
  function clearCode() {
    dec.reset(); WORLD.resetRings(); guideSteps = null; WORLD.setGuide([]); WORLD.hidePortal(); portalRole = null; arrivedAt = null;
    hint(''); toast(''); drawCode();
  }

  /* ---------- 指引：地上亮出一串光點 ---------- */
  function guideTo(code) {
    var m = me(), rt = CORE.route(m.world.walk, allObjs(m), code);
    if (rt.missing) { toast('走法表走不出 ' + code + '：' + rt.missing, true); WORLD.setGuide([]); guideSteps = null; return false; }
    guideSteps = { code: code, parts: [] };
    // 把路線拆成段：繞圈一段（一圈光點）、每個走到一段（一個光點）
    var circle = m.world.walk.circles.find(function (c) { var n = c.letter.charCodeAt(0) - rt.code.charCodeAt(0) + 1; return /^[A-J]/.test(rt.code) && n >= 1; });
    if (circle) { var o = WORLD.objectAt(circle.object); if (o) { var pts = []; for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; pts.push({ x: o.x + Math.cos(a) * (o.radius + 1.4), z: o.z + Math.sin(a) * (o.radius + 1.4) }); } guideSteps.parts.push({ kind: 'circle', object: circle.object, pts: pts }); } }
    var digits = /^[A-J]/.test(rt.code) ? rt.code.slice(1) : rt.code, at = circle ? circle.object : null;   // 繞完那棟就是起點
    for (var k = 0; k < digits.length; k++) {
      var d = digits[k], mv = m.world.walk.moves.find(function (x) { return x.digit === d && x.from === at; }) || m.world.walk.moves.find(function (x) { return x.digit === d; });
      if (!mv) break;
      if (mv.from !== at) { var f = WORLD.objectAt(mv.from); if (f) guideSteps.parts.push({ kind: 'arrive', object: mv.from, pts: [{ x: f.x, z: f.z + f.radius + 0.8 }] }); }
      var tt = WORLD.objectAt(mv.to); if (tt) guideSteps.parts.push({ kind: 'arrive', object: mv.to, pts: [{ x: tt.x, z: tt.z + tt.radius + 0.8 }] });
      at = mv.to;
    }
    drawGuide(); drawCode();
    toast('照地上的光點走，就走得出 ' + rt.code + '。', false);
    return true;
  }
  function drawGuide() {
    if (!guideSteps) { WORLD.setGuide([]); return; }
    var pts = []; guideSteps.parts.forEach(function (p) { pts = pts.concat(p.pts); });
    WORLD.setGuide(pts);
  }
  // 走完一段就熄一段
  function guideProgress(kind, objectId) {
    if (!guideSteps || !guideSteps.parts.length) return;
    var p = guideSteps.parts[0];
    if (p.kind === kind && p.object === objectId) { guideSteps.parts.shift(); drawGuide(); drawCode(); }
  }

  /* ---------- 到了建築：對話框的選項 ---------- */
  var ver = APP.ver, pend = APP.pend;
  function openNear(o) {
    if (!o) return;
    var r = cur.role, mine = !cur.visiting, f = CORE.FUNCS[o.func] || CORE.FUNCS.none, v = ver(r), p = pend(r);
    var title = '這裡是' + f.label + '：' + o.name;
    if (build && mine) return buildDialog(o);
    var opts = [];
    var circ = mine && r.world.walk.circles.find(function (c) { return c.object === o.id; });
    if (circ) opts.push({ label: '繞一圈（' + circ.letter + '）', fn: function () { dialog(null); WORLD.circleAround(o.id); } });
    if (o.func === 'rule') {
      opts.push({ label: '閱讀規則', pri: true, fn: function () { readRules(r, 0); } });
      if (!mine && v.rules.village && CORE.acceptState(S(), me().serial, r, now()) !== 'current') opts.push({ label: '接受村規', fn: function () { act(function () { CORE.accept(S(), me().serial, r.serial, now()); }, '你接受了 ' + r.name + ' 的村規'); openNear(o); } });
      if (mine) opts.push({ label: '改規則（明天起）', fn: function () { editRules(); } });
      dialog({ title: title, body: mine ? '這是你的規則屋。今天的規則整天不變，改的是明天起的版本。' + (p ? '\n明天起的版本已經寫了一份。' : '') : '走進一個人的世界，看得見他的規則。' + (p ? '\n他明天起會改規則，今天就看得到。' : ''), opts: opts });
    } else if (o.func === 'resource') {
      if (mine) { opts.push({ label: '補貨、減貨', pri: true, fn: function () { stockDialog(); } }); opts.push({ label: '上架、改價格（明天起）', fn: function () { editResources(); } }); }
      else opts.push({ label: '看商店', pri: true, fn: function () { shop(r); } });
      dialog({ title: title, body: resText(r), opts: opts });
    } else if (o.func === 'goal') {
      if (mine) { opts.push({ label: '開時段', pri: true, fn: function () { addSlotDialog(); } }); opts.push({ label: '看預約、選我要的', fn: function () { mySlots(); } }); }
      else {
        var e = CORE.eligible(S(), r, me(), now());
        opts.push({ label: '時刻表', pri: true, fn: function () { timetable(r); } });
        dialog({ title: title, body: slotsText(r) + '\n' + (e.ok ? '條件通（' + e.how + '），可以預約。' : '條件不通：' + e.reason), opts: opts });
        return;
      }
      dialog({ title: title, body: slotsText(r), opts: opts });
    } else if (o.func === 'role') {
      var body = '每天 ' + v.dailyPoints + ' ' + r.name + '點' + (p && p.dailyPoints !== v.dailyPoints ? '（明天起 ' + p.dailyPoints + '）' : '') + '\n換點比例（給出：收到）' + CORE.ratio(S(), r.serial).text + '\n對接過 ' + CORE.dockCount(S(), r.serial) + ' 次　可換的貨 ' + CORE.availTotal(r, now()) + ' 份' + (!mine && CORE.contactVisible(S(), r, me().serial) && r.contact ? '\n聯絡方式：' + r.contact : '');
      if (mine) {
        opts.push({ label: '改每天的點（明天起）', fn: function () { dailyDialog(); } });
        opts.push({ label: '歷史紀錄', fn: history });
        opts.push({ label: '換人（測試用）', fn: switchRole });
        opts.push({ label: '不玩了', warn: true, fn: confirmQuit });
      }
      dialog({ title: title, body: body, opts: opts });
    } else if (o.func === 'points') {
      if (!mine) { dialog({ title: title, body: '帳房只有主人看得到。', opts: [] }); return; }
      var hs = CORE.holdings(S(), me().serial, now());
      APP.tutEvent('sawPoints');
      dialog({ title: '背包：' + o.name, body: (hs.length ? hs.map(function (g) { return '・' + (g.issuer ? g.issuer.name : '？') + '點 ' + g.hold.price + '　「' + g.hold.name + '」　' + g.untilText; }).join('\n') : '手上沒有別人的點。') + '\n今天還能給 ' + CORE.remainingToday(S(), me(), now()) + ' 點', opts: uniqIssuers(hs).map(function (iss) { return { label: '去 ' + iss.name + ' 的市集兌現', fn: function () { shop(iss); } }; }) });
    } else dialog({ title: title, body: '純地標，用來走代號。', opts: [] });
    if (o.door) { var open = o.door.visible !== 'self' || mine; var cur0 = dlgStack[dlgStack.length - 1]; cur0.body += '\n' + (open ? '有一扇門。' : '有一扇門，關著。'); if (open && WORLD.depth() < 3) cur0.opts.push({ label: '進門', fn: function () { dialog(null); if (WORLD.enter(o.id)) { WORLD.flash(); drawPlate(); } } }); dialog(cur0); dlgStack.pop(); }
  }
  function uniqIssuers(hs) { var seen = {}, out = []; hs.forEach(function (g) { if (g.issuer && !seen[g.issuer.serial]) { seen[g.issuer.serial] = true; out.push(g.issuer); } }); return out; }
  function keepText(x) { return x.keepDays == null ? '一直保留' : '保留 ' + x.keepDays + ' 天'; }
  // 明天起這一項有什麼改動（沒改就空）
  function resChange(x, p) {
    if (!p) return '';
    var y = CORE.resourceOf(p, x.id); if (!y) return '明天起下架';
    var out = [];
    if (y.price !== x.price) out.push('明天起 ' + y.price + ' 點');
    if (y.keepDays !== x.keepDays) out.push('明天起' + (y.keepDays == null ? '一直保留' : '保留 ' + y.keepDays + ' 天'));
    if (y.name !== x.name) out.push('明天起改名「' + y.name + '」');
    if ((y.def || '') !== (x.def || '')) out.push('明天起定義改為「' + y.def + '」');
    return out.join('、');
  }
  function resText(r) {
    var v = ver(r), p = pend(r), mine = r === me();
    var lines = v.resources.map(function (x) { var st = CORE.stockOf(r, x.id), ch = resChange(x, p); return '・' + x.name + '　' + x.price + ' 點　可換 ' + st.avail + (mine ? '　已保留 ' + st.reserved : '') + '　' + keepText(x) + (ch ? '　【' + ch + '】' : ''); });
    if (p) p.resources.forEach(function (y) { if (!CORE.resourceOf(v, y.id)) lines.push('・' + y.name + '　' + y.price + ' 點　' + keepText(y) + '　【明天起新增】'); });
    return lines.length ? lines.join('\n') : '（沒有上架的東西）';
  }
  function slotsText(r) {
    var up = r.slots.filter(function (s) { return s.atUs >= now(); }).sort(function (a, b) { return a.atUs - b.atUs; });
    return up.length ? up.slice(0, 4).map(function (s) { return '・' + CORE.fmtUs(s.atUs).slice(5, 19) + '　名額 ' + s.bookings.length + '/' + s.capacity + (s.together ? '　【一起成交】' : '') + (s.bookings.indexOf(me().serial) >= 0 ? '（你預約了）' : ''); }).join('\n') : '沒有開放的對接時段。';
  }
  // 閱讀規則：分頁翻（用途 → 條件 → 開關與村規）；有明天起的版本就一起標
  function readRules(r, page) {
    var v = ver(r), p = pend(r), ru = v.rules, pr = p ? p.rules : null, pages = [];
    var diff = function (a, b) { return pr && JSON.stringify(a) !== JSON.stringify(b); };
    pages.push({ t: '我的點能做什麼', b: (ru.uses.length ? ru.uses.map(function (u) { return '・' + u; }).join('\n') : '（沒寫）') + (diff(ru.uses, pr && pr.uses) ? '\n\n明天起：\n' + (pr.uses.length ? pr.uses.map(function (u) { return '・' + u; }).join('\n') : '（沒寫）') : '') });
    var condBody = ru.conditions.length ? ru.conditions.map(function (c) { var ok = cur.visiting ? CORE.passes(S(), { versions: [{ fromDay: -1e9, rules: { conditions: [c] } }] }, me(), now()).ok : null; return '・' + CORE.condText(c) + (ok == null ? '' : ok ? '　✓ 我通' : '　✗ 我不通'); }).join('\n') : '（沒有條件，誰都通）';
    if (diff(ru.conditions, pr && pr.conditions)) condBody += '\n\n明天起：\n' + (pr.conditions.length ? pr.conditions.map(function (c) { return '・' + CORE.condText(c); }).join('\n') : '（沒有條件）');
    if (cur.visiting) { var e = CORE.eligible(S(), r, me(), now()); condBody += '\n\n' + (e.ok ? '可以對接（' + e.how + '）' : '不能對接：' + e.reason); }
    pages.push({ t: '對接條件', b: condBody });
    var sw = function (x) { return '要求兩方都通：' + (x.bothMustPass ? '開' : '關') + '\n對方要先接受我的村規：' + (x.mustAcceptVillage ? '開' : '關') + '\n村規：' + (x.village || '（沒有）'); };
    var ast = cur.visiting && ru.village ? CORE.acceptState(S(), me().serial, r, now()) : null;
    pages.push({ t: '開關與村規', b: sw(ru) + (ru.village ? '\n（誰寫的誰解釋）' + (ast ? (ast === 'current' ? '\n你已接受' : ast === 'old' ? '\n你接受的是舊版村規，要重新接受' : '\n你還沒接受') : '') : '') + (pr && sw(pr) !== sw(ru) ? '\n\n明天起：\n' + sw(pr) : '') + (CORE.villageChanges(r, now()) ? '\n明天起村規改了，到時候要重新接受' : '') });
    var pg = pages[page], opts = [];
    if (page > 0) opts.push({ label: '上一頁', fn: function () { dlgStack.pop(); readRules(r, page - 1); } });
    if (page < pages.length - 1) opts.push({ label: '下一頁', pri: true, fn: function () { dlgStack.pop(); readRules(r, page + 1); } });
    if (page === 2 && ast && ast !== 'current') opts.push({ label: '接受村規', pri: true, fn: function () { act(function () { CORE.accept(S(), me().serial, r.serial, now()); }, '你接受了 ' + r.name + ' 的村規'); dlgStack.pop(); readRules(r, 2); } });
    dialog({ title: r.name + ' 的規則 ' + (page + 1) + '/3：' + pg.t, body: pg.b, opts: opts });
  }
  // 商店：看價錢、可換、保留幾天；兌現自己保留著的那幾筆
  function shop(r) {
    var hs = CORE.holdings(S(), me().serial, now()).filter(function (g) { return g.hold.issuer === r.serial; });
    dialog({ title: r.name + ' 的商店', body: resText(r) + '\n\n你保留著 ' + hs.length + ' 筆：' + (hs.length ? hs.map(function (g) { return '「' + g.hold.name + '」' + g.hold.price + ' 點，' + g.untilText; }).join('；') : '（沒有）'),
      opts: hs.map(function (g) { return { label: '兌現「' + g.hold.name + '」（' + g.hold.price + ' 點）', pri: true, fn: function () { act(function () { CORE.redeem(S(), me().serial, g.hold.id, now()); }, '換到了：' + g.hold.name); dlgStack.pop(); shop(r); } }; }) });
  }
  // 時刻表：看時段、預約；預約了就選要換主人的什麼
  function timetable(r) {
    var e = CORE.eligible(S(), r, me(), now());
    var up = r.slots.filter(function (s) { return s.atUs > now(); }).sort(function (a, b) { return a.atUs - b.atUs; });
    dialog({ title: r.name + ' 的時刻表', body: (e.ok ? '條件通（' + e.how + '）' : '條件不通：' + e.reason) + (up.length ? '' : '\n沒有開放的時段。'),
      opts: up.map(function (s) { var booked = s.bookings.indexOf(me().serial) >= 0, full = s.bookings.length >= s.capacity; return { label: CORE.fmtUs(s.atUs).slice(11, 19) + '　' + s.bookings.length + '/' + s.capacity + (s.together ? '　一起成交' : '') + (booked ? '　已預約：選我要的' : full ? '　滿了' : '　預約'), pri: e.ok && !booked && !full, fn: function () { if (booked) return chooseWants(s, r.serial, function () { dlgStack.pop(); timetable(r); }); act(function () { CORE.book(S(), me().serial, s.id, now()); }, '預約好了：' + CORE.fmtUs(s.atUs).slice(11, 19) + '。先選要換他的什麼' + (r.contact ? '。聯絡方式：' + r.contact : '')); dlgStack.pop(); chooseWants(s, r.serial, function () { dlgStack.pop(); timetable(r); }); } }; }) });
  }
  // 選「我要他的哪些東西」（點東西選，顯示價錢和合計）
  function chooseWants(slot, otherSerial, back) {
    var other = APP.roleOf(otherSerial), v = CORE.version(other, slot.atUs), picked = CORE.wantsValid(S(), slot, me().serial, otherSerial).slice();
    var total = function () { return picked.reduce(function (s, id) { var x = CORE.resourceOf(v, id); return s + (x ? x.price : 0); }, 0); };
    var body = '<div class="list">' + v.resources.map(function (x) { var st = CORE.stockOf(other, x.id), n = picked.filter(function (id) { return id === x.id; }).length; return '<div class="item"><span>' + esc(x.name) + '　' + x.price + ' 點　可換 ' + st.avail + '　' + esc(keepText(x)) + '</span><span><button type="button" class="btn sm" data-want-sub="' + x.id + '"' + (n ? '' : ' disabled') + '>−</button> <b id="wn_' + x.id + '">' + n + '</b> <button type="button" class="btn sm" data-want-add="' + x.id + '">＋</button></span></div>'; }).join('') + '</div><div class="num">合計 <b id="wantTotal">' + total() + '</b> ' + esc(other.name) + '點</div>' + (CORE.goneText(S(), slot, me().serial, otherSerial) ? '<div class="small muted">' + esc(CORE.goneText(S(), slot, me().serial, otherSerial)) + '</div>' : '');
    dialog({ choosing: true, title: '我要 ' + other.name + ' 的什麼？', body: body, opts: [{ label: '存好', pri: true, fn: function () { act(function () { CORE.setWants(S(), slot.id, me().serial, otherSerial, picked); }, '選好了：合計 ' + total() + ' 點'); if (back) back(); else dialog(null); } }],
      after: function () {
        var redo = function () { dlgStack.pop(); var cur0 = picked; chooseWants(slot, otherSerial, back); };
        $('dlgBody').querySelectorAll('[data-want-add]').forEach(function (b) { b.onclick = function () { picked.push(b.dataset.wantAdd); CORE.setWants(S(), slot.id, me().serial, otherSerial, picked); APP.changed(); redo(); }; });
        $('dlgBody').querySelectorAll('[data-want-sub]').forEach(function (b) { b.onclick = function () { var i = picked.indexOf(b.dataset.wantSub); if (i >= 0) picked.splice(i, 1); CORE.setWants(S(), slot.id, me().serial, otherSerial, picked); APP.changed(); redo(); }; });
      } });
  }
  // 自己的終點：開時段（名額、每人最多給多少點）
  function addSlotDialog() {
    dialog({ title: '開對接時段', body: '<div class="field">幾分鐘後 <input type="number" id="gSlotMin" value="3" min="1"></div><div class="field">名額 <input type="number" id="gSlotCap" value="1" min="1"></div><div class="field">每人最多給多少點（空白＝當天剩下的） <input type="number" id="gSlotMax" value="" min="0" placeholder="當天剩下的"></div><div class="field"><label><input type="checkbox" id="gSlotTogether"> 一起成交</label><span class="small muted">　有選東西的每一對都成才全部成交，有一對不成整個時段都不成交。開了就不能改，要改就刪掉重開。</span></div>',
      opts: [{ label: '開', pri: true, fn: function () { act(function () { CORE.addSlot(S(), me().serial, now() + (+val('gSlotMin') || 1) * 60e6 + Math.floor(Math.random() * 1000), val('gSlotCap'), val('gSlotMax'), now(), $('gSlotTogether').checked); }, '開了時段'); dialog(null); } }] });
  }
  // 看預約：每個時段、誰預約了；替每個預約的人選「我要他的什麼」
  function mySlots() {
    var m = me(), opts = [], lines = [];
    m.slots.slice().sort(function (a, b) { return a.atUs - b.atUs; }).forEach(function (s) {
      var miss = s.together && !s.judged ? CORE.togetherMissing(S(), s) : [];
      lines.push('・' + CORE.fmtUs(s.atUs).slice(5, 19) + '　' + s.bookings.length + '/' + s.capacity + (s.together ? '　【一起成交】' : '') + '　每人最多給 ' + (s.maxGive[m.serial] != null ? s.maxGive[m.serial] : '當天剩下的') + (s.bookings.length ? '　預約：' + s.bookings.map(function (b) { var rb = APP.roleOf(b); return (rb ? rb.name : b) + (s.docked.indexOf(b) >= 0 ? '（已對接）' : CORE.missed(s, b) ? '（錯過）' : '，他要我的 ' + CORE.wantTotal(S(), s, b, m.serial) + ' 點，我要他的 ' + CORE.wantTotal(S(), s, m.serial, b) + ' 點'); }).join('、') : '') + (miss.length ? '\n　一起成交：' + miss.join('；') : ''));
      if (!s.judged) s.bookings.forEach(function (b) { var rb = APP.roleOf(b); if (rb) opts.push({ label: CORE.fmtUs(s.atUs).slice(11, 16) + ' 我要 ' + rb.name + ' 的什麼', fn: function () { chooseWants(s, b, function () { dlgStack.pop(); mySlots(); }); } }); });
      if (!s.judged && s.atUs > now() && !s.bookings.length) opts.push({ label: '刪 ' + CORE.fmtUs(s.atUs).slice(11, 16) + ' 的時段', warn: true, fn: function () { act(function () { CORE.deleteSlot(S(), m.serial, s.id, now()); }, '刪了時段'); dlgStack.pop(); mySlots(); } });
    });
    dialog({ title: '我開的時段', body: lines.length ? lines.join('\n') : '還沒開時段。', opts: opts });
  }
  // 補貨、減貨（馬上）
  function stockDialog() {
    var m = me(), v = ver(m);
    var body = v.resources.length ? '可換的隨時加減；已保留的不能減。<div class="list">' + v.resources.map(function (x) { var st = CORE.stockOf(m, x.id); return '<div class="item"><span>' + esc(x.name) + '（可換 ' + st.avail + '，已保留 ' + st.reserved + '）</span><span><input type="number" class="kc" data-stock-n="' + x.id + '" value="1" min="1" style="width:5em" aria-label="數量"> <button type="button" class="btn sm" data-stock-add="' + x.id + '">補</button> <button type="button" class="btn sm" data-stock-sub="' + x.id + '">減</button></span></div>'; }).join('') + '</div>' : '沒有資源。先上架（明天起）。';
    dialog({ title: '補貨、減貨', body: body, opts: [], after: function () {
      var n = function (id) { return Math.floor(+$('dlgBody').querySelector('[data-stock-n="' + id + '"]').value) || 0; };
      $('dlgBody').querySelectorAll('[data-stock-add]').forEach(function (b) { b.onclick = function () { var k = n(b.dataset.stockAdd); act(function () { CORE.restock(S(), m.serial, b.dataset.stockAdd, k); }, '補了 ' + k + ' 份'); dlgStack.pop(); stockDialog(); }; });
      $('dlgBody').querySelectorAll('[data-stock-sub]').forEach(function (b) { b.onclick = function () { var k = n(b.dataset.stockSub); act(function () { CORE.restock(S(), m.serial, b.dataset.stockSub, -k); }, '減了 ' + k + ' 份'); dlgStack.pop(); stockDialog(); }; });
    } });
  }
  // 上架、改價格和保留天數、下架：改的是明天起的版本
  function editResources() {
    var m = me(), v = CORE.tomorrow(S(), m.serial, now());
    var body = '<div class="list">' + v.resources.map(function (x, i) { return '<div class="item"><span><input type="text" data-rn="' + i + '" value="' + esc(x.name) + '" style="width:7em"> 價 <input type="number" data-rp="' + i + '" value="' + x.price + '" style="width:4em"> 保留 <input type="number" data-rk="' + i + '" value="' + (x.keepDays == null ? '' : x.keepDays) + '" placeholder="一直" style="width:4em"> 天</span><button type="button" class="btn sm" data-del-res="' + i + '">下架</button></div>'; }).join('') + '</div><div class="field"><input type="text" id="wResName" placeholder="新東西" style="width:7em"> 價格 <input type="number" id="wResPrice" value="60" min="1" style="width:4em"> 保留 <input type="number" id="wResKeep" value="" placeholder="一直" style="width:4em"> 天 <button type="button" class="btn sm" id="wAddRes">上架</button></div>';
    var save = function () { v.resources.forEach(function (x, i) { var f = { name: $('dlgBody').querySelector('[data-rn="' + i + '"]').value, price: $('dlgBody').querySelector('[data-rp="' + i + '"]').value, keepDays: $('dlgBody').querySelector('[data-rk="' + i + '"]').value }; CORE.setResource(S(), m.serial, x.id, f, now()); }); };
    dialog({ title: '資源（明天起）', body: body, opts: [{ label: '存', pri: true, fn: function () { var r = act(function () { save(); }, '存了，明天起生效'); if (r.ok) dialog(null); } }],
      after: function () {
        $('wAddRes').onclick = function () { var r = act(function () { save(); CORE.addResource(S(), m.serial, { name: val('wResName'), price: val('wResPrice'), keepDays: val('wResKeep') }, now()); }, '上架了，明天起'); if (r.ok) { dlgStack.pop(); editResources(); } };
        $('dlgBody').querySelectorAll('[data-del-res]').forEach(function (b) { b.onclick = function () { act(function () { CORE.removeResource(S(), m.serial, v.resources[+b.dataset.delRes].id, now()); }, '明天起下架'); dlgStack.pop(); editResources(); }; });
      } });
  }
  // 改規則：改的是明天起的版本
  function editRules() {
    var m = me(), v = CORE.tomorrow(S(), m.serial, now()), ru = v.rules;
    var body = '<b>我的點能做什麼</b><div class="list">' + ru.uses.map(function (u, i) { return '<div class="item"><span>' + esc(u) + '</span><button type="button" class="btn sm" data-del-use="' + i + '">刪</button></div>'; }).join('') + '</div><div class="field"><input type="text" id="wUse" placeholder="例如：1 我點 = 陪跑 1 分鐘"> <button type="button" class="btn sm" id="wAddUse">加一條</button></div>' +
      '<b>對接條件</b><div class="list">' + ru.conditions.map(function (c, i) { return '<div class="item"><span>' + esc(CORE.condText(c)) + '</span><button type="button" class="btn sm" data-del-cond="' + i + '">刪</button></div>'; }).join('') + '</div><div class="field"><select id="wField">' + Object.keys(CORE.COND_FIELDS).map(function (k) { return opt(k, CORE.COND_FIELDS[k].label, 'avail'); }).join('') + '</select> <select id="wOp">' + Object.keys(CORE.OPS).map(function (o) { return opt(o, CORE.OPS[o], '>='); }).join('') + '</select> <input type="number" id="wVal" value="1" style="width:6em"> <button type="button" class="btn sm" id="wAddCond">加一條</button></div>' +
      '<b>開關與村規</b><div class="field"><label><input type="checkbox" id="wBoth"' + (ru.bothMustPass ? ' checked' : '') + '> 要求兩方都通</label><label><input type="checkbox" id="wVill"' + (ru.mustAcceptVillage ? ' checked' : '') + '> 對方一定要接受我的村規</label><textarea id="wVillage" placeholder="村規（自由文字，誰寫的誰解釋）">' + esc(ru.village) + '</textarea></div>';
    var save = function () { ru.bothMustPass = $('wBoth').checked; ru.mustAcceptVillage = $('wVill').checked; ru.village = val('wVillage'); APP.changed(); };
    dialog({ title: '規則（明天起）', body: body, opts: [{ label: '存', pri: true, fn: function () { save(); dialog(null); toast('存了，明天起生效'); } }],
      after: function () {
        $('wAddUse').onclick = function () { var t = val('wUse').trim(); if (!t) return; ru.uses.push(t); save(); dlgStack.pop(); editRules(); };
        $('wAddCond').onclick = function () { ru.conditions.push({ field: val('wField'), op: val('wOp'), value: +val('wVal') || 0 }); save(); dlgStack.pop(); editRules(); };
        $('dlgBody').querySelectorAll('[data-del-use]').forEach(function (b) { b.onclick = function () { ru.uses.splice(+b.dataset.delUse, 1); save(); dlgStack.pop(); editRules(); }; });
        $('dlgBody').querySelectorAll('[data-del-cond]').forEach(function (b) { b.onclick = function () { ru.conditions.splice(+b.dataset.delCond, 1); save(); dlgStack.pop(); editRules(); }; });
      } });
  }
  function dailyDialog() {
    var m = me(), v = ver(m), p = pend(m);
    dialog({ title: '每天的點（明天起）', body: '今天 ' + v.dailyPoints + ' 點' + (p && p.dailyPoints !== v.dailyPoints ? '，明天起 ' + p.dailyPoints : '') + '<br><input type="number" id="wDaily" value="' + (p ? p.dailyPoints : v.dailyPoints) + '" min="1">', opts: [{ label: '存', pri: true, fn: function () { var r = act(function () { CORE.setDailyPoints(S(), m.serial, val('wDaily'), now()); }, '明天起生效'); if (r.ok) dialog(null); } }] });
  }
  function history() {
    var m = me(), lines = S().records.filter(function (x) { return x.text.indexOf(CORE.abbrev(m.serial)) >= 0 || x.text.indexOf(m.name) >= 0; }).slice(-8).reverse().map(function (x) { return '・' + x.text; });
    dialog({ title: '歷史紀錄', body: '對接 ' + CORE.dockCount(S(), m.serial) + ' 次　換點比例 ' + CORE.ratio(S(), m.serial).text + '\n' + (lines.length ? lines.join('\n') : '還沒有紀錄。'), opts: [] });
  }
  function switchRole() {
    dialog({ title: '換人（測試用）', body: '我是誰？', opts: S().roles.map(function (r, i) { return { label: CORE.abbrev(r.serial) + ' ' + r.name + (r === me() ? '（現在）' : ''), pri: r === me(), fn: function () { dialog(null); APP.becomeMe(i); } }; }) });
  }
  function confirmQuit() {
    var m = me(), bl = CORE.quitBlockers(S(), m.serial, now());
    dialog({ title: '不玩了', body: '刪掉 ' + m.name + '。' + (bl.length ? '還有 ' + bl.length + ' 筆你的點沒換（' + bl.map(function (h) { return CORE.abbrev(h.holder) + '「' + h.name + '」'; }).join('、') + '），會作廢；單機版持有人都在本機，視為同意。' : '沒有人拿著你的點。'), opts: [{ label: '確定不玩了', warn: true, fn: function () { act(function () { APP.quit(m.serial); }, '角色刪掉了'); dialog(null); } }] });
  }

  /* ---------- 建造模式：點物件 → 換外觀、換顏色、搬移、門、刪除、走法；新增地標 ---------- */
  function setBuild(on) {
    build = on; drawPlate(); hint('');
    WORLD.setTapHook(on ? function (hit) {
      if (moving) { if (hit.point) { act(function () { moving.pos = [Math.round(hit.point.x), Math.round(hit.point.z)]; WORLD.refreshObject(moving.id); }, '放下了'); moving = null; } return true; }
      if (hit.object) { buildDialog(hit.object); return true; }
      return false;
    } : null);
    if (!on) { moving = null; dialog(null); }
    toast(on ? '建造模式：點物件改它；點「新增地標」放新的。' : '結束建造', false);
  }
  function buildDialog(o) {
    var m = me(), w = m.world;
    dialog({ title: '建造：' + o.name + '（' + CORE.FUNCS[o.func].label + '）', body: '',
      opts: [
        { label: '換外觀', fn: function () { dialog({ title: '換外觀', body: '', opts: Object.keys(CORE.LOOKS).map(function (k) { return { label: k, pri: o.look === k, fn: function () { act(function () { o.look = k; o.parts = CORE.look(k, o.parts[0] ? o.parts[0].color : '#999999'); WORLD.refreshObject(o.id); }, '換成' + k); dlgStack.pop(); dlgStack.pop(); buildDialog(o); } }; }) }); } },
        { label: '換顏色', fn: function () { dialog({ title: '換顏色', body: '<input type="color" id="bColor" value="' + (o.parts[0] ? o.parts[0].color : '#999999') + '">', opts: [{ label: '確定', pri: true, fn: function () { var c = val('bColor'); act(function () { if (o.look) o.parts = CORE.look(o.look, c); else if (o.parts[0]) o.parts[0].color = c; WORLD.refreshObject(o.id); }, '換了顏色'); dialog(null); } }] }); } },
        { label: '搬移', fn: function () { moving = o; dialog(null); toast('點地面，放在那裡。', true); } },
        { label: o.door ? '拿掉門' : '加門', fn: function () { act(function () { if (o.door) delete o.door; else o.door = { visible: 'all', start: [0, 4], objects: [] }; WORLD.refreshObject(o.id); }, o.door ? '加了門' : '拿掉了門'); dlgStack.pop(); buildDialog(o); } },
        { label: '設定走法', fn: function () { walkDialog(o); } },
        { label: '刪除', warn: true, fn: function () { act(function () { if (w.objects.length <= 1) throw new Error('至少留一個物件'); w.objects = w.objects.filter(function (x) { return x.id !== o.id; }); w.walk.circles = w.walk.circles.filter(function (c) { return c.object !== o.id; }); w.walk.moves = w.walk.moves.filter(function (x) { return x.from !== o.id && x.to !== o.id; }); WORLD.loadWorld(w); dec = new CORE.Decoder(w.walk); }, '刪掉了，用到它的走法也一起刪'); dialog(null); } }
      ] });
  }
  function walkDialog(o) {
    var m = me(), w = m.world, c = w.walk.circles.find(function (x) { return x.object === o.id; });
    var others = allObjs(m).filter(function (x) { return x.id !== o.id; });
    var body = '繞 ' + o.name + ' 一圈是：<select id="bLetter">' + opt('', '（不設）', c ? c.letter : '') + 'JIHGFEDCBA'.split('').map(function (L) { return opt(L, L, c ? c.letter : ''); }).join('') + '</select>' +
      '<br>從 ' + o.name + ' 走到 <select id="bTo">' + others.map(function (x) { return opt(x.id, x.name, others[0].id); }).join('') + '</select> 是數字 <select id="bDigit">' + '0123456789'.split('').map(function (d) { return opt(d, d, '1'); }).join('') + '</select>' +
      (w.walk.moves.filter(function (x) { return x.from === o.id; }).length ? '<div class="list">' + w.walk.moves.map(function (x, i) { return x.from === o.id ? '<div class="item"><span>→ ' + esc((allObjs(m).find(function (y) { return y.id === x.to; }) || {}).name || x.to) + ' = ' + x.digit + '</span><button type="button" class="btn sm" data-del-move="' + i + '">刪</button></div>' : ''; }).join('') + '</div>' : '');
    dialog({ title: '走法：' + o.name, body: body, opts: [
      { label: '存繞圈', pri: true, fn: function () { var L = val('bLetter'); act(function () { w.walk.circles = w.walk.circles.filter(function (x) { return x.object !== o.id; }); if (L) w.walk.circles.push({ object: o.id, letter: L }); dec = new CORE.Decoder(w.walk); }, L ? '繞一圈是 ' + L : '拿掉繞圈'); dlgStack.pop(); walkDialog(o); } },
      { label: '加走到', fn: function () { act(function () { w.walk.moves.push({ from: o.id, to: val('bTo'), digit: val('bDigit') }); dec = new CORE.Decoder(w.walk); }, '加了走到'); dlgStack.pop(); walkDialog(o); } }
    ], after: function () { $('dlgBody').querySelectorAll('[data-del-move]').forEach(function (b) { b.onclick = function () { act(function () { w.walk.moves.splice(+b.dataset.delMove, 1); dec = new CORE.Decoder(w.walk); }, '刪了'); dlgStack.pop(); walkDialog(o); }; }); } });
  }
  function addLandmark() {
    var m = me();
    dialog({ title: '新增地標', body: '<input type="text" id="bName" placeholder="名稱"> <select id="bLook">' + Object.keys(CORE.LOOKS).map(function (k) { return opt(k, k, '山'); }).join('') + '</select>', opts: [{ label: '放在我腳邊', pri: true, fn: function () { var n = val('bName').trim(); if (!n) return toast('先寫名稱', true); var p = WORLD.playerPos(); act(function () { m.world.objects.push({ id: 'o' + Date.now().toString(36), name: n, func: 'none', pos: [Math.round(p.x) + 3, Math.round(p.z)], look: val('bLook'), parts: CORE.look(val('bLook'), '#8A8F96') }); WORLD.loadWorld(m.world); }, '放了 ' + n); dialog(null); } }] });
  }

  /* ---------- 地圖：所有角色排成一張圖，一方通的亮 ---------- */
  function showMap() {
    var m = me(), t = now();
    $('map').innerHTML = '<h3>地圖：誰和我一方通</h3><div class="grid">' + S().roles.map(function (r) {
      if (r === m) return '<button type="button" class="node" disabled><b>' + esc(CORE.abbrev(r.serial) + ' ' + r.name) + '</b><span class="small">這是我</span></button>';
      var e = CORE.eligible(S(), r, m, t), s = CORE.nextSlot(r, t);
      return '<button type="button" class="node' + (e.ok ? '' : ' dim') + '" data-go="' + CORE.abbrev(r.serial) + '"><b>' + esc(CORE.abbrev(r.serial) + ' ' + r.name) + '</b><span class="small">' + (e.ok ? '✓ ' + esc(e.how) : '✗ 不通') + '</span><span class="small">每天 ' + CORE.dailyPoints(r, t) + '・' + (s ? '最近 ' + CORE.fmtUs(s.atUs).slice(11, 16) : '沒時段') + '</span></button>';
    }).join('') + '</div><div class="field" style="margin-top:12px">查資源 <input type="text" id="mapKw" placeholder="關鍵字" style="min-height:34px;padding:4px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg)"> <button type="button" class="btn sm" id="mapSearch">查</button><div id="mapRes" class="small"></div></div><p style="margin-top:12px"><button type="button" class="btn" id="mapClose">關閉</button></p>';
    $('map').hidden = false;
    $('map').querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { $('map').hidden = true; APP.setFocus({ role: CORE.expand(b.dataset.go), func: 'map' }); if (cur.visiting) goHome(); guideTo(b.dataset.go); }; });
    $('mapClose').onclick = function () { $('map').hidden = true; };
    $('mapSearch').onclick = function () { var kw = val('mapKw'); var rs = CORE.searchResources(S(), kw, t).filter(function (x) { return x.role !== m; }); $('mapRes').innerHTML = rs.length ? rs.map(function (x) { return '・' + esc(x.resource.name) + '　' + x.resource.price + ' ' + esc(x.role.name) + '點（可換 ' + x.stock.avail + '）<button type="button" class="lk" data-go2="' + CORE.abbrev(x.role.serial) + '">走過去</button>'; }).join('<br>') : '沒有符合的資源。'; $('mapRes').querySelectorAll('[data-go2]').forEach(function (b) { b.onclick = function () { $('map').hidden = true; APP.setFocus({ role: CORE.expand(b.dataset.go2), func: 'resource' }); if (cur.visiting) goHome(); guideTo(b.dataset.go2); }; }); };
  }

  /* ---------- 傳送、回家 ---------- */
  function openPortal(code) {
    var role = CORE.findRole(S(), code);
    if (!role || role === me()) { toast(role === me() ? code + ' 是自己，走別人的代號' : '沒有 ' + code + ' 這個角色', true); setTimeout(function () { dec.reset(); WORLD.resetRings(); drawCode(); toast(''); }, 2200); return; }
    portalRole = role; WORLD.showPortal('傳送門 → ' + role.name + '（' + code + '）'); WORLD.setGuide([]); guideSteps = null; drawCode();
    toast('走出了 ' + code + '，傳送門打開了。', true);
    hint('傳送門 → ' + role.name, null, [{ id: 'hintEnter', label: '進去', fn: function () { hint(''); if (portalRole) teleport(portalRole); } }], true);
  }
  function teleport(role) {
    var chk = CORE.tryClean(role);
    if (chk.error) { toast(role.name + ' 的資料不是純資料（' + chk.error + '），不載入。', true); WORLD.hidePortal(); portalRole = null; return; }
    cur = { role: role, visiting: true }; portalRole = null; dialog(null); hint('');
    WORLD.flash(); WORLD.loadWorld(chk.role.world, { visiting: true });
    if (CORE.isGuide(role.serial)) APP.tutEvent('foundGuide');
    APP.setFocus({ role: role.serial, func: null });
    drawPlate(); toast('到了 ' + role.name + ' 的世界。走到建築旁邊看看。', false);
  }
  function goHome() {
    if (cur.visiting) WORLD.flash();
    cur = { role: me(), visiting: false }; dialog(null); WORLD.showPartner(false);
    dec.reset(); WORLD.resetRings(); WORLD.loadWorld(me().world); APP.setStanding(null); APP.setFocus({ role: me().serial, func: null }); drawPlate(); toast('');
  }

  /* ---------- 世界事件 ---------- */
  // 走代號中（已走出字母或數字，或地上有指引光點）：到建築不自動升對話框，只在上方跳一行小字
  function codeMode() { return !cur.visiting && ((dec && dec.code() !== '') || WORLD.guideCount() > 0); }
  var arrivedAt = null, hintSticky = false;
  // 上方一行小字，留到走開為止；字那一塊讓手指點穿過去，只有按鈕接得到。sticky（傳送門）走開也留著，進門或按 ✕ 才清
  function hint(text, o, extra, sticky) {
    var el = $('hint');
    if (!text) { if (sticky === false && hintSticky) return; el.hidden = true; el.innerHTML = ''; hintSticky = false; return; }
    hintSticky = !!sticky;
    var circ = o && !cur.visiting && me().world.walk.circles.find(function (c) { return c.object === o.id; });
    el.innerHTML = '<span id="hintText">' + esc(text) + '</span>' + (o ? ' <button type="button" class="lk" id="hintLook">看看</button>' : '') + (circ ? ' <button type="button" class="lk" id="hintCircle">繞一圈（' + circ.letter + '）</button>' : '') + (extra || []).map(function (b) { return ' <button type="button" class="lk" id="' + b.id + '">' + esc(b.label) + '</button>'; }).join('');
    el.hidden = false;
    if (o) { $('hintLook').onclick = function () { hint(''); openNear(o); }; if (circ) $('hintCircle').onclick = function () { hint(''); WORLD.circleAround(o.id); }; }
    (extra || []).forEach(function (b) { $(b.id).onclick = b.fn; });
  }
  function hintSoft() { hint('', null, null, false); }   // 走開時收起（傳送門的留著）
  // 靠近不開對話框（路過不算）；只有停下來（arrive）才開。離開終點就不算站著。
  WORLD.on('near', function (o) { nearObj = o; if (cur.visiting && !(o && o.func === 'goal')) APP.setStanding(null); if (!o) { dialog(null); hintSoft(); arrivedAt = null; } });
  WORLD.on('walkstart', function () { dialog(null); hintSoft(); });
  // 繞完一圈當下就算走出字母（進入走代號狀態），不等離開範圍；離開範圍的結算若一樣就不再餵
  function feedCircle(o, n) {
    if (cur.visiting) return;
    var c = me().world.walk.circles.find(function (x) { return x.object === o.id; });
    if (c && dec.letter === String.fromCharCode(c.letter.charCodeAt(0) - (n - 1)) && !dec.digits) return;   // 這一圈已經算過了
    var r = dec.feed({ type: 'circle', object: o.id, count: n });   // 繞完那棟就算人在那裡
    if (r.type === 'letter') { toast('字母 ' + r.letter); drawCode(); guideProgress('circle', o.id); }
  }
  WORLD.on('turn', feedCircle);
  WORLD.on('circle', feedCircle);
  WORLD.on('arrive', function (o, info) {
    if (cur.visiting) { APP.setStanding(o.func === 'goal' ? cur.role.serial : null); if (!moving) openNear(o); return; }   // 別人的世界：停下就開
    // 要先繞出字母（或地圖指引開著）才算開始走代號；沒有的話在建築之間走來走去不算輸入數字
    if (!codeMode()) { if (!moving) openNear(o); return; }
    var r = dec.feed({ type: 'arrive', object: o.id });
    guideProgress('arrive', o.id);
    if (r.type === 'digit') { toast('數字 ' + r.digit); drawCode(); }
    else if (r.type === 'done') { drawCode(); openPortal(r.code); return; }   // 走完代號：提示換成傳送門的
    arrivedAt = o.id; if (!portalRole) hint('到了' + o.name, o);   // 走代號中：只提示，附「看看」「繞一圈」；傳送門開著時它的提示留著
  });
  WORLD.on('portal', function () { if (portalRole) teleport(portalRole); });
  $('btnHome').addEventListener('click', goHome);
  $('btnLeave').addEventListener('click', function () { if (WORLD.leave()) { WORLD.flash(); drawPlate(); } });
  $('btnBuild').addEventListener('click', function () { if (build) setBuild(false); else { setBuild(true); dialog({ title: '建造模式', body: '點一個物件改它的外觀、顏色、位置、門、走法。', opts: [{ label: '新增地標', pri: true, fn: addLandmark }] }); } });
  $('btnMap').addEventListener('click', showMap);
  $('task').addEventListener('click', function () {
    if (APP.isBlank()) return createDialog();
    var st = APP.steps();
    if (st.tutorial === 'ask') return askDialog();
    if (st.tutorial === 'compare') return cmpDialog();
    var opts = st.next ? [{ label: '去做：' + st.next.name, pri: true, fn: function () { dialog(null); goTask(st.next.func, st.next.who); } }] : [];
    if (st.tutorial) opts.push({ label: '跳過教學', warn: true, fn: function () { dialog(null); APP.tutSkip(); toast('跳過了教學。想只收不給，記得要有 0 點的空物件。', false); } });
    dialog({ title: st.tutorial ? '新手教學' : '任務清單', body: st.rows.map(function (x) { return (x.ok ? '✓ ' : st.next && st.next.id === x.id ? '→ ' : '　 ') + x.no + ' ' + x.name + '：' + x.status; }).join('\n'), opts: opts });
  });
  // 去做：功能點在別人的世界（教學：引路人）就先走他的代號；已經在那裡就走過去
  function goTask(func, who) {
    if (!WORLD.available) return;
    if (func === 'map') return showMap();
    if (func === 'build') return $('btnBuild').click();
    if (who && who !== me().serial) { var r = APP.roleOf(who); if (!r) return; if (cur.visiting && cur.role === r) return goFunc(r, func); if (cur.visiting) goHome(); return guideTo(CORE.abbrev(who)); }
    if (cur.visiting) goHome();
    var o = allObjs(me()).find(function (x) { return x.func === func; });
    if (o) { var p = WORLD.objectAt(o.id); if (p) WORLD.walkTo({ x: p.x, z: p.z + p.radius + 0.6 }); }
  }

  /* ---------- 新手教學：創角色、走完問要不要再走一次、帶看對照 ---------- */
  function createDialog() {
    dialog({ title: '創角色', body: '<div class="field">名字 <input type="text" id="cName" value="我" style="width:7em"></div><div class="field">每天的點 <input type="number" id="cDaily" value="' + CORE.DEFAULT_DAILY + '" min="1" style="width:5em"></div><div class="field">第一樣東西 <input type="text" id="cItem" value="空的" style="width:5em"> 價格 <input type="number" id="cPrice" value="0" min="0" style="width:3.5em"> 點，補 <input type="number" id="cQty" value="1" min="0" style="width:3.5em"> 份</div><div class="small muted">0 點的「空的」什麼都不給：一換一時想只收不給就拿它。創角色當下就生效。</div>',
      opts: [{ label: '建立', pri: true, fn: function () { createMe(false); } }, { label: '建立，跳過教學', fn: function () { createMe(true); } }] });
  }
  function createMe(skip) {
    var r = act(function () { APP.createPlayer({ name: val('cName').trim(), dailyPoints: val('cDaily'), firstItem: { name: val('cItem').trim(), price: +val('cPrice') || 0, qty: Math.max(0, Math.floor(+val('cQty') || 0)) } }, skip); }, skip ? '角色建好了。跳過教學' : '角色建好了。教學開始：找引路人');
    if (r.ok) dialog(null);
  }
  function askDialog() {
    var other = '表世界';
    dialog({ title: '教學走完了', body: '要不要用另一種介面再走一次？\n要：切到' + other + '，從「補 1 份空的」開始，用同一套步驟再跟引路人換一次。\n不要：切到' + other + '帶看對照，一步一步指出剛才那筆交換在那邊的哪裡，看完切回來。', opts: [{ label: '要', pri: true, fn: function () { dialog(null); APP.tutAnswer(true); } }, { label: '不要', fn: function () { dialog(null); APP.tutAnswer(false); } }] });
  }
  function cmpDialog() {
    var st = APP.steps(), c = st.next; if (!c) return;
    dialog({ title: '對照 ' + c.no + ' ' + c.name, body: c.status, opts: [{ label: c.last ? '看完，切回表世界' : '下一個', pri: true, fn: function () { dialog(null); APP.tutNext(); } }, { label: '去看', fn: function () { dialog(null); goTask(c.func, c.who); } }] });
  }
  APP.on('tut', function (st) {
    if (APP.view() !== 'game') return;
    if (st === 7) { dialog(null); askDialog(); }
    else if (st === 'compare') { dialog(null); cmpDialog(); }
    else if (st === 'done' && !APP.tut().skipped) toast('教學完成！接下來照任務提示準備自己的規則、資源、時段。', false);
    drawPlate();
  });
  $('swapToSheet').addEventListener('click', function () { var going = WORLD.walkingTo(); APP.setFocus({ role: cur.role ? cur.role.serial : me().serial, func: going ? going.func : nearObj ? nearObj.func : APP.focus().func }); APP.switchTo('sheet'); });   // 走路途中：以要去的那棟為準

  /* ---------- 那一微秒：站在終點上，倒數、交換對話框、白光 ---------- */
  var exchangeOpen = null;
  setInterval(function () {
    if (!cur.visiting || APP.view() !== 'game') { $('countdown').hidden = true; return; }
    var t = now(), b = CORE.myBookings(S(), me(), t).filter(function (x) { return x.owner === cur.role; })[0];
    if (!b || b.slot.atUs - t > 60e6) { $('countdown').hidden = true; return; }
    var standing = APP.standingAt() === cur.role.serial;
    if (t < b.slot.atUs) {
      $('countdown').hidden = false; $('countdown').textContent = ((b.slot.atUs - t) / 1e6).toFixed(1) + ' 秒' + (standing ? '' : '　先站到終點台上');
      var top = dlgStack[dlgStack.length - 1];
      if (standing && exchangeOpen !== b.slot.id && !(top && top.choosing && $('dlg').classList.contains('open'))) { exchangeOpen = b.slot.id; dialog(null); exchangeDialog(b.slot); }   // 蓋過其他對話框；只有正在選東西時等存好或關掉
    }
  }, 100);
  // 交換對話框：這個時段的其他人，每個人：我要他的（點東西選）、他要我的、每人最多給
  function exchangeDialog(slot) {
    var m = me(), ps = CORE.participants(S(), slot).filter(function (p) { return p !== m.serial; });
    var body = ps.map(function (p) { var o = APP.roleOf(p); if (!o) return ''; var theirs = CORE.wantsValid(S(), slot, p, m.serial).map(function (id) { var x = CORE.resourceOf(ver(m), id); return x ? x.name : id; });
      var gMine = CORE.goneText(S(), slot, m.serial, p), gTheirs = CORE.goneText(S(), slot, p, m.serial);
      var mineSel = CORE.wantsValid(S(), slot, m.serial, p), myNames = mineSel.map(function (id) { var x = CORE.resourceOf(CORE.version(o, slot.atUs), id); return x ? x.name : id; });
      return '<b>' + esc(o.name) + '</b><br>我要他的：' + (mineSel.length ? esc(myNames.join('、')) + '（' + CORE.wantTotal(S(), slot, m.serial, p) + ' 點） <button type="button" class="lk" data-pick="' + p + '">改</button>' : '<button type="button" class="lk" data-pick="' + p + '">還沒選</button><br><span class="small muted">你還沒選他的東西：一換一，兩邊都選了才成交</span>') + (gMine ? '<br><span class="small muted">' + esc(gMine) + '</span>' : '') + '<br>他要我的：' + (theirs.length ? esc(theirs.join('、')) + '（' + CORE.wantTotal(S(), slot, p, m.serial) + ' 點）' : '（沒選）<br><span class="small muted">他還沒選你的東西：一換一，兩邊都選了才成交</span>') + (gTheirs ? '<br><span class="small muted">' + esc(gTheirs) + '</span>' : '') + '<br>'; }).join('');
    var mg = slot.maxGive[m.serial], left = CORE.remainingToday(S(), m, now());
    if (slot.together) { var miss = CORE.togetherMissing(S(), slot); body += '<b>一起成交</b>：有選東西的每一對都成才全部成交。' + (miss.length ? '<br><span class="small">一起成交：' + esc(miss.join('；')) + '</span>' : '<span class="small muted">都選好了</span>') + '<br>'; }
    body += '<div class="field">每人最多給 <input type="number" id="maxGive" value="' + (mg != null ? mg : '') + '" placeholder="' + left + '（當天剩下的）" min="0" max="' + left + '"> 點</div>站著等那一微秒，照選好的互換東西。';
    dialog({ title: '交換：' + CORE.fmtUs(slot.atUs).slice(11, 19) + (slot.together ? '【一起成交】' : ''), body: body, opts: [{ label: '確定', pri: true, fn: function () { dialog(null); toast('站著等那一微秒。', true); } }],
      after: function () {
        $('maxGive').onchange = function () { act(function () { CORE.setMaxGive(S(), slot, m.serial, $('maxGive').value); }, ''); };
        $('dlgBody').querySelectorAll('[data-pick]').forEach(function (b) { b.onclick = function () { chooseWants(slot, b.dataset.pick, function () { dlgStack.pop(); exchangeDialog(slot); }); }; });
      } });
  }
  APP.on('dock', function (res) {
    exchangeOpen = null;
    if (APP.view() !== 'game') return;
    var m = me().serial, mine = res.filter(function (x) { return x.docking.a === m || x.docking.b === m; });
    if (!mine.length) return;
    WORLD.flash(); WORLD.showPartner(true); drawPlate();
    var lines = mine.map(function (x) { var d = x.docking, other = APP.roleOf(d.a === m ? d.b : d.a), gave = d.a === m ? d.gaveA : d.gaveB, got = d.a === m ? d.gaveB : d.gaveA, myItems = d.a === m ? d.itemsB : d.itemsA, failMe = d.a === m ? d.failA : d.failB, failHim = d.a === m ? d.failB : d.failA, noteMe = d.a === m ? d.noteB : d.noteA, noteHim = d.a === m ? d.noteA : d.noteB;
      var on = other ? other.name : '？', myOut = d.a === m ? d.itemsA : d.itemsB;
      if (!d.ok) return '和 ' + on + ' 不成立：' + d.reason;
      if (!d.traded) return '和 ' + on + ' 不成交：' + d.reason;
      return '和 ' + on + '（' + d.how + '）\n我拿出：' + CORE.itemsText(myOut) + '（' + gave + ' 點）；拿到：' + on + '的' + CORE.itemsText(myItems) + '（' + got + ' 點）' + (noteHim ? '\n' + noteHim : '') + (noteMe ? '\n他' + noteMe : '') + (other && other.contact ? '\n聯絡方式：' + other.contact : ''); });
    dialog({ title: '到達那微秒', body: lines.join('\n\n'), opts: [{ label: '好', pri: true, fn: function () { dialog(null); WORLD.showPartner(false); } }] });
  });
  APP.on('miss', function () { exchangeOpen = null; if (APP.view() === 'game' && cur.visiting) toast('錯過了那一微秒，這個時段不能再對接。', true); });

  /* ---------- 進出裡世界：切換時停在同一件事上 ---------- */
  function show() {
    var f = APP.focus(), m = me();
    if (!APP.focusChanged()) { refreshDialog(); drawPlate(); return; }   // 表世界沒換看別的東西：一切照舊，走到一半繼續走、開著的對話框用最新資料重畫
    dialog(null);
    if (f.role && f.role !== m.serial) {
      var r = APP.roleOf(f.role);
      if (r && (!cur.visiting || cur.role !== r)) { if (CORE.tryClean(r).role) { cur = { role: r, visiting: true }; WORLD.loadWorld(CORE.tryClean(r).role.world, { visiting: true }); } }
      // 走到那個功能點旁邊
      if (r && f.func && f.func !== 'map') goFunc(r, f.func);
      if (r && f.func === 'map') guideTo(CORE.abbrev(r.serial));
    } else if (f.func && f.func !== 'map' && f.func !== 'build') goFunc(m, f.func);
    drawPlate();
  }
  function goFunc(r, func) {
    guideSteps = null; WORLD.setGuide([]);   // 明確要去某個功能點：舊的指引光點清掉
    var o = allObjs(r).find(function (x) { return x.func === func; });
    if (o) WORLD.walkToObject(o.id);
  }
  APP.on('view', function (v) { $('view-game').hidden = v !== 'game'; if (v === 'game') { WORLD.resume(); WORLD.resize(); show(); } else WORLD.pause(); });   // 切走時對話框留著，切回來照樣開   // 表世界蓋著時 3D 暫停
  APP.on('me', function () { dec = new CORE.Decoder(me().world.walk); goHome(); if (APP.isBlank() && WORLD.available) createDialog(); });
  APP.on('change', function () { if (APP.view() === 'game') drawPlate(); });

  /* ---------- 開始 ---------- */
  dec = new CORE.Decoder(me().world.walk);
  cur = { role: me(), visiting: false };
  if (!WORLD.available) { $('stage').innerHTML = '<div class="nothree">3D 引擎沒載入，裡世界暫時不能用。按右上角「表 ⇄ 裡」用表世界，功能完全一樣。</div>'; }
  else { WORLD.init($('stage')); WORLD.loadWorld(me().world); }
  drawPlate();
  if (APP.isBlank() && WORLD.available) createDialog();
  // 切回來時留著的對話框要用最新資料重畫：記住每個對話框是哪個函式、什麼參數做出來的
  function R(fn) {
    var w = function () {
      var args = arguments, out = fn.apply(null, args), top = dlgStack[dlgStack.length - 1];
      if (top && !top.again) top.again = function () { dlgStack.pop(); w.apply(null, args); };   // 呼叫包過的，重畫出來的對話框也帶 again
      return out;
    };
    return w;
  }
  openNear = R(openNear); readRules = R(readRules); shop = R(shop); timetable = R(timetable); mySlots = R(mySlots);
  stockDialog = R(stockDialog); history = R(history); switchRole = R(switchRole); buildDialog = R(buildDialog); exchangeDialog = R(exchangeDialog); askDialog = R(askDialog); cmpDialog = R(cmpDialog);
  function refreshDialog() { var top = dlgStack[dlgStack.length - 1]; if (top && top.again && $('dlg').classList.contains('open')) top.again(); }

  return { show: show, dialog: dialog, cur: function () { return cur; }, dec: function () { return dec; }, guideTo: guideTo, openPortal: openPortal, enterPortal: function () { if (portalRole) teleport(portalRole); }, teleportTo: teleport, goHome: goHome, setBuild: setBuild, nearObj: function () { return nearObj; }, stack: function () { return dlgStack; } };
})();
