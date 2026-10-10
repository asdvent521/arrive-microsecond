/* ===== v7 共用：狀態、存檔、草稿、待辦、那一微秒的判定、兩種介面的切換 =====
 * 裡世界（game.js）和表世界（sheet.js）都只透過這裡和 CORE 做事，彼此不互相呼叫。
 */
var APP = (function () {
  'use strict';
  var state = CORE.load();
  var me = state.roles[state.me] || state.roles[0];
  var now = CORE.nowUs;
  var handlers = {};
  var view = 'game';
  var focus = { role: null, func: null };          // 切換時停在同一件事：哪個角色、哪個功能
  var gives = {};                                  // 要給多少點，照時段記
  var docked = {};                                 // 這一輪已經判過的時段
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function opt(v, label, sel) { return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function on(name, fn) { (handlers[name] = handlers[name] || []).push(fn); }
  function emit(name, a, b) { (handlers[name] || []).forEach(function (fn) { fn(a, b); }); }
  function save() { CORE.save(state); }
  function changed() { save(); emit('change'); }
  var roleOf = function (serial) { return CORE.roleOf(state, serial); };
  var allObjs = function (r) { return CORE.allObjects(r.world).map(function (x) { return x.o; }); };

  // 動作：規則函式擋下也可能已經改了資料（例如兌現失敗自動空窗），所以失敗也存檔、重畫
  function run(fn, okMsg) {
    var r = null, msg = okMsg || '', ok = true;
    try { r = fn(); } catch (e) { msg = e.message; ok = false; }
    changed();
    return { ok: ok, msg: msg, value: r };
  }

  /* ---------- 角色 ---------- */
  function becomeMe(i) { state.me = i; me = state.roles[i]; docked = {}; changed(); emit('me'); }
  function resetAll() { state = CORE.fresh(); me = state.roles[0]; docked = {}; gives = {}; focus = { role: null, func: null }; changed(); emit('me'); }

  /* ---------- 草稿：新角色創建前的名字、每天的點、週期、規則、資源 ---------- */
  function draft() { return state.draft || null; }
  function startDraft(fields) {
    state.draft = Object.assign({ name: '', dailyPoints: 1800, days: 30, prev: null, contact: '', rules: { uses: [], conditions: [], bothMustPass: false, mustAcceptVillage: false, village: '' }, resources: [] }, fields || {});
    changed(); return state.draft;
  }
  function draftFrom(r) { return startDraft({ name: r.name, dailyPoints: r.dailyPoints, days: 30, prev: r.serial, contact: r.contact, rules: JSON.parse(JSON.stringify(r.rules)), resources: r.resources.map(function (x) { return { name: x.name, price: x.price, qty: x.qty }; }) }); }
  function dropDraft() { state.draft = null; changed(); }
  function createFromDraft() {
    var d = draft(); if (!d) throw new Error('沒有草稿');
    if (!d.name || !String(d.name).trim()) throw new Error('先取名字');
    var t = now();
    var r = CORE.createRole(state, { name: d.name, dailyPoints: d.dailyPoints, life: { startUs: t, endUs: t + (d.days || 30) * CORE.DAY_US }, rules: d.rules, resources: d.resources, contact: d.contact, prev: d.prev }, t);
    state.draft = null;
    becomeMe(state.roles.indexOf(r));
    return r;
  }
  function endEarly(serial) {
    var r = roleOf(serial);
    CORE.endEarly(state, r.serial, now(), Object.keys(CORE.holdersOf(state, r.serial, now())));   // 單機：持有人都在本機，視為同意
    return draftFrom(r);
  }

  /* ---------- 待辦／任務提示（兩種介面共用） ---------- */
  var STATUS = { active: '正常', vacancy: '空窗', ended: '已結束' };
  function steps() {
    var m = me, t = now(), out = [], d = draft();
    var status = CORE.status(m, t);
    out.push({ id: 'role', no: '①', name: '建角色', ok: status !== 'ended', status: CORE.abbrev(m.serial) + ' ' + m.name + '，每天 ' + m.dailyPoints + ' 點，剩 ' + Math.floor(CORE.daysLeft(m, t)) + ' 天（' + STATUS[status] + '）' + (d ? '；有一個草稿還沒創' : ''), func: 'role', hint: '每天的點、週期。週期內規則不能改，要改就結束再重創。' });
    var ru = m.rules, hasRules = ru.uses.length > 0 || ru.conditions.length > 0 || !!ru.village;
    out.push({ id: 'rules', no: '②', name: '寫規則與條件', ok: hasRules, status: hasRules ? ru.uses.length + ' 條用途、' + ru.conditions.length + ' 條條件' + (ru.bothMustPass ? '、要兩方都通' : '') + (ru.mustAcceptVillage ? '、要接受村規' : '') : '規則表是空的（要改得結束再重創）', func: 'rule', hint: '我的點能做什麼、對接條件（固定格式）、村規。' });
    out.push({ id: 'resources', no: '③', name: '資源', ok: m.resources.length > 0, status: m.resources.length ? m.resources.map(function (x) { return x.name + ' ' + x.price + ' 點×' + x.qty; }).join('、') : '沒有資源', func: 'resource', hint: '我的點能兌現的東西和價格。數量可以隨時補。' });
    var funcs = ['rule', 'resource', 'goal', 'role'], has = funcs.filter(function (f) { return allObjs(m).some(function (o) { return o.func === f; }); });
    var others = state.roles.filter(function (r) { return r !== m && CORE.status(r, t) !== 'ended'; });
    var rt = others.length ? CORE.routeV7(m.world.walk, allObjs(m), CORE.abbrev(others[0].serial)) : { missing: '沒有別的角色' };
    out.push({ id: 'world', no: '④', name: '世界與走法', ok: has.length === funcs.length && !rt.missing, status: (has.length === funcs.length ? '四個公開功能點都有' : '缺：' + funcs.filter(function (f) { return has.indexOf(f) < 0; }).map(function (f) { return CORE.FUNCS[f].label; }).join('、')) + '；' + (rt.missing ? rt.missing : '要去 ' + CORE.abbrev(others[0].serial) + '：' + rt.steps.join('，')), func: 'build', hint: '功能固定、外觀自由；走法決定代號怎麼走。' });
    var up = m.slots.filter(function (s) { return s.atUs > t; });
    out.push({ id: 'slots', no: '⑤', name: '開對接時段', ok: up.length > 0, status: up.length ? up.length + ' 個未來時段，最近 ' + CORE.fmtUs(up.sort(function (a, b) { return a.atUs - b.atUs; })[0].atUs) : '沒有開放的時段', func: 'goal', hint: '別人要預約才能來對接；名額是容量不是條件。' });
    var booked = CORE.myBookings(state, m, t).filter(function (b) { return b.slot.atUs > t; });
    var cv = CORE.canVisit(state, m, t);
    out.push({ id: 'query', no: '⑥', name: '去查詢、預約別人', ok: booked.length > 0, status: booked.length ? '預約了 ' + booked.map(function (b) { return b.owner.name + ' ' + CORE.fmtUs(b.slot.atUs).slice(11, 19); }).join('、') : cv.length ? '我可以去找：' + cv.map(function (r) { return r.name; }).join('、') : '目前沒有我符合條件的人', func: 'map', hint: '條件通才能預約；那一微秒站在他的終點上就對接。' });
    var next = out.find(function (x) { return !x.ok; }) || null;
    // 任務提示的一行字：下一步要做什麼 → 去哪裡
    var place = { role: '走到角色碑', rule: '走到規則屋', resource: '走到市集', build: '按「建造」', goal: '走到終點台', map: '打開地圖' };
    var hint = next ? '下一步：' + next.name + ' → ' + place[next.func] : booked.length ? '等那一微秒：' + booked[0].owner.name + ' ' + CORE.fmtUs(booked[0].slot.atUs).slice(11, 19) + '，到時候站在他的終點上' : '都準備好了，去找人';
    return { rows: out, next: next, hint: hint };
  }

  /* ---------- 那一微秒：每格判定（到場＝站在終點上或勾了到場） ---------- */
  var standingAt = null;    // 裡世界告訴我：我正站在哪個角色的終點上
  function setStanding(serial) { standingAt = serial || null; }
  function setGive(slotId, n) { gives[slotId] = Math.max(0, Math.floor(+n) || 0); }
  function giveFor(slotId) { return gives[slotId] == null ? 100 : gives[slotId]; }
  setInterval(function () {
    var t = now(), dirty = false;
    var res = CORE.judge(state, me, t, standingAt, allGives());
    if (res.length) { dirty = true; res.forEach(function (r) { if (r.ok) state.records.push({ kind: 'dock', at: t, text: CORE.abbrev(me.serial) + ' 與 ' + CORE.abbrev(r.owner.serial) + ' 在 ' + CORE.fmtUs(t) + ' 對接：' + r.owner.name + ' 給 ' + r.docking.gaveA + ' 點，' + me.name + ' 給 ' + r.docking.gaveB + ' 點（' + r.docking.how + '）' }); }); }
    var missedBefore = countMissed();
    if (CORE.expire(state, t)) dirty = true;
    if (dirty) { changed(); }
    res.forEach(function (r) { emit('dock', r); });
    if (countMissed() > missedBefore) emit('miss');
  }, 50);
  function allGives() { var g = {}; CORE.myBookings(state, me, now()).forEach(function (b) { g[b.slot.id] = giveFor(b.slot.id); }); return g; }
  function countMissed() { var n = 0; state.roles.forEach(function (r) { r.slots.forEach(function (s) { n += (s.missed || []).length; }); }); return n; }

  /* ---------- 切換：停在同一件事上 ---------- */
  var focusAtSwitch = '';     // 切到表世界那一刻的焦點；切回來時比對焦點真的有沒有變
  function setFocus(f) { focus = Object.assign({}, focus, f || {}); }
  function getFocus() { return focus; }
  function switchTo(v) { view = v; if (v === 'sheet') focusAtSwitch = JSON.stringify(focus); emit('view', v); }
  function currentView() { return view; }

  return {
    state: function () { return state; }, me: function () { return me; }, now: now, esc: esc, opt: opt, STATUS: STATUS,
    on: on, emit: emit, save: save, changed: changed, run: run, roleOf: roleOf, allObjs: allObjs,
    becomeMe: becomeMe, resetAll: resetAll,
    draft: draft, startDraft: startDraft, draftFrom: draftFrom, dropDraft: dropDraft, createFromDraft: createFromDraft, endEarly: endEarly,
    steps: steps, setStanding: setStanding, standingAt: function () { return standingAt; }, setGive: setGive, giveFor: giveFor,
    setFocus: setFocus, focus: getFocus, focusChanged: function () { return JSON.stringify(focus) !== focusAtSwitch; }, switchTo: switchTo, view: currentView
  };
})();
