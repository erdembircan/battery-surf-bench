/**
 * Motion primitives the surfer's behaviors act through. `DomMotor` is the
 * only thing in the engine that writes to the real DOM — every behavior goes
 * through this interface instead of touching `window`/`document` directly, so
 * tests can swap in a recording fake and assert on commands instead of pixels.
 */

import type { Rng } from './Rng';
import { FakeCursor, framesForDistance, type Point } from './FakeCursor';
import { easeInOutQuad } from './Ease';
import { contentRoot, VIDEO_EMBED_SELECTOR } from './Affordances';
import { createVideoControl, type VideoControl } from './VideoControl';

/** A motion primitive the surfer can perform. */
export interface Motor {
	/** Scrolls the page by `px` (negative scrolls up), eased over `ms`. */
	scrollBy: ( px: number, ms: number ) => Promise< void >;
	/** Drifts the pointer along an aimless path for `ms`. */
	pointerDrift: ( ms: number ) => Promise< void >;
	/** Briefly selects a snippet of page text, then clears the selection. */
	selectSnippet: () => Promise< void >;
	/**
	 * Picks one video or video-host embed at random from ALL of them on the
	 * page (not just the first), attends it (scrolls into view, approaches
	 * with the cursor, once) and starts it. Disposes any previously active
	 * control first, so replaying this on a new watch cycle never leaks a
	 * stale listener. Subscribes the started control's `onEnded` to replay
	 * itself for as long as it stays active — a video that ends mid-watch
	 * rewatches itself with no polling involved.
	 */
	playVideo: () => Promise< void >;
	/**
	 * Fully stops (unsubscribes the `onEnded` auto-replay, stops, then
	 * disposes) whatever `playVideo` last started, if anything. A safe
	 * no-op when nothing was started (never called, or the page had no
	 * video).
	 */
	stopVideo: () => Promise< void >;
	/**
	 * Attends a content image: scrolls it into view if needed, travels the
	 * cursor onto it, and dwells there for the remainder of `ms`. Falls back
	 * to an aimless drift when the page offers no image to linger on.
	 */
	lingerImage: ( ms: number ) => Promise< void >;
	/**
	 * Reads the page's prose for `ms`, passage by passage: picks a readable
	 * block, brings it into view when it sits off-screen, dwells on it in
	 * proportion to its own length — sometimes tracking its lines with the
	 * cursor, sometimes resting beside them — then moves to the next, with
	 * an occasional slow creep of the page in between. Falls back to a
	 * still idle when the page offers nothing readable.
	 */
	read: ( ms: number ) => Promise< void >;
	/** Waits `ms` without acting — the surfer's own idle/reading time. */
	idle: ( ms: number ) => Promise< void >;
}

/**
 * Waits for the next animation frame, falling back to a short timeout where
 * `requestAnimationFrame` is unavailable (e.g. a backgrounded iframe tab).
 */
const nextFrame = (): Promise< void > =>
	new Promise( ( resolve ) =>
		typeof requestAnimationFrame === 'function'
			? requestAnimationFrame( () => resolve() )
			: setTimeout( resolve, 16 )
	);

/** Assumed animation-frame length, for converting a duration to a frame count. */
const FRAME_MS = 16;

/**
 * Converts a duration to a frame count at {@link FRAME_MS} per frame, never
 * fewer than one so a zero/negative duration still completes.
 * @param ms
 */
const msToFrames = ( ms: number ): number =>
	Math.max( 1, Math.round( ms / FRAME_MS ) );

/** Radius band each `pointerDrift` wander leg's random offset is drawn from, in px. */
const WANDER_RADIUS_MIN_PX = 80;
const WANDER_RADIUS_MAX_PX = 280;

/** Kept clear of the viewport edge, so a wander target never aims off-screen, in px. */
const WANDER_EDGE_MARGIN_PX = 20;

