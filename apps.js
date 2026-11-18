/* 基因编辑 · 应用场景实验室 —— 场景引擎 + 应用速览 */
(() => {
  const $ = (s) => document.querySelector(s);
  const canvas = $("#sceneCanvas");
  const ctx = canvas.getContext("2d");
  const W = 1000, H = 560, TAU = Math.PI * 2;

  const state = { scenario: 0, step: 0, phase: 0, playing: false, flash: 0, advanceAt: 0, hits: [], lastT: 0 };

  /* ─────────────── 画布助手 ─────────────── */
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(w / W, 0, 0, h / H, 0, 0);
    return true;
  }
  function rr(c, x, y, w, h, rad, fill, stroke) { c.beginPath(); c.roundRect(x, y, w, h, rad); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.stroke(); } }
  function pill(c, x, y, text, color) {
    c.save(); c.font = "500 10px Inter, 'Microsoft YaHei UI', sans-serif";
    const w = c.measureText(text).width + 20;
    rr(c, x - w / 2, y - 11, w, 22, 7, "rgba(7,17,27,.85)", "rgba(164,194,208,.18)");
    c.fillStyle = color; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, x, y + 0.5); c.restore();
  }
  function lbl(c, text, x, y, color, size, align) {
    c.save(); c.fillStyle = color; c.font = "500 " + (size || 11) + "px Inter, 'Microsoft YaHei UI', sans-serif";
    c.textAlign = align || "center"; c.textBaseline = "middle"; c.fillText(text, x, y); c.restore();
  }
  function circle(c, x, y, r, fill, stroke, w) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = w || 1.5; c.stroke(); } }
  function hit(x, y, r) { state.hits.push({ x, y, r }); }
  function hotspot(c, x, y, r, t, label2) {
    const pulse = 1 + .12 * Math.sin(t / 220);
    c.save(); c.strokeStyle = "rgba(232,184,117,.9)"; c.lineWidth = 2.5; c.shadowColor = "#e8b875"; c.shadowBlur = 14;
    c.beginPath(); c.arc(x, y, r * pulse, 0, TAU); c.stroke(); c.restore();
    if (label2) pill(c, x, y - r - 16, label2, "#e8cfa4");
    hit(x, y, r * 1.35);
  }
  function vessel(c, y) {
    c.save(); c.strokeStyle = "rgba(90,48,46,.5)"; c.lineWidth = 30; c.lineCap = "round";
    c.beginPath(); c.moveTo(60, y); c.bezierCurveTo(300, y - 40, 700, y + 40, 940, y); c.stroke();
    c.strokeStyle = "rgba(155,88,84,.75)"; c.lineWidth = 26;
    c.beginPath(); c.moveTo(60, y); c.bezierCurveTo(300, y - 40, 700, y + 40, 940, y); c.stroke(); c.restore();
  }
  function redCell(c, x, y, r) { circle(c, x, y, r, "#c96b62", "rgba(255,220,200,.35)", 1.5); }
  function sickle(c, x, y, r, ang) {
    c.save(); c.translate(x, y); c.rotate(ang || 0); c.fillStyle = "#b94a45";
    c.beginPath(); c.arc(0, 0, r, -1.9, 1.9); c.arc(-r * .35, 0, r * .62, 1.9, -1.9, true); c.fill(); c.restore();
  }
  function dnaMini(c, x, y, w, t, amp) {
    c.save(); amp = amp || 15;
    for (const [col, sgn] of [["rgba(191,95,104,.85)", 1], ["rgba(237,129,120,.9)", -1]]) {
      c.strokeStyle = col; c.lineWidth = 4; c.beginPath();
      for (let i = 0; i <= 20; i++) { const px = x - w / 2 + i * w / 20, py = y + sgn * Math.sin(i * .9 + t / 600) * amp; if (i === 0) c.moveTo(px, py); else c.lineTo(px, py); }
      c.stroke();
    }
    c.strokeStyle = "rgba(161,183,193,.5)"; c.lineWidth = 1.5;
    for (let i = 0; i < 20; i += 2) {
      c.beginPath();
      c.moveTo(x - w / 2 + i * w / 20, y + Math.sin(i * .9 + t / 600) * amp);
      c.lineTo(x - w / 2 + (i + 1) * w / 20, y - Math.sin((i + 1) * .9 + t / 600) * amp);
      c.stroke();
    }
    c.restore();
  }
  function pig(c, x, y, s, healthy) {
    c.save(); c.translate(x, y); c.scale(s, s);
    const body = healthy ? "#d9a0b8" : "#b98a94";
    c.fillStyle = body;
    c.beginPath(); c.ellipse(0, 8, 62, 38, 0, 0, TAU); c.fill();
    c.beginPath(); c.arc(70, -6, 26, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(84, 2, 12, 9, 0, 0, TAU); c.fillStyle = healthy ? "#e8b8c8" : "#c79aa2"; c.fill();
    c.fillStyle = body;
    c.beginPath(); c.moveTo(70, -28); c.lineTo(80, -52); c.lineTo(96, -30); c.closePath(); c.fill();
    c.fillStyle = "#7a5a63";
    for (const lx of [-40, -16, 8, 32]) { rr(c, lx - 4, 44, 9, 22, 4, "#7a5a63"); }
    c.fillStyle = "#2e2326"; c.beginPath(); c.arc(60, -8, 3, 0, TAU); c.fill();
    if (!healthy) {
      c.strokeStyle = "rgba(239,129,121,.95)"; c.lineWidth = 3; c.lineCap = "round";
      for (const [dx, dy] of [[22, -42], [50, -16]]) {
        c.beginPath(); c.moveTo(dx - 7, dy - 7); c.lineTo(dx + 7, dy + 7); c.moveTo(dx + 7, dy - 7); c.lineTo(dx - 7, dy + 7); c.stroke();
      }
    }
    c.restore();
  }
  function stemCell(c, x, y, r) { circle(c, x, y, r, "#d9a0b8", "rgba(248,238,212,.4)", 1.5); circle(c, x, y, r * .42, "#35536b", "rgba(255,255,255,.22)", 1); }
  function scissors(c, x, y, s, rot) {
    c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(s, s);
    c.fillStyle = "rgba(228,238,242,.95)";
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-34, -6); c.lineTo(-34, 6); c.closePath(); c.fill();
    c.fillStyle = "rgba(190,120,92,.9)";
    c.beginPath(); c.moveTo(-34, -6); c.lineTo(-50, -10); c.lineTo(-34, 6); c.lineTo(-50, 10); c.closePath(); c.fill();
    c.fillStyle = "#5b7280"; c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill(); c.restore();
  }
  function virus(c, x, y, r, t) {
    c.save(); c.translate(x, y); c.rotate(t / 400);
    c.fillStyle = "rgba(217,155,145,.85)"; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.strokeStyle = "rgba(240,180,170,.9)"; c.lineWidth = 2;
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; c.beginPath(); c.moveTo(Math.cos(a) * r, Math.sin(a) * r); c.lineTo(Math.cos(a) * (r + 8), Math.sin(a) * (r + 8)); c.stroke(); }
    c.restore();
  }

  /* ─────────────── 四个互动场景 ─────────────── */
  const SCENARIOS = [
    {
      id: "anemia", icon: "🩸", title: "红细胞贫血的基因疗法", sub: "Casgevy · 体外编辑造血干细胞", color: "#e58f7f",
      source: "依据：Casgevy 2023–2024 英美获批 · EHA 2024 长期随访",
      steps: [
        {
          type: "tap", title: "病变：镰刀形红细胞", text: "患者红细胞因血红蛋白突变呈镰刀形，堵塞小血管，引起剧痛与器官损伤。点击发光处查看堵塞。", meaning: "病因：HBB 基因点突变，使成人血红蛋白 HbA 异常聚合。",
          hotspots: [[470, 300, 55]], draw(c, t) {
            vessel(c, 300);
            sickle(c, 430, 285, 22, .4); sickle(c, 470, 300, 24, .2); sickle(c, 512, 288, 20, .5);
            redCell(c, 320, 285, 16); redCell(c, 380, 318, 14); redCell(c, 700, 290, 16); redCell(c, 760, 315, 14);
            lbl(c, "镰刀形红细胞堵塞微血管", 500, 175, "#f0b49a", 13);
            hotspot(c, 470, 300, 52, t, "点击查看");
          }
        },
        {
          type: "tap", title: "提取造血干细胞", text: "从患者骨髓中采集造血干细胞——治疗的对象是患者自己的细胞。点击发光的干细胞。", meaning: "自体细胞：编辑后回输，免疫兼容、无需配型。",
          hotspots: [[400, 320, 55]], draw(c, t) {
            circle(c, 500, 300, 150, "rgba(120,80,90,.22)");
            lbl(c, "骨髓", 155, 300, "#9a8a92", 12, "left");
            stemCell(c, 380, 300, 32); stemCell(c, 445, 342, 28); stemCell(c, 340, 350, 26);
            syringe(c, 585, 330, -.5, "#e58f7f");
            lbl(c, "采集患者造血干细胞", 400, 200, "#e8cfa4", 13);
            hotspot(c, 400, 320, 50, t, "点击采集");
          }
        },
        {
          type: "tap", title: "电转：Cas9 编辑 BCL11A", text: "用电脉冲把 Cas9·sgRNA 送入细胞核，切断 BCL11A 红系增强子——解除对胎儿血红蛋白 HbF 的抑制。点击剪刀。", meaning: "原理：不修复突变基因，而是重新开启出生后被关闭的 HbF。",
          hotspots: [[540, 300, 60]], draw(c, t) {
            circle(c, 420, 300, 92, "#c9d6dd", "rgba(255,255,255,.28)", 2); circle(c, 420, 300, 38, "#35536b");
            dnaMini(c, 420, 300, 130, t);
            scissors(c, 545, 300, 1.35, Math.sin(t / 500) * .12);
            pill(c, 420, 415, "BCL11A 增强子", "#9bc7e8");
            lbl(c, "Cas9·sgRNA 定位并切断靶序列", 500, 175, "#bcdcf2", 13);
            hotspot(c, 540, 300, 52, t, "点击编辑");
          }
        },
        {
          type: "auto", duration: 3200, title: "编辑后的细胞扩增", text: "确认编辑成功后，在体外培养扩增到治疗剂量。", meaning: "质检：测序确认编辑位置正确、无脱靶。",
          draw(c, t, p) {
            const n = 1 + Math.floor(p * 3);
            for (let i = 0; i < n; i++) {
              const a = i * TAU / 3;
              stemCell(c, 500 + Math.cos(a) * 75, 300 + Math.sin(a) * 42, 26);
            }
            const sc = 1 + .15 * Math.sin(p * TAU * 2);
            circle(c, 500, 300, 36 * sc, "rgba(145,208,174,.12)", "rgba(145,208,174,.55)", 2);
            lbl(c, "扩增培养 · 细胞分裂", 500, 175, "#a9dcc0", 13);
            lbl(c, Math.floor(p * 100) + "%", 500, 430, "#7d929f", 11);
          }
        },
        {
          type: "tap", title: "回输患者体内", text: "把编辑好的造血干细胞经静脉输回患者——新细胞在体内重建造血系统。点击输液装置。", meaning: "回输前需清髓预处理，为新细胞腾出空间。",
          hotspots: [[620, 300, 65]], draw(c, t) {
            vessel(c, 360);
            rr(c, 618, 85, 76, 112, 12, "rgba(127,201,213,.1)", "rgba(127,201,213,.5)");
            lbl(c, "编辑后细胞", 656, 62, "#9dd6dc", 11);
            c.save(); c.strokeStyle = "rgba(127,201,213,.6)"; c.lineWidth = 4;
            c.beginPath(); c.moveTo(656, 197); c.lineTo(656, 262); c.moveTo(656, 262); c.bezierCurveTo(636, 300, 660, 330, 600, 360); c.stroke(); c.restore();
            circle(c, 655, 282, 6, "#a9dcc0"); circle(c, 645, 312, 6, "#a9dcc0");
            lbl(c, "静脉回输", 560, 430, "#e8cfa4", 11);
            hotspot(c, 620, 300, 60, t, "点击回输");
          }
        },
        {
          type: "final", title: "恢复正常红细胞", text: "新细胞持续产生胎儿血红蛋白 HbF：红细胞恢复圆盘形、血管畅通；长期随访显示多数患者多年无需输血。", meaning: "应用意义：一次治疗、长期获益——全球首款获批的 CRISPR 疗法。",
          draw(c, t) {
            vessel(c, 200);
            sickle(c, 240, 188, 17, .3); sickle(c, 300, 206, 18, .2); sickle(c, 370, 182, 16, .4);
            redCell(c, 560, 205, 16); redCell(c, 630, 185, 14); redCell(c, 700, 200, 16); redCell(c, 770, 182, 14);
            pill(c, 290, 105, "治疗前：镰刀形 · 易堵塞", "#f0b49a");
            pill(c, 680, 105, "治疗后：圆盘形 · 血流畅通", "#a9dcc0");
            rr(c, 300, 330, 400, 90, 12, "rgba(145,208,174,.07)", "rgba(145,208,174,.4)");
            lbl(c, "HbF 表达恢复", 380, 370, "#a9dcc0", 13);
            lbl(c, "多数患者多年无需输血", 620, 370, "#dce8ee", 13);
          }
        }
      ]
    },
    {
      id: "xeno", icon: "🐖", title: "基因编辑猪器官移植", sub: "异种移植 · 多基因编辑解决排异", color: "#91d0ae",
      source: "依据：西京医院猪肝移植（Nature 2025）· 猪肾移植存活超 200 天",
      steps: [
        {
          type: "tap", title: "供体猪：器官工厂", text: "选择健康的供体猪——猪器官大小与人类相近，是解决器官短缺的希望。点击供体猪。", meaning: "供需缺口：全球供体器官仅能满足约 10% 的移植需求。",
          hotspots: [[500, 310, 110]], draw(c, t) {
            pig(c, 500, 280, 1.5, true);
            lbl(c, "供体猪", 500, 150, "#a9dcc0", 13);
            lbl(c, "全球每年数十万人等待器官移植", 500, 430, "#7d929f", 12);
            hotspot(c, 500, 310, 100, t, "点击供体猪");
          }
        },
        {
          type: "tap", title: "编辑①：敲除猪内源病毒基因", text: "敲除猪基因组中的内源逆转录病毒（PERV），消除跨物种传播风险。点击细胞完成第一刀。", meaning: "PERV：猪细胞天然携带的病毒序列，移植后可能感染人类细胞。",
          hotspots: [[500, 300, 70]], draw(c, t) {
            circle(c, 500, 300, 95, "#c9d6dd", "rgba(255,255,255,.28)", 2); circle(c, 500, 300, 40, "#35536b");
            dnaMini(c, 500, 300, 140, t);
            scissors(c, 560, 240, 1.1, -.6);
            pill(c, 500, 430, "① PERV 敲除 ✓", "#9bc7e8");
            hotspot(c, 500, 300, 65, t, "点击编辑");
          }
        },
        {
          type: "tap", title: "编辑②：敲除猪抗原基因", text: "敲除引起超急性排斥的猪抗原基因（α-Gal 等），让人体免疫系统认不出「异己」。", meaning: "超急性排斥：数分钟内摧毁移植物，是异种移植第一道难关。",
          hotspots: [[500, 300, 70]], draw(c, t) {
            circle(c, 500, 300, 95, "#c9d6dd", "rgba(255,255,255,.28)", 2); circle(c, 500, 300, 40, "#35536b");
            dnaMini(c, 500, 300, 140, t);
            scissors(c, 560, 240, 1.1, -.6);
            pill(c, 460, 415, "① PERV 敲除 ✓", "#9bc7e8"); pill(c, 545, 430, "② 抗原敲除 ✓", "#9bc7e8");
            hotspot(c, 500, 300, 65, t, "点击编辑");
          }
        },
        {
          type: "tap", title: "编辑③：敲入人源调节基因", text: "敲入人源补体调节基因，进一步抑制免疫攻击——编辑后的细胞成为「人源化」猪器官的种子。", meaning: "多基因编辑：通常同时编辑数十个位点。",
          hotspots: [[500, 300, 70]], draw(c, t) {
            circle(c, 500, 300, 95, "#c9d6dd", "rgba(255,255,255,.28)", 2); circle(c, 500, 300, 40, "#35536b");
            dnaMini(c, 500, 300, 140, t);
            scissors(c, 560, 240, 1.1, -.6);
            pill(c, 440, 410, "① PERV ✓", "#9bc7e8"); pill(c, 530, 410, "② 抗原 ✓", "#9bc7e8"); pill(c, 470, 435, "③ 人源基因 ✓", "#a9dcc0");
            hotspot(c, 500, 300, 65, t, "点击编辑");
          }
        },
        {
          type: "auto", duration: 3600, title: "核移植 → 克隆猪培育", text: "把编辑后细胞的核移入去核卵母细胞，培育胚胎并移植给代孕母猪，生出携带目标基因编辑的仔猪。", meaning: "体细胞核移植：与「多莉羊」同源的技术路线。",
          draw(c, t, p) {
            circle(c, 500, 300, 60, "rgba(217,160,184,.3)", "rgba(217,160,184,.6)", 2);
            stemCell(c, 500, 300, 30);
            if (p > .35) {
              const a = Math.min(1, (p - .35) / .35);
              circle(c, 640, 280, 52 * a, "rgba(201,214,221,.3)", "rgba(201,214,221,.6)", 2);
              lbl(c, "去核卵母细胞", 640, 200, "#b9cbd6", 10);
            }
            if (p > .7) {
              const a = Math.min(1, (p - .7) / .3);
              pig(c, 800, 310, .62 * a, true);
              lbl(c, "克隆仔猪", 800, 430, "#a9dcc0", 11);
            }
            lbl(c, "体细胞核移植 · 胚胎发育", 420, 150, "#e8cfa4", 13);
            lbl(c, Math.floor(p * 100) + "%", 420, 430, "#7d929f", 11);
          }
        },
        {
          type: "tap", title: "移植给等待器官的患者", text: "把猪肾/猪肝移植给终末期患者：手术团队建立血流后，器官开始工作。点击器官完成移植。", meaning: "免疫抑制方案配合：多基因编辑 + 药物双保险。",
          hotspots: [[500, 300, 75]], draw(c, t) {
            lbl(c, "终末期患者", 300, 150, "#9dd6dc", 12);
            c.save(); c.strokeStyle = "#7fd0c0"; c.lineWidth = 4;
            c.beginPath(); c.ellipse(500, 300, 52, 36, .2, 0, TAU); c.stroke(); c.restore();
            circle(c, 500, 300, 22, "rgba(145,208,174,.35)", "rgba(145,208,174,.8)", 2);
            lbl(c, "基因编辑猪肾", 500, 380, "#a9dcc0", 12);
            hotspot(c, 500, 300, 70, t, "点击移植");
          }
        },
        {
          type: "final", title: "器官正常工作", text: "移植后器官持续工作：亚洲首例猪肾移植患者存活超 200 天、肾功能稳定；世界首例猪肝移植研究发表于 Nature。", meaning: "应用意义：异种移植或将成为终结器官短缺的工程方案。",
          draw(c, t) {
            c.save(); c.strokeStyle = "rgba(145,208,174,.7)"; c.lineWidth = 3;
            c.beginPath(); c.moveTo(280, 380); c.lineTo(330, 330); c.lineTo(400, 350); c.stroke(); c.restore();
            circle(c, 330, 330, 7, "#a9dcc0"); circle(c, 400, 350, 7, "#a9dcc0");
            rr(c, 260, 150, 240, 120, 12, "rgba(145,208,174,.07)", "rgba(145,208,174,.4)");
            lbl(c, "存活 200 天+", 380, 190, "#dce8ee", 15);
            lbl(c, "血肌酐术后 3 天恢复正常", 380, 235, "#a9dcc0", 11);
            rr(c, 560, 150, 280, 120, 12, "rgba(183,162,228,.07)", "rgba(183,162,228,.4)");
            lbl(c, "Nature 2025", 700, 190, "#dce8ee", 15);
            lbl(c, "世界首例猪肝移植研究发表", 700, 235, "#c9b8ea", 11);
          }
        }
      ]
    },
    {
      id: "protein", icon: "🧬", title: "AI 蛋白质工厂", sub: "AlphaFold2 设计 · 细胞工厂量产", color: "#7fc9d5",
      source: "依据：2024 诺贝尔化学奖 · 合成生物学产业化",
      steps: [
        {
          type: "tap", title: "输入：氨基酸序列", text: "一切从一段氨基酸序列开始。点击序列，把它交给 AI。", meaning: "序列决定结构、结构决定功能——蛋白质的折叠规则。",
          hotspots: [[500, 300, 90]], draw(c, t) {
            rr(c, 300, 270, 400, 60, 10, "rgba(127,201,213,.07)", "rgba(127,201,213,.45)");
            lbl(c, "M K T A I L V Y S G …", 500, 302, "#bcdcf2", 17);
            lbl(c, "氨基酸序列", 500, 230, "#9dd6dc", 12);
            hotspot(c, 500, 300, 80, t, "点击交给 AI");
          }
        },
        {
          type: "auto", duration: 3400, title: "AI 预测三维结构", text: "AlphaFold2 在数分钟内预测出蛋白质的三维折叠——从一维序列到三维结构。", meaning: "2024 年诺贝尔化学奖：破解蛋白质结构的 50 年难题。",
          draw(c, t, p) {
            const pts = [];
            for (let i = 0; i < 40; i++) {
              const u = i / 39, wob = Math.sin(i * .9 + t / 600);
              const ex = 250 + u * 500, ey = 300 + wob * 80;
              const fx = 500 + Math.cos(i * 1.7) * (90 - p * 62), fy = 300 + Math.sin(i * 1.7) * (90 - p * 62);
              pts.push({ x: ex + (fx - ex) * p, y: ey + (fy - ey) * p });
            }
            c.save(); c.strokeStyle = "rgba(127,201,213,.85)"; c.lineWidth = 5; c.lineJoin = "round";
            c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.stroke();
            c.strokeStyle = "rgba(183,162,228,.7)"; c.lineWidth = 2;
            for (let i = 0; i < 38; i += 4) { c.beginPath(); c.moveTo(pts[i].x, pts[i].y); c.lineTo(pts[i + 4].x, pts[i + 4].y); c.stroke(); }
            c.restore();
            if (p < .5) lbl(c, "预测折叠中…", 500, 470, "#9dd6dc", 12);
            else lbl(c, "三维结构预测完成", 500, 470, "#a9dcc0", 12);
            pill(c, 500, 180, p < .5 ? "AlphaFold2 计算中" : "AlphaFold2 · 结构预测 ✓", "#9dd6dc");
          }
        },
        {
          type: "tap", title: "设计改造：活性位点", text: "基于预测结构，圈出活性位点并做定向改造——设计更强的酶或全新的蛋白药物。点击活性口袋。", meaning: "蛋白质设计：可以设计自然界不存在的全新蛋白。",
          hotspots: [[500, 300, 60]], draw(c, t) {
            for (let i = 0; i < 40; i++) {
              const a = i * 1.7;
              circle(c, 500 + Math.cos(a) * 62, 300 + Math.sin(a) * 62, 6, "rgba(127,201,213,.5)");
            }
            const pulse = 1 + .15 * Math.sin(t / 200);
            circle(c, 500, 300, 24 * pulse, "rgba(232,184,117,.15)", "rgba(232,184,117,.8)", 3);
            lbl(c, "活性位点 · 定向改造", 500, 420, "#e8cfa4", 12);
            pill(c, 500, 180, "折叠结构 + 设计改造", "#9dd6dc");
            hotspot(c, 500, 300, 55, t, "点击改造");
          }
        },
        {
          type: "tap", title: "合成基因 · 转入工程菌", text: "把设计好的蛋白序列反译为 DNA，合成基因并转入大肠杆菌/酵母——细胞成为「活的工厂」。点击细菌。", meaning: "合成生物学：微生物发酵替代传统提取与化学合成。",
          hotspots: [[500, 310, 75]], draw(c, t) {
            c.save(); c.strokeStyle = "#a9c8d2"; c.lineWidth = 4;
            c.beginPath(); c.ellipse(500, 300, 105, 52, 0, 0, TAU); c.stroke();
            c.strokeStyle = "rgba(232,184,117,.7)"; c.lineWidth = 2;
            c.beginPath(); c.arc(560, 270, 26, 0, TAU); c.stroke(); c.restore();
            lbl(c, "工程菌 · 携带目的基因", 500, 420, "#e8cfa4", 12);
            pill(c, 500, 180, "基因合成 + 转化", "#9dd6dc");
            hotspot(c, 500, 310, 70, t, "点击转入");
          }
        },
        {
          type: "auto", duration: 3200, title: "发酵罐放大生产", text: "工程菌在大型发酵罐中扩增，目标蛋白被大量合成——从实验室到工业规模。", meaning: "应用：胰岛素、抗体片段、工业酶均可用此路径量产。",
          draw(c, t, p) {
            rr(c, 380, 120, 240, 330, 20, "rgba(127,201,213,.08)", "rgba(127,201,213,.5)");
            const level = 120 + 330 * (1 - p);
            rr(c, 382, level, 236, 120 + 330 - level, 18, "rgba(127,201,213,.18)");
            for (let i = 0; i < 10; i++) {
              const bx = 400 + ((i * 67 + t / 30) % 200), by = 460 - (i * 23) % 300;
              if (by > level) circle(c, bx, by, 4 + (i % 3) * 2, "rgba(190,230,240,.5)");
            }
            lbl(c, "发酵罐 · 放大生产", 500, 95, "#9dd6dc", 13);
            lbl(c, Math.floor(p * 100) + "%", 500, 480, "#7d929f", 11);
          }
        },
        {
          type: "final", title: "蛋白产品下线", text: "纯化后的目标蛋白成为药物或工业产品——AI 设计 + 基因编辑 + 细胞工厂，构成完整的蛋白质工程链条。", meaning: "应用意义：更快的药物研发、更绿色的生物制造。",
          draw(c, t) {
            for (let i = 0; i < 3; i++) {
              rr(c, 300 + i * 150, 230, 80, 140, 10, "rgba(145,208,174,.08)", "rgba(145,208,174,.5)");
              lbl(c, ["胰岛素", "抗体药物", "工业酶"][i], 340 + i * 150, 300, "#dce8ee", 12);
            }
            pill(c, 500, 150, "AI 蛋白质工厂 · 全链条 ✓", "#9dd6dc");
            lbl(c, "2024 诺奖：蛋白质设计 + 结构预测", 500, 430, "#c9b8ea", 12);
          }
        }
      ]
    },
    {
      id: "prrs", icon: "🐷", title: "抗蓝耳病基因编辑猪", sub: "CD163 编辑 · 疫病防控新防线", color: "#e8b875",
      source: "依据：FDA 2025.4 批准 · 加拿大 2026.1 批准 · 中国推进安全评价",
      steps: [
        {
          type: "tap", title: "难题：蓝耳病暴发", text: "猪繁殖与呼吸综合征（PRRS）导致母猪流产、仔猪死亡，是养猪业损失最大的疫病之一。点击患病猪群。", meaning: "背景：蓝耳病每年给全球养猪业造成数十亿美元损失。",
          hotspots: [[500, 310, 140]], draw(c, t) {
            pig(c, 380, 300, 1.1, false); pig(c, 540, 330, 1, false); pig(c, 660, 290, 1.05, false);
            lbl(c, "蓝耳病暴发 · 猪群患病", 500, 160, "#f0b49a", 13);
            hotspot(c, 500, 310, 130, t, "点击猪群");
          }
        },
        {
          type: "tap", title: "实验室：编辑 CD163 基因", text: "在受精卵中编辑 CD163 基因——它是蓝耳病毒进入细胞的「门锁」。点击剪刀完成编辑。", meaning: "原理：病毒通过 CD163 受体入侵猪的免疫细胞，敲掉它病毒就进不来。",
          hotspots: [[540, 300, 65]], draw(c, t) {
            circle(c, 420, 300, 90, "rgba(217,160,184,.25)", "rgba(217,160,184,.55)", 2);
            dnaMini(c, 420, 300, 130, t);
            scissors(c, 545, 300, 1.3, Math.sin(t / 500) * .12);
            pill(c, 420, 420, "CD163 受体基因", "#e8cfa4");
            lbl(c, "编辑受精卵基因组", 500, 170, "#e8cfa4", 13);
            hotspot(c, 540, 300, 58, t, "点击编辑");
          }
        },
        {
          type: "auto", duration: 3400, title: "胚胎移植 · 仔猪出生", text: "编辑后的胚胎移入代孕母猪，出生的仔猪携带抗病基因。", meaning: "胚胎工程：基因编辑与辅助生殖技术的结合。",
          draw(c, t, p) {
            circle(c, 420, 300, 55, "rgba(217,160,184,.3)", "rgba(217,160,184,.6)", 2);
            stemCell(c, 420, 300, 28);
            if (p > .5) {
              const a = Math.min(1, (p - .5) / .5);
              pig(c, 640, 310, 1.15 * a, true);
              lbl(c, "代孕母猪", 640, 430, "#a9dcc0", 11);
            }
            lbl(c, "胚胎移植 → 代孕 → 出生", 420, 165, "#e8cfa4", 13);
            lbl(c, Math.floor(p * 100) + "%", 420, 430, "#7d929f", 11);
          }
        },
        {
          type: "tap", title: "验证：病毒进不来了", text: "用蓝耳病毒攻毒试验验证：抗病猪的细胞没有 CD163「门锁」，病毒颗粒被拒之门外。点击病毒试试。", meaning: "效果：基因编辑猪对 PRRS 病毒表现出稳定抗性。",
          hotspots: [[540, 260, 55]], draw(c, t) {
            pig(c, 430, 320, 1.35, true);
            virus(c, 545, 255, 16, t); virus(c, 585, 225, 12, t + 900);
            c.save(); c.strokeStyle = "rgba(232,184,117,.85)"; c.lineWidth = 3; c.setLineDash([5, 5]);
            c.beginPath(); c.moveTo(500, 300); c.lineTo(545, 265); c.moveTo(500, 310); c.lineTo(585, 235); c.stroke(); c.setLineDash([]);
            c.strokeStyle = "rgba(239,129,121,.9)"; c.lineWidth = 3;
            c.beginPath(); c.moveTo(528, 288); c.lineTo(545, 271); c.moveTo(528, 298); c.lineTo(545, 281); c.stroke(); c.restore();
            lbl(c, "CD163 缺失：病毒无法进入细胞", 500, 160, "#f0d29c", 13);
            hotspot(c, 540, 260, 50, t, "点击病毒");
          }
        },
        {
          type: "final", title: "抗病猪走向产业", text: "抗蓝耳病基因编辑猪获美国 FDA 批准（2025）、加拿大批准（2026），中国正在推进安全评价试验——疫病防控与动物福利的新防线。", meaning: "应用意义：减少兽药使用、降低养殖损失，基因编辑从实验室走向农场。",
          draw(c, t) {
            pig(c, 300, 300, 1.4, true); pig(c, 500, 330, 1.2, true); pig(c, 670, 290, 1.3, true);
            pill(c, 300, 160, "健康猪群 · 无需疫苗", "#a9dcc0");
            rr(c, 620, 430, 260, 70, 12, "rgba(232,184,117,.08)", "rgba(232,184,117,.5)");
            lbl(c, "FDA 2025 批准 · 多国放行", 750, 465, "#e8cfa4", 12);
          }
        }
      ]
    }
  ];

  /* ─────────────── 引擎 ─────────────── */
  function cur() { return SCENARIOS[state.scenario]; }
  function curStep() { return cur().steps[state.step]; }

  function renderPicker() {
    const box = $("#scenePicker");
    box.innerHTML = "";
    SCENARIOS.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "scene-chip" + (i === state.scenario ? " active" : "");
      b.innerHTML = '<span class="sc-icon" style="background:' + s.color + '22">' + s.icon + '</span><span><b>' + s.title + '</b><small>' + s.sub + '</small></span>';
      b.addEventListener("click", () => {
        state.scenario = i; state.step = 0; state.phase = 0; state.playing = false; state.advanceAt = 0;
        renderPicker(); renderStepUI(); updatePlayBtn();
      });
      box.append(b);
    });
  }
  function renderStepUI() {
    const sc = cur(), st = curStep();
    $("#sceneTitle").textContent = sc.title;
    $("#sceneKicker").textContent = "场景 " + String(state.scenario + 1).padStart(2, "0") + " / " + String(SCENARIOS.length).padStart(2, "0") + " · " + sc.sub;
    $("#sceneSource").textContent = sc.source || "";
    const dots = $("#sceneDots");
    dots.innerHTML = "";
    sc.steps.forEach((s, i) => {
      const d = document.createElement("i");
      d.className = i < state.step ? "done" : i === state.step ? "now" : "";
      d.title = s.title;
      d.addEventListener("click", () => { state.playing = false; updatePlayBtn(); state.step = i; state.phase = 0; state.advanceAt = 0; renderStepUI(); });
      dots.append(d);
    });
    $("#stepIndex").textContent = "第 " + (state.step + 1) + " / " + sc.steps.length + " 步";
    $("#stepTitle").textContent = st.title;
    $("#stepText").textContent = st.text;
    $("#stepMeaning").textContent = st.meaning || "";
    $("#sceneHint").textContent = st.type === "tap" ? "点击发光目标，推进步骤" : st.type === "auto" ? "自动演示中…" : "场景完成 ✓ 点击 ▶ 可重新播放";
  }
  function updatePlayBtn() {
    const b = $("#btnPlay");
    b.textContent = state.playing ? "⏹ 停止" : "▶ 自动播放";
    b.classList.toggle("playing", state.playing);
  }
  function advance() {
    state.advanceAt = 0;
    if (state.step + 1 < cur().steps.length) {
      state.step++; state.phase = 0; state.flash = 1;
      renderStepUI();
    } else {
      state.playing = false; updatePlayBtn();
      $("#sceneHint").textContent = "场景完成 ✓ 点击 ▶ 可重新播放";
      renderStepUI();
      if (qAuto.get("auto") === "1" && !routeNav) {
        routeNav = true;
        setTimeout(() => showToast("答辩路线完成 🎉 感谢观看"), 3000);
        setTimeout(() => { location.href = "index.html"; }, 8000);
      }
    }
  }

  function loop(t) {
    if (!resize()) { requestAnimationFrame(loop); return; }
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(500, 280, 20, 500, 280, 560);
    g.addColorStop(0, "rgba(36,70,86,.42)"); g.addColorStop(.56, "rgba(16,34,48,.18)"); g.addColorStop(1, "rgba(4,12,20,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    state.hits = [];
    curStep().draw(ctx, t, state.phase);
    if (state.flash > 0) { ctx.fillStyle = "rgba(145,208,174," + (state.flash * .32) + ")"; ctx.fillRect(0, 0, W, H); state.flash -= .05; }
    const dt = Math.min(60, t - (state.lastT || t)); state.lastT = t;
    const st = curStep();
    if (st.type === "auto") {
      if (state.phase < 1) {
        state.phase = Math.min(1, state.phase + dt / (st.duration || 3000));
        if (state.phase >= 1 && state.playing) advance();
      }
    } else if (state.playing && st.type !== "final") {
      if (!state.advanceAt) state.advanceAt = t + 1900;
      if (t >= state.advanceAt) advance();
    }
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
    const st = curStep();
    if (st && st.type === "tap") {
      const h = [...state.hits].reverse().find(h => Math.hypot(x - h.x, y - h.y) <= h.r);
      if (h) { state.flash = 1; advance(); }
    }
  });

  $("#btnPrev").addEventListener("click", () => { state.playing = false; updatePlayBtn(); state.step = Math.max(0, state.step - 1); state.phase = 0; state.advanceAt = 0; renderStepUI(); });
  $("#btnNext").addEventListener("click", () => { state.playing = false; updatePlayBtn(); advance(); });
  $("#btnPlay").addEventListener("click", () => {
    state.playing = !state.playing;
    state.advanceAt = 0;
    if (state.playing && state.step >= cur().steps.length - 1) { state.step = 0; state.phase = 0; }
    updatePlayBtn(); renderStepUI();
  });

  /* ─────────────── 底部导航 ─────────────── */
  $("#bottomNav").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.toggle("active", p.id === btn.dataset.tab));
    document.querySelectorAll("#bottomNav button").forEach(b => b.classList.toggle("active", b === btn));
  });

  /* ─────────────── 应用速览（17 卡片） ─────────────── */
  const CARDS = [
    { cat: "medical", badge: "已获批", bc: "b-ok", year: "2023–2024", org: "Vertex × CRISPR Therapeutics", title: "Casgevy", tags: ["体外编辑", "血液病"], text: "编辑患者造血干细胞、重新激活胎儿血红蛋白 HbF，治疗镰刀型细胞贫血与 β 地中海贫血——全球首款获批的 CRISPR 疗法。" },
    { cat: "medical", badge: "临床 III 期", bc: "b-iii", year: "2025", org: "Intellia", title: "NTLA-2002", tags: ["体内编辑", "罕见病"], text: "脂质纳米颗粒把 Cas9 直接送入体内，敲低激肽释放酶，治疗遗传性血管性水肿；2025 年 1 月全球 III 期启动。" },
    { cat: "medical", badge: "临床 III 期", bc: "b-iii", year: "2025", org: "Intellia", title: "nex-z", tags: ["体内编辑", "淀粉样变性"], text: "体内编辑 TTR 基因，治疗转甲状腺素蛋白淀粉样变性（ATTR），注册性 III 期研究推进中。" },
    { cat: "medical", badge: "临床 I/II 期", bc: "b-ii", year: "2023–2024", org: "锐正基因", title: "ART001", tags: ["体内编辑", "国产突破"], text: "中国首个进入人体的体内基因编辑药物（治疗 ATTR），2024 年 8 月成为首个获美国 FDA 临床试验许可的中国同类产品。" },
    { cat: "medical", badge: "临床 I/II 期", bc: "b-ii", year: "2024", org: "Beam Therapeutics", title: "BEAM-101", tags: ["碱基编辑", "血液病"], text: "碱基编辑器在造血干细胞中做 A→G 单碱基替换、激活 HbF 治疗镰刀型贫血；2024 年公布的全部 7 例患者 HbF 均升至 60% 以上。" },
    { cat: "medical", badge: "临床 I 期", bc: "b-i", year: "2026", org: "Lilly", title: "VERVE-102", tags: ["碱基编辑", "心血管"], text: "一次性体内碱基编辑关闭肝脏 PCSK9：单次输注后 LDL-C 最多降低 62%、维持 18 个月，计划年内进入 II 期。" },
    { cat: "medical", badge: "临床 I/II 期", bc: "b-ii", year: "2025", org: "Prime Medicine", title: "PM359", tags: ["先导编辑", "免疫缺陷"], text: "先导编辑首次进入人体：单次输注修复慢性肉芽肿病的致病突变，首例患者 30 天内中性粒细胞功能恢复 66%。" },
    { cat: "cell", badge: "前沿临床", bc: "b-new", year: "2024–2025", org: "西京医院 等", title: "基因编辑猪器官移植", tags: ["异种移植", "器官短缺"], text: "多基因编辑猪的肝、肾移植给人体：世界首例猪肝移植（Nature 2025 发表）、亚洲首例猪肾移植活人存活超 200 天。" },
    { cat: "cell", badge: "前沿研究", bc: "b-new", year: "2025", org: "北大魏文胜团队 等", title: "通用型「现货」CAR-T", tags: ["细胞治疗", "癌症免疫"], text: "CRISPR 改造健康供体 T 细胞（糖盾护体策略），做出可量产、可即用的现货细胞药；早期临床中细胞在体内持续超过 6 个月。" },
    { cat: "protein", badge: "诺奖级平台", bc: "b-ok", year: "2024", org: "Baker / DeepMind", title: "AI 蛋白质设计", tags: ["蛋白质工程", "AI"], text: "2024 年诺贝尔化学奖：蛋白质设计 + AlphaFold2 结构预测——可设计全新酶、疫苗与蛋白药物。" },
    { cat: "protein", badge: "已产业化", bc: "b-ok", year: "2010s–今", org: "产业界", title: "细胞工厂 · 合成生物学", tags: ["生物制造", "药物生产"], text: "CRISPR 改良酵母、大肠杆菌等微生物，量产胰岛素前体、抗体片段与青蒿素前体——工程菌成为「活的工厂」。" },
    { cat: "protein", badge: "已产业化", bc: "b-ok", year: "2018 后", org: "产业界", title: "工业酶定向改造", tags: ["酶工程", "绿色制造"], text: "定向进化（2018 年诺奖）与 CRISPR 高通量筛选结合，改造洗涤剂、生物燃料与绿色化工所需的工业酶。" },
    { cat: "agri", badge: "获批推进", bc: "b-ok", year: "2024.12–", org: "农业农村部", title: "中国基因编辑作物", tags: ["粮食安全", "抗病优质"], text: "大豆、小麦、玉米、水稻等基因编辑作物陆续获得安全证书——不转入外源基因的精准育种进入快车道。" },
    { cat: "agri", badge: "已上市", bc: "b-ok", year: "2019–2021", org: "美国 / 日本", title: "编辑食品走上餐桌", tags: ["食品", "营养"], text: "高油酸大豆（全球首款基因编辑食品）、GABA 番茄、增肌真鲷、抗褐变马铃薯——全球已有 70 余种基因编辑农产品。" },
    { cat: "agri", badge: "已获批（美/加）", bc: "b-ok", year: "2025–2026", org: "Genus × PIC/首农", title: "抗蓝耳病猪", tags: ["动物育种", "疫病防控"], text: "编辑 CD163 基因使猪天然抵抗蓝耳病毒：2025 年美国 FDA 批准、2026 年加拿大批准，中国安全评价试验推进中。" },
    { cat: "ethics", badge: "伦理边界", bc: "b-warn", year: "2021–", org: "中国刑法修正案（十一）", title: "生殖系编辑的红线", tags: ["法规", "生殖伦理"], text: "非法植入基因编辑、克隆胚胎已入刑；全球共识：临床禁止对人类胚胎做可遗传的基因编辑。" },
    { cat: "ethics", badge: "争议前沿", bc: "b-warn", year: "研究中", org: "多国实验室", title: "基因驱动", tags: ["生态", "公共卫生"], text: "让编辑基因在种群中自我扩散，可压制蚊媒传播的疟疾；生态风险仍在评估，仅限严格封闭实验。" }
  ];
  let cardCat = "all";
  function renderCards() {
    const items = CARDS.filter(a => cardCat === "all" || a.cat === cardCat);
    $("#appsList").innerHTML = items.map(a =>
      '<article class="app-card"><div class="app-head"><span class="app-badge ' + a.bc + '">' + a.badge + '</span><span class="app-year">' + a.year + '</span></div><h3>' + a.title + '</h3><p class="app-org">' + a.org + '</p><p class="app-text">' + a.text + '</p><div class="app-tags">' + a.tags.map(t => "<i>" + t + "</i>").join("") + '</div></article>'
    ).join("");
  }
  $("#appsTabs").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    cardCat = btn.dataset.cat;
    document.querySelectorAll("#appsTabs button").forEach(b => b.classList.toggle("active", b === btn));
    renderCards();
  });

  /* ─────────────── 启动 ─────────────── */
  renderPicker();
  renderStepUI();
  updatePlayBtn();
  renderCards();
  // 答辩路线：?auto=1 自动播放第一个场景
  const qAuto = new URLSearchParams(location.search);
  let routeNav = false;
  if (qAuto.get("auto") === "1") {
    setTimeout(() => {
      state.scenario = 0; state.step = 0; state.phase = 0; state.playing = true;
      renderPicker(); renderStepUI(); updatePlayBtn();
      $("#sceneHint").textContent = "答辩路线 · 自动播放中…";
    }, 900);
  }
  window.addEventListener("resize", () => resize());
  requestAnimationFrame(loop);
})();
