import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LOUAGE_STRIPE_COLOR, POLICE, type VehicleSpec } from '../data/config';
import type { Atlas } from '../world/atlas';

/**
 * Car models made in code. No real brands: these are generic "Tunisian street" shapes.
 * Local frame: +z = forward, origin on the ground under the middle of the car.
 */
interface Shape {
  hb: number; // belt line height
  hood: number; // hood length (front to windshield base)
  slope: number; // windshield run
  rearBase: number; // rear window base, from the rear
  rearTop: number; // rear roof end, from the rear
  windows: number; // side windows per side
  cabRear?: number; // pickup: cab ends here (from the rear)
}

const SHAPES: Record<VehicleSpec['kind'], Shape> = {
  hatch: { hb: 0.86, hood: 0.85, slope: 0.7, rearBase: 0.1, rearTop: 0.5, windows: 2 },
  sedan: { hb: 0.88, hood: 1.05, slope: 0.75, rearBase: 0.72, rearTop: 1.32, windows: 2 },
  taxi: { hb: 0.88, hood: 0.98, slope: 0.72, rearBase: 0.6, rearTop: 1.15, windows: 2 },
  police: { hb: 0.88, hood: 1.05, slope: 0.75, rearBase: 0.72, rearTop: 1.32, windows: 2 },
  louage: { hb: 1.12, hood: 0.5, slope: 0.6, rearBase: 0.04, rearTop: 0.12, windows: 4 },
  pickup: { hb: 0.98, hood: 1.1, slope: 0.5, rearBase: 0, rearTop: 0, windows: 1, cabRear: 2.05 },
};

const mats = {
  paint: new Map<number, THREE.MeshStandardMaterial>(),
  glass: new THREE.MeshStandardMaterial({ color: 0x141c24, roughness: 0.06, metalness: 0.9, envMapIntensity: 1.6 }),
  trim: new THREE.MeshStandardMaterial({ color: 0x1b1d1f, roughness: 0.65, metalness: 0.2 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x111112, roughness: 0.92 }),
  hub: new THREE.MeshStandardMaterial({ color: 0xa8abae, roughness: 0.35, metalness: 0.8 }),
  head: new THREE.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0xfff0c0, emissiveIntensity: 0.35, roughness: 0.2 }),
  tail: new THREE.MeshStandardMaterial({ color: 0xb01818, emissive: 0xff2010, emissiveIntensity: 0.35, roughness: 0.3 }),
};

function paintMat(color: number): THREE.MeshStandardMaterial {
  let m = mats.paint.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.5, envMapIntensity: 1.25 });
    mats.paint.set(color, m);
  }
  return m;
}

function boxG(sx: number, sy: number, sz: number, x: number, y: number, z: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z).toNonIndexed();
}

/** Quad geometry from 4 points (ccw from the front), with UVs. */
function quadG(a: number[], b: number[], c: number[], d: number[], uv?: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  const u = uv ?? [0, 0, 1, 1];
  g.setAttribute('uv', new THREE.Float32BufferAttribute([u[0], u[1], u[2], u[1], u[2], u[3], u[0], u[1], u[2], u[3], u[0], u[3]], 2));
  g.computeVertexNormals();
  return g;
}

function extrudeProfile(pts: THREE.Shape, width: number, bevel: number, low = false): THREE.BufferGeometry {
  if (low) bevel = 0;
  const g = new THREE.ExtrudeGeometry(pts, {
    depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: low ? 3 : 8,
  });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2); // profile x -> car z, extrusion -> car x
  return g.index ? g.toNonIndexed() : g;
}

export interface CarModel {
  group: THREE.Group;
  /** wheel pivots: front-left, front-right, rear-left, rear-right */
  wheels: THREE.Object3D[];
  tail: THREE.MeshStandardMaterial;
}

