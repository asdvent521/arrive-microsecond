/* ===================== 規則表的列內編輯 ===================== */
const selF = (name, opts, v) => `<select name="${name}" form="rulesForm">${Object.entries(opts).map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
function fnEd(k, f) {
  return `<select name="${k}FnType" form="rulesForm">${Object.entries({ none: '不隨合作天數變化', step: '隨合作天數分段提高' }).map(([a, b]) => `<option value="${a}" ${a === f.type ? 'selected' : ''}>${b}</option>`).join('')}</select>
    <span class="inl small">每滿 <input name="${k}FnDays" inputmode="numeric" value="${f.days}" form="rulesForm"> 天提高 <input name="${k}FnPct" inputmode="numeric" value="${f.pct}" form="rulesForm">%，最多 <input name="${k}FnCap" inputmode="numeric" value="${f.cap}" form="rulesForm">%</span>`;
}
function resRow(x) { return `<div class="row rrow" style="margin-bottom:4px;flex-wrap:nowrap"><input name="resName[]" value="${esc(x ? x.name : '')}" placeholder="資源名稱" form="rulesForm" style="min-width:7em"><input name="resKcal[]" inputmode="numeric" value="${x ? x.kcal : ''}" placeholder="大卡" form="rulesForm" style="width:5em"><button type="button" class="btn sm warn" data-act="rmRow" aria-label="移除這項資源">移除</button></div>`; }
function condRow(c) {
  return `<div class="row rrow" style="margin-bottom:4px;flex-wrap:nowrap"><select name="cField[]" form="rulesForm">${Object.entries(COND_FIELDS).map(([k, v]) => `<option value="${k}" ${c && c.field === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
    <select name="cOp[]" form="rulesForm" style="width:6.5em">${Object.entries(COND_OPS).map(([k, v]) => `<option value="${k}" ${c && c.op === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <input name="cVal[]" inputmode="decimal" value="${c ? c.value : ''}" placeholder="數值" form="rulesForm" style="width:5em"><button type="button" class="btn sm warn" data-act="rmRow" aria-label="移除這條條件">移除</button></div>`;
}
function readRulesForm(f) {
  const v = formVals(f); const n = k => int(v[k]);
  const names = v['resName[]'] || [], kcals = v['resKcal[]'] || [];
  const rules = {
    q: { per: n('qPer'), kcal: n('qKcal') }, z: { per: n('zPer'), kcal: n('zKcal') },
    qFn: { type: v.qFnType, days: n('qFnDays'), pct: n('qFnPct'), cap: n('qFnCap') }, zFn: { type: v.zFnType, days: n('zFnDays'), pct: n('zFnPct'), cap: n('zFnCap') },
    stack: !!v.stack, resources: names.map((x, i) => ({ name: x.trim(), kcal: int(kcals[i]) })).filter(x => x.name || !isNaN(x.kcal)), priority: v.priority,
    deadlock: { opt: v.dl, text: v.dlt || '' }, interp: { opt: v.ip, text: v.ipt || '' }, exit: v.exit, queue: { max: n('qm'), waitDays: n('qw'), text: v.qt || '' }
  };
  const fs = v['cField[]'] || [], ops = v['cOp[]'] || [], vals = v['cVal[]'] || [];
  const conds = fs.map((x, i) => ({ field: x, op: ops[i], value: Number(vals[i]) })).filter((c, i) => String(vals[i]).trim() !== '');
  return { rules, conds, note: v.note };
}
function updateTry() {
  const f = $('#rulesForm'); const out = $('#tryOut'); if (!f || !out) return;
  const { rules, conds } = readRulesForm(f); const N = int($('#tryN').value) || 0, Dd = int($('#tryD').value) || 0;
  const errs = [...validateRules(rules), ...validateConds(conds)];
  if (errs.length) out.innerHTML = `<span style="color:var(--rose)">${esc(errs[0])}</span>`;
  else {
    const q = epp(rules, 'q', Dd) * N, z = epp(rules, 'z', Dd) * N;
    out.innerHTML = `${N} 題點 ≈ ${q.toFixed(1)} 大卡；${N} 戰點 ≈ ${z.toFixed(1)} 大卡。` + rules.resources.map(x => `<br>兌現「${esc(x.name)}」（${x.kcal} 大卡）最少需要 ${Math.ceil(x.kcal / epp(rules, 'q', Dd) - 1e-9)} 題點或 ${Math.ceil(x.kcal / epp(rules, 'z', Dd) - 1e-9)} 戰點`).join('');
  }
  if (!validateConds(conds).length && $('#condCount')) {
    const others = DB.list('roles', r => r.id !== me());
    const ok = others.filter(o => { const R = rulesOf(o.id); return conds.every(x => cmp(COND_FIELDS[x.field].get(R, o.id), x.op, x.value)); });
    $('#condCount').textContent = `目前有 ${ok.length} 個角色（共 ${others.length} 個）符合你的可見條件。`;
  }
}
const inRulesForm = t => (t.form && t.form.id === 'rulesForm') || t.id === 'tryN' || t.id === 'tryD';
document.addEventListener('input', e => { if (inRulesForm(e.target)) updateTry(); });
document.addEventListener('change', e => { if (inRulesForm(e.target)) updateTry(); });
function kv(rows) { return `<table class="ws" style="width:auto;min-width:0"><tbody>${rows.map(([k, v]) => `<tr><th style="position:static">${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>`; }
function rulesSummary(rid) {
  const R = rulesOf(rid); const v = currentVersion(rid);
  return `<div class="small muted" style="margin:6px 0 2px">${L('rules', R.id, esc(roleName(rid)) + '的規則表')}（${L('ruleVersions', v.id, 'v' + v.no)}，維持 ${stableDays(rid)} 天）</div>` + kv([
    ['題點兌換', esc(rateText(R.q)) + '；' + esc(fnText(R.qFn))], ['戰點兌換', esc(rateText(R.z)) + '；' + esc(fnText(R.zFn))], ['疊加', R.stack ? '可' : '不可'],
    ['資源', R.resources.map(x => `${esc(x.name)} ${x.kcal}`).join('、')], ['兌換優先', PRIORITY_OPTS[R.priority]], ['僵局處理', esc(optText(R.deadlock, DEADLOCK_OPTS))],
    ['退出處理', EXIT_OPTS[R.exit]], ['排隊規則', `最多 ${R.queue.max} 位，每位最多等 ${R.queue.waitDays} 天`], ['解釋權', esc(optText(R.interp, INTERP_OPTS))]]);
}

/* ===================== 難題：下一步與抽屜 ===================== */
function problemNext(p) {
  if (!p.participants.includes(me())) return '';
  if (p.participants.length === 1 && ['進行中', '擱置'].includes(p.status) && !Game.activeDeparture(p.id)) return `<button class="btn sm brass" data-act="jump" data-s="problems" data-id="${p.id}" data-open="1">寫下出發點</button>`;
  const st = stationFor(p.id);
  if (st && involved(st, me()) && ['open', 'started'].includes(st.status)) return L('stations', st.id, '到出發點');
  return '';
}
function problemDrawer(p) {
  const r = me(); const mine = p.participants.includes(r);
  let h = `<div class="grid2"><div class="box"><h3>${esc(p.name)}</h3><p class="small"><span class="muted">情況：</span>${txt(p.situation)}</p><p class="small"><span class="muted">目標：</span>${txt(p.goal)}</p></div>`;
  if (mine && p.participants.length === 1 && ['進行中', '擱置'].includes(p.status)) {
    const d = new Date(Math.floor(p.occurredAt / 1000));
    h += `<form class="box" onsubmit="return false" data-pid="${p.id}"><h3>修改內容</h3>
      <label class="f"><span>名稱</span><input name="name" value="${esc(p.name)}"></label>
      <label class="f"><span>發生時間</span><input type="date" name="occ" value="${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}"></label>
      <label class="f"><span>情況</span><textarea name="situation">${esc(p.situation)}</textarea></label>
      <label class="f"><span>目標</span><textarea name="goal">${esc(p.goal)}</textarea></label>
      <button type="button" class="btn sm pri" data-act="saveProblem">儲存</button></form>`;
  }
  h += '</div>';
  const canConds = mine && !['已融合', '完成'].includes(p.status);
  const stF = p.participants.length > 1 ? DB.find('stations', s => s.fusedProblemId === p.id) : null;
  h += `<div class="box"><h3>對接條件</h3><p class="small muted">決定誰能排隊加入這個難題。碰撞時與對接時各檢查一次。</p>${dockCondList(p.dockConds)}
    ${canConds ? `<details><summary>修改對接條件</summary><form onsubmit="return false" data-pid="${p.id}">${dockCondEditor(p.dockConds)}
      ${p.participants.length > 1 ? consentBox(stF ? stF.subject : p.participants, '主體全員同意修改') : ''}
      <div style="margin-top:6px"><button type="button" class="btn sm pri" data-act="saveDockConds">儲存對接條件</button></div></form></details>` : ''}</div>`;
  if (mine && p.participants.length === 1 && ['進行中', '擱置'].includes(p.status) && !Game.activeDeparture(p.id)) {
    const tails = DB.list('tails', t => t.roleId === r);
    h += `<div class="box"><h3>寫下出發點</h3><p class="small muted">出發點就是你開始挑戰的那一刻，由你親手決定，精確到微秒。它也是一組暗號：只有知道的熟人會寫下同一個時間，陌生人撞不進來。</p>
      <form onsubmit="return false" data-pid="${p.id}">${pointInput('pt', usFrom({ ...usParts(addDays(Clock.now(), 7)), s: 0, micro: 0 }), tails)}
      <div style="margin-top:8px"><button type="button" class="btn brass" data-act="writeDep">寫下出發點</button></div></form></div>`;
  }
  return h;
}

/* ===================== 出發點：下一步與抽屜 ===================== */
function stationNext(st) {
  const r = me(); const head = st.status === 'open' ? st.queue[0] : null;
  if (st.subject.includes(r) && head) return `<button class="btn sm brass" data-act="jump" data-s="stations" data-id="${st.id}" data-open="1">對接 ${esc(roleName(head.roleId))}</button>`;
  if (st.queue.some(q => q.roleId === r)) return `<button class="btn sm" data-act="jump" data-s="stations" data-id="${st.id}" data-open="1">查看排隊</button>`;
  if (st.subject.includes(r) && Game.readyForHeat(st)) return LQ('heat', code(Game.currentProblemId(st)), '填寫熱量');
  return '';
}
function stationDrawer(st) {
  const r = me(); const isSub = st.subject.includes(r); const qi = st.queue.findIndex(q => q.roleId === r);
  const head = st.status === 'open' ? st.queue[0] : null;
  let h = `<div class="box">${readout(st.point)}${st.status === 'open' ? `<div class="count" data-count="${st.point}">${esc(countdownText(st.point))}</div><p class="small muted">出發點一到，融合就結束，仍在排隊的角色會自動退出，主體以現有成員開始挑戰。排隊規則：最多 ${queueRule(st).max} 位，每位最多等 ${queueRule(st).waitDays} 天。</p>` : ''}
    ${st.closedReason ? `<p class="small muted">${esc(st.closedReason)}</p>` : ''}${(st.members || []).length ? `<p class="small muted">已退出：${st.members.map(roleName).map(esc).join('、')}</p>` : ''}</div>`;
  if (qi >= 0) {
    h += `<div class="box"><div class="note">你排在第 ${qi + 1} 位。${qi === 0 ? '等主體和你對接。' : ''}加入後，你的難題內容會讓主體的所有成員看到。你隨時可以退出排隊。</div>
      <h3>這個難題的對接條件</h3>${dockCondList(DB.get('problems', Game.currentProblemId(st)).dockConds, r, st.subject)}
      <p class="small muted">對接時會再檢查一次。如果你之後修改規則而不再符合，主體就不能和你對接。</p>
      <h3>主體的規則</h3>${st.subject.length > 1 ? `<p class="small">共同規則：${commonText(st.common)}</p>` : ''}${st.subject.map(id => rulesSummary(id)).join('')}
      <div style="margin-top:8px"><button class="btn warn" data-act="leaveQueue" data-st="${st.id}">退出排隊</button></div></div>`;
  }
  if (isSub && head) h += `<div class="box">${dockingPanel(st, head)}</div>`;
  if (isSub && ['open', 'started'].includes(st.status)) h += `<div class="box"><h3>退出這個出發點</h3><p class="small muted">${st.subject.length > 1 ? '退出後其他成員繼續。退出前必須先完成你參與且已提交的判定。' : '主體只剩你一人。退出時依你的規則表「退出處理」：' + EXIT_OPTS[rulesOf(r).exit] + '。'}</p><button class="btn sm warn" data-act="exitStation" data-st="${st.id}">退出</button></div>`;
  return h;
}
function dockingPanel(st, head) {
  const base = st.subject.length === 1 ? rulesOf(st.subject[0]) : st.common;
  const cand = DB.get('problems', head.problemId); const cur = DB.get('problems', Game.currentProblemId(st));
  const sel = (name, opts, v) => `<select name="${name}">${Object.entries(opts).map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const trial = st.subject.map(id => { const cd = coopDays(id, head.roleId); const R = rulesOf(head.roleId), R2 = rulesOf(id);
    return [esc(roleName(id)), `${epp(R, 'q', cd).toFixed(1)}／${epp(R, 'z', cd).toFixed(1)}`, `${epp(R2, 'q', cd).toFixed(1)}／${epp(R2, 'z', cd).toFixed(1)}`, String(cd)]; });
  return `<h3>對接：${L('roles', head.roleId, esc(roleName(head.roleId)))}</h3>
    <p class="small muted">主體與排隊的下一個角色比對規則表，談妥共同規則後融合難題。主體多人時需要全員同意。</p>
    <div class="grid2"><div><div class="muted small">對方的難題</div><p>${L('problems', cand.id, refLabel('problems', cand.id))}</p><p class="small">${esc(cand.situation)}</p></div>
    <div><div class="muted small">主體目前的難題</div><p>${L('problems', cur.id, refLabel('problems', cur.id))}</p><p class="small">${esc(cur.situation)}</p></div></div>
    <h3 style="margin-top:8px">對接條件檢查</h3>${dockCondList(cur.dockConds, head.roleId, st.subject)}
    <details style="margin:8px 0"><summary>比對規則表與點數試算</summary>${rulesSummary(head.roleId)}
      <p class="small muted" style="margin-top:8px">每點可換大卡（題點／戰點）</p>
      <table class="ws" style="width:auto;min-width:0"><thead><tr class="names"><th style="position:static;padding:5px 8px">主體成員</th><th style="position:static;padding:5px 8px">在${esc(roleName(head.roleId))}那裡</th><th style="position:static;padding:5px 8px">${esc(roleName(head.roleId))}在他那裡</th><th style="position:static;padding:5px 8px">合作天數</th></tr></thead>
      <tbody>${trial.map(r => `<tr>${r.map((c, i) => `<td class="${i ? 'n' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></details>
    <form onsubmit="return false" data-st="${st.id}">
      <h3>共同規則 <span class="small muted">${st.subject.length === 1 ? '（以主體的規則表為基礎）' : '（以現有共同規則為基礎）'}</span></h3>
      <div class="grid2"><label class="f"><span>僵局處理</span>${sel('dl', DEADLOCK_OPTS, base.deadlock.opt)}<input name="dlt" placeholder="補充說明" value="${esc(base.deadlock.text)}"></label>
      <label class="f"><span>解釋權</span>${sel('ip', INTERP_OPTS, base.interp.opt)}<input name="ipt" placeholder="補充說明" value="${esc(base.interp.text)}"></label>
      <label class="f"><span>排隊上限（人）</span><input name="qm" inputmode="numeric" value="${base.queue.max}"></label>
      <label class="f"><span>排隊等待上限（天）</span><input name="qw" inputmode="numeric" value="${base.queue.waitDays}"></label></div>
      <h3>融合後的難題</h3>
      <label class="f"><span>名稱</span><input name="fn" value="${esc(cur.name + '＋' + cand.name)}"></label>
      <label class="f"><span>情況</span><textarea name="fs">${esc(cur.situation + '\n' + cand.situation)}</textarea></label>
      <label class="f"><span>目標</span><textarea name="fg">${esc(cur.goal + '\n' + cand.goal)}</textarea></label>
      <h3>融合後的對接條件 <span class="small muted">（預設沿用目前的條件）</span></h3>${dockCondEditor(cur.dockConds)}
      ${consentBox([...st.subject, head.roleId], '主體全員與對接角色同意合作')}
      <div class="row"><button type="button" class="btn brass" data-act="dock" data-ok="1">合作並融合</button><button type="button" class="btn warn" data-act="dock" data-ok="0">不合作</button></div>
    </form>`;
}

/* ===================== 挑戰：操作、抽屜、新增列 ===================== */
function chActions(c) {
  const r = me(); const st = DB.get('stations', c.stationId); const b = [];
  const btn = (act, label, cls) => `<button class="btn sm ${cls || ''}" data-act="${act}" data-ch="${c.id}">${label}</button>`;
  if (c.executor === r && c.status === '待執行') b.push(btn('acceptCh', `接下（發出 ${c.q} 題點）`, 'pri'), btn('declineCh', '婉拒', 'warn'));
  if (c.executor === r && c.status === '執行中') b.push(btn('submitCh', '提交判定', 'pri'), btn('abandonCh', '放棄', 'warn'));
  if (c.writer === r && c.status === '待判定') b.push(btn('judgeOk', `判定完成（發出 ${c.z} 戰點）`, 'pri'), btn('judgeNo', '還沒完成', 'warn'));
  if (c.status === '判定爭議中' && (c.writer === r || c.executor === r)) b.push(btn('resolveCh', '依共同規則處理'));
  if (st && st.subject.includes(r) && ['待執行', '擱置'].includes(c.status)) b.push(`<button class="btn sm" data-act="jump" data-s="challenges" data-id="${c.id}" data-open="1">修改</button>`, btn('delCh', '刪除', 'warn'));
  return `<div class="row" style="gap:4px;flex-wrap:nowrap">${b.join('')}</div>`.replace('<div class="row" style="gap:4px;flex-wrap:nowrap"></div>', '');
}
function challengeDrawer(c) {
  const st = DB.get('stations', c.stationId);
  let h = `<div class="box"><h3>紀錄</h3><ul class="small" style="margin:4px 0;padding-left:1.2em">${c.log.map(l => `<li><span class="num">${esc(fmtUs(l.at, false))}</span> ${esc(l.text)}</li>`).join('')}</ul></div>`;
  if (st.subject.includes(me()) && ['待執行', '擱置'].includes(c.status) && ['open', 'started'].includes(st.status)) h += `<div class="box"><h3>修改拆解</h3>${challengeForm(st, c)}</div>`;
  return h;
}
function challengeForm(st, c) {
  return `<form onsubmit="return false" data-st="${st.id}" data-ch="${c.id}">
    <label class="f"><span>挑戰內容</span><input name="content" value="${esc(c.content)}"></label>
    <label class="f"><span>時間節點</span>${nodeInput('nd', c.node)}</label>
    <div class="grid2"><label class="f"><span>寫出挑戰的角色</span><select name="writer">${roleOptions(st.subject, c.writer)}</select></label>
    <label class="f"><span>執行角色（負責角色）</span><select name="executor">${roleOptions(st.subject, c.executor || st.subject.find(x => x !== c.writer))}</select></label>
    <label class="f"><span>題點數量（雙方談定）</span><input name="q" inputmode="numeric" value="${c.q}"></label>
    <label class="f"><span>戰點數量（雙方談定）</span><input name="z" inputmode="numeric" value="${c.z}"></label></div>
    ${consentBox(st.subject, '主體全員同意這項修改')}
    <button type="button" class="btn sm pri" data-act="saveCh">儲存修改</button></form>`;
}
function readChallengeForm(f) {
  const v = formVals(f);
  return { c: { content: v.content || '', node: readNode(f, 'nd'), writer: v.writer, executor: v.executor, q: int(v.q), z: int(v.z) }, consents: v['consent[]'] || [] };
}
function addableStations() { return DB.list('stations', s => s.subject.includes(me()) && s.subject.length >= 2 && ['open', 'started'].includes(s.status)); }
function challengeAddCells() {
  const sts = addableStations(); if (!UI.addCh || !sts.some(s => s.id === UI.addCh.st)) UI.addCh = { st: sts[0].id };
  const st = DB.get('stations', UI.addCh.st); const fa = 'form="addF-challenges"';
  const other = st.subject.find(x => x !== me());
  return {
    st: `<select name="st" ${fa} data-act-change="addChSt">${sts.map(s => `<option value="${s.id}" ${s.id === st.id ? 'selected' : ''}>${code(s.id)}｜${esc(fmtUs(s.point))}</option>`).join('')}</select>`,
    prob: `<span class="small">${refLabel('problems', Game.currentProblemId(st))}</span>`,
    content: `<input name="content" placeholder="新挑戰內容" ${fa}>`,
    node: nodeInput('nd', Math.max(st.point, Clock.now()) + DAY, fa),
    writer: `<select name="writer" ${fa}>${roleOptions(st.subject, me())}</select>`,
    exec: `<select name="executor" ${fa}>${roleOptions(st.subject, other)}</select>`,
    q: `<input name="q" inputmode="numeric" value="1" style="width:4em" ${fa}>`, z: `<input name="z" inputmode="numeric" value="1" style="width:4em" ${fa}>`,
    op: `<form id="addF-challenges" onsubmit="return false" data-st="${st.id}"></form><div class="row small" style="gap:2px 10px"><span class="muted">全員同意：</span>${st.subject.map(id => `<label class="check"><input type="checkbox" name="consent[]" value="${id}" ${fa}> ${esc(roleName(id))}</label>`).join('')}</div><button type="button" class="btn sm pri" data-act="addCh" form="addF-challenges">新增這一列</button>`
  };
}

/* ===================== 兌換預約新增列 ===================== */
function bookingAddCells() {
  const r = me(); const held = DB.list('batches', b => b.holder === r && b.remaining > 0);
  const issuers = [...new Set(held.map(b => b.issuer))];
  const S = UI.bk && issuers.includes(UI.bk.issuer) ? UI.bk : (UI.bk = { issuer: issuers[0], res: 0, day: fmtDay(addDays(Clock.now(), 2)), uses: {} });
  const R = rulesOf(S.issuer); const cur = currentVersion(S.issuer); const cd = coopDays(r, S.issuer); const fa = 'form="bkF"';
  const bs = held.filter(b => b.issuer === S.issuer);
  const uses = bs.filter(b => S.uses[b.id]).map(b => ({ batchId: b.id, ver: S.uses[b.id] }));
  let quote;
  try { quote = uses.length ? (q => `<b>${q.cost}</b><div class="small ok" style="margin:2px 0">${q.uses.map(u => `${code(u.batchId)} ${u.n} 點`).join('＋')}${q.stack ? '（疊加）' : ''}</div>`)(Game.quote(r, S.issuer, S.res, uses)) : `<b>${R.resources[S.res] ? R.resources[S.res].kcal : ''}</b><div class="small muted">勾選點數</div>`; }
  catch (e) { quote = `<div class="small err" style="margin:0">${esc(e.message)}</div>`; }
  return {
    holder: `<span class="small">${esc(roleName(r))}</span>`,
    issuer: `<select name="issuer" ${fa}>${roleOptions(issuers, S.issuer)}</select><div class="small muted">合作 ${cd} 天，${R.stack ? '可疊加' : '不可疊加'}</div>`,
    day: `<input type="date" name="day" value="${esc(S.day)}" ${fa}>`,
    res: `<select name="res" ${fa}>${R.resources.map((x, i) => `<option value="${i}" ${i === S.res ? 'selected' : ''}>${esc(x.name)}（${x.kcal}）</option>`).join('')}</select>`,
    cost: quote,
    uses: `<div class="small">${bs.map(b => { const k = b.type === '題點' ? 'q' : 'z'; const e1 = epp(versionOf(S.issuer, b.version).snapshot, k, cd), e2 = epp(cur.snapshot, k, cd);
      return `<div style="margin-bottom:4px"><label class="check"><input type="checkbox" name="use[]" value="${b.id}" ${S.uses[b.id] ? 'checked' : ''} ${fa}> ${code(b.id)} ${b.type} 剩 ${b.remaining}</label>
        <span class="inl" style="margin-left:22px"><label class="check"><input type="radio" name="ver_${b.id}" value="issue" ${S.uses[b.id] !== 'current' ? 'checked' : ''} ${fa}> 發出 v${b.version}：${e1.toFixed(1)}</label>
        <label class="check"><input type="radio" name="ver_${b.id}" value="current" ${S.uses[b.id] === 'current' ? 'checked' : ''} ${fa}> 當前 v${cur.no}：${e2.toFixed(1)}</label></span></div>`; }).join('')}</div>`,
    op: `<form id="bkF" onsubmit="return false"></form><button type="button" class="btn sm pri" data-act="book" form="bkF">送出預約</button>`
  };
}
document.addEventListener('change', e => {
  const f = e.target.form;
  if (f && f.id === 'bkF') {
    const v = formVals(f); const prev = UI.bk || {};
    const uses = {}; (v['use[]'] || []).forEach(id => uses[id] = v['ver_' + id] || 'issue');
    UI.bk = { issuer: v.issuer, res: v.issuer !== prev.issuer ? 0 : +v.res, day: v.day, uses: v.issuer !== prev.issuer ? {} : uses };
    renderMain();
  }
  if (f && f.id === 'addF-challenges' && e.target.name === 'st') { UI.addCh = { st: e.target.value }; renderMain(); }
});

/* ===================== 通用工作表繪製 ===================== */
function cellHtml(c, r) {
  if (c.v) return c.v(r);
  const rs = refsOf(c, r);
  return rs.length ? `<div class="lks">${rs.map(x => L(x.s, x.id, refLabel(x.s, x.id))).join('')}</div>` : '<span class="muted">—</span>';
}
function sortVal(c, r) { if (c.sort) return c.sort(r); return stripTags(cellHtml(c, r)); }
function cmpVals(a, b) { if (typeof a === 'number' && typeof b === 'number') return a - b; return String(a).localeCompare(String(b), 'zh-Hant', { numeric: true }); }
function renderSheet(sk) {
  const S = SHEETS[sk]; const cols = S.cols; const st = UI.sheets[sk] = UI.sheets[sk] || {};
  const rid = S.rowId || (x => x.id);
  const recs = S.rows().slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  let list = recs.map((r, i) => ({ r, i }));
  if (st.col != null && cols[st.col]) { const c = cols[st.col]; const vals = new Map(list.map(x => [x, sortVal(c, x.r)])); list.sort((a, b) => st.dir * cmpVals(vals.get(a), vals.get(b))); }
  const open = UI.open[sk] || new Set();
  const letters = `<tr class="letters"><th class="rn"></th>${cols.map((c, i) => `<th class="${i === 0 ? 'fz' : ''}">${colLetter(i)}</th>`).join('')}</tr>`;
  const names = `<tr class="names"><th class="rn"><span class="small">列</span></th>${cols.map((c, i) => `<th class="${i === 0 ? 'fz' : ''} ${c.num ? 'n' : ''}"><button type="button" class="sh" data-act="sort" data-s="${sk}" data-c="${i}" title="依此欄排序">${esc(c.h)}${c.to ? ' <span class="muted" aria-hidden="true">⇢</span>' : ''}${st.col === i ? (st.dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr>`;
  let body = '';
  list.forEach(({ r, i }) => {
    const id = rid(r); const isOpen = open.has(id) || (sk === 'rules' && S.editRow && S.editRow(r));
    const edit = S.editRow && S.editRow(r);
    const tds = cols.map((c, ci) => `<td class="${ci === 0 ? 'fz' : ''} ${c.num ? 'n' : ''}" data-c="${ci}">${edit && c.ed ? c.ed(r) : cellHtml(c, r)}</td>`).join('');
    body += `<tr data-row data-id="${esc(id)}" data-i="${i + 1}" class="${S.mine && S.mine(r) ? 'mine' : ''} ${edit ? 'editrow' : ''}"><td class="rn"><button type="button" class="tg" data-act="toggle" data-s="${sk}" data-id="${esc(id)}" aria-expanded="${isOpen}" aria-label="${isOpen ? '收起' : '展開'}第 ${i + 1} 列">${isOpen ? '▾' : '▸'}</button>${i + 1}</td>${tds}</tr>`;
    if (isOpen) body += `<tr class="drawer" data-drawer-of="${esc(id)}"><td colspan="${cols.length + 1}"><div class="dwin">${S.drawer ? S.drawer(r) : ''}${relatedHtml(sk, r)}</div></td></tr>`;
  });
  if (S.add && S.add.when()) {
    const cells = S.add.cells();
    body += `<tr class="addrow"><td class="rn"><span aria-hidden="true">＊</span></td>${cols.map((c, ci) => `<td class="${ci === 0 ? 'fz' : ''}">${cells[c.k] != null ? cells[c.k] : '<span class="auto">自動</span>'}</td>`).join('')}</tr>`;
  }
  const empty = !recs.length ? `<div class="empty">這張表目前沒有你看得到的資料。</div>` : '';
  return `<div class="toolbar"><input class="q" data-q="${sk}" placeholder="篩選這張表" aria-label="篩選這張表" value="${esc(st.q || '')}"><span class="cnt" data-cnt="${sk}"></span>
    ${st.col != null ? `<button class="btn sm" data-act="unsort" data-s="${sk}">取消排序</button>` : ''}${open.size ? `<button class="btn sm" data-act="collapse" data-s="${sk}">全部收起</button>` : ''}</div>
    <div class="wb"><table class="ws" data-sheet="${sk}"><thead>${letters}${names}</thead><tbody>${body}</tbody></table>${empty}</div>`;
}
function applyFilter(sk) {
  const t = document.querySelector(`[data-sheet="${sk}"]`); if (!t) return;
  const q = ((UI.sheets[sk] || {}).q || '').trim().toLowerCase(); let n = 0, all = 0;
  t.querySelectorAll('tbody tr[data-row]').forEach(tr => {
    all++; const show = !q || tr.textContent.toLowerCase().includes(q); tr.hidden = !show; if (show) n++;
    const dr = tr.nextElementSibling; if (dr && dr.classList.contains('drawer')) dr.hidden = !show;
  });
  const cnt = document.querySelector(`[data-cnt="${sk}"]`); if (cnt) cnt.textContent = q ? `${n} ／ ${all} 列` : `共 ${all} 列`;
}
document.addEventListener('input', e => { const sk = e.target.dataset && e.target.dataset.q; if (!sk || !e.target.classList.contains('q')) return; (UI.sheets[sk] = UI.sheets[sk] || {}).q = e.target.value; applyFilter(sk); });

/* ===================== 名稱方塊：選取儲存格 ===================== */
document.addEventListener('click', e => {
  const td = e.target.closest('.ws[data-sheet] tbody td'); if (!td) return;
  const tr = td.parentElement; if (!tr.hasAttribute('data-row')) return;
  if (td.classList.contains('rn')) return;
  selectCell(td);
});
function selectCell(td) {
  document.querySelectorAll('.ws td.sel').forEach(x => x.classList.remove('sel'));
  td.classList.add('sel');
  const table = td.closest('table'); const sk = table.dataset.sheet; const S = SHEETS[sk]; const ci = +td.dataset.c; const tr = td.parentElement;
  const th = table.querySelectorAll('thead tr.names th')[ci + 1];
  $('#nameBox').textContent = `${S.no ? S.no : S.name}!${colLetter(ci)}${tr.dataset.i}`;
  $('#nameBox').title = `${sheetTitle(sk)}．${th ? stripTags(th.innerHTML).replace(/[▲▼⇢]/g, '').trim() : ''}．第 ${tr.dataset.i} 列`;
  const v = stripTags(td.innerHTML); $('#fxVal').textContent = v; $('#fxVal').title = v;
  UI.sel = { sk, id: tr.dataset.id, ci };
}
