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

	it( 'attends a youtube-nocookie embed — approaches with the cursor — and issues a play command', async () => {
		document.body.innerHTML =
			'<iframe src="https://www.youtube-nocookie.com/embed/xyz"></iframe>';
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
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
		const postMessageSpy = vi.spyOn( iframe.contentWindow!, 'postMessage' );

		await expect(
			new DomMotor( () => 0.5, instantFrames ).playVideo()
		).resolves.toBeUndefined();

		expect( travelToSpy ).toHaveBeenCalled();
		expect( postMessageSpy ).toHaveBeenCalledWith(
			JSON.stringify( { event: 'command', func: 'playVideo', args: [] } ),
			'https://www.youtube-nocookie.com'
		);

		travelToSpy.mockRestore();
		postMessageSpy.mockRestore();
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

describe( 'DomMotor.stopVideo', () => {
	it( 'fully stops the target playVideo last started (stopVideo command, not a pause)', async () => {
		document.body.innerHTML =
			'<iframe src="https://www.youtube-nocookie.com/embed/xyz"></iframe>';
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		iframe.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 300,
				left: 50,
				right: 450,
				width: 400,
				height: 200,
			} ) as DOMRect;
		const postMessageSpy = vi.spyOn( iframe.contentWindow!, 'postMessage' );
		const motor = new DomMotor( () => 0.5, instantFrames );

		await motor.playVideo();
		postMessageSpy.mockClear();
		await motor.stopVideo();

		expect( postMessageSpy ).toHaveBeenCalledWith(
			JSON.stringify( {
				event: 'command',
				func: 'stopVideo',
				args: [],
			} ),
			'https://www.youtube-nocookie.com'
		);

		postMessageSpy.mockRestore();
	} );

	it( 'disposes the message listener of the target playVideo last started', async () => {
		document.body.innerHTML =
			'<iframe src="https://www.youtube-nocookie.com/embed/xyz"></iframe>';
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		iframe.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 300,
				left: 50,
				right: 450,
				width: 400,
				height: 200,
			} ) as DOMRect;
		const removeListenerSpy = vi.spyOn( window, 'removeEventListener' );
		const motor = new DomMotor( () => 0.5, instantFrames );

		await motor.playVideo();
		await motor.stopVideo();

		expect( removeListenerSpy ).toHaveBeenCalledWith(
			'message',
			expect.any( Function )
		);

		removeListenerSpy.mockRestore();
	} );

	it( 'fully stops (pause + reset to start) a real <video> element playVideo last started', async () => {
		document.body.innerHTML = '<video></video>';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		video.currentTime = 6;
		video.play = vi.fn().mockResolvedValue( undefined );
		const pause = vi.fn();
		video.pause = pause;
		const motor = new DomMotor( () => 0.5, instantFrames );

		await motor.playVideo();
		await motor.stopVideo();

		expect( pause ).toHaveBeenCalledTimes( 1 );
		expect( video.currentTime ).toBe( 0 );
	} );

	it( 'is a safe no-op when nothing was started', async () => {
		await expect(
			new DomMotor( () => 0.5, instantFrames ).stopVideo()
		).resolves.toBeUndefined();
	} );
} );

