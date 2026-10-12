import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SoundtrackRecorder } from "@/components/development/SoundtrackRecorder";

export const metadata: Metadata = {
  title: "Soundtrack — The Fishbowl Leaks",
  description: "Synthesizes the aquarium soundtrack and records it as audio files.",
};

export default function SoundtrackPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SoundtrackRecorder />;
}
