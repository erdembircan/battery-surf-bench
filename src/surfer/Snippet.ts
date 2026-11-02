/**
 * What `DomMotor.selectSnippet` highlights, and how fast. A snippet is the
 * opening of a text run, measured in visible characters — a run of source
 * whitespace (indentation, a hard-wrapped line) renders as a single space,
 * so it counts as one — and the sweep across it keeps a steady pace: it
 * eases up from rest to {@link SNIPPET_MS_PER_CHAR}, cruises there, and
 * eases back down, so every snippet is highlighted at the same speed and a
 * longer one simply takes longer.
 */

/**
 * The fewest visible characters worth highlighting: a shorter text run is
 * never picked, and a long one is never cut shorter than this.
 */
export const SNIPPET_MIN_CHARS = 21;

/**
 * The most visible characters one highlight covers — about two lines of
 * article prose — so a long paragraph gives up its opening sentences rather
 * than a sweep that runs on for many seconds.
 */
export const SNIPPET_MAX_CHARS = 160;

/**
 * The sweep's cruise pace, in ms per visible character: 50 characters a
 * second, a deliberate drag the eye can follow.
 */
export const SNIPPET_MS_PER_CHAR = 20;

/**
 * How long the sweep takes to reach its cruise pace from rest, and to settle
 * back to rest at the end.
 */
const SNIPPET_RAMP_MS = 200;

/** The ramps' constant acceleration, in visible characters per ms². */
const RAMP_ACCEL = 1 / ( SNIPPET_MS_PER_CHAR * SNIPPET_RAMP_MS );

/**
 * Source whitespace a page collapses when it renders: space, tab, line feed,
 * form feed and carriage return.
 */
const COLLAPSIBLE_SPACE = /[ \t\n\f\r]/;

/**
 * A sentence end in visible text: terminal punctuation, any closing quotes
 * or brackets after it, then a space or the end of the text.
 */
const SENTENCE_END = /[.!?…]["'”’)\]]*(?= |$)/g;

export interface SnippetPlan {
	start: number;
	ends: readonly number[];
}

/**
 * How many of `visible`'s characters the snippet keeps: all of them when
 * they fit within {@link SNIPPET_MAX_CHARS}, else up to the last sentence
 * end within that cap, else up to the last word end within it, else exactly
 * the cap — never fewer than {@link SNIPPET_MIN_CHARS}.
 * @param visible
 */
const snippetLength = ( visible: string ): number => {
	if ( visible.length <= SNIPPET_MAX_CHARS ) {
		return visible.length;
	}

	let sentenceEnd = 0;

	for ( const match of visible.matchAll( SENTENCE_END ) ) {
		const end = match.index + match[ 0 ].length;

		if ( end >= SNIPPET_MIN_CHARS && end <= SNIPPET_MAX_CHARS ) {
			sentenceEnd = end;
		}
	}

	if ( sentenceEnd > 0 ) {
		return sentenceEnd;
	}

	for ( let i = SNIPPET_MAX_CHARS; i >= SNIPPET_MIN_CHARS; i-- ) {
		if ( visible[ i ] === ' ' ) {
			return i;
		}
	}

	return SNIPPET_MAX_CHARS;
};

/**
 * Plans the snippet to highlight in a text node's raw `text`. It starts at
 * the first visible character and covers the whole run, trailing whitespace
 * aside, when that fits within {@link SNIPPET_MAX_CHARS}; a longer run is
 * cut at its last sentence end within that cap, else at its last word end
 * within it, and only a run with no word end in reach is cut mid-word at the
 * cap — never leaving fewer than {@link SNIPPET_MIN_CHARS}. `start` is the
 * raw offset the snippet begins at; `ends` holds the raw offset just past
 * each of its visible characters in order (a whitespace run's entry is the
 * end of the whole run), so a sweep can count its progress in visible
 * characters and still place the selection's end in the raw text. Returns
 * null when the run holds fewer than {@link SNIPPET_MIN_CHARS} visible
 * characters.
 * @param text
 */
export const planSnippet = ( text: string ): SnippetPlan | null => {
	let start = 0;

	while ( start < text.length && COLLAPSIBLE_SPACE.test( text[ start ] ) ) {
		start++;
	}

	const ends: number[] = [];
	let visible = '';

	for ( let i = start; i < text.length; i++ ) {
		if ( ! COLLAPSIBLE_SPACE.test( text[ i ] ) ) {
			visible += text[ i ];
			ends.push( i + 1 );
		} else if ( COLLAPSIBLE_SPACE.test( text[ i - 1 ] ) ) {
			ends[ ends.length - 1 ] = i + 1;
		} else {
			visible += ' ';
			ends.push( i + 1 );
		}
	}

	if ( visible.endsWith( ' ' ) ) {
		visible = visible.slice( 0, -1 );
		ends.pop();
	}

	if ( visible.length < SNIPPET_MIN_CHARS ) {
		return null;
	}

	return { start, ends: ends.slice( 0, snippetLength( visible ) ) };
};

/**
 * How long the sweep across `chars` visible characters takes, in ms: the
 * time at cruise pace plus one ramp's worth for easing up and back down, so
 * each extra character adds exactly {@link SNIPPET_MS_PER_CHAR}. A snippet
 * too short to reach cruise pace peaks below it and eases straight back.
 * @param chars
 */
export const snippetSweepMs = ( chars: number ): number => {
	if ( chars <= 0 ) {
		return 0;
	}

	return chars * SNIPPET_MS_PER_CHAR >= SNIPPET_RAMP_MS
		? chars * SNIPPET_MS_PER_CHAR + SNIPPET_RAMP_MS
		: 2 * Math.sqrt( chars / RAMP_ACCEL );
};

/**
 * How many of a snippet's `chars` visible characters the sweep has covered
 * `elapsedMs` into it: fractional, rising from 0 to exactly `chars` once
 * {@link snippetSweepMs} has elapsed, and held there after.
 * @param elapsedMs
 * @param chars
 */
export const sweptChars = ( elapsedMs: number, chars: number ): number => {
	const total = snippetSweepMs( chars );

	if ( elapsedMs <= 0 || total <= 0 ) {
		return 0;
	}

	if ( elapsedMs >= total ) {
		return chars;
	}

	const ramp = Math.min( SNIPPET_RAMP_MS, total / 2 );

	if ( elapsedMs <= ramp ) {
		return ( RAMP_ACCEL * elapsedMs * elapsedMs ) / 2;
	}

	if ( elapsedMs < total - ramp ) {
		return (
			( RAMP_ACCEL * ramp * ramp ) / 2 +
			RAMP_ACCEL * ramp * ( elapsedMs - ramp )
		);
	}

	const remaining = total - elapsedMs;

	return chars - ( RAMP_ACCEL * remaining * remaining ) / 2;
};
