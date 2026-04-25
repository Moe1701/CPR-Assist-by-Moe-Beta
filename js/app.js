/**
 * CPR Assist - Master Controller (Medical Grade Background-Safe)
 * - PING-PONG: Das dynamische Zusammenspiel zwischen CPR und Beatmung ist aktiv!
 * - UI UPGRADE: Millimetergenaue Y-Positionen verhindern jedes Herausrutschen!
 * - LOGIC FIX: Timer schaltet nicht mehr automatisch um, sondern eskaliert!
 * - ARCHITECTURE: Satelliten werden beim Öffnen von Menüs global im CSS ausgeblendet!
 * - CLEANUP: Überlässt der log-timeline.js die volle Kontrolle über die Tabs.
 */

document.addEventListener('DOMContentLoaded', function() {
    const CPR = window.CPR;
    const { CONFIG, Globals, AppState, broselowData, Utils, UI, Audio: AudioEngine } = CPR;

    // =========================================================
    // 🌟 ABSOLUT-POSITIONIERUNG für den Timer Screen
    // =========================================================
    function remodelViewTimer() {
        const vt = document.getElementById('view-timer');
        if (vt) {
            vt.className = "hidden flex-col items-center justify-center w-full h-full text-center relative pointer-events-none";
            const shocks = AppState.shockCount || 0;
            
            vt.innerHTML = `
                <!-- 1. Top: Bei Analyse drücken -->
                <div class="vt-top-text">
                    <span id="timer-top-text">Bei Analyse drücken</span>
                </div>

                <!-- 2. Mitte: Der Timer -->
                <div id="cycle-timer" class="vt-timer-display" style="font-variant-numeric: tabular-nums;">
                    ${Utils.formatTime(AppState.cycleSeconds || 0)}
                </div>

                <!-- 3. Bottom: Schock & Joule Info -->
                <div class="vt-bottom-info">
                    <div class="vt-info-badge">
                        <i class="fa-solid fa-bolt text-amber-500 mr-1.5 text-lg"></i>
                        <span><span id="rhythm-info-shocks">${shocks}</span>x Schocks</span>
                        <span class="text-slate-300 mx-2">|</span>
                        <span class="text-[#E3000F]"><span id="rhythm-info-joule">${getEnergy()} J</span></span>
                    </div>
                </div>

                <!-- Alarme (Absolut oben) -->
                <div class="absolute top-[10px] w-full flex flex-col items-center pointer-events-none gap-1 z-30">
                    <div id="inner-prepare-alert" class="hidden bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest animate-pulse items-center gap-1.5 shadow-sm"><i class="fa-solid fa-hand-holding-medical text-xs"></i> Puls tasten (<span id="prepare-time">30</span>s)</div>
                    <div id="inner-precharge-alert" class="hidden bg-amber-400 text-black border border-amber-500 px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest animate-pulse items-center gap-1.5 shadow-sm"><i class="fa-solid fa-bolt text-xs"></i> PRECHARGE (<span id="precharge-time">15</span>s)</div>
                    <div id="inner-analyze-alert" class="hidden bg-[#E3000F] text-white border border-red-600 px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest animate-pulse items-center gap-1.5 shadow-sm"><i class="fa-solid fa-heart-pulse text-xs"></i> HÄNDE WEG</div>
                </div>
            `;
        }
    }

    // =========================================================
    // 🌟 ENERGIE-BERECHNUNG (2J/kg bzw. max 200J)
    // =========================================================
    function getEnergy() {
        if (!AppState.isPediatric || !AppState.patientWeight) return 200;
        let kg = AppState.patientWeight;
        let j = Math.round(kg * 2);
        const stufen = [2, 4, 6, 8, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 150, 170, 200];
        let c = stufen[0];
        for (let i = 1; i < stufen.length; i++) {
            if (Math.abs(stufen[i] - j) < Math.abs(c - j)) c = stufen[i];
        }
        if (c > 200) return 200;
        return c;
    }

    // =========================================================
    // 🌟 PÄDIATRIE LOGIK
    // =========================================================
    function updateBroselow(btn) {
        document.querySelectorAll('.broselow-btn').forEach(b => {
            b.classList.remove('border-4', 'border-slate-800', 'scale-105', 'shadow-lg', 'z-10');
            b.classList.add('border-transparent');
        });
        if(btn) {
            btn.classList.add('border-4', 'border-slate-800', 'scale-105', 'shadow-lg', 'z-10');
            btn.classList.remove('border-transparent');
            const data = broselowData.find(d => d.color === btn.dataset.color);
            if (data) {
                document.getElementById('slider-kg').value = data.avgKg;
                document.getElementById('slider-age').value = data.avgKg < 10 ? 0 : (data.avgKg < 20 ? 1 : 2);
                document.getElementById('slider-cm').value = data.cm;
                updatePediatricSliders();
            }
        }
    }

    function updatePediatricSliders() {
        const kg = parseInt(document.getElementById('slider-kg').value);
        let color = broselowData[0].color;
        let name = broselowData[0].color.toUpperCase();
        
        for (const d of broselowData) {
            if (kg >= d.minKg && kg <= d.maxKg) { color = d.color; name = d.color.toUpperCase(); break; }
        }
        
        let ageLabel = "";
        const ageVal = parseInt(document.getElementById('slider-age').value);
        if (ageVal <= 1) ageLabel = "Säugling (< 1 J.)";
        else if (ageVal <= 7) ageLabel = "Kleinkind (1-7 J.)";
        else ageLabel = "Schulkind (> 8 J.)";
        
        document.getElementById('val-age').innerText = ageLabel;
        document.getElementById('exact-kg-input').value = kg;
        document.getElementById('val-cm').innerText = document.getElementById('slider-cm').value + " cm";
        
        document.querySelectorAll('.broselow-btn').forEach(b => {
            b.classList.remove('border-4', 'border-slate-800', 'scale-105', 'shadow-lg', 'z-10');
            if (b.dataset.color === color) b.classList.add('border-4', 'border-slate-800', 'scale-105', 'shadow-lg', 'z-10');
        });
    }

    function startPediatric(knownWeight) {
        AppState.isPediatric = true;
        AppState.patientWeight = knownWeight ? parseInt(document.getElementById('exact-kg-input').value) : null;
        
        if (knownWeight) {
            const data = broselowData.find(d => AppState.patientWeight >= d.minKg && AppState.patientWeight <= d.maxKg) || broselowData[0];
            AppState.broselowColor = data.color;
            if (window.addLogEntry) window.addLogEntry("Start PÄDIATRIE (" + AppState.patientWeight + " kg, " + data.color.toUpperCase() + ")");
            const d = document.getElementById('pediatric-weight-display');
            if (d) { d.innerText = AppState.patientWeight + " kg"; d.parentNode.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'border-red-300', 'animate-pulse'); d.parentNode.classList.add('bg-blue-100', 'text-blue-700', 'border-blue-300'); }
        } else {
            AppState.broselowColor = null;
            if (window.addLogEntry) window.addLogEntry("Start PÄDIATRIE (Gewicht unbekannt)");
            const d = document.getElementById('pediatric-weight-display');
            if (d) { d.innerText = "FEHLT!"; d.parentNode.classList.remove('hidden'); }
        }
        
        document.getElementById('patient-setup-modal').classList.add('hidden');
        document.getElementById('patient-setup-modal').classList.remove('flex');
        
        UI.switchView('initial-breaths');
    }

    const modalSliders = ['slider-age', 'slider-kg', 'slider-cm'];
    modalSliders.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updatePediatricSliders);
    });

    const exactKgInput = document.getElementById('exact-kg-input');
    if (exactKgInput) {
        exactKgInput.addEventListener('change', (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val) || val < 1) val = 1;
            if (val > 40) val = 40;
            document.getElementById('slider-kg').value = val;
            updatePediatricSliders();
        });
    }

    document.querySelectorAll('.broselow-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.preventDefault(); if (Utils.vibrate) Utils.vibrate(20); updateBroselow(btn); });
    });
    
    document.getElementById('btn-start-adult')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        AppState.isPediatric = false;
        AppState.patientWeight = null;
        document.getElementById('pediatric-weight-display')?.parentNode.classList.add('hidden');
        if (window.addLogEntry) window.addLogEntry("Start ERWACHSENER");
        AppState.cprMode = '30:2';
        UI.switchView('ob-2');
        showMainInterface();
        if(CPR.AirwayTimer) CPR.AirwayTimer.stop();
        AppState.previousState = 'IDLE';
        AppState.state = 'COMPRESSING';
        syncToState();
    });

    document.getElementById('btn-start-child')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        const m = document.getElementById('patient-setup-modal');
        m.classList.remove('hidden'); m.classList.add('flex');
        setTimeout(updatePediatricSliders, 50);
        AppState.cprMode = '15:2';
    });

    document.getElementById('btn-close-pedi-modal')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        document.getElementById('patient-setup-modal').classList.add('hidden');
        document.getElementById('patient-setup-modal').classList.remove('flex');
    });

    document.getElementById('btn-start-pediatric')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20); startPediatric(true);
    });

    document.getElementById('btn-start-pediatric-unknown')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20); startPediatric(false);
    });

    document.getElementById('btn-pediatric-edit')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        document.getElementById('patient-setup-modal').classList.remove('hidden');
        document.getElementById('patient-setup-modal').classList.add('flex');
        setTimeout(updatePediatricSliders, 50);
    });

    // =========================================================
    // 🌟 UI STEUERUNG & INITIALE BEATMUNGEN
    // =========================================================
    function showMainInterface() {
        document.getElementById('top-stats-container').classList.remove('hidden');
        document.getElementById('satellites').classList.remove('hidden');
        document.getElementById('btn-airway').style.opacity = '1';
        document.getElementById('btn-cpr').style.opacity = '1';
        UI.updateModeSlider();
        if(window.CPR.MedsButton && typeof window.CPR.MedsButton.init === 'function') window.CPR.MedsButton.init();
    }

    document.getElementById('btn-breaths-done')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        if (window.addLogEntry) window.addLogEntry("5 initiale Beatmungen");
        UI.switchView('ob-2');
        showMainInterface();
        if(CPR.AirwayTimer) CPR.AirwayTimer.stop();
        AppState.previousState = 'IDLE';
        AppState.state = 'COMPRESSING';
        syncToState();
    });

    document.getElementById('btn-breaths-skipped')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        if (window.addLogEntry) window.addLogEntry("Initiale Beatmungen übersprungen");
        UI.switchView('ob-2');
        showMainInterface();
        if(CPR.AirwayTimer) CPR.AirwayTimer.stop();
        AppState.previousState = 'IDLE';
        AppState.state = 'COMPRESSING';
        syncToState();
    });

    // =========================================================
    // 🌟 ZENTRALE STATE-MACHINE (PING-PONG)
    // =========================================================
    function syncToState() {
        const mainEl = document.getElementById('main-btn-area');
        const cprBtn = document.getElementById('btn-cpr');
        const awBtn = document.getElementById('btn-airway');
        if (!mainEl || !cprBtn || !awBtn) return;

        // CPR-Button Reset
        cprBtn.classList.remove('border-[#E3000F]', 'bg-red-50', 'border-cyan-400', 'bg-cyan-50', 'border-amber-400', 'bg-amber-50');
        cprBtn.classList.add('border-slate-100', 'bg-white');
        document.getElementById('cpr-icon-normal').classList.add('hidden');
        document.getElementById('cpr-icon-pause').classList.add('hidden');
        document.getElementById('cpr-icon-vent').classList.add('hidden');
        
        // Airway-Button Reset
        awBtn.classList.remove('border-[#E3000F]', 'shadow-[0_0_20px_rgba(227,0,15,0.4)]');
        awBtn.classList.add('border-cyan-100');
        const awGlow = document.getElementById('aw-glow-bg');
        if (awGlow) { awGlow.style.opacity = '0'; awGlow.classList.remove('animate-pulse'); }
        const awIcon = document.getElementById('aw-icon');
        if (awIcon) awIcon.classList.remove('text-[#E3000F]', 'text-cyan-600', 'animate-pulse');
        const awLabel = document.getElementById('airway-label');
        if (awLabel) awLabel.classList.remove('text-[#E3000F]');

        // Wenn ein Menu offen ist -> Satelliten & Side-Buttons ausblenden
        const activeView = Array.from(mainEl.children).find(c => !c.classList.contains('hidden') && c.id.startsWith('view-'));
        const isMenuOpen = activeView && ['view-meds-menu', 'view-airway', 'view-zugang', 'view-rosc-end', 'view-abbruch-reason', 'view-airway-doc'].includes(activeView.id);
        
        if (isMenuOpen) {
            document.body.classList.add('menu-active');
            cprBtn.style.opacity = '0';
            cprBtn.style.pointerEvents = 'none';
            awBtn.style.opacity = '0';
            awBtn.style.pointerEvents = 'none';
        } else {
            document.body.classList.remove('menu-active');
            cprBtn.style.opacity = '1';
            cprBtn.style.pointerEvents = 'auto';
            awBtn.style.opacity = '1';
            awBtn.style.pointerEvents = 'auto';
        }

        switch (AppState.state) {
            case 'IDLE':
                document.getElementById('cpr-main-text').innerText = "CPR START";
                document.getElementById('cpr-icon-normal').classList.remove('hidden');
                document.getElementById('cpr-icon-normal').classList.replace('text-amber-500', 'text-emerald-500');
                if (CPR.CPRTimer) CPR.CPRTimer.pause();
                break;

            case 'COMPRESSING':
                document.getElementById('cpr-main-text').innerText = "PAUSE";
                document.getElementById('cpr-icon-pause').classList.remove('hidden');
                cprBtn.classList.replace('border-slate-100', 'border-[#E3000F]');
                cprBtn.classList.replace('bg-white', 'bg-red-50');
                
                if (CPR.CPRTimer && !CPR.CPRTimer.isRunning()) CPR.CPRTimer.start();
                if (AudioEngine && AppState.isSoundActive) AudioEngine.playMetronomeTick(AudioEngine.ctx ? AudioEngine.ctx.currentTime : 0);
                
                if (AppState.cprMode === 'KONT') {
                    if (CPR.AirwayTimer) CPR.AirwayTimer.start();
                } else {
                    if (CPR.AirwayTimer) CPR.AirwayTimer.stop();
                }
                break;

            case 'VENTILATING':
                document.getElementById('cpr-main-text').innerText = "CPR FORTSETZEN";
                document.getElementById('cpr-icon-normal').classList.remove('hidden');
                document.getElementById('cpr-icon-normal').classList.replace('text-emerald-500', 'text-amber-500');
                
                cprBtn.classList.replace('border-slate-100', 'border-amber-400');
                cprBtn.classList.replace('bg-white', 'bg-amber-50');
                
                // Der Airway-Button MUSS rot blinken, damit man dorthin drückt!
                awBtn.classList.replace('border-cyan-100', 'border-[#E3000F]');
                awBtn.classList.add('shadow-[0_0_20px_rgba(227,0,15,0.4)]');
                if (awGlow) { awGlow.style.opacity = '0.3'; awGlow.classList.add('animate-pulse'); }
                if (awIcon) awIcon.classList.add('text-[#E3000F]', 'animate-pulse');
                if (awLabel) awLabel.classList.add('text-[#E3000F]');
                
                if (CPR.CPRTimer) CPR.CPRTimer.pause();
                if (CPR.AirwayTimer) CPR.AirwayTimer.stop();
                break;
        }

        UI.updateGlobalUI();
        if (Utils.saveSession) Utils.saveSession();
    }

    // =========================================================
    // 🌟 CPR BUTTON LOGIK (Herzstück)
    // =========================================================
    document.getElementById('btn-cpr')?.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (Utils.vibrate) Utils.vibrate(20);

        // 1. Wenn wir gerade gestartet haben (View OB-2)
        const v2 = document.getElementById('view-ob-2');
        if (v2 && !v2.classList.contains('hidden')) {
            UI.switchView('ob-3');
            return;
        }

        // 2. State-Machine Schaltung (PING-PONG)
        if (AppState.state === 'IDLE' || AppState.state === 'VENTILATING') {
            AppState.previousState = AppState.state;
            AppState.state = 'COMPRESSING';
            if (window.addLogEntry) window.addLogEntry("CPR Fortgesetzt");
            
            // Verhindert Hänger im UI
            const vt = document.getElementById('view-timer');
            const vc = document.getElementById('view-cpr-resume');
            if (vc && !vc.classList.contains('hidden') && vt) {
                UI.switchView('timer');
            }
            syncToState();
            return;
        }

        if (AppState.state === 'COMPRESSING') {
            if (AppState.cprMode === 'KONT') {
                AppState.previousState = 'COMPRESSING';
                AppState.state = 'IDLE';
                if (window.addLogEntry) window.addLogEntry("CPR Pausiert");
                syncToState();
            } else {
                AppState.previousState = 'COMPRESSING';
                AppState.state = 'VENTILATING';
                if (window.addLogEntry) window.addLogEntry("CPR Pausiert (Beatmung)");
                syncToState();
            }
        }
    });

    document.getElementById('btn-confirm-cpr')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        UI.switchView('ob-3');
    });

    document.getElementById('view-ob-3')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        UI.switchView('decision');
        if (window.addLogEntry) window.addLogEntry("Rhythmusanalyse gestartet");
    });

    // =========================================================
    // 🌟 ENTSCHEIDUNG: SCHOCKBAR / NICHT SCHOCKBAR
    // =========================================================
    document.getElementById('btn-shockable')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        AppState.isShockable = true;
        remodelViewTimer();
        
        const mainEl = document.getElementById('main-btn-area');
        if (mainEl) mainEl.style.boxShadow = '0 0 40px rgba(227,0,15,0.4)';
        
        UI.switchView('joule');
        const jc = document.getElementById('joule-container');
        if (jc) {
            jc.innerHTML = '';
            if (AppState.isPediatric && AppState.patientWeight) {
                const recommended = getEnergy();
                jc.innerHTML = `
                    <div class="bg-red-50 p-3 rounded-2xl border-2 border-red-200 mb-2 flex justify-between items-center shadow-sm">
                        <span class="text-[10px] font-black text-red-700 uppercase tracking-widest"><i class="fa-solid fa-child"></i> Berechnet (2J/kg)</span>
                        <span class="text-xl font-black text-[#E3000F]">${recommended} J</span>
                    </div>
                `;
            }
            [150, 200, 360].forEach(j => {
                const b = document.createElement('button');
                b.className = 'w-full py-4 text-center border-2 border-slate-100 rounded-2xl text-xl font-black text-slate-700 mb-1 active:scale-95 transition-all bg-white shadow-sm hover:border-red-200';
                b.innerHTML = `<i class="fa-solid fa-bolt text-red-400 mr-2 opacity-50"></i> ${j} Joule`;
                b.onclick = () => {
                    if (Utils.vibrate) Utils.vibrate(50);
                    AppState.shockCount = (AppState.shockCount || 0) + 1;
                    if (window.addLogEntry) window.addLogEntry(`Schock (${j} J) abgegeben`);
                    
                    if (CPR.CPRTimer) CPR.CPRTimer.reset();
                    if (CPR.AdrTimer) {
                        const state = CPR.AppState;
                        const t = (state.adrCount || 0) > 0 ? (state.adrSeconds || 0) : 0;
                        if (t === 0 || t >= (CONFIG.ADR_INTERVAL || 240)) {
                            CPR.AdrTimer.start();
                        }
                    }
                    
                    UI.switchView('cpr-resume');
                };
                jc.appendChild(b);
            });
        }
    });

    document.getElementById('btn-non-shockable')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        AppState.isShockable = false;
        remodelViewTimer();
        
        const mainEl = document.getElementById('main-btn-area');
        if (mainEl) mainEl.style.boxShadow = '';
        
        if (window.addLogEntry) window.addLogEntry("Rhythmus: Nicht Schockbar");
        
        if (CPR.CPRTimer) CPR.CPRTimer.reset();
        if (CPR.AdrTimer) {
            const state = CPR.AppState;
            const t = (state.adrCount || 0) > 0 ? (state.adrSeconds || 0) : 0;
            if (t === 0 || t >= (CONFIG.ADR_INTERVAL || 240)) {
                CPR.AdrTimer.start();
            }
        }
        
        UI.switchView('cpr-resume');
    });

    document.getElementById('btn-decision-cancel')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        UI.switchView('timer');
    });

    document.getElementById('btn-joule-cancel')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        UI.switchView('decision');
    });

    document.getElementById('btn-confirm-resume')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        UI.switchView('timer');
        AppState.previousState = AppState.state;
        AppState.state = 'COMPRESSING';
        if (window.addLogEntry) window.addLogEntry("CPR Fortgesetzt");
        syncToState();
    });

    // =========================================================
    // 🌟 TIMER CYCLE LOGIK (PERMANENT BUTTON)
    // =========================================================
    document.getElementById('view-timer')?.addEventListener('click', (e) => {
        const btn = e.target.closest('#btn-permanent-analyze');
        if (!btn) return;
        
        e.preventDefault(); e.stopPropagation();
        if (Utils.vibrate) Utils.vibrate(20);
        
        const topText = document.getElementById('timer-top-text');
        
        if (topText && topText.innerText.includes("HÄNDE WEG")) {
            // Eskalations-Stufe 3 -> Wirft den User in die Decision
            UI.switchView('decision');
            if (window.addLogEntry) window.addLogEntry("Rhythmusanalyse gestartet");
        } else {
            // Egal in welchem Timer-Stadium -> Forciert die Pause!
            if (AppState.state === 'COMPRESSING') {
                AppState.previousState = 'COMPRESSING';
                AppState.state = 'IDLE';
                if (window.addLogEntry) window.addLogEntry("CPR Pausiert (Für Analyse)");
                syncToState();
            }
        }
    });

    // =========================================================
    // 🌟 AIRWAY BUTTON: PING-PONG LÖSUNG & MENÜ
    // =========================================================
    document.getElementById('btn-airway')?.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (Utils.vibrate) Utils.vibrate(20);

        if (AppState.state === 'VENTILATING' && AppState.cprMode !== 'KONT') {
            // PING-PONG: Von Beatmung ZURÜCK zur Kompression!
            AppState.previousState = 'VENTILATING';
            AppState.state = 'COMPRESSING';
            if (window.addLogEntry) window.addLogEntry("Beatmungen durchgeführt, CPR fortgesetzt");
            syncToState();
            return;
        }

        // Wenn nicht im Ping-Pong -> Standard Airway Menü öffnen!
        UI.switchView('airway');
        syncToState();
    });

    document.getElementById('btn-airway-cancel')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        UI.switchView('timer');
        syncToState();
    });

    document.getElementById('btn-meds-cancel')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        UI.switchView('timer');
        syncToState();
    });

    document.getElementById('btn-zugang-menu')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        UI.switchView('zugang');
        syncToState();
    });

    document.getElementById('btn-zugang-cancel')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        UI.switchView('timer');
        syncToState();
    });

    document.getElementById('btn-zugang-save')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        const typ = document.getElementById('zugang-typ').value;
        const o = document.getElementById('zugang-ort').value;
        const g = document.getElementById('zugang-groesse').value;
        const txt = `${typ} ${o} (${g})`;
        
        document.getElementById('zugang-label').innerText = "Zugang liegt";
        const btn = document.getElementById('btn-zugang-menu');
        if (btn) {
            btn.classList.remove('border-indigo-100', 'text-slate-500');
            btn.classList.add('border-indigo-400', 'text-indigo-600', 'bg-indigo-50');
            const icon = btn.querySelector('i');
            if(icon) {
                icon.classList.remove('fa-droplet', 'text-slate-400');
                icon.classList.add('fa-syringe', 'text-indigo-500');
            }
        }
        
        if (window.addLogEntry) window.addLogEntry("Zugang: " + txt);
        UI.switchView('timer');
        syncToState();
    });

    document.getElementById('btn-rosc-end')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        UI.switchView('rosc-end');
        syncToState();
    });

    document.getElementById('btn-rosc-cancel')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        UI.switchView('timer');
        syncToState();
    });

    document.getElementById('btn-opt-abbruch')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        UI.switchView('abbruch-reason');
    });

    document.getElementById('btn-abbruch-cancel')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        UI.switchView('rosc-end');
    });

    function doAbbruch(reason) {
        AppState.previousState = AppState.state;
        AppState.state = 'IDLE';
        if (CPR.CPRTimer) CPR.CPRTimer.pause();
        if (window.addLogEntry) window.addLogEntry("Abbruch: " + reason);
        if (Utils.saveSession) Utils.saveSession();
        
        document.getElementById('debrief-duration').innerText = Utils.formatTime(AppState.totalSeconds || 0);
        document.getElementById('debrief-ccf').innerText = (AppState.totalSeconds > 0) ? Math.round((AppState.compressingSeconds / AppState.totalSeconds) * 100) + "%" : "0%";
        document.getElementById('debrief-shocks').innerText = AppState.shockCount || 0;
        document.getElementById('debrief-adr').innerText = (AppState.adrCount || 0) + " mg";
        
        document.getElementById('debriefing-modal').classList.remove('hidden');
        document.getElementById('debriefing-modal').classList.add('flex');
    }

    document.getElementById('btn-reason-team')?.addEventListener('click', () => doAbbruch('Teamentscheidung'));
    document.getElementById('btn-reason-family')?.addEventListener('click', () => doAbbruch('Wunsch der Angehörigen'));
    document.getElementById('btn-reason-doc')?.addEventListener('click', () => doAbbruch('Patientenverfügung'));

    // --- ROSC UPDATE ---
    document.getElementById('btn-opt-rosc')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(50);
        AppState.previousState = AppState.state;
        AppState.state = 'IDLE';
        if (CPR.CPRTimer) CPR.CPRTimer.pause();
        
        // CHIRURGISCHER EINGRIFF: Hier wird die Zeit sauber ins Protokoll geschrieben!
        if (window.addLogEntry) {
            const m = Math.floor((window.CPR.AppState.totalSeconds || 0) / 60);
            const s = (window.CPR.AppState.totalSeconds || 0) % 60;
            window.addLogEntry(`ROSC eingetreten nach ${m} Min ${s} Sek`);
        }
        
        if (Utils.saveSession) Utils.saveSession();
        
        document.getElementById('cpr-interface').classList.add('hidden');
        document.getElementById('rosc-interface').classList.remove('hidden');
        document.getElementById('rosc-interface').classList.add('flex');
        
        const topStats = document.getElementById('top-stats');
        if (topStats) {
            topStats.querySelector('#main-timer').parentNode.classList.add('hidden');
            document.getElementById('stat-ccf').classList.add('hidden');
            document.getElementById('stat-rosc').classList.remove('hidden');
            document.getElementById('stat-rosc').classList.add('flex');
        }
        
        Globals.roscSeconds = 0;
        if (Globals.roscInterval) clearInterval(Globals.roscInterval);
        Globals.roscInterval = setInterval(() => {
            Globals.roscSeconds++;
            const el = document.getElementById('rosc-timer-display');
            if (el) el.innerText = Utils.formatTime(Globals.roscSeconds);
        }, 1000);
        
        const pediBox = document.getElementById('pedi-rosc-vitals');
        if (AppState.isPediatric && AppState.patientWeight) {
            pediBox.classList.remove('hidden');
            document.getElementById('pedi-rosc-kg').innerText = AppState.patientWeight + " kg";
            document.getElementById('pedi-rosc-rr').innerText = "> " + (70 + (2 * (AppState.patientWeight / 3))) + " mmHg";
            document.getElementById('pedi-rosc-hr').innerText = Math.round(160 - (AppState.patientWeight * 1.5)) + " /min";
            document.getElementById('pedi-rosc-vt').innerText = Math.round(AppState.patientWeight * 6) + " ml";
        } else {
            pediBox.classList.add('hidden');
        }
    });

    document.getElementById('btn-rearrest')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(50);
        if (Globals.roscInterval) clearInterval(Globals.roscInterval);
        
        document.getElementById('rosc-interface').classList.add('hidden');
        document.getElementById('rosc-interface').classList.remove('flex');
        document.getElementById('cpr-interface').classList.remove('hidden');
        
        const topStats = document.getElementById('top-stats');
        if (topStats) {
            topStats.querySelector('#main-timer').parentNode.classList.remove('hidden');
            document.getElementById('stat-ccf').classList.remove('hidden');
            document.getElementById('stat-rosc').classList.add('hidden');
            document.getElementById('stat-rosc').classList.remove('flex');
        }
        
        if (window.addLogEntry) window.addLogEntry("RE-ARREST! CPR fortgesetzt");
        
        UI.switchView('timer');
        AppState.previousState = AppState.state;
        AppState.state = 'COMPRESSING';
        syncToState();
    });

    document.getElementById('btn-rosc-exit')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        if (Globals.roscInterval) clearInterval(Globals.roscInterval);
        
        document.getElementById('debrief-duration').innerText = Utils.formatTime(AppState.totalSeconds || 0);
        document.getElementById('debrief-ccf').innerText = (AppState.totalSeconds > 0) ? Math.round((AppState.compressingSeconds / AppState.totalSeconds) * 100) + "%" : "0%";
        document.getElementById('debrief-shocks').innerText = AppState.shockCount || 0;
        document.getElementById('debrief-adr').innerText = (AppState.adrCount || 0) + " mg";
        
        document.getElementById('debriefing-modal').classList.remove('hidden');
        document.getElementById('debriefing-modal').classList.add('flex');
    });

    document.getElementById('btn-debrief-resume')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate(20);
        document.getElementById('debriefing-modal').classList.add('hidden');
        document.getElementById('debriefing-modal').classList.remove('flex');
    });

    document.getElementById('btn-debrief-reset')?.addEventListener('click', () => {
        if (Utils.vibrate) Utils.vibrate([50, 100, 50]);
        if (confirm("Wirklich beenden und alle Daten löschen?")) {
            if (Utils.resetApp) Utils.resetApp();
        }
    });

    const tb = document.getElementById('btn-toggle-mode');
    if (tb) {
        tb.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (Utils.vibrate) Utils.vibrate(20);
            
            const def = AppState.isPediatric ? '15:2' : '30:2';
            AppState.cprMode = (AppState.cprMode === 'KONT') ? def : 'KONT';
            
            if (window.addLogEntry) window.addLogEntry("Modus Wechsel: " + AppState.cprMode);
            UI.updateModeSlider();
            
            // Sync AirwayTimer if running
            if (AppState.state === 'COMPRESSING') {
                if (AppState.cprMode === 'KONT') {
                    if(CPR.AirwayTimer) CPR.AirwayTimer.start();
                } else {
                    if(CPR.AirwayTimer) CPR.AirwayTimer.stop();
                }
            }
            syncToState();
        });
    }

    // =========================================================
    // 🌟 LOGBUCH TOGGLE LOGIK
    // =========================================================
    const btnToggleProt = document.getElementById('btn-toggle-protocol');
    const protPanel = document.getElementById('protocol-panel');
    const btnCloseProt = document.getElementById('btn-close-log');

    if (btnToggleProt && protPanel) {
        btnToggleProt.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (Utils.vibrate) Utils.vibrate(20);
            protPanel.classList.remove('translate-y-full');
            if (CPR.LogTimeline && typeof CPR.LogTimeline.forceRender === 'function') CPR.LogTimeline.forceRender();
        });
    }

    if (btnCloseProt && protPanel) {
        btnCloseProt.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (Utils.vibrate) Utils.vibrate(20);
            protPanel.classList.add('translate-y-full');
        });
    }

    // =========================================================
    // 🌟 SOUND TOGGLE LOGIK
    // =========================================================
    const btnSound = document.getElementById('btn-toggle-sound');
    if (btnSound) {
        btnSound.addEventListener('click', () => {
            if (Utils.vibrate) Utils.vibrate(20);
            AppState.isSoundActive = !AppState.isSoundActive;
            const on = document.getElementById('icon-sound-on');
            const off = document.getElementById('icon-sound-off');
            if (AppState.isSoundActive) {
                on.classList.remove('hidden'); off.classList.add('hidden'); btnSound.classList.replace('text-slate-400', 'text-slate-700');
                if (window.addLogEntry) window.addLogEntry("Töne aktiviert");
            } else {
                on.classList.add('hidden'); off.classList.remove('hidden'); btnSound.classList.replace('text-slate-700', 'text-slate-400');
                if (window.addLogEntry) window.addLogEntry("Töne stummgeschaltet");
            }
            if (Utils.saveSession) Utils.saveSession();
        });
    }

    // =========================================================
    // 🌟 HITS & SAMPLER PANEL
    // =========================================================
    const btnToggleHits = document.getElementById('btn-toggle-hits');
    const hitsPanel = document.getElementById('hits-panel');
    const btnCloseHits = document.getElementById('btn-close-hits');

    if (btnToggleHits && hitsPanel) {
        btnToggleHits.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (Utils.vibrate) Utils.vibrate(20);
            hitsPanel.classList.remove('translate-y-full');
        });
    }

    if (btnCloseHits && hitsPanel) {
        btnCloseHits.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (Utils.vibrate) Utils.vibrate(20);
            hitsPanel.classList.add('translate-y-full');
            // Check ob SAMPLER Daten ausgefüllt wurden und Button updaten
            if (AppState.anamneseData) {
                const hasData = Object.values(AppState.anamneseData).some(v => v !== '') || 
                              (AppState.anamneseData.sampler && Object.values(AppState.anamneseData.sampler).some(v => v !== ''));
                if (hasData) {
                    btnToggleHits.classList.replace('border-slate-200', 'border-amber-400');
                    btnToggleHits.classList.replace('text-slate-500', 'text-amber-600');
                    btnToggleHits.classList.add('bg-amber-50');
                    const icon = btnToggleHits.querySelector('span:last-child');
                    if(icon) icon.innerText = "Daten!";
                }
            }
        });
    }

    // =========================================================
    // 🌟 GLOBALER MAIN LOOP (1 Hz)
    // =========================================================
    let lastTickTime = Date.now();
    Globals.mainInterval = setInterval(() => {
        if (AppState.state === 'IDLE') return;

        const now = Date.now();
        const delta = Math.floor((now - lastTickTime) / 1000);
        
        if (delta >= 1) {
            AppState.totalSeconds += delta;
            if (AppState.state === 'COMPRESSING') AppState.compressingSeconds += delta;
            
            lastTickTime = now;

            const tEl = document.getElementById('main-timer');
            if (tEl) tEl.innerText = Utils.formatTime(AppState.totalSeconds);
            
            const ccf = (AppState.totalSeconds > 0) ? Math.round((AppState.compressingSeconds / AppState.totalSeconds) * 100) : 0;
            const cEl = document.getElementById('ccf-display');
            if (cEl) {
                cEl.innerText = ccf + "%";
                if (ccf >= 80) cEl.className = "text-2xl sm:text-3xl font-black tracking-tight leading-none text-emerald-500 drop-shadow-sm transition-colors duration-500";
                else if (ccf >= 60) cEl.className = "text-2xl sm:text-3xl font-black tracking-tight leading-none text-amber-500 drop-shadow-sm transition-colors duration-500";
                else cEl.className = "text-2xl sm:text-3xl font-black tracking-tight leading-none text-red-500 drop-shadow-sm transition-colors duration-500";
            }
        }
    }, 200);

    // Init
    remodelViewTimer();
    
});
