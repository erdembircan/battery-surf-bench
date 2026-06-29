/**
 * Eased document scrolling — the wheel-flick bursts the surfer makes. Each burst
 * animates the window scroll over a short duration with the shared ease so it
 * reads as a human flick rather than a teleport. Pure motion maths lives in
 * Easing; this only drives the window.
 */

import { easeInOutQuad, lerp } from './Easing';

/** Scrolls the document window in eased bursts. */
export class Scroller {
	/**
	 * @param win The window to scroll (defaults to the global).
	 */
	constructor( private win: Window = window ) {}

	/** The furthest the document can scroll. */
	get maxScroll(): number {
		const doc = this.win.document.documentElement;

		return Math.max( 0, doc.scrollHeight - this.win.innerHeight );
	}

	/** The current scroll position. */
	get position(): number {
		return this.win.scrollY;
	}

	/**
	 * Scrolls by `deltaPx` (negative to scroll up) over `durationMs`, clamped to
	 * the scrollable range. Resolves when the burst settles.
	 * @param deltaPx
	 * @param durationMs
	 */
	burst( deltaPx: number, durationMs: number ): Promise< void > {
		const from = this.win.scrollY;
		const to = Math.max( 0, Math.min( this.maxScroll, from + deltaPx ) );

		return new Promise( ( resolve ) => {
			if ( durationMs <= 0 || from === to ) {
				this.win.scrollTo( 0, to );
				resolve();
				return;
			}

			const startedAt = performance.now();
			const step = ( nowTs: number ): void => {
				const progress = Math.min(
					1,
					( nowTs - startedAt ) / durationMs
				);
				this.win.scrollTo(
					0,
					lerp( from, to, easeInOutQuad( progress ) )
				);

				if ( progress < 1 ) {
					this.win.requestAnimationFrame( step );
				} else {
					resolve();
				}
			};

			this.win.requestAnimationFrame( step );
		} );
	}
}
