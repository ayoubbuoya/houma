import type { Builder } from '../builder';
import { shade } from '../builder';
import type { Atlas } from '../atlas';
import type { RNG } from '../../core/rng';

/** Shared context for all kit pieces. */
export interface Kit {
  b: Builder;
  atlas: Atlas;
  rng: RNG;
}

const GREENS = [0x2f5a2c, 0x3a6a33, 0x34602f, 0x41733a];
const PALM_GREENS = [0x4d7a3a, 0x3f6b2f, 0x5c8a45, 0x557f3c];

/** Trimmed ficus, like the ones on the big avenues (cut into a box shape). */
export function ficus(k: Kit, x: number, z: number, h = 7, solid = true): void {
  const { b, rng } = k;
  const r = h * 0.34;
  b.cyl('matte', x, 0, z, 0.22, h * 0.6, 0x6b5a48, 6, 0.7);
  const c = rng.pick(GREENS);
  b.blob('foliage', x, h * 0.78, z, r, h * 0.24, r, c, 1, rng.range(0, 3));
  for (let i = 0; i < 3; i++) {
    const a = rng.range(0, Math.PI * 2);
    b.blob('foliage', x + Math.cos(a) * r * 0.5, h * rng.range(0.72, 0.88), z + Math.sin(a) * r * 0.5, r * 0.6, h * 0.16, r * 0.6, shade(c, rng.range(0.85, 1.2)), 0, rng.range(0, 3));
  }
  if (solid) b.solid(x, 1.5, z, 0.5, 3, 0.5);
}

/** Small street tree (bitter orange). */
export function orangeTree(k: Kit, x: number, z: number): void {
  const { b, rng } = k;
  const h = rng.range(3.2, 4.2);
  b.cyl('matte', x, 0, z, 0.1, h * 0.6, 0x5c4a3a, 6, 0.8);
  const c = rng.pick(GREENS);
  b.blob('foliage', x, h * 0.75, z, h * 0.33, h * 0.3, h * 0.33, c, 1, rng.range(0, 3));
  b.blob('foliage', x + 0.4, h * 0.85, z - 0.3, h * 0.22, h * 0.2, h * 0.22, shade(c, 1.15), 1, rng.range(0, 3));
  if (rng.chance(0.6)) {
    for (let i = 0; i < 6; i++) {
      const a = rng.range(0, Math.PI * 2), e = rng.range(-0.4, 0.6);
      b.blob('foliage', x + Math.cos(a) * h * 0.31 * Math.cos(e), h * 0.75 + Math.sin(e) * h * 0.28, z + Math.sin(a) * h * 0.31 * Math.cos(e), 0.09, 0.09, 0.09, 0xe8861a, 0);
    }
  }
  b.solid(x, 1, z, 0.3, 2, 0.3);
}

export function palm(k: Kit, x: number, z: number, h = 8, solid = true): void {
  const { b, rng } = k;
  const lean = rng.range(-0.05, 0.05), leanDir = rng.range(0, Math.PI * 2);
  const segs = 4;
  let px = x, pz = z;
  for (let i = 0; i < segs; i++) {
    const y = (h / segs) * i;
    b.cyl('matte', px, y, pz, 0.27 - i * 0.025, h / segs + 0.05, i % 2 ? 0x8a7458 : 0x7d6a50, 7, 0.9);
    px += Math.cos(leanDir) * lean * (h / segs) * (i + 1) * 0.6;
    pz += Math.sin(leanDir) * lean * (h / segs) * (i + 1) * 0.6;
  }
  b.blob('matte', px, h + 0.1, pz, 0.48, 0.55, 0.48, 0x6b5a3e, 0);
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const L = rng.range(3.0, 3.9), rise = rng.range(0.6, 1.9), droop = rng.range(2.6, 3.6);
    const ca = Math.cos(a), sa = Math.sin(a);
    const col = rng.pick(PALM_GREENS);
    let prev: number[][] | null = null;
    const steps = 5;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const r = L * t, y = h + 0.25 + rise * t - droop * t * t;
      const wd = 0.55 * (1 - 0.8 * t) + 0.05;
      const cx = px + ca * r, cz = pz + sa * r;
      const cur = [[cx - sa * wd, y - wd * 0.35, cz + ca * wd], [cx, y, cz], [cx + sa * wd, y - wd * 0.35, cz - ca * wd]];
      if (prev) {
        b.quad('foliage', prev[0], prev[1], cur[1], cur[0], col);
        b.quad('foliage', prev[1], prev[2], cur[2], cur[1], shade(col, 0.88));
      }
      prev = cur;
    }
  }
  // dates
  if (rng.chance(0.5)) b.blob('matte', px + 0.3, h - 0.35, pz + 0.2, 0.22, 0.4, 0.22, 0xb8742a, 0);
  if (solid) b.solid(x, 2, z, 0.5, 4, 0.5);
}

