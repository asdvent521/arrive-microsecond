/* ===== 畫面層：Three.js 照資料蓋世界 =====
 * 只讀資料、畫畫面、回報事件（靠近、到達、繞圈、點到傳送門）。規則都在 data.js。
 */
var WORLD = (function () {
  'use strict';
  var renderer, scene, camera, ground, objGroup, pathGroup, portal, player, clock;
  var objects = [];          // [{data, mesh, radius, pos:Vector3, near:false, inside:false, angle, turned}]
  var waypoints = [];
  var handlers = {};
  var SPEED = 5;
  var camOffset = new THREE.Vector3(0, 16, 14);
  var raycaster = new THREE.Raycaster();
  var pointer = new THREE.Vector2();
  var down = null;
  var hostEl;

  function on(name, fn) { handlers[name] = fn; }
  function emit(name, a, b) { if (handlers[name]) handlers[name](a, b); }

  function init(host) {
    hostEl = host;
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdfe6ec);
    scene.fog = new THREE.Fog(0xdfe6ec, 40, 90);
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

    var hemi = new THREE.HemisphereLight(0xffffff, 0x8d9aa8, 0.9);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xfff4e0, 0.8);
    sun.position.set(10, 20, 8);
    scene.add(sun);

    ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshLambertMaterial({ color: 0xcfd8df }));
    ground.rotation.x = -Math.PI / 2;
    ground.name = 'ground';
    scene.add(ground);
    var grid = new THREE.GridHelper(120, 60, 0xb9c4cd, 0xc4ced6);
    grid.position.y = 0.01;
    scene.add(grid);

    objGroup = new THREE.Group(); scene.add(objGroup);
    pathGroup = new THREE.Group(); scene.add(pathGroup);

    // 角色：圓柱身體 + 球頭
    player = new THREE.Group();
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 16), new THREE.MeshLambertMaterial({ color: 0x2d5a86 }));
    body.position.y = 0.6;
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), new THREE.MeshLambertMaterial({ color: 0xf1e4c8 }));
    head.position.y = 1.55;
    player.add(body); player.add(head);
    scene.add(player);

    // 白光傳送門：發光的環
    portal = new THREE.Group();
    var ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 12, 40), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    var glow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 9, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 2.6;
    portal.add(beam); portal.add(ring); portal.add(glow);
    portal.position.y = 1.8;
    portal.visible = false;
    scene.add(portal);

    clock = new THREE.Clock();
    resize();
    window.addEventListener('resize', resize);
    var el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', function (e) {
      if (!down) return;
      var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved < 12) tap(e.clientX, e.clientY);
    });
    requestAnimationFrame(loop);
  }

  function resize() {
    if (!hostEl) return;
    var w = hostEl.clientWidth || 1, h = hostEl.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    // 直式手機：鏡頭拉遠、視角開大，五個功能點才看得全
    var portrait = w < h;
    camera.fov = portrait ? 52 : 45;
    camOffset.set(0, portrait ? 27 : 16, portrait ? 23 : 14);
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
    g.userData.objectId = o.id;
    return g;
  }

  // world：角色的世界資料；opts.visiting：是傳送過去逛，畫出對方設定的路
  function loadWorld(world, opts) {
    opts = opts || {};
    clear(objGroup); clear(pathGroup);
    objects = world.objects.map(function (o) {
      var mesh = buildObject(o);
      objGroup.add(mesh);
      return { data: o, mesh: mesh, radius: DATA.radiusOf(o), pos: new THREE.Vector3(o.pos[0], 0, o.pos[1]),
               near: false, inside: false, arrived: false, angle: 0, turned: 0, count: 0 };
    });
    if (opts.visiting && world.path && world.path.length > 1) {
      for (var i = 0; i < world.path.length - 1; i++) {
        var a = world.path[i], b = world.path[i + 1];
        var dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
        var seg = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 1.2), new THREE.MeshLambertMaterial({ color: 0xf3e9d2 }));
        seg.position.set((a[0] + b[0]) / 2, 0.03, (a[1] + b[1]) / 2);
        seg.rotation.y = -Math.atan2(dz, dx);
        pathGroup.add(seg);
      }
    }
    var st = world.start || [0, 0];
    player.position.set(st[0], 0, st[1]);
    waypoints = [];
    hidePortal();
    var col = new THREE.Color(opts.visiting ? 0x5c6670 : 0x2d5a86);
    player.children[0].material.color = col;
    scene.background = new THREE.Color(opts.visiting ? 0xe4e0d6 : 0xdfe6ec);
    scene.fog.color = scene.background;
    camera.position.copy(player.position).add(camOffset);
    camera.lookAt(player.position);
  }

  function refreshObject(id) {
    var o = objects.find(function (x) { return x.data.id === id; });
    if (!o) return;
    objGroup.remove(o.mesh);
    o.mesh = buildObject(o.data);
    objGroup.add(o.mesh);
    o.radius = DATA.radiusOf(o.data);
    o.pos.set(o.data.pos[0], 0, o.data.pos[1]);
  }

  /* ---------- 走路 ---------- */
  function tap(cx, cy) {
    var r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((cx - r.left) / r.width) * 2 - 1;
    pointer.y = -((cy - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    if (portal.visible) {
      var hp = raycaster.intersectObject(portal, true);
      if (hp.length) { emit('portal'); return; }
    }
    var hits = raycaster.intersectObjects(objGroup.children, true);
    if (hits.length) {
      var id = hits[0].object.userData.objectId;
      var o = objects.find(function (x) { return x.data.id === id; });
      if (o) { walkTo(edgePoint(o)); return; }
    }
    var hg = raycaster.intersectObject(ground);
    if (hg.length) walkTo(hg[0].point);
  }
  function edgePoint(o) {
    var dir = new THREE.Vector3().subVectors(player.position, o.pos); dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(1, 0, 0);
    dir.normalize().multiplyScalar(o.radius + 0.6);
    return new THREE.Vector3().addVectors(o.pos, dir);
  }
  function walkTo(p) { waypoints = [new THREE.Vector3(p.x, 0, p.z)]; }
  function walkPath(points) { waypoints = points.map(function (p) { return new THREE.Vector3(p.x, 0, p.z); }); }
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
  function loop() {
    requestAnimationFrame(loop);
    var dt = Math.min(clock.getDelta(), 0.05);
    if (waypoints.length) {
      var t = waypoints[0];
      var d = new THREE.Vector3().subVectors(t, player.position); d.y = 0;
      var len = d.length();
      if (len < 0.08) waypoints.shift();
      else {
        var step = Math.min(SPEED * dt, len);
        player.position.add(d.normalize().multiplyScalar(step));
        player.rotation.y = Math.atan2(d.x, d.z);
      }
    }
    detect();
    if (portal.visible) { portal.children[1].lookAt(camera.position); portal.children[2].lookAt(camera.position); }
    var want = new THREE.Vector3().copy(player.position).add(camOffset);
    camera.position.lerp(want, 0.08);
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
        if (!o.inside) { o.inside = true; o.turned = 0; o.count = 0; }
        else {
          var da = ang - o.angle;
          if (da > Math.PI) da -= Math.PI * 2; else if (da < -Math.PI) da += Math.PI * 2;
          o.turned += da;
          if (Math.abs(o.turned) >= Math.PI * 2 - 0.05) { o.count++; o.turned = 0; emit('turn', o.data, o.count); }
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

  function playerPos() { return { x: player.position.x, z: player.position.z }; }
  function isMoving() { return waypoints.length > 0; }
  function distanceTo(id) {
    var o = objects.find(function (x) { return x.data.id === id; });
    return o ? Math.hypot(player.position.x - o.pos.x, player.position.z - o.pos.z) - o.radius : Infinity;
  }

  return { init: init, on: on, loadWorld: loadWorld, refreshObject: refreshObject, walkTo: walkTo, circleAround: circleAround,
           stop: stop, showPortal: showPortal, hidePortal: hidePortal, playerPos: playerPos, isMoving: isMoving,
           distanceTo: distanceTo, resize: resize };
})();
