/* 与三维设备共用工序进度；投影上的颜色始终同时配有形状和文字。 */
(() => {
  "use strict";

  const phases = [
    [
      ["显示模型", "候选蛋白的折叠构型", s => "设计台转出" + modelName(s) + "的示意构型。两种预设候选对应不同的信号和背景表现。"],
      ["比较信号", "对照目标信号与背景", s => s.model === "clean" ? "低背景型突出目标与背景的区别，其目标信号也较温和。订单颜色指定观察通道。" : "高亮型的目标信号较强，同时也有较高背景。订单颜色指定观察通道。"],
      ["签发工单", "设计选择随工单传递", s => "将" + colorName(s) + "通道和" + modelName(s) + "写入工单，沿线移动的蓝白亮点表示工单发往反应器。"]
    ],
    [
      ["进料", "在观察窗里找到细胞", "液体进入反应罐，乳白色椭圆代表悬浮在液体中的生产细胞。"],
      ["搅拌", "跟随叶轮观察循环", "叶轮带动液体循环，乳白色细胞沿流线移动，分散到罐体各处。"],
      ["积累", "细胞内合成目标蛋白", s => "细胞中逐渐出现" + colorName(s) + "圆点，表示本批目标蛋白正在积累。点的数量仅用于展示变化。"],
      ["转出", "混合物进入下游", "沿线移动的亮点追踪本批物料。目标蛋白和其他组分一起进入分离工位，下一站会标出两者的去向。"]
    ],
    [
      ["进样", "追踪两类组分进入柱体", s => colorName(s) + "圆点代表目标蛋白，灰紫色方粒代表杂质。两类组分随同一份样品进入分离装置。"],
      ["分带", "观察色带之间的距离", "两类组分在柱内迁移速度不同。起初混在一起的圆点和方粒逐渐形成分开的带。"],
      ["分流", "沿两条支路看收集结果", s => (s.separator === "fine" ? "精细分离后，进入目标杯的灰紫方粒更少。" : "快速分离后，部分灰紫方粒仍随目标组分进入目标杯。") + "另一只杯子收集分出的杂质。"],
      ["送检", "将目标杯中的样品送检", "只有目标收集杯里的样品进入质检。灰紫方粒提示仍有杂质，实际判读请看下一站提供的模拟检验记录。"]
    ],
    [
      ["参比", "先记录空白参比", "样品入位前，白色光路显示参比读数，用于观察仪器与背景的贡献。"],
      ["入位", "让样品对准检测光路", s => "带" + colorName(s) + "标记的样品移入测量位置。检测器在激发光路的侧方接收荧光。"],
      ["检测", "区分照入和发出的光", s => "紫色光束照向样品，样品发出的" + colorName(s) + "荧光沿另一方向进入检测器。仪表对照样品信号与背景。"],
      ["记录", "将通道与纯度分别记录", s => s.phase === "measured" && Number.isFinite(s.purity)
        ? "本批已记录" + colorName(s) + "通道。独立的模拟纯度为 " + s.purity + "%，订单要求至少 90%，请据此决定放行或退回。"
        : "荧光用于确认样品的观察通道。纯度采用另附的模拟检验数据，与订单标准一同用于人工判读。"]
    ],
    [
      ["空瓶就位", "让空瓶停在灌装头下方", "输送带将空瓶送到灌装位置。前一道质检决定本批能否进入包装。"],
      ["分装", "观察样品进入瓶内", s => "灌装头落下，瓶内出现" + colorName(s) + "样品。颜色沿用本批订单的追踪标记。"],
      ["封盖贴签", "交付样品与批次记录", "封盖和瓶签把样品与订单关联起来，交付记录保留候选模型、分离过程和历次检验结果。"]
    ]
  ];

  const colorName = s => s.variant === "amber" ? "琥珀色" : "青色";
  const modelName = s => s.model === "clean" ? "低背景型" : "高亮型";
  const graphics = {
    target: ["目标蛋白", "本批颜色"],
    cell: ["生产细胞", "乳白椭圆"],
    impurity: ["杂质", "灰紫方粒"],
    excite: ["激发光", "紫色入射线"],
    emission: ["样品荧光", "订单色出射线"],
    ref: ["参比光路", "白线"],
    corner: ["当前观察工位", "浅色角标"],
    order: ["设计工单", "沿线蓝白亮点"],
    transfer: ["批次转运", "沿线订单色亮点"]
  };
  const keysByStation = [["target","corner","order"],["cell","target","transfer"],["target","impurity","transfer"],["ref","excite","emission"],["target","corner","transfer"]];

  // 放大视图只画动作原理。粒子位置由进度决定，暂停、倒拖都能准确还原。
  function diagram(canvas, station, p, variant, model, separator) {
    const c = canvas.getContext("2d");
    if (!c) return;
    const width = 208, height = 76;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    c.setTransform(dpr,0,0,dpr,0,0);
    c.clearRect(0,0,width,height);
    const target = variant === "amber" ? "#ffbe70" : "#5bd9cf";
    const grey = "#b3a2bc", cell = "#e5eeeb", frame = "#728e99", line = "#9fbbc3";
    const q = (start,end) => Math.max(0,Math.min(1,(p-start)/(end-start)));
    function poly(points,color,weight=1.5) {
      c.beginPath(); points.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y));
      c.lineWidth = weight; c.lineCap = "round"; c.lineJoin="round"; c.strokeStyle = color; c.stroke();
    }
    function rect(x,y,w,h,color) { c.fillStyle=color; c.fillRect(x,y,w,h); }
    function dot(x,y,r,color) { c.fillStyle=color; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill(); }
    function label(x,y,content,color=line) {
      c.font='12px "Microsoft YaHei",system-ui,sans-serif'; c.fillStyle=color; c.fillText(content,x,y);
    }

    if (station === 1) {
      // 同一批细胞在搅拌阶段改变位置。蛋白积累发生在细胞示意区域内。
      c.save(); c.beginPath(); c.roundRect(14,8,127,62,10); c.clip();
      rect(14,8,127,62,"#142e39");
      const fillTop = 55-35*q(0,.24)+18*q(.80,1);
      rect(14,fillTop,127,71-fillTop,"#224958");
      poly([[14,fillTop],[141,fillTop]], "#7498a0");
      const angle = q(.25,.78)*Math.PI*3;
      for (let i=0;i<8;i++) {
        const rad = 16+(i%4)*8, a=i*2.39 + angle;
        const x=77 + Math.cos(a)*rad, y=fillTop+7 + (Math.sin(a)*.42+.46)*(55-fillTop);
        c.save(); c.translate(x,y); c.rotate(a*.6); c.beginPath(); c.ellipse(0,0,6,3.6,0,0,Math.PI*2);
        c.fillStyle=cell; c.fill();
        if ((i+.5)/8 <= q(.50,.73)) dot(0,0,2.2,target);
        c.restore();
      }
      poly([[77,7],[77,32]],frame,2);
      poly([[65,29],[77,32],[89,29]],frame,3);
      c.restore();
      c.strokeStyle=frame; c.lineWidth=1.5; c.beginPath(); c.roundRect(14,8,127,62,10);c.stroke();
      poly([[141,49],[163,49],[175,38],[199,38]],frame,2);
      if (p>=.75) {
        const travel=q(.76,.98); dot(145 + travel*49,49-Math.min(11,Math.max(0,(travel-.38)*38)),3,target);
      }
      label(151,64,"出料");
    } else if (station === 2) {
      const sep=q(.24,.51), split=q(.51,.80), slide=q(0,.25), endX=37+slide*56+split*39;
      c.fillStyle="#1d3441"; c.fillRect(15,19,107,35);
      c.strokeStyle=frame;c.lineWidth=1.5;c.strokeRect(15,19,107,35);
      poly([[122,33],[132,33],[148,15],[171,15]],frame,1.5);
      poly([[122,43],[133,43],[148,60],[171,60]],frame,1.5);
      for(const [y,col] of [[15,target],[59,grey]]) {
        poly([[171,y-9],[171,y+9],[197,y+9],[197,y-9]],col);
      }
      for (let i=0;i<6;i++) {
        const x=endX-((5-i)%3)*5 + split*44, d=(i%2)*4;
        dot(x,34+d-5*sep-16*split,2.7,target);
        const residual = i < (separator === "fine" ? 1 : 3);
        const y=35+d+6*sep + split*(residual ? -26 : 15);
        rect(x-1,y-1,4,4,grey);
      }
      label(17,72,"分离柱");label(145,39,"目标杯",target);
    } else if (station === 3) {
      // 参比、激发和接收光以位置和颜色共同编码。
      const centerX=73, centerY=45;
      poly([[14,45],[68,45]],p<.25?"#edf4f3":p>=.50?"#c398ff":frame,p<.25||p>=.50?3:1);
      rect(8,39,12,12,"#728797");
      const vialX=94-21*q(.25,.48);
      c.strokeStyle=cell;c.lineWidth=1.5;c.strokeRect(vialX-6,centerY-6,12,12);
      if(p>=.25)dot(vialX,centerY,3.2,target);
      poly([[centerX,39],[centerX,15],[94,15]],p>=.50?target:frame,p>=.50?3:1);
      rect(94,10,10,10,"#99abb1");
      label(8,70,p<.25?"空白参比":"光源");label(108,18,"检测器");
      const baseline=59, gain=model==="clean"?16:29, bg=model==="clean"?2:6, scan=q(.50,.77);
      poly([[135,28],[135,baseline],[199,baseline]],frame,1);
      if(p>=.50){
        const curve=[], base=[];
        for(let i=0;i<=Math.floor(scan*60);i++) {
          const x=137+i, signal=gain*Math.exp(-Math.pow((i-32)/10,2));
          base.push([x,baseline-bg]);
          curve.push([x,baseline-bg-signal]);
        }
        poly(base,grey,1.5); poly(curve,target,2);
      }
      label(140,73,"相对信号");
    }
  }

  window.createProcessGuide = function createProcessGuide(host, onSeek) {
    const root = document.createElement("section");
    root.className="pg-guide";root.setAttribute("aria-label","设备工序解说");
    root.innerHTML = '<div class="pg-trail"><ol aria-label="本工位动作顺序"></ol></div>' +
      '<div class="pg-reading"><div class="pg-caption" aria-live="polite" aria-atomic="true"><div class="pg-capline"><span class="pg-mode"></span><h3></h3></div><p></p></div>' +
      '<figure class="pg-detail"><canvas aria-hidden="true"></canvas><figcaption></figcaption></figure></div>' +
      '<ul class="pg-keys" aria-label="当前画面图例"></ul>';
    host.replaceChildren(root);
    const trail=root.querySelector("ol"), heading=root.querySelector("h3"), summary=root.querySelector("p");
    const mode=root.querySelector(".pg-mode"), figure=root.querySelector("figure"), canvas=root.querySelector("canvas");
    const caption=root.querySelector("figcaption"), keyList=root.querySelector(".pg-keys");
    let lastStation=-1, lastCaption="", lastLegend="", lastDrawing="";
    const fillText = (el, value) => { if(el.textContent !== value) el.textContent = value; };
    function update(s) {
      if (!Number.isInteger(s.station) || !phases[s.station]) return;
      const station=s.station, steps=phases[station];
      const p=Math.min(1, Math.max(0, Number(s.progress) || 0));
      const idx=Math.min(steps.length-1,Math.floor(p*steps.length));
      const meta = [idx,station,s.phase,s.paused,s.running,s.variant,s.model,s.separator,s.purity,s.seekable].join("/");
      if (meta !== lastCaption) {
        if(lastStation !== station) {
          trail.replaceChildren(...steps.map(([name], i) => {
            const li=document.createElement("li");
            const element=document.createElement(onSeek?"button":"span");
            element.textContent=name;
            if(onSeek) {
              element.type="button"; element.setAttribute("aria-label","查看"+name+"阶段");
              element.addEventListener("click",()=>onSeek((i+.5)/steps.length));
            }
            li.append(element);
            return li;
          }));
          figure.hidden=!(station>=1 && station<=3);
          if(!figure.hidden)caption.textContent=["","反应罐剖面","组分去向","光路与信号"][station];
          lastStation=station;
        }
        [...trail.children].forEach((li,i)=>{
          li.dataset.state=i===idx?"now":i<idx?"past":"next";
          const el=li.firstElementChild;
          if(i===idx)el.setAttribute("aria-current","step");else el.removeAttribute("aria-current");
          if(onSeek)el.disabled=!s.seekable;
        });
        fillText(mode,s.paused?"已暂停":s.phase==="measured"?"检测完成":s.phase==="done"?"已完成":s.running?"设备运行":s.phase==="preview"?"工序预览":"观察要点");
        const [,title,explain]=steps[idx];
        fillText(heading,title);fillText(summary,typeof explain === "function" ? explain(s) : explain);
        lastCaption=meta;
      }
      const legendKey=station+"/"+s.variant;
      if(legendKey!==lastLegend) {
        root.dataset.variant=s.variant==="amber"?"amber":"cyan";
        keyList.replaceChildren(...keysByStation[station].map(key=>{
          const [name,style]=graphics[key], li=document.createElement("li");
          const symbol=document.createElement("i");symbol.className="pg-mark pg-mark-"+key;symbol.setAttribute("aria-hidden","true");
          const label=document.createElement("span");
          label.textContent=(key==="target"?colorName(s)+"圆点":key==="emission"?colorName(s)+"出射线":style)+" · "+name;
          li.append(symbol,label);return li;
        }));
        lastLegend=legendKey;
      }
      if(!figure.hidden) {
        // 限制到约每段 50 次变化，避免重复绘制静止或暂停的放大窗。
        const frameKey=[station,Math.round(p*200),s.variant,s.model,s.separator].join("/");
        if(frameKey!==lastDrawing) {
          diagram(canvas,station,p,s.variant,s.model,s.separator);
          lastDrawing=frameKey;
        }
      }
    }
    return {update};
  };
})();
