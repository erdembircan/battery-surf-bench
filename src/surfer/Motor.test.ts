import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomMotor } from './Motor';
import { FakeCursor, SURFING_CLASS, type Point } from './FakeCursor';
import { mulberry32 } from './Rng';

/** An instant frame source, for tests that would otherwise wait on real rAF ticks. */
const instantFrames = (): Promise< void > => Promise.resolve();

beforeEach( () => {
	document.body.innerHTML = '';
	document.documentElement.classList.remove( SURFING_CLASS );
} );

describe( 'DomMotor.playVideo', () => {
	it( 'does nothing when the page has no video', async () => {
		document.body.innerHTML = '';
		await expect(
			new DomMotor( () => 0.5 ).playVideo()
		).resolves.toBeUndefined();
	} );

	it( 'plays the video unmuted when the browser allows it', async () => {
		document.body.innerHTML = '<video></video>';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		const play = vi.fn().mockResolvedValue( undefined );
		video.play = play;

		await new DomMotor( () => 0.5 ).playVideo();

		expect( play ).toHaveBeenCalledTimes( 1 );
		expect( video.muted ).toBe( false );
	} );

	it( 'retries muted when unmuted autoplay is rejected', async () => {
		document.body.innerHTML = '<video></video>';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		const play = vi
			.fn()
			.mockRejectedValueOnce( new Error( 'NotAllowedError' ) )
			.mockResolvedValueOnce( undefined );
		video.play = play;

		await new DomMotor( () => 0.5 ).playVideo();

		expect( play ).toHaveBeenCalledTimes( 2 );
		expect( video.muted ).toBe( true );
	} );

	it( 'never throws even if the muted retry is also rejected', async () => {
		document.body.innerHTML = '<video></video>';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		video.play = vi.fn().mockRejectedValue( new Error( 'still blocked' ) );

		await expect(
			new DomMotor( () => 0.5 ).playVideo()
		).resolves.toBeUndefined();
		expect( video.muted ).toBe( true );
	} );
} );

describe( 'DomMotor.pointerDrift', () => {
	it( 'drives the fake cursor away from its starting position', async () => {
		const motor = new DomMotor( () => 0.9, instantFrames );
		const cursorEl =
			document.querySelector< HTMLElement >( '.bsb-surf-cursor' );
		const before = cursorEl?.style.transform;

		await motor.pointerDrift( 200 );

		expect( cursorEl?.style.transform ).not.toBe( before );
	} );

	it( 'flags the document as engine-driven, hiding the real cursor', async () => {
		const motor = new DomMotor( () => 0.5, instantFrames );
		await motor.pointerDrift( 50 );

		expect(
			document.documentElement.classList.contains( SURFING_CLASS )
		).toBe( true );
	} );

	it( 'wanders in bounded legs from its current position rather than teleporting across the viewport', async () => {
		Object.defineProperty( window, 'innerWidth', {
			value: 1000,
			configurable: true,
		} );
		Object.defineProperty( window, 'innerHeight', {
			value: 800,
			configurable: true,
		} );

		const travelToSpy = vi.spyOn( FakeCursor.prototype, 'travelTo' );
		const motor = new DomMotor( mulberry32( 7 ), instantFrames );
		const start = { x: 500, y: 400 };

		await motor.pointerDrift( 3000 );

		const targets = travelToSpy.mock.calls.map(
			( call ) => call[ 0 ] as Point
		);
		expect( targets.length ).toBeGreaterThan( 0 );

		let from = start;
		for ( const target of targets ) {
			const jump = Math.hypot( target.x - from.x, target.y - from.y );

			// The radius band pointerDrift wanders within, plus float slop.
			expect( jump ).toBeLessThanOrEqual( 280.001 );
			expect( target.x ).toBeGreaterThanOrEqual( 0 );
			expect( target.x ).toBeLessThanOrEqual( 1000 );
			expect( target.y ).toBeGreaterThanOrEqual( 0 );
			expect( target.y ).toBeLessThanOrEqual( 800 );

			from = target;
		}

		travelToSpy.mockRestore();
	} );

	it( 'pauses briefly between wander legs instead of gliding continuously', async () => {
		let ticks = 0;
		const countingFrames = (): Promise< void > => {
			ticks++;
			return Promise.resolve();
		};
		const travelToSpy = vi.spyOn( FakeCursor.prototype, 'travelTo' );
		const motor = new DomMotor( mulberry32( 3 ), countingFrames );
		const start = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

		await motor.pointerDrift( 3000 );

		const calls = travelToSpy.mock.calls;
		expect( calls.length ).toBeGreaterThan( 1 );

		// Every travel leg accounts for its own step count, plus one more
		// tick if it was long enough to overshoot-and-settle. Any tick beyond
		// that sum must be a between-legs pause tick.
		let from = start;
		let travelAndSettleTicks = 0;
		for ( const call of calls ) {
			const target = call[ 0 ] as Point;
			const legFrames = call[ 2 ] as number;
			const distance = Math.hypot( target.x - from.x, target.y - from.y );
			travelAndSettleTicks += legFrames + ( distance > 200 ? 1 : 0 );
			from = target;
		}

		expect( ticks ).toBeGreaterThan( travelAndSettleTicks );

		travelToSpy.mockRestore();
	} );
} );

describe( 'DomMotor.selectSnippet', () => {
	it( 'does nothing when the page has no text long enough to select', async () => {
		document.body.innerHTML = '<p>short</p>';
		await expect(
			new DomMotor( () => 0.1, instantFrames ).selectSnippet()
		).resolves.toBeUndefined();
		expect( getSelection()?.toString() ).toBe( '' );
	} );

	it( 'extends the selection progressively across multiple frames, not all at once', async () => {
		document.body.innerHTML = `<p>${ 'word '.repeat( 20 ) }</p>`;
		const observedLengths: number[] = [];
		const recordingFrames = (): Promise< void > => {
			observedLengths.push( getSelection()?.toString().length ?? 0 );
			return Promise.resolve();
		};

		await new DomMotor( () => 0.1, recordingFrames ).selectSnippet();

		const distinctGrowingLengths = new Set(
			observedLengths.filter( ( length ) => length > 0 )
		);
		expect( distinctGrowingLengths.size ).toBeGreaterThan( 1 );
	} );

	it( 'clears the selection once the hold ends', async () => {
		document.body.innerHTML = `<p>${ 'word '.repeat( 20 ) }</p>`;

		await new DomMotor( () => 0.1, instantFrames ).selectSnippet();

		expect( getSelection()?.toString() ).toBe( '' );
	} );
} );
