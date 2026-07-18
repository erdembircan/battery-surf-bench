import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVideoControl, youtubeTargetOrigin } from '@/surfer/VideoControl';

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

	it( 'onEnded fires when the native ended event fires, and the returned unsubscribe stops it', () => {
		document.body.innerHTML = '<video></video>';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		const control = createVideoControl( video );
		const callback = vi.fn();

		const unsubscribe = control.onEnded( callback );
		video.dispatchEvent( new Event( 'ended' ) );
		expect( callback ).toHaveBeenCalledTimes( 1 );

		unsubscribe();
		video.dispatchEvent( new Event( 'ended' ) );
		expect( callback ).toHaveBeenCalledTimes( 1 );
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

	describe( 'onEnded()', () => {
		it( 'fires when the player transitions into ended via infoDelivery — the shape the live embed actually sends', () => {
			document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
			const iframe = document.querySelector(
				'iframe'
			) as HTMLIFrameElement;
			const control = createVideoControl( iframe );
			const callback = vi.fn();
			control.onEnded( callback );

			dispatchYoutubeMessage( iframe.contentWindow, ORIGIN, {
				event: 'infoDelivery',
				info: { playerState: 0 },
			} );

			expect( callback ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'fires when the player transitions into ended via the documented onStateChange shape', () => {
			document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
			const iframe = document.querySelector(
				'iframe'
			) as HTMLIFrameElement;
			const control = createVideoControl( iframe );
			const callback = vi.fn();
			control.onEnded( callback );

			dispatchYoutubeMessage( iframe.contentWindow, ORIGIN, {
				event: 'onStateChange',
				info: 0,
			} );

			expect( callback ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'fires once per transition — a repeated ended message does not double-fire', () => {
			document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
			const iframe = document.querySelector(
				'iframe'
			) as HTMLIFrameElement;
			const control = createVideoControl( iframe );
			const callback = vi.fn();
			control.onEnded( callback );

			dispatchYoutubeMessage( iframe.contentWindow, ORIGIN, {
				event: 'infoDelivery',
				info: { playerState: 0 },
			} );
			dispatchYoutubeMessage( iframe.contentWindow, ORIGIN, {
				event: 'infoDelivery',
				info: { playerState: 0 },
			} );

			expect( callback ).toHaveBeenCalledTimes( 1 );
		} );

		it( 'fires again on a genuinely new ended transition after an intervening non-ended state', () => {
			document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
			const iframe = document.querySelector(
				'iframe'
			) as HTMLIFrameElement;
			const control = createVideoControl( iframe );
			const callback = vi.fn();
			control.onEnded( callback );

			dispatchYoutubeMessage( iframe.contentWindow, ORIGIN, {
				event: 'infoDelivery',
				info: { playerState: 0 },
			} );
			dispatchYoutubeMessage( iframe.contentWindow, ORIGIN, {
				event: 'infoDelivery',
				info: { playerState: 1 },
			} );
			dispatchYoutubeMessage( iframe.contentWindow, ORIGIN, {
				event: 'infoDelivery',
				info: { playerState: 0 },
			} );

			expect( callback ).toHaveBeenCalledTimes( 2 );
		} );

		it( 'never fires for a non-ended state', () => {
			document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
			const iframe = document.querySelector(
				'iframe'
			) as HTMLIFrameElement;
			const control = createVideoControl( iframe );
			const callback = vi.fn();
			control.onEnded( callback );

			dispatchYoutubeMessage( iframe.contentWindow, ORIGIN, {
				event: 'infoDelivery',
				info: { playerState: 1 },
			} );

			expect( callback ).not.toHaveBeenCalled();
		} );

		it( 'the returned unsubscribe stops further callbacks', () => {
			document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
			const iframe = document.querySelector(
				'iframe'
			) as HTMLIFrameElement;
			const control = createVideoControl( iframe );
			const callback = vi.fn();
			const unsubscribe = control.onEnded( callback );

			unsubscribe();

			dispatchYoutubeMessage( iframe.contentWindow, ORIGIN, {
				event: 'infoDelivery',
				info: { playerState: 0 },
			} );

			expect( callback ).not.toHaveBeenCalled();
		} );

		it( 'ignores a message from a different source', () => {
			document.body.innerHTML = `<iframe src="${ SRC }"></iframe><iframe id="other" src="${ SRC }"></iframe>`;
			const iframe = document.querySelector(
				'iframe'
			) as HTMLIFrameElement;
			const other = document.querySelector(
				'#other'
			) as HTMLIFrameElement;
			const control = createVideoControl( iframe );
			const callback = vi.fn();
			control.onEnded( callback );

			dispatchYoutubeMessage( other.contentWindow, ORIGIN, {
				event: 'infoDelivery',
				info: { playerState: 0 },
			} );

			expect( callback ).not.toHaveBeenCalled();
		} );

		it( 'ignores a message from a different origin', () => {
			document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
			const iframe = document.querySelector(
				'iframe'
			) as HTMLIFrameElement;
			const control = createVideoControl( iframe );
			const callback = vi.fn();
			control.onEnded( callback );

			dispatchYoutubeMessage(
				iframe.contentWindow,
				'https://evil.example',
				{
					event: 'infoDelivery',
					info: { playerState: 0 },
				}
			);

			expect( callback ).not.toHaveBeenCalled();
		} );

		it( 'ignores a message whose data is not valid JSON', () => {
			document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
			const iframe = document.querySelector(
				'iframe'
			) as HTMLIFrameElement;
			const control = createVideoControl( iframe );
			const callback = vi.fn();
			control.onEnded( callback );

			window.dispatchEvent(
				new MessageEvent( 'message', {
					data: 'not json',
					source: iframe.contentWindow,
					origin: ORIGIN,
				} )
			);

			expect( callback ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'dispose()', () => {
		it( 'removes the message listener — a later ended message no longer fires onEnded', () => {
			document.body.innerHTML = `<iframe src="${ SRC }"></iframe>`;
			const iframe = document.querySelector(
				'iframe'
			) as HTMLIFrameElement;
			const control = createVideoControl( iframe );
			const callback = vi.fn();
			control.onEnded( callback );

			control.dispose();

			dispatchYoutubeMessage( iframe.contentWindow, ORIGIN, {
				event: 'infoDelivery',
				info: { playerState: 0 },
			} );

			expect( callback ).not.toHaveBeenCalled();
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
	it( 'is a safe no-op for a vimeo iframe and never fires onEnded', async () => {
		document.body.innerHTML =
			'<iframe src="https://player.vimeo.com/video/123"></iframe>';
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		const postMessage = vi.spyOn( iframe.contentWindow!, 'postMessage' );
		const control = createVideoControl( iframe );
		const callback = vi.fn();

		const unsubscribe = control.onEnded( callback );
		await expect( control.play() ).resolves.toBeUndefined();
		await expect( control.stop() ).resolves.toBeUndefined();
		expect( () => control.dispose() ).not.toThrow();
		expect( () => unsubscribe() ).not.toThrow();
		expect( callback ).not.toHaveBeenCalled();

		expect( postMessage ).not.toHaveBeenCalled();

		postMessage.mockRestore();
	} );

	it( 'is a safe no-op for a youtube iframe with an unparseable src and never fires onEnded', async () => {
		document.body.innerHTML = '<iframe src="not a url"></iframe>';
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		const control = createVideoControl( iframe );
		const callback = vi.fn();

		control.onEnded( callback );
		await expect( control.play() ).resolves.toBeUndefined();
		await expect( control.stop() ).resolves.toBeUndefined();
		expect( callback ).not.toHaveBeenCalled();
	} );

	it( 'is a safe no-op for an element with no video control at all and never fires onEnded', async () => {
		document.body.innerHTML = '<div></div>';
		const div = document.querySelector( 'div' )!;
		const control = createVideoControl( div );
		const callback = vi.fn();

		control.onEnded( callback );
		await expect( control.play() ).resolves.toBeUndefined();
		await expect( control.stop() ).resolves.toBeUndefined();
		expect( callback ).not.toHaveBeenCalled();
	} );
} );
