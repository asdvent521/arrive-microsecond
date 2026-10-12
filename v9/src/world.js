/* ===== v9 達秒屋（3D）：只畫 CORE.viewHouse 回傳的資料 =====
 * 一天一塊磚，同一種東西一次畫完（InstancedMesh）；沒在動就不重畫。一指拖著轉、兩指縮放、滾輪縮放；點一下（沒拖動）才算點。
 * 只用資料畫：屋型、顏色、樣式、擺設都是清單裡的字，畫面由這裡的程式畫。不讀紀錄、不改資料。
 */
var WORLD = (function () {
  'use strict';
  var T = typeof THREE !== 'undefined' ? THREE : null;
  var api = { available: false };
  if (!T) return stub();
  var renderer, scene, camera, root, container, groups = {}, picks = [], dirty = true, raf = 0, paused = false, onTap = null, lastKey = '';
  var cam = { theta: 0, phi: 1.2, dist: 30, target: new T.Vector3(0, 3, 0), minD: 4, maxD: 400 };
  var brickDays = {}, layout = null, current = null, placing = false, lastCalls = 0;
  function stub() { return { available: false, init: function () { return false; }, show: function () {}, setPlacing: function () {}, onTap: function () {}, info: function () { return { calls: 0, bricks: 0 }; }, screenOf: function () { return null; }, pause: function () {}, resume: function () {}, resize: function () {}, setInsets: function () {}, camera: function () { return null; } }; }
  function hex(k, fallback) { var p = CORE.PALETTE[k]; return new T.Color(p ? p.hex : fallback || '#999999'); }

  /* ---------- 屋型：第 i 天的磚放在哪裡（i＝那天離創角色那天幾天） ---------- */
  var BW = 0.94, BH = 0.46, BD = 0.46;
  var SHAPES = {
    // 塔：一圈 32 塊（方的，每邊 8 塊），一圈大約一個月，往上長
    tower: function (n) {
      var per = 8, ring = per * 4, half = per / 2, layers = Math.max(1, Math.ceil(n / ring));
      return { place: function (i) { var layer = Math.floor(i / ring), p = i % ring, side = Math.floor(p / per), t = p % per - (per - 1) / 2, y = layer * 0.5 + 0.25, o = half + BD / 2 - 0.2;
          return side === 0 ? { x: t, y: y, z: o, ry: 0 } : side === 1 ? { x: o, y: y, z: -t, ry: Math.PI / 2 } : side === 2 ? { x: -t, y: y, z: -o, ry: Math.PI } : { x: -o, y: y, z: t, ry: -Math.PI / 2 }; },
        hx: half, hz: half, h: Math.max(2.4, layers * 0.5), door: { x: 0, z: half + 0.3 }, roofW: per + 0.6, roofD: per + 0.6, round: false };
    },
    // 長屋：一直排七天，一週一排往旁邊接
    long: function (n) {
      var cols = Math.max(2, Math.ceil(n / 7)), x0 = -(cols - 1) / 2;
      return { place: function (i) { return { x: x0 + Math.floor(i / 7), y: (i % 7) * 0.5 + 0.25, z: 1.4, ry: 0 }; },
        hx: cols / 2 + 1.4, hz: 1.6, h: 3.5, door: { x: x0 - 1.15, z: 1.45 }, roofW: cols + 2.6, roofD: 3.6, round: false, body: { w: cols + 2.4, d: 2.6, h: 3.5, z: 0 } };
    },
    // 平房：方的，一圈一圈往外鋪（第 k 圈 8k 塊），中間是屋子
    flat: function (n) {
      var k = 1, used = 0; while (used + 8 * k < n) { used += 8 * k; k++; }
      var rings = k, core = 1.6;
      return { place: function (i) { var r = 1, s = 0; while (s + 8 * r <= i) { s += 8 * r; r++; } var p = i - s, side = Math.floor(p / (2 * r)), t = p % (2 * r) - r, d = core + r;
          var pos = side === 0 ? [t, d] : side === 1 ? [d, -t] : side === 2 ? [-t, -d] : [-d, t]; return { x: pos[0] * 0.98, y: 0.12, z: pos[1] * 0.98, ry: 0, flat: true }; },
        hx: core + rings + 0.5, hz: core + rings + 0.5, h: 2.6, door: { x: 0, z: core + 0.1 }, roofW: (core + 0.6) * 2 + rings * 0.6, roofD: (core + 0.6) * 2 + rings * 0.6, round: false, pavilion: core };
    },
    // 圓屋：圓的，一圈一圈往外鋪（第 k 圈大約 6k 塊）
    round: function (n) {
      var cnt = function (r) { return Math.max(6, Math.round(2 * Math.PI * r)); }, k = 1, used = 0; while (used + cnt(k) < n) { used += cnt(k); k++; }
      var rings = k, core = 1.6;
      return { place: function (i) { var r = 1, s = 0; while (s + cnt(r) <= i) { s += cnt(r); r++; } var a = (i - s) / cnt(r) * Math.PI * 2 + Math.PI / 2, d = core + r * 0.98;
          return { x: Math.cos(a) * d, y: 0.12, z: Math.sin(a) * d, ry: -a, flat: true }; },
        hx: core + rings + 0.5, hz: core + rings + 0.5, h: 2.6, door: { x: 0, z: core + 0.1 }, roofW: (core + 0.6) * 2 + rings * 0.6, roofD: (core + 0.6) * 2 + rings * 0.6, round: true, pavilion: core };
    }
  };

  /* ---------- 材質、貼圖 ---------- */
  var dashedTex = null;
  function dashed() {
    if (dashedTex) return dashedTex;
    var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.setLineDash([10, 7]); g.strokeRect(4, 4, 56, 56);
    dashedTex = new T.CanvasTexture(c); return dashedTex;
  }
  function signTexture(lines, bg, fg) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 256; var g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 512, 256); g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(8, 8, 496, 240);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach(function (t, i) { g.font = (i === 0 ? '700 54px' : '400 40px') + ' "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif'; g.fillText(t, 256, lines.length === 1 ? 128 : 80 + i * 90); });
    var tex = new T.CanvasTexture(c); return tex;
  }
  function litColor(wall, level) { var gold = new T.Color(level >= 3 ? '#FFF6C8' : level === 2 ? '#FFE07A' : '#F7C24A'); return wall.clone().lerp(gold, level >= 3 ? 0.92 : level === 2 ? 0.78 : 0.62); }

  /* ---------- 建場景 ---------- */
  function init(el) {
    container = el;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    } catch (e) { api.available = false; return false; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0xDCE6EE);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none'; renderer.domElement.style.display = 'block';
    scene = new T.Scene(); scene.fog = new T.Fog(0xDCE6EE, 200, 600);
    camera = new T.PerspectiveCamera(42, 1, 0.1, 2000);
    scene.add(new T.HemisphereLight(0xffffff, 0x8a8f96, 0.85));
    var sun = new T.DirectionalLight(0xffffff, 0.6); sun.position.set(30, 60, 40); scene.add(sun);
    root = new T.Group(); scene.add(root);
    bindInput(renderer.domElement);
    window.addEventListener('resize', function () { resize(); });
    resize();
    return true;
  }
  function clear() {
    root.children.slice().forEach(function (o) { root.remove(o); o.traverse(function (x) { if (x.geometry) x.geometry.dispose(); if (x.material) { (Array.isArray(x.material) ? x.material : [x.material]).forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); }); } }); });
    picks = []; brickDays = {};
  }
  function inst(geo, mat, n, name) { var m = new T.InstancedMesh(geo, mat, Math.max(1, n)); m.count = n; m.name = name; m.frustumCulled = false; root.add(m); return m; }
  var M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), SV = new T.Vector3(1, 1, 1), E = new T.Euler();
  function setM(mesh, i, p, ry, sx, sy, sz, rx) { E.set(rx || 0, ry || 0, 0); Q.setFromEuler(E); V.set(p.x, p.y, p.z); SV.set(sx || 1, sy || 1, sz || 1); M4.compose(V, Q, SV); mesh.setMatrixAt(i, M4); }

  // view：CORE.viewHouse 的結果；keepCamera：同一間屋重畫時鏡頭不動
  function show(view, opts) {
    if (!renderer) return;
    opts = opts || {}; var same = current && current.serial === view.serial;
    var key = JSON.stringify(view) + '|' + !!opts.placing;
    if (same && key === lastKey && !opts.resetCamera) return;   // 什麼都沒變就不重蓋
    var startPlacing = !!opts.placing && !placing;
    lastKey = key; current = view; placing = !!opts.placing;
    clear();
    var look = view.look, wall = hex(look.wall), roofC = hex(look.roof), trim = hex(look.trim);
    var born = view.bricks.length ? view.bricks[0].day : 0, n = 0;
    view.bricks.forEach(function (b) { n = Math.max(n, b.day - born + 1); });
    var L = layout = SHAPES[look.shape] ? SHAPES[look.shape](Math.max(1, n)) : SHAPES.tower(Math.max(1, n));
    // 磚：沒亮的、亮的（三級，自己發光）、未來的虛線、蓋布、小記號、每個月之間的分隔線
    var past = view.bricks.filter(function (b) { return !b.future; }), fut = view.bricks.filter(function (b) { return b.future; });
    var unlit = [], lit = [], cover = [], mark = [], sep = [];
    past.forEach(function (b) { if (!view.closed && b.cover) cover.push(b); else if (!view.closed && b.lit) lit.push(b); else unlit.push(b); if (!view.closed && b.mark) mark.push(b); });
    var geoB = new T.BoxGeometry(BW, BH, BD), geoF = new T.BoxGeometry(BW, 0.2, BW);
    var gB = function (b) { return L.place(b.day - born).flat ? geoF : geoB; };
    var flat = !!L.place(0).flat, geo = flat ? geoF : geoB;
    var mU = inst(geo, new T.MeshLambertMaterial({ color: 0xffffff }), unlit.length, 'unlit');
    var mL = inst(geo, new T.MeshBasicMaterial({ color: 0xffffff }), lit.length, 'lit');
    var mC = inst(geo, new T.MeshLambertMaterial({ color: 0xB9B3A6 }), cover.length, 'cover');
    var mF = inst(geo, new T.MeshBasicMaterial({ map: dashed(), transparent: true, depthWrite: false, color: wall.clone().lerp(new T.Color('#ffffff'), 0.4) }), fut.length, 'future');
    var mK = inst(new T.SphereGeometry(0.08, 8, 6), new T.MeshBasicMaterial({ color: 0x1b1b1b }), mark.length, 'mark');
    var dark = wall.clone().multiplyScalar(0.62), col = new T.Color();
    var put = function (mesh, list, colorFn, scale) { list.forEach(function (b, i) { var p = L.place(b.day - born); setM(mesh, i, p, p.ry, scale || 1, scale || 1, scale || 1); if (colorFn) { mesh.setColorAt(i, colorFn(b, i)); } }); mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.userData.days = list.map(function (b) { return b.day; }); picks.push(mesh); };
    put(mU, unlit, function (b, i) { return col.copy(dark).multiplyScalar(0.92 + ((b.day * 7919) % 17) / 100); });
    put(mL, lit, function (b) { return litColor(wall, b.lit); });
    put(mC, cover, null, 1.05);
    put(mF, fut, null);
    mark.forEach(function (b, i) { var p = L.place(b.day - born); var off = p.flat ? { x: 0, y: 0.14, z: 0 } : { x: Math.sin(p.ry) * (BD / 2 + 0.02), y: 0, z: Math.cos(p.ry) * (BD / 2 + 0.02) }; setM(mK, i, { x: p.x + off.x, y: p.y + off.y, z: p.z + off.z }, 0); }); mK.instanceMatrix.needsUpdate = true;
    // 每個月之間一條分隔線：在那個月第一天那塊磚的前緣
    past.concat(fut).forEach(function (b) { var d = new Date((b.day * 86400000) + 43200000); if (d.getUTCDate() === 1 && b.day !== born) sep.push(b); });
    var mS = inst(new T.BoxGeometry(0.06, flat ? 0.24 : BH + 0.06, flat ? BW + 0.06 : BD + 0.06), new T.MeshBasicMaterial({ color: 0x2a2a2a }), sep.length, 'sep');
    sep.forEach(function (b, i) { var p = L.place(b.day - born); var dx = -BW / 2 - 0.03; setM(mS, i, { x: p.x + Math.cos(p.ry) * dx, y: p.y, z: p.z - Math.sin(p.ry) * dx }, p.ry); }); mS.instanceMatrix.needsUpdate = true;
    // 地面
    var R = Math.max(L.hx, L.hz) + 1.5 + CORE.PROP_RINGS * 1.3 + 1;
    var ground = new T.Mesh(new T.CircleGeometry(R + 2, 48), new T.MeshLambertMaterial({ color: 0x93A57F })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.name = 'ground'; root.add(ground);
    // 屋身、屋頂
    var roofY = L.h, rs = look.roofStyle;
    if (L.body) { var body = new T.Mesh(new T.BoxGeometry(L.body.w, L.body.h, L.body.d), new T.MeshLambertMaterial({ color: dark.clone().multiplyScalar(0.9) })); body.position.set(0, L.body.h / 2, L.body.z); root.add(body); }
    if (L.pavilion) { var post = new T.CylinderGeometry(0.12, 0.12, L.h, 8), pm = new T.MeshLambertMaterial({ color: trim }), c0 = L.pavilion; var posts = inst(post, pm, 4, 'posts'); [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q, i) { setM(posts, i, { x: q[0] * c0, y: L.h / 2, z: q[1] * c0 }, 0); }); posts.instanceMatrix.needsUpdate = true;
      var floorC = new T.Mesh(L.round ? new T.CylinderGeometry(c0 + 0.4, c0 + 0.4, 0.2, 24) : new T.BoxGeometry(c0 * 2 + 0.8, 0.2, c0 * 2 + 0.8), new T.MeshLambertMaterial({ color: dark })); floorC.position.y = 0.1; root.add(floorC); }
    if (!L.body && !L.pavilion) { var inner = new T.Mesh(new T.BoxGeometry(L.hx * 2 - 0.9, L.h, L.hz * 2 - 0.9), new T.MeshLambertMaterial({ color: dark.clone().multiplyScalar(0.8) })); inner.position.y = L.h / 2; root.add(inner); }
    var roofMat = new T.MeshLambertMaterial({ color: roofC }), roof;
    var rw = L.roofW, rd = L.roofD;
    if (rs === 'dome') { roof = new T.Mesh(new T.SphereGeometry(Math.max(rw, rd) / 2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), roofMat); roof.scale.set(rw / Math.max(rw, rd), 0.7, rd / Math.max(rw, rd)); roof.position.y = roofY; }
    else if (rs === 'flat') { roof = new T.Mesh(new T.BoxGeometry(rw, 0.35, rd), roofMat); roof.position.y = roofY + 0.17; }
    else { var sh = new T.Shape(); sh.moveTo(-rd / 2, 0); sh.lineTo(0, Math.min(2.6, rd * 0.28)); sh.lineTo(rd / 2, 0); sh.lineTo(-rd / 2, 0); roof = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: rw, bevelEnabled: false }), roofMat); roof.rotation.y = Math.PI / 2; roof.position.set(-rw / 2, roofY, 0); }
    roof.name = 'roof'; root.add(roof);
    // 門（點門到他的表格世界）、窗、門牌
    var dp = L.door, doorMat = new T.MeshLambertMaterial({ color: trim.clone().multiplyScalar(0.75), side: T.DoubleSide }), ry0 = dp.side ? -Math.PI / 2 : 0;
    var doorParts = look.door === 'arch' ? [[new T.BoxGeometry(1.24, 1.3, 0.18), 0.65], [new T.CircleGeometry(0.62, 20, 0, Math.PI), 1.3]] : [[new T.BoxGeometry(look.door === 'double' ? 1.6 : 1.05, 1.9, 0.18), 0.95]];
    doorParts.forEach(function (dpart) { var m = new T.Mesh(dpart[0], doorMat); m.position.set(dp.x, dpart[1], dp.z + (dpart[0].type === 'CircleGeometry' && !dp.side ? 0.09 : 0)); if (dp.side && dpart[0].type === 'CircleGeometry') m.position.x -= 0.09; m.rotation.y = ry0; m.name = 'door'; root.add(m); picks.push(m); });
    if (look.door === 'double') { var line = new T.Mesh(new T.BoxGeometry(0.04, 1.9, 0.2), new T.MeshBasicMaterial({ color: 0x222222 })); line.position.set(dp.x, 0.95, dp.z); line.rotation.y = ry0; root.add(line); }
    var winG = look.window === 'round' ? new T.CylinderGeometry(0.32, 0.32, 0.1, 16) : look.window === 'tall' ? new T.BoxGeometry(0.42, 0.95, 0.1) : new T.BoxGeometry(0.62, 0.62, 0.1), winSpots = [];
    if (look.shape === 'tower') { for (var y = 2.2; y < L.h - 0.6; y += 4) { [1, 2, 3].forEach(function (side) { winSpots.push({ side: side, y: y }); }); } }
    else if (L.body) { for (var wx = -L.body.w / 2 + 2; wx < L.body.w / 2 - 1; wx += 4) winSpots.push({ x: wx, y: 2.6, z: -L.body.d / 2 - 0.06 }); }
    else { [[-1, 0], [1, 0], [0, -1]].forEach(function (q) { winSpots.push({ x: q[0] * (L.pavilion + 0.12), y: 1.5, z: q[1] * (L.pavilion + 0.12), ry: q[0] ? Math.PI / 2 : 0, free: true }); }); }
    var mW = inst(winG, new T.MeshLambertMaterial({ color: trim }), winSpots.length, 'windows');
    winSpots.forEach(function (w, i) { if (w.side) { var o = L.hx + 0.1; var pos = w.side === 1 ? { x: o, y: w.y, z: 0 } : w.side === 2 ? { x: 0, y: w.y, z: -o } : { x: -o, y: w.y, z: 0 }; setM(mW, i, pos, w.side === 2 ? 0 : Math.PI / 2, 1, 1, 1, look.window === 'round' ? Math.PI / 2 : 0); } else setM(mW, i, w, w.ry || 0, 1, 1, 1, look.window === 'round' ? Math.PI / 2 : 0); }); mW.instanceMatrix.needsUpdate = true;
    var sign = new T.Mesh(new T.PlaneGeometry(2.2, 1.1), new T.MeshBasicMaterial({ map: signTexture(view.closed ? ['只給鄰居看'] : [view.age ? view.age.text : '', view.sign || ''], '#' + trim.getHexString(), '#' + (trim.getHSL({}).l > 0.55 ? '1b1b1b' : 'ffffff')) }));
    sign.position.set(dp.side ? dp.x - 0.2 : dp.x + 1.8, 1.9, dp.side ? dp.z + 1.8 : dp.z + 0.15); if (dp.side) sign.rotation.y = -Math.PI / 2; sign.name = 'sign'; root.add(sign);
    // 擺設：房子外面一圈一圈的格子（方向 a、第 r 圈），跟著房子大小往外推，不會被蓋住
    buildProps(look.props);
    if (placing) buildCells(look.props);
    // 鏡頭：一打開整間屋都在畫面裡，對著門
    var topY = L.h + (rs === 'flat' ? 0.4 : Math.min(2.6, L.roofD * 0.28));
    cam.target.set(0, topY / 2, 0);
    var fitR = Math.sqrt(Math.pow(Math.max(L.hx, L.hz) + 1.5 + CORE.PROP_RINGS * 1.3, 2) + topY * topY / 4) * 1.08;
    cam.minD = 3; cam.maxD = fitR * 6;
    if (!same || opts.resetCamera) { cam.theta = 0; cam.phi = 1.25; cam.dist = fitDist(fitR); }
    if (startPlacing) cam.phi = Math.min(cam.phi, 0.8);   // 擺設時從高一點往下看，地上的格子比較好點
    root.updateMatrixWorld(true);   // 新蓋的東西馬上點得到，不用等下一次畫
    applyCam(); dirty = true; loop();
  }
  function cellPos(a, r) {
    var L = layout, t = a / CORE.PROP_ANGLES;
    if (L.round) { var ang = t * Math.PI * 2 + Math.PI / 2, rr = Math.max(L.hx, L.hz) + 1.5 + r * 1.3; return { x: Math.cos(ang) * rr, z: Math.sin(ang) * rr }; }
    var hx = L.hx + 1.5 + r * 1.3, hz = L.hz + 1.5 + r * 1.3, per = 4 * (hx + hz), d = (t * per + hx) % per;   // 從正前方中間開始，順著外框走
    if (d < 2 * hx) return { x: hx - d, z: hz }; d -= 2 * hx;
    if (d < 2 * hz) return { x: -hx, z: hz - d }; d -= 2 * hz;
    if (d < 2 * hx) return { x: -hx + d, z: -hz }; d -= 2 * hx;
    return { x: hx, z: -hz + d };
  }
  var PROP_PARTS = {
    tree: [{ g: function () { return new T.CylinderGeometry(0.12, 0.16, 1.2, 8); }, c: '#7A5536', y: 0.6 }, { g: function () { return new T.ConeGeometry(0.75, 1.6, 10); }, c: '#4E7A3E', y: 1.8 }],
    flower: [{ g: function () { return new T.CylinderGeometry(0.03, 0.03, 0.5, 6); }, c: '#4E7A3E', y: 0.25 }, { g: function () { return new T.SphereGeometry(0.22, 10, 8); }, c: '#D9667A', y: 0.6 }],
    lamp: [{ g: function () { return new T.CylinderGeometry(0.06, 0.08, 2, 8); }, c: '#333333', y: 1 }, { g: function () { return new T.SphereGeometry(0.22, 10, 8); }, c: '#FFE7A0', y: 2.1, basic: true }],
    flag: [{ g: function () { return new T.CylinderGeometry(0.04, 0.04, 2.2, 6); }, c: '#555555', y: 1.1 }, { g: function () { return new T.BoxGeometry(0.8, 0.5, 0.04); }, c: '#C0453A', y: 1.9, x: 0.42 }],
    bench: [{ g: function () { return new T.BoxGeometry(1.4, 0.12, 0.45); }, c: '#8B6A44', y: 0.45 }, { g: function () { return new T.BoxGeometry(1.4, 0.45, 0.08); }, c: '#8B6A44', y: 0.7, z: -0.2 }],
    rock: [{ g: function () { return new T.DodecahedronGeometry(0.45, 0); }, c: '#8F8C86', y: 0.3 }]
  };
  function buildProps(props) {
    Object.keys(PROP_PARTS).forEach(function (kind) {
      var list = props.filter(function (p) { return p.kind === kind; }); if (!list.length) return;
      PROP_PARTS[kind].forEach(function (part, pi) {
        var mesh = inst(part.g(), part.basic ? new T.MeshBasicMaterial({ color: part.c }) : new T.MeshLambertMaterial({ color: part.c }), list.length, 'prop-' + kind + '-' + pi);
        list.forEach(function (p, i) { var c = cellPos(p.a, p.r), ry = -p.rot * Math.PI / 180, ox = part.x || 0, oz = part.z || 0; setM(mesh, i, { x: c.x + Math.cos(ry) * ox + Math.sin(ry) * oz, y: part.y, z: c.z - Math.sin(ry) * ox + Math.cos(ry) * oz }, ry); });
        mesh.instanceMatrix.needsUpdate = true; mesh.userData.props = list.map(function (p) { return { a: p.a, r: p.r }; }); picks.push(mesh);
      });
    });
  }
  function buildCells(props) {
    var cells = []; for (var a = 0; a < CORE.PROP_ANGLES; a++) for (var r = 0; r < CORE.PROP_RINGS; r++) if (!props.some(function (p) { return p.a === a && p.r === r; })) cells.push({ a: a, r: r });
    var mesh = inst(new T.CircleGeometry(0.55, 20), new T.MeshBasicMaterial({ color: 0x2D5A86, transparent: true, opacity: 0.5, side: T.DoubleSide }), cells.length, 'cells');
    cells.forEach(function (c, i) { var p = cellPos(c.a, c.r); setM(mesh, i, { x: p.x, y: 0.04, z: p.z }, 0, 1, 1, 1, -Math.PI / 2); }); mesh.instanceMatrix.needsUpdate = true; mesh.userData.cells = cells; picks.push(mesh);
  }
  // 只用上下兩條列之間的空間擺整間屋：視角往下（或往上）挪，距離照這一段的高度算
  var insets = { t: 0, b: 0 }, vw = 1, vh = 1;
  function setInsets(t, b) { t = Math.max(0, Math.round(t) || 0); b = Math.max(0, Math.round(b) || 0); if (t === insets.t && b === insets.b) return; insets = { t: t, b: b }; resize(); }
  function fitDist(r) { var fov = camera.fov * Math.PI / 180, fullH = vh + Math.abs(insets.t - insets.b), band = Math.max(80, vh - insets.t - insets.b), tv = Math.tan(fov / 2) * band / fullH, th = Math.tan(fov / 2) * vw / fullH; return r / Math.sin(Math.atan(Math.min(tv, th))) * 1.02; }
  function applyCam() {
    var c = cam; c.phi = Math.max(0.15, Math.min(1.5, c.phi)); c.dist = Math.max(c.minD, Math.min(c.maxD, c.dist));
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
  var ray = new T.Raycaster(), ndc = new T.Vector2();
  // 手指點的不會剛好準：先點那一點，沒打到再試旁邊幾個點（也避開剛好落在三角形邊上的時候）
  var NEAR = [[0, 0], [0.37, 0.21], [-0.33, 0.29], [0.3, -0.4], [-0.25, -0.35], [3, 0], [-3, 0], [0, 3], [0, -3], [6, 0], [-6, 0], [0, 6], [0, -6]];
  function hitAt(x, y) { for (var i = 0; i < NEAR.length; i++) { var h = hitOne(x + NEAR[i][0], y + NEAR[i][1]); if (h) return h; } return null; }
  function hitOne(x, y) {
    var r = renderer.domElement.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    var hits = ray.intersectObjects(picks, false);
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i], o = h.object;
      if (o.name === 'door') return { kind: 'door' };
      if (o.userData.days && h.instanceId != null) return { kind: 'brick', day: o.userData.days[h.instanceId], mesh: o.name };
      if (o.userData.props && h.instanceId != null) { var p = o.userData.props[h.instanceId]; return { kind: 'prop', a: p.a, r: p.r }; }
      if (o.userData.cells && h.instanceId != null) { var c = o.userData.cells[h.instanceId]; return { kind: 'cell', a: c.a, r: c.r }; }
    }
    return null;
  }
  function tap(x, y) { var hit = hitAt(x, y); if (onTap) onTap(hit); }

  /* ---------- 給畫面和測試用 ---------- */
  // 某個東西在畫面上的位置：{day}、'door'、{cell:[a,r]}、{prop:[a,r]}
  function screenOf(target) {
    if (!renderer || !layout || !current) return null;
    var p = null, born = current.bricks.length ? current.bricks[0].day : 0;
    if (target === 'door') { var d = layout.door; p = new T.Vector3(d.x, 0.8, d.z + (d.side ? 0 : 0.1)); if (d.side) p.x -= 0.1; }
    else if (target.day != null) { var b = layout.place(target.day - born); p = new T.Vector3(b.x, b.y, b.z); if (!b.flat) { p.x += Math.sin(b.ry) * BD / 2; p.z += Math.cos(b.ry) * BD / 2; } else p.y += 0.1; }
    else if (target.cell) { var c = cellPos(target.cell[0], target.cell[1]); p = new T.Vector3(c.x, 0.04, c.z); }
    else if (target.prop) { var q = cellPos(target.prop[0], target.prop[1]); p = new T.Vector3(q.x, 0.4, q.z); }
    if (!p) return null;
    p.project(camera); var r = renderer.domElement.getBoundingClientRect();
    if (p.z > 1) return null;
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
  }
  function renderNow() { if (renderer) { renderer.render(scene, camera); lastCalls = renderer.info.render.calls; dirty = false; } }
  api = {
    available: true, init: init, show: show, resize: resize, setInsets: setInsets, hitAt: hitAt, screenOf: screenOf,
    onTap: function (fn) { onTap = fn; },
    pause: function () { paused = true; if (raf) { cancelAnimationFrame(raf); raf = 0; } }, resume: function () { paused = false; dirty = true; loop(); },
    info: function () { var c = 0, by = {}; root && root.children.forEach(function (o) { if (o.isInstancedMesh) { by[o.name] = o.count; if (/^(unlit|lit|cover|future)$/.test(o.name)) c += o.count; } }); return { calls: lastCalls, bricks: c, lit: by.lit || 0, cover: by.cover || 0, future: by.future || 0, marks: by.mark || 0, props: Object.keys(by).filter(function (k) { return /^prop-.*-0$/.test(k); }).reduce(function (n, k) { return n + by[k]; }, 0), theta: cam.theta, phi: cam.phi, dist: cam.dist, meshes: root ? root.children.length : 0, serial: current ? current.serial : null }; },
    renderNow: renderNow, camera: function () { return cam; }, needsRender: function () { return dirty; }
  };
  // 試著建一個 WebGL 環境：瀏覽器不支援就當作 3D 用不了
  try { var test = document.createElement('canvas'); api.available = !!(test.getContext('webgl') || test.getContext('experimental-webgl')); } catch (e) { api.available = false; }
  if (!api.available) return stub();
  return api;
})();
