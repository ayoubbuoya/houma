import * as THREE from 'three';
import { WORLD } from '../data/config';

/** Names of the shared static materials. One merged mesh per material per chunk. */
export type Mat = 'wall' | 'matte' | 'gloss' | 'glass' | 'road' | 'decal' | 'pave' | 'foliage' | 'atlas' | 'glow';

export interface BoxCollider {
  x: number; y: number; z: number;
  hx: number; hy: number; hz: number;
  yaw: number;
  /** optional tilt around x (used for the beach slope) */
  pitch?: number;
}

class Bucket {
  pos = new Float32Array(3 * 4096);
  nrm = new Int8Array(3 * 4096);
  col = new Uint8Array(3 * 4096);
  uv = new Float32Array(2 * 4096);
  idx = new Uint32Array(6 * 2048);
  nv = 0;
  ni = 0;

  reserve(v: number, i: number): void {
    if ((this.nv + v) * 3 > this.pos.length) {
      const cap = Math.max(this.pos.length * 2, (this.nv + v) * 3);
      const grow = <T extends Float32Array | Int8Array | Uint8Array>(a: T, n: number): T => {
        const b = new (a.constructor as any)(n) as T;
        b.set(a);
        return b;
      };
      this.pos = grow(this.pos, cap);
      this.nrm = grow(this.nrm, cap);
      this.col = grow(this.col, cap);
      this.uv = grow(this.uv, (cap / 3) * 2);
    }
    if (this.ni + i > this.idx.length) {
      const b = new Uint32Array(Math.max(this.idx.length * 2, this.ni + i));
      b.set(this.idx);
      this.idx = b;
    }
  }
}

const _c = new THREE.Color();
const colorCache = new Map<number, [number, number, number]>();
function rgb(hex: number): [number, number, number] {
  let v = colorCache.get(hex);
  if (!v) {
    _c.setHex(hex); // converts sRGB hex to linear working space
    v = [Math.round(_c.r * 255), Math.round(_c.g * 255), Math.round(_c.b * 255)];
    colorCache.set(hex, v);
  }
  return v;
}

