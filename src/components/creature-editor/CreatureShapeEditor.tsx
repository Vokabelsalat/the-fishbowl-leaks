"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import { AquariumPlant, editorPlantSpecs, plantKindLabels, plantKinds, type PlantKind } from "@/components/collective/AquariumDioramaPlants";
import { WorldEventModel, worldEventIds, worldEventLabels, worldEventStillAges, type WorldEventId } from "@/components/collective/WorldEvents";
import { AquaticCreatureModel } from "@/components/creature/AquaticCreatureModel";
import { AquaticAddon, TraitPreviewContext, type TraitMount } from "@/components/creature/AquaticModelShared";
import { caudalTailShapes, dorsalFinStyles, pectoralFinStyles, pelvicFinStyles } from "@/components/creature/CreatureModel";
import { artifacts } from "@/data/artifacts";
import { aquaticForms, aquaticFormLabels, type AquaticForm } from "@/lib/creature/aquaticForms";
import type { CreaturePiece } from "@/components/creature/CreatureModel";
import { clearCreatureModelOverrides, loadCreatureModelOverrides, meshKey, saveCreatureModelOverrides, type SavedNodeTransform } from "@/lib/creature/modelOverrides";
import { clearPlantModelOverrides, savePlantModelOverrides } from "@/lib/creature/plantOverrides";
import { clearAddonModelOverrides, saveAddonModelOverrides } from "@/lib/creature/addonOverrides";
import { clearWorldEventOverrides, saveWorldEventOverrides } from "@/lib/creature/worldEventOverrides";
import { clearLegacyModelEdits, legacyModelEditsSnapshot, saveModelEdits, type ModelEditChanges } from "@/lib/creature/modelEdits";
import type { CreaturePartId } from "@/types/exhibition";

type ProductionShape = {
  id: string;
  family: string;
  name: string;
  path: string;
  fill: string;
  width?: number;
  height?: number;
  anchorX?: number;
  rayCount?: number;
};

type EditedShape = ProductionShape & {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
};

const familyColors: Record<string, string> = {
  "Caudal tails": "#ff8a62",
  "Dorsal fins": "#b9ffdc",
  "Pectoral fins": "#58d6ff",
  "Pelvic fins": "#c69cff",
};

function rounded(value: number) {
  return Number(value.toFixed(4));
}

function shapeToSvgPath(shape: THREE.Shape) {
  const commands: string[] = [];

  shape.curves.forEach((curve, index) => {
    if (curve instanceof THREE.CubicBezierCurve) {
      if (index === 0) commands.push(`M ${rounded(curve.v0.x)} ${rounded(curve.v0.y)}`);
      commands.push(`C ${rounded(curve.v1.x)} ${rounded(curve.v1.y)} ${rounded(curve.v2.x)} ${rounded(curve.v2.y)} ${rounded(curve.v3.x)} ${rounded(curve.v3.y)}`);
    } else if (curve instanceof THREE.QuadraticBezierCurve) {
      if (index === 0) commands.push(`M ${rounded(curve.v0.x)} ${rounded(curve.v0.y)}`);
      commands.push(`Q ${rounded(curve.v1.x)} ${rounded(curve.v1.y)} ${rounded(curve.v2.x)} ${rounded(curve.v2.y)}`);
    } else if (curve instanceof THREE.LineCurve) {
      if (index === 0) commands.push(`M ${rounded(curve.v1.x)} ${rounded(curve.v1.y)}`);
      commands.push(`L ${rounded(curve.v2.x)} ${rounded(curve.v2.y)}`);
    }
  });

  return `${commands.join(" ")} Z`;
}

function getProductionShapes(): ProductionShape[] {
  return [
    ...caudalTailShapes.map((shape, index) => ({
      id: `caudal-${index + 1}`,
      family: "Caudal tails",
      name: `tail ${String(index + 1).padStart(2, "0")}`,
      path: shapeToSvgPath(shape),
      fill: familyColors["Caudal tails"],
    })),
    ...dorsalFinStyles.map((style, index) => ({
      id: `dorsal-${index + 1}`,
      family: "Dorsal fins",
      name: `dorsal ${String(index + 1).padStart(2, "0")}`,
      path: shapeToSvgPath(style.shape),
      fill: familyColors["Dorsal fins"],
      width: style.width,
      height: style.height,
      anchorX: style.x,
      rayCount: style.rays.length,
    })),
    ...pectoralFinStyles.map((style, index) => ({
      id: `pectoral-${index + 1}`,
      family: "Pectoral fins",
      name: `pectoral ${String(index + 1).padStart(2, "0")}`,
      path: shapeToSvgPath(style.shape),
      fill: familyColors["Pectoral fins"],
      width: style.width,
      height: style.height,
      rayCount: style.rays.length,
    })),
    ...pelvicFinStyles.map((style, index) => ({
      id: `pelvic-${index + 1}`,
      family: "Pelvic fins",
      name: `pelvic ${String(index + 1).padStart(2, "0")}`,
      path: shapeToSvgPath(style.shape),
      fill: familyColors["Pelvic fins"],
      width: style.width,
      height: style.height,
      rayCount: style.rays.length,
    })),
  ];
}

const productionShapes = getProductionShapes();
const families = [...new Set(productionShapes.map((shape) => shape.family))];

function initialShapes() {
  return Object.fromEntries(productionShapes.map((shape) => [shape.id, {
    ...shape,
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    opacity: 0.86,
  }])) as Record<string, EditedShape>;
}

type EditorView = "models" | "addons" | "shapes" | "plants" | "events";

const editorViews: Array<{ view: EditorView; label: string }> = [
  { view: "models", label: "Creature models" },
  { view: "addons", label: "Add-ons" },
  { view: "shapes", label: "Bézier shapes" },
  { view: "plants", label: "Plants" },
  { view: "events", label: "World events" },
];

function EditorViewLinks({ current, onShow }: { current: EditorView; onShow: (view: EditorView) => void }) {
  return (
    <div className="flex gap-2">
      {editorViews.filter(({ view }) => view !== current).map(({ view, label }) => (
        <button key={view} type="button" className="border border-white/20 px-3 py-2 text-xs text-white/60 hover:border-white/40 hover:text-white" onClick={() => onShow(view)}>{label}</button>
      ))}
    </div>
  );
}

/** Saves into the project file and reports in the editor's status line whether that worked. */
function reportSave(saving: Promise<void>, done: string, setStatus: (status: string) => void) {
  saving
    .then(() => setStatus(done))
    .catch((error: unknown) => setStatus(`Not saved to the project: ${error instanceof Error ? error.message : error}. A reload undoes this change.`));
}

/** The old storage only changes when the bar empties it, which reloads the page anyway. */
const subscribeToNothing = () => () => {};

/**
 * Edits used to live in this browser's storage only. Until they are moved into the project file,
 * a bar offers to do so, since nothing else in the app reads them any more.
 */
function LegacyEditsNotice() {
  // The server has no browser storage, so it renders without the bar and the browser adds it.
  const snapshot = useSyncExternalStore(subscribeToNothing, legacyModelEditsSnapshot, () => "");
  const [status, setStatus] = useState("");
  if (!snapshot) return null;
  const legacy = JSON.parse(snapshot) as ModelEditChanges;

  const moveIntoProject = async () => {
    setStatus("Saving…");
    try {
      await saveModelEdits(legacy);
      clearLegacyModelEdits();
      window.location.reload();
    } catch (error) {
      setStatus(`Not saved: ${error instanceof Error ? error.message : error}`);
    }
  };

  return (
    <div className="flex items-center justify-between gap-6 border-b border-white/15 bg-[var(--abyss)] px-8 py-4 text-sm text-[var(--foam)] lg:px-10" role="status">
      <p>This browser still holds edits from before they were saved in the project. Only this browser shows them until you move them into src/data/modelEdits.json.</p>
      <div className="flex shrink-0 items-center gap-4">
        {status && <p>{status}</p>}
        <button type="button" className="bg-[var(--phosphor)] px-3 py-2.5 text-sm text-[var(--abyss)]" onClick={() => void moveIntoProject()}>
          Move into the project
        </button>
      </div>
    </div>
  );
}

export function CreatureShapeEditor() {
  const [view, setView] = useState<EditorView>("models");
  return (
    <>
      <LegacyEditsNotice />
      {view === "models" && <AquaticModelEditor onShow={setView} />}
      {view === "addons" && <AddonModelEditor onShow={setView} />}
      {view === "shapes" && <ProductionShapeEditor onShow={setView} />}
      {view === "events" && <WorldEventModelEditor onShow={setView} />}
      {view === "plants" && <PlantModelEditor onShow={setView} />}
    </>
  );
}

