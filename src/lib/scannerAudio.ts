// Web Audio API Synthesizer para escáner tipo supermercado / retail
// Diseñado para cero latencia y compatibilidad total en navegadores modernos (PC, tablets y smartphones)

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
        if (!audioContext) {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
                audioContext = new AudioCtx();
            }
        }
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }
        return audioContext;
    } catch {
        return null;
    }
}

/**
 * Pitido clásico de caja de supermercado / escáner láser de retail (Datalogic / Zebra / Honeywell).
 * Frecuencia cristalina (~2050 Hz) con decaimiento ultra rápido de ~70 milisegundos.
 */
export function playSupermarketBeep(volume = 0.25) {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Tono tipo terminal de autoservicio
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2050, now);
        // Pequeño chirrido de apertura típico de lectores láser
        osc.frequency.exponentialRampToValueAtTime(2200, now + 0.015);
        osc.frequency.setValueAtTime(2050, now + 0.03);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(Math.min(volume, 0.5), now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.08);

        // Feedback háptico en dispositivos táctiles
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(20);
        }
    } catch {
        // Ignorar si el navegador bloquea audio antes de interacción
    }
}

/**
 * Pitido para escaneo repetido (+1 unidad adicionada al carrito en ráfaga).
 * Tono con modulación ascendente para indicar incremento.
 */
export function playIncrementBeep(volume = 0.25) {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(2450, now + 0.07);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(Math.min(volume, 0.5), now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.085);

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([15, 20, 15]);
        }
    } catch {}
}

/**
 * Pitido de advertencia o producto no encontrado / agotado (doble zumbido bajo).
 */
export function playErrorBeep(volume = 0.25) {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        
        // Zumbido 1
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'square';
        osc1.frequency.setValueAtTime(320, now);
        gain1.gain.setValueAtTime(volume * 0.4, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.08);

        // Zumbido 2
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(260, now + 0.1);
        gain2.gain.setValueAtTime(volume * 0.4, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.2);

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([60, 50, 60]);
        }
    } catch {}
}

/**
 * Inicializador pasivo de contexto al primer clic para desbloquear audio
 */
export function initAudioContextOnFirstGesture() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
        getAudioContext();
        window.removeEventListener('click', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
}
