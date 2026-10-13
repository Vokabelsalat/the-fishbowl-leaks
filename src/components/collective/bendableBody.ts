import * as THREE from "three";

/**
 * A smooth tapering body along -x from its root at the origin, like a tail or a shark, that can bend
 * in the xy-plane each frame. Its outline comes from `radius`, a function of how far along the body
 * (0 at the root, 1 at the end) a ring lies; `colorAt` can shade each ring around its rim.
 */
export type BendableBody = {
  geometry: THREE.BufferGeometry;
  /** Bends the body so its centre line rises by `offsetAt(u)` at each point along it, then refreshes it. */
  bend: (offsetAt: (u: number) => number) => void;
  /** Where the end of the body is after the last bend, and how far it is bent up there, in radians. */
  end: () => { x: number; y: number; angle: number };
};

export function createBendableBody({
  length,
  radius,
  rings = 28,
  sides = 14,
  depthShare = 0.8,
  colorAt,
}: {
  length: number;
  /** The body's half height at `u`; its half width is `depthShare` of it. */
  radius: (u: number) => number;
  rings?: number;
  sides?: number;
  depthShare?: number;
  /** The colour at `u` along the body and `up` around it: 1 on the top, -1 on the belly. */
  colorAt?: (u: number, up: number) => THREE.Color;
}): BendableBody {
  const positions = new Float32Array((rings + 1) * sides * 3);
  const colors = colorAt ? new Float32Array((rings + 1) * sides * 3) : null;
  const indices: number[] = [];
  for (let ring = 0; ring < rings; ring += 1) {
    for (let side = 0; side < sides; side += 1) {
      const a = ring * sides + side;
      const b = ring * sides + ((side + 1) % sides);
      const c = (ring + 1) * sides + side;
      const d = (ring + 1) * sides + ((side + 1) % sides);
      indices.push(a, c, b, b, c, d);
    }
  }
  if (colors && colorAt) {
    for (let ring = 0; ring <= rings; ring += 1) {
      for (let side = 0; side < sides; side += 1) {
        const color = colorAt(ring / rings, Math.cos((side / sides) * Math.PI * 2));
        colors.set([color.r, color.g, color.b], (ring * sides + side) * 3);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  if (colors) geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  let tip = { x: -length, y: 0, angle: 0 };

  const bend = (offsetAt: (u: number) => number) => {
    const step = 1 / rings;
    for (let ring = 0; ring <= rings; ring += 1) {
      const u = ring / rings;
      const centreX = -length * u;
      const centreY = offsetAt(u);
      // The ring turns with the centre line, so the body keeps its thickness where it bends.
      const slope = (offsetAt(Math.min(1, u + step)) - offsetAt(Math.max(0, u - step))) / (length * step * 2);
      const angle = Math.atan(slope);
      const half = Math.max(radius(u), 0.002);
      for (let side = 0; side < sides; side += 1) {
        const around = (side / sides) * Math.PI * 2;
        const up = Math.cos(around) * half;
        positions.set([
          centreX + Math.sin(angle) * up,
          centreY + Math.cos(angle) * up,
          Math.sin(around) * half * depthShare,
        ], (ring * sides + side) * 3);
      }
      if (ring === rings) tip = { x: centreX, y: centreY, angle };
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  };

  bend(() => 0);
  return { geometry, bend, end: () => tip };
}

/** A flat fin from an outline of points, smoothed into curves, with a little thickness. */
export function finGeometry(points: Array<[number, number]>, thickness = 0.03) {
  const shape = new THREE.Shape();
  shape.moveTo(...points[0]);
  for (let index = 1; index < points.length; index += 1) {
    const [x, y] = points[index];
    const [nextX, nextY] = points[(index + 1) % points.length];
    // Curve through the midpoints, so the outline has no sharp corners except where points repeat.
    shape.quadraticCurveTo(x, y, (x + nextX) / 2, (y + nextY) / 2);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 10 });
  geometry.translate(0, 0, -thickness / 2);
  return geometry;
}
