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

/** The deck's colour theme — Coastal Daybreak (light) or Dusk Lineup (dark). */
type ThemeName = 'light' | 'dark';

/** Per-instance context the cockpit's PHP render seeds onto the block. */
interface CockpitContext {
	pages: CoursePage[];
	activeIndex: number;
	mode: RunMode;
	durationMinutes: number;
	baseline: boolean;
	speed: number;
	running: boolean;
	elapsed: number;
	theme: ThemeName;
	targetPercent: number;
	batteryLevel: number | null;
	batteryCharging: boolean;
	rate10: number | null;
	rateSession: number | null;
	secondsToEmpty: number | null;
}

/** The slice of the Battery Status API the readouts read. */
interface BatteryLike {
	level: number;
	charging: boolean;
	addEventListener: ( type: string, listener: () => void ) => void;
	removeEventListener: ( type: string, listener: () => void ) => void;
}

/** Smallest and largest run duration the stepper will set, in minutes. */
const DURATION_MIN = 5;
const DURATION_MAX = 240;

/** Smallest and largest battery percentage the target-drop slider allows. */
const TARGET_MIN = 5;
const TARGET_MAX = 95;

/** Step the battery slider snaps to, in percent. */
const TARGET_STEP = 5;

/** Whether a pointer drag on the battery slider is in progress. */
let draggingTarget = false;

/**
 * Clamps a percentage to the slider's stepped, supported range.
 * @param value
 */
const clampTarget = ( value: number ): number =>
	Math.min(
		TARGET_MAX,
		Math.max( TARGET_MIN, Math.round( value / TARGET_STEP ) * TARGET_STEP )
	);

/**
 * Maps a pointer x within the battery element to a stepped percentage.
 * @param clientX
 * @param el
 */
const targetFromPointer = ( clientX: number, el: HTMLElement ): number => {
	const rect = el.getBoundingClientRect();
	const ratio = rect.width ? ( clientX - rect.left ) / rect.width : 0;

	return clampTarget( ratio * 100 );
};

