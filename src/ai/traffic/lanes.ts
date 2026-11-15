import type { RoadEdge, RoadGraph, RoadNode } from '../../world/roadGraph';

/**
 * Driving paths for AI cars, built from the road graph.
 * A path is a polyline: either one lane of a street, or a connector through an intersection or roundabout.
 */
export interface Path {
  id: number;
  kind: 'lane' | 'turn' | 'ring';
  pts: Float32Array; // x, z pairs
  cum: Float32Array; // distance from the start at each point
  length: number;
  /** lane: its road edge. connector: the edge it comes from. */
  edge: number;
  /** lane: node at the end of the lane. connector: the node it crosses. */
  node: number;
  /** speed limit on this path in m/s */
  speed: number;
  /** next paths: lane -> connectors, connector -> one lane */
  outs: number[];
  /** lane only: runs north-south (used for traffic light phases) */
  ns: boolean;
  /** connector only: -1 left, 0 straight, 1 right */
  turn: number;
  laneIndex: number;
}

const KMH = 1 / 3.6;

export class LaneGraph {
  paths: Path[] = [];
  lanes: Path[] = [];

  constructor(private graph: RoadGraph) {
    this.buildLanes();
    this.buildConnectors();
  }

  private make(kind: Path['kind'], pts: number[], edge: number, node: number, speed: number): Path {
    const n = pts.length / 2;
    const cum = new Float32Array(n);
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
    const p: Path = { id: this.paths.length, kind, pts: new Float32Array(pts), cum, length: cum[n - 1], edge, node, speed, outs: [], ns: false, turn: 0, laneIndex: 0 };
    this.paths.push(p);
    return p;
  }

  private margin(e: RoadEdge, n: RoadNode): number {
    if (n.kind === 'end') return 0;
    return e.cls === 'highway' || e.cls === 'minor' ? 1 : 4.8; // stop before the crosswalk
  }

  /** lanes that end at node / start at node, per edge */
  private incoming = new Map<number, Path[]>();
  private outgoing = new Map<number, Path[]>();

  private buildLanes(): void {
    const g = this.graph;
    for (const e of g.edges) {
      const a = g.nodes[e.a], b = g.nodes[e.b];
      const sA = e.trimA + this.margin(e, a), sB = e.length - e.trimB - this.margin(e, b);
      if (sB - sA < 6) continue;
      for (const dir of [1, -1] as const) {
        for (let lane = 0; lane < e.lanes; lane++) {
          const p0 = g.lanePoint(e, dir, lane, dir === 1 ? sA : sB);
          const p1 = g.lanePoint(e, dir, lane, dir === 1 ? sB : sA);
          const endNode = dir === 1 ? b : a, startNode = dir === 1 ? a : b;
          const p = this.make('lane', [p0.x, p0.z, p1.x, p1.z], e.id, endNode.id, e.speedLimit * KMH);
          p.ns = Math.abs(e.dx) < 0.5;
          p.laneIndex = lane;
          this.lanes.push(p);
          const key = (n: number) => n * 10000 + e.id;
          (this.incoming.get(key(endNode.id)) ?? this.incoming.set(key(endNode.id), []).get(key(endNode.id))!).push(p);
          (this.outgoing.get(key(startNode.id)) ?? this.outgoing.set(key(startNode.id), []).get(key(startNode.id))!).push(p);
        }
      }
    }
  }

