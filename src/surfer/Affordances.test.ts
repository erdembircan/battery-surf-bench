import { describe, it, expect } from 'vitest';
import {
	senseAffordances,
	contentRoot,
	VIDEO_EMBED_SELECTOR,
} from '@/surfer/Affordances';

/**
 * Builds a jsdom document with the given content markup. When `chrome` is
 * given, `html` is wrapped in a `<main>` and `chrome` is rendered as its
 * sibling — standing in for page chrome (the admin bar, theme header/footer)
 * that sits outside the content root. With no `chrome`, `html` lands directly
 * in `<body>` (no `<main>` at all), exercising the body-fallback scoping.
 * @param html
 * @param chrome
 */
const docFrom = ( html: string, chrome = '' ): Document => {
	const parser = new DOMParser();
	const body = chrome ? `${ chrome }<main>${ html }</main>` : html;
	return parser.parseFromString(
		`<!DOCTYPE html><html><body>${ body }</body></html>`,
		'text/html'
	);
};

describe( 'senseAffordances', () => {
	it( 'detects a video page', () => {
		const doc = docFrom( '<video src="movie.mp4"></video>' );
		expect( senseAffordances( doc ).hasVideo ).toBe( true );
	} );

	it( 'reports no video when none is present', () => {
		const doc = docFrom( '<p>plain text</p>' );
		expect( senseAffordances( doc ).hasVideo ).toBe( false );
	} );

	it( 'detects a youtube-nocookie embed as video', () => {
		const doc = docFrom(
			'<iframe src="https://www.youtube-nocookie.com/embed/xyz"></iframe>'
		);
		expect( senseAffordances( doc ).hasVideo ).toBe( true );
	} );

	it( 'detects a youtube.com embed as video', () => {
		const doc = docFrom(
			'<iframe src="https://www.youtube.com/embed/xyz"></iframe>'
		);
		expect( senseAffordances( doc ).hasVideo ).toBe( true );
	} );

	it( 'detects a native core/embed YouTube block as video', () => {
		const doc = docFrom(
			'<figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio">' +
				'<div class="wp-block-embed__wrapper">' +
				'<iframe src="https://www.youtube-nocookie.com/embed/xyz?enablejsapi=1&amp;playsinline=1&amp;mute=1&amp;rel=0" title="YouTube video player" allowfullscreen></iframe>' +
				'</div></figure>'
		);
		expect( senseAffordances( doc ).hasVideo ).toBe( true );
	} );

	it( 'detects a vimeo player embed as video', () => {
		const doc = docFrom(
			'<iframe src="https://player.vimeo.com/video/123"></iframe>'
		);
		expect( senseAffordances( doc ).hasVideo ).toBe( true );
	} );

	it( 'does not treat an unrelated iframe as video', () => {
		const doc = docFrom(
			'<iframe src="https://example.test/widget"></iframe>'
		);
		expect( senseAffordances( doc ).hasVideo ).toBe( false );
	} );

	it( 'counts gallery images', () => {
		const doc = docFrom(
			'<img src="a.jpg"><img src="b.jpg"><img src="c.jpg">'
		);
		expect( senseAffordances( doc ).imageCount ).toBe( 3 );
	} );

	it( 'counts an image inside the content root, not one in page chrome outside it', () => {
		const doc = docFrom(
			'<img src="content.jpg">',
			'<div id="wpadminbar"><img src="avatar.jpg"></div>'
		);
		expect( senseAffordances( doc ).imageCount ).toBe( 1 );
	} );

	it( 'falls back to body scoping when the page has no <main>', () => {
		const doc = docFrom( '<img src="a.jpg"><img src="b.jpg">' );
		expect( senseAffordances( doc ).imageCount ).toBe( 2 );
	} );

	it( 'counts SVG artwork presented as figures — a 20-figure gallery counts 20', () => {
		const figures = Array.from( { length: 20 } )
			.map( () => '<figure><svg></svg></figure>' )
			.join( '' );
		const doc = docFrom( figures );
		expect( senseAffordances( doc ).imageCount ).toBe( 20 );
	} );

	it( 'counts a <picture>-wrapped image once, not twice', () => {
		const doc = docFrom(
			'<picture><source srcset="a.webp"><img src="a.jpg"></picture>'
		);
		expect( senseAffordances( doc ).imageCount ).toBe( 1 );
	} );

	it( 'does not count a bare icon <svg> outside a figure', () => {
		const doc = docFrom( '<svg class="icon"></svg>' );
		expect( senseAffordances( doc ).imageCount ).toBe( 0 );
	} );

	it( 'reads a text-heavy article as denser than a links page', () => {
		const article = docFrom( `<p>${ 'word '.repeat( 400 ) }</p>` );
		const links = docFrom(
			'<ul><li><a href="/a">A</a></li><li><a href="/b">B</a></li></ul>'
		);
		expect( senseAffordances( article ).textDensity ).toBeGreaterThan(
			senseAffordances( links ).textDensity
		);
	} );

	it( 'saturates text density at 1 rather than exceeding it', () => {
		const doc = docFrom( `<p>${ 'word '.repeat( 5000 ) }</p>` );
		expect( senseAffordances( doc ).textDensity ).toBe( 1 );
	} );

	it( 'measures text density from the content root, ignoring chrome text', () => {
		const doc = docFrom(
			'<p>short</p>',
			`<nav>${ 'chrome-link '.repeat( 400 ) }</nav>`
		);
		expect( senseAffordances( doc ).textDensity ).toBeLessThan( 0.05 );
	} );
} );

describe( 'contentRoot', () => {
	it( 'returns the <main> element when the page has one', () => {
		const doc = docFrom( '<p>content</p>', '<nav>chrome</nav>' );
		expect( contentRoot( doc ).tagName ).toBe( 'MAIN' );
	} );

	it( 'falls back to <body> when the page has no <main>', () => {
		const doc = docFrom( '<p>content</p>' );
		expect( contentRoot( doc ) ).toBe( doc.body );
	} );
} );

describe( 'VIDEO_EMBED_SELECTOR', () => {
	it( 'is the single source senseAffordances matches video-host embeds with', () => {
		const doc = docFrom(
			'<iframe src="https://player.vimeo.com/video/123"></iframe>'
		);
		const embed = contentRoot( doc ).querySelector( VIDEO_EMBED_SELECTOR );
		expect( embed ).not.toBeNull();
	} );
} );
