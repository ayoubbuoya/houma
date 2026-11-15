import * as THREE from 'three';
import { PALETTE } from '../../data/config';
import { SKIP, mixHex, shade } from '../builder';
import { acUnit, awning, bougainvillea, cafeSet, crate, dish, gasBottle, laundry, parasol, waterTank, type Kit } from './props';

const GLASS = [0x26323e, 0x1c2630, 0x2f3d48, 0x222c36, 0x3a4650];
const TRIM = 0xf6f3ea;

const archCache = new Map<string, THREE.BufferGeometry>();
/** Wall panel with an arched opening, centered on x, base at y = 0, centered on z. */
export function archGeo(w: number, h: number, ow: number, oh: number, t: number): THREE.BufferGeometry {
  const key = [w, h, ow, oh, t].map((v) => v.toFixed(2)).join('_');
  let g = archCache.get(key);
  if (!g) {
    const r = ow / 2, spring = Math.max(0.1, oh - r);
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(-r, 0);
    s.lineTo(-r, spring);
    s.absarc(0, spring, r, Math.PI, 0, true);
    s.lineTo(r, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, h);
    s.lineTo(-w / 2, h);
    s.closePath();
    g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 10 });
    g.translate(0, 0, -t / 2);
    archCache.set(key, g);
  }
  return g;
}

const halfDiscCache = new Map<number, THREE.BufferGeometry>();
function halfDisc(): THREE.BufferGeometry {
  let g = halfDiscCache.get(0);
  if (!g) {
    g = new THREE.CircleGeometry(1, 10, 0, Math.PI);
    halfDiscCache.set(0, g);
  }
  return g;
}

interface WinOpts {
  frame: number;
  shutter?: number;
  /** 0 = closed, 1 = open, 0.5 = one side open */
  open?: number;
  grille?: number;
  sill?: number;
  arch?: boolean;
}

/** Window on a facade (wall plane at local z = 0, outside is +z). y = bottom of the window. */
export function windowUnit(k: Kit, x: number, y: number, w: number, h: number, o: WinOpts): void {
  const { b, rng } = k;
  const glass = rng.pick(GLASS);
  // flat plates instead of boxes: windows are the most repeated piece in the city
  b.plate('matte', x, y + h / 2, 0.035, w + 0.16, h + 0.16, o.frame);
  const closed = o.shutter !== undefined && (o.open ?? 1) === 0;
  if (!closed) {
    b.plate('glass', x, y + h / 2, 0.05, w, h, glass);
    b.plate('matte', x, y + h / 2, 0.06, 0.05, h, o.frame);
    if (h > 1.5) b.plate('matte', x, y + h * 0.66, 0.06, w, 0.045, o.frame);
  }
  if (o.arch) {
    b.mesh('matte', halfDisc(), x, y + h + 0.06, 0.04, o.frame, 0, w / 2 + 0.08, w / 2 + 0.08, 1);
    b.mesh('glass', halfDisc(), x, y + h + 0.06, 0.05, glass, 0, w / 2 - 0.04, w / 2 - 0.04, 1);
  }
  if (o.shutter !== undefined) {
    const sw = w / 2, open = o.open ?? 1;
    const leaf = (side: number, isOpen: boolean) => {
      if (isOpen) b.plate('matte', x + side * (w / 2 + sw / 2 + 0.03), y + h / 2, 0.07, sw, h, o.shutter!);
      else b.plate('matte', x + side * (sw / 2 + 0.01), y + h / 2, 0.09, sw - 0.02, h, shade(o.shutter!, 0.95));
    };
    leaf(-1, open >= 0.5);
    leaf(1, open === 1);
  }
  if (o.sill !== undefined) b.box('matte', x, y - 0.06, 0.1, w + 0.34, 0.09, 0.2, o.sill, 0, SKIP.NZ | SKIP.NY);
  if (o.grille !== undefined) b.plate('atlas', x, y + h / 2, 0.2, w + 0.12, h + 0.12, o.grille, k.atlas.uv('grille'));
}

