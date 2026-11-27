/* 五个虚拟车间工位，设备原点统一在底座中心，前面板朝 +Z。 */
(() => {
  "use strict";

  window.createFactoryMachines = function createFactoryMachines() {
    const T = window.THREE;
    const tau = Math.PI * 2;
    const vec = (x, y, z) => new T.Vector3(x, y, z);
    const finish = (color, metalness, roughness) =>
      new T.MeshStandardMaterial({color, metalness, roughness});
    const luminous = color => new T.MeshBasicMaterial({color});
    const enamel = finish(0xc2d5d7, .35, .3);
    const alloy = finish(0x94aaaf, .57, .22);
    const graphite = finish(0x283c49, .36, .4);
    const inset = finish(0x112b35, .14, .42);
    const rubber = finish(0x19292d, .1, .85);
    const brass = finish(0xba8f51, .51, .27);
    const screen = finish(0x092d37, .23, .23);
    const teal = luminous(0x67decc);
    const pale = luminous(0xc7e5e2);
    const amber = luminous(0xffbd70);
    const glass = new T.MeshPhongMaterial({
      color: 0x7abcc6, shininess: 95, specular: 0xe4ffff,
      transparent: true, opacity: .19, depthWrite: false
    });
    const trace = finish(0x27c8be, .23, .25);
    trace.emissive.setHex(0x102c30);
    const fluid = new T.MeshPhongMaterial({color: 0x68b7cf, transparent: true, opacity: .23, depthWrite:false, shininess:80});
    const lightTrace = luminous(0x7ce8d7);
    const cellShell = finish(0xeee9d9, .05, .32);
    const impurity = luminous(0xad9bc2);
    const excitation = luminous(0xaf79ff);
    const whiteLight = luminous(0xf4f6ff);
    const signalBackdrop = finish(0x202433,.16,.54);
    const unit = n => Math.min(1, Math.max(0,n));
    function ease(n) { const t=unit(n); return t*t*(3-2*t); }
    const phase = (p,a,b) => ease((p-a)/(b-a));
    const primitive = {
      box: new T.BoxGeometry(1, 1, 1),
      cylinder: new T.CylinderGeometry(1, 1, 1, 28),
      sphere: new T.SphereGeometry(1, 28, 14)
    };
    function part(parent, geom, mat, x, y, z) {
      const mesh = new T.Mesh(geom, mat);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    }
    function block(g, mat, x, y, z, w, h, d) {
      const m = part(g, primitive.box, mat, x, y, z);
      m.scale.set(w, h, d);
      return m;
    }
    function housing(g, mat, x, y, z, w, h, d, radius = .07) {
      const bx = w / 2 - radius, by = h / 2 - radius;
      const shape = new T.Shape();
      shape.moveTo(-bx, -h/2);
      shape.lineTo(bx, -h/2); shape.quadraticCurveTo(w/2, -h/2, w/2, -by);
      shape.lineTo(w/2, by); shape.quadraticCurveTo(w/2, h/2, bx, h/2);
      shape.lineTo(-bx, h/2); shape.quadraticCurveTo(-w/2, h/2, -w/2, by);
      shape.lineTo(-w/2, -by); shape.quadraticCurveTo(-w/2, -h/2, -bx, -h/2);
      const geom = new T.ExtrudeGeometry(shape, {
        depth: d - .024, curveSegments: 3, bevelEnabled: true,
        bevelSegments: 1, bevelSize: .012, bevelThickness: .012
      });
      return part(g, geom, mat, x, y, z - d / 2 + .012);
    }
    function cyl(g, mat, x, y, z, r, h) {
      const m = part(g, primitive.cylinder, mat, x, y, z);
      m.scale.set(r, h, r);
      return m;
    }
    function bulb(g, mat, x, y, z, rx, ry, rz = rx) {
      const m = part(g, primitive.sphere, mat, x, y, z);
      m.scale.set(rx, ry, rz);
      return m;
    }
    function flange(g, mat, x, y, z, r, thickness, axis = "y") {
      const m = cyl(g, mat, x, y, z, r, thickness);
      if (axis === "z") m.rotation.x = Math.PI / 2;
      if (axis === "x") m.rotation.z = Math.PI / 2;
      return m;
    }
    function tube(g, mat, points, r) {
      const curve = new T.CatmullRomCurve3(points.map(p => vec(...p)), false, "centripetal");
      return part(g, new T.TubeGeometry(curve, Math.max(12, points.length * 4), r, 8, false), mat, 0, 0, 0);
    }
    function line(g, mat, a, b, radius) {
      const from = vec(...a), to = vec(...b), delta = to.clone().sub(from);
      const m = cyl(g, mat, (a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2, radius, delta.length());
      m.quaternion.setFromUnitVectors(vec(0, 1, 0), delta.normalize());
      return m;
    }
    // 静态部件按材质合并。重复的螺栓、管道和机柜面板不占用各自的绘制调用。
    function batch(group) {
      const buckets = new Map(), scratch = new T.Vector3(), normalMat = new T.Matrix3();
      [...group.children].filter(child => child.isMesh).forEach(mesh => {
        let data = buckets.get(mesh.material);
        if (!data) { data = {positions: [], normals: [], indices: []}; buckets.set(mesh.material, data); }
        mesh.updateMatrix();
        normalMat.getNormalMatrix(mesh.matrix);
        const geom = mesh.geometry;
        const pos = geom.attributes.position, norm = geom.attributes.normal;
        const offset = data.positions.length / 3;
        for (let i = 0; i < pos.count; ++i) {
          scratch.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrix);
          data.positions.push(scratch.x, scratch.y, scratch.z);
          scratch.fromBufferAttribute(norm, i).applyNormalMatrix(normalMat);
          data.normals.push(scratch.x, scratch.y, scratch.z);
        }
        const count = geom.index ? geom.index.count : pos.count;
        for (let i = 0; i < count; ++i) data.indices.push(offset + (geom.index ? geom.index.getX(i) : i));
        group.remove(mesh);
      });
      for (const [mat, data] of buckets) {
        const geom = new T.BufferGeometry();
        geom.setAttribute("position", new T.Float32BufferAttribute(data.positions, 3));
        geom.setAttribute("normal", new T.Float32BufferAttribute(data.normals, 3));
        geom.setIndex(data.indices);
        const mesh = new T.Mesh(geom, mat);
        group.add(mesh);
      }
    }
    function movable(parent, x, y, z) {
      const group = new T.Group();
      group.position.set(x, y, z);
      parent.add(group);
      return group;
    }
    // 每类可移动颗粒只占一次绘制，大小用于教学视野下的辨识。
    const particleShape = new T.SphereGeometry(1,12,8);
    const particlePose = new T.Object3D();
    function particles(parent, shape, material, count) {
      const mesh = new T.InstancedMesh(shape,material,count);
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      parent.add(mesh);
      return mesh;
    }
    function put(mesh,slot,x,y,z,width,height=width,depth=width,angle=0) {
      particlePose.position.set(x,y,z);
      particlePose.scale.set(width,height,depth);
      particlePose.rotation.set(0,angle,.22*Math.sin(angle));
      particlePose.updateMatrix();
      mesh.setMatrixAt(slot,particlePose.matrix);
    }
    function flush(mesh,count) { mesh.count=count; mesh.instanceMatrix.needsUpdate=true; }
    function path(points) { return new T.CatmullRomCurve3(points.map(v=>vec(...v))); }
    const streamPoint=vec(0,0,0);
    function along(mesh,slot,curve,t,size) {
      curve.getPoint(unit(t),streamPoint);
      put(mesh,slot,streamPoint.x,streamPoint.y,streamPoint.z,size);
    }
    function statusLamp(g, x, y, z) {
      cyl(g, graphite, x, y, z, .082, .16);
      cyl(g, teal, x, y + .14, z, .071, .12);
      cyl(g, alloy, x, y + .21, z, .076, .03);
    }
    function panel(g, x, y, z, w, h) {
      housing(g, graphite, x, y, z, w, h, .075, .035);
      block(g, screen, x, y, z + .042, w * .87, h * .79, .015);
      for (let j = 0; j < 6; j++) {
        const len = h * (.14 + .38 * Math.abs(Math.sin(j * .79 + .35)));
        block(g, j === 4 ? amber : teal, x - w*.32 + j*w*.121, y-h*.24+len*.5, z+.057, w*.058, len, .012);
      }
    }
    function skid() {
      const g = new T.Group();
      for (const x of [-1.32,1.32]) for (const z of [-.82,.82]) {
        cyl(g, rubber, x, .08, z, .16, .16);
      }
      housing(g, graphite, 0, .2, 0, 3.4, .18, 2.24, .06);
      block(g, alloy, 0, .306, 0, 3.33, .045, 2.18);
      block(g, teal, -1.17, .205, 1.128, .55, .026, .012);
      return g;
    }

    // 设计工作站：左屏显示候选结构趋势，右侧投影台展示同一模型的空间折叠。
    const design = skid();
    housing(design, enamel, -.48, .9, -.12, 2.05, 1.16, 1.36);
    for (let j = 0; j < 6; j++) block(design, graphite, -.92 + j*.14, .72, .57, .055, .31, .018);
    housing(design, graphite, -.12, 1.52, -.02, 2.89, .15, 1.66, .065);
    block(design, alloy, -.73, 1.81, -.45, .14, .52, .15);
    housing(design, graphite, -.73, 2.35, -.48, 1.58, 1.02, .13);
    block(design, screen, -.73, 2.36, -.405, 1.43, .87, .016);
    for (let i = 0; i < 6; i++) block(design, graphite, -1.37 + i*.246, 2.35, -.389, .012, .68, .012);
    tube(design, teal, [[-1.37,2.20,-.375],[-1.15,2.23,-.375],[-.96,2.49,-.375],[-.78,2.29,-.375],[-.53,2.54,-.375],[-.3,2.48,-.375],[-.1,2.62,-.375]], .016);
    block(design, alloy, -.75, 1.611, .36, 1.06, .048, .35);
    for (let i=0;i<3;i++) block(design, graphite, -.75, 1.642, .26+i*.086, .91, .012, .044);
    cyl(design, graphite, .83, 1.7, -.01, .59, .19);
    cyl(design, teal, .83, 1.802, -.01, .48, .026);
    cyl(design, inset, .83, 1.829, -.01, .44, .03);
    const molecule = movable(design, .83, 2.40, -.01);
    // 以带状曲面表示折叠，保留螺旋的宽面和阴影。
    function ribbon(g, mat, nodes, width) {
      const path = new T.CatmullRomCurve3(nodes.map(p => vec(...p)));
      const steps = nodes.length * 4, frames = path.computeFrenetFrames(steps, false);
      const positions = [], indices = [];
      for (let i = 0; i <= steps; i++) {
        const p = path.getPointAt(i/steps), n = frames.normals[i], b = frames.binormals[i];
        for (const [w,h] of [[-width,-.018],[width,-.018],[width,.018],[-width,.018]]) {
          const v = p.clone().addScaledVector(n, w).addScaledVector(b, h);
          positions.push(v.x,v.y,v.z);
        }
        if (i) for (let side=0;side<4;side++) {
          const a=(i-1)*4+side, c=(i-1)*4+(side+1)%4;
          indices.push(a,c,a+4,c,c+4,a+4);
        }
      }
      const geom = new T.BufferGeometry();
      geom.setAttribute("position", new T.Float32BufferAttribute(positions,3));
      geom.setIndex(indices); geom.computeVertexNormals();
      part(g,geom,mat,0,0,0);
    }
    const brightFold = movable(molecule,0,0,0);
    const fold = [];
    for (let i=0;i<27;i++) {
      const angle=i*.62, y=-.40+i*.032;
      fold.push([-.16+.23*Math.cos(angle),y,.23*Math.sin(angle)]);
    }
    fold.push([.14,.56,-.18],[.39,.42,-.11],[.26,.18,.17],[.46,-.06,.12],[.29,-.31,-.16],[.15,-.48,.06]);
    ribbon(brightFold,trace,fold,.084);
    tube(brightFold, brass, [[.15,-.48,.06],[-.02,-.45,.2],[-.16,-.32,.32],[-.3,-.22,.29]], .041);
    batch(brightFold);
    const cleanFold = movable(molecule,0,0,0);
    ribbon(cleanFold, trace, [
      [-.43,-.31,.06],[-.44,.20,.03],[-.37,.43,-.04],[-.20,.42,-.06],
      [-.16,.08,.03],[-.12,-.32,.13],[.02,-.40,.16],[.16,-.28,.04],
      [.18,.13,-.12],[.22,.42,-.20],[.34,.48,-.11],[.45,.30,.01],
      [.45,-.07,.09],[.40,-.28,.17]
    ], .092);
    tube(cleanFold,brass,[[.40,-.28,.17],[.30,-.40,.19],[.08,-.50,.10],[-.14,-.47,-.01],[-.28,-.28,-.10]],.040);
    batch(cleanFold);
    const scanMark=movable(design,-1.33,2.35,-.365);
    block(scanMark,pale,0,0,0,.032,.65,.018);
    const jobTicket=movable(design,.54,1.38,.78);
    block(jobTicket,cellShell,0,0,0,.54,.033,.37);
    for(let j=0;j<7;j++) block(jobTicket,graphite,-.19+j*.06,.021,0,j%2?.017:.028,.012,.22);
    block(jobTicket,lightTrace,.22,.021,0,.042,.012,.31);
    batch(jobTicket);
    housing(design,graphite,.54,1.36,.61,.70,.18,.34);
    batch(design);

    // 生物反应器：可见搅拌叶、物料液面、观察窗和顶部独立驱动电机。
    const reactor = skid(), tankX = -.28, tankZ = -.06, radius = .82;
    for (const dx of [-.53,.53]) for (const dz of [-.47,.47]) {
      cyl(reactor, alloy, tankX+dx,.64,tankZ+dz,.072,.66);
      cyl(reactor, graphite,tankX+dx,.355,tankZ+dz,.135,.055);
    }
    bulb(reactor, alloy,tankX,1.07,tankZ,radius,.29);
    cyl(reactor, glass,tankX,1.89,tankZ,radius,1.65);
    bulb(reactor, enamel,tankX,2.70,tankZ,radius,.32);
    for (const y of [1.08,1.19,2.63,2.72]) cyl(reactor,alloy,tankX,y,tankZ,radius+.024,.065);
    for (const angle of [0,Math.PI*.65,Math.PI*1.28]) {
      cyl(reactor,alloy,tankX+radius*Math.cos(angle),1.89,tankZ+radius*Math.sin(angle),.024,1.43);
    }
    cyl(reactor, graphite,tankX,3.05,tankZ,.29,.11);
    cyl(reactor, alloy,tankX,3.26,tankZ,.235,.32);
    for (let j=0;j<4;j++) cyl(reactor,graphite,tankX,3.13+j*.082,tankZ,.249,.026);
    housing(reactor,enamel,1.06,1.06,-.20,.61,1.46,.62);
    panel(reactor,1.06,1.44,.144,.49,.40);
    statusLamp(reactor,1.07,1.88,-.2);
    tube(reactor,alloy,[[tankX-.41,2.91,-.1],[-.72,3.20,-.1],[-1.17,3.20,-.1],[-1.37,2.99,-.1],[-1.37,1.16,-.1],[-1.17,1.02,-.1]],.054);
    tube(reactor,brass,[[.37,2.79,-.25],[.55,2.90,-.25],[.9,2.9,-.25],[1.04,2.72,-.25],[1.04,2.0,-.25]],.038);
    const impeller = movable(reactor,tankX,1.65,tankZ);
    cyl(impeller,graphite,0,.29,0,.036,1.53);
    for (let i=0;i<3;i++) {
      const a=i*tau/3;
      const blade=block(impeller,alloy,.24*Math.cos(a),.16,.24*Math.sin(a),.46,.16,.074);
      blade.rotation.set(.47,-a,0);
    }
    batch(impeller);
    const tankFill = movable(reactor,tankX,1.1,tankZ);
    cyl(tankFill,fluid,0,.50,0,radius*.92,1);
    const meniscus=part(tankFill,new T.TorusGeometry(radius*.92,.016,6,48),pale,0,1.0,0);
    meniscus.rotation.x=Math.PI/2;
    const feedRoute = path([[-1.38,2.03,.33],[-1.30,2.58,.42],[-.92,2.66,.44],[-.74,2.53,.39],[-.68,2.19,.33]]);
    const drainRoute = path([[tankX+.45,1.38,tankZ+.22],[.50,1.34,.44],[.75,1.08,.70],[1.48,1.06,.72]]);
    part(reactor,new T.TubeGeometry(feedRoute,24,.083,10,false),glass,0,0,0);
    part(reactor,new T.TubeGeometry(drainRoute,24,.092,10,false),glass,0,0,0);
    flange(reactor,alloy,1.47,1.06,.72,.11,.06,"x");
    batch(tankFill); batch(reactor);
    const cells=particles(reactor,particleShape,cellShell,16);
    const products=particles(reactor,particleShape,lightTrace,38);
    const tankDebris=particles(reactor,primitive.box,impurity,11);
    const feedDrops=particles(reactor,particleShape,pale,6);

    // 纯化工位：可见柱床、洗脱色带以及连接各柱的总管。
    const separation = skid();
    housing(separation,graphite,0,.67,-.03,2.92,.65,1.60);
    housing(separation,enamel,-1.11,1.61,-.13,.60,1.56,.89);
    panel(separation,-1.12,1.95,.337,.49,.4);
    for (let j=0;j<4;j++) block(separation,graphite,-1.12,1.4+j*.065,.325,.34,.028,.023);
    const bands = [], debrisBands=[];
    for (let i=0;i<3;i++) {
      const x=-.42+i*.67, z=.03, h=1.53-i*.09;
      cyl(separation,glass,x,1.17+h/2,z,.261,h);
      cyl(separation,alloy,x,1.13,z,.29,.16);
      cyl(separation,enamel,x,1.21+h,z,.29,.16);
      cyl(separation,graphite,x,1.34+h,z,.116,.11);
      cyl(separation,alloy,x,1.18+h/2,z+.24,.014,h);
      cyl(separation,enamel,x,1.44,z,.226,.42);
      const stream=movable(separation,x,1.8,z);
      cyl(stream,trace,0,0,0,.227,.14);
      cyl(stream,lightTrace,0,.074,0,.228,.016);
      batch(stream); bands.push(stream);
      const waste=movable(separation,x,1.8,z);
      cyl(waste,impurity,0,0,0,.225,.10);
      batch(waste); debrisBands.push(waste);
      tube(separation,alloy,[[x,1.40+h,z],[x,1.58+h,z],[x,1.65+h,-.15],[x,1.65+h,-.56],[x,1.58+h,-.66]],.039);
    }
    tube(separation,alloy,[[-1.13,2.47,-.18],[-1.13,3.13,-.47],[-.87,3.20,-.66],[.99,3.12,-.66],[1.21,2.94,-.66],[1.21,1.08,-.66]],.053);
    for (let i=0;i<3;i++) flange(separation,brass,-.42+i*.67,.72,.80,.10,.06,"z");
    // 独立支架承载两只前置收集杯，左侧目标组分，右侧杂质。
    block(separation,graphite,.18,.50,.99,1.62,.13,.56);
    const cups=[-.25,.61].map(x=>{
      cyl(separation,glass,x,.89,.98,.233,.64);
      cyl(separation,alloy,x,.571,.98,.239,.039);
      const lip=part(separation,new T.TorusGeometry(.227,.022,6,26),alloy,x,1.21,.98);
      lip.rotation.x=Math.PI/2;
      return {x};
    });
    const collectionRoutes=cups.map(({x},i)=>path([[i===0?-.42:.92,1.64,.13],[i===0?-.47:.97,1.61,.50],[x,1.53,.86],[x,1.42,.98],[x,1.04,.98]]));
    collectionRoutes.forEach(curve=>part(separation,new T.TubeGeometry(curve,20,.048,8,false),glass,0,0,0));
    const sampleCarrier=movable(separation,-.25,.95,.98);
    cyl(sampleCarrier,glass,0,.17,0,.096,.31);
    cyl(sampleCarrier,trace,0,.14,0,.076,.19);
    cyl(sampleCarrier,alloy,0,.345,0,.10,.052);
    batch(sampleCarrier);
    batch(separation);
    const columnTargets=particles(separation,particleShape,lightTrace,40);
    const columnWaste=particles(separation,primitive.box,impurity,40);

    // 光学质检台：叉形检测臂围住样品，光束横穿观察室，传感器邻近样品池。
    const inspection = skid();
    housing(inspection,enamel,0,.84,-.07,2.82,.99,1.61);
    housing(inspection,graphite,0,1.38,-.07,2.93,.16,1.68);
    housing(inspection,enamel,-.93,1.93,-.19,.61,1.06,1.08);
    housing(inspection,graphite,.95,1.88,-.16,.61,.95,1.00);
    for (const [x,d] of [[-.60,1],[.65,-1]]) {
      flange(inspection,alloy,x,1.97,-.12,.21,.13,"x");
      flange(inspection,teal,x+d*.083,1.97,-.12,.147,.024,"x");
    }
    cyl(inspection,graphite,0,1.49,-.12,.28,.11);
    for (const x of [-.23,.23]) block(inspection,alloy,x,1.47,.27,.041,.046,.83);
    const sample=movable(inspection,0,0,.70);
    cyl(sample,graphite,0,1.53,-.12,.195,.075);
    cyl(sample,glass,0,1.88,-.12,.175,.64);
    cyl(sample,trace,0,1.82,-.12,.136,.4);
    cyl(sample,alloy,0,2.21,-.12,.181,.074);
    batch(sample);
    const refLight=movable(inspection,0,1.97,-.12);
    flange(refLight,whiteLight,0,0,0,.042,1.12,"x");
    const exciteLight=movable(inspection,-.53,1.97,-.12);
    flange(exciteLight,excitation,.265,0,0,.052,.53,"x");
    // 荧光与白光参比在两个方向接收，空间上也能分清激发、发射与参比。
    const emissionEnd=vec(.38,2.32,-.61);
    housing(inspection,graphite,.38,2.32,-.70,.37,.32,.22);
    flange(inspection,alloy,.38,2.32,-.568,.117,.083,"z");
    const emission=movable(inspection,0,1.97,-.12);
    line(emission,lightTrace,[0,0,0],[emissionEnd.x,.35,-.41],.044);
    const signalGlow=bulb(emission,lightTrace,0,0,0,.102,.102);
    const display=movable(inspection,.75,2.70,-.64);
    block(inspection,alloy,.52,1.95,-.65,.12,.98,.14);
    housing(display,graphite,0,0,0,1.45,.81,.08);
    block(display,signalBackdrop,0,0,.05,1.32,.67,.018);
    for(let j=0;j<3;j++) block(display,graphite,0,-.20+j*.18,.066,1.20,.011,.009);
    block(display,pale,-.59,0,.07,.013,.52,.01);
    batch(display);
    const opticalBars=particles(display,primitive.box,lightTrace,14);
    const noiseBars=particles(display,primitive.box,impurity,14);
    for (let j=0;j<3;j++) {
      flange(inspection,j===0 ? teal : alloy,.62+j*.2,1.02,.75,.046,.029,"z");
    }
    for (let j=0;j<5;j++) block(inspection,graphite,-1.06+j*.13,.78,.75,.06,.31,.024);
    const opticalSweep=movable(inspection,0,1.93,-.12);
    const ring = part(opticalSweep,new T.TorusGeometry(.207,.012,6,32),lightTrace,0,0,0);
    ring.rotation.x=Math.PI/2;
    batch(opticalSweep); batch(inspection);

    // 封装与出料：双柱式压盖机构，独立的样品瓶随输送带运动。
    const packing=skid();
    for (const x of [-1.23,1.20]) for (const z of [-.44,.44]) block(packing,alloy,x,.78,z,.12,.94,.14);
    housing(packing,graphite,0,1.18,0,3.17,.34,1.28);
    for (let i=0;i<14;i++) flange(packing,alloy,-1.41+i*.215,1.36,0,.092,1.15,"z");
    for (const z of [-.68,.68]) {
      block(packing,enamel,0,1.25,z,3.2,.22,.075);
      block(packing,brass,0,1.41,z,3.14,.032,.045);
    }
    for (const z of [-.53,.53]) {
      block(packing,graphite,-.12,1.99,z,.14,1.28,.14);
      block(packing,alloy,.10,1.99,z,.069,1.26,.068);
    }
    housing(packing,enamel,-.02,2.72,0,.81,.34,1.34);
    cyl(packing,graphite,-.02,3.01,0,.21,.24);
    statusLamp(packing,.23,2.97,.37);
    const nozzle=movable(packing,-.02,2.48,0);
    cyl(nozzle,alloy,0,0,0,.10,.31);
    cyl(nozzle,graphite,0,-.19,0,.146,.14);
    batch(nozzle);
    const vial=movable(packing,-1.32,1.47,0);
    cyl(vial,glass,0,.23,0,.22,.46);
    bulb(vial,glass,0,.457,0,.22,.085);
    cyl(vial,glass,0,.531,0,.14,.10);
    cyl(vial,alloy,0,.029,0,.20,.032);
    const contents=movable(vial,0,.041,0);
    cyl(contents,trace,0,.20,0,.19,.40);
    const cap=movable(vial,0,.62,0);
    cyl(cap,graphite,0,0,0,.151,.126);
    cyl(cap,lightTrace,0,.065,0,.149,.019);
    const label=movable(vial,0,.25,0);
    cyl(label,enamel,0,0,0,.222,.179);
    for(let i=0;i<6;i++)block(label,graphite,-.074+i*.027,0,.222,i%2?.014:.010,.125,.009);
    const fillingStream=movable(packing,-.02,2.15,0);
    cyl(fillingStream,lightTrace,0,-.16,0,.044,.32);
    batch(label); batch(cap); batch(contents); batch(vial);
    batch(packing);

    function showDesign(p,model) {
      molecule.rotation.y=.3 + phase(p,0,.66)*tau*.75;
      molecule.rotation.z=-.11;
      molecule.scale.setScalar(.63+.43*phase(p,0,1/3));
      cleanFold.visible=model==="clean";
      brightFold.visible=!cleanFold.visible;
      scanMark.visible=p>0 && p<.73;
      scanMark.position.x=-1.33+1.22*phase(p,1/3,2/3);
      jobTicket.visible=p>2/3;
      jobTicket.position.z=.52+.53*phase(p,2/3,1);
    }
    function showReactor(p,active) {
      const fill=phase(p,0,.25), mix=phase(p,.25,.51), accumulate=phase(p,.50,.75), discharge=phase(p,.77,1);
      const liquidHeight=.23+.98*fill-.67*discharge;
      tankFill.scale.y=liquidHeight;
      impeller.rotation.y=tau*(2.95*mix+1.45*accumulate+.55*discharge);
      let cellCount=0, productCount=0, wasteCount=0, dropCount=0;
      if(active) {
        cellCount=Math.round(12*fill);
        for(let i=0;i<cellCount;i++) {
          const level=.20+.65*((i*7%13)/13);
          const angle=i*2.39+tau*(mix+.58*accumulate+.21*discharge);
          const radius=.32+(i%3)*.113;
          const x=tankX+radius*Math.cos(angle), z=tankZ+radius*Math.sin(angle);
          const y=1.13+liquidHeight*level+.054*Math.sin(angle*2);
          put(cells,i,x,y,z,.096,.054,.059,angle);
          // 亮点首先集中在示意细胞旁，使出现的位置与积累过程可以关联。
          for(let j=0;j<2;j++) {
            const onset=(i%6)*.065+j*.28;
            const size=.052*unit((accumulate-onset)*3.5);
            if(size>0) put(products,productCount++,x+(j?.064:-.057),y+.038,z+.068,size);
          }
        }
        if(p>0 && p<.25) for(let i=0;i<5;i++) {
          const t=(p*8+i/5)%1;
          along(feedDrops,dropCount++,feedRoute,t,.058*Math.sin(Math.PI*t));
        }
        if(p>.76 && p<1) for(let i=0;i<7;i++) {
          const t=(discharge*2+i/7)%1;
          const size=Math.sin(Math.PI*t);
          if(i%3===0) along(tankDebris,wasteCount++,drainRoute,t,.107*size);
          else along(products,productCount++,drainRoute,t,.069*size);
        }
      }
      flush(cells,cellCount); flush(products,productCount);
      flush(tankDebris,wasteCount); flush(feedDrops,dropCount);
    }
    function showSeparation(p,active,separator) {
      const fine=separator==="fine";
      const fill=phase(p,0,.25), split=phase(p,.25,.50), collect=phase(p,.50,.75), transfer=phase(p,.78,1);
      bands.forEach((band,i)=>{
        const top=2.59-i*.09;
        const localFill=unit(fill*1.38-i*.19);
        const center=top-.28*localFill-.24*split-.39*collect;
        const waste=debrisBands[i];
        band.visible=waste.visible=active && localFill>.005 && p<.76;
        band.scale.y=localFill*(1-.78*collect);
        waste.scale.y=band.scale.y;
        band.position.y=center;
        waste.position.y=center-.025-split*(fine?.32:.20);
      });
      let targetCount=0, wasteCount=0;
      if(active && p>0 && p<.27) {
        for(let i=0;i<12;i++) {
          const angle=i*2.39, t=(p*5+i/12)%1, col=i%3;
          const x=-.42+col*.67+.11*Math.cos(angle), y=2.63-col*.09-t*.94, z=.03+.11*Math.sin(angle);
          if(i%2) put(columnTargets,targetCount++,x,y,z,.048);
          else put(columnWaste,wasteCount++,x,y,z,.073,.073,.073,angle);
        }
      }
      if(active && p>.50 && p<.76) {
        for(let i=0;i<8;i++) {
          const t=(collect*2+i/8)%1, weight=Math.sin(Math.PI*t);
          along(columnTargets,targetCount++,collectionRoutes[0],t,.059*weight);
          along(columnWaste,wasteCount++,collectionRoutes[1],t,.105*weight);
        }
      }
      if(active && collect>0) {
        // 收集杯底部以圆点和棱块保留两路物料的组成差异。
        const count=Math.round(13*collect);
        for(let i=0;i<count;i++) {
          const angle=i*2.39, radius=.084+(i%3)*.024;
          const y=.65+.067*Math.floor(i/4), z=.98+radius*Math.sin(angle);
          put(columnTargets,targetCount++,cups[0].x+radius*Math.cos(angle),y,z,.068);
          put(columnWaste,wasteCount++,cups[1].x+radius*Math.cos(angle),y,z,.099,.099,.099,angle);
        }
        for(let i=0;i<Math.round((fine?1:4)*collect);i++) {
          put(columnWaste,wasteCount++,cups[0].x-.11+.066*i,.69+i*.066,1.112,.085,.085,.085,i);
        }
      }
      sampleCarrier.visible=active && p>.77;
      sampleCarrier.position.set(-.25+1.70*phase(transfer,.29,1),.97+.48*phase(transfer,0,.35),.98-.19*transfer);
      flush(columnTargets,targetCount); flush(columnWaste,wasteCount);
    }
    function showInspection(p,active,model) {
      const load=phase(p,.25,.5), detect=phase(p,.50,.75), record=phase(p,.75,1);
      sample.position.z=.70*(1-load);
      refLight.visible=active && p>.005 && p<.25;
      refLight.scale.x=Math.max(.015,Math.sin(Math.PI*unit(p*4)));
      exciteLight.visible=emission.visible=active && p>.50 && p<.81;
      exciteLight.scale.x=phase(detect,0,.32);
      emission.scale.setScalar(phase(detect,.22,.58));
      signalGlow.scale.setScalar(.106+.037*Math.sin(detect*tau*3));
      opticalSweep.visible=active && p>.51 && p<.78;
      opticalSweep.position.y=1.75+.36*detect;
      const bars=active ? Math.floor(14*phase(p,.59,.96)) : 0;
      for(let i=0;i<bars;i++) {
        const v=(i-7.8)/2.35;
        const h=.058+(model==="bright"?.46:.33)*Math.exp(-v*v);
        const noise=.026+(model==="bright"?.08:.025)*(.5+.5*Math.sin(i*2.51));
        const x=-.54+i*.081;
        put(opticalBars,i,x,-.21+h*.5,.078,.044,h,.014);
        put(noiseBars,i,x+.029,-.21+noise*.5,.079,.022,noise,.014);
      }
      flush(opticalBars,bars); flush(noiseBars,bars);
      display.scale.setScalar(1+.035*Math.sin(Math.PI*record));
    }
    function showPackaging(p) {
      const arrive=phase(p,0,1/3), fill=phase(p,1/3,2/3), depart=phase(p,.83,1);
      vial.position.x=-1.32+1.30*arrive+1.34*depart;
      contents.visible=fill>0; contents.scale.y=Math.max(.001,fill);
      fillingStream.visible=p>1/3 && p<2/3;
      fillingStream.scale.y=.68+.32*Math.sin(fill*Math.PI);
      cap.visible=p>=2/3;
      cap.position.y=.62+.20*(1-phase(p,2/3,.76));
      nozzle.position.y=2.48-.13*Math.sin(Math.PI*phase(p,2/3,.8));
      label.visible=p>.77;
      label.scale.y=Math.max(.001,phase(p,.77,.84));
    }

    let currentVariant, lastIndex, lastProgress, lastModel, lastSeparator;
    function update(index, progress, _time, variant, model="bright", separator="fast") {
      const p=unit(progress||0);
      if(lastIndex===index && lastProgress===p && currentVariant===variant &&
        lastModel===model && lastSeparator===separator) return;
      if(variant!==currentVariant) {
        const gold=variant==="amber";
        trace.color.setHex(gold?0xecac59:0x42c6b6).convertSRGBToLinear();
        trace.emissive.setHex(gold?0x301a09:0x102c30);
        lightTrace.color.setHex(gold?0xffce83:0x83ebdd).convertSRGBToLinear();
        currentVariant=variant;
      }
      lastIndex=index; lastProgress=p; lastModel=model; lastSeparator=separator;
      const at=stage=>index===stage ? p : index>stage ? 1 : 0;
      showDesign(at(0),model);
      showReactor(at(1),index===1);
      showSeparation(at(2),index===2,separator);
      showInspection(at(3),index===3,model);
      showPackaging(at(4));
    }
    update(-1,0,0,"cyan");
    currentVariant=null;
    return {stations:[design,reactor,separation,inspection,packing],update};
  };
})();
