/* ===== 點數兌換市集：規則與資料，不碰畫面 =====
 * 點數綁定發出者，只能向發出者兌換能量點或資源；每點換多少大卡看那一點記下的規則版本。
 * 每個角色每天發出的能量點兌換總量不超過 1800 大卡（含資源的大卡）。
 */
var EXCHANGE = (function () {
  'use strict';
  function bad(m) { throw new Error(m); }
  var seq = 0;
  function id() { return 'ex_' + Date.now().toString(36) + '_' + (seq++).toString(36); }
  function dayOf(us) { var d = new Date(Math.floor(us / 1000)); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function role(state, s) { return state.roles.find(function (r) { return r.serial === s; }) || null; }

  // 這一點值多少大卡：發出者在那個版本的比例
  function kcalOf(state, p) {
    var r = role(state, p.from); if (!r) return 0;
    var v = (r.ruleVersions || []).find(function (x) { return String(x.no) === p.ruleVersion; }) || DATA.currentRules(r);
    return p.amount * (v.ratios[p.kind] || 0);
  }
  // 手上還沒用掉的點數，照發出者、種類分組
  function holdings(state, holder) {
    var groups = {};
    state.points.forEach(function (p) {
      if (p.to !== holder || p.spent) return;
      var k = p.from + ':' + p.kind;
      var g = groups[k] || (groups[k] = { issuer: p.from, kind: p.kind, points: [], kcal: 0 });
      g.points.push(p); g.kcal += kcalOf(state, p);
    });
    return Object.keys(groups).map(function (k) { var g = groups[k]; g.points.sort(function (a, b) { return a.atUs - b.atUs; }); return g; });
  }
  // 發出者今天已經發出多少大卡、還剩多少
  function issuedToday(state, issuer, atUs) {
    var day = dayOf(atUs);
    return (state.exchanges || []).filter(function (x) { return x.issuer === issuer && dayOf(x.atUs) === day; }).reduce(function (s, x) { return s + x.kcal; }, 0);
  }
  function remainingToday(state, issuer, atUs) { return Math.max(0, DATA.DAILY_KCAL - issuedToday(state, issuer, atUs)); }

  // 兌換：want = 'energy'（用 n 點換能量）或 {resource: 名稱}（用夠的點換一項資源）
  function exchange(state, req, atUs) {
    atUs = atUs || DATA.nowUs();
    var holder = req.holder, issuer = req.issuer, kind = req.kind;
    if (holder === issuer) bad('自己發給自己的點數沒有價值');
    var r = role(state, issuer); if (!r) bad('沒有這個發出者');
    var g = holdings(state, holder).find(function (x) { return x.issuer === issuer && x.kind === kind; });
    if (!g || !g.points.length) bad('你手上沒有 ' + r.name + ' 發的' + (kind === 'idea' ? '題點' : '戰點'));
    var use = [], kcal = 0, resource = null;
    if (req.resource) {
      resource = DATA.currentRules(r).resources.find(function (x) { return x.name === req.resource; });
      if (!resource) bad(r.name + ' 目前的規則裡沒有「' + req.resource + '」');
      for (var i = 0; i < g.points.length && kcal < resource.kcal; i++) { use.push(g.points[i]); kcal += kcalOf(state, g.points[i]); }
      if (kcal < resource.kcal) bad('點數不夠：「' + resource.name + '」要 ' + resource.kcal + ' 大卡，你的點數只值 ' + kcal + ' 大卡');
      kcal = resource.kcal;                       // 多出來的價值算捐給發出者，不找零
    } else {
      var n = Math.floor(+req.n);
      if (!(n >= 1)) bad('要換幾點？');
      if (n > g.points.length) bad('你只有 ' + g.points.length + ' 點');
      use = g.points.slice(0, n);
      kcal = use.reduce(function (s, p) { return s + kcalOf(state, p); }, 0);
    }
    var left = remainingToday(state, issuer, atUs);
    if (kcal > left) bad(r.name + ' 今天只剩 ' + left + ' 大卡的額度（每天 ' + DATA.DAILY_KCAL + '），這筆要 ' + kcal + ' 大卡，明天再來');
    var x = { id: id(), atUs: atUs, holder: holder, issuer: issuer, kind: kind, pointIds: use.map(function (p) { return p.id; }), n: use.length, kcal: kcal,
              want: resource ? 'resource' : 'energy', resource: resource ? resource.name : null, ruleVersions: use.map(function (p) { return p.ruleVersion; }).filter(function (v, i, a) { return a.indexOf(v) === i; }) };
    use.forEach(function (p) { p.spent = x.id; });
    (state.exchanges = state.exchanges || []).push(x);
    return x;
  }
  // 我能向 issuer 換什麼：能量（每點幾大卡）、資源清單與缺多少
  function offers(state, holder, issuer) {
    var r = role(state, issuer); if (!r) return [];
    var cur = DATA.currentRules(r);
    return holdings(state, holder).filter(function (g) { return g.issuer === issuer; }).map(function (g) {
      return { kind: g.kind, n: g.points.length, kcal: g.kcal, perPoint: cur.ratios[g.kind],
               resources: cur.resources.map(function (x) { return { name: x.name, kcal: x.kcal, enough: g.kcal >= x.kcal }; }) };
    });
  }
  return { exchange: exchange, holdings: holdings, kcalOf: kcalOf, issuedToday: issuedToday, remainingToday: remainingToday, offers: offers, dayOf: dayOf };
})();
if (typeof module !== 'undefined') module.exports = EXCHANGE;
