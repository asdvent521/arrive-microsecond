// 三年份的資料（測試用）：X 開 1100 天的時段，Y、Z 都來約、都確認到達、兩兩選對方的空的 → 1100 個判過的時段、3300 筆對接。
// 在 node 和瀏覽器裡都用同一段（傳 CORE 進來）。
function bulk(C, state, days, now) {
  days = days || 1100; now = now || C.nowUs();
  var D = C.DAY_US, born = now - (days + 1) * D;
  var mk = function (serial, name) { return C.createRole(state, { serial: serial, name: name, dailyPoints: 1000, rules: {}, resources: [{ id: 'e' + serial.slice(-2), name: name + '的空的', price: 0, keepDays: 1, avail: 99999 }] }, born); };
  var X = mk('00000000071', '三年甲'), Y = mk('00000000072', '三年乙'), Z = mk('00000000073', '三年丙');
  var E = function (r) { return 'e' + r.serial.slice(-2); };
  for (var i = 0; i < days; i++) {
    var at = born + (i + 1) * D + 3600e6 * 12;
    var s = C.addSlot(state, X.serial, at, 3, null, at - 7200e6);
    C.book(state, Y.serial, s.id, at - 3600e6); C.book(state, Z.serial, s.id, at - 3600e6);
    [X, Y, Z].forEach(function (a) { [X, Y, Z].forEach(function (b) { if (a !== b) C.setWants(state, s.id, a.serial, b.serial, [E(b)]); }); });
    C.judge(state, at + 1);
  }
  C.expire(state, now);
  return { X: X.serial, Y: Y.serial, Z: Z.serial };
}
if (typeof module !== 'undefined') module.exports = { bulk: bulk, source: bulk.toString() };
