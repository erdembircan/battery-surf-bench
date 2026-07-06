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

	it( 'attends a youtube-nocookie embed — approaches with the cursor — without calling play', async () => {
		document.body.innerHTML =
			'<iframe src="https://www.youtube-nocookie.com/embed/xyz"></iframe>';
		const iframe = document.querySelector( 'iframe' )!;
		iframe.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 300,
				left: 50,
				right: 450,
				width: 400,
				height: 200,
			} ) as DOMRect;
		const travelToSpy = vi.spyOn( FakeCursor.prototype, 'travelTo' );

		await expect(
			new DomMotor( () => 0.5, instantFrames ).playVideo()
		).resolves.toBeUndefined();

		expect( travelToSpy ).toHaveBeenCalled();

		travelToSpy.mockRestore();
	} );

	it( 'scrolls an off-screen video into view before approaching it', async () => {
		document.body.innerHTML = '<video></video>';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		video.getBoundingClientRect = () =>
			( {
				top: 3000,
				bottom: 3300,
				left: 50,
				right: 450,
				width: 400,
				height: 300,
			} ) as DOMRect;
		video.play = vi.fn().mockResolvedValue( undefined );
		// jsdom has no real scroll implementation — mock it out rather than
		// letting the spy fall through to jsdom's noisy "not implemented" stub.
		const scrollBySpy = vi
			.spyOn( window, 'scrollBy' )
			.mockImplementation( () => undefined );

		await new DomMotor( () => 0.5, instantFrames ).playVideo();

		expect( scrollBySpy ).toHaveBeenCalled();

		scrollBySpy.mockRestore();
	} );
} );

