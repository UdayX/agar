# AGAR

AGAR is a browser-based microbiology playground. Simulated microorganisms grow, move, divide, evolve, sporulate and die on a plate you can feed, poison, seed and watch. Everything is rendered through a dithering pipeline, so the culture reads as a clinical micrograph rather than a game.

## Plate modes

AGAR has two plates, switchable at any time.

- **Specimen mode.** Your typography is the growth medium. Nutrient is laid down inside the letterforms, so the colony eats the type: the text erodes and metamorphoses as the culture grows.
- **Petri dish mode.** An open circular dish you seed, feed, poison and leave to grow. Its own sliders replace the type controls used in specimen mode.

## Organisms

| Organism | Character |
|---|---|
| Bacillus | Motile rod, sporulates when starved |
| Coccus | Non-motile sphere, forms biofilm |
| Spirillum | Fast helical swimmer |
| Cyanobacterium | Photosynthetic filament, feeds on light beacons |
| Archaeon | Thermophile, optimum growth at 80 °C |
| Yeast | Budding fungus, roughly 25-division replicative limit with visible bud scars |
| Mycelium | Fungal, apical tip growth and branching, sporulates |
| Slime mould | Network-forming protist, phagotrophic |
| Amoeba | Large phagotrophic predator |

## Simulation

The simulation is agent-based, off-lattice, and deterministic given a seed.

**Growth and division.** Growth follows Monod kinetics, mu = mu_max × S/(Ks+S), against a substrate field that diffuses on a grid via an explicit five-point Laplacian with no-flux edges. Division follows the "adder" rule: a cell divides once it has added a constant size increment since birth, regardless of its starting size.

**Motility and chemotaxis.** Movement is run-and-tumble: straight runs interrupted by tumbles with a mean reorientation of about 68 degrees. Chemotaxis works only by biasing tumble probability when the sensed concentration is rising — cells never steer directly. Food and light attract, toxin repels, all through the same single sensed quantity.

**Two clocks.** Motion integrates real seconds, since run-and-tumble statistics only make sense against wall-clock time. Biology integrates simulated minutes at a user-set rate. The two run independently.

**Neighbour interactions.** Contact between cells produces soft repulsion, EPS adhesion, Vicsek nematic alignment, horizontal gene transfer, and phagocytosis. Phagotrophs occasionally retain an engulfed prokaryote as an organelle instead of digesting it — an endosymbiosis event that improves the host's growth.

**Quorum sensing.** Above a local density threshold, cells raise adhesion and drop motility.

**Death.** Cells die from starvation, chronological lifespan, replicative senescence (a Hayflick-style limit, expressed for yeast as a bud-scar count), or antibiotic exposure above their inherited MIC. Lysis returns part of the dead cell's biomass to the medium, producing cryptic growth in survivors.

**Sporulation.** Species capable of it go dormant when starved rather than dying. Spores ignore the drug entirely and germinate once food returns.

**Evolution.** Evolution is emergent, not scripted. Six heritable traits — growth rate, substrate affinity, swim speed, adhesion, drug resistance, division size — are perturbed at every division, and selection does the rest.

**Temperature.** Each organism has its own optimum, and its response follows the Ratkowsky square-root model around that optimum.

**Agar hardness.** In dish mode, hardness suppresses swimming and slows the medium, turning a smooth swarm into a branched, diffusion-limited colony.

**Growth curve.** The batch culture produces a real growth curve — lag, exponential, stationary, death — with the current phase classified live and announced.

## Plate tools

The canvas is directly interactive.

| Tool | Action |
|---|---|
| Inspect | Hover to read a cell's genome and state |
| Feed | Paint nutrient onto the plate |
| Toxin | Paint antibiotic onto the plate |
| Light | Drop a beacon that photoautotrophs feed on and swim toward |
| Seed | Paint in new cells |
| Scrape | Remove cells |

Brush size is adjustable for every tool.

## Views

The plate can be viewed as: organisms, a nutrient heatmap, a colony-density heatmap, a toxin heatmap, or type-only, which strips out the biology to show the growth medium alone.

## Dithering

Every frame is passed through one of several dithering kernels: ordered Bayer at 2×2, 4×4 or 8×8, Floyd-Steinberg, Atkinson, Jarvis-Judice-Ninke, white noise, clustered-dot halftone, or none. Tone levels, sample size, contrast, exposure, grain and long-exposure persistence are all adjustable; persistence is what turns swimming cells into visible motility tracks.

Ordered kernels are stable from frame to frame. Error-diffusion kernels re-solve the whole image every frame, which gives them a characteristic shimmer.

## Colour

The interface itself is light greyscale with a single acid accent. The plate offers five colour schemes — Clinical, Darkfield, Agar, Gram stain, Blueprint — plus individual colour pickers for plate, organism and accent. The accent colour is used sparingly: it marks the top of the current distribution, so it only appears where there is real variation to point at.

## Font import

Specimen mode accepts any `.ttf`, `.otf`, `.woff` or `.woff2` file via the browser's FontFace API. Files never leave the machine; nothing is uploaded anywhere.

## Export