/** Studded door from the atlas, with a step. */
export function door(k: Kit, x: number, w = 1.35, h = 2.6, y = 0): void {
  const { b, atlas, rng } = k;
  b.plate('atlas', x, y + h / 2, 0.04, w, h, 0xffffff, atlas.door(rng));
  b.box('matte', x, y + 0.06, 0.2, w + 0.2, 0.12, 0.4, 0xb9b2a2, 0, SKIP.NZ | SKIP.NY);
}

/** Balcony slab with an iron railing. */
export function balcony(k: Kit, x: number, y: number, w: number, depth: number, slabColor: number, railColor = 0x26282c): void {
  const { b, atlas } = k;
  b.box('matte', x, y - 0.08, depth / 2, w, 0.16, depth, slabColor, 0, SKIP.NZ);
  const uv = atlas.uv('railing');
  const rh = 0.95;
  const n = Math.max(1, Math.round(w / 1.1));
  const seg = w / n;
  for (let i = 0; i < n; i++) b.plate('atlas', x - w / 2 + seg * (i + 0.5), y + rh / 2, depth - 0.03, seg, rh, railColor, uv);
  for (const s of [-1, 1]) b.plate('atlas', x + s * (w / 2 - 0.03), y + rh / 2, depth / 2, depth, rh, railColor, uv, Math.PI / 2);
  // brackets
  for (const s of [-1, 1]) b.box('matte', x + s * (w / 2 - 0.25), y - 0.28, depth * 0.3, 0.14, 0.24, depth * 0.6, slabColor, 0, SKIP.NZ);
}

export type ShopKind = 'cafe' | 'hanout' | 'bakery' | 'barber' | 'pharmacy' | 'shop' | 'food' | 'fish' | 'garage' | 'closed';

