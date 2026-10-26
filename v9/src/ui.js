/* ===== v9 五張紙和能量之家共用的小畫面：彈出框、白光、一張紙的外殼、日曆紙（一個月一張、一格一天）、那天的明細、輸入格自動寬度 =====
 * 日曆紙和明細只拿 CORE.viewHouse／CORE.dayDetail 的結果來畫（看不到的東西根本不在回傳裡）。只呼叫 APP 和 CORE。
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

  /* ---------- 一張紙的外殼（五張紙共用）：標題、副標、上面的欄位、表、底下的說明 ---------- */
  function page(key, title, sub, fields, body, foot, grow) {
    return '<section class="page' + (grow ? ' grow' : '') + '" data-sheet="' + key + '"><header><div><h1>' + esc(title) + '</h1></div><div class="sub">' + sub + '</div></header>' + (fields ? '<div class="fields">' + fields + '</div>' : '') + body + (foot ? '<p class="foot">' + foot + '</p>' : '') + '</section>';
  }

  /* ---------- 日曆紙：一個月一張 A4 橫式，一格一天；底色、小記號、虛線框、蓋布照能量之家的磚（同一份 viewHouse），一格裡寫那天的見面 ---------- */
  function cellCls(b) {
    if (!b) return 'none';
    var c = [];
    if (b.future) c.push('fut');
    // 補二十二：lit＝有前情提要（亮）；lv1～3＝跟人成交的級數（顏色越深）；蓋布、小記號、虛線框照舊
    if (b.cover) c.push('cover'); else { if (b.lit) c.push('lit'); if (b.level) c.push('lv' + Math.min(3, b.level)); }
    if (!b.level && b.mark) c.push('mark'); else if (b.booked && !b.level) c.push('bk');
    return c.join(' ') || 'empty';
  }
  // 那個月 1 號的 dayNum（本機日期）
  function monthStart(year, month) { var d = new Date(year, month, 1, 12); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); }
  function ymOf(dn) { var l = CORE.dayLabel(dn); return { y: +l.slice(0, 4), m: +l.slice(5, 7) - 1 }; }
  // owner 的日曆紙，viewer 看（藏的規則在 viewHouse／dayDetail 裡）；y、m（0 起）是哪個月
  function calSheet(ownerSerial, viewerSerial, y, m) {
    var S = APP.state(), now = APP.now(), owner = APP.roleOf(ownerSerial), v = CORE.viewHouse(S, ownerSerial, viewerSerial, now), byDay = {};
    v.bricks.forEach(function (b) { byDay[b.day] = b; });
    var first = monthStart(y, m), days = new Date(y, m + 1, 0).getDate(), lead = new Date(y, m, 1).getDay(), rows = Math.ceil((lead + days) / 7), mine = viewerSerial === ownerSerial;
    var cnt = { traded: 0, nodock: 0, miss: 0, booked: 0 }, cells = [], h = rows >= 6 ? 22.5 : 27;
    for (var i = 0; i < lead; i++) cells.push('<td class="pad"></td>');
    for (var k = 0; k < days; k++) {
      var dn = first + k, b = byDay[dn], lines = [], more = '', cls = dn < v.born ? 'none' : b ? cellCls(b) : 'empty';
      if (!v.closed && dn >= v.born && b && (b.n || b.cover || b.lit)) {
        var d = CORE.dayDetail(S, ownerSerial, viewerSerial, dn, now);
        if (!d.closed) {
          d.entries.forEach(function (e) { var st = e.status === 'traded' ? 'traded' : e.status === 'booked' ? 'booked' : e.status === 'miss' ? 'miss' : 'nodock'; cnt[st]++; lines.push(esc(e.time + ' ' + e.other.name + (st === 'booked' ? '（約）' : st === 'miss' ? '（錯過）' : st === 'nodock' ? '（沒成）' : ''))); });
          if (lines.length > 3) { more = '還有 ' + (lines.length - 3) + ' 筆'; lines = lines.slice(0, 3); }
          if (d.covered) more += (more ? '・' : '') + d.covered + ' 筆蓋著';
        }
      }
      var can = !v.closed && dn >= v.born;
      cells.push('<td class="day ' + cls + (dn === v.today ? ' today' : '') + '"' + (can ? ' data-act="calDay" data-day="' + dn + '" tabindex="0" role="button"' : ' data-day="' + dn + '"') + '><span class="dn">' + (k + 1) + '</span>' + (lines.length ? '<div class="ev">' + lines.join('<br>') + '</div>' : '') + (more ? '<div class="more">' + esc(more) + '</div>' : '') + '</td>');
    }
    while (cells.length % 7) cells.push('<td class="pad"></td>');
    var trs = ''; for (var r = 0; r < cells.length / 7; r++) trs += '<tr style="height:calc(var(--mm)*' + h + ')">' + cells.slice(r * 7, r * 7 + 7).join('') + '</tr>';
    var sub = '<button type="button" class="mini o" data-act="calMonth" data-n="-1">‹ 前一個月</button><button type="button" class="mini o" data-act="calMonth" data-n="1">後一個月 ›</button>　一個月一張・一格一天' + (v.closed ? '・<span class="tagp off">只給鄰居看</span>' : '');
    var natDays = v.closed ? 0 : CORE.natureDays(S, ownerSerial, viewerSerial, first, first + days - 1);
    var fields = '<span><span class="ln s">' + y + '</span> 年 <span class="ln s">' + (m + 1) + '</span> 月</span><span>名字 <span class="ln">' + esc(owner ? owner.name : CORE.abbrev(ownerSerial)) + (mine ? '（我）' : '') + '</span></span><span class="tot">這個月成交 <b class="num">' + cnt.traded + '</b> 次・沒成 <b class="num">' + cnt.nodock + '</b> 次・錯過 <b class="num">' + cnt.miss + '</b> 次・還約著 <b class="num">' + cnt.booked + '</b> 次・寫了前情提要 <b class="num" id="natDays">' + natDays + '</b> 天</span>';
    var body = '<table class="calp" data-y="' + y + '" data-m="' + m + '"><colgroup>' + '<col style="width:14.28%">'.repeat(7) + '</colgroup><thead><tr><th>日</th><th>一</th><th>二</th><th>三</th><th>四</th><th>五</th><th>六</th></tr></thead><tbody>' + trs + '</tbody></table>';
    var foot = mine ? '<b>一格一天</b>：底色跟能量之家的磚一樣，寫了前情提要就亮，跟人成交就有顏色、成交越多顏色越深，沒成、錯過有小記號，還約著的是虛線框；創角色以前的日子空著，今天紅框。<b>點一格</b>翻到那天的事件簿，還沒到的日子也能點，進去可以開時段。' : '<b>' + esc(owner ? owner.name : '') + ' 的日曆</b>：跟看他的能量之家一樣，他藏起來的那幾筆看不到（蓋布）；點一格看那天。';
    return page('cal', '日曆', sub, fields, body, foot);
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
        else vis = '<div class="vis"><label class="small">我這一邊：<select data-vis="' + e.id + '" aria-label="這一筆給誰看">' + Object.keys(VIS).map(function (k) { return '<option value="' + k + '"' + (k === e.vis ? ' selected' : '') + '>' + VIS[k] + '</option>'; }).join('') + '</select></label>' + (e.vis === 'hidden' ? '<div class="small warn">對方的能量之家可能還看得到</div>' : '') + '</div>';
      }
      return '<div class="ent">' + head + body + vis + '</div>';
    }).join('');
    var covered = d.covered ? '<div class="small muted ent">還有 ' + d.covered + ' 筆蓋著</div>' : '';
    // 最上面是那天的前情提要（看的人看得到才顯示）；自己的可以改給誰看
    var nat = d.nature ? '<div class="ent nature"><div class="ent-h"><b>前情提要</b> <span class="tag">給了自然 ' + d.nature.points + ' 點</span></div><div class="small natext">' + esc(d.nature.text) + '</div>' + (d.nature.mine ? '<div class="vis"><label class="small">給誰看：<select data-natvis="' + d.nature.day + '" aria-label="前情提要給誰看">' + Object.keys(VIS).map(function (k) { return '<option value="' + k + '"' + (k === d.nature.vis ? ' selected' : '') + '>' + VIS[k] + '</option>'; }).join('') + '</select></label></div>' : '') + '</div>' : '';
    rows = nat + rows;
    var rules = '<details class="small"><summary>那天生效的規則表和資源表</summary><div>用途：' + esc(d.rules.uses.join('；') || '（沒寫）') + '</div><div>對接條件：' + esc(d.rules.conditions.join('；') || '沒有條件') + '</div><div>家規：' + esc(d.rules.village || '（沒有）') + '</div><div>資源：' + esc(d.resources.map(function (x) { return x.name + ' ' + x.price + ' 點'; }).join('、') || '（沒有）') + '</div></details>';
    pop((owner ? owner.name + ' ' : '') + d.label, { html: (rows || (d.covered ? '' : '<div class="small muted">這一天沒有紀錄。</div>')) + covered + rules }, [{ label: '好', pri: true }]);
    $('popBody').querySelectorAll('[data-natvis]').forEach(function (sel) { sel.onchange = function () { var r = APP.run(function () { CORE.setNatureVis(APP.state(), me, +sel.dataset.natvis, sel.value); }); if (!r.ok) alertMsg(r.msg); dayPop(ownerSerial, day, onChange); if (onChange) onChange(); }; });
    $('popBody').querySelectorAll('[data-vis]').forEach(function (sel) { sel.onchange = function () { var r = APP.run(function () { CORE.setVis(APP.state(), me, sel.dataset.vis, sel.value); }); if (!r.ok) alertMsg(r.msg); dayPop(ownerSerial, day, onChange); if (onChange) onChange(); }; });
    $('popBody').querySelectorAll('[data-goserial]').forEach(function (b) { b.onclick = function () { close(); APP.goTable(b.dataset.goserial, 'res', 'link'); }; });
  }
  function tagFor(e) { var cls = { traded: '', nodock: 'bad', invalid: 'bad', miss: 'bad', booked: 'wait' }[e.status]; return '<span class="tag ' + (cls == null ? 'off' : cls) + '">' + esc(e.result) + '</span>'; }
  function alertMsg(t) { var el = document.createElement('div'); el.className = 'small warn'; el.textContent = t; $('popBody').prepend(el); }
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

  return { pop: pop, close: close, isOpen: isOpen, flash: flash, page: page, calSheet: calSheet, ymOf: ymOf, dayPop: dayPop, cellCls: cellCls, fitInputs: fitInputs, textWidth: textWidth };
})();
