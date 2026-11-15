import type { MedinaData } from './medina';
import { ROUNDABOUTS, type Block, type RoadGraph } from './roadGraph';

export interface WalkNode {
  id: number;
  x: number;
  z: number;
  kind: 'walk' | 'alley' | 'gate';
  links: number[]; // edge ids
}

export interface WalkEdge {
  id: number;
  a: number;
  b: number;
  length: number;
  /** true when this edge crosses a street on a crosswalk */
  crossing: boolean;
  /** road node next to the crosswalk (so pedestrians can read its traffic light) */
  roadNode: number;
  /** road edge that is crossed */
  roadEdge: number;
}

const INSET = 1.4;

/**
 * Where people can walk: a ring around every block, crosswalks between blocks,
 * and the medina alleys connected through the gates.
 */
export class SidewalkGraph {
  nodes: WalkNode[] = [];
  edges: WalkEdge[] = [];

  constructor(graph: RoadGraph, medina: MedinaData) {
    for (const blk of graph.blocks) {
      if (blk.district === 'fuel') continue;
      const gates = blk.district === 'medina' ? medina.gates : [];
      this.ring(blk, gates.map((g) => ({ x: g.x, z: g.z, side: g.side })));
    }
    this.crossings(graph);
    this.alleys(medina);
  }

  private add(x: number, z: number, kind: WalkNode['kind'] = 'walk'): WalkNode {
    const n: WalkNode = { id: this.nodes.length, x, z, kind, links: [] };
    this.nodes.push(n);
    return n;
  }

  link(a: number, b: number, crossing = false, roadNode = -1, roadEdge = -1): void {
    if (a === b) return;
    const A = this.nodes[a], B = this.nodes[b];
    if (A.links.some((id) => this.edges[id].a === b || this.edges[id].b === b)) return;
    const e: WalkEdge = { id: this.edges.length, a, b, length: Math.hypot(A.x - B.x, A.z - B.z), crossing, roadNode, roadEdge };
    this.edges.push(e);
    A.links.push(e.id);
    B.links.push(e.id);
  }

  private ring(blk: Block, extra: { x: number; z: number; side: string }[]): void {
    const x0 = Math.max(blk.x0, -452) + INSET, x1 = Math.min(blk.x1, 452) - INSET;
    const z0 = blk.z0 + INSET, z1 = Math.min(blk.z1, 402) - INSET;
    if (x1 - x0 < 4 || z1 - z0 < 4) return;
    const pts: { x: number; z: number; gate: boolean }[] = [];
    const side = (ax: number, az: number, bx: number, bz: number, key: string) => {
      const len = Math.hypot(bx - ax, bz - az);
      const stops: { t: number; gate: boolean }[] = [{ t: 0, gate: false }];
      const n = Math.max(1, Math.round(len / 30));
      for (let i = 1; i < n; i++) stops.push({ t: i / n, gate: false });
      for (const g of extra) {
        if (g.side !== key) continue;
        const t = ((g.x - ax) * (bx - ax) + (g.z - az) * (bz - az)) / (len * len);
        // replace a nearby stop so nodes do not bunch up
        const near = stops.findIndex((s) => Math.abs(s.t - t) * len < 6 && s.t !== 0);
        if (near >= 0) stops[near] = { t, gate: true };
        else stops.push({ t, gate: true });
      }
      stops.sort((p, q) => p.t - q.t);
      for (const s of stops) pts.push({ x: ax + (bx - ax) * s.t, z: az + (bz - az) * s.t, gate: s.gate });
    };
    side(x0, z0, x1, z0, 'n');
    side(x1, z0, x1, z1, 'e');
    side(x1, z1, x0, z1, 's');
    side(x0, z1, x0, z0, 'w');
    const ids: number[] = [];
    for (const p of pts) {
      // corners cut by a roundabout: move the node out of the road
      for (const r of ROUNDABOUTS) {
        const d = Math.hypot(p.x - r.x, p.z - r.z);
        if (d < r.radius + INSET && d > 0.01) {
          p.x = r.x + ((p.x - r.x) / d) * (r.radius + INSET);
          p.z = r.z + ((p.z - r.z) / d) * (r.radius + INSET);
        }
      }
      ids.push(this.add(p.x, p.z, p.gate ? 'gate' : 'walk').id);
    }
    for (let i = 0; i < ids.length; i++) this.link(ids[i], ids[(i + 1) % ids.length]);
  }

  private nearest(x: number, z: number, max: number): WalkNode | null {
    let best: WalkNode | null = null, bd = max;
    for (const n of this.nodes) {
      if (n.kind === 'alley') continue;
      const d = Math.hypot(n.x - x, n.z - z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  private crossings(graph: RoadGraph): void {
    for (const e of graph.edges) {
      if (e.cls === 'highway') continue;
      for (const end of [0, 1] as const) {
        const node = graph.nodes[end === 0 ? e.a : e.b];
        if (node.kind === 'end') continue;
        const a = graph.nodes[e.a];
        const s = end === 0 ? e.trimA + 2.4 : e.length - e.trimB - 2.4;
        const cx = a.x + e.dx * s, cz = a.z + e.dz * s;
        const off = e.hw + INSET;
        const p = this.nearest(cx - e.dz * off, cz + e.dx * off, node.kind === 'roundabout' ? 10 : 8);
        const q = this.nearest(cx + e.dz * off, cz - e.dx * off, node.kind === 'roundabout' ? 10 : 8);
        if (p && q) this.link(p.id, q.id, true, node.id, e.id);
      }
    }
  }

  private alleys(m: MedinaData): void {
    const base = this.nodes.length;
    for (const c of m.cells) this.add(c.x, c.z, 'alley');
    for (const [a, b] of m.links) this.link(base + a, base + b);
    for (const g of m.gates) {
      const out = this.nodes.find((n) => n.kind === 'gate' && Math.hypot(n.x - g.x, n.z - g.z) < 8);
      if (out) this.link(base + g.cell, out.id);
    }
  }

  /** Number of nodes reachable from the node nearest the city center (used by the tests). */
  reachable(from = this.nearest(20, -60, 50)?.id ?? 0): number {
    const seen = new Uint8Array(this.nodes.length);
    const stack = [from];
    seen[from] = 1;
    let n = 0;
    while (stack.length) {
      const i = stack.pop()!;
      n++;
      for (const id of this.nodes[i].links) {
        const e = this.edges[id];
        const o = e.a === i ? e.b : e.a;
        if (!seen[o]) { seen[o] = 1; stack.push(o); }
      }
    }
    return n;
  }
}
