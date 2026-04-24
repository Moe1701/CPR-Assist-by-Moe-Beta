/**
 * CPR Assist - Export Modul (V20 - Modal-Sync & PDF-Safe Layouts)
 * - BUGFIX: Liest jetzt korrekt die Auswahl IM EXPORT-MODAL aus (Übergabe vs. Debriefing).
 * - BUGFIX: PDF-HTML nutzt nun Tabellen-Strukturen, um Zerschießen (Flexbox-Bugs) zu verhindern.
 * - DEBRIEFING: Vollständiges Log + 5-Zeilen Notenblatt auf Seite 2.
 * - ÜBERGABE: Harte Fakten + SAMPLER (Alles auf 1 Seite).
 */

window.CPR = window.CPR || {};

window.CPR.Export = (function() {

    // --- 1. ICON LOGIK ---
    function getIconData(txt) {
        if (!txt) return null;
        const t = txt.toLowerCase();
        
        if (t.includes('hits') || t.includes('h.i.t.s') || t.includes('sampler') || t.includes('anamnese')) return { icon: '📋', type: 'info' };
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
            t.includes('beatmungen übersprungen') || t.includes('modus manuell') ||
            t.includes('atemweg entfernt')) {
            return null; 
        }
        
        return { icon: '🔹', type: 'default' };
    }

    // --- BULLETPROOF RECTANGLE ---
    function drawSafeRoundRect(ctx, x, y, w, h, r) {
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, r);
        } else {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
        }
    }

    // --- 2. CANVAS NOTENBLATT ENGINE ---
    function createTimelineCanvas(data) {
        const events = data.map(d => ({
            ...d,
            iconData: getIconData(d.action),
            timeStr: window.CPR.Utils.formatRelative(d.secondsFromStart)
        })).filter(d => d.iconData !== null);

        const maxSec = events.length > 0 ? events[events.length - 1].secondsFromStart : 0;
        const totalCycles = Math.max(5, Math.ceil((maxSec + 1) / 120));

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

        // LEGENDE (Oben)
        ctx.fillStyle = '#f8fafc';
        drawSafeRoundRect(ctx, 40, 20, baseWidth - 80, 50, 8);
        ctx.fill();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("GRAFISCHER VERLAUF (120 Sekunden pro Zeile)", baseWidth / 2, 45);

        const paddingX = 80;
        const usableWidth = baseWidth - (paddingX * 2);

        for (let i = 0; i < totalCycles; i++) {
            const cycleStartSec = i * 120;
            const cycleEndSec = (i + 1) * 120;
            const lineY = 150 + (i * rowHeight);

            // Hauptlinie
            ctx.beginPath();
            ctx.moveTo(paddingX, lineY);
            ctx.lineTo(baseWidth - paddingX, lineY);
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Ticks
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            
            ctx.fillRect(paddingX - 1, lineY - 6, 2, 12);
            ctx.fillText(`${i*2} Min`, paddingX, lineY + 20);
            ctx.fillRect(paddingX + (usableWidth/2) - 1, lineY - 4, 2, 8);
            ctx.fillRect(paddingX + usableWidth - 1, lineY - 6, 2, 12);
            ctx.fillText(`${(i+1)*2} Min`, paddingX + usableWidth, lineY + 20);

            const cycleEvents = events.filter(e => e.secondsFromStart >= cycleStartSec && e.secondsFromStart < cycleEndSec);

            cycleEvents.forEach((ev, index) => {
                const secInCycle = ev.secondsFromStart - cycleStartSec;
                const pct = secInCycle / 120;
                const x = paddingX + (pct * usableWidth);

                const yOffsets = [-45, 45, -80, 80]; 
                const yOff = yOffsets[index % yOffsets.length];
                const isTop = yOff < 0;
                
                const boxHeight = 28;
                const boxY = isTop ? (lineY + yOff - boxHeight/2) : (lineY + yOff - boxHeight/2);

                const actionText = ev.action.length > 35 ? ev.action.substring(0, 35) + '...' : ev.action;
                const textWidth = ctx.measureText(actionText).width;
                const timeStr = `[${ev.timeStr}]`;
                const timeWidth = ctx.measureText(timeStr).width;
                const boxWidth = textWidth + timeWidth + 45;
                const boxHalf = boxWidth / 2;

                ctx.beginPath();
                ctx.moveTo(x, lineY);
                ctx.lineTo(x, lineY + yOff);
                ctx.strokeStyle = '#94a3b8';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                ctx.shadowColor = 'rgba(0,0,0,0.05)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetY = 2;
                ctx.fillStyle = '#ffffff';
                
                drawSafeRoundRect(ctx, x - boxHalf, boxY, boxWidth, boxHeight, 6); 
                ctx.fill();
                ctx.shadowColor = 'transparent';

                let borderColor = '#e2e8f0';
                if (ev.iconData.type === 'adr') borderColor = '#fca5a5';
                if (ev.iconData.type === 'amio') borderColor = '#d8b4fe';
                if (ev.iconData.type === 'shock') borderColor = '#fde047';
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.fillStyle = '#E3000F';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'left';
                ctx.fillText(timeStr, x - boxHalf + 10, boxY + boxHeight/2);

                ctx.fillStyle = '#334155';
                ctx.font = 'bold 11px Arial';
                ctx.fillText(`${ev.iconData.icon} ${actionText}`, x - boxHalf + 10 + timeWidth + 8, boxY + boxHeight/2);

                ctx.beginPath();
                ctx.arc(x, lineY, 4, 0, 2 * Math.PI);
                ctx.fillStyle = '#E3000F';
                ctx.fill();
            });
        }

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

        // 🌟 BUGFIX 1: Lese das Toggle IM EXPORT-MODAL aus 🌟
        let isSummary = false;
        const btnExportShort = document.getElementById('btn-export-short');
        if (btnExportShort && (btnExportShort.classList.contains('bg-white') || btnExportShort.classList.contains('text-slate-800'))) {
            isSummary = true; // User hat im Modal auf "ÜBERGABE" geklickt!
        }

        const data = AppState.protocolData;
        const totalSec = AppState.totalSeconds || 0;
        
        let ageStr = AppState.isPediatric ? (AppState.patientWeight ? `Kind (${AppState.patientWeight} kg)` : 'Kind (Gewicht unbek.)') : 'Erwachsener';
        const arrSec = AppState.arrestSeconds || 0;
        const compSec = AppState.compressingSeconds || 0;
        const ccf = arrSec > 0 ? Math.min(100, Math.round((compSec / arrSec) * 100)) : 0;

        const now = new Date();
        const dateStr = now.toLocaleDateString('de-DE').replace(/\./g, '-');
        const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }).replace(':', '');
        const filename = `CPR_Protokoll_${dateStr}_${timeStr}.pdf`;

        // 🌟 BUGFIX 2: PDF-Safe HTML (Tabellen statt Flexbox) 🌟
        const container = document.createElement('div');
        // Reduziere Breite minimal, damit jsPDF/html2pdf keine Skalierungs-Glitches macht
        container.style.width = '800px'; 
        container.style.padding = '30px';
        container.style.fontFamily = 'Arial, sans-serif';
        container.style.color = '#1e293b';
        container.style.backgroundColor = '#ffffff';

        // HEADER TABLE
        let html = `
            <table style="width: 100%; border-bottom: 3px solid #E3000F; padding-bottom: 10px; margin-bottom: 20px;">
                <tr>
                    <td style="vertical-align: bottom;">
                        <h1 style="margin: 0; font-size: 26px; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">Reanimationsprotokoll</h1>
                        <p style="margin: 5px 0 0 0; color: #64748b; font-size: 12px; font-weight: bold; letter-spacing: 1px;">Generiert durch CPR Assist &bull; MODUS: ${isSummary ? 'ÜBERGABE (Kurz)' : 'DEBRIEFING (Vollständig)'}</p>
                    </td>
                    <td style="vertical-align: bottom; text-align: right; color: #64748b; font-size: 14px;">
                        <strong>Datum:</strong> ${now.toLocaleDateString()}<br>
                        <strong>Einsatzbeginn:</strong> ${AppState.startTime || '--:--'}
                    </td>
                </tr>
            </table>
        `;

        // METRICS TABLE
        html += `
            <table style="width: 100%; margin-bottom: 25px; border-collapse: separate; border-spacing: 10px 0;">
                <tr>
                    <td style="width: 33.3%; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                        <span style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Patient</span><br>
                        <span style="font-size: 18px; font-weight: bold; color: #0f172a;">${ageStr}</span>
                    </td>
                    <td style="width: 33.3%; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                        <span style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Gesamtdauer</span><br>
                        <span style="font-size: 18px; font-weight: bold; color: #0f172a;">${Utils.formatTime(totalSec)}</span>
                    </td>
                    <td style="width: 33.3%; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                        <span style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">CCF (Kompression)</span><br>
                        <span style="font-size: 18px; font-weight: bold; color: ${ccf >= 80 ? '#10b981' : '#E3000F'};">${ccf}%</span>
                    </td>
                </tr>
            </table>
        `;

        // ANAMNESE / DIAGNOSTIK
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
            <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Anamnese & Diagnostik</h3>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 14px; margin-bottom: 30px; line-height: 1.5;">
                ${sLines.length > 0 ? `<div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #cbd5e1;">${sLines.join(' &nbsp;|&nbsp; ')}</div>` : ''}
                
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 15px;">
                            <strong style="color: #0f172a; display: block; margin-bottom: 5px;">SAMPLER:</strong>
                            ${sampStr.length > 0 ? sampStr.join('<br>') : '<span style="color: #94a3b8;">Keine SAMPLER-Daten erfasst.</span>'}
                        </td>
                        <td style="width: 50%; vertical-align: top; border-left: 1px dashed #cbd5e1; padding-left: 15px;">
                            <strong style="color: #0f172a; display: block; margin-bottom: 5px;">HITS Ursachen:</strong>
                            ${hitsLogs.length > 0 ? `<ul style="margin: 0; padding-left: 20px; color: #334155;">${hitsHtml}</ul>` : '<span style="color: #94a3b8;">Keine HITS-Daten erfasst.</span>'}
                        </td>
                    </tr>
                </table>
            </div>
        `;

        if (isSummary) {
            // ---> MODUS ÜBERGABE: Harte Fakten Table
            let adrTotal = "0 mg";
            let adrCount = AppState.adrCount || 0;
            if (adrCount > 0) {
                adrTotal = (AppState.isPediatric && AppState.patientWeight) ? (adrCount * Math.round(AppState.patientWeight * 10)) + " µg" : adrCount + " mg";
            }
            
            let amioTotal = "0 mg";
            let amioCount = AppState.amioCount || 0;
            if (amioCount > 0) {
                amioTotal = (AppState.isPediatric && AppState.patientWeight) ? (amioCount * Math.round(AppState.patientWeight * 5)) + " mg" : (amioCount === 1 ? '300 mg' : '450 mg');
            }

            html += `
                <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Harte Fakten / Maßnahmen (Übergabe)</h3>
                <table style="width: 100%; font-size: 14px; border-collapse: collapse; border: 1px solid #e2e8f0;">
                    <tr><td style="padding: 10px; border-bottom: 1px solid #f1f5f9; width: 40%; color: #64748b; background: #f8fafc;">🫁 <strong>Atemweg</strong></td><td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">${AppState.airwayLabel || 'Nicht dokumentiert'}</td></tr>
                    <tr><td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; background: #f8fafc;">🩸 <strong>Zugang</strong></td><td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">${AppState.zugangLabel || 'Nicht dokumentiert'}</td></tr>
                    <tr><td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; background: #f8fafc;">⚡ <strong>Defibrillationen</strong></td><td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">${AppState.shockCount || 0}x abgegeben</td></tr>
                    <tr><td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; background: #f8fafc;">💉 <strong>Adrenalin</strong></td><td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">${adrTotal} <span style="font-size: 12px; color: #94a3b8;">(${adrCount} Gaben)</span></td></tr>
                    <tr><td style="padding: 10px; color: #64748b; background: #f8fafc;">💊 <strong>Amiodaron</strong></td><td style="padding: 10px; font-weight: bold;">${amioTotal} <span style="font-size: 12px; color: #94a3b8;">(${amioCount} Gaben)</span></td></tr>
                </table>
            `;
            
        } else {
            // ---> MODUS DEBRIEFING: Chronologie Tabelle
            html += `
                <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Vollständige Chronologie</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #e2e8f0;">
                    <thead>
                        <tr style="background: #f1f5f9; text-align: left;">
                            <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; width: 100px;">Uhrzeit</th>
                            <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; width: 80px;">Relativ</th>
                            <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Maßnahme / Ereignis</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            data.forEach((item, index) => {
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
            `;

            // NOTENBLATT CANVAS (Erzwingt neue Seite)
            const canvas = createTimelineCanvas(data);
            const imgData = canvas.toDataURL('image/png');
            html += `
                <div style="page-break-before: always; padding-top: 20px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Grafischer Ablauf (Compliance Grid)</h3>
                    <div style="width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; padding: 10px;">
                        <img src="${imgData}" style="width: 100%; max-width: 100%; height: auto; display: block;">
                    </div>
                </div>
            `;
        }

        html += `
            <div style="margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center;">
                Dieses Protokoll wurde maschinell erstellt. Alle Angaben sind vom Teamführer auf fachliche Korrektheit zu prüfen.
            </div>
        `;
        
        container.innerHTML = html;

        // PDF ENGINE
        const opt = {
            margin:       10,
            filename:     filename,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, letterRendering: true, windowWidth: 800 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(container).save().then(() => {
            if (btnPdf) btnPdf.innerHTML = origContent;
            const em = document.getElementById('export-modal');
            if (em) em.classList.replace('flex', 'hidden');
            if (window.CPR.Utils && window.CPR.Utils.vibrate) window.CPR.Utils.vibrate(30);
        }).catch(err => {
            alert("Fehler beim PDF Export.");
            if (btnPdf) btnPdf.innerHTML = origContent;
        });
    }

    // --- 4. CLIPBOARD / TEXT EXPORT ---
    function generateTxtExport() {
        const { AppState, Utils } = window.CPR;
        if (!AppState || !AppState.protocolData || AppState.protocolData.length === 0) {
            alert("Das Protokoll ist leer."); return;
        }
        
        // 🌟 BUGFIX 1 AUCH HIER: Lese das Toggle IM EXPORT-MODAL aus 🌟
        let isSummary = false;
        const btnExportShort = document.getElementById('btn-export-short');
        if (btnExportShort && (btnExportShort.classList.contains('bg-white') || btnExportShort.classList.contains('text-slate-800'))) {
            isSummary = true;
        }

        const data = AppState.protocolData;
        
        let text = "🚨 REANIMATIONSPROTOKOLL " + (isSummary ? "(ÜBERGABE)" : "(VOLLSTÄNDIG)") + "\n";
        text += "Datum: " + new Date().toLocaleDateString() + "\n";
        text += "Start: " + (AppState.startTime || '--:--') + "\n";
        text += "Dauer: " + Utils.formatTime(AppState.totalSeconds || 0) + "\n\n";

        if (AppState.anamneseData) {
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

        if (isSummary) {
            text += "--- HARTE FAKTEN (MAßNAHMEN) ---\n";
            text += "Atemweg: " + (AppState.airwayLabel || 'Nicht dok.') + "\n";
            text += "Zugang: " + (AppState.zugangLabel || 'Nicht dok.') + "\n";
            text += "Schocks: " + (AppState.shockCount || 0) + "x\n";
            text += "Adrenalin Gaben: " + (AppState.adrCount || 0) + "x\n";
            text += "Amiodaron Gaben: " + (AppState.amioCount || 0) + "x\n";
        } else {
            text += "--- CHRONOLOGIE ---\n";
            data.forEach(item => {
                text += `[+${Utils.formatTime(item.secondsFromStart)}] ${item.action}\n`;
            });
        }
        
        text += "\nGeneriert mit CPR Assist";

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
            }).catch(err => { alert("Konnte Text nicht kopieren."); });
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try { document.execCommand('copy'); if(Utils.vibrate) Utils.vibrate(30); alert("Text kopiert!"); } catch (err) {}
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
