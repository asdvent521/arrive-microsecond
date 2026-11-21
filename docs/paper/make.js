// 印紙本 PDF：空白和填寫範例，各 4 頁（資源表、事件簿、月曆、公告欄），A4 橫放。
// 用法：node docs/paper/make.js <字型資料夾> <輸出資料夾>
//   字型資料夾放 Noto Serif TC 的 r400.ttf、r700.ttf（從 Google Fonts 下載，不放進 repo）。
//   要有 Playwright 和 Chromium（NODE_PATH 指到裝 playwright 的地方）。
// 欄位照 DESIGN 7-5，網頁版的紙改了欄位，這裡一起改。
var fs = require('fs'), path = require('path');
var FONT = path.resolve(process.argv[2] || '.'), OUT = path.resolve(process.argv[3] || '.');
var CATS = ['食物', '修理', '搬運', '接送', '教學', '諮詢', '陪伴', '照顧', '健康', '借用', '手作', '娛樂'];

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function box(on) { return '<span class="bx' + (on ? ' on' : '') + '"></span>'; }
function fill(v) { return v ? '<span class="w">' + esc(v) + '</span>' : ''; }
function line(v, w) { return '<span class="ln" style="min-width:' + w + 'mm">' + fill(v) + '</span>'; }
function cats(on, sub, withSub) {
  var h = '<div class="cats">' + CATS.map(function (c) { return '<span>' + box(c === on) + c + '</span>'; }).join('') + '</div>';
  return h + (withSub === false ? '' : '<div class="sub">小類 ' + fill(sub) + '</div>');
}
function head(title, note, ex) { return '<div class="hd"><h1>' + title + '</h1><span class="note">' + note + '</span>' + (ex ? '<span class="tag">填寫範例</span>' : '') + '</div>'; }
function leadMark(who) { return '<span class="lead"><b class="' + (who === '我' ? 'on' : '') + '">我</b>／<b class="' + (who === '他' ? 'on' : '') + '">他</b></span>'; }

