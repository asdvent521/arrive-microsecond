/* ===== v8 共用：狀態、存檔、待辦、那一微秒的判定、兩種介面的切換 =====
 * 裡世界（game.js）和表世界（sheet.js）都只透過這裡和 CORE 做事，彼此不互相呼叫。
 */
var APP = (function () {
  'use strict';
  var state = CORE.load();
  var now = CORE.nowUs;
  // 還沒創角色（me = -1）：畫面用一個不在 roles 裡的空殼
  function roleFor() { return state.me >= 0 && state.roles[state.me] ? state.roles[state.me] : CORE.blankRole(); }
  var me = roleFor();
  var handlers = {};
  var view = 'game';
  var focus = { role: null, func: null };          // 切換時停在同一件事：哪個角色、哪個功能
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function on(name, fn) { (handlers[name] = handlers[name] || []).push(fn); }
  function emit(name, a, b) { (handlers[name] || []).forEach(function (fn) { fn(a, b); }); }
  function save() { CORE.save(state); }
  function changed() { save(); emit('change'); }
  var roleOf = function (serial) { return CORE.roleOf(state, serial); };
  var allObjs = function (r) { return CORE.allObjects(r.world).map(function (x) { return x.o; }); };
  var ver = function (r) { return CORE.version(r, now()); };
  var pend = function (r) { return CORE.pending(r, now()); };

  // 動作：規則函式擋下也可能已經改了資料，所以失敗也存檔、重畫
  function run(fn, okMsg) {
    var r = null, msg = okMsg || '', ok = true;
    try { r = fn(); } catch (e) { msg = e.message; ok = false; }
    changed();
    return { ok: ok, msg: msg, value: r };
  }

  /* ---------- 換人（單機版測試用）、全部重來 ---------- */
  function becomeMe(i) { if (!state.roles[i]) return; state.me = i; me = state.roles[i]; changed(); emit('me'); }
  function isBlank() { return !!me.blank; }
  // 創角色：當下生效，放在最前面（J1）；第一樣東西「空的」在這裡建、補貨。skip＝只做教學第 1 步
  function createPlayer(f, skip) {
    if (!isBlank()) throw new Error('已經有角色了');
    var r = CORE.createPlayer(state, f, now());
    me = r; tut().found = false; tut().saw = false;
    if (skip) { tut().step = 'done'; tut().skipped = true; }
    changed(); emit('me'); tutTick();
    return r;
  }
  // 測試和示範用：放一個示範的「我」（J1），教學算跳過
  function demo() { if (!isBlank()) return; CORE.demoMe(state, now()); me = state.roles[0]; tut().step = 'done'; tut().skipped = true; changed(); emit('me'); }
  function resetAll() { state = CORE.fresh(); me = roleFor(); focus = { role: null, func: null }; changed(); emit('me'); }
  // 不玩了：刪掉角色後換成第一個還在的人
  function quit(serial) {
    var n = CORE.quit(state, serial, now(), true);
    if (!state.roles.length) { state = CORE.fresh(); }
    if (tutActive()) { tut().step = 'done'; tut().skipped = true; }   // 教學中不玩了：教學就此結束
    state.me = 0; me = state.roles[0]; emit('me');
    return n;
  }

  /* ---------- 待辦／任務提示（兩種介面共用） ---------- */
  function steps() {
    if (tutActive()) return tutSteps();
    var m = me, t = now(), out = [], v = ver(m), p = pend(m);
    out.push({ id: 'role', no: '①', name: '每天的點', ok: true, status: CORE.abbrev(m.serial) + ' ' + m.name + '，每天 ' + v.dailyPoints + ' 點' + (p && p.dailyPoints !== v.dailyPoints ? '（明天起 ' + p.dailyPoints + '）' : '') + '，今天還能給 ' + CORE.remainingToday(state, m, t), func: 'role', hint: '一人一個角色。改每天的點隔天生效。' });
    var ru = v.rules, hasRules = ru.uses.length > 0 || ru.conditions.length > 0 || !!ru.village;
    out.push({ id: 'rules', no: '②', name: '寫規則與條件', ok: hasRules, status: hasRules ? ru.uses.length + ' 條用途、' + ru.conditions.length + ' 條條件' + (ru.bothMustPass ? '、要兩方都通' : '') + (ru.mustAcceptVillage ? '、要接受村規' : '') : '規則表是空的' + (p ? '；明天起的版本已經寫了' : ''), func: 'rule', hint: '我的點能做什麼、對接條件（固定格式）、村規。改了隔天生效。' });
    var avail = CORE.availTotal(m, t);
    var empties = v.resources.filter(function (x) { return x.price === 0; }), emptyAvail = empties.reduce(function (n, x) { return n + CORE.stockOf(m, x.id).avail; }, 0);
    var emptyHint = !empties.length ? '想只收不給，要先建一個 0 點的空物件（例如「空的：什麼都不給」），可以一次補很多份' : emptyAvail === 0 ? '0 點的「' + empties[0].name + '」可換 0 份，先補貨，才能只收不給' : '';
    out.push({ id: 'resources', no: '③', name: '資源', ok: v.resources.length > 0 && avail > 0 && !emptyHint, status: (v.resources.length ? v.resources.map(function (x) { return x.name + ' ' + x.price + ' 點，可換 ' + CORE.stockOf(m, x.id).avail; }).join('、') : '沒有資源') + (emptyHint ? '；' + emptyHint : ''), func: 'resource', hint: '我的點能換的東西和價格。沒貨就給不出點。一換一：想只收不給要有 0 點的空物件。', emptyHint: emptyHint });
    var funcs = ['rule', 'resource', 'goal', 'role'], has = funcs.filter(function (f) { return allObjs(m).some(function (o) { return o.func === f; }); });
    var others = state.roles.filter(function (r) { return r !== m; });
    var rt = others.length ? CORE.route(m.world.walk, allObjs(m), CORE.abbrev(others[0].serial)) : { missing: '沒有別的角色' };
    out.push({ id: 'world', no: '④', name: '世界與走法', ok: has.length === funcs.length && !rt.missing, status: (has.length === funcs.length ? '四個公開功能點都有' : '缺：' + funcs.filter(function (f) { return has.indexOf(f) < 0; }).map(function (f) { return CORE.FUNCS[f].label; }).join('、')) + '；' + (rt.missing ? rt.missing : '要去 ' + CORE.abbrev(others[0].serial) + '：' + rt.steps.join('，')), func: 'build', hint: '功能固定、外觀自由；走法決定代號怎麼走。' });
    var up = m.slots.filter(function (s) { return s.atUs > t; });
    out.push({ id: 'slots', no: '⑤', name: '開對接時段', ok: up.length > 0, status: up.length ? up.length + ' 個未來時段，最近 ' + CORE.fmtUs(up.sort(function (a, b) { return a.atUs - b.atUs; })[0].atUs) : '沒有開放的時段', func: 'goal', hint: '別人要預約才能來對接；名額是容量不是條件。單機版主人不在場：主人要的東西，要「換人」成主人去選。' });
    var booked = CORE.myBookings(state, m, t).filter(function (b) { return b.slot.atUs > t; });
    var chosen = booked.filter(function (b) { return CORE.wantsValid(state, b.slot, m.serial, b.owner.serial).length > 0; });
    var unconfirmed = booked.filter(function (b) { return !CORE.isPresent(state, m.serial, b.slot.id); });
    var cv = CORE.canVisit(state, m, t);
    out.push({ id: 'query', no: '⑥', name: '預約、選要換的東西、確認到場', ok: booked.length > 0 && chosen.length === booked.length && !unconfirmed.length, status: booked.length ? '預約了 ' + booked.map(function (b) { return b.owner.name + ' ' + CORE.fmtUs(b.slot.atUs).slice(11, 19) + (CORE.wantsValid(state, b.slot, m.serial, b.owner.serial).length ? '（選好了）' : '（還沒選要換什麼）') + (CORE.isPresent(state, m.serial, b.slot.id) ? '' : '（還沒確認到場：沒確認就算錯過）'); }).join('、') : cv.length ? '我可以去找：' + cv.map(function (r) { return r.name; }).join('、') : '目前沒有我符合條件的人', func: 'map', hint: '條件通才能預約；那一微秒之前選好要換他的什麼、確認到場（勾了就算，不用守著）。一換一：對方也要選了你的東西才成交；單機版對方要的東西，要「換人」成他去選。' });
    var next = out.find(function (x) { return !x.ok; }) || null;
    var place = { role: '走到角色碑', rule: '走到規則屋', resource: '走到市集', build: '按「建造」', goal: '走到終點台', map: '打開地圖' };
    var hint = unconfirmed.length ? '還沒確認到場：沒確認就算錯過（' + unconfirmed.map(function (b) { return b.owner.name + ' ' + CORE.fmtUs(b.slot.atUs).slice(11, 19); }).join('、') + '）' : next ? '下一步：' + next.name + ' → ' + place[next.func] : booked.length ? '等那一微秒：' + booked[0].owner.name + ' ' + CORE.fmtUs(booked[0].slot.atUs).slice(11, 19) + '，到時候站在他的終點上' : '都準備好了，去找人';
    return { rows: out, next: next, hint: hint };
  }

  /* ---------- 新手教學（DESIGN 7-4）：只有一份步驟，在哪個世界就講那個世界的做法 ---------- */
  var GUIDE = CORE.GUIDE, TUT_SLOT_US = 60e6;   // 引路人的時段：走到預約那一步才開，大約一分鐘後
  function tut() { return state.tutorial; }
  function tutActive() { var st = tut().step; return st !== 'done'; }
  function guide() { return CORE.roleOf(state, GUIDE); }
  function emptyOf(r, atUs) { var v = CORE.version(r, atUs || now()); return v.resources.find(function (x) { return x.price === 0; }) || null; }
  function tutSlot() { var x = tut().slot ? CORE.slotOf(state, tut().slot) : null; return x ? x.slot : null; }
  function tutDocking() { var s = tutSlot(); if (!s) return null; return state.dockings.find(function (d) { return d.slot === s.id && d.traded && (d.a === me.serial || d.b === me.serial); }) || null; }
  function tutHold(issuer, holder) { var d = tutDocking(); if (!d) return null; return state.holds.find(function (h) { return h.docking === d.id && h.issuer === issuer && h.holder === holder; }) || null; }
  // 每一步：名字、裡世界怎麼做、表世界怎麼做、做完沒
  var TUT = [
    { id: 't1', name: '創角色', name2: '補 1 份空的', game: '取名字、每天的點、第一樣東西「空的」（0 點，補 1 份），按「建立」', game2: '走到市集，「補貨、減貨」把「空的」補 1 份', sheet: '在「角色」最下面一列填名字、每天的點、第一樣東西「空的」，按「建立」', sheet2: '在「資源」把「空的」補 1 份', gfunc: 'role', gfunc2: 'resource', ssheet: 'roles', ssheet2: 'resources',
      done: function () { if (isBlank()) return false; if (tut().round === 1) return true; var e = emptyOf(me); return !!e && CORE.stockOf(me, e.id).avail >= 1; } },
    { id: 't2', name: '找引路人', game: '打開地圖，點引路人 J4，照地上的光點走出他的代號，進傳送門', sheet: '在「我可以去找」點引路人的代號 J4', gfunc: 'map', ssheet: 'visit', done: function () { return !!tut().found; } },
    { id: 't3', name: '預約、選他的「空的」', game: '在引路人的終點台看時刻表，預約，選他的「空的」，存好。引路人一定會選你的「空的」', sheet: '在「可預約時段」預約引路人，到「我預約的」選他的「空的」。引路人一定會選你的「空的」', gfunc: 'goal', who: GUIDE, ssheet: 'open',
      done: function () { var s = tutSlot(); if (!s || s.bookings.indexOf(me.serial) < 0) return false; var g = guide(); return CORE.wantsValid(state, s, me.serial, GUIDE).some(function (id) { var x = CORE.resourceOf(CORE.version(g, s.atUs), id); return x && x.price === 0; }); } },
    { id: 't4', name: '那一微秒', game: '站在他的終點台上，或在時刻表按「確認到場」，等那一微秒', sheet: '在「我預約的」勾到場（勾了就算，不用守著），等那一微秒', gfunc: 'goal', who: GUIDE, ssheet: 'booked', done: function () { return !!tutDocking(); } },
    { id: 't5', name: '看拿到什麼', game: '回家，走到帳房看看', sheet: '到「點數」看那一筆', gfunc: 'points', ssheet: 'points', done: function () { return !!tut().saw; } },
    { id: 't6', name: '兌現', game: '到引路人的市集，兌現「空的」', sheet: '到「兌現」（看誰：引路人），按「兌現」', gfunc: 'resource', who: GUIDE, ssheet: 'redeem', done: function () { var h = tutHold(GUIDE, me.serial); return !!h && h.status === 'redeemed'; } }
  ];
  // 走完不要再走一次：到另一個世界帶看對照，剛才那筆交換在這邊的哪裡
  var CMP = [
    { id: 'c1', name: '那一微秒在哪裡', game: '引路人的終點台', sheet: '「我預約的」那一列（已對接）', gfunc: 'goal', who: GUIDE, ssheet: 'booked' },
    { id: 'c2', name: '拿到的東西記在哪裡', game: '帳房', sheet: '「點數」', gfunc: 'points', ssheet: 'points' },
    { id: 'c3', name: '在哪裡兌現', game: '引路人的市集', sheet: '「兌現」（看誰：引路人）', gfunc: 'resource', who: GUIDE, ssheet: 'redeem' },
    { id: 'c4', name: '紀錄在哪裡', game: '角色碑的「歷史紀錄」', sheet: '「對接紀錄」（標「教學」）', gfunc: 'role', ssheet: 'dockings' }
  ];
  var ROUND_NO = ['①', '②', '③', '④', '⑤', '⑥'];
  function tutSteps() {
    var T = tut(), r2 = T.round === 2, rows = [], v = view;
    if (T.step === 'compare') {
      var other = v === 'game' ? '表世界' : '裡世界';
      CMP.forEach(function (c, i) { rows.push({ id: c.id, no: ROUND_NO[i], name: c.name, ok: i < T.cmp, status: '剛才' + other + '的' + (v === 'game' ? c.sheet : c.game) + '，在這邊是' + (v === 'game' ? c.game : c.sheet), func: v === 'game' ? c.gfunc : c.ssheet, who: c.who, tut: 'cmp', last: i === CMP.length - 1, hint: '' }); });
      var cur = rows[Math.min(T.cmp, CMP.length - 1)];
      return { rows: rows, next: cur, hint: '對照 ' + cur.no + ' ' + cur.name + '：' + cur.status, tutorial: 'compare' };
    }
    TUT.forEach(function (x, i) {
      var k = i + 1, done = typeof T.step === 'number' ? k < T.step : true;
      rows.push({ id: x.id, no: ROUND_NO[i], name: r2 && x.name2 ? x.name2 : x.name, ok: done, status: v === 'game' ? (r2 && x.game2 ? x.game2 : x.game) : (r2 && x.sheet2 ? x.sheet2 : x.sheet), func: v === 'game' ? (r2 && x.gfunc2 ? x.gfunc2 : x.gfunc) : (r2 && x.ssheet2 ? x.ssheet2 : x.ssheet), who: x.who, tut: 'step', hint: '' });
    });
    if (T.step === 7) { var ask = { id: 'ask', no: '？', name: '要不要用另一種介面再走一次？', ok: false, status: '要：切到' + (v === 'game' ? '表世界' : '裡世界') + '，從「補 1 份空的」再跟引路人換一次。不要：切過去帶看對照，看完切回來', func: null, tut: 'ask', hint: '' }; rows.push(ask); return { rows: rows, next: ask, hint: '教學走完了！' + ask.name, tutorial: 'ask' }; }
    var next = rows[T.step - 1];
    return { rows: rows, next: next, hint: '教學 ' + next.no + ' ' + next.name + '：' + next.status, tutorial: 'step' };
  }
  function tutEvent(name) { var T = tut(); if (!tutActive()) return; if (name === 'foundGuide') T.found = true; if (name === 'sawPoints') T.saw = true; tutTick(); }
  function tutSkip() { var T = tut(); if (!tutActive() || isBlank()) return; T.step = 'done'; T.skipped = true; changed(); emit('tut', 'done'); }
  function tutAnswer(yes) {
    var T = tut(); if (T.step !== 7) return;
    T.firstView = view; T.choice = yes ? 'yes' : 'no';
    var other = view === 'game' ? 'sheet' : 'game';
    if (yes) { T.round = 2; T.step = 1; T.found = false; T.saw = false; T.slot = null; }
    else { T.step = 'compare'; T.cmp = 0; }
    changed(); switchTo(other); emit('tut', T.step);
  }
  function tutNext() {
    var T = tut(); if (T.step !== 'compare') return;
    T.cmp++;
    if (T.cmp >= CMP.length) { T.step = 'done'; changed(); switchTo(T.firstView || view); emit('tut', 'done'); return; }
    changed(); emit('tut', 'compare');
  }
  // 每格：步驟做完就往下走；引路人的自動化（開時段、選玩家的「空的」、玩家兌現了他也兌現）
  function tutTick() {
    var T = tut(); if (!tutActive() || typeof T.step !== 'number' || isBlank()) return;
    var g = guide(); if (!g) { T.step = 'done'; return; }
    var dirty = false, t = now();
    // 走到預約那一步才開時段；錯過了再開一個
    if (T.step >= 3 && T.step <= 4) {
      var s = tutSlot();
      if (!s || (s.judged && !tutDocking())) { s = CORE.addSlot(state, GUIDE, t + TUT_SLOT_US + Math.floor(Math.random() * 1000), 1, null, t); T.slot = s.id; if (T.step === 4) T.step = 3; dirty = true; }
      // 玩家預約了：引路人一定選玩家的「空的」
      if (s.bookings.indexOf(me.serial) >= 0 && !s.judged) { var e = emptyOf(me, s.atUs); if (e && CORE.wantsValid(state, s, GUIDE, me.serial).indexOf(e.id) < 0) { CORE.setWants(state, s.id, GUIDE, me.serial, [e.id]); dirty = true; } }
    }
    var guard = 0;
    while (typeof T.step === 'number' && T.step <= 6 && TUT[T.step - 1].done() && guard++ < 8) {
      if (T.step === 6) { var h = tutHold(me.serial, GUIDE); if (h && h.status === 'held') { try { CORE.redeem(state, GUIDE, h.id, t); } catch (e) { /* 換不到就算了 */ } } }   // 玩家兌現了，引路人也兌現玩家的「空的」
      T.step++; dirty = true;
      if (T.step === 7 && T.round === 2) { T.step = 'done'; }   // 第二輪走完就結束，不再問
    }
    if (dirty) { changed(); emit('tut', T.step); }
  }

  /* ---------- 那一微秒：每格判定（到場＝站在終點上或勾了到場；主人視為到場） ---------- */
  var standingAt = null;    // 裡世界告訴我：我正站在哪個角色的終點上
  function setStanding(serial) { standingAt = serial || null; }
  function countMissed() { var n = 0; state.roles.forEach(function (r) { r.slots.forEach(function (s) { n += (s.missed || []).length; }); }); return n; }
  setInterval(function () {
    var t = now(), standing = {}; if (standingAt) standing[me.serial] = standingAt;
    tutTick();
    var missedBefore = countMissed();
    var res = CORE.judge(state, t, standing), dirty = res.length > 0;
    if (CORE.expire(state, t)) dirty = true;
    if (dirty) changed();
    if (res.length) { tutTick(); emit('dock', res); }   // res 也含補判（late）和錯過（missed）的項目   // 教學先往下走，成交訊息才不會被蓋掉
    if (countMissed() > missedBefore) emit('miss');
  }, 50);

  /* ---------- 切換：停在同一件事上 ---------- */
  var focusAtSwitch = '';     // 切到表世界那一刻的焦點；切回來時比對焦點真的有沒有變
  function setFocus(f) { focus = Object.assign({}, focus, f || {}); }
  function getFocus() { return focus; }
  function switchTo(v) { view = v; if (v === 'sheet') focusAtSwitch = JSON.stringify(focus); emit('view', v); }
  function currentView() { return view; }

  return {
    state: function () { return state; }, me: function () { return me; }, now: now, esc: esc, opt: opt, ver: ver, pend: pend,
    on: on, emit: emit, save: save, changed: changed, run: run, roleOf: roleOf, allObjs: allObjs,
    becomeMe: becomeMe, resetAll: resetAll, quit: quit, isBlank: isBlank, createPlayer: createPlayer, demo: demo,
    tut: tut, tutActive: tutActive, tutEvent: tutEvent, tutSkip: tutSkip, tutAnswer: tutAnswer, tutNext: tutNext, tutTick: tutTick, GUIDE: GUIDE,
    steps: steps, setStanding: setStanding, standingAt: function () { return standingAt; },
    setFocus: setFocus, focus: getFocus, focusChanged: function () { return JSON.stringify(focus) !== focusAtSwitch; }, switchTo: switchTo, view: currentView
  };
})();
