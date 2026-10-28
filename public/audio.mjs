const STORAGE_KEY = 'museum-audio-settings-v1';
const DEFAULTS = Object.freeze({ master: 80, music: 44, ambience: 40, sfx: 62, ui: 48 });
const BUS_NAMES = Object.keys(DEFAULTS);
// Original, non-diegetic motifs: the theatre never performs a character's solo.
const SCENES = {
  1: { name: 'museum', notes: [220, 261.63, 293.66, 329.63, 392, 329.63], air: 0.985, level: 0.34 },
  2: { name: 'station', notes: [196, 246.94, 293.66, 246.94, 220, 196], air: 0.996, level: 0.75 },
  3: { name: 'theatre', notes: [174.61, 220, 261.63, 329.63, 261.63, 220], air: 0.99, level: 0.22 },
  4: { name: 'workshop', notes: [146.83, 220, 293.66, 220, 196, 164.81], air: 0.975, level: 0.28 },
  5: { name: 'river', notes: [261.63, 293.66, 392, 440, 392, 293.66], air: 0.94, level: 0.36 },
};
let context = null;
let buses = null;
let musicDuck = null;
let ambienceDuck = null;
let transitionBus = null;
let settings = readSettings();
let sceneId = 1;
let dialogue = false;
let cover = 0;
let currentLayer = null;
let retiringLayer = null;
let lastStepAt = -Infinity;
let lastWorldSound = null;
const voices = new Set();
const bufferCache = new Map();

function clamp(value, max = 100) {
  return Math.max(0, Math.min(max, Number(value) || 0));
}
function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return Object.fromEntries(BUS_NAMES.map((name) => [name, clamp(saved[name] ?? DEFAULTS[name])]));
  } catch {
    return { ...DEFAULTS };
  }
}
function sliderGain(value) { return (value / 100) ** 2; }
function ramp(param, value, seconds = 0.08) {
  const now = context.currentTime;
  if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
  else {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
  }
  param.linearRampToValueAtTime(value, now + seconds);
}
function gain(destination, value = 1) {
  const node = context.createGain();
  node.gain.value = value;
  node.connect(destination);
  return node;
}
function updateMix() {
  if (!buses) return;
  ramp(musicDuck.gain, dialogue ? 0.25 : 1, dialogue ? 0.12 : 0.65);
  ramp(ambienceDuck.gain, dialogue ? 0.55 : 1, dialogue ? 0.12 : 0.65);
  ramp(transitionBus.gain, 1 - cover * 0.75, 0.06);
}

// Synthesize once per visited scene; native buffer loops need no JS scheduler.
// All localized events decay fully inside the loop, including its seam.
function sceneBuffers(id) {
  if (bufferCache.has(id)) return bufferCache.get(id);
  const spec = SCENES[id];
  const rate = context.sampleRate;
  const seconds = 24;
  const ambience = context.createBuffer(1, rate * seconds, rate);
  const music = context.createBuffer(1, rate * seconds, rate);
  const air = ambience.getChannelData(0);
  const score = music.getChannelData(0);
  let random = 0x51f15e + id;
  let slow = 0;
  for (let i = 0; i < air.length; i++) {
    random ^= random << 13; random ^= random >>> 17; random ^= random << 5;
    const t = i / rate;
    slow = slow * spec.air + ((random >>> 0) / 2147483648 - 1) * (1 - spec.air);
    const seam = Math.min(1, t / 0.06, (seconds - t) / 0.06);
    air[i] = slow * spec.level * (0.8 + 0.2 * Math.sin(t * Math.PI / 6)) * seam;
  }
  function note(samples, start, duration, frequency, volume, chirp = 0) {
    const count = Math.floor(duration * rate);
    const offset = Math.floor(start * rate);
    for (let i = 0; i < count && offset + i < samples.length; i++) {
      const t = i / rate;
      const envelope = Math.min(1, t / 0.035) * (1 - t / duration) ** 3;
      samples[offset + i] += Math.sin(2 * Math.PI * (frequency * t + chirp * t * t / 2)) * volume * envelope;
    }
  }
  spec.notes.forEach((frequency, i) => {
    note(score, i * 4 + 0.15, 3.7, frequency, 0.12);
    note(score, i * 4 + 0.15, 3.2, frequency * 2, 0.018);
  });
  // Beds contain only diffuse air and non-diegetic music. Local prop contacts,
  // birds and water arrive from world events with measured distance and pan.
  // The station clock is stopped: it has no periodic ticking source.
  const buffers = { ambience, music };
  bufferCache.set(id, buffers);
  if (bufferCache.size > 2) bufferCache.delete(bufferCache.keys().next().value);
  return buffers;
}
function disposeLayer(layer, fade = 0) {
  if (!layer) return;
  layer.disposed = true;
  for (const entry of layer.entries) {
    if (fade) ramp(entry.envelope.gain, 0, fade);
    else {
      entry.envelope.gain.cancelScheduledValues(context.currentTime);
      entry.envelope.gain.setValueAtTime(0, context.currentTime);
    }
    entry.source.stop(context.currentTime + fade);
  }
}
function startScene() {
  if (!buses || document.hidden || currentLayer?.id === sceneId) return;
  // Rapid navigation retains at most one outgoing layer.
  disposeLayer(retiringLayer);
  retiringLayer = currentLayer;
  disposeLayer(retiringLayer, 1.2);
  // An already fading layer may still exist: its end handler owns disconnection.
  const layer = { id: sceneId, entries: [], disposed: false };
  const buffers = sceneBuffers(sceneId);
  for (const category of ['ambience', 'music']) {
    const source = context.createBufferSource();
    source.buffer = buffers[category];
    source.loop = true;
    const envelope = gain(category === 'music' ? musicDuck : ambienceDuck, 0);
    source.connect(envelope);
    source.onended = () => {
      source.disconnect(); envelope.disconnect();
      if (retiringLayer === layer) retiringLayer = null;
    };
    source.start();
    ramp(envelope.gain, 1, 1.2);
    layer.entries.push({ source, envelope });
  }
  currentLayer = layer;
}
function ensureContext() {
  if (document.hidden) return false;
  if (!context) {
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) return false;
    try { context = new AudioContextClass(); } catch { return false; }
    buses = {};
    buses.master = gain(context.destination, sliderGain(settings.master));
    transitionBus = gain(buses.master, 1 - cover * 0.75);
    for (const name of BUS_NAMES.filter((item) => item !== 'master')) {
      buses[name] = gain(name === 'ui' ? buses.master : transitionBus, sliderGain(settings[name]));
    }
    musicDuck = gain(buses.music, dialogue ? 0.25 : 1);
    ambienceDuck = gain(buses.ambience, dialogue ? 0.55 : 1);
  }
  startScene();
  if (context.state === 'suspended') context.resume().catch(() => {});
  return true;
}
function tone({ frequency = 500, endFrequency = frequency, duration = 0.12, type = 'sine', bus = 'sfx', volume = 0.08, distance = 0, pan = 0 }) {
  if (!ensureContext() || !buses?.[bus] || voices.size >= 24) return;
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  const panner = context.createStereoPanner?.();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume / (1 + clamp(distance, 1000) ** 2 * 0.12)), now + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(envelope);
  if (panner) {
    panner.pan.value = Math.max(-1, Math.min(1, Number(pan) || 0));
    envelope.connect(panner).connect(buses[bus]);
  } else envelope.connect(buses[bus]);
  const voice = { stop: () => oscillator.stop() };
  voices.add(voice);
  oscillator.onended = () => {
    oscillator.disconnect(); envelope.disconnect(); panner?.disconnect(); voices.delete(voice);
  };
  oscillator.start(now);
  oscillator.stop(now + duration + 0.01);
}