export function buildCarModel(spec: VehicleSpec, color: number, atlas: Atlas, variant = 0, low = false): CarModel {
  const S = SHAPES[spec.kind];
  const L = spec.length, W = spec.width, H = spec.height, wr = spec.wheelRadius;
  const front = L / 2, rear = -L / 2, gc = 0.21, hb = S.hb;
  const zf = spec.wheelBase / 2 + 0.06, zr = -spec.wheelBase / 2 + 0.06;
  const ra = wr + 0.075;
  const pickup = spec.kind === 'pickup';
  const hbBed = hb - 0.3;
  const cabRearZ = pickup ? rear + S.cabRear! : rear;

  // ---- lower body
  const lower = new THREE.Shape();
  lower.moveTo(rear + 0.14, gc);
  lower.lineTo(rear, 0.36);
  if (pickup) {
    lower.lineTo(rear, hbBed);
    lower.lineTo(cabRearZ, hbBed);
    lower.lineTo(cabRearZ, hb);
  } else {
    lower.lineTo(rear, hb - 0.1);
    lower.lineTo(rear + 0.1, hb);
  }
  lower.lineTo(front - S.hood, hb);
  lower.lineTo(front - 0.14, hb - (spec.kind === 'louage' ? 0.14 : 0.1));
  lower.lineTo(front, hb - 0.3);
  lower.lineTo(front, 0.36);
  lower.lineTo(front - 0.14, gc);
  lower.lineTo(zf + ra, gc);
  lower.absarc(zf, wr, ra, 0, Math.PI, false);
  lower.lineTo(zf - ra, gc);
  lower.lineTo(zr + ra, gc);
  lower.absarc(zr, wr, ra, 0, Math.PI, false);
  lower.lineTo(zr - ra, gc);
  lower.closePath();
  const paintParts: THREE.BufferGeometry[] = [extrudeProfile(lower, W, 0.045, low)];

  // ---- cabin
  const zwb = front - S.hood, zwt = zwb - S.slope; // windshield bottom / top
  const zrb = cabRearZ + S.rearBase, zrt = cabRearZ + Math.max(S.rearTop, S.rearBase + 0.06); // rear window bottom / top
  const Wc = W - 0.22;
  const cab = new THREE.Shape();
  cab.moveTo(zrb, hb - 0.02);
  cab.lineTo(zrt, H);
  cab.lineTo(zwt, H);
  cab.lineTo(zwb, hb - 0.02);
  cab.closePath();
  paintParts.push(extrudeProfile(cab, Wc, 0.03, low));
  // mirrors
  for (const s of [-1, 1]) paintParts.push(boxG(0.16, 0.1, 0.07, s * (W / 2 + 0.05), hb + 0.08, zwb - 0.12));
  if (pickup) {
    // bed walls
    for (const s of [-1, 1]) paintParts.push(boxG(0.07, 0.34, cabRearZ - rear - 0.05, s * (W / 2 - 0.05), hbBed + 0.17, (cabRearZ + rear) / 2));
    paintParts.push(boxG(W - 0.1, 0.34, 0.07, 0, hbBed + 0.17, rear + 0.04));
  }

  // ---- glass (decals just outside the cabin)
  const glassParts: THREE.BufferGeometry[] = [];
  const o = 0.012;
  const yb = hb + 0.07, yt = H - 0.1;
  const edge = (zb: number, zt: number, y: number) => zb + ((zt - zb) * (y - (hb - 0.02))) / (H - (hb - 0.02));
  // windshield and rear window
  {
    const hw = Wc / 2 - 0.09;
    const n = new THREE.Vector2(H - hb, S.slope).normalize(); // outward normal of the windshield in (z, y)
    const zb = edge(zwb, zwt, yb), zt = edge(zwb, zwt, yt);
    glassParts.push(quadG([-hw, yb + n.y * o, zb + n.x * o], [hw, yb + n.y * o, zb + n.x * o], [hw, yt + n.y * o, zt + n.x * o], [-hw, yt + n.y * o, zt + n.x * o]));
    if (!pickup || true) {
      const run = zrt - zrb;
      const m = new THREE.Vector2(-(H - hb), run).normalize();
      const rb = edge(zrb, zrt, yb + (spec.kind === 'louage' ? 0.25 : 0)), rt = edge(zrb, zrt, yt);
      const ybb = yb + (spec.kind === 'louage' ? 0.25 : 0);
      glassParts.push(quadG([hw, ybb + m.y * o, rb + m.x * o], [-hw, ybb + m.y * o, rb + m.x * o], [-hw, yt + m.y * o, rt + m.x * o], [hw, yt + m.y * o, rt + m.x * o]));
    }
  }
  // side windows
  const pillar = 0.09;
  const z0 = (y: number) => edge(zrb, zrt, y) + 0.1, z1 = (y: number) => edge(zwb, zwt, y) - 0.1;
  for (const s of [-1, 1]) {
    const x = s * (Wc / 2 + 0.03 + o);
    for (let i = 0; i < S.windows; i++) {
      const fa = i / S.windows, fb = (i + 1) / S.windows;
      const ab = z0(yb) + (z1(yb) - z0(yb)) * fa + (i > 0 ? pillar / 2 : 0), bb = z0(yb) + (z1(yb) - z0(yb)) * fb - (i < S.windows - 1 ? pillar / 2 : 0);
      const at = z0(yt) + (z1(yt) - z0(yt)) * fa + (i > 0 ? pillar / 2 : 0), bt = z0(yt) + (z1(yt) - z0(yt)) * fb - (i < S.windows - 1 ? pillar / 2 : 0);
      if (s > 0) glassParts.push(quadG([x, yb, bb], [x, yb, ab], [x, yt, at], [x, yt, bt]));
      else glassParts.push(quadG([x, yb, ab], [x, yb, bb], [x, yt, bt], [x, yt, at]));
    }
  }

  // ---- dark trim: bumpers, grille, underbody, door seams
  const trimParts: THREE.BufferGeometry[] = [
    boxG(W + 0.03, 0.17, 0.16, 0, 0.37, front - 0.02),
    boxG(W + 0.03, 0.17, 0.16, 0, 0.37, rear + 0.02),
    boxG(W * 0.5, 0.14, 0.05, 0, hb - 0.33, front + 0.03),
    boxG(W - 0.5, 0.4, L - 0.5, 0, 0.42, 0),
  ];
  const seamZ = [zwb - 0.05, (z0(yb) + z1(yb)) / 2, z0(yb) - 0.02];
  if (!pickup) for (const s of [-1, 1]) for (const z of seamZ) trimParts.push(boxG(0.012, hb - 0.42, 0.015, s * (W / 2 + 0.001), 0.38 + (hb - 0.42) / 2, z));
  for (const s of [-1, 1]) trimParts.push(boxG(0.03, 0.03, 0.12, s * (W / 2 + 0.012), hb - 0.12, (z0(yb) + z1(yb)) / 2 + 0.45));
  if (pickup) trimParts.push(boxG(W - 0.24, 0.02, cabRearZ - rear - 0.12, 0, hbBed + 0.03, (cabRearZ + rear) / 2));

  const group = new THREE.Group();
  const add = (parts: THREE.BufferGeometry[], mat: THREE.Material, bucket: string, col: number, cast = true): THREE.Mesh => {
    const m = new THREE.Mesh(mergeGeometries(parts, false), mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    m.userData.bucket = bucket;
    m.userData.color = col;
    group.add(m);
    return m;
  };
  add(paintParts, paintMat(color), 'gloss', color);
  add(glassParts, mats.glass, 'glass', 0x18222c, false);
  add(trimParts, mats.trim, 'matte', 0x1b1d1f);

  // ---- lights
  const tail = mats.tail.clone();
  const lw = spec.kind === 'louage' ? 0.26 : 0.36;
  add([boxG(lw, 0.15, 0.05, -(W / 2 - 0.26), hb - 0.2, front + 0.005), boxG(lw, 0.15, 0.05, W / 2 - 0.26, hb - 0.2, front + 0.005)], mats.head, 'glow', 0xfff6dc, false);
  const ty = pickup ? hbBed - 0.14 : hb - 0.18;
  add([boxG(0.3, 0.14, 0.05, -(W / 2 - 0.22), ty, rear - 0.005), boxG(0.3, 0.14, 0.05, W / 2 - 0.22, ty, rear - 0.005)], tail, 'gloss', 0xb01818, false);

  // ---- extras per type
  const atlasParts: THREE.BufferGeometry[] = [];
  const plateUV = atlas.uv(variant % 2 ? 'sign39' : 'sign38');
  atlasParts.push(quadG([-0.24, 0.36, front + 0.07], [0.24, 0.36, front + 0.07], [0.24, 0.48, front + 0.07], [-0.24, 0.48, front + 0.07], plateUV));
  atlasParts.push(quadG([0.24, ty - 0.2, rear - 0.07], [-0.24, ty - 0.2, rear - 0.07], [-0.24, ty - 0.08, rear - 0.07], [0.24, ty - 0.08, rear - 0.07], plateUV));
  const stripe = (c: number, y: number, h: number) => {
    const parts = [-1, 1].map((s) => boxG(0.012, h, L - 0.5, s * (W / 2 + 0.002), y, 0));
    add(parts, paintMat(c), 'gloss', c, false);
  };
  if (spec.kind === 'taxi') {
    add([boxG(0.5, 0.17, 0.2, 0, H + 0.085, zwt - 0.4)], paintMat(0xf2c21a), 'gloss', 0xf2c21a);
    const uv = atlas.uv('sign36');
    atlasParts.push(quadG([-0.24, H + 0.01, zwt - 0.295], [0.24, H + 0.01, zwt - 0.295], [0.24, H + 0.16, zwt - 0.295], [-0.24, H + 0.16, zwt - 0.295], uv));
    atlasParts.push(quadG([0.24, H + 0.01, zwt - 0.505], [-0.24, H + 0.01, zwt - 0.505], [-0.24, H + 0.16, zwt - 0.505], [0.24, H + 0.16, zwt - 0.505], uv));
  } else if (spec.kind === 'louage') {
    stripe(LOUAGE_STRIPE_COLOR, hb - 0.2, 0.2);
    add([boxG(0.9, 0.2, 0.12, 0, H + 0.1, zwt - 0.25)], paintMat(0xf2f0ea), 'gloss', 0xf2f0ea);
    const uv = atlas.uv('sign37');
    atlasParts.push(quadG([-0.42, H + 0.02, zwt - 0.185], [0.42, H + 0.02, zwt - 0.185], [0.42, H + 0.19, zwt - 0.185], [-0.42, H + 0.19, zwt - 0.185], uv));
    // roof rack with bags
    const rack = [boxG(W - 0.5, 0.03, 0.03, 0, H + 0.1, rear + 0.5), boxG(W - 0.5, 0.03, 0.03, 0, H + 0.1, rear + 2.0)];
    for (const s of [-1, 1]) rack.push(boxG(0.03, 0.03, 1.5, s * (W / 2 - 0.25), H + 0.1, rear + 1.25));
    add(rack, mats.trim, 'matte', 0x1b1d1f);
    add([boxG(0.7, 0.3, 0.5, -0.2, H + 0.26, rear + 0.9), boxG(0.5, 0.24, 0.6, 0.3, H + 0.23, rear + 1.5)], paintMat(0x3a5a8a), 'matte', 0x3a5a8a);
  } else if (spec.kind === 'police') {
    stripe(POLICE.stripeColor, hb - 0.22, 0.16);
    add([boxG(0.42, 0.11, 0.2, -0.23, H + 0.055, zwt - 0.5)], paintMat(0x1a3fd0), 'gloss', 0x1a3fd0);
    add([boxG(0.42, 0.11, 0.2, 0.23, H + 0.055, zwt - 0.5)], paintMat(0xd01a1a), 'gloss', 0xd01a1a);
    const uv = atlas.uv('sign25');
    for (const s of [-1, 1]) {
      const x = s * (W / 2 + 0.012);
      const a = [x, hb - 0.62, s > 0 ? 0.45 : -0.45], bq = [x, hb - 0.62, s > 0 ? -0.45 : 0.45];
      atlasParts.push(quadG(a, bq, [bq[0], hb - 0.36, bq[2]], [a[0], hb - 0.36, a[2]], uv));
    }
  }
  const am = add(atlasParts, atlasMaterial(atlas), 'atlas', 0xffffff, false);
  am.userData.bucket = 'atlas';

  // ---- wheels
  const wheels: THREE.Object3D[] = [];
  const tireG = new THREE.CylinderGeometry(wr, wr, 0.2, low ? 8 : 14).rotateZ(Math.PI / 2);
  const hubG = new THREE.CylinderGeometry(wr * 0.58, wr * 0.58, 0.215, low ? 6 : 10).rotateZ(Math.PI / 2);
  const wx = W / 2 - 0.11;
  for (const [x, z] of [[wx, zf], [-wx, zf], [wx, zr], [-wx, zr]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, wr, z);
    const t = new THREE.Mesh(tireG, mats.tire);
    t.castShadow = true;
    t.userData.bucket = 'matte';
    t.userData.color = 0x131314;
    const h = new THREE.Mesh(hubG, mats.hub);
    h.userData.bucket = 'gloss';
    h.userData.color = spec.kind === 'pickup' ? 0xd8d4c8 : 0x9a9da0;
    pivot.add(t, h);
    group.add(pivot);
    wheels.push(pivot);
  }
  return { group, wheels, tail };
}

let _atlasMat: THREE.MeshStandardMaterial | null = null;
function atlasMaterial(atlas: Atlas): THREE.MeshStandardMaterial {
  if (!_atlasMat) _atlasMat = new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.6, alphaTest: 0.5 });
  return _atlasMat;
}