export function olive(k: Kit, x: number, y: number, z: number, s = 1): void {
  const { b, rng } = k;
  const c = rng.pick([0x6f7f5a, 0x7a8a66, 0x65754f]);
  b.cyl('matte', x, y, z, 0.16 * s, 1.3 * s, 0x5a4a3a, 5, 0.7);
  b.blob('foliage', x, y + 2.1 * s, z, 1.7 * s, 1.2 * s, 1.7 * s, c, 1, rng.range(0, 3));
  b.blob('foliage', x + 0.8 * s, y + 2.5 * s, z + 0.4 * s, 1.0 * s, 0.8 * s, 1.0 * s, shade(c, 1.12), 1, rng.range(0, 3));
}

export function bush(k: Kit, x: number, y: number, z: number, s = 1, color?: number): void {
  const { b, rng } = k;
  const c = color ?? rng.pick(GREENS);
  b.blob('foliage', x, y + 0.4 * s, z, 0.8 * s, 0.55 * s, 0.8 * s, c, 1, rng.range(0, 3));
}

/** Bougainvillea falling over a wall. Local +z is the outside of the wall. */
export function bougainvillea(k: Kit, x: number, y: number, z: number, w: number, h: number): void {
  const { b, rng } = k;
  const cols = [0xc2267a, 0xd13b8f, 0xa81f6a, 0xd94a9a];
  const n = Math.max(4, Math.round(w * h * 1.1));
  for (let i = 0; i < n; i++) {
    const px = x + rng.range(-w / 2, w / 2), t = rng.next();
    const py = y - t * t * h;
    const s = rng.range(0.35, 0.7);
    b.blob('foliage', px, py, z + rng.range(0.05, 0.35), s, s * 0.75, s * 0.6, rng.chance(0.25) ? 0x3f6b2f : rng.pick(cols), 0, rng.range(0, 3));
  }
  b.cyl('matte', x - w / 2, 0, z + 0.1, 0.06, Math.max(0.5, y - h * 0.5), 0x5a4a3a, 5);
}

/** Modern street lamp. The arm points to local +z after yaw. */
export function lamp(k: Kit, x: number, z: number, yaw: number, h = 7): void {
  const { b } = k;
  b.push(x, z, yaw);
  b.cyl('gloss', 0, 0, 0, 0.13, 0.9, 0x3b4a44, 8, 0.7);
  b.cyl('gloss', 0, 0.9, 0, 0.075, h - 0.9, 0x4a5a54, 6, 0.8);
  b.box('gloss', 0, h, 0.75, 0.09, 0.09, 1.6, 0x4a5a54);
  b.box('gloss', 0, h - 0.04, 1.55, 0.32, 0.12, 0.7, 0x55655f);
  b.box('glow', 0, h - 0.11, 1.55, 0.24, 0.03, 0.56, 0xfff2cf);
  b.solid(0, 1.5, 0, 0.3, 3, 0.3);
  b.pop();
}

/** Old style lantern lamp (medina, corniche, promenade). */
export function lantern(k: Kit, x: number, z: number, h = 3.8): void {
  const { b } = k;
  b.cyl('gloss', x, 0, z, 0.14, 0.7, 0x20262a, 8, 0.6);
  b.cyl('gloss', x, 0.7, z, 0.06, h - 0.7, 0x20262a, 6, 0.9);
  b.box('gloss', x, h + 0.02, z, 0.36, 0.05, 0.36, 0x20262a);
  b.box('glow', x, h + 0.27, z, 0.26, 0.44, 0.26, 0xffe9b0);
  b.cone('gloss', x, h + 0.49, z, 0.3, 0.22, 0x20262a, 4, 0, Math.PI / 4);
  b.solid(x, 1.5, z, 0.3, 3, 0.3);
}

