import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end coverage for the theme's `latin-ext` web-font subsets.
 *
 * The theme used to ship only the `latin` subset of each Fontsource family,
 * so Turkish letters (ğ İ ı Ş ş) fell back to a system font mid-word. Every
 * family/weight now declares a second `latin-ext` face with a
 * `unicode-range`. Asking the CSS Font Loading API to load each family for
 * a Turkish sample returns only the faces whose range covers those letters;
 * one of them reaching `loaded` proves both that the served stylesheet
 * declares the `latin-ext` face and that its font file resolves from the
 * build. Probed on the cockpit and on an admin screen, since each bundles
 * the theme separately. The e2e blueprint enables WP_DEBUG_DISPLAY, so a PHP
 * warning or notice prints into the page and fails the test too.
 */

/** PHP error/warning/notice text WordPress prints when WP_DEBUG_DISPLAY is on. */
const PHP_NOTICE = /Warning:|Notice:|Deprecated:|Fatal error:|has no effect/;

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

/** Turkish letters that live in the `latin-ext` subset, not in `latin`. */
const TURKISH_SAMPLE = 'Şğİ';

/** The start of Google Fonts' `latin-ext` unicode-range, as Chromium serializes it. */
const LATIN_EXT_RANGE = /U\+0*100-0*2BA/i;

interface LoadedFace {
	status: string;
	unicodeRange: string;
}

/**
 * Loads the faces of one family/weight that cover the Turkish sample.
 *
 * @param page   - The page whose stylesheets declare the faces.
 * @param family - The font family to load.
 * @param weight - The font weight to load.
 * @return The matching faces' load status and unicode range.
 */
async function loadFacesForTurkish(
	page: Page,
	family: string,
	weight: number
): Promise< LoadedFace[] > {
	return page.evaluate(
		async ( [ fontFamily, fontWeight, sample ] ) => {
			const faces = await document.fonts.load(
				`${ fontWeight } 16px "${ fontFamily }"`,
				sample as string
			);
			return faces.map( ( face ) => ( {
				status: face.status,
				unicodeRange: face.unicodeRange,
			} ) );
		},
		[ family, weight, TURKISH_SAMPLE ] as const
	);
}

/**
 * Asserts every declared family/weight has a loaded `latin-ext` face on the page.
 *
 * @param page - The page under test.
 */
async function expectLatinExtFacesLoaded( page: Page ): Promise< void > {
	for ( const [ family, weight ] of DECLARED_FACES ) {
		const faces = await loadFacesForTurkish( page, family, weight );
		expect(
			faces.some(
				( face ) =>
					face.status === 'loaded' &&
					LATIN_EXT_RANGE.test( face.unicodeRange )
			),
			`${ family } ${ weight }: ${ JSON.stringify( faces ) }`
		).toBe( true );
	}
}

test.describe( 'latin-ext font subsets', () => {
	test( 'the cockpit serves a loadable latin-ext face for every theme font', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbenchSession=cockpit' );
		expect( await page.content() ).not.toMatch( PHP_NOTICE );
		await expectLatinExtFacesLoaded( page );
	} );

	test( 'the sessions admin screen serves a loadable latin-ext face for every theme font', async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/admin.php?page=bsbench-sessions' );
		expect( await page.content() ).not.toMatch( PHP_NOTICE );
		await expectLatinExtFacesLoaded( page );
	} );
} );
