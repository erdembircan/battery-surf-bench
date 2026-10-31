// The plugin's finish chime formula (src/cockpit/FinishChime.ts), shared by
// sfx.mjs and qc.mjs.
import { SR } from './lib.mjs';

// The plugin's finish chime, exactly (FinishChime.ts): sine 880 / 1108.73 / 1318.51 Hz,
// 0.12 s stagger; gain 0 → 0.22 linearly over 0.02 s, then exponentially to 0.0001 at
// 0.45 s after the note's start; oscillator stops at 0.5 s.
export const CHIME = { NOTES: [ 880, 1108.73, 1318.51 ], STAGGER: 0.12, PEAK: 0.22, ATTACK: 0.02, DECAY: 0.45, FLOOR: 0.0001, STOP: 0.5 };
export function chimeNote( f, i ) {
	const tt = i / SR;
	const { PEAK, ATTACK, DECAY, FLOOR, STOP } = CHIME;
	if ( tt >= STOP ) return 0;
	let g;
	if ( tt <= ATTACK ) g = ( PEAK * tt ) / ATTACK;
	else if ( tt <= DECAY ) g = PEAK * Math.pow( FLOOR / PEAK, ( tt - ATTACK ) / ( DECAY - ATTACK ) );
	else g = FLOOR;
	return Math.sin( 2 * Math.PI * f * tt ) * g;
}