/** Shop front on the ground floor. Returns nothing; draws opening, sign, awning and goods on the sidewalk. */
export function shopFront(k: Kit, x: number, w: number, h: number, kind: ShopKind, terrace: number): void {
  const { b, atlas, rng } = k;
  const signKind = kind === 'closed' ? 'shop' : kind;
  const frame = rng.pick([0x2a2a2e, 0x5a3a22, 0x1f4f8f, 0xdedad0, 0x2f5a44]);
  // sign board
  const sh = Math.min(0.72, w * 0.25);
  b.box('matte', x, h + sh / 2 + 0.08, 0.06, w + 0.1, sh + 0.1, 0.12, shade(frame, 0.8), 0, SKIP.NZ);
  b.plate('atlas', x, h + sh / 2 + 0.08, 0.125, w, sh, 0xffffff, atlas.sign(signKind, rng));
  if (kind === 'closed' || (kind !== 'cafe' && rng.chance(0.16))) {
    b.plate('atlas', x, h / 2, 0.05, w, h, rng.pick([0xffffff, 0xc8d4dc, 0xd8cfb8, 0x9ab0c8]), atlas.uv('rollshutter'));
    return;
  }
  // dark interior
  b.plate('matte', x, h / 2, 0.02, w, h, 0x15120f);
  b.box('matte', x, h + 0.02, 0.05, w + 0.1, 0.08, 0.1, frame, 0, SKIP.NZ);
  for (const s of [-1, 1]) b.box('matte', x + s * (w / 2 + 0.03), h / 2, 0.05, 0.08, h, 0.1, frame, 0, SKIP.NZ);
  if (kind === 'cafe') {
    // counter and a warm back wall
    b.plate('matte', x, h * 0.55, 0.03, w * 0.9, h * 0.55, 0x4a3324);
    b.box('matte', x - w * 0.2, 0.55, 0.12, w * 0.45, 1.1, 0.2, 0x6a4a30, 0, SKIP.NZ);
    b.box('gloss', x - w * 0.2, 1.12, 0.14, w * 0.47, 0.05, 0.26, 0xd8d0c0, 0, SKIP.NZ);
  } else if (kind === 'garage') {
    b.plate('matte', x, h * 0.3, 0.03, w * 0.8, h * 0.5, 0x2a2622);
  } else {
    // glass door on one side, display window with shelves on the other
    const dw = Math.min(1.0, w * 0.35), side = rng.chance(0.5) ? 1 : -1;
    const gx = x - side * (dw / 2 + 0.05), gw = w - dw - 0.2;
    b.box('matte', gx, 0.3, 0.06, gw, 0.6, 0.1, shade(frame, 1.1), 0, SKIP.NZ);
    const cols = kind === 'pharmacy' ? [0xffffff, 0x8fd0a0, 0xd0e8f0] : kind === 'bakery' ? [0xd9a05a, 0xe8c88a, 0xb87a3a] : [0xd9261a, 0xe8c81a, 0x2a6ab8, 0xf2f2f2, 0x2f8a57, 0xe8861a];
    for (let r = 0; r < 3; r++) {
      b.box('matte', gx, 0.85 + r * 0.55, 0.05, gw - 0.1, 0.04, 0.08, 0xd8d0c0, 0, SKIP.NZ);
      const n = Math.min(6, Math.max(2, Math.floor(gw / 0.28)));
      for (let i = 0; i < n; i++) {
        if (rng.chance(0.2)) continue;
        b.plate('matte', gx - gw / 2 + 0.2 + (i * (gw - 0.4)) / Math.max(1, n - 1), 1.02 + r * 0.55, 0.07, (gw - 0.4) / n * 0.8, rng.range(0.2, 0.34), rng.pick(cols));
      }
    }
    b.plate('glass', gx, 0.6 + (h - 0.6) / 2, 0.11, gw, h - 0.6, 0x3a4a55);
    b.plate('glass', x + side * (w / 2 - dw / 2), h / 2, 0.08, dw - 0.1, h - 0.1, 0x2a3640);
  }
  const hasAwning = kind !== 'garage' && rng.chance(kind === 'cafe' ? 0.75 : 0.45);
  if (hasAwning) awning(k, x, h + 0.05, w + 0.3, Math.min(1.5, Math.max(0.8, terrace * 0.5)), rng.pick(PALETTE.awnings), rng.pick([0xf2ede0, 0xf2ede0, 0xe8e2d0]));
  if (terrace < 1.2) return;
  // things on the sidewalk
  if (kind === 'hanout') {
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const cx = x - w / 2 + 0.4 + i * 0.68;
      crate(k, cx, 0.3, 0.5, rng.range(-0.1, 0.1));
      b.box('matte', cx, 0.15, 0.5, 0.62, 0.3, 0.42, 0x8a7a5a);
    }
    if (rng.chance(0.7)) for (let i = 0; i < rng.int(2, 4); i++) gasBottle(k, x + w / 2 + 0.3 + i * 0.36, 0.35);
    b.solid(x, 0.4, 0.5, w, 0.8, 0.5);
  } else if (kind === 'cafe' || kind === 'food' || kind === 'fish') {
    const chairColor = rng.pick([0xf2f2ee, 0xb8322a, 0x2a5fae, 0xf2f2ee, 0x2f8a57]);
    const rows = terrace > 3.2 ? 2 : 1;
    const per = Math.max(1, Math.floor((w + 1.5) / 2.1));
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < per; i++) {
        if (rng.chance(0.15)) continue;
        const tx = x - ((per - 1) * 2.1) / 2 + i * 2.1 + rng.range(-0.15, 0.15);
        const tz = 1.25 + r * 1.9;
        const seats = cafeSet(k, tx, tz, rng.int(2, 4), chairColor);
        SEATS.push(...seats);
      }
    }
    if (kind !== 'cafe' && rng.chance(0.6)) parasol(k, x, 1.3, rng.pick(PALETTE.awnings));
  } else if (kind === 'garage') {
    for (let i = 0; i < 3; i++) b.rod('matte', x - w / 2 - 0.3, 0.3 + i * 0.22, 0.45, 0.3, 0.2, 0x151515, 0, 0, 0, 10);
  } else if (rng.chance(0.3)) {
    b.box('gloss', x + w / 2 + 0.5, 0.5, 0.35, 0.7, 1.0, 0.55, 0xe8e8e8); // freezer
    b.box('gloss', x + w / 2 + 0.5, 1.02, 0.35, 0.72, 0.05, 0.57, 0x2a6ab8);
    b.solid(x + w / 2 + 0.5, 0.5, 0.35, 0.7, 1, 0.55);
  }
}

