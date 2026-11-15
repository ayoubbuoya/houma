import { PALETTE } from '../../data/config';
import { SKIP, shade } from '../builder';
import { archGeo, door, shopFront, windowUnit } from './buildings';
import { bench, cafeSet, crate, lowWall, palm, parasol, type Kit } from './props';

const WHITE = 0xf7f5f0;
const STONE = 0xe6d6b0;
const GREEN = 0x2f8a57;

export function flagPole(k: Kit, x: number, z: number, h = 9): void {
  const { b, atlas } = k;
  b.cyl('gloss', x, 0, z, 0.07, h, 0xd8d8d8, 6, 0.6);
  b.blob('gloss', x, h + 0.05, z, 0.1, 0.1, 0.1, 0xc9a23a, 0);
  const uv = atlas.uv('flag');
  // a few strips so the flag looks like it moves a little
  const n = 5, w = 2.4, hh = 1.6;
  for (let i = 0; i < n; i++) {
    const xa = x + 0.08 + (w / n) * i, xb = xa + w / n;
    const za = z + Math.sin(i * 1.2) * 0.12, zb = z + Math.sin((i + 1) * 1.2) * 0.12;
    const ua = uv[0] + ((uv[2] - uv[0]) * i) / n, ub = uv[0] + ((uv[2] - uv[0]) * (i + 1)) / n;
    b.quad('atlas', [xa, h - hh - 0.2, za], [xb, h - hh - 0.2, zb], [xb, h - 0.2, zb], [xa, h - 0.2, za], 0xffffff, [ua, uv[1], ub, uv[3]]);
  }
  b.solid(x, 1.5, z, 0.3, 3, 0.3);
}

/** Square minaret, like the ones in Tunisian medinas. */
export function minaret(k: Kit, x: number, z: number, h = 22): void {
  const { b } = k;
  b.push(x, z, 0);
  const s = 3.6;
  b.box('wall', 0, h / 2, 0, s, h, s, STONE, 0, SKIP.NY);
  b.solid(0, h / 2, 0, s, h, s);
  // blind arches and small windows on each face
  for (let f = 0; f < 4; f++) {
    b.push(0, 0, (f * Math.PI) / 2);
    for (const y of [h * 0.35, h * 0.58]) b.plate('matte', 0, y, s / 2 + 0.02, 0.5, 1.5, 0x3a332a);
    b.mesh('wall', archGeo(s - 0.4, 3.6, 1.6, 2.9, 0.16), 0, h - 5.2, s / 2 + 0.06, WHITE);
    b.plate('matte', 0, h - 3.9, s / 2 + 0.03, 1.6, 2.6, 0x5a4a38);
    // green tile band
    b.box('matte', 0, h - 1.2, s / 2 + 0.03, s + 0.06, 0.55, 0.06, GREEN, 0, SKIP.NZ);
    b.box('matte', 0, h - 6.0, s / 2 + 0.03, s + 0.06, 0.3, 0.06, GREEN, 0, SKIP.NZ);
    b.pop();
  }
  // balcony with merlons
  b.box('wall', 0, h + 0.15, 0, s + 0.9, 0.3, s + 0.9, WHITE);
  for (let i = -2; i <= 2; i++) {
    for (const side of [-1, 1]) {
      b.box('wall', i * 1.0, h + 0.65, side * (s / 2 + 0.3), 0.5, 0.7, 0.2, WHITE, 0, SKIP.NY);
      b.box('wall', side * (s / 2 + 0.3), h + 0.65, i * 1.0, 0.2, 0.7, 0.5, WHITE, 0, SKIP.NY);
    }
  }
  // lantern
  const ls = 1.9, lh = 4.2;
  b.box('wall', 0, h + 0.3 + lh / 2, 0, ls, lh, ls, WHITE, 0, SKIP.NY);
  for (let f = 0; f < 4; f++) {
    b.push(0, 0, (f * Math.PI) / 2);
    b.plate('matte', 0, h + 2.2, ls / 2 + 0.02, 0.7, 2.2, 0x3a332a);
    b.box('matte', 0, h + lh - 0.1, ls / 2 + 0.03, ls + 0.06, 0.3, 0.06, GREEN, 0, SKIP.NZ);
    b.pop();
  }
  b.box('wall', 0, h + 0.3 + lh + 0.1, 0, ls + 0.4, 0.2, ls + 0.4, WHITE);
  b.dome('wall', 0, h + lh + 0.5, 0, 0.9, 1.1, WHITE);
  b.cyl('gloss', 0, h + lh + 1.5, 0, 0.035, 1.6, 0xc9a23a, 5);
  for (let i = 0; i < 3; i++) b.blob('gloss', 0, h + lh + 1.9 + i * 0.38, 0, 0.14 - i * 0.03, 0.14 - i * 0.03, 0.14 - i * 0.03, 0xc9a23a, 1);
  b.pop();
}

