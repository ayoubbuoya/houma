import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { GameAudio } from '../../core/audio';
import { bus } from '../../core/events';
import { RNG } from '../../core/rng';
import { TRAFFIC, VEHICLES, type Quality, type VehicleSpec } from '../../data/config';
import { DIALOGUE } from '../../data/dialogue';
import { G_PLAYER, G_VEHICLE, groups, RAPIER, type Physics } from '../../physics/physics';
import type { Bubbles } from '../../ui/bubbles';
import { buildCarModel } from '../../vehicles/carModels';
import type { Vehicle } from '../../vehicles/vehicle';
import type { Atlas } from '../../world/atlas';
import type { CityData } from '../../world/city';
import { LaneGraph, type Path } from './lanes';
import type { TrafficLights } from './lights';

/** What the traffic needs to know about the player each step. */
export interface TrafficContext {
  playerPos: THREE.Vector3;
  playerOnFoot: boolean;
  playerVehicle: Vehicle | null;
  vehicles: Vehicle[];
  camera: THREE.PerspectiveCamera;
}

const _c = new THREE.Color();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _frustum = new THREE.Frustum();
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _s = { x: 0, z: 0, hx: 0, hz: 1 };

const carMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.4, envMapIntensity: 1.2 });
const geoCache = new Map<string, THREE.BufferGeometry>();

/** One merged mesh per AI car (one draw call), with colors stored per vertex. */
function carGeometry(spec: VehicleSpec, color: number, atlas: Atlas): THREE.BufferGeometry {
  const key = spec.kind + color;
  let g = geoCache.get(key);
  if (g) return g;
  const group = buildCarModel(spec, color, atlas, 0, true).group;
  group.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  group.traverse((o) => {
    const me = o as THREE.Mesh;
    if (!me.isMesh || me.userData.bucket === 'atlas') return;
    let p = me.geometry.clone().applyMatrix4(me.matrixWorld);
    if (p.index) p = p.toNonIndexed();
    p.deleteAttribute('uv');
    _c.setHex(me.userData.bucket === 'glow' ? 0xfff6dc : (me.userData.color as number));
    const n = p.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([_c.r, _c.g, _c.b], i * 3);
    p.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(p);
  });
  g = mergeGeometries(parts, false);
  geoCache.set(key, g);
  return g;
}

class Agent {
  static nextId = 1;
  id = Agent.nextId++;
  mesh: THREE.Mesh;
  body: RAPIER.RigidBody;
  s = 0;
  v = 0;
  next: Path | null = null;
  x = 0; z = 0; yaw = 0;
  px = 0; pz = 0; pyaw = 0;
  desire = 1;
  blocked = 0; // seconds standing still because of a car or the player
  honkIn = 0;
  stun = 0;
  taxiStop = 0;
  blocker: Agent | null = null;
  blockedByPlayer = false;
  enterTime = 0;
  dead = false;
  why = '';
  halfLen: number;
  halfWid: number;

  constructor(public spec: VehicleSpec, public path: Path, mesh: THREE.Mesh, body: RAPIER.RigidBody) {
    this.mesh = mesh;
    this.body = body;
    this.halfLen = spec.length / 2;
    this.halfWid = spec.width / 2;
  }
}

/**
 * AI traffic: cars follow lane paths, keep distance, stop at red lights,
 * give way at roundabouts and plain intersections, and honk when blocked.
 */
export class TrafficSystem {
  lanes: LaneGraph;
  agents: Agent[] = [];
  private inNode = new Map<number, Set<Agent>>();
  private rng = new RNG(4242);
  private target = TRAFFIC.count.medium;
  private spawnTimer = 0;
  private time = 0;
  stats = { honks: 0, crashes: 0, spawned: 0, despawned: 0, stuckRemoved: 0, overlapSteps: 0, minPair: 99 };
  enabled = true;

  constructor(
    private city: CityData, private physics: Physics, private scene: THREE.Scene, private atlas: Atlas,
    private lights: TrafficLights, private audio: GameAudio, private bubbles: Bubbles,
  ) {
    this.lanes = new LaneGraph(city.graph);
  }

