/* ===== 接線：把資料層和畫面層接起來，加上 HUD 和表世界分頁 ===== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = DATA.load();
  var me = state.roles[state.me] || state.roles[0];
  var cur = { role: me, visiting: false };
  var dec = new DATA.Decoder(me.walk);
  var nearObj = null, portalRole = null, resolved = false, msgTimer = null;
  var target = null;   // HUD 教學要去的代號

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
      // 已經走出來的部分劃掉：字母算一步，每個數字一步（「走到甲」不算）
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
    if (o.func === 'rule') body = visibleTo(r.rules, f) ;
    else if (o.func === 'problem') body = visibleTo(r.problems, f);
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
  function openFusion() { showTab('sheet'); $('fusionBox').scrollIntoView(); }
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
    DATA.save(state); renderRecords();
  }
  function shelve(role, why) {
    var t = DATA.abbrev(role.serial) + ' ' + role.name + ' 的出發點 ' + DATA.fmtUs(role.departUs) + why + '，難題擱置。';
    role.departDone = true;
    if (role.problems[0]) role.problems[0].status = 'shelved';
    record('shelve', t);
    return t;
  }
  setInterval(function () {
    // 時鐘
    $('clock').textContent = DATA.fmtUs(DATA.nowUs());
    var now0 = DATA.nowUs();
    // 每個角色自己的出發點：那一微秒過了、沒人在他的終點（不是正在被拜訪的那個），就擱置
    // 融合的期限：不在任何參與者的世界時，就是沒人來
    state.fusions.forEach(function (fz) {
      if (fz.status === 'shelved' || fz.nextUs == null || now0 < fz.nextUs) return;
      if (cur.visiting && FUSION.isMember(fz, cur.role.serial) && !resolved) return;   // 正在參與者的世界，由下面判
      var res = FUSION.deadline(state, fz, now0, []);
      if (res) { DATA.save(state); renderRoles(); renderFusions(); renderRecords(); msg(res === 'shelved' ? '融合「' + fz.text + '」的出發點沒人來，擱置。' : '融合「' + fz.text + '」完成。', true); }
    });
    state.roles.forEach(function (x) {
      if (x.departUs == null || x.departDone || now0 < x.departUs) return;
      if (cur.visiting && cur.role === x) return;        // 正在他的世界，由下面判
      var t = shelve(x, '一個人都沒來');
      renderRoles();
      msg(t, true);
    });
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
      // 這個出發點是融合難題的期限：第三個人到任何一位參與者的終點都算有人來
      var res = FUSION.deadline(state, fz, now, onIt ? [me.serial] : []);
      DATA.save(state); renderRoles(); renderFusions(); renderRecords();
      var tx = { done: '融合難題已經可處理，完成。', joined: '你加入了這個融合，大家要再約下一個出發點。', shelved: FUSION.isMember(fz, me.serial) && onIt ? '只有參與者自己在終點，沒有別人來，融合難題和原難題一起擱置。' : '沒有人到終點，融合難題和原難題一起擱置。' }[res] || '';
      $('hudGoal').textContent = res === 'shelved' ? '錯過了，擱置' : '到了';
      msg(tx, true); $('btnOpen').hidden = res === 'shelved';
      return;
    }
    if (onIt) {
      var t = DATA.abbrev(me.serial) + ' 與 ' + DATA.abbrev(r.serial) + ' ' + r.name + ' 在 ' + DATA.fmtUs(r.departUs) + ' 相遇，兩個難題融合了。';
      r.departDone = true; me.departDone = true;
      if (r.problems[0]) r.problems[0].status = 'fused';
      if (me.problems[0]) me.problems[0].status = 'fused';
      record('meet', t);
      var fu = FUSION.create(state, [me, r], r.departUs);
      DATA.save(state); renderRoles(); renderFusions();
      $('hudGoal').textContent = '相遇了';
      $('meetText').textContent = t;
      $('meetProblems').textContent = '融合難題：' + fu.text;
      $('meet').hidden = false;
    } else {
      var t2 = shelve(r, ' 沒有人到終點');
      renderRoles();
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
      var st = (r.problems[0] || {}).status, stTag = st === 'shelved' ? '<span class="tag shelve">擱置</span> ' : st === 'fused' ? '<span class="tag meet">融合</span> ' : st === 'exited' ? '<span class="tag exit">退出</span> ' : '';
      return '<tr><td><label class="me"><input type="radio" name="meIs" value="' + i + '"' + (r === me ? ' checked' : '') + '> ' + (r === me ? '我' : '') + '</label></td>' +
        '<td class="num">' + r.serial + '</td><td class="num"><b>' + DATA.abbrev(r.serial) + '</b></td>' +
        '<td><input type="text" data-role="' + i + '" data-k="name" value="' + esc(r.name) + '" aria-label="名字"></td>' +
        '<td>' + stTag + '<input type="text" data-role="' + i + '" data-k="problem" value="' + esc((r.problems[0] || {}).text || '') + '" aria-label="難題"></td>' +
        '<td><input type="text" data-role="' + i + '" data-k="rule" value="' + esc((r.rules[0] || {}).text || '') + '" aria-label="規則"></td>' +
        '<td class="num">' + DATA.fmtUs(r.departUs) + (r.departUs != null && r.departDone ? ' <span class="muted small">（已過）</span>' : '') + '<div class="row"><button class="btn sm" data-dep="' + i + '" data-s="30">30 秒後</button><button class="btn sm" data-dep="' + i + '" data-s="90">90 秒後</button><button class="btn sm" data-dep="' + i + '" data-s="0">清掉</button></div></td></tr>';
    }).join('');
  }
  function becomeMe(i) {
    state.me = i; me = state.roles[i];
    dec = new DATA.Decoder(me.walk); target = null;
    DATA.save(state);
    $('walkWho').textContent = '我的世界 ' + DATA.abbrev(me.serial) + ' ' + me.name;
    renderRoles(); renderWalk(); renderFusions(); renderPoints(); goHome();
  }
  $('tblRoles').addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'meIs') { becomeMe(+t.value); return; }
    var r = state.roles[+t.dataset.role]; if (!r) return;
    if (t.dataset.k === 'name') r.name = t.value;
    else if (t.dataset.k === 'problem') r.problems[0] = { text: t.value, status: 'open' };
    else if (t.dataset.k === 'rule') r.rules[0] = { text: t.value, visible: 'all' };
    DATA.save(state); drawWhere();
  });
  $('tblRoles').addEventListener('click', function (e) {
    var b = e.target.closest('[data-dep]'); if (!b) return;
    var r = state.roles[+b.dataset.dep], s = +b.dataset.s;
    if (FUSION.openFor(state, r.serial)) { sheetMsg(r.name + ' 在融合裡，出發點要在融合區全員約定。'); return; }
    r.departUs = s ? DATA.nowUs() + s * 1e6 + Math.floor(Math.random() * 1000) : null;
    r.departDone = false;
    if (r.problems[0] && r.problems[0].status !== 'open') r.problems[0] = { text: r.problems[0].text, status: 'open', visible: 'all' };  // 重創難題
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
        '<td><select data-m="' + i + '" data-k="digit" aria-label="數字">' + '0123456789'.split('').map(function (d) { return opt(d, d, m.digit); }).join('') + '</select></td>' +
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
    state = DATA.fresh();
    me = state.roles[0]; dec = new DATA.Decoder(me.walk); target = null; DATA.save(state);
    editRole = 0; $('walkWho').textContent = '我的世界 ' + DATA.abbrev(me.serial) + ' ' + me.name; renderAll(); goHome();
  });
  /* ---------- 融合區：動作都以「我是」做 ---------- */
  function roleName(serial) { var r = state.roles.find(function (x) { return x.serial === serial; }); return r ? DATA.abbrev(serial) + ' ' + r.name : serial; }
  function renderFusions() {
    var box = $('fusions');
    if (!state.fusions.length) { box.innerHTML = '<p class="muted">還沒有融合。到別人的世界，在他的出發點那一微秒站在終點上。</p>'; return; }
    box.innerHTML = state.fusions.slice().reverse().map(function (f) {
      var mine = FUSION.isMember(f, me.serial), act = FUSION.active(f), open = f.status === 'open';
      var members = f.members.map(function (m) { return f.exits.indexOf(m) >= 0 ? '<s>' + esc(roleName(m)) + '</s>' : esc(roleName(m)); }).join('、');
      var next;
      if (f.nextUs != null) next = '<span class="num">' + DATA.fmtUs(f.nextUs) + '</span>';
      else if (f.nextProposal) {
        next = esc(roleName(f.nextProposal.by)) + ' 提議 <span class="num">' + DATA.fmtUs(f.nextProposal.us) + '</span>，同意的：' + f.nextProposal.agreed.map(roleName).map(esc).join('、') +
          (mine && open && f.nextProposal.agreed.indexOf(me.serial) < 0 ? ' <button class="btn sm pri" data-f="' + f.id + '" data-act="agreeNext">同意</button>' : '');
      } else next = '還沒約' + (mine && open ? ' <button class="btn sm" data-f="' + f.id + '" data-act="proposeNext" data-s="60">60 秒後</button> <button class="btn sm" data-f="' + f.id + '" data-act="proposeNext" data-s="180">3 分鐘後</button>' : '');
      var ready = f.nextUs != null;                       // 沒約好下一個出發點：只能約，不能提階段、不能執行
      var stages = f.stages.map(function (st) {
        var a = '';
        if (mine && open && !ready) a = '<span class="muted small">先約下一個出發點</span>';
        else if (mine && open) {
          if (st.status === 'proposed' && st.agreed.indexOf(me.serial) < 0) a = btn(f, st, 'agreeStage', '同意', 'pri');
          else if (st.status === 'proposed') a = '<span class="muted small">等其他人同意</span>';
          else if (st.status === 'agreed') a = btn(f, st, 'claimStage', '我來執行');
          else if (st.status === 'doing' && st.owner === me.serial) a = btn(f, st, 'submitStage', '做完了，交判');
          else if (st.status === 'judging' && st.judges[me.serial] == null) a = btn(f, st, 'judgeOk', '判完成', 'pri') + ' ' + btn(f, st, 'judgeNo', '判未完成');
          else if (st.status === 'judging') a = '<span class="muted small">等其他人判</span>';
          else if (st.status === 'dispute') a = (st.dispute[me.serial] ? '<span class="muted small">你投了：' + (st.dispute[me.serial] === 'done' ? '完成' : '退回') + '</span> ' : '') + btn(f, st, 'disputeDone', '改判完成') + ' ' + btn(f, st, 'disputeBack', '退回執行');
        }
        return '<tr><td style="white-space:normal;min-width:12em">' + esc(st.text) + '</td><td>' + esc(roleName(st.by)) + '</td><td><span class="tag ' + st.status + '">' + FUSION.STATUS[st.status] + '</span></td><td>' + (st.owner ? esc(roleName(st.owner)) : '—') + '</td><td>' + a + '</td></tr>';
      }).join('');
      var kcal = FUSION.allStagesDone(f)
        ? act.map(function (m) { var v = f.calories[m]; return '<label class="me">' + esc(roleName(m)) + '：' + (m === me.serial && open ? '<input type="number" min="0" step="10" data-f="' + f.id + '" data-act="kcal" value="' + (v == null ? '' : v) + '" aria-label="熱量"> 大卡' : (v == null ? '<span class="muted">還沒填</span>' : '<span class="num">' + v + ' 大卡</span>')) + '</label>'; }).join(' ')
        : '<span class="muted small">所有階段判定完成後才能填。</span>';
      return '<div class="fus' + (mine ? ' mine' : '') + '" data-fid="' + f.id + '">' +
        '<h3><span class="tag ' + f.status + '">' + FUSION.FSTATUS[f.status] + '</span> ' + esc(f.text) + '</h3>' +
        '<dl class="kv"><dt>參與者</dt><dd>' + members + '</dd><dt>下一個出發點</dt><dd>' + next + '</dd><dt>熱量</dt><dd>' + kcal + '</dd></dl>' +
        '<div class="tw"><table><thead><tr><th>階段</th><th>構思</th><th>狀態</th><th>執行者</th><th></th></tr></thead><tbody>' + (stages || '<tr><td colspan="5" class="muted">還沒有階段。</td></tr>') + '</tbody></table></div>' +
        (mine && open ? '<div class="tools">' + (ready ? '<input type="text" data-stage-in="' + f.id + '" placeholder="拆一個階段，例如：訂出開工時間" aria-label="新階段"><button class="btn sm" data-f="' + f.id + '" data-act="proposeStage">提出階段</button>' : '<span class="tag open">先約下一個出發點</span><span class="muted small">約好才能拆階段、執行。</span>') + '<button class="btn sm" data-f="' + f.id + '" data-act="exit" style="margin-left:auto">退出</button></div>' : '') +
        '<ul class="log">' + f.log.slice(-4).map(function (l) { return '<li>' + esc(l.text) + '</li>'; }).join('') + '</ul></div>';
    }).join('');
  }
  function btn(f, st, act, label, cls) { return '<button class="btn sm' + (cls ? ' ' + cls : '') + '" data-f="' + f.id + '" data-st="' + st.id + '" data-act="' + act + '">' + label + '</button>'; }
  function sheetMsg(t) { var el = $('sheetMsg'); el.textContent = t; el.hidden = false; setTimeout(function () { el.hidden = true; }, 3000); }
  function fusionAction(f, act, sid, el) {
    var me0 = me.serial;
    switch (act) {
      case 'proposeNext': FUSION.proposeNext(state, f, me0, DATA.nowUs() + (+el.dataset.s) * 1e6 + Math.floor(Math.random() * 1000)); break;
      case 'agreeNext': FUSION.agreeNext(state, f, me0); break;
      case 'proposeStage': var inp = document.querySelector('[data-stage-in="' + f.id + '"]'); FUSION.proposeStage(state, f, me0, inp.value); inp.value = ''; break;
      case 'agreeStage': FUSION.agreeStage(state, f, sid, me0); break;
      case 'claimStage': FUSION.claimStage(state, f, sid, me0); break;
      case 'submitStage': FUSION.submitStage(state, f, sid, me0); break;
      case 'judgeOk': FUSION.judge(state, f, sid, me0, true); break;
      case 'judgeNo': FUSION.judge(state, f, sid, me0, false); break;
      case 'disputeDone': FUSION.disputeVote(state, f, sid, me0, 'done'); break;
      case 'disputeBack': FUSION.disputeVote(state, f, sid, me0, 'back'); break;
      case 'kcal': FUSION.setCalories(state, f, me0, +el.value); break;
      case 'exit': FUSION.exit(state, f, me0); break;
    }
  }
  var fusionBusy = false;   // 重畫會讓輸入框失焦、再觸發 change，用旗標擋掉套疊
  function onFusionEvent(e) {
    if (fusionBusy) return;
    var el = e.target.closest('[data-act]'); if (!el) return;
    if (e.type === 'change' && el.dataset.act !== 'kcal') return;
    if (e.type === 'click' && el.dataset.act === 'kcal') return;
    var f = state.fusions.find(function (x) { return x.id === el.dataset.f; }); if (!f) return;
    fusionBusy = true;
    try {
      try { fusionAction(f, el.dataset.act, el.dataset.st, el); }
      catch (err) { sheetMsg(err.message); return; }
      DATA.save(state); renderFusions(); renderPoints(); renderRoles(); renderRecords(); drawNear(nearObj);
    } finally { fusionBusy = false; }
  }
  $('fusions').addEventListener('click', onFusionEvent);
  $('fusions').addEventListener('change', onFusionEvent);
  function renderPoints() {
    var mine = FUSION.pointsOf(state, me.serial);
    $('pointsSum').innerHTML = '<span class="tag meet">我拿到 題點 ' + mine.got.idea + '・戰點 ' + mine.got.battle + '</span><span class="tag open">我發出 題點 ' + mine.gave.idea + '・戰點 ' + mine.gave.battle + '</span>';
    $('tblPoints').innerHTML = state.points.length ? state.points.slice().reverse().map(function (p) {
      var f = state.fusions.find(function (x) { return x.id === p.fusion; }), st = f && f.stages.find(function (x) { return x.id === p.stage; });
      return '<tr><td class="num">' + DATA.fmtUs(p.atUs) + '</td><td>' + (p.kind === 'idea' ? '題點' : '戰點') + '</td><td>' + esc(roleName(p.from)) + '</td><td>' + esc(roleName(p.to)) + '</td><td class="num">' + p.amount + '</td><td class="num">' + esc(p.ruleVersion) + '</td><td style="white-space:normal">' + esc(st ? st.text : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="muted">還沒有點數。</td></tr>';
  }
  function renderRecords() {
    $('records').innerHTML = state.records.length ? state.records.slice().reverse().map(function (x) {
      return '<li><span class="tag ' + x.kind + '">' + ({ meet: '相遇', shelve: '擱置', exit: '退出' }[x.kind] || x.kind) + '</span> ' + esc(x.text) + '</li>';
    }).join('') : '<li class="muted">還沒有紀錄。</li>';
  }
  function renderAll() { renderRoles(); renderWalk(); renderObjects(); renderFusions(); renderPoints(); renderRecords(); }
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
  $('walkWho').textContent = '我的世界 ' + DATA.abbrev(me.serial) + ' ' + me.name;
  renderAll(); drawCode(); drawWhere(); drawNear(null);
  showTab(location.hash === '#sheet' ? 'sheet' : 'world');
  window.APP = { state: function () { return state; }, dec: function () { return dec; }, cur: function () { return cur; }, showTab: showTab,
    enterPortal: function () { if (portalRole) teleport(portalRole); }, save: function () { DATA.save(state); },
    teleportTo: teleport, me: function () { return me; }, becomeMe: becomeMe };
})();