function ProductionShapeEditor({ onShow }: { onShow: (view: EditorView) => void }) {
  const [shapes, setShapes] = useState(initialShapes);
  const [selectedId, setSelectedId] = useState(productionShapes[0].id);
  const selected = shapes[selectedId];
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null);

  const updateShape = (changes: Partial<EditedShape>) => {
    setShapes((current) => ({ ...current, [selectedId]: { ...current[selectedId], ...changes } }));
  };

  const svgPoint = (clientX: number, clientY: number) =>
    new DOMPoint(clientX, clientY).matrixTransform(svgRef.current?.getScreenCTM()?.inverse());

  const startDrag = (event: ReactPointerEvent<SVGPathElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = svgPoint(event.clientX, event.clientY);
    dragRef.current = { pointerId: event.pointerId, startX: point.x, startY: point.y, x: selected.x, y: selected.y };
  };

  const moveShape = (event: ReactPointerEvent<SVGPathElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = svgPoint(event.clientX, event.clientY);
    updateShape({ x: rounded(drag.x + point.x - drag.startX), y: rounded(drag.y - point.y + drag.startY) });
  };

  const commandSummary = useMemo(() => selected.path.match(/[MCQLZ]/g)?.join(" · ") ?? "", [selected.path]);
  const resetShape = () => {
    const source = productionShapes.find((shape) => shape.id === selectedId);
    if (source) setShapes((current) => ({ ...current, [selectedId]: { ...source, x: 0, y: 0, scale: 1, rotation: 0, opacity: 0.86 } }));
  };

  return (
    <main className="shape-editor film-grain min-h-dvh bg-[var(--abyss)] text-[var(--foam)]">
      <header className="shape-editor-header flex items-end justify-between border-b border-white/15 px-8 py-6 lg:px-10">
        <div>
          <h1 className="font-display text-3xl tracking-[-0.035em]">Creature shape editor</h1>
          <p className="mt-1 text-sm text-white/48">Production Bézier constructions loaded directly from CreatureModel.tsx.</p>
        </div>
        <div className="flex items-center gap-5">
          <p className="font-mono text-xs text-white/40">THREE.Shape · normalized model space</p>
          <EditorViewLinks current="shapes" onShow={onShow} />
        </div>
      </header>

      <div className="shape-editor-workspace grid min-h-0 grid-cols-[17rem_minmax(0,1fr)_22rem]">
        <nav className="min-h-0 overflow-y-auto border-r border-white/15 px-4 py-5" aria-label="Production creature shapes">
          <h2 className="mb-4 px-3 font-display text-lg">Base shapes</h2>
          {families.map((family) => (
            <section key={family} className="mb-5">
              <h3 className="mb-1 px-3 text-sm text-white/42">{family}</h3>
              <ul className="space-y-1">
                {productionShapes.filter((shape) => shape.family === family).map((shape) => (
                  <li key={shape.id}>
                    <button type="button" className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${selectedId === shape.id ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/5 hover:text-white/80"}`} onClick={() => setSelectedId(shape.id)}>
                      <span>{shape.name}</span><span className="size-2" style={{ backgroundColor: shape.fill }} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>

        <section className="shape-editor-stage min-w-0 px-6 py-5 lg:px-8" aria-label={`${selected.name} construction canvas`}>
          <div className="mb-4 flex items-end justify-between gap-6">
            <div><p className="text-sm text-white/42">{selected.family}</p><h2 className="font-display text-2xl">{selected.name}</h2></div>
            <div className="flex gap-5 font-mono text-xs text-white/42">
              {selected.width !== undefined && <span>width {selected.width}</span>}
              {selected.height !== undefined && <span>height {selected.height}</span>}
              {selected.anchorX !== undefined && <span>anchor x {selected.anchorX}</span>}
              {selected.rayCount !== undefined && <span>{selected.rayCount} rays</span>}
            </div>
          </div>

          <div className="shape-editor-canvas relative overflow-hidden border border-white/18 bg-black/20">
            <svg ref={svgRef} className="size-full touch-none" viewBox="-1.5 -1.35 3 2.7" role="img" aria-label={`Editable production ${selected.name} shape`}>
              <defs><pattern id="production-grid" width="0.1" height="0.1" patternUnits="userSpaceOnUse"><path d="M .1 0 L 0 0 0 .1" fill="none" stroke="rgba(232,245,239,.055)" strokeWidth=".004" /></pattern></defs>
              <rect x="-1.5" y="-1.35" width="3" height="2.7" fill="url(#production-grid)" />
              <path d="M 0 -1.35 V 1.35 M -1.5 0 H 1.5" stroke="rgba(185,255,220,.16)" strokeWidth=".006" strokeDasharray=".035 .04" />
              <g transform="scale(1 -1)">
                <path d={selected.path} transform={`translate(${selected.x} ${selected.y}) rotate(${selected.rotation}) scale(${selected.scale})`} fill={selected.fill} fillOpacity={selected.opacity} stroke="#f3f0e8" strokeWidth=".012" vectorEffect="non-scaling-stroke" className="cursor-grab active:cursor-grabbing" onPointerDown={startDrag} onPointerMove={moveShape} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} />
              </g>
            </svg>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto] items-start gap-6 border-t border-white/12 pt-4">
            <p className="max-w-2xl text-sm leading-relaxed text-white/45">This is the normalized outline passed to <code className="font-mono text-white/65">shapeGeometry</code> in CreatureModel.tsx. Its body and head are sphere geometries, so they have no Bézier path to expose.</p>
            <button type="button" className="border border-white/20 px-3 py-2 text-xs text-white/55 hover:border-white/40 hover:text-white" onClick={resetShape}>Reset shape</button>
          </div>
        </section>

        <aside className="shape-editor-controls min-h-0 overflow-y-auto border-l border-white/15 px-5 py-5">
          <div className="border-b border-white/12 pb-4"><h2 className="font-display text-xl">{selected.name}</h2><p className="mt-1 font-mono text-[10px] text-white/38">{commandSummary}</p></div>
          <div className="space-y-5 py-5">
            <Control label="Translate X" value={selected.x} min={-1.5} max={1.5} step={0.01} onChange={(x) => updateShape({ x })} />
            <Control label="Translate Y" value={selected.y} min={-1.25} max={1.25} step={0.01} onChange={(y) => updateShape({ y })} />
            <Control label="Scale" value={selected.scale} min={0.2} max={2.5} step={0.01} onChange={(scale) => updateShape({ scale })} />
            <Control label="Rotation" value={selected.rotation} min={-180} max={180} step={1} suffix="°" onChange={(rotation) => updateShape({ rotation })} />
            <Control label="Opacity" value={selected.opacity} min={0.1} max={1} step={0.01} onChange={(opacity) => updateShape({ opacity })} />
            <label className="block border-t border-white/12 pt-5"><span className="mb-2 flex items-center justify-between text-sm text-white/68"><span>Preview color</span><span className="font-mono text-xs text-white/40">{selected.fill}</span></span><input className="h-10 w-full cursor-pointer bg-transparent" type="color" value={selected.fill} onChange={(event) => updateShape({ fill: event.target.value })} /></label>
            <label className="block border-t border-white/12 pt-5">
              <span className="mb-2 block text-sm text-white/68">Bézier construction</span>
              <textarea className="min-h-52 w-full resize-y border border-white/16 bg-black/25 p-3 font-mono text-xs leading-relaxed text-white/72 outline-none transition-colors focus:border-white/42" value={selected.path} spellCheck={false} onChange={(event) => updateShape({ path: event.target.value })} />
              <span className="mt-2 block text-xs leading-relaxed text-white/35">Coordinates match the production model: M = move, C = cubic Bézier, Q = quadratic Bézier, L = line, Z = close.</span>
            </label>
          </div>
        </aside>
      </div>
    </main>
  );
}

type NodeTransform = {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
};

type HiddenFeature = {
  key: string;
  label: string;
  /** Deleted shapes stay gone in the app once saved; hidden ones only in this editor session. */
  deleted?: boolean;
};

const editorPieces: CreaturePiece[] = artifacts.map((artifact) => ({
  artifactId: artifact.id,
  partId: artifact.creaturePart.id,
  color: artifact.color,
}));

const traitSideOptions: Array<{ side: TraitMount; label: string }> = [
  { side: "top", label: "Top" },
  { side: "bottom", label: "Bottom" },
  { side: "left", label: "Left" },
  { side: "right", label: "Right" },
];

function readTransform(object: THREE.Object3D): NodeTransform {
  return {
    x: rounded(object.position.x),
    y: rounded(object.position.y),
    z: rounded(object.position.z),
    scaleX: rounded(object.scale.x),
    scaleY: rounded(object.scale.y),
    scaleZ: rounded(object.scale.z),
    rotationX: rounded(THREE.MathUtils.radToDeg(object.rotation.x)),
    rotationY: rounded(THREE.MathUtils.radToDeg(object.rotation.y)),
    rotationZ: rounded(THREE.MathUtils.radToDeg(object.rotation.z)),
  };
}

function AquaticModelEditor({ onShow }: { onShow: (view: EditorView) => void }) {
  const [form, setForm] = useState<AquaticForm>("fish");
  const [selectedObject, setSelectedObject] = useState<THREE.Object3D | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [transform, setTransform] = useState<NodeTransform | null>(null);
  const [pending, setPending] = useState<Record<string, SavedNodeTransform>>({});
  const [saveStatus, setSaveStatus] = useState("Saved changes are part of the project and used everywhere.");
  const [hiddenFeatures, setHiddenFeatures] = useState<HiddenFeature[]>([]);
  const [modelRevision, setModelRevision] = useState(0);
  const [traitPreview, setTraitPreview] = useState<{ seed?: string; side?: TraitMount }>({});
  const modelRootRef = useRef<THREE.Group>(null);
  const initialTransforms = useRef(new Map<string, NodeTransform>());

  const selectObject = (object: THREE.Object3D) => {
    const key = modelRootRef.current ? meshKey(modelRootRef.current, object) : null;
    const next = readTransform(object);
    if (!initialTransforms.current.has(object.uuid)) initialTransforms.current.set(object.uuid, next);
    setSelectedObject(object);
    setSelectedKey(key);
    setTransform(next);
  };

  const updateTransform = (changes: Partial<NodeTransform>) => {
    if (!selectedObject || !transform) return;
    const next = { ...transform, ...changes };
    selectedObject.position.set(next.x, next.y, next.z);
    selectedObject.scale.set(next.scaleX, next.scaleY, next.scaleZ);
    selectedObject.rotation.set(
      THREE.MathUtils.degToRad(next.rotationX),
      THREE.MathUtils.degToRad(next.rotationY),
      THREE.MathUtils.degToRad(next.rotationZ),
    );
    setTransform(next);
    if (selectedKey) {
      setPending((current) => ({ ...current, [selectedKey]: next }));
      setSaveStatus("Unsaved changes");
    }
  };

  const resetNode = () => {
    if (!selectedObject) return;
    const initial = initialTransforms.current.get(selectedObject.uuid);
    if (initial) updateTransform(initial);
  };

  const changeTraitPreview = (changes: { seed?: string; side?: TraitMount }) => {
    setTraitPreview((current) => ({ ...current, ...changes }));
    setSelectedObject(null);
    setSelectedKey(null);
    setTransform(null);
  };

  // Counted like saved overrides, so add-ons and merged meshes never shift a shape's key.
  const meshByKey = (key: string) => {
    const root = modelRootRef.current;
    let found: THREE.Mesh | null = null;
    root?.traverse((object) => {
      if (!found && object instanceof THREE.Mesh && meshKey(root, object) === key) found = object;
    });
    return found as THREE.Mesh | null;
  };

  const setFeatureVisibility = (key: string, visible: boolean) => {
    const mesh = meshByKey(key);
    if (mesh) mesh.visible = visible;
  };

  // Shapes deleted earlier are listed again, so they can be brought back one by one. They are
  // read once the model has mounted, so each can be named after its mesh.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const saved = loadCreatureModelOverrides()[form] ?? {};
      setHiddenFeatures(Object.entries(saved)
        .filter(([, transform]) => transform.hidden)
        .map(([key]) => {
          const mesh = meshByKey(key);
          return { key, label: mesh?.name || `${mesh?.geometry.type ?? "Shape"} · ${key}`, deleted: true };
        }));
    });
    return () => {
      cancelled = true;
    };
  }, [form, modelRevision]);

  const removeSelectedFeature = (deleted: boolean) => {
    if (!selectedObject || !selectedKey || !transform) return;
    const label = selectedObject.name || `${selectedObject.type} · ${selectedKey}`;
    setFeatureVisibility(selectedKey, false);
    setHiddenFeatures((current) => [...current.filter((feature) => feature.key !== selectedKey), { key: selectedKey, label, deleted }]);
    if (deleted) {
      setPending((current) => ({ ...current, [selectedKey]: { ...transform, hidden: true } }));
      setSaveStatus("Unsaved changes");
    }
    setSelectedObject(null);
    setSelectedKey(null);
    setTransform(null);
  };

  const showFeature = (feature: HiddenFeature) => {
    setFeatureVisibility(feature.key, true);
    setHiddenFeatures((current) => current.filter(({ key }) => key !== feature.key));
    const mesh = meshByKey(feature.key);
    if (feature.deleted && mesh) {
      setPending((current) => ({ ...current, [feature.key]: { ...readTransform(mesh), hidden: false } }));
      setSaveStatus("Unsaved changes");
    }
  };

  const showAllFeatures = () => hiddenFeatures.forEach(showFeature);

  const geometry = selectedObject instanceof THREE.Mesh ? selectedObject.geometry : null;
  const construction = geometry
    ? JSON.stringify({ type: geometry.type, parameters: geometry.parameters ?? {} }, null, 2)
    : "Select a visible part of the creature to inspect its geometry.";

  return (
    <main className="shape-editor film-grain min-h-dvh bg-[var(--abyss)] text-[var(--foam)]">
      <header className="shape-editor-header flex items-end justify-between border-b border-white/15 px-8 py-6 lg:px-10">
        <div>
          <h1 className="font-display text-3xl tracking-[-0.035em]">Creature model editor</h1>
          <p className="mt-1 text-sm text-white/48">Production models rendered directly through AquaticCreatureModel.tsx.</p>
        </div>
        <div className="flex items-center gap-5">
          <p className="font-mono text-xs text-white/40">Click a mesh to edit it</p>
          <EditorViewLinks current="models" onShow={onShow} />
        </div>
      </header>

      <div className="shape-editor-workspace grid min-h-0 grid-cols-[17rem_minmax(0,1fr)_22rem]">
        <nav className="min-h-0 overflow-y-auto border-r border-white/15 px-4 py-5" aria-label="Aquatic creature models">
          <h2 className="mb-4 px-3 font-display text-lg">Creature models</h2>
          <ul className="space-y-1">
            {aquaticForms.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${form === item ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/5 hover:text-white/80"}`}
                  onClick={() => {
                    setForm(item);
                    setSelectedObject(null);
                    setSelectedKey(null);
                    setTransform(null);
                    setPending({});
                    setHiddenFeatures([]);
                    setSaveStatus("Saved changes are part of the project and used everywhere.");
                    initialTransforms.current.clear();
                  }}
                >
                  {aquaticFormLabels[item]}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section className="shape-editor-stage min-w-0 px-6 py-5 lg:px-8" aria-label={`${form} model canvas`}>
          <div className="mb-4 flex items-end justify-between gap-6">
            <div>
              <p className="text-sm text-white/42">AquaticCreatureModel.tsx</p>
              <h2 className="font-display text-2xl capitalize">{aquaticFormLabels[form]}</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex" role="group" aria-label="Add-on side">
                {traitSideOptions.map(({ side, label }) => (
                  <button
                    key={side}
                    type="button"
                    aria-pressed={traitPreview.side === side}
                    className={`border border-white/20 px-3 py-2 text-xs transition-colors [&+&]:border-l-0 ${traitPreview.side === side ? "bg-white/10 text-white" : "text-white/60 hover:text-white"}`}
                    onClick={() => changeTraitPreview({ side: traitPreview.side === side ? undefined : side })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="border border-white/20 px-3 py-2 text-xs text-white/60 hover:border-white/40 hover:text-white"
                onClick={() => changeTraitPreview({ seed: Math.random().toString(36).slice(2) })}
              >
                Randomize add-ons
              </button>
            </div>
          </div>
          <div className="shape-editor-canvas relative overflow-hidden border border-white/18 bg-black/20">
            <Canvas orthographic camera={{ position: [0, 0, 10], zoom: 105, near: 0.1, far: 40 }} dpr={[1, 1.5]} onPointerMissed={() => { setSelectedObject(null); setTransform(null); }}>
              <color attach="background" args={["#06151b"]} />
              <gridHelper args={[18, 36, "#31565a", "#153238"]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -1.2]} />
              <ambientLight intensity={1.8} />
              <directionalLight position={[3, 5, 8]} intensity={2.6} color="#fff4df" />
              <pointLight position={[-4, 2, 5]} intensity={2.2} color="#58d6ff" />
              <group
                key={`${form}-${modelRevision}`}
                ref={modelRootRef}
                onPointerDown={(event: ThreeEvent<PointerEvent>) => {
                  event.stopPropagation();
                  selectObject(event.object);
                }}
              >
                <TraitPreviewContext.Provider value={traitPreview}>
                  <AquaticCreatureModel form={form} pieces={editorPieces} animated={false} scale={1.2} />
                </TraitPreviewContext.Provider>
              </group>
              {selectedObject instanceof THREE.Mesh && <SelectedMeshBlink object={selectedObject} />}
              <OrbitControls enablePan enableRotate enableZoom minZoom={55} maxZoom={180} />
            </Canvas>
          </div>
          <p className="mt-4 border-t border-white/12 pt-4 text-sm leading-relaxed text-white/45">Drag the empty canvas to orbit, scroll to zoom, or click any visible part to edit or temporarily hide that mesh. Pick a side to put every add-on there, click it again to mix the sides, and randomize to reshuffle positions; the beak always stays at the mouth. Hidden features and unsaved changes stay local to this editor session.</p>
        </section>

        <aside className="shape-editor-controls min-h-0 overflow-y-auto border-l border-white/15 px-5 py-5">
          {hiddenFeatures.length > 0 && (
            <section className="mb-5 border-b border-white/12 pb-5" aria-labelledby="hidden-features-title">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h2 id="hidden-features-title" className="font-display text-xl">Hidden features</h2>
                <button type="button" className="text-xs text-white/55 hover:text-white" onClick={showAllFeatures}>Show all</button>
              </div>
              <ul className="space-y-1">
                {hiddenFeatures.map((feature) => (
                  <li key={feature.key} className="flex items-center justify-between gap-3 border border-white/12 px-3 py-2">
                    <span className="min-w-0 truncate text-sm text-white/62">{feature.label}{feature.deleted && " · deleted"}</span>
                    <button type="button" className="shrink-0 text-xs text-white/55 hover:text-white" onClick={() => showFeature(feature)}>{feature.deleted ? "Restore" : "Show"}</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {selectedObject && transform ? (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-white/12 pb-4">
                <div><h2 className="font-display text-xl">{selectedObject.name || selectedObject.type}</h2><p className="mt-1 font-mono text-[10px] text-white/38">{geometry?.type ?? selectedObject.type}</p></div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className="border border-white/18 px-2.5 py-1.5 text-xs text-white/48 hover:border-white/35 hover:text-white" onClick={() => removeSelectedFeature(false)}>Hide feature</button>
                  <button type="button" className="border border-white/18 px-2.5 py-1.5 text-xs text-white/48 hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-35" disabled={!selectedKey} onClick={() => removeSelectedFeature(true)}>Delete shape</button>
                  <button type="button" className="border border-white/18 px-2.5 py-1.5 text-xs text-white/48 hover:border-white/35 hover:text-white" onClick={resetNode}>Reset part</button>
                </div>
              </div>
              <div className="space-y-5 py-5">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="bg-[var(--phosphor)] px-3 py-2.5 text-sm text-[var(--abyss)] disabled:cursor-not-allowed disabled:opacity-35"
                    disabled={Object.keys(pending).length === 0}
                    onClick={() => {
                      reportSave(saveCreatureModelOverrides(form, pending), "Saved to the project and active everywhere", setSaveStatus);
                      setPending({});
                    }}
                  >
                    Save to app
                  </button>
                  <button
                    type="button"
                    className="border border-white/20 px-3 py-2.5 text-sm text-white/58 hover:border-white/40 hover:text-white"
                    onClick={() => {
                      reportSave(clearCreatureModelOverrides(form), "Saved overrides removed for this creature", setSaveStatus);
                      setSelectedObject(null);
                      setSelectedKey(null);
                      setTransform(null);
                      setPending({});
                      setHiddenFeatures([]);
                      initialTransforms.current.clear();
                      setModelRevision((current) => current + 1);
                    }}
                  >
                    Restore original
                  </button>
                </div>
                <p className="text-xs leading-relaxed text-white/40">{saveStatus}</p>
                <ModelControl label="Translate X" value={transform.x} min={-4} max={4} step={0.01} onChange={(x) => updateTransform({ x })} />
                <ModelControl label="Translate Y" value={transform.y} min={-4} max={4} step={0.01} onChange={(y) => updateTransform({ y })} />
                <ModelControl label="Translate Z" value={transform.z} min={-3} max={3} step={0.01} onChange={(z) => updateTransform({ z })} />
                <div className="border-t border-white/12 pt-5"><ModelControl label="Scale X" value={transform.scaleX} min={0.05} max={3} step={0.01} onChange={(scaleX) => updateTransform({ scaleX })} /></div>
                <ModelControl label="Scale Y" value={transform.scaleY} min={0.05} max={3} step={0.01} onChange={(scaleY) => updateTransform({ scaleY })} />
                <ModelControl label="Scale Z" value={transform.scaleZ} min={0.05} max={3} step={0.01} onChange={(scaleZ) => updateTransform({ scaleZ })} />
                <div className="border-t border-white/12 pt-5"><ModelControl label="Rotate X" value={transform.rotationX} min={-180} max={180} step={1} suffix="°" onChange={(rotationX) => updateTransform({ rotationX })} /></div>
                <ModelControl label="Rotate Y" value={transform.rotationY} min={-180} max={180} step={1} suffix="°" onChange={(rotationY) => updateTransform({ rotationY })} />
                <ModelControl label="Rotate Z" value={transform.rotationZ} min={-180} max={180} step={1} suffix="°" onChange={(rotationZ) => updateTransform({ rotationZ })} />
                <label className="block border-t border-white/12 pt-5"><span className="mb-2 block text-sm text-white/68">Geometry construction</span><textarea className="min-h-44 w-full resize-y border border-white/16 bg-black/25 p-3 font-mono text-xs leading-relaxed text-white/60 outline-none" value={construction} readOnly /></label>
              </div>
            </>
          ) : (
            <div><h2 className="font-display text-xl">Model controls</h2><p className="mt-3 text-sm leading-relaxed text-white/45">Select a body, fin, limb, eye, shell, tentacle, or other visible mesh in the model to expose its construction and transforms.</p></div>
          )}
        </aside>
      </div>
    </main>
  );
}

function PlantModelEditor({ onShow }: { onShow: (view: EditorView) => void }) {
  const [kind, setKind] = useState<PlantKind>("kelp");
  const [selectedObject, setSelectedObject] = useState<THREE.Object3D | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [transform, setTransform] = useState<NodeTransform | null>(null);
  const [pending, setPending] = useState<Record<string, SavedNodeTransform>>({});
  const [saveStatus, setSaveStatus] = useState("Saved changes are used by every plant of this type.");
  const [hiddenFeatures, setHiddenFeatures] = useState<HiddenFeature[]>([]);
  const [plantRevision, setPlantRevision] = useState(0);
  const plantRootRef = useRef<THREE.Group>(null);
  const initialTransforms = useRef(new Map<string, NodeTransform>());

  const clearSelection = () => {
    setSelectedObject(null);
    setSelectedKey(null);
    setTransform(null);
  };

  const selectObject = (object: THREE.Object3D) => {
    const key = plantRootRef.current ? meshKey(plantRootRef.current, object) : null;
    const next = readTransform(object);
    if (!initialTransforms.current.has(object.uuid)) initialTransforms.current.set(object.uuid, next);
    setSelectedObject(object);
    setSelectedKey(key);
    setTransform(next);
  };

  const updateTransform = (changes: Partial<NodeTransform>) => {
    if (!selectedObject || !transform) return;
    const next = { ...transform, ...changes };
    selectedObject.position.set(next.x, next.y, next.z);
    selectedObject.scale.set(next.scaleX, next.scaleY, next.scaleZ);
    selectedObject.rotation.set(
      THREE.MathUtils.degToRad(next.rotationX),
      THREE.MathUtils.degToRad(next.rotationY),
      THREE.MathUtils.degToRad(next.rotationZ),
    );
    setTransform(next);
    if (selectedKey) {
      setPending((current) => ({ ...current, [selectedKey]: next }));
      setSaveStatus("Unsaved changes");
    }
  };

  const resetNode = () => {
    if (!selectedObject) return;
    const initial = initialTransforms.current.get(selectedObject.uuid);
    if (initial) updateTransform(initial);
  };

  const setFeatureVisibility = (key: string, visible: boolean) => {
    if (!plantRootRef.current) return;
    let meshIndex = 0;
    plantRootRef.current.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (`mesh-${meshIndex}` === key) object.visible = visible;
      meshIndex += 1;
    });
  };

  const hideSelectedFeature = () => {
    if (!selectedObject || !selectedKey) return;
    const label = selectedObject.name || `${selectedObject.type} · ${selectedKey}`;
    setFeatureVisibility(selectedKey, false);
    setHiddenFeatures((current) => current.some((feature) => feature.key === selectedKey)
      ? current
      : [...current, { key: selectedKey, label }]);
    clearSelection();
  };

  const showFeature = (key: string) => {
    setFeatureVisibility(key, true);
    setHiddenFeatures((current) => current.filter((feature) => feature.key !== key));
  };

  const showAllFeatures = () => {
    hiddenFeatures.forEach((feature) => setFeatureVisibility(feature.key, true));
    setHiddenFeatures([]);
  };

  const changeKind = (nextKind: PlantKind) => {
    setKind(nextKind);
    clearSelection();
    setPending({});
    setHiddenFeatures([]);
    setSaveStatus("Saved changes are used by every plant of this type.");
    initialTransforms.current.clear();
  };

  const geometry = selectedObject instanceof THREE.Mesh ? selectedObject.geometry : null;
  const construction = geometry
    ? JSON.stringify({ type: geometry.type, parameters: geometry.parameters ?? {} }, null, 2)
    : "Select a visible part of the plant to inspect its geometry.";
  const isWaterweed = kind === "waterweed";

  return (
    <main className="shape-editor film-grain min-h-dvh bg-[var(--abyss)] text-[var(--foam)]">
      <header className="shape-editor-header flex items-end justify-between border-b border-white/15 px-8 py-6 lg:px-10">
        <div>
          <h1 className="font-display text-3xl tracking-[-0.035em]">Plant model editor</h1>
          <p className="mt-1 text-sm text-white/48">Production aquarium plants rendered directly through AquariumDioramaPlants.tsx.</p>
        </div>
        <div className="flex items-center gap-5">
          <p className="font-mono text-xs text-white/40">Click a mesh to edit it</p>
          <EditorViewLinks current="plants" onShow={onShow} />
        </div>
      </header>

      <div className="shape-editor-workspace grid min-h-0 grid-cols-[17rem_minmax(0,1fr)_22rem]">
        <nav className="min-h-0 overflow-y-auto border-r border-white/15 px-4 py-5" aria-label="Aquarium plant models">
          <h2 className="mb-4 px-3 font-display text-lg">Plant models</h2>
          <ul className="space-y-1">
            {plantKinds.map((item) => (
              <li key={item}>
                <button type="button" className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${kind === item ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/5 hover:text-white/80"}`} onClick={() => changeKind(item)}>
                  {plantKindLabels[item]}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section className="shape-editor-stage min-w-0 px-6 py-5 lg:px-8" aria-label={`${plantKindLabels[kind]} model canvas`}>
          <div className="mb-4">
            <p className="text-sm text-white/42">AquariumDioramaPlants.tsx</p>
            <h2 className="font-display text-2xl">{plantKindLabels[kind]}</h2>
          </div>
          <div className="shape-editor-canvas relative overflow-hidden border border-white/18 bg-black/20">
            <Canvas orthographic camera={{ position: [0, isWaterweed ? 0 : 0.2, 10], zoom: isWaterweed ? 70 : 150, near: 0.1, far: 40 }} dpr={[1, 1.5]} onPointerMissed={clearSelection}>
              <color attach="background" args={["#06151b"]} />
              <gridHelper args={[18, 36, "#31565a", "#153238"]} rotation={[Math.PI / 2, 0, 0]} position={[0, isWaterweed ? -3.7 : -0.9, -1.2]} />
              <ambientLight intensity={1.8} />
              <directionalLight position={[3, 5, 8]} intensity={2.6} color="#fff4df" />
              <pointLight position={[-4, 2, 5]} intensity={2.2} color="#58d6ff" />
              <group
                key={`${kind}-${plantRevision}`}
                ref={plantRootRef}
                onPointerDown={(event: ThreeEvent<PointerEvent>) => {
                  event.stopPropagation();
                  selectObject(event.object);
                }}
              >
                <AquariumPlant spec={editorPlantSpecs[kind]} layer="front" x={0} floorY={isWaterweed ? -3.7 : -0.9} animated={false} />
              </group>
              {selectedObject instanceof THREE.Mesh && <SelectedMeshBlink object={selectedObject} />}
              <OrbitControls enablePan enableRotate enableZoom minZoom={40} maxZoom={220} />
            </Canvas>
          </div>
          <p className="mt-4 border-t border-white/12 pt-4 text-sm leading-relaxed text-white/45">Each saved adjustment is applied to the matching mesh in every aquarium plant of this type. Drag the empty canvas to orbit, scroll to zoom, or click a stem, leaf, tip, or base to edit it.</p>
        </section>

        <aside className="shape-editor-controls min-h-0 overflow-y-auto border-l border-white/15 px-5 py-5">
          {hiddenFeatures.length > 0 && (
            <section className="mb-5 border-b border-white/12 pb-5" aria-labelledby="hidden-plant-features-title">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h2 id="hidden-plant-features-title" className="font-display text-xl">Hidden features</h2>
                <button type="button" className="text-xs text-white/55 hover:text-white" onClick={showAllFeatures}>Show all</button>
              </div>
              <ul className="space-y-1">
                {hiddenFeatures.map((feature) => (
                  <li key={feature.key} className="flex items-center justify-between gap-3 border border-white/12 px-3 py-2">
                    <span className="min-w-0 truncate text-sm text-white/62">{feature.label}</span>
                    <button type="button" className="shrink-0 text-xs text-white/55 hover:text-white" onClick={() => showFeature(feature.key)}>Show</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {selectedObject && transform ? (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-white/12 pb-4">
                <div><h2 className="font-display text-xl">{selectedObject.name || selectedObject.type}</h2><p className="mt-1 font-mono text-[10px] text-white/38">{geometry?.type ?? selectedObject.type}</p></div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className="border border-white/18 px-2.5 py-1.5 text-xs text-white/48 hover:border-white/35 hover:text-white" onClick={hideSelectedFeature}>Hide feature</button>
                  <button type="button" className="border border-white/18 px-2.5 py-1.5 text-xs text-white/48 hover:border-white/35 hover:text-white" onClick={resetNode}>Reset part</button>
                </div>
              </div>
              <div className="space-y-5 py-5">
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="bg-[var(--phosphor)] px-3 py-2.5 text-sm text-[var(--abyss)] disabled:cursor-not-allowed disabled:opacity-35" disabled={Object.keys(pending).length === 0} onClick={() => { reportSave(savePlantModelOverrides(kind, pending), "Saved to the project and active in every aquarium", setSaveStatus); setPending({}); }}>Save to app</button>
                  <button type="button" className="border border-white/20 px-3 py-2.5 text-sm text-white/58 hover:border-white/40 hover:text-white" onClick={() => { reportSave(clearPlantModelOverrides(kind), "Saved overrides removed for this plant", setSaveStatus); clearSelection(); setPending({}); setHiddenFeatures([]); initialTransforms.current.clear(); setPlantRevision((current) => current + 1); }}>Restore original</button>
                </div>
                <p className="text-xs leading-relaxed text-white/40">{saveStatus}</p>
                <ModelControl label="Translate X" value={transform.x} min={-4} max={4} step={0.01} onChange={(x) => updateTransform({ x })} />
                <ModelControl label="Translate Y" value={transform.y} min={-4} max={4} step={0.01} onChange={(y) => updateTransform({ y })} />
                <ModelControl label="Translate Z" value={transform.z} min={-3} max={3} step={0.01} onChange={(z) => updateTransform({ z })} />
                <div className="border-t border-white/12 pt-5"><ModelControl label="Scale X" value={transform.scaleX} min={0.05} max={3} step={0.01} onChange={(scaleX) => updateTransform({ scaleX })} /></div>
                <ModelControl label="Scale Y" value={transform.scaleY} min={0.05} max={3} step={0.01} onChange={(scaleY) => updateTransform({ scaleY })} />
                <ModelControl label="Scale Z" value={transform.scaleZ} min={0.05} max={3} step={0.01} onChange={(scaleZ) => updateTransform({ scaleZ })} />
                <div className="border-t border-white/12 pt-5"><ModelControl label="Rotate X" value={transform.rotationX} min={-180} max={180} step={1} suffix="°" onChange={(rotationX) => updateTransform({ rotationX })} /></div>
                <ModelControl label="Rotate Y" value={transform.rotationY} min={-180} max={180} step={1} suffix="°" onChange={(rotationY) => updateTransform({ rotationY })} />
                <ModelControl label="Rotate Z" value={transform.rotationZ} min={-180} max={180} step={1} suffix="°" onChange={(rotationZ) => updateTransform({ rotationZ })} />
                <label className="block border-t border-white/12 pt-5"><span className="mb-2 block text-sm text-white/68">Geometry construction</span><textarea className="min-h-44 w-full resize-y border border-white/16 bg-black/25 p-3 font-mono text-xs leading-relaxed text-white/60 outline-none" value={construction} readOnly /></label>
              </div>
            </>
          ) : (
            <div><h2 className="font-display text-xl">Plant controls</h2><p className="mt-3 text-sm leading-relaxed text-white/45">Select a visible stem, blade, leaf, tip, or base in the plant to expose its construction and transforms.</p></div>
          )}
        </aside>
      </div>
    </main>
  );
}

/** Where the camera looks and how close it is for each world event's model, which differ a lot in size. */
const worldEventFraming: Record<WorldEventId, { x: number; y: number; zoom: number }> = {
  mermaid: { x: -0.55, y: 0.25, zoom: 170 },
  boat: { x: -0.2, y: -0.1, zoom: 70 },
  kraken: { x: 0, y: 2, zoom: 55 },
  shark: { x: -0.4, y: 0.1, zoom: 80 },
  sardines: { x: 0, y: 0, zoom: 600 },
  sardineCan: { x: 0, y: 0, zoom: 260 },
  fishingHook: { x: 0.05, y: -0.2, zoom: 200 },
  fishSticks: { x: 0, y: 0, zoom: 500 },
};

function WorldEventModelEditor({ onShow }: { onShow: (view: EditorView) => void }) {
  const [eventId, setEventId] = useState<WorldEventId>(worldEventIds[0]);
  const [selectedObject, setSelectedObject] = useState<THREE.Object3D | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [transform, setTransform] = useState<NodeTransform | null>(null);
  const [pending, setPending] = useState<Record<string, SavedNodeTransform>>({});
  const [saveStatus, setSaveStatus] = useState("Saved changes are used whenever this event happens in the aquarium.");
  const [hiddenFeatures, setHiddenFeatures] = useState<HiddenFeature[]>([]);
  const [modelRevision, setModelRevision] = useState(0);
  const modelRootRef = useRef<THREE.Group>(null);
  const initialTransforms = useRef(new Map<string, NodeTransform>());
  const framing = worldEventFraming[eventId];

  const clearSelection = () => {
    setSelectedObject(null);
    setSelectedKey(null);
    setTransform(null);
  };

  const selectObject = (object: THREE.Object3D) => {
    const key = modelRootRef.current ? meshKey(modelRootRef.current, object) : null;
    const next = readTransform(object);
    if (!initialTransforms.current.has(object.uuid)) initialTransforms.current.set(object.uuid, next);
    setSelectedObject(object);
    setSelectedKey(key);
    setTransform(next);
  };

  const updateTransform = (changes: Partial<NodeTransform>) => {
    if (!selectedObject || !transform) return;
    const next = { ...transform, ...changes };
    selectedObject.position.set(next.x, next.y, next.z);
    selectedObject.scale.set(next.scaleX, next.scaleY, next.scaleZ);
    selectedObject.rotation.set(
      THREE.MathUtils.degToRad(next.rotationX),
      THREE.MathUtils.degToRad(next.rotationY),
      THREE.MathUtils.degToRad(next.rotationZ),
    );
    setTransform(next);
    if (selectedKey) {
      setPending((current) => ({ ...current, [selectedKey]: next }));
      setSaveStatus("Unsaved changes");
    }
  };

  const resetNode = () => {
    if (!selectedObject) return;
    const initial = initialTransforms.current.get(selectedObject.uuid);
    if (initial) updateTransform(initial);
  };

  const setFeatureVisibility = (key: string, visible: boolean) => {
    if (!modelRootRef.current) return;
    let meshIndex = 0;
    modelRootRef.current.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (`mesh-${meshIndex}` === key) object.visible = visible;
      meshIndex += 1;
    });
  };

  const hideSelectedFeature = () => {
    if (!selectedObject || !selectedKey) return;
    const label = selectedObject.name || `${selectedObject.type} · ${selectedKey}`;
    setFeatureVisibility(selectedKey, false);
    setHiddenFeatures((current) => current.some((feature) => feature.key === selectedKey)
      ? current
      : [...current, { key: selectedKey, label }]);
    clearSelection();
  };

  const showFeature = (key: string) => {
    setFeatureVisibility(key, true);
    setHiddenFeatures((current) => current.filter((feature) => feature.key !== key));
  };

  const showAllFeatures = () => {
    hiddenFeatures.forEach((feature) => setFeatureVisibility(feature.key, true));
    setHiddenFeatures([]);
  };

  const changeEvent = (nextEvent: WorldEventId) => {
    setEventId(nextEvent);
    clearSelection();
    setPending({});
    setHiddenFeatures([]);
    setSaveStatus("Saved changes are used whenever this event happens in the aquarium.");
    initialTransforms.current.clear();
  };

  const geometry = selectedObject instanceof THREE.Mesh ? selectedObject.geometry : null;
  const construction = geometry
    ? JSON.stringify({ type: geometry.type, parameters: geometry.parameters ?? {} }, null, 2)
    : "Select a visible part of the model to inspect its geometry.";

  return (
    <main className="shape-editor film-grain min-h-dvh bg-[var(--abyss)] text-[var(--foam)]">
      <header className="shape-editor-header flex items-end justify-between border-b border-white/15 px-8 py-6 lg:px-10">
        <div>
          <h1 className="font-display text-3xl tracking-[-0.035em]">World event models</h1>
          <p className="mt-1 text-sm text-white/48">The aquarium&apos;s world events rendered directly through WorldEvents.tsx, held still at a typical moment.</p>
        </div>
        <div className="flex items-center gap-5">
          <p className="font-mono text-xs text-white/40">Click a mesh to edit it</p>
          <EditorViewLinks current="events" onShow={onShow} />
        </div>
      </header>

      <div className="shape-editor-workspace grid min-h-0 grid-cols-[17rem_minmax(0,1fr)_22rem]">
        <nav className="min-h-0 overflow-y-auto border-r border-white/15 px-4 py-5" aria-label="World event models">
          <h2 className="mb-4 px-3 font-display text-lg">World events</h2>
          <ul className="space-y-1">
            {worldEventIds.map((item) => (
              <li key={item}>
                <button type="button" className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${eventId === item ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/5 hover:text-white/80"}`} onClick={() => changeEvent(item)}>
                  {worldEventLabels[item]}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section className="shape-editor-stage min-w-0 px-6 py-5 lg:px-8" aria-label={`${worldEventLabels[eventId]} model canvas`}>
          <div className="mb-4">
            <p className="text-sm text-white/42">WorldEvents.tsx</p>
            <h2 className="font-display text-2xl">{worldEventLabels[eventId]}</h2>
          </div>
          <div className="shape-editor-canvas relative overflow-hidden border border-white/18 bg-black/20">
            <Canvas key={eventId} orthographic camera={{ position: [framing.x, framing.y, 10], zoom: framing.zoom, near: 0.1, far: 40 }} dpr={[1, 1.5]} onPointerMissed={clearSelection}>
              <color attach="background" args={["#06151b"]} />
              <ambientLight intensity={1.8} />
              <directionalLight position={[3, 5, 8]} intensity={2.6} color="#fff4df" />
              <pointLight position={[-4, 2, 5]} intensity={2.2} color="#58d6ff" />
              <group
                key={`${eventId}-${modelRevision}`}
                ref={modelRootRef}
                onPointerDown={(event: ThreeEvent<PointerEvent>) => {
                  event.stopPropagation();
                  selectObject(event.object);
                }}
              >
                <WorldEventModel id={eventId} seed={1} onDone={() => undefined} still={worldEventStillAges[eventId]} />
              </group>
              {selectedObject instanceof THREE.Mesh && <SelectedMeshBlink object={selectedObject} />}
              <OrbitControls enablePan enableRotate enableZoom target={[framing.x, framing.y, 0]} minZoom={framing.zoom * 0.3} maxZoom={framing.zoom * 3} />
            </Canvas>
          </div>
          <p className="mt-4 border-t border-white/12 pt-4 text-sm leading-relaxed text-white/45">Each saved adjustment is applied to the matching mesh whenever this event happens in the aquarium. Parts the event moves itself, like the mermaid&apos;s tail fin or the boat&apos;s bubbles, are placed anew every frame, so their position cannot be changed here. A school is shown as one member: its size and turn apply to every member.</p>
        </section>

        <aside className="shape-editor-controls min-h-0 overflow-y-auto border-l border-white/15 px-5 py-5">
          {hiddenFeatures.length > 0 && (
            <section className="mb-5 border-b border-white/12 pb-5" aria-labelledby="hidden-event-features-title">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h2 id="hidden-event-features-title" className="font-display text-xl">Hidden features</h2>
                <button type="button" className="text-xs text-white/55 hover:text-white" onClick={showAllFeatures}>Show all</button>
              </div>
              <ul className="space-y-1">
                {hiddenFeatures.map((feature) => (
                  <li key={feature.key} className="flex items-center justify-between gap-3 border border-white/12 px-3 py-2">
                    <span className="min-w-0 truncate text-sm text-white/62">{feature.label}</span>
                    <button type="button" className="shrink-0 text-xs text-white/55 hover:text-white" onClick={() => showFeature(feature.key)}>Show</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {selectedObject && transform ? (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-white/12 pb-4">
                <div><h2 className="font-display text-xl">{selectedObject.name || selectedObject.type}</h2><p className="mt-1 font-mono text-[10px] text-white/38">{geometry?.type ?? selectedObject.type}</p></div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className="border border-white/18 px-2.5 py-1.5 text-xs text-white/48 hover:border-white/35 hover:text-white" onClick={hideSelectedFeature}>Hide feature</button>
                  <button type="button" className="border border-white/18 px-2.5 py-1.5 text-xs text-white/48 hover:border-white/35 hover:text-white" onClick={resetNode}>Reset part</button>
                </div>
              </div>
              <div className="space-y-5 py-5">
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="bg-[var(--phosphor)] px-3 py-2.5 text-sm text-[var(--abyss)] disabled:cursor-not-allowed disabled:opacity-35" disabled={Object.keys(pending).length === 0} onClick={() => { reportSave(saveWorldEventOverrides(eventId, pending), "Saved to the project and active in every aquarium", setSaveStatus); setPending({}); }}>Save to app</button>
                  <button type="button" className="border border-white/20 px-3 py-2.5 text-sm text-white/58 hover:border-white/40 hover:text-white" onClick={() => { reportSave(clearWorldEventOverrides(eventId), "Saved overrides removed for this event", setSaveStatus); clearSelection(); setPending({}); setHiddenFeatures([]); initialTransforms.current.clear(); setModelRevision((current) => current + 1); }}>Restore original</button>
                </div>
                <p className="text-xs leading-relaxed text-white/40">{saveStatus}</p>
                <ModelControl label="Translate X" value={transform.x} min={-6} max={6} step={0.01} onChange={(x) => updateTransform({ x })} />
                <ModelControl label="Translate Y" value={transform.y} min={-6} max={6} step={0.01} onChange={(y) => updateTransform({ y })} />
                <ModelControl label="Translate Z" value={transform.z} min={-3} max={3} step={0.01} onChange={(z) => updateTransform({ z })} />
                <div className="border-t border-white/12 pt-5"><ModelControl label="Scale X" value={transform.scaleX} min={0.01} max={4} step={0.01} onChange={(scaleX) => updateTransform({ scaleX })} /></div>
                <ModelControl label="Scale Y" value={transform.scaleY} min={0.01} max={4} step={0.01} onChange={(scaleY) => updateTransform({ scaleY })} />
                <ModelControl label="Scale Z" value={transform.scaleZ} min={0.01} max={4} step={0.01} onChange={(scaleZ) => updateTransform({ scaleZ })} />
                <div className="border-t border-white/12 pt-5"><ModelControl label="Rotate X" value={transform.rotationX} min={-180} max={180} step={1} suffix="°" onChange={(rotationX) => updateTransform({ rotationX })} /></div>
                <ModelControl label="Rotate Y" value={transform.rotationY} min={-180} max={180} step={1} suffix="°" onChange={(rotationY) => updateTransform({ rotationY })} />
                <ModelControl label="Rotate Z" value={transform.rotationZ} min={-180} max={180} step={1} suffix="°" onChange={(rotationZ) => updateTransform({ rotationZ })} />
                <label className="block border-t border-white/12 pt-5"><span className="mb-2 block text-sm text-white/68">Geometry construction</span><textarea className="min-h-44 w-full resize-y border border-white/16 bg-black/25 p-3 font-mono text-xs leading-relaxed text-white/60 outline-none" value={construction} readOnly /></label>
              </div>
            </>
          ) : (
            <div><h2 className="font-display text-xl">Event model controls</h2><p className="mt-3 text-sm leading-relaxed text-white/45">Select a visible part of the model to expose its construction and transforms.</p></div>
          )}
        </aside>
      </div>
    </main>
  );
}

const editorAddons = [...new Map(artifacts.map((artifact) => [artifact.creaturePart.id, {
  partId: artifact.creaturePart.id,
  label: artifact.creaturePart.label,
  color: artifact.color,
}])).values()];

function AddonModelEditor({ onShow }: { onShow: (view: EditorView) => void }) {
  const [partId, setPartId] = useState<CreaturePartId>(editorAddons[0].partId);
  const [selectedObject, setSelectedObject] = useState<THREE.Object3D | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [transform, setTransform] = useState<NodeTransform | null>(null);
  const [pending, setPending] = useState<Record<string, SavedNodeTransform>>({});
  const [saveStatus, setSaveStatus] = useState("Saved changes are used by this add-on on every creature.");
  const [hiddenFeatures, setHiddenFeatures] = useState<HiddenFeature[]>([]);
  const [addonRevision, setAddonRevision] = useState(0);
  const addonRootRef = useRef<THREE.Group>(null);
  const initialTransforms = useRef(new Map<string, NodeTransform>());
  const addon = editorAddons.find((item) => item.partId === partId) ?? editorAddons[0];

  const clearSelection = () => {
    setSelectedObject(null);
    setSelectedKey(null);
    setTransform(null);
  };

  const selectObject = (object: THREE.Object3D) => {
    const key = addonRootRef.current ? meshKey(addonRootRef.current, object) : null;
    const next = readTransform(object);
    if (!initialTransforms.current.has(object.uuid)) initialTransforms.current.set(object.uuid, next);
    setSelectedObject(object);
    setSelectedKey(key);
    setTransform(next);
  };

  const updateTransform = (changes: Partial<NodeTransform>) => {
    if (!selectedObject || !transform) return;
    const next = { ...transform, ...changes };
    selectedObject.position.set(next.x, next.y, next.z);
    selectedObject.scale.set(next.scaleX, next.scaleY, next.scaleZ);
    selectedObject.rotation.set(
      THREE.MathUtils.degToRad(next.rotationX),
      THREE.MathUtils.degToRad(next.rotationY),
      THREE.MathUtils.degToRad(next.rotationZ),
    );
    setTransform(next);
    if (selectedKey) {
      setPending((current) => ({ ...current, [selectedKey]: next }));
      setSaveStatus("Unsaved changes");
    }
  };

  const resetNode = () => {
    if (!selectedObject) return;
    const initial = initialTransforms.current.get(selectedObject.uuid);
    if (initial) updateTransform(initial);
  };

  const setFeatureVisibility = (key: string, visible: boolean) => {
    if (!addonRootRef.current) return;
    let meshIndex = 0;
    addonRootRef.current.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (`mesh-${meshIndex}` === key) object.visible = visible;
      meshIndex += 1;
    });
  };

  const hideSelectedFeature = () => {
    if (!selectedObject || !selectedKey) return;
    const label = selectedObject.name || `${selectedObject.type} · ${selectedKey}`;
    setFeatureVisibility(selectedKey, false);
    setHiddenFeatures((current) => current.some((feature) => feature.key === selectedKey)
      ? current
      : [...current, { key: selectedKey, label }]);
    clearSelection();
  };

  const showFeature = (key: string) => {
    setFeatureVisibility(key, true);
    setHiddenFeatures((current) => current.filter((feature) => feature.key !== key));
  };

  const showAllFeatures = () => {
    hiddenFeatures.forEach((feature) => setFeatureVisibility(feature.key, true));
    setHiddenFeatures([]);
  };

  const changeAddon = (nextPartId: CreaturePartId) => {
    setPartId(nextPartId);
    clearSelection();
    setPending({});
    setHiddenFeatures([]);
    setSaveStatus("Saved changes are used by this add-on on every creature.");
    initialTransforms.current.clear();
  };

  const geometry = selectedObject instanceof THREE.Mesh ? selectedObject.geometry : null;
  const construction = geometry
    ? JSON.stringify({ type: geometry.type, parameters: geometry.parameters ?? {} }, null, 2)
    : "Select a visible part of the add-on to inspect its geometry.";

  return (
    <main className="shape-editor film-grain min-h-dvh bg-[var(--abyss)] text-[var(--foam)]">
      <header className="shape-editor-header flex items-end justify-between border-b border-white/15 px-8 py-6 lg:px-10">
        <div>
          <h1 className="font-display text-3xl tracking-[-0.035em]">Add-on model editor</h1>
          <p className="mt-1 text-sm text-white/48">Production add-ons rendered directly through AquaticModelShared.tsx.</p>
        </div>
        <div className="flex items-center gap-5">
          <p className="font-mono text-xs text-white/40">Click a mesh to edit it</p>
          <EditorViewLinks current="addons" onShow={onShow} />
        </div>
      </header>

      <div className="shape-editor-workspace grid min-h-0 grid-cols-[17rem_minmax(0,1fr)_22rem]">
        <nav className="min-h-0 overflow-y-auto border-r border-white/15 px-4 py-5" aria-label="Creature add-ons">
          <h2 className="mb-4 px-3 font-display text-lg">Add-ons</h2>
          <ul className="space-y-1">
            {editorAddons.map((item) => (
              <li key={item.partId}>
                <button type="button" className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${partId === item.partId ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/5 hover:text-white/80"}`} onClick={() => changeAddon(item.partId)}>
                  <span>{item.label}</span><span className="size-2" style={{ backgroundColor: item.color }} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section className="shape-editor-stage min-w-0 px-6 py-5 lg:px-8" aria-label={`${addon.label} model canvas`}>
          <div className="mb-4">
            <p className="text-sm text-white/42">AquaticModelShared.tsx</p>
            <h2 className="font-display text-2xl">{addon.label}</h2>
          </div>
          <div className="shape-editor-canvas relative overflow-hidden border border-white/18 bg-black/20">
            <Canvas orthographic camera={{ position: [0, 0.35, 10], zoom: 360, near: 0.1, far: 40 }} dpr={[1, 1.5]} onPointerMissed={clearSelection}>
              <color attach="background" args={["#06151b"]} />
              <gridHelper args={[6, 60, "#31565a", "#153238"]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -1.2]} />
              <ambientLight intensity={1.8} />
              <directionalLight position={[3, 5, 8]} intensity={2.6} color="#fff4df" />
              <pointLight position={[-4, 2, 5]} intensity={2.2} color="#58d6ff" />
              <group
                key={`${partId}-${addonRevision}`}
                ref={addonRootRef}
                onPointerDown={(event: ThreeEvent<PointerEvent>) => {
                  event.stopPropagation();
                  selectObject(event.object);
                }}
              >
                <AquaticAddon partId={partId} color={addon.color} />
              </group>
              {selectedObject instanceof THREE.Mesh && <SelectedMeshBlink object={selectedObject} />}
              <OrbitControls target={[0, 0.35, 0]} enablePan enableRotate enableZoom minZoom={150} maxZoom={900} />
            </Canvas>
          </div>
          <p className="mt-4 border-t border-white/12 pt-4 text-sm leading-relaxed text-white/45">The add-on is shown in its mount frame: the origin sits on the creature&apos;s skin, up points away from the body and right points toward the head. Each saved adjustment is applied to this add-on on every creature, wherever it is mounted. Drag the empty canvas to orbit, scroll to zoom, or click a part to edit it.</p>
        </section>

        <aside className="shape-editor-controls min-h-0 overflow-y-auto border-l border-white/15 px-5 py-5">
          {hiddenFeatures.length > 0 && (
            <section className="mb-5 border-b border-white/12 pb-5" aria-labelledby="hidden-addon-features-title">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h2 id="hidden-addon-features-title" className="font-display text-xl">Hidden features</h2>
                <button type="button" className="text-xs text-white/55 hover:text-white" onClick={showAllFeatures}>Show all</button>
              </div>
              <ul className="space-y-1">
                {hiddenFeatures.map((feature) => (
                  <li key={feature.key} className="flex items-center justify-between gap-3 border border-white/12 px-3 py-2">
                    <span className="min-w-0 truncate text-sm text-white/62">{feature.label}</span>
                    <button type="button" className="shrink-0 text-xs text-white/55 hover:text-white" onClick={() => showFeature(feature.key)}>Show</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {selectedObject && transform ? (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-white/12 pb-4">
                <div><h2 className="font-display text-xl">{selectedObject.name || selectedObject.type}</h2><p className="mt-1 font-mono text-[10px] text-white/38">{geometry?.type ?? selectedObject.type}</p></div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className="border border-white/18 px-2.5 py-1.5 text-xs text-white/48 hover:border-white/35 hover:text-white" onClick={hideSelectedFeature}>Hide feature</button>
                  <button type="button" className="border border-white/18 px-2.5 py-1.5 text-xs text-white/48 hover:border-white/35 hover:text-white" onClick={resetNode}>Reset part</button>
                </div>
              </div>
              <div className="space-y-5 py-5">
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="bg-[var(--phosphor)] px-3 py-2.5 text-sm text-[var(--abyss)] disabled:cursor-not-allowed disabled:opacity-35" disabled={Object.keys(pending).length === 0} onClick={() => { reportSave(saveAddonModelOverrides(partId, pending), "Saved to the project and active on every creature", setSaveStatus); setPending({}); }}>Save to app</button>
                  <button type="button" className="border border-white/20 px-3 py-2.5 text-sm text-white/58 hover:border-white/40 hover:text-white" onClick={() => { reportSave(clearAddonModelOverrides(partId), "Saved overrides removed for this add-on", setSaveStatus); clearSelection(); setPending({}); setHiddenFeatures([]); initialTransforms.current.clear(); setAddonRevision((current) => current + 1); }}>Restore original</button>
                </div>
                <p className="text-xs leading-relaxed text-white/40">{saveStatus}</p>
                <ModelControl label="Translate X" value={transform.x} min={-1.5} max={1.5} step={0.005} onChange={(x) => updateTransform({ x })} />
                <ModelControl label="Translate Y" value={transform.y} min={-1.5} max={1.5} step={0.005} onChange={(y) => updateTransform({ y })} />
                <ModelControl label="Translate Z" value={transform.z} min={-1.5} max={1.5} step={0.005} onChange={(z) => updateTransform({ z })} />
                <div className="border-t border-white/12 pt-5"><ModelControl label="Scale X" value={transform.scaleX} min={0.05} max={3} step={0.01} onChange={(scaleX) => updateTransform({ scaleX })} /></div>
                <ModelControl label="Scale Y" value={transform.scaleY} min={0.05} max={3} step={0.01} onChange={(scaleY) => updateTransform({ scaleY })} />
                <ModelControl label="Scale Z" value={transform.scaleZ} min={0.05} max={3} step={0.01} onChange={(scaleZ) => updateTransform({ scaleZ })} />
                <div className="border-t border-white/12 pt-5"><ModelControl label="Rotate X" value={transform.rotationX} min={-180} max={180} step={1} suffix="°" onChange={(rotationX) => updateTransform({ rotationX })} /></div>
                <ModelControl label="Rotate Y" value={transform.rotationY} min={-180} max={180} step={1} suffix="°" onChange={(rotationY) => updateTransform({ rotationY })} />
                <ModelControl label="Rotate Z" value={transform.rotationZ} min={-180} max={180} step={1} suffix="°" onChange={(rotationZ) => updateTransform({ rotationZ })} />
                <label className="block border-t border-white/12 pt-5"><span className="mb-2 block text-sm text-white/68">Geometry construction</span><textarea className="min-h-44 w-full resize-y border border-white/16 bg-black/25 p-3 font-mono text-xs leading-relaxed text-white/60 outline-none" value={construction} readOnly /></label>
              </div>
            </>
          ) : (
            <div><h2 className="font-display text-xl">Add-on controls</h2><p className="mt-3 text-sm leading-relaxed text-white/45">Select a visible spine, fin, horn, shell, streamer, or other part of the add-on to expose its construction and transforms.</p></div>
          )}
        </aside>
      </div>
    </main>
  );
}

function SelectedMeshBlink({ object }: { object: THREE.Mesh }) {
  const highlightRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (!highlightRef.current || !materialRef.current) return;
    object.updateWorldMatrix(true, false);
    highlightRef.current.matrix.copy(object.matrixWorld);
    materialRef.current.opacity = 0.16 + (Math.sin(clock.elapsedTime * 5.5) * 0.5 + 0.5) * 0.5;
  });

  return (
    <mesh ref={highlightRef} geometry={object.geometry} matrixAutoUpdate={false} renderOrder={30}>
      <meshBasicMaterial
        ref={materialRef}
        color="#b9ffdc"
        transparent
        opacity={0.4}
        depthTest={false}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function ModelControl(props: Parameters<typeof Control>[0]) {
  return <Control {...props} />;
}

function Control({ label, value, min, max, step, suffix = "", onChange }: { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-sm text-white/68"><span>{label}</span><span className="flex items-center gap-1 font-mono text-xs text-white/50"><input className="w-20 border border-white/14 bg-black/20 px-2 py-1 text-right text-white/75 outline-none focus:border-white/40" type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />{suffix}</span></span>
      <input className="shape-editor-range w-full" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
