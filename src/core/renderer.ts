import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CAMERA, QUALITY, type Quality } from '../data/config';
import { DEBUG } from './debug';

/** Final pass: FXAA + slight color grading + vignette, in one shader to save a pass. */
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    vignette: { value: 0.32 },
    saturation: { value: 1.08 },
    contrast: { value: 1.05 },
    fade: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float vignette, saturation, contrast, fade;
    varying vec2 vUv;
    float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
    void main() {
      vec2 px = 1.0 / resolution;
      // FXAA (compact version)
      vec3 rgbNW = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * px).rgb;
      vec3 rgbNE = texture2D(tDiffuse, vUv + vec2(1.0, -1.0) * px).rgb;
      vec3 rgbSW = texture2D(tDiffuse, vUv + vec2(-1.0, 1.0) * px).rgb;
      vec3 rgbSE = texture2D(tDiffuse, vUv + vec2(1.0, 1.0) * px).rgb;
      vec3 rgbM = texture2D(tDiffuse, vUv).rgb;
      float lNW = luma(rgbNW), lNE = luma(rgbNE), lSW = luma(rgbSW), lSE = luma(rgbSE), lM = luma(rgbM);
      float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
      float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
      vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
      float dirReduce = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
      float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
      dir = clamp(dir * rcp, -8.0, 8.0) * px;
      vec3 a = 0.5 * (texture2D(tDiffuse, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tDiffuse, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
      vec3 b = a * 0.5 + 0.25 * (texture2D(tDiffuse, vUv + dir * -0.5).rgb + texture2D(tDiffuse, vUv + dir * 0.5).rgb);
      float lB = luma(b);
      vec3 col = (lB < lMin || lB > lMax) ? a : b;
      // grading: warm highlights, cool shadows, a bit of contrast and saturation
      float l = luma(col);
      col = mix(vec3(l), col, saturation);
      col = (col - 0.5) * contrast + 0.5;
      col *= mix(vec3(1.0, 0.99, 1.0), vec3(1.04, 1.0, 0.94), smoothstep(0.15, 0.85, l));
      // vignette
      vec2 d = vUv - 0.5;
      col *= 1.0 - vignette * smoothstep(0.25, 0.95, dot(d, d) * 2.2);
      col = mix(col, vec3(0.0), fade);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

export class Gfx {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  finalPass: ShaderPass;
  quality: Quality = 'medium';
  usePost = true;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.72;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.info.autoReset = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = DEBUG.shadow === 'basic' ? THREE.BasicShadowMap : DEBUG.shadow === 'vsm' ? THREE.VSMShadowMap : THREE.PCFShadowMap;
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.15, 900);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.07, 0.45, 2.0);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.finalPass = new ShaderPass(FinalShader);
    this.composer.addPass(this.finalPass);

    window.addEventListener('resize', () => this.resize());
    this.setQuality(this.quality);
  }

  setQuality(q: Quality): void {
    this.quality = q;
    const s = QUALITY[q];
    this.bloom.enabled = s.bloom;
    this.camera.far = s.far;
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, QUALITY[this.quality].pixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    (this.finalPass.uniforms.resolution.value as THREE.Vector2).set(w * pr, h * pr);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** 0 = clear, 1 = black. Used for respawn and enter/exit car. */
  setFade(v: number): void {
    this.finalPass.uniforms.fade.value = v;
  }

  render(): void {
    if (this.usePost) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
