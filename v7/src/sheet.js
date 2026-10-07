/* ===== v7 表世界：簡單的 Excel =====
 * 沒有 3D、沒有 HUD。一張工作表只放一張表；表頭是欄位名稱、左邊列號、第一欄凍結；按鈕在格子裡；
 * 代號、功能點、時段、點數是連結，跳到對應那一列並閃一下；「←」返回。只呼叫 APP 和 CORE。
 */
var SHEET = (function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = APP.esc, opt = APP.opt, now = APP.now;
  var S = function () { return APP.state(); }, me = function () { return APP.me(); };
  var allObjs = APP.allObjs, STATUS = APP.STATUS;
  var UI = { sheet: 'todo', hist: [], focus: null, who: null, kw: '', worldPath: [] };
  var GROUPS = [
    { cls: 'g-todo', keys: ['todo'] },
    { cls: 'g-mine', keys: ['roles', 'uses', 'conds', 'switches', 'resources', 'world', 'circles', 'moves'] },
    { cls: 'g-find', keys: ['visit', 'come', 'search', 'open', 'myslots', 'booked'] },
    { cls: 'g-book', keys: ['dockings', 'points', 'redeem', 'records'] },
    { cls: 'g-help', keys: ['help'] }
  ];
  var ORDER = [].concat.apply([], GROUPS.map(function (g) { return g.keys; }));
  var tag = function (cls, t) { return '<span class="tag ' + cls + '">' + esc(t) + '</span>'; };
  var num = function (us) { return '<span class="num">' + esc(CORE.fmtUs(us)) + '</span>'; };
  var dash = '<span class="muted">—</span>';
  var roleOf = APP.roleOf;
  var roleName = function (serial) { var r = roleOf(serial); return r ? CORE.abbrev(serial) + ' ' + r.name : serial; };
  var stTag = function (r) { var st = CORE.status(r, now()); return tag({ active: '', vacancy: 'wait', ended: 'bad' }[st], STATUS[st]); };
  function L(sheet, id, text) { return '<button type="button" class="lk" data-act="jump" data-s="' + sheet + '" data-id="' + esc(id) + '">' + text + '</button>'; }
  function btn(act, label, attrs, cls) { return '<button type="button" class="btn sm' + (cls ? ' ' + cls : '') + '" data-act="' + act + '"' + (attrs || '') + '>' + esc(label) + '</button>'; }
  function inp(ed, id, value, extra) { return '<input type="text" data-ed="' + ed + '" data-id="' + esc(id) + '" value="' + esc(value) + '"' + (extra || '') + '>'; }
  function roleLink(r) { return L('roles', r.serial, esc(roleName(r.serial))); }
  // 「看誰」：規則、資源、時段、世界預設看自己；有草稿時規則與資源可以看草稿
  function who() { if (UI.who === 'draft' && APP.draft()) return 'draft'; return roleOf(UI.who) || me(); }
  function whoRole() { var w = who(); return w === 'draft' ? null : w; }
  function isDraft() { return who() === 'draft'; }
  function draftRules() { return APP.draft().rules; }
  function levelObjects() { var r = whoRole() || me(), lv = r.world.objects; for (var i = 0; i < UI.worldPath.length; i++) { var o = lv.find(function (x) { return x.id === UI.worldPath[i]; }); if (!o || !o.door) { UI.worldPath = UI.worldPath.slice(0, i); break; } lv = o.door.objects; } return lv; }
  function objOpts(sel) { return CORE.allObjects(me().world).map(function (x) { return opt(x.o.id, (x.depth ? '　'.repeat(x.depth) + '└ ' : '') + x.o.name, sel); }).join(''); }
  var condSel = function (ed, i, c) { var f = CORE.COND_FIELDS[c.field]; return { field: '<select data-ed="' + ed + 'Field" data-id="' + i + '">' + Object.keys(CORE.COND_FIELDS).map(function (k) { return opt(k, CORE.COND_FIELDS[k].label, c.field); }).join('') + '</select>', op: '<select data-ed="' + ed + 'Op" data-id="' + i + '">' + (f.enum ? ['=', '!='] : Object.keys(CORE.OPS)).map(function (o) { return opt(o, f.enum ? (o === '=' ? '是' : '不是') : CORE.OPS[o], c.op); }).join('') + '</select>', value: f.enum ? '<select data-ed="' + ed + 'Value" data-id="' + i + '">' + Object.keys(f.enum).map(function (k) { return opt(k, f.enum[k], c.value); }).join('') + '</select>' : '<input type="number" class="kc" data-ed="' + ed + 'Value" data-id="' + i + '" value="' + c.value + '">' }; };

  /* ---------- 工作表：每張一張表 ---------- */
  var SHEETS = {
    todo: { name: '待辦', rowId: function (x) { return x.id; }, rows: function () { return APP.steps().rows; }, cls: function (x) { var n = APP.steps().next; return n && n.id === x.id ? 'next' : ''; },
      cols: [
        { k: 'no', h: '步驟', v: function (x) { return x.no + ' ' + esc(x.name); } },
        { k: 'ok', h: '狀態', v: function (x) { var n = APP.steps().next; return x.ok ? tag('', '完成') : n && n.id === x.id ? tag('wait', '下一步') : tag('off', '還沒'); } },
        { k: 'go', h: '動作', v: function (x) { var to = { role: 'roles', rule: 'uses', resource: 'resources', build: 'world', goal: 'myslots', map: 'visit' }[x.func]; return btn('jump', (x.name.charAt(0) === '去' ? x.name : '去' + x.name), ' data-s="' + to + '"', (APP.steps().next || {}).id === x.id ? 'pri' : ''); } },
        { k: 'st', h: '目前', v: function (x) { return '<span class="small">' + esc(x.status) + '</span>'; }, wrap: true }
      ] },
    roles: { name: '角色', rowId: function (r) { return r.serial; }, rows: function () { return S().roles; }, mine: function (r) { return r === me(); },
      cols: [
        { k: 'me', h: '我是', v: function (r) { return '<input type="radio" name="meIs" data-ed="me" data-id="' + r.serial + '"' + (r === me() ? ' checked' : '') + ' aria-label="我是"> ' + (r === me() ? '我' : ''); } },
        { k: 'code', h: '代號', v: function (r) { return '<b>' + CORE.abbrev(r.serial) + '</b> ' + esc(r.name); } },
        { k: 'daily', h: '每天的點', num: true, v: function (r) { return String(r.dailyPoints); } },
        { k: 'left', h: '今天還能給', num: true, v: function (r) { return String(CORE.remainingToday(S(), r, now())); } },
        { k: 'days', h: '剩幾天', num: true, v: function (r) { return String(Math.floor(CORE.daysLeft(r, now()))); } },
        { k: 'st', h: '狀態', v: function (r) { return stTag(r) + (r.vacancyDebt ? ' <span class="small muted">欠 ' + esc(roleName(r.vacancyDebt.holder)) + ' 一筆</span>' : ''); } },
        { k: 'dock', h: '對接過', num: true, v: function (r) { return String(CORE.dockCount(S(), r.serial)); } },
        { k: 'rules', h: '規則', v: function (r) { return L('uses', r.serial + ':', r.rules.uses.length + ' 用途 ' + r.rules.conditions.length + ' 條件'); } },
        { k: 'res', h: '資源', v: function (r) { return L('resources', r.serial + ':', r.resources.length + ' 項'); } },
        { k: 'contact', h: '聯絡方式', v: function (r) { return CORE.contactVisible(S(), r, me().serial, now()) ? (r.contact ? esc(r.contact) : '<span class="muted">（沒填）</span>') : '<span class="muted">預約成功才看得到</span>'; } },
        { k: 'prev', h: '前身', v: function (r) { return r.prev ? L('roles', r.prev, esc(CORE.abbrev(r.prev))) : dash; } },
        { k: 'act', h: '動作', v: function (r) { if (r !== me()) return ''; var st = CORE.status(r, now()); if (st === 'ended') return btn('recreate', '以此為前身重創', ' data-id="' + r.serial + '"', 'pri'); return (st === 'active' ? btn('vacIn', '進入空窗', ' data-id="' + r.serial + '"') : btn('vacOut', '離開空窗', ' data-id="' + r.serial + '"', 'pri')) + ' ' + btn('endEarly', '結束並重創', ' data-id="' + r.serial + '"'); } }
      ],
      add: function () { var d = APP.draft(); return d ? { code: '<span class="small">草稿：' + esc(d.name || '（還沒取名）') + '</span>', daily: '<input type="number" class="kc" data-ed="draftDaily" data-id="d" value="' + d.dailyPoints + '">', days: '<input type="number" class="kc" data-ed="draftDays" data-id="d" value="' + d.days + '">', contact: '<input type="text" data-ed="draftContact" data-id="d" value="' + esc(d.contact) + '" placeholder="聯絡方式">', act: btn('createRole', '創角色', '', 'pri') + ' ' + btn('jump', '填規則', ' data-s="uses" data-id="draft:"') + ' ' + btn('dropDraft', '丟掉草稿') } : { code: '<input type="text" id="addRoleName" placeholder="新角色的名字">', daily: '<input type="number" class="kc" id="addRoleDaily" value="1800">', days: '<input type="number" class="kc" id="addRoleDays" value="30">', act: btn('newDraft', '開始建角色', '', 'pri') }; } },
    uses: { name: '規則用途', who: true, rowId: function (x, i) { return 'u' + i; }, rows: function () { return isDraft() ? draftRules().uses : whoRole().rules.uses; },
      cols: [{ k: 'text', h: '我的點能做什麼', v: function (x, i) { return isDraft() ? inp('useText', i, x) : esc(x); }, wrap: true }, { k: 'act', h: '動作', v: function (x, i) { return isDraft() ? btn('delUse', '刪', ' data-id="' + i + '"') : ''; } }],
      add: function () { return isDraft() ? { text: '<input type="text" id="addUse" placeholder="例如：1 我點 = 陪跑 1 分鐘">', act: btn('addUse', '加一條', '', 'pri') } : null; }, empty: '（沒寫）' },
    conds: { name: '對接條件', who: true, rowId: function (x, i) { return 'c' + i; }, rows: function () { return isDraft() ? draftRules().conditions : whoRole().rules.conditions; },
      cols: [
        { k: 'field', h: '欄位', v: function (c, i) { return isDraft() ? condSel('cond', i, c).field : esc(CORE.COND_FIELDS[c.field].label); } },
        { k: 'op', h: '比較', v: function (c, i) { var f = CORE.COND_FIELDS[c.field]; return isDraft() ? condSel('cond', i, c).op : esc(f.enum ? (c.op === '=' ? '是' : '不是') : CORE.OPS[c.op]); } },
        { k: 'value', h: '數值', v: function (c, i) { var f = CORE.COND_FIELDS[c.field]; return isDraft() ? condSel('cond', i, c).value : esc(f.enum ? f.enum[c.value] : String(c.value)); } },
        { k: 'plain', h: '白話', v: function (c) { return '<span class="small">' + esc(CORE.condText(c)) + '</span>'; }, wrap: true },
        { k: 'me', h: '我通不通', v: function (c) { if (isDraft() || whoRole() === me()) return ''; var ok = CORE.passes(S(), { rules: { conditions: [c] }, state: 'active', life: whoRole().life }, me(), now()).ok; return ok ? tag('', '通') : tag('bad', '不通'); } },
        { k: 'act', h: '動作', v: function (c, i) { return isDraft() ? btn('delCond', '刪', ' data-id="' + i + '"') : ''; } }
      ],
      add: function () { return isDraft() ? { field: '<select id="addCondField">' + Object.keys(CORE.COND_FIELDS).map(function (k) { return opt(k, CORE.COND_FIELDS[k].label, 'dailyPoints'); }).join('') + '</select>', op: '<select id="addCondOp">' + Object.keys(CORE.OPS).map(function (o) { return opt(o, CORE.OPS[o], '>='); }).join('') + '</select>', value: '<input type="number" class="kc" id="addCondValue" value="1000">', act: btn('addCond', '加一條', '', 'pri') } : null; }, empty: '沒有條件，誰都通。' },
    switches: { name: '開關與村規', who: true, rowId: function (x) { return x.k; }, rows: function () { var ru = isDraft() ? draftRules() : whoRole().rules; var r = whoRole(); return [{ k: 'bothMustPass', name: '要求兩方都通', v: ru.bothMustPass }, { k: 'mustAcceptVillage', name: '對方一定要接受我的村規', v: ru.mustAcceptVillage }, { k: 'village', name: '村規', v: ru.village, r: r }]; },
      cols: [
        { k: 'name', h: '項目', v: function (x) { return esc(x.name); } },
        { k: 'v', h: '設定', v: function (x) { if (x.k === 'village') return isDraft() ? '<textarea data-ed="village" data-id="v">' + esc(x.v) + '</textarea>' : (x.v ? esc(x.v) : dash); return isDraft() ? '<input type="checkbox" data-ed="switch" data-id="' + x.k + '"' + (x.v ? ' checked' : '') + '>' : (x.v ? tag('wait', '開') : tag('off', '關')); }, wrap: true },
        { k: 'act', h: '動作', v: function (x) { if (x.k !== 'village' || isDraft() || !x.r || x.r === me() || !x.v) return ''; return CORE.accepted(S(), me().serial, x.r.serial) ? tag('', '你已接受') : btn('accept', '接受他的村規', ' data-id="' + x.r.serial + '"', 'pri'); } }
      ] },
    resources: { name: '資源', who: true, rowId: function (x, i) { return isDraft() ? 'd' + i : whoRole().serial + ':' + x.id; }, rows: function () { return isDraft() ? APP.draft().resources : whoRole().resources; },
      cols: [
        { k: 'name', h: '資源', v: function (x, i) { return isDraft() ? inp('resName', i, x.name) : esc(x.name); } },
        { k: 'price', h: '價格（點）', num: true, v: function (x, i) { return isDraft() ? '<input type="number" class="kc" data-ed="resPrice" data-id="' + i + '" value="' + x.price + '">' : String(x.price); } },
        { k: 'qty', h: '數量', num: true, v: function (x, i) { return isDraft() ? '<input type="number" class="kc" data-ed="resQty" data-id="' + i + '" value="' + x.qty + '">' : String(x.qty); } },
        { k: 'act', h: '動作', v: function (x, i) { if (isDraft()) return btn('delRes', '刪', ' data-id="' + i + '"'); if (whoRole() === me()) return btn('restock', '補 1 份', ' data-id="' + x.id + '"'); return btn('jump', '去兌現', ' data-s="redeem" data-id="' + whoRole().serial + ':"', 'pri'); } }
      ],
      add: function () { return isDraft() ? { name: '<input type="text" id="addResName" placeholder="例如：陪跑一小時">', price: '<input type="number" class="kc" id="addResPrice" value="60">', qty: '<input type="number" class="kc" id="addResQty" value="1">', act: btn('addRes', '上架', '', 'pri') } : null; }, empty: '沒有資源。' },
    world: { name: '世界', who: true, rowId: function (o) { return (whoRole() || me()).serial + ':' + o.id; }, rows: function () { return levelObjects(); },
      cols: [
        { k: 'name', h: '名稱', v: function (o) { return inp('objName', o.id, o.name); } },
        { k: 'func', h: '功能', v: function (o) { return '<select data-ed="objFunc" data-id="' + o.id + '">' + Object.keys(CORE.FUNCS).map(function (k) { return opt(k, CORE.FUNCS[k].label, o.func); }).join('') + '</select>'; } },
        { k: 'look', h: '外觀', v: function (o) { return '<select data-ed="objLook" data-id="' + o.id + '">' + Object.keys(CORE.LOOKS).map(function (k) { return opt(k, k, o.look); }).join('') + opt('', '（自訂）', o.look || '') + '</select>'; } },
        { k: 'color', h: '顏色', v: function (o) { return '<input type="color" data-ed="objColor" data-id="' + o.id + '" value="' + (o.parts[0] ? o.parts[0].color : '#999999') + '">'; } },
        { k: 'x', h: 'x', num: true, v: function (o) { return '<input type="number" class="xy" data-ed="objX" data-id="' + o.id + '" value="' + o.pos[0] + '">'; } },
        { k: 'z', h: 'z', num: true, v: function (o) { return '<input type="number" class="xy" data-ed="objZ" data-id="' + o.id + '" value="' + o.pos[1] + '">'; } },
        { k: 'door', h: '門', v: function (o) { if (UI.worldPath.length >= 2) return '<span class="muted small">第 3 層不能再開門</span>'; return '<select data-ed="objDoor" data-id="' + o.id + '">' + opt('', '沒有門', o.door ? o.door.visible : '') + opt('all', '門：所有人', o.door ? o.door.visible : '') + opt('self', '門：只有自己', o.door ? o.door.visible : '') + '</select>' + (o.door ? ' ' + btn('worldIn', '進去（' + o.door.objects.length + '）', ' data-id="' + o.id + '"') : ''); } },
        { k: 'act', h: '動作', v: function (o) { return btn('delObj', '刪', ' data-id="' + o.id + '"'); } }
      ],
      add: function () { return { name: '<input type="text" id="addObjName" placeholder="新地標">', func: '<span class="muted small">地標</span>', look: '<select id="addObjLook">' + Object.keys(CORE.LOOKS).map(function (k) { return opt(k, k, '山'); }).join('') + '</select>', color: '<input type="color" id="addObjColor" value="#8A8F96">', x: '<input type="number" class="xy" id="addObjX" value="0">', z: '<input type="number" class="xy" id="addObjZ" value="0">', act: btn('addObj', '新增', '', 'pri') }; } },
    circles: { name: '走法（繞圈）', rowId: function (c, i) { return 'c' + i; }, rows: function () { return me().world.walk.circles; },
      cols: [{ k: 'obj', h: '繞這個物件', v: function (c, i) { return '<select data-ed="circleObj" data-id="' + i + '">' + objOpts(c.object) + '</select>'; } }, { k: 'letter', h: '一圈是', v: function (c, i) { return '<select data-ed="circleLetter" data-id="' + i + '">' + 'JIHGFEDCBA'.split('').map(function (L) { return opt(L, L, c.letter); }).join('') + '</select>'; } }, { k: 'act', h: '動作', v: function (c, i) { return btn('delCircle', '刪', ' data-id="' + i + '"'); } }],
      add: function () { return { obj: '<select id="addCircleObj">' + objOpts('') + '</select>', letter: '<select id="addCircleLetter">' + 'JIHGFEDCBA'.split('').map(function (L) { return opt(L, L, 'J'); }).join('') + '</select>', act: btn('addCircle', '加一條', '', 'pri') }; }, empty: '還沒有繞圈的走法。' },
    moves: { name: '走法（走到）', rowId: function (m, i) { return 'm' + i; }, rows: function () { return me().world.walk.moves; },
      cols: [{ k: 'from', h: '從', v: function (m, i) { return '<select data-ed="moveFrom" data-id="' + i + '">' + objOpts(m.from) + '</select>'; } }, { k: 'to', h: '走到', v: function (m, i) { return '<select data-ed="moveTo" data-id="' + i + '">' + objOpts(m.to) + '</select>'; } }, { k: 'digit', h: '是數字', v: function (m, i) { return '<select data-ed="moveDigit" data-id="' + i + '">' + '0123456789'.split('').map(function (d) { return opt(d, d, m.digit); }).join('') + '</select>'; } }, { k: 'act', h: '動作', v: function (m, i) { return btn('delMove', '刪', ' data-id="' + i + '"'); } }],
      add: function () { var os = allObjs(me()); return { from: '<select id="addMoveFrom">' + objOpts(os[0].id) + '</select>', to: '<select id="addMoveTo">' + objOpts((os[1] || os[0]).id) + '</select>', digit: '<select id="addMoveDigit">' + '0123456789'.split('').map(function (d) { return opt(d, d, '1'); }).join('') + '</select>', act: btn('addMove', '加一條', '', 'pri') }; }, empty: '還沒有走到的走法。' },
    visit: { name: '我可以去找', rowId: function (r) { return r.serial; }, rows: function () { return CORE.canVisit(S(), me(), now()); }, cols: queryCols(), empty: '目前沒有我符合條件的人。' },
    come: { name: '可能來找我', rowId: function (r) { return r.serial; }, rows: function () { return CORE.canCome(S(), me(), now()); }, cols: queryCols(), empty: '目前沒有人符合我的條件。' },
    search: { name: '查資源', rowId: function (x) { return x.role.serial + ':' + x.resource.id; }, rows: function () { return CORE.searchResources(S(), UI.kw, now()).filter(function (x) { return x.role !== me(); }); },
      cols: [{ k: 'name', h: '資源', v: function (x) { return esc(x.resource.name); } }, { k: 'price', h: '價格', num: true, v: function (x) { return x.resource.price + ' ' + esc(x.role.name) + '點'; } }, { k: 'qty', h: '還有', num: true, v: function (x) { return String(x.resource.qty); } }, { k: 'who', h: '誰的', v: function (x) { return roleLink(x.role) + ' ' + stTag(x.role); } }, { k: 'act', h: '動作', v: function (x) { return btn('jump', '看規則', ' data-s="uses" data-id="' + x.role.serial + ':"') + ' ' + btn('jump', '去兌現', ' data-s="redeem" data-id="' + x.role.serial + ':"'); } }],
      add: function () { return { name: '<input type="text" id="kwIn" placeholder="關鍵字" value="' + esc(UI.kw) + '">', act: btn('search', '查', '', 'pri') }; }, empty: '沒有符合的資源。' },
    open: { name: '可預約時段', rowId: function (x) { return x.s.id; }, rows: function () { var out = []; S().roles.forEach(function (r) { if (r === me() || CORE.status(r, now()) === 'ended') return; r.slots.forEach(function (s) { if (s.atUs > now() && s.bookings.indexOf(me().serial) < 0 && s.bookings.length < s.capacity) out.push({ r: r, s: s }); }); }); return out.sort(function (a, b) { return a.s.atUs - b.s.atUs; }); },
      cols: [{ k: 'who', h: '主人', v: function (x) { return roleLink(x.r) + ' ' + stTag(x.r); } }, { k: 'at', h: '那一微秒', v: function (x) { return num(x.s.atUs); } }, { k: 'cap', h: '名額', v: function (x) { return x.s.bookings.length + '／' + x.s.capacity; } }, { k: 'give', h: '主人給', num: true, v: function (x) { return String(x.s.give); } }, { k: 'elig', h: '條件', v: function (x) { var e = CORE.eligible(S(), x.r, me(), now()); return e.ok ? tag('', e.how) : tag('bad', e.reason); }, wrap: true }, { k: 'act', h: '動作', v: function (x) { return CORE.eligible(S(), x.r, me(), now()).ok ? btn('book', '預約', ' data-id="' + x.s.id + '"', 'pri') : btn('jump', '看規則', ' data-s="conds" data-id="' + x.r.serial + ':"'); } }], empty: '目前沒有可以預約的時段。' },
    myslots: { name: '我開的時段', rowId: function (s) { return s.id; }, rows: function () { return me().slots.slice().sort(function (a, b) { return a.atUs - b.atUs; }); },
      cols: [
        { k: 'at', h: '那一微秒', v: function (s) { return num(s.atUs); } },
        { k: 'left', h: '還有', v: function (s) { var d = (s.atUs - now()) / 1e6; return d > 0 ? '<span class="num">' + d.toFixed(0) + ' 秒</span>' : tag('off', '已過'); } },
        { k: 'cap', h: '名額', num: true, v: function (s) { return s.bookings.length + '／' + s.capacity; } },
        { k: 'give', h: '每次給', num: true, v: function (s) { return String(s.give); } },
        { k: 'who', h: '預約的人', v: function (s) { var out = s.bookings.map(function (b) { var t = L('roles', b, esc(roleName(b))); if (s.docked.indexOf(b) >= 0) return t + ' ' + tag('', '已對接'); if (CORE.missed(s, b)) return t + ' ' + tag('bad', '錯過'); var c = CORE.canRefuse(S(), me(), roleOf(b), now()); return t + (c.ok ? ' ' + btn('refuse', '拒絕（做不到對方的要求）', ' data-id="' + s.id + '" data-who="' + b + '"') : ''); }); (s.refused || []).forEach(function (b) { out.push(L('roles', b, esc(roleName(b))) + ' ' + tag('bad', '已拒絕')); }); return out.length ? out.join('、') : dash; }, wrap: true },
        { k: 'act', h: '動作', v: function (s) { return s.atUs > now() && !s.bookings.length ? btn('delSlot', '刪', ' data-id="' + s.id + '"') : ''; } }
      ],
      add: function () { return { at: '<input type="number" class="kc" id="addSlotMin" value="3"> 分鐘後', cap: '<input type="number" class="kc" id="addSlotCap" value="1">', give: '<input type="number" class="kc" id="addSlotGive" value="100">', act: btn('addSlot', '開時段', '', 'pri') }; }, empty: '還沒開時段。' },
    booked: { name: '我預約的', rowId: function (x) { return x.slot.id; }, rows: function () { var out = []; S().roles.forEach(function (r) { if (r === me()) return; r.slots.forEach(function (s) { if (s.bookings.indexOf(me().serial) >= 0) out.push({ owner: r, slot: s }); }); }); return out.sort(function (a, b) { return a.slot.atUs - b.slot.atUs; }); },
      cols: [
        { k: 'who', h: '主人', v: function (x) { return roleLink(x.owner); } },
        { k: 'at', h: '那一微秒', v: function (x) { return num(x.slot.atUs); } },
        { k: 'st', h: '狀態', v: function (x) { var s = x.slot, d = (s.atUs - now()) / 1e6; return s.docked.indexOf(me().serial) >= 0 ? tag('', '已對接') : CORE.missed(s, me().serial) ? tag('bad', '錯過，不能再對接') : d > 0 ? '<span class="num">還有 ' + d.toFixed(0) + ' 秒</span>' : tag('wait', '判定中'); } },
        { k: 'present', h: '到場', v: function (x) { var s = x.slot, done = s.docked.indexOf(me().serial) >= 0 || CORE.missed(s, me().serial); return done ? '' : '<input type="checkbox" data-ed="present" data-id="' + s.id + '"' + (CORE.isPresent(S(), me().serial, s.id) ? ' checked' : '') + ' aria-label="到場">'; } },
        { k: 'give', h: '我給幾點', v: function (x) { var s = x.slot, done = s.docked.indexOf(me().serial) >= 0 || CORE.missed(s, me().serial); return done ? dash : '<input type="number" class="kc" data-ed="give" data-id="' + s.id + '" value="' + APP.giveFor(s.id) + '" min="0">'; } },
        { k: 'theirs', h: '主人給', num: true, v: function (x) { return String(x.slot.give); } },
        { k: 'contact', h: '聯絡方式', v: function (x) { return CORE.contactVisible(S(), x.owner, me().serial, now()) ? (x.owner.contact ? esc(x.owner.contact) : '<span class="muted">（沒填）</span>') : dash; } },
        { k: 'act', h: '動作', v: function (x) { var s = x.slot; return s.atUs > now() && s.docked.indexOf(me().serial) < 0 ? btn('cancelBook', '取消', ' data-id="' + s.id + '"') : ''; } }
      ], empty: '還沒預約任何時段。到「可預約時段」找。' },
    dockings: { name: '對接紀錄', rowId: function (d) { return d.id; }, rows: function () { return S().dockings.slice().reverse(); }, mine: function (d) { return d.a === me().serial || d.b === me().serial; },
      cols: [{ k: 'at', h: '時間', v: function (d) { return num(d.atUs); } }, { k: 'a', h: '主人', v: function (d) { return L('roles', d.a, esc(roleName(d.a))); } }, { k: 'b', h: '來的人', v: function (d) { return L('roles', d.b, esc(roleName(d.b))); } }, { k: 'ga', h: '主人給', num: true, v: function (d) { return String(d.gaveA); } }, { k: 'gb', h: '來的人給', num: true, v: function (d) { return String(d.gaveB); } }, { k: 'how', h: '怎麼通的', v: function (d) { return '<span class="small">' + esc(d.how || '') + '</span>'; }, wrap: true }], empty: '還沒有對接。' },
    points: { name: '點數', rowId: function (g) { return g.issuer.serial; }, rows: function () { return CORE.holdings(S(), me().serial, now()); },
      cols: [{ k: 'who', h: '發點的人', v: function (g) { return roleLink(g.issuer); } }, { k: 'n', h: '多少', num: true, v: function (g) { return String(g.amount); } }, { k: 'st', h: '狀態', v: function (g) { return stTag(g.issuer); } }, { k: 'end', h: '到期', v: function (g) { return '<span class="small num">' + esc(CORE.fmtUs(g.endUs).slice(0, 16)) + '</span>'; } }, { k: 'can', h: '能兌現嗎', v: function (g) { return g.status === 'active' ? tag('', '可以') : g.status === 'vacancy' ? tag('wait', '暫停') : tag('bad', '作廢'); } }, { k: 'act', h: '動作', v: function (g) { return g.status === 'active' ? btn('jump', '去兌現', ' data-s="redeem" data-id="' + g.issuer.serial + ':"', 'pri') : ''; } }],
      foot: function () { return '<div class="empty">我今天還能給 ' + CORE.remainingToday(S(), me(), now()) + ' / ' + me().dailyPoints + ' 點（隔天歸零）</div>'; }, empty: '手上沒有別人的點。' },
    redeem: { name: '兌現', who: true, rowId: function (x) { return 'rd' + x.id; }, rows: function () { var r = whoRole(); return r && r !== me() ? r.resources : []; },
      cols: [{ k: 'name', h: '資源', v: function (x) { return esc(x.name); } }, { k: 'price', h: '價格', num: true, v: function (x) { return String(x.price); } }, { k: 'qty', h: '還有', num: true, v: function (x) { return x.qty ? String(x.qty) : tag('bad', '0'); } }, { k: 'can', h: '換得到嗎', v: function (x) { var r = whoRole(), bal = CORE.balance(S(), me().serial, r.serial, now()), st = CORE.status(r, now()); return st !== 'active' ? tag('wait', STATUS[st] + '，暫停') : bal < x.price ? tag('off', '點不夠（差 ' + (x.price - bal) + '）') : x.qty < 1 ? tag('bad', '數量 0：換了會兌現失敗') : tag('', '可以'); } }, { k: 'act', h: '動作', v: function (x) { return btn('redeem', '兌現', ' data-id="' + x.id + '"', 'pri'); } }],
      foot: function () { var r = whoRole(); return r && r !== me() ? '<div class="empty">我有 ' + CORE.balance(S(), me().serial, r.serial, now()) + ' ' + esc(r.name) + '點</div>' : '<div class="empty">用上方「看誰」選一個發點的人。</div>'; }, empty: '他沒有列資源。' },
    records: { name: '紀錄', rowId: function (x, i) { return 'r' + i; }, rows: function () { return S().records.slice().reverse().concat(S().redeems.slice().reverse().map(function (x) { return { at: x.atUs, kind: x.ok ? 'redeem' : 'fail', text: roleName(x.holder) + ' 向 ' + roleName(x.issuer) + ' 兌現「' + x.name + '」' + (x.ok ? '，換到了' : '，失敗，主人進入空窗') }; })).sort(function (a, b) { return b.at - a.at; }); },
      cols: [{ k: 'at', h: '時間', v: function (x) { return num(x.at); } }, { k: 'kind', h: '種類', v: function (x) { return tag({ dock: '', miss: 'bad', refuse: 'bad', redeem: '', fail: 'bad' }[x.kind] || 'off', { dock: '對接', miss: '錯過', refuse: '拒絕', redeem: '兌現', fail: '兌現失敗' }[x.kind] || x.kind); } }, { k: 'text', h: '內容', v: function (x) { return esc(x.text); }, wrap: true }], empty: '還沒有紀錄。' },
    help: { name: '說明', help: true }
  };
  function queryCols() {
    return [
      { k: 'who', h: '角色', v: function (r) { return roleLink(r) + ' ' + stTag(r); } },
      { k: 'daily', h: '每天的點', num: true, v: function (r) { return String(r.dailyPoints); } },
      { k: 'days', h: '剩幾天', num: true, v: function (r) { return String(Math.floor(CORE.daysLeft(r, now()))); } },
      { k: 'slot', h: '最近時段', v: function (r) { var s = CORE.nextSlot(r, now()); return s ? L('open', s.id, esc(CORE.fmtUs(s.atUs).slice(5, 19)) + '（' + s.bookings.length + '／' + s.capacity + '）') : dash; } },
      { k: 'dock', h: '對接過', num: true, v: function (r) { return String(CORE.dockCount(S(), r.serial)); } },
      { k: 'elig', h: '能對接嗎', v: function (r) { var e = CORE.eligible(S(), r, me(), now()); return e.ok ? tag('', e.how) : tag('bad', e.reason); }, wrap: true },
      { k: 'act', h: '動作', v: function (r) { var e = CORE.eligible(S(), r, me(), now()); var free = r.slots.filter(function (x) { return x.atUs > now() && x.bookings.length < x.capacity && x.bookings.indexOf(me().serial) < 0; }).sort(function (a, b) { return a.atUs - b.atUs; })[0]; return btn('jump', '看規則', ' data-s="uses" data-id="' + r.serial + ':"') + (e.ok && free ? ' ' + btn('book', '預約', ' data-id="' + free.id + '"', 'pri') : ''); } }
    ];
  }
  var HELP = [
    ['待辦', '照目前的狀態列出六步，標出下一步；每列有按鈕跳過去。'],
    ['角色', '每天的能量點是角色最重要的屬性。創角色時寫下開始、結束；週期內規則表一個字都不能改，要改就「結束並重創」。最下面一列開始建角色（草稿），創角色後規則鎖住。'],
    ['規則用途、對接條件、開關與村規', '規則表三部分。條件是欄位、比較、數值，系統自動判斷通不通。兩個開關：要求兩方都通、對方一定要接受我的村規。看別人的用上方「看誰」。'],
    ['資源', '我的點能兌現的東西和價格。數量可以補；數量不夠而兌現失敗，會自動進入空窗。'],
    ['世界、走法', '功能固定、外觀自由；走法決定代號怎麼走。'],
    ['我可以去找、可能來找我、查資源', '規則表全部公開、條件固定格式，所以直接算出誰和我一方通。排序只照事實。'],
    ['可預約時段、我開的時段、我預約的', '對接一定在約好的那一微秒。條件通才約得到；名額是容量不是條件。空窗中的主人只在「做不到對方的要求」時能拒絕。「我預約的」勾「到場」等於站在對方終點上，那一微秒照規則層判定；沒勾就錯過，之後不能再對接。'],
    ['對接紀錄、點數、兌現、紀錄', '誰手上有誰的點；A 點對 A 自己沒用；發點的人結束，點作廢；空窗中暫停兌現。兌現失敗留下公開紀錄，主人自動進入空窗，補足並兌現欠的那一筆才解除。']
  ];

  /* ---------- 畫 ---------- */
  function renderTable(sk, T) {
    var cols = T.cols, rows = T.rows();
    var head = '<tr><th class="rn"></th>' + cols.map(function (c, i) { return '<th class="' + (i === 0 ? 'fz' : '') + (c.num ? ' n' : '') + '">' + esc(c.h) + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (r, i) {
      var id = T.rowId(r, i);
      return '<tr data-row data-id="' + esc(id) + '" class="' + (T.mine && T.mine(r) ? 'mine ' : '') + (T.cls ? T.cls(r) : '') + '"><td class="rn">' + (i + 1) + '</td>' + cols.map(function (c, ci) { return '<td class="' + (ci === 0 ? 'fz' : '') + (c.num ? ' n' : '') + (c.wrap ? ' wrap' : '') + '">' + c.v(r, i) + '</td>'; }).join('') + '</tr>';
    }).join('');
    var cells = T.add ? T.add() : null;
    if (cells) body += '<tr class="addrow"><td class="rn">＋</td>' + cols.map(function (c, ci) { return '<td class="' + (ci === 0 ? 'fz' : '') + '">' + (cells[c.k] != null ? cells[c.k] : '') + '</td>'; }).join('') + '</tr>';
    return '<table class="ws" data-sheet="' + sk + '"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>' + (!rows.length && T.empty ? '<div class="empty">' + esc(T.empty) + '</div>' : '') + (T.foot ? T.foot() : '');
  }
  function render() {
    if (APP.view() !== 'sheet') { return; }
    var sk = UI.sheet, T = SHEETS[sk];
    $('stitle').textContent = T.name;
    var w = $('swho');
    if (T.who) { var cur = isDraft() ? 'draft' : whoRole().serial; w.innerHTML = '看誰 <select data-ed="who" aria-label="看誰">' + (APP.draft() && sk !== 'world' && sk !== 'redeem' ? opt('draft', '（草稿）' + (APP.draft().name || '新角色'), cur) : '') + S().roles.map(function (r) { return opt(r.serial, roleName(r.serial), cur); }).join('') + '</select>'; w.hidden = false; }
    else w.hidden = true;
    var scroll = $('smain').scrollTop;
    if (T.help) $('smain').innerHTML = '<div class="help">' + HELP.map(function (h) { return '<h3>' + esc(h[0]) + '</h3><p>' + esc(h[1]) + '</p>'; }).join('') + '<p style="margin-top:16px">' + btn('resetAll', '全部還原成預設') + '</p></div>';
    else $('smain').innerHTML = renderTable(sk, T) + '<div class="empty" id="smsg" hidden></div>';
    renderTabs();
    $('sback').disabled = !UI.hist.length;
    if (UI.focus) focusRow(); else $('smain').scrollTop = render.last === sk ? scroll : 0;
    render.last = sk;
  }
  function renderTabs() {
    var h = '';
    GROUPS.forEach(function (g, gi) { if (gi) h += '<span class="sep"></span>'; g.keys.forEach(function (k) { h += '<a class="' + g.cls + '" data-act="go" data-s="' + k + '"' + (UI.sheet === k ? ' aria-current="page"' : '') + '>' + esc(SHEETS[k].name) + '</a>'; }); });
    $('stabs').innerHTML = h;
    var cur = $('stabs').querySelector('[aria-current]'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function focusRow() {
    var id = UI.focus; UI.focus = null;
    var tr = document.querySelector('.ws tr[data-row][data-id="' + CSS.escape(id) + '"]');
    if (!tr) return;
    tr.scrollIntoView({ block: 'center' });
    tr.classList.remove('flash'); void tr.offsetWidth; tr.classList.add('flash');
  }
  function smsg(t) { var el = $('smsg'); if (!el) return; el.textContent = t; el.hidden = !t; }
  function navigate(sheet, id) {
    if (!SHEETS[sheet]) return;
    UI.hist.push({ sheet: UI.sheet, who: UI.who }); if (UI.hist.length > 60) UI.hist.shift();
    UI.sheet = sheet; UI.focus = id || null;
    if (id && id.indexOf(':') > 0) { var whoS = id.split(':')[0], rest = id.split(':')[1]; UI.who = whoS; if (sheet === 'world') { var r = whoRole() || me(); var hit = rest && CORE.allObjects(r.world).find(function (x) { return x.o.id === rest; }); UI.worldPath = hit ? hit.path : []; } if (!rest) UI.focus = null; }
    APP.setFocus({ role: SHEETS[sheet].who && whoRole() ? whoRole().serial : me().serial, func: { uses: 'rule', conds: 'rule', switches: 'rule', resources: 'resource', redeem: 'resource', myslots: 'goal', open: 'goal', booked: 'goal', roles: 'role', world: 'build', circles: 'build', moves: 'build', visit: 'map', come: 'map', search: 'map', points: 'points' }[sheet] || null });
    render();
  }
  function back() { var h = UI.hist.pop(); if (!h) return; UI.sheet = h.sheet; UI.who = h.who; UI.focus = null; render(); }

  /* ---------- 動作 ---------- */
  function run(fn, ok) { var r = APP.run(fn, ok); render(); if (r.msg) smsg(r.msg); return r; }
  var v = function (id) { var el = $(id); return el ? el.value : ''; };
  var ACT = {
    go: function (b) { navigate(b.dataset.s, null); },
    jump: function (b) { navigate(b.dataset.s, b.dataset.id || null); },
    resetAll: function () { APP.resetAll(); },
    search: function () { UI.kw = v('kwIn'); render(); },
    newDraft: function () { run(function () { var n = v('addRoleName').trim(); if (!n) throw new Error('先寫名字'); APP.startDraft({ name: n, dailyPoints: Math.floor(+v('addRoleDaily')) || 1800, days: Math.floor(+v('addRoleDays')) || 30 }); UI.who = 'draft'; }); navigate('uses', 'draft:'); },
    dropDraft: function () { run(function () { APP.dropDraft(); UI.who = null; }); },
    createRole: function () { var r = run(function () { return APP.createFromDraft(); }, '創好了，規則表從現在起鎖住'); if (r.ok) { UI.who = null; navigate('roles', r.value.serial); } },
    endEarly: function (b) { run(function () { APP.endEarly(b.dataset.id); UI.who = 'draft'; }, '角色結束了，草稿帶著原本的規則，改好再創'); navigate('uses', 'draft:'); },
    recreate: function (b) { run(function () { APP.draftFrom(roleOf(b.dataset.id)); UI.who = 'draft'; }); navigate('uses', 'draft:'); },
    vacIn: function (b) { run(function () { CORE.enterVacancy(S(), b.dataset.id, now()); }, '進入空窗：每天的點停發、別人手上的點暫停兌現'); },
    vacOut: function (b) { run(function () { CORE.leaveVacancy(S(), b.dataset.id, now()); }, '離開空窗了'); },
    accept: function (b) { run(function () { CORE.accept(S(), me().serial, b.dataset.id); }, '接受了'); },
    addUse: function () { run(function () { var t = v('addUse').trim(); if (!t) throw new Error('先寫內容'); draftRules().uses.push(t); }); },
    delUse: function (b) { run(function () { draftRules().uses.splice(+b.dataset.id, 1); }); },
    addCond: function () { run(function () { var f = v('addCondField'), fd = CORE.COND_FIELDS[f]; draftRules().conditions.push(fd.enum ? { field: f, op: '=', value: Object.keys(fd.enum)[0] } : { field: f, op: v('addCondOp'), value: +v('addCondValue') || 0 }); }); },
    delCond: function (b) { run(function () { draftRules().conditions.splice(+b.dataset.id, 1); }); },
    addRes: function () { run(function () { var n = v('addResName').trim(); if (!n) throw new Error('先寫資源名稱'); APP.draft().resources.push({ name: n, price: Math.floor(+v('addResPrice')) || 1, qty: Math.floor(+v('addResQty')) || 0 }); }); },
    delRes: function (b) { run(function () { APP.draft().resources.splice(+b.dataset.id, 1); }); },
    restock: function (b) { run(function () { CORE.restock(S(), me().serial, b.dataset.id, 1); }, '補了 1 份'); },
    worldIn: function (b) { UI.worldPath.push(b.dataset.id); render(); },
    addObj: function () { run(function () { var r = whoRole() || me(), n = v('addObjName').trim(); if (!n) throw new Error('先寫名稱'); var id = 'o' + Date.now().toString(36); levelObjects().push({ id: id, name: n, func: 'none', pos: [+v('addObjX') || 0, +v('addObjZ') || 0], look: v('addObjLook') || '山', parts: CORE.look(v('addObjLook') || '山', v('addObjColor') || '#8A8F96') }); UI.focus = r.serial + ':' + id; }, '新增了地標'); },
    delObj: function (b) { run(function () { var r = whoRole() || me(), id = b.dataset.id, lv = levelObjects(); if (!UI.worldPath.length && lv.length <= 1) throw new Error('至少留一個物件'); var gone = {}, o0 = lv.find(function (o) { return o.id === id; }); if (o0) CORE.allObjects({ objects: [o0] }).forEach(function (x) { gone[x.o.id] = true; }); lv.splice(lv.indexOf(o0), 1); r.world.walk.circles = r.world.walk.circles.filter(function (c) { return !gone[c.object]; }); r.world.walk.moves = r.world.walk.moves.filter(function (m) { return !gone[m.from] && !gone[m.to]; }); }, '刪掉了，用到它的走法也一起刪'); },
    addCircle: function () { run(function () { me().world.walk.circles.push({ object: v('addCircleObj'), letter: v('addCircleLetter') || 'J' }); }); },
    delCircle: function (b) { run(function () { me().world.walk.circles.splice(+b.dataset.id, 1); }); },
    addMove: function () { run(function () { if (v('addMoveFrom') === v('addMoveTo')) throw new Error('從和走到要不同'); me().world.walk.moves.push({ from: v('addMoveFrom'), to: v('addMoveTo'), digit: v('addMoveDigit') || '1' }); }); },
    delMove: function (b) { run(function () { me().world.walk.moves.splice(+b.dataset.id, 1); }); },
    addSlot: function () { run(function () { var min = +v('addSlotMin'); if (!(min >= 1)) throw new Error('幾分鐘後要至少 1'); var s = CORE.addSlot(S(), me().serial, now() + min * 60e6 + Math.floor(Math.random() * 1000), v('addSlotCap'), v('addSlotGive'), now()); UI.focus = s.id; }, '開了時段'); },
    delSlot: function (b) { run(function () { me().slots = me().slots.filter(function (s) { return s.id !== b.dataset.id; }); }); },
    book: function (b) { var r = run(function () { return CORE.book(S(), me().serial, b.dataset.id, now()); }, '預約好了。到時候在「我預約的」勾到場，那一微秒就對接。'); if (r.ok) navigate('booked', r.value.id); },
    cancelBook: function (b) { run(function () { CORE.cancelBooking(S(), me().serial, b.dataset.id); }, '取消了'); },
    refuse: function (b) { run(function () { CORE.refuse(S(), me().serial, b.dataset.id, b.dataset.who, now()); }, '拒絕了，留下紀錄'); },
    redeem: function (b) { run(function () { var r = whoRole(); CORE.redeem(S(), me().serial, r.serial, b.dataset.id, now()); }, '換到了'); }
  };
  var EDIT = {
    me: function (id) { APP.becomeMe(S().roles.indexOf(roleOf(id))); },
    who: function (id, val) { UI.who = val; UI.worldPath = []; APP.setFocus({ role: val === 'draft' ? me().serial : val }); },
    useText: function (id, val) { draftRules().uses[+id] = val; },
    condField: function (id, val) { var c = draftRules().conditions[+id], fd = CORE.COND_FIELDS[val]; c.field = val; if (fd.enum) { c.op = '='; c.value = Object.keys(fd.enum)[0]; } else if (typeof c.value !== 'number') { c.value = 0; c.op = '>='; } },
    condOp: function (id, val) { draftRules().conditions[+id].op = val; },
    condValue: function (id, val) { var c = draftRules().conditions[+id]; c.value = CORE.COND_FIELDS[c.field].enum ? val : +val; },
    switch: function (id, val, el) { draftRules()[id] = !!el.checked; },
    village: function (id, val) { draftRules().village = val; },
    draftDaily: function (id, val) { APP.draft().dailyPoints = Math.floor(+val) || 1; },
    draftDays: function (id, val) { APP.draft().days = Math.floor(+val) || 1; },
    draftContact: function (id, val) { APP.draft().contact = val; },
    resName: function (id, val) { APP.draft().resources[+id].name = val; },
    resPrice: function (id, val) { APP.draft().resources[+id].price = Math.floor(+val) || 1; },
    resQty: function (id, val) { APP.draft().resources[+id].qty = Math.floor(+val) || 0; },
    objName: function (id, val) { objEdit(id, function (o) { o.name = val; }); },
    objFunc: function (id, val) { objEdit(id, function (o) { o.func = val; }); },
    objX: function (id, val) { objEdit(id, function (o) { o.pos[0] = +val || 0; }); },
    objZ: function (id, val) { objEdit(id, function (o) { o.pos[1] = +val || 0; }); },
    objLook: function (id, val) { objEdit(id, function (o) { if (val) { o.look = val; o.parts = CORE.look(val, o.parts[0] ? o.parts[0].color : '#999999'); } else o.look = ''; }); },
    objColor: function (id, val) { objEdit(id, function (o) { if (o.look) o.parts = CORE.look(o.look, val); else if (o.parts[0]) o.parts[0].color = val; }); },
    objDoor: function (id, val) { objEdit(id, function (o) { if (!val) delete o.door; else if (o.door) o.door.visible = val; else o.door = { visible: val, start: [0, 4], objects: [] }; }); },
    circleObj: function (id, val) { me().world.walk.circles[+id].object = val; },
    circleLetter: function (id, val) { me().world.walk.circles[+id].letter = val; },
    moveFrom: function (id, val) { me().world.walk.moves[+id].from = val; },
    moveTo: function (id, val) { me().world.walk.moves[+id].to = val; },
    moveDigit: function (id, val) { me().world.walk.moves[+id].digit = val; },
    present: function (id, val, el) { CORE.setPresent(S(), me().serial, id, el.checked); },
    give: function (id, val) { APP.setGive(id, +val); }
  };
  function objEdit(id, fn) { var o = levelObjects().find(function (x) { return x.id === id; }); if (o) fn(o); }
  var busy = false;
  $('view-sheet').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || !ACT[b.dataset.act] || busy) return;
    busy = true; try { ACT[b.dataset.act](b); } finally { busy = false; }
  });
  $('view-sheet').addEventListener('change', function (e) {
    var t = e.target; if (!t.dataset || !t.dataset.ed || !EDIT[t.dataset.ed] || busy) return;
    busy = true;
    try { try { EDIT[t.dataset.ed](t.dataset.id, t.value, t); APP.changed(); } catch (err) { smsg(err.message); return; } if (t.dataset.ed !== 'me') render(); }
    finally { busy = false; }
  });
  $('sback').addEventListener('click', back);
  $('swapToGame').addEventListener('click', function () { APP.switchTo('game'); });

  /* ---------- 進出表世界：切換時停在同一件事上 ---------- */
  var FUNC_SHEET = { rule: 'uses', resource: 'resources', goal: 'open', role: 'roles', points: 'points', map: 'visit', build: 'world', none: 'world' };
  function show() {
    var f = APP.focus();
    if (f.func && FUNC_SHEET[f.func]) {
      var sk = FUNC_SHEET[f.func];
      if (f.role && f.role !== me().serial) { if (sk === 'open') { /* 別人的終點：可預約時段 */ } else if (sk === 'points') sk = 'points'; else if (sk === 'resources') sk = 'resources'; UI.who = f.role; } else { UI.who = null; if (sk === 'open') sk = 'myslots'; }
      UI.sheet = sk;
    }
    render();
  }
  APP.on('view', function (v) { $('view-sheet').hidden = v !== 'sheet'; if (v === 'sheet') show(); });
  APP.on('change', function () { if (APP.view() === 'sheet') render(); });
  APP.on('me', function () { UI.who = null; UI.hist = []; if (APP.view() === 'sheet') render(); });
  APP.on('dock', function (r) { if (APP.view() === 'sheet') { render(); smsg(r.ok ? '對接成立：' + r.owner.name + ' 給 ' + r.docking.gaveA + ' 點，你給 ' + r.docking.gaveB + ' 點（' + r.docking.how + '）' : '對接不成立：' + r.error); } });
  APP.on('miss', function () { if (APP.view() === 'sheet') { render(); smsg('那一微秒過了，沒到場的預約標為錯過。'); } });
  renderTabs();
  return { render: render, navigate: navigate, back: back, ui: UI, ORDER: ORDER, SHEETS: SHEETS, show: show };
})();
