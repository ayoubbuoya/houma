import { SPEED_LIMITS, WORLD } from '../data/config';

/**
 * City layout data. The city "knows its own structure": traffic, pedestrians, police and
 * missions all read this graph instead of looking at meshes.
 * Axes: +x = east, -z = north (the sea side). Tunisia drives on the right.
 */
export type StreetClass = 'boulevard' | 'main' | 'minor' | 'corniche' | 'highway';
export type District = 'downtown' | 'medina' | 'houma' | 'corniche' | 'louage' | 'civic' | 'edge' | 'beach' | 'fuel';

export const STREET: Record<StreetClass, { hw: number; lanes: number; laneW: number; median: number; sidewalk: number }> = {
  // hw = half width of the whole carriageway (center line to curb)
  boulevard: { hw: 13.2, lanes: 2, laneW: 3.5, median: 12, sidewalk: 4.5 },
  main: { hw: 5.6, lanes: 1, laneW: 3.3, median: 0, sidewalk: 3 },
  minor: { hw: 3.5, lanes: 1, laneW: 3.0, median: 0, sidewalk: 2 },
  corniche: { hw: 5.0, lanes: 1, laneW: 3.7, median: 0, sidewalk: 4 },
  highway: { hw: 8.7, lanes: 2, laneW: 3.6, median: 1.4, sidewalk: 2 },
};

export interface RoadNode {
  id: number;
  x: number;
  z: number;
  kind: 'intersection' | 'roundabout' | 'end';
  /** Roundabout outer radius (0 for normal intersections). */
  radius: number;
  island: number;
  edges: number[];
  lights: boolean;
}

export interface RoadEdge {
  id: number;
  a: number;
  b: number;
  cls: StreetClass;
  hw: number;
  lanes: number; // per direction
  laneW: number;
  median: number;
  speedLimit: number; // km/h
  length: number;
  /** unit direction from a to b */
  dx: number;
  dz: number;
  /** distance from node a / node b where the free road starts (intersection area before that) */
  trimA: number;
  trimB: number;
  district: District;
}

export interface Block {
  id: number;
  /** slab rectangle (already inset by the streets around it) */
  x0: number; x1: number; z0: number; z1: number;
  district: District;
  /** street class on each side, or null when the side is the map edge. n = -z, s = +z, w = -x, e = +x */
  sides: { n: StreetClass | null; s: StreetClass | null; w: StreetClass | null; e: StreetClass | null };
  outer: boolean;
}

interface Line {
  ns: boolean; // true: runs north-south at x = at; false: runs east-west at z = at
  at: number;
  from: number;
  to: number;
  cls: StreetClass;
}

export const RING = { x0: -420, x1: 420, z0: -340, z1: 360 };
export const ROUNDABOUTS = [
  { x: 0, z: 220, radius: 25, island: 11.5, name: 'clock' },
  { x: 0, z: 360, radius: 21, island: 8, name: 'highway' },
];
export const MEDINA = { x0: -280, x1: -140, z0: -200, z1: 80 };

const LINES: Line[] = [
  // east-west streets
  { ns: false, at: -340, from: -420, to: 420, cls: 'corniche' },
  { ns: false, at: -200, from: -420, to: 420, cls: 'main' },
  { ns: false, at: -60, from: -420, to: -280, cls: 'main' },
  { ns: false, at: -60, from: -140, to: 420, cls: 'main' },
  { ns: false, at: 80, from: -420, to: 420, cls: 'main' },
  { ns: false, at: 220, from: -420, to: 420, cls: 'main' },
  { ns: false, at: 360, from: -500, to: 500, cls: 'highway' },
  // north-south streets
  { ns: true, at: -420, from: -340, to: 360, cls: 'main' },
  { ns: true, at: -280, from: -340, to: 360, cls: 'main' },
  { ns: true, at: -140, from: -340, to: 360, cls: 'main' },
  { ns: true, at: 0, from: -340, to: 220, cls: 'boulevard' },
  { ns: true, at: 0, from: 220, to: 360, cls: 'main' },
  { ns: true, at: 140, from: -340, to: 360, cls: 'main' },
  { ns: true, at: 280, from: -340, to: 360, cls: 'main' },
  { ns: true, at: 420, from: -340, to: 360, cls: 'main' },
  // houma side streets (east)
  { ns: true, at: 210, from: -200, to: 220, cls: 'minor' },
  { ns: true, at: 350, from: -200, to: 220, cls: 'minor' },
  { ns: false, at: -130, from: 140, to: 420, cls: 'minor' },
  { ns: false, at: 10, from: 140, to: 420, cls: 'minor' },
  { ns: false, at: 150, from: 140, to: 420, cls: 'minor' },
  // houma side streets (west)
  { ns: true, at: -350, from: -200, to: 80, cls: 'minor' },
  { ns: false, at: -130, from: -420, to: -280, cls: 'minor' },
  { ns: false, at: 10, from: -420, to: -280, cls: 'minor' },
];

