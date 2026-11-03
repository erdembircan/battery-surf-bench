import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomMotor } from '@/surfer/Motor';
import { FakeCursor, SURFING_CLASS, type Point } from '@/surfer/FakeCursor';
import { mulberry32 } from '@/surfer/Rng';
import { steppedFrames } from '@/surfer/TestFixtures';
import type { FrameSource } from '@/surfer/FramePacer';

beforeEach( () => {
	document.body.innerHTML = '';
	document.documentElement.classList.remove( SURFING_CLASS );
} );

describe( 'DomMotor.playVideo', () => {
	it( 'does nothing when the page has no video', async () => {
		document.body.innerHTML = '';
		await expect(
			new DomMotor( () => 0.5, steppedFrames() ).playVideo()
		).resolves.toBeUndefined();
	} );

	it( 'plays the video unmuted when the browser allows it', async () => {
		document.body.innerHTML = '<video></video>';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		const play = vi.fn().mockResolvedValue( undefined );
		video.play = play;

		await new DomMotor( () => 0.5, steppedFrames() ).playVideo();

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

		await new DomMotor( () => 0.5, steppedFrames() ).playVideo();

		expect( play ).toHaveBeenCalledTimes( 2 );
		expect( video.muted ).toBe( true );
	} );

	it( 'never throws even if the muted retry is also rejected', async () => {
		document.body.innerHTML = '<video></video>';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		video.play = vi.fn().mockRejectedValue( new Error( 'still blocked' ) );

		await expect(
			new DomMotor( () => 0.5, steppedFrames() ).playVideo()
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
			new DomMotor( () => 0.5, steppedFrames() ).playVideo()
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

		await new DomMotor( () => 0.5, steppedFrames() ).playVideo();

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
		await new DomMotor( () => 0.5, steppedFrames() ).playVideo();

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
		await new DomMotor( () => 0.99, steppedFrames() ).playVideo();

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
		await new DomMotor( () => 0.5, steppedFrames() ).playVideo();

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
		await new DomMotor( () => 0.99, steppedFrames() ).playVideo();

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
		await new DomMotor( () => 0, steppedFrames() ).playVideo();

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
		const motor = new DomMotor( () => 0.5, steppedFrames() );

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
		const motor = new DomMotor( () => 0.5, steppedFrames() );

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
		const motor = new DomMotor( () => 0.5, steppedFrames() );

		await motor.playVideo();
		await motor.stopVideo();

		expect( pause ).toHaveBeenCalledTimes( 1 );
		expect( video.currentTime ).toBe( 0 );
	} );

	it( 'is a safe no-op when nothing was started', async () => {
		await expect(
			new DomMotor( () => 0.5, steppedFrames() ).stopVideo()
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
		const motor = new DomMotor( () => 0.5, steppedFrames() );

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
		const motor = new DomMotor( () => 0.5, steppedFrames() );

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
		const motor = new DomMotor( () => 0.5, steppedFrames() );
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
		const motor = new DomMotor( () => 0.5, steppedFrames() );
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

		const motor = new DomMotor( () => 0.5, steppedFrames() );
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
		const motor = new DomMotor( () => 0.5, steppedFrames() );

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
		const motor = new DomMotor( () => 0, steppedFrames() );

		await motor.lingerImage( 1000 );

		const target = travelToSpy.mock.calls[ 0 ][ 0 ] as Point;
		expect( target.x ).toBeGreaterThanOrEqual( 100 );
		expect( target.x ).toBeLessThanOrEqual( 300 );

		travelToSpy.mockRestore();
	} );

	it( 'falls back to an aimless drift when the page has no image to linger on, and never throws', async () => {
		document.body.innerHTML = '<p>no images here</p>';
		const motor = new DomMotor( () => 0.5, steppedFrames() );
		const driftSpy = vi.spyOn( motor, 'pointerDrift' );

		await expect( motor.lingerImage( 500 ) ).resolves.toBeUndefined();

		expect( driftSpy ).toHaveBeenCalledWith( 500 );

		driftSpy.mockRestore();
	} );
} );

describe( 'DomMotor.pointerDrift', () => {
	it( 'drives the fake cursor away from its starting position', async () => {
		const motor = new DomMotor( () => 0.9, steppedFrames() );
		const cursorEl =
			document.querySelector< HTMLElement >( '.bsb-surf-cursor' );
		const before = cursorEl?.style.transform;

		await motor.pointerDrift( 200 );

		expect( cursorEl?.style.transform ).not.toBe( before );
	} );

	it( 'flags the document as engine-driven, hiding the real cursor', async () => {
		const motor = new DomMotor( () => 0.5, steppedFrames() );
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
		const motor = new DomMotor( mulberry32( 7 ), steppedFrames() );
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
		let now = 0;
		const frames = steppedFrames( 16, () => {
			now += 16;
		} );
		const legs: { start: number; end: number }[] = [];
		const original = FakeCursor.prototype.travelTo;
		const travelToSpy = vi
			.spyOn( FakeCursor.prototype, 'travelTo' )
			.mockImplementation( async function ( this: FakeCursor, ...args ) {
				const start = now;
				await original.apply( this, args );
				legs.push( { start, end: now } );
			} );
		const motor = new DomMotor( mulberry32( 3 ), frames );

		await motor.pointerDrift( 3000 );

		expect( legs.length ).toBeGreaterThan( 1 );

		// A leg's own travel and settle end where it ends; any gap before the
		// next leg starts is a between-legs pause.
		const gaps = legs
			.slice( 1 )
			.map( ( leg, i ) => leg.start - legs[ i ].end );
		expect( Math.max( ...gaps ) ).toBeGreaterThan( 32 );

		travelToSpy.mockRestore();
	} );
} );

describe( 'DomMotor.selectSnippet', () => {
	/**
	 * Steps a fresh motor through `selectSnippet` on `html`, recording the
	 * selection's length on every frame.
	 * @param html
	 */
	const selectionLengthsFor = async ( html: string ): Promise< number[] > => {
		document.body.innerHTML = html;
		const lengths: number[] = [];

		await new DomMotor(
			() => 0,
			steppedFrames( 16, () => {
				lengths.push( getSelection()?.toString().length ?? 0 );
			} )
		).selectSnippet();

		return lengths;
	};

	/**
	 * How many frames a recorded sweep took — from its first highlighted
	 * frame to its first fully highlighted one — and its pace, in characters
	 * per frame, across the middle half of that stretch.
	 * @param lengths
	 */
	const sweepOf = ( lengths: number[] ): { frames: number; pace: number } => {
		const full = Math.max( ...lengths );
		const first = lengths.findIndex( ( length ) => length > 0 );
		const last = lengths.indexOf( full );
		const quarter = first + Math.round( ( last - first ) / 4 );
		const threeQuarters =
			first + Math.round( ( ( last - first ) * 3 ) / 4 );

		return {
			frames: last - first,
			pace:
				( lengths[ threeQuarters ] - lengths[ quarter ] ) /
				( threeQuarters - quarter ),
		};
	};

	it( 'does nothing when the page has no text long enough to select', async () => {
		document.body.innerHTML = '<p>short</p>';
		await expect(
			new DomMotor( () => 0.1, steppedFrames() ).selectSnippet()
		).resolves.toBeUndefined();
		expect( getSelection()?.toString() ).toBe( '' );
	} );

	it( 'extends the selection progressively across multiple frames, not all at once', async () => {
		document.body.innerHTML = `<p>${ 'word '.repeat( 20 ) }</p>`;
		const observedLengths: number[] = [];
		const recordingFrames = steppedFrames( 16, () => {
			observedLengths.push( getSelection()?.toString().length ?? 0 );
		} );

		await new DomMotor( () => 0.1, recordingFrames ).selectSnippet();

		const distinctGrowingLengths = new Set(
			observedLengths.filter( ( length ) => length > 0 )
		);
		expect( distinctGrowingLengths.size ).toBeGreaterThan( 1 );
	} );

	it( 'clears the selection once the hold ends', async () => {
		document.body.innerHTML = `<p>${ 'word '.repeat( 20 ) }</p>`;

		await new DomMotor( () => 0.1, steppedFrames() ).selectSnippet();

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
		const recordingFrames = steppedFrames( 16, () => {
			observedParents.push(
				getSelection()?.anchorNode?.parentElement ?? null
			);
		} );

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

		await new DomMotor( () => 0.1, steppedFrames() ).selectSnippet();

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
			await new DomMotor( () => 0.1, steppedFrames() ).selectSnippet();

			const ys = moveToSpy.mock.calls.map(
				( call ) => ( call[ 0 ] as Point ).y
			);

			// Sweep frames ride the caret: y 112 while the selection grows on
			// the first line, dropping to y 136 once it wraps to the second.
			expect( ys ).toContain( 112 );
			expect( ys ).toContain( 136 );

			// The final painted position is the exact caret edge of the
			// snippet's last visible character — the paragraph's trailing
			// space is never highlighted: the second line's right edge.
			const snippetEnd = text.data.trimEnd().length;
			const last = moveToSpy.mock.calls.at( -1 )![ 0 ] as Point;
			expect( last ).toEqual( {
				x: 50 + ( snippetEnd - half ) * 4,
				y: 136,
			} );
		} finally {
			Range.prototype.getClientRects = originalGetClientRects;
			moveToSpy.mockRestore();
		}
	} );

	it( 'highlights a short and a long snippet at the same pace, the long one simply taking longer', async () => {
		const short = sweepOf(
			await selectionLengthsFor(
				`<p>${ 'word '.repeat( 8 ).trimEnd() }</p>`
			)
		);
		const long = sweepOf(
			await selectionLengthsFor(
				`<p>${ 'word '.repeat( 30 ).trimEnd() }</p>`
			)
		);

		expect( long.pace ).toBeCloseTo( short.pace, 1 );
		expect( long.frames ).toBeGreaterThan( 2 * short.frames );
	} );

	it( 'highlights only the opening sentences of a long paragraph, stopping at a sentence end', async () => {
		const opening =
			'This opening sentence is long enough to count on its own.';
		const second =
			'A second sentence follows it and still fits inside the cap.';
		const third =
			'A third sentence runs well past the cap so the highlight must stop before it begins.';
		document.body.innerHTML = `<p>${ opening } ${ second } ${ third }</p>`;
		const highlighted: string[] = [];

		await new DomMotor(
			() => 0,
			steppedFrames( 16, () => {
				highlighted.push( getSelection()?.toString() ?? '' );
			} )
		).selectSnippet();

		const longest = highlighted.reduce(
			( kept, text ) => ( text.length > kept.length ? text : kept ),
			''
		);
		expect( longest ).toBe( `${ opening } ${ second }` );
	} );

	it( 'starts at the first visible character and paces a run of source whitespace as one character', async () => {
		const plain = sweepOf(
			await selectionLengthsFor(
				`<p>${ 'word '.repeat( 10 ).trimEnd() }</p>`
			)
		);

		document.body.innerHTML = `<p>\n\t\t\t${ 'word\n\t\t\t\t'.repeat(
			9
		) }word\n\t\t</p>`;
		const lengths: number[] = [];
		let firstOffset: number | null = null;

		await new DomMotor(
			() => 0,
			steppedFrames( 16, () => {
				const selection = getSelection();
				const length = selection?.toString().length ?? 0;

				if ( length > 0 && firstOffset === null ) {
					firstOffset = selection!.getRangeAt( 0 ).startOffset;
				}

				lengths.push( length );
			} )
		).selectSnippet();

		expect( firstOffset ).toBe( 4 );
		expect( sweepOf( lengths ).frames ).toBe( plain.frames );
	} );

	it( 'skips a paragraph whose first text run is too short to highlight', async () => {
		document.body.innerHTML = `<p>By <strong>A Byline Long Enough To Count As Text</strong></p><p>${ 'word '
			.repeat( 10 )
			.trimEnd() }</p>`;
		const [ byline, prose ] = document.querySelectorAll( 'p' );
		const anchors: ( Element | null )[] = [];

		await new DomMotor(
			() => 0,
			steppedFrames( 16, () => {
				anchors.push(
					getSelection()?.anchorNode?.parentElement ?? null
				);
			} )
		).selectSnippet();

		expect( anchors ).toContain( prose );
		expect( anchors ).not.toContain( byline );
	} );

	it( 'reports its planned duration once, before any motion, matching the time it then takes', async () => {
		document.body.innerHTML = `<p>${ 'word '.repeat( 12 ).trimEnd() }</p>`;
		let frames = 0;
		let framesWhenPlanned: number | null = null;
		let planned = 0;
		const onPlanned = vi.fn( ( durationMs: number ) => {
			planned = durationMs;
			framesWhenPlanned = frames;
		} );

		await new DomMotor(
			() => 0,
			steppedFrames( 16, () => {
				frames++;
			} )
		).selectSnippet( onPlanned );

		expect( onPlanned ).toHaveBeenCalledTimes( 1 );
		expect( framesWhenPlanned ).toBe( 0 );

		// The motor paces its choreography by frame time, so the announced
		// duration matches the time it actually took to within a frame per
		// phase (approach, settle, sweep, hold), plus the frame that opens
		// the timeline.
		expect( Math.abs( planned - frames * 16 ) ).toBeLessThanOrEqual(
			5 * 16
		);
	} );

	it( 'matches its planned duration at 120 Hz as well', async () => {
		document.body.innerHTML = `<p>${ 'word '.repeat( 12 ).trimEnd() }</p>`;
		let frames = 0;
		let planned = 0;

		await new DomMotor(
			() => 0,
			steppedFrames( 8, () => {
				frames++;
			} )
		).selectSnippet( ( durationMs ) => {
			planned = durationMs;
		} );

		// The motor paces its choreography by frame time, so the announced
		// duration matches the time it actually took to within a frame per
		// phase (approach, settle, sweep, hold), plus the frame that opens
		// the timeline.
		expect( Math.abs( planned - frames * 8 ) ).toBeLessThanOrEqual(
			5 * 16
		);
	} );

	it( 'reports nothing when the page has nothing to select', async () => {
		document.body.innerHTML = '<p>short</p>';
		const onPlanned = vi.fn();

		await new DomMotor( () => 0.1, steppedFrames() ).selectSnippet(
			onPlanned
		);

		expect( onPlanned ).not.toHaveBeenCalled();
	} );
} );

describe( 'DomMotor.read', () => {
	it( 'falls back to a still idle when the page has no readable prose', async () => {
		document.body.innerHTML = '<p>short</p>';
		const travelToSpy = vi.spyOn( FakeCursor.prototype, 'travelTo' );

		await expect(
			new DomMotor( () => 0.5, steppedFrames() ).read( 20 )
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
		const motor = new DomMotor( () => 0.1, steppedFrames() );
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
		await new DomMotor( () => 0.9, steppedFrames() ).read( 20000 );

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
		await new DomMotor( () => 0.4, steppedFrames() ).read( 30000 );

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
		await new DomMotor( () => 0.2, steppedFrames() ).read( 8000 );

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
		await new DomMotor( () => 0.9, steppedFrames() ).read( 8000 );

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
			new DomMotor( () => 0.1, steppedFrames() ).read( 200 )
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
			new DomMotor( () => 0.9, steppedFrames() ).read( 60000 )
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
		await new DomMotor( () => 0.3, steppedFrames() ).read( 20000 );

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

describe( 'DomMotor cursor glyph modes', () => {
	/**
	 * Samples the fake cursor's className and the live ripple count on every
	 * frame, so a mode/ripple that only wears for part of a run — not just
	 * its state at the very end — can be asserted on.
	 */
	const sampleCursor = (): {
		next: FrameSource;
		classes: string[];
		ripples: number[];
	} => {
		const classes: string[] = [];
		const ripples: number[] = [];
		return {
			next: steppedFrames( 16, () => {
				classes.push(
					document.querySelector( '.bsb-surf-cursor' )?.className ??
						''
				);
				ripples.push(
					document.querySelectorAll( '.bsb-surf-click-ripple' ).length
				);
			} ),
			classes,
			ripples,
		};
	};

	it( 'selectSnippet wears the caret mode mid-sweep and drops every modifier once cleared', async () => {
		document.body.innerHTML = `<p>${ 'word '.repeat( 20 ) }</p>`;
		const sampler = sampleCursor();

		await new DomMotor( () => 0.1, sampler.next ).selectSnippet();

		expect(
			sampler.classes.some( ( c ) =>
				c.includes( 'bsb-surf-cursor--caret' )
			)
		).toBe( true );

		const cursorEl =
			document.querySelector< HTMLElement >( '.bsb-surf-cursor' );
		expect( cursorEl?.classList.contains( 'bsb-surf-cursor--caret' ) ).toBe(
			false
		);
		expect( cursorEl?.classList.contains( 'bsb-surf-cursor--hand' ) ).toBe(
			false
		);
	} );

	it( 'read wears the caret mode during a traced passage and drops it once the session ends', async () => {
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
			.spyOn( window, 'scrollBy' )
			.mockImplementation( () => undefined );
		const sampler = sampleCursor();

		// rng() = 0.1 always selects trace mode (0.1 < TRACE_CHANCE 0.35).
		await new DomMotor( () => 0.1, sampler.next ).read( 5000 );

		expect(
			sampler.classes.some( ( c ) =>
				c.includes( 'bsb-surf-cursor--caret' )
			)
		).toBe( true );

		const cursorEl =
			document.querySelector< HTMLElement >( '.bsb-surf-cursor' );
		expect( cursorEl?.classList.contains( 'bsb-surf-cursor--caret' ) ).toBe(
			false
		);

		scrollBySpy.mockRestore();
	} );

	it( 'playVideo wears the hand mode and plays a click ripple, staying in hand mode once it resolves', async () => {
		document.body.innerHTML = '<video></video>';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		video.play = vi.fn().mockResolvedValue( undefined );
		const sampler = sampleCursor();

		await new DomMotor( () => 0.5, sampler.next ).playVideo();

		expect( sampler.ripples.some( ( n ) => n > 0 ) ).toBe( true );
		const cursorEl =
			document.querySelector< HTMLElement >( '.bsb-surf-cursor' );
		expect( cursorEl?.classList.contains( 'bsb-surf-cursor--hand' ) ).toBe(
			true
		);
	} );

	it( 'stopVideo clicks a second time when the video is in-viewport, then drops the hand mode and any ripple', async () => {
		document.body.innerHTML = '<video></video>';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		video.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 300,
				left: 50,
				right: 450,
				width: 400,
				height: 200,
			} ) as DOMRect;
		video.play = vi.fn().mockResolvedValue( undefined );
		video.pause = vi.fn();
		const sampler = sampleCursor();
		const motor = new DomMotor( () => 0.5, sampler.next );
		// The cursor is already hovering the player at stop time (rng()=0.5
		// draws the same jittered point both times), so stopVideo's own
		// click clicks in place — no travel gap separates the two ripples,
		// so counting them requires spying on the click itself rather than
		// inferring two blocks from a 0-to-positive transition in samples.
		const clickSpy = vi.spyOn( FakeCursor.prototype, 'click' );

		await motor.playVideo();
		await motor.stopVideo();

		expect( clickSpy ).toHaveBeenCalledTimes( 2 );

		const cursorEl =
			document.querySelector< HTMLElement >( '.bsb-surf-cursor' );
		expect( cursorEl?.classList.contains( 'bsb-surf-cursor--hand' ) ).toBe(
			false
		);
		expect(
			document.querySelectorAll( '.bsb-surf-click-ripple' )
		).toHaveLength( 0 );

		clickSpy.mockRestore();
	} );

	it( 'stopVideo clicks in place, without moving the cursor, when already hovering the player', async () => {
		document.body.innerHTML = '<video></video>';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		video.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 300,
				left: 50,
				right: 450,
				width: 400,
				height: 200,
			} ) as DOMRect;
		video.play = vi.fn().mockResolvedValue( undefined );
		video.pause = vi.fn();
		const cursorTransform = (): string =>
			document.querySelector< HTMLElement >( '.bsb-surf-cursor' )?.style
				.transform ?? '';
		const rippleTransforms: string[] = [];
		const next = steppedFrames( 16, () => {
			if (
				document.querySelectorAll( '.bsb-surf-click-ripple' ).length > 0
			) {
				rippleTransforms.push( cursorTransform() );
			}
		} );
		const motor = new DomMotor( () => 0.5, next );

		await motor.playVideo();
		const transformAfterPlay = cursorTransform();
		// Only the stop's own click window matters from here.
		rippleTransforms.length = 0;

		await motor.stopVideo();

		expect( rippleTransforms.length ).toBeGreaterThan( 0 );
		expect(
			rippleTransforms.every( ( t ) => t === transformAfterPlay )
		).toBe( true );
	} );

	it( 'stopVideo still travels back to the player when the cursor was moved off it since play started', async () => {
		document.body.innerHTML = '<video></video><img src="a.jpg">';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		const img = document.querySelector( 'img' )!;
		video.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 300,
				left: 50,
				right: 450,
				width: 400,
				height: 200,
			} ) as DOMRect;
		img.getBoundingClientRect = () =>
			( {
				top: 100,
				bottom: 200,
				left: 600,
				right: 700,
				width: 100,
				height: 100,
			} ) as DOMRect;
		video.play = vi.fn().mockResolvedValue( undefined );
		video.pause = vi.fn();
		const motor = new DomMotor( () => 0.5, steppedFrames() );

		await motor.playVideo();
		// Move the cursor off the player, onto the unrelated image, before
		// stopping.
		await motor.lingerImage( 20 );

		const travelToSpy = vi.spyOn( FakeCursor.prototype, 'travelTo' );

		await motor.stopVideo();

		expect( travelToSpy ).toHaveBeenCalled();

		travelToSpy.mockRestore();
	} );

	it( 'stopVideo is a cursor-silent no-op when nothing was started', async () => {
		document.body.innerHTML = '<video></video>';
		const sampler = sampleCursor();
		const motor = new DomMotor( () => 0.5, sampler.next );
		const cursorEl =
			document.querySelector< HTMLElement >( '.bsb-surf-cursor' );
		const initialClass = cursorEl?.className;

		await expect( motor.stopVideo() ).resolves.toBeUndefined();

		expect( cursorEl?.className ).toBe( initialClass );
		expect( sampler.ripples.every( ( n ) => n === 0 ) ).toBe( true );
	} );
} );

