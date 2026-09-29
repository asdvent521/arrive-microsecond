/* ===== 接線：把資料層和畫面層接起來，加上 HUD 和表世界分頁 ===== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = DATA.load();
  var me = state.roles[0];
  var cur = { role: me, visiting: false };
  var dec = new DATA.Decoder(me.walk);
  var nearObj = null, portalRole = null, resolved = false, msgTimer = null;

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
    if (need) s += '＿'.repeat(need);
    $('hudCode').textContent = s;
    $('hudCodeHint').textContent = dec.done ? '走完了' : !dec.letter ? '先繞一個物件，走出字母' : '再從甲走到乙，走出 ' + need + ' 個數字';
  }
  function drawWhere() {
    var r = cur.role;
    $('hudWhere').textContent = cur.visiting ? '在 ' + DATA.abbrev(r.serial) + ' ' + r.name + ' 的世界' : '自己的世界 ' + DATA.abbrev(r.serial);
    $('btnHome').hidden = !cur.visiting;
    $('hudCodeBox').hidden = cur.visiting;
    $('hudGoal').hidden = !cur.visiting;
  }
  function canCircle(o) {
    return !cur.visiting && !!o && me.walk.circles.some(function (c) { return c.object === o.id; });
  }
  function drawNear(o) {
    var box = $('hudNear');
    if (!o) { box.hidden = true; $('btnCircle').hidden = true; return; }
    var f = DATA.FUNCS[o.func] || DATA.FUNCS.none;
    var r = cur.role, body = '';
    if (o.func === 'rule') body = visibleTo(r.rules, f) ;
    else if (o.func === 'problem') body = visibleTo(r.problems, f);
    else if (o.func === 'goal') body = '出發點：' + DATA.fmtUs(r.departUs);
    else if (o.func === 'fusion') body = cur.visiting ? '只有參與者看得到。' : (state.records.filter(function (x) { return x.kind === 'meet'; }).slice(-1)[0] || {}).text || '還沒有融合紀錄。';
    else if (o.func === 'stage') body = cur.visiting ? '只有參與者看得到。' : '還沒有階段。';
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
    cur = { role: role, visiting: true };
    resolved = false; portalRole = null;
    WORLD.loadWorld(role, { visiting: true });
    drawWhere(); drawNear(null);
    msg('到了 ' + role.name + ' 的世界。沿著路走到終點，沿途看他的規則。', true);
  }
  function goHome() {
    cur = { role: me, visiting: false };
    dec.reset(); drawCode();
    WORLD.loadWorld(me);
    drawWhere(); drawNear(null); msg('');
  }
  $('btnHome').addEventListener('click', goHome);
  $('btnReset').addEventListener('click', function () { dec.reset(); drawCode(); WORLD.hidePortal(); portalRole = null; msg('重走'); });
  $('btnCircle').addEventListener('click', function () { if (nearObj) WORLD.circleAround(nearObj.id); });

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
    DATA.save(state); renderRecords();
  }
  setInterval(function () {
    // 時鐘
    $('clock').textContent = DATA.fmtUs(DATA.nowUs());
    if (!cur.visiting) return;
    var r = cur.role, now = DATA.nowUs();
    var g = goalId(r);
    var onIt = g ? WORLD.distanceTo(g) < 1.0 : false;
    if (r.departUs == null) { $('hudGoal').textContent = '對方還沒寫出發點'; return; }
    if (resolved) return;
    if (now < r.departUs) {
      $('hudGoal').textContent = '離出發點還有 ' + ((r.departUs - now) / 1e6).toFixed(1) + ' 秒' + (onIt ? '，你在終點上' : '');
      return;
    }
    resolved = true;
    if (onIt) {
      var t = DATA.abbrev(me.serial) + ' 與 ' + DATA.abbrev(r.serial) + ' ' + r.name + ' 在 ' + DATA.fmtUs(r.departUs) + ' 相遇，兩個難題融合了。';
      record('meet', t);
      $('hudGoal').textContent = '相遇了';
      $('meetText').textContent = t;
      $('meetProblems').textContent = '「' + (me.problems[0] || {}).text + '」＋「' + (r.problems[0] || {}).text + '」';
      $('meet').hidden = false;
    } else {
      var t2 = r.name + ' 的出發點 ' + DATA.fmtUs(r.departUs) + ' 沒有人到終點，難題擱置。';
      record('shelve', t2);
      $('hudGoal').textContent = '錯過了，擱置';
      msg(t2, true);
    }
  }, 50);
  $('meetClose').addEventListener('click', function () { $('meet').hidden = true; goHome(); });

  /* ---------- 表世界 ---------- */
  function opt(v, label, sel) { return '<option value="' + v + '"' + (v === sel ? ' selected' : '') + '>' + label + '</option>'; }
  function objOptions(role, sel) { return role.objects.map(function (o) { return opt(o.id, o.name, sel); }).join(''); }

  function renderRoles() {
    $('tblRoles').innerHTML = state.roles.map(function (r, i) {
      return '<tr><td class="num">' + r.serial + '</td><td class="num"><b>' + DATA.abbrev(r.serial) + '</b></td>' +
        '<td><input type="text" data-role="' + i + '" data-k="name" value="' + esc(r.name) + '" aria-label="名字"></td>' +
        '<td><input type="text" data-role="' + i + '" data-k="problem" value="' + esc((r.problems[0] || {}).text || '') + '" aria-label="難題"></td>' +
        '<td><input type="text" data-role="' + i + '" data-k="rule" value="' + esc((r.rules[0] || {}).text || '') + '" aria-label="規則"></td>' +
        '<td class="num">' + DATA.fmtUs(r.departUs) + '<div class="row"><button class="btn sm" data-dep="' + i + '" data-s="30">30 秒後</button><button class="btn sm" data-dep="' + i + '" data-s="90">90 秒後</button><button class="btn sm" data-dep="' + i + '" data-s="0">清掉</button></div></td></tr>';
    }).join('');
  }
  $('tblRoles').addEventListener('change', function (e) {
    var t = e.target, r = state.roles[+t.dataset.role]; if (!r) return;
    if (t.dataset.k === 'name') r.name = t.value;
    else if (t.dataset.k === 'problem') r.problems[0] = { text: t.value, status: 'open' };
    else if (t.dataset.k === 'rule') r.rules[0] = { text: t.value, visible: 'all' };
    DATA.save(state); drawWhere();
  });
  $('tblRoles').addEventListener('click', function (e) {
    var b = e.target.closest('[data-dep]'); if (!b) return;
    var r = state.roles[+b.dataset.dep], s = +b.dataset.s;
    r.departUs = s ? DATA.nowUs() + s * 1e6 + Math.floor(Math.random() * 1000) : null;
    resolved = false;
    DATA.save(state); renderRoles();
  });

  function renderWalk() {
    var w = me.walk;
    $('tblCircles').innerHTML = w.circles.map(function (c, i) {
      return '<tr><td><select data-c="' + i + '" data-k="object" aria-label="物件">' + objOptions(me, c.object) + '</select></td>' +
        '<td><select data-c="' + i + '" data-k="letter" aria-label="一圈是">' + 'JIHGFEDCBA'.split('').map(function (L) { return opt(L, L, c.letter); }).join('') + '</select></td>' +
        '<td class="muted small">兩圈 ' + prev(c.letter, 1) + '、三圈 ' + prev(c.letter, 2) + '</td><td><button class="btn sm" data-del-c="' + i + '">刪</button></td></tr>';
    }).join('');
    $('tblMoves').innerHTML = w.moves.map(function (m, i) {
      return '<tr><td><select data-m="' + i + '" data-k="from" aria-label="從">' + objOptions(me, m.from) + '</select></td>' +
        '<td><select data-m="' + i + '" data-k="to" aria-label="走到">' + objOptions(me, m.to) + '</select></td>' +
        '<td><select data-m="' + i + '" data-k="digit" aria-label="數字">' + '1234567890'.split('').map(function (d) { return opt(d, d, m.digit); }).join('') + '</select></td>' +
        '<td><button class="btn sm" data-del-m="' + i + '">刪</button></td></tr>';
    }).join('');
  }
  function prev(L, n) { var c = L.charCodeAt(0) - n; return c >= 65 ? String.fromCharCode(c) : '—'; }
  function walkChanged() { DATA.save(state); dec = new DATA.Decoder(me.walk); drawCode(); renderWalk(); drawNear(nearObj); }
  $('walkBox').addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.c != null) me.walk.circles[+t.dataset.c][t.dataset.k] = t.value;
    else if (t.dataset.m != null) me.walk.moves[+t.dataset.m][t.dataset.k] = t.value;
    walkChanged();
  });
  $('walkBox').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.delC != null) me.walk.circles.splice(+b.dataset.delC, 1);
    else if (b.dataset.delM != null) me.walk.moves.splice(+b.dataset.delM, 1);
    else if (b.id === 'addCircle') me.walk.circles.push({ object: me.objects[0].id, letter: 'J' });
    else if (b.id === 'addMove') me.walk.moves.push({ from: me.objects[0].id, to: me.objects[1].id, digit: '1' });
    else return;
    walkChanged();
  });

  var editRole = 0;
  function renderObjects() {
    var r = state.roles[editRole];
    $('objRole').innerHTML = state.roles.map(function (x, i) { return opt(String(i), DATA.abbrev(x.serial) + ' ' + x.name, String(editRole)); }).join('');
    $('tblObjects').innerHTML = r.objects.map(function (o, i) {
      var looks = Object.keys(DATA.LOOKS).map(function (k) { return opt(k, k, o.look); }).join('') + opt('', '（自訂形體）', o.look || '');
      return '<tr><td><input type="text" data-o="' + i + '" data-k="name" value="' + esc(o.name) + '" aria-label="名稱"></td>' +
        '<td><select data-o="' + i + '" data-k="func" aria-label="功能">' + Object.keys(DATA.FUNCS).map(function (k) { return opt(k, DATA.FUNCS[k].label, o.func); }).join('') + '</select></td>' +
        '<td><select data-o="' + i + '" data-k="look" aria-label="外觀">' + looks + '</select></td>' +
        '<td><input type="color" data-o="' + i + '" data-k="color" value="' + (o.parts[0] ? o.parts[0].color : '#999999') + '" aria-label="顏色"></td>' +
        '<td><input type="number" class="xy" data-o="' + i + '" data-k="x" value="' + o.pos[0] + '" step="1" aria-label="x"></td>' +
        '<td><input type="number" class="xy" data-o="' + i + '" data-k="z" value="' + o.pos[1] + '" step="1" aria-label="z"></td>' +
        '<td class="muted small">' + o.parts.length + ' 個形體</td></tr>';
    }).join('');
  }
  $('objRole').addEventListener('change', function () { editRole = +$('objRole').value; renderObjects(); });
  $('tblObjects').addEventListener('change', function (e) {
    var t = e.target, r = state.roles[editRole], o = r.objects[+t.dataset.o]; if (!o) return;
    var k = t.dataset.k;
    if (k === 'name') o.name = t.value;
    else if (k === 'func') o.func = t.value;
    else if (k === 'x') o.pos[0] = +t.value || 0;
    else if (k === 'z') o.pos[1] = +t.value || 0;
    else if (k === 'look' || k === 'color') {
      var color = k === 'color' ? t.value : (o.parts[0] ? o.parts[0].color : '#999999');
      var lk = k === 'look' ? t.value : o.look;
      if (lk) { o.look = lk; o.parts = DATA.look(lk, color); }
      else o.parts.forEach(function (p, j) { if (j === 0) p.color = color; });
    }
    DATA.save(state);
    if (r === cur.role) WORLD.refreshObject(o.id);
    renderObjects(); renderWalk();
  });
  $('codeGo').addEventListener('click', function () {
    var code = $('codeIn').value.trim().toUpperCase();
    if (!code) return;
    dec.reset(); drawCode();
    showTab('world');
    if (cur.visiting) goHome();
    openPortal(code);
  });
  $('btnDefault').addEventListener('click', function () {
    state = { v: 5, roles: DATA.defaultRoles(), records: [] };
    me = state.roles[0]; DATA.save(state);
    editRole = 0; renderAll(); goHome();
  });
  function renderRecords() {
    $('records').innerHTML = state.records.length ? state.records.slice().reverse().map(function (x) {
      return '<li><span class="tag ' + x.kind + '">' + (x.kind === 'meet' ? '相遇' : '擱置') + '</span> ' + esc(x.text) + '</li>';
    }).join('') : '<li class="muted">還沒有紀錄。</li>';
  }
  function renderAll() { renderRoles(); renderWalk(); renderObjects(); renderRecords(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- 分頁 ---------- */
  function showTab(name) {
    $('view-world').hidden = name !== 'world';
    $('view-sheet').hidden = name !== 'sheet';
    document.querySelectorAll('.tabs a').forEach(function (a) {
      if (a.dataset.tab === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (name === 'world') WORLD.resize();
  }
  document.querySelectorAll('.tabs a').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); showTab(a.dataset.tab); });
  });

  /* ---------- 開始 ---------- */
  if (typeof THREE === 'undefined') {
    $('hudMsg').hidden = false;
    $('hudMsg').textContent = '3D 引擎沒載入，請檢查網路後重新整理。表世界分頁還是能用。';
  } else {
    WORLD.init($('stage'));
    WORLD.loadWorld(me);
  }
  renderAll(); drawCode(); drawWhere(); drawNear(null);
  showTab(location.hash === '#sheet' ? 'sheet' : 'world');
  window.APP = { state: function () { return state; }, dec: function () { return dec; }, cur: function () { return cur; }, showTab: showTab,
    enterPortal: function () { if (portalRole) teleport(portalRole); }, save: function () { DATA.save(state); } };
})();
