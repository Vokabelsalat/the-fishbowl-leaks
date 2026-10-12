import { trackSeconds } from "./aquariumTrackLength";

/** “Threads of the tide”: an original 192-second harp piece at 40 BPM.
 * Sixteen phrases in D Dorian over Dm9, G6, Cmaj7, Am7: a theme, its variation,
 * a higher second theme, and a closing variation that settles back on D.
 * A plucked harmonic spectrum and quickly fading upper partials evoke harp
 * strings; quiet broken chords support a separate, slowly unfolding melody.
 */
export async function renderAquariumHarp(rate = 22050): Promise<AudioBuffer> {
  const context = new OfflineAudioContext(2, rate * trackSeconds, rate);
  const room = context.createConvolver();
  const impulse = context.createBuffer(2, rate * 4, rate);
  let seed = 4219;
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    let softened = 0;
    for (let index = 0; index < data.length; index += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      softened = softened * 0.65 + (seed / 4294967296 * 2 - 1) * 0.35;
      data[index] = softened * Math.exp(-index / rate * 1.6);
    }
  }
  room.buffer = impulse;
  const wet = context.createGain();
  wet.gain.value = 0.24;
  room.connect(wet).connect(context.destination);

  function pluck(midi: number, at: number, strength: number) {
    const panner = context.createStereoPanner();
    panner.pan.value = Math.max(-0.5, Math.min(0.5, (midi - 62) / 36));
    panner.connect(context.destination);
    panner.connect(room);
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    for (let partial = 1; partial <= 8; partial += 1) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.frequency.value = frequency * partial;
      // Plucking away from the bridge attenuates selected upper harmonics.
      const weight = Math.abs(Math.sin(partial * Math.PI * 0.23)) / partial ** 1.45;
      const decay = (midi < 55 ? 8.5 : 6.5) / (1 + (partial - 1) * 0.42);
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(strength * weight, at + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.00001, at + decay);
      envelope.gain.linearRampToValueAtTime(0, at + decay + 0.06);
      oscillator.connect(envelope).connect(panner);
      oscillator.start(at);
      oscillator.stop(at + decay + 0.1);
    }
  }

  const chords = [[38, 50, 57, 60, 64], [43, 55, 59, 62, 64], [36, 52, 55, 59, 62], [45, 52, 55, 60, 64]];
  const melodies = [
    [69, 72, 74, 76], [74, 71, 69, 67],
    [67, 71, 74, 76], [72, 71, 69, 64],
    [69, 72, 76, 74], [71, 74, 76, 79],
    [76, 74, 71, 67], [69, 64, 62, 64],
    [76, 74, 72, 69], [74, 76, 79, 76],
    [72, 76, 74, 71], [72, 69, 67, 64],
    [69, 74, 72, 76], [79, 76, 74, 71],
    [76, 72, 71, 67], [69, 64, 62],
  ];
  melodies.forEach((melody, phrase) => {
    const at = phrase * 12;
    const chord = chords[phrase % chords.length];
    pluck(chord[0], at + 0.1, 0.14);
    // A gently rising accompaniment leaves space between the melody notes.
    chord.slice(1).forEach((pitch, index) => pluck(pitch, at + 1.45 + index * 1.5, 0.062));
    melody.forEach((pitch, index) => {
      // The last phrase hurries a little into the loop's return.
      const spacing = phrase === melodies.length - 1 ? 2.25 : 3;
      pluck(pitch, at + 0.8 + index * spacing, 0.12 - index * 0.008);
    });
  });
  return context.startRendering();
}
