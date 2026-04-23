window.CPR = window.CPR || {};

/**
 * CPR Assist - Autonome Lunge für den KONT Modus
 * FIX: Zuckende Animation repariert! CSS-Transitions werden für die JS-Animation deaktiviert.
 * FIX: Icon-Farben nutzen stabiles remove/add statt replace.
 * UX-UPDATE: Der Badge wird während der Beatmungs-Sekunde komplett ausgeblendet (kein "!!" mehr).
 */
window.CPR.AirwayTimer = (function() {
    let rafId = null;
    let isRunning = false;
    let cycleStartTime = 0;
    
    let hasPlayedSound = false; 
    
    let cycleDuration = 6000; 
    let fillDuration = 5000;  
    let ventDuration = 1000;  

    function animate() {
        if (!isRunning) return;

        const now = Date.now();
        let elapsed = now - cycleStartTime;

        if (elapsed >= cycleDuration) {
            cycleStartTime = now;
            elapsed = 0; 
            hasPlayedSound = false; 
        }

        const glowBg = document.getElementById('aw-glow-bg');
        const awIcon = document.getElementById('aw-icon');
        const badge = document.getElementById('airway-countdown-badge');
        const awLabel = document.getElementById('airway-label');

        if (elapsed < fillDuration) {
            // ==========================================
            // 1. COUNTDOWN-PHASE (Warten auf Beatmung)
            // ==========================================
            const remainingToVent = Math.ceil((fillDuration - elapsed) / 1000);
            
            if (badge) {
                badge.style.display = 'flex'; 
                badge.innerText = remainingToVent;
                
                if (remainingToVent <= 1) {
                    badge.classList.remove('bg-slate-800', 'border-white', 'bg-[#E3000F]');
                    badge.classList.add('bg-amber-500', 'border-amber-100', 'animate-pulse');
                } else {
                    badge.classList.remove('bg-amber-500', 'border-amber-100', 'animate-pulse', 'bg-[#E3000F]');
                    badge.classList.add('bg-slate-800', 'border-white');
                }
            }

            if (glowBg) {
                glowBg.style.opacity = '0.05';
                glowBg.style.transform = 'scale(0.95)';
                glowBg.style.backgroundColor = '#e2e8f0'; 
                glowBg.style.boxShadow = 'none';
            }
            
            if (awIcon) {
                awIcon.classList.remove('text-cyan-500');
                awIcon.classList.add('text-slate-400');
            }
            if (awLabel) {
                awLabel.innerText = window.CPR.Globals.tempAirwayType || "Atemweg";
                awLabel.classList.remove('text-cyan-600', 'animate-pulse');
            }

        } else {
            // ==========================================
            // 2. BEATMUNGS-PHASE (Der optische "Squeeze" & Sound)
            // ==========================================
            const ventElapsed = elapsed - fillDuration;
            
            if (!hasPlayedSound) {
                if (window.CPR.Audio && typeof window.CPR.Audio.playVentilationSound === 'function') {
                    window.CPR.Audio.playVentilationSound();
                }
                if (window.CPR.Utils && typeof window.CPR.Utils.vibrate === 'function') {
                    window.CPR.Utils.vibrate([100, 200, 100]); 
                }
                hasPlayedSound = true;
            }
            
            // 🌟 UX-FIX: Badge während der Beatmung komplett ausblenden! 🌟
            if (badge) {
                badge.style.display = 'none';
            }

            if (glowBg) {
                let fadeOut = 1 - (ventElapsed / ventDuration); 
                if (fadeOut < 0) fadeOut = 0; 
                
                glowBg.style.opacity = (0.3 + (0.7 * fadeOut)).toString(); 
                glowBg.style.transform = `scale(${1.05 + (0.1 * fadeOut)})`; 
                glowBg.style.backgroundColor = '#06b6d4'; 
                glowBg.style.boxShadow = `0 0 ${40 * fadeOut}px rgba(6,182,212,${0.8 * fadeOut})`;
            }
            
            if (awIcon) {
                awIcon.classList.remove('text-slate-400');
                awIcon.classList.add('text-cyan-500');
            }
            if (awLabel) {
                awLabel.innerText = "BEATMEN";
                awLabel.classList.add('text-cyan-600', 'animate-pulse');
            }
        }

        rafId = requestAnimationFrame(animate);
    }

    return {
        start: function() {
            if (isRunning) return;

            const isPedi = window.CPR.AppState && window.CPR.AppState.isPediatric;
            if (isPedi) {
                cycleDuration = 2400;
                fillDuration = 1400; 
                ventDuration = 1000; 
            } else {
                cycleDuration = 6000;
                fillDuration = 5000; 
                ventDuration = 1000; 
            }

            // BUGFIX: CSS Transitions töten, sonst zuckt die JS-Animation extrem!
            const glowBg = document.getElementById('aw-glow-bg');
            if (glowBg) glowBg.style.transition = 'none';

            isRunning = true;
            cycleStartTime = Date.now(); 
            hasPlayedSound = false; 
            
            animate();
        },
        
        stop: function() {
            isRunning = false;
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            
            const glowBg = document.getElementById('aw-glow-bg');
            const awIcon = document.getElementById('aw-icon');
            const badge = document.getElementById('airway-countdown-badge');
            const awLabel = document.getElementById('airway-label');
            
            if (glowBg) {
                glowBg.style.transition = ''; // Transition wiederherstellen für den 30:2 Modus
                glowBg.style.opacity = '0';
                glowBg.style.transform = 'scale(1)';
                glowBg.style.boxShadow = 'none';
            }
            if (awIcon) {
                awIcon.classList.remove('text-cyan-500');
                awIcon.classList.add('text-slate-400');
            }
            
            if (badge) {
                badge.style.display = 'none'; 
                badge.classList.remove('bg-amber-500', 'border-amber-100', 'animate-pulse', 'bg-[#E3000F]');
                badge.classList.add('bg-slate-800', 'border-white', 'hidden');
            }
            
            if (awLabel) {
                awLabel.innerText = window.CPR.Globals.tempAirwayType || "Atemweg";
                awLabel.classList.remove('text-cyan-600', 'animate-pulse');
            }
        }
    };
})();