  private buildConnectors(): void {
    const g = this.graph;
    for (const node of g.nodes) {
      if (node.kind === 'end') continue;
      for (const ein of node.edges) {
        const ins = this.incoming.get(node.id * 10000 + ein) ?? [];
        for (const L of ins) {
          const n = L.pts.length;
          const px = L.pts[n - 2], pz = L.pts[n - 1];
          const d1x = (px - L.pts[0]) / L.length, d1z = (pz - L.pts[1]) / L.length;
          const lanesIn = g.edges[ein].lanes;
          for (const eout of node.edges) {
            if (eout === ein && node.edges.length > 1) continue;
            const outs = this.outgoing.get(node.id * 10000 + eout) ?? [];
            if (!outs.length) continue;
            const o0 = outs[0];
            const d2x = (o0.pts[2] - o0.pts[0]) / o0.length, d2z = (o0.pts[3] - o0.pts[1]) / o0.length;
            const cross = d1x * d2z - d1z * d2x, dot = d1x * d2x + d1z * d2z;
            const turn = dot > 0.7 ? 0 : cross > 0 ? 1 : -1;
            if (node.kind !== 'roundabout') {
              // right turns from the outer lane, left turns from the inner lane
              if (turn === 1 && L.laneIndex !== lanesIn - 1) continue;
              if (turn === -1 && L.laneIndex !== 0) continue;
            }
            const targets = turn === 0 || node.kind === 'roundabout'
              ? [outs[Math.min(L.laneIndex, outs.length - 1)]]
              : turn === 1 ? [outs[outs.length - 1]] : [outs[0]];
            for (const T of targets) {
              const qx = T.pts[0], qz = T.pts[1];
              let c: Path;
              if (node.kind === 'roundabout') c = this.ring(node, px, pz, qx, qz, ein);
              else {
                const pts: number[] = [];
                if (turn === 0) pts.push(px, pz, (px + qx) / 2, (pz + qz) / 2, qx, qz);
                else {
                  // control point where the two lane lines meet
                  const t = ((qx - px) * d2z - (qz - pz) * d2x) / (d1x * d2z - d1z * d2x);
                  const cx = px + d1x * t, cz = pz + d1z * t;
                  for (let i = 0; i <= 10; i++) {
                    const u = i / 10, v = 1 - u;
                    pts.push(v * v * px + 2 * v * u * cx + u * u * qx, v * v * pz + 2 * v * u * cz + u * u * qz);
                  }
                }
                c = this.make('turn', pts, ein, node.id, (turn === 0 ? 34 : turn === 1 ? 17 : 22) * KMH);
              }
              c.turn = turn;
              c.outs.push(T.id);
              L.outs.push(c.id);
            }
          }
        }
      }
    }
  }

  /** Path through a roundabout: drive in, follow the ring (island on the left), drive out. */
  private ring(node: RoadNode, px: number, pz: number, qx: number, qz: number, edge: number): Path {
    const r = node.island + 4.2;
    const a1 = Math.atan2(pz - node.z, px - node.x), a2 = Math.atan2(qz - node.z, qx - node.x);
    const lead = 0.42;
    // right-hand traffic: the angle goes down as we drive around
    let start = a1 - lead, end = a2 + lead;
    let sweep = start - end;
    while (sweep < 0.05) sweep += Math.PI * 2;
    while (sweep > Math.PI * 2 + 0.05) sweep -= Math.PI * 2;
    const pts: number[] = [px, pz];
    // ease in: one point between the lane and the ring
    const steps = Math.max(2, Math.ceil(sweep / 0.16));
    for (let i = 0; i <= steps; i++) {
      const a = start - (sweep * i) / steps;
      pts.push(node.x + Math.cos(a) * r, node.z + Math.sin(a) * r);
    }
    pts.push(qx, qz);
    void end;
    return this.make('ring', pts, edge, node.id, 26 * KMH);
  }

  /** Position and heading at distance s along a path. */
  sample(p: Path, s: number, out: { x: number; z: number; hx: number; hz: number }): void {
    const n = p.cum.length;
    let i = 1;
    if (s <= 0) i = 1;
    else if (s >= p.length) i = n - 1;
    else {
      // paths are short: linear scan is fine
      while (i < n - 1 && p.cum[i] < s) i++;
    }
    const x0 = p.pts[i * 2 - 2], z0 = p.pts[i * 2 - 1], x1 = p.pts[i * 2], z1 = p.pts[i * 2 + 1];
    const seg = p.cum[i] - p.cum[i - 1] || 1;
    const t = (s - p.cum[i - 1]) / seg;
    out.x = x0 + (x1 - x0) * t;
    out.z = z0 + (z1 - z0) * t;
    out.hx = (x1 - x0) / seg;
    out.hz = (z1 - z0) / seg;
  }
}
