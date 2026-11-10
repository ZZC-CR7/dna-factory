(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const canvas = $("#moleculeCanvas");
  const ctx = canvas.getContext("2d");
  const heroCanvas = $("#heroCanvas");
  const heroCtx = heroCanvas.getContext("2d");
  const TAU = Math.PI * 2;
  const W = 1000, H = 560;
  const TARGET = "GACTGACCTGTTACGGAATGAGG";
  const GUIDE = "GACUGACCU GUUACGGAAUG".replaceAll(" ", "");
  const complement = { A: "T", T: "A", C: "G", G: "C", U: "A" };
  const baseColors = { A: "#65c1c9", T: "#dfa860", C: "#729bca", G: "#b27daf", U: "#91cba9" };

  // ── 音效模块：纯 WebAudio 合成，无外部资源 ─────────────────────────
  const AudioFX = (() => {
    let ctx = null, enabled = true;
    try { enabled = localStorage.getItem("crispr.sound") !== "off"; } catch {}
    const ensure = () => {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ctx) ctx = new AC();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      return ctx;
    };
    const tone = (freq, dur, type = "sine", gain = .05, delay = 0) => {
      const c = ensure(); if (!c || !enabled) return;
      const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + .05);
    };
    return {
      isEnabled: () => enabled,
      setEnabled(v) { enabled = v; try { localStorage.setItem("crispr.sound", v ? "on" : "off"); } catch {} },
      click() { tone(880, .05, "sine", .035); },
      error() { tone(196, .14, "sawtooth", .04); tone(147, .18, "sawtooth", .03, .08); },
      step() { tone(466, .08, "sine", .035); },
      success() { tone(523, .1, "sine", .045); tone(659, .1, "sine", .045, .09); tone(784, .16, "sine", .045, .18); },
      cut() { tone(240, .1, "sawtooth", .05); tone(180, .16, "sawtooth", .05, .09); },
      achievement() { tone(587, .09, "triangle", .05); tone(740, .09, "triangle", .05, .09); tone(880, .14, "triangle", .05, .18); },
      complete() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .18, "sine", .05, i * .13)); },
      transition() { tone(392, .12, "sine", .04); tone(587, .16, "sine", .04, .1); }
    };
  })();

  const layerData = {
    1: { title: "DNA 解旋与复制", subtitle: "打开双链，沿模板合成互补 DNA", mode: "DNA 复制", toolIds: ["helicase", "polymerase", "ligase"], sequence: "ATGCCGTAGCTA", bottom: "TACGGCATCGAT", note: "点击 A、T、C、G 碱基，或查看糖—磷酸骨架。", scene: "复制叉形成", link: "复制出的新链携带完整遗传信息，其中的任何一段基因位点，都可以被下一层的 CRISPR 系统精确找到。", meaning: "DNA 半保留复制是细胞分裂与遗传信息代代相传的基础；许多抗癌药物也作用于 DNA 复制过程。" },
    2: { title: "DNA 靶向编辑与调控", subtitle: "以 CRISPR-Cas9 演示靶向识别、切割、修复与表达调控", mode: "CRISPR · Cas9", toolIds: ["cas9", "donor", "activator", "repressor", "marker"], sequence: TARGET, bottom: [...TARGET].map(c => complement[c]).join(""), note: "向导 RNA 与靶序列配对；Cas9 还需识别邻近 PAM。", scene: "靶向编辑", link: "编辑后的基因序列将作为模板被转录成 RNA——遗传信息开始向外传递。", meaning: "基因编辑正在改变医学与农业：CRISPR 基因疗法已获批治疗镰刀型细胞贫血等遗传病，也被用于抗病育种与合成生物学。" },
    3: { title: "转录与 RNA 剪接", subtitle: "将 DNA 信息转录为 RNA，再加工成熟", mode: "RNA 加工", toolIds: ["rnaPol", "spliceosome", "nuclearPore"], sequence: "ATGCCGTAGCTA", bottom: "AUGCCGUAGCUA", note: "前体 mRNA 包含外显子与内含子；剪接后形成成熟 mRNA。", scene: "从基因到成熟 mRNA", link: "成熟 mRNA 携带编辑后的信息进入细胞质，交给核糖体翻译成蛋白质。", meaning: "同一基因因剪接方式不同可产生多种蛋白质；剪接异常与多种遗传病相关，剪接调控也是药物研发热点。" },
    4: { title: "翻译与蛋白质合成", subtitle: "核糖体读取密码子，tRNA 递送氨基酸", mode: "蛋白质翻译", toolIds: ["ribosome", "trna", "amino", "chaperone"], sequence: "AUGCCGGUAGCU", bottom: "UACGGCCAUCGA", note: "每三个 RNA 碱基组成一个密码子。", scene: "读取遗传密码", link: "新生多肽链需要折叠成正确构象，并在信号肽指引下被送往细胞各处发挥作用。", meaning: "遗传密码的解读是中心法则的核心；许多抗生素正是通过干扰细菌核糖体的翻译来杀菌。" },
    5: { title: "细胞内蛋白质转运", subtitle: "观察分泌蛋白从内质网到细胞外的路径", mode: "蛋白质转运", toolIds: ["signal", "er", "vesicle", "golgi", "membrane"], sequence: "", bottom: "", note: "信号肽、囊泡和细胞器共同决定蛋白质去向。", scene: "细胞层级的运输路径", link: "至此，一段 DNA 上的信息经过解旋、编辑、转录、翻译与运输，最终变成细胞外的蛋白质——生命就是这样运作的。", meaning: "分泌蛋白是胰岛素、抗体等生物药的基础；理解转运机制，才能工程化生产重组蛋白药物。" }
  };

  const toolData = {
    helicase: ["解旋酶", "打开 DNA 双链", "#7fc9d5", "◉"],
    polymerase: ["DNA 聚合酶", "沿模板延伸新链", "#91d0ae", "＋"],
    ligase: ["DNA 连接酶", "封合 DNA 片段", "#e8b875", "⌁"],
    cas9: ["Cas9 · sgRNA", "识别靶序列并切割 DNA", "#7fc9d5", "✂"],
    donor: ["供体 DNA", "HDR 精准修复模板", "#e8b875", "↔"],
    activator: ["dCas9 · VP64", "提高目标基因转录", "#91d0ae", "+"],
    repressor: ["dCas9 · KRAB", "抑制目标基因转录", "#d99b91", "−"],
    marker: ["dCas9 · 荧光标记", "显示目标基因位点", "#b7a2e4", "✳"],
    rnaPol: ["RNA 聚合酶", "读取 DNA 模板生成 RNA", "#7fc9d5", "Ⅱ"],
    spliceosome: ["剪接体", "去除内含子并连接外显子", "#b7a2e4", "◉"],
    nuclearPore: ["核孔复合体", "帮助成熟 mRNA 输出", "#e8b875", "⇢"],
    ribosome: ["核糖体", "沿 mRNA 读取密码子", "#7fc9d5", "R"],
    trna: ["tRNA", "以反密码子配对并递送氨基酸", "#91d0ae", "Y"],
    amino: ["氨基酸", "多肽链的基本组成单元", "#e8b875", "•"],
    chaperone: ["分子伴侣", "协助新生多肽正确折叠", "#b7a2e4", "⌘"],
    signal: ["信号肽", "引导新生蛋白进入分泌通路", "#e8b875", "→"],
    er: ["粗面内质网", "协助分泌蛋白折叠与初步加工", "#7fc9d5", "≋"],
    vesicle: ["运输囊泡", "在细胞器之间运送蛋白货物", "#e8b875", "○"],
    golgi: ["高尔基体", "进一步加工、分类和包装蛋白", "#b7a2e4", "▤"],
    membrane: ["细胞膜", "分泌蛋白可到达的细胞边界", "#91d0ae", "│"]
  };

  const descriptions = {
    A: ["含氮碱基 · 腺嘌呤", "A 与 T 互补配对，在 DNA 双链中通过两条氢键连接。"],
    T: ["含氮碱基 · 胸腺嘧啶", "T 与 A 互补配对；RNA 中通常以 U（尿嘧啶）替代 T。"],
    C: ["含氮碱基 · 胞嘧啶", "C 与 G 互补配对，通过三条氢键连接。"],
    G: ["含氮碱基 · 鸟嘌呤", "G 与 C 互补配对；A/G 为双环嘌呤碱基。"],
    U: ["含氮碱基 · 尿嘧啶", "U 是 RNA 中的碱基，可与 A 配对。"],
    deoxyribose: ["脱氧核糖", "DNA 核苷酸中的五碳糖，与磷酸交替构成糖—磷酸骨架。"],
    ribose: ["核糖", "RNA 核苷酸中的五碳糖。RNA 的核糖比 DNA 的脱氧核糖多一个羟基。"],
    phosphate: ["磷酸基团", "连接相邻脱氧核糖，形成 DNA 链的外侧骨架并赋予其负电荷。"],
    backbone: ["糖—磷酸骨架", "两条 DNA 链反向平行排列；碱基朝向内侧配对。"],
    hydrogenBond: ["氢键", "碱基配对由氢键稳定：A–T 通常形成两条，G–C 通常形成三条。"],
    basePair: ["互补碱基对", "DNA 中 A 与 T 配对、G 与 C 配对；配对规则支持复制和遗传信息读取。"],
    pam: ["PAM · NGG", "SpCas9 需要在靶序列邻近识别 PAM；PAM 本身不属于 gRNA 的 20 nt 配对区。"],
    guide: ["向导 RNA · sgRNA", "向导区与靶 DNA 互补配对，把 Cas9 引导到目标位置。"],
      locus: ["目标基因位点", "基因位点是基因组上具有特定位置的 DNA 区域。定位并标记它，能帮助说明编辑或调控发生在哪里、可能影响哪段遗传信息。"],
    exon: ["外显子", "RNA 剪接过程中保留并连接到成熟 mRNA 的片段。"],
    intron: ["内含子", "pre-mRNA 中通常被剪接体移除的片段。"],
    codon: ["密码子", "mRNA 上连续的三个核苷酸，指定氨基酸或翻译终止信号。"],
    aminoAcid: ["氨基酸", "核糖体根据密码子顺序连接氨基酸，形成多肽链。"]
  };

  const state = {
    layer: 0, selectedTool: "helicase", hits: [], dragging: null,
    achieved: new Set(), parts: {},
    hover: null,
    zoom: 0,
    uncoil: 1,
    motion: null,
    camera: { x: 500, y: 280, zoom: 1 },
    cameraTarget: { x: 500, y: 280, zoom: 1 },
    lastFrame: 0,
    toastTimer: 0
  };

  function partInfo(key, layer = state.layer) {
    if (descriptions[key]) return descriptions[key];
    const names = {
      helicase: ["解旋酶", "沿 DNA 移动并破坏碱基间氢键，使双链局部打开，形成复制叉。"],
      polymerase: ["DNA 聚合酶", "以亲代 DNA 链为模板，按互补配对原则合成新 DNA。"],
      ligase: ["DNA 连接酶", "连接 DNA 骨架中的缺口；复制时可封合冈崎片段。"],
      cas9: ["Cas9 核酸酶", "与向导 RNA 组成复合体，在识别目标及 PAM 后切开 DNA 双链。"],
      donor: ["供体 DNA 模板", "在 HDR 示意中提供期望序列；真实修复效率受细胞状态与实验条件影响。"],
      activator: ["dCas9 · VP64", "失活 Cas9 不切割 DNA，融合转录激活结构域后可提高目标基因表达。"],
      repressor: ["dCas9 · KRAB", "失活 Cas9 定位到调控区域后，可抑制目标基因转录。"],
      marker: ["dCas9 · 荧光标记", "将荧光蛋白招募到特定基因位点，用于观察染色体区域。"],
      nucleus: ["细胞核", "真核细胞中 DNA 的主要储存位置；转录与 RNA 加工主要发生在细胞核内。"],
      rnaPolymerase: ["RNA 聚合酶", "读取 DNA 模板链，合成与模板互补的 RNA 转录本。"],
      preMrna: ["前体 mRNA", "真核细胞初级转录本，包含外显子和内含子，需加工后成为成熟 mRNA。"],
      spliceosome: ["剪接体", "由小核 RNA 和蛋白质组成，识别剪接位点并移除内含子。"],
      pore: ["核孔复合体", "控制 RNA 和蛋白质等大分子在细胞核与细胞质之间运输。"],
      ribosome: ["核糖体", "读取 mRNA 密码子并催化肽键形成，是蛋白质翻译的场所。"],
      trna: ["转运 RNA · tRNA", "反密码子与 mRNA 密码子配对，将相应氨基酸递送到核糖体。"],
      peptide: ["多肽链", "氨基酸按序连接成多肽，随后折叠并可能经过修饰或组装。"],
      er: ["粗面内质网", "许多分泌蛋白和膜蛋白在此进入分泌途径，并进行折叠和初步加工。"],
      golgi: ["高尔基体", "对蛋白质进一步加工、分类和包装，再送往各自目的地。"],
      vesicle: ["运输囊泡", "包裹蛋白货物并在膜性细胞器之间运输。"],
      membrane: ["细胞膜", "分泌途径中的蛋白可被送至细胞膜或释放到细胞外。"],
      protein: ["蛋白质货物", "蛋白质的定位信号与细胞运输机制共同决定其最终去向。"],
      promoter: ["启动子区域", "转录因子和 RNA 聚合酶等因子在此调控基因转录起始。"],
      repair: ["DNA 修复", "双链断裂可由不同细胞修复路径处理；NHEJ 常产生插入或缺失，HDR 可利用供体模板。"],
      replicationFork: ["复制叉", "DNA 双链局部打开形成的 Y 形区域，是新链合成发生的位置。"],
      cell: ["真核细胞", "细胞器分工协作，执行转录、翻译、蛋白加工与运输等过程。"],
      rna: ["RNA 转录本", "由 RNA 聚合酶合成，携带 DNA 的序列信息进入后续加工或翻译。"]
    };
    return names[key] || [toolData[key]?.[0] || "分子结构", toolData[key]?.[1] || "点击查看当前层级中该结构的作用。"];
  }

  function showStructure(key, label) {
    const [title, text] = partInfo(key);
    $("#structureCategory").textContent = label || layerData[state.layer]?.title || "结构说明";
    $("#structureTag").textContent = "结构说明";
    $("#structureTitle").textContent = title;
    $("#structureText").textContent = text;
    $("#metaValue").textContent = `${String(state.layer).padStart(2, "0")} / ${layerData[state.layer]?.mode || "DNA"}`;
    state.selectedPart = key;
    drawScene(performance.now());
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2100);
  }

  function setOutcome(status, title, text, visual) {
    $("#resultState").textContent = status;
    $("#outcomeTitle").textContent = title;
    $("#outcomeText").textContent = text;
    $(".result-caption").textContent = visual || status;
  }

  function award(id, message) {
    const trackedAchievements = new Set(["helix", "copy", "edit", "protein", "transport"]);
    if (!trackedAchievements.has(id)) { if (message) showToast(message); return; }
    if (state.achieved.has(id)) return;
    state.achieved.add(id);
    AudioFX.achievement();
    const row = $(`[data-achievement="${id}"]`);
    if (row) { row.classList.add("unlocked"); row.querySelector("i").textContent = "✓"; }
    $("#achievementCount").textContent = `${state.achieved.size} / 5`;
    $("#progressFill").style.width = `${state.achieved.size * 20}%`;
    $("#progressText").textContent = `${state.achieved.size} / 5`;
    if (message) showToast(message);
  }

  function renderTools() {
    const list = $("#toolList");
    const data = layerData[state.layer];
    list.innerHTML = data.toolIds.map(id => {
      const [title, desc, color, icon] = toolData[id];
      return `<button class="tool-card ${id === state.selectedTool ? "selected" : ""}" data-tool="${id}" type="button" aria-pressed="${id === state.selectedTool}">
        <span class="tool-symbol" style="--tool-color:${color}">${icon}</span><span class="tool-copy"><b>${title}</b><small>${desc}</small></span><span class="tool-grip">⠿</span>
      </button>`;
    }).join("");
    $("#toolCount").textContent = String(data.toolIds.length).padStart(2, "0");
    list.querySelectorAll(".tool-card").forEach(card => card.addEventListener("click", () => selectTool(card.dataset.tool)));
  }

  function selectTool(id) {
    state.selectedTool = id;
    AudioFX.click();
    $$(".tool-card").forEach(card => {
      const active = card.dataset.tool === id;
      card.classList.toggle("selected", active);
      card.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const [title] = toolData[id];
    $("#instructionTool").textContent = title;
    showStructure(id, "分子工具");
    showToast(`已选择：${title}`);
  }

  function renderSequence() {
    const data = layerData[state.layer];
    const panel = $("#sequencePanel");
    panel.hidden = !data.sequence;
    if (!data.sequence) return;
    const top = [...data.sequence];
    const bottom = [...data.bottom];
    const pamStart = state.layer === 2 ? 20 : -1;
    const make = (char, index, isTop) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `base-chip ${index >= pamStart && state.layer === 2 ? "pam-chip" : ""} ${state.layer === 2 && index < 20 && isTop ? "guide-match" : ""}`;
      chip.dataset.base = char;
      chip.dataset.index = String(index);
      chip.textContent = char;
      chip.title = `${char} · 第 ${index + 1} 位；点击查看结构说明`;
      chip.addEventListener("click", () => showStructure(char, `${isTop ? "目标链" : "互补链"} · 第 ${index + 1} 位`));
      return chip;
    };
    const topHost = $("#topSequence"), bottomHost = $("#bottomSequence");
    topHost.innerHTML = ""; bottomHost.innerHTML = "";
    topHost.style.gridTemplateColumns = `repeat(${top.length}, minmax(0, 1fr))`;
    bottomHost.style.gridTemplateColumns = `repeat(${bottom.length}, minmax(0, 1fr))`;
    top.forEach((char, i) => topHost.append(make(char, i, true)));
    bottom.forEach((char, i) => bottomHost.append(make(char, i, false)));
    $("#sequenceLabel").textContent = state.layer === 2 ? "CRISPR 靶序列" : state.layer === 4 ? "mRNA / 反密码子" : "碱基序列";
    $("#sequenceCaption").textContent = state.layer === 2 ? "向导区 20 nt + PAM" : data.note;
    $("#sequenceDirection").innerHTML = state.layer === 4 ? "密码子 <b>3 nt</b>" : "反向平行 <b>↕</b>";
    $("#sequenceFoot").innerHTML = state.layer === 2
      ? '<span><i class="sequence-underline"></i>gRNA 配对区</span><span><i class="pam-underline"></i>PAM：NGG</span><span id="matchReadout" class="match-readout">尚未识别</span>'
      : `<span><i class="sequence-underline"></i>${data.note}</span><span id="matchReadout" class="match-readout">点击碱基了解结构</span>`;
  }

  function switchLayer(layer) {
    if (state.tour?.running && !state.tour.autoSwitch) stopTour();
    AudioFX.transition();
    $("#layerMeaning").textContent = "";
    state.layer = Number(layer);
    state.parts = {};
    state.uncoil = state.layer === 1 ? 0 : 1;
    state.motion = null;
    state.camera = { x: 500, y: 280, zoom: state.layer === 1 ? 1.2 : 1 };
    state.cameraTarget = { ...state.camera };
    state.selectedPart = null;
    state.selectedTool = layerData[state.layer].toolIds[0];
    document.body.classList.add("in-lab");
    $("#workspace").hidden = false;
    const d = layerData[state.layer];
    $("#crumbTitle").textContent = d.title;
    $("#moduleKicker").textContent = `层级 ${String(state.layer).padStart(2, "0")} / ${d.mode}`;
    $("#moduleHeading").textContent = d.title;
    $("#moduleIntro").textContent = d.subtitle;
    $("#levelIndicator").textContent = `${String(state.layer).padStart(2, "0")} / 05`;
    $("#sceneTitle").textContent = d.scene;
    $("#canvasMode").innerHTML = `${d.mode} <b>·</b> 示意模型`;
    $("#zoomBadge").hidden = state.layer !== 1;
    $("#cameraLabel").hidden = true;
    $("#motionProgress").hidden = true;
    $("#calloutText").textContent = d.note;
    $("#actionNote").querySelector("span:last-child").textContent = d.note;
    const legends = {
      1: [["legend-dna", "亲代 DNA"], ["legend-guide", "新生链"], ["legend-pam", "复制叉"]],
      2: [["legend-dna", "目标 DNA"], ["legend-guide", "向导 RNA"], ["legend-pam", "PAM 区域"]],
      3: [["legend-dna", "DNA 模板"], ["legend-guide", "RNA 转录本"], ["legend-pam", "剪接区域"]],
      4: [["legend-dna", "mRNA"], ["legend-guide", "tRNA"], ["legend-pam", "氨基酸"]],
      5: [["legend-dna", "运输路径"], ["legend-guide", "蛋白货物"], ["legend-pam", "细胞器"]]
    };
    $("#stageLegend").innerHTML = legends[state.layer].map(([cls, text]) => `<span><i class="${cls}"></i>${text}</span>`).join("");
    $$("#layerNav button").forEach(button => button.classList.toggle("active", Number(button.dataset.layer) === state.layer));
    renderTools();
    renderSequence();
    updateActionLabel();
    updateProgress();
    setOutcome("准备开始", "完成本层互动", "按照场景提示放置分子工具，逐步推进遗传信息流程。", "等待分子事件");
    showStructure("backbone", d.title);
    drawScene(performance.now());
    requestAnimationFrame(() => $("#moleculeCard").classList.add("entered"));
  }

  function goHome() {
    if (state.tour?.running) stopTour();
    state.motion = null;
    document.body.classList.remove("in-lab");
    $("#workspace").hidden = true;
    $("#crumbTitle").textContent = "从 DNA 到蛋白质";
    $("#progressFill").style.width = "0%";
    $("#progressText").textContent = "首页";
    state.layer = 0;
    drawHero(performance.now());
  }

  function updateProgress() {
    $("#progressFill").style.width = `${Math.max(state.achieved.size * 20, state.layer * 6)}%`;
    $("#progressText").textContent = state.achieved.size ? `${state.achieved.size} / 5` : `${String(state.layer).padStart(2, "0")} / 05`;
  }

  function resetLayer() {
    state.parts = {};
    state.motion = null;
    state.cameraTarget = { x: 500, y: 280, zoom: state.layer === 1 ? 1.2 : 1 };
    $("#cameraLabel").hidden = true;
    $("#motionProgress").hidden = true;
    state.selectedPart = null;
    if (state.layer === 1) { $("#instructionTool").textContent = "解旋酶"; }
    if (state.layer === 2) { $("#instructionTool").textContent = "Cas9 · sgRNA"; }
    $("#repairActions").hidden = true;
    $("#primaryAction").disabled = false;
    updateActionLabel();
    setOutcome("准备开始", "完成本层互动", "按照场景提示放置分子工具，逐步推进遗传信息流程。", "等待分子事件");
    showStructure("backbone", layerData[state.layer].title);
    drawScene(performance.now());
  }

  function updateActionLabel() {
    $("#primaryActionLabel").textContent = state.motion ? "动画播放中…" : state.parts.completed ? "重新播放完整过程" : "播放完整过程";
  }

  function showOutcomeForState() {
    const p = state.parts;
    if (state.layer === 1) {
      if (p.sealed) setOutcome("复制完成", "半保留复制已完成", "两条子代 DNA 各保留一条亲代链，并包含一条新合成链。", "亲代链 + 新生链");
      else if (p.copied) setOutcome("新链合成", "连接冈崎片段", "聚合酶延伸新链；接下来用 DNA 连接酶封合片段。", "新生 DNA 链");
      else if (p.opened) setOutcome("复制叉形成", "双链已打开", "亲代链作为模板；按 A–T、C–G 配对加入互补核苷酸。", "解旋酶到位");
      else setOutcome("准备开始", "选择解旋酶", "把解旋酶拖到双链中央，打开复制叉。", "DNA 双链待解开");
    } else if (state.layer === 2) {
      if (p.expression) setOutcome(p.expression === "up" ? "表达上调" : "表达抑制", p.expression === "up" ? "CRISPRa · 转录激活" : "CRISPRi · 转录抑制", p.expression === "up" ? "激活结构域招募转录机器，目标基因表达上调；DNA 保持完整。应用：激活抑癌基因、增强作物抗逆基因表达。" : "抑制结构域占据调控区，转录减弱、基因被沉默；DNA 保持完整。应用：抑制致病基因、研究基因功能。", p.expression === "up" ? "转录本增加" : "转录信号减弱");
      else if (p.imaged) setOutcome("位点已标记", "目标基因位点可视化", "荧光 dCas9 标记目标位点并持续脉冲。应用：染色体定位成像、突变位点诊断。", "荧光标记持续脉冲");
      else if (p.hdr) setOutcome("HDR 完成", "目标序列已按模板替换", "供体 DNA 经同源臂配对引导精准替换。应用：修正致病突变——镰刀型细胞贫血的基因疗法正是这一思路。", "模板介导修复");
      else if (p.nhej) setOutcome("NHEJ 情景", "可能出现插入或缺失", "断裂末端直接连接，常产生小片段插入/缺失（indel），可能造成移码敲除。应用：快速敲除基因、研究基因功能。", "indel 示意");
      else if (p.cut) setOutcome("DNA 双链断裂", "选择修复路径", "剪刀已合拢、双链已断开。可点右侧按钮看 NHEJ 敲除示意，或拖入供体 DNA 演示 HDR 精准修复。", "切口已形成");
      else if (p.bound) setOutcome("PAM 识别成功", "Cas9 · sgRNA 已定位", "向导区与目标互补配对，且邻近 PAM 匹配；现在可以切割双链。", "目标匹配");
      else setOutcome("准备开始", "拖动 Cas9 · sgRNA", "将复合体放到 PAM 邻近区域，观察序列识别。", "等待 PAM 识别");
    } else if (state.layer === 3) {
      if (p.exported) setOutcome("mRNA 已输出", "成熟转录本进入细胞质", "核孔是细胞核与细胞质之间的大分子运输通道。", "核输出完成");
      else if (p.spliced) setOutcome("剪接完成", "内含子移除，外显子连接", "成熟 mRNA 已形成；可继续模拟经核孔输出。", "成熟 mRNA");
      else if (p.transcribed) setOutcome("转录完成", "pre-mRNA 已生成", "转录本包含外显子和内含子；将剪接体拖到内含子区域。", "pre-mRNA");
      else setOutcome("准备开始", "启动转录", "把 RNA 聚合酶拖到 DNA 模板上，生成前体 RNA。", "等待转录");
    } else if (state.layer === 4) {
      if (p.folded) setOutcome("蛋白质形成", "多肽已折叠", "氨基酸顺序由 mRNA 密码子决定；后续结构折叠形成具有功能的蛋白质。", "折叠蛋白");
      else if (p.translated) setOutcome("肽链延伸", "氨基酸正在连接", "tRNA 依据反密码子匹配密码子，并将对应氨基酸带至核糖体。", "多肽链增长");
      else if (p.ribosome) setOutcome("核糖体到位", "开始读取密码子", "拖动 tRNA 到核糖体 A 位点，再推进翻译。", "密码子配对");
      else setOutcome("准备开始", "组装翻译复合体", "将核糖体放到 mRNA 上，开启密码子读取。", "等待翻译");
    } else {
      if (p.delivered) setOutcome("运输完成", "蛋白到达细胞膜并释放", "成熟 mRNA 先从细胞核输出；信号肽随后在细胞质中随新生蛋白合成，帮助其进入内质网—高尔基体分泌通路。", "膜融合与释放");
      else if (p.atGolgi) setOutcome("高尔基体加工", "蛋白已分拣并包装", "将运输囊泡移动到细胞膜，完成这一条分泌路径。", "囊泡待送达");
      else if (p.inER) setOutcome("内质网定位", "蛋白进入分泌通路", "信号肽引导新生蛋白进入粗面内质网，之后由囊泡运输。", "货物进入内质网");
      else setOutcome("准备开始", "先输出 mRNA，再进入分泌通路", "信号肽不是从细胞核出来的；它由细胞质核糖体翻译为新生蛋白的一部分，再引导蛋白进入粗面内质网。", "等待 mRNA 出核");
    }
    updateActionLabel();
  }

  const stepSpecs = {
    fork: { title: "解旋酶沿 DNA 前进，双链张开", caption: "解旋酶分开碱基对，形成两条不再交叉的模板臂。", focus: [520, 292, 1.65], duration: 2300 },
    copy: { title: "DNA 聚合酶沿模板逐位配对", caption: "聚合酶在单链模板旁读取碱基，逐个加入互补核苷酸。", focus: [650, 205, 1.95], duration: 3600 },
    seal: { title: "DNA 连接酶封合新链缺口", caption: "聚合酶逐位加入互补核苷酸；连接酶随后封合冈崎片段之间的糖—磷酸骨架缺口。", focus: [730, 370, 2.2], duration: 2600 },
    bind: { title: "Cas9·向导 RNA 搜索并结合靶位点", caption: "向导 RNA 与目标互补配对，Cas9 同时检查邻近 PAM。", focus: [500, 330, 1.85], duration: 2100 },
    cut: { title: "Cas9 像剪刀一样切开 DNA", caption: "HNH 与 RuvC 两个核酸酶结构域合拢，在 PAM 邻近位点切断两条 DNA 链。", focus: [710, 338, 2.25], duration: 2300 },
    nhej: { title: "非同源末端连接修复", caption: "断裂末端被直接拉近并连接；常伴随小片段插入或缺失（indel），可能造成移码。", focus: [710, 338, 1.95], duration: 2100 },
    hdr: { title: "供体模板引导 HDR 修复", caption: "供体 DNA 与断裂两侧同源臂配对，引导模板介导的精准序列替换。", focus: [710, 338, 2.05], duration: 2600 },
    activate: { title: "dCas9·VP64 招募转录激活因子", caption: "激活结构域招募转录机器，目标基因表达上调；DNA 双链保持完整。", focus: [220, 300, 2.05], duration: 2600 },
    repress: { title: "dCas9·KRAB 抑制转录", caption: "抑制结构域占据调控区，转录减弱、基因被沉默；DNA 双链保持完整。", focus: [220, 300, 2.05], duration: 2600 },
    mark: { title: "荧光 dCas9 标记基因位点", caption: "荧光蛋白被招募到目标位点，持续脉冲显示基因的精确位置。", focus: [500, 338, 2.15], duration: 2100 },
    transcribe: { title: "RNA 聚合酶读取 DNA 并延伸 RNA", caption: "RNA 聚合酶沿模板移动，核苷酸逐个加入，形成前体 mRNA。", focus: [470, 265, 1.85], duration: 3400 },
    splice: { title: "剪接体识别并移除内含子", caption: "剪接体包围内含子，形成套索样结构；两侧外显子随后接合。", focus: [500, 380, 2.0], duration: 3100 },
    export: { title: "成熟 mRNA 通过核孔输出", caption: "核孔复合体嵌在核膜上，成熟 mRNA 沿通道从细胞核进入细胞质。", focus: [665, 300, 1.95], duration: 2800 },
    assemble: { title: "核糖体大小亚基结合 mRNA", caption: "核糖体定位到起始密码子，准备逐个读取密码子。", focus: [500, 280, 1.8], duration: 1900 },
    translate: { title: "tRNA 递送氨基酸，肽链连续延伸", caption: "反密码子与密码子配对，氨基酸进入核糖体并连接到多肽链。", focus: [510, 244, 2.0], duration: 4700 },
    fold: { title: "分子伴侣协助新生蛋白折叠", caption: "多肽链进入伴侣蛋白的保护腔，逐步形成稳定的空间构象。", focus: [710, 220, 1.9], duration: 3000 },
    exportMessage: { title: "mRNA 离开细胞核", caption: "先由成熟 mRNA 经嵌在核膜上的核孔进入细胞质；信号肽不是从细胞核输出的。", focus: [233, 280, 1.75], duration: 2300 },
    targetER: { title: "信号肽引导新生蛋白进入粗面内质网", caption: "信号肽由细胞质中的核糖体翻译出来，并将新生蛋白导入分泌通路。", focus: [430, 282, 1.9], duration: 3100 },
    transport: { title: "囊泡运送蛋白并与细胞膜融合", caption: "蛋白依次经过内质网、高尔基体和运输囊泡，最后到达细胞膜并释放。", focus: [670, 285, 1.55], duration: 5600 }
  };

  function sequenceForLayer(layer) {
    return ({ 1: ["fork", "copy", "seal"], 2: ["bind", "cut", "nhej"], 3: ["transcribe", "splice", "export"], 4: ["assemble", "translate", "fold"], 5: ["exportMessage", "targetER", "transport"] })[layer] || [];
  }

  function beginStep(key, now) {
    const spec = stepSpecs[key], p = state.parts;
    AudioFX.step();
    state.motion = { keys: state.motion.keys, index: state.motion.index, full: state.motion.full, stepStart: now, key };
    state.cameraTarget = { x: spec.focus[0], y: spec.focus[1], zoom: spec.focus[2] };
    $("#cameraLabelText").textContent = spec.title;
    $("#cameraLabel").hidden = false;
    $("#calloutText").textContent = spec.caption;
    $("#motionLabel").textContent = spec.title;
    $("#motionProgress").hidden = false;
    $("#motionFill").style.width = "0%";
    setOutcome("动态演示",spec.title,spec.caption,spec.title);
    if (key === "fork") { p.opened = true; p.forkProgress = 0; }
    if (key === "copy") { p.copied = true; p.copyProgress = 0; }
    if (key === "seal") p.sealProgress = 0;
    if (key === "bind") { p.binding = true; p.bound = false; p.cut = false; p.bindProgress = 0; delete p.nhej; delete p.hdr; delete p.nhejProgress; delete p.hdrProgress; delete p.expression; delete p.expressionProgress; delete p.imaged; delete p.imageProgress; }
    if (key === "cut") { p.cutting = true; p.cutProgress = 0; }
    if (key === "nhej") { delete p.hdrProgress; p.nhejProgress = 0; }
    if (key === "hdr") { delete p.nhejProgress; p.hdrProgress = 0; }
    if (key === "activate" || key === "repress") { p.bound=false;p.cut=false;delete p.nhej;delete p.hdr;p.expression = key === "activate" ? "up" : "down"; p.expressionProgress = 0; }
    if (key === "mark") { p.bound=false;p.cut=false;delete p.nhej;delete p.hdr;delete p.expression;delete p.expressionProgress;p.imaged = true; p.imageProgress = 0; }
    if (key === "transcribe") { p.transcribed = true; p.transcriptionProgress = 0; }
    if (key === "splice") { p.splicing = true; p.splicingProgress = 0; }
    if (key === "export") p.exportProgress = 0;
    if (key === "assemble") { p.ribosome = true; p.assemblingProgress = 0; }
    if (key === "translate") { p.translated = true; p.translationProgress = 0; p.codonIndex = 0; }
    if (key === "fold") p.foldingProgress = 0;
    if (key === "exportMessage") p.messageProgress = 0;
    if (key === "targetER") p.signalProgress = 0;
    if (key === "transport") p.transportProgress = 0;
    updateActionLabel();
  }

  function startMotion(keys, { full = false, reset = false } = {}) {
    if (!keys.length) return;
    if (reset) {
      state.parts = {};
      $("#repairActions").hidden = true;
      const readout = $("#matchReadout");
      if (readout) { readout.textContent = "尚未识别"; readout.classList.remove("success"); }
    }
    state.motion = { keys, index: 0, full, stepStart: performance.now(), key: keys[0] };
    beginStep(keys[0], performance.now());
  }

  function finishStep(key) {
    const p = state.parts;
    if (key === "fork") award("helix", "复制叉已打开，亲代链分离");
    if (key === "seal") { p.sealed = true; award("copy", "半保留复制完成"); }
    if (key === "bind") {
      p.binding = false; p.bound = true;
      const readout = $("#matchReadout");
      if (readout) { readout.textContent = "向导区配对 ✓ · PAM 匹配 ✓"; readout.classList.add("success"); }
    }
    if (key === "cut") { p.cutting = false; p.cut = true; AudioFX.cut(); award("edit", "目标识别成功，DNA 双链已切开"); $("#repairActions").hidden = false; }
    if (key === "nhej") { p.nhej = true; p.cut = false; }
    if (key === "hdr") { p.hdr = true; p.cut = false; award("repair", "供体模板修复示意完成"); }
    if (key === "transcribe") p.transcribed = true;
    if (key === "splice") { p.splicing = false; p.spliced = true; }
    if (key === "export") p.exported = true;
    if (key === "assemble") p.ribosome = true;
    if (key === "translate") { p.translated = true; p.codonIndex = 4; award("protein", "密码子读取完成，多肽链已延伸"); }
    if (key === "fold") p.folded = true;
    if (key === "exportMessage") p.exported = true;
    if (key === "targetER") { p.signal = true; p.inER = true; }
    if (key === "transport") { p.atGolgi = true; p.delivered = true; award("transport", "蛋白已抵达细胞膜并释放"); }
  }

  function updateMotion(now) {
    if (!state.motion) return;
    const motion = state.motion;
    const key = motion.key;
    const spec = stepSpecs[key], p = state.parts;
    const t = Math.min(1, Math.max(0, (now - motion.stepStart) / spec.duration));
    const eased = 1 - Math.pow(1 - t, 2.2);
    if (key === "fork") p.forkProgress = eased;
    if (key === "copy") p.copyProgress = eased;
    if (key === "seal") p.sealProgress = eased;
    if (key === "bind") p.bindProgress = eased;
    if (key === "cut") p.cutProgress = eased;
    if (key === "nhej") p.nhejProgress = eased;
    if (key === "hdr") p.hdrProgress = eased;
    if (key === "activate" || key === "repress") p.expressionProgress = eased;
    if (key === "mark") p.imageProgress = eased;
    if (key === "transcribe") p.transcriptionProgress = eased;
    if (key === "splice") p.splicingProgress = eased;
    if (key === "export") p.exportProgress = eased;
    if (key === "assemble") p.assemblingProgress = eased;
    if (key === "translate") { p.translationProgress = eased; p.codonIndex = Math.floor(eased * 4); }
    if (key === "fold") p.foldingProgress = eased;
    if (key === "exportMessage") p.messageProgress = eased;
    if (key === "targetER") p.signalProgress = eased;
    if (key === "transport") p.transportProgress = eased;
    $("#motionFill").style.width = `${t * 100}%`;
    if (t < 1) return;
    finishStep(key);
    motion.index++;
    if (motion.index >= motion.keys.length) {
      const wasFull = motion.full;
      state.motion = null;
      p.completed = wasFull;
      $("#motionProgress").hidden = true;
      $("#cameraLabel").hidden = true;
      state.cameraTarget = { x: 500, y: 280, zoom: state.layer === 1 ? 1.2 : 1 };
      showOutcomeForState();
      $("#layerMeaning").textContent = layerData[state.layer]?.meaning || "";
      AudioFX.success();
      updateActionLabel();
      return;
    }
    state.motion = motion;
    beginStep(motion.keys[motion.index], now);
  }

  function advanceAction() {
    if (state.motion) { showToast("当前动态过程正在播放"); return; }
    startMotion(sequenceForLayer(state.layer), { full: true, reset: true });
  }

  // ── 自动演示：依次播放全部五层，层与层之间显示衔接说明 ───────────
  function startTour() {
    if (state.tour?.running) { stopTour(); return; }
    state.tour = { running: true, layer: 0, phase: "idle", waitUntil: 0, autoSwitch: false };
    $("#tourButton").classList.add("running");
    $("#tourButton").textContent = "⏹";
    $("#tourBanner").hidden = false;
    AudioFX.transition();
    goToTourLayer(1);
  }
  function goToTourLayer(n) {
    state.tour.layer = n;
    state.tour.autoSwitch = true;
    switchLayer(n);
    state.tour.autoSwitch = false;
    $("#tourBannerTitle").textContent = "自动演示 · 五层旅程";
    $("#tourBannerText").textContent = `第 ${n} / 5 层 · ${layerData[n].title}`;
    startMotion(sequenceForLayer(n), { full: true, reset: true });
    state.tour.phase = "playing";
  }
  function updateTour(t) {
    const tour = state.tour;
    if (!tour || !tour.running) return;
    if (tour.phase === "playing" && !state.motion && state.parts.completed) {
      if (tour.layer >= 5) { tour.phase = "done"; finishTour(); return; }
      const d = layerData[tour.layer];
      $("#tourBannerText").textContent = `✓ ${d.title} 完成 → 下一层`;
      showToast(`${d.title}完成：${d.link}`);
      AudioFX.transition();
      tour.phase = "waiting";
      tour.waitUntil = t + 2600;
    } else if (tour.phase === "waiting" && t >= tour.waitUntil) {
      goToTourLayer(tour.layer + 1);
    }
  }
  function stopTour() {
    if (!state.tour) return;
    state.tour = null;
    state.motion = null;
    $("#tourButton").classList.remove("running");
    $("#tourButton").textContent = "▶";
    $("#tourBanner").hidden = true;
    $("#cameraLabel").hidden = true;
    $("#motionProgress").hidden = true;
    showToast("已停止自动演示");
  }
  function finishTour() {
    state.tour = null;
    $("#tourButton").classList.remove("running");
    $("#tourButton").textContent = "▶";
    $("#tourBanner").hidden = true;
    AudioFX.complete();
    showToast("五层旅程完成：从一段 DNA，到细胞外的蛋白质 🎉");
    setOutcome("旅程完成", "从 DNA 到蛋白质", "五层路径演示完毕：解旋—编辑—转录—翻译—转运。基因编辑技术正在改变医学、农业与合成生物学。", "5 / 5");
    $("#layerMeaning").textContent = "一段 DNA 的信息，经过复制、编辑、转录、翻译与运输，最终变成执行功能的蛋白质——这就是生命运作的方式。";
  }

  function applyTool(tool, point) {
    const p = state.parts;
    const x = point.x, y = point.y;
    const near = (cx, cy, r = 125) => Math.hypot(x - cx, y - cy) < r;
    const run = keys => { p.completed = false; AudioFX.click(); startMotion(keys); };
    const fail = msg => { AudioFX.error(); showToast(msg); };
    if (state.motion) { showToast("等当前特写动画结束后，再放置下一个工具"); return; }
    if (state.layer === 1) {
      if (tool === "helicase" && near(470, 294, 190) && !p.opened) run(["fork"]);
      else if (tool === "polymerase" && p.opened && near(650, 292, 240)) run(["copy"]);
      else if (tool === "ligase" && p.copied && near(760, 322, 200)) run(["seal"]);
      else fail(tool === "polymerase" && !p.opened ? "先打开 DNA 双链，再放置聚合酶" : "把工具放在复制叉附近");
    } else if (state.layer === 2) {
      if (tool === "cas9" && near(520, 300, 235)) run(p.bound && !p.cut && !p.nhej && !p.hdr ? ["cut"] : ["bind", "cut"]);
      else if (tool === "donor" && p.cut && near(710, 338, 210)) run(["hdr"]);
      else if (tool === "donor" && !p.cut) fail("供体模板在 DNA 切口形成后参与 HDR 修复");
      else if (tool === "activator" && near(205, 300, 220)) run(["activate"]);
      else if (tool === "repressor" && near(205, 300, 220)) run(["repress"]);
      else if (tool === "marker" && near(520, 330, 245)) run(["mark"]);
      else if (tool === "cas9") fail("将 Cas9 放到靶序列附近；需要同时匹配 PAM");
      else fail("将所选工具放在对应 DNA 或启动子区域");
    } else if (state.layer === 3) {
      if (tool === "rnaPol" && near(475, 235, 260)) run(["transcribe"]);
      else if (tool === "spliceosome" && p.transcribed && near(500, 370, 220)) run(["splice"]);
      else if (tool === "nuclearPore" && p.spliced && near(790, 286, 170)) run(["export"]);
      else fail(tool === "spliceosome" && !p.transcribed ? "先转录生成 pre-mRNA" : "将工具放到当前步骤对应结构");
    } else if (state.layer === 4) {
      if (tool === "ribosome" && near(500, 300, 250)) run(["assemble"]);
      else if ((tool === "trna" || tool === "amino") && p.ribosome && near(510, 244, 190)) run(["translate"]);
      else if (tool === "chaperone" && p.translated && near(710, 220, 200)) run(["fold"]);
      else fail(tool === "trna" && !p.ribosome ? "先将核糖体放到 mRNA 上" : "将部件放到核糖体或新生多肽附近");
    } else {
      if (tool === "signal" && near(300, 290, 220)) run(p.exported ? ["targetER"] : ["exportMessage", "targetER"]);
      else if (tool === "er" && p.exported && near(485, 300, 230)) run(["targetER"]);
      else if (["vesicle", "golgi", "membrane"].includes(tool) && p.inER) run(["transport"]);
      else fail("依次将货物从信号肽送往内质网、囊泡、高尔基体与膜");
    }
    drawScene(performance.now());
  }

  function resizeCanvas(el, context) {
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * dpr), height = Math.round(rect.height * dpr);
    if (el.width !== width || el.height !== height) { el.width = width; el.height = height; }
    context.setTransform(width / W, 0, 0, height / H, 0, 0);
    return true;
  }

  function roundedRect(c, x, y, w, h, r, fill, stroke) {
    c.beginPath(); c.roundRect(x, y, w, h, r);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.stroke(); }
  }

  function drawBackdrop(c, t) {
    c.clearRect(0, 0, W, H);
    const g = c.createRadialGradient(520, 282, 20, 520, 282, 560);
    g.addColorStop(0, "rgba(36,70,86,.42)"); g.addColorStop(.56, "rgba(16,34,48,.18)"); g.addColorStop(1, "rgba(4,12,20,0)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save(); c.strokeStyle = "rgba(151,190,207,.055)"; c.lineWidth = 1;
    for (let x = 36; x < W; x += 42) { c.beginPath(); c.moveTo(x, 55); c.lineTo(x, H - 35); c.stroke(); }
    for (let y = 70; y < H; y += 42) { c.beginPath(); c.moveTo(30, y); c.lineTo(W - 30, y); c.stroke(); }
    for (let i = 0; i < 28; i++) {
      const x = (i * 137 + 43) % W, y = (i * 71 + 23) % H;
      c.globalAlpha = .12 + .08 * Math.sin(t / 800 + i); c.fillStyle = "#b6d7e2"; c.beginPath(); c.arc(x, y, i % 4 ? 1 : 1.7, 0, TAU); c.fill();
    }
    c.restore(); c.globalAlpha = 1;
  }

  function hit(name, x, y, r, label) { state.hits.push({ name, x, y, r, label }); }
  function label(c, text, x, y, color = "#91a7b4", size = 11, align = "center") {
    c.save(); c.fillStyle = color; c.font = `500 ${size}px Inter, "Microsoft YaHei UI", sans-serif`; c.textAlign = align; c.textBaseline = "middle"; c.fillText(text, x, y); c.restore();
  }
  function drawPill(c, x, y, text, color = "#9bb0bc") {
    c.save(); c.font = "500 9px Inter, 'Microsoft YaHei UI', 'Microsoft YaHei', sans-serif"; const w = c.measureText(text).width + 18;
    roundedRect(c, x - w / 2, y - 10, w, 20, 7, "rgba(7,17,27,.82)", "rgba(164,194,208,.18)");
    label(c, text, x, y, color, 9); c.restore();
  }

  function dnaPoints(count, y, amplitude, phase, x0 = 115, x1 = 885, open = false, split = 0) {
    const a = [], b = [], dx = (x1 - x0) / (count - 1);
    for (let i = 0; i < count; i++) {
      const x = x0 + i * dx, p = phase + i * TAU / 10.5;
      const openAmt = open && i > split ? Math.min(92, (i - split) * 9) : 0;
      a.push({ x, y: y + Math.sin(p) * amplitude - openAmt });
      b.push({ x, y: y - Math.sin(p) * amplitude + openAmt });
    }
    return { a, b, dx };
  }

  function strokeCurve(c, points, color, width, alpha = 1, dash = []) {
    c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = width; c.lineCap = "round"; c.lineJoin = "round"; c.setLineDash(dash); c.shadowColor = color; c.shadowBlur = width * 1.2;
    c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke(); c.restore();
  }

  function drawDNA(c, options = {}) {
    const count = options.count || 23, y = options.y || 300, amp = options.amp || 62;
    const open = !!options.open, split = options.split ?? Math.floor(count * .47), phase = options.phase || 0;
    const { a, b, dx } = dnaPoints(count, y, amp, phase, options.x0 || 115, options.x1 || 885, open, split);
    const cut = !!options.cut, cutIndex = options.cutIndex ?? 17;
    const segments = points => cut ? [points.slice(0, cutIndex + 1), points.slice(cutIndex + 1)] : [points];
    segments(a).forEach(part => strokeCurve(c, part, "#bf5f68", 9, .72));
    segments(b).forEach(part => strokeCurve(c, part, "#ed8178", 8, .9));
    for (let i = 0; i < count; i++) {
      const gap = cut && i >= cutIndex && i <= cutIndex + 1;
      if (gap) continue;
      const mid = (a[i].y + b[i].y) / 2;
      const base = options.sequence ? options.sequence[i] : "ATCG"[i % 4];
      const pam = options.pamStart !== undefined && i >= options.pamStart;
      c.save(); c.lineWidth = 2.6; c.strokeStyle = pam ? "rgba(232,184,117,.9)" : `${baseColors[base] || "#a1b7c1"}b8`;
      c.beginPath(); c.moveTo(a[i].x, a[i].y); c.lineTo(b[i].x, b[i].y); c.stroke();
      c.fillStyle = pam ? "#e8b875" : baseColors[base] || "#a1b7c1"; c.beginPath(); c.arc(a[i].x, a[i].y, 3.2, 0, TAU); c.fill();
      c.fillStyle = "#d2e0e6"; c.beginPath(); c.arc(b[i].x, b[i].y, 2.5, 0, TAU); c.fill(); c.restore();
      if (i % 4 === 0 || i === count - 1) hit(base, a[i].x, mid, 14, `碱基 ${base}`);
      hit("basePair", a[i].x - 8, mid, 6, "互补碱基对");
      hit("hydrogenBond", a[i].x + 8, mid, 6, "氢键");
    }
    if (options.showBackbone !== false) {
      const focus = a[Math.floor(count * .56)];
      hit("backbone", focus.x - 12, focus.y - 5, 17, "糖—磷酸骨架");
      hit("phosphate", a[2].x, a[2].y, 13, "磷酸基团");
      hit("deoxyribose", b[3].x, b[3].y, 13, "脱氧核糖");
    }
    if (cut) {
      const p = a[cutIndex];
      const flash = 1 + .22 * Math.sin(performance.now() / 90);
      c.save(); c.strokeStyle = `rgba(255,135,102,${.72 + .2 * Math.sin(performance.now() / 100)})`; c.lineWidth = 3; c.shadowColor = "#ff7e61"; c.shadowBlur = 23;
      c.beginPath(); c.arc(p.x, y, 14 * flash, 0, TAU); c.stroke(); c.restore();
      hit("repair", p.x, y, 40, "DNA 双链切口");
    }
    if (open) {
      const p = a[split];
      drawProtein(c, p.x, y, "helicase", .75, false); drawPill(c, p.x, y - 51, "解旋酶", "#8fd1d7"); hit("helicase", p.x, y, 52, "解旋酶"); hit("replicationFork", p.x + 34, y, 28, "复制叉");
      if (options.copied) {
        const n1 = a.slice(split + 2); const n2 = b.slice(split + 2);
        strokeCurve(c, n1.map(p => ({ x: p.x, y: p.y + 17 })), "#7ebc99", 4, .9, [6, 5]);
        strokeCurve(c, n2.map(p => ({ x: p.x, y: p.y - 17 })), "#90d1ac", 4, .9, [6, 5]);
        hit("polymerase", n1[2]?.x || 690, y + 17, 35, "DNA 聚合酶");
      }
      if (options.sealed) hit("ligase", a[Math.min(split + 8, count - 1)].x, y + 30, 24, "DNA 连接酶");
    } else if (options.highlightFork) {
      hit("helicase", 500, y, 50, "解旋酶");
    }
    return { a, b, dx };
  }

  function drawProtein(c, x, y, kind = "cas9", scale = 1, active = true) {
    c.save(); c.translate(x, y); c.scale(scale, scale);
    const colors = kind === "cas9" ? ["#9dd2dc", "#4c7892", "#24465e"] : kind === "activator" ? ["#a4dbb7", "#4c8d70", "#274e42"] : kind === "repressor" ? ["#d5aba1", "#936d75", "#543d4b"] : kind === "marker" ? ["#d3c4f0", "#8170b0", "#453b6d"] : ["#bdd4df", "#6b8798", "#394d5c"];
    const grad = c.createRadialGradient(-26, -25, 9, 8, 9, 130); grad.addColorStop(0, colors[0]); grad.addColorStop(.5, colors[1]); grad.addColorStop(1, colors[2]);
    c.shadowColor = active ? `${colors[0]}77` : "transparent"; c.shadowBlur = 24;
    c.beginPath(); c.moveTo(-104, -7); c.bezierCurveTo(-119, -62, -73, -96, -32, -82); c.bezierCurveTo(-2, -125, 54, -97, 63, -60); c.bezierCurveTo(119, -45, 126, 3, 91, 27); c.bezierCurveTo(100, 76, 48, 98, 16, 72); c.bezierCurveTo(-23, 105, -72, 77, -68, 40); c.bezierCurveTo(-111, 33, -125, 12, -104, -7); c.closePath();
    c.fillStyle = grad; c.fill(); c.shadowBlur = 0; c.strokeStyle = "rgba(215,239,247,.33)"; c.lineWidth = 1.3; c.stroke();
    c.beginPath(); c.ellipse(-18, -4, 24, 45, -.48, 0, TAU); c.fillStyle = "rgba(18,42,59,.55)"; c.fill();
    c.beginPath(); c.ellipse(43, 24, 32, 18, .55, 0, TAU); c.fillStyle = "rgba(181,219,230,.14)"; c.fill();
    c.strokeStyle = "rgba(223,242,246,.25)"; c.lineWidth = 2; c.beginPath(); c.moveTo(-73, -42); c.bezierCurveTo(-47, -70, -6, -69, 8, -46); c.stroke();
    if (kind === "cas9" || kind === "dCas9") {
      c.strokeStyle = "#9adab3"; c.lineWidth = 4; c.lineCap = "round"; c.beginPath(); c.moveTo(-88, 54); c.bezierCurveTo(-49, 28, -34, 61, -4, 46); c.bezierCurveTo(24, 31, 43, 53, 76, 40); c.stroke();
      for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-60 + i * 22, 43 + (i % 2) * 5); c.lineTo(-56 + i * 22, 54 + (i % 2) * 4); c.strokeStyle = "rgba(210,242,218,.7)"; c.lineWidth = 1; c.stroke(); }
    }
    c.restore();
  }

  function drawMolecule(c, kind, x, y, scale = 1, time = 0) {
    c.save(); c.translate(x, y); c.scale(scale, scale);
    const glow = 8 + 5 * (1 + Math.sin(time / 150));
    c.lineCap = "round"; c.lineJoin = "round";
    if (kind === "helicase") {
      c.shadowColor = "#7fc9d5"; c.shadowBlur = glow;
      c.beginPath(); c.arc(0, 0, 35, -.92, 4.05); c.strokeStyle = "#78cbd5"; c.lineWidth = 13; c.stroke();
      c.shadowBlur = 0; c.beginPath(); c.arc(-22, -16, 20, 0, TAU); c.fillStyle = "#427187"; c.fill();
      c.beginPath(); c.arc(22, 16, 20, 0, TAU); c.fillStyle = "#31576c"; c.fill();
      c.strokeStyle = "rgba(226,248,250,.9)"; c.lineWidth = 3; c.beginPath(); c.moveTo(-4, -14); c.lineTo(3, -3); c.moveTo(8, 2); c.lineTo(15, 14); c.stroke();
    } else if (kind === "polymerase") {
      c.shadowColor="#8ed1ae";c.shadowBlur=glow;
      c.beginPath();c.moveTo(-52,-28);c.bezierCurveTo(-42,-57,-5,-56,3,-34);c.bezierCurveTo(22,-57,57,-42,47,-10);c.bezierCurveTo(38,8,18,9,8,1);c.bezierCurveTo(-4,25,20,43,45,35);c.bezierCurveTo(25,61,-20,54,-27,27);c.bezierCurveTo(-54,22,-65,-3,-52,-28);c.closePath();c.fillStyle="#3d8067";c.fill();
      c.shadowBlur=0;c.beginPath();c.ellipse(2,0,17,21,-.15,0,TAU);c.fillStyle="#102c26";c.fill();
      c.strokeStyle="#a8e5bc";c.lineWidth=4;c.beginPath();c.moveTo(-72,-10);c.bezierCurveTo(-38,-4,-22,3,0,0);c.moveTo(4,9);c.bezierCurveTo(28,19,45,23,72,31);c.stroke();
      c.fillStyle="#b9edc8";c.beginPath();c.arc(3,2,5,0,TAU);c.fill();
    } else if (kind === "rnaPol") {
      c.shadowColor="#80cbd6";c.shadowBlur=glow;
      c.beginPath();c.ellipse(-17,-13,36,27,-.32,0,TAU);c.fillStyle="#356d82";c.fill();
      c.beginPath();c.ellipse(17,15,37,27,.32,0,TAU);c.fillStyle="#4f91a2";c.fill();c.shadowBlur=0;
      c.beginPath();c.ellipse(0,1,19,29,0,0,TAU);c.fillStyle="#102b37";c.fill();
      c.strokeStyle="#83d8dc";c.lineWidth=4;c.beginPath();c.moveTo(-74,-4);c.bezierCurveTo(-48,-4,-33,4,-17,4);c.moveTo(15,12);c.bezierCurveTo(34,22,49,25,69,31);c.stroke();
      c.strokeStyle="#b7a2e4";c.lineWidth=3;c.beginPath();c.moveTo(4,14);c.bezierCurveTo(21,29,-10,38,9,58);c.stroke();
      for(let i=0;i<4;i++){c.beginPath();c.arc(-32+i*21,-2+(i%2)*6,4,0,TAU);c.fillStyle="#d4eef0";c.fill();}
    } else if (kind === "ligase") {
      c.shadowColor = "#e8b875"; c.shadowBlur = glow;
      c.beginPath(); c.arc(0, 0, 34, -.78, 4.02); c.strokeStyle = "#d7a65f"; c.lineWidth = 13; c.stroke();
      c.shadowBlur = 0; c.beginPath(); c.arc(-24, -13, 18, 0, TAU); c.fillStyle = "#705633"; c.fill();
      c.beginPath(); c.arc(23, 14, 18, 0, TAU); c.fillStyle = "#9a7545"; c.fill();
      c.strokeStyle = "#fff0c6"; c.lineWidth = 3; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(-55, 1); c.lineTo(-13, 1); c.moveTo(14, 1); c.lineTo(56, 1); c.stroke(); c.setLineDash([]);
      c.fillStyle = "#ffe3a4"; c.beginPath(); c.arc(0, 1, 5, 0, TAU); c.fill();
    } else if (kind === "donor") {
      c.shadowColor="#e8b875";c.shadowBlur=glow;
      for(let strand=0;strand<2;strand++){c.strokeStyle=strand?"#e8b875":"#9bd0ac";c.lineWidth=4;c.beginPath();c.moveTo(-46,strand?8:-8);c.bezierCurveTo(-18,strand?-6:6,18,strand?22:-22,46,strand?8:-8);c.stroke();}
      c.shadowBlur=0;for(let i=0;i<5;i++){const bx=-30+i*15;c.strokeStyle="#f4deb4";c.lineWidth=2;c.beginPath();c.moveTo(bx,-7+Math.sin(i)*5);c.lineTo(bx,7+Math.sin(i)*5);c.stroke();}
    } else if (kind === "cas9" || kind === "activator" || kind === "repressor" || kind === "marker") {
      const color = kind === "activator" ? "#79c59a" : kind === "repressor" ? "#c17f79" : kind === "marker" ? "#aa91df" : "#70b4c9";
      c.shadowColor = color; c.shadowBlur = glow;
      c.beginPath(); c.ellipse(-21, -3, 34, 27, -.4, 0, TAU); c.fillStyle = kind === "cas9" ? "#4b8295" : color; c.fill();
      c.beginPath(); c.ellipse(20, 1, 30, 24, .45, 0, TAU); c.fillStyle = kind === "cas9" ? "#31576e" : `${color}bb`; c.fill();
      c.shadowBlur = 0;
      if (kind === "cas9") { c.strokeStyle = "#a2dfb3"; c.lineWidth = 4; c.beginPath(); c.moveTo(-61, 24); c.bezierCurveTo(-25, 10, 4, 34, 56, 17); c.stroke(); for (let i=0;i<5;i++){c.beginPath();c.moveTo(-39+i*20,20+(i%2)*3);c.lineTo(-34+i*20,30+(i%2)*3);c.lineWidth=1.5;c.stroke();} }
      if (kind === "activator") { for(let i=0;i<3;i++){c.strokeStyle="#b7ebc2";c.lineWidth=2;c.beginPath();c.moveTo(44+i*10,-5);c.lineTo(44+i*10,-28-i*4);c.stroke();} }
      if (kind === "repressor") { c.strokeStyle="#f1c0b9";c.lineWidth=5;c.beginPath();c.moveTo(39,-17);c.lineTo(63,17);c.moveTo(63,-17);c.lineTo(39,17);c.stroke(); }
      if (kind === "marker") { c.strokeStyle="#e0d4ff";c.lineWidth=3;c.beginPath();c.arc(0,0,42,0,TAU);c.stroke(); for(let i=0;i<8;i++){const a=i*TAU/8;c.beginPath();c.moveTo(Math.cos(a)*48,Math.sin(a)*48);c.lineTo(Math.cos(a)*58,Math.sin(a)*58);c.stroke();} }
    } else if (kind === "spliceosome") {
      const colors = ["#b7a2e4", "#8b79bc", "#d2c1f1", "#7767a8", "#a28ccc"];
      for (let i=0;i<5;i++){const a=i*TAU/5-Math.PI/2;c.beginPath();c.arc(Math.cos(a)*28,Math.sin(a)*28,15,0,TAU);c.fillStyle=colors[i];c.fill();c.strokeStyle="rgba(245,235,255,.45)";c.lineWidth=1.5;c.stroke();}
      c.strokeStyle="#e9d7ff";c.lineWidth=4;c.beginPath();c.moveTo(-6,0);c.bezierCurveTo(-28,-32,16,-43,14,-9);c.bezierCurveTo(11,8,-11,17,2,32);c.stroke();
    } else if (kind === "nuclearPore") {
      c.shadowColor="#e8b875";c.shadowBlur=glow;c.strokeStyle="#e6bd7e";c.lineWidth=11;c.beginPath();c.ellipse(0,0,31,39,0,0,TAU);c.stroke();c.shadowBlur=0;
      c.strokeStyle="#f4dcae";c.lineWidth=3;c.beginPath();c.ellipse(0,0,17,26,0,0,TAU);c.stroke();
      c.fillStyle="#273f4c";c.beginPath();c.ellipse(0,0,11,20,0,0,TAU);c.fill();
      for(let i=0;i<8;i++){const a=i*TAU/8;c.beginPath();c.arc(Math.cos(a)*37,Math.sin(a)*45,4,0,TAU);c.fillStyle="#f0d295";c.fill();}
    } else if (kind === "ribosome") {
      c.shadowColor="#89c8d4";c.shadowBlur=glow;c.fillStyle="#507f90";c.beginPath();c.ellipse(0,-13,53,31,-.08,Math.PI,TAU);c.fill();
      c.fillStyle="#31566a";c.beginPath();c.ellipse(2,13,44,25,.06,0,Math.PI);c.fill();c.shadowBlur=0;
      c.strokeStyle="#a3dbe0";c.lineWidth=2;c.beginPath();c.moveTo(-34,0);c.quadraticCurveTo(0,-15,34,0);c.stroke();
    } else if (kind === "trna") {
      c.strokeStyle="#8ed1ae";c.lineWidth=6;c.beginPath();c.moveTo(0,35);c.lineTo(0,-8);c.moveTo(0,-8);c.lineTo(-26,-29);c.moveTo(0,-8);c.lineTo(26,-29);c.moveTo(-26,-29);c.lineTo(-26,-43);c.moveTo(26,-29);c.lineTo(26,-43);c.moveTo(0,-8);c.lineTo(0,-41);c.stroke();
      for(const [cx,cy] of [[-26,-45],[26,-45],[0,-43]]){c.beginPath();c.arc(cx,cy,10,0,TAU);c.fillStyle="#4b9275";c.fill();c.strokeStyle="#a8e4bc";c.lineWidth=2;c.stroke();}
      c.beginPath();c.arc(0,39,12,0,TAU);c.strokeStyle="#b7a2e4";c.lineWidth=4;c.stroke();
    } else if (kind === "amino") {
      c.shadowColor="#e8b875";c.shadowBlur=glow;c.beginPath();c.arc(0,0,19,0,TAU);c.fillStyle="#e8b875";c.fill();c.shadowBlur=0;
      c.strokeStyle="#ffe7bd";c.lineWidth=3;c.beginPath();c.moveTo(-31,0);c.lineTo(-18,0);c.moveTo(18,0);c.lineTo(31,0);c.moveTo(0,-18);c.lineTo(0,-31);c.stroke();
      c.fillStyle="#fff1cf";c.beginPath();c.arc(0,0,5,0,TAU);c.fill();
    } else if (kind === "chaperone") {
      c.shadowColor="#b7a2e4";c.shadowBlur=glow;c.strokeStyle="#a994d5";c.lineWidth=9;c.beginPath();c.ellipse(0,2,39,31,0,Math.PI,TAU);c.stroke();c.beginPath();c.ellipse(0,2,39,31,0,0,Math.PI);c.stroke();c.shadowBlur=0;
      c.strokeStyle="#d6c9f3";c.lineWidth=3;for(let i=-2;i<=2;i++){c.beginPath();c.moveTo(i*13,-24);c.lineTo(i*13,25);c.stroke();}
      c.strokeStyle="#e8b875";c.lineWidth=5;c.beginPath();c.moveTo(-18,5);c.bezierCurveTo(-8,-17,8,19,18,-4);c.stroke();
    } else if (kind === "er") {
      c.strokeStyle="#79c4d0";c.lineWidth=8;
      for(let i=0;i<4;i++){const yy=-27+i*18;c.beginPath();c.moveTo(-47,yy);c.bezierCurveTo(-19,yy-15,16,yy+15,48,yy);c.stroke();}
      c.fillStyle="#d9e8ed";for(let i=0;i<8;i++){c.beginPath();c.arc(-32+i*18,-32+(i%2)*4,3,0,TAU);c.fill();}
    } else if (kind === "golgi") {
      c.strokeStyle="#b7a2e4";c.lineWidth=7;
      for(let i=0;i<5;i++){c.beginPath();c.ellipse(0,-24+i*12,42-i*3,7,-.1,Math.PI,TAU);c.stroke();}
      c.fillStyle="#e7d9ff";for(let i=0;i<3;i++){c.beginPath();c.arc(49+i*8,-18+i*15,4,0,TAU);c.fill();}
    } else if (kind === "membrane") {
      c.strokeStyle="#91d0ae";c.lineWidth=5;c.beginPath();c.moveTo(-22,-42);c.bezierCurveTo(-8,-18,-35,5,-18,42);c.moveTo(18,-42);c.bezierCurveTo(32,-18,5,5,22,42);c.stroke();
      c.fillStyle="#d2eadd";for(let i=0;i<5;i++){c.beginPath();c.arc(-20,-34+i*17,4,0,TAU);c.arc(20,-34+i*17,4,0,TAU);c.fill();}
    } else if (kind === "vesicle") {
      c.shadowColor="#e8b875";c.shadowBlur=glow;c.beginPath();c.arc(0,0,35,0,TAU);c.fillStyle="rgba(232,184,117,.12)";c.fill();c.strokeStyle="#e8b875";c.lineWidth=4;c.stroke();c.shadowBlur=0;
      for(let i=0;i<4;i++){const a=i*TAU/4;c.beginPath();c.arc(Math.cos(a)*13,Math.sin(a)*13,6,0,TAU);c.fillStyle="#9bd0ac";c.fill();}
    } else if (kind === "signal") {
      const beads=7;for(let i=0;i<beads;i++){const bx=-33+i*11,by=Math.sin(i*.8)*7;c.beginPath();c.arc(bx,by,6,0,TAU);c.fillStyle=i%2?"#d69d56":"#f1cc87";c.fill();}
      c.shadowColor="#e8b875";c.shadowBlur=glow;c.strokeStyle="#ffe1a8";c.lineWidth=2;c.beginPath();c.moveTo(-38,-15);c.lineTo(38,-15);c.stroke();c.shadowBlur=0;
    } else {
      drawProtein(c, 0, 0, "other", 1, true);
    }
    c.restore();
  }

  function bezierPoint(t, p0, p1, p2, p3) {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t;
    return { x: a*p0.x+b*p1.x+d*p2.x+e*p3.x, y: a*p0.y+b*p1.y+d*p2.y+e*p3.y };
  }

  function forkArmPoint(u, side, forkX, offset = 0, opening = 1) {
    const p0={x:forkX-8,y:294}, p1={x:forkX+66,y:294+side*63*opening}, p2={x:forkX+218,y:294+side*128*opening}, p3={x:890,y:294+side*138*opening};
    const point=bezierPoint(u,p0,p1,p2,p3); point.y += offset*opening; return point;
  }

  function drawForkArm(c, side, forkX, progress, t, lagging = false, sealProgress = 0) {
    const opening = Math.max(.025, Math.min(1, (state.parts.forkProgress || 0)));
    const pointAt = (u, offset = 0) => forkArmPoint(u,side,forkX,offset,opening);
    const template = Array.from({length:30},(_,i)=>pointAt(i/29));
    strokeCurve(c,template,side<0?"#bd646d":"#e47b75",8,.94);
    const daughter=Array.from({length:30},(_,i)=>pointAt(i/29,-side*21));
    const start=0.07, end=Math.max(start, start+progress*.78);
    if (!lagging) strokeCurve(c,daughter.filter((_,i)=>i/29<=end),"#91d0ae",5,.95);
    else {
      const gapCenter=.69, gapHalf=.043*(1-sealProgress);
      const left=daughter.filter((_,i)=>i/29<=Math.min(end,gapCenter-gapHalf));
      const right=daughter.filter((_,i)=>i/29>=gapCenter+gapHalf && i/29<=end);
      if(left.length>1)strokeCurve(c,left,"#e8b875",5,.96);
      if(right.length>1)strokeCurve(c,right,"#e8b875",5,.96);
    }
    const total=Math.max(0,Math.floor(progress*14));
    for(let i=0;i<total;i++){
      const u=.1+i*.047;
      if(lagging && sealProgress<1 && Math.abs(u-.69)<.05*(1-sealProgress))continue;
      const a=pointAt(u), b=pointAt(u,-side*21);
      c.strokeStyle="#d9d1b7";c.lineWidth=1.8;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();
      const base="ATCG"[(i+(side>0?1:0))%4];
      c.fillStyle=baseColors[base];c.beginPath();c.arc(b.x,b.y,5,0,TAU);c.fill();
      label(c,base,b.x,b.y,side<0?"#def0e5":"#fff0d0",8);
      hit(base,b.x,b.y,10,`碱基 ${base}`);hit("hydrogenBond",(a.x+b.x)/2,(a.y+b.y)/2,7,"互补配对中的氢键");
    }
    if(progress>.02){
      const u=.13+progress*.53, pos=pointAt(u,-side*21);
      drawMolecule(c,"polymerase",pos.x,pos.y,side<0?.48:.43,t);
      hit("polymerase",pos.x,pos.y,37,"DNA 聚合酶");
      if(side<0) drawPill(c,pos.x,pos.y-47,"DNA 聚合酶 · 单链模板位点","#a7dabb");
    }
  }

  function drawLayerOne(c, t) {
    const p = state.parts;
    label(c, "亲代 DNA 链", 130, 150, "#78909e", 10, "left");
    const unfold = state.uncoil, forkX = 420 + 62 * (p.forkProgress || 0);
    if (!p.opened) {
      drawDNA(c, { count: 23, y: 294, amp: 38 + 20 * unfold, phase: t / 1800, x0: 230 - 115 * unfold, x1: 770 + 115 * unfold, highlightFork: true });
      drawMolecule(c,"helicase",500,294,.65,t); hit("helicase",500,294,48,"解旋酶");
      drawPill(c, 500, 203, "拖动解旋酶，打开双链", "#9dd6dc");
    } else {
      drawDNA(c,{count:13,y:294,amp:34,phase:-12*TAU/10.5,x0:105,x1:forkX});
      drawForkArm(c,-1,forkX,p.copyProgress||0,t,false,0);
      drawForkArm(c,1,forkX,p.copyProgress||0,t,true,p.sealProgress||0);
      drawMolecule(c,"helicase",forkX+4,294,.74,t); hit("helicase",forkX+4,294,50,"解旋酶"); hit("replicationFork",forkX+30,294,32,"复制叉");
      c.save(); c.strokeStyle="rgba(127,201,213,.35)"; c.lineWidth=2; c.setLineDash([3,4]); c.beginPath(); c.arc(forkX+4,294,46,0,TAU); c.stroke(); c.restore();
      label(c,"解开的模板链",forkX+130,124,"#91bfca",9);
      drawPill(c, 235, 448, "亲代链", "#91a7b4"); drawPill(c, 602, 460, "逐位合成的互补链", "#9ad2b0");
       if(p.copied && (((p.copyProgress||0)>.72)||p.sealProgress!==undefined) && !p.sealed){
         const ligasePos=forkArmPoint(.69,1,forkX,-21,1);
         drawMolecule(c,"ligase",ligasePos.x,ligasePos.y,.58,t);hit("ligase",ligasePos.x,ligasePos.y,34,"DNA 连接酶");drawPill(c,ligasePos.x,ligasePos.y+54,"DNA 连接酶","#e8c38a");
         if(p.sealProgress!==undefined){
           const joined=p.sealProgress||0, ix=ligasePos.x, iy=ligasePos.y+31;
           roundedRect(c,ix-91,iy-20,182,79,9,"rgba(7,18,28,.94)","rgba(232,184,117,.58)");
           label(c,"互补碱基顺序",ix,iy-10,"#c7dce1",8);
           const bases=["A","T","C","G","T","A"], pair=["T","A","G","C","A","T"];
           for(let i=0;i<bases.length;i++){
             const bx=ix-62+i*25, col=baseColors[bases[i]], col2=baseColors[pair[i]];
             c.fillStyle=col;c.beginPath();c.arc(bx,iy+9,6,0,TAU);c.fill();label(c,bases[i],bx,iy+9,"#f3f5e9",7);
             c.fillStyle=col2;c.beginPath();c.arc(bx,iy+29,6,0,TAU);c.fill();label(c,pair[i],bx,iy+29,"#f3f5e9",7);
             c.strokeStyle="rgba(225,211,176,.8)";c.lineWidth=1.5;c.beginPath();c.moveTo(bx,iy+15);c.lineTo(bx,iy+23);c.stroke();
           }
           const nick=12*(1-joined);
           c.strokeStyle=joined>.94?"#a9e5bb":"#e8b875";c.lineWidth=3;c.beginPath();c.moveTo(ix-75,iy-1);c.lineTo(ix-nick,iy-1);c.moveTo(ix+nick,iy-1);c.lineTo(ix+75,iy-1);c.stroke();
           c.fillStyle="#f2d49a";for(let i=0;i<5;i++){const px=ix-69+i*34;c.beginPath();c.arc(px,iy-1,3,0,TAU);c.fill();}
           if(joined>.94){c.strokeStyle="#b5efc4";c.lineWidth=3;c.beginPath();c.moveTo(ix-10,iy-1);c.lineTo(ix+10,iy-1);c.stroke();}
           drawPill(c,ix,iy+73,"连接酶封合骨架缺口","#a7dabb");
         }
       }
      if(p.sealed)drawPill(c,730,476,"两条子代 DNA · 半保留复制","#a0d7b5");
      hit("backbone",220,252,28);hit("deoxyribose",280,323,17);hit("phosphate",330,257,15);
    }
  }

  function drawLayerTwo(c, t) {
    const p = state.parts;
    const { a } = drawDNA(c, { count: 23, y: 338, amp: 33, phase: t / 2300, sequence: TARGET, pamStart: 20, cut: !!p.cut, cutIndex: 17 });
    const targetX = a[11].x;
    const cutX = a[17].x;
    label(c, "目标 DNA", 124, 236, "#8094a1", 10, "left");
    roundedRect(c, a[20].x - 17, 210, 110, 25, 7, "rgba(232,184,117,.1)", "rgba(232,184,117,.34)"); label(c, "PAM · AGG", a[20].x + 38, 223, "#e8b875", 10);
    c.save();c.shadowColor="#b7a2e4";c.shadowBlur=p.imaged?19:7;c.strokeStyle=p.imaged?"rgba(205,184,255,.95)":"rgba(183,162,228,.55)";c.lineWidth=p.imaged?3:1.5;c.setLineDash([5,4]);c.strokeRect(a[6].x-16,286,a[17].x-a[6].x+32,99);c.restore();
    label(c,"目标基因位点",targetX,277,"#d0c0f1",10);hit("locus",targetX,338,43,"目标基因位点");
    roundedRect(c,137,268,145,67,9,"rgba(145,208,174,.055)","rgba(145,208,174,.34)");label(c,"启动子 · 转录调控区",209,256,"#a7dabb",9);hit("promoter",209,300,61,"启动子区域");
    hit("pam", a[21].x, 273, 26, "PAM · AGG"); hit("guide", targetX, 332, 28, "向导 RNA 配对区");
    if ((p.bound && !p.cut && !p.nhej && !p.hdr && !p.expression && !p.imaged) || (state.selectedTool === "cas9" && !p.expression && !p.imaged)) {
      const u=p.binding? p.bindProgress||0 : 1;
      const cx=p.bound?targetX+48:414+(targetX+48-414)*u,cy=p.bound?263:181+(263-181)*u;
      drawMolecule(c,"cas9",cx,cy,.82,t);
      label(c, "Cas9 核酸酶", cx, cy-59, "#b6dce5", 10);
      c.strokeStyle = "#91d0ae"; c.lineWidth = 3; c.beginPath(); c.moveTo(cx-54,cy+23); c.bezierCurveTo(cx-19,cy+4,targetX+34,292,targetX+82,304); c.stroke();
      if (p.bound) { drawPill(c, targetX + 105, 228, "向导 RNA 与 PAM 匹配", "#91d0ae"); hit("cas9", cx, cy, 76, "Cas9 核酸酶"); hit("guide",cx-12,cy+22,42,"向导 RNA · 20 nt 配对区"); }
    }
    if (p.cutting || p.cut) {
      const q=p.cutting?p.cutProgress||0:1, spread=3+14*q;
      // 两片剪刀刃沿对角线向切点合拢并交叉
      const off = 2 + 16 * (1 - q), dirA = Math.atan2(54, 2 * Math.max(spread, 8));
      for (const [dx0, dy0, ang] of [[-1, -1, dirA], [1, 1, dirA + Math.PI]]) {
        c.save(); c.translate(cutX + off * dx0, 338 + off * dy0); c.rotate(ang);
        c.fillStyle = "rgba(228,238,242,.95)"; c.beginPath(); c.moveTo(0, 0); c.lineTo(-52, -7); c.lineTo(-52, 7); c.closePath(); c.fill();
        c.fillStyle = "rgba(190,120,92,.9)"; c.beginPath(); c.moveTo(-52, -7); c.lineTo(-72, -11); c.lineTo(-52, 7); c.lineTo(-72, 11); c.closePath(); c.fill();
        c.restore();
      }
      c.save();c.strokeStyle=`rgba(255,132,105,${.35+.55*q})`;c.lineWidth=2+2*q;c.shadowColor="#ff8068";c.shadowBlur=8+14*q;
      c.beginPath();c.moveTo(cutX-spread,311);c.lineTo(cutX+spread,365);c.moveTo(cutX-spread,365);c.lineTo(cutX+spread,311);c.stroke();
      c.beginPath();c.arc(cutX,338,9+14*q,0,TAU);c.stroke();c.restore();
      if(p.cutting&&q>.35){drawPill(c,cutX,386,"HNH · RuvC 核酸酶结构域合拢","#ffb39d");}
      if(p.cut){drawPill(c, cutX, 418, "DNA 双链断裂 · 两端已分离", "#ff9c83");hit("repair",cutX,338,42,"DNA 双链断裂");}
      if(p.cut&&!p.nhej&&!p.hdr&&!p.cutting)drawPill(c,cutX,449,"右侧选择：NHEJ 直接连接 / HDR 精准修复","#ffd9c4");
    }
    if(p.nhejProgress!==undefined||p.nhej){
      const rp=p.nhej?1:(p.nhejProgress||0),gap=19*(1-rp);
      c.strokeStyle="#f0b17c";c.lineWidth=6;c.beginPath();c.moveTo(cutX-36,338);c.lineTo(cutX-gap,338);c.moveTo(cutX+gap,338);c.lineTo(cutX+36,338);c.stroke();
      if(rp>.62){
        c.fillStyle="#f08d76";c.beginPath();c.arc(cutX,338,4+5*rp,0,TAU);c.fill();
        label(c,"indel 示意",cutX,368,"#f0b49a",9);
        if(rp>.88){drawPill(c,cutX+4,452,"小片段插入 / 缺失 → 可能移码（基因敲除）","#f0b17c");}
      }
    }
    if(p.hdrProgress!==undefined||p.hdr){
      const rp=p.hdr?1:(p.hdrProgress||0),dx=(1-rp)*106;
      drawMolecule(c,"donor",cutX+115-dx,298,.64,t);hit("donor",cutX+115-dx,298,38,"供体 DNA · HDR 模板");
      c.strokeStyle=`rgba(232,184,117,${.25+.65*rp})`;c.lineWidth=2;c.setLineDash([4,4]);c.beginPath();c.moveTo(cutX+75-dx,298);c.lineTo(cutX+18,326);c.moveTo(cutX+75-dx,311);c.lineTo(cutX+18,350);c.stroke();c.setLineDash([]);
      if(rp>.6)label(c,"同源臂配对",cutX+52,283,"#e8b875",9);
      if(rp>.85){
        c.save();c.strokeStyle="rgba(145,208,174,.9)";c.lineWidth=3;c.shadowColor="#91d0ae";c.shadowBlur=10;
        c.beginPath();c.moveTo(a[14].x,a[14].y-13);c.lineTo(a[19].x,a[19].y-13);c.stroke();c.restore();
        drawPill(c,cutX+14,452,"修复后的目标序列 ✓（模板介导）","#a0d7b5");
      }
    }
    if (p.expression) {
      const up = p.expression === "up";
      const ep=p.expressionProgress??1;
      drawMolecule(c,up?"activator":"repressor",213,300,.68,t);
      for (let i = 0; i < (up ? 6 : 2); i++) { c.strokeStyle = up ? `rgba(145,208,174,${.16+.68*ep})` : `rgba(217,155,145,${.2+.5*(1-ep)})`; c.lineWidth = 2; c.beginPath(); c.moveTo(270 + i * 18, 274); c.lineTo(270 + i * 18, up ? 214 - i * 4 : 243 + i * 5); c.stroke(); }
      const mrnaCount=Math.floor(ep*(up?9:2));
      for(let i=0;i<mrnaCount;i++){const flow=(t/34)%46,px=314+(i%5)*18+flow*((i%2)?0:1),py=228+Math.floor(i/5)*17+Math.sin(t/140+i)*3;c.beginPath();c.arc(px,py,4,0,TAU);c.fillStyle=up?"#91d0ae":"#c17f79";c.fill();}
      if(up&&mrnaCount>2){c.strokeStyle="rgba(145,208,174,.55)";c.lineWidth=2;c.beginPath();c.moveTo(402,229);c.lineTo(464,229);c.stroke();label(c,"→ 翻译为蛋白质",498,229,"#a7dabb",9,"left");}
      drawPill(c, 235, 394, up ? "CRISPRa · 转录增强 ↑" : "CRISPRi · 转录减弱 ↓", up ? "#91d0ae" : "#d99b91");
      drawPill(c, 272, 436, up ? "应用：激活抑癌基因 / 增强抗逆基因表达" : "应用：沉默致病基因 / 研究基因功能", "#c7dce1");
      hit("promoter", 208, 300, 55, "启动子 · 基因调控区");
    }
    if (p.imaged) {
      const pulse = 1 + .18 * Math.sin(t / 180); c.beginPath(); c.arc(targetX, 337, 44 * pulse, 0, TAU); c.strokeStyle = "rgba(183,162,228,.96)"; c.lineWidth = 3; c.shadowColor = "#b7a2e4"; c.shadowBlur = 22; c.stroke(); c.shadowBlur = 0;
      for(let i=0;i<6;i++){const a0=t/420+i*TAU/6;c.beginPath();c.arc(targetX+Math.cos(a0)*52,337+Math.sin(a0)*52,2.5,0,TAU);c.fillStyle="rgba(224,212,255,.9)";c.fill();}
      drawMolecule(c,"marker",targetX,337,.48,t);
      drawPill(c, targetX, 405, "基因位点已标记 · 荧光持续脉冲", "#d0c0f1");
      drawPill(c, targetX, 436, "应用：染色体定位成像 / 突变位点诊断", "#c7dce1");
    }
    hit("backbone", 143, 350, 21); hit("promoter", 160, 289, 22, "启动子区域");
    if (p.cut) hit("donor", 545, 339, 55, "供体模板 / HDR");
  }

  function drawLayerThree(c, t) {
    const p = state.parts;
    c.save(); c.lineWidth = 2; c.strokeStyle = "rgba(127,201,213,.34)"; c.fillStyle = "rgba(58,101,123,.09)"; c.beginPath(); c.ellipse(385, 300, 280, 195, 0, 0, TAU); c.fill(); c.stroke(); c.restore();
    label(c, "细胞核", 164, 165, "#8fcbd1", 10, "left"); hit("nucleus", 217, 190, 33, "细胞核");
    const points = drawDNA(c, { count: 13, y: 252, amp: 28, phase: t / 2100, x0: 165, x1: 640, sequence: "ATGCCGTAGCTAG" });
    label(c, "DNA 模板", 172, 207, "#90a5b2", 9, "left"); hit("rnaPolymerase", 408, 228, 35, "RNA 聚合酶");
    drawProtein(c, p.transcribed ? 503 : 408, p.transcribed ? 237 : 245, "other", .5, true); drawPill(c, p.transcribed ? 507 : 410, 182, "RNA 聚合酶", "#9dd6dc");
    if (p.transcribed) {
      c.strokeStyle = "#9bd2ae"; c.lineWidth = 5; c.beginPath(); c.moveTo(155, 374); c.bezierCurveTo(270, 332, 360, 423, 462, 370); c.bezierCurveTo(528, 340, 597, 371, 668, 354); c.stroke();
      for (let i = 0; i < 12; i++) { const x = 172 + i * 40; c.fillStyle = i > 7 && !p.spliced ? "#b7a2e4" : "#91d0ae"; c.beginPath(); c.arc(x, 370 + Math.sin(i * .8) * 12, 4, 0, TAU); c.fill(); }
      label(c, p.spliced ? "成熟 mRNA" : "前体 mRNA · 外显子 + 内含子", 204, 424, "#9fd2b4", 9, "left");
      hit("preMrna", 385, 372, 32, "前体 mRNA"); hit("exon", 257, 355, 22, "外显子");
      hit("ribose", 187, 370, 12, "RNA 核糖");
      if (!p.spliced) {
        c.beginPath(); c.ellipse(500, 389, 32, 24, 0, 0, TAU); c.strokeStyle = "#ba9de0"; c.lineWidth = 2; c.stroke(); drawPill(c, 500, 445, "内含子", "#c8b0e4");
        drawMolecule(c, "spliceosome", 520, 341, .55, t); hit("intron", 500, 388, 28, "内含子"); hit("spliceosome", 520, 338, 30, "剪接体");
      } else {
        drawPill(c, 505, 401, "外显子已连接", "#91d0ae");
      }
    } else drawPill(c, 502, 382, "拖动 RNA 聚合酶至 DNA", "#9dd6dc");
    c.save(); c.strokeStyle = "rgba(232,184,117,.46)"; c.lineWidth = 3; c.beginPath(); c.arc(788, 284, 36, -.9, .9); c.stroke(); c.restore();
    drawPill(c, 815, 344, "核孔复合体", "#e8b875"); hit("pore", 790, 286, 46, "核孔复合体");
    if (p.exported) { strokeCurve(c, [{x:640,y:370},{x:710,y:350},{x:784,y:335},{x:866,y:315}], "#91d0ae", 3, .9, [5,5]); drawPill(c, 864, 279, "细胞质", "#91d0ae"); }
  }

  function drawLayerThreeAnimated(c, t) {
    const p=state.parts;
    c.save();c.lineWidth=2;c.strokeStyle="rgba(127,201,213,.34)";c.fillStyle="rgba(58,101,123,.09)";c.beginPath();c.ellipse(385,300,280,195,0,0,TAU);c.fill();c.beginPath();c.ellipse(385,300,280,195,0,.2,TAU-.2);c.stroke();c.restore();
    label(c,"细胞核",164,165,"#8fcbd1",10,"left");hit("nucleus",217,190,33,"细胞核");
    drawDNA(c,{count:13,y:252,amp:28,phase:t/2100,x0:165,x1:640,sequence:"ATGCCGTAGCTAG"});
    label(c,"DNA 模板链",172,207,"#90a5b2",9,"left");
    const tp=p.transcribed?(p.transcriptionProgress??1):0,polX=408+95*tp,polY=245-10*Math.sin(t/220);
    drawMolecule(c,"rnaPol",polX,polY,.72,t);drawPill(c,polX,177,"RNA 聚合酶","#9dd6dc");hit("rnaPolymerase",polX,polY,47,"RNA 聚合酶 · 延伸位点");
    if(p.transcribed){
      const sp=p.splicing?(p.splicingProgress||0):p.spliced?1:0;
      const rnaAt=u=>bezierPoint(u,{x:155,y:374},{x:270,y:332},{x:480,y:427},{x:670,y:354});
      const strand=Array.from({length:Math.max(2,Math.ceil(tp*30))},(_,i)=>rnaAt(tp*i/Math.max(1,Math.ceil(tp*30)-1)));
      if(strand.length>1)strokeCurve(c,strand,"#91d2ae",5,.9);
      if(!p.spliced&&tp>.5){const intron=Array.from({length:9},(_,i)=>rnaAt(.52+i*.027));strokeCurve(c,intron,"#b7a2e4",6,sp>.88?.3:.92);}
      if(p.splicing){const joinA=rnaAt(.52),joinB=rnaAt(.75),joinX=joinB.x+(joinA.x-joinB.x)*sp,joinY=joinB.y+(joinA.y-joinB.y)*sp;c.strokeStyle=`rgba(177,224,188,${.25+.7*sp})`;c.lineWidth=3+2*sp;c.beginPath();c.moveTo(joinA.x,joinA.y);c.lineTo(joinX,joinY);c.stroke();}
      const count=Math.floor(tp*13);
      for(let i=0;i<count;i++){const pos=rnaAt((i+.5)/13),x=pos.x,y=pos.y,isIntron=!p.spliced&&i>=7&&i<=9;if(isIntron&&sp>.88)continue;c.beginPath();c.arc(x,y,5,0,TAU);c.fillStyle=isIntron?"#b7a2e4":"#91d0ae";c.fill();if(i%3===0)label(c,"AUGC"[i%4],x,y-11,isIntron?"#d7c9ef":"#d3ead9",7);}
      label(c,p.spliced?"成熟 mRNA":"前体 mRNA · 外显子 + 内含子",204,424,"#9fd2b4",9,"left");
      hit("preMrna",385,372,32,"前体 mRNA");hit("exon",257,355,22,"外显子");hit("ribose",187,370,12,"RNA 核糖");
      if(!p.spliced){
        const loopScale=1-.72*sp,lx=500+76*sp,ly=389-42*sp;
        c.beginPath();c.ellipse(lx,ly,32*loopScale,24*loopScale,0,0,TAU);c.strokeStyle="#ba9de0";c.lineWidth=2.5;c.setLineDash([4,3]);c.stroke();c.setLineDash([]);
        drawPill(c,lx,ly+43,"内含子套索","#c8b0e4");drawMolecule(c,"spliceosome",500,341,.64,t);hit("intron",lx,ly,27,"内含子");hit("spliceosome",500,341,46,"剪接体 · 催化 RNA 剪接");
        if(p.splicing){c.strokeStyle="#e3d4ff";c.lineWidth=3;c.beginPath();c.moveTo(454,370);c.lineTo(476+14*sp,362-8*sp);c.moveTo(548-14*sp,362-8*sp);c.lineTo(565,370);c.stroke();}
      }else drawPill(c,505,401,"外显子已连接","#91d0ae");
    }else drawPill(c,502,382,"拖动 RNA 聚合酶至 DNA","#9dd6dc");
    drawMolecule(c,"nuclearPore",665,300,.82,t);drawPill(c,707,354,"核孔复合体 · 核膜通道","#e8b875");hit("pore",665,300,47,"核孔复合体 · 嵌在核膜上的选择性通道");
    if(p.exported||p.exportProgress>0){
      strokeCurve(c,[{x:640,y:370},{x:653,y:346},{x:661,y:322},{x:665,y:300}],"#91d0ae",3,.9,[5,5]);
      strokeCurve(c,[{x:665,y:300},{x:706,y:292},{x:784,y:302},{x:866,y:315}],"#91d0ae",3,.9,[5,5]);
      const ep=p.exported?1:(p.exportProgress||0);
      for(let i=0;i<4;i++){
        const u=Math.max(0,ep-i*.13),pos=u<.4?bezierPoint(u/.4,{x:640,y:370},{x:653,y:346},{x:661,y:322},{x:665,y:300}):bezierPoint((u-.4)/.6,{x:665,y:300},{x:706,y:292},{x:784,y:302},{x:866,y:315});
        c.beginPath();c.arc(pos.x,pos.y,5,0,TAU);c.fillStyle="#a5d9b7";c.fill();
      }
      drawPill(c,864,279,"细胞质","#91d0ae");
    }
  }

  function drawLayerFour(c, t) {
    const p = state.parts;
    label(c, "细胞质", 106, 105, "#8096a4", 10, "left");
    c.save(); c.strokeStyle = "rgba(127,201,213,.68)"; c.lineWidth = 8; c.lineCap = "round"; c.beginPath(); c.moveTo(116, 330); c.bezierCurveTo(288, 297, 448, 349, 860, 312); c.stroke(); c.restore();
    const codons = ["AUG", "CCG", "GUA", "GCU"];
    codons.forEach((codon, j) => { const x = 185 + j * 156; roundedRect(c, x, 344, 93, 27, 7, "rgba(127,201,213,.12)", "rgba(127,201,213,.26)"); label(c, codon, x+46, 357, "#c0e1e5", 11); hit("codon", x+46, 357, 24, `密码子 ${codon}`); });
    label(c, "mRNA · 5′ → 3′", 143, 390, "#91cbd0", 9, "left"); hit("rna", 277, 330, 24, "mRNA");
    if (p.ribosome || state.selectedTool === "ribosome") {
      const x = p.ribosome ? 492 : 492, y = 275;
      c.save(); const rg = c.createRadialGradient(x-18,y-23,5,x,y,140); rg.addColorStop(0,"#96c7d3"); rg.addColorStop(.5,"#50798b"); rg.addColorStop(1,"#294253"); c.fillStyle=rg; c.beginPath(); c.ellipse(x,y-34,145,72,-.03,0,TAU); c.fill(); c.beginPath(); c.ellipse(x,y+39,120,53,.04,0,TAU); c.fill(); c.strokeStyle="rgba(209,236,241,.34)"; c.lineWidth=1.4; c.stroke(); c.restore();
      drawPill(c, x, 163, "核糖体", "#b9e0e6"); hit("ribosome", x, y, 84, "核糖体");
    }
    const n = p.translated ? 5 : p.ribosome ? 2 : 0;
    for (let i = 0; i < n; i++) { const x = 509 + i*32, y = 189 - Math.sin(i*.8)*18; c.beginPath(); c.arc(x,y,8,0,TAU); c.fillStyle=["#e8b875","#91d0ae","#b7a2e4"][i%3]; c.fill(); c.strokeStyle="rgba(248,238,212,.45)"; c.stroke(); }
    if (p.ribosome) {
      const tx = 490 + (p.translated ? 35 : 0);
      c.strokeStyle = "#92d0a9"; c.lineWidth = 5; c.lineCap="round"; c.beginPath(); c.moveTo(tx,260); c.lineTo(tx-12,222); c.lineTo(tx-36,204); c.moveTo(tx-12,222); c.lineTo(tx+16,203); c.stroke();
      c.beginPath(); c.arc(tx,260,8,0,TAU); c.fillStyle="#a5d9b6"; c.fill();
      c.beginPath(); c.arc(tx-36,200,9,0,TAU); c.fillStyle="#e8b875"; c.fill(); hit("trna",tx-12,225,30,"转运 RNA · tRNA"); hit("aminoAcid",tx-36,200,20,"氨基酸");
    }
    if (p.translated) {
      strokeCurve(c, Array.from({length:8},(_,i)=>({x:580+i*28,y:213+Math.sin(i*.78)*24})), "#e8b875", 7, .9);
      drawPill(c, 700, 164, p.folded ? "折叠蛋白质" : "延伸中的多肽", "#e8c38a"); hit("peptide", 686, 214, 36, "多肽链");
    }
    if (p.folded) { drawProtein(c, 790, 237, "marker", .45, true); hit("protein",790,237,42,"折叠蛋白质"); }
    hit("codon", 340, 348, 28, "密码子");
  }

  function drawLayerFourAnimated(c,t) {
    const p=state.parts;
    label(c,"细胞质",106,105,"#8096a4",10,"left");
    c.save();c.strokeStyle="rgba(127,201,213,.65)";c.lineWidth=8;c.lineCap="round";c.beginPath();c.moveTo(116,330);c.bezierCurveTo(288,297,448,349,860,312);c.stroke();c.restore();
    const codons=["AUG","CCG","GUA","GCU"],read=Math.min(4,p.codonIndex||0);
    codons.forEach((codon,i)=>{const x=185+i*156,active=i===read&&p.translated;roundedRect(c,x,344,93,27,7,active?"rgba(145,208,174,.2)":"rgba(127,201,213,.1)",active?"rgba(145,208,174,.62)":"rgba(127,201,213,.25)");label(c,codon,x+46,357,active?"#d8f0df":"#c0e1e5",11);hit("codon",x+46,357,25,`密码子 ${codon}`);});
    label(c,"mRNA · 5′ → 3′",143,390,"#91cbd0",9,"left");hit("rna",277,330,24,"信使 RNA · mRNA");
    if(p.ribosome||state.selectedTool==="ribosome"){
      drawMolecule(c,"ribosome",492,275,.98,t);drawPill(c,492,169,"核糖体大小亚基","#b9e0e6");hit("ribosome",492,275,82,"核糖体 · 翻译场所");
    }
    const progress=p.translated?(p.translationProgress??1):0,aaCount=Math.floor(progress*4);
    for(let i=0;i<aaCount;i++){
      const x=565+i*33,y=211+Math.sin(i*.78)*21;
      c.beginPath();c.arc(x,y,8,0,TAU);c.fillStyle=["#e8b875","#91d0ae","#b7a2e4","#7fc9d5"][i%4];c.fill();
      if(i>0){c.strokeStyle="#f1d9ad";c.lineWidth=2;c.beginPath();c.moveTo(x-12,y-3);c.lineTo(x-5,y-1);c.stroke();}
      hit("aminoAcid",x,y,14,"氨基酸 · 肽链组成单元");
    }
    if(p.ribosome){
      const phase=progress>=1?0:(progress*4)%1,tx=548-42*phase,ty=196+21*Math.sin(phase*Math.PI);
      drawMolecule(c,"trna",tx,ty,.62,t);hit("trna",tx,ty,38,"tRNA · 反密码子配对");
      drawMolecule(c,"amino",tx+2,ty-49,.42,t);hit("aminoAcid",tx+2,ty-49,18,"被 tRNA 携带的氨基酸");
      drawPill(c,tx,ty+57,"反密码子配对","#9bd7b0");
    }
    if(p.translated){
      strokeCurve(c,Array.from({length:Math.max(2,aaCount+1)},(_,i)=>({x:575+i*29,y:212+Math.sin(i*.78)*20})),"#e8b875",6,.9);
      drawPill(c,700,160,p.folded?"折叠完成":"新生多肽链","#e8c38a");hit("peptide",686,214,36,"新生多肽链");
    }
    if(p.foldingProgress!==undefined||p.folded){
      const fp=p.folded?1:(p.foldingProgress||0);drawMolecule(c,"chaperone",760,235,.75,t);hit("chaperone",760,235,49,"分子伴侣 · 折叠辅助");
      const coil=1-.45*fp;for(let i=0;i<5;i++){c.beginPath();c.arc(748+i*6,235+Math.sin(i*1.6)*16*coil,4+fp*1.2,0,TAU);c.fillStyle="#f0c982";c.fill();}
      drawPill(c,760,294,"折叠辅助","#c6b5ea");
    }
    hit("codon",340,348,28,"密码子");
  }

  function drawLayerFive(c, t) {
    const p = state.parts;
    c.save(); c.beginPath(); c.ellipse(500, 302, 424, 222, -.04, 0, TAU); c.fillStyle="rgba(31,71,86,.12)"; c.fill(); c.strokeStyle="rgba(127,201,213,.56)"; c.lineWidth=2; c.stroke(); c.restore();
    label(c,"细胞膜",500,88,"#8fc8d0",10); hit("cell",500,114,35,"真核细胞"); hit("membrane",903,286,48,"细胞膜");
    c.save(); c.beginPath(); c.ellipse(155,280,78,99,0,0,TAU); c.fillStyle="rgba(117,98,150,.18)"; c.fill(); c.strokeStyle="rgba(183,162,228,.57)"; c.lineWidth=2; c.stroke(); c.restore(); drawPill(c,155,405,"细胞核","#c6b4ea"); hit("nucleus",155,275,56,"细胞核");
    for(let i=0;i<4;i++){const y=205+i*48; c.strokeStyle="rgba(127,201,213,.74)"; c.lineWidth=9; c.lineCap="round"; c.beginPath(); c.moveTo(300,y); c.bezierCurveTo(355,y-14,395,y+14,451,y); c.stroke(); if(i%2===0){for(let j=0;j<4;j++){c.beginPath();c.arc(335+j*25,y-9,3,0,TAU);c.fillStyle="#c6d9e0";c.fill();}}}
    drawPill(c,376,432,"粗面内质网","#9cd6df"); hit("er",374,281,62,"粗面内质网");
    if(p.signal||p.inER){drawProtein(c,420,280,"other",.35,true);drawPill(c,425,220,"信号肽","#e8b875");hit("signal",420,282,31,"信号肽");hit("protein",428,277,24,"蛋白质货物");}
    for(let i=0;i<5;i++){const y=221+i*31; c.beginPath(); c.ellipse(634, y, 57-i*2, 8, -.12, 0, TAU); c.fillStyle=`rgba(183,162,228,${.19+i*.025})`; c.fill(); c.strokeStyle="rgba(183,162,228,.56)"; c.lineWidth=1.5;c.stroke();}
    drawPill(c,634,413,"高尔基体","#c7b5e8"); hit("golgi",634,280,58,"高尔基体");
    if(p.vesicle||p.atGolgi||p.delivered){const x=p.delivered?820:p.atGolgi?700:540; c.beginPath();c.arc(x,274,39,0,TAU);c.fillStyle="rgba(232,184,117,.12)";c.fill();c.strokeStyle="#e8b875";c.lineWidth=2;c.stroke();for(let j=0;j<4;j++){c.beginPath();c.arc(x+Math.cos(j*TAU/4)*12,274+Math.sin(j*TAU/4)*12,5,0,TAU);c.fillStyle="#9bd0ac";c.fill();}hit("vesicle",x,274,43,"运输囊泡");}
    c.save(); c.setLineDash([5,6]); c.strokeStyle="rgba(232,184,117,.42)"; c.lineWidth=2; c.beginPath(); c.moveTo(464,274); c.bezierCurveTo(526,214,560,334,591,274); c.bezierCurveTo(720,205,744,290,845,276); c.stroke(); c.restore();
    drawPill(c,838,354,p.delivered?"已抵达目的地":"分泌运输路径","#e8bf83");
    hit("vesicle",548,275,33,"运输囊泡"); hit("protein",808,277,32,"蛋白质货物");
  }

  function drawLayerFiveAnimated(c,t){
    const p=state.parts;
    c.save();c.beginPath();c.ellipse(500,302,424,222,-.04,0,TAU);c.fillStyle="rgba(31,71,86,.12)";c.fill();c.strokeStyle="rgba(127,201,213,.56)";c.lineWidth=2;c.stroke();c.restore();
    label(c,"细胞膜",500,88,"#8fc8d0",10);hit("cell",500,114,35,"真核细胞");hit("membrane",903,286,48,"细胞膜");
    c.save();c.beginPath();c.ellipse(155,280,78,99,0,0,TAU);c.fillStyle="rgba(117,98,150,.18)";c.fill();c.strokeStyle="rgba(183,162,228,.57)";c.lineWidth=2;c.beginPath();c.ellipse(155,280,78,99,0,.34,TAU-.34);c.stroke();c.restore();
    drawPill(c,155,405,"细胞核","#c6b4ea");hit("nucleus",155,275,56,"细胞核");
    drawDNA(c,{count:9,y:277,amp:20,phase:t/1800,x0:115,x1:195,showBackbone:false});
    drawMolecule(c,"nuclearPore",233,280,.58,t);hit("pore",233,280,35,"核孔复合体 · 嵌在核膜上的通道");
    const mp=p.exported?1:(p.messageProgress||0);
    if(mp>0){
      c.strokeStyle="rgba(145,208,174,.45)";c.lineWidth=3;c.setLineDash([5,5]);c.beginPath();c.moveTo(194,300);c.bezierCurveTo(208,297,220,288,233,280);c.bezierCurveTo(255,268,285,270,315,270);c.stroke();c.setLineDash([]);
      const pos=mp<.42?bezierPoint(mp/.42,{x:194,y:300},{x:208,y:297},{x:220,y:288},{x:233,y:280}):bezierPoint((mp-.42)/.58,{x:233,y:280},{x:255,y:268},{x:285,y:270},{x:315,y:270});
      for(let i=0;i<5;i++){c.beginPath();c.arc(pos.x+i*8,pos.y+Math.sin(i)*4,4,0,TAU);c.fillStyle="#91d0ae";c.fill();}
      drawPill(c,255,342,"mRNA 出核","#91d0ae");hit("rna",pos.x,pos.y,28,"成熟 mRNA · 经核孔输出");
    }
    for(let i=0;i<4;i++){const y=210+i*43;c.strokeStyle="rgba(127,201,213,.72)";c.lineWidth=8;c.lineCap="round";c.beginPath();c.moveTo(315,y);c.bezierCurveTo(365,y-20,407,y+20,465,y);c.stroke();for(let j=0;j<3;j++){c.beginPath();c.arc(345+j*32,y-8,3,0,TAU);c.fillStyle="#c6d9e0";c.fill();}}
    drawPill(c,390,442,"粗面内质网","#9cd6df");hit("er",390,286,59,"粗面内质网 · 分泌蛋白入口");
    if(mp>.6||p.signalProgress!==undefined||p.inER){drawMolecule(c,"ribosome",354,270,.48,t);hit("ribosome",354,270,34,"核糖体 · 翻译信号肽");}
    if(p.signalProgress!==undefined||p.signal||p.inER){
      const sp=p.inER?1:(p.signalProgress||0),sx=350+105*sp,sy=249+7*Math.sin(sp*Math.PI);
      drawMolecule(c,"signal",sx,sy,.72,t);drawMolecule(c,"other",sx+22,sy+27,.25,t);hit("signal",sx,sy,30,"信号肽 · 新生蛋白的定位标记");hit("protein",sx+22,sy+27,22,"新生蛋白链");
      if(sp>.25)strokeCurve(c,[{x:360,y:282},{x:390,y:305},{x:420,y:292},{x:sx,y:sy+20}],"#e8b875",4,.9);
    }
    for(let i=0;i<5;i++){const y=215+i*30;c.beginPath();c.ellipse(635,y,56-i*2,8,-.1,0,TAU);c.fillStyle=`rgba(183,162,228,${.18+i*.025})`;c.fill();c.strokeStyle="rgba(183,162,228,.55)";c.lineWidth=1.4;c.stroke();}
    drawPill(c,635,397,"高尔基体","#c7b5e8");hit("golgi",635,278,56,"高尔基体 · 加工与分拣");
    c.save();c.setLineDash([5,6]);c.strokeStyle="rgba(232,184,117,.42)";c.lineWidth=2;c.beginPath();c.moveTo(465,280);c.bezierCurveTo(520,222,568,334,618,280);c.bezierCurveTo(720,212,768,315,894,280);c.stroke();c.restore();
    let transport= p.delivered?1:(p.transportProgress||0),vesiclePos=null;
    if(transport>0){
      if(transport<.42){const u=transport/.42;vesiclePos=bezierPoint(u,{x:470,y:280},{x:520,y:222},{x:566,y:335},{x:630,y:280});}
      else{const u=(transport-.42)/.58;vesiclePos=bezierPoint(u,{x:630,y:280},{x:710,y:212},{x:770,y:326},{x:894,y:280});}
      drawMolecule(c,"vesicle",vesiclePos.x,vesiclePos.y,.82,t);drawMolecule(c,"amino",vesiclePos.x,vesiclePos.y,.34,t);hit("vesicle",vesiclePos.x,vesiclePos.y,43,"运输囊泡");hit("protein",vesiclePos.x,vesiclePos.y,18,"囊泡中的蛋白质货物");
    }
    if(p.delivered){
      c.strokeStyle="#91d0ae";c.lineWidth=3;c.beginPath();c.moveTo(895,280);c.lineTo(946,280);c.lineTo(934,270);c.moveTo(946,280);c.lineTo(934,290);c.stroke();
      c.beginPath();c.arc(955,280,9,0,TAU);c.fillStyle="#e8b875";c.fill();drawPill(c,893,346,"膜融合 · 蛋白释放","#a5d9b7");hit("protein",955,280,20,"已释放的分泌蛋白");
    }
    drawPill(c,777,403,p.delivered?"已到达细胞膜":"连续分泌运输路径","#e8bf83");
  }

  function drawScene(t) {
    if (!state.layer || !resizeCanvas(canvas, ctx)) return;
    drawBackdrop(ctx, t); state.hits = [];
    state.camera.x += (state.cameraTarget.x - state.camera.x) * .09;
    state.camera.y += (state.cameraTarget.y - state.camera.y) * .09;
    state.camera.zoom += (state.cameraTarget.zoom - state.camera.zoom) * .09;
    state.zoom = state.camera.zoom;
    state.uncoil += (1 - state.uncoil) * .045;
    ctx.save();
    ctx.translate(W/2, H/2); ctx.scale(state.camera.zoom, state.camera.zoom); ctx.translate(-state.camera.x, -state.camera.y);
    if (state.layer === 1) drawLayerOne(ctx,t);
    else if (state.layer === 2) drawLayerTwo(ctx,t);
    else if (state.layer === 3) drawLayerThreeAnimated(ctx,t);
    else if (state.layer === 4) drawLayerFourAnimated(ctx,t);
    else drawLayerFiveAnimated(ctx,t);
    ctx.restore();
    const p = state.parts;
    const stageState = state.layer === 1 ? p.sealed ? "repaired" : p.opened ? "bound" : "idle"
      : state.layer === 2 ? p.hdr || p.nhej ? "repaired" : p.cut ? "cut" : p.bound ? "bound" : "idle"
      : state.layer === 3 ? p.exported ? "repaired" : p.spliced || p.transcribed ? "bound" : "idle"
      : state.layer === 4 ? p.folded ? "repaired" : p.translated || p.ribosome ? "bound" : "idle"
      : p.delivered ? "repaired" : p.inER || p.atGolgi ? "bound" : "idle";
    $("#moleculeCard").dataset.state = stageState;
    const labels = { idle:"等待操作", bound:"流程进行中", cut:"DNA 已切开", repaired:"路径已完成" };
    $("#canvasStatus span:last-child").textContent = labels[stageState];
    $("#cameraLabel").hidden = !state.motion;
    $("#canvasInstruction").hidden = !!state.motion;
    if (state.dragging?.over) drawDraggedTool(ctx, state.dragging.tool, state.dragging.point);
  }

  function drawDraggedTool(c, tool, point) {
    const [name,,color,icon] = toolData[tool] || ["分子工具","","#7fc9d5","•"];
    const shapes={helicase:"helicase",polymerase:"polymerase",ligase:"ligase",cas9:"cas9",donor:"donor",activator:"activator",repressor:"repressor",marker:"marker",rnaPol:"rnaPol",spliceosome:"spliceosome",nuclearPore:"nuclearPore",ribosome:"ribosome",trna:"trna",amino:"amino",chaperone:"chaperone",signal:"signal",er:"er",vesicle:"vesicle",golgi:"golgi",membrane:"membrane"};
    c.save(); c.globalAlpha = .9; drawMolecule(c,shapes[tool]||"other",point.x,point.y,.72,performance.now()); c.restore();
    drawPill(c,point.x,point.y+62,name,color);
  }

  function drawHero(t) {
    if (!resizeCanvas(heroCanvas, heroCtx)) return;
    const c = heroCtx; c.clearRect(0,0,W,H);
    let g=c.createRadialGradient(650,270,8,660,270,510);g.addColorStop(0,"rgba(78,142,160,.29)");g.addColorStop(1,"rgba(5,15,24,0)");c.fillStyle=g;c.fillRect(0,0,W,H);
    c.strokeStyle="rgba(148,190,208,.07)";c.lineWidth=1;for(let i=0;i<12;i++){c.beginPath();c.arc(670,280,90+i*36,0,TAU);c.stroke();}
    const baseX=395, dx=27, count=24, phase=t/860;
    const pts=[[],[]];
    for(let i=0;i<count;i++){const x=baseX+i*dx,p=phase+i*TAU/10.5;const z=Math.cos(p),amp=120;pts[0].push({x,y:275+Math.sin(p)*amp,z,p});pts[1].push({x,y:275-Math.sin(p)*amp,z:-z,p:p+Math.PI});}
    [0,1].forEach(k=>{const arr=pts[k];for(let i=0;i<arr.length-1;i++){const p=arr[i],q=arr[i+1];c.beginPath();c.moveTo(p.x,p.y);c.quadraticCurveTo((p.x+q.x)/2,(p.y+q.y)/2,q.x,q.y);const grd=c.createLinearGradient(p.x,p.y,q.x,q.y);grd.addColorStop(0,k?"#db8379":"#67c2cc");grd.addColorStop(1,k?"#f1a183":"#92d7ca");c.strokeStyle=grd;c.lineWidth=7+Math.max(0,p.z)*3;c.lineCap="round";c.shadowColor=k?"#ed8377":"#70ced0";c.shadowBlur=12;c.stroke();} });
    for(let i=0;i<count;i++){const a=pts[0][i],b=pts[1][i];c.save();c.strokeStyle=`rgba(225,202,157,${.3+.4*Math.max(0,a.z)})`;c.lineWidth=2;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.fillStyle=baseColors[["A","T","C","G"][i%4]];c.beginPath();c.arc(a.x,a.y,3+Math.max(0,a.z)*2,0,TAU);c.fill();c.restore();}
    c.save();c.globalAlpha=.58;c.strokeStyle="rgba(145,208,174,.42)";c.setLineDash([3,6]);c.beginPath();c.moveTo(455,275);c.bezierCurveTo(610,240,730,326,890,273);c.stroke();c.restore();
  }

  function canvasPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX-r.left) * W/r.width, y: (e.clientY-r.top) * H/r.height };
  }
  function scenePoint(e) {
    const point = canvasPoint(e);
    const zoom = Math.max(state.camera.zoom, 0.01);
    return { x: (point.x - W / 2) / zoom + state.camera.x, y: (point.y - H / 2) / zoom + state.camera.y };
  }
  function inCanvas(e) { const r=canvas.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom; }
  function findHit(point) { return [...state.hits].reverse().find(h => Math.hypot(point.x-h.x, point.y-h.y) <= h.r); }

  let pointer = null;
  window.addEventListener("pointerdown", e => {
    const card = e.target.closest(".tool-card");
    if (card && state.layer) {
      pointer = { fromTool: true, tool: card.dataset.tool, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
      state.dragging = { tool: card.dataset.tool, point: { x: 500, y: 280 }, over: false };
      try { card.setPointerCapture(e.pointerId); } catch {}
      return;
    }
    if (e.target === canvas && state.layer) {
      pointer = { fromTool: false, tool: state.selectedTool, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
      try { canvas.setPointerCapture(e.pointerId); } catch {}
    }
  });
  window.addEventListener("pointermove", e => {
    if (!pointer || pointer.id !== e.pointerId) return;
    if (Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y) > 6) pointer.moved = true;
    if (!pointer.moved) return;
    if (!state.dragging) state.dragging = { tool:pointer.tool, point:{x:500,y:280}, over:false };
    if (inCanvas(e)) { state.dragging.point=canvasPoint(e); state.dragging.over=true; }
    else state.dragging.over=false;
    drawScene(performance.now());
  });
  window.addEventListener("pointerup", e => {
    if (!pointer || pointer.id !== e.pointerId) return;
    const current = pointer; pointer = null;
    const inside = inCanvas(e);
    if (current.fromTool) {
      selectTool(current.tool);
      if (current.moved && inside) applyTool(current.tool, scenePoint(e));
      state.dragging = null; drawScene(performance.now()); return;
    }
    const point = scenePoint(e);
    if (current.moved && inside) applyTool(current.tool, point);
    else {
      const selected = findHit(point);
      if (selected) showStructure(selected.name, selected.label);
      else if (inside) applyTool(current.tool, point);
    }
    state.dragging = null; drawScene(performance.now());
  });
  canvas.addEventListener("pointercancel", () => { pointer=null;state.dragging=null;drawScene(performance.now()); });

  $("#primaryAction").addEventListener("click", () => { AudioFX.click(); advanceAction(); });
  $("#resetButton").addEventListener("click", () => { if (state.tour?.running) stopTour(); state.layer ? resetLayer() : goHome(); });
  $("#soundButton").addEventListener("click", () => {
    const next = !AudioFX.isEnabled();
    AudioFX.setEnabled(next);
    $("#soundButton").classList.toggle("muted", !next);
    AudioFX.click();
  });
  if (!AudioFX.isEnabled()) $("#soundButton").classList.add("muted");
  $("#tourButton").addEventListener("click", startTour);
  $("#backHome").addEventListener("click", goHome);
  $("#homeBrand").addEventListener("click", e => { e.preventDefault(); goHome(); });
  $("#enterLayerOne").addEventListener("click", () => switchLayer(1));
  $$("[data-layer]").forEach(button => button.addEventListener("click", () => switchLayer(button.dataset.layer)));
  $$("[data-repair]").forEach(button => button.addEventListener("click", () => {
    if (state.layer !== 2 || !(state.parts.cut || state.parts.nhej || state.parts.hdr)) return;
    state.motion = null;
    state.parts.nhej = false; state.parts.hdr = false; state.parts.cut = true;
    if (button.dataset.repair === "hdr") { selectTool("donor"); startMotion(["hdr"]); }
    else startMotion(["nhej"]);
  }));

  function loop(t) {
    updateMotion(t);
    if (state.tour?.running) updateTour(t);
    if (!document.body.classList.contains("in-lab")) drawHero(t);
    else drawScene(t);
    requestAnimationFrame(loop);
  }
  window.addEventListener("resize", () => { drawHero(performance.now()); drawScene(performance.now()); });
  switchLayer(1);
  goHome();
  requestAnimationFrame(loop);
})();
