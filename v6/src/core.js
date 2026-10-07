/* ===== v6 平台核心：規則與資料，不碰畫面 =====
 * 純函式、node 可測。世界只能是資料。
 * 角色、每天的點、生命週期、空窗、規則表（條件固定格式）、資源表、查詢、預約、對接、點數帳、兌現。
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
      this.letter = String.fromCharCode(c); this.digits = '';
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
    var steps = [], letter = /^[A-J]/.test(ab) ? ab[0] : null, digits = letter ? ab.slice(1) : ab;
    if (letter) {
      var best = null;
      walk.circles.forEach(function (c) {
        var n = c.letter.charCodeAt(0) - letter.charCodeAt(0) + 1;
        if (n >= 1 && (!best || n < best.n)) best = { c: c, n: n };
      });
      if (!best) return { missing: '走法表裡沒有物件能繞出 ' + letter };
      steps.push('繞' + name(best.c.object) + (best.n === 1 ? '一圈' : ' ' + best.n + ' 圈') + '（' + letter + '）');
    }
    var at = null;
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
  /* ---------- 時間：本機日期、天數 ---------- */
  var DAY_US = 24 * 3600e6;
  function dayOf(us) { var d = new Date(Math.floor(us / 1000)); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function daysLeft(role, atUs) { return Math.max(0, (role.life.endUs - atUs) / DAY_US); }
  var seq = 0;
  function newId(p) { return p + Date.now().toString(36) + (seq++).toString(36); }
  function roleOf(state, serial) { return state.roles.find(function (r) { return r.serial === serial; }) || null; }
  function need(state, serial) { var r = roleOf(state, serial); if (!r) bad('沒有這個角色：' + serial); return r; }

  /* ---------- 規則 1：每天的點。當天沒給出去的隔天歸零，不能預支 ---------- */
  function status(role, atUs) {
    if (role.state === 'ended' || atUs < role.life.startUs || atUs >= role.life.endUs) return 'ended';
    return role.state === 'vacancy' ? 'vacancy' : 'active';
  }
  function givenToday(state, serial, atUs) {
    var day = dayOf(atUs);
    return state.points.filter(function (p) { return p.issuer === serial && dayOf(p.atUs) === day; }).reduce(function (s, p) { return s + p.amount; }, 0);
  }
  function remainingToday(state, role, atUs) {
    if (status(role, atUs) !== 'active') return 0;        // 空窗停發、結束沒有
    return Math.max(0, role.dailyPoints - givenToday(state, role.serial, atUs));
  }

  /* ---------- 規則 2：生命週期。週期內規則不能改；到期點數作廢；提早結束要先清點數 ---------- */
  function hashOf(o) { var s = JSON.stringify(o), h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); }
  function rulesHash(role) { return hashOf({ rules: role.rules, resources: role.resources.map(function (x) { return { id: x.id, name: x.name, price: x.price }; }), dailyPoints: role.dailyPoints, life: role.life }); }
  // 點數還有效嗎：發出者沒結束
  function pointValid(state, p, atUs) { var r = roleOf(state, p.issuer); return !!r && status(r, atUs) !== 'ended' && p.amount - p.spent > 0; }
  function holdersOf(state, serial, atUs) {
    var out = {};
    state.points.forEach(function (p) { if (p.issuer === serial && p.amount - p.spent > 0 && (!atUs || pointValid(state, p, atUs))) out[p.holder] = (out[p.holder] || 0) + (p.amount - p.spent); });
    return out;
  }
  function endEarly(state, serial, atUs, consents) {
    var r = need(state, serial);
    if (status(r, atUs) === 'ended') bad('角色已經結束了');
    var hs = holdersOf(state, serial, atUs), who = Object.keys(hs);
    var missing = who.filter(function (h) { return (consents || []).indexOf(h) < 0; });
    if (missing.length) bad('還有人拿著你的點沒兌現：' + missing.map(function (h) { return abbrev(h) + ' ' + hs[h] + ' 點'; }).join('、') + '。先讓他們兌現，或取得同意');
    r.life.endUs = atUs; r.state = 'ended';
    return r;
  }
  // 改規則只能結束再重創：新角色帶 prev
  function recreate(state, serial, fields, atUs) {
    var old = need(state, serial);
    if (status(old, atUs) !== 'ended') bad('先結束這個角色，才能以它為前身重創');
    var r = createRole(state, Object.assign({}, fields, { prev: serial }), atUs);
    return r;
  }
  var COND_FIELDS = {
    dailyPoints: { label: '對方每天的點數', get: function (state, other, atUs) { return other.dailyPoints; } },
    daysLeft:    { label: '對方週期還剩多久（天）', get: function (state, other, atUs) { return Math.floor(daysLeft(other, atUs)); } },
    status:      { label: '對方狀態', get: function (state, other, atUs) { return status(other, atUs); }, enum: { active: '正常', vacancy: '空窗' } },
    myPoints:    { label: '對方手上有多少我的點', get: function (state, other, atUs, me) { return state.points.filter(function (p) { return p.issuer === me.serial && p.holder === other.serial; }).reduce(function (s, p) { return s + p.amount - p.spent; }, 0); } },
    dockCount:   { label: '對方對接過幾次', get: function (state, other, atUs) { return state.dockings.filter(function (d) { return d.a === other.serial || d.b === other.serial; }).length; } }
  };
  var OPS = { '>=': '至少', '<=': '最多', '=': '等於', '!=': '不是' };
  function cmp(a, op, b) { switch (op) { case '>=': return a >= b; case '<=': return a <= b; case '=': return a == b; case '!=': return a != b; } return false; }
  function condText(c) {
    var f = COND_FIELDS[c.field]; if (!f) return '？';
    var v = f.enum ? (f.enum[c.value] || c.value) : c.value;
    return f.label + (f.enum ? (c.op === '!=' ? ' 不是 ' : ' 是 ') : ' ' + OPS[c.op] + ' ') + v;
  }
  function createRole(state, f, atUs) {
    atUs = atUs || nowUs();
    var serial = f.serial || String(state.roles.length + 1).padStart(11, '0');
    if (!abbrev(serial) || roleOf(state, serial)) bad('序號不對或已存在');
    if (!f.name || !String(f.name).trim()) bad('角色要有名字');
    var daily = Math.floor(+f.dailyPoints); if (!(daily >= 1)) bad('每天的點要是正整數');
    var life = f.life || { startUs: atUs, endUs: atUs + 30 * DAY_US };
    if (!(life.endUs > life.startUs)) bad('結束要在開始之後');
    var rules = f.rules || {};
    var conds = (rules.conditions || []).map(function (c) {
      if (!COND_FIELDS[c.field]) bad('條件欄位不認得：' + c.field);
      if (!OPS[c.op]) bad('比較不認得：' + c.op);
      if (COND_FIELDS[c.field].enum) { if (!COND_FIELDS[c.field].enum[c.value]) bad('條件數值不對'); return { field: c.field, op: c.op === '!=' ? '!=' : '=', value: c.value }; }
      if (typeof c.value !== 'number' || !isFinite(c.value)) bad('條件數值要是數字');
      return { field: c.field, op: c.op, value: c.value };
    });
    var r = {
      serial: serial, name: String(f.name).trim(), dailyPoints: daily, life: { startUs: life.startUs, endUs: life.endUs },
      state: 'active', prev: f.prev || null, vacancyDebt: null,
      rules: { uses: (rules.uses || []).map(String).filter(Boolean), conditions: conds, bothMustPass: !!rules.bothMustPass, mustAcceptVillage: !!rules.mustAcceptVillage, village: String(rules.village || ''), villageKey: null },
      resources: (f.resources || []).map(function (x) { var price = Math.floor(+x.price), qty = Math.floor(+x.qty); if (!x.name || !(price >= 1) || !(qty >= 0)) bad('資源要有名稱、價格（正整數）、數量'); return { id: x.id || newId('res'), name: String(x.name).trim(), price: price, qty: qty }; }),
      slots: [], contact: String(f.contact || ''),
      world: f.world || defaultWorld(serial)
    };
    r.rulesHash = rulesHash(r);
    state.roles.push(r);
    return r;
  }
  // 週期內規則一個字都不能改：用 hash 驗
  function assertUnchanged(role) { if (rulesHash(role) !== role.rulesHash) bad('規則表在週期內被改了，和創建時的不一樣'); }

  /* ---------- 規則 3、4：條件判定 ---------- */
  // visitor 通不通 owner 的條件；空窗的 owner 條件和開關都視為關閉
  function passes(state, owner, visitor, atUs) {
    if (status(owner, atUs) === 'vacancy') return { ok: true, failed: [] };
    var failed = owner.rules.conditions.filter(function (c) {
      var got = COND_FIELDS[c.field].get(state, visitor, atUs, owner);
      return !cmp(got, c.op, c.value);
    }).map(condText);
    return { ok: !failed.length, failed: failed };
  }
  function accepted(state, who, of) { return state.acceptances.some(function (a) { return a.who === who && a.of === of; }); }
  function accept(state, who, of) { if (!accepted(state, who, of)) state.acceptances.push({ who: who, of: of, atUs: nowUs() }); }
  // a 和 b 能不能對接：一方通就可以；任一方要求兩方都通就要兩方；要求接受村規而對方沒接受就不行
  function eligible(state, a, b, atUs) {
    if (a.serial === b.serial) return { ok: false, reason: '自己不能和自己對接' };
    if (status(a, atUs) === 'ended' || status(b, atUs) === 'ended') return { ok: false, reason: '有一方的角色已經結束' };
    var av = status(a, atUs) === 'vacancy', bv = status(b, atUs) === 'vacancy';
    if (!av && a.rules.mustAcceptVillage && !accepted(state, b.serial, a.serial)) return { ok: false, reason: abbrev(b.serial) + ' 還沒接受 ' + abbrev(a.serial) + ' 的村規' };
    if (!bv && b.rules.mustAcceptVillage && !accepted(state, a.serial, b.serial)) return { ok: false, reason: abbrev(a.serial) + ' 還沒接受 ' + abbrev(b.serial) + ' 的村規' };
    var pa = passes(state, a, b, atUs), pb = passes(state, b, a, atUs);   // pa：b 通 a 的條件
    var both = (!av && a.rules.bothMustPass) || (!bv && b.rules.bothMustPass);
    if (both) return pa.ok && pb.ok ? { ok: true, how: '兩方都通' } : { ok: false, reason: '要求兩方都通，' + (!pa.ok ? abbrev(b.serial) + ' 不通 ' + abbrev(a.serial) + ' 的條件（' + pa.failed.join('；') + '）' : abbrev(a.serial) + ' 不通 ' + abbrev(b.serial) + ' 的條件（' + pb.failed.join('；') + '）') };
    if (pa.ok || pb.ok) return { ok: true, how: pa.ok && pb.ok ? '兩方都通' : pa.ok ? abbrev(b.serial) + ' 通 ' + abbrev(a.serial) + ' 的條件' : abbrev(a.serial) + ' 通 ' + abbrev(b.serial) + ' 的條件' };
    return { ok: false, reason: '兩邊都不通：' + pa.failed.concat(pb.failed).join('；') };
  }

  /* ---------- 規則 5：查詢，排序只照事實 ---------- */
  function nextSlot(role, atUs) { var s = role.slots.filter(function (x) { return x.atUs >= atUs; }).sort(function (x, y) { return x.atUs - y.atUs; })[0]; return s || null; }
  function dockCount(state, serial) { return COND_FIELDS.dockCount.get(state, { serial: serial }); }
  function byFacts(state, atUs) { return function (x, y) { var sx = nextSlot(x, atUs), sy = nextSlot(y, atUs); return (sx ? sx.atUs : Infinity) - (sy ? sy.atUs : Infinity) || y.dailyPoints - x.dailyPoints || dockCount(state, y.serial) - dockCount(state, x.serial); }; }
  function others(state, me, atUs) { return state.roles.filter(function (r) { return r !== me && status(r, atUs) !== 'ended'; }); }
  // 我可以去找的人：我通他的條件
  function canVisit(state, me, atUs) { return others(state, me, atUs).filter(function (r) { return passes(state, r, me, atUs).ok; }).sort(byFacts(state, atUs)); }
  // 可能來找我的人：他通我的條件
  function canCome(state, me, atUs) { return others(state, me, atUs).filter(function (r) { return passes(state, me, r, atUs).ok; }).sort(byFacts(state, atUs)); }
  function searchResources(state, keyword, atUs) {
    var kw = String(keyword || '').trim().toLowerCase(), out = [];
    state.roles.forEach(function (r) { if (status(r, atUs) === 'ended') return; r.resources.forEach(function (x) { if (!kw || x.name.toLowerCase().indexOf(kw) >= 0) out.push({ role: r, resource: x }); }); });
    return out.sort(function (p, q) { return byFacts(state, atUs)(p.role, q.role); });
  }

  /* ---------- 規則 6：預約。條件通才能預約；名額滿不行；空窗照樣有名額 ---------- */
  function addSlot(state, serial, atUs, capacity, give, now) {
    var r = need(state, serial);
    if (status(r, now || nowUs()) === 'ended') bad('角色已經結束');
    if (!(atUs > (now || nowUs()))) bad('對接時段要在未來');
    var cap = Math.floor(+capacity); if (!(cap >= 1)) bad('名額要至少 1');
    var g = Math.floor(+give); if (!(g >= 0)) bad('要給多少點要是 0 以上');
    var s = { id: newId('slot'), atUs: atUs, capacity: cap, give: g, bookings: [], docked: [], missed: [], refused: [] };
    r.slots.push(s);
    return s;
  }
  function slotOf(state, slotId) { var out = null; state.roles.forEach(function (r) { r.slots.forEach(function (s) { if (s.id === slotId) out = { owner: r, slot: s }; }); }); return out; }
  function book(state, visitorSerial, slotId, atUs) {
    var x = slotOf(state, slotId); if (!x) bad('沒有這個時段');
    var visitor = need(state, visitorSerial);
    if (x.slot.atUs <= atUs) bad('這個時段已經過了');
    if (x.slot.bookings.indexOf(visitorSerial) >= 0) bad('你已經預約了');
    if (x.slot.bookings.length >= x.slot.capacity) bad('名額滿了');
    var e = eligible(state, x.owner, visitor, atUs); if (!e.ok) bad('條件不通，不能預約：' + e.reason);
    x.slot.bookings.push(visitorSerial);
    return x.slot;
  }
  function cancelBooking(state, visitorSerial, slotId) { var x = slotOf(state, slotId); if (!x) bad('沒有這個時段'); x.slot.bookings = x.slot.bookings.filter(function (s) { return s !== visitorSerial; }); }
  // 空窗角色的拒絕：只有「自己做不到對方（預約者）的要求」時，才能拒絕這次預約或對接；其他情況不能拒絕
  function canRefuse(state, owner, visitor, atUs) {
    if (status(owner, atUs) !== 'vacancy') return { ok: false, reason: '不在空窗期：條件通不通由規則表決定，不能拒絕' };
    var p = passes(state, visitor, owner, atUs);
    if (p.ok) return { ok: false, reason: '你做得到對方的要求，不能拒絕' };
    return { ok: true, reason: '做不到對方的要求：' + p.failed.join('；') };
  }
  function refuse(state, ownerSerial, slotId, visitorSerial, atUs) {
    var x = slotOf(state, slotId); if (!x || x.owner.serial !== ownerSerial) bad('沒有這個時段');
    var visitor = need(state, visitorSerial);
    if (x.slot.bookings.indexOf(visitorSerial) < 0) bad('他沒有預約這個時段');
    if (x.slot.docked.indexOf(visitorSerial) >= 0) bad('已經對接過了，不能拒絕');
    var c = canRefuse(state, x.owner, visitor, atUs); if (!c.ok) bad(c.reason);
    x.slot.bookings = x.slot.bookings.filter(function (s) { return s !== visitorSerial; });
    (x.slot.refused = x.slot.refused || []).push(visitorSerial);
    state.records.push({ kind: 'refuse', at: atUs, text: abbrev(ownerSerial) + ' ' + x.owner.name + '（空窗）拒絕了 ' + abbrev(visitorSerial) + ' ' + visitor.name + ' 的預約：' + c.reason });
    return c;
  }
  // 聯絡方式只給預約成功、還沒對接完的人看；主人結束就看不到
  function contactVisible(state, owner, viewer, atUs) {
    if (owner.serial === viewer) return true;
    if (status(owner, atUs) === 'ended') return false;
    return owner.slots.some(function (s) { return s.bookings.indexOf(viewer) >= 0 && s.docked.indexOf(viewer) < 0; });
  }

  /* ---------- 規則 7：對接。只有時段那一微秒的判定算數；過了沒對接就是錯過 ---------- */
  var DOCK_WINDOW_US = 1e6;   // 那一微秒的判定由畫面層在下一格送進來，容許 1 秒內；再晚就是錯過
  function missed(slot, visitorSerial) { return (slot.missed || []).indexOf(visitorSerial) >= 0; }
  function markMissed(state, slot, visitorSerial, atUs) {
    if (missed(slot, visitorSerial)) return;
    (slot.missed = slot.missed || []).push(visitorSerial);
    state.records.push({ kind: 'miss', at: atUs, text: abbrev(visitorSerial) + ' 錯過了 ' + fmtUs(slot.atUs) + ' 的對接' });
  }
  // 清算：所有已經過了判定窗、預約了卻沒對接的，標為錯過
  function expire(state, atUs) {
    var n = 0;
    state.roles.forEach(function (r) { r.slots.forEach(function (s) {
      if (atUs < s.atUs + DOCK_WINDOW_US) return;
      s.bookings.forEach(function (b) { if (s.docked.indexOf(b) < 0 && !missed(s, b)) { markMissed(state, s, b, atUs); n++; } });
    }); });
    return n;
  }
  function dock(state, slotId, visitorSerial, giveOwner, giveVisitor, atUs) {
    var x = slotOf(state, slotId); if (!x) bad('沒有這個時段');
    var owner = x.owner, visitor = need(state, visitorSerial);
    if (x.slot.bookings.indexOf(visitorSerial) < 0) bad('沒有預約不能對接');
    if (x.slot.docked.indexOf(visitorSerial) >= 0) bad('這個時段已經對接過了');
    if (missed(x.slot, visitorSerial)) bad('那一微秒已經錯過了，這個時段不能再對接');
    if (atUs < x.slot.atUs) bad('還沒到那一微秒');
    if (atUs >= x.slot.atUs + DOCK_WINDOW_US) { markMissed(state, x.slot, visitorSerial, atUs); bad('那一微秒過了，這次錯過；之後不能再對接'); }
    var e = eligible(state, owner, visitor, atUs); if (!e.ok) bad('對接不成立：' + e.reason);
    var go = Math.floor(+giveOwner), gv = Math.floor(+giveVisitor);
    if (!(go >= 0) || !(gv >= 0)) bad('給多少要是 0 以上');
    var ro = remainingToday(state, owner, atUs), rv = remainingToday(state, visitor, atUs);
    if (go > ro) bad(owner.name + ' 今天只剩 ' + ro + ' 點，不能預支');
    if (gv > rv) bad(visitor.name + ' 今天只剩 ' + rv + ' 點，不能預支');
    var d = { id: newId('dk'), a: owner.serial, b: visitorSerial, atUs: atUs, slot: slotId, gaveA: go, gaveB: gv, how: e.how };
    state.dockings.push(d);
    if (go > 0) state.points.push({ id: newId('pt'), issuer: owner.serial, holder: visitorSerial, amount: go, docking: d.id, atUs: atUs, spent: 0, sig: null });
    if (gv > 0) state.points.push({ id: newId('pt'), issuer: visitorSerial, holder: owner.serial, amount: gv, docking: d.id, atUs: atUs, spent: 0, sig: null });
    x.slot.docked.push(visitorSerial);
    return d;
  }

  /* ---------- 規則 8、9：兌現與空窗 ---------- */
  function balance(state, holder, issuer, atUs) {
    return state.points.filter(function (p) { return p.holder === holder && p.issuer === issuer && pointValid(state, p, atUs); }).reduce(function (s, p) { return s + p.amount - p.spent; }, 0);
  }
  function holdings(state, holder, atUs) {
    var by = {};
    state.points.forEach(function (p) {
      if (p.holder !== holder || p.amount - p.spent <= 0) return;
      var r = roleOf(state, p.issuer); if (!r) return;
      var g = by[p.issuer] || (by[p.issuer] = { issuer: r, amount: 0, status: status(r, atUs), endUs: r.life.endUs });
      g.amount += p.amount - p.spent;
    });
    return Object.keys(by).map(function (k) { return by[k]; });
  }
  function spend(state, holder, issuer, n, atUs) {
    var left = n;
    state.points.filter(function (p) { return p.holder === holder && p.issuer === issuer && pointValid(state, p, atUs); }).sort(function (a, b) { return a.atUs - b.atUs; })
      .forEach(function (p) { if (left <= 0) return; var take = Math.min(left, p.amount - p.spent); p.spent += take; left -= take; });
  }
  function redeem(state, holderSerial, issuerSerial, resourceId, atUs) {
    var issuer = need(state, issuerSerial), holder = need(state, holderSerial);
    if (holderSerial === issuerSerial) bad('自己的點對自己沒用');
    var st = status(issuer, atUs);
    if (st === 'ended') bad(issuer.name + ' 的角色已經結束，他的點作廢了');
    if (st === 'vacancy') bad(issuer.name + ' 在空窗期，暫停兌現');
    var res = issuer.resources.find(function (x) { return x.id === resourceId; }); if (!res) bad('沒有這項資源');
    var bal = balance(state, holderSerial, issuerSerial, atUs);
    if (bal < res.price) bad('你手上的 ' + issuer.name + ' 點只有 ' + bal + '，「' + res.name + '」要 ' + res.price);
    var rec = { id: newId('rd'), holder: holderSerial, issuer: issuerSerial, resource: res.id, name: res.name, cost: res.price, atUs: atUs, ok: false };
    if (res.qty < 1) {
      // 兌現失敗：資源不夠維持這個角色，自動進入空窗，欠的那一筆記下來
      issuer.state = 'vacancy'; issuer.vacancyDebt = { holder: holderSerial, resource: res.id };
      state.redeems.push(rec);
      bad(issuer.name + ' 付不出「' + res.name + '」，兌現失敗，' + issuer.name + ' 自動進入空窗期');
    }
    res.qty -= 1; spend(state, holderSerial, issuerSerial, res.price, atUs);
    rec.ok = true; state.redeems.push(rec);
    return rec;
  }
  function enterVacancy(state, serial, atUs) { var r = need(state, serial); if (status(r, atUs) !== 'active') bad('現在不能進入空窗'); r.state = 'vacancy'; }
  function restock(state, serial, resourceId, qty) { var r = need(state, serial); var res = r.resources.find(function (x) { return x.id === resourceId; }); if (!res) bad('沒有這項資源'); var q = Math.floor(+qty); if (!(q >= 1)) bad('數量要至少 1'); res.qty += q; return res; }
  // 離開空窗：有欠的那一筆就先兌現它，補足了才解除
  function leaveVacancy(state, serial, atUs) {
    var r = need(state, serial);
    if (r.state !== 'vacancy') bad('不在空窗期');
    if (status(r, atUs) === 'ended') bad('角色已經結束');
    if (r.vacancyDebt) {
      var res = r.resources.find(function (x) { return x.id === r.vacancyDebt.resource; });
      if (!res || res.qty < 1) bad('先補足「' + (res ? res.name : '資源') + '」，兌現欠的那一筆，空窗才結束');
      var debt = r.vacancyDebt; r.vacancyDebt = null; r.state = 'active';
      try { redeem(state, debt.holder, serial, debt.resource, atUs); }
      catch (e) { r.state = 'vacancy'; r.vacancyDebt = debt; throw e; }
      return;
    }
    r.state = 'active';
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
      walk: { circles: [{ object: 'rule_' + serial, letter: 'J' }], moves: [{ from: 'role_' + serial, to: 'goal_' + serial, digit: '1' }, { from: 'role_' + serial, to: 'res_' + serial, digit: '2' }, { from: 'role_' + serial, to: 'rule_' + serial, digit: '3' }] }
    };
  }
  function fresh() {
    var now = nowUs();
    var st = { v: 6, me: 0, roles: [], points: [], dockings: [], redeems: [], acceptances: [], records: [] };
    // J1 和 J2 一方通；J2 和 J3 要兩方通但不通；J3 要求接受村規
    createRole(st, { serial: '00000000001', name: '我', dailyPoints: 1800, life: { startUs: now - DAY_US, endUs: now + 60 * DAY_US },
      rules: { uses: ['1 我點 = 陪跑 1 分鐘', '60 我點 = 一起吃一頓早餐'], conditions: [{ field: 'dailyPoints', op: '>=', value: 1000 }], village: '' },
      resources: [{ id: 'r1a', name: '陪跑一小時', price: 60, qty: 1 }, { id: 'r1b', name: '早餐一頓', price: 100, qty: 5 }], contact: 'LINE: me_demo' }, now);
    createRole(st, { serial: '00000000002', name: '阿澄', dailyPoints: 2000, life: { startUs: now - DAY_US, endUs: now + 90 * DAY_US },
      rules: { uses: ['1 阿澄點 = 聽你講 1 分鐘', '100 阿澄點 = 幫你改一份履歷'], conditions: [{ field: 'dockCount', op: '>=', value: 1 }], village: '東恆村規：對接後要一起立一個難題。' },
      resources: [{ id: 'r2a', name: '改履歷', price: 100, qty: 3 }, { id: 'r2b', name: '一小時諮詢', price: 90, qty: 10 }], contact: '' }, now);
    createRole(st, { serial: '00000000003', name: '小樂', dailyPoints: 800, life: { startUs: now - DAY_US, endUs: now + 45 * DAY_US },
      rules: { uses: ['1 小樂點 = 借書 1 天'], conditions: [{ field: 'daysLeft', op: '>=', value: 30 }], bothMustPass: true, mustAcceptVillage: true, village: '小樂村規：借的書要在一個月內還。' },
      resources: [{ id: 'r3a', name: '借一本書', price: 10, qty: 20 }], contact: 'mail@example.com' }, now);
    // 阿澄開兩個對接時段：3 分鐘後、10 分鐘後，各 2 個名額，每次給 100 點
    addSlot(st, '00000000002', now + 180e6, 2, 100, now);
    addSlot(st, '00000000002', now + 600e6, 2, 100, now);
    addSlot(st, '00000000001', now + 300e6, 1, 50, now);
    return st;
  }

  /* ---------- 純資料檢查：角色 ---------- */
  function cleanRole(r) {
    obj(r, '角色');
    if (!/^\d{11}$/.test(String(r.serial)) || !abbrev(r.serial)) bad('序號格式錯');
    var life = obj(r.life, '週期');
    var out = {
      serial: r.serial, name: str(r.name, LIMITS.name, '名字'), dailyPoints: num(r.dailyPoints, '每天的點'),
      life: { startUs: num(life.startUs, '開始'), endUs: num(life.endUs, '結束') },
      state: ['active', 'vacancy', 'ended'].indexOf(r.state) >= 0 ? r.state : 'active', prev: r.prev == null ? null : str(r.prev, 11, '前身'),
      vacancyDebt: r.vacancyDebt == null ? null : { holder: str(r.vacancyDebt.holder, 11, '欠'), resource: str(r.vacancyDebt.resource, 60, '欠') },
      rules: (function (ru) { obj(ru, '規則表'); return {
        uses: list(ru.uses || [], LIMITS.rules, '用途').map(function (t) { return str(t, LIMITS.text, '用途'); }),
        conditions: list(ru.conditions || [], LIMITS.rules, '條件').map(function (c) { obj(c, '條件'); if (!COND_FIELDS[c.field] || !OPS[c.op]) bad('條件格式錯'); return { field: c.field, op: c.op, value: typeof c.value === 'number' ? num(c.value, '條件') : str(String(c.value), 20, '條件') }; }),
        bothMustPass: !!ru.bothMustPass, mustAcceptVillage: !!ru.mustAcceptVillage, village: str(ru.village || '', LIMITS.text, '村規'), villageKey: ru.villageKey == null ? null : str(ru.villageKey, 200, '金鑰') }; })(r.rules),
      rulesHash: str(r.rulesHash || '', 20, 'hash'),
      resources: list(r.resources || [], LIMITS.rules, '資源').map(function (x) { obj(x, '資源'); return { id: ident(x.id, '資源'), name: str(x.name, LIMITS.name, '資源'), price: num(x.price, '價格'), qty: num(x.qty, '數量') }; }),
      slots: list(r.slots || [], 200, '時段').map(function (s) { obj(s, '時段'); var ser = function (what) { return function (b) { return str(b, 11, what); }; }; return { id: ident(s.id, '時段'), atUs: num(s.atUs, '時段'), capacity: num(s.capacity, '名額'), give: num(s.give || 0, '給多少'), bookings: list(s.bookings || [], 200, '預約').map(ser('預約')), docked: list(s.docked || [], 200, '對接').map(ser('對接')), missed: list(s.missed || [], 200, '錯過').map(ser('錯過')), refused: list(s.refused || [], 200, '拒絕').map(ser('拒絕')) }; }),
      contact: str(r.contact || '', LIMITS.text, '聯絡方式'),
      world: cleanWorld(r.world)
    };
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
  var KEY = 'arrive-v6';
  function load() {
    try {
      var s = localStorage.getItem(KEY);
      if (s) {
        var j = JSON.parse(s);
        if (j && j.v === 6 && Array.isArray(j.roles) && j.roles.length) {
          var roles = j.roles.map(cleanRole);
          var pts = list(j.points || [], 20000, '點數').map(function (p) { obj(p, '點數'); return { id: str(p.id, 60, '點數'), issuer: str(p.issuer, 11, '點數'), holder: str(p.holder, 11, '點數'), amount: num(p.amount, '點數'), docking: str(p.docking || '', 60, '點數'), atUs: num(p.atUs, '點數'), spent: num(p.spent || 0, '點數'), sig: p.sig == null ? null : str(p.sig, 200, '簽章') }; });
          var copy = function (what) { return list(j[what] || [], 20000, what).map(function (x) { obj(x, what); return JSON.parse(JSON.stringify(x)); }); };
          var me = (typeof j.me === 'number' && j.me >= 0 && j.me < roles.length) ? j.me : 0;
          return { v: 6, me: me, roles: roles, points: pts, dockings: copy('dockings'), redeems: copy('redeems'), acceptances: copy('acceptances'), records: copy('records') };
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
    fmtUs: fmtUs, nowUs: nowUs, dayOf: dayOf, DAY_US: DAY_US, daysLeft: daysLeft, newId: newId,
    status: status, givenToday: givenToday, remainingToday: remainingToday, rulesHash: rulesHash, assertUnchanged: assertUnchanged, holdersOf: holdersOf, endEarly: endEarly, recreate: recreate, createRole: createRole,
    COND_FIELDS: COND_FIELDS, OPS: OPS, condText: condText, passes: passes, eligible: eligible, accepted: accepted, accept: accept,
    canVisit: canVisit, canCome: canCome, searchResources: searchResources, nextSlot: nextSlot, dockCount: dockCount,
    addSlot: addSlot, slotOf: slotOf, book: book, cancelBooking: cancelBooking, contactVisible: contactVisible, dock: dock, expire: expire, missed: missed, DOCK_WINDOW_US: DOCK_WINDOW_US, canRefuse: canRefuse, refuse: refuse,
    balance: balance, holdings: holdings, redeem: redeem, enterVacancy: enterVacancy, leaveVacancy: leaveVacancy, restock: restock, pointValid: pointValid,
    defaultWorld: defaultWorld, fresh: fresh, load: load, save: save, findRole: findRole, roleOf: roleOf
  };
})();
var DATA = CORE;   // world.js 用這個名字
if (typeof module !== 'undefined') module.exports = CORE;