/** Wall lantern for medina alleys. Mounted on a wall, pointing local +z. */
export function wallLantern(k: Kit, x: number, y: number, z: number): void {
  const { b } = k;
  b.box('gloss', x, y + 0.3, z + 0.2, 0.04, 0.04, 0.4, 0x20262a);
  b.box('glow', x, y, z + 0.36, 0.2, 0.32, 0.2, 0xffe9b0);
  b.cone('gloss', x, y + 0.16, z + 0.36, 0.2, 0.14, 0x20262a, 4, 0, Math.PI / 4);
}

export function bench(k: Kit, x: number, z: number, yaw: number): void {
  const { b } = k;
  b.push(x, z, yaw);
  const wood = 0x4f7a55;
  b.box('matte', 0, 0.45, 0, 1.7, 0.06, 0.45, wood);
  b.box('matte', 0, 0.8, -0.22, 1.7, 0.36, 0.05, wood);
  for (const sx of [-0.7, 0.7]) {
    b.box('gloss', sx, 0.22, 0, 0.06, 0.45, 0.42, 0x25292c);
    b.box('gloss', sx, 0.7, -0.22, 0.06, 0.55, 0.06, 0x25292c);
  }
  b.solid(0, 0.4, 0, 1.7, 0.8, 0.5);
  b.pop();
}

/** Big green street container. */
export function bin(k: Kit, x: number, z: number, yaw: number): void {
  const { b, rng } = k;
  b.push(x, z, yaw);
  const c = rng.pick([0x2c6b3f, 0x2f7346, 0x3a6a8a]);
  b.box('gloss', 0, 0.62, 0, 1.3, 0.95, 0.85, c);
  b.box('gloss', 0, 1.13, 0.02, 1.36, 0.08, 0.92, shade(c, 0.8));
  for (const sx of [-0.5, 0.5]) for (const sz of [-0.3, 0.3]) b.cyl('matte', sx, 0, sz, 0.07, 0.15, 0x1a1a1a, 6);
  if (rng.chance(0.6)) b.blob('matte', 0.95, 0.25, rng.range(-0.2, 0.2), 0.32, 0.28, 0.3, 0x1c1c20, 0);
  if (rng.chance(0.4)) b.blob('matte', -0.9, 0.2, 0.3, 0.26, 0.22, 0.26, 0x2a3a5a, 0);
  b.solid(0, 0.6, 0, 1.3, 1.2, 0.85);
  b.pop();
}

/** Plastic chair. */
export function chair(k: Kit, x: number, z: number, yaw: number, color: number): void {
  const { b } = k;
  b.push(x, z, yaw);
  b.box('gloss', 0, 0.44, 0, 0.44, 0.04, 0.44, color, 0, 8);
  b.box('gloss', 0, 0.68, -0.2, 0.42, 0.44, 0.04, color, 0, 12);
  for (const sx of [-0.19, 0.19]) for (const sz of [-0.19, 0.19]) b.box('gloss', sx, 0.21, sz, 0.04, 0.42, 0.04, color, 0, 12);
  b.pop();
}

export function table(k: Kit, x: number, z: number, color: number, r = 0.4): void {
  const { b } = k;
  b.cyl('gloss', x, 0.7, z, r, 0.04, color, 10);
  b.cyl('gloss', x, 0, z, 0.04, 0.7, 0x2a2a2a, 5);
  b.cyl('gloss', x, 0, z, 0.22, 0.03, 0x2a2a2a, 8);
}

