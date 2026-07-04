/**
 * Tests for the Battery Status API monitor.
 *
 * The consumer is the store, which constructs the monitor with an acquisition
 * function and a reading callback and relies on readings arriving from two
 * sources: the change events and the backup heartbeat. These tests verify both
 * sources fire the callback, and that stopping detaches everything.
 */

import { describe, it, expect, vi } from 'vitest';
import {
	BatteryMonitor,
	HEARTBEAT_MS,
	type BatteryManagerLike,
	type BatteryReading,
} from './BatteryMonitor';

/**
 * A fake manager whose events can be fired and whose level can be moved.
 * @param level
 * @param charging
 */
const fakeManager = ( level = 0.8, charging = false ) => {
	const listeners: Record< string, () => void > = {};

	return {
		level,
		charging,
		addEventListener: vi.fn( ( type: string, listener: () => void ) => {
			listeners[ type ] = listener;
		} ),
		removeEventListener: vi.fn( ( type: string ) => {
			delete listeners[ type ];
		} ),
		fire: ( type: string ) => listeners[ type ]?.(),
		has: ( type: string ) => type in listeners,
	};
};

/** A controllable interval scheduler. */
const fakeTimers = () => {
	let nextId = 1;
	const intervals = new Map< number, () => void >();

	return {
		setTimer: vi.fn( ( callback: () => void ) => {
			const id = nextId++;
			intervals.set( id, callback );
			return id;
		} ),
		clearTimer: vi.fn( ( id: number ) => intervals.delete( id ) ),
		tick: ( id: number ) => intervals.get( id )?.(),
		active: () => intervals.size,
	};
};

