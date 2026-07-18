/**
 * Tests for the viewport load guard's pure decision helpers.
 *
 * `isBlankFrame`, `isCoursePageLoaded` and `viewportFailed` are exercised with
 * fake iframes and fake documents rather than a real DOM iframe — the module
 * only ever reads `contentDocument`/`URL` and calls `querySelector` on it, so a
 * plain object standing in for each is enough and keeps the cases fast and
 * explicit.
 */

import { describe, it, expect } from 'vitest';
import {
	COURSE_PAGE_SELECTOR,
	isBlankFrame,
	isCoursePageLoaded,
	viewportFailed,
} from '@/cockpit/PageGuard';

/**
 * A fake `Document` exposing only what the guard reads: `querySelector` (for
 * the course-page marker) and `URL` (for the blank-frame check).
 *
 * @param hasCourseContent Whether the fake document carries the course marker.
 * @param url              The fake document's `URL`, defaulting to a real-looking one.
 */
const fakeDocument = (
	hasCourseContent: boolean,
	url = 'http://test/?bsbSurfIndex=0'
): Document =>
	( {
		URL: url,
		querySelector: ( selector: string ) =>
			hasCourseContent && selector === COURSE_PAGE_SELECTOR
				? ( {} as Element )
				: null,
	} ) as unknown as Document;

describe( 'isBlankFrame', () => {
	it( 'is true when the iframe reference is null', () => {
		expect( isBlankFrame( null ) ).toBe( true );
	} );

	it( 'is true when contentDocument is null', () => {
		expect( isBlankFrame( { contentDocument: null } ) ).toBe( true );
	} );

	it( "is true when the framed document's URL is about:blank", () => {
		expect(
			isBlankFrame( {
				contentDocument: fakeDocument( true, 'about:blank' ),
			} )
		).toBe( true );
	} );

	it( "is true when the framed document's URL is empty", () => {
		expect(
			isBlankFrame( { contentDocument: fakeDocument( true, '' ) } )
		).toBe( true );
	} );

	it( 'is false when the framed document has a real URL', () => {
		expect(
			isBlankFrame( {
				contentDocument: fakeDocument(
					true,
					'http://x/?bsbSurfIndex=0'
				),
			} )
		).toBe( false );
	} );

	it( 'is false when reading contentDocument throws (cross-origin frame)', () => {
		const iframe = {
			get contentDocument(): Document | null {
				throw new DOMException( 'Blocked a frame', 'SecurityError' );
			},
		};

		expect( isBlankFrame( iframe ) ).toBe( false );
	} );
} );

describe( 'isCoursePageLoaded', () => {
	it( 'is false when contentDocument is null', () => {
		expect( isCoursePageLoaded( { contentDocument: null } ) ).toBe( false );
	} );

	it( 'is false when reading contentDocument throws (cross-origin frame)', () => {
		const iframe = {
			get contentDocument(): Document | null {
				throw new DOMException( 'Blocked a frame', 'SecurityError' );
			},
		};

		expect( isCoursePageLoaded( iframe ) ).toBe( false );
	} );

	it( 'is false when the framed document has no .bsb-course-page marker', () => {
		expect(
			isCoursePageLoaded( { contentDocument: fakeDocument( false ) } )
		).toBe( false );
	} );

	it( 'is true when the framed document carries .bsb-course-page', () => {
		expect(
			isCoursePageLoaded( { contentDocument: fakeDocument( true ) } )
		).toBe( true );
	} );
} );

describe( 'viewportFailed', () => {
	it( 'is true on an error event regardless of the iframe', () => {
		expect(
			viewportFailed(
				{ type: 'error' },
				{ contentDocument: fakeDocument( true ) }
			)
		).toBe( true );
	} );

	it( 'is true when the iframe reference is null', () => {
		expect( viewportFailed( { type: 'load' }, null ) ).toBe( true );
	} );

	it( 'is true on a load event that landed on a non-course page', () => {
		expect(
			viewportFailed(
				{ type: 'load' },
				{ contentDocument: fakeDocument( false ) }
			)
		).toBe( true );
	} );

	it( 'is false on a load event that landed on a real course page', () => {
		expect(
			viewportFailed(
				{ type: 'load' },
				{ contentDocument: fakeDocument( true ) }
			)
		).toBe( false );
	} );
} );
