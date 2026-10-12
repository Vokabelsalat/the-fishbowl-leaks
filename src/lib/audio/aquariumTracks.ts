import { trackSeconds } from "./aquariumTrackLength";

export { trackSeconds };

/**
 * The recorded aquarium soundtrack. The tracks are synthesized once on the development page
 * /soundtrack and saved as AAC files in public/audio; the wall streams them in this order and loops.
 */
export const aquariumTracks = [
  { title: "Below the glass · ambient", src: "/audio/below-the-glass.m4a" },
  { title: "Pressure drift · drones", src: "/audio/pressure-drift.m4a" },
  { title: "Threads of the tide · harp", src: "/audio/threads-of-the-tide.m4a" },
] as const;
