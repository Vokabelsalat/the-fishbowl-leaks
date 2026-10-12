import { renderAquariumScore } from "./aquariumScore";
import { renderAquariumDrift } from "./aquariumDrift";
import { renderAquariumHarp } from "./aquariumHarp";
import { aquariumTracks } from "./aquariumTracks";

/** The synthesizer behind each recorded track, in playlist order. */
const renderers = [renderAquariumScore, renderAquariumDrift, renderAquariumHarp];

/** Sample rate of the recordings: CD quality, which the AAC files keep. */
export const recordingRate = 44100;

/**
 * Synthesizes one track for recording, fading it in and out over two seconds so the tracks
 * follow one another without clicks.
 */
export async function renderAquariumTrack(index: number) {
  const track = await renderers[index](recordingRate);
  const fade = track.sampleRate * 2;
  for (let channel = 0; channel < track.numberOfChannels; channel += 1) {
    const data = track.getChannelData(channel);
    for (let sample = 0; sample < data.length; sample += 1) {
      data[sample] *= Math.min(1, sample / fade, (data.length - 1 - sample) / fade);
    }
  }
  return track;
}

/** The track as a 16-bit PCM WAV file. */
export function encodeWav(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytes = new DataView(new ArrayBuffer(44 + frames * channels * 2));
  const text = (offset: number, value: string) => [...value].forEach((character, index) => bytes.setUint8(offset + index, character.charCodeAt(0)));
  text(0, "RIFF");
  bytes.setUint32(4, 36 + frames * channels * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  bytes.setUint32(16, 16, true);
  bytes.setUint16(20, 1, true);
  bytes.setUint16(22, channels, true);
  bytes.setUint32(24, buffer.sampleRate, true);
  bytes.setUint32(28, buffer.sampleRate * channels * 2, true);
  bytes.setUint16(32, channels * 2, true);
  bytes.setUint16(34, 16, true);
  text(36, "data");
  bytes.setUint32(40, frames * channels * 2, true);
  const data = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, data[channel][frame]));
      bytes.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([bytes.buffer], { type: "audio/wav" });
}

export { aquariumTracks };
