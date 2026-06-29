/**
 * Surf engine entry point — the bundle enqueued on every course page.
 *
 * It only does anything when the cockpit armed the page (the `bsbRun` URL flag),
 * so a course page opened directly stays a plain, inert article. When armed, it
 * parses the run parameters off the URL and drives one trait-shaped visit, then
 * the cockpit advances to the next page (which loads this bundle again).
 */

import { parseRunParams } from './RunParams';
import { Surfer } from './Surfer';

const params = parseRunParams( window.location.search );

if ( params.armed ) {
	const start = (): void => {
		void new Surfer( params ).run();
	};

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', start, { once: true } );
	} else {
		start();
	}
}
