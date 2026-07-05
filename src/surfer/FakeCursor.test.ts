import { describe, it, expect, beforeEach } from 'vitest';
import { FakeCursor, SURFING_CLASS, framesForDistance } from './FakeCursor';

/** A fake frame source that resolves instantly and counts how often it's called. */
const countingFrames = (): {
	next: () => Promise< void >;
	count: () => number;
} => {
	let calls = 0;
	return {
		next: () => {
			calls++;
			return Promise.resolve();
		},
		count: () => calls,
	};
};

/**
 * A seeded rng stub cycling through fixed values, for deterministic curves.
 * @param values
 */
const cycleRng = ( values: number[] ): ( () => number ) => {
	let i = 0;
	return () => values[ i++ % values.length ];
};

beforeEach( () => {
	document.body.innerHTML = '';
	document.documentElement.classList.remove( SURFING_CLASS );
} );

describe( 'FakeCursor construction', () => {
	it( 'injects a cursor element into the document', () => {
		new FakeCursor( document, { x: 0, y: 0 }, () => Promise.resolve() );

		expect( document.querySelector( '.bsb-surf-cursor' ) ).not.toBeNull();
	} );

	it( 'flags the document root as engine-driven', () => {
		expect(
			document.documentElement.classList.contains( SURFING_CLASS )
		).toBe( false );

		new FakeCursor( document, { x: 0, y: 0 }, () => Promise.resolve() );

		expect(
			document.documentElement.classList.contains( SURFING_CLASS )
		).toBe( true );
	} );

	it( 'paints the starting position immediately', () => {
		new FakeCursor( document, { x: 12, y: 34 }, () => Promise.resolve() );

		const el = document.querySelector< HTMLElement >( '.bsb-surf-cursor' );
		expect( el?.style.transform ).toBe( 'translate(12px, 34px)' );
	} );
} );

describe( 'FakeCursor.moveTo', () => {
	it( 'updates position, the painted transform, and dispatches a mousemove', () => {
		const cursor = new FakeCursor( document, { x: 0, y: 0 }, () =>
			Promise.resolve()
		);
		let received: MouseEvent | null = null;
		document.addEventListener( 'mousemove', ( e ) => {
			received = e as MouseEvent;
		} );

		cursor.moveTo( { x: 50, y: 60 } );

		expect( cursor.position ).toEqual( { x: 50, y: 60 } );
		const el = document.querySelector< HTMLElement >( '.bsb-surf-cursor' );
		expect( el?.style.transform ).toBe( 'translate(50px, 60px)' );
		expect( received ).not.toBeNull();
		expect( ( received as unknown as MouseEvent ).clientX ).toBe( 50 );
		expect( ( received as unknown as MouseEvent ).clientY ).toBe( 60 );
	} );
} );

describe( 'framesForDistance', () => {
	it( 'grows with distance', () => {
		expect( framesForDistance( 1000 ) ).toBeGreaterThan(
			framesForDistance( 100 )
		);
	} );

	it( 'clamps short distances to a minimum frame count', () => {
		expect( framesForDistance( 1 ) ).toBeGreaterThanOrEqual( 8 );
	} );

	it( 'clamps long distances to a maximum frame count', () => {
		expect( framesForDistance( 100000 ) ).toBeLessThanOrEqual( 60 );
	} );
} );

describe( 'FakeCursor.travelTo', () => {
	it( 'ends exactly on the target after settling', async () => {
		const frames = countingFrames();
		const cursor = new FakeCursor( document, { x: 0, y: 0 }, frames.next );

		// Distance ~223px clears the overshoot threshold.
		await cursor.travelTo( { x: 100, y: 200 }, cycleRng( [ 0.5 ] ), 10 );

		expect( cursor.position ).toEqual( { x: 100, y: 200 } );
	} );

	it( 'consumes one frame per travel step plus one for the settle on a long move', async () => {
		const frames = countingFrames();
		const cursor = new FakeCursor( document, { x: 0, y: 0 }, frames.next );

		// Distance 250px is past the overshoot threshold.
		await cursor.travelTo( { x: 250, y: 0 }, cycleRng( [ 0.5 ] ), 10 );

		expect( frames.count() ).toBe( 11 ); // 10 travel steps + 1 settle step
	} );

	it( 'consumes only the travel steps, with no settle, on a short move', async () => {
		const frames = countingFrames();
		const cursor = new FakeCursor( document, { x: 0, y: 0 }, frames.next );

		// Distance 50px stays under the overshoot threshold.
		await cursor.travelTo( { x: 50, y: 0 }, cycleRng( [ 0.5 ] ), 10 );

		expect( frames.count() ).toBe( 10 );
		expect( cursor.position ).toEqual( { x: 50, y: 0 } );
	} );

	it( 'never runs fewer than one travel step', async () => {
		const frames = countingFrames();
		const cursor = new FakeCursor( document, { x: 0, y: 0 }, frames.next );

		await cursor.travelTo( { x: 10, y: 10 }, cycleRng( [ 0.5 ] ), 0 );

		expect( frames.count() ).toBe( 1 ); // 1 travel step, short move, no settle
		expect( cursor.position ).toEqual( { x: 10, y: 10 } );
	} );

	it( 'derives its frame count from travel distance when no override is given', async () => {
		const nearFrames = countingFrames();
		const nearCursor = new FakeCursor(
			document,
			{ x: 0, y: 0 },
			nearFrames.next
		);
		await nearCursor.travelTo( { x: 50, y: 0 }, cycleRng( [ 0.5 ] ) );

		const farFrames = countingFrames();
		const farCursor = new FakeCursor(
			document,
			{ x: 0, y: 0 },
			farFrames.next
		);
		await farCursor.travelTo( { x: 150, y: 0 }, cycleRng( [ 0.5 ] ) );

		expect( farFrames.count() ).toBeGreaterThan( nearFrames.count() );
	} );

	it( 'bends off the straight line partway through, given curve-jitter randomness', async () => {
		const frames = countingFrames();
		const cursor = new FakeCursor( document, { x: 0, y: 0 }, frames.next );
		const positions: { x: number; y: number }[] = [];
		document.addEventListener( 'mousemove', ( e ) => {
			const event = e as MouseEvent;
			positions.push( { x: event.clientX, y: event.clientY } );
		} );

		// A large rng draw pushes the control point far off the straight line.
		await cursor.travelTo( { x: 100, y: 0 }, cycleRng( [ 1 ] ), 4 );

		const midpoint = positions[ 1 ];
		expect( midpoint.y ).not.toBe( 0 );
	} );

	it( 'eases in and out rather than advancing at constant speed', async () => {
		const frames = countingFrames();
		const cursor = new FakeCursor( document, { x: 0, y: 0 }, frames.next );
		const positions: { x: number; y: number }[] = [];
		document.addEventListener( 'mousemove', ( e ) => {
			const event = e as MouseEvent;
			positions.push( { x: event.clientX, y: event.clientY } );
		} );

		// rng() = 0.5 zeroes the control-point bend, so the path is a
		// straight line and only the eased progress shapes the spacing.
		await cursor.travelTo( { x: 100, y: 0 }, cycleRng( [ 0.5 ] ), 10 );

		const deltas: number[] = [];
		for ( let i = 1; i < positions.length; i++ ) {
			deltas.push( positions[ i ].x - positions[ i - 1 ].x );
		}
		const first = deltas[ 0 ];
		const middle = deltas[ Math.floor( deltas.length / 2 ) ];
		const last = deltas[ deltas.length - 1 ];

		expect( first ).toBeLessThan( middle );
		expect( last ).toBeLessThan( middle );
	} );
} );