/** Café table with chairs (the guys who sit there all day come in Level 3). */
export function cafeSet(k: Kit, x: number, z: number, seats: number, chairColor: number): { x: number; z: number; yaw: number }[] {
  const { b, rng } = k;
  const out: { x: number; z: number; yaw: number }[] = [];
  table(k, x, z, rng.pick([0xe8e4da, 0x8a8a8a, 0xb8322a]));
  // small things on the table: tea glass, bottle
  if (rng.chance(0.7)) b.cyl('glass', x + 0.1, 0.74, z - 0.08, 0.03, 0.09, 0xb86a2a, 5);
  if (rng.chance(0.4)) b.cyl('gloss', x - 0.12, 0.74, z + 0.1, 0.035, 0.2, 0x2f8a57, 5);
  const a0 = rng.range(0, Math.PI * 2);
  for (let i = 0; i < seats; i++) {
    const a = a0 + (i / seats) * Math.PI * 2 + rng.range(-0.15, 0.15);
    const cx = x + Math.sin(a) * 0.72, cz = z + Math.cos(a) * 0.72;
    const yaw = a + Math.PI + rng.range(-0.2, 0.2);
    chair(k, cx, cz, yaw, chairColor);
    const [wx, wz] = b.toWorld(cx, cz);
    out.push({ x: wx, z: wz, yaw: b.worldYaw + yaw });
  }
  b.solid(x, 0.4, z, 0.9, 0.8, 0.9);
  return out;
}

export function parasol(k: Kit, x: number, z: number, color: number, r = 1.5): void {
  const { b } = k;
  b.cyl('gloss', x, 0, z, 0.035, 2.35, 0xdedede, 5);
  b.cone('foliage', x, 2.1, z, r, 0.5, color, 8);
  b.cyl('matte', x, 0, z, 0.25, 0.08, 0x8a8a8a, 8);
}

export function bollard(k: Kit, x: number, z: number, color = 0x2a2e30): void {
  const { b } = k;
  b.cyl('gloss', x, 0, z, 0.12, 0.85, color, 7, 0.8);
  b.blob('gloss', x, 0.88, z, 0.12, 0.1, 0.12, color, 0);
  b.solid(x, 0.5, z, 0.3, 1, 0.3);
}

/** Crate with fruit or vegetables, in front of a hanout. */
export function crate(k: Kit, x: number, y: number, z: number, yaw: number): void {
  const { b, rng } = k;
  b.push(x, z, yaw, y);
  const c = rng.pick([0x3a6ab8, 0xb8322a, 0x2f8a57, 0x8a6a3a]);
  b.box('matte', 0, 0.14, 0, 0.6, 0.28, 0.4, c, 0, 4);
  const fruit = rng.pick([0xe8861a, 0xd9261a, 0xe8c81a, 0x6fae2a, 0x7a2a6a, 0xd9a05a]);
  for (let i = 0; i < 2; i++) b.blob('matte', -0.14 + i * 0.28, 0.29, 0, 0.17, 0.09, 0.19, shade(fruit, rng.range(0.85, 1.1)), 0);
  b.pop();
}

/** Blue gas bottle, sold at every hanout. */
export function gasBottle(k: Kit, x: number, z: number): void {
  const { b } = k;
  b.cyl('gloss', x, 0, z, 0.16, 0.5, 0x2a5fae, 8);
  b.blob('gloss', x, 0.5, z, 0.16, 0.1, 0.16, 0x2a5fae, 1);
  b.cyl('gloss', x, 0.58, z, 0.08, 0.1, 0x2a5fae, 6);
}

export function waterTank(k: Kit, x: number, y: number, z: number): void {
  const { b, rng } = k;
  const kind = rng.int(0, 2);
  if (kind === 0) {
    // white vertical tank on legs
    for (const sx of [-0.4, 0.4]) for (const sz of [-0.4, 0.4]) b.box('matte', x + sx, y + 0.3, z + sz, 0.07, 0.6, 0.07, 0x555555, 0, 12);
    b.cyl('gloss', x, y + 0.6, z, 0.62, 1.25, 0xeeeeea, 10);
    b.cone('gloss', x, y + 1.85, z, 0.62, 0.18, 0xe2e2de, 10);
  } else if (kind === 1) {
    b.cyl('matte', x, y, z, 0.6, 1.3, 0x1e1f22, 10);
    b.cyl('matte', x, y + 1.3, z, 0.25, 0.1, 0x1e1f22, 8);
  } else {
    // old grey fiber tank, lying on blocks
    b.box('matte', x, y + 0.15, z, 1.5, 0.3, 0.7, 0x8a8478);
    b.rod('matte', x, y + 0.82, z, 0.55, 1.7, 0xb9b4a8, 0, 0, Math.PI / 2, 9);
  }
}

