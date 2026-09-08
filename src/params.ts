/**
 * AGAR — organism library, parameter schema, presets.
 *
 * Every default is taken from, or scaled from, published microbiology; the
 * citations live in `references.ts` and are shown in the app so the numbers can
 * be checked rather than trusted.
 *
 * Two clocks run here and they are deliberately separate:
 *   - motion  : real seconds. Run-and-tumble statistics only read correctly at
 *               human timescales (Berg & Brown 1972: ~1 s runs, ~0.1 s tumbles).
 *   - biology : simulated minutes, at `timeScale` sim-min per real second.
 *               Doubling times and culture phases are meaningless at 60 fps.
 */

export type Domain = 'prokaryote' | 'eukaryote';
export type Shape = 'rod' | 'coccus' | 'spiral' | 'filament' | 'bud' | 'amoeboid' | 'hypha';

export interface Species {
  id: string;
  label: string;
  short: string;
  domain: Domain;
  kingdom: string;
  shape: Shape;
  radius: number;      // µm, short axis
  doubling: number;    // minutes at saturating substrate
  speed: number;       // µm/s, 0 = sessile
  runLength: number;   // seconds between tumbles
  adhesion: number;    // EPS / matrix stickiness, 0–1
  alignment: number;   // nematic coupling with neighbours, 0–1
  hayflick: number;    // replicative limit, 0 = none
  ks: number;          // Monod half-saturation
  maintenance: number; // ≈12% of µmax — below it nothing starves, above it slow organisms can never grow
  lifespan: number;    // chronological, minutes
  topt: number;        // °C, growth optimum
  tmax: number;        // °C, growth ceiling
  phagotroph: boolean; // engulfs smaller cells
  sporulates: boolean; // survives famine as a dormant spore instead of lysing
  phototroph: boolean; // gains energy from the light beacon
  note: string;
}

