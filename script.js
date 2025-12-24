const API_KEY = "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";
let currentData = [];

const POS_LIST = "N, JJ, VB, NUM, RR, P, C, II, Prt, MD, UH, IM, NER, IB, M";

const DEPREL_LIST = "nsubj, obj, obl, advmod, amod, nmod:poss, compound, conj, cc, mark, cop, aux, punct, root, acl, xcomp, discourse, advcl, advmod:emph, vocative, nummod";

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
  if (!text) return;

  document.getElementById("spinner").style.display = "block";
  document.getElementById("resultArea").style.display = "none";

  const prompt = `Siz o'zbek tili uchun Universal Dependencies (UD) tahlilchisiz.
  Gap: "${text}"
  
  QOIDALAR:
  1. Gapning markaziy fe'lini (predikatini) aniqlang va uni Head: 0, Deprel: root deb belgilang.
  2. POS teglarni faqat ushbu ro'yxatdan oling: ${POS_LIST}.
  3. Bog'lanishlarni (Deprel) faqat ushbu ro'yxatdan oling: ${DEPREL_LIST}.
  4. Lemma: so'zning lug'aviy shakli.
  5. Har safar bir xil gap uchun aynan bir xil tahlilni qaytaring.

  FORMAT: Faqat JSON qaytaring: [{"id":1, "token":"...", "lemma":"...", "pos":"...", "head":0, "deprel":"..."}]`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0, 
        seed: 42, 
        top_p: 0.1, 
        messages: [
          { role: "system", content: "You are a professional Uzbek linguist. You must follow UD 2.0 standards for Uzbek. Always assign 'root' to the main verb of the main clause." }, 
          { role: "user", content: prompt }
        ]
      })
    });

    const out = await res.json();
    const content = out.choices[0].message.content;
    const jsonMatch = content.match(/\[.*\]/s);
    
    if (!jsonMatch) throw new Error("JSON topilmadi");
    const parsed = JSON.parse(jsonMatch[0]);

    currentData = parsed.map(t => ({
      id: t.id,
      token: t.token,
      lemma: t.lemma || "-",
      tag: t.pos,
      head: parseInt(t.head),
      deprel: t.deprel
    }));

    renderUI();
  } catch (e) {
    console.error(e);
    alert("Xatolik: AI tahlilda adashdi. Qayta urinib ko'ring.");
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
  if (defs) svg.appendChild(defs);

  svg.setAttribute("width", box.scrollWidth);
  svg.setAttribute("height", 320);

  const style = getComputedStyle(document.body);
  const color = style.getPropertyValue("--primary").trim() || "#4338ca";
  const bgColor = style.getPropertyValue("--card").trim() || "#ffffff";

  currentData.forEach(i => {
    const n = document.getElementById(`node-${i.id}`);
    if (!n || i.head === 0) return;
    
    const p = document.getElementById(`node-${i.head}`);
    if (!p) return;

    const boxRect = box.getBoundingClientRect();
    const x1 = n.getBoundingClientRect().left + n.getBoundingClientRect().width / 2 - boxRect.left;
    const x2 = p.getBoundingClientRect().left + p.getBoundingClientRect().width / 2 - boxRect.left;
    const y = 180;
    const h = Math.min(Math.abs(x1 - x2) * 0.4, 140);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${x1} ${y} Q ${(x1 + x2) / 2} ${y - h} ${x2} ${y}`);
    path.setAttribute("stroke", color);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("marker-end", "url(#arrow)");
    svg.appendChild(path);

    const lbl = createSmartLabel((x1 + x2) / 2, y - (h / 2) - 10, i.deprel, color, bgColor);
    svg.appendChild(lbl.halo);
    svg.appendChild(lbl.main);
  });
}

function createSmartLabel(x, y, text, color, bg) {
  const main = document.createElementNS("http://www.w3.org/2000/svg", "text");
  main.setAttribute("x", x); main.setAttribute("y", y);
  main.setAttribute("text-anchor", "middle"); main.setAttribute("font-size", "11px");
  main.setAttribute("font-weight", "bold"); main.setAttribute("fill", color);
  main.textContent = text;
  const halo = main.cloneNode(true);
  halo.setAttribute("stroke", bg); halo.setAttribute("stroke-width", "5px");
  halo.style.paintOrder = "stroke";
  return { main, halo };
}

function drawLines() {
  const svg = document.getElementById("svg-canvas");
  const box = document.getElementById("visualBox");
  if (!svg || !box) return;

  const defs = svg.querySelector('defs');
  svg.innerHTML = '';
  if (defs) svg.appendChild(defs);

  svg.setAttribute("width", box.scrollWidth);
  svg.setAttribute("height", 320);

  const style = getComputedStyle(document.body);
  const color = style.getPropertyValue("--primary").trim() || "#4338ca";
  const bgColor = style.getPropertyValue("--card").trim() || "#ffffff";

  currentData.forEach(i => {
    const n = document.getElementById(`node-${i.id}`);
    if (!n) return;

    const boxRect = box.getBoundingClientRect();
    const x1 = n.getBoundingClientRect().left + n.getBoundingClientRect().width / 2 - boxRect.left;
    const y = 180;

    if (i.head === 0 || i.deprel === "root") {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${x1} 40 L ${x1} 145`);
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", "2");
      path.setAttribute("marker-end", "url(#arrow)");
      svg.appendChild(path);

      const lbl = createSmartLabel(x1, 35, "root", color, bgColor);
      svg.appendChild(lbl.halo);
      svg.appendChild(lbl.main);
      return; 
    }
    
    const p = document.getElementById(`node-${i.head}`);
    if (!p) return;

    const x2 = p.getBoundingClientRect().left + p.getBoundingClientRect().width / 2 - boxRect.left;
    const h = Math.min(Math.abs(x1 - x2) * 0.4, 140);

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${x1} ${y} Q ${(x1 + x2) / 2} ${y - h} ${x2} ${y}`);
    path.setAttribute("stroke", color);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("marker-end", "url(#arrow)");
    svg.appendChild(path);

    const lbl = createSmartLabel((x1 + x2) / 2, y - (h / 2) - 10, i.deprel, color, bgColor);
    svg.appendChild(lbl.halo);
    svg.appendChild(lbl.main);
  });
}
function downloadCSV() {
    if (!currentData.length) {
        alert("Avval gapni tahlil qiling!");
        return;
    }
    let csv = "\uFEFFID,Token,Lemma,Tag,Head,Deprel\n";
    currentData.forEach(r => {
        csv += `${r.id},"${r.token}","${r.lemma}","${r.tag}",${r.head},"${r.deprel}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "uzbek_syntax_analysis.csv";
    link.click();
}