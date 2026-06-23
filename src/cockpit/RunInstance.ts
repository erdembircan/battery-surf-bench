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
