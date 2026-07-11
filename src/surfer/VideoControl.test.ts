import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVideoControl, youtubeTargetOrigin } from './VideoControl';

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

	it( 'pause() calls the element pause()', async () => {
		document.body.innerHTML = '<video></video>';
		const video = document.querySelector( 'video' ) as HTMLVideoElement;
		const pause = vi.fn();
		video.pause = pause;

		await createVideoControl( video ).pause();

		expect( pause ).toHaveBeenCalledTimes( 1 );
	} );
} );

describe( 'createVideoControl — youtube iframe', () => {
	it( 'play() posts the playVideo command to the correct target origin', async () => {
		document.body.innerHTML =
			'<iframe src="https://www.youtube-nocookie.com/embed/xyz?enablejsapi=1"></iframe>';
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		const postMessage = vi.spyOn( iframe.contentWindow!, 'postMessage' );

		await createVideoControl( iframe ).play();

		expect( postMessage ).toHaveBeenCalledWith(
			JSON.stringify( { event: 'command', func: 'playVideo', args: [] } ),
			'https://www.youtube-nocookie.com'
		);

		postMessage.mockRestore();
	} );

	it( 'pause() posts the pauseVideo command to the correct target origin', async () => {
		document.body.innerHTML =
			'<iframe src="https://www.youtube.com/embed/xyz?enablejsapi=1"></iframe>';
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		const postMessage = vi.spyOn( iframe.contentWindow!, 'postMessage' );

		await createVideoControl( iframe ).pause();

		expect( postMessage ).toHaveBeenCalledWith(
			JSON.stringify( {
				event: 'command',
				func: 'pauseVideo',
				args: [],
			} ),
			'https://www.youtube.com'
		);

		postMessage.mockRestore();
	} );

	it( 'never throws when contentWindow is missing', async () => {
		document.body.innerHTML =
			'<iframe src="https://www.youtube-nocookie.com/embed/xyz"></iframe>';
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		Object.defineProperty( iframe, 'contentWindow', { value: null } );

		await expect(
			createVideoControl( iframe ).play()
		).resolves.toBeUndefined();
		await expect(
			createVideoControl( iframe ).pause()
		).resolves.toBeUndefined();
	} );
} );

describe( 'createVideoControl — anything else', () => {
	it( 'is a safe no-op for a vimeo iframe', async () => {
		document.body.innerHTML =
			'<iframe src="https://player.vimeo.com/video/123"></iframe>';
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;
		const postMessage = vi.spyOn( iframe.contentWindow!, 'postMessage' );

		await expect(
			createVideoControl( iframe ).play()
		).resolves.toBeUndefined();
		await expect(
			createVideoControl( iframe ).pause()
		).resolves.toBeUndefined();

		expect( postMessage ).not.toHaveBeenCalled();

		postMessage.mockRestore();
	} );

	it( 'is a safe no-op for a youtube iframe with an unparseable src', async () => {
		document.body.innerHTML = '<iframe src="not a url"></iframe>';
		const iframe = document.querySelector( 'iframe' ) as HTMLIFrameElement;

		await expect(
			createVideoControl( iframe ).play()
		).resolves.toBeUndefined();
		await expect(
			createVideoControl( iframe ).pause()
		).resolves.toBeUndefined();
	} );

	it( 'is a safe no-op for an element with no video control at all', async () => {
		document.body.innerHTML = '<div></div>';
		const div = document.querySelector( 'div' )!;

		await expect(
			createVideoControl( div ).play()
		).resolves.toBeUndefined();
		await expect(
			createVideoControl( div ).pause()
		).resolves.toBeUndefined();
	} );
} );
