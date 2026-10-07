/* ===== v6 表世界：活頁簿（機制沿用 v5：SHEETS 設定、欄字母、列號、凍結首欄、名稱方塊、跳轉與返回、下一步） =====
 * 頁面：下一步｜查詢｜角色｜規則｜資源｜世界｜走法｜對接時段｜對接紀錄｜點數｜兌現
 * 資料改動都經過 CORE 的規則函式，這裡只畫和接按鈕。
 */
var SHEET = (function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return APP.esc(s); };
  var opt = function (v, l, sel) { return APP.opt(v, l, sel); };
  var S = function () { return APP.state(); };
  var me = function () { return APP.me(); };
  var now = CORE.nowUs;
  var UI = { sheet: 'next', hist: [], focus: null, sel: null, worldRole: null, worldPath: [], rulesRole: null, resRole: null, redeemIssuer: null, kw: '' };
  var ORDER = ['next', 'query', 'roles', 'rules', 'resources', 'world', 'walk', 'slots', 'dockings', 'points', 'redeem'];
  var STATUS = { active: '正常', vacancy: '空窗', ended: '已結束' };

  /* ---------- 小工具 ---------- */
  var colLetter = function (i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  var stripTags = function (s) { return String(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim(); };
  var num = function (us) { return '<span class="num">' + esc(CORE.fmtUs(us)) + '</span>'; };
  var tag = function (cls, text) { return '<span class="tag ' + cls + '">' + esc(text) + '</span>'; };
  var dash = '<span class="muted">—</span>';
  var roleOf = function (serial) { return CORE.roleOf(S(), serial); };
  var roleName = function (serial) { var r = roleOf(serial); return r ? CORE.abbrev(serial) + ' ' + r.name : serial; };
  var roleIdx = function (r) { return S().roles.indexOf(r); };
  var stTag = function (r) { var st = CORE.status(r, now()); return tag({ active: 'ok', vacancy: 'open', ended: 'shelve' }[st], STATUS[st]); };
  var allObjs = function (r) { return CORE.allObjects(r.world).map(function (x) { return x.o; }); };
  function L(sheet, id, text) { return '<button type="button" class="lk" data-act="jump" data-s="' + sheet + '" data-id="' + esc(id) + '" title="前往' + esc(SHEETS[sheet].name) + '">' + text + '</button>'; }
  function btn(act, label, attrs, cls) { return '<button type="button" class="btn sm' + (cls ? ' ' + cls : '') + '" data-act="' + act + '"' + (attrs || '') + '>' + esc(label) + '</button>'; }
  function inp(ed, id, value, extra) { return '<input type="text" data-ed="' + ed + '" data-id="' + esc(id) + '" value="' + esc(value) + '"' + (extra || '') + '>'; }
  function roleLink(r) { return L('roles', r.serial, esc(roleName(r.serial))); }

  /* ---------- 草稿：新角色在創建前的規則、資源（創建後就鎖住） ---------- */
  function draft() { return S().draft || null; }
  function newDraft(fields) {
    S().draft = Object.assign({ name: '', dailyPoints: 1800, days: 30, prev: null, contact: '', rules: { uses: [], conditions: [], bothMustPass: false, mustAcceptVillage: false, village: '' }, resources: [] }, fields || {});
    return S().draft;
  }
  function rulesRole() { return UI.rulesRole === 'draft' && draft() ? null : (roleOf(UI.rulesRole) || me()); }
  function editingDraft() { return UI.rulesRole === 'draft' && !!draft(); }
  function resRole() { return UI.resRole === 'draft' && draft() ? null : (roleOf(UI.resRole) || me()); }
  function editingResDraft() { return UI.resRole === 'draft' && !!draft(); }
  function worldRole() { return roleOf(UI.worldRole) || me(); }
  function levelObjects() {
    var r = worldRole(), lv = r.world.objects;
    for (var i = 0; i < UI.worldPath.length; i++) { var o = lv.find(function (x) { return x.id === UI.worldPath[i]; }); if (!o || !o.door) { UI.worldPath = UI.worldPath.slice(0, i); break; } lv = o.door.objects; }
    return lv;
  }
  function objOpts(sel) { return CORE.allObjects(me().world).map(function (x) { return opt(x.o.id, (x.depth ? '　'.repeat(x.depth) + '└ ' : '') + x.o.name, sel); }).join(''); }
  function roleSel(ed, cur, withDraft) { return '<select data-ed="' + ed + '" aria-label="哪個角色">' + (withDraft && draft() ? opt('draft', '（草稿）' + (draft().name || '新角色'), cur) : '') + S().roles.map(function (r) { return opt(r.serial, roleName(r.serial), cur); }).join('') + '</select>'; }

  /* ---------- 下一步 ---------- */
  function steps() {
    var m = me(), st = S(), t = now(), out = [], d = draft();
    var status = CORE.status(m, t);
    out.push({ id: 'role', no: '①', name: '建角色', ok: status !== 'ended', status: CORE.abbrev(m.serial) + ' ' + m.name + '，每天 ' + m.dailyPoints + ' 點，剩 ' + Math.floor(CORE.daysLeft(m, t)) + ' 天（' + STATUS[status] + '）' + (d ? '；有一個草稿還沒創' : ''), sheet: 'roles', row: m.serial, hint: '每天的點、週期。週期內規則不能改，要改就結束再重創。' });
    var ru = m.rules, hasRules = ru.uses.length > 0 || ru.conditions.length > 0 || ru.village;
    out.push({ id: 'rules', no: '②', name: '寫規則與條件', ok: hasRules, status: hasRules ? ru.uses.length + ' 條用途、' + ru.conditions.length + ' 條條件' + (ru.bothMustPass ? '、要兩方都通' : '') + (ru.mustAcceptVillage ? '、要接受村規' : '') : '規則表是空的（要改得結束再重創）', sheet: 'rules', row: m.serial + ':', hint: '我的點能做什麼、對接條件（固定格式）、村規。' });
    out.push({ id: 'resources', no: '③', name: '資源', ok: m.resources.length > 0, status: m.resources.length ? m.resources.map(function (x) { return x.name + ' ' + x.price + ' 點×' + x.qty; }).join('、') : '沒有資源', sheet: 'resources', row: m.serial + ':', hint: '我的點能兌現的東西和價格。數量可以隨時補。' });
    var funcs = ['rule', 'resource', 'goal', 'role'], has = funcs.filter(function (f) { return allObjs(m).some(function (o) { return o.func === f; }); });
    var others = st.roles.filter(function (r) { return r !== m && CORE.status(r, t) !== 'ended'; });
    var rt = others.length ? CORE.route(m.world.walk, allObjs(m), CORE.abbrev(others[0].serial)) : { missing: '沒有別的角色' };
    out.push({ id: 'world', no: '④', name: '世界與走法', ok: has.length === funcs.length && !rt.missing, status: (has.length === funcs.length ? '四個公開功能點都有' : '缺：' + funcs.filter(function (f) { return has.indexOf(f) < 0; }).map(function (f) { return CORE.FUNCS[f].label; }).join('、')) + '；' + (rt.missing ? rt.missing : '要去 ' + CORE.abbrev(others[0].serial) + '：' + rt.steps.join('，')), sheet: 'world', row: null, hint: '功能固定、外觀自由；走法決定代號怎麼走。' });
    var up = m.slots.filter(function (s) { return s.atUs > t; });
    out.push({ id: 'slots', no: '⑤', name: '開對接時段', ok: up.length > 0, status: up.length ? up.length + ' 個未來時段，最近 ' + CORE.fmtUs(up.sort(function (a, b) { return a.atUs - b.atUs; })[0].atUs) : '沒有開放的時段', sheet: 'slots', row: null, hint: '別人要預約才能來對接；名額是容量不是條件。' });
    var booked = []; st.roles.forEach(function (r) { r.slots.forEach(function (s) { if (s.bookings.indexOf(m.serial) >= 0 && s.docked.indexOf(m.serial) < 0 && s.atUs > t) booked.push({ r: r, s: s }); }); });
    var cv = CORE.canVisit(st, m, t);
    out.push({ id: 'query', no: '⑥', name: '去查詢、預約別人', ok: booked.length > 0, status: booked.length ? '預約了 ' + booked.map(function (b) { return b.r.name + ' ' + CORE.fmtUs(b.s.atUs).slice(11, 19); }).join('、') : cv.length ? '我可以去找：' + cv.map(function (r) { return r.name; }).join('、') : '目前沒有我符合條件的人', sheet: 'query', row: null, hint: '條件通才能預約；那一微秒站在他的終點上就對接。' });
    return { rows: out, next: out.find(function (x) { return !x.ok; }) || null };
  }

  /* ---------- 各張表 ---------- */
  var SHEETS = {
    next: { no: '', name: '下一步', desc: '照目前的狀態，一步一步把角色、規則、資源、世界、對接時段準備好，再去查詢、預約別人。',
      tables: [{ id: 'steps', rowId: function (x) { return x.id; }, rows: function () { return steps().rows; }, cls: function (x) { var n = steps().next; return n && n.id === x.id ? 'next' : ''; },
        cols: [
          { k: 'no', h: '步驟', v: function (x) { return x.no + ' ' + esc(x.name); } },
          { k: 'ok', h: '狀態', v: function (x) { var n = steps().next; return x.ok ? tag('ok', '完成') : n && n.id === x.id ? tag('open', '下一步') : tag('todo', '還沒'); } },
          { k: 'go', h: '動作', v: function (x) { return btn('jump', '去' + x.name, ' data-s="' + x.sheet + '"' + (x.row ? ' data-id="' + esc(x.row) + '"' : ''), (steps().next || {}).id === x.id ? 'pri' : ''); } },
          { k: 'st', h: '目前', v: function (x) { return '<span class="small">' + esc(x.status) + '</span>'; }, wrap: true },
          { k: 'hint', h: '說明', v: function (x) { return '<span class="muted small">' + esc(x.hint) + '</span>'; }, wrap: true }
        ],
        foot: function () { return steps().next ? '' : '<div class="empty">都準備好了。到裡世界走出代號，傳送過去，那一微秒站在他的終點上。 ' + btn('world', '去裡世界', '', 'pri') + '</div>'; } }] },

    query: { no: 'Ⅰ', name: '查詢', desc: '規則表全部公開、條件是固定格式，所以直接算出誰和我一方通。排序只照事實：最近的對接時段、每天的點數、對接過幾次。',
      tables: [
        { id: 'visit', title: '我可以去找的人（我通他的條件）', rowId: function (r) { return 'v' + r.serial; }, rows: function () { return CORE.canVisit(S(), me(), now()); }, cols: queryCols(), empty: '目前沒有我符合條件的人。' },
        { id: 'come', title: '可能來找我的人（他通我的條件）', rowId: function (r) { return 'c' + r.serial; }, rows: function () { return CORE.canCome(S(), me(), now()); }, cols: queryCols(), empty: '目前沒有人符合我的條件。' },
        { id: 'res', title: '查資源', rowId: function (x) { return x.role.serial + ':' + x.resource.id; }, rows: function () { return CORE.searchResources(S(), UI.kw, now()).filter(function (x) { return x.role !== me(); }); },
          cols: [
            { k: 'name', h: '資源', v: function (x) { return esc(x.resource.name); } },
            { k: 'price', h: '價格', num: true, v: function (x) { return x.resource.price + ' ' + esc(x.role.name) + '點'; } },
            { k: 'qty', h: '還有', num: true, v: function (x) { return String(x.resource.qty); } },
            { k: 'who', h: '誰的', v: function (x) { return roleLink(x.role) + ' ' + stTag(x.role); } },
            { k: 'elig', h: '我和他', v: function (x) { var e = CORE.eligible(S(), x.role, me(), now()); return e.ok ? tag('ok', e.how) : tag('shelve', '不能對接'); } },
            { k: 'act', h: '動作', v: function (x) { return btn('jump', '看規則', ' data-s="rules" data-id="' + x.role.serial + ':"') + ' ' + btn('portal', '傳送過去', ' data-id="' + CORE.abbrev(x.role.serial) + '"'); } }
          ],
          add: { cells: function () { return { name: '<input type="text" id="kwIn" placeholder="關鍵字，例如 履歷" value="' + esc(UI.kw) + '" aria-label="關鍵字">', act: btn('search', '查', '', 'pri') }; } }, empty: '沒有符合的資源。' }
      ] },

    roles: { no: 'Ⅱ', name: '角色', desc: '每天的能量點是角色最重要的屬性，可以自訂。創角色時寫下開始、結束；週期內規則表一個字都不能改，要改就「結束並重創」。',
      tables: [{ id: 'roles', rowId: function (r) { return r.serial; }, rows: function () { return S().roles; }, mine: function (r) { return r === me(); },
        cols: [
          { k: 'me', h: '我是', v: function (r) { return '<label class="me"><input type="radio" name="meIs" data-ed="me" data-id="' + r.serial + '"' + (r === me() ? ' checked' : '') + '> ' + (r === me() ? '我' : '') + '</label>'; } },
          { k: 'code', h: '代號', v: function (r) { return '<b>' + CORE.abbrev(r.serial) + '</b> <span class="num small muted">' + r.serial + '</span>'; } },
          { k: 'name', h: '名字', v: function (r) { return esc(r.name); } },
          { k: 'daily', h: '每天的點', num: true, v: function (r) { return String(r.dailyPoints); } },
          { k: 'left', h: '今天還能給', num: true, v: function (r) { return String(CORE.remainingToday(S(), r, now())); } },
          { k: 'life', h: '週期', v: function (r) { return '<span class="small">' + esc(CORE.fmtUs(r.life.startUs).slice(0, 10)) + ' → ' + esc(CORE.fmtUs(r.life.endUs).slice(0, 10)) + '（剩 ' + Math.floor(CORE.daysLeft(r, now())) + ' 天）</span>'; } },
          { k: 'st', h: '狀態', v: function (r) { return stTag(r) + (r.vacancyDebt ? ' <span class="small muted">欠 ' + esc(roleName(r.vacancyDebt.holder)) + ' 一筆兌現</span>' : ''); } },
          { k: 'dock', h: '對接過', num: true, v: function (r) { return String(CORE.dockCount(S(), r.serial)); } },
          { k: 'rules', h: '規則', v: function (r) { return L('rules', r.serial + ':', r.rules.conditions.length + ' 條條件'); } },
          { k: 'res', h: '資源', v: function (r) { return L('resources', r.serial + ':', r.resources.length + ' 項'); } },
          { k: 'contact', h: '聯絡方式', v: function (r) { return CORE.contactVisible(S(), r, me().serial, now()) ? (r.contact ? esc(r.contact) : '<span class="muted">（沒填）</span>') : '<span class="muted">預約成功才看得到</span>'; } },
          { k: 'prev', h: '前身', v: function (r) { return r.prev ? L('roles', r.prev, esc(CORE.abbrev(r.prev))) : dash; } },
          { k: 'act', h: '動作', v: function (r) {
            if (r !== me()) return '';
            var st = CORE.status(r, now());
            if (st === 'ended') return btn('recreate', '以此為前身重創', ' data-id="' + r.serial + '"', 'pri');
            return (st === 'active' ? btn('vacIn', '進入空窗', ' data-id="' + r.serial + '"') : btn('vacOut', '離開空窗', ' data-id="' + r.serial + '"', 'pri')) + ' ' + btn('endEarly', '結束並重創', ' data-id="' + r.serial + '"');
          } }
        ],
        add: { cells: function () { var d = draft(); return { name: d ? '<span class="small">草稿：' + esc(d.name || '（還沒取名）') + '</span>' : '<input type="text" id="addRoleName" placeholder="新角色的名字" aria-label="名字">', daily: d ? '' : '<input type="number" class="kc" id="addRoleDaily" value="1800" min="1" aria-label="每天的點">', life: d ? '' : '<input type="number" class="kc" id="addRoleDays" value="30" min="1" aria-label="週期天數"> 天', act: d ? btn('jump', '去填規則', ' data-s="rules" data-id="draft:"', 'pri') + ' ' + btn('dropDraft', '丟掉草稿') : btn('newDraft', '開始建角色', '', 'pri') }; } } }] },

    rules: { no: 'Ⅲ', name: '規則', desc: '規則表三部分：我的點能做什麼、對接條件（欄位、比較、數值，系統自動判斷）、村規（自由文字，誰寫的誰解釋）。兩個開關：要求兩方都通、對方一定要接受我的村規。週期內鎖住；草稿創角色前可以改。',
      toolbar: function () { return '<label class="small">看誰的規則 ' + roleSel('rulesRole', editingDraft() ? 'draft' : rulesRole().serial, true) + '</label>' + (editingDraft() ? tag('open', '草稿，還沒創角色') : '<span class="small muted">' + (rulesRole() === me() ? '你的規則表，週期內鎖住' : '') + '</span>'); },
      tables: [
        { id: 'uses', title: '我的點能做什麼', rowId: function (x, i) { return 'u' + i; }, rows: function () { return editingDraft() ? draft().rules.uses : rulesRole().rules.uses; },
          cols: [{ k: 'no', h: '條', v: function (x, i) { return String(i + 1); } }, { k: 'text', h: '內容', v: function (x, i) { return editingDraft() ? inp('useText', i, x, ' aria-label="用途"') : esc(x); }, wrap: true }, { k: 'act', h: '動作', v: function (x, i) { return editingDraft() ? btn('delUse', '刪', ' data-id="' + i + '"') : ''; } }],
          add: { when: editingDraft, cells: function () { return { text: '<input type="text" id="addUse" placeholder="例如：1 我點 = 陪跑 1 分鐘" aria-label="新用途">', act: btn('addUse', '新增', '', 'pri') }; } }, empty: '（沒寫）' },
        { id: 'conds', title: '對接條件', rowId: function (x, i) { return 'c' + i; }, rows: function () { return editingDraft() ? draft().rules.conditions : rulesRole().rules.conditions; },
          cols: [
            { k: 'field', h: '欄位', v: function (c, i) { return editingDraft() ? '<select data-ed="condField" data-id="' + i + '" aria-label="欄位">' + Object.keys(CORE.COND_FIELDS).map(function (k) { return opt(k, CORE.COND_FIELDS[k].label, c.field); }).join('') + '</select>' : esc(CORE.COND_FIELDS[c.field].label); } },
            { k: 'op', h: '比較', v: function (c, i) { var f = CORE.COND_FIELDS[c.field]; var ops = f.enum ? ['=', '!='] : Object.keys(CORE.OPS); return editingDraft() ? '<select data-ed="condOp" data-id="' + i + '" aria-label="比較">' + ops.map(function (o) { return opt(o, f.enum ? (o === '=' ? '是' : '不是') : CORE.OPS[o], c.op); }).join('') + '</select>' : esc(f.enum ? (c.op === '=' ? '是' : '不是') : CORE.OPS[c.op]); } },
            { k: 'value', h: '數值', v: function (c, i) { var f = CORE.COND_FIELDS[c.field]; if (!editingDraft()) return esc(f.enum ? f.enum[c.value] : String(c.value)); return f.enum ? '<select data-ed="condValue" data-id="' + i + '" aria-label="數值">' + Object.keys(f.enum).map(function (k) { return opt(k, f.enum[k], c.value); }).join('') + '</select>' : '<input type="number" class="kc" data-ed="condValue" data-id="' + i + '" value="' + c.value + '" aria-label="數值">'; } },
            { k: 'plain', h: '白話', v: function (c) { return '<span class="small">' + esc(CORE.condText(c)) + '</span>'; }, wrap: true },
            { k: 'me', h: '我通不通', v: function (c) { if (editingDraft() || rulesRole() === me()) return ''; var got = CORE.COND_FIELDS[c.field].get(S(), me(), now(), rulesRole()); var ok = CORE.passes(S(), { rules: { conditions: [c] }, state: 'active', life: rulesRole().life }, me(), now()).ok; return (ok ? tag('ok', '通') : tag('shelve', '不通')) + ' <span class="small muted">我是 ' + esc(String(CORE.COND_FIELDS[c.field].enum ? CORE.COND_FIELDS[c.field].enum[got] : got)) + '</span>'; } },
            { k: 'act', h: '動作', v: function (c, i) { return editingDraft() ? btn('delCond', '刪', ' data-id="' + i + '"') : ''; } }
          ],
          add: { when: editingDraft, cells: function () { return { field: '<select id="addCondField" aria-label="欄位">' + Object.keys(CORE.COND_FIELDS).map(function (k) { return opt(k, CORE.COND_FIELDS[k].label, 'dailyPoints'); }).join('') + '</select>', op: '<select id="addCondOp" aria-label="比較">' + Object.keys(CORE.OPS).map(function (o) { return opt(o, CORE.OPS[o], '>='); }).join('') + '</select>', value: '<input type="number" class="kc" id="addCondValue" value="1000" aria-label="數值">', act: btn('addCond', '新增條件', '', 'pri') }; } }, empty: '沒有條件，誰都通。' },
        { id: 'switches', title: '開關與村規', rowId: function (x) { return x.k; },
          rows: function () { var ru = editingDraft() ? draft().rules : rulesRole().rules; return [{ k: 'bothMustPass', name: '要求兩方都通', v: ru.bothMustPass }, { k: 'mustAcceptVillage', name: '對方一定要接受我的村規', v: ru.mustAcceptVillage }, { k: 'village', name: '村規', v: ru.village }]; },
          cols: [
            { k: 'name', h: '項目', v: function (x) { return esc(x.name); } },
            { k: 'v', h: '設定', v: function (x) {
              if (x.k === 'village') return editingDraft() ? '<textarea data-ed="village" data-id="v" aria-label="村規">' + esc(x.v) + '</textarea>' : (x.v ? esc(x.v) : dash);
              return editingDraft() ? '<label class="me"><input type="checkbox" data-ed="switch" data-id="' + x.k + '"' + (x.v ? ' checked' : '') + '> ' + (x.v ? '開' : '關') + '</label>' : (x.v ? tag('open', '開') : tag('todo', '關'));
            }, wrap: true },
            { k: 'note', h: '說明', v: function (x) { if (x.k === 'village') { var r = editingDraft() ? null : rulesRole(); return '<span class="muted small">誰寫的誰解釋。平台只記「接受了沒」。' + (r && r !== me() && r.rules.village ? (CORE.accepted(S(), me().serial, r.serial) ? ' 你已接受' : ' ' + btn('acceptVillage', '接受他的村規', ' data-id="' + r.serial + '"')) : '') + '</span>'; } return '<span class="muted small">' + (x.k === 'bothMustPass' ? '關：一方通就能對接' : '開：沒接受就沒有對接的基本資格') + '</span>'; }, wrap: true }
          ] },
        { id: 'create', title: editingDraft() ? '創角色' : '版本', rowId: function (x) { return x.k; },
          rows: function () { if (editingDraft()) { var d = draft(); return [{ k: 'd', name: d.name, daily: d.dailyPoints, days: d.days, contact: d.contact }]; } var r = rulesRole(); return [{ k: 'r', name: r.name, hash: r.rulesHash, life: r.life, st: CORE.status(r, now()) }]; },
          cols: [
            { k: 'name', h: '名字', v: function (x) { return editingDraft() ? '<input type="text" data-ed="draftName" data-id="d" value="' + esc(x.name) + '" aria-label="名字">' : esc(x.name); } },
            { k: 'daily', h: '每天的點', v: function (x) { return editingDraft() ? '<input type="number" class="kc" data-ed="draftDaily" data-id="d" value="' + x.daily + '" min="1" aria-label="每天的點">' : esc(String(rulesRole().dailyPoints)); } },
            { k: 'days', h: '週期', v: function (x) { return editingDraft() ? '<input type="number" class="kc" data-ed="draftDays" data-id="d" value="' + x.days + '" min="1" aria-label="天數"> 天' : '<span class="small">' + esc(CORE.fmtUs(x.life.startUs).slice(0, 16)) + ' → ' + esc(CORE.fmtUs(x.life.endUs).slice(0, 16)) + '</span>'; } },
            { k: 'contact', h: '聯絡方式', v: function (x) { return editingDraft() ? '<input type="text" data-ed="draftContact" data-id="d" value="' + esc(x.contact) + '" placeholder="電話、LINE、Email，或不填" aria-label="聯絡方式">' : '<span class="muted small">只給預約成功的人看</span>'; } },
            { k: 'act', h: '動作', v: function (x) { return editingDraft() ? btn('createRole', '創角色（之後規則鎖住）', '', 'pri') + ' ' + btn('dropDraft', '丟掉草稿') : (rulesRole() === me() && x.st !== 'ended' ? btn('endEarly', '結束並重創', ' data-id="' + rulesRole().serial + '"') : '<span class="small muted">hash ' + esc(x.hash || '') + '</span>'); } }
          ] }
      ] },

    resources: { no: 'Ⅳ', name: '資源', desc: '我的點能兌現的具體東西和價格（要幾點）。種類和價格週期內固定；數量可以隨時補。數量不夠而兌現失敗，會自動進入空窗。',
      toolbar: function () { return '<label class="small">看誰的資源 ' + roleSel('resRole', editingResDraft() ? 'draft' : resRole().serial, true) + '</label>'; },
      tables: [{ id: 'res', rowId: function (x) { return (editingResDraft() ? 'draft' : resRole().serial) + ':' + x.id; }, rows: function () { return editingResDraft() ? draft().resources : resRole().resources; },
        cols: [
          { k: 'name', h: '資源', v: function (x, i) { return editingResDraft() ? inp('resName', i, x.name, ' aria-label="資源"') : esc(x.name); } },
          { k: 'price', h: '價格', num: true, v: function (x, i) { return editingResDraft() ? '<input type="number" class="kc" data-ed="resPrice" data-id="' + i + '" value="' + x.price + '" min="1" aria-label="價格">' : x.price + ' 點'; } },
          { k: 'qty', h: '數量', num: true, v: function (x, i) { return editingResDraft() ? '<input type="number" class="kc" data-ed="resQty" data-id="' + i + '" value="' + x.qty + '" min="0" aria-label="數量">' : String(x.qty); } },
          { k: 'mine', h: '我有多少他的點', num: true, v: function (x) { return editingResDraft() || resRole() === me() ? '' : String(CORE.balance(S(), me().serial, resRole().serial, now())); } },
          { k: 'act', h: '動作', v: function (x, i) {
            if (editingResDraft()) return btn('delRes', '刪', ' data-id="' + i + '"');
            if (resRole() === me()) return btn('restock', '補 1 份', ' data-id="' + x.id + '"');
            return btn('jump', '去兌現', ' data-s="redeem" data-id="' + resRole().serial + ':"', 'pri');
          } }
        ],
        add: { when: editingResDraft, cells: function () { return { name: '<input type="text" id="addResName" placeholder="例如：陪跑一小時" aria-label="資源">', price: '<input type="number" class="kc" id="addResPrice" value="60" min="1" aria-label="價格">', qty: '<input type="number" class="kc" id="addResQty" value="1" min="0" aria-label="數量">', act: btn('addRes', '新增資源', '', 'pri') }; } }, empty: '沒有資源。' }] },

    world: { no: 'Ⅴ', name: '世界', desc: '功能固定，外觀自由。平台的功能點：規則（屋）、資源（市集）、終點（台）、角色（碑）、點數（帳房，只有自己看得到）、地標。任何物件都能設門，內部最多 3 層。',
      toolbar: function () {
        var crumbs = ['<button type="button" class="lk" data-act="worldUp" data-n="0">外部</button>'];
        UI.worldPath.forEach(function (id, i) { var o = CORE.findObject(worldRole().world, id); crumbs.push('<button type="button" class="lk" data-act="worldUp" data-n="' + (i + 1) + '">' + esc(o ? o.name : id) + '</button>'); });
        return '<label class="small">哪個世界 ' + roleSel('worldRole', worldRole().serial) + '</label><span class="small">' + crumbs.join(' › ') + (UI.worldPath.length ? '（第 ' + UI.worldPath.length + ' 層內部）' : '') + '</span>';
      },
      tables: [{ id: 'objects', rowId: function (o) { return worldRole().serial + ':' + o.id; }, rows: function () { return levelObjects(); },
        cols: [
          { k: 'name', h: '名稱', v: function (o) { return inp('objName', o.id, o.name, ' aria-label="名稱"'); } },
          { k: 'func', h: '功能', v: function (o) { return '<select data-ed="objFunc" data-id="' + o.id + '" aria-label="功能">' + Object.keys(CORE.FUNCS).map(function (k) { return opt(k, CORE.FUNCS[k].label, o.func); }).join('') + '</select>'; } },
          { k: 'look', h: '外觀', v: function (o) { return '<select data-ed="objLook" data-id="' + o.id + '" aria-label="外觀">' + Object.keys(CORE.LOOKS).map(function (k) { return opt(k, k, o.look); }).join('') + opt('', '（自訂形體）', o.look || '') + '</select>'; } },
          { k: 'color', h: '顏色', v: function (o) { return '<input type="color" data-ed="objColor" data-id="' + o.id + '" value="' + (o.parts[0] ? o.parts[0].color : '#999999') + '" aria-label="顏色">'; } },
          { k: 'x', h: 'x', num: true, v: function (o) { return '<input type="number" class="xy" data-ed="objX" data-id="' + o.id + '" value="' + o.pos[0] + '" step="1" aria-label="x">'; } },
          { k: 'z', h: 'z', num: true, v: function (o) { return '<input type="number" class="xy" data-ed="objZ" data-id="' + o.id + '" value="' + o.pos[1] + '" step="1" aria-label="z">'; } },
          { k: 'door', h: '門', v: function (o) { if (UI.worldPath.length >= 2) return '<span class="auto">第 3 層不能再開門</span>'; return '<select data-ed="objDoor" data-id="' + o.id + '" aria-label="門">' + opt('', '沒有門', o.door ? o.door.visible : '') + opt('all', '門：所有人', o.door ? o.door.visible : '') + opt('self', '門：只有自己', o.door ? o.door.visible : '') + '</select>' + (o.door ? ' ' + btn('worldIn', '進去編輯（' + o.door.objects.length + '）', ' data-id="' + o.id + '"') : ''); } },
          { k: 'walk', h: '走法用到', v: function (o) { var r = worldRole(), w = r.world.walk, out = []; w.circles.forEach(function (c, i) { if (c.object === o.id) out.push(r === me() ? L('walk', 'c' + i, '繞圈 ' + c.letter) : '繞圈 ' + c.letter); }); w.moves.forEach(function (m, i) { if (m.from === o.id || m.to === o.id) out.push(r === me() ? L('walk', 'm' + i, '走到 ' + m.digit) : '走到 ' + m.digit); }); return out.length ? out.join('、') : dash; } },
          { k: 'act', h: '動作', v: function (o) { return btn('delObj', '刪', ' data-id="' + o.id + '"'); } }
        ],
        add: { cells: function () { return { name: '<input type="text" id="addObjName" placeholder="新地標的名稱" aria-label="新地標">', func: '<span class="auto">地標（新增後可改）</span>', look: '<select id="addObjLook" aria-label="外觀">' + Object.keys(CORE.LOOKS).map(function (k) { return opt(k, k, '山'); }).join('') + '</select>', color: '<input type="color" id="addObjColor" value="#8A8F96" aria-label="顏色">', x: '<input type="number" class="xy" id="addObjX" value="0" aria-label="x">', z: '<input type="number" class="xy" id="addObjZ" value="0" aria-label="z">', act: btn('addObj', '新增', '', 'pri') }; } } }] },

    walk: { no: 'Ⅵ', name: '走法', desc: '繞某個物件一圈是哪個字母（兩圈就是前一個字母）；從甲走到乙是哪個數字。字母決定後面要走幾個數字：J 一個、I 兩個……沒有字母就直接走 11 個數字。',
      tables: [
        { id: 'circles', title: '繞圈', rowId: function (c, i) { return 'c' + i; }, rows: function () { return me().world.walk.circles; },
          cols: [
            { k: 'obj', h: '繞這個物件', v: function (c, i) { return '<select data-ed="circleObj" data-id="' + i + '" aria-label="物件">' + objOpts(c.object) + '</select> ' + L('world', me().serial + ':' + c.object, '⇢'); } },
            { k: 'letter', h: '一圈是', v: function (c, i) { return '<select data-ed="circleLetter" data-id="' + i + '" aria-label="一圈是">' + 'JIHGFEDCBA'.split('').map(function (Lx) { return opt(Lx, Lx, c.letter); }).join('') + '</select>'; } },
            { k: 'act', h: '動作', v: function (c, i) { return btn('delCircle', '刪', ' data-id="' + i + '"'); } }
          ],
          add: { cells: function () { return { obj: '<select id="addCircleObj" aria-label="物件">' + objOpts('') + '</select>', letter: '<select id="addCircleLetter" aria-label="一圈是">' + 'JIHGFEDCBA'.split('').map(function (Lx) { return opt(Lx, Lx, 'J'); }).join('') + '</select>', act: btn('addCircle', '加一條', '', 'pri') }; } }, empty: '還沒有繞圈的走法。' },
        { id: 'moves', title: '走到', rowId: function (m, i) { return 'm' + i; }, rows: function () { return me().world.walk.moves; },
          cols: [
            { k: 'from', h: '從', v: function (m, i) { return '<select data-ed="moveFrom" data-id="' + i + '" aria-label="從">' + objOpts(m.from) + '</select>'; } },
            { k: 'to', h: '走到', v: function (m, i) { return '<select data-ed="moveTo" data-id="' + i + '" aria-label="走到">' + objOpts(m.to) + '</select>'; } },
            { k: 'digit', h: '是數字', v: function (m, i) { return '<select data-ed="moveDigit" data-id="' + i + '" aria-label="數字">' + '0123456789'.split('').map(function (d) { return opt(d, d, m.digit); }).join('') + '</select>'; } },
            { k: 'act', h: '動作', v: function (m, i) { return btn('delMove', '刪', ' data-id="' + i + '"'); } }
          ],
          add: { cells: function () { var os = allObjs(me()); return { from: '<select id="addMoveFrom" aria-label="從">' + objOpts(os[0].id) + '</select>', to: '<select id="addMoveTo" aria-label="走到">' + objOpts((os[1] || os[0]).id) + '</select>', digit: '<select id="addMoveDigit" aria-label="數字">' + '0123456789'.split('').map(function (d) { return opt(d, d, '1'); }).join('') + '</select>', act: btn('addMove', '加一條', '', 'pri') }; } }, empty: '還沒有走到的走法。' },
        { id: 'targets', title: '要去哪裡', rowId: function (r) { return r.serial; }, rows: function () { return S().roles.filter(function (r) { return r !== me() && CORE.status(r, now()) !== 'ended'; }); },
          cols: [
            { k: 'code', h: '代號', v: function (r) { return roleLink(r); } },
            { k: 'route', h: '用我的走法怎麼走', v: function (r) { var rt = CORE.route(me().world.walk, allObjs(me()), CORE.abbrev(r.serial)); return rt.missing ? tag('shelve', rt.missing) : esc(rt.steps.join('，')); }, wrap: true },
            { k: 'act', h: '動作', v: function (r) { return btn('portal', '直接開傳送門', ' data-id="' + CORE.abbrev(r.serial) + '"'); } }
          ],
          add: { cells: function () { return { code: '<input type="text" id="codeIn" placeholder="輸入代號，例如 J2" autocapitalize="characters" aria-label="代號" style="width:9em">', act: btn('portalIn', '開傳送門', '', 'pri') }; } } }
      ] },

    slots: { no: 'Ⅶ', name: '對接時段', desc: '對接一定在約好的那一微秒。主人在終點公開幾個時段，每個設名額和每次要給多少點（不超過當天剩的）。想來的人要預約，條件通才約得到。名額是容量不是條件，空窗中也能開。',
      tables: [
        { id: 'mine', title: '我開的時段', rowId: function (s) { return s.id; }, rows: function () { return me().slots.slice().sort(function (a, b) { return a.atUs - b.atUs; }); },
          cols: [
            { k: 'at', h: '那一微秒', v: function (s) { return num(s.atUs); } },
            { k: 'left', h: '還有', v: function (s) { var d = (s.atUs - now()) / 1e6; return d > 0 ? '<span class="num">' + d.toFixed(0) + ' 秒</span>' : tag('todo', '已過'); } },
            { k: 'cap', h: '名額', num: true, v: function (s) { return s.bookings.length + '／' + s.capacity; } },
            { k: 'give', h: '每次給', num: true, v: function (s) { return s.give + ' 點'; } },
            { k: 'who', h: '預約的人', v: function (s) { return s.bookings.length ? s.bookings.map(function (b) { return L('roles', b, esc(roleName(b))) + (s.docked.indexOf(b) >= 0 ? ' ' + tag('ok', '已對接') : ''); }).join('、') : dash; } },
            { k: 'act', h: '動作', v: function (s) { return s.atUs > now() && !s.bookings.length ? btn('delSlot', '刪', ' data-id="' + s.id + '"') : ''; } }
          ],
          add: { cells: function () { return { at: '<input type="number" class="kc" id="addSlotMin" value="3" min="1" aria-label="幾分鐘後"> 分鐘後', cap: '<input type="number" class="kc" id="addSlotCap" value="1" min="1" aria-label="名額">', give: '<input type="number" class="kc" id="addSlotGive" value="100" min="0" aria-label="每次給幾點">', act: btn('addSlot', '開時段', '', 'pri') }; } }, empty: '還沒開時段。' },
        { id: 'booked', title: '我預約的', rowId: function (x) { return x.s.id; }, rows: function () { var out = []; S().roles.forEach(function (r) { if (r === me()) return; r.slots.forEach(function (s) { if (s.bookings.indexOf(me().serial) >= 0) out.push({ r: r, s: s }); }); }); return out.sort(function (a, b) { return a.s.atUs - b.s.atUs; }); },
          cols: [
            { k: 'who', h: '主人', v: function (x) { return roleLink(x.r); } },
            { k: 'at', h: '那一微秒', v: function (x) { return num(x.s.atUs); } },
            { k: 'left', h: '還有', v: function (x) { var d = (x.s.atUs - now()) / 1e6; return x.s.docked.indexOf(me().serial) >= 0 ? tag('ok', '已對接') : d > 0 ? '<span class="num">' + d.toFixed(0) + ' 秒</span>' : tag('shelve', '錯過'); } },
            { k: 'give', h: '主人每次給', num: true, v: function (x) { return x.s.give + ' 點'; } },
            { k: 'contact', h: '聯絡方式', v: function (x) { return CORE.contactVisible(S(), x.r, me().serial, now()) ? (x.r.contact ? esc(x.r.contact) : '<span class="muted">（沒填）</span>') : dash; } },
            { k: 'act', h: '動作', v: function (x) { return btn('portal', '傳送過去', ' data-id="' + CORE.abbrev(x.r.serial) + '"', 'pri') + (x.s.atUs > now() && x.s.docked.indexOf(me().serial) < 0 ? ' ' + btn('cancelBook', '取消', ' data-id="' + x.s.id + '"') : ''); } }
          ], empty: '還沒預約任何時段。到查詢頁找人。' },
        { id: 'open', title: '可以預約的時段', rowId: function (x) { return 'o' + x.s.id; }, rows: function () { var out = []; S().roles.forEach(function (r) { if (r === me() || CORE.status(r, now()) === 'ended') return; r.slots.forEach(function (s) { if (s.atUs > now() && s.bookings.indexOf(me().serial) < 0 && s.bookings.length < s.capacity) out.push({ r: r, s: s }); }); }); return out.sort(function (a, b) { return a.s.atUs - b.s.atUs; }); },
          cols: [
            { k: 'who', h: '主人', v: function (x) { return roleLink(x.r) + ' ' + stTag(x.r); } },
            { k: 'at', h: '那一微秒', v: function (x) { return num(x.s.atUs); } },
            { k: 'cap', h: '名額', v: function (x) { return x.s.bookings.length + '／' + x.s.capacity; } },
            { k: 'elig', h: '條件', v: function (x) { var e = CORE.eligible(S(), x.r, me(), now()); return e.ok ? tag('ok', e.how) : tag('shelve', e.reason); }, wrap: true },
            { k: 'act', h: '動作', v: function (x) { return CORE.eligible(S(), x.r, me(), now()).ok ? btn('book', '預約', ' data-id="' + x.s.id + '"', 'pri') : btn('jump', '看規則', ' data-s="rules" data-id="' + x.r.serial + ':"'); } }
          ], empty: '目前沒有可以預約的時段。' }
      ] },

    dockings: { no: 'Ⅷ', name: '對接紀錄', desc: '雙方角色、時間、各給了多少點。角色就是版本，紀錄本身就說明雙方接受的是哪一套規則。',
      tables: [{ id: 'dk', rowId: function (d) { return d.id; }, rows: function () { return S().dockings.slice().reverse(); }, mine: function (d) { return d.a === me().serial || d.b === me().serial; },
        cols: [
          { k: 'at', h: '時間', v: function (d) { return num(d.atUs); } },
          { k: 'a', h: '主人', v: function (d) { return L('roles', d.a, esc(roleName(d.a))); } },
          { k: 'b', h: '來的人', v: function (d) { return L('roles', d.b, esc(roleName(d.b))); } },
          { k: 'ga', h: '主人給', num: true, v: function (d) { return String(d.gaveA); } },
          { k: 'gb', h: '來的人給', num: true, v: function (d) { return String(d.gaveB); } },
          { k: 'how', h: '怎麼通的', v: function (d) { return '<span class="small">' + esc(d.how || '') + '</span>'; }, wrap: true },
          { k: 'slot', h: '時段', v: function (d) { return L('slots', d.slot, '⇢'); } }
        ], empty: '還沒有對接。' }] },

    points: { no: 'Ⅸ', name: '點數', desc: '誰手上有誰的點、多少、從哪一次對接拿到的。A 點對 A 自己沒用；發點的人結束，他的點作廢；空窗中暫停兌現。',
      toolbar: function () { return tag('open', '我今天還能給 ' + CORE.remainingToday(S(), me(), now()) + ' 點（每天 ' + me().dailyPoints + '，隔天歸零）'); },
      tables: [
        { id: 'hold', title: '我手上的別人的點', rowId: function (g) { return g.issuer.serial; }, rows: function () { return CORE.holdings(S(), me().serial, now()); },
          cols: [
            { k: 'who', h: '發點的人', v: function (g) { return roleLink(g.issuer); } },
            { k: 'n', h: '多少', num: true, v: function (g) { return String(g.amount); } },
            { k: 'st', h: '狀態', v: function (g) { return stTag(g.issuer); } },
            { k: 'end', h: '到期', v: function (g) { return '<span class="small num">' + esc(CORE.fmtUs(g.endUs).slice(0, 16)) + '</span>'; } },
            { k: 'can', h: '能兌現嗎', v: function (g) { return g.status === 'active' ? tag('ok', '可以') : g.status === 'vacancy' ? tag('open', '暫停') : tag('shelve', '作廢'); } },
            { k: 'act', h: '動作', v: function (g) { return g.status === 'active' ? btn('jump', '去兌現', ' data-s="redeem" data-id="' + g.issuer.serial + ':"', 'pri') : ''; } }
          ], empty: '手上沒有別人的點。' },
        { id: 'issued', title: '我發出去、還在別人手上的', rowId: function (x) { return x.who; }, rows: function () { var h = CORE.holdersOf(S(), me().serial, now()); return Object.keys(h).map(function (k) { return { who: k, n: h[k] }; }); },
          cols: [{ k: 'who', h: '誰', v: function (x) { return L('roles', x.who, esc(roleName(x.who))); } }, { k: 'n', h: '多少', num: true, v: function (x) { return String(x.n); } }], empty: '沒有人拿著我的點。' },
        { id: 'all', title: '每一筆', rowId: function (p) { return p.id; }, rows: function () { return S().points.filter(function (p) { return p.holder === me().serial || p.issuer === me().serial; }).slice().reverse(); },
          cols: [
            { k: 'at', h: '時間', v: function (p) { return num(p.atUs); } },
            { k: 'issuer', h: '發點的人', v: function (p) { return L('roles', p.issuer, esc(roleName(p.issuer))); } },
            { k: 'holder', h: '拿到的人', v: function (p) { return L('roles', p.holder, esc(roleName(p.holder))); } },
            { k: 'n', h: '數量', num: true, v: function (p) { return String(p.amount); } },
            { k: 'spent', h: '用掉', num: true, v: function (p) { return String(p.spent); } },
            { k: 'dock', h: '對接', v: function (p) { return L('dockings', p.docking, '⇢'); } },
            { k: 'sig', h: '簽章', v: function (p) { return p.sig ? esc(p.sig) : '<span class="muted small">（多人版才簽）</span>'; } }
          ], empty: '還沒有點數。' }
      ] },

    redeem: { no: 'Ⅹ', name: '兌現', desc: '拿著 A 點，照 A 的資源表向 A 換東西。A 在空窗期暫停；A 的週期結束 A 點作廢。A 付不出 = 兌現失敗，A 自動進入空窗，留下公開紀錄。',
      toolbar: function () { var r = redeemIssuer(); return '<label class="small">向誰兌現 ' + roleSel('redeemIssuer', r ? r.serial : '') + '</label>' + (r ? '<span class="small">我有 <b>' + CORE.balance(S(), me().serial, r.serial, now()) + '</b> ' + esc(r.name) + '點 ' + stTag(r) + '</span>' : ''); },
      tables: [
        { id: 'offer', title: '資源表', rowId: function (x) { return 'rd' + x.id; }, rows: function () { var r = redeemIssuer(); return r ? r.resources : []; },
          cols: [
            { k: 'name', h: '資源', v: function (x) { return esc(x.name); } },
            { k: 'price', h: '價格', num: true, v: function (x) { return x.price + ' 點'; } },
            { k: 'qty', h: '還有', num: true, v: function (x) { return x.qty ? String(x.qty) : tag('shelve', '0'); } },
            { k: 'can', h: '換得到嗎', v: function (x) { var r = redeemIssuer(), bal = CORE.balance(S(), me().serial, r.serial, now()), st = CORE.status(r, now()); return st !== 'active' ? tag('open', STATUS[st] + '，暫停') : bal < x.price ? tag('todo', '點不夠（差 ' + (x.price - bal) + '）') : x.qty < 1 ? tag('shelve', '數量 0：換了會兌現失敗') : tag('ok', '可以'); } },
            { k: 'act', h: '動作', v: function (x) { var r = redeemIssuer(); return r === me() ? '' : btn('redeem', '兌現', ' data-id="' + x.id + '"', 'pri'); } }
          ], empty: '他沒有列資源。' },
        { id: 'records', title: '兌現紀錄（公開）', rowId: function (x) { return x.id; }, rows: function () { return S().redeems.slice().reverse(); }, mine: function (x) { return x.holder === me().serial || x.issuer === me().serial; },
          cols: [
            { k: 'at', h: '時間', v: function (x) { return num(x.atUs); } },
            { k: 'holder', h: '拿點的人', v: function (x) { return L('roles', x.holder, esc(roleName(x.holder))); } },
            { k: 'issuer', h: '發點的人', v: function (x) { return L('roles', x.issuer, esc(roleName(x.issuer))); } },
            { k: 'name', h: '資源', v: function (x) { return esc(x.name); } },
            { k: 'cost', h: '花了', num: true, v: function (x) { return String(x.cost); } },
            { k: 'ok', h: '結果', v: function (x) { return x.ok ? tag('ok', '換到') : tag('shelve', '兌現失敗，主人進入空窗'); } }
          ], empty: '還沒有兌現。' }
      ] }
  };
  function queryCols() {
    return [
      { k: 'who', h: '角色', v: function (r) { return roleLink(r) + ' ' + stTag(r); } },
      { k: 'daily', h: '每天的點', num: true, v: function (r) { return String(r.dailyPoints); } },
      { k: 'days', h: '剩幾天', num: true, v: function (r) { return String(Math.floor(CORE.daysLeft(r, now()))); } },
      { k: 'slot', h: '最近時段', v: function (r) { var s = CORE.nextSlot(r, now()); return s ? L('slots', 'o' + s.id, esc(CORE.fmtUs(s.atUs).slice(5, 19)) + '（' + s.bookings.length + '／' + s.capacity + '）') : dash; } },
      { k: 'dock', h: '對接過', num: true, v: function (r) { return String(CORE.dockCount(S(), r.serial)); } },
      { k: 'elig', h: '能對接嗎', v: function (r) { var e = CORE.eligible(S(), r, me(), now()); return e.ok ? tag('ok', e.how) : tag('shelve', e.reason); }, wrap: true },
      { k: 'act', h: '動作', v: function (r) { var s = CORE.nextSlot(r, now()), e = CORE.eligible(S(), r, me(), now()); var free = r.slots.filter(function (x) { return x.atUs > now() && x.bookings.length < x.capacity && x.bookings.indexOf(me().serial) < 0; }).sort(function (a, b) { return a.atUs - b.atUs; })[0]; return btn('jump', '看規則', ' data-s="rules" data-id="' + r.serial + ':"') + ' ' + btn('portal', '傳送過去', ' data-id="' + CORE.abbrev(r.serial) + '"') + (e.ok && free ? ' ' + btn('book', '預約', ' data-id="' + free.id + '"', 'pri') : ''); } }
    ];
  }
  function redeemIssuer() { return roleOf(UI.redeemIssuer) || CORE.holdings(S(), me().serial, now()).map(function (g) { return g.issuer; })[0] || S().roles.find(function (r) { return r !== me(); }) || null; }

  /* ---------- 通用表格（沿用 v5） ---------- */
  function renderTable(sk, T) {
    var cols = T.cols, rows = T.rows();
    var letters = '<tr class="letters"><th class="rn"></th>' + cols.map(function (c, i) { return '<th class="' + (i === 0 ? 'fz' : '') + '">' + colLetter(i) + '</th>'; }).join('') + '</tr>';
    var names = '<tr class="names"><th class="rn"><span class="small">列</span></th>' + cols.map(function (c, i) { return '<th class="' + (i === 0 ? 'fz' : '') + (c.num ? ' n' : '') + '">' + esc(c.h) + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (r, i) {
      var id = T.rowId(r, i);
      var tds = cols.map(function (c, ci) { return '<td class="' + (ci === 0 ? 'fz' : '') + (c.num ? ' n' : '') + (c.wrap ? ' wrap' : '') + '" data-c="' + ci + '">' + c.v(r, i) + '</td>'; }).join('');
      var cls = (T.mine && T.mine(r) ? 'mine ' : '') + (T.cls ? T.cls(r) : '');
      return '<tr data-row data-id="' + esc(id) + '" data-i="' + (i + 1) + '" class="' + cls + '"><td class="rn">' + (i + 1) + '</td>' + tds + '</tr>';
    }).join('');
    if (T.add && (!T.add.when || T.add.when())) {
      var cells = T.add.cells();
      body += '<tr class="addrow" data-i="＊"><td class="rn"><span aria-hidden="true">＊</span></td>' + cols.map(function (c, ci) { return '<td class="' + (ci === 0 ? 'fz' : '') + (c.wrap ? ' wrap' : '') + '" data-c="' + ci + '">' + (cells[c.k] != null ? cells[c.k] : '<span class="auto">自動</span>') + '</td>'; }).join('') + '</tr>';
    }
    var empty = !rows.length && T.empty ? '<div class="empty">' + esc(T.empty) + '</div>' : '';
    return (T.title ? '<h3 class="tt">' + esc(T.title) + '</h3>' : '') + '<div class="wb"><table class="ws" data-sheet="' + sk + '" data-table="' + T.id + '"><thead>' + letters + names + '</thead><tbody>' + body + '</tbody></table>' + empty + '</div>' + (T.foot ? T.foot() : '');
  }
  function render() {
    if (!$('view-sheet') || $('view-sheet').hidden) { renderTabs(); return; }
    var sk = UI.sheet, Sh = SHEETS[sk];
    var scroll = $('view-sheet').scrollTop;
    var h = '<div class="sheet-head">' + (Sh.no ? '<span class="no">表 ' + Sh.no + '</span>' : '') + '<h2>' + esc(Sh.name) + '</h2></div><p class="sheet-desc">' + esc(Sh.desc) + '</p>';
    if (Sh.toolbar) h += '<div class="toolbar">' + Sh.toolbar() + '</div>';
    h += Sh.tables.map(function (T) { return renderTable(sk, T); }).join('');
    h += '<div class="msg" id="sheetMsg" hidden></div>';
    var nx = nextSheet();
    h += '<div class="nextbar">' + btn('nextSheet', '下一步 → ' + SHEETS[nx.sheet].name, '', 'pri') + (sk === 'next' ? ' ' + btn('resetAll', '全部還原成預設') : '') + '</div>';
    $('main').innerHTML = h;
    renderTabs();
    $('nameBox').textContent = Sh.no || Sh.name; $('nameBox').title = Sh.name; $('fxVal').textContent = '';
    $('backBtn').disabled = !UI.hist.length;
    if (UI.focus) focusRow(); else $('view-sheet').scrollTop = render.last === sk ? scroll : 0;
    render.last = sk;
  }
  function nextSheet() {
    if (UI.sheet === 'next') { var n = steps().next; return n ? { sheet: n.sheet, id: n.row } : { sheet: 'query', id: null }; }
    var i = ORDER.indexOf(UI.sheet);
    return { sheet: ORDER[(i + 1) % ORDER.length], id: null };
  }
  function renderTabs() {
    var world = APP.isWorld();
    $('tabs').innerHTML = '<a data-act="world"' + (world ? ' aria-current="page"' : '') + '><b>裡</b>裡世界</a><span class="sep" aria-hidden="true"></span>' +
      ORDER.map(function (k) { var Sh = SHEETS[k]; return '<a data-act="go" data-s="' + k + '"' + (!world && UI.sheet === k ? ' aria-current="page"' : '') + '>' + (Sh.no ? '<b>' + Sh.no + '</b>' : '') + esc(Sh.name) + '</a>'; }).join('');
    var cur = $('tabs').querySelector('[aria-current]'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function focusRow() {
    var id = UI.focus; UI.focus = null;
    var tr = document.querySelector('.ws tr[data-row][data-id="' + CSS.escape(id) + '"]');
    if (!tr) { sheetMsg('你目前看不到這一列'); return; }
    tr.scrollIntoView({ block: 'center' });
    tr.classList.remove('flash'); void tr.offsetWidth; tr.classList.add('flash');
    var td = tr.querySelector('td[data-c="0"]'); if (td) selectCell(td);
  }
  function selectCell(td) {
    document.querySelectorAll('.ws td.sel').forEach(function (x) { x.classList.remove('sel'); });
    td.classList.add('sel');
    var table = td.closest('table'), sk = table.dataset.sheet, Sh = SHEETS[sk], tr = td.parentElement, ci = +td.dataset.c;
    var th = table.querySelectorAll('thead tr.names th')[ci + 1];
    $('nameBox').textContent = (Sh.no || Sh.name) + '!' + colLetter(ci) + tr.dataset.i;
    $('nameBox').title = Sh.name + '．' + (th ? th.textContent : '') + '．第 ' + tr.dataset.i + ' 列';
    var v = stripTags(td.innerHTML); $('fxVal').textContent = v; $('fxVal').title = v;
    UI.sel = { sk: sk, id: tr.dataset.id, ci: ci };
  }
  function sheetMsg(t) { var el = $('sheetMsg'); if (!el) { APP.msg(t); return; } el.textContent = t; el.hidden = false; setTimeout(function () { el.hidden = true; }, 3600); }

  /* ---------- 跳轉與返回 ---------- */
  function navigate(sheet, id) {
    if (!SHEETS[sheet]) return;
    UI.hist.push({ sheet: UI.sheet }); if (UI.hist.length > 60) UI.hist.shift();
    UI.sheet = sheet; UI.focus = id || null;
    if (id && id.indexOf(':') > 0) {
      var who = id.split(':')[0], rest = id.split(':')[1];
      if (sheet === 'world') { UI.worldRole = who; var hit = rest && CORE.allObjects(worldRole().world).find(function (x) { return x.o.id === rest; }); UI.worldPath = hit ? hit.path : []; }
      if (sheet === 'rules') { UI.rulesRole = who; UI.focus = null; }
      if (sheet === 'resources') { UI.resRole = who; UI.focus = rest ? id : null; }
      if (sheet === 'redeem') { UI.redeemIssuer = who; UI.focus = null; }
    }
    if (!APP.isWorld()) render(); else APP.showTab('sheet');
  }
  function back() { var h = UI.hist.pop(); if (!h) return; UI.sheet = h.sheet; UI.focus = null; render(); }

  /* ---------- 動作 ---------- */
  // 規則函式擋下時也可能已經改了資料（例如兌現失敗自動空窗），所以失敗也存檔、重畫
  function run(fn, ok) { var msg0 = ok, r = null; try { r = fn(); } catch (e) { msg0 = e.message; r = null; } APP.save(); render(); if (msg0) sheetMsg(msg0); return r; }
  var v = function (id) { var el = $(id); return el ? el.value : ''; };
  var ACT = {
    world: function () { APP.showTab('world'); },
    go: function (b) { navigate(b.dataset.s, null); },
    jump: function (b) { navigate(b.dataset.s, b.dataset.id || null); },
    nextSheet: function () { var n = nextSheet(); navigate(n.sheet, n.id); },
    resetAll: function () { APP.resetAll(); },
    search: function () { UI.kw = v('kwIn'); render(); },
    portal: function (b) { APP.openPortal(b.dataset.id); },
    portalIn: function () { var c = v('codeIn').trim().toUpperCase(); if (c) APP.openPortal(c); },
    // 角色
    newDraft: function () { run(function () { var name = v('addRoleName').trim(); if (!name) throw new Error('先寫名字'); newDraft({ name: name, dailyPoints: Math.floor(+v('addRoleDaily')) || 1800, days: Math.floor(+v('addRoleDays')) || 30 }); UI.rulesRole = 'draft'; UI.resRole = 'draft'; navigate('rules', 'draft:'); }); },
    dropDraft: function () { S().draft = null; UI.rulesRole = null; UI.resRole = null; run(function () {}); },
    createRole: function () { run(function () {
      var d = draft(); if (!d) throw new Error('沒有草稿');
      var t = now();
      var r = CORE.createRole(S(), { name: d.name, dailyPoints: d.dailyPoints, life: { startUs: t, endUs: t + d.days * CORE.DAY_US }, rules: d.rules, resources: d.resources, contact: d.contact, prev: d.prev }, t);
      S().draft = null; UI.rulesRole = r.serial; UI.resRole = r.serial;
      APP.becomeMe(roleIdx(r)); UI.focus = r.serial; navigate('roles', r.serial);
    }, '創好了，規則表從現在起鎖住'); },
    endEarly: function (b) { run(function () {
      var r = roleOf(b.dataset.id);
      var hs = CORE.holdersOf(S(), r.serial, now());
      CORE.endEarly(S(), r.serial, now(), Object.keys(hs));   // 單機：持有人都在本機，視為同意
      newDraft({ name: r.name, dailyPoints: r.dailyPoints, days: 30, prev: r.serial, contact: r.contact, rules: JSON.parse(JSON.stringify(r.rules)), resources: r.resources.map(function (x) { return { name: x.name, price: x.price, qty: x.qty }; }) });
      UI.rulesRole = 'draft'; UI.resRole = 'draft'; navigate('rules', 'draft:');
    }, '角色結束了，草稿帶著原本的規則，改好再創'); },
    recreate: function (b) { run(function () { var r = roleOf(b.dataset.id); newDraft({ name: r.name, dailyPoints: r.dailyPoints, days: 30, prev: r.serial, contact: r.contact, rules: JSON.parse(JSON.stringify(r.rules)), resources: r.resources.map(function (x) { return { name: x.name, price: x.price, qty: x.qty }; }) }); UI.rulesRole = 'draft'; UI.resRole = 'draft'; navigate('rules', 'draft:'); }); },
    vacIn: function (b) { run(function () { CORE.enterVacancy(S(), b.dataset.id, now()); }, '進入空窗：每天的點停發、別人手上的點暫停兌現'); },
    vacOut: function (b) { run(function () { CORE.leaveVacancy(S(), b.dataset.id, now()); }, '離開空窗了'); },
    acceptVillage: function (b) { run(function () { CORE.accept(S(), me().serial, b.dataset.id); }, '接受了'); },
    // 規則草稿
    addUse: function () { run(function () { var t = v('addUse').trim(); if (!t) throw new Error('先寫內容'); draft().rules.uses.push(t); }); },
    delUse: function (b) { run(function () { draft().rules.uses.splice(+b.dataset.id, 1); }); },
    addCond: function () { run(function () { var f = v('addCondField'), fd = CORE.COND_FIELDS[f]; draft().rules.conditions.push(fd.enum ? { field: f, op: '=', value: Object.keys(fd.enum)[0] } : { field: f, op: v('addCondOp'), value: +v('addCondValue') || 0 }); }); },
    delCond: function (b) { run(function () { draft().rules.conditions.splice(+b.dataset.id, 1); }); },
    addRes: function () { run(function () { var n = v('addResName').trim(); if (!n) throw new Error('先寫資源名稱'); draft().resources.push({ name: n, price: Math.floor(+v('addResPrice')) || 1, qty: Math.floor(+v('addResQty')) || 0 }); }); },
    delRes: function (b) { run(function () { draft().resources.splice(+b.dataset.id, 1); }); },
    restock: function (b) { run(function () { CORE.restock(S(), me().serial, b.dataset.id, 1); }, '補了 1 份'); },
    // 世界、走法
    worldIn: function (b) { UI.worldPath.push(b.dataset.id); render(); },
    worldUp: function (b) { UI.worldPath = UI.worldPath.slice(0, +b.dataset.n); render(); },
    addObj: function () { run(function () {
      var r = worldRole(), name = v('addObjName').trim(); if (!name) throw new Error('先寫名稱');
      var id = 'o' + Date.now().toString(36);
      levelObjects().push({ id: id, name: name, func: 'none', pos: [+v('addObjX') || 0, +v('addObjZ') || 0], look: v('addObjLook') || '山', parts: CORE.look(v('addObjLook') || '山', v('addObjColor') || '#8A8F96') });
      APP.worldRefresh(r); UI.focus = r.serial + ':' + id;
    }, '新增了地標'); },
    delObj: function (b) { run(function () {
      var r = worldRole(), id = b.dataset.id, lv = levelObjects();
      if (!UI.worldPath.length && lv.length <= 1) throw new Error('至少留一個物件');
      var gone = {}, o0 = lv.find(function (o) { return o.id === id; });
      if (o0) CORE.allObjects({ objects: [o0] }).forEach(function (x) { gone[x.o.id] = true; });
      lv.splice(lv.indexOf(o0), 1);
      r.world.walk.circles = r.world.walk.circles.filter(function (c) { return !gone[c.object]; });
      r.world.walk.moves = r.world.walk.moves.filter(function (m) { return !gone[m.from] && !gone[m.to]; });
      APP.worldRefresh(r); if (r === me()) APP.walkChanged();
    }, '刪掉了，用到它的走法也一起刪'); },
    addCircle: function () { run(function () { me().world.walk.circles.push({ object: v('addCircleObj'), letter: v('addCircleLetter') || 'J' }); APP.walkChanged(); }); },
    delCircle: function (b) { run(function () { me().world.walk.circles.splice(+b.dataset.id, 1); APP.walkChanged(); }); },
    addMove: function () { run(function () { if (v('addMoveFrom') === v('addMoveTo')) throw new Error('從和走到要不同'); me().world.walk.moves.push({ from: v('addMoveFrom'), to: v('addMoveTo'), digit: v('addMoveDigit') || '1' }); APP.walkChanged(); }); },
    delMove: function (b) { run(function () { me().world.walk.moves.splice(+b.dataset.id, 1); APP.walkChanged(); }); },
    // 時段、預約、兌現
    addSlot: function () { run(function () { var min = +v('addSlotMin'); if (!(min >= 1)) throw new Error('幾分鐘後要至少 1'); var s = CORE.addSlot(S(), me().serial, now() + min * 60e6 + Math.floor(Math.random() * 1000), v('addSlotCap'), v('addSlotGive'), now()); UI.focus = s.id; }, '開了時段'); },
    delSlot: function (b) { run(function () { me().slots = me().slots.filter(function (s) { return s.id !== b.dataset.id; }); }); },
    book: function (b) { run(function () { var s = CORE.book(S(), me().serial, b.dataset.id, now()); navigate('slots', s.id); }, '預約好了。那一微秒站在他的終點上就對接。'); },
    cancelBook: function (b) { run(function () { CORE.cancelBooking(S(), me().serial, b.dataset.id); }, '取消了'); },
    redeem: function (b) { run(function () { var r = redeemIssuer(); var rec = CORE.redeem(S(), me().serial, r.serial, b.dataset.id, now()); UI.focus = rec.id; }, '換到了'); }
  };

  /* ---------- 編輯 ---------- */
  var EDIT = {
    me: function (id) { APP.becomeMe(roleIdx(roleOf(id))); },
    rulesRole: function (id, val) { UI.rulesRole = val; },
    resRole: function (id, val) { UI.resRole = val; },
    worldRole: function (id, val) { UI.worldRole = val; UI.worldPath = []; },
    redeemIssuer: function (id, val) { UI.redeemIssuer = val; },
    useText: function (id, val) { draft().rules.uses[+id] = val; },
    condField: function (id, val) { var c = draft().rules.conditions[+id], fd = CORE.COND_FIELDS[val]; c.field = val; if (fd.enum) { c.op = '='; c.value = Object.keys(fd.enum)[0]; } else if (typeof c.value !== 'number') { c.value = 0; c.op = '>='; } },
    condOp: function (id, val) { draft().rules.conditions[+id].op = val; },
    condValue: function (id, val) { var c = draft().rules.conditions[+id]; c.value = CORE.COND_FIELDS[c.field].enum ? val : +val; },
    switch: function (id, val, el) { draft().rules[id] = !!el.checked; },
    village: function (id, val) { draft().rules.village = val; },
    draftName: function (id, val) { draft().name = val; },
    draftDaily: function (id, val) { draft().dailyPoints = Math.floor(+val) || 1; },
    draftDays: function (id, val) { draft().days = Math.floor(+val) || 1; },
    draftContact: function (id, val) { draft().contact = val; },
    resName: function (id, val) { draft().resources[+id].name = val; },
    resPrice: function (id, val) { draft().resources[+id].price = Math.floor(+val) || 1; },
    resQty: function (id, val) { draft().resources[+id].qty = Math.floor(+val) || 0; },
    objName: function (id, val) { objEdit(id, function (o) { o.name = val; }); },
    objFunc: function (id, val) { objEdit(id, function (o) { o.func = val; }); },
    objX: function (id, val) { objEdit(id, function (o) { o.pos[0] = +val || 0; }); },
    objZ: function (id, val) { objEdit(id, function (o) { o.pos[1] = +val || 0; }); },
    objLook: function (id, val) { objEdit(id, function (o) { if (val) { o.look = val; o.parts = CORE.look(val, o.parts[0] ? o.parts[0].color : '#999999'); } else o.look = ''; }); },
    objColor: function (id, val) { objEdit(id, function (o) { if (o.look) o.parts = CORE.look(o.look, val); else if (o.parts[0]) o.parts[0].color = val; }); },
    objDoor: function (id, val) { objEdit(id, function (o) { if (!val) delete o.door; else if (o.door) o.door.visible = val; else o.door = { visible: val, start: [0, 4], objects: [] }; }); },
    circleObj: function (id, val) { me().world.walk.circles[+id].object = val; APP.walkChanged(); },
    circleLetter: function (id, val) { me().world.walk.circles[+id].letter = val; APP.walkChanged(); },
    moveFrom: function (id, val) { me().world.walk.moves[+id].from = val; APP.walkChanged(); },
    moveTo: function (id, val) { me().world.walk.moves[+id].to = val; APP.walkChanged(); },
    moveDigit: function (id, val) { me().world.walk.moves[+id].digit = val; APP.walkChanged(); }
  };
  function objEdit(id, fn) { var r = worldRole(), o = levelObjects().find(function (x) { return x.id === id; }); if (!o) return; fn(o); APP.worldRefresh(r, UI.worldPath.length ? null : o.id); }

  var busy = false;
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (b && ACT[b.dataset.act]) { if (busy) return; busy = true; try { ACT[b.dataset.act](b); } finally { busy = false; } return; }
    var td = e.target.closest('.ws[data-sheet] tbody td'); if (!td || td.classList.contains('rn') || !td.parentElement.hasAttribute('data-row')) return;
    selectCell(td);
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t.dataset || !t.dataset.ed || !EDIT[t.dataset.ed] || busy) return;
    busy = true;
    try {
      try { EDIT[t.dataset.ed](t.dataset.id, t.value, t); APP.save(); }
      catch (err) { sheetMsg(err.message); return; }
      if (t.dataset.ed === 'me') return;
      render();
    } finally { busy = false; }
  });
  $('backBtn').addEventListener('click', back);
  renderTabs();
  return { render: render, renderTabs: renderTabs, navigate: navigate, back: back, steps: steps, ui: UI, ORDER: ORDER, SHEETS: SHEETS };
})();
