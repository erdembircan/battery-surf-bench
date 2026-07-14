import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVideoControl, youtubeTargetOrigin } from './VideoControl';

/**
 * Dispatches a synthetic `message` event on `window`, shaped like a real
 * YouTube embed's own event message, with `source`/`origin` set so the
 * control under test's gating (`event.source === iframe.contentWindow`,
 * `event.origin === targetOrigin`) matches it — exactly the two fields
 * production code checks, nothing relaxed for testability.
 * @param source
 * @param origin
 * @param payload
 */
const dispatchYoutubeMessage = (
	source: Window | null,
	origin: string,
	payload: unknown
): void => {
	window.dispatchEvent(
		new MessageEvent( 'message', {
			data: JSON.stringify( payload ),
			source,
			origin,
		} )
	);
};

beforeEach( () => {
	document.body.innerHTML = '';
} );

describe( 'youtubeTargetOrigin', () => {
	it( 'resolves the origin of a youtube-nocookie embed src', () => {
		expect(
			youtubeTargetOrigin(
				'https://www.youtube-nocookie.com/embed/xyz?enablejsapi=1'
			)
		).toBe( 'https://www.youtube-nocookie.com' );
	} );

	it( 'resolves the origin of a youtube.com embed src', () => {
		expect(
			youtubeTargetOrigin( 'https://www.youtube.com/embed/xyz' )
		).toBe( 'https://www.youtube.com' );
	} );

	it( 'returns null for a non-youtube host', () => {
		expect(
			youtubeTargetOrigin( 'https://player.vimeo.com/video/123' )
		).toBeNull();
	} );

	it( 'returns null for an unparseable src', () => {
		expect( youtubeTargetOrigin( 'not a url' ) ).toBeNull();
	} );
} );

