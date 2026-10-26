// 交換關係圖（補二十二）：中間是你，線連到每個人（固定約亮的實線、已約和在一圈裡虛線、以前換過淡灰）、線上寫最近要發生的關係（好幾種加「等 N 項」）、換過越多次越近、同一圈同一個顏色；點一個人跳小卡；超過 12 個收起來；圖下面的表（有關係的在上、只換過的在下灰色）；直放只三欄、字不擠、線上的字不疊；直放和轉橫各截一張
// node v9/tests/t_map.js <test9.html> [截圖資料夾]
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003', J4 = '00000000004', J5 = '00000000005';
(async function () {
  var H = await lib.open(process.argv[2]), pg = H.pg, OUT = process.argv[3];
  await H.fresh();
  var dist = function (i) { return H.ev("(function(){var m=document.getElementById('mapMe').getBoundingClientRect(),n=document.querySelector('#map .mnode[data-i=\"" + i + "\"]').getBoundingClientRect();return Math.hypot((m.left+m.width/2)-(n.left+n.width/2),(m.top+m.height/2)-(n.top+n.height/2));})()"); };
  var nodeOf = function (serial) { return "document.querySelector('#map .mnode[data-id=\"" + serial + "\"]')"; };
  // 還沒換過：空的
  await H.ev("APP.goTable(null,'more')"); await H.nav('map');
  assert((await H.sheetName()) === 'map' && (await H.main()).indexOf('還沒跟人換過') >= 0 && (await H.ev("document.querySelectorAll('#map .mnode[data-i]').length")) === 0, '更多 → 交換關係：還沒換過就寫還沒跟人換過');
  // 關係：跟阿澄換過兩次（早餐換改履歷、陪跑換諮詢）加固定約、三天後也約了；跟小樂換過一次、兩天後約了；跟阿明在一圈裡；跟引路人的教學不算
  await H.ev("(function(){var S=APP.state(),t=APP.now(),dn=CORE.dayNum(t);function dock(o,a,b,gA,gB,daysAgo){S.dockings.push({id:'dk'+Math.random().toString(36).slice(2),slot:'x',atUs:t-daysAgo*CORE.DAY_US,a:'" + J1 + "',b:o,tutorial:o==='" + J4 + "',how:'',ok:true,traded:true,reason:null,gaveA:a,gaveB:b,itemsA:gA.map(function(n){return {id:n,name:n,price:a};}),itemsB:gB.map(function(n){return {id:n,name:n,price:b};}),failA:null,failB:null,noteA:null,noteB:null});}" +
    "dock('" + J2 + "',100,100,['早餐一頓'],['改履歷'],5);dock('" + J2 + "',60,90,['陪跑一小時'],['一小時諮詢'],2);dock('" + J3 + "',100,10,['早餐一頓'],['借一本書'],9);dock('" + J4 + "',0,0,['空的'],['空的'],1);" +
    "S.standings.push({id:'sd1',a:'" + J1 + "',b:'" + J2 + "',tod:19*3600e6,itemsA:['r1a'],itemsB:['r2b'],fromDay:dn,lastDay:dn,active:true});" +
    "CORE.accept(S,'" + J1 + "','" + J3 + "',t);var sB=CORE.addSlot(S,'" + J3 + "',t+2*CORE.DAY_US,1,null,t);CORE.book(S,'" + J1 + "',sB.id,t);var sC=CORE.addSlot(S,'" + J2 + "',t+3*CORE.DAY_US,1,null,t);CORE.book(S,'" + J1 + "',sC.id,t);" +
    "var nt=CORE.postNotice(S,'" + J1 + "',{need:'想要有人陪跑',give:['r1b'],cap:3},t);var l5=CORE.linkNotice(S,'" + J5 + "',nt.id,{side:'need',give:['r5a'],need:'想吃早餐'},t+1);CORE.linkNotice(S,'" + J1 + "',l5.notice.id,{side:'need',give:['r1b'],need:'想要有人陪跑'},t+2);APP.changed();})()");
  await H.ev("APP.goTable(null,'more')"); await H.nav('map');
  var n = await H.ev("document.querySelectorAll('#map .mnode[data-i]').length"), lines = await H.ev("Array.from(document.querySelectorAll('#mapSvg line')).map(function(l){return l.getAttribute('class');})");
  assert(n === 3 && (await pg.textContent('#mapMe')) === '你' && lines.length === 3, '中間是你，線連到三個人（引路人的教學不算）：' + n + ' 個、' + lines.length + ' 條線');
  var lbl = await H.ev("JSON.stringify(Array.from(document.querySelectorAll('#map .mnode[data-i]')).map(function(b){return [b.dataset.id,b.textContent,document.querySelector('#map .mlbl[data-i=\"'+b.dataset.i+'\"]').textContent,b.className.replace(/mnode|sel/g,'').trim()];}))");
  var L = JSON.parse(lbl), byS = {}; L.forEach(function (x) { byS[x[0]] = x; });
  assert(byS[J2] && byS[J2][1] === '阿澄（聊天傾聽）' && /^固定約・每天 19:00・等 2 項$/.test(byS[J2][2]) && byS[J2][3] === 'standing', '阿澄：名字後面有括弧；線上寫「固定約・每天 19:00・等 2 項」（還有三天後的已約）：' + JSON.stringify(byS[J2]));
  assert(byS[J3] && /^已約・\d\d\/\d\d \d\d:\d\d$/.test(byS[J3][2]) && byS[J3][3] === 'active', '小樂：已約・哪天：' + JSON.stringify(byS[J3]));
  assert(byS[J5] && byS[J5][2] === '在一圈裡・2 人' && byS[J5][3] === 'active', '阿明：在一圈裡・2 人：' + JSON.stringify(byS[J5]));
  var ls = await H.ev("JSON.stringify(Array.from(document.querySelectorAll('#mapSvg line')).map(function(l){var cs=getComputedStyle(l);return [l.getAttribute('class'),cs.strokeDasharray,cs.strokeWidth];}))");
  var LS = JSON.parse(ls); assert(LS.some(function (x) { return x[0] === 'standing' && (x[1] === 'none' || x[1] === '') && parseFloat(x[2]) >= 3; }) && LS.filter(function (x) { return x[0] === 'active' && x[1] !== 'none' && x[1] !== ''; }).length === 2, '固定約是亮的實線（粗）、已約和在一圈裡是虛線：' + ls);
  var iJ2 = await H.ev(nodeOf(J2) + ".dataset.i"), iJ3 = await H.ev(nodeOf(J3) + ".dataset.i"), dJ2 = await dist(iJ2), dJ3 = await dist(iJ3);
  assert(dJ2 < dJ3 - 10, '換過兩次的阿澄比換過一次的小樂離你近：' + Math.round(dJ2) + ' < ' + Math.round(dJ3));
  var col = await H.ev("(function(){var b=" + nodeOf(J5) + ",l=document.querySelector('#map .mlbl[data-i=\"'+b.dataset.i+'\"]');return [b.style.borderColor,l.style.color];})()");
  assert(col[0] && col[0] === col[1], '同一圈的人同一個顏色（卡片框和線上的字）：' + col.join(' / '));
  if (OUT) await pg.screenshot({ path: OUT + '/v9_map_1_landscape.png', fullPage: true });
  // 點一個人：小卡
  await H.finger("function(){ return " + nodeOf(J2) + "; }", '阿澄');
  var card = await pg.textContent('#mapCard');
  assert(card.indexOf('阿澄（聊天傾聽）') >= 0 && card.indexOf('你給他：早餐一頓、陪跑一小時') >= 0 && card.indexOf('他給你：改履歷、一小時諮詢') >= 0 && card.indexOf('換過 2 次') >= 0 && card.indexOf('最近一次 ') >= 0 && card.indexOf('固定約・每天 19:00') >= 0 && card.indexOf('已約・') >= 0, '點阿澄：小卡寫你給他、他給你、換過 2 次、最近一次、兩項關係：' + card);
  await H.finger("function(){ return document.querySelector('#mapCard [data-act=\"mapLog\"]'); }", '到你們的紀錄');
  assert((await H.sheetName()) === 'log' && (await H.ev("SHEETS.ui.day")) === (await H.ev("CORE.dayNum(APP.now())-2")), '到你們的紀錄：翻到最近一次那天的事件簿');
  await H.ev("APP.goTable(null,'more')"); await H.nav('map'); await H.finger("function(){ return " + nodeOf(J2) + "; }", '阿澄'); await H.finger("function(){ return document.querySelector('#mapCard [data-act=\"visit\"]'); }", '到他的資源表');
  assert((await H.sheetName()) === 'other:res' && (await pg.textContent('#tother')).indexOf('阿澄') >= 0, '到他的資源表'); await H.clickText('回我自己', '#tother');
  // 表：有關係的在上面、只換過的在下面灰色
  await H.ev("(function(){var S=APP.state(),t=APP.now();for(var i=6;i<=20;i++){var sr='0000000000'+(i<10?'0'+i:i);sr=('00000000000'+i).slice(-11);CORE.createRole(S,{serial:sr,name:'人'+i,dailyPoints:100,rules:{},resources:[{id:'e'+i,name:'空的',price:0,avail:3}]},t-10*CORE.DAY_US);S.dockings.push({id:'dkp'+i,slot:'x',atUs:t-(i+5)*CORE.DAY_US,a:'" + J1 + "',b:sr,tutorial:false,how:'',ok:true,traded:true,reason:null,gaveA:0,gaveB:0,itemsA:[{id:'e1',name:'空的',price:0}],itemsB:[{id:'e'+i,name:'空的',price:0}],failA:null,failB:null,noteA:null,noteB:null});}APP.changed();})()");
  await H.ev("APP.goTable(null,'more')"); await H.nav('map');
  var total = await H.ev("CORE.relations(APP.state(),APP.me().serial,APP.now()).length");
  assert(total === 18 && (await H.ev("document.querySelectorAll('#map .mnode[data-i]').length")) === 12 && (await pg.textContent('#map .mmore')) === '還有 6 人', '18 個人：圖上畫 12 個（有關係的 3 個全畫，再補最近換過的），其他收在「還有 6 人」');
  var order = await H.ev("Array.from(document.querySelectorAll('#mapTable tr[data-row]')).map(function(t){return t.className;})");
  assert(order.length === 18 && order.slice(0, 3).every(function (c) { return c === 'now'; }) && order.slice(3).every(function (c) { return c === 'past'; }), '表：有關係的 3 個在上面，只換過的 15 個在下面（灰色）');
  await H.finger("function(){ return document.querySelector('#map .mmore'); }", '還有 6 人'); await pg.waitForTimeout(600);
  assert((await H.ev("(function(){var r=document.getElementById('mapTable').getBoundingClientRect();return r.top<window.innerHeight&&r.bottom>0;})()")), '點「還有 N 人」捲到下面的表');
  assert((await H.ev("Array.from(document.querySelectorAll('#mapTable th')).filter(function(t){return t.offsetParent!==null;}).length")) === 6, '轉橫：表有六欄');
  // 直放：只顯示對方、現在的關係、換過幾次；字不擠出去、線上的字不疊在一起
  await pg.setViewportSize({ width: 360, height: 780 }); await pg.waitForTimeout(300); await H.ev("APP.goTable(null,'more')"); await H.nav('map');
  assert((await H.ev("Array.from(document.querySelectorAll('#mapTable th')).filter(function(t){return t.offsetParent!==null;}).map(function(t){return t.textContent;}).join()")) === '對方,現在的關係,換過', '直放只顯示對方、現在的關係、換過幾次');
  var fit = await H.ev("(function(){var box=document.getElementById('map').getBoundingClientRect(),bad=0,over=0,ls=Array.from(document.querySelectorAll('#map .mlbl')).map(function(e){return e.getBoundingClientRect();});Array.from(document.querySelectorAll('#map .mnode')).forEach(function(e){var r=e.getBoundingClientRect();if(r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1)bad++;if(e.scrollWidth>e.clientWidth+1)over++;});var ov=0;for(var i=0;i<ls.length;i++)for(var j=i+1;j<ls.length;j++){var a=ls[i],b=ls[j];if(a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom)ov++;}return {bad:bad,over:over,ov:ov,w:box.width,page:document.querySelector('.page').getBoundingClientRect().width,vw:window.innerWidth};})()");
  assert(fit.bad === 0 && fit.over === 0 && fit.ov === 0 && fit.page <= fit.vw, '直放：人都在圖裡、名字不擠出去、線上的字不疊在一起，紙縮到螢幕寬：' + JSON.stringify(fit));
  if (OUT) await pg.screenshot({ path: OUT + '/v9_map_2_portrait.png', fullPage: true });
  await pg.setViewportSize({ width: 780, height: 360 }); await pg.waitForTimeout(200);
  // 看別人的那張紙沒有這一頁；更多裡的那一列
  await H.serial('J2'); assert((await H.main()).indexOf('交換關係') < 0, '看別人的那張紙沒有交換關係'); await H.clickText('回我自己', '#tother');
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
