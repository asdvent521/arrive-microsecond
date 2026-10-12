/* ===== v9 達秒屋（3D）：只畫 CORE.viewHouse 回傳的資料 =====
 * 兩部分：大門（大家都一樣，照紀錄畫：門牆排法跟日曆一樣，一格一個月、一天一塊磚、一排一週，一年一層）和自己蓋的方塊。
 * 同一種東西一次畫完：門牆的磚用 InstancedMesh；方塊同一種合成一個網格，被別的方塊擋住的面不畫。沒在動就不重畫。
 * 一指拖著轉、兩指縮放、滾輪縮放；點一下（沒拖動）才算點。點方塊用格子一格一格找（不用逐個三角形比），地皮塞滿也快。
 * 只用資料畫：方塊種類是清單裡的字，畫面由這裡的程式畫。不讀紀錄、不改資料。
 */
var WORLD = (function () {
  'use strict';
  var T = typeof THREE !== 'undefined' ? THREE : null;
  var api = { available: false };
  if (!T) return stub();
  var renderer, scene, camera, root, container, picks = [], dirty = true, raf = 0, paused = false, onTap = null, lastKey = '';
  var cam = { theta: 0, phi: 1.3, dist: 20, target: new T.Vector3(0, 2, 0), minD: 1.2, maxD: 400 };
  var current = null, building = false, lastCalls = 0, gate = null, vox = null, counts = {}, focus = null;
  function stub() { return { available: false, init: function () { return false; }, show: function () {}, onTap: function () {}, info: function () { return { calls: 0, bricks: 0 }; }, screenOf: function () { return null; }, hitAt: function () { return null; }, focusDay: function () {}, pause: function () {}, resume: function () {}, resize: function () {}, setInsets: function () {}, camera: function () { return null; } }; }

  /* ---------- 大門的尺寸（單位：一格方塊＝1） ---------- */
  var P = 0.21, BS = 0.18, BD = 0.08;                // 一塊磚的間距、大小、厚度
  var MW = 7 * P, MH6 = 6 * P, LBL = 0.24, MG = 0.12; // 一個月：七欄、最多六排；上面一條寫月份
  var MH = MH6 + LBL, LH = 2 * MH + 0.1, BASE = 0.3;  // 一層：兩排月份（門的兩邊各 3×2 格＝12 個月）
  var SIDE_W = 3 * MW + 2 * MG, SIDE_X0 = -6 + 0.15;  // 門左邊從 -5.85 開始，右邊對稱
  var DOOR_W = 1.5, DOOR_H = 2.3;
  function gateGeom(plot, layers) { var zf = plot.gateZ + 0.9; return { zf: zf, z0: plot.gateZ + 0.35, h: BASE + layers * LH + 0.35, layers: layers }; }
  // 第 k 個月（0～11）在門牆上的左上角：前 6 個月在門左邊（上排 1～3、下排 4～6），後 6 個月在右邊
  function monthOrigin(layer, k) {
    var right = k >= 6, kk = k % 6, mrow = Math.floor(kk / 3), mcol = kk % 3;
    var x0 = (right ? 1.2 : SIDE_X0) + mcol * (MW + MG), top = BASE + (layer + 1) * LH - 0.05 - mrow * MH;
    return { x: x0, top: top, labelY: top - LBL / 2, gridTop: top - LBL };
  }
  function brickPos(g, zf) { var o = monthOrigin(g.layer, g.month); return { x: o.x + g.col * P + P / 2, y: o.gridTop - g.row * P - P / 2, z: zf + BD / 2 }; }

  /* ---------- 材質、貼圖 ---------- */
  var GATE_BODY = '#5E564C', GATE_FACE = '#6C6357', DAY_EMPTY = '#7B7266', BRICK = '#CDBB9E';
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
  // 門牆一邊的底圖：每個月一格，格子裡畫出那個月每一天的空位（像日曆），上面寫月份；每一層第一個月和一月寫年份
  function sideTexture(view, right) {
    var layers = view.layers, ppu = Math.max(40, Math.min(128, Math.floor(4096 / (layers * LH)))), H = layers * LH;
    var c = document.createElement('canvas'); c.width = Math.ceil(SIDE_W * ppu); c.height = Math.ceil(H * ppu); var g = c.getContext('2d');
    g.fillStyle = GATE_FACE; g.fillRect(0, 0, c.width, c.height);
    var X = function (x) { return (x - (right ? 1.2 : SIDE_X0)) * ppu; }, Y = function (y) { return (BASE + H - y) * ppu; };
    g.textBaseline = 'middle';
    for (var L = 0; L < layers; L++) for (var kk = 0; kk < 6; kk++) {
      var k = kk + (right ? 6 : 0), o = monthOrigin(L, k), ym = view.gateMonths[L * 12 + k]; if (!ym) continue;
      var first = new Date(Date.UTC(ym.y, ym.m - 1, 1)).getUTCDay(), days = new Date(Date.UTC(ym.y, ym.m, 0)).getUTCDate();
      g.fillStyle = DAY_EMPTY;
      for (var d = 0; d < days; d++) { var row = Math.floor((first + d) / 7), col = (first + d) % 7; g.fillRect(X(o.x + col * P + (P - BS) / 2), Y(o.gridTop - row * P - (P - BS) / 2), BS * ppu, BS * ppu); }
      g.fillStyle = '#EDE4CC'; g.font = '600 ' + Math.round(LBL * ppu * 0.72) + 'px ' + FONT;
      g.fillText((kk === 0 && !right) || ym.m === 1 ? ym.y + ' 年 ' + ym.m + ' 月' : ym.m + ' 月', X(o.x) + 2, Y(o.labelY));
    }
    var tex = new T.CanvasTexture(c); tex.anisotropy = 4; return tex;
  }
  function litColor(level) { return new T.Color(level >= 3 ? '#FFF4B8' : level === 2 ? '#FFD54F' : '#F2A93B'); }

  /* ---------- 建場景 ---------- */
  function init(el) {
    container = el;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' }); } catch (e) { api.available = false; return false; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0xDCE6EE);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none'; renderer.domElement.style.display = 'block';
    scene = new T.Scene(); scene.fog = new T.Fog(0xDCE6EE, 70, 260);
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
    picks = []; counts = {}; focus = null;
  }
  function add(o, name) { o.name = name; root.add(o); return o; }
  function inst(geo, mat, n, name) { var m = new T.InstancedMesh(geo, mat, Math.max(1, n)); m.count = n; m.frustumCulled = false; return add(m, name); }
  var M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), SV = new T.Vector3(1, 1, 1), E = new T.Euler();
  function setM(mesh, i, p, ry, s) { E.set(0, ry || 0, 0); Q.setFromEuler(E); V.set(p.x, p.y, p.z); SV.set(s || 1, s || 1, s || 1); M4.compose(V, Q, SV); mesh.setMatrixAt(i, M4); }

  /* ---------- 大門 ---------- */
  function buildGate(view) {
    var plot = view.plot, G = gateGeom(plot, view.layers), zf = G.zf, closed = view.closed;
    gate = G;
    var body = add(new T.Mesh(new T.BoxGeometry(12, G.h, zf - G.z0), new T.MeshLambertMaterial({ color: GATE_BODY })), 'gate');
    body.position.set(0, G.h / 2, (zf + G.z0) / 2); picks.push(body);
    var cap = add(new T.Mesh(new T.BoxGeometry(12.4, 0.2, zf - G.z0 + 0.3), new T.MeshLambertMaterial({ color: '#4A433B' })), 'gatecap'); cap.position.set(0, G.h + 0.1, (zf + G.z0) / 2);
    [false, true].forEach(function (right) {
      var w = SIDE_W, h = view.layers * LH, face = add(new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshLambertMaterial({ map: sideTexture(view, right) })), right ? 'faceR' : 'faceL');
      face.position.set((right ? 1.2 : SIDE_X0) + w / 2, BASE + h / 2, zf + 0.003);
    });
    var door = add(new T.Mesh(new T.BoxGeometry(DOOR_W, DOOR_H, 0.12), new T.MeshLambertMaterial({ color: '#7A5536' })), 'door'); door.position.set(0, DOOR_H / 2, zf + 0.06); picks.push(door);
    var frame = add(new T.Mesh(new T.BoxGeometry(DOOR_W + 0.24, DOOR_H + 0.12, 0.06), new T.MeshLambertMaterial({ color: '#3B342C' })), 'doorframe'); frame.position.set(0, (DOOR_H + 0.12) / 2, zf + 0.02);
    var knob = add(new T.Mesh(new T.SphereGeometry(0.06, 8, 6), new T.MeshBasicMaterial({ color: '#E8C35A' })), 'knob'); knob.position.set(0.5, 1.1, zf + 0.15);
    var lines = closed ? ['只給鄰居看'] : [view.age ? view.age.text : '', view.sign ? '「' + view.sign + '」' : ''].filter(Boolean);
    var sign = add(new T.Mesh(new T.PlaneGeometry(2.2, 0.69), new T.MeshBasicMaterial({ map: signTexture(lines, closed ? '#3B4652' : '#F4EBD3', closed ? '#FFFFFF' : '#3B342C') })), 'sign');
    sign.position.set(0, DOOR_H + 0.5, zf + 0.01);
    // 磚：沒亮、亮、蓋布、虛線（未來的預約），加上小記號
    var unlit = [], lit = [], cover = [], fut = [], mark = [];
    view.bricks.forEach(function (b) {
      if (!b.g) return;
      if (closed) unlit.push(b); else if (b.future) fut.push(b); else if (b.lit) lit.push(b); else if (b.cover) cover.push(b); else unlit.push(b);
      if (!closed && b.mark && !b.future) mark.push(b);
    });
    var geo = new T.BoxGeometry(BS, BS, BD);
    var put = function (list, mat, name, colorFn) {
      var m = inst(geo.clone(), mat, list.length, name);
      list.forEach(function (b, i) { setM(m, i, brickPos(b.g, zf)); if (colorFn) m.setColorAt(i, colorFn(b)); });
      m.instanceMatrix.needsUpdate = true; if (colorFn && m.instanceColor) m.instanceColor.needsUpdate = true;
      m.userData.days = list.map(function (b) { return b.day; }); picks.push(m); counts[name] = list.length; return m;
    };
    put(unlit, new T.MeshLambertMaterial({ color: closed ? '#A99C88' : BRICK }), 'unlit');
    put(lit, new T.MeshBasicMaterial({ color: 0xffffff }), 'lit', function (b) { return litColor(b.lit); });
    put(cover, new T.MeshLambertMaterial({ map: cloth() }), 'cover');
    put(fut, new T.MeshBasicMaterial({ map: dashed(), transparent: true, opacity: 0.95, depthWrite: false }), 'future');
    var mk = inst(new T.BoxGeometry(BS * 0.36, BS * 0.36, 0.02), new T.MeshBasicMaterial({ color: '#2B2520' }), mark.length, 'mark');
    mark.forEach(function (b, i) { var p = brickPos(b.g, zf); setM(mk, i, { x: p.x, y: p.y, z: p.z + BD / 2 + 0.011 }); }); mk.instanceMatrix.needsUpdate = true; counts.mark = mark.length;
  }

  /* ---------- 自己蓋的方塊：同一種合成一個網格，被擋住的面不畫 ---------- */
  var FACES = [ // 法線、四個角
    { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
    { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] }, { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }
  ];
  var KIND_IDS = null;
  function kindIds() { if (KIND_IDS) return KIND_IDS; KIND_IDS = { list: [null] , id: {} }; Object.keys(CORE.BLOCKS).forEach(function (k) { KIND_IDS.id[k] = KIND_IDS.list.length; KIND_IDS.list.push(k); }); return KIND_IDS; }
  function makeVox(plot, blocks) {
    var S = plot.size, H = plot.height, grid = new Uint8Array(S * H * S), rot = {}, K = kindIds();
    var idx = function (x, y, z) { if (x < plot.min || x > plot.max || z < plot.min || z > plot.max || y < 0 || y >= H) return -1; return ((x - plot.min) * H + y) * S + (z - plot.min); };
    blocks.forEach(function (b) { var i = idx(b[0], b[1], b[2]); if (i >= 0) { grid[i] = K.id[b[3]] || 0; if (b.length > 4) rot[i] = b[4]; } });
    return { plot: plot, grid: grid, idx: idx, rot: rot, kindAt: function (x, y, z) { var i = idx(x, y, z); return i < 0 ? null : K.list[grid[i]]; } };
  }
  function typeOf(k) { return k ? CORE.BLOCKS[k].type : null; }
  function buildBlocks(view) {
    var plot = view.plot, blocks = view.look.blocks, K = kindIds();
    vox = makeVox(plot, blocks);
    var byKind = {}, propList = {};
    blocks.forEach(function (b) { var t = typeOf(b[3]); if (t === 'prop') (propList[b[3]] = propList[b[3]] || []).push(b); else (byKind[b[3]] = byKind[b[3]] || []).push(b); });
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
    counts.faces = faces; counts.blocks = blocks.length;
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
    var S = plot.size, gr = add(new T.Mesh(new T.PlaneGeometry(S + 600, S + 600), new T.MeshLambertMaterial({ color: '#93A57F' })), 'ground');
    gr.rotation.x = -Math.PI / 2; gr.position.y = -0.02;
    var lot = add(new T.Mesh(new T.PlaneGeometry(S, S), new T.MeshLambertMaterial({ color: '#B4C39A' })), 'plot'); lot.rotation.x = -Math.PI / 2; lot.position.set(0, -0.005, 0);
    if (building) {
      var pts = [], a = plot.min, b = plot.max + 1;
      for (var i = a; i <= b; i++) { pts.push(i, 0.01, a, i, 0.01, b, a, 0.01, i, b, 0.01, i); }
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
      add(new T.LineSegments(g, new T.LineBasicMaterial({ color: '#5E6E4B', transparent: true, opacity: 0.45 })), 'grid');
    }
  }

  // view：CORE.viewHouse 的結果；opts.building：蓋的時候（鏡頭從高一點往下看、畫格線）
  function show(view, opts) {
    if (!renderer) return;
    opts = opts || {}; var same = current && current.serial === view.serial;
    var key = JSON.stringify({ b: view.bricks, s: view.sign, a: view.age && view.age.text, c: view.closed, n: view.look.n, r: view.look.rev, p: view.plot.size, L: view.layers }) + '|' + !!opts.building;
    if (same && key === lastKey && !opts.resetCamera) return;   // 什麼都沒變就不重蓋
    var startBuild = !!opts.building && !building, stopBuild = !opts.building && building;
    lastKey = key; current = view; building = !!opts.building;
    clear();
    buildGround(view.plot); buildGate(view); buildBlocks(view);
    root.updateMatrixWorld(true);   // 新蓋的東西馬上點得到，不用等下一次畫
    if (!same || opts.resetCamera || stopBuild) frontView();
    if (startBuild) buildView();
    applyCam(); dirty = true; loop();
  }
  // 一打開：鏡頭對著大門
  function frontView() { var G = gate, r = Math.max(6.6, G.h / 2 + 0.4); cam.target.set(0, Math.min(G.h, 2 * r) / 2, G.zf); cam.theta = 0; cam.phi = 1.32; cam.dist = fitDist(r); }
  // 蓋的時候：從高一點往下看整塊地皮
  function buildView() { var p = current.plot; cam.target.set(0, 1, 0); cam.theta = 0.55; cam.phi = 0.6; cam.dist = fitDist(p.size * 0.66); }
  // 那一天的磚：鏡頭靠近，加一個框標出來
  function focusDay(day) {
    if (!current) return false;
    var b = current.bricks.find(function (x) { return x.day === day; }); if (!b || !b.g) return false;
    var p = brickPos(b.g, gate.zf);
    var box = add(new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(BS + 0.08, BS + 0.08, BD + 0.06)), new T.LineBasicMaterial({ color: '#E0402B' })), 'focus');
    box.position.set(p.x, p.y, p.z); focus = day;
    cam.target.set(p.x, p.y - 0.42, p.z); cam.theta = 0; cam.phi = 1.5; cam.dist = 2.6; applyCam(); loop(); return true;   // 鏡頭往下挪一點：磚在畫面上半，下面留給說明
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
  function loop() { if (raf || paused) return; raf = requestAnimationFrame(function () { raf = 0; if (dirty && renderer && !paused) { renderer.render(scene, camera); lastCalls = renderer.info.render.calls; dirty = false; } }); }
  function resize() { if (!renderer || !container) return; var w = container.clientWidth || window.innerWidth, h = container.clientHeight || window.innerHeight; renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px'; vw = w; vh = h; var d = insets.t - insets.b, fullH = h + Math.abs(d); camera.aspect = w / Math.max(1, fullH); camera.setViewOffset(w, fullH, 0, d > 0 ? 0 : -d, w, h); camera.updateProjectionMatrix(); dirty = true; loop(); }

  /* ---------- 手勢：一指轉、兩指縮放、滾輪縮放；點一下才算點 ---------- */
  function bindInput(el) {
    var pts = new Map(), start = null, moved = false, pinch = null;
    el.addEventListener('pointerdown', function (e) { if (e.isPrimary) { pts.clear(); pinch = null; } el.setPointerCapture && el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, t: Date.now() }; moved = false; } else { moved = true; pinch = null; } });
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
    el.addEventListener('wheel', function (e) { e.preventDefault(); cam.dist *= Math.pow(1.0015, e.deltaY); applyCam(); loop(); }, { passive: false });
  }

  /* ---------- 點到什麼：大門（門、磚、門牆）用三角形找；方塊一格一格找；都沒打到就看地上哪一格 ---------- */
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
      if (o.name === 'door') out = { kind: 'door' };
      else if (o.userData.days && h.instanceId != null) out = { kind: 'brick', day: o.userData.days[h.instanceId], mesh: o.name };
      else if (o.name === 'gate') out = { kind: 'gate' };
      if (out) { out.dist = h.distance; best = out; break; }
    }
    var v = voxelHit(ray.ray.origin, ray.ray.direction);
    if (v && (!best || v.dist < best.dist)) best = v;
    if (!best) {   // 地上：地皮裡外都回傳是哪一格，畫面再決定能不能蓋
      var o2 = ray.ray.origin, d = ray.ray.direction;
      if (d.y < -1e-6) { var t = -o2.y / d.y, px = o2.x + d.x * t, pz = o2.z + d.z * t; best = { kind: 'ground', x: Math.floor(px), y: 0, z: Math.floor(pz), dist: t }; }
    }
    return best;
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
  // 某個東西在畫面上的位置：'door'、'gate'、{day}、{block:[x,y,z], n:[0,1,0]}（那一面的中心）、{ground:[x,z]}
  function screenOf(target) {
    if (!renderer || !current || !gate) return null;
    var p = null;
    if (target === 'door') p = new T.Vector3(-0.3, 0.9, gate.zf + 0.13);
    else if (target === 'gate') p = new T.Vector3(0, Math.min(gate.h - 0.3, DOOR_H + 1.05), gate.zf);
    else if (target.day != null) { var b = current.bricks.find(function (x) { return x.day === target.day; }); if (!b || !b.g) return null; var q = brickPos(b.g, gate.zf); p = new T.Vector3(q.x, q.y, q.z + BD / 2); }
    else if (target.block) { var bl = target.block, n = target.n || [0, 1, 0]; p = new T.Vector3(bl[0] + 0.5 + n[0] * 0.5, bl[1] + 0.5 + n[1] * 0.5, bl[2] + 0.5 + n[2] * 0.5); if (target.prop) p.set(bl[0] + 0.5, bl[1] + 0.3, bl[2] + 0.5); }
    else if (target.ground) p = new T.Vector3(target.ground[0] + 0.5, 0, target.ground[1] + 0.5);
    if (!p) return null;
    p.project(camera); var r = renderer.domElement.getBoundingClientRect();
    if (p.z > 1) return null;
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
  }
  function renderNow() { if (renderer) { renderer.render(scene, camera); lastCalls = renderer.info.render.calls; dirty = false; } }
  api = {
    available: true, init: init, show: show, resize: resize, setInsets: setInsets, hitAt: hitAt, screenOf: screenOf, focusDay: focusDay,
    onTap: function (fn) { onTap = fn; },
    pause: function () { paused = true; if (raf) { cancelAnimationFrame(raf); raf = 0; } }, resume: function () { paused = false; dirty = true; loop(); },
    info: function () { var c = (counts.unlit || 0) + (counts.lit || 0) + (counts.cover || 0) + (counts.future || 0); return { calls: lastCalls, bricks: c, lit: counts.lit || 0, cover: counts.cover || 0, future: counts.future || 0, marks: counts.mark || 0, blocks: counts.blocks || 0, faces: counts.faces || 0, props: counts.props || 0, theta: cam.theta, phi: cam.phi, dist: cam.dist, target: cam.target.toArray(), meshes: root ? root.children.length : 0, serial: current ? current.serial : null, building: building, focus: focus, gateH: gate ? gate.h : 0, gateZ: gate ? gate.zf : 0 }; },
    renderNow: renderNow, camera: function () { return cam; }, needsRender: function () { return dirty; }
  };
  // 試著建一個 WebGL 環境：瀏覽器不支援就當作 3D 用不了
  try { var test = document.createElement('canvas'); api.available = !!(test.getContext('webgl') || test.getContext('experimental-webgl')); } catch (e) { api.available = false; }
  if (!api.available) return stub();
  return api;
})();
