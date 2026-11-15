import { RNG } from '../core/rng';
import { PALETTE } from '../data/config';
import { SKIP } from './builder';
import { archGeo, house, shopFront, type ShopKind } from './kit/buildings';
import { mosque } from './kit/landmarks';
import { awning, bollard, cafeSet, orangeTree, palm, wallLantern, type Kit } from './kit/props';

export interface MedinaData {
  /** alley junctions (world space) */
  cells: { x: number; z: number; i: number; j: number }[];
  /** walkable links between junctions (indices into cells) */
  links: [number, number][];
  /** gates: junction index + the point just outside the wall */
  gates: { cell: number; x: number; z: number; side: 'n' | 's' | 'w' | 'e' }[];
  squares: { x: number; z: number }[];
  mosque: { x: number; z: number };
  alley: number;
}

/**
 * The medina: a small maze of narrow alleys between whitewashed houses.
 * Junctions sit on a grid; a seeded maze decides which alleys are open.
 * Cars cannot enter: the alleys are about 3.4 m wide and the gates have bollards.
 */
export function buildMedina(k: Kit, x0: number, x1: number, z0: number, z1: number, y: number): MedinaData {
  const { b } = k;
  const rng = new RNG(Math.floor(k.rng.next() * 1e9));
  const W = x1 - x0, D = z1 - z0;
  const nx = Math.round(W / 15.5), nz = Math.round(D / 15.5);
  const cw = W / nx, ch = D / nz;
  const aw = 3.4;
  const cx = (i: number) => x0 + (i + 0.5) * cw, cz = (j: number) => z0 + (j + 0.5) * ch;
  const id = (i: number, j: number) => i * nz + j;

  // --- mosque site: replaces the masses around one junction, which is removed from the maze
  const mi = Math.max(1, Math.floor(nx / 2) + 1), mj = Math.floor(nz * 0.3);
  const blocked = new Set<number>([id(mi, mj)]);

  // --- maze: open[e] between neighbor cells
  const E = new Uint8Array(nx * nz); // open to i+1
  const S = new Uint8Array(nx * nz); // open to j+1
  const spine = Math.floor(nx / 2) - 1, cross = Math.floor(nz * 0.55);
  for (let j = 0; j < nz - 1; j++) S[id(spine, j)] = 1;
  for (let i = 0; i < nx - 1; i++) E[id(i, cross)] = 1;
  const seen = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) seen[id(spine, j)] = 1;
  for (let i = 0; i < nx; i++) seen[id(i, cross)] = 1;
  for (const q of blocked) seen[q] = 1;
  // grow the rest of the maze from cells that are already connected
  const frontier: [number, number][] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) if (seen[id(i, j)] && !blocked.has(id(i, j))) frontier.push([i, j]);
  while (frontier.length) {
    const idx = rng.int(Math.max(0, frontier.length - 4), frontier.length - 1);
    const [i, j] = frontier[idx];
    const opts: [number, number][] = [];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni >= 0 && nj >= 0 && ni < nx && nj < nz && !seen[id(ni, nj)]) opts.push([ni, nj]);
    }
    if (!opts.length) {
      frontier.splice(idx, 1);
      continue;
    }
    const [ni, nj] = rng.pick(opts);
    if (ni > i) E[id(i, j)] = 1;
    else if (ni < i) E[id(ni, nj)] = 1;
    else if (nj > j) S[id(i, j)] = 1;
    else S[id(ni, nj)] = 1;
    seen[id(ni, nj)] = 1;
    frontier.push([ni, nj]);
  }
  E[id(mi, mj + 1)] = 1; // keep the alley in front of the mosque gate open
  const plain = id(mi, mj + 1);
  // a few extra links so there are loops
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      if (blocked.has(id(i, j))) continue;
      if (i < nx - 1 && !blocked.has(id(i + 1, j)) && rng.chance(0.14)) E[id(i, j)] = 1;
      if (j < nz - 1 && !blocked.has(id(i, j + 1)) && rng.chance(0.14)) S[id(i, j)] = 1;
    }
  }

  // --- gates
  const gates: MedinaData['gates'] = [];
  const gateN = new Set<number>(), gateS = new Set<number>(), gateW = new Set<number>(), gateE = new Set<number>();
  gateN.add(spine); gateS.add(spine); gateS.add(1);
  gateW.add(cross); gateE.add(cross); gateE.add(Math.floor(nz * 0.2)); gateW.add(Math.floor(nz * 0.25));
  for (const i of gateN) gates.push({ cell: id(i, 0), x: cx(i), z: z0 - 1.5, side: 'n' });
  for (const i of gateS) gates.push({ cell: id(i, nz - 1), x: cx(i), z: z1 + 1.5, side: 's' });
  for (const j of gateW) gates.push({ cell: id(0, j), x: x0 - 1.5, z: cz(j), side: 'w' });
  for (const j of gateE) gates.push({ cell: id(nx - 1, j), x: x1 + 1.5, z: cz(j), side: 'e' });

  // --- squares: remove the building mass at some grid corners
  const squares: { x: number; z: number }[] = [];
  const openCorner = new Set<number>();
  const cid = (i: number, j: number) => i * (nz + 1) + j;
  let tries = 0;
  while (squares.length < 4 && tries++ < 200) {
    const i = rng.int(1, nx - 1), j = rng.int(1, nz - 1);
    if (openCorner.has(cid(i, j))) continue;
    if (Math.abs(i - mi) <= 1 && Math.abs(j - mj) <= 1) continue;
    if ([...openCorner].some((q) => Math.abs(Math.floor(q / (nz + 1)) - i) + Math.abs((q % (nz + 1)) - j) < 4)) continue;
    openCorner.add(cid(i, j));
    squares.push({ x: x0 + i * cw, z: z0 + j * ch });
  }

  // --- mosque footprint (corners mi..mi+1, mj..mj+1 and everything between)
  const mx0 = x0 + mi * cw - (cw - aw) / 2, mx1 = x0 + (mi + 1) * cw + (cw - aw) / 2;
  const mz0 = z0 + mj * ch - (ch - aw) / 2, mz1 = z0 + (mj + 1) * ch + (ch - aw) / 2;
  const inMosque = (i: number, j: number) => (i === mi || i === mi + 1) && (j === mj || j === mj + 1);
  b.push((mx0 + mx1) / 2, (mz0 + mz1) / 2, 0, y);
  mosque(k, mx1 - mx0, mz1 - mz0);
  b.pop();

  const shops: ShopKind[] = ['shop', 'hanout', 'bakery', 'food', 'shop', 'barber', 'closed', 'cafe'];
  const clampX = (a: number) => Math.max(x0, Math.min(x1, a)), clampZ = (a: number) => Math.max(z0, Math.min(z1, a));

  // --- building masses at grid corners
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= nz; j++) {
      if (inMosque(i, j) || openCorner.has(cid(i, j))) continue;
      const ax0 = clampX(x0 + i * cw - (cw - aw) / 2), ax1 = clampX(x0 + i * cw + (cw - aw) / 2);
      const az0 = clampZ(z0 + j * ch - (ch - aw) / 2), az1 = clampZ(z0 + j * ch + (ch - aw) / 2);
      const w = ax1 - ax0, d = az1 - az0;
      if (w < 1 || d < 1) continue;
      // split big masses in two houses with different heights
      const parts: [number, number, number, number][] = [];
      if (w > 9 && d > 9 && rng.chance(0.75)) {
        if (rng.chance(0.5)) {
          const s = rng.range(0.4, 0.6) * w;
          parts.push([ax0, ax0 + s, az0, az1], [ax0 + s, ax1, az0, az1]);
        } else {
          const s = rng.range(0.4, 0.6) * d;
          parts.push([ax0, ax1, az0, az0 + s], [ax0, ax1, az0 + s, az1]);
        }
      } else parts.push([ax0, ax1, az0, az1]);
      for (const [px0, px1, pz0, pz1] of parts) {
        const pw = px1 - px0, pd = pz1 - pz0;
        // open faces: only sides that look at an alley or the outside
        const open = {
          f: pz1 >= az1 - 0.01, b: pz0 <= az0 + 0.01, r: px1 >= ax1 - 0.01, l: px0 <= ax0 + 0.01,
        };
        b.push((px0 + px1) / 2, (pz0 + pz1) / 2, 0, y);
        house(k, pw, pd, { floors: rng.pick([1, 2, 2, 2, 3]), open, style: 'medina', noRoofProps: rng.chance(0.3) });
        b.pop();
      }
    }
  }

  // --- closed sides (walls between corners) and open passages
  const passage = (px: number, pz: number, alongX: boolean, len: number, outer: boolean, isGate: boolean, bare = false) => {
    // alongX: the alley runs along x here (we look through it in x)
    b.push(px, pz, alongX ? Math.PI / 2 : 0, y);
    // local frame: alley runs along z, walls at x = -aw/2 and +aw/2
    if (isGate) {
      b.mesh('wall', archGeo(aw + 2.4, 6.2, aw - 0.5, 4.6, 1.4), 0, 0, 0, PALETTE.stone);
      b.box('wall', 0, 6.45, 0, aw + 2.8, 0.5, 1.7, 0xf1ece2);
      for (let m = -2; m <= 2; m++) b.box('wall', m * 1.25, 7.0, 0, 0.7, 0.6, 1.5, PALETTE.stone, 0, SKIP.NY);
      for (const s of [-1, 1]) b.solid(s * (aw / 2 + 0.6), 3.1, 0, 1.45, 6.2, 1.4);
      b.solid(0, 5.6, 0, aw, 1.4, 1.4);
      for (const s of [-1, 0, 1]) bollard(k, s * 1.05, len / 2 + 2.2 > 0 ? (outer ? 2.2 : -2.2) : 0);
      for (const s of [-1, 0, 1]) bollard(k, s * 1.05, outer ? -2.2 : 2.2);
    } else if (!bare) {
      const r = rng.next();
      if (r < 0.16) {
        // room built over the alley ("sabat")
        const h0 = 3.3, len2 = Math.min(len, rng.range(3, 6));
        b.box('wall', 0, h0 + 1.4, 0, aw + 0.2, 2.8, len2, rng.pick(PALETTE.wallsWhite));
        for (const s of [-1, 1]) b.mesh('wall', archGeo(aw + 0.2, h0, aw - 0.3, h0 - 0.1, 0.35), 0, 0, s * (len2 / 2 - 0.18), 0xf4f1ea);
        b.solid(0, h0 + 1.4, 0, aw + 0.2, 2.8, len2);
      } else if (r < 0.36) {
        // thin arches that hold the walls apart
        const n = rng.int(1, 2);
        for (let q = 0; q < n; q++) b.mesh('wall', archGeo(aw + 0.2, 4.6, aw - 0.2, 3.9, 0.4), 0, 0, (q - (n - 1) / 2) * 3, 0xf4f1ea);
      } else if (r < 0.5) {
        // souk awnings
        for (const s of [-1, 1]) {
          b.push(s * (aw / 2), 0, s * Math.PI / 2);
          awning(k, 0, 2.9, Math.min(len - 1, 4), 1.1, rng.pick(PALETTE.awnings), 0xf2ede0);
          b.pop();
        }
      }
      if (rng.chance(0.5)) {
        b.push(-aw / 2, rng.range(-len / 3, len / 3), Math.PI / 2);
        wallLantern(k, 0, 3.0, 0);
        b.pop();
      }
    }
    b.pop();
  };
  const wall = (px: number, pz: number, alongX: boolean, half: 0 | 1 | -1) => {
    // closes an alley arm. alongX = the blocked arm runs along x. The piece is (cw - aw) long and aw wide.
    let len = (alongX ? cw : ch) - aw;
    let ox = 0;
    if (half !== 0) {
      len /= 2;
      ox = (half * len) / 2;
    }
    b.push(px + (alongX ? ox : 0), pz + (alongX ? 0 : ox), alongX ? 0 : Math.PI / 2, y);
    // local: piece is `len` along x, aw along z; alley faces are at z = +-aw/2
    const h = rng.range(3.4, 6.5);
    const color = rng.pick(PALETTE.wallsWhite);
    b.box('wall', 0, h / 2, 0, len, h, aw, color, 0, SKIP.NY);
    b.solid(0, h / 2, 0, len, h, aw);
    // the two end faces look into the alleys (3.4 m wide): doors, small shops, carpets
    for (const s of [1, -1]) {
      b.push((s * len) / 2, 0, (s * Math.PI) / 2);
      const r = rng.next();
      if (r < 0.25) shopFront(k, 0, 2.3, 2.3, rng.pick(shops), 0.5);
      else if (r < 0.8) b.plate('atlas', rng.range(-0.6, 0.6), 1.3, 0.04, 1.3, 2.6, 0xffffff, k.atlas.door(rng));
      else if (r < 0.92) b.plate('atlas', 0, 2.0, 0.05, 1.6, 2.2, 0xffffff, k.atlas.uv('carpet' + rng.int(0, 3)));
      if (rng.chance(0.3)) wallLantern(k, 1.2, 3.0, 0);
      b.pop();
    }
    b.pop();
  };

  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      if (blocked.has(id(i, j))) continue;
      // east side
      if (i < nx - 1) {
        const bx = x0 + (i + 1) * cw;
        if (E[id(i, j)] && !blocked.has(id(i + 1, j))) passage(bx, cz(j), true, cw - aw, false, false, id(i, j) === plain);
        else if (!(inMosque(i + 1, j) && inMosque(i + 1, j + 1))) wall(bx, cz(j), true, 0);
      }
      // south side
      if (j < nz - 1) {
        const bz = z0 + (j + 1) * ch;
        if (S[id(i, j)] && !blocked.has(id(i, j + 1))) passage(cx(i), bz, false, ch - aw, false, false);
        else if (!(inMosque(i, j + 1) && inMosque(i + 1, j + 1))) wall(cx(i), bz, false, 0);
      }
    }
  }
  // outer ring: gates or closed walls
  for (let i = 0; i < nx; i++) {
    if (gateN.has(i)) passage(cx(i), z0 + 0.7, false, 3, true, true);
    else wall(cx(i), z0, false, 1);
    if (gateS.has(i)) passage(cx(i), z1 - 0.7, false, 3, false, true);
    else wall(cx(i), z1, false, -1);
  }
  for (let j = 0; j < nz; j++) {
    if (gateW.has(j)) passage(x0 + 0.7, cz(j), true, 3, true, true);
    else wall(x0, cz(j), true, 1);
    if (gateE.has(j)) passage(x1 - 0.7, cz(j), true, 3, false, true);
    else wall(x1, cz(j), true, -1);
  }

  // --- squares: a tree, a café or a fountain
  squares.forEach((s, n) => {
    b.push(s.x, s.z, 0, y);
    if (n % 2 === 0) {
      palm(k, 0, 0, 6);
      for (let q = 0; q < 3; q++) cafeSet(k, rng.range(-3.5, 3.5), rng.range(-3.5, 3.5) + (q - 1) * 0.5, rng.int(2, 3), 0xf2f2ee);
    } else {
      b.cyl('matte', 0, 0, 0, 1.6, 0.55, 0xd8cfb8, 8);
      b.cyl('glass', 0, 0.48, 0, 1.4, 0.1, 0x3a7a8a, 8);
      b.cyl('matte', 0, 0.5, 0, 0.2, 0.9, 0xd8cfb8, 6);
      b.solid(0, 0.3, 0, 3, 0.6, 3);
      orangeTree(k, 3.2, 2.6);
      orangeTree(k, -3, -2.8);
    }
    b.flat('decal', 0, 0.015, 0, cw - aw - 0.5, ch - aw - 0.5, 0xd9cfb6);
    b.pop();
  });

  // --- data for pedestrians and missions
  const cells: MedinaData['cells'] = [];
  const index = new Map<number, number>();
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      if (blocked.has(id(i, j))) continue;
      index.set(id(i, j), cells.length);
      cells.push({ x: cx(i), z: cz(j), i, j });
    }
  }
  const links: [number, number][] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const a = index.get(id(i, j));
      if (a === undefined) continue;
      if (i < nx - 1 && E[id(i, j)] && index.has(id(i + 1, j))) links.push([a, index.get(id(i + 1, j))!]);
      if (j < nz - 1 && S[id(i, j)] && index.has(id(i, j + 1))) links.push([a, index.get(id(i, j + 1))!]);
    }
  }
  for (const g of gates) g.cell = index.get(g.cell)!;
  return { cells, links, gates, squares, mosque: { x: (mx0 + mx1) / 2, z: (mz0 + mz1) / 2 }, alley: aw };
}
