import * as THREE from 'three';

interface Bubble {
  el: HTMLDivElement;
  pos: () => THREE.Vector3 | null;
  ttl: number;
}

const _v = new THREE.Vector3();

/** Speech bubbles (Derja lines) that float above people and cars. */
export class Bubbles {
  private list: Bubble[] = [];
  private root: HTMLElement;

  constructor(private cam: THREE.PerspectiveCamera) {
    this.root = document.getElementById('bubbles')!;
  }

  /** pos returns the world position to follow (or null to remove the bubble). */
  say(pos: () => THREE.Vector3 | null, text: string, seconds = 2.6): void {
    if (this.list.length > 10) return;
    const el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = text;
    this.root.appendChild(el);
    this.list.push({ el, pos, ttl: seconds });
  }

  update(dt: number): void {
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      b.ttl -= dt;
      const p = b.pos();
      if (b.ttl <= 0 || !p) {
        b.el.remove();
        this.list.splice(i, 1);
        continue;
      }
      _v.copy(p).project(this.cam);
      const dist = p.distanceTo(this.cam.position);
      const visible = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1 && dist < 55;
      b.el.style.display = visible ? 'block' : 'none';
      if (!visible) continue;
      const scale = THREE.MathUtils.clamp(9 / dist, 0.55, 1.15);
      b.el.style.transform = `translate(-50%, -100%) translate(${((_v.x + 1) / 2) * w}px, ${((1 - _v.y) / 2) * h}px) scale(${scale})`;
      b.el.style.opacity = String(Math.min(1, b.ttl * 3));
    }
  }
}
