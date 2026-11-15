import type { District } from '../world/roadGraph';

const ZONES: Record<District, [string, string]> = {
  downtown: ['Centre-Ville', 'وسط المدينة'],
  medina: ['Medina', 'المدينة العتيقة'],
  houma: ['El Houma', 'الحومة'],
  corniche: ['La Corniche', 'الكورنيش'],
  louage: ['Station Louage', 'محطة اللواج'],
  civic: ['Jardin Public', 'الحديقة العمومية'],
  edge: ['Banlieue', 'الضاحية'],
  beach: ['La Plage', 'الشاطئ'],
  fuel: ['Station Service', 'محطة بنزين'],
};

const $ = (id: string) => document.getElementById(id)!;

/** DOM overlay: prompts, speedometer, district name, FPS counter. */
export class Hud {
  private fps = $('fps');
  private zone = $('zone');
  private prompt = $('prompt');
  private speedo = $('speedo');
  private speedV = this.speedo.querySelector('.v') as HTMLElement;
  private speedN = this.speedo.querySelector('.n') as HTMLElement;
  private lastZone: District | null = null;
  private zoneTimer = 0;
  private lastPrompt = '';
  private frames = 0;
  private acc = 0;
  showFps = false;

  toggleFps(): void {
    this.showFps = !this.showFps;
    this.fps.style.display = this.showFps ? 'block' : 'none';
  }

  setZone(d: District): void {
    if (d === this.lastZone) return;
    this.lastZone = d;
    this.zone.innerHTML = `${ZONES[d][0]}<small>${ZONES[d][1]}</small>`;
    this.zone.style.opacity = '1';
    this.zoneTimer = 3.5;
  }

  setPrompt(key: string, text: string): void {
    const s = key ? `<b>${key}</b>${text}` : '';
    if (s === this.lastPrompt) return;
    this.lastPrompt = s;
    if (s) this.prompt.innerHTML = s;
    this.prompt.style.opacity = s ? '1' : '0';
  }

  setSpeed(kmh: number | null, name = ''): void {
    this.speedo.style.opacity = kmh === null ? '0' : '1';
    if (kmh !== null) {
      this.speedV.textContent = String(Math.round(kmh));
      this.speedN.textContent = name;
    }
  }

  update(dt: number, info: () => string): void {
    if (this.zoneTimer > 0) {
      this.zoneTimer -= dt;
      if (this.zoneTimer <= 0) this.zone.style.opacity = '0';
    }
    this.frames++;
    this.acc += dt;
    if (this.acc >= 0.5) {
      if (this.showFps) this.fps.textContent = `${Math.round(this.frames / this.acc)} FPS\n${info()}`;
      this.frames = 0;
      this.acc = 0;
    }
  }
}
