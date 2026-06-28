/**
 * User-agent description — distills a raw `navigator.userAgent` string into a
 * short, human-readable label naming the browser (with major version) and the
 * operating system, e.g. `Chrome 149 · macOS`.
 *
 * The raw user-agent string is noise in the session listing: long, repetitive
 * boilerplate (`Mozilla/5.0 … AppleWebKit/537.36 (KHTML, like Gecko) …`) that
 * says nothing at a glance about what ran the benchmark. This module is the
 * single place that reduces it to the two facts that matter for a run — which
 * browser, and which OS — so a stored session carries that label instead of the
 * dump. It is a pure function over a string, so it is unit-tested with fixed
 * inputs.
 */

/** A detected browser: its display name and major version. */
interface BrowserHit {
	name: string;
	version: string;
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
 * Identifies the browser and its major version from a user-agent string.
 *
 * @param ua The raw user-agent string.
 * @return The matched browser, or null when none is recognised.
 */
function findBrowser( ua: string ): BrowserHit | null {
	for ( const candidate of BROWSERS ) {
		const match = ua.match( candidate.token );
		if ( match ) {
			return { name: candidate.name, version: match[ 1 ] };
		}
	}
	return null;
}

/**
 * Identifies the operating system from a user-agent string. Android is tested
 * before Linux (an Android string also names Linux) and the mobile Apple
 * platforms before macOS, so each platform resolves to its most specific label.
 *
 * @param ua The raw user-agent string.
 * @return The OS label, or null when none is recognised.
 */
function findOs( ua: string ): string | null {
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
	return null;
}

/**
 * Distills a raw user-agent string into a short browser-and-OS label. Falls back
 * to whichever half is recognised, and to `Unknown browser` when the string is
 * empty or recognisably nothing.
 *
 * @param ua The raw `navigator.userAgent` string.
 * @return The descriptive label, e.g. `Chrome 149 · macOS`.
 */
export function describeUserAgent( ua: string ): string {
	const raw = ua?.trim() ?? '';
	if ( raw === '' ) {
		return 'Unknown browser';
	}

	const browser = findBrowser( raw );
	const os = findOs( raw );
	const browserLabel = browser
		? `${ browser.name } ${ browser.version }`
		: null;

	if ( browserLabel && os ) {
		return `${ browserLabel } · ${ os }`;
	}
	return browserLabel ?? os ?? 'Unknown browser';
}
