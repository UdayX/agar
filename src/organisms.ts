/**
 * The organism library.
 *
 * `params.ts` holds what each species *does* in the simulation. This holds what
 * it *is* — the reading matter behind the Learn page. The two are keyed by the
 * same id on purpose: the card you read is the organism you can then culture.
 *
 * Everything stated here is checkable. Where a claim rests on one paper the
 * paper is named in the line itself, so nothing has to be taken on trust.
 */

/** Which signed-distance form the 3D viewer builds for this organism. */
export type Form =
  | 'capsule' | 'cluster' | 'helix' | 'chain'
  | 'spiked' | 'bud' | 'branch' | 'veins' | 'blob';

export interface Lore {
  id: string;              // matches Species.id in params.ts
  name: string;
  latin: string;           // a representative real species, not the whole group
  domain: string;
  form: Form;
  /** One line, the way a museum label reads. */
  lede: string;
  /** Two paragraphs: what it is, then how it behaves. */
  body: [string, string];
  /** Hard numbers for the properties table. */
  props: [string, string][];
  /** Short facts. Each one should be able to survive being looked up. */
  facts: string[];
  /** Why it matters outside the dish. */
  world: string;
  /** Named because the reference is the point. */
  source: string;
}

export const LORE: Lore[] = [
  {
    id: 'bacillus',
    name: 'Bacillus',
    latin: 'Bacillus subtilis',
    domain: 'Bacteria · Firmicutes',
    form: 'capsule',
    lede: 'A rod that would rather sleep for a century than die.',
    body: [
      'A straight rod about half a micrometre across and a few micrometres long, wrapped in flagella that grow from all over its surface. It divides down the middle into two equal daughters, and because the daughters stay lined up with the mother, a growing colony builds itself out of parallel rafts of cells rather than a shapeless smear.',
      'Starve it and it does something almost no other cell can: it copies its chromosome into one end of itself, builds a hard multi-layered coat around that copy, and lets the rest of its own body dissolve. What remains is an endospore — metabolically flat, no measurable respiration, functionally not alive. Add water and food and it germinates within minutes and starts dividing again.',
    ],
    props: [
      ['Size', '0.5 × 2–5 µm'],
      ['Doubling', '≈20–30 min, rich medium'],
      ['Swimming', '≈20–30 µm/s, run and tumble'],
      ['Survival', 'Endospore, indefinite'],
    ],
    facts: [
      'Endospores survive boiling water, desiccation and doses of UV that sterilise everything around them. Autoclaves run at 121 °C specifically because that is what it takes to kill them.',
      'Its close relative Bacillus thuringiensis makes a crystal protein that is lethal to caterpillars and harmless to us. It is the most widely used biological pesticide on Earth, and the Bt in Bt cotton.',
      'The protease in your laundry detergent — subtilisin — is a Bacillus enzyme. It is one of the highest-tonnage enzymes ever manufactured.',
      'Bacillus subtilis natto ferments soybeans into nattō, and has been doing it in Japanese kitchens for roughly a thousand years.',
    ],
    world: 'It is a soil organism first. A gram of ordinary garden soil holds on the order of a billion bacterial cells, and rods like this one are a large part of what turns dead plant matter back into the nitrogen and carbon the next plant will use. Nothing in a forest gets recycled without them.',
    source: 'Sporulation as a developmental programme: Errington, Nature Reviews Microbiology, 2003.',
  },
  {
    id: 'coccus',
    name: 'Coccus',
    latin: 'Staphylococcus / Streptococcus spp.',
    domain: 'Bacteria · Firmicutes',
    form: 'cluster',
    lede: 'A sphere that never leaves home, and builds a city instead.',
    body: [
      'A ball, usually under a micrometre, with no flagella and nowhere to go. What makes cocci interesting is the geometry of how they divide. Split along one plane and the daughters stay in a chain — strepto-. Split along two, and you get sheets and packets. Split along three at random, and you get the irregular grape-bunch that gives Staphylococcus its name.',
      'Because it cannot swim, it invests everything in staying put. It secretes extracellular polymeric substance — a sugar and protein slime — and glues itself to its siblings and to whatever surface it landed on. The result is a biofilm: a structured, layered community with channels running through it, in which cells at the surface behave completely differently from cells buried at the base.',
    ],
    props: [
      ['Size', '0.5–1 µm diameter'],
      ['Doubling', '≈30 min, rich medium'],
      ['Swimming', 'None — sessile'],
      ['Adhesion', 'Heavy EPS matrix'],
    ],
    facts: [
      'Biofilm is the normal condition of bacterial life, not the exception. Free-swimming single cells are the minority state — the dispersal phase between one surface and the next.',
      'Cells inside a mature biofilm can tolerate antibiotic concentrations up to a thousand times what kills the same strain when it is swimming free. The matrix slows the drug, and the starved cells at the base are barely dividing, so drugs that target division have nothing to attack.',
      'Dental plaque is a biofilm you grow yourself, several hundred species thick, and it re-establishes on a clean tooth within hours.',
      'Streptococcus thermophilus and Lactococcus lactis, both cocci, are the reason yoghurt and cheese exist.',
    ],
    world: 'Every surface on this planet that stays wet is coated in one of these. Ship hulls, river stones, water pipes, heart valves, the inside of your mouth. The biofilm is the most common form life takes on Earth and almost none of it is visible to us.',
    source: 'Biofilms as the default mode of growth: Costerton, Stewart & Greenberg, Science, 1999.',
  },
  {
    id: 'spirillum',
    name: 'Spirillum',
    latin: 'Magnetospirillum magneticum',
    domain: 'Bacteria · Proteobacteria',
    form: 'helix',
    lede: 'A corkscrew that navigates, and sometimes uses the planet to do it.',
    body: [
      'A rigid helix with a tuft of flagella at each end. The whole cell body is a screw thread, so when the flagella turn, the organism drives itself forward along its own axis. It is fast, it holds a straight line for a long time, and it reverses direction instead of tumbling.',
      'That long run is a sensing strategy. A bacterium is far too small to measure a chemical gradient across its own length — the difference between its head and its tail is drowned in noise. So it measures across time instead: swim, sample, compare with what you tasted a second ago, and if things are getting better, put off the next turn. Nothing steers. The bias in when to stop turning is the entire navigation system.',
    ],
    props: [
      ['Size', '0.4 × 5–20 µm'],
      ['Doubling', '≈40–60 min'],
      ['Swimming', '45–90 µm/s, reversing'],
      ['Sensing', 'Temporal comparison'],
    ],
    facts: [
      'Magnetospirillum grows a chain of magnetite crystals inside itself, each one a single magnetic domain, aligned into an internal compass needle. It uses the Earth’s field to find the depth it likes rather than to find north.',
      'Some sulphur-oxidising relatives are the fastest bacteria ever measured, at several hundred micrometres per second — hundreds of body lengths every second.',
      'Helicobacter pylori is a helix, and its shape is what lets it drill through stomach mucus. Marshall and Warren proved it caused ulcers by one of them drinking a culture of it, and took the 2005 Nobel Prize for it.',
      'Run-and-tumble was first measured cell by cell by Berg and Brown in 1972, using a microscope that physically chased a single bacterium around a chamber.',
    ],
    world: 'Chemotaxis is the oldest decision-making we know of. A cell with no nervous system, comparing the present to the recent past and acting on the difference, is doing something we would call memory in anything larger.',
    source: 'Chemotaxis by temporal comparison: Berg & Brown, Nature, 1972.',
  },
  {
    id: 'cyanobacterium',
    name: 'Cyanobacterium',
    latin: 'Anabaena / Prochlorococcus spp.',
    domain: 'Bacteria · Cyanobacteria',
    form: 'chain',
    lede: 'The organism that put the oxygen in the sky.',
    body: [
      'A slow, frugal, filamentous bacterium that strings itself into chains and glides rather than swims. It does not eat the medium it sits on. It splits water with sunlight, takes the electrons, and discards the oxygen as waste — the same oxygenic photosynthesis that every plant on Earth performs, invented here first and never improved on.',
      'Some filaments differentiate. Every tenth cell or so becomes a heterocyst: thick-walled, oxygen-free inside, and given over entirely to pulling nitrogen out of the air. The rest of the chain feeds it sugar and it feeds them nitrogen. It is division of labour in an organism with no organs.',
    ],
    props: [
      ['Size', '1–10 µm per cell'],
      ['Doubling', 'Hours to days'],
      ['Swimming', '≈1–5 µm/s, gliding'],
      ['Energy', 'Light, not substrate'],
    ],
    facts: [
      'Around 2.4 billion years ago these cells oxygenated the atmosphere. The Great Oxidation Event was a pollution crisis that killed most of what was alive at the time, and it is the reason you can breathe.',
      'The chloroplast in every leaf and every alga is a cyanobacterium that was engulfed and never digested. It still has its own genome and its own membranes.',
      'Prochlorococcus, less than a micrometre across, is likely the most abundant photosynthetic organism on the planet — on the order of 10²⁷ cells in the oceans, and a meaningful share of the oxygen produced each year.',
      'Stromatolites — layered mounds built by cyanobacterial mats — are among the oldest fossils on Earth, and living ones are still growing in Shark Bay, Western Australia.',
    ],
    world: 'Roughly half the oxygen produced on Earth each year comes from the ocean, and most of that from photosynthetic microbes. Every second breath is theirs. In the simulation, place a light beacon and this is the only organism that cares.',
    source: 'Endosymbiotic origin of chloroplasts: Margulis, On the Origin of Mitosing Cells, 1967.',
  },
  {
    id: 'archaeon',
    name: 'Archaeon',
    latin: 'Pyrococcus furiosus',
    domain: 'Archaea',
    form: 'spiked',
    lede: 'A third kind of life, found by reading it rather than seeing it.',
    body: [
      'Under a microscope it looks like a bacterium. It is not one. In 1977 Carl Woese sequenced ribosomal RNA across the tree of life and found that a set of organisms everyone had filed under "bacteria" were as distant from bacteria as we are — a third domain, sitting closer to us than to them in how they read their own genes.',
      'The difference is in the membrane. Every bacterium and every one of your cells builds its membrane from fatty acids joined to glycerol by ester bonds. Archaea use branched isoprenoid chains joined by ether bonds, which do not come apart in boiling acid. That single chemical decision is most of why the hottest and saltiest places on Earth belong to them.',
    ],
    props: [
      ['Size', '0.3–1 µm'],
      ['Doubling', '≈37 min at 100 °C'],
      ['Optimum', '80–105 °C'],
      ['Membrane', 'Ether-linked isoprenoid'],
    ],
    facts: [
      'Pyrolobus fumarii grows at 113 °C and stops growing when you cool it below 90 °C. Methanopyrus kandleri has been reported dividing at 122 °C under pressure.',
      'The high-fidelity Pfu polymerase used in molecular biology comes from Pyrococcus furiosus, pulled out of a geothermal marine sediment off Italy.',
      'Methanogenic archaea produce almost all of the biological methane on Earth — in wetlands, in rice paddies, in landfill, and in the rumen of every cow.',
      'They live in you. Methanobrevibacter smithii is a normal member of the human gut, feeding on the hydrogen your bacteria leave behind.',
    ],
    world: 'Archaea were invisible for a century not because they are rare but because nobody could grow them. Most of the microbial world still cannot be cultured, and is known only from sequence. In the simulation, push the temperature past 70 °C and watch the plate change hands.',
    source: 'The third domain: Woese & Fox, PNAS, 1977.',
  },
  {
    id: 'yeast',
    name: 'Yeast',
    latin: 'Saccharomyces cerevisiae',
    domain: 'Eukarya · Fungi',
    form: 'bud',
    lede: 'A single cell with a countable lifespan.',
    body: [
      'A eukaryote — nucleus, mitochondria, the whole apparatus — living as one round cell a few micrometres across. It does not divide down the middle. It grows a bud out of its own wall, sends a copied nucleus into it, and pinches it off, leaving a permanent chitin ring on the mother where the bud was attached.',
      'Those rings accumulate. A mother cell wears every one of her bud scars for the rest of her life, and after roughly twenty to thirty of them she stops dividing altogether and enters senescence. You can count the scars and know how much life a cell has left, which is why so much of what is known about ageing was learned in a fungus.',
    ],
    props: [
      ['Size', '3–5 µm diameter'],
      ['Doubling', '≈90 min'],
      ['Swimming', 'None'],
      ['Replicative limit', '≈20–30 divisions'],
    ],
    facts: [
      'Mortimer and Johnston established the replicative lifespan in 1959 by physically pulling daughter cells off a mother with a micromanipulator, one division at a time, and counting.',
      'It was the first eukaryotic genome ever fully sequenced, finished in 1996 by a consortium of over a hundred labs.',
      'The genes that control the cell cycle were found here and in fission yeast. Hartwell, Nurse and Hunt took the 2001 Nobel Prize for it, and those same genes are the ones that go wrong in cancer.',
      'Bread, beer and wine are all this one species. It has been under domestication for something like nine thousand years, which makes it older as a crop than most grains.',
    ],
    world: 'Ageing here is not an abstraction. It is a number of divisions you can watch tick down. Turn on the replicative limit in the simulation and the colony stops being immortal — mothers stall, the population plateaus, and the plate develops a demography.',
    source: 'Replicative lifespan in yeast: Mortimer & Johnston, Nature, 1959.',
  },
  {
    id: 'mycelium',
    name: 'Mycelium',
    latin: 'Armillaria / Rhizoctonia spp.',
    domain: 'Eukarya · Fungi',
    form: 'branch',
    lede: 'Not a shape. A search strategy with a body.',
    body: [
      'A fungus does not grow the way an animal or a plant does. It extends only at the very tips of its hyphae — threads a few micrometres wide — pushing forward by delivering vesicles to the apex and inserting new wall exactly there. Everything behind the tip is finished masonry and never grows again.',
      'Branch at a fixed angle, repeat, and you get a network that explores space with no plan and no centre. Where a hypha finds food, that branch thickens and the network reinforces the route; where it finds nothing, the branch is abandoned. The organism has no idea where it is going and finds things anyway.',
    ],
    props: [
      ['Hypha width', '2–10 µm'],
      ['Extension', 'Apical only'],
      ['Doubling', 'Hours (biomass)'],
      ['Adhesion', 'Near total'],
    ],
    facts: [
      'The largest organism on Earth is a honey fungus, Armillaria ostoyae, in the Malheur National Forest in Oregon. One genetic individual spans roughly 965 hectares and is estimated to be several thousand years old.',
      'Around nine in ten land plant species are wired into mycorrhizal fungi. The plant supplies sugar; the fungus supplies phosphorus and nitrogen it can reach and the root cannot.',
      'Fungi are the main organisms on Earth capable of breaking down lignin. Before they evolved that ability, dead wood did not rot — it piled up, and became the coal we are still burning.',
      'A single gram of forest soil can hold hundreds of metres of hyphae, laid end to end.',
    ],
    world: 'Almost all terrestrial nutrient cycling passes through a fungus at some point. In the simulation this is the organism that will hold a letterform together long after everything else has starved — it grows slowly, it never lets go, and it sporulates rather than dying.',
    source: 'Apical growth and the hyphal tip: Bartnicki-García, in Fungal Morphogenesis, 1973.',
  },
  {
    id: 'slime',
    name: 'Slime mould',
    latin: 'Physarum polycephalum',
    domain: 'Eukarya · Amoebozoa',
    form: 'veins',
    lede: 'One cell, many nuclei, no neurons, and a talent for shortest paths.',
    body: [
      'A plasmodium: a single continuous cell containing millions of nuclei that never bothered to build walls between them. It crawls as a sheet, pulls itself into a network of veins, and streams its own cytoplasm back and forth through those veins — the flow reverses roughly every two minutes, driven by waves of contraction running through the whole body.',
      'The network is the computation. Veins that carry more flow thicken; veins that carry less are reabsorbed. Put food at two points and the organism will, without anything resembling a brain, resolve itself into an efficient connection between them.',
    ],
    props: [
      ['Cell type', 'Single, multinucleate'],
      ['Size', 'Millimetres to metres'],
      ['Streaming', 'Reverses ≈every 2 min'],
      ['Neurons', 'None'],
    ],
    facts: [
      'Nakagaki showed in 2000 that Physarum will solve a maze — placed throughout it and given food at two ends, the organism withdraws from the dead ends and leaves a tube along the shortest route.',
      'In 2010 Tero laid oat flakes on a map of the Tokyo area at the positions of the rail stations. The network the organism grew was comparable to the actual rail network for cost, efficiency and fault tolerance.',
      'It has a form of externalised memory: it lays down extracellular slime as it moves and avoids ground it has already covered, so it does not re-search where it has been.',
      'It won the 2008 Ig Nobel Prize in Cognitive Science, and then the follow-up work was published in Science.',
    ],
    world: 'This is the clearest case in biology that problem-solving does not require a brain — only a body whose growth rules respond to what it finds. In the simulation it crawls as a connected sheet, engulfs what it meets, and is very hard to kill.',
    source: 'Maze-solving by an amoeboid organism: Nakagaki, Yamada & Tóth, Nature, 2000.',
  },
  {
    id: 'amoeba',
    name: 'Amoeba',
    latin: 'Amoeba proteus',
    domain: 'Eukarya · Amoebozoa',
    form: 'blob',
    lede: 'The predator on the plate, and the ancestor of your immune system.',
    body: [
      'A large naked cell with no fixed shape, moving by pushing out pseudopods — extensions driven by actin filaments polymerising against the inside of the membrane while the rear is pulled in. It is the same molecular machinery your own cells use to crawl through tissue.',
      'It eats by flowing around things. The pseudopods close over a bacterium, fuse behind it, and the prey ends up in a vesicle inside the cell that is then acidified and digested. That process is phagocytosis, and it is the oldest form of eating we know of.',
    ],
    props: [
      ['Size', '250–800 µm'],
      ['Doubling', '≈8 hours'],
      ['Crawling', '≈1–5 µm/s'],
      ['Feeding', 'Phagocytosis'],
    ],
    facts: [
      'Élie Metchnikoff worked out phagocytosis in the 1880s from starfish larvae and drew the connection to our own white blood cells. He shared the 1908 Nobel Prize for it. Your macrophages eat exactly the way an amoeba does.',
      'Amoeba proteus is large enough to see with the naked eye as a moving speck — unusual for a single cell.',
      'Soil amoebae grazing on bacteria release nitrogen the bacteria had locked up, which is a significant route by which plants get fed. The predator is part of the fertiliser.',
      'Legionella evolved to survive being eaten by amoebae. That is precisely why it can survive inside a human macrophage — the human lung was never the target, it was an accident of similarity.',
    ],
    world: 'Predation is what turned a soup of cells into an ecosystem. In the simulation, drop an amoeba into a bacterial lawn and watch the population curve stop being a smooth batch culture and start oscillating.',
    source: 'Phagocytosis and cellular immunity: Metchnikoff, Leçons sur la pathologie comparée de l’inflammation, 1892.',
  },
];

export const loreById = (id: string): Lore | undefined => LORE.find((l) => l.id === id);
