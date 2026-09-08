/**
 * The attributions page. Static — it only renders the reference list and the
 * wordmark, so it shares nothing with the simulation bundle.
 */
import './style.css';
import { buildRefs } from './ui';
import logoUrl from './AgarLogo.svg';

const logo = document.getElementById('logo') as HTMLImageElement | null;
if (logo) logo.src = logoUrl;

const refs = document.getElementById('refs');
if (refs) buildRefs(refs);
