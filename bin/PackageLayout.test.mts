/**
 * Tests for the build's shared layout in `PackageLayout.mts`: which zip each
 * variant writes, and how a packaging step reads its variant.
 */

import { describe, it, expect } from 'vitest';
import { variantFrom, zipFileFor } from './PackageLayout.mts';

describe( 'zipFileFor', () => {
	it( 'writes the production zip under the plugin slug alone', () => {
		expect( zipFileFor( 'production' ) ).toBe(
			'zip/battery-surf-bench.zip'
		);
	} );

	it( 'marks the development zip in its name', () => {
		expect( zipFileFor( 'development' ) ).toBe(
			'zip/battery-surf-bench-development.zip'
		);
	} );
} );

describe( 'variantFrom', () => {
	it( 'reads the production flag', () => {
		expect( variantFrom( [ '--production' ] ) ).toBe( 'production' );
	} );

	it( 'reads the development flag', () => {
		expect( variantFrom( [ '--development' ] ) ).toBe( 'development' );
	} );

	it( 'ignores arguments that are not a variant flag', () => {
		expect( variantFrom( [ '--', '--production', 'extra' ] ) ).toBe(
			'production'
		);
	} );

	it( 'refuses a missing variant', () => {
		expect( variantFrom( [] ) ).toBeNull();
	} );

	it( 'refuses both variants at once', () => {
		expect( variantFrom( [ '--development', '--production' ] ) ).toBeNull();
	} );
} );
