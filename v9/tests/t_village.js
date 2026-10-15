// 村子：用手指邀鄰居（他的那張紙）、換人在事件簿最上面看到提醒、更多→鄰居和村子同意、到達秒屋挑地（從上面看、點一塊框起來的地、朝向）、走過去（點別間、畫面滑過去、停在日曆那面）、
// 「看村子」拉遠（日曆很高時停在這個月那塊附近、看得到點得到隔壁）、空出來的地先選好（補十八）、鄰居看得到只給鄰居看的屋和日曆紙、申請搬進要大家同意、換位置、搬走；10 間屋每間塞滿（也試 60 年份的高日曆）繪製次數不超過 80；轉橫、直放。
// node v9/tests/t_village.js <test9.html> [截圖資料夾]
var lib = require('./lib'), assert = lib.assert;
var J1 = '00000000001', J2 = '00000000002', J3 = '00000000003', J5 = '00000000005', OUT = process.argv[3];
(async function () {
  var H = await lib.open(process.argv[2], { touch: true }), pg = H.pg;
  await H.fresh();
  var info = function () { return H.ev("WORLD.info()"); };
  // 1. 示範：阿澄和小樂住同一個村子；從阿澄的達秒屋看得到兩間、點小樂那間畫面滑過去、停在日曆那一面
  assert((await H.ev("CORE.isNeighbor(APP.state(),'" + J2 + "','" + J3 + "')")) && !(await H.ev("!!CORE.villageOf(APP.state(),'" + J5 + "')")), '示範：阿澄、小樂是鄰居，阿明不在村子');
  await H.serial('J2'); await H.clickText('看他的達秒屋', '#tmain'); await pg.waitForTimeout(600);
  var i0 = await info(); assert(i0.houses === 2 && i0.serial === J2 && (await pg.textContent('#hwho')).indexOf('村子 2 間') >= 0 && (await pg.isVisible('#hVillage')), '阿澄的達秒屋：畫出村子兩間，最上面寫村子 2 間，有「看村子」');
  await H.hclick('#hVillage'); await pg.waitForTimeout(1100); var ov = await info();
  assert(ov.phi < 0.6 && ov.dist > 30 && ov.serial === J2, '看村子：拉遠從上面看整個村子（phi ' + ov.phi.toFixed(2) + '、距離 ' + ov.dist.toFixed(0) + '）');
  await H.tap3d({ house: J3 }, '小樂那間屋'); await pg.waitForTimeout(300);
  var mid = await info(); assert(mid.serial === J3 && mid.animating, '點村裡另一間：換成小樂的屋，畫面正在滑過去');
  await pg.waitForTimeout(1100); var end = await info(), pose = await H.ev("JSON.stringify(WORLD.calPose())");
  var pz = JSON.parse(pose); assert(!end.animating && Math.abs(end.phi - pz.phi) < 0.01 && Math.abs(end.dist - pz.dist) < 0.1 && (await pg.textContent('#hwho')).indexOf('J3 小樂') >= 0, '一秒後停在小樂那一間日曆那一面');
  assert((await H.ev("(function(){var s=WORLD.screenOf({cal:CORE.houseOf(APP.roleOf('" + J3 + "')).cal.blocks.filter(Boolean).slice(-1)[0]});var c=document.querySelector('#hstage canvas').getBoundingClientRect();return s&&Math.abs(s.x-c.width/2)/c.width<0.2;})()")), '這個月那塊日曆在畫面中間附近');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_village_1.png' });
  await H.tap3d('door', '小樂的門'); assert((await H.sheetName()) === 'other:res' && (await pg.textContent('#tother')).indexOf('J3 小樂') >= 0, '點門才進去：到小樂的資源表');
  // 2. 邀鄰居：J1 在阿明的那張紙按「邀他當鄰居」→ 換成阿明 → 事件簿最上面提醒 → 更多→鄰居和村子 → 去挑地 → 達秒屋從上面看、點一塊框起來的地
  await H.clickText('回我自己', '#tother'); await H.serial('J5'); await H.clickText('邀他當鄰居', '#tmain'); await H.popOk('邀他');
  assert((await H.msg()).indexOf('邀了') >= 0 && (await H.ev("(function(){var v=CORE.villageOf(APP.state(),'" + J1 + "');return v&&v.proposed&&v.pending.length===1;})()")), '邀了阿明：提議一個新村子，等他答覆');
  await H.clickText('回我自己', '#tother'); await H.nav('village'); assert((await H.main()).indexOf('你邀 阿明 當鄰居') >= 0 && (await H.main()).indexOf('不邀了') >= 0, '鄰居和村子：寫等他答覆、可以不邀了');
  await H.becomeMe(J5); await H.nav('log');
  assert((await H.ev("document.querySelector('#tmain .remind').textContent")).indexOf('我 邀你當鄰居：同意就去挑地') >= 0, '阿明的事件簿最上面：J1 邀你當鄰居');
  await H.finger("function(){ return document.querySelector('#tmain .remind [data-act=\"open\"][data-s=\"village\"]'); }", '去看');
  assert((await H.sheetName()) === 'village' && (await H.main()).indexOf('邀我的') >= 0 && (await H.main()).indexOf('大家都同意了') >= 0, '鄰居和村子那張紙：邀我的一列，大家都同意了');
  await H.clickText('去挑地', '#tmain'); await pg.waitForTimeout(700);
  var pk = await info(); assert(!(await H.ev("document.getElementById('view-house').hidden")) && pk.spots >= 20 && pk.phi < 0.6 && (await pg.isVisible('#hpick')) && (await pg.textContent('#hpickText')).indexOf('點一塊框起來的地') >= 0, '到達秒屋挑地：從上面看，能放的地畫框（' + pk.spots + ' 塊）');
  var spotsOk = await H.ev("(function(){var S=APP.state(),v=CORE.villageOf(S,'" + J1 + "'),sp=CORE.freeSpots(S,v.id);return sp.every(function(p){return Math.max(Math.abs(p[0]),Math.abs(p[1]))<=2&&!(p[0]===0&&p[1]===0);});})()");
  assert(spotsOk, '能放的地：靠著 J1 那間、中間最多隔一塊，J1 那塊不算');
  await H.hclick('#hRots [data-rot="90"]'); assert((await pg.textContent('#hpickText')).indexOf('朝向 90°') >= 0, '選朝向 90°');
  await H.tap3d({ spot: [2, 0] }, '隔一塊的那塊地'); assert((await H.popOpen()) && (await H.popTitle()) === '放在這裡？', '點一塊地：問放在這裡？'); await H.popOk('放這裡'); await pg.waitForTimeout(600);
  var vj = await H.ev("(function(){var v=CORE.villageOf(APP.state(),'" + J5 + "');var m=v&&v.members.find(function(x){return x.serial==='" + J5 + "';});return v&&!v.proposed?{n:v.members.length,pos:m.pos,rot:m.rot}:null;})()");
  assert(vj && vj.n === 2 && vj.pos.join() === '2,0' && vj.rot === 90 && (await H.ev("CORE.isNeighbor(APP.state(),'" + J1 + "','" + J5 + "')")), '放好了：村子開了（兩間），阿明在 [2,0] 朝 90°，跟 J1 是鄰居');
  var af = await info(); assert(af.serial === J5 && af.houses === 2 && af.rot === 90 && !(await pg.isVisible('#hpick')), '挑完到自己的達秒屋：畫出村子兩間、照朝向擺');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_village_2.png' });
  // 3. 鄰居看得到只給鄰居看的屋和日曆紙；陌生人看不到
  await H.ev("(function(){var S=APP.state(),t=APP.now();CORE.setHouse(S,'" + J1 + "',{visibility:'neighbors'});var s=CORE.addSlot(S,'" + J1 + "',t+1.5e6,1,null,t);CORE.book(S,'" + J2 + "',s.id,t);CORE.setWants(S,s.id,'" + J2 + "','" + J1 + "',['r1b']);CORE.setWants(S,s.id,'" + J1 + "','" + J2 + "',['r2b']);APP.changed();})()");
  await pg.waitForFunction("APP.state().entries.some(function(e){return e.status==='traded'&&e.a==='" + J1 + "';})", null, { timeout: 15000 }); await pg.waitForTimeout(300); if (await H.popOpen()) await H.popOk();
  await H.ev("(function(){var S=APP.state();var e=S.entries.find(function(x){return x.status==='traded'&&x.a==='" + J1 + "';});CORE.setVis(S,'" + J1 + "',e.id,'neighbors');APP.changed();})()");
  await H.ev("document.getElementById('hmsg').hidden=true"); await H.tap3d({ house: J1 }, 'J1 那間'); await pg.waitForTimeout(1300);
  assert(!(await H.ev("HOUSE.data().closed")) && (await info()).lit === 1 && (await pg.textContent('#hwho')).indexOf('只給鄰居看') < 0, '阿明是鄰居：J1 整間屋只給鄰居看也看得到，那一筆只給鄰居看也亮');
  await H.hclick('#hBack'); await H.serial('J1'); await H.clickText('看他的日曆', '#tmain'); var today = await H.ev("CORE.dayNum(APP.now())");
  assert((await H.ev("document.querySelector('#tmain table.calp td[data-day=\"" + today + "\"]').className")).indexOf('lit1') >= 0 && (await H.main()).indexOf('只給鄰居看') < 0, '鄰居看日曆紙：今天那格亮');
  await H.clickText('回我自己', '#tother');
  await H.becomeMe(J3); await H.ev("APP.goHouse('" + J1 + "');HOUSE.render({resetCamera:true})"); await pg.waitForTimeout(400);
  assert((await H.ev("HOUSE.data().closed")) && (await info()).houses === 1, '小樂不是鄰居：只看得到外觀，不顯示村子');
  await H.hclick('#hBack');
  // 4. 申請搬進來要村裡每個人同意：小樂先搬離示範的村子（阿澄一個人，村子散了），申請搬去 J1 的村子 → J1、阿明都同意 → 挑地
  await H.ev("(function(){CORE.leaveVillage(APP.state(),'" + J3 + "');APP.changed();})()"); assert((await H.ev("!CORE.villageOf(APP.state(),'" + J2 + "')")), '小樂搬走：阿澄剩一人，示範的村子散了');
  await H.serial('J5'); await H.clickText('申請搬去他那個村子', '#tmain'); await H.popOk('申請'); assert((await H.msg()).indexOf('申請了') >= 0, '小樂申請搬去阿明那個村子');
  await H.clickText('回我自己', '#tother');
  await H.becomeMe(J1); await H.nav('log'); assert((await H.ev("document.querySelector('#tmain .remind').textContent")).indexOf('小樂 申請搬進來：你同意嗎') >= 0, 'J1 事件簿最上面：小樂申請搬進來');
  await H.nav('village'); assert((await H.main()).indexOf('還沒同意：我、阿明') >= 0, '待同意：還沒同意的是我和阿明'); await H.clickText('同意', '#tmain');
  assert((await H.main()).indexOf('還沒同意：阿明') >= 0 && (await H.main()).indexOf('你同意了') >= 0, 'J1 同意了，還差阿明');
  await H.becomeMe(J3); await H.nav('village'); assert((await H.main()).indexOf('我申請的') >= 0 && (await H.main()).indexOf('還沒同意：阿明') >= 0 && !(await H.ev("!!document.querySelector('#tmain [data-act=\"vJoin\"]')")), '小樂那邊：還不能挑地');
  await H.becomeMe(J5); await H.nav('village'); await H.clickText('同意', '#tmain');
  await H.becomeMe(J3); await H.nav('village'); await H.clickText('去挑地', '#tmain'); await pg.waitForTimeout(700);
  assert((await info()).spots > 0, '大家都同意了：小樂可以挑地');
  await H.tap3d({ spot: [1, 1] }, '[1,1] 那塊地'); await H.popOk('放這裡'); await pg.waitForTimeout(600);
  assert((await H.ev("CORE.villageOf(APP.state(),'" + J1 + "').members.length")) === 3 && (await info()).houses === 3, '小樂搬進來：村子三間');
  // 5. 換位置、搬走
  await H.hclick('#hBack'); await H.nav('village'); await H.clickText('換位置', '#tmain'); await pg.waitForTimeout(700);
  assert((await pg.textContent('#hpickText')).indexOf('換位置') >= 0 && (await info()).spots > 0, '換位置：也到達秒屋挑地');
  await H.tap3d({ spot: [3, 0] }, '[3,0]'); await H.popOk('換過來'); await pg.waitForTimeout(600);
  assert((await H.ev("CORE.villageOf(APP.state(),'" + J3 + "').members.find(function(m){return m.serial==='" + J3 + "';}).pos.join()")) === '3,0', '換到 [3,0]');
  await H.hclick('#hBack'); await H.nav('village'); await H.clickText('搬走', '#tmain'); await H.popOk('搬走');
  assert((await H.ev("!CORE.villageOf(APP.state(),'" + J3 + "')")) && (await H.ev("CORE.villageOf(APP.state(),'" + J1 + "').members.length")) === 2 && (await H.msg()) === '搬走了', '搬走：不用誰同意，村子剩兩間');
  // 5b. 空出來的地先選好（補十八）：小樂換過位置又搬走，村裡有空出來的地 → 阿澄搬進來挑地時，那塊已經選好、有那句話，按「放在選好的這塊」
  var sug = await H.ev("JSON.stringify(CORE.suggestedSpot(APP.state(),CORE.villageOf(APP.state(),'" + J1 + "').id))");
  assert(sug !== 'null', '村裡有空出來的地：' + sug);
  await H.becomeMe(J2); await H.serial('J1'); await H.clickText('申請搬去他那個村子', '#tmain'); await H.popOk('申請'); await H.clickText('回我自己', '#tother');
  await H.ev("(function(){var S=APP.state(),v=CORE.villageOf(S,'" + J1 + "'),p=v.pending.find(function(x){return x.who==='" + J2 + "';});v.members.forEach(function(m){CORE.approveVillage(S,m.serial,v.id,p.id);});APP.changed();})()");
  await H.nav('village'); await H.clickText('去挑地', '#tmain'); await pg.waitForTimeout(700);
  var pt = await pg.textContent('#hpickText');
  assert(pt.indexOf('這裡原本有人住，補進來村子比較完整') >= 0 && JSON.stringify((await info()).selSpot) === JSON.stringify(JSON.parse(sug).join()) && (await pg.isVisible('#hPickSel')), '挑地：那塊已經選好（塗黃）、寫「這裡原本有人住，補進來村子比較完整」');
  assert(pt.indexOf('已經幫你選好一塊：這裡原本有人住，補進來村子比較完整。也可以點別塊。') >= 0 && pt.indexOf('[') < 0 && !/\d/.test(pt), '那句話沒有「[」、沒有數字座標（第 9 輪）：' + pt);
  if (OUT) await pg.screenshot({ path: OUT + '/v9_village_6_suggest.png' });
  await H.hclick('#hPickSel'); assert((await H.popTitle()) === '放在這裡？', '按「放在選好的這塊」問一下'); await H.popOk('放這裡'); await pg.waitForTimeout(500);
  assert((await H.ev("JSON.stringify(CORE.villageOf(APP.state(),'" + J2 + "').members.find(function(m){return m.serial==='" + J2 + "';}).pos)")) === sug && (await H.ev("JSON.stringify(CORE.suggestedSpot(APP.state(),CORE.villageOf(APP.state(),'" + J1 + "').id))")) !== sug, '阿澄補進那塊，那塊就不再是空出來的地');
  await H.ev("(function(){CORE.leaveVillage(APP.state(),'" + J2 + "');APP.changed();})()"); await H.hclick('#hBack');
  // 6. 10 間屋、每間塞滿：一個畫面繪製次數不超過 80；直放也畫得出來（換回 J1 看自己的村子）
  await H.becomeMe(J1);
  var big = await H.ev("(function(){var S=APP.state(),t=APP.now(),v=CORE.villageOf(S,'" + J1 + "'),K=Object.keys(CORE.BLOCKS).filter(function(k){return k!=='door';}),made=[];for(var i=0;i<8;i++){var r=CORE.createRole(S,{name:'村民'+i,dailyPoints:100,rules:{},resources:[]},t);r.born-=9000;made.push(r.serial);}S.roles.filter(function(r){return v.members.some(function(m){return m.serial===r.serial;})||made.indexOf(r.serial)>=0;}).forEach(function(r){r.born-=9000;});CORE.growCalendars(S,t);var sp=CORE.freeSpots(S,v.id);made.forEach(function(ser,i){var p=CORE.applyVillage(S,ser,'" + J1 + "',t);v.members.forEach(function(m){CORE.approveVillage(S,m.serial,v.id,p.id);});var spots=CORE.freeSpots(S,v.id);CORE.joinVillage(S,ser,v.id,p.id,spots[i%spots.length],[0,90,180,270][i%4],t);});v.members.forEach(function(m){var r=APP.roleOf(m.serial),h=CORE.houseOf(r),p=CORE.plotAt(r,t),res=CORE.reserved(h,p),L=[];for(var x=p.min;x<=p.max;x++)for(var y=0;y<p.height;y++)for(var z=p.min;z<=p.max;z++){var key=x+','+y+','+z;if(res.cal[key]||res.front[key]||res.door[key]||res.dfront[key])continue;var k=K[(x*7+y*3+z*5+999)%K.length];L.push(CORE.BLOCKS[k].type==='prop'?[x,y,z,k,90]:[x,y,z,k]);}CORE.setBlocks(S,m.serial,L,t);});APP.changed();return {n:v.members.length,size:CORE.plotAt(APP.roleOf('" + J1 + "'),t).size,blocks:CORE.houseOf(APP.roleOf('" + J1 + "')).blocks.length};})()");
  var t0 = Date.now(); await H.ev("APP.goHouse('" + J1 + "');HOUSE.render({resetCamera:true});WORLD.renderNow()"); var open = Date.now() - t0; var bi = await info();
  assert(big.n === 10 && big.size === 32 && big.blocks > 15000 && bi.houses === 10 && bi.calls <= 80, '10 間屋（32×32）每間塞滿：打得開（' + open + ' ms），畫 ' + bi.farFaces + ' 面遠的，繪製 ' + bi.calls + ' 次');
  if (await H.popOpen()) await H.popOk();   // 日曆長到這裡拆了幾塊的提示
  await H.hclick('#hVillage'); await pg.waitForTimeout(1100); await H.ev("WORLD.renderNow()"); var bo = await info(); assert(bo.calls <= 80, '拉遠看整個村子：繪製 ' + bo.calls + ' 次');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_village_3_ten.png' });
  // 6b. 每間都是 60 年份的高日曆（補十七：日曆往上不受地皮高度限制）：繪製次數照樣不超過 80；拉遠看村子時這個月那塊照得到
  var tallV = await H.ev("(function(){var S=APP.state(),v=CORE.villageOf(S,'" + J1 + "'),t=APP.now(),n=[];v.members.forEach(function(m){var r=APP.roleOf(m.serial);r.born-=365*35;var h=CORE.houseOf(r);h.cal.blocks=h.cal.blocks.slice(0,1);});CORE.growCalendars(S,t);v.members.forEach(function(m){var r=APP.roleOf(m.serial),h=CORE.houseOf(r);n.push([CORE.ageOf(CORE.bornOf(r),CORE.dayNum(t)).years,h.cal.blocks.length,Math.max.apply(null,h.cal.blocks.map(function(q){return q[1]+2;}))]);});APP.changed();return n;})()");
  await H.ev("APP.goHouse('" + J1 + "');HOUSE.render({resetCamera:true});WORLD.renderNow()"); if (await H.popOpen()) await H.popOk(); await H.ev("WORLD.renderNow()");
  var ti = await info();
  assert(tallV.every(function (x) { return x[0] >= 59 && x[1] >= 700 && x[2] > 300; }) && ti.houses === 10 && ti.calls <= 80, '10 間屋、每間 60 年份的高日曆（' + tallV[0][1] + ' 塊、高 ' + tallV[0][2] + '）、每間塞滿：繪製 ' + ti.calls + ' 次');
  // 看村子（第 8 輪）：跟看屋差不多近，這個月那塊看得清楚；隔壁一間的塔頭在畫面裡、點得到、點了走過去。轉橫和直放各一次
  var checkTall = async function (tag) {
    await H.ev("HOUSE.render({resetCamera:true});WORLD.renderNow()"); if (await H.popOpen()) await H.popOk();
    var base = await H.ev("(function(){var l=CORE.houseOf(APP.me()).cal.blocks;return WORLD.calScreenSize(l[l.length-1]);})()");
    await H.hclick('#hVillage'); await pg.waitForTimeout(1100); await H.ev("WORLD.renderNow()");
    var tv = await H.ev("(function(){var i=WORLD.info(),l=CORE.houseOf(APP.me()).cal.blocks,last=l[l.length-1],s=WORLD.screenOf({cal:last}),sz=WORLD.calScreenSize(last),c=document.querySelector('#hstage canvas').getBoundingClientRect(),vp=WORLD.villagePose(),n=vp.neighbor,ns=n?WORLD.screenOf({house:n}):null,el=ns?document.elementFromPoint(ns.x,ns.y):null,h=ns?WORLD.hitAt(ns.x,ns.y):null;return {calls:i.calls,inView:!!s&&s.x>c.left&&s.x<c.right&&s.y>c.top+40&&s.y<c.bottom-40,sz:sz,n:n,ns:ns,canvas:!!el&&el.tagName==='CANVAS',hit:h&&h.kind==='house'&&h.serial===n};})()");
    assert(tv.calls <= 80 && tv.inView && tv.sz && tv.sz.h >= base.h * 0.5, tag + '：高日曆的村子看村子，繪製 ' + tv.calls + ' 次，這個月那塊在畫面裡、高 ' + Math.round(tv.sz.h) + ' 像素（看屋時 ' + Math.round(base.h) + '）');
    assert(tv.n && tv.ns && tv.canvas && tv.hit, tag + '：隔壁一間（' + tv.n + '）的塔頭在畫面上、是畫布、點得到');
    if (OUT) await pg.screenshot({ path: OUT + '/v9_village_5_tall_' + tag + '.png' });
    await H.tap3d({ house: tv.n }, '隔壁那間'); await pg.waitForTimeout(1300);
    assert((await info()).serial === tv.n && !(await info()).animating, tag + '：點隔壁那間，走過去');
    await H.ev("APP.goHouse('" + J1 + "')"); await pg.waitForTimeout(300);
  };
  await checkTall('轉橫');
  await pg.setViewportSize({ width: 360, height: 780 }); await pg.waitForTimeout(300); await checkTall('直放'); await pg.setViewportSize({ width: 780, height: 360 }); await pg.waitForTimeout(300);
  await pg.setViewportSize({ width: 360, height: 780 }); await pg.waitForTimeout(300); await H.ev("HOUSE.render({resetCamera:true});WORLD.renderNow()");
  var pv = await info(); assert(pv.houses === 10 && pv.calls <= 80 && (await H.ev("(function(){var s=WORLD.screenOf({cal:CORE.houseOf(APP.me()).cal.blocks.filter(Boolean).slice(-1)[0]});return !!s&&s.y>60&&s.y<innerHeight-60;})()")), '直放：村子照樣畫得出來，這個月那塊日曆在畫面裡');
  if (OUT) await pg.screenshot({ path: OUT + '/v9_village_4_portrait.png' });
  await pg.setViewportSize({ width: 780, height: 360 });
  assert(H.errs.length === 0, '沒有頁面錯誤' + (H.errs.length ? '：' + H.errs.join(' | ') : ''));
  await H.close(); console.log(lib.fails() ? 'FAILED ' + lib.fails() : 'ALL OK');
})().catch(function (e) { console.error(e); process.exit(1); });
