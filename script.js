const API_KEY = "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";
let currentData = [];

const POS_LIST = "NOUN, VERB, ADJ, ADV, PRON, DET, ADP, NUM, CONJ, PART, AUX, INTJ, PROPN, PUNCT";

const DEPREL_LIST = "root, nsubj, obj, iobj, obl, advmod, amod, det, nummod, nmod, nmod:poss, compound, flat, aux, cop, mark, case, cc, conj, punct, acl, advcl, xcomp, ccomp, discourse, vocative, expl, dislocated, fixed";

function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');
    
    const isDark = body.getAttribute('data-theme') === 'dark';
    
    if (isDark) {
        body.setAttribute('data-theme', 'light');
        if (themeIcon) themeIcon.innerText = '🌙';
    } else {
        body.setAttribute('data-theme', 'dark');
        if (themeIcon) themeIcon.innerText = '☀️'; 
    }

    if (currentData && currentData.length > 0) {
        drawLines(); 
    }
}

async function analyzeAI() {
  const text = document.getElementById("inputText").value.trim();
  if (!text) {
    alert("Iltimos, tahlil qilish uchun gap kiriting!");
    return;
  }

  document.getElementById("spinner").style.display = "block";
  document.getElementById("resultArea").style.display = "none";

  const prompt = `Siz o'zbek tili uchun professional Universal Dependencies (UD 2.0) sintaktik tahlilchisiz.

TAHLIL QILINADIGAN GAP: "${text}"

O'ZBEK TILI QOIDALARI:
1. ASOSIY FE'L (PREDIKAT): Gapning asosiy fe'lini toping va uni Head: 0, Deprel: root qiling
2. EGALIK: Fe'lning egasini nsubj (subject) qiling
3. TO'LDIRUVCHI: To'g'ridan-to'g'ri to'ldiruvchini obj qiling
4. HOLI: Payt, joy, sabab hollari uchun obl ishlating
5. ANIQLOVCHI: Otni aniqlovchi sifatni amod qiling
6. QARATQICH SO'ZLARI: -ning, -ni, -da, -dan kabi qo'shimchalar uchun case ishlating
7. YORDAMCHI FE'LLAR: bo'lmoq, edi kabilar uchun cop/aux ishlating

POS TEGLARI (faqat shulardan foydalaning):
${POS_LIST}

DEPREL (bog'lanish turlari - faqat shulardan foydalaning):
${DEPREL_LIST}

MUHIM TALABLAR:
- Har bir so'z uchun to'g'ri lemma (lug'aviy shakl) bering
- Head raqami mavjud token ID bo'lishi kerak
- Root atigi bitta bo'lishi kerak
- Barcha so'zlar bitta daraxt tuzilishida bog'langan bo'lsin
- Har safar bir xil gap uchun aynan bir xil tahlil bering

JAVOB FORMATI:
Faqat JSON array qaytaring, boshqa hech narsa yo'q:
[
  {"id": 1, "token": "so'z", "lemma": "lug'aviy_shakl", "pos": "POS_TEG", "head": 0_yoki_boshqa_id, "deprel": "bog'lanish_turi"},
  ...
]`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${API_KEY}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0,
        seed: 42,
        top_p: 0.1,
        messages: [
          { 
            role: "system", 
            content: "Siz professional o'zbek tili sintaksisi mutaxassisisiz. Universal Dependencies (UD 2.0) standartiga to'liq rioya qilasiz. O'zbek tilining grammatik xususiyatlarini yaxshi bilasiz: qo'shimchali til, SOV tartib, kelishiklar tizimi." 
          },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!res.ok) {
      throw new Error(`API xatosi: ${res.status}`);
    }

    const out = await res.json();
    const content = out.choices[0].message.content;
    
    let jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      jsonMatch = [content.trim()];
    }
    
    const parsed = JSON.parse(jsonMatch[0]);

    currentData = parsed.map(t => ({
      id: parseInt(t.id),
      token: t.token,
      lemma: t.lemma || t.token,
      tag: t.pos || "NOUN",
      head: parseInt(t.head),
      deprel: t.deprel || "dep"
    }));

    const hasRoot = currentData.some(t => t.head === 0);
    if (!hasRoot && currentData.length > 0) {
      const verbIndex = currentData.findIndex(t => t.tag === "VERB");
      if (verbIndex !== -1) {
        currentData[verbIndex].head = 0;
        currentData[verbIndex].deprel = "root";
      } else {
        currentData[0].head = 0;
        currentData[0].deprel = "root";
      }
    }

    renderUI();
  } catch (e) {
    console.error("Xatolik:", e);
    alert("Xatolik yuz berdi: " + e.message + "\n\nIltimos, qaytadan urinib ko'ring.");
  } finally {
    document.getElementById("spinner").style.display = "none";
  }
}