/** Simple, respectful mosque: courtyard, prayer hall with dome, square minaret. Front is +z. */
export function mosque(k: Kit, w: number, d: number): void {
  const { b } = k;
  const hallD = d * 0.5, hallH = 6.5;
  // prayer hall at the back
  b.box('wall', 0, hallH / 2, -d / 2 + hallD / 2, w, hallH, hallD, WHITE, 0, SKIP.NY);
  b.solid(0, hallH / 2, -d / 2 + hallD / 2, w, hallH, hallD);
  for (let i = -3; i <= 3; i++) b.box('wall', i * (w / 7), hallH + 0.3, -d / 2 + hallD - 0.15, w / 14, 0.6, 0.3, WHITE, 0, SKIP.NY);
  const r = Math.min(w, hallD) * 0.3;
  b.cyl('wall', 0, hallH, -d / 2 + hallD / 2, r * 1.08, 1.6, WHITE, 8);
  b.dome('wall', 0, hallH + 1.6, -d / 2 + hallD / 2, r, r * 0.95, WHITE);
  b.cyl('gloss', 0, hallH + 1.5 + r * 0.9, -d / 2 + hallD / 2, 0.04, 1.3, 0xc9a23a, 5);
  b.blob('gloss', 0, hallH + 2.6 + r * 0.9, -d / 2 + hallD / 2, 0.16, 0.16, 0.16, 0xc9a23a, 1);
  for (const sx of [-1, 1]) b.dome('wall', sx * (w / 2 - 2.4), hallH, -d / 2 + hallD / 2, 1.7, 1.5, WHITE);
  // arcade in front of the hall
  const zf = -d / 2 + hallD;
  const bays = Math.max(3, Math.round(w / 3.4));
  const bw = w / bays;
  for (let i = 0; i < bays; i++) {
    const x = -w / 2 + bw * (i + 0.5);
    b.mesh('wall', archGeo(bw, 4.6, bw - 0.8, 3.9, 0.4), x, 0, zf + 2.4, WHITE);
    b.solid(-w / 2 + bw * i, 2.3, zf + 2.4, 0.7, 4.6, 0.4);
    if (i % 2 === 1) {
      b.push(0, zf, 0);
      windowUnit(k, x, 1.3, 0.9, 1.6, { frame: GREEN, grille: GREEN, arch: true });
      b.pop();
    }
  }
  b.solid(w / 2, 2.3, zf + 2.4, 0.7, 4.6, 0.4);
  b.box('wall', 0, 4.75, zf + 1.3, w, 0.3, 2.6, WHITE);
  b.push(0, zf, 0);
  b.plate('atlas', 0, 1.5, 0.04, 1.7, 3.0, 0xffffff, k.atlas.uv('door9'));
  b.pop();
  // courtyard walls with a gate
  const wh = 3.6;
  lowWall(k, -w / 2, zf, -w / 2, d / 2, wh, 0.4, WHITE);
  lowWall(k, w / 2, zf, w / 2, d / 2, wh, 0.4, WHITE);
  lowWall(k, -w / 2, d / 2, -2.2, d / 2, wh, 0.4, WHITE);
  lowWall(k, 2.2, d / 2, w / 2, d / 2, wh, 0.4, WHITE);
  b.mesh('wall', archGeo(4.4, 5.2, 2.6, 4.0, 0.6), 0, 0, d / 2, STONE);
  b.box('matte', 0, 5.3, d / 2, 4.8, 0.25, 0.8, GREEN);
  b.solid(-1.75, 2.6, d / 2, 0.9, 5.2, 0.6);
  b.solid(1.75, 2.6, d / 2, 0.9, 5.2, 0.6);
  // courtyard floor, fountain, tree
  b.flat('decal', 0, 0.02, (zf + d / 2) / 2 + 1.2, w - 0.6, d / 2 - zf - 2.6, 0xdcd2ba);
  b.cyl('matte', -w * 0.2, 0, d * 0.28, 1.1, 0.5, 0xd8cfb8, 8);
  b.cyl('glass', -w * 0.2, 0.42, d * 0.28, 0.95, 0.1, 0x3a7a8a, 8);
  b.solid(-w * 0.2, 0.3, d * 0.28, 2, 0.6, 2);
  palm(k, w * 0.25, d * 0.3, 6.5);
  minaret(k, w / 2 - 2.2, d / 2 - 2.2, 23);
}

