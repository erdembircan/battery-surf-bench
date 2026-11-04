import { describe, it, expect } from 'vitest';
import { withSurferParams } from '@/cockpit/SurferUrl';

describe( 'withSurferParams', () => {
	it( 'appends the trait vector and speed as query params', () => {
		const url = withSurferParams(
			'https://example.test/article-1',
			[ 5, 5, 5, 5, 5 ],
			1
		);
		const parsed = new URL( url );

		expect( parsed.searchParams.get( 'bsbenchTraits' ) ).toBe(
			'5,5,5,5,5'
		);
		expect( parsed.searchParams.get( 'bsbenchSpeed' ) ).toBe( '1' );
	} );

	it( 'preserves the page path and any existing query string', () => {
		const url = withSurferParams(
			'https://example.test/gallery?foo=bar',
			[ 5, 5, 5, 5, 5 ],
			4
		);
		const parsed = new URL( url );

		expect( parsed.pathname ).toBe( '/gallery' );
		expect( parsed.searchParams.get( 'foo' ) ).toBe( 'bar' );
	} );

	it( 'normalizes an out-of-range trait vector before it reaches the URL', () => {
		const url = withSurferParams(
			'https://example.test/article-1',
			[ 99, 99, 99, 99, 99 ],
			1
		);
		const parsed = new URL( url );
		const traits = parsed.searchParams
			.get( 'bsbenchTraits' )
			?.split( ',' )
			.map( Number );

		expect( traits?.every( ( value ) => value <= 10 ) ).toBe( true );
	} );

	it( 'normalizes an unsupported speed to the slowest supported value', () => {
		const url = withSurferParams(
			'https://example.test/article-1',
			[ 5, 5, 5, 5, 5 ],
			999
		);
		expect( new URL( url ).searchParams.get( 'bsbenchSpeed' ) ).toBe( '1' );
	} );

	it( 'omits bsbenchSterile entirely when not sterile (the default)', () => {
		const url = withSurferParams(
			'https://example.test/article-1',
			[ 5, 5, 5, 5, 5 ],
			1
		);
		expect( new URL( url ).searchParams.has( 'bsbenchSterile' ) ).toBe(
			false
		);

		const explicit = withSurferParams(
			'https://example.test/article-1',
			[ 5, 5, 5, 5, 5 ],
			1,
			false
		);
		expect( new URL( explicit ).searchParams.has( 'bsbenchSterile' ) ).toBe(
			false
		);
	} );

	it( 'appends bsbenchSterile=1 when sterile', () => {
		const url = withSurferParams(
			'https://example.test/article-1',
			[ 5, 5, 5, 5, 5 ],
			1,
			true
		);
		expect( new URL( url ).searchParams.get( 'bsbenchSterile' ) ).toBe(
			'1'
		);
	} );
} );
