import { renderAquariumScore } from "./aquariumScore";
import { renderAquariumDrift } from "./aquariumDrift";
import { renderAquariumHarp } from "./aquariumHarp";

export const aquariumTracks = ["Below the glass · ambient", "Pressure drift · drones", "Threads of the tide · harp"];
export const trackSeconds = 96;

export async function renderAquariumPlaylist() {
  const renderers = [renderAquariumScore, renderAquariumDrift, renderAquariumHarp];
  const rate = 22050;
  const playlist = new AudioBuffer({ numberOfChannels: 2, length: rate * trackSeconds * renderers.length, sampleRate: rate });
  let offset = 0;
  // Copy each score before rendering the next to limit temporary memory use.
  for (const render of renderers) {
    const track = await render();
    for (let channel = 0; channel < 2; channel += 1) {
      const output = playlist.getChannelData(channel);
      const input = track.getChannelData(channel);
      const fade = track.sampleRate * 2;
      for (let index = 0; index < input.length; index += 1) {
        const envelope = Math.min(1, index / fade, (input.length - 1 - index) / fade);
        output[offset + index] = input[index] * envelope;
      }
    }
    offset += track.length;
  }
  return playlist;
}
