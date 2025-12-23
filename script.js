const API_KEY = "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";
let currentData = [];

function toggleTheme() {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('theme-icon').innerText = isDark ? '🌙' : '☀️';
}

async function analyzeAI() {
    const text = document.getElementById('inputText').value.trim();
    if (!text) return;

    const spinner = document.getElementById('spinner');
    const results = document.getElementById('resultArea');
    spinner.style.display = 'block';
    results.style.display = 'none';

    const prompt = `
    Siz o'zbek tili korpus lingvistikasi bo'yicha ekspert tizimsiz.
    Vazifa: Quyidagi gapni Universal Dependencies (UD) bo'yicha statistik tahlil qiling.
    
    NAMUNA (Training Data Pattern):
    Gap: "Tarix hayotning o'qituvchisidir."
    Javob:
    1. Tarix -> nsubj -> o'qituvchisidir (Root)
    2. hayotning -> nmod:poss -> o'qituvchisidir (Root)
    3. o'qituvchisidir -> root -> (0)
    4. . -> punct -> o'qituvchisidir (Root)

    TAHLIL QILINADIGAN GAP: "${text}"
    
    TALAB:
    Gapdagi eng asosiy mazmuniy markazni (Root) toping va "Ega" (nsubj), hamda "Tinish belgilari"ni (punct) o'sha markazga bog'lang.
    Faqat JSON formatida qaytaring:
    [{"tokenID": 1, "token": "...", "Lemma": "...", "Tag": "...", "Head": 0, "Deprel": "root"}]
    `;

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
                    { role: "system", content: "Siz faqat JSON qaytaruvchi lingvistik parsersiz." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1 
            })
        });

        if (!response.ok) throw new Error("API xatosi");

        const data = await response.json();
        const content = data.choices[0].message.content;
        
        const jsonMatch = content.match(/\[.*\]/s);
        if (!jsonMatch) throw new Error("JSON formati noto'g'ri");
        let parsedData = JSON.parse(jsonMatch[0]);


        const rootItem = parsedData.find(item => item.Deprel.toLowerCase() === 'root' || item.Head === 0);
        
        if (rootItem) {
         
            rootItem.Head = 0; 
            const rootID = rootItem.tokenID;

            parsedData = parsedData.map(item => {
                const dep = item.Deprel.toLowerCase();
                const tag = item.Tag.toUpperCase();
                const token = item.token;

 
                if (dep.includes('nsubj') && item.Head !== rootID) {
                    item.Head = rootID;
                }
                
           
                if ((tag === 'PUNCT' || dep === 'punct' || ['.','!','?'].includes(token)) && item.Head !== rootID) {
                    item.Head = rootID;
                    item.Deprel = 'punct';
                }

                return item;
            });
        }

        currentData = parsedData;
        renderUI();
    } catch (e) {
        console.error(e);
        alert("Xatolik yuz berdi. Qaytadan urinib ko'ring.");
    } finally {
        spinner.style.display = 'none';
    }
}

function renderUI() {
    document.getElementById('resultArea').style.display = 'block';
    const row = document.getElementById('tokensRow');
    const body = document.getElementById('tableBody');
    const svg = document.getElementById('svg-canvas');

    row.innerHTML = ''; body.innerHTML = '';
   
    const defs = svg.querySelector('defs'); 
    svg.innerHTML = ''; 
    if(defs) svg.appendChild(defs);

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
                <td>${item.Lemma || '-'}</td>
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
    

    svg.setAttribute("width", box.scrollWidth);
    svg.setAttribute("height", 300); 
    
    const color = getComputedStyle(document.body).getPropertyValue('--primary') || '#4338ca';
    const bgColor = getComputedStyle(document.body).backgroundColor || '#ffffff';

    currentData.forEach(item => {
        if (!item.Head || item.Head == 0) return;
        
        const s = document.getElementById(`node-${item.tokenID}`);
        const e = document.getElementById(`node-${item.Head}`);
        if(!s || !e) return;

        const r1 = s.getBoundingClientRect();
        const r2 = e.getBoundingClientRect();
        const c = box.getBoundingClientRect();

        const x1 = r1.left + r1.width/2 - c.left;
        const x2 = r2.left + r2.width/2 - c.left;
        const yBase = 160; 
        
        const distance = Math.abs(x1 - x2);
 
        const h = Math.min(distance * 0.5, 140);


        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${x1} ${yBase} Q ${(x1+x2)/2} ${yBase - h} ${x2} ${yBase}`);
        path.setAttribute("stroke", color);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke-width", "2");
        path.setAttribute("marker-end", "url(#arrow)");
        

        const apexY = yBase - (h / 2);
        
        const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        txt.setAttribute("x", (x1+x2)/2);
        txt.setAttribute("y", apexY - 5); 
        
        txt.setAttribute("text-anchor", "middle");
        txt.setAttribute("font-size", "11px");
        txt.setAttribute("font-weight", "bold");
        txt.setAttribute("fill", color);

        
    
        txt.style.paintOrder = "stroke"; 
        txt.setAttribute("stroke", bgColor === 'rgba(0, 0, 0, 0)' ? 'white' : bgColor); 
        txt.setAttribute("stroke-width", "4px");
        txt.setAttribute("stroke-linecap", "round");
        txt.setAttribute("stroke-linejoin", "round");
        
        txt.textContent = item.Deprel;

        svg.appendChild(path);
        svg.appendChild(txt);
    });
}

function downloadCSV() {
    let csv = "\uFEFFID,Token,Lemma,Tag,Head,Deprel\n";
    currentData.forEach(r => csv += `${r.tokenID},${r.token},${r.Lemma},${r.Tag},${r.Head},${r.Deprel}\n`);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lingvistik_tahlil.csv';
    a.click();
}