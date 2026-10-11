/* ===== v9 共用：狀態、存檔、今天的提醒、新手教學、那一微秒的判定 =====
 * 表格世界（table.js）只透過這裡和 CORE 做事；第 2 輪的達秒屋也一樣。
 */
var APP = (function () {
  'use strict';
  var state = CORE.load();
  var now = CORE.nowUs;
  // 還沒創角色（me = -1）：畫面用一個不在 roles 裡的空殼
  function roleFor() { return state.me >= 0 && state.roles[state.me] ? state.roles[state.me] : CORE.blankRole(); }
  var me = roleFor();
  var handlers = {};
  var away = [];   // 最近一次「你不在的時候」的結果（補判），今天那一頁列出來
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function on(name, fn) { (handlers[name] = handlers[name] || []).push(fn); }
  function emit(name, a, b) { (handlers[name] || []).forEach(function (fn) { fn(a, b); }); }
  function save() { CORE.save(state); }
  function changed() { save(); emit('change'); }
  var roleOf = function (serial) { return CORE.roleOf(state, serial); };
  var ver = function (r) { return CORE.version(r, now()); };
  var pend = function (r) { return CORE.pending(r, now()); };

  // 動作：規則函式擋下也可能已經改了資料，所以失敗也存檔、重畫
  function run(fn, okMsg) {
    var r = null, msg = okMsg || '', ok = true;
    try { r = fn(); } catch (e) { msg = e.message; ok = false; }
    changed();
    return { ok: ok, msg: msg, value: r };
  }

  /* ---------- 換人（單機版測試用）、創角色、全部重來、不玩了 ---------- */
  function becomeMe(i) { if (!state.roles[i]) return; state.me = i; me = state.roles[i]; changed(); emit('me'); }
  function isBlank() { return !!me.blank; }
  // 創角色：當下生效，放在最前面（J1）；第一樣東西「空的」在這裡建、補貨。skip＝只做教學第 1 步
  function createPlayer(f, skip) {
    if (!isBlank()) throw new Error('已經有角色了');
    var r = CORE.createPlayer(state, f, now());
    me = r;
    if (skip) { tut().step = 'done'; tut().skipped = true; }
    changed(); emit('me'); tutTick();
    return r;
  }
  // 測試和示範用：放一個示範的「我」（J1），教學算跳過
  function demo() { if (!isBlank()) return; CORE.demoMe(state, now()); me = state.roles[0]; tut().step = 'done'; tut().skipped = true; changed(); emit('me'); }
  function resetAll() { state = CORE.fresh(); me = roleFor(); away = []; changed(); emit('me'); }
  function quit(serial) {
    var n = CORE.quit(state, serial, now(), true);
    if (!state.roles.length) { state = CORE.fresh(); }
    if (tutActive()) { tut().step = 'done'; tut().skipped = true; }   // 教學中不玩了：教學就此結束
    state.me = 0; me = state.roles[0]; emit('me');
    return n;
  }

  /* ---------- 今天：下一步和提醒 ---------- */
  function steps() {
    if (tutActive()) return tutSteps();
    var m = me, t = now(), out = [], v = ver(m), p = pend(m);
    out.push({ id: 'role', no: '①', name: '每天的點', ok: true, status: CORE.abbrev(m.serial) + ' ' + m.name + '，每天 ' + v.dailyPoints + ' 點' + (p && p.dailyPoints !== v.dailyPoints ? '（明天起 ' + p.dailyPoints + '）' : '') + '，今天還能給 ' + CORE.remainingToday(state, m, t), sheet: 'role' });
    var ru = v.rules, hasRules = ru.uses.length > 0 || ru.conditions.length > 0 || !!ru.village;
    out.push({ id: 'rules', no: '②', name: '寫規則表', ok: hasRules, status: hasRules ? ru.uses.length + ' 條用途、' + ru.conditions.length + ' 條條件' + (ru.bothMustPass ? '、要兩方都通' : '') + (ru.mustAcceptVillage ? '、要接受家規' : '') : '規則表是空的' + (p ? '；明天起的版本已經寫了' : ''), sheet: 'rules' });
    var avail = CORE.availTotal(m, t);
    var empties = v.resources.filter(function (x) { return x.price === 0; }), emptyAvail = empties.reduce(function (n, x) { return n + CORE.stockOf(m, x.id).avail; }, 0);
    var emptyHint = !empties.length ? '想只收不給，要先建一個 0 點的空物件（例如「空的：什麼都不給」），可以一次補很多份' : emptyAvail === 0 ? '0 點的「' + empties[0].name + '」可換 0 份，先補貨，才能只收不給' : '';
    out.push({ id: 'resources', no: '③', name: '資源表', ok: v.resources.length > 0 && avail > 0 && !emptyHint, status: (v.resources.length ? v.resources.map(function (x) { return x.name + ' ' + x.price + ' 點，可換 ' + CORE.stockOf(m, x.id).avail; }).join('、') : '沒有資源') + (emptyHint ? '；' + emptyHint : ''), sheet: 'resources', emptyHint: emptyHint });
    var up = m.slots.filter(function (s) { return s.atUs > t; });
    out.push({ id: 'slots', no: '④', name: '開對接時段', ok: up.length > 0, status: up.length ? up.length + ' 個未來時段，最近 ' + CORE.fmtUs(up.sort(function (a, b) { return a.atUs - b.atUs; })[0].atUs) : '沒有開放的時段', sheet: 'myslots' });
    var booked = CORE.myBookings(state, m, t).filter(function (b) { return b.slot.atUs > t; });
    var chosen = booked.filter(function (b) { return CORE.wantsValid(state, b.slot, m.serial, b.owner.serial).length > 0; });
    var unconfirmed = booked.filter(function (b) { return !CORE.isPresent(state, m.serial, b.slot.id); });
    var cv = CORE.canVisit(state, m, t);
    out.push({ id: 'query', no: '⑤', name: '預約、選要換的東西', ok: booked.length > 0 && chosen.length === booked.length && !unconfirmed.length, status: booked.length ? '預約了 ' + booked.map(function (b) { return b.owner.name + ' ' + CORE.fmtUs(b.slot.atUs).slice(11, 19) + (CORE.wantsValid(state, b.slot, m.serial, b.owner.serial).length ? '（選好了）' : '（還沒選要換什麼）') + (CORE.isPresent(state, m.serial, b.slot.id) ? '' : '（還沒確認到達：沒確認就算錯過）'); }).join('、') : cv.length ? '我可以去找：' + cv.map(function (r) { return r.name; }).join('、') : '目前沒有我符合條件的人', sheet: booked.length ? 'booked' : 'find' });
    var next = out.find(function (x) { return !x.ok; }) || null;
    var hint = unconfirmed.length ? '還沒確認到達：沒確認就算錯過（' + unconfirmed.map(function (b) { return b.owner.name + ' ' + CORE.fmtUs(b.slot.atUs).slice(11, 19); }).join('、') + '）' : next ? '下一步：' + next.name : booked.length ? '等那一微秒：' + booked[0].owner.name + ' ' + CORE.fmtUs(booked[0].slot.atUs).slice(11, 19) : '都準備好了，去找人';
    return { rows: out, next: next, hint: hint };
  }

  /* ---------- 新手教學（DESIGN 7-4）：第 1 輪做 1～7 步，第 8 步（看自己的達秒屋）第 2 輪做 ---------- */
  var GUIDE = CORE.GUIDE, TUT_SLOT_US = 60e6;   // 引路人的時段：走到預約那一步才開，大約一分鐘後
  function tut() { return state.tutorial; }
  function tutActive() { return tut().step !== 'done'; }
  function guide() { return CORE.roleOf(state, GUIDE); }
  function emptyOf(r, atUs) { var v = CORE.version(r, atUs || now()); return v.resources.find(function (x) { return x.price === 0; }) || null; }
  function tutSlot() { var x = tut().slot ? CORE.slotOf(state, tut().slot) : null; return x ? x.slot : null; }
  function tutDocking() { var s = tutSlot(); if (!s) return null; return state.dockings.find(function (d) { return d.slot === s.id && d.traded && (d.a === me.serial || d.b === me.serial); }) || null; }
  function tutHold(issuer, holder) { var d = tutDocking(); if (!d) return null; return state.holds.find(function (h) { return h.docking === d.id && h.issuer === issuer && h.holder === holder; }) || null; }
  // 每一步：名字、怎麼做、到哪一張表、做完沒
  var TUT = [
    { id: 't1', name: '創角色', how: '在「我的／角色」填名字、每天的點（預設 2000）、第一樣東西「空的」（0 點，補 1 份），按「建立」', sheet: 'role', done: function () { return !isBlank(); } },
    { id: 't2', name: '找陌生人一：隨機', how: '按最上面的「隨機」，跳到一個陌生人的表格世界，看看他的規則和能給的東西', sheet: 'today', done: function () { return !!tut().random; } },
    { id: 't3', name: '找陌生人二：在公告欄找序號', how: '打開「公告欄／公告」，找到引路人的公告（需要：空的；可以給：空的），記下他的序號，在最上面的序號框輸入，按「去」', sheet: 'notices', done: function () { return !!tut().found; } },
    { id: 't4', name: '看他的家規', how: '在引路人的表格世界打開「規則表」：家規那一段沒有家規網站，表示他不收留言', sheet: 'rules', who: GUIDE, done: function () { return !!tut().sawRules; } },
    { id: 't5', name: '預約、選他的「空的」', how: '在引路人的「時段」按「約他」（到達的勾預設勾著，預約時就確認到達），再到「預約／我預約的」選他的「空的」。引路人一定會選你的「空的」', sheet: 'slots', who: GUIDE,
      done: function () { var s = tutSlot(); if (!s || s.bookings.indexOf(me.serial) < 0 || !CORE.isPresent(state, me.serial, s.id)) return false; var g = guide(); return CORE.wantsValid(state, s, me.serial, GUIDE).some(function (id) { var x = CORE.resourceOf(CORE.version(g, s.atUs), id); return x && x.price === 0; }); } },
    { id: 't6', name: '那一微秒', how: '大約一分鐘後，白光一閃，跳出成交結果：「我拿出：空的；拿到：引路人的空的」。不用守著', sheet: 'booked', done: function () { return !!tutDocking(); } },
    { id: 't7', name: '兌現', how: '到「我的／背包」，在引路人的那一筆按「兌現」', sheet: 'bag', done: function () { var h = tutHold(GUIDE, me.serial); return !!h && h.status === 'redeemed'; } }
  ];
  var NO = ['①', '②', '③', '④', '⑤', '⑥', '⑦'];
  function tutSteps() {
    var T = tut(), rows = TUT.map(function (x, i) { return { id: x.id, no: NO[i], name: x.name, ok: i + 1 < T.step, status: x.how, sheet: x.sheet, who: x.who || null, tut: true }; });
    var next = rows[T.step - 1] || null;
    return { rows: rows, next: next, hint: next ? '教學 ' + next.no + ' ' + next.name + '：' + next.status : '', tutorial: true };
  }
  // 畫面告訴我發生了什麼：按了隨機、用序號找到引路人、看了引路人的規則表
  function tutEvent(name) { var T = tut(); if (!tutActive()) return; if (name === 'random') T.random = true; if (name === 'foundGuide' && T.step >= 3) T.found = true; if (name === 'sawGuideRules' && T.step >= 4) T.sawRules = true; tutTick(); }
  function tutSkip() { var T = tut(); if (!tutActive() || isBlank()) return; T.step = 'done'; T.skipped = true; changed(); emit('tut', 'done'); }
  // 每格：步驟做完就往下走；引路人的自動化（開時段、選玩家的「空的」、玩家兌現了他也兌現）
  function tutTick() {
    var T = tut(); if (!tutActive() || typeof T.step !== 'number' || isBlank()) return;
    var g = guide(); if (!g) { T.step = 'done'; return; }
    var dirty = false, t = now();
    if (T.step >= 5 && T.step <= 6) {
      var s = tutSlot();
      if (!s || (s.judged && !tutDocking())) { s = CORE.addSlot(state, GUIDE, t + TUT_SLOT_US + Math.floor(Math.random() * 1000), 1, null, t); T.slot = s.id; if (T.step === 6) T.step = 5; dirty = true; }   // 走到預約那一步才開；錯過了再開一個
      if (s.bookings.indexOf(me.serial) >= 0 && !s.judged) { var e = emptyOf(me, s.atUs); if (e && CORE.wantsValid(state, s, GUIDE, me.serial).indexOf(e.id) < 0) { CORE.setWants(state, s.id, GUIDE, me.serial, [e.id]); dirty = true; } }   // 引路人一定選玩家的「空的」
    }
    var guard = 0;
    while (typeof T.step === 'number' && T.step <= TUT.length && TUT[T.step - 1].done() && guard++ < 10) {
      if (T.step === 7) { var h = tutHold(me.serial, GUIDE); if (h && h.status === 'held') { try { CORE.redeem(state, GUIDE, h.id, t); } catch (err) { /* 換不到就算了 */ } } }   // 玩家兌現了，引路人也兌現玩家的「空的」
      T.step++; dirty = true;
      if (T.step > TUT.length) T.step = 'done';   // 第 8 步（看自己的達秒屋）第 2 輪做
    }
    if (dirty) { changed(); emit('tut', T.step); }
  }

  /* ---------- 那一微秒：每格判定（到達＝事先確認了；主人視為到達）；頁面沒開著過了的時段照時間順序補判 ---------- */
  setInterval(function () {
    var t = now();
    tutTick();
    var res = CORE.judge(state, t), dirty = res.length > 0;
    if (CORE.expire(state, t)) dirty = true;
    if (dirty) changed();
    if (res.length) {
      var mine = res.filter(function (x) { return x.late && (x.docking ? (x.docking.a === me.serial || x.docking.b === me.serial) : x.missed === me.serial); });
      if (mine.length) away = mine;
      tutTick(); emit('dock', res);
    }
  }, 50);

  return {
    state: function () { return state; }, me: function () { return me; }, now: now, esc: esc, opt: opt, ver: ver, pend: pend,
    on: on, emit: emit, save: save, changed: changed, run: run, roleOf: roleOf,
    becomeMe: becomeMe, resetAll: resetAll, quit: quit, isBlank: isBlank, createPlayer: createPlayer, demo: demo,
    tut: tut, tutActive: tutActive, tutEvent: tutEvent, tutSkip: tutSkip, tutTick: tutTick, GUIDE: GUIDE,
    steps: steps, away: function () { return away; }
  };
})();
