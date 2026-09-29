/* ===================== 可見範圍 ===================== */
function involved(st, r) { return st.subject.includes(r) || st.queue.some(q => q.roleId === r) || (st.members || []).includes(r); }
function insider(st, r) { return st.subject.includes(r) || (st.members || []).includes(r); }
function myStations(r) { return DB.list('stations', s => involved(s, r)); }
function stationFor(pid) {
  const d = DB.list('departures', x => x.problemId === pid && x.status !== 'rejected').sort((a, b) => b.createdAt - a.createdAt)[0];
  if (d && d.stationId) { const s = DB.get('stations', d.stationId); if (s) return s; }
  return DB.list('stations', s => s.history.includes(pid)).sort((a, b) => b.createdAt - a.createdAt)[0] || null;
}
function seesDocking(d, r) { const st = DB.get('stations', d.stationId); return !!st && (insider(st, r) || d.candidate === r || (st.status === 'open' && st.queue[0] && st.queue[0].roleId === r)); }
function challengeStep(c) { return Game.challengesOf(c.stationId).findIndex(x => x.id === c.id) + 1; }
const visBatches = () => DB.list('batches', b => b.holder === me() || b.issuer === me());

/* ===================== 工作表定義 =====================
   每張表：rows() 取目前角色看得到的列；cols 為欄位。
   欄位有 to（連到哪張表）與 ids(列) 時，就是一條「路徑」，路徑圖由這些欄位自動產生。 */
const txt = s => esc(s || '') || '<span class="muted">—</span>';
const day = us => `<span class="num">${esc(fmtDay(us))}</span>`;
const tm = us => `<span class="num">${esc(fmtUs(us))}</span>`;