describe( 'DomMotor.lingerImage', () => {
	it( 'travels the cursor onto the chosen image and dwells for the remaining budget', async () => {
		document.body.innerHTML = '<img src="a.jpg">';
		const img = document.querySelector( 'img' )!;
		img.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 200,
				left: 100,
				right: 300,
				width: 200,
				height: 100,
			} ) as DOMRect;

		const motor = new DomMotor( () => 0.5, instantFrames );
		const cursorEl =
			document.querySelector< HTMLElement >( '.bsb-surf-cursor' );

		await motor.lingerImage( 2000 );

		const transform = cursorEl?.style.transform ?? '';
		const match = transform.match(
			/translate\(([-\d.]+)px, ([-\d.]+)px\)/
		);
		expect( match ).not.toBeNull();
		const x = parseFloat( match![ 1 ] );
		const y = parseFloat( match![ 2 ] );

		// Lands within the image's rect — rng() = 0.5 draws zero jitter.
		expect( x ).toBeGreaterThanOrEqual( 100 );
		expect( x ).toBeLessThanOrEqual( 300 );
		expect( y ).toBeGreaterThanOrEqual( 100 );
		expect( y ).toBeLessThanOrEqual( 200 );
	} );

	it( 'scrolls an off-screen image into view before travelling to it', async () => {
		document.body.innerHTML = '<img src="a.jpg">';
		const img = document.querySelector( 'img' )!;
		img.getBoundingClientRect = () =>
			( {
				top: 3000,
				bottom: 3100,
				left: 100,
				right: 300,
				width: 200,
				height: 100,
			} ) as DOMRect;

		// jsdom has no real scroll implementation — mock it out rather than
		// letting the spy fall through to jsdom's noisy "not implemented" stub.
		const scrollBySpy = vi
			.spyOn( window, 'scrollBy' )
			.mockImplementation( () => undefined );
		const travelToSpy = vi.spyOn( FakeCursor.prototype, 'travelTo' );
		const motor = new DomMotor( () => 0.5, instantFrames );

		await motor.lingerImage( 2000 );

		expect( scrollBySpy ).toHaveBeenCalled();
		expect( travelToSpy ).toHaveBeenCalled();
		expect( scrollBySpy.mock.invocationCallOrder[ 0 ] ).toBeLessThan(
			travelToSpy.mock.invocationCallOrder[ 0 ]
		);

		scrollBySpy.mockRestore();
		travelToSpy.mockRestore();
	} );

	it( 'never chooses an image smaller than 40px in either dimension', async () => {
		document.body.innerHTML =
			'<img id="tiny" src="icon.png"><img id="big" src="hero.jpg">';
		const tiny = document.querySelector( '#tiny' )!;
		const big = document.querySelector( '#big' )!;
		tiny.getBoundingClientRect = () =>
			( {
				top: 10,
				bottom: 30,
				left: 10,
				right: 30,
				width: 20,
				height: 20,
			} ) as DOMRect;
		big.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 300,
				left: 100,
				right: 300,
				width: 200,
				height: 200,
			} ) as DOMRect;

		const travelToSpy = vi.spyOn( FakeCursor.prototype, 'travelTo' );
		// rng() = 0 would pick the first candidate array-wise if both
		// qualified; the tiny one must be filtered out regardless of order.
		const motor = new DomMotor( () => 0, instantFrames );

		await motor.lingerImage( 1000 );

		const target = travelToSpy.mock.calls[ 0 ][ 0 ] as Point;
		expect( target.x ).toBeGreaterThanOrEqual( 100 );
		expect( target.x ).toBeLessThanOrEqual( 300 );

		travelToSpy.mockRestore();
	} );

	it( 'falls back to an aimless drift when the page has no image to linger on, and never throws', async () => {
		document.body.innerHTML = '<p>no images here</p>';
		const motor = new DomMotor( () => 0.5, instantFrames );
		const driftSpy = vi.spyOn( motor, 'pointerDrift' );

		await expect( motor.lingerImage( 500 ) ).resolves.toBeUndefined();

		expect( driftSpy ).toHaveBeenCalledWith( 500 );

		driftSpy.mockRestore();
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

	it( 'skips a candidate whose rect sits below the fold, picking a visible one instead', async () => {
		document.body.innerHTML = `<p>${ 'word '.repeat(
			20
		) }</p><p>${ 'word '.repeat( 20 ) }</p>`;
		const [ offscreen, onscreen ] = document.querySelectorAll( 'p' );
		offscreen.getBoundingClientRect = () =>
			( {
				top: 5000,
				bottom: 5020,
				left: 10,
				right: 110,
				width: 100,
				height: 20,
			} ) as DOMRect;
		onscreen.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 120,
				left: 10,
				right: 110,
				width: 100,
				height: 20,
			} ) as DOMRect;

		// Recorded mid-sweep, before the selection is cleared at the end —
		// rng() = 0 always picks the first remaining candidate, so the
		// offscreen paragraph would win if it weren't filtered out first.
		const observedParents: ( Element | null )[] = [];
		const recordingFrames = (): Promise< void > => {
			observedParents.push(
				getSelection()?.anchorNode?.parentElement ?? null
			);
			return Promise.resolve();
		};

		await new DomMotor( () => 0, recordingFrames ).selectSnippet();

		expect( observedParents ).toContain( onscreen );
		expect( observedParents ).not.toContain( offscreen );
	} );

	it( 'does nothing when every candidate sits outside the viewport', async () => {
		document.body.innerHTML = `<p>${ 'word '.repeat( 20 ) }</p>`;
		const [ offscreen ] = document.querySelectorAll( 'p' );
		offscreen.getBoundingClientRect = () =>
			( {
				top: -500,
				bottom: -480,
				left: 10,
				right: 110,
				width: 100,
				height: 20,
			} ) as DOMRect;

		const travelToSpy = vi.spyOn( FakeCursor.prototype, 'travelTo' );

		await new DomMotor( () => 0.1, instantFrames ).selectSnippet();

		expect( getSelection()?.toString() ).toBe( '' );
		expect( travelToSpy ).not.toHaveBeenCalled();

		travelToSpy.mockRestore();
	} );
} );
