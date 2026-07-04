/**
 * Motion primitives the surfer's behaviors act through. `DomMotor` is the
 * only thing in the engine that writes to the real DOM — every behavior goes
 * through this interface instead of touching `window`/`document` directly, so
 * tests can swap in a recording fake and assert on commands instead of pixels.
 */

/** A motion primitive the surfer can perform. */
export interface Motor {
	/** Scrolls the page by `px` (negative scrolls up), eased over `ms`. */
	scrollBy: ( px: number, ms: number ) => Promise< void >;
	/** Drifts the pointer along an aimless path for `ms`. */
	pointerDrift: ( ms: number ) => Promise< void >;
	/** Briefly selects a snippet of page text, then clears the selection. */
	selectSnippet: () => Promise< void >;
	/** Plays the page's video, if one is present. */
	playVideo: () => Promise< void >;
	/** Waits `ms` without acting — the surfer's own idle/reading time. */
	idle: ( ms: number ) => Promise< void >;
}

/**
 * Eases progress with a quad in/out curve.
 * @param t Progress, 0–1.
 */
const easeInOutQuad = ( t: number ): number =>
	t < 0.5 ? 2 * t * t : 1 - Math.pow( -2 * t + 2, 2 ) / 2;

/**
 * Waits for the next animation frame, falling back to a short timeout where
 * `requestAnimationFrame` is unavailable (e.g. a backgrounded iframe tab).
 */
const nextFrame = (): Promise< number > =>
	new Promise( ( resolve ) =>
		typeof requestAnimationFrame === 'function'
			? requestAnimationFrame( resolve )
			: setTimeout( () => resolve( performance.now() ), 16 )
	);

/** Production motor: performs real, eased DOM motion. */
export class DomMotor implements Motor {
	async scrollBy( px: number, ms: number ): Promise< void > {
		const start = performance.now();
		let moved = 0;
		let t = 0;

		while ( t < 1 ) {
			const elapsed = performance.now() - start;
			t = ms > 0 ? Math.min( 1, elapsed / ms ) : 1;
			const target = px * easeInOutQuad( t );
			window.scrollBy( 0, target - moved );
			moved = target;

			if ( t < 1 ) {
				await nextFrame();
			}
		}
	}

	async pointerDrift( ms: number ): Promise< void > {
		const start = performance.now();

		while ( performance.now() - start < ms ) {
			const event = new MouseEvent( 'mousemove', {
				bubbles: true,
				clientX: Math.random() * window.innerWidth,
				clientY: Math.random() * window.innerHeight,
			} );
			document.dispatchEvent( event );
			await nextFrame();
		}
	}

	async selectSnippet(): Promise< void > {
		const candidates = Array.from(
			document.querySelectorAll( 'p, li, blockquote' )
		).filter( ( el ) => ( el.textContent ?? '' ).trim().length > 20 );

		if ( candidates.length === 0 ) {
			return;
		}

		const el =
			candidates[ Math.floor( Math.random() * candidates.length ) ];
		const textNode = el.firstChild;
		const selection = el.ownerDocument.defaultView?.getSelection();

		if ( ! textNode || ! selection ) {
			return;
		}

		const range = el.ownerDocument.createRange();
		range.selectNodeContents( textNode );
		selection.removeAllRanges();
		selection.addRange( range );

		await new Promise( ( resolve ) => setTimeout( resolve, 600 ) );
		selection.removeAllRanges();
	}

	async playVideo(): Promise< void > {
		const video = document.querySelector( 'video' );
		await video?.play().catch( () => undefined );
	}

	idle( ms: number ): Promise< void > {
		return new Promise( ( resolve ) => setTimeout( resolve, ms ) );
	}
}
