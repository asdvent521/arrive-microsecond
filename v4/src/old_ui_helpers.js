function readout(us) {
  const f = fmtUs(us); const [a, b] = f.split('.');
  return `<div class="readout" aria-label="${esc(f)}"><span class="dt">${esc(a)}</span><span class="dot">.</span><span class="us">${esc(b)}</span></div>`;
}
function countdownText(target) {
  let d = target - Clock.now(); const past = d < 0; d = Math.abs(d);
  const days = Math.floor(d / DAY); d -= days * DAY; const h = Math.floor(d / HOUR); d -= h * HOUR; const m = Math.floor(d / MIN); d -= m * MIN; const s = Math.floor(d / SEC); const us = Math.floor(d - s * SEC);
  const str = `${days} 天 ${pad(h)}:${pad(m)}:${pad(s)}.${pad(us, 6)}`;
  return past ? `已經過了 ${str}` : `還有 ${str}`;
}
function roleOptions(ids, sel) { return ids.map(id => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(roleName(id))}</option>`).join(''); }
function consentBox(ids, label) {
  return `<fieldset class="sec" style="padding:10px 14px;margin:10px 0"><legend class="small muted">${esc(label || '全員同意')}（同一台裝置模擬多位玩家，請逐一勾選）</legend>` +
    ids.map(id => `<label class="check"><input type="checkbox" name="consent[]" value="${id}"> ${esc(roleName(id))} 同意</label>`).join('') + '</fieldset>';
}
function dockCondRow(c) {
  const f = c ? c.field : 'qRate';
  return `<div class="sec rrow" style="padding:10px;margin:0 0 8px">
    <div class="row"><select name="dcField[]" style="flex:2;min-width:12em">${Object.entries(DOCK_FIELDS).map(([k, v]) => `<option value="${k}" ${k === f ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
    <select name="dcOp[]" style="width:8em">${Object.entries(COND_OPS).map(([k, v]) => `<option value="${k}" ${c && c.op === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <input name="dcVal[]" inputmode="decimal" value="${c ? c.value : ''}" placeholder="數值" style="width:6em"></div>
    <div class="row small" style="margin-top:6px"><label class="inl"><span class="muted">主體成員</span><select name="dcScope[]" style="width:auto">${Object.entries(SCOPE_OPTS).map(([k, v]) => `<option value="${k}" ${c && c.scope === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="inl"><span class="muted">資源名稱</span><input name="dcRes[]" value="${esc(c && c.res || '')}" style="width:9em" placeholder="例如 陪跑"></label>
    <button type="button" class="btn sm warn" data-act="rmRow">移除</button></div></div>`;
}
function dockCondEditor(conds) {
  return `<div class="small muted" style="margin:6px 0">對接條件只看對方的規則表，必須可計算，多條須全部符合。「主體成員」只用在僵局處理與合作天數；「資源名稱」只用在資源條件。不設條件代表所有碰撞者都能排隊。</div>
    <div class="dc-rows">${(conds || []).map(dockCondRow).join('')}</div><button type="button" class="btn sm" data-act="addDockCond">新增對接條件</button>`;
}
function readDockConds(form) {
  const v = formVals(form); const fs = v['dcField[]'] || [];
  return fs.map((field, i) => {
    const c = { field, op: v['dcOp[]'][i], value: Number(v['dcVal[]'][i]) };
    if (String(v['dcVal[]'][i]).trim() === '') c.value = NaN;
    if (DOCK_FIELDS[field] && DOCK_FIELDS[field].member) c.scope = v['dcScope[]'][i];
    if (DOCK_FIELDS[field] && DOCK_FIELDS[field].needRes) c.res = (v['dcRes[]'][i] || '').trim();
    return c;
  });
}
function dockCondList(conds, candId, subjectIds) {
  if (!conds || !conds.length) return '<p class="small muted">沒有設定對接條件，所有碰撞者都能排隊。</p>';
  const miss = candId ? evalDockConds(conds, candId, subjectIds) : [];
  return `<ul class="small" style="margin:4px 0;padding-left:1.2em">${conds.map(c => { const t = dockCondText(c); const bad = candId && miss.includes(t);
    return `<li>${esc(t)}${candId ? (bad ? ' <span class="tag rose">未達到</span>' : ' <span class="tag teal">符合</span>') : ''}</li>`; }).join('')}</ul>`;
}
function ageOf(r, at) { const p = usParts(at || Clock.now()); let a = p.y - r.birthY; if (p.mo < r.birthM) a--; return Math.max(0, a); }

/* ===================== 出發點輸入 ===================== */
function pointInput(prefix, us, tails) {
  const p = usParts(us);
  const f = (k, v, cls, lab, max) => `<label>${lab}<input class="${cls}" name="${prefix}_${k}" inputmode="numeric" pattern="[0-9]*" maxlength="${max}" value="${v}" autocomplete="off"></label>`;
  return `<div class="pt-in" data-pt="${prefix}">${f('y', p.y, 'w4', '年', 4)}${f('mo', pad(p.mo), 'w2', '月', 2)}${f('d', pad(p.d), 'w2', '日', 2)}` +
    `${f('h', pad(p.h), 'w2', '時', 2)}${f('mi', pad(p.mi), 'w2', '分', 2)}${f('s', pad(p.s), 'w2', '秒', 2)}${f('micro', pad(p.micro, 6), 'w6', '微秒', 6)}</div>` +
    (tails && tails.length ? `<div class="row small" style="margin-top:6px"><span class="muted">帶入常用尾數：</span>${tails.map(t => `<button type="button" class="btn sm" data-act="tail" data-p="${prefix}" data-s="${t.s}" data-u="${t.micro}">${pad(t.s)}.${pad(t.micro, 6)}${t.label ? '（' + esc(t.label) + '）' : ''}</button>`).join('')}</div>` : '') +
    `<div class="pt-preview small" data-prev="${prefix}"></div>`;
}
function readPoint(form, prefix) {
  const g = k => form.querySelector(`[name="${prefix}_${k}"]`).value.trim();
  const p = { y: int(g('y')), mo: int(g('mo')), d: int(g('d')), h: int(g('h')), mi: int(g('mi')), s: int(g('s')) };
  const ms = g('micro');
  if (!/^\d{1,6}$/.test(ms)) throw new GameError('微秒必須是 0 到 999999 的數字');
  p.micro = parseInt(ms, 10);
  if (![p.y, p.mo, p.d, p.h, p.mi, p.s].every(Number.isInteger)) throw new GameError('請把年、月、日、時、分、秒都填成數字');
  if (p.mo < 1 || p.mo > 12 || p.h > 23 || p.mi > 59 || p.s > 59 || p.h < 0 || p.mi < 0 || p.s < 0) throw new GameError('時間超出範圍');
  const us = usFrom(p); const back = usParts(us);
  if (back.d !== p.d || back.mo !== p.mo) throw new GameError('這一天不存在，請檢查日期');
  return us;
}
function updatePreview(box) {
  const form = box.closest('form'); const prefix = box.dataset.pt; const prev = form.querySelector(`[data-prev="${prefix}"]`);
  if (!prev) return;
  try {
    const us = readPoint(form, prefix);
    let h = `<span class="muted">將寫下：</span><span class="num">${esc(fmtUs(us))}</span>`;
    if (us <= Clock.now()) h += `<div class="err">出發點必須晚於現在這一刻。</div>`;
    else if (guessable(us)) h += `<div class="note">這個出發點容易被陌生人撞到。可以把秒數與微秒改得更不好猜，或使用你和熟人約好的常用尾數。</div>`;
    prev.innerHTML = h;
  } catch (e) { prev.innerHTML = `<span class="muted">${esc(e.message)}</span>`; }
}
document.addEventListener('input', e => { const box = e.target.closest('.pt-in'); if (box) updatePreview(box); });
