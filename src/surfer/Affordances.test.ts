import { describe, it, expect } from 'vitest';
import { senseAffordances } from './Affordances';

/**
 * Builds a jsdom document with the given body markup.
 * @param html
 */
const docFrom = ( html: string ): Document => {
	const parser = new DOMParser();
	return parser.parseFromString(
		`<!DOCTYPE html><html><body>${ html }</body></html>`,
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

	it( 'counts gallery images', () => {
		const doc = docFrom(
			'<img src="a.jpg"><img src="b.jpg"><img src="c.jpg">'
		);
		expect( senseAffordances( doc ).imageCount ).toBe( 3 );
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
} );