export const SPECIES: Species[] = [
  {
    id: 'bacillus', label: 'Bacillus', short: 'Rod, sporulating', domain: 'prokaryote', kingdom: 'Bacteria', shape: 'rod',
    radius: 0.5, doubling: 24, speed: 22, runLength: 1.0, adhesion: 0.18, alignment: 0.75,
    hayflick: 0, ks: 0.14, maintenance: 0.0035, lifespan: 960, topt: 37, tmax: 52,
    phagotroph: false, sporulates: true, phototroph: false,
    note: 'Motile rod, binary fission, daughters stay aligned so colonies grow as nematic rafts. Starves into a dormant endospore rather than dying — feed the plate again and it comes back.',
  },
  {
    id: 'coccus', label: 'Coccus', short: 'Sphere, biofilm', domain: 'prokaryote', kingdom: 'Bacteria', shape: 'coccus',
    radius: 0.45, doubling: 30, speed: 0, runLength: 1.0, adhesion: 0.62, alignment: 0,
    hayflick: 0, ks: 0.18, maintenance: 0.0028, lifespan: 1200, topt: 37, tmax: 48,
    phagotroph: false, sporulates: false, phototroph: false,
    note: 'Non-motile sphere with heavy EPS. Sticks to its siblings and builds compact biofilm that holds the letterform long after the substrate is gone.',
  },
  {
    id: 'spirillum', label: 'Spirillum', short: 'Helix, fast swimmer', domain: 'prokaryote', kingdom: 'Bacteria', shape: 'spiral',
    radius: 0.4, doubling: 42, speed: 45, runLength: 1.8, adhesion: 0.04, alignment: 0.2,
    hayflick: 0, ks: 0.09, maintenance: 0.002, lifespan: 1700, topt: 30, tmax: 42,
    phagotroph: false, sporulates: false, phototroph: false,
    note: 'Long runs, weak stickiness, low half-saturation. Scouts a gradient far ahead of the colony and finds food the others never reach.',
  },
  {
    id: 'cyanobacterium', label: 'Cyanobacterium', short: 'Filament, photosynthetic', domain: 'prokaryote', kingdom: 'Bacteria', shape: 'filament',
    radius: 0.9, doubling: 300, speed: 2, runLength: 6, adhesion: 0.9, alignment: 0.95,
    hayflick: 0, ks: 0.05, maintenance: 0.0003, lifespan: 12000, topt: 28, tmax: 45,
    phagotroph: false, sporulates: false, phototroph: true,
    note: 'Photoautotroph: place a light beacon and it feeds on that instead of the medium. Slow, frugal, gliding, chained into filaments.',
  },
  {
    id: 'archaeon', label: 'Archaeon', short: 'Thermophile', domain: 'prokaryote', kingdom: 'Archaea', shape: 'rod',
    radius: 0.35, doubling: 60, speed: 8, runLength: 2.2, adhesion: 0.3, alignment: 0.5,
    hayflick: 0, ks: 0.11, maintenance: 0.0012, lifespan: 3000, topt: 80, tmax: 105,
    phagotroph: false, sporulates: false, phototroph: false,
    note: 'Extremophile. Barely grows at room temperature and thrives where everything else has cooked — push the temperature past 70 °C and the plate belongs to it.',
  },
  {
    id: 'yeast', label: 'Yeast', short: 'Fungus, budding', domain: 'eukaryote', kingdom: 'Fungi', shape: 'bud',
    radius: 2.2, doubling: 90, speed: 0, runLength: 1, adhesion: 0.35, alignment: 0,
    hayflick: 25, ks: 0.22, maintenance: 0.0009, lifespan: 3600, topt: 30, tmax: 40,
    phagotroph: false, sporulates: false, phototroph: false,
    note: 'Asymmetric budding. Every mother wears her bud scars and stops dividing after about 25 of them, which is a lifespan you can watch rather than a number.',
  },
  {
    id: 'mycelium', label: 'Mycelium', short: 'Fungus, hyphal', domain: 'eukaryote', kingdom: 'Fungi', shape: 'hypha',
    radius: 0.75, doubling: 150, speed: 0, runLength: 1, adhesion: 0.98, alignment: 0.99,
    hayflick: 0, ks: 0.07, maintenance: 0.00055, lifespan: 6000, topt: 25, tmax: 38,
    phagotroph: false, sporulates: true, phototroph: false,
    note: 'Apical growth: only the tips extend, the trunk behind them is masonry. Branches at a fixed angle and knits a network over the type. Sporulates when starved.',
  },
  {
    id: 'slime', label: 'Slime mould', short: 'Protist, network', domain: 'eukaryote', kingdom: 'Protista', shape: 'amoeboid',
    radius: 3.4, doubling: 240, speed: 5, runLength: 5, adhesion: 0.8, alignment: 0.4,
    hayflick: 0, ks: 0.12, maintenance: 0.0006, lifespan: 9000, topt: 24, tmax: 36,
    phagotroph: true, sporulates: true, phototroph: false,
    note: 'Crawls as a connected sheet, engulfs what it meets, and pulls itself into veins between food sources. Slow, stubborn, and very hard to kill.',
  },
  {
    id: 'amoeba', label: 'Amoeba', short: 'Protist, predator', domain: 'eukaryote', kingdom: 'Protista', shape: 'amoeboid',
    radius: 6, doubling: 480, speed: 3, runLength: 4, adhesion: 0.05, alignment: 0,
    hayflick: 0, ks: 0.30, maintenance: 0.0002, lifespan: 19000, topt: 25, tmax: 37,
    phagotroph: true, sporulates: false, phototroph: false,
    note: 'The predator. Crawls through a bacterial lawn and swallows it whole; a fraction of what it eats is kept as an organelle instead of digested.',
  },
];

export const speciesById = (id: string): Species =>
  SPECIES.find((s) => s.id === id) ?? SPECIES[0];

export type Tool = 'inspect' | 'feed' | 'toxin' | 'light' | 'inoculate' | 'scrape';
export type View = 'culture' | 'substrate' | 'density' | 'toxin' | 'plate';

export type Mode = 'specimen' | 'dish';

