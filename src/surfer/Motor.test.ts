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

describe( 'DomMotor.playVideo — selection among multiple videos', () => {
	/** An in-viewport rect, so a candidate never triggers the off-screen scroll path unless deliberately overridden. */
	const IN_VIEW_RECT = {
		top: 100,
		bottom: 300,
		left: 50,
		right: 450,
		width: 400,
		height: 200,
	} as DOMRect;

	it( 'can select a video other than the first when the rng points elsewhere', async () => {
		document.body.innerHTML =
			'<video id="v0"></video><video id="v1"></video><video id="v2"></video>';
		const videos = Array.from(
			document.querySelectorAll( 'video' )
		) as HTMLVideoElement[];
		const plays = videos.map( ( v ) => {
			v.getBoundingClientRect = () => IN_VIEW_RECT;
			const play = vi.fn().mockResolvedValue( undefined );
			v.play = play;
			return play;
		} );

		// 3 candidates; rng() = 0.5 -> floor(0.5 * 3) = index 1, not the first.
		await new DomMotor( () => 0.5, instantFrames ).playVideo();

		expect( plays[ 0 ] ).not.toHaveBeenCalled();
		expect( plays[ 1 ] ).toHaveBeenCalledTimes( 1 );
		expect( plays[ 2 ] ).not.toHaveBeenCalled();
	} );

	it( 'selects a different video with a different rng draw — variety across wins', async () => {
		document.body.innerHTML =
			'<video id="v0"></video><video id="v1"></video><video id="v2"></video>';
		const videos = Array.from(
			document.querySelectorAll( 'video' )
		) as HTMLVideoElement[];
		const plays = videos.map( ( v ) => {
			v.getBoundingClientRect = () => IN_VIEW_RECT;
			const play = vi.fn().mockResolvedValue( undefined );
			v.play = play;
			return play;
		} );

		// 3 candidates; rng() = 0.99 -> floor(0.99 * 3) = index 2, the last one.
		await new DomMotor( () => 0.99, instantFrames ).playVideo();

		expect( plays[ 0 ] ).not.toHaveBeenCalled();
		expect( plays[ 1 ] ).not.toHaveBeenCalled();
		expect( plays[ 2 ] ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'scrolls the selected video into view when it is off-screen, even though an earlier candidate is on-screen', async () => {
		document.body.innerHTML =
			'<video id="v0"></video><video id="v1"></video>';
		const videos = Array.from(
			document.querySelectorAll( 'video' )
		) as HTMLVideoElement[];
		videos[ 0 ].getBoundingClientRect = () => IN_VIEW_RECT;
		videos[ 1 ].getBoundingClientRect = () =>
			( {
				top: 3000,
				bottom: 3300,
				left: 50,
				right: 450,
				width: 400,
				height: 300,
			} ) as DOMRect;
		videos.forEach( ( v ) => {
			v.play = vi.fn().mockResolvedValue( undefined );
		} );
		const scrollBySpy = vi
			.spyOn( window, 'scrollBy' )
			.mockImplementation( () => undefined );

		// 2 candidates; rng() = 0.5 -> floor(0.5 * 2) = index 1, the off-screen one.
		await new DomMotor( () => 0.5, instantFrames ).playVideo();

		expect( scrollBySpy ).toHaveBeenCalled();
		expect( videos[ 1 ].play ).toHaveBeenCalledTimes( 1 );
		expect( videos[ 0 ].play ).not.toHaveBeenCalled();

		scrollBySpy.mockRestore();
	} );

	it( 'pools a <video> and an embed iframe together and can select the iframe (DOM order preserved)', async () => {
		document.body.innerHTML =
			'<video id="v0"></video><iframe id="f1" src="https://www.youtube-nocookie.com/embed/xyz"></iframe>';
		const video = document.querySelector( '#v0' ) as HTMLVideoElement;
		const iframe = document.querySelector( '#f1' ) as HTMLIFrameElement;
		video.getBoundingClientRect = () => IN_VIEW_RECT;
		iframe.getBoundingClientRect = () => IN_VIEW_RECT;
		video.play = vi.fn().mockResolvedValue( undefined );
		const postMessageSpy = vi.spyOn( iframe.contentWindow!, 'postMessage' );

		// 2 candidates; rng() = 0.99 -> floor(0.99 * 2) = index 1, the iframe.
		await new DomMotor( () => 0.99, instantFrames ).playVideo();

		expect( video.play ).not.toHaveBeenCalled();
		expect( postMessageSpy ).toHaveBeenCalledWith(
			JSON.stringify( { event: 'command', func: 'playVideo', args: [] } ),
			'https://www.youtube-nocookie.com'
		);

		postMessageSpy.mockRestore();
	} );

	it( 'pools a <video> and an embed iframe together and can select the <video>', async () => {
		document.body.innerHTML =
			'<video id="v0"></video><iframe id="f1" src="https://www.youtube-nocookie.com/embed/xyz"></iframe>';
		const video = document.querySelector( '#v0' ) as HTMLVideoElement;
		const iframe = document.querySelector( '#f1' ) as HTMLIFrameElement;
		video.getBoundingClientRect = () => IN_VIEW_RECT;
		iframe.getBoundingClientRect = () => IN_VIEW_RECT;
		const play = vi.fn().mockResolvedValue( undefined );
		video.play = play;
		const postMessageSpy = vi.spyOn( iframe.contentWindow!, 'postMessage' );

		// 2 candidates; rng() = 0 -> floor(0 * 2) = index 0, the <video>.
		await new DomMotor( () => 0, instantFrames ).playVideo();

		expect( play ).toHaveBeenCalledTimes( 1 );
		expect( postMessageSpy ).not.toHaveBeenCalled();

		postMessageSpy.mockRestore();
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

	it( 'rides the selection caret edge with the cursor, wrapped lines included, when range geometry is measurable', async () => {
		document.body.innerHTML = `<p>${ 'word '.repeat( 20 ) }</p>`;
		const p = document.querySelector( 'p' )!;
		p.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 148,
				left: 50,
				right: 450,
				width: 400,
				height: 48,
			} ) as DOMRect;
		const text = p.firstChild as Text;
		const half = Math.ceil( text.length / 2 );

		// Synthetic two-line layout, 4px per character: the first `half`
		// characters render on a line spanning y 100-124, the rest wrap to a
		// second line spanning y 124-148. jsdom performs no layout, so this
		// stub is the only way to hand the sweep measurable range geometry.
		const syntheticRects = function ( this: Range ): DOMRect[] {
			const end = this.endOffset;
			const rects: DOMRect[] = [];
			const firstLineEnd = Math.min( end, half );
			rects.push( {
				left: 50,
				right: 50 + firstLineEnd * 4,
				top: 100,
				bottom: 124,
				width: firstLineEnd * 4,
				height: 24,
			} as DOMRect );
			if ( end > half ) {
				rects.push( {
					left: 50,
					right: 50 + ( end - half ) * 4,
					top: 124,
					bottom: 148,
					width: ( end - half ) * 4,
					height: 24,
				} as DOMRect );
			}
			return rects;
		};
		const originalGetClientRects = Range.prototype.getClientRects;
		Range.prototype.getClientRects =
			syntheticRects as unknown as typeof Range.prototype.getClientRects;

		const moveToSpy = vi.spyOn( FakeCursor.prototype, 'moveTo' );

		try {
			await new DomMotor( () => 0.1, instantFrames ).selectSnippet();

			const ys = moveToSpy.mock.calls.map(
				( call ) => ( call[ 0 ] as Point ).y
			);

			// Sweep frames ride the caret: y 112 while the selection grows on
			// the first line, dropping to y 136 once it wraps to the second.
			expect( ys ).toContain( 112 );
			expect( ys ).toContain( 136 );

			// The final painted position is the exact caret edge of the fully
			// extended selection: the second line's right edge.
			const last = moveToSpy.mock.calls.at( -1 )![ 0 ] as Point;
			expect( last ).toEqual( {
				x: 50 + ( text.length - half ) * 4,
				y: 136,
			} );
		} finally {
			Range.prototype.getClientRects = originalGetClientRects;
			moveToSpy.mockRestore();
		}
	} );
} );

describe( 'DomMotor.read', () => {
	it( 'falls back to a still idle when the page has no readable prose', async () => {
		document.body.innerHTML = '<p>short</p>';
		const travelToSpy = vi.spyOn( FakeCursor.prototype, 'travelTo' );

		await expect(
			new DomMotor( () => 0.5, instantFrames ).read( 20 )
		).resolves.toBeUndefined();

		expect( travelToSpy ).not.toHaveBeenCalled();

		travelToSpy.mockRestore();
	} );

	it( 'attends the chosen passage, ending with the cursor resting inside it', async () => {
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

		// jsdom has no real scroll implementation — mock it out rather than
		// letting a possible reading creep fall through to jsdom's noisy
		// "not implemented" stub.
		const scrollBySpy = vi
			.spyOn( window, 'scrollBy' )
			.mockImplementation( () => undefined );
		const motor = new DomMotor( () => 0.1, instantFrames );
		const cursorEl =
			document.querySelector< HTMLElement >( '.bsb-surf-cursor' );

		await motor.read( 5000 );

		// A traced sweep's own moveTo calls are constrained to the passage's
		// rect by construction (x from `rect.left + rect.width * t`, t in
		// (0, 1]; y fixed per line within the rect), so the resting position
		// is the reliable, non-transient signal to check here.
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

		scrollBySpy.mockRestore();
	} );

	it( 'reads the in-view passage first, then scrolls to a below-fold one', async () => {
		document.body.innerHTML = `<p id="a">${ 'word '.repeat(
			20
		) }</p><p id="b">${ 'word '.repeat( 20 ) }</p>`;
		const a = document.querySelector( '#a' )!;
		const b = document.querySelector( '#b' )!;
		a.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 200,
				left: 50,
				right: 450,
				width: 400,
				height: 100,
			} ) as DOMRect;
		b.getBoundingClientRect = () =>
			( {
				top: 2000,
				bottom: 2100,
				left: 50,
				right: 450,
				width: 400,
				height: 100,
			} ) as DOMRect;

		const events: string[] = [];
		const travelToSpy = vi
			.spyOn( FakeCursor.prototype, 'travelTo' )
			.mockImplementation( async () => {
				events.push( 'travel' );
			} );
		const scrollBySpy = vi
			.spyOn( DomMotor.prototype, 'scrollBy' )
			.mockImplementation( async () => {
				events.push( 'scroll' );
			} );

		// rng() = 0.9 -> dwell mode (not traced), no creep ever fires.
		await new DomMotor( () => 0.9, instantFrames ).read( 20000 );

		const firstTravel = events.indexOf( 'travel' );
		const firstScroll = events.indexOf( 'scroll' );

		expect( firstTravel ).toBe( 0 );
		expect( firstScroll ).toBeGreaterThan( firstTravel );
		expect( travelToSpy.mock.calls.length ).toBeGreaterThanOrEqual( 2 );

		travelToSpy.mockRestore();
		scrollBySpy.mockRestore();
	} );

	it( 'prefers an off-screen passage for the next target over a remaining in-view one', async () => {
		const word20 = 'word '.repeat( 20 );
		document.body.innerHTML = `<p id="a">${ word20 }</p><p id="c">${ word20 }</p><p id="b">${ word20 }</p>`;
		const a = document.querySelector( '#a' )!;
		const c = document.querySelector( '#c' )!;
		const b = document.querySelector( '#b' )!;
		a.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 200,
				left: 50,
				right: 450,
				width: 400,
				height: 100,
			} ) as DOMRect;
		c.getBoundingClientRect = () =>
			( {
				top: 300,
				bottom: 400,
				left: 50,
				right: 450,
				width: 400,
				height: 100,
			} ) as DOMRect;
		b.getBoundingClientRect = () =>
			( {
				top: 2000,
				bottom: 2100,
				left: 50,
				right: 450,
				width: 400,
				height: 100,
			} ) as DOMRect;

		const scrollBySpy = vi
			.spyOn( DomMotor.prototype, 'scrollBy' )
			.mockImplementation( async () => undefined );

		// rng() = 0.4 -> dwell mode, no creep, and floor(0.4 * tier.length)
		// always resolves to tier index 0.
		await new DomMotor( () => 0.4, instantFrames ).read( 30000 );

		// Anchor-scrolling to B (top 2000) is a single delta of
		// rect.top - innerHeight/3 ~= 2000 - 256 = 1744 — far larger than any
		// other scroll this run could produce — proving B (off-screen) was
		// picked next over C, which was still unread and in view.
		const bigScroll = scrollBySpy.mock.calls.some(
			( call ) => ( call[ 0 ] as number ) > 1000
		);
		expect( bigScroll ).toBe( true );

		scrollBySpy.mockRestore();
	} );

	it( 'creeps the page during a traced read', async () => {
		document.body.innerHTML = `<p>${ 'word '.repeat( 20 ) }</p>`;
		const p = document.querySelector( 'p' )!;
		// A single line at the default 24px line-height fallback, so exactly
		// one creep opportunity is drawn.
		p.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 124,
				left: 50,
				right: 450,
				width: 400,
				height: 24,
			} ) as DOMRect;

		const scrollBySpy = vi
			.spyOn( DomMotor.prototype, 'scrollBy' )
			.mockImplementation( async () => undefined );

		// rng() = 0.2 -> trace mode (0.2 < 0.35) and the creep chance always
		// fires (0.2 < 0.25).
		await new DomMotor( () => 0.2, instantFrames ).read( 8000 );

		const creepCall = scrollBySpy.mock.calls.find( ( call ) => {
			const px = call[ 0 ] as number;
			return px >= 10 && px <= 30;
		} );
		expect( creepCall ).toBeDefined();

		scrollBySpy.mockRestore();
	} );

	it( 'never creeps when the draw stays above the creep chance', async () => {
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

		const scrollBySpy = vi
			.spyOn( DomMotor.prototype, 'scrollBy' )
			.mockImplementation( async () => undefined );

		// rng() = 0.9 -> dwell mode, in view (no anchor scroll needed), and
		// the creep chance never fires (0.9 is not < 0.25).
		await new DomMotor( () => 0.9, instantFrames ).read( 8000 );

		expect( scrollBySpy ).not.toHaveBeenCalled();

		scrollBySpy.mockRestore();
	} );

	it( 'stops within its time budget instead of sweeping every line of a very tall passage', async () => {
		document.body.innerHTML = `<p>${ 'word '.repeat( 50 ) }</p>`;
		const p = document.querySelector( 'p' )!;
		// Positioned close to the cursor's own starting point (viewport
		// centre) so the approach travel itself stays short — isolating the
		// budget cap's effect on the line sweep from the travel's own frame
		// count.
		p.getBoundingClientRect = () =>
			( {
				top: 380,
				bottom: 5380,
				left: 500,
				right: 900,
				width: 400,
				height: 5000,
			} ) as DOMRect;

		const moveToSpy = vi.spyOn( FakeCursor.prototype, 'moveTo' );

		await expect(
			new DomMotor( () => 0.1, instantFrames ).read( 200 )
		).resolves.toBeUndefined();

		const linesVisited = new Set(
			moveToSpy.mock.calls.map( ( call ) =>
				Math.round( ( call[ 0 ] as Point ).y )
			)
		);

		// A 200ms budget (a handful of frames) must cut the session short —
		// nowhere near the ~200 lines a 5000px-tall block renders as at the
		// default 24px line height.
		expect( linesVisited.size ).toBeLessThan( 10 );

		moveToSpy.mockRestore();
	} );

	it( 'rests once every passage has been read, without re-reading it', async () => {
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

		const travelToSpy = vi.spyOn( FakeCursor.prototype, 'travelTo' );

		// rng() = 0.9 -> dwell mode; a single passage, so once it's read the
		// only unread candidate pool is empty and the session rests instead
		// of picking the same passage again.
		await expect(
			new DomMotor( () => 0.9, instantFrames ).read( 60000 )
		).resolves.toBeUndefined();

		expect( travelToSpy ).toHaveBeenCalledTimes( 1 );

		travelToSpy.mockRestore();
	} );

	it( 'glides back to the start of the next traced line instead of teleporting', async () => {
		document.body.innerHTML = `<p>${ 'word '.repeat( 40 ) }</p>`;
		const p = document.querySelector( 'p' )!;
		// Three lines at the default 24px line-height fallback.
		p.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 172,
				left: 50,
				right: 450,
				width: 400,
				height: 72,
			} ) as DOMRect;

		const moveToSpy = vi.spyOn( FakeCursor.prototype, 'moveTo' );

		// rng() = 0.3 -> trace mode (0.3 < 0.35), creep never fires (0.3 > 0.25).
		await new DomMotor( () => 0.3, instantFrames ).read( 20000 );

		const points = moveToSpy.mock.calls.map(
			( call ) => call[ 0 ] as Point
		);
		let maxJump = 0;
		for ( let i = 1; i < points.length; i++ ) {
			maxJump = Math.max(
				maxJump,
				Math.hypot(
					points[ i ].x - points[ i - 1 ].x,
					points[ i ].y - points[ i - 1 ].y
				)
			);
		}

		// Without an animated carriage return, the wrap from a line's right
		// edge to the next line's start is a single ~400px jump; the glide
		// keeps every painted step well under half the passage width.
		expect( maxJump ).toBeLessThan( 200 );

		moveToSpy.mockRestore();
	} );
} );
