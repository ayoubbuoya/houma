import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/latin-700.css';
import '@fontsource/cairo/latin-400.css';
import '@fontsource/cairo/arabic-400.css';
import RAPIER_NS from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { TrafficLights } from './ai/traffic/lights';
import { TrafficSystem } from './ai/traffic/traffic';
import { GameAudio } from './core/audio';
import { DEBUG, DEBUG_CAMS } from './core/debug';
import { Input } from './core/input';
import { Gfx } from './core/renderer';
import { CAMERA, PHYSICS, PLAYER, VEHICLES, WORLD, type Quality } from './data/config';
import { Physics } from './physics/physics';
import { FollowCamera } from './player/camera';
import { Player } from './player/player';
import { Bubbles } from './ui/bubbles';
import { Hud } from './ui/hud';
import { Vehicle, type Controls } from './vehicles/vehicle';
import { Atlas } from './world/atlas';
import { buildCity, type CityData } from './world/city';
import { createMaterials } from './world/materials';
import { districtAt } from './world/roadGraph';
import { Sea } from './world/sea';
import { SkySystem } from './world/sky';

const $ = (id: string) => document.getElementById(id)!;

class Game {
  gfx!: Gfx;
  input!: Input;
  physics!: Physics;
  sky!: SkySystem;
  sea!: Sea;
  city!: CityData;
  player!: Player;
  cam!: FollowCamera;
  hud = new Hud();
  audio = new GameAudio();
  paused = false;
  vehicles: Vehicle[] = [];
  lights!: TrafficLights;
  traffic!: TrafficSystem;
  bubbles!: Bubbles;
  current: Vehicle | null = null;
  state: 'title' | 'play' = 'title';
  time = 0;
  private acc = 0;
  private last = 0;
  private fade = 0;
  private fadeTarget = 0;
  private focus = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  /** Scripted controls for automated tests. */
  auto: { move?: [number, number]; car?: Controls } | null = null;

