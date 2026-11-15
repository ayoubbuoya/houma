import * as THREE from 'three';
import type { Input } from '../core/input';
import { CAMERA } from '../data/config';
import { RAPIER, type Physics } from '../physics/physics';

const _dir = new THREE.Vector3();
const _want = new THREE.Vector3();

/** Third-person orbit camera. It never goes inside walls: a ray from the target shortens the distance. */
export class FollowCamera {
  yaw = Math.PI;
  pitch = 0.28;
  private dist = CAMERA.footDistance;
  private target = new THREE.Vector3();
  private init = false;

  constructor(private cam: THREE.PerspectiveCamera, private physics: Physics) {}

  snap(): void {
    this.init = false;
  }

  /**
   * focus: point to look at (already interpolated). wantDist: free distance.
   * alignYaw: when set (driving), the camera slowly goes behind the car if the mouse is idle.
   */
  update(dt: number, input: Input, focus: THREE.Vector3, height: number, wantDist: number, alignYaw: number | null, speed: number): void {
    this.yaw -= input.mouseDX * CAMERA.sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch + input.mouseDY * CAMERA.sensitivity, CAMERA.minPitch, CAMERA.maxPitch);
    if (alignYaw !== null && performance.now() - input.lastMouseMove > 1400 && Math.abs(speed) > 1.5) {
      let d = alignYaw + Math.PI - this.yaw + (speed < -1 ? Math.PI : 0);
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * 2.4);
      this.pitch += (0.2 - this.pitch) * Math.min(1, dt * 1.2);
    }
    _want.set(focus.x, focus.y + height, focus.z);
    if (!this.init) {
      this.target.copy(_want);
      this.init = true;
    } else {
      const k = 1 - Math.exp(-dt * 18);
      this.target.x += (_want.x - this.target.x) * k;
      this.target.z += (_want.z - this.target.z) * k;
      this.target.y += (_want.y - this.target.y) * (1 - Math.exp(-dt * 10));
    }
    const cp = Math.cos(this.pitch);
    _dir.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    // collision: only the static city blocks the camera
    let d = wantDist;
    const ray = new RAPIER.Ray(this.target, _dir);
    const hit = this.physics.world.castRay(ray, wantDist + 0.4, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, undefined, (c) => this.physics.isStatic(c));
    if (hit) d = Math.max(0.5, Math.min(wantDist, hit.timeOfImpact - 0.35));
    // go in fast, come back out slowly
    this.dist = d < this.dist ? d : this.dist + (d - this.dist) * Math.min(1, dt * 3.5);
    this.cam.position.copy(this.target).addScaledVector(_dir, this.dist);
    if (this.cam.position.y < 0.25) this.cam.position.y = 0.25;
    this.cam.lookAt(this.target);
  }
}
