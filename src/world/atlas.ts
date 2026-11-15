import * as THREE from 'three';
import { RNG } from '../core/rng';

/**
 * One big canvas texture with all shop signs (Arabic + French), doors, railings, carpets and plates.
 * Kit pieces ask for a UV rectangle by name.
 */
export type UV = [number, number, number, number];

interface SignDef {
  kind: string;
  fr: string;
  ar: string;
  bg: string;
  fg: string;
}

const SIGNS: SignDef[] = [
  { kind: 'cafe', fr: 'Café El Houma', ar: 'مقهى الحومة', bg: '#7a2e22', fg: '#f6e7c8' },
  { kind: 'cafe', fr: 'Café des Amis', ar: 'مقهى الأصدقاء', bg: '#1f4d3a', fg: '#f3ead2' },
  { kind: 'cafe', fr: 'Café Jasmin', ar: 'مقهى الياسمين', bg: '#f4f0e4', fg: '#1f6fb5' },
  { kind: 'cafe', fr: 'Salon de Thé Yasmine', ar: 'قاعة شاي ياسمين', bg: '#2b2b33', fg: '#e8c36a' },
  { kind: 'cafe', fr: 'Café de la Corniche', ar: 'مقهى الكورنيش', bg: '#1f6fb5', fg: '#ffffff' },
  { kind: 'hanout', fr: 'Hanout Am Salah', ar: 'حانوت عم صالح', bg: '#f2e9d0', fg: '#b8322a' },
  { kind: 'hanout', fr: 'Alimentation Générale', ar: 'مواد غذائية', bg: '#c8202a', fg: '#ffffff' },
  { kind: 'hanout', fr: 'Épicerie El Baraka', ar: 'عطرية البركة', bg: '#2f8a57', fg: '#fff8e0' },
  { kind: 'hanout', fr: 'Hanout El Houma', ar: 'حانوت الحومة', bg: '#f6f2e6', fg: '#1f4f8f' },
  { kind: 'bakery', fr: 'Boulangerie', ar: 'مخبزة', bg: '#e8c36a', fg: '#5a3212' },
  { kind: 'bakery', fr: 'Pâtisserie Ennour', ar: 'مرطبات النور', bg: '#f3d9df', fg: '#8a2848' },
  { kind: 'barber', fr: 'Coiffeur', ar: 'حلاق', bg: '#20324f', fg: '#ffffff' },
  { kind: 'pharmacy', fr: 'Pharmacie', ar: 'صيدلية', bg: '#ffffff', fg: '#1d8a45' },
  { kind: 'shop', fr: 'Taxiphone', ar: 'تاكسيفون', bg: '#1f4f9f', fg: '#ffe14a' },
  { kind: 'shop', fr: 'Fruits Secs', ar: 'فواكه جافة', bg: '#5a3212', fg: '#f6e7c8' },
  { kind: 'food', fr: 'Lablabi', ar: 'لبلابي', bg: '#d98a1f', fg: '#ffffff' },
  { kind: 'food', fr: 'Fricassé & Kafteji', ar: 'فريكاسي وكفتاجي', bg: '#b8322a', fg: '#fff3c8' },
  { kind: 'fish', fr: 'Restaurant du Port', ar: 'مطعم الميناء', bg: '#f4f0e4', fg: '#1f6fb5' },
  { kind: 'shop', fr: 'Boucherie', ar: 'جزار', bg: '#8a1d1d', fg: '#ffffff' },
  { kind: 'shop', fr: 'Quincaillerie', ar: 'خردوات', bg: '#3a4a3f', fg: '#f2e9d0' },
  { kind: 'shop', fr: 'Tabac  Journaux', ar: 'تبغ وجرائد', bg: '#f2e9d0', fg: '#2b2b33' },
  { kind: 'shop', fr: 'Librairie', ar: 'مكتبة', bg: '#27506b', fg: '#f6f2e6' },
  { kind: 'hotel', fr: 'Hôtel Corniche', ar: 'نزل الكورنيش', bg: '#f6f2e6', fg: '#1f6fb5' },
  { kind: 'shop', fr: 'Bijouterie', ar: 'مصوغ', bg: '#15151a', fg: '#e8c36a' },
  { kind: 'shop', fr: 'Prêt-à-porter', ar: 'ملابس جاهزة', bg: '#6a2f6a', fg: '#ffffff' },
  { kind: 'police', fr: 'Police', ar: 'شرطة', bg: '#1f3f8f', fg: '#ffffff' },
  { kind: 'louage', fr: 'Station Louage', ar: 'محطة اللواج', bg: '#c8202a', fg: '#ffffff' },
  { kind: 'dest', fr: 'Tunis', ar: 'تونس', bg: '#ffffff', fg: '#c8202a' },
  { kind: 'dest', fr: 'Sousse', ar: 'سوسة', bg: '#ffffff', fg: '#c8202a' },
  { kind: 'dest', fr: 'Sfax', ar: 'صفاقس', bg: '#ffffff', fg: '#c8202a' },
  { kind: 'dest', fr: 'Bizerte', ar: 'بنزرت', bg: '#ffffff', fg: '#c8202a' },
  { kind: 'dest', fr: 'Nabeul', ar: 'نابل', bg: '#ffffff', fg: '#c8202a' },
  { kind: 'dest', fr: 'Kairouan', ar: 'القيروان', bg: '#ffffff', fg: '#c8202a' },
  { kind: 'fuel', fr: 'Station Service', ar: 'محطة بنزين', bg: '#156a4a', fg: '#ffd94a' },
  { kind: 'garage', fr: 'Mécanicien', ar: 'ميكانيكي', bg: '#2b2b33', fg: '#ffd94a' },
  { kind: 'souk', fr: 'Souk', ar: 'سوق', bg: '#e9dcc0', fg: '#7a2e22' },
  { kind: 'taxi', fr: 'TAXI', ar: '', bg: '#15151a', fg: '#ffd94a' },
  { kind: 'louagetop', fr: 'LOUAGE', ar: 'لواج', bg: '#ffffff', fg: '#15151a' },
  { kind: 'plate', fr: '147', ar: 'تونس', bg: '#111111', fg: '#ffffff' },
  { kind: 'plate', fr: '203', ar: 'تونس', bg: '#111111', fg: '#ffffff' },
];

