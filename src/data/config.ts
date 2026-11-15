// All tunable numbers and colors live here (see docs/SPEC.md section 14).

export const CITY_NAME = 'Ras Yasmine';
export const CITY_NAME_AR = 'رأس الياسمين';
export const DEFAULT_SEED = 2026;

/** Stripe color of the louage. TODO(owner): confirm the correct color. */
export const LOUAGE_STRIPE_COLOR = 0xc8202a;

export const POLICE = {
  bodyColor: 0xf4f4f0,
  stripeColor: 0x1f3f8f,
  uniformColor: 0x27365a,
};

export const WORLD = {
  half: 500, // map is 1 km x 1 km, centered on 0,0
  curb: 0.15, // sidewalk height in meters
  chunk: 200, // static geometry chunk size
};

export const TIME = {
  defaultHour: 17.0, // golden hour: warm light, long shadows
};

export const PLAYER = {
  walkSpeed: 3.2,
  runSpeed: 6.6,
  jumpSpeed: 5.2,
  gravity: 16,
  radius: 0.32,
  halfHeight: 0.55,
  spawn: { x: 3, z: -112, yaw: 0 },
};

export const CAMERA = {
  fov: 55,
  footDistance: 5.2,
  medinaDistance: 3.2,
  carDistance: 8.2,
  minPitch: -0.35,
  maxPitch: 1.1,
  sensitivity: 0.0023,
};

export const PHYSICS = {
  step: 1 / 60,
  maxSubSteps: 5,
};

export interface VehicleSpec {
  name: string; // fictional model name
  kind: 'hatch' | 'sedan' | 'louage' | 'taxi' | 'pickup' | 'police';
  length: number;
  width: number;
  height: number;
  wheelBase: number;
  wheelRadius: number;
  mass: number;
  engineForce: number; // total drive force (N)
  brakeForce: number; // braking deceleration in m/s2
  maxSpeed: number; // km/h
  maxSteer: number; // rad at low speed
  grip: number; // wheel friction slip
  suspension: number; // stiffness
  colors: number[];
}

export const VEHICLES: Record<string, VehicleSpec> = {
  hatch: {
    name: 'Bambino 206', kind: 'hatch', length: 3.75, width: 1.66, height: 1.42, wheelBase: 2.4, wheelRadius: 0.3,
    mass: 950, engineForce: 5200, brakeForce: 13, maxSpeed: 150, maxSteer: 0.6, grip: 2.4, suspension: 34,
    colors: [0xb8bcc2, 0x8c1d1d, 0x2c4f8a, 0xe8e6df, 0x3a3d42, 0x6f8f6a, 0xc9a23a],
  },
  sedan: {
    name: 'Sahel Symbole', kind: 'sedan', length: 4.3, width: 1.72, height: 1.44, wheelBase: 2.6, wheelRadius: 0.31,
    mass: 1150, engineForce: 5600, brakeForce: 13, maxSpeed: 165, maxSteer: 0.55, grip: 2.3, suspension: 32,
    colors: [0xdad8d0, 0x9a9da3, 0x222429, 0x74252a, 0x25406b, 0xb9aa8c],
  },
  louage: {
    name: 'Louage Rafale', kind: 'louage', length: 5.3, width: 1.95, height: 2.15, wheelBase: 3.3, wheelRadius: 0.36,
    mass: 2100, engineForce: 7400, brakeForce: 13, maxSpeed: 125, maxSteer: 0.48, grip: 2.2, suspension: 30,
    colors: [0xf2f0ea],
  },
  taxi: {
    name: 'Taxi Jasmin', kind: 'taxi', length: 4.1, width: 1.7, height: 1.45, wheelBase: 2.5, wheelRadius: 0.3,
    mass: 1050, engineForce: 5200, brakeForce: 13, maxSpeed: 150, maxSteer: 0.58, grip: 2.3, suspension: 33,
    colors: [0xf2c21a],
  },
  pickup: {
    name: 'Bachée 404', kind: 'pickup', length: 4.6, width: 1.68, height: 1.6, wheelBase: 2.8, wheelRadius: 0.34,
    mass: 1250, engineForce: 4300, brakeForce: 13, maxSpeed: 105, maxSteer: 0.55, grip: 2.0, suspension: 22,
    colors: [0xd9d3c2, 0x6f8fae, 0x9c5b3a, 0x7c8c66],
  },
  police: {
    name: 'Police Patrol', kind: 'police', length: 4.3, width: 1.72, height: 1.44, wheelBase: 2.6, wheelRadius: 0.31,
    mass: 1200, engineForce: 6400, brakeForce: 13, maxSpeed: 175, maxSteer: 0.55, grip: 2.5, suspension: 34,
    colors: [POLICE.bodyColor],
  },
};

/** Speed limits in km/h per street class. */
export const SPEED_LIMITS = { boulevard: 50, main: 50, minor: 30, corniche: 60, highway: 90 };

export type Quality = 'low' | 'medium' | 'high';
export const QUALITY: Record<Quality, { shadowMap: number; shadowRange: number; pixelRatio: number; bloom: boolean; far: number }> = {
  low: { shadowMap: 1024, shadowRange: 60, pixelRatio: 1, bloom: false, far: 450 },
  medium: { shadowMap: 2048, shadowRange: 85, pixelRatio: 1, bloom: true, far: 650 },
  high: { shadowMap: 4096, shadowRange: 110, pixelRatio: 1.5, bloom: true, far: 900 },
};

/** Wall palette: mostly white, some cream and light ochre. */
export const PALETTE = {
  walls: [0xf4f1ea, 0xf7f5f0, 0xefe9dc, 0xf1ece2, 0xece4d2, 0xe9dcc0, 0xe2cfa6, 0xf6f3ee, 0xf2efe8],
  wallsWhite: [0xf7f5f0, 0xf4f2ec, 0xf9f8f4, 0xf1eee6],
  colonial: [0xf1ede3, 0xe9e0cc, 0xe3d3ae, 0xf5f2ea, 0xd9c8a4, 0xece6d8],
  doors: [0x1f6fb5, 0x1f6fb5, 0x2a7fc4, 0x1a5e9c, 0x2f8a57, 0xd9a520, 0x1f6fb5],
  shutters: [0x1f6fb5, 0x2a7fc4, 0x1f6fb5, 0x3a86c8, 0x2f8a57, 0x1a5e9c],
  shuttersColonial: [0x7fa3b5, 0x9bb0a0, 0x6f8fa6, 0xb5b9a8, 0x567a8c],
  awnings: [0xb83a2e, 0x2f6fa8, 0x2f8a57, 0xd9a520, 0xe8e2d0],
  blue: 0x1f6fb5,
  concrete: 0x9a958c,
  brick: 0xb5613f,
  asphalt: 0x3a3b3e,
  sand: 0xe6d3a3,
  stone: 0xcbb489,
};
