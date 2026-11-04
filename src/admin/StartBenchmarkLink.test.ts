/**
 * Tests for the Start Benchmark admin-menu link upgrade.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { upgradeStartBenchmarkLink } from '@/admin/StartBenchmarkLink';

const config = {
	menuSlug: 'bsbench-start-benchmark',
	cockpitHref: 'https://example.test/?bsbenchSession=cockpit',
};

describe( 'upgradeStartBenchmarkLink', () => {
	beforeEach( () => {
		document.body.innerHTML = '';
	} );

	it( 'rewrites the matching menu link to open the cockpit in a new tab', () => {
		document.body.innerHTML = `
			<div id="adminmenu">
				<a href="/wp-admin/admin.php?page=bsbench-sessions">Sessions</a>
				<a href="/wp-admin/admin.php?page=bsbench-start-benchmark">Start Benchmark</a>
			</div>
		`;

		upgradeStartBenchmarkLink( document, config );

		const links =
			document.querySelectorAll< HTMLAnchorElement >( '#adminmenu a' );
		const [ unrelated, upgraded ] = Array.from( links );

		expect( upgraded.href ).toBe( config.cockpitHref );
		expect( upgraded.target ).toBe( '_blank' );
		expect( upgraded.rel ).toBe( 'noopener noreferrer' );

		// The unrelated link is left completely untouched.
		expect( unrelated.getAttribute( 'href' ) ).toBe(
			'/wp-admin/admin.php?page=bsbench-sessions'
		);
		expect( unrelated.target ).toBe( '' );
		expect( unrelated.rel ).toBe( '' );
	} );

	it( 'is a safe no-op when the link is missing', () => {
		document.body.innerHTML = '<div id="adminmenu"></div>';

		expect( () =>
			upgradeStartBenchmarkLink( document, config )
		).not.toThrow();
	} );
} );