/** Micro-pause between wander legs, in ms, so drift reads as wander-pause-wander. */
const WANDER_PAUSE_MS_MIN = 100;
const WANDER_PAUSE_MS_MAX = 350;

/**
 * A wander target offset from `from` by a random distance in
 * [{@link WANDER_RADIUS_MIN_PX}, {@link WANDER_RADIUS_MAX_PX}] at a random
 * angle, clamped inside the viewport so a leg never aims off-screen.
 * @param from
 * @param rng
 */
const wanderTarget = ( from: Point, rng: Rng ): Point => {
	const angle = rng() * Math.PI * 2;
	const radius =
		WANDER_RADIUS_MIN_PX +
		rng() * ( WANDER_RADIUS_MAX_PX - WANDER_RADIUS_MIN_PX );
	const maxX = Math.max(
		WANDER_EDGE_MARGIN_PX,
		window.innerWidth - WANDER_EDGE_MARGIN_PX
	);
	const maxY = Math.max(
		WANDER_EDGE_MARGIN_PX,
		window.innerHeight - WANDER_EDGE_MARGIN_PX
	);

	return {
		x: Math.min(
			maxX,
			Math.max(
				WANDER_EDGE_MARGIN_PX,
				from.x + Math.cos( angle ) * radius
			)
		),
		y: Math.min(
			maxY,
			Math.max(
				WANDER_EDGE_MARGIN_PX,
				from.y + Math.sin( angle ) * radius
			)
		),
	};
};

/**
 * Whether `el` sits inside the current viewport — at least the horizontal
 * line `selectSnippet`'s cursor sweep would follow across it. An offscreen
 * candidate's rect is viewport-relative (negative `top`, or `top` past
 * `innerHeight`), which would otherwise send the cursor travelling off-screen
 * to "reach" it.
 * @param el
 */
const isInViewport = ( el: Element ): boolean => {
	const rect = el.getBoundingClientRect();

	return rect.top >= 0 && rect.bottom <= window.innerHeight && rect.left >= 0;
};

/**
 * Whether `el` has any vertical overlap with the viewport — reachable
 * without scrolling, even if only partially visible. Looser than
 * {@link isInViewport} (which requires the whole element on-screen): picking
 * a lingerImage/playVideo candidate only needs "in reach", not "fully shown".
 * @param el
 */
const hasViewportOverlap = ( el: Element ): boolean => {
	const rect = el.getBoundingClientRect();

	return rect.bottom > 0 && rect.top < window.innerHeight;
};

/**
 * Caret-anchored point of `textNode`'s first character: the left edge of that
 * character's own client rect, at its vertical centre — where a user's
 * pointer lands before dragging a selection open. Measured from a probing
 * one-character range because a collapsed range has no client rects. `null`
 * when the environment can't measure range geometry (e.g. jsdom) or the node
 * has no laid-out rect — callers fall back to block-rect geometry.
 * @param textNode
 */
const textStartPoint = ( textNode: Text ): Point | null => {
	const probe = textNode.ownerDocument.createRange();
	probe.setStart( textNode, 0 );
	probe.setEnd( textNode, Math.min( 1, textNode.length ) );

	if ( typeof probe.getClientRects !== 'function' ) {
		return null;
	}

	const rects = probe.getClientRects();

	if ( rects.length === 0 ) {
		return null;
	}

	const first = rects[ 0 ];

	if ( 0 === first.width && 0 === first.height ) {
		return null;
	}

	return { x: first.left, y: first.top + first.height / 2 };
};

/**
 * Caret-anchored point of `range`'s growing end: the right edge of its last
 * client rect, at that rect's vertical centre — exactly where a dragging
 * user's pointer sits mid-selection, wrapped lines included. `null` when the
 * environment can't measure range geometry (e.g. jsdom) or the range has no
 * laid-out rects — callers fall back to block-rect geometry.
 * @param range
 */
