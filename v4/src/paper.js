/* ===================== 紙本 ===================== */
const ptBoxes = () => `<span class="fill" style="min-width:16mm"></span> 年 <span class="fill"></span> 月 <span class="fill"></span> 日 <span class="fill"></span> 時 <span class="fill"></span> 分 <span class="fill"></span> 秒 ` + '<span class="box"></span>'.repeat(6) + ' 微秒';
function page(title, inner, sec, no) {
  return `<section class="page">${title ? `<h2>${title}</h2>` : ''}${inner}<div class="foot"><span>到達那微秒｜${sec}</span><span>${no ? '第 ' + no + ' 頁' : ''}</span></div></section>`;
}
function blankTable(headers, n, tall) {
  return `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${`<tr>${headers.map(() => `<td class="${tall ? 'tall' : ''}">&nbsp;</td>`).join('')}</tr>`.repeat(n)}</tbody></table>`;
}
const HANDBOOK = [
  ['封面', () => `<div class="cover"><div class="big">到達那微秒</div><p style="font-size:15pt;margin-top:8mm">一款拿真實難題當關卡的合作遊戲</p><p style="margin-top:20mm">角色名稱：<span class="fill" style="min-width:70mm"></span></p><p>出生年月：<span class="fill" style="min-width:25mm"></span> 年 <span class="fill"></span> 月</p><p style="margin-top:14mm;font-size:11pt">這本手冊只給你自己看。要給別人看的規則表，在活頁單張裡。</p></div>`],
  ['遊戲說明與用語', () => `<p>難題是真的，隊友是真的。怎麼合作、怎麼算分，由玩家自己訂規則。</p>
    <table><tbody>
    <tr><th style="width:26mm">難題</th><td>你無法處理的情況。往後要為它付出多少熱量，還是未知數。</td></tr>
    <tr><th>挑戰</th><td>把未知變成已知的方法。難題拆解後的每個步驟就是一個挑戰。</td></tr>
    <tr><th>完成</th><td>難題被處理到「能算出往後需消耗的熱量」。</td></tr>
    <tr><th>出發點</th><td>你親手定下、精確到微秒的開始時刻。對自己是承諾，對熟人是暗號。</td></tr>
    <tr><th>常用尾數</th><td>你固定使用的秒數與微秒。熟人知道它，就能一直跟你對上。</td></tr>
    <tr><th>主體</th><td>第一個寫下出發點的角色。每融合一人，那人就加入主體。</td></tr>
    <tr><th>對接條件</th><td>寫在難題上，決定誰能排隊加入。只看對方的規則表。</td></tr>
    <tr><th>對接</th><td>主體和下一位比對規則表，談妥共同規則。談不攏就不合作。</td></tr>
    <tr><th>共同規則</th><td>主體所有成員共用的規則，至少包含僵局處理、解釋權、排隊規則。</td></tr>
    <tr><th>時間節點</th><td>每個挑戰的時間點，不可早於出發點。執行者就是負責角色。</td></tr>
    <tr><th>題點</th><td>寫出能用的挑戰時獲得，由執行者發給你。</td></tr>
    <tr><th>戰點</th><td>完成挑戰時獲得，由寫出挑戰的人發給你。</td></tr>
    <tr><th>能量點</th><td>點數兌換的對象，代表一個人一天的熱量。每人每天最多分給別人 ${DAILY_CAP} 大卡。</td></tr>
    <tr><th>解釋權</th><td>規則文字有歧義時，由誰決定怎麼解釋。</td></tr>
    </tbody></table><p style="margin-top:4mm"><b>出發點就是你開始挑戰的那一刻。</b></p>`],
  ['流程說明', () => `<ol style="padding-left:6mm">
    <li>建立角色，寫下出生年月，填好規則表。</li>
    <li>在人生行事歷記下難題發生的時間，並填進難題表。</li>
    <li>為難題寫下出發點。和熟人約好同一個出發點，就會碰撞。</li>
    <li>碰撞後，第一個寫下的人是主體，其他人依寫下的先後排隊。不符合難題對接條件的人，出發點不成立。排隊前可以先看主體的規則與對接條件。</li>
    <li>主體一次只和一位對接：先談共同規則，再把難題融合。主體多人時，所有決定都要全員同意。</li>
    <li>出發點一到，融合結束；還在排隊的人自動退出。主體只有一人時，難題擱置。</li>
    <li>把融合後的難題拆成挑戰。每個挑戰由兩位不同的成員合作，並談好題點、戰點數量。</li>
    <li>執行者接下挑戰時發出題點；雙方判定完成時，寫出者發出戰點。有爭議依共同規則。</li>
    <li>所有挑戰完成後，每位成員寫下自己往後需消耗的熱量，全部寫完才算完成。</li>
    <li>要用資源時，填兌換預約單。兌現日前一天結束時截止，依對方的兌換優先排序核准。</li>
    <li>任何時候都可以退出。退出前，先處理完你已提交的判定。</li></ol>
    <p>把紙本交給會用網站的人代為登錄時，表號與欄位名稱都和網站一致。出發點以代登者送出的時間判定先後。</p>`],
  ['規則公式的寫法與範例', () => `<p>凡是影響能量點的規則，都要寫成能算出確定數字的公式。同樣的輸入，一定得到同樣的結果。</p>
    <table><tbody><tr><th style="width:50%">不能生效</th><th>可以生效</th></tr>
    <tr><td>表現好的話，我會多給一點。</td><td>每 10 題點換 50 大卡；合作滿 30 天後，每 10 題點換 60 大卡。</td></tr>
    <tr><td>看情況決定誰先換。</td><td>預約依合作天數由多到少排序；天數相同時，先預約者優先。</td></tr>
    <tr><td>看起來可靠的人才能找到我。</td><td>對方的題點每點可換大卡，大於等於 4。</td></tr></tbody></table>
    <h2 style="margin-top:8mm">填空練習</h2>
    <p>題點兌換：每 <span class="fill"></span> 點換 <span class="fill"></span> 大卡</p>
    <p>題點函數：合作每滿 <span class="fill"></span> 天，比例提高 <span class="fill"></span> %，最多提高 <span class="fill"></span> %</p>
    <p>資源：<span class="fill" style="min-width:50mm"></span>，需要 <span class="fill"></span> 大卡</p>
    <p>疊加：□ 可以合併多批點數兌現一個資源　□ 不可以</p>`],
  ['人生行事歷（0–49 歲）', () => lifePaper(0, 49)],
  ['人生行事歷（50–99 歲）', () => lifePaper(50, 99)],
  ['表 I　難題表', () => blankTable(['難題編號', '適用規則', '名稱', '情況', '目標', '參與角色', '發生時間', '出發點', '狀態', '對接條件'], 9, true)],
  ['對接條件填寫頁', () => `<p>每個難題可以設定對接條件，決定誰能排隊加入。條件只看對方的規則表，多條須全部符合。不填代表所有碰撞者都能排隊。</p>
    <table><tbody><tr><th style="width:26mm">難題編號</th><td></td><th style="width:22mm">難題名稱</th><td></td></tr></tbody></table>
    ${[1, 2, 3, 4, 5].map(i => `<p style="margin-top:4mm">${i}. □ 題點每點可換大卡　□ 戰點每點可換大卡　□ 可疊加　□ 資源清單包含「<span class="fill" style="min-width:28mm"></span>」　□ 資源項目數　□ 規則版本維持天數　□ 僵局處理與主體相同　□ 與主體的合作天數<br>　□ 大於等於　□ 小於等於　□ 等於　<span class="fill"></span>　　主體成員：□ 每一位　□ 任一位</p>`).join('')}
    <p style="margin-top:6mm;font-size:11pt">例：題點每點可換大卡　大於等於　30。碰撞時與對接時各檢查一次，不符合的人出發點不成立。</p>`],
  ['常用尾數紀錄（私人）', () => `<p>和誰約好的尾數，只寫在這裡，不要寫在規則表上。</p><table><thead><tr><th style="width:40mm">秒</th><th>微秒（六位數）</th><th>和誰約好</th></tr></thead><tbody>${`<tr><td class="tall"></td><td>${'<span class="box"></span>'.repeat(6)}</td><td></td></tr>`.repeat(10)}</tbody></table>`]
];
function lifePaper(a0, a1) {
  let g = `<div class="life-p"><div><b>歲</b></div>${[...Array(12)].map((_, i) => `<div><b>${i + 1}</b></div>`).join('')}`;
  for (let a = a0; a <= a1; a++) g += `<div>${a}</div>` + '<div></div>'.repeat(12);
  return `<p style="font-size:10pt">每一列是一個年齡，每一格是一個月。發生難題的月份畫一個點；寫下出發點後，在點旁畫一個箭頭。</p>${g}</div>`;
}
function multiCopy(title, rowsHtml, copies) {
  return copies.map((c, i) => `<div class="copy"><div style="display:flex;justify-content:space-between"><b>${title}</b><span>第 ${i + 1} 聯：${c}</span></div>${rowsHtml}</div>${i < copies.length - 1 ? '<div class="cut">沿虛線剪開，各自保存</div>' : ''}`).join('');
}
const LOOSE = [
  ['表 X　角色登記表', () => blankTable(['角色編號', '名稱', '所屬帳號', '出生年月'], 14, true)],
  ['表 II　規則表', () => `<p style="font-size:10pt">每個角色一張。這張可以給別人看，唯「可見條件」只給符合條件的人看。</p><table><tbody>
    <tr><th style="width:30mm">規則編號</th><td></td><th style="width:22mm">角色</th><td></td></tr>
    <tr><th>題點兌換</th><td colspan="3">每 <span class="fill"></span> 點換 <span class="fill"></span> 大卡</td></tr>
    <tr><th>戰點兌換</th><td colspan="3">每 <span class="fill"></span> 點換 <span class="fill"></span> 大卡</td></tr>
    <tr><th>題點函數</th><td colspan="3">□ 不變　□ 合作每滿 <span class="fill"></span> 天，提高 <span class="fill"></span> %，最多 <span class="fill"></span> %</td></tr>
    <tr><th>戰點函數</th><td colspan="3">□ 不變　□ 合作每滿 <span class="fill"></span> 天，提高 <span class="fill"></span> %，最多 <span class="fill"></span> %</td></tr>
    <tr><th>疊加</th><td colspan="3">□ 可以合併多批點數兌現一個資源　□ 不可以</td></tr>
    <tr><th>資源</th><td colspan="3">1. <span class="fill" style="min-width:45mm"></span> <span class="fill"></span> 大卡　2. <span class="fill" style="min-width:45mm"></span> <span class="fill"></span> 大卡<br>3. <span class="fill" style="min-width:45mm"></span> <span class="fill"></span> 大卡　4. <span class="fill" style="min-width:45mm"></span> <span class="fill"></span> 大卡</td></tr>
    <tr><th>兌換優先</th><td colspan="3">□ 依預約先後　□ 合作天數多者優先　□ 所需能量點少者優先</td></tr>
    <tr><th>僵局處理</th><td colspan="3">□ 找第三方仲裁　□ 擱置　□ 重新拆解　□ 自訂：<span class="fill" style="min-width:40mm"></span></td></tr>
    <tr><th>退出處理</th><td colspan="3">□ 難題擱置　□ 由排隊第一位接手成為主體</td></tr>
    <tr><th>排隊規則</th><td colspan="3">最多 <span class="fill"></span> 位，每位最多等 <span class="fill"></span> 天</td></tr>
    <tr><th>解釋權</th><td colspan="3">□ 規則發出者　□ 雙方共同　□ 第三方：<span class="fill" style="min-width:40mm"></span></td></tr>
    <tr><th>可見條件</th><td colspan="3">1. <span class="fill" style="min-width:40mm"></span> □大於等於 □小於等於 □等於 <span class="fill"></span><br>2. <span class="fill" style="min-width:40mm"></span> □大於等於 □小於等於 □等於 <span class="fill"></span></td></tr>
    </tbody></table>`],
  ['表 III　規則版本表', () => blankTable(['版本號', '角色', '日期', '規則紀錄（該版完整設定）'], 12, true)],
  ['表 IV　對接紀錄表（三聯）', () => multiCopy('對接紀錄', `<table><tbody><tr><th style="width:26mm">對接編號</th><td></td><th style="width:18mm">輪次</th><td></td></tr><tr><th>出發點</th><td colspan="3">${ptBoxes()}</td></tr>
    <tr><th>主體成員</th><td colspan="3"></td></tr><tr><th>對接角色</th><td></td><th>日期</th><td></td></tr><tr><th>當輪對接條件</th><td colspan="3" class="tall"></td></tr><tr><th>共同規則</th><td colspan="3" class="tall">僵局處理：　　　　解釋權：　　　　排隊：最多　位，等　天</td></tr>
    <tr><th>結果</th><td colspan="3">□ 合作　□ 不合作　　全員簽名：</td></tr></tbody></table>`, ['主體保存', '對接角色保存', '代登用'])],
  ['表 V　融合紀錄表（三聯）', () => multiCopy('融合紀錄', `<table><tbody><tr><th style="width:30mm">融合編號</th><td></td><th style="width:24mm">對接編號</th><td></td></tr><tr><th>融合前難題</th><td colspan="3" class="tall"></td></tr>
    <tr><th>融合後難題</th><td colspan="3" class="tall"></td></tr><tr><th>融合後主體成員</th><td colspan="3"></td></tr><tr><th>融合後對接條件</th><td colspan="3" class="tall"></td></tr><tr><th>日期</th><td colspan="3"></td></tr></tbody></table>`, ['主體保存', '新加入者保存', '代登用'])],
  ['表 VI　拆解時間節點表', () => blankTable(['難題編號', '步驟', '挑戰內容', '時間節點（到微秒）', '寫出挑戰的角色', '執行角色（負責角色）', '題點數量', '戰點數量', '狀態'], 10, true)],
  ['表 VII　難題熱量表', () => blankTable(['難題編號', '角色', '往後需消耗熱量（大卡）'], 16, true)],
  ['表 VIII　點數紀錄簿', () => blankTable(['點數批號', '類型', '發出者', '持有者', '數量', '剩餘數量', '發出版本號', '發出日期', '來源挑戰'], 16, true)],
  ['表 IX　兌換預約單', () => [1, 2].map(() => `<div class="copy"><table><tbody><tr><th style="width:28mm">預約編號</th><td></td><th style="width:24mm">預約時間</th><td></td></tr>
    <tr><th>持有者</th><td></td><th>發出者</th><td></td></tr><tr><th>兌現日</th><td></td><th>兌現資源</th><td></td></tr><tr><th>所需能量點</th><td colspan="3"><span class="fill"></span> 大卡</td></tr>
    <tr><th>使用點數明細</th><td colspan="3" class="tall">批號／數量／採用版本（發出版本或當前版本）<br><br></td></tr><tr><th>疊加</th><td>□ 是 □ 否</td><th>結果</th><td>□ 核准 □ 未核准</td></tr></tbody></table></div>`).join('<div class="cut">沿虛線剪開</div>')]
];
function statementHtml(rid, from, to, blank) {
  const head = `<table><tbody><tr><th style="width:28mm">角色</th><td>${blank ? '' : esc(roleName(rid))}</td><th style="width:22mm">期間</th><td>${blank ? '<span class="fill"></span> ～ <span class="fill"></span>' : esc(fmtDay(from)) + ' ～ ' + esc(fmtDay(to))}</td></tr></tbody></table>`;
  if (blank) return head + `<h2 style="margin-top:6mm">持有的點數</h2>${blankTable(['點數批號', '類型', '發出者', '剩餘數量', '發出版本號'], 6)}
    <h2 style="margin-top:6mm">兌換預約紀錄</h2>${blankTable(['兌現日', '發出者', '資源', '所需能量點', '點數批號與採用版本', '疊加', '結果'], 6)}
    <h2 style="margin-top:6mm">每日分出的能量點</h2>${blankTable(['日期', '已核准分出', `上限 ${DAILY_CAP}`], 5)}`;
  const held = DB.list('batches', b => b.holder === rid);
  const bks = DB.list('bookings', b => b.holder === rid && b.day >= from && b.day <= to);
  const out = DB.list('bookings', b => b.issuer === rid && b.result === '核准' && b.day >= from && b.day <= to);
  const days = [...new Set(out.map(b => b.day))].sort((a, b) => a - b);
  const bal = {}; held.forEach(b => { const k = roleName(b.issuer) + ' 的' + b.type; bal[k] = (bal[k] || 0) + b.remaining; });
  const t = (h, rows) => `<table><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${h.length}">期間內沒有資料</td></tr>`}</tbody></table>`;
  return head + `<h2 style="margin-top:6mm">持有的點數（各批）</h2>` + t(['點數批號', '類型', '發出者', '數量', '剩餘', '凍結', '發出版本號'], held.map(b => [b.id.slice(-6), b.type, esc(roleName(b.issuer)), b.n, b.remaining, b.frozen, 'v' + b.version])) +
    `<h2 style="margin-top:6mm">兌換預約紀錄</h2>` + t(['兌現日', '發出者', '資源', '所需能量點', '使用點數（批號／數量／版本）', '疊加', '結果'], bks.map(b => [fmtDay(b.day), esc(roleName(b.issuer)), esc(b.resource), b.cost, b.uses.map(u => `${u.batchId.slice(-6)}／${u.n}／v${u.versionNo}`).join('<br>'), b.stack ? '是' : '否', b.result])) +
    `<h2 style="margin-top:6mm">目前餘額</h2>` + t(['點數來源', '剩餘可用'], Object.entries(bal).map(([k, v]) => [esc(k), v])) +
    `<h2 style="margin-top:6mm">每日分出的能量點</h2>` + t(['日期', '已核准分出', '上限'], days.map(d => [fmtDay(d), out.filter(b => b.day === d).reduce((s, b) => s + b.cost, 0) + ' 大卡', DAILY_CAP + ' 大卡']));
}
function buildPages(kind, opts) {
  if (kind === 'handbook') return HANDBOOK.map(([t, f], i) => page(i === 0 ? '' : t, f(), '個人手冊', i + 1)).join('');
  if (kind === 'loose') return LOOSE.map(([t, f]) => page(t, f(), '活頁單張')).join('');
  if (kind.startsWith('loose:')) { const it = LOOSE[+kind.split(':')[1]]; return page(it[0], it[1](), '活頁單張'); }
  if (kind === 'statement') return page('對帳單', statementHtml(opts.role, opts.from, opts.to, false), '對帳單');
  if (kind === 'statementBlank') return page('對帳單（手寫版）', statementHtml(null, 0, 0, true), '對帳單');
  return '';
}
function viewPaper() {
  const r = me(); const now = Clock.now();
  return `<section class="sec"><h2>紙本</h2><p class="small muted">給不會使用網路的人。表號與欄位名稱都和網站一致，方便由他人代為登錄。字比較大，格子也夠寫。</p>
    <div class="note">列印時選 A4、邊界設為「無」。手機上可在列印畫面選「存成 PDF」。如果這裡無法直接列印，可以下載列印檔，用瀏覽器打開後再列印。</div></section>
    <section class="sec"><h3>個人手冊（可裝訂成書）</h3><p class="small muted">頁序：${HANDBOOK.map((h, i) => `${i + 1}. ${h[0]}`).join('　')}。依頁碼疊好，用長尾夾或騎馬釘裝訂。</p>
    <div class="row"><button class="btn" data-act="pvw" data-k="handbook">預覽</button><button class="btn pri" data-act="prt" data-k="handbook">列印</button><button class="btn" data-act="dlp" data-k="handbook">下載列印檔</button></div></section>
    <section class="sec"><h3>活頁單張</h3><div class="paper-list">${LOOSE.map((l, i) => `<div class="paper-item"><b>${l[0]}</b><div class="row" style="margin-top:8px"><button class="btn sm" data-act="pvw" data-k="loose:${i}">預覽</button><button class="btn sm pri" data-act="prt" data-k="loose:${i}">列印</button></div></div>`).join('')}</div>
    <div class="row" style="margin-top:10px"><button class="btn" data-act="prt" data-k="loose">全部列印</button><button class="btn" data-act="dlp" data-k="loose">下載全部列印檔</button></div></section>
    <section class="sec"><h3>對帳單</h3><form class="grid2" onsubmit="return false" id="stF">
      <label class="f"><span>角色</span><select name="role">${roleOptions(DB.list('roles', x => x.accountId === role(r).accountId).map(x => x.id), r)}</select></label>
      <label class="f"><span>起日</span><input type="date" name="from" value="${fmtDay(addDays(now, -60))}"></label><label class="f"><span>迄日</span><input type="date" name="to" value="${fmtDay(addDays(now, 30))}"></label></form>
    <div class="row"><button class="btn" data-act="pvw" data-k="statement">預覽</button><button class="btn pri" data-act="prt" data-k="statement">列印</button><button class="btn" data-act="pvw" data-k="statementBlank">空白手寫版</button><button class="btn" data-act="prt" data-k="statementBlank">列印空白版</button></div></section>
    <section class="sec" id="pvSec" ${UI.paper ? '' : 'hidden'}><div class="sec-h"><h3>預覽</h3><button class="btn sm" data-act="pvClose">收起</button></div><div class="preview-wrap"><div id="preview">${UI.paper ? buildPages(UI.paper.k, UI.paper.o) : ''}</div></div></section>`;
}
function statementOpts() { const f = $('#stF'); if (!f) return null; const v = formVals(f); const d = s => { const [y, m, dd] = s.split('-').map(Number); return usFrom({ y, mo: m, d: dd }); }; return { role: v.role, from: d(v.from), to: d(v.to) + DAY - 1 }; }
function printPages(html) {
  $('#print').innerHTML = html; document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  try { window.print(); } catch (e) { done(); alertBox('無法直接列印', '這個環境不允許直接列印，請改用「下載列印檔」。'); }
  setTimeout(() => { if (document.body.classList.contains('printing')) done(); }, 60000);
}
function standaloneHtml(html) {
  const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
  return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>到達那微秒 紙本</title><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700&family=Noto+Serif+TC:wght@700&display=swap" rel="stylesheet"><style>${css}
body{background:#ddd} #print{display:block} #print .page{margin:0 auto 10mm} @media print{#print .page{margin:0}}</style></head><body><div id="print">${html}</div></body></html>`;
}