export function dish(k: Kit, x: number, y: number, z: number, yaw: number): void {
  const { b } = k;
  b.cyl('matte', x, y, z, 0.03, 0.8, 0x777777, 5);
  b.cone('gloss', x, y + 0.85, z, 0.48, 0.14, 0xd8d8d4, 10, -1.0, yaw);
}

/** Laundry line between two points (local). */
export function laundry(k: Kit, x0: number, z0: number, x1: number, z1: number, y: number): void {
  const { b, rng } = k;
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
  const ux = dx / len, uz = dz / len;
  for (const [px, pz] of [[x0, z0], [x1, z1]]) b.box('matte', px, y + 0.85, pz, 0.05, 1.7, 0.05, 0x6a6a6a);
  b.box('matte', (x0 + x1) / 2, y + 1.62, (z0 + z1) / 2, 0.015, 0.015, len, 0xdddddd, Math.atan2(dx, dz));
  let t = 0.3;
  const cols = [0xf2f2f2, 0xd94a4a, 0x4a7ad9, 0xe8c36a, 0xf2f2f2, 0x7ab87a, 0xd98ab0, 0x2a2a3a, 0xe8e0d0];
  while (t < len - 0.6) {
    const w = rng.range(0.35, 0.9), h = rng.range(0.45, 1.0);
    const ax = x0 + ux * t, az = z0 + uz * t, bx = ax + ux * w, bz = az + uz * w;
    b.quad('foliage', [ax, y + 1.6 - h, az], [bx, y + 1.6 - h, bz], [bx, y + 1.6, bz], [ax, y + 1.6, az], rng.pick(cols));
    t += w + rng.range(0.05, 0.3);
  }
}

export function acUnit(k: Kit, x: number, y: number, z: number): void {
  const { b } = k;
  b.box('gloss', x, y, z + 0.16, 0.8, 0.55, 0.3, 0xdcdcd6);
  b.cyl('matte', x - 0.12, y - 0.2, z + 0.31, 0.2, 0.01, 0x555555, 10);
  b.plate('matte', x - 0.12, y, z + 0.315, 0.4, 0.4, 0x4a4f52);
}

/** Striped shop awning. Wall at local z = 0, slopes down toward +z. */
export function awning(k: Kit, x: number, y: number, w: number, depth: number, c1: number, c2: number): void {
  const { b } = k;
  const n = Math.max(2, Math.round(w / 0.45));
  const sw = w / n, drop = depth * 0.42;
  for (let i = 0; i < n; i++) {
    const xa = x - w / 2 + i * sw, xb = xa + sw, col = i % 2 ? c2 : c1;
    b.quad('foliage', [xa, y - drop, depth], [xb, y - drop, depth], [xb, y, 0.02], [xa, y, 0.02], col);
    b.quad('foliage', [xa, y - drop - 0.22, depth], [xb, y - drop - 0.22, depth], [xb, y - drop, depth], [xa, y - drop, depth], col);
  }
  for (const sx of [-w / 2, w / 2]) b.rod('gloss', x + sx, y - drop / 2, depth / 2, 0.015, Math.hypot(depth, drop), 0x444444, Math.atan2(depth, -drop), 0, 0, 4);
}

