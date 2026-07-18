/**
 * The run slice of the cockpit store: the live run itself. Owns the viewport
 * URL, the run clock and rate readouts, the idle/running/compact deck states,
 * the start/stop and compact controls, and the run-scoped effects — the elapsed
 * clock, the battery heartbeat poll and the screen wake lock — all bound to the
 * single `running` signal so they start and stop with the run whatever its cause.
 */

import {
	getConfig,
	getContext,
	getElement,
	store,
} from '@wordpress/interactivity';
import { type CockpitContext } from '@/cockpit/CockpitContext';
import { type StorePart } from '@/cockpit/StoreParts';
import { instanceFor, now, wallNow } from '@/cockpit/RunInstance';
import { applyReadouts, stopRun } from '@/cockpit/RunLifecycle';
import {
	normalizeDuration,
	normalizeMode,
	normalizeSpeed,
} from '@/cockpit/RunConfig';
import { clampTarget, targetCap } from '@/cockpit/TargetControl';
import { ScreenWakeLock, type WakeLockSentinelLike } from '@/cockpit/WakeLock';
import { formatClock, formatTimeToEmpty, formatRate } from '@/cockpit/Format';
import { withSurferParams } from '@/cockpit/SurferUrl';
import { buildSurfIndexUrl } from '@/cockpit/SurfIndexUrl';
import { isPageDoneMessage, nextPageIndex } from '@/cockpit/PageAdvance';
import { isBlankFrame, viewportFailed } from '@/cockpit/PageGuard';
import { runBlocksExit, confirmExit } from '@/cockpit/ExitGuard';

/**
 * The surf-route configuration the cockpit's PHP route seeds via
 * `getConfig()` — the site's home URL and a `bsb_surf` nonce, the only
 * material `currentSrc` needs to build an index request. Read from the same
 * `bsb/cockpit` config object {@link ./SessionUpload} reads its REST access
 * from.
 */
interface SurfConfig {
	/** The site's home URL, seeded server-side. */
	surfBase: string;
	/** A `bsb_surf` nonce proving the request came from the authorized cockpit. */
	surfNonce: string;
}

/**
 * The slice of the merged `bsb/cockpit` state the Surf dev-tool contributes,
 * read defensively (production reads `state.devtools` optionally, exactly as
 * `../devtools/BatteryOverrideStore`'s precedent requires — it may not exist
 * at all with no dev-tools module loaded).
 */
interface SharedDevtoolsSurfState {
	devtools?: {
		surf?: {
			/** The armed override, snapshotted once at run start. */
			sterile: boolean;
			/** A pending page-jump command from the panel's stepper, or null. */
			pageStep: { delta: -1 | 1; seq: number } | null;
			/** The live sterile page's affordance flags; cleared once the run is no longer live-and-sterile. */
			affordances: unknown;
			/** Whether ANY run (natural or sterile) is currently live — mirrored here every watch run, so the panel can lock its Natural/Sterile seg for the run's whole duration. */
			runLive: boolean;
			/** The live sterile page's opaque course-page index; cleared to null once the run is no longer live-and-sterile. */
			pageIndex: number | null;
		};
	};
}

/** The merged store shape the `syncDevtoolsSurf` callback re-fetches by namespace. */
interface SharedDevtoolsSurfStore {
	state: SharedDevtoolsSurfState;
}

/**
 * How long the viewport is given to fire a `load` after a run points it at a
 * page before the run is treated as failed. Generous — same-origin bundled
 * course pages load fast, so only a genuinely hung navigation (a server that
 * accepts the connection but never responds, firing neither `load` nor `error`)
 * runs out the clock. Tuned high to avoid false-positive stops on a slow host.
 */
const VIEWPORT_LOAD_TIMEOUT_MS = 15000;

