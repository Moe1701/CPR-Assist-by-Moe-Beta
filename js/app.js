/**
 * CPR Assist - Main App Controller (V62 - Entkoppelte Timer)
 * - FEATURE: Einsatzzeit startet sofort bei Patientenauswahl (Erwachsener/Kind).
 * - FEATURE: CCF-Berechnung und Arrest-Timer starten erst bei "Kompression Bestätigen".
 */

window.CPR = window.CPR || {};

window.CPR.AppState = {
    totalSeconds: 0,        // Gesamte Einsatzzeit (Startet bei Patientenauswahl)
    arrestSeconds: 0,       // Reanimationszeit (Startet bei Kompression)
    compressingSeconds: 0,  // Aktive Massagezeit
    
    isEinsatzAktiv: false,  // True, sobald Patient gewählt
    isCprAktiv: false,      // True, sobald erste Kompression bestätigt
    isCompressing: false,   // True, wenn aktiv gedrückt wird
    isRosc: false,          // True, wenn ROSC gemeldet
    
    patientType: null,      // 'adult' oder 'pediatric'
    patientWeight: null,    
    isPediatric: false,
    
    shockCount: 0,
    adrCount: 0,
    amioCount: 0,
    
    timerInterval: null,
    protocolData: [],
    anamneseData: { sampler: {} }
};

