import { describe, it, expect, vi } from 'vitest';
import { SterileHelm } from '@/surfer/SterileHelm';
import type {
	Behavior,
	BehaviorContext,
	BehaviorAnnounce,
} from '@/surfer/Behavior';
import type { Motor } from '@/surfer/Motor';
import { FakeMotor } from '@/surfer/FakeMotor';
import { FakeClock } from '@/surfer/FakeClock';
import {
	MoveOn,
	MOVE_ON_KEY,
	MOVE_ON_DISPLAY_MS,
} from '@/surfer/Behaviors/MoveOn';
import { ScrollBurst, SCROLL_BURST_KEY } from '@/surfer/Behaviors/ScrollBurst';
import { openAffordances } from '@/surfer/TestFixtures';

// SterileHelm always compares an incoming steer's origin against the real
// `window.location.origin` (never an injectable expected-origin parameter —
// unlike the pure `is*Message` validators in `src/cockpit/`), so a legitimate
// steer in these tests must be posted with that same real origin.
const ORIGIN = window.location.origin;

/** A behavior whose `run()` announces a duration and resolves once `resolve()` is called. */
class ControllableBehavior implements Behavior {
	readonly key = 'controllable';
	private resolveRun: ( () => void ) | null = null;

	bid(): number {
		return 1;
	}

	run(
		_motor: Motor,
		_ctx: BehaviorContext,
		announce?: BehaviorAnnounce
	): Promise< void > {
		announce?.( 4200 );
		return new Promise( ( resolve ) => {
			this.resolveRun = resolve;
		} );
	}

	resolve(): void {
		this.resolveRun?.();
		this.resolveRun = null;
	}
}

/**
 * Posts a steer command as the top-level window would receive it from the cockpit.
 * @param key
 * @param origin
 */
const steer = ( key: string, origin = ORIGIN ): void => {
	window.dispatchEvent(
		new MessageEvent( 'message', {
			data: { type: 'bsb:steerBehavior', key },
			origin,
		} )
	);
};

const makeHelm = (
	behaviors: Behavior[],
	overrides: Partial< {
		onPageDone: () => void;
		onBehaviorRun: ( key: string, durationMs?: number ) => void;
		onBehaviorEnd: ( key: string ) => void;
		onPageAffordances: ( affordances: typeof openAffordances ) => void;
	} > = {}
) => {
	const motor = new FakeMotor();
	const clock = new FakeClock();
	const onPageDone = overrides.onPageDone ?? vi.fn();
	const onBehaviorRun = overrides.onBehaviorRun ?? vi.fn();
	const onBehaviorEnd = overrides.onBehaviorEnd ?? vi.fn();
	const onPageAffordances = overrides.onPageAffordances ?? vi.fn();

	const helm = new SterileHelm( {
		behaviors,
		motor,
		clock,
		rng: () => 0.5,
		traits: [ 0, 0, 0, 0, 0 ],
		senseAffordances: () => openAffordances,
		speed: 1,
		onPageDone,
		onBehaviorRun,
		onBehaviorEnd,
		onPageAffordances,
	} );

	return {
		helm,
		motor,
		onPageDone,
		onBehaviorRun,
		onBehaviorEnd,
		onPageAffordances,
	};
};