/** Mix two hex colors (in sRGB, good enough for palette work). */
export function mixHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
/** Multiply brightness of a hex color. */
export function shade(a: number, f: number): number {
  const r = Math.min(255, Math.round(((a >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((a >> 8) & 255) * f));
  const b = Math.min(255, Math.round((a & 255) * f));
  return (r << 16) | (g << 8) | b;
}

const unit = new Map<string, THREE.BufferGeometry>();
function unitGeo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = unit.get(key);
  if (!g) {
    g = make();
    unit.set(key, g);
  }
  return g;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _n3 = new THREE.Matrix3();
const _v = new THREE.Vector3();

export const SKIP = { PX: 1, NX: 2, PY: 4, NY: 8, PZ: 16, NZ: 32 };

/**
 * Collects all static city geometry into a few big merged meshes.
 * It keeps a 2D transform stack (position + yaw) so kit pieces can be written in local space.
 */
export class Builder {
  private buckets = new Map<string, Bucket>();
  colliders: BoxCollider[] = [];
  trimeshes: { vertices: Float32Array; indices: Uint32Array }[] = [];
  private tx = 0;
  private ty = 0;
  private tz = 0;
  private c = 1;
  private s = 0;
  private yaw = 0;
  private stack: number[] = [];

  push(x: number, z: number, yaw = 0, y = 0): void {
    this.stack.push(this.tx, this.ty, this.tz, this.yaw);
    const nx = this.tx + x * this.c + z * this.s;
    const nz = this.tz - x * this.s + z * this.c;
    this.tx = nx;
    this.tz = nz;
    this.ty += y;
    this.yaw += yaw;
    this.c = Math.cos(this.yaw);
    this.s = Math.sin(this.yaw);
  }
  pop(): void {
    this.yaw = this.stack.pop()!;
    this.tz = this.stack.pop()!;
    this.ty = this.stack.pop()!;
    this.tx = this.stack.pop()!;
    this.c = Math.cos(this.yaw);
    this.s = Math.sin(this.yaw);
  }
  /** Runs fn with the transform reset to world space. */
  world(fn: () => void): void {
    this.stack.push(this.tx, this.ty, this.tz, this.yaw);
    this.tx = this.ty = this.tz = this.yaw = 0;
    this.c = 1;
    this.s = 0;
    fn();
    this.pop();
  }
  /** Local point to world (x, z). */
  toWorld(x: number, z: number): [number, number] {
    return [this.tx + x * this.c + z * this.s, this.tz - x * this.s + z * this.c];
  }
  get worldYaw(): number {
    return this.yaw;
  }

  private bucket(mat: Mat, wx: number, wz: number): Bucket {
    const key = mat + '|' + Math.floor((wx + 1000) / WORLD.chunk) + '|' + Math.floor((wz + 1000) / WORLD.chunk);
    let b = this.buckets.get(key);
    if (!b) {
      b = new Bucket();
      this.buckets.set(key, b);
    }
    return b;
  }

  /** Axis-aligned box in local space (optionally rotated by yaw around its own center). */
  box(mat: Mat, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: number, yaw = 0, skip = 0): void {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const c0 = yaw ? Math.cos(yaw) : 1, s0 = yaw ? Math.sin(yaw) : 0;
    // combined rotation: own yaw then builder yaw
    const C = c0 * this.c - s0 * this.s;
    const S = s0 * this.c + c0 * this.s;
    const ox = this.tx + cx * this.c + cz * this.s;
    const oz = this.tz - cx * this.s + cz * this.c;
    const oy = this.ty + cy;
    const b = this.bucket(mat, ox, oz);
    const [r, g, bl] = rgb(color);
    // face definitions: normal + 4 corners (ccw seen from outside)
    for (let f = 0; f < 6; f++) {
      if (skip & (1 << f)) continue;
      b.reserve(4, 6);
      let nx = 0, ny = 0, nz = 0;
      let p: number[];
      switch (f) {
        case 0: nx = 1; p = [hx, -hy, hz, hx, -hy, -hz, hx, hy, -hz, hx, hy, hz]; break;
        case 1: nx = -1; p = [-hx, -hy, -hz, -hx, -hy, hz, -hx, hy, hz, -hx, hy, -hz]; break;
        case 2: ny = 1; p = [-hx, hy, hz, hx, hy, hz, hx, hy, -hz, -hx, hy, -hz]; break;
        case 3: ny = -1; p = [-hx, -hy, -hz, hx, -hy, -hz, hx, -hy, hz, -hx, -hy, hz]; break;
        case 4: nz = 1; p = [-hx, -hy, hz, hx, -hy, hz, hx, hy, hz, -hx, hy, hz]; break;
        default: nz = -1; p = [hx, -hy, -hz, -hx, -hy, -hz, -hx, hy, -hz, hx, hy, -hz]; break;
      }
      const wnx = nx * C + nz * S, wnz = -nx * S + nz * C;
      const v0 = b.nv;
      for (let k = 0; k < 4; k++) {
        const lx = p[k * 3], ly = p[k * 3 + 1], lz = p[k * 3 + 2];
        const X = ox + lx * C + lz * S, Y = oy + ly, Z = oz - lx * S + lz * C;
        const o = b.nv * 3;
        b.pos[o] = X; b.pos[o + 1] = Y; b.pos[o + 2] = Z;
        b.nrm[o] = wnx * 127; b.nrm[o + 1] = ny * 127; b.nrm[o + 2] = wnz * 127;
        b.col[o] = r; b.col[o + 1] = g; b.col[o + 2] = bl;
        const u = b.nv * 2;
        if (f === 2 || f === 3) { b.uv[u] = X; b.uv[u + 1] = Z; }
        else { b.uv[u] = f < 2 ? lz : lx; b.uv[u + 1] = Y; }
        b.nv++;
      }
      b.idx[b.ni++] = v0; b.idx[b.ni++] = v0 + 1; b.idx[b.ni++] = v0 + 2;
      b.idx[b.ni++] = v0; b.idx[b.ni++] = v0 + 2; b.idx[b.ni++] = v0 + 3;
    }
  }

  /** Free quad from 4 local points (counter-clockwise seen from the front). uv = [u0, v0, u1, v1]. */
  quad(mat: Mat, a: number[], bb: number[], cc: number[], d: number[], color: number, uv?: number[]): void {
    const pts = [a, bb, cc, d];
    const ux = bb[0] - a[0], uy = bb[1] - a[1], uz = bb[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const wnx = nx * this.c + nz * this.s, wnz = -nx * this.s + nz * this.c;
    const [wx, wz] = this.toWorld(a[0], a[2]);
    const b = this.bucket(mat, wx, wz);
    b.reserve(4, 6);
    const [r, g, bl] = rgb(color);
    const v0 = b.nv;
    for (let k = 0; k < 4; k++) {
      const p = pts[k];
      const X = this.tx + p[0] * this.c + p[2] * this.s, Z = this.tz - p[0] * this.s + p[2] * this.c, Y = this.ty + p[1];
      const o = b.nv * 3;
      b.pos[o] = X; b.pos[o + 1] = Y; b.pos[o + 2] = Z;
      b.nrm[o] = wnx * 127; b.nrm[o + 1] = ny * 127; b.nrm[o + 2] = wnz * 127;
      b.col[o] = r; b.col[o + 1] = g; b.col[o + 2] = bl;
      const u = b.nv * 2;
      if (uv) {
        b.uv[u] = k === 0 || k === 3 ? uv[0] : uv[2];
        b.uv[u + 1] = k < 2 ? uv[1] : uv[3];
      } else { b.uv[u] = X; b.uv[u + 1] = Z; }
      b.nv++;
    }
    b.idx[b.ni++] = v0; b.idx[b.ni++] = v0 + 1; b.idx[b.ni++] = v0 + 2;
    b.idx[b.ni++] = v0; b.idx[b.ni++] = v0 + 2; b.idx[b.ni++] = v0 + 3;
  }

  /** Vertical textured plate facing local +z (signs, doors). Center at (x, y, z). */
  plate(mat: Mat, x: number, y: number, z: number, w: number, h: number, color: number, uv?: number[], yaw = 0): void {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const hw = w / 2, hh = h / 2;
    this.quad(mat,
      [x - hw * c, y - hh, z + hw * s], [x + hw * c, y - hh, z - hw * s],
      [x + hw * c, y + hh, z - hw * s], [x - hw * c, y + hh, z + hw * s], color, uv);
  }

  /** Flat horizontal quad (facing up) at height y. */
  flat(mat: Mat, cx: number, y: number, cz: number, sx: number, sz: number, color: number, yaw = 0, uv?: number[]): void {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const hx = sx / 2, hz = sz / 2;
    const P = (lx: number, lz: number) => [cx + lx * c + lz * s, y, cz - lx * s + lz * c];
    this.quad(mat, P(-hx, hz), P(hx, hz), P(hx, -hz), P(-hx, -hz), color, uv);
  }

  /** Add any three.js geometry with a local matrix. Keeps its UVs if it has them. */
  geom(mat: Mat, g: THREE.BufferGeometry, m: THREE.Matrix4, color: number, worldUV = false): void {
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const uvA = g.getAttribute('uv');
    const index = g.getIndex();
    _p.setFromMatrixPosition(m);
    const [wx, wz] = this.toWorld(_p.x, _p.z);
    const b = this.bucket(mat, wx, wz);
    const nIdx = index ? index.count : pos.count;
    b.reserve(pos.count, nIdx);
    _n3.getNormalMatrix(m);
    const [r, gg, bl] = rgb(color);
    const v0 = b.nv;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(m);
      const X = this.tx + _v.x * this.c + _v.z * this.s, Z = this.tz - _v.x * this.s + _v.z * this.c, Y = this.ty + _v.y;
      const o = b.nv * 3;
      b.pos[o] = X; b.pos[o + 1] = Y; b.pos[o + 2] = Z;
      if (nor) {
        _v.fromBufferAttribute(nor, i).applyMatrix3(_n3).normalize();
        b.nrm[o] = (_v.x * this.c + _v.z * this.s) * 127; b.nrm[o + 1] = _v.y * 127; b.nrm[o + 2] = (-_v.x * this.s + _v.z * this.c) * 127;
      } else { b.nrm[o] = 0; b.nrm[o + 1] = 127; b.nrm[o + 2] = 0; }
      b.col[o] = r; b.col[o + 1] = gg; b.col[o + 2] = bl;
      const u = b.nv * 2;
      if (uvA && !worldUV) { b.uv[u] = uvA.getX(i); b.uv[u + 1] = uvA.getY(i); }
      else { b.uv[u] = X; b.uv[u + 1] = Z; }
      b.nv++;
    }
    if (index) for (let i = 0; i < index.count; i++) b.idx[b.ni++] = v0 + index.getX(i);
    else for (let i = 0; i < pos.count; i++) b.idx[b.ni++] = v0 + i;
  }

  private trs(x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0): THREE.Matrix4 {
    _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ'));
    return _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  }

  /** Vertical cylinder with its base at y. `top` is the top radius as a fraction of r. */
  cyl(mat: Mat, x: number, y: number, z: number, r: number, h: number, color: number, segs = 8, top = 1): void {
    const g = unitGeo(`cyl${segs}_${top.toFixed(2)}`, () => new THREE.CylinderGeometry(top, 1, 1, segs, 1).translate(0, 0.5, 0));
    this.geom(mat, g, this.trs(x, y, z, r, h, r), color);
  }
  /** Cylinder along any direction (rx, rz rotation), centered. */
  rod(mat: Mat, x: number, y: number, z: number, r: number, len: number, color: number, rx = 0, ry = 0, rz = 0, segs = 6): void {
    const g = unitGeo(`rod${segs}`, () => new THREE.CylinderGeometry(1, 1, 1, segs, 1));
    this.geom(mat, g, this.trs(x, y, z, r, len, r, rx, ry, rz), color);
  }
  /** Faceted blob (leaves, rocks). */
  blob(mat: Mat, x: number, y: number, z: number, rx: number, ry: number, rz: number, color: number, detail = 1, rotY = 0): void {
    const g = unitGeo(`ico${detail}`, () => new THREE.IcosahedronGeometry(1, detail));
    this.geom(mat, g, this.trs(x, y, z, rx, ry, rz, 0, rotY, 0), color);
  }
  /** Smooth half sphere (dome), base at y. */
  dome(mat: Mat, x: number, y: number, z: number, r: number, h: number, color: number): void {
    const g = unitGeo('dome', () => new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2));
    this.geom(mat, g, this.trs(x, y, z, r, h, r), color);
  }
  cone(mat: Mat, x: number, y: number, z: number, r: number, h: number, color: number, segs = 8, rx = 0, ry = 0, rz = 0): void {
    const g = unitGeo(`cone${segs}`, () => new THREE.ConeGeometry(1, 1, segs, 1).translate(0, 0.5, 0));
    this.geom(mat, g, this.trs(x, y, z, r, h, r, rx, ry, rz), color);
  }
  /** Geometry with full local rotation. */
  mesh(mat: Mat, g: THREE.BufferGeometry, x: number, y: number, z: number, color: number, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0): void {
    this.geom(mat, g, this.trs(x, y, z, sx, sy, sz, rx, ry, rz), color);
  }


  /**
   * Raised slab from a closed outline (local x, z points): top polygon + side skirt + a triangle-mesh collider.
   * Used for sidewalks, medians and islands.
   */
  slab(mat: Mat, pts: [number, number][], y0: number, y1: number, topColor: number, sideColor: number, collide = true): void {
    const n = pts.length;
    const contour = pts.map((p) => new THREE.Vector2(p[0], p[1]));
    let area = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[i], c = pts[(i + 1) % n];
      area += a[0] * c[1] - c[0] * a[1];
    }
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const [wx, wz] = this.toWorld(pts[0][0], pts[0][1]);
    const b = this.bucket(mat, wx, wz);
    b.reserve(n, tris.length * 3);
    const [r, g, bl] = rgb(topColor);
    const v0 = b.nv;
    const verts = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const [X, Z] = this.toWorld(pts[i][0], pts[i][1]);
      const o = b.nv * 3;
      b.pos[o] = X; b.pos[o + 1] = this.ty + y1; b.pos[o + 2] = Z;
      b.nrm[o] = 0; b.nrm[o + 1] = 127; b.nrm[o + 2] = 0;
      b.col[o] = r; b.col[o + 1] = g; b.col[o + 2] = bl;
      b.uv[b.nv * 2] = X; b.uv[b.nv * 2 + 1] = Z;
      b.nv++;
      verts[i * 3] = X; verts[i * 3 + 1] = this.ty + y1; verts[i * 3 + 2] = Z;
      verts[(n + i) * 3] = X; verts[(n + i) * 3 + 1] = this.ty + y0; verts[(n + i) * 3 + 2] = Z;
    }
    const idx: number[] = [];
    for (const t of tris) {
      const a = pts[t[0]], bb = pts[t[1]], c = pts[t[2]];
      const up = (bb[1] - a[1]) * (c[0] - a[0]) - (bb[0] - a[0]) * (c[1] - a[1]);
      const order = up >= 0 ? [t[0], t[1], t[2]] : [t[0], t[2], t[1]];
      for (const q of order) { b.idx[b.ni++] = v0 + q; idx.push(q); }
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = area >= 0 ? pts[j] : pts[i], c = area >= 0 ? pts[i] : pts[j];
      this.quad('matte', [a[0], y0, a[1]], [c[0], y0, c[1]], [c[0], y1, c[1]], [a[0], y1, a[1]], sideColor);
      idx.push(i, j, n + j, i, n + j, n + i);
    }
    if (collide) this.trimeshes.push({ vertices: verts, indices: new Uint32Array(idx) });
  }

  /** Solid box for physics (local space). */
  solid(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, yaw = 0): void {
    const [x, z] = this.toWorld(cx, cz);
    this.colliders.push({ x, y: this.ty + cy, z, hx: sx / 2, hy: sy / 2, hz: sz / 2, yaw: this.yaw + yaw });
  }

  /** Bake a three.js object (for example a parked car) into the static batches. */
  bake(obj: THREE.Object3D, x: number, y: number, z: number, yaw: number): void {
    obj.position.set(x, y, z);
    obj.rotation.set(0, yaw, 0);
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      const me = o as THREE.Mesh;
      if (!me.isMesh || me.userData.noBake) return;
      this.geom((me.userData.bucket as Mat) ?? 'gloss', me.geometry, me.matrixWorld, (me.userData.color as number) ?? 0xffffff);
    });
  }

  /** Create the final meshes. */
  build(materials: Record<Mat, THREE.Material>): THREE.Group {
    const group = new THREE.Group();
    group.name = 'city';
    for (const [key, b] of this.buckets) {
      if (b.nv === 0) continue;
      const mat = key.split('|')[0] as Mat;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(b.pos.slice(0, b.nv * 3), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(b.nrm.slice(0, b.nv * 3), 3, true));
      g.setAttribute('color', new THREE.BufferAttribute(b.col.slice(0, b.nv * 3), 3, true));
      if (mat === 'road' || mat === 'pave' || mat === 'atlas') g.setAttribute('uv', new THREE.BufferAttribute(b.uv.slice(0, b.nv * 2), 2));
      g.setIndex(new THREE.BufferAttribute(b.idx.slice(0, b.ni), 1));
      g.computeBoundingSphere();
      g.computeBoundingBox();
      const mesh = new THREE.Mesh(g, materials[mat]);
      mesh.name = key;
      mesh.castShadow = mat !== 'road' && mat !== 'decal' && mat !== 'glow';
      mesh.receiveShadow = mat !== 'glow';
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    this.buckets.clear();
    return group;
  }

  stats(): { vertices: number; triangles: number; buckets: number; byMat: Record<string, number> } {
    let v = 0, t = 0;
    const byMat: Record<string, number> = {};
    for (const [key, b] of this.buckets) {
      v += b.nv; t += b.ni / 3;
      const m = key.split('|')[0];
      byMat[m] = (byMat[m] ?? 0) + Math.round(b.ni / 3000);
    }
    return { vertices: v, triangles: t, buckets: this.buckets.size, byMat };
  }
}