  async init(): Promise<void> {
    const canvas = $('game') as HTMLCanvasElement;
    await Promise.all([
      document.fonts.load('700 40px Cairo', 'Café مقهى'),
      document.fonts.load('400 20px Cairo', 'Café مقهى'),
    ]).catch(() => {});
    this.physics = await Physics.create();
    this.gfx = new Gfx(canvas);
    this.gfx.usePost = !DEBUG.nopost;
    this.input = new Input(canvas);
    const quality: Quality = DEBUG.quality ?? 'medium';

    const atlas = new Atlas(DEBUG.seed);
    const materials = createMaterials(atlas);
    const t0 = performance.now();
    this.city = buildCity(DEBUG.seed, atlas, materials);
    this.gfx.scene.add(this.city.group);
    this.physics.addStatic(this.city.colliders, this.city.trimeshes);
    console.info(`[houma] city built in ${Math.round(performance.now() - t0)} ms`, JSON.stringify(this.city.stats), `colliders: ${this.city.colliders.length}`);

    this.sky = new SkySystem(this.gfx.scene, this.gfx.renderer);
    this.sea = new Sea(this.gfx.scene, this.city.shoreZ);
    this.setQuality(quality);
    this.sky.setTime(DEBUG.time);

    this.player = new Player(this.physics, this.gfx.scene);
    this.player.teleport(PLAYER.spawn.x, WORLD.curb, PLAYER.spawn.z, PLAYER.spawn.yaw);
    this.cam = new FollowCamera(this.gfx.camera, this.physics);
    this.cam.yaw = PLAYER.spawn.yaw + Math.PI;

    this.city.carSpawns.forEach((s, i) => {
      const spec = VEHICLES[s.kind];
      const color = s.color ?? spec.colors[i % spec.colors.length];
      this.vehicles.push(new Vehicle(spec, color, atlas, this.physics, this.gfx.scene, s.x, s.z, s.yaw, i));
    });
    this.bubbles = new Bubbles(this.gfx.camera);
    this.lights = new TrafficLights(this.city, this.gfx.scene);
    this.traffic = new TrafficSystem(this.city, this.physics, this.gfx.scene, atlas, this.lights, this.audio, this.bubbles);
    this.traffic.setQuality(quality);
    this.traffic.setEnabled(!DEBUG.notraffic);
    // let the cars settle on their suspension
    for (let i = 0; i < 40; i++) this.step(PHYSICS.step);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'F3') this.hud.toggleFps();
    });
    const title = $('title');
    const start = () => {
      this.audio.unlock();
      this.paused = false;
      $('pause').classList.add('hidden');
      if (this.state === 'title') {
        this.state = 'play';
        title.classList.add('hidden');
        this.cam.snap();
      }
      this.input.requestLock();
    };
    title.addEventListener('click', start);
    canvas.addEventListener('click', start);
    $('pause').addEventListener('click', start);
    // Esc releases the mouse: show the pause screen
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.state === 'play' && !DEBUG.on) {
        this.paused = true;
        $('pause').classList.remove('hidden');
        this.audio.setHorn(false);
        this.audio.setEngine(null);
      }
    });

    if (DEBUG.on) {
      this.state = 'play';
      if (DEBUG.cam) this.hud.setSpeed(null);
    } else title.classList.remove('hidden');
    $('loading').classList.add('hidden');
    this.exposeDebug();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  setQuality(q: Quality): void {
    this.gfx.setQuality(q);
    this.sky.setQuality(q);
    this.traffic?.setQuality(q);
  }

  // ---------------------------------------------------------------- simulation
  private controls(): Controls | null {
    if (this.auto?.car) return this.auto.car;
    if (this.state !== 'play') return null;
    const i = this.input;
    return { throttle: i.axis('KeyS', 'KeyW'), steer: i.axis('KeyD', 'KeyA'), handbrake: i.down('Space') };
  }

  step(dt: number): void {
    const playing = this.state === 'play';
    if (this.auto?.move) {
      // scripted walking for tests: fake a direction
      const [mx, mz] = this.auto.move;
      this.fakeInput.set(mx, mz);
      this.player.fixedUpdate(dt, this.fakeInput as any, 0);
    } else this.player.fixedUpdate(dt, playing && !this.current ? this.input : null, this.cam.yaw);
    for (const v of this.vehicles) v.fixedUpdate(dt, v === this.current ? this.controls() : null);
    this.lights.update(dt);
    this.traffic.fixedUpdate(dt, { playerPos: this.player.pos, playerOnFoot: !this.current, playerVehicle: this.current, vehicles: this.vehicles, camera: this.gfx.camera });
    this.physics.step();
    for (const v of this.vehicles) v.afterStep();
    if (this.current) {
      this.player.pos.copy(this.current.pos);
      this.player.body.setNextKinematicTranslation(this.player.pos);
    }
    if (this.player.pos.y < -12) this.respawn();
  }

  private fakeInput = {
    x: 0, z: 0,
    set(x: number, z: number) { this.x = x; this.z = z; },
    axis(neg: string) { return neg === 'KeyS' ? -this.z : this.x; },
    down() { return false; },
  };

  respawn(): void {
    if (this.current) this.exitVehicle(true);
    this.player.teleport(PLAYER.spawn.x, WORLD.curb, PLAYER.spawn.z, PLAYER.spawn.yaw);
    this.cam.snap();
  }

  private nearestVehicle(): Vehicle | null {
    let best: Vehicle | null = null, bd = 3.6;
    for (const v of this.vehicles) {
      const d = Math.hypot(v.pos.x - this.player.pos.x, v.pos.z - this.player.pos.z) - v.spec.length * 0.3;
      if (d < bd && Math.abs(v.pos.y - this.player.pos.y) < 2.5) { bd = d; best = v; }
    }
    return best;
  }

  enterVehicle(v: Vehicle): void {
    this.current = v;
    v.occupied = true;
    this.player.setEnabled(false);
    this.fade = 0.7;
  }

  exitVehicle(force = false): void {
    const v = this.current;
    if (!v) return;
    if (!force && v.kmh > 12) return;
    // try the driver side first (left), then the other side, then the roof
    let spot: THREE.Vector3 | null = null;
    for (const side of [1, -1] as const) {
      const p = v.doorPoint(side, this.tmp);
      const blocked = this.physics.world.intersectionWithShape({ x: p.x, y: p.y + 0.6, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, new RAPIER_NS.Capsule(PLAYER.halfHeight * 0.8, PLAYER.radius), undefined, undefined, undefined, v.body);
      if (!blocked) { spot = p.clone(); break; }
    }
    if (!spot) spot = v.pos.clone().setY(v.pos.y + v.spec.height);
    v.occupied = false;
    this.current = null;
    this.player.setEnabled(true);
    this.player.teleport(spot.x, Math.max(spot.y - 0.45, 0), spot.z, v.yaw);
    this.fade = 0.7;
  }

  // ---------------------------------------------------------------- frame
  private loop(now: number): void {
    requestAnimationFrame((t) => this.loop(t));
    const dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;
    this.acc += dt;
    let n = 0;
    if (this.paused) this.acc = 0;
    while (this.acc >= PHYSICS.step && n < PHYSICS.maxSubSteps) {
      this.step(PHYSICS.step);
      this.acc -= PHYSICS.step;
      n++;
    }
    if (n === PHYSICS.maxSubSteps) this.acc = 0;
    this.frame(dt, this.acc / PHYSICS.step);
    this.input.endFrame();
  }

  frame(dt: number, alpha: number): void {
    const { input, player, hud } = this;
    if (this.state === 'play') {
      if (input.hit('KeyF')) {
        if (this.current) this.exitVehicle();
        else {
          const v = this.nearestVehicle();
          if (v) this.enterVehicle(v);
        }
      }
      if (input.hit('KeyR') && this.current) this.current.reset();
      const v = this.current;
      this.audio.setHorn(!!v && input.down('KeyH') && !this.paused, v?.spec.kind === 'louage' || v?.spec.kind === 'pickup' ? 0.8 : 1);
      this.audio.setEngine(v && !this.paused ? Math.min(1, v.kmh / v.spec.maxSpeed) : null, v ? Math.abs(input.axis('KeyS', 'KeyW')) : 0);
    }
    player.frame(alpha, dt);
    for (const v of this.vehicles) v.frame(alpha);
    this.traffic.frame(alpha);

    const district = districtAt(player.pos.x, player.pos.z);
    if (DEBUG.cam && DEBUG_CAMS[DEBUG.cam]) {
      const c = DEBUG_CAMS[DEBUG.cam];
      this.gfx.camera.position.set(...c.eye);
      this.gfx.camera.lookAt(...c.at);
      this.focus.set(c.at[0], 0, c.at[2]).lerp(this.gfx.camera.position, 0.35).setY(0);
      if (c.eye[1] > 100) this.focus.set(c.at[0], 0, c.at[2]);
    } else if (this.state === 'title') {
      // slow fly-over behind the start screen
      const a = this.time * 0.035 + 2.2;
      this.gfx.camera.position.set(Math.sin(a) * 210, 62 + Math.sin(this.time * 0.05) * 14, 20 + Math.cos(a) * 230);
      this.gfx.camera.lookAt(0, 6, -20);
      this.focus.set(Math.sin(a) * 90, 0, Math.cos(a) * 90);
    } else if (this.current) {
      const v = this.current;
      this.focus.copy(v.root.position);
      const d = CAMERA.carDistance + v.spec.length * 0.45 + Math.min(2.5, v.kmh * 0.02);
      this.cam.update(dt, input, this.focus, 1.25 + v.spec.height * 0.35, d, v.yaw, v.speed);
      hud.setSpeed(v.kmh, v.spec.name);
      hud.setPrompt(v.kmh < 12 ? 'F' : '', 'Get out');
    } else {
      this.focus.set(player.render.x, player.render.y - player.feet, player.render.z);
      const d = district === 'medina' ? CAMERA.medinaDistance : CAMERA.footDistance;
      this.cam.update(dt, input, this.focus, 1.55, d, null, 0);
      hud.setSpeed(null);
      const v = this.nearestVehicle();
      hud.setPrompt(v ? 'F' : '', v ? `Drive ${v.spec.name}` : '');
    }
    if (this.state === 'play' && !DEBUG.cam) hud.setZone(district);

    this.fade = Math.max(0, this.fade - dt * 2.5);
    this.gfx.setFade(Math.max(this.fade, this.fadeTarget));
    this.sky.update(this.focus, this.time);
    this.sea.update(this.time, this.sky);
    this.bubbles.update(dt);
    this.gfx.renderer.info.reset();
    this.gfx.render();
    hud.update(dt, () => {
      const r = this.gfx.renderer.info.render;
      return `${r.calls} calls  ${(r.triangles / 1000).toFixed(0)}k tris`;
    });
  }

  /** Hooks for the Playwright tests (tests/visual). */
  private exposeDebug(): void {
    (window as any).__houma = {
      ready: true,
      game: this,
      stats: () => ({
        city: this.city.stats,
        colliders: this.city.colliders.length,
        calls: this.gfx.renderer.info.render.calls,
        triangles: this.gfx.renderer.info.render.triangles,
        roads: { nodes: this.city.graph.nodes.length, edges: this.city.graph.edges.length, blocks: this.city.graph.blocks.length },
        walk: { nodes: this.city.sidewalks.nodes.length, edges: this.city.sidewalks.edges.length, crossings: this.city.sidewalks.edges.filter((e) => e.crossing).length, reachable: this.city.sidewalks.reachable() },
      }),
      player: () => ({ x: this.player.pos.x, y: this.player.feetY, z: this.player.pos.z, grounded: this.player.grounded, inVehicle: !!this.current }),
      car: (i: number) => {
        const v = this.vehicles[i];
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(v.quat);
        return { x: v.pos.x, y: v.pos.y, z: v.pos.z, kmh: v.kmh, speed: v.speed, upY: up.y, yaw: v.yaw, name: v.spec.name };
      },
      cars: () => this.vehicles.length,
      teleport: (x: number, z: number, y = WORLD.curb) => { this.player.teleport(x, y, z); this.cam.snap(); },
      placeCar: (i: number, x: number, z: number, yaw: number) => this.vehicles[i].place(x, z, yaw),
      enter: (i: number) => this.enterVehicle(this.vehicles[i]),
      exit: () => this.exitVehicle(true),
      auto: (a: Game['auto']) => { this.auto = a; },
      /** Advance the simulation without rendering. */
      steps: (n: number) => { for (let i = 0; i < n; i++) this.step(PHYSICS.step); },
      look: (yaw: number, pitch: number) => { this.cam.yaw = yaw; this.cam.pitch = pitch; this.cam.snap(); },
      traffic: () => this.traffic.report(),
      trafficEnabled: (on: boolean) => this.traffic.setEnabled(on),
      trafficCars: () => this.traffic.agents.map((a) => ({ id: a.id, x: +a.x.toFixed(1), z: +a.z.toFixed(1), v: +a.v.toFixed(1), kind: a.spec.kind, path: a.path.kind, node: a.path.node, turn: a.next?.turn, blocked: +a.blocked.toFixed(0), why: a.why, by: a.blocker?.id ?? 0, toEnd: +(a.path.length - a.s).toFixed(1) })),
      light: (node: number, ns: boolean) => this.lights.state(node, ns),
      setTime: (h: number) => this.sky.setTime(h),
      setQuality: (q: Quality) => this.setQuality(q),
    };
  }
}

new Game().init().catch((err) => {
  console.error(err);
  $('loadtext').textContent = 'Error: ' + (err?.message ?? err);
});