const SHEETS = {
  life: { name: '人生行事歷', special: true, desc: '起點。縱軸是年齡，從現在往回排到 0 歲；橫軸是月份。' },
  timeline: { name: '挑戰時間軸', special: true, desc: '只放未來。' },
  todo: { name: '待處理', special: true },

  problems: {
    no: 'I', name: '難題表', desc: '難題是目前無法處理的情況，往後要為它付出多少熱量還是未知數。展開一列可以修改內容、設定對接條件、寫下出發點。',
    rows: () => DB.list('problems', p => canSeeProblem(me(), p)),
    mine: p => p.participants.includes(me()),
    cols: [
      { k: 'code', h: '難題編號', v: p => code(p.id), sort: p => code(p.id) },
      { k: 'name', h: '名稱', v: p => `<b>${esc(p.name)}</b>` },
      { k: 'status', h: '狀態', v: p => statusTag(p.status) },
      { k: 'who', h: '參與角色', to: 'roles', ids: p => p.participants },
      { k: 'occ', h: '發生時間', v: p => day(p.occurredAt), sort: p => p.occurredAt },
      { k: 'st', h: '出發點', to: 'stations', ids: p => { const st = stationFor(p.id); return st && involved(st, me()) ? [st.id] : []; } },
      { k: 'deps', h: '出發紀錄', to: 'departures', ids: p => DB.list('departures', d => d.problemId === p.id && d.roleId === me()).map(d => d.id) },
      { k: 'applied', h: '適用規則', to: ['ruleVersions', 'dockings'], refs: p => p.applied.kind === 'version' ? [{ s: 'ruleVersions', id: (versionOf(p.applied.roleId, p.applied.no) || {}).id }] : [{ s: 'dockings', id: p.applied.dockingId }] },
      { k: 'conds', h: '對接條件', v: p => `<span class="small">${condsText(p.dockConds)}</span>`, sort: p => (p.dockConds || []).length },
      { k: 'from', h: '融合自', to: 'problems', ids: p => p.fusedFrom || [] },
      { k: 'into', h: '融合成', to: 'problems', ids: p => DB.list('problems', q => (q.fusedFrom || []).includes(p.id)).map(q => q.id) },
      { k: 'sit', h: '情況', v: p => `<span class="small">${txt(p.situation)}</span>` },
      { k: 'goal', h: '目標', v: p => `<span class="small">${txt(p.goal)}</span>` },
      { k: 'next', h: '下一步', v: p => problemNext(p) }
    ],
    add: {
      when: () => true,
      cells: () => { const t = new Date(Math.floor(Clock.now() / 1000)); const fa = 'form="addF-problems"';
        return { name: `<input name="name" maxlength="60" placeholder="新難題名稱" ${fa}>`, occ: `<input type="date" name="occ" value="${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}" ${fa}>`,
          who: `<span class="small">${esc(roleName(me()))}</span>`, sit: `<input name="situation" placeholder="情況" ${fa}>`, goal: `<input name="goal" placeholder="目標" ${fa}>`,
          next: `<form id="addF-problems" onsubmit="return false"></form><button type="button" class="btn sm pri" data-act="addProblem" form="addF-problems">新增這一列</button>`,
          conds: '<span class="auto">新增後展開設定</span>' }; }
    },
    drawer: p => problemDrawer(p)
  },

  rules: {
    no: 'II', name: '規則表', desc: '每個角色一列。規則表是公開的，可見條件只有符合的人看得到。點「編輯」直接在你那一列修改，儲存後成為新版本。',
    rows: () => DB.list('roles').map(r => rulesOf(r.id)).filter(Boolean),
    mine: R => R.roleId === me(),
    cols: [
      { k: 'code', h: '規則編號', v: R => code(R.id) },
      { k: 'role', h: '角色', to: 'roles', ids: R => [R.roleId] },
      { k: 'ver', h: '目前版本', to: 'ruleVersions', ids: R => [currentVersion(R.roleId).id] },
      { k: 'stable', h: '維持天數', num: true, v: R => String(stableDays(R.roleId)), sort: R => stableDays(R.roleId) },
      { k: 'q', h: '題點兌換', v: R => esc(rateText(R.q)), sort: R => R.q.kcal / R.q.per, ed: R => `<span class="inl">每 <input name="qPer" inputmode="numeric" value="${R.q.per}" form="rulesForm"> 點換 <input name="qKcal" inputmode="numeric" value="${R.q.kcal}" form="rulesForm"> 大卡</span>` },
      { k: 'qFn', h: '題點函數', v: R => `<span class="small">${esc(fnText(R.qFn))}</span>`, ed: R => fnEd('q', R.qFn) },
      { k: 'z', h: '戰點兌換', v: R => esc(rateText(R.z)), sort: R => R.z.kcal / R.z.per, ed: R => `<span class="inl">每 <input name="zPer" inputmode="numeric" value="${R.z.per}" form="rulesForm"> 點換 <input name="zKcal" inputmode="numeric" value="${R.z.kcal}" form="rulesForm"> 大卡</span>` },
      { k: 'zFn', h: '戰點函數', v: R => `<span class="small">${esc(fnText(R.zFn))}</span>`, ed: R => fnEd('z', R.zFn) },
      { k: 'stack', h: '疊加', v: R => R.stack ? '可' : '不可', ed: R => `<label class="check"><input type="checkbox" name="stack" form="rulesForm" ${R.stack ? 'checked' : ''}> 可疊加</label>` },
      { k: 'res', h: '資源', v: R => `<span class="small">${R.resources.map(x => esc(x.name) + ' ' + x.kcal).join('<br>')}</span>`, sort: R => R.resources.length,
        ed: R => `<div id="resRows">${R.resources.map(resRow).join('')}</div><button type="button" class="btn sm" data-act="addRes">新增資源</button>` },
      { k: 'pri', h: '兌換優先', v: R => `<span class="small">${PRIORITY_OPTS[R.priority]}</span>`, ed: R => selF('priority', PRIORITY_OPTS, R.priority) },
      { k: 'dl', h: '僵局處理', v: R => `<span class="small">${esc(optText(R.deadlock, DEADLOCK_OPTS))}</span>`, ed: R => selF('dl', DEADLOCK_OPTS, R.deadlock.opt) + `<input name="dlt" placeholder="補充說明" value="${esc(R.deadlock.text)}" form="rulesForm">` },
      { k: 'exit', h: '退出處理', v: R => `<span class="small">${EXIT_OPTS[R.exit]}</span>`, ed: R => selF('exit', EXIT_OPTS, R.exit) },
      { k: 'queue', h: '排隊規則', v: R => `${R.queue.max} 位／${R.queue.waitDays} 天`, sort: R => R.queue.max,
        ed: R => `<span class="inl">最多 <input name="qm" inputmode="numeric" value="${R.queue.max}" form="rulesForm"> 位，等 <input name="qw" inputmode="numeric" value="${R.queue.waitDays}" form="rulesForm"> 天</span><input name="qt" placeholder="補充說明" value="${esc(R.queue.text)}" form="rulesForm">` },
      { k: 'ip', h: '解釋權', v: R => `<span class="small">${esc(optText(R.interp, INTERP_OPTS))}</span>`, ed: R => selF('ip', INTERP_OPTS, R.interp.opt) + `<input name="ipt" placeholder="補充說明" value="${esc(R.interp.text)}" form="rulesForm">` },
      { k: 'vis', h: '可見條件', v: R => (R.roleId === me() || meetsConds(me(), R.roleId)) ? `<span class="small">${visCondText((condsOf(R.roleId) || {}).conds)}</span>` : '<span class="muted small">不符合，看不到</span>',
        ed: R => `<div id="condRows">${((condsOf(R.roleId) || {}).conds || []).map(condRow).join('')}</div><button type="button" class="btn sm" data-act="addCond">新增條件</button>` },
      { k: 'meet', h: '我是否符合', v: R => R.roleId === me() ? '—' : (meetsConds(me(), R.roleId) ? '符合' : '不符合') },
      { k: 'coop', h: '與我合作天數', num: true, v: R => R.roleId === me() ? '—' : String(coopDays(me(), R.roleId)), sort: R => coopDays(me(), R.roleId) },
      { k: 'op', h: '操作', v: R => R.roleId === me() ? `<button class="btn sm" data-act="ruleEdit">編輯</button>` : '',
        ed: R => `<form id="rulesForm" onsubmit="return false"></form><input name="note" placeholder="修改說明" form="rulesForm" style="min-width:10em"><div class="row" style="margin-top:4px"><button type="button" class="btn sm pri" data-act="saveRules">儲存為新版本</button><button type="button" class="btn sm" data-act="ruleCancel">取消</button></div>` }
    ],
    editRow: R => UI.ruleEdit && R.roleId === me(),
    drawer: R => R.roleId === me() && UI.ruleEdit ? `<div class="box"><h3>試算</h3><div class="inl small">持有 <input id="tryN" value="10" inputmode="numeric"> 點，合作 <input id="tryD" value="30" inputmode="numeric"> 天</div><div id="tryOut" class="note num"></div><p class="small muted" id="condCount"></p></div>` : ''
  },

  ruleVersions: {
    no: 'III', name: '規則版本表', desc: '每次修改規則都留下完整的一版設定。兌換時，持有者可以在點數的發出版本和當前版本之間選一個。',
    rows: () => DB.list('ruleVersions'),
    mine: v => v.roleId === me(),
    cols: [
      { k: 'code', h: '版本編號', v: v => code(v.id) },
      { k: 'role', h: '角色', to: 'roles', ids: v => [v.roleId] },
      { k: 'no', h: '版本號', v: v => 'v' + v.no + (currentVersion(v.roleId).id === v.id ? ' <span class="tag teal">現行</span>' : ''), sort: v => v.no },
      { k: 'date', h: '日期', v: v => tm(v.createdAt), sort: v => v.createdAt },
      { k: 'note', h: '說明', v: v => esc(v.note) },
      { k: 'q', h: '題點每點大卡', num: true, v: v => (v.snapshot.q.kcal / v.snapshot.q.per).toFixed(1), sort: v => v.snapshot.q.kcal / v.snapshot.q.per },
      { k: 'z', h: '戰點每點大卡', num: true, v: v => (v.snapshot.z.kcal / v.snapshot.z.per).toFixed(1), sort: v => v.snapshot.z.kcal / v.snapshot.z.per },
      { k: 'fn', h: '函數', v: v => `<span class="small">題：${esc(fnText(v.snapshot.qFn))}<br>戰：${esc(fnText(v.snapshot.zFn))}</span>` },
      { k: 'res', h: '資源', v: v => `<span class="small">${v.snapshot.resources.map(x => esc(x.name) + ' ' + x.kcal).join('<br>')}</span>` },
      { k: 'stack', h: '疊加', v: v => v.snapshot.stack ? '可' : '不可' },
      { k: 'pri', h: '兌換優先', v: v => `<span class="small">${PRIORITY_OPTS[v.snapshot.priority]}</span>` },
      { k: 'batches', h: '以此版本發出的點數', to: 'batches', ids: v => visBatches().filter(b => b.issuer === v.roleId && b.version === v.no).map(b => b.id) }
    ]
  },

  dockings: {
    no: 'IV', name: '對接紀錄表', desc: '每一輪對接都是一列，包括不合作的結果。',
    rows: () => DB.list('dockings', d => seesDocking(d, me())),
    cols: [
      { k: 'code', h: '對接編號', v: d => code(d.id) },
      { k: 'st', h: '出發點', to: 'stations', ids: d => [d.stationId] },
      { k: 'round', h: '輪次', num: true, v: d => String(d.round), sort: d => d.round },
      { k: 'sub', h: '主體成員', to: 'roles', ids: d => d.subjectMembers },
      { k: 'cand', h: '對接角色', to: 'roles', ids: d => [d.candidate] },
      { k: 'conds', h: '當輪對接條件', v: d => `<span class="small">${condsText(d.condsUsed)}</span>` },
      { k: 'common', h: '共同規則', v: d => `<span class="small">${d.common ? commonText(d.common) : '—'}</span>` },
      { k: 'result', h: '結果', v: d => d.result === 'cooperate' ? statusTag('合作') : statusTag('不合作') },
      { k: 'fus', h: '融合紀錄', to: 'fusions', ids: d => DB.list('fusions', f => f.dockingId === d.id).map(f => f.id) },
      { k: 'date', h: '日期', v: d => day(d.createdAt), sort: d => d.createdAt }
    ]
  },

  fusions: {
    no: 'V', name: '融合紀錄表', desc: '每一次融合都存成獨立紀錄，原難題不會被覆蓋。',
    rows: () => DB.list('fusions', f => { const d = DB.get('dockings', f.dockingId); return d && seesDocking(d, me()); }),
    cols: [
      { k: 'code', h: '融合編號', v: f => code(f.id) },
      { k: 'dock', h: '對接編號', to: 'dockings', ids: f => [f.dockingId] },
      { k: 'before', h: '融合前難題', to: 'problems', ids: f => f.before },
      { k: 'after', h: '融合後難題', to: 'problems', ids: f => [f.after] },
      { k: 'members', h: '融合後主體成員', to: 'roles', ids: f => f.members },
      { k: 'conds', h: '融合後對接條件', v: f => `<span class="small">${condsText(f.afterConds)}</span>` },
      { k: 'date', h: '日期', v: f => day(f.createdAt), sort: f => f.createdAt }
    ]
  },

  challenges: {
    no: 'VI', name: '拆解時間節點表', desc: '每個步驟就是一個挑戰，由主體中兩個不同的角色合作。接下挑戰時執行角色發出題點，判定完成時寫出者發出戰點。最下面一列可以直接新增挑戰。',
    rows: () => DB.list('challenges', c => { const st = DB.get('stations', c.stationId); return st && insider(st, me()); }).sort((a, b) => a.node - b.node),
    mine: c => c.writer === me() || c.executor === me(),
    cols: [
      { k: 'code', h: '挑戰編號', v: c => code(c.id) },
      { k: 'prob', h: '難題', to: 'problems', ids: c => [c.problemId] },
      { k: 'st', h: '出發點', to: 'stations', ids: c => [c.stationId] },
      { k: 'step', h: '步驟', num: true, v: c => String(challengeStep(c)), sort: c => challengeStep(c) },
      { k: 'content', h: '挑戰內容', v: c => esc(c.content) },
      { k: 'node', h: '時間節點', v: c => tm(c.node), sort: c => c.node },
      { k: 'writer', h: '寫出挑戰的角色', to: 'roles', ids: c => [c.writer] },
      { k: 'exec', h: '執行角色（負責）', to: 'roles', ids: c => c.executor ? [c.executor] : [], v: c => c.executor ? L('roles', c.executor, esc(roleName(c.executor))) : '<span class="muted">待指定</span>' },
      { k: 'q', h: '題點', num: true, v: c => String(c.q), sort: c => c.q },
      { k: 'z', h: '戰點', num: true, v: c => String(c.z), sort: c => c.z },
      { k: 'status', h: '狀態', v: c => statusTag(c.status) },
      { k: 'op', h: '操作', v: c => chActions(c) || '<span class="muted small">—</span>' },
      { k: 'batches', h: '發出的點數', to: 'batches', ids: c => visBatches().filter(b => b.challengeId === c.id).map(b => b.id) },
      { k: 'log', h: '紀錄', num: true, v: c => String(c.log.length), sort: c => c.log.length }
    ],
    add: { when: () => addableStations().length > 0, cells: () => challengeAddCells() },
    drawer: c => challengeDrawer(c)
  },

  heat: {
    no: 'VII', name: '難題熱量表', desc: '難題的所有挑戰完成後，每個仍在主體中的角色各自填入往後需消耗的總熱量；全部填完，難題自動完成。',
    rowId: h => h.id,
    rows: () => {
      const out = [];
      myStations(me()).filter(st => insider(st, me()) && (Game.readyForHeat(st) || st.status === 'done')).forEach(st => {
        const pid = Game.currentProblemId(st);
        const ids = [...new Set([...st.subject, ...DB.list('heat', h => h.problemId === pid).map(h => h.roleId)])];
        ids.forEach(rid => { const h = DB.find('heat', x => x.problemId === pid && x.roleId === rid); out.push({ id: pid + '|' + rid, pid, rid, st, h, createdAt: h ? h.createdAt : 0 }); });
      });
      return out;
    },
    mine: x => x.rid === me(),
    cols: [
      { k: 'prob', h: '難題', to: 'problems', ids: x => [x.pid] },
      { k: 'role', h: '角色', to: 'roles', ids: x => [x.rid] },
      { k: 'kcal', h: '往後需消耗總熱量（大卡）', num: true, v: x => x.h ? String(x.h.kcal) : (x.rid === me() && x.st.status === 'started' ? `<form id="heatF-${x.st.id}" onsubmit="return false" data-st="${x.st.id}" class="inl"><input name="kcal" inputmode="numeric" style="width:7em" aria-label="往後需消耗總熱量"><button type="button" class="btn sm pri" data-act="heat">填入</button></form>` : '<span class="muted">未填</span>'), sort: x => x.h ? x.h.kcal : -1 },
      { k: 'at', h: '填寫時間', v: x => x.h ? tm(x.h.updatedAt) : '—', sort: x => x.h ? x.h.updatedAt : 0 },
      { k: 'st', h: '出發點', to: 'stations', ids: x => [x.st.id] }
    ]
  },

  batches: {
    no: 'VIII', name: '點數紀錄表', desc: '每次發出的點數為一批。點數綁定發出者，只能兌換成發出者兌換當天的能量點。',
    rows: () => visBatches(),
    mine: b => b.holder === me(),
    cols: [
      { k: 'code', h: '點數批號', v: b => code(b.id) },
      { k: 'type', h: '類型', v: b => b.type },
      { k: 'issuer', h: '發出者', to: 'roles', ids: b => [b.issuer] },
      { k: 'holder', h: '持有者', to: 'roles', ids: b => [b.holder] },
      { k: 'n', h: '數量', num: true, v: b => String(b.n), sort: b => b.n },
      { k: 'rem', h: '剩餘', num: true, v: b => String(b.remaining), sort: b => b.remaining },
      { k: 'fz', h: '凍結', num: true, v: b => String(b.frozen), sort: b => b.frozen },
      { k: 'ver', h: '發出版本號', to: 'ruleVersions', ids: b => [(versionOf(b.issuer, b.version) || {}).id] },
      { k: 'date', h: '發出日期', v: b => day(b.createdAt), sort: b => b.createdAt },
      { k: 'ch', h: '來源挑戰', to: 'challenges', ids: b => { const c = DB.get('challenges', b.challengeId); const st = c && DB.get('stations', c.stationId); return c && st && insider(st, me()) ? [c.id] : []; } },
      { k: 'bk', h: '用於預約', to: 'bookings', ids: b => DB.list('bookings', k => k.uses.some(u => u.batchId === b.id) && (k.holder === me() || k.issuer === me())).map(k => k.id) },
      { k: 'op', h: '操作', v: b => b.holder === me() && b.remaining > 0 ? `<button class="btn sm" data-act="useBatch" data-b="${b.id}">用這批兌換</button>` : '' }
    ]
  },

  bookings: {
    no: 'IX', name: '兌換預約表', desc: `兌換日就是資源兌現日。預約在兌現日前一天結束時自動截止，依發出者的兌換優先排序，逐筆整筆核准，超過每日 ${DAILY_CAP} 大卡的不核准；兌現日當天的申請以剩餘額度先到先得。最下面一列可以直接新增預約。`,
    rows: () => DB.list('bookings', b => b.holder === me() || b.issuer === me()),
    mine: b => b.holder === me(),
    cols: [
      { k: 'code', h: '預約編號', v: b => code(b.id) },
      { k: 'holder', h: '持有者', to: 'roles', ids: b => [b.holder] },
      { k: 'issuer', h: '發出者', to: 'roles', ids: b => [b.issuer] },
      { k: 'at', h: '預約時間', v: b => tm(b.createdAt), sort: b => b.createdAt },
      { k: 'day', h: '兌現日', v: b => day(b.day), sort: b => b.day },
      { k: 'res', h: '兌現資源', v: b => esc(b.resource) },
      { k: 'cost', h: '所需能量點', num: true, v: b => String(b.cost), sort: b => b.cost },
      { k: 'uses', h: '使用點數明細', to: 'batches', ids: b => b.uses.map(u => u.batchId),
        v: b => `<div class="small">${b.uses.map(u => { const v = versionOf(b.issuer, u.versionNo); return `${L('batches', u.batchId, code(u.batchId))} ${u.type} ${u.n} 點，${L('ruleVersions', v && v.id, 'v' + u.versionNo)}，每點 ${(+u.epp).toFixed(1)}`; }).join('<br>')}</div>` },
      { k: 'stack', h: '疊加', v: b => b.stack ? '是' : '否' },
      { k: 'result', h: '結果', v: b => statusTag(b.result) },
      { k: 'note', h: '說明', v: b => `<span class="small muted">${esc(b.note || '')}</span>` },
      { k: 'op', h: '操作', v: b => b.result === '待核准' && b.holder === me() ? `<button class="btn sm warn" data-act="cancelBk" data-b="${b.id}">取消</button>` : '' }
    ],
    add: { when: () => DB.list('batches', b => b.holder === me() && b.remaining > 0).length > 0, cells: () => bookingAddCells() }
  },

  roles: {
    no: 'X', name: '角色表', desc: '一個帳號可以擁有多個角色。沒有碰撞時，可以另外建立一個角色寫下同一出發點。',
    rows: () => DB.list('roles'),
    mine: r => r.id === me(),
    cols: [
      { k: 'code', h: '角色編號', v: r => code(r.id) },
      { k: 'name', h: '名稱', v: r => `<b>${esc(r.name)}</b>` + (r.id === me() ? ' <span class="tag teal">目前</span>' : '') },
      { k: 'acc', h: '所屬帳號', v: r => esc((DB.get('accounts', r.accountId) || {}).name) },
      { k: 'birth', h: '出生年月', v: r => `${r.birthY} 年 ${r.birthM} 月`, sort: r => r.birthY * 100 + r.birthM },
      { k: 'age', h: '目前年齡', num: true, v: r => String(ageOf(r)), sort: r => ageOf(r) },
      { k: 'rules', h: '規則', to: 'rules', ids: r => [ruleRowId(r.id)] },
      { k: 'coop', h: '與我合作天數', num: true, v: r => r.id === me() ? '—' : String(coopDays(me(), r.id)), sort: r => coopDays(me(), r.id) },
      { k: 'op', h: '操作', v: r => r.id === me() ? '' : `<button class="btn sm" data-act="playAs" data-r="${r.id}">以此角色遊玩</button>` }
    ],
    add: {
      when: () => true,
      cells: () => { const fa = 'form="addF-roles"'; const accs = DB.list('accounts');
        return { name: `<input name="name" placeholder="新角色名稱" ${fa}>`, birth: `<span class="inl"><input name="by" inputmode="numeric" placeholder="年" style="width:5em" ${fa}><input name="bm" inputmode="numeric" placeholder="月" style="width:3.5em" ${fa}></span>`,
          acc: `<select name="acc" ${fa}>${accs.map(a => `<option value="${a.id}" ${a.id === role(me()).accountId ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}<option value="__new">建立新帳號</option></select>`,
          op: `<form id="addF-roles" onsubmit="return false"></form><button type="button" class="btn sm pri" data-act="addRole" form="addF-roles">新增這一列</button>` }; }
    }
  },

  stations: {
    name: '出發點', desc: '你參與的每個出發點是一列：你是主體、在排隊，或曾經是成員。展開一列可以對接、退出排隊或退出出發點。',
    rows: () => myStations(me()),
    mine: st => st.subject.includes(me()),
    cols: [
      { k: 'code', h: '出發點編號', v: st => code(st.id) },
      { k: 'point', h: '出發點', v: st => tm(st.point), sort: st => st.point },
      { k: 'status', h: '狀態', v: st => statusTag(ST_TEXT[st.status]) },
      { k: 'sub', h: '主體', to: 'roles', ids: st => st.subject },
      { k: 'queue', h: '排隊', to: 'roles', ids: st => st.queue.map(q => q.roleId), v: st => st.queue.length ? st.queue.map((q, i) => `${i + 1}. ${L('roles', q.roleId, esc(roleName(q.roleId)))}`).join('<br>') : '<span class="muted">—</span>', sort: st => st.queue.length },
      { k: 'prob', h: '目前難題', to: 'problems', ids: st => { const p = DB.get('problems', Game.currentProblemId(st)); return p && canSeeProblem(me(), p) ? [p.id] : []; } },
      { k: 'common', h: '共同規則', v: st => `<span class="small">${commonText(st.common)}</span>` },
      { k: 'dock', h: '對接紀錄', to: 'dockings', ids: st => DB.list('dockings', d => d.stationId === st.id && seesDocking(d, me())).map(d => d.id) },
      { k: 'ch', h: '挑戰（完成／全部）', to: 'challenges', ids: st => insider(st, me()) ? Game.challengesOf(st.id).map(c => c.id) : [],
        v: st => { if (!insider(st, me())) return '—'; const cs = Game.challengesOf(st.id); return cs.length ? LQ('challenges', code(st.id), `${cs.filter(c => c.status === '完成').length} ／ ${cs.length}`) : '0'; } },
      { k: 'next', h: '下一步', v: st => stationNext(st) }
    ],
    drawer: st => stationDrawer(st)
  },

  departures: {
    name: '出發紀錄', desc: '你寫下的每個出發點，包括沒有成立的。只有你自己看得到。',
    rows: () => DB.list('departures', d => d.roleId === me()),
    cols: [
      { k: 'code', h: '紀錄編號', v: d => code(d.id) },
      { k: 'prob', h: '難題', to: 'problems', ids: d => [d.problemId] },
      { k: 'point', h: '出發點', v: d => tm(d.point), sort: d => d.point },
      { k: 'wrote', h: '寫下時間（判定先後用）', v: d => tm(d.writtenAt), sort: d => d.writtenAt },
      { k: 'src', h: '時間來源', v: d => d.tsSource === 'local' ? '本機' : '伺服器' },
      { k: 'result', h: '結果', v: d => esc(DEP_TEXT[d.status] || d.status) + (d.reason ? `<div class="small muted">${esc(d.reason)}</div>` : '') },
      { k: 'st', h: '所在出發點', to: 'stations', ids: d => { const st = d.stationId && DB.get('stations', d.stationId); return st && involved(st, me()) && d.status !== 'rejected' ? [st.id] : []; } }
    ]
  },

  daily: {
    name: '每日額度', desc: `你是發出者時，每天最多分給別人 ${DAILY_CAP} 大卡的能量點，上限不累積到隔天。`,
    rowId: x => x.id,
    rows: () => { const list = DB.list('bookings', b => b.issuer === me() && ['核准', '待核准'].includes(b.result)); return [...new Set(list.map(b => b.day))].map(d => ({ id: 'd' + d, day: d, list: list.filter(b => b.day === d), createdAt: d })); },
    cols: [
      { k: 'day', h: '兌現日', v: x => day(x.day), sort: x => x.day },
      { k: 'ok', h: '已核准', num: true, v: x => String(sumCost(x.list, '核准')), sort: x => sumCost(x.list, '核准') },
      { k: 'pend', h: '待核准', num: true, v: x => String(sumCost(x.list, '待核准')), sort: x => sumCost(x.list, '待核准') },
      { k: 'left', h: '剩餘額度', num: true, v: x => String(DAILY_CAP - sumCost(x.list, '核准')), sort: x => DAILY_CAP - sumCost(x.list, '核准') },
      { k: 'rate', h: '使用率', num: true, v: x => Math.round(sumCost(x.list, '核准') / DAILY_CAP * 100) + '%', sort: x => sumCost(x.list, '核准') },
      { k: 'bk', h: '預約', to: 'bookings', ids: x => x.list.map(b => b.id), v: x => x.list.map(b => `${L('bookings', b.id, code(b.id))} ${esc(roleName(b.holder))} ${esc(b.resource)} ${b.cost}（${b.result}）`).join('<br>') }
    ]
  },

  tails: {
    name: '常用尾數', desc: '你固定使用的秒數與微秒。熟人知道它，就能一直跟你對上。只有你自己看得到。',
    rows: () => DB.list('tails', t => t.roleId === me()),
    cols: [
      { k: 's', h: '秒', num: true, v: t => pad(t.s), sort: t => t.s },
      { k: 'u', h: '微秒', num: true, v: t => pad(t.micro, 6), sort: t => t.micro },
      { k: 'label', h: '說明', v: t => esc(t.label) },
      { k: 'op', h: '操作', v: t => `<button class="btn sm warn" data-act="rmTail" data-t="${t.id}">刪除</button>` }
    ],
    add: { when: () => true, cells: () => { const fa = 'form="addF-tails"'; return { s: `<input name="s" inputmode="numeric" placeholder="秒" style="width:4em" ${fa}>`, u: `<input name="u" inputmode="numeric" maxlength="6" placeholder="六位數" style="width:7em" ${fa}>`, label: `<input name="l" placeholder="和誰約好" ${fa}>`, op: `<form id="addF-tails" onsubmit="return false"></form><button type="button" class="btn sm pri" data-act="addTail" form="addF-tails">新增這一列</button>` }; } }
  },

  paths: {
    name: '路徑圖', meta: true, desc: '表與表之間的所有連結。表格裡每個可以點的編號或名稱，都是這裡的一條路徑。之後做裡世界時，這份路徑圖就是地圖上的通道。',
    rowId: x => x.id,
    rows: () => PATHS(),
    cols: [
      { k: 'from', h: '起點表', v: x => LQ(x.from, '', esc(sheetTitle(x.from))) },
      { k: 'col', h: '經由欄位', v: x => esc(x.col) },
      { k: 'to', h: '終點表', v: x => LQ(x.to, '', esc(sheetTitle(x.to))) },
      { k: 'n', h: '目前連結數', num: true, v: x => String(x.n), sort: x => x.n }
    ]
  },

  paper: { name: '紙本', special: true },
  settings: { name: '設定', special: true }
};
const sumCost = (list, r) => list.filter(b => b.result === r).reduce((s, b) => s + b.cost, 0);
const TABS = ['life', 'timeline', 'todo', '|', 'problems', 'rules', 'ruleVersions', 'dockings', 'fusions', 'challenges', 'heat', 'batches', 'bookings', 'roles', '|', 'stations', 'departures', 'daily', 'tails', 'paths', '|', 'paper', 'settings'];

// 欄位的連結目標：{ s, id } 陣列
function refsOf(c, r) {
  if (c.refs) return (c.refs(r) || []).filter(x => x && x.id);
  if (c.to && c.ids) return [].concat(c.ids(r) || []).filter(Boolean).map(id => ({ s: c.to, id }));
  return [];
}
function PATHS() {
  const out = [];
  Object.entries(SHEETS).forEach(([sk, S]) => {
    if (!S.cols || S.meta) return;
    const recs = S.rows();
    S.cols.forEach(c => { if (!c.to) return; [].concat(c.to).forEach(to => out.push({ id: sk + '.' + c.k + '.' + to, from: sk, col: c.h, to, n: recs.reduce((n, r) => n + refsOf(c, r).filter(x => x.s === to).length, 0) })); });
  });
  return out;
}
function relatedOf(sk, rec) {
  const S = SHEETS[sk]; const rid = (S.rowId || (x => x.id))(rec); const out = [];
  S.cols.forEach(c => { const rs = refsOf(c, rec); if (rs.length) out.push({ dir: '連到', col: c.h, list: rs }); });
  Object.entries(SHEETS).forEach(([tk, T]) => {
    if (!T.cols || T.meta) return;
    const tid = T.rowId || (x => x.id); let recs = null;
    T.cols.forEach(c => {
      if (!c.to || ![].concat(c.to).includes(sk)) return;
      recs = recs || T.rows();
      const hits = recs.filter(tr => refsOf(c, tr).some(x => x.s === sk && x.id === rid));
      if (hits.length) out.push({ dir: '被連', col: sheetTitle(tk) + '．' + c.h, list: hits.map(h => ({ s: tk, id: tid(h) })) });
    });
  });
  return out;
}
function relatedHtml(sk, rec) {
  const rel = relatedOf(sk, rec);
  if (!rel.length) return '';
  return `<div class="box"><h3>相關資料</h3><div class="rel"><span class="h">方向</span><span class="h">經由</span><span class="h">項目</span>` +
    rel.map(x => `<span>${x.dir}</span><span class="muted">${esc(x.col)}</span><span class="lks">${x.list.map(t => L(t.s, t.id, t.s === 'heat' || t.s === 'daily' ? esc(sheetTitle(t.s)) : refLabel(t.s, t.id))).join('')}</span>`).join('') + '</div></div>';
}
