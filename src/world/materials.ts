import * as THREE from 'three';
import { RNG } from '../core/rng';
import type { Mat } from './builder';
import type { Atlas } from './atlas';

function canvasTex(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, repeatM: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / repeatM, 1 / repeatM); // UVs are in meters
  t.anisotropy = 8;
  return t;
}

function asphaltTexture(): THREE.CanvasTexture {
  return canvasTex(512, (ctx, s) => {
    const rng = new RNG(11);
    ctx.fillStyle = '#b9b9b9';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) {
      const v = 120 + rng.int(0, 110);
      ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
      ctx.fillRect(rng.range(0, s), rng.range(0, s), rng.range(1, 2.6), rng.range(1, 2.6));
    }
    // worn patches and repairs
    for (let i = 0; i < 14; i++) {
      const v = rng.chance(0.5) ? 90 : 215;
      ctx.fillStyle = `rgba(${v},${v},${v},${rng.range(0.05, 0.14)})`;
      ctx.beginPath();
      ctx.ellipse(rng.range(0, s), rng.range(0, s), rng.range(20, 90), rng.range(14, 50), rng.range(0, 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(40,40,40,0.35)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) {
      let x = rng.range(0, s), y = rng.range(0, s);
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 9; k++) {
        x += rng.range(-22, 22);
        y += rng.range(-22, 22);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, 12);
}

function paveTexture(): THREE.CanvasTexture {
  return canvasTex(512, (ctx, s) => {
    const rng = new RNG(23);
    ctx.fillStyle = '#b3aea4';
    ctx.fillRect(0, 0, s, s);
    const n = 8, t = s / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = 204 + rng.int(-9, 10);
        ctx.fillStyle = `rgb(${v},${v - 6},${v - 20})`;
        ctx.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
        if (rng.chance(0.07)) {
          // broken or patched tile
          ctx.fillStyle = 'rgba(120,112,100,0.35)';
          ctx.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
        }
      }
    }
    for (let i = 0; i < 2500; i++) {
      const v = rng.int(120, 240);
      ctx.fillStyle = `rgba(${v},${v},${v},0.25)`;
      ctx.fillRect(rng.range(0, s), rng.range(0, s), 1.5, 1.5);
    }
  }, 3.2);
}

const NOISE_GLSL = /* glsl */ `
  float hHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float hNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hHash(i), hHash(i + vec2(1, 0)), f.x), mix(hHash(i + vec2(0, 1)), hHash(i + vec2(1, 1)), f.x), f.y);
  }`;

/** Adds world position to a standard material and lets us tint the base color with it. */
function patch(mat: THREE.MeshStandardMaterial, fragment: string): void {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\n' + NOISE_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + fragment);
  };
}

export function createMaterials(atlas: Atlas): Record<Mat, THREE.Material> {
  // Plaster walls: dirt and stains near the ground, soft patches, rain streaks under the roof line.
  const wall = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 });
  patch(wall, /* glsl */ `
    {
      float h = vWPos.y;
      vec2 side = vec2(vWPos.x + vWPos.z, vWPos.y);
      float n1 = hNoise(side * 0.55);
      float n2 = hNoise(vec2((vWPos.x - vWPos.z) * 2.3, vWPos.y * 0.25));
      float dirt = smoothstep(1.7 + n1 * 1.2, 0.05, h) * (0.55 + 0.45 * n2);
      float patchy = (hNoise(side * 0.16 + 7.0) - 0.5) * 0.09;
      float streak = smoothstep(0.62, 0.95, n2) * 0.07 * smoothstep(1.0, 4.0, h);
      diffuseColor.rgb *= 1.0 + patchy - streak;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.66, 0.58, 0.47), dirt * 0.6);
    }`);

  const matte = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  const gloss = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.3, envMapIntensity: 1.1 });
  const glass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.07, metalness: 0.9, envMapIntensity: 1.5 });

  const road = new THREE.MeshStandardMaterial({ vertexColors: true, map: asphaltTexture(), roughness: 0.93, metalness: 0 });
  patch(road, /* glsl */ `
    {
      float n = hNoise(vWPos.xz * 0.07) * 0.6 + hNoise(vWPos.xz * 0.31) * 0.4;
      diffuseColor.rgb *= 0.86 + n * 0.3;
    }`);
  const pave = new THREE.MeshStandardMaterial({ vertexColors: true, map: paveTexture(), roughness: 0.9, metalness: 0 });
  patch(pave, /* glsl */ `
    {
      float n = hNoise(vWPos.xz * 0.11) * 0.6 + hNoise(vWPos.xz * 0.9) * 0.4;
      diffuseColor.rgb *= 0.84 + n * 0.3;
    }`);
  const decal = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.88, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  patch(decal, /* glsl */ `
    {
      float n = hNoise(vWPos.xz * 0.9) * 0.5 + hNoise(vWPos.xz * 4.0) * 0.5;
      diffuseColor.rgb *= 0.8 + n * 0.3;
    }`);
  const foliage = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide, flatShading: true });
  const atlasMat = new THREE.MeshStandardMaterial({
    vertexColors: true, map: atlas.texture, roughness: 0.75, metalness: 0, alphaTest: 0.5, side: THREE.DoubleSide,
  });
  const glow = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4 });

  return { wall, matte, gloss, glass, road, decal, pave, foliage, atlas: atlasMat, glow };
}