// ---------- 範例資料（虛構的人） ----------
var EX = {
  res: {
    name: '阿春', bg: '菜園', nature: false, id: 'J27-1', daily: '2000', from: ['10', '14'], cond: '誰都可以', food: false,
    items: [
      { name: '空的', empty: true },
      { name: '醃蘿蔔一罐', kind: '物質', cat: '食物', sub: '農產自種', def: '一罐 500 克', deliver: '本身', price: '199.5', keep: '14', n: 3, used: 1 },
      { name: '青菜一把', kind: '物質', cat: '食物', sub: '農產自種', def: '當天早上摘的一把', deliver: '本身', price: '50.25', keep: '2', n: 5, used: 2 },
      { name: '教你種九層塔', kind: '行為', cat: '教學', sub: '園藝', def: '在菜園教到你自己會換盆', deliver: '一小盆九層塔苗', price: '100', keep: '30', n: 2, used: 0 }
    ],
    problem: '東西當面交；送不到或壞了，改天補一次。醃蘿蔔開罐壞了，拿罐子來換一罐新的。'
  },
  log: {
    date: '10 月 14 日（二）', name: '阿春', daily: '2000',
    rows: [
      { t: '6:00', who: '阿美（花店）', use: '菜園', give: '空的・0', get: '她的空的', lead: '我', why: '一樣多・我來約', res: '成交', left: '2000', sig: '阿美', cash: '不用交' },
      { t: '7:00', who: '李伯（後山）', use: '菜園', give: '青菜一把・50.25', get: '他的一捆柴', keep: '留到 10/16', lead: '我', why: '我給得多・照我的規則', res: '成交', left: '1949.75', sig: '李' },
      { t: '9:30', who: '阿美（花店）', use: '公園', give: '陪走路 30 分・300', get: '她的一盆薄荷', keep: '留到 10/21', lead: '我', why: '我給得多・照我的規則', res: '成交', left: '1649.75', sig: '阿美' },
      { t: '14:00', who: '老林（工具間）', use: '菜園', give: '醃蘿蔔一罐・199.5', get: '他的修雨傘一次', keep: '留到 10/28', lead: '他', why: '他給得多・照他的規則', res: '成交', left: '1450.25', sig: '林' },
      { t: '16:00', who: '小周（相機）', use: '菜園', give: '—', get: '—', lead: '', why: '', res: '沒來', left: '1450.25', sig: '' }
    ],
    cashed: [
      { day: '10 月 10 日', who: '李伯（後山）J5-1', what: '剪頭髮一次・交：一張理髮卡', sig: '李', prob: '' },
      { day: '10 月 12 日', who: '阿美（花店）J31-1', what: '一束花・交：本身', sig: '美', prob: '花有一半謝了，她說下次補一束' }
    ]
  },
  cal: {
    y: '2026', m: '10', name: '阿春', deals: '13', first: 4, days: 31,
    cells: { 1: ['6:00 阿美'], 3: ['6:00 阿美', '10:00 老林'], 5: ['6:00 阿美'], 7: ['6:00 阿美', '15:00 小周'], 8: ['6:00 阿美'], 10: ['6:00 阿美', '9:00 李伯'], 12: ['6:00 阿美'], 13: ['16:00 小周（沒來）'], 14: ['6:00 阿美', '7:00 李伯', '9:30 阿美', '還有 2 筆'], 15: ['6:00 阿美'], 17: ['18:30 阿美（約）'], 20: ['9:00 老林（約）'] },
    deal: [1, 3, 5, 7, 8, 10, 12, 14, 15]
  },
  board: {
    place: '里民活動中心', date: '10 月 14 日',
    rows: [
      { id: 'J31-1', name: '阿美（花店）', need: '有人陪我去市場提菜', cat: '搬運', give: '自家青菜一把', until: '11/13', when: '每天 18:30 市場口' },
      { id: 'J102-2', name: '小周（相機）', need: '想學醃菜', cat: '教學', give: '手機拍照教學', until: '11/10', when: '週六下午 活動中心' },
      { id: 'J8-1', name: '老林（工具間）', need: '雨傘骨架零件', cat: '修理', give: '修雨傘一次', until: '10/30', when: '每天早上 公園涼亭' }
    ]
  }
};

