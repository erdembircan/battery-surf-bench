import { describe, it, expect } from 'vitest';
import {
	isChipDisabled,
	isChipGated,
	surfCountdownDisplay,
	pageSlugAt,
	SURF_BEHAVIOR_KEYS,
	CAUTION_KEY,
} from '@/devtools/SurfSteer';

describe( 'SURF_BEHAVIOR_KEYS', () => {
	it( 'lists the nine behaviors in EngineBoot’s own boot order', () => {
		expect( SURF_BEHAVIOR_KEYS ).toEqual( [
			'scrollBurst',
			'readPause',
			'glanceBack',
			'watchVideo',
			'lingerImage',
			'fidgetWiggle',
			'microScroll',
			'selectSnippet',
			'moveOn',
		] );
	} );

	it( 'moveOn is the caution key', () => {
		expect( CAUTION_KEY ).toBe( 'moveOn' );
	} );
} );

describe( 'isChipDisabled', () => {
	const openAffordances = { hasVideo: true, imageCount: 4, textDensity: 1 };

	it( 'is disabled for any key when there is no live sterile page (affordances null)', () => {
		expect(
			isChipDisabled( 'scrollBurst', {
				affordances: null,
				behaviorKey: '',
			} )
		).toBe( true );
	} );

	it( 'is disabled for any key while a behavior is running', () => {
		expect(
			isChipDisabled( 'scrollBurst', {
				affordances: openAffordances,
				behaviorKey: 'readPause',
			} )
		).toBe( true );
	} );

	it.each( [
		[ 'watchVideo', { ...openAffordances, hasVideo: false }, true ],
		[ 'watchVideo', { ...openAffordances, hasVideo: true }, false ],
		[ 'lingerImage', { ...openAffordances, imageCount: 0 }, true ],
		[ 'lingerImage', { ...openAffordances, imageCount: 1 }, false ],
		[ 'readPause', { ...openAffordances, textDensity: 0 }, true ],
		[ 'readPause', { ...openAffordances, textDensity: 0.01 }, false ],
		[ 'selectSnippet', { ...openAffordances, textDensity: 0 }, true ],
		[ 'selectSnippet', { ...openAffordances, textDensity: 0.01 }, false ],
	] as const )(
		'%s gates on its own affordance flag (%o) -> disabled=%s',
		( key, affordances, expected ) => {
			expect(
				isChipDisabled( key, { affordances, behaviorKey: '' } )
			).toBe( expected );
		}
	);

	it.each( [
		'scrollBurst',
		'glanceBack',
		'fidgetWiggle',
		'microScroll',
		'moveOn',
	] )(
		'%s has no affordance gate of its own once a live sterile page exists',
		( key ) => {
			const starved = { hasVideo: false, imageCount: 0, textDensity: 0 };
			expect(
				isChipDisabled( key, { affordances: starved, behaviorKey: '' } )
			).toBe( false );
		}
	);
} );

describe( 'isChipGated', () => {
	const openAffordances = { hasVideo: true, imageCount: 4, textDensity: 1 };

	it( 'is false for every key when there is no live sterile page (affordances null) — gated is a verdict about the page, not the absence of one', () => {
		expect( isChipGated( 'watchVideo', null ) ).toBe( false );
		expect( isChipGated( 'lingerImage', null ) ).toBe( false );
		expect( isChipGated( 'readPause', null ) ).toBe( false );
	} );

	it.each( [
		[ 'watchVideo', { ...openAffordances, hasVideo: false }, true ],
		[ 'watchVideo', { ...openAffordances, hasVideo: true }, false ],
		[ 'lingerImage', { ...openAffordances, imageCount: 0 }, true ],
		[ 'lingerImage', { ...openAffordances, imageCount: 1 }, false ],
		[ 'readPause', { ...openAffordances, textDensity: 0 }, true ],
		[ 'readPause', { ...openAffordances, textDensity: 0.01 }, false ],
		[ 'selectSnippet', { ...openAffordances, textDensity: 0 }, true ],
		[ 'selectSnippet', { ...openAffordances, textDensity: 0.01 }, false ],
	] as const )(
		'%s gates on its own affordance flag (%o) -> gated=%s',
		( key, affordances, expected ) => {
			expect( isChipGated( key, affordances ) ).toBe( expected );
		}
	);

	it.each( [
		'scrollBurst',
		'glanceBack',
		'fidgetWiggle',
		'microScroll',
		'moveOn',
	] )( '%s is never gated, even on a starved page', ( key ) => {
		const starved = { hasVideo: false, imageCount: 0, textDensity: 0 };
		expect( isChipGated( key, starved ) ).toBe( false );
	} );

	it( 'stays true for a gated chip regardless of the panel’s busy/idle state — the gate takes only (key, affordances), never a running key', () => {
		const noVideo = { ...openAffordances, hasVideo: false };

		// isChipGated has no notion of "another behavior is running" at all —
		// unlike isChipDisabled, which layers that on top — so the same
		// (key, affordances) pair always yields the same verdict.
		expect( isChipGated( 'watchVideo', noVideo ) ).toBe( true );
		expect( isChipGated( 'watchVideo', noVideo ) ).toBe( true );
	} );
} );

