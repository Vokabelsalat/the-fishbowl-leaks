import type { Metadata } from "next";
import { CollectiveWall } from "@/components/collective/CollectiveWall";

export const metadata: Metadata = {
  title: "Shared Activity — The Fishbowl Leaks",
  description: "Where the day's visitors lingered across the exhibition.",
};

export default function HeatmapPage() {
  return <CollectiveWall initialView="heatmap" />;
}
