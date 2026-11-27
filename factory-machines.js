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
    const fluid = finish(0x279e9b, .19, .32);
    const lightTrace = luminous(0x7ce8d7);
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
    cyl(tankFill,lightTrace,0,1.007,0,radius*.92,.014);
    batch(tankFill); batch(reactor);

    // 纯化工位：可见柱床、洗脱色带以及连接各柱的总管。
    const separation = skid();
    housing(separation,graphite,0,.67,-.03,2.92,.65,1.60);
    housing(separation,enamel,-1.11,1.61,-.13,.60,1.56,.89);
    panel(separation,-1.12,1.95,.337,.49,.4);
    for (let j=0;j<4;j++) block(separation,graphite,-1.12,1.4+j*.065,.325,.34,.028,.023);
    const bands = [];
    for (let i=0;i<3;i++) {
      const x=-.42+i*.67, z=.03, h=1.53-i*.09;
      cyl(separation,glass,x,1.17+h/2,z,.261,h);
      cyl(separation,alloy,x,1.13,z,.29,.16);
      cyl(separation,enamel,x,1.21+h,z,.29,.16);
      cyl(separation,graphite,x,1.34+h,z,.116,.11);
      cyl(separation,alloy,x,1.18+h/2,z+.24,.014,h);
      cyl(separation,enamel,x,1.44,z,.226,.42);
      const stream=movable(separation,x,1.8,z);
      cyl(stream,i===1 ? brass : trace,0,0,0,.233,.26);
      cyl(stream,lightTrace,0,.14,0,.232,.019);
      batch(stream); bands.push(stream);
      tube(separation,alloy,[[x,1.40+h,z],[x,1.58+h,z],[x,1.65+h,-.15],[x,1.65+h,-.56],[x,1.58+h,-.66]],.039);
    }
    tube(separation,alloy,[[-1.13,2.47,-.18],[-1.13,3.13,-.47],[-.87,3.20,-.66],[.99,3.12,-.66],[1.21,2.94,-.66],[1.21,1.08,-.66]],.053);
    for (let i=0;i<3;i++) flange(separation,brass,-.42+i*.67,.72,.80,.10,.06,"z");
    batch(separation);

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
    cyl(inspection,glass,0,1.88,-.12,.175,.68);
    cyl(inspection,trace,0,1.83,-.12,.145,.44);
    cyl(inspection,alloy,0,2.24,-.12,.182,.08);
    const beam=movable(inspection,0,1.97,-.12);
    flange(beam,lightTrace,0,0,0,.015,1.2,"x");
    batch(beam);
    block(inspection,alloy,.52,1.95,-.65,.12,.98,.14);
    panel(inspection,.68,2.62,-.64,1.16,.7);
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
    const vials=[];
    for(let i=0;i<3;i++) {
      const vial=movable(packing,0,1.48,0);
      cyl(vial,enamel,0,.22,0,.152,.40);
      bulb(vial,enamel,0,.418,0,.152,.066);
      cyl(vial,graphite,0,.479,0,.097,.077);
      cyl(vial,trace,0,.545,0,.115,.081);
      cyl(vial,i===1 ? brass : trace,0,.21,0,.154,.135);
      batch(vial); vials.push(vial);
    }
    batch(packing);

    let currentVariant;
    function update(index, progress, time, variant, model = "bright") {
      const p = Math.max(0, Math.min(1, progress || 0));
      if (variant !== currentVariant) {
        const gold = variant === "amber";
        trace.color.setHex(gold ? 0xecac59 : 0x42c6b6).convertSRGBToLinear();
        trace.emissive.setHex(gold ? 0x301a09 : 0x102c30);
        fluid.color.setHex(gold ? 0xc28a4b : 0x238e92).convertSRGBToLinear();
        lightTrace.color.setHex(gold ? 0xffce83 : 0x83ebdd).convertSRGBToLinear();
        currentVariant = variant;
      }
      molecule.rotation.y = .4 + time * (index === 0 ? .52 : .16);
      molecule.rotation.z = -.11;
      cleanFold.visible = model === "clean";
      brightFold.visible = !cleanFold.visible;
      impeller.rotation.y = index === 1 ? p * tau * 4 : 0;
      tankFill.scale.y = index === 1 ? .30 + p * .70 : index > 1 ? 1 : .30;
      bands.forEach((band, i) => {
        const local = index === 2 ? Math.max(0,Math.min(1,p*2.25-i*.54)) : index>2 ? 1 : 0;
        band.position.y = 2.55-i*.09 - .78*local;
      });
      beam.visible = index === 3;
      opticalSweep.visible = index === 3;
      opticalSweep.position.y = 1.76 + .38 * (.5-.5*Math.cos(p*tau*2));
      vials.forEach((vial,i) => {
        const travel = index===4 ? p * 2 : index>4 ? 2 : 0;
        const beltPosition = (i+.17+travel)%3;
        vial.position.x = -1.44 + beltPosition*.96;
        const edgeScale = Math.min(1, beltPosition/.16, (3-beltPosition)/.16);
        vial.scale.setScalar(edgeScale);
      });
      nozzle.position.y = 2.48 - (index === 4 ? .3*Math.pow(Math.sin(p*tau), 6) : 0);
    }
    update(-1,0,0,"cyan");
    currentVariant = null;
    return {stations:[design,reactor,separation,inspection,packing],update};
  };
})();
