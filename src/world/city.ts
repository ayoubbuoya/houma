import * as THREE from 'three';
import { RNG } from '../core/rng';
import { PALETTE, VEHICLES, WORLD } from '../data/config';
import { buildCarModel } from '../vehicles/carModels';
import type { Atlas } from './atlas';
import { Builder, mixHex, shade, type BoxCollider, type Mat } from './builder';
import { SEATS, colonial, house, type ShopKind } from './kit/buildings';
import { clockTower, flagPole, kiosk, louageStation, petrolStation, policeStation } from './kit/landmarks';
import {
  bench, bin, boat, bollard, bush, ficus, lamp, lantern, lowWall, olive, orangeTree, palm, parasol, scooter, trafficLightPole, laundry, type Kit,
} from './kit/props';
import { buildMedina, type MedinaData } from './medina';
import { MEDINA, RING, ROUNDABOUTS, RoadGraph, STREET, type Block, type RoadEdge, type StreetClass } from './roadGraph';
import { SEA_LEVEL } from './sea';
import { SidewalkGraph } from './sidewalkGraph';

const CURB = WORLD.curb;
const MARK = 0xdedcd2;

export interface CarSpawn {
  kind: keyof typeof VEHICLES;
  x: number;
  z: number;
  yaw: number;
  color?: number;
}

export interface CityData {
  graph: RoadGraph;
  medina: MedinaData;
  sidewalks: SidewalkGraph;
  group: THREE.Group;
  colliders: BoxCollider[];
  trimeshes: { vertices: Float32Array; indices: Uint32Array }[];
  carSpawns: CarSpawn[];
  trafficLights: { node: number; x: number; z: number; yaw: number }[];
  louageBays: { x: number; z: number; yaw: number }[];
  seats: { x: number; z: number; yaw: number }[];
  pois: Record<string, { x: number; z: number }>;
  shoreZ: number;
  stats: { vertices: number; triangles: number; buckets: number; byMat: Record<string, number> };
}

/** Drivable cars placed in the world at start (parking lanes and the louage station). */
const CAR_SPAWNS: CarSpawn[] = [
  { kind: 'hatch', x: 34, z: -55.55, yaw: Math.PI / 2, color: 0x8c1d1d },
  { kind: 'sedan', x: -46, z: -64.45, yaw: -Math.PI / 2, color: 0xdad8d0 },
  { kind: 'pickup', x: 284.45, z: -96, yaw: Math.PI, color: 0x6f8fae },
  { kind: 'hatch', x: 60, z: -195.55, yaw: Math.PI / 2, color: 0x2c4f8a },
  { kind: 'sedan', x: 144.45, z: 120, yaw: Math.PI, color: 0x222429 },
  { kind: 'pickup', x: -120, z: 84.45, yaw: Math.PI / 2, color: 0xd9d3c2 },
  { kind: 'hatch', x: 240, z: -204.45, yaw: -Math.PI / 2, color: 0xc9a23a },
  { kind: 'taxi', x: -30, z: 224.45, yaw: Math.PI / 2 },
];

class CityBuilder {
  b = new Builder();
  rng: RNG;
  k: Kit;
  graph = new RoadGraph();
  medina!: MedinaData;
  carSpawns: CarSpawn[] = [...CAR_SPAWNS];
  trafficLights: CityData['trafficLights'] = [];
  louageBays: CityData['louageBays'] = [];
  pois: CityData['pois'] = {};
  shoreZ = -372;
  private carCache = new Map<string, THREE.Group>();

  constructor(seed: number, private atlas: Atlas) {
    this.rng = new RNG(seed);
    this.k = { b: this.b, atlas, rng: this.rng };
  }

  build(): void {
    SEATS.length = 0;
    this.ground();
    this.roads();
    this.roundabouts();
    for (const blk of this.graph.blocks) this.block(blk);
    this.beach();
    this.hills();
    this.bounds();
  }

  // ------------------------------------------------------------------ ground
  private ground(): void {
    const t = 100;
    for (let x = -500; x < 500; x += t) {
      for (let z = -400; z < 500; z += t) {
        const z0 = Math.max(z, -351.2);
        if (z0 >= z + t) continue;
        this.b.flat('road', x + t / 2, 0, (z0 + z + t) / 2, t, z + t - z0, 0x9a9690);
      }
    }
    this.b.solid(0, -1, 74, 1100, 2, 852); // the ground itself
  }

  // ------------------------------------------------------------------ slabs
  /** Outline of a block slab with rounded corners; corners near a roundabout are cut along its circle. */
  private outline(x0: number, x1: number, z0: number, z1: number, fillet: number[]): [number, number][] {
    const corners = [
      { c: [x0, z0], inn: [0, -1], out: [1, 0] },
      { c: [x1, z0], inn: [1, 0], out: [0, 1] },
      { c: [x1, z1], inn: [0, 1], out: [-1, 0] },
      { c: [x0, z1], inn: [-1, 0], out: [0, -1] },
    ];
    const pts: [number, number][] = [];
    corners.forEach((q, n) => {
      const [cx, cz] = q.c;
      const rb = ROUNDABOUTS.find((r) => Math.hypot(cx - r.x, cz - r.z) < r.radius);
      if (rb) {
        const hit = (dx: number, dz: number) => {
          // distance t > 0 from the corner along (dx, dz) where we cross the circle
          const ox = cx - rb.x, oz = cz - rb.z;
          const bq = ox * dx + oz * dz, cq = ox * ox + oz * oz - rb.radius * rb.radius;
          return -bq + Math.sqrt(bq * bq - cq);
        };
        const t1 = hit(-q.inn[0], -q.inn[1]), t2 = hit(q.out[0], q.out[1]);
        const p1 = [cx - q.inn[0] * t1, cz - q.inn[1] * t1], p2 = [cx + q.out[0] * t2, cz + q.out[1] * t2];
        const a1 = Math.atan2(p1[1] - rb.z, p1[0] - rb.x);
        let da = Math.atan2(p2[1] - rb.z, p2[0] - rb.x) - a1;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const steps = Math.max(3, Math.ceil(Math.abs(da) / 0.14));
        for (let i = 0; i <= steps; i++) {
          const a = a1 + (da * i) / steps;
          pts.push([rb.x + Math.cos(a) * rb.radius, rb.z + Math.sin(a) * rb.radius]);
        }
      } else if (fillet[n] > 0) {
        const r = fillet[n];
        const s = [cx - q.inn[0] * r, cz - q.inn[1] * r], e = [cx + q.out[0] * r, cz + q.out[1] * r];
        for (let i = 0; i <= 5; i++) {
          const t = i / 5, u = 1 - t;
          pts.push([u * u * s[0] + 2 * u * t * cx + t * t * e[0], u * u * s[1] + 2 * u * t * cz + t * t * e[1]]);
        }
      } else pts.push([cx, cz]);
    });
    return pts;
  }

