/**
 * Tests for the plugin zip contract in `PackageRules.mts`.
 *
 * The rules read only entry names, and the production zip's scripts, so every
 * case is a plain list shaped like `unzip -Z1` output: no zip, no filesystem.
 */

import { describe, it, expect } from 'vitest';
import {
	findDevToolsCode,
	findPackageViolations,
	findSizeViolations,
} from './PackageRules.mts';

/** The one top-level folder every entry of a well-formed zip sits in. */
const FOLDER = 'battery-surf-bench/';

/** Paths in a clean production zip, inside the plugin folder. */
const PRODUCTION_FILES = [
	'LICENSE',
	'battery-surf-bench.php',
	'composer.json',
	'readme.txt',
	'build/cockpit/view.js',
	'includes/Core/Config.php',
	'languages/battery-surf-bench-fr_FR.l10n.php',
	'vendor/autoload.php',
];

/** The dev-tools panel's files a development zip must carry. */
const DEV_TOOLS_FILES = [
	'includes/DevTools/DevTools.php',
	'build/devtools/view.js',
	'build/style-devtools.css',
];

/** Paths in a clean development zip, inside the plugin folder. */
const DEVELOPMENT_FILES = [ ...PRODUCTION_FILES, ...DEV_TOOLS_FILES ];

/**
 * Returns the zip entry names for paths inside the plugin folder.
 *
 * @param paths - Paths relative to the plugin folder, such as `includes/Plugin.php`.
 * @return The entry names as `unzip -Z1` lists them.
 */
function packed( paths: readonly string[] ): string[] {
	return paths.map( ( path ) => `${ FOLDER }${ path }` );
}