/** localStorage key the chosen theme is remembered under across visits. */
const THEME_KEY = 'bsb-cockpit-theme';

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

		/** Target stop-at battery level, as a `NN%` string for the readout/fill. */
		get targetDisplay(): string {
			return `${ getContext< CockpitContext >().targetPercent }%`;
		},

		/**
		 * Colour for the target battery fill: green at high levels grading to red
		 * at low ones, so a deeper drain target reads hotter.
		 */
		get targetColor(): string {
			const { targetPercent } = getContext< CockpitContext >();
			const hue = Math.round( ( targetPercent / 100 ) * 120 );

			return `hsl(${ hue }, 72%, 45%)`;
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

		/** Current battery level as a readout number, or an em dash if unknown. */
		get batteryDisplay(): string {
			const { batteryLevel } = getContext< CockpitContext >();

			return batteryLevel === null ? '—' : String( batteryLevel );
		},

		/** Battery readout colour: green when full grading to red when low. */
		get batteryColor(): string {
			const { batteryLevel } = getContext< CockpitContext >();

			if ( batteryLevel === null ) {
				return 'var(--text-soft)';
			}

			const hue = Math.round( ( batteryLevel / 100 ) * 120 );

			return `hsl(${ hue }, 70%, 45%)`;
		},

		/** Whether the device is charging — drives the charging bolt. */
		get isCharging(): boolean {
			return getContext< CockpitContext >().batteryCharging;
		},

		/** Whether no run is live — hides the readouts pill until one starts. */
		get isIdle(): boolean {
			return ! getContext< CockpitContext >().running;
		},

		/** Drain rate over the last 10 minutes, or an em dash until known. */
		get rate10Display(): string {
			const { rate10 } = getContext< CockpitContext >();

			return rate10 === null ? '—' : String( rate10 );
		},

		/** Drain rate over the whole session, or an em dash until known. */
		get rateSessionDisplay(): string {
			const { rateSession } = getContext< CockpitContext >();

			return rateSession === null ? '—' : String( rateSession );
		},

		/** Projected time to empty as `H:MM`, or an em dash until known. */
		get timeToEmptyDisplay(): string {
			const { secondsToEmpty } = getContext< CockpitContext >();

			if (
				secondsToEmpty === null ||
				! Number.isFinite( secondsToEmpty ) ||
				secondsToEmpty <= 0
			) {
				return '—';
			}

			const hours = Math.floor( secondsToEmpty / 3600 );
			const minutes = Math.floor( ( secondsToEmpty % 3600 ) / 60 );

			return `${ hours }:${ String( minutes ).padStart( 2, '0' ) }`;
		},

		/** Elapsed run time as a `MM:SS` clock for the surfing indicator. */
		get elapsedClock(): string {
			const { elapsed } = getContext< CockpitContext >();
			const minutes = Math.floor( elapsed / 60 );
			const seconds = elapsed % 60;
			const pad = ( value: number ): string =>
				String( value ).padStart( 2, '0' );

			return `${ pad( minutes ) }:${ pad( seconds ) }`;
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

		/**
		 * Begins a battery-slider drag and sets the level from the pointer.
		 * @param event
		 */
		targetPointerDown( event: PointerEvent ): void {
			const el = getElement().ref as HTMLElement;
			el.setPointerCapture?.( event.pointerId );
			draggingTarget = true;
			getContext< CockpitContext >().targetPercent = targetFromPointer(
				event.clientX,
				el
			);
		},

		/**
		 * Tracks the pointer while dragging the battery slider.
		 * @param event
		 */
		targetPointerMove( event: PointerEvent ): void {
			if ( ! draggingTarget ) {
				return;
			}

			getContext< CockpitContext >().targetPercent = targetFromPointer(
				event.clientX,
				getElement().ref as HTMLElement
			);
		},

		/** Ends a battery-slider drag. */
		targetPointerUp(): void {
			draggingTarget = false;
		},

		/**
		 * Adjusts the target level with the arrow / Home / End keys.
		 * @param event
		 */
		targetKeyDown( event: KeyboardEvent ): void {
			const context = getContext< CockpitContext >();
			let next = context.targetPercent;

			switch ( event.key ) {
				case 'ArrowLeft':
				case 'ArrowDown':
					next -= TARGET_STEP;
					break;
				case 'ArrowRight':
				case 'ArrowUp':
					next += TARGET_STEP;
					break;
				case 'Home':
					next = TARGET_MIN;
					break;
				case 'End':
					next = TARGET_MAX;
					break;
				default:
					return;
			}

			event.preventDefault();
			context.targetPercent = clampTarget( next );
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

		/** Flips between the light and dark deck themes and remembers the choice. */
		toggleTheme(): void {
			const context = getContext< CockpitContext >();
			context.theme = context.theme === 'dark' ? 'light' : 'dark';

			try {
				window.localStorage.setItem( THEME_KEY, context.theme );
			} catch {
				// Storage unavailable (private mode); the choice still applies
				// for this session.
			}
		},
	},
	callbacks: {
		/**
		 * Feeds the battery readouts from the Battery Status API: syncs the level
		 * and charging state on mount and whenever they change, returning a
		 * cleanup that detaches the listeners. A no-op where the API is absent,
		 * leaving the readouts at their em-dash idle state.
		 */
		initBattery(): () => void {
			const provider = (
				navigator as Navigator & {
					getBattery?: () => Promise< BatteryLike >;
				}
			 ).getBattery?.bind( navigator );

			if ( ! provider ) {
				return () => undefined;
			}

			const context = getContext< CockpitContext >();
			let manager: BatteryLike | undefined;
			const sync = (): void => {
				if ( manager ) {
					context.batteryLevel = Math.round( manager.level * 100 );
					context.batteryCharging = manager.charging;
				}
			};

			provider().then( ( battery ) => {
				manager = battery;
				sync();
				battery.addEventListener( 'levelchange', sync );
				battery.addEventListener( 'chargingchange', sync );
			} );

			return () => {
				manager?.removeEventListener( 'levelchange', sync );
				manager?.removeEventListener( 'chargingchange', sync );
			};
		},

		/** Restores the visitor's remembered theme when the deck mounts. */
		initTheme(): void {
			let stored: string | null = null;

			try {
				stored = window.localStorage.getItem( THEME_KEY );
			} catch {
				stored = null;
			}

			if ( stored === 'light' || stored === 'dark' ) {
				getContext< CockpitContext >().theme = stored;
			}
		},

		/**
		 * Advances the surfing indicator's elapsed clock once a second while the
		 * indicator is mounted, returning a cleanup that stops the timer. Wired
		 * through `data-wp-init` so the deck's "it's working" readout ticks live.
		 */
		tick(): () => void {
			const context = getContext< CockpitContext >();
			const timer = setInterval( () => {
				context.elapsed += 1;
			}, 1000 );

			return () => clearInterval( timer );
		},
	},
} );