/** Clock tower for the big roundabout (a fictional design). */
export function clockTower(k: Kit, x: number, z: number): void {
  const { b, atlas } = k;
  b.push(x, z, Math.PI / 4);
  b.cyl('matte', 0, 0, 0, 4.2, 0.5, 0xd8cfb8, 8);
  b.cyl('matte', 0, 0.5, 0, 3.2, 0.5, 0xe2d9c2, 8);
  const st = [{ s: 3.0, h: 5.0, c: STONE }, { s: 2.4, h: 5.0, c: 0xf1ece2 }, { s: 2.0, h: 3.6, c: STONE }];
  let y = 1.0;
  for (const q of st) {
    b.box('wall', 0, y + q.h / 2, 0, q.s, q.h, q.s, q.c, 0, SKIP.NY);
    b.box('matte', 0, y + q.h + 0.12, 0, q.s + 0.5, 0.24, q.s + 0.5, WHITE);
    for (let f = 0; f < 4; f++) {
      b.push(0, 0, (f * Math.PI) / 2);
      if (q === st[0]) {
        b.mesh('wall', archGeo(q.s - 0.3, 3.6, 1.3, 3.0, 0.14), 0, y + 0.6, q.s / 2 + 0.05, WHITE);
        b.plate('atlas', 0, y + 2.0, q.s / 2 + 0.03, 1.3, 2.6, 0xffffff, atlas.uv('zellige'));
      } else if (q === st[1]) {
        b.plate('matte', 0, y + 2.4, q.s / 2 + 0.02, 0.5, 2.2, 0x3a332a);
        b.box('matte', 0, y + 0.5, q.s / 2 + 0.03, q.s + 0.06, 0.4, 0.06, PALETTE.blue, 0, SKIP.NZ);
      } else {
        b.plate('atlas', 0, y + q.h / 2, q.s / 2 + 0.03, 1.7, 1.7, 0xffffff, atlas.uv('clock'));
      }
      b.pop();
    }
    y += q.h + 0.24;
  }
  b.cone('matte', 0, y, 0, 1.75, 2.6, PALETTE.blue, 4, 0, Math.PI / 4);
  b.cyl('gloss', 0, y + 2.5, 0, 0.04, 1.4, 0xc9a23a, 5);
  b.blob('gloss', 0, y + 3.9, 0, 0.16, 0.16, 0.16, 0xc9a23a, 1);
  b.solid(0, 8, 0, 3, 16, 3);
  b.solid(0, 0.5, 0, 6, 1, 6);
  b.pop();
}