describe( 'DomMotor.playVideo — repeated calls', () => {
	it( 'disposes the previous control before creating a new one', async () => {
		document.body.innerHTML =
			'<iframe src="https://www.youtube-nocookie.com/embed/xyz"></iframe>';
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		iframe.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 300,
				left: 50,
				right: 450,
				width: 400,
				height: 200,
			} ) as DOMRect;
		const removeListenerSpy = vi.spyOn( window, 'removeEventListener' );
		const motor = new DomMotor( () => 0.5, instantFrames );

		await motor.playVideo();
		expect( removeListenerSpy ).not.toHaveBeenCalledWith(
			'message',
			expect.any( Function )
		);

		await motor.playVideo();
		expect( removeListenerSpy ).toHaveBeenCalledWith(
			'message',
			expect.any( Function )
		);

		removeListenerSpy.mockRestore();
	} );

	it( 'unsubscribes the previous control auto-replay before creating a new one', async () => {
		document.body.innerHTML =
			'<iframe src="https://www.youtube-nocookie.com/embed/xyz"></iframe>';
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		iframe.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 300,
				left: 50,
				right: 450,
				width: 400,
				height: 200,
			} ) as DOMRect;
		const motor = new DomMotor( () => 0.5, instantFrames );

		// The second call disposes and unsubscribes the first control before
		// building and subscribing a second one on the same underlying
		// iframe — an ended message afterwards must trigger exactly one
		// replay (from the current control), never two (one per control).
		await motor.playVideo();
		await motor.playVideo();

		const postMessageSpy = vi.spyOn( iframe.contentWindow!, 'postMessage' );

		window.dispatchEvent(
			new MessageEvent( 'message', {
				data: JSON.stringify( {
					event: 'infoDelivery',
					info: { playerState: 0 },
				} ),
				source: iframe.contentWindow,
				origin: 'https://www.youtube-nocookie.com',
			} )
		);

		const playCommandCalls = postMessageSpy.mock.calls.filter(
			( call ) =>
				'string' === typeof call[ 0 ] &&
				call[ 0 ].includes( '"playVideo"' )
		);
		expect( playCommandCalls ).toHaveLength( 1 );

		postMessageSpy.mockRestore();
	} );
} );

describe( 'DomMotor.playVideo — auto-replay on ended', () => {
	it( 'replays the started control the instant the player reports ended (seekTo then playVideo)', async () => {
		document.body.innerHTML =
			'<iframe src="https://www.youtube-nocookie.com/embed/xyz"></iframe>';
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		iframe.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 300,
				left: 50,
				right: 450,
				width: 400,
				height: 200,
			} ) as DOMRect;
		const motor = new DomMotor( () => 0.5, instantFrames );
		await motor.playVideo();

		const postMessageSpy = vi.spyOn( iframe.contentWindow!, 'postMessage' );

		window.dispatchEvent(
			new MessageEvent( 'message', {
				data: JSON.stringify( {
					event: 'infoDelivery',
					info: { playerState: 0 },
				} ),
				source: iframe.contentWindow,
				origin: 'https://www.youtube-nocookie.com',
			} )
		);

		expect( postMessageSpy ).toHaveBeenCalledWith(
			JSON.stringify( {
				event: 'command',
				func: 'seekTo',
				args: [ 0, true ],
			} ),
			'https://www.youtube-nocookie.com'
		);
		expect( postMessageSpy ).toHaveBeenCalledWith(
			JSON.stringify( { event: 'command', func: 'playVideo', args: [] } ),
			'https://www.youtube-nocookie.com'
		);

		postMessageSpy.mockRestore();
	} );
} );

