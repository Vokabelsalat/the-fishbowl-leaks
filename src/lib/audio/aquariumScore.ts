import { trackSeconds } from "./aquariumTrackLength";

/** “Below the glass”: an original 192-second ambient piece at 40 BPM.
 * D minor 9 → B-flat major 7 → F major 9 → C suspended 2, then a second round
 * G minor 9 → B-flat major 9 → D minor 9 → A suspended 4 that leads back home.
 * Long overlapping low pads carry a sparse, returning three-note motif.
 * Render once off the main thread; playback needs no scheduling timers.
 */
export async function renderAquariumScore(rate = 22050): Promise<AudioBuffer> {
  const cycle = trackSeconds;
  const context = new OfflineAudioContext(2, rate * cycle * 2, rate);
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1100;
  filter.Q.value = 0.3;
  filter.connect(context.destination);

  function note(midi: number, start: number, duration: number, level: number, pan: number, bell = false) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const stereo = context.createStereoPanner();
    oscillator.type = bell ? "triangle" : "sine";
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    stereo.pan.value = pan;
    const attack = bell ? 0.7 : 7;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(level, start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.00001, start + duration);
    envelope.gain.linearRampToValueAtTime(0, start + duration + 0.1);
    oscillator.connect(envelope).connect(stereo).connect(filter);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.2);
  }

  const chords = [
    [38, 45, 53, 60, 64], [34, 41, 53, 57, 62], [41, 48, 55, 57, 64], [36, 43, 50, 55, 62],
    [43, 50, 53, 57, 62], [34, 41, 50, 57, 60], [38, 45, 53, 57, 64], [33, 45, 52, 57, 62],
  ];
  const melody = [
    [69, 72, 76], [69, 65, 62], [67, 69, 72], [67, 62, 64],
    [74, 72, 69], [72, 69, 65], [69, 72, 76], [69, 64, 62],
  ];
  for (let repeat = 0; repeat < 2; repeat += 1) {
    chords.forEach((chord, bar) => {
      const start = repeat * cycle + bar * 24;
      chord.forEach((pitch, voice) => {
        note(pitch, start, 34, voice === 0 ? 0.11 : 0.045, (voice - 2) * 0.22);
      });
      melody[bar].forEach((pitch, index) => {
        const at = start + 5 + index * 6;
        note(pitch, at, 9, 0.022, index % 2 ? -0.4 : 0.4, true);
        note(pitch, at + 1.5, 8, 0.008, index % 2 ? 0.5 : -0.5, true);
      });
    });
  }
  const rendered = await context.startRendering();
  // Keep the second cycle: its opening includes the preceding chord's tail.
  const loop = new AudioBuffer({ numberOfChannels: 2, length: rate * cycle, sampleRate: rate });
  for (let channel = 0; channel < 2; channel += 1) {
    loop.copyToChannel(rendered.getChannelData(channel).subarray(rate * cycle), channel);
  }
  // Match endpoints over 20 ms to avoid a discontinuity at the loop seam.
  for (let channel = 0; channel < 2; channel += 1) {
    const data = loop.getChannelData(channel);
    const correction = data[0] - data[data.length - 1];
    const fade = Math.round(rate * 0.02);
    for (let index = 0; index < fade; index += 1) {
      data[data.length - fade + index] += correction * index / (fade - 1);
    }
  }
  return loop;
}