export const defaults = {
  /** Specimen: the letterforms are the medium. Dish: an open plate you seed and feed yourself. */
  mode: 'specimen' as Mode,

  // ── specimen ───────────────────────────────────────────────────────────
  text: 'AGAR',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontWeight: 700,
  fontSize: 190,
  tracking: 0.02,
  lineHeight: 0.95,
  inoculum: 'glyph' as 'glyph' | 'edge' | 'centre' | 'scatter',
  seedDensity: 0.2,

  // ── dish ───────────────────────────────────────────────────────────────
  dishRichness: 1.4,    // uniform substrate poured across the dish
  colonies: 5,          // founding colonies dropped on the agar
  agar: 0.4,            // 0 = soft (swarming), 1 = hard (branching) — Ben-Jacob 1994

  // ── organism ───────────────────────────────────────────────────────────
  species: 'bacillus',
  cellScale: 1,
  motility: 1,
  runLength: 1,
  tumbleAngle: 68,      // Berg & Brown 1972: mean reorientation ≈68°
  chemotaxis: 1,
  repulsion: 1.4,       // weight of toxin in the sensed gradient
  adhesion: 0.18,
  alignment: 0.75,

  // ── metabolism ─────────────────────────────────────────────────────────
  doubling: 24,
  ks: 0.14,
  yieldCoef: 0.55,
  maintenance: 0.0035,
  lysisReturn: 0.6,
  sporulation: 1,       // 0 disables dormancy for species that can form spores

  // ── reproduction ───────────────────────────────────────────────────────
  adderIncrement: 1.0,  // Taheri-Araghi 2015: constant size ADDED per cycle
  asymmetry: 0,
  hayflick: 0,
  lifespan: 960,
  capacity: 6000,

  // ── mutation & selection ───────────────────────────────────────────────
  mutationRate: 0.035,
  hgt: 0.002,
  drugDose: 0,
  drugDecay: 0.004,

  // ── environment ────────────────────────────────────────────────────────
  substrate: 3.0,
  diffusion: 0.07,
  replenish: 0,
  temperature: 37,
  shear: 0,
  light: 1.2,           // beacon output

  // ── optics ─────────────────────────────────────────────────────────────
  view: 'culture' as View,
  dither: 'bayer8' as 'none' | 'bayer2' | 'bayer4' | 'bayer8' | 'floyd' | 'atkinson' | 'jarvis' | 'noise' | 'halftone',
  levels: 2,
  pixelSize: 2,
  contrast: 1.15,
  exposure: 0,
  persistence: 0,
  accent: 'energy' as 'none' | 'energy' | 'age' | 'lineage' | 'drug',
  depth: 0.35,
  tilt: 0,
  grain: 0.06,
  overlay: true,
  invert: false,
  paperColor: '#fafaf8',
  inkColor: '#111111',
  acidColor: '#ccff00',

  // ── tools ──────────────────────────────────────────────────────────────
  tool: 'feed' as Tool,
  brush: 34,

  // ── time ───────────────────────────────────────────────────────────────
  timeScale: 25,        // sim-minutes per real second
  seed: 20260908,
};

export type Params = typeof defaults;
export type Level = 'basic' | 'advanced';

type Base = {
  key: keyof Params; group: string; label: string; help: string; level: Level;
  /** Which plate modes this control applies to. Omitted means both. */
  modes?: Mode[];
};
export type Control =
  | (Base & { kind: 'range'; min: number; max: number; step: number; unit?: string })
  | (Base & { kind: 'select'; options: [string, string][] })
  | (Base & { kind: 'toggle' })
  | (Base & { kind: 'text' })
  | (Base & { kind: 'colour' })
  | (Base & { kind: 'int'; min: number; max: number });

export const GROUPS = [
  'Specimen', 'Dish', 'Organism', 'Metabolism', 'Reproduction',
  'Mutation', 'Environment', 'Optics', 'Time',
] as const;