describe( 'DomMotor frame-rate independence', () => {
	const rates = [ 16, 8 ];

	/**
	 * Runs `act` on a motor fed frames of `frameMs`, returning the total time
	 * the frames it consumed add up to.
	 * @param frameMs
	 * @param rng
	 * @param act
	 */
	const timeTaken = async (
		frameMs: number,
		rng: () => number,
		act: ( motor: DomMotor ) => Promise< void >
	): Promise< number > => {
		let frames = 0;
		const motor = new DomMotor(
			rng,
			steppedFrames( frameMs, () => {
				frames++;
			} )
		);

		await act( motor );

		return frames * frameMs;
	};

	/**
	 * Gives `el` a fixed viewport rect.
	 * @param el
	 * @param top
	 */
	const placeAt = ( el: Element, top: number ): void => {
		el.getBoundingClientRect = () =>
			( {
				top,
				bottom: top + 100,
				left: 50,
				right: 450,
				width: 400,
				height: 100,
			} ) as DOMRect;
	};

	it( 'drifts for its budget at 60 Hz and 120 Hz alike', async () => {
		for ( const frameMs of rates ) {
			const total = await timeTaken( frameMs, mulberry32( 3 ), ( m ) =>
				m.pointerDrift( 3000 )
			);

			expect( Math.abs( total - 3000 ) ).toBeLessThanOrEqual( 80 );
		}
	} );

	it( 'lingers for its budget at 60 Hz and 120 Hz alike', async () => {
		document.body.innerHTML = '<img src="a.jpg">';
		placeAt( document.querySelector( 'img' )!, 100 );

		for ( const frameMs of rates ) {
			const total = await timeTaken(
				frameMs,
				() => 0.5,
				( m ) => m.lingerImage( 2000 )
			);

			expect( Math.abs( total - 2000 ) ).toBeLessThanOrEqual( 80 );
		}
	} );

	it( 'reads for its budget at 60 Hz and 120 Hz alike', async () => {
		document.body.innerHTML = `<p>${ 'word '.repeat( 20 ) }</p>`;
		placeAt( document.querySelector( 'p' )!, 100 );

		for ( const frameMs of rates ) {
			const total = await timeTaken(
				frameMs,
				() => 0.5,
				( m ) => m.read( 5000 )
			);

			expect( Math.abs( total - 5000 ) ).toBeLessThanOrEqual( 80 );
		}
	} );

	it( "keeps a nested scroll on the read's own budget", async () => {
		document.body.innerHTML = `<p>${ 'word '.repeat(
			20
		) }</p><p>${ 'word '.repeat( 20 ) }</p>`;
		const [ first, second ] = document.querySelectorAll( 'p' );
		placeAt( first, 100 );
		placeAt( second, 2000 );
		const scrollBySpy = vi
			.spyOn( window, 'scrollBy' )
			.mockImplementation( () => {} );

		// The read dwells on the first passage, then reaches the second
		// through a nested scrollBy. Were that scroll to restart the pacer,
		// the read would forget the first passage's time and overrun.
		for ( const frameMs of rates ) {
			const total = await timeTaken(
				frameMs,
				() => 0.5,
				( m ) => m.read( 8000 )
			);

			expect( Math.abs( total - 8000 ) ).toBeLessThanOrEqual( 80 );
		}

		scrollBySpy.mockRestore();
	} );

	it( 'scrolls the whole distance over its duration at 60 Hz and 120 Hz alike', async () => {
		for ( const frameMs of rates ) {
			let scrolled = 0;
			const scrollBySpy = vi
				.spyOn( window, 'scrollBy' )
				.mockImplementation( ( ( _x: number, y: number ) => {
					scrolled += y;
				} ) as typeof window.scrollBy );

			const total = await timeTaken(
				frameMs,
				() => 0.5,
				( m ) => m.scrollBy( 300, 600 )
			);

			expect( scrolled ).toBeCloseTo( 300, 6 );
			expect( Math.abs( total - 600 ) ).toBeLessThanOrEqual( 32 );

			scrollBySpy.mockRestore();
		}
	} );
} );