function renderUI() {
  document.getElementById("resultArea").style.display = "block";
  const tokensRow = document.getElementById("tokensRow");
  const tableBody = document.getElementById("tableBody");
  
  tokensRow.innerHTML = "";
  tableBody.innerHTML = "";

  currentData.forEach(i => {
    tokensRow.innerHTML += `
      <div class="token-item" id="node-${i.id}">
        <span class="tag-badge">${i.tag}</span>
        <span class="word-text">${i.token}</span>
      </div>`;

    tableBody.innerHTML += `
      <tr>
        <td>${i.id}</td>
        <td><b>${i.token}</b></td>
        <td>${i.lemma}</td>
        <td>${i.tag}</td>
        <td>${i.head}</td>
        <td style="font-weight:bold; color:#4338ca">${i.deprel}</td>
      </tr>`;
  });
  
  setTimeout(drawLines, 300);
}

function drawLines() {
  const svg = document.getElementById("svg-canvas");
  const box = document.getElementById("visualBox");
  if (!svg || !box) return;

  const defs = svg.querySelector('defs');
  svg.innerHTML = '';
  if (defs) {
    svg.appendChild(defs);
  } else {
    const newDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "arrow");
    marker.setAttribute("markerWidth", "10");
    marker.setAttribute("markerHeight", "10");
    marker.setAttribute("refX", "9");
    marker.setAttribute("refY", "3");
    marker.setAttribute("orient", "auto");
    marker.setAttribute("markerUnits", "strokeWidth");
    
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M0,0 L0,6 L9,3 z");
    path.setAttribute("fill", getComputedStyle(document.body).getPropertyValue("--primary").trim() || "#4338ca");
    
    marker.appendChild(path);
    newDefs.appendChild(marker);
    svg.appendChild(newDefs);
  }

  svg.setAttribute("width", box.scrollWidth);
  svg.setAttribute("height", 320);

  const style = getComputedStyle(document.body);
  const color = style.getPropertyValue("--primary").trim() || "#4338ca";
  const bgColor = style.getPropertyValue("--card").trim() || "#ffffff";

  currentData.forEach(i => {
    const n = document.getElementById(`node-${i.id}`);
    if (!n) return;

    const boxRect = box.getBoundingClientRect();
    const x1 = n.getBoundingClientRect().left + n.getBoundingClientRect().width / 2 - boxRect.left + box.scrollLeft;
    const y = 180;

    if (i.head === 0) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${x1} 40 L ${x1} 145`);
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", "2");
      path.setAttribute("marker-end", "url(#arrow)");
      svg.appendChild(path);

      const lbl = createSmartLabel(x1, 30, "root", color, bgColor);
      svg.appendChild(lbl.halo);
      svg.appendChild(lbl.main);
      return;
    }
    
    const p = document.getElementById(`node-${i.head}`);
    if (!p) return;

    const x2 = p.getBoundingClientRect().left + p.getBoundingClientRect().width / 2 - boxRect.left + box.scrollLeft;
    const distance = Math.abs(x1 - x2);
    const h = Math.min(distance * 0.5, 120);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    
    path.setAttribute("d", `M ${x2} ${y} Q ${(x1 + x2) / 2} ${y - h} ${x1} ${y}`);
    path.setAttribute("stroke", color);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("marker-end", "url(#arrow)");
    svg.appendChild(path);

    const lbl = createSmartLabel((x1 + x2) / 2, y - (h / 2) - 12, i.deprel, color, bgColor);
    svg.appendChild(lbl.halo);
    svg.appendChild(lbl.main);
  });
}

function createSmartLabel(x, y, text, color, bg) {
  const main = document.createElementNS("http://www.w3.org/2000/svg", "text");
  main.setAttribute("x", x);
  main.setAttribute("y", y);
  main.setAttribute("text-anchor", "middle");
  main.setAttribute("font-size", "12px");
  main.setAttribute("font-weight", "bold");
  main.setAttribute("fill", color);
  main.textContent = text;
  
  const halo = main.cloneNode(true);
  halo.setAttribute("stroke", bg);
  halo.setAttribute("stroke-width", "4px");
  halo.setAttribute("fill", color);
  halo.style.paintOrder = "stroke";
  
  return { main, halo };
}

function downloadCSV() {
    if (!currentData.length) {
        alert("Avval gapni tahlil qiling!");
        return;
    }
    
    let csv = "\uFEFFID,Token,Lemma,POS,Head,Deprel\n";
    currentData.forEach(r => {
        csv += `${r.id},"${r.token}","${r.lemma}","${r.tag}",${r.head},"${r.deprel}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "uzbek_syntax_analysis.csv";
    link.click();
}