  /** Painted curb stones along one straight side (red/white or black/white). */
  private paintedCurb(xa: number, za: number, xb: number, zb: number, c1: number, c2: number, nx: number, nz: number): void {
    const len = Math.hypot(xb - xa, zb - za);
    const n = Math.max(1, Math.round(len / 1.4));
    const ux = (xb - xa) / len, uz = (zb - za) / len;
    for (let i = 0; i < n; i++) {
      const s0 = (len * i) / n, s1 = (len * (i + 1)) / n;
      const ax = xa + ux * s0 + nx * 0.012, az = za + uz * s0 + nz * 0.012;
      const bx = xa + ux * s1 + nx * 0.012, bz = za + uz * s1 + nz * 0.012;
      const col = i % 2 ? c1 : c2;
      // which winding faces outward depends on the side; emit the one facing (nx, nz)
      const cross = ux * nz - uz * nx;
      if (cross < 0) this.b.quad('matte', [ax, 0, az], [bx, 0, bz], [bx, CURB, bz], [ax, CURB, az], col);
      else this.b.quad('matte', [bx, 0, bz], [ax, 0, az], [ax, CURB, az], [bx, CURB, bz], col);
      const mx = (ax + bx) / 2 - nx * 0.15, mz = (az + bz) / 2 - nz * 0.15;
      this.b.flat('decal', mx, CURB + 0.004, mz, Math.abs(ux) > 0.5 ? s1 - s0 : 0.3, Math.abs(ux) > 0.5 ? 0.3 : s1 - s0, col);
    }
  }

  private paveTint(d: Block['district']): number {
    switch (d) {
      case 'downtown': return 0xd2d0cb;
      case 'medina': return 0xecd8ae;
      case 'corniche': return 0xe2d8c2;
      case 'civic': return 0xd0cec6;
      case 'edge': return 0xc4b898;
      default: return 0xc9c3b6;
    }
  }

  // ------------------------------------------------------------------ roads
  private roads(): void {
    const { b, graph } = this;
    for (const e of graph.edges) {
      const a = graph.nodes[e.a];
      b.push(a.x, a.z, Math.atan2(e.dx, e.dz));
      const s0 = e.trimA + (graph.nodes[e.a].kind === 'end' ? 0 : 5), s1 = e.length - e.trimB - (graph.nodes[e.b].kind === 'end' ? 0 : 5);
      const dash = (x: number, w: number, on: number, off: number, color = MARK) => {
        for (let s = s0; s < s1 - on * 0.5; s += on + off) b.flat('decal', x, 0.012, s + on / 2, w, Math.min(on, s1 - s), color);
      };
      const solid = (x: number, w: number, color = MARK) => b.flat('decal', x, 0.012, (s0 + s1) / 2, w, s1 - s0, color);
      if (s1 > s0) {
        if (e.cls === 'main') {
          dash(0, 0.14, 3, 5);
          for (const s of [-1, 1]) dash(s * (e.hw - 2.25), 0.1, 5.2, 0.4, 0xc9c7be);
        } else if (e.cls === 'corniche') {
          solid(0, 0.14);
          for (const s of [-1, 1]) solid(s * (e.hw - 0.35), 0.12);
        } else if (e.cls === 'boulevard') {
          for (const s of [-1, 1]) {
            dash(s * (e.median / 2 + e.laneW + 0.1), 0.14, 3, 5);
            solid(s * (e.hw - 0.3), 0.12);
          }
        } else if (e.cls === 'highway') {
          for (const s of [-1, 1]) {
            dash(s * (e.median / 2 + e.laneW), 0.16, 4, 8);
            solid(s * (e.median / 2 + 0.25), 0.14, 0xd9b83a);
            solid(s * (e.hw - 0.4), 0.14);
          }
          // concrete barrier in the middle
          b.box('matte', 0, 0.42, (s0 + s1) / 2, 0.5, 0.84, s1 - s0 + 6, 0xb5b0a4);
          b.box('matte', 0, 0.12, (s0 + s1) / 2, 0.8, 0.24, s1 - s0 + 6, 0xa8a398);
          b.solid(0, 0.42, (s0 + s1) / 2, 0.6, 0.84, s1 - s0 + 6);
        }
      }
      // crosswalks at both ends
      if (e.cls !== 'highway' && e.cls !== 'minor') {
        const zebra = (s: number) => {
          const spans = e.cls === 'boulevard' ? [[-e.hw + 0.4, -e.median / 2 - 0.3], [e.median / 2 + 0.3, e.hw - 0.4]] : [[-e.hw + 0.4, e.hw - 0.4]];
          for (const [xa, xb] of spans) for (let x = xa + 0.3; x < xb - 0.2; x += 1.0) b.flat('decal', x, 0.013, s, 0.5, 3.0, 0xe6e4da);
        };
        if (graph.nodes[e.a].kind !== 'end') zebra(e.trimA + 2.4);
        if (graph.nodes[e.b].kind !== 'end') zebra(e.length - e.trimB - 2.4);
      }
      b.pop();
      // traffic lights: one pole per approach, on the right, before the crossing
      for (const end of [0, 1] as const) {
        const node = graph.nodes[end === 0 ? e.a : e.b];
        if (!node.lights) continue;
        const dir = end === 0 ? -1 : 1; // driving toward this node: along +dir of the edge
        const s = end === 0 ? e.trimA + 4.4 : e.length - e.trimB - 4.4;
        const off = e.hw + 0.7;
        const hx = e.dx * dir, hz = e.dz * dir; // heading
        const x = a.x + e.dx * s - hz * off, z = a.z + e.dz * s + hx * off;
        const yaw = Math.atan2(-hx, -hz); // lamps face the incoming driver
        b.push(0, 0, 0, CURB);
        trafficLightPole(this.k, x, z, yaw);
        b.pop();
        this.trafficLights.push({ node: node.id, x, z, yaw });
        // stop line
        b.push(a.x, a.z, Math.atan2(e.dx, e.dz));
        const lo = e.median / 2, hi = e.hw - 0.3;
        b.flat('decal', (-dir * (lo + hi)) / 2, 0.013, s + dir * 0.6 * -1 + (end === 0 ? 0 : 0), hi - lo, 0.45, MARK);
        b.pop();
      }
      if (e.cls === 'boulevard') this.promenade(e);
    }
  }

