/* 工厂总览与工位特写，共用场景、设备和同一条物料路线。 */
(() => {
  "use strict";
  const bays = [
    { name: "AI 设计台", x: -6.4, z: 2.7 },
    { name: "生物反应器", x: -5.7, z: -2.55 },
    { name: "分离纯化", x: 0, z: -3.05 },
    { name: "光学质检", x: 5.8, z: -2.55 },
    { name: "包装交付", x: 5.75, z: 2.85 }
  ];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // 观察点用设备底座的局部坐标登记，镜头转动时引线仍指向同一部件。
  const observationPoints = [
    [
      ["候选结构", .83, 2.45, .12],
      ["模型比较屏", -.73, 2.42, -.37],
      ["工单签发", -.68, 1.64, .37]
    ], [
      ["物料入口", -1.20, 2.55, .40],
      ["搅拌叶", -.26, 1.81, .15],
      ["罐内目标蛋白", -.15, 1.94, .35],
      ["出料口", 1.47, 1.06, .72]
    ], [
      ["进样口", -.42, 2.79, .03],
      ["柱内组分带", .24, 2.12, .15],
      ["目标收集杯", -.25, .90, .98],
      ["送检样品", 1.45, 1.58, .79]
    ], [
      ["参比光路", -.34, 1.97, -.12],
      ["样品池", 0, 1.85, -.1],
      ["荧光接收窗", .38, 2.32, -.57],
      ["读数屏", .75, 2.70, -.56]
    ], [
      ["空瓶定位", -1.32, 1.75, 0],
      ["分装头", -.02, 2.20, .03],
      ["封装样品", 1.32, 1.85, 0]
    ]
  ];

  function createObservationMarker(layer) {
    const marker = document.createElement("div");
    marker.setAttribute("aria-hidden", "true");
    Object.assign(marker.style, { position:"absolute", inset:"0", pointerEvents:"none", visibility:"hidden" });
    const tag = document.createElement("span");
    const line = document.createElement("i");
    const ring = document.createElement("i");
    const positioned = { position:"absolute", top:"0", left:"0" };
    Object.assign(tag.style, positioned, {
      padding:"4px 8px", color:"#fff", background:"rgba(14,30,39,.95)",
      border:"1px solid #eef6f8", borderRadius:"4px", font:"600 13px/19px system-ui,sans-serif",
      whiteSpace:"nowrap", boxShadow:"0 1px 4px #16232e80"
    });
    Object.assign(line.style, positioned, {
      height:"1.5px", background:"#fff", transformOrigin:"0 50%", boxShadow:"0 1px 2px #10222d"
    });
    Object.assign(ring.style, positioned, {
      width:"10px", height:"10px", border:"2px solid white", borderRadius:"50%",
      boxSizing:"border-box", boxShadow:"0 0 0 1px #263e48, inset 0 0 0 1px #263e48"
    });
    marker.append(line, ring, tag);
    layer.append(marker);
    let previous = null, cardWidth = 0, cardHeight = 0, side = 1;
    function place(observation, x, y, width, height) {
      if (observation !== previous) {
        previous = observation;
        tag.textContent = observation[0];
        cardWidth = tag.offsetWidth;
        cardHeight = tag.offsetHeight;
        side = x < width / 2 ? -1 : 1;
        if (side < 0 && x < cardWidth + 39) side = 1;
        else if (side > 0 && width - x < cardWidth + 39) side = -1;
      }
      const gap = Math.min(85, width * .092);
      const left = clamp(side < 0 ? x - gap - cardWidth : x + gap, 5, width - 5 - cardWidth);
      const top = clamp(y - 36 - cardHeight, 6, height - cardHeight - 6);
      const dx = clamp(x, left, left + cardWidth) - x;
      const dy = clamp(y, top, top + cardHeight) - y;
      line.style.width = Math.hypot(dx, dy) + "px";
      line.style.transform = "translate(" + x + "px," + y + "px) rotate(" + Math.atan2(dy, dx) + "rad)";
      tag.style.transform = "translate(" + Math.round(left) + "px," + Math.round(top) + "px)";
      ring.style.transform = "translate(" + (x-5) + "px," + (y-5) + "px)";
      marker.style.visibility = "visible";
    }
    return { place, hide() { marker.style.visibility = "hidden"; previous = null; } };
  }

  // 材质共用一张车间环境光贴图，抛光机身可以映出明亮的灯带。
  function lightingEnvironment(T, renderer) {
    const tile = document.createElement("canvas");
    tile.width = 512; tile.height = 256;
    const c = tile.getContext("2d");
    if (!c || !T.PMREMGenerator) return null;
    const gradient = c.createLinearGradient(0, 0, 0, 256);
    ["#718793", "#3b505e", "#15222c", "#46505a", "#101a22"].forEach((v, i) => gradient.addColorStop(i / 4, v));
    c.fillStyle = gradient; c.fillRect(0, 0, 512, 256);
    c.fillStyle = "#f6fbff";
    [[16,44,110,17],[195,29,70,11],[325,58,150,14],[57,111,50,53],[276,115,89,28]].forEach(r => c.fillRect(...r));
    const texture = new T.CanvasTexture(tile);
    texture.encoding = T.sRGBEncoding;
    const generator = new T.PMREMGenerator(renderer);
    const environment = generator.fromEquirectangular(texture);
    generator.dispose(); texture.dispose();
    return environment;
  }

  function makeFloor(T, renderer) {
    const width = 20, depth = 13.4;
    const tile = document.createElement("canvas");
    tile.width = 1536; tile.height = 1024;
    const c = tile.getContext("2d");
    c.fillStyle = "#556772"; c.fillRect(0, 0, tile.width, tile.height);
    c.scale(tile.width / width, tile.height / depth);
    c.translate(width / 2, depth / 2);
    c.lineWidth = .018; c.strokeStyle = "#455763";
    for (let x = -10; x < 10; x += 1.25) { c.beginPath(); c.moveTo(x, -7); c.lineTo(x, 7); c.stroke(); }
    for (let z = -6.7; z < 6.7; z += 1.25) { c.beginPath(); c.moveTo(-10, z); c.lineTo(10, z); c.stroke(); }
    bays.forEach((s, i) => {
      const x = s.x - 2.18, z = s.z - 1.94;
      c.fillStyle = "#4d6069"; c.fillRect(x, z, 4.36, 3.88);
      c.lineWidth = .025; c.strokeStyle = "#a0bac1"; c.strokeRect(x, z, 4.36, 3.88);
      c.fillStyle = "#b9c8c9"; c.textBaseline = "middle";
      c.font = '600 0.23px monospace'; c.fillText("P–0" + (i+1), x+.22, z+3.69);
      c.fillStyle = "#d8a856";
      for (let j = 0; j < 4; j++) c.fillRect(x + 3.46 + j*.16, z + 3.61, .08, .15);
    });
    // 中部地面的双道防撞线和人员通行箭头。
    c.strokeStyle = "#b2bcab"; c.lineWidth = .035;
    for (const z of [.03,.73]) {
      c.beginPath(); c.moveTo(-9.43,z); c.lineTo(9.42,z); c.stroke();
    }
    c.strokeStyle = "#9daea7"; c.lineWidth = .055;
    for (let x = -8.6; x < 9; x+=2.4) {
      c.beginPath(); c.moveTo(x-.14,.20); c.lineTo(x+.03,.38); c.lineTo(x-.14,.56); c.stroke();
    }
    const texture = new T.CanvasTexture(tile);
    texture.encoding = T.sRGBEncoding;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const mesh = new T.Mesh(new T.PlaneGeometry(width,depth),new T.MeshStandardMaterial({map:texture,roughness:.78,metalness:.14}));
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = .021; mesh.receiveShadow = true;
    return mesh;
  }

  function addHall(T, scene, renderer) {
    const bundles = new Map();
    const shell = new T.Group();
    scene.add(shell);
    const unitBox = new T.BoxGeometry(1,1,1);
    const pose = new T.Object3D();
    const material = (color, roughness=.55, metalness=.26) => new T.MeshStandardMaterial({color,roughness,metalness});
    const foundation = material(0x394855), rim = material(0x859ba1);
    const steel = material(0x9baeb3,.34,.62), strut = material(0x536976);
    const panel = material(0x93a5aa), grille = material(0x364955);
    const trim = material(0xe0b15d), light = new T.MeshBasicMaterial({color:0xe6feff});
    const body = (mat,x,y,z,w,h,d,rx=0,ry=0,rz=0) => {
      pose.position.set(x,y,z); pose.rotation.set(rx,ry,rz); pose.scale.set(w,h,d); pose.updateMatrix();
      if (!bundles.has(mat)) bundles.set(mat,[]);
      bundles.get(mat).push(pose.matrix.clone());
    };
    const flush = owner => {
      for (const [mat, group] of bundles) {
        const mesh = new T.InstancedMesh(unitBox,mat,group.length);
        group.forEach((m,i)=>mesh.setMatrixAt(i,m));
        mesh.receiveShadow = true; owner.add(mesh);
      }
      bundles.clear();
    };
    body(foundation,0,-.34,0,20.18,.64,13.58);
    body(rim,0,-.05,0,20.12,.11,13.52);
    body(strut,0,-.68,0,19.48,.12,12.88);
    body(trim,-7.4,-.28,6.795,3.3,.035,.025);
    for (let x=-9.45;x<9.65;x+=.41) body(grille,x,-.40,6.795,.14,.12,.018);
    for (const b of bays) {
      body(rim,b.x,.074,b.z,4.17,.08,3.62);
      body(foundation,b.x,.144,b.z,4.10,.095,3.55);
      for (const side of [-1,1]) {
        body(trim,b.x+side*1.93,.197,b.z+1.55,.12,.018,.17);
        body(trim,b.x+side*1.93,.197,b.z-1.55,.12,.018,.17);
      }
    }
    flush(scene);
    scene.add(makeFloor(T, renderer));
    // 后墙预制板、机电夹层、独立管路吊架和线性灯，前侧剖开。
    for (let i=0;i<10;i++) {
      const x = -9+i*2;
      body(panel,x,1.82,-6.36,1.97,3.57,.14);
      body(strut,x,2.87,-6.26,1.59,.82,.11);
      for (let j=0;j<6;j++) body(grille,x,2.55+j*.118,-6.18,1.45,.042,.08,-.18);
      body(steel,x,3.57,-6.13,1.82,.1,.34);
      body(light,x,3.51,-5.99,1.45,.033,.06);
    }
    for (let i=0;i<=5;i++) {
      const x=-10+i*4;
      body(strut,x,2.0,-6.12,.13,4.0,.26);
      body(steel,x,2.01,-5.91,.075,.095,.62);
    }
    body(foundation,0,.30,-6.2,20.18,.53,.19);
    body(rim,0,3.96,-6.13,20.18,.15,.41);
    for(let i=0;i<3;i++) body(i===1?trim:steel,0,1.95+.14*i,-5.71,20.05,.081,.081);
    flush(shell);
    return shell;
  }

  function buildRoute(T, scene) {
    // 数字设计信号先到反应器，其余各段沿设备侧面通过车间。
    const routes = [
      [[-6.45,.62,1.40],[-7.86,.62,1.40],[-7.86,.62,-2.55],[-7.18,.62,-2.55]],
      [[-4.28,.70,-2.92],[-3.83,.70,-2.92],[-3.83,.70,-3.44],[-1.45,.70,-3.44]],
      [[1.42,.70,-3.43],[2.95,.70,-3.43],[2.95,.70,-2.93],[4.31,.70,-2.93]],
      [[7.20,.70,-2.55],[7.98,.70,-2.55],[7.98,.70,2.83],[7.11,.70,2.83]]
    ];
    const pipe = new T.MeshStandardMaterial({color:0x96afb5,roughness:.32,metalness:.72});
    const core = new T.MeshStandardMaterial({color:0x609799,roughness:.36,metalness:.44});
    const shapes = [[],[]], poses = new T.Object3D(), ys = new T.Vector3(0,1,0);
    const jointPoints=[];
    const flows = routes.map(points=>{
      const vectors=points.map(p=>new T.Vector3(...p));
      const path=new T.CurvePath();
      vectors.forEach((pt,j)=>{
        if (!j) return;
        const prev=vectors[j-1];
        const edge=new T.LineCurve3(prev,pt);
        const length=edge.getLength();
        path.add(edge);
        for(let n=0;n<2;n++){
          poses.position.copy(prev).lerp(pt,.5); poses.position.y-=n*.15;
          poses.quaternion.setFromUnitVectors(ys,new T.Vector3().subVectors(pt,prev).normalize());
          poses.scale.set(1,length,1); poses.updateMatrix(); shapes[n].push(poses.matrix.clone());
        }
        if(j<vectors.length-1)jointPoints.push(pt);
      });
      return path;
    });
    const pipeGeometry=new T.CylinderGeometry(.074,.074,1,8);
    shapes.forEach((matrices,i)=>{
      const batch=new T.InstancedMesh(pipeGeometry,i?pipe:core,matrices.length);
      matrices.forEach((m,j)=>batch.setMatrixAt(j,m));scene.add(batch);
    });
    const fittings=new T.InstancedMesh(new T.SphereGeometry(.104,8,6),pipe,jointPoints.length*2);
    jointPoints.forEach((v,i)=>{
      poses.rotation.set(0,0,0);poses.scale.set(1,1,1);poses.position.copy(v);poses.updateMatrix(); fittings.setMatrixAt(i*2,poses.matrix);
      poses.position.y-=.15;poses.updateMatrix();fittings.setMatrixAt(i*2+1,poses.matrix);
    });
    scene.add(fittings);
    return flows;
  }

  window.createFactoryView = function createFactoryView(host, onSelect) {
    const T=window.THREE;
    if (!host || !T || typeof window.createFactoryMachines !== "function") throw new Error("三维设备资源尚未载入");
    const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
    const canvas=renderer.domElement;
    const scene=new T.Scene(), camera=new T.PerspectiveCamera(38,1,.1,150);
    const environment=lightingEnvironment(T,renderer);
    scene.environment=environment?.texture || null;
    scene.background=new T.Color(0x172733);
    scene.fog=new T.FogExp2(0x172733,.012);
    renderer.outputEncoding=T.sRGBEncoding;
    renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.toneMappingExposure=.92;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate=false; renderer.shadowMap.needsUpdate=true;
    const sky=new T.HemisphereLight(0xeafaff,0x68776f,.62);scene.add(sky);
    const sun=new T.DirectionalLight(0xfff0d6,1.48);
    sun.position.set(-9,16,12);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
    Object.assign(sun.shadow.camera,{left:-14,right:14,top:12,bottom:-12,far:47});sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias=-.0004;sun.shadow.normalBias=.025;scene.add(sun);
    const rimLight=new T.DirectionalLight(0xb5e9ff,.82);rimLight.position.set(12,7,-10);scene.add(rimLight);
    const deck=new T.Mesh(new T.PlaneGeometry(160,160),new T.MeshStandardMaterial({color:0x233844,roughness:.91}));
    deck.rotation.x=-Math.PI/2;deck.position.y=-.752;deck.receiveShadow=true;scene.add(deck);
    const shell=addHall(T,scene,renderer);
    const machines=window.createFactoryMachines();
    const areas=[];
    machines.stations.forEach((g,i)=>{
      g.position.set(bays[i].x,.20,bays[i].z);
      g.traverse(obj=>{if(obj.isMesh){obj.castShadow=!obj.material?.transparent;obj.receiveShadow=true;}});
      scene.add(g);
      const hit=new T.Mesh(new T.BoxGeometry(4.16,3.72,3.62),new T.MeshBasicMaterial({visible:false}));
      hit.position.copy(g.position);hit.position.y+=1.78;hit.userData.index=i;scene.add(hit);areas.push(hit);
    });
    const routes=buildRoute(T,scene);
    const traceMaterial=new T.MeshBasicMaterial({color:0x7effe5});
    const dot=new T.Mesh(new T.SphereGeometry(.112,12,8),traceMaterial);
    scene.add(dot);
    const corners=[];
    for(const x of [-1,1])for(const z of [-1,1]){
      corners.push(x*1.64,0,z*1.87,x*2.17,0,z*1.87,x*2.17,0,z*1.87,x*2.17,0,z*1.34);
    }
    const edgeG=new T.BufferGeometry();
    edgeG.setAttribute("position",new T.Float32BufferAttribute(corners,3));
    const focus=new T.LineSegments(edgeG,new T.LineBasicMaterial({color:0xf2f8fc}));
    scene.add(focus);focus.visible=false;
    // r128 接收线性材质颜色，车间与设备的配色表以屏幕 sRGB 编写。
    const palette = new Set();
    scene.traverse(obj => { if (obj.material) palette.add(obj.material); });
    palette.forEach(mat => {
      mat.color?.convertSRGBToLinear();
      if (mat.isMeshStandardMaterial) mat.envMapIntensity = .65;
    });
    Object.assign(canvas.style,{position:"absolute",inset:"0",width:"100%",height:"100%",display:"block",touchAction:"none",cursor:"grab"});
    canvas.setAttribute("aria-label","可旋转和缩放的蛋白质工厂三维车间，选择工位可查看特写");
    host.append(canvas);
    const layer=document.createElement("div");
    Object.assign(layer.style,{position:"absolute",inset:"0",pointerEvents:"none",overflow:"hidden"});
    host.append(layer);
    // 标注与工位绑定，使用屏幕像素排布，距离变化时仍维持可读字号。
    const labels=bays.map((b,i)=>{
      const btn=document.createElement("button");
      btn.type="button";btn.textContent=b.name;btn.setAttribute("aria-label","查看"+b.name+"工位");
      Object.assign(btn.style,{position:"absolute",top:"0",left:"0",pointerEvents:"auto",cursor:"pointer",whiteSpace:"nowrap",
        color:"#e9f5f4",background:"rgba(17,37,45,.95)",border:"1px solid #6b898c",borderRadius:"4px",
        boxShadow:"0 2px 7px rgba(10,22,27,.40)",font:"600 12px/19px system-ui,sans-serif",padding:"2px 8px",
        margin:"0",letterSpacing:".015em",transform:"translate(-500px,-500px)"});
      btn.addEventListener("click",()=>onSelect?.(i));
      layer.append(btn);
      const backRow = i > 0 && i < 4;
      return {btn,world:new T.Vector3(b.x,backRow ? 3.95 : .23,b.z+(backRow ? 0 : 1.66)),w:0,h:0};
    });
    const observationMarker = createObservationMarker(layer);
    let width=0,height=0,selected=-1,stage=-1,progress=0,variant="cyan",model="bright",returnToSeparator=false,frame=0,last=0,disposed=false;
    let separator = "fast", transfer = true;
    const automatic=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const center=new T.Vector3(0,.7,0), aim=center.clone();
    let yaw=-.19,pitch=.65,distance=28,goalYaw=yaw,goalPitch=pitch,goalDist=distance;
    const world=new T.Vector3(), endpoint=new T.Vector3(), direction=new T.Vector3(), side=new T.Vector3(), up=new T.Vector3(), diff=new T.Vector3();
    function fitOverview() {
      direction.set(Math.sin(goalYaw)*Math.cos(goalPitch),Math.sin(goalPitch),Math.cos(goalYaw)*Math.cos(goalPitch));
      side.set(Math.cos(goalYaw),0,-Math.sin(goalYaw));up.crossVectors(direction,side);
      const half=Math.tan(camera.fov*Math.PI/360);let requirement=1;
      for(const x of [-10.1,10.1])for(const z of [-6.75,6.75])for(const y of [-.72,4]){
        diff.set(x,y,z).sub(aim);
        const d=diff.dot(direction);
        requirement=Math.max(requirement,d+Math.abs(diff.dot(side))/(camera.aspect*half*.91),d+Math.abs(diff.dot(up))/(half*.89));
      }
      return requirement;
    }
    function autoDistance() { return selected<0 ? fitOverview() : clamp(Math.max(8.3,7.7/camera.aspect),8.3,24); }
    function setStation(i) {
      if(!Number.isInteger(i)||!bays[i])return;
      selected=i; aim.set(bays[i].x,1.60,bays[i].z);
      goalYaw=[-.36,.68,.17,-.68,.36][i];goalPitch=.43;goalDist=autoDistance();
    }
    function overview(){
      selected=-1;aim.set(0,.7,0);goalYaw=-.19;goalPitch=.65;goalDist=autoDistance();
    }
    function resize(){
      const w=Math.round(host.clientWidth),h=Math.round(host.clientHeight);
      if(!w||!h||(w===width&&h===height))return;
      const first=!width;
      width=w;height=h;camera.aspect=w/h;camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,w<650?1.55:1.75));
      renderer.setSize(w,h,false);
      goalDist=autoDistance();if(first)distance=goalDist;
      for(const item of labels){
        item.btn.style.visibility="hidden";item.btn.style.display="block";
        item.w=item.btn.offsetWidth;item.h=item.btn.offsetHeight;
      }
    }
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    function positionLabels(markProcess) {
      const placed=[];
      const ox=Math.max(5,Math.min(12,width*.02));
      for(const [i,item] of labels.entries()){
        const el=item.btn;
        if(markProcess || (selected!==-1&&i!==selected)){el.style.visibility="hidden";continue;}
        world.copy(item.world).project(camera);
        if(world.z>1||world.z< -1||Math.abs(world.x)>1.01||Math.abs(world.y)>1.02){el.style.visibility="hidden";continue;}
        const w=item.w,h=item.h, anchorX=(world.x+1)*width/2,anchorY=(-world.y+1)*height/2;
        const x=clamp(anchorX-w/2,ox,width-w-ox);
        let y=clamp(anchorY+3,ox,height-h-ox);
        const best=[y,y-h-6,y+h+6,y-2*h-10,y+2*h+10].find(v=>v>=ox&&v+h<=height-ox&&
          !placed.some(box=>x<box.x+box.w+3&&x+w+3>box.x&&v<box.y+box.h+3&&v+h+3>box.y));
        if(best===undefined){el.style.visibility="hidden";continue;}
        y=best;placed.push({x,y,w,h});
        el.style.transform="translate("+Math.round(x)+"px,"+Math.round(y)+"px)";
        el.style.visibility="visible";
        const active=i===stage||i===selected;
        el.style.color=active?"#c2ffef":"#e9f5f4";
        el.style.borderColor=active?"#8ddac8":"#72898d";
      }
    }
    const pointers=new Map(), ray=new T.Raycaster(), point=new T.Vector2();
    let moved=false,pinch=0;
    const gap=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
    function down(e){
      if(e.button!==0)return;
      if(!pointers.size)moved=false;
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY});
      if(pointers.size===2){pinch=gap();moved=true;}
      canvas.setPointerCapture(e.pointerId);canvas.style.cursor="grabbing";
    }
    function move(e){
      const p=pointers.get(e.pointerId);if(!p)return;
      const dx=e.clientX-p.x,dy=e.clientY-p.y;
      p.x=e.clientX;p.y=e.clientY;
      if(Math.hypot(p.x-p.startX,p.y-p.startY)>4)moved=true;
      if(pointers.size===2){const next=gap();if(next>2&&pinch>2)goalDist=clamp(goalDist*pinch/next,4.2,Math.max(65,autoDistance()*1.6));pinch=next;}
      else if(moved&&pointers.size===1){goalYaw-=dx*.007;goalPitch=clamp(goalPitch+dy*.005,.17,1.38);}
    }
    function end(e){
      if(!pointers.has(e.pointerId))return;
      pointers.delete(e.pointerId);
      if(!pointers.size)canvas.style.cursor="grab";
      if(e.type!=="pointerup"||moved||pointers.size)return;
      const box=canvas.getBoundingClientRect();
      point.set(2*(e.clientX-box.left)/box.width-1,1-2*(e.clientY-box.top)/box.height);
      ray.setFromCamera(point,camera);
      const hits=ray.intersectObjects(areas);
      if(hits.length)onSelect?.(hits[0].object.userData.index);
    }
    function wheel(e){e.preventDefault();goalDist=clamp(goalDist*Math.exp(clamp(e.deltaY,-220,220)*.0015),4.2,Math.max(65,autoDistance()*1.6));}
    canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);
    canvas.addEventListener("pointerup",end);canvas.addEventListener("pointercancel",end);
    canvas.addEventListener("wheel",wheel,{passive:false});
    function setProcess(index,fraction,color,candidate,returnBatch=false,separationPath="fast",transferPhase=true){
      stage=Number.isInteger(index)&&bays[index]?index:-1;
      progress=clamp(Number(fraction)||0,0,1);variant=color==="amber"?"amber":"cyan";
      model=candidate==="clean"?"clean":"bright";returnToSeparator=returnBatch;
      separator = separationPath;
      transfer = transferPhase;
    }
    function updateObservation() {
      if (selected < 0 || selected !== stage || progress <= 0 || typeof transfer === "number") {
        observationMarker.hide();
        return false;
      }
      const targets = observationPoints[stage];
      const target = targets[Math.min(targets.length - 1, Math.floor(progress * targets.length))];
      const station = machines.stations[stage];
      world.set(target[1], target[2], target[3]).add(station.position).project(camera);
      if (world.z < -1 || world.z > 1 || Math.abs(world.x) > .98 || Math.abs(world.y) > .98) {
        observationMarker.hide();
        return false;
      }
      observationMarker.place(target, (world.x + 1)*width/2, (1-world.y)*height/2, width, height);
      return true;
    }
    function draw(now){
      if(disposed)return;
      frame=requestAnimationFrame(draw);
      if(!width||!height||document.hidden||!host.getClientRects().length)return;
      const dt=clamp((now-last)/1000,0,.1);last=now;
      const ease=automatic?1:1-Math.exp(-dt*8);
      center.lerp(aim,ease);yaw+=(goalYaw-yaw)*ease;pitch+=(goalPitch-pitch)*ease;distance+=(goalDist-distance)*ease;
      endpoint.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
      camera.position.copy(center).addScaledVector(endpoint,distance);
      camera.lookAt(center);camera.updateMatrixWorld();
      shell.visible=camera.position.z> -5.7;
      const focusIndex=selected>=0?selected:stage;
      focus.visible=focusIndex>=0;
      if(focus.visible)focus.position.set(bays[focusIndex].x,.211,bays[focusIndex].z);
      const exitPhase = stage === 0 ? 2/3 : .75;
      const travel = typeof transfer === "number" ? clamp(transfer, 0, 1)
        : transfer ? clamp((progress-exitPhase)/(1-exitPhase),0,1) : 0;
      dot.visible=stage>=0&&stage<4&&travel>0&&travel<1;
      if(dot.visible){
        const reverse = stage === 3 && returnToSeparator;
        routes[reverse ? 2 : stage].getPoint(reverse ? 1-travel : travel,dot.position);dot.position.y+=.11;
        traceMaterial.color.setHex(stage===0?0xd4eaff:variant==="amber"?0xffbb59:0x75e6d8).convertSRGBToLinear();
      }
      machines.update(stage,progress,progress * 10,variant,model,separator);
      positionLabels(updateObservation());renderer.render(scene,camera);
    }
    frame=requestAnimationFrame(draw);
    function dispose(){
      if(disposed)return;
      disposed=true;cancelAnimationFrame(frame);observer.disconnect();
      canvas.removeEventListener("pointerdown",down);canvas.removeEventListener("pointermove",move);
      canvas.removeEventListener("pointerup",end);canvas.removeEventListener("pointercancel",end);
      canvas.removeEventListener("wheel",wheel);
      const materials=new Set(),geometries=new Set(),textures=new Set();
      scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});
      materials.forEach(m=>{for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();});
      geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());sun.shadow.map?.dispose();environment?.dispose();
      renderer.dispose();canvas.remove();layer.remove();
    }
    return {setStation,overview,setProcess,dispose};
  };
})();
