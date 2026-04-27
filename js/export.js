/**
 * CPR Assist - Export Modul (V59 - Medical Grade Data Fix & PDF Safe-Text)
 * - BUGFIX: Greift nun korrekt auf die neuen AppState.protocolData Objekte zu!
 * - BUGFIX: Split-Logik für Timestamp/Action komplett neu geschrieben (wasserdicht).
 * - UX/PDF FIX: Emojis durch saubere Text-Badges (z.B. [ADR], [SCHOCK]) ersetzt, 
 * da Standard jsPDF (Helvetica) keine UTF-8 Emojis unterstützt (verhindert unsichtbare Zeichen).
 */

window.CPR = window.CPR || {};

window.CPR.Export = (function() {

    // --- 1. ICON LOGIK (Für PDF Safe-Text Badge) ---
    function getIconData(txt) {
        if (!txt) return { icon: '>>>' };
        const t = txt.toLowerCase();
        
        if (t.includes('schock') && !t.includes('schockbar')) {
            const match = t.match(/(\d+)\s*[jJ]/);
            if (match) return { icon: match[1] + ' J' };
            return { icon: 'SCHOCK' };
        }
        if (t.includes('nicht schockbar')) return { icon: 'KEIN SCHOCK' };
        if (t.includes('schockbar')) return { icon: 'SCHOCKBAR' };

        if (t.includes('hits') || t.includes('sampler') || t.includes('anamnese')) return { icon: 'INFO' };
        if (t.includes('adrenalin')) return { icon: 'ADR' };
        if (t.includes('amiodaron') || t.includes('amio')) return { icon: 'AMIO' };
        if (t.includes('atemweg:') || t.includes('beatmungen durchge')) return { icon: 'AW' };
        if (t.includes('zugang:')) return { icon: 'ZUGANG' };
        if (t.includes('rosc')) return { icon: 'ROSC' };
        if (t.includes('abbruch:')) return { icon: 'ENDE' };
        if (t.includes('pause')) return { icon: 'PAUSE' };
        
        return { icon: '---' };
    }

    // --- 2. SBAR TEXT FORMATIERUNG (Für TXT & PDF Summary) ---
    function buildSummaryLog(entries) {
        if (!entries || entries.length === 0) return "Keine Daten verfügbar.";

        let startTimeStr = "--:--";
        let firstEventTime = null;
        let roscEventTime = null;
        let abbruchReason = "";
        let shocks = 0;
        let adr = 0;
        let amio = 0;
        let postRosc = [];
        let airway = window.CPR.Globals?.tempAirwayType || "Nicht dokumentiert";
        let zugang = document.getElementById('zugang-label')?.innerText || "Nicht dokumentiert";
        if (zugang === 'Zugang') zugang = "Nicht dokumentiert";

        // Neue Objekt-Logik: entries ist ein Array aus { time: "14:30:00", action: "Bla" }
        entries.forEach(entry => {
            const timestamp = entry.time;
            const action = entry.action;
            const t = action.toLowerCase();
            
            // Finde den exakten Start-Zeitpunkt
            if (!firstEventTime && (t.includes('start rea') || t.includes('start erwachsen') || t.includes('start pädiat'))) {
                firstEventTime = timestamp;
                startTimeStr = timestamp.substring(0, 5) + " Uhr"; 
            }
            
            // Finde den ROSC Zeitpunkt
            if (t === 'rosc!' || t.includes('rosc eingetreten')) {
                roscEventTime = timestamp;
            }
            
            if (t.includes('abbruch:')) abbruchReason = action;
            if (t.includes('schock') && !t.includes('schockbar')) shocks++;
            if (t.includes('adrenalin')) adr++;
            if (t.includes('amiodaron') || t.includes('amio')) amio++;
            if (t.includes('atemweg:')) airway = action.replace('Atemweg: ', '');
            if (t.includes('zugang:')) zugang = action.replace('Zugang: ', '');
            if (action.startsWith('ROSC: ')) postRosc.push(action.replace('ROSC: ', ''));
        });

        // Fallback: Falls Startzeit nicht im Log, aus der UI holen
        if (startTimeStr === "--:--") {
            const uiStart = document.getElementById('start-time')?.innerText;
            if (uiStart && uiStart !== '--:--') {
                startTimeStr = uiStart.replace('Start: ', '').trim() + " Uhr";
            }
        }

        // Dauer bis ROSC mathematisch berechnen
        let durationText = "";
        if (firstEventTime && roscEventTime) {
            const parseTime = (ts) => {
                const p = ts.split(':');
                if(p.length < 3) return 0;
                return parseInt(p[0])*3600 + parseInt(p[1])*60 + parseInt(p[2]);
            };
            const diff = parseTime(roscEventTime) - parseTime(firstEventTime);
            if (diff >= 0) {
                const m = Math.floor(diff / 60);
                const s = diff % 60;
                durationText = ` (Dauer bis ROSC: ${m} Min ${s} Sek)`;
            }
        }

        let situationText = (roscEventTime ? "ROSC eingetreten" : "Laufende Reanimation") + durationText;
        if (abbruchReason) situationText = abbruchReason;

        const anamnese = window.CPR.AppState?.anamneseData || {};
        let samplerText = "Keine Angaben";
        if (anamnese.sampler && Object.values(anamnese.sampler).some(v => v !== '')) {
            samplerText = ['s','a','m','p','l','e','r']
                .filter(k => anamnese.sampler[k])
                .map(k => `${k.toUpperCase()}: ${anamnese.sampler[k]}`)
                .join('\n  ');
        }
        
        let hitsText = "Keine Auffälligkeiten";
        const activeHits = ['hypoxie', 'hypovolaemie', 'kaliaemie', 'hypothermie', 'tamponade', 'toxine', 'thrombose', 'tension']
            .filter(k => anamnese[k] === 'Ja');
        if (activeHits.length > 0) {
            hitsText = activeHits.map(h => h.toUpperCase()).join(', ');
        }

        // SBAR Zusammenbauen
        let text = "";
        text += "--- S - SITUATION ---\n";
        text += "Einsatzbeginn: " + startTimeStr + "\n";
        text += "Status: " + situationText + "\n\n";

        text += "--- B - BACKGROUND ---\n";
        text += "HITS: " + hitsText + "\n";
        text += "SAMPLER:\n  " + samplerText + "\n\n";

        text += "--- A - ASSESSMENT & MASSNAHMEN ---\n";
        text += "Atemweg: " + airway + "\n";
        text += "Zugang: " + zugang + "\n";
        text += "Defibrillationen: " + shocks + "\n";
        text += "Adrenalin: " + adr + " mg\n";
        text += "Amiodaron: " + (amio > 0 ? (amio===1?'300 mg':'450 mg') : '0 mg') + "\n\n";

        text += "--- R - RECOMMENDATION (POST-ROSC) ---\n";
        if (postRosc.length > 0) {
            postRosc.forEach(item => { text += "✓ " + item + "\n"; });
        } else {
            text += "Keine spezifischen Maßnahmen dokumentiert.\n";
        }

        return text;
    }

    // --- 3. EXPORT FUNKTIONEN ---
    function getFullText() {
        // HIER IST DER FIX: Wir nutzen die neuen AppState.protocolData Objekte
        const entries = window.CPR.AppState?.protocolData || [];
        const isShort = window.CPR.AppState?.protocolViewMode === 'summary';
        
        let out = "CPR ASSIST - EINSATZPROTOKOLL\n";
        out += "Datum: " + new Date().toLocaleDateString() + "\n";
        
        const uiStart = document.getElementById('start-time')?.innerText || '--:--';
        out += "Startzeit: " + uiStart.replace('Start: ', '').trim() + " Uhr\n";
        
        const state = window.CPR.AppState;
        if (state && state.isPediatric && state.patientWeight) {
            out += "Patient: Pädiatrie (" + state.patientWeight + " kg, " + (state.broselowColor || '').toUpperCase() + ")\n";
        } else {
            out += "Patient: Erwachsener\n";
        }
        out += "========================================\n\n";

        if (isShort) {
            out += buildSummaryLog(entries);
        } else {
            out += "DEBRIEFING / VOLLSTÄNDIGER VERLAUF:\n\n";
            entries.forEach(entry => { 
                out += `${entry.time} Uhr: ${entry.action}\n`; 
            });
            out += "\n========================================\n";
            out += buildSummaryLog(entries); 
        }
        
        return out;
    }

    function runTextExport() {
        if(window.CPR.Utils && window.CPR.Utils.vibrate) window.CPR.Utils.vibrate(20);
        const txt = getFullText();
        
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(txt).then(() => {
                alert("Protokoll in die Zwischenablage kopiert!");
            }).catch(() => {
                fallbackCopy(txt);
            });
        } else {
            fallbackCopy(txt);
        }
    }
    
    function fallbackCopy(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            alert("Protokoll in die Zwischenablage kopiert!");
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
            alert("Kopieren fehlgeschlagen. Bitte manuell markieren.");
        }
        document.body.removeChild(textArea);
    }

    function runPdfExport() {
        if(window.CPR.Utils && window.CPR.Utils.vibrate) window.CPR.Utils.vibrate(20);
        
        if (!window.jspdf) {
            alert("PDF-Modul nicht geladen. Bitte Internetverbindung prüfen!");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        
        doc.setFont("helvetica");
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("CPR Assist - Einsatzprotokoll", 10, 20);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Datum: " + new Date().toLocaleDateString(), 10, 28);
        
        const uiStart = document.getElementById('start-time')?.innerText || '--:--';
        doc.text("Startzeit: " + uiStart.replace('Start: ', '').trim() + " Uhr", 10, 33);
        
        const state = window.CPR.AppState;
        if (state && state.isPediatric && state.patientWeight) {
            doc.text("Patient: Pädiatrie (" + state.patientWeight + " kg, " + (state.broselowColor || '').toUpperCase() + ")", 10, 38);
        } else {
            doc.text("Patient: Erwachsener", 10, 38);
        }

        doc.line(10, 42, 200, 42);

        const isShort = window.CPR.AppState?.protocolViewMode === 'summary';
        // HIER IST DER FIX: Objekte lesen statt Strings!
        const entries = window.CPR.AppState?.protocolData || [];
        
        let yPos = 50;

        if (isShort) {
            doc.setFont("helvetica", "bold");
            doc.text("SBAR UEBERGABE:", 10, yPos);
            yPos += 8;
            
            doc.setFont("helvetica", "normal");
            const summaryLines = doc.splitTextToSize(buildSummaryLog(entries), 190);
            doc.text(summaryLines, 10, yPos);
        } else {
            doc.setFont("helvetica", "bold");
            doc.text("VERLAUFS-PROTOKOLL:", 10, yPos);
            yPos += 8;
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            
            entries.forEach(entry => {
                if (yPos > 280) {
                    doc.addPage();
                    yPos = 20;
                }
                
                const iconMatch = getIconData(entry.action);
                // Sauberer Text, z.B.: "[ADR] 14:30:00 Uhr: Adrenalin (1 mg) gegeben"
                let lineStr = `[${iconMatch.icon}] ${entry.time} Uhr: ${entry.action}`;
                
                const split = doc.splitTextToSize(lineStr, 190);
                doc.text(split, 10, yPos);
                yPos += (split.length * 5);
            });
            
            doc.addPage();
            yPos = 20;
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text("ZUSAMMENFASSUNG (SBAR):", 10, yPos);
            yPos += 8;
            doc.setFont("helvetica", "normal");
            const summaryLines = doc.splitTextToSize(buildSummaryLog(entries), 190);
            doc.text(summaryLines, 10, yPos);
        }

        doc.save(`CPR_Protokoll_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.pdf`);
    }

    // --- 4. INIT / EVENT LISTENER ---
    function init() {
        document.addEventListener('click', function(e) {
            const btnRunTxt = e.target.closest('#btn-run-txt-export');
            if (btnRunTxt) {
                e.preventDefault(); e.stopPropagation();
                runTextExport();
                document.getElementById('export-modal')?.classList.replace('flex', 'hidden');
                return;
            }

            const btnRunPdf = e.target.closest('#btn-run-pdf-export');
            if (btnRunPdf) {
                e.preventDefault(); e.stopPropagation();
                runPdfExport();
                document.getElementById('export-modal')?.classList.replace('flex', 'hidden');
                return;
            }

            // Export Toggle Buttons (Short/Long)
            const btnShortLocal = e.target.closest('#btn-export-short');
            if (btnShortLocal) {
                e.preventDefault(); e.stopPropagation();
                if(window.CPR.Utils && window.CPR.Utils.vibrate) window.CPR.Utils.vibrate(20);
                const btnLong = document.getElementById('btn-export-long');
                if (btnLong) {
                    btnShortLocal.className = 'flex-1 py-2 rounded-lg text-[10px] font-black uppercase bg-white text-slate-800 shadow-sm border border-slate-200 transition-all';
                    btnLong.className = 'flex-1 py-2 rounded-lg text-[10px] font-black uppercase text-slate-500 border border-transparent transition-all';
                }
                if (window.CPR.AppState) window.CPR.AppState.protocolViewMode = 'summary';
                return;
            }

            const btnLongLocal = e.target.closest('#btn-export-long');
            if (btnLongLocal) {
                e.preventDefault(); e.stopPropagation();
                if(window.CPR.Utils && window.CPR.Utils.vibrate) window.CPR.Utils.vibrate(20);
                const btnShortLocal = document.getElementById('btn-export-short');
                if (btnShortLocal) {
                    btnLongLocal.className = 'flex-1 py-2 rounded-lg text-[10px] font-black uppercase bg-white text-slate-800 shadow-sm border border-slate-200 transition-all';
                    btnShortLocal.className = 'flex-1 py-2 rounded-lg text-[10px] font-black uppercase text-slate-500 border border-transparent transition-all';
                }
                if (window.CPR.AppState) window.CPR.AppState.protocolViewMode = 'timeline';
                return;
            }

            const btnCancel = e.target.closest('#btn-cancel-export');
            if (btnCancel) {
                e.preventDefault(); e.stopPropagation();
                const em = document.getElementById('export-modal');
                if (em) em.classList.replace('flex', 'hidden');
                return;
            }

            const btnExportLog = e.target.closest('#btn-export-log');
            if (btnExportLog) { e.preventDefault(); e.stopPropagation(); document.getElementById('export-modal')?.classList.replace('hidden', 'flex'); return; }
            
            const btnDebriefExport = e.target.closest('#btn-debrief-export');
            if (btnDebriefExport) { e.preventDefault(); e.stopPropagation(); document.getElementById('export-modal')?.classList.replace('hidden', 'flex'); return; }
        });
    }

    return { init: init };

})();

document.addEventListener('DOMContentLoaded', () => { setTimeout(() => { if (window.CPR && window.CPR.Export) window.CPR.Export.init(); }, 150); });
