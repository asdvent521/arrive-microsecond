/* ===== 接線：裡世界的 HUD、傳送、那一微秒；表世界在 sheets.js ===== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = DATA.load();
  var me = state.roles[state.me] || state.roles[0];
  var cur = { role: me, visiting: false };
  var dec = new DATA.Decoder(me.walk);
  var nearObj = null, portalRole = null, resolved = false, msgTimer = null;
  var target = null;   // HUD 教學要去的代號
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function refresh() { if (window.SHEET) SHEET.render(); }

  /* ---------- HUD ---------- */
  function msg(text, keep) {
    var el = $('hudMsg'); el.textContent = text; el.hidden = !text;
    clearTimeout(msgTimer);
    if (!keep && text) msgTimer = setTimeout(function () { el.hidden = true; }, 3200);
  }
  function drawCode() {
    var code = dec.code();
    var need = dec.need();
    var s = code || '—';
    if (need && code) s += '＿'.repeat(need);      // 還沒開始走就只顯示一條線
    $('hudCode').textContent = s;
    $('hudCodeHint').textContent = dec.done ? '走完了' : !dec.letter && !dec.digits ? '先繞一個物件走出字母，或直接走數字' : '再從甲走到乙，走出 ' + need + ' 個數字';
    drawRoute();
  }
  // HUD 教學：要去某個代號，用自己的走法該怎麼走
  function drawRoute() {
    var others = state.roles.filter(function (r) { return r !== me; });
    var sel = $('hudTarget');
    var cur0 = target || (others[0] ? DATA.abbrev(others[0].serial) : null);
    sel.innerHTML = others.map(function (r) { return opt(DATA.abbrev(r.serial), DATA.abbrev(r.serial) + ' ' + r.name, cur0); }).join('');
    target = cur0;
    var box = $('hudRoute');
    if (!target) { box.hidden = true; return; }
    var rt = DATA.route(me.walk, me.objects, target);
    var doneN = dec.code().length;
    if (rt.missing) { $('hudRouteText').textContent = '要去 ' + target + '：' + rt.missing + '，到表世界改走法表。'; }
    else {
      var got = 0;
      var html = rt.steps.map(function (st) {
        var counts = /（[A-J0-9]）$/.test(st);
        var did = counts && got < doneN;
        if (counts) got++;
        return did ? '<s>' + esc(st) + '</s>' : esc(st);
      }).join('，');
      $('hudRouteText').innerHTML = '要去 ' + target + '：' + html;
    }
    box.hidden = false;
  }
  function drawWhere() {
    var r = cur.role;
    $('hudWhere').textContent = cur.visiting ? '在 ' + DATA.abbrev(r.serial) + ' ' + r.name + ' 的世界' : '自己的世界 ' + DATA.abbrev(r.serial);
    $('btnHome').hidden = !cur.visiting;
    $('hudCodeBox').hidden = cur.visiting;
    $('hudRoute').hidden = cur.visiting;
    $('hudGoal').hidden = !cur.visiting;
    WORLD.setArcFilter(function (o) { return canCircle(o); });
  }
  function canCircle(o) {
    return !cur.visiting && !!o && me.walk.circles.some(function (c) { return c.object === o.id; });
  }
  function drawNear(o) {
    var box = $('hudNear');
    $('btnOpen').hidden = true;
    if (!o) { box.hidden = true; $('btnCircle').hidden = true; return; }
    var f = DATA.FUNCS[o.func] || DATA.FUNCS.none;
    var r = cur.role, body = '';
    if (o.func === 'rule') body = visibleTo(DATA.currentRules(r).items, f);
    else if (o.func === 'problem') { var p = DATA.activeProblem(r); body = p ? p.text : '（還沒立難題）'; }
    else if (o.func === 'goal') body = '出發點：' + DATA.fmtUs(r.departUs);
    else if (o.func === 'fusion' || o.func === 'stage') {
      var fo = FUSION.openFor(state, r.serial);
      if (!fo) body = '還沒有融合。';
      else if (!FUSION.isMember(fo, me.serial)) body = '只有參與者看得到。';
      else if (o.func === 'fusion') body = '融合難題：' + fo.text + '\n下一個出發點：' + (fo.nextUs == null ? '還沒約' : DATA.fmtUs(fo.nextUs));
      else body = fo.stages.length ? fo.stages.map(function (st) { return '・' + st.text + '（' + FUSION.STATUS[st.status] + '）'; }).join('\n') : '還沒有階段。';
      $('btnOpen').hidden = !fo || !FUSION.isMember(fo, me.serial);
    }
    else body = '純地標，沒有功能。';
    $('hudNearTitle').textContent = '這裡是' + f.label + '：' + o.name;
    $('hudNearBody').textContent = body;
    box.hidden = false;
    $('btnCircle').hidden = !canCircle(o);
  }
  function visibleTo(list, f) {
    if (!list || !list.length) return '（空的）';
    if (cur.visiting && f.visible === 'cond') {
      var open = list.filter(function (x) { return x.visible !== 'self'; });
      return open.length ? open.map(function (x) { return x.text; }).join('\n') : '主人沒有開放。';
    }
    return list.map(function (x) { return x.text; }).join('\n');
  }

  /* ---------- 世界事件 ---------- */
  WORLD.on('near', function (o) { nearObj = o; drawNear(o); });
  WORLD.on('turn', function (o, n) { if (!cur.visiting) msg('繞 ' + o.name + ' ' + n + ' 圈'); });
  WORLD.on('circle', function (o, n) {
    if (cur.visiting) return;
    var r = dec.feed({ type: 'circle', object: o.id, count: n });
    if (r.type === 'letter') { msg('字母 ' + r.letter + '，再走 ' + r.need + ' 個數字'); drawCode(); }
  });
  WORLD.on('arrive', function (o) {
    if (cur.visiting) { if (o.func === 'goal') onGoal(); return; }
    var r = dec.feed({ type: 'arrive', object: o.id });
    if (r.type === 'digit') { msg('數字 ' + r.digit); drawCode(); }
    else if (r.type === 'done') { drawCode(); openPortal(r.code); }
  });
  WORLD.on('portal', function () { if (portalRole) teleport(portalRole); });

  function openPortal(code) {
    var role = DATA.findRole(state, code);
    if (!role || role === me) {
      msg(role === me ? code + ' 是自己，走別人的代號' : '沒有 ' + code + ' 這個角色', true);
      setTimeout(function () { dec.reset(); drawCode(); msg(''); }, 2200);
      return;
    }
    portalRole = role;
    WORLD.showPortal();
    msg('走出了 ' + code + '，白光傳送門打開了。點傳送門過去。', true);
  }
  function teleport(role) {
    // 世界只能是資料：讀進來之前先洗一遍，不合格就不載入
    var chk = DATA.tryClean(role);
    if (chk.error) { msg(role.name + ' 的世界不是純資料（' + chk.error + '），不載入。', true); WORLD.hidePortal(); portalRole = null; return; }
    cur = { role: role, visiting: true, world: chk.world };
    resolved = false; portalRole = null;
    WORLD.flash();
    WORLD.loadWorld(chk.world, { visiting: true });
    drawWhere(); drawNear(null);
    msg('到了 ' + role.name + ' 的世界。沿著路走到終點，沿途看他的規則。', true);
  }
  function goHome() {
    if (cur.visiting) WORLD.flash();
    cur = { role: me, visiting: false };
    dec.reset(); drawCode();
    WORLD.loadWorld(me);
    drawWhere(); drawNear(null); msg('');
  }
  $('btnHome').addEventListener('click', goHome);
  function openFusion() { var f = FUSION.openFor(state, me.serial); showTab('sheet'); SHEET.navigate('fusion', f ? f.id : null); }
  $('btnOpen').addEventListener('click', openFusion);
  $('meetOpen').addEventListener('click', function () { $('meet').hidden = true; goHome(); openFusion(); });
  $('btnReset').addEventListener('click', function () { dec.reset(); drawCode(); WORLD.hidePortal(); portalRole = null; msg('重走'); });
  $('btnCircle').addEventListener('click', function () { if (nearObj) WORLD.circleAround(nearObj.id); });
  $('hudTarget').addEventListener('change', function () { target = $('hudTarget').value; drawRoute(); });

  /* ---------- 終點與那一微秒 ---------- */
  function goalId(role) { var g = role.objects.find(function (o) { return o.func === 'goal'; }); return g ? g.id : null; }
  function onGoal() {
    var r = cur.role;
    if (r.departUs == null) msg(r.name + ' 還沒寫出發點，可以逛，見不到面。', true);
    else if (resolved) return;
    else if (DATA.nowUs() < r.departUs) msg('站在終點台上等那一微秒。', true);
  }
  function record(kind, text) {
    state.records.push({ kind: kind, at: DATA.nowUs(), text: text });
    DATA.save(state);
  }
  function shelve(role, why) {
    var t = DATA.abbrev(role.serial) + ' ' + role.name + ' 的出發點 ' + DATA.fmtUs(role.departUs) + why + '，難題擱置。';
    role.departDone = true;
    var p = DATA.activeProblem(role); if (p) p.status = 'shelved';
    record('shelve', t);
    return t;
  }
  setInterval(function () {
    $('clock').textContent = DATA.fmtUs(DATA.nowUs());
    var now0 = DATA.nowUs(), changed = false;
    // 融合的期限：不在任何參與者的世界時，就是沒人來
    state.fusions.forEach(function (fz) {
      if (fz.status === 'shelved' || fz.nextUs == null || now0 < fz.nextUs) return;
      if (cur.visiting && FUSION.isMember(fz, cur.role.serial) && !resolved) return;   // 正在參與者的世界，由下面判
      var res = FUSION.deadline(state, fz, now0, []);
      if (res) { changed = true; msg(res === 'shelved' ? '融合「' + fz.text + '」的出發點沒人來，擱置。' : '融合「' + fz.text + '」完成。', true); }
    });
    state.roles.forEach(function (x) {
      if (x.departUs == null || x.departDone || now0 < x.departUs) return;
      if (cur.visiting && cur.role === x) return;        // 正在他的世界，由下面判
      var t = shelve(x, '一個人都沒來');
      changed = true; msg(t, true);
    });
    if (changed) { DATA.save(state); refresh(); }
    if (!cur.visiting) return;
    var r = cur.role, now = DATA.nowUs();
    var g = goalId(r);
    var onIt = g ? WORLD.distanceTo(g) < 1.0 : false;
    if (r.departUs == null) { $('hudGoal').textContent = '對方還沒寫出發點'; return; }
    if (r.departDone && !resolved) { $('hudGoal').textContent = '這個出發點已經過了'; return; }
    if (resolved) return;
    var fz = FUSION.byDepart(state, r.departUs);
    if (now < r.departUs) {
      $('hudGoal').textContent = '離出發點還有 ' + ((r.departUs - now) / 1e6).toFixed(1) + ' 秒' + (onIt ? '，你在終點上' : '') + (fz ? '（融合的期限）' : '');
      return;
    }
    resolved = true;
    if (fz) {
      // 這個出發點是融合難題的期限：非參與者到任何一位參與者的終點才算有人來
      var res2 = FUSION.deadline(state, fz, now, onIt ? [me.serial] : []);
      DATA.save(state); refresh();
      var tx = { done: '融合難題已經可處理，完成。', joined: '你加入了這個融合，大家要再約下一個出發點。', shelved: FUSION.isMember(fz, me.serial) && onIt ? '只有參與者自己在終點，沒有別人來，融合難題和原難題一起擱置。' : '沒有人到終點，融合難題和原難題一起擱置。' }[res2] || '';
      $('hudGoal').textContent = res2 === 'shelved' ? '錯過了，擱置' : '到了';
      msg(tx, true); $('btnOpen').hidden = res2 === 'shelved';
      return;
    }
    if (onIt) {
      var t = DATA.abbrev(me.serial) + ' 與 ' + DATA.abbrev(r.serial) + ' ' + r.name + ' 在 ' + DATA.fmtUs(r.departUs) + ' 相遇，兩個難題融合了。';
      r.departDone = true; me.departDone = true;
      record('meet', t);
      var fu = FUSION.create(state, [me, r], r.departUs);
      DATA.save(state); refresh();
      $('hudGoal').textContent = '相遇了';
      $('meetText').textContent = t;
      $('meetProblems').textContent = '融合難題：' + fu.text;
      $('meet').hidden = false;
    } else {
      var t2 = shelve(r, ' 沒有人到終點');
      DATA.save(state); refresh();
      $('hudGoal').textContent = '錯過了，擱置';
      msg(t2, true);
    }
  }, 50);
  $('meetClose').addEventListener('click', function () { $('meet').hidden = true; goHome(); });

  /* ---------- 共用：換角色、重設、分頁 ---------- */
  function becomeMe(i) {
    state.me = i; me = state.roles[i];
    dec = new DATA.Decoder(me.walk); target = null;
    DATA.save(state);
    goHome(); refresh();
  }
  function walkChanged() { DATA.save(state); dec = new DATA.Decoder(me.walk); drawCode(); drawNear(nearObj); }
  function resetAll() {
    state = DATA.fresh(); me = state.roles[0]; dec = new DATA.Decoder(me.walk); target = null; DATA.save(state);
    goHome(); refresh();
  }
  function showTab(name) {
    $('view-world').hidden = name !== 'world';
    $('view-sheet').hidden = name !== 'sheet';
    $('fxbar').hidden = name !== 'sheet';
    if (name === 'world') { WORLD.resize(); if (window.SHEET) SHEET.renderTabs(); }
    else refresh();
  }
  function worldRefresh(role, objId) { if (role === cur.role) { if (objId) WORLD.refreshObject(objId); else WORLD.loadWorld(role, { visiting: cur.visiting }); } }

  /* ---------- 開始 ---------- */
  if (typeof THREE === 'undefined') {
    $('hudMsg').hidden = false;
    $('hudMsg').textContent = '3D 引擎沒載入，請檢查網路後重新整理。表世界分頁還是能用。';
  } else {
    WORLD.init($('stage'));
    WORLD.loadWorld(me);
  }
  drawCode(); drawWhere(); drawNear(null);
  window.APP = {
    state: function () { return state; }, me: function () { return me; }, cur: function () { return cur; }, dec: function () { return dec; },
    save: function () { DATA.save(state); }, msg: msg, becomeMe: becomeMe, goHome: goHome, showTab: showTab, isWorld: function () { return $('view-world') && !$('view-world').hidden; },
    openPortal: function (code) { showTab('world'); if (cur.visiting) goHome(); dec.reset(); drawCode(); openPortal(code); },
    enterPortal: function () { if (portalRole) teleport(portalRole); }, teleportTo: teleport,
    walkChanged: walkChanged, worldRefresh: worldRefresh, resetAll: resetAll, record: record, refresh: refresh, esc: esc, opt: opt
  };
})();
