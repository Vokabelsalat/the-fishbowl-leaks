"use client";

import { useEffect, useState } from "react";
import { aquariumTracks, renderAquariumPlaylist, trackSeconds } from "@/lib/audio/aquariumPlaylist";

const BACKGROUND_VOLUME = 0.25;

/** Unattended exhibition playback; the display has no visitor audio controls. */
export function AquariumAudio() {
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);

  useEffect(() => {
    if (typeof AudioContext === "undefined") return;
    const context = new AudioContext();
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(context.destination);
    let disposed = false;
    let rendering = false;
    let source: AudioBufferSourceNode | undefined;
    let startedAt = 0;

    function updateCurrentTrack() {
      if (disposed) return;
      if (!source || context.state !== "running") {
        setCurrentTrack(null);
        return;
      }
      const index = Math.floor((context.currentTime - startedAt) / trackSeconds) % aquariumTracks.length;
      setCurrentTrack(aquariumTracks[index]);
    }

    async function startPlaylist() {
      if (disposed || rendering || source || context.state !== "running") return;
      rendering = true;
      try {
        const buffer = await renderAquariumPlaylist();
        if (disposed) return;
        source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gain);
        startedAt = context.currentTime;
        source.start(startedAt);
        gain.gain.setTargetAtTime(BACKGROUND_VOLUME, context.currentTime, 1.5);
        updateCurrentTrack();
      } catch (error) {
        if (!disposed) console.error("Aquarium soundtrack could not start", error);
      } finally {
        rendering = false;
      }
    }

    function resume() {
      if (disposed) return;
      // Retry within gestures even if an earlier autoplay resume is pending.
      void context.resume().then(startPlaylist).catch(() => undefined);
    }

    context.addEventListener("statechange", startPlaylist);
    context.addEventListener("statechange", updateCurrentTrack);
    const trackTimer = window.setInterval(updateCurrentTrack, 1000);
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
    resume();

    return () => {
      disposed = true;
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      context.removeEventListener("statechange", startPlaylist);
      context.removeEventListener("statechange", updateCurrentTrack);
      window.clearInterval(trackTimer);
      source?.stop();
      gain.disconnect();
      void context.close().catch(() => undefined);
    };
  }, []);

  return currentTrack ? (
    <p className="mt-2 font-display text-xl leading-snug" role="status">
      Playing: {currentTrack}
    </p>
  ) : null;
}
