/* ===================== 分頁、跳轉與返回 ===================== */
function renderTabs() {
  $('#tabs').innerHTML = TABS.map(k => {
    if (k === '|') return '<span class="sep" aria-hidden="true"></span>';
    const S = SHEETS[k];
    return `<a href="#/${k}" data-act="go" data-s="${k}" ${UI.sheet === k ? 'aria-current="page"' : ''}>${S.no ? `<b>${S.no}</b>` : ''}${esc(S.name)}</a>`;
  }).join('');
  const cur = $('#tabs [aria-current]'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const sel = $('#roleSel');
  sel.innerHTML = DB.list('accounts').map(a => `<optgroup label="${esc(a.name)}">${DB.list('roles', r => r.accountId === a.id).map(r => `<option value="${r.id}" ${r.id === me() ? 'selected' : ''}>以「${esc(r.name)}」遊玩</option>`).join('')}</optgroup>`).join('');
  $('#backBtn').disabled = !UI.hist.length;
}
function hashOf(t) { return '#/' + t.s + (t.id ? '/' + encodeURIComponent(t.id) : '') + (t.open ? '/open' : '') + (t.q != null ? '?q=' + encodeURIComponent(t.q) : ''); }
function navigate(t) {
  const h = hashOf(t);
  UI.hist.push(location.hash || '#/' + UI.sheet); if (UI.hist.length > 60) UI.hist.shift();
  if (location.hash === h) { route(); render(); } else location.hash = h;
}
function route() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const [path, query] = raw.split('?'); const parts = path.split('/').filter(Boolean);
  const s = SHEETS[parts[0]] ? parts[0] : 'life';
  UI.sheet = s; UI.focus = null;
  if (parts[1]) {
    const id = decodeURIComponent(parts[1]); UI.focus = id;
    if (parts[2] === 'open') (UI.open[s] = UI.open[s] || new Set()).add(id);
    const st = UI.sheets[s]; if (st && st.q) st.q = '';
  }
  const m = (query || '').match(/(?:^|&)q=([^&]*)/);
  if (m) (UI.sheets[s] = UI.sheets[s] || {}).q = decodeURIComponent(m[1]);
}
function focusRow() {
  if (!UI.focus) return;
  const tr = document.querySelector(`.ws[data-sheet="${UI.sheet}"] tr[data-row][data-id="${CSS.escape(UI.focus)}"]`);
  if (!tr) { toast('你目前看不到這一列'); UI.focus = null; return; }
  tr.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  tr.classList.remove('flash'); void tr.offsetWidth; tr.classList.add('flash');
  const td = tr.querySelector('td[data-c="0"]'); if (td) selectCell(td);
  UI.focus = null;
}
window.addEventListener('hashchange', () => { route(); render(); });
$('#backBtn').addEventListener('click', () => { const h = UI.hist.pop(); if (h == null) return; if (location.hash === h) { route(); render(); } else { location.hash = h; } setTimeout(() => { $('#backBtn').disabled = !UI.hist.length; }, 0); });
$('#roleSel').addEventListener('change', e => { Store.data.meta.currentRole = e.target.value; UI.bk = null; UI.addCh = null; UI.ruleEdit = false; Game.commit(); render(); toast('已切換為 ' + roleName(me())); });