describe( 'DomMotor.stopVideo — unsubscribes the auto-replay', () => {
	it( 'stops replaying after stopVideo — a later ended message triggers nothing', async () => {
		document.body.innerHTML =
			'<iframe src="https://www.youtube-nocookie.com/embed/xyz"></iframe>';
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		iframe.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 300,
				left: 50,
				right: 450,
				width: 400,
				height: 200,
			} ) as DOMRect;
		const motor = new DomMotor( () => 0.5, instantFrames );
		await motor.playVideo();
		await motor.stopVideo();

		const postMessageSpy = vi.spyOn( iframe.contentWindow!, 'postMessage' );

		window.dispatchEvent(
			new MessageEvent( 'message', {
				data: JSON.stringify( {
					event: 'infoDelivery',
					info: { playerState: 0 },
				} ),
				source: iframe.contentWindow,
				origin: 'https://www.youtube-nocookie.com',
			} )
		);

		expect( postMessageSpy ).not.toHaveBeenCalled();

		postMessageSpy.mockRestore();
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

describe( 'DomMotor.readTrace', () => {
	it( 'ends the sweep with the cursor resting inside the chosen block', async () => {
		document.body.innerHTML = `<p>${ 'word '.repeat( 20 ) }</p>`;
		const p = document.querySelector( 'p' )!;
		p.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 200,
				left: 50,
				right: 450,
				width: 400,
				height: 100,
			} ) as DOMRect;

		const motor = new DomMotor( () => 0.5, instantFrames );
		const cursorEl =
			document.querySelector< HTMLElement >( '.bsb-surf-cursor' );

		await motor.readTrace( 5000 );

		// The sweep's own moveTo calls are constrained to the block's rect by
		// construction (x from `rect.left + rect.width * t`, t in (0, 1]; y
		// fixed per line within the rect); only the initial approach travels
		// from wherever the cursor already was, so the resting position is
		// the reliable, non-transient signal to check here.
		const transform = cursorEl?.style.transform ?? '';
		const match = transform.match(
			/translate\(([-\d.]+)px, ([-\d.]+)px\)/
		);
		expect( match ).not.toBeNull();
		const x = parseFloat( match![ 1 ] );
		const y = parseFloat( match![ 2 ] );

		expect( x ).toBeGreaterThanOrEqual( 50 );
		expect( x ).toBeLessThanOrEqual( 450 );
		expect( y ).toBeGreaterThanOrEqual( 100 );
		expect( y ).toBeLessThanOrEqual( 200 );
	} );

	it( 'sweeps multiple lines for a tall block', async () => {
		document.body.innerHTML = `<p>${ 'word '.repeat( 40 ) }</p>`;
		const p = document.querySelector( 'p' )!;
		// Tall enough at the default 24px line-height fallback (jsdom's
		// computed line-height is "normal", not a resolved px length) to
		// estimate several lines.
		p.getBoundingClientRect = () =>
			( {
				top: 0,
				bottom: 120,
				left: 0,
				right: 400,
				width: 400,
				height: 120,
			} ) as DOMRect;

		const moveToSpy = vi.spyOn( FakeCursor.prototype, 'moveTo' );

		await new DomMotor( () => 0.5, instantFrames ).readTrace( 10_000 );

		const linesVisited = new Set(
			moveToSpy.mock.calls.map( ( call ) =>
				Math.round( ( call[ 0 ] as Point ).y )
			)
		);
		expect( linesVisited.size ).toBeGreaterThan( 1 );

		moveToSpy.mockRestore();
	} );

	it( 'falls back to a still idle, without throwing, when no readable block is in view', async () => {
		document.body.innerHTML = '<p>short</p>';
		const travelToSpy = vi.spyOn( FakeCursor.prototype, 'travelTo' );

		await expect(
			new DomMotor( () => 0.5, instantFrames ).readTrace( 20 )
		).resolves.toBeUndefined();

		expect( travelToSpy ).not.toHaveBeenCalled();

		travelToSpy.mockRestore();
	} );

	it( 'stops within its time budget instead of sweeping every line of a very tall block', async () => {
		document.body.innerHTML = `<p>${ 'word '.repeat( 50 ) }</p>`;
		const p = document.querySelector( 'p' )!;
		p.getBoundingClientRect = () =>
			( {
				top: 0,
				bottom: 5000,
				left: 0,
				right: 400,
				width: 400,
				height: 5000,
			} ) as DOMRect;

		const moveToSpy = vi.spyOn( FakeCursor.prototype, 'moveTo' );

		await expect(
			new DomMotor( () => 0.5, instantFrames ).readTrace( 200 )
		).resolves.toBeUndefined();

		const linesVisited = new Set(
			moveToSpy.mock.calls.map( ( call ) =>
				Math.round( ( call[ 0 ] as Point ).y )
			)
		);

		// A 5000px-tall block at the default 24px line height renders roughly
		// 200 lines; the ~200ms budget (a handful of frames) must cut the
		// sweep short after one or two, not race through the whole block.
		expect( linesVisited.size ).toBeLessThan( 10 );

		moveToSpy.mockRestore();
	} );
} );