const selectionEdgePoint = ( range: Range ): Point | null => {
	if ( typeof range.getClientRects !== 'function' ) {
		return null;
	}

	const rects = range.getClientRects();

	if ( rects.length === 0 ) {
		return null;
	}

	const last = rects[ rects.length - 1 ];

	if ( 0 === last.width && 0 === last.height ) {
		return null;
	}

	return { x: last.right, y: last.top + last.height / 2 };
};

/** How long the cursor travels to a snippet before the selection sweep starts. */
const SNIPPET_APPROACH_MS = 500;

/** How long the progressive selection sweep takes to cover the snippet. */
const SNIPPET_SWEEP_MS = 700;

/** How long the finished selection is held before it is cleared. */
const SNIPPET_HOLD_MS = 600;

/** How long scrolling a target's centre to the viewport middle takes, in ms. */
const SCROLL_TO_MIDDLE_MS = 600;

/** Minimum rendered size (both dimensions), in px, for an image to be worth lingering on — never fixates an emoji-sized or icon image. */
const MIN_IMAGE_SIZE_PX = 40;

/** How far a resting point on a target may jitter from its centre, as a fraction of the target's own dimensions. */
const TARGET_JITTER_FRACTION = 0.2;

/**
 * Fallback line height, in px, for `traceBlock`'s line-count estimate when the
 * computed style isn't a resolved pixel length (e.g. jsdom's default
 * `"normal"`, which carries no usable number).
 */
const DEFAULT_LINE_HEIGHT_PX = 24;

/**
 * Nominal duration a single line's left-to-right sweep takes in `traceBlock`,
 * jittered per line by {@link TRACE_LINE_JITTER_FRACTION} — a reading pace,
 * distinctly slower than `selectSnippet`'s quick sweep.
 */
const TRACE_LINE_MS = 1500;

/** Fractional jitter band applied to each line's sweep duration in `traceBlock`. */
const TRACE_LINE_JITTER_FRACTION = 0.2;

/** Small jitter, in px, on `traceBlock`'s approach point to the first line's start. */
const TRACE_START_JITTER_PX = 6;

/**
 * The line height `traceBlock` paces its sweep by: the computed style's
 * `line-height` when it resolved to a plain pixel length, else
 * {@link DEFAULT_LINE_HEIGHT_PX}. The DOM has no line-count API, so this
 * (rect height ÷ line height) is the cheapest signal available to estimate
 * how many lines a text block renders as, without laying out its runs by hand.
 * @param el
 */
const lineHeightOf = ( el: Element ): number => {
	const raw = getComputedStyle( el ).lineHeight;

	return raw.endsWith( 'px' ) ? parseFloat( raw ) : DEFAULT_LINE_HEIGHT_PX;
};

/**
 * Reading pace a passage's dwell is derived from: ~250 words per minute (an
 * adult silent-reading average) at ~6 characters per word — the passage's
 * character count at this rate, clamped to the band below and jittered per
 * passage.
 */
const SEGMENT_MS_PER_CHAR = 33;

/** Clamp band for a single passage's dwell, in ms — a caption never flashes by, a wall of text never eats the whole session. */
const SEGMENT_DWELL_MS_MIN = 1500;
const SEGMENT_DWELL_MS_MAX = 7000;

/** Fractional jitter band applied to each passage's derived dwell. */
const SEGMENT_DWELL_JITTER_FRACTION = 0.2;

/** Fraction of passages read with the cursor tracking the lines; the rest are eyes-only, the cursor resting on the passage. */
const TRACE_CHANCE = 0.35;

/** Chance, drawn once per traced line and once per dwell slot, that the page creeps down a few px — the slow, intermittent scroll of a reader mid-passage. */
const READING_CREEP_CHANCE = 0.25;

/** Pixel band of a single reading creep, always downward. */
const READING_CREEP_PX_MIN = 10;
const READING_CREEP_PX_MAX = 30;

