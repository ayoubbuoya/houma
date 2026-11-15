import * as THREE from 'three';
import type { SkySystem } from './sky';

export const SEA_LEVEL = -0.8;

/** Animated sea with sun glitter. One big plane on the corniche side (north, -z). */
export class Sea {
  mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene, shoreZ: number) {
    this.mat = new THREE.ShaderMaterial({
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uSunDir: { value: new THREE.Vector3(0, 1, 0) },
          uSunColor: { value: new THREE.Color(1, 0.8, 0.6) },
          uSky: { value: new THREE.Color(0.25, 0.45, 0.8) },
          uHorizon: { value: new THREE.Color(0.9, 0.7, 0.5) },
          uDeep: { value: new THREE.Color(0.01, 0.09, 0.16) },
          uShallow: { value: new THREE.Color(0.05, 0.42, 0.44) },
          uShoreZ: { value: shoreZ },
        },
      ]),
      vertexShader: /* glsl */ `
        varying vec3 vW;
        #include <fog_pars_vertex>
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vec4 mvPosition = viewMatrix * w;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uShoreZ;
        uniform vec3 uSunDir, uSunColor, uSky, uHorizon, uDeep, uShallow;
        varying vec3 vW;
        #include <fog_pars_fragment>
        vec2 wave(vec2 p, vec2 d, float f, float sp, float amp) {
          float ph = dot(p, d) * f + uTime * sp;
          return d * cos(ph) * amp * f;
        }
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
        }
        void main() {
          vec2 p = vW.xz;
          float dist = length(cameraPosition - vW);
          float detail = 1.0 / (1.0 + dist * 0.012);
          vec2 g = vec2(0.0);
          g += wave(p, normalize(vec2(0.3, 1.0)), 0.09, 0.9, 0.35);
          g += wave(p, normalize(vec2(-0.6, 0.8)), 0.17, 1.2, 0.2);
          g += wave(p, normalize(vec2(0.9, 0.4)), 0.41, 1.7, 0.07);
          g += wave(p, normalize(vec2(-0.2, 1.0)), 0.93, 2.3, 0.035) * detail;
          g += (vec2(noise(p * 1.7 + uTime * 0.4), noise(p * 1.7 - uTime * 0.35 + 9.0)) - 0.5) * 0.22 * detail;
          vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
          vec3 V = normalize(cameraPosition - vW);
          float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
          vec3 R = reflect(-V, n);
          R.y = abs(R.y);
          vec3 skyRefl = mix(uHorizon, uSky, pow(clamp(R.y, 0.0, 1.0), 0.55));
          float sd = max(dot(R, uSunDir), 0.0);
          float spec = pow(sd, 380.0) * 9.0 + pow(sd, 40.0) * 0.5;
          float shore = smoothstep(55.0, 0.0, uShoreZ - vW.z);
          vec3 base = mix(uDeep, uShallow, shore * 0.85);
          vec3 col = mix(base, skyRefl, fres) + uSunColor * spec;
          // soft foam bands that move toward the beach
          float fz = uShoreZ - vW.z;
          float band = sin(fz * 0.9 - uTime * 1.3 + noise(p * 0.35) * 5.0);
          float foam = smoothstep(0.78, 1.0, band) * smoothstep(13.0, 1.0, fz) + smoothstep(1.6, 0.0, fz + noise(p * 0.8 + uTime * 0.3) * 1.2);
          col = mix(col, vec3(0.92, 0.9, 0.86), clamp(foam, 0.0, 1.0) * 0.8);
          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }`,
    });
    const geo = new THREE.PlaneGeometry(4000, 2000);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.set(0, SEA_LEVEL, shoreZ - 1000 + 6);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.updateMatrix();
    scene.add(this.mesh);
  }

  update(time: number, sky: SkySystem): void {
    const u = this.mat.uniforms;
    u.uTime.value = time;
    u.uSunDir.value.copy(sky.sunDir);
    u.uSunColor.value.copy(sky.sunColor).multiplyScalar(2.2);
    u.uHorizon.value.copy(sky.fogColor);
  }
}
