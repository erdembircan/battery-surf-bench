import { describe, it, expect, beforeEach } from 'vitest';
import {
	FakeCursor,
	SURFING_CLASS,
	framesForDistance,
	type Point,
} from '@/surfer/FakeCursor';

/**
 * A frame source that resolves instantly after invoking `onFrame` first, so a
 * test can sample DOM state mid-flight — the same pattern `Motor.test.ts`
 * uses for its own recording frame sources.
 * @param onFrame
 */
const sampledFrames = ( onFrame: () => void ): ( () => Promise< void > ) => {
	return () => {
		onFrame();
		return Promise.resolve();
	};
};

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

		// Distance ~70px stays under the overshoot threshold; y=50 keeps the
		// target clear of the viewport-edge clamp margin.
		await cursor.travelTo( { x: 50, y: 50 }, cycleRng( [ 0.5 ] ), 10 );

		expect( frames.count() ).toBe( 10 );
		expect( cursor.position ).toEqual( { x: 50, y: 50 } );
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

describe( 'FakeCursor viewport clamping', () => {
	it( 'clamps an out-of-bounds moveTo point inside the viewport', () => {
		Object.defineProperty( window, 'innerWidth', {
			value: 500,
			configurable: true,
		} );
		Object.defineProperty( window, 'innerHeight', {
			value: 400,
			configurable: true,
		} );
		const cursor = new FakeCursor( document, { x: 0, y: 0 }, () =>
			Promise.resolve()
		);

		cursor.moveTo( { x: -100, y: 9000 } );

		expect( cursor.position.x ).toBeGreaterThanOrEqual( 0 );
		expect( cursor.position.x ).toBeLessThanOrEqual( 500 );
		expect( cursor.position.y ).toBeGreaterThanOrEqual( 0 );
		expect( cursor.position.y ).toBeLessThanOrEqual( 400 );
	} );

	it( 'keeps a travelTo curve that would bow past an edge inside the viewport', async () => {
		Object.defineProperty( window, 'innerWidth', {
			value: 1000,
			configurable: true,
		} );
		Object.defineProperty( window, 'innerHeight', {
			value: 800,
			configurable: true,
		} );
		const frames = countingFrames();
		// Both endpoints sit near the left edge; a vertical leg bends the
		// bezier control point horizontally, off-screen, at a max rng draw.
		const cursor = new FakeCursor(
			document,
			{ x: 10, y: 10 },
			frames.next
		);
		const positions: Point[] = [];
		document.addEventListener( 'mousemove', ( e ) => {
			const event = e as MouseEvent;
			positions.push( { x: event.clientX, y: event.clientY } );
		} );

		await cursor.travelTo( { x: 10, y: 100 }, cycleRng( [ 1 ] ), 10 );

		expect( positions.length ).toBeGreaterThan( 0 );
		for ( const position of positions ) {
			expect( position.x ).toBeGreaterThanOrEqual( 0 );
			expect( position.x ).toBeLessThanOrEqual( 1000 );
			expect( position.y ).toBeGreaterThanOrEqual( 0 );
			expect( position.y ).toBeLessThanOrEqual( 800 );
		}
	} );
} );

describe( 'FakeCursor.mode / setMode', () => {
	it( 'starts in arrow mode', () => {
		const cursor = new FakeCursor( document, { x: 0, y: 0 }, () =>
			Promise.resolve()
		);

		expect( cursor.mode ).toBe( 'arrow' );
	} );

	it( "setMode('caret') adds the caret class and reports the mode", () => {
		const cursor = new FakeCursor( document, { x: 0, y: 0 }, () =>
			Promise.resolve()
		);

		cursor.setMode( 'caret' );

		const el = document.querySelector< HTMLElement >( '.bsb-surf-cursor' );
		expect( el?.classList.contains( 'bsb-surf-cursor--caret' ) ).toBe(
			true
		);
		expect( cursor.mode ).toBe( 'caret' );
	} );

	it( "setMode('arrow') removes any modifier class", () => {
		const cursor = new FakeCursor( document, { x: 0, y: 0 }, () =>
			Promise.resolve()
		);
		const el = document.querySelector< HTMLElement >( '.bsb-surf-cursor' );

		cursor.setMode( 'caret' );
		cursor.setMode( 'arrow' );

		expect( el?.classList.contains( 'bsb-surf-cursor--caret' ) ).toBe(
			false
		);
		expect( el?.classList.contains( 'bsb-surf-cursor--hand' ) ).toBe(
			false
		);
		expect( cursor.mode ).toBe( 'arrow' );
	} );

	it( 'switching from caret to hand never leaves both classes on', () => {
		const cursor = new FakeCursor( document, { x: 0, y: 0 }, () =>
			Promise.resolve()
		);
		const el = document.querySelector< HTMLElement >( '.bsb-surf-cursor' );

		cursor.setMode( 'caret' );
		cursor.setMode( 'hand' );

		expect( el?.classList.contains( 'bsb-surf-cursor--caret' ) ).toBe(
			false
		);
		expect( el?.classList.contains( 'bsb-surf-cursor--hand' ) ).toBe(
			true
		);
		expect( cursor.mode ).toBe( 'hand' );
	} );
} );

describe( 'FakeCursor.click', () => {
	it( 'carries the pressing class and a single ripple while pending, and clears both once resolved', async () => {
		const samples: {
			pressing: boolean;
			ripples: number;
		}[] = [];
		const cursor = new FakeCursor(
			document,
			{ x: 0, y: 0 },
			sampledFrames( () => {
				const el = document.querySelector( '.bsb-surf-cursor' );
				samples.push( {
					pressing:
						el?.classList.contains( 'bsb-surf-cursor--pressing' ) ??
						false,
					ripples: document.querySelectorAll(
						'.bsb-surf-click-ripple'
					).length,
				} );
			} )
		);

		await cursor.click();

		expect( samples.length ).toBeGreaterThan( 0 );
		for ( const sample of samples ) {
			expect( sample.pressing ).toBe( true );
			expect( sample.ripples ).toBe( 1 );
		}

		const el = document.querySelector< HTMLElement >( '.bsb-surf-cursor' );
		expect( el?.classList.contains( 'bsb-surf-cursor--pressing' ) ).toBe(
			false
		);
		expect(
			document.querySelectorAll( '.bsb-surf-click-ripple' )
		).toHaveLength( 0 );
	} );

	it( "positions the ripple at the cursor's current point", async () => {
		let ripple: HTMLElement | null = null;
		const sampling = sampledFrames( () => {
			if ( null === ripple ) {
				ripple = document.querySelector< HTMLElement >(
					'.bsb-surf-click-ripple'
				);
			}
		} );
		const cursor = new FakeCursor( document, { x: 42, y: 77 }, sampling );

		await cursor.click();

		expect( ripple ).not.toBeNull();
		expect( ( ripple as HTMLElement | null )?.style.left ).toBe( '42px' );
		expect( ( ripple as HTMLElement | null )?.style.top ).toBe( '77px' );
	} );
} );
