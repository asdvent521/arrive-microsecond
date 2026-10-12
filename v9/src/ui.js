/* ===== v9 表格世界和達秒屋共用的小畫面：彈出框、白光、日曆（一格一天）、那天的明細、輸入格自動寬度 =====
 * 日曆和明細只拿 CORE.viewHouse／CORE.dayDetail 的結果來畫（看不到的東西根本不在回傳裡）。只呼叫 APP 和 CORE。
 */
var KIT = (function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = APP.esc;
  var VIS = CORE.VIS_LEVELS;

  /* ---------- 彈出框：title、body（文字，或 {html}）、按鈕 ---------- */
  var popOnClose = null;
  function pop(title, body, buttons, onClose, opts) {
    $('popTitle').textContent = title;
    if (body && typeof body === 'object' && body.html != null) $('popBody').innerHTML = body.html; else $('popBody').textContent = body || '';
    $('popBtns').innerHTML = (buttons || [{ label: '好', pri: true }]).map(function (b, i) { return '<button type="button" class="btn' + (b.pri ? ' pri' : '') + (b.warn ? ' warn' : '') + '" data-pop="' + i + '">' + esc(b.label) + '</button>'; }).join('');
    var wasOpen = !$('pop').hidden, keep = wasOpen && $('pop').dataset.title === title ? $('popBody').scrollTop : 0;
    $('pop').classList.toggle('low', !!(opts && opts.low));   // low：靠下、不罩暗，上面的東西看得到
    $('pop').hidden = false; $('pop').dataset.title = title; $('popBody').scrollTop = keep;
    popOnClose = onClose || null;
    $('popBtns').querySelectorAll('[data-pop]').forEach(function (el) { el.onclick = function () { var b = (buttons || [])[+el.dataset.pop]; if (!(b && b.keep)) close(); if (b && b.fn) b.fn(); }; });
  }
  function close() { $('pop').hidden = true; $('pop').dataset.title = ''; var f = popOnClose; popOnClose = null; if (f) f(); }
  function isOpen() { return !$('pop').hidden; }
  function flash() { var el = $('flash'); el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); }

  /* ---------- 日曆：一個月一張，一格一天；每一格畫出跟磚一樣的狀態 ---------- */
  function cellCls(b) {
    if (!b) return 'none';
    var c = [];
    if (b.future) c.push('fut');
    if (b.lit) c.push('lit' + Math.min(3, b.lit)); else if (b.mark) c.push('mark'); else if (b.cover) c.push('cover'); else if (b.booked) c.push('bk');
    return c.join(' ') || 'empty';
  }
  // 那個月 1 號的 dayNum（本機日期）
  function monthStart(year, month) { var d = new Date(year, month, 1, 12); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); }
  function calendar(ownerSerial, viewerSerial, offset) {
    var v = CORE.viewHouse(APP.state(), ownerSerial, viewerSerial, APP.now()), byDay = {};
    v.bricks.forEach(function (b) { byDay[b.day] = b; });
    var now = new Date(APP.now() / 1000), base = new Date(now.getFullYear(), now.getMonth() + (offset || 0), 1, 12);
    var y = base.getFullYear(), m = base.getMonth(), first = monthStart(y, m), days = new Date(y, m + 1, 0).getDate(), lead = new Date(y, m, 1).getDay();
    var cells = '';
    for (var i = 0; i < lead; i++) cells += '<span class="cd pad"></span>';
    for (var d = 0; d < days; d++) {
      var dn = first + d, b = byDay[dn], cls = cellCls(b), canOpen = b && !v.closed && (b.n || b.cover);
      cells += '<button type="button" class="cd ' + cls + (dn === v.today ? ' today' : '') + '" data-day="' + dn + '"' + (canOpen ? '' : ' disabled') + ' aria-label="' + (m + 1) + ' 月 ' + (d + 1) + ' 日"><span class="dn">' + (d + 1) + '</span>' + (b && b.lit > 1 ? '<span class="cnt">' + b.lit + '</span>' : '') + '</button>';
    }
    var head = '<div class="calhead"><button type="button" class="btn sm" data-cal="-1" aria-label="上個月">‹ 上個月</button><b class="num">' + y + ' 年 ' + (m + 1) + ' 月</b><button type="button" class="btn sm" data-cal="1" aria-label="下個月">下個月 ›</button></div>';
    var legend = v.closed ? '<div class="small muted">只給鄰居看：看不出亮暗，也點不開。</div>' : '<div class="legend small"><span class="cd lit1"></span>有成交（越多越亮）<span class="cd mark"></span>只有不成交或錯過<span class="cd cover"></span>蓋著<span class="cd fut bk"></span>未來的預約</div>';
    return '<div class="cal" data-owner="' + esc(ownerSerial) + '" data-month="' + (offset || 0) + '">' + head + '<div class="wk"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div><div class="grid">' + cells + '</div>' + legend + '</div>';
  }

  /* ---------- 那天的明細：點一格或點一塊磚 ---------- */
  function itemsText(items) { return items.length ? items.map(function (it) { return it.name + '（' + it.price + ' 點）' + (it.state ? '［' + it.state + '］' : ''); }).join('、') : '（沒有）'; }
  function dayPop(ownerSerial, day, onChange) {
    var me = APP.me().serial, viewer = APP.isBlank() ? null : me, d = CORE.dayDetail(APP.state(), ownerSerial, viewer, day, APP.now());
    var owner = APP.roleOf(ownerSerial);
    if (d.closed) { pop('只給鄰居看', '這一間只給鄰居看，點不開。'); return; }
    var mine = ownerSerial === me, who = mine ? '我' : d.owner.name;   // 看別人的屋：寫屋主的名字，不寫「我」
    var rows = d.entries.map(function (e) {
      var head = '<div class="ent-h"><b class="num">' + esc(e.time) + '</b> 跟 <button type="button" class="lk" data-goserial="' + esc(e.other.serial) + '"' + (e.other.gone ? ' disabled' : '') + '>' + esc(CORE.abbrev(e.other.serial)) + '</button> ' + esc(e.other.name) + (e.other.gone ? '（不玩了）' : '') + ' ' + tagFor(e) + (e.tutorial ? ' <span class="tag off">教學</span>' : '') + (e.together ? ' <span class="tag wait">一起成交</span>' : '') + '</div>';
      var body = e.status === 'booked' ? '<div class="small">還沒到那一微秒</div>' : e.status === 'traded' ? '<div class="small">' + esc(who) + '給了：' + esc(itemsText(e.gave)) + '</div><div class="small">' + esc(who) + '拿到：' + esc(itemsText(e.got)) + '</div>' : '<div class="small">' + esc(e.reason || '') + '</div>';
      var vis = '';
      if (mine && e.vis) {
        if (e.locked) vis = '<div class="small muted">引路人的教學紀錄固定全藏</div>';
        else vis = '<div class="vis"><label class="small">我這一邊：<select data-vis="' + e.id + '" aria-label="這一筆給誰看">' + Object.keys(VIS).map(function (k) { return '<option value="' + k + '"' + (k === e.vis ? ' selected' : '') + '>' + VIS[k] + '</option>'; }).join('') + '</select></label>' + (e.vis === 'hidden' ? '<div class="small warn">對方的達秒屋可能還看得到</div>' : '') + '</div>';
      }
      return '<div class="ent">' + head + body + vis + '</div>';
    }).join('');
    var covered = d.covered ? '<div class="small muted ent">還有 ' + d.covered + ' 筆蓋著</div>' : '';
    var rules = '<details class="small"><summary>那天生效的規則表和資源表</summary><div>用途：' + esc(d.rules.uses.join('；') || '（沒寫）') + '</div><div>對接條件：' + esc(d.rules.conditions.join('；') || '沒有條件') + '</div><div>家規：' + esc(d.rules.village || '（沒有）') + '</div><div>資源：' + esc(d.resources.map(function (x) { return x.name + ' ' + x.price + ' 點'; }).join('、') || '（沒有）') + '</div></details>';
    pop((owner ? owner.name + ' ' : '') + d.label, { html: (rows || (d.covered ? '' : '<div class="small muted">這一天沒有紀錄。</div>')) + covered + rules }, [{ label: '好', pri: true }]);
    $('popBody').querySelectorAll('[data-vis]').forEach(function (sel) { sel.onchange = function () { var r = APP.run(function () { CORE.setVis(APP.state(), me, sel.dataset.vis, sel.value); }); if (!r.ok) alertMsg(r.msg); dayPop(ownerSerial, day, onChange); if (onChange) onChange(); }; });
    $('popBody').querySelectorAll('[data-goserial]').forEach(function (b) { b.onclick = function () { close(); APP.goTable(b.dataset.goserial, 'role', 'link'); }; });
  }
  function tagFor(e) { var cls = { traded: '', nodock: 'bad', invalid: 'bad', miss: 'bad', booked: 'wait' }[e.status]; return '<span class="tag ' + (cls == null ? 'off' : cls) + '">' + esc(e.result) + '</span>'; }
  function alertMsg(t) { var el = document.createElement('div'); el.className = 'small warn'; el.textContent = t; $('popBody').prepend(el); }
  // 日曆的事件：換月、點一格（container 裡的 .cal）
  function bindCalendar(container, rerender) {
    container.querySelectorAll('.cal [data-cal]').forEach(function (b) { b.onclick = function () { rerender(+b.closest('.cal').dataset.month + +b.dataset.cal); }; });
    container.querySelectorAll('.cal [data-day]').forEach(function (b) { b.onclick = function () { if (b.disabled) return; dayPop(b.closest('.cal').dataset.owner, +b.dataset.day, function () { rerender(+b.closest('.cal').dataset.month); }); }; });
  }

  /* ---------- 輸入格自動寬度：提示字和內容都不能被切掉 ---------- */
  var ctx = null;
  function textWidth(t, font) { if (!ctx) ctx = document.createElement('canvas').getContext('2d'); ctx.font = font; return ctx.measureText(t).width; }
  function fitInputs(root) {
    (root || document).querySelectorAll('input[type=text], input[type=number], input[type=search], input[type=url]').forEach(function (el) {
      var cs = getComputedStyle(el); if (cs.display === 'none') return;
      var font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      var pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth) + (el.type === 'number' ? 22 : 6);
      var need = Math.ceil(Math.max(textWidth(el.value || '', font), textWidth(el.placeholder || '', font)) + pad);
      el.style.minWidth = need + 'px';
    });
  }
  document.addEventListener('input', function (e) { if (e.target && e.target.matches && e.target.matches('input')) fitInputs(e.target.parentNode); });

  return { pop: pop, close: close, isOpen: isOpen, flash: flash, calendar: calendar, bindCalendar: bindCalendar, dayPop: dayPop, cellCls: cellCls, fitInputs: fitInputs, textWidth: textWidth };
})();
