"use client";

import {
  type CSSProperties,
  forwardRef,
  type ForwardedRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type {
  MindARAdapter as MindARAdapterType,
  TargetDetectionResult,
} from "@/components/ar/MindARAdapter";
import { artifacts, targetImages } from "@/data/artifacts";
import { targetBundleVersion } from "@/data/targetBundle";
import Image from "next/image";
import { BiomeBackdrop } from "@/components/visualization/BiomeBackdrop";
import { exampleTarget, targetExampleCopy } from "@/components/exhibition/targetExample";

const imageTargetSrc = `/api/targets?v=${targetBundleVersion}`;

const orbitCategories = Array.from(
  new Map(artifacts.map(({ theme, color }) => [theme, color])).entries(),
);
const ORBIT_PARTICLES_PER_CATEGORY = 6;
const orbitParticles = orbitCategories.flatMap(
  ([theme, color], categoryIndex) =>
    Array.from({ length: ORBIT_PARTICLES_PER_CATEGORY }, (_, particleIndex) => {
      const categoryCount = orbitCategories.length;
      const sequence = particleIndex * categoryCount + categoryIndex;
      const total = categoryCount * ORBIT_PARTICLES_PER_CATEGORY;

      return {
        id: `${theme}-${particleIndex}`,
        color,
        angle: (sequence / total) * 360 + (particleIndex % 2) * 7,
        duration: 5 + ((sequence * 7) % 5) * 0.65,
        inset: (particleIndex + categoryIndex) % 2 === 0 ? 0 : 4,
        opacity: 0.5 + ((sequence * 3) % 5) * 0.1,
        reverse: sequence % 4 === 0,
        size: 3 + ((sequence * 5) % 3),
      };
    }),
);

export function CategoryOrbit() {
  return (
    <div
      className="relative mx-auto mb-7 size-14 rounded-full border border-white/20"
      aria-hidden="true"
    >
      <div className="absolute inset-1 rounded-full border border-dashed border-white/45" />
      {orbitParticles.map((particle) => (
        <span
          key={particle.id}
          className="category-orbit absolute rounded-full"
          style={
            {
              "--orbit-angle": `${particle.angle}deg`,
              animationDirection: particle.reverse ? "reverse" : "normal",
              animationDuration: `${particle.duration}s`,
              inset: particle.inset,
            } as CSSProperties
          }
        >
          <span
            className="absolute left-1/2 -translate-x-1/2 rounded-full"
            style={{
              backgroundColor: particle.color,
              boxShadow: `0 0 7px ${particle.color}`,
              height: particle.size,
              opacity: particle.opacity,
              top: -particle.size / 2,
              width: particle.size,
            }}
          />
        </span>
      ))}
    </div>
  );
}

type ScannerState = "idle" | "starting" | "running" | "paused" | "error";

type ARScannerProps = {
  autoStart?: boolean;
  onTargetFound: (targetIndex: number) => TargetDetectionResult;
  onTargetLost: (targetIndex: number) => void;
  onUseSimulator: () => void;
  simulatorVisible: boolean;
  /** Until the first artwork is scanned, the camera view shows a faint example of a marker. */
  showTargetHint?: boolean;
};

export type ARScannerHandle = {
  dismissArtifact: (targetIndex: number) => void;
};

function ARScannerComponent(
  {
    autoStart = false,
    onTargetFound,
    onTargetLost,
    onUseSimulator,
    simulatorVisible,
    showTargetHint = false,
  }: ARScannerProps,
  ref: ForwardedRef<ARScannerHandle>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<MindARAdapterType | null>(null);
  const autoStartAttemptedRef = useRef(false);
  const startAttemptRef = useRef(0);
  const onTargetFoundRef = useRef(onTargetFound);
  const onTargetLostRef = useRef(onTargetLost);
  const [scannerState, setScannerState] = useState<ScannerState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useImperativeHandle(
    ref,
    () => ({
      dismissArtifact: (targetIndex) => {
        adapterRef.current?.dismissArtifact(targetIndex);
      },
    }),
    [],
  );

  // Fetch the tracker and its targets while the visitor reads the intro, not after they tap.
  useEffect(() => {
    let cancelled = false;
    void import("@/components/ar/MindARAdapter")
      .then(({ preloadMindAR }) => {
        if (!cancelled) preloadMindAR(imageTargetSrc);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onTargetFoundRef.current = onTargetFound;
    onTargetLostRef.current = onTargetLost;
  }, [onTargetFound, onTargetLost]);

  const stopScanner = useCallback(async () => {
    startAttemptRef.current += 1;
    const adapter = adapterRef.current;
    adapterRef.current = null;
    if (adapter) await adapter.stop();
  }, []);

  const startScanner = useCallback(async () => {
    const container = containerRef.current;
    if (!container || scannerState === "starting") return;
    setScannerState("starting");
    setErrorMessage("");

    try {
      await stopScanner();
      const attempt = startAttemptRef.current;
      const { MindARAdapter } = await import("@/components/ar/MindARAdapter");
      if (attempt !== startAttemptRef.current) return;
      const adapter = new MindARAdapter({
        imageTargetSrc,
        targets: artifacts.map(
          ({ id, targetIndex, particleForm, color }) => ({
            id,
            targetIndex,
            particleForm,
            color,
            // exhibition.mind holds one white target per artifact, and dark ones from the poster for some.
            anchorIndices: targetImages
              .filter((target) => target.artifact.id === id)
              .map((target) => target.anchorIndex),
          }),
        ),
        onTargetFound: (targetIndex) => onTargetFoundRef.current(targetIndex),
        onTargetLost: (targetIndex) => onTargetLostRef.current(targetIndex),
      });
      adapterRef.current = adapter;
      await adapter.start(container);
      if (attempt !== startAttemptRef.current) {
        await adapter.stop();
        return;
      }
      setScannerState("running");
    } catch (error) {
      const cancelled = adapterRef.current === null;
      adapterRef.current = null;
      if (cancelled) return;
      setScannerState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The AR scanner could not be started.",
      );
    }
  }, [scannerState, stopScanner]);

  useEffect(() => {
    if (!autoStart || autoStartAttemptedRef.current) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || autoStartAttemptedRef.current) return;
      autoStartAttemptedRef.current = true;
      void startScanner();
    });

    return () => {
      cancelled = true;
    };
  }, [autoStart, startScanner]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && adapterRef.current) {
        void stopScanner();
        setScannerState("paused");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      void stopScanner();
    };
  }, [stopScanner]);

  const waiting = scannerState === "idle" || scannerState === "paused";

  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--abyss)]">
      {/* <div className="absolute inset-0 z-1" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 h-[60vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 border border-white/10" style={{
          boxShadow: "0 0 0 9999px rgba(20, 30, 40, 0.85"
        }} />
        <div className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30" />
      </div> */}
      <div ref={containerRef} className="absolute inset-0 z-0 [&>canvas]:!absolute [&>canvas]:!inset-0 [&>canvas]:!h-full [&>canvas]:!w-full [&>video]:!absolute [&>video]:!inset-0 [&>video]:!h-full [&>video]:!w-full [&>video]:!object-cover" />
      <div className="camera-vignette pointer-events-none absolute inset-0" aria-hidden="true" />

      {
        (waiting || scannerState === "error") && (
          <div className="biome-field absolute inset-0 z-10 flex items-center justify-center bg-[var(--abyss)] px-7">
            <BiomeBackdrop progress={0.42} quiet />
            <div className="relative z-10 w-full max-w-sm text-center flex items-center flex-col">
              {scannerState === "error" ? (
                <div className="mb-8 size-24 rounded-full border border-white/40 p-2" aria-hidden="true">
                  <div className="grid size-full place-items-center rounded-full border border-dashed border-[var(--phosphor)] font-mono text-2xl text-[var(--phosphor)]">◎</div>
                </div>
              ) : (
                <ExampleTargetCard className="mb-7 w-28" />
              )}
              <h2 className="font-display text-5xl tracking-[-0.04em]">
                {scannerState === "error" ? "Camera unavailable" : "Scan an artwork marker"}
              </h2>
              <p className="mx-auto mt-4 max-w-xs text-sm leading-6 text-white/80" role="status">
                {scannerState === "error"
                  ? errorMessage
                  : scannerState === "paused"
                    ? "The camera paused when the page became hidden. Tap to restart it."
                    : `${targetExampleCopy} Point your camera at it and hold still while the tank identifies it.`}
              </p>
              <button
                type="button"
                onClick={() => void startScanner()}
                className="mt-7 min-h-14 w-full bg-[var(--phosphor)] px-6 text-base text-[#031015] transition-opacity hover:opacity-85"
              >
                {scannerState === "error" ? "Try camera again" : "Start camera"}
              </button>
              {!simulatorVisible && (
                <button
                  type="button"
                  onClick={onUseSimulator}
                  className="mt-3 min-h-11 w-full border border-white/35 px-5 text-sm text-white/75 transition-colors hover:border-white hover:text-white"
                >
                  Explore without a camera
                </button>
              )}
            </div>
          </div>
        )
      }

      {
        scannerState === "starting" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/65 px-7" role="status">
            <div className="flex w-full max-w-sm flex-col items-center text-center">
              <ExampleTargetCard className="w-28" />
              <p className="mt-6 text-base leading-6 text-white/80">{targetExampleCopy}</p>
              <p className="mt-4 animate-pulse text-sm text-white/80">Starting camera</p>
            </div>
          </div>
        )
      }

      {
        scannerState === "running" && (
          <>
            {showTargetHint && (
              <div className="target-hint pointer-events-none absolute top-1/2 left-1/2 z-[5] w-[min(46vw,13rem)] -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
                <Image src={exampleTarget.glow} alt="" width={exampleTarget.width} height={exampleTarget.height} className="h-auto w-full" />
              </div>
            )}
            {showTargetHint ? (
              <p className="absolute inset-x-0 bottom-[9rem] z-10 px-7 text-center text-base leading-6 text-white/80" role="status">
                Find a constellation like this beside an artwork
              </p>
            ) : (
              <p className="absolute inset-x-0 bottom-[9rem] z-10 text-center text-[10px] tracking-[0.22em] text-white/60" role="status">
                Hold the artwork marker inside the frame
              </p>
            )}
          </>
        )
      }
    </div >
  );
}

export const ARScanner = forwardRef<ARScannerHandle, ARScannerProps>(
  ARScannerComponent,
);

/** The white marker card as it hangs beside each artwork. */
function ExampleTargetCard({ className }: { className?: string }) {
  return (
    <div className={`border border-white/40 bg-white p-2 ${className ?? ""}`}>
      <Image
        src={exampleTarget.light}
        alt="Example marker: a constellation of blue dots in the shape of a fish"
        width={exampleTarget.width}
        height={exampleTarget.height}
        className="h-auto w-full"
        priority
      />
    </div>
  );
}
