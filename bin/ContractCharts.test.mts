/**
 * Tests for the Mermaid parse check in `ContractCharts.mts`.
 *
 * Every case is a small chart held in memory, with no filesystem, run through
 * the real Mermaid parser under Vitest's jsdom environment. The broken cases are
 * the ones that kept the contract charts from rendering; each one parses once
 * the offending character is written as a Mermaid entity code.
 */

import { describe, it, expect } from 'vitest';
import { findChartError } from './ContractCharts.mts';

/**
 * Joins chart lines into a Mermaid source.
 *
 * @param lines - The chart's lines, without line breaks.
 * @return The chart's source.
 */
function chart( ...lines: string[] ): string {
	return `${ lines.join( '\n' ) }\n`;
}

// Mermaid is a large module, and its first parse in a fresh worker takes a few
// seconds: enough to overrun Vitest's 5-second default on a busy run.
describe( 'findChartError', { timeout: 30_000 }, () => {
	it( 'accepts a chart Mermaid parses', async () => {
		const source = chart(
			'classDiagram',
			'    RunStore --> BatteryStore : seeds the opening sample on run start'
		);

		expect( await findChartError( source ) ).toBeNull();
	} );

	it( 'reports Mermaid’s own parse error for a second colon in a relation label, and accepts it written as #58;', async () => {
		const label = 'SurfSteerStore --> BehaviorEnd : recognizes bsb';

		expect(
			await findChartError(
				chart( 'classDiagram', `    ${ label }:behaviorEnd` )
			)
		).toMatch( /Parse error/ );
		expect(
			await findChartError(
				chart( 'classDiagram', `    ${ label }#58;behaviorEnd` )
			)
		).toBeNull();
	} );

	it( 'rejects a semicolon in a relation label, and accepts it written as #59;', async () => {
		const label =
			'CourseRouter --> CourseOrderSanitizer : checked before any entry is resolved';

		expect(
			await findChartError(
				chart( 'classDiagram', `    ${ label }; bundled pages stay` )
			)
		).not.toBeNull();
		expect(
			await findChartError(
				chart( 'classDiagram', `    ${ label }#59; bundled pages stay` )
			)
		).toBeNull();
	} );

	it( 'rejects a semicolon in a sequence message, and accepts it written as #59;', async () => {
		const message = 'M->>M: pnpm test:e2e (authenticated server';

		expect(
			await findChartError(
				chart( 'sequenceDiagram', `    ${ message }; separate job)` )
			)
		).not.toBeNull();
		expect(
			await findChartError(
				chart( 'sequenceDiagram', `    ${ message }#59; separate job)` )
			)
		).toBeNull();
	} );

	it( 'rejects a class-body line that closes a parenthesis opened on an earlier line, and accepts it written as #41;', async () => {
		const opening = '        builds and starts SurfLoop (or,';

		expect(
			await findChartError(
				chart(
					'classDiagram',
					'    class EngineBoot {',
					opening,
					'        a SterileHelm instead) once the document has loaded',
					'    }'
				)
			)
		).not.toBeNull();
		expect(
			await findChartError(
				chart(
					'classDiagram',
					'    class EngineBoot {',
					opening,
					'        a SterileHelm instead#41; once the document has loaded',
					'    }'
				)
			)
		).toBeNull();
	} );

	it( 'rejects a class-body line that starts with a parenthesis, and accepts it written as #40; and #41;', async () => {
		expect(
			await findChartError(
				chart(
					'classDiagram',
					'    class BehaviorAnnounce {',
					'        (durationMs) =&gt; void',
					'    }'
				)
			)
		).not.toBeNull();
		expect(
			await findChartError(
				chart(
					'classDiagram',
					'    class BehaviorAnnounce {',
					'        #40;durationMs#41; =&gt; void',
					'    }'
				)
			)
		).toBeNull();
	} );

	it( 'rejects a brace inside a class body, and accepts it written as #123; and #125;', async () => {
		expect(
			await findChartError(
				chart(
					'classDiagram',
					'    class SurfSteerStore {',
					"        posts 'bsb:steerBehavior' ({key}) to the viewport",
					'    }'
				)
			)
		).not.toBeNull();
		expect(
			await findChartError(
				chart(
					'classDiagram',
					'    class SurfSteerStore {',
					"        posts 'bsb:steerBehavior' (#123;key#125;) to the viewport",
					'    }'
				)
			)
		).toBeNull();
	} );
} );
