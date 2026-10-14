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
  var LIMITS = { objects: 60, parts: 24, path: 200, rules: 50, text: 2000, name: 60, slots: 20000, versions: 20000, rows: 300000, booked: 200 };   // 存檔要撐好幾年：每天開好幾個時段、玩十年也放得下
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
    return { uses: (rules.uses || []).map(String).filter(Boolean), conditions: conds, bothMustPass: !!rules.bothMustPass, mustAcceptVillage: !!rules.mustAcceptVillage, village: String(rules.village || ''), site: cleanSite(rules.site), villageKey: null };
  }
  // 家規網站：選填，只收 https:// 開頭的網址（別的存不進去）
  function cleanSite(u) {
    u = String(u == null ? '' : u).trim(); if (!u) return '';
    if (!/^https:\/\/[^\s<>"']+$/.test(u) || u.length > 300) bad('家規網站只收 https:// 開頭的網址');
    return u;
  }
  // 改家規網站：跟家規一樣明天起生效
  function setSite(state, serial, url, atUs) { var u = cleanSite(url); tomorrow(state, serial, atUs).rules.site = u; return u; }
  function setContact(state, serial, text) { var r = need(state, serial); r.contact = String(text == null ? '' : text).slice(0, LIMITS.text); return r.contact; }
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
  // 接受家規記下接受的是哪一版（家規內容）；家規改了，舊的接受不算
  function accepted(state, who, of, village) { return state.acceptances.some(function (a) { return a.who === who && a.of === of && (village == null || a.village === village); }); }
  function acceptedAny(state, who, of) { return state.acceptances.some(function (a) { return a.who === who && a.of === of; }); }
  function accept(state, who, of, atUs) { atUs = atUs || nowUs(); var village = version(need(state, of), atUs).rules.village; if (!accepted(state, who, of, village)) state.acceptances.push({ who: who, of: of, village: village, atUs: atUs }); }
  // 接受的狀態：current＝接受的是現在這一版；old＝接受的是舊版，要重新接受；none＝還沒接受
  function acceptState(state, who, role, atUs) { var village = version(role, atUs).rules.village; return accepted(state, who, role.serial, village) ? 'current' : acceptedAny(state, who, role.serial) ? 'old' : 'none'; }
  function villageChanges(role, atUs) { var p = pending(role, atUs); return !!p && p.rules.village !== version(role, atUs).rules.village; }
  // a 和 b 能不能對接：一方通就可以；任一方要求兩方都通就要兩方；要求接受家規而對方沒接受就不行
  // ruleUs：用哪一刻生效的規則表（預約那一刻）；事實照 atUs
  function eligible(state, a, b, atUs, ruleUs) {
    if (ruleUs == null) ruleUs = atUs;
    if (a.serial === b.serial) return { ok: false, reason: '自己不能和自己對接' };
    var ra = version(a, ruleUs).rules, rb = version(b, ruleUs).rules;
    if (ra.mustAcceptVillage && !accepted(state, b.serial, a.serial, ra.village)) return { ok: false, reason: abbrev(b.serial) + ' 還沒接受 ' + abbrev(a.serial) + ' 的家規' + (acceptedAny(state, b.serial, a.serial) ? '（接受的是舊版）' : '') };
    if (rb.mustAcceptVillage && !accepted(state, a.serial, b.serial, rb.village)) return { ok: false, reason: abbrev(a.serial) + ' 還沒接受 ' + abbrev(b.serial) + ' 的家規' + (acceptedAny(state, a.serial, b.serial) ? '（接受的是舊版）' : '') };
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
    var r = { serial: serial, name: String(f.name).trim(), contact: String(f.contact || ''), slots: [], stock: {}, world: f.world || defaultWorld(serial), born: dayNum(atUs), house: cleanHouse(f.house && f.house.template ? Object.assign({}, f.house, { blocks: template(f.house.template, f.house.wall, f.house.roof).concat(f.house.extra || []), cal: { dir: f.house.calDir || 'up', blocks: [] } }) : (f.house || {}), plotOf(0), false, dayNum(atUs), dayNum(atUs)),
              versions: [{ id: newId('v'), fromDay: dayNum(atUs), dailyPoints: daily, rules: cleanRules(f.rules), resources: (f.resources || []).map(cleanRes) }] };
    r.versions[0].resources.forEach(function (x, i) { var src = f.resources[i]; r.stock[x.id] = { avail: Math.max(0, Math.floor(+(src && src.avail) || 0)), reserved: 0 }; });
    r.house.calRemoved = 0;   // 新角色：第一塊日曆本來就在牆上，不算拆
    state.roles.push(r);
    return r;
  }
  // 不玩了：手上有我點的人都換完才能刪；單機版持有人都在本機，視為同意（consent）
  function quitBlockers(state, serial, atUs) { return state.holds.filter(function (h) { return h.issuer === serial && holdStatus(h, atUs) === 'held'; }); }
  function quit(state, serial, atUs, consent) {
    var r = need(state, serial), blockers = quitBlockers(state, serial, atUs);
    if (blockers.length && !consent) bad('還有 ' + blockers.length + ' 筆你的點沒換：' + blockers.map(function (h) { return abbrev(h.holder) + '「' + h.name + '」'; }).join('、') + '。先讓他們換完，或取得同意');
    blockers.forEach(function (h) { h.status = 'voided'; h.endedAt = atUs; });
    state.holds.forEach(function (h) { if (h.holder === serial && holdStatus(h, atUs) === 'held') { h.status = 'voided'; h.endedAt = atUs; var iss = roleOf(state, h.issuer); if (iss) { var st = stockOf(iss, h.resource); st.reserved = Math.max(0, st.reserved - 1); st.avail += 1; } } });
    state.roles.forEach(function (o) { o.slots.forEach(function (s) { s.bookings = s.bookings.filter(function (b) { return b !== serial; }); }); });
    var mySlots = {}; r.slots.forEach(function (s) { if (!s.judged) mySlots[s.id] = true; });
    state.entries = entriesOf(state).filter(function (e) { return !(e.status === 'booked' && (e.a === serial || e.b === serial || mySlots[e.slot])); });   // 未來的預約一起拿掉；過去的那幾筆留著（記著名字）
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
    var s = { id: newId('slot'), atUs: atUs, capacity: cap, together: !!together, bookings: [], confirmed: [], visAt: {}, bookedAt: {}, docked: [], missed: [], wants: {}, maxGive: {}, judged: false };
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
  // 預約的時候就一起確認到達（預設確認；arrive === false 就是不要）
  function book(state, visitorSerial, slotId, atUs, arrive) {
    var x = slotOf(state, slotId); if (!x) bad('沒有這個時段');
    var visitor = need(state, visitorSerial);
    if (x.owner.serial === visitorSerial) bad('自己的時段不用預約');
    if (x.slot.atUs <= atUs) bad('這個時段已經過了');
    if (x.slot.bookings.indexOf(visitorSerial) >= 0) bad('你已經預約了');
    if (x.slot.bookings.length >= x.slot.capacity) bad('名額滿了');
    var e = eligible(state, x.owner, visitor, atUs); if (!e.ok) bad('條件不通，不能預約：' + e.reason);
    x.slot.bookings.push(visitorSerial);
    x.slot.bookedAt = x.slot.bookedAt || {}; x.slot.bookedAt[visitorSerial] = atUs;   // 預約那一刻：那一微秒照這時候的規則表判
    x.slot.confirmed = (x.slot.confirmed || []).filter(function (c) { return c !== visitorSerial; });
    if (arrive !== false) x.slot.confirmed.push(visitorSerial);
    // 未來的預約也算一筆：約的人照自己約的那一刻、主人照被約的那一刻的「新的一筆預設」；兩個來約的人之間照各自約的那一刻
    x.slot.visAt = x.slot.visAt || {}; x.slot.visAt[visitorSerial] = houseOf(visitor).defaultVis;
    addEntry(state, x.slot, x.owner, x.owner.serial, visitorSerial, houseOf(x.owner).defaultVis, x.slot.visAt[visitorSerial], atUs);
    x.slot.bookings.forEach(function (b) { if (b !== visitorSerial) addEntry(state, x.slot, x.owner, b, visitorSerial, x.slot.visAt[b] || houseOf(roleOf(state, b)).defaultVis, x.slot.visAt[visitorSerial], atUs); });
    return x.slot;
  }
  function cancelBooking(state, visitorSerial, slotId) { var x = slotOf(state, slotId); if (!x) bad('沒有這個時段'); if (x.slot.judged) bad('那一微秒已經過了'); x.slot.bookings = x.slot.bookings.filter(function (s) { return s !== visitorSerial; }); x.slot.confirmed = (x.slot.confirmed || []).filter(function (c) { return c !== visitorSerial; }); delete x.slot.wants[visitorSerial]; if (x.slot.visAt) delete x.slot.visAt[visitorSerial]; state.entries = entriesOf(state).filter(function (e) { return !(e.slot === slotId && e.status === 'booked' && (e.a === visitorSerial || e.b === visitorSerial)); }); if (x.slot.bookedAt) delete x.slot.bookedAt[visitorSerial]; }
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

  /* ---------- 規則 7：那一微秒。到達的人兩兩判定，成立的每一對兩個方向各自成交 ---------- */
  var DOCK_WINDOW_US = 1e6;
  function missed(slot, visitorSerial) { return (slot.missed || []).indexOf(visitorSerial) >= 0; }
  // 到達是事先確認：預約時就一起確認（預設）；之後到那一微秒之前隨時取消、再確認，存在時段上（存檔留著）；主人開時段就算確認
  function setPresent(state, visitorSerial, slotId, present) {
    var x = slotOf(state, slotId); if (!x) bad('沒有這個時段');
    if (x.slot.judged) bad('那一微秒已經過了');
    if (x.owner.serial !== visitorSerial && x.slot.bookings.indexOf(visitorSerial) < 0) bad('先預約才能確認到達');
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
  // 到達＝事先確認了；主人視為到達。過了判定窗才判的是補判（late），沒確認的記錯過
  function judge(state, now) {
    var out = [], due = [];
    state.roles.forEach(function (owner) { owner.slots.forEach(function (s) { if (!s.judged && s.atUs <= now) due.push({ owner: owner, s: s }); }); });
    due.sort(function (a, b) { return a.s.atUs - b.s.atUs; });
    due.forEach(function (x) {
      var owner = x.owner, s = x.s, late = now >= s.atUs + DOCK_WINDOW_US, at = s.atUs;
      s.judged = true; expireHolds(state, at);
      var present = [owner.serial].concat(s.bookings.filter(function (b) { return isPresent(state, b, s.id); }));
      try { judgeSlot(state, owner, s, present, at, late, out); } finally { settleEntries(state, s); }
    });
    if (due.length) expireHolds(state, now);   // 補判完，保留到期也算到現在
    return out;
  }
  function judgeSlot(state, owner, s, present, at, late, out) {
    (function () {
      s.bookings.forEach(function (b) { if (present.indexOf(b) < 0) { s.missed.push(b); state.records.push({ kind: 'miss', at: at, text: abbrev(b) + ' 錯過了 ' + fmtUs(s.atUs) + ' 的對接' + (late ? '（沒確認到達）' : '') }); out.push({ slot: s, owner: owner, docking: null, missed: b, late: late }); } else s.docked.push(b); });
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
    })();
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
  // 一起成交：有選東西的每一對都要兩個人都到達、條件通、兩邊都選了、兩邊都給得出（同一個人給的點、同一樣東西的份數合起來算），才全部一起成交；
  // 只要有一對不成，整個時段不成交，誰的點都不給、貨都不動。兩邊都沒選的那一對照舊記「兩邊都沒選」，不影響
  function judgeTogether(state, owner, s, present, atUs, out) {
    var nm = function (x) { var r = roleOf(state, x); return r ? r.name : abbrev(x); };
    var pairs = selectedPairs(state, s), fails = [], plan = [], give = {}, need2 = {};
    pairs.forEach(function (p) {
      var a = p[0], b = p[1], who = nm(a) + ' 和 ' + nm(b);
      try {
        var absent = p.filter(function (x) { return present.indexOf(x) < 0; });
        if (absent.length) { fails.push(who + ' 不成（' + absent.map(nm).join('、') + ' 沒到達）'); return; }
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
    // 兩邊都沒選的那一對（都到達的）照舊記
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
  function expire(state, atUs) { return expireHolds(state, atUs) + expireNotices(state, atUs); }
  // 我預約了、還沒判定的時段
  function myBookings(state, me, atUs) {
    var out = [];
    state.roles.forEach(function (r) { if (r === me) return; r.slots.forEach(function (s) { if (s.bookings.indexOf(me.serial) >= 0 && !s.judged) out.push({ owner: r, slot: s }); }); });
    return out.sort(function (a, b) { return a.slot.atUs - b.slot.atUs; });
  }

  /* ---------- 公告欄（第 5 節）：這一輪只到「直接換」；接上去、鏈、一圈第 3 輪做，資料先留位置（links、noReport） ---------- */
  function noticesOf(state) { return state.notices || (state.notices = []); }
  // 掛公告：需要（一句話）、種類（選填）、可以給（自己資源表上的，可以多樣）、一圈最多幾人、掛到哪一天（dayNum）
  function postNotice(state, serial, f, atUs) {
    atUs = atUs || nowUs(); var r = need(state, serial); f = f || {};
    var needText = String(f.need || '').trim(); if (!needText) bad('寫一句你需要什麼');
    if (needText.length > 200) bad('需要寫一句話就好');
    var kind = String(f.kind || '').trim().slice(0, 20);
    var v = version(r, atUs), p = pending(r, atUs);
    var give = (f.give || []).filter(function (id, i, a) { return a.indexOf(id) === i; });
    give.forEach(function (id) { if (!resourceOf(v, id) && !(p && resourceOf(p, id))) bad('可以給的要從自己的資源表選'); });
    var cap = Math.floor(+f.cap); if (!(cap >= 2)) bad('一圈最多幾人要至少 2');
    var until = f.untilDay == null || f.untilDay === '' ? null : Math.floor(+f.untilDay);
    if (until != null && !(until >= dayNum(atUs))) bad('掛到哪一天不能是過去');
    var n = { id: newId('nt'), owner: serial, need: needText, kind: kind, give: give, cap: cap, untilDay: until, atUs: atUs, pinned: !!f.pinned, links: [], noReport: false };
    noticesOf(state).push(n);
    return n;
  }
  function removeNotice(state, serial, id) {
    var n = noticesOf(state).find(function (x) { return x.id === id; }); if (!n) bad('沒有這張公告');
    if (n.owner !== serial) bad('只有掛的人能撤掉');
    state.notices = noticesOf(state).filter(function (x) { return x !== n; });
  }
  // 過了期限自動拿掉（沒有期限的不動；引路人的教學公告沒有期限）
  function expireNotices(state, atUs) {
    var dn = dayNum(atUs), before = noticesOf(state).length;
    state.notices = noticesOf(state).filter(function (n) { return n.untilDay == null || dn <= n.untilDay; });
    return before - state.notices.length;
  }
  // 一張公告可以給的東西（名字）：照掛的人今天的資源表，今天沒有的用明天起的名字
  function giveNames(state, n, atUs) {
    var r = roleOf(state, n.owner); if (!r) return [];
    var v = version(r, atUs), p = pending(r, atUs);
    return n.give.map(function (id) { var x = resourceOf(v, id) || (p && resourceOf(p, id)); return x ? x.name : resourceName(r, id); });
  }
  // 我通不通他的條件：跟預約用同一個判斷（他是主人、我是來約的人）
  function canBook(state, owner, me, atUs) { if (!me || owner.serial === me.serial) return { ok: false, self: true, reason: '自己' }; return eligible(state, owner, me, atUs); }
  // 搜尋：一個關鍵字同時查公告（需要、種類、可以給）和所有人的資源表（名稱、定義），兩種結果分開回傳；每個結果標我通不通
  function search(state, meSerial, keyword, atUs) {
    atUs = atUs || nowUs(); var me = roleOf(state, meSerial), kw = String(keyword || '').trim().toLowerCase();
    var hit = function (t) { return !kw || String(t || '').toLowerCase().indexOf(kw) >= 0; };
    var notices = noticesOf(state).filter(function (n) { return roleOf(state, n.owner) && (hit(n.need) || hit(n.kind) || giveNames(state, n, atUs).some(hit)); })
      .map(function (n) { var o = roleOf(state, n.owner); return { notice: n, role: o, give: giveNames(state, n, atUs), elig: canBook(state, o, me, atUs) }; });
    var resources = searchResources(state, kw, atUs).filter(function (x) { return x.role.serial !== meSerial; })
      .map(function (x) { return { role: x.role, resource: x.resource, stock: x.stock, elig: canBook(state, x.role, me, atUs) }; });
    return { notices: notices, resources: resources };
  }

  /* ---------- 達秒屋（7-2）：每一筆、藏、外觀、看一間屋 ---------- */
  var VIS_LEVELS = { public: '公開', neighbors: '只給鄰居看', hidden: '全藏' };
  function cleanVisLevel(v) { return VIS_LEVELS[v] ? v : 'hidden'; }   // 讀到不認得的值就當全藏
  var PALETTE = { brick: { name: '磚紅', hex: '#A9533B' }, clay: { name: '陶土', hex: '#C7794A' }, sand: { name: '沙色', hex: '#D9C08C' }, cream: { name: '米白', hex: '#EDE4CC' }, stone: { name: '石灰', hex: '#9C9A92' }, slate: { name: '石板', hex: '#55606B' },
    moss: { name: '苔綠', hex: '#6C7F4A' }, pine: { name: '松綠', hex: '#2F5B45' }, sky: { name: '天藍', hex: '#7FA7C4' }, ink: { name: '墨藍', hex: '#2C3E5C' }, plum: { name: '梅紫', hex: '#6E4A68' }, coal: { name: '炭黑', hex: '#2E2C2B' } };
  // 方塊清單：色票 12 色、玻璃、木頭、燈是方塊；樹、花、旗子、長椅是擺設（也佔一格，可以轉 90 度）
  var BLOCKS = {};
  Object.keys(PALETTE).forEach(function (k) { BLOCKS[k] = { name: PALETTE[k].name, type: 'solid', hex: PALETTE[k].hex }; });
  BLOCKS.glass = { name: '玻璃', type: 'glass', hex: '#BFE0EE' };
  BLOCKS.wood = { name: '木頭', type: 'solid', hex: '#9A6B3F' };
  BLOCKS.lamp = { name: '燈', type: 'lamp', hex: '#FFE6A0' };
  BLOCKS.tree = { name: '樹', type: 'prop', hex: '#4E7A3E' };
  BLOCKS.flower = { name: '花', type: 'prop', hex: '#D9667A' };
  BLOCKS.flag = { name: '旗子', type: 'prop', hex: '#C0453A' };
  BLOCKS.bench = { name: '長椅', type: 'prop', hex: '#8B6A44' };
  BLOCKS.door = { name: '門', type: 'door', hex: '#7A5536' };
  var SIGN_MAX = 20, PLOT_MIN = 12, PLOT_MAX = 32;
  var ROTS = [0, 90, 180, 270];
  // 日曆：一個月一塊，佔 2×2×1 格，全部在 z＝0 那一面、正面朝前（z 大的那邊）；第一塊固定在 [-2, 0]
  var CAL_DIRS = { up: '上', down: '下', left: '左', right: '右' }, CAL_ORDER = ['up', 'right', 'left', 'down'], CAL_DELTA = { up: [0, 2], down: [0, -2], left: [-2, 0], right: [2, 0] };
  var CAL_START = [-2, 0], CAL_Z = 0, DOOR_DEFAULT = [0, 0, 0, 'door', 0];
  // 地皮跟著年齡長：一開始 12×12、高 12；每活一年四邊各外推一格、高度加 2；最大 32×32、高 32
  function plotOf(years) { var s = Math.min(PLOT_MAX, PLOT_MIN + 2 * Math.max(0, Math.floor(years || 0))); return { size: s, height: s, min: -s / 2, max: s / 2 - 1 }; }
  function plotAt(role, now) { return plotOf(ageOf(bornOf(role), dayNum(now || nowUs())).years); }
  function inPlot(plot, x, y, z) { return x >= plot.min && x <= plot.max && z >= plot.min && z <= plot.max && y >= 0 && y < plot.height; }
  function cellKey(x, y, z) { return x + ',' + y + ',' + z; }
  // 門：佔 (x,y,z) 和 (x,y+1,z)；門前那一格是門朝的那一邊、一樣 1 寬 2 高（0 朝前＝z 大）
  function doorFront(rot) { return rot === 90 ? [1, 0] : rot === 180 ? [0, -1] : rot === 270 ? [-1, 0] : [0, 1]; }
  function doorCells(d) { return [[d[0], d[1], d[2]], [d[0], d[1] + 1, d[2]]]; }
  function doorFrontCells(d, plot) { var f = doorFront(d[4] || 0); return [[d[0] + f[0], d[1], d[2] + f[1]], [d[0] + f[0], d[1] + 1, d[2] + f[1]]].filter(function (c) { return !plot || inPlot(plot, c[0], c[1], c[2]); }); }
  function doorOf(h) { for (var i = 0; i < h.blocks.length; i++) if (h.blocks[i][3] === 'door') return h.blocks[i]; return null; }
  // 日曆方塊的格子，和它正面那一條（z 1 到地皮前緣）
  function calCells(pos) { return [[pos[0], pos[1], CAL_Z], [pos[0] + 1, pos[1], CAL_Z], [pos[0], pos[1] + 1, CAL_Z], [pos[0] + 1, pos[1] + 1, CAL_Z]]; }
  function calFrontCells(pos, plot) { var out = []; for (var z = CAL_Z + 1; z <= plot.max; z++) for (var dx = 0; dx < 2; dx++) for (var dy = 0; dy < 2; dy++) out.push([pos[0] + dx, pos[1] + dy, z]); return out; }
  // 這間屋哪些格子被日曆、門佔住或要留空（給蓋、長、搬門用）
  function reserved(h, plot) {
    var cal = {}, front = {}, door = {}, dfront = {};
    ((h.cal && h.cal.blocks) || []).forEach(function (p) { if (!p) return; calCells(p).forEach(function (c) { cal[cellKey(c[0], c[1], c[2])] = true; }); calFrontCells(p, plot).forEach(function (c) { front[cellKey(c[0], c[1], c[2])] = true; }); });
    var d = doorOf(h); if (d) { doorCells(d).forEach(function (c) { door[cellKey(c[0], c[1], c[2])] = true; }); doorFrontCells(d, plot).forEach(function (c) { dfront[cellKey(c[0], c[1], c[2])] = true; }); }
    return { cal: cal, front: front, door: door, dfront: dfront };
  }
  // 一塊方塊本身合不合格（格式、種類、方向、在不在地皮裡）
  function blockProblem(b, plot) {
    if (!Array.isArray(b) || b.length < 4 || b.length > 5) return '方塊格式不對';
    var x = b[0], y = b[1], z = b[2], k = b[3], rot = b.length > 4 ? b[4] : 0;
    if (![x, y, z].every(function (n) { return typeof n === 'number' && n % 1 === 0; })) return '方塊位置要是整數';
    if (!BLOCKS.hasOwnProperty(k)) return '方塊種類不在清單裡：' + k;
    var t = BLOCKS[k].type;
    if (t === 'prop' || t === 'door' ? ROTS.indexOf(rot) < 0 : rot !== 0) return '只有擺設和門能轉，而且只能轉 90 度';
    if (!inPlot(plot, x, y, z) || (t === 'door' && y + 1 >= plot.height)) return '地皮外面不能蓋';
    return null;
  }
  // 這一格能不能放（日曆、正面那一條、門、門前那一格都不行）
  function placeProblem(res, x, y, z) {
    var k = cellKey(x, y, z);
    if (res.cal[k]) return '這裡要留給日曆'; if (res.front[k]) return '日曆正面前面要空著'; if (res.door[k]) return '這一格是門'; if (res.dfront[k]) return '門前面要空著';
    return null;
  }
  function normBlock(b) { var k = b[3], t = BLOCKS[k].type; return t === 'prop' || t === 'door' ? [b[0], b[1], b[2], k, b.length > 4 ? b[4] : 0] : [b[0], b[1], b[2], k]; }
  // 門放不放得下：兩格都在地皮裡、不在日曆和它正面那一條上、沒被別的方塊佔住；門前那一格沒有日曆、沒有方塊
  function doorProblem(h, d, plot, ignoreBlocks) {
    var p = blockProblem(d, plot); if (p) return p;
    var res = reserved({ cal: h.cal, blocks: [] }, plot), occ = {};
    if (!ignoreBlocks) h.blocks.forEach(function (b) { if (b[3] !== 'door') occ[cellKey(b[0], b[1], b[2])] = true; });
    var cells = doorCells(d);
    for (var i = 0; i < cells.length; i++) { var k = cellKey(cells[i][0], cells[i][1], cells[i][2]); if (res.cal[k]) return '門不能放在日曆上'; if (res.front[k]) return '門不能放在日曆正面前面'; if (occ[k]) return '那裡有方塊，門放不下'; }
    var fc = doorFrontCells(d, plot);
    for (var j = 0; j < fc.length; j++) { var kk = cellKey(fc[j][0], fc[j][1], fc[j][2]); if (res.cal[kk]) return '門前面不能是日曆'; if (occ[kk]) return '門前面要空著'; }
    return null;
  }
  // 方塊清單：strict（修改時）不合格就整個擋下；讀檔時不合格的丟掉、其他留著。門另外處理（剛好一扇）
  function cleanBlocks(list, plot, strict, h) {
    var seen = {}, out = [], res = h ? reserved(h, plot) : null, door = null;
    (Array.isArray(list) ? list : []).forEach(function (b) {
      var p = blockProblem(b, plot);
      if (!p && b[3] === 'door') { if (door) p = '一間屋只能有一扇門'; else { door = normBlock(b); return; } }
      if (!p && seen[cellKey(b[0], b[1], b[2])]) p = '同一格不能放兩塊';
      if (!p && res) p = placeProblem(res, b[0], b[1], b[2]);
      if (p) { if (strict) bad(p); return; }
      seen[cellKey(b[0], b[1], b[2])] = true; out.push(normBlock(b));
    });
    if (door) out.push(door);
    return out;
  }

  /* 範本和預設小屋：都放得進 12×12、高 12，正面的牆在 z＝0、門在 (0,0,0) 朝前；範本自己帶門 */
  function boxFill(out, x0, x1, y0, y1, z0, z1, k) { for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) for (var z = z0; z <= z1; z++) out.push([x, y, z, k]); }
  function shell(out, x0, x1, z0, z1, y0, y1, k) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) for (var z = z0; z <= z1; z++) if (x === x0 || x === x1 || z === z0 || z === z1) out.push([x, y, z, k]); }
  function carve(out, test) { return out.filter(function (b) { return !test(b[0], b[1], b[2]); }); }
  function setCell(out, x, y, z, k, rot) { out = carve(out, function (a, b, c) { return a === x && b === y && c === z; }); out.push(rot == null ? [x, y, z, k] : [x, y, z, k, rot]); return out; }
  var TEMPLATES = { house: '預設小屋', tower: '塔', long: '長屋', flat: '平房', round: '圓屋' };
  var TEMPLATE_COLORS = { house: ['brick', 'slate'], tower: ['stone', 'slate'], long: ['sand', 'moss'], flat: ['cream', 'coal'], round: ['cream', 'pine'] };
  function template(name, wall, roof) {
    if (!TEMPLATES[name]) bad('沒有這個範本');
    wall = BLOCKS[wall] && BLOCKS[wall].type === 'solid' ? wall : TEMPLATE_COLORS[name][0]; roof = BLOCKS[roof] && BLOCKS[roof].type === 'solid' ? roof : TEMPLATE_COLORS[name][1];
    var out = [], y, x, z, door = [0, 0, 0, 'door', 0];
    if (name === 'house') {   // 預設小屋：6×5、牆高 3，斜屋頂；正面的牆在 z＝0，門在中間，日曆是門左邊那一段牆
      shell(out, -3, 2, -4, 0, 0, 2, wall);
      out = carve(out, function (a, b, c) { return c === 0 && a >= -2 && a <= -1 && b <= 1; });   // 門左邊那一段牆是第一塊日曆
      [[-3, -2], [2, -2]].forEach(function (p) { out = setCell(out, p[0], 1, p[1], 'glass'); });
      out = setCell(out, 1, 1, 0, 'glass');
      [[-5, 1], [-4, 0], [-3, -1], [-2, -2]].forEach(function (r, i) { boxFill(out, -4, 3, 3 + i, 3 + i, r[0], r[1], roof); });
      out = setCell(out, 2, 0, 2, 'lamp'); out.push([-4, 0, 2, 'flower', 0]);
    } else if (name === 'tower') {   // 塔：4×4、高 10，頂上一圈垛口
      shell(out, -2, 1, -3, 0, 0, 8, wall);
      for (y = 3; y <= 7; y += 2) { out = setCell(out, -1, y, 0, 'glass'); out = setCell(out, -2, y, -2, 'glass'); out = setCell(out, 1, y, -1, 'glass'); }
      boxFill(out, -3, 2, 9, 9, -4, 1, roof);
      for (x = -3; x <= 2; x++) for (z = -4; z <= 1; z++) if ((x === -3 || x === 2 || z === -4 || z === 1) && (x + z) % 2 === 0) out.push([x, 10, z, roof]);
      out.push([2, 0, 2, 'flag', 0]);
    } else if (name === 'long') {    // 長屋：10×3、牆高 3，斜屋頂，前面三扇窗；門在正面的牆上
      shell(out, -5, 4, -3, -1, 0, 2, wall);
      [-4, -3, 2, 3].forEach(function (a) { out = setCell(out, a, 1, -1, 'glass'); });
      boxFill(out, -6, 5, 3, 3, -4, 0, roof); boxFill(out, -6, 5, 4, 4, -3, -1, roof); boxFill(out, -6, 5, 5, 5, -2, -2, roof);
      out.push([-5, 0, 1, 'tree', 0]); out.push([4, 0, 1, 'bench', 0]); door = [0, 0, -1, 'door', 0];
    } else if (name === 'flat') {    // 平房：8×8、牆高 2，平屋頂
      shell(out, -4, 3, -5, 2, 0, 1, wall);
      [-3, 2].forEach(function (a) { out = setCell(out, a, 1, 2, 'glass'); });
      boxFill(out, -5, 4, 2, 2, -6, 3, roof);
      out = setCell(out, -5, 3, 3, 'lamp'); out = setCell(out, 4, 3, 3, 'lamp'); door = [0, 0, 2, 'door', 0];
    } else {                          // 圓屋：圓牆高 3，圓頂
      var cx = -0.5, cz = -1.5, dd = function (a, c) { return Math.sqrt((a - cx) * (a - cx) + (c - cz) * (c - cz)); };
      for (x = -6; x <= 5; x++) for (z = -6; z <= 4; z++) { var d = dd(x, z); if (d >= 3 && d < 4.1) for (y = 0; y <= 2; y++) out.push([x, y, z, wall]); }
      [[3.6, 0], [3.0, 1], [2.2, 2], [1.1, 3]].forEach(function (r, i) { for (x = -6; x <= 5; x++) for (z = -6; z <= 4; z++) if (dd(x, z) < r[0] + 0.5) out.push([x, 3 + i, z, roof]); });
      out = setCell(out, -3, 0, 3, 'lamp'); out = setCell(out, 2, 0, 3, 'lamp'); door = [0, 0, 2, 'door', 0];
    }
    out = carve(out, function (a, b, c) { return a === door[0] && c === door[2] && b <= 1; });   // 門那兩格空出來
    out.push(door);
    return cleanBlocks(out, plotOf(0), false);
  }
  // 第 2 輪的外觀（屋型、顏色、擺設）換成預設小屋：照原本牆和屋頂的顏色；擺設放得進地皮的換成方塊，放不進的不要
  function fromOldLook(h, plot) {
    var blocks = template('house', h.wall, h.roof), taken = {};
    blocks.forEach(function (b) { taken[cellKey(b[0], b[1], b[2])] = true; });
    var KIND = { tree: 'tree', flower: 'flower', flag: 'flag', bench: 'bench', lamp: 'lamp', rock: 'stone' };
    (Array.isArray(h.props) ? h.props : []).forEach(function (p) {
      if (!p || !KIND[p.kind] || typeof p.a !== 'number' || typeof p.r !== 'number') return;
      var ang = p.a / 24 * Math.PI * 2 + Math.PI / 2, rad = 4.5 + p.r * 1.3, x = Math.round(-0.5 + Math.cos(ang) * rad), z = Math.round(-2 + Math.sin(ang) * rad), k = KIND[p.kind];
      var b = BLOCKS[k].type === 'prop' ? [x, 0, z, k, ROTS.indexOf(p.rot) >= 0 ? p.rot : 0] : [x, 0, z, k];
      if (blockProblem(b, plot) || taken[cellKey(x, 0, z)]) return;
      taken[cellKey(x, 0, z)] = true; blocks.push(b);
    });
    return blocks;
  }

  /* 日曆怎麼長：第 i 塊是創角色那個月往後第 i 個月；每個月第一天從最後一塊往 dir 長一塊，長不了照上、右、左、下換，再不行跳到同一面最近的空位，放滿就記空位 */
  function ymdOf(dn) { var d = new Date(dn * 86400000); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay() }; }
  function monthIndex(born, day) { var b = ymdOf(born), t = ymdOf(day); return (t.y - b.y) * 12 + (t.m - b.m); }
  function monthFirstDay(born, i) { var b = ymdOf(born); return Math.round(Date.UTC(b.y, b.m + i, 1) / 86400000); }
  function calMonth(born, i) { var b = ymdOf(born), mi = b.m + i; return { y: b.y + Math.floor(mi / 12), m: mi % 12 + 1 }; }
  // 那一天在它那個月的方塊上第幾排第幾欄（七欄，星期日在最左邊）
  function calSpot(born, day) {
    if (day < born) return null;
    var t = ymdOf(day), first = ymdOf(day - t.d + 1).wd;
    return { m: monthIndex(born, day), row: Math.floor((first + t.d - 1) / 7), col: t.wd };
  }
  function calFits(h, pos, plot, skipIndex) {
    if (pos[0] < plot.min || pos[0] + 1 > plot.max || pos[1] < 0 || pos[1] + 1 >= plot.height) return false;
    var mine = {}; calCells(pos).forEach(function (c) { mine[cellKey(c[0], c[1], c[2])] = true; });
    var list = h.cal.blocks;
    for (var i = 0; i < list.length; i++) { if (i === skipIndex || !list[i]) continue; var cs = calCells(list[i]); for (var j = 0; j < 4; j++) if (mine[cellKey(cs[j][0], cs[j][1], cs[j][2])]) return false; }
    var d = doorOf(h);
    if (d) {
      var dc = doorCells(d).concat(doorFrontCells(d, plot)); for (var k = 0; k < dc.length; k++) if (mine[cellKey(dc[k][0], dc[k][1], dc[k][2])]) return false;   // 碰到門或門前那一格
      var front = {}; calFrontCells(pos, plot).forEach(function (c) { front[cellKey(c[0], c[1], c[2])] = true; });
      var dd = doorCells(d); for (var m = 0; m < dd.length; m++) if (front[cellKey(dd[m][0], dd[m][1], dd[m][2])]) return false;   // 正面那一條裡有門
    }
    return true;
  }
  // 下一塊會長在哪裡（不改資料）：{ pos, dir（實際的方向）, fallback, removes（會拆幾塊）}；放滿了 pos 是 null
  function nextCalPos(h, plot) {
    var list = h.cal.blocks, last = null; for (var i = list.length - 1; i >= 0; i--) if (list[i]) { last = list[i]; break; }
    if (!last) last = CAL_START;
    var pos = null, dir = null, fallback = false;
    if (!list.length) { pos = CAL_START.slice(); if (!calFits(h, pos, plot)) pos = null; dir = h.cal.dir; }
    else {
      var order = [h.cal.dir].concat(CAL_ORDER.filter(function (o) { return o !== h.cal.dir; }));
      for (var k = 0; k < order.length && !pos; k++) { var p = [last[0] + CAL_DELTA[order[k]][0], last[1] + CAL_DELTA[order[k]][1]]; if (calFits(h, p, plot)) { pos = p; dir = order[k]; } }
      if (!pos) {   // 同一面上離最後一塊最近、放得下的地方（一樣近：先低的、再左的）
        var best = null, bd = Infinity;
        for (var y = 0; y + 1 < plot.height; y++) for (var x = plot.min; x + 1 <= plot.max; x++) { var q = [x, y], d = Math.abs(x - last[0]) + Math.abs(y - last[1]); if (d < bd && calFits(h, q, plot)) { best = q; bd = d; } }
        pos = best; fallback = true; dir = null;
      }
    }
    var removes = 0;
    if (pos) { var cells = {}; calCells(pos).concat(calFrontCells(pos, plot)).forEach(function (c) { cells[cellKey(c[0], c[1], c[2])] = true; }); h.blocks.forEach(function (b) { if (b[3] !== 'door' && cells[cellKey(b[0], b[1], b[2])]) removes++; }); }
    return { pos: pos, dir: dir, fallback: fallback, removes: removes };
  }
  // 長一塊：日曆優先，長到的格子和正面那一條裡的方塊拆掉，回傳拆了幾塊
  function growOne(h, born) {
    var i = h.cal.blocks.length, plot = plotOf(ageOf(born, monthFirstDay(born, i)).years), n = nextCalPos(h, plot);
    h.cal.blocks.push(n.pos);
    if (!n.pos) return 0;
    var cells = {}; calCells(n.pos).concat(calFrontCells(n.pos, plot)).forEach(function (c) { cells[cellKey(c[0], c[1], c[2])] = true; });
    var before = h.blocks.length; h.blocks = h.blocks.filter(function (b) { return b[3] === 'door' || !cells[cellKey(b[0], b[1], b[2])]; });
    var removed = before - h.blocks.length; if (removed) { h.rev = (h.rev || 0) + 1; h.calRemoved = (h.calRemoved || 0) + removed; }
    return removed;
  }
  // 補長到第 upTo 個月（不含）；回傳總共拆了幾塊
  function growTo(h, born, upTo) { var n = 0; while (h.cal.blocks.length < upTo) n += growOne(h, born); return n; }
  // 讀檔和換日：每個角色從現有的塊數補到這個月。回傳有沒有長
  function growCalendars(state, now) {
    var today = dayNum(now || nowUs()), grew = false;
    state.roles.forEach(function (r) { var h = houseOf(r); if (!h.cal) return; var want = monthIndex(bornOf(r), today) + 1; if (h.cal.blocks.length < want) { growTo(h, bornOf(r), want); grew = true; } });
    return grew;
  }
  // 日曆清單合不合格：格式、第一塊在起點、不重疊、不出那個月的地皮（長度不能比現在多）
  function calValid(h, born, today) {
    var c = h.cal; if (!c || !CAL_DIRS[c.dir] || !Array.isArray(c.blocks)) return false;
    if (c.blocks.length > monthIndex(born, today) + 1) return false;
    var seen = {};
    for (var i = 0; i < c.blocks.length; i++) {
      var p = c.blocks[i]; if (p === null) continue;
      if (!Array.isArray(p) || p.length !== 2 || p[0] % 1 !== 0 || p[1] % 1 !== 0) return false;
      if (i === 0 && (p[0] !== CAL_START[0] || p[1] !== CAL_START[1])) return false;
      var plot = plotOf(ageOf(born, monthFirstDay(born, i)).years); if (p[0] < plot.min || p[0] + 1 > plot.max || p[1] < 0 || p[1] + 1 >= plot.height) return false;
      var cs = calCells(p); for (var j = 0; j < 4; j++) { var k = cellKey(cs[j][0], cs[j][1], cs[j][2]); if (seen[k]) return false; seen[k] = true; }
    }
    return true;
  }
  // 門一定要有一扇：沒有就放預設位置；放不下就找離預設位置最近、放得下的地上
  function ensureDoor(h, plot) {
    var d = doorOf(h);
    if (d && !doorProblem(h, d, plot, true)) return false;   // 門還在、也不在日曆上：留著（擋到它的方塊最後會拆掉）
    h.blocks = h.blocks.filter(function (b) { return b[3] !== 'door'; });
    var cands = [DOOR_DEFAULT.slice()], best = null;
    if (doorProblem(h, cands[0], plot, false)) {
      var bd = Infinity;
      for (var x = plot.min; x <= plot.max; x++) for (var z = plot.min; z <= plot.max; z++) { var dist = Math.abs(x) + Math.abs(z), c = [x, 0, z, 'door', 0]; if (dist < bd && !doorProblem(h, c, plot, false)) { best = c; bd = dist; } }
    } else best = cands[0];
    if (!best) { best = DOOR_DEFAULT.slice(); h.blocks = h.blocks.filter(function (b) { return !(b[0] === 0 && b[2] === 0 && b[1] <= 1); }); }   // 真的沒地方：硬放預設位置，擋到的拆掉
    h.blocks.push(best); return true;
  }
  var DEFAULT_HOUSE = { sign: '', visibility: 'public', defaultVis: 'public', blocks: [], cal: { dir: 'up', blocks: [] } };
  // 達秒屋的資料：門牌一句話、整間屋給誰看、新的一筆預設、自己蓋的方塊清單（門在裡面）、日曆清單。born／today 用來檢查和補長
  function cleanHouse(h, plot, strict, born, today) {
    h = h && typeof h === 'object' ? h : {}; plot = plot || plotOf(0); born = born == null ? (today == null ? 0 : today) : born; today = today == null ? born : today;
    var sign = String(h.sign == null ? '' : h.sign);
    if (sign.length > SIGN_MAX) { if (strict) bad('門牌一句話要在 ' + SIGN_MAX + ' 字以內'); sign = sign.slice(0, SIGN_MAX); }
    var out = { sign: sign, visibility: h.visibility === 'neighbors' ? 'neighbors' : 'public', defaultVis: h.defaultVis == null ? 'public' : cleanVisLevel(h.defaultVis), blocks: [], cal: null, rev: Number(h.rev) || 0, calRemoved: 0 };
    out.blocks = Array.isArray(h.blocks) ? cleanBlocks(h.blocks, plot, strict) : (h.shape || h.props || h.wall ? fromOldLook(h, plot) : template('house'));
    // 門先定（沒有就補），再定日曆（不合格就從起點照 dir 重新長），門擋到日曆就搬，最後拆掉跟日曆、門衝突的方塊
    ensureDoor(out, plot);
    var dir = h.cal && CAL_DIRS[h.cal.dir] ? h.cal.dir : 'up';
    out.cal = { dir: dir, blocks: calValid({ cal: h.cal }, born, today) ? h.cal.blocks.map(function (p) { return p ? [p[0], p[1]] : null; }) : [] };
    var removed = Number(h.calRemoved) || 0;
    removed += growTo(out, born, monthIndex(born, today) + 1);
    if (ensureDoor(out, plot)) { /* 門搬了 */ }
    var res = reserved(out, plot), before = out.blocks.length;
    out.blocks = out.blocks.filter(function (b) { return b[3] === 'door' || !placeProblem(res, b[0], b[1], b[2]); });
    out.calRemoved = removed + (before - out.blocks.length);
    return out;
  }
  function houseOf(role) { return role && role.house ? role.house : DEFAULT_HOUSE; }
  // 門牌一句話、整間屋給誰看、新的一筆預設：馬上生效
  function setHouse(state, serial, fields) {
    var r = need(state, serial), h = houseOf(r), f = fields || {};
    Object.keys(f).forEach(function (k) { if (['sign', 'visibility', 'defaultVis'].indexOf(k) < 0) bad('只能改門牌、整間屋給誰看、新的一筆預設'); });
    if (f.visibility != null && ['public', 'neighbors'].indexOf(f.visibility) < 0) bad('整間屋只能公開或只給鄰居看');
    if (f.defaultVis != null && !VIS_LEVELS[f.defaultVis]) bad('新的一筆預設只能是公開、只給鄰居看或全藏');
    if (f.sign != null && String(f.sign).length > SIGN_MAX) bad('門牌一句話要在 ' + SIGN_MAX + ' 字以內');
    if (f.sign != null) h.sign = String(f.sign);
    if (f.visibility != null) h.visibility = f.visibility;
    if (f.defaultVis != null) h.defaultVis = f.defaultVis;
    return h;
  }
  // 日曆下一塊往哪長：選了存在 dir，馬上生效
  function setCalDir(state, serial, dir) { if (!CAL_DIRS[dir]) bad('方向只有上、下、左、右'); var h = houseOf(need(state, serial)), old = h.cal.dir; h.cal.dir = dir; h.rev = (h.rev || 0) + 1; return old; }
  // 屋主看過「拆了 N 塊」就清掉
  function ackCalRemoved(state, serial) { var h = houseOf(need(state, serial)), n = h.calRemoved || 0; h.calRemoved = 0; return n; }
  // 自己蓋：加一塊、拆一塊、轉擺設或門、搬門、整份換掉（範本、復原）。不限幾塊，只限地皮
  function blockIndex(h, x, y, z) { for (var i = 0; i < h.blocks.length; i++) { var b = h.blocks[i]; if (b[0] === x && b[1] === y && b[2] === z) return i; } return -1; }
  function addBlock(state, serial, b, now) {
    var r = need(state, serial), h = houseOf(r), plot = plotAt(r, now);
    var nb = b && !Array.isArray(b) ? [b.x, b.y, b.z, b.k, b.rot == null ? 0 : b.rot] : b;
    if (nb && nb[3] === 'door') bad('門只有一扇，用搬的');
    var p = blockProblem(nb, plot); if (p) bad(p);
    p = placeProblem(reserved(h, plot), nb[0], nb[1], nb[2]); if (p) bad(p);
    if (blockIndex(h, nb[0], nb[1], nb[2]) >= 0) bad('這一格已經有東西了');
    nb = normBlock(nb); h.blocks.push(nb); h.rev = (h.rev || 0) + 1; return nb.slice();
  }
  function removeBlock(state, serial, x, y, z, now) {
    var r = need(state, serial), h = houseOf(r), i = blockIndex(h, x, y, z);
    if (i < 0) { var res = reserved(h, plotAt(r, now)); if (res.cal[cellKey(x, y, z)]) bad('日曆拆不掉'); if (res.door[cellKey(x, y, z)]) bad('門拆不掉，只能搬'); bad('這一格沒有東西'); }
    if (h.blocks[i][3] === 'door') bad('門拆不掉，只能搬');
    var b = h.blocks.splice(i, 1)[0]; h.rev = (h.rev || 0) + 1; return b.slice();
  }
  function rotateBlock(state, serial, x, y, z, now) {
    var r = need(state, serial), h = houseOf(r), i = blockIndex(h, x, y, z); if (i < 0) bad('這一格沒有東西');
    var b = h.blocks[i], t = BLOCKS[b[3]].type; if (t !== 'prop' && t !== 'door') bad('只有擺設和門能轉');
    if (t === 'door') { var nd = b.slice(); nd[4] = (b[4] + 90) % 360; var p = doorProblem(h, nd, plotAt(r, now), false); if (p) bad(p + '，轉不過去'); }
    b[4] = (b[4] + 90) % 360; h.rev = (h.rev || 0) + 1; return b.slice();
  }
  // 搬門：點一個地方門就搬過去；回傳原本的門（復原用）
  function moveDoor(state, serial, x, y, z, rot, now) {
    var r = need(state, serial), h = houseOf(r), plot = plotAt(r, now), old = doorOf(h);
    var nd = [x, y, z, 'door', rot == null ? (old ? old[4] : 0) : rot];
    var p = doorProblem(h, nd, plot, false); if (p) bad(p);
    h.blocks = h.blocks.filter(function (b) { return b[3] !== 'door'; }); h.blocks.push(nd); h.rev = (h.rev || 0) + 1;
    return old ? old.slice() : null;
  }
  // 整份換掉：loose＝碰到日曆、門前的那幾塊拿掉（範本用）；沒帶門就留原本的門
  function setBlocks(state, serial, list, now, loose) {
    var r = need(state, serial), h = houseOf(r), plot = plotAt(r, now), old = h.blocks.map(function (b) { return b.slice(); });
    var cur = doorOf(h), nd = (Array.isArray(list) ? list : []).filter(function (b) { return Array.isArray(b) && b[3] === 'door'; })[0] || null;
    var tmp = { cal: h.cal, blocks: list.filter(function (b) { return !(Array.isArray(b) && b[3] === 'door'); }) };
    var door = cur ? cur.slice() : null;
    if (nd && !doorProblem({ cal: h.cal, blocks: [] }, nd, plot, true)) { var test = { cal: h.cal, blocks: tmp.blocks }; if (!doorProblem(test, nd, plot, false)) door = normBlock(nd); else if (loose) { door = normBlock(nd); var occ = {}; doorCells(door).concat(doorFrontCells(door, plot)).forEach(function (c) { occ[cellKey(c[0], c[1], c[2])] = true; }); tmp.blocks = tmp.blocks.filter(function (b) { return !occ[cellKey(b[0], b[1], b[2])]; }); } }
    else if (nd && !loose) bad(doorProblem({ cal: h.cal, blocks: [] }, nd, plot, true));
    if (!door) { var e = { cal: h.cal, blocks: tmp.blocks.slice() }; ensureDoor(e, plot); door = doorOf(e); tmp.blocks = e.blocks.filter(function (b) { return b[3] !== 'door'; }); }
    var withDoor = { cal: h.cal, blocks: [door] };
    var cleaned = cleanBlocks(tmp.blocks, plot, !loose, withDoor);
    h.blocks = cleaned.concat([door]); h.rev = (h.rev || 0) + 1;
    return old;
  }
  function applyTemplate(state, serial, name, now) { return setBlocks(state, serial, template(name), now, true); }
  // 是不是鄰居：第 3 輪接上街；這一輪沒有街，永遠不是
  function isNeighbor(state, a, b) { return false; }

  /* 每一筆：一個時段裡的一對人。約的時候就有（未來的預約），判完寫上結果；取消預約就沒了 */
  function entriesOf(state) { return state.entries || (state.entries = []); }
  function nameOf(state, serial) { var r = roleOf(state, serial); return r ? r.name : abbrev(serial); }
  function addEntry(state, slot, owner, a, b, visA, visB, atUs) {
    if (entriesOf(state).some(function (e) { return e.slot === slot.id && ((e.a === a && e.b === b) || (e.a === b && e.b === a)); })) return null;
    var tut = a === GUIDE || b === GUIDE, vis = {}; vis[a] = cleanVisLevel(visA); vis[b] = cleanVisLevel(visB);
    if (tut) vis[GUIDE] = 'hidden';   // 引路人那一邊的教學紀錄固定全藏
    var e = { id: newId('en'), slot: slot.id, owner: owner.serial, a: a, b: b, names: {}, bookedAt: atUs, atUs: slot.atUs, status: 'booked', docking: null, reason: null, together: !!slot.together, tutorial: tut, vis: vis };
    e.names[a] = nameOf(state, a); e.names[b] = nameOf(state, b);
    entriesOf(state).push(e); return e;
  }
  function pairDocking(state, slotId, a, b) { var out = null; state.dockings.forEach(function (d) { if (d.slot === slotId && ((d.a === a && d.b === b) || (d.a === b && d.b === a))) out = d; }); return out; }
  // 判完一個時段：每一筆寫上結果（成交、不成交、不成立、錯過）和原因
  function settleEntries(state, s) {
    entriesOf(state).forEach(function (e) {
      if (e.slot !== s.id || e.status !== 'booked') return;
      var miss = [e.a, e.b].filter(function (x) { return (s.missed || []).indexOf(x) >= 0; });
      if (miss.length) { e.status = 'miss'; e.reason = miss.map(function (x) { return e.names[x]; }).join('、') + ' 沒確認到達'; return; }
      var d = pairDocking(state, s.id, e.a, e.b);
      if (!d) { e.status = 'nodock'; e.reason = '判定出錯'; return; }
      e.docking = d.id; e.status = d.traded ? 'traded' : d.ok ? 'nodock' : 'invalid'; e.reason = d.traded ? null : d.reason;
    });
  }
  // 在那一筆上改自己那一邊的藏：馬上生效；引路人那一邊的教學紀錄不能改
  function setVis(state, serial, entryId, level) {
    var e = entriesOf(state).find(function (x) { return x.id === entryId; }); if (!e) bad('沒有這一筆');
    if (e.a !== serial && e.b !== serial) bad('只能改自己的那幾筆');
    if (!VIS_LEVELS[level]) bad('只能選公開、只給鄰居看或全藏');
    if (e.tutorial && serial === GUIDE) bad('引路人的教學紀錄固定全藏');
    e.vis[serial] = level; return e;
  }
  function ageOf(born, today) { var d = Math.max(0, today - born); return { years: Math.floor(d / 365), days: d % 365, total: d, text: Math.floor(d / 365) + ' 歲 ' + (d % 365) + ' 天' }; }
  function bornOf(role) { return role.born != null ? role.born : role.versions[0].fromDay; }
  // 這一筆在 owner 的達秒屋裡，viewer 看不看得到：對接的兩個人永遠看得到；其他人照 owner 那一邊的設定
  function canSeeEntry(state, e, owner, viewer) {
    if (viewer && (viewer === e.a || viewer === e.b)) return true;
    var lv = e.vis[owner] || 'hidden';
    return lv === 'public' || (lv === 'neighbors' && !!viewer && isNeighbor(state, owner, viewer));
  }
  function houseClosed(state, role, viewer) { return houseOf(role).visibility === 'neighbors' && viewer !== role.serial && !(viewer && isNeighbor(state, role.serial, viewer)); }
  function lookOf(role) { var h = houseOf(role); return { blocks: (h.blocks || []).map(function (b) { return b.slice(); }), door: (doorOf(h) || DOOR_DEFAULT).slice(), rev: h.rev || 0, n: (h.blocks || []).filter(function (b) { return b[3] !== 'door'; }).length }; }
  // 日曆的形狀：每一塊在哪裡、是哪一年哪一月、預告框在哪裡（owner 自己看才寫會拆幾塊）
  function calOf(role, born, today, mine) {
    var h = houseOf(role), n = monthIndex(born, today) + 1, plot = plotOf(ageOf(born, monthFirstDay(born, n)).years), nx = nextCalPos(h, plot);
    return { dir: h.cal.dir, z: CAL_Z, blocks: h.cal.blocks.map(function (p) { return p ? [p[0], p[1]] : null; }), months: h.cal.blocks.map(function (p, i) { var m = calMonth(born, i); m.first = i === 0; return m; }),
      preview: nx.pos ? { pos: nx.pos, dir: nx.dir, fallback: nx.fallback, removes: mine ? nx.removes : 0, month: calMonth(born, n) } : null, full: !nx.pos };
  }
  // 看一間屋：只回傳 viewer 看得到的東西（viewer 是 null 就是陌生人，例如家規系統）
  function viewHouse(state, ownerSerial, viewerSerial, now) {
    now = now || nowUs(); var r = need(state, ownerSerial), today = dayNum(now), born = bornOf(r), viewer = viewerSerial || null, h = houseOf(r);
    var bricks = [], d, plot = plotOf(ageOf(born, today).years), cal = calOf(r, born, today, viewer === ownerSerial), nBlocks = h.cal.blocks.length;
    // 每塊磚在第幾塊日曆上第幾排第幾欄；這個月以後只有下個月（預告框）畫在房子上
    var spot = function (b) { var g = calSpot(born, b.day); b.g = g; b.onHouse = !!g && (g.m < nBlocks ? !!h.cal.blocks[g.m] : (g.m === nBlocks && !!cal.preview)); return b; };
    if (houseClosed(state, r, viewer)) {   // 只給鄰居看、看的人又不是鄰居：只回外觀（自己蓋的、日曆的形狀）和磚的位置（沒有亮暗）
      for (d = born; d <= today; d++) bricks.push(spot({ day: d, future: false }));
      cal.preview = cal.preview ? Object.assign(cal.preview, { removes: 0 }) : null;
      return { serial: r.serial, name: r.name, closed: true, look: lookOf(r), cal: cal, plot: plot, sign: '', age: null, born: null, today: today, bricks: bricks };
    }
    var byDay = {};
    entriesOf(state).forEach(function (e) { if (e.a !== ownerSerial && e.b !== ownerSerial) return; var dd = dayNum(e.atUs); (byDay[dd] = byDay[dd] || []).push(e); });
    var brick = function (day, future) {
      var es = byDay[day] || [], vis = es.filter(function (e) { return canSeeEntry(state, e, ownerSerial, viewer); });
      var lit = vis.filter(function (e) { return e.status === 'traded'; }).length, judged = vis.filter(function (e) { return e.status !== 'booked'; });
      return { day: day, future: future, lit: lit, mark: !lit && judged.length > 0, booked: vis.some(function (e) { return e.status === 'booked'; }), cover: es.length > 0 && vis.length === 0, n: vis.length };
    };
    for (d = born; d <= today; d++) bricks.push(spot(brick(d, false)));
    Object.keys(byDay).map(Number).filter(function (x) { return x > today; }).sort(function (x, y) { return x - y; }).forEach(function (x) { bricks.push(spot(brick(x, true))); });
    return { serial: r.serial, name: r.name, closed: false, look: lookOf(r), cal: cal, plot: plot, sign: h.sign, age: ageOf(born, today), born: born, today: today, bricks: bricks, calRemoved: viewer === ownerSerial ? (h.calRemoved || 0) : 0 };
  }
  function versionOnDay(role, day) { var out = role.versions[0]; role.versions.forEach(function (v) { if (v.fromDay <= day) out = v; }); return out; }
  function holdState(state, h) { if (!h) return null; return h.status === 'redeemed' ? '換了 ' + (h.redeemedAt ? fmtUs(h.redeemedAt).slice(5, 10) : '') : h.status === 'expired' ? '到期作廢' + (h.endedAt ? ' ' + fmtUs(h.endedAt).slice(5, 10) : '') : h.status === 'voided' ? '作廢' : '保留中'; }
  // 點一塊磚：那天看得到的每一筆、還有幾筆蓋著、那天生效的規則表和資源表
  function dayDetail(state, ownerSerial, viewerSerial, day, now) {
    now = now || nowUs(); var r = need(state, ownerSerial), viewer = viewerSerial || null;
    if (houseClosed(state, r, viewer)) return { closed: true, day: day };
    var es = entriesOf(state).filter(function (e) { return (e.a === ownerSerial || e.b === ownerSerial) && dayNum(e.atUs) === day; }).sort(function (x, y) { return x.atUs - y.atUs; });
    var vis = es.filter(function (e) { return canSeeEntry(state, e, ownerSerial, viewer); });
    var v = versionOnDay(r, day), RES = { traded: '成交', nodock: '不成交', invalid: '不成立', miss: '錯過', booked: '預約' };
    var rows = vis.map(function (e) {
      var other = e.a === ownerSerial ? e.b : e.a, dk = e.docking ? state.dockings.find(function (x) { return x.id === e.docking; }) : null, party = viewer === e.a || viewer === e.b;
      var gave = [], got = [];
      if (dk) { var mine = dk.a === ownerSerial; gave = (mine ? dk.itemsA : dk.itemsB).map(function (it) { return { name: it.name, price: it.price }; }); got = (mine ? dk.itemsB : dk.itemsA).map(function (it) { return { name: it.name, price: it.price }; }); }
      var out = { id: e.id, atUs: e.atUs, time: fmtUs(e.atUs).slice(11, 16), other: { serial: other, name: e.names[other] || nameOf(state, other), gone: !roleOf(state, other) }, gave: gave, got: got, result: RES[e.status] || e.status, status: e.status, reason: e.reason, tutorial: e.tutorial, together: e.together };
      if (party && dk) {   // 選好的東西現在怎樣：只給對接的兩個人
        var hs = state.holds.filter(function (h) { return h.docking === dk.id; });
        out.gave.forEach(function (it) { var h = hs.find(function (x) { return x.issuer === ownerSerial && x.name === it.name && !x._u; }); if (h) { h._u = 1; it.state = holdState(state, h); } });
        out.got.forEach(function (it) { var h = hs.find(function (x) { return x.holder === ownerSerial && x.name === it.name && !x._u; }); if (h) { h._u = 1; it.state = holdState(state, h); } });
        hs.forEach(function (h) { delete h._u; });
      }
      if (viewer === ownerSerial) { out.vis = e.vis[ownerSerial]; out.locked = e.tutorial && ownerSerial === GUIDE; }
      return out;
    });
    return { closed: false, day: day, label: dayLabel(day), owner: { serial: r.serial, name: r.name }, mine: viewer === ownerSerial, entries: rows, covered: es.length - vis.length,
      rules: { uses: v.rules.uses.slice(), conditions: v.rules.conditions.map(condText), village: v.rules.village, site: v.rules.site || '' }, resources: v.resources.map(function (x) { return { name: x.name, price: x.price, keepDays: x.keepDays, def: x.def }; }) };
  }
  // 從舊存檔（第 1 輪）的對接紀錄、時段補出每一筆（每一筆公開，引路人的教學那一邊全藏）
  function buildEntries(state) {
    state.entries = [];
    var pub = function (a, b) { var v = {}; v[a] = 'public'; v[b] = 'public'; if (a === GUIDE || b === GUIDE) v[GUIDE] = 'hidden'; return v; };
    var push = function (o) { o.id = newId('en'); o.names = {}; o.names[o.a] = nameOf(state, o.a); o.names[o.b] = nameOf(state, o.b); o.tutorial = o.a === GUIDE || o.b === GUIDE; o.vis = pub(o.a, o.b); state.entries.push(o); };
    var slots = {}; state.roles.forEach(function (r) { r.slots.forEach(function (s) { slots[s.id] = { owner: r, slot: s }; }); });
    state.dockings.forEach(function (d) { var x = slots[d.slot]; push({ slot: d.slot, owner: x ? x.owner.serial : null, a: d.a, b: d.b, bookedAt: d.atUs, atUs: d.atUs, status: d.traded ? 'traded' : d.ok ? 'nodock' : 'invalid', docking: d.id, reason: d.traded ? null : d.reason, together: !!d.together }); });
    Object.keys(slots).forEach(function (id) {
      var x = slots[id], s = x.slot, o = x.owner.serial;
      (s.missed || []).forEach(function (b) { push({ slot: s.id, owner: o, a: o, b: b, bookedAt: s.atUs, atUs: s.atUs, status: 'miss', docking: null, reason: nameOf(state, b) + ' 沒確認到達', together: !!s.together }); });
      if (!s.judged) s.bookings.forEach(function (b, i) { push({ slot: s.id, owner: o, a: o, b: b, bookedAt: (s.bookedAt || {})[b] || s.atUs, atUs: s.atUs, status: 'booked', docking: null, reason: null, together: !!s.together }); s.bookings.slice(0, i).forEach(function (c) { push({ slot: s.id, owner: o, a: c, b: b, bookedAt: s.atUs, atUs: s.atUs, status: 'booked', docking: null, reason: null, together: !!s.together }); }); });
    });
    state.entries.sort(function (x, y) { return x.atUs - y.atUs; });
  }

  /* ---------- 規則 6（點數帳）：保留 ---------- */
  function holdStatus(h, atUs) { if (h.status === 'held' && h.untilDay != null && dayNum(atUs) > h.untilDay) return 'expired'; return h.status; }
  // 到期沒換：作廢、已保留 −1、可換 +1，留紀錄
  function expireHolds(state, atUs) {
    var n = 0;
    state.holds.forEach(function (h) {
      if (h.status !== 'held' || holdStatus(h, atUs) !== 'expired') return;
      h.status = 'expired'; h.endedAt = atUs; n++;
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
  function fresh(opts) {
    opts = opts || {};
    var now = nowUs(), hist = opts.history !== false, ago = function (days) { return hist ? now - days * DAY_US : now; };
    var st = { v: 9, me: -1, roles: [], issued: [], holds: [], dockings: [], redeems: [], acceptances: [], records: [], notices: [], tutorial: freshTutorial() };
    // 示範角色：阿澄（條件：可換的貨 ≥ 5）、小樂（要兩方都通、接受家規）、引路人（沒有條件、一堆 0 點的「空的」）。第一次打開從創角色開始
    createRole(st, { serial: '00000000002', name: '阿澄', dailyPoints: 2000, house: { template: 'tower', wall: 'brick', roof: 'slate', sign: '聽你講，幫你改', calDir: 'up', extra: [[-3, 0, 2, 'lamp'], [-4, 0, 3, 'flower', 0], [-5, 0, 3, 'flower', 0]] },
      rules: { uses: ['1 阿澄點 = 聽你講 1 分鐘', '100 阿澄點 = 幫你改一份履歷'], conditions: [{ field: 'avail', op: '>=', value: 5 }], village: '東恆家規：對接後要一起立一個難題。' },
      resources: [{ id: 'r2a', name: '改履歷', def: '一份，三天內回', price: 100, keepDays: 30, avail: 3 }, { id: 'r2b', name: '一小時諮詢', def: '', price: 90, keepDays: null, avail: 10 }, { id: 'r2c', name: '試聽 5 分鐘', def: '試用品，不收點', price: 0, keepDays: 7, avail: 3 }], contact: '' }, ago(420));
    createRole(st, { serial: '00000000003', name: '小樂', dailyPoints: 800, house: { template: 'long', wall: 'sand', roof: 'moss', sign: '借書的長屋', calDir: 'right', extra: [[-3, 0, 3, 'tree', 0], [2, 0, 3, 'tree', 90], [0, 0, 3, 'flower', 0], [-6, 0, -5, 'wood'], [-6, 1, -5, 'wood']] },
      rules: { uses: ['1 小樂點 = 借書 1 天'], conditions: [{ field: 'myPoints', op: '>=', value: 0 }], bothMustPass: true, mustAcceptVillage: true, village: '小樂家規：借的書要在一個月內還。' },
      resources: [{ id: 'r3a', name: '借一本書', def: '', price: 10, keepDays: 14, avail: 20 }], contact: 'mail@example.com' }, ago(230));
    createRole(st, { serial: GUIDE, name: '引路人', dailyPoints: 2000, house: { template: 'round', wall: 'cream', roof: 'pine', sign: '空的換空的', calDir: 'left', extra: [[-4, 0, 4, 'flower', 0], [3, 0, 4, 'flower', 0], [-6, 0, -6, 'tree', 0], [5, 0, -6, 'tree', 180]] },
      rules: { uses: ['引路人的點只用來教學'], conditions: [], village: '' },
      resources: [{ id: 'r4e', name: '空的', def: '什麼都不給；教學用', price: 0, keepDays: null, avail: 99999 }], contact: '' }, ago(800));
    if (hist) demoHistory(st, now);
    // 示範角色的日曆用規則層一個月一個月長到現在：阿澄一直往上（到頂往右）、小樂往右（到邊往上）、引路人往左四個月再往上
    if (hist) { var g = roleOf(st, GUIDE), gh = houseOf(g); growTo(gh, bornOf(g), Math.min(4, monthIndex(bornOf(g), dayNum(now)) + 1)); gh.cal.dir = 'up'; growCalendars(st, now); st.roles.forEach(function (r) { houseOf(r).calRemoved = 0; }); }
    // 阿澄開兩個對接時段：3 分鐘後、10 分鐘後，各 2 個名額
    addSlot(st, '00000000002', now + 180e6, 2, null, now);
    addSlot(st, '00000000002', now + 600e6, 2, null, now);
    guideNotice(st, now);
    return st;
  }
  // 示範的過去：阿澄和小樂照規則一天一天跑出來（約、選東西、那一微秒判定、兌現或到期），有成交、不成交、錯過，有幾筆藏起來
  function demoHistory(st, now) {
    var A = '00000000002', B = '00000000003', today = dayNum(now), start = dayNum(now - 228 * DAY_US), seed = 7;
    var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    accept(st, A, B, now - 229 * DAY_US);
    for (var d = 0; start + d < today; d += 2 + Math.floor(rnd() * 3)) {
      var dn = start + d, at = ((dn * 86400000 + new Date((dn * 86400000)).getTimezoneOffset() * 60000) + (9 + Math.floor(rnd() * 11)) * 3600000 + Math.floor(rnd() * 60) * 60000) * 1000 + Math.floor(rnd() * 1e6);   // 那天白天某個時間
      var owner = rnd() < 0.55 ? A : B, guest = owner === A ? B : A, kind = rnd();
      var ro = roleOf(st, owner), rg = roleOf(st, guest);
      ['r2a', 'r2b'].forEach(function (id) { var x = stockOf(roleOf(st, A), id); if (x.avail < 3) x.avail += 5; }); var y = stockOf(roleOf(st, B), 'r3a'); if (y.avail < 5) y.avail += 10;
      var slot = addSlot(st, owner, at, 1, null, at - 3 * 3600e6);
      book(st, guest, slot.id, at - 2 * 3600e6, kind >= 0.12);   // 一成多沒確認到達 → 錯過
      var pa = owner === A ? (rnd() < 0.5 ? 'r2a' : 'r2b') : 'r3a', pb = guest === A ? (rnd() < 0.5 ? 'r2b' : 'r2c') : 'r3a';
      setWants(st, slot.id, guest, owner, [pa]);
      if (kind >= 0.25) setWants(st, slot.id, owner, guest, [pb]);   // 有幾次主人沒選 → 不成交
      judge(st, at + 1);
      var e = entriesOf(st).find(function (x) { return x.slot === slot.id; });
      if (e && rnd() < 0.18) setVis(st, rnd() < 0.5 ? A : B, e.id, rnd() < 0.5 ? 'hidden' : 'neighbors');   // 幾筆藏起來
      holdsOf(st, guest, at + 1).concat(holdsOf(st, owner, at + 1)).forEach(function (h) { if (h.docking && rnd() < 0.6) { try { redeem(st, h.holder, h.id, at + (1 + Math.floor(rnd() * 3)) * DAY_US); } catch (err) { /* 換不到就算了 */ } } });
    }
    expire(st, now);
    st.records.push({ kind: 'demo', at: now, text: '示範資料：阿澄、小樂過去的紀錄照規則跑出來' });
  }
  function freshTutorial() { return { step: 1, skipped: false, slot: null, random: false, door: false, found: false, sawRules: false, house: false }; }
  // 引路人在公告欄一直掛著一張教學用的公告：需要「空的」、可以給「空的」；沒有期限，成交也不拿掉
  function guideNotice(st, now) {
    if (!roleOf(st, GUIDE) || noticesOf(st).some(function (n) { return n.owner === GUIDE && n.pinned; })) return;
    postNotice(st, GUIDE, { need: '空的', kind: '教學', give: ['r4e'], cap: 2, untilDay: null, pinned: true }, now);
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
               bothMustPass: !!ru.bothMustPass, mustAcceptVillage: !!ru.mustAcceptVillage, village: str(ru.village || '', LIMITS.text, '家規'), site: (function () { try { return cleanSite(ru.site); } catch (e) { return ''; } })(), villageKey: ru.villageKey == null ? null : str(ru.villageKey, 200, '金鑰') },
      resources: list(v.resources || [], LIMITS.rules, '資源').map(function (x) { obj(x, '資源'); return { id: ident(x.id, '資源'), name: str(x.name, LIMITS.name, '資源'), def: str(x.def || '', LIMITS.text, '定義'), price: num(x.price, '價格'), keepDays: x.keepDays == null ? null : num(x.keepDays, '保留天數') }; }) };
  }
  function cleanRole(r) {
    obj(r, '角色');
    if (!/^\d{11}$/.test(String(r.serial)) || !abbrev(r.serial)) bad('序號格式錯');
    var stock = {}; obj(r.stock || {}, '數量'); Object.keys(r.stock || {}).forEach(function (k) { var s = obj(r.stock[k], '數量'); stock[ident(k, '資源')] = { avail: num(s.avail, '可換'), reserved: num(s.reserved, '已保留') }; });
    var ser = function (what) { return function (b) { return str(b, 11, what); }; };
    var out = {
      serial: r.serial, name: str(r.name, LIMITS.name, '名字'), contact: str(r.contact || '', LIMITS.text, '聯絡方式'),
      versions: list(r.versions, LIMITS.versions, '版本').map(cleanVersion), stock: stock, born: r.born == null ? null : num(r.born, '生日'), house: null,
      slots: list(r.slots || [], LIMITS.slots, '時段').map(function (s) { obj(s, '時段'); var wants = {}; Object.keys(s.wants || {}).forEach(function (a) { wants[str(a, 11, '選')] = {}; Object.keys(s.wants[a]).forEach(function (b) { wants[a][str(b, 11, '選')] = list(s.wants[a][b], 200, '選').map(function (id) { return ident(id, '選'); }); }); }); var mg = {}; Object.keys(s.maxGive || {}).forEach(function (a) { mg[str(a, 11, '最多給')] = num(s.maxGive[a], '最多給'); });
        var ba = {}; Object.keys(s.bookedAt || {}).forEach(function (k) { ba[str(k, 11, '預約時間')] = num(s.bookedAt[k], '預約時間'); });
        return { id: ident(s.id, '時段'), atUs: num(s.atUs, '時段'), capacity: num(s.capacity, '名額'), together: !!s.together, bookings: list(s.bookings || [], LIMITS.booked, '預約').map(ser('預約')), confirmed: list(s.confirmed || [], LIMITS.booked, '確認到達').map(ser('確認到達')), bookedAt: ba, docked: list(s.docked || [], LIMITS.booked, '對接').map(ser('對接')), missed: list(s.missed || [], LIMITS.booked, '錯過').map(ser('錯過')), wants: wants, maxGive: mg, judged: !!s.judged, visAt: (function () { var o = {}; Object.keys(s.visAt || {}).forEach(function (k) { o[str(k, 11, '預設')] = cleanVisLevel(s.visAt[k]); }); return o; })() }; }),
      world: cleanWorld(r.world)
    };
    out.house = cleanHouse(r.house, plotAt(out), false, bornOf(out), dayNum(nowUs()));   // 方塊照現在的地皮檢查：不合格的丟掉；門補上、日曆補長；舊的外觀換成預設小屋
    return out;
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
  var KEY = 'arrive-v9', OLD_KEY = 'arrive-v8';
  function cleanNotice(n) {
    obj(n, '公告');
    return { id: str(n.id, 60, '公告'), owner: str(n.owner, 11, '公告'), need: str(n.need, 200, '公告'), kind: str(n.kind || '', 20, '種類'), give: list(n.give || [], 50, '可以給').map(function (id) { return ident(id, '可以給'); }), cap: num(n.cap, '上限'), untilDay: n.untilDay == null ? null : num(n.untilDay, '期限'), atUs: num(n.atUs, '公告'), pinned: !!n.pinned,
      links: list(n.links || [], 200, '接上去').map(function (x) { obj(x, '接上去'); return JSON.parse(JSON.stringify(x)); }), noReport: !!n.noReport };
  }
  // 存檔壓縮（LZW）：固定 18 位元的碼，0＝後面接一個新字（16 位元），1＝結束；位元流每 15 位元一個字（加 32，避開控制字元和代理對）
  var CAP = 1 << 18, W = 18, LZ_MARK = 'LZ1:', LZ_OVER = 1000000;   // 存檔超過 100 萬字才壓縮（三年份大約 600 萬字壓成 30 多萬字）
  function pack(codesFn) {
  var out = [], buf = 0, n = 0;
  function bits(v, k) { for (var i = k - 1; i >= 0; i--) { buf = (buf << 1) | ((v >>> i) & 1); n++; if (n === 15) { out.push(String.fromCharCode(buf + 32)); buf = 0; n = 0; } } }
  codesFn(bits);
  if (n) { buf <<= (15 - n); out.push(String.fromCharCode(buf + 32)); }
  return out.join('');
}
  function compress(str) {
  return pack(function (bits) {
    var single = new Map(), pairs = new Map(), next = 2, cur = -1;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i), sc = single.get(c);
      if (sc === undefined) { if (cur >= 0) bits(cur, W); bits(0, W); bits(c, 16); if (next < CAP) single.set(c, next++); cur = -1; continue; }
      if (cur < 0) { cur = sc; continue; }
      var key = cur * 65536 + c, v = pairs.get(key);
      if (v !== undefined) { cur = v; continue; }
      bits(cur, W); if (next < CAP) pairs.set(key, next++); cur = sc;
    }
    if (cur >= 0) bits(cur, W); bits(1, W);
  });
}
  function decompress(s) {
  var pos = 0, buf = 0, n = 0;
  function read(k) { var v = 0; for (var i = 0; i < k; i++) { if (n === 0) { buf = s.charCodeAt(pos++) - 32; n = 15; } n--; v = (v << 1) | ((buf >>> n) & 1); } return v; }
  var dict = [], next = 2, prev = null, out = [];
  for (;;) {
    var k = read(W);
    if (k === 1) break;
    if (k === 0) { var c = String.fromCharCode(read(16)); if (next < CAP) dict[next++] = c; out.push(c); prev = null; continue; }
    var e = k < next && dict[k] !== undefined ? dict[k] : (k === next && prev !== null ? prev + prev.charAt(0) : null);
    if (e === null) throw new Error('壞掉的壓縮存檔');
    out.push(e);
    if (prev !== null && next < CAP) dict[next++] = prev + e.charAt(0);
    prev = e;
  }
  return out.join('');
}

  // 壓縮的保險：壓完先解開對照一次，一樣才存；不一樣就丟錯，存檔不動
  var codec = { compress: compress, decompress: decompress };
  function encodeSave(json) {
    if (json.length <= LZ_OVER) return json;
    var z = codec.compress(json), back = null;
    try { back = codec.decompress(z); } catch (e) { back = null; }
    if (back !== json) { var err = new Error('壓縮出錯'); err.name = 'CompressCheck'; throw err; }
    return LZ_MARK + z;
  }
  function decodeSave(raw) { return raw && raw.slice(0, LZ_MARK.length) === LZ_MARK ? codec.decompress(raw.slice(LZ_MARK.length)) : raw; }
  var io = { loadIssue: null, saveError: null, blocked: false, lastSize: 0 };
  function load(opts) {
    io.loadIssue = null; io.blocked = false;
    var raw = null; try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    var st = loadFrom(KEY, 9);
    if (st) return st;
    if (raw) {   // 存檔在，但讀不進來：另外留一份，不蓋掉，跳提示
      var bk = KEY + '-backup-' + Date.now();
      try { localStorage.setItem(bk, raw); io.loadIssue = { message: '存檔讀不進來，已經另外留一份（' + bk + '），先從新的開始。', backup: bk }; }
      catch (e) { io.blocked = true; io.loadIssue = { message: '存檔讀不進來，空間也不夠另外留一份；為了不蓋掉舊存檔，這次玩的都不會存。', backup: null }; }
      return fresh(opts);
    }
    st = loadFrom(OLD_KEY, 8);   // 第一次打開：讀得到 v8 的存檔就搬過來
    if (st) { save(st); return st; }
    return fresh(opts);
  }
  function loadFrom(key, ver) {
    try {
      var s = localStorage.getItem(key);
      if (s) {
        var j = JSON.parse(decodeSave(s));
        if (j && j.v === ver && Array.isArray(j.roles) && j.roles.length) {
          var roles = j.roles.map(cleanRole);
          var holds = list(j.holds || [], LIMITS.rows, '保留').map(function (h) { obj(h, '保留'); return { id: str(h.id, 60, '保留'), issuer: str(h.issuer, 11, '保留'), holder: str(h.holder, 11, '保留'), resource: ident(h.resource, '保留'), name: str(h.name, LIMITS.name, '保留'), price: num(h.price, '保留'), docking: str(h.docking || '', 60, '保留'), atUs: num(h.atUs, '保留'), untilDay: h.untilDay == null ? null : num(h.untilDay, '保留'), status: ['held', 'redeemed', 'expired', 'voided'].indexOf(h.status) >= 0 ? h.status : 'held', redeemedAt: h.redeemedAt == null ? null : num(h.redeemedAt, '保留'), endedAt: h.endedAt == null ? null : num(h.endedAt, '保留'), sig: h.sig == null ? null : str(h.sig, 200, '簽章') }; });
          var copy = function (what) { return list(j[what] || [], LIMITS.rows, what).map(function (x) { obj(x, what); return JSON.parse(JSON.stringify(x)); }); };
          var me = (typeof j.me === 'number' && j.me >= -1 && j.me < roles.length) ? j.me : -1;
          var tu = obj(j.tutorial || {}, '教學');
          // 發過的序號：存檔記的，加上存檔裡出現過的（角色、對接、保留、兌現、接受家規、不玩了的紀錄）
          var issued = list(j.issued || [], 100000, '序號').map(function (x) { return str(x, 11, '序號'); });
          var seen = function (x) { if (x && /^\d{11}$/.test(x) && issued.indexOf(x) < 0) issued.push(x); };
          roles.forEach(function (r) { seen(r.serial); }); holds.forEach(function (h) { seen(h.issuer); seen(h.holder); });
          (j.dockings || []).forEach(function (d) { d = obj(d, '對接'); seen(d.a); seen(d.b); }); (j.redeems || []).forEach(function (x) { x = obj(x, '兌現'); seen(x.holder); seen(x.issuer); });
          (j.acceptances || []).forEach(function (x) { x = obj(x, '接受'); seen(x.who); seen(x.of); }); (j.records || []).forEach(function (x) { x = obj(x, '紀錄'); seen(x.serial); });
          var tutorial;
          if (ver === 9) tutorial = { step: tu.step == null ? 'done' : (tu.step === 'done' ? 'done' : num(tu.step, '教學')), skipped: !!tu.skipped, slot: tu.slot == null ? null : str(tu.slot, 60, '教學'), random: !!tu.random, door: !!tu.door, found: !!tu.found, sawRules: !!tu.sawRules, house: !!tu.house };
          else tutorial = me < 0 ? freshTutorial() : { step: 'done', skipped: !!tu.skipped, slot: null, random: false, found: false, sawRules: false };   // v8 搬過來：教學步驟不一樣，還沒創角色的從頭，其他算走完
          var out = { v: 9, me: me, roles: roles, issued: issued, holds: holds, dockings: copy('dockings'), redeems: copy('redeems'), acceptances: copy('acceptances'), records: copy('records'), notices: list(j.notices || [], 20000, '公告').map(cleanNotice), tutorial: tutorial };
          if (Array.isArray(j.entries)) out.entries = list(j.entries, LIMITS.rows, '每一筆').map(cleanEntry); else buildEntries(out);   // 第 1 輪的存檔：從對接紀錄和時段補出每一筆（每一筆公開）
          guideNotice(out, nowUs());
          return out;
        }
      }
    } catch (e) { /* 壞掉或沒有儲存空間：用預設 */ }
    return null;
  }
  // 存檔：成功回 true；存不進去（空間滿了）回 false，原因放在 io.saveError，畫面要跳提示
  function save(state) {
    if (io.blocked) { io.saveError = '舊存檔讀不進來、也沒辦法另外留一份，為了不蓋掉它，這次不存。'; return false; }
    try { var json = JSON.stringify(state); io.lastSize = json.length; localStorage.setItem(KEY, encodeSave(json)); io.saveError = null; return true; }
    catch (e) { io.saveError = e && e.name === 'CompressCheck' ? '存檔壓縮出錯（壓完解不回原樣），這次不存，原本的存檔沒動。剛才改的沒存到。' : '存不進去（' + (e && e.name === 'QuotaExceededError' ? '空間滿了' : (e && e.message) || '不知道為什麼') + '），剛才改的沒存到。'; return false; }
  }
  function cleanEntry(e) {
    obj(e, '每一筆'); var vis = {}; obj(e.vis || {}, '藏'); Object.keys(e.vis || {}).forEach(function (k) { vis[str(k, 11, '藏')] = cleanVisLevel(e.vis[k]); });
    var names = {}; Object.keys(e.names || {}).forEach(function (k) { names[str(k, 11, '名字')] = str(e.names[k], LIMITS.name, '名字'); });
    var a = str(e.a, 11, '每一筆'), b = str(e.b, 11, '每一筆');
    if (vis[a] == null) vis[a] = 'hidden'; if (vis[b] == null) vis[b] = 'hidden';
    var tut = !!e.tutorial; if (tut && (a === GUIDE || b === GUIDE)) vis[GUIDE] = 'hidden';
    return { id: str(e.id, 60, '每一筆'), slot: str(e.slot, 60, '每一筆'), owner: e.owner == null ? null : str(e.owner, 11, '每一筆'), a: a, b: b, names: names, bookedAt: num(e.bookedAt, '每一筆'), atUs: num(e.atUs, '每一筆'),
      status: ['booked', 'traded', 'nodock', 'invalid', 'miss'].indexOf(e.status) >= 0 ? e.status : 'nodock', docking: e.docking == null ? null : str(e.docking, 60, '每一筆'), reason: e.reason == null ? null : str(e.reason, LIMITS.text, '每一筆'), together: !!e.together, tutorial: tut, vis: vis };
  }
  // 用序號找角色：簡寫（J2）或 11 位數都可以；找不到回 null
  function findRole(state, code) {
    var c = String(code == null ? '' : code).trim().toUpperCase(); if (!c) return null;
    var serial = /^\d{11}$/.test(c) ? c : expand(c);
    return serial ? roleOf(state, serial) : null;
  }
  // 隨機挑一個還在玩、不是自己的角色（rnd 給測試用）
  function randomRole(state, meSerial, rnd) {
    var pool = state.roles.filter(function (r) { return r.serial !== meSerial; });
    if (!pool.length) return null;
    return pool[Math.min(pool.length - 1, Math.floor((rnd == null ? Math.random() : rnd) * pool.length))];
  }

  return {
    abbrev: abbrev, expand: expand, digitsAfter: digitsAfter, Decoder: Decoder, route: route,
    FUNCS: FUNCS, SHAPES: SHAPES, LOOKS: LOOKS, look: look, radiusOf: radiusOf, VIS: VIS, allObjects: allObjects, findObject: findObject, cleanWorld: cleanWorld, cleanRole: cleanRole, tryClean: tryClean,
    fmtUs: fmtUs, nowUs: nowUs, untilText: untilText, deleteSlot: deleteSlot, VIS_LEVELS: VIS_LEVELS, PALETTE: PALETTE, BLOCKS: BLOCKS, SIGN_MAX: SIGN_MAX, PLOT_MIN: PLOT_MIN, PLOT_MAX: PLOT_MAX, TEMPLATES: TEMPLATES, CAL_DIRS: CAL_DIRS, CAL_START: CAL_START, CAL_Z: CAL_Z, plotOf: plotOf, plotAt: plotAt, cleanBlocks: cleanBlocks, template: template, calSpot: calSpot, calMonth: calMonth, monthIndex: monthIndex, monthFirstDay: monthFirstDay, nextCalPos: nextCalPos, growCalendars: growCalendars, setCalDir: setCalDir, ackCalRemoved: ackCalRemoved, moveDoor: moveDoor, doorOf: doorOf, doorFront: doorFront, doorCells: doorCells, doorFrontCells: doorFrontCells, calCells: calCells, calFrontCells: calFrontCells, reserved: reserved, codec: codec,
    cleanHouse: cleanHouse, houseOf: houseOf, compress: compress, decompress: decompress, encodeSave: encodeSave, decodeSave: decodeSave, setHouse: setHouse, addBlock: addBlock, removeBlock: removeBlock, rotateBlock: rotateBlock, setBlocks: setBlocks, applyTemplate: applyTemplate, isNeighbor: isNeighbor, entriesOf: entriesOf, setVis: setVis, viewHouse: viewHouse, dayDetail: dayDetail, ageOf: ageOf, bornOf: bornOf, buildEntries: buildEntries, io: io, LIMITS: LIMITS, cleanSite: cleanSite, setSite: setSite, setContact: setContact, randomRole: randomRole, postNotice: postNotice, removeNotice: removeNotice, expireNotices: expireNotices, giveNames: giveNames, canBook: canBook, search: search, KEY: KEY, OLD_KEY: OLD_KEY, togetherMissing: togetherMissing, togetherStatus: togetherStatus, selectedPairs: selectedPairs, BLANK: BLANK, dayOf: dayOf, dayNum: dayNum, dayLabel: dayLabel, DAY_US: DAY_US, newId: newId, DEFAULT_DAILY: DEFAULT_DAILY,
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
