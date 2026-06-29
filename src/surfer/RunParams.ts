/**
 * Run parameters the cockpit hands the in-iframe surf engine through the page
 * URL. The cockpit appends `bsbRun`, `bsbSpeed` and `bsbTraits` to each course
 * page's `src` (see RunStore.currentSrc); this parses and validates them so the
 * engine only ever sees a sane configuration — the same normalizers the cockpit
 * uses, so a hand-crafted URL is corrected rather than trusted.
 */

import { normalizeSpeed, type Speed } from '../cockpit/RunConfig';
import { normalizeTraits } from '../shared/SurferStats';

/** The validated configuration for a surf run on a course page. */
export interface RunParams {
	/** Whether the engine should drive this page (the `bsbRun` flag). */
	armed: boolean;
	/** The demo speed multiplier — fast-forwards every duration. */
	speed: Speed;
	/** The surfer personality vector. */
	traits: number[];
	/** The course page slug (`bsbSessionPage`), e.g. `article-1`. */
	slug: string;
}

/**
 * Parses run parameters from a URL query string. Unarmed (no `bsbRun=1`) when
 * the flag is absent, so a course page viewed directly stays inert.
 * @param search A `location.search` string (with or without the leading `?`).
 */
export const parseRunParams = ( search: string ): RunParams => {
	const params = new URLSearchParams( search );
	const csv = params.get( 'bsbTraits' );

	return {
		armed: params.get( 'bsbRun' ) === '1',
		speed: normalizeSpeed( Number( params.get( 'bsbSpeed' ) ) ),
		traits: normalizeTraits(
			csv === null ? undefined : csv.split( ',' ).map( Number )
		),
		slug: params.get( 'bsbSessionPage' ) ?? '',
	};
};
