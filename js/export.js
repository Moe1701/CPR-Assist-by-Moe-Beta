/**
 * CPR Assist - Export Modul (V17 - Smart Übergabe & Debriefing Mode)
 * - Generiert das PDF-Protokoll und den Text-Export.
 * - Unterscheidet strikt zwischen "Übergabe" (SBAR/Hard Facts) und "Debriefing" (Full Timeline).
 * - Dateinamen enthalten nun Datum & exakte Uhrzeit.
 */

window.CPR = window.CPR || {};

window.CPR.Export = (function() {

    // --- 1. ICON LOGIK (Passend zur App) ---
    function getIconData(txt) {
        if (!txt) return null;
        const t = txt.toLowerCase();
        
        if (t.includes('hits') || t.includes('h.i.t.s') || t.includes('sampler') || t.includes('anamnese')) return { icon: '📋', type: 'info' };
        if (t.includes('schock')) return { icon: '⚡', type: 'shock' };
        
        // GETRENNTE MEDIKAMENTE
        if (t.includes('adrenalin')) return { icon: '💉', type: 'adr' };
        if (t.includes('amiodaron') || t.includes('amio')) return { icon: '💊', type: 'amio' };
        
        if (t.includes('atemweg:') || t.includes('beatmungen durchge')) return { icon: '🫁', type: 'airway' };
        if (t.includes('zugang:')) return { icon: '🩸', type: 'access' };
        if (t.includes('start rea')) return { icon: '▶️', type: 'start' };
        if (t.includes('rosc!')) return { icon: '❤️', type: 'rosc' };
        if (t.includes('re-arrest')) return { icon: '💔', type: 'arrest' };
        if (t.includes('abbruch') || t.includes('beendet')) return { icon: '🛑', type: 'end' };
        
        if (t.includes('kompression pause') || t.includes('kompression fortgesetzt') || 
            t.includes('beatmungen übersprungen') || t.includes('modus manuell') ||
            t.includes('atemweg entfernt')) {
            return null; 
        }
        
        return { icon: 'ℹ️', type: 'default' };
    }

    // --- 2. CANVAS ZEITLEISTE GENERIEREN (Nur für Debriefing) ---
    function createTimelineCanvas(data, totalSeconds) {
        const events = data.map(d => ({
            ...d,
            iconData: getIconData(d.action),
            timeStr: window.CPR.Utils.formatRelative(d.secondsFromStart)
        })).filter(d => d.iconData !== null);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const scale = 2;
        const maxSec = Math.max(300, totalSeconds + 30); 
        const baseWidth = Math.max(1200, (maxSec / 60) * 200); 
        const baseHeight = 500; 
        
        canvas.width = baseWidth * scale;
        canvas.height = baseHeight * scale;
        ctx.scale(scale, scale);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, baseWidth, baseHeight);
        
        const paddingX = 80;
        const usableWidth = baseWidth - (paddingX * 2);
        const lineY = baseHeight / 2; 
        
        // HAUPTACHSE
        ctx.beginPath();
        ctx.moveTo(paddingX - 20, lineY);
        ctx.lineTo(baseWidth - paddingX + 20, lineY);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();

        if (events.length === 0) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("Keine relevanten Ereignisse für die grafische Zeitleiste dokumentiert.", baseWidth/2, lineY - 30);
            return canvas;
        }

        // SMART TRACKS (6 Höhen-Level)
        const tracks = {
            '-1': { yOffset: -80, lastEndX: -999 },
            '1':  { yOffset: 80,  lastEndX: -999 },
            '-2': { yOffset: -150, lastEndX: -999 },
            '2':  { yOffset: 150, lastEndX: -999 },
            '-3': { yOffset: -220, lastEndX: -999 },
            '3':  { yOffset: 220, lastEndX: -999 }
        };
        const trackOrder = ['-1', '1', '-2', '2', '-3', '3'];

        // EVENTS ZEICHNEN
        events.forEach(ev => {
            const x = paddingX + (ev.secondsFromStart / maxSec) * usableWidth;
            
            ctx.font = 'bold 12px Arial';
            const actionText = ev.action.length > 45 ? ev.action.substring(0, 45) + '...' : ev.action;
            const textWidth = ctx.measureText(actionText).width;
            const timeWidth = ctx.measureText(`[${ev.timeStr}]`).width;
            
            const boxWidth = textWidth + timeWidth + 40; 
            const boxHeight = 32;
            const boxHalf = boxWidth / 2;
            
            let assignedTrack = '-1';
            for (let t of trackOrder) {
                const requiredMinX = x - boxHalf - 15; 
                if (tracks[t].lastEndX < requiredMinX) {
                    assignedTrack = t;
                    break;
                }
            }
            
            const tData = tracks[assignedTrack];
            const isTop = parseInt(assignedTrack) < 0;
            const boxY = lineY + tData.yOffset - (isTop ? boxHeight : 0);
            
            tData.lastEndX = x + boxHalf; 
            
            // Fähnchenmast
            ctx.beginPath();
            ctx.moveTo(x, lineY);
            ctx.lineTo(x, isTop ? boxY + boxHeight : boxY);
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            
            // Box
            ctx.shadowColor = 'rgba(0,0,0,0.06)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetY = 3;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(x - boxHalf, boxY, boxWidth, boxHeight, 6); 
            ctx.fill();
            
            ctx.shadowColor = 'transparent';
            
            // Dynamische Rahmenfarbe anhand des Typs
            let borderColor = '#e2e8f0';
            if (ev.iconData.type === 'adr') borderColor = '#fecaca'; // red-200
            if (ev.iconData.type === 'amio') borderColor = '#e9d5ff'; // purple-200
            if (ev.iconData.type === 'shock') borderColor = '#fde047'; // yellow-300
            
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Text Time
            ctx.fillStyle = '#E3000F';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`[${ev.timeStr}]`, x - boxHalf + 12, boxY + boxHeight/2);
            
            // Text Aktion
            ctx.fillStyle = '#334155';
            ctx.font = 'bold 12px Arial';
            ctx.fillText(actionText, x - boxHalf + 12 + timeWidth + 8, boxY + boxHeight/2);
            
            // Punkt auf Achse
            ctx.beginPath();
            ctx.arc(x, lineY, 14, 0, 2 * Math.PI);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(ev.iconData.icon, x, lineY + 1); 
        });
        
        // LEGENDE
        const legX = 30;
        const legY = baseHeight - 70;
        const legItems = [
            { i: '▶️', t: 'Start' }, { i: '⚡', t: 'Schock' }, { i: '💉', t: 'Adrenalin' }, { i: '💊', t: 'Amiodaron' },
            { i: '🫁', t: 'Atemweg' }, { i: '🩸', t: 'Zugang' }, { i: '📋', t: 'Checklisten' },
            { i: '❤️', t: 'ROSC' }, { i: '🛑', t: 'Abbruch/Ende' }
        ];
        
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.roundRect(legX, legY, 880, 50, 8);
        ctx.fill();
        ctx.strokeStyle = '#e2e8f0';
        ctx.stroke();
        
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';
        
        let lx = legX + 15;
        legItems.forEach(item => {
            ctx.fillText(`${item.i} ${item.t}`, lx, legY + 25);
            lx += ctx.measureText(`${item.i} ${item.t}`).width + 25;
        });

        return canvas;
    }

    // --- 3. HTML ZU PDF GENERIERUNG ---
    function generatePdfExport() {
        const { AppState, Utils } = window.CPR;
        if (!AppState || !AppState.protocolData || AppState.protocolData.length === 0) {
            alert("Das Protokoll ist leer. Es gibt nichts zu exportieren.");
            return;
        }

        const btnPdf = document.getElementById('btn-run-pdf-export');
        const origContent = btnPdf ? btnPdf.innerHTML : '';
        if (btnPdf) btnPdf.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Erstelle PDF...';

        const isSummary = AppState.protocolViewMode === 'summary'; // Prüfung: Übergabe oder Debriefing?
        const data = AppState.protocolData;
        const totalSec = AppState.totalSeconds || 0;
        
        let ageStr = AppState.isPediatric ? (AppState.patientWeight ? `Kind (${AppState.patientWeight} kg)` : 'Kind (Gewicht unbek.)') : 'Erwachsener';
        const arrSec = AppState.arrestSeconds || 0;
        const compSec = AppState.compressingSeconds || 0;
        const ccf = arrSec > 0 ? Math.min(100, Math.round((compSec / arrSec) * 100)) : 0;

        // DATEINAME: Mit Datum und Uhrzeit!
        const now = new Date();
        const dateStr = now.toLocaleDateString('de-DE').replace(/\./g, '-');
        const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }).replace(':', '');
        const filename = `CPR_Protokoll_${dateStr}_${timeStr}.pdf`;

        // PDF CONTAINER SETUP
        const container = document.createElement('div');
        container.style.padding = '30px';
        container.style.fontFamily = 'Arial, sans-serif';
        container.style.color = '#1e293b';
        container.style.width = '1000px'; 
        container.style.backgroundColor = '#ffffff';

        // HEADER & METRICS (Für beide Modi gleich)
        let html = `
            <div style="border-bottom: 3px solid #E3000F; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                    <h1 style="margin: 0; font-size: 28px; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">Reanimationsprotokoll</h1>
                    <p style="margin: 5px 0 0 0; color: #64748b; font-size: 12px; font-weight: bold; letter-spacing: 2px;">Generiert durch CPR Assist ${isSummary ? '(Übergabe-Modus)' : ''}</p>
                </div>
                <div style="text-align: right; color: #64748b; font-size: 14px;">
                    <strong>Datum:</strong> ${now.toLocaleDateString()}<br>
                    <strong>Einsatzbeginn:</strong> ${AppState.startTime || '--:--'}
                </div>
            </div>

            <div style="display: flex; gap: 15px; margin-bottom: 30px;">
                <div style="flex: 1; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <span style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Patient</span><br>
                    <span style="font-size: 18px; font-weight: bold; color: #0f172a;">${ageStr}</span>
                </div>
                <div style="flex: 1; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <span style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Gesamtdauer</span><br>
                    <span style="font-size: 18px; font-weight: bold; color: #0f172a;">${Utils.formatTime(totalSec)}</span>
                </div>
                <div style="flex: 1; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <span style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">CCF (Kompression)</span><br>
                    <span style="font-size: 18px; font-weight: bold; color: ${ccf >= 80 ? '#10b981' : '#E3000F'};">${ccf}%</span>
                </div>
                <div style="flex: 1; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <span style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Therapie</span><br>
                    <span style="font-size: 16px; font-weight: bold; color: #0f172a;">
                        ⚡ ${AppState.shockCount || 0}x &bull; 💉 ${AppState.adrCount || 0}x Adr.
                    </span>
                </div>
            </div>
        `;

        // MODULE AUFBAUEN (Übergabe vs Debriefing)
        if (isSummary) {
            // ---> MODUS: ÜBERGABE (SBAR, SAMPLER, HITS)
            const aData = AppState.anamneseData || {};
            let sLines = [];
            if (aData.beobachtet) sLines.push(`<b>Beobachtet:</b> ${aData.beobachtet}`);
            if (aData.laienrea) sLines.push(`<b>Laien-REA:</b> ${aData.laienrea}`);
            if (aData.brustschmerz) sLines.push(`<b>Brustschmerz:</b> ${aData.brustschmerz}`);
            
            let sampStr = [];
            if (aData.sampler) {
                const sMap = {s:'Symptome', a:'Allergien', m:'Medikamente', p:'Vorerkrankungen', l:'Letzte Mahlzeit', e:'Ereignis', r:'Risikofaktoren'};
                Object.keys(sMap).forEach(k => {
                    if (aData.sampler[k]) sampStr.push(`<b>${sMap[k]}:</b> ${aData.sampler[k]}`);
                });
            }

            let hitsLogs = data.filter(d => d.action.includes('HITS:'));
            let hitsHtml = hitsLogs.map(h => `<li style="margin-bottom: 4px;">${h.action.replace('HITS: ', '')}</li>`).join('');

            html += `
                <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Anamnese & Diagnostik (SAMPLER / HITS)</h3>
                <div style="background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 14px; margin-bottom: 30px; line-height: 1.5;">
                    ${sLines.length > 0 ? `<div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #cbd5e1;">${sLines.join(' &nbsp;|&nbsp; ')}</div>` : ''}
                    <div style="display: flex; gap: 20px;">
                        <div style="flex: 1;">
                            <strong style="color: #0f172a; display: block; margin-bottom: 5px;">SAMPLER:</strong>
                            ${sampStr.length > 0 ? sampStr.join('<br>') : '<span style="color: #94a3b8;">Keine SAMPLER-Daten erfasst.</span>'}
                        </div>
                        <div style="flex: 1;">
                            <strong style="color: #0f172a; display: block; margin-bottom: 5px;">HITS Ursachen:</strong>
                            ${hitsLogs.length > 0 ? `<ul style="margin: 0; padding-left: 20px; color: #334155;">${hitsHtml}</ul>` : '<span style="color: #94a3b8;">Keine HITS-Daten erfasst.</span>'}
                        </div>
                    </div>
                </div>
            `;
        } else {
            // ---> MODUS: DEBRIEFING (Canvas Zeitachse)
            const canvas = createTimelineCanvas(data, totalSec);
            const imgData = canvas.toDataURL('image/png');
            html += `
                <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Grafischer Ablauf</h3>
                <div style="width: 100%; overflow: hidden; margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
                    <img src="${imgData}" style="width: 100%; height: auto; display: block;">
                </div>
            `;
        }

        // TABELLE AUFBAUEN (Je nach Modus gefiltert)
        html += `
            <h3 style="margin: 0 0 15px 0; font-size: 14px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">${isSummary ? 'Relevante Interventionen (Gefiltert)' : 'Vollständige Dokumentation'}</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                    <tr style="background: #f1f5f9; text-align: left;">
                        <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; width: 120px;">Uhrzeit</th>
                        <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; width: 100px;">Relativ</th>
                        <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Maßnahme / Ereignis</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // FILTERN DER TABELLE FÜR DEN ÜBERGABE MODUS
        let tableData = data;
        if (isSummary) {
            tableData = data.filter(d => {
                const a = d.action.toLowerCase();
                // Harte Fakten behalten, Logbuch-Spam (wie Pausen) rauswerfen. HITS und SAMPLER sind schon in der Box drüber, 
                // aber zur Sicherheit in der Chronologie behalten wir nur Interventionen:
                return a.includes('schock') || a.includes('adrenalin') || a.includes('amio') || 
                       a.includes('atemweg') || a.includes('zugang') || a.includes('rosc') || 
                       a.includes('start') || a.includes('abbruch') || a.includes('beendet');
            });
        }

        tableData.forEach((item, index) => {
            const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
            const relTime = Utils.formatRelative(item.secondsFromStart);
            html += `
                <tr style="background: ${bg}; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 10px; color: #64748b;">${item.time}</td>
                    <td style="padding: 8px 10px; font-weight: bold; color: #E3000F;">${relTime}</td>
                    <td style="padding: 8px 10px; font-weight: bold; color: #334155;">${item.action}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
            
            <div style="margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center;">
                Dieses Protokoll wurde maschinell erstellt. Alle Angaben sind vom Teamführer auf fachliche Korrektheit zu prüfen.
            </div>
        `;
        container.innerHTML = html;

        // PDF ENGINE STARTEN
        const opt = {
            margin:       10,
            filename:     filename,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(container).save().then(() => {
            if (btnPdf) btnPdf.innerHTML = origContent;
            const em = document.getElementById('export-modal');
            if (em) em.classList.replace('flex', 'hidden');
            if (window.CPR.Utils && window.CPR.Utils.vibrate) window.CPR.Utils.vibrate(30);
        }).catch(err => {
            console.error("PDF Export Error: ", err);
            alert("Fehler beim PDF Export. Bitte versuche es noch einmal.");
            if (btnPdf) btnPdf.innerHTML = origContent;
        });
    }

    // --- 4. CLIPBOARD / TEXT EXPORT ---
    function generateTxtExport() {
        const { AppState, Utils } = window.CPR;
        if (!AppState || !AppState.protocolData || AppState.protocolData.length === 0) {
            alert("Das Protokoll ist leer.");
            return;
        }
        
        const isSummary = AppState.protocolViewMode === 'summary';
        const data = AppState.protocolData;
        
        let text = "🚨 REANIMATIONSPROTOKOLL " + (isSummary ? "(ÜBERGABE)" : "") + "\n";
        text += "Datum: " + new Date().toLocaleDateString() + "\n";
        text += "Start: " + (AppState.startTime || '--:--') + "\n";
        text += "Dauer: " + Utils.formatTime(AppState.totalSeconds || 0) + "\n\n";

        // ANAMNESE BLOCK (Nur bei Übergabe)
        if (isSummary && AppState.anamneseData) {
            text += "--- ANAMNESE / DIAGNOSTIK ---\n";
            const aData = AppState.anamneseData;
            if (aData.beobachtet) text += "Beobachtet: " + aData.beobachtet + " | ";
            if (aData.laienrea) text += "Laien-REA: " + aData.laienrea + " | ";
            if (aData.brustschmerz) text += "Brustschmerz: " + aData.brustschmerz + "\n";
            
            if (aData.sampler) {
                const sMap = {s:'Symptome', a:'Allergien', m:'Medikamente', p:'Vorerkrankungen', l:'Letzte Mahlzeit', e:'Ereignis', r:'Risikofaktoren'};
                Object.keys(sMap).forEach(k => {
                    if (aData.sampler[k]) text += sMap[k] + ": " + aData.sampler[k] + "\n";
                });
            }
            
            const hitsLogs = data.filter(d => d.action.includes('HITS:'));
            if (hitsLogs.length > 0) {
                text += "\nHITS Ursachen:\n";
                hitsLogs.forEach(h => text += "- " + h.action.replace('HITS: ', '') + "\n");
            }
            text += "\n";
        }

        text += "--- VERLAUF ---\n";
        
        data.forEach(item => {
            const a = item.action.toLowerCase();
            // Grundsätzlichen Spam immer rauswerfen
            if (a.includes('kompression pause') || a.includes('kompression fortgesetzt') || a.includes('beatmungen übersprungen') || a.includes('modus manuell')) return;
            
            // Wenn Übergabe, dann nur harte Fakten!
            if (isSummary) {
                const isHardFact = a.includes('schock') || a.includes('adrenalin') || a.includes('amio') || 
                                   a.includes('atemweg') || a.includes('zugang') || a.includes('rosc') || 
                                   a.includes('start') || a.includes('abbruch') || a.includes('beendet');
                if (!isHardFact) return;
            }
            
            text += `[+${Utils.formatTime(item.secondsFromStart)}] ${item.action}\n`;
        });
        
        text += "\nGeneriert mit CPR Assist";

        // In die Zwischenablage kopieren
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                if(Utils.vibrate) Utils.vibrate(30);
                const btnTxt = document.getElementById('btn-run-txt-export');
                if(btnTxt) {
                    const oldHtml = btnTxt.innerHTML;
                    btnTxt.innerHTML = '<i class="fa-solid fa-check text-lg"></i> Kopiert!';
                    btnTxt.classList.replace('bg-blue-50', 'bg-emerald-50');
                    btnTxt.classList.replace('text-blue-700', 'text-emerald-700');
                    setTimeout(() => {
                        btnTxt.innerHTML = oldHtml;
                        btnTxt.classList.replace('bg-emerald-50', 'bg-blue-50');
                        btnTxt.classList.replace('text-emerald-700', 'text-blue-700');
                    }, 2000);
                }
            }).catch(err => {
                alert("Konnte Text nicht kopieren:\n" + text);
            });
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try { document.execCommand('copy'); if(Utils.vibrate) Utils.vibrate(30); alert("Text kopiert!"); } catch (err) { alert("Kopieren fehlgeschlagen."); }
            document.body.removeChild(textArea);
        }
    }

    function init() {
        const btnPdf = document.getElementById('btn-run-pdf-export');
        if (btnPdf) btnPdf.addEventListener('click', generatePdfExport);
        
        const btnTxt = document.getElementById('btn-run-txt-export');
        if (btnTxt) btnTxt.addEventListener('click', generateTxtExport);
        
        const btnDebriefExport = document.getElementById('btn-debrief-export');
        if (btnDebriefExport) {
            btnDebriefExport.addEventListener('click', () => {
                const em = document.getElementById('export-modal');
                if (em) em.classList.replace('hidden', 'flex');
            });
        }
    }

    return { init: init };

})();

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.CPR && window.CPR.Export) window.CPR.Export.init();
    }, 150);
});
