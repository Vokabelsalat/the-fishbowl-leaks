"use client";

import { useEffect, useRef, useState } from "react";
import { aquariumTracks, encodeWav, renderAquariumTrack } from "@/lib/audio/aquariumPlaylist";

type TrackState = "waiting" | "rendering" | "saving" | `saved ${number} KB` | `failed: ${string}`;

/**
 * Synthesizes every aquarium track and has the development server save it as an AAC file in
 * public/audio, where the wall streams it from. `?auto` starts recording on load.
 */
export function SoundtrackRecorder() {
  const [states, setStates] = useState<TrackState[]>(() => aquariumTracks.map(() => "waiting"));
  const [recording, setRecording] = useState(false);
  const started = useRef(false);

  const record = async () => {
    setRecording(true);
    const update = (index: number, state: TrackState) => setStates((current) => current.map((value, at) => (at === index ? state : value)));
    for (const [index] of aquariumTracks.entries()) {
      try {
        update(index, "rendering");
        const wav = encodeWav(await renderAquariumTrack(index));
        update(index, "saving");
        const response = await fetch(`/api/development/soundtrack?index=${index}`, { method: "POST", body: wav });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? response.statusText);
        update(index, `saved ${Math.round(result.size / 1024)} KB`);
      } catch (error) {
        update(index, `failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    setRecording(false);
    document.title = "Soundtrack recorded";
  };

  useEffect(() => {
    if (started.current || !new URLSearchParams(window.location.search).has("auto")) return;
    started.current = true;
    void record();
  });

  return (
    <main className="mx-auto min-h-dvh max-w-xl bg-[var(--abyss)] px-6 py-12 text-[var(--foam)]">
      <h1 className="font-display text-4xl tracking-[-0.04em]">Aquarium soundtrack</h1>
      <p className="mt-4 leading-7 text-white/78">
        Synthesizes the three tracks and saves them as AAC files in public/audio, which the wall streams. Record again after changing a track in src/lib/audio.
      </p>
      <ol className="mt-8 grid gap-3">
        {aquariumTracks.map((track, index) => (
          <li key={track.src} className="flex justify-between gap-6 border-b border-white/15 pb-3">
            <span>{track.title}</span>
            <span className="text-white/78">{states[index]}</span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={recording}
        onClick={() => void record()}
        className="mt-8 flex min-h-12 items-center border border-white/40 px-5 text-base transition-colors hover:border-white disabled:opacity-60"
      >
        {recording ? "Recording…" : "Record soundtrack"}
      </button>
    </main>
  );
}
