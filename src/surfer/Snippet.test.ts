import { describe, it, expect } from 'vitest';
import {
	planSnippet,
	snippetSweepMs,
	sweptChars,
	SNIPPET_MIN_CHARS,
	SNIPPET_MAX_CHARS,
	SNIPPET_MS_PER_CHAR,
} from '@/surfer/Snippet';

/**
 * The visible text a plan covers in `text`: its raw slice, with each run of
 * source whitespace collapsed to one space the way the page renders it.
 * @param text
 */
const visibleSnippet = ( text: string ): string => {
	const plan = planSnippet( text );

	if ( ! plan ) {
		throw new Error( 'expected a snippet' );
	}

	return text
		.slice( plan.start, plan.ends[ plan.ends.length - 1 ] )
		.replace( /[ \t\n\f\r]+/g, ' ' );
};

describe( 'planSnippet', () => {
	it( 'returns null when the run holds fewer than SNIPPET_MIN_CHARS visible characters', () => {
		expect( planSnippet( 'x'.repeat( SNIPPET_MIN_CHARS - 1 ) ) ).toBeNull();
		expect(
			planSnippet( `\n\t\t${ 'x'.repeat( SNIPPET_MIN_CHARS - 1 ) }\n\t` )
		).toBeNull();
		expect( planSnippet( '\n\t   \n' ) ).toBeNull();
	} );

	it( 'plans a short run whole, from its first visible character, without its trailing whitespace', () => {
		const sentence = 'A perfectly ordinary sentence of prose.';
		const text = `\n\t\t${ sentence }\n\t`;
		const plan = planSnippet( text );

		expect( plan?.start ).toBe( 3 );
		expect( plan?.ends ).toHaveLength( sentence.length );
		expect( visibleSnippet( text ) ).toBe( sentence );
	} );

	it( 'counts a run of source whitespace as one visible character', () => {
		const rendered =
			'First line of the paragraph continues on the next one.';
		const text =
			'First line of the paragraph\n\t\t\t\tcontinues on the next one.';

		expect( planSnippet( text )?.ends ).toHaveLength( rendered.length );
		expect( visibleSnippet( text ) ).toBe( rendered );
	} );

	it( 'maps every visible character to a raw offset past the one before it', () => {
		const plan = planSnippet( `\n\t${ 'word\n\t\t'.repeat( 10 ) }word` );
		const start = plan?.start ?? 0;
		const ends = plan?.ends ?? [];

		expect( ends.length ).toBeGreaterThan( 0 );
		ends.forEach( ( end, i ) => {
			expect( end ).toBeGreaterThan( i === 0 ? start : ends[ i - 1 ] );
		} );
	} );

	it( 'cuts a long run at its last sentence end within SNIPPET_MAX_CHARS', () => {
		const opening =
			'This opening sentence is long enough to count on its own.';
		const second =
			'A second sentence follows it and still fits inside the cap.';
		const third =
			'A third sentence runs well past the cap so the highlight must stop before it begins.';

		expect( visibleSnippet( `${ opening } ${ second } ${ third }` ) ).toBe(
			`${ opening } ${ second }`
		);
	} );

	it( 'keeps a closing quote with the sentence it ends', () => {
		const quoted = 'He kept repeating the same line: "close the tab."';
		const tail = `Then ${ 'word '.repeat( 40 ).trimEnd() }`;

		expect( visibleSnippet( `${ quoted } ${ tail }` ) ).toBe( quoted );
	} );

	it( 'falls back to the last word end within SNIPPET_MAX_CHARS when no sentence ends there', () => {
		const text = 'word '.repeat( 60 ).trimEnd();
		const snippet = visibleSnippet( text );

		expect( snippet.length ).toBeLessThanOrEqual( SNIPPET_MAX_CHARS );
		expect( snippet.length ).toBeGreaterThan(
			SNIPPET_MAX_CHARS - 'word '.length
		);
		expect( snippet.endsWith( 'word' ) ).toBe( true );
		expect( text[ snippet.length ] ).toBe( ' ' );
	} );

	it( 'ignores a sentence end that would leave fewer than SNIPPET_MIN_CHARS characters', () => {
		const snippet = visibleSnippet(
			`Yes. ${ 'word '.repeat( 60 ).trimEnd() }`
		);

		expect( snippet.length ).toBeGreaterThan(
			SNIPPET_MAX_CHARS - 'word '.length
		);
		expect( snippet.endsWith( 'word' ) ).toBe( true );
	} );

	it( 'cuts a run with no word end in reach mid-word at SNIPPET_MAX_CHARS', () => {
		expect(
			planSnippet( `https://example.com/${ 'a'.repeat( 300 ) }` )?.ends
		).toHaveLength( SNIPPET_MAX_CHARS );
	} );
} );

