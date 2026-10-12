/* ===== v9 達秒屋的畫面：外面整個畫面就是達秒屋 =====
 * 最上面一列：序號框、去、隨機、誰的達秒屋、回我的表格世界（自己的屋多一個「擺設」）。
 * 點磚看那天、點門到他的表格世界、擺設模式放擺設。3D 用不了就顯示成日曆。只呼叫 APP、CORE、KIT、WORLD。
 */
var HOUSE = (function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = APP.esc;
  var st = { serial: null, placing: false, month: 0, shown: false, ready: false };
  function me() { return APP.me(); }
  function viewer() { return APP.isBlank() ? null : me().serial; }
  function data() { return CORE.viewHouse(APP.state(), st.serial, viewer(), APP.now()); }

  function ensure() {
    if (st.ready) return;
    st.ready = true;
    if (WORLD.available && WORLD.init($('hstage'))) { WORLD.onTap(onTap); $('hcal').hidden = true; }
    else { WORLD.available = false; $('hstage').hidden = true; $('hcal').hidden = false; }
  }
  function render(opts) {
    if (!st.shown) return;
    var r = APP.roleOf(st.serial); if (!r) { st.serial = me().serial; r = APP.roleOf(st.serial); }
    if (!r) return;
    var v = data(), mine = !APP.isBlank() && st.serial === me().serial;
    if (!mine) st.placing = false;
    $('hwho').innerHTML = '<b>' + esc(CORE.abbrev(r.serial) + ' ' + r.name) + '</b> 的達秒屋' + (v.closed ? ' <span class="tag off">只給鄰居看</span>' : '<span class="small muted"> ' + esc(v.age.text) + (v.sign ? '・「' + v.sign + '」' : '') + '</span>');
    $('hPlace').hidden = !mine || !WORLD.available; $('hPlace').textContent = st.placing ? '擺好了' : '擺設';
    $('hDoor').textContent = mine ? '進門（我的表格世界）' : '進門（他的表格世界）';
    $('hhint').textContent = st.placing ? '點地上的圓格放一樣擺設；點擺好的可以轉方向或拿掉（最多 ' + CORE.PROP_MAX + ' 個）' : (WORLD.available ? '一指拖著轉、兩指縮放；點一塊磚看那天，點門進' + (mine ? '我' : '他') + '的表格世界' : '3D 用不了：達秒屋顯示成日曆，點一格跟點一塊磚一樣');
    tutBar();
    if (WORLD.available) { var vb = $('view-house').getBoundingClientRect(), hb = document.querySelector('.hbar').getBoundingClientRect(), fb = document.querySelector('.hfoot').getBoundingClientRect(); WORLD.setInsets(hb.bottom - vb.top, vb.bottom - fb.top); }
    if (WORLD.available) WORLD.show(v, { placing: st.placing, resetCamera: opts && opts.resetCamera });
    else { $('hcal').innerHTML = KIT.calendar(st.serial, viewer(), st.month); KIT.bindCalendar($('hcal'), function (m) { st.month = m; render(); }); }
  }
  function tutBar() {
    var on = APP.tutActive() && !APP.isBlank(), stp = on ? APP.steps() : null;
    $('htut').hidden = !on;
    if (on) $('htut').innerHTML = '<span class="small">' + esc(stp.hint) + '</span>' + (APP.tut().step === 8 ? '<button type="button" class="btn sm pri" data-hact="myHouse">去我的達秒屋</button>' : '') + '<button type="button" class="btn sm warn" data-hact="tutSkip">跳過教學</button>';
  }
  function onTap(hit) {
    if (!hit) return;
    var v = data();
    if (hit.kind === 'door') { goDoor(); return; }
    if (st.placing) {
      if (hit.kind === 'cell') { KIT.pop('放一樣擺設', '選一樣放在這一格（可以再轉方向）。', Object.keys(CORE.PROPS).map(function (k) { return { label: CORE.PROPS[k], fn: function () { act(function () { CORE.placeProp(APP.state(), me().serial, { kind: k, a: hit.a, r: hit.r, rot: 0 }); }, '放了' + CORE.PROPS[k]); } }; }).concat([{ label: '不要', pri: true }])); return; }
      if (hit.kind === 'prop') { KIT.pop('這個擺設', '要轉方向還是拿掉？', [{ label: '轉 90 度', fn: function () { act(function () { CORE.rotateProp(APP.state(), me().serial, hit.a, hit.r); }, '轉了'); } }, { label: '拿掉', warn: true, fn: function () { act(function () { CORE.removeProp(APP.state(), me().serial, hit.a, hit.r); }, '拿掉了'); } }, { label: '不要', pri: true }]); return; }
    }
    if (hit.kind === 'brick') { if (v.closed) { msg('只給鄰居看：點不開'); return; } var b = v.bricks.find(function (x) { return x.day === hit.day; }); if (!b || (!b.n && !b.cover)) { msg(CORE.dayLabel(hit.day) + '：這一天沒有紀錄'); return; } KIT.dayPop(st.serial, hit.day, function () { render(); }); }
  }
  function act(fn, ok) { var r = APP.run(fn, ok); msg(r.msg); if (!r.ok) KIT.pop('放不上去', r.msg); render(); }
  function msg(t) { var el = $('hmsg'); el.textContent = t || ''; el.hidden = !t; clearTimeout(msg.t); if (t) msg.t = setTimeout(function () { el.hidden = true; }, 3500); }
  function goDoor() { var s = st.serial; if (s !== me().serial) APP.tutEvent('door'); APP.goTable(s, 'role', 'door'); }
  function goSerial() {
    var code = $('hSerialIn').value.trim(); if (!code) { msg('先輸入序號，例如 J2'); return; }
    var r = CORE.findRole(APP.state(), code); if (!r) { msg('找不到序號 ' + code); return; }
    if (r.serial === APP.GUIDE) APP.tutEvent('foundGuide');
    APP.goHouse(r.serial);
  }
  $('view-house').addEventListener('click', function (e) {
    var b = e.target.closest('[data-hact]'); if (!b) return;
    var a = b.dataset.hact;
    if (a === 'go') goSerial();
    else if (a === 'random') { var r = CORE.randomRole(APP.state(), viewer()); if (!r) { msg('沒有別人'); return; } APP.tutEvent('houseRandom'); APP.goHouse(r.serial); }
    else if (a === 'back') APP.goTable(null, null);
    else if (a === 'place') { st.placing = !st.placing; render(); }
    else if (a === 'door') goDoor();
    else if (a === 'myHouse') APP.goHouse(me().serial);
    else if (a === 'tutSkip') { APP.tutSkip(); msg('跳過了教學。想只收不給，記得要有 0 點的空物件。'); tutBar(); }
  });
  $('hSerialIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') goSerial(); });

  /* ---------- 事件 ---------- */
  APP.on('view', function (v) {
    if (v.name === 'house') {
      var changedHouse = st.serial !== v.serial; st.serial = v.serial; if (changedHouse) { st.placing = false; st.month = 0; }
      st.shown = true; $('view-house').hidden = false; document.body.classList.add('in-house'); ensure();
      if (WORLD.available) { WORLD.resume(); WORLD.resize(); }
      render({ resetCamera: changedHouse });
    } else { st.shown = false; $('view-house').hidden = true; document.body.classList.remove('in-house'); if (WORLD.available) WORLD.pause(); }
  });
  APP.on('change', function () { if (st.shown) render(); });
  APP.on('tut', function () { if (st.shown) tutBar(); });
  APP.on('firstBrick', function () { KIT.pop('你 0 歲，第一塊磚亮了', '這是你的達秒屋。每天一塊磚，成交的那天會亮。教學完成！'); });
  // 成交那一刻正好開著：白光一閃，今天那塊磚亮起來（重畫就亮）
  APP.on('dock', function (res) { if (!st.shown) return; var hit = res.some(function (x) { return x.docking && x.docking.traded && (x.docking.a === st.serial || x.docking.b === st.serial); }); render(); if (hit) KIT.flash(); });
  return { st: st, render: render, data: data };
})();
