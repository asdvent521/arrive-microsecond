/* ===== v9 達秒屋的畫面：外面整個畫面就是達秒屋 =====
 * 最上面一列：序號框、去、隨機、誰的達秒屋、回我的表格世界。自己的屋多一個「蓋」。
 * 點門牆的磚看那天、點門到他的表格世界；蓋的時候：選方塊、點一個面加一塊、切到「拆」點一塊拿掉、點擺設轉方向、復原上一步、範本。
 * 3D 用不了就顯示成日曆。只呼叫 APP、CORE、KIT、WORLD。
 */
var HOUSE = (function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = APP.esc;
  var st = { serial: null, building: false, kind: 'brick', mode: 'add', undo: [], month: 0, shown: false, ready: false };
  function me() { return APP.me(); }
  function viewer() { return APP.isBlank() ? null : me().serial; }
  function data() { return CORE.viewHouse(APP.state(), st.serial, viewer(), APP.now()); }
  function mine() { return !APP.isBlank() && st.serial === me().serial; }

  function ensure() {
    if (st.ready) return;
    st.ready = true;
    if (WORLD.available && WORLD.init($('hstage'))) { WORLD.onTap(onTap); $('hcal').hidden = true; }
    else { WORLD.available = false; $('hstage').hidden = true; $('hcal').hidden = false; }
    $('hblk').innerHTML = Object.keys(CORE.BLOCKS).map(function (k) { var b = CORE.BLOCKS[k]; return '<button type="button" data-blk="' + k + '" aria-label="' + esc(b.name) + '"><span class="sw" style="background:' + b.hex + (b.type === 'glass' ? ';opacity:.6' : '') + '"></span>' + esc(b.name) + '</button>'; }).join('');
  }
  function render(opts) {
    if (!st.shown) return;
    var r = APP.roleOf(st.serial); if (!r) { st.serial = me().serial; r = APP.roleOf(st.serial); }
    if (!r) return;
    var v = data(), own = mine();
    if (!own || !WORLD.available) st.building = false;
    $('hwho').innerHTML = '<b>' + esc(CORE.abbrev(r.serial) + ' ' + r.name) + '</b> 的達秒屋' + (v.closed ? ' <span class="tag off">只給鄰居看</span>' : '<span class="small muted"> ' + esc(v.age.text + (v.sign ? '・「' + v.sign + '」' : '')) + '</span>');
    $('hBuild').hidden = !own || !WORLD.available; $('hBuild').textContent = st.building ? '蓋好了' : '蓋'; $('hBuild').classList.toggle('pri', st.building);
    $('hDoor').hidden = st.building;
    $('hDoor').textContent = own ? '進門（我的表格世界）' : '進門（他的表格世界）';
    $('hbuild').hidden = !st.building;
    if (st.building) {
      $('hblk').querySelectorAll('[data-blk]').forEach(function (b) { b.classList.toggle('on', b.dataset.blk === st.kind); });
      $('hModeAdd').classList.toggle('on', st.mode === 'add'); $('hModeDel').classList.toggle('on', st.mode === 'remove');
      $('hUndo').disabled = !st.undo.length;
    }
    $('hhint').textContent = st.building ? (st.mode === 'add' ? '選一種方塊，點一個面加一塊；點擺設轉方向。' : '拆：點一塊就拿掉。') + '地皮 ' + v.plot.size + '×' + v.plot.size + '、高 ' + v.plot.height + '，蓋了 ' + v.look.n + ' 塊' : (WORLD.available ? '一指拖著轉、兩指縮放；點門牆的磚看那天，點門進' + (own ? '我' : '他') + '的表格世界' : '3D 用不了：達秒屋顯示成日曆，點一格跟點一塊磚一樣');
    tutBar();
    if (WORLD.available) { var vb = $('view-house').getBoundingClientRect(), hb = document.querySelector('.hbar').getBoundingClientRect(), fb = document.querySelector('.hfoot').getBoundingClientRect(); WORLD.setInsets(hb.bottom - vb.top, vb.bottom - fb.top); }
    if (WORLD.available) WORLD.show(v, { building: st.building, resetCamera: opts && opts.resetCamera });
    else { $('hcal').innerHTML = KIT.calendar(st.serial, viewer(), st.month); KIT.bindCalendar($('hcal'), function (m) { st.month = m; render(); }); }
  }
  function tutBar() {
    var on = APP.tutActive() && !APP.isBlank(), stp = on ? APP.steps() : null;
    $('htut').hidden = !on;
    if (on) $('htut').innerHTML = '<span class="small">' + esc(stp.hint) + '</span>' + (APP.tut().step === 8 ? '<button type="button" class="btn sm pri" data-hact="myHouse">去我的達秒屋</button>' : '') + '<button type="button" class="btn sm warn" data-hact="tutSkip">跳過教學</button>';
  }
  function onTap(hit) {
    if (!hit) return;
    if (st.building) { buildTap(hit); return; }
    var v = data();
    if (hit.kind === 'door') { goDoor(); return; }
    if (hit.kind === 'brick') { if (v.closed) { msg('只給鄰居看：點不開'); return; } var b = v.bricks.find(function (x) { return x.day === hit.day; }); if (!b || (!b.n && !b.cover)) { msg(CORE.dayLabel(hit.day) + '：這一天沒有紀錄'); return; } KIT.dayPop(st.serial, hit.day, function () { render(); }); }
  }

  /* ---------- 蓋：每一步都記下怎麼復原 ---------- */
  function buildTap(hit) {
    var S = APP.state(), s = me().serial, now = APP.now();
    if (hit.kind === 'door' || hit.kind === 'brick' || hit.kind === 'gate') { KIT.pop('放不上去', '大門不能蓋。'); return; }
    if (st.mode === 'remove') {
      if (hit.kind !== 'block') return;
      act(function () { var b = CORE.removeBlock(S, s, hit.x, hit.y, hit.z); return function () { CORE.addBlock(S, s, b, APP.now()); }; }, '拆了一塊');
      return;
    }
    if (hit.kind === 'block' && hit.prop) { act(function () { CORE.rotateBlock(S, s, hit.x, hit.y, hit.z); return function () { for (var i = 0; i < 3; i++) CORE.rotateBlock(S, s, hit.x, hit.y, hit.z); }; }, '轉了 90 度'); return; }
    var x = hit.x, y = hit.y, z = hit.z;
    if (hit.kind === 'block') { x += hit.n[0]; y += hit.n[1]; z += hit.n[2]; }
    var k = st.kind;
    act(function () { var b = CORE.addBlock(S, s, CORE.BLOCKS[k].type === 'prop' ? [x, y, z, k, 0] : [x, y, z, k], now); return function () { CORE.removeBlock(S, s, b[0], b[1], b[2]); }; }, '加了一塊' + CORE.BLOCKS[k].name);
  }
  // 做一步：成功就把「怎麼復原」放進去；擋下就跳提示，什麼都沒改
  function act(fn, ok) {
    var r = APP.run(fn, ok);
    if (r.ok) { if (typeof r.value === 'function') st.undo.push(r.value); if (st.undo.length > 200) st.undo.shift(); msg(r.msg); }
    else KIT.pop('放不上去', r.msg);
    render();
  }
  function undo() {
    var f = st.undo.pop(); if (!f) { msg('沒有可以復原的'); return; }
    var r = APP.run(function () { f(); }, '復原了上一步'); msg(r.ok ? r.msg : '復原不了：' + r.msg); render();
  }
  function templates() {
    var n = data().look.n;
    KIT.pop('範本', '按一下就蓋出來，再自己改。換範本會把現在蓋的換掉。', Object.keys(CORE.TEMPLATES).map(function (k) { return { label: CORE.TEMPLATES[k], fn: function () { confirmReplace(n, '換成「' + CORE.TEMPLATES[k] + '」', function () { return CORE.template(k); }); } }; }).concat([{ label: '全部拆掉', warn: true, fn: function () { confirmReplace(n, '全部拆掉', function () { return []; }); } }, { label: '不要', pri: true }]));
  }
  function confirmReplace(n, what, list) {
    KIT.pop(what + '？', '現在蓋的 ' + n + ' 塊會被換掉（之後可以按「復原上一步」換回來）。', [{ label: '換掉', warn: true, fn: function () { act(function () { var S = APP.state(), s = me().serial, old = CORE.setBlocks(S, s, list(), APP.now()); return function () { CORE.setBlocks(S, s, old, APP.now()); }; }, what + '了'); } }, { label: '不要', pri: true }]);
  }
  function msg(t) { var el = $('hmsg'); el.textContent = t || ''; el.hidden = !t; clearTimeout(msg.t); if (t) msg.t = setTimeout(function () { el.hidden = true; }, 3500); }
  function goDoor() { var s = st.serial; if (s !== me().serial) APP.tutEvent('door'); APP.goTable(s, 'role', 'door'); }
  function goSerial() {
    var code = $('hSerialIn').value.trim(); if (!code) { msg('先輸入序號，例如 J2'); return; }
    var r = CORE.findRole(APP.state(), code); if (!r) { msg('找不到序號 ' + code); return; }
    if (r.serial === APP.GUIDE) APP.tutEvent('foundGuide');
    APP.goHouse(r.serial);
  }
  $('view-house').addEventListener('click', function (e) {
    var blk = e.target.closest('[data-blk]'); if (blk) { st.kind = blk.dataset.blk; st.mode = 'add'; render(); return; }
    var b = e.target.closest('[data-hact]'); if (!b) return;
    var a = b.dataset.hact;
    if (a === 'go') goSerial();
    else if (a === 'random') { var r = CORE.randomRole(APP.state(), viewer()); if (!r) { msg('沒有別人'); return; } APP.tutEvent('houseRandom'); APP.goHouse(r.serial); }
    else if (a === 'back') APP.goTable(null, null);
    else if (a === 'build') { st.building = !st.building; st.mode = 'add'; render(); }
    else if (a === 'modeAdd') { st.mode = 'add'; render(); }
    else if (a === 'modeDel') { st.mode = 'remove'; render(); }
    else if (a === 'undo') undo();
    else if (a === 'tpl') templates();
    else if (a === 'door') goDoor();
    else if (a === 'myHouse') APP.goHouse(me().serial);
    else if (a === 'tutSkip') { APP.tutSkip(); msg('跳過了教學。想只收不給，記得要有 0 點的空物件。'); tutBar(); }
  });
  $('hSerialIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') goSerial(); });

  /* ---------- 事件 ---------- */
  APP.on('view', function (v) {
    if (v.name === 'house') {
      var changedHouse = st.serial !== v.serial; st.serial = v.serial; if (changedHouse) { st.building = false; st.undo = []; st.month = 0; }
      if (v.build && mine()) st.building = true;
      st.shown = true; $('view-house').hidden = false; document.body.classList.add('in-house'); ensure();
      if (WORLD.available) { WORLD.resume(); WORLD.resize(); }
      render({ resetCamera: changedHouse });
    } else { st.shown = false; st.building = false; $('view-house').hidden = true; document.body.classList.remove('in-house'); if (WORLD.available) WORLD.pause(); }
  });
  APP.on('change', function () { if (st.shown) render(); });
  APP.on('tut', function () { if (st.shown) tutBar(); });
  // 教學第 8 步：鏡頭靠近門牆上的第一塊磚，框起來
  APP.on('firstBrick', function () {
    var v = st.shown ? data() : null;
    if (v && WORLD.available) { render(); WORLD.focusDay(v.born); }
    KIT.pop('你 0 歲，第一塊磚亮了', '就是上面門牆上框起來的那一塊。每天一塊磚，成交的那天會亮；門以外的房子可以按「蓋」自己蓋。教學完成！', null, null, { low: true });
  });
  // 成交那一刻正好開著：白光一閃，今天那塊磚亮起來（重畫就亮）
  APP.on('dock', function (res) { if (!st.shown) return; var hit = res.some(function (x) { return x.docking && x.docking.traded && (x.docking.a === st.serial || x.docking.b === st.serial); }); render(); if (hit) KIT.flash(); });
  return { st: st, render: render, data: data };
})();
