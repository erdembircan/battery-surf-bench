/**
 * User-agent parsing — reduces a raw `navigator.userAgent` string to the
 * discrete facts a stored session keeps: the browser name, its major version,
 * and the operating system.
 *
 * The raw user-agent string is noise: long, repetitive boilerplate
 * (`Mozilla/5.0 … AppleWebKit/537.36 (KHTML, like Gecko) …`) that says nothing
 * at a glance about what ran the benchmark. This module is the single place that
 * extracts the three fields worth keeping, so a session persists structured data
 * rather than a dump — and never a pre-formatted display string, leaving how
 * those parts read entirely to the listing. It is a pure function over a string,
 * so it is unit-tested with fixed inputs.
 */

/** The discrete browser facts parsed from a user-agent string. */
export interface UserAgentInfo {
	/** The browser display name (e.g. `Chrome`), or empty when unrecognised. */
	browser: string;
	/** The browser major version (e.g. `149`), or empty when unrecognised. */
	version: string;
	/** The operating system (e.g. `macOS`), or empty when unrecognised. */
	os: string;
}

/**
 * Browser token patterns, in precedence order. Many user agents carry several
 * engine tokens for compatibility (a Chrome string also names Safari; Edge and
 * Opera also name Chrome), so the first match wins and the more specific brands
 * are tested before the generic ones they impersonate. Each pattern captures the
 * major version in group 1.
 */
const BROWSERS: ReadonlyArray< { name: string; token: RegExp } > = [
	{ name: 'Edge', token: /Edg(?:A|iOS)?\/(\d+)/ },
	{ name: 'Samsung Internet', token: /SamsungBrowser\/(\d+)/ },
	{ name: 'Opera', token: /(?:OPR|Opera)\/(\d+)/ },
	{ name: 'Firefox', token: /(?:Firefox|FxiOS)\/(\d+)/ },
	{ name: 'Chrome', token: /(?:Chrome|CriOS)\/(\d+)/ },
	{
		name: 'Safari',
		token: /Version\/(\d+)[\d.]* (?:Mobile\/[\w.]+ )?Safari/,
	},
];

/**
 * Identifies the browser name and major version from a user-agent string.
 *
 * @param ua The raw user-agent string.
 * @return The name and version, both empty when none is recognised.
 */
function findBrowser( ua: string ): { name: string; version: string } {
	for ( const candidate of BROWSERS ) {
		const match = ua.match( candidate.token );
		if ( match ) {
			return { name: candidate.name, version: match[ 1 ] };
		}
	}
	return { name: '', version: '' };
}

/**
 * Identifies the operating system from a user-agent string. Android is tested
 * before Linux (an Android string also names Linux) and the mobile Apple
 * platforms before macOS, so each platform resolves to its most specific label.
 *
 * @param ua The raw user-agent string.
 * @return The OS label, or empty when none is recognised.
 */
function findOs( ua: string ): string {
	if ( /Windows NT/.test( ua ) ) {
		return 'Windows';
	}
	if ( /Android/.test( ua ) ) {
		return 'Android';
	}
	if ( /(iPhone|iPad|iPod)/.test( ua ) ) {
		return 'iOS';
	}
	if ( /CrOS/.test( ua ) ) {
		return 'ChromeOS';
	}
	if ( /Mac OS X/.test( ua ) ) {
		return 'macOS';
	}
	if ( /Linux/.test( ua ) ) {
		return 'Linux';
	}
	return '';
}

/**
 * Parses a raw user-agent string into its discrete browser, version and OS
 * fields. Each unrecognised field is an empty string, so the caller stores a
 * known-empty datum rather than guessing.
 *
 * @param ua The raw `navigator.userAgent` string.
 * @return The discrete browser facts.
 */
export function parseUserAgent( ua: string ): UserAgentInfo {
	const raw = ua?.trim() ?? '';
	if ( raw === '' ) {
		return { browser: '', version: '', os: '' };
	}

	const { name, version } = findBrowser( raw );
	return { browser: name, version, os: findOs( raw ) };
}
