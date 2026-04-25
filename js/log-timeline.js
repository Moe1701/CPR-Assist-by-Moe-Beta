/**
 * CPR Assist - Log Timeline Modul (V30 - SBAR Dashboard & Time-Warp Grid)
 * - MEDIZINISCHES UX-UPDATE: Der "Übergabe"-Tab rendert jetzt das komplette SBAR-Schema (Live-Harvester).
 * - LISTEN-UPDATE: Der "Liste"-Tab bekommt einen mini-SBAR-Header angepinnt.
 * - ICON-SYNC: Die getIconData() ist nun zu 100% kongruent mit der export.js.
 * - SAFEGURAD: Scroll-Positionen bleiben beim Live-Rendern (DOM-Reset) strikt erhalten!
 * - ZICK-ZACK GRID: Das dynamische 6-Level DNA-Grid (1-Min. vs 2-Min. Takte) bleibt unangetastet bestehen.
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
        if (t.includes('atemweg:') || t.includes('beatmungen durchge')) return { icon: '🫁', type: 'airway', color: 'text-cyan-600', bg: 'bg-cyan-50' };
        if (t.includes('zugang:')) return { icon: '🩸', type: 'access', color: 'text-indigo-600', bg: 'bg-indigo-50' };
        if (t.includes('start rea')) return { icon: '▶️', type: 'start', color: 'text-slate-700', bg: 'bg-slate-200' };
        if (t.includes('rosc!')) return { icon: '❤️', type: 'rosc', color: 'text-emerald-600', bg: 'bg-emerald-50' };
        if (t.includes('re-arrest')) return { icon: '💔', type: 'arrest', color: 'text-red-600', bg: 'bg-red-100' };
        if (t.includes('abbruch') || t.includes('beendet')) return { icon: '🛑', type: 'end', color: 'text-slate-800', bg: 'bg-slate-200' };
        
        // System-Rauschen filtern
        if (t.includes('kompression pause') || t.includes('kompression fortgesetzt') || 
            t.includes('beatmungen übersprungen') || t.includes('modus manuell') ||
            t.includes('atemweg entfernt')) {
            return null; 
        }
        
        return { icon: '🔹', type: 'default', color: 'text-slate-400', bg: 'bg-slate-100' };
    }

    // --- 2. DATA HARVESTER (Sammelt und berechnet Fakten Live) ---
    function extractSbarFacts() {
        const state = window.CPR.AppState || {};
        const data = state.protocolData || [];
        
        const totalSec = state.totalSeconds || 0;
        const arrSec = state.arrestSeconds || 0;
        const compSec = state.compressingSeconds || 0;
        const ccf = arrSec > 0 ? Math.min(100, Math.round((compSec / arrSec) * 100)) : 0;

        const ageStr = state.isPediatric ? (state.patientWeight ? `Kind (${state.patientWeight} kg)` : 'Kind (Gewicht unbek.)') : 'Erwachsener';

        let adrTotal = "0 mg";
        let adrCount = state.adrCount || 0;
        if (adrCount > 0) {
            adrTotal = (state.isPediatric && state.patientWeight) ? (adrCount * Math.round(state.patientWeight * 10)) + " µg" : adrCount + " mg";
        }

        let amioTotal = "0 mg";
        let amioCount = state.amioCount || 0;
        if (amioCount > 0) {
            amioTotal = (state.isPediatric && state.patientWeight) ? (amioCount * Math.round(state.patientWeight * 5)) + " mg" : (amioCount === 1 ? '300 mg' : '450 mg');
        }

        const aData = state.anamneseData || {};
        let sampStr = [];
        if (aData.sampler) {
            const sMap = {s:'Symptome', a:'Allergien', m:'Medikamente', p:'Vorerkrankungen', l:'Letzte Mahlzeit', e:'Ereignis', r:'Risikofaktoren'};
            Object.keys(sMap).forEach(k => {
                if (aData.sampler[k]) sampStr.push(`<span class="text-[9px] font-black text-slate-400 uppercase mr-1">${sMap[k]}:</span> <span class="font-bold text-slate-700">${aData.sampler[k]}</span>`);
            });
        }

        const hitsLogs = data.filter(d => d.action.includes('HITS:'));
        const hitsHtml = hitsLogs.map(h => `<li class="mb-1">${h.action.replace('HITS: ', '')}</li>`).join('');

        return { ageStr, totalSec, ccf, adrCount, adrTotal, amioCount, amioTotal, aData, sampStr, hitsLogs, hitsHtml, state };
    }

    // --- 3. DOM RENDERING: SBAR DASHBOARD (Übergabe-Tab) ---
    function renderSummary() {
        const { ageStr, totalSec, ccf, adrCount, adrTotal, amioCount, amioTotal, aData, sampStr, hitsLogs, hitsHtml, state } = extractSbarFacts();
        const ccfColor = ccf >= 80 ? 'text-emerald-500' : 'text-[#E3000F]';

        return `
            <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-24 custom-scrollbar bg-slate-100">
                
                <!-- [S] SITUATION -->
                <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <h3 class="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2"><i class="fa-solid fa-user-injured text-sm"></i> S - Situation</h3>
                    <div class="grid grid-cols-3 gap-2">
                        <div class="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center flex flex-col justify-center"><span class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Patient</span><span class="text-xs font-black text-slate-800 leading-tight">${ageStr}</span></div>
                        <div class="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center flex flex-col justify-center"><span class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Dauer</span><span class="text-[15px] font-black text-slate-800 leading-tight">${window.CPR.Utils.formatTime(totalSec)}</span></div>
                        <div class="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center flex flex-col justify-center"><span class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Status</span><span class="text-xs font-black ${state.state === 'ROSC_ACTIVE' ? 'text-emerald-600' : 'text-slate-800'} leading-tight">${state.state === 'ROSC_ACTIVE' ? 'ROSC' : 'Laufend'}</span></div>
                    </div>
                </div>

                <!-- [B] BACKGROUND -->
                <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                    <h3 class="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2"><i class="fa-solid fa-clipboard-list text-sm"></i> B - Background</h3>
                    <div class="grid grid-cols-3 gap-2 mb-3">
                        <div class="bg-slate-50 py-1.5 px-1 rounded-lg text-center border border-slate-100"><span class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Beobachtet</span><span class="block text-[10px] font-black text-slate-700">${aData.beobachtet || '?'}</span></div>
                        <div class="bg-slate-50 py-1.5 px-1 rounded-lg text-center border border-slate-100"><span class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Laien-REA</span><span class="block text-[10px] font-black text-slate-700">${aData.laienrea || '?'}</span></div>
                        <div class="bg-slate-50 py-1.5 px-1 rounded-lg text-center border border-slate-100"><span class="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Brustschmerz</span><span class="block text-[10px] font-black text-slate-700">${aData.brustschmerz || '?'}</span></div>
                    </div>
                    <div class="bg-slate-50 p-3 rounded-xl text-[11px] border border-slate-100">
                        <strong class="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 border-b border-slate-200 pb-1">SAMPLER</strong>
                        <div class="flex flex-col gap-1.5 mt-2">
                            ${sampStr.length > 0 ? sampStr.join('') : '<span class="italic text-slate-400 text-[10px]">Keine Daten erfasst</span>'}
                        </div>
                    </div>
                </div>

                <!-- [A] ASSESSMENT -->
                <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                    <h3 class="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2"><i class="fa-solid fa-stethoscope text-sm"></i> A - Assessment</h3>
                    <div class="flex gap-2">
                        <div class="flex-[2] bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <strong class="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 border-b border-slate-200 pb-1">HITS (Ursachen)</strong>
                            <ul class="text-[10px] font-bold text-slate-700 list-disc pl-4 mt-2 marker:text-amber-400">
                                ${hitsLogs.length > 0 ? hitsHtml : '<li class="list-none -ml-4 italic text-slate-400 font-normal">Keine erfasst</li>'}
                            </ul>
                        </div>
                        <div class="flex-1 bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center justify-center min-w-[70px]">
                            <span class="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">CCF</span>
                            <span class="text-3xl font-black leading-none tracking-tighter ${ccfColor}">${ccf}%</span>
                        </div>
                    </div>
                </div>

                <!-- [R] RESPONSE -->
                <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1 h-full bg-[#E3000F]"></div>
                    <h3 class="text-[10px] font-black text-[#E3000F] uppercase tracking-widest mb-3 flex items-center gap-2"><i class="fa-solid fa-kit-medical text-sm"></i> R - Response</h3>
                    <div class="flex flex-col gap-1.5">
                        <div class="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><i class="fa-solid fa-lungs text-cyan-500 w-4 text-center text-sm"></i> Atemweg</span>
                            <span class="text-[11px] font-black text-slate-800">${state.airwayLabel || 'Nicht dok.'}</span>
                        </div>
                        <div class="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><i class="fa-solid fa-droplet text-indigo-500 w-4 text-center text-sm"></i> Zugang</span>
                            <span class="text-[11px] font-black text-slate-800">${state.zugangLabel || 'Nicht dok.'}</span>
                        </div>
                        <div class="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><i class="fa-solid fa-bolt text-amber-500 w-4 text-center text-sm"></i> Schocks</span>
                            <span class="text-[11px] font-black text-slate-800">${state.shockCount || 0}x abgegeben</span>
                        </div>
                        <div class="flex justify-between items-center bg-red-50 p-2.5 rounded-xl border border-red-200 shadow-sm mt-1">
                            <span class="text-[10px] font-black text-red-700 uppercase tracking-widest flex items-center gap-2"><i class="fa-solid fa-syringe text-red-500 w-4 text-center text-sm"></i> Adrenalin</span>
                            <div class="text-right leading-tight"><span class="text-[13px] font-black text-[#E3000F] block">${adrTotal}</span><span class="text-[9px] font-bold text-red-500">${adrCount} Gaben</span></div>
                        </div>
                        <div class="flex justify-between items-center bg-purple-50 p-2.5 rounded-xl border border-purple-200 shadow-sm mt-0.5">
                            <span class="text-[10px] font-black text-purple-700 uppercase tracking-widest flex items-center gap-2"><i class="fa-solid fa-pills text-purple-500 w-4 text-center text-sm"></i> Amiodaron</span>
                            <div class="text-right leading-tight"><span class="text-[13px] font-black text-purple-700 block">${amioTotal}</span><span class="text-[9px] font-bold text-purple-500">${amioCount} Gaben</span></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // --- 4. DOM RENDERING: CHRONOLOGIE LISTE (Liste-Tab) ---
    function renderList(data) {
        if (data.length === 0) return '<div class="text-center text-slate-400 font-bold p-10 text-xs uppercase tracking-widest">Noch keine Einträge</div>';

        const { ccf, adrTotal } = extractSbarFacts();

        // Der angepinnte SBAR-Mini-Header für maximalen Überblick beim Scrollen
        let html = `
            <div class="bg-white px-4 py-2 border-b border-slate-200 shadow-sm shrink-0 z-10 flex justify-between items-center sticky top-0">
                <div class="flex items-center gap-4">
                    <div class="flex flex-col"><span class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Qualität</span><span class="text-[11px] leading-none font-black ${ccf >= 80 ? 'text-emerald-500' : 'text-[#E3000F]'}">CCF ${ccf}%</span></div>
                    <div class="w-px h-6 bg-slate-200"></div>
                    <div class="flex flex-col"><span class="text-[8px] font-black text-red-400 uppercase tracking-widest mb-0.5">Adrenalin</span><span class="text-[11px] leading-none font-black text-red-600">${adrTotal}</span></div>
                </div>
                <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest"><i class="fa-solid fa-clock-rotate-left mr-1"></i> Log</span>
            </div>
            <div class="flex-1 overflow-y-auto p-3 pb-24 custom-scrollbar bg-slate-50">
                <div class="flex flex-col gap-2">
        `;

        // Die Liste (neueste oben)
        data.slice().reverse().forEach(item => {
            const iconData = getIconData(item.action) || { icon: '🔹', bg: 'bg-slate-100', color: 'text-slate-500' };
            const relTime = window.CPR.Utils.formatRelative(item.secondsFromStart);

            html += `
                <div class="bg-white rounded-xl p-3 shadow-sm border border-slate-200 flex items-center gap-3 relative overflow-hidden">
                    <div class="w-10 h-10 rounded-full ${iconData.bg} ${iconData.color} border border-white flex items-center justify-center text-lg shrink-0 shadow-inner">
                        ${iconData.icon}
                    </div>
                    <div class="flex flex-col flex-1 min-w-0 pr-2">
                        <span class="text-[11px] font-black text-slate-800 leading-tight mb-1" style="word-break: break-word;">${item.action}</span>
                        <span class="text-[9px] font-bold text-slate-400"><i class="fa-regular fa-clock"></i> ${item.time}</span>
                    </div>
                    <div class="shrink-0 flex flex-col items-end justify-center">
                        <span class="text-[11px] font-black text-[#E3000F] bg-red-50 px-2 py-1 rounded-lg border border-red-100 shadow-sm">${relTime}</span>
                    </div>
                </div>
            `;
        });

        html += `</div></div>`;
        return html;
    }

    // --- 5. DOM RENDERING: TIME-WARP GRID (Zeitlinie-Tab) ---
    function renderTimeline(data) {
        if (data.length === 0) return '<div class="text-center text-slate-400 font-bold p-10 text-xs uppercase tracking-widest">Noch keine Einträge</div>';

        const filtered = data.map(d => ({ ...d, iconData: getIconData(d.action) })).filter(d => d.iconData !== null);
        if (filtered.length === 0) return '<div class="text-center text-slate-400 font-bold p-10 text-xs uppercase tracking-widest">Keine relevanten Events</div>';

        const maxSec = filtered[filtered.length - 1].secondsFromStart;
        
        let html = `<div class="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50 relative pb-24 pt-4 px-3">`;

        let currentCycleSec = 0;
        
        // Zick-Zack Offsets in Pixeln (3 rauf, 3 runter, im Wechsel)
        const yOffsets = [12, -12, 28, -28, 44, -44];

        while (currentCycleSec <= maxSec + 60) {
            // TIME-WARP LOGIK: Erste 5 Minuten = 60s Blöcke. Danach = 120s Blöcke.
            const isChaosPhase = currentCycleSec < 300; 
            const cycleDuration = isChaosPhase ? 60 : 120;
            const cycleEndSec = currentCycleSec + cycleDuration;

            const cycleEvents = filtered.filter(e => e.secondsFromStart >= currentCycleSec && e.secondsFromStart < cycleEndSec);

            html += `
                <div class="relative w-full h-[140px] mb-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
                    <!-- Mittellinie (Track) -->
                    <div class="absolute top-1/2 left-8 right-8 h-1 bg-slate-100 rounded-full -translate-y-1/2 shadow-inner"></div>
                    
                    <!-- Labels (Start / Ende) -->
                    <div class="absolute top-1/2 left-1 -translate-y-1/2 text-[9px] font-black text-slate-400 bg-white px-1 z-10">${window.CPR.Utils.formatTime(currentCycleSec)}</div>
                    <div class="absolute top-1/2 right-1 -translate-y-1/2 text-[9px] font-black text-slate-400 bg-white px-1 z-10">${window.CPR.Utils.formatTime(cycleEndSec)}</div>
            `;

            cycleEvents.forEach((ev, idx) => {
                const secInCycle = ev.secondsFromStart - currentCycleSec;
                const pct = (secInCycle / cycleDuration) * 100;
                
                // Wir mappen idx auf das Zick-Zack Array
                const yOff = yOffsets[idx % yOffsets.length];
                const isTop = yOff < 0; // Negative Pixel = nach oben
                
                // Berechnung der kleinen Ankerlinie vom Main-Track zum Icon
                const lineH = Math.abs(yOff);
                const linePosClass = isTop ? 'bottom-1/2 mb-[2px]' : 'top-1/2 mt-[2px]';

                html += `
                    <!-- Der Anker-Strich -->
                    <div class="absolute left-[calc(2rem+${pct}%*((100%-4rem)/100))] w-px bg-slate-300 -translate-x-1/2 ${linePosClass}" style="height: ${lineH}px;"></div>
                    
                    <!-- Das Icon-Element (Exakt positioniert) -->
                    <div class="absolute left-[calc(2rem+${pct}%*((100%-4rem)/100))] -translate-x-1/2 flex flex-col items-center" style="top: calc(50% + ${yOff}px - 14px); z-index: ${20 + idx};">
                        <div class="w-7 h-7 rounded-full ${ev.iconData.bg} border-2 border-white shadow-md flex items-center justify-center text-[11px] ${ev.iconData.color}">
                            ${ev.iconData.icon}
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
            currentCycleSec = cycleEndSec;
        }

        html += `</div>`;
        return html;
    }

    // --- 6. DOM UPDATER (Mit SCROLL-SAFEGUARD) ---
    function renderCurrentView() {
        const container = document.getElementById('protocol-list');
        if (!container) return;
        const data = (window.CPR.AppState && window.CPR.AppState.protocolData) ? window.CPR.AppState.protocolData : [];

        // 🌟 SCROLL-SAFEGUARD: Rettet die Leseposition vor der DOM-Zerstörung! 🌟
        const scrollTarget = container.querySelector('.overflow-y-auto');
        const currentScrollPos = scrollTarget ? scrollTarget.scrollTop : 0;

        if (currentView === 'timeline') {
            container.innerHTML = renderTimeline(data);
        } else if (currentView === 'summary') {
            container.innerHTML = renderSummary();
        } else {
            container.innerHTML = renderList(data);
        }

        // DOM braucht einen minimalen Frame, um die innerHTML Elemente aufzubauen
        requestAnimationFrame(() => {
            const newScrollTarget = container.querySelector('.overflow-y-auto');
            if (newScrollTarget) {
                newScrollTarget.scrollTop = currentScrollPos;
            }
        });
    }

    // --- 7. TAB LOGIK ---
    function switchTab(tab) {
        currentView = tab;
        if (window.CPR.AppState) window.CPR.AppState.protocolViewMode = tab;
        
        const btnTime = document.getElementById('btn-view-timeline');
        const btnList = document.getElementById('btn-view-list');
        const btnSumm = document.getElementById('btn-view-summary');

        // Reset Styles
        [btnTime, btnList, btnSumm].forEach(b => {
            if(b) {
                b.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
                b.classList.add('text-slate-500');
            }
        });

        // Set Active Style
        let activeBtn = null;
        if(tab === 'timeline') activeBtn = btnTime;
        if(tab === 'list') activeBtn = btnList;
        if(tab === 'summary') activeBtn = btnSumm;

        if(activeBtn) {
            activeBtn.classList.remove('text-slate-500');
            activeBtn.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
        }

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

        // Initiale Ansicht setzen
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
