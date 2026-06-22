/**
 * Cockpit view — the Interactivity API store backing the `bsb/cockpit` block.
 *
 * The block's PHP render seeds a per-instance context with the surfable course
 * pages, the active page index, and the run configuration the control deck
 * edits — benchmark mode, the duration to run for, whether to calibrate a
 * baseline first, the surf speed, and whether a run is live. This module is a
 * thin wiring layer: it derives the viewport URL and the deck's reactive
 * readouts from that context and delegates the real work to focused, separately
 * tested domains — theme resolution ({@link ./Theme}), the target-drop slider
 * ({@link ./TargetControl}), config normalization ({@link ./RunConfig}), display
 * formatting ({@link ./Format}), battery acquisition ({@link ./BatteryMonitor}),
 * and the drain-rate calculations ({@link ./RunSession}). Keeping the store thin
 * is deliberate: the Interactivity API makes it easy to pile everything into one
 * file, and the calculations especially must live where they can be unit-tested
 * in isolation.
 */

import { store, getContext, getElement } from '@wordpress/interactivity';
import {
	type RunMode,
	type Speed,
	SPEEDS,
	normalizeDuration,
	normalizeMode,
	normalizeSpeed,
} from './RunConfig';
import {
	TARGET_MIN,
	TARGET_STEP,
	targetCap,
	clampTarget,
	targetFromPointer,
	targetColor,
} from './TargetControl';
import {
	type ThemeName,
	type ThemePref,
	resolveTheme,
	nextThemePref,
	readStoredPref,
	writeStoredPref,
} from './Theme';
import {
	formatClock,
	formatTimeToEmpty,
	formatRate,
	durationDigits,
} from './Format';
import { BatteryMonitor, type BatteryReading } from './BatteryMonitor';
import { ScreenWakeLock, type WakeLockSentinelLike } from './WakeLock';
import { RunSession } from './RunSession';
import { buildGraph, type GraphViewport, type GraphModel } from './DrainGraph';
import { paintGraph } from './GraphSvg';

/** One surfable course page, as supplied by the `bsb/course-pages` binding. */
interface CoursePage {
	slug: string;
	title: string;
	url: string;
}

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
	ended: boolean;
	endReason: RunEndReason;
	flipped: boolean;
	reasonText: Record< string, ReasonText >;
	// Frozen summary readouts, stored on the context (reactive) at run end so the
	// summary re-renders — the session log they derive from is not a signal.
	summaryBatteryStart: string;
	summaryBatteryEnd: string;
	summaryDropped: string;
	hasGraph: boolean;
	// The drain-graph draw model, serialised so it lands in reactive context; the
	// summary painter parses it back to redraw the chart.
	graphJson: string;
}

/** Why a run ended — drives the summary's verdict; empty before any run ends. */
type RunEndReason = '' | 'duration' | 'targetDrop' | 'stopped' | 'plugged';

/** The translated wording shown on the summary for a given end reason. */
interface ReasonText {
	/** Handwritten verdict heading, e.g. "The run is in.". */
	head: string;
	/** One-line signature under the heading, e.g. "Ran the full 30 minutes.". */
	sig: string;
	/** The postmark's lower curved label, e.g. "· COMPLETED ·". */
	arc: string;
	/** The postmark's centre unit label, e.g. "MIN RUN" / "REACHED" / "ELAPSED". */
	unit: string;
}

/** Per-instance calculation state, kept off the reactive context and keyed by it. */
interface InstanceState {
	/** The run's sample log and drain-rate derivations. */
	session: RunSession;
	/** The last battery reading seen, so a run can seed its first sample on start. */
	lastReading: BatteryReading | null;
	/** The battery monitor, so a run can gate its heartbeat poll to its lifecycle. */
	monitor: BatteryMonitor | null;
	/** The screen wake lock, held while a run is live so the display stays awake. */
	wakeLock: ScreenWakeLock | null;
	/** The run clock interval id while a run is live, or null when at rest. */
	clock: number | null;
}

/**
 * The cockpit's run calculation state. A single module instance: the dashboard
 * renders exactly one cockpit, and every element scope must reach the same
 * session — neither a WeakMap keyed by the context proxy nor a runtime-added
 * context property reaches all scopes, because `getContext()` returns a distinct
 * proxy per scope and only the seeded context keys propagate across them.
 */
