"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { CollectiveVisualizationField } from "@/components/collective/CollectiveVisualizationField";
import { tankOrbitMilliseconds, type CreatureArrival } from "@/components/collective/CollectiveCreatureField";
import { worldEventIds, worldEventLabels, type WorldEventId, type WorldEventRequest } from "@/components/collective/WorldEvents";
import { CollectiveHeatmap } from "@/components/collective/CollectiveHeatmap";
import { AquariumAudio } from "@/components/collective/AquariumAudio";
import { SpecimenDialog } from "@/components/collective/SpecimenDialog";
import { PathVisualization } from "@/components/visualization/PathVisualization";
import { FitText } from "@/components/ui/FitText";
import { NarrativeLine, NarrativeLines } from "@/components/collective/NarrativeLine";
import { BiomeBackdrop } from "@/components/visualization/BiomeBackdrop";
import { creatureFitMargin } from "@/components/creature/CreatureCanvas";
import { formatRenderStats, type RenderStatsReport } from "@/components/development/RenderStats";
import { meshQualityPresets, minimumMeshQuality, useMeshQuality } from "@/lib/development/renderSettings";
import { activeVisualizationCopy, collectiveCapacity } from "@/config/visualization";
import { compartmentLabels, compartmentWalls, holeHalfHeight, tankBreakdown, tankLook, wallOpening } from "@/lib/collective/tankCompartments";
import { artifacts } from "@/data/artifacts";
import { aggregateContributionDwellTimes } from "@/lib/contributions/heatmap";
import type { CollectiveHeatDatum, ExhibitionContribution } from "@/types/contribution";

const ARRIVAL_DURATION_MS = 17_000;
/** Each visitor waiting for their creature's arrival shortens the current one by this much, down to the shortest. */
const ARRIVAL_SHORTENING_PER_WAITING_MS = 3_000;
const SHORTEST_ARRIVAL_MS = 8_000;

/** How long an arrival lasts while this many more creatures wait for theirs. */
function arrivalDurationFor(waiting: number) {
  return Math.max(SHORTEST_ARRIVAL_MS, ARRIVAL_DURATION_MS - waiting * ARRIVAL_SHORTENING_PER_WAITING_MS);
}
const ARRIVAL_FIT_SCALE = 0.72;
const MINUTES_IN_DAY = 24 * 60 - 1;
// The largest page the contributions API returns.
const pageSize = 100;
const osloClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Oslo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// The test time slider and the switch between the aquarium and the heatmap exist only during development.
const isDevelopment = process.env.NODE_ENV !== "production";
// Debug readout: always on during development, and with `?stats` in the URL on a production server.
const noSubscription = () => () => { };

