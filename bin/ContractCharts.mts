/**
 * The parse check behind `pnpm contracts:verify`: runs a chart's source through
 * Mermaid's own parser, so a contract chart in `docs/contracts/` that Mermaid
 * rejects, and that therefore renders nowhere, fails the build instead of going
 * unnoticed.
 *
 * Mermaid sanitizes labels with DOMPurify, which needs a DOM. Vitest's jsdom
 * environment provides one for the tests, and `VerifyContracts.mts` installs one
 * before it checks the charts. Mermaid is imported on first use rather than at
 * module load, so that DOM only has to exist by the time a chart is checked.
 */

import type { Mermaid } from 'mermaid';

/** Mermaid, loaded and configured by the first check, then reused. */
let loaded: Promise< Mermaid > | undefined;

/**
 * Loads Mermaid once, with rendering on page load turned off: this module only
 * ever parses.
 *
 * @return The configured Mermaid API.
 */
function loadMermaid(): Promise< Mermaid > {
	loaded ??= import( 'mermaid' ).then( ( { default: mermaid } ) => {
		mermaid.initialize( { startOnLoad: false } );

		return mermaid;
	} );

	return loaded;
}

/**
 * Parses one chart's source with Mermaid.
 *
 * @param source - The chart's Mermaid source, as stored in its `.mmd` file.
 * @return Null when Mermaid parses the chart, or Mermaid's own error message when it does not.
 */
export async function findChartError(
	source: string
): Promise< string | null > {
	const mermaid = await loadMermaid();

	try {
		await mermaid.parse( source );

		return null;
	} catch ( error ) {
		return error instanceof Error ? error.message : String( error );
	}
}