/** Seats at café tables (world space). Level 3 puts sitting people here. */
export const SEATS: { x: number; z: number; yaw: number }[] = [];

export interface Faces {
  f: boolean; b: boolean; l: boolean; r: boolean;
}

export interface HouseOpts {
  floors: number;
  open: Faces;
  style: 'houma' | 'corniche' | 'medina';
  shop?: ShopKind | null;
  unfinished?: boolean;
  terrace?: number;
  color?: number;
  noRoofProps?: boolean;
}

/** Runs fn in the frame of one face: x along the wall, +z pointing out, wall plane at z = 0. */
function onFace(k: Kit, face: 'f' | 'b' | 'l' | 'r', w: number, d: number, fn: (W: number) => void): void {
  const { b } = k;
  if (face === 'f') b.push(0, d / 2, 0);
  else if (face === 'b') b.push(0, -d / 2, Math.PI);
  else if (face === 'r') b.push(w / 2, 0, Math.PI / 2);
  else b.push(-w / 2, 0, -Math.PI / 2);
  fn(face === 'f' || face === 'b' ? w : d);
  b.pop();
}

/** Flat roof details: water tanks, satellite dishes, laundry, stair hut. */
export function roofProps(k: Kit, w: number, d: number, y: number, rich = 1): void {
  const { b, rng } = k;
  const rx = () => rng.range(-w / 2 + 1, w / 2 - 1), rz = () => rng.range(-d / 2 + 1, d / 2 - 1);
  if (rng.chance(0.75 * rich)) waterTank(k, rx(), y, rz());
  if (rng.chance(0.3 * rich)) waterTank(k, rx(), y, rz());
  const nd = rng.int(0, 2);
  for (let i = 0; i < nd; i++) dish(k, rx(), y, rz(), rng.range(1.8, 2.6));
  if (w > 5 && d > 5 && rng.chance(0.45 * rich)) {
    const hx = rng.range(-w / 2 + 1.6, w / 2 - 1.6), hz = rng.range(-d / 2 + 1.6, d / 2 - 1.6);
    b.box('wall', hx, y + 1.15, hz, 2.2, 2.3, 2.4, 0xf1ece2, 0, SKIP.NY);
    b.plate('matte', hx, y + 1.0, hz + 1.21, 0.8, 1.9, rng.pick(PALETTE.doors));
  }
  if (w > 5 && rng.chance(0.4 * rich)) {
    const z = rz();
    laundry(k, -w / 2 + 0.8, z, w / 2 - 0.8, z + rng.range(-1, 1), y);
  }
  if (rng.chance(0.3)) b.box('matte', rx(), y + 1.3, rz(), 0.03, 2.6, 0.03, 0x666666);
}