export const CONTROLS: Control[] = [
  // Specimen
  // 'text' is not here: the specimen field lives above the plate, where the
  // thing it changes is visible. See the specimen bar in index.html.
  { modes: ['specimen'], key: 'fontSize', group: 'Specimen', label: 'Type size', kind: 'range', min: 40, max: 420, step: 1, unit: 'px', level: 'basic',
    help: 'Cap height of the specimen in device pixels. It is scaled down automatically if it would not fit the plate.' },
  { modes: ['specimen'], key: 'seedDensity', group: 'Specimen', label: 'Inoculum density', kind: 'range', min: 0.02, max: 1, step: 0.01, level: 'basic',
    help: 'Fraction of sites seeded at t=0. A thin inoculum gives a long lag phase and a much longer exponential run.' },
  { modes: ['specimen'], key: 'fontWeight', group: 'Specimen', label: 'Weight', kind: 'range', min: 100, max: 900, step: 100, level: 'advanced',
    help: 'Heavier weights hold more substrate, so colonies survive longer inside them.' },
  { modes: ['specimen'], key: 'tracking', group: 'Specimen', label: 'Tracking', kind: 'range', min: -0.08, max: 0.6, step: 0.005, unit: 'em', level: 'advanced',
    help: 'Letter spacing. Wide tracking isolates each glyph into its own island culture.' },
  { modes: ['specimen'], key: 'inoculum', group: 'Specimen', label: 'Inoculation', kind: 'select', level: 'advanced',
    options: [['glyph', 'Inside glyphs'], ['edge', 'Plate edge'], ['centre', 'Single colony'], ['scatter', 'Random scatter']],
    help: 'Where the founding cells are placed. "Plate edge" makes the swarm hunt the letterforms by chemotaxis.' },

  // Dish
  { modes: ['dish'], key: 'dishRichness', group: 'Dish', label: 'Agar richness', kind: 'range', min: 0.05, max: 6, step: 0.05, level: 'basic',
    help: 'Nutrient poured evenly across the dish. A rich plate grows a thick lawn fast and then starves all at once.' },
  { modes: ['dish'], key: 'colonies', group: 'Dish', label: 'Founding colonies', kind: 'range', min: 1, max: 40, step: 1, level: 'basic',
    help: 'How many separate colonies are dropped on the agar at the start. Watch neighbouring colonies compete for the ground between them.' },
  { modes: ['dish'], key: 'agar', group: 'Dish', label: 'Agar hardness', kind: 'range', min: 0, max: 1, step: 0.01, level: 'basic',
    help: 'Soft agar lets cells swim and the colony swarms outward; hard agar pins them and growth becomes diffusion-limited and branched (Ben-Jacob et al. 1994).' },

  // Organism
  { key: 'motility', group: 'Organism', label: 'Motility', kind: 'range', min: 0, max: 3, step: 0.02, unit: '×', level: 'basic',
    help: 'Swim-speed multiplier. At 0 the culture settles and can only grow where substrate already is.' },
  { key: 'adhesion', group: 'Organism', label: 'Adhesion / EPS', kind: 'range', min: 0, max: 1, step: 0.01, level: 'basic',
    help: 'Binding to touching neighbours. High values build biofilm; low values let the colony disperse.' },
  { key: 'chemotaxis', group: 'Organism', label: 'Chemotaxis gain', kind: 'range', min: 0, max: 4, step: 0.05, level: 'basic',
    help: 'How strongly a rising gradient suppresses tumbling. 0 is a blind random walk; high values make cells hunt whatever you paint on the plate.' },
  { key: 'cellScale', group: 'Organism', label: 'Cell size', kind: 'range', min: 0.3, max: 4, step: 0.05, unit: '×', level: 'advanced',
    help: 'Multiplier on the organism’s published cell radius.' },
  { key: 'runLength', group: 'Organism', label: 'Run length', kind: 'range', min: 0.1, max: 6, step: 0.05, unit: 's', level: 'advanced',
    help: 'Mean straight run before a tumble. E. coli runs about 1 s (Berg & Brown 1972).' },
  { key: 'tumbleAngle', group: 'Organism', label: 'Tumble angle', kind: 'range', min: 5, max: 180, step: 1, unit: '°', level: 'advanced',
    help: 'Mean reorientation per tumble. The measured value is ≈68°, which is why chemotaxis is a biased walk and not steering.' },
  { key: 'repulsion', group: 'Organism', label: 'Toxin avoidance', kind: 'range', min: 0, max: 4, step: 0.05, level: 'advanced',
    help: 'Weight of toxin in the sensed gradient. Cells flee a rising toxin by the same tumble mechanism that draws them to food.' },
  { key: 'alignment', group: 'Organism', label: 'Nematic alignment', kind: 'range', min: 0, max: 1, step: 0.01, level: 'advanced',
    help: 'Rods torque parallel to their neighbours — a Vicsek coupling, and what gives real colonies their grain.' },

  // Metabolism
  { key: 'doubling', group: 'Metabolism', label: 'Doubling time', kind: 'range', min: 5, max: 600, step: 1, unit: 'min', level: 'basic',
    help: 'Generation time at saturating substrate. µmax = ln2 / doubling.' },
  { key: 'ks', group: 'Metabolism', label: 'Half-saturation Ks', kind: 'range', min: 0.01, max: 1, step: 0.005, level: 'advanced',
    help: 'Substrate at which growth runs at half µmax. Low Ks is an efficient scavenger.' },
  { key: 'yieldCoef', group: 'Metabolism', label: 'Yield', kind: 'range', min: 0.1, max: 1.5, step: 0.01, level: 'advanced',
    help: 'Biomass produced per unit substrate consumed.' },
  { key: 'maintenance', group: 'Metabolism', label: 'Maintenance', kind: 'range', min: 0, max: 0.02, step: 0.0001, level: 'advanced',
    help: 'Energy burnt per sim-minute simply staying alive. This is what ends the stationary phase.' },
  { key: 'lysisReturn', group: 'Metabolism', label: 'Lysis return', kind: 'range', min: 0, max: 1, step: 0.01, level: 'advanced',
    help: 'Fraction of a dead cell released back into the medium — cryptic growth, the reason death phases stutter.' },
  { key: 'sporulation', group: 'Metabolism', label: 'Sporulation', kind: 'range', min: 0, max: 1, step: 0.01, level: 'advanced',
    help: 'For organisms that can form spores: how readily starvation triggers dormancy instead of lysis. Spores ignore the drug and wait for food.' },

  // Reproduction
  { key: 'adderIncrement', group: 'Reproduction', label: 'Adder increment', kind: 'range', min: 0.3, max: 3, step: 0.02, unit: '×', level: 'advanced',
    help: 'Size a cell must ADD before dividing, independent of birth size (Taheri-Araghi et al. 2015).' },
  { key: 'asymmetry', group: 'Reproduction', label: 'Division asymmetry', kind: 'range', min: 0, max: 1, step: 0.01, level: 'advanced',
    help: '0 is symmetric binary fission; 1 is budding, where the mother keeps nearly all the mass.' },
  { key: 'hayflick', group: 'Reproduction', label: 'Replicative limit', kind: 'range', min: 0, max: 60, step: 1, unit: 'div', level: 'advanced',
    help: 'Divisions before senescence; 0 disables it. Yeast mothers manage about 25 (Mortimer & Johnston 1959).' },
  { key: 'lifespan', group: 'Reproduction', label: 'Max age', kind: 'range', min: 60, max: 24000, step: 20, unit: 'min', level: 'advanced',
    help: 'Hard chronological lifespan. Cells also die early from starvation or drug.' },
  { key: 'capacity', group: 'Reproduction', label: 'Cell cap', kind: 'range', min: 200, max: 9000, step: 100, level: 'advanced',
    help: 'Memory ceiling, not biology. Lower it if your machine drops frames.' },

  // Mutation
  { key: 'mutationRate', group: 'Mutation', label: 'Mutation rate', kind: 'range', min: 0, max: 0.3, step: 0.002, level: 'basic',
    help: 'Spread applied to every heritable trait at division. Selection does the rest — nothing about which way traits move is scripted.' },
  { key: 'hgt', group: 'Mutation', label: 'Gene transfer', kind: 'range', min: 0, max: 0.05, step: 0.001, level: 'advanced',
    help: 'Chance that touching cells swap a trait — horizontal transfer, the reason resistance spreads faster than descent alone allows.' },
  { key: 'drugDose', group: 'Mutation', label: 'Antibiotic', kind: 'range', min: 0, max: 3, step: 0.01, level: 'advanced',
    help: 'Bulk drug concentration across the whole plate. Cells die above their inherited resistance; survivors repopulate.' },
  { key: 'drugDecay', group: 'Mutation', label: 'Drug clearance', kind: 'range', min: 0, max: 0.05, step: 0.001, level: 'advanced',
    help: 'First-order decay of the drug per sim-minute.' },

  // Environment
  { key: 'substrate', group: 'Environment', label: 'Substrate load', kind: 'range', min: 0.05, max: 6, step: 0.05, level: 'basic',
    help: 'Nutrient concentration laid inside the letterforms at t=0.' },
  { key: 'temperature', group: 'Environment', label: 'Temperature', kind: 'range', min: 4, max: 110, step: 0.5, unit: '°C', level: 'basic',
    help: 'Square-root (Ratkowsky) response around each organism’s own optimum. A thermophile wants 80 °C; everything else cooks there.' },
  { key: 'diffusion', group: 'Environment', label: 'Diffusion', kind: 'range', min: 0, max: 0.5, step: 0.005, level: 'advanced',
    help: 'How fast substrate spreads out of the type into the plate. High diffusion dissolves the letterforms early.' },
  { key: 'replenish', group: 'Environment', label: 'Inflow', kind: 'range', min: 0, max: 0.02, step: 0.0002, level: 'advanced',
    help: '0 is a closed batch culture with a full growth curve. Above 0 it becomes a chemostat and can run indefinitely.' },
  { key: 'shear', group: 'Environment', label: 'Flow / shear', kind: 'range', min: -30, max: 30, step: 0.5, unit: 'µm/s', level: 'advanced',
    help: 'Bulk medium flow. Detaches weakly adherent cells and smears the colony downstream.' },
  { key: 'light', group: 'Environment', label: 'Beacon output', kind: 'range', min: 0, max: 4, step: 0.05, level: 'advanced',
    help: 'Output of the beacons placed with the light tool — photons and warmth together. Photoautotrophs feed on the light instead of the medium; everything else only feels the heat, which is added to the incubator temperature locally and can push a cell past its ceiling.' },

  // Optics
  { key: 'view', group: 'Optics', label: 'View', kind: 'select', level: 'basic',
    options: [['culture', 'Organisms'], ['substrate', 'Nutrient heatmap'], ['density', 'Colony density'], ['toxin', 'Toxin heatmap'], ['plate', 'Type only (no biology)']],
    help: 'What the plate shows. The heatmaps run through the same dither pipeline, so they stay part of the same picture.' },
  { key: 'dither', group: 'Optics', label: 'Dither kernel', kind: 'select', level: 'basic',
    options: [['bayer2', 'Ordered 2×2'], ['bayer4', 'Ordered 4×4'], ['bayer8', 'Ordered 8×8'],
      ['floyd', 'Floyd–Steinberg'], ['atkinson', 'Atkinson'], ['jarvis', 'Jarvis–Judice–Ninke'],
      ['noise', 'White noise'], ['halftone', 'Halftone dot'], ['none', 'None (continuous)']],
    help: 'Ordered kernels are stable frame to frame. Error-diffusion kernels re-solve every frame and shimmer — beautiful in a micrograph, distracting in motion.' },
  { key: 'pixelSize', group: 'Optics', label: 'Sample size', kind: 'range', min: 1, max: 8, step: 1, unit: 'px', level: 'basic',
    help: 'Dither grid coarseness, and the main performance control. 2 or 3 is the sweet spot.' },
  { key: 'accent', group: 'Optics', label: 'Accent channel', kind: 'select', level: 'basic',
    options: [['none', 'Off'], ['energy', 'Metabolic rate'], ['age', 'Senescence'], ['lineage', 'Lineage'], ['drug', 'Drug resistance']],
    help: 'What the single non-grey colour is allowed to mean. It marks the top of the current distribution, so it appears only where there is real variation.' },
  { key: 'levels', group: 'Optics', label: 'Tone levels', kind: 'range', min: 2, max: 8, step: 1, level: 'advanced',
    help: '2 is a pure bitonal micrograph. Higher values keep more of the density gradient.' },
  { key: 'contrast', group: 'Optics', label: 'Contrast', kind: 'range', min: 0.3, max: 3, step: 0.01, level: 'advanced',
    help: 'Applied before quantisation.' },
  { key: 'exposure', group: 'Optics', label: 'Exposure', kind: 'range', min: -0.5, max: 0.5, step: 0.01, level: 'advanced',
    help: 'Lifts or drops the whole field before the dither threshold.' },
  { key: 'persistence', group: 'Optics', label: 'Persistence', kind: 'range', min: 0, max: 0.96, step: 0.01, level: 'basic',
    help: 'Long-exposure afterimage. Turns swimming cells into motility tracks.' },
  { key: 'depth', group: 'Optics', label: 'Depth of field', kind: 'range', min: 0, max: 1, step: 0.01, level: 'advanced',
    help: 'Cells hold a z position; this scales how strongly depth affects size and density.' },
  { key: 'tilt', group: 'Optics', label: 'Stage tilt', kind: 'range', min: 0, max: 60, step: 1, unit: '°', level: 'advanced',
    help: 'Tilts the culture plane into an axonometric view. 0 is a flat top-down micrograph.' },
  { key: 'grain', group: 'Optics', label: 'Film grain', kind: 'range', min: 0, max: 0.3, step: 0.005, level: 'advanced',
    help: 'Sensor noise added before quantisation.' },
  { key: 'overlay', group: 'Optics', label: 'Micrograph overlay', kind: 'toggle', level: 'advanced',
    help: 'Reticle, scale bar and specimen slug.' },
  { key: 'invert', group: 'Optics', label: 'Darkfield', kind: 'toggle', level: 'advanced',
    help: 'Swaps the plate to darkfield — light organisms on a dark field.' },
  { key: 'paperColor', group: 'Optics', label: 'Plate', kind: 'colour', level: 'basic', help: 'Background of the culture plate.' },
  { key: 'inkColor', group: 'Optics', label: 'Organisms', kind: 'colour', level: 'basic', help: 'Colour of the cells themselves.' },
  { key: 'acidColor', group: 'Optics', label: 'Accent', kind: 'colour', level: 'basic', help: 'The single highlight colour, used by the accent channel. It also tints this interface.' },

  // Time
  { key: 'timeScale', group: 'Time', label: 'Time scale', kind: 'range', min: 1, max: 400, step: 1, unit: 'min/s', level: 'basic',
    help: 'Simulated minutes per real second. At 60, one real second is one culture hour.' },
  { key: 'seed', group: 'Time', label: 'Random seed', kind: 'int', min: 0, max: 99999999, level: 'advanced',
    help: 'Same seed and same parameters give an identical run. Change it to resample the same biology.' },
];

