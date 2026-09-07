/**
 * Sources. Every rule in the simulation traces back to one of these.
 * Where the model simplifies a paper, the entry says so.
 */
export interface Ref { authors: string; year: string; title: string; venue: string; used: string; }

export const REFERENCES: Ref[] = [
  { authors: 'Monod, J.', year: '1949', title: 'The growth of bacterial cultures', venue: 'Annual Review of Microbiology 3:371–394',
    used: 'Growth rate as a saturating function of substrate, µ = µmax·S/(Ks+S). Drives every cell’s energy budget and produces the lag / log / stationary / death curve on its own.' },
  { authors: 'Berg, H. C. & Brown, D. A.', year: '1972', title: 'Chemotaxis in Escherichia coli analysed by three-dimensional tracking', venue: 'Nature 239:500–504',
    used: 'Run-and-tumble motility: ~1 s runs, ~0.1 s tumbles, mean reorientation ≈68°, and tumbling suppressed while the sensed concentration is rising. Cells here steer by biasing tumble probability, never by turning toward the gradient.' },
  { authors: 'Taheri-Araghi, S. et al.', year: '2015', title: 'Cell-size control and homeostasis in bacteria', venue: 'Current Biology 25(3):385–391',
    used: 'The "adder" principle: a cell adds a constant size increment per cycle rather than dividing at a fixed size. Implemented directly as the division rule.' },
  { authors: 'Schaechter, M., Maaløe, O. & Kjeldgaard, N. O.', year: '1958', title: 'Dependency on medium and temperature of cell size and chemical composition during balanced growth of Salmonella typhimurium', venue: 'Journal of General Microbiology 19:592–606',
    used: 'Cell size scales with growth rate. Cells in rich regions of the letterform are visibly fatter than starving ones at the colony edge.' },
  { authors: 'Mortimer, R. K. & Johnston, J. R.', year: '1959', title: 'Life span of individual yeast cells', venue: 'Nature 183:1751–1752',
    used: 'Replicative ageing: a yeast mother produces a finite number of buds (~25) and then stops. The replicative-limit control and bud-scar rendering.' },
  { authors: 'Hayflick, L. & Moorhead, P. S.', year: '1961', title: 'The serial cultivation of human diploid cell strains', venue: 'Experimental Cell Research 25:585–621',
    used: 'Finite replicative capacity in eukaryotic cells generally — the senescent state that cells enter before chronological death.' },
  { authors: 'Sagan (Margulis), L.', year: '1967', title: 'On the origin of mitosing cells', venue: 'Journal of Theoretical Biology 14(3):255–274',
    used: 'Endosymbiosis. Phagotrophic eukaryotes here engulf prokaryotes; a fraction are retained as organelles rather than digested, and the host’s metabolism improves.' },
  { authors: 'Witten, T. A. & Sander, L. M.', year: '1981', title: 'Diffusion-limited aggregation, a kinetic critical phenomenon', venue: 'Physical Review Letters 47:1400–1403',
    used: 'Why colonies branch when nutrient is scarce: growth is limited by diffusive supply, so tips shadow the interior.' },
  { authors: 'Ben-Jacob, E. et al.', year: '1994', title: 'Generic modelling of cooperative growth patterns in bacterial colonies', venue: 'Nature 368:46–49',
    used: 'Colony morphology as a function of substrate and medium hardness — the compact-to-branched transition reproduced by the diffusion and substrate controls.' },
  { authors: 'Miller, M. B. & Bassler, B. L.', year: '2001', title: 'Quorum sensing in bacteria', venue: 'Annual Review of Microbiology 55:165–199',
    used: 'Density-dependent behaviour switch. Above a local density threshold cells raise adhesion and drop motility — the biofilm transition.' },
  { authors: 'Ochman, H., Lawrence, J. G. & Groisman, E. A.', year: '2000', title: 'Lateral gene transfer and the nature of bacterial innovation', venue: 'Nature 405:299–304',
    used: 'Horizontal gene transfer between touching cells, which lets resistance spread across lineages instead of only down them.' },
  { authors: 'Baym, M. et al.', year: '2016', title: 'Spatiotemporal microbial evolution on antibiotic landscapes', venue: 'Science 353(6304):1147–1151',
    used: 'The antibiotic pulse: a lethal step that a rare resistant mutant survives and then sweeps. Resistance is a heritable, mutable trait here for exactly this reason.' },
  { authors: 'Wiser, M. J., Ribeck, N. & Lenski, R. E.', year: '2013', title: 'Long-term dynamics of adaptation in asexual populations', venue: 'Science 342(6164):1364–1367',
    used: 'Fitness keeps improving without bound but with decelerating gains. The trait-drift readout is modelled on the LTEE fitness trajectory.' },
  { authors: 'Ratkowsky, D. A. et al.', year: '1982', title: 'Relationship between temperature and growth rate of bacterial cultures', venue: 'Journal of Bacteriology 149(1):1–5',
    used: 'Square-root temperature response with a notional minimum near 4 °C and a sharp collapse past the optimum.' },
  { authors: 'Turing, A. M.', year: '1952', title: 'The chemical basis of morphogenesis', venue: 'Philosophical Transactions of the Royal Society B 237:37–72',
    used: 'Reaction–diffusion on a grid: substrate diffuses, cells consume it locally, and the resulting instability is what breaks a smooth letterform into structure.' },
  { authors: 'Vicsek, T. et al.', year: '1995', title: 'Novel type of phase transition in a system of self-driven particles', venue: 'Physical Review Letters 75:1226–1229',
    used: 'Local alignment between self-propelled neighbours. The nematic-alignment control is a Vicsek coupling, which is what gives rod colonies their grain.' },
  { authors: 'Bayer, B. E.', year: '1973', title: 'An optimum method for two-level rendition of continuous-tone pictures', venue: 'IEEE International Conference on Communications 1:11–15',
    used: 'The recursive ordered dither matrices, 2×2 through 8×8.' },
  { authors: 'Floyd, R. W. & Steinberg, L.', year: '1976', title: 'An adaptive algorithm for spatial greyscale', venue: 'Proceedings of the SID 17(2):75–77',
    used: 'Error-diffusion dithering. Atkinson and Jarvis–Judice–Ninke are the same algorithm with different error kernels.' },
];
