/* ===================== 介面工具 ===================== */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stripTags = s => String(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const UI = { sheet: 'life', open: {}, sheets: {}, hist: [], ruleEdit: false, bk: null, addCh: null, calMonth: null, tl: { center: null, span: 31 * DAY }, tlSel: null, paper: null, downloads: null, sel: null, focus: null };
const me = () => Store.data.meta.currentRole;
const STATUS_CLASS = { '完成': 's-done', '擱置': 's-hold', '未核准': 's-hold', '判定爭議中': 's-hold', '已取消': 's-hold', '執行中': 's-go', '待判定': 's-go', '排隊中': 's-go', '待核准': 's-go', '核准': 's-done', '已融合': '', '挑戰中': 's-go', '等待出發': 's-go', '已完成': 's-done', '已擱置': 's-hold' };
const statusTag = s => `<span class="status ${STATUS_CLASS[s] || ''}">${esc(s)}</span>`;
const DEP_TEXT = { subject: '主體', queued: '排隊中', member: '已融合進主體', rejected: '未成立', declined: '主體不合作', timeout: '排隊超時', closed: '出發點到達，排隊結束', expired: '出發點到達時沒有碰撞', exited: '已退出', left: '已退出排隊' };
const ST_TEXT = { open: '等待出發', started: '挑戰中', closed: '已擱置', done: '已完成' };
const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
function alertBox(title, msg) {
  const d = $('#dlg');
  if (d.open) { const b = $('#dlgBody'); const old = b.querySelector('.err.inline'); if (old) old.remove(); b.insertAdjacentHTML('afterbegin', `<div class="err inline"><b>${esc(title)}</b><br>${esc(msg)}</div>`); b.scrollTop = 0; return; }
  openDialog(`<h3>${esc(title)}</h3><div class="err">${esc(msg)}</div>`, [{ label: '知道了', cls: 'pri' }]);
}
function run(fn, okMsg) {
  try { const r = fn(); Game.commit(); render(); if (okMsg) toast(okMsg); return r || true; }
  catch (e) { if (e instanceof GameError) alertBox('還不能這樣做', e.message); else { console.error(e); alertBox('發生錯誤', e.message); } return null; }
}
function openDialog(body, buttons) {
  const d = $('#dlg'); $('#dlgBody').innerHTML = body;
  $('#dlgFoot').innerHTML = buttons.map((b, i) => `<button type="button" class="btn ${b.cls || ''}" data-dlg="${i}">${esc(b.label)}</button>`).join('');
  d._buttons = buttons; d._gen = (d._gen || 0) + 1;
  if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } }
}
function closeDialog() { const d = $('#dlg'); try { d.close(); } catch (e) { d.removeAttribute('open'); } }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-dlg]'); if (!b) return;
  const d = $('#dlg'); const btn = d._buttons[+b.dataset.dlg]; const gen = d._gen;
  if (btn && btn.fn) { const r = btn.fn(); if (r === false || r === null || d._gen !== gen) return; }
  closeDialog();
});
function formVals(form) {
  const o = {}; const fd = new FormData(form);
  for (const [k, v] of fd.entries()) { if (k.endsWith('[]')) (o[k] = o[k] || []).push(v); else o[k] = v; }
  return o;
}
const int = v => { const n = Number(String(v).trim()); return Number.isFinite(n) && String(v).trim() !== '' ? n : NaN; };
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
function consentBox(ids, label, fa = '') {
  return `<fieldset class="box" style="margin:6px 0"><legend class="small muted">${esc(label || '全員同意')}（同一台裝置模擬多位玩家，請逐一勾選）</legend>` +
    ids.map(id => `<label class="check"><input type="checkbox" name="consent[]" value="${id}" ${fa}> ${esc(roleName(id))} 同意</label>`).join('') + '</fieldset>';
}
function ageOf(r, at) { const p = usParts(at || Clock.now()); let a = p.y - r.birthY; if (p.mo < r.birthM) a--; return Math.max(0, a); }
const colLetter = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

