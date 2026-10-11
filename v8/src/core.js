/* ===== v8 平台核心：規則與資料，不碰畫面 =====
 * 純函式、node 可測。世界只能是資料。
 * 一人一角色、每天一版（明天起）、資源分可換／已保留、收點就選好東西、那一微秒兩兩成交、保留與兌現、不玩了。
 * 序號、走法解碼、外觀形體、世界檢查沿用 v5。
 */
var CORE = (function () {
  'use strict';
  /* ---------- 功能點：平台的清單 ---------- */
  var FUNCS = {
    rule:     { label: '規則', defaultLook: '屋' },
    resource: { label: '資源', defaultLook: '市集' },
    goal:     { label: '終點', defaultLook: '台' },
    role:     { label: '角色', defaultLook: '碑' },
    points:   { label: '點數', defaultLook: '帳房', selfOnly: true },
    none:     { label: '地標', defaultLook: '—' }
  };
  /* ---------- 角色序號：11 位數，開頭幾個 0 就用第幾個字母 ---------- */
  function abbrev(serial) {
    var m = /^(0*)(\d*)$/.exec(serial);
    if (!m || serial.length !== 11) return null;
    var z = m[1].length;
    if (z === 0) return serial;
    if (z === 11) return null;                 // 全 0 不是角色
    return String.fromCharCode(64 + z) + m[2];
  }
  function expand(code) {
    if (/^\d{11}$/.test(code) && code[0] !== '0') return code;
    var m = /^([A-J])(\d+)$/.exec(String(code).toUpperCase());
    if (!m) return null;
    var z = m[1].charCodeAt(0) - 64;
    if (z + m[2].length !== 11 || m[2][0] === '0') return null;
    return '0'.repeat(z) + m[2];
  }
  // 字母告訴你後面有幾位數
  function digitsAfter(letter) { return 11 - (letter.charCodeAt(0) - 64); }
  var SHAPES = { box: '方塊', cylinder: '圓柱', sphere: '球', cone: '錐' };

  /* ---------- 預設外觀（都是基本形體的組合；主人隨時可改） ---------- */
  var LOOKS = {
    '屋': function (c) { return [
      { shape: 'box', size: [3, 2.2, 3], color: c, offset: [0, 1.1, 0] },
      { shape: 'cone', size: [4, 1.5, 4], color: '#7A4B32', offset: [0, 2.95, 0] } ]; },
    '碑': function (c) { return [
      { shape: 'box', size: [1.4, 3.4, 0.5], color: c, offset: [0, 1.7, 0] },
      { shape: 'box', size: [2.2, 0.4, 1.2], color: '#8A8F96', offset: [0, 0.2, 0] } ]; },
    '台': function (c) { return [
      { shape: 'cylinder', size: [3.2, 0.5, 3.2], color: c, offset: [0, 0.25, 0] },
      { shape: 'cylinder', size: [2.2, 0.5, 2.2], color: c, offset: [0, 0.75, 0] } ]; },
    '殿': function (c) { return [
      { shape: 'box', size: [4, 0.6, 4], color: '#8A8F96', offset: [0, 0.3, 0] },
      { shape: 'cylinder', size: [0.5, 3, 0.5], color: c, offset: [-1.4, 2.1, -1.4] },
      { shape: 'cylinder', size: [0.5, 3, 0.5], color: c, offset: [1.4, 2.1, -1.4] },
      { shape: 'cylinder', size: [0.5, 3, 0.5], color: c, offset: [-1.4, 2.1, 1.4] },
      { shape: 'cylinder', size: [0.5, 3, 0.5], color: c, offset: [1.4, 2.1, 1.4] },
      { shape: 'box', size: [4.2, 0.5, 4.2], color: c, offset: [0, 3.85, 0] } ]; },
    '工坊': function (c) { return [
      { shape: 'box', size: [3.6, 1.8, 2.6], color: c, offset: [0, 0.9, 0] },
      { shape: 'cylinder', size: [0.5, 1.6, 0.5], color: '#5C6670', offset: [1.2, 2.6, -0.6] } ]; },
    '樹': function (c) { return [
      { shape: 'cylinder', size: [0.6, 2, 0.6], color: '#7A4B32', offset: [0, 1, 0] },
      { shape: 'sphere', size: [3, 3, 3], color: c, offset: [0, 3.2, 0] } ]; },
    '井': function (c) { return [
      { shape: 'cylinder', size: [2.2, 1, 2.2], color: c, offset: [0, 0.5, 0] },
      { shape: 'cylinder', size: [1.4, 1.1, 1.4], color: '#1E2A36', offset: [0, 0.56, 0] } ]; },
    '噴泉': function (c) { return [
      { shape: 'cylinder', size: [3.4, 0.6, 3.4], color: c, offset: [0, 0.3, 0] },
      { shape: 'cylinder', size: [0.6, 1.6, 0.6], color: c, offset: [0, 1.4, 0] },
      { shape: 'sphere', size: [1.2, 1.2, 1.2], color: '#9CC9E8', offset: [0, 2.6, 0] } ]; },
    '山': function (c) { return [
      { shape: 'cone', size: [6, 5, 6], color: c, offset: [0, 2.5, 0] } ]; },
    '市集': function (c) { return [
      { shape: 'box', size: [4, 1.6, 2.6], color: c, offset: [0, 0.8, 0] },
      { shape: 'box', size: [4.6, 0.3, 3.2], color: '#B23A48', offset: [0, 1.85, 0] },
      { shape: 'cylinder', size: [0.3, 1.8, 0.3], color: '#7A4B32', offset: [-2, 0.9, 1.4] },
      { shape: 'cylinder', size: [0.3, 1.8, 0.3], color: '#7A4B32', offset: [2, 0.9, 1.4] } ]; },
    '塔': function (c) { return [
      { shape: 'cylinder', size: [2, 4, 2], color: c, offset: [0, 2, 0] },
      { shape: 'cone', size: [2.4, 1.6, 2.4], color: '#5C6670', offset: [0, 4.8, 0] } ]; }
  };
  function look(name, color) { return LOOKS[name] ? LOOKS[name](color) : LOOKS['屋'](color); }

  // 物件的地面半徑：用來判斷「靠近」「到達」「繞圈」
  function radiusOf(obj) {
    var r = 0.8;
    (obj.parts || []).forEach(function (p) {
      var o = p.offset || [0, 0, 0];
      var rr = Math.hypot(o[0], o[2]) + Math.max(p.size[0], p.size[2]) / 2;
      if (rr > r) r = rr;
    });
    return r;
  }
  /* ---------- 走法解碼：畫面層丟事件進來，這裡算出走出來的代號 ---------- */
  // 事件：{type:'circle', object, count}（離開物件時送一次）、{type:'arrive', object}
  function Decoder(walk) {
    this.walk = walk;
    this.reset();
  }
  Decoder.prototype.reset = function () {
    this.letter = null; this.digits = ''; this.lastAt = null; this.done = null;
  };
  Decoder.prototype.code = function () {
    return (this.letter || '') + this.digits;
  };
  // 還要走幾個數字：有字母看字母，沒字母就是 11 位
  Decoder.prototype.need = function () {
    return (this.letter ? digitsAfter(this.letter) : 11) - this.digits.length;
  };
  Decoder.prototype.feed = function (ev) {
    if (this.done) return { type: 'ignored' };
    if (ev.type === 'circle') {
      var rule = this.walk.circles.find(function (r) { return r.object === ev.object; });
      if (!rule || ev.count < 1) return { type: 'ignored' };
      var c = rule.letter.charCodeAt(0) - (ev.count - 1);   // 一圈 J、兩圈 I……
      if (c < 65) return { type: 'ignored' };
      this.letter = String.fromCharCode(c); this.digits = ''; this.lastAt = ev.object;   // 繞完那棟就算人在那裡
      return { type: 'letter', letter: this.letter, need: this.need() };
    }
    if (ev.type === 'arrive') {
      var from = this.lastAt; this.lastAt = ev.object;
      if (!from || from === ev.object) return { type: 'ignored' };
      var mv = this.walk.moves.find(function (r) { return r.from === from && r.to === ev.object; });
      if (!mv) return { type: 'ignored' };
      if (!this.letter && !this.digits && mv.digit === '0') return { type: 'ignored' };   // 11 位數不能 0 開頭
      this.digits += mv.digit;
      if (this.need() === 0) { this.done = this.code(); return { type: 'done', code: this.done }; }
      return { type: 'digit', digit: mv.digit, need: this.need() };
    }
    return { type: 'ignored' };
  };

  /* ---------- 路線說明：用自己的走法，怎麼走出某個代號 ---------- */
  // 回傳 {steps:[文字…]}，走法表湊不出來就回傳 {missing:'缺什麼'}
  function route(walk, objects, code) {
    var serial = expand(code);
    if (!serial) return { missing: code + ' 不是代號' };
    var ab = abbrev(serial);
    var name = function (id) { var o = objects.find(function (x) { return x.id === id; }); return o ? o.name : id; };
    var steps = [], letter = /^[A-J]/.test(ab) ? ab[0] : null, digits = letter ? ab.slice(1) : ab, at = null;
    if (letter) {
      var best = null;
      walk.circles.forEach(function (c) {
        var n = c.letter.charCodeAt(0) - letter.charCodeAt(0) + 1;
        if (n >= 1 && (!best || n < best.n)) best = { c: c, n: n };
      });
      if (!best) return { missing: '走法表裡沒有物件能繞出 ' + letter };
      steps.push('繞' + name(best.c.object) + (best.n === 1 ? '一圈' : ' ' + best.n + ' 圈') + '（' + letter + '）');
      at = best.c.object;   // 繞完那棟就是起點
    }
    for (var i = 0; i < digits.length; i++) {
      var d = digits[i];
      var mv = walk.moves.find(function (m) { return m.digit === d && m.from === at; }) ||
               walk.moves.find(function (m) { return m.digit === d; });
      if (!mv) return { missing: '走法表裡沒有哪一段路是 ' + d };
      if (mv.from !== at) steps.push('走到' + name(mv.from));
      steps.push('再走到' + name(mv.to) + '（' + d + '）');
      at = mv.to;
    }
    return { steps: steps, code: ab };
  }
  function bad(msg) { throw new Error(msg); }
  function str(v, max, what) { if (typeof v !== 'string') bad(what + ' 不是文字'); if (v.length > max) bad(what + ' 太長'); return v; }
  function num(v, what) { if (typeof v !== 'number' || !isFinite(v)) bad(what + ' 不是數字'); return v; }
  function vec(v, n, what) { if (!Array.isArray(v) || v.length !== n) bad(what + ' 不是 ' + n + ' 個數字'); return v.map(function (x) { return num(x, what); }); }
  function list(v, max, what) { if (!Array.isArray(v)) bad(what + ' 不是清單'); if (v.length > max) bad(what + ' 太多'); return v; }
  function obj(v, what) { if (!v || typeof v !== 'object' || Array.isArray(v)) bad(what + ' 不是資料'); return v; }
  function color(v, what) { if (!/^#[0-9a-fA-F]{6}$/.test(String(v))) bad(what + ' 顏色格式錯'); return v; }
  function ident(v, what) { if (!/^[A-Za-z0-9_-]{1,40}$/.test(String(v))) bad(what + ' 代號只能是英數'); return v; }
  var LIMITS = { objects: 60, parts: 24, path: 200, rules: 50, text: 2000, name: 60 };
  var VIS = { all: '所有人', self: '只有自己' };
  function cleanVis(v) { return VIS[v] ? v : 'all'; }
  function cleanPart(p) {
    obj(p, '形體');
    if (!SHAPES[p.shape]) bad('形體種類不認得：' + p.shape);
    return { shape: p.shape, size: vec(p.size, 3, '形體大小'), color: color(p.color, '形體'), offset: vec(p.offset || [0, 0, 0], 3, '形體位置') };
  }
  function cleanObjects(list0, depth, what) {
    if (depth > 3) bad('內部空間最多 3 層');
    var out = list(list0, LIMITS.objects, what).map(function (o) {
      obj(o, '功能點');
      if (!FUNCS[o.func]) bad('功能不認得：' + o.func);
      var c = { id: ident(o.id, '功能點'), name: str(o.name, LIMITS.name, '功能點名稱'), func: o.func,
                pos: vec(o.pos, 2, '功能點位置'), look: o.look ? str(o.look, 20, '外觀') : undefined,
                parts: list(o.parts, LIMITS.parts, '形體').map(cleanPart) };
      if (o.door != null) {
        obj(o.door, '門');
        c.door = { visible: cleanVis(o.door.visible), start: vec(o.door.start || [0, 4], 2, '門內起點'), objects: cleanObjects(o.door.objects || [], depth + 1, '內部物件') };
      }
      return c;
    });
    return out;
  }
  // 世界裡所有物件（含內部），附層數
  function allObjects(w) {
    var out = [];
    (function walkIn(objs, depth, path) { objs.forEach(function (o) { out.push({ o: o, depth: depth, path: path }); if (o.door) walkIn(o.door.objects, depth + 1, path.concat(o.id)); }); })(w.objects, 0, []);
    return out;
  }
  function findObject(w, id) { var hit = allObjects(w).find(function (x) { return x.o.id === id; }); return hit ? hit.o : null; }
  /* ---------- 出發點：微秒 ---------- */
  function fmtUs(us) {
    if (us == null) return '（還沒寫）';
    var ms = Math.floor(us / 1000), micro = us % 1000;
    var d = new Date(ms);
    function p(n, w) { return String(n).padStart(w || 2, '0'); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
      p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + '.' +
      p(d.getMilliseconds(), 3) + p(micro, 3);
  }
  function nowUs() { return Date.now() * 1000; }
  /* ---------- 時間：本機日期（用「第幾天」比大小） ---------- */
  var DAY_US = 24 * 3600e6;
  function dayNum(us) { var d = new Date(Math.floor(us / 1000)); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); }
  function dayLabel(dn) { if (dn == null) return '一直'; var d = new Date((dn * 86400000) + new Date().getTimezoneOffset() * 60000 + 12 * 3600000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dayOf(us) { return dayLabel(dayNum(us)); }
  var seq = 0;
  function newId(p) { return p + Date.now().toString(36) + (seq++).toString(36); }
  function roleOf(state, serial) { return state.roles.find(function (r) { return r.serial === serial; }) || null; }
  function need(state, serial) { var r = roleOf(state, serial); if (!r) bad('沒有這個角色：' + serial); return r; }
  var DEFAULT_DAILY = 2000;

  /* ---------- 規則 2：每天一版。今天的角色整天不變；改了存成「明天起」 ---------- */
  // role.versions：[{id, fromDay, dailyPoints, rules, resources}]，照 fromDay 排；今天生效的是最後一個 fromDay ≤ 今天的
  function version(role, atUs) {
    var dn = dayNum(atUs), v = null;
    role.versions.forEach(function (x) { if (x.fromDay <= dn && (!v || x.fromDay >= v.fromDay)) v = x; });
    return v || role.versions[0];
  }
  function pending(role, atUs) { var dn = dayNum(atUs); return role.versions.find(function (x) { return x.fromDay > dn; }) || null; }
  function cloneVersion(v) { return JSON.parse(JSON.stringify(v)); }
  // 要改明天起的版本：有就改它，沒有就從今天的複製一份
  function tomorrow(state, serial, atUs) {
    var r = need(state, serial), p = pending(r, atUs);
    if (p) return p;
    var v = cloneVersion(version(r, atUs));
    v.id = newId('v'); v.fromDay = dayNum(atUs) + 1;
    r.versions.push(v);
    return v;
  }
  function dropPending(state, serial, atUs) { var r = need(state, serial), p = pending(r, atUs); if (p) r.versions = r.versions.filter(function (x) { return x !== p; }); }
  function resourceOf(v, id) { return v.resources.find(function (x) { return x.id === id; }) || null; }
  function resourceName(role, id) { for (var i = role.versions.length - 1; i >= 0; i--) { var x = resourceOf(role.versions[i], id); if (x) return x.name; } return id; }
  function cleanRes(x) {
    var price = Math.floor(+x.price), keep = x.keepDays == null || x.keepDays === '' ? null : Math.floor(+x.keepDays);
    if (!x.name || !String(x.name).trim()) bad('資源要有名稱'); if (!(price >= 0)) bad('價格要是 0 以上的整數'); if (keep != null && !(keep >= 1)) bad('保留天數要是正整數，或空白＝一直保留');
    return { id: x.id || newId('res'), name: String(x.name).trim(), def: String(x.def || ''), price: price, keepDays: keep };
  }
  function cleanRules(rules) {
    rules = rules || {};
    var conds = (rules.conditions || []).map(function (c) {
      if (!COND_FIELDS[c.field]) bad('條件欄位不認得：' + c.field);
      if (!OPS[c.op]) bad('比較不認得：' + c.op);
      if (typeof c.value !== 'number' || !isFinite(c.value)) bad('條件數值要是數字');
      return { field: c.field, op: c.op, value: c.value };
    });
    return { uses: (rules.uses || []).map(String).filter(Boolean), conditions: conds, bothMustPass: !!rules.bothMustPass, mustAcceptVillage: !!rules.mustAcceptVillage, village: String(rules.village || ''), villageKey: null };
  }
  // 明天起：改每天的點、規則表、資源的種類／定義／價格／保留天數
  function setDailyPoints(state, serial, n, atUs) { var d = Math.floor(+n); if (!(d >= 1)) bad('每天的點要是正整數'); tomorrow(state, serial, atUs).dailyPoints = d; }
  function setRules(state, serial, rules, atUs) { tomorrow(state, serial, atUs).rules = cleanRules(rules); }
  function addResource(state, serial, x, atUs) { var r = need(state, serial), c = cleanRes(x); tomorrow(state, serial, atUs).resources.push(c); r.stock[c.id] = r.stock[c.id] || { avail: 0, reserved: 0 }; return c; }
  function setResource(state, serial, id, fields, atUs) { var v = tomorrow(state, serial, atUs), x = resourceOf(v, id); if (!x) bad('明天的資源表裡沒有這一項'); var c = cleanRes(Object.assign({}, x, fields, { id: id })); Object.assign(x, c); return x; }
  function removeResource(state, serial, id, atUs) { var v = tomorrow(state, serial, atUs); if (!resourceOf(v, id)) bad('明天的資源表裡沒有這一項'); v.resources = v.resources.filter(function (x) { return x.id !== id; }); }
  // 版本的差異（畫面用「明天起」標）
  function sameUse(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  /* ---------- 規則 1：每天的點。當天沒給出去的隔天歸零，不能預支 ---------- */
  function dailyPoints(role, atUs) { return version(role, atUs).dailyPoints; }
  function givenToday(state, serial, atUs) {
    var dn = dayNum(atUs);
    return state.holds.filter(function (h) { return h.issuer === serial && dayNum(h.atUs) === dn; }).reduce(function (s, h) { return s + h.price; }, 0);
  }
  function remainingToday(state, role, atUs) { return Math.max(0, dailyPoints(role, atUs) - givenToday(state, role.serial, atUs)); }

  /* ---------- 規則 3：資源分「可換」與「已保留」。可換隨時加減；已保留不能手動減 ---------- */
  function stockOf(role, id) { return role.stock[id] || (role.stock[id] = { avail: 0, reserved: 0 }); }
  function restock(state, serial, resourceId, delta) {
    var r = need(state, serial), st = stockOf(r, resourceId), d = Math.floor(+delta);
    if (!d) bad('數量要不是 0');
    if (st.avail + d < 0) bad('可換的不能小於 0');
    st.avail += d; return st;
  }
  // 對方可換的貨（全部加起來）：只算那個時間生效的版本裡有的東西
  function availTotal(role, atUs) { var v = version(role, atUs == null ? nowUs() : atUs), n = 0; v.resources.forEach(function (x) { n += stockOf(role, x.id).avail; }); return n; }

  /* ---------- 規則 4：對接條件（欄位都是系統查得到的事實） ---------- */
  var COND_FIELDS = {
    avail:     { label: '對方可換的貨（全部加起來）', unit: '份', get: function (state, other, atUs) { return availTotal(other, atUs); } },
    myPoints:  { label: '對方手上有多少我的點', unit: '點', get: function (state, other, atUs, me) { return heldPoints(state, other.serial, me.serial, atUs); } },
    dockCount: { label: '對方對接過幾次', unit: '次', get: function (state, other, atUs) { return dockCount(state, other.serial); } }
  };
  var OPS = { '>=': '至少', '<=': '最多', '=': '等於', '!=': '不是' };
  function cmp(a, op, b) { switch (op) { case '>=': return a >= b; case '<=': return a <= b; case '=': return a == b; case '!=': return a != b; } return false; }
  function condText(c) { var f = COND_FIELDS[c.field]; if (!f) return '？'; return f.label + ' ' + OPS[c.op] + ' ' + c.value + (f.unit || ''); }
  // 條件表用 ruleUs 那一刻生效的版本（改規則不溯及既往），條件裡的事實照 atUs 算
  function passes(state, owner, visitor, atUs, ruleUs) {
    var failed = version(owner, ruleUs == null ? atUs : ruleUs).rules.conditions.filter(function (c) { return !cmp(COND_FIELDS[c.field].get(state, visitor, atUs, owner), c.op, c.value); }).map(condText);
    return { ok: !failed.length, failed: failed };
  }
  // 接受村規記下接受的是哪一版（村規內容）；村規改了，舊的接受不算
  function accepted(state, who, of, village) { return state.acceptances.some(function (a) { return a.who === who && a.of === of && (village == null || a.village === village); }); }
  function acceptedAny(state, who, of) { return state.acceptances.some(function (a) { return a.who === who && a.of === of; }); }
  function accept(state, who, of, atUs) { atUs = atUs || nowUs(); var village = version(need(state, of), atUs).rules.village; if (!accepted(state, who, of, village)) state.acceptances.push({ who: who, of: of, village: village, atUs: atUs }); }
  // 接受的狀態：current＝接受的是現在這一版；old＝接受的是舊版，要重新接受；none＝還沒接受
  function acceptState(state, who, role, atUs) { var village = version(role, atUs).rules.village; return accepted(state, who, role.serial, village) ? 'current' : acceptedAny(state, who, role.serial) ? 'old' : 'none'; }
  function villageChanges(role, atUs) { var p = pending(role, atUs); return !!p && p.rules.village !== version(role, atUs).rules.village; }
  // a 和 b 能不能對接：一方通就可以；任一方要求兩方都通就要兩方；要求接受村規而對方沒接受就不行
  // ruleUs：用哪一刻生效的規則表（預約那一刻）；事實照 atUs
  function eligible(state, a, b, atUs, ruleUs) {
    if (ruleUs == null) ruleUs = atUs;
    if (a.serial === b.serial) return { ok: false, reason: '自己不能和自己對接' };
    var ra = version(a, ruleUs).rules, rb = version(b, ruleUs).rules;
    if (ra.mustAcceptVillage && !accepted(state, b.serial, a.serial, ra.village)) return { ok: false, reason: abbrev(b.serial) + ' 還沒接受 ' + abbrev(a.serial) + ' 的村規' + (acceptedAny(state, b.serial, a.serial) ? '（接受的是舊版）' : '') };
    if (rb.mustAcceptVillage && !accepted(state, a.serial, b.serial, rb.village)) return { ok: false, reason: abbrev(a.serial) + ' 還沒接受 ' + abbrev(b.serial) + ' 的村規' + (acceptedAny(state, a.serial, b.serial) ? '（接受的是舊版）' : '') };
    var pa = passes(state, a, b, atUs, ruleUs), pb = passes(state, b, a, atUs, ruleUs);   // pa：b 通 a 的條件
    if (ra.bothMustPass || rb.bothMustPass) return pa.ok && pb.ok ? { ok: true, how: '兩方都通' } : { ok: false, reason: '要求兩方都通，' + (!pa.ok ? abbrev(b.serial) + ' 不通 ' + abbrev(a.serial) + ' 的條件（' + pa.failed.join('；') + '）' : abbrev(a.serial) + ' 不通 ' + abbrev(b.serial) + ' 的條件（' + pb.failed.join('；') + '）') };
    if (pa.ok || pb.ok) return { ok: true, how: pa.ok && pb.ok ? '兩方都通' : pa.ok ? abbrev(b.serial) + ' 通 ' + abbrev(a.serial) + ' 的條件' : abbrev(a.serial) + ' 通 ' + abbrev(b.serial) + ' 的條件' };
    return { ok: false, reason: '兩邊都不通：' + pa.failed.concat(pb.failed).join('；') };
  }

  /* ---------- 角色（一人一個） ---------- */
  function createRole(state, f, atUs) {
    atUs = atUs || nowUs();
    state.issued = state.issued || [];
    // 給「從來沒發過」的最小序號：不玩了的人的序號不會再給別人；超過 9 號繼續發（I10、I11…）
    var serial = f.serial || (function () { for (var i = 1; ; i++) { var c = String(i).padStart(11, '0'); if (!roleOf(state, c) && state.issued.indexOf(c) < 0) return c; } })();
    if (!abbrev(serial) || roleOf(state, serial)) bad('序號不對或已存在');
    if (state.issued.indexOf(serial) < 0) state.issued.push(serial);
    if (!f.name || !String(f.name).trim()) bad('角色要有名字');
    var daily = f.dailyPoints == null ? DEFAULT_DAILY : Math.floor(+f.dailyPoints); if (!(daily >= 1)) bad('每天的點要是正整數');
    var r = { serial: serial, name: String(f.name).trim(), contact: String(f.contact || ''), slots: [], stock: {}, world: f.world || defaultWorld(serial),
              versions: [{ id: newId('v'), fromDay: dayNum(atUs), dailyPoints: daily, rules: cleanRules(f.rules), resources: (f.resources || []).map(cleanRes) }] };
    r.versions[0].resources.forEach(function (x, i) { var src = f.resources[i]; r.stock[x.id] = { avail: Math.max(0, Math.floor(+(src && src.avail) || 0)), reserved: 0 }; });
    state.roles.push(r);
    return r;
  }
  // 不玩了：手上有我點的人都換完才能刪；單機版持有人都在本機，視為同意（consent）
  function quitBlockers(state, serial, atUs) { return state.holds.filter(function (h) { return h.issuer === serial && holdStatus(h, atUs) === 'held'; }); }
  function quit(state, serial, atUs, consent) {
    var r = need(state, serial), blockers = quitBlockers(state, serial, atUs);
    if (blockers.length && !consent) bad('還有 ' + blockers.length + ' 筆你的點沒換：' + blockers.map(function (h) { return abbrev(h.holder) + '「' + h.name + '」'; }).join('、') + '。先讓他們換完，或取得同意');
    blockers.forEach(function (h) { h.status = 'voided'; });
    state.holds.forEach(function (h) { if (h.holder === serial && holdStatus(h, atUs) === 'held') { h.status = 'voided'; var iss = roleOf(state, h.issuer); if (iss) { var st = stockOf(iss, h.resource); st.reserved = Math.max(0, st.reserved - 1); st.avail += 1; } } });
    state.roles.forEach(function (o) { o.slots.forEach(function (s) { s.bookings = s.bookings.filter(function (b) { return b !== serial; }); }); });
    state.roles = state.roles.filter(function (x) { return x !== r; });
    state.records.push({ kind: 'quit', at: atUs, serial: serial, text: abbrev(serial) + ' ' + r.name + ' 不玩了' + (blockers.length ? '，' + blockers.length + ' 筆保留作廢（持有人同意）' : '') });
    return blockers.length;
  }

  /* ---------- 規則 5：查詢，排序只照事實 ---------- */
  function nextSlot(role, atUs) { var s = role.slots.filter(function (x) { return x.atUs >= atUs; }).sort(function (x, y) { return x.atUs - y.atUs; })[0]; return s || null; }
  function dockCount(state, serial) { return state.dockings.filter(function (d) { return d.traded && !d.tutorial && (d.a === serial || d.b === serial); }).length; }
  function byFacts(state, atUs) { return function (x, y) { var sx = nextSlot(x, atUs), sy = nextSlot(y, atUs); return (sx ? sx.atUs : Infinity) - (sy ? sy.atUs : Infinity) || dailyPoints(y, atUs) - dailyPoints(x, atUs) || dockCount(state, y.serial) - dockCount(state, x.serial); }; }
  function others(state, me) { return state.roles.filter(function (r) { return r !== me; }); }
  function canVisit(state, me, atUs) { return others(state, me).filter(function (r) { return passes(state, r, me, atUs).ok; }).sort(byFacts(state, atUs)); }
  function canCome(state, me, atUs) { return others(state, me).filter(function (r) { return passes(state, me, r, atUs).ok; }).sort(byFacts(state, atUs)); }
  function searchResources(state, keyword, atUs) {
    var kw = String(keyword || '').trim().toLowerCase(), out = [];
    state.roles.forEach(function (r) { version(r, atUs).resources.forEach(function (x) { if (!kw || x.name.toLowerCase().indexOf(kw) >= 0 || (x.def || '').toLowerCase().indexOf(kw) >= 0) out.push({ role: r, resource: x, stock: stockOf(r, x.id) }); }); });
    return out.sort(function (p, q) { return byFacts(state, atUs)(p.role, q.role); });
  }
  // 換點比例：最近 10 次對接，給出的點：收到的點
  function ratio(state, serial) {
    var ds = state.dockings.filter(function (d) { return d.traded && !d.tutorial && (d.a === serial || d.b === serial); }).slice(-10), gave = 0, got = 0;
    ds.forEach(function (d) { if (d.a === serial) { gave += d.gaveA; got += d.gaveB; } else { gave += d.gaveB; got += d.gaveA; } });
    return { n: ds.length, gave: gave, got: got, text: ds.length ? gave + '：' + got + '（最近 ' + ds.length + ' 次）' : '還沒對接過' };
  }

  /* ---------- 規則 6：預約。條件通才能預約；名額滿不行 ---------- */
  function addSlot(state, serial, atUs, capacity, maxGive, now, together) {
    var r = need(state, serial);
    if (!(atUs > (now || nowUs()))) bad('對接時段要在未來');
    var cap = Math.floor(+capacity); if (!(cap >= 1)) bad('名額要至少 1');
    var s = { id: newId('slot'), atUs: atUs, capacity: cap, together: !!together, bookings: [], confirmed: [], bookedAt: {}, docked: [], missed: [], wants: {}, maxGive: {}, judged: false };
    if (maxGive != null && maxGive !== '') setMaxGive(state, s, serial, maxGive);
    r.slots.push(s);
    return s;
  }
  // 刪時段：只有自己的、還沒人預約的未來時段（開了就不能改，要改就刪掉重開）
  function deleteSlot(state, serial, slotId, now) {
    var x = slotOf(state, slotId); if (!x) bad('沒有這個時段');
    if (x.owner.serial !== serial) bad('這不是你的時段');
    if (x.slot.judged || x.slot.atUs <= (now || nowUs())) bad('這個時段已經過了');
    if (x.slot.bookings.length) bad('已經有人預約，不能刪');
    x.owner.slots = x.owner.slots.filter(function (s) { return s !== x.slot; });
  }
  function slotOf(state, slotId) { var out = null; state.roles.forEach(function (r) { r.slots.forEach(function (s) { if (s.id === slotId) out = { owner: r, slot: s }; }); }); return out; }
  function participants(state, slot) { var x = slotOf(state, slot.id); return [x.owner.serial].concat(slot.bookings); }
  function book(state, visitorSerial, slotId, atUs) {
    var x = slotOf(state, slotId); if (!x) bad('沒有這個時段');
    var visitor = need(state, visitorSerial);
    if (x.owner.serial === visitorSerial) bad('自己的時段不用預約');
    if (x.slot.atUs <= atUs) bad('這個時段已經過了');
    if (x.slot.bookings.indexOf(visitorSerial) >= 0) bad('你已經預約了');
    if (x.slot.bookings.length >= x.slot.capacity) bad('名額滿了');
    var e = eligible(state, x.owner, visitor, atUs); if (!e.ok) bad('條件不通，不能預約：' + e.reason);
    x.slot.bookings.push(visitorSerial);
    x.slot.bookedAt = x.slot.bookedAt || {}; x.slot.bookedAt[visitorSerial] = atUs;   // 預約那一刻：那一微秒照這時候的規則表判
    return x.slot;
  }
  function cancelBooking(state, visitorSerial, slotId) { var x = slotOf(state, slotId); if (!x) bad('沒有這個時段'); if (x.slot.judged) bad('那一微秒已經過了'); x.slot.bookings = x.slot.bookings.filter(function (s) { return s !== visitorSerial; }); x.slot.confirmed = (x.slot.confirmed || []).filter(function (c) { return c !== visitorSerial; }); delete x.slot.wants[visitorSerial]; if (x.slot.bookedAt) delete x.slot.bookedAt[visitorSerial]; }
  // 那一微秒之前：同一個時段的人對其他每個人選「我要他的哪些東西」，可以改到那一微秒；設「每人最多給多少點」
  function setWants(state, slotId, me, other, resourceIds) {
    var x = slotOf(state, slotId); if (!x) bad('沒有這個時段');
    if (x.slot.judged) bad('那一微秒已經過了，不能再改');
    var ps = participants(state, x.slot); if (ps.indexOf(me) < 0 || ps.indexOf(other) < 0) bad('不在這個時段裡');
    var v = version(need(state, other), x.slot.atUs);
    var ids = (resourceIds || []).filter(function (id) { return !!resourceOf(v, id); });   // 那天已經不在資源表上的自動拿掉
    x.slot.wants[me] = x.slot.wants[me] || {};
    x.slot.wants[me][other] = ids;
    return ids;
  }
  function wantsOf(slot, me, other) { return (slot.wants[me] && slot.wants[me][other]) || []; }
  // 畫面用：只留那天資源表上還有的
  function wantsValid(state, slot, me, other) { var o = roleOf(state, other); if (!o) return []; var v = version(o, slot.atUs); return wantsOf(slot, me, other).filter(function (id) { return !!resourceOf(v, id); }); }
  // 存著的選擇裡那天已經下架的（畫面加一行小字）
  function wantsGone(state, slot, me, other) { var o = roleOf(state, other); if (!o) return []; var v = version(o, slot.atUs); return wantsOf(slot, me, other).filter(function (id) { return !resourceOf(v, id); }).map(function (id) { return resourceName(o, id); }); }
  function goneText(state, slot, me, other) { var g = wantsGone(state, slot, me, other); return g.length ? '選的「' + g.join('」「') + '」那天已經下架，不算' : ''; }
  function wantTotal(state, slot, me, other) { var v = version(need(state, other), slot.atUs); return wantsOf(slot, me, other).reduce(function (s, id) { var x = resourceOf(v, id); return s + (x ? x.price : 0); }, 0); }
  function setMaxGive(state, slot, me, n) { if (slot.judged) bad('那一微秒已經過了'); if (n == null || n === '') { delete slot.maxGive[me]; return null; } var v = Math.floor(+n); if (!(v >= 0)) bad('每人最多給多少要是 0 以上'); slot.maxGive[me] = v; return v; }
  function maxGiveOf(state, slot, me, atUs) { return slot.maxGive[me] != null ? slot.maxGive[me] : remainingToday(state, need(state, me), atUs); }
  // 聯絡方式只給預約成功、還沒對接完的人看
  function contactVisible(state, owner, viewer) {
    if (owner.serial === viewer) return true;
    return owner.slots.some(function (s) { return s.bookings.indexOf(viewer) >= 0 && s.docked.indexOf(viewer) < 0; });
  }

  /* ---------- 規則 7：那一微秒。到場的人兩兩判定，成立的每一對兩個方向各自成交 ---------- */
  var DOCK_WINDOW_US = 1e6;
  function missed(slot, visitorSerial) { return (slot.missed || []).indexOf(visitorSerial) >= 0; }
  // 到場是事先確認：預約之後、那一微秒之前隨時確認或取消，存在時段上（存檔留著）；主人開時段就算確認
  function setPresent(state, visitorSerial, slotId, present) {
    var x = slotOf(state, slotId); if (!x) bad('沒有這個時段');
    if (x.slot.judged) bad('那一微秒已經過了');
    if (x.owner.serial !== visitorSerial && x.slot.bookings.indexOf(visitorSerial) < 0) bad('先預約才能確認到場');
    x.slot.confirmed = (x.slot.confirmed || []).filter(function (c) { return c !== visitorSerial; });
    if (present) x.slot.confirmed.push(visitorSerial);
  }
  function isPresent(state, visitorSerial, slotId) { var x = slotOf(state, slotId); if (!x) return false; return x.owner.serial === visitorSerial || (x.slot.confirmed || []).indexOf(visitorSerial) >= 0; }
  // 一個方向：giver 給 taker 點，換 taker 選好的 giver 的東西
  function settleDirection(state, slot, giver, taker, atUs) {
    var g = need(state, giver), v = version(g, atUs), all = wantsOf(slot, taker, giver);
    if (!all.length) return { ok: false, selected: false, points: 0, items: [], reason: need(state, taker).name + ' 沒選 ' + g.name + ' 的東西', note: null };
    // 那天已經下架的那幾樣不算（跟畫面一致），剩下的照原本的規則成交
    var gone = all.filter(function (id) { return !resourceOf(v, id); }), ids = all.filter(function (id) { return !!resourceOf(v, id); });
    var note = gone.length ? '選的「' + gone.map(function (id) { return resourceName(g, id); }).join('」「') + '」那天已經下架，沒換到' : null;
    if (!ids.length) return { ok: false, selected: true, points: 0, items: [], reason: note, note: note };
    var total = 0, count = {};
    ids.forEach(function (id) { var x = resourceOf(v, id); total += x.price; count[id] = (count[id] || 0) + 1; });
    var left = remainingToday(state, g, atUs);
    if (slot.maxGive[giver] != null && total > slot.maxGive[giver]) return { ok: false, selected: true, points: 0, items: [], reason: g.name + ' 每人最多給 ' + slot.maxGive[giver] + ' 點，' + need(state, taker).name + ' 選的要 ' + total + ' 點', note: note };
    if (total > left) return { ok: false, selected: true, points: 0, items: [], reason: g.name + ' 今天只剩 ' + left + ' 點，不能預支（要 ' + total + ' 點）', note: note };
    var short = Object.keys(count).filter(function (id) { return stockOf(g, id).avail < count[id]; });
    if (short.length) return { ok: false, selected: true, points: 0, items: [], reason: g.name + ' 的貨不夠：' + short.map(function (id) { var x = resourceOf(v, id); return '「' + (x ? x.name : id) + '」可換 ' + stockOf(g, id).avail + ' 份，要 ' + count[id]; }).join('、'), note: note };
    return { ok: true, selected: true, points: total, items: ids.map(function (id) { var x = resourceOf(v, id); return { id: id, name: x.name, price: x.price, keepDays: x.keepDays }; }), reason: null, note: note };
  }
  // 這一對用哪一刻的規則表：主人和預約的人之間＝預約那一刻；兩個預約的人之間＝比較晚預約的那一刻
  function ruleTime(state, slot, a, b, atUs) {
    var owner = slotOf(state, slot.id).owner.serial, at = slot.bookedAt || {};
    var ta = a === owner ? null : at[a], tb = b === owner ? null : at[b];
    var t = Math.max(ta == null ? -Infinity : ta, tb == null ? -Infinity : tb);
    return isFinite(t) ? t : atUs;
  }
  function dockPair(state, slot, a, b, atUs) {
    var ra = need(state, a), rb = need(state, b), ruleUs = ruleTime(state, slot, a, b, atUs), e = eligible(state, ra, rb, atUs, ruleUs);
    // 一換一：兩邊都選了對方的東西、兩邊都給得出，整對才成交；否則整對不成交，兩邊都不給點、貨都不動
    var d = { id: newId('dk'), slot: slot.id, atUs: atUs, a: a, b: b, tutorial: a === GUIDE || b === GUIDE, how: e.ok ? e.how : null, ok: e.ok, traded: false, reason: e.ok ? null : e.reason, gaveA: 0, gaveB: 0, itemsA: [], itemsB: [], failA: null, failB: null, noteA: null, noteB: null, ruleUs: ruleUs, verA: version(ra, ruleUs).id, verB: version(rb, ruleUs).id };
    if (e.ok) {
      var ab = settleDirection(state, slot, a, b, atUs), ba = settleDirection(state, slot, b, a, atUs);
      d.noteA = ab.note; d.noteB = ba.note;   // 下架沒換到的，另外寫
      if (!ab.selected && !ba.selected) d.reason = '一換一：兩邊都沒選對方的東西';
      else if (!ab.selected) d.reason = '一換一：' + ab.reason;
      else if (!ba.selected) d.reason = '一換一：' + ba.reason;
      else if (!ab.ok) { d.failA = ab.reason; d.reason = ab.reason + '，整對不成交'; }
      else if (!ba.ok) { d.failB = ba.reason; d.reason = ba.reason + '，整對不成交'; }
      else {
        d.traded = true; d.gaveA = ab.points; d.itemsA = ab.items; d.gaveB = ba.points; d.itemsB = ba.items;
        state.dockings.push(d);   // 先寫對接，再寫保留；當天給出去的點用保留算
        ab.items.forEach(function (it) { hold(state, a, b, it, d, atUs); });
        ba.items.forEach(function (it) { hold(state, b, a, it, d, atUs); });
        return d;
      }
    }
    state.dockings.push(d);
    return d;
  }
  // 照判好的結果寫帳：對接紀錄（怎麼通的、各給多少、各拿出什麼、下架沒換到的小字、判定用的版本）、給點、保留
  function writeDocking(state, slot, a, b, atUs, e, ruleUs, ab, ba) {
    var ra = need(state, a), rb = need(state, b);
    var d = { id: newId('dk'), slot: slot.id, atUs: atUs, a: a, b: b, tutorial: a === GUIDE || b === GUIDE, how: e.how, ok: true, traded: true, reason: null, gaveA: ab.points, gaveB: ba.points, itemsA: ab.items, itemsB: ba.items, failA: null, failB: null, noteA: ab.note, noteB: ba.note, ruleUs: ruleUs, verA: version(ra, ruleUs).id, verB: version(rb, ruleUs).id };
    state.dockings.push(d);
    ab.items.forEach(function (it) { hold(state, a, b, it, d, atUs); });
    ba.items.forEach(function (it) { hold(state, b, a, it, d, atUs); });
    return d;
  }
  function itemsText(items) { return items.length ? items.map(function (i) { return i.name; }).join('、') : '（沒有）'; }
  function hold(state, issuer, holder, it, d, atUs) {
    var st = stockOf(need(state, issuer), it.id); st.avail -= 1; st.reserved += 1;
    state.holds.push({ id: newId('h'), issuer: issuer, holder: holder, resource: it.id, name: it.name, price: it.price, docking: d.id, atUs: atUs, untilDay: it.keepDays ? dayNum(atUs) + it.keepDays : null, status: 'held', sig: null });
  }
  // 那一微秒的判定：時間到了還沒判的時段，照時間順序一個一個判，每個都照那個時段的那一微秒（保留到期也照順序處理）。
  // 到場＝事先確認了，或那一刻站在終點上（standing，只有判定窗內算）；主人視為到場。過了判定窗才判的是補判（late），沒確認的記錯過
  function judge(state, now, standing) {
    var out = [], due = [];
    state.roles.forEach(function (owner) { owner.slots.forEach(function (s) { if (!s.judged && s.atUs <= now) due.push({ owner: owner, s: s }); }); });
    due.sort(function (a, b) { return a.s.atUs - b.s.atUs; });
    due.forEach(function (x) {
      var owner = x.owner, s = x.s, late = now >= s.atUs + DOCK_WINDOW_US, at = s.atUs;
      s.judged = true; expireHolds(state, at);
      var present = [owner.serial].concat(s.bookings.filter(function (b) { return (!late && standing && standing[b] === owner.serial) || isPresent(state, b, s.id); }));
      s.bookings.forEach(function (b) { if (present.indexOf(b) < 0) { s.missed.push(b); state.records.push({ kind: 'miss', at: at, text: abbrev(b) + ' 錯過了 ' + fmtUs(s.atUs) + ' 的對接' + (late ? '（沒確認到場）' : '') }); out.push({ slot: s, owner: owner, docking: null, missed: b, late: late }); } else s.docked.push(b); });
      if (s.together) { judgeTogether(state, owner, s, present, at, out); out.forEach(function (o) { if (o.slot === s) o.late = late; }); return; }
      var atUs = at;   // 下面這一段照原本的寫法，用這個時段的那一微秒
      for (var i = 0; i < present.length; i++) for (var j = i + 1; j < present.length; j++) {
        try {
          var d = dockPair(state, s, present[i], present[j], atUs);
          state.records.push({ kind: d.traded ? 'dock' : 'nodock', tutorial: d.tutorial, at: atUs, text: (d.tutorial ? '（教學）' : '') + abbrev(d.a) + ' 與 ' + abbrev(d.b) + ' 在 ' + fmtUs(atUs) + (d.traded ? ' 互換：' + need(state, d.a).name + ' 拿出 ' + itemsText(d.itemsA) + '（' + d.gaveA + ' 點）' + (d.noteA ? '（' + d.noteA + '）' : '') + '，' + need(state, d.b).name + ' 拿出 ' + itemsText(d.itemsB) + '（' + d.gaveB + ' 點）' + (d.noteB ? '（' + d.noteB + '）' : '') + '（' + d.how + '）' : ' 不成交：' + d.reason) });
          out.push({ slot: s, owner: owner, docking: d, late: late });
        } catch (e) {   // 一對出錯不影響其他對，出錯也留紀錄
          state.records.push({ kind: 'error', at: atUs, text: abbrev(present[i]) + ' 與 ' + abbrev(present[j]) + ' 在 ' + fmtUs(atUs) + ' 判定出錯：' + e.message });
        }
      }
    });
    if (due.length) expireHolds(state, now);   // 補判完，保留到期也算到現在
    return out;
  }
  function dockText(state, d, atUs) { return (d.tutorial ? '（教學）' : '') + abbrev(d.a) + ' 與 ' + abbrev(d.b) + ' 在 ' + fmtUs(atUs) + (d.traded ? ' 互換：' + need(state, d.a).name + ' 拿出 ' + itemsText(d.itemsA) + '（' + d.gaveA + ' 點）' + (d.noteA ? '（' + d.noteA + '）' : '') + '，' + need(state, d.b).name + ' 拿出 ' + itemsText(d.itemsB) + '（' + d.gaveB + ' 點）' + (d.noteB ? '（' + d.noteB + '）' : '') + '（' + d.how + '）' : ' 不成交：' + d.reason); }
  // 有選東西的一對：至少一邊選了對方的東西
  function selectedPairs(state, slot) {
    var ps = participants(state, slot), out = [];
    for (var i = 0; i < ps.length; i++) for (var j = i + 1; j < ps.length; j++) if (wantsOf(slot, ps[i], ps[j]).length || wantsOf(slot, ps[j], ps[i]).length) out.push([ps[i], ps[j]]);
    return out;
  }
  // 一起成交的時段，那一微秒之前：有選東西、但還沒兩邊都選的那幾對（只寫選了沒，不寫選了什麼）
  function togetherMissing(state, slot) {
    var out = [];
    selectedPairs(state, slot).forEach(function (p) {
      var nm = function (x) { var r = roleOf(state, x); return r ? r.name : abbrev(x); };
      if (!wantsValid(state, slot, p[0], p[1]).length) out.push('還差 ' + nm(p[0]) + ' 選 ' + nm(p[1]) + ' 的東西');
      if (!wantsValid(state, slot, p[1], p[0]).length) out.push('還差 ' + nm(p[1]) + ' 選 ' + nm(p[0]) + ' 的東西');
    });
    return out;
  }
  // 那一微秒之前一起成交的狀態一句話：還沒有人選東西／還差誰／都選好了
  function togetherStatus(state, slot) { if (!selectedPairs(state, slot).length) return '還沒有人選東西'; var m = togetherMissing(state, slot); return m.length ? '一起成交：' + m.join('；') : '都選好了'; }
  // 一起成交：有選東西的每一對都要兩個人都到場、條件通、兩邊都選了、兩邊都給得出（同一個人給的點、同一樣東西的份數合起來算），才全部一起成交；
  // 只要有一對不成，整個時段不成交，誰的點都不給、貨都不動。兩邊都沒選的那一對照舊記「兩邊都沒選」，不影響
  function judgeTogether(state, owner, s, present, atUs, out) {
    var nm = function (x) { var r = roleOf(state, x); return r ? r.name : abbrev(x); };
    var pairs = selectedPairs(state, s), fails = [], plan = [], give = {}, need2 = {};
    pairs.forEach(function (p) {
      var a = p[0], b = p[1], who = nm(a) + ' 和 ' + nm(b);
      try {
        var absent = p.filter(function (x) { return present.indexOf(x) < 0; });
        if (absent.length) { fails.push(who + ' 不成（' + absent.map(nm).join('、') + ' 沒到場）'); return; }
        var ra = need(state, a), rb = need(state, b), ruleUs = ruleTime(state, s, a, b, atUs), e = eligible(state, ra, rb, atUs, ruleUs);
        if (!e.ok) { fails.push(who + ' 不成（' + e.reason + '）'); return; }
        var ab = settleDirection(state, s, a, b, atUs), ba = settleDirection(state, s, b, a, atUs);
        if (!ab.selected || !ba.selected) { fails.push(who + ' 不成（' + (!ab.selected ? ab.reason : ba.reason) + '）'); return; }
        if (!ab.ok || !ba.ok) { fails.push(who + ' 不成（' + (!ab.ok ? ab.reason : ba.reason) + '）'); return; }
        plan.push({ a: a, b: b, e: e, ruleUs: ruleUs, ab: ab, ba: ba });
        [[a, ab], [b, ba]].forEach(function (x) { var g = x[0], r = x[1]; give[g] = (give[g] || 0) + r.points; need2[g] = need2[g] || {}; r.items.forEach(function (it) { need2[g][it.id] = (need2[g][it.id] || 0) + 1; }); });
      } catch (err) { fails.push(who + ' 不成（判定出錯：' + err.message + '）'); }
    });
    // 合起來算：同一個人給出去的點不能超過當天剩的，同一樣東西被選的份數不能超過可換的
    Object.keys(give).forEach(function (g) { var r = need(state, g), left = remainingToday(state, r, atUs); if (give[g] > left) fails.push(nm(g) + ' 合起來要給 ' + give[g] + ' 點，今天只剩 ' + left + ' 點'); Object.keys(need2[g]).forEach(function (id) { var av = stockOf(r, id).avail; if (need2[g][id] > av) fails.push(nm(g) + ' 的「' + resourceName(r, id) + '」合起來要 ' + need2[g][id] + ' 份，可換 ' + av + ' 份'); }); });
    var reason = fails.length ? '一起成交：' + fails.join('；') + '，整個時段不成交' : null;
    // 兩邊都沒選的那一對（都到場的）照舊記
    for (var i = 0; i < present.length; i++) for (var j = i + 1; j < present.length; j++) {
      var a = present[i], b = present[j]; if (pairs.some(function (p) { return (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a); })) continue;
      try { var d0 = dockPair(state, s, a, b, atUs); d0.together = true; state.records.push({ kind: 'nodock', tutorial: d0.tutorial, at: atUs, text: dockText(state, d0, atUs) }); out.push({ slot: s, owner: owner, docking: d0 }); }
      catch (e) { state.records.push({ kind: 'error', at: atUs, text: abbrev(a) + ' 與 ' + abbrev(b) + ' 在 ' + fmtUs(atUs) + ' 判定出錯：' + e.message }); }
    }
    pairs.forEach(function (p) {
      var d;
      if (reason) {
        var ra = roleOf(state, p[0]), rb = roleOf(state, p[1]), ruleUs = ruleTime(state, s, p[0], p[1], atUs);
        d = { id: newId('dk'), slot: s.id, atUs: atUs, a: p[0], b: p[1], together: true, tutorial: p[0] === GUIDE || p[1] === GUIDE, how: null, ok: true, traded: false, reason: reason, gaveA: 0, gaveB: 0, itemsA: [], itemsB: [], failA: null, failB: null, noteA: null, noteB: null, ruleUs: ruleUs, verA: ra ? version(ra, ruleUs).id : null, verB: rb ? version(rb, ruleUs).id : null };
        state.dockings.push(d);
      } else {   // 全部都成：照判好的結果直接寫帳，不再重判（寫完前幾對的帳，事實會變）
        var q = plan.find(function (x) { return x.a === p[0] && x.b === p[1]; });
        d = writeDocking(state, s, q.a, q.b, atUs, q.e, q.ruleUs, q.ab, q.ba); d.together = true;
      }
      state.records.push({ kind: d.traded ? 'dock' : 'nodock', tutorial: d.tutorial, at: atUs, text: dockText(state, d, atUs) });
      out.push({ slot: s, owner: owner, docking: d });
    });
  }
  // 保留到期（過了判定窗還沒判的時段由 judge 補判，不在這裡）
  function expire(state, atUs) { return expireHolds(state, atUs); }
  // 我預約了、還沒判定的時段
  function myBookings(state, me, atUs) {
    var out = [];
    state.roles.forEach(function (r) { if (r === me) return; r.slots.forEach(function (s) { if (s.bookings.indexOf(me.serial) >= 0 && !s.judged) out.push({ owner: r, slot: s }); }); });
    return out.sort(function (a, b) { return a.slot.atUs - b.slot.atUs; });
  }

  /* ---------- 規則 6（點數帳）：保留 ---------- */
  function holdStatus(h, atUs) { if (h.status === 'held' && h.untilDay != null && dayNum(atUs) > h.untilDay) return 'expired'; return h.status; }
  // 到期沒換：作廢、已保留 −1、可換 +1，留紀錄
  function expireHolds(state, atUs) {
    var n = 0;
    state.holds.forEach(function (h) {
      if (h.status !== 'held' || holdStatus(h, atUs) !== 'expired') return;
      h.status = 'expired'; n++;
      var iss = roleOf(state, h.issuer); if (iss) { var st = stockOf(iss, h.resource); st.reserved = Math.max(0, st.reserved - 1); st.avail += 1; }
      state.records.push({ kind: 'expire', at: atUs, text: abbrev(h.holder) + ' 保留的「' + h.name + '」（' + h.price + ' ' + (iss ? iss.name : abbrev(h.issuer)) + '點）到期沒換，作廢，貨回到可換' });
    });
    return n;
  }
  function holdsOf(state, holder, atUs) { return state.holds.filter(function (h) { return h.holder === holder && holdStatus(h, atUs) === 'held'; }); }
  function heldPoints(state, holder, issuer, atUs) { return holdsOf(state, holder, atUs).filter(function (h) { return h.issuer === issuer; }).reduce(function (s, h) { return s + h.price; }, 0); }
  // 帳房：每筆保留：誰的點、什麼東西、多少點、保留到哪天
  function holdings(state, holder, atUs) {
    return holdsOf(state, holder, atUs).map(function (h) { return { hold: h, issuer: roleOf(state, h.issuer), until: h.untilDay == null ? '一直保留' : dayLabel(h.untilDay), untilText: untilText(h) }; });
  }
  function untilText(h) { return h.untilDay == null ? '一直保留' : '保留到 ' + dayLabel(h.untilDay); }
  // 兌現：把這筆保留換掉
  function redeem(state, holderSerial, holdId, atUs) {
    var h = state.holds.find(function (x) { return x.id === holdId; }); if (!h) bad('沒有這筆保留');
    if (h.holder !== holderSerial) bad('這不是你的保留');
    var st = holdStatus(h, atUs); if (st !== 'held') bad(st === 'expired' ? '這筆已經到期作廢了' : st === 'redeemed' ? '已經換過了' : '這筆已經作廢');
    var iss = need(state, h.issuer);
    h.status = 'redeemed'; h.redeemedAt = atUs;
    var sk = stockOf(iss, h.resource); sk.reserved = Math.max(0, sk.reserved - 1);
    var rec = { id: newId('rd'), holder: holderSerial, issuer: h.issuer, hold: h.id, name: h.name, cost: h.price, atUs: atUs, ok: true };
    state.redeems.push(rec);
    return rec;
  }


  /* ---------- 預設示範資料 ---------- */
  function defaultWorld(serial) {
    var n = parseInt(serial, 10) % 3, cols = [['#B8894A', '#C9B47A', '#C9A96A', '#6E7C8C', '#8C7B62'], ['#3F8A5A', '#9BB7C9', '#6FB3AC', '#8A8F96', '#7C8A99'], ['#B07A82', '#D9A0A8', '#D9A0A8', '#C9CED4', '#7A6A72']][n];
    return {
      start: [0, 7],
      objects: [
        { id: 'rule_' + serial, name: '規則屋', func: 'rule', pos: [-6, -2], look: '屋', parts: look('屋', cols[0]) },
        { id: 'res_' + serial, name: '市集', func: 'resource', pos: [6, 6], look: '市集', parts: look('市集', cols[1]) },
        { id: 'goal_' + serial, name: '終點台', func: 'goal', pos: [6, -2], look: '台', parts: look('台', cols[2]) },
        { id: 'role_' + serial, name: '角色碑', func: 'role', pos: [0, -6], look: '碑', parts: look('碑', cols[3]) },
        { id: 'pts_' + serial, name: '帳房', func: 'points', pos: [-6, 6], look: '工坊', parts: look('工坊', cols[4]) }
      ],
      path: [[0, 7], [6, -2]],
      walk: { circles: [{ object: 'rule_' + serial, letter: 'J' }], moves: [{ from: 'role_' + serial, to: 'goal_' + serial, digit: '1' }, { from: 'role_' + serial, to: 'res_' + serial, digit: '2' }, { from: 'role_' + serial, to: 'rule_' + serial, digit: '3' }, { from: 'rule_' + serial, to: 'pts_' + serial, digit: '4' }] }
    };
  }
  var GUIDE = '00000000004';   // 引路人：平台的教學角色（J4）
  function fresh() {
    var now = nowUs();
    var st = { v: 8, me: -1, roles: [], issued: [], holds: [], dockings: [], redeems: [], acceptances: [], records: [], presence: {}, tutorial: { step: 1, round: 1, skipped: false, firstView: null, slot: null, choice: null, cmp: 0, found: false, saw: false } };
    // 示範角色：阿澄（條件：可換的貨 ≥ 5）、小樂（要兩方都通、接受村規）、引路人（沒有條件、一堆 0 點的「空的」）。第一次打開從創角色開始
    createRole(st, { serial: '00000000002', name: '阿澄', dailyPoints: 2000,
      rules: { uses: ['1 阿澄點 = 聽你講 1 分鐘', '100 阿澄點 = 幫你改一份履歷'], conditions: [{ field: 'avail', op: '>=', value: 5 }], village: '東恆村規：對接後要一起立一個難題。' },
      resources: [{ id: 'r2a', name: '改履歷', def: '一份，三天內回', price: 100, keepDays: 30, avail: 3 }, { id: 'r2b', name: '一小時諮詢', def: '', price: 90, keepDays: null, avail: 10 }, { id: 'r2c', name: '試聽 5 分鐘', def: '試用品，不收點', price: 0, keepDays: 7, avail: 3 }], contact: '' }, now);
    createRole(st, { serial: '00000000003', name: '小樂', dailyPoints: 800,
      rules: { uses: ['1 小樂點 = 借書 1 天'], conditions: [{ field: 'myPoints', op: '>=', value: 0 }], bothMustPass: true, mustAcceptVillage: true, village: '小樂村規：借的書要在一個月內還。' },
      resources: [{ id: 'r3a', name: '借一本書', def: '', price: 10, keepDays: 14, avail: 20 }], contact: 'mail@example.com' }, now);
    createRole(st, { serial: GUIDE, name: '引路人', dailyPoints: 2000,
      rules: { uses: ['引路人的點只用來教學'], conditions: [], village: '' },
      resources: [{ id: 'r4e', name: '空的', def: '什麼都不給；教學用', price: 0, keepDays: null, avail: 99999 }], contact: '' }, now);
    // 阿澄開兩個對接時段：3 分鐘後、10 分鐘後，各 2 個名額
    addSlot(st, '00000000002', now + 180e6, 2, null, now);
    addSlot(st, '00000000002', now + 600e6, 2, null, now);
    return st;
  }
  // 創自己的角色：放在最前面（J1），當下生效；第一樣東西「空的」在這裡建、補貨
  function createPlayer(state, f, atUs) {
    atUs = atUs || nowUs();
    var res = [];
    if (f.firstItem && String(f.firstItem.name || '').trim()) res.push({ id: 'e' + Date.now().toString(36), name: f.firstItem.name, def: f.firstItem.def || '', price: f.firstItem.price == null ? 0 : f.firstItem.price, keepDays: f.firstItem.keepDays == null || f.firstItem.keepDays === '' ? null : f.firstItem.keepDays, avail: f.firstItem.qty == null ? 1 : f.firstItem.qty });
    var r = createRole(state, { name: f.name, dailyPoints: f.dailyPoints == null || f.dailyPoints === '' ? DEFAULT_DAILY : f.dailyPoints, rules: f.rules || {}, resources: res, contact: f.contact || '' }, atUs);
    state.roles.splice(state.roles.indexOf(r), 1); state.roles.unshift(r); state.me = 0;
    return r;
  }
  // 示範的「我」（測試和示範用）：J1，帶規則、資源、聯絡方式、一個時段
  function demoMe(state, now) {
    now = now || nowUs();
    var r = createRole(state, { serial: '00000000001', name: '我', dailyPoints: 1800,
      rules: { uses: ['1 我點 = 陪跑 1 分鐘', '60 我點 = 一起吃一頓早餐'], conditions: [{ field: 'avail', op: '>=', value: 3 }], village: '' },
      resources: [{ id: 'r1a', name: '陪跑一小時', def: '約在河堤，早上', price: 60, keepDays: 7, avail: 1 }, { id: 'r1b', name: '早餐一頓', def: '', price: 100, keepDays: null, avail: 5 }], contact: 'LINE: me_demo' }, now);
    state.roles.splice(state.roles.indexOf(r), 1); state.roles.unshift(r); state.me = 0;
    addSlot(state, '00000000001', now + 300e6, 1, null, now);
    return r;
  }
  // 還沒創角色時畫面用的空殼（不在 roles 裡）
  var BLANK = '99999999999';   // 空殼的序號：沒有開頭的 0，不會跟發出去的序號（從 1 號往上）撞號
  function blankRole() { var st = { roles: [] }; var r = createRole(st, { serial: BLANK, name: '還沒創角色', dailyPoints: DEFAULT_DAILY }, nowUs()); r.blank = true; return r; }
  function isGuide(serial) { return serial === GUIDE; }

  /* ---------- 純資料檢查：角色 ---------- */
  function cleanVersion(v) {
    obj(v, '版本'); var ru = obj(v.rules, '規則表');
    return { id: ident(v.id, '版本'), fromDay: num(v.fromDay, '版本'), dailyPoints: num(v.dailyPoints, '每天的點'),
      rules: { uses: list(ru.uses || [], LIMITS.rules, '用途').map(function (t) { return str(t, LIMITS.text, '用途'); }),
               conditions: list(ru.conditions || [], LIMITS.rules, '條件').map(function (c) { obj(c, '條件'); if (!COND_FIELDS[c.field] || !OPS[c.op]) bad('條件格式錯'); return { field: c.field, op: c.op, value: num(c.value, '條件') }; }),
               bothMustPass: !!ru.bothMustPass, mustAcceptVillage: !!ru.mustAcceptVillage, village: str(ru.village || '', LIMITS.text, '村規'), villageKey: ru.villageKey == null ? null : str(ru.villageKey, 200, '金鑰') },
      resources: list(v.resources || [], LIMITS.rules, '資源').map(function (x) { obj(x, '資源'); return { id: ident(x.id, '資源'), name: str(x.name, LIMITS.name, '資源'), def: str(x.def || '', LIMITS.text, '定義'), price: num(x.price, '價格'), keepDays: x.keepDays == null ? null : num(x.keepDays, '保留天數') }; }) };
  }
  function cleanRole(r) {
    obj(r, '角色');
    if (!/^\d{11}$/.test(String(r.serial)) || !abbrev(r.serial)) bad('序號格式錯');
    var stock = {}; obj(r.stock || {}, '數量'); Object.keys(r.stock || {}).forEach(function (k) { var s = obj(r.stock[k], '數量'); stock[ident(k, '資源')] = { avail: num(s.avail, '可換'), reserved: num(s.reserved, '已保留') }; });
    var ser = function (what) { return function (b) { return str(b, 11, what); }; };
    return {
      serial: r.serial, name: str(r.name, LIMITS.name, '名字'), contact: str(r.contact || '', LIMITS.text, '聯絡方式'),
      versions: list(r.versions, 4000, '版本').map(cleanVersion), stock: stock,
      slots: list(r.slots || [], 200, '時段').map(function (s) { obj(s, '時段'); var wants = {}; Object.keys(s.wants || {}).forEach(function (a) { wants[str(a, 11, '選')] = {}; Object.keys(s.wants[a]).forEach(function (b) { wants[a][str(b, 11, '選')] = list(s.wants[a][b], 200, '選').map(function (id) { return ident(id, '選'); }); }); }); var mg = {}; Object.keys(s.maxGive || {}).forEach(function (a) { mg[str(a, 11, '最多給')] = num(s.maxGive[a], '最多給'); });
        var ba = {}; Object.keys(s.bookedAt || {}).forEach(function (k) { ba[str(k, 11, '預約時間')] = num(s.bookedAt[k], '預約時間'); });
        return { id: ident(s.id, '時段'), atUs: num(s.atUs, '時段'), capacity: num(s.capacity, '名額'), together: !!s.together, bookings: list(s.bookings || [], 200, '預約').map(ser('預約')), confirmed: list(s.confirmed || [], 200, '確認到場').map(ser('確認到場')), bookedAt: ba, docked: list(s.docked || [], 200, '對接').map(ser('對接')), missed: list(s.missed || [], 200, '錯過').map(ser('錯過')), wants: wants, maxGive: mg, judged: !!s.judged }; }),
      world: cleanWorld(r.world)
    };
  }
  // 世界：沿用 v5 的格式（物件、門、走法、路、起點）
  function cleanWorld(w) {
    obj(w, '世界');
    var out = { start: vec(w.start || [0, 0], 2, '起點'), objects: cleanObjects(w.objects || [], 1, '功能點'), path: list(w.path || [], LIMITS.path, '路').map(function (p) { return vec(p, 2, '路'); }), walk: { circles: [], moves: [] } };
    var ids = {};
    allObjects(out).forEach(function (x) { if (ids[x.o.id]) bad('功能點代號重複：' + x.o.id); ids[x.o.id] = true; });
    var walk = obj(w.walk || {}, '走法表');
    out.walk.circles = list(walk.circles || [], LIMITS.rules, '繞圈').map(function (c) { obj(c, '繞圈'); if (!ids[c.object]) bad('繞圈指到不存在的物件'); if (!/^[A-J]$/.test(String(c.letter))) bad('繞圈字母錯'); return { object: c.object, letter: c.letter }; });
    out.walk.moves = list(walk.moves || [], LIMITS.rules, '走到').map(function (m) { obj(m, '走到'); if (!ids[m.from] || !ids[m.to]) bad('走到指到不存在的物件'); if (!/^[0-9]$/.test(String(m.digit))) bad('走到的數字錯'); return { from: m.from, to: m.to, digit: m.digit }; });
    return out;
  }
  function tryClean(r) { try { return { role: cleanRole(r) }; } catch (e) { return { error: e.message }; } }

  /* ---------- 存檔 ---------- */
  var KEY = 'arrive-v8';
  function load() {
    try {
      var s = localStorage.getItem(KEY);
      if (s) {
        var j = JSON.parse(s);
        if (j && j.v === 8 && Array.isArray(j.roles) && j.roles.length) {
          var roles = j.roles.map(cleanRole);
          var holds = list(j.holds || [], 20000, '保留').map(function (h) { obj(h, '保留'); return { id: str(h.id, 60, '保留'), issuer: str(h.issuer, 11, '保留'), holder: str(h.holder, 11, '保留'), resource: ident(h.resource, '保留'), name: str(h.name, LIMITS.name, '保留'), price: num(h.price, '保留'), docking: str(h.docking || '', 60, '保留'), atUs: num(h.atUs, '保留'), untilDay: h.untilDay == null ? null : num(h.untilDay, '保留'), status: ['held', 'redeemed', 'expired', 'voided'].indexOf(h.status) >= 0 ? h.status : 'held', sig: h.sig == null ? null : str(h.sig, 200, '簽章') }; });
          var copy = function (what) { return list(j[what] || [], 20000, what).map(function (x) { obj(x, what); return JSON.parse(JSON.stringify(x)); }); };
          var me = (typeof j.me === 'number' && j.me >= -1 && j.me < roles.length) ? j.me : -1;
          var tu = obj(j.tutorial || {}, '教學');
          // 發過的序號：存檔記的，加上存檔裡出現過的（角色、對接、保留、兌現、接受村規、不玩了的紀錄）
          var issued = list(j.issued || [], 100000, '序號').map(function (x) { return str(x, 11, '序號'); });
          var seen = function (x) { if (x && /^\d{11}$/.test(x) && issued.indexOf(x) < 0) issued.push(x); };
          roles.forEach(function (r) { seen(r.serial); }); holds.forEach(function (h) { seen(h.issuer); seen(h.holder); });
          (j.dockings || []).forEach(function (d) { d = obj(d, '對接'); seen(d.a); seen(d.b); }); (j.redeems || []).forEach(function (x) { x = obj(x, '兌現'); seen(x.holder); seen(x.issuer); });
          (j.acceptances || []).forEach(function (x) { x = obj(x, '接受'); seen(x.who); seen(x.of); }); (j.records || []).forEach(function (x) { x = obj(x, '紀錄'); seen(x.serial); });
          return { v: 8, me: me, roles: roles, issued: issued, holds: holds, dockings: copy('dockings'), redeems: copy('redeems'), acceptances: copy('acceptances'), records: copy('records'), presence: {}, tutorial: { step: tu.step == null ? 'done' : tu.step, round: num(tu.round == null ? 1 : tu.round, '教學'), skipped: !!tu.skipped, firstView: tu.firstView == null ? null : str(tu.firstView, 10, '教學'), slot: tu.slot == null ? null : str(tu.slot, 60, '教學'), choice: tu.choice == null ? null : str(tu.choice, 10, '教學'), cmp: num(tu.cmp || 0, '教學'), found: !!tu.found, saw: !!tu.saw } };
        }
      }
    } catch (e) { /* 壞掉或沒有儲存空間：用預設 */ }
    return fresh();
  }
  function save(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 忽略 */ } }
  function findRole(state, code) { var serial = expand(code); return serial ? roleOf(state, serial) : null; }

  return {
    abbrev: abbrev, expand: expand, digitsAfter: digitsAfter, Decoder: Decoder, route: route,
    FUNCS: FUNCS, SHAPES: SHAPES, LOOKS: LOOKS, look: look, radiusOf: radiusOf, VIS: VIS, allObjects: allObjects, findObject: findObject, cleanWorld: cleanWorld, cleanRole: cleanRole, tryClean: tryClean,
    fmtUs: fmtUs, nowUs: nowUs, untilText: untilText, deleteSlot: deleteSlot, togetherMissing: togetherMissing, togetherStatus: togetherStatus, selectedPairs: selectedPairs, BLANK: BLANK, dayOf: dayOf, dayNum: dayNum, dayLabel: dayLabel, DAY_US: DAY_US, newId: newId, DEFAULT_DAILY: DEFAULT_DAILY,
    version: version, pending: pending, tomorrow: tomorrow, dropPending: dropPending, resourceOf: resourceOf, resourceName: resourceName, setDailyPoints: setDailyPoints, setRules: setRules, addResource: addResource, setResource: setResource, removeResource: removeResource, cleanRules: cleanRules,
    dailyPoints: dailyPoints, givenToday: givenToday, remainingToday: remainingToday, stockOf: stockOf, restock: restock, availTotal: availTotal,
    COND_FIELDS: COND_FIELDS, OPS: OPS, condText: condText, passes: passes, eligible: eligible, accepted: accepted, acceptedAny: acceptedAny, accept: accept, acceptState: acceptState, villageChanges: villageChanges, ruleTime: ruleTime,
    createRole: createRole, quit: quit, quitBlockers: quitBlockers,
    canVisit: canVisit, canCome: canCome, searchResources: searchResources, nextSlot: nextSlot, dockCount: dockCount, ratio: ratio,
    addSlot: addSlot, slotOf: slotOf, participants: participants, book: book, cancelBooking: cancelBooking, setWants: setWants, wantsOf: wantsOf, wantsValid: wantsValid, wantsGone: wantsGone, goneText: goneText, wantTotal: wantTotal, setMaxGive: setMaxGive, maxGiveOf: maxGiveOf, contactVisible: contactVisible,
    DOCK_WINDOW_US: DOCK_WINDOW_US, missed: missed, setPresent: setPresent, isPresent: isPresent, judge: judge, expire: expire, myBookings: myBookings, settleDirection: settleDirection,
    itemsText: itemsText, holdStatus: holdStatus, expireHolds: expireHolds, holdsOf: holdsOf, heldPoints: heldPoints, holdings: holdings, redeem: redeem,
    defaultWorld: defaultWorld, fresh: fresh, load: load, save: save, findRole: findRole, roleOf: roleOf, GUIDE: GUIDE, isGuide: isGuide, createPlayer: createPlayer, demoMe: demoMe, blankRole: blankRole
  };
})();
var DATA = CORE;   // world.js 用這個名字
if (typeof module !== 'undefined') module.exports = CORE;