/* ===================== 繪製 ===================== */
function renderMain() {
  const sk = UI.sheet; const S = SHEETS[sk];
  let h;
  if (sk === 'life') h = viewLife();
  else if (sk === 'timeline') h = viewTimeline();
  else if (sk === 'todo') h = viewTodo();
  else if (sk === 'paper') h = viewPaper();
  else if (sk === 'settings') h = viewSettings();
  else h = `<div class="sheet-head">${S.no ? `<span class="no">表 ${S.no}</span>` : ''}<h2>${esc(S.name)}</h2></div>${S.desc ? `<p class="sheet-desc">${S.desc}</p>` : ''}` +
    (sk === 'paths' ? `<div class="toolbar"><button class="btn sm" data-act="exportPaths">匯出路徑圖 JSON</button></div>` : '') + renderSheet(sk);
  $('#main').innerHTML = h;
  document.querySelectorAll('.pt-in').forEach(updatePreview);
  if (S.cols) applyFilter(sk);
  if (sk === 'rules' && UI.ruleEdit) updateTry();
  if (sk === 'timeline') { bindTimeline(); renderTimeline(); }
  $('#nameBox').textContent = (S.no ? S.no : S.name); $('#fxVal').textContent = ''; $('#nameBox').title = sheetTitle(sk);
  paintClock();
}
function render() {
  if (!me() || !role(me())) Store.data.meta.currentRole = (DB.list('roles')[0] || {}).id;
  buildCodes();
  const scroll = $('#main').scrollTop; const same = render._last === UI.sheet;
  renderTabs(); renderMain();
  if (same && !UI.focus) $('#main').scrollTop = scroll; else if (!UI.focus) $('#main').scrollTop = 0;
  render._last = UI.sheet;
  focusRow();
}

/* ===================== 時鐘 ===================== */
function paintClock() {
  const f = fmtUs(Clock.now()).split('.');
  $('#clockT').innerHTML = `${esc(f[0])}.<b>${reduced ? f[1].slice(0, 2) + '····' : f[1]}</b>`;
  $('#clockSim').textContent = Clock.offset ? '模擬時間（' + (Clock.offset > 0 ? '快轉 ' : '倒退 ') + humanSpan(Math.abs(Clock.offset)) + '）' : '';
  document.querySelectorAll('[data-count]').forEach(el => { el.textContent = countdownText(+el.dataset.count); });
}
function loop() { paintClock(); if (!reduced) requestAnimationFrame(loop); }
const busy = () => { const a = document.activeElement; return a && (a.form || a.closest('form') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName)) || $('#dlg').open || UI.ruleEdit; };
setInterval(() => { if (reduced) paintClock(); if (Game.tick()) { Game.commit(); if (!busy()) render(); } }, 1000);

