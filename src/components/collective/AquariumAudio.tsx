"use client";

import { useEffect, useState } from "react";
import { aquariumTracks } from "@/lib/audio/aquariumTracks";

const BACKGROUND_VOLUME = 0.25;

/**
 * Unattended exhibition playback; the display has no visitor audio controls. The recorded tracks
 * stream one after another and loop, so only a few seconds of audio are ever held in memory.
 */
export function AquariumAudio() {
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);

  useEffect(() => {
    if (typeof AudioContext === "undefined") return;
    const context = new AudioContext();
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(context.destination);
    const audio = new Audio();
    audio.preload = "auto";
    context.createMediaElementSource(audio).connect(gain);
    let disposed = false;
    let trackIndex = 0;
    let fadedIn = false;

    function showTrack() {
      if (disposed) return;
      setCurrentTrack(!audio.paused && context.state === "running" ? aquariumTracks[trackIndex].title : null);
    }

    function load(index: number) {
      trackIndex = index;
      audio.src = aquariumTracks[index].src;
    }

    async function play() {
      if (disposed) return;
      try {
        await context.resume();
        await audio.play();
        if (!fadedIn) {
          fadedIn = true;
          gain.gain.setTargetAtTime(BACKGROUND_VOLUME, context.currentTime, 1.5);
        }
      } catch {
        // Autoplay is blocked until the first gesture; play() runs again then.
      }
      showTrack();
    }

    function next() {
      load((trackIndex + 1) % aquariumTracks.length);
      void play();
    }

    function failed() {
      if (!disposed) console.error(`Aquarium soundtrack could not play ${aquariumTracks[trackIndex].src}`);
    }

    load(0);
    audio.addEventListener("ended", next);
    audio.addEventListener("error", failed);
    audio.addEventListener("playing", showTrack);
    audio.addEventListener("pause", showTrack);
    context.addEventListener("statechange", showTrack);
    // Retry within gestures even if an earlier autoplay attempt is pending.
    window.addEventListener("pointerdown", play);
    window.addEventListener("keydown", play);
    void play();

    return () => {
      disposed = true;
      window.removeEventListener("pointerdown", play);
      window.removeEventListener("keydown", play);
      audio.removeEventListener("ended", next);
      audio.removeEventListener("error", failed);
      audio.removeEventListener("playing", showTrack);
      audio.removeEventListener("pause", showTrack);
      context.removeEventListener("statechange", showTrack);
      audio.pause();
      audio.removeAttribute("src");
      gain.disconnect();
      void context.close().catch(() => undefined);
    };
  }, []);

  // The playing track is named only during development; the exhibition plays it unannounced.
  return currentTrack && process.env.NODE_ENV !== "production" ? (
    <p className="mt-2 font-display text-xl leading-snug" role="status">
      Playing: {currentTrack}
    </p>
  ) : null;
}
