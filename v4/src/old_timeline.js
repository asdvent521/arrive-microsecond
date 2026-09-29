/* ===================== 挑戰時間軸（可縮放到微秒） ===================== */
const TL_LEVELS = [['年', 10 * 365 * DAY], ['月', 365 * DAY], ['日', 31 * DAY], ['時', DAY], ['分', HOUR], ['秒', MIN], ['微秒', 1000]];
const TL_STEPS = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, MIN, 10 * MIN, HOUR, 6 * HOUR, DAY, 7 * DAY, 30 * DAY, 365 * DAY];
function tlItems(r) {
  const now = Clock.now(); const out = [];
  DB.list('departures', d => d.roleId === r && ['subject', 'queued', 'member'].includes(d.status) && d.point > now).forEach(d => {
    const st = DB.get('stations', d.stationId); const hit = st && (st.subject.length + st.queue.length) > 1;
    out.push({ t: d.point, k: hit ? 'hit' : 'dep', text: (hit ? '碰撞的出發點：' : '我的出發點：') + (DB.get('problems', d.problemId) || {}).name, link: '#problem/' + d.problemId });
  });
  DB.list('challenges', c => c.node > now && c.status !== '完成').forEach(c => {
    const st = DB.get('stations', c.stationId); if (!st || !(st.subject.includes(r) || c.writer === r || c.executor === r)) return;
    out.push({ t: c.node, k: 'node', text: `時間節點：${c.content}（負責：${c.executor ? roleName(c.executor) : '待指定'}）`, link: stationProblemLink(st) });
  });
  DB.list('bookings', b => (b.holder === r || b.issuer === r) && b.day + DAY > now && ['待核准', '核准'].includes(b.result)).forEach(b => out.push({ t: Math.max(b.day, now + 1), k: 'bk', text: `兌現預約：${b.resource}（${b.result}）`, link: '#points' }));
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
  let first = step >= HOUR ? Math.floor((start + tz) / step) * step - tz : Math.floor(start / step) * step;
  let h = '';
  for (let t = first; t <= end; t += step) { if (t < start) continue; h += `<div class="tick" style="left:${((t - start) / span * 100).toFixed(4)}%"><span>${esc(tickLabel(t, step))}</span></div>`; }
  const now = Clock.now();
  if (now >= start && now <= end) h += `<div class="now" style="left:${((now - start) / span * 100).toFixed(4)}%" title="現在"></div>`;
  const items = tlItems(me());
  items.forEach((it, i) => { if (it.t < start || it.t > end) return; h += `<button class="mk ${it.k}" style="left:${((it.t - start) / span * 100).toFixed(4)}%" data-act="tlSel" data-i="${i}" title="${esc(fmtUs(it.t) + ' ' + it.text)}" aria-label="${esc(it.text)}"></button>`; });
  h += `<div class="range">${esc(fmtUs(start))} ～ ${esc(fmtUs(end))}</div>`;
  el.innerHTML = h;
  const lvl = TL_LEVELS.reduce((a, b) => Math.abs(Math.log(b[1] / UI.tl.span)) < Math.abs(Math.log(a[1] / UI.tl.span)) ? b : a);
  document.querySelectorAll('[data-act="tlLevel"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.l === lvl[0] ? 'true' : 'false'));
  const inWin = items.map((it, i) => ({ ...it, i })).filter(it => it.t >= start && it.t <= end);
  const sel = UI.tlSel != null ? items[UI.tlSel] : null;
  const KIND = { dep: '我的出發點', hit: '碰撞的出發點', node: '時間節點', bk: '兌現預約' };
  const rowOf = it => [cv(`<span class="num small">${esc(fmtUs(it.t))}</span>`, it.t), KIND[it.k], esc(it.text.replace(/^[^：]*：/, '')),
    `<button class="btn sm" data-act="tlFocus" data-i="${it.i}">放大到微秒</button> <a class="btn sm" href="${it.link}">打開</a>`];
  $('#tlList').innerHTML = (sel ? `<div class="note"><div class="num">${esc(fmtUs(sel.t))}</div><div>${esc(sel.text)}</div><a href="${sel.link}">打開</a></div>` : '') +
    `<h3 style="margin-top:10px">這個範圍內</h3>` + table(['時間', '類型', '內容', '操作'], inWin.map(rowOf), { id: 'tlwin' }) +
    `<h3 style="margin-top:14px">全部未來項目</h3>` + table(['時間', '類型', '內容', '操作'], items.map((it, i) => rowOf({ ...it, i })), { id: 'tlall' });
  applySheet('tlwin'); applySheet('tlall');
}
function viewTimeline() {
  return `<section class="sec"><div class="sec-h"><h2>挑戰時間軸</h2><span class="aside">只放未來</span></div>
    <p class="small muted">只顯示你寫下的出發點、已和你碰撞的出發點、你參與的時間節點與兌換預約。其他玩家的出發點是暗號，不會出現在這裡。滑鼠滾輪或雙指可以縮放，拖曳可以平移。</p>
    <div class="tl-bar">${TL_LEVELS.map(([l]) => `<button class="btn sm" data-act="tlLevel" data-l="${l}">${l}</button>`).join('')}<button class="btn sm" data-act="tlNow">回到現在</button></div>
    <div class="tl" id="tl" aria-label="挑戰時間軸"></div>
    <div class="legend"><span><i style="background:var(--brass)"></i>我的出發點</span><span><i style="background:var(--teal)"></i>碰撞的出發點</span><span><i style="background:var(--blue);border-radius:2px"></i>時間節點</span><span><i style="background:var(--rose);border-radius:1px"></i>兌現預約</span><span><i style="background:transparent;border-left:2px solid var(--teal);border-radius:0"></i>現在</span></div>
    <div id="tlList"></div></section>`;
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
    else if (pts.size === 2) {
      pts.set(e.pointerId, e.clientX); const xs = [...pts.values()]; const dist = Math.abs(xs[0] - xs[1]) || 1;
      if (last) zoomAt(last / dist, ((xs[0] + xs[1]) / 2 - r.left) / r.width); last = dist;
    }
  });
  const up = e => { pts.delete(e.pointerId); last = null; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
