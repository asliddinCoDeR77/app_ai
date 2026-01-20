const API_KEY = "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";
let currentData = [];

function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');
    const isDark = body.getAttribute('data-theme') === 'dark';
    body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    if (themeIcon) themeIcon.innerText = isDark ? '🌙' : '☀️';
    if (currentData.length) setTimeout(drawLines, 100);
}

async function analyzeAI() {
    const textInput = document.getElementById("inputText");
    const text = textInput ? textInput.value.trim() : "";
    
    if (!text) { alert("Matn kiriting!"); return; }

    document.getElementById("spinner").style.display = "block";
    document.getElementById("resultArea").style.display = "none";

    const rawTokens = text.match(/[\w'’‘]+|[.,!?;:]/g) || [];
    
    if (rawTokens.length === 0) {
        alert("So'zlar topilmadi.");
        document.getElementById("spinner").style.display = "none";
        return;
    }

    const tokenListString = rawTokens.map((t, i) => `${i + 1}. ${t}`).join("\n");

    const prompt = `Siz O'zbek tili sintaksisi mutaxassisisiz. 
Quyidagi so'zlar ro'yxatini tahlil qiling.

SO'ZLAR:
${tokenListString}

QAT'IY QOIDALAR VA RO'YXATLAR:

1. FQAT QUYIDAGI POS TAGLARDAN FOYDALANING (Boshqasi mumkin emas!):
   - N (Ot)
   - JJ (Sifat)
   - VB (Fe'l)
   - NUM (Son)
   - RR (Ravish)
   - P (Olmosh)
   - C (Bog'lovchi)
   - II (Ko'makchi)
   - Prt (Yuklama)
   - MD (Modal so'z)
   - UH (Undov so'z)
   - IM (Taqlid so'zlar)
   - NER (Atoqli otlar)
   - IB (Iboralar)
   - M (Maqollar)
   - PUNCT (Tinish belgisi)

2. FAQAT QUYIDAGI DEPREL (BOG'LANISH)LARDAN FOYDALANING:
   - root, nsubj, obj, obl, advmod, amod, nmod:poss, compound, conj, cc, mark, cop, aux, punct, acl, xcomp, discourse, advcl, advmod:emph, vocative, nummod.

3. SINTAKTIK QOIDALAR:
   - "head": 0 bo'lgan faqat BITTA "root" (VB yoki predikativ N) bo'lsin.
   - "nsubj" (ega) va "advmod" (ravish) bevosita rootga bog'lansin.
   - Tinish belgilari (PUNCT) o'zidan oldingi so'zga bog'lansin (punct).

JAVOB FORMATI (JSON array):
[{"id":1, "token":"...", "lemma":"...", "tag":"N", "head":2, "deprel":"nsubj"}]`;

    try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                temperature: 0,
                messages: [
                    { role: "system", content: "Faqat JSON array qaytar. Hech qanday tushuntirish yozma." },
                    { role: "user", content: prompt }
                ]
            })
        });

        if (!res.ok) throw new Error("Internet yoki API xatosi");
        
        const out = await res.json();
        const content = out.choices[0].message.content;
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        
        if (!jsonMatch) throw new Error("AI noto'g'ri format berdi");

        let parsed = JSON.parse(jsonMatch[0]);

        currentData = parsed.map((item, index) => {
            const realToken = rawTokens[index] || item.token;
            return {
                id: index + 1,
                token: realToken,
                lemma: item.lemma || realToken,
                tag: item.tag || item.pos || "N", 
                head: parseInt(item.head) || 0,
                deprel: item.deprel || "dep"
            };
        });

        fixGraphLogic();

        renderUI();

    } catch (e) {
        console.error(e);
        alert("Xatolik: " + e.message);
    } finally {
        document.getElementById("spinner").style.display = "none";
    }
}

function fixGraphLogic() {
    let root = currentData.find(t => t.head === 0);
    
    if (!root) {
        const verbs = currentData.filter(t => t.tag === "VB");
        root = verbs.length > 0 ? verbs[verbs.length - 1] : currentData[currentData.length - 1];
        root.head = 0;
        root.deprel = "root";
    }

    currentData.forEach(t => {
        if (t.id !== root.id && t.head === 0) {
            t.head = root.id;
            t.deprel = "conj";
        }
        
        if (t.head === t.id) t.head = root.id;


        if ((t.deprel === "nsubj" || t.tag === "RR") && t.head !== root.id && t.head !== 0) {
            const parent = currentData.find(p => p.id === t.head);
            if (parent && parent.tag !== "VB") {
                t.head = root.id;
            }
        }
    });
}

