/**
 * Screen Wake Lock wrapper — keeps the display awake during a run.
 *
 * A benchmark only means something if the screen stays on for the whole run: if
 * the display sleeps the surfing workload stops and timers throttle. The Screen
 * Wake Lock API holds the display on, but with a sharp edge — the browser
 * releases the lock automatically whenever the tab becomes hidden, and it is
 * never re-acquired on its own. This wraps a single lock behind acquire/release
 * so the store can bind it to the run and re-acquire it when the page is visible
 * again, and so the acquisition (which can be unsupported or blocked) can be
 * tested with a fake requester. It deliberately knows nothing about the run — it
 * just holds or drops the one lock it is told to.
 */

/** The slice of a `WakeLockSentinel` this wrapper uses. */
export interface WakeLockSentinelLike {
	released: boolean;
	release: () => Promise< void >;
	addEventListener: ( type: 'release', listener: () => void ) => void;
	removeEventListener: ( type: 'release', listener: () => void ) => void;
}

/** How the wrapper requests a screen wake lock. */
export interface ScreenWakeLockOptions {
	/** Requests a screen lock (e.g. `() => navigator.wakeLock.request('screen')`). */
	request: () => Promise< WakeLockSentinelLike >;
}

/**
 * Holds at most one screen wake lock. `acquire` requests and holds it;
 * `release` drops it. Both are idempotent and safe to call regardless of the
 * current state, so a caller can drive them straight from run state.
 */
export class ScreenWakeLock {
	private readonly request: () => Promise< WakeLockSentinelLike >;
	private sentinel: WakeLockSentinelLike | undefined;
	/** Whether the lock is currently wanted; guards an in-flight acquire. */
	private wanted = false;

	/** @param options */
	constructor( options: ScreenWakeLockOptions ) {
		this.request = options.request;
		this.handleRelease = this.handleRelease.bind( this );
	}

	/** Whether a live lock is currently held. */
	get held(): boolean {
		return this.sentinel !== undefined && ! this.sentinel.released;
	}

	/**
	 * Requests and holds a screen lock. A no-op when one is already held. If the
	 * request is unsupported or blocked (no user gesture, page not visible) it
	 * gives up quietly. If the lock is released again before the request settles,
	 * the late sentinel is dropped.
	 */
	async acquire(): Promise< void > {
		this.wanted = true;

		if ( this.held ) {
			return;
		}

		try {
			const sentinel = await this.request();

			if ( ! this.wanted ) {
				await sentinel.release().catch( () => undefined );
				return;
			}

			this.sentinel = sentinel;
			sentinel.addEventListener( 'release', this.handleRelease );
		} catch {
			// Unsupported, or blocked by the browser; stay without a lock.
		}
	}

	/** Releases the held lock, if any, and stops wanting one. */
	async release(): Promise< void > {
		this.wanted = false;
		const sentinel = this.sentinel;
		this.sentinel = undefined;

		if ( ! sentinel || sentinel.released ) {
			return;
		}

		sentinel.removeEventListener( 'release', this.handleRelease );
		await sentinel.release().catch( () => undefined );
	}

	/**
	 * Reacts to the browser dropping the lock on its own (typically when the tab
	 * is hidden): forgets the sentinel so the next acquire re-requests. Recovery
	 * is driven by the store re-acquiring when the page becomes visible again.
	 */
	private handleRelease(): void {
		this.sentinel?.removeEventListener( 'release', this.handleRelease );
		this.sentinel = undefined;
	}
}
