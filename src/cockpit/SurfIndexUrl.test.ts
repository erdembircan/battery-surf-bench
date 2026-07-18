import { describe, it, expect } from 'vitest';
import {
	buildSurfIndexUrl,
	SURF_INDEX_PARAM,
	SURF_NONCE_PARAM,
} from '@/cockpit/SurfIndexUrl';

describe( 'buildSurfIndexUrl', () => {
	it( 'builds the base URL with the index and nonce as query params', () => {
		const url = new URL(
			buildSurfIndexUrl( 'https://example.test/', 3, 'abc123' )
		);

		expect( url.origin + url.pathname ).toBe( 'https://example.test/' );
		expect( url.searchParams.get( SURF_INDEX_PARAM ) ).toBe( '3' );
		expect( url.searchParams.get( SURF_NONCE_PARAM ) ).toBe( 'abc123' );
	} );

	it( 'carries a zero index explicitly rather than dropping it', () => {
		const url = new URL(
			buildSurfIndexUrl( 'https://example.test/', 0, 'abc123' )
		);

		expect( url.searchParams.get( SURF_INDEX_PARAM ) ).toBe( '0' );
	} );

	it( 'returns an empty string when the base is not seeded', () => {
		expect( buildSurfIndexUrl( '', 0, 'abc123' ) ).toBe( '' );
	} );

	it( 'returns an empty string when the nonce is not seeded', () => {
		expect( buildSurfIndexUrl( 'https://example.test/', 0, '' ) ).toBe(
			''
		);
	} );
} );
