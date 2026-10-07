/* ===== 畫面層：Three.js 照資料蓋世界 =====
 * 只讀資料、畫畫面、回報事件（靠近、到達、繞圈、點到傳送門）。規則都在 data.js。
 */
var WORLD = (function () {
  'use strict';
  // THREE 不存在（引擎沒載入）：回傳一個什麼都不做的替身，表世界照常能用
  if (typeof THREE === 'undefined') {
    var noop = function () {};
    return { available: false, init: noop, on: noop, loadWorld: noop, refreshObject: noop, walkTo: noop, circleAround: noop, enter: function () { return false; }, leave: function () { return false; }, depth: function () { return 0; },
             stop: noop, showPortal: noop, hidePortal: noop, flash: noop, setArcFilter: noop, playerPos: function () { return { x: 0, z: 0 }; }, isMoving: function () { return false; },
             distanceTo: function () { return Infinity; }, insideAny: function () { return false; }, resize: noop, camera: { yaw: 0, dist: 0 }, zoomTo: noop,
             setTapHook: noop, setGuide: noop, guideCount: function () { return 0; }, showPartner: noop, objectAt: function () { return null; }, movePlayerTo: noop, screenOf: function () { return null; } };
  }
  var renderer, scene, camera, ground, objGroup, pathGroup, portal, player, clock, arc, labelLayer, flashEl, wallGroup, guideGroup, partner, tapHook = null;
  var stack = [];            // 進門的層：[{objects, pos}]，最多 3 層
  var sceneInfo = { depth: 0, visiting: false };
  var objects = [];          // [{data, mesh, radius, top, pos:Vector3, label, inside, arrived, angle, startAngle, turned, count}]
  var waypoints = [];
  var handlers = {};
  var SPEED = 5;
  var AVOID = 0.55;          // 走路離物件邊緣的距離
  var raycaster = new THREE.Raycaster();
  var pointer = new THREE.Vector2();
  var hostEl;
  // 鏡頭：繞著角色轉（yaw）、固定俯角、可拉遠拉近
  var cam = { yaw: 0, pitch: 0.85, dist: 26, min: 10, max: 60 };
  var pointers = {};         // 目前按著的手指
  var gesture = null;        // {tap, x, y, yaw, dist, pinch}

  function on(name, fn) { handlers[name] = fn; }
  function emit(name, a, b) { if (handlers[name]) handlers[name](a, b); }

  function init(host) {
    hostEl = host;
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);
    labelLayer = document.createElement('div');
    labelLayer.className = 'labels';
    host.appendChild(labelLayer);
    flashEl = document.createElement('div');
    flashEl.className = 'whiteflash';
    host.appendChild(flashEl);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdfe6ec);
    scene.fog = new THREE.Fog(0xdfe6ec, 40, 90);
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8d9aa8, 0.9));
    var sun = new THREE.DirectionalLight(0xfff4e0, 0.8);
    sun.position.set(10, 20, 8);
    scene.add(sun);

    ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshLambertMaterial({ color: 0xcfd8df }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    var grid = new THREE.GridHelper(120, 60, 0xb9c4cd, 0xc4ced6);
    grid.position.y = 0.01;
    scene.add(grid);

    objGroup = new THREE.Group(); scene.add(objGroup);
    pathGroup = new THREE.Group(); scene.add(pathGroup);
    wallGroup = new THREE.Group(); scene.add(wallGroup);   // 內部空間的地板與牆（只是畫面）
    guideGroup = new THREE.Group(); scene.add(guideGroup); // v7：地上的指引光點
    // v7：對接那一微秒並排的另一個角色
    partner = new THREE.Group();
    var pb = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 16), new THREE.MeshLambertMaterial({ color: 0x9c4450 }));
    pb.position.y = 0.6;
    var ph = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), new THREE.MeshLambertMaterial({ color: 0xf1e4c8 }));
    ph.position.y = 1.55;
    partner.add(pb); partner.add(ph); partner.visible = false; scene.add(partner);

    // 角色：圓柱身體 + 球頭
    player = new THREE.Group();
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 16), new THREE.MeshLambertMaterial({ color: 0x2d5a86 }));
    body.position.y = 0.6;
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), new THREE.MeshLambertMaterial({ color: 0xf1e4c8 }));
    head.position.y = 1.55;
    player.add(body); player.add(head);
    scene.add(player);

    // 繞圈進度弧：畫在地上
    arc = new THREE.Mesh(new THREE.RingGeometry(1, 1.2, 8, 1, 0, 0.01), new THREE.MeshBasicMaterial({ color: 0xa2731f, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    arc.rotation.x = -Math.PI / 2;
    arc.position.y = 0.03;
    arc.visible = false;
    scene.add(arc);

    // 白光傳送門：光柱 + 環
    portal = new THREE.Group();
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 9, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 2.6;
    var ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 12, 40), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    var glow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    portal.add(beam); portal.add(ring); portal.add(glow);
    portal.position.y = 1.8;
    portal.visible = false;
    scene.add(portal);

    clock = new THREE.Clock();
    resize();
    window.addEventListener('resize', resize);
    var el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', function (e) { e.preventDefault(); zoomTo(cam.dist * (e.deltaY > 0 ? 1.1 : 0.9)); }, { passive: false });
    requestAnimationFrame(loop);
  }

  /* ---------- 手勢：單指點＝走、單指拖＝轉鏡頭、兩指＝縮放 ---------- */
  function count() { return Object.keys(pointers).length; }
  function spread() {
    var ids = Object.keys(pointers);
    if (ids.length < 2) return 0;
    var a = pointers[ids[0]], b = pointers[ids[1]];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function onDown(e) {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    try { renderer.domElement.setPointerCapture(e.pointerId); } catch (err) { /* 桌機沒差 */ }
    if (count() === 1) gesture = { tap: true, x: e.clientX, y: e.clientY, yaw: cam.yaw };
    else if (count() === 2) gesture = { tap: false, dist: cam.dist, pinch: spread() };
  }
  function onMove(e) {
    if (!pointers[e.pointerId] || !gesture) return;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (count() === 1) {
      var dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
      if (gesture.tap && Math.hypot(dx, dy) > 10) gesture.tap = false;
      if (!gesture.tap) cam.yaw = gesture.yaw - dx * 0.008;
    } else if (count() >= 2 && gesture.pinch) {
      zoomTo(gesture.dist * gesture.pinch / Math.max(spread(), 1));
    }
  }
  function onUp(e) {
    var was = gesture;
    delete pointers[e.pointerId];
    if (count() === 0) {
      gesture = null;
      if (was && was.tap) tap(e.clientX, e.clientY);
    } else if (count() === 1) {
      var id = Object.keys(pointers)[0];
      gesture = { tap: false, x: pointers[id].x, y: pointers[id].y, yaw: cam.yaw };
    }
  }
  function zoomTo(d) { cam.dist = Math.max(cam.min, Math.min(cam.max, d)); }
  function camOffset() {
    var r = cam.dist * Math.cos(cam.pitch);
    return new THREE.Vector3(Math.sin(cam.yaw) * r, cam.dist * Math.sin(cam.pitch), Math.cos(cam.yaw) * r);
  }

  function resize() {
    if (!hostEl) return;
    var w = hostEl.clientWidth || 1, h = hostEl.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    // 直式手機：視角開大、預設拉遠，五個功能點才看得全
    var portrait = w < h;
    camera.fov = portrait ? 52 : 45;
    if (!resize.done) { cam.dist = portrait ? 36 : 22; resize.done = true; }
    camera.updateProjectionMatrix();
  }

  /* ---------- 照資料蓋 ---------- */
  function clear(group) { while (group.children.length) group.remove(group.children[0]); }

  function geometryFor(p) {
    var s = p.size;
    switch (p.shape) {
      case 'cylinder': return new THREE.CylinderGeometry(s[0] / 2, s[0] / 2, s[1], 24);
      case 'sphere':   return new THREE.SphereGeometry(s[0] / 2, 20, 14);
      case 'cone':     return new THREE.ConeGeometry(s[0] / 2, s[1], 24);
      default:         return new THREE.BoxGeometry(s[0], s[1], s[2]);
    }
  }
  function buildObject(o) {
    var g = new THREE.Group();
    (o.parts || []).forEach(function (p) {
      var m = new THREE.Mesh(geometryFor(p), new THREE.MeshLambertMaterial({ color: new THREE.Color(p.color || '#999') }));
      var off = p.offset || [0, 0, 0];
      m.position.set(off[0], off[1], off[2]);
      m.userData.objectId = o.id;
      g.add(m);
    });
    g.position.set(o.pos[0], 0, o.pos[1]);
    return g;
  }
  function topOf(o) {
    var t = 1;
    (o.parts || []).forEach(function (p) { var y = (p.offset ? p.offset[1] : 0) + p.size[1] / 2; if (y > t) t = y; });
    return t;
  }
  function makeEntry(o) {
    var label = document.createElement('div');
    label.className = 'label ' + (o.func || 'none');
    label.textContent = o.name;
    labelLayer.appendChild(label);
    return { data: o, mesh: buildObject(o), radius: DATA.radiusOf(o), top: topOf(o), pos: new THREE.Vector3(o.pos[0], 0, o.pos[1]),
             label: label, inside: false, arrived: false, angle: 0, startAngle: 0, turned: 0, count: 0 };
  }

  // world：角色的世界資料（已經過純資料檢查）；opts.visiting：傳送過去逛，畫出對方設定的路
  function loadWorld(world, opts) {
    opts = opts || {};
    stack = [];
    sceneInfo = { depth: 0, visiting: !!opts.visiting };
    loadScene(world.objects, world.start || [0, 0], world.path, opts.visiting);
  }
  // 一層場景：外部或某扇門裡面
  function loadScene(objs, start, path, visiting) {
    clear(objGroup); clear(pathGroup); clear(wallGroup);
    labelLayer.innerHTML = '';
    var inner = sceneInfo.depth > 0;
    objects = objs.map(function (o) { var e = makeEntry(o); objGroup.add(e.mesh); return e; });
    if (inner) {
      // 內部：一塊地板和四面矮牆，讓人知道在屋裡
      var floor = new THREE.Mesh(new THREE.BoxGeometry(26, 0.1, 26), new THREE.MeshLambertMaterial({ color: 0xb8ad9c }));
      floor.position.y = 0.02; wallGroup.add(floor);
      [[0, -13], [0, 13], [-13, 0], [13, 0]].forEach(function (p, i) {
        var w = new THREE.Mesh(new THREE.BoxGeometry(i < 2 ? 26 : 0.6, 2.4, i < 2 ? 0.6 : 26), new THREE.MeshLambertMaterial({ color: 0xa79c8b }));
        w.position.set(p[0], 1.2, p[1]); wallGroup.add(w);
      });
    }
    if (!inner && visiting && path && path.length > 1) {
      for (var i = 0; i < path.length - 1; i++) {
        var a = path[i], b = path[i + 1];
        var dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
        var seg = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 1.2), new THREE.MeshLambertMaterial({ color: 0xf3e9d2 }));
        seg.position.set((a[0] + b[0]) / 2, 0.03, (a[1] + b[1]) / 2);
        seg.rotation.y = -Math.atan2(dz, dx);
        pathGroup.add(seg);
      }
    }
    player.position.set(start[0], 0, start[1]);
    waypoints = [];
    hidePortal();
    arc.visible = false;
    detect.lastNear = undefined;
    objects.forEach(function (o) { o.arrived = false; o.inside = false; });
    player.children[0].material.color = new THREE.Color(sceneInfo.visiting ? 0x5c6670 : 0x2d5a86);
    scene.background = new THREE.Color(inner ? 0xcfc6b6 : sceneInfo.visiting ? 0xe4e0d6 : 0xdfe6ec);
    scene.fog.color = scene.background;
    scene.fog.near = inner ? 30 : 40; scene.fog.far = inner ? 60 : 90;
    ground.visible = !inner;
    camera.position.copy(player.position).add(camOffset());
    camera.lookAt(player.position);
  }
  // 進門：換到那個物件的內部場景；門開不開由接線層先判
  function enter(id) {
    var o = objects.find(function (x) { return x.data.id === id; });
    if (!o || !o.data.door) return false;
    if (stack.length >= 3) return false;
    stack.push({ objects: objects.map(function (x) { return x.data; }), pos: [player.position.x, player.position.z] });
    sceneInfo.depth = stack.length;
    loadScene(o.data.door.objects, o.data.door.start || [0, 4], null, sceneInfo.visiting);
    emit('scene', sceneInfo.depth);
    return true;
  }
  // 出門：回到上一層，站在門口
  function leave() {
    var prev = stack.pop();
    if (!prev) return false;
    sceneInfo.depth = stack.length;
    loadScene(prev.objects, prev.pos, null, sceneInfo.visiting);
    emit('scene', sceneInfo.depth);
    return true;
  }
  function depth() { return sceneInfo.depth; }

  function refreshObject(id) {
    var i = objects.findIndex(function (x) { return x.data.id === id; });
    if (i < 0) return;
    objGroup.remove(objects[i].mesh);
    labelLayer.removeChild(objects[i].label);
    objects[i] = makeEntry(objects[i].data);
    objGroup.add(objects[i].mesh);
  }

  // 傳送時畫面閃白
  function flash() {
    flashEl.classList.remove('go');
    void flashEl.offsetWidth;
    flashEl.classList.add('go');
  }

  /* ---------- 走路 ---------- */
  function tap(cx, cy) {
    var r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((cx - r.left) / r.width) * 2 - 1;
    pointer.y = -((cy - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    if (portal.visible && raycaster.intersectObject(portal, true).length) { emit('portal'); return; }
    var hits = raycaster.intersectObjects(objGroup.children, true);
    var o = hits.length ? objects.find(function (x) { return x.data.id === hits[0].object.userData.objectId; }) : null;
    var hg = raycaster.intersectObject(ground);
    // v7：建造模式等情況，先問接線層要不要接手這次點擊
    if (tapHook && tapHook({ object: o ? o.data : null, point: hg.length ? { x: hg[0].point.x, z: hg[0].point.z } : null })) return;
    if (o) { walkTo(edgePoint(o)); return; }
    if (hg.length) walkTo(hg[0].point);
  }
  function edgePoint(o) {
    var dir = new THREE.Vector3().subVectors(player.position, o.pos); dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(1, 0, 0);
    dir.normalize().multiplyScalar(o.radius + AVOID + 0.15);
    return new THREE.Vector3().addVectors(o.pos, dir);
  }
  // 目標點如果在物件裡，推到物件邊上
  function outside(p) {
    objects.forEach(function (o) {
      var dx = p.x - o.pos.x, dz = p.z - o.pos.z, d = Math.hypot(dx, dz), need = o.radius + AVOID + 0.1;
      if (d < need) { if (d < 0.01) { dx = 1; dz = 0; d = 1; } p.x = o.pos.x + dx / d * need; p.z = o.pos.z + dz / d * need; }
    });
    return p;
  }
  function walkTo(p) { waypoints = [outside(new THREE.Vector3(p.x, 0, p.z))]; }
  function walkPath(points) { waypoints = points.map(function (p) { return outside(new THREE.Vector3(p.x, 0, p.z)); }); }
  // 繞某個物件一圈：排一圈路徑點
  function circleAround(id) {
    var o = objects.find(function (x) { return x.data.id === id; });
    if (!o) return;
    var r = o.radius + 1.4;
    var a0 = Math.atan2(player.position.z - o.pos.z, player.position.x - o.pos.x);
    var pts = [];
    for (var i = 0; i <= 16; i++) {
      var a = a0 + (i / 16) * Math.PI * 2;
      pts.push({ x: o.pos.x + Math.cos(a) * r, z: o.pos.z + Math.sin(a) * r });
    }
    walkPath(pts);
  }
  function stop() { waypoints = []; }

  // 一步：想往 d 走，前面有物件就沿著它的邊滑過去
  function step(d, len, dt) {
    var move = Math.min(SPEED * dt, len);
    var dir = d.clone().normalize();
    var ahead = Math.min(len, 2.5);
    objects.forEach(function (o) {
      var need = o.radius + AVOID;
      var to = new THREE.Vector3().subVectors(o.pos, player.position); to.y = 0;
      var along = to.dot(dir);
      if (along <= 0 || along > ahead + need) return;                    // 在後面或太遠
      var side = Math.sqrt(Math.max(to.lengthSq() - along * along, 0));
      if (side >= need) return;                                          // 擦不到
      var tangent = new THREE.Vector3(-to.z, 0, to.x).normalize();       // 沿邊走
      if (tangent.dot(dir) < 0) tangent.negate();
      dir.copy(tangent);
      if (to.length() < need + 0.2) dir.add(to.clone().normalize().multiplyScalar(-0.5)).normalize();  // 太貼就往外一點
    });
    player.position.add(dir.multiplyScalar(move));
    player.rotation.y = Math.atan2(dir.x, dir.z);
    // 硬推：不管怎樣都不會站進物件裡
    objects.forEach(function (o) {
      var dx = player.position.x - o.pos.x, dz = player.position.z - o.pos.z, dd = Math.hypot(dx, dz), need = o.radius + AVOID;
      if (dd < need && dd > 0.001) { player.position.x = o.pos.x + dx / dd * need; player.position.z = o.pos.z + dz / dd * need; }
    });
  }

  // 傳送門開在空地上：從最近的物件往外推，不會開在建築裡
  function showPortal() {
    var dir = new THREE.Vector3(0, 0, 1), nd = Infinity;
    objects.forEach(function (o) {
      var d = player.position.distanceTo(o.pos);
      if (d < nd) { nd = d; dir.subVectors(player.position, o.pos); dir.y = 0; }
    });
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    portal.position.copy(player.position).add(dir.normalize().multiplyScalar(3.2));
    portal.position.y = 1.8;
    portal.visible = true;
  }
  function hidePortal() { portal.visible = false; }

  /* ---------- 每一格：走、看、算 ---------- */
  var stuck = 0;
  function loop() {
    requestAnimationFrame(loop);
    var dt = Math.min(clock.getDelta(), 0.05);
    if (waypoints.length) {
      var t = waypoints[0];
      var d = new THREE.Vector3().subVectors(t, player.position); d.y = 0;
      var len = d.length();
      if (len < 0.12) { waypoints.shift(); stuck = 0; }
      else {
        var before = player.position.clone();
        step(d, len, dt);
        stuck = player.position.distanceTo(before) < SPEED * dt * 0.2 ? stuck + dt : 0;
        if (stuck > 1.2) { waypoints.shift(); stuck = 0; }        // 卡住就放棄這個點
      }
    }
    detect();
    drawArc();
    drawLabels();
    if (portal.visible) { portal.children[1].lookAt(camera.position); portal.children[2].lookAt(camera.position); }
    var want = new THREE.Vector3().copy(player.position).add(camOffset());
    camera.position.lerp(want, gesture ? 0.5 : 0.08);
    camera.lookAt(player.position.x, 1, player.position.z);
    renderer.render(scene, camera);
  }

  function detect() {
    var nearest = null, nd = Infinity;
    objects.forEach(function (o) {
      var dx = player.position.x - o.pos.x, dz = player.position.z - o.pos.z;
      var dist = Math.hypot(dx, dz);
      // 靠近：顯示這是什麼功能
      if (dist < o.radius + 3.5 && dist < nd) { nearest = o; nd = dist; }
      // 到達：走到邊上
      var arriveR = o.radius + 1.0;
      if (!o.arrived && dist < arriveR) { o.arrived = true; emit('arrive', o.data); }
      else if (o.arrived && dist > arriveR + 1.2) o.arrived = false;
      // 繞圈：在圈內累積轉過的角度，離開時結算
      var ringR = o.radius + 3.0;
      var ang = Math.atan2(dz, dx);
      if (dist < ringR) {
        if (!o.inside) { o.inside = true; o.turned = 0; o.count = 0; o.startAngle = ang; }
        else {
          var da = ang - o.angle;
          if (da > Math.PI) da -= Math.PI * 2; else if (da < -Math.PI) da += Math.PI * 2;
          o.turned += da;
          if (Math.abs(o.turned) >= Math.PI * 2 - 0.05) { o.count++; o.turned = 0; o.startAngle = ang; emit('turn', o.data, o.count); }
        }
        o.angle = ang;
      } else if (o.inside) {
        o.inside = false;
        if (o.count > 0) emit('circle', o.data, o.count);
        o.count = 0; o.turned = 0;
      }
    });
    var nid = nearest ? nearest.data.id : null;
    if (nid !== detect.lastNear) { detect.lastNear = nid; emit('near', nearest ? nearest.data : null); }
  }

  // 進度弧：正在繞的那個物件，地上畫出已經轉了多少
  var arcKey = '';
  function drawArc() {
    var o = null;
    for (var i = 0; i < objects.length; i++) if (objects[i].inside && Math.abs(objects[i].turned) > 0.05 && arcOk(objects[i])) { o = objects[i]; break; }
    if (!o) { arc.visible = false; arcKey = ''; return; }
    var key = o.data.id + ':' + o.turned.toFixed(2);
    if (key === arcKey) return;
    arcKey = key;
    var r = o.radius + 1.4;
    // RingGeometry 的角度在旋轉後方向相反，所以取負
    var len = Math.abs(o.turned);
    var start = o.turned > 0 ? -o.startAngle - o.turned : -o.startAngle;
    arc.geometry.dispose();
    arc.geometry = new THREE.RingGeometry(r - 0.18, r + 0.18, Math.max(8, Math.ceil(len * 10)), 1, start, len);
    arc.position.set(o.pos.x, 0.03, o.pos.z);
    arc.visible = true;
  }
  var arcFilter = function () { return true; };
  function arcOk(o) { return arcFilter(o.data); }
  function setArcFilter(fn) { arcFilter = fn || function () { return true; }; }

  // 名稱標籤：投影到物件頂上
  var v = new THREE.Vector3();
  function drawLabels() {
    var w = hostEl.clientWidth, h = hostEl.clientHeight;
    objects.forEach(function (o) {
      v.set(o.pos.x, o.top + 0.7, o.pos.z).project(camera);
      var ok = v.z < 1 && v.x > -1.1 && v.x < 1.1 && v.y > -1.1 && v.y < 1.1;
      o.label.hidden = !ok;
      if (ok) o.label.style.transform = 'translate(-50%,-100%) translate(' + ((v.x + 1) / 2 * w).toFixed(0) + 'px,' + ((1 - v.y) / 2 * h).toFixed(0) + 'px)';
    });
  }

  function playerPos() { return { x: player.position.x, z: player.position.z }; }
  /* ---------- v7 加：點擊接手、指引光點、並排的角色、整個物件清單 ---------- */
  function setTapHook(fn) { tapHook = fn || null; }
  // 指引：一串光點，{x, z}；清空就傳空陣列
  function setGuide(points) {
    clear(guideGroup);
    (points || []).forEach(function (p, i) {
      var m = new THREE.Mesh(new THREE.CircleGeometry(0.35, 20), new THREE.MeshBasicMaterial({ color: i === 0 ? 0xffe28a : 0xa2731f, transparent: true, opacity: 0.85, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.04, p.z); guideGroup.add(m);
    });
  }
  function guideCount() { return guideGroup.children.length; }
  function showPartner(on) { if (on) { partner.position.copy(player.position).add(new THREE.Vector3(1.4, 0, 0)); partner.lookAt(player.position.x, 0, player.position.z); } partner.visible = !!on; }
  function objectAt(id) { var o = objects.find(function (x) { return x.data.id === id; }); return o ? { x: o.pos.x, z: o.pos.z, radius: o.radius } : null; }
  function movePlayerTo(x, z) { player.position.set(x, 0, z); waypoints = []; }
  // 把世界座標（或物件 id）投影成畫面上的像素位置；建造模式測試用真的點擊
  function screenOf(target) {
    var p = typeof target === 'string' ? (function () { var o = objects.find(function (x) { return x.data.id === target; }); return o ? new THREE.Vector3(o.pos.x, o.top / 2, o.pos.z) : null; })() : new THREE.Vector3(target.x, 0, target.z);
    if (!p) return null;
    var r = renderer.domElement.getBoundingClientRect(), v = p.clone().project(camera);
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }
  function isMoving() { return waypoints.length > 0; }
  function distanceTo(id) {
    var o = objects.find(function (x) { return x.data.id === id; });
    return o ? Math.hypot(player.position.x - o.pos.x, player.position.z - o.pos.z) - o.radius : Infinity;
  }
  function insideAny() {
    return objects.some(function (o) { return Math.hypot(player.position.x - o.pos.x, player.position.z - o.pos.z) < o.radius + AVOID - 0.05; });
  }

  return { available: true, setTapHook: setTapHook, setGuide: setGuide, guideCount: guideCount, showPartner: showPartner, objectAt: objectAt, movePlayerTo: movePlayerTo, screenOf: screenOf, init: init, on: on, loadWorld: loadWorld, refreshObject: refreshObject, walkTo: walkTo, circleAround: circleAround, enter: enter, leave: leave, depth: depth,
           stop: stop, showPortal: showPortal, hidePortal: hidePortal, flash: flash, setArcFilter: setArcFilter,
           playerPos: playerPos, isMoving: isMoving, distanceTo: distanceTo, insideAny: insideAny, resize: resize,
           camera: cam, zoomTo: zoomTo };
})();