/** Colour schemes for the plate. Greyscale first, with one accent. */
export const THEMES: { id: string; label: string; paper: string; ink: string; acid: string }[] = [
  { id: 'clinical', label: 'Clinical', paper: '#fafaf8', ink: '#111111', acid: '#ccff00' },
  { id: 'darkfield', label: 'Darkfield', paper: '#0e0e0d', ink: '#f2f2ee', acid: '#ccff00' },
  { id: 'agarplate', label: 'Agar', paper: '#f4f1e4', ink: '#2a2b22', acid: '#e2410b' },
  { id: 'stain', label: 'Gram stain', paper: '#f7f5f8', ink: '#2d1b53', acid: '#e0197d' },
  { id: 'blueprint', label: 'Blueprint', paper: '#0d2340', ink: '#cfe4ff', acid: '#4de3ff' },
];

/** Named starting points. Each is a legitimate experiment, not a look. */
export const PRESETS: { id: string; label: string; note: string; patch: Partial<Params> }[] = [
  { id: 'default', label: 'Batch culture', note: 'Closed plate. The full lag → log → stationary → death curve.', patch: {} },
  { id: 'swarm', label: 'Swarm hunt', note: 'Cells start at the plate edge and find the type by chemotaxis alone.',
    patch: { species: 'spirillum', inoculum: 'edge', seedDensity: 0.5, chemotaxis: 3, motility: 1.8, diffusion: 0.28, dither: 'floyd', persistence: 0.7, accent: 'energy' } },
  { id: 'biofilm', label: 'Biofilm', note: 'Sticky cocci flood the counters and hold the letterform after the substrate is gone.',
    patch: { species: 'coccus', adhesion: 0.85, motility: 0, diffusion: 0.06, dither: 'bayer4', levels: 3, accent: 'age' } },
  { id: 'mould', label: 'Hyphal overgrowth', note: 'Apical growth. Tips extend and branch; the type is slowly netted over.',
    patch: { species: 'mycelium', inoculum: 'centre', diffusion: 0.1, timeScale: 160, dither: 'bayer8', accent: 'lineage', persistence: 0.4 } },
  { id: 'antibiotic', label: 'Antibiotic sweep', note: 'A drug pulse kills the sensitive majority. Watch resistance sweep the survivors.',
    patch: { species: 'bacillus', mutationRate: 0.12, hgt: 0.02, accent: 'drug', substrate: 4, dither: 'atkinson' } },
  { id: 'senescence', label: 'Replicative ageing', note: 'Budding yeast. Every mother carries her bud scars until she stops.',
    patch: { species: 'yeast', hayflick: 25, asymmetry: 0.85, motility: 0, accent: 'age', levels: 4, dither: 'bayer8', pixelSize: 3, timeScale: 90 } },
  { id: 'predation', label: 'Predation', note: 'Amoebae crawl through a bacterial lawn and eat it.',
    patch: { species: 'amoeba', inoculum: 'scatter', seedDensity: 0.08, motility: 1.4, accent: 'energy', timeScale: 200 } },
  { id: 'thermal', label: 'Thermal vent', note: 'Archaea at 82 °C, where nothing else on this list survives.',
    patch: { species: 'archaeon', temperature: 82, substrate: 4, accent: 'energy', dither: 'jarvis' } },
  { id: 'phototroph', label: 'Photo culture', note: 'Cyanobacteria that ignore the medium and grow toward a light beacon you place.',
    patch: { species: 'cyanobacterium', timeScale: 220, accent: 'energy', tool: 'light', substrate: 0.6, persistence: 0.5 } },
  { id: 'plate', label: 'Dither plate', note: 'No biology. Just the type, put through the dither pipeline.',
    patch: { mode: 'specimen', view: 'plate', dither: 'atkinson', levels: 2, pixelSize: 2, overlay: true } },
  { id: 'dish', label: 'Open dish', note: 'A plain petri dish. Five colonies on soft agar — feed it, poison it, scrape it.',
    patch: { mode: 'dish', species: 'bacillus', agar: 0.25, colonies: 5, dishRichness: 1.4, motility: 1.2, persistence: 0.35, accent: 'energy', timeScale: 30 } },
  { id: 'branching', label: 'Hard agar', note: 'The same organism on stiff agar: no swimming, growth limited by diffusion, colonies go fractal.',
    patch: { mode: 'dish', species: 'bacillus', agar: 0.95, colonies: 3, dishRichness: 0.5, diffusion: 0.05, accent: 'energy', timeScale: 60, dither: 'bayer4' } },
];

