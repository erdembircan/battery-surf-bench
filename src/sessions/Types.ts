/**
 * Shared types for the benchmark sessions DataViews screen.
 */

/**
 * How a session field should be rendered in the listing. The PHP schema picks
 * the format; the field builder maps it to a DataViews type and renderer.
 */
export type SessionFieldFormat =
	| 'text'
	| 'status'
	| 'datetime'
	| 'percent'
	| 'percentText'
	| 'percentOptional'
	| 'rate'
	| 'runtime'
	| 'browser';

/**
 * A single selectable value for an enumerated session field, as DataViews
 * expects its `elements`.
 */
export interface SessionFieldElement {
	value: string;
	label: string;
}

/**
 * A session field as the PHP schema describes it to the screen: the meta key
 * the REST record exposes, a label, a display format, and — for enumerations —
 * the selectable values.
 */
export interface SessionFieldDescriptor {
	key: string;
	label: string;
	format: SessionFieldFormat;
	elements?: SessionFieldElement[];
}

/**
 * The configuration the PHP screen localizes for the front end: the post type
 * to query, the field descriptors, which fields are visible by default, and
 * where a session opens (the detail page's URL and the parameter carrying the
 * session id).
 */
export interface SessionsConfig {
	postType: string;
	fields: SessionFieldDescriptor[];
	defaultColumns: string[];
	detailUrl: string;
	detailParam: string;
}

/**
 * A benchmark session as the post type's REST endpoint returns it. Only the
 * parts the listing reads are described; every datum lives under `meta`.
 */
export interface SessionRecord {
	id: number;
	title?: { rendered?: string };
	status?: string;
	date?: string;
	meta: Record< string, unknown >;
}

declare global {
	interface Window {
		bsbenchSessions?: SessionsConfig;
	}
}
