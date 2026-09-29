/* ===== 融合流程：規則與資料，不碰畫面 =====
 * 相遇之後的關卡：融合 → 約下一個出發點 → 拆成階段（全員同意）→ 執行 → 判定 → 填熱量 → 可處理。
 * 每個函式都只改傳進來的 state，不合規則就丟出錯誤（訊息給玩家看）。
 */
var FUSION = (function () {
  'use strict';
  var RULES = { version: '1', ratios: { idea: 1, battle: 1 } };   // 點數比例版本：每筆點數都記下當時的版本
  var seq = 0;
  function id(p) { return p + '_' + Date.now().toString(36) + '_' + (seq++).toString(36); }
  function bad(m) { throw new Error(m); }
  function nowUs() { return Date.now() * 1000; }

  function active(f) { return f.members.filter(function (m) { return f.exits.indexOf(m) < 0; }); }
  function isMember(f, s) { return active(f).indexOf(s) >= 0; }
  function need(f, s) { if (!isMember(f, s)) bad('不是這個融合的參與者'); }
  function stage(f, sid) { var st = f.stages.find(function (x) { return x.id === sid; }); if (!st) bad('沒有這個階段'); return st; }
  function allAgree(f, list) { return active(f).every(function (m) { return list.indexOf(m) >= 0; }); }

  /* ---------- 點數：綁定發出者，事後不能取消 ---------- */
  // 格式：{id, kind:'idea'|'battle', from, to, amount, atUs, fusion, stage, ruleVersion, sig}
  // sig 先留空：正式版由發出者簽章，沒人能冒用別人發點數。
  function issue(state, f, kind, to, sid, atUs) {
    active(f).forEach(function (from) {
      if (from === to) return;
      state.points.push({ id: id('pt'), kind: kind, from: from, to: to, amount: RULES.ratios[kind], atUs: atUs,
                          fusion: f.id, stage: sid, ruleVersion: RULES.version, sig: null });
    });
  }

  /* ---------- 建立：相遇的那一微秒 ---------- */
  function create(state, roles, atUs) {
    if (roles.length < 2) bad('至少兩個角色才能融合');
    var f = {
      id: id('fu'), createdUs: atUs, status: 'open',            // open | done | shelved
      members: roles.map(function (r) { return r.serial; }), exits: [],
      problems: roles.map(function (r) { return { serial: r.serial, text: (r.problems[0] || {}).text || '' }; }),
      text: roles.map(function (r) { return (r.problems[0] || {}).text || ''; }).join('＋'),
      nextUs: null, nextProposal: null,                          // 下一個出發點 = 期限
      stages: [], calories: {}, log: []
    };
    roles.forEach(function (r) { if (r.problems[0]) r.problems[0].status = 'fused'; f.calories[r.serial] = null; });
    log(f, atUs, roles.map(function (r) { return r.name; }).join('、') + ' 相遇，難題融合');
    state.fusions.push(f);
    return f;
  }
  function log(f, atUs, text) { f.log.push({ atUs: atUs, text: text }); }

  /* ---------- 下一個出發點：全員同意才算約好；約好後每個參與者的終點都算數 ---------- */
  function proposeNext(state, f, s, us) {
    need(f, s); if (f.status !== 'open') bad('這個融合已經結束');
    if (us <= nowUs()) bad('出發點要在未來');
    f.nextProposal = { us: us, by: s, agreed: [s] };
    settleNext(state, f, s);
  }
  function agreeNext(state, f, s) {
    need(f, s); if (!f.nextProposal) bad('還沒有人提出發點');
    if (f.nextProposal.agreed.indexOf(s) < 0) f.nextProposal.agreed.push(s);
    settleNext(state, f, s);
  }
  function settleNext(state, f, s) {
    if (!allAgree(f, f.nextProposal.agreed)) return false;
    f.nextUs = f.nextProposal.us; f.nextProposal = null;
    // 每個參與者的出發點都寫成同一微秒：第三個人到任何一位參與者的終點都算有人來
    state.roles.forEach(function (r) { if (isMember(f, r.serial)) { r.departUs = f.nextUs; r.departDone = false; } });
    log(f, nowUs(), '約好下一個出發點');
    return true;
  }

  /* ---------- 階段：提出 → 全員同意（發題點）→ 認領執行 → 交判 → 判定 ---------- */
  function proposeStage(state, f, s, text) {
    need(f, s); if (f.status !== 'open') bad('這個融合已經結束');
    if (!text || !String(text).trim()) bad('階段要寫內容');
    var st = { id: id('st'), text: String(text).trim(), by: s, status: 'proposed', agreed: [s], owner: null, judges: {}, dispute: {} };
    f.stages.push(st);
    settleStage(state, f, st);
    return st;
  }
  function agreeStage(state, f, sid, s) {
    need(f, s); var st = stage(f, sid);
    if (st.status !== 'proposed') bad('這個階段不在等同意');
    if (st.agreed.indexOf(s) < 0) st.agreed.push(s);
    settleStage(state, f, st);
  }
  function settleStage(state, f, st) {
    if (!allAgree(f, st.agreed)) return;
    st.status = 'agreed';
    issue(state, f, 'idea', st.by, st.id, nowUs());          // 構思者得題點，其他參與者各發一份；退出也逃不掉
    log(f, nowUs(), '階段「' + st.text + '」全員同意');
  }
  function claimStage(state, f, sid, s) {
    need(f, s); var st = stage(f, sid);
    if (st.status !== 'agreed') bad('這個階段不能認領');
    st.status = 'doing'; st.owner = s;
  }
  function submitStage(state, f, sid, s) {
    var st = stage(f, sid);
    if (st.status !== 'doing' || st.owner !== s) bad('只有執行者能交判');
    st.status = 'judging'; st.judges = {};
  }
  // 判定：至少兩個人判；有人判未完成就變爭議
  function judge(state, f, sid, s, ok) {
    need(f, s); var st = stage(f, sid);
    if (st.status !== 'judging') bad('這個階段不在判定中');
    st.judges[s] = !!ok;
    var votes = Object.keys(st.judges);
    if (votes.some(function (k) { return st.judges[k] === false; })) { st.status = 'dispute'; st.dispute = {}; log(f, nowUs(), '階段「' + st.text + '」有爭議'); return; }
    if (votes.length >= 2 && allAgree(f, votes)) finish(state, f, st);
  }
  // 爭議：全員同意才能改判完成，或退回執行中
  function disputeVote(state, f, sid, s, to) {
    need(f, s); var st = stage(f, sid);
    if (st.status !== 'dispute') bad('這個階段沒有爭議');
    if (to !== 'done' && to !== 'back') bad('只能判完成或退回');
    st.dispute[s] = to;
    var ks = Object.keys(st.dispute);
    if (!allAgree(f, ks)) return;
    if (ks.every(function (k) { return st.dispute[k] === 'done'; })) finish(state, f, st);
    else if (ks.every(function (k) { return st.dispute[k] === 'back'; })) { st.status = 'doing'; st.judges = {}; st.dispute = {}; log(f, nowUs(), '階段「' + st.text + '」退回執行'); }
    // 意見不一致：爭議繼續，等大家改票
  }
  function finish(state, f, st) {
    st.status = 'done';
    issue(state, f, 'battle', st.owner, st.id, nowUs());     // 執行者得戰點
    log(f, nowUs(), '階段「' + st.text + '」判定完成');
  }
  function allStagesDone(f) { return f.stages.length > 0 && f.stages.every(function (s) { return s.status === 'done'; }); }

  /* ---------- 完成：所有階段判定完成後才能填熱量；每個人都填了才算可處理 ---------- */
  function setCalories(state, f, s, kcal) {
    need(f, s); if (f.status !== 'open') bad('這個融合已經結束');
    if (!allStagesDone(f)) bad('所有階段都判定完成後才能填熱量');
    if (typeof kcal !== 'number' || !(kcal >= 0)) bad('熱量要是數字');
    f.calories[s] = kcal;
    if (active(f).every(function (m) { return typeof f.calories[m] === 'number'; })) {
      f.status = 'done';
      log(f, nowUs(), '每個人都填了熱量，難題可處理');
    }
  }

  /* ---------- 退出：不懲罰，只留紀錄 ---------- */
  function exit(state, f, s) {
    need(f, s);
    f.exits.push(s);
    f.stages.forEach(function (st) {
      if (st.owner === s && (st.status === 'doing' || st.status === 'judging' || st.status === 'dispute')) { st.status = 'agreed'; st.owner = null; st.judges = {}; st.dispute = {}; }  // 變回沒人負責，不發戰點
      if (st.status === 'proposed') settleStage(state, f, st);                                    // 少了一個人，剩下的人可能已經全員同意
    });
    if (f.nextProposal) settleNext(state, f, s);
    var r = state.roles.find(function (x) { return x.serial === s; });
    if (r && r.problems[0]) r.problems[0].status = 'exited';
    log(f, nowUs(), (r ? r.name : s) + ' 退出');
    state.records.push({ kind: 'exit', at: nowUs(), text: (r ? r.name : s) + ' 退出融合「' + f.text + '」，已發的點數照舊。' });
  }

  /* ---------- 期限：下一個出發點那一微秒 ---------- */
  // arrivals：那一微秒站在任一參與者終點上的角色序號
  function deadline(state, f, atUs, arrivals) {
    if (f.status === 'shelved' || f.nextUs == null || atUs < f.nextUs) return null;
    var result;
    if (f.status === 'done') result = 'done';                   // 已經可處理：完成
    else if (arrivals.length) {
      var joined = [];
      arrivals.forEach(function (s) {
        if (isMember(f, s)) return;
        var r = state.roles.find(function (x) { return x.serial === s; });
        if (!r) return;
        f.members.push(s); f.calories[s] = null;
        f.problems.push({ serial: s, text: (r.problems[0] || {}).text || '' });
        if (r.problems[0]) { r.problems[0].status = 'fused'; f.text += '＋' + r.problems[0].text; }
        joined.push(r.name);
      });
      f.nextUs = null;                                          // 要再約下一個出發點
      log(f, atUs, joined.length ? joined.join('、') + ' 加入融合，再約下一個出發點' : '有人到了，再約下一個出發點');
      result = joined.length ? 'joined' : 'again';
    } else {
      f.status = 'shelved';
      state.roles.forEach(function (r) { if (f.members.indexOf(r.serial) >= 0 && r.problems[0] && r.problems[0].status === 'fused') r.problems[0].status = 'shelved'; });
      log(f, atUs, '出發點一個人都沒來，融合難題和原難題一起擱置');
      state.records.push({ kind: 'shelve', at: atUs, text: '融合「' + f.text + '」的出發點沒有人到終點，連同原難題一起擱置。' });
      result = 'shelved';
    }
    state.roles.forEach(function (r) { if (f.members.indexOf(r.serial) >= 0 && r.departUs != null && r.departUs <= atUs) r.departDone = true; });
    return result;
  }

  // 找角色 s 目前參與、還在進行的融合
  function openFor(state, s) {
    return state.fusions.find(function (f) { return f.status === 'open' && isMember(f, s); }) || null;
  }
  // 哪個融合把這個出發點當期限
  function byDepart(state, us) {
    return state.fusions.find(function (f) { return f.status === 'open' && f.nextUs === us; }) || null;
  }
  function pointsOf(state, s) {
    var got = { idea: 0, battle: 0 }, gave = { idea: 0, battle: 0 };
    state.points.forEach(function (p) { if (p.to === s) got[p.kind] += p.amount; if (p.from === s) gave[p.kind] += p.amount; });
    return { got: got, gave: gave };
  }

  var STATUS = { proposed: '等同意', agreed: '沒人負責', doing: '執行中', judging: '判定中', dispute: '爭議', done: '完成' };
  var FSTATUS = { open: '進行中', done: '可處理', shelved: '擱置' };

  return { RULES: RULES, create: create, proposeNext: proposeNext, agreeNext: agreeNext, proposeStage: proposeStage, agreeStage: agreeStage,
           claimStage: claimStage, submitStage: submitStage, judge: judge, disputeVote: disputeVote, setCalories: setCalories, exit: exit,
           deadline: deadline, openFor: openFor, byDepart: byDepart, active: active, isMember: isMember, allStagesDone: allStagesDone,
           pointsOf: pointsOf, STATUS: STATUS, FSTATUS: FSTATUS };
})();
if (typeof module !== 'undefined') module.exports = FUSION;