  /** The walking promenade in the middle of the boulevard: ficus trees, benches, lanterns, kiosks. */
  private promenade(e: RoadEdge): void {
    const { b, k, rng, graph } = this;
    const a = graph.nodes[e.a];
    const z0 = a.z + e.trimA + 4.6, z1 = a.z + e.length - e.trimB - 4.6;
    const hw = e.median / 2;
    const pts = this.outline(a.x - hw, a.x + hw, z0, z1, [4, 4, 4, 4]);
    b.slab('pave', pts, 0, CURB, 0xd8d2c4, 0xa8a49c);
    this.paintedCurb(a.x - hw, z0 + 4, a.x - hw, z1 - 4, 0x2a2a2a, 0xe8e6de, -1, 0);
    this.paintedCurb(a.x + hw, z0 + 4, a.x + hw, z1 - 4, 0x2a2a2a, 0xe8e6de, 1, 0);
    b.push(a.x, 0, 0, CURB);
    b.flat('decal', 0, 0.012, (z0 + z1) / 2, 4.2, z1 - z0 - 6, 0xcbb894);
    const len = z1 - z0;
    const n = Math.floor((len - 10) / 9);
    const mid = Math.floor(n / 2);
    for (let i = 0; i <= n; i++) {
      const z = z0 + 5 + ((len - 10) * i) / n;
      for (const s of [-1, 1]) {
        ficus(k, s * 3.9, z, rng.range(6.5, 7.6));
        // tree pit
        b.flat('decal', s * 3.9, 0.014, z, 1.5, 1.5, 0x6a5a48);
      }
      if (i % 2 === 1) for (const s of [-1, 1]) lantern(k, s * 5.3, z + 4.5, 4.2);
      if (i % 2 === 0 && i !== mid) {
        const s = i % 4 === 0 ? 1 : -1;
        bench(k, s * 2.5, z + 4.5, -s * Math.PI / 2);
      }
    }
    kiosk(k, 0, z0 + 5 + ((len - 10) * mid) / n + 4.5);
    if (rng.chance(0.6)) bin(k, 2.6, z0 + 9, Math.PI / 2);
    b.pop();
  }

