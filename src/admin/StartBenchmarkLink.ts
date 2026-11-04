/**
 * Progressively enhances the "Start Benchmark" admin-menu link so it opens
 * the cockpit dashboard in a new tab, matching the admin bar's native
 * `target=_blank` node. The server-rendered link still points at the plugin's
 * own submenu page, which redirects to the cockpit server-side — the
 * no-JavaScript fallback this script upgrades past.
 */

interface StartBenchmarkConfig {
	menuSlug: string;
	cockpitHref: string;
}

declare global {
	interface Window {
		bsbenchStartBenchmark?: StartBenchmarkConfig;
	}
}

/**
 * Rewrites the Start Benchmark admin-menu link to open the cockpit in a new
 * tab. Scoped to `#adminmenu` so it never touches the admin bar's own node.
 *
 * @param doc    The document to search for the admin-menu link.
 * @param config The menu slug to match and the cockpit URL to rewrite it to.
 */
export function upgradeStartBenchmarkLink(
	doc: Document,
	config: StartBenchmarkConfig
): void {
	const link = doc.querySelector< HTMLAnchorElement >(
		`#adminmenu a[href*="page=${ config.menuSlug }"]`
	);

	if ( ! link ) {
		return;
	}

	link.href = config.cockpitHref;
	link.target = '_blank';
	link.rel = 'noopener noreferrer';
}

const config = window.bsbenchStartBenchmark;

if ( config ) {
	upgradeStartBenchmarkLink( document, config );
}