describe( 'createVideoControl — <video> element', () => {
	it( 'play() calls the element play(), unmuted when the browser allows it', async () => {
		document.body.innerHTML = '<video></video>';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		const play = vi.fn().mockResolvedValue( undefined );
		video.play = play;

		await createVideoControl( video ).play();

		expect( play ).toHaveBeenCalledTimes( 1 );
		expect( video.muted ).toBe( false );
	} );

	it( 'play() retries muted when unmuted autoplay is rejected, and never throws', async () => {
		document.body.innerHTML = '<video></video>';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		const play = vi
			.fn()
			.mockRejectedValueOnce( new Error( 'NotAllowedError' ) )
			.mockResolvedValueOnce( undefined );
		video.play = play;

		await expect(
			createVideoControl( video ).play()
		).resolves.toBeUndefined();

		expect( play ).toHaveBeenCalledTimes( 2 );
		expect( video.muted ).toBe( true );
	} );

	it( 'play() never throws even when the muted retry is also rejected', async () => {
		document.body.innerHTML = '<video></video>';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		video.play = vi.fn().mockRejectedValue( new Error( 'still blocked' ) );

		await expect(
			createVideoControl( video ).play()
		).resolves.toBeUndefined();
	} );

	it( 'play() is a no-op when already playing', async () => {
		document.body.innerHTML = '<video></video>';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		Object.defineProperty( video, 'paused', {
			value: false,
			configurable: true,
		} );
		Object.defineProperty( video, 'ended', {
			value: false,
			configurable: true,
		} );
		const play = vi.fn().mockResolvedValue( undefined );
		video.play = play;

		await createVideoControl( video ).play();

		expect( play ).not.toHaveBeenCalled();
	} );

	it( 'play() replays from the start when the element has ended', async () => {
		document.body.innerHTML = '<video></video>';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		Object.defineProperty( video, 'ended', {
			value: true,
			configurable: true,
		} );
		Object.defineProperty( video, 'paused', {
			value: true,
			configurable: true,
		} );
		video.currentTime = 12;
		const play = vi.fn().mockResolvedValue( undefined );
		video.play = play;

		await createVideoControl( video ).play();

		expect( video.currentTime ).toBe( 0 );
		expect( play ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'stop() pauses and resets to the start', async () => {
		document.body.innerHTML = '<video></video>';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		video.currentTime = 8;
		const pause = vi.fn();
		video.pause = pause;

		await createVideoControl( video ).stop();

		expect( pause ).toHaveBeenCalledTimes( 1 );
		expect( video.currentTime ).toBe( 0 );
	} );

	it( 'getState() reports unstarted, playing, paused and ended', () => {
		document.body.innerHTML = '<video></video>';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		const control = createVideoControl( video );

		expect( control.getState() ).toBe( 'unstarted' );

		Object.defineProperty( video, 'paused', {
			value: false,
			configurable: true,
		} );
		expect( control.getState() ).toBe( 'playing' );

		Object.defineProperty( video, 'paused', {
			value: true,
			configurable: true,
		} );
		video.currentTime = 5;
		expect( control.getState() ).toBe( 'paused' );

		Object.defineProperty( video, 'ended', {
			value: true,
			configurable: true,
		} );
		expect( control.getState() ).toBe( 'ended' );
	} );
} );

describe( 'createVideoControl — youtube iframe', () => {
	const ORIGIN = 'https://www.youtube-nocookie.com';
	const SRC = `${ ORIGIN }/embed/xyz?enablejsapi=1`;

	it( 'creation asserts the listening handshake', () => {
		document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		const postMessage = vi.spyOn( iframe.contentWindow!, 'postMessage' );

		createVideoControl( iframe );

		expect( postMessage ).toHaveBeenCalledWith(
			JSON.stringify( { event: 'listening' } ),
			ORIGIN
		);

		postMessage.mockRestore();
	} );

	it( 'play() posts the playVideo command to the correct target origin', async () => {
		document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		const control = createVideoControl( iframe );
		const postMessage = vi.spyOn( iframe.contentWindow!, 'postMessage' );

		await control.play();

		expect( postMessage ).toHaveBeenCalledWith(
			JSON.stringify( { event: 'command', func: 'playVideo', args: [] } ),
			ORIGIN
		);

		postMessage.mockRestore();
	} );

	it( 'play() is a no-op when the player is already playing', async () => {
		document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		const control = createVideoControl( iframe );
		dispatchYoutubeMessage( iframe.contentWindow, ORIGIN, {
			event: 'infoDelivery',
			info: { playerState: 1 },
		} );
		const postMessage = vi.spyOn( iframe.contentWindow!, 'postMessage' );

		await control.play();

		expect( postMessage ).not.toHaveBeenCalled();

		postMessage.mockRestore();
	} );

	it( 'play() replays from the start (seekTo then playVideo) when the player has ended', async () => {
		document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		const control = createVideoControl( iframe );
		dispatchYoutubeMessage( iframe.contentWindow, ORIGIN, {
			event: 'infoDelivery',
			info: { playerState: 0 },
		} );
		const postMessage = vi.spyOn( iframe.contentWindow!, 'postMessage' );

		await control.play();

		const commandCalls = postMessage.mock.calls.map(
			( call ) => call[ 0 ]
		);
		expect( commandCalls ).toContain(
			JSON.stringify( {
				event: 'command',
				func: 'seekTo',
				args: [ 0, true ],
			} )
		);
		expect( commandCalls ).toContain(
			JSON.stringify( { event: 'command', func: 'playVideo', args: [] } )
		);
		expect(
			commandCalls.indexOf(
				commandCalls.find( ( c ) => c.includes( 'seekTo' ) )!
			)
		).toBeLessThan(
			commandCalls.indexOf(
				commandCalls.find( ( c ) => c.includes( 'playVideo' ) )!
			)
		);

		postMessage.mockRestore();
	} );

	it( 'stop() posts the stopVideo command', async () => {
		document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		const control = createVideoControl( iframe );
		const postMessage = vi.spyOn( iframe.contentWindow!, 'postMessage' );

		await control.stop();

		expect( postMessage ).toHaveBeenCalledWith(
			JSON.stringify( { event: 'command', func: 'stopVideo', args: [] } ),
			ORIGIN
		);

		postMessage.mockRestore();
	} );

	it( 'never throws when contentWindow is missing', async () => {
		document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		Object.defineProperty( iframe, 'contentWindow', { value: null } );
		const control = createVideoControl( iframe );

		await expect( control.play() ).resolves.toBeUndefined();
		await expect( control.stop() ).resolves.toBeUndefined();
	} );

	describe( 'getState()', () => {
		it( 'defaults to unstarted before any message', () => {
			document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
			const iframe = document.querySelector(
				'iframe'
			) as HTMLIFrameElement;
			expect( createVideoControl( iframe ).getState() ).toBe(
				'unstarted'
			);
		} );

		it.each( [
			[ -1, 'unstarted' ],
			[ 0, 'ended' ],
			[ 1, 'playing' ],
			[ 2, 'paused' ],
			[ 3, 'buffering' ],
			[ 5, 'cued' ],
		] as const )(
			'reflects onStateChange info=%d as %s',
			( code, expected ) => {
				document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
				const iframe = document.querySelector(
					'iframe'
				) as HTMLIFrameElement;
				const control = createVideoControl( iframe );

				dispatchYoutubeMessage( iframe.contentWindow, ORIGIN, {
					event: 'onStateChange',
					info: code,
				} );

				expect( control.getState() ).toBe( expected );
			}
		);

		it.each( [
			[ -1, 'unstarted' ],
			[ 0, 'ended' ],
			[ 1, 'playing' ],
			[ 2, 'paused' ],
			[ 3, 'buffering' ],
			[ 5, 'cued' ],
		] as const )(
			'reflects infoDelivery info.playerState=%d as %s — the shape the live embed actually sends',
			( code, expected ) => {
				document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
				const iframe = document.querySelector(
					'iframe'
				) as HTMLIFrameElement;
				const control = createVideoControl( iframe );

				dispatchYoutubeMessage( iframe.contentWindow, ORIGIN, {
					event: 'infoDelivery',
					info: { playerState: code },
				} );

				expect( control.getState() ).toBe( expected );
			}
		);

		it( 'ignores a message from a different source', () => {
			document.body.innerHTML = `<iframe src="${ SRC }"></iframe><iframe id="other" src="${ SRC }"></iframe>`;
			const iframe = document.querySelector(
				'iframe'
			) as HTMLIFrameElement;
			const other = document.querySelector(
				'#other'
			) as HTMLIFrameElement;
			const control = createVideoControl( iframe );

			dispatchYoutubeMessage( other.contentWindow, ORIGIN, {
				event: 'infoDelivery',
				info: { playerState: 1 },
			} );

			expect( control.getState() ).toBe( 'unstarted' );
		} );

		it( 'ignores a message from a different origin', () => {
			document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
			const iframe = document.querySelector(
				'iframe'
			) as HTMLIFrameElement;
			const control = createVideoControl( iframe );

			dispatchYoutubeMessage(
				iframe.contentWindow,
				'https://evil.example',
				{
					event: 'infoDelivery',
					info: { playerState: 1 },
				}
			);

			expect( control.getState() ).toBe( 'unstarted' );
		} );

		it( 'ignores a message whose data is not valid JSON', () => {
			document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
			const iframe = document.querySelector(
				'iframe'
			) as HTMLIFrameElement;
			const control = createVideoControl( iframe );

			window.dispatchEvent(
				new MessageEvent( 'message', {
					data: 'not json',
					source: iframe.contentWindow,
					origin: ORIGIN,
				} )
			);

			expect( control.getState() ).toBe( 'unstarted' );
		} );
	} );

	describe( 'dispose()', () => {
		it( 'removes the message listener — a later message no longer updates state', () => {
			document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
			const iframe = document.querySelector(
				'iframe'
			) as HTMLIFrameElement;
			const control = createVideoControl( iframe );

			control.dispose();

			dispatchYoutubeMessage( iframe.contentWindow, ORIGIN, {
				event: 'infoDelivery',
				info: { playerState: 1 },
			} );

			expect( control.getState() ).toBe( 'unstarted' );
		} );

		it( 'is safe to call more than once', () => {
			document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
			const iframe = document.querySelector(
				'iframe'
			) as HTMLIFrameElement;
			const control = createVideoControl( iframe );

			expect( () => {
				control.dispose();
				control.dispose();
			} ).not.toThrow();
		} );
	} );
} );

describe( 'createVideoControl — anything else', () => {
	it( 'is a safe no-op reporting unavailable for a vimeo iframe', async () => {
		document.body.innerHTML =
			'<iframe src="https://player.vimeo.com/video/123"></iframe>';
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		const postMessage = vi.spyOn( iframe.contentWindow!, 'postMessage' );
		const control = createVideoControl( iframe );

		expect( control.getState() ).toBe( 'unavailable' );
		await expect( control.play() ).resolves.toBeUndefined();
		await expect( control.stop() ).resolves.toBeUndefined();
		expect( () => control.dispose() ).not.toThrow();

		expect( postMessage ).not.toHaveBeenCalled();

		postMessage.mockRestore();
	} );

	it( 'is a safe no-op reporting unavailable for a youtube iframe with an unparseable src', async () => {
		document.body.innerHTML = '<iframe src="not a url"></iframe>';
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		const control = createVideoControl( iframe );

		expect( control.getState() ).toBe( 'unavailable' );
		await expect( control.play() ).resolves.toBeUndefined();
		await expect( control.stop() ).resolves.toBeUndefined();
	} );

	it( 'is a safe no-op reporting unavailable for an element with no video control at all', async () => {
		document.body.innerHTML = '<div></div>';
		const div = document.querySelector( 'div' )!;
		const control = createVideoControl( div );

		expect( control.getState() ).toBe( 'unavailable' );
		await expect( control.play() ).resolves.toBeUndefined();
		await expect( control.stop() ).resolves.toBeUndefined();
	} );
} );
