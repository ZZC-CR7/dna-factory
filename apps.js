/* AI 蛋白质工厂：由同一个批次驱动控制面板、工位动画和交付记录。 */
(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const stationNames = ["AI 设计", "细胞生产", "分离纯化", "光学质检", "包装交付"];
  const stations = [
    ["定制示踪蛋白", "为展陈实验室选定荧光通道，对比两个预设候选模型，再签发生产工单。", "确认设计并投产", 7200],
    ["反应器内的细胞生产", "透过罐壁观察细胞、桨叶和目标蛋白。留意物料送出时，目标组分仍与杂质混在一起。", "启动生产批次", 12000],
    ["从混合物中分离目标蛋白", "跟随两种带形标记穿过分离柱，比较它们进入哪一个收集容器。", "执行分离", 11200],
    ["判读样品并决定去向", "先观察参比和样品的光学响应，再将通道结果与独立的模拟纯度记录一起对照订单。", "启动光学检测", 12000],
    ["贴签、封装与交付", "跟随同一只样品瓶，观察它怎样就位、分装和封口，再查看本批次记录。", "封装并交付", 7200]
  ];
  const variants = {
    cyan: { name: "青色荧光", channel: "青色通道", code: "C" },
    amber: { name: "琥珀色荧光", channel: "琥珀色通道", code: "A" }
  };
  const models = { bright: "高亮型", clean: "低背景型" };
  const separatorNames = { fast: "快速分离", fine: "精细分离" };
  const host = byId("factoryView");
  const nav = byId("stationNav");
  const control = byId("stationControl");
  const action = byId("actionButton");
  const status = byId("statusText");
  const report = byId("resultPanel");
  const demo = byId("demoButton");
  const guide = window.createProcessGuide(byId("processGuide"), previewAt);
  const range = byId("inspectRange");
  const pauseButton = byId("pauseProcess");
  let batchCount = 0;
  let batch, view, runner = 0, demoTimer = 0, automatic = false;
  let active = 0, inspected = 0, progress = 0, running = false, wide = true;
  let paused = false, transferring = false, previewFraction = null;
  let duration = 0, startedAt = 0;

  function freshBatch() {
    return { id: "PF-" + String(++batchCount).padStart(3, "0"), variant: "cyan", model: "bright",
      separator: "fast", verdict: null, purity: null, measured: false, separations: [], inspections: [] };
  }
  function text(id, value) {
    const node = byId(id);
    if (node.textContent !== value) node.textContent = value;
  }
  function option(field, value, name, hint) {
    return '<button type="button" class="choice" data-field="' + field + '" data-value="' + value +
      '" aria-pressed="' + (batch[field] === value) + '"' + (running ? " disabled" : "") +
      '><strong>' + name + '</strong><small>' + hint + '</small></button>';
  }
  function group(label, content) {
    return '<fieldset class="factory-options"><legend>' + label + '</legend><div class="choice-group">' + content + '</div></fieldset>';
  }
  function readout(label, value) {
    return '<div class="readout"><span>' + label + '</span><b>' + value + '</b></div>';
  }
  function batchTag() { return batch.id + " · " + variants[batch.variant].name; }
  function isQualified() { return batch.purity !== null && batch.purity >= 90; }

  function detail(i) {
    if (i === 0) return group("订单颜色", option("variant","cyan","青色","观察青色通道") + option("variant","amber","琥珀色","观察琥珀色通道")) +
      group("预设候选模型", option("model","bright","高亮型","信号较强，背景较高") + option("model","clean","低背景型","信号适中，背景较低"));
    if (i === 1) return readout("投产订单", batchTag()) + readout("候选模型", models[batch.model]) +
      '<p class="control-note">对应原理演示中的转录、翻译和折叠。</p>';
    if (i === 2) return group("分离路径", option("separator","fast","快速分离","较短流程") + option("separator","fine","精细分离","增加分离时间")) +
      readout("订单验收标准", "示意纯度 ≥ 90%") + (batch.inspections.length ? readout("上次检测", batch.purity + "% · 已退回") : "");
    if (i === 3 && !batch.measured) return readout("订单通道", variants[batch.variant].channel) +
      readout("待核对项目", "样品荧光 · 模拟纯度") + readout("订单纯度要求", "≥ 90%");
    if (i === 3) return readout("样品荧光", variants[batch.variant].channel + "匹配") +
      readout("独立模拟纯度 / 订单要求", batch.purity + "% / ≥ 90%") +
      group("质检决定", option("verdict","release","放行","送往包装线") + option("verdict","rework","退回","返回分离工位"));
    return readout("待封装样品", batchTag()) + readout("质检放行", batch.purity + "% · 通道匹配");
  }
  function refreshMeter(value) {
    const work = active === 3 ? (batch.measured ? .8 + (transferring ? .2 * value : 0) : value * .8) : value;
    const fraction = active === 5 ? 1 : (active + work) / stations.length;
    byId("progressFill").style.width = (100 * fraction) + "%";
    const label = active === 5 ? "5 / 5 · 已交付" : (active + 1) + " / 5 · " + (paused ? "已暂停" : running ? Math.round(100 * work) + "%" : active === 3 && batch.measured ? "待判读" : "待操作");
    if (byId("progressLabel").textContent !== label) text("progressLabel", label);
  }
  function machineProgress() {
    return active === 3 && batch.measured ? 1 : progress;
  }
  function showProcess() {
    const previewing = previewFraction !== null;
    const onBatch = inspected === active;
    const viewedProgress = previewing ? previewFraction : onBatch ? machineProgress() : inspected < active ? 1 : 0;
    const phase = previewing ? "preview" : onBatch && batch.measured && active === 3 ? "measured" :
      onBatch && running ? "run" : inspected < active ? "done" : "idle";
    guide.update({station:inspected, progress:viewedProgress, running:running && onBatch, paused, seekable:!running, variant:batch.variant,
      model:batch.model, separator:batch.separator, phase, purity:batch.purity});
    const percent = String(Math.round(100 * viewedProgress));
    if (range.value !== percent) range.value = percent;
    range.disabled = running;
    pauseButton.hidden = !running;
    text("pauseProcess", paused ? "继续运行" : "暂停观察");
    text("inspectLabel", running ? "设备工序进度" : previewing ? "单机预览 · 拖动查看" : "拖动预览本机工序");
  }
  function syncView() {
    const returnBatch = transferring && batch.verdict === "rework";
    const transfer = active === 3 ? (transferring ? progress : false) : running;
    view.setProcess(Math.min(active,4), machineProgress(), batch.variant, batch.model, returnBatch, batch.separator, transfer);
  }
  function syncNav() {
    Array.from(nav.children).forEach((button, i) => {
      button.setAttribute("aria-current", i === inspected ? "step" : "false");
      button.dataset.done = String(i < active);
      button.title = stationNames[i] + (i < active ? " · 已完成" : i === active ? " · 当前工位" : " · 可预览");
    });
  }
  function paintControls() {
    syncNav();
    text("batchLabel", batchTag());
    text("stationTitle", stations[inspected][0]);
    text("stationDescription", stations[inspected][1]);
    if (byId("stationIndex")) text("stationIndex", "工位 " + String(inspected + 1).padStart(2,"0") + " / 05");
    if (byId("viewLabel")) text("viewLabel", wide ? "车间全景" : stationNames[inspected] + " · 近景");
    const atStation = inspected === active;
    control.innerHTML = atStation ? detail(inspected) : readout("工位状态", inspected < active ? "已完成" : "待上游批次到达") +
      readout("本批进度", active === 5 ? "已交付" : stationNames[active]);
    action.disabled = running;
    action.textContent = active === 5 ? "查看批次交付记录" : running ? "设备运行中…" : atStation ? stations[active][2] : "返回当前生产工位";
    if (atStation && active === 3 && batch.measured && !running) action.textContent = "提交质检决定";
    demo.textContent = automatic ? "接管演示" : "自动演示";
    demo.setAttribute("aria-pressed", String(automatic));
    refreshMeter(progress);
    showProcess();
  }
  function focusStation(i) {
    previewFraction = null;
    syncView();
    inspected = i;
    wide = false;
    view.setStation(i);
    paintControls();
  }
  function stopDemo() {
    automatic = false;
    clearTimeout(demoTimer);
    demo.textContent = "自动演示";
    demo.setAttribute("aria-pressed", "false");
  }
  function visit(i) {
    stopDemo();
    focusStation(i);
  }
  function useMap() {
    const map = document.createElement("div");
    map.className = "fallback-map";
    const title = document.createElement("p");
    title.textContent = "当前设备使用产线平面图，可选择工位并完成订单。";
    map.append(title);
    const buttons = stationNames.map((name, i) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "fallback-station";
      button.textContent = (i + 1) + " · " + name;
      button.addEventListener("click", () => visit(i));
      map.append(button);
      return button;
    });
    host.replaceChildren(map);
    return {
      setStation(i) { buttons.forEach((b,n) => b.setAttribute("aria-pressed",String(n === i))); },
      overview() { buttons.forEach(b => b.setAttribute("aria-pressed","false")); },
      setProcess(i, p, variant) {
        if (i === 0 && p === 0) buttons.forEach(b => b.style.removeProperty("--fill"));
        const b = buttons[i];
        if (b) { b.style.setProperty("--fill", Math.round(p * 100) + "%"); b.dataset.variant = variant; }
      }
    };
  }
  try { view = window.createFactoryView(host, visit); }
  catch (error) { console.warn("3D 视野不可用", error); view = useMap(); }
  function setHome() {
    previewFraction = null;
    syncView();
    wide = true; inspected = Math.min(4, active);
    view.overview(); paintControls();
  }
  function reset() {
    stopDemo();
    cancelAnimationFrame(runner);
    batch = freshBatch(); active = 0; progress = 0; running = false; paused = false; transferring = false;
    report.hidden = true; report.replaceChildren();
    setHome();
    status.textContent = "请选择订单颜色与候选模型。";
  }
  function showReport() {
    const fields = [
      ["批号", batch.id], ["定制产品", variants[batch.variant].name + "示踪蛋白"],
      ["候选模型", models[batch.model]], ["分离记录", batch.separations.join(" → ")],
      ["检验记录", batch.inspections.join(" → ")], ["交付状态", "已封装 · 已放行"]
    ];
    report.innerHTML = '<h2>批次交付记录</h2><div class="report-grid">' + fields.map(([k,v]) =>
      '<div><small>' + k + '</small><b>' + v + '</b></div>').join("") + '</div>';
    report.hidden = false;
  }
  const score = { bright: { fast: 84, fine: 96 }, clean: { fast: 92, fine: 98 } };
  function finishStation() {
    running = false;
    const prev = active;
    if (active === 2) {
      batch.measured = false;
      batch.purity = null;
      batch.separations.push(separatorNames[batch.separator]);
      batch.verdict = null;
    }
    if (active === 3 && !transferring) {
      batch.measured = true;
      batch.purity = score[batch.model][batch.separator];
      syncView();
      focusStation(3);
      status.textContent = "检测记录已生成。请对照订单要求，决定放行还是退回。";
      if (automatic) scheduleDemo();
      return;
    }
    if (active === 3) batch.inspections.push(batch.purity + "% " + (isQualified() ? "放行" : "退回"));
    const rework = active === 3 && !isQualified();
    transferring = false;
    active = rework ? 2 : active + 1;
    if (rework) batch.separator = "fine";
    progress = active === 5 ? 1 : 0;
    if (active === 5) {
      stopDemo(); showReport();
      status.textContent = batchTag() + "已交付，批次记录已生成。";
      setHome();
    } else {
      focusStation(active);
      status.textContent = rework ? "样品已退回。重新分离后，再比较两次检测结果。" :
        stationNames[prev] + "已完成。" + (active === 3 ? "待检样品已到位，可启动检测。" : "本批已转入" + stationNames[active] + "。");
      if (automatic) scheduleDemo();
    }
  }
  function startStation() {
    if (running || active >= 5) return;
    if (inspected !== active) { focusStation(active); return; }
    if (active === 3 && batch.measured) {
      if (!batch.verdict) { status.textContent = "请先根据检测结果选择放行或退回。"; return; }
      if ((batch.verdict === "release") !== isQualified()) {
        status.textContent = isQualified() ? "本批已符合颜色与纯度要求，可选择放行。" : "本批低于 90% 的订单标准，请选择退回重新分离。";
        return;
      }
      transferring = true;
    }
    running = true;
    paused = false;
    progress = 0;
    focusStation(active);
    status.textContent = transferring ? (isQualified() ? "本批放行，样品正在送往包装线。" : "本批退回，样品正在返回分离台。") :
      ["设计台正在核对候选方案。","反应器已启动，可暂停观察罐内运动。","分离台已接收混合样品。","正在读取参比和样品信号。","包装线正在接收已放行样品。"][active];
    duration = transferring ? 2600 : stations[active][3] + (active === 2 && batch.separator === "fine" ? 1800 : 0);
    startedAt = performance.now();
    runner = requestAnimationFrame(tick);
  }
  function tick(now) {
    if (!running || paused) return;
    progress = Math.min(1, Math.max(0, (now - startedAt) / duration));
    syncView();
    refreshMeter(progress);
    showProcess();
    if (progress < 1) runner = requestAnimationFrame(tick);
    else finishStation();
  }
  function resumeProcess() {
    paused = false;
    startedAt = performance.now() - progress * duration;
    runner = requestAnimationFrame(tick);
  }
  function scheduleDemo() {
    clearTimeout(demoTimer);
    demoTimer = setTimeout(() => {
      if (!automatic || running || active === 5) return;
      if (active === 3 && batch.measured) batch.verdict = isQualified() ? "release" : "rework";
      focusStation(active); startStation();
    }, 1000);
  }
  nav.replaceChildren(...stationNames.map((name, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.innerHTML = '<span>0' + (i+1) + '</span><b>' + name + '</b>';
    b.addEventListener("click", () => visit(i));
    return b;
  }));
  control.addEventListener("click", event => {
    const b = event.target.closest("button[data-field]");
    if (!b || running || inspected !== active) return;
    stopDemo();
    batch[b.dataset.field] = b.dataset.value;
    previewFraction = null;
    syncView();
    showProcess();
    if (wide) {
      wide = false;
      view.setStation(active);
      text("viewLabel", stationNames[active] + " · 近景");
    }
    text("batchLabel",batchTag());
    for (const option of control.querySelectorAll("button[data-field]")) option.setAttribute("aria-pressed", String(option.dataset.value === batch[option.dataset.field]));
    status.textContent = "已选择" + b.querySelector("strong").textContent + "。";
  });
  action.addEventListener("click", () => {
    stopDemo();
    if (active === 5) {
      report.tabIndex = -1;
      report.focus({preventScroll:true});
      report.scrollIntoView({block:"center"});
    } else startStation();
  });
  byId("overviewButton").addEventListener("click", () => { stopDemo(); setHome(); });
  byId("resetButton").addEventListener("click", reset);
  function previewAt(fraction) {
    if (running) return;
    stopDemo();
    previewFraction = Math.max(0, Math.min(1, fraction));
    if (wide) {
      wide = false;
      view.setStation(inspected);
      text("viewLabel", stationNames[inspected] + " · 近景");
    }
    view.setProcess(inspected, previewFraction, batch.variant, batch.model, false, batch.separator, false);
    showProcess();
  }
  range.addEventListener("input", () => previewAt(Number(range.value) / 100));
  pauseButton.addEventListener("click", () => {
    if (!running) return;
    stopDemo();
    if (paused) resumeProcess();
    else { cancelAnimationFrame(runner); paused = true; }
    if (inspected !== active) focusStation(active);
    refreshMeter(progress);
    showProcess();
  });
  demo.addEventListener("click", () => {
    if (automatic) { stopDemo(); status.textContent = running ? "已接管，当前设备完成后可继续手动操作。" : "已接管，可手动操作当前工位。"; return; }
    if (active === 5) reset();
    automatic = true;
    if (paused) resumeProcess();
    focusStation(active);
    if (!running) scheduleDemo();
  });
  reset();
  if (new URLSearchParams(location.search).get("auto") === "1") demo.click();
})();

/* 答辩路线：自动演示时显示返回主站入口 */
try {
  if (new URLSearchParams(location.search).get("auto") === "1") {
    const bar = document.createElement("div");
    bar.style.cssText = "position:fixed;right:14px;top:70px;z-index:60;padding:9px 14px;border:1px solid rgba(232,184,117,.5);border-radius:999px;background:rgba(8,17,27,.9);color:#e8cfa4;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.35);";
    bar.innerHTML = '答辩路线 · 蛋白质工厂演示中 <a href="index.html" style="color:#ffd9a0;margin-left:8px;text-decoration:none;">返回主站 →</a>';
    document.body.appendChild(bar);
  }
} catch (e) {}
