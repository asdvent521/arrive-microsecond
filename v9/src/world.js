/* ===== v9 能量之家（3D）：只畫 CORE.viewHouse／viewVillage 回傳的資料 =====
 * 村子（第 6 輪）：每一間照村子的格子座標和朝向放（一格 CORE.VILLAGE_CELL）；看的那一間畫全部，其他間畫簡單（外形、日曆方塊、門，全村合成幾個網格）；
 * 點別間畫面滑過去（約一秒）；挑地時把能放的地畫框，點一塊就放。
 * 兩部分：日曆（一個月一塊 2×2×1 的方塊，全部在 z＝0 那一面、正面朝前；正面畫月份和一天一塊磚，位置照 CORE 算好的清單）和自己蓋的方塊（門也是一塊）。
 * 同一種東西一次畫完：磚用 InstancedMesh；所有日曆方塊的正面合成一個網格、月份字和日子的空位畫在同一張貼圖上；方塊同一種合成一個網格，被擋住的面不畫。沒在動就不重畫。
 * 一指拖著轉、兩指縮放、滾輪縮放；點一下（沒拖動）才算點。點方塊用格子一格一格找（不用逐個三角形比），地皮塞滿也快。
 * 只用資料畫：方塊種類是清單裡的字，畫面由這裡的程式畫。不讀紀錄、不改資料。
 */
