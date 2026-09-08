/**
 * The attributions page. Static — it only renders the reference list and the
 * wordmark, so it shares nothing with the simulation bundle.
 */
import './style.css';
import { buildRefs } from './ui';
import logoUrl from './AgarLogo.svg';

// Arriving on a sub-page is still an arrival. Claim the lab's boot flag so the
// five-second culture sequence does not replay on top of a page transition
// when someone crosses back over. (The key belongs to loader.ts; importing it
// would drag the dither pipeline and the boot logo into this bundle for one
// string.)
try { sessionStorage.setItem('agar.booted', '1'); } catch { /* private mode */ }

const logo = document.getElementById('logo') as HTMLImageElement | null;
if (logo) logo.src = logoUrl;

const refs = document.getElementById('refs');
if (refs) buildRefs(refs);
