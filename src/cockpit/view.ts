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

/** The deck's resolved colour theme — Coastal Daybreak or Dusk Lineup. */
type ThemeName = 'light' | 'dark';

/** The visitor's theme preference: a fixed theme, or follow the OS. */
type ThemePref = 'light' | 'dark' | 'system';

/** Per-instance context the cockpit's PHP render seeds onto the block. */
interface CockpitContext {
	pages: CoursePage[];
	activeIndex: number;
	mode: RunMode;
	durationMinutes: number;
	baseline: boolean;
	speed: number;
	running: boolean;
	compact: boolean;
	elapsed: number;
	theme: ThemeName;
	themePref: ThemePref;
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
 * The highest stop-at level the slider allows: you cannot target a drop above
 * the battery you currently have, so the cap is the current level snapped to the
 * step (or the nominal max until the level is known).
 * @param batteryLevel
 */
const targetCap = ( batteryLevel: number | null ): number => {
	if ( batteryLevel === null ) {
		return TARGET_MAX;
	}

	return Math.max(
		TARGET_MIN,
		Math.floor( batteryLevel / TARGET_STEP ) * TARGET_STEP
	);
};

/**
 * Clamps a percentage to the slider's stepped range, bounded above by `max`.
 * @param value
 * @param max
 */
const clampTarget = ( value: number, max: number = TARGET_MAX ): number =>
	Math.min(
		max,
		Math.max( TARGET_MIN, Math.round( value / TARGET_STEP ) * TARGET_STEP )
	);

/**
 * Maps a pointer x within the battery element to a stepped percentage, capped.
 * @param clientX
 * @param el
 * @param max
 */
const targetFromPointer = (
	clientX: number,
	el: HTMLElement,
	max: number
): number => {
	const rect = el.getBoundingClientRect();
	const ratio = rect.width ? ( clientX - rect.left ) / rect.width : 0;

	return clampTarget( ratio * 100, max );
};

/** localStorage key the theme preference is remembered under across visits. */
const THEME_KEY = 'bsb-cockpit-theme';

/** The order the theme control cycles through on each press. */
const THEME_ORDER: ThemePref[] = [ 'system', 'light', 'dark' ];

/** Whether the operating system currently prefers a dark colour scheme. */
const osPrefersDark = (): boolean =>
	typeof window.matchMedia === 'function' &&
	window.matchMedia( '(prefers-color-scheme: dark)' ).matches;

/**
 * Resolves a preference to the theme actually applied: a fixed choice as-is, or
 * the operating system's current scheme when following the system.
 * @param pref
 */
const resolveTheme = ( pref: ThemePref ): ThemeName => {
	if ( pref !== 'system' ) {
		return pref;
	}

	return osPrefersDark() ? 'dark' : 'light';
};

/** Per-odometer roll state: the last duration shown and each wheel's position. */
interface OdometerState {
	value: number;
	positions: number[];
}

/** Tracks each cockpit's duration odometer by its element, so the wheels roll. */
const odometers = new WeakMap< HTMLElement, OdometerState >();

/**
 * The transform that rests a wheel strip on a given logical position. The strip
 * repeats 0–9 three times; the middle set (offset 10 cells) is the rest band, so
 * a position can stay small while still rolling through a wrap.
 * @param position
 */
const wheelTransform = ( position: number ): string =>
	`translateY(calc(var(--bsb-od-cell) * ${ -( position + 10 ) }))`;

/**
 * The hundreds, tens and units digits of a duration.
 * @param minutes
 */
const durationDigits = ( minutes: number ): number[] => [
	Math.floor( minutes / 100 ) % 10,
	Math.floor( minutes / 10 ) % 10,
	minutes % 10,
];

/**
 * Formats a number of seconds as a `MM:SS` clock, clamped at zero.
 * @param totalSeconds
 */
const formatClock = ( totalSeconds: number ): string => {
	const safe = Math.max( 0, totalSeconds );
	const pad = ( value: number ): string => String( value ).padStart( 2, '0' );

	return `${ pad( Math.floor( safe / 60 ) ) }:${ pad( safe % 60 ) }`;
};

store( 'bsb/cockpit', {
	state: {
		/**
		 * URL of the active course page, bound onto the viewport iframe. Empty
		 * until a run starts, so the benchmarked pages are not fetched while the
		 * idle screen is showing — the iframe loads only once surfing begins.
		 */
		get currentSrc(): string {
			const { pages, activeIndex, running } =
				getContext< CockpitContext >();

			if ( ! running ) {
				return '';
			}

			return pages[ activeIndex ]?.url ?? '';
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

		/** Highest target the slider allows — the current battery level (capped). */
		get targetCap(): number {
			return targetCap( getContext< CockpitContext >().batteryLevel );
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

		/** Whether a run is live — shows the pill and hides the config controls. */
		get isRunning(): boolean {
			return getContext< CockpitContext >().running;
		},

		/**
		 * Whether the deck is collapsed to give the viewport full width. Only
		 * meaningful mid-run, when the readouts move into the top pill.
		 */
		get isCompact(): boolean {
			const { running, compact } = getContext< CockpitContext >();

			return running && compact;
		},

		/**
		 * Whether a run is blocked from starting because the device is plugged in.
		 * A benchmark must drain the battery, so the run control is disabled while
		 * charging and idle.
		 */
		get isStartBlocked(): boolean {
			const { running, batteryCharging } = getContext< CockpitContext >();

			return ! running && batteryCharging;
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

		/**
		 * The run clock as a `MM:SS` string: a countdown from the chosen duration
		 * in duration mode, or elapsed time in target-drop mode (which has no fixed
		 * length).
		 */
		get runClock(): string {
			const { mode, durationMinutes, elapsed } =
				getContext< CockpitContext >();

			return mode === 'duration'
				? formatClock( durationMinutes * 60 - elapsed )
				: formatClock( elapsed );
		},
	},
	actions: {
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
			const context = getContext< CockpitContext >();
			el.setPointerCapture?.( event.pointerId );
			draggingTarget = true;
			context.targetPercent = targetFromPointer(
				event.clientX,
				el,
				targetCap( context.batteryLevel )
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

			const context = getContext< CockpitContext >();
			context.targetPercent = targetFromPointer(
				event.clientX,
				getElement().ref as HTMLElement,
				targetCap( context.batteryLevel )
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
					next = targetCap( context.batteryLevel );
					break;
				default:
					return;
			}

			event.preventDefault();
			context.targetPercent = clampTarget(
				next,
				targetCap( context.batteryLevel )
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

		/**
		 * Starts or stops the run. Starting resets the elapsed clock, reveals the
		 * readouts pill and hides the configuration controls; stopping returns the
		 * cockpit to its idle, ready state with the controls back. Starting is
		 * refused while the device is plugged in — a benchmark must run on battery.
		 */
		toggleRun(): void {
			const context = getContext< CockpitContext >();

			if ( context.running ) {
				context.running = false;
				context.compact = false;
				return;
			}

			if ( context.batteryCharging ) {
				return;
			}

			context.elapsed = 0;
			context.running = true;
		},

		/**
		 * Collapses the deck to give the viewport full width (or restores it),
		 * moving the readouts into the top pill. Only used while a run is live.
		 */
		toggleCompact(): void {
			const context = getContext< CockpitContext >();
			context.compact = ! context.compact;
		},

		/**
		 * Cycles the theme preference (system → light → dark → system) and
		 * remembers it. "System" follows the OS, so it is a sticky choice in its
		 * own right; a fixed light/dark choice overrides the OS until changed.
		 */
		toggleTheme(): void {
			const context = getContext< CockpitContext >();
			const next =
				THEME_ORDER[
					( THEME_ORDER.indexOf( context.themePref ) + 1 ) %
						THEME_ORDER.length
				];
			context.themePref = next;
			context.theme = resolveTheme( next );

			try {
				window.localStorage.setItem( THEME_KEY, next );
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
		 * leaving the readouts at their em-dash idle state. Plugging in mid-run
		 * stops the run, since a benchmark must drain the battery.
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
				if ( ! manager ) {
					return;
				}

				context.batteryLevel = Math.round( manager.level * 100 );
				context.batteryCharging = manager.charging;

				if ( context.batteryCharging && context.running ) {
					context.running = false;
				}

				// The stop-at target can't sit above the battery you have. The
				// context seeds it high, so the first reading caps it down to the
				// current level (the startup default); later it only follows the
				// level down, never re-raising a target the user lowered.
				const cap = targetCap( context.batteryLevel );
				if ( context.targetPercent > cap ) {
					context.targetPercent = cap;
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

		/**
		 * Restores the remembered theme preference on mount and keeps the resolved
		 * theme in sync: a fixed light/dark choice applies as-is, while "system"
		 * (the default) follows the OS and re-applies when its scheme changes.
		 * Returns a cleanup that detaches the OS listener.
		 */
		initTheme(): () => void {
			const context = getContext< CockpitContext >();
			const media =
				typeof window.matchMedia === 'function'
					? window.matchMedia( '(prefers-color-scheme: dark)' )
					: null;

			const apply = (): void => {
				let pref: ThemePref = 'system';
				try {
					const stored = window.localStorage.getItem( THEME_KEY );
					if (
						stored === 'light' ||
						stored === 'dark' ||
						stored === 'system'
					) {
						pref = stored;
					}
				} catch {
					// Storage unavailable; fall back to following the system.
				}

				context.themePref = pref;
				context.theme = resolveTheme( pref );
			};

			apply();
			media?.addEventListener?.( 'change', apply );

			return () => media?.removeEventListener?.( 'change', apply );
		},

		/**
		 * Advances the surfing indicator's elapsed clock once a second while a run
		 * is live, returning a cleanup that stops the timer. Wired through
		 * `data-wp-init` on the always-mounted pill, so the timer only counts while
		 * `running` — it stays at rest (and `toggleRun` resets it) between runs.
		 */
		tick(): () => void {
			const context = getContext< CockpitContext >();
			const timer = setInterval( () => {
				if ( context.running ) {
					context.elapsed += 1;
				}
			}, 1000 );

			return () => clearInterval( timer );
		},

		/**
		 * Rolls the run-duration odometer when the duration changes: each digit
		 * wheel slides to its new value in the press direction (increase rolls up,
		 * decrease rolls down), wrapping 9⇄0 seamlessly, and leading-zero wheels
		 * collapse. Driven by `data-wp-watch`, so it re-runs on every change.
		 */
		rollDuration(): void {
			const element = getElement().ref as HTMLElement | null;

			if ( ! element ) {
				return;
			}

			const { durationMinutes } = getContext< CockpitContext >();
			const strips = element.querySelectorAll< HTMLElement >(
				'.bsb-odometer__strip'
			);
			const wheels = element.querySelectorAll< HTMLElement >(
				'.bsb-odometer__wheel'
			);
			const digits = durationDigits( durationMinutes );

			const state = odometers.get( element );
			const initial = ! state;

			// On the very first run, freeze every transition so the startup seat —
			// both the strip positions and the leading-wheel collapse — lands
			// instantly instead of animating from the default. Transitions are
			// restored next frame so presses animate.
			if ( initial ) {
				strips.forEach( ( strip ) => {
					strip.style.transition = 'none';
				} );
				wheels.forEach( ( wheel ) => {
					wheel.style.transition = 'none';
				} );
			}

			// Collapse leading wheels so there are no leading zeros.
			wheels[ 0 ]?.classList.toggle(
				'is-collapsed',
				durationMinutes < 100
			);
			wheels[ 1 ]?.classList.toggle(
				'is-collapsed',
				durationMinutes < 10
			);

			// First run: seat each wheel on its digit without animating.
			if ( initial ) {
				odometers.set( element, {
					value: durationMinutes,
					positions: [ ...digits ],
				} );
				strips.forEach( ( strip, i ) => {
					strip.style.transform = wheelTransform( digits[ i ] );
				} );
				void element.offsetHeight;
				requestAnimationFrame( () => {
					strips.forEach( ( strip ) => {
						strip.style.transition = '';
					} );
					wheels.forEach( ( wheel ) => {
						wheel.style.transition = '';
					} );
				} );

				return;
			}

			const direction = Math.sign( durationMinutes - state.value ) || 1;
			const previous = durationDigits( state.value );

			strips.forEach( ( strip, i ) => {
				// Rebase to the previous digit without animating (an invisible jump
				// — same glyph, different repeat) to keep the position bounded,
				// then roll from there toward the new digit in the press direction.
				strip.style.transition = 'none';
				strip.style.transform = wheelTransform( previous[ i ] );
				void strip.offsetHeight;

				const distance =
					direction > 0
						? ( digits[ i ] - previous[ i ] + 10 ) % 10
						: -( ( previous[ i ] - digits[ i ] + 10 ) % 10 );
				const target = previous[ i ] + distance;

				strip.style.transition = '';
				strip.style.transform = wheelTransform( target );
				state.positions[ i ] = target;
			} );

			state.value = durationMinutes;
		},
	},
} );