/** Petrol station (fictional brand colors). Forecourt is at road level. Front (road side) is local -z. */
export function petrolStation(k: Kit, w: number, d: number): void {
  const { b, atlas, rng } = k;
  const G = 0x156a4a, Y = 0xffd94a;
  // canopy
  const cw = Math.min(w * 0.55, 20), cd = 10, cz = -d / 2 + 11, ch = 5.2;
  b.box('gloss', 0, ch + 0.35, cz, cw, 0.7, cd, 0xf2f2ee);
  b.box('gloss', 0, ch + 0.35, cz, cw + 0.1, 0.3, cd + 0.1, G);
  b.box('gloss', 0, ch + 0.1, cz, cw + 0.12, 0.08, cd + 0.12, Y);
  b.box('glow', 0, ch - 0.02, cz, cw - 2, 0.03, cd - 3, 0xfff8e8);
  const uv = atlas.uv('sign33');
  b.plate('atlas', 0, ch + 0.35, cz - cd / 2 - 0.07, 6, 0.6, 0xffffff, uv, Math.PI);
  b.plate('atlas', 0, ch + 0.35, cz + cd / 2 + 0.07, 6, 0.6, 0xffffff, uv);
  for (const sx of [-1, 1]) {
    const px = sx * (cw / 2 - 3.5);
    for (const sz of [-1, 1]) {
      b.box('gloss', px, ch / 2, cz + sz * 2.4, 0.4, ch, 0.4, 0xf2f2ee, 0, SKIP.NY);
      b.box('gloss', px, 0.6, cz + sz * 2.4, 0.46, 1.2, 0.46, G, 0, SKIP.NY);
      b.solid(px, ch / 2, cz + sz * 2.4, 0.46, ch, 0.46);
    }
    // pump island
    b.box('matte', px, 0.1, cz, 1.3, 0.2, 6.2, 0xb8b4aa);
    for (const pz of [-1.2, 1.2]) {
      b.box('gloss', px, 1.05, cz + pz, 0.75, 1.7, 0.5, 0xf2f2ee);
      b.box('gloss', px, 1.75, cz + pz, 0.8, 0.3, 0.55, G);
      for (const s of [-1, 1]) {
        b.plate('glass', px + s * 0.385, 1.35, cz + pz, 0.34, 0.3, 0x1c2630, undefined, s * Math.PI / 2);
        b.box('matte', px + s * 0.42, 0.9, cz + pz + 0.12, 0.06, 0.4, 0.08, 0x15151a);
      }
    }
    b.solid(px, 0.9, cz, 1.3, 1.8, 6.2);
  }
  // shop
  const sw = Math.min(w * 0.5, 14), sd = 6, sz = d / 2 - sd / 2 - 1;
  b.box('wall', 0, 1.9, sz, sw, 3.8, sd, WHITE, 0, SKIP.NY);
  b.box('gloss', 0, 3.6, sz, sw + 0.1, 0.5, sd + 0.1, G);
  b.solid(0, 1.9, sz, sw, 3.8, sd);
  b.push(0, sz - sd / 2, Math.PI);
  shopFront(k, -sw * 0.22, sw * 0.4, 2.7, 'hanout', 2);
  shopFront(k, sw * 0.26, sw * 0.3, 2.7, 'cafe', 2);
  b.pop();
  // price totem near the road
  const tx = -w / 2 + 3;
  b.box('gloss', tx, 3.2, -d / 2 + 2, 1.9, 6.4, 0.4, 0xf2f2ee, 0, SKIP.NY);
  b.box('gloss', tx, 5.9, -d / 2 + 2, 2.0, 1.0, 0.46, G);
  for (let i = 0; i < 3; i++) b.plate('gloss', tx, 4.6 - i * 0.9, -d / 2 + 1.79, 1.5, 0.6, i === 0 ? Y : 0x15151a, undefined, Math.PI);
  b.solid(tx, 3.2, -d / 2 + 2, 1.9, 6.4, 0.4);
  // tyres and oil cans
  for (let i = 0; i < 4; i++) b.rod('matte', w / 2 - 4, 0.12 + i * 0.22, sz - sd / 2 - 0.6, 0.33, 0.2, 0x151515, 0, 0, 0, 10);
  void rng;
}