describe( 'BatteryMonitor', () => {
	it( 'emits an immediate reading on acquisition', async () => {
		const onReading = vi.fn< ( reading: BatteryReading ) => void >();
		const manager = fakeManager( 0.42, true );
		const timers = fakeTimers();

		new BatteryMonitor( {
			getBattery: () => Promise.resolve( manager ),
			onReading,
			...timers,
		} ).start();

		await vi.waitFor( () =>
			expect( onReading ).toHaveBeenCalledWith( {
				level: 0.42,
				charging: true,
			} )
		);
	} );

	it( 'emits on a levelchange event from the API', async () => {
		const onReading = vi.fn< ( reading: BatteryReading ) => void >();
		const manager = fakeManager( 0.8, false );
		const timers = fakeTimers();

		new BatteryMonitor( {
			getBattery: () => Promise.resolve( manager ),
			onReading,
			...timers,
		} ).start();

		await vi.waitFor( () =>
			expect( manager.has( 'levelchange' ) ).toBe( true )
		);
		onReading.mockClear();

		manager.level = 0.79;
		manager.fire( 'levelchange' );

		expect( onReading ).toHaveBeenCalledWith( {
			level: 0.79,
			charging: false,
		} );
	} );

	it( 'does not poll until the heartbeat is started', async () => {
		const onReading = vi.fn< ( reading: BatteryReading ) => void >();
		const manager = fakeManager( 0.8, false );
		const timers = fakeTimers();

		new BatteryMonitor( {
			getBattery: () => Promise.resolve( manager ),
			onReading,
			...timers,
		} ).start();

		// Acquisition attaches the passive listeners but schedules no poll.
		await vi.waitFor( () =>
			expect( manager.addEventListener ).toHaveBeenCalled()
		);
		expect( timers.setTimer ).not.toHaveBeenCalled();
		expect( timers.active() ).toBe( 0 );
	} );

	it( 'emits from the backup heartbeat once started, at the configured cadence', async () => {
		const onReading = vi.fn< ( reading: BatteryReading ) => void >();
		const manager = fakeManager( 0.8, false );
		const timers = fakeTimers();

		const monitor = new BatteryMonitor( {
			getBattery: () => Promise.resolve( manager ),
			onReading,
			...timers,
		} );
		monitor.start();
		await vi.waitFor( () =>
			expect( manager.addEventListener ).toHaveBeenCalled()
		);

		monitor.startHeartbeat();
		// The heartbeat is scheduled at the 30-second default.
		expect( timers.setTimer ).toHaveBeenCalledWith(
			expect.any( Function ),
			HEARTBEAT_MS
		);
		onReading.mockClear();

		// The events have gone quiet; the heartbeat still produces a reading.
		manager.level = 0.5;
		timers.tick( timers.setTimer.mock.results[ 0 ]!.value as number );

		expect( onReading ).toHaveBeenCalledWith( {
			level: 0.5,
			charging: false,
		} );
	} );

	it( 'stops the heartbeat but keeps the change listeners on stopHeartbeat', async () => {
		const onReading = vi.fn< ( reading: BatteryReading ) => void >();
		const manager = fakeManager( 0.8, false );
		const timers = fakeTimers();

		const monitor = new BatteryMonitor( {
			getBattery: () => Promise.resolve( manager ),
			onReading,
			...timers,
		} );
		monitor.start();
		await vi.waitFor( () =>
			expect( manager.addEventListener ).toHaveBeenCalled()
		);

		monitor.startHeartbeat();
		expect( timers.active() ).toBe( 1 );

		monitor.stopHeartbeat();
		expect( timers.active() ).toBe( 0 );
		// The passive listeners stay attached, so the charger guard still sees
		// readings — a plug/unplug after a run still updates state.
		expect( manager.removeEventListener ).not.toHaveBeenCalled();
		onReading.mockClear();
		manager.charging = true;
		manager.fire( 'chargingchange' );
		expect( onReading ).toHaveBeenCalledWith( {
			level: 0.8,
			charging: true,
		} );
	} );

	it( 'detaches listeners and stops the heartbeat on stop', async () => {
		const onReading = vi.fn< ( reading: BatteryReading ) => void >();
		const manager = fakeManager();
		const timers = fakeTimers();

		const monitor = new BatteryMonitor( {
			getBattery: () => Promise.resolve( manager ),
			onReading,
			...timers,
		} );
		monitor.start();
		await vi.waitFor( () =>
			expect( manager.addEventListener ).toHaveBeenCalled()
		);
		monitor.startHeartbeat();
		expect( timers.active() ).toBe( 1 );

		monitor.stop();

		expect( manager.removeEventListener ).toHaveBeenCalledTimes( 2 );
		expect( timers.active() ).toBe( 0 );
	} );

	it( 'refresh re-emits the current reading', async () => {
		const onReading = vi.fn< ( reading: BatteryReading ) => void >();
		const manager = fakeManager( 0.6, false );
		const timers = fakeTimers();

		const monitor = new BatteryMonitor( {
			getBattery: () => Promise.resolve( manager ),
			onReading,
			...timers,
		} );
		monitor.start();
		await vi.waitFor( () =>
			expect( manager.addEventListener ).toHaveBeenCalled()
		);
		onReading.mockClear();

		manager.level = 0.55;
		manager.charging = true;
		monitor.refresh();

		expect( onReading ).toHaveBeenCalledWith( {
			level: 0.55,
			charging: true,
		} );
	} );

	it( 'refresh is a no-op before the manager resolves', () => {
		const onReading = vi.fn< ( reading: BatteryReading ) => void >();
		const timers = fakeTimers();

		const monitor = new BatteryMonitor( {
			getBattery: () =>
				new Promise< BatteryManagerLike >( () => undefined ),
			onReading,
			...timers,
		} );
		monitor.start();
		monitor.refresh();

		expect( onReading ).not.toHaveBeenCalled();
	} );

	it( 'refresh is a no-op after stop', async () => {
		const onReading = vi.fn< ( reading: BatteryReading ) => void >();
		const manager = fakeManager( 0.6, false );
		const timers = fakeTimers();

		const monitor = new BatteryMonitor( {
			getBattery: () => Promise.resolve( manager ),
			onReading,
			...timers,
		} );
		monitor.start();
		await vi.waitFor( () =>
			expect( manager.addEventListener ).toHaveBeenCalled()
		);
		monitor.stop();
		onReading.mockClear();

		monitor.refresh();

		expect( onReading ).not.toHaveBeenCalled();
	} );

	it( 'does not attach when stopped before acquisition resolves', async () => {
		const onReading = vi.fn< ( reading: BatteryReading ) => void >();
		const manager = fakeManager();
		const timers = fakeTimers();
		let resolve!: ( m: BatteryManagerLike ) => void;

		const monitor = new BatteryMonitor( {
			getBattery: () =>
				new Promise< BatteryManagerLike >( ( r ) => {
					resolve = r;
				} ),
			onReading,
			...timers,
		} );
		monitor.start();
		monitor.stop();
		resolve( manager );

		// Let the resolved promise settle.
		await Promise.resolve();

		expect( manager.addEventListener ).not.toHaveBeenCalled();
		expect( onReading ).not.toHaveBeenCalled();
		expect( timers.active() ).toBe( 0 );
	} );
} );
