import * as THREE from 'three';
import type { Input } from '../core/input';
import { PLAYER } from '../data/config';
import { G_PLAYER, G_STATIC, G_VEHICLE, groups, RAPIER, type Physics } from '../physics/physics';
import { Character } from './character';

/** The player on foot: Rapier kinematic character controller + code-made character model. */
export class Player {
  character = new Character();
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  private ctrl: RAPIER.KinematicCharacterController;
  pos = new THREE.Vector3();
  private prev = new THREE.Vector3();
  render = new THREE.Vector3();
  yaw = 0;
  vy = 0;
  grounded = true;
  speed = 0;
  health = 100;
  inVehicle = false;
  private airTime = 0;
  readonly feet = PLAYER.halfHeight + PLAYER.radius;

  constructor(private physics: Physics, scene: THREE.Scene) {
    const w = physics.world;
    this.body = w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.collider = w.createCollider(
      RAPIER.ColliderDesc.capsule(PLAYER.halfHeight, PLAYER.radius).setCollisionGroups(groups(G_PLAYER, G_STATIC | G_VEHICLE)),
      this.body,
    );
    this.ctrl = w.createCharacterController(0.03);
    this.ctrl.enableAutostep(0.42, 0.15, false);
    this.ctrl.enableSnapToGround(0.35);
    this.ctrl.setMaxSlopeClimbAngle((52 * Math.PI) / 180);
    this.ctrl.setMinSlopeSlideAngle((40 * Math.PI) / 180);
    this.ctrl.setApplyImpulsesToDynamicBodies(true);
    this.ctrl.setCharacterMass(75);
    scene.add(this.character.root);
  }

  /** Place the player with feet at (x, y, z). */
  teleport(x: number, y: number, z: number, yaw = this.yaw): void {
    this.pos.set(x, y + this.feet + 0.05, z);
    this.prev.copy(this.pos);
    this.body.setTranslation(this.pos, true);
    this.body.setNextKinematicTranslation(this.pos);
    this.yaw = yaw;
    this.vy = 0;
  }

  setEnabled(on: boolean): void {
    this.collider.setEnabled(on);
    this.character.root.visible = on;
    this.inVehicle = !on;
  }

  /** One fixed physics step. camYaw is the camera orbit angle. */
  fixedUpdate(dt: number, input: Input | null, camYaw: number): void {
    this.prev.copy(this.pos);
    if (this.inVehicle) return;
    let wx = 0, wz = 0, run = false, jump = false;
    if (input) {
      const f = input.axis('KeyS', 'KeyW'), r = input.axis('KeyA', 'KeyD');
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
      wx = fx * f + -fz * r;
      wz = fz * f + fx * r;
      const l = Math.hypot(wx, wz);
      if (l > 0) { wx /= l; wz /= l; }
      run = input.down('ShiftLeft') || input.down('ShiftRight');
      jump = input.down('Space');
    }
    const target = (wx || wz) ? (run ? PLAYER.runSpeed : PLAYER.walkSpeed) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * (target > this.speed ? 7 : 12));
    if (wx || wz) {
      let d = Math.atan2(wx, wz) - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * 11);
    }
    if (this.grounded) {
      this.airTime = 0;
      this.vy = jump ? PLAYER.jumpSpeed : -2;
    } else {
      this.airTime += dt;
      this.vy = Math.max(this.vy - PLAYER.gravity * dt, -40);
    }
    const dirx = (wx || wz) ? wx : Math.sin(this.yaw), dirz = (wx || wz) ? wz : Math.cos(this.yaw);
    const desired = { x: dirx * this.speed * dt, y: this.vy * dt, z: dirz * this.speed * dt };
    this.ctrl.computeColliderMovement(this.collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, groups(G_PLAYER, G_STATIC | G_VEHICLE));
    const m = this.ctrl.computedMovement();
    this.grounded = this.ctrl.computedGrounded();
    if (this.vy > 0 && m.y < desired.y * 0.5) this.vy = 0; // hit a ceiling
    this.pos.x += m.x; this.pos.y += m.y; this.pos.z += m.z;
    if (this.grounded) {
      // never sink into the ground: lift the capsule back if the feet are below the surface
      const hit = this.physics.world.castRay(new RAPIER.Ray(this.pos, { x: 0, y: -1, z: 0 }), this.feet + 0.2, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.collider, undefined, (c) => this.physics.isStatic(c));
      if (hit) {
        const groundY = this.pos.y - hit.timeOfImpact;
        if (this.pos.y - this.feet < groundY + 0.02) this.pos.y = groundY + this.feet + 0.02;
      }
    }
    if (!Number.isFinite(this.pos.x + this.pos.y + this.pos.z)) this.pos.copy(this.prev);
    this.body.setNextKinematicTranslation(this.pos);
  }

  /** Interpolated position for rendering. Returns the feet position. */
  frame(alpha: number, dt: number): void {
    this.render.lerpVectors(this.prev, this.pos, alpha);
    if (this.inVehicle) return;
    const r = this.character.root;
    r.position.set(this.render.x, this.render.y - this.feet, this.render.z);
    r.rotation.y = this.yaw;
    this.character.update(dt, this.speed, this.grounded || this.airTime < 0.12, PLAYER.runSpeed);
  }

  get feetY(): number {
    return this.pos.y - this.feet;
  }
}
