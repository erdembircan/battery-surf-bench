/**
 * Verifies that every architecture contract chart in `docs/contracts/` parses in
 * Mermaid, so a chart can never silently stop rendering. See "Keeping Charts
 * Parseable" in `CLAUDE.md`.
 *
 * Usage: `pnpm contracts:verify` checks every `.mmd` file in `docs/contracts/`;
 * `tsx bin/VerifyContracts.mts <chart.mmd>...` checks only the named files.
 * Mermaid sanitizes labels with DOMPurify, which needs a DOM, so a jsdom window
 * is installed before any chart is checked. Every failing chart is listed with
 * Mermaid's own message, and the exit code is non-zero when there is any.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { findChartError } from './ContractCharts.mts';

/** Where the contract charts live, relative to the repository root. */
const CHARTS_DIR = 'docs/contracts';

/**
 * Lists the charts to check: the files named on the command line, or else every
 * `.mmd` file in the charts folder, in name order.
 *
 * @param args - The command-line arguments after the script path.
 * @return The chart paths to check.
 */
function chartPaths( args: readonly string[] ): string[] {
	if ( args.length > 0 ) {
		return [ ...args ];
	}

	return readdirSync( CHARTS_DIR )
		.filter( ( name ) => name.endsWith( '.mmd' ) )
		.sort()
		.map( ( name ) => join( CHARTS_DIR, name ) );
}

/**
 * Indents every line of an error message for the failure report.
 *
 * @param message - Mermaid's error message.
 * @return The message with each line indented.
 */
function indent( message: string ): string {
	return message
		.split( '\n' )
		.map( ( line ) => `    ${ line }\n` )
		.join( '' );
}

/**
 * Checks the charts and reports the result.
 *
 * @param args - The command-line arguments after the script path.
 * @return The process exit code: 0 when every chart parses, 1 when any does not, 2 when there are no charts to check.
 */
async function main( args: readonly string[] ): Promise< number > {
	const charts = chartPaths( args );

	if ( charts.length === 0 ) {
		process.stderr.write(
			`No contract charts found in ${ CHARTS_DIR }.\n`
		);

		return 2;
	}

	const dom = new JSDOM( '' );
	Object.assign( globalThis, {
		window: dom.window,
		document: dom.window.document,
	} );

	let failures = 0;

	for ( const chart of charts ) {
		const error = await findChartError( readFileSync( chart, 'utf8' ) );

		if ( error !== null ) {
			failures += 1;
			process.stderr.write(
				`✗ ${ chart } does not parse in Mermaid:\n${ indent( error ) }`
			);
		}
	}

	if ( failures > 0 ) {
		process.stderr.write(
			"Mermaid numbers lines only after stripping a chart's front matter and %% comment lines, so its line numbers can run behind the file's.\n"
		);

		return 1;
	}

	process.stdout.write(
		`✓ All ${ charts.length } contract charts parse in Mermaid.\n`
	);

	return 0;
}

process.exitCode = await main( process.argv.slice( 2 ) );
