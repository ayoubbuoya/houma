import * as THREE from 'three';

export interface Look {
  skin: number;
  top: number;
  bottom: number;
  shoes: number;
  hair: number;
  height?: number;
  hood?: boolean;
}

export const PLAYER_LOOK: Look = { skin: 0xc68e62, top: 0x2f4a6b, bottom: 0x2b3a55, shoes: 0xf2f2ee, hair: 0x1a1512, hood: true };

const matCache = new Map<number, THREE.MeshStandardMaterial>();
function mat(color: number): THREE.MeshStandardMaterial {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
    matCache.set(color, m);
  }
  return m;
}

function limb(rTop: number, rBot: number, len: number, color: number): THREE.Mesh {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, 7, 1).translate(0, -len / 2, 0);
  const m = new THREE.Mesh(g, mat(color));
  m.castShadow = true;
  return m;
}

/**
 * Simple low-poly person made in code, animated with a few sine waves.
 * (A code-made rig keeps the art style consistent with the city and needs no downloads.)
 */
export class Character {
  root = new THREE.Group();
  private body = new THREE.Group();
  private torso: THREE.Group;
  private head: THREE.Group;
  private armL: THREE.Group; private armR: THREE.Group;
  private foreL: THREE.Group; private foreR: THREE.Group;
  private legL: THREE.Group; private legR: THREE.Group;
  private shinL: THREE.Group; private shinR: THREE.Group;
  private phase = 0;
  private blend = 0; // 0 idle, 1 walk, 2 run
  private air = 0;
  private t = 0;

  constructor(look: Look = PLAYER_LOOK) {
    const s = look.height ?? 1;
    this.root.add(this.body);
    this.body.scale.setScalar(s);
    const hip = 0.9;
    // torso
    this.torso = new THREE.Group();
    this.torso.position.y = hip;
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.165, 0.56, 8, 1).scale(1, 1, 0.62).translate(0, 0.3, 0), mat(look.top));
    chest.castShadow = true;
    const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.16, 0.2, 8, 1).scale(1, 1, 0.66).translate(0, -0.04, 0), mat(look.bottom));
    pelvis.castShadow = true;
    this.torso.add(chest, pelvis);
    if (look.hood) {
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 6).scale(1.15, 0.8, 1).translate(0, 0.6, -0.07), mat(look.top));
      this.torso.add(hood);
    }
    // head
    this.head = new THREE.Group();
    this.head.position.y = 0.62;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 6), mat(look.skin));
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.108, 10, 8).scale(0.95, 1.12, 1.02).translate(0, 0.16, 0), mat(look.skin));
    skull.castShadow = true;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.114, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.52).scale(0.97, 1.1, 1.06).translate(0, 0.175, -0.012), mat(look.hair));
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.04, 0.03).translate(0, 0.15, 0.11), mat(look.skin));
    this.head.add(neck, skull, hair, nose);
    this.torso.add(this.head);
    // arms
    const arm = (side: number): [THREE.Group, THREE.Group] => {
      const up = new THREE.Group();
      up.position.set(side * 0.235, 0.52, 0);
      up.add(limb(0.058, 0.05, 0.3, look.top));
      const fore = new THREE.Group();
      fore.position.y = -0.29;
      fore.add(limb(0.048, 0.04, 0.26, look.top));
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5).translate(0, -0.29, 0), mat(look.skin));
      fore.add(hand);
      up.add(fore);
      this.torso.add(up);
      return [up, fore];
    };
    [this.armL, this.foreL] = arm(1);
    [this.armR, this.foreR] = arm(-1);
    // legs
    const leg = (side: number): [THREE.Group, THREE.Group] => {
      const th = new THREE.Group();
      th.position.set(side * 0.092, hip - 0.02, 0);
      th.add(limb(0.085, 0.066, 0.44, look.bottom));
      const shin = new THREE.Group();
      shin.position.y = -0.43;
      shin.add(limb(0.064, 0.048, 0.4, look.bottom));
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.085, 0.26).translate(0, -0.42, 0.05), mat(look.shoes));
      shoe.castShadow = true;
      shin.add(shoe);
      th.add(shin);
      this.body.add(th);
      return [th, shin];
    };
    [this.legL, this.shinL] = leg(1);
    [this.legR, this.shinR] = leg(-1);
    this.body.add(this.torso);
  }

  /** speed in m/s, runSpeed = speed where the run animation is full. */
  update(dt: number, speed: number, grounded: boolean, runSpeed = 6.5): void {
    this.t += dt;
    const target = speed < 0.3 ? 0 : speed < runSpeed * 0.62 ? 1 : 2;
    this.blend += (target - this.blend) * Math.min(1, dt * 9);
    this.air += ((grounded ? 0 : 1) - this.air) * Math.min(1, dt * 10);
    const move = Math.min(1, this.blend);
    const run = Math.max(0, this.blend - 1);
    this.phase += dt * (speed * (2.05 - run * 0.55) + 0.001) * 1.55;
    const p = this.phase;
    const A = (0.5 + run * 0.4) * move;
    const sw = Math.sin(p) * A;
    const air = this.air;
    this.legL.rotation.x = -sw * (1 - air) - 0.5 * air;
    this.legR.rotation.x = sw * (1 - air) + 0.15 * air;
    this.shinL.rotation.x = (Math.max(0, Math.sin(p - 1.9)) * (0.9 + run * 0.7) * move + 0.03) * (1 - air) + 0.9 * air;
    this.shinR.rotation.x = (Math.max(0, Math.sin(p - 1.9 + Math.PI)) * (0.9 + run * 0.7) * move + 0.03) * (1 - air) + 0.4 * air;
    const breathe = Math.sin(this.t * 1.7) * 0.02 * (1 - move);
    this.armL.rotation.x = sw * 0.85 + breathe - air * 1.3;
    this.armR.rotation.x = -sw * 0.85 - breathe - air * 1.3;
    this.armL.rotation.z = 0.07 + air * 0.4;
    this.armR.rotation.z = -0.07 - air * 0.4;
    const elbow = -(0.12 + move * 0.25 + run * 0.95);
    this.foreL.rotation.x = elbow - Math.max(0, -sw) * 0.4;
    this.foreR.rotation.x = elbow - Math.max(0, sw) * 0.4;
    this.torso.rotation.x = 0.03 * move + 0.16 * run;
    this.torso.rotation.y = Math.sin(p) * 0.09 * move;
    this.torso.position.y = 0.9 + Math.abs(Math.cos(p)) * (0.018 + run * 0.03) * move + breathe * 0.2;
    this.head.rotation.x = -0.1 * run + breathe;
  }
}