/** Milestones. Gamified, but every one of them is a real event in the model. */
export const MILESTONES: { id: string; label: string; note: string }[] = [
  { id: 'first-division', label: 'First division', note: 'A founding cell added enough biomass to split.' },
  { id: 'log-phase', label: 'Exponential phase', note: 'The culture entered balanced, unrestricted growth.' },
  { id: 'ten-gen', label: 'Ten generations', note: 'Mean lineage depth passed ten divisions from the inoculum.' },
  { id: 'biofilm', label: 'Biofilm', note: 'A third of the population crossed the quorum density threshold.' },
  { id: 'capacity', label: 'Carrying capacity', note: 'The plate filled — growth is now limited by space, not food.' },
  { id: 'spores', label: 'Sporulation', note: 'Starving cells went dormant instead of lysing.' },
  { id: 'germination', label: 'Germination', note: 'Dormant spores woke up when food returned.' },
  { id: 'endosymbiosis', label: 'Endosymbiosis', note: 'A phagotroph kept an engulfed prokaryote as an organelle.' },
  { id: 'resistance', label: 'Resistance sweep', note: 'Mean inherited resistance rose above the drug concentration.' },
  { id: 'senescence', label: 'Senescence', note: 'A cell hit its replicative limit and stopped dividing.' },
  { id: 'day', label: 'One culture day', note: 'The plate survived 24 simulated hours.' },
  { id: 'extinct', label: 'Extinction', note: 'Every cell on the plate died. It happens.' },
];
