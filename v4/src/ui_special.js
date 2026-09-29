/* ===================== 待處理 ===================== */
function todos(r) {
  const out = []; // [類別, 事項, 相關時間, 目標]
  DB.list('stations', s => s.status === 'open').forEach(st => {
    if (st.subject.includes(r) && st.queue[0]) out.push(['對接', `${roleName(st.queue[0].roleId)} 在排隊，等主體對接`, st.point, { s: 'stations', id: st.id, open: 1 }]);
    if (st.queue.findIndex(q => q.roleId === r) === 0) out.push(['排隊', '你排在第一位，等主體對接', st.point, { s: 'stations', id: st.id, open: 1 }]);
  });
  DB.list('challenges').forEach(c => {
    const st = DB.get('stations', c.stationId); if (!st) return;
    const t = { s: 'challenges', id: c.id };
    if (c.executor === r && c.status === '待執行') out.push(['挑戰', `接下或婉拒「${c.content}」`, c.node, t]);
    if (c.executor === r && c.status === '執行中') out.push(['挑戰', `執行中「${c.content}」，做完後提交判定`, c.node, t]);
    if (c.writer === r && c.status === '待判定') out.push(['判定', `判定「${c.content}」是否完成`, c.node, t]);
    if (c.status === '判定爭議中' && (c.writer === r || c.executor === r)) out.push(['爭議', `「${c.content}」依共同規則處理`, c.node, t]);
    if (c.status === '擱置' && st.subject.includes(r)) out.push(['拆解', `「${c.content}」擱置中，可修改拆解`, c.node, { ...t, open: 1 }]);
    if (c.status === '待執行' && !c.executor && st.subject.includes(r)) out.push(['拆解', `「${c.content}」需要新的執行角色`, c.node, { ...t, open: 1 }]);
  });
  DB.list('stations', s => s.status === 'started' && s.subject.includes(r)).forEach(st => {
    const pid = Game.currentProblemId(st);
    if (Game.readyForHeat(st) && !DB.find('heat', h => h.problemId === pid && h.roleId === r)) out.push(['熱量', '所有挑戰已完成，填寫往後需消耗的總熱量', st.point, { s: 'heat', q: code(pid) }]);
  });
  DB.list('bookings', b => b.holder === r && b.result === '待核准').forEach(b => out.push(['兌換', `預約「${b.resource}」待核准（前一天結束時截止）`, b.day, { s: 'bookings', id: b.id }]));
  return out;
}
function nextDeparture(r) {
  return DB.list('departures', d => d.roleId === r && ['subject', 'queued', 'member'].includes(d.status) && d.point > Clock.now()).sort((a, b) => a.point - b.point)[0] || null;
}
function heroHtml() {
  const r = me(); const R = role(r); const d = nextDeparture(r);
  if (!d) return `<section class="hero"><div class="small muted">${esc(R.name)}還沒有未來的出發點</div><p style="font-family:var(--serif);font-size:1.2rem;margin:.3em 0">選一個難題，親手寫下你要開始的那一微秒。</p>${LQ('problems', '', '到難題表')}</section>`;
  const st = DB.get('stations', d.stationId); const hit = st && (st.subject.length + st.queue.length) > 1;
  return `<section class="hero"><div class="small muted">${esc(R.name)}的下一個出發點${hit ? ' <span class="tag teal">已有熟人對上</span>' : ''}</div>${readout(d.point)}
    <div class="count" data-count="${d.point}">${esc(countdownText(d.point))}</div>
    <p class="small">出發點就是你開始挑戰的那一刻。${L('problems', d.problemId, '看這個難題')}　${st ? L('stations', st.id, '看這個出發點') : ''}</p></section>`;
}
function simpleSheet(id, headers, rows, numCols = []) {
  if (!rows.length) return '<div class="empty">目前沒有。</div>';
  return `<div class="wb"><table class="ws" data-simple="${id}"><thead><tr class="letters"><th class="rn"></th>${headers.map((h, i) => `<th>${colLetter(i)}</th>`).join('')}</tr>
    <tr class="names"><th class="rn"><span class="small">列</span></th>${headers.map((h, i) => `<th class="${numCols.includes(i) ? 'n' : ''}"><span class="sh" style="cursor:default">${esc(h)}</span></th>`).join('')}</tr></thead>
    <tbody>${rows.map((r, i) => `<tr><td class="rn">${i + 1}</td>${r.map((c, j) => `<td class="${numCols.includes(j) ? 'n' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function tgtLink(t, text) { return t.q != null ? LQ(t.s, t.q, text) : L(t.s, t.id, text, t.open); }
function viewTodo() {
  const td = todos(me()).sort((a, b) => a[2] - b[2]);
  return heroHtml() + `<div class="sheet-head"><h2>待處理</h2><span class="muted small">${td.length} 件</span></div>` +
    simpleSheet('todo', ['類別', '事項', '相關時間', '前往'], td.map(([k, t, at, g]) => [esc(k), esc(t), tm(at), tgtLink(g, esc(sheetTitle(g.s)))]));
}

/* ===================== 人生行事歷（起點） ===================== */
function pastEvents(r) {
  const now = Clock.now(); const ev = [];
  roleProblems(r).forEach(p => ev.push({ t: p.occurredAt, k: 'p', text: '難題：' + p.name, g: { s: 'problems', id: p.id }, dep: !!(p.departureId || p.fusedFrom) }));
  DB.list('departures', d => d.roleId === r && d.point <= now).forEach(d => ev.push({ t: d.point, k: 'd', text: '出發點（' + (DEP_TEXT[d.status] || '') + '）', g: { s: 'departures', id: d.id } }));
  DB.list('challenges', c => (c.writer === r || c.executor === r) && c.node <= now).forEach(c => ev.push({ t: c.node, k: 'n', text: '時間節點：' + c.content, g: { s: 'challenges', id: c.id } }));
  DB.list('bookings', b => (b.holder === r || b.issuer === r) && b.day <= now).forEach(b => ev.push({ t: b.day, k: 'b', text: `兌現：${b.resource}（${b.result}）`, g: { s: 'bookings', id: b.id } }));
  return ev;
}
function viewLife() {
  const r = me(); const R = role(r); const now = Clock.now(); const np = usParts(now); const age = ageOf(R, now);
  const ev = pastEvents(r); const byM = {};
  ev.forEach(e => { const p = usParts(e.t); const k = p.y + '-' + p.mo; (byM[k] = byM[k] || []).push(e); });
  const d = nextDeparture(r); const nTodo = todos(r).length;
  let rows = '';
  for (let a = age; a >= 0; a--) {
    const y0 = R.birthY + a;
    let cells = ''; let cnt = 0;
    for (let m = 1; m <= 12; m++) {
      const y = m >= R.birthM ? y0 : y0 + 1;
      const future = y > np.y || (y === np.y && m > np.mo); const before = y < R.birthY || (y === R.birthY && m < R.birthM);
      const list = byM[y + '-' + m] || []; cnt += list.length;
      const arrow = list.some(e => e.k === 'p' && e.dep);
      const lab = list.length ? list.length + (arrow ? '→' : '') : '';
      const cur = y === np.y && m === np.mo;
      cells += (future || before) ? `<td class="c off" data-c="${m + 1}"></td>` :
        `<td class="c ${list.length ? 'has' : ''} ${cur ? 'now' : ''}" data-c="${m + 1}"><button type="button" data-act="calOpen" data-y="${y}" data-m="${m}" aria-label="${y} 年 ${m} 月${list.length ? '，' + list.length + ' 件' : ''}">${lab}</button></td>`;
    }
    rows += `<tr data-row data-id="age${a}" data-i="${age - a + 1}"><td class="rn">${age - a + 1}</td><td class="fz" data-c="0"><b>${a} 歲</b></td><td data-c="1" class="n small muted">${y0}${R.birthM === 1 ? '' : '–' + String(y0 + 1).slice(-2)}</td>${cells}<td class="n" data-c="14">${cnt || ''}</td></tr>`;
  }
  let month = '';
  if (UI.calMonth) {
    const { y, m } = UI.calMonth; const startW = new Date(y, m - 1, 1).getDay(); const days = new Date(y, m, 0).getDate();
    const list = byM[y + '-' + m] || [];
    let cells = ['日', '一', '二', '三', '四', '五', '六'].map(x => `<div class="dh">${x}</div>`).join('');
    for (let i = 0; i < startW; i++) cells += '<div class="dc out"></div>';
    for (let dd = 1; dd <= days; dd++) {
      const evs = list.filter(e => usParts(e.t).d === dd);
      cells += `<div class="dc ${usFrom({ y, mo: m, d: dd }) > now ? 'out' : ''}"><div class="d">${dd}</div>${evs.map(e => `<span class="ev ${e.k}">${L(e.g.s, e.g.id, esc(e.text))}</span>`).join('')}</div>`;
    }
    month = `<div class="box" id="monthBox" style="margin-top:12px"><div class="row" style="justify-content:space-between"><h3>${y} 年 ${m} 月</h3><button class="btn sm" data-act="calClose">收起</button></div><div class="month" style="margin-top:6px">${cells}</div></div>`;
  }
  const hdr = ['年齡', '年份', ...[...Array(12)].map((_, i) => (i + 1) + '月'), '件數'];
  return `<div class="sheet-head"><span class="no">起點</span><h2>人生行事歷</h2><span class="muted small">只記錄到今天</span></div>
    <p class="sheet-desc">縱軸是年齡，從現在往回排到 0 歲；橫軸是月份，每一列涵蓋該年齡的十二個月。有紀錄的格子標出件數，箭頭表示那個月的難題已經寫下出發點。點格子打開那個月的月曆，月曆裡的每件事都能跳到對應的表。</p>
    <div class="toolbar">${d ? `<span class="small">下一個出發點 ${L('problems', d.problemId, tm(d.point))}，<span data-count="${d.point}">${esc(countdownText(d.point))}</span></span>` : '<span class="small muted">還沒有未來的出發點</span>'}
    <button class="btn sm" data-act="go" data-s="todo">待處理 ${nTodo} 件</button></div>
    <div class="wb"><table class="ws life" data-sheet="life"><thead><tr class="letters"><th class="rn"></th>${hdr.map((h, i) => `<th class="${i === 0 ? 'fz' : ''}">${colLetter(i)}</th>`).join('')}</tr>
    <tr class="names"><th class="rn"><span class="small">列</span></th><th class="fz"><span class="sh" style="cursor:default">年齡</span></th><th><span class="sh" style="cursor:default">年份</span></th>${[...Array(12)].map((_, i) => `<th><span class="sh" style="cursor:default;text-align:center">${i + 1}月</span></th>`).join('')}<th><span class="sh" style="cursor:default">件數</span></th></tr></thead>
    <tbody>${rows}</tbody></table></div>${month}`;
}

/* ===================== 挑戰時間軸（未來） ===================== */
const TL_LEVELS = [['年', 10 * 365 * DAY], ['月', 365 * DAY], ['日', 31 * DAY], ['時', DAY], ['分', HOUR], ['秒', MIN], ['微秒', 1000]];
const TL_STEPS = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, MIN, 10 * MIN, HOUR, 6 * HOUR, DAY, 7 * DAY, 30 * DAY, 365 * DAY];
const TL_KIND = { dep: '我的出發點', hit: '碰撞的出發點', node: '時間節點', bk: '兌現預約' };
function tlItems(r) {
  const now = Clock.now(); const out = [];
  DB.list('departures', d => d.roleId === r && ['subject', 'queued', 'member'].includes(d.status) && d.point > now).forEach(d => {
    const st = DB.get('stations', d.stationId); const hit = st && (st.subject.length + st.queue.length) > 1;
    out.push({ t: d.point, k: hit ? 'hit' : 'dep', text: (DB.get('problems', d.problemId) || {}).name, g: st ? { s: 'stations', id: st.id } : { s: 'departures', id: d.id }, who: '' });
  });
  DB.list('challenges', c => c.node > now && c.status !== '完成').forEach(c => {
    const st = DB.get('stations', c.stationId); if (!st || !insider(st, r)) return;
    out.push({ t: c.node, k: 'node', text: c.content, g: { s: 'challenges', id: c.id }, who: c.executor ? roleName(c.executor) : '待指定' });
  });
  DB.list('bookings', b => (b.holder === r || b.issuer === r) && b.day + DAY > now && ['待核准', '核准'].includes(b.result)).forEach(b => out.push({ t: Math.max(b.day, now + 1), k: 'bk', text: `${b.resource}（${b.result}）`, g: { s: 'bookings', id: b.id }, who: roleName(b.issuer) }));
  return out.sort((a, b) => a.t - b.t);
}
function tlWindow() {
  const now = Clock.now(); const tl = UI.tl;
  if (tl.center == null) tl.center = now + tl.span / 2 - tl.span * 0.05;
  let start = tl.center - tl.span / 2; if (start < now - tl.span * 0.05) { start = now - tl.span * 0.05; tl.center = start + tl.span / 2; }
  return { start, end: start + tl.span };
}
function tickLabel(t, step) {
  const p = usParts(t);
  if (step >= DAY) return `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
  if (step >= MIN) return `${pad(p.mo)}/${pad(p.d)} ${pad(p.h)}:${pad(p.mi)}`;
  if (step >= SEC) return `${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`;
  return `${pad(p.s)}.${pad(p.micro, 6)}`;
}
function renderTimeline() {
  const el = $('#tl'); if (!el) return;
  const { start, end } = tlWindow(); const span = end - start; const W = el.clientWidth || 600;
  const step = TL_STEPS.find(s => span / s <= Math.max(3, Math.floor(W / 110))) || 365 * DAY;
  const tz = -new Date().getTimezoneOffset() * MIN;
  const first = step >= HOUR ? Math.floor((start + tz) / step) * step - tz : Math.floor(start / step) * step;
  let h = '';
  for (let t = first; t <= end; t += step) { if (t < start) continue; h += `<div class="tick" style="left:${((t - start) / span * 100).toFixed(4)}%"><span>${esc(tickLabel(t, step))}</span></div>`; }
  const now = Clock.now();
  if (now >= start && now <= end) h += `<div class="now" style="left:${((now - start) / span * 100).toFixed(4)}%" title="現在"></div>`;
  const items = tlItems(me());
  items.forEach((it, i) => { if (it.t < start || it.t > end) return; h += `<button class="mk ${it.k}" style="left:${((it.t - start) / span * 100).toFixed(4)}%" data-act="tlSel" data-i="${i}" title="${esc(fmtUs(it.t) + ' ' + TL_KIND[it.k] + '：' + it.text)}" aria-label="${esc(TL_KIND[it.k] + '：' + it.text)}"></button>`; });
  h += `<div class="range">${esc(fmtUs(start))} ～ ${esc(fmtUs(end))}</div>`;
  el.innerHTML = h;
  const lvl = TL_LEVELS.reduce((a, b) => Math.abs(Math.log(b[1] / UI.tl.span)) < Math.abs(Math.log(a[1] / UI.tl.span)) ? b : a);
  document.querySelectorAll('[data-act="tlLevel"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.l === lvl[0] ? 'true' : 'false'));
  const inWin = items.map((it, i) => ({ ...it, i })).filter(it => it.t >= start && it.t <= end);
  const sel = UI.tlSel != null ? items[UI.tlSel] : null;
  const row = it => [tm(it.t), TL_KIND[it.k], tgtLink(it.g, esc(it.text)), esc(it.who || ''), `<button class="btn sm" data-act="tlFocus" data-i="${it.i}">放大到微秒</button>`];
  $('#tlList').innerHTML = (sel ? `<div class="note"><span class="num">${esc(fmtUs(sel.t))}</span>　${TL_KIND[sel.k]}：${tgtLink(sel.g, esc(sel.text))}</div>` : '') +
    `<h3 style="margin:8px 0 4px">這個範圍內（${inWin.length}）</h3>` + simpleSheet('tlwin', ['時間', '類型', '內容', '負責／對象', ''], inWin.map(row)) +
    `<h3 style="margin:12px 0 4px">全部未來項目（${items.length}）</h3>` + simpleSheet('tlall', ['時間', '類型', '內容', '負責／對象', ''], items.map((it, i) => row({ ...it, i })));
}
function viewTimeline() {
  return `<div class="sheet-head"><h2>挑戰時間軸</h2><span class="muted small">只放未來</span></div>
    <p class="sheet-desc">只顯示你寫下的出發點、已和你碰撞的出發點、你參與的時間節點與兌換預約。其他玩家的出發點是暗號，不會出現在這裡。滑鼠滾輪或雙指可以縮放，拖曳可以平移；時間過去後，項目會移到人生行事歷。</p>
    <div class="tl-bar">${TL_LEVELS.map(([l]) => `<button class="btn sm" data-act="tlLevel" data-l="${l}">${l}</button>`).join('')}<button class="btn sm" data-act="tlNow">回到現在</button></div>
    <div class="tl" id="tl" aria-label="挑戰時間軸"></div>
    <div class="legend"><span><i style="background:var(--brass)"></i>我的出發點</span><span><i style="background:var(--teal)"></i>碰撞的出發點</span><span><i style="background:var(--blue);border-radius:2px"></i>時間節點</span><span><i style="background:var(--rose);border-radius:1px"></i>兌現預約</span></div>
    <div id="tlList"></div>`;
}
function bindTimeline() {
  const el = $('#tl'); if (!el || el._bound) return; el._bound = true;
  const pts = new Map(); let last = null;
  const zoomAt = (factor, xFrac) => {
    const { start } = tlWindow(); const anchor = start + UI.tl.span * xFrac;
    UI.tl.span = Math.min(40 * 365 * DAY, Math.max(20, UI.tl.span * factor));
    UI.tl.center = anchor - UI.tl.span * xFrac + UI.tl.span / 2; renderTimeline();
  };
  el.addEventListener('wheel', e => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(e.deltaY > 0 ? 1.25 : 0.8, (e.clientX - r.left) / r.width); }, { passive: false });
  el.addEventListener('pointerdown', e => { if (e.target.closest('.mk')) return; el.setPointerCapture(e.pointerId); pts.set(e.pointerId, e.clientX); last = null; });
  el.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; const r = el.getBoundingClientRect();
    if (pts.size === 1) { const dx = e.clientX - pts.get(e.pointerId); UI.tl.center -= dx / r.width * UI.tl.span; pts.set(e.pointerId, e.clientX); renderTimeline(); }
    else if (pts.size === 2) { pts.set(e.pointerId, e.clientX); const xs = [...pts.values()]; const dist = Math.abs(xs[0] - xs[1]) || 1; if (last) zoomAt(last / dist, ((xs[0] + xs[1]) / 2 - r.left) / r.width); last = dist; }
  });
  const up = e => { pts.delete(e.pointerId); last = null; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}

/* ===================== 設定 ===================== */
function viewSettings() {
  const now = Clock.now();
  return `<div class="sheet-head"><h2>設定</h2></div>
    <section class="sec"><h3>模擬時間</h3><p class="small muted">把系統時間往後快轉，用來測試出發點到達、排隊超時、預約截止。已經發生的事不會因為倒轉而撤銷。</p>
    <p class="num">目前：${esc(fmtUs(now))}${Clock.offset ? `（快轉 ${esc(humanSpan(Math.abs(Clock.offset)))}）` : '（真實時間）'}</p>
    <div class="row"><button class="btn" data-act="sim" data-d="${HOUR}">＋1 小時</button><button class="btn" data-act="sim" data-d="${DAY}">＋1 天</button><button class="btn" data-act="sim" data-d="${7 * DAY}">＋7 天</button><button class="btn" data-act="sim" data-d="${30 * DAY}">＋30 天</button><button class="btn warn" data-act="simReset">回到真實時間</button></div>
    <form onsubmit="return false" style="margin-top:10px"><div class="small muted">跳到指定時間</div>${pointInput('sim', now + DAY)}<button type="button" class="btn" data-act="simTo" style="margin-top:8px">跳到這個時間</button></form></section>
    <section class="sec"><h3>資料</h3><p class="small muted">這一版資料存在這個瀏覽器，手機和電腦不互通。用匯出與匯入在兩端之間搬資料。資料格式版本：${SCHEMA_VERSION}。待上傳佇列：${Store.data.pendingUploads.length} 筆（日後接上伺服器時使用）。角色與常用尾數在各自的工作表裡管理。</p>
    <div class="row"><button class="btn pri" data-act="export">匯出 JSON</button><button class="btn" data-act="importDlg">匯入 JSON</button><button class="btn" data-act="reseed">重設為示範資料</button><button class="btn warn" data-act="wipe">清空全部資料</button></div>
    <div id="exportBox"></div></section>
    <section class="sec"><h3>外觀</h3><div class="row"><button class="btn" data-act="theme" data-v="">跟隨系統</button><button class="btn" data-act="theme" data-v="light">淺色</button><button class="btn" data-act="theme" data-v="dark">深色</button></div></section>`;
}
function humanSpan(us) { const d = Math.floor(us / DAY); const h = Math.floor((us % DAY) / HOUR); const m = Math.floor((us % HOUR) / MIN); return (d ? d + ' 天 ' : '') + (h ? h + ' 小時 ' : '') + (!d && !h ? m + ' 分' : ''); }