// ---------- 四頁 ----------
function resPage(ex) {
  var d = ex ? EX.res : { items: [{ name: '空的', empty: true, pre: true }] }, N = 8;
  var top = '<div class="row">名字 ' + line(d.name, 26) + '（生產背景 ' + line(d.bg, 26) + '）' + box(d.nature) + '自然<span class="gap"></span>角色編號 ' + line(d.id, 22) + '<span class="gap"></span>每天最多給 ' + line(d.daily, 34) + ' 點<span class="gap"></span>從 ' + line(d.from && d.from[0], 9) + ' 月 ' + line(d.from && d.from[1], 9) + ' 日起</div>' +
    '<div class="row">只跟這樣的人換（不寫＝誰都可以）' + line(d.cond, 90) + '<span class="gap"></span>' + box(d.food) + '對方要有食物<span class="small">　生產背景：這個角色用什麼生產，最多 6 個字，寫在名字後面的括弧；田、河、後山這類自然界勾「自然」。每天最多給：所有角色共用，每張寫一樣的。</span></div>';
  var rows = '';
  for (var i = 0; i < N; i++) {
    var it = d.items[i] || {}, kinds = ['訊息', '行為', '物質'];
    var kind = it.empty ? '<span class="muted">（空的不用勾）</span>' : kinds.map(function (k) { return '<span>' + box(it.kind === k) + k + '</span>'; }).join(' ');
    var cat = it.empty ? '<span class="muted">（空的不掛）</span>' : cats(it.cat, it.sub);
    var def = it.empty ? '什麼都不給<div class="dl">空的・不用交</div>' : fill(it.def) + '<div class="dl">交：' + fill(it.deliver) + '</div>';
    var grid = '';
    if (it.empty) grid = '<span class="muted">—</span>';
    else if (it.n) { for (var k = 0; k < it.n; k++) grid += '<span class="cell' + (k < (it.used || 0) ? ' x' : '') + '"></span>'; }
    rows += '<tr><td class="c">' + (i + 1) + '</td><td>' + (it.pre ? esc(it.name) : fill(it.name)) + '</td><td class="kinds">' + kind + '</td><td>' + cat + '</td><td>' + def + '</td><td class="num">' + (it.empty ? (it.pre ? '0' : fill('0')) : fill(it.price)) + '</td><td class="c">' + (it.empty ? '—' : fill(it.keep)) + '</td><td class="grid">' + grid + '</td></tr>';
  }
  var table = '<table class="res"><colgroup><col style="width:5%"><col style="width:13%"><col style="width:15%"><col style="width:22%"><col style="width:19%"><col style="width:11%"><col style="width:6%"><col style="width:9%"></colgroup>' +
    '<thead><tr><th>#</th><th>東西</th><th>種類<small>訊息／行為／物質</small></th><th>類別<small>勾大類，寫小類</small></th><th>怎樣算給到了<small>下面寫綁的實體：交什麼</small></th><th>價錢<small>點，到小數點後 6 位</small></th><th>保留幾天<small>沒寫就一直留</small></th><th>有幾份<small>選走就劃掉一格</small></th></tr></thead><tbody>' + rows + '</tbody></table>';
  var prob = '<div class="prob"><b>出問題怎麼辦</b><span class="small">（一定要寫；你當主動方時照這一段，對方簽名前先看）</span><div class="pbody">' + fill(d.problem) + '</div></div>';
  var foot = '<div class="foot"><b>一個角色一張</b>：工作和興趣這種想分開的東西，各開一個角色、各寫一張，每張的角色編號不一樣（J27-1、J27-2）。<b>交</b>：給出去的東西一定是實體，或綁一樣實體（勾物質的寫「本身」），對方拿到它就算給到了；空的不用交。<b>不能寫</b>：錢、禮券、儲值卡這些等同錢的東西，和違法的東西。<b>空的</b>：想只收不給時給對方選，每個角色都要有一份。<b>有幾份</b>：別人選走一份就劃掉一格，格子劃完就給不出去了。</div>';
  return '<section class="page">' + head('資源表', '一個角色一張・改了就重寫一張，隔天才算', ex) + top + table + prob + foot + '</section>';
}

