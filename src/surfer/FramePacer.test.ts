import { describe, it, expect } from 'vitest';
import { FramePacer, type FrameSource } from '@/surfer/FramePacer';
import { steppedFrames } from '@/surfer/TestFixtures';

/**
 * A frame source that resolves with the given timestamps in order, counting
 * how many frames were requested.
 * @param timestamps
 */
const scriptedFrames = (
	timestamps: number[]
): { next: FrameSource; count: () => number } => {
	let calls = 0;

	return {
		next: () => Promise.resolve( timestamps[ calls++ ] ),
		count: () => calls,
	};
};

describe( 'FramePacer', () => {
	it( "starts each timeline with a zero-delta frame, then advances by each frame's own length", async () => {
		const frames = scriptedFrames( [ 1000, 1016, 1025, 1050 ] );
		const pacer = new FramePacer( frames.next );

		await pacer.hold( 30 );

		expect( frames.count() ).toBe( 4 );
		expect( pacer.elapsed ).toBe( 50 );
	} );

	it( 'ends an animation at exactly 1, never moving backwards', async () => {
		const pacer = new FramePacer( steppedFrames() );
		const progresses: number[] = [];

		await pacer.animate( 400, ( progress ) => progresses.push( progress ) );

		expect( progresses.at( -1 ) ).toBe( 1 );
		for ( let i = 1; i < progresses.length; i++ ) {
			expect( progresses[ i ] ).toBeGreaterThanOrEqual(
				progresses[ i - 1 ]
			);
		}
		for ( const progress of progresses.slice( 0, -1 ) ) {
			expect( progress ).toBeLessThan( 1 );
		}
	} );

	it( "lasts an animation's duration at 60 Hz and at 120 Hz alike", async () => {
		for ( const frameMs of [ 16, 8 ] ) {
			const pacer = new FramePacer( steppedFrames( frameMs ) );

			await pacer.animate( 400, () => {} );

			expect( pacer.elapsed ).toBeGreaterThanOrEqual( 400 );
			expect( pacer.elapsed ).toBeLessThan( 400 + frameMs );
		}
	} );

	it( 'runs one frame and lands on 1 for a zero or negative duration', async () => {
		for ( const duration of [ 0, -5 ] ) {
			const pacer = new FramePacer( steppedFrames() );
			const progresses: number[] = [];

			await pacer.animate( duration, ( progress ) =>
				progresses.push( progress )
			);

			expect( progresses ).toEqual( [ 1 ] );
		}
	} );

	it( 'holds for its duration, and not at all for zero or less', async () => {
		const pacer = new FramePacer( steppedFrames() );

		await pacer.hold( 100 );

		expect( pacer.elapsed ).toBeGreaterThanOrEqual( 100 );
		expect( pacer.elapsed ).toBeLessThan( 116 );

		for ( const ms of [ 0, -1 ] ) {
			const frames = scriptedFrames( [ 0, 16 ] );
			const idle = new FramePacer( frames.next );

			await idle.hold( ms );

			expect( frames.count() ).toBe( 0 );
		}
	} );

	it( 'never counts the time between two timelines', async () => {
		const frames = scriptedFrames( [ 0, 16, 32, 5000, 5016 ] );
		const pacer = new FramePacer( frames.next );

		await pacer.hold( 32 );
		pacer.restart();
		await pacer.hold( 16 );

		expect( pacer.elapsed ).toBe( 16 );
	} );

	it( 'accumulates one timeline across animations and holds', async () => {
		const pacer = new FramePacer( steppedFrames() );

		await pacer.animate( 100, () => {} );
		await pacer.hold( 50 );

		expect( pacer.elapsed ).toBeGreaterThanOrEqual( 150 );
		expect( pacer.elapsed ).toBeLessThan( 150 + 32 );
	} );
} );
