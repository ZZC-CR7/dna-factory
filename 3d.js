/* CRISPR-Cas9 三维分子视野 —— Three.js r128（自托管，零依赖） */
(() => {
  const canvas = document.getElementById("d3canvas");
  const $ = (s) => document.querySelector(s);
  const TAU = Math.PI * 2;
  const CLAMP = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ─────────────── 场景基础 ─────────────── */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06101a);
  scene.fog = new THREE.FogExp2(0x06101a, 0.0014);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  scene.add(new THREE.AmbientLight(0x33475a, 1.1));
  const key = new THREE.DirectionalLight(0xcfe8f2, 1.15);
  key.position.set(80, 130, 70); scene.add(key);
  const rimA = new THREE.PointLight(0x7fc9d5, 1.1, 400); rimA.position.set(-90, 30, -70); scene.add(rimA);
  const rimB = new THREE.PointLight(0xe8b875, 0.9, 400); rimB.position.set(90, -20, 80); scene.add(rimB);
  const flashLight = new THREE.PointLight(0xffd9a0, 0, 260); scene.add(flashLight);

  // 星空粒子
  (() => {
    const n = 600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 170 + Math.random() * 120, th = Math.random() * TAU, ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0x9db8c4, size: 1.1, transparent: true, opacity: .7, depthWrite: false });
    scene.add(new THREE.Points(g, m));
  })();

  /* ─────────────── DNA 双螺旋 ─────────────── */
  const helix = new THREE.Group();
  scene.add(helix);
  const R = 15, HALF = 74, TURNS = 3.4, N = 56;
  const BASE_COLORS = [0x65c1c9, 0xdfa860, 0x729bca, 0xb27daf];
  const baseNames = ["A", "T", "C", "G"];
  const PAM_IDX = [34, 35, 36]; // PAM 区三个碱基对

  function strandPts(phase) {
    const pts = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1), a = t * TURNS * TAU + phase, y = -HALF + t * HALF * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R));
    }
    return pts;
  }
  const ptsA = strandPts(0), ptsB = strandPts(Math.PI);
  function makeTube(pts, color, emissive) {
    const curve = new THREE.CatmullRomCurve3(pts, false);
    const geo = new THREE.TubeGeometry(curve, 220, 0.85, 8);
    const mat = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: .45, roughness: .35, metalness: .15 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { part: "backbone", label: "糖—磷酸骨架" };
    return mesh;
  }
  helix.add(makeTube(ptsA, 0x67c2cc, 0x0e3a42));
  helix.add(makeTube(ptsB, 0xed8178, 0x3a1012));

  const rungs = []; // {meshA, meshB, cyl, idx}
  for (let i = 0; i < N; i++) {
    const a = ptsA[i], b = ptsB[i], col = BASE_COLORS[i % 4];
    const sph = new THREE.SphereGeometry(1.6, 12, 12);
    const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .35, roughness: .4 });
    const m1 = new THREE.Mesh(sph, mat), m2 = new THREE.Mesh(sph, mat.clone());
    m1.position.copy(a); m2.position.copy(b);
    const pam = PAM_IDX.includes(i);
    if (pam) { m1.material.color.set(0xe8b875); m2.material.color.set(0xe8b875); m1.material.emissive.set(0x6b4a1e); m2.material.emissive.set(0x6b4a1e); }
    m1.userData = { part: "rung", label: pam ? "PAM · AGG 区域" : "碱基对 · " + baseNames[i % 4] + " 配对" };
    m2.userData = { part: "rung", label: pam ? "PAM · AGG 区域" : "碱基对 · " + baseNames[i % 4] + " 配对" };
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const cylGeo = new THREE.CylinderGeometry(0.35, 0.35, len, 6);
    const cylMat = new THREE.MeshStandardMaterial({ color: pam ? 0xc99a5b : 0x55636e, roughness: .5 });
    const cyl = new THREE.Mesh(cylGeo, cylMat);
    cyl.position.copy(a).addScaledVector(dir, .5);
    cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    helix.add(m1); helix.add(m2); helix.add(cyl);
    rungs.push({ m1, m2, cyl, idx: i, a: a.clone(), b: b.clone() });
  }

  // PAM 悬浮标签
  function makeLabel(text, color) {
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 64;
    const g = cv.getContext("2d");
    g.fillStyle = color; g.font = "600 34px 'Microsoft YaHei UI', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, 128, 34);
    const tex = new THREE.CanvasTexture(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(42, 10.5, 1);
    return sp;
  }
  const pamLabel = makeLabel("PAM · AGG", "#e8b875");
  pamLabel.position.copy(ptsA[35]).lerp(ptsB[35], .5).add(new THREE.Vector3(0, 8, 0));
  helix.add(pamLabel);

  /* ─────────────── Cas9 蛋白（示意簇） + 向导 RNA ─────────────── */
  const cas9 = new THREE.Group();
  scene.add(cas9);
  const lobes = [[0, 0, 0, 7.5], [-9, 5, 3, 5], [9, 4, -2, 5.5], [4, -7, -4, 4.5], [-5, -6, 4, 4.8], [0, 9, -5, 4.2], [-3, 2, -8, 4]];
  lobes.forEach(([x, y, z, r]) => {
    const geo = new THREE.IcosahedronGeometry(r, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x7fc9d5, emissive: 0x0e2f38, emissiveIntensity: .55, roughness: .28, metalness: .1 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.userData = { part: "cas9", label: "Cas9 核酸酶（示意）" };
    cas9.add(m);
  });

  // 向导 RNA：每帧更新的线
  const guideGeo = new THREE.BufferGeometry();
  guideGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(30 * 3), 3));
  const guide = new THREE.Line(guideGeo, new THREE.LineBasicMaterial({ color: 0x91d0ae, transparent: true, opacity: .95 }));
  guide.userData = { part: "guide", label: "向导 RNA · 20 nt 配对区" };
  scene.add(guide);

  const cas9Home = new THREE.Vector3(95, 30, 40);
  cas9.position.copy(cas9Home);

  /* ─────────────── 切割粒子 ─────────────── */
  const P_N = 90;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(P_N * 3);
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xffb37e, size: 2.2, transparent: true, opacity: 0, depthWrite: false });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);
  let pVel = [];

  /* ─────────────── 相机（简易轨道） ─────────────── */
  let yaw = .7, pitch = .32, dist = 165;
  const target = new THREE.Vector3(0, 0, 0);
  function applyCam() {
    camera.position.set(
      target.x + dist * Math.cos(pitch) * Math.sin(yaw),
      target.y + dist * Math.sin(pitch),
      target.z + dist * Math.cos(pitch) * Math.cos(yaw)
    );
    camera.lookAt(target);
  }
  let dragging = false, lastX = 0, lastY = 0, pinchD = 0, moved = 0;
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
    if (e.pointerType === "touch" && e.touches && e.touches.length === 2) {
      const [a, b] = e.touches; pinchD = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    if (e.touches && e.touches.length === 2) {
      const [a, b] = e.touches;
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinchD > 0) dist = CLAMP(dist * pinchD / d, 70, 340);
      pinchD = d; moved = 99; return;
    }
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) < 2) return;
    moved += Math.abs(dx) + Math.abs(dy);
    yaw -= dx * .005;
    pitch = CLAMP(pitch - dy * .005, -1.25, 1.25);
  });
  canvas.addEventListener("pointerup", (e) => {
    dragging = false;
    if (moved < 6 && state.mode === "observe") pick(e);
  });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    dist = CLAMP(dist * (1 + e.deltaY * .0012), 70, 340);
  }, { passive: false });

  /* ─────────────── 状态与演示动画 ─────────────── */
  const state = { mode: "observe", phase: 0 };
  const cutIdx = 35;
  const cutTarget = new THREE.Vector3().copy(ptsA[cutIdx]).lerp(ptsB[cutIdx], .5);
  const cas9Target = new THREE.Vector3().copy(cutTarget).add(new THREE.Vector3(22, 8, 18));
  const cutDir = new THREE.Vector3().subVectors(ptsA[cutIdx], ptsB[cutIdx]).normalize();

  function setMode(m) {
    state.mode = m;
    if (m === "demo") { state.phase = 0; spawnParticles = false; }
    if (m === "reset") {
      state.mode = "observe"; state.phase = 0;
      rungs.forEach(r => { r.m1.position.copy(r.a); r.m2.position.copy(r.b); r.cyl.visible = true; });
      cas9.position.copy(cas9Home);
      pMat.opacity = 0;
    }
    document.querySelectorAll(".d3-modes button").forEach(b => b.classList.remove("active"));
    $("#" + (m === "demo" ? "modeDemo" : "modeObserve")).classList.add("active");
    $("#d3status").textContent = m === "demo" ? "演示动画播放中…" : "自由观察模式";
  }
  $("#modeObserve").addEventListener("click", () => setMode("observe"));
  $("#modeDemo").addEventListener("click", () => setMode("demo"));
  $("#modeReset").addEventListener("click", () => setMode("reset"));

  /* ─────────────── 点击拾取 ─────────────── */
  const ray = new THREE.Raycaster();
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width * 2 - 1, my = -(e.clientY - r.top) / r.height * 2 + 1;
    ray.setFromCamera(new THREE.Vector2(mx, my), camera);
    const hits = ray.intersectObjects(helix.children.concat(cas9.children, [guide]), true);
    if (hits.length) {
      const u = hits[0].object.userData;
      $("#d3infoTag").textContent = u.part === "cas9" ? "Cas9 复合体" : u.part === "guide" ? "向导 RNA" : "DNA 结构";
      $("#d3infoTitle").textContent = u.label.split(" · ")[0];
      $("#d3infoText").textContent = INFO[u.part] || u.label;
    }
  }
  const INFO = {
    backbone: "两条糖—磷酸骨架反向平行盘旋成双螺旋；碱基朝向内侧互补配对。",
    rung: "碱基对由氢键稳定：A 与 T、C 与 G 互补配对，携带遗传信息。",
    cas9: "Cas9 与向导 RNA 组成复合体：识别 PAM 后，在靶位点切开 DNA 双链（示意模型，非真实比例）。",
    guide: "向导 RNA 前 20 个碱基与靶序列互补配对，把 Cas9 引导到目标位点。"
  };

  /* ─────────────── 演示时间线 ─────────────── */
  let spawnParticles = false;
  function spawnBurst() {
    const c = new THREE.Vector3().copy(cutTarget);
    for (let i = 0; i < P_N; i++) {
      pPos[i * 3] = c.x; pPos[i * 3 + 1] = c.y; pPos[i * 3 + 2] = c.z;
      const a = Math.random() * TAU, z = Math.random() * Math.PI;
      pVel[i] = new THREE.Vector3(Math.sin(z) * Math.cos(a), Math.cos(z), Math.sin(z) * Math.sin(a)).multiplyScalar(18 + Math.random() * 30);
    }
    pGeo.attributes.position.needsUpdate = true;
    pMat.opacity = 1;
  }
  function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function updateDemo(dt, t) {
    const p = state.phase;
    if (p < .38) { // 接近
      const e = ease(CLAMP(p / .38, 0, 1));
      cas9.position.lerpVectors(cas9Home, cas9Target, e);
      setGuide(cas9.position, cutTarget, 0.35);
    } else if (p < .52) { // 结合：轻微脉冲
      const wob = Math.sin(t / 90) * 1.2;
      cas9.position.copy(cas9Target).add(new THREE.Vector3(0, wob, 0));
      setGuide(cas9.position, cutTarget, 1);
      $("#d3infoTag").textContent = "目标识别"; $("#d3infoTitle").textContent = "向导 RNA 与靶序列配对";
      $("#d3infoText").textContent = "向导区 20 nt 与靶 DNA 互补配对，邻近 PAM 匹配成功——Cas9 准备切割。";
      $("#d3status").textContent = "演示：识别靶位点";
    } else if (p < .62) { // 切割
      const k = (p - .52) / .1;
      if (!spawnParticles) { spawnBurst(); spawnParticles = true; flashLight.position.copy(cutTarget); }
      flashLight.intensity = 12 * (1 - k);
      pMat.opacity = CLAMP(1.2 - k * 1.4, 0, 1);
      rungs.forEach(r => {
        const d = r.idx >= cutIdx - 4 && r.idx <= cutIdx + 4 ? Math.sin(CLAMP((r.idx - (cutIdx - 4)) / 8, 0, 1) * Math.PI) * 7 * k : 0;
        if (d > .01) {
          r.m1.position.copy(r.a).addScaledVector(cutDir, -d);
          r.m2.position.copy(r.b).addScaledVector(cutDir, d);
          r.cyl.visible = false;
        }
      });
      $("#d3status").textContent = "演示：双链切开";
      $("#d3infoTag").textContent = "DNA 双链断裂"; $("#d3infoTitle").textContent = "剪刀已合拢";
      $("#d3infoText").textContent = "Cas9 的两个核酸酶结构域在 PAM 邻近切开两条 DNA 链，形成双链断裂。";
    } else { // 保持
      pMat.opacity = CLAMP(pMat.opacity - dt * .001, 0, 1);
      flashLight.intensity = Math.max(0, flashLight.intensity - dt * .02);
      $("#d3status").textContent = "演示完成 · 点击重置或自由观察";
      $("#d3infoTag").textContent = "断裂形成"; $("#d3infoTitle").textContent = "双链已分离";
      $("#d3infoText").textContent = "细胞将启动 NHEJ 或 HDR 修复——这正是基因编辑的起点。点击「↺ 重置」恢复双链。";
    }
    state.phase = Math.min(1, p + dt / 9000);
  }
  function setGuide(from, to, strength) {
    const pos = guide.geometry.attributes.position;
    for (let i = 0; i < 30; i++) {
      const t = i / 29;
      const p = new THREE.Vector3().lerpVectors(from, to, t);
      p.y += Math.sin(t * Math.PI) * 14 * strength + Math.sin(t * 22) * 2.2 * strength;
      p.x += Math.cos(t * 12) * 2 * strength;
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
  }
  setGuide(cas9Home, cutTarget, 0.12);

  /* ─────────────── 主循环 ─────────────── */
  let lastT = performance.now();
  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min(60, t - lastT); lastT = t;
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
    }
    camera.aspect = w / h; camera.updateProjectionMatrix();
    applyCam();

    helix.rotation.y += dt * .00012;
    helix.rotation.x = Math.sin(t / 9000) * .06;
    cas9.rotation.y += dt * .0008;
    if (state.mode === "demo") updateDemo(dt, t);
    if (state.mode !== "demo" && state.phase === 0 && cas9.position.distanceTo(cas9Home) > .01) {
      cas9.position.lerp(cas9Home, .03);
      setGuide(cas9.position, cutTarget, .12);
    }
    for (let i = 0; i < P_N; i++) {
      if (pVel[i]) {
        pPos[i * 3] += pVel[i].x * dt * .03;
        pPos[i * 3 + 1] += pVel[i].y * dt * .03;
        pPos[i * 3 + 2] += pVel[i].z * dt * .03;
      }
    }
    pGeo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
  }
  window.addEventListener("resize", () => {});
  setMode("observe");
  requestAnimationFrame(loop);
})();
