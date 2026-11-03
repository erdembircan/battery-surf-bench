/**
 * Paces the surf engine's motion by delta time. Every animation the engine
 * plays rides `requestAnimationFrame` for smoothness, but a frame's length
 * depends on the display — 16.7 ms at 60 Hz, 8.3 ms at 120 Hz — so counting
 * frames would make every motion run at the display's speed instead of its
 * own. The pacer reads each frame's timestamp, measures how long the frame
 * actually took, and advances an animation by exactly that, so a motion
 * lasts its stated duration on any display.
 */

export type FrameSource = () => Promise< number >;

/**
 * Turns a frame source's timestamps into delta time for the animations
 * `DomMotor` and its `FakeCursor` play. One pacer is shared by both, so a
 * choreography's steps — a travel, a sweep, a hold — run on one continuous
 * timeline. There is no clock to read a start time from, so the first frame
 * after a restart only marks where the timeline begins: its delta is zero,
 * and motion starts on the frame after it.
 */
export class FramePacer {
	private readonly nextFrame: FrameSource;
	private last: number | null = null;
	private total = 0;

	/**
	 * @param nextFrame Resolves on each animation frame with its timestamp, in ms.
	 */
	constructor( nextFrame: FrameSource ) {
		this.nextFrame = nextFrame;
	}

	/** Delta time accumulated since the last restart, in ms. */
	get elapsed(): number {
		return this.total;
	}

	/**
	 * Starts a fresh timeline: forgets the last frame seen and zeroes
	 * `elapsed`, so time spent between two choreographies is never counted
	 * as motion.
	 */
	restart(): void {
		this.last = null;
		this.total = 0;
	}

	/**
	 * Plays an animation lasting `durationMs`: on every frame, advances its
	 * progress by that frame's delta time and calls `step` with the progress,
	 * 0 to 1. Always runs at least one frame and always ends with a call at
	 * exactly 1 — at once, when `durationMs` is zero or less.
	 * @param durationMs
	 * @param step
	 */
	async animate(
		durationMs: number,
		step: ( progress: number ) => void
	): Promise< void > {
		let spent = 0;

		do {
			spent += await this.frame();
			step( durationMs > 0 ? Math.min( 1, spent / durationMs ) : 1 );
		} while ( spent < durationMs );
	}

	/**
	 * Lets `ms` of frame time pass without animating anything — a pause,
	 * dwell or hold measured on the same timeline as the motion around it.
	 * Returns at once when `ms` is zero or less.
	 * @param ms
	 */
	async hold( ms: number ): Promise< void > {
		let spent = 0;

		while ( spent < ms ) {
			spent += await this.frame();
		}
	}

	/**
	 * Waits for the next animation frame and returns how long it took — its
	 * timestamp minus the previous frame's, or zero for the first frame after
	 * a restart — adding it to `elapsed`.
	 */
	private async frame(): Promise< number > {
		const timestamp = await this.nextFrame();
		const delta =
			this.last === null ? 0 : Math.max( 0, timestamp - this.last );

		this.last = timestamp;
		this.total += delta;

		return delta;
	}
}