/** Police station. Colors come from config. No real logos. */
export function policeStation(k: Kit, w: number, d: number): void {
  const { b, atlas } = k;
  const H = 7.4, blue = 0x1f3f8f;
  b.box('wall', 0, H / 2, 0, w, H, d, WHITE, 0, SKIP.NY);
  b.box('wall', 0, 0.6, 0, w + 0.06, 1.2, d + 0.06, blue, 0, SKIP.NY | SKIP.PY);
  b.box('matte', 0, H + 0.4, 0, w + 0.3, 0.8, d + 0.3, WHITE);
  b.solid(0, H / 2, 0, w, H, d);
  b.push(0, d / 2, 0);
  // entrance porch
  b.box('matte', 0, 3.5, 1.3, 6, 0.3, 2.6, WHITE);
  for (const s of [-1, 1]) {
    b.box('matte', s * 2.7, 1.7, 2.3, 0.4, 3.4, 0.4, WHITE, 0, SKIP.NY);
    b.solid(s * 2.7, 1.7, 2.3, 0.4, 3.4, 0.4);
  }
  b.box('matte', 0, 0.1, 1.3, 6, 0.2, 2.6, 0xb8b4aa);
  b.plate('matte', 0, 1.3, 0.03, 2.2, 2.6, 0x1c2630);
  b.box('matte', 0, 4.3, 0.08, 5.2, 1.0, 0.14, blue, 0, SKIP.NZ);
  b.plate('atlas', 0, 4.3, 0.16, 4.6, 0.9, 0xffffff, atlas.uv('sign25'));
  const bays = Math.round(w / 3.4);
  for (let fl = 0; fl < 2; fl++) {
    for (let i = 0; i < bays; i++) {
      const x = -w / 2 + (w / bays) * (i + 0.5);
      if (Math.abs(x) < 3.2) continue;
      windowUnit(k, x, 1.3 + fl * 3.5, 1.2, 1.5, { frame: blue, grille: fl === 0 ? blue : undefined, sill: WHITE });
    }
  }
  b.pop();
  for (const face of [Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const W = face === Math.PI ? w : d;
    b.push(face === Math.PI ? 0 : Math.sin(face) * w / 2, face === Math.PI ? -d / 2 : 0, face);
    const n = Math.round(W / 3.6);
    for (let fl = 0; fl < 2; fl++) for (let i = 0; i < n; i++) windowUnit(k, -W / 2 + (W / n) * (i + 0.5), 1.3 + fl * 3.5, 1.2, 1.5, { frame: blue, grille: fl === 0 ? blue : undefined, sill: WHITE });
    b.pop();
  }
  flagPole(k, -w / 2 + 2, d / 2 + 3.5, 10);
  b.box('matte', w * 0.3, H + 2.6, 0, 0.08, 5, 0.08, 0x888888);
}

/** Louage station: shelter with destination signs, ticket office, sellers. Lot is at road level. Local frame centered. */
export function louageStation(k: Kit, w: number, d: number): { bays: { x: number; z: number; yaw: number }[] } {
  const { b, atlas, rng } = k;
  const bays: { x: number; z: number; yaw: number }[] = [];
  // ticket office on the north side
  const ow = 16, od = 7, oz = -d / 2 + od / 2 + 1.5;
  b.box('wall', 0, 2.1, oz, ow, 4.2, od, WHITE, 0, SKIP.NY);
  b.box('wall', 0, 0.55, oz, ow + 0.06, 1.1, od + 0.06, 0xc8202a, 0, SKIP.NY | SKIP.PY);
  b.box('matte', 0, 4.4, oz, ow + 0.6, 0.4, od + 0.6, WHITE);
  b.solid(0, 2.1, oz, ow, 4.2, od);
  b.push(0, oz + od / 2, 0);
  b.box('matte', 0, 5.3, 0.1, 9, 1.5, 0.2, 0xc8202a);
  b.plate('atlas', 0, 5.3, 0.22, 8.4, 1.3, 0xffffff, atlas.uv('sign26'));
  for (const x of [-5.5, -2.8, 2.8, 5.5]) {
    b.plate('matte', x, 1.9, 0.03, 1.4, 1.2, 0x15120f);
    b.box('matte', x, 1.25, 0.2, 1.6, 0.08, 0.4, 0xd8d0c0, 0, SKIP.NZ);
    b.plate('atlas', x, 2.75, 0.04, 1.5, 0.4, 0xffffff, atlas.sign('dest', rng));
  }
  door(k, 0, 1.4, 2.7);
  b.box('foliage', 0, 3.4, 1.4, ow, 0.08, 2.8, 0xd8d4c8);
  for (const x of [-7.5, -2.5, 2.5, 7.5]) b.box('gloss', x, 1.7, 2.7, 0.1, 3.4, 0.1, 0x4a5a54, 0, SKIP.NY);
  b.pop();
  // two shelters with destination signs; louages park nose-in on both sides
  const dests = ['sign27', 'sign28', 'sign29', 'sign30', 'sign31', 'sign32'];
  let di = 0;
  for (const sx of [-1, 1]) {
    const x = sx * w * 0.22, len = d * 0.52, z0 = oz + od / 2 + 9;
    b.box('gloss', x, 3.5, z0 + len / 2, 3.2, 0.12, len, 0x8f3a34);
    b.box('gloss', x, 3.42, z0 + len / 2, 3.3, 0.05, len + 0.1, 0xd8d4c8);
    const n = Math.round(len / 6);
    for (let i = 0; i <= n; i++) {
      const z = z0 + (len / n) * i;
      b.box('gloss', x, 1.75, z, 0.14, 3.5, 0.14, 0x4a5a54, 0, SKIP.NY);
      b.solid(x, 1.75, z, 0.2, 3.5, 0.2);
      if (i < n) {
        const mz = z + len / n / 2;
        const uv = atlas.uv(dests[di++ % dests.length]);
        b.plate('atlas', x - 1.62, 3.0, mz, 2.6, 0.62, 0xffffff, uv, -Math.PI / 2);
        b.plate('atlas', x + 1.62, 3.0, mz, 2.6, 0.62, 0xffffff, uv, Math.PI / 2);
        if (i % 2 === 0) bench(k, x, mz, Math.PI / 2);
        bays.push({ x: x - 5.2, z: mz, yaw: Math.PI / 2 }, { x: x + 5.2, z: mz, yaw: -Math.PI / 2 });
      }
    }
    b.box('decal', x, 0.02, z0 + len / 2, 3.4, 0.04, len + 1, 0xb8b4aa);
  }
  // sellers: small tables with fruit, water and a parasol
  for (let i = 0; i < 5; i++) {
    const x = rng.range(-w / 2 + 6, w / 2 - 6), z = d / 2 - rng.range(4, 9);
    b.box('matte', x, 0.4, z, 1.6, 0.8, 0.8, 0x8a6a3a);
    for (let j = 0; j < 3; j++) crate(k, x - 0.5 + j * 0.5, 0.8, z, 0);
    parasol(k, x + 1.1, z, rng.pick(PALETTE.awnings), 1.7);
    b.solid(x, 0.5, z, 1.6, 1, 0.8);
  }
  // a small café corner
  for (let i = 0; i < 3; i++) cafeSet(k, -ow / 2 - 3 - i * 2.2, oz + 1, 3, 0xf2f2ee);
  flagPole(k, ow / 2 + 2.5, oz + od / 2 + 1, 9);
  return { bays };
}

/** Green kiosk on the promenade. */
export function kiosk(k: Kit, x: number, z: number): void {
  const { b, rng } = k;
  const c = 0x2f5a44;
  b.cyl('gloss', x, 0, z, 1.5, 2.6, c, 8);
  b.cone('gloss', x, 2.6, z, 2.1, 0.9, shade(c, 0.8), 8);
  b.cyl('gloss', x, 3.45, z, 0.08, 0.5, 0xc9a23a, 5);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    b.plate('matte', x + Math.sin(a) * 1.4, 1.5, z + Math.cos(a) * 1.4, 0.85, 1.0, i % 3 === 0 ? 0x15120f : rng.pick([0xe8e0d0, 0xd9261a, 0x2a6ab8, 0xe8c81a]), undefined, a);
  }
  b.solid(x, 1.3, z, 2.6, 2.6, 2.6);
}