describe( 'findPackageViolations', () => {
	it( 'accepts a production zip that ships only plugin files', () => {
		expect(
			findPackageViolations( packed( PRODUCTION_FILES ), {
				variant: 'production',
			} )
		).toEqual( [] );
	} );

	it( 'accepts a development zip with the dev-tools panel', () => {
		expect(
			findPackageViolations( packed( DEVELOPMENT_FILES ), {
				variant: 'development',
			} )
		).toEqual( [] );
	} );

	it( 'accepts folder entries alongside file entries', () => {
		expect(
			findPackageViolations(
				[
					FOLDER,
					...packed( [
						...PRODUCTION_FILES,
						'languages/',
						'includes/Core/',
					] ),
				],
				{ variant: 'production' }
			)
		).toEqual( [] );
	} );

	it( 'flags each entry outside the plugin folder once, by its top-level name', () => {
		const violations = findPackageViolations(
			[
				...packed( PRODUCTION_FILES ),
				'readme.txt',
				'__MACOSX/battery-surf-bench/._LICENSE',
				'__MACOSX/._battery-surf-bench',
			],
			{ variant: 'production' }
		);

		expect( violations ).toHaveLength( 2 );
		expect( violations ).toEqual(
			expect.arrayContaining( [
				expect.stringContaining(
					'Entry "readme.txt" is outside the "battery-surf-bench/" folder'
				),
				expect.stringContaining(
					'Entry "__MACOSX" is outside the "battery-surf-bench/" folder'
				),
			] )
		);
	} );

	it( 'flags a zip with the plugin files at its root by its outside entries alone', () => {
		const violations = findPackageViolations( PRODUCTION_FILES, {
			variant: 'production',
		} );

		expect( violations ).toHaveLength( 8 );
		expect( violations ).toEqual(
			expect.arrayContaining( [
				expect.stringContaining(
					'Entry "battery-surf-bench.php" is outside'
				),
				expect.stringContaining( 'Entry "includes" is outside' ),
				expect.stringContaining( 'Entry "vendor" is outside' ),
			] )
		);
		expect( violations.join( '\n' ) ).not.toContain(
			'Missing required entry'
		);
	} );

	it( 'flags a plugin folder with another name', () => {
		const violations = findPackageViolations(
			PRODUCTION_FILES.map(
				( path ) => `battery-surf-bench-main/${ path }`
			),
			{ variant: 'production' }
		);

		expect( violations ).toEqual( [
			expect.stringContaining(
				'Entry "battery-surf-bench-main" is outside the "battery-surf-bench/" folder'
			),
		] );
	} );

	it( 'flags each unexpected entry in the plugin folder once', () => {
		const violations = findPackageViolations(
			packed( [
				...PRODUCTION_FILES,
				'.github/workflows/checks.yml',
				'.github/actions/setup-php/action.yml',
				'bin/Assemble.mts',
				'.wordpress-org/icon-256x256.png',
			] ),
			{ variant: 'production' }
		);

		expect( violations ).toHaveLength( 3 );
		expect( violations ).toEqual(
			expect.arrayContaining( [
				expect.stringContaining(
					'Unexpected entry ".github" in the plugin folder'
				),
				expect.stringContaining(
					'Unexpected entry "bin" in the plugin folder'
				),
				expect.stringContaining(
					'Unexpected entry ".wordpress-org" in the plugin folder'
				),
			] )
		);
	} );

	it( 'flags hidden files inside shipped folders', () => {
		const violations = findPackageViolations(
			packed( [
				...PRODUCTION_FILES,
				'includes/.DS_Store',
				'languages/.gitkeep',
			] ),
			{ variant: 'production' }
		);

		expect( violations ).toHaveLength( 2 );
		expect( violations ).toEqual(
			expect.arrayContaining( [
				expect.stringContaining( '"includes/.DS_Store"' ),
				expect.stringContaining( '"languages/.gitkeep"' ),
			] )
		);
	} );

	it( 'flags a hidden folder inside a shipped folder once', () => {
		const violations = findPackageViolations(
			packed( [
				...PRODUCTION_FILES,
				'includes/.cache/one.php',
				'includes/.cache/two.php',
			] ),
			{ variant: 'production' }
		);

		expect( violations ).toEqual( [
			expect.stringContaining( '"includes/.cache"' ),
		] );
	} );

	it( 'leaves hidden files under vendor/ alone', () => {
		expect(
			findPackageViolations(
				packed( [
					...PRODUCTION_FILES,
					'vendor/psr/container/.gitattributes',
				] ),
				{ variant: 'production' }
			)
		).toEqual( [] );
	} );

	it( 'flags a missing required plugin file', () => {
		expect(
			findPackageViolations(
				packed(
					PRODUCTION_FILES.filter( ( path ) => path !== 'readme.txt' )
				),
				{ variant: 'production' }
			)
		).toEqual( [ 'Missing required entry "readme.txt".' ] );
	} );

	it( 'requires the compiled bundles and vendor/ in every zip', () => {
		const violations = findPackageViolations(
			packed(
				PRODUCTION_FILES.filter(
					( path ) =>
						! path.startsWith( 'build/' ) &&
						! path.startsWith( 'vendor/' )
				)
			),
			{ variant: 'production' }
		);

		expect( violations ).toHaveLength( 2 );
		expect( violations ).toEqual(
			expect.arrayContaining( [
				'Missing required entry "build".',
				'Missing required entry "vendor".',
			] )
		);
	} );

	it( 'flags vendor/ shipped without composer.json', () => {
		const violations = findPackageViolations(
			packed(
				PRODUCTION_FILES.filter( ( path ) => path !== 'composer.json' )
			),
			{ variant: 'production' }
		);

		expect( violations ).toHaveLength( 1 );
		expect( violations[ 0 ] ).toContain( 'composer.json' );
	} );

	it( 'flags a version-control folder inside vendor/', () => {
		expect(
			findPackageViolations(
				packed( [
					...PRODUCTION_FILES,
					'vendor/psr/container/.git/HEAD',
				] ),
				{ variant: 'production' }
			)
		).toEqual( [
			expect.stringContaining( '"vendor/psr/container/.git"' ),
		] );
	} );

	it( 'reports a version-control folder outside vendor/ as one, not also as hidden', () => {
		const violations = findPackageViolations(
			packed( [ ...PRODUCTION_FILES, 'includes/.svn/entries' ] ),
			{ variant: 'production' }
		);

		expect( violations ).toEqual( [
			expect.stringContaining( 'Version-control folder "includes/.svn"' ),
		] );
	} );

	it( 'flags a version-control folder entry', () => {
		expect(
			findPackageViolations(
				packed( [ ...PRODUCTION_FILES, 'languages/.hg/' ] ),
				{ variant: 'production' }
			)
		).toEqual( [
			expect.stringContaining( 'Version-control folder "languages/.hg"' ),
		] );
	} );

	it( 'flags archive and shell files, whatever their case', () => {
		const violations = findPackageViolations(
			packed( [
				...PRODUCTION_FILES,
				'includes/tools/setup.sh',
				'includes/archive.ZIP',
				'build/bundle.tar',
			] ),
			{ variant: 'production' }
		);

		expect( violations ).toEqual( [
			expect.stringContaining( 'contains a .sh file' ),
			expect.stringContaining( 'contains a .zip file' ),
			expect.stringContaining( 'contains a .tar file' ),
		] );
	} );

	it( 'flags a script under vendor/', () => {
		expect(
			findPackageViolations(
				packed( [ ...PRODUCTION_FILES, 'vendor/bin/install.sh' ] ),
				{ variant: 'production' }
			)
		).toEqual( [ expect.stringContaining( '"vendor/bin/install.sh"' ) ] );
	} );

	it( 'judges a file by its last extension', () => {
		expect(
			findPackageViolations(
				packed( [ ...PRODUCTION_FILES, 'includes/notes.zip.txt' ] ),
				{ variant: 'production' }
			)
		).toEqual( [] );
	} );

	it( 'flags assets/, whose images the stylesheets inline', () => {
		expect(
			findPackageViolations(
				packed( [
					...PRODUCTION_FILES,
					'assets/images/menu-icon.svg',
				] ),
				{ variant: 'production' }
			)
		).toEqual( [
			expect.stringContaining(
				'Unexpected entry "assets" in the plugin folder'
			),
		] );
	} );

	it( 'flags translation sources but keeps the compiled translations', () => {
		const violations = findPackageViolations(
			packed( [
				...DEVELOPMENT_FILES,
				'languages/battery-surf-bench-fr_FR.po',
				'languages/battery-surf-bench.pot',
			] ),
			{ variant: 'development' }
		);

		expect( violations ).toEqual( [
			expect.stringContaining(
				'Unneeded file "languages/battery-surf-bench-fr_FR.po"'
			),
			expect.stringContaining(
				'Unneeded file "languages/battery-surf-bench.pot"'
			),
		] );
	} );

	it( 'flags every dev-tools file in the production zip', () => {
		const devTools = [
			'includes/DevTools/DevTools.php',
			'includes/DevTools/Views/Templates/DevToolsPanel.php',
			'build/devtools/view.js',
			'build/devtools.js',
			'build/devtools.asset.php',
			'build/style-devtools.css',
		];
		const violations = findPackageViolations(
			packed( [ ...PRODUCTION_FILES, ...devTools ] ),
			{ variant: 'production' }
		);

		expect( violations ).toEqual(
			devTools.map( ( path ) =>
				expect.stringContaining(
					`Dev-tools file "${ path }" in the production zip`
				)
			)
		);
	} );

	it( 'keeps every dev-tools file in the development zip', () => {
		expect(
			findPackageViolations(
				packed( [
					...DEVELOPMENT_FILES,
					'includes/DevTools/Views/Templates/DevToolsPanel.php',
					'build/devtools/view.asset.php',
				] ),
				{ variant: 'development' }
			)
		).toEqual( [] );
	} );

	it( 'requires the dev-tools panel in the development zip', () => {
		const violations = findPackageViolations( packed( PRODUCTION_FILES ), {
			variant: 'development',
		} );

		expect( violations ).toEqual(
			DEV_TOOLS_FILES.map( ( path ) =>
				expect.stringContaining( `Missing dev-tools file "${ path }"` )
			)
		);
	} );

	it( 'keeps files whose names only start like the dev tools', () => {
		expect(
			findPackageViolations(
				packed( [
					...PRODUCTION_FILES,
					'includes/DevToolsHelper.php',
					'build/devtoolsish.js',
				] ),
				{ variant: 'production' }
			)
		).toEqual( [] );
	} );
} );