  private roundabouts(): void {
    const { b, k } = this;
    for (const r of ROUNDABOUTS) {
      const pts: [number, number][] = [];
      for (let i = 0; i < 28; i++) pts.push([r.x + Math.cos((i / 28) * Math.PI * 2) * r.island, r.z + Math.sin((i / 28) * Math.PI * 2) * r.island]);
      b.slab('pave', pts, 0, CURB + 0.05, 0xd8d2c4, 0xe8e6de);
      b.push(r.x, r.z, 0, CURB + 0.05);
      // planter ring with grass, flowers and palms
      b.cyl('matte', 0, 0, 0, r.island - 1.2, 0.35, 0xcfc6ae, 24);
      b.cyl('foliage', 0, 0.35, 0, r.island - 1.5, 0.06, 0x5f8a44, 24);
      const n = r.name === 'clock' ? 8 : 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = r.island - 2.6;
        if (r.name === 'clock') {
          if (i % 2 === 0) palm(k, Math.cos(a) * rr, Math.sin(a) * rr, 7.5, false);
          else for (let q = 0; q < 3; q++) bush(k, Math.cos(a + q * 0.12 - 0.12) * rr, 0.35, Math.sin(a + q * 0.12 - 0.12) * rr, 0.9, [0xc2267a, 0xe8c81a, 0xd9261a][q]);
        } else palm(k, Math.cos(a) * rr * 0.7, Math.sin(a) * rr * 0.7, 8.5, false);
      }
      if (r.name === 'clock') clockTower(k, 0, 0);
      else {
        b.cyl('matte', 0, 0.35, 0, 1.2, 1.4, 0xe6d6b0, 8);
        flagPole(k, 0, 0, 12);
      }
      b.solid(0, 0.4, 0, (r.island - 1.2) * 1.5, 0.8, (r.island - 1.2) * 1.5);
      b.pop();
      this.pois[r.name] = { x: r.x, z: r.z };
    }
  }

  // ------------------------------------------------------------------ blocks
  private block(blk: Block): void {
    const { b } = this;
    const fr = (s1: StreetClass | null, s2: StreetClass | null) => (s1 && s2 ? (s1 === 'minor' && s2 === 'minor' ? 2 : 3.2) : 0);
    const fillet = [fr(blk.sides.n, blk.sides.w), fr(blk.sides.n, blk.sides.e), fr(blk.sides.s, blk.sides.e), fr(blk.sides.s, blk.sides.w)];
    const special = blk.district === 'louage' || blk.district === 'fuel';
    if (!special) {
      const tint = this.paveTint(blk.district);
      b.slab('pave', this.outline(blk.x0, blk.x1, blk.z0, blk.z1, fillet), 0, CURB, tint, 0xa9a59c);
      // painted curbs on the big streets
      const paint = (cls: StreetClass | null): [number, number] | null => (cls === 'boulevard' ? [0x2a2a2a, 0xe8e6de] : cls === 'corniche' ? [0xb8322a, 0xe8e6de] : null);
      const m = 5;
      const pn = paint(blk.sides.n), ps = paint(blk.sides.s), pw = paint(blk.sides.w), pe = paint(blk.sides.e);
      if (pn) this.paintedCurb(blk.x0 + m, blk.z0, blk.x1 - m, blk.z0, pn[0], pn[1], 0, -1);
      if (ps) this.paintedCurb(blk.x0 + m, blk.z1, blk.x1 - m, blk.z1, ps[0], ps[1], 0, 1);
      if (pw && blk.z1 - blk.z0 > 60) this.paintedCurb(blk.x0, blk.z0 + m, blk.x0, blk.z1 - (blk.z1 > 200 ? 30 : m), pw[0], pw[1], -1, 0);
      if (pe && blk.z1 - blk.z0 > 60) this.paintedCurb(blk.x1, blk.z0 + m, blk.x1, blk.z1 - (blk.z1 > 200 ? 30 : m), pe[0], pe[1], 1, 0);
    }
    switch (blk.district) {
      case 'downtown': this.rows(blk, 'downtown'); break;
      case 'houma': this.rows(blk, 'houma'); break;
      case 'corniche': this.rows(blk, 'corniche'); break;
      case 'edge': this.rows(blk, 'edge'); break;
      case 'medina': this.medinaBlock(blk); break;
      case 'louage': this.louageBlock(blk); break;
      case 'civic': this.civicBlock(blk); break;
      case 'fuel': this.fuelBlock(blk); break;
    }
  }

  private nearRoundabout(pts: [number, number][], margin: number): boolean {
    for (const [lx, lz] of pts) {
      const [x, z] = this.b.toWorld(lx, lz);
      for (const r of ROUNDABOUTS) if (Math.hypot(x - r.x, z - r.z) < r.radius + margin) return true;
    }
    return false;
  }

  private parkedCar(lx: number, lz: number, yaw: number): void {
    const { b, rng } = this;
    const [wx, wz] = b.toWorld(lx, lz);
    if (this.carSpawns.some((c) => Math.hypot(c.x - wx, c.z - wz) < 8)) return;
    const kind = rng.pick(['hatch', 'hatch', 'sedan', 'sedan', 'taxi', 'pickup', 'hatch', 'sedan'] as const);
    const spec = VEHICLES[kind];
    const color = rng.pick(spec.colors);
    const key = kind + color;
    let g = this.carCache.get(key);
    if (!g) {
      g = buildCarModel(spec, color, this.atlas, this.carCache.size, true).group;
      this.carCache.set(key, g);
    }
    const wyaw = b.worldYaw + yaw;
    b.world(() => {
      b.bake(g!, wx, 0, wz, wyaw);
      b.solid(wx, spec.height / 2, wz, spec.width, spec.height, spec.length, wyaw);
    });
  }

  /** Fills a block with rows of buildings along its streets, plus sidewalk props. */
  private rows(blk: Block, style: 'downtown' | 'houma' | 'corniche' | 'edge'): void {
    const { b, k, rng } = this;
    const sw = (c: StreetClass | null) => (c ? STREET[c].sidewalk : 0);
    const ix0 = blk.x0 + sw(blk.sides.w), ix1 = blk.x1 - sw(blk.sides.e), iz0 = blk.z0 + sw(blk.sides.n), iz1 = blk.z1 - sw(blk.sides.s);
    const W = ix1 - ix0, D = iz1 - iz0;
    const cfg = {
      downtown: { depth: [15, 18], lot: [14, 24] },
      houma: { depth: [9.5, 12], lot: [7, 12] },
      corniche: { depth: [11, 14], lot: [9, 15] },
      edge: { depth: [9, 11], lot: [8, 13] },
    }[style];
    const dmax = cfg.depth[1];
    const sides: { key: 'n' | 's' | 'w' | 'e'; ox: number; oz: number; yaw: number; len: number }[] = [];
    const twoRows = style !== 'edge' && Math.min(W, D) < dmax * 2 + 8;
    const alongX = !twoRows || W >= D;
    if (style === 'edge') {
      // outer blocks: only build along sides that have a street. Corners are owned by the first side found.
      const hasN = !!blk.sides.n, hasS = !!blk.sides.s, hasW = !!blk.sides.w, hasE = !!blk.sides.e;
      const xa = Math.max(ix0, -452 + 2), xb = Math.min(ix1, 452 - 2), za = iz0, zb = Math.min(iz1, 400);
      if (hasN) sides.push({ key: 'n', ox: (xa + xb) / 2, oz: iz0, yaw: Math.PI, len: xb - xa });
      if (hasS) sides.push({ key: 's', ox: (xa + xb) / 2, oz: iz1, yaw: 0, len: xb - xa });
      const zc0 = za + (hasN ? dmax : 0), zc1 = zb - (hasS ? dmax : 0);
      if (hasW && zc1 - zc0 > 8) sides.push({ key: 'w', ox: ix0, oz: (zc0 + zc1) / 2, yaw: -Math.PI / 2, len: zc1 - zc0 });
      if (hasE && zc1 - zc0 > 8) sides.push({ key: 'e', ox: ix1, oz: (zc0 + zc1) / 2, yaw: Math.PI / 2, len: zc1 - zc0 });
    } else {
      if (alongX) {
        sides.push({ key: 'n', ox: (ix0 + ix1) / 2, oz: iz0, yaw: Math.PI, len: W });
        sides.push({ key: 's', ox: (ix0 + ix1) / 2, oz: iz1, yaw: 0, len: W });
      }
      if (!twoRows || !alongX) {
        const cut = alongX ? dmax : 0;
        sides.push({ key: 'w', ox: ix0, oz: (iz0 + iz1) / 2, yaw: -Math.PI / 2, len: D - cut * 2 });
        sides.push({ key: 'e', ox: ix1, oz: (iz0 + iz1) / 2, yaw: Math.PI / 2, len: D - cut * 2 });
      }
    }
    const fullCorner = (key: string) => (alongX ? key === 'n' || key === 's' : key === 'w' || key === 'e');

    for (const side of sides) {
      const cls = blk.sides[side.key];
      const walk = sw(cls);
      b.push(side.ox, side.oz, side.yaw, CURB);
      let x = -side.len / 2;
      let first = true;
      while (x < side.len / 2 - 0.5) {
        let w = rng.range(cfg.lot[0], cfg.lot[1]);
        const remain = side.len / 2 - x;
        if (remain - w < cfg.lot[0]) w = remain;
        const last = w === remain;
        const corner = (first || last) && fullCorner(side.key);
        let d = corner ? dmax : rng.range(cfg.depth[0], cfg.depth[1]);
        if (twoRows) d = Math.min(d, (alongX ? D : W) / 2);
        const cx = x + w / 2;
        const foot: [number, number][] = [[x, 0], [x + w, 0], [x, -d], [x + w, -d]];
        if (this.nearRoundabout(foot, 3.5)) {
          // open plaza near the roundabout
          if (rng.chance(0.7)) palm(k, cx, -d * 0.35, rng.range(6.5, 8));
          if (rng.chance(0.5)) bench(k, cx + 2, -1.2, 0);
        } else if (!corner && style !== 'downtown' && rng.chance(style === 'edge' ? 0.18 : 0.07)) {
          this.emptyLot(cx, w, d);
        } else {
          b.push(cx, -d / 2, 0);
          const open = { f: true, b: true, l: first || style === 'edge', r: last || style === 'edge' };
          this.building(style, w - (style === 'edge' || (style === 'houma' && rng.chance(0.25)) ? rng.range(0.6, 2) : 0), d, open, cls, walk);
          b.pop();
        }
        x += w;
        first = false;
      }
      this.sidewalkProps(side.len, walk, cls, style);
      b.pop();
    }
    // inside of the block: yards, trees, laundry
    if (style !== 'edge') {
      const m = dmax + 1.5;
      const yx0 = ix0 + m, yx1 = ix1 - m, yz0 = iz0 + m, yz1 = iz1 - m;
      if (yx1 - yx0 > 6 && yz1 - yz0 > 6) {
        b.flat('decal', (yx0 + yx1) / 2, CURB + 0.02, (yz0 + yz1) / 2, yx1 - yx0 + 3, yz1 - yz0 + 3, style === 'downtown' ? 0x9a958a : 0xb8a680);
        const n = Math.floor(((yx1 - yx0) * (yz1 - yz0)) / 260) + 1;
        b.push(0, 0, 0, CURB);
        for (let i = 0; i < n; i++) {
          const x = rng.range(yx0, yx1), z = rng.range(yz0, yz1);
          const r = rng.next();
          if (r < 0.4) olive(k, x, 0, z, rng.range(0.8, 1.2));
          else if (r < 0.6) orangeTree(k, x, z);
          else if (r < 0.75) palm(k, x, z, rng.range(5, 7));
          else if (r < 0.9) laundry(k, x - 2.5, z, x + 2.5, z + rng.range(-1, 1), 0);
          else b.box('wall', x, 1.2, z, rng.range(3, 5), 2.4, rng.range(3, 4), rng.pick(PALETTE.walls), rng.range(0, 3), 8);
        }
        b.pop();
      }
    }
  }

  private building(style: 'downtown' | 'houma' | 'corniche' | 'edge', w: number, d: number, open: { f: boolean; b: boolean; l: boolean; r: boolean }, cls: StreetClass | null, walk: number): void {
    const { k, rng } = this;
    if (style === 'downtown') {
      const boulevard = cls === 'boulevard';
      const pool: ShopKind[] = boulevard
        ? ['cafe', 'shop', 'bakery', 'cafe', 'pharmacy', 'shop', 'food', 'shop']
        : ['shop', 'hanout', 'barber', 'closed', 'food', 'bakery', 'shop', 'garage', 'cafe', 'pharmacy'];
      const shops: ShopKind[] = [];
      for (let i = 0; i < 6; i++) shops.push(rng.pick(pool));
      colonial(k, w, d, { floors: boulevard ? rng.int(3, 5) : rng.int(2, 4), open, arcade: boulevard || rng.chance(0.15), shops, terrace: walk });
    } else if (style === 'corniche') {
      const sea = cls === 'corniche';
      const shop = sea ? rng.pick<ShopKind | null>(['cafe', 'fish', 'cafe', 'food', null]) : rng.chance(0.25) ? rng.pick<ShopKind>(['hanout', 'cafe', 'shop', 'bakery']) : null;
      house(k, w, d, { floors: rng.int(2, 3), open, style: 'corniche', shop, terrace: walk });
    } else {
      const main = cls === 'main';
      const shop = rng.chance(main ? 0.4 : 0.2) ? rng.pick<ShopKind>(['hanout', 'hanout', 'bakery', 'barber', 'cafe', 'garage', 'closed', 'food', 'shop']) : null;
      const floors = style === 'edge' ? rng.int(1, 2) : rng.pick([1, 2, 2, 2, 3, 3]);
      house(k, w, d, { floors, open, style: 'houma', shop, terrace: walk, unfinished: rng.chance(style === 'edge' ? 0.35 : 0.24) });
    }
  }

  /** Empty lot between houses: low wall, rubble, a tree or a parked scooter. */
  private emptyLot(cx: number, w: number, d: number): void {
    const { b, k, rng } = this;
    b.flat('decal', cx, 0.02, -d / 2, w, d, 0xb39c74);
    const r = rng.next();
    if (r < 0.5) {
      lowWall(k, cx - w / 2 + 0.2, -0.2, cx - 1.2, -0.2, rng.range(1.6, 2.2), 0.2, rng.pick(PALETTE.walls));
      lowWall(k, cx + 1.2, -0.2, cx + w / 2 - 0.2, -0.2, rng.range(1.6, 2.2), 0.2, rng.pick(PALETTE.walls));
      olive(k, cx + rng.range(-2, 2), 0, -d * 0.6, 1.1);
    } else {
      // bricks, sand pile and rebar: someone will build here "soon"
      b.blob('matte', cx - 1.5, 0.3, -d * 0.4, 1.6, 0.7, 1.4, 0xcdb888, 1);
      for (let i = 0; i < 3; i++) b.box('matte', cx + 1 + i * 0.1, 0.25 + i * 0.5, -d * 0.5, 1.2, 0.5, 0.8, shade(PALETTE.brick, 0.9 + i * 0.08), rng.range(-0.1, 0.1));
      b.solid(cx + 1, 0.75, -d * 0.5, 1.2, 1.5, 0.8);
      if (rng.chance(0.5)) scooter(k, cx, -1.5, rng.range(0, 3));
    }
  }

  /** Lamps, trees, bins and parked cars along one side of a block. Frame: x along the curb, z = 0 at the building line, +z = street. */
  private sidewalkProps(len: number, walk: number, cls: StreetClass | null, style: string): void {
    const { b, k, rng } = this;
    if (!cls || walk < 1.5) return;
    const curbZ = walk;
    const m = 7;
    const blocked = (x: number) => this.nearRoundabout([[x, curbZ]], 1.5);
    const step = cls === 'minor' ? 34 : 30;
    for (let x = -len / 2 + m; x < len / 2 - m; x += step) {
      if (blocked(x)) continue;
      if (style === 'corniche' && cls === 'corniche') lantern(k, x, curbZ - 0.6, 4.2);
      else lamp(k, x, curbZ - 0.55, 0, cls === 'boulevard' ? 8 : cls === 'minor' ? 5.5 : 6.8);
    }
    if (walk >= 3) {
      const tstep = style === 'downtown' ? 15 : 22;
      for (let x = -len / 2 + m + tstep / 2; x < len / 2 - m; x += tstep) {
        if (blocked(x) || rng.chance(0.25)) continue;
        b.flat('decal', x, 0.014, curbZ - 0.95, 1.2, 1.2, 0x6a5a48);
        if (style === 'corniche') palm(k, x, curbZ - 0.95, rng.range(5.5, 7.5));
        else orangeTree(k, x, curbZ - 0.95);
      }
    }
    for (let x = -len / 2 + m + 11; x < len / 2 - m; x += 60) {
      if (blocked(x)) continue;
      if (rng.chance(0.55)) bin(k, x + rng.range(-4, 4), curbZ - 0.6, rng.chance(0.5) ? 0 : Math.PI);
      else if (rng.chance(0.5)) scooter(k, x + rng.range(-4, 4), 0.7, rng.range(1.2, 1.9));
    }
    if (cls === 'main') {
      const pz = curbZ + 1.15;
      for (let x = -len / 2 + 12; x < len / 2 - 12; x += 5.7) {
        if (rng.chance(0.2) && !blocked(x)) this.parkedCar(x, pz, -Math.PI / 2 + rng.range(-0.03, 0.03));
      }
    }
  }

  // ------------------------------------------------------------------ special blocks
  private medinaBlock(blk: Block): void {
    const { b, k, rng } = this;
    const m = 3;
    this.medina = buildMedina(k, blk.x0 + m, blk.x1 - m, blk.z0 + m, blk.z1 - m, CURB);
    // lanterns around the walls
    b.push(0, 0, 0, CURB);
    for (let x = blk.x0 + 12; x < blk.x1 - 8; x += 26) {
      lantern(k, x, blk.z0 + 0.7);
      lantern(k, x, blk.z1 - 0.7);
    }
    for (let z = blk.z0 + 14; z < blk.z1 - 8; z += 26) {
      lantern(k, blk.x0 + 0.7, z);
      lantern(k, blk.x1 - 0.7, z);
      if (rng.chance(0.35)) palm(k, blk.x1 - 1.0, z + 9, 6);
    }
    b.pop();
    this.pois.medina = { x: (blk.x0 + blk.x1) / 2, z: (blk.z0 + blk.z1) / 2 };
  }

  private louageBlock(blk: Block): void {
    const { b, k } = this;
    const t = 3; // sidewalk ring with two openings for the louages
    const tint = 0xc9c3b6, side = 0xa9a59c;
    const rect = (x0: number, x1: number, z0: number, z1: number) => b.slab('pave', [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], 0, CURB, tint, side);
    const gz = (blk.z0 + blk.z1) / 2 + 30, gx = (blk.x0 + blk.x1) / 2;
    rect(blk.x0, blk.x1, blk.z0, blk.z0 + t);
    rect(blk.x0, blk.x0 + t, blk.z0 + t, blk.z1);
    rect(blk.x0 + t, gx - 7, blk.z1 - t, blk.z1);
    rect(gx + 7, blk.x1, blk.z1 - t, blk.z1);
    rect(blk.x1 - t, blk.x1, blk.z0 + t, gz - 7);
    rect(blk.x1 - t, blk.x1, gz + 7, blk.z1 - t);
    b.flat('decal', gx, 0.011, (blk.z0 + blk.z1) / 2, blk.x1 - blk.x0 - 2 * t, blk.z1 - blk.z0 - 2 * t, 0x77777a);
    b.push(gx, (blk.z0 + blk.z1) / 2, 0);
    const w = blk.x1 - blk.x0 - 2 * t, d = blk.z1 - blk.z0 - 2 * t;
    const st = louageStation(k, w, d);
    const spec = VEHICLES.louage;
    const model = buildCarModel(spec, spec.colors[0], this.atlas, 0, true).group;
    st.bays.forEach((bay, i) => {
      const [wx, wz] = b.toWorld(bay.x, bay.z);
      this.louageBays.push({ x: wx, z: wz, yaw: bay.yaw });
      if (i === 5) {
        this.carSpawns.push({ kind: 'louage', x: wx, z: wz, yaw: bay.yaw });
        this.pois.louageStart = { x: wx, z: wz };
      } else if (i % 3 !== 1) {
        b.world(() => {
          b.bake(model, wx, 0, wz, bay.yaw);
          b.solid(wx, spec.height / 2, wz, spec.width, spec.height, spec.length, bay.yaw);
        });
      }
    });
    b.pop();
    b.push(0, 0, 0, CURB);
    for (let x = blk.x0 + 10; x < blk.x1 - 5; x += 28) lamp(k, x, blk.z0 + 0.6, Math.PI, 7);
    for (let z = blk.z0 + 20; z < blk.z1 - 5; z += 28) lamp(k, blk.x0 + 0.6, z, -Math.PI / 2, 7);
    b.pop();
    this.pois.louage = { x: gx, z: (blk.z0 + blk.z1) / 2 };
  }

  private civicBlock(blk: Block): void {
    const { b, k, rng } = this;
    const cz = (blk.z0 + blk.z1) / 2;
    b.push(blk.x1 - 3 - 9, cz, Math.PI / 2, CURB);
    policeStation(k, 28, 16);
    b.pop();
    this.pois.police = { x: blk.x1 + 1, z: cz };
    // public garden for the rest
    const gx0 = blk.x0 + 3, gx1 = blk.x1 - 26, gz0 = blk.z0 + 3, gz1 = blk.z1 - 3;
    b.push(0, 0, 0, CURB);
    b.flat('decal', (gx0 + gx1) / 2, 0.02, (gz0 + gz1) / 2, gx1 - gx0, gz1 - gz0, 0x6f8a4a);
    b.flat('decal', (gx0 + gx1) / 2, 0.03, cz, gx1 - gx0, 4, 0xd9cfb6);
    b.flat('decal', (gx0 + gx1) / 2, 0.03, cz, 4, gz1 - gz0, 0xd9cfb6);
    b.cyl('matte', (gx0 + gx1) / 2, 0, cz, 3.2, 0.6, 0xd8cfb8, 12);
    b.cyl('glass', (gx0 + gx1) / 2, 0.52, cz, 2.9, 0.1, 0x3a7a8a, 12);
    b.cyl('matte', (gx0 + gx1) / 2, 0.5, cz, 0.4, 1.4, 0xd8cfb8, 8);
    b.solid((gx0 + gx1) / 2, 0.4, cz, 5.5, 0.8, 5.5);
    for (let i = 0; i < 46; i++) {
      const x = rng.range(gx0 + 2, gx1 - 2), z = rng.range(gz0 + 2, gz1 - 2);
      if (Math.abs(z - cz) < 4 || Math.abs(x - (gx0 + gx1) / 2) < 4) continue;
      const r = rng.next();
      if (r < 0.35) ficus(k, x, z, rng.range(5.5, 7.5));
      else if (r < 0.6) palm(k, x, z, rng.range(6, 9));
      else if (r < 0.8) olive(k, x, 0, z, 1.2);
      else bush(k, x, 0, z, rng.range(0.8, 1.4), rng.pick([0xc2267a, 0x3a6a33, 0xe8c81a]));
    }
    for (let i = 0; i < 6; i++) {
      bench(k, gx0 + 12 + i * 16, cz + 2.8, Math.PI);
      lantern(k, gx0 + 20 + i * 16, cz - 2.6);
    }
    for (const [xa, za, xb, zb] of [[gx0, gz0, gx1, gz0], [gx0, gz1, gx1, gz1], [gx0, gz0, gx0, cz - 4], [gx0, cz + 4, gx0, gz1]]) {
      const n = Math.round(Math.hypot(xb - xa, zb - za) / 12);
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 0.8) / n;
        lowWall(k, xa + (xb - xa) * t0, za + (zb - za) * t0, xa + (xb - xa) * t1, za + (zb - za) * t1, 0.7, 0.3, 0xf1ece2, 0x1f6fb5);
      }
    }
    b.pop();
    this.pois.garden = { x: (gx0 + gx1) / 2, z: cz };
  }

  private fuelBlock(blk: Block): void {
    const { b, k } = this;
    const x0 = 34, x1 = 120, z0 = blk.z0 + 1, d = 32;
    b.flat('decal', (x0 + x1) / 2, 0.011, z0 + d / 2, x1 - x0, d, 0x77777a);
    b.push((x0 + x1) / 2, z0 + d / 2, 0);
    petrolStation(k, x1 - x0, d);
    b.pop();
    // side lots
    b.slab('pave', [[x1 + 2, blk.z0], [blk.x1, blk.z0], [blk.x1, 402], [x1 + 2, 402]], 0, CURB, 0xc4b898, 0xa9a59c);
    b.slab('pave', [[x0 - 6, z0 + d + 1], [x1 + 2, z0 + d + 1], [x1 + 2, 402], [x0 - 6, 402]], 0, CURB, 0xc4b898, 0xa9a59c);
    b.push(0, 0, 0, CURB);
    for (let x = x1 + 8; x < blk.x1 - 4; x += 9) palm(k, x, blk.z0 + 5, 7);
    b.pop();
    this.pois.fuel = { x: (x0 + x1) / 2, z: z0 + 8 };
  }

  // ------------------------------------------------------------------ beach and corniche walk
  private beach(): void {
    const { b, k, rng } = this;
    const zr = RING.z0 - STREET.corniche.hw; // north curb of the corniche road
    const zw = zr - 6.2; // sea wall
    // promenade slab
    b.slab('pave', [[-500, zw - 0.3], [500, zw - 0.3], [500, zr], [-500, zr]], 0, CURB, 0xe2d8c2, 0xa9a59c);
    this.paintedCurb(-430, zr, 430, zr, 0xb8322a, 0xe8e6de, 0, 1);
    for (const s of [-1, 1]) b.slab('pave', [[s * 425.6, zr], [s * 500, zr], [s * 500, RING.z0], [s * 425.6, RING.z0]], 0, CURB, 0xc4b898, 0xa9a59c);
    b.push(0, 0, 0, CURB);
    b.flat('decal', 0, 0.012, zr - 3.1, 900, 1.6, 0xcbb894);
    // sea wall with openings and steps down to the sand
    const gaps: number[] = [];
    for (let x = -390; x <= 390; x += 78) gaps.push(x);
    let prev = -452;
    for (const g of [...gaps, 460]) {
      const end = g === 460 ? 452 : g - 1.7;
      lowWall(k, prev, zw, end, zw, 0.85, 0.45, 0xf4f1ea, 0x1f6fb5);
      prev = g + 1.7;
    }
    for (const g of gaps) {
      for (let i = 0; i < 3; i++) {
        b.box('matte', g, -0.1 - i * 0.2, zw - 0.5 - i * 0.45, 3.2, 0.2, 0.5, 0xd8cfb8);
        b.solid(g, -0.1 - i * 0.2, zw - 0.5 - i * 0.45, 3.2, 0.2, 0.5);
      }
      this.pois['beach' + gaps.indexOf(g)] = { x: g, z: zw };
    }
    for (let x = -440; x < 440; x += 13) {
      if (gaps.some((g) => Math.abs(g - x) < 3)) continue;
      const i = Math.round((x + 440) / 13);
      if (i % 2 === 0) palm(k, x, zr - 1.4, rng.range(6.5, 8.5));
      else if (i % 4 === 1) lantern(k, x, zr - 5.2, 4.2);
      else bench(k, x, zr - 5.0, Math.PI);
    }
    b.pop();
    // sand: slopes down into the sea
    const top = -0.28, slope = 0.027;
    const zs = zw - 0.3;
    const n = 9, zEnd = zs - 70;
    for (let x = -480; x < 480; x += 40) {
      for (let i = 0; i < n; i++) {
        const za = zs + ((zEnd - zs) * i) / n, zb = zs + ((zEnd - zs) * (i + 1)) / n;
        const ya = top - slope * (zs - za), yb = top - slope * (zs - zb);
        const wet = (y: number) => THREE.MathUtils.smoothstep(SEA_LEVEL + 0.45, SEA_LEVEL - 0.1, y);
        const col = mixHex(mixHex(PALETTE.sand, 0xd9c48f, rng.next()), 0x9c8760, wet((ya + yb) / 2));
        b.quad('matte', [x, ya, za], [x + 40, ya, za], [x + 40, yb, zb], [x, yb, zb], col);
      }
    }
    // retaining face under the promenade
    b.quad('matte', [-500, top - 0.2, zs], [500, top - 0.2, zs], [500, CURB, zs], [-500, CURB, zs], 0xd8cfb8);
    this.shoreZ = zs - (top - SEA_LEVEL) / slope;
    // tilted collider for the sand
    const len = 70, ang = Math.atan(slope);
    this.b.colliders.push({ x: 0, y: top - (slope * len) / 2 - 0.5 * Math.cos(ang), z: zs - len / 2, hx: 500, hy: 0.5, hz: len / 2 / Math.cos(ang), yaw: 0, pitch: -ang });
    // boats, parasols, towels
    for (let x = -430; x < 430; x += rng.range(16, 34)) {
      const z = zs - rng.range(4, 15);
      const y = top - slope * (zs - z);
      const r = rng.next();
      if (r < 0.4) boat(k, x, y - 0.12, z, rng.range(0, Math.PI * 2));
      else if (r < 0.8) {
        b.push(x, z, rng.range(0, 3), y);
        parasol(k, 0, 0, rng.pick([0xd9261a, 0x1f6fb5, 0xe8c81a, 0xf2f2ee, 0x2f8a57]), 1.6);
        b.flat('decal', 1.0, 0.03, 0.4, 0.8, 1.8, rng.pick([0xd94a4a, 0x4a7ad9, 0xe8c36a, 0xf2f2f2]));
        b.pop();
      }
    }
    this.pois.corniche = { x: 0, z: RING.z0 };
  }

  // ------------------------------------------------------------------ hills around the city
  private hillHeight(x: number, z: number): number {
    const dx = Math.max(Math.abs(x) - 452, 0), dz = Math.max(z - 402, 0);
    const d = Math.hypot(dx, dz);
    const n = Math.sin(x * 0.013) * Math.cos(z * 0.017) * 9 + Math.sin(x * 0.041 + z * 0.033) * 3.5;
    const sea = THREE.MathUtils.smoothstep(z, -640, -400);
    return THREE.MathUtils.smoothstep(d, 0, 120) * (46 + n) * (0.25 + 0.75 * sea) + Math.min(d, 6) * 0.3 * sea + (d > 0 ? CURB : 0) - (1 - sea) * 4 * Math.min(1, d / 40);
  }

  private hills(): void {
    const { b, k, rng } = this;
    const s = 26;
    for (let x = -910; x < 910; x += s) {
      for (let z = -720; z < 910; z += s) {
        const inside = (px: number, pz: number) => Math.abs(px) <= 452 && pz <= 402;
        if (inside(x, z) && inside(x + s, z) && inside(x, z + s) && inside(x + s, z + s)) continue;
        const h00 = this.hillHeight(x, z), h10 = this.hillHeight(x + s, z), h01 = this.hillHeight(x, z + s), h11 = this.hillHeight(x + s, z + s);
        const n = Math.sin(x * 0.021 + z * 0.013) * 0.5 + 0.5;
        const base = mixHex(0x9a8f5a, 0x748052, n);
        const col = mixHex(base, 0xb89a6a, rng.range(0, 0.35));
        // two triangles as two quads with a repeated corner, so shading is faceted
        b.quad('matte', [x, h01, z + s], [x + s, h11, z + s], [x + s, h10, z], [x + s, h10, z], col);
        b.quad('matte', [x, h01, z + s], [x + s, h10, z], [x, h00, z], [x, h00, z], shade(col, 0.96));
      }
    }
    // olive trees and bushes on the slopes
    for (let i = 0; i < 520; i++) {
      const x = rng.range(-760, 760), z = rng.range(-560, 760);
      const dx = Math.max(Math.abs(x) - 452, 0), dz = Math.max(z - 402, 0);
      const d = Math.hypot(dx, dz);
      if (d < 10 || d > 300) continue;
      if (Math.abs(z - 360) < 22 && Math.abs(x) > 452 && d < 60) continue; // keep the highway cut clear
      const y = this.hillHeight(x, z);
      if (rng.chance(0.7)) olive(k, x, y - 0.2, z, rng.range(1.0, 1.9));
      else bush(k, x, y - 0.2, z, rng.range(1.2, 2.4), 0x5f6f48);
    }
    // highway tunnel mouths in the hills
    for (const sgn of [-1, 1]) {
      const x = sgn * 458;
      b.push(x, 360, sgn > 0 ? Math.PI / 2 : -Math.PI / 2);
      // local +z points out of the city
      b.box('matte', 0, 4.5, 4, 22, 9, 8, 0x1a1a1c, 0, 8);
      b.box('matte', -11.5, 5, 0.5, 5, 10, 3, 0xb5b0a4);
      b.box('matte', 11.5, 5, 0.5, 5, 10, 3, 0xb5b0a4);
      b.box('matte', 0, 9.2, 0.5, 28, 2.4, 3, 0xb5b0a4);
      b.box('matte', 0, 10.6, 0.3, 29, 0.5, 3.6, 0x9a958c);
      b.pop();
    }
  }

  private bounds(): void {
    const c = this.b.colliders;
    c.push({ x: -462, y: 20, z: 0, hx: 4, hy: 40, hz: 600, yaw: 0 });
    c.push({ x: 462, y: 20, z: 0, hx: 4, hy: 40, hz: 600, yaw: 0 });
    c.push({ x: 0, y: 20, z: 408, hx: 600, hy: 40, hz: 4, yaw: 0 });
    c.push({ x: 0, y: 20, z: this.shoreZ - 16, hx: 600, hy: 40, hz: 4, yaw: 0 });
  }
}

export function buildCity(seed: number, atlas: Atlas, materials: Record<Mat, THREE.Material>): CityData {
  const cb = new CityBuilder(seed, atlas);
  cb.build();
  const stats = cb.b.stats();
  const group = cb.b.build(materials);
  return {
    graph: cb.graph, medina: cb.medina, sidewalks: new SidewalkGraph(cb.graph, cb.medina), group, colliders: cb.b.colliders, trimeshes: cb.b.trimeshes, carSpawns: cb.carSpawns,
    trafficLights: cb.trafficLights, louageBays: cb.louageBays, seats: [...SEATS], pois: cb.pois, shoreZ: cb.shoreZ, stats,
  };
}