export const gameAudio = {
  unlock() { ensureContext(); },
  getSettings() { return { ...settings }; },
  setVolume(name, value) {
    if (!BUS_NAMES.includes(name)) return;
    settings[name] = clamp(value);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* Session controls still work. */ }
    if (buses) ramp(buses[name].gain, sliderGain(settings[name]));
  },
  setScene(id) {
    if (!Object.hasOwn(SCENES, id)) return;
    sceneId = Number(id);
    startScene();
  },
  setDialogue(active) {
    if (dialogue === Boolean(active)) return;
    dialogue = Boolean(active);
    updateMix();
  },
  setTransition(frame) {
    const next = clamp(typeof frame === 'number' ? frame : frame?.opacity ?? frame?.cover ?? 0, 1);
    if (cover === next) return;
    cover = next;
    if (buses) ramp(transitionBus.gain, 1 - cover * 0.75, 0.06);
  },
  playWorld(kind, { distance = 0, pan = 0 } = {}) {
    lastWorldSound = {kind,distance:clamp(distance,1000),pan:Math.max(-1,Math.min(1,Number(pan)||0))};
    const common = { distance, pan, bus: 'sfx' };
    if (kind === 'clock') tone({ ...common, frequency: 940, endFrequency: 710, duration: 0.065, volume: 0.05 });
    else if (kind === 'bird') tone({ ...common, frequency: 1600, endFrequency: 2200, duration: 0.25, volume: 0.04 });
    else if (kind === 'paper') tone({ ...common, frequency: 950, endFrequency: 180, duration: 0.18, type: 'sawtooth', volume: 0.018 });
    else if (kind === 'beat' || kind === 'wood') tone({ ...common, frequency: 185, endFrequency: 90, duration: 0.14, type: 'triangle', volume: 0.055 });
    else if (kind === 'water') tone({ ...common, frequency: 220, endFrequency: 75, duration: 0.6, volume: 0.035 });
    else if (kind === 'metal' || kind === 'tool') tone({ ...common, frequency: 640, endFrequency: 620, duration: 0.32, volume: 0.05 });
    else tone({ ...common, frequency: kind === 'step' ? 115 : 185, endFrequency: 82, duration: 0.09, type: 'triangle', volume: 0.035 });
  },
  play(kind = 'click') {
    if (kind === 'blocked') return tone({ frequency: 180, endFrequency: 90, duration: 0.16, type: 'triangle', volume: 0.06 });
    if (kind === 'inspect' || kind === 'confirm') return tone({ frequency: 660, endFrequency: 880, duration: 0.2, volume: 0.07 });
    if (kind === 'step') {
      const now = performance.now();
      if (now - lastStepAt < 340) return;
      lastStepAt = now;
      return this.playWorld('step');
    }
    tone({ frequency: 760, endFrequency: 520, duration: 0.055, bus: 'ui', volume: 0.1 });
  },
  diagnostics() {
    return { state: context?.state ?? 'locked', sceneId, scene: SCENES[sceneId].name, dialogue, transitionCover: cover,
      activeScene: currentLayer?.id ?? null, retiringScene: retiringLayer?.id ?? null, oneShots: voices.size,
      lastWorldSound, cachedScenes: [...bufferCache.keys()], schedulerTimers: 0, settings: { ...settings } };
  },
};

document.addEventListener('visibilitychange', () => {
  if (!context) return;
  if (document.hidden) {
    for (const voice of voices) voice.stop();
    disposeLayer(retiringLayer);
    context.suspend().catch(() => {});
  } else {
    startScene();
    context.resume().catch(() => {});
  }
});