/** Wooden fishing boat ("flouka") pulled up on the sand. */
export function boat(k: Kit, x: number, y: number, z: number, yaw: number): void {
  const { b, rng } = k;
  b.push(x, z, yaw, y);
  const hull = rng.pick([0x1f6fb5, 0xf2efe6, 0x2f8a57, 0xb8322a, 0x2a9ab0]);
  const top = rng.pick([0xf2efe6, 0xd9261a, 0xe8c81a, 0x1f6fb5]);
  const st = [
    { s: -2.3, hw: 0.62, d: 0.5, r: 0.12 }, { s: -1.3, hw: 0.9, d: 0.62, r: 0 }, { s: 0, hw: 1.0, d: 0.66, r: 0 },
    { s: 1.2, hw: 0.82, d: 0.62, r: 0.06 }, { s: 2.1, hw: 0.4, d: 0.5, r: 0.22 }, { s: 2.6, hw: 0.02, d: 0.2, r: 0.45 },
  ];
  const ring = (q: (typeof st)[number]) => [
    [-q.hw, 0.78 + q.r, q.s], [-q.hw * 0.82, 0.5 + q.r, q.s], [-q.hw * 0.5, 0.8 - q.d + q.r * 0.6, q.s], [0, 0.72 - q.d + q.r * 0.6, q.s],
    [q.hw * 0.5, 0.8 - q.d + q.r * 0.6, q.s], [q.hw * 0.82, 0.5 + q.r, q.s], [q.hw, 0.78 + q.r, q.s],
  ];
  for (let i = 0; i < st.length - 1; i++) {
    const A = ring(st[i]), B = ring(st[i + 1]);
    for (let j = 0; j < 6; j++) b.quad('foliage', A[j], B[j], B[j + 1], A[j + 1], j === 0 || j === 5 ? top : hull);
  }
  const S = ring(st[0]);
  for (let j = 0; j < 6; j++) b.quad('foliage', [0, 0.6, st[0].s], S[j], S[j + 1], S[j + 1], j === 0 || j === 5 ? top : hull);
  // benches and a small mast
  for (const s of [-1.2, 0.3, 1.4]) b.box('matte', 0, 0.62, s, 1.5 - Math.abs(s) * 0.25, 0.05, 0.28, 0xb89a6a);
  b.flat('foliage', 0, 0.3, 0, 1.2, 4.0, 0x8a7458);
  if (rng.chance(0.5)) b.cyl('matte', 0, 0.3, 0.9, 0.04, 2.2, 0xd8d0b8, 5);
  b.solid(0, 0.4, 0, 1.8, 0.9, 4.6);
  b.pop();
}

/** Traffic light pole at a corner. The lamps face local +z. Real lamps are added by the traffic system. */
export function trafficLightPole(k: Kit, x: number, z: number, yaw: number): void {
  const { b } = k;
  b.push(x, z, yaw);
  b.cyl('gloss', 0, 0, 0, 0.09, 3.3, 0x2a2e30, 7);
  b.box('gloss', 0, 3.75, 0, 0.36, 1.0, 0.3, 0x1c1e20);
  b.box('gloss', 0, 4.28, 0.05, 0.44, 0.06, 0.44, 0x1c1e20);
  b.solid(0, 1.5, 0, 0.25, 3, 0.25);
  b.pop();
}

/** Low wall segment with optional paint band. From (x0,z0) to (x1,z1). */
export function lowWall(k: Kit, x0: number, z0: number, x1: number, z1: number, h: number, t: number, color: number, cap?: number): void {
  const { b } = k;
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  b.box('wall', cx, h / 2, cz, t, h, len, color, yaw);
  if (cap !== undefined) b.box('matte', cx, h + 0.04, cz, t + 0.08, 0.08, len, cap, yaw);
  b.solid(cx, h / 2, cz, t, h, len, yaw);
}

/** Scooter parked on its stand. */
export function scooter(k: Kit, x: number, z: number, yaw: number): void {
  const { b, rng } = k;
  b.push(x, z, yaw);
  const c = rng.pick([0xb8322a, 0x2a2a2e, 0x2a5fae, 0xe8e4da, 0xd9a520]);
  for (const s of [-0.62, 0.62]) b.rod('matte', 0, 0.24, s, 0.24, 0.1, 0x151515, 0, 0, Math.PI / 2, 10);
  b.box('gloss', 0, 0.42, -0.1, 0.3, 0.3, 0.9, c);
  b.box('matte', 0, 0.72, -0.25, 0.3, 0.1, 0.7, 0x1c1c1c);
  b.box('gloss', 0, 0.6, 0.5, 0.34, 0.6, 0.12, c, 0.0);
  b.rod('gloss', 0, 1.0, 0.52, 0.02, 0.6, 0x222222, 0, 0, Math.PI / 2, 5);
  b.box('glow', 0, 0.82, 0.58, 0.14, 0.1, 0.04, 0xfff2cf);
  b.solid(0, 0.5, 0, 0.5, 1, 1.7);
  b.pop();
}