/* ===================== 對接條件編輯 ===================== */
function dockCondRow(c) {
  const f = c ? c.field : 'qRate';
  return `<div class="box rrow" style="padding:8px;margin:0 0 6px">
    <div class="row"><select name="dcField[]" style="flex:2;min-width:12em">${Object.entries(DOCK_FIELDS).map(([k, v]) => `<option value="${k}" ${k === f ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
    <select name="dcOp[]" style="width:8em">${Object.entries(COND_OPS).map(([k, v]) => `<option value="${k}" ${c && c.op === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <input name="dcVal[]" inputmode="decimal" value="${c ? c.value : ''}" placeholder="數值" style="width:6em"></div>
    <div class="row small" style="margin-top:4px"><label class="inl"><span class="muted">主體成員</span><select name="dcScope[]" style="width:auto">${Object.entries(SCOPE_OPTS).map(([k, v]) => `<option value="${k}" ${c && c.scope === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="inl"><span class="muted">資源名稱</span><input name="dcRes[]" value="${esc(c && c.res || '')}" style="width:9em" placeholder="例如 陪跑"></label>
    <button type="button" class="btn sm warn" data-act="rmRow">移除</button></div></div>`;
}
function dockCondEditor(conds) {
  return `<div class="small muted" style="margin:4px 0">對接條件只看對方的規則表，必須可計算，多條須全部符合。「主體成員」只用在僵局處理與合作天數；「資源名稱」只用在資源條件。不設條件代表所有碰撞者都能排隊。</div>
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
const condsText = cs => cs && cs.length ? cs.map(dockCondText).map(esc).join('；') : '<span class="muted">無</span>';
const visCondText = cs => cs && cs.length ? cs.map(x => `${COND_FIELDS[x.field].label} ${COND_OPS[x.op]} ${x.value}`).map(esc).join('；') : '沒有條件';
const commonText = c => c ? `${esc(optText(c.deadlock, DEADLOCK_OPTS))}；${esc(optText(c.interp, INTERP_OPTS))}；排隊 ${c.queue.max} 位、${c.queue.waitDays} 天` : '<span class="muted">尚無（依主體規則表）</span>';

/* ===================== 出發點與時間節點輸入 ===================== */
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
  const form = box.closest('form'); if (!form) return; const prefix = box.dataset.pt; const prev = form.querySelector(`[data-prev="${prefix}"]`);
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
// 時間節點：日期時間到秒，另填六位微秒
function nodeInput(prefix, us, fa = '') {
  const p = usParts(us);
  return `<span class="nd-in"><input type="datetime-local" step="1" name="${prefix}_dt" value="${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}" aria-label="時間節點" ${fa}>` +
    `<input class="us6" name="${prefix}_us" inputmode="numeric" maxlength="6" value="${pad(p.micro, 6)}" aria-label="微秒" ${fa}></span>`;
}
function readNode(form, prefix) {
  const v = formVals(form); const dt = v[prefix + '_dt'] || ''; const us = String(v[prefix + '_us'] || '').trim();
  const m = dt.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) throw new GameError('請填寫時間節點的日期與時間');
  if (!/^\d{1,6}$/.test(us)) throw new GameError('時間節點的微秒必須是 0 到 999999 的數字');
  return usFrom({ y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +(m[6] || 0), micro: parseInt(us, 10) });
}

/* ===================== 編號與連結 ===================== */
const PREFIX = { roles: 'U', problems: 'P', stations: 'S', departures: 'D', dockings: 'K', fusions: 'F', challenges: 'C', batches: 'B', bookings: 'R', ruleVersions: 'V', rules: 'G' };
let CODES = {};
function buildCodes() {
  CODES = {};
  Object.entries(PREFIX).forEach(([col, p]) => {
    [...Store.data[col]].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1)).forEach((r, i) => { CODES[r.id] = p + '-' + pad(i + 1, 3); });
  });
}
const code = id => CODES[id] || '—';
function sheetTitle(s) { const S = SHEETS[s]; return S ? (S.no ? '表 ' + S.no + ' ' : '') + S.name : s; }
function L(s, id, text, open) {
  if (!id) return '<span class="muted">—</span>';
  return `<button type="button" class="lk" data-act="jump" data-s="${s}" data-id="${esc(id)}"${open ? ' data-open="1"' : ''} title="前往${esc(sheetTitle(s))}">${text}</button>`;
}
function LQ(s, q, text) { return `<button type="button" class="lk" data-act="jump" data-s="${s}" data-q="${esc(q)}" title="在${esc(sheetTitle(s))}篩選">${text}</button>`; }
function refLabel(s, id) {
  if (s === 'roles') return esc(roleName(id));
  if (s === 'problems') { const p = DB.get('problems', id); return p ? `${code(id)} ${esc(p.name)}` : code(id); }
  if (s === 'stations') { const st = DB.get('stations', id); return st ? `${code(id)}｜${esc(fmtUs(st.point))}` : code(id); }
  if (s === 'ruleVersions') { const v = DB.get('ruleVersions', id); return v ? `${esc(roleName(v.roleId))} v${v.no}` : code(id); }
  if (s === 'rules') { const r = DB.get('rules', id); return r ? `${esc(roleName(r.roleId))}的規則` : code(id); }
  return code(id);
}
const ruleRowId = roleId => { const r = rulesOf(roleId); return r ? r.id : null; };
