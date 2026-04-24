/**
 * CPR Assist - Log Timeline Modul (V28 - 1-Minuten Start & Pures Emoji Grid)
 * - MEDIZINISCHES UX-UPDATE: Zyklen 1-5 sind 1-Minuten Intervalle. Ab Min 5 sind es 120s Intervalle.
 * - KOMPAKT-LEGENDE: Oben deutlich schmaler, damit mehr Grid sichtbar ist.
 * - PURES EMOJI: Keine dicken runden Hintergründe mehr, verhindert Überlappen.
 * - MULTI-LEVEL ZICK-ZACK: 6 verschiedene Höhenstufen für extrem hohe Ereignisdichte.
 */

window.CPR = window.CPR || {};

window.CPR.LogTimeline = (function() {
    let currentView = 'list'; 
    
    // --- 1. ICON LOGIK (100% Synchron mit export.js) ---
    function getIconData(txt) {
        if (!txt) return null;
        const t = txt.toLowerCase();
        
        if (t.includes('hits') || t.includes('sampler') || t.includes('anamnese')) return { icon: '📋', type: 'info', color: 'text-slate-500', bg: 'bg-white' };
        if (t.includes('schock')) return { icon: '⚡', type: 'shock', color: 'text-amber-500', bg: 'bg-amber-50' };
        if (t.includes('adrenalin')) return { icon: '💉', type: 'adr', color: 'text-[#E3000F]', bg: 'bg-red-50' };
        if (t.includes('amiodaron') || t.includes('amio')) return { icon: '💊', type: 'amio', color: 'text-purple-600', bg: 'bg-purple-50' };
        if (t.includes('atemweg') || t.includes('eti') || t.includes('lts') || t.includes('igel') || t.includes('beatmung')) return { icon: '🫁', type: 'airway', color: 'text-cyan-600', bg: 'bg-cyan-50' };
        if (t.includes('zugang') || t.includes('i.v.') || t.includes('i.o.')) return { icon: '🩸', type: 'access', color: 'text-indigo-600', bg: 'bg-indigo-50' };
        if (t.includes('start rea') || t.includes('einsatz gestartet') || t.includes('patient:')) return { icon: '▶️', type: 'start', color: 'text-emerald-600', bg: 'bg-emerald-50' };
        if (t.includes('rosc') || t.includes('abbruch') || t.includes('ende')) return { icon: '🏁', type: 'end', color: 'text-slate-800', bg: 'bg-slate-200' };
        
        return { icon: '🔹', type: 'default', color: 'text-slate-400', bg: 'bg-slate-50' };
    }

    // --- 2. LOGS PARSEN (Greift nun auf medizinische db protocolData zu) ---
    function parseLogs() {
        const rawLogs = window.CPR.AppState?.protocolData || [];
        if (rawLogs.length === 0) return [];

        let parsed = [];

        rawLogs.forEach(log => {
            parsed.push({
                raw: log.action,
                timeStr: log.time,
                text: log.action,
                relativeSec: log.secondsFromStart || 0,
                iconData: getIconData(log.action)
            });
        });
        
        return parsed;
    }

    // --- 3. DIE LISTEN-ANSICHT (Klassischer Kassenbon) ---
    function renderList(container) {
        const logs = parseLogs();
        if (logs.length === 0) {
            container.innerHTML = '<div class="p-6 text-center text-slate-400 font-bold text-xs uppercase tracking-widest mt-10">Keine Einträge vorhanden</div>';
            return;
        }

        let html = '<div class="p-4 space-y-2 pb-24">';
        logs.forEach(l => {
            html += `
            <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${l.iconData.bg} border border-slate-100 shadow-inner">
                    <span class="${l.iconData.color} text-lg drop-shadow-sm">${l.iconData.icon}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">${l.timeStr} <span class="text-slate-300 mx-1">|</span> +${window.CPR.Utils?.formatTime(l.relativeSec) || '00:00'}</div>
                    <div class="text-xs font-bold text-slate-700 leading-tight">${l.text}</div>
                </div>
            </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    // --- 4. DIE ÜBERGABE-ANSICHT (SBAR / Schockraum) ---
    function renderSummary(container) {
        const logs = parseLogs();
        const state = window.CPR.AppState || {};
        
        let totalTime = "00:00";
        if(logs.length > 0) {
            totalTime = window.CPR.Utils?.formatTime(logs[logs.length-1].relativeSec) || "00:00";
        }
        
        // Zählungen aus dem AppState (oder Fallback aus den Logs)
        let adrCount = state.adrCount || logs.filter(l => l.text.toLowerCase().includes('adrenalin')).length;
        let amioCount = state.amioCount || logs.filter(l => l.text.toLowerCase().includes('amiodaron') || l.text.toLowerCase().includes('amio')).length;
        let shockCount = state.shockCount || logs.filter(l => l.text.toLowerCase().includes('schock abgegeben')).length;
        let ccf = document.getElementById('ccf-display')?.innerText || "0%";
        let airway = state.airwayLabel || "Nicht dokumentiert";
        let zugang = state.zugangLabel || "Nicht dokumentiert";

        // Sichere Dosis-Berechnung (Erwachsener vs. Kind)
        let adrTotal = "0 mg";
        if (adrCount > 0) {
            if (state.isPediatric && state.patientWeight) {
                adrTotal = (adrCount * Math.round(state.patientWeight * 10)) + " µg";
            } else {
                adrTotal = adrCount + " mg";
            }
        }

        let amioTotal = "0 mg";
        if (amioCount > 0) {
            if (state.isPediatric && state.patientWeight) {
                amioTotal = (amioCount * Math.round(state.patientWeight * 5)) + " mg";
            } else {
                amioTotal = amioCount === 1 ? '300 mg' : '450 mg';
            }
        }

        container.innerHTML = `
        <div class="p-4 space-y-3 pb-24">
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Einsatz-Metriken</h4>
                <div class="grid grid-cols-2 gap-y-4 gap-x-2">
                    <div><span class="block text-[9px] font-bold text-slate-400 uppercase">Dauer</span><span class="text-sm font-black text-slate-800">${totalTime}</span></div>
                    <div><span class="block text-[9px] font-bold text-slate-400 uppercase">CCF</span><span class="text-sm font-black text-slate-800">${ccf}</span></div>
                    <div><span class="block text-[9px] font-bold text-amber-500 uppercase">Schocks</span><span class="text-sm font-black text-slate-800">${shockCount}</span></div>
                    <div><span class="block text-[9px] font-bold text-[#E3000F] uppercase">Adrenalin</span><span class="text-sm font-black text-slate-800">${adrTotal} <span class="text-[9px] text-slate-400 font-bold">(${adrCount}x)</span></span></div>
                    <div class="col-span-2"><span class="block text-[9px] font-bold text-purple-500 uppercase">Amiodaron</span><span class="text-sm font-black text-slate-800">${amioTotal} <span class="text-[9px] text-slate-400 font-bold">(${amioCount}x)</span></span></div>
                </div>
            </div>

            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Interventionen</h4>
                <div class="space-y-3">
                    <div class="flex items-center justify-between"><span class="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5"><i class="fa-solid fa-lungs text-cyan-500"></i> Atemweg</span><span class="text-[11px] font-black text-slate-800">${airway}</span></div>
                    <div class="flex items-center justify-between"><span class="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5"><i class="fa-solid fa-droplet text-indigo-500"></i> Zugang</span><span class="text-[11px] font-black text-slate-800">${zugang}</span></div>
                </div>
            </div>
        </div>
        `;
    }

    // --- 5. DIE NEUE ZEITLINIE (1-Minuten und 2-Minuten Hybrid) ---
    function renderTimeline(container) {
        const logs = parseLogs();
        if (logs.length === 0) {
            container.innerHTML = '<div class="p-6 text-center text-slate-400 font-bold text-xs uppercase tracking-widest mt-10">Keine Einträge vorhanden</div>';
            return;
        }

        const maxSec = logs[logs.length - 1].relativeSec;
        
        // Berechnung der benötigten Grid-Zeilen
        // Die ersten 5 Zeilen sind 1-Minuten-Blöcke (0-300s).
        let totalCycles = 5; 
        if (maxSec >= 300) {
            // Ab Sekunde 300 wechseln wir in den 2-Minuten Takt
            totalCycles = 5 + Math.ceil((maxSec - 299) / 120);
        }

        // 5.1 Kompakte Legende (Ohne weiße Boxen, pures Emoji)
        let html = `
        <div class="p-3 space-y-1.5 pb-24">
            <div class="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm shrink-0">
                <div class="flex flex-wrap justify-center gap-x-3 gap-y-1.5">
                    <div class="flex items-center gap-1"><span class="text-[13px] drop-shadow-sm">▶️</span><span class="text-[8px] font-bold text-slate-600 uppercase">Start</span></div>
                    <div class="flex items-center gap-1"><span class="text-[13px] drop-shadow-sm">⚡</span><span class="text-[8px] font-bold text-slate-600 uppercase">Schock</span></div>
                    <div class="flex items-center gap-1"><span class="text-[13px] drop-shadow-sm">💉</span><span class="text-[8px] font-bold text-slate-600 uppercase">Adrenalin</span></div>
                    <div class="flex items-center gap-1"><span class="text-[13px] drop-shadow-sm">💊</span><span class="text-[8px] font-bold text-slate-600 uppercase">Amio</span></div>
                    <div class="flex items-center gap-1"><span class="text-[13px] drop-shadow-sm">🫁</span><span class="text-[8px] font-bold text-slate-600 uppercase">Atemweg</span></div>
                    <div class="flex items-center gap-1"><span class="text-[13px] drop-shadow-sm">🩸</span><span class="text-[8px] font-bold text-slate-600 uppercase">Zugang</span></div>
                </div>
            </div>
        `;

        // 5.2 Das Grid aufbauen
        for (let i = 0; i < totalCycles; i++) {
            let startSec, endSec, labelMin, durationSec;

            if (i < 5) {
                // Zyklus 1-5: 1-Minuten Blöcke
                startSec = i * 60;
                endSec = (i + 1) * 60;
                labelMin = `${i}-${i+1} Min`;
                durationSec = 60;
            } else {
                // Zyklus 6+: 2-Minuten Blöcke
                const cyclesAfter5 = i - 5;
                startSec = 300 + (cyclesAfter5 * 120);
                endSec = startSec + 120;
                labelMin = `${startSec/60}-${endSec/60} Min`;
                durationSec = 120;
            }

            const cycleLogs = logs.filter(l => l.relativeSec >= startSec && l.relativeSec < endSec);

            html += `
            <div class="relative bg-white border border-slate-200 rounded-xl p-2 px-3 shadow-sm h-[70px] w-full shrink-0 flex flex-col justify-end pb-2">
                <span class="absolute top-1.5 left-2.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Zyklus ${i+1} <span class="opacity-50 ml-1">(${labelMin})</span></span>
                
                <!-- 36px hoher Sektor für die Icons -->
                <div class="relative w-full h-[36px] mt-2">
                    <!-- Mittellinie -->
                    <div class="absolute inset-y-0 left-0 w-full h-1 bg-slate-100 border border-slate-200 rounded-full top-1/2 -translate-y-1/2 z-0"></div>
                    
                    <!-- Orientierungs-Ticks bei 25%, 50%, 75% -->
                    <div class="absolute top-1/2 -translate-y-1/2 w-[2px] h-3 bg-slate-300 rounded-full z-0" style="left: 25%"></div>
                    <div class="absolute top-1/2 -translate-y-1/2 w-[2px] h-4 bg-slate-400 rounded-full z-0" style="left: 50%"></div>
                    <div class="absolute top-1/2 -translate-y-1/2 w-[2px] h-3 bg-slate-300 rounded-full z-0" style="left: 75%"></div>
            `;

            // MULTI-LEVEL ZICK-ZACK: 6 spezifische Höhenstufen für extreme Dichte ohne Überlappen.
            // Die Mittellinie liegt bei 18px (top-1/2 eines 36px Containers).
            const yLevels = ['-6px', '22px', '2px', '14px', '-10px', '26px'];

            cycleLogs.forEach((log, index) => {
                const secInCycle = log.relativeSec - startSec;
                const pct = (secInCycle / durationSec) * 100;
                const icon = log.iconData;

                const yPos = yLevels[index % yLevels.length];

                html += `
                <div class="absolute -ml-[8px] w-[16px] h-[16px] flex items-center justify-center text-[16px] drop-shadow-md z-10"
                     style="left: ${pct}%; top: ${yPos};"
                     title="${log.timeStr} - ${log.text}">
                    ${icon.icon}
                </div>
                `;
            });

            html += `
                </div>
            </div>`;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    // --- RENDER CONTROLLER ---
    function renderCurrentView() {
        const container = document.getElementById('protocol-list');
        if (!container) return;
        
        if (currentView === 'list') renderList(container);
        else if (currentView === 'summary') renderSummary(container);
        else if (currentView === 'timeline') renderTimeline(container);
    }

    function switchTab(view) {
        currentView = view;
        
        ['btn-view-list', 'btn-view-summary', 'btn-view-timeline'].forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            if (id === 'btn-view-' + view) {
                btn.className = 'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-white text-slate-800 shadow-sm transition-all';
            } else {
                btn.className = 'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-500 transition-all border border-transparent';
            }
        });
        
        renderCurrentView();
    }

    function init() {
        const btnTime = document.getElementById('btn-view-timeline');
        if (btnTime) btnTime.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if(window.CPR.Utils) window.CPR.Utils.vibrate(20); switchTab('timeline'); });
        
        const btnList = document.getElementById('btn-view-list');
        if (btnList) btnList.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if(window.CPR.Utils) window.CPR.Utils.vibrate(20); switchTab('list'); });
        
        const btnSumm = document.getElementById('btn-view-summary');
        if (btnSumm) btnSumm.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if(window.CPR.Utils) window.CPR.Utils.vibrate(20); switchTab('summary'); });

        const btnToggle = document.getElementById('btn-toggle-protocol');
        if (btnToggle) {
            btnToggle.addEventListener('click', () => { renderCurrentView(); });
        }
        
        const btnDebrief = document.getElementById('btn-rosc-end');
        if(btnDebrief) {
            btnDebrief.addEventListener('click', () => { setTimeout(renderCurrentView, 500); });
        }

        setTimeout(() => { switchTab('list'); }, 100);
    }

    return {
        init: init,
        forceRender: renderCurrentView 
    };

})();

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.CPR && window.CPR.LogTimeline) window.CPR.LogTimeline.init();
    }, 200);
});
