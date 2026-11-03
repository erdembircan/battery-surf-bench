import { describe, it, expect, beforeEach } from 'vitest';
import {
	FakeCursor,
	SURFING_CLASS,
	travelMsForDistance,
	type Point,
} from '@/surfer/FakeCursor';
import { FramePacer } from '@/surfer/FramePacer';
import { steppedFrames } from '@/surfer/TestFixtures';

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
		new FakeCursor(
			document,
			{ x: 0, y: 0 },
			new FramePacer( steppedFrames() )
		);

		expect( document.querySelector( '.bsb-surf-cursor' ) ).not.toBeNull();
	} );

	it( 'flags the document root as engine-driven', () => {
		expect(
			document.documentElement.classList.contains( SURFING_CLASS )
		).toBe( false );

		new FakeCursor(
			document,
			{ x: 0, y: 0 },
			new FramePacer( steppedFrames() )
		);

		expect(
			document.documentElement.classList.contains( SURFING_CLASS )
		).toBe( true );
	} );

	it( 'paints the starting position immediately', () => {
		new FakeCursor(
			document,
			{ x: 12, y: 34 },
			new FramePacer( steppedFrames() )
		);

		const el = document.querySelector< HTMLElement >( '.bsb-surf-cursor' );
		expect( el?.style.transform ).toBe( 'translate(12px, 34px)' );
	} );
} );