| Format | Notes |
|---|---|
| PNG | 1×, 2× or 4× |
| SVG | Cells as real vector geometry — dithering is a raster process and has no vector equivalent, so SVG export omits it |
| WebM | Screen recording via MediaRecorder |
| CSV | Time series of the growth curve |
| JSON | Presets |
| URL | Shareable link encoding only the parameters that differ from the defaults |

## Leave it to grow

The run is deterministic, so AGAR doesn't serialise every cell to keep a culture going while you're away. Instead it stores the parameters and the time you left, then fast-forwards the culture to the correct state when you return.

## Accessibility

Every control is a labelled form element with a persistent description in the accessibility tree. Sliders are a custom component implemented with `role="slider"` and full keyboard support (arrows, Page, Home, End). Phase changes and tool actions are announced through a live region. The canvas carries a descriptive text alternative that updates as the culture changes. Focus rings are visible throughout, and `prefers-reduced-motion` is respected: the culture starts paused and the slider's spring animation is disabled.

## Interaction design

Sliders track the pointer 1:1 and respect where on the thumb it was grabbed. A press elsewhere on the track commits the value instantly and springs the handle to it — interruptibly, from wherever the handle currently sits, using a critically damped spring with a 0.32 s response. Press feedback itself is instant on pointer-down, before any spring settles.

## Keyboard shortcuts

| Key | Action |
|---|---|
| Space | Incubate / pause |
| S | Step one frame |
| R | Reset |
| N | New seed |
| P | Antibiotic pulse |
| E | Export PNG |
| D | Cycle dither kernel |
| 1–6 | Select a plate tool |

## Stack

AGAR is built on Vite 6 and TypeScript with zero runtime dependencies. Rendering is Canvas 2D only — no WebGL, no framework. The whole app is about 88 KB of JavaScript, 31 KB gzipped. A GitHub Actions workflow deploys it to GitHub Pages.

## Running it

```
npm install
npm run dev
npm run build
```

## Where the biology comes from

- Monod (1949). *The growth of bacterial cultures*. Annual Review of Microbiology 3:371-394 — saturating growth kinetics.
- Berg & Brown (1972). *Chemotaxis in Escherichia coli analysed by three-dimensional tracking*. Nature 239:500-504 — run-and-tumble motility.
- Taheri-Araghi et al. (2015). *Cell-size control and homeostasis in bacteria*. Current Biology 25(3):385-391 — the adder division rule.
- Schaechter, Maaloe & Kjeldgaard (1958). *Dependency on medium and temperature of cell size and chemical composition during balanced growth of Salmonella typhimurium*. Journal of General Microbiology 19:592-606 — cell size scaling with growth rate.
- Mortimer & Johnston (1959). *Life span of individual yeast cells*. Nature 183:1751-1752 — replicative ageing and bud scars.
- Hayflick & Moorhead (1961). *The serial cultivation of human diploid cell strains*. Experimental Cell Research 25:585-621 — finite replicative capacity.
- Sagan (Margulis) (1967). *On the origin of mitosing cells*. Journal of Theoretical Biology 14(3):255-274 — endosymbiosis.
- Witten & Sander (1981). *Diffusion-limited aggregation, a kinetic critical phenomenon*. Physical Review Letters 47:1400-1403 — branched colony morphology.
- Ben-Jacob et al. (1994). *Generic modelling of cooperative growth patterns in bacterial colonies*. Nature 368:46-49 — agar hardness and colony form.
- Miller & Bassler (2001). *Quorum sensing in bacteria*. Annual Review of Microbiology 55:165-199 — density-dependent behaviour switch.
- Ochman, Lawrence & Groisman (2000). *Lateral gene transfer and the nature of bacterial innovation*. Nature 405:299-304 — horizontal gene transfer.
- Baym et al. (2016). *Spatiotemporal microbial evolution on antibiotic landscapes*. Science 353(6304):1147-1151 — resistance sweeps after a drug step.
- Wiser, Ribeck & Lenski (2013). *Long-term dynamics of adaptation in asexual populations*. Science 342(6164):1364-1367 — decelerating fitness gains.
- Ratkowsky et al. (1982). *Relationship between temperature and growth rate of bacterial cultures*. Journal of Bacteriology 149(1):1-5 — temperature response.
- Turing (1952). *The chemical basis of morphogenesis*. Philosophical Transactions of the Royal Society B 237:37-72 — reaction-diffusion.
- Vicsek et al. (1995). *Novel type of phase transition in a system of self-driven particles*. Physical Review Letters 75:1226-1229 — nematic alignment.
- Bayer (1973). *An optimum method for two-level rendition of continuous-tone pictures*. IEEE International Conference on Communications 1:11-15 — ordered dither matrices.
- Floyd & Steinberg (1976). *An adaptive algorithm for spatial greyscale*. Proceedings of the SID 17(2):75-77 — error-diffusion dithering.

## Limits

AGAR is a stylised model, not a research tool. Swim speeds carry a legibility scale so motion reads on screen, while run lengths, tumble angles and growth rates keep their published values. The cell cap is a memory ceiling, not a biological one. What looks like 3D is a z-offset with an axonometric tilt, not real volumetric rendering.

## Licence

MIT.