describe( 'SterileHelm', () => {
	it( 'posts the sensed page affordances exactly once, at start()', () => {
		const { helm, onPageAffordances } = makeHelm( [ new ScrollBurst() ] );

		helm.start();

		expect( onPageAffordances ).toHaveBeenCalledTimes( 1 );
		expect( onPageAffordances ).toHaveBeenCalledWith( openAffordances );

		helm.start(); // idempotent
		expect( onPageAffordances ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'runs the steered behavior with real announce wiring, and posts behaviorEnd once run() resolves', async () => {
		const behavior = new ControllableBehavior();
		const { helm, motor, onBehaviorRun, onBehaviorEnd } = makeHelm( [
			behavior,
		] );
		helm.start();

		steer( 'controllable' );

		expect( onBehaviorRun ).toHaveBeenCalledWith( 'controllable', 4200 );
		expect( onBehaviorEnd ).not.toHaveBeenCalled();

		behavior.resolve();
		await vi.waitFor( () =>
			expect( onBehaviorEnd ).toHaveBeenCalledWith( 'controllable' )
		);
		expect( motor.commands ).toHaveLength( 0 ); // ControllableBehavior never touches the motor.
	} );

	it( 'runs a mechanical (non-announcing) behavior over the same motor', async () => {
		const { helm, motor, onBehaviorEnd } = makeHelm( [
			new ScrollBurst(),
		] );
		helm.start();

		steer( SCROLL_BURST_KEY );

		await vi.waitFor( () =>
			expect( onBehaviorEnd ).toHaveBeenCalledWith( SCROLL_BURST_KEY )
		);
		expect( motor.commands.some( ( c ) => c.kind === 'scrollBy' ) ).toBe(
			true
		);
	} );

	it( 'ignores a steer while a behavior is already running (strictly sequential)', async () => {
		const behavior = new ControllableBehavior();
		const scrollBurst = new ScrollBurst();
		const { helm, motor, onBehaviorEnd } = makeHelm( [
			behavior,
			scrollBurst,
		] );
		helm.start();

		steer( 'controllable' );
		steer( SCROLL_BURST_KEY ); // ignored: controllable is still mid-run

		expect( motor.commands ).toHaveLength( 0 );

		behavior.resolve();
		await vi.waitFor( () =>
			expect( onBehaviorEnd ).toHaveBeenCalledWith( 'controllable' )
		);

		// Now idle again: a fresh steer is accepted.
		steer( SCROLL_BURST_KEY );
		await vi.waitFor( () =>
			expect( onBehaviorEnd ).toHaveBeenCalledWith( SCROLL_BURST_KEY )
		);
	} );

	it( 'a steered moveOn announces MOVE_ON_DISPLAY_MS, posts behaviorEnd, then fires onPageDone immediately, without running motor.', async () => {
		const { helm, motor, onBehaviorRun, onBehaviorEnd, onPageDone } =
			makeHelm( [ new MoveOn() ] );
		helm.start();

		steer( MOVE_ON_KEY );

		expect( onBehaviorRun ).toHaveBeenCalledWith(
			MOVE_ON_KEY,
			MOVE_ON_DISPLAY_MS
		);
		expect( onBehaviorEnd ).toHaveBeenCalledWith( MOVE_ON_KEY );
		expect( onPageDone ).toHaveBeenCalledTimes( 1 );
		expect( motor.commands ).toHaveLength( 0 );
	} );

	it( 'a steered moveOn is also blocked by the sequential guard while another behavior is running', async () => {
		const behavior = new ControllableBehavior();
		const { helm, onPageDone, onBehaviorEnd } = makeHelm( [
			behavior,
			new MoveOn(),
		] );
		helm.start();

		steer( 'controllable' );
		steer( MOVE_ON_KEY ); // ignored: controllable is still mid-run

		expect( onPageDone ).not.toHaveBeenCalled();

		behavior.resolve();
		await vi.waitFor( () =>
			expect( onBehaviorEnd ).toHaveBeenCalledWith( 'controllable' )
		);
		// The ignored moveOn steer never fired onPageDone, even after the guard cleared.
		expect( onPageDone ).not.toHaveBeenCalled();
	} );

	it( 'ignores a steer from a foreign origin', () => {
		const { helm, motor } = makeHelm( [ new ScrollBurst() ] );
		helm.start();

		steer( SCROLL_BURST_KEY, 'https://evil.test' );

		expect( motor.commands ).toHaveLength( 0 );
	} );

	it( 'ignores a steer naming an unknown behavior key', () => {
		const { helm, motor } = makeHelm( [ new ScrollBurst() ] );
		helm.start();

		steer( 'notARealBehavior' );

		expect( motor.commands ).toHaveLength( 0 );
	} );

	it( 'ignores a malformed message (wrong type, missing key)', () => {
		const { helm, motor } = makeHelm( [ new ScrollBurst() ] );
		helm.start();

		window.dispatchEvent(
			new MessageEvent( 'message', {
				data: { type: 'not-a-steer' },
				origin: ORIGIN,
			} )
		);
		window.dispatchEvent(
			new MessageEvent( 'message', {
				data: { type: 'bsb:steerBehavior' },
				origin: ORIGIN,
			} )
		);

		expect( motor.commands ).toHaveLength( 0 );
	} );

	it( 'stop() detaches the listener so a later steer is ignored', () => {
		const { helm, motor } = makeHelm( [ new ScrollBurst() ] );
		helm.start();
		helm.stop();

		steer( SCROLL_BURST_KEY );

		expect( motor.commands ).toHaveLength( 0 );
	} );
} );
