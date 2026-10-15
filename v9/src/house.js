/* ===== v9 達秒屋的畫面：外面整個畫面就是達秒屋 =====
 * 最上面一列：序號或密鑰框、去、骰子（骰一個序號進框裡）、誰的達秒屋、回我的表格世界。自己的屋多一個「蓋」；「看日曆」鏡頭轉回這個月那一塊日曆。
 * 點日曆上的磚看那天、點門到他的資源表；村子裡點別間屋，畫面滑過去（約一秒）；「看村子」拉遠從上面看；挑地時點一塊框起來的地就放。蓋的時候：選方塊、點一個面加一塊、切到「拆」點一塊拿掉、點擺設轉方向、選門搬門、日曆往哪長、復原上一步、範本。
 * 3D 用不了就顯示成日曆紙（一個月一張）。只呼叫 APP、CORE、KIT、WORLD。
 */
var HOUSE = (function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = APP.esc;
  var st = { serial: null, building: false, kind: 'brick', mode: 'add', undo: [], cal: null, shown: false, ready: false, travel: false, pick: null, rot: 0 };   // cal：3D 用不了時日曆紙翻到哪個月；pick：挑地（{ village, pending }）；rot：挑地選的朝向
  function me() { return APP.me(); }
  function viewer() { return APP.isBlank() ? null : me().serial; }
  function data() { return CORE.viewHouse(APP.state(), st.serial, viewer(), APP.now()); }
  function mine() { return !APP.isBlank() && st.serial === me().serial; }
  function village() { return CORE.viewVillage(APP.state(), st.serial, viewer(), APP.now()); }
  function spots() { if (!st.pick) return null; try { return CORE.freeSpots(APP.state(), st.pick.village, st.pick.pending ? null : me().serial); } catch (e) { return null; } }

  function ensure() {
    if (st.ready) return;
    st.ready = true;
    if (WORLD.available && WORLD.init($('hstage'))) { WORLD.onTap(onTap); $('hcal').hidden = true; }
    else { WORLD.available = false; $('hstage').hidden = true; $('hcal').hidden = false; }
    $('hblk').innerHTML = Object.keys(CORE.BLOCKS).map(function (k) { var b = CORE.BLOCKS[k]; return '<button type="button" data-blk="' + k + '" aria-label="' + esc(b.name) + '"><span class="sw" style="background:' + b.hex + (b.type === 'glass' ? ';opacity:.6' : '') + '"></span>' + esc(b.name) + '</button>'; }).join('');
    $('hDirs').innerHTML = Object.keys(CORE.CAL_DIRS).map(function (d) { return '<button type="button" class="btn sm" data-dir="' + d + '">' + CORE.CAL_DIRS[d] + '</button>'; }).join('');
    $('hRots').innerHTML = [0, 90, 180, 270].map(function (r) { return '<button type="button" class="btn sm" data-rot="' + r + '">' + r + '°</button>'; }).join('');
  }
  function render(opts) {
    if (!st.shown) return;
    var r = APP.roleOf(st.serial); if (!r) { st.serial = me().serial; r = APP.roleOf(st.serial); }
    if (!r) return;
    var v = data(), own = mine(), vv = WORLD.available ? village() : null, inVillage = vv && vv.houses.length > 1;
    if (!own || !WORLD.available) st.building = false;
    $('hwho').innerHTML = '<b>' + esc(CORE.abbrev(r.serial) + ' ' + r.name) + '</b> 的達秒屋' + (v.closed ? ' <span class="tag off">只給鄰居看</span>' : '<span class="small muted"> ' + esc(v.age.text + (v.sign ? '・「' + v.sign + '」' : '')) + '</span>') + (inVillage ? ' <span class="tag">村子 ' + vv.houses.length + ' 間</span>' : '');
    $('hVillage').hidden = !inVillage || !!st.pick;
    $('hpick').hidden = !st.pick;
    if (st.pick) {
      $('hRots').querySelectorAll('[data-rot]').forEach(function (b) { b.classList.toggle('on', +b.dataset.rot === st.rot); });
      var sel = st.pick.sel;
      $('hpickText').textContent = sel ? '已經幫你選好一塊：這裡原本有人住，補進來村子比較完整。也可以點別塊。' : (st.pick.pending ? '點一塊框起來的地，把你的房子放進村子' : '點一塊框起來的地換位置') + '（朝向 ' + st.rot + '°）';
      $('hPickSel').hidden = !sel; $('hPickSel').textContent = st.pick.pending ? '放在選好的這塊' : '換到選好的這塊';
    }
    $('hBuild').hidden = !own || !WORLD.available || !!st.pick; $('hBuild').textContent = st.building ? '蓋好了' : '蓋'; $('hBuild').classList.toggle('pri', st.building);
    $('hDoor').hidden = st.building || !!st.pick; $('hLook').hidden = !!st.pick;
    $('hDoor').textContent = own ? '進門（我的資源表）' : '進門（他的資源表）';
    $('hbuild').hidden = !st.building;
    if (st.building) {
      $('hblk').querySelectorAll('[data-blk]').forEach(function (b) { b.classList.toggle('on', b.dataset.blk === st.kind); });
      $('hModeAdd').classList.toggle('on', st.mode === 'add'); $('hModeDel').classList.toggle('on', st.mode === 'remove');
      $('hUndo').disabled = !st.undo.length;
      $('hDirs').querySelectorAll('[data-dir]').forEach(function (b) { b.classList.toggle('on', b.dataset.dir === v.cal.dir); });
      var pv = v.cal.preview, note = !pv ? '下一塊還沒有位置' : pv.fallback ? '這個方向長不了，這次會放到最近的空位' : pv.dir !== v.cal.dir ? '這個方向長不了，這次會往' + CORE.CAL_DIRS[pv.dir] : '下個月長在框那裡';
      $('hDirNote').textContent = note + (pv && pv.removes ? '，會拆 ' + pv.removes + ' 塊' : '');
    }
    $('hhint').textContent = st.pick ? '從上面看整個村子：框起來的是能放的地' : st.building ? (st.mode === 'add' ? (st.kind === 'door' ? '選了門：點一個地方門就搬過去；點門轉方向。' : '選一種方塊，點一個面加一塊；點擺設或門轉方向。') : '拆：點一塊就拿掉（日曆和門拆不掉）。') + '地皮 ' + v.plot.size + '×' + v.plot.size + '、高 ' + v.plot.height + '，蓋了 ' + v.look.n + ' 塊' : (WORLD.available ? '一指拖著轉、兩指縮放；點日曆上的磚看那天，點門進' + (own ? '我' : '他') + '的資源表' + (inVillage ? '；點村裡別間屋走過去' : '') + (v.cal.preview && v.cal.preview.removes ? '；下個月的日曆會拆 ' + v.cal.preview.removes + ' 塊' : '') : '3D 用不了：達秒屋顯示成日曆紙，點一格跟點一塊磚一樣');
    tutBar();
    if (WORLD.available) { var vb = $('view-house').getBoundingClientRect(), hb = document.querySelector('.hbar').getBoundingClientRect(), fb = document.querySelector('.hfoot').getBoundingClientRect(); WORLD.setInsets(hb.bottom - vb.top, vb.bottom - fb.top); }
    if (WORLD.available) { WORLD.show(v, { building: st.building, resetCamera: opts && opts.resetCamera, village: vv, travel: st.travel, spots: spots(), selSpot: st.pick ? st.pick.sel : null }); st.travel = false; }
    if (own && v.calRemoved && !KIT.isOpen()) { var n = CORE.ackCalRemoved(APP.state(), me().serial); APP.changed(); KIT.pop('日曆長到這裡，拆了 ' + n + ' 塊', '日曆每個月長一塊，長到的地方和它正面前面的方塊會拆掉。在「蓋」裡可以改下一塊往哪長。'); }
    if (!WORLD.available) { if (!st.cal) { var ym = KIT.ymOf(CORE.dayNum(APP.now())); st.cal = { y: ym.y, m: ym.m }; } $('hcal').innerHTML = '<div class="scroll"><div class="stage">' + KIT.calSheet(st.serial, viewer(), st.cal.y, st.cal.m) + '</div></div>'; }
  }
  function tutBar() {
    var on = APP.tutActive() && !APP.isBlank(), stp = on ? APP.steps() : null;
    $('htut').hidden = !on;
    if (on) $('htut').innerHTML = '<span class="small">' + esc(stp.hint) + '</span>' + (APP.tut().step === 6 ? '<button type="button" class="btn sm pri" data-hact="myHouse">去我的達秒屋</button>' : '') + '<button type="button" class="btn sm warn" data-hact="tutSkip">跳過教學</button>';
  }
  function onTap(hit) {
    if (!hit) return;
    if (st.pick) { if (hit.kind === 'spot') pickSpot(hit.pos); return; }
    if (hit.kind === 'house') { st.travel = true; APP.goHouse(hit.serial, false, { travel: true }); return; }   // 點村裡別間屋：畫面滑過去
    if (st.building) { buildTap(hit); return; }
    var v = data();
    if (hit.kind === 'door') { goDoor(); return; }
    if (hit.kind === 'brick') { if (v.closed) { msg('只給鄰居看：點不開'); return; } var b = v.bricks.find(function (x) { return x.day === hit.day; }); if (!b || (!b.n && !b.cover)) { msg(CORE.dayLabel(hit.day) + '：這一天沒有紀錄'); return; } KIT.dayPop(st.serial, hit.day, function () { render(); }); }
  }

  /* ---------- 蓋：每一步都記下怎麼復原 ---------- */
  function buildTap(hit) {
    var S = APP.state(), s = me().serial, now = APP.now();
    if (st.mode === 'remove') {
      if (hit.kind === 'cal' || hit.kind === 'brick') { KIT.pop('拆不掉', '日曆拆不掉。'); return; }
      if (hit.kind === 'door') { KIT.pop('拆不掉', '門拆不掉，只能搬：選「門」再點一個地方。'); return; }
      if (hit.kind !== 'block') return;
      act(function () { var b = CORE.removeBlock(S, s, hit.x, hit.y, hit.z, now); return function () { CORE.addBlock(S, s, b, APP.now()); }; }, '拆了一塊');
      return;
    }
    if (hit.kind === 'brick') { KIT.pop('放不上去', '這裡要留給日曆，正面前面也要空著。'); return; }
    if (hit.kind === 'door' || (hit.kind === 'block' && hit.prop)) { act(function () { CORE.rotateBlock(S, s, hit.x, hit.y, hit.z, now); return function () { for (var i = 0; i < 3; i++) CORE.rotateBlock(S, s, hit.x, hit.y, hit.z, APP.now()); }; }, '轉了 90 度'); return; }
    var x = hit.x, y = hit.y, z = hit.z;
    if (hit.kind === 'block' || hit.kind === 'cal') { x += hit.n[0]; y += hit.n[1]; z += hit.n[2]; }
    var k = st.kind;
    if (k === 'door') { act(function () { var old = CORE.moveDoor(S, s, x, y, z, null, now); return function () { CORE.moveDoor(S, s, old[0], old[1], old[2], old[4], APP.now()); }; }, '門搬過去了'); return; }
    act(function () { var b = CORE.addBlock(S, s, CORE.BLOCKS[k].type === 'prop' ? [x, y, z, k, 0] : [x, y, z, k], now); return function () { CORE.removeBlock(S, s, b[0], b[1], b[2], APP.now()); }; }, '加了一塊' + CORE.BLOCKS[k].name);
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
    KIT.pop('範本', '按一下就蓋出來，再自己改。換範本會把現在蓋的換掉；碰到日曆和門前面的地方會空著，門不會拆。', Object.keys(CORE.TEMPLATES).map(function (k) { return { label: CORE.TEMPLATES[k], fn: function () { confirmReplace(n, '換成「' + CORE.TEMPLATES[k] + '」', function () { return CORE.template(k); }); } }; }).concat([{ label: '全部拆掉', warn: true, fn: function () { confirmReplace(n, '全部拆掉', function () { return []; }); } }, { label: '不要', pri: true }]));
  }
  function confirmReplace(n, what, list) {
    KIT.pop(what + '？', '現在蓋的 ' + n + ' 塊會被換掉（之後可以按「復原上一步」換回來）。', [{ label: '換掉', warn: true, fn: function () { act(function () { var S = APP.state(), s = me().serial, old = CORE.setBlocks(S, s, list(), APP.now(), true); return function () { CORE.setBlocks(S, s, old, APP.now(), true); }; }, what + '了'); } }, { label: '不要', pri: true }]);
  }
  // 挑地：點了一塊地 → 問一下 → 搬進去或換位置
  function pickSpot(pos) {
    var p = st.pick, S = APP.state(), s = me().serial;
    KIT.pop(p.pending ? '放在這裡？' : '換到這裡？', '這塊地 [' + pos[0] + ', ' + pos[1] + ']，朝向 ' + st.rot + '°。' + (p.pending ? '搬進去以後隨時可以換位置或搬走。' : ''), [{ label: '不要' }, { label: p.pending ? '放這裡' : '換過來', pri: true, fn: function () {
      var r = APP.run(function () { if (p.pending) CORE.joinVillage(S, s, p.village, p.pending, pos, st.rot, APP.now()); else CORE.moveHouse(S, s, pos, st.rot); }, p.pending ? '搬進村子了' : '換好位置了');
      if (r.ok) { st.pick = null; msg(r.msg); APP.goHouse(s); } else KIT.pop('放不了', r.msg);
    } }]);
  }
  function msg(t) { var el = $('hmsg'); el.textContent = t || ''; el.hidden = !t; clearTimeout(msg.t); if (t) msg.t = setTimeout(function () { el.hidden = true; }, 3500); }
  // 點門：到他的資源表那張紙（自己的門就是自己的資源表）
  function goDoor() { APP.goTable(st.serial, 'res', 'door'); }
  // 序號就到他的達秒屋外面；密鑰要在表格世界輸入
  function goSerial() {
    var code = $('hSerialIn').value.trim(); if (!code) { msg('先輸入序號，例如 J2'); return; }
    var r = CORE.findRole(APP.state(), code); if (!r) { msg(APP.isBlank() ? '找不到序號 ' + code : '找不到序號 ' + code + '；密鑰要回表格世界的框輸入'); return; }
    APP.tutEvent('go', r.serial);
    APP.goHouse(r.serial);
  }
  function dice() {
    var r = CORE.randomRole(APP.state(), viewer()); if (!r) { msg('沒有別人'); return; }
    $('hSerialIn').value = CORE.abbrev(r.serial);
    var b = $('hDice'); b.classList.remove('roll'); void b.offsetWidth; b.classList.add('roll');
    APP.tutEvent('dice'); msg('骰到 ' + CORE.abbrev(r.serial) + ' ' + r.name + '，按「去」過去看；不喜歡再骰');
  }
  $('view-house').addEventListener('click', function (e) {
    var blk = e.target.closest('[data-blk]'); if (blk) { st.kind = blk.dataset.blk; st.mode = 'add'; render(); return; }
    var rot = e.target.closest('[data-rot]'); if (rot) { st.rot = +rot.dataset.rot; render(); return; }
    var dir = e.target.closest('[data-dir]'); if (dir) { act(function () { var old = CORE.setCalDir(APP.state(), me().serial, dir.dataset.dir); return function () { CORE.setCalDir(APP.state(), me().serial, old); }; }, '下一塊往' + CORE.CAL_DIRS[dir.dataset.dir]); return; }
    var c = e.target.closest('#hcal [data-act]');
    if (c) { if (c.dataset.act === 'calMonth') { var d = new Date(st.cal.y, st.cal.m + +c.dataset.n, 1); st.cal = { y: d.getFullYear(), m: d.getMonth() }; render(); } else if (c.dataset.act === 'calDay') { if (data().closed) { msg('只給鄰居看：點不開'); return; } KIT.dayPop(st.serial, +c.dataset.day, function () { render(); }); } return; }
    var b = e.target.closest('[data-hact]'); if (!b) return;
    var a = b.dataset.hact;
    if (a === 'go') goSerial();
    else if (a === 'dice') dice();
    else if (a === 'back') APP.goTable(null, null);
    else if (a === 'build') { st.building = !st.building; st.mode = 'add'; render(); }
    else if (a === 'modeAdd') { st.mode = 'add'; render(); }
    else if (a === 'modeDel') { st.mode = 'remove'; render(); }
    else if (a === 'undo') undo();
    else if (a === 'tpl') templates();
    else if (a === 'door') goDoor();
    else if (a === 'look') { if (WORLD.available) WORLD.lookCalendar(); }
    else if (a === 'village') { if (WORLD.available) WORLD.lookVillage(); }
    else if (a === 'pickSel') { if (st.pick && st.pick.sel) pickSpot(st.pick.sel); }
    else if (a === 'pickCancel') { st.pick = null; APP.goTable(null, 'village'); }
    else if (a === 'myHouse') APP.goHouse(me().serial);
    else if (a === 'tutSkip') { APP.tutSkip(); msg('跳過了教學。想只收不給，記得要有 0 點的空物件。'); tutBar(); }
  });
  $('hSerialIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') goSerial(); });

  /* ---------- 事件 ---------- */
  APP.on('view', function (v) {
    if (v.name === 'house') {
      var changedHouse = st.serial !== v.serial; st.serial = v.serial; if (changedHouse) { st.building = false; st.undo = []; st.cal = null; }
      if (v.build && mine()) st.building = true;
      st.travel = !!v.travel; st.pick = v.pick || null; if (st.pick) { st.building = false; st.rot = 0; try { st.pick.sel = CORE.suggestedSpot(APP.state(), st.pick.village, st.pick.pending ? null : me().serial); } catch (e) { st.pick.sel = null; } }   // 空出來的地先選好（補十八）
      st.shown = true; $('view-house').hidden = false; document.body.classList.add('in-house'); ensure();
      if (WORLD.available) { WORLD.resume(); WORLD.resize(); }
      render({ resetCamera: changedHouse });
    } else { st.shown = false; st.building = false; $('view-house').hidden = true; document.body.classList.remove('in-house'); if (WORLD.available) WORLD.pause(); }
  });
  APP.on('change', function () { if (st.shown) render(); });
  APP.on('tut', function () { if (st.shown) tutBar(); });
  APP.on('calGrow', function () { if (st.shown) render(); });
  // 教學第 6 步：鏡頭靠近第一塊日曆上今天那塊磚，框起來
  APP.on('firstBrick', function () {
    var v = st.shown ? data() : null;
    if (v && WORLD.available) { render(); WORLD.focusDay(v.born); }
    KIT.pop('你 0 歲，第一塊磚亮了', '就是上面日曆方塊上框起來的那一塊。每天一塊磚，成交的那天會亮；房子可以按「蓋」自己蓋。教學完成！', null, null, { low: true });
  });
  // 成交那一刻正好開著：白光一閃，今天那塊磚亮起來（重畫就亮）
  APP.on('dock', function (res) { if (!st.shown) return; var hit = res.some(function (x) { return x.docking && x.docking.traded && (x.docking.a === st.serial || x.docking.b === st.serial); }); render(); if (hit) KIT.flash(); });
  return { st: st, render: render, data: data, village: village };
})();
