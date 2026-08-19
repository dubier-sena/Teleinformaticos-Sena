/* js/hardware_lab_3d_audio.js
 *
 * Sonidos discretos del Laboratorio Virtual de Hardware (item 25), 100%
 * sintetizados con WebAudio (osciladores + ruido filtrado): no hace falta
 * vendorizar ni descargar archivos de audio. Silencio por defecto respetuoso
 * (volumen bajo) y silenciable por completo con un boton; la preferencia se
 * recuerda en localStorage (es un ajuste de dispositivo/navegador, no una
 * respuesta de aprendiz: no se sincroniza a la nube).
 */
const STORAGE_KEY = "sena_portal_hwlab_sound_muted_v1";

let ctx = null;
let masterGain = null;
let muted = readMutedPref();

function readMutedPref() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch (_e) {
    return false;
  }
}

function writeMutedPref(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch (_e) {
    /* localStorage lleno o bloqueado: la preferencia simplemente no persiste */
  }
}

function ensureContext() {
  if (ctx) return ctx;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  ctx = new AudioCtx();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.22;
  masterGain.connect(ctx.destination);
  return ctx;
}

/** Debe llamarse tras un gesto del usuario (click) para cumplir con autoplay policies. */
function unlock() {
  const c = ensureContext();
  if (c && c.state === "suspended") c.resume();
}

function tone(freq, startAt, duration, opts = {}) {
  if (muted || !ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type || "sine";
  osc.frequency.setValueAtTime(freq, startAt);
  if (opts.slideTo) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), startAt + duration);
  }
  const peak = opts.gain != null ? opts.gain : 0.5;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + Math.min(0.015, duration * 0.3));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

function noiseBurst(startAt, duration, opts = {}) {
  if (muted || !ctx) return;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = opts.freq || 2200;
  filter.Q.value = opts.q || 1.1;
  const gain = ctx.createGain();
  const peak = opts.gain != null ? opts.gain : 0.35;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  src.start(startAt);
  src.stop(startAt + duration + 0.02);
}

function safeNow() {
  return ctx ? ctx.currentTime : 0;
}

export const HardwareLabAudio = {
  unlock,

  isMuted() {
    return muted;
  },

  setMuted(value) {
    muted = !!value;
    writeMutedPref(muted);
  },

  toggleMuted() {
    this.setMuted(!muted);
    return muted;
  },

  /** Click de UI generico (boton, seleccion de herramienta). */
  playClick() {
    unlock();
    const t = safeNow();
    tone(720, t, 0.06, { type: "square", gain: 0.18 });
  },

  /** Tornillo aflojandose/retirandose: 3-4 clics de trinquete con leve variacion. */
  playScrew() {
    unlock();
    const t = safeNow();
    const clicks = 4;
    for (let i = 0; i < clicks; i++) {
      const at = t + i * 0.075;
      noiseBurst(at, 0.045, { freq: 2600 + i * 120, gain: 0.28 });
    }
  },

  /** Conector/cable que se conecta: blip corto ascendente. */
  playConnect() {
    unlock();
    const t = safeNow();
    tone(420, t, 0.12, { type: "triangle", slideTo: 780, gain: 0.3 });
  },

  /** Conector/cable que se desconecta: blip corto descendente. */
  playDisconnect() {
    unlock();
    const t = safeNow();
    tone(620, t, 0.12, { type: "triangle", slideTo: 300, gain: 0.3 });
  },

  /** Pieza colocada sobre la mesa (asentamiento suave). */
  playPlace() {
    unlock();
    const t = safeNow();
    tone(220, t, 0.09, { type: "sine", gain: 0.22 });
    noiseBurst(t + 0.01, 0.05, { freq: 400, q: 0.6, gain: 0.12 });
  },

  /** Accion invalida / bloqueada por dependencias. */
  playError() {
    unlock();
    const t = safeNow();
    tone(300, t, 0.16, { type: "square", slideTo: 160, gain: 0.22 });
    tone(300, t + 0.14, 0.16, { type: "square", slideTo: 160, gain: 0.22 });
  },

  /** Paso u operacion completada correctamente. */
  playSuccess() {
    unlock();
    const t = safeNow();
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      tone(freq, t + i * 0.07, 0.16, { type: "sine", gain: 0.24 });
    });
  },

  /** Practica/caso terminado y aprobado (fanfarria breve). */
  playComplete() {
    unlock();
    const t = safeNow();
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      tone(freq, t + i * 0.09, 0.22, { type: "sine", gain: 0.26 });
    });
  },
};

if (typeof window !== "undefined") {
  window.HardwareLab = window.HardwareLab || {};
  window.HardwareLab.Audio3D = HardwareLabAudio;
}
