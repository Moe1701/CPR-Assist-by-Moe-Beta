/**
 * CPR Assist - Export Modul (V32 - Android Emoji Crash Fix)
 * - MEDIZINISCHES UPDATE: Debriefing enthält ZUERST das SBAR Übergabe-Protokoll, 
 * dann das grafische Zeitlinien-Grid und abschließend die exakte Listen-Chronologie.
 * - PDF-SAFE: Nutzt strikte <table> Layouts.
 * - BUGFIX EXTREM: Emojis vollständig aus dem HTML-String der PDF-Tabelle entfernt, 
 * um den "Failed to execute setEnd on Range" (Surrogate Pair) Crash auf Android zu verhindern!
 */

window.CPR = window.CPR || {};

window.CPR.Export = (function() {

    // --- 1. ICON LOGIK (Nur noch für das Canvas Notenblatt genutzt!) ---
    function getIconData(txt) {
        if (!txt) return null;
        const t = txt.toLowerCase();
        if (t.includes('hits') || t.includes('sampler') || t.includes('anamnese')) return { icon: '📋', type: 'info' };
        if (t.includes('schock')) return { icon: '⚡', type: 'shock' };
        if (t.includes('adrenalin')) return { icon: '💉', type: 'adr' };
        if (t.includes('amiodaron') || t.includes('amio')) return { icon: '💊', type: 'amio' };
        if (t.includes('atemweg:') || t.includes('beatmungen durchge')) return { icon: '🫁', type: 'airway' };
        if (t.includes('zugang:')) return { icon: '🩸', type: 'access' };
        if (t.includes('start rea')) return { icon: '▶️', type: 'start' };
        if (t.includes('rosc!')) return { icon: '❤️', type: 'rosc' };
        if (t.includes('re-arrest')) return { icon: '💔', type: 'arrest' };
        if (t.includes('abbruch') || t.includes('beendet')) return { icon: '🛑', type: 'end' };
        if (t.includes('kompression pause') || t.includes('kompression fortgesetzt') || 
            t.includes('beatmungen übersprungen') || t.includes('modus manuell') || t.includes('atemweg entfernt')) return null;
        return { icon: '🔹', type: 'default' };
    }

    // --- 2. HILFSFUNKTIONEN ---
    function drawSafeRoundRect(ctx, x, y, w, h, r) {
        if (ctx.roundRect) {
            ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
        } else {
            ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
        }
    }

    // --- 3. DATEN EXTRAKTION (SBAR Facts) ---
    function extractSbarFacts() {
        const state = window.CPR.AppState || {};
        const totalSec = state.totalSeconds || 0;
        const arrSec = state.arrestSeconds || 0;
        const compSec = state.compressingSeconds || 0;
        const ccf = arrSec > 0 ? Math.min(100, Math.round((compSec / arrSec) * 100)) : 0;
        const ageStr = state.isPediatric ? (state.patientWeight ? `Kind (${state.patientWeight} kg)` : 'Kind (Gewicht unbek.)') : 'Erwachsener';

        let adrTotal = "0 mg", adrCount = state.adrCount || 0;
        if (adrCount > 0) adrTotal = (state.isPediatric && state.patientWeight) ? (adrCount * Math.round(state.patientWeight * 10)) + " µg" : adrCount + " mg";

        let amioTotal = "0 mg", amioCount = state.amioCount || 0;
        if (amioCount > 0) amioTotal = (state.isPediatric && state.patientWeight) ? (amioCount * Math.round(state.patientWeight * 5)) + " mg" : (amioCount === 1 ? '300 mg' : '450 mg');

        const aData = state.anamneseData || {};
        let sampStr = [];
        if (aData.sampler) {
            const sMap = {s:'Symptome', a:'Allergien', m:'Medikamente', p:'Vorerkrankungen', l:'Letzte Mahlzeit', e:'Ereignis', r:'Risikofaktoren'};
            Object.keys(sMap).forEach(k => { if (aData.sampler[k]) sampStr.push(`<b>${sMap[k]}:</b> ${aData.sampler[k]}`); });
        }
        const data = state.protocolData || [];
        const hitsLogs = data.filter(d => d.action.includes('HITS:'));
        const hitsHtml = hitsLogs.map(h => `<li style="margin-bottom: 4px;">${h.action.replace('HITS: ', '')}</li>`).join('');

        return { ageStr, totalSec, ccf, adrCount, adrTotal, amioCount, amioTotal, aData, sampStr, hitsLogs, hitsHtml, state };
    }

    // --- 4. SBAR HTML GENERATOR (Emoji-frei für Android WebView Stabilität) ---
    function generateSbarHtml() {
        const { ageStr, totalSec, ccf, adrTotal, amioTotal, aData, sampStr, hitsLogs, hitsHtml, state, adrCount, amioCount } = extractSbarFacts();
        const Utils = window.CPR.Utils;

        return `
            <!-- [S] SITUATION -->
            <h3 style="margin: 0 0 8px 0; font-size: 16px; text-transform: uppercase; color: #E3000F; border-bottom: 2px solid #f1f5f9; padding-bottom: 4px;">S - Situation</h3>
            <table style="width: 100%; margin-bottom: 20px; border-collapse: separate; border-spacing: 5px 0;">
                <tr>
                    <td style="width: 33%; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center;">
                        <span style="font-size: 10px; color: #64748b; text-transform: uppercase;">Patient</span><br>
                        <span style="font-size: 16px; font-weight: bold; color: #0f172a;">${ageStr}</span>
                    </td>
                    <td style="width: 33%; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center;">
                        <span style="font-size: 10px; color: #64748b; text-transform: uppercase;">Gesamtdauer</span><br>
                        <span style="font-size: 16px; font-weight: bold; color: #0f172a;">${Utils.formatTime(totalSec)} Min</span>
                    </td>
                    <td style="width: 33%; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center;">
                        <span style="font-size: 10px; color: #64748b; text-transform: uppercase;">Aktueller Status</span><br>
                        <span style="font-size: 16px; font-weight: bold; color: ${state.state === 'ROSC_ACTIVE' ? '#10b981' : '#0f172a'};">${state.state === 'ROSC_ACTIVE' ? 'ROSC' : 'Laufende CPR'}</span>
                    </td>
                </tr>
            </table>

            <!-- [B] BACKGROUND -->
            <h3 style="margin: 0 0 8px 0; font-size: 16px; text-transform: uppercase; color: #E3000F; border-bottom: 2px solid #f1f5f9; padding-bottom: 4px;">B - Background (Anamnese)</h3>
            <div style="background: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 20px; font-size: 14px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 5px 0; width: 33%;"><b>Beobachtet:</b> ${aData.beobachtet || '?'}</td>
                        <td style="padding: 5px 0; width: 33%;"><b>Laien-REA:</b> ${aData.laienrea || '?'}</td>
                        <td style="padding: 5px 0; width: 33%;"><b>Brustschmerz:</b> ${aData.brustschmerz || '?'}</td>
                    </tr>
                </table>
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1;">
                    <strong style="color: #64748b; display: block; margin-bottom: 5px; font-size: 12px;">SAMPLER:</strong>
                    ${sampStr.length > 0 ? sampStr.join('<br>') : '<span style="color: #94a3b8; font-style: italic;">Keine SAMPLER-Daten erfasst.</span>'}
                </div>
            </div>

            <!-- [A] ASSESSMENT -->
            <h3 style="margin: 0 0 8px 0; font-size: 16px; text-transform: uppercase; color: #E3000F; border-bottom: 2px solid #f1f5f9; padding-bottom: 4px;">A - Assessment (Diagnostik)</h3>
            <div style="background: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 20px; font-size: 14px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="vertical-align: top; width: 60%; padding-right: 15px;">
                            <strong style="color: #64748b; display: block; margin-bottom: 5px; font-size: 12px;">Reversible Ursachen (HITS):</strong>
                            ${hitsLogs.length > 0 ? `<ul style="margin: 0; padding-left: 20px;">${hitsHtml}</ul>` : '<span style="color: #94a3b8; font-style: italic;">Keine Ursachen (HITS) erfasst.</span>'}
                        </td>
                        <td style="vertical-align: top; border-left: 1px solid #e2e8f0; padding-left: 15px; width: 40%; text-align: center;">
                            <strong style="color: #64748b; display: block; margin-bottom: 5px; font-size: 12px;">CPR Qualität (CCF):</strong>
                            <span style="font-size: 28px; font-weight: bold; color: ${ccf >= 80 ? '#10b981' : '#E3000F'};">${ccf}%</span>
                            <div style="font-size: 10px; color: #94a3b8; margin-top: 5px;">Zielwert: > 80%</div>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- [R] RESPONSE (Emojis entfernt für Export-Stabilität) -->
            <h3 style="margin: 0 0 8px 0; font-size: 16px; text-transform: uppercase; color: #E3000F; border-bottom: 2px solid #f1f5f9; padding-bottom: 4px;">R - Response (Maßnahmen)</h3>
            <table style="width: 100%; font-size: 14px; border-collapse: collapse; border: 1px solid #e2e8f0;">
                <tr><td style="padding: 10px; border-bottom: 1px solid #f1f5f9; width: 30%; color: #64748b; background: #f8fafc;"><strong>Atemweg</strong></td><td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">${state.airwayLabel || 'Nicht dokumentiert'}</td></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; background: #f8fafc;"><strong>Zugang</strong></td><td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">${state.zugangLabel || 'Nicht dokumentiert'}</td></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; background: #f8fafc;"><strong>Defibrillationen</strong></td><td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">${state.shockCount || 0}x Schocks abgegeben</td></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #E3000F; background: #fef2f2;"><strong>Adrenalin</strong></td><td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #E3000F;">Gesamt: ${adrTotal} <span style="font-size: 12px; color: #ef4444; font-weight: normal;">(${adrCount} Gaben)</span></td></tr>
                <tr><td style="padding: 10px; color: #7e22ce; background: #faf5ff;"><strong>Amiodaron</strong></td><td style="padding: 10px; font-weight: bold; color: #7e22ce;">Gesamt: ${amioTotal} <span style="font-size: 12px; color: #a855f7; font-weight: normal;">(${amioCount} Gaben)</span></td></tr>
            </table>
        `;
    }

    // --- 5. CANVAS NOTENBLATT ENGINE ---
    function createTimelineCanvas(data) {
        const events = data.map(d => ({ ...d, iconData: getIconData(d.action), timeStr: window.CPR.Utils.formatRelative(d.secondsFromStart) })).filter(d => d.iconData !== null);
        const maxSec = events.length > 0 ? events[events.length - 1].secondsFromStart : 0;
        
        let totalCycles = 0;
        let cSec = 0;
        while(cSec <= maxSec) {
            cSec += (cSec < 300) ? 60 : 120; // Time-Warp Logik 1 Min / 2 Min
            totalCycles++;
        }
        totalCycles = Math.max(3, totalCycles); // Mindestens 3 Zeilen

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const scale = 2; 
        const rowHeight = 160; 
        const baseWidth = 1200; 
        const baseHeight = 120 + (totalCycles * rowHeight); 
        
        canvas.width = baseWidth * scale;
        canvas.height = baseHeight * scale;
        ctx.scale(scale, scale);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, baseWidth, baseHeight);

        ctx.fillStyle = '#f8fafc';
        drawSafeRoundRect(ctx, 40, 20, baseWidth - 80, 50, 8);
        ctx.fill(); ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#64748b'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText("GRAFISCHES ZEITLINIEN-GRID (Compliance & Leitlinien Audit)", baseWidth / 2, 45);

        const paddingX = 80;
        const usableWidth = baseWidth - (paddingX * 2);
        
        let currentDrawSec = 0;

        for (let i = 0; i < totalCycles; i++) {
            const isChaosPhase = currentDrawSec < 300;
            const cycleDuration = isChaosPhase ? 60 : 120;
            const cycleEndSec = currentDrawSec + cycleDuration;
            const lineY = 150 + (i * rowHeight);

            ctx.beginPath(); ctx.moveTo(paddingX, lineY); ctx.lineTo(baseWidth - paddingX, lineY);
            ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();

            ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
            ctx.fillRect(paddingX - 1, lineY - 6, 2, 12);
            ctx.fillText(window.CPR.Utils.formatTime(currentDrawSec), paddingX, lineY + 20);
            ctx.fillRect(paddingX + usableWidth - 1, lineY - 6, 2, 12);
            ctx.fillText(window.CPR.Utils.formatTime(cycleEndSec), paddingX + usableWidth, lineY + 20);

            const cycleEvents = events.filter(e => e.secondsFromStart >= currentDrawSec && e.secondsFromStart < cycleEndSec);

            cycleEvents.forEach((ev, index) => {
                const secInCycle = ev.secondsFromStart - currentDrawSec;
                const pct = secInCycle / cycleDuration;
                const x = paddingX + (pct * usableWidth);

                const yOffsets = [12, -12, 28, -28, 44, -44];
                const yOff = yOffsets[index % yOffsets.length];
                const isTop = yOff < 0;
                
                const boxHeight = 26;
                const boxY = lineY + yOff - boxHeight/2;

                const actionText = ev.action.length > 35 ? ev.action.substring(0, 35) + '...' : ev.action;
                const textWidth = ctx.measureText(actionText).width;
                const timeWidth = ctx.measureText(`[${ev.timeStr}]`).width;
                const boxWidth = textWidth + timeWidth + 40;
                const boxHalf = boxWidth / 2;

                ctx.beginPath(); ctx.moveTo(x, lineY); ctx.lineTo(x, lineY + yOff);
                ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5; ctx.stroke();

                ctx.shadowColor = 'rgba(0,0,0,0.05)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
                ctx.fillStyle = '#ffffff';
                drawSafeRoundRect(ctx, x - boxHalf, boxY, boxWidth, boxHeight, 6); 
                ctx.fill(); ctx.shadowColor = 'transparent';

                let borderColor = '#e2e8f0';
                if (ev.iconData.type === 'adr') borderColor = '#fca5a5';
                if (ev.iconData.type === 'amio') borderColor = '#d8b4fe';
                if (ev.iconData.type === 'shock') borderColor = '#fde047';
                ctx.strokeStyle = borderColor; ctx.lineWidth = 2; ctx.stroke();

                ctx.fillStyle = '#E3000F'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left';
                ctx.fillText(`[${ev.timeStr}]`, x - boxHalf + 10, boxY + boxHeight/2);
                ctx.fillStyle = '#334155'; ctx.font = 'bold 11px Arial';
                ctx.fillText(`${ev.iconData.icon} ${actionText}`, x - boxHalf + 10 + timeWidth + 5, boxY + boxHeight/2);

                ctx.beginPath(); ctx.arc(x, lineY, 4, 0, 2 * Math.PI); ctx.fillStyle = '#334155'; ctx.fill();
            });
            
            currentDrawSec = cycleEndSec;
        }

        return canvas;
    }

    // --- 6. PDF GENERIERUNG ---
    function generatePdfExport() {
        const { AppState, Utils } = window.CPR;
        if (!AppState || !AppState.protocolData || AppState.protocolData.length === 0) {
            alert("Das Protokoll ist leer."); return;
        }

        const btnPdf = document.getElementById('btn-run-pdf-export');
        const origContent = btnPdf ? btnPdf.innerHTML : '';
        if (btnPdf) btnPdf.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Erstelle PDF...';

        const btnExportShort = document.getElementById('btn-export-short');
        const isSummary = btnExportShort && btnExportShort.classList.contains('bg-white');

        const now = new Date();
        const dateStr = now.toLocaleDateString('de-DE').replace(/\./g, '-');
        const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }).replace(':', '');
        const filename = `CPR_Protokoll_${dateStr}_${timeStr}.pdf`;

        const container = document.createElement('div');
        container.style.width = '800px'; 
        container.style.padding = '30px';
        container.style.fontFamily = 'Arial, sans-serif';
        container.style.color = '#1e293b';
        container.style.backgroundColor = '#ffffff';

        // --- HEADER ---
        let html = `
            <table style="width: 100%; border-bottom: 3px solid #E3000F; padding-bottom: 10px; margin-bottom: 20px;">
                <tr>
                    <td style="vertical-align: bottom;">
                        <h1 style="margin: 0; font-size: 26px; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">Reanimationsprotokoll</h1>
                        <p style="margin: 5px 0 0 0; color: #64748b; font-size: 12px; font-weight: bold; letter-spacing: 1px;">Generiert durch CPR Assist | MODUS: ${isSummary ? 'SCHOCKRAUM ÜBERGABE' : 'DEBRIEFING & AUDIT'}</p>
                    </td>
                    <td style="vertical-align: bottom; text-align: right; color: #64748b; font-size: 14px;">
                        <strong>Datum:</strong> ${now.toLocaleDateString()}<br>
                        <strong>Einsatzbeginn:</strong> ${AppState.startTime || '--:--'}
                    </td>
                </tr>
            </table>
        `;

        html += generateSbarHtml();

        // 2. DEBRIEFING ZUSÄTZE (Grid + Liste)
        if (!isSummary) {
            const data = AppState.protocolData;
            
            // 2A. Canvas Timeline (Canvas = Emojis sind hier absolut sicher!)
            const canvas = createTimelineCanvas(data);
            const imgData = canvas.toDataURL('image/png');
            html += `
                <div style="page-break-before: always; padding-top: 10px;">
                    <img src="${imgData}" style="width: 100%; max-width: 100%; height: auto; display: block;">
                </div>
            `;

            // 2B. Chronologie Liste (Ebenfalls Emojis entfernt)
            html += `
                <div style="page-break-before: always; padding-top: 10px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Minutengenaue Chronologie (Listenprotokoll)</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #e2e8f0;">
                        <thead>
                            <tr style="background: #f1f5f9; text-align: left;">
                                <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1; width: 80px;">Uhrzeit</th>
                                <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1; width: 70px;">Dauer</th>
                                <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1;">Aktion / Maßnahme</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            data.forEach((item, index) => {
                const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                const relTime = Utils.formatRelative(item.secondsFromStart);
                html += `
                    <tr style="background: ${bg}; border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 6px 10px; color: #64748b;">${item.time}</td>
                        <td style="padding: 6px 10px; font-weight: bold; color: #E3000F;">${relTime}</td>
                        <td style="padding: 6px 10px; font-weight: bold; color: #334155;">${item.action}</td>
                    </tr>
                `;
            });
            html += `</tbody></table></div>`;
        }

        html += `<div style="margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center;">Dieses Protokoll wurde maschinell durch CPR Assist erstellt. Alle Angaben sind fachlich zu prüfen.</div>`;
        container.innerHTML = html;

        // --- PDF RENDERER (Ohne letterRendering) ---
        const opt = {
            margin:       10,
            filename:     filename,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, windowWidth: 800 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(container).save().then(() => {
            if (btnPdf) btnPdf.innerHTML = origContent;
            const em = document.getElementById('export-modal');
            if (em) em.classList.replace('flex', 'hidden');
            if (Utils.vibrate) Utils.vibrate(30);
        }).catch(err => {
            alert("Fehler beim PDF Export: " + err.message);
            if (btnPdf) btnPdf.innerHTML = origContent;
        });
    }

    // --- 7. TEXT EXPORT (Clipboard) ---
    function generateTxtExport() {
        const { AppState, Utils } = window.CPR;
        if (!AppState || !AppState.protocolData || AppState.protocolData.length === 0) { alert("Protokoll leer."); return; }
        
        const btnExportShort = document.getElementById('btn-export-short');
        const isSummary = btnExportShort && btnExportShort.classList.contains('bg-white');
        const { ageStr, totalSec, ccf, adrTotal, amioTotal, aData, sampStr, hitsLogs, state, adrCount, amioCount } = extractSbarFacts();
        
        let text = "🚨 REANIMATIONSPROTOKOLL - " + (isSummary ? "ÜBERGABE (SBAR)" : "DEBRIEFING") + "\n";
        text += "Datum: " + new Date().toLocaleDateString() + " | Beginn: " + (AppState.startTime || '--:--') + "\n\n";
        
        text += "--- [S] SITUATION ---\n";
        text += "Patient: " + ageStr + "\nStatus: " + (state.state === 'ROSC_ACTIVE' ? 'ROSC' : 'Laufende CPR') + "\nDauer: " + Utils.formatTime(totalSec) + " Min\n\n";

        text += "--- [B] BACKGROUND ---\n";
        text += `Beobachtet: ${aData.beobachtet || '?'} | Laien-REA: ${aData.laienrea || '?'} | Brustschmerz: ${aData.brustschmerz || '?'}\n`;
        if (sampStr.length > 0) text += sampStr.map(s => s.replace(/<[^>]*>?/gm, '')).join('\n') + "\n";
        text += "\n";

        text += "--- [A] ASSESSMENT ---\n";
        text += "CPR Qualität (CCF): " + ccf + "%\n";
        if (hitsLogs.length > 0) hitsLogs.forEach(h => text += "- " + h.action.replace('HITS: ', '') + "\n");
        else text += "Keine HITS erfasst.\n";
        text += "\n";

        text += "--- [R] RESPONSE ---\n";
        text += "Atemweg: " + (AppState.airwayLabel || 'Nicht dok.') + "\n";
        text += "Zugang: " + (AppState.zugangLabel || 'Nicht dok.') + "\n";
        text += "Schocks: " + (AppState.shockCount || 0) + "x abgegeben\n";
        text += `Adrenalin: ${adrTotal} (${adrCount} Gaben)\n`;
        text += `Amiodaron: ${amioTotal} (${amioCount} Gaben)\n\n`;

        if (!isSummary) {
            text += "--- CHRONOLOGIE ---\n";
            AppState.protocolData.forEach(item => {
                text += `[+${Utils.formatTime(item.secondsFromStart)}] ${item.time} | ${item.action}\n`;
            });
        }
        
        text += "\n-- Generiert durch CPR Assist --";

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                if(Utils.vibrate) Utils.vibrate(30);
                const btnTxt = document.getElementById('btn-run-txt-export');
                if(btnTxt) {
                    const oldHtml = btnTxt.innerHTML;
                    btnTxt.innerHTML = '<i class="fa-solid fa-check text-lg"></i> Kopiert!';
                    btnTxt.classList.replace('bg-blue-50', 'bg-emerald-50'); btnTxt.classList.replace('text-blue-700', 'text-emerald-700');
                    setTimeout(() => { btnTxt.innerHTML = oldHtml; btnTxt.classList.replace('bg-emerald-50', 'bg-blue-50'); btnTxt.classList.replace('text-emerald-700', 'text-blue-700'); }, 2000);
                }
            }).catch(err => { alert("Konnte nicht kopieren."); });
        } else {
            const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); if(Utils.vibrate) Utils.vibrate(30); alert("Text kopiert!"); } catch(err) {}
            document.body.removeChild(ta);
        }
    }

    function init() {
        const btnPdf = document.getElementById('btn-run-pdf-export');
        if (btnPdf) btnPdf.addEventListener('click', generatePdfExport);
        const btnTxt = document.getElementById('btn-run-txt-export');
        if (btnTxt) btnTxt.addEventListener('click', generateTxtExport);
        const btnDebriefExport = document.getElementById('btn-debrief-export');
        if (btnDebriefExport) btnDebriefExport.addEventListener('click', () => {
            const em = document.getElementById('export-modal');
            if (em) em.classList.replace('hidden', 'flex');
        });
    }

    return { init: init };

})();

document.addEventListener('DOMContentLoaded', () => { setTimeout(() => { if (window.CPR && window.CPR.Export) window.CPR.Export.init(); }, 150); });
