import { describe, it, expect, beforeEach } from 'vitest';
import { FakeCursor, SURFING_CLASS } from './FakeCursor';

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

describe( 'FakeCursor.travelTo', () => {
	it( 'ends exactly on the target after settling', async () => {
		const frames = countingFrames();
		const cursor = new FakeCursor( document, { x: 0, y: 0 }, frames.next );

		await cursor.travelTo( { x: 100, y: 200 }, 10, cycleRng( [ 0.5 ] ) );

		expect( cursor.position ).toEqual( { x: 100, y: 200 } );
	} );

	it( 'consumes one frame per travel step plus one for the settle', async () => {
		const frames = countingFrames();
		const cursor = new FakeCursor( document, { x: 0, y: 0 }, frames.next );

		await cursor.travelTo( { x: 100, y: 0 }, 10, cycleRng( [ 0.5 ] ) );

		expect( frames.count() ).toBe( 11 ); // 10 travel steps + 1 settle step
	} );

	it( 'never runs fewer than one travel step', async () => {
		const frames = countingFrames();
		const cursor = new FakeCursor( document, { x: 0, y: 0 }, frames.next );

		await cursor.travelTo( { x: 10, y: 10 }, 0, cycleRng( [ 0.5 ] ) );

		expect( frames.count() ).toBe( 2 ); // 1 travel step + 1 settle step
		expect( cursor.position ).toEqual( { x: 10, y: 10 } );
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
		await cursor.travelTo( { x: 100, y: 0 }, 4, cycleRng( [ 1 ] ) );

		const midpoint = positions[ 1 ];
		expect( midpoint.y ).not.toBe( 0 );
	} );
} );