const runInstance: InstanceState = {
	session: new RunSession(),
	lastReading: null,
	monitor: null,
	wakeLock: null,
	clock: null,
};

/** The cockpit's run calculation state. */
const instanceFor = (): InstanceState => runInstance;

/** Resets the run state between tests. Not used by the running cockpit. */
export const __resetInstance = (): void => {
	runInstance.session = new RunSession();
	runInstance.lastReading = null;
	runInstance.monitor = null;
	runInstance.wakeLock = null;
	runInstance.clock = null;
};

/** The monotonic clock the run session stamps samples against. */
const now = (): number => performance.now();

/**
 * The summary drain graph's drawing viewport (SVG user units). A wide, short
 * aspect so the chart fills the card's width yet stays short enough to leave room
 * for the stat tiles below it within the card's fixed aspect ratio.
 */
const GRAPH_VIEWPORT: GraphViewport = {
	width: 480,
	height: 90,
	padLeft: 30,
	padRight: 10,
	padTop: 8,
	padBottom: 18,
};

/** The summary chart geometry for the run, or null when nothing to plot. */
const graphFor = (): GraphModel | null => {
	const session = instanceFor().session;
	return buildGraph(
		session.samples(),
		session.readouts().secondsToEmpty,
		GRAPH_VIEWPORT
	);
};

/**
 * Mirrors the session's derived readouts onto the reactive context.
 * @param context
 * @param session
 */
const applyReadouts = (
	context: CockpitContext,
	session: RunSession
): void => {
	const readouts = session.readouts();
	context.rate10 = readouts.rate10;
	context.rateSession = readouts.rateSession;
	context.secondsToEmpty = readouts.secondsToEmpty;
};

/**
 * Freezes the run's summary onto the context: the rate readouts, the start and
 * end battery and drop, and the drain-graph draw model. All land in reactive
 * context (not read live off the non-reactive session log) so the summary
 * renders and re-renders correctly.
 * @param context
 * @param instance
 */
const freezeSummary = (
	context: CockpitContext,
	instance: InstanceState
): void => {
	applyReadouts( context, instance.session );

	const summary = instance.session.summary();
	context.summaryBatteryStart = summary
		? String( Math.round( summary.startLevel * 100 ) )
		: '—';
	context.summaryBatteryEnd = summary
		? String( Math.round( summary.endLevel * 100 ) )
		: '—';
	context.summaryDropped = summary
		? String( Math.round( summary.droppedPct ) )
		: '—';

	const graph = graphFor();
	context.hasGraph = graph !== null;
	context.graphJson = graph ? JSON.stringify( graph ) : '';
};

/**
 * Ends a live run, returning the cockpit to its idle, ready state: the run
 * stops and the calculation session is wound up. The single place a run is torn
 * down, whether by the stop control, by plugging in, or by the duration
 * elapsing. It only flips `running`; everything bound to a run reacts to that —
 * the deck returns and the compact pill closes (`isCompact` derives false once
 * `running` is false), and the run clock and battery heartbeat poll stop through
 * the run-activity watch — so each run-scoped effect stays bound to its one cause.
 *
 * Ending also raises the summary: the final readouts are frozen, the run is
 * marked ended with the reason it ended, and the summary card is reset to its
 * picture front. The summary's visibility derives from `ended`, so it appears
 * whatever ended the run.
 * @param context
 * @param instance
 * @param reason   Why the run ended, recorded for the summary's verdict.
 */
const stopRun = (
	context: CockpitContext,
	instance: InstanceState,
	reason: RunEndReason
): void => {
	freezeSummary( context, instance );
	context.running = false;
	context.ended = true;
	context.endReason = reason;
	context.flipped = false;
	instance.session.stop();
};