describe( 'findDevToolsCode', () => {
	it( 'flags a production script that carries the sterile-run parameter', () => {
		expect(
			findDevToolsCode(
				[
					{
						path: 'build/surfer.js',
						content: 'const p="bsbenchSterile";',
					},
				],
				{ variant: 'production' }
			)
		).toEqual( [
			expect.stringContaining(
				'Script "build/surfer.js" carries dev-tools code (it contains "bsbenchSterile")'
			),
		] );
	} );

	it( 'flags a production script that carries the sterile steering', () => {
		expect(
			findDevToolsCode(
				[
					{
						path: 'build/surfer.js',
						content: 'if(t.type!=="bsb:steerBehavior")return;',
					},
				],
				{ variant: 'production' }
			)
		).toEqual( [
			expect.stringContaining(
				'Script "build/surfer.js" carries dev-tools code (it contains "bsb:steerBehavior")'
			),
		] );
	} );

	it( 'flags a production script that reads the shared dev-tools state', () => {
		expect(
			findDevToolsCode(
				[
					{
						path: 'build/cockpit/view.js',
						content: 'const s=e.devtools?.surf;',
					},
				],
				{ variant: 'production' }
			)
		).toEqual( [
			expect.stringContaining(
				'Script "build/cockpit/view.js" carries dev-tools code (it contains ".devtools")'
			),
		] );
	} );

	it( 'accepts production scripts without dev-tools code', () => {
		expect(
			findDevToolsCode(
				[
					{
						path: 'build/cockpit/view.js',
						content: 'syncDevtoolsSurf(){}',
					},
				],
				{ variant: 'production' }
			)
		).toEqual( [] );
	} );

	it( 'never checks the development zip, which carries that code on purpose', () => {
		expect(
			findDevToolsCode(
				[
					{
						path: 'build/surfer.js',
						content: 'const p="bsbenchSterile";',
					},
				],
				{ variant: 'development' }
			)
		).toEqual( [] );
	} );
} );

describe( 'findSizeViolations', () => {
	it( 'accepts a production zip under 10 MB', () => {
		expect(
			findSizeViolations( 9_999_999, { variant: 'production' } )
		).toEqual( [] );
	} );

	it( 'flags a production zip of 10 MB or more', () => {
		expect(
			findSizeViolations( 10_000_000, { variant: 'production' } )
		).toEqual( [ expect.stringContaining( 'Zip is 10.0 MB' ) ] );
	} );

	it( 'does not hold the development zip to the limit', () => {
		expect(
			findSizeViolations( 50_000_000, { variant: 'development' } )
		).toEqual( [] );
	} );
} );