function minuteOfDay(value: Date | string) {
  const parts = Object.fromEntries(
    osloClock.formatToParts(new Date(value)).map((part) => [part.type, part.value]),
  );
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function formatMinute(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function MeshQualityControl({ quality, onChange }: { quality: number; onChange: (quality: number) => void }) {
  return (
    <div className="flex items-center gap-4" role="group" aria-label="Mesh quality">
      {meshQualityPresets.map((preset) => {
        const checked = Math.abs(quality - preset.quality) < 0.001;
        return (
          <label key={preset.name} className="flex cursor-pointer items-center gap-2 transition-colors hover:text-white/70">
            <input
              type="radio"
              name="mesh-quality"
              className="sr-only"
              checked={checked}
              onChange={() => onChange(preset.quality)}
            />
            <span
              className={`grid size-3.5 place-items-center rounded-full border transition-colors ${checked ? "border-[var(--phosphor)]" : "border-white/30"}`}
              aria-hidden="true"
            >
              <span className={`size-1.5 rounded-full transition-colors ${checked ? "bg-[var(--phosphor)]" : "bg-transparent"}`} />
            </span>
            {preset.name}
          </label>
        );
      })}
      <input
        type="range"
        className="w-24 accent-[var(--phosphor)]"
        aria-label="Mesh quality"
        aria-valuetext={`${Math.round(quality * 100)}% of full segments`}
        min={minimumMeshQuality}
        max="1"
        step="0.05"
        value={quality}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="w-9 tabular-nums">{Math.round(quality * 100)}%</span>
    </div>
  );
}

export function CollectiveWall({ initialView = "collective" }: {
  /** The view the wall opens with; in production it stays there, since the switch exists only during development. */
  initialView?: "collective" | "heatmap";
}) {
  const [contributions, setContributions] = useState<ExhibitionContribution[]>([]);
  const [heatmap, setHeatmap] = useState<CollectiveHeatDatum[]>([]);
  // The poll returns a fresh heatmap every time; only a changed one should re-render the wall.
  const heatmapSignature = useRef("");
  const [view, setView] = useState(initialView);
  const [active, setActive] = useState<ExhibitionContribution | null>(null);
  const [selectedContribution, setSelectedContribution] = useState<ExhibitionContribution | null>(null);
  const [connected, setConnected] = useState(true);
  const [ready, setReady] = useState(false);
  const [clockMinutes, setClockMinutes] = useState(() => minuteOfDay(new Date()));
  const [liveTime, setLiveTime] = useState(true);
  // Development only: each request circles the view once around the tank.
  const [orbitRequest, setOrbitRequest] = useState(0);
  const [orbiting, setOrbiting] = useState(false);
  // Development only: which world event the debug controls fire next, and the last request.
  const [chosenWorldEvent, setChosenWorldEvent] = useState<WorldEventId>(worldEventIds[0]);
  const [worldEventRequest, setWorldEventRequest] = useState<WorldEventRequest | null>(null);
  const [dayCreatureCount, setDayCreatureCount] = useState(0);
  const latestId = useRef(0);
  const initialized = useRef(false);
  const activeRef = useRef<ExhibitionContribution | null>(null);
  const queueRef = useRef<ExhibitionContribution[]>([]);
  // Creatures waiting for their arrival stay out of the tank, the recent stories and the count until their turn.
  const [waitingIds, setWaitingIds] = useState<ReadonlySet<number>>(() => new Set());
  const [arrivalDurationMs, setArrivalDurationMs] = useState(ARRIVAL_DURATION_MS);
  const cycleDateRef = useRef<string | null>(null);
  const syntheticCountRef = useRef<number | null>(null);
  const arrivalCreatureRef = useRef<HTMLDivElement>(null);
  const [releasedArrival, setReleasedArrival] = useState<CreatureArrival | null>(null);
  const renderStatsRef = useRef<HTMLSpanElement>(null);
  const [meshQuality, setMeshQuality] = useMeshQuality();
  // Written straight into the element, so the readout never re-renders the wall.
  const showRenderStatsReport = useCallback((report: RenderStatsReport) => {
    if (renderStatsRef.current) renderStatsRef.current.textContent = formatRenderStats(report);
  }, []);
  const showRenderStats = useSyncExternalStore(
    noSubscription,
    () => isDevelopment || new URLSearchParams(window.location.search).has("stats"),
    () => false,
  );

  const syncWaiting = useCallback(() => {
    setWaitingIds(new Set(queueRef.current.map((contribution) => contribution.id)));
  }, []);

  /** Starts the next creature's arrival, or ends the arrivals; the more visitors are waiting, the shorter it is. */
  const beginArrival = useCallback((next: ExhibitionContribution | null) => {
    activeRef.current = next;
    setActive(next);
    setArrivalDurationMs(arrivalDurationFor(queueRef.current.length));
    syncWaiting();
  }, [syncWaiting]);

  const clearArrivals = useCallback(() => {
    queueRef.current = [];
    beginArrival(null);
  }, [beginArrival]);

  /** Development only: lets a creature already in the tank arrive again, queued like a new one. Nothing is saved. */
  const replayArrival = useCallback(() => {
    const queuedIds = new Set([activeRef.current?.id, ...queueRef.current.map((contribution) => contribution.id)]);
    const candidates = contributions.filter((contribution) => !queuedIds.has(contribution.id));
    const visitorCandidates = candidates.filter((contribution) => !contribution.dailySeed);
    const pool = visitorCandidates.length > 0 ? visitorCandidates : candidates;
    if (pool.length === 0) return;
    queueRef.current.push(pool[Math.floor(Math.random() * pool.length)]);
    if (!activeRef.current) beginArrival(queueRef.current.shift() ?? null);
    else syncWaiting();
  }, [beginArrival, contributions, syncWaiting]);

  useEffect(() => {
    let cancelled = false;

    async function fetchPage(after: number) {
      const response = await fetch(`/api/contributions?after=${after}&limit=${pageSize}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Collective aquarium unavailable");
      return (await response.json()) as {
        contributions: ExhibitionContribution[];
        heatmap: CollectiveHeatDatum[];
        cycleDate: string;
        syntheticCount: number;
        contributionCount: number;
      };
    }

    async function refresh() {
      try {
        const data = await fetchPage(latestId.current);
        // The first load reads the whole day, so only later contributions arrive as new creatures.
        let page = data;
        while (!initialized.current && page.contributions.length === pageSize && !cancelled) {
          page = await fetchPage(page.contributions[page.contributions.length - 1].id);
          data.contributions.push(...page.contributions);
        }
        if (cancelled) return;

        if (cycleDateRef.current && cycleDateRef.current !== data.cycleDate) {
          latestId.current = 0;
          clearArrivals();
          setContributions([]);
        }
        cycleDateRef.current = data.cycleDate;
        setDayCreatureCount(data.contributionCount);

        const syntheticDatasetWasRemoved =
          syntheticCountRef.current !== null &&
          data.syntheticCount < syntheticCountRef.current;
        syntheticCountRef.current = data.syntheticCount;
        if (syntheticDatasetWasRemoved) {
          latestId.current = 0;
          clearArrivals();
          setContributions([]);
          heatmapSignature.current = JSON.stringify(data.heatmap);
          setHeatmap(data.heatmap);
          return;
        }

        if (data.contributions.length > 0) {
          latestId.current = Math.max(...data.contributions.map((item) => item.id));
          setContributions((current) => {
            const known = new Set(current.map((item) => item.id));
            return [...current, ...data.contributions.filter((item) => !known.has(item.id))].slice(-collectiveCapacity);
          });
          // The seed creatures are already in the tank when the day begins, so they never arrive.
          const arrivals = data.contributions.filter((item) => !item.dailySeed);
          if (initialized.current && arrivals.length > 0) {
            queueRef.current.push(...arrivals);
            if (!activeRef.current) beginArrival(queueRef.current.shift() ?? null);
            else syncWaiting();
          }
        }
        const signature = JSON.stringify(data.heatmap);
        if (signature !== heatmapSignature.current) {
          heatmapSignature.current = signature;
          setHeatmap(data.heatmap);
        }
        initialized.current = true;
        setConnected(true);
        setReady(true);
      } catch {
        if (!cancelled) {
          setConnected(false);
          setReady(true);
        }
      }
    }

    refresh();
    const interval = window.setInterval(refresh, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [beginArrival, clearArrivals, syncWaiting]);

  useEffect(() => {
    if (!orbiting) return;
    const timeout = window.setTimeout(() => setOrbiting(false), tankOrbitMilliseconds);
    return () => window.clearTimeout(timeout);
  }, [orbiting]);

  useEffect(() => {
    if (!liveTime) return;
    const updateClock = () => setClockMinutes(minuteOfDay(new Date()));
    updateClock();
    const interval = window.setInterval(updateClock, 30_000);
    return () => window.clearInterval(interval);
  }, [liveTime]);

  useEffect(() => {
    if (!active) return;
    const rect = arrivalCreatureRef.current?.getBoundingClientRect();
    setReleasedArrival({
      id: active.id,
      rect: rect && { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      fill: creatureFitMargin * ARRIVAL_FIT_SCALE,
    });
    const timeout = window.setTimeout(() => beginArrival(queueRef.current.shift() ?? null), arrivalDurationMs);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [active, arrivalDurationMs, beginArrival]);

  const visibleContributions = useMemo(
    () => contributions.filter(
      (contribution) => !waitingIds.has(contribution.id) && minuteOfDay(contribution.createdAt) <= clockMinutes,
    ),
    [clockMinutes, contributions, waitingIds],
  );
  const visibleActive = liveTime && active && minuteOfDay(active.createdAt) <= clockMinutes ? active : null;
  const habitatCreatures = useMemo(
    () => visibleContributions.filter(
      (contribution) => contribution.id !== visibleActive?.id || contribution.id === releasedArrival?.id,
    ),
    [releasedArrival?.id, visibleActive?.id, visibleContributions],
  );
  // The arriving creature's story shows in its own panel, and joins the recent stories once it has arrived.
  const recentContributions = useMemo(
    () => visibleContributions.filter((contribution) => contribution.id !== visibleActive?.id).slice(-5).reverse(),
    [visibleActive?.id, visibleContributions],
  );
  const visibleHeatmap = useMemo(
    () => liveTime
      ? heatmap
      : aggregateContributionDwellTimes(
        visibleContributions.filter((contribution) => !contribution.dailySeed),
        artifacts.map((artifact) => artifact.id),
      ),
    [heatmap, liveTime, visibleContributions],
  );
  const latestContribution = recentContributions[0];
  const previousContributions = recentContributions.slice(1);
  const dayProgress = clockMinutes / MINUTES_IN_DAY;
  // The walls break with every visitor's creature of the day; the seed creatures the tank opens with
  // break nothing. Only the latest are loaded, and the ones left out are older than all of them, so
  // they count as released once the oldest loaded one is, and not at an earlier test time.
  const loadedVisitorCreatures = contributions.filter((contribution) => !contribution.dailySeed);
  const visibleVisitorCreatures = visibleContributions.filter((contribution) => !contribution.dailySeed);
  const leftOutVisitorCount = visibleVisitorCreatures[0] && visibleVisitorCreatures[0].id === loadedVisitorCreatures[0]?.id
    ? Math.max(0, dayCreatureCount - loadedVisitorCreatures.length)
    : 0;
  const breakdown = tankBreakdown(visibleVisitorCreatures.length + leftOutVisitorCount);
  const look = tankLook(breakdown);
  const wallStyle = {
    "--tank-progress": dayProgress,
    "--tank-breakdown": breakdown,
    "--tank-blue": look.blue,
    "--tank-sea": look.sea,
  } as CSSProperties;

  return (
    <main className="collective-wall biome-field film-grain relative h-screen overflow-hidden bg-[var(--abyss)] text-[var(--foam)]" style={wallStyle} aria-label={`Collective exhibition ${activeVisualizationCopy.collectivePlace}`}>
      <div className="tank-open-sea pointer-events-none absolute inset-0" aria-hidden="true" />
      <BiomeBackdrop progress={dayProgress} surfaceRays />
      {/* The separators are drawn flat over the tank, so they fade out while the view circles it. */}
      <div className={`tank-compartments pointer-events-none absolute inset-0 transition-opacity duration-700 ${orbiting ? "opacity-0" : ""}`} aria-hidden="true">
        {compartmentLabels.map((label, index) => (
          <div key={label} className={`tank-compartment tank-compartment-${index + 1}`}><span>{label}</span></div>
        ))}
        {compartmentWalls.map((wall, index) => {
          const opening = wallOpening(breakdown, index);
          const gap = holeHalfHeight(opening) * 100;
          return (
            <div
              key={wall.position}
              className="compartment-wall"
              style={{
                "--wall-left": `${wall.position * 100}%`,
                "--wall-open": opening,
                "--wall-hole": wall.hole * 100,
                "--wall-top-height": `${Math.max(0, wall.hole * 100 - gap)}%`,
                "--wall-bottom-height": `${Math.max(0, 100 - wall.hole * 100 - gap)}%`,
              } as CSSProperties}
            >
              <i className="compartment-wall-top" />
              <i className="compartment-wall-bottom" />
              <b className="compartment-breach" />
            </div>
          );
        })}
      </div>
      <div className={`compartment-flows pointer-events-none absolute inset-0 transition-opacity duration-700 ${orbiting ? "opacity-0" : ""}`} aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      {view === "collective" ? (
        <div className="collective-swim-field absolute" aria-live="polite">
          <CollectiveVisualizationField
            contributions={habitatCreatures}
            progress={dayProgress}
            breakdown={breakdown}
            arrival={releasedArrival}
            onSelectContribution={setSelectedContribution}
            onRenderStats={showRenderStats ? showRenderStatsReport : undefined}
            mergeStaticMeshes
            batchMeshes
            reduceGeometryDetail
            meshQuality={meshQuality}
            orbitRequest={orbitRequest}
            worldEventRequest={worldEventRequest}
          />
        </div>
      ) : (
        <CollectiveHeatmap data={visibleHeatmap} />
      )}

      {/* Above the arrival overlay, so the debug controls stay usable during an arrival. */}
      <header className="absolute inset-x-0 top-0 z-50 flex items-center justify-between">
        <div className="p-8">
          <h1 className="font-display text-xl tracking-[-0.03em] lg:text-2xl">The Fishbowl Leaks</h1>
          {/* The heatmap page stays silent, so it never plays over the aquarium beside it. */}
          {initialView === "collective" && <AquariumAudio />}
          {/* <p className="mt-1 text-sm text-white/45">Shared aquarium · daily cycle</p> */}
        </div>
        {isDevelopment && <div className="absolute left-1/2 flex -translate-x-1/2 rounded-full border border-white/12 bg-black/20 p-1 text-[10px] tracking-[0.18em] backdrop-blur-md" role="group" aria-label="Collective view">
          <button
            type="button"
            className={`rounded-full px-4 py-2 transition-colors ${view === "collective" ? "bg-white/12 text-white/85" : "text-white/35 hover:text-white/60"}`}
            aria-pressed={view === "collective"}
            onClick={() => setView("collective")}
          >
            Aquarium
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 transition-colors ${view === "heatmap" ? "bg-white/12 text-white/85" : "text-white/35 hover:text-white/60"}`}
            aria-pressed={view === "heatmap"}
            onClick={() => setView("heatmap")}
          >
            Activity
          </button>
        </div>}
        <div className="flex items-center gap-6 text-xs tracking-[0.18em] text-white/42 p-8">
          {/* Debug controls sit on their own row, so they never run into the view switch. */}
          {showRenderStats && view === "collective" && (
            <div className="absolute right-8 top-20 flex items-center gap-6">
              {isDevelopment && (
                <button
                  type="button"
                  className="transition-colors hover:text-white/70 disabled:cursor-wait disabled:text-white/25"
                  disabled={orbiting}
                  onClick={() => {
                    setOrbitRequest((request) => request + 1);
                    setOrbiting(true);
                  }}
                >
                  Circle the tank
                </button>
              )}
              {isDevelopment && (
                <button
                  type="button"
                  className="transition-colors hover:text-white/70 disabled:text-white/25"
                  disabled={contributions.length === 0}
                  onClick={replayArrival}
                >
                  Test an arrival
                </button>
              )}
              {isDevelopment && (
                <span className="flex items-center gap-3">
                  <select
                    aria-label="World event to fire"
                    value={chosenWorldEvent}
                    onChange={(event) => setChosenWorldEvent(event.target.value as WorldEventId)}
                    className="cursor-pointer bg-transparent text-white/70 transition-colors hover:text-white"
                  >
                    {worldEventIds.map((id) => (
                      <option key={id} value={id} className="bg-[var(--abyss)]">{worldEventLabels[id]}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="transition-colors hover:text-white/70"
                    onClick={() => setWorldEventRequest((request) => ({ id: chosenWorldEvent, nonce: (request?.nonce ?? 0) + 1 }))}
                  >
                    Fire event
                  </button>
                </span>
              )}
              <MeshQualityControl quality={meshQuality} onChange={setMeshQuality} />
              <span ref={renderStatsRef} aria-hidden="true" />
            </div>
          )}
          <span>{visibleContributions.length} {visibleContributions.length === 1 ? activeVisualizationCopy.singular : activeVisualizationCopy.plural}</span>
          {/* <span className="flex items-center gap-2">
            <span className={`size-1.5 rounded-full ${connected ? "bg-emerald-300" : "bg-amber-300"}`} aria-hidden="true" />
            {connected ? "listening" : "reconnecting"}
          </span> */}
        </div>
      </header>

      {isDevelopment && !visibleActive && <input
        className="tank-time-slider absolute inset-x-0 bottom-[var(--collective-recents-height)] z-40 w-full translate-y-1/2"
        type="range"
        aria-label="Test time of day"
        aria-valuetext={`${formatMinute(clockMinutes)}, ${liveTime ? "following live time" : "fixed test time"}`}
        title="Double-click to return to live time"
        min="0"
        max={MINUTES_IN_DAY}
        step="1"
        value={clockMinutes}
        onChange={(event) => {
          setLiveTime(false);
          setClockMinutes(Number(event.target.value));
        }}
        onDoubleClick={() => setLiveTime(true)}
      />}

      {/* The tank stays ordered, with only its seed creatures, until the first visitor's creature arrives. */}
      {view === "collective" && visibleVisitorCreatures.length === 0 && ready && (
        <div className="absolute inset-0 flex items-center justify-center text-center">
          <div>
            <div className="mx-auto mb-8 size-2 rounded-full bg-white/70 shadow-[0_0_32px_10px_rgba(255,255,255,.24)] animate-breathe" />
            <p className="font-display text-3xl text-white/72">The tank is ordered. For now.</p>
            <p className="mt-3 text-sm text-white/40">Waiting for further visitor specimen</p>
          </div>
        </div>
      )}

      {view === "collective" && visibleActive && (
        // An overlay over the tank and the recent stories, which both carry on as before underneath.
        <section key={visibleActive.id} className="collective-arrival pointer-events-none absolute inset-0 z-40" style={{ "--arrival-duration": `${arrivalDurationMs}ms` } as CSSProperties} aria-label={`A new visitor ${activeVisualizationCopy.singular} has arrived`}>
          <div className="collective-arrival-habitat absolute left-0 top-0" aria-label={`New ${activeVisualizationCopy.singular} entering the aquarium`}>
            <div ref={arrivalCreatureRef} className="collective-arrival-origin absolute left-[7%] top-[16%] h-[65%] w-[78%]" aria-hidden="true" />
          </div>
          <div className="collective-story absolute inset-y-0 right-0 flex min-h-0 min-w-0 flex-col overflow-hidden px-[clamp(1.25rem,3vw,3.5rem)] pb-[clamp(1.5rem,5vh,3.5rem)] pt-[clamp(7rem,17vh,11rem)]">
            <div className="collective-story-heading shrink-0 border-b border-white/25 pb-5">
              <h2 className="font-display text-[clamp(1.5rem,2.3vw,2.7rem)] leading-tight tracking-[-0.03em]">A new specimen has entered the tank</h2>
              <p className="mt-3 text-base text-white/75">
                Made from {visibleActive.parts.length} exhibition {visibleActive.parts.length === 1 ? "encounter" : "encounters"}
              </p>
            </div>
            <div className="collective-story-status shrink-0 border-b border-white/25 py-5 font-mono text-sm leading-relaxed text-white/75">
              Specimen {String(visibleActive.id).padStart(3, "0")} has been successfully <s>classified</s> <s>contained</s> <s>understood</s>
            </div>
            {/* A long story shrinks its text to fit the panel's remaining height, like the latest story below. */}
            <div className="collective-story-narrative flex min-h-0 flex-1 flex-col pt-6">
              <FitText className="font-display text-[clamp(1.3rem,1.8vw,2rem)] leading-[1.22] tracking-[-0.025em]">
                {visibleActive.narrative.map((line, index) => (
                  // The gap between lines shrinks with the text.
                  <p key={`${index}-${line}`} className="mb-[0.6em] last:mb-0"><NarrativeLine line={line} /></p>
                ))}
              </FitText>
            </div>
          </div>
        </section>
      )}

      {view === "collective" && latestContribution && (
        <aside
          className="collective-recents absolute inset-x-0 bottom-0 z-30 pb-6 lg:pb-7"
          aria-label={`Most recently shared stories and ${activeVisualizationCopy.plural}`}
        >
          <div className="collective-recents-grid grid h-full grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] pt-4">
            <article className="collective-recents-latest grid h-full min-h-0 min-w-0 grid-cols-[clamp(7rem,9vw,9rem)_1fr] grid-rows-[minmax(0,1fr)] items-center gap-5 border-r border-white/12 pr-8">
              <div className="aspect-square w-full">
                <PathVisualization
                  artifactIds={latestContribution.parts.map((part) => part.artifactId)}
                  contribution={latestContribution}
                  compact
                  zoom={34}
                  label={`Latest ${activeVisualizationCopy.singular} with ${latestContribution.parts.length} parts`}
                />
              </div>
              {/* A long story shrinks its text to fit instead of growing past the panel. */}
              <div className="flex h-full min-h-0 min-w-0 flex-col justify-center">
                <p className="mb-3 shrink-0 text-sm text-white/40">Latest released story</p>
                <FitText className="font-display text-[clamp(1.15rem,1.45vw,1.75rem)] leading-[1.12] tracking-[-0.025em] text-white/82">
                  {/* One flowing paragraph uses the panel's width, so long stories need fewer lines and keep a larger size. */}
                  <p><NarrativeLines lines={latestContribution.narrative} /></p>
                </FitText>
                <p className="mt-4 shrink-0 text-[10px] tracking-[0.2em] text-white/30">
                  {latestContribution.parts.length} {latestContribution.parts.length === 1 ? "encounter" : "encounters"}
                </p>
              </div>
            </article>

            <div className="collective-recents-previous grid min-h-0 min-w-0 grid-cols-2 grid-rows-2 gap-x-5 gap-y-2 pl-8">
              {previousContributions.map((contribution, index) => (
                <article key={contribution.id} className="grid min-w-0 grid-cols-[minmax(0,4.5rem)_1fr] items-center gap-3">
                  <div className="aspect-square w-full opacity-75">
                    <PathVisualization
                      artifactIds={contribution.parts.map((part) => part.artifactId)}
                      contribution={contribution}
                      compact
                      label={`Recent ${activeVisualizationCopy.singular} ${index + 2} with ${contribution.parts.length} parts`}
                    />
                  </div>
                  <p className="line-clamp-4 font-display text-sm leading-[1.15] tracking-[-0.015em] text-white/60">
                    <NarrativeLines lines={contribution.narrative} />
                  </p>
                </article>
              ))}
            </div>
          </div>
        </aside>
      )}

      {view === "collective" && (
        <a
          className="collective-qr absolute z-30 flex flex-col items-center gap-2 text-base text-[var(--foam)]"
          href="https://aar.kusnick.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Scan to open the exhibition on your phone at aar.kusnick.com"
        >
          <span className="text-center text-sm leading-5">Contribute your own story creature!</span>
          <Image src="/images/exhibition-qr.svg" alt="QR code linking to https://aar.kusnick.com" width={164} height={164} className="block h-auto w-full" unoptimized />
          <span className="whitespace-nowrap text-sm leading-5">aar.kusnick.com</span>
        </a>
      )}

      {selectedContribution && (
        <SpecimenDialog
          contribution={selectedContribution}
          onClose={() => setSelectedContribution(null)}
        />
      )}
    </main>
  );
}