window.CPR.App = (function() {
    const state = window.CPR.AppState;
    const Utils = window.CPR.Utils;

    // --- 1. INITIALISIERUNG ---
    function init() {
        bindOnboardingEvents();
        bindControlEvents();
    }

    // --- 2. ONBOARDING & TIMER START ---
    function bindOnboardingEvents() {
        // Patientenauswahl (EINSATZ STARTET HIER!)
        const btnAdult = document.getElementById('btn-start-adult');
        const btnChild = document.getElementById('btn-start-child'); // Falls direktes Kind-Setup genutzt wird
        const btnPediStart = document.getElementById('btn-start-pediatric'); // Aus dem Pädiatrie-Modal
        const btnPediUnknown = document.getElementById('btn-start-pediatric-unknown');

        if (btnAdult) {
            btnAdult.addEventListener('click', () => {
                if (Utils.vibrate) Utils.vibrate(30);
                state.patientType = 'adult';
                state.isPediatric = false;
                startEinsatz(); // Startet die Gesamtzeit!
                transitionToInitBreathsOrCpr();
            });
        }

        // Pädiatrie Start-Buttons (aus dem Modal)
        const startPedi = (weight) => {
            if (Utils.vibrate) Utils.vibrate(30);
            state.patientType = 'pediatric';
            state.isPediatric = true;
            state.patientWeight = weight;
            document.getElementById('patient-setup-modal').classList.add('hidden');
            
            // Pädiatrie-Badge im Dashboard aktivieren
            const badge = document.getElementById('btn-pediatric-edit');
            const weightDisplay = document.getElementById('pediatric-weight-display');
            if (badge && weightDisplay) {
                badge.classList.remove('hidden');
                weightDisplay.innerText = weight ? `${weight} kg` : 'Unbek.';
            }

            startEinsatz(); // Startet die Gesamtzeit!
            transitionToInitBreathsOrCpr();
        };

        if (btnPediStart) btnPediStart.addEventListener('click', () => {
            const kgInput = document.getElementById('exact-kg-input');
            startPedi(kgInput ? parseFloat(kgInput.value) : null);
        });

        if (btnPediUnknown) btnPediUnknown.addEventListener('click', () => {
            startPedi(null);
        });

        // 5 Initiale Beatmungen Buttons
        document.getElementById('btn-breaths-done')?.addEventListener('click', () => {
            if (Utils.vibrate) Utils.vibrate(20);
            Utils.logEvent("5 Initiale Beatmungen durchgeführt");
            transitionToCprConfirm();
        });
        document.getElementById('btn-breaths-skipped')?.addEventListener('click', () => {
            if (Utils.vibrate) Utils.vibrate(10);
            Utils.logEvent("5 Initiale Beatmungen übersprungen");
            transitionToCprConfirm();
        });

        // Kompression Bestätigen (CPR / CCF STARTET HIER!)
        document.getElementById('btn-confirm-cpr')?.addEventListener('click', () => {
            if (Utils.vibrate) Utils.vibrate([30, 50, 30]); // Starkes Feedback
            startCPR(); // Startet die CCF Berechnung!
            
            // Gehe zum Dashboard / Initiale Analyse
            document.getElementById('view-ob-2').classList.add('hidden');
            document.getElementById('view-ob-3').classList.remove('hidden'); // Initiale Analyse Ansicht zeigen
            
            // Aktiviere das Dashboard Layout (Kreis schrumpft etc.)
            document.body.classList.add('dashboard-active');
            
            // Benachrichtige UI/CprTimer, dass die UI aufgebaut werden kann
            if (window.CPR.UI && window.CPR.UI.openCenterMenu) {
                setTimeout(() => { window.CPR.UI.openCenterMenu('view-ob-3'); }, 50);
            }
        });
    }

    function transitionToInitBreathsOrCpr() {
        document.getElementById('view-ob-1').classList.add('hidden');
        if (state.isPediatric) {
            document.getElementById('view-initial-breaths').classList.remove('hidden');
        } else {
            transitionToCprConfirm();
        }
    }

    function transitionToCprConfirm() {
        document.getElementById('view-initial-breaths')?.classList.add('hidden');
        document.getElementById('view-ob-2').classList.remove('hidden');
    }

    // --- 3. DIE ZWEI UNABHÄNGIGEN TIMER ---
    
    // START 1: Die Einsatzzeit (Gesamtdauer)
    function startEinsatz() {
        if (state.isEinsatzAktiv) return;
        state.isEinsatzAktiv = true;
        state.totalSeconds = 0;
        
        // Echte Uhrzeit oben links setzen
        const now = new Date();
        const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        const startTimeEl = document.getElementById('start-time');
        if (startTimeEl) startTimeEl.innerText = `Start: ${timeStr}`;

        // Top Stats einblenden
        document.getElementById('top-stats-container').classList.remove('opacity-0', 'pointer-events-none');
        
        Utils.logEvent(`Einsatz gestartet (${state.isPediatric ? 'Kind' : 'Erwachsener'})`);
        
        // Master Loop starten
        state.timerInterval = setInterval(mainTick, 1000);
    }

    // START 2: Die Reanimationszeit (CCF)
    function startCPR() {
        if (state.isCprAktiv) return;
        state.isCprAktiv = true;
        state.arrestSeconds = 0;
        state.compressingSeconds = 0;
        state.isCompressing = true; // Wir gehen davon aus, dass gedrückt wird
        
        Utils.logEvent("Start Reanimation (Thoraxkompression)");
        
        // Starte den visuellen Metronom/CPR Timer (falls Modul existiert)
        if (window.CPR.CprTimer) {
            window.CPR.CprTimer.start();
        }
    }

    // DER MASTER LOOP (Läuft jede Sekunde)
    function mainTick() {
        if (!state.isEinsatzAktiv) return;

        // 1. Einsatzuhr läuft immer weiter (außer bei komplettem Reset)
        state.totalSeconds++;
        updateTopTimerUI(state.totalSeconds, 'main-timer');

        // 2. CCF & Arrest Uhr läuft NUR, wenn CPR aktiv ist und KEIN ROSC gemeldet wurde
        if (state.isCprAktiv && !state.isRosc) {
            state.arrestSeconds++;
            
            // Wenn gerade aktiv gedrückt wird (wird über CprTimer/UI gesteuert)
            if (state.isCompressing) {
                state.compressingSeconds++;
            }
            
            updateCcfUI();
        }
    }

    // --- 4. UI UPDATES ---
    function updateTopTimerUI(seconds, elementId) {
        const el = document.getElementById(elementId);
        if (el) {
            el.innerText = Utils.formatTime(seconds);
        }
    }

    function updateCcfUI() {
        const ccfDisplay = document.getElementById('ccf-display');
        if (!ccfDisplay) return;

        if (state.arrestSeconds === 0) {
            ccfDisplay.innerText = "100%";
            ccfDisplay.className = "text-2xl sm:text-3xl font-black text-emerald-500 tracking-tight leading-none";
            return;
        }

        const ccf = Math.round((state.compressingSeconds / state.arrestSeconds) * 100);
        ccfDisplay.innerText = `${ccf}%`;

        // Farbe je nach Performance
        if (ccf >= 80) {
            ccfDisplay.className = "text-2xl sm:text-3xl font-black text-emerald-500 tracking-tight leading-none";
        } else if (ccf >= 60) {
            ccfDisplay.className = "text-2xl sm:text-3xl font-black text-amber-500 tracking-tight leading-none";
        } else {
            ccfDisplay.className = "text-2xl sm:text-3xl font-black text-[#E3000F] tracking-tight leading-none";
        }
    }

    // --- 5. SONSTIGE KONTROLLEN (ROSC etc.) ---
    function bindControlEvents() {
        // ROSC Melden
        document.getElementById('btn-opt-rosc')?.addEventListener('click', () => {
            if (Utils.vibrate) Utils.vibrate([30, 50, 30]);
            state.isRosc = true;
            state.isCompressing = false; // Sicherheitshalber stoppen
            Utils.logEvent("ROSC!");
            
            // UI Switch (Dashboard weg, ROSC Ansicht rein)
            document.getElementById('cpr-interface').classList.add('hidden');
            document.getElementById('rosc-interface').classList.remove('hidden');
            document.getElementById('stat-ccf').classList.add('hidden');
            document.getElementById('stat-rosc').classList.remove('hidden');
            document.getElementById('stat-rosc').classList.add('flex');
            
            // Wenn LogTimeline da ist, direkt updaten
            if (window.CPR.LogTimeline) window.CPR.LogTimeline.forceRender();
        });

        // Re-Arrest
        document.getElementById('btn-rearrest')?.addEventListener('click', () => {
            if (Utils.vibrate) Utils.vibrate([50, 50, 50]);
            state.isRosc = false;
            state.isCompressing = true; // Geht direkt wieder los
            Utils.logEvent("RE-ARREST (CPR fortgesetzt)");
            
            // UI Switch zurück
            document.getElementById('rosc-interface').classList.add('hidden');
            document.getElementById('cpr-interface').classList.remove('hidden');
            document.getElementById('stat-rosc').classList.add('hidden');
            document.getElementById('stat-rosc').classList.remove('flex');
            document.getElementById('stat-ccf').classList.remove('hidden');
            
            // Zurück ins laufende CPR Dashboard
            if (window.CPR.UI) {
                document.body.classList.remove('center-menu-open');
                window.CPR.UI.closeCenterMenu();
            }
        });

        // Abbruch
        document.getElementById('btn-reason-team')?.addEventListener('click', () => triggerAbbruch('Teamentscheidung'));
        document.getElementById('btn-reason-family')?.addEventListener('click', () => triggerAbbruch('Angehörige'));
        document.getElementById('btn-reason-doc')?.addEventListener('click', () => triggerAbbruch('Patientenverfügung'));
    }

    function triggerAbbruch(grund) {
        if (Utils.vibrate) Utils.vibrate([30, 30, 30]);
        state.isRosc = true; // Stoppt die CCF
        clearInterval(state.timerInterval); // Stoppt die Gesamtzeit
        Utils.logEvent(`Einsatz Abbruch: ${grund}`);
        
        // Debriefing Modal anzeigen
        const debriefModal = document.getElementById('debriefing-modal');
        if (debriefModal) {
            debriefModal.classList.remove('hidden');
            debriefModal.classList.add('flex');
            
            document.getElementById('debrief-duration').innerText = Utils.formatTime(state.totalSeconds) + ' Min';
            const finalCcf = state.arrestSeconds > 0 ? Math.round((state.compressingSeconds / state.arrestSeconds) * 100) : 0;
            document.getElementById('debrief-ccf').innerText = finalCcf + '%';
            document.getElementById('debrief-shocks').innerText = state.shockCount || 0;
            document.getElementById('debrief-adr').innerText = state.adrCount || 0;
        }
    }

    return { init };
})();

// Start the App logic
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.CPR && window.CPR.App) window.CPR.App.init();
    }, 100);
});
