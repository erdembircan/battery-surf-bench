/**
 * Cockpit view — the Interactivity API store backing the `bsb/cockpit` block.
 *
 * The block's PHP render seeds a per-instance context with the surfable course
 * pages, the active page index, and the run configuration the control deck
 * edits — benchmark mode, the duration to run for, whether to calibrate a
 * baseline first, the surf speed, and whether a run is live. This store derives
 * the viewport URL and the deck's reactive readouts from that context and
 * exposes the actions the deck's controls call, so the whole cockpit — viewport
 * and controls alike — is driven from one place as it grows.
 */

import { store, getContext, getElement } from '@wordpress/interactivity';

/** One surfable course page, as supplied by the `bsb/course-pages` binding. */
interface CoursePage {
	slug: string;
	title: string;
	url: string;
}

/** Which quantity a benchmark run is bounded by. */
type RunMode = 'duration' | 'targetDrop';

/** Per-instance context the cockpit's PHP render seeds onto the block. */
interface CockpitContext {
	pages: CoursePage[];
	activeIndex: number;
	mode: RunMode;
	durationMinutes: number;
	baseline: boolean;
	speed: number;
	running: boolean;
}

/** Smallest and largest run duration the stepper will set, in minutes. */
const DURATION_MIN = 5;
const DURATION_MAX = 240;

store( 'bsb/cockpit', {
	state: {
		/** URL of the active course page, bound onto the viewport iframe. */
		get currentSrc(): string {
			const { pages, activeIndex } = getContext< CockpitContext >();

			return pages[ activeIndex ]?.url ?? '';
		},

		/** Human-readable "n/total — Title" label for the active page. */
		get currentLabel(): string {
			const { pages, activeIndex } = getContext< CockpitContext >();

			if ( pages.length === 0 ) {
				return '';
			}

			return `${ activeIndex + 1 }/${ pages.length } — ${
				pages[ activeIndex ]?.title ?? ''
			}`;
		},

		/** Whether the run is bounded by a fixed duration. */
		get isModeDuration(): boolean {
			return getContext< CockpitContext >().mode === 'duration';
		},

		/** Whether the run is bounded by a target battery drop. */
		get isModeTargetDrop(): boolean {
			return getContext< CockpitContext >().mode === 'targetDrop';
		},

		/** The configured run duration, as text for the stepper readout. */
		get durationDisplay(): string {
			return String( getContext< CockpitContext >().durationMinutes );
		},

		/** Whether the 1× surf speed is selected. */
		get isSpeed1(): boolean {
			return getContext< CockpitContext >().speed === 1;
		},

		/** Whether the 4× surf speed is selected. */
		get isSpeed4(): boolean {
			return getContext< CockpitContext >().speed === 4;
		},

		/** Whether the 10× surf speed is selected. */
		get isSpeed10(): boolean {
			return getContext< CockpitContext >().speed === 10;
		},
	},
	actions: {
		/** Advances the viewport to the next course page, wrapping around. */
		next(): void {
			const context = getContext< CockpitContext >();

			if ( context.pages.length === 0 ) {
				return;
			}

			context.activeIndex =
				( context.activeIndex + 1 ) % context.pages.length;
		},

		/** Selects the run mode named by the triggering control's `data-mode`. */
		selectMode(): void {
			const { ref } = getElement();
			const mode = ref?.dataset.mode;

			if ( mode === 'duration' || mode === 'targetDrop' ) {
				getContext< CockpitContext >().mode = mode;
			}
		},

		/**
		 * Nudges the run duration by the triggering control's `data-step`
		 * minutes, clamped to the supported range.
		 */
		stepDuration(): void {
			const { ref } = getElement();
			const step = Number( ref?.dataset.step );

			if ( ! Number.isFinite( step ) ) {
				return;
			}

			const context = getContext< CockpitContext >();
			const next = context.durationMinutes + step;

			context.durationMinutes = Math.min(
				DURATION_MAX,
				Math.max( DURATION_MIN, next )
			);
		},

		/** Toggles whether a baseline calibration precedes the run. */
		toggleBaseline(): void {
			const { ref } = getElement();
			const checkbox = ref as HTMLInputElement | null;

			getContext< CockpitContext >().baseline =
				checkbox?.checked ?? false;
		},

		/** Selects the surf speed named by the triggering control's `data-speed`. */
		selectSpeed(): void {
			const { ref } = getElement();
			const speed = Number( ref?.dataset.speed );

			if ( speed === 1 || speed === 4 || speed === 10 ) {
				getContext< CockpitContext >().speed = speed;
			}
		},

		/** Stops the run, returning the cockpit to its idle, ready state. */
		stop(): void {
			getContext< CockpitContext >().running = false;
		},
	},
} );