/** The run slice of the `bsb/cockpit` store. */
export const runStore: StorePart = {
	state: {
		/**
		 * URL of the active course page, bound onto the viewport iframe. Empty
		 * until a run starts, so the benchmarked pages are not fetched while the
		 * idle screen is showing — the iframe loads only once surfing begins.
		 *
		 * Built entirely from the opaque `activeIndex` counter and the surf-route
		 * configuration the cockpit's PHP route seeds (the home URL + a
		 * `bsb_surf` nonce) — the client never knows which page an index names,
		 * how many pages exist, or anything else about them; `CourseRouter`
		 * resolves that server-side. Also carries the surfer's trait vector and
		 * demo speed as query params, the only channel the engine running inside
		 * the iframe reads them from.
		 */
		get currentSrc(): string {
			const { activeIndex, running, traits, speed, sterile } =
				getContext< CockpitContext >();

			if ( ! running ) {
				return '';
			}

			const config = getConfig( 'bsb/cockpit' ) as Partial< SurfConfig >;
			const url = buildSurfIndexUrl(
				config.surfBase ?? '',
				activeIndex,
				config.surfNonce ?? ''
			);

			return url ? withSurferParams( url, traits, speed, sterile ) : '';
		},

		/** Whether no run is live — hides the readouts pill until one starts. */
		get isIdle(): boolean {
			return ! getContext< CockpitContext >().running;
		},

		/** Whether a run is live — shows the pill and hides the config controls. */
		get isRunning(): boolean {
			return getContext< CockpitContext >().running;
		},

		/** Whether the live run is sterile — shows the status head's "Sterile" chip. */
		get isSterileRun(): boolean {
			const { sterile, running } = getContext< CockpitContext >();

			return sterile && running;
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
			// The dev-tools Surf tool's "Sterile" override, snapshotted here only —
			// arming or disarming it mid-run never affects an already-live run.
			// `state.devtools` may not exist at all (no dev-tools module loaded),
			// read defensively, same as `../devtools/BatteryOverrideStore`'s own
			// precedent for a production seam reading dev-tools state.
			const { state: sharedState } =
				store< SharedDevtoolsSurfStore >( 'bsb/cockpit' );
			context.sterile = Boolean( sharedState.devtools?.surf?.sterile );
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

		/**
		 * Guards the viewport against surfing a page that never loaded as a real
		 * course page — a missing/renamed/deleted catalog slug, or any other load
		 * failure, falls through to a page with no surf engine, which would never
		 * post the page-done handshake and leave the run ticking blind forever.
		 * Bound to both the iframe's `load` and `error` events, so it covers the
		 * first page and every page it advances to afterwards alike.
		 *
		 * A `load`/`error` arriving means the pending navigation resolved —
		 * whatever the verdict — so this also cancels the load watchdog
		 * ({@see syncViewportWatchdog}), which exists only to catch a navigation
		 * that resolves *neither* event (a hung server).
		 *
		 * Only acts while a run is live: stopping a run clears `currentSrc` to
		 * `''`, which loads `about:blank` and fires its own `load` event — without
		 * the `running` guard that event would look like a failed load and the
		 * guard would immediately (and wrongly) re-stop an already-stopped run.
		 * The idle screen's hidden, src-less iframe firing a stray load is guarded
		 * the same way.
		 *
		 * @param event The iframe's `load` or `error` event.
		 */
		guardViewport( event: Event ): void {
			const context = getContext< CockpitContext >();

			if ( ! context.running ) {
				return;
			}

			const iframe = getElement().ref as HTMLIFrameElement | null;

			// The empty-src reset frames about:blank, whose load can fire after a
			// run starts; that is not a course-page navigation, so ignore it and
			// leave the watchdog armed for the real navigation still in flight. An
			// error is always a real failure, so it is never ignored.
			if ( event.type !== 'error' && isBlankFrame( iframe ) ) {
				return;
			}

			const instance = instanceFor();

			// A real load or an error resolved the pending navigation — cancel its
			// watchdog and judge whether the framed page loaded as a course page.
			if ( instance.loadWatchdog !== null ) {
				clearTimeout( instance.loadWatchdog );
				instance.loadWatchdog = null;
			}

			if ( viewportFailed( event, iframe ) ) {
				stopRun( context, instance, 'loadError' );
			}
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

				context.activeIndex = nextPageIndex( context.activeIndex );
			};

			window.addEventListener( 'message', onMessage );

			return () => window.removeEventListener( 'message', onMessage );
		},

		/**
		 * Arms the browser's native leave-confirmation dialog while a run is
		 * live, so an accidental reload or navigation away does not silently
		 * lose an in-progress benchmark. Reload and navigation both fire
		 * `beforeunload`, so this one listener covers both. The listener stays
		 * attached for the block's lifetime and no-ops while idle (checked per
		 * event, not toggled with `running`), same as {@see initPageAdvance};
		 * once a run has ended (`running` false again) leaving is never
		 * blocked, since there is nothing left to lose.
		 *
		 * @return A cleanup that detaches the listener.
		 */
		initExitGuard(): () => void {
			const context = getContext< CockpitContext >();

			const onBeforeUnload = ( event: BeforeUnloadEvent ): void => {
				if ( ! runBlocksExit( context ) ) {
					return;
				}
				confirmExit( event );
			};

			window.addEventListener( 'beforeunload', onBeforeUnload );

			return () =>
				window.removeEventListener( 'beforeunload', onBeforeUnload );
		},

		/**
		 * The viewport's load watchdog: catches a navigation that hangs and fires
		 * *neither* `load` nor `error` (a server that accepts the connection but
		 * never responds), which the event-bound {@see guardViewport} cannot see.
		 *
		 * Driven by `data-wp-watch`, so it re-runs whenever one of the values it
		 * reads changes — `running` and `activeIndex` — which arms a fresh
		 * watchdog at run start and on every page advance, and clears it (by
		 * re-running the "supersede" clear below with nothing to re-arm) once
		 * `running` flips false at run end. A `load`/`error` arriving in time
		 * clears it from {@see guardViewport} instead, since that is the event
		 * that resolves the navigation this watchdog is timing.
		 */
		syncViewportWatchdog(): void {
			const context = getContext< CockpitContext >();
			const instance = instanceFor();

			// A fresh navigation (run start or page advance) or a run ending
			// supersedes any pending watchdog; clear it before re-arming.
			if ( instance.loadWatchdog !== null ) {
				clearTimeout( instance.loadWatchdog );
				instance.loadWatchdog = null;
			}

			// Reading running and activeIndex registers them as this watch's
			// dependencies, so it re-runs — and re-arms — at run start/stop and on
			// every page advance (activeIndex is not otherwise used here: every
			// index the counter can reach resolves to a page server-side, the
			// router wraps, so there is no "no page to load" case to check for
			// once a run is live).
			const { running } = context;
			void context.activeIndex;
			if ( ! running ) {
				return;
			}

			instance.loadWatchdog = setTimeout( () => {
				instance.loadWatchdog = null;
				// The navigation never fired load/error within the window: still
				// running, so the page hung. Stop the run the same way a failed
				// load does.
				if ( context.running ) {
					stopRun( context, instance, 'loadError' );
				}
			}, VIEWPORT_LOAD_TIMEOUT_MS ) as unknown as number;
		},

		/**
		 * The production side of the dev-tools Surf tool's run-lock,
		 * page-jump and affordance-gating seam. Driven by `data-wp-watch`, so
		 * it re-runs reactively whenever `running`/`sterile`/`activeIndex`
		 * change or the panel writes a fresh `state.devtools.surf.pageStep`
		 * command.
		 *
		 * Always mirrors `state.devtools.surf.runLive` from `context.running`
		 * (the panel has no cockpit context of its own) — sterile is
		 * snapshotted once at run start, so the Natural/Sterile seg must be
		 * locked for the WHOLE duration of any live run, natural or sterile,
		 * not just a sterile one.
		 *
		 * While the run is live and sterile: mirrors `state.devtools.surf.pageIndex`
		 * from `context.activeIndex`, and applies a pending `pageStep` command
		 * to `context.activeIndex` exactly once (tracked by its monotonic
		 * `seq`, so a repeat of the same delta still applies, and a command
		 * already consumed never re-applies on an unrelated re-run).
		 *
		 * Whenever the run is NOT live-and-sterile (never sterile, not yet
		 * started, or just stopped): clears `state.devtools.surf.affordances`
		 * and `pageIndex` to null, so the panel's chips (and the page
		 * stepper's slug readout) gate off the moment there is no live
		 * sterile page to steer on — and clears any pending `pageStep`
		 * command too, so a click made before this run (or after the last one
		 * ended) can never apply later once some future sterile run goes
		 * live. Only ever touches `state.devtools` when the dev-tools module
		 * has actually joined the store.
		 */
		syncDevtoolsSurf(): void {
			const { state: sharedState } =
				store< SharedDevtoolsSurfStore >( 'bsb/cockpit' );
			const surf = sharedState.devtools?.surf;

			if ( ! surf ) {
				return;
			}

			const context = getContext< CockpitContext >();
			surf.runLive = context.running;

			const liveSterile = context.running && context.sterile;

			if ( ! liveSterile ) {
				surf.affordances = null;
				surf.pageStep = null;
				surf.pageIndex = null;
				return;
			}

			const { pageStep } = surf;

			if ( pageStep ) {
				const instance = instanceFor();

				if ( pageStep.seq !== instance.sterilePageStepSeq ) {
					instance.sterilePageStepSeq = pageStep.seq;
					context.activeIndex += pageStep.delta;
				}
			}

			// Mirrored last, so a pageStep consumed above is reflected in this
			// same pass rather than needing a second reactive re-run.
			surf.pageIndex = context.activeIndex;
		},
	},
};
