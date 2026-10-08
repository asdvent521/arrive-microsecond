/* ===== v7 裡世界：像遊戲 =====
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
  var STATUS = APP.STATUS;

  /* ---------- 小工具 ---------- */
  function toast(text, keep) {
    var el = $('toast'); el.textContent = text; el.hidden = !text;
    clearTimeout(toastTimer); if (!keep && text) toastTimer = setTimeout(function () { el.hidden = true; }, 3200);
  }
  function fmtLife(r) { return CORE.fmtUs(r.life.startUs).slice(0, 10) + ' → ' + CORE.fmtUs(r.life.endUs).slice(0, 10); }
  function bar(ratio) { return '<span class="bar"><i style="width:' + Math.round(Math.max(0, Math.min(1, ratio)) * 100) + '%"></i></span>'; }

  /* ---------- 對話框：標題、內容、選項（像 RPG） ---------- */
  var dlgStack = [];
  function dialog(d) {
    if (!d) { $('dlg').classList.remove('open'); dlgStack = []; return; }
    dlgStack.push(d);
    $('dlgTitle').textContent = d.title || '';
    $('dlgBody').innerHTML = d.body || '';
    $('dlgOpts').innerHTML = (d.opts || []).map(function (o, i) { return '<button type="button" class="btn' + (o.pri ? ' pri' : '') + (o.warn ? ' warn' : '') + '" data-opt="' + i + '">' + esc(o.label) + '</button>'; }).join('') + (dlgStack.length > 1 ? '<button type="button" class="btn" data-opt="back">返回</button>' : '');
    $('dlg').classList.add('open');
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
    $('plateCode').textContent = CORE.abbrev(m.serial); $('plateName').textContent = m.name + (cur.visiting ? '　在 ' + cur.role.name + ' 的世界' : '') + (WORLD.depth() ? '　內部第 ' + WORLD.depth() + ' 層' : '');
    var left = CORE.remainingToday(S(), m, t);
    $('energyBar').style.width = (m.dailyPoints ? left / m.dailyPoints * 100 : 0) + '%';
    $('energyText').textContent = '今天還能給 ' + left + ' / ' + m.dailyPoints + ' 點' + (CORE.status(m, t) !== 'active' ? '（' + STATUS[CORE.status(m, t)] + '）' : '');
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
    var m = me(), rt = CORE.routeV7(m.world.walk, allObjs(m), code);
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
  function openNear(o) {
    if (!o) return;
    var r = cur.role, mine = !cur.visiting, f = CORE.FUNCS[o.func] || CORE.FUNCS.none;
    var title = '這裡是' + f.label + '：' + o.name;
    if (build && mine) return buildDialog(o);
    var opts = [];
    var circ = mine && r.world.walk.circles.find(function (c) { return c.object === o.id; });
    if (circ) opts.push({ label: '繞一圈（' + circ.letter + '）', fn: function () { dialog(null); WORLD.circleAround(o.id); } });
    if (o.func === 'rule') {
      opts.push({ label: '閱讀規則', pri: true, fn: function () { readRules(r, 0); } });
      if (!mine && r.rules.village && !CORE.accepted(S(), me().serial, r.serial)) opts.push({ label: '接受村規', fn: function () { act(function () { CORE.accept(S(), me().serial, r.serial); }, '你接受了 ' + r.name + ' 的村規'); openNear(o); } });
      if (mine && APP.draft()) opts.push({ label: '寫規則（草稿）', fn: function () { draftRules(); } });
      if (mine && !APP.draft()) opts.push({ label: '規則鎖住：結束並重創', warn: true, fn: function () { confirmEnd(); } });
      dialog({ title: title, body: mine ? '這是你的規則屋。' + (APP.draft() ? '有一份草稿還沒創角色。' : '週期內規則表一個字都不能改。') : '走進一個人的世界，看得見他的規則。', opts: opts });
    } else if (o.func === 'resource') {
      if (mine) opts.push({ label: APP.draft() ? '上架（草稿）' : '補貨', pri: true, fn: function () { APP.draft() ? draftResources() : restockDialog(); } });
      else opts.push({ label: '看商店', pri: true, fn: function () { shop(r); } });
      dialog({ title: title, body: r.resources.length ? r.resources.map(function (x) { return '・' + x.name + '　' + x.price + ' 點　剩 ' + x.qty + ' 份'; }).join('\n') : '（沒有上架的東西）', opts: opts });
    } else if (o.func === 'goal') {
      if (mine) { opts.push({ label: '開時段', pri: true, fn: function () { addSlotDialog(); } }); opts.push({ label: '看預約', fn: function () { mySlots(); } }); }
      else {
        var e = CORE.eligible(S(), r, me(), now());
        opts.push({ label: '時刻表', pri: true, fn: function () { timetable(r); } });
        dialog({ title: title, body: slotsText(r) + '\n' + (e.ok ? '條件通（' + e.how + '），可以預約。' : '條件不通：' + e.reason), opts: opts });
        return;
      }
      dialog({ title: title, body: slotsText(r), opts: opts });
    } else if (o.func === 'role') {
      var st = CORE.status(r, now());
      var body = '每天 ' + r.dailyPoints + ' ' + r.name + '點\n週期剩 ' + Math.floor(CORE.daysLeft(r, now())) + ' 天 ' + bar(CORE.daysLeft(r, now()) / Math.max(1, (r.life.endUs - r.life.startUs) / CORE.DAY_US)) + '\n狀態：' + STATUS[st] + '　對接過 ' + CORE.dockCount(S(), r.serial) + ' 次' + (r.prev ? '\n前身：' + CORE.abbrev(r.prev) : '') + (!mine && CORE.contactVisible(S(), r, me().serial, now()) && r.contact ? '\n聯絡方式：' + r.contact : '');
      if (mine) {
        opts.push({ label: '換角色', fn: switchRole });
        opts.push({ label: '新角色', fn: function () { newRoleWizard(1); } });
        if (st === 'active') opts.push({ label: '進入空窗', fn: function () { act(function () { CORE.enterVacancy(S(), r.serial, now()); }, '進入空窗：每天的點停發、別人手上的點暫停兌現'); openNear(o); } });
        if (st === 'vacancy') opts.push({ label: '離開空窗', pri: true, fn: function () { act(function () { CORE.leaveVacancy(S(), r.serial, now()); }, '離開空窗了'); openNear(o); } });
        if (st !== 'ended') opts.push({ label: '結束並重創', warn: true, fn: confirmEnd });
        opts.push({ label: '歷史紀錄', fn: history });
      }
      dialog({ title: title, body: body, opts: opts });
    } else if (o.func === 'points') {
      if (!mine) { dialog({ title: title, body: '帳房只有主人看得到。', opts: [] }); return; }
      var hs = CORE.holdings(S(), me().serial, now());
      dialog({ title: '背包：' + o.name, body: (hs.length ? hs.map(function (g) { return '・' + g.issuer.name + '點 ' + g.amount + '　到期 ' + CORE.fmtUs(g.endUs).slice(0, 10) + '　' + (g.status === 'active' ? '可兌現' : g.status === 'vacancy' ? '暫停' : '作廢'); }).join('\n') : '手上沒有別人的點。') + '\n今天還能給 ' + CORE.remainingToday(S(), me(), now()) + ' 點', opts: hs.filter(function (g) { return g.status === 'active'; }).map(function (g) { return { label: '去 ' + g.issuer.name + ' 的市集兌現', fn: function () { shop(g.issuer); } }; }) });
    } else dialog({ title: title, body: '純地標，用來走代號。', opts: o.door ? [] : [] });
    if (o.door) { var open = o.door.visible !== 'self' || mine; var cur0 = dlgStack[dlgStack.length - 1]; cur0.body += '\n' + (open ? '有一扇門。' : '有一扇門，關著。'); if (open && WORLD.depth() < 3) cur0.opts.push({ label: '進門', fn: function () { dialog(null); if (WORLD.enter(o.id)) { WORLD.flash(); drawPlate(); } } }); dialog(cur0); dlgStack.pop(); }
  }
  function slotsText(r) {
    var up = r.slots.filter(function (s) { return s.atUs >= now(); }).sort(function (a, b) { return a.atUs - b.atUs; });
    return up.length ? up.slice(0, 4).map(function (s) { return '・' + CORE.fmtUs(s.atUs).slice(5, 19) + '　名額 ' + s.bookings.length + '/' + s.capacity + '　主人給 ' + s.give + ' 點' + (s.bookings.indexOf(me().serial) >= 0 ? '（你預約了）' : ''); }).join('\n') : '沒有開放的對接時段。';
  }
  // 閱讀規則：分頁翻（用途 → 條件 → 開關與村規）
  function readRules(r, page) {
    var ru = r.rules, pages = [];
    pages.push({ t: '我的點能做什麼', b: ru.uses.length ? ru.uses.map(function (u) { return '・' + u; }).join('\n') : '（沒寫）' });
    var condBody = ru.conditions.length ? ru.conditions.map(function (c) { var ok = cur.visiting ? CORE.passes(S(), { rules: { conditions: [c] }, state: 'active', life: r.life }, me(), now()).ok : null; return '・' + CORE.condText(c) + (ok == null ? '' : ok ? '　✓ 我通' : '　✗ 我不通'); }).join('\n') : '（沒有條件，誰都通）';
    if (cur.visiting) { var e = CORE.eligible(S(), r, me(), now()); condBody += '\n\n' + (e.ok ? '可以對接（' + e.how + '）' : '不能對接：' + e.reason); }
    pages.push({ t: '對接條件', b: condBody });
    pages.push({ t: '開關與村規', b: '要求兩方都通：' + (ru.bothMustPass ? '開' : '關') + '\n對方要先接受我的村規：' + (ru.mustAcceptVillage ? '開' : '關') + '\n\n村規：' + (ru.village || '（沒有）') + (ru.village ? '\n（誰寫的誰解釋）' + (cur.visiting ? (CORE.accepted(S(), me().serial, r.serial) ? '\n你已接受' : '\n你還沒接受') : '') : '') });
    var p = pages[page], opts = [];
    if (page > 0) opts.push({ label: '上一頁', fn: function () { dlgStack.pop(); readRules(r, page - 1); } });
    if (page < pages.length - 1) opts.push({ label: '下一頁', pri: true, fn: function () { dlgStack.pop(); readRules(r, page + 1); } });
    if (page === 2 && cur.visiting && ru.village && !CORE.accepted(S(), me().serial, r.serial)) opts.push({ label: '接受村規', pri: true, fn: function () { act(function () { CORE.accept(S(), me().serial, r.serial); }, '你接受了 ' + r.name + ' 的村規'); dlgStack.pop(); readRules(r, 2); } });
    dialog({ title: r.name + ' 的規則 ' + (page + 1) + '/3：' + p.t, body: p.b, opts: opts });
  }
  // 商店：看價錢、兌現
  function shop(r) {
    var bal = CORE.balance(S(), me().serial, r.serial, now()), st = CORE.status(r, now());
    dialog({ title: r.name + ' 的商店', body: '你有 ' + bal + ' ' + r.name + '點' + (st === 'vacancy' ? '　他在空窗期，暫停兌現' : st === 'ended' ? '　他的角色結束了，點作廢' : ''),
      opts: r.resources.map(function (x) { return { label: x.name + '　' + x.price + ' 點（剩 ' + x.qty + '）', pri: bal >= x.price && x.qty > 0 && st === 'active', fn: function () { act(function () { CORE.redeem(S(), me().serial, r.serial, x.id, now()); }, '換到了：' + x.name); dlgStack.pop(); shop(r); } }; }) });
  }
  // 時刻表：看時段、預約
  function timetable(r) {
    var e = CORE.eligible(S(), r, me(), now());
    var up = r.slots.filter(function (s) { return s.atUs > now(); }).sort(function (a, b) { return a.atUs - b.atUs; });
    dialog({ title: r.name + ' 的時刻表', body: (e.ok ? '條件通（' + e.how + '）' : '條件不通：' + e.reason) + (up.length ? '' : '\n沒有開放的時段。'),
      opts: up.map(function (s) { var booked = s.bookings.indexOf(me().serial) >= 0, full = s.bookings.length >= s.capacity; return { label: CORE.fmtUs(s.atUs).slice(11, 19) + '　' + s.bookings.length + '/' + s.capacity + (booked ? '　已預約' : full ? '　滿了' : '　預約'), pri: e.ok && !booked && !full, fn: function () { if (booked) { act(function () { CORE.cancelBooking(S(), me().serial, s.id); }, '取消了'); } else act(function () { CORE.book(S(), me().serial, s.id, now()); }, '預約好了：' + CORE.fmtUs(s.atUs).slice(11, 19) + '，那一微秒站在這裡就對接' + (r.contact ? '。聯絡方式：' + r.contact : '')); dlgStack.pop(); timetable(r); } }; }) });
  }
  // 自己的終點：開時段、看預約、拒絕
  function addSlotDialog() {
    dialog({ title: '開對接時段', body: '<div class="field">幾分鐘後 <input type="number" id="gSlotMin" value="3" min="1"></div><div class="field">名額 <input type="number" id="gSlotCap" value="1" min="1"></div><div class="field">每次給多少點（不超過當天剩的） <input type="number" id="gSlotGive" value="100" min="0"></div>',
      opts: [{ label: '開', pri: true, fn: function () { act(function () { CORE.addSlot(S(), me().serial, now() + (+val('gSlotMin') || 1) * 60e6 + Math.floor(Math.random() * 1000), val('gSlotCap'), val('gSlotGive'), now()); }, '開了時段'); dialog(null); } }] });
  }
  function mySlots() {
    var m = me(), opts = [], lines = [];
    m.slots.slice().sort(function (a, b) { return a.atUs - b.atUs; }).forEach(function (s) {
      lines.push('・' + CORE.fmtUs(s.atUs).slice(5, 19) + '　' + s.bookings.length + '/' + s.capacity + '　給 ' + s.give + (s.bookings.length ? '　預約：' + s.bookings.map(function (b) { var rb = APP.roleOf(b); return (rb ? rb.name : b) + (s.docked.indexOf(b) >= 0 ? '（已對接）' : CORE.missed(s, b) ? '（錯過）' : ''); }).join('、') : ''));
      s.bookings.forEach(function (b) { var rb = APP.roleOf(b); var c = rb && s.docked.indexOf(b) < 0 ? CORE.canRefuse(S(), m, rb, now()) : { ok: false }; if (c.ok) opts.push({ label: '拒絕 ' + rb.name + '（做不到對方的要求）', warn: true, fn: function () { act(function () { CORE.refuse(S(), m.serial, s.id, b, now()); }, '拒絕了，留下紀錄'); dlgStack.pop(); mySlots(); } }); });
    });
    dialog({ title: '我開的時段', body: lines.length ? lines.join('\n') : '還沒開時段。', opts: opts });
  }
  function restockDialog() {
    var m = me();
    dialog({ title: '補貨', body: m.resources.length ? '' : '沒有資源可以補。', opts: m.resources.map(function (x) { return { label: x.name + '（剩 ' + x.qty + '）＋1', fn: function () { act(function () { CORE.restock(S(), m.serial, x.id, 1); }, '補了 1 份'); dlgStack.pop(); restockDialog(); } }; }) });
  }
  function history() {
    var m = me(), lines = S().records.filter(function (x) { return x.text.indexOf(CORE.abbrev(m.serial)) >= 0 || x.text.indexOf(m.name) >= 0; }).slice(-8).reverse().map(function (x) { return '・' + x.text; });
    var dk = S().dockings.filter(function (d) { return d.a === m.serial || d.b === m.serial; });
    dialog({ title: '歷史紀錄', body: '對接 ' + dk.length + ' 次\n' + (lines.length ? lines.join('\n') : '還沒有紀錄。'), opts: [] });
  }
  function switchRole() {
    dialog({ title: '換角色', body: '我是誰？', opts: S().roles.map(function (r, i) { return { label: CORE.abbrev(r.serial) + ' ' + r.name + (r === me() ? '（現在）' : ''), pri: r === me(), fn: function () { dialog(null); APP.becomeMe(i); } }; }) });
  }
  function confirmEnd() {
    var m = me();
    dialog({ title: '結束並重創', body: '結束 ' + m.name + '：他的點作廢（單機版持有人視為同意）；草稿會帶著原本的規則和前身，改好再創。', opts: [{ label: '結束', warn: true, fn: function () { act(function () { APP.endEarly(m.serial); }, '角色結束了，到規則屋寫草稿'); dialog(null); } }] });
  }
  // 新角色：一步一步問（名字 → 每天的點 → 週期 → 規則 → 資源 → 創）
  function newRoleWizard(step) {
    var d = APP.draft() || APP.startDraft({});
    if (step === 1) dialog({ title: '新角色 1/5：名字', body: '<input type="text" id="wName" value="' + esc(d.name) + '" placeholder="名字">', opts: [{ label: '下一步', pri: true, fn: function () { d.name = val('wName').trim(); if (!d.name) return toast('先取名字', true); APP.save(); dlgStack.pop(); newRoleWizard(2); } }] });
    else if (step === 2) dialog({ title: '新角色 2/5：每天的點', body: '每天願意給別人的能力。預設 1800。<br><input type="number" id="wDaily" value="' + d.dailyPoints + '" min="1">', opts: [{ label: '下一步', pri: true, fn: function () { d.dailyPoints = Math.floor(+val('wDaily')) || 1; APP.save(); dlgStack.pop(); newRoleWizard(3); } }] });
    else if (step === 3) dialog({ title: '新角色 3/5：週期', body: '幾天後結束？週期內規則不能改。<br><input type="number" id="wDays" value="' + d.days + '" min="1"> 天<br>聯絡方式（只給預約成功的人看，可不填）<br><input type="text" id="wContact" value="' + esc(d.contact) + '">', opts: [{ label: '下一步', pri: true, fn: function () { d.days = Math.floor(+val('wDays')) || 30; d.contact = val('wContact'); APP.save(); dlgStack.pop(); newRoleWizard(4); } }] });
    else if (step === 4) draftRules(function () { newRoleWizard(5); });
    else if (step === 5) draftResources(function () { dialog({ title: '新角色 5/5：創角色', body: d.name + '，每天 ' + d.dailyPoints + ' 點，' + d.days + ' 天\n' + d.rules.uses.length + ' 條用途、' + d.rules.conditions.length + ' 條條件、' + d.resources.length + ' 項資源\n創了以後規則鎖住。', opts: [{ label: '創角色', pri: true, fn: function () { act(function () { APP.createFromDraft(); }, '創好了，規則表從現在起鎖住'); dialog(null); } }] }); });
  }
  // 草稿：規則
  function draftRules(next) {
    var d = APP.draft(); if (!d) return;
    var ru = d.rules;
    var body = '<b>我的點能做什麼</b><div class="list">' + ru.uses.map(function (u, i) { return '<div class="item"><span>' + esc(u) + '</span><button type="button" class="btn sm" data-del-use="' + i + '">刪</button></div>'; }).join('') + '</div><div class="field"><input type="text" id="wUse" placeholder="例如：1 我點 = 陪跑 1 分鐘"> <button type="button" class="btn sm" id="wAddUse">加一條</button></div>' +
      '<b>對接條件</b><div class="list">' + ru.conditions.map(function (c, i) { return '<div class="item"><span>' + esc(CORE.condText(c)) + '</span><button type="button" class="btn sm" data-del-cond="' + i + '">刪</button></div>'; }).join('') + '</div><div class="field"><select id="wField">' + Object.keys(CORE.COND_FIELDS).map(function (k) { return opt(k, CORE.COND_FIELDS[k].label, 'dailyPoints'); }).join('') + '</select> <select id="wOp">' + Object.keys(CORE.OPS).map(function (o) { return opt(o, CORE.OPS[o], '>='); }).join('') + '</select> <input type="number" id="wVal" value="1000" style="width:6em"> <button type="button" class="btn sm" id="wAddCond">加一條</button></div>' +
      '<b>開關與村規</b><div class="field"><label><input type="checkbox" id="wBoth"' + (ru.bothMustPass ? ' checked' : '') + '> 要求兩方都通</label><label><input type="checkbox" id="wVill"' + (ru.mustAcceptVillage ? ' checked' : '') + '> 對方一定要接受我的村規</label><textarea id="wVillage" placeholder="村規（自由文字，誰寫的誰解釋）">' + esc(ru.village) + '</textarea></div>';
    var save = function () { ru.bothMustPass = $('wBoth').checked; ru.mustAcceptVillage = $('wVill').checked; ru.village = val('wVillage'); APP.save(); };
    dialog({ title: (next ? '新角色 4/5：' : '草稿：') + '規則', body: body, opts: [{ label: next ? '下一步' : '存草稿', pri: true, fn: function () { save(); dlgStack.pop(); if (next) next(); else { dialog(null); toast('存了草稿'); } } }],
      after: function () {
        $('wAddUse').onclick = function () { var t = val('wUse').trim(); if (!t) return; ru.uses.push(t); save(); dlgStack.pop(); draftRules(next); };
        $('wAddCond').onclick = function () { var f = val('wField'), fd = CORE.COND_FIELDS[f]; ru.conditions.push(fd.enum ? { field: f, op: '=', value: Object.keys(fd.enum)[0] } : { field: f, op: val('wOp'), value: +val('wVal') || 0 }); save(); dlgStack.pop(); draftRules(next); };
        $('dlgBody').querySelectorAll('[data-del-use]').forEach(function (b) { b.onclick = function () { ru.uses.splice(+b.dataset.delUse, 1); save(); dlgStack.pop(); draftRules(next); }; });
        $('dlgBody').querySelectorAll('[data-del-cond]').forEach(function (b) { b.onclick = function () { ru.conditions.splice(+b.dataset.delCond, 1); save(); dlgStack.pop(); draftRules(next); }; });
      } });
  }
  // 草稿：資源（上架）
  function draftResources(next) {
    var d = APP.draft(); if (!d) return;
    var body = '<div class="list">' + d.resources.map(function (x, i) { return '<div class="item"><span>' + esc(x.name) + '　' + x.price + ' 點×' + x.qty + '</span><button type="button" class="btn sm" data-del-res="' + i + '">刪</button></div>'; }).join('') + '</div><div class="field"><input type="text" id="wResName" placeholder="例如：陪跑一小時"> 價格 <input type="number" id="wResPrice" value="60" min="1" style="width:5em"> 數量 <input type="number" id="wResQty" value="1" min="0" style="width:5em"> <button type="button" class="btn sm" id="wAddRes">上架</button></div>';
    dialog({ title: (next ? '新角色 4/5 → 5/5：' : '草稿：') + '資源', body: body, opts: [{ label: next ? '下一步' : '存草稿', pri: true, fn: function () { dlgStack.pop(); if (next) next(); else { dialog(null); toast('存了草稿'); } } }],
      after: function () {
        $('wAddRes').onclick = function () { var n = val('wResName').trim(); if (!n) return; d.resources.push({ name: n, price: Math.floor(+val('wResPrice')) || 1, qty: Math.floor(+val('wResQty')) || 0 }); APP.save(); dlgStack.pop(); draftResources(next); };
        $('dlgBody').querySelectorAll('[data-del-res]').forEach(function (b) { b.onclick = function () { d.resources.splice(+b.dataset.delRes, 1); APP.save(); dlgStack.pop(); draftResources(next); }; });
      } });
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
      return '<button type="button" class="node' + (e.ok ? '' : ' dim') + '" data-go="' + CORE.abbrev(r.serial) + '"><b>' + esc(CORE.abbrev(r.serial) + ' ' + r.name) + '</b><span class="small">' + (e.ok ? '✓ ' + esc(e.how) : '✗ 不通') + '</span><span class="small">每天 ' + r.dailyPoints + '・' + (s ? '最近 ' + CORE.fmtUs(s.atUs).slice(11, 16) : '沒時段') + '</span></button>';
    }).join('') + '</div><div class="field" style="margin-top:12px">查資源 <input type="text" id="mapKw" placeholder="關鍵字" style="min-height:34px;padding:4px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg)"> <button type="button" class="btn sm" id="mapSearch">查</button><div id="mapRes" class="small"></div></div><p style="margin-top:12px"><button type="button" class="btn" id="mapClose">關閉</button></p>';
    $('map').hidden = false;
    $('map').querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { $('map').hidden = true; APP.setFocus({ role: CORE.expand(b.dataset.go), func: 'map' }); if (cur.visiting) goHome(); guideTo(b.dataset.go); }; });
    $('mapClose').onclick = function () { $('map').hidden = true; };
    $('mapSearch').onclick = function () { var kw = val('mapKw'); var rs = CORE.searchResources(S(), kw, t).filter(function (x) { return x.role !== m; }); $('mapRes').innerHTML = rs.length ? rs.map(function (x) { return '・' + esc(x.resource.name) + '　' + x.resource.price + ' ' + esc(x.role.name) + '點（剩 ' + x.resource.qty + '）<button type="button" class="lk" data-go2="' + CORE.abbrev(x.role.serial) + '">走過去</button>'; }).join('<br>') : '沒有符合的資源。'; $('mapRes').querySelectorAll('[data-go2]').forEach(function (b) { b.onclick = function () { $('map').hidden = true; APP.setFocus({ role: CORE.expand(b.dataset.go2), func: 'resource' }); if (cur.visiting) goHome(); guideTo(b.dataset.go2); }; }); };
  }

  /* ---------- 傳送、回家 ---------- */
  function openPortal(code) {
    var role = CORE.findRole(S(), code);
    if (!role || role === me()) { toast(role === me() ? code + ' 是自己，走別人的代號' : '沒有 ' + code + ' 這個角色', true); setTimeout(function () { dec.reset(); WORLD.resetRings(); drawCode(); toast(''); }, 2200); return; }
    portalRole = role; WORLD.showPortal('傳送門 → ' + role.name + '（' + code + '）'); WORLD.setGuide([]); guideSteps = null; drawCode();
    toast('走出了 ' + code + '，傳送門打開了。', true);
    hint('傳送門 → ' + role.name, null, [{ id: 'hintEnter', label: '進去', fn: function () { hint(''); if (portalRole) teleport(portalRole); } }]);
  }
  function teleport(role) {
    var chk = CORE.tryClean(role);
    if (chk.error) { toast(role.name + ' 的資料不是純資料（' + chk.error + '），不載入。', true); WORLD.hidePortal(); portalRole = null; return; }
    cur = { role: role, visiting: true }; portalRole = null; dialog(null); hint('');
    WORLD.flash(); WORLD.loadWorld(chk.role.world, { visiting: true });
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
  var hintTimer = null, arrivedAt = null;
  function hint(text, o, extra) {   // 上方一行小字；到了建築時帶「看看」「繞一圈」按鈕；extra 是額外按鈕
    var el = $('hint'); clearTimeout(hintTimer);
    if (!text) { el.hidden = true; el.innerHTML = ''; return; }
    var circ = o && !cur.visiting && me().world.walk.circles.find(function (c) { return c.object === o.id; });
    el.innerHTML = esc(text) + (o ? ' <button type="button" class="lk" id="hintLook">看看</button>' : '') + (circ ? ' <button type="button" class="lk" id="hintCircle">繞一圈（' + circ.letter + '）</button>' : '') + (extra || []).map(function (b) { return ' <button type="button" class="lk" id="' + b.id + '">' + esc(b.label) + '</button>'; }).join('');
    el.hidden = false;
    if (o) { $('hintLook').onclick = function () { hint(''); openNear(o); }; if (circ) $('hintCircle').onclick = function () { hint(''); WORLD.circleAround(o.id); }; }
    (extra || []).forEach(function (b) { $(b.id).onclick = b.fn; });
    hintTimer = setTimeout(function () { el.hidden = true; }, o || extra ? 4000 : 2500);   // 幾秒後自動收起，不擋住遠處的建築；再點一次建築會再出現
  }
  // 靠近不開對話框（路過不算）；只有停下來（arrive）才開。離開終點就不算站著。
  WORLD.on('near', function (o) { nearObj = o; if (cur.visiting && !(o && o.func === 'goal')) APP.setStanding(null); if (!o) { dialog(null); hint(''); arrivedAt = null; } });
  WORLD.on('walkstart', function () { dialog(null); hint(''); });
  // 繞完一圈當下就算走出字母（進入走代號狀態），不等離開範圍；離開範圍的結算若一樣就不再餵
  function feedCircle(o, n) {
    if (cur.visiting) return;
    var c = me().world.walk.circles.find(function (x) { return x.object === o.id; });
    if (c && dec.letter === String.fromCharCode(c.letter.charCodeAt(0) - (n - 1)) && !dec.digits) return;   // 這一圈已經算過了
    var r = dec.feedV7({ type: 'circle', object: o.id, count: n });   // 繞完那棟就算人在那裡
    if (r.type === 'letter') { toast('字母 ' + r.letter); drawCode(); guideProgress('circle', o.id); }
  }
  WORLD.on('turn', feedCircle);
  WORLD.on('circle', feedCircle);
  WORLD.on('arrive', function (o, info) {
    if (cur.visiting) { APP.setStanding(o.func === 'goal' ? cur.role.serial : null); if (!moving) openNear(o); return; }   // 別人的世界：停下就開
    // 要先繞出字母（或地圖指引開著）才算開始走代號；沒有的話在建築之間走來走去不算輸入數字
    if (!codeMode()) { if (!moving) openNear(o); return; }
    var r = dec.feedV7({ type: 'arrive', object: o.id });
    guideProgress('arrive', o.id);
    if (r.type === 'digit') { toast('數字 ' + r.digit); drawCode(); }
    else if (r.type === 'done') { drawCode(); openPortal(r.code); return; }   // 走完代號：提示換成傳送門的
    arrivedAt = o.id; hint('到了' + o.name, o);   // 走代號中：只提示，附「看看」「繞一圈」
  });
  WORLD.on('portal', function () { if (portalRole) teleport(portalRole); });
  $('btnHome').addEventListener('click', goHome);
  $('btnLeave').addEventListener('click', function () { if (WORLD.leave()) { WORLD.flash(); drawPlate(); } });
  $('btnBuild').addEventListener('click', function () { if (build) setBuild(false); else { setBuild(true); dialog({ title: '建造模式', body: '點一個物件改它的外觀、顏色、位置、門、走法。', opts: [{ label: '新增地標', pri: true, fn: addLandmark }] }); } });
  $('btnMap').addEventListener('click', showMap);
  $('task').addEventListener('click', function () { var st = APP.steps(); dialog({ title: '任務清單', body: st.rows.map(function (x) { return (x.ok ? '✓ ' : st.next && st.next.id === x.id ? '→ ' : '　 ') + x.no + ' ' + x.name + '：' + x.status; }).join('\n'), opts: st.next ? [{ label: '去做：' + st.next.name, pri: true, fn: function () { dialog(null); goTask(st.next.func); } }] : [] }); });
  function goTask(func) {
    if (func === 'map') return showMap();
    if (func === 'build') return $('btnBuild').click();
    var o = allObjs(me()).find(function (x) { return x.func === func; });
    if (o) { var p = WORLD.objectAt(o.id); if (p) WORLD.walkTo({ x: p.x, z: p.z + p.radius + 0.6 }); }
  }
  $('swapToSheet').addEventListener('click', function () { var going = WORLD.walkingTo(); APP.setFocus({ role: cur.role ? cur.role.serial : me().serial, func: going ? going.func : nearObj ? nearObj.func : APP.focus().func }); APP.switchTo('sheet'); });   // 走路途中：以要去的那棟為準

  /* ---------- 那一微秒：站在終點上，倒數、白光、交換 ---------- */
  var exchangeOpen = null;
  setInterval(function () {
    if (!cur.visiting || APP.view() !== 'game') { $('countdown').hidden = true; return; }
    var t = now(), b = CORE.myBookings(S(), me(), t).filter(function (x) { return x.owner === cur.role; })[0];
    if (!b || b.slot.atUs - t > 60e6) { $('countdown').hidden = true; return; }
    var standing = APP.standingAt() === cur.role.serial;
    if (t < b.slot.atUs) {
      $('countdown').hidden = false; $('countdown').textContent = ((b.slot.atUs - t) / 1e6).toFixed(1) + ' 秒' + (standing ? '' : '　先站到終點台上');
      if (standing && !exchangeOpen) { exchangeOpen = b.slot.id; exchangeDialog(b); }
    }
  }, 100);
  function exchangeDialog(b) {
    var max = CORE.remainingToday(S(), me(), now()), v0 = Math.min(APP.giveFor(b.slot.id), max);
    dialog({ title: '交換：給 ' + b.owner.name + ' 多少點？', body: '<input type="range" id="giveRange" min="0" max="' + max + '" value="' + v0 + '"><div class="num" id="giveShow">' + v0 + ' 點（最多 ' + max + '）</div>他每次給 ' + b.slot.give + ' 點。站著等那一微秒。', opts: [{ label: '確定', pri: true, fn: function () { APP.setGive(b.slot.id, +val('giveRange')); dialog(null); toast('會給 ' + val('giveRange') + ' 點。站著等那一微秒。', true); } }],
      after: function () { $('giveRange').oninput = function () { $('giveShow').textContent = $('giveRange').value + ' 點（最多 ' + max + '）'; APP.setGive(b.slot.id, +$('giveRange').value); }; APP.setGive(b.slot.id, v0); } });
  }
  APP.on('dock', function (r) {
    exchangeOpen = null;
    if (APP.view() !== 'game') return;
    if (r.ok) { WORLD.flash(); WORLD.showPartner(true); drawPlate(); dialog({ title: '到達那微秒', body: '和 ' + r.owner.name + ' 對接成立（' + r.docking.how + '）。\n你拿到 ' + r.docking.gaveA + ' ' + r.owner.name + '點，給了 ' + r.docking.gaveB + ' 點。' + (r.owner.contact ? '\n聯絡方式：' + r.owner.contact : ''), opts: [{ label: '好', pri: true, fn: function () { dialog(null); WORLD.showPartner(false); } }] }); }
    else toast('對接不成立：' + r.error, true);
  });
  APP.on('miss', function () { exchangeOpen = null; if (APP.view() === 'game' && cur.visiting) toast('錯過了那一微秒，這個時段不能再對接。', true); });

  /* ---------- 進出裡世界：切換時停在同一件事上 ---------- */
  function show() {
    var f = APP.focus(), m = me();
    if (!APP.focusChanged()) { drawPlate(); return; }   // 表世界沒換看別的東西：一切照舊，走到一半繼續走
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
  APP.on('view', function (v) { $('view-game').hidden = v !== 'game'; if (v === 'game') { WORLD.resume(); WORLD.resize(); show(); } else { dialog(null); WORLD.pause(); } });   // 表世界蓋著時 3D 暫停
  APP.on('me', function () { dec = new CORE.Decoder(me().world.walk); goHome(); });
  APP.on('change', function () { if (APP.view() === 'game') drawPlate(); });

  /* ---------- 開始 ---------- */
  dec = new CORE.Decoder(me().world.walk);
  cur = { role: me(), visiting: false };
  if (!WORLD.available) { $('stage').innerHTML = '<div class="nothree">3D 引擎沒載入，裡世界暫時不能用。按右上角「表 ⇄ 裡」用表世界，功能完全一樣。</div>'; }
  else { WORLD.init($('stage')); WORLD.loadWorld(me().world); }
  drawPlate();
  return { show: show, dialog: dialog, cur: function () { return cur; }, dec: function () { return dec; }, guideTo: guideTo, openPortal: openPortal, enterPortal: function () { if (portalRole) teleport(portalRole); }, teleportTo: teleport, goHome: goHome, setBuild: setBuild, nearObj: function () { return nearObj; }, stack: function () { return dlgStack; } };
})();
