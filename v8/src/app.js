/* ===== v8 共用：狀態、存檔、待辦、那一微秒的判定、兩種介面的切換 =====
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
  function resetAll() { state = CORE.fresh(); me = state.roles[0]; focus = { role: null, func: null }; changed(); emit('me'); }
  // 不玩了：刪掉角色後換成第一個還在的人
  function quit(serial) {
    var n = CORE.quit(state, serial, now(), true);
    if (!state.roles.length) { state = CORE.fresh(); }
    state.me = 0; me = state.roles[0]; emit('me');
    return n;
  }

  /* ---------- 待辦／任務提示（兩種介面共用） ---------- */
  function steps() {
    var m = me, t = now(), out = [], v = ver(m), p = pend(m);
    out.push({ id: 'role', no: '①', name: '每天的點', ok: true, status: CORE.abbrev(m.serial) + ' ' + m.name + '，每天 ' + v.dailyPoints + ' 點' + (p && p.dailyPoints !== v.dailyPoints ? '（明天起 ' + p.dailyPoints + '）' : '') + '，今天還能給 ' + CORE.remainingToday(state, m, t), func: 'role', hint: '一人一個角色。改每天的點隔天生效。' });
    var ru = v.rules, hasRules = ru.uses.length > 0 || ru.conditions.length > 0 || !!ru.village;
    out.push({ id: 'rules', no: '②', name: '寫規則與條件', ok: hasRules, status: hasRules ? ru.uses.length + ' 條用途、' + ru.conditions.length + ' 條條件' + (ru.bothMustPass ? '、要兩方都通' : '') + (ru.mustAcceptVillage ? '、要接受村規' : '') : '規則表是空的' + (p ? '；明天起的版本已經寫了' : ''), func: 'rule', hint: '我的點能做什麼、對接條件（固定格式）、村規。改了隔天生效。' });
    var avail = CORE.availTotal(m, t);
    out.push({ id: 'resources', no: '③', name: '資源', ok: v.resources.length > 0 && avail > 0, status: v.resources.length ? v.resources.map(function (x) { return x.name + ' ' + x.price + ' 點，可換 ' + CORE.stockOf(m, x.id).avail; }).join('、') : '沒有資源', func: 'resource', hint: '我的點能換的東西和價格。沒貨就給不出點。' });
    var funcs = ['rule', 'resource', 'goal', 'role'], has = funcs.filter(function (f) { return allObjs(m).some(function (o) { return o.func === f; }); });
    var others = state.roles.filter(function (r) { return r !== m; });
    var rt = others.length ? CORE.route(m.world.walk, allObjs(m), CORE.abbrev(others[0].serial)) : { missing: '沒有別的角色' };
    out.push({ id: 'world', no: '④', name: '世界與走法', ok: has.length === funcs.length && !rt.missing, status: (has.length === funcs.length ? '四個公開功能點都有' : '缺：' + funcs.filter(function (f) { return has.indexOf(f) < 0; }).map(function (f) { return CORE.FUNCS[f].label; }).join('、')) + '；' + (rt.missing ? rt.missing : '要去 ' + CORE.abbrev(others[0].serial) + '：' + rt.steps.join('，')), func: 'build', hint: '功能固定、外觀自由；走法決定代號怎麼走。' });
    var up = m.slots.filter(function (s) { return s.atUs > t; });
    out.push({ id: 'slots', no: '⑤', name: '開對接時段', ok: up.length > 0, status: up.length ? up.length + ' 個未來時段，最近 ' + CORE.fmtUs(up.sort(function (a, b) { return a.atUs - b.atUs; })[0].atUs) : '沒有開放的時段', func: 'goal', hint: '別人要預約才能來對接；名額是容量不是條件。' });
    var booked = CORE.myBookings(state, m, t).filter(function (b) { return b.slot.atUs > t; });
    var chosen = booked.filter(function (b) { return CORE.wantsValid(state, b.slot, m.serial, b.owner.serial).length > 0; });
    var cv = CORE.canVisit(state, m, t);
    out.push({ id: 'query', no: '⑥', name: '預約、選要換的東西', ok: booked.length > 0 && chosen.length === booked.length, status: booked.length ? '預約了 ' + booked.map(function (b) { return b.owner.name + ' ' + CORE.fmtUs(b.slot.atUs).slice(11, 19) + (CORE.wantsValid(state, b.slot, m.serial, b.owner.serial).length ? '（選好了）' : '（還沒選要換什麼）'); }).join('、') : cv.length ? '我可以去找：' + cv.map(function (r) { return r.name; }).join('、') : '目前沒有我符合條件的人', func: 'map', hint: '條件通才能預約；那一微秒之前選好要換他的什麼。' });
    var next = out.find(function (x) { return !x.ok; }) || null;
    var place = { role: '走到角色碑', rule: '走到規則屋', resource: '走到市集', build: '按「建造」', goal: '走到終點台', map: '打開地圖' };
    var hint = next ? '下一步：' + next.name + ' → ' + place[next.func] : booked.length ? '等那一微秒：' + booked[0].owner.name + ' ' + CORE.fmtUs(booked[0].slot.atUs).slice(11, 19) + '，到時候站在他的終點上' : '都準備好了，去找人';
    return { rows: out, next: next, hint: hint };
  }

  /* ---------- 那一微秒：每格判定（到場＝站在終點上或勾了到場；主人視為到場） ---------- */
  var standingAt = null;    // 裡世界告訴我：我正站在哪個角色的終點上
  function setStanding(serial) { standingAt = serial || null; }
  function countMissed() { var n = 0; state.roles.forEach(function (r) { r.slots.forEach(function (s) { n += (s.missed || []).length; }); }); return n; }
  setInterval(function () {
    var t = now(), standing = {}; if (standingAt) standing[me.serial] = standingAt;
    var missedBefore = countMissed();
    var res = CORE.judge(state, t, standing), dirty = res.length > 0;
    if (CORE.expire(state, t)) dirty = true;
    if (dirty) changed();
    if (res.length) emit('dock', res);
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
    becomeMe: becomeMe, resetAll: resetAll, quit: quit,
    steps: steps, setStanding: setStanding, standingAt: function () { return standingAt; },
    setFocus: setFocus, focus: getFocus, focusChanged: function () { return JSON.stringify(focus) !== focusAtSwitch; }, switchTo: switchTo, view: currentView
  };
})();
