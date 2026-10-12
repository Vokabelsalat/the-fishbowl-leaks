import { trackSeconds } from "./aquariumTrackLength";

/** “Pressure drift”: an original 192-second drone piece in A Aeolian.
 * Am(add9) → Fmaj7(♯11) → C/G → Em(add11), then Dm9 → Cmaj7 → Fmaj7(♯11) → E7sus4,
 * which turns back to A minor; each chord swells for half a minute.
 * Detuned saw pairs run through soft saturation and slowly breathing low-pass
 * filters; a tape-like warble and a lead that bends between its long notes
 * keep every tone slightly out of shape.
 */
export async function renderAquariumDrift(rate = 22050): Promise<AudioBuffer> {
  const duration = trackSeconds;
  const context = new OfflineAudioContext(2, rate * duration, rate);
  const room = context.createConvolver();
  const impulse = context.createBuffer(2, rate * 7, rate);
  let seed = 9311;
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    let softened = 0;
    for (let index = 0; index < data.length; index += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      softened = softened * 0.8 + (seed / 4294967296 * 2 - 1) * 0.2;
      data[index] = softened * Math.exp(-index / rate * 0.75);
    }
  }
  room.buffer = impulse;
  const wet = context.createGain();
  wet.gain.value = 0.55;
  room.connect(wet).connect(context.destination);

  // A tanh curve rounds the peaks off, so stronger drive adds warm, buzzing overtones.
  function saturation(drive: number) {
    const curve = new Float32Array(1024);
    for (let index = 0; index < curve.length; index += 1) {
      const x = (index / (curve.length - 1)) * 2 - 1;
      curve[index] = Math.tanh(x * drive) / Math.tanh(drive);
    }
    const shaper = context.createWaveShaper();
    shaper.curve = curve;
    shaper.oversample = "2x";
    return shaper;
  }

  function lfo(frequency: number, depth: number, target: AudioParam, start: number, stop: number) {
    const oscillator = context.createOscillator();
    const amount = context.createGain();
    oscillator.frequency.value = frequency;
    amount.gain.value = depth;
    oscillator.connect(amount).connect(target);
    oscillator.start(start);
    oscillator.stop(stop);
  }

  const frequencyOf = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

  /** One long tone; `glides` bend its pitch to further notes at the given times. */
  function drone({
    midi,
    start,
    length,
    level,
    pan,
    drive,
    brightness,
    attack,
    glides = [],
  }: {
    midi: number;
    start: number;
    length: number;
    level: number;
    pan: number;
    drive: number;
    brightness: number;
    attack: number;
    glides?: { midi: number; at: number; over: number }[];
  }) {
    const stop = start + length + 0.3;
    const mix = context.createGain();
    mix.gain.value = 0.5;
    [-9, 9].forEach((cents) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sawtooth";
      oscillator.detune.value = cents;
      oscillator.frequency.setValueAtTime(frequencyOf(midi), start);
      for (const glide of glides) {
        oscillator.frequency.setTargetAtTime(frequencyOf(glide.midi), glide.at, glide.over / 3);
      }
      // A slow, uneven warble, like a tape stretching on its reel.
      lfo(0.11 + Math.abs(cents) * 0.004, 7, oscillator.detune, start, stop);
      lfo(0.37, 2.5, oscillator.detune, start, stop);
      oscillator.connect(mix);
      oscillator.start(start);
      oscillator.stop(stop);
    });

    const shaper = saturation(drive);
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = brightness;
    filter.Q.value = 2.2;
    lfo(0.045 + (midi % 5) * 0.008, brightness * 0.55, filter.frequency, start, stop);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(level, start + attack);
    envelope.gain.setValueAtTime(level, start + length * 0.55);
    envelope.gain.exponentialRampToValueAtTime(0.00001, start + length);
    envelope.gain.linearRampToValueAtTime(0, start + length + 0.1);
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    lfo(0.03, 0.25, panner.pan, start, stop);

    mix.connect(shaper).connect(filter).connect(envelope).connect(panner);
    panner.connect(context.destination);
    panner.connect(room);
  }

  const chords = [
    [45, 52, 59, 60, 64], [41, 53, 57, 59, 64], [43, 48, 55, 59, 64], [40, 47, 55, 57, 62],
    [38, 45, 53, 60, 64], [36, 48, 55, 59, 64], [41, 48, 57, 59, 64], [40, 47, 52, 57, 62],
  ];
  chords.forEach((chord, bar) => {
    // Chords overlap by several seconds, so each one swells out of the last.
    const start = bar * 24 - (bar === 0 ? 0 : 4);
    chord.forEach((midi, voice) => {
      drone({
        midi,
        start: start + voice * 1.2,
        length: 32,
        level: voice === 0 ? 0.034 : 0.0145,
        pan: (voice - 2) * 0.24,
        drive: voice === 0 ? 3.5 : 2.2,
        brightness: voice === 0 ? 260 : 620,
        attack: 9,
      });
    });
  });

  // A few very long lead tones that slur into their next pitch instead of restarting.
  const leads = [
    { midi: 76, start: 6, length: 30, glides: [{ midi: 74, at: 20, over: 4 }, { midi: 72, at: 30, over: 3 }] },
    { midi: 71, start: 40, length: 26, glides: [{ midi: 72, at: 52, over: 5 }] },
    { midi: 79, start: 62, length: 32, glides: [{ midi: 76, at: 74, over: 6 }, { midi: 74, at: 86, over: 4 }] },
    { midi: 72, start: 102, length: 30, glides: [{ midi: 74, at: 116, over: 4 }, { midi: 76, at: 126, over: 3 }] },
    { midi: 69, start: 136, length: 26, glides: [{ midi: 67, at: 148, over: 5 }] },
    { midi: 76, start: 158, length: 32, glides: [{ midi: 74, at: 170, over: 6 }, { midi: 71, at: 182, over: 4 }] },
  ];
  leads.forEach((lead, index) => {
    drone({
      ...lead,
      level: 0.011,
      pan: index % 2 ? 0.35 : -0.35,
      drive: 5,
      brightness: 1400,
      attack: 6,
    });
  });

  return context.startRendering();
}