/** Duration band of a single reading creep, in ms — far slower than any deliberate scroll. */
const READING_CREEP_MS_MIN = 600;
const READING_CREEP_MS_MAX = 1200;

/** An eyes-only dwell is sliced into slots of this length, each ending in a creep opportunity. */
const DWELL_SLOT_MS = 1200;

/** Viewport fraction a passage's top is scrolled to before reading it — a reader holds their text in the upper third, not dead centre. */
const READ_ANCHOR_FRACTION = 1 / 3;

/** How long scrolling a passage to the reading anchor takes, in ms. */
const SCROLL_TO_READ_MS = 700;

/** How many of the nearest off-screen passages the next reading target is drawn from. */
const NEXT_TARGET_POOL_SIZE = 3;

/** Production motor: performs real, eased DOM motion. */
export class DomMotor implements Motor {
	private readonly rng: Rng;
	private readonly nextFrameFn: () => Promise< void >;
	private readonly cursor: FakeCursor;
	/** The control `playVideo` last started, so `stopVideo` stops the same element. */
	private activeVideo: VideoControl | null = null;
	/** Unsubscribes `activeVideo`'s `onEnded` auto-replay; cleared alongside it. */
	private activeVideoEndedUnsubscribe: ( () => void ) | null = null;

	/**
	 * @param rng
	 * @param nextFrameFn Animation tick source the cursor advances on.
	 */
	constructor( rng: Rng, nextFrameFn: () => Promise< void > = nextFrame ) {
		this.rng = rng;
		this.nextFrameFn = nextFrameFn;
		this.cursor = new FakeCursor(
			document,
			{ x: window.innerWidth / 2, y: window.innerHeight / 2 },
			nextFrameFn
		);
	}

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
		let framesLeft = msToFrames( ms );

