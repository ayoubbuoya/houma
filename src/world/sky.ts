import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { QUALITY, type Quality } from '../data/config';

/** Sky dome, sun light with follow shadows, hemisphere fill, fog and sky reflection map. */
export class SkySystem {
  sky = new Sky();
  sun = new THREE.DirectionalLight(0xffffff, 3);
  hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  sunDir = new THREE.Vector3(0, 1, 0);
  sunColor = new THREE.Color();
  fogColor = new THREE.Color();
  hour = 17.6;
  private pmrem: THREE.PMREMGenerator;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private envScene = new THREE.Scene();
  private envSky = new Sky();
  private shadowRange = 85;
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();

  constructor(private scene: THREE.Scene, private renderer: THREE.WebGLRenderer) {
    this.sky.scale.setScalar(5000);
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    this.envSky.scale.setScalar(5000);
    this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(renderer);

    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.06;
    scene.add(this.sun, this.sun.target, this.hemi);
    scene.fog = new THREE.FogExp2(0xffffff, 0.002);
  }

  setQuality(q: Quality): void {
    const s = QUALITY[q];
    this.shadowRange = s.shadowRange;
    this.sun.shadow.mapSize.set(s.shadowMap, s.shadowMap);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null as any;
    const cam = this.sun.shadow.camera;
    cam.left = -s.shadowRange;
    cam.right = s.shadowRange;
    cam.top = s.shadowRange;
    cam.bottom = -s.shadowRange;
    cam.near = 1;
    cam.far = 420;
    cam.updateProjectionMatrix();
    (this.scene.fog as THREE.FogExp2).density = q === 'low' ? 0.0022 : q === 'medium' ? 0.0015 : 0.0012;
  }

  /** Set the time of day in hours (6 to 19 looks good; golden hour is around 17.5). */
  setTime(hour: number): void {
    this.hour = hour;
    const t = THREE.MathUtils.clamp((hour - 6) / 12.6, 0, 1);
    const elev = THREE.MathUtils.degToRad(Math.max(62 * Math.sin(Math.PI * t), 1.5));
    // Morning sun in the east (+x), evening sun over the sea side (-x, -z).
    const az = THREE.MathUtils.lerp(0.25, Math.PI + 1.62, t);
    this.sunDir.set(Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev)).normalize();

    const low = 1 - THREE.MathUtils.smoothstep(Math.sin(elev), 0.05, 0.55); // 1 near horizon
    this.sunColor.setRGB(1, THREE.MathUtils.lerp(0.96, 0.66, low), THREE.MathUtils.lerp(0.9, 0.38, low));
    this.sun.color.copy(this.sunColor);
    this.sun.intensity = THREE.MathUtils.lerp(2.9, 3.0, low);
    this.hemi.color.setRGB(THREE.MathUtils.lerp(0.85, 1.0, low), THREE.MathUtils.lerp(0.88, 0.86, low), THREE.MathUtils.lerp(1.0, 0.76, low));
    this.hemi.groundColor.setRGB(0.55, THREE.MathUtils.lerp(0.5, 0.42, low), THREE.MathUtils.lerp(0.42, 0.33, low));
    this.hemi.intensity = THREE.MathUtils.lerp(0.85, 0.9, low);

    for (const s of [this.sky, this.envSky]) {
      const u = s.material.uniforms;
      u.turbidity.value = THREE.MathUtils.lerp(2.5, 4.5, low);
      u.rayleigh.value = THREE.MathUtils.lerp(1.2, 2.6, low);
      u.mieCoefficient.value = 0.006;
      u.mieDirectionalG.value = 0.82;
      u.sunPosition.value.copy(this.sunDir);
      if (u.cloudCoverage) {
        u.cloudCoverage.value = 0.26;
        u.cloudDensity.value = 0.45;
        u.cloudElevation.value = 0.55;
      }
    }
    this.fogColor.setRGB(THREE.MathUtils.lerp(0.55, 0.6, low), THREE.MathUtils.lerp(0.66, 0.47, low), THREE.MathUtils.lerp(0.8, 0.38, low));
    (this.scene.fog as THREE.FogExp2).color.copy(this.fogColor);
    this.updateEnvironment();

    // light-space axes for stable shadows
    this.right.crossVectors(new THREE.Vector3(0, 1, 0), this.sunDir).normalize();
    this.up.crossVectors(this.sunDir, this.right).normalize();
  }

  private updateEnvironment(): void {
    this.envSky.material.uniforms.showSunDisc.value = 0;
    const old = this.envTarget;
    this.envTarget = this.pmrem.fromScene(this.envScene, 0, 1, 6000);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = 0.28;
    old?.dispose();
  }

  /** Move the shadow box with the player. Snapped to shadow texels so shadows do not shimmer. */
  update(focus: THREE.Vector3, time: number): void {
    const texel = (this.shadowRange * 2) / this.sun.shadow.mapSize.x;
    const r = Math.round(focus.dot(this.right) / texel) * texel;
    const u = Math.round(focus.dot(this.up) / texel) * texel;
    const d = focus.dot(this.sunDir);
    const t = this.sun.target.position;
    t.set(0, 0, 0).addScaledVector(this.right, r).addScaledVector(this.up, u).addScaledVector(this.sunDir, d);
    this.sun.position.copy(t).addScaledVector(this.sunDir, 200);
    this.sun.target.updateMatrixWorld();
    this.sky.position.copy(focus);
    this.sky.material.uniforms.time.value = time;
  }
}
