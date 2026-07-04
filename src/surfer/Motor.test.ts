import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomMotor } from './Motor';
import { SURFING_CLASS } from './FakeCursor';

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
