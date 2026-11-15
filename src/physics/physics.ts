import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { PHYSICS } from '../data/config';
import type { BoxCollider } from '../world/builder';

export { RAPIER };

/** Collision groups: membership in the high 16 bits, filter in the low 16 bits. */
export const G_STATIC = 0x0001, G_PLAYER = 0x0002, G_VEHICLE = 0x0004;
export const groups = (member: number, filter: number): number => (member << 16) | filter;

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

export class Physics {
  world!: RAPIER.World;
  staticBody!: RAPIER.RigidBody;

  static async create(): Promise<Physics> {
    await RAPIER.init();
    const p = new Physics();
    p.world = new RAPIER.World({ x: 0, y: -14, z: 0 });
    p.world.timestep = PHYSICS.step;
    p.staticBody = p.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    return p;
  }

  /** All static city colliders go on one fixed body. */
  addStatic(boxes: BoxCollider[], trimeshes: { vertices: Float32Array; indices: Uint32Array }[]): void {
    const g = groups(G_STATIC, 0xffff);
    for (const c of boxes) {
      _q.setFromEuler(_e.set(c.pitch ?? 0, c.yaw, 0, 'YXZ'));
      const d = RAPIER.ColliderDesc.cuboid(c.hx, c.hy, c.hz)
        .setTranslation(c.x, c.y, c.z)
        .setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w })
        .setCollisionGroups(g)
        .setFriction(0.9);
      this.world.createCollider(d, this.staticBody);
    }
    for (const t of trimeshes) {
      const d = RAPIER.ColliderDesc.trimesh(t.vertices, t.indices).setCollisionGroups(g).setFriction(0.9);
      this.world.createCollider(d, this.staticBody);
    }
  }

  step(): void {
    this.world.step();
  }

  /** True when the collider belongs to the static city. */
  isStatic(c: RAPIER.Collider): boolean {
    return c.parent()?.handle === this.staticBody.handle;
  }
}
