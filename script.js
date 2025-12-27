const API_KEY = "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";
let currentData = [];

// --- THEME ---
function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');
    const isDark = body.getAttribute('data-theme') === 'dark';
    body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    if (themeIcon) themeIcon.innerText = isDark ? '🌙' : '☀️';
    if (currentData.length) setTimeout(drawLines, 100);
}

// --- 1. ASOSIY TAHLIL FUNKSIYASI ---
async function analyzeAI() {
    const textInput = document.getElementById("inputText");
    const text = textInput ? textInput.value.trim() : "";
    
    if (!text) { alert("Matn kiriting!"); return; }

    // EKRANNI TOZALASH
    document.getElementById("spinner").style.display = "block";
    document.getElementById("resultArea").style.display = "none";

    // 1-QADAM: JavaScript so'zlarni o'zi ajratadi (AI ga ishonmaymiz)
    // Bu yerda so'zlar va tinish belgilarni ajratamiz
    const rawTokens = text.match(/[\w'’‘]+|[.,!?;:]/g) || [];
    
    if (rawTokens.length === 0) {
        alert("So'zlar topilmadi.");
        document.getElementById("spinner").style.display = "none";
        return;
    }

    // AI ga tayyor ro'yxatni beramiz
    const tokenListString = rawTokens.map((t, i) => `${i + 1}. ${t}`).join("\n");

    const prompt = `Siz UD 2.0 bo'yicha O'zbek tili ekspertisiz.
Quyidagi raqamlangan so'zlar ro'yxatiga sintaktik tahlil bering.

SO'ZLAR:
${tokenListString}

QAT'IY QOIDALAR:
1. "head": 0 bo'lgan faqat BITTA "root" (fe'l) bo'lsin.
2. "nsubj" (ega) va "advmod" (ravish) bevosita root (fe'l) ga bog'lansin.
3. Boshqa so'zlarni ham mantiqiy bog'lang.
4. Javob faqat JSON array bo'lsin. ID lar yuqoridagi ro'yxat bilan bir xil bo'lsin.

JAVOB FORMATI:
[{"id":1, "token":"...", "lemma":"...", "tag":"NOUN/VERB/ADV...", "head":2, "deprel":"nsubj"}]`;

    try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                temperature: 0, // Har doim bir xil javob uchun
                messages: [
                    { role: "system", content: "Faqat JSON array qaytar." },
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

        // 2-QADAM: JAVOBNI MANTIQIY TEKSHIRISH (FIXER)
        // Biz yuborgan so'zlar soni bilan AI javobi teng bo'lishi shart
        currentData = parsed.map((item, index) => {
            // Agar AI ID ni adashtirsa, majburan o'zimiznikini qo'yamiz
            const realToken = rawTokens[index] || item.token;
            return {
                id: index + 1,
                token: realToken,
                lemma: item.lemma || realToken,
                tag: (item.tag || item.pos || "NOUN").toUpperCase(),
                head: parseInt(item.head) || 0,
                deprel: item.deprel || "dep"
            };
        });

        // 3-QADAM: BOG'LANISHLARNI TO'G'RILASH (LIGVISTIK FIX)
        fixGraphLogic();

        renderUI();

    } catch (e) {
        console.error(e);
        alert("Xatolik: " + e.message);
    } finally {
        document.getElementById("spinner").style.display = "none";
    }
}

// --- 2. GRAF MANTIG'INI TUZATISH (ENGINE) ---
function fixGraphLogic() {
    // 1. Rootni topamiz
    let root = currentData.find(t => t.head === 0);
    
    // Agar root yo'q bo'lsa yoki ko'p bo'lsa, oxirgi fe'lni root qilamiz
    if (!root) {
        const verbs = currentData.filter(t => t.tag === "VERB");
        root = verbs.length > 0 ? verbs[verbs.length - 1] : currentData[currentData.length - 1];
        root.head = 0;
        root.deprel = "root";
    }

    // Boshqa barcha root bo'lib qolganlarni shu rootga ulaymiz
    currentData.forEach(t => {
        if (t.id !== root.id && t.head === 0) {
            t.head = root.id;
            t.deprel = "conj";
        }
        
        // O'ziga o'zi bog'lanishni yo'qotish
        if (t.head === t.id) t.head = root.id;

        // Ega (nsubj) va Ravish (advmod) ni to'g'ridan-to'g'ri rootga ulash
        // (Siz aytgan "juda" -> "charchadim" qoidasi shu yerda ishlaydi)
        if ((t.deprel === "nsubj" || t.tag === "ADV") && t.head !== root.id && t.head !== 0) {
            // Agar u boshqa fe'lga bog'lanmagan bo'lsa, asosiy rootga ula
            const parent = currentData.find(p => p.id === t.head);
            if (parent && parent.tag !== "VERB") {
                t.head = root.id;
            }
        }
    });
}

// --- 3. UI CHIZISH ---
function renderUI() {
    document.getElementById("resultArea").style.display = "block";
    const tokensRow = document.getElementById("tokensRow");
    const tableBody = document.getElementById("tableBody");
    
    tokensRow.innerHTML = "";
    tableBody.innerHTML = "";

    currentData.forEach(t => {
        // Grafik uchun elementlar
        tokensRow.innerHTML += `
            <div class="token-item" id="node-${t.id}">
                <span class="tag-badge">${t.tag}</span>
                <span class="word-text">${t.token}</span>
            </div>
        `;

        // Jadval uchun qatorlar
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

    // Chizishni biroz kechiktiramiz, DOM yuklanib olishi uchun
    setTimeout(drawLines, 200);
}

// --- 4. DRAW LINES (ANIQ KOORDINATALAR) ---
function drawLines() {
    const svg = document.getElementById("svg-canvas");
    const box = document.getElementById("visualBox");
    if (!svg || !box) return;

    // SVG tozalash va sozlash
    const color = getComputedStyle(document.body).getPropertyValue("--primary").trim() || "#4338ca";
    svg.innerHTML = `
        <defs>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <path d="M0,0 L0,6 L9,3 z" fill="${color}" />
            </marker>
        </defs>
    `;
    
    // Konteyner o'lchamini olish (Scrollni hisobga olib)
    svg.setAttribute("width", box.scrollWidth);
    svg.setAttribute("height", 300);

    const baseY = 180; // So'zlar tepasidagi chiziq balandligi

    currentData.forEach(t => {
        const node = document.getElementById(`node-${t.id}`);
        if (!node) return;

        // So'zning markazini topish (Scrollga nisbatan to'g'rilash)
        const boxRect = box.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        
        // X1 - joriy so'z markazi
        const x1 = (nodeRect.left - boxRect.left) + box.scrollLeft + (nodeRect.width / 2);

        // 1. ROOT CHIZISH (Tik tushadigan chiziq)
        if (t.head === 0) {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", `M ${x1} 40 L ${x1} ${baseY - 10}`); // Tepadan pastga
            path.setAttribute("stroke", color);
            path.setAttribute("stroke-width", "2");
            path.setAttribute("marker-end", "url(#arrow)");
            svg.appendChild(path);

            // Root yozuvi
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", x1);
            text.setAttribute("y", 30);
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("fill", color);
            text.setAttribute("font-weight", "bold");
            text.textContent = "ROOT";
            svg.appendChild(text);
        } 
        // 2. BOG'LANISH CHIZISH (Yoy)
        else {
            const headNode = document.getElementById(`node-${t.head}`);
            if (headNode) {
                const headRect = headNode.getBoundingClientRect();
                // X2 - Hokim so'z markazi
                const x2 = (headRect.left - boxRect.left) + box.scrollLeft + (headRect.width / 2);

                // Yoy balandligi masofaga qarab o'zgaradi
                const dist = Math.abs(x1 - x2);
                const arcHeight = Math.min(dist * 0.4, 100) + 20;

                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                // M=Hokim, Q=Egilish, L=Qaram (Strelka qaramga boradi)
                path.setAttribute("d", `M ${x2} ${baseY} Q ${(x1 + x2) / 2} ${baseY - arcHeight} ${x1} ${baseY}`);
                path.setAttribute("stroke", color);
                path.setAttribute("fill", "none");
                path.setAttribute("stroke-width", "2");
                path.setAttribute("marker-end", "url(#arrow)");
                svg.appendChild(path);

                // Label (nsubj, obj...)
                const labelX = (x1 + x2) / 2;
                const labelY = baseY - (arcHeight / 2) - 10;
                
                // Oq fon (yozuv ko'rinishi uchun)
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

// --- CSV ---
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