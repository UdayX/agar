# AGAR, explained

A plain-language companion to the [README](README.md). The README says *what*
AGAR does. This says *what it is*, *what rules built it*, and *what to answer
when someone asks how you made it*.

---

## Part 1 — Explain it like I'm five

Imagine a jelly plate, the kind a scientist grows things on.

Now imagine you write a word on that jelly — **SHIP**, or your own name — and
the word is made of **food**.

Then you drop in some tiny invisible creatures. They are hungry.

They find the word. They eat it. While they eat, they grow fatter, and when
they are fat enough they **split in two**. Now there are twice as many. Then
four times. Then thousands. They crawl along the letters, eating the shapes
away, and the word slowly turns into something else — a frilly, furry,
blotchy version of itself.

Then the food runs out.

The creatures get thin. Some of them turn into little hard seeds and wait.
Some get old and stop having babies. Some get eaten by bigger creatures. And
in the end the plate goes quiet, and whatever shape they left behind is the
picture you keep.

**That's AGAR.** Your typography is the dinner. The living things are the
illustrator. You can feed them, poison them, warm them up, shine a light for
them, give them a different species, and then save the picture as a PNG, or a
wallpaper, or a little video.

It is not a filter that *pretends* to be alive. The creatures are really
there, each one its own little dot with its own hunger and its own age, and
nobody — not even the person who made it — knows exactly what the picture will
look like before it finishes growing.

### The one-sentence version for grown-ups

> AGAR is a browser-based microbiology simulator where real agent-based
> biology (growth kinetics, chemotaxis, evolution, senescence, death) uses
> your typography as its growth medium, rendered as a clinical micrograph —
> part instrument, part generative type tool.

---

## Part 2 — The rules, why they existed, and what they did to the project

Every rule here was a constraint accepted *up front*. That matters: these are
not post-hoc explanations, they are the fences the work was built inside, and
almost every interesting thing about AGAR is a side effect of one of them.

### Rule 1 — Zero runtime dependencies

**The rule.** Nothing in `package.json` ships to the browser. The only
dependencies are TypeScript and Vite, both build-time only.

**Why.** Three reasons. A tool about *life as its most primitive building
blocks* should itself be built from primitives. A page that must run on a weak
laptop cannot afford 300 KB of framework before the first cell divides. And a
dependency is a stranger with commit access to your site.

**What it did.**
- No React, no GSAP, no Three.js, no d3. The sliders, tabs, tooltips, charts,
  loader, tour and 3D organism viewer are all hand-built.
- The 3D organisms on the Learn page are **raw WebGL 1** — hand-written
  vertex and fragment shaders, hand-rolled matrix maths. Three.js would have
  been a quarter of the code and ten times the bytes.
- The whole site, nine organisms and two render pipelines included, is about
  **8,000 lines**, and the dependency audit surface is zero.
- Cost paid honestly: everything took longer, and bugs that a library would
  have absorbed (a slider that mis-rounds, a tooltip that escapes the
  viewport) had to be found by hand.

### Rule 2 — Emil Kowalski's animation rules, with no exceptions

