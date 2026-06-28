/**
 * User-agent display — composes the discrete browser fields a session stores
 * (name, major version and OS) into one human-readable cell for the listing.
 *
 * The backend persists these as separate meta (see `SessionSchema`); how they
 * read is the listing's call, so this module owns that single formatting
 * decision — `Chrome 149 · macOS` — rather than the cockpit baking a display
 * string into storage. It is a pure function over the meta record, so it is
 * unit-tested with fixed inputs.
 */

import type { SessionRecord } from './Types';

/** The meta keys a session stores its discrete browser fields under. */
const META = {
	browser: 'bsb_ua_browser',
	version: 'bsb_ua_version',
	os: 'bsb_ua_os',
} as const;

/** The marker shown when no browser was captured. */
const EM_DASH = '—';

/**
 * Reads a meta value as a trimmed string, or empty when it is not one.
 *
 * @param value The raw meta value.
 * @return The trimmed string, or empty.
 */
function asText( value: unknown ): string {
	return typeof value === 'string' ? value.trim() : '';
}

/**
 * Composes a session's discrete browser meta into one display label, falling
 * back to whichever half was captured and to an em dash when none was.
 *
 * @param meta The session's REST meta record.
 * @return The display label, e.g. `Chrome 149 · macOS`.
 */
export function formatUserAgent( meta: SessionRecord[ 'meta' ] ): string {
	const browser = asText( meta[ META.browser ] );
	const version = asText( meta[ META.version ] );
	const os = asText( meta[ META.os ] );

	const browserLabel = browser
		? `${ browser }${ version ? ` ${ version }` : '' }`
		: '';

	if ( browserLabel && os ) {
		return `${ browserLabel } · ${ os }`;
	}
	return browserLabel || os || EM_DASH;
}