describe( 'FakeCursor.moveTo', () => {
	it( 'updates position, the painted transform, and dispatches a mousemove', () => {
		const cursor = new FakeCursor(
			document,
			{ x: 0, y: 0 },
			new FramePacer( steppedFrames() )
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

describe( 'travelMsForDistance', () => {
	it( 'grows with distance', () => {
		expect( travelMsForDistance( 1000 ) ).toBeGreaterThan(
			travelMsForDistance( 100 )
		);
	} );

	it( 'clamps short distances to a minimum duration', () => {
		expect( travelMsForDistance( 1 ) ).toBe( travelMsForDistance( 10 ) );
		expect( travelMsForDistance( 1 ) ).toBeGreaterThan( 0 );
	} );

	it( 'clamps long distances to a maximum duration', () => {
		expect( travelMsForDistance( 100000 ) ).toBe(
			travelMsForDistance( 1000000 )
		);
	} );
} );

describe( 'FakeCursor.travelTo', () => {
	it( 'ends exactly on the target after settling', async () => {
		const pacer = new FramePacer( steppedFrames() );
		const cursor = new FakeCursor( document, { x: 0, y: 0 }, pacer );

		// Distance ~223px clears the overshoot threshold.
		await cursor.travelTo( { x: 100, y: 200 }, cycleRng( [ 0.5 ] ), 160 );

		expect( cursor.position ).toEqual( { x: 100, y: 200 } );
	} );

	it( 'takes its travel time plus a brief settle on a long move', async () => {
		const pacer = new FramePacer( steppedFrames() );
		const cursor = new FakeCursor( document, { x: 0, y: 0 }, pacer );

		// Distance 250px is past the overshoot threshold.
		await cursor.travelTo( { x: 250, y: 0 }, cycleRng( [ 0.5 ] ), 160 );

		expect( pacer.elapsed ).toBeGreaterThan( 160 );
		expect( pacer.elapsed ).toBeLessThanOrEqual( 160 + 32 );
	} );

	it( 'takes exactly its travel time, with no settle, on a short move', async () => {
		const pacer = new FramePacer( steppedFrames() );
		const cursor = new FakeCursor( document, { x: 0, y: 0 }, pacer );

		// Distance ~70px stays under the overshoot threshold; y=50 keeps the
		// target clear of the viewport-edge clamp margin.
		await cursor.travelTo( { x: 50, y: 50 }, cycleRng( [ 0.5 ] ), 160 );

		expect( pacer.elapsed ).toBe( 160 );
		expect( cursor.position ).toEqual( { x: 50, y: 50 } );
	} );

	it( 'still lands on the target when given no time', async () => {
		let frames = 0;
		const pacer = new FramePacer(
			steppedFrames( 16, () => {
				frames++;
			} )
		);
		const cursor = new FakeCursor( document, { x: 0, y: 0 }, pacer );

		await cursor.travelTo( { x: 10, y: 10 }, cycleRng( [ 0.5 ] ), 0 );

		expect( frames ).toBeGreaterThanOrEqual( 1 );
		expect( cursor.position ).toEqual( { x: 10, y: 10 } );
	} );

	it( 'derives its duration from travel distance when no override is given', async () => {
		const nearPacer = new FramePacer( steppedFrames() );
		const nearCursor = new FakeCursor(
			document,
			{ x: 0, y: 0 },
			nearPacer
		);
		await nearCursor.travelTo( { x: 50, y: 0 }, cycleRng( [ 0.5 ] ) );

		const farPacer = new FramePacer( steppedFrames() );
		const farCursor = new FakeCursor( document, { x: 0, y: 0 }, farPacer );
		await farCursor.travelTo( { x: 150, y: 0 }, cycleRng( [ 0.5 ] ) );

		expect( farPacer.elapsed ).toBeGreaterThan( nearPacer.elapsed );
	} );

	it( 'travels for the same time at 60 Hz and 120 Hz', async () => {
		const elapsedAt = async ( frameMs: number ): Promise< number > => {
			const pacer = new FramePacer( steppedFrames( frameMs ) );
			const cursor = new FakeCursor( document, { x: 0, y: 0 }, pacer );
			await cursor.travelTo( { x: 50, y: 50 }, cycleRng( [ 0.5 ] ), 300 );

			return pacer.elapsed;
		};

		const sixty = await elapsedAt( 16 );
		const oneTwenty = await elapsedAt( 8 );

		expect( Math.abs( sixty - oneTwenty ) ).toBeLessThan( 16 );
	} );

	it( 'bends off the straight line partway through, given curve-jitter randomness', async () => {
		const cursor = new FakeCursor(
			document,
			{ x: 0, y: 0 },
			new FramePacer( steppedFrames() )
		);
		const positions: { x: number; y: number }[] = [];
		document.addEventListener( 'mousemove', ( e ) => {
			const event = e as MouseEvent;
			positions.push( { x: event.clientX, y: event.clientY } );
		} );

		// A large rng draw pushes the control point far off the straight line.
		await cursor.travelTo( { x: 100, y: 0 }, cycleRng( [ 1 ] ), 64 );

		const midpoint = positions[ 1 ];
		expect( midpoint.y ).not.toBe( 0 );
	} );

	it( 'eases in and out rather than advancing at constant speed', async () => {
		const cursor = new FakeCursor(
			document,
			{ x: 0, y: 0 },
			new FramePacer( steppedFrames() )
		);
		const positions: { x: number; y: number }[] = [];
		document.addEventListener( 'mousemove', ( e ) => {
			const event = e as MouseEvent;
			positions.push( { x: event.clientX, y: event.clientY } );
		} );

		// rng() = 0.5 zeroes the control-point bend, so the path is a
		// straight line and only the eased progress shapes the spacing.
		await cursor.travelTo( { x: 100, y: 0 }, cycleRng( [ 0.5 ] ), 160 );

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
		const cursor = new FakeCursor(
			document,
			{ x: 0, y: 0 },
			new FramePacer( steppedFrames() )
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
		// Both endpoints sit near the left edge; a vertical leg bends the
		// bezier control point horizontally, off-screen, at a max rng draw.
		const cursor = new FakeCursor(
			document,
			{ x: 10, y: 10 },
			new FramePacer( steppedFrames() )
		);
		const positions: Point[] = [];
		document.addEventListener( 'mousemove', ( e ) => {
			const event = e as MouseEvent;
			positions.push( { x: event.clientX, y: event.clientY } );
		} );

		await cursor.travelTo( { x: 10, y: 100 }, cycleRng( [ 1 ] ), 160 );

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
		const cursor = new FakeCursor(
			document,
			{ x: 0, y: 0 },
			new FramePacer( steppedFrames() )
		);

		expect( cursor.mode ).toBe( 'arrow' );
	} );

	it( "setMode('caret') adds the caret class and reports the mode", () => {
		const cursor = new FakeCursor(
			document,
			{ x: 0, y: 0 },
			new FramePacer( steppedFrames() )
		);

		cursor.setMode( 'caret' );

		const el = document.querySelector< HTMLElement >( '.bsb-surf-cursor' );
		expect( el?.classList.contains( 'bsb-surf-cursor--caret' ) ).toBe(
			true
		);
		expect( cursor.mode ).toBe( 'caret' );
	} );

	it( "setMode('arrow') removes any modifier class", () => {
		const cursor = new FakeCursor(
			document,
			{ x: 0, y: 0 },
			new FramePacer( steppedFrames() )
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
		const cursor = new FakeCursor(
			document,
			{ x: 0, y: 0 },
			new FramePacer( steppedFrames() )
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
			new FramePacer(
				steppedFrames( 16, () => {
					const el = document.querySelector( '.bsb-surf-cursor' );
					samples.push( {
						pressing:
							el?.classList.contains(
								'bsb-surf-cursor--pressing'
							) ?? false,
						ripples: document.querySelectorAll(
							'.bsb-surf-click-ripple'
						).length,
					} );
				} )
			)
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
		const sampling = steppedFrames( 16, () => {
			if ( null === ripple ) {
				ripple = document.querySelector< HTMLElement >(
					'.bsb-surf-click-ripple'
				);
			}
		} );
		const cursor = new FakeCursor(
			document,
			{ x: 42, y: 77 },
			new FramePacer( sampling )
		);

		await cursor.click();

		expect( ripple ).not.toBeNull();
		expect( ( ripple as HTMLElement | null )?.style.left ).toBe( '42px' );
		expect( ( ripple as HTMLElement | null )?.style.top ).toBe( '77px' );
	} );

	it( 'holds a click for the same time at 60 Hz and 120 Hz', async () => {
		const elapsedAt = async ( frameMs: number ): Promise< number > => {
			const pacer = new FramePacer( steppedFrames( frameMs ) );
			const cursor = new FakeCursor( document, { x: 0, y: 0 }, pacer );
			await cursor.click();

			return pacer.elapsed;
		};

		const sixty = await elapsedAt( 16 );
		const oneTwenty = await elapsedAt( 8 );

		expect( sixty ).toBeGreaterThan( 0 );
		expect( oneTwenty ).toBeGreaterThan( 0 );
		expect( Math.abs( sixty - oneTwenty ) ).toBeLessThan( 16 );
	} );
} );
