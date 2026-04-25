/**
 * CPR Assist - Log Timeline Modul (V56 - SBAR & ROSC Update)
 * - BUGFIX: Live-Marker stoppt nicht mehr am Ende eines 2-Min-Blocks, sondern spawnt nahtlos im nächsten.
 * - BUGFIX: CPR Pausen Detektor ist nun viel robuster (erkennt auch 'Analyse' etc.).
 * - FEATURE: Medical Grade SBAR-Struktur für die Übergabe.
 */

window.CPR = window.CPR || {};

window.CPR.LogTimeline = (function() {
    let currentView = 'list'; 
    let liveMarkerInterval = null;
    
    // --- 1. ICON & JOULE LOGIK ---
    function getIconData(txt) {
        if (!txt) return null;
        const t = txt.toLowerCase();
        
        if (t.includes('schock') && !t.includes('schockbar')) {
            const match = t.match(/(\d+)\s*[jJ]/);
            if (match) return { icon: match[1] + 'J', isText: true, type: 'shock', color: 'text-white', bg: 'bg-[#E3000F]' };
            return { icon: '⚡', type: 'shock', color: 'text-white', bg: 'bg-[#E3000F]' };
        }
        
        if (t.includes('nicht schockbar')) return { 
            icon: '🚫⚡', 
            htmlIcon: '<div class="relative">⚡<div class="absolute top-1/2 left-[-2px] right-[-2px] h-[2px] bg-[#E3000F] -rotate-45"></div></div>',
            type: 'analysis-no', color: 'text-slate-500', bg: 'bg-white border-2 border-slate-200' 
        };
        
        if (t.includes('schockbar')) return { icon: '⚡', type: 'analysis-yes', color: 'text-[#E3000F]', bg: 'bg-red-50 border-2 border-red-200' };

        if (t.includes('hits') || t.includes('sampler') || t.includes('anamnese')) return { icon: '📋', type: 'info', color: 'text-blue-500', bg: 'bg-blue-50 border border-blue-100' };
        if (t.includes('adrenalin')) return { icon: '💉', type: 'adr', color: 'text-white', bg: 'bg-[#E3000F]' };
        if (t.includes('amiodaron') || t.includes('amio')) return { icon: '💊', type: 'amio', color: 'text-white', bg: 'bg-purple-500' };
        if (t.includes('atemweg:') || t.includes('beatmungen durchge')) return { icon: '🫁', type: 'airway', color: 'text-cyan-600', bg: 'bg-cyan-50 border border-cyan-200' };
        if (t.includes('zugang:')) return { icon: '🩸', type: 'zugang', color: 'text-indigo-600', bg: 'bg-indigo-50 border border-indigo-200' };
        if (t.includes('rosc')) return { icon: '❤️', type: 'rosc', color: 'text-white', bg: 'bg-emerald-500 shadow-md animate-pulse' };
        if (t.includes('abbruch:')) return { icon: '🛑', type: 'abbruch', color: 'text-white', bg: 'bg-slate-800 shadow-md' };
        
        return null; // Kein Icon, nur normaler Punkt
    }

    function parseTime(timeStr) {
        if (!timeStr) return 0;
        const pts = timeStr.split(':');
        if (pts.length === 3) return parseInt(pts[0])*3600 + parseInt(pts[1])*60 + parseInt(pts[2]);
        if (pts.length === 2) return parseInt(pts[0])*60 + parseInt(pts[1]);
        return 0;
    }

    function extractTimelineData(logs) {
        if (!logs || logs.length === 0) return { start: 0, blocks: [], maxSeconds: 0 };
        
        const startTimeStr = window.CPR.AppState.startTime || document.getElementById('start-time')?.innerText || "00:00:00";
        const baseTime = parseTime(startTimeStr);
        let blocks = [];
        let currBlock = null;
        let lastCPRStart = null;
        let maxSeconds = 0;

        logs.forEach(log => {
            const timeMatch = log.match(/^(\d{1,2}:\d{2}:\d{2})/);
            if (!timeMatch) return;
            
            const eventTime = parseTime(timeMatch[1]);
            const elapsed = Math.max(0, eventTime - baseTime); // in Sekunden
            const content = log.substring(timeMatch[0].length + 2);
            const lower = content.toLowerCase();
            
            if (elapsed > maxSeconds) maxSeconds = elapsed;

            if (lower.includes('cpr fortgesetzt') || lower.includes('start erwachsen') || lower.includes('start pädiat')) {
                if (currBlock) {
                    currBlock.end = elapsed;
                    blocks.push(currBlock);
                }
                lastCPRStart = elapsed;
                currBlock = { start: elapsed, end: elapsed + 120, pauses: [], events: [] };
            } 
            else if (lower.includes('cpr pausiert') || lower.includes('rhythmusanalyse gestartet') || lower.includes('rosc') || lower.includes('abbruch')) {
                if (currBlock && lastCPRStart !== null) {
                    currBlock.pauses.push({ start: elapsed, end: elapsed + 10 });
                }
            }
            
            if (currBlock && !lower.includes('cpr fortgesetzt') && !lower.includes('cpr pausiert')) {
                const iconMatch = getIconData(content);
                if (iconMatch) currBlock.events.push({ time: elapsed, text: content, icon: iconMatch });
            }
        });

        if (currBlock) {
            const finalTime = Math.max(window.CPR.AppState.totalSeconds || 0, maxSeconds);
            currBlock.end = Math.max(currBlock.start + 120, finalTime);
            
            if (currBlock.pauses.length > 0) {
                const lastPause = currBlock.pauses[currBlock.pauses.length - 1];
                if (lastPause.end < currBlock.end) {
                    lastPause.end = currBlock.end;
                }
            }
            blocks.push(currBlock);
        }

        return { start: baseTime, blocks: blocks, maxSeconds: Math.max(window.CPR.AppState.totalSeconds || 0, maxSeconds) };
    }

    // --- 2. DIE RENDERING FUNKTIONEN ---
    function renderList(logs, container) {
        let html = '<div class="p-4 pb-20 w-full relative z-0 flex flex-col items-center max-w-lg mx-auto">';
        let lastTimeStr = "";
        
        // Vertikale Linie im Hintergrund
        html += '<div class="absolute left-8 top-8 bottom-0 w-0.5 bg-slate-200 z-0"></div>';
        
        [...logs].reverse().forEach((log, index) => {
            const parts = log.split(': ');
            const t = parts[0] + ":" + parts[1] + ":" + parts[2];
            const msg = parts.slice(3).join(': ');
            const isLatest = (index === 0);
            
            const iconData = getIconData(msg);
            
            // Neuer Timestamp Header, wenn sich die Minute ändert
            const timeWithoutSec = parts[0] + ":" + parts[1];
            if (timeWithoutSec !== lastTimeStr) {
                html += `<div class="relative z-10 bg-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3 mt-1 shadow-inner">${timeWithoutSec}</div>`;
                lastTimeStr = timeWithoutSec;
            }

            let iconHtml = '';
            let boxClass = 'bg-white border border-slate-200';
            let textClass = 'text-slate-600 font-bold';
            
            if (iconData) {
                const iconContent = iconData.htmlIcon || iconData.icon;
                const txtSize = iconData.isText ? 'text-[9px] font-black' : 'text-sm';
                iconHtml = `<div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm z-10 ${iconData.bg} ${iconData.color} ${txtSize}">${iconContent}</div>`;
                
                if (iconData.type === 'shock') boxClass = 'bg-red-50 border border-red-200 shadow-sm';
                if (iconData.type === 'adr') boxClass = 'bg-red-50 border border-red-100';
                if (iconData.type === 'rosc') { boxClass = 'bg-emerald-50 border-2 border-emerald-300 shadow-md'; textClass = 'text-emerald-800 font-black'; }
                if (iconData.type === 'abbruch') { boxClass = 'bg-slate-800 shadow-md'; textClass = 'text-white font-black'; }
            } else {
                iconHtml = `<div class="w-8 h-8 rounded-full bg-white border-4 border-slate-50 flex items-center justify-center shrink-0 z-10"><div class="w-2 h-2 bg-slate-300 rounded-full"></div></div>`;
            }

            html += `
                <div class="flex items-center w-full gap-3 mb-3 relative group">
                    <div class="flex flex-col items-center relative h-full">
                        ${iconHtml}
                    </div>
                    <div class="flex-1 ${boxClass} px-3 py-2.5 rounded-xl text-xs relative ${isLatest && !iconData ? 'border-indigo-200 bg-indigo-50 shadow-sm' : ''}">
                        <div class="flex justify-between items-start gap-2">
                            <span class="${textClass} leading-tight">${msg}</span>
                            <span class="text-[9px] text-slate-400 font-black shrink-0 mt-0.5">${parts[0]+':'+parts[1]}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    // --- SBAR UPDATE: NEUE SUMMARY GENERIERUNG ---
    function generateSummaryHTML(logs) {
        if (!logs || logs.length === 0) return '<div class="text-center p-4 text-xs font-bold text-slate-400">Keine Daten verfügbar</div>';

        // --- 1. DATEN EXTRAKTION (SBAR) ---
        let roscTime = "Laufender Einsatz / Abbruch";
        let abbruchReason = "";
        let shocks = 0;
        let adr = 0;
        let amio = 0;
        let postRosc = [];
        let airway = window.CPR.Globals?.tempAirwayType || "Nicht dokumentiert";
        let zugang = document.getElementById('zugang-label')?.innerText || "Nicht dokumentiert";
        if (zugang === 'Zugang') zugang = "Nicht dokumentiert";

        logs.forEach(log => {
            const t = log.toLowerCase();
            if (t.includes('rosc eingetreten')) roscTime = log.split(': ')[1] || log;
            if (t.includes('abbruch:')) abbruchReason = log;
            if (t.includes('schock') && !t.includes('schockbar')) shocks++;
            if (t.includes('adrenalin')) adr++;
            if (t.includes('amiodaron')) amio++;
            if (t.includes('atemweg:')) airway = log.split(': ')[1] || log;
            if (t.includes('zugang:')) zugang = log.split(': ')[1] || log;
            if (log.includes('ROSC: ')) postRosc.push(log.replace('ROSC: ', '')); // ROSC Maßnahmen filtern
        });

        // Situation
        let situationText = roscTime;
        if (abbruchReason) situationText = abbruchReason;

        // Anamnese (SAMPLER/HITS)
        const anamnese = window.CPR.AppState?.anamneseData || {};
        let samplerText = "Keine Angaben";
        if (anamnese.sampler && Object.values(anamnese.sampler).some(v => v !== '')) {
            samplerText = ['s','a','m','p','l','e','r']
                .filter(k => anamnese.sampler[k])
                .map(k => `<span class="uppercase text-slate-400 text-[8px] mr-1">${k.toUpperCase()}:</span>${anamnese.sampler[k]}`)
                .join('<br>');
        }
        
        let hitsText = "Keine Auffälligkeiten";
        const activeHits = ['hypoxie', 'hypovolaemie', 'kaliaemie', 'hypothermie', 'tamponade', 'toxine', 'thrombose', 'tension']
            .filter(k => anamnese[k] === 'Ja');
        if (activeHits.length > 0) {
            hitsText = activeHits.map(h => h.toUpperCase()).join(', ');
        }

        // --- 2. HTML GENERIERUNG (SBAR BOXEN) ---
        return `
            <div class="flex flex-col gap-3 p-3 pb-8">
                <!-- S - SITUATION -->
                <div class="bg-white rounded-xl p-3 border border-red-100 shadow-sm relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1 h-full bg-[#E3000F]"></div>
                    <span class="text-[9px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1.5 mb-1"><div class="w-4 h-4 bg-red-50 rounded-full flex items-center justify-center text-[8px]">S</div> SITUATION</span>
                    <div class="font-bold text-slate-800 text-xs pl-1">${situationText}</div>
                </div>

                <!-- B - BACKGROUND -->
                <div class="bg-white rounded-xl p-3 border border-amber-100 shadow-sm relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                    <span class="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5 mb-2"><div class="w-4 h-4 bg-amber-50 rounded-full flex items-center justify-center text-[8px]">B</div> BACKGROUND (HITS / SAMPLER)</span>
                    <div class="grid grid-cols-1 gap-2 pl-1">
                        <div><span class="text-[8px] font-bold text-slate-400 uppercase block leading-none">HITS-Verdacht</span><span class="text-xs font-bold text-slate-700">${hitsText}</span></div>
                        <div><span class="text-[8px] font-bold text-slate-400 uppercase block leading-none mb-0.5">SAMPLER</span><div class="text-[10px] font-bold text-slate-700 leading-tight">${samplerText}</div></div>
                    </div>
                </div>

                <!-- A - ASSESSMENT / MASSNAHMEN -->
                <div class="bg-white rounded-xl p-3 border border-emerald-100 shadow-sm relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                    <span class="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 mb-2"><div class="w-4 h-4 bg-emerald-50 rounded-full flex items-center justify-center text-[8px]">A</div> MASSNAHMEN CPR</span>
                    <div class="grid grid-cols-2 gap-y-2 gap-x-2 pl-1">
                        <div class="col-span-2"><span class="text-[8px] font-bold text-slate-400 uppercase block leading-none">Atemweg</span><span class="text-xs font-black text-slate-700">${airway}</span></div>
                        <div class="col-span-2"><span class="text-[8px] font-bold text-slate-400 uppercase block leading-none">Zugang</span><span class="text-xs font-black text-slate-700">${zugang}</span></div>
                        <div class="bg-slate-50 p-1.5 rounded-lg border border-slate-100"><span class="text-[8px] font-bold text-slate-400 uppercase block text-center mb-0.5">Schocks</span><span class="text-sm font-black text-amber-500 block text-center">${shocks}</span></div>
                        <div class="bg-slate-50 p-1.5 rounded-lg border border-slate-100"><span class="text-[8px] font-bold text-slate-400 uppercase block text-center mb-0.5">Adrenalin</span><span class="text-sm font-black text-[#E3000F] block text-center">${adr} mg</span></div>
                        <div class="col-span-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100 flex justify-between items-center"><span class="text-[8px] font-bold text-slate-400 uppercase">Amiodaron</span><span class="text-xs font-black text-purple-600">${amio > 0 ? (amio===1?'300 mg':'450 mg') : '0 mg'}</span></div>
                    </div>
                </div>

                <!-- R - RECOMMENDATION / POST-ROSC -->
                <div class="bg-white rounded-xl p-3 border border-blue-100 shadow-sm relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <span class="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5 mb-2"><div class="w-4 h-4 bg-blue-50 rounded-full flex items-center justify-center text-[8px]">R</div> POST-ROSC MANAGEMENT</span>
                    <div class="pl-1">
                        ${postRosc.length > 0 
                            ? '<ul class="flex flex-col gap-1">' + postRosc.map(item => `<li class="text-xs font-bold text-slate-700 flex items-start gap-1.5"><i class="fa-solid fa-check text-emerald-500 mt-0.5"></i> <span>${item}</span></li>`).join('') + '</ul>'
                            : '<span class="text-[10px] font-bold text-slate-400 italic">Keine Maßnahmen dokumentiert.</span>'
                        }
                    </div>
                </div>
            </div>
        `;
    }

    // --- S-GRID ZEITLEISTE FUNKTIONEN (UNVERÄNDERT, WEIL PERFEKT!) ---
    function drawSGridTimeline(data, canvas, wrapper) {
        if (!data || !data.blocks || data.blocks.length === 0) return;
        
        const isPed = window.CPR.AppState?.isPediatric;
        const MODE_SEC = 120; // Normalerweise 120s pro Block, Pädiatrie hat oft andere Zyklen, aber wir rastern fest auf 120 für die Übersicht.

        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        
        const M_TOP = 40;
        const M_BOT = 40;
        const ROW_H = 140; 
        
        const DOT_X_L = 50; 
        const DOT_X_R = W - 50; 
        const L_W = DOT_X_R - DOT_X_L;
        
        const P_RAD = 12;

        const maxSec = data.maxSeconds;
        let numBlocks = Math.ceil(maxSec / MODE_SEC);
        if (numBlocks < 1) numBlocks = 1;
        
        const TOTAL_H = M_TOP + M_BOT + (numBlocks * ROW_H);
        canvas.height = TOTAL_H;
        
        if (wrapper) {
            wrapper.style.height = `${TOTAL_H}px`;
        }

        ctx.clearRect(0, 0, W, TOTAL_H);

        // 1. ZickZack Pfad (Grau)
        ctx.beginPath();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        for (let i = 0; i < numBlocks; i++) {
            const isLTR = (i % 2 === 0);
            const yCurrent = M_TOP + i * ROW_H;
            const yNext = M_TOP + (i + 1) * ROW_H;

            if (isLTR) {
                if (i === 0) ctx.moveTo(DOT_X_L, yCurrent);
                ctx.lineTo(DOT_X_R, yCurrent);
                if (i < numBlocks - 1) ctx.lineTo(DOT_X_R, yNext);
            } else {
                ctx.lineTo(DOT_X_L, yCurrent);
                if (i < numBlocks - 1) ctx.lineTo(DOT_X_L, yNext);
            }
        }
        ctx.stroke();

        // 2. Grüne / Rote CPR Blöcke zeichnen
        ctx.lineWidth = 14; 
        ctx.lineCap = 'butt';
        
        data.blocks.forEach(block => {
            const startIdx = Math.floor(block.start / MODE_SEC);
            const endIdx = Math.floor(block.end / MODE_SEC);
            
            for (let i = startIdx; i <= endIdx; i++) {
                if (i >= numBlocks) break;
                
                const isLTR = (i % 2 === 0);
                const blockStartY = M_TOP + i * ROW_H;
                const blockEndY = M_TOP + (i+1) * ROW_H;
                
                const secInThisRowStart = Math.max(0, block.start - (i * MODE_SEC));
                const secInThisRowEnd = Math.min(MODE_SEC, block.end - (i * MODE_SEC));
                
                if (secInThisRowStart >= MODE_SEC || secInThisRowEnd <= 0) continue;
                
                const pctStart = secInThisRowStart / MODE_SEC;
                const pctEnd = secInThisRowEnd / MODE_SEC;
                
                const x1 = isLTR ? DOT_X_L + (pctStart * L_W) : DOT_X_R - (pctStart * L_W);
                const x2 = isLTR ? DOT_X_L + (pctEnd * L_W) : DOT_X_R - (pctEnd * L_W);
                
                // Grüner Balken (CPR)
                ctx.beginPath();
                ctx.strokeStyle = '#34d399'; 
                ctx.moveTo(x1, blockStartY);
                ctx.lineTo(x2, blockStartY);
                ctx.stroke();

                // Pausen drüberzeichnen (Rot)
                block.pauses.forEach(p => {
                    const pStartInRow = Math.max(0, p.start - (i * MODE_SEC));
                    const pEndInRow = Math.min(MODE_SEC, p.end - (i * MODE_SEC));
                    
                    if (pStartInRow >= MODE_SEC || pEndInRow <= 0) return;
                    
                    const pPctStart = pStartInRow / MODE_SEC;
                    const pPctEnd = pEndInRow / MODE_SEC;
                    
                    const px1 = isLTR ? DOT_X_L + (pPctStart * L_W) : DOT_X_R - (pPctStart * L_W);
                    const px2 = isLTR ? DOT_X_L + (pPctEnd * L_W) : DOT_X_R - (pPctEnd * L_W);
                    
                    ctx.beginPath();
                    ctx.strokeStyle = '#f87171'; 
                    ctx.moveTo(px1, blockStartY);
                    ctx.lineTo(px2, blockStartY);
                    ctx.stroke();
                });
            }
        });

        // 3. Grid-Knotenpunkte & Zeit-Labels
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i <= numBlocks; i++) {
            const isLTR = (i % 2 === 0);
            const y = M_TOP + i * ROW_H;
            let x = isLTR ? DOT_X_L : DOT_X_R;
            if (i === numBlocks && !isLTR) x = DOT_X_L;
            if (i === numBlocks && isLTR) x = DOT_X_R;

            ctx.beginPath();
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 3;
            ctx.arc(x, y, P_RAD, 0, 2*Math.PI);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#64748b';
            const m = Math.floor((i * MODE_SEC) / 60);
            const s = (i * MODE_SEC) % 60;
            const timeStr = m + ":" + (s<10?'0':'') + s;
            
            if (isLTR) {
                ctx.textAlign = 'right';
                ctx.fillText(timeStr, DOT_X_L - 20, y);
            } else {
                ctx.textAlign = 'left';
                ctx.fillText(timeStr, DOT_X_R + 20, y);
            }
        }

        // 4. Icons & Tooltips der Events ins DOM rendern
        const tContainer = document.getElementById('timeline-tools');
        if (tContainer) tContainer.innerHTML = '';

        data.blocks.forEach(block => {
            block.events.forEach(ev => {
                if (!ev.icon) return;
                const rowIdx = Math.floor(ev.time / MODE_SEC);
                const secInRow = ev.time % MODE_SEC;
                const pct = secInRow / MODE_SEC;
                
                const isLTR = (rowIdx % 2 === 0);
                const y = M_TOP + rowIdx * ROW_H;
                const x = isLTR ? DOT_X_L + (pct * L_W) : DOT_X_R - (pct * L_W);

                if (tContainer) {
                    const el = document.createElement('div');
                    el.className = `absolute transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center shadow-md ${ev.icon.bg} ${ev.icon.color} text-[10px] font-black cursor-pointer group`;
                    el.style.left = x + 'px';
                    el.style.top = y + 'px';
                    el.innerHTML = ev.icon.htmlIcon || ev.icon.icon;

                    const tooltip = document.createElement('div');
                    tooltip.className = "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[120px] bg-slate-800 text-white text-[9px] font-bold px-2 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-center shadow-lg z-50 leading-tight";
                    tooltip.innerText = ev.text;
                    
                    const tri = document.createElement('div');
                    tri.className = "absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800";
                    tooltip.appendChild(tri);

                    el.appendChild(tooltip);
                    tContainer.appendChild(el);
                }
            });
        });
    }

    function drawLiveMarker(canvasId) {
        if (currentView !== 'timeline') return;
        const canvas = document.getElementById(canvasId);
        const tContainer = document.getElementById('timeline-tools');
        if (!canvas || !tContainer) return;

        const liveElId = 'timeline-live-marker';
        let liveEl = document.getElementById(liveElId);

        if (window.CPR.AppState.state === 'IDLE' || window.CPR.AppState.totalSeconds === 0) {
            if (liveEl) liveEl.style.display = 'none';
            return;
        }

        const MODE_SEC = 120;
        const M_TOP = 40;
        const ROW_H = 140;
        const DOT_X_L = 50; 
        const DOT_X_R = canvas.width - 50; 
        const L_W = DOT_X_R - DOT_X_L;

        const totalSec = window.CPR.AppState.totalSeconds;
        
        // --- 🔴 BUGFIX: Nahtloses Spawnen ---
        // Verhindert, dass der Marker bei Punkt 120s, 240s etc. hängen bleibt oder verschwindet.
        const rowIdx = Math.floor(totalSec / MODE_SEC);
        // Damit er nicht verschwindet, wenn der Canvas noch nicht mitgewachsen ist:
        if ((M_TOP + rowIdx * ROW_H) > canvas.height) return; 
        
        const secInRow = totalSec % MODE_SEC;
        const pct = secInRow / MODE_SEC;
        
        const isLTR = (rowIdx % 2 === 0);
        const y = M_TOP + rowIdx * ROW_H;
        const x = isLTR ? DOT_X_L + (pct * L_W) : DOT_X_R - (pct * L_W);

        if (!liveEl) {
            liveEl = document.createElement('div');
            liveEl.id = liveElId;
            liveEl.className = "absolute w-4 h-4 bg-[#E3000F] rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-[0_0_15px_rgba(227,0,15,0.8)] z-50 animate-pulse pointer-events-none";
            tContainer.appendChild(liveEl);
        }

        liveEl.style.display = 'block';
        liveEl.style.left = x + 'px';
        liveEl.style.top = y + 'px';
    }

    function renderCurrentView() {
        const listEl = document.getElementById('protocol-list');
        if (!listEl) return;
        
        const logs = window.CPR.Globals?.sysLogs || [];

        if (currentView === 'list') {
            if (logs.length === 0) listEl.innerHTML = '<div class="text-center p-4 text-xs font-bold text-slate-400">Logbuch leer</div>';
            else renderList(logs, listEl);
        } 
        else if (currentView === 'summary') {
            listEl.innerHTML = generateSummaryHTML(logs);
        }
        else if (currentView === 'timeline') {
            const tData = extractTimelineData(logs);
            
            let html = `
                <div class="relative w-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50 flex justify-center py-4">
                    <div id="timeline-wrapper" class="relative w-[340px] shrink-0">
                        <canvas id="timeline-canvas" width="340" height="400" class="absolute top-0 left-0 w-full"></canvas>
                        <div id="timeline-tools" class="absolute top-0 left-0 w-full h-full pointer-events-auto"></div>
                    </div>
                </div>
            `;
            listEl.innerHTML = html;
            
            const canvas = document.getElementById('timeline-canvas');
            const wrapper = document.getElementById('timeline-wrapper');
            if (canvas && wrapper) {
                drawSGridTimeline(tData, canvas, wrapper);
                drawLiveMarker('timeline-canvas'); 
            }
        }
    }

    // --- 3. EVENT LISTENER & TAB STEUERUNG ---
    function startLiveMarkerInterval() {
        if (liveMarkerInterval) clearInterval(liveMarkerInterval);
        liveMarkerInterval = setInterval(() => {
            if (currentView === 'timeline') {
                drawLiveMarker('timeline-canvas');
            }
        }, 1000);
    }

    function stopLiveMarkerInterval() {
        if (liveMarkerInterval) {
            clearInterval(liveMarkerInterval);
            liveMarkerInterval = null;
        }
    }

    function switchTab(tab) {
        currentView = tab;
        
        const btnList = document.getElementById('btn-view-list');
        const btnTime = document.getElementById('btn-view-timeline');
        const btnSumm = document.getElementById('btn-view-summary');

        if (btnList) btnList.className = 'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-500 transition-all';
        if (btnTime) btnTime.className = 'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-500 transition-all';
        if (btnSumm) btnSumm.className = 'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-500 transition-all';

        if (tab === 'list' && btnList) {
            btnList.className = 'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-white text-slate-800 shadow-sm transition-all';
        } else if (tab === 'timeline' && btnTime) {
            btnTime.className = 'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-white text-slate-800 shadow-sm transition-all';
        } else if (tab === 'summary' && btnSumm) {
            btnSumm.className = 'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-white text-slate-800 shadow-sm transition-all';
        }

        renderCurrentView();

        if (tab === 'timeline') startLiveMarkerInterval();
        else stopLiveMarkerInterval();
    }

    function init() {
        const btnTime = document.getElementById('btn-view-timeline');
        if (btnTime) btnTime.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if(window.CPR.Utils) window.CPR.Utils.vibrate(20); switchTab('timeline'); });
        const btnList = document.getElementById('btn-view-list');
        if (btnList) btnList.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if(window.CPR.Utils) window.CPR.Utils.vibrate(20); switchTab('list'); });
        const btnSumm = document.getElementById('btn-view-summary');
        if (btnSumm) btnSumm.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if(window.CPR.Utils) window.CPR.Utils.vibrate(20); switchTab('summary'); });

        const btnToggle = document.getElementById('btn-toggle-protocol');
        if (btnToggle) btnToggle.addEventListener('click', () => { renderCurrentView(); });
        const btnDebrief = document.getElementById('btn-rosc-end');
        if(btnDebrief) btnDebrief.addEventListener('click', () => { setTimeout(renderCurrentView, 500); });

        // Initialansicht setzen (List)
        setTimeout(() => { switchTab('list'); }, 100);
    }

    return { init: init, forceRender: renderCurrentView };
})();

document.addEventListener('DOMContentLoaded', () => { setTimeout(() => { if (window.CPR && window.CPR.LogTimeline) window.CPR.LogTimeline.init(); }, 150); });
