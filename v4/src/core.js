/* ===================== 時間（微秒） ===================== */
const SEC = 1e6, MIN = 6e7, HOUR = 3.6e9, DAY = 8.64e10;
const DAILY_CAP = 1800;
const pad = (n, l = 2) => String(n).padStart(l, '0');
function usParts(us) {
  const s = Math.floor(us / SEC); const d = new Date(s * 1000);
  return { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds(), micro: us - s * SEC };
}
function usFrom(p) { return new Date(p.y, p.mo - 1, p.d, p.h || 0, p.mi || 0, p.s || 0).getTime() * 1000 + (p.micro || 0); }
function fmtUs(us, micro = true) {
  if (us == null) return '—';
  const p = usParts(us);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)} ${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}` + (micro ? '.' + pad(p.micro, 6) : '');
}
function fmtDay(us) { const p = usParts(us); return `${p.y}-${pad(p.mo)}-${pad(p.d)}`; }
function dayStart(us) { const d = new Date(Math.floor(us / 1000)); d.setHours(0, 0, 0, 0); return d.getTime() * 1000; }
function addDays(us, n) { const d = new Date(Math.floor(us / 1000)); d.setDate(d.getDate() + n); return d.getTime() * 1000 + (us % 1000); }

const Clock = {
  offset: 0,
  real() {
    const sub = (typeof performance !== 'undefined') ? Math.floor((performance.now() % 1) * 1000) : 0;
    return Date.now() * 1000 + sub;
  },
  now() { return this.real() + this.offset; }
};

/* ===================== 資料存取模組 ===================== */
// 之後改接伺服器時，只替換 Store / DB 這一層。
const SCHEMA_VERSION = 2;
function migrate(d) {
  if (d && d.schemaVersion === 1) { (d.problems || []).forEach(p => { if (!p.dockConds) p.dockConds = []; }); d.schemaVersion = 2; }
  return d;
}
const COLS = ['accounts', 'roles', 'rules', 'visConds', 'ruleVersions', 'tails', 'problems', 'departures', 'stations',
  'dockings', 'fusions', 'challenges', 'batches', 'bookings', 'heat'];
const VISIBILITY = {
  accounts: 'private', roles: 'public', rules: 'public', visConds: 'conditional', ruleVersions: 'public', tails: 'private',
  problems: 'participants', departures: 'private', stations: 'participants', dockings: 'participants',
  fusions: 'participants', challenges: 'participants', batches: 'private', bookings: 'private', heat: 'participants'
};
let _uidSeq = 0;
function uid(prefix) { _uidSeq++; return prefix.slice(0, 3) + '_' + Date.now().toString(36) + _uidSeq.toString(36) + Math.random().toString(36).slice(2, 6); }

const Store = {
  key: 'arrive-that-microsecond-v1',
  data: null,
  mem: null,
  empty() {
    const d = { schemaVersion: SCHEMA_VERSION, meta: { clockOffset: 0, currentRole: null, currentAccount: null }, pendingUploads: [] };
    COLS.forEach(c => d[c] = []);
    return d;
  },
  load() {
    let raw = null;
    try { raw = localStorage.getItem(this.key); } catch (e) { raw = this.mem; }
    try { this.data = raw ? migrate(JSON.parse(raw)) : null; } catch (e) { this.data = null; }
    if (!this.data || this.data.schemaVersion !== SCHEMA_VERSION) this.data = null;
    return this.data;
  },
  save() {
    const s = JSON.stringify(this.data);
    try { localStorage.setItem(this.key, s); } catch (e) { this.mem = s; }
  },
  exportJSON() { return JSON.stringify({ app: '到達那微秒', ...this.data }, null, 2); },
  importJSON(text) {
    const d = migrate(JSON.parse(text));
    if (d.schemaVersion !== SCHEMA_VERSION) throw new Error('資料格式版本不符（需要 ' + SCHEMA_VERSION + '，檔案為 ' + d.schemaVersion + '）');
    COLS.forEach(c => { if (!Array.isArray(d[c])) d[c] = []; });
    delete d.app;
    this.data = d; this.save();
  }
};

const DB = {
  all(col) { return Store.data[col]; },
  list(col, pred) { return Store.data[col].filter(r => !r.deleted && (!pred || pred(r))); },
  get(col, id) { return Store.data[col].find(r => r.id === id && !r.deleted) || null; },
  find(col, pred) { return Store.data[col].find(r => !r.deleted && pred(r)) || null; },
  insert(col, obj, by, at) {
    const t = at != null ? at : Clock.now();
    const r = { id: uid(col), createdAt: t, updatedAt: t, createdBy: by || Store.data.meta.currentRole || null,
      deleted: false, visibility: VISIBILITY[col], tsSource: 'local', ...obj };
    Store.data[col].push(r); this.queue('insert', col, r.id);
    return r;
  },
  update(col, id, patch, at) {
    const r = Store.data[col].find(x => x.id === id);
    if (!r) return null;
    Object.assign(r, patch, { updatedAt: at != null ? at : Clock.now() });
    this.queue('update', col, id);
    return r;
  },
  remove(col, id) { return this.update(col, id, { deleted: true }); },
  queue(op, col, id) { Store.data.pendingUploads.push({ op, col, id, at: Clock.now() }); if (Store.data.pendingUploads.length > 500) Store.data.pendingUploads.shift(); }
};

/* ===================== 規則（必須可計算） ===================== */
const DEADLOCK_OPTS = { third: '找指定的第三方仲裁', shelve: '擱置該項目', redo: '重新拆解後再議', custom: '自訂' };
const INTERP_OPTS = { issuer: '規則發出者解釋', both: '雙方共同解釋', third: '指定的第三方解釋', custom: '自訂' };
const EXIT_OPTS = { shelve: '難題擱置', handover: '由排隊第一位接手成為主體' };
const PRIORITY_OPTS = { fifo: '依預約先後', coop: '合作天數多者優先（同天數依預約先後）', small: '所需能量點少者優先（相同時依預約先後）' };
const COND_FIELDS = {
  qRate: { label: '題點每點可換大卡', get: r => r.q.kcal / r.q.per },
  zRate: { label: '戰點每點可換大卡', get: r => r.z.kcal / r.z.per },
  stack: { label: '可疊加（是＝1，否＝0）', get: r => r.stack ? 1 : 0 },
  resCount: { label: '資源項目數', get: r => r.resources.length },
  queueMax: { label: '排隊上限人數', get: r => r.queue.max },
  stableDays: { label: '規則版本維持天數', get: (r, roleId) => stableDays(roleId) }
};
const COND_OPS = { '>=': '大於等於', '<=': '小於等於', '=': '等於' };
// 對接條件（寫在難題上，只看對方規則表；member:true 的欄位需指定「每一位／任一」成員）
const DOCK_FIELDS = {
  qRate: { label: '題點每點可換大卡', get: (r) => r.q.kcal / r.q.per },
  zRate: { label: '戰點每點可換大卡', get: (r) => r.z.kcal / r.z.per },
  stack: { label: '可疊加（是＝1，否＝0）', get: (r) => r.stack ? 1 : 0 },
  hasRes: { label: '資源清單包含指定資源（是＝1，否＝0）', get: (r, cid, m, c) => r.resources.some(x => x.name.includes(c.res || '')) ? 1 : 0, needRes: true },
  resCount: { label: '資源項目數', get: (r) => r.resources.length },
  stableDays: { label: '規則版本維持天數', get: (r, cid) => stableDays(cid) },
  sameDeadlock: { label: '僵局處理與主體相同（是＝1，否＝0）', get: (r, cid, m) => rulesOf(m).deadlock.opt === r.deadlock.opt ? 1 : 0, member: true },
  coopDays: { label: '與主體的合作天數', get: (r, cid, m) => coopDays(cid, m), member: true }
};
const SCOPE_OPTS = { each: '與每一位成員', any: '與任一成員' };
function cmp(v, op, x) { return op === '>=' ? v >= x : op === '<=' ? v <= x : Math.abs(v - x) < 1e-9; }
function dockCondText(c) {
  const f = DOCK_FIELDS[c.field]; if (!f) return '（無效條件）';
  return (f.member ? SCOPE_OPTS[c.scope] + '：' : '') + f.label.replace(/（.*）/, '') + (f.needRes ? `「${c.res}」` : '') + ' ' + COND_OPS[c.op] + ' ' + c.value;
}
function validateDockConds(conds) {
  const e = [];
  (conds || []).forEach((c, i) => {
    const f = DOCK_FIELDS[c.field];
    if (!f) e.push(`第 ${i + 1} 條對接條件的欄位無效`);
    if (!COND_OPS[c.op]) e.push(`第 ${i + 1} 條對接條件的比較方式無效`);
    if (typeof c.value !== 'number' || !isFinite(c.value)) e.push(`第 ${i + 1} 條對接條件的數值必須是數字`);
    if (f && f.member && !SCOPE_OPTS[c.scope]) e.push(`第 ${i + 1} 條對接條件要指定「與每一位成員」或「與任一成員」`);
    if (f && f.needRes && !String(c.res || '').trim()) e.push(`第 ${i + 1} 條對接條件要填寫資源名稱`);
  });
  return e;
}
// 回傳未達到的條件（空陣列代表全部符合）
function evalDockConds(conds, candId, subjectIds) {
  const r = rulesOf(candId);
  return (conds || []).filter(c => {
    const f = DOCK_FIELDS[c.field]; if (!f) return true;
    if (f.member) {
      const oks = subjectIds.map(m => cmp(f.get(r, candId, m, c), c.op, c.value));
      return !(c.scope === 'each' ? oks.every(Boolean) : oks.some(Boolean));
    }
    return !cmp(f.get(r, candId, null, c), c.op, c.value);
  }).map(dockCondText);
}

function defaultRules() {
  return {
    q: { per: 10, kcal: 50 }, z: { per: 10, kcal: 50 },
    qFn: { type: 'none', days: 30, pct: 10, cap: 50 }, zFn: { type: 'none', days: 30, pct: 10, cap: 50 },
    stack: true, resources: [{ name: '陪跑一次', kcal: 100 }], priority: 'fifo',
    deadlock: { opt: 'third', text: '' }, exit: 'shelve', queue: { max: 3, waitDays: 14, text: '' },
    interp: { opt: 'issuer', text: '' }
  };
}
const isPosInt = v => Number.isInteger(v) && v > 0;
const isNonNegInt = v => Number.isInteger(v) && v >= 0;
function validateRules(r) {
  const e = [];
  ['q', 'z'].forEach(k => {
    const n = k === 'q' ? '題點' : '戰點';
    if (!isPosInt(r[k].per)) e.push(n + '兌換的「每幾點」必須是正整數');
    if (!isPosInt(r[k].kcal)) e.push(n + '兌換的「換幾大卡」必須是正整數');
    const f = r[k + 'Fn'];
    if (f.type === 'step') {
      if (!isPosInt(f.days)) e.push(n + '函數的「每幾天」必須是正整數');
      if (!isNonNegInt(f.pct)) e.push(n + '函數的「提高幾％」必須是 0 以上的整數');
      if (!isNonNegInt(f.cap)) e.push(n + '函數的「最多提高幾％」必須是 0 以上的整數');
    }
  });
  if (!r.resources.length) e.push('資源清單至少要有一項');
  r.resources.forEach((x, i) => {
    if (!String(x.name || '').trim()) e.push(`第 ${i + 1} 項資源缺少名稱`);
    if (!isPosInt(x.kcal) || x.kcal > DAILY_CAP) e.push(`第 ${i + 1} 項資源的能量點必須是 1 到 ${DAILY_CAP} 的整數`);
  });
  if (!PRIORITY_OPTS[r.priority]) e.push('兌換優先必須選一種排序公式');
  if (!isPosInt(r.queue.max)) e.push('排隊上限必須是正整數');
  if (!isPosInt(r.queue.waitDays)) e.push('排隊等待上限（天）必須是正整數');
  if (r.deadlock.opt === 'custom' && !r.deadlock.text.trim()) e.push('僵局處理選了自訂，請填寫內容');
  if (r.interp.opt === 'custom' && !r.interp.text.trim()) e.push('解釋權選了自訂，請填寫內容');
  return e;
}
function validateConds(conds) {
  const e = [];
  conds.forEach((c, i) => {
    if (!COND_FIELDS[c.field]) e.push(`第 ${i + 1} 條可見條件的欄位無效`);
    if (!COND_OPS[c.op]) e.push(`第 ${i + 1} 條可見條件的比較方式無效`);
    if (typeof c.value !== 'number' || !isFinite(c.value)) e.push(`第 ${i + 1} 條可見條件的數值必須是數字`);
  });
  return e;
}
function fnMultiplier(fn, coopDays) {
  if (!fn || fn.type !== 'step') return 1;
  const up = Math.min(fn.cap, Math.floor(coopDays / fn.days) * fn.pct);
  return 1 + up / 100;
}
// 每一點可換的大卡（依版本快照、點數類型、合作天數）
function epp(snap, type, coopDays) {
  const base = snap[type].kcal / snap[type].per;
  return base * fnMultiplier(snap[type + 'Fn'], coopDays);
}
function rateText(x) { return `每 ${x.per} 點換 ${x.kcal} 大卡`; }
function fnText(f) { return f.type === 'step' ? `合作每滿 ${f.days} 天，比例提高 ${f.pct}%（最多 ${f.cap}%）` : '不隨合作天數變化'; }
function optText(o, table) { return o.opt === 'custom' ? '自訂：' + o.text : table[o.opt] + (o.text ? '（' + o.text + '）' : ''); }

/* ===================== 查詢工具 ===================== */
function role(id) { return DB.get('roles', id); }
function roleName(id) { const r = role(id); return r ? r.name : '（已刪除）'; }
function rulesOf(roleId) { return DB.find('rules', r => r.roleId === roleId); }
function condsOf(roleId) { return DB.find('visConds', r => r.roleId === roleId && r.current); }
function currentVersion(roleId) {
  const vs = DB.list('ruleVersions', v => v.roleId === roleId);
  return vs.reduce((a, b) => (!a || b.no > a.no ? b : a), null);
}
function versionOf(roleId, no) { return DB.find('ruleVersions', v => v.roleId === roleId && v.no === no); }
function stableDays(roleId) { const v = currentVersion(roleId); return v ? Math.floor((Clock.now() - v.createdAt) / DAY) : 0; }
function coopDays(a, b, at) {
  const t = at != null ? at : Clock.now();
  let first = null;
  DB.list('dockings', d => d.result === 'cooperate').forEach(d => {
    const set = [...d.subjectMembers, d.candidate];
    if (set.includes(a) && set.includes(b) && (first == null || d.createdAt < first)) first = d.createdAt;
  });
  return first == null ? 0 : Math.max(0, Math.floor((t - first) / DAY));
}
function meetsConds(viewerId, targetId) {
  const c = condsOf(targetId); const r = rulesOf(viewerId);
  if (!c || !r) return !c || !c.conds.length;
  return c.conds.every(x => {
    const v = COND_FIELDS[x.field].get(r, viewerId);
    return x.op === '>=' ? v >= x.value : x.op === '<=' ? v <= x.value : Math.abs(v - x.value) < 1e-9;
  });
}
function stationOfPoint(us) { return DB.find('stations', s => s.point === us && s.status === 'open'); }
function queueRule(st) {
  if (st.subject.length === 1) return rulesOf(st.subject[0]).queue;
  return st.common.queue;
}
function roleProblems(roleId) { return DB.list('problems', p => p.participants.includes(roleId)); }
function canSeeProblem(viewerId, p) {
  if (p.participants.includes(viewerId)) return true;
  return DB.list('stations').some(st => {
    const head = st.status === 'open' ? st.queue[0] : null;
    const inside = st.subject.includes(viewerId) || (st.members || []).includes(viewerId);
    if (inside && (st.history.includes(p.id) || (head && head.problemId === p.id))) return true;
    if (head && head.roleId === viewerId && st.history.includes(p.id)) return true;
    return false;
  });
}
function guessable(us) { const p = usParts(us); return p.micro % 1000 === 0 || (p.s === 0 && p.micro === 0) || /^(\d)\1{5}$/.test(pad(p.micro, 6)) || pad(p.micro, 6) === '123456'; }

/* ===================== 遊戲邏輯 ===================== */
class GameError extends Error {}
const fail = m => { throw new GameError(m); };
const Game = {
  commit() { Store.save(); },

  createAccount(name, at) { return DB.insert('accounts', { name }, null, at); },
  createRole({ name, birthY, birthM, accountId, rules, conds }, at) {
    if (!String(name || '').trim()) fail('請填寫角色名稱');
    const now = at != null ? at : Clock.now(); const np = usParts(now);
    if (!isPosInt(birthY) || !isPosInt(birthM) || birthM > 12) fail('請填寫正確的出生年月');
    if (birthY > np.y || (birthY === np.y && birthM > np.mo)) fail('出生年月不能晚於今天');
    const r = DB.insert('roles', { name: name.trim(), birthY, birthM, accountId }, null, at);
    DB.update('roles', r.id, { createdBy: r.id }, at);
    this.saveRules(r.id, rules || defaultRules(), conds || [], at, '建立角色');
    return r;
  },
  saveRules(roleId, rules, conds, at, note) {
    const errs = [...validateRules(rules), ...validateConds(conds)];
    if (errs.length) fail(errs.join('\n'));
    const t = at != null ? at : Clock.now();
    const cur = rulesOf(roleId);
    if (cur) DB.update('rules', cur.id, { ...clone(rules) }, t); else DB.insert('rules', { roleId, ...clone(rules) }, roleId, t);
    DB.list('visConds', c => c.roleId === roleId && c.current).forEach(c => DB.update('visConds', c.id, { current: false }, t));
    const cv = currentVersion(roleId); const no = cv ? cv.no + 1 : 1;
    DB.insert('visConds', { roleId, version: no, conds: clone(conds), current: true }, roleId, t);
    DB.insert('ruleVersions', { roleId, no, snapshot: clone(rules), note: note || '修改規則' }, roleId, t);
    return no;
  },
  addTail(roleId, s, micro, label) {
    if (!(s >= 0 && s < 60 && Number.isInteger(s))) fail('秒數必須是 0 到 59 的整數');
    if (!(micro >= 0 && micro < 1e6 && Number.isInteger(micro))) fail('微秒必須是 000000 到 999999');
    return DB.insert('tails', { roleId, s, micro, label: label || '' }, roleId);
  },
  addProblem(roleId, { name, situation, goal, occurredAt, dockConds }, at) {
    if (!String(name || '').trim()) fail('請填寫難題名稱');
    const ce = validateDockConds(dockConds || []); if (ce.length) fail(ce.join('\n'));
    const t = at != null ? at : Clock.now();
    if (occurredAt > t) fail('難題的發生時間不能晚於現在');
    const v = currentVersion(roleId);
    return DB.insert('problems', { name: name.trim(), situation: situation || '', goal: goal || '', participants: [roleId], occurredAt,
      applied: { kind: 'version', roleId, no: v ? v.no : 1 }, status: '進行中', departureId: null, dockConds: clone(dockConds || []) }, roleId, t);
  },
  editProblem(problemId, roleId, { name, situation, goal, occurredAt }, at) {
    const t = at != null ? at : Clock.now();
    const p = DB.get('problems', problemId);
    if (!p || !p.participants.includes(roleId)) fail('只能修改自己的難題');
    if (p.participants.length > 1) fail('融合後的難題不能在這裡修改內容');
    if (!['進行中', '擱置'].includes(p.status)) fail('只有進行中或擱置的難題可以修改內容');
    if (!String(name || '').trim()) fail('請填寫難題名稱');
    if (!(occurredAt <= t)) fail('難題的發生時間不能晚於現在');
    DB.update('problems', problemId, { name: name.trim(), situation: situation || '', goal: goal || '', occurredAt }, t);
  },
  setDockConds(problemId, roleId, conds, consents, at) {
    const p = DB.get('problems', problemId);
    if (!p || !p.participants.includes(roleId)) fail('只能修改自己參與的難題');
    if (['已融合', '完成'].includes(p.status)) fail('已融合或已完成的難題不能修改對接條件');
    const ce = validateDockConds(conds); if (ce.length) fail(ce.join('\n'));
    if (p.participants.length > 1) {
      const st = DB.find('stations', s => s.fusedProblemId === problemId);
      const need = st ? st.subject : p.participants;
      if (!consents || !need.every(x => consents.includes(x))) fail('主體多人時，修改對接條件需要全員同意');
    }
    DB.update('problems', problemId, { dockConds: clone(conds) }, at);
  },
  activeDeparture(problemId) { return DB.find('departures', d => d.problemId === problemId && ['subject', 'queued', 'member'].includes(d.status)); },

  writeDeparture(roleId, problemId, point, at) {
    const t = at != null ? at : Clock.now();
    const p = DB.get('problems', problemId);
    if (!p || !p.participants.includes(roleId)) fail('只能為自己的難題寫下出發點');
    if (!['進行中', '擱置'].includes(p.status)) fail('這個難題目前的狀態不能寫出發點');
    if (!(point > t)) fail('出發點必須晚於現在這一刻');
    if (this.activeDeparture(problemId)) fail('這個難題已經有一個有效的出發點');
    const st = stationOfPoint(point);
    if (st) {
      if (st.subject.includes(roleId) || st.queue.some(q => q.roleId === roleId)) fail('你已經在這個出發點上了');
      const curP = DB.get('problems', this.currentProblemId(st));
      const miss = evalDockConds(curP.dockConds, roleId, st.subject);
      if (miss.length) {
        const d = DB.insert('departures', { roleId, problemId, point, writtenAt: t, status: 'rejected', stationId: st.id, reason: '不符合對接條件：' + miss.join('；') }, roleId, t);
        return { departure: d, outcome: 'conds', missing: miss, station: st };
      }
      const qr = queueRule(st);
      if (st.queue.length >= qr.max) {
        const d = DB.insert('departures', { roleId, problemId, point, writtenAt: t, status: 'rejected', stationId: st.id, reason: '排隊已額滿' }, roleId, t);
        return { departure: d, outcome: 'full' };
      }
      const d = DB.insert('departures', { roleId, problemId, point, writtenAt: t, status: 'queued', stationId: st.id }, roleId, t);
      const q = [...st.queue, { roleId, problemId, departureId: d.id, at: t }];
      q.sort((a, b) => a.at - b.at || (a.departureId < b.departureId ? -1 : 1));
      DB.update('stations', st.id, { queue: q }, t);
      DB.update('problems', problemId, { status: '排隊中', departureId: d.id }, t);
      return { departure: d, outcome: 'queued', station: st };
    }
    const d = DB.insert('departures', { roleId, problemId, point, writtenAt: t, status: 'subject', stationId: null }, roleId, t);
    const s = DB.insert('stations', { point, subject: [roleId], members: [], queue: [], common: null, problemId, fusedProblemId: null,
      history: [problemId], status: 'open', founder: roleId }, roleId, t);
    DB.update('departures', d.id, { stationId: s.id }, t);
    DB.update('problems', problemId, { departureId: d.id }, t);
    return { departure: d, outcome: 'subject', station: s };
  },

  leaveQueue(stationId, roleId, reason, at) {
    const t = at != null ? at : Clock.now();
    const st = DB.get('stations', stationId); const q = st.queue.find(x => x.roleId === roleId);
    if (!q) fail('你不在這個出發點的排隊中');
    DB.update('stations', st.id, { queue: st.queue.filter(x => x.roleId !== roleId) }, t);
    DB.update('departures', q.departureId, { status: reason || 'left' }, t);
    DB.update('problems', q.problemId, { status: '擱置' }, t);
  },

  currentProblemId(st) { return st.fusedProblemId || st.problemId; },

  dock(stationId, { accept, common, fused, consents }, at) {
    const t = at != null ? at : Clock.now();
    const st = DB.get('stations', stationId);
    if (!st || st.status !== 'open') fail('這個出發點已經不能對接');
    const head = st.queue[0]; if (!head) fail('目前沒有排隊的角色');
    const everyone = [...st.subject, head.roleId];
    const curP = DB.get('problems', this.currentProblemId(st));
    if (accept) {
      const miss = evalDockConds(curP.dockConds, head.roleId, st.subject);
      if (miss.length) fail('對方目前不符合對接條件：' + miss.join('；') + '\n對方可以修改規則，或退出排隊。');
      const ce = validateDockConds(fused.dockConds || []); if (ce.length) fail(ce.join('\n'));
      if (!consents || !everyone.every(r => consents.includes(r))) fail('主體全員與對接角色都同意，才能合作');
      const e = validateCommon(common); if (e.length) fail(e.join('\n'));
      if (!String(fused.name || '').trim()) fail('請填寫融合後的難題名稱');
    }
    const round = DB.list('dockings', d => d.stationId === st.id).length + 1;
    const dk = DB.insert('dockings', { stationId: st.id, point: st.point, round, subjectMembers: [...st.subject], candidate: head.roleId,
      common: accept ? clone(common) : null, condsUsed: clone(curP.dockConds || []), result: accept ? 'cooperate' : 'decline' }, st.subject[0], t);
    if (!accept) {
      DB.update('stations', st.id, { queue: st.queue.slice(1) }, t);
      DB.update('departures', head.departureId, { status: 'declined' }, t);
      DB.update('problems', head.problemId, { status: '擱置' }, t);
      return { docking: dk };
    }
    const before = this.currentProblemId(st);
    const np = DB.insert('problems', { name: fused.name.trim(), situation: fused.situation || '', goal: fused.goal || '', participants: everyone,
      occurredAt: t, applied: { kind: 'docking', dockingId: dk.id }, status: '進行中', departureId: null, fusedFrom: [before, head.problemId], dockConds: clone(fused.dockConds || []) }, st.subject[0], t);
    DB.update('problems', before, { status: '已融合' }, t);
    DB.update('problems', head.problemId, { status: '已融合' }, t);
    DB.update('departures', head.departureId, { status: 'member' }, t);
    const fu = DB.insert('fusions', { dockingId: dk.id, stationId: st.id, before: [before, head.problemId], after: np.id, members: everyone, afterConds: clone(fused.dockConds || []) }, st.subject[0], t);
    DB.update('stations', st.id, { subject: everyone, queue: st.queue.slice(1), common: clone(common), fusedProblemId: np.id,
      history: [...st.history, head.problemId, np.id] }, t);
    return { docking: dk, fusion: fu, problem: np };
  },

  // 出發點到達、排隊超時、預約截止
  tick(at) {
    const now = at != null ? at : Clock.now();
    let changed = false;
    DB.list('stations', s => s.status === 'open').forEach(st => {
      // 排隊超時
      const qr = queueRule(st);
      st.queue.filter(q => q.at + qr.waitDays * DAY < Math.min(now, st.point)).forEach(q => { this.leaveQueue(st.id, q.roleId, 'timeout', now); changed = true; });
      const st2 = DB.get('stations', st.id);
      if (st2.point <= now) {
        st2.queue.forEach(q => { this.leaveQueue(st2.id, q.roleId, 'closed', st2.point); });
        if (st2.subject.length > 1) {
          DB.update('stations', st2.id, { status: 'started', queue: [] }, st2.point);
        } else {
          DB.update('stations', st2.id, { status: 'closed', queue: [], closedReason: '出發點到達時主體只有一人' }, st2.point);
          DB.list('departures', d => d.stationId === st2.id && d.status === 'subject').forEach(d => DB.update('departures', d.id, { status: 'expired' }, st2.point));
          DB.update('problems', st2.problemId, { status: '擱置' }, st2.point);
        }
        changed = true;
      }
    });
    changed = this.processBookings(now) || changed;
    return changed;
  },

  // ---------- 拆解與挑戰 ----------
  requireAll(st, consents) { if (!consents || !st.subject.every(r => consents.includes(r))) fail('需要主體全員同意'); },
  addChallenge(stationId, c, consents, at) {
    const t = at != null ? at : Clock.now();
    const st = DB.get('stations', stationId);
    if (!st || !['open', 'started'].includes(st.status) || st.subject.length < 2) fail('主體至少要有兩個角色才能拆解');
    this.requireAll(st, consents);
    this.checkChallenge(st, c);
    return DB.insert('challenges', { stationId, problemId: this.currentProblemId(st), content: c.content.trim(), node: c.node, writer: c.writer,
      executor: c.executor, q: c.q, z: c.z, status: '待執行', judge: {}, log: [{ at: t, text: '拆解新增' }] }, c.writer, t);
  },
  checkChallenge(st, c) {
    if (!String(c.content || '').trim()) fail('請填寫挑戰內容');
    if (!(c.node >= st.point)) fail('時間節點不可早於出發點');
    if (!st.subject.includes(c.writer)) fail('寫出挑戰的角色必須是主體成員');
    if (c.executor && !st.subject.includes(c.executor)) fail('執行角色必須是主體成員');
    if (c.executor && c.executor === c.writer) fail('寫出挑戰與執行挑戰必須是不同角色');
    if (!isNonNegInt(c.q) || !isNonNegInt(c.z)) fail('題點與戰點數量必須是 0 以上的整數');
  },
  editChallenge(chId, c, consents, at) {
    const t = at != null ? at : Clock.now();
    const ch = DB.get('challenges', chId); const st = DB.get('stations', ch.stationId);
    this.requireAll(st, consents);
    if (['完成', '執行中', '待判定', '判定爭議中'].includes(ch.status)) fail('執行中或已完成的挑戰不能修改');
    this.checkChallenge(st, c);
    DB.update('challenges', chId, { content: c.content.trim(), node: c.node, writer: c.writer, executor: c.executor, q: c.q, z: c.z,
      status: '待執行', log: [...ch.log, { at: t, text: '拆解修改（主體全員同意）' }] }, t);
  },
  deleteChallenge(chId, consents, at) {
    const ch = DB.get('challenges', chId); const st = DB.get('stations', ch.stationId);
    this.requireAll(st, consents);
    if (['執行中', '待判定', '判定爭議中', '完成'].includes(ch.status)) fail('執行中或已完成的挑戰不能刪除');
    DB.remove('challenges', chId);
  },
  issue(type, issuer, holder, n, challengeId, at) {
    if (!n) return null;
    const v = currentVersion(issuer);
    return DB.insert('batches', { type, issuer, holder, n, remaining: n, frozen: 0, version: v.no, challengeId }, issuer, at);
  },
  acceptChallenge(chId, roleId, at) {
    const t = at != null ? at : Clock.now();
    const ch = DB.get('challenges', chId);
    if (ch.status !== '待執行' || ch.executor !== roleId) fail('只有指定的執行角色可以接下這個挑戰');
    this.issue('題點', roleId, ch.writer, ch.q, ch.id, t);
    DB.update('challenges', chId, { status: '執行中', log: [...ch.log, { at: t, text: `${roleName(roleId)} 接下挑戰，發出 ${ch.q} 題點` }] }, t);
  },
  declineChallenge(chId, roleId, at) {
    const t = at != null ? at : Clock.now(); const ch = DB.get('challenges', chId);
    if (ch.status !== '待執行' || ch.executor !== roleId) fail('只有指定的執行角色可以婉拒');
    DB.update('challenges', chId, { status: '擱置', executor: null, log: [...ch.log, { at: t, text: `${roleName(roleId)} 婉拒，挑戰擱置，待主體修改拆解` }] }, t);
  },
  abandonChallenge(chId, roleId, at) {
    const t = at != null ? at : Clock.now(); const ch = DB.get('challenges', chId);
    if (ch.status !== '執行中' || ch.executor !== roleId) fail('只有執行中的執行角色可以放棄');
    DB.update('challenges', chId, { status: '待執行', executor: null, log: [...ch.log, { at: t, text: `${roleName(roleId)} 放棄執行，挑戰回到待執行（已發出的題點不退回）` }] }, t);
  },
  submitChallenge(chId, roleId, at) {
    const t = at != null ? at : Clock.now(); const ch = DB.get('challenges', chId);
    if (ch.status !== '執行中' || ch.executor !== roleId) fail('只有執行角色可以提交判定');
    DB.update('challenges', chId, { status: '待判定', judge: { executor: true }, log: [...ch.log, { at: t, text: '執行角色提交判定' }] }, t);
  },
  judgeChallenge(chId, roleId, approve, at) {
    const t = at != null ? at : Clock.now(); const ch = DB.get('challenges', chId);
    if (ch.status !== '待判定' || ch.writer !== roleId) fail('只有寫出挑戰的角色可以判定');
    if (approve) this.completeChallenge(ch, t, '雙方共同判定完成');
    else DB.update('challenges', chId, { status: '判定爭議中', log: [...ch.log, { at: t, text: '寫出者不同意，進入判定爭議，依共同規則處理' }] }, t);
  },
  resolveDispute(chId, done, consents, at) {
    const t = at != null ? at : Clock.now(); const ch = DB.get('challenges', chId); const st = DB.get('stations', ch.stationId);
    if (ch.status !== '判定爭議中') fail('這個挑戰不在爭議中');
    if (!consents || ![ch.writer, ch.executor].every(r => consents.includes(r))) fail('依共同規則處理後，需雙方確認結果');
    if (done) this.completeChallenge(ch, t, '依共同規則（' + optText(st.common.deadlock, DEADLOCK_OPTS) + '）裁定完成');
    else DB.update('challenges', chId, { status: '執行中', judge: {}, log: [...ch.log, { at: t, text: '依共同規則裁定未完成，回到執行中' }] }, t);
  },
  completeChallenge(ch, t, text) {
    this.issue('戰點', ch.writer, ch.executor, ch.z, ch.id, t);
    DB.update('challenges', ch.id, { status: '完成', judge: { executor: true, writer: true }, log: [...ch.log, { at: t, text: text + `，發出 ${ch.z} 戰點` }] }, t);
  },
  challengesOf(stationId) { return DB.list('challenges', c => c.stationId === stationId).sort((a, b) => a.node - b.node); },
  readyForHeat(st) { const cs = this.challengesOf(st.id); return st.status === 'started' && cs.length > 0 && cs.every(c => c.status === '完成'); },
  fillHeat(stationId, roleId, kcal, at) {
    const t = at != null ? at : Clock.now(); const st = DB.get('stations', stationId);
    if (!st.subject.includes(roleId)) fail('只有主體成員可以填寫');
    if (!this.readyForHeat(st)) fail('所有挑戰完成後才能填寫往後需消耗的熱量');
    if (!(isNonNegInt(kcal))) fail('熱量必須是 0 以上的整數');
    const pid = this.currentProblemId(st);
    const ex = DB.find('heat', h => h.problemId === pid && h.roleId === roleId);
    if (ex) DB.update('heat', ex.id, { kcal }, t); else DB.insert('heat', { problemId: pid, roleId, kcal }, roleId, t);
    if (st.subject.every(r => DB.find('heat', h => h.problemId === pid && h.roleId === r))) {
      DB.update('problems', pid, { status: '完成' }, t);
      DB.update('stations', st.id, { status: 'done' }, t);
    }
  },
  exitStation(stationId, roleId, at) {
    const t = at != null ? at : Clock.now(); const st = DB.get('stations', stationId);
    if (!st.subject.includes(roleId)) fail('你不是這個主體的成員');
    const pending = this.challengesOf(st.id).filter(c => ['待判定', '判定爭議中'].includes(c.status) && (c.writer === roleId || c.executor === roleId));
    if (pending.length) fail('退出前，請先完成你參與且已提交的判定：' + pending.map(c => c.content).join('、'));
    const myDep = DB.find('departures', d => d.stationId === st.id && d.roleId === roleId && ['subject', 'member'].includes(d.status));
    const myProblem = myDep ? myDep.problemId : null;
    if (st.subject.length > 1) {
      this.challengesOf(st.id).forEach(c => {
        if (c.executor === roleId && ['待執行', '執行中'].includes(c.status)) DB.update('challenges', c.id, { status: '待執行', executor: null, log: [...c.log, { at: t, text: `${roleName(roleId)} 退出，挑戰回到待執行` }] }, t);
        else if (c.writer === roleId && c.status !== '完成') DB.update('challenges', c.id, { status: '擱置', log: [...c.log, { at: t, text: `寫出者 ${roleName(roleId)} 退出，待主體修改拆解` }] }, t);
      });
      const rest = st.subject.filter(r => r !== roleId);
      DB.update('stations', st.id, { subject: rest, members: [...(st.members || []), roleId] }, t);
      const fp = st.fusedProblemId; if (fp) { const p = DB.get('problems', fp); DB.update('problems', fp, { exited: [...(p.exited || []), roleId] }, t); }
      if (myDep) DB.update('departures', myDep.id, { status: 'exited' }, t);
      if (myProblem) DB.update('problems', myProblem, { status: '擱置' }, t);
      return 'left';
    }
    // 主體只剩一人
    const r = rulesOf(roleId);
    if (st.status === 'open' && r.exit === 'handover' && st.queue.length) {
      const head = st.queue[0];
      DB.update('stations', st.id, { subject: [head.roleId], queue: st.queue.slice(1), problemId: head.problemId, common: null, history: [...st.history, head.problemId] }, t);
      DB.update('departures', head.departureId, { status: 'subject' }, t);
      DB.update('problems', head.problemId, { status: '進行中' }, t);
      if (myDep) DB.update('departures', myDep.id, { status: 'exited' }, t);
      if (myProblem) DB.update('problems', myProblem, { status: '擱置' }, t);
      return 'handover';
    }
    st.queue.forEach(q => this.leaveQueue(st.id, q.roleId, 'closed', t));
    DB.update('stations', st.id, { status: 'closed', subject: [], queue: [], closedReason: '主體退出，依退出處理擱置' }, t);
    if (myDep) DB.update('departures', myDep.id, { status: 'exited' }, t);
    DB.update('problems', this.currentProblemId(st), { status: '擱置' }, t);
    if (myProblem) DB.update('problems', myProblem, { status: '擱置' }, t);
    return 'closed';
  },

  // ---------- 兌換 ----------
  quote(holderId, issuerId, resourceIdx, uses, at) {
    const t = at != null ? at : Clock.now();
    const rules = rulesOf(issuerId); const res = rules.resources[resourceIdx];
    if (!res) fail('請選擇要兌現的資源');
    if (!uses.length) fail('請選擇要使用的點數');
    if (!rules.stack && uses.length > 1) fail('對方的規則不可疊加：一個資源只能用單一批點數兌現');
    const cd = coopDays(holderId, issuerId, t); const cur = currentVersion(issuerId);
    let need = res.kcal; const out = [];
    for (const u of uses) {
      const b = DB.get('batches', u.batchId);
      if (!b || b.holder !== holderId || b.issuer !== issuerId) fail('點數批次不正確');
      const vno = u.ver === 'current' ? cur.no : b.version;
      const snap = versionOf(issuerId, vno).snapshot;
      const k = b.type === '題點' ? 'q' : 'z';
      const e = epp(snap, k, cd);
      if (need <= 1e-9) break;
      const take = Math.min(b.remaining, Math.ceil(need / e - 1e-9));
      if (take <= 0) continue;
      out.push({ batchId: b.id, type: b.type, n: take, ver: u.ver, versionNo: vno, epp: e, kcal: take * e });
      need -= take * e;
    }
    if (need > 1e-9) fail(`點數不足：還差約 ${Math.ceil(need)} 大卡`);
    if (!rules.stack && out.length > 1) fail('對方的規則不可疊加');
    return { resource: res, cost: res.kcal, uses: out, coopDays: cd, stack: out.length > 1 };
  },
  approvedOn(issuerId, day) { return DB.list('bookings', b => b.issuer === issuerId && b.day === day && b.result === '核准').reduce((s, b) => s + b.cost, 0); },
  book(holderId, issuerId, day, resourceIdx, uses, at) {
    const t = at != null ? at : Clock.now();
    if (holderId === issuerId) fail('不能向自己兌換');
    const d = dayStart(day);
    if (d < dayStart(t)) fail('兌現日不能早於今天');
    const q = this.quote(holderId, issuerId, resourceIdx, uses, t);
    q.uses.forEach(u => { const b = DB.get('batches', u.batchId); DB.update('batches', b.id, { remaining: b.remaining - u.n, frozen: b.frozen + u.n }, t); });
    const bk = DB.insert('bookings', { holder: holderId, issuer: issuerId, day: d, resource: q.resource.name, cost: q.cost, uses: q.uses,
      stack: q.stack, result: '待核准', sameDay: d === dayStart(t) }, holderId, t);
    if (d === dayStart(t)) { // 截止後的當日申請：剩餘額度先到先得
      this.settle(bk, this.approvedOn(issuerId, d) + q.cost <= DAILY_CAP, t, '當日申請，依剩餘額度先到先得');
    }
    return DB.get('bookings', bk.id);
  },
  settle(bk, ok, t, note) {
    bk.uses.forEach(u => {
      const b = DB.get('batches', u.batchId);
      DB.update('batches', b.id, ok ? { frozen: b.frozen - u.n } : { frozen: b.frozen - u.n, remaining: b.remaining + u.n }, t);
    });
    DB.update('bookings', bk.id, { result: ok ? '核准' : '未核准', note: ok ? note : (note + '；加入後會超過每日 ' + DAILY_CAP + ' 大卡上限，點數已解凍'), settledAt: t }, t);
  },
  processBookings(now) {
    const pend = DB.list('bookings', b => b.result === '待核准' && b.day <= now);
    if (!pend.length) return false;
    const groups = {};
    pend.forEach(b => { const k = b.issuer + '|' + b.day; (groups[k] = groups[k] || []).push(b); });
    Object.values(groups).forEach(list => {
      const issuer = list[0].issuer, day = list[0].day; const pr = rulesOf(issuer).priority;
      list.forEach(b => b._cd = coopDays(b.holder, issuer, day));
      list.sort((a, b) => pr === 'coop' ? (b._cd - a._cd || a.createdAt - b.createdAt) : pr === 'small' ? (a.cost - b.cost || a.createdAt - b.createdAt) : a.createdAt - b.createdAt);
      let used = this.approvedOn(issuer, day);
      list.forEach(b => { delete b._cd; const ok = used + b.cost <= DAILY_CAP; if (ok) used += b.cost; this.settle(b, ok, day, '預約截止後依「' + PRIORITY_OPTS[pr] + '」排序核准'); });
    });
    return true;
  },
  cancelBooking(bkId, roleId, at) {
    const t = at != null ? at : Clock.now(); const bk = DB.get('bookings', bkId);
    if (bk.holder !== roleId || bk.result !== '待核准') fail('只能取消自己待核准的預約');
    bk.uses.forEach(u => { const b = DB.get('batches', u.batchId); DB.update('batches', b.id, { frozen: b.frozen - u.n, remaining: b.remaining + u.n }, t); });
    DB.update('bookings', bkId, { result: '已取消' }, t);
  }
};
function validateCommon(c) {
  const e = [];
  if (!c) return ['缺少共同規則'];
  if (c.deadlock.opt === 'custom' && !c.deadlock.text.trim()) e.push('共同規則的僵局處理選了自訂，請填寫內容');
  if (c.interp.opt === 'custom' && !c.interp.text.trim()) e.push('共同規則的解釋權選了自訂，請填寫內容');
  if (!isPosInt(c.queue.max)) e.push('共同規則的排隊上限必須是正整數');
  if (!isPosInt(c.queue.waitDays)) e.push('共同規則的排隊等待上限必須是正整數');
  return e;
}
function clone(x) { return JSON.parse(JSON.stringify(x)); }
