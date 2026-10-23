"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { artifacts } from "@/data/artifacts";
import {
  artifactPlanLabel,
  collectiveActivityIntensities,
} from "@/lib/contributions/heatmap";
import type { CollectiveHeatDatum } from "@/types/contribution";

const INKSCAPE_NAMESPACE = "http://www.inkscape.org/namespaces/inkscape";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function formatDuration(durationMs: number) {
  if (durationMs <= 0) return "0 min";
  const totalMinutes = Math.round(durationMs / 60_000);
  if (totalMinutes < 1) return "<1 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

function heatColor(intensity: number) {
  const progress = Math.max(0, Math.min(1, intensity));
  const blue = [37, 99, 235];
  const green = [34, 197, 94];
  const channels = blue.map((start, index) =>
    Math.round(start + (green[index] - start) * progress),
  );
  return `rgb(${channels.join(", ")})`;
}

export function CollectiveHeatmap({ data }: { data: CollectiveHeatDatum[] }) {
  const planRef = useRef<HTMLObjectElement>(null);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [mappedArtifactIds, setMappedArtifactIds] = useState<string[]>([]);
  const [showPlanLayer, setShowPlanLayer] = useState(false);

  const stations = useMemo(() => {
    const byId = new Map(data.map((datum) => [datum.artifactId, datum]));
    const combined = artifacts.map((artifact) => ({
      artifact,
      datum: byId.get(artifact.id) ?? {
        artifactId: artifact.id,
        totalDwellMs: 0,
        visitCount: 0,
        averageDwellMs: 0,
      },
    }));
    const intensities = collectiveActivityIntensities(combined.map(({ datum }) => datum));

    return combined
      .map((item) => ({
        ...item,
        intensity: intensities.get(item.artifact.id) ?? 0,
        planLabel: artifactPlanLabel(item.artifact.title),
      }))
      .sort((a, b) => b.intensity - a.intensity);
  }, [data]);

  const stationByPlanLabel = useMemo(
    () => new Map(stations.flatMap((station) => [
      [station.artifact.id, station],
      [station.planLabel, station],
    ] as const)),
    [stations],
  );

  useEffect(() => {
    if (!planLoaded) return;
    const document = planRef.current?.contentDocument;
    const svg = document?.documentElement;
    if (!document || !svg) return;

    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Exhibition plan showing collective visits and dwell time");
    svg.style.width = "100%";
    svg.style.height = "100%";

    const sourceLayer = document.getElementById("layer1") as SVGGraphicsElement | null;
    sourceLayer?.style.setProperty("display", showPlanLayer ? "inline" : "none");
    document.getElementById("collective-heatmap-overlay")?.remove();

    const overlay = document.createElementNS(SVG_NAMESPACE, "g");
    overlay.setAttribute("id", "collective-heatmap-overlay");
    const sourceTransform = sourceLayer?.getAttribute("transform");
    if (sourceTransform) overlay.setAttribute("transform", sourceTransform);

    const mappedIds: string[] = [];
    sourceLayer?.querySelectorAll("rect").forEach((rect) => {
      const label = rect.getAttributeNS(INKSCAPE_NAMESPACE, "label")
        ?? rect.getAttribute("inkscape:label");
      const station = label ? stationByPlanLabel.get(label) : undefined;
      if (!station) return;

      mappedIds.push(station.artifact.id);
      const color = heatColor(station.intensity);
      const active = station.datum.visitCount > 0;
      const heatRect = rect.cloneNode(false) as SVGRectElement;
      heatRect.removeAttribute("id");
      heatRect.removeAttribute("style");
      heatRect.style.fill = color;
      heatRect.style.fillOpacity = active ? String(0.34 + station.intensity * 0.58) : "0.08";
      heatRect.style.stroke = color;
      heatRect.style.strokeOpacity = active ? "1" : "0.38";
      heatRect.style.strokeWidth = active ? "0.85" : "0.35";
      heatRect.style.filter = active
        ? `drop-shadow(0 0 ${1.5 + station.intensity * 4}px ${color})`
        : "none";
      heatRect.style.transition = "fill 500ms ease, fill-opacity 500ms ease, stroke 500ms ease";
      heatRect.style.pointerEvents = "all";

      const title = document.createElementNS(SVG_NAMESPACE, "title");
      title.textContent = `${station.artifact.title}: ${station.datum.visitCount} ${station.datum.visitCount === 1 ? "visit" : "visits"}, ${formatDuration(station.datum.totalDwellMs)} total`;
      heatRect.prepend(title);
      overlay.append(heatRect);
    });
    svg.append(overlay);
    setMappedArtifactIds([...new Set(mappedIds)]);
  }, [planLoaded, showPlanLayer, stationByPlanLabel]);

  const totalVisits = stations.reduce((sum, { datum }) => sum + datum.visitCount, 0);
  const totalDwellMs = stations.reduce((sum, { datum }) => sum + datum.totalDwellMs, 0);
  const mappedIds = new Set(mappedArtifactIds);
  const hottest = stations.find((station) => mappedIds.has(station.artifact.id)) ?? stations[0];

  return (
    <section
      className="collective-plan-heatmap absolute inset-x-0 bottom-0 top-52 z-10 grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)] gap-8 px-8 pb-8 lg:px-12"
      aria-label="Collective activity on the exhibition plan"
    >
      <figure className="collective-plan-stage relative min-h-0 overflow-hidden border border-white/10 bg-black/20">
        <object
          ref={planRef}
          className="collective-plan-object block size-full"
          data="/plan.svg"
          type="image/svg+xml"
          aria-label="Exhibition floor plan heatmap"
          onLoad={() => setPlanLoaded(true)}
        >
          <p>The exhibition plan could not be loaded.</p>
        </object>
        {!planLoaded && (
          <div className="absolute inset-0 grid place-items-center bg-[var(--abyss)] text-base text-white/60">
            Loading exhibition plan…
          </div>
        )}
        <figcaption className="sr-only">
          Blue areas received less collective activity; green areas received the most visits and dwell time.
        </figcaption>
      </figure>

      <aside className="flex min-h-0 flex-col justify-between py-1">
        <div>
          <p className="font-display text-[clamp(1.35rem,2vw,2.2rem)] leading-tight text-white/90">
            {hottest?.datum.visitCount
              ? `${hottest.artifact.title} holds the most attention`
              : "Waiting for visitor activity"}
          </p>
          <p className="mt-3 text-base leading-relaxed text-white/55">
            {totalVisits} {totalVisits === 1 ? "visit" : "visits"} · {formatDuration(totalDwellMs)} together
          </p>
          <p className="mt-6 text-sm text-white/45">
            {mappedArtifactIds.length} {mappedArtifactIds.length === 1 ? "artwork is" : "artworks are"} positioned in the current plan.
          </p>
        </div>

        <ol className="my-6 min-h-0 space-y-3 overflow-hidden" aria-label="Most active artworks">
          {stations.slice(0, 5).map(({ artifact, datum, intensity }) => (
            <li key={artifact.id} className="grid grid-cols-[.75rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: heatColor(intensity), opacity: datum.visitCount > 0 ? 1 : 0.25 }}
                aria-hidden="true"
              />
              <span className="truncate text-white/75">{artifact.title}</span>
              <span className="text-white/45">{formatDuration(datum.totalDwellMs)}</span>
            </li>
          ))}
        </ol>

        <div>
          <div className="collective-plan-legend h-3 w-full" aria-hidden="true" />
          <div className="mt-2 flex justify-between text-sm text-white/50">
            <span>Fewer visits, less time</span>
            <span>More visits, more time</span>
          </div>
          <button
            type="button"
            className="mt-5 min-h-11 w-full border border-white/15 px-4 text-sm text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-pressed={showPlanLayer}
            onClick={() => setShowPlanLayer((visible) => !visible)}
          >
            {showPlanLayer ? "Hide plan layer (debug)" : "Show plan layer (debug)"}
          </button>
        </div>
      </aside>
    </section>
  );
}