/** A Tunisian house: white cube, blue shutters, flat roof with a water tank. Origin = center of footprint. */
export function house(k: Kit, w: number, d: number, o: HouseOpts): number {
  const { b, rng } = k;
  const corniche = o.style === 'corniche', medina = o.style === 'medina';
  const g0 = 3.2, fh = 3.0;
  const H = g0 + (o.floors - 1) * fh;
  const color = o.color ?? rng.pick(corniche || medina ? PALETTE.wallsWhite : PALETTE.walls);
  const shutter = corniche || medina ? rng.pick([0x1f6fb5, 0x2a7fc4, 0x1f6fb5]) : rng.pick(PALETTE.shutters);
  const frame = corniche ? shutter : rng.chance(0.5) ? TRIM : shutter;
  b.box('wall', 0, H / 2, 0, w, H, d, color, 0, SKIP.NY);
  b.solid(0, H / 2, 0, w, H, d);
  if (!corniche && !medina && rng.chance(0.35)) {
    // painted base band
    const band = rng.pick([0x8f9aa0, 0xb8a07a, 0x5f86a8, 0x9a958c]);
    b.box('wall', 0, 0.5, 0, w + 0.05, 1.0, d + 0.05, band, 0, SKIP.NY | SKIP.PY);
  }
  for (const face of ['f', 'b', 'l', 'r'] as const) {
    if (!o.open[face]) continue;
    onFace(k, face, w, d, (W) => {
      const bays = Math.max(1, Math.round(W / 3.3));
      const bw = W / bays;
      const doorBay = face === 'f' ? rng.int(0, bays - 1) : -1;
      const shopBays = new Set<number>();
      if (face === 'f' && o.shop && bays >= 2) {
        const s = doorBay === 0 ? 1 : doorBay - 1;
        shopBays.add(s);
      }
      for (let fl = 0; fl < o.floors; fl++) {
        const y0 = fl === 0 ? 0 : g0 + (fl - 1) * fh;
        if (fl > 0 && rng.chance(0.3)) b.box('matte', 0, y0, 0.04, W + 0.1, 0.12, 0.1, TRIM, 0, SKIP.NZ);
        for (let i = 0; i < bays; i++) {
          const x = -W / 2 + bw * (i + 0.5);
          if (fl === 0 && i === doorBay) {
            door(k, x);
            if (rng.chance(0.25)) b.plate('atlas', x, 3.0, 0.03, 1.4, 0.5, 0xffffff, [k.atlas.uv('zellige')[0], k.atlas.uv('zellige')[1], k.atlas.uv('zellige')[2], (k.atlas.uv('zellige')[1] + k.atlas.uv('zellige')[3]) / 2]);
            continue;
          }
          if (fl === 0 && shopBays.has(i)) {
            shopFront(k, x, Math.min(bw - 0.5, 3.2), 2.5, o.shop!, o.terrace ?? 0);
            continue;
          }
          if (rng.chance(face === 'f' ? 0.1 : 0.4)) continue;
          if (fl > 0 && face === 'f' && !medina && rng.chance(0.35) && bw > 2.4) {
            // balcony with a door-window
            windowUnit(k, x, y0 + 0.1, 1.1, 2.2, { frame, shutter, open: rng.pick([0, 0.5, 1, 1]) });
            if (corniche) {
              b.box('matte', x, y0 - 0.02, 0.45, 2.2, 0.12, 0.9, color, 0, SKIP.NZ);
              for (const s of [-1, 0, 1]) b.plate('atlas', x + s * 0.72, y0 + 0.52, 0.88, 0.72, 0.95, shutter, k.atlas.uv('grille'));
              for (const s of [-1, 1]) b.plate('atlas', x + s * 1.08, y0 + 0.52, 0.45, 0.88, 0.95, shutter, k.atlas.uv('grille'), Math.PI / 2);
            } else balcony(k, x, y0 + 0.08, 2.2, 0.9, color);
            continue;
          }
          if (corniche && fl > 0 && rng.chance(0.25)) {
            // blue mashrabiya box
            const lat = k.atlas.uv('lattice');
            b.box('matte', x, y0 + 1.75, 0.3, 1.5, 1.6, 0.6, shutter, 0, SKIP.NZ);
            b.plate('atlas', x, y0 + 1.75, 0.61, 1.3, 1.4, shutter, lat);
            for (const s of [-1, 1]) b.plate('atlas', x + s * 0.76, y0 + 1.75, 0.3, 0.5, 1.4, shutter, lat, s * Math.PI / 2);
            b.box('matte', x, y0 + 2.62, 0.34, 1.7, 0.1, 0.72, shade(shutter, 0.8), 0, SKIP.NZ);
            b.box('matte', x, y0 + 0.86, 0.26, 1.3, 0.18, 0.5, shade(shutter, 0.8), 0, SKIP.NZ);
            continue;
          }
          const small = medina || (fl === 0 && rng.chance(0.4));
          const ww = small ? 0.8 : rng.pick([1.0, 1.1, 1.2]);
          const wh = small ? 0.9 : 1.35;
          const wy = y0 + (small ? 1.5 : 1.05);
          const grille = fl === 0 || medina ? (rng.chance(0.75) ? (rng.chance(0.7) ? shutter : 0x26282c) : undefined) : undefined;
          windowUnit(k, x, wy, ww, wh, {
            frame, shutter: small ? undefined : shutter, open: rng.pick([0, 0, 0.5, 1, 1, 1]), grille, sill: TRIM, arch: corniche && rng.chance(0.4),
          });
          if (fl > 0 && !medina && rng.chance(0.1)) acUnit(k, x + bw * 0.32, y0 + 2.5, 0);
        }
      }
      if (face === 'f' && !medina && rng.chance(0.16)) bougainvillea(k, rng.range(-W / 2 + 1, W / 2 - 1), H * rng.range(0.55, 0.9), 0, rng.range(2, 4), rng.range(1.5, 3));
    });
  }
  // roof
  const t = 0.18;
  if (o.unfinished) {
    // half-built next floor: concrete columns with rebar and some red brick walls
    const cols: [number, number][] = [];
    const nx = Math.max(2, Math.round(w / 3.6) + 1), nz = Math.max(2, Math.round(d / 3.6) + 1);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) if (i === 0 || j === 0 || i === nx - 1 || j === nz - 1) cols.push([-w / 2 + 0.15 + (i * (w - 0.3)) / (nx - 1), -d / 2 + 0.15 + (j * (d - 0.3)) / (nz - 1)]);
    const ch = rng.range(1.2, 2.9);
    for (const [cx, cz] of cols) {
      b.box('matte', cx, H + ch / 2, cz, 0.28, ch, 0.28, PALETTE.concrete, 0, SKIP.NY);
      for (const [ox, oz] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]]) b.box('matte', cx + ox, H + ch + 0.35, cz + oz, 0.018, 0.7 + rng.range(-0.2, 0.25), 0.018, 0x5a3a2a, 0, SKIP.NY | SKIP.PY);
    }
    const brick = PALETTE.brick;
    if (rng.chance(0.8)) b.box('matte', 0, H + 0.55, -d / 2 + 0.1, w - 0.4, 1.1, 0.16, brick);
    if (rng.chance(0.6)) b.box('matte', -w / 2 + 0.1, H + 0.4, 0, 0.16, 0.8, d - 0.4, shade(brick, 0.92));
    if (rng.chance(0.4)) b.box('matte', w / 2 - 0.1, H + 0.75, d * 0.15, 0.16, 1.5, d * 0.5, shade(brick, 1.05));
    if (rng.chance(0.5)) b.box('matte', rng.range(-1, 1), H + 0.2, rng.range(-1, 1), 0.9, 0.4, 0.6, shade(brick, 0.9)); // brick pile
    b.flat('decal', 0, H + 0.02, 0, w - 0.1, d - 0.1, 0x9a958c);
  } else {
    const ph = corniche ? 0.9 : rng.range(0.6, 1.0);
    b.box('wall', 0, H + ph / 2, d / 2 - t / 2, w, ph, t, color, 0, SKIP.NY);
    b.box('wall', 0, H + ph / 2, -d / 2 + t / 2, w, ph, t, color, 0, SKIP.NY);
    b.box('wall', w / 2 - t / 2, H + ph / 2, 0, t, ph, d - 2 * t, color, 0, SKIP.NY);
    b.box('wall', -w / 2 + t / 2, H + ph / 2, 0, t, ph, d - 2 * t, color, 0, SKIP.NY);
    b.flat('decal', 0, H + 0.02, 0, w - 2 * t, d - 2 * t, rng.pick([0xbcb6aa, 0xc9c2b4, 0xa9a49a]));
    if (corniche && rng.chance(0.4)) {
      // small merlons on the corners
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('wall', sx * (w / 2 - 0.2), H + ph + 0.2, sz * (d / 2 - 0.2), 0.4, 0.4, 0.4, color, 0, SKIP.NY);
    }
    if ((corniche || medina) && w > 6 && d > 6 && rng.chance(corniche ? 0.3 : 0.12)) {
      const r = Math.min(w, d) * 0.28;
      b.box('wall', 0, H + 0.5, 0, r * 2.1, 1.0, r * 2.1, color, 0, SKIP.NY);
      b.dome('wall', 0, H + 1.0, 0, r, r * 0.95, 0xf7f5f0);
      b.cyl('gloss', 0, H + 1.0 + r * 0.9, 0, 0.04, 0.7, 0xc9a23a, 5);
    } else if (!o.noRoofProps) roofProps(k, w - 0.6, d - 0.6, H + 0.02);
  }
  return H;
}

