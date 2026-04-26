/**
 * CPR Assist - UI Engine (V60 - Saftey Upgrade)
 * BOMB DEFUSAL: Der asynchrone 300ms "Hidden"-Timer für Satelliten wird nun 
 * hart abgebrochen, sobald ein neuer State (small) geladen wird. Verhindert das 
 * plötzliche Ausblenden der UI beim App-Resume.
 */

window.CPR = window.CPR || {};

window.CPR.UI = (function() {
    let satHideTimeout = null; // Globale Timer-Variable für die Zeitbombe

    return {
        switchView: function(viewId) {
            if (window.CPR.Globals) window.CPR.Globals.lastViewSwitch = Date.now();
            
            const allViews = [
                'view-ob-1', 'view-ob-2', 'view-ob-3', 'view-timer', 'view-decision', 
                'view-cpr-resume', 'view-joule', 'view-airway', 'view-airway-doc', 
                'view-meds-menu', 'view-zugang', 'view-rosc-end', 'view-abbruch-reason', 
                'view-initial-breaths'
            ];
            
            allViews.forEach(function(id) {
                const el = document.getElementById(id);
                if (el) { 
                    el.style.display = ''; 
                    el.classList.add('hidden'); 
                    el.classList.remove('flex', 'flex-col'); 
                }
            });

            let targetId = viewId;
            if (targetId && targetId.indexOf('view-') !== 0) targetId = 'view-' + targetId;
            
            const targetEl = document.getElementById(targetId);
            if (targetEl) { 
                targetEl.classList.remove('hidden'); 
                
                if(targetId === 'view-timer' || targetId === 'view-meds-menu' || targetId === 'view-airway' || targetId === 'view-airway-doc' || targetId === 'view-zugang' || targetId === 'view-abbruch-reason' || targetId === 'view-rosc-end') {
                    targetEl.classList.add('flex', 'flex-col');
                } else if (targetId === 'view-joule') {
                    targetEl.classList.add('flex', 'flex-col');
                    if(window.CPR.UI.renderJouleOptions) window.CPR.UI.renderJouleOptions();
                }
            }
        },

        setCenterSize: function(size) {
            const sats = document.getElementById('satellites');
            
            // 🌟 DIE BOMBE WIRD ENTSCHÄRFT 🌟
            // Egal was vorher war, wenn ein neuer Größen-Befehl kommt, löschen wir den alten Versteck-Timer!
            if (satHideTimeout) {
                clearTimeout(satHideTimeout);
                satHideTimeout = null;
            }

            if (size === 'small') {
                document.body.classList.add('cpr-mode-small');
                document.body.classList.remove('center-menu-open');
                
                // Satelliten SOFORT wieder sichtbar machen, da wir im Timer-Modus sind
                if (sats) sats.classList.remove('hidden');
                
            } else if (size === 'large') {
                document.body.classList.remove('cpr-mode-small');
                document.body.classList.add('center-menu-open');
                
                // 🌟 DIE 300ms ZEITBOMBE (Jetzt zu 100 % abgesichert) 🌟
                // Wir geben dem CSS 300ms Zeit für die Fade-Out Animation (opacity),
                // bevor wir sie endgültig auf "display: none" setzen.
                if (sats) {
                    satHideTimeout = setTimeout(() => {
                        // Doppel-Check: Nur verstecken, wenn das Menü WIRKLICH noch offen ist
                        if (document.body.classList.contains('center-menu-open')) {
                            sats.classList.add('hidden');
                        }
                    }, 300);
                }
            }
        },

        updateBpmUI: function() {
            const state = window.CPR.AppState;
            if (!state) return;
            const bpm = state.bpm || 110;
            document.querySelectorAll('.bpm-opt').forEach(btn => {
                if (parseInt(btn.dataset.bpm) === bpm) {
                    btn.classList.replace('text-slate-400', 'text-slate-800');
                    btn.classList.replace('bg-transparent', 'bg-white');
                    btn.classList.replace('border-transparent', 'border-slate-100');
                    btn.classList.add('shadow-sm', 'transform', 'scale-105');
                } else {
                    btn.classList.replace('text-slate-800', 'text-slate-400');
                    btn.classList.replace('bg-white', 'bg-transparent');
                    btn.classList.replace('border-slate-100', 'border-transparent');
                    btn.classList.remove('shadow-sm', 'transform', 'scale-105');
                }
            });
        },

        updateCprModeUI: function() {
            const state = window.CPR.AppState;
            if (!state) return;

            const lSync = document.getElementById('mode-label-sync');
            const lKont = document.getElementById('mode-label-kont');
            const thumb = document.getElementById('mode-slider-thumb');

            if (lSync && lKont && thumb) {
                if (state.cprMode === 'continuous') {
                    thumb.classList.add('translate-x-[45px]');
                    lKont.classList.replace('text-amber-400', 'text-amber-700');
                    lSync.classList.replace('text-amber-700', 'text-amber-400');
                    lSync.innerText = state.isPediatric ? '15:2' : '30:2';
                } else {
                    thumb.classList.remove('translate-x-[45px]');
                    lSync.classList.replace('text-amber-400', 'text-amber-700');
                    lKont.classList.replace('text-amber-700', 'text-amber-400');
                    lSync.innerText = state.isPediatric ? '15:2' : '30:2';
                }
            }
        },

        updatePediatricUI: function() {
            const state = window.CPR.AppState;
            if (!state) return;
            
            const wDisplay = document.getElementById('pediatric-weight-display');
            const pEdit = document.getElementById('btn-pediatric-edit');
            
            if (state.isPediatric) {
                if (pEdit) pEdit.classList.remove('hidden');
                if (wDisplay) {
                    if (state.patientWeight) {
                        wDisplay.innerText = state.patientWeight + " kg";
                        if (pEdit) {
                            pEdit.classList.replace('bg-red-100', 'bg-blue-50');
                            pEdit.classList.replace('text-red-700', 'text-blue-700');
                            pEdit.classList.replace('border-red-300', 'border-blue-200');
                            pEdit.classList.remove('animate-pulse');
                        }
                    } else {
                        wDisplay.innerText = "FEHLT!";
                        if (pEdit) {
                            pEdit.classList.replace('bg-blue-50', 'bg-red-100');
                            pEdit.classList.replace('text-blue-700', 'text-red-700');
                            pEdit.classList.replace('border-blue-200', 'border-red-300');
                            pEdit.classList.add('animate-pulse');
                        }
                    }
                }

                // Update Airway Optionen (Pädiatrie spezifisch)
                const awCont = document.getElementById('airway-buttons-container');
                const pediInfo = document.getElementById('pediatric-airway-info');
                if (pediInfo) pediInfo.classList.remove('hidden');

                if (awCont) {
                    awCont.innerHTML = 
                        '<button class="btn-airway-opt flex-1 bg-cyan-50 border border-cyan-200 text-cyan-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="BBM">BBM<br><span class="text-[8px] font-bold opacity-70">Beutel/Maske</span></button>' +
                        '<button class="btn-airway-opt flex-1 bg-cyan-50 border border-cyan-200 text-cyan-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="SGA">SGA<br><span class="text-[8px] font-bold opacity-70">Supraglottisch</span></button>' +
                        '<button class="btn-airway-opt flex-1 bg-cyan-50 border border-cyan-200 text-cyan-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="ETI">ETI<br><span class="text-[8px] font-bold opacity-70">Endotracheal</span></button>';
                }

                if (state.patientWeight && window.CPR.broselowData) {
                    const kg = state.patientWeight;
                    let zone = window.CPR.broselowData.find(z => kg >= z.minKg && kg <= z.maxKg);
                    if (!zone) zone = window.CPR.broselowData[window.CPR.broselowData.length - 1];

                    const infKg = document.getElementById('airway-info-kg');
                    const infTub = document.getElementById('airway-info-tubus');
                    const infTief = document.getElementById('airway-info-tiefe');
                    const infWen = document.getElementById('airway-info-wendel');
                    const infGue = document.getElementById('airway-info-guedel');

                    if (infKg) infKg.innerText = kg + "kg";
                    if (infTub) infTub.innerText = zone.airway.tubus;
                    if (infTief) infTief.innerText = zone.airway.tiefe + " cm";
                    if (infWen) infWen.innerText = zone.airway.wendel;
                    if (infGue) infGue.innerText = zone.airway.guedel;
                }
            } else {
                if (pEdit) pEdit.classList.add('hidden');
                const pediInfo = document.getElementById('pediatric-airway-info');
                if (pediInfo) pediInfo.classList.add('hidden');
                
                const awCont = document.getElementById('airway-buttons-container');
                if (awCont) {
                    awCont.innerHTML = 
                        '<button class="btn-airway-opt flex-1 bg-cyan-50 border border-cyan-200 text-cyan-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="ETI">ETI<br><span class="text-[8px] font-bold opacity-70">Endotracheal</span></button>' +
                        '<button class="btn-airway-opt flex-1 bg-cyan-50 border border-cyan-200 text-cyan-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="i-gel">i-gel<br><span class="text-[8px] font-bold opacity-70">SGA</span></button>' +
                        '<button class="btn-airway-opt flex-1 bg-cyan-50 border border-cyan-200 text-cyan-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="LAMA">LAMA<br><span class="text-[8px] font-bold opacity-70">Larynxmaske</span></button>' +
                        '<button class="btn-airway-opt flex-1 bg-cyan-50 border border-cyan-200 text-cyan-700 py-3 rounded-xl font-black text-xs shadow-sm active:scale-95" data-short="LTS">LTS<br><span class="text-[8px] font-bold opacity-70">Larynxtubus</span></button>';
                }
            }
            this.updateSmartMedsButton();
        },

        updateAdrenalinBadge: function() {
            const badge = document.getElementById('adr-count-badge');
            const state = window.CPR.AppState;
            if (!badge || !state) return;
            
            if (state.adrCount > 0) {
                badge.innerText = state.adrCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        },

        updateSmartMedsButton: function() {
            const btnMeds = document.getElementById('btn-meds-menu');
            const state = window.CPR.AppState;
            if (!btnMeds || !state) return;

            const amioCount = state.amioCount || 0;

            // Amiodaron Logik
            if (state.isShockable && amioCount < 2) {
                let doseText = "300 mg";
                if (state.isPediatric && state.patientWeight) {
                    doseText = Math.round(state.patientWeight * 5) + " mg";
                } else if (amioCount === 1) {
                    doseText = "150 mg";
                }

                btnMeds.dataset.smartMode = "amio";
                btnMeds.dataset.amioDose = doseText;
                btnMeds.innerHTML = `
                    <div class="flex flex-col items-center justify-center w-full h-full pointer-events-none relative z-10">
                        <i class="fa-solid fa-syringe text-[24px] mb-1 text-purple-500"></i>
                        <div class="flex flex-col items-center leading-none mt-0.5 w-full px-1">
                            <span class="text-[10px] font-bold text-purple-600 uppercase tracking-tighter">Amio.</span>
                            <span class="text-[11px] font-black text-purple-700 uppercase tracking-tight mt-0.5">${doseText}</span>
                        </div>
                    </div>
                `;
                btnMeds.classList.remove('border-purple-100', 'text-slate-500');
                btnMeds.classList.add('border-purple-300', 'bg-purple-50');
            } else {
                btnMeds.dataset.smartMode = "menu";
                btnMeds.innerHTML = `
                    <div class="flex flex-col items-center justify-center w-full h-full pointer-events-none relative z-10">
                        <i class="fa-solid fa-capsules text-[24px] mb-1 text-slate-400"></i>
                        <div class="flex flex-col items-center leading-none mt-0.5 w-full px-1">
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Meds</span>
                            <span class="text-[11px] font-black text-purple-700 uppercase tracking-tight mt-0.5">Menü</span>
                        </div>
                    </div>
                `;
                btnMeds.classList.remove('border-purple-300', 'bg-purple-50');
                btnMeds.classList.add('border-purple-100', 'text-slate-500');
            }
        },

        updateCircle: function(canvasId, pct, color) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            const w = canvas.width;
            const h = canvas.height;
            const center = w / 2;
            const r = center - 8; 

            ctx.clearRect(0, 0, w, h);
            
            if (pct > 0) {
                ctx.beginPath();
                ctx.arc(center, center, r, 0, Math.min(1, pct) * 2 * Math.PI, false);
                ctx.lineWidth = 16;
                ctx.strokeStyle = color;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
        },

        renderJouleOptions: function() {
            const container = document.getElementById('joule-container');
            const state = window.CPR.AppState;
            if (!container || !state) return;

            let html = '';
            if (state.isPediatric && state.patientWeight) {
                const kg = state.patientWeight;
                const j4 = Math.round(kg * 4);
                html += `<button class="btn-joule bg-white border border-[#E3000F] text-[#E3000F] py-4 rounded-full font-black text-xl mb-3 shadow-[0_5px_15px_rgba(227,0,15,0.15)] active:scale-95" data-joule="${j4} J">${j4} Joule (4 J/kg)</button>`;
                const j2 = Math.round(kg * 2);
                html += `<button class="btn-joule bg-white border border-slate-300 text-slate-700 py-3 rounded-full font-bold text-md mb-2 shadow-sm active:scale-95" data-joule="${j2} J">${j2} Joule (2 J/kg)</button>`;
            } else if (state.isPediatric) {
                html += `<button class="btn-joule bg-white border border-[#E3000F] text-[#E3000F] py-4 rounded-full font-black text-xl mb-3 shadow-[0_5px_15px_rgba(227,0,15,0.15)] active:scale-95" data-joule="4 J/kg">4 J / kg</button>`;
                html += `<button class="btn-joule bg-white border border-slate-300 text-slate-700 py-3 rounded-full font-bold text-md mb-2 shadow-sm active:scale-95" data-joule="2 J/kg">2 J / kg</button>`;
            } else {
                html += `<button class="btn-joule bg-white border border-red-500 text-red-600 py-4 rounded-full font-black text-xl mb-3 shadow-[0_5px_15px_rgba(227,0,15,0.15)] active:scale-95" data-joule="150 J">150 Joule</button>`;
                html += `<button class="btn-joule bg-white border border-slate-300 text-slate-700 py-3 rounded-full font-bold text-md mb-2 shadow-sm active:scale-95 flex items-center justify-center gap-2" data-joule="200 J">200 Joule</button>`;
                html += `<button class="btn-joule bg-white border border-slate-300 text-slate-700 py-3 rounded-full font-bold text-md mb-2 shadow-sm active:scale-95 flex items-center justify-center gap-2" data-joule="360 J">360 Joule</button>`;
            }
            container.innerHTML = html;
        },

        recalcMeds: function() {
            const amioC = document.getElementById('amio-container');
            const sonsC = document.getElementById('sonstige-container');
            const state = window.CPR.AppState;
            if (!amioC || !sonsC || !state) return;

            let amioHtml = '';
            if (state.isPediatric && state.patientWeight) {
                const amioDose = Math.round(state.patientWeight * 5);
                amioHtml = `<button class="btn-amio-opt bg-purple-50 text-purple-700 border border-purple-200 py-3 rounded-xl font-black text-[11px] shadow-sm active:scale-95 col-span-2 flex flex-col items-center justify-center" data-log="Amiodaron ${amioDose}mg"><i class="fa-solid fa-syringe text-lg mb-1 text-purple-400"></i>Amiodaron (${amioDose} mg)</button>`;
            } else {
                amioHtml = `<button class="btn-amio-opt bg-purple-50 text-purple-700 border border-purple-200 py-3 rounded-xl font-black text-[11px] shadow-sm active:scale-95 flex flex-col items-center justify-center" data-log="Amiodaron 300mg"><i class="fa-solid fa-syringe text-lg mb-1 text-purple-400"></i>Amio (300 mg)</button>
                            <button class="btn-amio-opt bg-purple-50 text-purple-700 border border-purple-200 py-3 rounded-xl font-black text-[11px] shadow-sm active:scale-95 flex flex-col items-center justify-center" data-log="Amiodaron 150mg"><i class="fa-solid fa-syringe text-lg mb-1 text-purple-400"></i>Amio (150 mg)</button>`;
            }
            amioC.innerHTML = amioHtml;

            let sonsHtml = '';
            const baseClass = "btn-sonstige-opt bg-white border border-slate-200 text-slate-600 py-3 rounded-xl font-bold text-[10px] shadow-sm active:scale-95 flex flex-col items-center justify-center leading-tight text-center";
            sonsHtml += `<button class="${baseClass}">Lidocain<br><span class="font-normal text-[8px] mt-0.5 text-slate-400">1 mg/kg</span></button>`;
            sonsHtml += `<button class="${baseClass}">Magnesium<br><span class="font-normal text-[8px] mt-0.5 text-slate-400">2g i.v.</span></button>`;
            sonsHtml += `<button class="${baseClass}">Natrium-<br>Bicarbonat<br><span class="font-normal text-[8px] mt-0.5 text-slate-400">1 mmol/kg</span></button>`;
            sonsHtml += `<button class="${baseClass}">Calcium-<br>Chlorid<br><span class="font-normal text-[8px] mt-0.5 text-slate-400">10ml 10%</span></button>`;
            sonsHtml += `<button class="${baseClass}" data-log="Volumen-Bolus">Volumen-<br>Bolus</button>`;
            sonsHtml += `<button class="${baseClass}" data-log="Blutpräparate">Blut / EKs</button>`;
            sonsC.innerHTML = sonsHtml;

            this.updateSmartMedsButton();
        }
    };
})();