function logPage(ex) {
  var d = ex ? EX.log : { rows: [], cashed: [] }, N = 7, M = 3;
  var top = '<div class="row">日期 ' + line(d.date, 40) + '<span class="gap"></span>名字 ' + line(d.name, 30) + '<span class="gap"></span>今天最多給 ' + line(d.daily, 30) + ' 點<span class="small">（所有角色共用）</span><span class="small">　一個人一張，所有角色的見面寫在一起</span></div>';
  var rows = '';
  for (var i = 0; i < N; i++) {
    var r = d.rows[i] || {};
    rows += '<tr><td class="c">' + fill(r.t) + '</td><td>' + fill(r.who) + '<div class="sm">我用（' + (r.use ? fill(r.use) : '<span class="blank"></span>') + '）</div></td><td>' + fill(r.give) + '</td><td>' + fill(r.get) + (r.keep ? '<div class="sm">' + fill(r.keep) + '</div>' : '<div class="sm">留到 <span class="blank"></span></div>') + '</td><td class="c">' + leadMark(r.lead) + '<div class="sm">' + fill(r.why) + '</div></td><td class="c">' + fill(r.res) + '</td><td class="num">' + fill(r.left) + '</td><td class="c">' + fill(r.sig) + '</td><td>' + fill(r.cash) + '</td></tr>';
  }
  var table = '<table class="log"><colgroup><col style="width:6%"><col style="width:15%"><col style="width:15%"><col style="width:16%"><col style="width:12%"><col style="width:8%"><col style="width:10%"><col style="width:8%"><col style="width:10%"></colgroup>' +
    '<thead><tr><th>時間</th><th>跟誰<small>他的名字（生產背景）・我用哪個角色</small></th><th>我給他<small>他選了我的什麼・價錢</small></th><th>我收到<small>我選了他的什麼・保留到哪天</small></th><th>主動<small>圈給得多的；一樣多圈來約的</small></th><th>結果<small>成交／沒成／沒來</small></th><th>今天還剩<small>點</small></th><th>對方簽名</th><th>兌現<small>哪天・對方簽名</small></th></tr></thead><tbody>' + rows + '</tbody></table>';
  var crow = '';
  for (var j = 0; j < M; j++) { var c = d.cashed[j] || {}; crow += '<tr><td>' + fill(c.day) + '</td><td>' + fill(c.who) + '</td><td>' + fill(c.what) + '</td><td class="c">' + fill(c.sig) + '</td><td>' + fill(c.prob) + '</td></tr>'; }
  var cash = '<div class="lab">今天兌現的（以前收到的東西，實體到手才簽）</div><table class="cash"><colgroup><col style="width:12%"><col style="width:18%"><col style="width:30%"><col style="width:10%"><col style="width:30%"></colgroup><thead><tr><th>哪天收到的</th><th>誰的<small>名字（生產背景）・角色編號</small></th><th>什麼東西・交什麼</th><th>對方簽名</th><th>出問題<small>寫一句話，照主動方的「出問題怎麼辦」處理</small></th></tr></thead><tbody>' + crow + '</tbody></table>';
  var foot = '<div class="foot"><b>跟自然換</b>：就是跟勾了「自然」的角色換（例如李伯（後山）），跟一般的換一樣寫一行。<b>成交</b>：在約好的時間見面，兩邊都選了對方一樣東西才算。<b>主動</b>：誰給的價錢多就圈誰，一樣多圈來約的人；互簽就是同意照主動方的規則（被動方先看主動方資源表最下面的「出問題怎麼辦」）。<b>今天還剩</b>：每成交一次扣掉對方選的那樣東西的價錢，沒給完的點隔天不留。<b>簽名</b>：兩人都在對方的事件簿那一行簽，誰都不能自己亂寫。空的不用兌現，兌現格寫「不用交」。</div>';
  return '<section class="page">' + head('事件簿', '一天一張・照時間往下寫・舊的收在一起就是日曆', ex) + top + table + cash + foot + '</section>';
}

function calPage(ex) {
  var d = ex ? EX.cal : { cells: {}, deal: [] };
  var top = '<div class="row">' + line(d.y, 18) + ' 年 ' + line(d.m, 10) + ' 月<span class="gap"></span>名字 ' + line(d.name, 30) + '<span class="gap"></span>這個月成交 ' + line(d.deals, 14) + ' 次</div>';
  var body = '<tr>' + '日一二三四五六'.split('').map(function (w) { return '<th>' + w + '</th>'; }).join('') + '</tr>';
  for (var wk = 0; wk < 6; wk++) {
    body += '<tr>';
    for (var wd = 0; wd < 7; wd++) {
      var n = wk * 7 + wd - (ex ? d.first : 99) + 1, has = ex && n >= 1 && n <= d.days;
      var deal = has && d.deal.indexOf(n) >= 0;
      body += '<td>' + (has ? '<span class="dn">' + n + '</span>' + (deal ? '<span class="corner"></span>' : '') + (d.cells[n] || []).map(function (s) { return '<div class="ev">' + fill(s) + '</div>'; }).join('') : '') + '</td>';
    }
    body += '</tr>';
  }
  var foot = '<div class="foot"><b>寫法</b>：一格一天，寫幾點跟誰（還沒到的寫「（約）」），放不下寫「還有 N 筆」。<b>成交</b>就把那一格右上角塗滿，一眼看得出這個月換了幾次。</div>';
  return '<section class="page">' + head('月曆', '一個月一張・選用・一格一天', ex) + top + '<table class="cal">' + body + '</table>' + foot + '</section>';
}

