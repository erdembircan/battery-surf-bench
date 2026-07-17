import { describe, it, expect } from 'vitest';
import {
	isChipDisabled,
	surfCountdownDisplay,
	affordanceGlyphs,
	SURF_BEHAVIOR_KEYS,
	CAUTION_KEY,
} from './SurfSteer';

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

describe( 'affordanceGlyphs', () => {
	it( 'is an em dash when there is no live sterile page', () => {
		expect( affordanceGlyphs( null ) ).toBe( '—' );
	} );

	it( 'concatenates the glyphs for each true flag, in text/image/video order', () => {
		expect(
			affordanceGlyphs( {
				hasVideo: true,
				imageCount: 2,
				textDensity: 0.5,
			} )
		).toBe( '▤▦▶' );
	} );

	it( 'omits a glyph for each false flag', () => {
		expect(
			affordanceGlyphs( {
				hasVideo: false,
				imageCount: 0,
				textDensity: 0,
			} )
		).toBe( '' );

		expect(
			affordanceGlyphs( {
				hasVideo: true,
				imageCount: 0,
				textDensity: 0,
			} )
		).toBe( '▶' );
	} );
} );
