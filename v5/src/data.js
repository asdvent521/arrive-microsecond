/* ===== 資料層：規則與資料，不碰畫面 =====
 * 這一層只有純資料和純函式，node 也能跑（v5/tests/data.test.js）。
 * 世界只能是資料：一個角色的世界 = 序號、功能點、走法表、路、出發點、規則、難題。
 */
var DATA = (function () {
  'use strict';

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

  /* ---------- 功能：功能固定，外觀自由 ---------- */
  var FUNCS = {
    rule:    { label: '規則', visible: 'cond',   defaultLook: '屋' },
    problem: { label: '難題', visible: 'cond',   defaultLook: '碑' },
    goal:    { label: '終點', visible: 'all',    defaultLook: '台' },
    fusion:  { label: '融合', visible: 'member', defaultLook: '殿' },
    stage:   { label: '階段', visible: 'member', defaultLook: '工坊' },
    none:    { label: '地標', visible: 'all',    defaultLook: '—' }
  };
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

  /* ---------- 預設世界（原型：兩個角色） ---------- */
  function defaultRoles() {
    return [
      {
        serial: '00000000001', name: '我', color: '#A2731F',
        departUs: null,
        rules: [{ text: '早上十點前不回訊息。', visible: 'all' }],
        problems: [{ text: '每天都想早起，但每天都做不到。', status: 'open' }],
        start: [0, 6],
        objects: [
          { id: 'rule',    name: '規則屋', func: 'rule',    pos: [-6, -2], look: '屋', parts: look('屋', '#B8894A') },
          { id: 'problem', name: '難題碑', func: 'problem', pos: [0, -6],  look: '碑', parts: look('碑', '#6E7C8C') },
          { id: 'goal',    name: '終點台', func: 'goal',    pos: [6, -2],  look: '台', parts: look('台', '#C9A96A') },
          { id: 'fusion',  name: '融合殿', func: 'fusion',  pos: [6, 6],   look: '殿', parts: look('殿', '#D9CFB8') },
          { id: 'stage',   name: '工坊',   func: 'stage',   pos: [-6, 6],  look: '工坊', parts: look('工坊', '#8C7B62') }
        ],
        path: [[0, 6], [6, -2]],
        walk: {
          circles: [{ object: 'rule', letter: 'J' }],
          moves: [{ from: 'problem', to: 'goal', digit: '1' }, { from: 'problem', to: 'fusion', digit: '2' }]
        }
      },
      {
        serial: '00000000002', name: '阿澄', color: '#1C7A73',
        departUs: null,
        rules: [{ text: '晚上九點以後只做安靜的事。', visible: 'all' }],
        problems: [{ text: '晚上總是拖到很晚才睡。', status: 'open' }],
        start: [-9, 8],
        objects: [
          { id: 'rule',    name: '規則樹', func: 'rule',    pos: [-5, 3],  look: '樹', parts: look('樹', '#3F8A5A') },
          { id: 'problem', name: '難題井', func: 'problem', pos: [2, 5],   look: '井', parts: look('井', '#8A8F96') },
          { id: 'goal',    name: '終點台', func: 'goal',    pos: [7, -3],  look: '台', parts: look('台', '#6FB3AC') },
          { id: 'fusion',  name: '噴泉',   func: 'fusion',  pos: [-2, -6], look: '噴泉', parts: look('噴泉', '#9BB7C9') },
          { id: 'stage',   name: '塔',     func: 'stage',   pos: [6, 6],   look: '塔', parts: look('塔', '#7C8A99') },
          { id: 'hill',    name: '小山',   func: 'none',    pos: [-8, -4], look: '山', parts: look('山', '#6B7F5A') }
        ],
        path: [[-9, 8], [-5, 6.5], [2, 1], [7, -3]],
        walk: {
          circles: [{ object: 'hill', letter: 'J' }],
          moves: [{ from: 'rule', to: 'goal', digit: '1' }, { from: 'rule', to: 'problem', digit: '2' }]
        }
      },
      {
        serial: '00000000003', name: '小樂', color: '#9C4450',
        departUs: null,
        rules: [{ text: '週末不排任何事。', visible: 'all' }],
        problems: [{ text: '答應的事太多，每件都做一半。', status: 'open' }],
        start: [0, 9],
        objects: [
          { id: 'rule',    name: '規則塔', func: 'rule',    pos: [-6, 0],  look: '塔', parts: look('塔', '#B07A82') },
          { id: 'problem', name: '難題霧', func: 'problem', pos: [0, -5],  look: '球', parts: [{ shape: 'sphere', size: [3, 3, 3], color: '#C9CED4', offset: [0, 1.5, 0] }] },
          { id: 'goal',    name: '終點台', func: 'goal',    pos: [6, 0],   look: '台', parts: look('台', '#D9A0A8') },
          { id: 'fusion',  name: '融合井', func: 'fusion',  pos: [5, 7],   look: '井', parts: look('井', '#8A8F96') },
          { id: 'stage',   name: '工坊',   func: 'stage',   pos: [-5, 7],  look: '工坊', parts: look('工坊', '#7A6A72') }
        ],
        path: [[0, 9], [6, 0]],
        walk: {
          circles: [{ object: 'goal', letter: 'J' }],
          moves: [{ from: 'rule', to: 'problem', digit: '1' }, { from: 'problem', to: 'fusion', digit: '2' }, { from: 'fusion', to: 'stage', digit: '3' }]
        }
      }
    ];
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

  /* ---------- 純資料檢查：讀進來的世界只能是資料，不能是程式 ---------- */
  // 只抄已知欄位、檢查型別，回傳乾淨的新物件；不合格就丟出錯誤訊息
  var LIMITS = { objects: 60, parts: 24, path: 200, rules: 50, text: 2000, name: 60 };
  function bad(msg) { throw new Error(msg); }
  function str(v, max, what) { if (typeof v !== 'string') bad(what + ' 不是文字'); if (v.length > max) bad(what + ' 太長'); return v; }
  function num(v, what) { if (typeof v !== 'number' || !isFinite(v)) bad(what + ' 不是數字'); return v; }
  function vec(v, n, what) { if (!Array.isArray(v) || v.length !== n) bad(what + ' 不是 ' + n + ' 個數字'); return v.map(function (x) { return num(x, what); }); }
  function list(v, max, what) { if (!Array.isArray(v)) bad(what + ' 不是清單'); if (v.length > max) bad(what + ' 太多'); return v; }
  function obj(v, what) { if (!v || typeof v !== 'object' || Array.isArray(v)) bad(what + ' 不是資料'); return v; }
  function color(v, what) { if (!/^#[0-9a-fA-F]{6}$/.test(String(v))) bad(what + ' 顏色格式錯'); return v; }
  function ident(v, what) { if (!/^[A-Za-z0-9_-]{1,40}$/.test(String(v))) bad(what + ' 代號只能是英數'); return v; }
  function cleanPart(p) {
    obj(p, '形體');
    if (!SHAPES[p.shape]) bad('形體種類不認得：' + p.shape);
    return { shape: p.shape, size: vec(p.size, 3, '形體大小'), color: color(p.color, '形體'), offset: vec(p.offset || [0, 0, 0], 3, '形體位置') };
  }
  function cleanText(t, what) {
    obj(t, what);
    return { text: str(t.text, LIMITS.text, what), visible: t.visible === 'self' ? 'self' : 'all', status: ['shelved', 'fused', 'exited'].indexOf(t.status) >= 0 ? t.status : 'open' };
  }
  function cleanWorld(w) {
    obj(w, '世界');
    if (!/^\d{11}$/.test(String(w.serial)) || !abbrev(w.serial)) bad('序號格式錯');
    var out = {
      serial: w.serial,
      name: str(w.name, LIMITS.name, '名字'),
      color: color(w.color || '#888888', '角色'),
      departUs: w.departUs == null ? null : num(w.departUs, '出發點'),
      departDone: !!w.departDone,
      rules: list(w.rules || [], LIMITS.rules, '規則').map(function (t) { return cleanText(t, '規則'); }),
      problems: list(w.problems || [], LIMITS.rules, '難題').map(function (t) { return cleanText(t, '難題'); }),
      start: vec(w.start || [0, 0], 2, '起點'),
      objects: list(w.objects, LIMITS.objects, '功能點').map(function (o) {
        obj(o, '功能點');
        if (!FUNCS[o.func]) bad('功能不認得：' + o.func);
        return { id: ident(o.id, '功能點'), name: str(o.name, LIMITS.name, '功能點名稱'), func: o.func,
                 pos: vec(o.pos, 2, '功能點位置'), look: o.look ? str(o.look, 20, '外觀') : undefined,
                 parts: list(o.parts, LIMITS.parts, '形體').map(cleanPart) };
      }),
      path: list(w.path || [], LIMITS.path, '路').map(function (p) { return vec(p, 2, '路'); }),
      walk: { circles: [], moves: [] }
    };
    var ids = {};
    out.objects.forEach(function (o) { if (ids[o.id]) bad('功能點代號重複：' + o.id); ids[o.id] = true; });
    var walk = obj(w.walk || {}, '走法表');
    out.walk.circles = list(walk.circles || [], LIMITS.rules, '繞圈').map(function (c) {
      obj(c, '繞圈'); if (!ids[c.object]) bad('繞圈指到不存在的物件'); if (!/^[A-J]$/.test(String(c.letter))) bad('繞圈字母錯');
      return { object: c.object, letter: c.letter };
    });
    out.walk.moves = list(walk.moves || [], LIMITS.rules, '走到').map(function (m) {
      obj(m, '走到'); if (!ids[m.from] || !ids[m.to]) bad('走到指到不存在的物件'); if (!/^[0-9]$/.test(String(m.digit))) bad('走到的數字錯');
      return { from: m.from, to: m.to, digit: m.digit };
    });
    return out;
  }
  // 讀外來資料前先過 cleanWorld：只留資料，任何函式、未知欄位都不會被抄過來
  function tryClean(w) { try { return { world: cleanWorld(w) }; } catch (e) { return { error: e.message }; } }

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

  /* ---------- 存檔：只存資料 ---------- */
  var KEY = 'arrive-v5';
  function fresh() { return { v: 5, me: 0, roles: defaultRoles(), records: [], fusions: [], points: [] }; }
  function load() {
    try {
      var s = localStorage.getItem(KEY);
      if (s) {
        var j = JSON.parse(s);
        if (j && j.v === 5 && Array.isArray(j.roles) && j.roles.length) {
          var roles = j.roles.map(cleanWorld);          // 存檔也是外來資料，一樣洗過
          var recs = list(j.records || [], 500, '紀錄').map(function (r) {
            return { kind: ['meet', 'shelve', 'exit'].indexOf(r.kind) >= 0 ? r.kind : 'shelve', at: num(r.at, '紀錄時間'), text: str(r.text, LIMITS.text, '紀錄') };
          });
          // 融合與點數：存檔是自己寫的，這裡只確認形狀；正式版點數還要驗簽章
          var fusions = list(j.fusions || [], 200, '融合').map(function (f) { obj(f, '融合'); if (!Array.isArray(f.members) || !Array.isArray(f.stages)) bad('融合格式錯'); return JSON.parse(JSON.stringify(f)); });
          var points = list(j.points || [], 5000, '點數').map(function (p) {
            obj(p, '點數'); if (p.kind !== 'idea' && p.kind !== 'battle') bad('點數種類錯');
            return { id: str(p.id, 60, '點數'), kind: p.kind, from: str(p.from, 11, '點數'), to: str(p.to, 11, '點數'), amount: num(p.amount, '點數'),
                     atUs: num(p.atUs, '點數'), fusion: str(p.fusion || '', 60, '點數'), stage: str(p.stage || '', 60, '點數'), ruleVersion: str(p.ruleVersion || '', 10, '點數'), sig: p.sig == null ? null : str(p.sig, 200, '簽章') };
          });
          var me = (typeof j.me === 'number' && j.me >= 0 && j.me < roles.length) ? j.me : 0;
          return { v: 5, me: me, roles: roles, records: recs, fusions: fusions, points: points };
        }
      }
    } catch (e) { /* 壞掉或沒有儲存空間：用預設 */ }
    return fresh();
  }
  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 忽略 */ }
  }
  function findRole(state, code) {
    var serial = expand(code);
    return serial ? state.roles.find(function (r) { return r.serial === serial; }) || null : null;
  }

  return {
    abbrev: abbrev, expand: expand, digitsAfter: digitsAfter,
    FUNCS: FUNCS, SHAPES: SHAPES, LOOKS: LOOKS, look: look, radiusOf: radiusOf,
    defaultRoles: defaultRoles, Decoder: Decoder, route: route, cleanWorld: cleanWorld, tryClean: tryClean,
    fmtUs: fmtUs, nowUs: nowUs, load: load, save: save, fresh: fresh, findRole: findRole
  };
})();
if (typeof module !== 'undefined') module.exports = DATA;