/** Whether a pointer drag on the battery slider is in progress. */
let draggingTarget = false;

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
			return targetColor( getContext< CockpitContext >().targetPercent );
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
			return formatRate( getContext< CockpitContext >().rate10 );
		},

		/** Drain rate over the whole session, or an em dash until known. */
		get rateSessionDisplay(): string {
			return formatRate( getContext< CockpitContext >().rateSession );
		},

		/** Projected time to empty as `H:MM`, or an em dash until known. */
		get timeToEmptyDisplay(): string {
			return formatTimeToEmpty(
				getContext< CockpitContext >().secondsToEmpty
			);
		},

		/**
		 * The run clock as a `MM:SS` string: a countdown from the chosen duration
		 * in duration mode, or elapsed time in target-drop mode (which has no fixed
		 * length). The duration is normalized so a tampered context cannot stretch
		 * the countdown past the supported ceiling.
		 */
		get runClock(): string {
			const { mode, durationMinutes, elapsed } =
				getContext< CockpitContext >();

			return mode === 'duration'
				? formatClock(
						normalizeDuration( durationMinutes ) * 60 - elapsed
				  )
				: formatClock( elapsed );
		},

		/** Whether a run has finished, so the summary card is shown. */
		get isEnded(): boolean {
			return getContext< CockpitContext >().ended;
		},

		/** Whether the summary card is turned to its report back. */
		get isFlipped(): boolean {
			return getContext< CockpitContext >().flipped;
		},

		/** Whether the finished run ran its full duration. */
		get isReasonDuration(): boolean {
			return getContext< CockpitContext >().endReason === 'duration';
		},

		/** Whether the finished run reached its target drop. */
		get isReasonTargetDrop(): boolean {
			return getContext< CockpitContext >().endReason === 'targetDrop';
		},

		/** Whether the finished run was stopped by hand. */
		get isReasonStopped(): boolean {
			return getContext< CockpitContext >().endReason === 'stopped';
		},

		/** Whether the finished run was cut short by plugging in. */
		get isReasonPlugged(): boolean {
			return getContext< CockpitContext >().endReason === 'plugged';
		},

		/** Elapsed run time as `MM:SS`, counting up — the summary's run length. */
		get summaryElapsed(): string {
			return formatClock( getContext< CockpitContext >().elapsed );
		},

		/** The summary's handwritten verdict heading for the end reason. */
		get summaryHeading(): string {
			const context = getContext< CockpitContext >();
			return context.reasonText?.[ context.endReason ]?.head ?? '';
		},

		/** The summary's one-line signature for the end reason. */
		get summarySig(): string {
			const context = getContext< CockpitContext >();
			return context.reasonText?.[ context.endReason ]?.sig ?? '';
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
		 * minutes, normalized to the supported range and step.
		 */
		stepDuration(): void {
			const { ref } = getElement();
			const step = Number( ref?.dataset.step );

			if ( ! Number.isFinite( step ) ) {
				return;
			}

			const context = getContext< CockpitContext >();
			context.durationMinutes = normalizeDuration(
				context.durationMinutes + step
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

			if ( ( SPEEDS as readonly number[] ).includes( speed ) ) {
				getContext< CockpitContext >().speed = speed as Speed;
			}
		},

		/**
		 * Starts or stops the run. Starting normalizes the (client-seeded, so
		 * untrusted) run configuration, resets the elapsed clock and readouts,
		 * begins a fresh calculation session seeded with the latest battery
		 * reading, reveals the readouts pill and hides the configuration controls;
		 * stopping returns the cockpit to its idle, ready state with the controls
		 * back. Starting is refused while the device is plugged in — a benchmark
		 * must run on battery.
		 */
		toggleRun(): void {
			const context = getContext< CockpitContext >();
			const instance = instanceFor();

			if ( context.running ) {
				stopRun( context, instance, 'stopped' );
				return;
			}

			if ( context.batteryCharging ) {
				return;
			}

			// Treat the seeded config as untrusted: clamp/snap every value that
			// bounds the run before it drives the clock or the calculations.
			context.mode = normalizeMode( context.mode );
			context.durationMinutes = normalizeDuration(
				context.durationMinutes
			);
			context.speed = normalizeSpeed( context.speed );
			context.targetPercent = clampTarget(
				context.targetPercent,
				targetCap( context.batteryLevel )
			);

			context.elapsed = 0;
			context.compact = false;
			context.rate10 = null;
			context.rateSession = null;
			context.secondsToEmpty = null;
			context.ended = false;
			context.endReason = '';
			context.flipped = false;
			context.running = true;

			instance.session.start( now() );
			if ( instance.lastReading ) {
				instance.session.record(
					now(),
					instance.lastReading.level,
					instance.lastReading.charging
				);
				applyReadouts( context, instance.session );
			}
		},

		/**
		 * Collapses the deck to give the viewport full width (or restores it),
		 * moving the readouts into the top pill. Only used while a run is live.
		 */
		toggleCompact(): void {
			const context = getContext< CockpitContext >();
			context.compact = ! context.compact;
		},

		/** Turns the summary card between its picture front and its report back. */
		toggleFlip(): void {
			const context = getContext< CockpitContext >();
			context.flipped = ! context.flipped;
		},

		/**
		 * Dismisses the summary back to the idle startup screen — the deck and the
		 * startup postcard — without beginning a run. Clears the ended state; a run
		 * only starts later when the user presses Start.
		 */
		newRun(): void {
			const context = getContext< CockpitContext >();
			context.ended = false;
			context.endReason = '';
			context.flipped = false;
		},

		/**
		 * Cycles the theme preference (system → light → dark → system) and
		 * remembers it. "System" follows the OS, so it is a sticky choice in its
		 * own right; a fixed light/dark choice overrides the OS until changed.
		 */
		toggleTheme(): void {
			const context = getContext< CockpitContext >();
			const next = nextThemePref( context.themePref );
			context.themePref = next;
			context.theme = resolveTheme( next );
			writeStoredPref( next );
		},
	},
	callbacks: {
		/**
		 * Feeds the battery readouts and the drain-rate calculations from the
		 * Battery Status API. On every reading — whether from a change event or the
		 * backup heartbeat — it syncs the level and charging state, caps the target
		 * to the battery on hand, and, while a run is live, records the sample and
		 * refreshes the derived rates and projection. Plugging in mid-run stops the
		 * run (a benchmark must drain the battery). A no-op where the API is absent,
		 * leaving the readouts at their em-dash idle state. Returns a cleanup that
		 * detaches the listeners and stops the heartbeat.
		 */
		initBattery(): () => void {
			const provider = (
				navigator as Navigator & {
					getBattery?: () => Promise<
						BatteryReading & {
							addEventListener: (
								t: string,
								l: () => void
							) => void;
							removeEventListener: (
								t: string,
								l: () => void
							) => void;
						}
					>;
				}
			 ).getBattery?.bind( navigator );

			if ( ! provider ) {
				return () => undefined;
			}

			const context = getContext< CockpitContext >();
			const instance = instanceFor();

			const monitor = new BatteryMonitor( {
				getBattery: provider,
				onReading: ( reading ) => {
					instance.lastReading = reading;
					context.batteryLevel = Math.round( reading.level * 100 );
					context.batteryCharging = reading.charging;

					// A benchmark must drain the battery: plugging in mid-run ends
					// the run rather than recording charging samples.
					if ( reading.charging && context.running ) {
						stopRun( context, instance, 'plugged' );
					}

					// Target-drop run: stop the moment the battery has fallen to
					// the chosen stop-at level — at the target (75 stops at 75),
					// not a step past it.
					if (
						context.running &&
						context.mode === 'targetDrop' &&
						context.batteryLevel !== null &&
						context.batteryLevel <= context.targetPercent
					) {
						stopRun( context, instance, 'targetDrop' );
					}

					// While idle the stop-at target follows the battery down — it
					// can't sit above the battery you have. During a run it stays
					// fixed, so the run has a stable target to reach rather than one
					// that chases the draining level.
					if ( ! context.running ) {
						const cap = targetCap( context.batteryLevel );
						if ( context.targetPercent > cap ) {
							context.targetPercent = cap;
						}
					}

					if ( instance.session.active ) {
						instance.session.record(
							now(),
							reading.level,
							reading.charging
						);
						applyReadouts( context, instance.session );
					}
				},
			} );

			instance.monitor = monitor;
			// Acquire passively (live readout + charger guard); the heartbeat poll
			// is driven by the run-polling watch, which reacts to `running`.
			monitor.start();

			return () => {
				monitor.stop();
				instance.monitor = null;
			};
		},

		/**
		 * Wires the screen wake lock that keeps the display awake during a run.
		 * The lock is taken and dropped by the run-activity watch as `running`
		 * changes; this builds the requester and recovers the lock when the page
		 * becomes visible again — the browser releases it automatically whenever
		 * the tab is hidden, and never re-acquires on its own. Returns a cleanup
		 * that drops the lock and detaches the listener. A no-op where the API is
		 * absent, leaving runs without a lock rather than erroring.
		 */
		initWakeLock(): () => void {
			const api = (
				navigator as unknown as {
					wakeLock?: {
						request: (
							type: 'screen'
						) => Promise< WakeLockSentinelLike >;
					};
				}
			 ).wakeLock;

			if ( ! api ) {
				return () => undefined;
			}

			const context = getContext< CockpitContext >();
			const instance = instanceFor();
			instance.wakeLock = new ScreenWakeLock( {
				request: () => api.request( 'screen' ),
			} );

			const onVisibility = (): void => {
				if (
					document.visibilityState === 'visible' &&
					context.running
				) {
					void instance.wakeLock?.acquire();
				}
			};
			document.addEventListener( 'visibilitychange', onVisibility );

			return () => {
				document.removeEventListener(
					'visibilitychange',
					onVisibility
				);
				void instance.wakeLock?.release();
				instance.wakeLock = null;
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
				const pref = readStoredPref();
				context.themePref = pref;
				context.theme = resolveTheme( pref );
			};

			apply();
			media?.addEventListener?.( 'change', apply );

			return () => media?.removeEventListener?.( 'change', apply );
		},

		/**
		 * Binds every run-scoped timer to the run, reacting to `running` rather
		 * than being toggled at each place a run starts or stops. While a run is
		 * live it runs the elapsed clock (one tick a second, ending the run when a
		 * duration run reaches its normalized length), the battery heartbeat poll,
		 * and the screen wake lock; when the run ends — whatever the cause (the
		 * stop control, plugging in, the duration elapsing) — all three stop.
		 * Driven by `data-wp-watch`, so it re-runs whenever `running` changes. The
		 * passive battery change listeners stay attached throughout, so the charger
		 * guard keeps working at rest.
		 */
		syncRunActivity(): void {
			const context = getContext< CockpitContext >();
			const instance = instanceFor();

			if ( context.running ) {
				instance.monitor?.startHeartbeat();
				void instance.wakeLock?.acquire();

				if ( instance.clock === null ) {
					instance.clock = setInterval( () => {
						context.elapsed += 1;

						if (
							context.mode === 'duration' &&
							context.elapsed >=
								normalizeDuration( context.durationMinutes ) *
									60
						) {
							stopRun( context, instance, 'duration' );
						}
					}, 1000 ) as unknown as number;
				}

				return;
			}

			instance.monitor?.stopHeartbeat();
			void instance.wakeLock?.release();

			if ( instance.clock !== null ) {
				clearInterval( instance.clock );
				instance.clock = null;
			}
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
					strip.style.transform = wheelTransform( digits[ i ]! );
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
				strip.style.transform = wheelTransform( previous[ i ]! );
				void strip.offsetHeight;

				const distance =
					direction > 0
						? ( digits[ i ]! - previous[ i ]! + 10 ) % 10
						: -( ( previous[ i ]! - digits[ i ]! + 10 ) % 10 );
				const target = previous[ i ]! + distance;

				strip.style.transition = '';
				strip.style.transform = wheelTransform( target );
				state.positions[ i ] = target;
			} );

			state.value = durationMinutes;
		},

		/**
		 * Paints the summary's SVG from the frozen run — the drain-graph paths and
		 * the postmark's verdict text. Done imperatively (rather than with bound
		 * directives) because the Interactivity runtime cannot process directives
		 * inside SVG during server render; driven by `data-wp-watch`, it re-runs
		 * when the run ends or its reason changes.
		 */
		renderSummary(): void {
			const root = getElement().ref as HTMLElement | null;

			if ( ! root ) {
				return;
			}

			const context = getContext< CockpitContext >();

			// Repaint the drain chart from the frozen draw model on context
			// (reactive), so this watch re-runs when the summary is raised.
			const svg = root.querySelector( '.bsb-summary__chart' );
			if ( svg ) {
				const model: GraphModel | null = context.graphJson
					? ( JSON.parse( context.graphJson ) as GraphModel )
					: null;
				paintGraph( svg as SVGElement, model );
			}

			const reason = context.reasonText?.[ context.endReason ];
			const value =
				context.endReason === 'targetDrop'
					? `${ context.targetPercent }%`
					: formatClock( context.elapsed );
			const setText = ( selector: string, text: string ): void => {
				const el = root.querySelector( selector );
				if ( el ) {
					el.textContent = text;
				}
			};
			setText( '.bsb-frank__arc-text', reason?.arc ?? '' );
			setText( '.bsb-frank__val', value );
			setText( '.bsb-frank__unit', reason?.unit ?? '' );
		},
	},
} );
