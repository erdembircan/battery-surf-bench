/**
 * Coverage for the theme's web-font declarations, asserted the way a browser
 * consumes them: the compiled `@font-face` rules and their `unicode-range`s.
 *
 * The theme once shipped only the `latin` subset of each Fontsource family,
 * so letters outside Latin-1 — the Turkish ğ İ ı Ş ş of the tr_TR
 * translation — fell back to a system font mid-word. Every family/weight
 * must now declare a `latin` and a `latin-ext` face, each with a
 * `unicode-range`, and together those faces must cover every letter the
 * plugin's translations use. The letter set is read from `languages/*.po`,
 * so adding a translation that needs glyphs the fonts don't ship fails here
 * instead of in a screenshot.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { compile } from 'sass';
import { describe, expect, it } from 'vitest';

const THEME_PARTIAL = path.resolve(
	process.cwd(),
	'src/styles/theme/_theme.scss'
);
const LANGUAGES_DIR = path.resolve( process.cwd(), 'languages' );

/** The family/weight pairs the theme declares. */
const DECLARED_FACES: ReadonlyArray< readonly [ string, number ] > = [
	[ 'Anton', 400 ],
	[ 'Hanken Grotesk', 400 ],
	[ 'Hanken Grotesk', 600 ],
	[ 'Hanken Grotesk', 700 ],
	[ 'Space Mono', 700 ],
	[ 'Pacifico', 400 ],
	[ 'Caveat', 700 ],
];

/** The Turkish letters that fell back to a system font before the fix. */
const TURKISH_LETTERS = [ 'ğ', 'Ğ', 'İ', 'ı', 'Ş', 'ş' ];

/** Latin-1 letters from the other translations (de, es, fr, pt). */
const LATIN_1_LETTERS = [ 'ä', 'ß', 'ñ', 'é', 'ç', 'ã', 'ô', 'ü' ];

type CodepointRange = readonly [ number, number ];

interface FontFaceRule {
	family: string;
	weight: number;
	src: string;
	ranges: CodepointRange[];
}

/**
 * Parses a CSS `unicode-range` value into inclusive codepoint intervals.
 *
 * @param value - The raw `unicode-range` value, e.g. `U+0000-00FF, U+0131`.
 * @return The intervals, one per comma-separated token.
 */
function parseUnicodeRange( value: string ): CodepointRange[] {
	return value
		.split( ',' )
		.map( ( token ) => token.trim() )
		.filter( Boolean )
		.map( ( token ) => {
			const match = token.match( /^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/i );
			if ( ! match ) {
				throw new Error(
					`Unsupported unicode-range token: ${ token }`
				);
			}
			const start = parseInt( match[ 1 ], 16 );
			const end = match[ 2 ] ? parseInt( match[ 2 ], 16 ) : start;
			return [ start, end ] as const;
		} );
}

/**
 * Extracts every `@font-face` rule from compiled CSS.
 *
 * @param css - The compiled stylesheet.
 * @return One entry per rule, with its family, weight, `src` and ranges.
 */
function parseFontFaces( css: string ): FontFaceRule[] {
	const rules: FontFaceRule[] = [];
	for ( const block of css.matchAll( /@font-face\s*\{([^}]*)\}/g ) ) {
		const body = block[ 1 ];
		const declaration = ( property: string ): string =>
			body
				.match( new RegExp( `${ property }\\s*:\\s*([^;]+);` ) )?.[ 1 ]
				.trim() ?? '';
		rules.push( {
			family: declaration( 'font-family' ).replace( /^["']|["']$/g, '' ),
			weight: Number( declaration( 'font-weight' ) ),
			src: declaration( 'src' ),
			ranges: parseUnicodeRange( declaration( 'unicode-range' ) ),
		} );
	}
	return rules;
}

/**
 * Whether any of the given faces declares a range containing the codepoint.
 *
 * @param faces     - The faces to search.
 * @param codepoint - The codepoint to look up.
 * @return True when at least one face covers it.
 */
function covers( faces: FontFaceRule[], codepoint: number ): boolean {
	return faces.some( ( face ) =>
		face.ranges.some(
			( [ start, end ] ) => codepoint >= start && codepoint <= end
		)
	);
}

/**
 * Every non-ASCII letter that appears in any shipped `.po` translation.
 *
 * @return The distinct letters, sorted.
 */
function translatedLetters(): string[] {
	const letters = new Set< string >();
	for ( const file of readdirSync( LANGUAGES_DIR ) ) {
		if ( ! file.endsWith( '.po' ) ) {
			continue;
		}
		const text = readFileSync( path.join( LANGUAGES_DIR, file ), 'utf8' );
		for ( const line of text.matchAll(
			/^(?:msgstr(?:\[\d+\])?\s+)?"(.*)"$/gm
		) ) {
			for ( const char of line[ 1 ] ) {
				if ( char.codePointAt( 0 )! > 0x7f && /\p{L}/u.test( char ) ) {
					letters.add( char );
				}
			}
		}
	}
	return [ ...letters ].sort();
}

const faces = parseFontFaces(
	compile( THEME_PARTIAL, { loadPaths: [ path.dirname( THEME_PARTIAL ) ] } )
		.css
);

const facesFor = ( family: string, weight: number ): FontFaceRule[] =>
	faces.filter(
		( face ) => face.family === family && face.weight === weight
	);

describe( 'theme @font-face subsets', () => {
	it.each( DECLARED_FACES )(
		'declares a latin and a latin-ext face for %s %d',
		( family, weight ) => {
			const own = facesFor( family, weight );
			const latin = own.filter( ( face ) =>
				face.src.includes( `-latin-${ weight }-normal.woff2` )
			);
			const latinExt = own.filter( ( face ) =>
				face.src.includes( `-latin-ext-${ weight }-normal.woff2` )
			);
			expect( latin ).toHaveLength( 1 );
			expect( latinExt ).toHaveLength( 1 );
		}
	);

	it( 'gives every face a unicode-range so subsets never shadow each other', () => {
		expect( faces.length ).toBeGreaterThan( 0 );
		for ( const face of faces ) {
			expect(
				face.ranges.length,
				`${ face.family } ${ face.weight }`
			).toBeGreaterThan( 0 );
		}
	} );

	it.each( DECLARED_FACES )(
		'covers the Turkish letters in %s %d',
		( family, weight ) => {
			const own = facesFor( family, weight );
			for ( const letter of TURKISH_LETTERS ) {
				expect( covers( own, letter.codePointAt( 0 )! ), letter ).toBe(
					true
				);
			}
		}
	);

	it.each( DECLARED_FACES )(
		'keeps Latin-1 letters on the latin face of %s %d',
		( family, weight ) => {
			const latin = facesFor( family, weight ).filter( ( face ) =>
				face.src.includes( `-latin-${ weight }-normal.woff2` )
			);
			for ( const letter of LATIN_1_LETTERS ) {
				expect(
					covers( latin, letter.codePointAt( 0 )! ),
					letter
				).toBe( true );
			}
		}
	);

	it( "covers every letter used by the plugin's translations", () => {
		const letters = translatedLetters();
		expect( letters.length ).toBeGreaterThan( 0 );
		for ( const [ family, weight ] of DECLARED_FACES ) {
			const own = facesFor( family, weight );
			const missing = letters.filter(
				( letter ) => ! covers( own, letter.codePointAt( 0 )! )
			);
			expect( missing, `${ family } ${ weight }` ).toEqual( [] );
		}
	} );
} );