describe( 'snippetSweepMs', () => {
	it( 'adds exactly SNIPPET_MS_PER_CHAR for every extra visible character', () => {
		expect( snippetSweepMs( 100 ) - snippetSweepMs( 50 ) ).toBeCloseTo(
			50 * SNIPPET_MS_PER_CHAR,
			6
		);
		expect(
			snippetSweepMs( SNIPPET_MAX_CHARS ) -
				snippetSweepMs( SNIPPET_MIN_CHARS )
		).toBeCloseTo(
			( SNIPPET_MAX_CHARS - SNIPPET_MIN_CHARS ) * SNIPPET_MS_PER_CHAR,
			6
		);
	} );

	it( 'takes no time to sweep nothing', () => {
		expect( snippetSweepMs( 0 ) ).toBe( 0 );
	} );
} );

describe( 'sweptChars', () => {
	const lengths = [ 3, SNIPPET_MIN_CHARS, SNIPPET_MAX_CHARS ];

	it( 'rises from 0 to exactly the full length when the sweep ends, and holds there', () => {
		for ( const chars of lengths ) {
			const total = snippetSweepMs( chars );

			expect( sweptChars( -10, chars ) ).toBe( 0 );
			expect( sweptChars( 0, chars ) ).toBe( 0 );
			expect( sweptChars( total, chars ) ).toBe( chars );
			expect( sweptChars( total + 500, chars ) ).toBe( chars );
		}
	} );

	it( 'never moves backwards', () => {
		for ( const chars of lengths ) {
			const total = snippetSweepMs( chars );
			let previous = 0;

			for ( let ms = 0; ms <= total; ms += 1 ) {
				const covered = sweptChars( ms, chars );
				expect( covered ).toBeGreaterThanOrEqual( previous );
				previous = covered;
			}
		}
	} );

	it( 'cruises at the same pace whatever the snippet length', () => {
		const coveredBetween = ( chars: number ): number =>
			sweptChars( 500, chars ) - sweptChars( 300, chars );

		expect( coveredBetween( 40 ) ).toBeCloseTo(
			coveredBetween( SNIPPET_MAX_CHARS ),
			6
		);
		expect( coveredBetween( 40 ) ).toBeCloseTo(
			200 / SNIPPET_MS_PER_CHAR,
			6
		);
	} );

	it( 'eases up from rest and back down instead of starting or stopping at full pace', () => {
		const total = snippetSweepMs( SNIPPET_MAX_CHARS );
		const cruiseCovers = 50 / SNIPPET_MS_PER_CHAR;

		expect( sweptChars( 50, SNIPPET_MAX_CHARS ) ).toBeGreaterThan( 0 );
		expect( sweptChars( 50, SNIPPET_MAX_CHARS ) ).toBeLessThan(
			cruiseCovers
		);
		expect(
			SNIPPET_MAX_CHARS - sweptChars( total - 50, SNIPPET_MAX_CHARS )
		).toBeLessThan( cruiseCovers );
	} );
} );