/* ===================== 動作 ===================== */
const F = el => el.form || el.closest('form');
function tryDlg(fn, okMsg) { try { fn(); Game.commit(); render(); if (okMsg) toast(okMsg); return true; } catch (e) { alertBox('還不能這樣做', e.message); return false; } }
const ACT = {
  go(b) { navigate({ s: b.dataset.s }); },
  jump(b) { navigate({ s: b.dataset.s, id: b.dataset.id || null, open: b.dataset.open ? 1 : 0, q: b.dataset.q != null ? b.dataset.q : null }); },
  toggle(b) { const s = b.dataset.s, id = b.dataset.id; const set = UI.open[s] = UI.open[s] || new Set(); if (set.has(id)) set.delete(id); else set.add(id); renderMain(); },
  collapse(b) { UI.open[b.dataset.s] = new Set(); renderMain(); },
  sort(b) { const s = b.dataset.s, c = +b.dataset.c; const st = UI.sheets[s] = UI.sheets[s] || {}; if (st.col === c) st.dir = -st.dir; else { st.col = c; st.dir = 1; } renderMain(); },
  unsort(b) { const st = UI.sheets[b.dataset.s]; if (st) st.col = null; renderMain(); },
  // 難題
  addProblem(b) { const f = F(b); const v = formVals(f); const [y, m, d] = (v.occ || '').split('-').map(Number);
    const p = run(() => Game.addProblem(me(), { name: v.name, situation: v.situation, goal: v.goal, occurredAt: y ? usFrom({ y, mo: m, d, h: 12 }) : NaN, dockConds: [] }));
    if (p && p.id) navigate({ s: 'problems', id: p.id, open: 1 }); },
  saveProblem(b) { const f = F(b); const v = formVals(f); const [y, m, d] = (v.occ || '').split('-').map(Number);
    run(() => Game.editProblem(f.dataset.pid, me(), { name: v.name, situation: v.situation, goal: v.goal, occurredAt: y ? usFrom({ y, mo: m, d, h: 12 }) : NaN }), '已儲存'); },
  addDockCond(b) { F(b).querySelector('.dc-rows').insertAdjacentHTML('beforeend', dockCondRow(null)); },
  saveDockConds(b) { const f = F(b); run(() => Game.setDockConds(f.dataset.pid, me(), readDockConds(f), formVals(f)['consent[]'] || []), '已儲存對接條件'); },
  tail(b) { const f = F(b); const p = b.dataset.p; f.querySelector(`[name="${p}_s"]`).value = pad(+b.dataset.s); f.querySelector(`[name="${p}_micro"]`).value = pad(+b.dataset.u, 6); updatePreview(f.querySelector('.pt-in')); },
  writeDep(b) {
    const f = F(b);
    const res = run(() => Game.writeDeparture(me(), f.dataset.pid, readPoint(f, 'pt')));
    if (!res) return;
    const msg = { subject: '已寫下出發點。你是這個出發點的主體，等熟人寫下同一個時間。', queued: '碰撞了！這個出發點已經有主體，你已排進隊伍。', full: '這個出發點的排隊已額滿，出發點不成立。你可以另寫一個，或先擱置。',
      conds: '碰撞了，但你目前不符合這個難題的對接條件，出發點不成立。你可以調整規則表後重寫，或另寫一個出發點。' }[res.outcome];
    const title = { full: '排隊已額滿', conds: '不符合對接條件' }[res.outcome] || '出發點已寫下';
    const target = res.outcome === 'subject' || res.outcome === 'queued' ? { s: 'stations', id: res.station.id, open: res.outcome === 'queued' ? 1 : 0 } : { s: 'departures', id: res.departure.id };
    openDialog(`<h3>${title}</h3><p>${msg}</p>${res.missing ? `<div class="err">未達到：\n${res.missing.map(esc).join('\n')}</div>` : ''}${readout(res.departure.point)}`,
      [{ label: '留在這裡' }, { label: target.s === 'stations' ? '前往出發點表' : '前往出發紀錄', cls: 'pri', fn: () => { navigate(target); } }]);
  },
  // 出發點
  leaveQueue(b) { openDialog('<h3>退出排隊？</h3><p>退出後這個難題會擱置，你可以另寫出發點。</p>', [{ label: '取消' }, { label: '退出排隊', cls: 'warn', fn: () => run(() => Game.leaveQueue(b.dataset.st, me(), 'left'), '已退出排隊') }]); },
  dock(b) {
    const f = F(b); const v = formVals(f); const accept = b.dataset.ok === '1';
    const common = { deadlock: { opt: v.dl, text: v.dlt || '' }, interp: { opt: v.ip, text: v.ipt || '' }, queue: { max: int(v.qm), waitDays: int(v.qw), text: '' } };
    const r = run(() => Game.dock(f.dataset.st, { accept, common, consents: v['consent[]'] || [], fused: { name: v.fn, situation: v.fs, goal: v.fg, dockConds: readDockConds(f) } }), accept ? '已融合，主體擴大了' : '已記錄為不合作');
    if (r && r.fusion) navigate({ s: 'fusions', id: r.fusion.id });
  },
  exitStation(b) { openDialog('<h3>退出這個出發點？</h3><p>退出後你的原始難題改為擱置。已發出的點數都不退回。</p>', [{ label: '取消' }, { label: '退出', cls: 'warn', fn: () => run(() => Game.exitStation(b.dataset.st, me()), '已退出') }]); },
  // 挑戰
  addCh(b) { const f = F(b); run(() => { const { c, consents } = readChallengeForm(f); return Game.addChallenge(f.dataset.st, c, consents); }, '已新增挑戰'); },
  saveCh(b) { const f = F(b); run(() => { const { c, consents } = readChallengeForm(f); Game.editChallenge(f.dataset.ch, c, consents); }, '已修改拆解'); },
  delCh(b) {
    const ch = DB.get('challenges', b.dataset.ch); const st = DB.get('stations', ch.stationId);
    openDialog(`<h3>刪除挑戰「${esc(ch.content)}」？</h3><form onsubmit="return false">${consentBox(st.subject, '主體全員同意刪除')}</form>`, [{ label: '取消' }, { label: '刪除', cls: 'warn', fn: () => tryDlg(() => Game.deleteChallenge(ch.id, formVals($('#dlgBody form'))['consent[]'] || []), '已刪除') }]);
  },
  acceptCh(b) { run(() => Game.acceptChallenge(b.dataset.ch, me()), '已接下挑戰，題點已發出'); },
  declineCh(b) { run(() => Game.declineChallenge(b.dataset.ch, me()), '已婉拒'); },
  abandonCh(b) { openDialog('<h3>放棄這個挑戰？</h3><p>挑戰會回到待執行、執行角色清空，已發出的題點不退回。</p>', [{ label: '取消' }, { label: '放棄', cls: 'warn', fn: () => run(() => Game.abandonChallenge(b.dataset.ch, me()), '已放棄') }]); },
  submitCh(b) { run(() => Game.submitChallenge(b.dataset.ch, me()), '已提交判定'); },
  judgeOk(b) { run(() => Game.judgeChallenge(b.dataset.ch, me(), true), '判定完成，戰點已發出'); },
  judgeNo(b) { run(() => Game.judgeChallenge(b.dataset.ch, me(), false), '已進入判定爭議'); },
  resolveCh(b) {
    const ch = DB.get('challenges', b.dataset.ch); const st = DB.get('stations', ch.stationId);
    openDialog(`<h3>依共同規則處理</h3><p>共同規則的僵局處理：<b>${esc(optText(st.common.deadlock, DEADLOCK_OPTS))}</b>；解釋權：${esc(optText(st.common.interp, INTERP_OPTS))}。</p><p class="small muted">依規則處理完後，記錄結果。需要寫出者與執行者雙方確認。</p><form onsubmit="return false">${consentBox([ch.writer, ch.executor], '雙方確認結果')}</form>`,
      [{ label: '取消' }, { label: '裁定未完成', cls: 'warn', fn: () => tryDlg(() => Game.resolveDispute(ch.id, false, formVals($('#dlgBody form'))['consent[]'] || []), '已回到執行中') },
       { label: '裁定完成', cls: 'pri', fn: () => tryDlg(() => Game.resolveDispute(ch.id, true, formVals($('#dlgBody form'))['consent[]'] || []), '已裁定完成，戰點已發出') }]);
  },
  heat(b) { const f = F(b); run(() => Game.fillHeat(f.dataset.st, me(), int(formVals(f).kcal)), '已填入'); },
  // 規則
  ruleEdit() { UI.ruleEdit = true; renderMain(); },
  ruleCancel() { UI.ruleEdit = false; renderMain(); },
  addRes() { $('#resRows').insertAdjacentHTML('beforeend', resRow(null)); updateTry(); },
  addCond() { $('#condRows').insertAdjacentHTML('beforeend', condRow(null)); updateTry(); },
  rmRow(b) { b.closest('.rrow').remove(); updateTry(); },
  saveRules() { const { rules, conds, note } = readRulesForm($('#rulesForm')); if (run(() => Game.saveRules(me(), rules, conds, null, note || '修改規則'), '已儲存為新版本')) { UI.ruleEdit = false; renderMain(); } },
  // 點數與兌換
  useBatch(b) {
    const bt = DB.get('batches', b.dataset.b); const R = rulesOf(bt.issuer); const k = bt.type === '題點' ? 'q' : 'z'; const cd = coopDays(me(), bt.issuer);
    const ver = epp(currentVersion(bt.issuer).snapshot, k, cd) >= epp(versionOf(bt.issuer, bt.version).snapshot, k, cd) ? 'current' : 'issue';
    let res = 0; for (let i = 0; i < R.resources.length; i++) { try { Game.quote(me(), bt.issuer, i, [{ batchId: bt.id, ver }]); res = i; break; } catch (e) { /* 這批點數不夠付這項資源 */ } }
    UI.bk = { issuer: bt.issuer, res, day: fmtDay(addDays(Clock.now(), 2)), uses: { [bt.id]: ver } };
    navigate({ s: 'bookings' }); setTimeout(() => { const r = $('.ws tr.addrow'); if (r) r.scrollIntoView({ block: 'center' }); }, 30);
  },
  book() { const S = UI.bk; const [y, m, d] = (S.day || '').split('-').map(Number); const uses = Object.entries(S.uses).map(([batchId, ver]) => ({ batchId, ver }));
    const bk = run(() => Game.book(me(), S.issuer, y ? usFrom({ y, mo: m, d }) : NaN, S.res, uses));
    if (bk && bk.id) { UI.bk = null; navigate({ s: 'bookings', id: bk.id }); toast(bk.result === '待核准' ? '已送出預約，前一天結束時截止' : '當日申請：' + bk.result); } },
  cancelBk(b) { run(() => Game.cancelBooking(b.dataset.b, me()), '已取消，點數已解凍'); },
  // 角色與尾數
  addRole(b) { const v = formVals(F(b)); run(() => { let acc = v.acc; if (acc === '__new') acc = Game.createAccount((v.name || '新') + '的帳號').id; const r = Game.createRole({ name: v.name, birthY: int(v.by), birthM: int(v.bm), accountId: acc }); Store.data.meta.currentRole = r.id; return r; }, '已建立角色並切換'); },
  playAs(b) { Store.data.meta.currentRole = b.dataset.r; UI.bk = null; UI.addCh = null; UI.ruleEdit = false; Game.commit(); render(); toast('已切換為 ' + roleName(me())); },
  addTail(b) { const v = formVals(F(b)); run(() => { if (!/^\d{6}$/.test(v.u || '')) throw new GameError('微秒請填滿六位數'); return Game.addTail(me(), int(v.s), parseInt(v.u, 10), v.l); }, '已新增常用尾數'); },
  rmTail(b) { run(() => DB.remove('tails', b.dataset.t), '已刪除'); },
  // 人生行事歷與時間軸
  calOpen(b) { UI.calMonth = { y: +b.dataset.y, m: +b.dataset.m }; renderMain(); setTimeout(() => { const m = $('#monthBox'); if (m) m.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' }); }, 30); },
  calClose() { UI.calMonth = null; renderMain(); },
  tlLevel(b) { const l = TL_LEVELS.find(x => x[0] === b.dataset.l); const { start, end } = tlWindow(); UI.tl.span = l[1]; UI.tl.center = (start + end) / 2; renderTimeline(); },
  tlNow() { UI.tl.center = null; renderTimeline(); },
  tlSel(b) { UI.tlSel = +b.dataset.i; renderTimeline(); },
  tlFocus(b) { const it = tlItems(me())[+b.dataset.i]; UI.tlSel = +b.dataset.i; UI.tl.span = 1000; UI.tl.center = it.t; renderTimeline(); $('#tl').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); },
  // 紙本
  pvw(b) { const k = b.dataset.k; UI.paper = { k, o: k === 'statement' ? statementOpts() : null }; renderMain(); setTimeout(() => $('#pvSec') && $('#pvSec').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }), 30); },
  pvClose() { UI.paper = null; renderMain(); },
  prt(b) { const k = b.dataset.k; printPages(buildPages(k, k === 'statement' ? statementOpts() : null)); },
  async dlp(b) { await saveFile('到達那微秒-' + (b.dataset.k === 'handbook' ? '個人手冊' : '活頁單張') + '.html', standaloneHtml(buildPages(b.dataset.k))); },
  // 設定
  sim(b) { Clock.offset += +b.dataset.d; Store.data.meta.clockOffset = Clock.offset; Game.tick(); Game.commit(); render(); toast('時間已快轉'); },
  simReset() { Clock.offset = 0; Store.data.meta.clockOffset = 0; Game.commit(); render(); toast('回到真實時間'); },
  simTo(b) { try { const t = readPoint(F(b), 'sim'); Clock.offset = t - Clock.real(); Store.data.meta.clockOffset = Clock.offset; Game.tick(); Game.commit(); render(); toast('已跳到指定時間'); } catch (e) { alertBox('時間格式不正確', e.message); } },
  async export() { const s = Store.exportJSON(); const ok = await saveFile('到達那微秒-資料.json', s, true);
    if (!ok) $('#exportBox').innerHTML = `<p class="small muted" style="margin-top:10px">這裡無法直接下載，請全選下面的文字，複製後存成 .json 檔。</p><textarea readonly style="min-height:160px;font-size:.75rem">${esc(s)}</textarea>`; },
  async exportPaths() { const s = JSON.stringify({ app: '到達那微秒', kind: '路徑圖', sheets: Object.fromEntries(Object.entries(SHEETS).map(([k, S]) => [k, { name: S.name, no: S.no || null, cols: (S.cols || []).map(c => ({ key: c.k, name: c.h, to: c.to || null })) }])), paths: PATHS().map(({ from, col, to }) => ({ from, col, to })) }, null, 2);
    const ok = await saveFile('到達那微秒-路徑圖.json', s, true); if (!ok) openDialog(`<h3>路徑圖</h3><p class="small muted">這裡無法直接下載，請全選複製。</p><textarea readonly style="min-height:240px;font-size:.75rem">${esc(s)}</textarea>`, [{ label: '關閉' }]); },
  importDlg() {
    openDialog(`<h3>匯入 JSON</h3><p class="small muted">匯入會取代這個瀏覽器目前的全部資料。</p><label class="f"><span>選擇檔案</span><input type="file" accept=".json,application/json" id="impFile"></label><label class="f"><span>或貼上內容</span><textarea id="impText" style="min-height:140px"></textarea></label>`,
      [{ label: '取消' }, { label: '匯入', cls: 'pri', fn: () => {
        const go = t => { try { Store.importJSON(t); Clock.offset = Store.data.meta.clockOffset || 0; closeDialog(); render(); toast('已匯入'); } catch (e) { alertBox('無法匯入', e.message); } };
        const file = $('#impFile').files[0]; if (file) { const rd = new FileReader(); rd.onload = () => go(rd.result); rd.readAsText(file); return false; }
        go($('#impText').value); return false; } }]);
  },
  reseed() { openDialog('<h3>重設為示範資料？</h3><p>目前的資料會被取代。</p>', [{ label: '取消' }, { label: '重設', cls: 'warn', fn: () => { seedDemo(); Clock.offset = 0; UI.bk = null; UI.addCh = null; UI.tl.center = null; UI.open = {}; render(); toast('已重設為示範資料'); } }]); },
  wipe() { openDialog('<h3>清空全部資料？</h3><p>會留下一個空白角色讓你從頭開始。</p>', [{ label: '取消' }, { label: '清空', cls: 'warn', fn: () => { Store.data = Store.empty(); Clock.offset = 0; const a = Game.createAccount('我的帳號'); const r = Game.createRole({ name: '我', birthY: 1990, birthM: 1, accountId: a.id }); Store.data.meta.currentRole = r.id; UI.open = {}; Game.commit(); render(); toast('已清空，可到角色表修改角色'); } }]); },
  theme(b) { if (b.dataset.v) document.documentElement.setAttribute('data-theme', b.dataset.v); else document.documentElement.removeAttribute('data-theme'); try { localStorage.setItem('arrive-theme', b.dataset.v); } catch (e) {} }
};
async function saveFile(name, data, quiet) {
  try {
    if (!UI.downloads && window.claude && window.claude.use) UI.downloads = await window.claude.use('downloads');
    if (UI.downloads) { await UI.downloads.save({ filename: name, data }); toast('已儲存'); return true; }
  } catch (e) { if (e && e.code === 'declined') { toast('已取消儲存'); return true; } }
  if (!quiet) alertBox('無法下載', '這個環境不提供下載。請改用列印，或把頁面存成 PDF。');
  return false;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; const f = ACT[b.dataset.act]; if (f) { e.preventDefault(); f(b, e); } });

/* ===================== 啟動 ===================== */
(function boot() {
  try { const th = localStorage.getItem('arrive-theme'); if (th) document.documentElement.setAttribute('data-theme', th); } catch (e) {}
  if (!Store.load()) seedDemo();
  Clock.offset = Store.data.meta.clockOffset || 0;
  Game.tick(); Game.commit();
  route(); render(); loop();
})();