export function districtAt(x: number, z: number): District {
  if (z < RING.z0) return 'beach';
  if (x < RING.x0 || x > RING.x1 || z > RING.z1) return 'edge';
  if (z < -200) return 'corniche';
  if (x > MEDINA.x0 && x < MEDINA.x1) {
    if (z < MEDINA.z1) return 'medina';
    if (z < 220) return 'louage';
  }
  if (x > -140 && x < 140 && z < 360) return 'downtown';
  if (x < -280 && z > 80 && z < 220) return 'civic';
  return 'houma';
}

export class RoadGraph {
  nodes: RoadNode[] = [];
  edges: RoadEdge[] = [];
  blocks: Block[] = [];

  constructor() {
    this.buildNodesAndEdges();
    this.buildBlocks();
  }

  private nodeAt(x: number, z: number): RoadNode {
    let n = this.nodes.find((m) => m.x === x && m.z === z);
    if (!n) {
      const rb = ROUNDABOUTS.find((r) => r.x === x && r.z === z);
      n = { id: this.nodes.length, x, z, kind: rb ? 'roundabout' : 'intersection', radius: rb?.radius ?? 0, island: rb?.island ?? 0, edges: [], lights: false };
      this.nodes.push(n);
    }
    return n;
  }

  private buildNodesAndEdges(): void {
    for (const l of LINES) {
      // all points on this line where another line crosses or touches, plus its own ends
      const pts = new Set<number>([l.from, l.to]);
      for (const o of LINES) {
        if (o.ns === l.ns) continue;
        if (o.at >= l.from && o.at <= l.to && l.at >= o.from && l.at <= o.to) pts.add(o.at);
      }
      const sorted = [...pts].sort((p, q) => p - q);
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = l.ns ? this.nodeAt(l.at, sorted[i]) : this.nodeAt(sorted[i], l.at);
        const b = l.ns ? this.nodeAt(l.at, sorted[i + 1]) : this.nodeAt(sorted[i + 1], l.at);
        const st = STREET[l.cls];
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        const e: RoadEdge = {
          id: this.edges.length, a: a.id, b: b.id, cls: l.cls, hw: st.hw, lanes: st.lanes, laneW: st.laneW, median: st.median,
          speedLimit: SPEED_LIMITS[l.cls], length, dx: (b.x - a.x) / length, dz: (b.z - a.z) / length, trimA: 0, trimB: 0,
          district: districtAt((a.x + b.x) / 2 + 1, (a.z + b.z) / 2 + 1),
        };
        this.edges.push(e);
        a.edges.push(e.id);
        b.edges.push(e.id);
      }
    }
    for (const n of this.nodes) {
      if (n.edges.length === 1) n.kind = 'end';
      // traffic lights on the boulevard crossings
      n.lights = n.kind === 'intersection' && n.edges.length >= 3 && n.edges.some((id) => this.edges[id].cls === 'boulevard');
    }
    for (const e of this.edges) {
      e.trimA = this.trimAt(e, this.nodes[e.a]);
      e.trimB = this.trimAt(e, this.nodes[e.b]);
      if (e.cls === 'minor' || (e.district === 'houma' && e.cls === 'main')) e.speedLimit = Math.min(e.speedLimit, e.cls === 'minor' ? 30 : 40);
    }
  }

  private trimAt(e: RoadEdge, n: RoadNode): number {
    if (n.kind === 'roundabout') return n.radius;
    if (n.kind === 'end') return 0;
    let t = 0;
    for (const id of n.edges) {
      const o = this.edges[id];
      const perpendicular = Math.abs(o.dx * e.dx + o.dz * e.dz) < 0.5;
      if (perpendicular) t = Math.max(t, o.hw);
    }
    return t || e.hw;
  }

  private lineCovering(ns: boolean, at: number, from: number, to: number): Line | undefined {
    return LINES.find((l) => l.ns === ns && l.at === at && l.from <= from && l.to >= to);
  }

  private buildBlocks(): void {
    const H = WORLD.half;
    const xs = [...new Set([-H, H, ...LINES.filter((l) => l.ns).map((l) => l.at)])].sort((a, b) => a - b);
    const zs = [...new Set([-H, H, ...LINES.filter((l) => !l.ns).map((l) => l.at)])].sort((a, b) => a - b);
    const nx = xs.length - 1, nz = zs.length - 1;
    const group = new Int32Array(nx * nz).fill(-1);
    const inner = (i: number, j: number) => xs[i] >= RING.x0 && xs[i + 1] <= RING.x1 && zs[j] >= RING.z0 && zs[j + 1] <= RING.z1;
    let groups = 0;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        if (group[i * nz + j] !== -1) continue;
        const g = groups++;
        const stack = [[i, j]];
        group[i * nz + j] = g;
        while (stack.length) {
          const [ci, cj] = stack.pop()!;
          if (!inner(ci, cj)) continue; // outer cells stay alone
          const tryCell = (ni: number, nj: number, open: boolean) => {
            if (ni < 0 || nj < 0 || ni >= nx || nj >= nz || !open || !inner(ni, nj)) return;
            if (group[ni * nz + nj] !== -1) return;
            group[ni * nz + nj] = g;
            stack.push([ni, nj]);
          };
          tryCell(ci + 1, cj, !this.lineCovering(true, xs[ci + 1], zs[cj], zs[cj + 1]));
          tryCell(ci - 1, cj, !this.lineCovering(true, xs[ci], zs[cj], zs[cj + 1]));
          tryCell(ci, cj + 1, !this.lineCovering(false, zs[cj + 1], xs[ci], xs[ci + 1]));
          tryCell(ci, cj - 1, !this.lineCovering(false, zs[cj], xs[ci], xs[ci + 1]));
        }
      }
    }
    for (let g = 0; g < groups; g++) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          if (group[i * nz + j] !== g) continue;
          x0 = Math.min(x0, xs[i]); x1 = Math.max(x1, xs[i + 1]);
          z0 = Math.min(z0, zs[j]); z1 = Math.max(z1, zs[j + 1]);
        }
      }
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const district = districtAt(cx, cz);
      if (district === 'beach') continue; // the beach strip is built separately
      const side = (ns: boolean, at: number, from: number, to: number): StreetClass | null => {
        // any line that touches this side (even partly) counts
        const l = LINES.find((q) => q.ns === ns && q.at === at && q.from < to && q.to > from);
        return l ? l.cls : null;
      };
      const sides = { n: side(false, z0, x0, x1), s: side(false, z1, x0, x1), w: side(true, x0, z0, z1), e: side(true, x1, z0, z1) };
      const b: Block = {
        id: this.blocks.length,
        x0: x0 + (sides.w ? STREET[sides.w].hw : 0), x1: x1 - (sides.e ? STREET[sides.e].hw : 0),
        z0: z0 + (sides.n ? STREET[sides.n].hw : 0), z1: z1 - (sides.s ? STREET[sides.s].hw : 0),
        district, sides, outer: district === 'edge',
      };
      if (district === 'edge' && cz > RING.z1 && cx > 0 && cx < 140) b.district = 'fuel';
      this.blocks.push(b);
    }
  }

  /** Center of lane `lane` (0 = nearest the middle) going in direction dir (+1: a to b, -1: b to a) at distance s from a. */
  lanePoint(e: RoadEdge, dir: 1 | -1, lane: number, s: number): { x: number; z: number } {
    const a = this.nodes[e.a];
    const off = (e.median / 2 + (lane + 0.5) * e.laneW) * dir;
    // right-hand traffic: the right side of direction (dx, dz) is (-dz, dx)
    return { x: a.x + e.dx * s - e.dz * off, z: a.z + e.dz * s + e.dx * off };
  }

  nearestEdge(x: number, z: number): { edge: RoadEdge; dist: number; s: number } | null {
    let best: { edge: RoadEdge; dist: number; s: number } | null = null;
    for (const e of this.edges) {
      const a = this.nodes[e.a];
      const s = Math.max(0, Math.min(e.length, (x - a.x) * e.dx + (z - a.z) * e.dz));
      const d = Math.hypot(x - (a.x + e.dx * s), z - (a.z + e.dz * s));
      if (!best || d < best.dist) best = { edge: e, dist: d, s };
    }
    return best;
  }
}
