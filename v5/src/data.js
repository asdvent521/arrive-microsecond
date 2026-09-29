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
  Decoder.prototype.need = function () {
    return this.letter ? digitsAfter(this.letter) - this.digits.length : null;
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
      if (!this.letter || !from || from === ev.object) return { type: 'ignored' };
      var mv = this.walk.moves.find(function (r) { return r.from === from && r.to === ev.object; });
      if (!mv) return { type: 'ignored' };
      this.digits += mv.digit;
      if (this.need() === 0) { this.done = this.code(); return { type: 'done', code: this.done }; }
      return { type: 'digit', digit: mv.digit, need: this.need() };
    }
    return { type: 'ignored' };
  };

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
  function load() {
    try {
      var s = localStorage.getItem(KEY);
      if (s) { var j = JSON.parse(s); if (j && j.v === 5 && Array.isArray(j.roles)) return j; }
    } catch (e) { /* 沒有儲存空間也能玩 */ }
    return { v: 5, roles: defaultRoles(), records: [] };
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
    defaultRoles: defaultRoles, Decoder: Decoder,
    fmtUs: fmtUs, nowUs: nowUs, load: load, save: save, findRole: findRole
  };
})();
if (typeof module !== 'undefined') module.exports = DATA;