const SIZE = 2048;
const SIGN_W = 512, SIGN_H = 128;

export class Atlas {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  private map = new Map<string, UV>();
  private kinds = new Map<string, string[]>();
  arabicOk = true;

  constructor(seed: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE;
    const ctx = this.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const rng = new RNG(seed ^ 0x51a7);

    // --- signs: 4 columns x 10 rows
    SIGNS.forEach((s, i) => {
      const x = (i % 4) * SIGN_W, y = Math.floor(i / 4) * SIGN_H;
      this.drawSign(ctx, s, x, y, i);
      const name = `sign${i}`;
      this.reg(name, x, y, SIGN_W, SIGN_H);
      const list = this.kinds.get(s.kind) ?? [];
      list.push(name);
      this.kinds.set(s.kind, list);
    });

    // --- doors: 16 x (128 x 256) at y = 1280
    const doorColors = ['#1f6fb5', '#2a7fc4', '#1a5e9c', '#1f6fb5', '#2577bd', '#1f6fb5', '#3a86c8', '#1a5e9c',
      '#2f8a57', '#27774a', '#d9a520', '#c9951a', '#1f6fb5', '#7a5230', '#2f8a57', '#8a5a34'];
    doorColors.forEach((c, i) => {
      this.drawDoor(ctx, i * 128, 1280, c, i, rng);
      this.reg(`door${i}`, i * 128, 1280, 128, 256);
    });

    // --- 256 x 256 tiles at y = 1536 and 1792
    const tile = (i: number): [number, number] => [(i % 8) * 256, 1536 + Math.floor(i / 8) * 256];
    let t = 0;
    {
      const [x, y] = tile(t++);
      this.drawRailing(ctx, x, y);
      this.reg('railing', x, y, 256, 256);
    }
    {
      const [x, y] = tile(t++);
      this.drawGrille(ctx, x, y);
      this.reg('grille', x, y, 256, 256);
    }
    {
      const [x, y] = tile(t++);
      this.drawClock(ctx, x, y);
      this.reg('clock', x, y, 256, 256);
    }
    for (let k = 0; k < 4; k++) {
      const [x, y] = tile(t++);
      this.drawCarpet(ctx, x, y, rng);
      this.reg(`carpet${k}`, x, y, 256, 256);
    }
    {
      const [x, y] = tile(t++);
      this.drawTiles(ctx, x, y);
      this.reg('zellige', x, y, 256, 256);
    }
    {
      const [x, y] = tile(t++);
      this.drawShutter(ctx, x, y);
      this.reg('rollshutter', x, y, 256, 256);
    }
    {
      const [x, y] = tile(t++);
      this.drawLattice(ctx, x, y);
      this.reg('lattice', x, y, 256, 256);
    }
    {
      const [x, y] = tile(t++);
      this.drawFlag(ctx, x, y);
      this.reg('flag', x, y + 43, 256, 170);
    }
    {
      const [x, y] = tile(t++);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 256, 256);
      this.reg('white', x + 8, y + 8, 240, 240);
    }

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.texture.generateMipmaps = true;
  }

  private reg(name: string, x: number, y: number, w: number, h: number): void {
    const pad = 1.5;
    this.map.set(name, [(x + pad) / SIZE, 1 - (y + h - pad) / SIZE, (x + w - pad) / SIZE, 1 - (y + pad) / SIZE]);
  }

  uv(name: string): UV {
    const v = this.map.get(name);
    if (!v) throw new Error('atlas: unknown ' + name);
    return v;
  }
  /** Random sign of a kind (cafe, hanout, bakery, shop, ...). */
  sign(kind: string, rng: RNG): UV {
    const list = this.kinds.get(kind) ?? this.kinds.get('shop')!;
    return this.uv(rng.pick(list));
  }
  door(rng: RNG): UV {
    return this.uv('door' + rng.int(0, 15));
  }

  private fitText(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxW: number): number {
    let s = size;
    do {
      ctx.font = `${weight} ${s}px Cairo, "DejaVu Sans", sans-serif`;
      if (ctx.measureText(text).width <= maxW) break;
      s -= 2;
    } while (s > 10);
    return s;
  }

  private drawSign(ctx: CanvasRenderingContext2D, s: SignDef, x: number, y: number, i: number): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, SIGN_W, SIGN_H);
    ctx.clip();
    ctx.fillStyle = s.bg;
    ctx.fillRect(x, y, SIGN_W, SIGN_H);
    // subtle sun-faded gradient and dirt so signs do not look brand new
    const g = ctx.createLinearGradient(x, y, x, y + SIGN_H);
    g.addColorStop(0, 'rgba(255,255,255,0.10)');
    g.addColorStop(1, 'rgba(0,0,0,0.14)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, SIGN_W, SIGN_H);
    ctx.strokeStyle = s.fg;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 5;
    ctx.strokeRect(x + 9, y + 9, SIGN_W - 18, SIGN_H - 18);
    ctx.globalAlpha = 1;
    ctx.fillStyle = s.fg;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const cx = x + SIGN_W / 2;
    if (s.kind === 'plate') {
      this.fitText(ctx, s.fr, 700, 84, 150);
      ctx.fillText(String(100 + ((i * 37) % 120)), x + 96, y + 68);
      ctx.direction = 'rtl';
      this.fitText(ctx, s.ar, 700, 70, 150);
      ctx.fillText(s.ar, cx, y + 60);
      ctx.direction = 'ltr';
      this.fitText(ctx, '0000', 700, 84, 170);
      ctx.fillText(String(1000 + ((i * 2731) % 8999)), x + SIGN_W - 110, y + 68);
    } else if (!s.ar) {
      this.fitText(ctx, s.fr, 700, 96, SIGN_W - 60);
      ctx.fillText(s.fr, cx, y + SIGN_H / 2 + 4);
    } else if (s.kind === 'dest' || s.kind === 'louagetop') {
      this.fitText(ctx, s.fr, 700, 60, SIGN_W / 2 - 40);
      ctx.fillText(s.fr, x + SIGN_W * 0.27, y + SIGN_H / 2 + 4);
      ctx.direction = 'rtl';
      this.fitText(ctx, s.ar, 700, 64, SIGN_W / 2 - 40);
      ctx.fillText(s.ar, x + SIGN_W * 0.73, y + SIGN_H / 2);
      ctx.direction = 'ltr';
    } else {
      ctx.direction = 'rtl';
      this.fitText(ctx, s.ar, 700, 54, SIGN_W - 50);
      ctx.fillText(s.ar, cx, y + 42);
      ctx.direction = 'ltr';
      this.fitText(ctx, s.fr, 700, 36, SIGN_W - 50);
      ctx.fillText(s.fr, cx, y + 92);
    }
    ctx.restore();
  }

  private drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, i: number, rng: RNG): void {
    const W = 128, H = 256;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, W, H);
    ctx.clip();
    // stone frame
    const stone = i % 3 === 0 ? '#e9e2d0' : '#d8c193';
    ctx.fillStyle = stone;
    ctx.fillRect(x, y, W, H);
    ctx.fillStyle = 'rgba(90,60,20,0.18)';
    for (let k = 0; k < 9; k++) ctx.fillRect(x, y + k * 30 + 14, W, 2);
    // arch
    const archTop = 30, r = 44, cx = x + W / 2;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(cx - r, y + H);
      ctx.lineTo(cx - r, y + archTop + r);
      ctx.arc(cx, y + archTop + r, r, Math.PI, 0);
      ctx.lineTo(cx + r, y + H);
      ctx.closePath();
    };
    // striped arch stones (black and white) on some doors
    if (i % 2 === 0) {
      for (let k = 0; k < 9; k++) {
        const a0 = Math.PI + (k / 9) * Math.PI, a1 = Math.PI + ((k + 1) / 9) * Math.PI;
        ctx.beginPath();
        ctx.arc(cx, y + archTop + r, r + 12, a0, a1);
        ctx.arc(cx, y + archTop + r, r, a1, a0, true);
        ctx.closePath();
        ctx.fillStyle = k % 2 ? '#2a2a2a' : '#f2efe6';
        ctx.fill();
      }
    }
    path();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.save();
    path();
    ctx.clip();
    const g = ctx.createLinearGradient(x, y, x + W, y);
    g.addColorStop(0, 'rgba(0,0,0,0.22)');
    g.addColorStop(0.2, 'rgba(0,0,0,0)');
    g.addColorStop(0.8, 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, W, H);
    // plank lines
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    for (let k = 1; k < 6; k++) {
      ctx.beginPath();
      ctx.moveTo(cx - r + (k * 2 * r) / 6, y);
      ctx.lineTo(cx - r + (k * 2 * r) / 6, y + H);
      ctx.stroke();
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.moveTo(cx, y + archTop);
    ctx.lineTo(cx, y + H);
    ctx.stroke();
    // studs in classic patterns
    const stud = (px: number, py: number) => {
      ctx.fillStyle = '#16161a';
      ctx.beginPath();
      ctx.arc(px, py, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(px - 0.7, py - 0.7, 0.8, 0, Math.PI * 2);
      ctx.fill();
    };
    const pattern = i % 4;
    for (const side of [-1, 1]) {
      const mx = cx + side * (r / 2);
      for (let k = 0; k < 14; k++) {
        stud(mx - 16, y + 92 + k * 11);
        stud(mx + 16, y + 92 + k * 11);
      }
      for (let k = 0; k < 4; k++) {
        stud(mx - 16 + k * 10.6, y + 92);
        stud(mx - 16 + k * 10.6, y + 235);
      }
      if (pattern === 0 || pattern === 2) {
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          stud(mx + Math.cos(a) * 9, y + 130 + Math.sin(a) * 9);
          stud(mx + Math.cos(a) * 9, y + 198 + Math.sin(a) * 9);
        }
      }
      if (pattern === 1 || pattern === 2) {
        for (let k = -3; k <= 3; k++) {
          stud(mx + k * 3.2, y + 164 - (3 - Math.abs(k)) * 5);
          stud(mx + k * 3.2, y + 164 + (3 - Math.abs(k)) * 5);
        }
      }
      if (pattern === 3) {
        for (let k = 0; k < 9; k++) {
          const a = Math.PI * 0.2 + (k / 8) * Math.PI * 1.6;
          stud(mx + Math.cos(a) * 10 * side, y + 150 + Math.sin(a) * 10);
          stud(mx, y + 180 + k * 5);
        }
      }
      // arch studs
      for (let k = 1; k < 8; k++) {
        const a = Math.PI + (k / 8) * Math.PI;
        stud(cx + Math.cos(a) * (r - 8), y + archTop + r + Math.sin(a) * (r - 8));
      }
      // knocker
      ctx.strokeStyle = '#16161a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx + side * 9, y + 160, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2;
    path();
    ctx.stroke();
    // dirt at the bottom
    const d = ctx.createLinearGradient(x, y + H - 50, x, y + H);
    d.addColorStop(0, 'rgba(70,50,30,0)');
    d.addColorStop(1, 'rgba(70,50,30,0.4)');
    ctx.fillStyle = d;
    ctx.fillRect(x, y + H - 50, W, 50);
    void rng;
    ctx.restore();
  }

  /** Wrought iron balcony railing (transparent background, tiles along x). */
  private drawRailing(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#1b1c20';
    ctx.lineCap = 'round';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(0, 10); ctx.lineTo(256, 10);
    ctx.moveTo(0, 246); ctx.lineTo(256, 246);
    ctx.stroke();
    ctx.lineWidth = 7;
    for (let k = 0; k < 4; k++) {
      const cx = 32 + k * 64;
      ctx.beginPath();
      ctx.moveTo(cx - 32, 10); ctx.lineTo(cx - 32, 246);
      ctx.stroke();
      ctx.lineWidth = 6;
      // S curls
      ctx.beginPath();
      ctx.arc(cx, 80, 22, Math.PI * 0.5, Math.PI * 2.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, 176, 22, Math.PI * 1.5, Math.PI * 3.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, 102); ctx.lineTo(cx, 154);
      ctx.stroke();
      ctx.lineWidth = 7;
    }
    ctx.restore();
  }

  /** Bulging window grille (the classic blue "barreaudage"). White so it can be tinted. */
  private drawGrille(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 9;
    ctx.strokeRect(6, 6, 244, 244);
    ctx.lineWidth = 7;
    for (let k = 1; k < 6; k++) {
      ctx.beginPath();
      ctx.moveTo(k * 42.6, 6); ctx.lineTo(k * 42.6, 250);
      ctx.stroke();
    }
    for (const yy of [64, 128, 192]) {
      ctx.beginPath();
      ctx.moveTo(6, yy); ctx.lineTo(250, yy);
      ctx.stroke();
    }
    ctx.lineWidth = 5;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.arc(21 + k * 42.6, 128, 13, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Wooden lattice (mashrabiya). White so it can be tinted blue. */
  private drawLattice(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, 256, 256);
    ctx.clip();
    ctx.translate(x, y);
    ctx.fillStyle = '#39424d';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 9;
    for (let k = -8; k < 16; k++) {
      ctx.beginPath();
      ctx.moveTo(k * 32, 0); ctx.lineTo(k * 32 + 256, 256);
      ctx.moveTo(k * 32 + 256, 0); ctx.lineTo(k * 32, 256);
      ctx.stroke();
    }
    ctx.lineWidth = 16;
    ctx.strokeRect(0, 0, 256, 256);
    ctx.restore();
  }

  private drawClock(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x + 128, y + 128);
    ctx.fillStyle = '#e9dcc0';
    ctx.fillRect(-128, -128, 256, 256);
    ctx.fillStyle = '#f8f4e8';
    ctx.beginPath();
    ctx.arc(0, 0, 112, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a2420';
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.lineWidth = 6;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 88, Math.sin(a) * 88);
      ctx.lineTo(Math.cos(a) * 102, Math.sin(a) * 102);
      ctx.stroke();
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(42, -38); // about 5:40 pm
    ctx.stroke();
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-70, 40);
    ctx.stroke();
    ctx.restore();
  }

  private drawCarpet(ctx: CanvasRenderingContext2D, x: number, y: number, rng: RNG): void {
    const pal = rng.pick([
      ['#8a1d1d', '#e8c36a', '#1f3f6f', '#f2e9d0'],
      ['#1f4f8f', '#f2e9d0', '#b8322a', '#e8c36a'],
      ['#b8322a', '#15151a', '#f2e9d0', '#2f8a57'],
      ['#7a3a1a', '#e9dcc0', '#1f6f6f', '#b8322a'],
    ]);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, 256, 256);
    ctx.clip();
    ctx.translate(x, y);
    ctx.fillStyle = pal[0];
    ctx.fillRect(0, 0, 256, 256);
    ctx.lineWidth = 8;
    ctx.strokeStyle = pal[1];
    ctx.strokeRect(12, 12, 232, 232);
    ctx.strokeStyle = pal[2];
    ctx.strokeRect(26, 26, 204, 204);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        const cx = 64 + c * 64, cy = 52 + r * 50;
        ctx.fillStyle = pal[1 + ((r + c) % 3)];
        ctx.beginPath();
        ctx.moveTo(cx, cy - 20); ctx.lineTo(cx + 24, cy); ctx.lineTo(cx, cy + 20); ctx.lineTo(cx - 24, cy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = pal[0];
        ctx.beginPath();
        ctx.moveTo(cx, cy - 8); ctx.lineTo(cx + 10, cy); ctx.lineTo(cx, cy + 8); ctx.lineTo(cx - 10, cy);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** Blue and white ceramic tiles. */
  private drawTiles(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#f4f1e6';
    ctx.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const cx = 32 + c * 64, cy = 32 + r * 64;
        ctx.strokeStyle = '#1f5fa5';
        ctx.lineWidth = 4;
        ctx.strokeRect(cx - 30, cy - 30, 60, 60);
        ctx.fillStyle = '#1f6fb5';
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 9, 4, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#e0b02a';
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** Flag of Tunisia. */
  private drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y + 43);
    ctx.fillStyle = '#e70013';
    ctx.fillRect(0, 0, 256, 170);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(128, 85, 43, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e70013';
    ctx.beginPath();
    ctx.arc(128, 85, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(136, 85, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e70013';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI + (i * 4 * Math.PI) / 5;
      const px = 139 + Math.cos(a) * 19, py = 85 + Math.sin(a) * 19;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Metal rolling shutter of a closed shop. */
  private drawShutter(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#9aa0a3';
    ctx.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 20; k++) {
      const g = ctx.createLinearGradient(0, k * 12.8, 0, (k + 1) * 12.8);
      g.addColorStop(0, 'rgba(255,255,255,0.25)');
      g.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = g;
      ctx.fillRect(0, k * 12.8, 256, 12.8);
    }
    const d = ctx.createLinearGradient(0, 150, 0, 256);
    d.addColorStop(0, 'rgba(60,40,20,0)');
    d.addColorStop(1, 'rgba(60,40,20,0.4)');
    ctx.fillStyle = d;
    ctx.fillRect(0, 0, 256, 256);
    ctx.restore();
  }
}
