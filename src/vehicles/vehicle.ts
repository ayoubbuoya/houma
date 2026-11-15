import * as THREE from 'three';
import type { VehicleSpec } from '../data/config';
import { G_PLAYER, G_STATIC, G_VEHICLE, groups, RAPIER, type Physics } from '../physics/physics';
import type { Atlas } from '../world/atlas';
import { buildCarModel, type CarModel } from './carModels';

export interface Controls {
  throttle: number; // -1..1
  steer: number; // -1 (right) .. 1 (left)
  handbrake: boolean;
}

const H0 = 0.5; // body origin height above the ground when the car rests
const REST = 0.3;
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fw = new THREE.Vector3();

/** A drivable car: Rapier raycast vehicle with arcade tuning. */
export class Vehicle {
  body: RAPIER.RigidBody;
  ctrl: RAPIER.DynamicRayCastVehicleController;
  model: CarModel;
  root = new THREE.Group();
  pos = new THREE.Vector3();
  quat = new THREE.Quaternion();
  private prevPos = new THREE.Vector3();
  private prevQuat = new THREE.Quaternion();
  speed = 0; // m/s, forward positive
  private steer = 0;
  private spin = 0;
  private flipped = 0;
  private connY: number;
  occupied = false;
  yaw = 0;

  constructor(public spec: VehicleSpec, color: number, atlas: Atlas, private physics: Physics, scene: THREE.Scene, x: number, z: number, yaw: number, variant = 0) {
    const w = physics.world;
    this.model = buildCarModel(spec, color, atlas, variant);
    this.model.group.position.y = -H0;
    this.root.add(this.model.group);
    scene.add(this.root);

    const L = spec.length, W = spec.width, H = spec.height;
    const m = spec.mass, hh = 0.9;
    _q.setFromAxisAngle(_v.set(0, 1, 0), yaw);
    this.body = w.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, H0 + 0.05, z)
        .setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w })
        .setLinearDamping(0.04)
        .setAngularDamping(0.9)
        .setCanSleep(true)
        .setAdditionalMassProperties(
          m, { x: 0, y: -0.28, z: 0 },
          { x: (m / 12) * (hh * hh + L * L) * 1.2, y: (m / 12) * (W * W + L * L) * 1.1, z: (m / 12) * (W * W + hh * hh) * 3 },
          { x: 0, y: 0, z: 0, w: 1 },
        ),
    );
    const g = groups(G_VEHICLE, G_STATIC | G_VEHICLE | G_PLAYER);
    w.createCollider(RAPIER.ColliderDesc.cuboid(W / 2, 0.3, L / 2 - 0.04).setTranslation(0, 0.18, 0).setDensity(0).setFriction(0.35).setRestitution(0.1).setCollisionGroups(g), this.body);
    const cabH = Math.max(0.2, (H - 0.95) / 2);
    w.createCollider(RAPIER.ColliderDesc.cuboid(W / 2 - 0.12, cabH, L * 0.28).setTranslation(0, 0.48 + cabH, -L * 0.06).setDensity(0).setFriction(0.3).setCollisionGroups(g), this.body);

    this.ctrl = w.createVehicleController(this.body);
    this.ctrl.indexUpAxis = 1;
    this.ctrl.setIndexForwardAxis = 2;
    const k = spec.suspension;
    this.connY = spec.wheelRadius - H0 + (REST - 14 / (4 * k));
    const wx = W / 2 - 0.11, zf = spec.wheelBase / 2 + 0.06, zr = -spec.wheelBase / 2 + 0.06;
    for (const [px, pz] of [[wx, zf], [-wx, zf], [wx, zr], [-wx, zr]]) {
      this.ctrl.addWheel({ x: px, y: this.connY, z: pz }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, REST, spec.wheelRadius);
    }
    for (let i = 0; i < 4; i++) {
      this.ctrl.setWheelSuspensionStiffness(i, k);
      this.ctrl.setWheelSuspensionCompression(i, 0.7 * Math.sqrt(k));
      this.ctrl.setWheelSuspensionRelaxation(i, 1.0 * Math.sqrt(k));
      this.ctrl.setWheelMaxSuspensionTravel(i, 0.28);
      this.ctrl.setWheelMaxSuspensionForce(i, m * 60);
      this.ctrl.setWheelFrictionSlip(i, spec.grip);
      this.ctrl.setWheelSideFrictionStiffness(i, 1);
    }
    this.sample();
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
  }

  private sample(): void {
    const t = this.body.translation(), r = this.body.rotation();
    this.pos.set(t.x, t.y, t.z);
    this.quat.set(r.x, r.y, r.z, r.w);
  }

  /** Call before the physics step. */
  fixedUpdate(dt: number, c: Controls | null): void {
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
    const spec = this.spec;
    const lv = this.body.linvel();
    _fw.set(0, 0, 1).applyQuaternion(this.quat);
    _up.set(0, 1, 0).applyQuaternion(this.quat);
    this.speed = lv.x * _fw.x + lv.y * _fw.y + lv.z * _fw.z;
    this.yaw = Math.atan2(_fw.x, _fw.z);
    const kmh = Math.abs(this.speed) * 3.6;

    const full = (spec.mass * spec.brakeForce) / 4; // per wheel
    let engine = 0, brake = full * 0.02, steerT = 0, hand = false;
    if (c) {
      hand = c.handbrake;
      steerT = c.steer;
      if (c.throttle > 0) {
        if (this.speed < -1) brake = full;
        else engine = spec.engineForce * c.throttle * Math.max(0, 1 - Math.pow(kmh / spec.maxSpeed, 2.2)) * (kmh < 30 ? 1.25 : 1);
        if (engine) brake = 0;
      } else if (c.throttle < 0) {
        if (this.speed > 1) brake = full;
        else { engine = -spec.engineForce * 0.6 * Math.max(0, 1 - kmh / 35); brake = 0; }
      }
      this.body.wakeUp();
    } else if (!this.occupied) brake = full * (kmh < 3 ? 0.6 : 0.15); // parked: keep it in place
    // steering gets smaller with speed so the car stays easy to control
    const maxSteer = spec.maxSteer * (0.28 + 0.72 / (1 + Math.pow(kmh / 55, 1.7)));
    const rate = steerT === 0 ? 6.5 : 4.2;
    this.steer += THREE.MathUtils.clamp(steerT * maxSteer - this.steer, -rate * dt, rate * dt);
    for (let i = 0; i < 4; i++) {
      const rear = i >= 2;
      this.ctrl.setWheelEngineForce(i, engine / 4);
      this.ctrl.setWheelBrake(i, rear && hand ? full * 1.5 : brake * (rear ? 0.7 : 1));
      this.ctrl.setWheelSteering(i, rear ? 0 : this.steer);
      this.ctrl.setWheelFrictionSlip(i, rear && hand ? spec.grip * 0.42 : rear ? spec.grip * 0.96 : spec.grip);
    }
    this.ctrl.updateVehicle(dt, undefined, groups(G_VEHICLE, G_STATIC), (col) => col.parent()?.handle !== this.body.handle);

    // arcade helpers: a little downforce, and never stay on the roof
    let contacts = 0;
    for (let i = 0; i < 4; i++) if (this.ctrl.wheelIsInContact(i)) contacts++;
    if (contacts >= 3) this.body.applyImpulse({ x: -_up.x * kmh * 1.2 * dt * spec.mass * 0.02, y: -_up.y * kmh * 1.2 * dt * spec.mass * 0.02, z: -_up.z * kmh * 1.2 * dt * spec.mass * 0.02 }, false);
    if (_up.y < 0.35 && Math.abs(this.speed) < 3) this.flipped += dt;
    else this.flipped = 0;
    if (this.flipped > 3) this.reset();
    if (this.pos.y < -15 || !Number.isFinite(this.pos.y)) this.reset(true);
    this.spin += (this.speed / spec.wheelRadius) * dt;
  }

  /** Call after the physics step. */
  afterStep(): void {
    this.sample();
  }

  /** Put the car back on its wheels (R key, or automatic after 3 seconds upside down). */
  reset(toRoad = false): void {
    const t = this.body.translation();
    _q.setFromAxisAngle(_v.set(0, 1, 0), this.yaw);
    this.body.setTranslation({ x: t.x, y: toRoad ? 1.2 : Math.max(t.y, 0) + 1.0, z: t.z }, true);
    this.body.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.flipped = 0;
  }

  /** Move the car somewhere else (tests, missions, respawn). */
  place(x: number, z: number, yaw: number): void {
    _q.setFromAxisAngle(_v.set(0, 1, 0), yaw);
    this.body.setTranslation({ x, y: H0 + 0.1, z }, true);
    this.body.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.sample();
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
    this.yaw = yaw;
  }

  /** Interpolate for rendering and move the wheels. */
  frame(alpha: number): void {
    this.root.position.lerpVectors(this.prevPos, this.pos, alpha);
    this.root.quaternion.slerpQuaternions(this.prevQuat, this.quat, alpha);
    for (let i = 0; i < 4; i++) {
      const p = this.model.wheels[i];
      const len = this.ctrl.wheelSuspensionLength(i) ?? REST;
      p.position.y = this.connY - len + H0;
      p.rotation.set(this.spin, i < 2 ? this.steer : 0, 0, 'YXZ');
    }
  }

  get kmh(): number {
    return Math.abs(this.speed) * 3.6;
  }

  /** World position next to the driver door (left side) or the other side. */
  doorPoint(side: 1 | -1, out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(side * (this.spec.width / 2 + 0.75), 0, 0.2).applyQuaternion(this.quat).add(this.pos);
  }
}
