import type { AquaticForm } from "@/lib/creature/aquaticForms";

/** One creature in the ensemble: where it stands, how large it is and which way it looks. */
export type Role = { form: AquaticForm; position: [number, number, number]; scale: number; turn: number; tilt?: number; traits: [number, number] };

// The billing order of a movie poster: a looming antagonist above, the hero in the middle,
// supporting cast around it and the bottom dwellers along the floor.
// Turning by -π/2 brings a creature's head (+x) round to face the camera, like a cast lined up for its portrait.
const facing = -Math.PI / 2;

export const cast: Role[] = [
  { form: "whale", position: [1.5, 4.3, -10], scale: 2.6, turn: facing - 0.4, traits: [3, 5] },
  { form: "octopus", position: [-2.45, 3.1, -4], scale: 1, turn: 0.2, tilt: -0.1, traits: [3, 5] },
  { form: "narwhal", position: [2.5, 1.7, -2], scale: 0.72, turn: facing - 0.5, traits: [2, 4] },
  { form: "jellyfish", position: [-2.55, 0.45, -1], scale: 0.6, turn: 0.2, traits: [2, 3] },
  { form: "fish", position: [-0.05, 0.45, 1.5], scale: 1.6, turn: facing + 0.42, traits: [4, 6] },
  { form: "seal", position: [2.3, -0.65, 0], scale: 0.62, turn: facing - 0.4, traits: [2, 3] },
  { form: "seahorse", position: [-2.05, -1.05, 1], scale: 0.5, turn: facing + 0.55, traits: [2, 3] },
  { form: "pufferfish", position: [-0.75, -1.6, 2.2], scale: 0.38, turn: facing + 0.3, traits: [2, 3] },
  { form: "dolphin", position: [1.05, -1.6, 1.6], scale: 0.48, turn: facing - 0.5, traits: [2, 3] },
  { form: "crab", position: [-1.95, -2.08, 1.8], scale: 0.42, turn: 0.3, traits: [2, 3] },
  { form: "clam", position: [0.2, -2.08, 2.0], scale: 0.44, turn: 0, traits: [1, 2] },
  { form: "starfish", position: [2.2, -2.05, 1.6], scale: 0.3, turn: 0, tilt: 0.9, traits: [1, 2] },
  // Later arrivals join the end of the cast, so the creatures and pose links of earlier posters stay as they were.
  { form: "turtle", position: [2.2, 4.15, -2], scale: 0.6, turn: facing + 0.35, tilt: 0.12, traits: [2, 4] },
  { form: "ray", position: [-1.35, 4.85, -3], scale: 0.5, turn: 0.3, tilt: -0.2, traits: [2, 3] },
  { form: "shrimp", position: [1.3, -1.75, 2.4], scale: 0.22, turn: 0.4, traits: [1, 2] },
];
