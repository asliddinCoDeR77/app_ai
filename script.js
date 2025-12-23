const API_KEY = "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";
let currentData = [];

// --- REJIMNI BOSHQARISH (Theme Toggle) ---
function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');
    const isDark = body.getAttribute('data-theme') === 'dark';
    
    // Rejimni almashtirish
    const newTheme = isDark ? 'light' : 'dark';
    body.setAttribute('data-theme', newTheme);
    
    // Ikonkani yangilash
    if (themeIcon) {
        themeIcon.innerText = isDark ? '🌙' : '☀️';
    }

    // SVG ranglarini yangi rejimga moslab qayta chizish
    if (currentData.length > 0) {
        drawLines();
    }
}

async function analyzeAI() {
    const text = document.getElementById('inputText').value.trim();
    if (!text) return;

    const spinner = document.getElementById('spinner');
    const results = document.getElementById('resultArea');
    spinner.style.display = 'block';
    results.style.display = 'none';

    const prompt = `
    O'zbek tili UD (Universal Dependencies) tahlilchisi sifatida quyidagi gapni tahlil qil: "${text}"
    QAT'IY TEGSETLAR: nsubj, obj, obl, advmod, amod, nmod:poss, compound, conj, cc, mark, cop, aux, punct, root, acl, xcomp, det.
    FORMAT: Faqat JSON array qaytar. Kalitlar: "tokenID", "token", "Lemma", "Tag", "Head", "Deprel".`;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "Siz lingvistik parsersiz. Faqat toza JSON qaytaring." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1
            })
        });

        const data = await response.json();
        const content = data.choices[0].message.content;
        const jsonMatch = content.match(/\[.*\]/s);
        
        if (!jsonMatch) throw new Error("JSON topilmadi");
        
        let rawData = JSON.parse(jsonMatch[0]);
        currentData = rawData.map(item => ({
            tokenID: item.tokenID || item.id || 0,
            token: item.token || item.word || "",
            Lemma: item.Lemma || item.lemma || "-",
            Tag: item.Tag || item.tag || item.pos || "X",
            Head: parseInt(item.Head !== undefined ? item.Head : item.head),
            Deprel: item.Deprel || item.deprel || "root"
        }));

        renderUI();
    } catch (e) {
        console.error(e);
        alert("Xatolik yuz berdi.");
    } finally {
        spinner.style.display = 'none';
    }
}

function renderUI() {
    document.getElementById('resultArea').style.display = 'block';
    const row = document.getElementById('tokensRow');
    const body = document.getElementById('tableBody');
    row.innerHTML = ''; body.innerHTML = '';

    currentData.forEach((item) => {
        row.innerHTML += `
            <div class="token-item" id="node-${item.tokenID}">
                <span class="tag-badge">${item.Tag}</span>
                <span class="word-text">${item.token}</span>
            </div>`;

        body.innerHTML += `
            <tr>
                <td>${item.tokenID}</td>
                <td><b>${item.token}</b></td>
                <td>${item.Lemma}</td>
                <td>${item.Tag}</td>
                <td>${item.Head}</td>
                <td style="color:var(--primary); font-weight:700">${item.Deprel}</td>
            </tr>`;
    });

    setTimeout(drawLines, 300);
}

function drawLines() {
    const svg = document.getElementById('svg-canvas');
    const box = document.getElementById('visualBox');
    if (!svg || !box) return;

    svg.setAttribute("width", box.scrollWidth);
    svg.setAttribute("height", 350);
    
    // Defs ni saqlab qolgan holda tozalash
    const defs = svg.querySelector('defs'); 
    svg.innerHTML = ''; 
    if(defs) svg.appendChild(defs);

    // CSS dan joriy ranglarni olish (Dynamic Theme Support)
    const style = getComputedStyle(document.body);
    const color = style.getPropertyValue('--primary').trim() || '#4338ca';
    const bgColor = style.getPropertyValue('--card').trim() || '#ffffff';

    currentData.forEach(item => {
        const node = document.getElementById(`node-${item.tokenID}`);
        if(!node) return;

        const rect = node.getBoundingClientRect();
        const c = box.getBoundingClientRect();
        const x1 = rect.left + rect.width/2 - c.left;
        const yBase = 180;

        // --- ROOT ---
        if (item.Head === 0 || item.Deprel.toLowerCase() === 'root') {
            const rootPath = createSVGElement("path", {
                "d": `M ${x1} 30 L ${x1} ${yBase - 35}`,
                "stroke": "#f59e0b",
                "stroke-width": "3",
                "marker-end": "url(#arrow)"
            });
            const rootLabel = createSmartLabel(x1, 25, "root", "#f59e0b", bgColor);
            svg.appendChild(rootPath);
            svg.appendChild(rootLabel.halo);
            svg.appendChild(rootLabel.main);
            return;
        }

        // --- BOG'LANISHLAR ---
        const parent = document.getElementById(`node-${item.Head}`);
        if(!parent) return;

        const pRect = parent.getBoundingClientRect();
        const x2 = pRect.left + pRect.width/2 - c.left;
        const dist = Math.abs(x1 - x2);
        const h = Math.min(dist * 0.4, 150);

        const path = createSVGElement("path", {
            "d": `M ${x1} ${yBase} Q ${(x1+x2)/2} ${yBase - h} ${x2} ${yBase}`,
            "stroke": color,
            "fill": "none",
            "stroke-width": "2",
            "marker-end": "url(#arrow)"
        });

        const label = createSmartLabel((x1+x2)/2, yBase - (h/2) - 10, item.Deprel, color, bgColor);
        svg.appendChild(path);
        svg.appendChild(label.halo);
        svg.appendChild(label.main);
    });
}

function createSVGElement(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (let k in attrs) el.setAttribute(k, attrs[k]);
    return el;
}

function createSmartLabel(x, y, text, color, bg) {
    const main = createSVGElement("text", {
        "x": x, "y": y, "text-anchor": "middle",
        "font-size": "12px", "font-weight": "bold", "fill": color
    });
    main.textContent = text;

    const halo = main.cloneNode(true);
    halo.setAttribute("stroke", bg);
    halo.setAttribute("stroke-width", "5px");
    halo.style.paintOrder = "stroke";

    return { main, halo };
}