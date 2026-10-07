/* ===== v6 接線：裡世界的 HUD、傳送、預約、那一微秒對接；表世界在 sheets.js ===== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = CORE.load();
  var me = state.roles[state.me] || state.roles[0];
  var cur = { role: me, visiting: false };
  var dec = new CORE.Decoder(me.world.walk);
  var nearObj = null, portalRole = null, msgTimer = null, target = null, openTarget = null, bookSlot = null, docked = {};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function refresh() { if (window.SHEET) SHEET.render(); }
  var now = CORE.nowUs;
  var allObjs = function (r) { return CORE.allObjects(r.world).map(function (x) { return x.o; }); };

  /* ---------- HUD ---------- */
  function msg(text, keep) {
    var el = $('hudMsg'); el.textContent = text; el.hidden = !text;
    clearTimeout(msgTimer);
    if (!keep && text) msgTimer = setTimeout(function () { el.hidden = true; }, 3200);
  }
  function drawCode() {
    var code = dec.code(), need = dec.need(), s = code || '—';
    if (need && code) s += '＿'.repeat(need);
    $('hudCode').textContent = s;
    $('hudCodeHint').textContent = dec.done ? '走完了' : !dec.letter && !dec.digits ? '先繞一個物件走出字母，或直接走數字' : '再從甲走到乙，走出 ' + need + ' 個數字';
    drawRoute();
  }
  function drawRoute() {
    var others = state.roles.filter(function (r) { return r !== me && CORE.status(r, now()) !== 'ended'; });
    var sel = $('hudTarget');
    var cur0 = target || (others[0] ? CORE.abbrev(others[0].serial) : null);
    sel.innerHTML = others.map(function (r) { return opt(CORE.abbrev(r.serial), CORE.abbrev(r.serial) + ' ' + r.name, cur0); }).join('');
    target = cur0;
    var box = $('hudRoute');
    if (!target) { box.hidden = true; return; }
    var rt = CORE.route(me.world.walk, allObjs(me), target);
    var doneN = dec.code().length;
    if (rt.missing) $('hudRouteText').textContent = '要去 ' + target + '：' + rt.missing + '，到表世界改走法表。';
    else {
      var got = 0;
      $('hudRouteText').innerHTML = '要去 ' + target + '：' + rt.steps.map(function (st) { var counts = /（[A-J0-9]）$/.test(st); var did = counts && got < doneN; if (counts) got++; return did ? '<s>' + esc(st) + '</s>' : esc(st); }).join('，');
    }
    box.hidden = false;
  }
  function drawWhere() {
    var r = cur.role, d = WORLD.depth ? WORLD.depth() : 0;
    $('hudWhere').textContent = (cur.visiting ? '在 ' + CORE.abbrev(r.serial) + ' ' + r.name + ' 的世界' : '自己的世界 ' + CORE.abbrev(r.serial)) + (d ? '，內部第 ' + d + ' 層' : '');
    $('btnLeave').hidden = !d;
    $('btnHome').hidden = !cur.visiting;
    $('hudCodeBox').hidden = cur.visiting;
    $('hudRoute').hidden = cur.visiting;
    $('hudGoal').hidden = !cur.visiting;
    $('giveBox').hidden = true;
    WORLD.setArcFilter(function (o) { return canCircle(o); });
  }
  function canCircle(o) { return !cur.visiting && !!o && me.world.walk.circles.some(function (c) { return c.object === o.id; }); }
  function fmtLife(r) { return CORE.fmtUs(r.life.startUs).slice(0, 16) + ' 到 ' + CORE.fmtUs(r.life.endUs).slice(0, 16) + '（剩 ' + Math.floor(CORE.daysLeft(r, now())) + ' 天）'; }
  var STATUS = { active: '正常', vacancy: '空窗', ended: '已結束' };

  // 規則建築：裡世界存在的理由，要做得最清楚
  function rulesText(r) {
    var ru = r.rules, lines = [];
    lines.push('【我的點能做什麼】' + (ru.uses.length ? '\n' + ru.uses.map(function (u) { return '・' + u; }).join('\n') : '（沒寫）'));
    lines.push('【對接條件】' + (ru.conditions.length ? '\n' + ru.conditions.map(function (c) { return '・' + CORE.condText(c); }).join('\n') : '（沒有條件，誰都通）'));
    lines.push('【開關】要求兩方都通：' + (ru.bothMustPass ? '開' : '關') + '；對方要先接受我的村規：' + (ru.mustAcceptVillage ? '開' : '關'));
    if (ru.village) lines.push('【村規】' + ru.village + '\n（誰寫的誰解釋）' + (cur.visiting ? (CORE.accepted(state, me.serial, r.serial) ? '\n你已接受' : '\n你還沒接受') : ''));
    if (cur.visiting) {
      var p = CORE.passes(state, r, me, now()), e = CORE.eligible(state, r, me, now());
      lines.push('【我通不通】' + (p.ok ? '我通他的條件' : '我不通：' + p.failed.join('；')) + '\n' + (e.ok ? '可以對接（' + e.how + '）' : '不能對接：' + e.reason));
    }
    return lines.join('\n');
  }
  function slotsText(r) {
    var up = r.slots.filter(function (s) { return s.atUs >= now(); }).sort(function (a, b) { return a.atUs - b.atUs; });
    if (!up.length) return '沒有開放的對接時段。';
    return up.slice(0, 4).map(function (s) { return '・' + CORE.fmtUs(s.atUs) + '　名額 ' + s.bookings.length + '／' + s.capacity + '，主人每次給 ' + s.give + ' 點' + (s.bookings.indexOf(me.serial) >= 0 ? '（你預約了）' : ''); }).join('\n');
  }
  function drawNear(o) {
    var box = $('hudNear');
    $('btnOpen').hidden = true; $('btnEnter').hidden = true; $('btnBook').hidden = true; $('btnAccept').hidden = true; bookSlot = null; openTarget = null;
    if (!o) { box.hidden = true; $('btnCircle').hidden = true; return; }
    var f = CORE.FUNCS[o.func] || CORE.FUNCS.none, r = cur.role, body = '';
    if (o.func === 'rule') {
      body = rulesText(r);
      if (cur.visiting && r.rules.village && !CORE.accepted(state, me.serial, r.serial)) $('btnAccept').hidden = false;
      openTarget = { sheet: 'rules', id: r.serial + ':' }; $('btnOpen').hidden = false; $('btnOpen').textContent = '看規則表';
    } else if (o.func === 'resource') {
      body = (r.resources.length ? r.resources.map(function (x) { return '・' + x.name + '：' + x.price + ' ' + r.name + '點，還有 ' + x.qty + ' 份'; }).join('\n') : '（沒有列資源）') +
        (cur.visiting ? '\n你手上有 ' + CORE.balance(state, me.serial, r.serial, now()) + ' ' + r.name + '點' + (CORE.status(r, now()) === 'vacancy' ? '；他在空窗期，暫停兌現' : '') : '\n你今天還能給 ' + CORE.remainingToday(state, me, now()) + ' 點');
      openTarget = { sheet: cur.visiting ? 'redeem' : 'resources', id: r.serial + ':' }; $('btnOpen').hidden = false; $('btnOpen').textContent = cur.visiting ? '去兌現' : '看資源表';
    } else if (o.func === 'goal') {
      body = slotsText(r);
      if (cur.visiting) {
        var e = CORE.eligible(state, r, me, now());
        var free = r.slots.filter(function (s) { return s.atUs > now() && s.bookings.length < s.capacity && s.bookings.indexOf(me.serial) < 0; }).sort(function (a, b) { return a.atUs - b.atUs; })[0];
        body += '\n' + (e.ok ? '條件通（' + e.how + '）' : '條件不通：' + e.reason);
        if (e.ok && free) { bookSlot = free; $('btnBook').hidden = false; $('btnBook').textContent = '預約 ' + CORE.fmtUs(free.atUs).slice(11, 19); }
      } else { openTarget = { sheet: 'slots', id: null }; $('btnOpen').hidden = false; $('btnOpen').textContent = '開對接時段'; }
    } else if (o.func === 'role') {
      body = '每天 ' + r.dailyPoints + ' ' + r.name + '點\n週期：' + fmtLife(r) + '\n狀態：' + STATUS[CORE.status(r, now())] + '\n對接過 ' + CORE.dockCount(state, r.serial) + ' 次' + (r.prev ? '\n前身：' + CORE.abbrev(r.prev) : '') +
        (cur.visiting && CORE.contactVisible(state, r, me.serial, now()) && r.contact ? '\n聯絡方式：' + r.contact : '');
      openTarget = { sheet: 'roles', id: r.serial }; $('btnOpen').hidden = false; $('btnOpen').textContent = '看角色表';
    } else if (o.func === 'points') {
      if (cur.visiting) body = '只有主人看得到。';
      else { var hs = CORE.holdings(state, me.serial, now()); body = (hs.length ? hs.map(function (g) { return '・' + g.issuer.name + '點 ' + g.amount + '（' + STATUS[g.status] + '）'; }).join('\n') : '手上沒有別人的點。') + '\n今天還能給 ' + CORE.remainingToday(state, me, now()) + ' 點'; openTarget = { sheet: 'points', id: null }; $('btnOpen').hidden = false; $('btnOpen').textContent = '看點數帳'; }
    } else body = '純地標，沒有功能。';
    if (o.door) {
      var open = o.door.visible !== 'self' || !cur.visiting;
      body += (body ? '\n' : '') + (open ? '有一扇門。' : '有一扇門，關著。');
      $('btnEnter').hidden = !open || WORLD.depth() >= 3;
    }
    $('hudNearTitle').textContent = '這裡是' + f.label + '：' + o.name;
    $('hudNearBody').textContent = body;
    box.hidden = false;
    $('btnCircle').hidden = !canCircle(o);
  }

  /* ---------- 世界事件 ---------- */
  WORLD.on('near', function (o) { nearObj = o; drawNear(o); });
  WORLD.on('turn', function (o, n) { if (!cur.visiting) msg('繞 ' + o.name + ' ' + n + ' 圈'); });
  WORLD.on('circle', function (o, n) { if (cur.visiting) return; var r = dec.feed({ type: 'circle', object: o.id, count: n }); if (r.type === 'letter') { msg('字母 ' + r.letter + '，再走 ' + r.need + ' 個數字'); drawCode(); } });
  WORLD.on('arrive', function (o) {
    if (cur.visiting) return;
    var r = dec.feed({ type: 'arrive', object: o.id });
    if (r.type === 'digit') { msg('數字 ' + r.digit); drawCode(); }
    else if (r.type === 'done') { drawCode(); openPortal(r.code); }
  });
  WORLD.on('portal', function () { if (portalRole) teleport(portalRole); });

  function openPortal(code) {
    var role = CORE.findRole(state, code);
    if (!role || role === me) { msg(role === me ? code + ' 是自己，走別人的代號' : '沒有 ' + code + ' 這個角色', true); setTimeout(function () { dec.reset(); drawCode(); msg(''); }, 2200); return; }
    portalRole = role; WORLD.showPortal();
    msg('走出了 ' + code + '，白光傳送門打開了。點傳送門過去。', true);
  }
  function teleport(role) {
    var chk = CORE.tryClean(role);   // 世界只能是資料
    if (chk.error) { msg(role.name + ' 的資料不是純資料（' + chk.error + '），不載入。', true); WORLD.hidePortal(); portalRole = null; return; }
    cur = { role: role, visiting: true };
    portalRole = null; WORLD.flash();
    WORLD.loadWorld(chk.role.world, { visiting: true });
    drawWhere(); drawNear(null);
    msg('到了 ' + role.name + ' 的世界。沿路看他的規則建築，走到終點。', true);
  }
  function goHome() {
    if (cur.visiting) WORLD.flash();
    cur = { role: me, visiting: false };
    dec.reset(); drawCode(); WORLD.loadWorld(me.world); drawWhere(); drawNear(null); msg('');
  }
  $('btnHome').addEventListener('click', goHome);
  $('btnOpen').addEventListener('click', function () { if (!openTarget) return; showTab('sheet'); SHEET.navigate(openTarget.sheet, openTarget.id); });
  $('btnReset').addEventListener('click', function () { dec.reset(); drawCode(); WORLD.hidePortal(); portalRole = null; msg('重走'); });
  $('btnCircle').addEventListener('click', function () { if (nearObj) WORLD.circleAround(nearObj.id); });
  $('hudTarget').addEventListener('change', function () { target = $('hudTarget').value; drawRoute(); });
  $('btnEnter').addEventListener('click', function () { if (nearObj && WORLD.enter(nearObj.id)) { WORLD.flash(); drawWhere(); drawNear(null); } });
  $('btnLeave').addEventListener('click', function () { if (WORLD.leave()) { WORLD.flash(); drawWhere(); drawNear(null); } });
  $('btnBook').addEventListener('click', function () {
    if (!bookSlot) return;
    try { CORE.book(state, me.serial, bookSlot.id, now()); CORE.save(state); msg('預約好了：' + CORE.fmtUs(bookSlot.atUs) + '。那一微秒站在終點上就對接。' + (cur.role.contact ? '聯絡方式：' + cur.role.contact : ''), true); drawNear(nearObj); refresh(); }
    catch (e) { msg(e.message, true); }
  });
  $('btnAccept').addEventListener('click', function () { CORE.accept(state, me.serial, cur.role.serial); CORE.save(state); msg('你接受了 ' + cur.role.name + ' 的村規。'); drawNear(nearObj); refresh(); });

  /* ---------- 那一微秒：預約者站在主人的終點上就對接 ---------- */
  function goalId(role) { var g = allObjs(role).find(function (o) { return o.func === 'goal'; }); return g ? g.id : null; }
  var lastMiss = 0;
  setInterval(function () {
    $('clock').textContent = CORE.fmtUs(now());
    var t = now();
    // 規則層清算：過了判定窗還沒對接的預約，標為錯過
    if (CORE.expire(state, t)) { CORE.save(state); refresh(); if (cur.visiting) msg('那一微秒過了，這次錯過，這個時段不能再對接。', true); }
    if (!cur.visiting) return;
    var r = cur.role;
    var mine = r.slots.filter(function (s) { return s.bookings.indexOf(me.serial) >= 0 && s.docked.indexOf(me.serial) < 0 && !CORE.missed(s, me.serial) && !docked[s.id]; }).sort(function (a, b) { return a.atUs - b.atUs; });
    var g = goalId(r), onIt = g ? WORLD.distanceTo(g) < 1.0 : false;
    if (!mine.length) { var ms = r.slots.filter(function (s) { return CORE.missed(s, me.serial); }).length; $('hudGoalText').textContent = ms ? '錯過了 ' + ms + ' 個時段；' + (r.slots.some(function (s) { return s.atUs > t && s.bookings.indexOf(me.serial) < 0 && s.bookings.length < s.capacity; }) ? '可以再預約' : '沒有別的時段了') : '你沒有預約 ' + r.name + ' 的時段'; $('giveBox').hidden = true; return; }
    var s = mine[0];
    if (t < s.atUs) {
      $('hudGoalText').textContent = '離對接還有 ' + ((s.atUs - t) / 1e6).toFixed(1) + ' 秒' + (onIt ? '，你在終點上' : '，先走到終點台');
      $('giveBox').hidden = false;
      var max = CORE.remainingToday(state, me, t); $('giveIn').max = max; if (+$('giveIn').value > max) $('giveIn').value = max;
      return;
    }
    // 那一微秒到了：只有站在終點上的這一格判定算數；不在就等規則層標錯過
    if (!onIt) { $('hudGoalText').textContent = '那一微秒到了，你不在終點上'; $('giveBox').hidden = true; return; }
    docked[s.id] = true;
    try {
      var give = Math.min(+$('giveIn').value || 0, CORE.remainingToday(state, me, t));
      var ownerGive = Math.min(s.give, CORE.remainingToday(state, r, t));
      var d = CORE.dock(state, s.id, me.serial, ownerGive, give, t);
      state.records.push({ kind: 'dock', at: t, text: CORE.abbrev(me.serial) + ' 與 ' + CORE.abbrev(r.serial) + ' 在 ' + CORE.fmtUs(t) + ' 對接：' + r.name + ' 給 ' + d.gaveA + ' 點，' + me.name + ' 給 ' + d.gaveB + ' 點（' + d.how + '）' });
      CORE.save(state); refresh();
      $('hudGoalText').textContent = '對接成立'; $('giveBox').hidden = true;
      $('meetText').textContent = CORE.abbrev(me.serial) + ' ' + me.name + ' 與 ' + CORE.abbrev(r.serial) + ' ' + r.name + ' 在 ' + CORE.fmtUs(t) + ' 對接成立（' + d.how + '）。';
      $('meetProblems').textContent = '你拿到 ' + d.gaveA + ' ' + r.name + '點，給了 ' + d.gaveB + ' ' + me.name + '點。' + (r.contact ? '聯絡方式：' + r.contact : '');
      $('meet').hidden = false;
    } catch (e) { $('hudGoalText').textContent = '對接不成立'; $('giveBox').hidden = true; msg(e.message, true); }
  }, 50);
  $('meetClose').addEventListener('click', function () { $('meet').hidden = true; goHome(); });
  $('meetOpen').addEventListener('click', function () { $('meet').hidden = true; goHome(); showTab('sheet'); SHEET.navigate('dockings', null); });

  /* ---------- 共用 ---------- */
  function becomeMe(i) { state.me = i; me = state.roles[i]; dec = new CORE.Decoder(me.world.walk); target = null; docked = {}; CORE.save(state); goHome(); refresh(); }
  function walkChanged() { CORE.save(state); dec = new CORE.Decoder(me.world.walk); drawCode(); drawNear(nearObj); }
  function resetAll() { state = CORE.fresh(); me = state.roles[0]; dec = new CORE.Decoder(me.world.walk); target = null; docked = {}; CORE.save(state); goHome(); refresh(); }
  function showTab(name) {
    $('view-world').hidden = name !== 'world'; $('view-sheet').hidden = name !== 'sheet'; $('fxbar').hidden = name !== 'sheet';
    if (name === 'world') { WORLD.resize(); if (window.SHEET) SHEET.renderTabs(); } else refresh();
  }
  function worldRefresh(role, objId) { if (role === cur.role) { if (objId) WORLD.refreshObject(objId); else WORLD.loadWorld(role.world, { visiting: cur.visiting }); } }

  if (typeof THREE === 'undefined') { $('hudMsg').hidden = false; $('hudMsg').textContent = '3D 引擎沒載入，請檢查網路後重新整理。表世界分頁還是能用。'; }
  else { WORLD.init($('stage')); WORLD.loadWorld(me.world); }
  drawCode(); drawWhere(); drawNear(null);
  window.APP = {
    state: function () { return state; }, me: function () { return me; }, cur: function () { return cur; }, dec: function () { return dec; },
    save: function () { CORE.save(state); }, msg: msg, becomeMe: becomeMe, goHome: goHome, showTab: showTab, isWorld: function () { return $('view-world') && !$('view-world').hidden; },
    openPortal: function (code) { showTab('world'); if (cur.visiting) goHome(); dec.reset(); drawCode(); openPortal(code); },
    enterPortal: function () { if (portalRole) teleport(portalRole); }, teleportTo: teleport, nearObj: function () { return nearObj; },
    walkChanged: walkChanged, worldRefresh: worldRefresh, resetAll: resetAll, refresh: refresh, esc: esc, opt: opt
  };
})();
