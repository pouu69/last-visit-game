const STORAGE_KEY = 'museum-audio-settings-v1';
const DEFAULTS = Object.freeze({ master: 80, music: 44, ambience: 40, sfx: 62, ui: 48 });
const BUS_NAMES = Object.keys(DEFAULTS);
const NOTES = [220, 261.63, 293.66, 329.63, 392, 440, 329.63, 293.66];

let context = null;
let buses = null;
let settings = readSettings();
let musicTimer = null;
let noteIndex = 0;
let lastStepAt = 0;

function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return Object.fromEntries(
      BUS_NAMES.map((name) => [name, clamp(saved[name] ?? DEFAULTS[name])])
    );
  } catch {
    return { ...DEFAULTS };
  }
}

function clamp(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function sliderGain(value) {
  if (value <= 0) return 0;
  const db = 40 * Math.log10(value / 100); // squared slider response, converted at the GainNode edge
  return 10 ** (db / 20);
}

function setBus(name) {
  const node = buses?.[name];
  if (!node) return;
  const gain = sliderGain(settings[name]);
  node.gain.setTargetAtTime(gain, context.currentTime, 0.04);
}

function connectBus(name) {
  const node = context.createGain();
  node.gain.value = sliderGain(settings[name]);
  node.connect(name === 'master' ? context.destination : buses.master);
  return node;
}

function startAtmosphere() {
  if (buses) return;
  buses = {};
  buses.master = connectBus('master');
  for (const name of BUS_NAMES.filter((item) => item !== 'master')) buses[name] = connectBus(name);

  // A very quiet filtered air bed gives the museum room tone without an external asset.
  const length = context.sampleRate * 3;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0);
  let slow = 0;
  let randomState = 0x51f15e;
  for (let i = 0; i < length; i++) {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    slow = slow * 0.985 + ((randomState >>> 0) / 2147483648 - 1) * 0.015;
    samples[i] = slow * 4;
  }
  const air = context.createBufferSource();
  air.buffer = buffer;
  air.loop = true;
  const airFilter = context.createBiquadFilter();
  airFilter.type = 'lowpass';
  airFilter.frequency.value = 420;
  const airGain = context.createGain();
  airGain.gain.value = 0.5;
  air.connect(airFilter).connect(airGain).connect(buses.ambience);
  air.start();

  // A restrained, slow pentatonic motif sits behind the room tone.
  const playNote = () => {
    if (!context || context.state !== 'running') return;
    const now = context.currentTime;
    const frequency = NOTES[noteIndex++ % NOTES.length];
    const osc = context.createOscillator();
    const envelope = context.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(0.16, now + 0.16);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);
    osc.connect(envelope).connect(buses.music);
    osc.start(now);
    osc.stop(now + 3.85);
  };
  playNote();
  musicTimer = window.setInterval(playNote, 4200);
}

function ensureContext() {
  if (!context) {
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) return false;
    context = new AudioContextClass();
  }
  startAtmosphere();
  if (context.state === 'suspended') context.resume().catch(() => {});
  return true;
}

function tone({ frequency = 500, endFrequency = frequency, duration = 0.12, type = 'sine', bus = 'sfx', volume = 0.08 }) {
  if (!ensureContext() || !buses?.[bus]) return;
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(envelope).connect(buses[bus]);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.01);
}

export const gameAudio = {
  unlock() {
    ensureContext();
  },
  getSettings() {
    return { ...settings };
  },
  setVolume(name, value) {
    if (!BUS_NAMES.includes(name)) return;
    settings[name] = clamp(value);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Audio controls remain usable for this page if storage is unavailable.
    }
    setBus(name);
  },
  play(kind = 'click') {
    if (kind === 'blocked') {
      tone({ frequency: 180, endFrequency: 90, duration: 0.16, type: 'triangle', bus: 'sfx', volume: 0.06 });
      return;
    }
    if (kind === 'inspect' || kind === 'confirm') {
      tone({ frequency: 660, endFrequency: 880, duration: 0.2, type: 'sine', bus: 'sfx', volume: 0.07 });
      return;
    }
    if (kind === 'step') {
      const now = performance.now();
      if (now - lastStepAt < 340) return;
      lastStepAt = now;
      tone({ frequency: 115, endFrequency: 82, duration: 0.085, type: 'triangle', bus: 'sfx', volume: 0.035 });
      return;
    }
    tone({ frequency: 760, endFrequency: 520, duration: 0.055, type: 'sine', bus: 'ui', volume: 0.1 });
  },
};

document.addEventListener('visibilitychange', () => {
  if (!context) return;
  if (document.hidden) context.suspend().catch(() => {});
  else if (buses) context.resume().catch(() => {});
});
