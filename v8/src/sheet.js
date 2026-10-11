/* ===== v8 表世界：簡單的 Excel =====
 * 沒有 3D、沒有 HUD。一張工作表只放一張表；表頭是欄位名稱、左邊列號、第一欄凍結；按鈕在格子裡；
 * 代號、功能點、時段、點數是連結，跳到對應那一列並閃一下；「←」返回。只呼叫 APP 和 CORE。
 */
var SHEET = (function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = APP.esc, opt = APP.opt, now = APP.now;
  var S = function () { return APP.state(); }, me = function () { return APP.me(); };
  var allObjs = APP.allObjs;
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
  var ver = APP.ver, pend = APP.pend;
  var roleName = function (serial) { var r = roleOf(serial); return r ? CORE.abbrev(serial) + ' ' + r.name : serial; };
  function L(sheet, id, text) { return '<button type="button" class="lk" data-act="jump" data-s="' + sheet + '" data-id="' + esc(id) + '">' + text + '</button>'; }
  function btn(act, label, attrs, cls) { return '<button type="button" class="btn sm' + (cls ? ' ' + cls : '') + '" data-act="' + act + '"' + (attrs || '') + '>' + esc(label) + '</button>'; }
  function inp(ed, id, value, extra) { return '<input type="text" data-ed="' + ed + '" data-id="' + esc(id) + '" value="' + esc(value) + '"' + (extra || '') + '>'; }
  function roleLink(r) { return L('roles', r.serial, esc(roleName(r.serial))); }
  // 「看誰」：規則、資源、時段、世界預設看自己
  function whoRole() { return roleOf(UI.who) || me(); }
  function isMine() { return whoRole() === me(); }
  // 自己的規則、資源：表裡顯示的是「明天起」的版本（沒有就等於今天的），改了存成明天起
  function tmr() { return CORE.tomorrow(S(), me().serial, now()); }
  function editing() { return isMine() ? (pend(me()) || ver(me())) : ver(whoRole()); }
  function sameAs(todayVal, v) { return JSON.stringify(todayVal) === JSON.stringify(v); }
  function stateTag(todayVal, v) { return sameAs(todayVal, v) ? tag('', '今天') : tag('wait', '明天起'); }
  function levelObjects() { var r = whoRole(), lv = r.world.objects; for (var i = 0; i < UI.worldPath.length; i++) { var o = lv.find(function (x) { return x.id === UI.worldPath[i]; }); if (!o || !o.door) { UI.worldPath = UI.worldPath.slice(0, i); break; } lv = o.door.objects; } return lv; }
  function objOpts(sel) { return CORE.allObjects(me().world).map(function (x) { return opt(x.o.id, (x.depth ? '　'.repeat(x.depth) + '└ ' : '') + x.o.name, sel); }).join(''); }
  var condSel = function (ed, i, c) { return { field: '<select data-ed="' + ed + 'Field" data-id="' + i + '">' + Object.keys(CORE.COND_FIELDS).map(function (k) { return opt(k, CORE.COND_FIELDS[k].label, c.field); }).join('') + '</select>', op: '<select data-ed="' + ed + 'Op" data-id="' + i + '">' + Object.keys(CORE.OPS).map(function (o) { return opt(o, CORE.OPS[o], c.op); }).join('') + '</select>', value: '<input type="number" class="kc" data-ed="' + ed + 'Value" data-id="' + i + '" value="' + c.value + '">' }; };
  function keepText(x) { return x.keepDays == null ? '一直' : x.keepDays + ' 天'; }
  // 「我要他的」：在格子裡用 ＋／− 選，顯示合計
  function wantsCell(slot, other) {
    var o = roleOf(other); if (!o) return dash;
    var v = CORE.version(o, slot.atUs), picked = CORE.wantsValid(S(), slot, me().serial, other);
    var gone = CORE.goneText(S(), slot, me().serial, other), goneLine = gone ? '<span class="small muted">' + esc(gone) + '</span><br>' : '';
    if (slot.judged) return goneLine + (picked.length ? esc(picked.map(function (id) { var x = CORE.resourceOf(v, id); return x ? x.name : id; }).join('、')) + '（' + CORE.wantTotal(S(), slot, me().serial, other) + ' 點）' : dash);
    return goneLine + (picked.length ? '' : '<span class="small muted">你還沒選他的東西：一換一，兩邊都選了才成交</span><br>') + '<div class="small">' + v.resources.map(function (x) { var n = picked.filter(function (id) { return id === x.id; }).length; return esc(x.name) + ' ' + x.price + '點 ' + btn('wantSub', '−', ' data-slot="' + slot.id + '" data-other="' + other + '" data-res="' + x.id + '"' + (n ? '' : ' disabled')) + ' <b>' + n + '</b> ' + btn('wantAdd', '＋', ' data-slot="' + slot.id + '" data-other="' + other + '" data-res="' + x.id + '"'); }).join('<br>') + '<br>合計 <b>' + CORE.wantTotal(S(), slot, me().serial, other) + '</b> ' + esc(o.name) + '點</div>';
  }
  function theirsCell(slot, other) { var ids = CORE.wantsValid(S(), slot, other, me().serial), v = CORE.version(me(), slot.atUs), gone = CORE.goneText(S(), slot, other, me().serial); return (ids.length ? esc(ids.map(function (id) { var x = CORE.resourceOf(v, id); return x ? x.name : id; }).join('、')) + '（' + CORE.wantTotal(S(), slot, other, me().serial) + ' 點）' : '<span class="muted">（沒選）</span>' + (slot.judged ? '' : '<br><span class="small muted">他還沒選你的東西：一換一，兩邊都選了才成交</span>')) + (gone ? '<br><span class="small muted">' + esc(gone) + '</span>' : ''); }
  function maxGiveCell(slot) { if (slot.judged) return slot.maxGive[me().serial] != null ? String(slot.maxGive[me().serial]) : '當天剩下的'; return '<input type="number" class="kc" data-ed="maxGive" data-id="' + slot.id + '" value="' + (slot.maxGive[me().serial] != null ? slot.maxGive[me().serial] : '') + '" placeholder="剩下的" min="0">'; }

  /* ---------- 工作表：每張一張表 ---------- */
  var SHEETS = {
    todo: { name: '待辦', rowId: function (x) { return x.id; }, rows: function () { return APP.steps().rows; }, cls: function (x) { var n = APP.steps().next; return n && n.id === x.id ? 'next' : ''; },
      cols: [
        { k: 'no', h: '步驟', v: function (x) { return x.no + ' ' + esc(x.name); } },
        { k: 'ok', h: '狀態', v: function (x) { var n = APP.steps().next; return x.ok ? tag('', '完成') : n && n.id === x.id ? tag('wait', '下一步') : tag('off', '還沒'); } },
        { k: 'go', h: '動作', v: function (x) { var isNext = (APP.steps().next || {}).id === x.id;
          if (x.tut === 'ask') return btn('tutYes', '要', '', 'pri') + ' ' + btn('tutNo', '不要');
          if (x.tut === 'cmp') return btn('jump', '去看', ' data-s="' + x.func + '"' + (x.who ? ' data-id="' + x.who + ':"' : '')) + (isNext ? ' ' + btn('tutNext', x.last ? '看完，切回裡世界' : '下一個', '', 'pri') : '');
          if (x.tut === 'step') return btn('jump', '去做', ' data-s="' + x.func + '"' + (x.who && x.func !== 'open' ? ' data-id="' + x.who + ':"' : ''), isNext ? 'pri' : '');
          var to = { role: 'roles', rule: 'uses', resource: 'resources', build: 'world', goal: 'myslots', map: 'visit' }[x.func]; return btn('jump', (x.name.charAt(0) === '去' ? x.name : '去' + x.name), ' data-s="' + to + '"', isNext ? 'pri' : ''); } },
        { k: 'st', h: '目前', v: function (x) { return '<span class="small">' + esc(x.status) + '</span>'; }, wrap: true }
      ], foot: function () { var st = APP.steps(); return st.tutorial === 'step' ? '<div class="empty">新手教學：跟引路人用「空的」換「空的」，兩邊都不損失，把流程走一遍。在哪個世界，就講那個世界的做法；切換過去也從同一步接著走。 ' + btn('tutSkip', '跳過教學', '', 'warn') + '</div>' : st.tutorial === 'ask' ? '<div class="empty">教學走完了！要不要用另一種介面再走一次？</div>' : st.tutorial === 'compare' ? '<div class="empty">帶看對照：剛才那筆交換在這邊的哪裡。看完切回裡世界。</div>' : ''; } },
    roles: { name: '角色', rowId: function (r) { return r.serial; }, rows: function () { return S().roles; }, mine: function (r) { return r === me(); },
      cols: [
        { k: 'me', h: '我是', v: function (r) { return '<input type="radio" name="meIs" data-ed="me" data-id="' + r.serial + '"' + (r === me() ? ' checked' : '') + ' aria-label="我是"> ' + (r === me() ? '我' : ''); } },
        { k: 'code', h: '代號', v: function (r) { return '<b>' + CORE.abbrev(r.serial) + '</b> ' + esc(r.name); } },
        { k: 'daily', h: '每天的點', num: true, v: function (r) { var v = ver(r), p = pend(r); return String(v.dailyPoints) + (p && p.dailyPoints !== v.dailyPoints ? ' <span class="small">明天起 ' + p.dailyPoints + '</span>' : ''); } },
        { k: 'tmr', h: '明天起（改）', v: function (r) { if (r !== me()) return dash; var p = pend(r); return '<input type="number" class="kc" data-ed="daily" data-id="' + r.serial + '" value="' + (p ? p.dailyPoints : ver(r).dailyPoints) + '" min="1">'; } },
        { k: 'left', h: '今天還能給', num: true, v: function (r) { return String(CORE.remainingToday(S(), r, now())); } },
        { k: 'ratio', h: '換點比例', v: function (r) { return '<span class="small">' + esc(CORE.ratio(S(), r.serial).text) + '</span>'; } },
        { k: 'dock', h: '對接過', num: true, v: function (r) { return String(CORE.dockCount(S(), r.serial)); } },
        { k: 'avail', h: '可換的貨', num: true, v: function (r) { return String(CORE.availTotal(r, now())); } },
        { k: 'rules', h: '規則', v: function (r) { var v = ver(r); return L('uses', r.serial + ':', v.rules.uses.length + ' 用途 ' + v.rules.conditions.length + ' 條件') + (pend(r) ? ' ' + tag('wait', '明天起有改') : ''); } },
        { k: 'res', h: '資源', v: function (r) { return L('resources', r.serial + ':', ver(r).resources.length + ' 項'); } },
        { k: 'contact', h: '聯絡方式', v: function (r) { return CORE.contactVisible(S(), r, me().serial) ? (r.contact ? esc(r.contact) : '<span class="muted">（沒填）</span>') : '<span class="muted">預約成功才看得到</span>'; } },
        { k: 'act', h: '動作', v: function (r) { if (r !== me()) return ''; var bl = CORE.quitBlockers(S(), r.serial, now()); return btn('quit', '不玩了' + (bl.length ? '（' + bl.length + ' 筆會作廢）' : ''), ' data-id="' + r.serial + '"', 'warn'); } }
      ],
      // 還沒創角色：最下面一列是創角色（名字、每天的點、第一樣東西「空的」）；按「建立」當下生效
      add: function () { return APP.isBlank() ? { me: '<span class="small muted">創角色</span>', code: '<input type="text" id="sName" value="我" style="width:6em" aria-label="名字">', daily: '<input type="number" class="kc" id="sDaily" value="' + CORE.DEFAULT_DAILY + '" min="1">', res: '<span class="small">第一樣東西 <input type="text" id="sItem" value="空的" style="width:4em"> 價 <input type="number" class="kc" id="sPrice" value="0" min="0"> 補 <input type="number" class="kc" id="sQty" value="1" min="0"> 份</span>', act: btn('createMe', '建立', '', 'pri') + ' ' + btn('createSkip', '建立，跳過教學') } : null; },
      foot: function () { return APP.isBlank() ? '<div class="empty">還沒創角色。填最下面一列，按「建立」。0 點的「空的」什麼都不給：一換一時想只收不給就拿它。</div>' : ''; } },
    uses: { name: '規則用途', who: true, rowId: function (x, i) { return 'u' + i; }, rows: function () { return editing().rules.uses; },
      cols: [{ k: 'text', h: '我的點能做什麼', v: function (x, i) { return isMine() ? inp('useText', i, x) : esc(x); }, wrap: true }, { k: 'st', h: '狀態', v: function (x, i) { var t = ver(whoRole()).rules.uses; return isMine() ? stateTag(t[i], x) : ''; } }, { k: 'act', h: '動作', v: function (x, i) { return isMine() ? btn('delUse', '刪', ' data-id="' + i + '"') : ''; } }],
      add: function () { return isMine() ? { text: '<input type="text" id="addUse" placeholder="例如：1 我點 = 陪跑 1 分鐘">', st: '<span class="small muted">加了明天起</span>', act: btn('addUse', '加一條', '', 'pri') } : null; }, foot: otherPendingFoot, empty: '（沒寫）' },
    conds: { name: '對接條件', who: true, rowId: function (x, i) { return 'c' + i; }, rows: function () { return editing().rules.conditions; },
      cols: [
        { k: 'field', h: '欄位', v: function (c, i) { return isMine() ? condSel('cond', i, c).field : esc(CORE.COND_FIELDS[c.field].label); } },
        { k: 'op', h: '比較', v: function (c, i) { return isMine() ? condSel('cond', i, c).op : esc(CORE.OPS[c.op]); } },
        { k: 'value', h: '數值', v: function (c, i) { return isMine() ? condSel('cond', i, c).value : esc(String(c.value)); } },
        { k: 'plain', h: '白話', v: function (c) { return '<span class="small">' + esc(CORE.condText(c)) + '</span>'; }, wrap: true },
        { k: 'st', h: '狀態', v: function (c, i) { var t = ver(whoRole()).rules.conditions; return isMine() ? stateTag(t[i], c) : ''; } },
        { k: 'me', h: '我通不通', v: function (c) { if (isMine()) return ''; var ok = CORE.passes(S(), { versions: [{ fromDay: -1e9, rules: { conditions: [c] } }] }, me(), now()).ok; return ok ? tag('', '通') : tag('bad', '不通'); } },
        { k: 'act', h: '動作', v: function (c, i) { return isMine() ? btn('delCond', '刪', ' data-id="' + i + '"') : ''; } }
      ],
      add: function () { return isMine() ? { field: '<select id="addCondField">' + Object.keys(CORE.COND_FIELDS).map(function (k) { return opt(k, CORE.COND_FIELDS[k].label, 'avail'); }).join('') + '</select>', op: '<select id="addCondOp">' + Object.keys(CORE.OPS).map(function (o) { return opt(o, CORE.OPS[o], '>='); }).join('') + '</select>', value: '<input type="number" class="kc" id="addCondValue" value="1">', act: btn('addCond', '加一條', '', 'pri') } : null; }, foot: otherPendingFoot, empty: '沒有條件，誰都通。' },
    switches: { name: '開關與村規', who: true, rowId: function (x) { return x.k; }, rows: function () { var ru = editing().rules, r = whoRole(); return [{ k: 'bothMustPass', name: '要求兩方都通', v: ru.bothMustPass }, { k: 'mustAcceptVillage', name: '對方一定要接受我的村規', v: ru.mustAcceptVillage }, { k: 'village', name: '村規', v: ru.village, r: r }]; },
      cols: [
        { k: 'name', h: '項目', v: function (x) { return esc(x.name); } },
        { k: 'v', h: '設定', v: function (x) { if (x.k === 'village') return isMine() ? '<textarea data-ed="village" data-id="v">' + esc(x.v) + '</textarea>' : (x.v ? esc(x.v) : dash); return isMine() ? '<input type="checkbox" data-ed="switch" data-id="' + x.k + '"' + (x.v ? ' checked' : '') + '>' : (x.v ? tag('wait', '開') : tag('off', '關')); }, wrap: true },
        { k: 'st', h: '狀態', v: function (x) { return isMine() ? stateTag(ver(me()).rules[x.k], x.v) : ''; } },
        { k: 'act', h: '動作', v: function (x) { if (x.k !== 'village' || isMine() || !x.r || !x.v) return ''; var st = CORE.acceptState(S(), me().serial, x.r, now()), ch = CORE.villageChanges(x.r, now()) ? '<br><span class="small muted">明天起村規改了，到時候要重新接受</span>' : ''; return (st === 'current' ? tag('', '你已接受') : (st === 'old' ? '<span class="small">你接受的是舊版村規，要重新接受</span> ' : '') + btn('accept', '接受他的村規', ' data-id="' + x.r.serial + '"', 'pri')) + ch; }, wrap: true }
      ], foot: otherPendingFoot },
    resources: { name: '資源', who: true, rowId: function (x) { return whoRole().serial + ':' + x.id; }, rows: function () { if (isMine()) return editing().resources; var r = whoRole(), v = ver(r), p = pend(r), out = v.resources.slice(); if (p) p.resources.forEach(function (y) { if (!CORE.resourceOf(v, y.id)) out.push(Object.assign({}, y, { _new: true })); }); return out; },
      cols: [
        { k: 'name', h: '資源', v: function (x) { return isMine() ? inp('resName', x.id, x.name) : esc(x.name); } },
        { k: 'def', h: '定義', v: function (x) { return isMine() ? inp('resDef', x.id, x.def || '') : (x.def ? esc(x.def) : dash); }, wrap: true },
        { k: 'price', h: '價格（點）', num: true, v: function (x) { return isMine() ? '<input type="number" class="kc" data-ed="resPrice" data-id="' + x.id + '" value="' + x.price + '">' : String(x.price); } },
        { k: 'keep', h: '保留天數', v: function (x) { return isMine() ? '<input type="number" class="kc" data-ed="resKeep" data-id="' + x.id + '" value="' + (x.keepDays == null ? '' : x.keepDays) + '" placeholder="一直">' : esc(keepText(x)); } },
        { k: 'st', h: '狀態', v: function (x) { if (!isMine()) return ''; var t = CORE.resourceOf(ver(me()), x.id); return t ? stateTag(t, x) : tag('wait', '明天起新增'); } },
        { k: 'tmr', h: '明天起', v: function (x) { if (isMine()) return ''; if (x._new) return tag('wait', '明天起新增'); var ch = resChange(x, pend(whoRole())); return ch ? tag('wait', ch) : ''; }, wrap: true },
        { k: 'avail', h: '可換', num: true, v: function (x) { if (x._new) return dash; var st = CORE.stockOf(whoRole(), x.id); return String(st.avail) + (isMine() ? ' <input type="number" class="kc" id="stockN_' + x.id + '" value="1" min="1" aria-label="數量"> ' + btn('stock', '補', ' data-id="' + x.id + '" data-n="1"') + ' ' + btn('stock', '減', ' data-id="' + x.id + '" data-n="-1"') : ''); } },
        { k: 'reserved', h: '已保留', num: true, v: function (x) { return isMine() ? String(CORE.stockOf(me(), x.id).reserved) : dash; } },
        { k: 'act', h: '動作', v: function (x) { if (isMine()) return btn('delRes', '下架（明天起）', ' data-id="' + x.id + '"'); if (x._new) return ''; return btn('jump', '去兌現', ' data-s="redeem" data-id="' + whoRole().serial + ':"', 'pri'); } }
      ],
      add: function () { return isMine() ? { name: '<input type="text" id="addResName" placeholder="例如：陪跑一小時">', def: '<input type="text" id="addResDef" placeholder="定義">', price: '<input type="number" class="kc" id="addResPrice" value="60">', keep: '<input type="number" class="kc" id="addResKeep" value="" placeholder="一直">', st: '<span class="small muted">上架明天起</span>', act: btn('addRes', '上架', '', 'pri') } : null; }, foot: function () { var f = otherPendingFoot(); return (f || '') + (isMine() ? '<div class="empty">種類、定義、價格、保留天數改了明天起生效；可換的數量馬上生效。</div>' : ''); }, empty: '沒有資源。' },
    world: { name: '世界', who: true, rowId: function (o) { return whoRole().serial + ':' + o.id; }, rows: function () { return levelObjects(); },
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
      cols: [{ k: 'name', h: '資源', v: function (x) { return esc(x.resource.name); } }, { k: 'price', h: '價格', num: true, v: function (x) { return x.resource.price + ' ' + esc(x.role.name) + '點'; } }, { k: 'avail', h: '可換', num: true, v: function (x) { return String(x.stock.avail); } }, { k: 'keep', h: '保留', v: function (x) { return esc(keepText(x.resource)); } }, { k: 'who', h: '誰的', v: function (x) { return roleLink(x.role); } }, { k: 'act', h: '動作', v: function (x) { return btn('jump', '看規則', ' data-s="uses" data-id="' + x.role.serial + ':"') + ' ' + btn('jump', '可預約時段', ' data-s="open"'); } }],
      add: function () { return { name: '<input type="text" id="kwIn" placeholder="關鍵字" value="' + esc(UI.kw) + '">', act: btn('search', '查', '', 'pri') }; }, empty: '沒有符合的資源。' },
    open: { name: '可預約時段', rowId: function (x) { return x.s.id; }, rows: function () { var out = []; S().roles.forEach(function (r) { if (r === me()) return; r.slots.forEach(function (s) { if (s.atUs > now() && s.bookings.indexOf(me().serial) < 0 && s.bookings.length < s.capacity) out.push({ r: r, s: s }); }); }); return out.sort(function (a, b) { return a.s.atUs - b.s.atUs; }); },
      cols: [{ k: 'who', h: '主人', v: function (x) { return roleLink(x.r); } }, { k: 'at', h: '那一微秒', v: function (x) { return num(x.s.atUs) + (x.s.together ? ' ' + tag('wait', '一起成交') : ''); } }, { k: 'cap', h: '名額', v: function (x) { return x.s.bookings.length + '／' + x.s.capacity; } }, { k: 'elig', h: '條件', v: function (x) { var e = CORE.eligible(S(), x.r, me(), now()); return e.ok ? tag('', e.how) : tag('bad', e.reason); }, wrap: true }, { k: 'act', h: '動作', v: function (x) { return CORE.eligible(S(), x.r, me(), now()).ok ? btn('book', '預約', ' data-id="' + x.s.id + '"', 'pri') : ''; } }], empty: '沒有可以預約的時段。' },
    myslots: { name: '我開的時段', rowId: function (s) { return s.id; }, rows: function () { return me().slots.slice().sort(function (a, b) { return a.atUs - b.atUs; }); },
      cols: [
        { k: 'at', h: '那一微秒', v: function (s) { return num(s.atUs) + (s.together ? '<br>' + tag('wait', '一起成交') : ''); } },
        { k: 'left', h: '還有', v: function (s) { var d = (s.atUs - now()) / 1e6; return d > 0 ? '<span class="num">' + d.toFixed(0) + ' 秒</span>' : tag('off', '已過'); } },
        { k: 'tg', h: '一起成交', v: function (s) { if (!s.together) return dash; return '<span class="small">' + esc(s.judged ? '有選東西的每一對都成才全部成交' : CORE.togetherStatus(S(), s)) + '</span>'; }, wrap: true },
        { k: 'cap', h: '名額', num: true, v: function (s) { return s.bookings.length + '／' + s.capacity; } },
        { k: 'max', h: '每人最多給', v: function (s) { return maxGiveCell(s); } },
        { k: 'who', h: '預約的人', v: function (s) { var out = s.bookings.map(function (b) { var t = L('roles', b, esc(roleName(b))); if (s.docked.indexOf(b) >= 0) return t + ' ' + tag('', '已對接'); if (CORE.missed(s, b)) return t + ' ' + tag('bad', '錯過'); return t; }); return out.length ? out.join('<br>') : '<span class="muted">還沒人預約</span>'; } },
        { k: 'want', h: '我要他的', v: function (s) { return s.bookings.length ? s.bookings.map(function (b) { return '<b>' + esc(roleName(b)) + '</b><br>' + wantsCell(s, b); }).join('<hr>') : dash; }, wrap: true },
        { k: 'theirs', h: '他要我的', v: function (s) { return s.bookings.length ? s.bookings.map(function (b) { return esc(roleName(b)) + '：' + theirsCell(s, b); }).join('<br>') : dash; }, wrap: true },
        { k: 'act', h: '動作', v: function (s) { return s.atUs > now() && !s.bookings.length ? btn('delSlot', '刪', ' data-id="' + s.id + '"') : ''; } }
      ],
      add: function () { return { at: '<input type="number" class="kc" id="addSlotMin" value="3"> 分鐘後', cap: '<input type="number" class="kc" id="addSlotCap" value="1">', max: '<input type="number" class="kc" id="addSlotMax" value="" placeholder="剩下的">', tg: '<label><input type="checkbox" id="addSlotTogether"> 一起成交</label><br><span class="small muted">開了就不能改，要改就刪掉重開</span>', act: btn('addSlot', '開時段', '', 'pri') }; }, empty: '還沒開時段。' },
    booked: { name: '我預約的', rowId: function (x) { return x.slot.id; }, rows: function () { var out = []; S().roles.forEach(function (r) { if (r === me()) return; r.slots.forEach(function (s) { if (s.bookings.indexOf(me().serial) >= 0) out.push({ owner: r, slot: s }); }); }); return out.sort(function (a, b) { return a.slot.atUs - b.slot.atUs; }); },
      cols: [
        { k: 'who', h: '主人', v: function (x) { return roleLink(x.owner); } },
        { k: 'at', h: '那一微秒', v: function (x) { return num(x.slot.atUs) + (x.slot.together ? ' ' + tag('wait', '一起成交') : ''); } },
        { k: 'st', h: '狀態', v: function (x) { var s = x.slot, d = (s.atUs - now()) / 1e6; var st = s.docked.indexOf(me().serial) >= 0 ? tag('', '已對接') : CORE.missed(s, me().serial) ? tag('bad', '錯過，不能再對接') : d > 0 ? '<span class="num">還有 ' + d.toFixed(0) + ' 秒</span>' : tag('wait', '判定中'); var tg = s.together && !s.judged ? CORE.togetherStatus(S(), s) : ''; return st + (tg ? '<br><span class="small' + (tg.indexOf('一起成交：') === 0 ? '' : ' muted') + '">' + esc(tg.indexOf('一起成交：') === 0 ? tg : '一起成交：' + tg) + '</span>' : ''); }, wrap: true },
        { k: 'present', h: '到場', v: function (x) { var s = x.slot; return s.judged ? (s.docked.indexOf(me().serial) >= 0 ? tag('', '到了') : '') : '<label><input type="checkbox" data-ed="present" data-id="' + s.id + '"' + (CORE.isPresent(S(), me().serial, s.id) ? ' checked' : '') + ' aria-label="到場"> 到場</label><br><span class="small muted">勾了就算，不用守著</span>'; }, wrap: true },
        { k: 'want', h: '我要的', v: function (x) { var s = x.slot, ps = CORE.participants(S(), s).filter(function (p) { return p !== me().serial; }); return ps.map(function (p) { return '<b>' + esc(roleName(p)) + '</b><br>' + wantsCell(s, p); }).join('<hr>'); }, wrap: true },
        { k: 'max', h: '最多給', v: function (x) { return maxGiveCell(x.slot); } },
        { k: 'theirs', h: '他要我的', v: function (x) { var s = x.slot, ps = CORE.participants(S(), s).filter(function (p) { return p !== me().serial; }); return ps.map(function (p) { return esc(roleName(p)) + '：' + theirsCell(s, p); }).join('<br>'); }, wrap: true },
        { k: 'contact', h: '聯絡方式', v: function (x) { return CORE.contactVisible(S(), x.owner, me().serial) ? (x.owner.contact ? esc(x.owner.contact) : '<span class="muted">（沒填）</span>') : dash; } },
        { k: 'act', h: '動作', v: function (x) { var s = x.slot; return s.atUs > now() && !s.judged ? btn('cancelBook', '取消', ' data-id="' + s.id + '"') : ''; } }
      ], empty: '還沒預約任何時段。到「可預約時段」找。' },
    dockings: { name: '對接紀錄', rowId: function (d) { return d.id; }, rows: function () { return S().dockings.slice().reverse(); }, mine: function (d) { return d.a === me().serial || d.b === me().serial; },
      cols: [{ k: 'at', h: '時間', v: function (d) { return num(d.atUs) + (d.tutorial ? ' ' + tag('off', '教學') : ''); } }, { k: 'a', h: '甲', v: function (d) { return L('roles', d.a, esc(roleName(d.a))); } }, { k: 'b', h: '乙', v: function (d) { return L('roles', d.b, esc(roleName(d.b))); } }, { k: 'ga', h: '甲給', num: true, v: function (d) { return String(d.gaveA); } }, { k: 'ia', h: '乙選了甲的', v: function (d) { return (d.itemsA.length ? esc(d.itemsA.map(function (i) { return i.name; }).join('、')) : (d.failA ? tag('bad', d.failA) : dash)) + (d.noteA && !d.failA ? '<br><span class="small muted">' + esc(d.noteA) + '</span>' : ''); }, wrap: true }, { k: 'gb', h: '乙給', num: true, v: function (d) { return String(d.gaveB); } }, { k: 'ib', h: '甲選了乙的', v: function (d) { return (d.itemsB.length ? esc(d.itemsB.map(function (i) { return i.name; }).join('、')) : (d.failB ? tag('bad', d.failB) : dash)) + (d.noteB && !d.failB ? '<br><span class="small muted">' + esc(d.noteB) + '</span>' : ''); }, wrap: true }, { k: 'how', h: '怎麼通的', v: function (d) { return d.traded ? '<span class="small">' + esc(d.how) + '</span>' : tag('bad', (d.ok ? '不成交：' : '不成立：') + d.reason); }, wrap: true }, { k: 'ver', h: '版本', v: function (d) { return '<span class="small muted">' + esc(d.verA + ' / ' + d.verB) + '</span>'; } }], empty: '還沒有對接。' },
    points: { name: '點數', rowId: function (g) { return g.hold.id; }, rows: function () { return CORE.holdings(S(), me().serial, now()); },
      cols: [{ k: 'who', h: '發點的人', v: function (g) { return g.issuer ? roleLink(g.issuer) : dash; } }, { k: 'what', h: '選了什麼', v: function (g) { return esc(g.hold.name); } }, { k: 'n', h: '多少點', num: true, v: function (g) { return String(g.hold.price); } }, { k: 'until', h: '保留到', v: function (g) { return '<span class="num">' + esc(g.until) + '</span>'; } }, { k: 'from', h: '哪次對接', v: function (g) { return L('dockings', g.hold.docking, '看'); } }, { k: 'act', h: '動作', v: function (g) { return btn('redeem', '兌現', ' data-id="' + g.hold.id + '"', 'pri'); } }],
      foot: function () { return '<div class="empty">我今天還能給 ' + CORE.remainingToday(S(), me(), now()) + ' / ' + CORE.dailyPoints(me(), now()) + ' 點（隔天歸零）</div>'; }, empty: '手上沒有別人的點。' },
    redeem: { name: '兌現', who: true, rowId: function (g) { return g.hold.id; }, rows: function () { var r = whoRole(); return r && r !== me() ? CORE.holdings(S(), me().serial, now()).filter(function (g) { return g.hold.issuer === r.serial; }) : []; },
      cols: [{ k: 'what', h: '選好的東西', v: function (g) { return esc(g.hold.name); } }, { k: 'n', h: '多少點', num: true, v: function (g) { return String(g.hold.price); } }, { k: 'until', h: '保留到', v: function (g) { return '<span class="num">' + esc(g.until) + '</span>'; } }, { k: 'act', h: '動作', v: function (g) { return btn('redeem', '兌現', ' data-id="' + g.hold.id + '"', 'pri'); } }],
      foot: function () { var r = whoRole(); return r && r !== me() ? '<div class="empty">貨已經替你留著，一定換得到。</div>' : '<div class="empty">用上方「看誰」選一個發點的人。</div>'; }, empty: '沒有保留著他的東西。' },
    records: { name: '紀錄', rowId: function (x, i) { return 'r' + i; }, rows: function () { return S().records.slice().reverse().concat(S().redeems.slice().reverse().map(function (x) { return { at: x.atUs, kind: 'redeem', text: roleName(x.holder) + ' 向 ' + roleName(x.issuer) + ' 兌現「' + x.name + '」（' + x.cost + ' 點），換到了' }; })).sort(function (a, b) { return b.at - a.at; }); },
      cols: [{ k: 'at', h: '時間', v: function (x) { return num(x.at); } }, { k: 'kind', h: '種類', v: function (x) { return tag({ dock: '', nodock: 'bad', miss: 'bad', redeem: '', expire: 'bad', quit: 'off' }[x.kind] || 'off', { dock: '對接', nodock: '不成立', miss: '錯過', redeem: '兌現', expire: '到期作廢', quit: '不玩了' }[x.kind] || x.kind); } }, { k: 'text', h: '內容', v: function (x) { return esc(x.text); }, wrap: true }], empty: '還沒有紀錄。' },
    help: { name: '說明', help: true }
  };
  function resChange(x, p) {
    if (!p) return '';
    var y = CORE.resourceOf(p, x.id); if (!y) return '明天起下架';
    var out = [];
    if (y.price !== x.price) out.push('明天起 ' + y.price + ' 點');
    if (y.keepDays !== x.keepDays) out.push('明天起' + (y.keepDays == null ? '一直保留' : '保留 ' + y.keepDays + ' 天'));
    if (y.name !== x.name) out.push('明天起改名「' + y.name + '」');
    if ((y.def || '') !== (x.def || '')) out.push('明天起定義改為「' + y.def + '」');
    return out.join('、');
  }
  // 明天起真的有改的地方，一條一條列
  function pendingChanges(r) {
    var v = ver(r), p = pend(r), out = []; if (!p) return out;
    if (p.dailyPoints !== v.dailyPoints) out.push('每天的點：' + v.dailyPoints + ' → ' + p.dailyPoints);
    var diffList = function (label, a, b, fmt) { var A = a.map(fmt), B = b.map(fmt); B.filter(function (x) { return A.indexOf(x) < 0; }).forEach(function (x) { out.push(label + '加：' + x); }); A.filter(function (x) { return B.indexOf(x) < 0; }).forEach(function (x) { out.push(label + '刪：' + x); }); };
    diffList('規則用途', v.rules.uses, p.rules.uses, String);
    diffList('對接條件', v.rules.conditions, p.rules.conditions, CORE.condText);
    if (p.rules.bothMustPass !== v.rules.bothMustPass) out.push('要求兩方都通：' + (p.rules.bothMustPass ? '開' : '關'));
    if (p.rules.mustAcceptVillage !== v.rules.mustAcceptVillage) out.push('對方一定要接受我的村規：' + (p.rules.mustAcceptVillage ? '開' : '關'));
    if (p.rules.village !== v.rules.village) out.push('村規改為：' + (p.rules.village || '（沒有）'));
    v.resources.forEach(function (x) { var ch = resChange(x, p); if (ch) out.push(x.name + '：' + ch.replace(/明天起 ?/g, '').replace(/^/, '') + (ch === '明天起下架' ? '' : '（現在 ' + x.price + ' 點，' + keepText(x) + '）')); });
    p.resources.forEach(function (y) { if (!CORE.resourceOf(v, y.id)) out.push('新增：' + y.name + ' ' + y.price + ' 點，保留 ' + keepText(y)); });
    return out;
  }
  function otherPendingFoot() { var r = whoRole(), ch = pendingChanges(r); if (!ch.length) return ''; return '<div class="empty">' + (isMine() ? '明天起（今天的照舊）：' : esc(r.name) + ' 明天起會改（今天就公開）：') + esc(ch.join('；')) + '</div>'; }
  function queryCols() {
    return [
      { k: 'who', h: '角色', v: function (r) { return roleLink(r); } },
      { k: 'daily', h: '每天的點', num: true, v: function (r) { return String(CORE.dailyPoints(r, now())); } },
      { k: 'avail', h: '可換的貨', num: true, v: function (r) { return String(CORE.availTotal(r, now())); } },
      { k: 'slot', h: '最近時段', v: function (r) { var s = CORE.nextSlot(r, now()); return s ? L('open', s.id, esc(CORE.fmtUs(s.atUs).slice(5, 19)) + '（' + s.bookings.length + '／' + s.capacity + '）') : dash; } },
      { k: 'dock', h: '對接過', num: true, v: function (r) { return String(CORE.dockCount(S(), r.serial)); } },
      { k: 'elig', h: '能對接嗎', v: function (r) { var e = CORE.eligible(S(), r, me(), now()); return e.ok ? tag('', e.how) : tag('bad', e.reason); }, wrap: true },
      { k: 'act', h: '動作', v: function (r) { var e = CORE.eligible(S(), r, me(), now()); var free = r.slots.filter(function (x) { return x.atUs > now() && x.bookings.length < x.capacity && x.bookings.indexOf(me().serial) < 0; }).sort(function (a, b) { return a.atUs - b.atUs; })[0]; return btn('jump', '看規則', ' data-s="uses" data-id="' + r.serial + ':"') + (e.ok && free ? ' ' + btn('book', '預約', ' data-id="' + free.id + '"', 'pri') : ''); } }
    ];
  }
  var HELP = [
    ['待辦', '照目前的狀態列出六步，標出下一步；每列有按鈕跳過去。'],
    ['新手教學', '第一次打開從創角色開始。跟引路人（J4）用「空的」換「空的」，兩邊都不損失，把預約、那一微秒、看點數、兌現走一遍；在哪個世界就講那個世界的做法，中途切換從同一步接著走。走完問要不要用另一種介面再走一次：要就從「補 1 份空的」再走；不要就到另一邊帶看對照，看完切回來。可以跳過（只做創角色）。教學的對接標「教學」，不算進對接過幾次和換點比例。'],
    ['角色', '一人一個角色。每天的能量點是最重要的屬性，預設 2000，改了明天起生效。「換人」只是單機測試用。「不玩了」要先讓手上有你點的人換完（單機版視為同意，會寫清楚作廢幾筆）。'],
    ['規則用途、對接條件、開關與村規', '規則表三部分。自己的表裡改的是「明天起」的版本，今天整天不變；標「明天起」的是跟今天不一樣的地方。看別人的用上方「看誰」；別人明天起的改動今天就公開。'],
    ['資源', '每樣東西有名字、定義、價格、保留天數（空白＝一直保留），數量分「可換」和「已保留」。種類、定義、價格、保留天數改了明天起生效；可換的隨時加減（不能小於 0）；已保留的不能減。別人只看得到可換的。'],
    ['世界、走法', '功能固定、外觀自由；走法決定代號怎麼走。'],
    ['我可以去找、可能來找我、查資源', '規則表全部公開、條件固定格式，所以直接算出誰和我一方通。排序只照事實。'],
    ['可預約時段、我開的時段、我預約的', '對接一定在約好的那一微秒。條件通才約得到；名額是容量不是條件。到場是事先確認：預約之後、那一微秒之前，在「我預約的」勾「到場」就算，不用守著，也可以取消；沒確認、也沒站在對方終點台上的，記為錯過。主人開時段就算確認到場。頁面沒開著時過了的時段，下次打開會照時間順序補判，並列出「你不在的時候」的結果。開時段可以勾「一起成交」（開了就不能改，要改就刪掉重開）：有選東西的每一對都要兩個人都到場、條件通、兩邊都選了、兩邊都給得出（同一個人給的點、同一樣東西的份數合起來算），才全部一起成交；有一對不成，整個時段都不成交，誰的貨都不動。那一微秒之前會列出還差誰選誰的東西。那一微秒之前，同一個時段的每個人對其他人選「我要他的哪些東西」、設「每人最多給多少點」。「我預約的」勾「到場」是事先確認，勾了就算，不用守著。'],
    ['對接紀錄、點數、兌現、紀錄', '那一微秒到場的人兩兩判定，條件通的每一對一換一：兩邊都選了對方的東西、兩邊都給得出（對方選的價錢不超過我的上限、不超過我當天剩的點、貨也夠），整對才成交：互換東西、貨當場替對方留著，點數就是東西的價錢。只有一邊選或任一邊給不出，整對不成交。想只收不給，先建一個 0 點的空物件讓對方選；想只給不收，拿出 0 點的試用品並選對方的空物件。收到的東西之後拿去換；保留到期沒換，作廢、貨回到可換。']
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
    if (T.who) { var cur = whoRole().serial; w.innerHTML = '看誰 <select data-ed="who" aria-label="看誰">' + S().roles.map(function (r) { return opt(r.serial, roleName(r.serial), cur); }).join('') + '</select>'; w.hidden = false; }
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
    if ((id && id.indexOf(APP.GUIDE) === 0) || (SHEETS[sheet].who && UI.who === APP.GUIDE)) APP.tutEvent('foundGuide');
    if (sheet === 'points') APP.tutEvent('sawPoints');
    APP.setFocus({ role: SHEETS[sheet].who && whoRole() ? whoRole().serial : me().serial, func: { uses: 'rule', conds: 'rule', switches: 'rule', resources: 'resource', redeem: 'resource', myslots: 'goal', open: 'goal', booked: 'goal', roles: 'role', world: 'build', circles: 'build', moves: 'build', visit: 'map', come: 'map', search: 'map', points: 'points' }[sheet] || null });
    render();
  }
  function back() { var h = UI.hist.pop(); if (!h) return; UI.sheet = h.sheet; UI.who = h.who; UI.focus = null; render(); }

  /* ---------- 動作 ---------- */
  function run(fn, ok) { var r = APP.run(fn, ok); if (r.msg) smsg(r.msg); return r; }   // APP.run 發 change 時已經重畫過，不再畫一次（否則閃一下的那列會被蓋掉）
  var v = function (id) { var el = $(id); return el ? el.value : ''; };
  function wantEdit(b, delta) { var slot = CORE.slotOf(S(), b.dataset.slot).slot, ids = CORE.wantsOf(slot, me().serial, b.dataset.other).slice(); if (delta > 0) ids.push(b.dataset.res); else { var i = ids.indexOf(b.dataset.res); if (i >= 0) ids.splice(i, 1); } run(function () { CORE.setWants(S(), slot.id, me().serial, b.dataset.other, ids); }); }
  var ACT = {
    go: function (b) { navigate(b.dataset.s, null); },
    jump: function (b) { navigate(b.dataset.s, b.dataset.id || null); },
    resetAll: function () { APP.resetAll(); },
    createMe: function () { createMe(false); }, createSkip: function () { createMe(true); },
    tutSkip: function () { APP.tutSkip(); smsg('跳過了教學。想只收不給，記得要有 0 點的空物件。'); },
    tutYes: function () { APP.tutAnswer(true); }, tutNo: function () { APP.tutAnswer(false); }, tutNext: function () { APP.tutNext(); },
    search: function () { UI.kw = v('kwIn'); render(); },
    quit: function (b) { var bl = CORE.quitBlockers(S(), b.dataset.id, now()); if (!confirm('刪掉這個角色？' + (bl.length ? '還有 ' + bl.length + ' 筆你的點沒換，會作廢（單機版持有人視為同意）。' : '沒有人拿著你的點。'))) return; run(function () { APP.quit(b.dataset.id); }, '角色刪掉了'); },
    accept: function (b) { run(function () { CORE.accept(S(), me().serial, b.dataset.id, now()); }, '接受了'); },
    addUse: function () { run(function () { var t = v('addUse').trim(); if (!t) throw new Error('先寫內容'); tmr().rules.uses.push(t); }, '加了，明天起'); },
    delUse: function (b) { run(function () { tmr().rules.uses.splice(+b.dataset.id, 1); }, '刪了，明天起'); },
    addCond: function () { run(function () { var f = v('addCondField'); tmr().rules.conditions.push({ field: f, op: v('addCondOp'), value: +v('addCondValue') || 0 }); }, '加了，明天起'); },
    delCond: function (b) { run(function () { tmr().rules.conditions.splice(+b.dataset.id, 1); }, '刪了，明天起'); },
    addRes: function () { run(function () { CORE.addResource(S(), me().serial, { name: v('addResName'), def: v('addResDef'), price: v('addResPrice'), keepDays: v('addResKeep') }, now()); }, '上架了，明天起生效；可換的數量現在就能補'); },
    delRes: function (b) { run(function () { CORE.removeResource(S(), me().serial, b.dataset.id, now()); }, '明天起下架；已保留的照舊'); },
    stock: function (b) { var k = Math.floor(+v('stockN_' + b.dataset.id)) || 1; run(function () { CORE.restock(S(), me().serial, b.dataset.id, +b.dataset.n * k); }, +b.dataset.n > 0 ? '補了 ' + k + ' 份' : '減了 ' + k + ' 份'); },
    worldIn: function (b) { UI.worldPath.push(b.dataset.id); render(); },
    addObj: function () { run(function () { var r = whoRole(), n = v('addObjName').trim(); if (!n) throw new Error('先寫名稱'); var id = 'o' + Date.now().toString(36); levelObjects().push({ id: id, name: n, func: 'none', pos: [+v('addObjX') || 0, +v('addObjZ') || 0], look: v('addObjLook') || '山', parts: CORE.look(v('addObjLook') || '山', v('addObjColor') || '#8A8F96') }); UI.focus = r.serial + ':' + id; }, '新增了地標'); },
    delObj: function (b) { run(function () { var r = whoRole(), id = b.dataset.id, lv = levelObjects(); if (!UI.worldPath.length && lv.length <= 1) throw new Error('至少留一個物件'); var gone = {}, o0 = lv.find(function (o) { return o.id === id; }); if (o0) CORE.allObjects({ objects: [o0] }).forEach(function (x) { gone[x.o.id] = true; }); lv.splice(lv.indexOf(o0), 1); r.world.walk.circles = r.world.walk.circles.filter(function (c) { return !gone[c.object]; }); r.world.walk.moves = r.world.walk.moves.filter(function (m) { return !gone[m.from] && !gone[m.to]; }); }, '刪了，用到它的走法也一起刪'); },
    addCircle: function () { run(function () { me().world.walk.circles.push({ object: v('addCircleObj'), letter: v('addCircleLetter') || 'J' }); }); },
    delCircle: function (b) { run(function () { me().world.walk.circles.splice(+b.dataset.id, 1); }); },
    addMove: function () { run(function () { if (v('addMoveFrom') === v('addMoveTo')) throw new Error('從和走到要不同'); me().world.walk.moves.push({ from: v('addMoveFrom'), to: v('addMoveTo'), digit: v('addMoveDigit') || '1' }); }); },
    delMove: function (b) { run(function () { me().world.walk.moves.splice(+b.dataset.id, 1); }); },
    addSlot: function () { run(function () { var min = +v('addSlotMin'); if (!(min >= 1)) throw new Error('幾分鐘後要至少 1'); var s = CORE.addSlot(S(), me().serial, now() + min * 60e6 + Math.floor(Math.random() * 1000), v('addSlotCap'), v('addSlotMax'), now(), $('addSlotTogether') && $('addSlotTogether').checked); UI.focus = s.id; }, '開了時段'); },
    delSlot: function (b) { run(function () { CORE.deleteSlot(S(), me().serial, b.dataset.id, now()); }, '刪了時段'); },
    book: function (b) { var r = run(function () { return CORE.book(S(), me().serial, b.dataset.id, now()); }, '預約好了。在「我預約的」選要換他的什麼，到時候勾到場。'); if (r.ok) navigate('booked', r.value.id); },
    cancelBook: function (b) { run(function () { CORE.cancelBooking(S(), me().serial, b.dataset.id); }, '取消了'); },
    wantAdd: function (b) { wantEdit(b, 1); },
    wantSub: function (b) { wantEdit(b, -1); },
    redeem: function (b) { run(function () { CORE.redeem(S(), me().serial, b.dataset.id, now()); }, '換到了'); }
  };
  var EDIT = {
    me: function (id) { APP.becomeMe(S().roles.indexOf(roleOf(id))); },
    who: function (id, val) { UI.who = val; UI.worldPath = []; APP.setFocus({ role: val }); if (val === APP.GUIDE) APP.tutEvent('foundGuide'); },
    daily: function (id, val) { CORE.setDailyPoints(S(), me().serial, val, now()); },
    useText: function (id, val) { tmr().rules.uses[+id] = val; },
    condField: function (id, val) { tmr().rules.conditions[+id].field = val; },
    condOp: function (id, val) { tmr().rules.conditions[+id].op = val; },
    condValue: function (id, val) { tmr().rules.conditions[+id].value = +val || 0; },
    switch: function (id, val, el) { tmr().rules[id] = !!el.checked; },
    village: function (id, val) { tmr().rules.village = val; },
    resName: function (id, val) { CORE.setResource(S(), me().serial, id, { name: val }, now()); },
    resDef: function (id, val) { CORE.setResource(S(), me().serial, id, { def: val }, now()); },
    resPrice: function (id, val) { CORE.setResource(S(), me().serial, id, { price: val }, now()); },
    resKeep: function (id, val) { CORE.setResource(S(), me().serial, id, { keepDays: val }, now()); },
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
    maxGive: function (id, val) { var x = CORE.slotOf(S(), id); if (x) CORE.setMaxGive(S(), x.slot, me().serial, val); }
  };
  function createMe(skip) { var r = run(function () { APP.createPlayer({ name: v('sName').trim(), dailyPoints: v('sDaily'), firstItem: { name: v('sItem').trim(), price: +v('sPrice') || 0, qty: Math.max(0, Math.floor(+v('sQty') || 0)) } }, skip); }, skip ? '角色建好了。跳過教學' : '角色建好了。教學開始：找引路人'); if (r.ok) navigate('todo', null); }
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
  APP.on('dock', function (res) { if (APP.view() !== 'sheet') return; render(); var m = me().serial, about = function (x) { return x.docking ? (x.docking.a === m || x.docking.b === m) : x.missed === m; };
    var late = res.filter(function (x) { return x.late && about(x); });
    if (late.length) { smsg('你不在的時候：' + late.map(function (x) { return CORE.fmtUs(x.slot.atUs).slice(5, 19) + ' ' + x.owner.name + ' 的時段：' + (x.docking ? dockMsg(x.docking, m) : '沒確認到場，錯過了'); }).join('；')); return; }
    var mine = res.filter(function (x) { return !x.late && x.docking && about(x); }); if (mine.length) smsg(mine.map(function (x) { return dockMsg(x.docking, m); }).join('；')); });
  function dockMsg(d, m) { var o = roleOf(d.a === m ? d.b : d.a), gave = d.a === m ? d.gaveA : d.gaveB, got = d.a === m ? d.gaveB : d.gaveA; var myOut = d.a === m ? d.itemsA : d.itemsB, myIn = d.a === m ? d.itemsB : d.itemsA; return d.traded ? '和 ' + (o ? o.name : '？') + ' 互換：我拿出 ' + CORE.itemsText(myOut) + '（' + gave + ' 點）；拿到 ' + (o ? o.name : '') + '的 ' + CORE.itemsText(myIn) + '（' + got + ' 點）（' + d.how + '）' : '和 ' + (o ? o.name : '？') + (d.ok ? ' 不成交：' : ' 不成立：') + d.reason; }
  APP.on('miss', function () { if (APP.view() === 'sheet') { render(); smsg('那一微秒過了，沒到場的預約標為錯過。'); } });
  APP.on('tut', function (st) { if (APP.view() !== 'sheet') return; if (st === 7 || st === 'compare') navigate('todo', null); else render(); if (st === 'done' && !APP.tut().skipped) smsg('教學完成！接下來照待辦準備自己的規則、資源、時段。'); });
  renderTabs();
  return { render: render, navigate: navigate, back: back, ui: UI, ORDER: ORDER, SHEETS: SHEETS, show: show };
})();