describe( 'isChipDisabled composing isChipGated', () => {
	it( 'a chip disabled purely by its own gate (live page, idle panel) is also reported gated', () => {
		const noVideo = { hasVideo: false, imageCount: 4, textDensity: 1 };
		const state = { affordances: noVideo, behaviorKey: '' };

		expect( isChipDisabled( 'watchVideo', state ) ).toBe( true );
		expect( isChipGated( 'watchVideo', noVideo ) ).toBe( true );
	} );

	it( 'a chip disabled only because no live page exists is NOT reported gated', () => {
		const state = { affordances: null, behaviorKey: '' };

		expect( isChipDisabled( 'watchVideo', state ) ).toBe( true );
		expect( isChipGated( 'watchVideo', null ) ).toBe( false );
	} );

	it( 'a chip disabled only because another behavior is running (and this chip has no gate of its own) is NOT reported gated', () => {
		const openPage = { hasVideo: true, imageCount: 4, textDensity: 1 };
		const state = { affordances: openPage, behaviorKey: 'readPause' };

		expect( isChipDisabled( 'scrollBurst', state ) ).toBe( true );
		expect( isChipGated( 'scrollBurst', openPage ) ).toBe( false );
	} );
} );

describe( 'surfCountdownDisplay', () => {
	it( 'is empty while idle', () => {
		expect( surfCountdownDisplay( '', null ) ).toBe( '' );
	} );

	it( 'formats "key · MM:SS" while a duration counts down, zero-padded', () => {
		expect( surfCountdownDisplay( 'readPause', 8000 ) ).toBe(
			'readPause · 00:08'
		);
		expect( surfCountdownDisplay( 'watchVideo', 65000 ) ).toBe(
			'watchVideo · 01:05'
		);
	} );

	it( 'reads the bare key for a mechanical behavior with no announced duration', () => {
		expect( surfCountdownDisplay( 'scrollBurst', null ) ).toBe(
			'scrollBurst'
		);
	} );

	it( 'never displays a negative remainder', () => {
		expect( surfCountdownDisplay( 'readPause', -500 ) ).toBe(
			'readPause · 00:00'
		);
	} );
} );

describe( 'pageSlugAt', () => {
	const slugs = [ 'article-1', 'gallery', 'article-2', 'video', 'links' ];

	it( 'is an em dash when pageIndex is null', () => {
		expect( pageSlugAt( slugs, null ) ).toBe( '—' );
	} );

	it( 'is an em dash when the slug list is empty, even with a valid index', () => {
		expect( pageSlugAt( [], 0 ) ).toBe( '—' );
	} );

	it( 'resolves the slug at the given index directly, in range', () => {
		expect( pageSlugAt( slugs, 0 ) ).toBe( 'article-1' );
		expect( pageSlugAt( slugs, 3 ) ).toBe( 'video' );
		expect( pageSlugAt( slugs, 4 ) ).toBe( 'links' );
	} );

	it( 'wraps an index beyond the list length via positive modulo, same as CourseRouter', () => {
		expect( pageSlugAt( slugs, 5 ) ).toBe( 'article-1' );
		expect( pageSlugAt( slugs, 7 ) ).toBe( 'article-2' );
	} );

	it( 'wraps a negative index to the list’s tail, same as CourseRouter', () => {
		expect( pageSlugAt( slugs, -1 ) ).toBe( 'links' );
		expect( pageSlugAt( slugs, -5 ) ).toBe( 'article-1' );
		expect( pageSlugAt( slugs, -7 ) ).toBe( 'video' );
	} );

	it( 'resolves correctly for a saved order shorter than the bundled set', () => {
		expect( pageSlugAt( [ 'gallery', 'video' ], 3 ) ).toBe( 'video' );
		expect( pageSlugAt( [ 'gallery', 'video' ], -1 ) ).toBe( 'video' );
	} );
} );
