/**
 * The Surf dev-tool's pure model: its persisted/runtime state shape, the nine
 * behaviors' keys in engine boot order (the chip grid's own order), the chip
 * gating rule, and the countdown/glyph display formats. Kept free of any
 * store/DOM dependency so the gating and formatting logic can be
 * unit-tested in isolation — the store slice ({@link ./SurfSteerStore}) only
 * wires this against the shared `bsb/cockpit` state and the iframe message
 * handshake.
 */

/**
 * The nine behaviors' keys, in the exact order `EngineBoot` (`src/surfer/index.ts`)
 * constructs them — the panel's chip grid renders in this same order.
 */
export const SURF_BEHAVIOR_KEYS = [
	'scrollBurst',
	'readPause',
	'glanceBack',
	'watchVideo',
	'lingerImage',
	'fidgetWiggle',
	'microScroll',
	'selectSnippet',
	'moveOn',
] as const;

/** A behavior key from {@link SURF_BEHAVIOR_KEYS}. */
export type SurfBehaviorKey = ( typeof SURF_BEHAVIOR_KEYS )[ number ];

/** The behavior key whose chip carries the caution (coral) treatment — it navigates the course, everything else stays on the page. */
export const CAUTION_KEY: SurfBehaviorKey = 'moveOn';

/** The affordance flags a sterile page reports, as posted by `bsb:pageAffordances`. */
export interface SurfAffordances {
	hasVideo: boolean;
	imageCount: number;
	textDensity: number;
}

/** A page-jump command the production watch consumes once, keyed by a monotonic sequence so a repeat of the same delta still re-fires the watch. */
export interface SurfPageStep {
	delta: -1 | 1;
	seq: number;
}

/** The Surf tool's full state: the armed override (persisted) plus the live-run runtime fields (never persisted). */
export interface SurfSteerState {
	/** The armed override. */
	sterile: boolean;
	/** The currently steered behavior's key, or '' when idle. */
	behaviorKey: string;
	/** The steered behavior's remaining countdown, in ms, ticking down while running; null for a non-announcing (mechanical) behavior, or when idle. */
	remainingMs: number | null;
	/** The live sterile page's affordance flags, or null when there is no live sterile page. */
	affordances: SurfAffordances | null;
	/** The pending page-jump command, or null. */
	pageStep: SurfPageStep | null;
}

/** The tool's default, pre-hydration state. */
export const DEFAULT_SURF: SurfSteerState = Object.freeze( {
	sterile: false,
	behaviorKey: '',
	remainingMs: null,
	affordances: null,
	pageStep: null,
} );

/**
 * Whether a chip's own hard affordance gate fails on the current page:
 * `watchVideo` needs `hasVideo`; `lingerImage` needs `imageCount > 0`;
 * `readPause` and `selectSnippet` need `textDensity > 0`; every other key has
 * no gate of its own. Always false when there is no live sterile page at all
 * (`affordances === null`) — "gated" is a verdict about THIS page, not about
 * there being no page to judge; that distinct case is `isChipDisabled`'s own
 * concern; a busy panel (another behavior running) does not un-gate a chip
 * either, since the gate is a property of the page, not of the panel's
 * current activity.
 *
 * @param key         The chip's behavior key.
 * @param affordances The live sterile page's affordance flags, or null.
 * @return Whether this key's own hard gate fails on the current page.
 */
export const isChipGated = (
	key: string,
	affordances: SurfAffordances | null
): boolean => {
	if ( affordances === null ) {
		return false;
	}

	if ( key === 'watchVideo' ) {
		return ! affordances.hasVideo;
	}

	if ( key === 'lingerImage' ) {
		return ! ( affordances.imageCount > 0 );
	}

	if ( key === 'readPause' || key === 'selectSnippet' ) {
		return ! ( affordances.textDensity > 0 );
	}

	return false;
};

/**
 * Whether a chip should be disabled: no live sterile page at all, a behavior
 * already running (including itself), or the behavior's own hard affordance
 * gate failing (delegated to {@link isChipGated}, so the gate rule exists in
 * exactly one place).
 *
 * @param key   The chip's behavior key.
 * @param state The tool's live affordances and running key.
 * @return Whether the chip should be disabled.
 */
export const isChipDisabled = (
	key: string,
	state: Pick< SurfSteerState, 'affordances' | 'behaviorKey' >
): boolean => {
	const { affordances, behaviorKey } = state;

	if ( affordances === null || behaviorKey !== '' ) {
		return true;
	}

	return isChipGated( key, affordances );
};

/**
 * A milliseconds duration as zero-padded `MM:SS`, never negative.
 * @param ms
 */
const formatCountdown = ( ms: number ): string => {
	const totalSeconds = Math.max( 0, Math.ceil( ms / 1000 ) );
	const mm = String( Math.floor( totalSeconds / 60 ) ).padStart( 2, '0' );
	const ss = String( totalSeconds % 60 ).padStart( 2, '0' );

	return `${ mm }:${ ss }`;
};

/**
 * The running countdown display: `${key} · ${mm}:${ss}` while a duration is
 * counting down, `${key}` alone when the running behavior announced no
 * duration (a mechanical behavior), or '' when idle.
 *
 * @param behaviorKey The currently steered behavior's key ('' when idle).
 * @param remainingMs The steered behavior's remaining countdown, or null.
 * @return The display text.
 */
export const surfCountdownDisplay = (
	behaviorKey: string,
	remainingMs: number | null
): string => {
	if ( behaviorKey === '' ) {
		return '';
	}

	if ( remainingMs === null ) {
		return behaviorKey;
	}

	return `${ behaviorKey } · ${ formatCountdown( remainingMs ) }`;
};

/**
 * The page-affordance glyph readout: `▤` when the page has readable text,
 * `▦` when it has images, `▶` when it has video, concatenated in that
 * order — the only page identity the client is allowed to leak, since it
 * only ever knows the opaque course index. `—` when there is no live
 * sterile page at all.
 *
 * @param affordances The live sterile page's affordance flags, or null.
 * @return The glyph readout.
 */
export const affordanceGlyphs = (
	affordances: SurfAffordances | null
): string => {
	if ( affordances === null ) {
		return '—';
	}

	let glyphs = '';
	if ( affordances.textDensity > 0 ) {
		glyphs += '▤';
	}
	if ( affordances.imageCount > 0 ) {
		glyphs += '▦';
	}
	if ( affordances.hasVideo ) {
		glyphs += '▶';
	}

	return glyphs;
};
