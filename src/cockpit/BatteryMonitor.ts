/**
 * Battery Status API monitor — the cockpit's source of battery readings.
 *
 * Readings come from two sources, by design. The primary is event-driven: the
 * Battery Status API fires `levelchange`/`chargingchange` whenever the level or
 * charging state moves, which is the cheapest and most precise signal. But the
 * spec leaves event timing to the browser, and implementations are known to fire
 * lazily, so a heartbeat interval re-reads the battery on a fixed cadence as a
 * backup safety net — guaranteeing the run keeps sampling even when the events
 * go quiet. This class isolates that acquisition behind a small reading callback
 * so the store never touches `navigator.getBattery` directly, and so the dual
 * sourcing can be tested with a fake manager and fake timers.
 */

/** A single battery reading, level as a 0..1 fraction. */
export interface BatteryReading {
	level: number;
	charging: boolean;
}

/** The slice of the Battery Status API's `BatteryManager` this monitor uses. */
export interface BatteryManagerLike {
	level: number;
	charging: boolean;
	addEventListener: ( type: string, listener: () => void ) => void;
	removeEventListener: ( type: string, listener: () => void ) => void;
}

/** How the monitor acquires the manager and reports readings. */
export interface BatteryMonitorOptions {
	/** Resolves the Battery Status API manager (e.g. `navigator.getBattery`). */
	getBattery: () => Promise< BatteryManagerLike >;
	/** Called with every reading, from either source. */
	onReading: ( reading: BatteryReading ) => void;
	/** Heartbeat cadence in milliseconds; defaults to {@link HEARTBEAT_MS}. */
	heartbeatMs?: number;
	/** Interval scheduler, injectable for tests; defaults to `setInterval`. */
	setTimer?: ( callback: () => void, ms: number ) => number;
	/** Interval canceller, injectable for tests; defaults to `clearInterval`. */
	clearTimer?: ( id: number ) => void;
}

/** Backup heartbeat cadence: re-read the battery every thirty seconds. */
export const HEARTBEAT_MS = 30_000;

/**
 * Acquires the Battery Status API manager and reports readings from both the
 * change events and a backup heartbeat. Construct with the acquisition function
 * and a reading callback, then start it on mount and stop it on cleanup.
 */
export class BatteryMonitor {
	private readonly options: Required< BatteryMonitorOptions >;
	private manager: BatteryManagerLike | undefined;
	private heartbeat: number | undefined;
	private stopped = false;

	/** @param options */
	constructor( options: BatteryMonitorOptions ) {
		this.options = {
			heartbeatMs: HEARTBEAT_MS,
			setTimer: ( callback, ms ) =>
				window.setInterval( callback, ms ) as unknown as number,
			clearTimer: ( id ) => window.clearInterval( id ),
			...options,
		};
		this.emit = this.emit.bind( this );
	}

	/**
	 * Acquires the manager, takes an immediate reading and attaches the change
	 * listeners — the passive, always-on source that keeps the live battery
	 * readout and the charger guard current. The backup heartbeat poll is started
	 * separately via `startHeartbeat`, so it can be tied to a run rather than poll
	 * continuously. Safe to call once; later calls are ignored.
	 */
	start(): void {
		if ( this.manager || this.stopped ) {
			return;
		}

		this.options
			.getBattery()
			.then( ( manager ) => {
				if ( this.stopped ) {
					return;
				}

				this.manager = manager;
				this.emit();
				manager.addEventListener( 'levelchange', this.emit );
				manager.addEventListener( 'chargingchange', this.emit );
			} )
			.catch( () => {
				// API present but acquisition failed; stay at the idle state.
			} );
	}

	/**
	 * Starts the backup heartbeat poll — re-reading the battery on a fixed
	 * cadence so a run keeps sampling even when the change events fire lazily.
	 * Idempotent, and a no-op once stopped. Reads emitted before the manager is
	 * acquired are skipped.
	 */
	startHeartbeat(): void {
		if ( this.stopped || this.heartbeat !== undefined ) {
			return;
		}

		this.heartbeat = this.options.setTimer(
			this.emit,
			this.options.heartbeatMs
		);
	}

	/**
	 * Stops the backup heartbeat poll, leaving the passive change listeners in
	 * place so the charger guard still sees a plug/unplug.
	 */
	stopHeartbeat(): void {
		if ( this.heartbeat !== undefined ) {
			this.options.clearTimer( this.heartbeat );
			this.heartbeat = undefined;
		}
	}

	/**
	 * Tears the monitor down entirely: stops the heartbeat and detaches the
	 * listeners. After stopping, a pending acquisition will not attach anything.
	 */
	stop(): void {
		this.stopped = true;
		this.stopHeartbeat();
		this.manager?.removeEventListener( 'levelchange', this.emit );
		this.manager?.removeEventListener( 'chargingchange', this.emit );
		this.manager = undefined;
	}

	/** Reports the current reading immediately, if a manager has been acquired. */
	private emit(): void {
		if ( ! this.manager ) {
			return;
		}

		this.options.onReading( {
			level: this.manager.level,
			charging: this.manager.charging,
		} );
	}
}
