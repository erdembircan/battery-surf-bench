/**
 * The run slice of the cockpit store: the live run itself. Owns the viewport
 * URL, the run clock and rate readouts, the idle/running/compact deck states,
 * the start/stop and compact controls, and the run-scoped effects — the elapsed
 * clock, the battery heartbeat poll and the screen wake lock — all bound to the
 * single `running` signal so they start and stop with the run whatever its cause.
 */

import { getContext } from '@wordpress/interactivity';
import { type CockpitContext } from './CockpitContext';
import { type StorePart } from './StoreParts';
import { instanceFor, now, wallNow } from './RunInstance';
import { applyReadouts, stopRun } from './RunLifecycle';
import { normalizeDuration, normalizeMode, normalizeSpeed } from './RunConfig';
import { clampTarget, targetCap } from './TargetControl';
import { ScreenWakeLock, type WakeLockSentinelLike } from './WakeLock';
import { formatClock, formatTimeToEmpty, formatRate } from './Format';
import { withSurferParams } from './SurferUrl';
import { isPageDoneMessage, nextPageIndex } from './PageAdvance';

/** The run slice of the `bsb/cockpit` store. */
export const runStore: StorePart = {
	state: {
		/**
		 * URL of the active course page, bound onto the viewport iframe. Empty
		 * until a run starts, so the benchmarked pages are not fetched while the
		 * idle screen is showing — the iframe loads only once surfing begins.
		 * Carries the surfer's trait vector and demo speed as query params, the
		 * only channel the engine running inside the iframe reads them from.
		 */
		get currentSrc(): string {
			const { pages, activeIndex, running, traits, speed } =
				getContext< CockpitContext >();

			if ( ! running ) {
				return '';
			}

			const url = pages[ activeIndex ]?.url;

			return url ? withSurferParams( url, traits, speed ) : '';
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
	},
	actions: {
		/**
		 * Starts or stops the run. Starting normalizes the (client-seeded, so
		 * untrusted) run configuration, resets the elapsed clock and readouts,
		 * begins a fresh calculation session seeded with the latest battery
		 * reading, reveals the readouts pill and hides the configuration controls,
		 * and opens in the compact stage view (the user can expand to the full
		 * dashboard mid-run); stopping returns the cockpit to its idle, ready
		 * state with the controls back. Starting is refused while the device is
		 * plugged in or where the Battery Status API is unsupported — a benchmark
		 * must run on a draining battery it can read.
		 */
		toggleRun(): void {
			const context = getContext< CockpitContext >();
			const instance = instanceFor();

			if ( context.running ) {
				stopRun( context, instance, 'stopped' );
				return;
			}

			// A run needs battery data to measure. Refuse to start when the
			// Battery Status API is unsupported (the deck is locked away, but the
			// action is guarded too against a forced or tampered call) or while
			// the device is plugged in — a benchmark must run on a draining
			// battery.
			if ( ! context.batterySupported || context.batteryCharging ) {
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
			// Runs open in the compact stage view; the user can expand to the
			// full dashboard mid-run via the stage's expand control.
			context.compact = true;
			context.rate10 = null;
			context.rateSession = null;
			context.secondsToEmpty = null;
			context.ended = false;
			context.endReason = '';
			context.flipped = false;
			// Re-arm the once-per-run view-only notice for this run.
			instance.noticeShownThisRun = false;
			context.running = true;

			// Unlock audio under this click (a user gesture) so a default-on run
			// the user never toggled can still sound at its gesture-less finish.
			if ( context.soundEnabled ) {
				instance.chime?.prime();
			}

			instance.startedAtWall = wallNow();
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
	},
	callbacks: {
		/**
		 * Wires the screen wake lock that keeps the display awake during a run.
		 * The lock is taken and dropped by the run-activity watch as `running`
		 * changes; this builds the requester and recovers the lock when the page
		 * becomes visible again — the browser releases it automatically whenever
		 * the tab is hidden, and never re-acquires on its own. Returns a cleanup
		 * that drops the lock and detaches the listener. A no-op where the API is
		 * absent, leaving runs without a lock rather than erroring.
		 *
		 * @return A cleanup that releases the lock and detaches the listener.
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
		 * Listens for the surf engine's page-done handshake and advances the
		 * viewport to the next course page once it arrives. The listener stays
		 * attached for the block's lifetime and no-ops while idle (checked per
		 * message, not toggled with `running`), same as {@see initWakeLock}'s
		 * visibility listener.
		 *
		 * @return A cleanup that detaches the listener.
		 */
		initPageAdvance(): () => void {
			const context = getContext< CockpitContext >();

			const onMessage = ( event: MessageEvent ): void => {
				if (
					! context.running ||
					! isPageDoneMessage( event, window.location.origin )
				) {
					return;
				}

				context.activeIndex = nextPageIndex(
					context.activeIndex,
					context.pages.length
				);
			};

			window.addEventListener( 'message', onMessage );

			return () => window.removeEventListener( 'message', onMessage );
		},
	},
};
