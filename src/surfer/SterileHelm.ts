/**
 * The sterile engine: no auction, no tick loop, no boredom or appetite — each
 * of the surfer's behaviors is instead fired on demand, by a `bsb:steerBehavior`
 * command from the cockpit's dev-tools panel, and run exactly once over the
 * same motor and context-sensing path `SurfLoop`'s own tick loop uses. Boots
 * in place of `SurfLoop` when `EngineBoot` (`./index`) finds `bsbSterile=1` on
 * the page URL.
 *
 * Strictly sequential, mirroring the tick loop: a steer arriving while a
 * behavior is already running is ignored outright rather than queued. A
 * steered `moveOn` mirrors the loop's own natural end exactly — it announces
 * the fixed `MOVE_ON_DISPLAY_MS` display duration (never runs an actual
 * behavior — `MoveOn.run()` is a no-op), posts `bsb:behaviorEnd`, then fires
 * `onPageDone` immediately, the same order the loop follows when `MoveOn`
 * wins an auction tick.
 *
 * Every other steered behavior runs through its own `run()`, with an
 * `announce` callback wired the same way the loop wires it, so a steered
 * behavior barks in the cockpit exactly like a naturally-won one; once
 * `run()` resolves, `bsb:behaviorEnd` is posted for it.
 */

import type { Behavior } from './Behavior';
import type { Motor } from './Motor';
import type { Affordances } from './Affordances';
import { buildBehaviorContext, type PageSenseDeps } from './PageSense';
import { MOVE_ON_KEY, MOVE_ON_DISPLAY_MS } from './Behaviors/MoveOn';

/**
 * The message type a steer command from the cockpit carries. This module's
 * own copy of the literal — the engine bundle and the cockpit module share no
 * imports across the frame boundary, the same convention `./index` already
 * follows for `bsb:behaviorStart`/`bsb:pageDone` (see its own doc comment).
 */
const STEER_BEHAVIOR_TYPE = 'bsb:steerBehavior';

export interface SterileHelmDeps extends PageSenseDeps {
	behaviors: Behavior[];
	motor: Motor;
	/** Fires the same way `SurfLoop`'s own moveOn win does: the page session has ended. */
	onPageDone: () => void;
	/**
	 * Notified with a steered behavior's key and its wall-clock dwell in ms,
	 * exactly like `SurfLoop`'s own `onBehaviorRun` — the cockpit's bark reacts
	 * identically to a steered win as to a naturally-won one. Optional so a
	 * mechanical behavior (which never calls `announce`) simply never notifies.
	 */
	onBehaviorRun?: ( key: string, durationMs?: number ) => void;
	/** Notified once a steered behavior's `run()` resolves (or immediately, for a steered `moveOn`). */
	onBehaviorEnd: ( key: string ) => void;
	/** Notified once, at `start()`, with the freshly-sensed page affordances. */
	onPageAffordances: ( affordances: Affordances ) => void;
}

/** Runs behaviors on demand, one at a time, with no auction and no tick loop. */
export class SterileHelm {
	private readonly deps: SterileHelmDeps;
	private readonly startedAt: number;
	private started = false;
	/** The key of the behavior currently mid-`run()`, or null while idle — the sequential guard. */
	private runningKey: string | null = null;

	constructor( deps: SterileHelmDeps ) {
		this.deps = deps;
		this.startedAt = deps.clock.now();
	}

	/**
	 * Attaches the steer listener and posts the page's affordances once.
	 * Idempotent while already started.
	 */
	start(): void {
		if ( this.started ) {
			return;
		}
		this.started = true;
		window.addEventListener( 'message', this.handleMessage );
		this.deps.onPageAffordances( this.deps.senseAffordances() );
	}

	/** Detaches the steer listener. Idempotent while already stopped. */
	stop(): void {
		if ( ! this.started ) {
			return;
		}
		this.started = false;
		window.removeEventListener( 'message', this.handleMessage );
	}

	/**
	 * Validates and handles an incoming `message` event: same-origin, the
	 * expected message type, and a key naming one of this run's behaviors. A
	 * steer arriving while another behavior is still running is ignored
	 * outright — strictly sequential, mirroring the tick loop.
	 * @param event
	 */
	private readonly handleMessage = ( event: MessageEvent ): void => {
		if ( event.origin !== window.location.origin ) {
			return;
		}

		const data = event.data as { type?: unknown; key?: unknown } | null;

		if (
			data?.type !== STEER_BEHAVIOR_TYPE ||
			typeof data.key !== 'string'
		) {
			return;
		}

		const behavior = this.deps.behaviors.find(
			( b ) => b.key === data.key
		);

		if ( ! behavior || this.runningKey !== null ) {
			return;
		}

		if ( behavior.key === MOVE_ON_KEY ) {
			this.deps.onBehaviorRun?.( MOVE_ON_KEY, MOVE_ON_DISPLAY_MS );
			this.deps.onBehaviorEnd( MOVE_ON_KEY );
			this.deps.onPageDone();
			return;
		}

		this.runningKey = behavior.key;
		const ctx = buildBehaviorContext( this.deps, this.startedAt );

		void behavior
			.run(
				this.deps.motor,
				ctx,
				( durationMs ) =>
					this.deps.onBehaviorRun?.( behavior.key, durationMs )
			)
			.then( () => {
				this.runningKey = null;
				this.deps.onBehaviorEnd( behavior.key );
			} );
	};
}
