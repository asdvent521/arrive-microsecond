/* ===== v9 表格世界：四張紙（DESIGN 7-1、補十五） =====
 * 每一頁就是紙本那張 A4 橫式（297×210），整張照畫面寬等比例縮放；欄位、格線、底下的說明跟印出來的一樣，格子裡多了按鈕。
 * 最上面一列：「序號或密鑰」框、去、骰子、四張紙的分頁（事件簿、資源表、公告欄、更多）、現在是誰。
 * 寫進去的是藍字、簽名是紅字（系統簽）。只呼叫 APP、CORE 和共用的 KIT；要去達秒屋就叫 APP.goHouse。
 */
var SHEETS = (function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = APP.esc, opt = APP.opt, now = APP.now;
  var S = function () { return APP.state(); }, me = function () { return APP.me(); };
  var roleOf = APP.roleOf, ver = APP.ver, pend = APP.pend;
  var TABS = [['log', '事件簿'], ['res', '資源表'], ['find', '公告欄'], ['more', '更多']];
  var MORE = [['rules', '規則表', '用途、對接條件、兩個開關、家規和家規網站、每人最多給的預設'], ['together', '一起成交', '幾個人湊成一圈一起換：開時段時勾「一起成交」'], ['greet', '打招呼密鑰', '常見面的人：在框裡輸入密鑰當場換一次'], ['slots', '我開的時段', '整理全部時段、刪掉沒人約的'], ['house', '我的達秒屋', '門牌、整間屋給誰看、新的一筆預設、去蓋房子'], ['village', '鄰居和村子', '第 6 輪才有'], ['role', '角色設定', '聯絡方式、不玩了（最下面是測試用的換人）'], ['help', '說明', '每個字是什麼意思']];
  var NAMES = { log: '事件簿', res: '資源表', find: '公告欄', more: '更多', orules: '他的規則' };
  MORE.forEach(function (m) { NAMES[m[0]] = m[1]; });
  var UI = { sheet: 'log', other: null, osheet: 'res', day: null, kw: '', msg: '', focus: null, page: 0, dice: null };
  if (APP.isBlank()) UI.sheet = 'res';
  var MM = function (n) { return 'calc(var(--mm)*' + n + ')'; };

  /* ---------- 小工具 ---------- */
  var dash = '<span class="dim">—</span>';
  function btn(act, label, attrs, cls) { return '<button type="button" class="mini' + (cls ? ' ' + cls : '') + '" data-act="' + act + '"' + (attrs || '') + '>' + esc(label) + '</button>'; }
  function lk(serial) { var r = roleOf(serial); return '<button type="button" class="lk" data-act="visit" data-id="' + esc(serial) + '">' + esc(CORE.abbrev(serial)) + '</button>' + (r ? '' : '<small>（不玩了）</small>'); }
  function nameOf(serial) { var r = roleOf(serial); return r ? r.name : CORE.abbrev(serial); }
  function sig(text) { return '<span class="sig">' + esc(text) + '</span>'; }
  function hhmm(us) { return CORE.fmtUs(us).slice(11, 16); }
  function md(dn) { var l = CORE.dayLabel(dn); return +l.slice(5, 7) + '/' + +l.slice(8, 10); }
  function dayText(dn) { var l = CORE.dayLabel(dn), d = new Date(l + 'T12:00:00'); return +l.slice(0, 4) + ' 年 ' + +l.slice(5, 7) + ' 月 ' + +l.slice(8, 10) + ' 日（' + '日一二三四五六'[d.getDay()] + '）'; }
  function leftText(us) { var d = (us - now()) / 1e6; return d > 0 ? '還有 ' + (d >= 3600 ? Math.floor(d / 3600) + ' 小時 ' + Math.floor(d % 3600 / 60) + ' 分' : d >= 60 ? Math.floor(d / 60) + ' 分 ' + Math.floor(d % 60) + ' 秒' : Math.ceil(d) + ' 秒') : '到了'; }
  function view() { return UI.other ? roleOf(UI.other) : me(); }
  function mine() { return !UI.other; }
  function keepText(x) { return x.keepDays == null ? '一直留' : '留 ' + x.keepDays + ' 天'; }
  function rowH(h) { return ' style="height:' + MM(h) + '"'; }
  function pad(n, cols, h) { var s = ''; for (var i = 0; i < n; i++) s += '<tr class="blank"' + rowH(h) + '>' + '<td></td>'.repeat(cols) + '</tr>'; return s; }
  function cols(ws) { return '<colgroup>' + ws.map(function (w) { return '<col style="width:' + w + '%">'; }).join('') + '</colgroup>'; }
  function th(list) { return '<thead><tr>' + list.map(function (c) { return '<th>' + c[0] + (c[1] ? '<small>' + c[1] + '</small>' : '') + '</th>'; }).join('') + '</tr></thead>'; }
  // 一張紙：標題、副標、上面的欄位、表、底下的說明
  function page(key, title, sub, fields, body, foot, grow) {
    return '<section class="page' + (grow ? ' grow' : '') + '" data-sheet="' + key + '"><header><div><h1>' + esc(title) + '</h1></div><div class="sub">' + sub + '</div></header>' + (fields ? '<div class="fields">' + fields + '</div>' : '') + body + (foot ? '<p class="foot">' + foot + '</p>' : '') + '</section>';
  }
  function ln(html, cls) { return '<span class="ln' + (cls ? ' ' + cls : '') + '">' + html + '</span>'; }
  function inp(attrs, value, ph) { return '<input type="text" class="w"' + attrs + ' value="' + esc(value == null ? '' : value) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>'; }
  function eligTag(e) { return e.self ? '<span class="tagp off">自己</span>' : e.ok ? '<span class="tagp">通</span>' : '<span class="tagp bad" title="' + esc(e.reason) + '">不通：' + esc(e.reason) + '</span>'; }
  function itemsText(items) { return items.length ? items.map(function (it) { return it.name + '・' + it.price; }).join('、') : '—'; }
  var PAGE_ROWS = 10;

  /* ---------- 事件簿：一天一張 ---------- */
  function today() { return CORE.dayNum(now()); }
  function dayOf() { return UI.day == null ? today() : UI.day; }
  // 這一天的每一行：每一筆（約好／成交／沒成／沒來）、我開的還沒人約的時段，照時間排
  function dayRows(m, dn) {
    var rows = [];
    CORE.entriesOf(S()).forEach(function (e) { if ((e.a === m.serial || e.b === m.serial) && CORE.dayNum(e.atUs) === dn) rows.push({ kind: 'entry', at: e.atUs, e: e }); });
    m.slots.forEach(function (s) { if (CORE.dayNum(s.atUs) === dn && !s.bookings.length && !s.greet) rows.push({ kind: 'open', at: s.atUs, s: s }); });
    return rows.sort(function (x, y) { return x.at - y.at; });
  }
  function logPage() {
    var m = me(), dn = dayOf(), isToday = dn === today(), rows = dayRows(m, dn), daily = CORE.dailyPoints(m, CORE.dayStartUs(dn) + 1e6), left = daily, t = now();
    var canOpen = mine() && !APP.isBlank() && dn >= today();
    var pages = Math.max(1, Math.ceil((rows.length + (canOpen ? 1 : 0)) / PAGE_ROWS)); if (UI.page >= pages) UI.page = pages - 1;
    var trs = '', shown = 0, all = [];
    rows.forEach(function (r) {
      if (r.kind === 'open') { var s = r.s; all.push('<tr data-row data-id="' + s.id + '"' + rowH(9.6) + '><td>' + hhmm(s.atUs) + (s.together ? '<span class="cd">一起</span>' : '') + '</td><td>我開的</td><td colspan="2"><span class="dim">等人來約（0／' + s.capacity + '）' + (s.judged ? '，沒人來' : '') + '</span></td><td>' + (s.judged ? '沒人約' : '') + '</td><td></td><td></td><td>' + (!s.judged && s.atUs > t ? btn('delSlot', '刪', ' data-id="' + s.id + '"', 'o') : '') + '</td></tr>'); return; }
      var e = r.e, other = e.a === m.serial ? e.b : e.a, on = e.names[other] || nameOf(other), x = CORE.slotOf(S(), e.slot), s = x ? x.slot : null, dk = e.docking ? CORE.dockingOf(S(), e.docking) : null;
      var tag = e.together ? '<span class="cd">一起</span>' : e.daily ? '<span class="cd">每天' + (s && s.standing ? ' ' + btn('stopDaily', '停', ' data-id="' + s.standing + '"', 'o') : '') + '</span>' : e.greet ? '<span class="cd">密鑰</span>' : e.tutorial ? '<span class="cd">教學</span>' : '';
      if (e.status === 'booked' && s && !s.judged) {
        var myPick = CORE.wantsValid(S(), s, m.serial, other), theirs = CORE.wantsValid(S(), s, other, m.serial), vo = CORE.version(roleOf(other) || m, s.atUs), vm = CORE.version(m, s.atUs);
        var gave = theirs.length ? theirs.map(function (id) { var y = CORE.resourceOf(vm, id); return y ? y.name + '・' + y.price : id; }).join('、') : '<span class="dim">他還沒選</span>';
        var got = (myPick.length ? myPick.map(function (id) { var y = CORE.resourceOf(vo, id); return y ? esc(y.name) + '<small>' + keepText(y) + '</small>' : esc(id); }).join('') + btn('pick', '換', ' data-id="' + s.id + '" data-other="' + other + '"', 'o') : btn('pick', '選他的東西', ' data-id="' + s.id + '" data-other="' + other + '"')) + (e.daily ? '<small>固定約，換同樣的</small>' : '');
        var isOwner = x.owner.serial === m.serial;
        var arrive = '<label class="arr"><input type="checkbox" data-ed="present" data-id="' + s.id + '"' + (CORE.isPresent(S(), m.serial, s.id) ? ' checked' : '') + '>會到</label>';
        var cancel = isOwner ? '' : btn('cancelBook', '取消', ' data-id="' + s.id + '"', 'o');
        all.push('<tr class="future" data-row data-id="' + e.id + '"' + rowH(9.6) + '><td>' + hhmm(e.atUs) + '<span class="cd" data-left="' + e.atUs + '">' + leftText(e.atUs) + '</span>' + tag + '</td><td>' + lk(other) + ' ' + esc(on) + (s.together ? '<small>' + esc(CORE.togetherStatus(S(), s)) + '</small>' : '') + '</td><td>' + gave + '</td><td>' + got + '</td><td>' + arrive + '</td><td></td><td><span class="dim">到時候自動簽</span></td><td>' + cancel + '</td></tr>');
        return;
      }
      var gaveItems = dk ? (dk.a === m.serial ? dk.itemsA : dk.itemsB) : [], gotItems = dk ? (dk.a === m.serial ? dk.itemsB : dk.itemsA) : [], gavePts = dk ? (dk.a === m.serial ? dk.gaveA : dk.gaveB) : 0;
      if (e.status === 'traded') left -= gavePts;
      var holds = dk ? S().holds.filter(function (h) { return h.docking === dk.id && h.holder === m.serial; }) : [];
      var redeemCell = '';
      if (e.status === 'traded' && gotItems.length) {
        var done = holds.filter(function (h) { return h.status === 'redeemed'; }), open = holds.filter(function (h) { return CORE.holdStatus(h, t) === 'held'; });
        if (open.length) redeemCell = btn('redeem', '兌現', ' data-id="' + open[0].id + '"'); else if (done.length) redeemCell = hhmm(done[done.length - 1].redeemedAt) + ' ' + sig(on); else redeemCell = '<span class="dim">' + (holds.length ? '到期作廢' : '') + '</span>';
      }
      var result = e.status === 'traded' ? '成交' : e.status === 'miss' ? '沒來' : '沒成';
      var gotText = gotItems.length ? gotItems.map(function (it) { var h = holds.find(function (y) { return y.resource === it.id; }); return esc(it.name) + (h ? '<small>' + (h.untilDay == null ? '一直留' : '留到 ' + md(h.untilDay)) + '</small>' : ''); }).join('') : dash;
      all.push('<tr data-row data-id="' + e.id + '" class="' + e.status + '"' + rowH(9.6) + '><td>' + hhmm(e.atUs) + tag + '</td><td>' + lk(other) + ' ' + esc(on) + '</td><td>' + (gaveItems.length ? esc(itemsText(gaveItems)) : dash) + '</td><td>' + gotText + '</td><td>' + result + (e.status !== 'traded' && e.reason ? btn('why', '？', ' data-why="' + esc(e.reason) + '"', 'o') : '') + '</td><td class="r">' + (e.status === 'traded' || e.status === 'nodock' ? left : '') + '</td><td>' + (e.status === 'traded' ? sig(on) : '') + '</td><td>' + redeemCell + '</td></tr>');
    });
    if (canOpen) all.push('<tr class="addrow"' + rowH(9.6) + '><td><input type="time" id="addSlotTime" aria-label="在這裡寫時間就開一個時段"></td><td><span class="dim">我開的</span><small>名額 <input type="number" id="addSlotCap" value="1" min="1" aria-label="名額"> <label class="arr"><input type="checkbox" id="addSlotTogether">一起成交</label></small></td><td colspan="5"><span class="dim">在時間格寫時間，就開了一個時段，等人來約</span></td><td>' + btn('addSlot', '開時段', '', '') + '</td></tr>');
    var from = UI.page * PAGE_ROWS, slice = all.slice(from, from + PAGE_ROWS);
    trs = slice.join('') + pad(PAGE_ROWS - slice.length, 8, 9.6);
    // 下面那張：以前收到、還沒兌現的（今天兌現的也留著，簽名變紅字）
    var held = S().holds.filter(function (h) { return h.holder === m.serial && CORE.dayNum(h.atUs) !== dn && (CORE.holdStatus(h, t) === 'held' || (h.status === 'redeemed' && CORE.dayNum(h.redeemedAt) === dn)); }).sort(function (a, b) { return a.atUs - b.atUs; });
    var trs2 = held.slice(0, 3).map(function (h) { return '<tr data-row data-id="' + h.id + '"' + rowH(8.6) + '><td>' + md(CORE.dayNum(h.atUs)) + '</td><td>' + lk(h.issuer) + ' ' + esc(nameOf(h.issuer)) + '</td><td>' + esc(h.name) + '<small>' + (h.untilDay == null ? '一直留' : '留到 ' + md(h.untilDay)) + '</small></td><td>' + (h.status === 'redeemed' ? hhmm(h.redeemedAt) + ' ' + sig(nameOf(h.issuer)) : btn('redeem', '兌現', ' data-id="' + h.id + '"')) + '</td></tr>'; }).join('') + pad(Math.max(0, 3 - held.length), 4, 8.6) + (held.length > 3 ? '<tr' + rowH(6) + '><td colspan="4" class="dim">還有 ' + (held.length - 3) + ' 筆，在「更多」裡看</td></tr>' : '');
    var remind = reminders(m);
    var sub = btn('prevDay', '‹ 前一天', '', 'o') + btn('nextDay', '後一天 ›', '', 'o') + (isToday ? '' : btn('today', '今天', '', 'o')) + '　一天一張・照時間往下寫・舊的收在一起就是日曆' + (pages > 1 ? '　' + btn('pagePrev', '‹', UI.page ? '' : ' disabled', 'o') + ' 第 ' + (UI.page + 1) + '／' + pages + ' 張 ' + btn('pageNext', '›', UI.page < pages - 1 ? '' : ' disabled', 'o') : '');
    var fields = '<span>日期 ' + ln('<button type="button" class="lk" data-act="pickDay">' + esc(dayText(dn)) + '</button>') + '</span><span>名字 ' + ln(esc(m.name) + '（' + esc(CORE.abbrev(m.serial)) + '）') + '</span><span>今天最多給 ' + ln(String(daily), 's') + ' 點</span>' + (isToday ? '<span>現在還能給 ' + ln('<b id="energyText">' + CORE.remainingToday(S(), m, t) + '</b>', 's') + ' 點</span>' : '');
    var body = (remind ? '<div class="remind">' + remind + '</div>' : '') + '<table>' + cols([8, 12, 17, 20, 9, 8, 11, 15]) + th([['時間'], ['跟誰'], ['我給他', '他選了我的什麼・價錢'], ['我收到', '我選了他的什麼・保留到哪天'], ['結果', '成交／沒成／沒來'], ['今天還剩', '點'], ['對方簽名', '成交就自動簽'], ['兌現', '哪天・對方簽名']]) + '<tbody>' + trs + '</tbody></table>' +
      '<div class="lab">以前收到、還沒兌現的（今天去換）</div><table>' + cols([16, 16, 40, 28]) + th([['哪天收到的'], ['誰的'], ['什麼東西'], ['兌現・對方簽名']]) + '<tbody>' + trs2 + '</tbody></table>';
    return page('log', '事件簿', sub, fields, body, '<b>成交</b>：在約好的時間見面，兩邊都選了對方一樣東西才算，只有一邊選就是沒成。<b>今天還剩</b>：每成交一次，扣掉對方選的那樣東西的價錢，扣到 0 就不能再給；沒給完的點隔天不留。<b>簽名</b>：網頁上成交那一刻系統替兩邊簽，紅字就是對方簽的。<b>開時段</b>：在空白那一行的時間格寫時間。');
  }
  // 最上面一行小字：有人要跟你配密鑰、還沒確認到達、正在等對方輸入密鑰、教學
  function reminders(m) {
    var out = [], t = now();
    CORE.myGreets(S(), m.serial, t).forEach(function (g) { if (g.pending && !g.pending.mine) out.push(esc(g.otherName) + ' 要跟你配打招呼密鑰「' + esc(g.pending.key) + '」' + btn('open', '去看', ' data-s="greet"', 'o')); });
    var w = CORE.waitingOn(S(), m.serial, t); if (w) out.push('已經輸入密鑰，等對方 1 分鐘內也輸入（<span data-left="' + w.until + '">' + leftText(w.until) + '</span>）');
    CORE.myBookings(S(), m, t).forEach(function (b) { if (!CORE.isPresent(S(), m.serial, b.slot.id)) out.push('還沒確認會到 ' + esc(b.owner.name) + ' ' + hhmm(b.slot.atUs) + ' 的時段：沒確認就算沒來'); });
    m.slots.forEach(function (s) { if (!s.judged && s.together && s.bookings.length) out.push('你開的 ' + hhmm(s.atUs) + ' 是一起成交的時段：' + esc(CORE.togetherStatus(S(), s))); });
    return out.join('；');
  }
  // 點日期：跳出一個月的小日曆，點一格就翻到那天
  function pickDay(offset) {
    var base = new Date(now() / 1000), d = new Date(base.getFullYear(), base.getMonth() + (offset || 0), 1, 12), y = d.getFullYear(), mo = d.getMonth();
    var first = CORE.dayNum(new Date(y, mo, 1, 12).getTime() * 1000), days = new Date(y, mo + 1, 0).getDate(), lead = new Date(y, mo, 1).getDay(), m = me();
    var v = CORE.viewHouse(S(), m.serial, m.serial, now()), byDay = {}; v.bricks.forEach(function (b) { byDay[b.day] = b; });
    var cells = ''; for (var i = 0; i < lead; i++) cells += '<span class="cd pad"></span>';
    for (var k = 0; k < days; k++) { var dn = first + k, b = byDay[dn]; cells += '<button type="button" class="cd ' + KIT.cellCls(b) + (dn === today() ? ' today' : '') + '" data-jump="' + dn + '"><span class="dn">' + (k + 1) + '</span>' + (b && b.lit > 1 ? '<span class="cnt">' + b.lit + '</span>' : '') + '</button>'; }
    var html = '<div class="cal"><div class="calhead"><button type="button" class="btn sm" data-mo="' + ((offset || 0) - 1) + '">‹ 上個月</button><b class="num">' + y + ' 年 ' + (mo + 1) + ' 月</b><button type="button" class="btn sm" data-mo="' + ((offset || 0) + 1) + '">下個月 ›</button></div><div class="wk"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div><div class="grid">' + cells + '</div><div class="small muted">點一格就翻到那天；亮的是有成交的日子</div></div>';
    KIT.pop('翻到哪一天', { html: html }, [{ label: '不要', pri: true }]);
    $('popBody').querySelectorAll('[data-mo]').forEach(function (b) { b.onclick = function () { pickDay(+b.dataset.mo); }; });
    $('popBody').querySelectorAll('[data-jump]').forEach(function (b) { b.onclick = function () { KIT.close(); UI.day = +b.dataset.jump; UI.page = 0; render(); }; });
  }
  // 選他的東西：每樣東西一行，點了就選（可以多樣）
  function pickItems(slotId, other) {
    var x = CORE.slotOf(S(), slotId); if (!x || x.slot.judged) { msg('那一微秒已經過了'); return; }
    var s = x.slot, o = roleOf(other), m = me(), v = CORE.version(o, s.atUs), sel = CORE.wantsValid(S(), s, m.serial, other).slice(), gone = CORE.goneText(S(), s, m.serial, other);
    var draw = function () {
      var html = (gone ? '<div class="small warn">' + esc(gone) + '</div>' : '') + v.resources.map(function (y) { var n = sel.filter(function (id) { return id === y.id; }).length; return '<div class="opt' + (n ? ' on' : '') + '"><span>' + esc(y.name) + (y.kind ? ' <small>' + esc(CORE.KINDS[y.kind]) + '</small>' : '') + '<small>' + esc(keepText(y)) + '・可換 ' + CORE.stockOf(o, y.id).avail + '</small></span><span class="pq"><button type="button" class="mini o" data-sub="' + y.id + '"' + (n ? '' : ' disabled') + '>−</button><b>' + n + '</b><button type="button" class="mini o" data-add="' + y.id + '">＋</button> <b>' + y.price + ' 點</b></span></div>'; }).join('') + '<div class="small">合計 ' + sel.reduce(function (t, id) { var y = CORE.resourceOf(v, id); return t + (y ? y.price : 0); }, 0) + ' ' + esc(o.name) + '點（算他今天給出去的點，不扣你的）</div>';
      KIT.pop('選 ' + o.name + ' 的東西', { html: html }, [{ label: '取消', fn: function () {} }, { label: '選好了', pri: true, fn: function () { run(function () { CORE.setWants(S(), s.id, m.serial, other, sel); }, sel.length ? '選好了，時間到自動成交' : '沒選：一換一，沒選就不會成交'); } }]);
      $('popBody').querySelectorAll('[data-add]').forEach(function (b) { b.onclick = function () { sel.push(b.dataset.add); draw(); }; });
      $('popBody').querySelectorAll('[data-sub]').forEach(function (b) { b.onclick = function () { var i = sel.indexOf(b.dataset.sub); if (i >= 0) sel.splice(i, 1); draw(); }; });
    };
    draw();
  }

  /* ---------- 資源表 ---------- */
  function boxes(avail, reserved, max) {
    var s = '', n = Math.min(max, reserved + avail); for (var i = 0; i < n; i++) s += '<span class="box' + (i < reserved ? ' x' : '') + '"></span>';
    return s + (reserved + avail > max ? '<small>共 ' + (reserved + avail) + ' 份（' + reserved + ' 份留給別人）</small>' : '');
  }
  function kindBoxes(x, editable) {
    if (!editable) return x.kind ? esc(CORE.KINDS[x.kind]) : (x.price === 0 ? '<span class="dim">（空的不用勾）</span>' : '<span class="dim">還沒選</span>');
    return Object.keys(CORE.KINDS).map(function (k) { return '<button type="button" class="box' + (x.kind === k ? ' on' : '') + '" data-act="kind" data-id="' + x.id + '" data-k="' + k + '" aria-label="' + CORE.KINDS[k] + '"></button>' + CORE.KINDS[k] + '　'; }).join('') + (!x.kind && x.price > 0 ? '<span class="dim warn">還沒選</span>' : x.price === 0 && !x.kind ? '<small>（空的不用勾）</small>' : '');
  }
  function condSummary(r) { var ru = ver(r).rules, parts = ru.conditions.map(CORE.condText); if (ru.bothMustPass) parts.push('要兩方都通'); if (ru.mustAcceptVillage) parts.push('要接受我的家規'); return parts.join('；'); }
  function resPage() {
    var r = view(), m = me(), t = now();
    if (mine() && APP.isBlank()) return createPage();
    var todayV = ver(r), p = pend(r), own = mine(), list = own ? (p || todayV).resources : todayV.resources.slice();
    if (!own && p) p.resources.forEach(function (y) { if (!CORE.resourceOf(todayV, y.id)) list.push(Object.assign({ _new: true }, y)); });
    var ROWS = own ? PAGE_ROWS : 6, pages = Math.max(1, Math.ceil((list.length + (own ? 1 : 0)) / ROWS)); if (UI.page >= pages) UI.page = pages - 1;   // 他的那張紙下面還有他的時段，表短一點
    var all = list.map(function (x, i) {
      var t0 = CORE.resourceOf(todayV, x.id), st = CORE.stockOf(r, x.id), chg = own && t0 ? resChange(x, t0) : (own && !t0 ? '明天起新增' : x._new ? '明天起新增' : '');
      var defCell = own ? inp(' data-ed="resDef" data-id="' + x.id + '" aria-label="怎樣算給到了"', x.def, '寫到對方確定收到沒') : (x.def ? esc(x.def) : '<span class="dim">（沒寫）</span>');
      if ((x.def || '').length > 24) defCell += btn('fullDef', '全部', ' data-id="' + r.serial + '" data-res="' + x.id + '"', 'o');
      return '<tr data-row data-id="' + r.serial + ':' + x.id + '"' + rowH(12.5) + '><td class="k">' + (i + 1) + '</td><td>' + (own ? inp(' data-ed="resName" data-id="' + x.id + '" aria-label="東西"', x.name) : esc(x.name)) + (chg ? '<small class="warn">' + esc(chg) + '</small>' : '') + '</td><td class="k">' + kindBoxes(x, own) + '</td><td>' + defCell + '</td><td class="r">' + (own ? '<input type="number" class="w r" data-ed="resPrice" data-id="' + x.id + '" value="' + x.price + '" min="0" aria-label="價錢">' : x.price) + '</td><td>' + (own ? '<input type="number" class="w" data-ed="resKeep" data-id="' + x.id + '" value="' + (x.keepDays == null ? '' : x.keepDays) + '" placeholder="一直" min="1" aria-label="保留幾天">' : esc(keepText(x))) + '</td><td>' + (x._new ? dash : boxes(st.avail, st.reserved, 8) + (own ? ' ' + btn('stock', '補', ' data-id="' + x.id + '" data-n="1"', 'o') + btn('stock', '減', ' data-id="' + x.id + '" data-n="-1"', 'o') + btn('resMore', '…', ' data-id="' + x.id + '"', 'o') : '<small>可換 ' + st.avail + '</small>')) + '</td></tr>';
    });
    if (own) all.push('<tr class="addrow"' + rowH(12.5) + '><td class="k">' + (list.length + 1) + '</td><td>' + inp(' data-new="res" aria-label="寫一樣東西就是加"', '', '寫一樣東西') + '</td><td class="k"><span class="dim">寫了名字再勾</span></td><td></td><td></td><td></td><td></td></tr>');
    var from = UI.page * ROWS, slice = all.slice(from, from + ROWS), trs = slice.join('') + pad(ROWS - slice.length, 7, 12.5);
    var fromDay = p ? CORE.dayLabel(p.fromDay) : CORE.dayLabel(CORE.dayNum(t));
    var fields = '<span>名字 ' + ln(esc(r.name)) + '</span><span>序號 ' + ln(esc(CORE.abbrev(r.serial)), 's') + '</span><span>每天最多給 ' + ln(own ? '<input type="number" data-ed="daily" value="' + (p ? p.dailyPoints : todayV.dailyPoints) + '" min="1" aria-label="每天最多給">' : String(todayV.dailyPoints), 's') + ' 點</span><span>從 ' + ln(esc(fromDay.slice(5).replace('-', ' 月 ') + ' 日'), 's') + ' 起</span>' +
      (own ? '<span>只跟這樣的人換（不寫＝誰都可以） ' + ln(esc(condSummary(r) || '誰都可以') + ' ' + btn('open', '改', ' data-s="rules"', 'o'), 'l') + '</span>' : '<span>換點比例 ' + ln(esc(CORE.ratio(S(), r.serial).text), 'l') + '</span><span>對接過 ' + ln(String(CORE.dockCount(S(), r.serial)), 's') + ' 次</span><span>只跟這樣的人換 ' + ln(esc(condSummary(r) || '誰都可以'), 'l') + '</span>');
    var sub = (own ? '一人一張・改了隔天才算（份數馬上算）' : esc(r.name) + ' 的資源表（不能改）・' + eligTag(CORE.canBook(S(), r, m, t))) + (pages > 1 ? '　' + btn('pagePrev', '‹', UI.page ? '' : ' disabled', 'o') + ' 第 ' + (UI.page + 1) + '／' + pages + ' 張 ' + btn('pageNext', '›', UI.page < pages - 1 ? '' : ' disabled', 'o') : '');
    var empties = todayV.resources.filter(function (x) { return x.price === 0; }), emptyAvail = empties.reduce(function (n, x) { return n + CORE.stockOf(m, x.id).avail; }, 0);
    var remind = own ? (!empties.length ? '想只收不給，要有一樣 0 點的「空的」給對方選：在空白那一行寫「空的」，價錢 0，按「補」' : emptyAvail === 0 ? '0 點的「' + esc(empties[0].name) + '」可換 0 份：按「補」才能只收不給' : '') : '';
    var body = (remind ? '<div class="remind">' + remind + '</div>' : '') + '<table>' + cols([4, 17, 20, 27, 7, 8, 17]) + th([['#'], ['東西'], ['種類', '訊息／行為／物質'], ['怎樣算給到了', '寫到對方確定收到沒'], ['價錢', '點'], ['保留幾天', '沒寫就一直留'], ['有幾份', '有人選走就劃掉一格']]) + '<tbody>' + trs + '</tbody></table>';
    if (!own) body += theirSlots(r, m, t);
    var foot = own ? '<b>不能寫</b>：錢、禮券、儲值卡這些等同錢的東西，和違法的東西。<b>空的</b>：想只收不給時給對方選，每個人都要有一份。<b>有幾份</b>：別人選走一份，網頁自動劃掉一格；按「補」多一格。<b>怎樣算給到了</b>：要寫到對方確定自己收到了沒，不要只寫「能量」。' : '<b>約他</b>：約好就多一行到那天的事件簿，在那一行選他的東西。<b>看他的規則</b>：對接條件、家規和接受。';
    return page('res', '資源表', sub, fields, body, foot);
  }
  function resChange(x, t0) { var out = []; if (t0.name !== x.name) out.push('改名（今天「' + t0.name + '」）'); if (t0.price !== x.price) out.push('明天起 ' + x.price + ' 點（今天 ' + t0.price + '）'); if (t0.keepDays !== x.keepDays) out.push('明天起' + (x.keepDays == null ? '一直留' : '留 ' + x.keepDays + ' 天')); if ((t0.kind || '') !== (x.kind || '')) out.push('明天起' + (CORE.KINDS[x.kind] || '還沒選')); if ((t0.def || '') !== (x.def || '')) out.push('明天起改了定義'); return out.join('；'); }
  // 他的那張紙下面：他的時段（每個旁邊約他）、看他的規則、看他的達秒屋、跟他設打招呼密鑰、回我自己
  function theirSlots(r, m, t) {
    var e = CORE.canBook(S(), r, m, t), up = r.slots.filter(function (s) { return s.atUs > t && !s.judged && !s.greet && !s.standing; }).sort(function (a, b) { return a.atUs - b.atUs; });
    var trs = up.slice(0, 3).map(function (s) {
      var booked = s.bookings.indexOf(m.serial) >= 0, full = s.bookings.length >= s.capacity;
      var act = booked ? '<span class="tagp">你約了</span> ' + btn('goLog', '去事件簿', ' data-day="' + CORE.dayNum(s.atUs) + '" data-id="' + s.id + '"', 'o') : full ? '<span class="tagp off">滿了</span>' : !e.ok ? '<span class="tagp bad">條件不通</span>' : '<label class="arr"><input type="checkbox" id="arr_' + s.id + '" checked aria-label="會到">會到</label> ' + btn('book', '約他', ' data-id="' + s.id + '"');
      return '<tr data-row data-id="' + s.id + '"' + rowH(8) + '><td>' + CORE.dayLabel(CORE.dayNum(s.atUs)).slice(5) + ' ' + hhmm(s.atUs) + '<small>' + CORE.fmtUs(s.atUs).slice(17) + '</small>' + (s.together ? '<span class="cd">一起成交 ' + esc(CORE.togetherStatus(S(), s)) + '</span>' : '') + '</td><td>' + s.bookings.length + '／' + s.capacity + '</td><td>' + act + '</td></tr>';
    }).join('') + pad(Math.max(0, 3 - up.length), 3, 8) + (up.length > 3 ? '<tr' + rowH(5) + '><td colspan="3" class="dim">還有 ' + (up.length - 3) + ' 個時段</td></tr>' : '');
    return '<div class="lab">他的時段（' + (up.length ? up.length + ' 個' : '沒有開放的時段') + '）</div><table>' + cols([46, 14, 40]) + th([['那一微秒'], ['名額'], ['約他', '會到預設勾著：約的時候就確認到達']]) + '<tbody>' + trs + '</tbody></table>' +
      '<div class="acts">' + btn('orules', '看他的規則', ' data-id="' + r.serial + '"') + btn('house', '看他的達秒屋', ' data-id="' + r.serial + '"') + btn('greetSet', '跟他設打招呼密鑰', ' data-id="' + r.serial + '"') + btn('home', '回我自己', '', 'o') + '</div>';
  }
  // 還沒創角色：資源表那張紙已經寫好第一行「空的」，填名字和每天的點就好
  function createPage() {
    var fields = '<span>名字 ' + ln('<input type="text" id="cName" value="我" aria-label="名字">') + '</span><span>序號 ' + ln('<span class="dim">建好就有</span>', 's') + '</span><span>每天最多給 ' + ln('<input type="number" id="cDaily" value="' + CORE.DEFAULT_DAILY + '" min="1" aria-label="每天最多給">', 's') + ' 點</span><span>' + btn('create', '建立', '', 'go') + ' ' + btn('createSkip', '建立，跳過教學', '', 'o') + '</span>';
    var trs = '<tr class="addrow"' + rowH(12.5) + '><td class="k">1</td><td><input type="text" class="w" id="cItem" value="空的" aria-label="第一樣東西"></td><td class="k"><span class="dim">（空的不用勾）</span></td><td><input type="text" class="w" id="cDef" value="什麼都不給" aria-label="怎樣算給到了"></td><td class="r"><input type="number" class="w r" id="cPrice" value="0" min="0" aria-label="價錢"></td><td></td><td><input type="number" class="w" id="cQty" value="1" min="0" aria-label="補幾份" style="width:' + MM(10) + '"> 份</td></tr>' + pad(9, 7, 12.5);
    var body = '<table>' + cols([4, 17, 20, 27, 7, 8, 17]) + th([['#'], ['東西'], ['種類', '訊息／行為／物質'], ['怎樣算給到了', '寫到對方確定收到沒'], ['價錢', '點'], ['保留幾天', '沒寫就一直留'], ['有幾份']]) + '<tbody>' + trs + '</tbody></table>';
    return page('res', '資源表', '還沒創角色：第一行「空的」已經幫你寫好，填名字和每天的點，按「建立」。一個人只有一個角色，創角色當下就生效', fields, body, '<b>空的</b>：0 點、什麼都不給，想只收不給時給對方選；每個人都要有一份。<b>每天最多給</b>：你每天最多能給出去的東西價錢加起來，預設 2000，自己定。');
  }

  /* ---------- 公告欄 ---------- */
  function findPage() {
    var m = me(), t = now(), res = CORE.search(S(), m.serial, UI.kw, t), v = ver(m), p = pend(m);
    var myRes = v.resources.concat(p ? p.resources.filter(function (y) { return !CORE.resourceOf(v, y.id); }) : []);
    var mineRow = APP.isBlank() ? '' : '<tr class="addrow" data-row data-id="post"' + rowH(10) + '><td>' + esc(CORE.abbrev(m.serial)) + '</td><td>我</td><td>' + inp(' id="ntNeed" aria-label="我需要什麼"', '', '我需要什麼') + '<small><input type="text" id="ntKind" placeholder="種類（選填）" aria-label="種類"></small></td><td>' + (myRes.length ? myRes.map(function (x) { return '<label class="arr"><input type="checkbox" data-give="' + x.id + '">' + esc(x.name) + '</label> '; }).join('') : '<span class="dim">資源表是空的</span>') + '</td><td><input type="date" id="ntUntil" value="' + CORE.dayLabel(CORE.dayNum(t) + 7) + '" aria-label="掛到哪一天"><small>最多 <input type="number" id="ntCap" value="3" min="2" aria-label="一圈最多幾人"> 人</small></td><td>' + btn('post', '掛上去', '') + '</td></tr>';
    var ns = res.notices;
    var trs = ns.slice(0, 5).map(function (x) {
      var n = x.notice, own = n.owner === m.serial;
      return '<tr data-row data-id="' + n.id + '" class="' + (own ? 'mine' : '') + '"' + rowH(10) + '><td>' + lk(n.owner) + '</td><td>' + (own ? '我' : esc(x.role.name)) + '</td><td>' + esc(n.need) + (n.kind ? '<small>' + esc(n.kind) + '</small>' : '') + '</td><td>' + esc(x.give.join('、') || '—') + '</td><td>' + (n.untilDay == null ? '<span class="dim">沒有期限</span>' : md(n.untilDay)) + '<small>最多 ' + n.cap + ' 人</small></td><td>' + (own ? btn('unpost', '撤掉', ' data-id="' + n.id + '"', 'o') : btn('bookNext', '約他', ' data-id="' + n.owner + '"') + btn('later', '接上去', ' disabled title="第 6 輪"', 'o') + '<small>' + eligTag(x.elig) + '</small>') + '</td></tr>';
    }).join('');
    trs = mineRow + trs + pad(Math.max(0, 5 - ns.length), 6, 10) + (ns.length > 5 ? '<tr' + rowH(5) + '><td colspan="6" class="dim">還有 ' + (ns.length - 5) + ' 張，打一個詞篩</td></tr>' : '');
    // 誰的資源表裡有：打了詞就是查資源；沒打就列全部的人
    var people = [];
    if (UI.kw) { var seen = {}; res.resources.forEach(function (x) { if (!seen[x.role.serial]) { seen[x.role.serial] = { role: x.role, items: [], elig: x.elig }; people.push(seen[x.role.serial]); } seen[x.role.serial].items.push(x.resource); }); }
    else S().roles.forEach(function (r) { if (r.serial !== m.serial) people.push({ role: r, items: CORE.version(r, t).resources.filter(function (y) { return y.price > 0; }), elig: CORE.canBook(S(), r, m, t) }); });
    var trs2 = people.slice(0, 4).map(function (q) {
      var s = CORE.nextSlot(q.role, t);
      return '<tr data-row data-id="' + q.role.serial + '"' + rowH(10) + '><td>' + lk(q.role.serial) + '</td><td>' + esc(q.role.name) + '</td><td>' + (q.items.length ? esc(q.items.map(function (y) { return y.name + '・' + y.price; }).join('、')) : '<span class="dim">（只有空的）</span>') + '</td><td>' + (s ? CORE.dayLabel(CORE.dayNum(s.atUs)).slice(5) + ' ' + hhmm(s.atUs) + '<small>' + s.bookings.length + '／' + s.capacity + '</small>' : '<span class="dim">沒開時段</span>') + '</td><td>' + btn('bookNext', '約他', ' data-id="' + q.role.serial + '"') + btn('visit', '看資源表', ' data-id="' + q.role.serial + '"', 'o') + '<small>' + eligTag(q.elig) + '</small></td></tr>';
    }).join('') + pad(Math.max(0, 4 - people.length), 5, 10) + (people.length > 4 ? '<tr' + rowH(5) + '><td colspan="5" class="dim">還有 ' + (people.length - 4) + ' 人</td></tr>' : '');
    var fields = '<span>找 ' + ln('<input type="search" id="kwIn" value="' + esc(UI.kw) + '" placeholder="例如：菜、傘、教" aria-label="找">', 'l') + ' ' + btn('search', '找', '', 'o') + (UI.kw ? ' ' + btn('clearKw', '清掉', '', 'o') : '') + '</span>' + (UI.kw ? '<span class="small">公告 ' + ns.length + ' 張・資源表 ' + people.length + ' 人</span>' : '');
    var body = '<table>' + cols([8, 9, 29, 24, 10, 20]) + th([['序號'], ['名字'], ['需要'], ['可以給', '接上來的人可以換到'], ['期限'], ['動作', '我通不通他的條件']]) + '<tbody>' + trs + '</tbody></table>' +
      '<div class="lab">誰的資源表裡有' + (UI.kw ? '「' + esc(UI.kw) + '」' : '東西') + '</div><table>' + cols([8, 9, 47, 13, 23]) + th([['序號'], ['名字'], ['他有什麼', '東西・價錢'], ['下一個時段'], ['約他']]) + '<tbody>' + trs2 + '</tbody></table>';
    return page('find', '公告欄', '掛出你要的、你能給的；打一個詞，公告和別人的資源表一起找', fields, body, '<b>公告</b>：第一行是你自己的，寫好按「掛上去」；過了期限自動拿掉，也可以撤掉。<b>約他</b>：約他下一個時段，約好就多一行到那天的事件簿，記得在那一行選他的東西。<b>接上去</b>：第 6 輪。<b>序號</b>：上面的框輸入序號，或按骰子，也能找到人。');
  }

  /* ---------- 更多 ---------- */
  function morePage() {
    var trs = MORE.map(function (x) { return '<tr data-row data-id="' + x[0] + '"' + rowH(12) + '><td class="k"><b>' + esc(x[1]) + '</b></td><td>' + esc(x[2]) + '</td><td>' + btn('open', '打開', ' data-s="' + x[0] + '"', 'o') + '</td></tr>'; }).join('');
    return page('more', '更多', '進階的都收在這裡；每一項打開也是一張同樣樣子的紙', '', '<table>' + cols([22, 60, 18]) + th([['功能'], ['做什麼'], ['']]) + '<tbody>' + trs + '</tbody></table>', '家規、一起成交、打招呼密鑰不在新手教學裡；第一次打開那一張，上面會有一行說明。');
  }
  function back() { return btn('open', '‹ 更多', ' data-s="more"', 'o') + '　'; }
  function kv(rows, ws) { return '<table>' + cols(ws || [22, 58, 20]) + '<tbody>' + rows.map(function (r) { return '<tr data-row data-id="' + esc(r.id) + '"' + rowH(r.h || 10) + '><td class="k">' + r.cells[0] + '</td><td>' + r.cells[1] + '</td><td>' + (r.cells[2] || '') + '</td></tr>'; }).join('') + '</tbody></table>'; }
  // 規則表：用途、對接條件（含對方要給的東西種類）、兩個開關、家規和家規網站、每人最多給的預設；改了明天起
  function rulesPage() {
    var r = me(), todayV = ver(r), ed = pend(r) || todayV, ru = ed.rules, rows = [];
    var st = function (a, b) { return JSON.stringify(a) === JSON.stringify(b) ? '<span class="tagp off">今天</span>' : '<span class="tagp">明天起</span>'; };
    var condSel = function (i, c) {
      var f = '<select data-ed="condField" data-id="' + i + '" aria-label="欄位">' + Object.keys(CORE.COND_FIELDS).map(function (k) { return opt(k, CORE.COND_FIELDS[k].label, c.field); }).join('') + '</select> ';
      if (CORE.COND_FIELDS[c.field] && CORE.COND_FIELDS[c.field].kinds) return f + '<select data-ed="condValue" data-id="' + i + '" aria-label="種類">' + Object.keys(CORE.GIVE_KINDS).map(function (k) { return opt(k, CORE.GIVE_KINDS[k], c.value); }).join('') + '</select>';
      return f + '<select data-ed="condOp" data-id="' + i + '" aria-label="比較">' + Object.keys(CORE.OPS).map(function (o) { return opt(o, CORE.OPS[o], c.op); }).join('') + '</select> <input type="number" class="kc" data-ed="condValue" data-id="' + i + '" value="' + c.value + '" aria-label="數值">';
    };
    ru.uses.forEach(function (u, i) { rows.push({ id: 'u' + i, cells: ['用途', inp(' data-ed="useText" data-id="' + i + '" aria-label="用途"', u), st(todayV.rules.uses[i], u) + btn('delUse', '刪', ' data-id="' + i + '"', 'o')] }); });
    rows.push({ id: 'u-add', cells: ['加用途', inp(' id="addUse" aria-label="新的用途"', '', '例如：1 我點 = 陪跑 1 分鐘'), btn('addUse', '加一條', '', 'o')] });
    ru.conditions.forEach(function (c, i) { rows.push({ id: 'c' + i, cells: ['對接條件', condSel(i, c) + '<small>' + esc(CORE.condText(c)) + '</small>', st(todayV.rules.conditions[i], c) + btn('delCond', '刪', ' data-id="' + i + '"', 'o')] }); });
    rows.push({ id: 'c-add', cells: ['加條件', condSel('new', { field: 'avail', op: '>=', value: 1 }).replace(/data-ed="cond(\w+)" data-id="new"/g, 'id="addCond$1"'), btn('addCond', '加一條', '', 'o')] });
    [['bothMustPass', '要求兩方都通'], ['mustAcceptVillage', '對方一定要接受我的家規']].forEach(function (x) { rows.push({ id: x[0], cells: ['開關', '<label class="arr"><input type="checkbox" data-ed="switch" data-id="' + x[0] + '"' + (ru[x[0]] ? ' checked' : '') + '>' + x[1] + '</label>', st(todayV.rules[x[0]], ru[x[0]])] }); });
    rows.push({ id: 'maxGive', cells: ['每人最多給的預設', '<input type="number" class="kc" data-ed="maxGiveDefault" value="' + (ru.maxGiveDefault == null ? '' : ru.maxGiveDefault) + '" min="0" placeholder="今天剩下的" aria-label="每人最多給的預設"> 點<small>沒設就是今天剩下的點；事件簿上不列</small>', st(todayV.rules.maxGiveDefault, ru.maxGiveDefault)] });
    rows.push({ id: 'village', cells: ['家規', '<textarea data-ed="village" aria-label="家規" placeholder="自由文字，誰寫的誰解釋">' + esc(ru.village) + '</textarea>', st(todayV.rules.village, ru.village)], h: 14 });
    rows.push({ id: 'site', cells: ['家規網站', '<input type="url" class="w" data-ed="site" value="' + esc(ru.site || '') + '" placeholder="https://（選填）" aria-label="家規網站"><small>只收 https:// 開頭的網址；想收留言在自己的網站收</small>', st(todayV.rules.site || '', ru.site || '')] });
    return page('rules', '規則表', back() + '改了明天起生效（今天的照舊）；對接條件是固定格式，系統才判得出通不通', '', kv(rows), '<b>第一次看</b>：家規是給人看的自由文字，誰寫的誰解釋；對接條件是「欄位、比較、數值」，別人通了才能約你。<b>對方要給的東西種類</b>：那一微秒才判，看對方這一筆選給你的；空的不算。', true);
  }
  function togetherPage() {
    var m = me(), t = now(), list = m.slots.filter(function (s) { return s.together; }).sort(function (a, b) { return b.atUs - a.atUs; });
    var rows = list.slice(0, 8).map(function (s) { return { id: s.id, cells: [CORE.dayLabel(CORE.dayNum(s.atUs)).slice(5) + ' ' + hhmm(s.atUs), (s.bookings.length ? s.bookings.map(function (b) { return lk(b) + ' ' + esc(nameOf(b)); }).join('、') : '<span class="dim">還沒人約</span>') + '<small>' + esc(s.judged ? '判過了' : CORE.togetherStatus(S(), s)) + '</small>', !s.judged && s.atUs > t && !s.bookings.length ? btn('delSlot', '刪', ' data-id="' + s.id + '"', 'o') : ''] }; });
    return page('together', '一起成交', back() + '幾個人湊成一圈一起換：開時段的時候勾「一起成交」', '', (rows.length ? kv(rows) : '<div class="empty">還沒開過一起成交的時段。</div>'), '<b>第一次看</b>：一起成交的時段，有選東西的每一對都要兩邊都選了、都給得出、人都到，才全部一起成交；只要有一對不成，整個時段都不成交。開時段在事件簿空白那一行寫時間、勾一起成交。', true);
  }
  function greetPage() {
    var m = me(), t = now(), list = CORE.myGreets(S(), m.serial, t);
    var rows = list.map(function (g) {
      var st = g.status === 'active' ? '<span class="tagp">用著</span>' : '', pd = g.pending ? (g.pending.mine ? '<small class="warn">等 ' + esc(g.otherName) + ' 同意' + (g.status === 'active' ? '改成「' + esc(g.pending.key) + '」' : '') + '</small>' : '<small class="warn">' + esc(g.otherName) + ' 提議' + (g.status === 'active' ? '改成' : '') + '「' + esc(g.pending.key) + '」：我給 ' + esc(g.pending.give.join('、')) + '，我拿 ' + esc(g.pending.get.join('、')) + '</small>') : '';
      var acts = (g.pending && !g.pending.mine ? btn('greetAgree', '同意', ' data-id="' + g.id + '"') + btn('greetReject', '不要', ' data-id="' + g.id + '"', 'o') : '') + (g.status === 'active' ? btn('greetSet', '改', ' data-id="' + g.other + '"', 'o') : '') + btn('greetDel', '刪掉', ' data-id="' + g.id + '"', 'o');
      return { id: g.id, cells: [lk(g.other) + ' ' + esc(g.otherName), (g.status === 'active' ? '密鑰「<b>' + esc(g.key) + '</b>」　我給 ' + esc(g.give.join('、')) + '，我拿 ' + esc(g.get.join('、')) + '　上次 ' + (g.lastDay == null ? '還沒換過' : md(g.lastDay)) : '<span class="dim">還沒成立</span>') + st + pd, acts], h: 12 };
    });
    return page('greet', '打招呼密鑰', back() + '常見面的人：兩個人一起設一組密鑰和平常換什麼，見面時都在上面的框裡輸入，1 分鐘內都輸入了就當場換一次', '', (rows.length ? kv(rows, [20, 60, 20]) : '<div class="empty">還沒有密鑰。到他的資源表那張紙按「跟他設打招呼密鑰」。</div>'), '<b>第一次看</b>：密鑰只對這兩個人有效，第三個人輸入只會說找不到；不能長得像序號。後輸入的那一刻就是那一微秒，照配好的東西判、兩人都算到達；只有一個人輸入，1 分鐘沒等到就取消、什麼都不記。同一對人一天第二次以後照樣記一筆，但不算進對接過幾次。', true);
  }
  function slotsPage() {
    var m = me(), t = now(), list = m.slots.slice().sort(function (a, b) { return b.atUs - a.atUs; });
    var rows = list.slice(0, 12).map(function (s) { return { id: s.id, cells: [CORE.dayLabel(CORE.dayNum(s.atUs)).slice(5) + ' ' + hhmm(s.atUs) + (s.together ? '<span class="cd">一起</span>' : s.standing ? '<span class="cd">每天</span>' : s.greet ? '<span class="cd">密鑰</span>' : ''), s.bookings.length + '／' + s.capacity + (s.bookings.length ? '　' + s.bookings.map(function (b) { return lk(b) + ' ' + esc(nameOf(b)); }).join('、') : '<span class="dim">　還沒人約</span>') + (s.judged ? '<small>判過了</small>' : ''), !s.judged && s.atUs > t && !s.bookings.length ? btn('delSlot', '刪', ' data-id="' + s.id + '"', 'o') : btn('goLog', '去事件簿', ' data-day="' + CORE.dayNum(s.atUs) + '" data-id="' + s.id + '"', 'o')], h: 8 }; });
    return page('slots', '我開的時段', back() + '整理全部時段；開新的在事件簿空白那一行寫時間', '', (rows.length ? kv(rows, [26, 54, 20]) : '<div class="empty">還沒開時段。</div>') + (list.length > 12 ? '<div class="dim">還有 ' + (list.length - 12) + ' 個，在事件簿翻到那天看</div>' : ''), '', true);
  }
  function housePage() {
    var h = CORE.houseOf(me()), v = CORE.viewHouse(S(), me().serial, me().serial, now()), sel = function (ed, table, cur, label) { return '<select data-ed="house" data-id="' + ed + '" aria-label="' + label + '">' + Object.keys(table).map(function (k) { return opt(k, table[k], cur); }).join('') + '</select>'; };
    var rows = [
      { id: 'sign', cells: ['門牌一句話', inp(' data-ed="house" data-id="sign" maxlength="' + CORE.SIGN_MAX + '" aria-label="門牌一句話"', h.sign, CORE.SIGN_MAX + ' 字以內（選填）') + '<small>掛在門上方，跟幾歲幾天寫在一起</small>'] },
      { id: 'visibility', cells: ['整間屋給誰看', sel('visibility', { public: '公開', neighbors: '只給鄰居看' }, h.visibility, '整間屋給誰看') + '<small>只給鄰居看：陌生人只看得到外觀和牌子，日曆上的磚看不出亮暗。這一輪還沒有村子，所以沒有鄰居</small>'] },
      { id: 'defaultVis', cells: ['新的一筆預設', sel('defaultVis', CORE.VIS_LEVELS, h.defaultVis, '新的一筆預設') + '<small>約別人、被約的那一刻照這個；之後點日曆上那一天，每一筆都能改</small>'] },
      { id: 'plot', cells: ['地皮', v.plot.size + '×' + v.plot.size + '、高 ' + v.plot.height + '<small>每活一年四邊各外推一格、高度加 2，最大 32</small>'] },
      { id: 'blocks', cells: ['已經蓋了', v.look.n + ' 塊'] },
      { id: 'cal', cells: ['日曆', v.cal.blocks.length + ' 塊，下一塊往<b>' + CORE.CAL_DIRS[v.cal.dir] + '</b>長<small>改方向在達秒屋外面的「蓋」裡</small>'] },
      { id: 'village', cells: ['我的村子', '<span class="dim">第 6 輪才有</span>'] },
      { id: 'go', cells: ['', btn('myHouse', '去我的達秒屋', '') + ' ' + btn('build', '去我的達秒屋蓋', '', 'o')] }];
    return page('house', '我的達秒屋', back() + '房子、門、日曆往哪邊長，都在達秒屋外面改', '', kv(rows), '', true);
  }
  function villagePage() { return page('village', '鄰居和村子', back() + '第 6 輪才有', '', '<div class="empty">處得好的人可以搬到同一個村子，鄰居看得到彼此「只給鄰居看」的屋和那幾筆。第 6 輪做。</div>', '', true); }
  function rolePage() {
    var r = me(), t = now(), bl = CORE.quitBlockers(S(), r.serial, t);
    var rows = [
      { id: 'serial', cells: ['序號', '<b>' + esc(CORE.abbrev(r.serial)) + '</b> ' + esc(r.name) + '<small>' + esc(r.serial) + '</small>'] },
      { id: 'contact', cells: ['聯絡方式', inp(' data-ed="contact" aria-label="聯絡方式"', r.contact, '電話、LINE、Email，或不填') + '<small>只有預約成功的人看得到</small>'] },
      { id: 'ratio', cells: ['換點比例', esc(CORE.ratio(S(), r.serial).text) + '<small>' + esc(CORE.ratio(S(), r.serial).hint) + '</small>'] },
      { id: 'dock', cells: ['對接過幾次', String(CORE.dockCount(S(), r.serial))] },
      { id: 'quit', cells: ['不玩了', btn('quit', '不玩了' + (bl.length ? '（' + bl.length + ' 筆會作廢）' : ''), ' data-id="' + r.serial + '"', 'o')] },
      { id: 'switch', cells: ['換人（測試用）', '<select data-ed="me" aria-label="我是誰">' + S().roles.map(function (x, i) { return opt(String(i), CORE.abbrev(x.serial) + ' ' + x.name, String(S().me)); }).join('') + '</select>'] },
      { id: 'reset', cells: ['全部還原', btn('resetAll', '全部還原成預設', '', 'o')] }];
    return page('role', '角色設定', back() + '聯絡方式、不玩了', '', kv(rows), '', true);
  }
  var HELP = [
    ['四張紙', '事件簿、資源表、公告欄、更多，跟紙本一模一樣的 A4 橫式。手機轉橫看整張；直放可以左右滑。寫進去的是藍字，簽名是紅字（系統簽）。'],
    ['序號或密鑰框和骰子', '最上面的框輸入序號（例如 J2）按「去」就到那個人的資源表；輸入打招呼密鑰就跟配對的人當場換一次（等對方 1 分鐘）。按骰子骰一個還在玩的人的序號進框裡，按「去」才過去，不喜歡可以再骰。'],
    ['事件簿', '一天一張，一行一次見面：時間、跟誰、我給他、我收到、結果、今天還剩、對方簽名、兌現。還沒到的那一行淡黃：倒數、選他的東西、會到的勾（預設勾著）、取消。在空白那一行的時間格寫時間就開了一個時段。下面一小張是以前收到、還沒兌現的（就是背包）。點日期跳出小日曆翻到那天。'],
    ['資源表', '一行一樣東西：東西、種類（訊息／行為／物質，必選一個）、怎樣算給到了（寫到對方確定收到沒）、價錢、保留幾天、有幾份（小格子，被選走的劃掉）。直接在格子裡打字就是改，明天起算；在空白那一行寫名字就是加；「…」裡可以下架。不能寫錢和違法的東西。'],
    ['公告欄', '上面的框打一個詞，公告和別人的資源表一起找。第一行是自己的公告，寫好按「掛上去」；別人的旁邊「約他」約他下一個時段。下半張是誰的資源表裡有東西，標你通不通他的條件。'],
    ['那一微秒', '成交那一刻整個畫面白光一閃，跳出成交結果：我給他、我收到；那一行變成交、對方簽名變紅字。沒開著的話，下次打開跳出「你不在的時候」。成交結果裡可以勾「以後每天這個時間自動約」，兩邊都勾就成固定約，事件簿每天那一行標「每天」，按「停」結束。'],
    ['更多', '規則表（用途、對接條件、兩個開關、家規和家規網站、每人最多給的預設）、一起成交、打招呼密鑰、我開的時段、我的達秒屋、鄰居和村子（第 6 輪）、角色設定、說明。'],
    ['達秒屋', '每個人一間：自己蓋的房子，上面長著一條日曆，一個月一塊、一天一塊磚，有成交就亮。點門進他的資源表那張紙。在自己的達秒屋外面按「蓋」改房子、搬門、選日曆往哪長。'],
    ['新手教學', '六步：創角色、骰子、約引路人選他的「空的」、那一微秒、兌現、看自己的達秒屋。可以跳過；教學的對接標「教學」，不算進對接過幾次。']
  ];
  function helpPage() { return page('help', '說明', back() + '每個字是什麼意思', '', '<div class="help">' + HELP.map(function (h) { return '<h3>' + esc(h[0]) + '</h3><p>' + esc(h[1]) + '</p>'; }).join('') + '</div>', '', true); }
  // 他的規則：條件（我通不通）、兩個開關、家規和接受、家規網站
  function orulesPage() {
    var r = view(), m = me(), t = now(), ru = ver(r).rules, rows = [];
    ru.uses.forEach(function (u, i) { rows.push({ id: 'u' + i, cells: ['用途', esc(u), ''] }); });
    ru.conditions.forEach(function (c, i) { var pass = CORE.COND_FIELDS[c.field].kinds ? null : CORE.passes(S(), { versions: [{ fromDay: -1e9, rules: { conditions: [c] } }] }, m, t).ok; rows.push({ id: 'c' + i, cells: ['對接條件', esc(CORE.condText(c)), pass == null ? '<span class="tagp off">那一微秒判</span>' : pass ? '<span class="tagp">我通</span>' : '<span class="tagp bad">我不通</span>'] }); });
    if (!ru.conditions.length) rows.push({ id: 'c-none', cells: ['對接條件', '<span class="dim">沒有條件，誰都通</span>', ''] });
    rows.push({ id: 'sw', cells: ['開關', '要求兩方都通：' + (ru.bothMustPass ? '開' : '關') + '；對方一定要接受我的家規：' + (ru.mustAcceptVillage ? '開' : '關'), ''] });
    var acc = ''; if (ru.village) { var a = CORE.acceptState(S(), m.serial, r, t); acc = a === 'current' ? '<span class="tagp">你已接受</span>' : (a === 'old' ? '<small class="warn">你接受的是舊版家規，要重新接受</small>' : '') + btn('accept', '接受他的家規', ' data-id="' + r.serial + '"'); if (CORE.villageChanges(r, t)) acc += '<small>明天起家規改了，到時候要重新接受</small>'; }
    rows.push({ id: 'village', cells: ['家規', ru.village ? esc(ru.village) : '<span class="dim">（沒有）</span>', acc], h: 14 });
    rows.push({ id: 'site', cells: ['家規網站', ru.site ? '<a class="lk" href="' + esc(ru.site) + '" target="_blank" rel="noopener noreferrer">' + esc(ru.site) + '</a>' : '<span class="dim">沒有家規網站：不收留言</span>', ''] });
    return page('orules', '他的規則', btn('visit', '‹ 他的資源表', ' data-id="' + r.serial + '"', 'o') + '　' + esc(r.name) + ' 的規則表（不能改）', '', kv(rows), '<b>家規</b>：誰寫的誰解釋；有家規網站的話從這裡點過去，沒填就是不收留言。', true);
  }

  /* ---------- 成交的一句話（以我為主體）、固定約的勾 ---------- */
  function dockLine(d, m) {
    var other = roleOf(d.a === m ? d.b : d.a), myIn = d.a === m ? d.itemsB : d.itemsA, myOut = d.a === m ? d.itemsA : d.itemsB, gave = d.a === m ? d.gaveA : d.gaveB;
    var on = other ? other.name : '？';
    if (!d.ok) return '和 ' + on + ' 不成立：' + d.reason;
    if (!d.traded) return '和 ' + on + ' 沒成：' + d.reason;
    var nIn = d.a === m ? d.noteB : d.noteA, nOut = d.a === m ? d.noteA : d.noteB;
    return '和 ' + on + '（' + d.how + '）\n我給他：' + CORE.itemsText(myOut) + '（' + gave + ' 點）；我收到：' + on + '的' + CORE.itemsText(myIn) + (nIn ? '\n' + nIn : '') + (nOut ? '\n他' + nOut : '') + (other && other.contact && CORE.contactVisible(S(), other, m) ? '\n聯絡方式：' + other.contact : '') + '\n系統已經替兩邊簽名。';
  }
  function dailyBox(d, m) { var st = CORE.dailyState(S(), m, d.id); if (!st || !st.can) return ''; return '<label class="arr daily"><input type="checkbox" data-daily="' + d.id + '"' + (st.mine ? ' checked' : '') + '>以後每天這個時間自動約' + (st.theirs ? '（對方勾了，你勾了就成立）' : '（兩邊都勾才成立）') + '</label>'; }
  function bindDaily() { $('popBody').querySelectorAll('[data-daily]').forEach(function (b) { b.onchange = function () { var r = run(function () { return CORE.wantDaily(S(), me().serial, b.dataset.daily, b.checked, now()); }, b.checked ? '勾了' : '取消了'); if (r.ok && r.value) msg('固定約成立了：明天起每天這個時間自動約，事件簿那一行標「每天」，按「停」結束'); }; }); }

  /* ---------- 畫 ---------- */
  function render() {
    var m = me(), o = UI.other ? roleOf(UI.other) : null;
    if (UI.other && !o) UI.other = null;
    $('tother').innerHTML = o ? '<b>' + esc(CORE.abbrev(o.serial) + ' ' + o.name) + '</b> 的那張紙 ' + btn('home', '回我自己', '', 'o') : '<span class="small muted">' + (APP.isBlank() ? '還沒創角色' : '我是 <b>' + esc(CORE.abbrev(m.serial) + ' ' + m.name) + '</b>') + '</span>';
    var st = APP.tutActive() && !APP.isBlank() ? APP.steps() : null;
    $('tutbar').hidden = !APP.tutActive();
    if (APP.tutActive()) $('tutbar').innerHTML = '<span class="small">' + esc(APP.isBlank() ? '新手教學 ① 創角色：資源表那張紙已經寫好「空的」，填名字和每天的點，按「建立」' : st.hint) + '</span>' + (APP.tut().step === 6 ? btn('myHouse', '去我的達秒屋', '', 'go') : '') + (APP.isBlank() ? '' : btn('tutSkip', '跳過教學', '', 'o'));
    var cur = o ? null : (MORE.some(function (x) { return x[0] === UI.sheet; }) ? 'more' : UI.sheet);
    $('ttabs').innerHTML = TABS.map(function (t) { return '<button type="button" class="tab' + (cur === t[0] ? ' on' : '') + '" data-act="tab" data-s="' + t[0] + '"' + (cur === t[0] ? ' aria-current="page"' : '') + '>' + esc(t[1]) + '</button>'; }).join('');
    var key = o ? UI.osheet : UI.sheet, scroll = window.scrollY, same = render.last === (o ? o.serial + ':' : '') + key;
    var P = { log: logPage, res: resPage, find: findPage, more: morePage, rules: rulesPage, together: togetherPage, greet: greetPage, slots: slotsPage, house: housePage, village: villagePage, role: rolePage, help: helpPage, orules: orulesPage };
    if (!P[key]) key = o ? 'res' : 'log';
    $('tmain').innerHTML = '<div class="msg" id="tmsg"' + (UI.msg ? '' : ' hidden') + '>' + esc(UI.msg) + '</div>' + P[key]();
    if (!same) window.scrollTo(0, 0); else if (window.scrollY !== scroll) window.scrollTo(0, scroll);
    render.last = (o ? o.serial + ':' : '') + key;
    if (UI.focus) { var tr = document.querySelector('#tmain tr[data-row][data-id="' + CSS.escape(UI.focus) + '"]'); UI.focus = null; if (tr) { tr.scrollIntoView({ block: 'center' }); tr.classList.add('flash'); } }
  }
  function msg(t) { UI.msg = t || ''; var el = $('tmsg'); if (el) { el.textContent = UI.msg; el.hidden = !UI.msg; } }
  // 換頁：四張紙或更多裡的一張
  function tab(sheet, id) {
    UI.other = null; UI.sheet = NAMES[sheet] ? sheet : 'log'; UI.focus = id || null; UI.msg = ''; UI.page = 0;
    if (sheet === 'log' && !id) UI.day = null;
    render();
  }
  // 到他的那張紙（how：從哪裡來的，教學用）
  function visit(serial, sheet, how) {
    var r = roleOf(serial); if (!r) { msg('找不到這個序號'); return false; }
    if (r === me()) { UI.other = null; tab(NAMES[sheet] && sheet !== 'orules' ? sheet : 'res'); return true; }
    UI.other = serial; UI.osheet = sheet === 'orules' || sheet === 'rules' ? 'orules' : 'res'; UI.msg = ''; UI.page = 0;
    if (how === 'serial') APP.tutEvent('go', serial);
    if (serial === APP.GUIDE && (how === 'serial' || how === 'notice')) APP.tutEvent('foundGuide');
    render(); return true;
  }
  function home() { UI.other = null; render(); }

  var pop = KIT.pop, flash = KIT.flash;

  /* ---------- 動作 ---------- */
  function run(fn, ok) { var r = APP.run(fn, ok); msg(r.msg); return r; }
  var val = function (id) { var el = $(id); return el ? el.value : ''; };
  function tmr() { return CORE.tomorrow(S(), me().serial, now()); }
  function createMe(skip) {
    var r = run(function () { APP.createPlayer({ name: val('cName').trim(), dailyPoints: val('cDaily'), firstItem: { name: val('cItem').trim(), def: val('cDef'), price: +val('cPrice') || 0, qty: Math.max(0, Math.floor(+val('cQty') || 0)) } }, skip); }, skip ? '角色建好了。跳過教學' : '角色建好了。教學開始：按最上面的骰子');
    if (r.ok) { UI.sheet = skip ? 'res' : 'log'; UI.other = null; render(); msg(r.msg); }
  }
  // 序號或密鑰：序號就過去；不是序號就當密鑰（找不到就說找不到）
  function goSerial() {
    var code = val('serialIn').trim(); if (!code) { msg('先輸入序號（例如 J2）或密鑰'); return; }
    var r = CORE.findRole(S(), code); if (r) { visit(r.serial, 'res', 'serial'); return; }
    if (APP.isBlank()) { msg('找不到序號 ' + code); return; }
    var k = CORE.enterKey(S(), me().serial, code, now());
    if (!k.found) { msg('找不到序號或密鑰 ' + code); return; }
    APP.changed();
    if (k.waiting) { msg('密鑰「' + code + '」：等對方 1 分鐘內也輸入'); $('serialIn').value = ''; return; }
    $('serialIn').value = ''; UI.day = null; UI.sheet = 'log'; UI.other = null; UI.focus = null; render();
    if (k.results && k.results.length) APP.emit('dock', k.results);
  }
  function dice() {
    var r = CORE.randomRole(S(), APP.isBlank() ? null : me().serial); if (!r) { msg('沒有別人'); return; }
    $('serialIn').value = CORE.abbrev(r.serial); UI.dice = r.serial;
    var b = $('diceBtn'); b.classList.remove('roll'); void b.offsetWidth; b.classList.add('roll');
    APP.tutEvent('dice'); msg('骰到 ' + CORE.abbrev(r.serial) + ' ' + r.name + '，按「去」過去看；不喜歡再骰');
  }
  // 約他下一個時段（公告欄、找人）
  function bookNext(serial) {
    var r = roleOf(serial), t = now(); if (!r) { msg('找不到這個人'); return; }
    var s = r.slots.filter(function (x) { return x.atUs > t && !x.judged && !x.greet && !x.standing && x.bookings.length < x.capacity && x.bookings.indexOf(me().serial) < 0; }).sort(function (a, b) { return a.atUs - b.atUs; })[0];
    if (!s) { msg(r.name + ' 沒有可以約的時段；到他的資源表看'); visit(serial, 'res', 'link'); return; }
    doBook(s.id, true, serial);
  }
  function doBook(slotId, arrive, serial) {
    var x = CORE.slotOf(S(), slotId), r = run(function () { return CORE.book(S(), me().serial, slotId, now(), arrive); }, arrive ? '約好了，會到也勾了。在事件簿那一行選要換他的什麼' : '約好了，還沒勾會到：在事件簿那一行勾');
    if (r.ok) { var e = CORE.entriesOf(S()).find(function (y) { return y.slot === slotId && (y.a === me().serial || y.b === me().serial) && y.status === 'booked'; }); UI.other = null; UI.day = CORE.dayNum(x.slot.atUs); UI.sheet = 'log'; UI.page = 0; UI.focus = e ? e.id : null; render(); msg(r.msg); if (serial === APP.GUIDE) APP.tutEvent('bookedGuide'); }
  }
  function greetSet(other) {
    var o = roleOf(other), m = me(), t = now(); if (!o) return;
    var cur = CORE.myGreets(S(), m.serial, t).find(function (g) { return g.other === other; }), v = CORE.version(o, t), vm = CORE.version(m, t);
    var html = '<div class="small">密鑰 <input type="text" id="gKey" value="' + esc(cur && cur.status === 'active' ? cur.key : '') + '" placeholder="例如：早安（不能像序號）" maxlength="' + CORE.KEY_MAX + '"></div><div class="small">平常我給他：<select id="gGive">' + vm.resources.map(function (y) { return opt(y.id, y.name + '・' + y.price, null); }).join('') + '</select></div><div class="small">平常我拿他的：<select id="gGet">' + v.resources.map(function (y) { return opt(y.id, y.name + '・' + y.price, null); }).join('') + '</select></div><div class="small muted">送出後 ' + esc(o.name) + ' 在事件簿最上面看到提醒，同意才成立；要改也一樣。想只收不給就選空的。</div>';
    pop('跟 ' + o.name + ' 設打招呼密鑰', { html: html }, [{ label: '不要' }, { label: '送出', pri: true, fn: function () { var r = run(function () { CORE.proposeGreet(S(), m.serial, other, { key: val('gKey'), give: [val('gGive')], get: [val('gGet')] }, now()); }, '送出了，等 ' + o.name + ' 同意'); if (!r.ok) pop('設不了', r.msg); } }]);
  }
  var ACT = {
    tab: function (b) { tab(b.dataset.s); },
    open: function (b) { tab(b.dataset.s); },
    visit: function (b) { visit(b.dataset.id, 'res', b.closest('[data-sheet="find"]') ? 'notice' : 'link'); },
    home: home,
    orules: function (b) { visit(b.dataset.id, 'orules', 'link'); if (b.dataset.id === APP.GUIDE) APP.tutEvent('sawGuideRules'); },
    house: function (b) { APP.goHouse(b.dataset.id); },
    build: function () { APP.goHouse(me().serial, true); },
    myHouse: function () { APP.goHouse(me().serial); },
    serialGo: goSerial, dice: dice,
    prevDay: function () { UI.day = dayOf() - 1; UI.page = 0; render(); }, nextDay: function () { UI.day = dayOf() + 1; UI.page = 0; render(); }, today: function () { UI.day = null; UI.page = 0; render(); },
    pickDay: function () { pickDay(0); },
    pagePrev: function () { UI.page = Math.max(0, UI.page - 1); render(); }, pageNext: function () { UI.page++; render(); },
    goLog: function (b) { UI.other = null; UI.sheet = 'log'; UI.day = +b.dataset.day; UI.page = 0; UI.focus = (CORE.entriesOf(S()).find(function (e) { return e.slot === b.dataset.id && (e.a === me().serial || e.b === me().serial); }) || { id: b.dataset.id }).id; render(); },
    pick: function (b) { pickItems(b.dataset.id, b.dataset.other); },
    why: function (b) { pop('為什麼', b.dataset.why); },
    search: function () { UI.kw = val('kwIn').trim(); render(); },
    clearKw: function () { UI.kw = ''; render(); },
    post: function () { var give = [].slice.call(document.querySelectorAll('#tmain [data-give]')).filter(function (x) { return x.checked; }).map(function (x) { return x.dataset.give; }); var u = val('ntUntil'); run(function () { CORE.postNotice(S(), me().serial, { need: val('ntNeed'), kind: val('ntKind'), give: give, cap: val('ntCap') || 3, untilDay: u ? CORE.dayNum(new Date(u + 'T12:00:00').getTime() * 1000) : null }, now()); }, '公告掛上去了'); },
    unpost: function (b) { run(function () { CORE.removeNotice(S(), me().serial, b.dataset.id); }, '撤掉了'); },
    later: function () { msg('接上去：第 6 輪做'); },
    bookNext: function (b) { bookNext(b.dataset.id); },
    book: function (b) { var box = $('arr_' + b.dataset.id); doBook(b.dataset.id, !box || box.checked, UI.other); },
    cancelBook: function (b) { run(function () { CORE.cancelBooking(S(), me().serial, b.dataset.id); }, '取消預約了'); },
    addSlot: function () { run(function () { var tv = val('addSlotTime'); if (!tv) throw new Error('先在時間格寫時間'); var dn = dayOf(), at = CORE.dayStartUs(dn) + (+tv.slice(0, 2) * 3600 + +tv.slice(3, 5) * 60) * 1e6 + Math.floor(Math.random() * 1000); if (at <= now()) throw new Error('這個時間已經過了'); var s = CORE.addSlot(S(), me().serial, at, val('addSlotCap') || 1, null, now(), $('addSlotTogether') && $('addSlotTogether').checked); UI.focus = s.id; }, '開了時段，等人來約'); },
    delSlot: function (b) { run(function () { CORE.deleteSlot(S(), me().serial, b.dataset.id, now()); }, '刪了時段'); },
    stopDaily: function (b) { pop('停固定約', '停了以後不再每天自動約；已經成交的紀錄留著。', [{ label: '停', fn: function () { run(function () { CORE.stopStanding(S(), me().serial, b.dataset.id); }, '固定約停了'); } }, { label: '不要', pri: true }]); },
    redeem: function (b) { var h = S().holds.find(function (x) { return x.id === b.dataset.id; }); if (!h) return; pop('兌現', '跟 ' + nameOf(h.issuer) + ' 換到「' + h.name + '」了嗎？按了對方就會在兌現那格簽名。', [{ label: '還沒' }, { label: '換到了', pri: true, fn: function () { run(function () { CORE.redeem(S(), me().serial, b.dataset.id, now()); }, '換到了'); } }]); },
    quit: function (b) { var bl = CORE.quitBlockers(S(), b.dataset.id, now()); pop('不玩了', '刪掉 ' + me().name + '。' + (bl.length ? '還有 ' + bl.length + ' 筆你的東西沒被換走，會作廢；單機版持有人都在本機，視為同意。' : '沒有人收著你的東西。'), [{ label: '確定不玩了', fn: function () { run(function () { APP.quit(b.dataset.id); }, '角色刪掉了'); } }, { label: '不要', pri: true }]); },
    create: function () { createMe(false); }, createSkip: function () { createMe(true); },
    accept: function (b) { run(function () { CORE.accept(S(), me().serial, b.dataset.id, now()); }, '接受了他的家規'); },
    addUse: function () { run(function () { var t = val('addUse').trim(); if (!t) throw new Error('先寫內容'); tmr().rules.uses.push(t); }, '加了，明天起'); },
    delUse: function (b) { run(function () { tmr().rules.uses.splice(+b.dataset.id, 1); }, '刪了，明天起'); },
    addCond: function () { run(function () { var f = val('addCondField'); var c = CORE.COND_FIELDS[f].kinds ? { field: f, op: '=', value: val('addCondValue') || 'same' } : { field: f, op: val('addCondOp'), value: +val('addCondValue') || 0 }; CORE.cleanRules({ conditions: [c] }); tmr().rules.conditions.push(c); }, '加了，明天起'); },
    delCond: function (b) { run(function () { tmr().rules.conditions.splice(+b.dataset.id, 1); }, '刪了，明天起'); },
    kind: function (b) { run(function () { var x = CORE.resourceOf(ver(me()), b.dataset.id) || CORE.resourceOf(pend(me()) || ver(me()), b.dataset.id); CORE.setResource(S(), me().serial, b.dataset.id, { kind: x && x.kind === b.dataset.k ? '' : b.dataset.k }, now()); }, '改了，明天起算'); },
    stock: function (b) { run(function () { CORE.restock(S(), me().serial, b.dataset.id, +b.dataset.n); }, +b.dataset.n > 0 ? '多一格' : '少一格'); },
    resMore: function (b) { var x = CORE.resourceOf(pend(me()) || ver(me()), b.dataset.id); if (!x) return; pop('「' + x.name + '」', '下架：明天起資源表上沒有這一樣；已經替人留著的照舊。', [{ label: '下架', fn: function () { run(function () { CORE.removeResource(S(), me().serial, b.dataset.id, now()); }, '明天起下架'); } }, { label: '不要', pri: true }]); },
    fullDef: function (b) { var r = roleOf(b.dataset.id), x = r ? (CORE.resourceOf(r === me() ? (pend(r) || ver(r)) : ver(r), b.dataset.res)) : null; if (x) pop(x.name, '怎樣算給到了：' + (x.def || '（沒寫）')); },
    greetSet: function (b) { greetSet(b.dataset.id); },
    greetAgree: function (b) { run(function () { CORE.agreeGreet(S(), me().serial, b.dataset.id); }, '同意了，密鑰成立'); },
    greetReject: function (b) { run(function () { CORE.rejectGreet(S(), me().serial, b.dataset.id); }, '不要'); },
    greetDel: function (b) { pop('刪掉密鑰', '刪了以後兩邊都不能再用這組密鑰。', [{ label: '刪掉', fn: function () { run(function () { CORE.deleteGreet(S(), me().serial, b.dataset.id); }, '刪掉了'); } }, { label: '不要', pri: true }]); },
    resetAll: function () { pop('全部還原成預設', '所有資料都會清掉，從創角色開始。', [{ label: '還原', fn: function () { APP.resetAll(); UI.other = null; UI.sheet = 'res'; UI.msg = ''; UI.day = null; render(); } }, { label: '不要', pri: true }]); },
    tutSkip: function () { APP.tutSkip(); msg('跳過了教學。想只收不給，記得資源表要有 0 點的空物件。'); }
  };
  var EDIT = {
    me: function (id, v) { APP.becomeMe(+v); },
    house: function (id, v) { var f = {}; f[id] = v; CORE.setHouse(S(), me().serial, f); },
    daily: function (id, v) { CORE.setDailyPoints(S(), me().serial, v, now()); },
    contact: function (id, v) { CORE.setContact(S(), me().serial, v); },
    useText: function (id, v) { tmr().rules.uses[+id] = v; },
    condField: function (id, v) { var c = tmr().rules.conditions[+id]; c.field = v; if (CORE.COND_FIELDS[v].kinds) { c.op = '='; c.value = 'same'; } else if (typeof c.value !== 'number') { c.op = '>='; c.value = 1; } },
    condOp: function (id, v) { tmr().rules.conditions[+id].op = v; },
    condValue: function (id, v) { var c = tmr().rules.conditions[+id]; c.value = CORE.COND_FIELDS[c.field].kinds ? v : (+v || 0); },
    switch: function (id, v, el) { tmr().rules[id] = !!el.checked; },
    maxGiveDefault: function (id, v) { tmr().rules.maxGiveDefault = v === '' ? null : Math.floor(+v); CORE.cleanRules(tmr().rules); },
    village: function (id, v) { tmr().rules.village = v; },
    site: function (id, v) { CORE.setSite(S(), me().serial, v, now()); },
    resName: function (id, v) { CORE.setResource(S(), me().serial, id, { name: v }, now()); },
    resDef: function (id, v) { CORE.setResource(S(), me().serial, id, { def: v }, now()); },
    resPrice: function (id, v) { CORE.setResource(S(), me().serial, id, { price: v }, now()); },
    resKeep: function (id, v) { CORE.setResource(S(), me().serial, id, { keepDays: v }, now()); },
    present: function (id, v, el) { CORE.setPresent(S(), me().serial, id, el.checked); }
  };
  var busy = false;
  $('view-table').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || !ACT[b.dataset.act] || busy || b.disabled) return;
    busy = true; try { ACT[b.dataset.act](b); } finally { busy = false; }
  });
  $('view-table').addEventListener('change', function (e) {
    var t = e.target; if (busy) return;
    if (t.dataset && t.dataset.new === 'res') { if (!t.value.trim()) return; busy = true; try { var r = run(function () { var c = CORE.addResource(S(), me().serial, { name: t.value, price: 0, kind: '' }, now()); CORE.restock(S(), me().serial, c.id, 1); UI.focus = me().serial + ':' + c.id; }, '加了一樣（明天起），記得勾種類、寫價錢、寫怎樣算給到了'); render(); if (r.ok) msg(r.msg); } finally { busy = false; } return; }
    if (t.id === 'addSlotTime') { busy = true; try { ACT.addSlot(); } finally { busy = false; } return; }
    if (!t.dataset || !t.dataset.ed || !EDIT[t.dataset.ed]) return;
    busy = true;
    try { var okMsg = t.dataset.ed === 'present' ? (t.checked ? '會到' : '不去了，時間到記成沒來') : (['daily', 'useText', 'condField', 'condOp', 'condValue', 'switch', 'maxGiveDefault', 'village', 'site', 'resName', 'resDef', 'resPrice', 'resKeep'].indexOf(t.dataset.ed) >= 0 ? '改了，明天起算' : ''); try { EDIT[t.dataset.ed](t.dataset.id, t.value, t); APP.changed(); msg(okMsg); } catch (err) { APP.changed(); msg(err.message); return; } if (t.dataset.ed !== 'me') render(); }
    finally { busy = false; }
  });
  $('serialIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') goSerial(); });
  $('tmain').addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'kwIn') { UI.kw = e.target.value.trim(); render(); } });

  /* ---------- 事件 ---------- */
  APP.on('change', function () { if (!busy) render(); else setTimeout(render, 0); });
  APP.on('me', function () { UI.other = null; UI.day = null; render(); });
  // 從達秒屋回來：點門到他的那張紙、或回我自己
  APP.on('view', function (v) {
    if (v.name !== 'table') { $('view-table').hidden = true; return; }
    $('view-table').hidden = false;
    if (v.serial) visit(v.serial, v.sheet || 'res', v.how); else { UI.other = null; if (v.sheet) tab(NAMES[v.sheet] ? v.sheet : 'log'); else render(); }
  });
  APP.on('tut', function (st) { render(); if (st === 'done' && !APP.tut().skipped) msg('教學完成！接下來在資源表寫自己能給的東西、在事件簿開時段，到公告欄找人。'); });
  // 那一微秒：成交那一刻白光一閃、跳出成交結果（可以勾固定約）；沒開著的話，下次打開跳出「你不在的時候」
  APP.on('dock', function (res) {
    var m = me().serial, about = function (x) { return x.docking ? (x.docking.a === m || x.docking.b === m) : x.missed === m; };
    var late = res.filter(function (x) { return x.late && about(x); }), nowRes = res.filter(function (x) { return !x.late && x.docking && about(x); });
    render();
    if (!late.length && !nowRes.length) { if (res.some(function (x) { return !x.late && x.missed === m; })) msg('那一微秒過了，沒確認會到的記為沒來。'); return; }
    var lateText = late.map(function (x) { return '・' + CORE.fmtUs(x.slot.atUs).slice(5, 19) + ' ' + x.owner.name + ' 的時段：' + (x.docking ? dockLine(x.docking, m) : '沒確認會到，沒來'); }).join('\n');
    var nowText = nowRes.map(function (x) { return esc(dockLine(x.docking, m)).replace(/\n/g, '<br>') + (x.docking.traded ? dailyBox(x.docking, m) : ''); }).join('<br><br>');
    if (nowRes.some(function (x) { return x.docking.traded; }) && !$('view-table').hidden) flash();
    pop(late.length && nowRes.length ? '你不在的時候、到達那微秒' : late.length ? '你不在的時候' : '到達那微秒', { html: late.length && nowRes.length ? '【你不在的時候】<br>' + esc(lateText).replace(/\n/g, '<br>') + '<br><br>【剛才】<br>' + nowText : late.length ? esc(lateText).replace(/\n/g, '<br>') : nowText });
    bindDaily();
  });
  // 還有幾秒、現在還能給：每秒更新那幾格的字，不重畫整張紙
  setInterval(function () { document.querySelectorAll('#tmain [data-left]').forEach(function (el) { el.textContent = leftText(+el.dataset.left); }); var et = $('energyText'); if (et && !APP.isBlank()) et.textContent = CORE.remainingToday(S(), me(), now()); }, 1000);
  APP.on('saveFail', function (m) { pop('存不進去', m + '\n手機的空間可能滿了：清掉一些網站資料再試。'); });
  render();
  if (APP.loadIssue()) setTimeout(function () { pop('存檔讀不進來', APP.loadIssue().message); }, 0);
  return { render: render, ui: UI, tab: tab, visit: visit, home: home, NAMES: NAMES, TABS: TABS, MORE: MORE };
})();
var TABLE = SHEETS;