function renderUI() {
    document.getElementById("resultArea").style.display = "block";
    const tokensRow = document.getElementById("tokensRow");
    const tableBody = document.getElementById("tableBody");
    
    tokensRow.innerHTML = "";
    tableBody.innerHTML = "";

    currentData.forEach(t => {
        tokensRow.innerHTML += `
            <div class="token-item" id="node-${t.id}">
                <span class="tag-badge">${t.tag}</span>
                <span class="word-text">${t.token}</span>
            </div>
        `;

        tableBody.innerHTML += `
            <tr>
                <td>${t.id}</td>
                <td><b>${t.token}</b></td>
                <td>${t.lemma}</td>
                <td>${t.tag}</td>
                <td>${t.head}</td>
                <td style="font-weight:bold; color:var(--primary)">${t.deprel}</td>
            </tr>
        `;
    });

    setTimeout(drawLines, 200);
}

function drawLines() {
    const svg = document.getElementById("svg-canvas");
    const box = document.getElementById("visualBox");
    if (!svg || !box) return;

    const color = getComputedStyle(document.body).getPropertyValue("--primary").trim() || "#4338ca";
    svg.innerHTML = `
        <defs>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <path d="M0,0 L0,6 L9,3 z" fill="${color}" />
            </marker>
        </defs>
    `;
    
    svg.setAttribute("width", box.scrollWidth);
    svg.setAttribute("height", 300);

    const baseY = 180; 

    currentData.forEach(t => {
        const node = document.getElementById(`node-${t.id}`);
        if (!node) return;

        const boxRect = box.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        const x1 = (nodeRect.left - boxRect.left) + box.scrollLeft + (nodeRect.width / 2);

        if (t.head === 0) {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", `M ${x1} 40 L ${x1} ${baseY - 10}`);
            path.setAttribute("stroke", color);
            path.setAttribute("stroke-width", "2");
            path.setAttribute("marker-end", "url(#arrow)");
            svg.appendChild(path);

            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", x1);
            text.setAttribute("y", 30);
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("fill", color);
            text.setAttribute("font-weight", "bold");
            text.textContent = "ROOT";
            svg.appendChild(text);
        } else {
            const headNode = document.getElementById(`node-${t.head}`);
            if (headNode) {
                const headRect = headNode.getBoundingClientRect();
                const x2 = (headRect.left - boxRect.left) + box.scrollLeft + (headRect.width / 2);
                const dist = Math.abs(x1 - x2);
                const arcHeight = Math.min(dist * 0.4, 100) + 20;

                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("d", `M ${x2} ${baseY} Q ${(x1 + x2) / 2} ${baseY - arcHeight} ${x1} ${baseY}`);
                path.setAttribute("stroke", color);
                path.setAttribute("fill", "none");
                path.setAttribute("stroke-width", "2");
                path.setAttribute("marker-end", "url(#arrow)");
                svg.appendChild(path);

                const labelX = (x1 + x2) / 2;
                const labelY = baseY - (arcHeight / 2) - 10;
                
                const bg = document.createElementNS("http://www.w3.org/2000/svg", "text");
                bg.setAttribute("x", labelX);
                bg.setAttribute("y", labelY);
                bg.setAttribute("text-anchor", "middle");
                bg.setAttribute("stroke", getComputedStyle(document.body).getPropertyValue("--card") || "#fff");
                bg.setAttribute("stroke-width", "4");
                bg.textContent = t.deprel;
                svg.appendChild(bg);

                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", labelX);
                text.setAttribute("y", labelY);
                text.setAttribute("text-anchor", "middle");
                text.setAttribute("fill", color);
                text.setAttribute("font-size", "12px");
                text.setAttribute("font-weight", "bold");
                text.textContent = t.deprel;
                svg.appendChild(text);
            }
        }
    });
}

function downloadCSV() {
    if (!currentData.length) return alert("Ma'lumot yo'q!");
    let csv = "ID,Token,Lemma,Tag,Head,Deprel\n";
    currentData.forEach(r => {
        csv += `${r.id},${r.token},${r.lemma},${r.tag},${r.head},${r.deprel}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "tahlil.csv";
    link.click();

}


