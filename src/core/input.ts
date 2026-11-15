/** Keyboard + mouse state. Pointer lock is used for the camera. */
export class Input {
  keys = new Set<string>();
  private pressed = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  locked = false;
  lastMouseMove = 0;

  constructor(private el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (['Space', 'Tab', 'F3'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
      this.lastMouseMove = performance.now();
    });
    window.addEventListener('wheel', (e) => (this.wheel += Math.sign(e.deltaY)), { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.el;
    });
  }

  requestLock(): void {
    const p = this.el.requestPointerLock?.() as unknown;
    if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => {});
  }

  down(code: string): boolean {
    return this.keys.has(code);
  }
  /** True only on the frame the key went down. */
  hit(code: string): boolean {
    return this.pressed.has(code);
  }
  axis(neg: string, pos: string): number {
    return (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0);
  }
  endFrame(): void {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}
