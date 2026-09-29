/* ===== 表世界：活頁簿，一張表一頁（沿用 v4 的 SHEETS 設定、列號、凍結首欄、名稱方塊、跳轉與返回） =====
 * 每頁是一張或幾張表格；按鈕都放在格子裡；表與表之間用連結跳到對應那一列。
 * 資料改動都經過 DATA／FUSION 的規則函式，這裡只畫和接按鈕。
 */
var SHEET = (function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return APP.esc(s); };
  var opt = function (v, l, sel) { return APP.opt(v, l, sel); };
  var S = function () { return APP.state(); };
  var me = function () { return APP.me(); };
  var UI = { sheet: 'next', hist: [], focus: null, sel: null, worldRole: null, rulesRole: null, draft: null, draftFor: null, prevPick: null };
  var ORDER = ['next', 'roles', 'problems', 'rules', 'world', 'walk', 'depart', 'fusion', 'points', 'records'];

  /* ---------- 小工具 ---------- */
  var colLetter = function (i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  var stripTags = function (s) { return String(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim(); };
  var num = function (us) { return '<span class="num">' + esc(DATA.fmtUs(us)) + '</span>'; };
  var tag = function (cls, text) { return '<span class="tag ' + cls + '">' + esc(text) + '</span>'; };
  var dash = '<span class="muted">—</span>';
  var roleOf = function (serial) { return S().roles.find(function (r) { return r.serial === serial; }) || null; };
  var roleName = function (serial) { var r = roleOf(serial); return r ? DATA.abbrev(serial) + ' ' + r.name : serial; };
  var roleIdx = function (r) { return S().roles.indexOf(r); };
  var findProblem = function (pid) { var out = null; S().roles.forEach(function (r) { r.problems.forEach(function (p) { if (p.id === pid) out = { role: r, p: p }; }); }); return out; };
  var findStage = function (sid) { var out = null; S().fusions.forEach(function (f) { f.stages.forEach(function (st) { if (st.id === sid) out = { f: f, st: st }; }); }); return out; };
  var fusionOf = function (fid) { return S().fusions.find(function (f) { return f.id === fid; }) || null; };
  var objName = function (r, id) { var o = r.objects.find(function (x) { return x.id === id; }); return o ? o.name : id; };
  var PSTATUS = { open: '進行中', fused: '融合中', shelved: '擱置', exited: '退出', done: '可處理' };
  var DSTATUS = { none: '還沒寫', wait: '等待那一微秒', past: '已過', fusion: '融合的期限' };

  // 連結：跳到某張表的某一列
  function L(sheet, id, text) { return '<button type="button" class="lk" data-act="jump" data-s="' + sheet + '" data-id="' + esc(id) + '" title="前往' + esc(SHEETS[sheet].name) + '">' + text + '</button>'; }
  function btn(act, label, attrs, cls) { return '<button type="button" class="btn sm' + (cls ? ' ' + cls : '') + '" data-act="' + act + '"' + (attrs || '') + '>' + esc(label) + '</button>'; }
  function inp(ed, id, value, extra) { return '<input type="text" data-ed="' + ed + '" data-id="' + esc(id) + '" value="' + esc(value) + '"' + (extra || '') + '>'; }

  /* ---------- 下一步：依目前狀態算 ---------- */
  function steps() {
    var m = me(), st = S(), out = [];
    var p = DATA.activeProblem(m), cur = DATA.currentRules(m);
    out.push({ id: 'role', no: '①', name: '角色', ok: !!m.name, status: DATA.abbrev(m.serial) + ' ' + m.name, sheet: 'roles', row: m.serial, hint: '你是誰。可以改名字或換角色。' });
    out.push({ id: 'problem', no: '②', name: '難題', ok: !!p, status: p ? p.text + '（' + PSTATUS[p.status] + '）' : '還沒立難題', sheet: 'problems', row: p ? p.id : null, hint: '自己想不出辦法的情況，寫下來。' });
    out.push({ id: 'rules', no: '③', name: '規則', ok: cur.items.length > 0, status: cur.no ? '第 ' + cur.no + ' 版，' + cur.items.length + ' 條，題點 ' + cur.ratios.idea + '、戰點 ' + cur.ratios.battle + ' 大卡' : '還沒有規則', sheet: 'rules', row: cur.no ? m.serial + ':' + cur.no : null, hint: '你的規則和點數比例，來訪者沿路看得到公開的。' });
    var funcs = ['rule', 'problem', 'goal', 'fusion', 'stage'], has = funcs.filter(function (f) { return m.objects.some(function (o) { return o.func === f; }); });
    out.push({ id: 'world', no: '④', name: '世界', ok: has.length === funcs.length, status: has.length === funcs.length ? m.objects.length + ' 個物件，五個功能點都有' : '缺功能點：' + funcs.filter(function (f) { return has.indexOf(f) < 0; }).map(function (f) { return DATA.FUNCS[f].label; }).join('、'), sheet: 'world', row: null, hint: '功能固定、外觀自由。' });
    var others = st.roles.filter(function (r) { return r !== m; });
    var rt = others.length ? DATA.route(m.walk, m.objects, DATA.abbrev(others[0].serial)) : { missing: '沒有別的角色' };
    out.push({ id: 'walk', no: '⑤', name: '走法', ok: !rt.missing, status: rt.missing ? rt.missing : '要去 ' + DATA.abbrev(others[0].serial) + '：' + rt.steps.join('，'), sheet: 'walk', row: null, hint: '繞哪個物件是哪個字母、從甲到乙是哪個數字。' });
    var f = FUSION.openFor(st, m.serial);
    var dep = m.departUs == null ? 'none' : m.departDone ? 'past' : FUSION.byDepart(st, m.departUs) ? 'fusion' : 'wait';
    // 在融合裡：出發點由融合的期限決定，這一步算完成
    out.push({ id: 'depart', no: '⑥', name: '出發點', ok: !!f || dep === 'wait', status: f ? '在融合裡，由融合的期限決定' : m.departUs == null ? '還沒寫' : DATA.fmtUs(m.departUs) + '（' + DSTATUS[dep] + '）', sheet: 'depart', row: m.serial, hint: '預定開始處理的那一微秒。' });
    if (f) {
      var ready = f.nextUs != null, sd = f.stages.length, allDone = FUSION.allStagesDone(f), mine = typeof f.calories[m.serial] === 'number';
      out.push({ id: 'fnext', no: '⑦', name: '約下一個出發點', ok: ready, status: ready ? DATA.fmtUs(f.nextUs) : f.nextProposal ? '等 ' + FUSION.active(f).filter(function (x) { return f.nextProposal.agreed.indexOf(x) < 0; }).map(roleName).join('、') + ' 同意' : '還沒有人提', sheet: 'fusion', row: f.id, hint: '全員同意才算約好，這就是期限。' });
      out.push({ id: 'fstage', no: '⑧', name: '拆階段', ok: sd > 0, status: sd ? sd + ' 個階段' : '還沒有階段', sheet: 'fusion', row: f.id, hint: '提出階段，全員同意才成立。' });
      var mineTodo = f.stages.filter(function (x) { return (x.status === 'proposed' && x.agreed.indexOf(m.serial) < 0) || (x.status === 'judging' && x.judges[m.serial] == null) || (x.status === 'doing' && x.owner === m.serial) || x.status === 'agreed' || (x.status === 'dispute' && !x.dispute[m.serial]); });
      out.push({ id: 'fdo', no: '⑨', name: '執行與判定', ok: sd > 0 && allDone, status: allDone && sd ? '全部判定完成' : mineTodo.length ? '你有 ' + mineTodo.length + ' 個階段要動作' : sd ? '等其他人' : '先拆階段', sheet: 'fusion', row: mineTodo.length ? mineTodo[0].id : f.id, hint: '認領、交判、判定；有爭議就全員同意改判。' });
      out.push({ id: 'fkcal', no: '⑩', name: '熱量', ok: mine, status: mine ? f.calories[m.serial] + ' 大卡' : allDone ? '輪到你填' : '所有階段判定完成後才能填', sheet: 'fusion', row: f.id, hint: '每個人都填了才算可處理。' });
    }
    var next = out.find(function (x) { return !x.ok; }) || null;
    return { rows: out, next: next, fusion: f };
  }

  /* ---------- 各張表 ---------- */
  var SHEETS = {
    next: { no: '', name: '下一步', desc: '照目前的狀態，一步一步把角色、難題、規則、世界、走法、出發點準備好；進入融合後，這裡列融合裡該做的事。',
      tables: [{ id: 'steps', rowId: function (x) { return x.id; },
        rows: function () { return steps().rows; },
        cls: function (x) { var n = steps().next; return n && n.id === x.id ? 'next' : ''; },
        cols: [
          { k: 'no', h: '步驟', v: function (x) { return x.no + ' ' + esc(x.name); } },
          { k: 'ok', h: '狀態', v: function (x) { var n = steps().next; return x.ok ? tag('ok', '完成') : n && n.id === x.id ? tag('open', '下一步') : tag('todo', '還沒'); } },
          { k: 'go', h: '動作', v: function (x) { return btn('jump', '去' + x.name, ' data-s="' + x.sheet + '"' + (x.row ? ' data-id="' + esc(x.row) + '"' : ''), (steps().next || {}).id === x.id ? 'pri' : ''); } },
          { k: 'st', h: '目前', v: function (x) { return '<span class="small">' + esc(x.status) + '</span>'; }, wrap: true },
          { k: 'hint', h: '說明', v: function (x) { return '<span class="muted small">' + esc(x.hint) + '</span>'; }, wrap: true }
        ],
        foot: function () { var s = steps(); return s.next ? '' : s.fusion ? '<div class="empty">融合的每一步都做完了，等期限那一微秒。</div>' : '<div class="empty">都準備好了。到裡世界走出代號，開傳送門去找人。 ' + btn('world', '去裡世界', '', 'pri') + '</div>'; } }] },

    roles: { no: 'Ⅰ', name: '角色', desc: '選「我是」就換角色玩。序號 11 位數，開頭幾個 0 就用第幾個字母縮寫。',
      tables: [{ id: 'roles', rowId: function (r) { return r.serial; }, rows: function () { return S().roles; }, mine: function (r) { return r === me(); },
        cols: [
          { k: 'me', h: '我是', v: function (r) { return '<label class="me"><input type="radio" name="meIs" data-ed="me" data-id="' + r.serial + '"' + (r === me() ? ' checked' : '') + '> ' + (r === me() ? '我' : '') + '</label>'; } },
          { k: 'serial', h: '序號', v: function (r) { return '<span class="num">' + r.serial + '</span>'; } },
          { k: 'code', h: '代號', v: function (r) { return '<b>' + DATA.abbrev(r.serial) + '</b>'; } },
          { k: 'name', h: '名字', v: function (r) { return inp('roleName', r.serial, r.name, ' aria-label="名字"'); } },
          { k: 'problem', h: '難題', v: function (r) { var p = DATA.activeProblem(r); return p ? L('problems', p.id, esc(p.text)) : L('problems', null, '<span class="muted">還沒立</span>'); } },
          { k: 'rules', h: '規則', v: function (r) { var c = DATA.currentRules(r); return c.no ? L('rules', r.serial + ':' + c.no, '第 ' + c.no + ' 版，' + c.items.length + ' 條') : dash; } },
          { k: 'world', h: '世界', v: function (r) { return L('world', r.serial + ':', r.objects.length + ' 個物件'); } },
          { k: 'walk', h: '走法', v: function (r) { return r === me() ? L('walk', null, r.walk.circles.length + ' 條繞圈、' + r.walk.moves.length + ' 條走到') : '<span class="small">' + r.walk.circles.length + ' 條繞圈、' + r.walk.moves.length + ' 條走到</span>'; } },
          { k: 'depart', h: '出發點', v: function (r) { return L('depart', r.serial, r.departUs == null ? '<span class="muted">還沒寫</span>' : esc(DATA.fmtUs(r.departUs))); } }
        ],
        add: { cells: function () { return { name: '<input type="text" id="addRoleName" placeholder="新角色的名字" aria-label="新角色的名字">', code: btn('addRole', '新增角色', '', 'pri') }; } } }] },

    problems: { no: 'Ⅱ', name: '難題', desc: '難題是自己想不出辦法的情況。一個角色同時只有一個進行中的難題；擱置的可以重創，註明前身。',
      tables: [{ id: 'problems', rowId: function (x) { return x.p.id; },
        rows: function () { var out = []; S().roles.forEach(function (r) { r.problems.forEach(function (p) { out.push({ role: r, p: p }); }); }); return out; },
        mine: function (x) { return x.role === me(); },
        cols: [
          { k: 'id', h: '編號', v: function (x) { return '<span class="num">' + esc(x.p.id) + '</span>'; } },
          { k: 'role', h: '角色', v: function (x) { return L('roles', x.role.serial, esc(roleName(x.role.serial))); } },
          { k: 'text', h: '難題', v: function (x) { return x.role === me() && x.p.status === 'open' ? inp('problemText', x.p.id, x.p.text, ' aria-label="難題"') : esc(x.p.text); }, wrap: true },
          { k: 'status', h: '狀態', v: function (x) { return tag(x.p.status, PSTATUS[x.p.status] || x.p.status); } },
          { k: 'prev', h: '前身', v: function (x) { return x.p.prev ? L('problems', x.p.prev, esc(x.p.prev)) : dash; } },
          { k: 'depart', h: '出發點', v: function (x) { return DATA.activeProblem(x.role) === x.p && x.role.departUs != null ? L('depart', x.role.serial, esc(DATA.fmtUs(x.role.departUs))) : dash; } },
          { k: 'fusion', h: '融合', v: function (x) { var f = S().fusions.find(function (f) { return f.problems.some(function (q) { return q.id === x.p.id; }); }); return f ? L('fusion', f.id, esc(f.text.slice(0, 16)) + (f.text.length > 16 ? '…' : '')) : dash; } },
          { k: 'act', h: '動作', v: function (x) {
            if (x.role !== me()) return '';
            if (x.p.status === 'open') return btn('shelveProblem', '擱置', ' data-id="' + x.p.id + '"');
            if (x.p.status === 'shelved' && !DATA.activeProblem(me())) return btn('recreate', '以此為前身重創', ' data-id="' + x.p.id + '"');
            return '';
          } }
        ],
        add: { cells: function () {
          var m = me(); if (DATA.activeProblem(m)) return { text: '<span class="auto">目前的難題還在進行，先擱置或完成它</span>' };
          var shelved = m.problems.filter(function (p) { return p.status === 'shelved' || p.status === 'exited'; });
          return { role: '<span class="small">' + esc(roleName(m.serial)) + '</span>', text: '<input type="text" id="addProblemText" placeholder="寫下自己想不出辦法的情況" aria-label="新難題">',
                   prev: shelved.length ? '<select id="addProblemPrev" aria-label="前身">' + opt('', '（沒有前身）', UI.prevPick || '') + shelved.map(function (p) { return opt(p.id, p.id + ' ' + p.text.slice(0, 10), UI.prevPick || ''); }).join('') + '</select>' : '<span class="auto">沒有擱置的</span>',
                   act: btn('addProblem', '立難題', '', 'pri') }; } } }] },

    rules: { no: 'Ⅲ', name: '規則', desc: '規則條目可增刪、每條設公開或只有自己；點數比例是 1 題點、1 戰點各換多少大卡能量點；資源是你能兌現的東西。按「儲存成新版本」才生效，點數會記下發出者當下的版本號。',
      toolbar: function () { return '<label class="small">看誰的規則 <select data-ed="rulesRole" aria-label="哪個角色的規則">' + S().roles.map(function (r) { return opt(r.serial, roleName(r.serial), rulesRole().serial); }).join('') + '</select></label>' + (rulesRole() === me() && draftDirty() ? '<span class="tag open">有沒儲存的修改</span>' + btn('discardDraft', '放棄修改') : ''); },
      tables: [
        { id: 'items', title: '規則條目', rowId: function (x, i) { return 'i' + i; },
          rows: function () { return editing() ? draft().items : DATA.currentRules(rulesRole()).items.filter(function (x) { return x.visible !== 'self' || rulesRole() === me(); }); },
          cols: [
            { k: 'no', h: '條', v: function (x, i) { return String(i + 1); } },
            { k: 'text', h: '內容', v: function (x, i) { return editing() ? inp('ruleText', i, x.text, ' aria-label="規則內容"') : esc(x.text); }, wrap: true },
            { k: 'vis', h: '誰看得到', v: function (x, i) { return editing() ? '<select data-ed="ruleVis" data-id="' + i + '" aria-label="誰看得到">' + opt('all', '公開', x.visible) + opt('self', '只有自己', x.visible) + '</select>' : (x.visible === 'self' ? '只有自己' : '公開'); } },
            { k: 'act', h: '動作', v: function (x, i) { return editing() ? btn('delRule', '刪', ' data-id="' + i + '"') : ''; } }
          ],
          add: { when: editing, cells: function () { return { text: '<input type="text" id="addRuleText" placeholder="新的一條規則" aria-label="新規則">', vis: '<select id="addRuleVis" aria-label="誰看得到"><option value="all">公開</option><option value="self">只有自己</option></select>', act: btn('addRule', '新增條目', '', 'pri') }; } },
          empty: '還沒有規則條目。' },
        { id: 'ratios', title: '點數比例', rowId: function (x) { return x.k; },
          rows: function () { var r = editing() ? draft().ratios : DATA.currentRules(rulesRole()).ratios; return [{ k: 'idea', name: '題點', kcal: r.idea }, { k: 'battle', name: '戰點', kcal: r.battle }]; },
          cols: [
            { k: 'name', h: '種類', v: function (x) { return esc(x.name); } },
            { k: 'kcal', h: '1 點換幾大卡', num: true, v: function (x) { return editing() ? '<input type="number" class="kc" min="1" step="10" data-ed="ratio" data-id="' + x.k + '" value="' + x.kcal + '" aria-label="' + x.name + '比例">' : String(x.kcal); } },
            { k: 'note', h: '說明', v: function (x) { return '<span class="muted small">' + (x.k === 'idea' ? '構思階段得到的點，換發出者的能量' : '執行階段得到的點，換發出者的能量') + '</span>'; }, wrap: true }
          ] },
        { id: 'resources', title: '資源', rowId: function (x, i) { return 'r' + i; },
          rows: function () { return editing() ? draft().resources : DATA.currentRules(rulesRole()).resources; },
          cols: [
            { k: 'name', h: '資源', v: function (x, i) { return editing() ? inp('resName', i, x.name, ' aria-label="資源名稱"') : esc(x.name); } },
            { k: 'kcal', h: '大卡', num: true, v: function (x, i) { return editing() ? '<input type="number" class="kc" min="0" step="10" data-ed="resKcal" data-id="' + i + '" value="' + x.kcal + '" aria-label="資源大卡">' : String(x.kcal); } },
            { k: 'act', h: '動作', v: function (x, i) { return editing() ? btn('delRes', '刪', ' data-id="' + i + '"') : ''; } }
          ],
          add: { when: editing, cells: function () { return { name: '<input type="text" id="addResName" placeholder="例如：陪跑一小時" aria-label="資源名稱">', kcal: '<input type="number" class="kc" id="addResKcal" placeholder="大卡" aria-label="大卡">', act: btn('addRes', '新增資源', '', 'pri') }; } },
          empty: '沒有資源。' },
        { id: 'versions', title: '歷史版本', rowId: function (v) { return rulesRole().serial + ':' + v.no; },
          rows: function () { return DATA.currentRules(rulesRole()).no ? rulesRole().ruleVersions.slice().reverse() : []; },
          cols: [
            { k: 'no', h: '版本', v: function (v) { return '第 ' + v.no + ' 版' + (v.no === DATA.currentRules(rulesRole()).no ? ' ' + tag('ok', '目前') : ''); } },
            { k: 'at', h: '儲存時間', v: function (v) { return v.atUs ? num(v.atUs) : dash; } },
            { k: 'n', h: '條目', num: true, v: function (v) { return String(v.items.length); } },
            { k: 'idea', h: '題點', num: true, v: function (v) { return String(v.ratios.idea); } },
            { k: 'battle', h: '戰點', num: true, v: function (v) { return String(v.ratios.battle); } },
            { k: 'res', h: '資源', v: function (v) { return v.resources.length ? esc(v.resources.map(function (x) { return x.name + ' ' + x.kcal; }).join('、')) : dash; }, wrap: true },
            { k: 'pts', h: '用到這版的點數', v: function (v) { var n = S().points.filter(function (p) { return p.from === rulesRole().serial && p.ruleVersion === String(v.no); }).length; return n ? L('points', null, n + ' 筆') : dash; } }
          ],
          add: { when: editing, cells: function () { return { no: btn('saveRules', '儲存成第 ' + (DATA.currentRules(me()).no + 1) + ' 版', '', 'pri'), at: '<span class="auto">儲存時記下</span>' }; } },
          empty: '還沒有版本。' }
      ] },

    world: { no: 'Ⅳ', name: '世界', desc: '功能固定，外觀自由。改外觀、換顏色、搬位置，走法表記的是物件本身，代號照樣有效。',
      toolbar: function () { return '<label class="small">哪個世界 <select data-ed="worldRole" aria-label="哪個世界">' + S().roles.map(function (r) { return opt(r.serial, roleName(r.serial), worldRole().serial); }).join('') + '</select></label>'; },
      tables: [{ id: 'objects', rowId: function (o) { return worldRole().serial + ':' + o.id; }, rows: function () { return worldRole().objects; },
        cols: [
          { k: 'name', h: '名稱', v: function (o) { return inp('objName', o.id, o.name, ' aria-label="名稱"'); } },
          { k: 'func', h: '功能', v: function (o) { return '<select data-ed="objFunc" data-id="' + o.id + '" aria-label="功能">' + Object.keys(DATA.FUNCS).map(function (k) { return opt(k, DATA.FUNCS[k].label, o.func); }).join('') + '</select>'; } },
          { k: 'look', h: '外觀', v: function (o) { return '<select data-ed="objLook" data-id="' + o.id + '" aria-label="外觀">' + Object.keys(DATA.LOOKS).map(function (k) { return opt(k, k, o.look); }).join('') + opt('', '（自訂形體）', o.look || '') + '</select>'; } },
          { k: 'color', h: '顏色', v: function (o) { return '<input type="color" data-ed="objColor" data-id="' + o.id + '" value="' + (o.parts[0] ? o.parts[0].color : '#999999') + '" aria-label="顏色">'; } },
          { k: 'x', h: 'x', num: true, v: function (o) { return '<input type="number" class="xy" data-ed="objX" data-id="' + o.id + '" value="' + o.pos[0] + '" step="1" aria-label="x">'; } },
          { k: 'z', h: 'z', num: true, v: function (o) { return '<input type="number" class="xy" data-ed="objZ" data-id="' + o.id + '" value="' + o.pos[1] + '" step="1" aria-label="z">'; } },
          { k: 'parts', h: '形體', num: true, v: function (o) { return String(o.parts.length); } },
          { k: 'walk', h: '走法用到', v: function (o) { var r = worldRole(), w = r.walk, out = []; w.circles.forEach(function (c, i) { if (c.object === o.id) out.push(r === me() ? L('walk', 'c' + i, '繞圈 ' + c.letter) : '繞圈 ' + c.letter); }); w.moves.forEach(function (m, i) { if (m.from === o.id || m.to === o.id) out.push(r === me() ? L('walk', 'm' + i, '走到 ' + m.digit) : '走到 ' + m.digit); }); return out.length ? out.join('、') : dash; } },
          { k: 'act', h: '動作', v: function (o) { return btn('delObj', '刪', ' data-id="' + o.id + '"'); } }
        ],
        add: { cells: function () { return { name: '<input type="text" id="addObjName" placeholder="新地標的名稱" aria-label="新地標">', func: '<span class="auto">地標（新增後可改）</span>', look: '<select id="addObjLook" aria-label="外觀">' + Object.keys(DATA.LOOKS).map(function (k) { return opt(k, k, '山'); }).join('') + '</select>', color: '<input type="color" id="addObjColor" value="#8A8F96" aria-label="顏色">', x: '<input type="number" class="xy" id="addObjX" value="0" aria-label="x">', z: '<input type="number" class="xy" id="addObjZ" value="0" aria-label="z">', act: btn('addObj', '新增', '', 'pri') }; } } }] },

    walk: { no: 'Ⅴ', name: '走法', desc: '繞某個物件一圈是哪個字母（兩圈就是前一個字母）；從甲走到乙是哪個數字。字母決定後面要走幾個數字：J 一個、I 兩個……沒有字母就直接走 11 個數字。',
      tables: [
        { id: 'circles', title: '繞圈', rowId: function (c, i) { return 'c' + i; }, rows: function () { return me().walk.circles; },
          cols: [
            { k: 'obj', h: '繞這個物件', v: function (c, i) { return '<select data-ed="circleObj" data-id="' + i + '" aria-label="物件">' + me().objects.map(function (o) { return opt(o.id, o.name, c.object); }).join('') + '</select> ' + L('world', me().serial + ':' + c.object, '⇢'); } },
            { k: 'letter', h: '一圈是', v: function (c, i) { return '<select data-ed="circleLetter" data-id="' + i + '" aria-label="一圈是">' + 'JIHGFEDCBA'.split('').map(function (Lx) { return opt(Lx, Lx, c.letter); }).join('') + '</select>'; } },
            { k: 'more', h: '兩圈、三圈', v: function (c) { return '<span class="muted small">' + prev(c.letter, 1) + '、' + prev(c.letter, 2) + '</span>'; } },
            { k: 'act', h: '動作', v: function (c, i) { return btn('delCircle', '刪', ' data-id="' + i + '"'); } }
          ],
          add: { cells: function () { return { obj: '<select id="addCircleObj" aria-label="物件">' + me().objects.map(function (o) { return opt(o.id, o.name, ''); }).join('') + '</select>', letter: '<select id="addCircleLetter" aria-label="一圈是">' + 'JIHGFEDCBA'.split('').map(function (Lx) { return opt(Lx, Lx, 'J'); }).join('') + '</select>', act: btn('addCircle', '加一條', '', 'pri') }; } },
          empty: '還沒有繞圈的走法。' },
        { id: 'moves', title: '走到', rowId: function (m, i) { return 'm' + i; }, rows: function () { return me().walk.moves; },
          cols: [
            { k: 'from', h: '從', v: function (m, i) { return '<select data-ed="moveFrom" data-id="' + i + '" aria-label="從">' + me().objects.map(function (o) { return opt(o.id, o.name, m.from); }).join('') + '</select> ' + L('world', me().serial + ':' + m.from, '⇢'); } },
            { k: 'to', h: '走到', v: function (m, i) { return '<select data-ed="moveTo" data-id="' + i + '" aria-label="走到">' + me().objects.map(function (o) { return opt(o.id, o.name, m.to); }).join('') + '</select> ' + L('world', me().serial + ':' + m.to, '⇢'); } },
            { k: 'digit', h: '是數字', v: function (m, i) { return '<select data-ed="moveDigit" data-id="' + i + '" aria-label="數字">' + '0123456789'.split('').map(function (d) { return opt(d, d, m.digit); }).join('') + '</select>'; } },
            { k: 'act', h: '動作', v: function (m, i) { return btn('delMove', '刪', ' data-id="' + i + '"'); } }
          ],
          add: { cells: function () { var os = me().objects; return { from: '<select id="addMoveFrom" aria-label="從">' + os.map(function (o) { return opt(o.id, o.name, os[0].id); }).join('') + '</select>', to: '<select id="addMoveTo" aria-label="走到">' + os.map(function (o) { return opt(o.id, o.name, (os[1] || os[0]).id); }).join('') + '</select>', digit: '<select id="addMoveDigit" aria-label="數字">' + '0123456789'.split('').map(function (d) { return opt(d, d, '1'); }).join('') + '</select>', act: btn('addMove', '加一條', '', 'pri') }; } },
          empty: '還沒有走到的走法。' },
        { id: 'targets', title: '要去哪裡', rowId: function (r) { return r.serial; }, rows: function () { return S().roles.filter(function (r) { return r !== me(); }); },
          cols: [
            { k: 'code', h: '代號', v: function (r) { return L('roles', r.serial, '<b>' + DATA.abbrev(r.serial) + '</b> ' + esc(r.name)); } },
            { k: 'route', h: '用我的走法怎麼走', v: function (r) { var rt = DATA.route(me().walk, me().objects, DATA.abbrev(r.serial)); return rt.missing ? '<span class="tag shelve">' + esc(rt.missing) + '</span>' : esc(rt.steps.join('，')); }, wrap: true },
            { k: 'act', h: '動作', v: function (r) { return btn('portal', '直接開傳送門', ' data-id="' + DATA.abbrev(r.serial) + '"'); } }
          ],
          add: { cells: function () { return { code: '<input type="text" id="codeIn" placeholder="輸入代號，例如 J2" autocapitalize="characters" aria-label="代號" style="width:9em">', act: btn('portalIn', '開傳送門', '', 'pri') }; } } }
      ] },

    depart: { no: 'Ⅵ', name: '出發點', desc: '出發點是預定開始處理的時間，精確到微秒。原型用「幾秒後」代替手填。設好後傳送過去，站在他的終點上等那一微秒；自己的出發點到了沒人來，難題就擱置。融合中的出發點要在融合頁全員約定。',
      tables: [{ id: 'depart', rowId: function (r) { return r.serial; }, rows: function () { return S().roles; }, mine: function (r) { return r === me(); },
        cols: [
          { k: 'role', h: '角色', v: function (r) { return L('roles', r.serial, esc(roleName(r.serial))); } },
          { k: 'at', h: '出發點', v: function (r) { return r.departUs == null ? dash : num(r.departUs); } },
          { k: 'st', h: '狀態', v: function (r) { var d = r.departUs == null ? 'none' : r.departDone ? 'past' : FUSION.byDepart(S(), r.departUs) ? 'fusion' : 'wait'; return tag({ none: 'todo', past: 'shelve', fusion: 'open', wait: 'ok' }[d], DSTATUS[d]); } },
          { k: 'left', h: '還有', v: function (r) { if (r.departUs == null || r.departDone) return dash; var d = (r.departUs - DATA.nowUs()) / 1e6; return '<span class="num">' + (d > 0 ? d.toFixed(0) + ' 秒' : '已到') + '</span>'; } },
          { k: 'problem', h: '難題', v: function (r) { var p = DATA.activeProblem(r); return p ? L('problems', p.id, esc(p.text)) : dash; } },
          { k: 'fusion', h: '融合', v: function (r) { var f = FUSION.openFor(S(), r.serial); return f ? L('fusion', f.id, '融合的期限') : dash; } },
          { k: 'act', h: '動作', v: function (r) { if (FUSION.openFor(S(), r.serial)) return '<span class="auto">在融合頁約</span>'; return btn('setDepart', '30 秒後', ' data-id="' + r.serial + '" data-s="30"') + ' ' + btn('setDepart', '90 秒後', ' data-id="' + r.serial + '" data-s="90"') + ' ' + btn('setDepart', '清掉', ' data-id="' + r.serial + '" data-s="0"'); } }
        ] }] },

    fusion: { no: 'Ⅶ', name: '融合', desc: '相遇之後的關卡：全員同意約下一個出發點（就是期限；沒約好不能拆階段、不能執行）、拆階段（全員同意才成立，構思者得題點）、認領執行、至少兩人共判（有人判未完成就是爭議，全員同意才能改判）、所有階段完成後每個人填熱量。動作都是以「我是」的角色做的。',
      tables: [
        { id: 'fusions', title: '融合難題', rowId: function (f) { return f.id; }, rows: function () { return S().fusions.slice().reverse(); }, mine: function (f) { return FUSION.isMember(f, me().serial); },
          cols: [
            { k: 'st', h: '狀態', v: function (f) { return tag(f.status, FUSION.FSTATUS[f.status]); } },
            { k: 'text', h: '融合難題', v: function (f) { return esc(f.text); }, wrap: true },
            { k: 'members', h: '參與者', v: function (f) { return f.members.map(function (m) { var t = L('roles', m, esc(roleName(m))); return f.exits.indexOf(m) >= 0 ? '<s>' + t + '</s>' : t; }).join('、'); } },
            { k: 'problems', h: '原難題', v: function (f) { return f.problems.map(function (q) { return q.id ? L('problems', q.id, esc(q.id)) : esc(q.text.slice(0, 8)); }).join('、'); } },
            { k: 'next', h: '下一個出發點', v: function (f) {
              var mine = FUSION.isMember(f, me().serial), open = f.status === 'open';
              if (f.nextUs != null) return num(f.nextUs);
              if (f.nextProposal) return '<span class="small">' + esc(roleName(f.nextProposal.by)) + ' 提議 ' + esc(DATA.fmtUs(f.nextProposal.us)) + '，同意的：' + f.nextProposal.agreed.map(roleName).map(esc).join('、') + '</span>' + (mine && open && f.nextProposal.agreed.indexOf(me().serial) < 0 ? ' ' + btn('fAgreeNext', '同意', ' data-id="' + f.id + '"', 'pri') : '');
              return tag('open', '還沒約') + (mine && open ? ' ' + btn('fProposeNext', '60 秒後', ' data-id="' + f.id + '" data-s="60"') + ' ' + btn('fProposeNext', '3 分鐘後', ' data-id="' + f.id + '" data-s="180"') : '');
            }, wrap: true },
            { k: 'stages', h: '階段', v: function (f) { var n = f.stages.length; return n ? L('fusion', f.stages[0].id, n + ' 個（' + f.stages.filter(function (s) { return s.status === 'done'; }).length + ' 完成）') : (f.nextUs == null && f.status === 'open' ? tag('open', '先約下一個出發點') : dash); } },
            { k: 'kcal', h: '熱量', v: function (f) {
              if (!FUSION.allStagesDone(f)) return '<span class="auto">所有階段判定完成後才能填</span>';
              return FUSION.active(f).map(function (m) { var v = f.calories[m]; return esc(roleName(m)) + '：' + (m === me().serial && f.status === 'open' ? '<input type="number" class="kc" min="0" step="10" data-ed="kcal" data-id="' + f.id + '" value="' + (v == null ? '' : v) + '" aria-label="熱量"> 大卡' : (v == null ? '<span class="muted">還沒填</span>' : '<span class="num">' + v + ' 大卡</span>')); }).join('<br>');
            }, wrap: true },
            { k: 'act', h: '動作', v: function (f) { return FUSION.isMember(f, me().serial) && f.status === 'open' ? btn('fExit', '退出', ' data-id="' + f.id + '"') : ''; } },
            { k: 'log', h: '紀錄', v: function (f) { return '<span class="small">' + f.log.slice(-3).map(function (l) { return esc(l.text); }).join('；') + '</span>'; }, wrap: true }
          ],
          empty: '還沒有融合。到別人的世界，在他的出發點那一微秒站在終點上。' },
        { id: 'stages', title: '階段', rowId: function (x) { return x.st.id; },
          rows: function () { var out = []; S().fusions.slice().reverse().forEach(function (f) { f.stages.forEach(function (st) { out.push({ f: f, st: st }); }); }); return out; },
          mine: function (x) { return x.st.owner === me().serial || x.st.by === me().serial; },
          cols: [
            { k: 'fusion', h: '融合', v: function (x) { return L('fusion', x.f.id, esc(x.f.text.slice(0, 12)) + (x.f.text.length > 12 ? '…' : '')); } },
            { k: 'text', h: '階段', v: function (x) { return esc(x.st.text); }, wrap: true },
            { k: 'by', h: '構思', v: function (x) { return L('roles', x.st.by, esc(roleName(x.st.by))); } },
            { k: 'st', h: '狀態', v: function (x) { return tag(x.st.status, FUSION.STATUS[x.st.status]); } },
            { k: 'owner', h: '執行者', v: function (x) { return x.st.owner ? L('roles', x.st.owner, esc(roleName(x.st.owner))) : dash; } },
            { k: 'act', h: '動作', v: function (x) { return stageActions(x.f, x.st); }, wrap: true },
            { k: 'pts', h: '點數', v: function (x) { var n = S().points.filter(function (p) { return p.stage === x.st.id; }).length; return n ? L('points', null, n + ' 筆') : dash; } }
          ],
          add: { when: function () { var f = FUSION.openFor(S(), me().serial); return !!f; }, cells: function () {
            var f = FUSION.openFor(S(), me().serial);
            if (f.nextUs == null) return { text: tag('open', '先約下一個出發點') + ' <span class="auto">約好才能拆階段、執行</span>' };
            return { fusion: '<span class="small">' + esc(f.text.slice(0, 12)) + '</span>', text: '<input type="text" id="addStageText" placeholder="拆一個階段，例如：訂出開工時間" aria-label="新階段">', by: '<span class="small">' + esc(roleName(me().serial)) + '</span>', act: btn('fProposeStage', '提出階段', ' data-id="' + f.id + '"', 'pri') }; } },
          empty: '還沒有階段。' }
      ] },

    points: { no: 'Ⅷ', name: '點數', desc: '題點在階段全員同意時發出，戰點在判定完成時發出；每筆都記發出者、拿到的人、發出者當下的規則版本，事後不能取消。這一輪還不做兌換。',
      toolbar: function () { var p = FUSION.pointsOf(S(), me().serial); return tag('ok', '我拿到 題點 ' + p.got.idea + '・戰點 ' + p.got.battle) + tag('open', '我發出 題點 ' + p.gave.idea + '・戰點 ' + p.gave.battle); },
      tables: [{ id: 'points', rowId: function (p) { return p.id; }, rows: function () { return S().points.slice().reverse(); }, mine: function (p) { return p.to === me().serial || p.from === me().serial; },
        cols: [
          { k: 'at', h: '時間', v: function (p) { return num(p.atUs); } },
          { k: 'kind', h: '種類', v: function (p) { return p.kind === 'idea' ? '題點' : '戰點'; } },
          { k: 'from', h: '發出者', v: function (p) { return L('roles', p.from, esc(roleName(p.from))); } },
          { k: 'to', h: '拿到', v: function (p) { return L('roles', p.to, esc(roleName(p.to))); } },
          { k: 'n', h: '數量', num: true, v: function (p) { return String(p.amount); } },
          { k: 'ver', h: '規則版本', v: function (p) { return L('rules', p.from + ':' + p.ruleVersion, '第 ' + esc(p.ruleVersion) + ' 版'); } },
          { k: 'kcal', h: '可換', v: function (p) { var r = roleOf(p.from), v = r && (r.ruleVersions || []).find(function (x) { return String(x.no) === p.ruleVersion; }); return v ? '<span class="num">' + (p.amount * v.ratios[p.kind]) + ' 大卡</span>' : dash; } },
          { k: 'fusion', h: '融合', v: function (p) { var f = fusionOf(p.fusion); return f ? L('fusion', f.id, esc(f.text.slice(0, 10)) + '…') : dash; } },
          { k: 'stage', h: '階段', v: function (p) { var x = findStage(p.stage); return x ? L('fusion', x.st.id, esc(x.st.text)) : dash; }, wrap: true }
        ], empty: '還沒有點數。' }] },

    records: { no: 'Ⅸ', name: '紀錄', desc: '相遇、擱置、退出的紀錄。',
      toolbar: function () { return btn('resetAll', '全部還原成預設'); },
      tables: [{ id: 'records', rowId: function (x, i) { return 'r' + i; }, rows: function () { return S().records.slice().reverse(); },
        cols: [
          { k: 'at', h: '時間', v: function (x) { return num(x.at); } },
          { k: 'kind', h: '種類', v: function (x) { return tag(x.kind, { meet: '相遇', shelve: '擱置', exit: '退出' }[x.kind] || x.kind); } },
          { k: 'text', h: '內容', v: function (x) { return esc(x.text); }, wrap: true }
        ], empty: '還沒有紀錄。' }] }
  };
  function prev(Lx, n) { var c = Lx.charCodeAt(0) - n; return c >= 65 ? String.fromCharCode(c) : '—'; }
  function stageActions(f, st) {
    var m = me().serial;
    if (!FUSION.isMember(f, m) || f.status !== 'open') return '';
    if (f.nextUs == null) return '<span class="auto">先約下一個出發點</span>';
    var a = function (act, label, cls) { return btn(act, label, ' data-id="' + st.id + '"', cls); };
    switch (st.status) {
      case 'proposed': return st.agreed.indexOf(m) < 0 ? a('sAgree', '同意', 'pri') : '<span class="auto">等其他人同意</span>';
      case 'agreed': return a('sClaim', '我來執行');
      case 'doing': return st.owner === m ? a('sSubmit', '做完了，交判') : '';
      case 'judging': return st.judges[m] == null ? a('sJudgeOk', '判完成', 'pri') + ' ' + a('sJudgeNo', '判未完成') : '<span class="auto">等其他人判</span>';
      case 'dispute': return (st.dispute[m] ? '<span class="auto">你投了' + (st.dispute[m] === 'done' ? '完成' : '退回') + '</span> ' : '') + a('sDisputeDone', '改判完成') + ' ' + a('sDisputeBack', '退回執行');
    }
    return '';
  }

  /* ---------- 規則草稿 ---------- */
  function rulesRole() { return roleOf(UI.rulesRole) || me(); }
  function worldRole() { return roleOf(UI.worldRole) || me(); }
  function editing() { return rulesRole() === me(); }
  function draft() {
    if (!UI.draft || UI.draftFor !== me().serial) { UI.draft = JSON.parse(JSON.stringify(DATA.currentRules(me()))); delete UI.draft.no; delete UI.draft.atUs; UI.draftFor = me().serial; }
    return UI.draft;
  }
  function draftDirty() { var c = DATA.currentRules(me()); var d = draft(); return JSON.stringify({ i: d.items, r: d.ratios, s: d.resources }) !== JSON.stringify({ i: c.items, r: c.ratios, s: c.resources }); }

  /* ---------- 通用表格 ---------- */
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
    h += '<div class="nextbar">' + btn('nextSheet', '下一步 → ' + SHEETS[nx.sheet].name, '', 'pri') + '</div>';
    $('main').innerHTML = h;
    renderTabs();
    $('nameBox').textContent = Sh.no || Sh.name; $('nameBox').title = Sh.name; $('fxVal').textContent = '';
    $('backBtn').disabled = !UI.hist.length;
    if (UI.focus) focusRow(); else $('view-sheet').scrollTop = render.last === sk ? scroll : 0;
    render.last = sk;
  }
  function nextSheet() {
    if (UI.sheet === 'next') { var n = steps().next; return n ? { sheet: n.sheet, id: n.row } : { sheet: 'fusion', id: null }; }
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
  function sheetMsg(t) { var el = $('sheetMsg'); if (!el) { APP.msg(t); return; } el.textContent = t; el.hidden = false; setTimeout(function () { el.hidden = true; }, 3200); }

  /* ---------- 跳轉與返回 ---------- */
  function navigate(sheet, id) {
    if (!SHEETS[sheet]) return;
    UI.hist.push({ sheet: UI.sheet }); if (UI.hist.length > 60) UI.hist.shift();
    UI.sheet = sheet; UI.focus = id || null;
    // 跳到別人的世界那一列：先切到那個世界
    if (sheet === 'world' && id && id.indexOf(':') > 0) UI.worldRole = id.split(':')[0];
    if (sheet === 'rules' && id && id.indexOf(':') > 0) UI.rulesRole = id.split(':')[0];
    if (!APP.isWorld()) render(); else { APP.showTab('sheet'); }
  }
  function back() { var h = UI.hist.pop(); if (!h) return; UI.sheet = h.sheet; UI.focus = null; render(); }

  /* ---------- 動作（按鈕） ---------- */
  function run(fn, ok) {
    try { var r = fn(); APP.save(); render(); if (ok) sheetMsg(ok); return r; }
    catch (e) { sheetMsg(e.message); return null; }
  }
  var v = function (id) { var el = $(id); return el ? el.value : ''; };
  var ACT = {
    world: function () { APP.showTab('world'); },
    go: function (b) { navigate(b.dataset.s, null); },
    jump: function (b) { navigate(b.dataset.s, b.dataset.id || null); },
    nextSheet: function () { var n = nextSheet(); navigate(n.sheet, n.id); },
    resetAll: function () { UI.draft = null; APP.resetAll(); },
    // 角色
    addRole: function () { run(function () {
      var name = v('addRoleName').trim(); if (!name) throw new Error('先寫名字');
      var n = S().roles.length + 1, serial = String(n).padStart(11, '0');
      var base = DATA.defaultRoles()[0];
      var r = { serial: serial, name: name, color: '#586676', departUs: null, departDone: false, ruleVersions: [], problems: [], start: [0, 6], objects: JSON.parse(JSON.stringify(base.objects)), path: [[0, 6], [6, -2]], walk: JSON.parse(JSON.stringify(base.walk)) };
      r.rules = [];
      S().roles.push(DATA.cleanWorld(r));
    }, '新增了角色'); },
    // 難題
    addProblem: function () { run(function () { var p = DATA.addProblem(me(), v('addProblemText'), v('addProblemPrev') || null); UI.prevPick = null; UI.focus = p.id; }, '立了難題'); },
    recreate: function (b) { UI.prevPick = b.dataset.id; render(); var el = $('addProblemText'); if (el) el.focus(); },
    shelveProblem: function (b) { run(function () { var x = findProblem(b.dataset.id); if (!x || x.role !== me()) throw new Error('只能擱置自己的難題'); if (FUSION.openFor(S(), me().serial)) throw new Error('在融合裡的難題，退出融合才會擱置'); x.p.status = 'shelved'; me().departUs = null; me().departDone = false; APP.record('shelve', roleName(me().serial) + ' 主動擱置難題「' + x.p.text + '」。'); }, '擱置了'); },
    // 規則
    discardDraft: function () { UI.draft = null; render(); },
    addRule: function () { run(function () { var t = v('addRuleText').trim(); if (!t) throw new Error('先寫內容'); draft().items.push({ text: t, visible: v('addRuleVis') || 'all' }); }); },
    delRule: function (b) { draft().items.splice(+b.dataset.id, 1); render(); },
    addRes: function () { run(function () { var n = v('addResName').trim(); if (!n) throw new Error('先寫資源名稱'); draft().resources.push({ name: n, kcal: +v('addResKcal') || 0 }); }); },
    delRes: function (b) { draft().resources.splice(+b.dataset.id, 1); render(); },
    saveRules: function () { run(function () { var ver = DATA.saveRules(me(), draft()); UI.draft = null; UI.focus = me().serial + ':' + ver.no; }, '儲存成新版本'); },
    // 世界
    addObj: function () { run(function () {
      var r = worldRole(), name = v('addObjName').trim(); if (!name) throw new Error('先寫名稱');
      var id = 'o' + Date.now().toString(36);
      var o = { id: id, name: name, func: 'none', pos: [+v('addObjX') || 0, +v('addObjZ') || 0], look: v('addObjLook') || '山', parts: DATA.look(v('addObjLook') || '山', v('addObjColor') || '#8A8F96') };
      r.objects.push(o); APP.worldRefresh(r); UI.focus = r.serial + ':' + id;
    }, '新增了地標'); },
    delObj: function (b) { run(function () {
      var r = worldRole(), id = b.dataset.id;
      if (r.objects.length <= 1) throw new Error('至少留一個物件');
      r.objects = r.objects.filter(function (o) { return o.id !== id; });
      r.walk.circles = r.walk.circles.filter(function (c) { return c.object !== id; });
      r.walk.moves = r.walk.moves.filter(function (m) { return m.from !== id && m.to !== id; });
      APP.worldRefresh(r); if (r === me()) APP.walkChanged();
    }, '刪掉了，用到它的走法也一起刪'); },
    // 走法
    addCircle: function () { run(function () { me().walk.circles.push({ object: v('addCircleObj'), letter: v('addCircleLetter') || 'J' }); APP.walkChanged(); }); },
    delCircle: function (b) { run(function () { me().walk.circles.splice(+b.dataset.id, 1); APP.walkChanged(); }); },
    addMove: function () { run(function () { if (v('addMoveFrom') === v('addMoveTo')) throw new Error('從和走到要不同'); me().walk.moves.push({ from: v('addMoveFrom'), to: v('addMoveTo'), digit: v('addMoveDigit') || '1' }); APP.walkChanged(); }); },
    delMove: function (b) { run(function () { me().walk.moves.splice(+b.dataset.id, 1); APP.walkChanged(); }); },
    portal: function (b) { APP.openPortal(b.dataset.id); },
    portalIn: function () { var c = v('codeIn').trim().toUpperCase(); if (c) APP.openPortal(c); },
    // 出發點
    setDepart: function (b) { run(function () {
      var r = roleOf(b.dataset.id), s = +b.dataset.s;
      if (FUSION.openFor(S(), r.serial)) throw new Error(r.name + ' 在融合裡，出發點要在融合頁全員約定');
      if (s && !DATA.activeProblem(r)) throw new Error(r.name + ' 還沒立難題，先到難題頁立一個');
      r.departUs = s ? DATA.nowUs() + s * 1e6 + Math.floor(Math.random() * 1000) : null;
      r.departDone = false;
    }); },
    // 融合
    fProposeNext: function (b) { run(function () { FUSION.proposeNext(S(), fusionOf(b.dataset.id), me().serial, DATA.nowUs() + (+b.dataset.s) * 1e6 + Math.floor(Math.random() * 1000)); }); },
    fAgreeNext: function (b) { run(function () { FUSION.agreeNext(S(), fusionOf(b.dataset.id), me().serial); }); },
    fProposeStage: function (b) { run(function () { var st = FUSION.proposeStage(S(), fusionOf(b.dataset.id), me().serial, v('addStageText')); UI.focus = st.id; }); },
    fExit: function (b) { run(function () { FUSION.exit(S(), fusionOf(b.dataset.id), me().serial); }, '退出了'); },
    sAgree: function (b) { stageDo(b, function (f, st) { FUSION.agreeStage(S(), f, st.id, me().serial); }); },
    sClaim: function (b) { stageDo(b, function (f, st) { FUSION.claimStage(S(), f, st.id, me().serial); }); },
    sSubmit: function (b) { stageDo(b, function (f, st) { FUSION.submitStage(S(), f, st.id, me().serial); }); },
    sJudgeOk: function (b) { stageDo(b, function (f, st) { FUSION.judge(S(), f, st.id, me().serial, true); }); },
    sJudgeNo: function (b) { stageDo(b, function (f, st) { FUSION.judge(S(), f, st.id, me().serial, false); }); },
    sDisputeDone: function (b) { stageDo(b, function (f, st) { FUSION.disputeVote(S(), f, st.id, me().serial, 'done'); }); },
    sDisputeBack: function (b) { stageDo(b, function (f, st) { FUSION.disputeVote(S(), f, st.id, me().serial, 'back'); }); }
  };
  function stageDo(b, fn) { run(function () { var x = findStage(b.dataset.id); if (!x) throw new Error('沒有這個階段'); fn(x.f, x.st); }); }

  /* ---------- 編輯（輸入框、下拉） ---------- */
  var EDIT = {
    me: function (id) { APP.becomeMe(roleIdx(roleOf(id))); },
    roleName: function (id, val) { roleOf(id).name = val; },
    problemText: function (id, val) { var x = findProblem(id); if (x) x.p.text = val; },
    rulesRole: function (id, val) { UI.rulesRole = val; },
    worldRole: function (id, val) { UI.worldRole = val; },
    ruleText: function (id, val) { draft().items[+id].text = val; },
    ruleVis: function (id, val) { draft().items[+id].visible = val; },
    ratio: function (id, val) { draft().ratios[id] = +val; },
    resName: function (id, val) { draft().resources[+id].name = val; },
    resKcal: function (id, val) { draft().resources[+id].kcal = +val; },
    objName: function (id, val) { objEdit(id, function (o) { o.name = val; }); },
    objFunc: function (id, val) { objEdit(id, function (o) { o.func = val; }); },
    objX: function (id, val) { objEdit(id, function (o) { o.pos[0] = +val || 0; }); },
    objZ: function (id, val) { objEdit(id, function (o) { o.pos[1] = +val || 0; }); },
    objLook: function (id, val) { objEdit(id, function (o) { if (val) { o.look = val; o.parts = DATA.look(val, o.parts[0] ? o.parts[0].color : '#999999'); } else o.look = ''; }); },
    objColor: function (id, val) { objEdit(id, function (o) { if (o.look) o.parts = DATA.look(o.look, val); else if (o.parts[0]) o.parts[0].color = val; }); },
    circleObj: function (id, val) { me().walk.circles[+id].object = val; APP.walkChanged(); },
    circleLetter: function (id, val) { me().walk.circles[+id].letter = val; APP.walkChanged(); },
    moveFrom: function (id, val) { me().walk.moves[+id].from = val; APP.walkChanged(); },
    moveTo: function (id, val) { me().walk.moves[+id].to = val; APP.walkChanged(); },
    moveDigit: function (id, val) { me().walk.moves[+id].digit = val; APP.walkChanged(); },
    kcal: function (id, val) { FUSION.setCalories(S(), fusionOf(id), me().serial, +val); }
  };
  function objEdit(id, fn) { var r = worldRole(), o = r.objects.find(function (x) { return x.id === id; }); if (!o) return; fn(o); APP.worldRefresh(r, o.id); }

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
      if (t.dataset.ed === 'me') return;   // becomeMe 已經重畫
      render();
    } finally { busy = false; }
  });
  $('backBtn').addEventListener('click', back);

  renderTabs();
  return { render: render, renderTabs: renderTabs, navigate: navigate, back: back, steps: steps, ui: UI, ORDER: ORDER, SHEETS: SHEETS };
})();
