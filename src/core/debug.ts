import { DEFAULT_SEED, TIME, type Quality } from '../data/config';

/** URL options, for example ?debug=1&cam=medina&time=17 (used by the visual tests). */
const q = new URLSearchParams(location.search);

export const DEBUG = {
  on: q.get('debug') === '1',
  cam: q.get('cam'),
  time: q.has('time') ? Number(q.get('time')) : TIME.defaultHour,
  seed: q.has('seed') ? Number(q.get('seed')) : DEFAULT_SEED,
  quality: (q.get('q') as Quality | null) ?? null,
  nopost: q.get('nopost') === '1',
  shadow: q.get('shadow'),
  notraffic: q.get('notraffic') === '1',
};

/** Fixed camera points for repeatable screenshots: [eye], [target]. */
export const DEBUG_CAMS: Record<string, { eye: [number, number, number]; at: [number, number, number] }> = {
  boulevard: { eye: [5, 3.2, -150], at: [-4, 3.5, -60] },
  boulevard2: { eye: [-22, 2.2, 40], at: [10, 6, 0] },
  lights: { eye: [-15.6, 2.4, -92], at: [6, 3.6, -58] },
  clock: { eye: [-8, 5, 150], at: [0, 9, 220] },
  medina: { eye: [-217.7, 1.8, -152], at: [-217.5, 2.4, -100] },
  medina2: { eye: [-217.7, 1.7, -30], at: [-190, 2.2, -44.5] },
  medinagate: { eye: [-134, 2.2, -36], at: [-150, 3.4, -44.5] },
  medinatop: { eye: [-120, 60, 20], at: [-215, 0, -70] },
  houma: { eye: [176, 2.2, -128], at: [210, 2.6, -96] },
  houma2: { eye: [210, 2.4, -60], at: [210.5, 3.2, 0] },
  corniche: { eye: [-70, 3.2, -346], at: [40, 2.5, -352] },
  beach: { eye: [60, 2.5, -372], at: [-40, 1, -360] },
  louage: { eye: [-150, 7, 92], at: [-215, 1, 150] },
  highway: { eye: [-70, 7, 362], at: [40, 2, 380] },
  aerial: { eye: [-260, 230, 380], at: [-20, 0, -40] },
  aerial2: { eye: [300, 120, -420], at: [0, 0, -100] },
  top: { eye: [0, 900, 1], at: [0, 0, 0] },
};