function boardPage(ex) {
  var d = ex ? EX.board : { rows: [] }, N = 10;
  var top = '<div class="row">地點 ' + line(d.place, 60) + '<span class="gap"></span>貼出日期 ' + line(d.date, 40) + '</div>';
  var rows = '';
  for (var i = 0; i < N; i++) { var r = d.rows[i] || {}; rows += '<tr><td>' + fill(r.id) + '</td><td>' + fill(r.name) + '</td><td>' + fill(r.need) + '</td><td>' + cats(r.cat, '', false) + '</td><td>' + fill(r.give) + '</td><td class="c">' + fill(r.until) + '</td><td>' + fill(r.when) + '</td></tr>'; }
  var table = '<table class="board"><colgroup><col style="width:8%"><col style="width:13%"><col style="width:18%"><col style="width:19%"><col style="width:16%"><col style="width:7%"><col style="width:19%"></colgroup><thead><tr><th>角色編號</th><th>名字<small>（生產背景）</small></th><th>需要</th><th>類別<small>勾一個大類</small></th><th>可以給<small>從那個角色的資源表挑</small></th><th>期限<small>最多一個月</small></th><th>可以約的時間・地點</th></tr></thead><tbody>' + rows + '</tbody></table>';
  var foot = '<div class="foot"><b>怎麼用</b>：看到你能幫上忙的，就照「可以約的時間」去找他，見面時各自在自己的事件簿寫一行、互簽。<b>角色編號</b>：寫你掛這張用的那個角色（例如 J27-2），名字後面括弧寫它的生產背景。<b>期限</b>：最多一個月，要續就重寫一行。<b>類別</b>：需要的那一樣勾哪個大類，找的人一眼看得到。成交了，掛的人自己劃掉那一行。</div>';
  return '<section class="page">' + head('公告欄', '貼在社區布告欄・誰都可以寫一行・成交了就劃掉', ex) + top + table + foot + '</section>';
}

function html(ex) {
  var css = fs.readFileSync(path.join(__dirname, 'paper.css'), 'utf8').replace(/FONTDIR/g, 'file://' + FONT);
  return '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><style>' + css + '</style></head><body class="' + (ex ? 'ex' : '') + '">' + resPage(ex) + logPage(ex) + calPage(ex) + boardPage(ex) + '</body></html>';
}

(async function () {
  var pw = require('playwright'), browser = await pw.chromium.launch();
  var pg = await browser.newPage();
  await pg.route('http*://**', function (r) { r.abort(); });   // 不連外：字型從本機資料夾讀
  for (var ex of [false, true]) {
    var f = path.join(OUT, ex ? 'paper-ex.html' : 'paper-blank.html');
    fs.writeFileSync(f, html(ex));
    await pg.goto('file://' + f);
    await pg.evaluate(function () { return document.fonts.ready; });
    var over = await pg.evaluate(function () { return Array.from(document.querySelectorAll('.page')).map(function (p) { return p.scrollHeight > p.clientHeight + 1 ? p.querySelector('h1').textContent + ' 超出 ' + (p.scrollHeight - p.clientHeight) + 'px' : ''; }).filter(Boolean); });
    if (over.length) console.log('注意：', over.join('、'));
    await pg.pdf({ path: path.join(OUT, ex ? '達秒紙本-範例.pdf' : '達秒紙本-空白.pdf'), format: 'A4', landscape: true, printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
    console.log('ok', ex ? '範例' : '空白');
  }
  await browser.close();
})();
