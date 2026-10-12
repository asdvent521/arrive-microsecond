/* ===== v9 表格世界：四組、十二張表（DESIGN 7-1） =====
 * 下方分頁是四組，組裡的表在上方切換，一張表一頁。最上面一列是序號框和「隨機」。
 * 點名字、點序號或在序號框輸入序號，就到他的表格世界（跟自己「我的」那幾張一樣，只是不能改）。
 * 只呼叫 APP、CORE 和共用的 KIT；要去達秒屋就叫 APP.goHouse，不直接碰達秒屋的程式。
 */
var TABLE = (function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = APP.esc, opt = APP.opt, now = APP.now;
  var S = function () { return APP.state(); }, me = function () { return APP.me(); };
  var roleOf = APP.roleOf, ver = APP.ver, pend = APP.pend;
  var GROUPS = [
    { k: 'today', name: '今天', sheets: ['today'] },
    { k: 'board', name: '公告欄', sheets: ['notices', 'find'] },
    { k: 'book', name: '預約', sheets: ['booked', 'myslots'] },
    { k: 'mine', name: '我的', sheets: ['role', 'rules', 'resources', 'bag', 'calendar', 'house', 'help'] }
  ];
  var NAMES = { today: '今天', notices: '公告', find: '找人', booked: '我預約的', myslots: '我開的時段', role: '角色', rules: '規則表', resources: '資源表', bag: '背包', calendar: '日曆', house: '我的達秒屋', help: '說明', slots: '時段', defs: '定義表' };
  var OTHER = ['role', 'rules', 'resources', 'slots'];   // 他的表格世界
  var SHEETS = [].concat.apply([], GROUPS.map(function (g) { return g.sheets; }));
  var UI = { group: 'today', sheet: 'today', other: null, osheet: 'role', defsOf: null, kw: '', findMode: 'visit', noticeMode: 'all', kind: '', msg: '', month: 0 };
  if (APP.isBlank()) { UI.group = 'mine'; UI.sheet = 'role'; }

  /* ---------- 小工具 ---------- */
  var tag = function (cls, t) { return '<span class="tag ' + cls + '">' + esc(t) + '</span>'; };
  var dash = '<span class="muted">—</span>';
  var small = function (t, cls) { return t ? '<div class="small' + (cls ? ' ' + cls : ' muted') + '">' + esc(t) + '</div>' : ''; };
  function btn(act, label, attrs, cls) { return '<button type="button" class="btn sm' + (cls ? ' ' + cls : '') + '" data-act="' + act + '"' + (attrs || '') + '>' + esc(label) + '</button>'; }
  function who(serial, label) { var r = roleOf(serial); return '<button type="button" class="lk" data-act="visit" data-id="' + esc(serial) + '">' + esc(CORE.abbrev(serial)) + '</button>' + (label === false ? '' : ' ' + esc(r ? r.name : '（不玩了）')); }
  function keepText(x) { return x.keepDays == null ? '一直保留' : '保留 ' + x.keepDays + ' 天'; }
  // 那一微秒寫成四行：日期、時間、微秒、還有幾秒（還有幾秒每秒更新）
  function when(us, extra) {
    var f = CORE.fmtUs(us);
    return '<div class="when"><div>' + f.slice(0, 10) + '</div><div class="num"><b>' + f.slice(11, 19) + '</b></div><div class="num small muted">.' + f.slice(20) + '</div><div class="num small" data-left="' + us + '">' + leftText(us) + '</div>' + (extra || '') + '</div>';
  }
  function leftText(us) { var d = (us - now()) / 1e6; return d > 0 ? '還有 ' + (d >= 3600 ? Math.floor(d / 3600) + ' 小時 ' + Math.floor(d % 3600 / 60) + ' 分' : d >= 60 ? Math.floor(d / 60) + ' 分 ' + Math.floor(d % 60) + ' 秒' : Math.ceil(d) + ' 秒') : '已過'; }
  function view() { return UI.other ? roleOf(UI.other) : me(); }
  function mine() { return !UI.other; }
  // 一張表：head 欄名；rows 每列 { id, cls, cells }；adds 最下面的新增列（可以好幾列）
  function table(key, head, rows, o) {
    o = o || {};
    var h = '<table class="ws" data-sheet="' + key + '"><thead><tr>' + head.map(function (c, i) { return '<th' + (i === 0 ? ' class="fz"' : '') + '>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) { h += '<tr data-row data-id="' + esc(r.id) + '" class="' + (r.cls || '') + '">' + r.cells.map(function (c, i) { return '<td' + (i === 0 ? ' class="fz"' : '') + '>' + (c == null ? '' : c) + '</td>'; }).join('') + '</tr>'; });
    (o.adds || []).forEach(function (a) { h += '<tr class="addrow">' + a.map(function (c, i) { return '<td' + (i === 0 ? ' class="fz"' : '') + '>' + (c == null ? '' : c) + '</td>'; }).join('') + '</tr>'; });
    h += '</tbody></table>';
    h = '<div class="tw">' + h + '</div>';
    if (!rows.length && o.empty) h += '<div class="empty">' + esc(o.empty) + '</div>';
    return h;
  }
  function section(t) { return '<h3 class="sec">' + esc(t) + '</h3>'; }
  function eligTag(e) { return e.self ? tag('off', '自己') : e.ok ? tag('', '通：' + e.how) : tag('bad', '不通：' + e.reason); }
  function resChange(x, p) {
    if (!p) return {};
    var y = CORE.resourceOf(p, x.id); if (!y) return { name: '明天起下架' };
    var out = {};
    if (y.price !== x.price) out.price = '明天起 ' + y.price + ' 點';
    if (y.keepDays !== x.keepDays) out.keep = '明天起' + (y.keepDays == null ? '一直保留' : '保留 ' + y.keepDays + ' 天');
    if (y.name !== x.name) out.name = '明天起改名「' + y.name + '」';
    if ((y.def || '') !== (x.def || '')) out.def = '明天起改了定義';
    return out;
  }
  function energy() {
    var m = me(), left = CORE.remainingToday(S(), m, now()), daily = CORE.dailyPoints(m, now());
    return '<div class="energy-box"><div class="small">今天還能給 <b class="num" id="energyText">' + left + ' / ' + daily + '</b> 點</div><div class="energy"><i id="energyBar" style="width:' + (daily ? left / daily * 100 : 0) + '%"></i></div></div>';
  }

  /* ---------- 選東西：每樣東西兩行，名字和價錢一行，「− 數量 ＋」一行 ---------- */
  function wantsCell(slot, other) {
    var o = roleOf(other); if (!o) return dash;
    var v = CORE.version(o, slot.atUs), picked = CORE.wantsValid(S(), slot, me().serial, other), gone = CORE.goneText(S(), slot, me().serial, other);
    if (slot.judged) return small(gone) + (picked.length ? esc(picked.map(function (id) { var x = CORE.resourceOf(v, id); return x ? x.name : id; }).join('、')) + '（' + CORE.wantTotal(S(), slot, me().serial, other) + ' 點）' : dash);
    return small(gone) + (picked.length ? '' : small('你還沒選他的東西')) + v.resources.map(function (x) {
      var n = picked.filter(function (id) { return id === x.id; }).length, a = ' data-slot="' + slot.id + '" data-other="' + other + '" data-res="' + x.id + '"';
      return '<div class="pick"><div class="pk"><span>' + esc(x.name) + '</span><span class="num">' + x.price + ' 點</span></div><div class="pq">' + btn('wantSub', '−', a + (n ? '' : ' disabled')) + '<b class="num">' + n + '</b>' + btn('wantAdd', '＋', a) + '</div></div>';
    }).join('') + '<div class="small">合計 <b>' + CORE.wantTotal(S(), slot, me().serial, other) + '</b> ' + esc(o.name) + '點</div>';
  }
  function theirsCell(slot, other) {
    var ids = CORE.wantsValid(S(), slot, other, me().serial), v = CORE.version(me(), slot.atUs), gone = CORE.goneText(S(), slot, other, me().serial);
    return (ids.length ? esc(ids.map(function (id) { var x = CORE.resourceOf(v, id); return x ? x.name : id; }).join('、')) + '（' + CORE.wantTotal(S(), slot, other, me().serial) + ' 點）' : '<span class="muted">（還沒選）</span>' + (slot.judged ? '' : small('他還沒選你的東西'))) + small(gone);
  }
  function maxGiveCell(slot) { var v = slot.maxGive[me().serial]; if (slot.judged) return v != null ? String(v) : '當天剩下的'; return '<input type="number" class="mg" data-ed="maxGive" data-id="' + slot.id + '" value="' + (v != null ? v : '') + '" placeholder="剩下的" min="0" aria-label="每人最多給">'; }
  function togetherLine(s) { if (!s.together) return ''; var t = s.judged ? '' : CORE.togetherStatus(S(), s); return '<div>' + tag('wait', '一起成交') + '</div>' + (t ? small(t.indexOf('一起成交：') === 0 ? t.slice(5) : t, t.indexOf('還差') >= 0 ? 'warn' : 'muted') : ''); }

  /* ---------- 十二張表 ---------- */
  var R = {};
  // 今天：下一步和提醒、能量條、今天的預約和倒數、你不在的時候
  R.today = function () {
    if (APP.isBlank()) return '<div class="empty">還沒創角色。到「我的／角色」創一個。' + btn('tab', '去創角色', ' data-g="mine" data-s="role"', 'pri') + '</div>';
    var st = APP.steps(), t = now(), m = me(), h = energy();
    h += section(st.tutorial ? '新手教學' : '下一步和提醒');
    h += table('today', ['步驟', '怎麼做', '動作'], st.rows.map(function (x) {
      var isNext = st.next && st.next.id === x.id;
      var go = x.sheet === 'house' ? btn('myHouse', '去我的達秒屋', '', isNext ? 'pri' : '') : x.who ? btn('visit', '去做', ' data-id="' + x.who + '" data-s="' + x.sheet + '"', isNext ? 'pri' : '') : btn('tab', '去做', ' data-s="' + x.sheet + '"', isNext ? 'pri' : '');
      return { id: x.id, cls: isNext ? 'next' : '', cells: [esc(x.no + ' ' + x.name) + '<div>' + (x.ok ? tag('', '完成') : isNext ? tag('wait', '下一步') : tag('off', '還沒')) + '</div>', '<span class="small">' + esc(x.status) + '</span>', x.ok ? '' : go] };
    }));
    // 今天的預約：我預約的、我開的時段裡今天還沒判的
    var day = CORE.dayNum(t), list = [];
    CORE.myBookings(S(), m, t).forEach(function (b) { if (CORE.dayNum(b.slot.atUs) === day) list.push({ slot: b.slot, other: b.owner.serial, kind: 'booked' }); });
    m.slots.forEach(function (s) { if (!s.judged && s.bookings.length && CORE.dayNum(s.atUs) === day) list.push({ slot: s, other: null, kind: 'myslots' }); });
    list.sort(function (a, b) { return a.slot.atUs - b.slot.atUs; });
    h += section('今天的預約');
    h += table('todayBook', ['跟誰', '那一微秒', '到達', '動作'], list.map(function (x) {
      var conf = x.kind === 'booked' ? (CORE.isPresent(S(), m.serial, x.slot.id) ? tag('', '已確認') : tag('bad', '還沒確認')) : tag('', '主人');
      return { id: x.slot.id, cells: [x.other ? who(x.other) : esc(x.slot.bookings.map(function (b) { var r = roleOf(b); return r ? r.name : b; }).join('、')) + small('來找我'), when(x.slot.atUs, togetherLine(x.slot)), conf, btn('tab', '去看', ' data-s="' + x.kind + '" data-id="' + x.slot.id + '"')] };
    }), { empty: '今天沒有預約。' });
    var aw = APP.away();
    if (aw.length) { h += section('你不在的時候'); h += table('away', ['時段', '結果'], aw.map(function (x, i) { return { id: 'aw' + i, cells: [CORE.fmtUs(x.slot.atUs).slice(5, 19) + '<div>' + who(x.owner.serial) + '</div>', '<span class="small">' + esc(x.docking ? dockLine(x.docking, m.serial) : '沒確認到達，錯過了') + '</span>'] }; })); }
    return h;
  };
  // 公告：全部的公告（可以篩種類）、我的公告；掛公告、撤掉；每一列寫序號、標通不通
  R.notices = function () {
    var t = now(), m = me(), res = CORE.search(S(), m.serial, UI.kw, t);
    var kinds = []; (S().notices || []).forEach(function (n) { if (n.kind && kinds.indexOf(n.kind) < 0) kinds.push(n.kind); });
    var list = res.notices.filter(function (x) { return (UI.noticeMode !== 'mine' || x.notice.owner === m.serial) && (!UI.kind || x.notice.kind === UI.kind); });
    var h = searchBox() + '<div class="ctl">' + btn('noticeMode', '全部的公告', ' data-v="all"', UI.noticeMode === 'all' ? 'on' : '') + btn('noticeMode', '我的公告', ' data-v="mine"', UI.noticeMode === 'mine' ? 'on' : '') + ' <label class="small">種類 <select data-ed="kind" aria-label="種類">' + opt('', '全部', UI.kind) + kinds.map(function (k) { return opt(k, k, UI.kind); }).join('') + '</select></label></div>';
    var v = ver(m), p = pend(m), myRes = v.resources.concat(p ? p.resources.filter(function (y) { return !CORE.resourceOf(v, y.id); }) : []);
    var adds = APP.isBlank() ? [] : [[
      '<b>掛公告</b>',
      '<input type="text" id="ntNeed" placeholder="我需要什麼（一句話）" aria-label="需要"><input type="text" id="ntKind" class="kd" placeholder="種類（選填）" aria-label="種類">',
      myRes.length ? myRes.map(function (x) { return '<label class="chk"><input type="checkbox" data-give="' + x.id + '"> ' + esc(x.name) + '</label>'; }).join('') : small('資源表是空的'),
      '<label class="small">最多 <input type="number" class="kc" id="ntCap" value="3" min="2" aria-label="一圈最多幾人"> 人</label><label class="small">掛到 <input type="date" id="ntUntil" value="' + CORE.dayLabel(CORE.dayNum(t) + 7) + '" aria-label="掛到哪一天"></label>',
      '', btn('post', '掛上去', '', 'pri')]];
    h += table('notices', ['序號', '需要', '可以給', '上限・期限', '通不通', '動作'], list.map(function (x) {
      var n = x.notice;
      return { id: n.id, cls: n.owner === m.serial ? 'mine' : '', cells: [who(n.owner), esc(n.need) + (n.kind ? '<div>' + tag('off', n.kind) + '</div>' : ''), esc(x.give.join('、') || '—'), '最多 ' + n.cap + ' 人' + small(n.untilDay == null ? '沒有期限' : '掛到 ' + CORE.dayLabel(n.untilDay)), eligTag(x.elig), n.owner === m.serial ? btn('unpost', '撤掉', ' data-id="' + n.id + '"', 'warn') : btn('visit', '看他的時段', ' data-id="' + n.owner + '" data-s="slots"')] };
    }), { adds: adds, empty: UI.kw ? '沒有公告提到「' + UI.kw + '」。' : '沒有公告。' });
    if (UI.kw && res.resources.length) h += '<div class="empty">別人資源表裡有「' + esc(UI.kw) + '」的有 ' + res.resources.length + ' 筆，' + btn('tab', '到找人看', ' data-s="find"') + '</div>';
    return h;
  };
  function searchBox() { return '<div class="ctl"><input type="search" id="kwIn" value="' + esc(UI.kw) + '" placeholder="打一個詞：公告和資源表一起查" aria-label="搜尋">' + btn('search', '查', '', 'pri') + (UI.kw ? btn('clearKw', '清掉') : '') + '</div>'; }
  // 找人：我可以去找、可能來找我、全部；打一個詞就是查資源（公告裡提到的、別人資源表裡有的一起列出來）
  R.find = function () {
    var t = now(), m = me();
    var h = searchBox() + '<div class="ctl">' + [['visit', '我可以去找'], ['come', '可能來找我'], ['all', '全部']].map(function (x) { return btn('findMode', x[1], ' data-v="' + x[0] + '"', UI.findMode === x[0] ? 'on' : ''); }).join('') + '</div>';
    if (UI.kw) {
      var r = CORE.search(S(), m.serial, UI.kw, t), rows = [];
      r.notices.forEach(function (x) { rows.push({ id: x.notice.id, cells: [tag('wait', '公告'), who(x.notice.owner), '需要：' + esc(x.notice.need) + small('可以給：' + (x.give.join('、') || '—')), '最多 ' + x.notice.cap + ' 人', eligTag(x.elig), btn('visit', '看他', ' data-id="' + x.notice.owner + '" data-s="slots"')] }); });
      r.resources.forEach(function (x) { rows.push({ id: x.role.serial + ':' + x.resource.id, cells: [tag('', '資源'), who(x.role.serial), esc(x.resource.name) + small(x.resource.price + ' 點，' + keepText(x.resource)), '可換 ' + x.stock.avail, eligTag(x.elig), btn('visit', '看他', ' data-id="' + x.role.serial + '" data-s="resources"')] }); });
      return h + table('find', ['哪裡', '序號', '內容', '數量', '通不通', '動作'], rows, { empty: '公告和資源表都沒有「' + UI.kw + '」。' });
    }
    var people = UI.findMode === 'visit' ? CORE.canVisit(S(), m, t) : UI.findMode === 'come' ? CORE.canCome(S(), m, t) : S().roles.filter(function (r) { return r.serial !== m.serial; });
    return h + table('find', ['序號', '每天的點', '可換的貨', '最近時段', '通不通', '動作'], people.map(function (r) {
      var s = CORE.nextSlot(r, t);
      return { id: r.serial, cells: [who(r.serial), CORE.dailyPoints(r, t) + small('對接過 ' + CORE.dockCount(S(), r.serial) + ' 次'), String(CORE.availTotal(r, t)), s ? CORE.fmtUs(s.atUs).slice(5, 16) + small(s.bookings.length + '／' + s.capacity) : dash, eligTag(CORE.canBook(S(), r, m, t)), btn('visit', '看他的時段', ' data-id="' + r.serial + '" data-s="slots"')] };
    }), { empty: UI.findMode === 'visit' ? '目前沒有我符合條件的人。' : UI.findMode === 'come' ? '目前沒有人符合我的條件。' : '沒有別人。' });
  };
  // 我預約的：一筆一列
  R.booked = function () {
    var m = me(), list = [];
    S().roles.forEach(function (r) { if (r === m) return; r.slots.forEach(function (s) { if (s.bookings.indexOf(m.serial) >= 0) list.push({ owner: r, slot: s }); }); });
    list.sort(function (a, b) { return (a.slot.judged - b.slot.judged) || a.slot.atUs - b.slot.atUs; });
    return table('booked', ['主人', '那一微秒', '到達', '我要的', '最多給', '他要我的', '動作'], list.map(function (x) {
      var s = x.slot, ps = CORE.participants(S(), s).filter(function (p) { return p !== m.serial; });
      var st = s.docked.indexOf(m.serial) >= 0 ? tag('', '已對接') : CORE.missed(s, m.serial) ? tag('bad', '錯過') : s.judged ? tag('off', '判過了') : '';
      var multi = ps.length > 1;
      return { id: s.id, cells: [
        who(x.owner.serial) + (CORE.contactVisible(S(), x.owner, m.serial) && x.owner.contact ? small('聯絡：' + x.owner.contact) : ''),
        when(s.atUs, (st ? '<div>' + st + '</div>' : '') + togetherLine(s)),
        s.judged ? '' : '<label class="chk"><input type="checkbox" data-ed="present" data-id="' + s.id + '"' + (CORE.isPresent(S(), m.serial, s.id) ? ' checked' : '') + ' aria-label="到達"> 到達</label>',
        ps.map(function (p) { return (multi ? '<div class="small"><b>' + esc(roleOf(p) ? roleOf(p).name : p) + '</b></div>' : '') + wantsCell(s, p); }).join('<hr>'),
        maxGiveCell(s),
        ps.map(function (p) { return (multi ? '<b class="small">' + esc(roleOf(p) ? roleOf(p).name : p) + '</b>：' : '') + theirsCell(s, p); }).join('<br>'),
        s.judged ? '' : btn('cancelBook', '取消預約', ' data-id="' + s.id + '"')] };
    }), { empty: '還沒預約。到「公告欄／找人」找一個人，在他的「時段」約他。' });
  };
  // 我開的時段：開時段、一起成交、刪沒人預約的
  R.myslots = function () {
    var m = me(), t = now();
    return table('myslots', ['那一微秒', '名額', '最多給', '預約的人', '我要他的', '他要我的', '動作'], m.slots.slice().sort(function (a, b) { return a.atUs - b.atUs; }).map(function (s) {
      return { id: s.id, cells: [
        when(s.atUs, togetherLine(s)),
        s.bookings.length + '／' + s.capacity,
        maxGiveCell(s),
        s.bookings.length ? s.bookings.map(function (b) { return who(b) + (s.docked.indexOf(b) >= 0 ? ' ' + tag('', '已對接') : CORE.missed(s, b) ? ' ' + tag('bad', '錯過') : ''); }).join('<br>') : '<span class="muted">還沒人預約</span>',
        s.bookings.length ? s.bookings.map(function (b) { return (s.bookings.length > 1 ? '<div class="small"><b>' + esc(roleOf(b) ? roleOf(b).name : b) + '</b></div>' : '') + wantsCell(s, b); }).join('<hr>') : dash,
        s.bookings.length ? s.bookings.map(function (b) { return (s.bookings.length > 1 ? '<b class="small">' + esc(roleOf(b) ? roleOf(b).name : b) + '</b>：' : '') + theirsCell(s, b); }).join('<br>') : dash,
        s.atUs > t && !s.judged && !s.bookings.length ? btn('delSlot', '刪', ' data-id="' + s.id + '"') : ''] };
    }), { adds: APP.isBlank() ? [] : [['<input type="number" class="kc" id="addSlotMin" value="3" min="1" aria-label="幾分鐘後"> 分鐘後<br><label class="chk"><input type="checkbox" id="addSlotTogether"> 一起成交</label>', '<input type="number" class="kc" id="addSlotCap" value="1" min="1" aria-label="名額">', '<input type="number" class="kc" id="addSlotMax" value="" placeholder="剩下的" aria-label="每人最多給">', '', '', '', btn('addSlot', '開時段', '', 'pri')]], empty: '還沒開時段。' });
  };
  // 角色：自己的（每天的點、聯絡方式、換點比例、對接過幾次、不玩了、測試用的換人）；他的（每天的點、換點比例、對接過幾次）
  R.role = function () {
    var t = now();
    if (mine() && APP.isBlank()) {
      return '<div class="empty">還沒創角色。一個人只有一個角色；創角色當下就生效。</div>' + table('role', ['項目', '內容'], [
        { id: 'name', cells: ['名字', '<input type="text" id="cName" value="我" aria-label="名字">'] },
        { id: 'daily', cells: ['每天的點', '<input type="number" class="kc" id="cDaily" value="' + CORE.DEFAULT_DAILY + '" min="1" aria-label="每天的點">'] },
        { id: 'item', cells: ['第一樣東西', '<input type="text" id="cItem" value="空的" class="kd" aria-label="第一樣東西"> <input type="number" class="kc" id="cPrice" value="0" min="0" aria-label="價格"> 點，補 <input type="number" class="kc" id="cQty" value="1" min="0" aria-label="補幾份"> 份' + small('0 點的「空的」什麼都不給：一換一時想只收不給就拿它')] },
        { id: 'go', cells: ['', btn('create', '建立', '', 'pri') + ' ' + btn('createSkip', '建立，跳過教學')] }]);
    }
    var r = view(), v = ver(r), p = pend(r), m = me();
    var rows = [
      { id: 'serial', cells: ['序號', '<b>' + esc(CORE.abbrev(r.serial)) + '</b> ' + esc(r.name) + small(r.serial)] },
      { id: 'daily', cells: ['每天的點', v.dailyPoints + (p && p.dailyPoints !== v.dailyPoints ? small('明天起 ' + p.dailyPoints) : '') + (mine() ? '<div class="small">明天起 <input type="number" class="kc" data-ed="daily" value="' + (p ? p.dailyPoints : v.dailyPoints) + '" min="1" aria-label="明天起每天的點"></div>' : '')] },
      { id: 'left', cells: ['今天還能給', String(CORE.remainingToday(S(), r, t))] },
      { id: 'ratio', cells: ['換點比例（給出：收到）', esc(CORE.ratio(S(), r.serial).text)] },
      { id: 'dock', cells: ['對接過幾次', String(CORE.dockCount(S(), r.serial))] },
      { id: 'avail', cells: ['可換的貨', String(CORE.availTotal(r, t)) + ' 份'] },
      { id: 'contact', cells: ['聯絡方式', mine() ? '<input type="text" data-ed="contact" value="' + esc(r.contact) + '" placeholder="電話、LINE、Email，或不填" aria-label="聯絡方式">' + small('只有預約成功的人看得到') : CORE.contactVisible(S(), r, m.serial) ? (r.contact ? esc(r.contact) : '<span class="muted">（沒填）</span>') : '<span class="muted">預約成功才看得到</span>'] }
    ];
    if (mine()) {
      var bl = CORE.quitBlockers(S(), r.serial, t);
      rows.push({ id: 'quit', cells: ['不玩了', btn('quit', '不玩了' + (bl.length ? '（' + bl.length + ' 筆會作廢）' : ''), ' data-id="' + r.serial + '"', 'warn')] });
      rows.push({ id: 'switch', cells: ['換人（測試用）', '<select data-ed="me" aria-label="我是誰">' + S().roles.map(function (x, i) { return opt(String(i), CORE.abbrev(x.serial) + ' ' + x.name, String(S().me)); }).join('') + '</select>'] });
    }
    return table('role', ['項目', '內容'], rows);
  };
  // 規則表：用途、對接條件、兩個開關、家規和家規網站
  R.rules = function () {
    var r = view(), m = me(), t = now(), today = ver(r), ed = mine() ? (pend(r) || today) : today, p = pend(r), ru = ed.rules, rows = [];
    var stTag = function (a, b) { return mine() ? (JSON.stringify(a) === JSON.stringify(b) ? tag('', '今天') : tag('wait', '明天起')) : ''; };
    var condSel = function (i, c) { return '<select data-ed="condField" data-id="' + i + '" aria-label="欄位">' + Object.keys(CORE.COND_FIELDS).map(function (k) { return opt(k, CORE.COND_FIELDS[k].label, c.field); }).join('') + '</select> <select data-ed="condOp" data-id="' + i + '" aria-label="比較">' + Object.keys(CORE.OPS).map(function (o) { return opt(o, CORE.OPS[o], c.op); }).join('') + '</select> <input type="number" class="kc" data-ed="condValue" data-id="' + i + '" value="' + c.value + '" aria-label="數值">'; };
    ru.uses.forEach(function (u, i) { rows.push({ id: 'u' + i, cells: ['用途', mine() ? '<input type="text" class="wide" data-ed="useText" data-id="' + i + '" value="' + esc(u) + '" aria-label="用途">' : esc(u), stTag(today.rules.uses[i], u), mine() ? btn('delUse', '刪', ' data-id="' + i + '"') : ''] }); });
    ru.conditions.forEach(function (c, i) {
      var pass = mine() ? null : CORE.passes(S(), { versions: [{ fromDay: -1e9, rules: { conditions: [c] } }] }, m, t).ok;
      rows.push({ id: 'c' + i, cells: ['對接條件', (mine() ? condSel(i, c) : '') + '<div class="small">' + esc(CORE.condText(c)) + '</div>', mine() ? stTag(today.rules.conditions[i], c) : (pass ? tag('', '我通') : tag('bad', '我不通')), mine() ? btn('delCond', '刪', ' data-id="' + i + '"') : ''] });
    });
    if (!ru.conditions.length) rows.push({ id: 'c-none', cells: ['對接條件', '<span class="muted">沒有條件，誰都通</span>', '', ''] });
    [['bothMustPass', '要求兩方都通'], ['mustAcceptVillage', '對方一定要接受我的家規']].forEach(function (x) {
      rows.push({ id: x[0], cells: ['開關', mine() ? '<label class="chk"><input type="checkbox" data-ed="switch" data-id="' + x[0] + '"' + (ru[x[0]] ? ' checked' : '') + '> ' + x[1] + '</label>' : esc(x[1]) + '：' + (ru[x[0]] ? tag('wait', '開') : tag('off', '關')), stTag(today.rules[x[0]], ru[x[0]]), ''] });
    });
    var acc = '';
    if (!mine() && ru.village) { var a = CORE.acceptState(S(), m.serial, r, t); acc = a === 'current' ? tag('', '你已接受') : (a === 'old' ? small('你接受的是舊版家規，要重新接受', 'warn') : '') + btn('accept', '接受他的家規', ' data-id="' + r.serial + '"', 'pri'); if (CORE.villageChanges(r, t)) acc += small('明天起家規改了，到時候要重新接受'); }
    rows.push({ id: 'village', cells: ['家規', mine() ? '<textarea data-ed="village" aria-label="家規" placeholder="自由文字，誰寫的誰解釋">' + esc(ru.village) + '</textarea>' : (ru.village ? esc(ru.village) : dash), mine() ? stTag(today.rules.village, ru.village) : '', acc] });
    var site = ru.site || '';
    rows.push({ id: 'site', cells: ['家規網站', mine() ? '<input type="url" class="wide" data-ed="site" value="' + esc(site) + '" placeholder="https://（選填）" aria-label="家規網站">' + small('只收 https:// 開頭的網址；想收留言在自己的網站收') : (site ? '<a class="lk" href="' + esc(site) + '" target="_blank" rel="noopener noreferrer">' + esc(site) + '</a>' : '<span class="muted">沒有家規網站：不收留言</span>'), mine() ? stTag(today.rules.site || '', site) : '', ''] });
    var adds = mine() ? [
      ['加用途', '<input type="text" class="wide" id="addUse" placeholder="例如：1 我點 = 陪跑 1 分鐘" aria-label="新的用途">', small('明天起'), btn('addUse', '加一條', '', 'pri')],
      ['加條件', condSel('new', { field: 'avail', op: '>=', value: 1 }).replace(/data-ed="cond(\w+)" data-id="new"/g, 'id="addCond$1"'), small('明天起'), btn('addCond', '加一條', '', 'pri')]] : [];
    var h = table('rules', ['項目', '內容', mine() ? '狀態' : '我通不通', '動作'], rows, { adds: adds });
    var ch = pendingChanges(r); if (ch.length) h += '<div class="empty">' + (mine() ? '明天起（今天的照舊）：' : esc(r.name) + ' 明天起會改（今天就公開）：') + esc(ch.join('；')) + '</div>';
    return h;
  };
  function pendingChanges(r) {
    var v = ver(r), p = pend(r), out = []; if (!p) return out;
    if (p.dailyPoints !== v.dailyPoints) out.push('每天的點：' + v.dailyPoints + ' → ' + p.dailyPoints);
    var diffList = function (label, a, b, fmt) { var A = a.map(fmt), B = b.map(fmt); B.filter(function (x) { return A.indexOf(x) < 0; }).forEach(function (x) { out.push(label + '加：' + x); }); A.filter(function (x) { return B.indexOf(x) < 0; }).forEach(function (x) { out.push(label + '刪：' + x); }); };
    diffList('用途', v.rules.uses, p.rules.uses, String);
    diffList('對接條件', v.rules.conditions, p.rules.conditions, CORE.condText);
    if (p.rules.bothMustPass !== v.rules.bothMustPass) out.push('要求兩方都通：' + (p.rules.bothMustPass ? '開' : '關'));
    if (p.rules.mustAcceptVillage !== v.rules.mustAcceptVillage) out.push('對方一定要接受我的家規：' + (p.rules.mustAcceptVillage ? '開' : '關'));
    if (p.rules.village !== v.rules.village) out.push('家規改為：' + (p.rules.village || '（沒有）'));
    if ((p.rules.site || '') !== (v.rules.site || '')) out.push('家規網站改為：' + (p.rules.site || '（沒有）'));
    return out;
  }
  // 資源表：「明天起」寫在它改的那一格下面一行；定義從「看定義」連到定義表
  R.resources = function () {
    var r = view(), today = ver(r), p = pend(r), list;
    if (mine()) {
      list = (p || today).resources;
      return table('resources', ['資源', '價格', '保留', '可換', '已保留', '定義', '動作'], list.map(function (x) {
        var t0 = CORE.resourceOf(today, x.id), st = CORE.stockOf(r, x.id);
        var note = function (field) { if (!t0) return field === 'name' ? small('明天起新增', 'warn') : ''; var a = t0[field], b = x[field]; return JSON.stringify(a) === JSON.stringify(b) ? '' : small('明天起' + (field === 'price' ? ' ' + b + ' 點（今天 ' + a + '）' : field === 'keepDays' ? (b == null ? '一直保留' : '保留 ' + b + ' 天') + '（今天' + (a == null ? '一直' : ' ' + a + ' 天') + '）' : '改名（今天「' + a + '」）'), 'warn'); };
        return { id: r.serial + ':' + x.id, cells: [
          '<input type="text" class="nm" data-ed="resName" data-id="' + x.id + '" value="' + esc(x.name) + '" aria-label="資源名稱">' + note('name'),
          '<input type="number" class="kc" data-ed="resPrice" data-id="' + x.id + '" value="' + x.price + '" min="0" aria-label="價格">' + note('price'),
          '<input type="number" class="kc" data-ed="resKeep" data-id="' + x.id + '" value="' + (x.keepDays == null ? '' : x.keepDays) + '" placeholder="一直" aria-label="保留天數">' + note('keepDays'),
          '<b class="num">' + st.avail + '</b><div class="stk"><input type="number" class="kc" id="stockN_' + x.id + '" value="1" min="1" aria-label="數量">' + btn('stock', '補', ' data-id="' + x.id + '" data-n="1"') + btn('stock', '減', ' data-id="' + x.id + '" data-n="-1"') + '</div>',
          String(st.reserved),
          btn('defs', '看定義', ' data-id="' + r.serial + '" data-res="' + x.id + '"', 'lkb') + ((x.def || '') !== ((t0 && t0.def) || '') && t0 ? small('明天起改了', 'warn') : ''),
          btn('delRes', '下架', ' data-id="' + x.id + '"')] };
      }), { adds: [['<input type="text" class="nm" id="addResName" placeholder="新東西" aria-label="新東西的名稱">', '<input type="number" class="kc" id="addResPrice" value="60" min="0" aria-label="價格">', '<input type="number" class="kc" id="addResKeep" value="" placeholder="一直" aria-label="保留天數">', '', '', '<input type="text" class="nm" id="addResDef" placeholder="定義（選填）" aria-label="定義">', btn('addRes', '上架', '', 'pri')]], empty: '沒有資源。' }) + '<div class="empty">名稱、價格、保留天數、定義改了明天起生效；可換的數量馬上生效。</div>';
    }
    list = today.resources.slice(); if (p) p.resources.forEach(function (y) { if (!CORE.resourceOf(today, y.id)) list.push(Object.assign({ _new: true }, y)); });
    return table('resources', ['資源', '價格', '可換', '保留', '定義'], list.map(function (x) {
      var ch = x._new ? {} : resChange(x, p);
      return { id: r.serial + ':' + x.id, cells: [esc(x.name) + (x._new ? small('明天起新增', 'warn') : small(ch.name, 'warn')), x.price + ' 點' + small(ch.price, 'warn'), x._new ? dash : String(CORE.stockOf(r, x.id).avail), esc(keepText(x)) + small(ch.keep, 'warn'), btn('defs', '看定義', ' data-id="' + r.serial + '" data-res="' + x.id + '"', 'lkb') + small(ch.def, 'warn')] };
    }), { empty: '沒有資源。' });
  };
  // 定義表：那個人每樣東西的完整定義（自己的可以改，明天起生效）
  R.defs = function () {
    var r = roleOf(UI.defsOf) || me(), own = r === me(), today = ver(r), list = own ? (pend(r) || today).resources : today.resources;
    return '<div class="ctl">' + btn('backDefs', '← 回資源表') + ' <b>' + esc(CORE.abbrev(r.serial) + ' ' + r.name) + '</b> 的定義表</div>' + table('defs', ['資源', '定義'], list.map(function (x) {
      var t0 = CORE.resourceOf(today, x.id);
      return { id: 'd:' + x.id, cells: [esc(x.name), own ? '<textarea data-ed="resDef" data-id="' + x.id + '" aria-label="定義">' + esc(x.def || '') + '</textarea>' + ((x.def || '') !== ((t0 && t0.def) || '') ? small('明天起生效', 'warn') : '') : (x.def ? esc(x.def) : '<span class="muted">（沒寫）</span>')] };
    }), { empty: '沒有資源。' });
  };
  // 他的時段：在這裡約他（到達的勾預設勾著）
  R.slots = function () {
    var r = view(), m = me(), t = now(), e = CORE.canBook(S(), r, m, t);
    var up = r.slots.filter(function (s) { return s.atUs > t && !s.judged; }).sort(function (a, b) { return a.atUs - b.atUs; });
    return '<div class="ctl small">' + eligTag(e) + '</div>' + table('slots', ['那一微秒', '名額', '動作'], up.map(function (s) {
      var booked = s.bookings.indexOf(m.serial) >= 0, full = s.bookings.length >= s.capacity;
      var act = booked ? tag('', '你預約了') + ' ' + btn('tab', '去選東西', ' data-s="booked" data-id="' + s.id + '"') : full ? tag('off', '滿了') : !e.ok ? tag('bad', '條件不通') : '<label class="chk"><input type="checkbox" id="arr_' + s.id + '" checked aria-label="到達"> 到達</label> ' + btn('book', '約他', ' data-id="' + s.id + '"', 'pri');
      return { id: s.id, cells: [when(s.atUs, togetherLine(s)), s.bookings.length + '／' + s.capacity, act] };
    }), { empty: '他沒有開放的時段。' });
  };
  // 背包：點數帳（只有自己看得到），每一筆旁邊直接兌現
  R.bag = function () {
    var m = me(), t = now();
    return energy() + table('bag', ['誰的點', '東西', '多少點', '保留', '動作'], CORE.holdings(S(), m.serial, t).map(function (g) {
      var d = S().dockings.find(function (x) { return x.id === g.hold.docking; });
      return { id: g.hold.id, cells: [who(g.hold.issuer), esc(g.hold.name) + (d ? small(CORE.fmtUs(d.atUs).slice(5, 16) + ' 對接' + (d.tutorial ? '（教學）' : '')) : ''), String(g.hold.price), esc(g.untilText), btn('redeem', '兌現', ' data-id="' + g.hold.id + '"', 'pri')] };
    }), { empty: '手上沒有別人的點。' });
  };
  // 日曆：一格一天，一個月一張、可以換月；點一格跳出那天的明細（在明細裡改自己那幾筆的藏）
  R.calendar = function () { return KIT.calendar(me().serial, me().serial, UI.month); };
  // 我的達秒屋：門牌一句話、整間屋給誰看、新的一筆預設、地皮大小、蓋了幾塊、去我的達秒屋蓋（門以外的房子在達秒屋外面自己蓋）
  R.house = function () {
    var h = CORE.houseOf(me()), v = CORE.viewHouse(S(), me().serial, me().serial, APP.now()), sel = function (ed, table, cur, label) { return '<select data-ed="house" data-id="' + ed + '" aria-label="' + label + '">' + Object.keys(table).map(function (k) { return opt(k, table[k], cur); }).join('') + '</select>'; };
    return table('house', ['項目', '內容'], [
      { id: 'sign', cells: ['門牌一句話', '<input type="text" data-ed="house" data-id="sign" value="' + esc(h.sign) + '" maxlength="' + CORE.SIGN_MAX + '" placeholder="' + CORE.SIGN_MAX + ' 字以內（選填）" aria-label="門牌一句話">' + small('掛在大門上，跟幾歲幾天寫在一起')] },
      { id: 'visibility', cells: ['整間屋給誰看', sel('visibility', { public: '公開', neighbors: '只給鄰居看' }, h.visibility, '整間屋給誰看') + small('只給鄰居看：陌生人只看得到外觀（自己蓋的部分）和牌子，門牆的磚看不出亮暗、點不開。這一輪還沒有村子，所以沒有鄰居')] },
      { id: 'defaultVis', cells: ['新的一筆預設', sel('defaultVis', CORE.VIS_LEVELS, h.defaultVis, '新的一筆預設') + small('約別人、被約的那一刻照這個；之後在日曆的明細裡每一筆都能改')] },
      { id: 'plot', cells: ['地皮', '<span class="num">' + v.plot.size + '×' + v.plot.size + '、高 ' + v.plot.height + '</span>' + small('一開始 12×12、高 12；每活一年四邊各外推一格、高度加 2，最大 32×32、高 32。大門那一排不能蓋')] },
      { id: 'blocks', cells: ['已經蓋了', '<span class="num">' + v.look.n + '</span> 塊' + small('不限幾塊，只限地皮')] },
      { id: 'go', cells: ['', btn('myHouse', '去我的達秒屋', '', '') + ' ' + btn('build', '去我的達秒屋蓋', '', 'pri')] }]);
  };
  var HELP = [
    ['表格世界', '下方分頁是四組：今天、公告欄、預約、我的；組裡的表在上方切換。手機轉橫，每張表都放得下；直放時左右滑。'],
    ['序號框和隨機', '最上面一列輸入序號（例如 J2，或 11 位數），按「去」就到那個人的表格世界；按「隨機」隨便跳到一個還在玩的人，不會跳到自己。在他的表格世界裡看得到他的角色、規則表、資源表、時段，不能改；按「回我自己」回來。'],
    ['今天', '下一步和提醒（還沒建空物件、還沒確認到達）、今天還能給多少點、今天的預約和倒數、「你不在的時候」的結果。'],
    ['公告欄', '公告：掛出我需要什麼、我可以給什麼（從自己的資源表選）、一圈最多幾人、掛到哪一天；過了期限自動拿掉，也可以撤掉。找人：我可以去找（我通他的條件）、可能來找我（他通我的條件）、全部。兩張共用一個搜尋框：打一個詞，公告裡提到的、別人資源表裡有的一起列出來。每一列標你通不通他的條件，跟預約用同一個判斷；點序號就到他的表格世界。'],
    ['預約', '在他的「時段」按「約他」。旁邊到達的勾預設勾著：預約時就確認到達，勾了就算，不用守在那一刻；不去的話先把勾拿掉。之後在「我預約的」可以取消到達、再確認、取消預約；沒確認的記為錯過。那一微秒之前在同一列選要換他的什麼、設每人最多給多少點、看他要我的什麼。一換一：兩邊都選了對方的東西才成交。開時段可以勾「一起成交」：有選東西的每一對都成才全部成交。'],
    ['那一微秒', '畫面開著的話，成交那一刻整個畫面白光一閃，跳出成交結果，能量條往下降；沒開著的話，下次打開跳出「你不在的時候」。'],
    ['我的', '角色：每天的點（改了明天起生效）、聯絡方式（只有預約成功的人看得到）、換點比例、對接過幾次、不玩了；換人只是單機測試用。規則表：用途、對接條件、兩個開關、家規和家規網站（只收 https:// 開頭的網址；沒填就是不收留言），改了明天起生效。資源表：名稱、價格、保留天數、定義改了明天起生效，「明天起」寫在那一格下面；可換的數量隨時補減。背包：手上別人的點，每一筆旁邊直接兌現。日曆：一格一天，跟達秒屋的磚一樣（亮、小記號、蓋布、虛線）；點一格看那天，在那裡改每一筆給誰看。'],
    ['達秒屋', '每個人一間，分大門和房子。大門大家都一樣：門牆排法跟日曆一樣，一格一個月、一天一塊磚、一排一週，一層 12 個月（從創角色那個月開始），每過一年加高一層。有成交就亮、越多越亮；只有不成交或錯過有個小記號；看不到的蓋著布；未來的預約是虛線磚。點一塊磚看那天，點門進他的表格世界。一指拖著轉、兩指縮放。門以外的房子自己蓋：在自己的達秒屋外面按「蓋」，選方塊、點一個面加一塊，切到「拆」點一塊拿掉，點擺設轉方向，可以復原上一步，也可以用範本（塔、長屋、平房、圓屋）。只能蓋在地皮上，大門那一排不能蓋；地皮一開始 12×12、高 12，每活一年四邊各外推一格、高度加 2，最大 32×32、高 32，不限幾塊。每一筆可以設公開、只給鄰居看或全藏，只藏自己這一邊；對接的兩個人永遠看得到；藏起來的照樣算進對接過幾次和換點比例。整間屋可以只給鄰居看。'],
    ['新手教學', '第一次打開從創角色開始，創完先到自己的達秒屋外面：在達秒屋外面按隨機看一個陌生人的大門、點門進他的表格世界；在公告欄找到引路人的序號跳過去；看他的家規；預約選他的「空的」；那一微秒；在背包兌現；最後看自己的達秒屋，門牆上的第一塊磚亮了。可以跳過；教學的對接標「教學」，不算進對接過幾次和換點比例。']
  ];
  R.help = function () { return '<div class="help">' + HELP.map(function (h) { return '<h3>' + esc(h[0]) + '</h3><p>' + esc(h[1]) + '</p>'; }).join('') + '<p style="margin-top:16px">' + btn('resetAll', '全部還原成預設', '', 'warn') + '</p></div>'; };

  /* ---------- 成交的一句話（以我為主體） ---------- */
  function dockLine(d, m) {
    var other = roleOf(d.a === m ? d.b : d.a), gave = d.a === m ? d.gaveA : d.gaveB, got = d.a === m ? d.gaveB : d.gaveA, myIn = d.a === m ? d.itemsB : d.itemsA, myOut = d.a === m ? d.itemsA : d.itemsB;
    var on = other ? other.name : '？';
    if (!d.ok) return '和 ' + on + ' 不成立：' + d.reason;
    if (!d.traded) return '和 ' + on + ' 不成交：' + d.reason;
    var nIn = d.a === m ? d.noteB : d.noteA, nOut = d.a === m ? d.noteA : d.noteB;
    return '和 ' + on + '（' + d.how + '）\n我拿出：' + CORE.itemsText(myOut) + '（' + gave + ' 點）；拿到：' + on + '的' + CORE.itemsText(myIn) + '（' + got + ' 點）' + (nIn ? '\n' + nIn : '') + (nOut ? '\n他' + nOut : '') + (other && other.contact && CORE.contactVisible(S(), other, m) ? '\n聯絡方式：' + other.contact : '');
  }

  /* ---------- 畫 ---------- */
  function render() {
    var m = me(), o = UI.other ? roleOf(UI.other) : null;
    if (UI.other && !o) UI.other = null;
    $('tother').innerHTML = o ? '<b>' + esc(CORE.abbrev(o.serial) + ' ' + o.name) + '</b> 的表格世界 ' + btn('house', '看他的達秒屋', ' data-id="' + o.serial + '"') + ' ' + btn('home', '回我自己') : '<span class="small muted">' + (APP.isBlank() ? '還沒創角色' : '我是 <b>' + esc(CORE.abbrev(m.serial) + ' ' + m.name) + '</b>') + '</span>';
    var st = APP.tutActive() && !APP.isBlank() ? APP.steps() : null;
    $('tutbar').hidden = !APP.tutActive();
    if (APP.tutActive()) $('tutbar').innerHTML = '<span class="small">' + esc(APP.isBlank() ? '新手教學 ① 創角色：填名字、每天的點、第一樣東西「空的」，按「建立」' : st.hint) + '</span>' + (APP.tut().step === 8 ? btn('myHouse', '去我的達秒屋', '', 'pri') : '') + (APP.isBlank() ? '' : btn('tutSkip', '跳過教學', '', 'warn'));
    // 上方：組裡的表（或他的表格世界的四張）
    var tabs = o ? OTHER : GROUPS.find(function (g) { return g.k === UI.group; }).sheets, cur = o ? UI.osheet : UI.sheet;
    $('ttabs').innerHTML = tabs.map(function (k) { return '<button type="button" class="tab' + (cur === k || (cur === 'defs' && k === 'resources') ? ' on' : '') + '" data-act="tab" data-s="' + k + '"' + (cur === k ? ' aria-current="page"' : '') + '>' + esc(NAMES[k]) + '</button>'; }).join('');
    $('tgroups').innerHTML = GROUPS.map(function (g) { return '<button type="button" class="grp' + (!o && UI.group === g.k ? ' on' : '') + '" data-act="go" data-g="' + g.k + '">' + esc(g.name) + '</button>'; }).join('');
    var key = o ? UI.osheet : UI.sheet, scroll = window.scrollY, same = render.last === (o ? o.serial + ':' : '') + key;
    $('tmain').innerHTML = '<div class="msg" id="tmsg"' + (UI.msg ? '' : ' hidden') + '>' + esc(UI.msg) + '</div>' + R[key]();
    if (!same) window.scrollTo(0, 0); else if (window.scrollY !== scroll) window.scrollTo(0, scroll);
    render.last = (o ? o.serial + ':' : '') + key;
    KIT.fitInputs($('tmain'));
    if (key === 'calendar') KIT.bindCalendar($('tmain'), function (mo) { UI.month = mo; render(); });
    if (UI.focus) { var tr = document.querySelector('#tmain tr[data-row][data-id="' + CSS.escape(UI.focus) + '"]'); UI.focus = null; if (tr) { tr.scrollIntoView({ block: 'center' }); tr.classList.add('flash'); } }
  }
  function msg(t) { UI.msg = t || ''; var el = $('tmsg'); if (el) { el.textContent = UI.msg; el.hidden = !UI.msg; } }
  // 換頁：自己的表
  function tab(sheet, id) {
    if (UI.other) { if (OTHER.indexOf(sheet) >= 0) { UI.osheet = sheet; if (sheet === 'rules' && UI.other === APP.GUIDE) APP.tutEvent('sawGuideRules'); render(); return; } UI.other = null; }
    var g = GROUPS.find(function (x) { return x.sheets.indexOf(sheet) >= 0; }); if (!g) return;
    UI.group = g.k; UI.sheet = sheet; UI.focus = id || null; UI.msg = ''; render();
  }
  // 到他的表格世界（how：從哪裡來的，教學用）
  function visit(serial, sheet, how) {
    var r = roleOf(serial); if (!r) { msg('找不到這個序號'); return false; }
    if (r === me()) { UI.other = null; tab(sheet && SHEETS.indexOf(sheet) >= 0 ? sheet : 'role'); return true; }
    UI.other = serial; UI.osheet = OTHER.indexOf(sheet) >= 0 ? sheet : 'role'; UI.msg = '';
    if (serial === APP.GUIDE && (how === 'serial' || how === 'notice')) APP.tutEvent('foundGuide');
    if (serial === APP.GUIDE && UI.osheet === 'rules') APP.tutEvent('sawGuideRules');
    render(); return true;
  }
  function home() { UI.other = null; render(); }

  var pop = KIT.pop, flash = KIT.flash;

  /* ---------- 動作 ---------- */
  function run(fn, ok) { var r = APP.run(fn, ok); msg(r.msg); return r; }
  var val = function (id) { var el = $(id); return el ? el.value : ''; };
  function wantEdit(b, delta) { var slot = CORE.slotOf(S(), b.dataset.slot).slot, ids = CORE.wantsOf(slot, me().serial, b.dataset.other).slice(); if (delta > 0) ids.push(b.dataset.res); else { var i = ids.indexOf(b.dataset.res); if (i >= 0) ids.splice(i, 1); } run(function () { CORE.setWants(S(), slot.id, me().serial, b.dataset.other, ids); }); }
  function tmr() { return CORE.tomorrow(S(), me().serial, now()); }
  function createMe(skip) {
    var r = run(function () { APP.createPlayer({ name: val('cName').trim(), dailyPoints: val('cDaily'), firstItem: { name: val('cItem').trim(), price: +val('cPrice') || 0, qty: Math.max(0, Math.floor(+val('cQty') || 0)) } }, skip); }, skip ? '角色建好了。跳過教學' : '角色建好了。教學開始：按最上面的「隨機」');
    if (r.ok) { UI.group = 'today'; UI.sheet = 'today'; UI.other = null; render(); msg(r.msg); }
  }
  function goSerial() {
    var code = val('serialIn').trim(); if (!code) { msg('先輸入序號，例如 J2'); return; }
    var r = CORE.findRole(S(), code); if (!r) { msg('找不到序號 ' + code); return; }
    visit(r.serial, 'role', 'serial');
  }
  var ACT = {
    go: function (b) { var g = GROUPS.find(function (x) { return x.k === b.dataset.g; }); UI.other = null; tab(UI.group === g.k && g.sheets.indexOf(UI.sheet) >= 0 ? UI.sheet : g.sheets[0]); },
    tab: function (b) { if (b.dataset.g) UI.group = b.dataset.g; tab(b.dataset.s, b.dataset.id || null); },
    visit: function (b) { visit(b.dataset.id, b.dataset.s || 'role', b.closest('[data-sheet="notices"]') ? 'notice' : 'link'); },
    home: home,
    house: function (b) { APP.goHouse(b.dataset.id); },
    build: function () { APP.goHouse(me().serial, true); },
    myHouse: function () { APP.goHouse(me().serial); },
    serialGo: goSerial,
    random: function () { var r = CORE.randomRole(S(), me().serial); if (!r) { msg('沒有別人'); return; } APP.tutEvent('random'); visit(r.serial, 'role', 'random'); },
    defs: function (b) { UI.defsOf = b.dataset.id; if (UI.other) UI.osheet = 'defs'; else { UI.group = 'mine'; UI.sheet = 'defs'; } UI.focus = 'd:' + b.dataset.res; render(); },
    backDefs: function () { if (UI.other) UI.osheet = 'resources'; else UI.sheet = 'resources'; render(); },
    search: function () { UI.kw = val('kwIn').trim(); render(); },
    clearKw: function () { UI.kw = ''; render(); },
    findMode: function (b) { UI.findMode = b.dataset.v; render(); },
    noticeMode: function (b) { UI.noticeMode = b.dataset.v; render(); },
    post: function () { var give = [].slice.call(document.querySelectorAll('#tmain [data-give]')).filter(function (x) { return x.checked; }).map(function (x) { return x.dataset.give; }); var u = val('ntUntil'); run(function () { CORE.postNotice(S(), me().serial, { need: val('ntNeed'), kind: val('ntKind'), give: give, cap: val('ntCap'), untilDay: u ? CORE.dayNum(new Date(u + 'T12:00:00').getTime() * 1000) : null }, now()); }, '公告掛上去了'); },
    unpost: function (b) { run(function () { CORE.removeNotice(S(), me().serial, b.dataset.id); }, '撤掉了'); },
    book: function (b) { var box = $('arr_' + b.dataset.id), arrive = !box || box.checked; var r = run(function () { return CORE.book(S(), me().serial, b.dataset.id, now(), arrive); }, arrive ? '約好了，到達也確認了。到「我預約的」選要換他的什麼' : '約好了，還沒確認到達：到「我預約的」勾到達'); if (r.ok) { UI.other = null; tab('booked', b.dataset.id); msg(r.msg); } },
    cancelBook: function (b) { run(function () { CORE.cancelBooking(S(), me().serial, b.dataset.id); }, '取消預約了'); },
    wantAdd: function (b) { wantEdit(b, 1); },
    wantSub: function (b) { wantEdit(b, -1); },
    addSlot: function () { run(function () { var min = +val('addSlotMin'); if (!(min >= 1)) throw new Error('幾分鐘後要至少 1'); var s = CORE.addSlot(S(), me().serial, now() + min * 60e6 + Math.floor(Math.random() * 1000), val('addSlotCap'), val('addSlotMax'), now(), $('addSlotTogether') && $('addSlotTogether').checked); UI.focus = s.id; }, '開了時段'); },
    delSlot: function (b) { run(function () { CORE.deleteSlot(S(), me().serial, b.dataset.id, now()); }, '刪了時段'); },
    quit: function (b) { var bl = CORE.quitBlockers(S(), b.dataset.id, now()); pop('不玩了', '刪掉 ' + me().name + '。' + (bl.length ? '還有 ' + bl.length + ' 筆你的點沒換，會作廢；單機版持有人都在本機，視為同意。' : '沒有人拿著你的點。'), [{ label: '確定不玩了', fn: function () { run(function () { APP.quit(b.dataset.id); }, '角色刪掉了'); } }, { label: '不要', pri: true }]); },
    create: function () { createMe(false); }, createSkip: function () { createMe(true); },
    accept: function (b) { run(function () { CORE.accept(S(), me().serial, b.dataset.id, now()); }, '接受了他的家規'); },
    addUse: function () { run(function () { var t = val('addUse').trim(); if (!t) throw new Error('先寫內容'); tmr().rules.uses.push(t); }, '加了，明天起'); },
    delUse: function (b) { run(function () { tmr().rules.uses.splice(+b.dataset.id, 1); }, '刪了，明天起'); },
    addCond: function () { run(function () { tmr().rules.conditions.push({ field: val('addCondField'), op: val('addCondOp'), value: +val('addCondValue') || 0 }); }, '加了，明天起'); },
    delCond: function (b) { run(function () { tmr().rules.conditions.splice(+b.dataset.id, 1); }, '刪了，明天起'); },
    addRes: function () { run(function () { CORE.addResource(S(), me().serial, { name: val('addResName'), def: val('addResDef'), price: val('addResPrice'), keepDays: val('addResKeep') }, now()); }, '上架了，明天起生效；可換的數量現在就能補'); },
    delRes: function (b) { run(function () { CORE.removeResource(S(), me().serial, b.dataset.id, now()); }, '明天起下架；已保留的照舊'); },
    stock: function (b) { var k = Math.floor(+val('stockN_' + b.dataset.id)) || 1; run(function () { CORE.restock(S(), me().serial, b.dataset.id, +b.dataset.n * k); }, +b.dataset.n > 0 ? '補了 ' + k + ' 份' : '減了 ' + k + ' 份'); },
    redeem: function (b) { run(function () { CORE.redeem(S(), me().serial, b.dataset.id, now()); }, '換到了'); },
    resetAll: function () { pop('全部還原成預設', '所有資料都會清掉，從創角色開始。', [{ label: '還原', fn: function () { APP.resetAll(); UI.other = null; UI.group = 'mine'; UI.sheet = 'role'; UI.msg = ''; render(); } }, { label: '不要', pri: true }]); },
    tutSkip: function () { APP.tutSkip(); msg('跳過了教學。想只收不給，記得要有 0 點的空物件。'); }
  };
  var EDIT = {
    me: function (id, v) { APP.becomeMe(+v); },
    house: function (id, v) { var f = {}; f[id] = v; CORE.setHouse(S(), me().serial, f); },
    kind: function (id, v) { UI.kind = v; },
    daily: function (id, v) { CORE.setDailyPoints(S(), me().serial, v, now()); },
    contact: function (id, v) { CORE.setContact(S(), me().serial, v); },
    useText: function (id, v) { tmr().rules.uses[+id] = v; },
    condField: function (id, v) { tmr().rules.conditions[+id].field = v; },
    condOp: function (id, v) { tmr().rules.conditions[+id].op = v; },
    condValue: function (id, v) { tmr().rules.conditions[+id].value = +v || 0; },
    switch: function (id, v, el) { tmr().rules[id] = !!el.checked; },
    village: function (id, v) { tmr().rules.village = v; },
    site: function (id, v) { CORE.setSite(S(), me().serial, v, now()); },
    resName: function (id, v) { CORE.setResource(S(), me().serial, id, { name: v }, now()); },
    resDef: function (id, v) { CORE.setResource(S(), me().serial, id, { def: v }, now()); },
    resPrice: function (id, v) { CORE.setResource(S(), me().serial, id, { price: v }, now()); },
    resKeep: function (id, v) { CORE.setResource(S(), me().serial, id, { keepDays: v }, now()); },
    present: function (id, v, el) { CORE.setPresent(S(), me().serial, id, el.checked); },
    maxGive: function (id, v) { var x = CORE.slotOf(S(), id); if (x) CORE.setMaxGive(S(), x.slot, me().serial, v); }
  };
  var busy = false;
  $('view-table').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || !ACT[b.dataset.act] || busy || b.disabled) return;
    busy = true; try { ACT[b.dataset.act](b); } finally { busy = false; }
  });
  $('view-table').addEventListener('change', function (e) {
    var t = e.target; if (!t.dataset || !t.dataset.ed || !EDIT[t.dataset.ed] || busy) return;
    busy = true;
    try { var okMsg = t.dataset.ed === 'present' ? (t.checked ? '確認到達了' : '取消到達了') : ''; try { EDIT[t.dataset.ed](t.dataset.id, t.value, t); APP.changed(); msg(okMsg); } catch (err) { APP.changed(); msg(err.message); return; } if (t.dataset.ed !== 'me') render(); }
    finally { busy = false; }
  });
  $('serialIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') goSerial(); });
  $('tmain').addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'kwIn') { UI.kw = e.target.value.trim(); render(); } });

  /* ---------- 事件 ---------- */
  APP.on('change', function () { if (!busy) render(); else setTimeout(render, 0); });
  APP.on('me', function () { UI.other = null; render(); });
  // 從達秒屋回來：點門到他的表格世界、或回我的表格世界
  APP.on('view', function (v) {
    if (v.name !== 'table') { $('view-table').hidden = true; return; }
    $('view-table').hidden = false;
    if (v.serial) visit(v.serial, v.sheet || 'role', v.how); else { UI.other = null; if (v.sheet) tab(v.sheet); else render(); }
  });
  APP.on('tut', function (st) { render(); if (st === 'done' && !APP.tut().skipped) msg('教學完成！接下來照「今天」準備自己的規則表、資源表、時段。（第 8 步：看自己的達秒屋，第 2 輪做）'); });
  // 那一微秒：成交那一刻白光一閃、跳出成交結果；沒開著的話，下次打開跳出「你不在的時候」（同一格兩種都有就一起列）
  APP.on('dock', function (res) {
    var m = me().serial, about = function (x) { return x.docking ? (x.docking.a === m || x.docking.b === m) : x.missed === m; };
    var late = res.filter(function (x) { return x.late && about(x); }), nowRes = res.filter(function (x) { return !x.late && x.docking && about(x); });
    render();
    if (!late.length && !nowRes.length) { if (res.some(function (x) { return !x.late && x.missed === m; })) msg('那一微秒過了，沒確認到達的記為錯過。'); return; }
    var lateText = late.map(function (x) { return '・' + CORE.fmtUs(x.slot.atUs).slice(5, 19) + ' ' + x.owner.name + ' 的時段：' + (x.docking ? dockLine(x.docking, m) : '沒確認到達，錯過了'); }).join('\n');
    var nowText = nowRes.map(function (x) { return dockLine(x.docking, m); }).join('\n\n');
    if (nowRes.some(function (x) { return x.docking.traded; }) && !$('view-table').hidden) flash();
    pop(late.length && nowRes.length ? '你不在的時候、到達那微秒' : late.length ? '你不在的時候' : '到達那微秒', late.length && nowRes.length ? '【你不在的時候】\n' + lateText + '\n\n【剛才】\n' + nowText : late.length ? lateText : nowText);
  });
  // 還有幾秒：每秒更新那幾格的字，不重畫整張表
  setInterval(function () { document.querySelectorAll('#tmain [data-left]').forEach(function (el) { el.textContent = leftText(+el.dataset.left); }); }, 1000);

  APP.on('saveFail', function (m) { pop('存不進去', m + '\n手機的空間可能滿了：清掉一些網站資料再試。'); });
  render();
  if (APP.loadIssue()) setTimeout(function () { pop('存檔讀不進來', APP.loadIssue().message); }, 0);
  return { render: render, ui: UI, tab: tab, visit: visit, home: home, NAMES: NAMES, GROUPS: GROUPS, SHEETS: SHEETS, OTHER: OTHER };
})();