export interface ColonialOpts {
  floors: number; // upper floors
  open: Faces;
  arcade: boolean;
  shops: ShopKind[];
  terrace?: number;
}

/** French-era downtown building: arcade or shops on the ground floor, tall shuttered windows, balconies, cornices. */
export function colonial(k: Kit, w: number, d: number, o: ColonialOpts): number {
  const { b, rng } = k;
  const g0 = 4.6, fh = 3.5;
  const H = g0 + o.floors * fh;
  const color = rng.pick(PALETTE.colonial);
  const shutter = rng.pick(PALETTE.shuttersColonial);
  const trim = mixHex(color, 0xffffff, 0.6);
  const ad = o.arcade ? 3.0 : 0; // arcade depth
  // upper body
  b.box('wall', 0, g0 + (H - g0) / 2, 0, w, H - g0, d, color, 0, o.arcade ? 0 : SKIP.NY);
  // ground floor body (recessed behind the arcade)
  b.box('wall', 0, g0 / 2, -ad / 2, w, g0, d - ad, shade(color, 0.97), 0, SKIP.NY | SKIP.PY);
  b.solid(0, H / 2, -ad / 2, w, H, d - ad);
  if (o.arcade) b.solid(0, g0 + (H - g0) / 2, d / 2 - ad / 2, w, H - g0, ad);

  // ---- front ground floor
  onFace(k, 'f', w, d, (W) => {
    const bays = Math.max(1, Math.round(W / 4.2));
    const bw = W / bays;
    if (o.arcade) {
      const g = archGeo(bw, g0, bw - 1.0, g0 - 0.7, 0.55);
      for (let i = 0; i < bays; i++) {
        const x = -W / 2 + bw * (i + 0.5);
        b.mesh('wall', g, x, 0, -0.28, color);
        // pillar base and capital
        b.box('matte', x - bw / 2, 0.25, -0.28, 1.06, 0.5, 0.62, shade(trim, 0.9), 0, SKIP.NY);
        b.box('matte', x - bw / 2, g0 - 0.7 - (bw - 1.0) / 2 + 0.05, -0.28, 1.06, 0.14, 0.62, trim);
      }
      b.box('matte', W / 2, 0.25, -0.28, 1.06, 0.5, 0.62, shade(trim, 0.9), 0, SKIP.NY);
      for (let i = 0; i <= bays; i++) b.solid(-W / 2 + bw * i, g0 / 2, -0.28, 1.0, g0, 0.56);
      // arcade floor tiles and ceiling
      b.flat('decal', 0, 0.02, -ad / 2, W, ad - 0.1, 0xb8a888);
    }
    // shops on the inner wall
    b.push(0, -ad, 0);
    for (let i = 0; i < bays; i++) {
      const x = -W / 2 + bw * (i + 0.5);
      const kind = o.shops[i % o.shops.length];
      shopFront(k, x, bw - 1.1, 2.9, kind, o.arcade ? 0.8 : o.terrace ?? 0);
    }
    b.pop();
    if (o.arcade && (o.terrace ?? 0) > 3) {
      // café terrace outside the arcade
      for (let i = 0; i < bays; i++) {
        if (o.shops[i % o.shops.length] !== 'cafe') continue;
        const x = -W / 2 + bw * (i + 0.5);
        const cc = rng.pick([0xf2f2ee, 0xb8322a, 0x2a5fae]);
        for (const dx of [-1.0, 1.0]) SEATS.push(...cafeSet(k, x + dx, 1.3, rng.int(2, 4), cc));
      }
    }
  });

  // ---- upper facades
  for (const face of ['f', 'b', 'l', 'r'] as const) {
    if (!o.open[face]) continue;
    onFace(k, face, w, d, (W) => {
      const bays = Math.max(1, Math.round(W / 2.9));
      const bw = W / bays;
      const rich = face !== 'b';
      // ground floor of side and back faces: simple doors and windows
      if (face !== 'f') {
        for (let i = 0; i < bays; i++) {
          const x = -W / 2 + bw * (i + 0.5);
          if (face !== 'b' && i === Math.floor(bays / 2)) door(k, x, 1.5, 2.9);
          else if (rng.chance(0.6)) windowUnit(k, x, 1.4, 1.1, 1.8, { frame: trim, grille: 0x26282c, sill: trim });
        }
      }
      b.box('matte', 0, g0 + 0.02, 0.14, W + 0.3, 0.3, 0.3, trim, 0, SKIP.NZ);
      const longBalcony = rich && rng.chance(0.6);
      for (let fl = 0; fl < o.floors; fl++) {
        const y0 = g0 + fl * fh;
        if (fl > 0) b.box('matte', 0, y0, 0.08, W + 0.16, 0.16, 0.16, trim, 0, SKIP.NZ);
        if (fl === 0 && longBalcony) balcony(k, 0, y0 + 0.2, W - 0.6, 1.0, trim);
        for (let i = 0; i < bays; i++) {
          const x = -W / 2 + bw * (i + 0.5);
          if (!rich && rng.chance(0.25)) continue;
          const tall = rich;
          windowUnit(k, x, y0 + (tall ? 0.35 : 1.0), 1.15, tall ? 2.35 : 1.6, {
            frame: trim, shutter, open: rng.pick([0, 0, 0.5, 1, 1]), sill: tall ? undefined : trim, arch: rich && fl === o.floors - 1 && bays % 2 === 1 && i === (bays - 1) / 2,
          });
          // little pediment above the window
          if (rich) b.box('matte', x, y0 + 2.95, 0.1, 1.6, 0.12, 0.2, trim, 0, SKIP.NZ);
          if (rich && !(fl === 0 && longBalcony) && rng.chance(fl === 0 ? 0.7 : 0.35)) balcony(k, x, y0 + 0.2, 1.9, 0.75, trim);
          if (rng.chance(0.07)) acUnit(k, x + bw * 0.36, y0 + 2.6, 0);
        }
      }
      // corner pilasters
      for (const s of [-1, 1]) b.box('matte', s * (W / 2 - 0.3), g0 + (H - g0) / 2, 0.06, 0.6, H - g0, 0.12, trim, 0, SKIP.NZ);
      // top cornice
      b.box('matte', 0, H - 0.2, 0.22, W + 0.5, 0.4, 0.46, trim, 0, SKIP.NZ);
      b.box('matte', 0, H - 0.55, 0.12, W + 0.3, 0.2, 0.24, trim, 0, SKIP.NZ);
    });
  }
  // parapet + roof
  const ph = 1.0, t = 0.25;
  b.box('wall', 0, H + ph / 2, d / 2 - t / 2, w, ph, t, color, 0, SKIP.NY);
  b.box('wall', 0, H + ph / 2, -d / 2 + t / 2, w, ph, t, color, 0, SKIP.NY);
  b.box('wall', w / 2 - t / 2, H + ph / 2, 0, t, ph, d - 2 * t, color, 0, SKIP.NY);
  b.box('wall', -w / 2 + t / 2, H + ph / 2, 0, t, ph, d - 2 * t, color, 0, SKIP.NY);
  if (rng.chance(0.4)) b.box('wall', 0, H + ph + 0.5, d / 2 - t / 2, Math.min(w * 0.4, 5), 1.0, t, color, 0, SKIP.NY);
  b.flat('decal', 0, H + 0.02, 0, w - 2 * t, d - 2 * t, 0xa9a49a);
  roofProps(k, w - 1, d - 1, H + 0.02, 0.9);
  return H;
}