		while ( framesLeft > 0 ) {
			const from = this.cursor.position;
			const target = wanderTarget( from, this.rng );
			const distance = Math.hypot( target.x - from.x, target.y - from.y );
			const legFrames = Math.min(
				framesLeft,
				framesForDistance( distance )
			);

			await this.cursor.travelTo( target, this.rng, legFrames );
			framesLeft -= legFrames;

			if ( framesLeft <= 0 ) {
				break;
			}

			const pauseFrames = Math.min(
				framesLeft,
				msToFrames(
					WANDER_PAUSE_MS_MIN +
						this.rng() *
							( WANDER_PAUSE_MS_MAX - WANDER_PAUSE_MS_MIN )
				)
			);

			for ( let i = 0; i < pauseFrames; i++ ) {
				await this.nextFrameFn();
			}

			framesLeft -= pauseFrames;
		}
	}

	async selectSnippet(): Promise< void > {
		const root = contentRoot( document );
		const candidates = Array.from(
			root.querySelectorAll( 'p, li, blockquote' )
		).filter(
			( el ) =>
				( el.textContent ?? '' ).trim().length > 20 &&
				isInViewport( el )
		);

		if ( candidates.length === 0 ) {
			return;
		}

		const el = candidates[ Math.floor( this.rng() * candidates.length ) ];
		const textNode = Array.from( el.childNodes ).find(
			( node ): node is Text =>
				node.nodeType === Node.TEXT_NODE &&
				( node.textContent ?? '' ).trim().length > 0
		);
		const selection = el.ownerDocument.defaultView?.getSelection();

		if ( ! textNode || ! selection ) {
			return;
		}

		const text = textNode.textContent ?? '';
		const rect = el.getBoundingClientRect();

		await this.cursor.travelTo(
			textStartPoint( textNode ) ?? {
				x: rect.left,
				y: rect.top + rect.height / 2,
			},
			this.rng,
			msToFrames( SNIPPET_APPROACH_MS )
		);

		const range = el.ownerDocument.createRange();
		range.setStart( textNode, 0 );
		range.setEnd( textNode, 0 );
		selection.removeAllRanges();
		selection.addRange( range );

		// Extends the selection and rides its caret edge with the cursor,
		// frame by frame — eased like a human drag, following the selection's
		// real geometry across wrapped lines rather than gliding along the
		// block's bounding box. At least one character stays selected from the
		// first frame, so the caret edge is always measurable.
		const sweepFrames = msToFrames( SNIPPET_SWEEP_MS );

		for ( let i = 1; i <= sweepFrames; i++ ) {
			const t = easeInOutQuad( i / sweepFrames );
			range.setEnd(
				textNode,
				Math.max( 1, Math.floor( text.length * t ) )
			);
			this.cursor.moveTo(
				selectionEdgePoint( range ) ?? {
					x: rect.left + rect.width * t,
					y: rect.top + rect.height / 2,
				}
			);
			await this.nextFrameFn();
		}

		for ( let i = 0; i < msToFrames( SNIPPET_HOLD_MS ); i++ ) {
			await this.nextFrameFn();
		}

		selection.removeAllRanges();
	}

	async playVideo(): Promise< void > {
		const root = contentRoot( document );
		// One combined query preserves DOM order across both real <video>
		// elements and recognized embed iframes — the same pool-then-pick
		// pattern lingerImage/read/selectSnippet already use, so other
		// videos on a multi-video page genuinely get watched across wins
		// instead of the first one forever.
		const candidates = Array.from(
			root.querySelectorAll( `video, ${ VIDEO_EMBED_SELECTOR }` )
		);

		if ( candidates.length === 0 ) {
			return;
		}

		const target =
			candidates[ Math.floor( this.rng() * candidates.length ) ];

		if ( ! isInViewport( target ) ) {
			await this.scrollToMiddle( target.getBoundingClientRect() );
		}

		await this.cursor.travelTo(
			this.jitteredPointOn( target.getBoundingClientRect() ),
			this.rng
		);

		// Unsubscribe and dispose any control from a prior watch cycle before
		// replacing it — otherwise its message listener (for a YouTube embed)
		// and its auto-replay subscription would both leak.
		this.activeVideoEndedUnsubscribe?.();
		this.activeVideo?.dispose();

		const control = createVideoControl( target );
		this.activeVideo = control;
		// Subscribed for as long as this control stays active: the player's
		// own 'ended' event replays it, so a video shorter than the watch
		// window rewatches itself with no polling from this Motor at all.
		this.activeVideoEndedUnsubscribe = control.onEnded( () => {
			void control.play();
		} );
		await control.play();
	}

	async stopVideo(): Promise< void > {
		const control = this.activeVideo;
		const unsubscribe = this.activeVideoEndedUnsubscribe;
		this.activeVideo = null;
		this.activeVideoEndedUnsubscribe = null;

		// Unsubscribe FIRST so a replay can never race the stop.
		unsubscribe?.();

		if ( null !== control ) {
			await control.stop();
			control.dispose();
		}
	}

	async lingerImage( ms: number ): Promise< void > {
		const root = contentRoot( document );
		const candidates = Array.from(
			root.querySelectorAll( 'img, figure svg' )
		).filter( ( el ) => {
			const rect = el.getBoundingClientRect();

			return (
				rect.width >= MIN_IMAGE_SIZE_PX &&
				rect.height >= MIN_IMAGE_SIZE_PX
			);
		} );

		if ( candidates.length === 0 ) {
			await this.pointerDrift( ms );
			return;
		}

		let framesLeft = msToFrames( ms );
		const inView = candidates.filter( hasViewportOverlap );
		const pool = inView.length > 0 ? inView : candidates;
		const el = pool[ Math.floor( this.rng() * pool.length ) ];
		let rect = el.getBoundingClientRect();

		if ( inView.length === 0 ) {
			const scrollFrames = Math.min(
				framesLeft,
				msToFrames( SCROLL_TO_MIDDLE_MS )
			);
			await this.scrollToMiddle( rect );
			framesLeft -= scrollFrames;
			// Scrolling moved the page, so the image's rect has changed.
			rect = el.getBoundingClientRect();
		}

		const target = this.jitteredPointOn( rect );
		const distance = Math.hypot(
			target.x - this.cursor.position.x,
			target.y - this.cursor.position.y
		);
		const travelFrames = Math.min(
			framesLeft,
			framesForDistance( distance )
		);
		await this.cursor.travelTo( target, this.rng, travelFrames );
		framesLeft -= travelFrames;

		// Dwells on the image for whatever budget remains, frame by frame —
		// the same style as selectSnippet's hold.
		for ( let i = 0; i < framesLeft; i++ ) {
			await this.nextFrameFn();
		}
	}

	/**
	 * A reading session over the page's prose. Segments the content into
	 * readable passages (the same p/li/blockquote pool the other text verbs
	 * draw from), then works through them until the budget runs out: the
	 * first passage is taken from the viewport, every later one preferably
	 * from outside it — below the fold first — so the session scrolls
	 * through the page the way a reader's eyes pull it along. Each passage
	 * is dwelled on in proportion to its own length, a fraction of them
	 * traced with the cursor, and the page creeps down a few px from time
	 * to time throughout. With every passage read and budget still left,
	 * the reader rests; with nothing readable at all, falls back to a
	 * still idle.
	 * @param ms
	 */
	async read( ms: number ): Promise< void > {
		const root = contentRoot( document );
		const pool = Array.from(
			root.querySelectorAll( 'p, li, blockquote' )
		).filter( ( el ) => ( el.textContent ?? '' ).trim().length > 20 );

		if ( pool.length === 0 ) {
			await this.idle( ms );
			return;
		}

		let framesLeft = msToFrames( ms );
		const readSet = new Set< Element >();
		let first = true;

		while ( framesLeft > 0 ) {
			const target = this.pickReadTarget( pool, readSet, first );

			if ( null === target ) {
				break;
			}

			readSet.add( target );
			first = false;

			if ( ! hasViewportOverlap( target ) ) {
				const scrollFrames = Math.min(
					framesLeft,
					msToFrames( SCROLL_TO_READ_MS )
				);
				await this.scrollToReadAnchor( target.getBoundingClientRect() );
				framesLeft -= scrollFrames;
			}

			const chars = ( target.textContent ?? '' ).trim().length;
			const desiredMs =
				Math.min(
					SEGMENT_DWELL_MS_MAX,
					Math.max(
						SEGMENT_DWELL_MS_MIN,
						chars * SEGMENT_MS_PER_CHAR
					)
				) *
				( 1 + ( this.rng() * 2 - 1 ) * SEGMENT_DWELL_JITTER_FRACTION );
			const segmentFrames = Math.min(
				framesLeft,
				msToFrames( desiredMs )
			);

			if ( this.rng() < TRACE_CHANCE ) {
				framesLeft -= await this.traceBlock( target, segmentFrames );
			} else {
				framesLeft -= await this.dwellBlock( target, segmentFrames );
			}
		}

		// Every passage has been read (or none was left to pick) with budget
		// still remaining — the reader rests rather than re-reading.
		for ( let i = 0; i < framesLeft; i++ ) {
			await this.nextFrameFn();
		}
	}

	idle( ms: number ): Promise< void > {
		return new Promise( ( resolve ) => setTimeout( resolve, ms ) );
	}

	/**
	 * Scrolls the page so `rect`'s vertical centre lands at the viewport's
	 * middle — the shared "approach" step both `lingerImage` and `playVideo`
	 * use to bring an off-screen target within reach before travelling the
	 * cursor onto it.
	 * @param rect
	 */
	private scrollToMiddle( rect: DOMRect ): Promise< void > {
		const delta = rect.top + rect.height / 2 - window.innerHeight / 2;

		return this.scrollBy( delta, SCROLL_TO_MIDDLE_MS );
	}

	/**
	 * A point on `rect` — its centre, jittered by up to
	 * {@link TARGET_JITTER_FRACTION} of its own dimensions, so the cursor
	 * doesn't fixate the exact same pixel every time. Shared by `lingerImage`
	 * and `playVideo`'s cursor approach.
	 * @param rect
	 */
	private jitteredPointOn( rect: DOMRect ): Point {
		return {
			x:
				rect.left +
				rect.width / 2 +
				( this.rng() * 2 - 1 ) * rect.width * TARGET_JITTER_FRACTION,
			y:
				rect.top +
				rect.height / 2 +
				( this.rng() * 2 - 1 ) * rect.height * TARGET_JITTER_FRACTION,
		};
	}

	/**
	 * The next passage `read` should attend, from `pool` minus `readSet`, or
	 * `null` once nothing is left unread. The first pick prefers whatever's
	 * already in view; every later pick prefers off-screen passages instead
	 * — below the fold first, then above — so a session that keeps reading
	 * pulls the page down like a real reader's eyes, rather than bouncing
	 * between whatever's already on screen. Off-screen tiers are narrowed to
	 * the nearest {@link NEXT_TARGET_POOL_SIZE} candidates before the pick.
	 * Always draws exactly one rng value when it returns a target.
	 * @param pool
	 * @param readSet
	 * @param first
	 */
	private pickReadTarget(
		pool: Element[],
		readSet: Set< Element >,
		first: boolean
	): Element | null {
		const unread = pool.filter( ( el ) => ! readSet.has( el ) );

		if ( unread.length === 0 ) {
			return null;
		}

		const inView = unread.filter( hasViewportOverlap );
		const below = unread
			.filter(
				( el ) => el.getBoundingClientRect().top >= window.innerHeight
			)
			.sort(
				( a, b ) =>
					a.getBoundingClientRect().top -
					b.getBoundingClientRect().top
			)
			.slice( 0, NEXT_TARGET_POOL_SIZE );
		const above = unread
			.filter( ( el ) => el.getBoundingClientRect().bottom <= 0 )
			.sort(
				( a, b ) =>
					b.getBoundingClientRect().bottom -
					a.getBoundingClientRect().bottom
			)
			.slice( 0, NEXT_TARGET_POOL_SIZE );
		const tiers = first
			? [ inView, below, above ]
			: [ below, above, inView ];
		const tier = tiers.find( ( candidates ) => candidates.length > 0 );

		if ( ! tier ) {
			return null;
		}

		return tier[ Math.floor( this.rng() * tier.length ) ];
	}

	/**
	 * Scrolls `rect`'s top to {@link READ_ANCHOR_FRACTION} of the viewport
	 * height — the upper-third resting spot `read` brings an off-screen
	 * passage to before dwelling on it.
	 * @param rect
	 */
	private scrollToReadAnchor( rect: DOMRect ): Promise< void > {
		const delta = rect.top - window.innerHeight * READ_ANCHOR_FRACTION;

		return this.scrollBy( delta, SCROLL_TO_READ_MS );
	}

	/**
	 * Sweeps the cursor across `el` line by line, within `budgetFrames`,
	 * returning the frames it actually spent so `read` can move on to the
	 * next passage the moment this one's lines run out. Re-reads `el`'s rect
	 * at the start of every line so a creep between lines never detaches the
	 * cursor from the passage; after each line, a creep chance is drawn from
	 * whatever budget remains.
	 * @param el
	 * @param budgetFrames
	 */
	private async traceBlock(
		el: Element,
		budgetFrames: number
	): Promise< number > {
		const initialRect = el.getBoundingClientRect();
		const lineHeight = lineHeightOf( el );
		const lines = Math.max(
			1,
			Math.round( initialRect.height / lineHeight )
		);
		const approachTarget = {
			x:
				initialRect.left +
				( this.rng() * 2 - 1 ) * TRACE_START_JITTER_PX,
			y:
				initialRect.top +
				lineHeight / 2 +
				( this.rng() * 2 - 1 ) * TRACE_START_JITTER_PX,
		};
		const distance = Math.hypot(
			approachTarget.x - this.cursor.position.x,
			approachTarget.y - this.cursor.position.y
		);
		const travelFrames = Math.min(
			budgetFrames,
			framesForDistance( distance )
		);
		await this.cursor.travelTo( approachTarget, this.rng, travelFrames );

		let framesLeft = budgetFrames - travelFrames;
		let consumed = travelFrames;

		for ( let line = 0; line < lines && framesLeft > 0; line++ ) {
			const rect = el.getBoundingClientRect();
			const y = rect.top + lineHeight * ( line + 0.5 );
			const lineMs =
				TRACE_LINE_MS *
				( 1 + ( this.rng() * 2 - 1 ) * TRACE_LINE_JITTER_FRACTION );
			const nominalLineFrames = msToFrames( lineMs );
			const lineFrames = Math.min( framesLeft, nominalLineFrames );

			for ( let i = 1; i <= lineFrames; i++ ) {
				const t = i / nominalLineFrames;
				this.cursor.moveTo( { x: rect.left + rect.width * t, y } );
				await this.nextFrameFn();
			}

			framesLeft -= lineFrames;
			consumed += lineFrames;

			if ( framesLeft > 0 && this.rng() < READING_CREEP_CHANCE ) {
				const creepFrames = await this.creepStep( framesLeft );
				framesLeft -= creepFrames;
				consumed += creepFrames;
			}
		}

		return consumed;
	}

	/**
	 * An eyes-only read of `el`: travels the cursor onto it once, then holds
	 * it there for `budgetFrames` in slots of {@link DWELL_SLOT_MS}, each
	 * slot ending in a creep chance drawn from whatever budget remains.
	 * Always consumes exactly `budgetFrames`, whatever mix of holding and
	 * creeping filled it.
	 * @param el
	 * @param budgetFrames
	 */
	private async dwellBlock(
		el: Element,
		budgetFrames: number
	): Promise< number > {
		const rect = el.getBoundingClientRect();
		const target = this.jitteredPointOn( rect );
		const distance = Math.hypot(
			target.x - this.cursor.position.x,
			target.y - this.cursor.position.y
		);
		const travelFrames = Math.min(
			budgetFrames,
			framesForDistance( distance )
		);
		await this.cursor.travelTo( target, this.rng, travelFrames );

		let framesLeft = budgetFrames - travelFrames;

		while ( framesLeft > 0 ) {
			const slotFrames = Math.min(
				framesLeft,
				msToFrames( DWELL_SLOT_MS )
			);

			for ( let i = 0; i < slotFrames; i++ ) {
				await this.nextFrameFn();
			}

			framesLeft -= slotFrames;

			if ( framesLeft > 0 && this.rng() < READING_CREEP_CHANCE ) {
				framesLeft -= await this.creepStep( framesLeft );
			}
		}

		return budgetFrames;
	}

	/**
	 * A single slow, downward creep of the page — {@link READING_CREEP_PX_MIN}
	 * to {@link READING_CREEP_PX_MAX} over {@link READING_CREEP_MS_MIN} to
	 * {@link READING_CREEP_MS_MAX} — capped to `remainingFrames`, returning
	 * the frames it spent.
	 * @param remainingFrames
	 */
	private async creepStep( remainingFrames: number ): Promise< number > {
		const px =
			READING_CREEP_PX_MIN +
			this.rng() * ( READING_CREEP_PX_MAX - READING_CREEP_PX_MIN );
		const ms =
			READING_CREEP_MS_MIN +
			this.rng() * ( READING_CREEP_MS_MAX - READING_CREEP_MS_MIN );
		const frames = Math.min( remainingFrames, msToFrames( ms ) );

		await this.scrollBy( px, ms );

		return frames;
	}
}
