

/* ===================== 示範資料 ===================== */
function seedDemo() {
  Store.data = Store.empty();
  const T = Clock.real();
  const D = n => T + n * DAY;
  const at = (dayOffset, h, mi, s, micro) => { const p = usParts(D(dayOffset)); return usFrom({ ...p, h, mi, s, micro }); };
  const start = D(-95);

  const accs = ['阿澄', '小晴', '老周', '阿凱', '阿芸'].map(n => Game.createAccount(n + '的帳號', start));

  const rA = { ...defaultRules(), q: { per: 1, kcal: 100 }, z: { per: 1, kcal: 20 }, zFn: { type: 'step', days: 30, pct: 10, cap: 30 },
    stack: true, resources: [{ name: '陪跑一次', kcal: 100 }, { name: '一起整理文件', kcal: 150 }, { name: '搬家幫手半天', kcal: 900 }, { name: '陪同看診半天', kcal: 1000 }],
    priority: 'coop', deadlock: { opt: 'third', text: '請社區的林老師仲裁' }, exit: 'handover', queue: { max: 2, waitDays: 14, text: '' }, interp: { opt: 'both', text: '' } };
  const rB = { ...defaultRules(), q: { per: 1, kcal: 40 }, z: { per: 1, kcal: 30 }, stack: true,
    resources: [{ name: '代買菜一次', kcal: 200 }, { name: '顧小孩兩小時', kcal: 300 }], priority: 'fifo',
    deadlock: { opt: 'redo', text: '' }, queue: { max: 3, waitDays: 10, text: '' }, interp: { opt: 'issuer', text: '' } };
  const rC = { ...defaultRules(), q: { per: 1, kcal: 50 }, z: { per: 1, kcal: 40 }, qFn: { type: 'step', days: 60, pct: 5, cap: 20 }, stack: false,
    resources: [{ name: '店裡幫忙一小時', kcal: 150 }, { name: '修理小家電', kcal: 200 }], priority: 'small',
    deadlock: { opt: 'third', text: '請社區的林老師仲裁' }, queue: { max: 2, waitDays: 7, text: '' }, interp: { opt: 'third', text: '林老師' } };
  const rD = { ...defaultRules(), q: { per: 2, kcal: 60 }, z: { per: 2, kcal: 60 }, resources: [{ name: '教用試算表一小時', kcal: 120 }] };
  const A = Game.createRole({ name: '阿澄', birthY: 1996, birthM: 5, accountId: accs[0].id, rules: rA, conds: [{ field: 'zRate', op: '>=', value: 15 }] }, start);
  const B = Game.createRole({ name: '小晴', birthY: 1999, birthM: 11, accountId: accs[1].id, rules: rB, conds: [{ field: 'stack', op: '=', value: 1 }] }, start);
  const C = Game.createRole({ name: '老周', birthY: 1968, birthM: 3, accountId: accs[2].id, rules: rC, conds: [{ field: 'stableDays', op: '>=', value: 7 }] }, start);
  const Dd = Game.createRole({ name: '阿凱', birthY: 2001, birthM: 7, accountId: accs[3].id, rules: rD, conds: [{ field: 'qRate', op: '>=', value: 3 }] }, start);
  const rE = { ...defaultRules(), q: { per: 1, kcal: 10 }, z: { per: 1, kcal: 10 }, resources: [{ name: '代寫一封信', kcal: 80 }] };
  const E = Game.createRole({ name: '阿芸', birthY: 1993, birthM: 9, accountId: accs[4].id, rules: rE, conds: [{ field: 'resCount', op: '>=', value: 1 }] }, start);

  DB.insert('tails', { roleId: A.id, s: 17, micro: 520913, label: '和小晴、老周約好的尾數' }, A.id, D(-60));
  DB.insert('tails', { roleId: B.id, s: 17, micro: 520913, label: '阿澄的尾數' }, B.id, D(-50));

  const pA = Game.addProblem(A.id, { name: '轉職一直卡在第一步', situation: '離職半年，每天都說明天開始投履歷，卻一直沒有動。', goal: '能算出轉職這段時間還要付出多少力氣，並真的開始。', occurredAt: usFrom({ y: 2025, mo: 2, d: 12, h: 9 }),
    dockConds: [{ field: 'qRate', op: '>=', value: 30 }, { field: 'stableDays', op: '>=', value: 7 }] }, D(-80));
  const pB = Game.addProblem(B.id, { name: '長輩照護與上班時間衝突', situation: '外婆需要有人陪看診，排班常跟上班撞在一起。', goal: '排出可以長期維持的照護輪班。', occurredAt: usFrom({ y: 2024, mo: 10, d: 3, h: 9 }) }, D(-80));
  const pC = Game.addProblem(C.id, { name: '小店營收下滑，不知從何改起', situation: '開了二十年的五金行，這兩年客人明顯變少。', goal: '知道要調整哪些事、各要花多少力氣。', occurredAt: usFrom({ y: 2023, mo: 6, d: 20, h: 9 }) }, D(-80));
  const pD = Game.addProblem(Dd.id, { name: '證照考試一拖再拖', situation: '報名了兩次都沒去考。', goal: '排出能準時應考的準備節奏。', occurredAt: usFrom({ y: 2025, mo: 8, d: 1, h: 9 }) }, D(-80));
  const pE = Game.addProblem(E.id, { name: '接案收入不穩', situation: '自由接案，收入時多時少。', goal: '知道每個月要花多少力氣找案子。', occurredAt: usFrom({ y: 2025, mo: 11, d: 5, h: 9 }) }, D(-80));
  const pA2 = Game.addProblem(A.id, { name: '每天拖到半夜才開始做事', situation: '白天都在滑手機，事情總是拖到半夜。', goal: '找到白天就能開始的方法。', occurredAt: usFrom({ y: 2026, mo: 3, d: 1, h: 9 }),
    dockConds: [{ field: 'qRate', op: '>=', value: 25 }] }, D(-10));

  const X = at(-20, 21, 3, 17, 520913);
  Game.writeDeparture(A.id, pA.id, X, D(-40));
  Game.writeDeparture(B.id, pB.id, X, D(-38));
  Game.writeDeparture(C.id, pC.id, X, D(-37));
  Game.writeDeparture(Dd.id, pD.id, X, D(-36)); // 排隊額滿
  Game.writeDeparture(E.id, pE.id, X, D(-35)); // 不符合對接條件
  const st = DB.find('stations', s => s.point === X);

  const common1 = { deadlock: { opt: 'third', text: '請社區的林老師仲裁' }, interp: { opt: 'both', text: '' }, queue: { max: 2, waitDays: 14, text: '' } };
  Game.dock(st.id, { accept: true, common: common1, consents: [A.id, B.id], fused: { dockConds: [{ field: 'qRate', op: '>=', value: 30 }, { field: 'coopDays', op: '>=', value: 0, scope: 'any' }], name: '轉職與照護排班互相卡住', situation: '阿澄想找工作卻沒有開始；小晴的照護排班需要人手。兩人的時間可以互補。', goal: '阿澄開始投遞，小晴的排班有人分擔。' } }, D(-33));
  const common2 = { deadlock: { opt: 'third', text: '請社區的林老師仲裁' }, interp: { opt: 'both', text: '' }, queue: { max: 2, waitDays: 7, text: '' } };
  Game.dock(st.id, { accept: true, common: common2, consents: [A.id, B.id, C.id], fused: { dockConds: [{ field: 'qRate', op: '>=', value: 30 }, { field: 'sameDeadlock', op: '=', value: 1, scope: 'any' }], name: '三人的時間與收入重新配置', situation: '老周的店需要幫手與新做法；阿澄需要實際工作經驗；小晴需要排班分擔。', goal: '三人都能算出往後各自要花的力氣。' } }, D(-30));
  const all = [A.id, B.id, C.id];

  const s1 = Game.addChallenge(st.id, { content: '整理一份可投遞的履歷與作品清單', node: X + 2 * DAY, writer: A.id, executor: B.id, q: 3, z: 6 }, all, D(-29));
  const s2 = Game.addChallenge(st.id, { content: '排出三週的照護輪班表', node: X + 4 * DAY, writer: B.id, executor: C.id, q: 2, z: 5 }, all, D(-29));
  const s3 = Game.addChallenge(st.id, { content: '整理店裡的帳', node: X + 5 * DAY, writer: B.id, executor: C.id, q: 1, z: 3 }, all, D(-29));
  Game.editChallenge(s3.id, { content: '列出店裡可以交給家人做的三件事', node: X + 5 * DAY, writer: B.id, executor: C.id, q: 1, z: 3 }, all, D(-25));
  const s4 = Game.addChallenge(st.id, { content: '陪老周跑一次進貨，記錄流程', node: D(5), writer: C.id, executor: A.id, q: 12, z: 4 }, all, D(-22));
  const s5 = Game.addChallenge(st.id, { content: '試做一週的晚間時段分配', node: D(8), writer: B.id, executor: A.id, q: 12, z: 4 }, all, D(-22));
  const s6 = Game.addChallenge(st.id, { content: '把照護排班與店休日對齊', node: D(15), writer: A.id, executor: C.id, q: 2, z: 4 }, all, D(-21));
  Game.tick(D(-20) + SEC); // 出發點到達

  Game.acceptChallenge(s1.id, B.id, D(-19));
  Game.acceptChallenge(s2.id, C.id, D(-18));
  Game.submitChallenge(s1.id, B.id, D(-17));
  Game.acceptChallenge(s3.id, C.id, D(-17));
  Game.judgeChallenge(s1.id, A.id, true, D(-16));
  Game.saveRules(A.id, { ...rA, z: { per: 1, kcal: 25 } }, [{ field: 'zRate', op: '>=', value: 15 }], D(-15), '提高戰點兌換比例');
  Game.submitChallenge(s2.id, C.id, D(-13));
  Game.judgeChallenge(s2.id, B.id, true, D(-12));
  Game.submitChallenge(s3.id, C.id, D(-11));
  Game.judgeChallenge(s3.id, B.id, true, D(-10));
  Game.acceptChallenge(s4.id, A.id, D(-9));
  Game.acceptChallenge(s5.id, A.id, D(-8));
  // 判定爭議：老周做完排班對齊，阿澄認為還沒完成
  Game.acceptChallenge(s6.id, C.id, D(-7.5));
  Game.submitChallenge(s6.id, C.id, D(-6.8));
  Game.judgeChallenge(s6.id, A.id, false, D(-6.6));

  const bat = (holder, issuer, type) => DB.list('batches', b => b.holder === holder && b.issuer === issuer && b.type === type).sort((a, b) => a.createdAt - b.createdAt);
  // 版本選擇：小晴用阿澄的戰點（發出時 v1 每點 20，當前 v2 每點 25）
  Game.book(B.id, A.id, D(-5), 0, [{ batchId: bat(B.id, A.id, '戰點')[0].id, ver: 'current' }], D(-7));
  // 疊加：老周用小晴的兩批戰點合併兌現代買菜
  const cz = bat(C.id, B.id, '戰點');
  Game.book(C.id, B.id, D(-4), 0, [{ batchId: cz[0].id, ver: 'issue' }, { batchId: cz[1].id, ver: 'issue' }], D(-6));
  // 超過 1800 大卡：老周較早預約，但阿澄的兌換優先是合作天數多者優先
  Game.book(C.id, A.id, D(-3), 3, [{ batchId: bat(C.id, A.id, '題點')[0].id, ver: 'current' }], D(-5.5));
  Game.book(B.id, A.id, D(-3), 2, [{ batchId: bat(B.id, A.id, '題點')[0].id, ver: 'current' }], D(-5));
  Game.tick(D(-2));
  // 未來的預約：等截止時才核准
  Game.book(B.id, A.id, D(3), 1, [{ batchId: bat(B.id, A.id, '題點')[0].id, ver: 'current' }], D(-1));

  // 阿澄另一個難題的出發點（尚未碰撞）
  Game.writeDeparture(A.id, pA2.id, at(12, 7, 30, 17, 520913), D(-2));

  Store.data.meta.currentRole = A.id;
  Store.data.meta.clockOffset = 0;
  Clock.offset = 0;
  Game.tick();
  Store.save();
}
