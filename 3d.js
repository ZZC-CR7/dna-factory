/* CRISPR-Cas9 三维分子视野 v2 —— 多阶段可互动分子动画（Three.js r128） */
(() => {
  const canvas = document.getElementById("d3canvas");
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const TAU = Math.PI * 2;
  const CLAMP = (v, a, b) => Math.max(a, Math.min(b, v));
  const EASE = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

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
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9db8c4, size: 1.1, transparent: true, opacity: .7, depthWrite: false })));
  })();

  /* ─────────────── DNA 双螺旋 ─────────────── */
  const helix = new THREE.Group();
  scene.add(helix);
  const R = 15, HALF = 74, TURNS = 3.4, N = 56;
  const BASE_COLORS = [0x65c1c9, 0xdfa860, 0x729bca, 0xb27daf];
  const cutIdx = 35;

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

  const rungs = [];
  for (let i = 0; i < N; i++) {
    const a = ptsA[i], b = ptsB[i], col = BASE_COLORS[i % 4];
    const sph = new THREE.SphereGeometry(1.6, 12, 12);
    const matA = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .35, roughness: .4 });
    const matB = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .35, roughness: .4 });
    const pam = i >= 34 && i <= 36;
    if (pam) {
      matA.color.set(0xe8b875); matB.color.set(0xe8b875);
      matA.emissive.set(0x6b4a1e); matB.emissive.set(0x6b4a1e);
    }
    const m1 = new THREE.Mesh(sph, matA), m2 = new THREE.Mesh(sph, matB);
    m1.position.copy(a); m2.position.copy(b);
    const labelTxt = pam ? "PAM · AGG 区域" : "碱基对 · " + "ATCG"[i % 4] + " 配对";
    m1.userData = { part: "rung", label: labelTxt };
    m2.userData = { part: "rung", label: labelTxt };
    const dir = new THREE.Vector3().subVectors(b, a);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, dir.length(), 6),
      new THREE.MeshStandardMaterial({ color: pam ? 0xc99a5b : 0x55636e, roughness: .5 }));
    cyl.position.copy(a).addScaledVector(dir, .5);
    cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    helix.add(m1); helix.add(m2); helix.add(cyl);
    rungs.push({ m1, m2, cyl, idx: i, a: a.clone(), b: b.clone(), pam });
  }
  const cutCenter = new THREE.Vector3().copy(ptsA[cutIdx]).lerp(ptsB[cutIdx], .5);
  const cutDir = new THREE.Vector3().subVectors(ptsB[cutIdx], ptsA[cutIdx]).normalize();

  function makeLabel(text, color, size) {
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 96;
    const g = cv.getContext("2d");
    g.fillStyle = color; g.font = "600 56px 'Microsoft YaHei UI', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, 256, 50);
    const tex = new THREE.CanvasTexture(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(size[0], size[1], 1);
    return sp;
  }
  const pamLabel = makeLabel("PAM · AGG", "#e8b875", [42, 8]);
  pamLabel.position.copy(cutCenter).add(new THREE.Vector3(0, 10, 0));
  helix.add(pamLabel);

  /* ─────────────── Cas9 + 向导 RNA ─────────────── */
  const cas9 = new THREE.Group();
  scene.add(cas9);
  [[0,0,0,7.5],[-9,5,3,5],[9,4,-2,5.5],[4,-7,-4,4.5],[-5,-6,4,4.8],[0,9,-5,4.2],[-3,2,-8,4]].forEach(([x,y,z,r]) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1),
      new THREE.MeshStandardMaterial({ color: 0x7fc9d5, emissive: 0x0e2f38, emissiveIntensity: .55, roughness: .28, metalness: .1 }));
    m.position.set(x, y, z);
    m.userData = { part: "cas9", label: "Cas9 核酸酶（示意）" };
    cas9.add(m);
  });
  const cas9Home = new THREE.Vector3(95, 30, 40);
  cas9.position.copy(cas9Home);

  const guide = new THREE.Line(new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x91d0ae, transparent: true, opacity: .95 }));
  guide.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(30 * 3), 3));
  guide.userData = { part: "guide", label: "向导 RNA · 20 nt 配对区" };
  scene.add(guide);
  function setGuide(from, to, strength) {
    const pos = guide.geometry.attributes.position;
    for (let i = 0; i < 30; i++) {
      const t = i / 29;
      const p = new THREE.Vector3().lerpVectors(from, to, t);
      p.y += (Math.sin(t * Math.PI) * 14 + Math.sin(t * 22) * 2.2) * strength;
      p.x += Math.cos(t * 12) * 2 * strength;
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
  }
  setGuide(cas9Home, cutCenter, .12);

  /* ─────────────── 配对字母（S2） ─────────────── */
  const letterGroup = new THREE.Group();
  scene.add(letterGroup);
  const pairTop = "TGGCAT".split(""), pairRna = "ACCGUA".split("");
  let letterSprites = [];
  function buildLetters() {
    letterGroup.clear();
    letterSprites = [];
    for (let i = 0; i < 6; i++) {
      const idx = cutIdx - 2 + i;
      const a = ptsA[idx], b = ptsB[idx];
      const mid = new THREE.Vector3().copy(a).lerp(b, .5);
      const base = makeLabel(pairTop[i], "#dce8ee", [9, 9]);
      base.position.copy(a).addScaledVector(cutDir, -11);
      const rna = makeLabel(pairRna[i], "#91d0ae", [9, 9]);
      rna.position.copy(b).addScaledVector(cutDir, 11);
      letterGroup.add(base); letterGroup.add(rna);
      const line = new THREE.Line(new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: 0xb7a2e4, transparent: true, opacity: .8 }));
      const lp = new Float32Array(6);
      const p1 = new THREE.Vector3().copy(a).addScaledVector(cutDir, -9);
      const p2 = new THREE.Vector3().copy(b).addScaledVector(cutDir, 9);
      lp.set([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z]);
      line.geometry.setAttribute("position", new THREE.BufferAttribute(lp, 3));
      letterGroup.add(line);
      letterSprites.push(base, rna, line);
    }
  }
  const pairLabel = makeLabel("向导 RNA · 20 nt 与靶序列互补配对", "#b7a2e4", [64, 10]);
  pairLabel.position.copy(cutCenter).add(new THREE.Vector3(0, 26, 0));
  letterGroup.add(pairLabel);

  /* ─────────────── 供体 DNA（S4 HDR） ─────────────── */
  const donor = new THREE.Group();
  scene.add(donor);
  (() => {
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const t = i / 11, a = t * Math.PI * 2.4, y = -13 + t * 26;
      pts.push(new THREE.Vector3(Math.cos(a) * 3.2, y, Math.sin(a) * 3.2));
    }
    for (const ph of [0, Math.PI]) {
      const p2 = pts.map(p => new THREE.Vector3(p.x, p.y + (ph ? 0 : 0), p.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0));
      const curve = new THREE.CatmullRomCurve3(pts.map(p => {
        const q = p.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0);
        return q;
      }), false);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, .5, 6),
        new THREE.MeshStandardMaterial({ color: 0x91d0ae, emissive: 0x12382a, emissiveIntensity: .6, roughness: .35 }));
      tube.rotation.y = ph;
      donor.add(tube);
    }
    const donLabel = makeLabel("供体 DNA · 修复模板", "#a0d7b5", [36, 8]);
    donLabel.position.set(0, 32, 0);
    donor.add(donLabel);
  })();
  donor.visible = false;

  /* ─────────────── 粒子 ─────────────── */
  const P_N = 90;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(P_N * 3);
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xffb37e, size: 2.2, transparent: true, opacity: 0, depthWrite: false });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);
  const pVel = [];
  function spawnBurst() {
    for (let i = 0; i < P_N; i++) {
      pPos[i * 3] = cutCenter.x; pPos[i * 3 + 1] = cutCenter.y; pPos[i * 3 + 2] = cutCenter.z;
      const a = Math.random() * TAU, z = Math.random() * Math.PI;
      pVel[i] = new THREE.Vector3(Math.sin(z) * Math.cos(a), Math.cos(z), Math.sin(z) * Math.sin(a)).multiplyScalar(18 + Math.random() * 30);
    }
    pGeo.attributes.position.needsUpdate = true;
    pMat.opacity = 1;
  }

  /* ─────────────── 相机轨道 ─────────────── */
  const cam = { yaw: .7, pitch: .32, dist: 165, target: new THREE.Vector3(0, 0, 0) };
  const camGoal = { yaw: .7, pitch: .32, dist: 165, target: new THREE.Vector3(0, 0, 0) };
  function applyCam() {
    cam.yaw += (camGoal.yaw - cam.yaw) * .04;
    cam.pitch += (camGoal.pitch - cam.pitch) * .04;
    cam.dist += (camGoal.dist - cam.dist) * .05;
    cam.target.lerp(camGoal.target, .06);
    camera.position.set(
      cam.target.x + cam.dist * Math.cos(cam.pitch) * Math.sin(cam.yaw),
      cam.target.y + cam.dist * Math.sin(cam.pitch),
      cam.target.z + cam.dist * Math.cos(cam.pitch) * Math.cos(cam.yaw)
    );
    camera.lookAt(cam.target);
  }
  let dragging = false, lastX = 0, lastY = 0, pinchD = 0, moved = 0;
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
    if (e.touches && e.touches.length === 2) {
      const [a, b] = e.touches; pinchD = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    if (e.touches && e.touches.length === 2) {
      const [a, b] = e.touches;
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinchD > 0) { cam.dist = camGoal.dist = CLAMP(cam.dist * pinchD / d, 70, 340); }
      pinchD = d; moved = 99; return;
    }
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) < 2) return;
    moved += Math.abs(dx) + Math.abs(dy);
    cam.yaw = camGoal.yaw = cam.yaw - dx * .005;
    cam.pitch = camGoal.pitch = CLAMP(cam.pitch - dy * .005, -1.25, 1.25);
  });
  canvas.addEventListener("pointerup", (e) => {
    dragging = false;
    if (moved < 6 && state.mode === "observe") pick(e);
  });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    cam.dist = camGoal.dist = CLAMP(cam.dist * (1 + e.deltaY * .0012), 70, 340);
  }, { passive: false });

  /* ─────────────── 分步状态机 ─────────────── */
  const STEPS = [
    { id: "search", title: "Cas9 沿 DNA 扫描 PAM", text: "Cas9·向导 RNA 复合体沿 DNA 滑动搜索，遇到 PAM 基序（NGG）即停下。", plain: "白话：像快递员拿着地址沿街找门牌——Cas9 带着「向导」在 DNA 上寻找匹配位点。", dur: 6000 },
    { id: "unwind", title: "识别并局部解链", text: "PAM 匹配后，靶位点的双链局部解开，形成转录泡样开口。", plain: "白话：找到目标后，DNA 像拉链一样被拉开一小段，露出里面的碱基。", dur: 3600 },
    { id: "pair", title: "向导 RNA 与靶序列配对", text: "向导区 20 个碱基与靶 DNA 互补配对（A–U、C–G），形成 R-loop。", plain: "白话：向导 RNA 的 20 个字母与目标序列逐个对号入座（A 对 U、C 对 G）。", dur: 3400 },
    { id: "cut", title: "HNH / RuvC 切开双链", text: "两个核酸酶结构域分别切断两条链，形成双链断裂。", plain: "白话：Cas9 像剪刀一样，把 DNA 的两条链同时剪断。", dur: 3600 },
    { id: "repair", title: "选择修复路径", text: "细胞有两种修复方式：NHEJ 直接连接（常产生小片段缺失），或 HDR 借助供体模板精准修复。", plain: "白话：细胞赶紧补缺口——NHEJ 直接粘（可能粘坏几个字），HDR 照着模板重写（精准）。", dur: 0 },
    { id: "done", title: "基因编辑完成", text: "修复完成——这正是基因编辑的起点：敲除、修正或替换一段遗传信息。", plain: "白话：基因被敲除或改写——这就是基因编辑。", dur: 0 }
  ];
  const state = { mode: "observe", step: -1, phase: 0, auto: false, repair: null, burstDone: false, guide: false, guideDoneAt: 0 };

  function stepInfo(s) {
    const st = STEPS[s];
    $("#d3infoTag").textContent = "步骤 " + (s + 1) + " / " + STEPS.length;
    $("#d3infoTitle").textContent = st.title;
    $("#d3infoText").textContent = st.text;
    $("#d3plain").textContent = st.plain || "";
    $("#d3status").textContent = state.mode === "observe" ? "自由观察模式" : st.title;
  }
  function renderDots() {
    const box = $("#d3dots");
    box.innerHTML = "";
    STEPS.forEach((st, i) => {
      const d = document.createElement("i");
      d.className = i < state.step ? "done" : i === state.step ? "now" : "";
      d.title = st.title;
      d.addEventListener("click", () => { state.auto = false; updateAutoBtn(); goStep(i); });
      box.append(d);
    });
  }
  function goStep(s) {
    state.step = CLAMP(s, -1, STEPS.length - 1);
    state.phase = 0; state.burstDone = false;
    if (state.step === 4) { $("#d3repair").hidden = false; }
    else $("#d3repair").hidden = true;
    if (state.step >= 0) stepInfo(state.step);
    setCamForStep(state.step);
    renderDots();
  }
  function setCamForStep(s) {
    if (s < 0) { camGoal.target.set(0, 0, 0); camGoal.dist = 165; camGoal.pitch = .32; camGoal.yaw = .7; return; }
    if (s <= 3) {
      camGoal.target.copy(cutCenter).add(new THREE.Vector3(0, 4, 0));
      camGoal.dist = 92; camGoal.pitch = .28; camGoal.yaw = .9;
    } else {
      camGoal.target.copy(cutCenter).add(new THREE.Vector3(0, 6, 0));
      camGoal.dist = 120; camGoal.pitch = .3; camGoal.yaw = .95;
    }
  }
  function updateAutoBtn() {
    const b = $("#sAuto");
    b.textContent = state.auto ? "⏹ 停止" : "▶ 自动播放";
    b.classList.toggle("active", state.auto);
  }
  function resetAll() {
    state.mode = "observe"; state.step = -1; state.phase = 0; state.auto = false; state.repair = null; state.burstDone = false;
    cas9.position.copy(cas9Home);
    setGuide(cas9Home, cutCenter, .12);
    rungs.forEach(r => {
      r.m1.position.copy(r.a); r.m2.position.copy(r.b); r.cyl.visible = true;
      r.cyl.scale.set(1, 1, 1);
      const col = r.pam ? 0xe8b875 : BASE_COLORS[r.idx % 4];
      r.m1.material.color.set(col); r.m2.material.color.set(col);
    });
    letterGroup.visible = false;
    donor.visible = false;
    flashLight.intensity = 0;
    pMat.opacity = 0;
    $("#d3repair").hidden = true;
    $("#d3infoTag").textContent = "点击场景中的结构";
    $("#d3infoTitle").textContent = "选择一个部件";
    $("#d3infoText").textContent = "拖拽旋转视角，点击结构查看说明；点「▶ 自动播放」观看完整编辑流程。";
    $("#d3status").textContent = "自由观察模式";
    setCamForStep(-1);
    renderDots(); updateAutoBtn();
  }
  function chooseRepair(kind) {
    state.repair = kind;
    state.phase = 0;
    if (state.guide) state.guideDoneAt = performance.now();
    goStep(5);
    if (kind === "nhej") {
      for (let i = cutIdx - 1; i <= cutIdx + 1; i++) {
        const r = rungs[i];
        if (r) {
          r.cyl.visible = false;
          r.m1.material.color.set(0xf08d76); r.m2.material.color.set(0xf08d76);
        }
      }
    } else {
      donor.visible = true;
      donor.position.copy(cutCenter).add(new THREE.Vector3(-70, 0, 40));
      for (let i = cutIdx - 2; i <= cutIdx + 2; i++) {
        const r = rungs[i];
        if (r) { r.m1.material.color.set(0x91d0ae); r.m2.material.color.set(0x91d0ae); }
      }
    }
  }

  /* ─────────────── 分步动画 ─────────────── */
  function stepUpdate(dt, t) {
    const s = state.step, p = state.phase;
    if (s === 0) { // 搜索：沿螺旋滑动
      const prog = EASE(CLAMP(p / STEPS[0].dur * 6000, 0, 1));
      const start = 0.12, end = 0.62;
      const u = start + (end - start) * prog;
      const idx = Math.floor(u * (N - 1));
      const a = ptsA[idx], b = ptsB[idx];
      const pos = new THREE.Vector3().copy(a).lerp(b, .5).add(new THREE.Vector3(0, 0, 26));
      cas9.position.copy(pos);
      setGuide(cas9.position, cutCenter, .3);
    } else if (s === 1) { // 局部解链
      const k = EASE(CLAMP(p / STEPS[1].dur * 3600, 0, 1));
      cas9.position.copy(cutCenter).add(new THREE.Vector3(22, 8 + Math.sin(t / 90) * 1, 18));
      setGuide(cas9.position, cutCenter, 1);
      rungs.forEach(r => {
        const d = r.idx >= cutIdx - 5 && r.idx <= cutIdx + 5 ? Math.sin(CLAMP((r.idx - (cutIdx - 5)) / 10, 0, 1) * Math.PI) * 6.5 * k : 0;
        if (d > .01) {
          r.m1.position.copy(r.a).add(new THREE.Vector3(0, d, 0));
          r.m2.position.copy(r.b).add(new THREE.Vector3(0, -d, 0));
          if (r.idx >= cutIdx - 3 && r.idx <= cutIdx + 3) r.cyl.visible = false;
        }
      });
    } else if (s === 2) { // 配对字母
      cas9.position.copy(cutCenter).add(new THREE.Vector3(22, 8 + Math.sin(t / 90) * 1, 18));
      setGuide(cas9.position, cutCenter, 1);
      if (!letterGroup.visible) { buildLetters(); letterGroup.visible = true; }
      letterGroup.children.forEach((ch, i) => { ch.scale.setScalar(CLAMP(p * 2.4 - i * .06, 0, 1)); });
      letterGroup.children.forEach(ch => { if (ch.isSprite) ch.scale.set(ch.scale.x, ch.scale.y, 1); });
    } else if (s === 3) { // 切割
      const k = CLAMP(p / STEPS[3].dur * 3600, 0, 1);
      if (!state.burstDone && k > .25) { spawnBurst(); state.burstDone = true; flashLight.position.copy(cutCenter); }
      flashLight.intensity = state.burstDone ? 12 * (1 - k) : 0;
      pMat.opacity = state.burstDone ? CLAMP(1.1 - k * 1.2, 0, 1) : 0;
      letterGroup.children.forEach(ch => { if (ch.isSprite) ch.material.opacity = 1 - k; });
      const cut = EASE(k);
      rungs.forEach(r => {
        const d = r.idx >= cutIdx - 4 && r.idx <= cutIdx + 4 ? Math.sin(CLAMP((r.idx - (cutIdx - 4)) / 8, 0, 1) * Math.PI) * 7 * cut : 0;
        if (d > .01) {
          r.m1.position.copy(r.a).addScaledVector(cutDir, -d).add(new THREE.Vector3(0, 6.5 * cut, 0));
          r.m2.position.copy(r.b).addScaledVector(cutDir, d).add(new THREE.Vector3(0, -6.5 * cut, 0));
          r.cyl.visible = false;
        }
      });
    } else if (s === 5) { // 修复
      if (state.repair === "nhej") {
        const k = EASE(p);
        rungs.forEach(r => {
          const inGap = r.idx >= cutIdx - 1 && r.idx <= cutIdx + 1;
          const d = inGap ? 0 : (r.idx >= cutIdx - 4 && r.idx <= cutIdx + 4 ? Math.sin(CLAMP((r.idx - (cutIdx - 4)) / 8, 0, 1) * Math.PI) * 7 : 0);
          const dd = d * (1 - k);
          if (Math.abs(dd) > .01) {
            r.m1.position.copy(r.a).addScaledVector(cutDir, -dd).add(new THREE.Vector3(0, 6.5 * (1 - k), 0));
            r.m2.position.copy(r.b).addScaledVector(cutDir, dd).add(new THREE.Vector3(0, -6.5 * (1 - k), 0));
          } else { r.m1.position.copy(r.a); r.m2.position.copy(r.b); }
          if (!inGap && k < .5) r.cyl.visible = r.idx < cutIdx - 4 || r.idx > cutIdx + 4;
          if (k >= .5 && !inGap) r.cyl.visible = true;
        });
        if (k > .6) {
          $("#d3infoTitle").textContent = "NHEJ · 直接连接完成";
          $("#d3infoText").textContent = "断裂末端直接连接，中间出现小片段缺失（indel）——可能造成基因敲除。";
          $("#d3plain").textContent = "白话：像胶带直接粘上，中间少/多了几个字母——基因被「敲除」。";
        }
      } else if (state.repair === "hdr") {
        const k = EASE(p);
        donor.position.lerpVectors(
          new THREE.Vector3().copy(cutCenter).add(new THREE.Vector3(-70, 0, 40)),
          new THREE.Vector3().copy(cutCenter).add(new THREE.Vector3(6, 0, 14)), k);
        if (k > .55) {
          rungs.forEach(r => {
            const inZone = r.idx >= cutIdx - 2 && r.idx <= cutIdx + 2;
            if (inZone) {
              r.m1.position.copy(r.a).add(new THREE.Vector3(0, 6.5 * (1 - (k - .55) / .45), 0));
              r.m2.position.copy(r.b).add(new THREE.Vector3(0, -6.5 * (1 - (k - .55) / .45), 0));
              r.cyl.visible = true;
            }
          });
          donor.visible = k < .92;
        }
        if (k > .75) {
          $("#d3infoTitle").textContent = "HDR · 模板介导精准修复";
          $("#d3infoText").textContent = "供体 DNA 经同源臂配对引导修复，目标序列被精准替换（绿色区域）。";
          $("#d3plain").textContent = "白话：照着供体模板，把断裂处按正确内容重新写回。";
        }
      }
    }
  }

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
    cas9.rotation.y += dt * .0008;

    if (state.mode === "demo" && state.step >= 0) {
      stepUpdate(dt, t);
      const dur = STEPS[state.step].dur * (state.guide ? .62 : 1);
      if (dur > 0) {
        state.phase += dt / dur;
        if (state.phase >= 1) {
          if (state.auto && state.step < 3) goStep(state.step + 1);
          else if (state.auto && state.step === 3) goStep(4);
          else if (state.step === 4) { /* 等待按钮 */ }
          else state.phase = 1;
        }
      } else if (state.step === 4 && state.guide) {
        // 30 秒导览：修复步骤自动选择 NHEJ
        state.phase += dt / 1600;
        if (state.phase >= 1) chooseRepair("nhej");
      }
    } else if (state.mode === "observe" && state.step < 0 && cas9.position.distanceTo(cas9Home) > .01) {
      cas9.position.lerp(cas9Home, .03);
      setGuide(cas9.position, cutCenter, .12);
    }
    if (state.guide && state.step === 5 && state.guideDoneAt && performance.now() - state.guideDoneAt > 4500 && q.get("guide") === "1") {
      location.href = "app.html?auto=1";
      return;
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
    cas9: "Cas9 与向导 RNA 组成复合体：识别 PAM 后，在靶位点切开 DNA 双链（示意模型）。",
    guide: "向导 RNA 前 20 个碱基与靶序列互补配对，把 Cas9 引导到目标位点。"
  };

  /* ─────────────── 控件 ─────────────── */
  $("#modeObserve").addEventListener("click", () => { state.mode = "observe"; state.auto = false; updateAutoBtn(); $("#d3status").textContent = "自由观察模式"; });
  $("#modeGuide").addEventListener("click", () => { $("#d3guide").hidden = false; });
  $("#guideStart").addEventListener("click", () => {
    $("#d3guide").hidden = true;
    state.guide = true; state.mode = "demo"; state.auto = true; state.repair = null;
    updateAutoBtn(); goStep(0);
    $("#d3status").textContent = "30 秒导览播放中…";
  });
  $("#guideClose").addEventListener("click", () => { $("#d3guide").hidden = true; $("#d3status").textContent = "自由观察模式"; });
  $("#modeDemo").addEventListener("click", () => { state.mode = "demo"; state.auto = true; updateAutoBtn(); goStep(0); });
  $("#modeReset").addEventListener("click", resetAll);
  $("#sPrev").addEventListener("click", () => { state.auto = false; updateAutoBtn(); if (state.step <= 0) { resetAll(); return; } goStep(state.step - 1); });
  $("#sNext").addEventListener("click", () => { state.auto = false; updateAutoBtn(); if (state.step < 0) goStep(0); else goStep(Math.min(STEPS.length - 2, state.step + 1)); });
  $("#sAuto").addEventListener("click", () => {
    if (state.auto) { state.auto = false; updateAutoBtn(); return; }
    state.mode = "demo"; state.auto = true; updateAutoBtn();
    if (state.step < 0 || state.step >= 5) goStep(0);
  });
  $("#sReset").addEventListener("click", resetAll);
  $("#repNHEJ").addEventListener("click", () => { state.mode = "demo"; state.phase = 0; chooseRepair("nhej"); });
  $("#repHDR").addEventListener("click", () => { state.mode = "demo"; state.phase = 0; chooseRepair("hdr"); });

  resetAll();
  const q = new URLSearchParams(location.search);
  if (q.get("guide") === "1") {
    setTimeout(() => {
      $("#d3guide").hidden = true;
      state.guide = true; state.mode = "demo"; state.auto = true; state.repair = null;
      updateAutoBtn(); goStep(0);
      $("#d3status").textContent = "答辩路线 · 30 秒导览播放中…";
    }, 900);
  } else {
    setTimeout(() => { if ($("#d3guide") && $("#d3guide").hidden) $("#d3guide").hidden = false; }, 1200);
  }
  requestAnimationFrame(loop);
})();