var WORLD = (function () {
  'use strict';
  var T = typeof THREE !== 'undefined' ? THREE : null;
  var api = { available: false };
  if (!T) return stub();
  var renderer, scene, camera, root, container, picks = [], dirty = true, raf = 0, paused = false, onTap = null, lastKey = '';
  var cam = { theta: 0, phi: 1.35, dist: 12, target: new T.Vector3(0, 1, 1), minD: 1.2, maxD: 900 };
  var current = null, building = false, lastCalls = 0, vox = null, counts = {}, focus = null, anim = null;
  var hg = null, tgt = null, village = null, spots = null, hgM = null, hgInv = null, farBoxes = [];   // hg：看的那一間的群組；tgt：現在把東西加到哪個群組
  function stub() { return { available: false, init: function () { return false; }, show: function () {}, onTap: function () {}, info: function () { return { calls: 0, bricks: 0 }; }, screenOf: function () { return null; }, hitAt: function () { return null; }, focusDay: function () {}, lookCalendar: function () {}, lookVillage: function () {}, pause: function () {}, resume: function () {}, resize: function () {}, setInsets: function () {}, camera: function () { return null; } }; }

  /* ---------- 日曆方塊的尺寸（單位：一格方塊＝1；一塊日曆 2×2×1） ---------- */
  var CW = 2, CH = 2, CD = 1, LBL = 0.36, P = CW / 7, RP = (CH - LBL) / 6, BS = 0.2, BD = 0.06;   // 七欄、六排
  var ZF = CORE.CAL_Z + CD;   // 正面在 z＝1
  function brickPos(pos, g) { return { x: pos[0] + g.col * P + P / 2, y: pos[1] + CH - LBL - g.row * RP - RP / 2, z: ZF + BD / 2 }; }

  /* ---------- 材質、貼圖 ---------- */
  var CAL_BODY = '#5E564C', CAL_FACE = '#6C6357', DAY_EMPTY = '#7B7266', BRICK = '#CDBB9E';
  var dashedTex = null, clothTex = null;
  function dashed() {
    if (dashedTex) return dashedTex;
    var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#ffffff'; g.lineWidth = 7; g.setLineDash([11, 8]); g.strokeRect(5, 5, 54, 54);
    dashedTex = new T.CanvasTexture(c); return dashedTex;
  }
  function cloth() {
    if (clothTex) return clothTex;
    var c = document.createElement('canvas'); c.width = c.height = 32; var g = c.getContext('2d');
    g.fillStyle = '#8E979E'; g.fillRect(0, 0, 32, 32); g.strokeStyle = '#B4BCC2'; g.lineWidth = 3;
    for (var i = -32; i < 64; i += 9) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 32, 32); g.stroke(); }
    clothTex = new T.CanvasTexture(c); return clothTex;
  }
  var FONT = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
  function signTexture(lines, bg, fg) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 160; var g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 512, 160); g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(6, 6, 500, 148);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach(function (t, i) { g.font = (i === 0 ? '700 48px ' : '400 36px ') + FONT; g.fillText(t, 256, lines.length === 1 ? 80 : 52 + i * 60, 480); });
    return new T.CanvasTexture(c);
  }
  // 所有月份的正面畫在同一張貼圖上：一塊一格（月份字、每一天的空位），正面的網格用 UV 對過去
  // 貼圖大小（第 8 輪）：任何歲數都不超過 2048×2048。256 塊以內一格 128、一排 16 格（最多 2048×2048）；
  // 1024 塊以內一格 64、一排 32 格（60 年 720 塊是 2048×1472）；再多一格 32、一排 64 格。格子小時月份字放大一點，照樣看得清楚
  var TILE = 128, ATLAS_COLS = 16, lastAtlas = null;
  function atlasSize(n) { n = Math.max(1, n); var tile = n <= 256 ? 128 : n <= 1024 ? 64 : 32, cols = 2048 / tile, rows = Math.ceil(n / cols); return { tile: tile, cols: cols, w: tile * Math.min(cols, n), h: tile * rows }; }
  function atlasTexture(months) {
    var n = Math.max(1, months.length), sz = atlasSize(n); TILE = sz.tile; ATLAS_COLS = sz.cols; var rows = Math.ceil(n / ATLAS_COLS);
    var c = document.createElement('canvas'); c.width = TILE * Math.min(ATLAS_COLS, n); c.height = TILE * rows; var g = c.getContext('2d');
    g.fillStyle = CAL_FACE; g.fillRect(0, 0, c.width, c.height);
    var ppu = TILE / 2;   // 一塊 2×2 格
    months.forEach(function (ym, i) {
      if (!ym) return;
      var ox = (i % ATLAS_COLS) * TILE, oy = Math.floor(i / ATLAS_COLS) * TILE;
      var first = new Date(Date.UTC(ym.y, ym.m - 1, 1)).getUTCDay(), days = new Date(Date.UTC(ym.y, ym.m, 0)).getUTCDate();
      g.fillStyle = ym.preview ? '#7E7568' : DAY_EMPTY;
      for (var d = 0; d < days; d++) { var row = Math.floor((first + d) / 7), col = (first + d) % 7; g.fillRect(ox + (col * P + (P - BS) / 2) * ppu, oy + (LBL + row * RP + (RP - BS) / 2) * ppu, BS * ppu, BS * ppu); }
      g.fillStyle = '#EDE4CC'; g.font = '600 ' + Math.max(9, Math.round(LBL * ppu * (TILE >= 128 ? 0.68 : 0.95))) + 'px ' + FONT; g.textBaseline = 'middle'; g.textAlign = 'left';
      var label = ym.first ? '起點 ' + ym.y + ' 年 ' + ym.m + ' 月' : ym.m === 1 ? ym.y + ' 年 1 月' : ym.m + ' 月';
      if (ym.preview) label = '下個月 ' + ym.m + ' 月';
      g.fillText(label, ox + 3, oy + LBL * ppu / 2, TILE - 6);
    });
    lastAtlas = { w: c.width, h: c.height };
    var tex = new T.CanvasTexture(c); tex.anisotropy = 4; tex.flipY = false; return tex;
  }
  // 磚的顏色（補二十二）：跟人成交越多顏色越深（1～3 級）；亮的（有前情提要）是自己發光的亮色，暗的是受光的深色
  function litColor(level) { return new T.Color(level >= 3 ? '#E8A41C' : level === 2 ? '#F0BE4A' : '#F7D684'); }
  function darkColor(level) { return new T.Color(level >= 3 ? '#8A5E16' : level === 2 ? '#B07F2A' : '#C9A14A'); }
  var LIT_GRAY = '#F6F1E3';   // 亮的灰白：只有前情提要

  /* ---------- 建場景 ---------- */
  function init(el) {
    container = el;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' }); } catch (e) { api.available = false; return false; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0xDCE6EE);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none'; renderer.domElement.style.display = 'block';
    scene = new T.Scene(); scene.fog = new T.Fog(0xDCE6EE, 260, 1400);   // 遠一點才起霧：拉遠看整個村子也看得到
    camera = new T.PerspectiveCamera(42, 1, 0.05, 2000);
    scene.add(new T.HemisphereLight(0xffffff, 0x8a8f96, 0.8));
    var sun = new T.DirectionalLight(0xffffff, 0.65); sun.position.set(20, 50, 35); scene.add(sun);
    root = new T.Group(); scene.add(root);
    bindInput(renderer.domElement);
    window.addEventListener('resize', function () { resize(); });
    resize();
    return true;
  }
  function clear() {
    root.children.slice().forEach(function (o) { root.remove(o); o.traverse(function (x) { if (x.geometry) x.geometry.dispose(); if (x.material) { (Array.isArray(x.material) ? x.material : [x.material]).forEach(function (m) { if (m.map && m.map !== dashedTex && m.map !== clothTex) m.map.dispose(); m.dispose(); }); } }); });
    picks = []; counts = {}; focus = null; farBoxes = [];
    hg = new T.Group(); hg.name = 'house'; root.add(hg); tgt = hg;
  }
  function add(o, name) { o.name = name; (tgt || root).add(o); return o; }
  // 一間屋在村子裡的位置：格子座標 × 一格的大小，照朝向轉（0 朝 +z、90 朝 +x）
  var CELL = CORE.VILLAGE_CELL;
  function houseMatrix(pos, rot) { var m = new T.Matrix4(); m.makeRotationY((rot || 0) * Math.PI / 180); m.setPosition(pos[0] * CELL, 0, pos[1] * CELL); return m; }
  function toWorld(v) { return hgM ? v.clone().applyMatrix4(hgM) : v.clone(); }
  function inst(geo, mat, n, name) { var m = new T.InstancedMesh(geo, mat, Math.max(1, n)); m.count = n; m.frustumCulled = false; return add(m, name); }
  var M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), SV = new T.Vector3(1, 1, 1), E = new T.Euler();
  function setM(mesh, i, p, ry, s) { E.set(0, ry || 0, 0); Q.setFromEuler(E); V.set(p.x, p.y, p.z); SV.set(s || 1, s || 1, s || 1); M4.compose(V, Q, SV); mesh.setMatrixAt(i, M4); }

  /* ---------- 日曆：方塊的身體（一次畫完）、正面（合成一個網格、一張貼圖）、磚、預告框 ---------- */
  function buildCalendar(view) {
    var cal = view.cal, closed = view.closed, list = cal.blocks, months = cal.months.slice();
    var bodies = list.filter(Boolean);
    var body = inst(new T.BoxGeometry(CW, CH, CD), new T.MeshLambertMaterial({ color: CAL_BODY }), bodies.length, 'calbody');
    bodies.forEach(function (p, i) { setM(body, i, { x: p[0] + CW / 2, y: p[1] + CH / 2, z: CORE.CAL_Z + CD / 2 }); }); body.instanceMatrix.needsUpdate = true;
    // 正面：每一塊一個四邊形，UV 對到貼圖上自己那一格
    if (cal.preview) months.push(Object.assign({ preview: true }, cal.preview.month));
    var tex = atlasTexture(months), cols = Math.min(ATLAS_COLS, Math.max(1, months.length)), rows = Math.ceil(Math.max(1, months.length) / ATLAS_COLS);
    var quad = function (pos, i, out) {
      var u0 = (i % ATLAS_COLS) / cols, v0 = Math.floor(i / ATLAS_COLS) / rows, u1 = u0 + 1 / cols, v1 = v0 + 1 / rows;
      var x0 = pos[0], x1 = pos[0] + CW, y0 = pos[1], y1 = pos[1] + CH, z = ZF + 0.004;
      var P4 = [[x0, y0, z, u0, v1], [x1, y0, z, u1, v1], [x1, y1, z, u1, v0], [x0, y1, z, u0, v0]];
      [0, 1, 2, 0, 2, 3].forEach(function (k) { out.pos.push(P4[k][0], P4[k][1], P4[k][2]); out.uv.push(P4[k][3], P4[k][4]); out.nor.push(0, 0, 1); });
    };
    var face = { pos: [], uv: [], nor: [] };
    list.forEach(function (p, i) { if (p) quad(p, i, face); });
    var mkFace = function (o, mat, name) { if (!o.pos.length) return; var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(o.pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(o.uv, 2)); g.setAttribute('normal', new T.Float32BufferAttribute(o.nor, 3)); add(new T.Mesh(g, mat), name); };
    mkFace(face, new T.MeshLambertMaterial({ map: tex }), 'calface');
    // 預告框：下一塊的位置，半透明的框（屋主看時上面寫會拆幾塊，由畫面層顯示在文字裡）
    if (cal.preview) {
      var pp = cal.preview.pos, pf = { pos: [], uv: [], nor: [] }; quad(pp, months.length - 1, pf);
      mkFace(pf, new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.6, depthWrite: false, depthTest: false }), 'previewface'); root.children[root.children.length - 1].renderOrder = 12;
      // 預告框被房子蓋住也看得到：框線和半透明的框都不管深度（穿過方塊畫出來），畫在最後
      var box = add(new T.Mesh(new T.BoxGeometry(CW, CH, CD), new T.MeshBasicMaterial({ color: '#8FB3D9', transparent: true, opacity: 0.28, depthWrite: false, depthTest: false })), 'preview');
      box.position.set(pp[0] + CW / 2, pp[1] + CH / 2, CORE.CAL_Z + CD / 2); box.renderOrder = 10;
      var edge = add(new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(CW + 0.02, CH + 0.02, CD + 0.02)), new T.LineBasicMaterial({ color: '#2D5A86', depthTest: false, transparent: true })), 'previewedge'); edge.position.copy(box.position); edge.renderOrder = 11;
      counts.previewThrough = true;
    }
    // 磚：沒亮、亮、蓋布、虛線（未來的預約），加上小記號；只畫在房子上有位置的
    var unlit = [], litGray = [], dark = [], litCol = [], cover = [], fut = [], mark = [];
    var posOf = function (b) { return b.g.m < list.length ? list[b.g.m] : (cal.preview && b.g.m === list.length ? cal.preview.pos : null); };
    view.bricks.forEach(function (b) {
      if (!b.onHouse || !b.g) return; var p = posOf(b); if (!p) return; b._p = p;
      // 暗的灰白（都沒有）、亮的灰白（只有前情提要）、暗的彩色（只跟人換）、亮的彩色（兩個都有）；藏起來的蓋布；未來的虛線
      if (closed) unlit.push(b); else if (b.future) fut.push(b); else if (b.cover) cover.push(b); else if (b.level && b.lit) litCol.push(b); else if (b.level) dark.push(b); else if (b.lit) litGray.push(b); else unlit.push(b);
      if (!closed && b.mark && !b.future) mark.push(b);
    });
    var geo = new T.BoxGeometry(BS, BS, BD);
    var put = function (bl, mat, name, colorFn) {
      var m = inst(geo.clone(), mat, bl.length, name);
      bl.forEach(function (b, i) { setM(m, i, brickPos(b._p, b.g)); if (colorFn) m.setColorAt(i, colorFn(b)); });
      m.instanceMatrix.needsUpdate = true; if (colorFn && m.instanceColor) m.instanceColor.needsUpdate = true;
      m.userData.days = bl.map(function (b) { return b.day; }); picks.push(m); counts[name] = bl.length; return m;
    };
    put(unlit, new T.MeshLambertMaterial({ color: closed ? '#A99C88' : BRICK }), 'unlit');
    put(litGray, new T.MeshBasicMaterial({ color: LIT_GRAY }), 'litgray');
    put(dark, new T.MeshLambertMaterial({ color: 0xffffff }), 'dark', function (b) { return darkColor(b.level); });
    put(litCol, new T.MeshBasicMaterial({ color: 0xffffff }), 'lit', function (b) { return litColor(b.level); });
    counts.litAll = litGray.length + litCol.length; counts.colored = dark.length + litCol.length;
    put(cover, new T.MeshLambertMaterial({ map: cloth() }), 'cover');
    put(fut, new T.MeshBasicMaterial({ map: dashed(), transparent: true, opacity: 0.95, depthWrite: false }), 'future');
    var mk = inst(new T.BoxGeometry(BS * 0.36, BS * 0.36, 0.02), new T.MeshBasicMaterial({ color: '#2B2520' }), mark.length, 'mark');
    mark.forEach(function (b, i) { var p = brickPos(b._p, b.g); setM(mk, i, { x: p.x, y: p.y, z: p.z + BD / 2 + 0.011 }); }); mk.instanceMatrix.needsUpdate = true; counts.mark = mark.length;
    view.bricks.forEach(function (b) { delete b._p; });
    counts.cal = bodies.length;
  }
  // 門：一塊 1×2 的方塊，照方向轉；門牌掛在門上方
  function buildDoor(view) {
    var d = view.look.door, f = CORE.doorFront(d[4] || 0), ry = (d[4] || 0) * Math.PI / 180, cx = d[0] + 0.5, cz = d[2] + 0.5;
    var frame = add(new T.Mesh(new T.BoxGeometry(1, 2, 1), new T.MeshLambertMaterial({ color: '#3B342C' })), 'doorframe'); frame.position.set(cx, d[1] + 1, cz);
    var door = add(new T.Mesh(new T.BoxGeometry(0.84, 1.84, 0.12), new T.MeshLambertMaterial({ color: '#7A5536' })), 'door'); door.position.set(cx + f[0] * 0.47, d[1] + 1, cz + f[1] * 0.47); door.rotation.y = ry; picks.push(door);
    var knob = add(new T.Mesh(new T.SphereGeometry(0.05, 8, 6), new T.MeshBasicMaterial({ color: '#E8C35A' })), 'knob'); knob.position.set(cx + f[0] * 0.56 - f[1] * 0.28, d[1] + 0.95, cz + f[1] * 0.56 + f[0] * 0.28);
    var lines = view.closed ? ['只給鄰居看'] : [view.age ? view.age.text : '', view.sign ? '「' + view.sign + '」' : ''].filter(Boolean);
    var sign = add(new T.Mesh(new T.PlaneGeometry(1.6, 0.5), new T.MeshBasicMaterial({ map: signTexture(lines, view.closed ? '#3B4652' : '#F4EBD3', view.closed ? '#FFFFFF' : '#3B342C'), side: T.DoubleSide })), 'sign');
    sign.position.set(cx + f[0] * 0.52, d[1] + 2.35, cz + f[1] * 0.52); sign.rotation.y = ry;
  }

  /* ---------- 自己蓋的方塊：同一種合成一個網格，被擋住的面不畫 ---------- */
  var FACES = [ // 法線、四個角
    { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
    { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] }, { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }
  ];
  var KIND_IDS = null;
  function kindIds() { if (KIND_IDS) return KIND_IDS; KIND_IDS = { list: [null], id: {} }; Object.keys(CORE.BLOCKS).concat(['cal']).forEach(function (k) { KIND_IDS.id[k] = KIND_IDS.list.length; KIND_IDS.list.push(k); }); return KIND_IDS; }
  // 格子裡有什麼：自己蓋的方塊、門（兩格）、日曆方塊（四格）
  function makeVox(plot, blocks, cal) {
    var S = plot.size, H = plot.height, grid = new Uint8Array(S * H * S), K = kindIds(), doorAt = {};
    var idx = function (x, y, z) { if (x < plot.min || x > plot.max || z < plot.min || z > plot.max || y < 0 || y >= H) return -1; return ((x - plot.min) * H + y) * S + (z - plot.min); };
    blocks.forEach(function (b) { var i = idx(b[0], b[1], b[2]); if (i >= 0) grid[i] = K.id[b[3]] || 0; if (b[3] === 'door') { var j = idx(b[0], b[1] + 1, b[2]); if (j >= 0) grid[j] = K.id.door; doorAt[i] = b; doorAt[j] = b; } });
    cal.forEach(function (p) { if (!p) return; CORE.calCells(p).forEach(function (c) { var i = idx(c[0], c[1], c[2]); if (i >= 0) grid[i] = K.id.cal; }); });
    return { plot: plot, grid: grid, idx: idx, doorAt: doorAt, kindAt: function (x, y, z) { var i = idx(x, y, z); return i < 0 ? null : K.list[grid[i]]; } };
  }
  function typeOf(k) { return k === 'cal' ? 'solid' : k ? CORE.BLOCKS[k].type : null; }
  function buildBlocks(view) {
    var plot = view.plot, blocks = view.look.blocks;
    vox = makeVox(plot, blocks, view.cal.blocks);
    var byKind = {}, propList = {};
    blocks.forEach(function (b) { var t = typeOf(b[3]); if (t === 'door') return; if (t === 'prop') (propList[b[3]] = propList[b[3]] || []).push(b); else (byKind[b[3]] = byKind[b[3]] || []).push(b); });
    var faces = 0;
    Object.keys(byKind).forEach(function (k) {
      var t = typeOf(k), pos = [], nor = [], col = [], base = new T.Color(CORE.BLOCKS[k].hex), cc = new T.Color();
      byKind[k].forEach(function (b) {
        var h = ((b[0] * 73856093) ^ (b[1] * 19349663) ^ (b[2] * 83492791)) >>> 0, shade = 0.93 + (h % 100) / 100 * 0.07;
        FACES.forEach(function (f) {
          if (f.n[1] === -1 && b[1] === 0) return;                       // 貼地的底面看不到
          var nk = vox.kindAt(b[0] + f.n[0], b[1] + f.n[1], b[2] + f.n[2]), nt = typeOf(nk);
          if (nt === 'solid' || nt === 'lamp') return;                    // 旁邊是實心的：這一面看不到
          if (t === 'glass' && nt === 'glass') return;                    // 玻璃連著玻璃：中間不畫
          cc.copy(base).multiplyScalar(t === 'solid' ? shade * (f.n[1] === 1 ? 1 : f.n[1] === -1 ? 0.7 : 0.9) : 1);
          var q = f.c.map(function (c) { return [b[0] + c[0], b[1] + c[1], b[2] + c[2]]; });
          [0, 1, 2, 0, 2, 3].forEach(function (j) { pos.push(q[j][0], q[j][1], q[j][2]); nor.push(f.n[0], f.n[1], f.n[2]); col.push(cc.r, cc.g, cc.b); });
          faces++;
        });
      });
      if (!pos.length) return;
      var g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      var mat = t === 'lamp' ? new T.MeshBasicMaterial({ vertexColors: true }) : t === 'glass' ? new T.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false, side: T.DoubleSide }) : new T.MeshLambertMaterial({ vertexColors: true });
      var m = add(new T.Mesh(g, mat), 'blk-' + k); if (t === 'glass') m.renderOrder = 2;
    });
    counts.faces = faces; counts.blocks = view.look.n;
    // 擺設：一種擺設的每一個零件一次畫完，跟著方向轉
    Object.keys(propList).forEach(function (k) {
      (PROP_PARTS[k] || []).forEach(function (part, pi) {
        var list = propList[k], mesh = inst(part.g(), new T.MeshLambertMaterial({ color: part.c }), list.length, 'prop-' + k + '-' + pi);
        list.forEach(function (b, i) { var ry = -(b[4] || 0) * Math.PI / 180, ox = part.x || 0, oz = part.z || 0; setM(mesh, i, { x: b[0] + 0.5 + Math.cos(ry) * ox + Math.sin(ry) * oz, y: b[1] + part.y, z: b[2] + 0.5 - Math.sin(ry) * ox + Math.cos(ry) * oz }, ry); });
        mesh.instanceMatrix.needsUpdate = true;
      });
    });
    counts.props = Object.keys(propList).reduce(function (n, k) { return n + propList[k].length; }, 0);
  }
  var PROP_PARTS = {
    tree: [{ g: function () { return new T.CylinderGeometry(0.07, 0.1, 0.5, 6); }, c: '#7A5536', y: 0.25 }, { g: function () { return new T.ConeGeometry(0.42, 0.85, 8); }, c: '#4E7A3E', y: 0.9 }],
    flower: [{ g: function () { return new T.CylinderGeometry(0.02, 0.02, 0.35, 5); }, c: '#4E7A3E', y: 0.17 }, { g: function () { return new T.SphereGeometry(0.14, 8, 6); }, c: '#D9667A', y: 0.42 }],
    flag: [{ g: function () { return new T.CylinderGeometry(0.03, 0.03, 0.95, 6); }, c: '#555555', y: 0.47 }, { g: function () { return new T.BoxGeometry(0.4, 0.26, 0.03); }, c: '#C0453A', y: 0.8, x: 0.21 }],
    bench: [{ g: function () { return new T.BoxGeometry(0.85, 0.08, 0.32); }, c: '#8B6A44', y: 0.3 }, { g: function () { return new T.BoxGeometry(0.85, 0.3, 0.05); }, c: '#8B6A44', y: 0.48, z: -0.14 }]
  };
  // 地面：草地、地皮（蓋的時候加格線）
  function buildGround(plot) {
    var S = plot.size, was = tgt; tgt = root;
    var gr = add(new T.Mesh(new T.PlaneGeometry(S + 600, S + 600), new T.MeshLambertMaterial({ color: '#93A57F' })), 'ground');
    gr.rotation.x = -Math.PI / 2; gr.position.copy(toWorld(new T.Vector3(0, -0.02, 0)));
    tgt = was;
    var lot = add(new T.Mesh(new T.PlaneGeometry(S, S), new T.MeshLambertMaterial({ color: '#B4C39A' })), 'plot'); lot.rotation.x = -Math.PI / 2; lot.position.set(0, -0.005, 0);
    if (building) {
      var pts = [], a = plot.min, b = plot.max + 1;
      for (var i = a; i <= b; i++) { pts.push(i, 0.01, a, i, 0.01, b, a, 0.01, i, b, 0.01, i); }
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
      add(new T.LineSegments(g, new T.LineBasicMaterial({ color: '#5E6E4B', transparent: true, opacity: 0.45 })), 'grid');
    }
  }

  /* ---------- 村裡其他間：畫簡單（外形、日曆方塊、門），全村合成幾個網格；點到用地皮的外框找 ---------- */
  function buildFar(houses) {
    var was = tgt; tgt = root;
    var byKind = {}, calM = [], doorM = [], plotQ = { pos: [], nor: [] }, faceQ = { pos: [], nor: [] }, faces = 0;
    houses.forEach(function (h) {
      var view = h.view, M = houseMatrix(h.pos, h.rot), plot = view.plot, vx = makeVox(plot, view.look.blocks, view.cal.blocks), tv = function (x, y, z) { return new T.Vector3(x, y, z).applyMatrix4(M); };
      var calTop = view.cal.blocks.reduce(function (t, p) { return p && p[1] + 2 > t ? p[1] + 2 : t; }, plot.height);   // 日曆可能比地皮高很多：點得到整座塔
      var lastCal = null; view.cal.blocks.forEach(function (p) { if (p) lastCal = p; });
      farBoxes.push({ serial: h.serial, M: M, inv: new T.Matrix4().copy(M).invert(), lo: [plot.min, 0, plot.min], hi: [plot.max + 1, calTop, plot.max + 1], top: lastCal ? tv(lastCal[0] + CW / 2, lastCal[1] + CH / 2, ZF) : tv(0, 2, 0) });   // top：他這個月那塊（塔頭）
      [[plot.min, plot.min], [plot.max + 1, plot.min], [plot.max + 1, plot.max + 1], [plot.min, plot.min], [plot.max + 1, plot.max + 1], [plot.min, plot.max + 1]].forEach(function (c) { var q = tv(c[0], -0.005, c[1]); plotQ.pos.push(q.x, q.y, q.z); plotQ.nor.push(0, 1, 0); });
      view.look.blocks.forEach(function (b) {
        var t = typeOf(b[3]); if (t === 'door' || t === 'prop') return;
        var o = byKind[b[3]] = byKind[b[3]] || { pos: [], nor: [], col: [] }, base = new T.Color(CORE.BLOCKS[b[3]].hex);
        FACES.forEach(function (f) {
          if (f.n[1] === -1 && b[1] === 0) return; var nt = typeOf(vx.kindAt(b[0] + f.n[0], b[1] + f.n[1], b[2] + f.n[2])); if (nt === 'solid' || nt === 'lamp' || (t === 'glass' && nt === 'glass')) return;
          var sh = t === 'solid' ? (f.n[1] === 1 ? 1 : f.n[1] === -1 ? 0.7 : 0.9) : 1, n = new T.Vector3(f.n[0], f.n[1], f.n[2]).transformDirection(M);
          var q = f.c.map(function (c) { return tv(b[0] + c[0], b[1] + c[1], b[2] + c[2]); });
          [0, 1, 2, 0, 2, 3].forEach(function (j) { o.pos.push(q[j].x, q[j].y, q[j].z); o.nor.push(n.x, n.y, n.z); o.col.push(base.r * sh, base.g * sh, base.b * sh); }); faces++;
        });
      });
      view.cal.blocks.forEach(function (p) { if (!p) return; calM.push(new T.Matrix4().multiplyMatrices(M, new T.Matrix4().makeTranslation(p[0] + CW / 2, p[1] + CH / 2, CORE.CAL_Z + CD / 2))); var z = ZF + 0.004, n = new T.Vector3(0, 0, 1).transformDirection(M); [[p[0], p[1]], [p[0] + CW, p[1]], [p[0] + CW, p[1] + CH], [p[0], p[1]], [p[0] + CW, p[1] + CH], [p[0], p[1] + CH]].forEach(function (c) { var q = tv(c[0], c[1], z); faceQ.pos.push(q.x, q.y, q.z); faceQ.nor.push(n.x, n.y, n.z); }); });
      var d = view.look.door; doorM.push(new T.Matrix4().multiplyMatrices(M, new T.Matrix4().makeTranslation(d[0] + 0.5, d[1] + 1, d[2] + 0.5)));
    });
    var mk = function (o, mat, name, withCol) { if (!o.pos.length) return; var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(o.pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(o.nor, 3)); if (withCol) g.setAttribute('color', new T.Float32BufferAttribute(o.col, 3)); add(new T.Mesh(g, mat), name); };
    mk(plotQ, new T.MeshLambertMaterial({ color: '#B4C39A' }), 'farplot');
    Object.keys(byKind).forEach(function (k) { var t = typeOf(k); mk(byKind[k], t === 'glass' ? new T.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false, side: T.DoubleSide }) : new T.MeshLambertMaterial({ vertexColors: true }), 'far-' + k, true); });
    if (calM.length) { var cb = inst(new T.BoxGeometry(CW, CH, CD), new T.MeshLambertMaterial({ color: CAL_BODY }), calM.length, 'farcal'); calM.forEach(function (m, i) { cb.setMatrixAt(i, m); }); cb.instanceMatrix.needsUpdate = true; }
    mk(faceQ, new T.MeshLambertMaterial({ color: CAL_FACE }), 'farface');
    if (doorM.length) { var dr = inst(new T.BoxGeometry(1, 2, 1), new T.MeshLambertMaterial({ color: '#3B342C' }), doorM.length, 'fardoor'); doorM.forEach(function (m, i) { dr.setMatrixAt(i, m); }); dr.instanceMatrix.needsUpdate = true; }
    counts.farFaces = faces; counts.houses = houses.length + 1; tgt = was;
  }
  // 挑地：能放的地畫框（半透明的地加一圈線），點一塊就是選那一塊
  function buildSpots(list, sel) {
    var was = tgt; tgt = root; var half = CORE.PLOT_MAX / 2, q = { pos: [], nor: [] }, ln = [];
    if (sel) { var sq = add(new T.Mesh(new T.PlaneGeometry(CORE.PLOT_MAX, CORE.PLOT_MAX), new T.MeshBasicMaterial({ color: '#E8B53A', transparent: true, opacity: 0.55, depthWrite: false })), 'spotsel'); sq.rotation.x = -Math.PI / 2; sq.position.set(sel[0] * CELL, 0.05, sel[1] * CELL); counts.selSpot = sel.join(); }   // 先幫他選好的那一塊：塗黃
    list.forEach(function (p) { var cx = p[0] * CELL, cz = p[1] * CELL, c = [[cx - half, cz - half], [cx + half, cz - half], [cx + half, cz + half], [cx - half, cz + half]]; [0, 1, 2, 0, 2, 3].forEach(function (i) { q.pos.push(c[i][0], 0.03, c[i][1]); q.nor.push(0, 1, 0); }); for (var i = 0; i < 4; i++) { var a = c[i], b = c[(i + 1) % 4]; ln.push(a[0], 0.06, a[1], b[0], 0.06, b[1]); } });
    if (q.pos.length) { var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(q.pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(q.nor, 3)); add(new T.Mesh(g, new T.MeshBasicMaterial({ color: '#8FB3D9', transparent: true, opacity: 0.35, depthWrite: false })), 'spots'); var lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(ln, 3)); add(new T.LineSegments(lg, new T.LineBasicMaterial({ color: '#2D5A86' })), 'spotlines'); }
    counts.spots = list.length; tgt = was;
  }

  // view：CORE.viewHouse 的結果；opts.building：蓋的時候（鏡頭從高一點往下看、畫格線）；opts.village：CORE.viewVillage 的結果（整個村子）；opts.travel：從別間滑過來；opts.spots：挑地（能放的地）

  function show(view, opts) {
    if (!renderer) return;
    opts = opts || {}; var same = current && current.serial === view.serial;
    var vv = opts.village && opts.village.houses.length > 1 ? opts.village : null, me = vv ? vv.houses.find(function (h) { return h.serial === view.serial; }) : null;
    var key = JSON.stringify({ b: view.bricks, s: view.sign, a: view.age && view.age.text, c: view.closed, n: view.look.n, r: view.look.rev, d: view.look.door, p: view.plot.size, cal: view.cal.blocks, pv: view.cal.preview, vg: vv ? vv.houses.map(function (h) { return [h.serial, h.pos, h.rot, h.view.look.rev, h.view.look.n, h.view.cal.blocks.length]; }) : null, sp: opts.spots || null }) + '|' + !!opts.building;
    if (same && key === lastKey && !opts.resetCamera && !opts.travel) return;   // 什麼都沒變就不重蓋
    var startBuild = !!opts.building && !building, stopBuild = !opts.building && building, from = { target: cam.target.clone(), theta: cam.theta, phi: cam.phi, dist: cam.dist };
    lastKey = key; current = view; building = !!opts.building; village = vv; spots = opts.spots || null;
    clear();
    hgM = me ? houseMatrix(me.pos, me.rot) : new T.Matrix4(); hgInv = new T.Matrix4().copy(hgM).invert(); hg.matrix.copy(hgM); hg.matrixAutoUpdate = false; hg.rot = me ? me.rot : 0;
    buildGround(view.plot); buildCalendar(view); buildDoor(view); buildBlocks(view);
    if (vv) buildFar(vv.houses.filter(function (h) { return h.serial !== view.serial; })); else counts.houses = 1;
    if (spots) buildSpots(spots, opts.selSpot);
    root.updateMatrixWorld(true);   // 新蓋的東西馬上點得到，不用等下一次畫
    if (opts.travel) { var to = calPose(), TAU = Math.PI * 2; from.theta = ((from.theta % TAU) + TAU) % TAU; if (from.theta - to.theta > Math.PI) from.theta -= TAU; if (to.theta - from.theta > Math.PI) from.theta += TAU; anim = { from: from, to: to, t0: performance.now(), ms: 1000 }; }   // 點村裡另一間：畫面滑過去，停在那一間日曆那一面
    else if (spots) { anim = null; setPose(villagePose()); }
    else if (!same || opts.resetCamera || stopBuild) { anim = null; setPose(calPose()); }
    if (startBuild) { anim = null; setPose(buildPose()); }
    applyCam(); dirty = true; loop();
  }
  // 這個月那一塊日曆（最後一塊有位置的；沒有就是起點）
  function monthBlock() { var list = current.cal.blocks; for (var i = list.length - 1; i >= 0; i--) if (list[i]) return list[i]; return CORE.CAL_START; }
  function rotRad() { return (hg && hg.rot ? hg.rot : 0) * Math.PI / 180; }
  // 一打開：鏡頭對著這個月那一塊日曆的正面，旁邊看得到一點房子（村子裡照那一間的朝向）
  function calPose() { var p = monthBlock(); return { target: toWorld(new T.Vector3(p[0] + CW / 2, p[1] + CH / 2 - 0.1, ZF)), theta: rotRad(), phi: 1.38, dist: fitDist(3.0) }; }
  // 蓋的時候：從右前方高處往下看整塊地皮
  function buildPose() { var p = current.plot; return { target: toWorld(new T.Vector3(0, 1, 0)), theta: rotRad() + 0.55, phi: 0.6, dist: fitDist(p.size * 0.66) }; }
  // 看整個村子：從上面看，全部的屋（和能放的地）都在畫面裡
  function villagePose() {
    var pts = []; if (village) village.houses.forEach(function (h) { pts.push([h.pos[0] * CELL, h.pos[1] * CELL]); }); else pts.push([hgM.elements[12], hgM.elements[14]]);
    if (spots) spots.forEach(function (p) { pts.push([p[0] * CELL, p[1] * CELL]); });
    var xs = pts.map(function (p) { return p[0]; }), zs = pts.map(function (p) { return p[1]; }), cx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, cz = (Math.min.apply(null, zs) + Math.max.apply(null, zs)) / 2;
    var r = Math.max(Math.max.apply(null, xs) - Math.min.apply(null, xs), Math.max.apply(null, zs) - Math.min.apply(null, zs)) / 2 + CELL * 0.45;
    // 日曆比地皮高（補十七）：從這個月那塊的高度、接近水平看過去，全村的塔頭並排、這個月那塊在畫面中間附近（不是從上面把整座塔縮成細線）
    var mb = monthBlock(), tall = current && mb[1] + CH > current.plot.height;
    if (tall) return tallVillagePose(mb);
    return { target: new T.Vector3(cx, 0, cz), theta: rotRad(), phi: 0.42, dist: fitDist(r) };
  }
  // 日曆比地皮高時看村子（第 8 輪）：跟看屋差不多近，這個月那塊在前面、看得清楚；鏡頭順著「這一塊 → 最近那一間的塔頭」那條線往後退一點、偏一點，
  // 隔壁的塔頭就落在後面、同一個畫面裡（直放也放得下）；鏡頭盡量從日曆正面那一側看（先挑在背後或旁邊的鄰居）
  function tallVillagePose(mb) {
    var A = toWorld(new T.Vector3(mb[0] + CW / 2, mb[1] + CH / 2, ZF)), f = new T.Vector3(0, 0, 1).transformDirection(hgM).setY(0).normalize();
    var best = null, bs = Infinity;
    farBoxes.forEach(function (fb) { var d = new T.Vector3(fb.top.x - A.x, 0, fb.top.z - A.z), len = d.length(); if (len < 1e-6) return; var score = len * (1 + Math.max(0, d.clone().normalize().dot(f))); if (score < bs) { bs = score; best = fb; } });
    if (!best) return { target: A, theta: rotRad(), phi: 1.38, dist: fitDist(3.0) };
    var B = new T.Vector3(best.top.x, Math.min(best.top.y, A.y), best.top.z), dir = new T.Vector3(B.x - A.x, 0, B.z - A.z).normalize();
    var side = new T.Vector3(dir.z, 0, -dir.x); if (side.dot(f) < 0) side.negate();
    // 這個畫面（扣掉上下兩條列）實際看得到多寬、多高的角度：直放時橫的很窄
    var fullH = vh + Math.abs(insets.t - insets.b), band = Math.max(80, vh - insets.t - insets.b), tv = Math.tan(camera.fov * Math.PI / 360);
    var halfH = Math.atan(tv * vw / fullH) * 0.8, halfV = Math.atan(tv * band / fullH) * 0.8, base = Math.max(12, fitDist(3.0) * 1.15), pick = null;
    var A2 = A.clone(); A2.y -= 0.8;   // 這個月那塊往下一點當基準：上面還有預告框
    // 先試從日曆正面那一側斜看（看得到正面），放不下就慢慢轉到順著那條線、再退遠一點，直到這一塊和隔壁的塔頭都在畫面裡
    [0.45, 0.3, 0.15, 0].some(function (fa) { return [1, 1.4, 1.8].some(function (k) {
      var w = dir.clone().negate().addScaledVector(f, fa).addScaledVector(side, 0.22).normalize(), P = A2.clone().addScaledVector(w, base * k); P.y += 1.2;
      var ua = A2.clone().sub(P).normalize(), ub = B.clone().sub(P).normalize(), mid = ua.clone().add(ub).normalize();
      var yaw = function (u) { return Math.atan2(u.x, u.z); }, dy = Math.abs(((yaw(ua) - yaw(ub) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI), dp = Math.abs(Math.asin(ua.y) - Math.asin(ub.y));
      if (dy / 2 <= halfH && dp / 2 <= halfV) { pick = { P: P, mid: mid, d: A2.distanceTo(P) }; return true; } return false; }); });
    if (!pick) { var w0 = dir.clone().negate().addScaledVector(side, 0.22).normalize(), P0 = A2.clone().addScaledVector(w0, base * 2.2); pick = { P: P0, mid: A2.clone().lerp(B, 0.5).sub(P0).normalize(), d: A2.distanceTo(P0) }; }
    var Tg = pick.P.clone().addScaledVector(pick.mid, pick.d), v = pick.P.clone().sub(Tg), dist = v.length();
    return { target: Tg, theta: Math.atan2(v.x, v.z), phi: Math.acos(Math.max(-1, Math.min(1, v.y / dist))), dist: dist, neighbor: best.serial };
  }
  function setPose(p) { cam.target.copy(p.target); cam.theta = p.theta; cam.phi = p.phi; cam.dist = p.dist; }
  // 鏡頭滑到某個位置（走角度短的那一邊）
  function animTo(to, ms) { var from = { target: cam.target.clone(), theta: cam.theta, phi: cam.phi, dist: cam.dist }, TAU = Math.PI * 2; from.theta = ((from.theta % TAU) + TAU) % TAU; if (from.theta - to.theta > Math.PI) from.theta -= TAU; if (to.theta - from.theta > Math.PI) from.theta += TAU; anim = { from: from, to: to, t0: performance.now(), ms: ms || 700 }; dirty = true; loop(); }
  // 「看日曆」：鏡頭繞回一打開時的位置，大約 0.7 秒看得到轉的過程
  function lookCalendar() { if (current) animTo(calPose(), 700); }
  // 「看村子」：拉遠從上面看整個村子
  function lookVillage() { if (current) animTo(villagePose(), 900); }
  function stepAnim(now) {
    if (!anim) return false;
    var k = Math.min(1, (now - anim.t0) / anim.ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    cam.target.lerpVectors(anim.from.target, anim.to.target, e); cam.theta = anim.from.theta + (anim.to.theta - anim.from.theta) * e; cam.phi = anim.from.phi + (anim.to.phi - anim.from.phi) * e; cam.dist = anim.from.dist + (anim.to.dist - anim.from.dist) * e;
    if (k >= 1) anim = null;
    applyCam(); return true;
  }
  // 那一天的磚：鏡頭靠近，加一個框標出來
  function focusDay(day) {
    if (!current) return false;
    var b = current.bricks.find(function (x) { return x.day === day; }); if (!b || !b.g || !b.onHouse) return false;
    var pos = b.g.m < current.cal.blocks.length ? current.cal.blocks[b.g.m] : current.cal.preview.pos, p = brickPos(pos, b.g);
    var box = add(new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(BS + 0.08, BS + 0.08, BD + 0.06)), new T.LineBasicMaterial({ color: '#E0402B' })), 'focus');
    box.position.set(p.x, p.y, p.z); focus = day; anim = null; root.updateMatrixWorld(true);
    var fov = camera.fov * Math.PI / 180, band = Math.max(80, vh - insets.t - insets.b), fullH = vh + Math.abs(insets.t - insets.b), worldBand = 2 * 2.6 * Math.tan(fov / 2) * band / fullH;   // 可用的那一段畫面在磚那裡有幾個世界單位高
    cam.target.copy(toWorld(new T.Vector3(p.x, p.y - Math.min(0.42, worldBand * 0.15), p.z))); cam.theta = rotRad(); cam.phi = 1.5; cam.dist = 2.6; applyCam(); loop(); return true;   // 鏡頭往下挪一點：磚在那一段的上半，下面留給說明
  }

  /* ---------- 鏡頭 ---------- */
  // 只用上下兩條列之間的空間擺：視角往下（或往上）挪，距離照這一段的高度算
  var insets = { t: 0, b: 0 }, vw = 1, vh = 1;
  function setInsets(t, b) { t = Math.max(0, Math.round(t) || 0); b = Math.max(0, Math.round(b) || 0); if (t === insets.t && b === insets.b) return; insets = { t: t, b: b }; resize(); }
  function fitDist(r) { var fov = camera.fov * Math.PI / 180, fullH = vh + Math.abs(insets.t - insets.b), band = Math.max(80, vh - insets.t - insets.b), tv = Math.tan(fov / 2) * band / fullH, th = Math.tan(fov / 2) * vw / fullH; return r / Math.sin(Math.atan(Math.min(tv, th))) * 1.02; }
  function applyCam() {
    var c = cam; c.phi = Math.max(0.15, Math.min(1.53, c.phi)); c.dist = Math.max(c.minD, Math.min(c.maxD, c.dist));
    camera.position.set(c.target.x + c.dist * Math.sin(c.phi) * Math.sin(c.theta), c.target.y + c.dist * Math.cos(c.phi), c.target.z + c.dist * Math.sin(c.phi) * Math.cos(c.theta));
    camera.lookAt(c.target); camera.updateMatrixWorld(); dirty = true;
  }
  function loop() { if (raf || paused) return; raf = requestAnimationFrame(function (now) { raf = 0; var more = stepAnim(now); if (dirty && renderer && !paused) { renderer.render(scene, camera); lastCalls = renderer.info.render.calls; dirty = false; } if (more) loop(); }); }
  function resize() { if (!renderer || !container) return; var w = container.clientWidth || window.innerWidth, h = container.clientHeight || window.innerHeight; renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px'; vw = w; vh = h; var d = insets.t - insets.b, fullH = h + Math.abs(d); camera.aspect = w / Math.max(1, fullH); camera.setViewOffset(w, fullH, 0, d > 0 ? 0 : -d, w, h); camera.updateProjectionMatrix(); dirty = true; loop(); }

  /* ---------- 手勢：一指轉、兩指縮放、滾輪縮放；點一下才算點 ---------- */
  function bindInput(el) {
    var pts = new Map(), start = null, moved = false, pinch = null;
    el.addEventListener('pointerdown', function (e) { anim = null; if (e.isPrimary) { pts.clear(); pinch = null; } el.setPointerCapture && el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, t: Date.now() }; moved = false; } else { moved = true; pinch = null; } });
    el.addEventListener('pointermove', function (e) {
      if (!pts.has(e.pointerId)) return; var prev = pts.get(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { var dx = e.clientX - prev.x, dy = e.clientY - prev.y; if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) moved = true; if (moved) { cam.theta -= dx * 0.008; cam.phi -= dy * 0.006; applyCam(); loop(); } }
      else if (pts.size >= 2) { var a = Array.from(pts.values()), d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); if (pinch) { cam.dist *= pinch / Math.max(1, d); applyCam(); loop(); } pinch = d; }
    });
    var up = function (e) {
      var single = pts.size === 1 && pts.has(e.pointerId); pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
      if (single && start && !moved && Date.now() - start.t < 700 && e.type === 'pointerup') tap(e.clientX, e.clientY);
      if (!pts.size) start = null;
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', function (e) { e.preventDefault(); anim = null; cam.dist *= Math.pow(1.0015, e.deltaY); applyCam(); loop(); }, { passive: false });
  }

  /* ---------- 點到什麼：磚和門板用三角形找；方塊、門、日曆一格一格找；都沒打到就看地上哪一格 ---------- */
  var ray = new T.Raycaster(), ndc = new T.Vector2();
  // 手指點的不會剛好準：先點那一點，沒打到再試旁邊幾個點（也避開剛好落在三角形邊上的時候）
  var NEAR = [[0, 0], [0.37, 0.21], [-0.33, 0.29], [0.3, -0.4], [-0.25, -0.35], [3, 0], [-3, 0], [0, 3], [0, -3], [6, 0], [-6, 0], [0, 6], [0, -6]];
  function hitAt(x, y) { for (var i = 0; i < NEAR.length; i++) { var h = hitOne(x + NEAR[i][0], y + NEAR[i][1]); if (h && h.kind !== 'ground') return h; if (h && i === 0) return h; } return null; }
  function hitOne(x, y) {
    if (!renderer || !current) return null;
    var r = renderer.domElement.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    var best = null;
    var hits = ray.intersectObjects(picks, false);
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i], o = h.object, out = null;
      if (o.name === 'door') { var dd = current.look.door; out = { kind: 'door', x: dd[0], y: dd[1], z: dd[2], rot: dd[4] || 0 }; }
      else if (o.userData.days && h.instanceId != null) out = { kind: 'brick', day: o.userData.days[h.instanceId], mesh: o.name };
      if (out) { out.dist = h.distance; best = out; break; }
    }
    var lo = ray.ray.origin.clone().applyMatrix4(hgInv), ld = ray.ray.direction.clone().transformDirection(hgInv);   // 看的那一間的格子用它自己的座標找
    var v = voxelHit(lo, ld);
    if (v && (!best || v.dist < best.dist)) best = v;
    // 挑地：點到能放的地
    if (spots) { var o3 = ray.ray.origin, d3 = ray.ray.direction; if (d3.y < -1e-6) { var t3 = -o3.y / d3.y, wx = o3.x + d3.x * t3, wz = o3.z + d3.z * t3, gx = Math.round(wx / CELL), gz = Math.round(wz / CELL); if (Math.abs(wx - gx * CELL) <= CORE.PLOT_MAX / 2 && Math.abs(wz - gz * CELL) <= CORE.PLOT_MAX / 2 && spots.some(function (p) { return p[0] === gx && p[1] === gz; }) && (!best || t3 < best.dist)) best = { kind: 'spot', pos: [gx, gz], dist: t3 }; } }
    // 村裡其他間：用整塊地皮的外框找
    farBoxes.forEach(function (fb) { var fo = ray.ray.origin.clone().applyMatrix4(fb.inv), fd = ray.ray.direction.clone().transformDirection(fb.inv), t = boxHit(fo, fd, fb.lo, fb.hi); if (t != null && (!best || t < best.dist)) best = { kind: 'house', serial: fb.serial, dist: t }; });
    if (!best) {   // 地上：地皮裡外都回傳是哪一格，畫面再決定能不能蓋
      if (ld.y < -1e-6) { var t = -lo.y / ld.y, px = lo.x + ld.x * t, pz = lo.z + ld.z * t; best = { kind: 'ground', x: Math.floor(px), y: 0, z: Math.floor(pz), dist: t }; }
    }
    return best;
  }
  function boxHit(o, d, lo, hi) {
    var O = [o.x, o.y, o.z], D = [d.x, d.y, d.z], t0 = 0, t1 = 1e9;
    for (var a = 0; a < 3; a++) { if (Math.abs(D[a]) < 1e-12) { if (O[a] < lo[a] || O[a] > hi[a]) return null; continue; } var ta = (lo[a] - O[a]) / D[a], tb = (hi[a] - O[a]) / D[a]; if (ta > tb) { var sw = ta; ta = tb; tb = sw; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; }
    return t0 > t1 ? null : t0;
  }
  function voxelHit(o, d) {
    if (!vox) return null;
    var p = vox.plot, lo = [p.min, 0, p.min], hi = [p.max + 1, p.height, p.max + 1], O = [o.x, o.y, o.z], D = [d.x, d.y, d.z];
    var t0 = 0, t1 = 1e9, axis0 = -1;
    for (var a = 0; a < 3; a++) {
      if (Math.abs(D[a]) < 1e-12) { if (O[a] < lo[a] || O[a] > hi[a]) return null; continue; }
      var ta = (lo[a] - O[a]) / D[a], tb = (hi[a] - O[a]) / D[a]; if (ta > tb) { var s = ta; ta = tb; tb = s; }
      if (ta > t0) { t0 = ta; axis0 = a; } if (tb < t1) t1 = tb;
    }
    if (t0 > t1) return null;
    var t = t0 + 1e-7, c = [0, 1, 2].map(function (a) { return Math.min(hi[a] - 1, Math.max(lo[a], Math.floor(O[a] + D[a] * t))); });
    var step = D.map(function (v) { return v > 0 ? 1 : -1; }), tMax = [0, 1, 2].map(function (a) { return Math.abs(D[a]) < 1e-12 ? 1e18 : (c[a] + (step[a] > 0 ? 1 : 0) - O[a]) / D[a]; }), tDel = D.map(function (v) { return Math.abs(v) < 1e-12 ? 1e18 : Math.abs(1 / v); });
    var n = [0, 0, 0]; if (axis0 >= 0) n[axis0] = -step[axis0];
    for (var guard = 0; guard < 400; guard++) {
      var k = vox.kindAt(c[0], c[1], c[2]);
      if (k === 'door') { var dr = vox.doorAt[vox.idx(c[0], c[1], c[2])]; return { kind: 'door', x: dr[0], y: dr[1], z: dr[2], rot: dr[4] || 0, n: n.slice(), dist: t }; }
      if (k === 'cal') return { kind: 'cal', x: c[0], y: c[1], z: c[2], n: n.slice(), dist: t };
      if (k) return { kind: 'block', x: c[0], y: c[1], z: c[2], k: k, prop: typeOf(k) === 'prop', n: n.slice(), dist: t };
      var m = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : (tMax[1] < tMax[2] ? 1 : 2);
      t = tMax[m]; if (t > t1) return null;
      c[m] += step[m]; tMax[m] += tDel[m]; n = [0, 0, 0]; n[m] = -step[m];
      if (c[m] < lo[m] || c[m] >= hi[m]) return null;
    }
    return null;
  }
  function tap(x, y) { var hit = hitAt(x, y); if (onTap) onTap(hit); }

  /* ---------- 給畫面和測試用 ---------- */
  // 某個東西在畫面上的位置：'door'、{day}、{cal:[x,y]}（那塊日曆正面的中心）、{preview:true}、{block:[x,y,z], n:[0,1,0]}（那一面的中心）、{ground:[x,z]}
  function screenOf(target) {
    if (!renderer || !current) return null;
    var p = null;
    if (target === 'door') { var dd = current.look.door, f = CORE.doorFront(dd[4] || 0); p = new T.Vector3(dd[0] + 0.5 + f[0] * 0.55 - f[1] * 0.15, dd[1] + 0.9, dd[2] + 0.5 + f[1] * 0.55 + f[0] * 0.15); }
    else if (target.day != null) { var b = current.bricks.find(function (x) { return x.day === target.day; }); if (!b || !b.g || !b.onHouse) return null; var pos = b.g.m < current.cal.blocks.length ? current.cal.blocks[b.g.m] : current.cal.preview.pos, q = brickPos(pos, b.g); p = new T.Vector3(q.x, q.y, q.z + BD / 2); }
    else if (target.cal) p = new T.Vector3(target.cal[0] + CW / 2, target.cal[1] + CH / 2, ZF);
    else if (target.preview) { if (!current.cal.preview) return null; var pv = current.cal.preview.pos; p = new T.Vector3(pv[0] + CW / 2, pv[1] + CH / 2, ZF); }
    else if (target.block) { var bl = target.block, n = target.n || [0, 1, 0]; p = new T.Vector3(bl[0] + 0.5 + n[0] * 0.5, bl[1] + 0.5 + n[1] * 0.5, bl[2] + 0.5 + n[2] * 0.5); if (target.prop) p.set(bl[0] + 0.5, bl[1] + 0.3, bl[2] + 0.5); }
    else if (target.ground) p = new T.Vector3(target.ground[0] + 0.5, 0, target.ground[1] + 0.5);
    else if (target.house) { var fb = farBoxes.find(function (x) { return x.serial === target.house; }); if (!fb) return null; p = fb.top.y > 6 && cam.target.y > 6 ? new T.Vector3(fb.top.x, Math.min(fb.top.y, cam.target.y), fb.top.z) : new T.Vector3((fb.lo[0] + fb.hi[0]) / 2, 2, (fb.lo[2] + fb.hi[2]) / 2).applyMatrix4(fb.M); p.isWorld = true; }
    else if (target.spot) { p = new T.Vector3(target.spot[0] * CELL, 0, target.spot[1] * CELL); p.isWorld = true; }
    else if (target.point) { p = target.point.clone(); p.isWorld = true; }
    if (!p) return null;
    if (!p.isWorld) p = toWorld(p);
    p.project(camera); var r = renderer.domElement.getBoundingClientRect();
    if (p.z > 1) return null;
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
  }
  function renderNow() { if (renderer) { if (anim) { anim.t0 = -1e9; stepAnim(performance.now()); } renderer.render(scene, camera); lastCalls = renderer.info.render.calls; dirty = false; } }
  api = {
    available: true, atlasSize: atlasSize, texSize: function () { return lastAtlas; }, init: init, show: show, resize: resize, setInsets: setInsets, hitAt: hitAt, screenOf: screenOf, focusDay: focusDay, lookCalendar: lookCalendar, lookVillage: lookVillage,
    onTap: function (fn) { onTap = fn; },
    pause: function () { paused = true; if (raf) { cancelAnimationFrame(raf); raf = 0; } }, resume: function () { paused = false; dirty = true; loop(); },
    info: function () { var c = (counts.unlit || 0) + (counts.litgray || 0) + (counts.dark || 0) + (counts.lit || 0) + (counts.cover || 0) + (counts.future || 0); return { calls: lastCalls, bricks: c, lit: counts.litAll || 0, colored: counts.colored || 0, litColored: counts.lit || 0, litGray: counts.litgray || 0, dark: counts.dark || 0, cover: counts.cover || 0, future: counts.future || 0, marks: counts.mark || 0, cal: counts.cal || 0, blocks: counts.blocks || 0, faces: counts.faces || 0, props: counts.props || 0, theta: cam.theta, phi: cam.phi, dist: cam.dist, target: cam.target.toArray(), meshes: root ? root.children.length - 1 + (hg ? hg.children.length : 0) : 0, serial: current ? current.serial : null, building: building, focus: focus, animating: !!anim, previewThrough: !!counts.previewThrough, houses: counts.houses || 0, farFaces: counts.farFaces || 0, spots: counts.spots || 0, selSpot: counts.selSpot || null, rot: hg ? hg.rot || 0 : 0 }; },
    calPose: function () { return current ? calPose() : null; },
    villagePose: function () { if (!current) return null; var p = villagePose(); return { target: p.target.toArray(), theta: p.theta, phi: p.phi, dist: p.dist, neighbor: p.neighbor || null }; },
    // 畫面上看到的這個月那塊有多大（像素，高和寬）
    calScreenSize: function (pos) { if (!current) return null; var c = [[0, 0], [CW, 0], [0, CH], [CW, CH]].map(function (o) { return screenOf({ point: toWorld(new T.Vector3(pos[0] + o[0], pos[1] + o[1], ZF)) }); }); if (c.some(function (x) { return !x; })) return null; var xs = c.map(function (q) { return q.x; }), ys = c.map(function (q) { return q.y; }); return { w: Math.max.apply(null, xs) - Math.min.apply(null, xs), h: Math.max.apply(null, ys) - Math.min.apply(null, ys) }; },
    setCamera: function (p) { anim = null; if (p.target) cam.target.set(p.target[0], p.target[1], p.target[2]); if (p.theta != null) cam.theta = p.theta; if (p.phi != null) cam.phi = p.phi; if (p.dist != null) cam.dist = p.dist; applyCam(); loop(); },
    renderNow: renderNow, camera: function () { return cam; }, needsRender: function () { return dirty; }
  };
  // 試著建一個 WebGL 環境：瀏覽器不支援就當作 3D 用不了
  try { var test = document.createElement('canvas'); api.available = !!(test.getContext('webgl') || test.getContext('experimental-webgl')); } catch (e) { api.available = false; }
  if (!api.available) return stub();
  return api;
})();
