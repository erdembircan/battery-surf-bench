/**
 * The cockpit's per-instance calculation state — the run session, battery
 * monitor, wake lock, clock and chime that the store's domain slices share but
 * which must stay off the reactive context. Every element scope must reach the
 * same instance, so it is a single module singleton (see {@link instanceFor}).
 */

import { BatteryMonitor, type BatteryReading } from './BatteryMonitor';
import { ScreenWakeLock } from './WakeLock';
import { RunSession } from './RunSession';
import { FinishChime } from './FinishChime';
import { ToastQueue } from './Toasts';

/** Per-instance calculation state, kept off the reactive context and keyed by it. */
export interface InstanceState {
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
	/** The finish chime, or null where Web Audio is absent. */
	chime: FinishChime | null;
	/**
	 * Wall-clock time (ms since the Unix epoch) the run started, or null between
	 * runs. The session log stamps samples against a monotonic clock, which is
	 * right for the drain maths but carries no calendar time; this captures the
	 * real start so the persisted session records when it actually ran.
	 */
	startedAtWall: number | null;
	/**
	 * The pending auto-flip timeout id after "New run" returns to the startup
	 * front, or null when none is scheduled. Tracked so a fresh dismissal cancels
	 * any prior pending flip and the timeout can be cleared if a run starts first.
	 */
	idleFlipTimer: number | null;
	/** Pending toasts behind the one showing; the showing one rides the context. */
	toasts: ToastQueue;
	/** The showing toast's hold timeout id, or null when none is on screen. */
	toastTimer: number | null;
	/**
	 * Whether the view-only notice has already shown during the current run.
	 * Gates it to once per run so moving the cursor over the viewport cannot
	 * machine-gun the toast; re-armed when a run starts.
	 */
	noticeShownThisRun: boolean;
	/** The behavior key waiting behind the bark showing, or null when none. */
	pendingBark: string | null;
	/** The queued bark's announced duration in ms, or null when none is queued. */
	pendingDurationMs: number | null;
	/**
	 * The showing bark's duration timeout id — armed for its full announced
	 * wall-clock dwell, firing the entering → leaving transition — or null
	 * when no bark is on screen.
	 */
	barkDurationTimer: number | null;
	/**
	 * The showing bark's leave timeout id — armed for the fixed leave
	 * duration once leaving begins, firing the clear — or null when not
	 * leaving.
	 */
	barkLeaveTimer: number | null;
	/** The viewport load-watchdog timeout id while a navigation is pending, or null. */
	loadWatchdog: number | null;
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
	chime: null,
	startedAtWall: null,
	idleFlipTimer: null,
	toasts: new ToastQueue(),
	toastTimer: null,
	noticeShownThisRun: false,
	pendingBark: null,
	pendingDurationMs: null,
	barkDurationTimer: null,
	barkLeaveTimer: null,
	loadWatchdog: null,
};

/**
 * The cockpit's run calculation state.
 *
 * @return The shared per-instance state.
 */
export const instanceFor = (): InstanceState => runInstance;

/** Resets the run state between tests. Not used by the running cockpit. */
export const __resetInstance = (): void => {
	runInstance.session = new RunSession();
	runInstance.lastReading = null;
	runInstance.monitor = null;
	runInstance.wakeLock = null;
	runInstance.clock = null;
	runInstance.chime = null;
	runInstance.startedAtWall = null;
	runInstance.idleFlipTimer = null;
	runInstance.toasts = new ToastQueue();
	runInstance.toastTimer = null;
	runInstance.noticeShownThisRun = false;
	runInstance.pendingBark = null;
	runInstance.pendingDurationMs = null;
	runInstance.barkDurationTimer = null;
	runInstance.barkLeaveTimer = null;
	runInstance.loadWatchdog = null;
};

/**
 * The monotonic clock the run session stamps samples against.
 *
 * @return The current high-resolution timestamp, in milliseconds.
 */
export const now = (): number => performance.now();

/**
 * The wall clock the persisted session records its calendar timestamps against.
 * Kept separate from {@link now} (which is monotonic, for the drain maths) so
 * the upload can stamp when a run actually ran.
 *
 * @return The current time, in milliseconds since the Unix epoch.
 */
export const wallNow = (): number => Date.now();
