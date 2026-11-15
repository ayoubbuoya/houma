import * as THREE from 'three';
import { TRAFFIC, WORLD } from '../../data/config';
import type { CityData } from '../../world/city';

export type LightColor = 'green' | 'yellow' | 'red';

/**
 * Traffic lights on the boulevard crossings. Each crossing cycles:
 * north-south green -> yellow -> all red -> east-west green -> yellow -> all red.
 */
export class TrafficLights {
  private mesh: THREE.InstancedMesh;
  private poles: { node: number; ns: boolean }[] = [];
  private offsets = new Map<number, number>();
  private last: string[] = [];
  private col = new THREE.Color();
  time = 0;

  constructor(city: CityData, scene: THREE.Scene) {
    const lights = city.trafficLights;
    const geo = new THREE.CircleGeometry(0.115, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, lights.length * 3);
    this.mesh.frustumCulled = false;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    lights.forEach((l, i) => {
      this.poles.push({ node: l.node, ns: l.ns });
      if (!this.offsets.has(l.node)) this.offsets.set(l.node, (this.offsets.size * 7.3) % this.cycle());
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), l.yaw);
      for (let k = 0; k < 3; k++) {
        p.set(0, WORLD.curb + 4.05 - k * 0.3, 0.16).applyQuaternion(q);
        p.x += l.x;
        p.z += l.z;
        m.compose(p, q, s);
        this.mesh.setMatrixAt(i * 3 + k, m);
        this.mesh.setColorAt(i * 3 + k, this.col.setRGB(0.05, 0.05, 0.05));
      }
    });
    scene.add(this.mesh);
  }

  private cycle(): number {
    const t = TRAFFIC.lights;
    return t.greenNS + t.greenEW + 2 * (t.yellow + t.allRed);
  }

  /** Color seen by a driver coming along a north-south (ns) or east-west street at this node. */
  state(node: number, ns: boolean): LightColor {
    const t = TRAFFIC.lights;
    const off = this.offsets.get(node);
    if (off === undefined) return 'green';
    let x = (this.time + off) % this.cycle();
    if (x < t.greenNS) return ns ? 'green' : 'red';
    x -= t.greenNS;
    if (x < t.yellow) return ns ? 'yellow' : 'red';
    x -= t.yellow + t.allRed;
    if (x < 0) return 'red';
    if (x < t.greenEW) return ns ? 'red' : 'green';
    x -= t.greenEW;
    if (x < t.yellow) return ns ? 'red' : 'yellow';
    return 'red';
  }

  update(dt: number): void {
    this.time += dt;
    let changed = false;
    this.poles.forEach((pole, i) => {
      const st = this.state(pole.node, pole.ns);
      if (this.last[i] === st) return;
      this.last[i] = st;
      changed = true;
      // bright values above 1 so the lamps glow with the bloom pass
      this.mesh.setColorAt(i * 3, st === 'red' ? this.col.setRGB(4, 0.25, 0.15) : this.col.setRGB(0.12, 0.02, 0.02));
      this.mesh.setColorAt(i * 3 + 1, st === 'yellow' ? this.col.setRGB(3.6, 2.2, 0.2) : this.col.setRGB(0.1, 0.07, 0.01));
      this.mesh.setColorAt(i * 3 + 2, st === 'green' ? this.col.setRGB(0.2, 3.4, 0.9) : this.col.setRGB(0.01, 0.09, 0.03));
    });
    if (changed && this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
