/**
 * The simulated surfer's cursor. The real pointer is hidden (a `bsb-surfing`
 * class on the root, styled in the course stylesheet) and this draws a fake
 * cursor overlay the engine glides between targets — reading positions, the
 * video, a click. The element's look lives in SCSS; this only creates it,
 * toggles state classes, and positions it (dynamic transform) as it animates.
 */

import { easeInOutQuad, lerp } from './Easing';

/** A fake cursor overlay the engine animates across the page. */
export class Cursor {
	private readonly el: HTMLElement;
	private cx: number;
	private cy: number;

	/**
	 * @param win The window to draw into (defaults to the global).
	 */
	constructor( private win: Window = window ) {
		const doc = win.document;
		doc.documentElement.classList.add( 'bsb-surfing' );

		this.el = doc.createElement( 'div' );
		this.el.className = 'bsb-surf-cursor';
		this.el.setAttribute( 'aria-hidden', 'true' );
		doc.body.appendChild( this.el );

		this.cx = win.innerWidth * 0.5;
		this.cy = win.innerHeight * 0.35;
		this.render();
	}

	/** Positions the overlay at its current coordinates. */
	private render(): void {
		this.el.style.transform = `translate(${ this.cx }px, ${ this.cy }px)`;
	}

	/**
	 * Glides the cursor to a viewport point over `durationMs`.
	 * @param x
	 * @param y
	 * @param durationMs
	 */
	moveTo( x: number, y: number, durationMs: number ): Promise< void > {
		const fromX = this.cx;
		const fromY = this.cy;

		return new Promise( ( resolve ) => {
			if ( durationMs <= 0 ) {
				this.cx = x;
				this.cy = y;
				this.render();
				resolve();
				return;
			}

			const startedAt = performance.now();
			const step = ( nowTs: number ): void => {
				const progress = Math.min(
					1,
					( nowTs - startedAt ) / durationMs
				);
				const eased = easeInOutQuad( progress );
				this.cx = lerp( fromX, x, eased );
				this.cy = lerp( fromY, y, eased );
				this.render();

				if ( progress < 1 ) {
					this.win.requestAnimationFrame( step );
				} else {
					resolve();
				}
			};

			this.win.requestAnimationFrame( step );
		} );
	}

	/** Plays the click pulse (restarting the animation if mid-play). */
	click(): void {
		this.el.classList.remove( 'is-click' );
		// Force reflow so re-adding the class restarts the CSS animation.
		void this.el.offsetWidth;
		this.el.classList.add( 'is-click' );
	}

	/** Removes the overlay and restores the native cursor. */
	destroy(): void {
		this.el.remove();
		this.win.document.documentElement.classList.remove( 'bsb-surfing' );
	}
}