  setQuality(q: Quality): void {
    this.target = TRAFFIC.count[q];
  }

  /** Turn traffic on or off. Turning it off removes every AI car. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) {
      for (const a of this.agents) this.remove(a);
      this.agents = [];
    } else this.time = 0;
  }

  // ---------------------------------------------------------------- spawning
  private pickSpec(): VehicleSpec {
    let r = this.rng.next();
    for (const [kind, share] of TRAFFIC.mix) {
      if (r < share) return VEHICLES[kind];
      r -= share;
    }
    return VEHICLES.hatch;
  }

  private trySpawn(ctx: TrafficContext, initial: boolean): boolean {
    const lane = this.rng.pick(this.lanes.lanes);
    if (lane.length < 24) return false;
    const s = this.rng.range(8, lane.length - 12);
    this.lanes.sample(lane, s, _s);
    const d = Math.hypot(_s.x - ctx.playerPos.x, _s.z - ctx.playerPos.z);
    if (d > TRAFFIC.spawnMax || d < (initial ? 30 : TRAFFIC.spawnMin)) return false;
    if (!initial && d < 170 && _frustum.containsPoint(_v.set(_s.x, 1, _s.z))) return false;
    for (const a of this.agents) if (Math.hypot(a.x - _s.x, a.z - _s.z) < 16) return false;
    for (const v of ctx.vehicles) if (Math.hypot(v.pos.x - _s.x, v.pos.z - _s.z) < 10) return false;

    const spec = this.pickSpec();
    const color = this.rng.pick(spec.colors);
    const mesh = new THREE.Mesh(carGeometry(spec, color, this.atlas), carMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    const body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(_s.x, 0, _s.z));
    this.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(spec.width / 2, spec.height / 2 - 0.1, spec.length / 2).setTranslation(0, spec.height / 2 + 0.1, 0)
        .setCollisionGroups(groups(G_VEHICLE, G_VEHICLE | G_PLAYER)).setFriction(0.4),
      body,
    );
    const a = new Agent(spec, lane, mesh, body);
    a.s = s;
    a.x = a.px = _s.x;
    a.z = a.pz = _s.z;
    a.yaw = a.pyaw = Math.atan2(_s.hx, _s.hz);
    a.desire = this.rng.range(0.78, 1.05) * (spec.kind === 'louage' ? 1.08 : spec.kind === 'pickup' ? 0.85 : 1);
    a.v = lane.speed * 0.6;
    a.next = this.chooseNext(lane);
    this.agents.push(a);
    this.stats.spawned++;
    return true;
  }

  private remove(a: Agent): void {
    a.dead = true;
    this.scene.remove(a.mesh);
    this.physics.world.removeRigidBody(a.body);
    for (const set of this.inNode.values()) set.delete(a);
    this.stats.despawned++;
  }

  private chooseNext(lane: Path): Path | null {
    if (!lane.outs.length) return null;
    // most drivers go straight
    const straight = lane.outs.filter((id) => this.lanes.paths[id].turn === 0);
    if (straight.length && this.rng.chance(0.55)) return this.lanes.paths[this.rng.pick(straight)];
    return this.lanes.paths[this.rng.pick(lane.outs)];
  }

  // ---------------------------------------------------------------- rules at the end of a lane
  private occupants(node: number): Set<Agent> {
    let s = this.inNode.get(node);
    if (!s) {
      s = new Set();
      this.inNode.set(node, s);
    }
    return s;
  }

  private canEnter(a: Agent, stopDist: number): boolean {
    const lane = a.path, conn = a.next!;
    const node = this.city.graph.nodes[lane.node];
    const target = this.lanes.paths[conn.outs[0]];
    // room on the other side?
    for (const o of this.agents) if (o.path === target && o.s - o.halfLen < 6.5 && o.v < 2) return false;
    const occ = this.occupants(node.id);
    if (node.kind === 'roundabout') {
      // give way to cars already on the ring near our merge point
      const mx = conn.pts[2], mz = conn.pts[3];
      for (const o of occ) if (Math.hypot(o.x - mx, o.z - mz) < 12.5) return false;
      return true;
    }
    if (node.lights) {
      const st = this.lights.state(node.id, lane.ns);
      if (st === 'red') return false;
      if (st === 'yellow' && stopDist > (a.v * a.v) / (2 * TRAFFIC.hardBrake * 0.7)) return false;
      if (conn.turn === -1) {
        // left turn: wait for cars coming the other way
        for (const o of this.agents) {
          if (o === a) continue;
          if (o.path.kind === 'lane' && o.path.node === node.id && o.path.ns === lane.ns && o.path.edge !== lane.edge && o.path.length - o.s < 24 && o.next && o.next.turn !== -1 && o.v > 1) return false;
          if (o.path.kind === 'turn' && o.path.node === node.id && o.path.edge !== lane.edge && o.path.turn === 0) return false;
        }
      }
      // do not enter while cross traffic is still clearing the box
      const me = this.city.graph.edges[lane.edge];
      for (const o of occ) {
        const oe = this.city.graph.edges[o.path.edge];
        if (Math.abs(oe.dx * me.dx + oe.dz * me.dz) < 0.5) return false;
      }
      return true;
    }
    // plain intersection: one street at a time, first come first served
    for (const o of occ) if (o.path.edge !== lane.edge) return false;
    return true;
  }

  /** Distance (from our front bumper) to the first thing in our way, looking along our path. */
  private probe(a: Agent, ctx: TrafficContext, look: number): number {
    a.blocker = null;
    a.blockedByPlayer = false;
    let path = a.path, s = a.s, next = a.next;
    const reach = a.halfWid + 0.25;
    for (let d = a.halfLen + 0.6; d < a.halfLen + look; d += 1.8) {
      let ps = s + d, p = path;
      // walk into the next paths if needed
      let hop: Path | null = next;
      while (ps > p.length) {
        if (!hop) return d - a.halfLen + 30;
        ps -= p.length;
        p = hop;
        hop = p.kind === 'lane' ? null : this.lanes.paths[p.outs[0]];
      }
      this.lanes.sample(p, ps, _s);
      const sx = _s.x, sz = _s.z;
      for (const o of this.agents) {
        if (o === a) continue;
        const dx = o.x - sx, dz = o.z - sz;
        if (dx * dx + dz * dz > 30) continue;
        const fx = Math.sin(o.yaw), fz = Math.cos(o.yaw), off = o.halfLen * 0.5;
        const r = o.halfWid + reach;
        if (Math.hypot(dx + fx * off, dz + fz * off) < r || Math.hypot(dx - fx * off, dz - fz * off) < r) {
          // two cars waiting for each other: the one already in the crossing (or the older one) goes first
          if (o.blocker === a && d > a.halfLen + 2.6) {
            const mine = a.path.kind !== 'lane', theirs = o.path.kind !== 'lane';
            if ((mine && !theirs) || (mine === theirs && a.id < o.id)) continue;
          }
          a.blocker = o;
          return d - a.halfLen - 0.9;
        }
      }
      for (const v of ctx.vehicles) {
        const dx = v.pos.x - sx, dz = v.pos.z - sz;
        if (dx * dx + dz * dz > 30) continue;
        const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), off = v.spec.length * 0.25;
        const r = v.spec.width / 2 + reach;
        if (Math.hypot(dx + fx * off, dz + fz * off) < r || Math.hypot(dx - fx * off, dz - fz * off) < r) {
          a.blockedByPlayer = true;
          return d - a.halfLen - 0.9;
        }
      }
      if (ctx.playerOnFoot && Math.hypot(ctx.playerPos.x - sx, ctx.playerPos.z - sz) < reach + 0.55) {
        a.blockedByPlayer = true;
        return d - a.halfLen - 0.5;
      }
    }
    return Infinity;
  }

  // ---------------------------------------------------------------- update
  fixedUpdate(dt: number, ctx: TrafficContext): void {
    if (!this.enabled) return;
    this.time += dt;
    _frustum.setFromProjectionMatrix(_m.multiplyMatrices(ctx.camera.projectionMatrix, ctx.camera.matrixWorldInverse));
    // spawn
    this.spawnTimer -= dt;
    if (this.agents.length < this.target && this.spawnTimer <= 0) {
      const initial = this.time < 1.5;
      for (let i = 0; i < (initial ? 80 : 24); i++) if (this.trySpawn(ctx, initial) && !initial) break;
      this.spawnTimer = initial ? 0 : 0.4;
    }

    for (const a of this.agents) {
      a.px = a.x; a.pz = a.z; a.pyaw = a.yaw;
      const dPlayer = Math.hypot(a.x - ctx.playerPos.x, a.z - ctx.playerPos.z);
      if (dPlayer > TRAFFIC.despawn) { this.remove(a); continue; }
      if (a.stun > 0) {
        a.stun -= dt;
        a.v = 0;
        continue;
      }
      const lane = a.path.kind === 'lane';
      const toEnd = a.path.length - a.s;
      let vmax = a.path.speed * a.desire;
      let stop = Infinity;
      let waitingForCar = false;
      a.why = '';

      if (lane && a.next) {
        // slow down for the turn or the roundabout ahead
        vmax = Math.min(vmax, Math.sqrt(a.next.speed * a.next.speed + 2 * 1.8 * Math.max(0, toEnd - 2)));
        if (toEnd < 32) {
          const lineDist = toEnd - 0.4;
          if (!this.canEnter(a, lineDist)) { stop = lineDist; a.why = 'enter'; }
        }
      }
      // taxis sometimes stop to pick someone up
      if (a.spec.kind === 'taxi' && lane) {
        if (a.taxiStop > 0) {
          a.taxiStop -= dt;
          stop = 0;
        } else if (toEnd > 30 && a.s > 20 && a.v > 4 && this.rng.chance(dt * 0.012)) a.taxiStop = this.rng.range(3, 5.5);
      }
      const gap = this.probe(a, ctx, THREE.MathUtils.clamp(a.v * 2.4 + 7, 9, 34));
      if (gap - TRAFFIC.minGap < stop) {
        stop = gap - TRAFFIC.minGap;
        waitingForCar = true;
        a.why = a.blockedByPlayer ? 'player' : 'car';
      }

      const vt = stop === Infinity ? vmax : Math.min(vmax, Math.sqrt(2 * TRAFFIC.brake * Math.max(0, stop)));
      if (vt < a.v) {
        const need = stop > 0.05 ? (a.v * a.v) / (2 * stop) : TRAFFIC.hardBrake;
        a.v = Math.max(vt, a.v - Math.min(TRAFFIC.hardBrake, Math.max(TRAFFIC.brake, need)) * dt);
      } else a.v = Math.min(vt, a.v + TRAFFIC.accel * dt);
      if (stop <= 0.02) a.v = 0;

      // move along the path
      a.s += a.v * dt;
      while (a.s >= a.path.length) {
        const from = a.path;
        if (!a.next) { this.remove(a); break; }
        a.s -= from.length;
        a.path = a.next;
        if (from.kind === 'lane') {
          this.occupants(a.path.node).add(a);
          a.enterTime = this.time;
          a.next = this.lanes.paths[a.path.outs[0]];
        } else {
          this.occupants(from.node).delete(a);
          a.next = this.chooseNext(a.path);
        }
      }
      if (a.dead) continue;
      this.lanes.sample(a.path, a.s, _s);
      a.x = _s.x;
      a.z = _s.z;
      // look a little ahead so the car turns smoothly
      let hx = _s.hx, hz = _s.hz;
      if (a.path.kind !== 'lane' || toEnd < 3) {
        const ahead = a.s + 2.2;
        if (ahead < a.path.length) this.lanes.sample(a.path, ahead, _s);
        else if (a.next) this.lanes.sample(a.next, ahead - a.path.length, _s);
        const lx = _s.x - a.x, lz = _s.z - a.z, l = Math.hypot(lx, lz);
        if (l > 0.5) { hx = lx / l; hz = lz / l; }
      }
      let dy = Math.atan2(hx, hz) - a.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      a.yaw += dy * Math.min(1, dt * 7);

      // blocked: honk (very important in Tunisia)
      if (a.v < 0.3 && waitingForCar && a.taxiStop <= 0) {
        a.blocked += dt;
        if (a.blocked > TRAFFIC.honkAfter) {
          a.honkIn -= dt;
          if (a.honkIn <= 0) {
            a.honkIn = this.rng.range(2.5, 6);
            this.stats.honks++;
            this.audio.beep(dPlayer, a.spec.kind === 'louage' || a.spec.kind === 'pickup' ? 0.8 : this.rng.range(0.92, 1.12));
            bus.emit('traffic:honk', { x: a.x, z: a.z });
            if (a.blockedByPlayer && dPlayer < 30 && this.rng.chance(0.5)) this.say(a, this.rng.pick(DIALOGUE.honked_at));
          }
        }
        // a jam that the player cannot see: remove the car so traffic never locks up for good
        if (a.blocked > (a.blockedByPlayer ? 45 : 22) && (dPlayer > 70 || !_frustum.containsPoint(_v.set(a.x, 1, a.z)))) {
          this.stats.stuckRemoved++;
          this.remove(a);
          continue;
        }
      } else if (a.v > 1) a.blocked = 0;

      // the player crashed into us
      const pv = ctx.playerVehicle;
      if (pv && dPlayer < 8 && Math.abs(pv.speed) > 2.2) {
        const dx = pv.pos.x - a.x, dz = pv.pos.z - a.z;
        const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw);
        const lz = dx * fx + dz * fz, lx = dx * fz - dz * fx;
        if (Math.abs(lz) < a.halfLen + pv.spec.length / 2 + 0.25 && Math.abs(lx) < a.halfWid + pv.spec.width / 2 + 0.2) {
          a.stun = 4.5;
          a.v = 0;
          this.stats.crashes++;
          this.say(a, this.rng.pick(DIALOGUE.crash_driver), 3.2);
          this.audio.beep(dPlayer, 1);
          bus.emit('traffic:crash', { x: a.x, z: a.z, policeCar: a.spec.kind === 'police' });
        }
      }
    }
    if (this.agents.some((a) => a.dead)) this.agents = this.agents.filter((a) => !a.dead);
    for (const a of this.agents) {
      _q.setFromAxisAngle(_up, a.yaw);
      a.body.setNextKinematicTranslation({ x: a.x, y: 0, z: a.z });
      a.body.setNextKinematicRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
    }
    this.measure();
  }

  private say(a: Agent, text: string, seconds = 2.4): void {
    const p = new THREE.Vector3();
    this.bubbles.say(() => (a.dead ? null : p.set(a.mesh.position.x, a.spec.height + 0.5, a.mesh.position.z)), text, seconds);
  }

  /** Test numbers: do cars overlap? */
  private measure(): void {
    let overlap = false;
    for (let i = 0; i < this.agents.length; i++) {
      for (let j = i + 1; j < this.agents.length; j++) {
        const a = this.agents[i], b = this.agents[j];
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d < this.stats.minPair) this.stats.minPair = d;
        if (d < 1.9) overlap = true;
      }
    }
    if (overlap) this.stats.overlapSteps++;
  }

  frame(alpha: number): void {
    for (const a of this.agents) {
      a.mesh.position.set(a.px + (a.x - a.px) * alpha, 0, a.pz + (a.z - a.pz) * alpha);
      let dy = a.yaw - a.pyaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      a.mesh.rotation.y = a.pyaw + dy * alpha;
    }
  }

  report(): Record<string, number> {
    const n = this.agents.length;
    return {
      count: n,
      moving: this.agents.filter((a) => a.v > 1).length,
      stuck: this.agents.filter((a) => a.blocked > 20).length,
      avgKmh: n ? (this.agents.reduce((s, a) => s + a.v, 0) / n) * 3.6 : 0,
      onRing: this.agents.filter((a) => a.path.kind === 'ring').length,
      ...this.stats,
    };
  }
}