**The rule.** Motion follows the design-engineering discipline from
[animations.dev](https://animations.dev): animate only `transform`, `opacity`,
`filter` and `clip-path`; UI motion stays under 300 ms; `ease-out` for things
entering, `ease-in-out` for things moving, never `ease-in`; custom cubic-bezier
curves, never the browser defaults; never animate from `scale(0)`; and —
the hardest one — **animate nothing a person does a hundred times a day**.

**Why.** Because a tool that fights you is not experiential, it is annoying.
An animation that delights on the first use is an obstacle on the fortieth.

**What it did.**
- Tab switching, slider dragging and keyboard actions have **no entrance
  animation at all**. They are the actions a user repeats constantly, so they
  are instant.
- Buttons press with `transform: scale(0.97)` over ~160 ms — enough feedback to
  feel heard, too short to wait for.
- Everything that *does* animate uses `cubic-bezier(.23, 1, .32, 1)`, a
  stronger ease-out than any CSS keyword, so the motion has intent rather than
  drifting.
- The entire interface runs on CSS transitions rather than keyframes, because
  transitions can be interrupted and retargeted mid-flight. Click a panel open
  and immediately closed and it reverses from where it actually is.
- `prefers-reduced-motion: reduce` is not a checkbox here: the simulation
  itself stops moving, and instead grows a culture to maturity and shows **one
  still frame**. A motion-sensitive visitor gets a finished specimen, not a
  frozen empty plate.

### Rule 3 — Accessibility is part of the instrument, not a pass at the end

**The rule.** Every control labelled, every state announced, every path
keyboard-reachable, every focus ring visible, contrast checked.

**Why.** A canvas full of moving dots is the single most hostile thing you can
put on a web page for a screen-reader user. If the tool is a *symphony of
human understanding*, it cannot be understandable to one kind of human only.

**What it did.**
- A single `say()` function pushes plain-English sentences into an
  `aria-live` region: *"Exponential phase. Eleven thousand cells."* The
  simulation narrates itself.
- Every slider has a real `<label>`, a real value, and arrow-key control.
- `.visually-hidden` spans carry the context a sighted user gets from layout —
  every "opens in a new tab", every unit, every state.
- Phase changes, milestones and copy confirmations all speak.
- Cost paid honestly: this is invisible work. It is also the work that makes
  the difference between a demo and a tool.

### Rule 4 — The science is the source of truth, and it is credited

**The rule.** Where real microbiology has a named model, use the named model.
Where a fact is borrowed, cite it.

**Why.** Anyone can make dots wobble. The moment the dots obey Monod kinetics,
the picture starts telling the truth about something, and "generative art"
becomes "instrument".

**What it did.**
- Growth is **Monod kinetics**. Division is the **adder rule** (a cell splits
  after adding a fixed increment, not at a fixed size — the result that
  replaced "sizer" models in the 2010s). Movement is **run-and-tumble** with a
  ~68° mean reorientation, and chemotaxis works the way it really works: cells
  cannot steer, they can only tumble less often when things are improving.
  Ageing is a **Hayflick-style replicative limit**, shown on yeast as visible
  bud scars. Alignment is **Vicsek**. There is horizontal gene transfer,
  quorum sensing, phagocytosis, and occasional **endosymbiosis** when a
  predator keeps its prey instead of digesting it.
- Because the biology is real, the *failures* are real too: antibiotic
  resistance sweeps a population, cryptic growth feeds survivors on the lysed
  dead, and every closed plate eventually dies. None of that was designed as a
  feature. It fell out of the model.
- There is a whole **Learn** page and an **Attributions** page, because
  borrowed knowledge gets a name on it.

### Rule 5 — It must run on hardware nobody is proud of

**The rule.** A slow laptop gets a working plate, not a slideshow.

**Why.** "Experiential" is meaningless at 9 fps. And the people most likely to
open a strange typographic biology lab on a whim are not on a workstation.

**What it did.**
- A tiny performance module measures the device and returns a **budget**: a
  cell cap and a minimum dither pixel size. Every plate, including embeds,
  clamps itself to that budget before the first frame.
- Frame times are sampled continuously, so the tier can drop under load
  instead of stuttering forever.
- The dither pipeline is doing double duty: it is the clinical micrograph look
  *and* it is the thing that lets a cheap machine draw fewer, bigger pixels
  without looking broken. The aesthetic and the optimisation are the same
  decision.

### Rule 6 — Determinism: same seed, same culture, forever

**The rule.** One seeded RNG. No `Math.random()` anywhere in the simulation —
the single call in the whole project picks a *new* seed when you ask for one,
and everything after that is reproducible.

**Why.** Without this, nothing downstream works. A share link that reproduces
someone else's exact plate requires that the plate be reproducible at all.

**What it did.**
- A share link carries the setup as a compact `#p=` fragment that holds only
  what differs from the defaults — short links, and old links keep working
  because an unknown parameter degrades to its default instead of breaking.
- The same fragment, with no extra machinery, is what makes the **embed**
  work: one encoding, three readers.
- A happy accident — because only the diff is encoded, the parameter *names*
  became a public contract the moment the first embed went on someone else's
  page. They are now effectively append-only.

### Rule 7 — Don't overwhelm anyone

**The rule.** The tool has hundreds of controls. A first-time visitor must
meet about five of them.

**Why.** A wall of sliders reads as *someone else's* instrument. The
simulation needs to be the thing you look at, not the chrome.

**What it did.**
- Controls live in **tabs**, so depth is available but never on screen at
  once. **Presets** mean a visitor can see "Antibiotic sweep" or "Predation"
  without knowing what a Monod constant is.
- A guided **tour** exists for people who want to be walked through it, and
  can be ignored entirely by people who don't.
- The canvas is the hero on every viewport. Chrome shrinks before the plate
  does.

### Rule 8 — Verify before every commit; never ask the user to check

**The rule.** Build clean, load the page, read the console, click the thing,
*then* commit. No "this should work".

**Why.** "Should work" is how a repo rots. And on a visual tool, the only
honest verification is looking at it.

**What it did.**
- This caught the most dangerous bug in the project. The embed snippet shipped
  with `sandbox="allow-scripts allow-popups"` — which looks tighter and more
  responsible, and which rendered a **blank box on every host page**. It was
  found by building a test host page with a sandboxed frame beside an
  unsandboxed one and looking at both. The fix was adding
  `allow-same-origin`, which is not a hole for a cross-origin frame and
  cannot be removed: without it the frame gets an opaque origin, and an
  opaque origin matches no `'self'` in the page's own content policy.
- It also enforced honesty about what *couldn't* be checked. Continuous motion
  is unverifiable in a hidden browser pane, because a hidden pane delivers
  **zero animation frames** — measured with a counter, not assumed. That got
  reported as a gap rather than claimed as a pass.

### Rule 9 — Take the laziest rung that holds

**The rule.** Before building a thing, ask whether it needs to exist; then
whether the codebase already does it; then whether the platform already does
it. Build only what is left.

**Why.** Every line is a line someone has to debug at 3am.

**What it did.** The clearest example is the embed. "Let people put AGAR on
their own site" sounds like: publish an npm package, pick a React version,
maintain a build, document props, version it forever.

What actually shipped is an **iframe** — about twelve lines of JSX — pointed
at a chrome-less page that reads the share payload AGAR already had. No
package, no React dependency, no build for anyone to inherit, no version to
match, and as a bonus a real origin boundary between a stranger's page and
several thousand lines of canvas code. The React component is a convenience
wrapper, and it is honest about being one.

---

## Part 3 — Why the project is good

Not "why it's pretty". Why it holds up.

**1. The concept and the constraint are the same thing.** Dithering is the
clinical-micrograph aesthetic *and* the low-end performance strategy. Zero
dependencies is the "primitive building blocks" thesis *and* the load-time
budget. Determinism is a purity principle *and* the only reason share links
and embeds can exist. When the artistic and engineering answers coincide, the
project has found its actual shape.

**2. The outcomes are not authored.** Nobody drew the frilled edge on an
eroded **S**. It is what happens when run-and-tumble chemotaxis meets a
nutrient field shaped like a letter. The tool produces things its author did
not design and cannot fully predict — which is the difference between a
generative system and a preset.

**3. It takes its own subject seriously.** Named models, cited sources, a
Learn page with real behaviour and real ecology, 3D organism views. It would
have been easy to make "bacteria-ish wobble". The real models cost more and
are why the thing teaches instead of decorating.

**4. It is finishable work, not a demo.** Specimen mode and petri mode, nine
organisms, five palettes, a dozen presets, PNG/wallpaper/video export, a
share link, an embed, a learn library, an attributions page, a guided tour, a
performance tier, a reduced-motion path, keyboard access and live
announcements. Shipped, on a public URL, with the security review done.

**5. The accessibility and performance work is real, and it was not a pass at
the end.** A simulation that narrates itself in English and a dither pipeline
that scales down to cheap hardware are both load-bearing, not garnish.

**6. The restraint is visible.** Hundreds of parameters, five visible on
arrival. An embed that is an iframe instead of a package. No animation on the
actions people repeat. Knowing what *not* to put on screen is the part that
cannot be faked.

---

## Part 4 — Questions you'll be asked, and answers that hold

### "What is it, in one breath?"

A microbiology simulator where your typography is the food. Real agent-based
biology — growth, chemotaxis, evolution, ageing, death — eats the letterforms
and leaves a specimen you can export. It runs in a browser with zero
dependencies.

### "Why typography? Why not just a petri dish?"

Because the dish alone is a screensaver. The letterform is what gives the
simulation a *subject*: you arrive with a word you care about, and the biology
does something to it that you did not author. There is a petri mode too — it
is the one you use once you have stopped reading and started watching.

### "What was the hardest part?"

Two different things, and they were hard for opposite reasons.

The simulation was hard because biology has to stay coherent under
composition. Growth, diffusion, chemotaxis, adhesion, gene transfer,
predation, senescence and death all touch the same cells each frame, and any
one of them pushed too far makes the other eight meaningless — infinite
growth, instant extinction, a plate that locks solid. Two independent clocks
(motion in real seconds, biology in simulated minutes) came out of that, since
run-and-tumble statistics only make sense against wall-clock time.

The interface was hard because the tool is deep and first impressions are
shallow. Hundreds of parameters have to stay reachable by an expert while
staying invisible to someone who arrived ten seconds ago.

### "How do you know the science is right?"

It uses published models by name rather than approximations by feel — Monod
kinetics, the adder division rule, run-and-tumble with a measured mean
reorientation angle, Hayflick-style replicative limits, Vicsek alignment —
and those sources are credited on an attributions page. The honest claim is
**"the right models, qualitatively"**: it reproduces the behaviour those
models predict (lag/log/stationary/death, resistance sweeps, cryptic growth,
fractal colonies on stiff agar), not quantitative values you would publish.
That is the correct bar for an instrument you look at rather than a paper you
submit.

### "Why no framework? Isn't that a waste of time?"

It would be, if the page were a form. For this page the framework is the
wrong shape: the hot loop is one canvas being redrawn sixty times a second
from thousands of agents, which is exactly the work a virtual DOM cannot help
with and a 300 KB bundle actively hurts. Zero dependencies also means the
load budget goes to the simulation, nothing to audit, and nothing to upgrade.
I paid for it in hand-written sliders and hand-written WebGL.

### "How does it run on a bad machine?"

It measures the device and hands the plate a budget — a maximum cell count and
a minimum dither pixel size — before the first frame, and samples frame times
continuously so the tier can drop under load. The dither pipeline means
drawing fewer, larger pixels still looks deliberate instead of broken, so
degradation reads as a different magnification rather than a failure.

### "What's the embed, and why an iframe instead of a package?"

Copyable React and plain-HTML snippets that frame a chrome-less AGAR page
carrying your exact setup in the URL. An iframe because the alternative —
publishing a package — buys nothing here and costs a React peer dependency, a
build step, a versioning commitment, and a maintenance surface, while an
iframe adds a real origin boundary around several thousand lines of canvas
code. The snippet is sandboxed, the frame cannot navigate the host page, and
its only capability is opening the lab in a new tab.

### "What would you do differently?"

Three honest ones.

The share-link parameter names became a public contract the moment the first
embed landed on a stranger's page, and I would design that encoding knowing
it is append-only forever rather than discovering it afterwards. Embeds track
the live build with no version pinning, which is the right call for a hobby
lab and the wrong one for anything anybody depends on. And the main entry
module is the one place where growth outpaced structure — it does boot,
wiring and orchestration, and it should be three files.

### "Is it done?"

It is shipped and coherent, which is a better word than done. Known accepted
limits: clickjacking cannot be fully prevented on static GitHub Pages hosting
because the host serves no headers I control, and embeds follow the live build
rather than a pinned version. Both are written down rather than discovered by
someone else.

### "What did you actually learn?"

That the constraint list *is* the design document. Every decision worth
defending in AGAR — the dithering, the hand-written WebGL, the iframe embed,
the still frame under reduced motion, the five visible sliders — came from a
rule accepted before the work started, not from taste applied after. Taste
decided which rules to accept. The rules did the rest.
